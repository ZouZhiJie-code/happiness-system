# Happiness-system-codex

一个把“幸福日志”理论翻译成 AI 访谈产品的 Next.js 应用。

截至 `2026-05-01`，这个仓库的真实状态是：
- 已有 `joy / fulfillment / reflection / improvement / gratitude` 五个维度的通用访谈壳子。
- `joy / fulfillment / reflection / improvement` 已完成理论对齐深化，是当前四个标品维度。
- `improvement` 已完成理论规格、数据结构扩展、AI 抽取独立化、fallback 抽取、访谈阶段推进、专属提问策略、完整 / partial 收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- `gratitude` 已有结构化数据面和草稿容器，但尚未完成理论对齐深化。
- 用户在访谈结束后点击“生成日志”，看到的是可继续编辑的日志正文，而不是结构化槽位。

## 当前产品状态

### 已完成
- 多维度访谈入口、维度切换与本地 session 恢复
- joy 维度的结构化抽取、进度判断、分叉决策、日志生成与保存
- fulfillment 维度的理论对齐、阶段推进、partial 放行、专属抽取、提问策略、日志生成、质量门与 fallback
- reflection 维度的理论对齐、阶段推进、partial 放行、专属抽取、提问策略、日志生成、质量门与 fallback
- improvement 维度的理论对齐、`snapshotData/payload` 字段扩展、专属 AI 抽取 schema、fallback 抽取、提问策略、完整 / partial 收束、日志生成、质量门、fallback draft、标题治理与自动化验收样例
- joy 日志已接入通用成稿蓝图：先组装内部 `DraftBrief + DraftWritingProfile`，再生成正文并做质检
- fulfillment 日志已接入同一成稿链路，围绕“今天为什么不算白过”和“值得感标准”生成正文
- reflection 日志已接入同一成稿链路，围绕“从片段里看见新的判断依据”生成正文
- 日志工作区：手动生成、编辑、保存；标题当前固定单行显示，最大 `16` 字
- 五个维度的日志标题统一经过语义短标题治理，不再把长事件句机械截断成标题
- 用户表达“不想继续 / 不要再追问 / 直接生成 / 总结日志 / 整理成日志”等边界或日志整理意图时，边界优先级高于槽位完整度；材料足够则 partial 收束，材料不足则给低压选择
- 访谈提交错误已经结构化；`respond/stream` 与 `respond` 会返回带 `code / title / message / resolution / retryable / action / requestId` 的错误说明，前端展示原因、解决方案和错误码
- 日志生成已支持阶段式反馈；如果当前草稿已经是最新版本，再次点击会直接复用，不再重复等待
- 访谈页开发辅助：可清除“当前维度”的本地对话恢复记录并直接重开一轮
- `snapshotData` / `payload` 驱动的多维度结构化数据面
- joy 理论对齐基线文档：`docs/theory/joy-alignment.md`
- fulfillment 理论对齐基线文档：`docs/theory/fulfillment-alignment.md`
- reflection 理论对齐基线文档：`docs/theory/reflection-alignment.md`
- improvement 理论对齐开发规格：`docs/theory/improvement-alignment.md`

### 尚未完成
- `improvement` 的端到端产品验收与文风继续打磨
- `gratitude` 的理论对齐与专属访谈策略
- 真实语音转写模型接入
- 跨天长期记忆与稳定规律汇总
- joy / fulfillment / reflection 日志正文的最终产品级文风打磨

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local`，至少保证这些字段存在：

```bash
DATABASE_URL="postgresql://zouzhijie@localhost:5432/happiness_system_codex?schema=public"
AI_PROVIDER="volcengine-ark"
VOLCENGINE_ARK_API_KEY=""
VOLCENGINE_ARK_ENDPOINT_ID=""
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
APP_URL="http://localhost:3000"
```

### 3. 同步数据库 schema

首次启动或拉到最新代码后，先执行：

```bash
npx prisma db push
```

如果你看到类似 `InterviewEvent.snapshotData does not exist` 的报错，基本也是这一步没做。

### 4. 启动开发服务器

```bash
npm run dev
```

默认地址：
- `http://localhost:3000`

### 5. 回归检查

