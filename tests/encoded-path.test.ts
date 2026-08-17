import { describe, expect, it } from "vitest";
import { planEncodedMarkdownPath, scanEncodedMarkdownPaths } from "../src/path/encoded-path";

describe("encoded Markdown path migration", () => {
  it("turns C++ namespaces into nested folders", () => {
    const result = planEncodedMarkdownPath("C++/std/std%3A%3Aatomic_flag.md");
    expect(result).toEqual({
      kind: "plan",
      plan: {
        sourcePath: "C++/std/std%3A%3Aatomic_flag.md",
        targetPath: "C++/std/std/atomic_flag.md",
        targetDirectories: ["C++", "C++/std", "C++/std/std"]
      }
    });
  });

  it("uses readable full-width replacements for Windows-invalid leaf characters", () => {
    const result = planEncodedMarkdownPath("C++/std/std%3A%3Aatomic%3CT%2A%3E.md");
    expect(result.kind).toBe("plan");
    if (result.kind === "plan") expect(result.plan.targetPath).toBe("C++/std/std/atomic＜T＊＞.md");
  });

  it("decodes ordinary encoded symbols without inventing folders", () => {
    const result = planEncodedMarkdownPath("CSharp/C%23___type.md");
    expect(result.kind).toBe("plan");
    if (result.kind === "plan") expect(result.plan.targetPath).toBe("CSharp/C#___type.md");
  });

  it("ignores ordinary and already-safe paths", () => {
    expect(planEncodedMarkdownPath("C++/std/atomic_flag.md")).toEqual({ kind: "none" });
    expect(planEncodedMarkdownPath("C++/std/atomic%20flag.md")).toEqual({
      kind: "plan",
      plan: expect.objectContaining({ targetPath: "C++/std/atomic flag.md" })
    });
  });

  it("skips malformed encoding and traversal segments", () => {
    expect(planEncodedMarkdownPath("notes/bad%2Gname.md")).toEqual({
      kind: "skip",
      message: "The file name contains invalid URL encoding."
    });
    expect(planEncodedMarkdownPath("notes/%2E%2E%3A%3Asecret.md")).toEqual({
      kind: "skip",
      message: "The decoded file name is not a safe path."
    });
  });

  it("skips existing and duplicate targets", () => {
    const result = scanEncodedMarkdownPaths([
      "C++/std/std%3A%3Aatomic_flag.md",
      "C++/std/std%3A%3Aatomic%5Fflag.md",
      "C++/std/std/atomic_flag.md"
    ]);
    expect(result.plans).toHaveLength(0);
    expect(result.skipped.map((issue) => issue.sourcePath)).toEqual([
      "C++/std/std%3A%3Aatomic_flag.md",
      "C++/std/std%3A%3Aatomic%5Fflag.md"
    ]);
  });
});
