# 访谈 UX 改造 · 完整交接文档（给接手模型）

最后更新：`2026-06-12`  
状态：**产品验收未通过**；主功能 commit 已落地（`60db348`），Debug 轮修补**未 commit**。  
**配套计划原文**：[`docs/plans/2026-06-12-ux-flow-redesign-plan.md`](../plans/2026-06-12-ux-flow-redesign-plan.md)

---

## 0. 三十秒读懂

| 维度 | 事实 |
|------|------|
| **用户** | 产品经理，非技术；默认中文沟通 |
| **目标** | 按 v3 原型重构「访谈 → 单维日志 → 完整日志」 |
| **设计真相源** | `docs/plans/ux-flow-prototype-v3.html`（浏览器打开对照） |
| **已 commit** | `60db348` — UX 大改 + save-all + reopen + 浏览器脚本 |
| **未 commit** | `interview-shell.tsx`、`joy-interview.service.ts`、`globals.css`、`interview-shell.test.tsx`（Debug 修补） |
| **验收** | 用户**多次**不通过；自动化测试绿 ≠ 验收过 |
| **最大缺口** | **RD-1 今日书脊**整轮未做；RD-3 等已写代码但**产品未认可** |

---

## 0.1 RD / PERF 全景状态表（2026-06-12 终态）

图例：**代码** = 仓库里有没有实现；**产品** = 用户肉眼验收；**测试** = 相关自动化。

| ID | 计划内容 | 代码 | 产品验收 | 测试 | 关键文件 / 备注 |
|----|----------|------|----------|------|-----------------|
| **RD-1** | 今日书脊：印章脊线 `悦实思改谢→完整`，取代 header tab+进度环+生成/完整；共享词表；日历联动；**~60 测试** | ❌ 未做 | — | — | `interview-header-toolbar.tsx` 仍是旧 header；**单列专注一轮**；PERF-4/5 并入此轮 |
| **RD-2** | 思考=轻旁注 / 问题=暖卡分层 | ✅ `60db348` | ⚠️ 流式体感仍被投诉 | ✅ 有单测 | `MessageBubble` variant thinking/question |
| **RD-3** | 常驻书签 + 右侧书页浮层，对话全高 | ⚠️ 有但未 commit 修补 | ❌ 未通过 | ✅ 有单测 | 用户：书签不立体、日志像全屏、非右栏书页；见 §6.1 |
| **RD-4** | 保存三态 + 暂存时间戳 + 关闭 toast | ✅ `60db348` | 未单独反馈 | ✅ | `panelStatusText` |
| **RD-5** | `ConfirmDialog` 替换 `window.confirm` | ✅ `60db348` | 未单独反馈 | ✅ | `confirm-dialog.tsx`；撤销 Toast 未全做 |
| **RD-6** | 流式中发送键变「停止」 | ✅ `60db348` | ❌ 「AI 没流式」 | ✅ | 停止有；**访谈 respond/stream 流式**仍有问题，见 §6.1 |
| **RD-7** | 保存后继续聊 / reopen / 日志可更新 | ⚠️ 部分 | ⚠️ 部分 | ✅ reopen 步 | 「继续聊这件事」✅；「再记一件/下一维度」❌；`completed` reopen 已修 |
| **RD-8** | 收成今天 Level A：save-all 后端 + 主 CTA | ✅ `60db348` | ⚠️ flaky | ✅ save-all API 测 | `POST /api/daily-journal/save-all`；浏览器脚本曾 30s 等不到按钮 |
| **RD-9** | 术语统一「完整日志」 | ✅ `60db348` | 未单独反馈 | ✅ | |
| **RD-10** | 杂项打磨（见下表） | ⚠️ 部分 | 未单独验收 | 部分 | |
| **PERF-1** | 单维 draft 生成 SSE 流式 | ❌ | — | — | 与**用户进度条**未提交改动冲突，暂缓 |
| **PERF-2** | 完整日志：骨架秒出 + 流式润色 | ❌ | — | — | 同上 |
| **PERF-3** | 收成并行 + 分步进度 + 部分失败可恢复 | ⚠️ 部分 | — | ✅ | 并行 promote ✅；分步真实进度 ❌ |
| **PERF-4** | header N+1 → 单次 day 快照 | ❌ | — | 测试**断言 N+1** | 归入 RD-1；`loadCachedDimensionSessions` 仍在 |
| **PERF-5** | calendar/day 短缓存 SWR | ❌ | — | — | 归入 RD-1 |
| **PERF-6** | 首屏骨架 | ✅ `60db348` | 未单独反馈 | — | `src/app/interview/loading.tsx` |

