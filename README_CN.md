# Obsidian Markdown Formatter

`Obsidian Markdown Formatter` 是一个纯本地运行的 Obsidian 插件，用于修复 AI 对话、网页复制或手工编辑产生的常见 Markdown 格式问题。

插件采用保守策略：只修改能够明确判断的结构错误，无法确定时跳过并在预览中报告，不重写普通自然语言，也不会调用外部大模型。

## 功能

- 将 `\(...\)` 和 `\[...\]` 公式分隔符转换为 Obsidian 支持的 `$...$` 和 `$$...$$`。
- 修复 Markdown 表格的分隔线、列数和缺失单元格。
- 补全明确缺失的代码块结束围栏，不修改代码块内部内容。
- 规范标题、列表、引用和 Callout 的前缀空格。
- 删除意外的行尾空白，同时保留 Markdown 的两个空格换行。
- 支持当前选区、当前文档、当前文件夹和整个 Vault。
- 每次修改都可以预览、确认或取消。
- 保存最近的修复快照，支持恢复最近一次修复。

## 当前 Vault 的安装状态

本 Vault 的插件目录为：

```text
.obsidian/plugins/obsidian-markdown-formatter/
```

其中应包含：

```text
main.js
manifest.json
styles.css
versions.json
```

安装或更新文件后，请重启 Obsidian，或者在第三方插件页面点击刷新。然后在“设置 → 第三方插件”中启用 **Obsidian Markdown Formatter**。

## 使用方法

### 修复当前选区或文档

1. 打开需要修复的 Markdown 笔记。
2. 如果只想修复一部分内容，先在编辑器中选中文本；不选中文本时会处理整篇当前文档。
3. 打开命令面板（`Ctrl/Cmd + P`）。
4. 执行 `Repair current selection or document`。
5. 在预览窗口查看修改数量、差异和跳过的问题。
6. 点击 `Apply` 写回，或点击 `Cancel` 放弃。

### 扫描当前文件夹

执行 `Scan current folder for repairs`。插件会扫描当前笔记所在文件夹中的 Markdown 文件，列出包含安全修复候选的文件。选择文件后，插件会逐个显示预览，确认后才会写回。

### 扫描整个 Vault

执行 `Scan entire vault for repairs`。插件会扫描整个 Vault，先选择需要处理的文件，再逐文件确认。扫描文件数量受设置中的 `Batch file limit` 限制。

### 恢复最近一次修复

执行 `Restore the most recent repair`。只有文件内容仍等于修复后的版本时才会恢复；如果文件之后被其他操作修改，插件会跳过它，避免覆盖新内容。

## 支持的修复规则

### 公式

```markdown
输入：这是 \(x^2\)，以及 \[y = mx + b\]

输出：这是 $x^2$，以及
$$
y = mx + b
$$
```

不完整或无法配对的公式分隔符不会被猜测修复。

### 表格

```markdown
输入：
| 名称 | 值 |
| 示例 |

输出：
| 名称 | 值 |
| --- | --- |
| 示例 |  |
```

表格中的行内代码、转义竖线和 Wiki 链接会被保护，结构不明确的管道文本会跳过。

### 代码块、标题、列表和引用

插件可以补全明确缺失的代码围栏，并修复以下确定性错误：

```markdown
#标题       -> # 标题
-项目       -> - 项目
>引用       -> > 引用
```

代码块内部、Frontmatter、行内代码、HTML 和链接目标不会被规则改写。

## 设置

在“设置 → 第三方插件 → Obsidian Markdown Formatter”中可以配置：

- `Always show preview`：所有写回前都显示预览，默认开启。
- `Preserve line endings`：保留原文的 LF 或 CRLF 换行风格。
- `Batch file limit`：批量扫描的最大文件数。
- `Repair history limit`：保留的修复快照数量。
- `Enabled rules`：分别启用或禁用公式、表格、代码围栏、块前缀和尾随空白规则。

## 隐私和限制

- 插件完全在本地运行，不联网，不上传笔记内容。
- 不监听粘贴事件，不会在输入过程中自动修改内容。
- 不进行语义改写，不把普通文本猜测成公式或表格。
- 不确定的内容会跳过，并在预览窗口中列出原因。

## 手动安装和开发

从 GitHub 下载 Release 中的 `main.js`、`manifest.json`、`styles.css` 和 `versions.json`，复制到：

```text
<Vault>/.obsidian/plugins/obsidian-markdown-formatter/
```

开发命令：

```bash
npm install
npm run typecheck
npm test
npm run build
```

构建结果位于 `dist/`。

## 许可证

MIT
