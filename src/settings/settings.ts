import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { RepairCategory } from "../engine/types";

export interface FormatterSettings {
  enabledRuleIds: string[];
  forcePreview: boolean;
  batchLimit: number;
  historyLimit: number;
  preserveLineEnding: boolean;
}

export const DEFAULT_SETTINGS: FormatterSettings = {
  enabledRuleIds: ["code-fence-close", "formula-delimiters", "table-structure", "block-spacing", "trailing-whitespace"],
  forcePreview: true,
  batchLimit: 100,
  historyLimit: 5,
  preserveLineEnding: true
};

export const RULE_LABELS: Array<{ id: string; category: RepairCategory; name: string; description: string }> = [
  { id: "formula-delimiters", category: "formula", name: "Formula delimiters", description: "Normalize LaTeX delimiters and display formula layout." },
  { id: "table-structure", category: "table", name: "Table structure", description: "Repair table separators, columns, and alignment markers." },
  { id: "code-fence-close", category: "code-fence", name: "Code fences", description: "Close an unclosed fenced code block." },
  { id: "block-spacing", category: "structure", name: "Block spacing", description: "Normalize heading, list, quote, and callout prefixes." },
  { id: "trailing-whitespace", category: "whitespace", name: "Trailing whitespace", description: "Remove accidental trailing spaces except Markdown hard breaks." }
];

export class FormatterSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: FormatterPluginLike & Plugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Always show preview")
      .setDesc("Require confirmation before any document is changed.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.forcePreview).onChange(async (value) => {
        this.plugin.settings.forcePreview = value;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Preserve line endings")
      .setDesc("Keep the current document's LF or CRLF style.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.preserveLineEnding).onChange(async (value) => {
        this.plugin.settings.preserveLineEnding = value;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Batch file limit")
      .setDesc("Maximum number of files selected in one batch scan.")
      .addText((text) => text.setValue(String(this.plugin.settings.batchLimit)).onChange(async (value) => {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.plugin.settings.batchLimit = Math.min(parsed, 1000);
          await this.plugin.saveSettings();
        }
      }));

    new Setting(containerEl)
      .setName("Repair history limit")
      .setDesc("Number of previous repair snapshots retained for recovery.")
      .addText((text) => text.setValue(String(this.plugin.settings.historyLimit)).onChange(async (value) => {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          this.plugin.settings.historyLimit = Math.min(parsed, 20);
          await this.plugin.saveSettings();
        }
      }));

    new Setting(containerEl)
      .setName("Enabled rules")
      .setHeading();
    for (const rule of RULE_LABELS) {
      new Setting(containerEl)
        .setName(rule.name)
        .setDesc(rule.description)
        .addToggle((toggle) => toggle.setValue(this.plugin.settings.enabledRuleIds.includes(rule.id)).onChange(async (value) => {
          const ids = new Set(this.plugin.settings.enabledRuleIds);
          if (value) ids.add(rule.id);
          else ids.delete(rule.id);
          this.plugin.settings.enabledRuleIds = [...ids];
          await this.plugin.saveSettings();
        }));
    }
  }
}

export interface FormatterPluginLike {
  settings: FormatterSettings;
  saveSettings(): Promise<void>;
}