### RD-10 子项拆分

| 子项 | 代码 | 产品 |
|------|------|------|
| stale 文案口语化 +「需更新」 | ✅ | — |
| 导出禁用理由常驻「保存后可导出」 | ✅ | — |
| 生成失败结构化（`draftGenerateIssue` + 重试） | ✅ | — |
| 重复「当前记录日期」去冗余 | ❌ | 访谈区仍多处显示 |
| 工作区 transition 减负 | ❓ 未核对 | — |

---

## 0.2 时间线（便于接手模型还原上下文）

| 时间 | 事件 |
|------|------|
| 对话早期 | 用户要 UX 全流程审查 → 列问题 → 按 v3 落地改造 |
| Plan 固化 | `ux链路全量改造_cb4cd462.plan.md`（Cursor plans，已归档到 `docs/plans/2026-06-12-ux-flow-redesign-plan.md`） |
| 第一轮实现 | RD-5/2/9/6/4 等 → 并入大 diff |
| `60db348` | commit：UX 大改 + save-all + reopen + `browser-full-flow.mjs` |
| 用户二次反馈 | 4 项：书签 / 流式 / 全屏 / 聊天消失 |
| 用户指定批次 | 「先做 RD-3、RD-7、RD-8、RD-10、PERF-1~6」 |
| 第二轮实现 | RD-3/7/8/10 + PERF-3/6；PERF-1/2 暂缓；PERF-4/5 归 RD-1 |
| 子 agent | 声称修 4 bug + 909 测试绿，**未 commit**，用户仍不认可 |
| Debug `ff7040` | 运行时埋点 → 局部修补 → 自测 browser 9/9 → 用户「修不好，换模型」 |
| 本文档 | 完整 RD/PERF 状态入库 |

---

## 0.3 给接手模型的开场白（复制到下一轮对话）

```text
你是接手 Happiness-system-codex 访谈 UX 改造的工程师。请先读这三份文档（按顺序）：

1. docs/handoff/2026-06-12-interview-ux-acceptance-handoff.md（本文件，全文）
2. docs/plans/2026-06-12-ux-flow-redesign-plan.md（RD-1~10 + PERF-1~6 计划原文）
3. 浏览器打开 docs/plans/ux-flow-prototype-v3.html，作为视觉验收真相源

硬性事实：
- 主 commit 60db348 已落地，但产品经理多次浏览器验收不通过。
- 工作区还有未 commit 改动：interview-shell.tsx、joy-interview.service.ts、globals.css、interview-shell.test.tsx（Debug 轮修补，用户未认可，需你评估保留/重写）。
- RD-1 今日书脊整轮未做（含 PERF-4/5、~60 测试）；不要假装已完成。
- 单元测试全绿 ≠ 验收过；必须对照 v3 原型 + 多维度切换录屏。

用户曾明确投诉的 4 项（必须逐项修到肉眼过关）：
1. 书签不够立体醒目
2. AI 回答没有流式输出（思考摘要长时间空窗后一次性出现也算失败）
3. 单维日志像全屏，不是右侧书页（桌面对话仍可见）
4. 对话时聊天记录消失（尤其切换五维时）

建议第一步：
- git diff 看未 commit 改动是否值得保留
- 1366px 与 390px 各截图对比 v3 与 /interview
- 跑两次：ACCEPTANCE_BASE_URL=http://127.0.0.1:3000 node scripts/browser-full-flow.mjs
- 手动：joy→fulfillment→joy 快速切换 5 次，看聊天是否闪空

不要：未用户明确要求就 git commit/push；不要用 setTimeout 假流式；不要删 choice 卡逻辑来「修」消息数。

根 AGENTS.md 是项目事实源；进度条由用户单独处理，不要改 journal-generation-progress 除非用户要求。
```

---

## 0.4 原「给接手模型第一句话」（保留）

用户（产品经理，非技术背景）要求按 **v3 HTML 原型** 改造「访谈 → 单维日志 → 完整日志」全链路。第一轮大改已 commit（`60db348`），但**真实浏览器验收多次不通过**。后续 Debug 模式做了运行时埋点、局部修补和自测，用户明确表示「当前模型修不好」，需要换更强模型。

