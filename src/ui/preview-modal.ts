import { App, Component, MarkdownRenderer, Modal } from "obsidian";
import { RepairResult } from "../engine/repair-engine";

export class RepairPreviewModal extends Modal {
  private resolved = false;
  private renderComponent?: Component;

  constructor(
    app: App,
    private readonly title: string,
    private readonly before: string,
    private readonly result: RepairResult,
    private readonly onConfirm: () => Promise<void> | void,
    private readonly onCancel?: () => void,
    private readonly sourcePath = ""
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.classList.add("omf-resizable-modal");
    this.titleEl.setText(this.title);
    const content = this.contentEl;
    content.empty();
    content.createEl("p", { text: `${this.result.stats.changes} change(s), ${this.result.stats.skipped} skipped issue(s).` });
    const rendered = content.createDiv({ cls: "omf-rendered-preview" });
    const beforePanel = rendered.createDiv({ cls: "omf-preview-panel" });
    beforePanel.createEl("h3", { text: "Original rendering" });
    const beforeBody = beforePanel.createDiv({ cls: "omf-preview-body" });
    const afterPanel = rendered.createDiv({ cls: "omf-preview-panel" });
    afterPanel.createEl("h3", { text: "After repair" });
    const afterBody = afterPanel.createDiv({ cls: "omf-preview-body" });
    this.renderComponent = new Component();
    void MarkdownRenderer.render(this.app, this.before, beforeBody, this.sourcePath, this.renderComponent);
    void MarkdownRenderer.render(this.app, this.result.text, afterBody, this.sourcePath, this.renderComponent);

    const details = content.createEl("details");
    details.createEl("summary", { text: "Show source diff" });
    const pre = details.createEl("pre");
    pre.setText(createPreview(this.before, this.result.text));

    if (this.result.skipped.length > 0) {
      const skipped = content.createEl("details");
      skipped.createEl("summary", { text: "Skipped items" });
      const list = skipped.createEl("ul");
      for (const issue of this.result.skipped) {
        list.createEl("li", { text: `Line ${issue.line}: ${issue.message}` });
      }
    }

    const buttons = content.createDiv({ cls: "omf-modal-buttons" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const confirm = buttons.createEl("button", { text: "Apply", cls: "mod-cta" });
    confirm.addEventListener("click", () => {
      void this.confirmAndClose();
    });
  }

  onClose(): void {
    if (!this.resolved) this.onCancel?.();
    this.renderComponent?.unload();
    this.renderComponent = undefined;
    this.contentEl.empty();
    this.modalEl.classList.remove("omf-resizable-modal");
  }

  private async confirmAndClose(): Promise<void> {
    if (this.resolved) return;
    this.resolved = true;
    await this.onConfirm();
    this.close();
  }
}

function createPreview(before: string, after: string): string {
  if (before === after) return "No changes.";
  const oldLines = before.split(/\r?\n/);
  const newLines = after.split(/\r?\n/);
  const max = Math.max(oldLines.length, newLines.length);
  const output: string[] = [];
  for (let index = 0; index < max; index += 1) {
    const oldLine = oldLines[index];
    const newLine = newLines[index];
    if (oldLine === newLine) output.push(`  ${oldLine ?? ""}`);
    else {
      if (oldLine !== undefined) output.push(`- ${oldLine}`);
      if (newLine !== undefined) output.push(`+ ${newLine}`);
    }
  }
  return output.join("\n");
}
