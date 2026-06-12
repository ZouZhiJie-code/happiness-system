# 完整日志本地带走设计（2026-06-12）

## 背景

部分用户希望在 Daily Light 之外也留存一份「整理好的日志」。产品内已有两层成稿：

- **维度日志**：五维各自 `title + content`（访谈页保存）
- **完整日志**：当天五维章节 Markdown 合集（`DailyJournalEntry`）

本轮需求聚焦 **完整日志** 的本地带走能力，不做五维单篇导出、不做批量 ZIP、不做 PDF。

## 用户本质需求

| 需求 | 产品回应 |
| --- | --- |
| 数据所有权 | 可复制、可下载，不依赖云端只读 |
| 可读 | 导出内容与用户看到的正文一致，不含访谈 transcript / 结构化槽位 |
| 可检索 | 文件名含日期；正文为 Markdown，兼容 Obsidian / 备忘录 / Typora |
| 低摩擦 | 阅读/编辑完整日志时顺手带走；日历日视图可直达 |

## 已确认决策

1. **导出对象**：仅「完整日志」（`DailyJournalEntry`），不含五维单篇。
2. **两种动作**：「复制到剪贴板」「导出 .md 文档」，共用同一份 Markdown 正文。
3. **内容来源**：**当前编辑区所见即所得**（`title` + `content` 前端 state）；有未保存改动时也按编辑区内容复制/下载，不要求先点「保存修改」。
4. **格式**：Markdown（`.md`）；v1 不做 PDF / TXT 分支选择。

## 可用条件

| 状态 | 「导出」菜单 |
| --- | --- |
| 无完整日志（`none`） | 隐藏 |
| 草稿未正式保存（`draft`） | 显示但置灰；提示「请先保存完整日志」 |
| 已保存（`saved`） | 可用 |
| 需更新（`stale`） | 可用；按编辑区内容带走，不阻断 |
| 标题或正文为空 / 超长 | 置灰（与 `canPersist` 同规则） |

**说明**：「请先保存完整日志」指至少完成过一次「保存正式日志」；之后用户编辑未 autosave 的内容仍可直接带走（决策 A）。

## 交互设计

### 主入口：完整日志工作区

位置：[`daily-journal-workspace.tsx`](../../src/components/interview/daily-journal-workspace.tsx) 底部操作区，「保存修改」左侧。

- 触发器：`ActionButton variant="secondary"` **「导出 ▾」**
- 点击展开 2 项菜单（[`ActionMenu`](../../src/components/ui/action-menu.tsx)）：
  - **复制到剪贴板** → toast「已复制到剪贴板」
  - **导出 .md 文档** → 浏览器下载 + toast「已导出到本地」
- 同排「重新生成 / 保存」亦统一为 `ActionButton` secondary / primary
- 不弹格式选择、不二次确认（只读操作）
- 菜单 Esc / 点外关闭；遵循 focus-visible

### 次入口：日历日视图

位置：[`calendar-day-view.tsx`](../../src/components/calendar/calendar-day-view.tsx) 完整日志入口旁。

- 条件：`day.dailyJournal.state === 'saved'` 或 `stale`
- 同样 **「导出 ▾」** 菜单两项；面板使用 `ActionMenu surface="calendar"`
- 按钮顺序：主链 **查看汇总日志**（primary）→ **导出 ▾**（secondary）
- 内容来自 `GET /api/daily-journal?date=`（服务端已保存版；用户不在编辑器内，无「未保存编辑」分叉）
- 月视图 / 周视图不设导出入口

### v1 不做入口

- 五维日志面板
- 设置页批量导出
- 分析页

## Markdown 模板

复制与下载使用同一 builder：

```markdown
# {title}

{date} · Daily Light

---

{content}
```

- `{content}` 原样保留现有 `## 开心` 等二级标题章节
- 不追加 front matter（v1 保持简单）
- 不在导出时重新走 AI 整理

## 文件命名

```
{date}_完整日志_{title}.md
```

示例：`2026-06-12_完整日志_日有所记.md`

- `{date}`：`entryDate`，`YYYY-MM-DD`
- `{title}`：当前标题，截断至合理长度（建议 ≤ 32 字），替换 `/ \ : * ? " < > |` 等为 `-`
- 标题为空时不应出现（与 `canPersist` 互斥）

## 技术方案

### 共享模块

新增 [`src/features/daily-journal/export.ts`](../../src/features/daily-journal/export.ts)：

| 函数 | 职责 |
| --- | --- |
| `buildDailyJournalMarkdown({ date, title, content })` | 组装 Markdown 字符串 |
| `buildDailyJournalExportFilename({ date, title })` | 安全文件名 |
| `copyDailyJournalMarkdown(...)` | `navigator.clipboard.writeText` |
| `downloadDailyJournalMarkdown(...)` | `Blob` + 临时 `<a download>` |

### UI 组件

新增 [`src/components/daily-journal/daily-journal-export-menu.tsx`](../../src/components/daily-journal/daily-journal-export-menu.tsx)：

- 基于共享原语 [`ActionMenu`](../../src/components/ui/action-menu.tsx) + `ActionButton secondary`
- props：`resolveExportPayload`, `disabled`, `disabledReason`, `surface?: 'default' | 'calendar'`
- 工作区传入 live editor state；日历通过 API 拉取已保存版

### 视觉原语（2026-06-12 优化）

| 原语 | 用途 |
| --- | --- |
| `ActionButton` | 工作区底栏生成 / 保存 / 导出触发器 |
| `ActionMenu` | 导出下拉面板；token：`--line-soft`、`--radius-control`、`--paper-main`；日历场景 `ui-action-menu-panel--calendar` |

### 后端

- **工作区**：纯前端，无需新 API
- **日历次入口**：复用现有 `GET /api/daily-journal?date=`
- v1 不新增 `POST /api/export/*`

### 埋点（可选，建议 v1 一并做）

沿用 `AnalyticsEvent`：

| eventName | properties |
| --- | --- |
| `daily_journal_export_copied` | `date`, `source: 'workspace' \| 'calendar'` |
| `daily_journal_export_downloaded` | 同上 |

## 错误处理

| 场景 | 用户可见 |
| --- | --- |
| 剪贴板 API 失败（权限 / 非 secure context） | toast「复制失败，请改用导出 .md」 |
| 下载被浏览器拦截 | toast「导出失败，请检查浏览器下载设置」 |
| 日历拉取 daily journal 失败 | inline / toast「暂时无法带走，请稍后重试」 |

## 验收标准

1. **复制（工作区）**：已保存完整日志，编辑区有未 autosave 改动 → 复制 → 粘贴内容与编辑区一致。
2. **下载（工作区）**：已保存 → 导出 → 本地 `.md` 文件名含日期，正文结构正确。
3. **草稿**：仅 draft、从未 formal save → 「导出」置灰，提示先保存。
4. **日历**：saved 日 → 不进入访谈页即可复制/下载；内容与服务器 saved 版一致。
5. **stale**：仍可带走；不弹阻塞对话框。
6. **移动端**：iOS Safari 复制成功；`.md` 下载落入系统文件/下载管理。

## 实现顺序建议

1. `export.ts` + 单元测试（markdown 模板、文件名 sanitize）
2. `DailyJournalExportMenu` + 接入 `DailyJournalWorkspace`
3. 日历日视图接入 + 轻量交互测试
4. 埋点（若本轮一并做）

## 后续扩展（非 v1）

- 设置页按日期范围批量 ZIP
- 五维单篇带走
- PDF 导出
- 导出前「先保存再带走」可选流程（当前已明确不需要）