**不要假设**：单元测试全绿 = 产品验收通过；子 agent 曾报告 909/909 绿，用户仍验收失败。

---

## 1. 背景与动机

### 1.1 产品问题（改造前）

用户走完一条记录链路的摩擦点（详见 `docs/plans/ux-flow-before-after-preview.md`）：

- 顶部工具栏窄屏横滑才看到「生成日志」
- 系统 `window.confirm` 与产品暖色视觉脱节
- 单维日志保存/暂存状态不透明
- 窄屏日志与对话挤在同一 grid，边聊边改体验差
- 「完整日志」术语混用；收成今天需 4 步手动操作
- 对话区：流式中无法停止、思考/问题气泡层次乱、维度切换时聊天闪空

### 1.2 设计参照物（验收真相源）

| 资产 | 路径 | 用途 |
|------|------|------|
| 改动前后说明 | `docs/plans/ux-flow-before-after-preview.md` | 8 项 WS 对照表 |
| 交互原型 v3 | `docs/plans/ux-flow-prototype-v3.html` | **视觉与交互主参照**（书脊、书签、右栏书页、对话分层） |
| 骨架流光预览 | `docs/plans/journal-skeleton-loader-preview.html` | 日志生成 loading |
| 单层卡片规范 | `docs/design/ui-conventions.md` | 新 UI 必须遵守 |

### 1.3 范围边界（用户明确说过）

- **进度条**：用户自行处理，改造方案里刻意未纳入部分进度条争论
- **RD-1 今日书脊**：计划中单列一轮，本轮**暂缓**，不要当成已完成
- **不要**为通过测试而削弱产品验收标准

---

## 2. 目标与实现标准（Definition of Done）

### 2.1 用户可感知的主线（必须全部成立）

1. 进入某维度访谈 → AI 结构化追问 → 用户点「生成日志」
2. 日志在**右侧书页**滑出（桌面：对话仍可见；窄屏：底部抽屉 + 遮罩可关）
3. 思考层（`thinkingSummary`）**逐字/逐块流式**出现；正式问题随后流式出现
4. 对话历史在以下场景**不闪空、不整段消失**：
   - 正在流式回复
   - 切换五维胶囊
   - URL `dimension` 与 store `sessionDimension` 短暂不同步
   - 打开/关闭日志面板
5. 关闭面板后**立体书签**常驻右缘，可再打开日志
6. 保存单维日志 → 可继续聊（reopen）→ 顶部「完整日志」→ **收成并保存完整日志** 一键可用
7. 全站用户可见文案统一「完整日志」（非「总日志」「汇总日志」）

### 2.2 技术验收（必要条件，非充分条件）

```bash
npm test -- tests/unit/interview-shell.test.tsx tests/unit/daily-journal-workspace.test.tsx
npx tsc --noEmit
ACCEPTANCE_BASE_URL=http://127.0.0.1:3000 node scripts/browser-full-flow.mjs
# 有界面观察时用：
BROWSER_FLOW_HEADED=1 ACCEPTANCE_BASE_URL=http://127.0.0.1:3000 node scripts/browser-full-flow.mjs
```

`scripts/browser-full-flow.mjs` 覆盖：登录 → 两轮访谈 → 生成日志 → 书签 → 保存 → reopen → 完整日志 → 收成。

### 2.3 用户二次反馈的 4 个具体问题（2026-06-12 验收卡点）

| # | 用户描述 | 预期（对照 v3） |
|---|----------|-----------------|
| 1 | 书签不够立体醒目 | 右缘琥珀色书签 + badge，hover 略伸出；见 `globals.css` `.journal-bookmark` 与 v3 书签区 |
| 2 | AI 回答没有流式输出 | 思考摘要与问题均应可见增量；不是长时间「正在思考」后一次性弹出 |
| 3 | 单维日志变全屏，不是 HTML 右侧书页 | 桌面为**右侧 sheet**，聊天区让出宽度；不是整页 takeover |
| 4 | 对话时聊天记录消失 | 切换维度、hydrate 间隙、panel 开关时历史消息仍可见 |

第三轮用户只说「好多 bug」「验收不通过」，未逐条细化，但上述 4 项 + 维度切换闪空在 Debug 日志里仍有证据。

---

