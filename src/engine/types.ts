export type RepairCategory = "formula" | "table" | "code-fence" | "structure" | "whitespace";

export interface RepairOptions {
  enabledRuleIds?: string[];
  preserveLineEnding?: boolean;
}

export interface ProtectedRange {
  start: number;
  end: number;
  kind: "frontmatter" | "code-fence";
}

export interface ProtectedDocument {
  text: string;
  ranges: ProtectedRange[];
  lineEnding: "\n" | "\r\n";
  lines: string[];
  lineStarts: number[];
}

export interface RepairChange {
  ruleId: string;
  category: RepairCategory;
  line: number;
  description: string;
  before: string;
  after: string;
}

export interface RepairIssue {
  ruleId: string;
  category: RepairCategory;
  line: number;
  message: string;
}

export interface RepairStats {
  changedLines: number;
  changes: number;
  skipped: number;
}

export interface RuleResult {
  text: string;
  changes: RepairChange[];
  skipped: RepairIssue[];
}

export interface RepairRule {
  id: string;
  category: RepairCategory;
  apply(document: ProtectedDocument): RuleResult;
}

export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function detectLineEnding(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export function createProtectedDocument(text: string): ProtectedDocument {
  const lineEnding = detectLineEnding(text);
  const lines = splitLines(text);
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + lineEnding.length;
  }

  const ranges: ProtectedRange[] = [];
  let inFrontmatter = false;
  let frontmatterStart = -1;
  let fence: { marker: string; start: number } | undefined;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const lineStart = lineStarts[index];
    const lineEnd = lineStart + line.length + (index < lines.length - 1 ? lineEnding.length : 0);

    if (index === 0 && trimmed === "---") {
      inFrontmatter = true;
      frontmatterStart = lineStart;
      return;
    }
    if (inFrontmatter && trimmed === "---") {
      ranges.push({ start: frontmatterStart, end: lineEnd, kind: "frontmatter" });
      inFrontmatter = false;
      return;
    }
    if (fence) {
      const close = new RegExp(`^\\s*${fence.marker[0]}{${fence.marker.length},}\\s*$`).test(line);
      if (close) {
        ranges.push({ start: fence.start, end: lineEnd, kind: "code-fence" });
        fence = undefined;
      }
      return;
    }

    const opening = /^\s*(`{3,}|~{3,})(?:[^`~]*)$/.exec(line);
    if (opening) {
      fence = { marker: opening[1], start: lineStart };
    }
  });

  if (inFrontmatter && frontmatterStart >= 0) {
    ranges.push({ start: frontmatterStart, end: text.length, kind: "frontmatter" });
  }
  if (fence) {
    ranges.push({ start: fence.start, end: text.length, kind: "code-fence" });
  }

  return { text, ranges, lineEnding, lines, lineStarts };
}

export function isLineProtected(document: ProtectedDocument, lineIndex: number): boolean {
  const start = document.lineStarts[lineIndex] ?? 0;
  const end = start + (document.lines[lineIndex]?.length ?? 0);
  return document.ranges.some((range) => range.start < end + 1 && range.end > start);
}

export function isLineInRange(document: ProtectedDocument, lineIndex: number, kind: ProtectedRange["kind"]): boolean {
  const start = document.lineStarts[lineIndex] ?? 0;
  const end = start + (document.lines[lineIndex]?.length ?? 0);
  return document.ranges.some((range) => range.kind === kind && range.start < end + 1 && range.end > start);
}

export function maskInlineCode(line: string): string {
  let inCode = false;
  let result = "";
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === "`" && line[i - 1] !== "\\") {
      inCode = !inCode;
      result += " ";
    } else {
      result += inCode ? " " : line[i];
    }
  }
  return result;
}

export function rebuildLines(lines: string[], lineEnding: "\n" | "\r\n"): string {
  return lines.join(lineEnding);
}

export function changeFor(
  ruleId: string,
  category: RepairCategory,
  line: number,
  description: string,
  before: string,
  after: string
): RepairChange {
  return { ruleId, category, line, description, before, after };
}
