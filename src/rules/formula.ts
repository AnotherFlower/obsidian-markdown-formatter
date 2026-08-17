import {
  changeFor,
  createProtectedDocument,
  isLineProtected,
  maskInlineCode,
  RepairRule,
  RuleResult
} from "../engine/types";

function replaceDelimited(line: string, open: string, close: string, replacementOpen: string, replacementClose: string): string {
  const start = line.indexOf(open);
  const end = line.indexOf(close, start + open.length);
  if (start < 0 || end < 0) return line;
  const body = line.slice(start + open.length, end).trim();
  return `${line.slice(0, start)}${replacementOpen}${body}${replacementClose}${line.slice(end + close.length)}`;
}

function replaceDisplayFormula(line: string): string {
  const start = line.indexOf("\\[");
  const end = line.indexOf("\\]", start + 2);
  if (start < 0 || end < 0) return line;
  const body = line.slice(start + 2, end).trim();
  const prefix = line.slice(0, start).trimEnd();
  const suffix = line.slice(end + 2).trimStart();
  return [prefix, "$$", body, "$$", suffix].filter((part) => part.length > 0).join("\n");
}

export const formulaRule: RepairRule = {
  id: "formula-delimiters",
  category: "formula",
  apply(document): RuleResult {
    const lines = [...document.lines];
    const changes = [];
    const skipped = [];

    for (let index = 0; index < lines.length; index += 1) {
      const currentDocument = createProtectedDocument(lines.join(document.lineEnding));
      if (isLineProtected(currentDocument, index)) continue;
      const before = lines[index];
      const masked = maskInlineCode(before);

      const displayOpen = /^(\s*)\\\[\s*$/.exec(before);
      if (displayOpen) {
        let closeIndex = -1;
        for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
          const candidateDocument = createProtectedDocument(lines.join(document.lineEnding));
          if (isLineProtected(candidateDocument, candidate)) continue;
          if (/^\s*\\\]\s*$/.test(lines[candidate])) {
            closeIndex = candidate;
            break;
          }
        }

        if (closeIndex < 0) {
          skipped.push({
            ruleId: this.id,
            category: this.category,
            line: index + 1,
            message: "Unmatched multi-line display formula was left unchanged"
          });
          continue;
        }

        const indentation = displayOpen[1];
        const body = lines.slice(index + 1, closeIndex);
        const replacement = [`${indentation}$$`, ...body, `${indentation}$$`];
        const original = lines.slice(index, closeIndex + 1).join(document.lineEnding);
        lines.splice(index, closeIndex - index + 1, ...replacement);
        changes.push(changeFor(this.id, this.category, index + 1, "Normalize multi-line display formula", original, replacement.join(document.lineEnding)));
        index += replacement.length - 1;
        continue;
      }

      let after = before;
      if (masked.includes("\\(") && masked.includes("\\)")) {
        after = replaceDelimited(after, "\\(", "\\)", "$", "$");
      }
      if (masked.includes("\\[") && masked.includes("\\]")) {
        after = replaceDisplayFormula(after);
      }

      const compactDisplay = /^\s*\$\$(.+)\$\$\s*$/.exec(after);
      if (compactDisplay) {
        const body = compactDisplay[1].trim();
        after = `$$\n${body}\n$$`;
      }

      const hasOpening = (masked.match(/(?<!\\)\$/g) ?? []).length % 2 === 1;
      if (hasOpening && !masked.includes("$$")) {
        skipped.push({
          ruleId: this.id,
          category: this.category,
          line: index + 1,
          message: "Unmatched inline formula delimiter was left unchanged"
        });
      }

      if (after !== before) {
        lines.splice(index, 1, ...after.split("\n"));
        changes.push(
          changeFor(this.id, this.category, index + 1, "Normalize formula delimiters", before, after)
        );
        index += after.split("\n").length - 1;
      }
    }

    return { text: lines.join(document.lineEnding), changes, skipped };
  }
};