## 3. 已落地代码（Git 事实）

### 3.1 已 commit：`60db348`

摘要：访谈日志 UX 大改 + save-all + reopen 修复 + 浏览器验收脚本。

**关键变更：**

- `interview-shell.tsx`：MessageBubble 分层、书签/侧栏、保存三态、停止按钮、结束后继续、`ConfirmDialog`
- `daily-journal-workspace.tsx` + `POST /api/daily-journal/save-all`：收成今天 Level A
- `confirm-dialog.tsx`、`journal-skeleton-lines.tsx`、`journal-generation-copy/progress.ts`
- 删除 Lottie / `journal-growth-tree`，改骨架流光
- `joy-interview.service.ts`：`completed` 状态可 reopen（修复保存后「继续聊」409）
- 测试：`interview-shell.test.tsx` +7、`daily-journal-workspace.test.tsx` +2
- `scripts/browser-full-flow.mjs`：Playwright 全流程

### 3.2 未 commit（当前工作区，Debug 轮 + 子 agent 残留）

```text
 M src/app/globals.css                              # .journal-bookmark / .journal-panel-sheet
 M src/components/interview/interview-shell.tsx      # 见 §4
 M src/server/services/interview/joy-interview.service.ts  # summary 流式 emit
 M tests/unit/interview-shell.test.tsx               # 右侧面板、流式等 +115 行
?? docs/plans/ux-flow-*.html / journal-skeleton-loader-preview.html  # 设计预览，未入库
```

**接手后第一件事建议**：`git diff` 通读上述 4 个已修改文件，再决定是 amend 到 `60db348` 之后的新 commit 还是 revert 重来。

---

## 4. Debug 轮尝试过的修补（未获用户认可）

### 4.1 运行时埋点结论（session `ff7040`，日志已移除）

| 假设 | 结论 | 日志证据 |
|------|------|----------|
| H1 后端不 emit summary delta | **确认**：改造前 summary 仅 2–3 个大块；改造后普通轮次有 20+ 个 `textLen:1~3` 的小 delta | `handleChunk-delta` |
| H2 commitStreamedSession 清空流式 | 部分成立（闭包读 stale），非主因 | `commitStreamedSession` |
| H3 维度切换聊天消失 | **确认**：`reset()` 后 `messagesCount:0` 且 `pager` 仍停旧维度 | `visible-state` L119–120 |
| H4 `visibleMessages` 过滤 | 次要；choice 卡隐藏导致 `visibleCount < messagesCount` 属预期 | L113, L259 |
| H5 面板挡满聊天 | **确认**：`panelOpen` 时曾无右侧留白 | 布局 + `md:pr-[min(82%,30rem)]` |

### 4.2 已写进工作区、但未 commit 的修补

**`joy-interview.service.ts`（约 3328–3335 行）**

- 原逻辑：`delta.target === "summary"` 时 `return`，等 question delta 才 `emitSummaryOnce`
- 现逻辑：`summaryStreamStarted` 后对 summary 走 `emitRawDelta`
- **仍不完整**：
  - `shouldBufferContinuationOutput`（`continue_current_event` / `fulfillment`）仍会整段缓冲
  - `prepared.assistantMessage` 快捷路径（约 3250–3261）仍用 `emitText` 分块，块可能很大
  - 自动生成日志触发的轮次（日志里 `activeStreamId:3` 仅 3 个 summary delta）行为与正常轮次不一致

**`interview-shell.tsx`**

- `canShowPersistedMessages`：hydrate 间隙仍显示已有消息
- `showEmptyChatState`：仅在 `bootState===idle` 且无 `pendingUrlDimension` 时显示空态
- 维度切换无 cache 时：先 `setBootState(booting/restoring)` 再 `reset()`
- `pagerActiveDimension`：优先 `pendingUrlDimension`，避免 reset 后仍渲染已清空的旧维度页
- `showBootBubble`：`pendingUrlDimension !== null` 时也显示 boot 气泡
- 桌面 `panelOpen` 时主区 `md:pr-[min(82%,30rem)]`
- 流式：`flushSync` + `commitStreamedSession` / `scheduleClearStreamPresentation`（子 agent 引入）

**`globals.css`**

- `.journal-bookmark` 渐变 + `clip-path` + `journal-bookmark__badge`
- `.journal-panel-sheet` 左侧书脊线 + 阴影

