import { Editor, Notice, Plugin, TFile, TFolder } from "obsidian";
import { repairEngine, RepairResult } from "./engine/repair-engine";
import { FormatterPluginLike, FormatterSettings, FormatterSettingTab, DEFAULT_SETTINGS } from "./settings/settings";
import { BatchCandidate, BatchSelectionModal } from "./ui/batch-modal";
import { RepairPreviewModal } from "./ui/preview-modal";
import { PathMigrationCandidate, PathMigrationPreviewModal, PathMigrationSelectionModal } from "./ui/path-migration-modal";
import { PathMigrationPlan, scanEncodedMarkdownPaths } from "./path/encoded-path";

interface SnapshotFile {
  path: string;
  before: string;
  after: string;
}

interface SnapshotMove {
  sourcePath: string;
  targetPath: string;
}

interface RepairSnapshot {
  timestamp: number;
  files: SnapshotFile[];
  moves?: SnapshotMove[];
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
      id: "normalize-encoded-paths-current-folder",
      name: "Normalize encoded note paths in current folder",
      callback: () => void this.scanPathMigrations("folder")
    });
    this.addCommand({
      id: "normalize-encoded-paths-entire-vault",
      name: "Normalize encoded note paths in entire vault",
      callback: () => void this.scanPathMigrations("vault")
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
    const files = this.getMarkdownFilesForScope(scope);
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

  private getMarkdownFilesForScope(scope: "folder" | "vault"): TFile[] {
    if (scope === "vault") return this.app.vault.getMarkdownFiles();
    const active = this.app.workspace.getActiveFile();
    const folder = active?.path.includes("/") ? active.path.slice(0, active.path.lastIndexOf("/")) : "";
    return this.app.vault.getMarkdownFiles().filter((file) => (
      folder.length === 0 ? !file.path.includes("/") : file.path.startsWith(`${folder}/`)
    ));
  }

  private scanPathMigrations(scope: "folder" | "vault"): void {
    const files = this.getMarkdownFilesForScope(scope);
    const limitedFiles = files.slice(0, this.settings.batchLimit);
    const limitedPaths = new Set(limitedFiles.map((file) => file.path));
    const fullScan = scanEncodedMarkdownPaths(files.map((file) => file.path));
    const scan = {
      plans: fullScan.plans.filter((plan) => limitedPaths.has(plan.sourcePath)),
      skipped: fullScan.skipped.filter((issue) => limitedPaths.has(issue.sourcePath))
    };
    const filesByPath = new Map(limitedFiles.map((file) => [file.path, file]));
    const candidates: PathMigrationCandidate[] = scan.plans
      .map((plan) => ({ file: filesByPath.get(plan.sourcePath), plan }))
      .filter((candidate): candidate is PathMigrationCandidate => candidate.file !== undefined);

    if (candidates.length === 0) {
      new Notice(scan.skipped.length > 0
        ? `No safe encoded paths found. ${scan.skipped.length} item(s) skipped.`
        : "No encoded Markdown paths found in the selected scope.");
      return;
    }
    if (files.length > this.settings.batchLimit) new Notice(`Only the first ${this.settings.batchLimit} files were scanned.`);
    new PathMigrationSelectionModal(this.app, candidates, scan.skipped, (selected) => void this.reviewPathMigrations(selected)).open();
  }

  private async reviewPathMigrations(candidates: PathMigrationCandidate[]): Promise<void> {
    const moves: SnapshotMove[] = [];
    for (const candidate of candidates) {
      const confirmed = await this.confirmPathMigration(candidate);
      if (!confirmed) continue;
      const source = this.app.vault.getAbstractFileByPath(candidate.plan.sourcePath);
      if (!(source instanceof TFile)) {
        new Notice(`Skipped ${candidate.plan.sourcePath}: source file changed after scanning.`);
        continue;
      }
      if (this.app.vault.getAbstractFileByPath(candidate.plan.targetPath)) {
        new Notice(`Skipped ${candidate.plan.sourcePath}: target already exists.`);
        continue;
      }
      try {
        await this.ensureTargetFolders(candidate.plan);
        await this.app.fileManager.renameFile(source, candidate.plan.targetPath);
        moves.push({ sourcePath: candidate.plan.sourcePath, targetPath: candidate.plan.targetPath });
      } catch (error) {
        new Notice(`Skipped ${candidate.plan.sourcePath}: ${error instanceof Error ? error.message : "move failed"}.`);
      }
    }
    if (moves.length > 0) {
      await this.recordSnapshot([], moves);
      new Notice(`Moved ${moves.length} file(s) to readable paths.`);
    }
  }

  private confirmPathMigration(candidate: PathMigrationCandidate): Promise<boolean> {
    return new Promise((resolve) => {
      new PathMigrationPreviewModal(
        this.app,
        candidate,
        () => resolve(true),
        () => resolve(false)
      ).open();
    });
  }

  private async ensureTargetFolders(plan: PathMigrationPlan): Promise<void> {
    for (const directory of plan.targetDirectories) {
      const existing = this.app.vault.getAbstractFileByPath(directory);
      if (existing) {
        if (!(existing instanceof TFolder)) throw new Error(`Target path is not a folder: ${directory}`);
        continue;
      }
      await this.app.vault.createFolder(directory);
    }
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

  private async recordSnapshot(files: SnapshotFile[], moves: SnapshotMove[] = []): Promise<void> {
    if (this.settings.historyLimit <= 0) return;
    if (files.length === 0 && moves.length === 0) return;
    this.history.unshift({ timestamp: Date.now(), files, moves });
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
    for (const move of snapshot.moves ?? []) {
      const source = this.app.vault.getAbstractFileByPath(move.sourcePath);
      const target = this.app.vault.getAbstractFileByPath(move.targetPath);
      if (source || !(target instanceof TFile)) continue;
      try {
        await this.app.fileManager.renameFile(target, move.sourcePath);
        restored += 1;
      } catch {
        // Keep the file in place when its original path can no longer be restored safely.
      }
    }
    new Notice(`Restored ${restored} file(s). Files changed since repair were skipped.`);
  }

  onunload(): void {
    // Obsidian disposes registered commands, settings, and views automatically.
  }
}
