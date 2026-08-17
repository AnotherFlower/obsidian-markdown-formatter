# Markdown Formatter

Markdown Formatter is a conservative, local-only Obsidian plugin that repairs common formatting mistakes produced by AI assistants and copied Markdown. It always reports what it changed and skips content that cannot be repaired with high confidence.

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

### GitHub releases and BRAT

Until the plugin is listed in the official Community Plugins directory, install it with [BRAT](https://obsidian.md/plugins?id=obsidian42-brat):

1. Install and enable **BRAT** from Obsidian's Community Plugins directory.
2. Run **BRAT: Add a beta plugin for testing**.
3. Enter `AnotherFlower/obsidian-markdown-formatter` and enable **Markdown Formatter**.

BRAT downloads the plugin from this repository's GitHub releases. Install it independently on every device; do not copy or sync `.obsidian/plugins/anotherflower-markdown-formatter/` through a vault sync service.

### Official Community Plugins

The plugin will also be submitted to Obsidian's Community Plugins directory. Once approved, install it directly from **Settings > Community plugins**. Obsidian downloads release assets from GitHub, so the installation remains independent from vault content sync.

### Development

For development, clone this repository outside the vault, install dependencies, and build:

```bash
npm install
npm run build
```

The build produces `dist/main.js`, `dist/manifest.json`, `dist/styles.css`, and `dist/versions.json`. GitHub Releases publishes these files; do not commit `dist/`.

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
