import { Editor, Notice, Plugin, TFile } from "obsidian";
import { repairEngine, RepairResult } from "./engine/repair-engine";
import { FormatterPluginLike, FormatterSettings, FormatterSettingTab, DEFAULT_SETTINGS } from "./settings/settings";
import { BatchCandidate, BatchSelectionModal } from "./ui/batch-modal";
import { RepairPreviewModal } from "./ui/preview-modal";

interface SnapshotFile {
  path: string;
  before: string;
  after: string;
}

interface RepairSnapshot {
  timestamp: number;
  files: SnapshotFile[];
}

interface StoredData {
  settings?: Partial<FormatterSettings>;
  history?: RepairSnapshot[];
}

export default class MarkdownFormatterPlugin extends Plugin implements FormatterPluginLike {
  settings: FormatterSettings = DEFAULT_SETTINGS;
  private history: RepairSnapshot[] = [];

  async onload(): Promise<void> {
    const data = (await this.loadData()) as StoredData | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) };
    this.history = data?.history ?? [];
    this.addSettingTab(new FormatterSettingTab(this.app, this));

    this.addCommand({
      id: "repair-current-selection-or-document",
      name: "Repair current selection or document",
      editorCallback: (editor) => void this.repairEditor(editor)
    });
    this.addCommand({
      id: "scan-current-folder",
      name: "Scan current folder for repairs",
      callback: () => void this.scanBatch("folder")
    });
    this.addCommand({
      id: "scan-entire-vault",
      name: "Scan entire vault for repairs",
      callback: () => void this.scanBatch("vault")
    });
    this.addCommand({
      id: "restore-last-repair",
      name: "Restore the most recent repair",
      callback: () => void this.restoreLastRepair()
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData({ settings: this.settings, history: this.history });
  }

  private getRepair(text: string): RepairResult {
    return repairEngine.repair(text, {
      enabledRuleIds: this.settings.enabledRuleIds,
      preserveLineEnding: this.settings.preserveLineEnding
    });
  }

  private async repairEditor(editor: Editor): Promise<void> {
    const selection = editor.getSelection();
    const documentBefore = editor.getValue();
    const before = selection.length > 0 ? selection : editor.getValue();
    const result = this.getRepair(before);
    if (result.text === before) {
      new Notice("No safe Markdown repairs found.");
      return;
    }
    const apply = async () => {
      if (selection.length > 0) editor.replaceSelection(result.text);
      else editor.replaceRange(result.text, { line: 0, ch: 0 }, editor.offsetToPos(editor.getValue().length));
      const file = this.app.workspace.getActiveFile();
      if (file) await this.recordSnapshot([{ path: file.path, before: documentBefore, after: editor.getValue() }]);
      new Notice("Markdown repair applied.");
    };
    if (!this.settings.forcePreview) await apply();
    else new RepairPreviewModal(this.app, "Review Markdown repair", before, result, apply, undefined, this.app.workspace.getActiveFile()?.path ?? "").open();
  }

  private async scanBatch(scope: "folder" | "vault"): Promise<void> {
    const active = this.app.workspace.getActiveFile();
    const folder = active?.path.includes("/") ? active.path.slice(0, active.path.lastIndexOf("/")) : "";
    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      if (scope === "vault") return true;
      return folder.length === 0 ? !file.path.includes("/") : file.path.startsWith(`${folder}/`);
    });
    const candidates: BatchCandidate[] = [];
    for (const file of files.slice(0, this.settings.batchLimit)) {
      const before = await this.app.vault.read(file);
      const result = this.getRepair(before);
      if (result.text !== before) candidates.push({ file, before, result });
    }
    if (candidates.length === 0) {
      new Notice("No safe Markdown repairs found in the selected scope.");
      return;
    }
    if (files.length > this.settings.batchLimit) new Notice(`Only the first ${this.settings.batchLimit} files were scanned.`);
    new BatchSelectionModal(this.app, candidates, (selected) => void this.reviewBatch(selected)).open();
  }

  private async reviewBatch(candidates: BatchCandidate[]): Promise<void> {
    const snapshots: SnapshotFile[] = [];
    for (const candidate of candidates) {
      const confirmed = await this.confirmCandidate(candidate);
      if (!confirmed) continue;
      const current = await this.app.vault.read(candidate.file);
      if (current !== candidate.before) {
        new Notice(`Skipped ${candidate.file.path}: it changed after scanning.`);
        continue;
      }
      await this.app.vault.process(candidate.file, () => candidate.result.text);
      snapshots.push({ path: candidate.file.path, before: candidate.before, after: candidate.result.text });
    }
    if (snapshots.length > 0) {
      await this.recordSnapshot(snapshots);
      new Notice(`Repaired ${snapshots.length} file(s).`);
    }
  }

  private confirmCandidate(candidate: BatchCandidate): Promise<boolean> {
    return new Promise((resolve) => {
      new RepairPreviewModal(this.app, `Review ${candidate.file.path}`, candidate.before, candidate.result, () => resolve(true), () => resolve(false), candidate.file.path).open();
    });
  }

  private async recordSnapshot(files: SnapshotFile[]): Promise<void> {
    if (this.settings.historyLimit <= 0) return;
    this.history.unshift({ timestamp: Date.now(), files });
    this.history = this.history.slice(0, this.settings.historyLimit);
    await this.saveSettings();
  }

  private async restoreLastRepair(): Promise<void> {
    const snapshot = this.history[0];
    if (!snapshot) {
      new Notice("No repair history is available.");
      return;
    }
    let restored = 0;
    for (const item of snapshot.files) {
      const file = this.app.vault.getAbstractFileByPath(item.path);
      if (!(file instanceof TFile)) continue;
      const current = await this.app.vault.read(file);
      if (current !== item.after) continue;
      await this.app.vault.process(file, () => item.before);
      restored += 1;
    }
    new Notice(`Restored ${restored} file(s). Files changed since repair were skipped.`);
  }

  onunload(): void {
    // Obsidian disposes registered commands, settings, and views automatically.
  }
}
