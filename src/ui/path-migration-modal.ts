import { App, Modal, TFile } from "obsidian";
import { PathMigrationIssue, PathMigrationPlan } from "../path/encoded-path";

export interface PathMigrationCandidate {
  file: TFile;
  plan: PathMigrationPlan;
}

export class PathMigrationSelectionModal extends Modal {
  private readonly selected = new Set<string>();

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
    const list = content.createDiv({ cls: "omf-batch-list" });
    for (const candidate of this.candidates) {
      const label = list.createEl("label", { cls: "omf-batch-item omf-path-migration-item" });
      const checkbox = label.createEl("input", { type: "checkbox" });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected.add(candidate.file.path);
        else this.selected.delete(candidate.file.path);
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
    const review = buttons.createEl("button", { text: "Review selected", cls: "mod-cta" });
    review.addEventListener("click", () => {
      this.onSubmit(this.candidates.filter((candidate) => this.selected.has(candidate.file.path)));
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class PathMigrationPreviewModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly candidate: PathMigrationCandidate,
    private readonly onConfirm: () => Promise<void> | void,
    private readonly onCancel?: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Review note path migration");
    const content = this.contentEl;
    content.empty();
    content.createEl("p", { text: "The note body will not be changed." });
    const paths = content.createDiv({ cls: "omf-path-migration-preview" });
    paths.createEl("code", { text: this.candidate.plan.sourcePath });
    paths.createSpan({ text: " -> " });
    paths.createEl("code", { text: this.candidate.plan.targetPath });
    if (this.candidate.plan.targetDirectories.length > 0) {
      const directories = content.createEl("details");
      directories.createEl("summary", { text: "Target directories" });
      const list = directories.createEl("ul");
      for (const directory of this.candidate.plan.targetDirectories) {
        list.createEl("li", { text: `${directory} (created if missing)` });
      }
    }
    const buttons = content.createDiv({ cls: "omf-modal-buttons" });
    const skip = buttons.createEl("button", { text: "Skip" });
    skip.addEventListener("click", () => this.close());
    const move = buttons.createEl("button", { text: "Move", cls: "mod-cta" });
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