```bash
npx tsc --noEmit
npm test
```

## 常用命令

```bash
npm run dev
npm test
npx tsc --noEmit
npx prisma db push
```

## 文档导航

- 项目级 agent 说明：`AGENTS.md`
- 当前架构：`docs/architecture.md`
- 当前 API 面：`docs/integration-guide.md`
- 本地排障与运行手册：`docs/operator-runbook.md`
- 当前阶段 handoff：`docs/handoff.md`
- joy 理论对齐：`docs/theory/joy-alignment.md`
- fulfillment 理论对齐：`docs/theory/fulfillment-alignment.md`
- reflection 理论对齐：`docs/theory/reflection-alignment.md`
- improvement 理论对齐开发规格：`docs/theory/improvement-alignment.md`
- 维度正文生成模板：`docs/theory/dimension-draft-template.md`
- 理论原文：`docs/theory/精简-如何实现幸福.pdf`
- 历史设计稿：`Tech_Design.md`

## 关键实现现实

- `src/server/services/interview/interview.service.ts` 目前主要是对 `joy-interview.service.ts` 的导出壳子。
- `fulfillment`、`reflection` 与 `improvement` 已在 joy-first 服务壳子内完成理论对齐；`gratitude` 仍未完成理论对齐。
- `/api/transcribe` 当前只是占位接口，返回模拟 transcript。
- `/api/journal-entry/[id]` 是当前日志编辑主路由，`/api/joy-entry/[id]` 只是兼容别名。

## 已知限制

- joy 现在已支持双收尾：
  - `meaning_track` 收束到“个人规律 / 使用说明书线索”
  - `delight_track` 收束到“轻快乐线索”
- fulfillment 现在以 `experience / progressEvidence / valueSignal` 为核心槽位，完整模式收束“值得感标准”，部分模式只停在“今天为什么不算白过”。
- reflection 现在以 `trigger / insight / viewpointShift` 为核心槽位，完整模式收束“判断线索”，部分模式只停在“这次片段带来的当前理解”。
- improvement 现在的内部数据结构已扩展为 `situation / improvementTrack / stateAssessment / frictionPoint / repeatCondition / controllableFactor / nextAttempt / successSignal / improvementType / feeling / tags`，AI 抽取和 fallback 抽取都会区分 `repeat_good` 与 `avoid_bad`；如果用户只分清了改进轨道但还没有说清条件或卡点，AI 抽取会先保留 `improvementTrack`，把 `repeatCondition / frictionPoint` 留给下一轮追问，不把中间态误判成可完成材料；访谈提问已按“具体情境 -> 改进轨道 -> 关键条件/卡点 -> 可控小调整 -> 下次最小动作/成功信号”推进，并避免建议、计划和自责归因口吻；日志成稿已接入正文生成、质量门、fallback draft 和标题治理，标题候选会优先收束为 `表达慢下来 / 先听完再回应 / 把节奏放稳 / 提前留出缓冲 / 把边界说清楚 / 让准备更充分` 这类语义短标题。
- 如果用户明确拒绝继续提炼，或用“总结日志 / 整理成日志 / 帮我总结”等自然语言要求收束，joy / fulfillment / reflection / improvement 都允许在核心材料成立时先生成当前版本日志。
- 如果用户拒绝继续但材料不足，系统会停止追问细节，提供“只补一句 / 换一个片段 / 先退出”。
- 如果访谈提交失败，前端会展示结构化错误原因、处理建议、错误码和 requestId；例如 `MESSAGE_TOO_LONG` 会提示拆成两段发送，服务不可用会提示确认服务运行后刷新。
- joy / fulfillment / reflection / improvement 的最终正文文风还要继续打磨。
- 已有草稿后，新的访谈内容不会自动触发日志整理；用户手动点击“生成日志”后才会刷新。
- 如果用户在日志整理过程中直接关闭日志面板，当前这次整理会被取消；这也是当前有意设计。
- 结构化线索仍然存在于系统内部，用来驱动进度、收尾和日志生成，但不会直接展示给用户。
- `thinkingSummary` 是用户可见的浅色思路层，用来呈现 AI 对用户回复的理解和处理焦点；它不能写成第二个正式追问。
