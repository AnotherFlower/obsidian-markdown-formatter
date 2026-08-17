import { App, Modal, TFile } from "obsidian";
import { RepairResult } from "../engine/repair-engine";

export interface BatchCandidate {
  file: TFile;
  before: string;
  result: RepairResult;
}

export class BatchSelectionModal extends Modal {
  private readonly selected = new Set<string>();

  constructor(app: App, private readonly candidates: BatchCandidate[], private readonly onSubmit: (files: BatchCandidate[]) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Select Markdown files to repair");
    const content = this.contentEl;
    content.empty();
    content.createEl("p", { text: `${this.candidates.length} file(s) contain possible repairs.` });
    const list = content.createDiv({ cls: "omf-batch-list" });
    for (const candidate of this.candidates) {
      const label = list.createEl("label", { cls: "omf-batch-item" });
      const checkbox = label.createEl("input", { type: "checkbox" });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected.add(candidate.file.path);
        else this.selected.delete(candidate.file.path);
      });
      label.createSpan({ text: `${candidate.file.path} (${candidate.result.stats.changes} change(s), ${candidate.result.stats.skipped} skipped)` });
    }
    const buttons = content.createDiv({ cls: "omf-modal-buttons" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const apply = buttons.createEl("button", { text: "Review selected", cls: "mod-cta" });
    apply.addEventListener("click", () => {
      this.onSubmit(this.candidates.filter((candidate) => this.selected.has(candidate.file.path)));
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
