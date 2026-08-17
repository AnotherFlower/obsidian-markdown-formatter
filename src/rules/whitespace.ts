import { changeFor, isLineProtected, RepairRule, RuleResult } from "../engine/types";

export const whitespaceRule: RepairRule = {
  id: "trailing-whitespace",
  category: "whitespace",
  apply(document): RuleResult {
    const lines = [...document.lines];
    const changes = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (isLineProtected(document, index)) continue;
      const before = lines[index];
      if (/\s+$/.test(before) && !/ {2}$/.test(before)) {
        const after = before.replace(/\s+$/, "");
        lines[index] = after;
        changes.push(changeFor(this.id, this.category, index + 1, "Remove trailing whitespace", before, after));
      }
    }
    return { text: lines.join(document.lineEnding), changes, skipped: [] };
  }
};
