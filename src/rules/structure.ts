import { changeFor, isLineProtected, maskInlineCode, RepairRule, RuleResult } from "../engine/types";

export const structureRule: RepairRule = {
  id: "block-spacing",
  category: "structure",
  apply(document): RuleResult {
    const lines = [...document.lines];
    const changes = [];

    for (let index = 0; index < lines.length; index += 1) {
      if (isLineProtected(document, index)) continue;
      const before = lines[index];
      const masked = maskInlineCode(before);
      let after = before;
      const heading = /^(\s*)(#{1,6})(.*)$/.exec(after);
      if (heading) {
        const [, indentation, markers, rest] = heading;
        if (/^\s+#+(?:\s|$)/.test(rest)) {
          // Remove an accidental second heading marker such as `### # 2. Topic`.
          after = after.replace(/^(\s*)(#{1,6})\s+#+\s*/, (_match, indent: string, level: string) => `${indent}${level} `);
        } else if (rest.length === 0) {
          after = `${indentation}${markers}`;
        } else if (/^\s{2,}/.test(rest)) {
          // Multiple spaces after a heading marker are unambiguous formatting noise.
          after = `${indentation}${markers} ${rest.trimStart()}`;
        } else if (!/^\s/.test(rest)) {
          after = `${indentation}${markers} ${rest}`;
        }
      }
      // AI output sometimes nests an ordered item under an unnecessary unordered marker.
      after = after.replace(/^(\s*)[-+*]\s+(\d+[.)])\s+/, "$1$2 ");
      // Do not mistake horizontal rules or strong/emphasis delimiters for list markers.
      if (!/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(masked) && !/^\s*\*{2,}/.test(masked)) {
        after = after.replace(/^(\s*)([-+*])(?=\S)/, "$1$2 ");
      }
      after = after.replace(/^(\s*)(\d+[.)])(?=\S)/, "$1$2 ");
      after = after.replace(/^(\s*>)(?=\S)/, "$1 ");
      if (/^\s*>\s*\[![^\]]+\]/.test(masked)) {
        after = after.replace(/^(\s*>\s*\[![^\]]+\])\s*/, "$1 ");
      }
      if (after !== before) {
        lines[index] = after;
        changes.push(changeFor(this.id, this.category, index + 1, "Normalize block prefix spacing", before, after));
      }
    }
    return { text: lines.join(document.lineEnding), changes, skipped: [] };
  }
};
