# Obsidian Markdown Formatter

Obsidian Markdown Formatter is a conservative, local-only plugin that repairs common formatting mistakes produced by AI assistants and copied Markdown. It always reports what it changed and skips content that cannot be repaired with high confidence.

## Features

- Normalize `\\(...\\)` and `\\[...\\]` LaTeX delimiters to Obsidian-compatible math.
- Repair Markdown table separators, column counts, and escaped table content.
- Close clearly unclosed fenced code blocks without changing their contents.
- Normalize heading, list, blockquote, and Callout prefixes.
- Remove accidental trailing whitespace while preserving Markdown hard breaks.
- Preview every document change before writing it.
- Scan the current document, current folder, or entire vault.
- Restore the most recent repair snapshot.

The plugin has no network access and does not send note content to an external service.

## Installation

See [README_CN.md](README_CN.md) for Chinese usage and installation instructions.

For development, clone this repository, install dependencies, and build:

```bash
npm install
npm run build
```

Copy the files from `dist/` into `.obsidian/plugins/obsidian-markdown-formatter/`, then enable **Obsidian Markdown Formatter** in Obsidian's Community Plugins settings. A release contains `main.js`, `manifest.json`, `styles.css`, and `versions.json`.

## Usage

Use the command palette:

- **Repair current selection or document**: repair the selected text, or the entire active note when there is no selection.
- **Scan current folder for repairs**: scan Markdown files in the active note's folder, select files, then review each change.
- **Scan entire vault for repairs**: scan all Markdown files, select files, then review each change.
- **Restore the most recent repair**: restore only files that have not changed since the repair.

The settings tab controls individual rules, preview behavior, batch limits, history retention, and line-ending preservation.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

The repair engine is independent of Obsidian and is covered by deterministic fixture-style tests. The plugin deliberately does not infer tables or rewrite ordinary prose. Ambiguous formulas, pipe text, and protected code/frontmatter are reported or left unchanged.

## License

MIT