### 4.3 自测 vs 用户验收的差距

- 自测：`interview-shell.test.tsx` 77/77；`browser-full-flow.mjs` 曾 9/9（收成按钮首轮失败、次轮成功，** flaky**）
- 用户：仍验收不通过——说明自动化用例**未覆盖**其真实操作路径（多维度来回切、bookmark 视觉、流式体感的 15s 思考空窗等）

---

## 5. 关键代码地图（接手后优先读）

### 5.1 前端主壳

| 文件 | 职责 |
|------|------|
| `src/components/interview/interview-shell.tsx` | 访谈主区、HorizontalPager、流式 SSE、日志 panel/bookmark、维度切换、工作区模式 |
| `src/components/shared/site-header/interview-header-toolbar.tsx` | 生成日志 / 完整日志 / 当天评分 |
| `src/components/interview/daily-journal-workspace.tsx` | 完整日志编辑、收成 CTA、`harvestableCount` |
| `src/components/interview/journal-generation-overlay.tsx` | 生成阶段 overlay |
| `src/app/globals.css` | `.journal-bookmark`、`.journal-panel-sheet` |

**访谈壳状态机要点：**

- `pagerActiveDimension`：当前 pager 显示哪一维（与 URL / pending 切换强相关）
- `isSessionHydratedForCurrentDimension`：`sessionDimension === displayDimension` 或 pending 特殊分支
- 维度切换 effect（约 1566 行）：`saveLeavingDimensionToCache` → `reset` / `hydrate(cache)` → `ensureSession`
- 日志 panel：`absolute right-0` + `journal-panel-sheet`；窄屏 scrim `md:hidden`

### 5.2 流式链路

```
POST /api/interview/session/respond/stream
  → joy-interview.service.ts streamJoyInterviewResponse
  → interview-shell handleChunk (phase / delta / session)
  → flushSync 更新 streamedAssistantSummary / streamedAssistantQuestion
  → session 事件 → commitStreamedSession → hydrate
```

### 5.3 完整日志收成

```
POST /api/daily-journal/save-all  (src/app/api/daily-journal/save-all/route.ts)
  → saveAllAndGenerateDailyJournal (daily-journal.service.ts)
  → 并行 promote draft 维度日志 → generate → save
```

前端按钮禁用条件：`harvestableCount === 0`（`availableSourceCount + draftSourceCount`）。

### 5.4 测试锚点

- `tests/unit/interview-shell.test.tsx`：流式增量、右侧面板、书签、auto-generate draft
- `tests/unit/daily-journal-workspace.test.tsx`：收成按钮
- `tests/unit/journal-generation-*.test.tsx`：进度/文案

---

## 6. 已知未解决问题（接手模型应优先验证）

### 6.1 高优先级（用户直接投诉）

1. **流式体感仍差**
   - 模型推理前长时间只有「正在思考中…」（日志里 thinking→summary 间隔可达 **15s**）
   - `fulfillment` / `continue_current_event` 仍 `shouldBufferContinuationOutput`
   - event_complete 后 auto-generate 轮次 summary 仍可能 3 大块到达（见日志 `activeStreamId:3`）

2. **维度切换闪空 / 聊天消失**
   - 日志 L123：`fulfillment` 首进仍有一帧 `showEmptyState:true`（boot 态晚于 render）
   - 切换时 `messagesCount` 归零窗口仍存在，仅靠 boot 气泡掩盖，**未**做到「旧消息常驻到新区 hydrate」

3. **右侧书页 vs 全屏**
   - 已加 `md:pr-[...]`，但 panel 仍是 `absolute` 覆盖；小屏 `w-[min(82%,30rem)]` 在部分宽度仍像「大半屏」
   - 需与 v3 像素级对比（`ux-flow-prototype-v3.html` 右栏比例、书脊线、圆角）

4. **书签立体感**
   - 已有 CSS，用户仍说不够——需对照 v3 的 hover 伸出、阴影深度、badge 位置

### 6.2 中优先级

5. **收成按钮 flaky**：浏览器 脚本曾 30s 等不到 enabled；与 `isLoading` / `harvestableCount` / 日期口径有关
6. **reopen 后完整日志日期**：`dailyJournalDate = sessionEntryDate ?? requestedEntryDate ?? today`；跨时区/历史 `entryDate` deep link 需人工验
7. **RD-1 今日书脊**：header 五维进度视觉未做，用户长期会要

