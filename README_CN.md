# Markdown Formatter

`Markdown Formatter` 是一个纯本地运行的 Obsidian 插件，用于修复 AI 对话、网页复制或手工编辑产生的常见 Markdown 格式问题。

插件采用保守策略：只修改能够明确判断的结构错误，无法确定时跳过并在预览中报告，不重写普通自然语言，也不会调用外部大模型。

## 功能

- 将 `\(...\)` 和 `\[...\]` 公式分隔符转换为 Obsidian 支持的 `$...$` 和 `$$...$$`。
- 修复 Markdown 表格的分隔线、列数和缺失单元格。
- 补全明确缺失的代码块结束围栏，不修改代码块内部内容。
- 规范标题、列表、引用和 Callout 的前缀空格。
- 删除意外的行尾空白，同时保留 Markdown 的两个空格换行。
- 将 URL 编码的笔记文件名转成可读路径，例如 `std%3A%3Aatomic_flag.md` 转为 `std/atomic_flag.md`。
- 支持当前选区、当前文档、当前文件夹和整个 Vault。
- 每次修改都可以预览、确认或取消。
- 保存最近的修复快照，支持恢复最近一次修复。

## 安装与跨端使用

插件不应作为 Vault 内容同步。每台设备都应从 GitHub 独立安装，笔记和附件仍按原有方式同步。

### 立即可用：使用 BRAT 从 GitHub 安装

1. 在 Obsidian 的“设置 → 第三方插件”中安装并启用 **BRAT**。
2. 打开命令面板，执行 `BRAT: Add a beta plugin for testing`。
3. 输入仓库：`AnotherFlower/obsidian-markdown-formatter`。
4. 启用 **Markdown Formatter**。

BRAT 会从本仓库的 GitHub Release 下载 `main.js`、`manifest.json`、`styles.css` 和 `versions.json`。在每台电脑或移动设备上重复上述步骤即可；不要从另一台设备复制 `.obsidian/plugins/anotherflower-markdown-formatter/`。

### 官方社区插件目录

本插件也会提交到 Obsidian 官方 Community Plugins 目录。审核通过后，可直接在“设置 → 第三方插件”中搜索 **Markdown Formatter** 安装；安装文件仍由 Obsidian 从 GitHub Release 获取。

### 同步设置

- 保持笔记、附件和需要同步的常规设置同步。
- 在 Obsidian Sync 中关闭插件或社区插件文件同步，避免不同设备互相覆盖插件版本。
- 当前设备已存在的旧手工安装目录会被移除，再通过 BRAT 重新安装为本机独立副本。

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

### 修复编码笔记路径

路径迁移是独立命令，不会在普通 Markdown 修复中自动执行：

- `Normalize encoded note paths in current folder`：扫描当前笔记所在文件夹。
- `Normalize encoded note paths in entire vault`：扫描整个 Vault。

例如 `C++/std/std%3A%3Aatomic_flag.md` 会预览为 `C++/std/std/atomic_flag.md`。解码后的 `::` 变成目录层级；`< > : " / \ | ? *` 等 Windows 不支持的字符转换为可读的全角字符。不存在的目录会在确认移动时创建。

路径预览会显示源路径、目标路径和跳过原因。目标已存在、编码错误、不安全路径或多个文件指向同一目标时会跳过，不覆盖已有文件。笔记正文不会修改；移动使用 Obsidian 文件管理接口，已识别的内部链接由 Obsidian 负责更新。

### 恢复最近一次修复

执行 `Restore the most recent repair`。只有文件内容仍等于修复后的版本时才会恢复；如果文件之后被其他操作修改，插件会跳过它，避免覆盖新内容。

路径迁移也会记录在最近一次修复历史中。恢复时会把仍位于目标位置且原路径空闲的文件移回；创建的空目录不会自动删除。

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

在“设置 → 第三方插件 → Markdown Formatter”中可以配置：

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

## 发布与开发

GitHub Release 是插件发布产物的唯一来源。Release 由 GitHub Actions 构建并附带 `main.js`、`manifest.json`、`styles.css` 和 `versions.json`；不要将 `dist/` 或 Vault 的插件目录提交、复制或同步到其他设备。

开发时请将仓库克隆到 Vault 之外，避免源码、依赖和构建缓存进入笔记同步范围。

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
