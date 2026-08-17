import { changeFor, RepairRule, RuleResult } from "../engine/types";

export const codeFenceRule: RepairRule = {
  id: "code-fence-close",
  category: "code-fence",
  apply(document): RuleResult {
    const lines = [...document.lines];
    let opening: { marker: string; line: number } | undefined;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!opening) {
        const match = /^\s*(`{3,}|~{3,})(?:.*)$/.exec(line);
        if (match) opening = { marker: match[1], line: index };
        continue;
      }

      const close = new RegExp(`^\\s*${opening.marker[0]}{${opening.marker.length},}\\s*$`).test(line);
      if (close) opening = undefined;
    }

    if (!opening) return { text: document.text, changes: [], skipped: [] };

    const closing = opening.marker[0].repeat(opening.marker.length);
    const before = lines[lines.length - 1] ?? "";
    if (before.length > 0) lines.push(closing);
    else lines[lines.length - 1] = closing;
    return {
      text: lines.join(document.lineEnding),
      changes: [changeFor(this.id, this.category, opening.line + 1, "Add a missing code fence", "", closing)],
      skipped: []
    };
  }
};
