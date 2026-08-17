import {
  changeFor,
  createProtectedDocument,
  isLineProtected,
  RepairRule,
  RuleResult
} from "../engine/types";

function splitCells(line: string): string[] {
  let cells: string[] = [];
  let current = "";
  let inCode = false;
  let wikiDepth = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "`" && line[index - 1] !== "\\") inCode = !inCode;
    if (!inCode && char === "[" && line[index + 1] === "[") wikiDepth += 1;
    if (!inCode && char === "]" && line[index + 1] === "]" && wikiDepth > 0) wikiDepth -= 1;
    if (char === "|" && line[index - 1] !== "\\" && !inCode && wikiDepth === 0) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  if (cells[0] === "") cells.shift();
  if (cells[cells.length - 1] === "") cells.pop();
  return cells;
}

interface TableLine {
  prefix: string;
  cells: string[];
}

function parseTableLine(line: string): TableLine | undefined {
  const listPrefix = /^(\s*)([-+*])\s+(?=\|)/.exec(line);
  const prefix = listPrefix ? `${listPrefix[1]}${listPrefix[2]} ` : "";
  const content = listPrefix ? line.slice(listPrefix[0].length) : line.trim();
  const trimmed = content.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return undefined;
  return { prefix, cells: splitCells(trimmed) };
}

function isSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function renderRow(cells: string[], count: number): string {
  const padded = [...cells];
  while (padded.length < count) padded.push("");
  return `| ${padded.slice(0, count).join(" | ")} |`;
}

export const tableRule: RepairRule = {
  id: "table-structure",
  category: "table",
  apply(document): RuleResult {
    const lines = [...document.lines];
    const changes: ReturnType<typeof changeFor>[] = [];
    const skipped: RuleResult["skipped"] = [];
    let index = 0;

    while (index < lines.length) {
      const currentDocument = createProtectedDocument(lines.join(document.lineEnding));
      const first = parseTableLine(lines[index]);
      if (isLineProtected(currentDocument, index) || !first || first.cells.length < 2) {
        index += 1;
        continue;
      }
      const start = index;
      const group: number[] = [];
      const prefix = first.prefix;
      while (index < lines.length) {
        const current = parseTableLine(lines[index]);
        if (isLineProtected(currentDocument, index) || !current || current.prefix !== prefix) break;
        group.push(index);
        index += 1;
      }
      if (group.length < 2) continue;

      const parsed = group.map((lineIndex) => parseTableLine(lines[lineIndex])?.cells ?? []);
      if (parsed[0].length < 2 || Math.max(...parsed.map((cells) => cells.length)) < 2) {
        skipped.push({
          ruleId: this.id,
          category: this.category,
          line: start + 1,
          message: "Ambiguous pipe text was left unchanged"
        });
        continue;
      }
      const columnCount = Math.max(...parsed.map((cells) => cells.length));
      if (columnCount < 2) continue;
      if (!isSeparator(parsed[1])) parsed.splice(1, 0, Array.from({ length: columnCount }, () => "---"));

      const rendered = parsed.map((cells) => isSeparator(cells)
        ? renderRow(cells.map((cell) => /^:?-{1,}:?$/.test(cell) ? (cell.length < 3 ? "---" : cell) : "---"), columnCount)
        : renderRow(cells, columnCount));
      const oldLines = lines.slice(start, start + group.length);
      const hasListPrefix = prefix.length > 0;
      const beforeNeedsBlank = !hasListPrefix && start > 0 && lines[start - 1].trim().length > 0;
      if (beforeNeedsBlank) {
        lines.splice(start, 0, "");
      }
      const tableStart = start + (beforeNeedsBlank ? 1 : 0);
      const tableEnd = tableStart + group.length;
      const afterNeedsBlank = !hasListPrefix && tableEnd < lines.length && lines[tableEnd].trim().length > 0;
      if (afterNeedsBlank) {
        lines.splice(tableEnd, 0, "");
      }
      lines.splice(tableStart, group.length, ...rendered);
      rendered.forEach((line, offset) => {
        const old = oldLines[offset] ?? "";
        if (line !== old) {
          changes.push(changeFor(this.id, this.category, start + offset + 1, "Normalize table row", old, line));
        }
      });
      index = tableStart + rendered.length + (afterNeedsBlank ? 1 : 0);
    }

    return { text: lines.join(document.lineEnding), changes, skipped };
  }
};
