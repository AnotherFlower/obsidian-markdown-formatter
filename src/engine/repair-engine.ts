import {
  createProtectedDocument,
  RepairChange,
  RepairIssue,
  RepairOptions,
  RepairRule,
  RepairStats,
  RuleResult
} from "./types";
import { codeFenceRule } from "../rules/code-fence";
import { formulaRule } from "../rules/formula";
import { structureRule } from "../rules/structure";
import { tableRule } from "../rules/table";
import { whitespaceRule } from "../rules/whitespace";

export interface RepairResult {
  text: string;
  changes: RepairChange[];
  skipped: RepairIssue[];
  stats: RepairStats;
}

const defaultRules: RepairRule[] = [codeFenceRule, formulaRule, tableRule, structureRule, whitespaceRule];

export class RepairEngine {
  constructor(private readonly rules: RepairRule[] = defaultRules) {}

  repair(input: string, options: RepairOptions = {}): RepairResult {
    const enabled = options.enabledRuleIds ? new Set(options.enabledRuleIds) : undefined;
    let text = input;
    const changes: RepairChange[] = [];
    const skipped: RepairIssue[] = [];

    for (const rule of this.rules) {
      if (enabled && !enabled.has(rule.id)) continue;
      const result: RuleResult = rule.apply(createProtectedDocument(text));
      text = result.text;
      changes.push(...result.changes);
      skipped.push(...result.skipped);
    }

    if (text.length > 0 && !text.endsWith("\n") && !text.endsWith("\r")) {
      const lineEnding = text.includes("\r\n") ? "\r\n" : "\n";
      text += lineEnding;
      changes.push({
        ruleId: "final-newline",
        category: "whitespace",
        line: text.split(/\r?\n/).length - 1,
        description: "Add a final newline",
        before: "",
        after: ""
      });
    }

    const changedLines = changes.filter((change) => change.before !== change.after).length;
    return {
      text,
      changes,
      skipped,
      stats: { changedLines, changes: changes.length, skipped: skipped.length }
    };
  }
}

export const repairEngine = new RepairEngine();
