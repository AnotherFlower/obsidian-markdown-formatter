const PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/;
const WINDOWS_INVALID_CHARACTERS = /[<>:"/\\|?*]/g;
const WINDOWS_RESERVED_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

const FULL_WIDTH_REPLACEMENTS: Record<string, string> = {
  "<": "＜",
  ">": "＞",
  ":": "：",
  "\"": "＂",
  "/": "／",
  "\\": "＼",
  "|": "｜",
  "?": "？",
  "*": "＊"
};

export interface PathMigrationPlan {
  sourcePath: string;
  targetPath: string;
  targetDirectories: string[];
}

export interface PathMigrationIssue {
  sourcePath: string;
  message: string;
}

export interface PathMigrationScan {
  plans: PathMigrationPlan[];
  skipped: PathMigrationIssue[];
}

export function scanEncodedMarkdownPaths(paths: string[]): PathMigrationScan {
  const existingPaths = new Set(paths);
  const planned: PathMigrationPlan[] = [];
  const skipped: PathMigrationIssue[] = [];

  for (const path of paths) {
    const result = planEncodedMarkdownPath(path);
    if (result.kind === "plan") planned.push(result.plan);
    else if (result.kind === "skip") skipped.push({ sourcePath: path, message: result.message });
  }

  const plans: PathMigrationPlan[] = [];
  const targetCounts = new Map<string, number>();
  for (const plan of planned) {
    targetCounts.set(plan.targetPath, (targetCounts.get(plan.targetPath) ?? 0) + 1);
  }
  for (const plan of planned) {
    if (existingPaths.has(plan.targetPath)) {
      skipped.push({ sourcePath: plan.sourcePath, message: `Target already exists: ${plan.targetPath}` });
    } else if ((targetCounts.get(plan.targetPath) ?? 0) > 1) {
      skipped.push({ sourcePath: plan.sourcePath, message: `Multiple files map to target: ${plan.targetPath}` });
    } else {
      plans.push(plan);
    }
  }
  return { plans, skipped };
}

export function planEncodedMarkdownPath(path: string):
  | { kind: "none" }
  | { kind: "plan"; plan: PathMigrationPlan }
  | { kind: "skip"; message: string } {
  const slash = path.lastIndexOf("/");
  const parent = slash >= 0 ? path.slice(0, slash) : "";
  const fileName = slash >= 0 ? path.slice(slash + 1) : path;
  if (!fileName.endsWith(".md")) return { kind: "none" };
  const stem = fileName.slice(0, -3);
  if (!stem.includes("%")) return { kind: "none" };
  if (/%(?![0-9A-Fa-f]{2})/.test(stem)) {
    return { kind: "skip", message: "The file name contains invalid URL encoding." };
  }
  if (!PERCENT_ESCAPE.test(stem)) return { kind: "none" };

  let decoded: string;
  try {
    decoded = decodeURIComponent(stem);
  } catch {
    return { kind: "skip", message: "The file name contains invalid URL encoding." };
  }
  if (hasPathTraversal(decoded)) return { kind: "skip", message: "The decoded file name is not a safe path." };

  const namespaceParts = decoded.split("::");
  if (namespaceParts.some((part) => part.length === 0)) {
    return { kind: "skip", message: "The decoded namespace contains an empty path segment." };
  }
  const safeParts = namespaceParts.map(sanitizePathComponent);
  if (safeParts.some((part) => part === undefined)) {
    return { kind: "skip", message: "The decoded file name cannot be converted to a safe path." };
  }

  const targetSegments = parent.length > 0 ? [...parent.split("/"), ...safeParts] : safeParts;
  const targetPath = `${targetSegments.join("/")}.md`;
  if (targetPath === path) return { kind: "none" };
  const targetDirectories: string[] = [];
  for (let index = 1; index < targetSegments.length; index += 1) {
    targetDirectories.push(targetSegments.slice(0, index).join("/"));
  }
  return { kind: "plan", plan: { sourcePath: path, targetPath, targetDirectories } };
}

function hasPathTraversal(value: string): boolean {
  return [...value.split(/[\\/]/), ...value.split("::")].some((segment) => segment === "." || segment === "..");
}

function sanitizePathComponent(value: string): string | undefined {
  const sanitized = value.replace(WINDOWS_INVALID_CHARACTERS, (character) => FULL_WIDTH_REPLACEMENTS[character]);
  if (sanitized.length === 0 || sanitized === "." || sanitized === "..") return undefined;
  if (/[. ]$/.test(sanitized) || WINDOWS_RESERVED_NAME.test(sanitized)) return undefined;
  return sanitized;
}
