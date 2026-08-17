import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { repairEngine } from "../src/engine/repair-engine";

describe("RepairEngine", () => {
  it("normalizes alternate formula delimiters without touching code", () => {
    const input = "Inline \\(x^2\\) and \\[y=mx+b\\]\n\n```tex\n\\(keep\\)\n```\n";
    const result = repairEngine.repair(input);
    expect(result.text).toContain("Inline $x^2$ and\n$$\ny=mx+b\n$$");
    expect(result.text).toContain("```tex\n\\(keep\\)\n```");
  });

  it("normalizes a multi-line display formula", () => {
    const input = "说明\n\\[\nL(x) = \\sum_{i=0}^{n} y_i \\ell_i(x)\n\\]\n";
    const result = repairEngine.repair(input);
    expect(result.text).toContain("$$\nL(x) = \\sum_{i=0}^{n} y_i \\ell_i(x)\n$$");
  });

  it("reports an unclosed multi-line display formula", () => {
    const input = "\\[\nx + y\n";
    const result = repairEngine.repair(input);
    expect(result.text).toBe(input);
    expect(result.skipped.some((issue) => issue.message.includes("multi-line display"))).toBe(true);
  });

  it("reports unmatched inline formulas instead of guessing", () => {
    const input = "An unfinished $x + 1\n";
    const result = repairEngine.repair(input);
    expect(result.text).toBe(input);
    expect(result.skipped).toHaveLength(1);
  });

  it("adds a table separator and pads short rows", () => {
    const result = repairEngine.repair("| Name | Value |\n| one |\n");
    expect(result.text).toContain("| --- | --- |");
    expect(result.text).toContain("| one |  |");
  });

  it("does not split wiki-link pipes in tables", () => {
    const result = repairEngine.repair("| Link | Note |\n| --- | --- |\n| [[A|B]] | ok |\n");
    expect(result.text).toContain("[[A|B]]");
    expect(result.text).not.toContain("[[A\\|B]]");
  });

  it("repairs a table whose rows have one consistent list prefix", () => {
    const input = "- | A | B |\n- | one | two |\n";
    const result = repairEngine.repair(input);
    expect(result.text).toBe("| A | B |\n| --- | --- |\n| one | two |\n");
  });

  it("does not treat a regular pipe expression as a table", () => {
    const input = "**类型约束** | where T : IComparable\n";
    expect(repairEngine.repair(input).text).toBe(input);
  });

  it("closes an unclosed fenced block", () => {
    const result = repairEngine.repair("```ts\nconst value = 1;\n");
    expect(result.text).toBe("```ts\nconst value = 1;\n```\n");
  });

  it("normalizes safe block prefixes and preserves hard breaks", () => {
    const result = repairEngine.repair("#Title\n-Item\n>quote\nLine  \n");
    expect(result.text).toContain("# Title\n- Item\n> quote\nLine  \n");
  });

  it("removes a redundant unordered prefix from an ordered item", () => {
    const input = "- 2. **牛顿插值法（Newton Interpolation）**:\n";
    expect(repairEngine.repair(input).text).toBe("2. **牛顿插值法（Newton Interpolation）**:\n");
  });

  it("adds blank lines around a table so Obsidian renders it as a table", () => {
    const input = "说明文字\n| A | B |\n| --- | --- |\n| one | two |\n下一段\n";
    expect(repairEngine.repair(input).text).toBe("说明文字\n\n| A | B |\n| --- | --- |\n| one | two |\n\n下一段\n");
  });

  it("does not corrupt emphasis or horizontal rules", () => {
    const input = "***Important***\n---\n**Bold**\n";
    expect(repairEngine.repair(input).text).toBe(input);
  });

  it("repairs duplicate heading markers without changing bold content", () => {
    const input = "### # 2. 泛型委托\n**类型约束** | where T : IComparable\n";
    const result = repairEngine.repair(input);
    expect(result.text).toBe("### 2. 泛型委托\n**类型约束** | where T : IComparable\n");
  });

  it("keeps valid headings and removes only excessive separator spaces", () => {
    const input = "### [[链接]]\n###   标题\n";
    expect(repairEngine.repair(input).text).toBe("### [[链接]]\n### 标题\n");
  });

  it("is idempotent", () => {
    const input = "| A | B |\n| 1 |\n";
    const once = repairEngine.repair(input).text;
    expect(repairEngine.repair(once).text).toBe(once);
  });

  it("protects frontmatter", () => {
    const input = "---\ntitle: '#Title'  \n---\n#Body\n";
    const result = repairEngine.repair(input);
    expect(result.text).toContain("title: '#Title'  ");
    expect(result.text).toContain("# Body");
  });

  it("matches the mixed AI-output fixture", () => {
    const input = readFileSync(resolve(__dirname, "fixtures/mixed-input.md"), "utf8");
    const expected = readFileSync(resolve(__dirname, "fixtures/mixed-expected.md"), "utf8");
    expect(repairEngine.repair(input).text).toBe(expected);
  });

  it("matches the interpolation formula fixture", () => {
    const input = readFileSync(resolve(__dirname, "fixtures/interpolation-formula.md"), "utf8");
    const expected = readFileSync(resolve(__dirname, "fixtures/interpolation-formula.expected.md"), "utf8");
    expect(repairEngine.repair(input).text).toBe(expected);
  });

  it("matches the symbol table fixture", () => {
    const input = readFileSync(resolve(__dirname, "fixtures/symbol-table.md"), "utf8");
    const expected = readFileSync(resolve(__dirname, "fixtures/symbol-table.expected.md"), "utf8");
    expect(repairEngine.repair(input).text).toBe(expected);
  });
});