### 6.3 低优先级 / 技术债

- `interview.service.ts` 仍是 joy-first 导出壳
- 全量 `npm test` 基线有历史红项（memory 测试类型、calendar 旧断言）；见根 `AGENTS.md` §8
- Debug 埋点已移除；若再调试需重新加 instrumentation

---

## 7. 建议的修复策略（给更强模型）

### 7.1 不要做的事

- 不要只靠加 `setTimeout` 假装流式
- 不要扩大 `isSessionHydrated` 语义到「显示错维度消息」
- 不要删掉 choice 卡 / transcript 过滤逻辑来「修」可见条数
- 不要未验收就 commit 或 push（用户规则：commit 需显式要求）

### 7.2 推荐做法

1. **用 v3 HTML 做视觉 diff**：同一视口宽度截图对比（1366、390）
2. **流式**：统一所有 `streamJoyInterviewResponse` 出口；思考阶段尽早 `emitPhase('summary')`；评估 `shouldBufferContinuationOutput` 是否应对用户可见层关闭
3. **聊天不消失**：维度切换时「先 hydrate 目标 cache / 保留 leaving cache 渲染，再 background ensureSession」，避免全局 `reset` 清空正在看的 pager
4. **布局**：桌面考虑 `grid-cols-[1fr_min(30rem,40%)]` 真双栏，而非 absolute + padding-right
5. **验收脚本扩展**：Playwright 增加「切换 joy→fulfillment→joy」「流式期间断言 DOM 文本长度递增」

---

## 8. 环境与命令

```bash
npm run dev                    # 默认 http://localhost:3000
npm test
npx tsc --noEmit
npx prisma db push             # schema 不同步时
```

访谈常见问题见根目录 `AGENTS.md` §7。

---

## 9. 相关对话与 agent

- **完整对话 transcript**（含工具调用上下文）：  
  `~/.cursor/projects/Users-zouzhijie-Desktop-Happiness-system-codex/agent-transcripts/ff7040fe-0a34-4d95-9bad-dc33454ce5a3/ff7040fe-0a34-4d95-9bad-dc33454ce5a3.jsonl`  
  接手模型可 `grep` 关键词：`验收`、`流式`、`书签`、`save-all`、`RD-1`、`browser-full-flow`
- Debug session：`ff7040`（运行时埋点已移除；日志路径曾为 `.cursor/debug-ff7040.log`）
- 子 agent「Fix interview UX 4 bugs」曾声称 4 项全修 + 909 测试绿，**用户不认可**
- 已提交 commit message：`Ship interview journal UX redesign with harvest flow and browser acceptance.`
- **Cursor Plan 原路径**（若本机仍存在）：`~/.cursor/plans/ux链路全量改造_cb4cd462.plan.md`；仓库归档副本见 `docs/plans/2026-06-12-ux-flow-redesign-plan.md`

### 9.1 未入库文件提醒（接手前确认）

以下文件当前为 **git untracked**，换机器或新 clone 会丢失，除非用户 commit：

- `docs/handoff/2026-06-12-interview-ux-acceptance-handoff.md`（**本文**）
- `docs/plans/2026-06-12-ux-flow-redesign-plan.md`
- `docs/plans/ux-flow-prototype-v3.html` 等 7 个设计预览 HTML

---

## 10. 接手检查清单（复制即用）

- [ ] 读 `git diff` 四个已改文件，理解 Debug 轮修补
- [ ] 浏览器打开 `docs/plans/ux-flow-prototype-v3.html` 与本地 `/interview` 并排对比
- [ ] 复现用户 4 项：书签 / 流式 / 右栏书页 / 聊天不消失
- [ ] 跑 `browser-full-flow.mjs` 至少 2 次，确认收成不 flaky
- [ ] 多维度快速切换 5 次，录屏看是否闪空
- [ ] 流式时观察 Network SSE 与屏幕增量是否同步
- [ ] 测试绿 + 用户肉眼验收双过，再请用户 commit

---

## 11. 文档维护

产品交互变更后同步：`README.md`、`docs/architecture.md`、`docs/integration-guide.md`、根 `AGENTS.md` §3.3。  
本文件为 **2026-06-12 验收失败专用交接**；合并成功后可将结论摘要写回 `docs/handoff.md` 并归档或删除本节细节。
