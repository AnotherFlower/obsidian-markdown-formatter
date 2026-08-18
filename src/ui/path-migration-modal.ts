import { App, Modal, TFile } from "obsidian";
import { PathMigrationIssue, PathMigrationPlan } from "../path/encoded-path";

export interface PathMigrationCandidate {
  file: TFile;
  plan: PathMigrationPlan;
}

export class PathMigrationSelectionModal extends Modal {
  private readonly selected = new Set<string>();
  private readonly checkboxes = new Map<string, HTMLInputElement>();
  private selectAllCheckbox?: HTMLInputElement;
  private selectionSummary?: HTMLSpanElement;
  private reviewButton?: HTMLButtonElement;

  constructor(
    app: App,
    private readonly candidates: PathMigrationCandidate[],
    private readonly skipped: PathMigrationIssue[],
    private readonly onSubmit: (files: PathMigrationCandidate[]) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Normalize encoded note paths");
    const content = this.contentEl;
    content.empty();
    content.createEl("p", { text: `${this.candidates.length} file(s) can be moved to readable paths.` });
    const controls = content.createDiv({ cls: "omf-path-migration-controls" });
    const selectAllLabel = controls.createEl("label", { cls: "omf-path-migration-select-all" });
    this.selectAllCheckbox = selectAllLabel.createEl("input", { type: "checkbox" });
    selectAllLabel.createSpan({ text: "All files" });
    this.selectAllCheckbox.addEventListener("change", () => {
      this.setAllSelected(this.selectAllCheckbox?.checked ?? false);
    });
    const selectAll = controls.createEl("button", { text: "Select all" });
    selectAll.addEventListener("click", () => this.setAllSelected(true));
    const clearAll = controls.createEl("button", { text: "Clear all" });
    clearAll.addEventListener("click", () => this.setAllSelected(false));
    this.selectionSummary = controls.createSpan({ cls: "omf-path-migration-selection-summary" });
    const list = content.createDiv({ cls: "omf-batch-list" });
    for (const candidate of this.candidates) {
      const label = list.createEl("label", { cls: "omf-batch-item omf-path-migration-item" });
      const checkbox = label.createEl("input", { type: "checkbox" });
      this.checkboxes.set(candidate.file.path, checkbox);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected.add(candidate.file.path);
        else this.selected.delete(candidate.file.path);
        this.updateSelectionState();
      });
      const paths = label.createDiv({ cls: "omf-path-migration-paths" });
      paths.createEl("code", { text: candidate.plan.sourcePath });
      paths.createSpan({ text: " -> " });
      paths.createEl("code", { text: candidate.plan.targetPath });
    }
    if (this.skipped.length > 0) {
      const details = content.createEl("details");
      details.createEl("summary", { text: `${this.skipped.length} skipped item(s)` });
      const skipped = details.createEl("ul");
      for (const issue of this.skipped) {
        skipped.createEl("li", { text: `${issue.sourcePath}: ${issue.message}` });
      }
    }
    const buttons = content.createDiv({ cls: "omf-modal-buttons" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    this.reviewButton = buttons.createEl("button", { text: "Review selected", cls: "mod-cta" });
    this.reviewButton.addEventListener("click", () => {
      this.onSubmit(this.candidates.filter((candidate) => this.selected.has(candidate.file.path)));
      this.close();
    });
    this.updateSelectionState();
  }

  onClose(): void {
    this.checkboxes.clear();
    this.selectAllCheckbox = undefined;
    this.selectionSummary = undefined;
    this.reviewButton = undefined;
    this.contentEl.empty();
  }

  private setAllSelected(selected: boolean): void {
    this.selected.clear();
    for (const [path, checkbox] of this.checkboxes) {
      checkbox.checked = selected;
      if (selected) this.selected.add(path);
    }
    this.updateSelectionState();
  }

  private updateSelectionState(): void {
    const selectedCount = this.selected.size;
    const total = this.candidates.length;
    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.checked = total > 0 && selectedCount === total;
      this.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < total;
    }
    this.selectionSummary?.setText(`${selectedCount} of ${total} selected`);
    if (this.reviewButton) this.reviewButton.disabled = selectedCount === 0;
  }
}

export class PathMigrationBatchPreviewModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly candidates: PathMigrationCandidate[],
    private readonly onConfirm: () => Promise<void> | void,
    private readonly onCancel?: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Review selected path migrations");
    const content = this.contentEl;
    content.empty();
    content.createEl("p", { text: `${this.candidates.length} selected note${this.candidates.length === 1 ? "" : "s"} will be moved. Note bodies will not be changed.` });
    const paths = content.createDiv({ cls: "omf-batch-list omf-path-migration-preview-list" });
    for (const candidate of this.candidates) {
      const item = paths.createDiv({ cls: "omf-path-migration-preview" });
      item.createEl("code", { text: candidate.plan.sourcePath });
      item.createSpan({ text: " -> " });
      item.createEl("code", { text: candidate.plan.targetPath });
    }
    const directoriesToCreate = [...new Set(this.candidates.flatMap((candidate) => candidate.plan.targetDirectories))];
    if (directoriesToCreate.length > 0) {
      const directories = content.createEl("details");
      directories.createEl("summary", { text: `${directoriesToCreate.length} target director${directoriesToCreate.length === 1 ? "y" : "ies"}` });
      const list = directories.createEl("ul");
      for (const directory of directoriesToCreate) {
        list.createEl("li", { text: `${directory} (created if missing)` });
      }
    }
    const buttons = content.createDiv({ cls: "omf-modal-buttons" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const move = buttons.createEl("button", { text: `Move ${this.candidates.length} file(s)`, cls: "mod-cta" });
    move.addEventListener("click", () => {
      void this.confirmAndClose();
    });
  }

  onClose(): void {
    if (!this.resolved) this.onCancel?.();
    this.contentEl.empty();
  }

  private async confirmAndClose(): Promise<void> {
    if (this.resolved) return;
    this.resolved = true;
    await this.onConfirm();
    this.close();
  }
}
