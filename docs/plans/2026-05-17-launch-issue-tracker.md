# 上线前问题池

> **For Codex / Worktree / Subagent:** 所有手动验收发现项必须写入本文件，并关联 [上线前手动验收矩阵](./2026-05-17-launch-acceptance-matrix.md) 的用例 ID。

关联文档：
- [上线前推进总计划](./2026-05-17-launch-plan.md)
- [上线前手动验收矩阵](./2026-05-17-launch-acceptance-matrix.md)

## 字段规范

每个问题固定记录：
- `问题 ID`
- `关联用例 ID`
- `模块`
- `标题`
- `问题类型`
- `优先级`
- `复现步骤`
- `预期`
- `实际`
- `修复状态`
- `责任归属`
- `回归结论`

### 问题类型

- `Bug`
- `缺失功能`
- `体验缺口`
- `数据风险`
- `上线阻断`

### 修复状态

- `new`
- `triaged`
- `in_progress`
- `fixed_pending_regression`
- `regression_passed`
- `accepted_known_limit`

## 问题池模板

| 问题 ID | 关联用例 ID | 模块 | 标题 | 问题类型 | 优先级 | 复现步骤 | 预期 | 实际 | 修复状态 | 责任归属 | 回归结论 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `ISSUE-001` | `A-01` | 账户与数据安全 | 示例：注册页未勾选协议时仍可提交 | `Bug` | `P0` | 打开 `/register`，填写信息但不勾协议后点击提交 | 提交按钮不可用或请求被拒绝 | 已回归确认当前实现符合预期：页面按钮在未勾选协议时保持禁用，接口层也会拒绝未接受协议的注册请求 | `regression_passed` | `Codex` | `回归时间：2026-05-18 10:56\n回归人：Codex\n回归结果：通过\n备注：127.0.0.1:3001 上真实直调 POST /api/auth/register 且 acceptedTerms=false、acceptedPrivacy=false 返回 400 INVALID_REGISTER_REQUEST；/legal/terms 与 /legal/privacy 均返回 200。补充自动化回归：tests/unit/auth.schema.test.ts、tests/unit/auth.api.test.ts、tests/unit/auth-ui.test.tsx 共 18 项全部通过。该条更像问题池状态未同步，当前无需额外代码修复。` |
| `ISSUE-002` | `B-01` | 核心记录主链路 | `POST /api/interview/session/start` 在 Neon pooler 环境下稳定 500 | `上线阻断` | `P0` | 已登录后对任一维度调用 `POST /api/interview/session/start`，例如 `{\"dimension\":\"joy\",\"entryDate\":\"2026-05-18\"}` | 五维会话都应成功创建并返回 opening question + session | 实际稳定返回 `500 INTERVIEW_START_FAILED`；服务端日志报 Prisma `P2028`，interactive transaction 在 `5000ms` 超时后关闭 | `regression_passed` | `Codex` | `回归时间：2026-05-18 00:35\n回归人：Codex\n回归结果：通过\n备注：已将 createJoyInterviewSession 改为预生成 ID 的批式事务，并在 127.0.0.1:3001 上实测 joy / fulfillment / reflection / improvement / gratitude 五维 start 全部返回 200。` |
| `ISSUE-003` | `B-02` | 核心记录主链路 | `boundary_insufficient` choice 的 `next_event` 动作返回 `409 SESSION_CHOICE_UNAVAILABLE` | `Bug` | `P0` | 已登录后启动 `improvement` 会话，发送“今天很糟，我需要改进。别问了。”触发 `boundary_insufficient`；随后调用 `POST /api/interview/session/respond`，body 为 `{\"action\":\"next_event\",\"sessionId\":\"<sessionId>\"}` | choice card 暴露“换一个片段 / 下一件”时，应允许进入新 event，返回新的 opening question 和更新后的 session | 修复前接口稳定返回 `409 SESSION_CHOICE_UNAVAILABLE`；服务层仅允许 `event_complete` 走 `next_event`，与 `boundary_insufficient.actions` 已包含 `next_event` 的协议不一致 | `regression_passed` | `Codex` | `回归时间：2026-05-18 08:32\n回归人：Codex\n回归结果：通过\n备注：已放宽 next_event 的服务端准入条件，按 pendingDecision.actions + eventId 校验；127.0.0.1:3001 上实测 boundary_insufficient -> next_event 返回 200，新 event 变为 sequence=2 / stage=collect_event，原 event 正常 completed。` |
| `ISSUE-004` | `B-07` | 核心记录主链路 | `boundary_insufficient` 材料不足状态下仍可通过接口直接生成并保存日志 | `Bug` | `P0` | 启动 `fulfillment / improvement / gratitude` 会话，只提供第一层事件描述后立刻说“别追问了，直接整理成日志”；当返回 `pendingDecision.kind=boundary_insufficient` 后，继续直接调用 `POST /api/interview/session/draft/generate` 和 `POST /api/interview/session/draft/save` | 材料不足时应继续停在“只补一句 / 换一个片段 / 先退出”，不应允许 draft 生成，更不应保存为 `saved` | 修复前 API 会错误返回 `200`，生成并保存低质量 draft；形成“材料不足也能直接过闭环”的假通过 | `regression_passed` | `Codex` | `回归时间：2026-05-18 08:48\n回归人：Codex\n回归结果：通过\n备注：服务端已在 draft generation 前拦截 `boundary_insufficient` 与 `draftGenerationUnlocked=false` 的会话；`POST /api/interview/session/draft/generate` 现返回 `409 DRAFT_GENERATE_NOT_READY`，文案为“当前材料还不够生成日志，请先补充当前片段或换一个片段。”；相关服务/API 单测已通过。` |
| `ISSUE-005` | `AI-02` | AI 访谈效果验收 | fulfillment 正向样本无法稳定进入 `event_complete` | `上线阻断` | `P0` | 启动 `fulfillment` 会话；输入“今天下午我把拖了两天的发布说明梳理完了，前后逻辑终于顺了。” -> “最有分量的是我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂。” -> “对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数。” | 当 `experience + progressEvidence + valueSignal` 已成立时，应进入 `event_complete`，至少允许 `draft/generate` | 修复前仍停在 `probe_pattern`，继续追问“如果只留最有分量的一层，这件事让你觉得算数的标准是什么？”，`POST /api/interview/session/draft/generate` 返回 `409 DRAFT_GENERATE_NOT_READY`；修复后真实样本已进入 `event_complete`，`draftGenerationUnlocked=true`，可直接生成 draft，标题为 `主线终于理顺` | `regression_passed` | `Codex` | `回归时间：2026-05-18 10:45\n回归人：Codex\n回归结果：通过\n备注：127.0.0.1:3001 上真实 sf_fix3 样本已稳定进入 `event_complete`，pendingDecision.completionMode=`complete`，draft 标题为“主线终于理顺”。` |
| `ISSUE-006` | `AI-02` | AI 访谈效果验收 | fulfillment partial 标题串入 improvement 语义 | `Bug` | `P1` | fulfillment partial 样本：输入“今天下午我把拖了两天的发布说明梳理完了...” -> “这会让我觉得今天没白过，至少这件事是真的往前推进了。” -> “先这样，直接生成日志。” -> `POST /api/interview/session/draft/generate` | 标题应沿 fulfillment 语义收束，例如“把事情往前推 / 主线终于理顺 / 让协作接上” | 已修复。当前 partial 真实回归里，链路进入 `event_complete(user_override_partial)` 并生成 draft，标题已收束为 `把事情往前推`，不再回到 `把卡点推开` | `regression_passed` | `Codex` | `回归时间：2026-05-18 10:53\n回归人：Codex\n回归结果：通过\n备注：127.0.0.1:3001 上真实 sf_partial_fix 样本已完成 partial 收束并生成 draft；最终标题为“把事情往前推”，pendingDecision.completionMode=user_override_partial，draftGenerationUnlocked=true。` |
| `ISSUE-007` | `AI-04` | AI 访谈效果验收 | improvement 抽取与成稿在完整/中间态样本上不稳定 | `Bug` | `P0` | 覆盖 `repeat_good`、自责输入、track-only 中间态与完整 `avoid_bad` 样本；例如 `repeat_good` 输入“今天上午我先写了三条重点再开工...” 后继续补充原因与下一步，再调用 `POST /api/interview/session/draft/generate` | `repeat_good` 应抽出 `repeatCondition` 并在材料足够时进入 complete；自责输入不应误落为条件或卡点；正文不应重复拼接状态句 | 修复前 `repeat_good` 常无法进入 draft，自责样本会误带出无关 `controllableFactor`；complete 样本正文也会重复整句 `frictionPoint`。修复后 `avoid_bad` 与 `repeat_good` 两条真实主链都已进入 `event_complete` 并可生成 draft：`avoid_bad` 标题为 `先听完再回应`，`repeat_good` 标题为 `开工前定主线` | `regression_passed` | `Codex` | `回归时间：2026-05-18 10:45\n回归人：Codex\n回归结果：通过\n备注：127.0.0.1:3001 上真实 si_fix3 与 si_fix3_rg 样本均已闭环；`repeat_good` 现可从 collect_event -> probe_reason -> probe_pattern -> event_complete，并生成包含 `repeatCondition / controllableFactor / nextAttempt` 的 draft。` |
| `ISSUE-008` | `AI-05` | AI 访谈效果验收 | gratitude 的目标/需要抽取和正文组装仍会生成病句 | `Bug` | `P0` | 启动 `gratitude` 会话；输入“我今天发烧还有会要开，同事先帮我把会议记录框架列好了...” -> “那一下我最想感谢的是她没有只说辛苦了，而是真的替我减了负担。” -> “这让我觉得自己当时的慌和虚弱被看见了，不用硬撑着一边听一边记。” -> “先这样，直接整理成日志。” -> `POST /api/interview/session/draft/generate` | `gratitudeTarget` 应抽成“她/同事”，`seenNeed` 应落到“慌和虚弱被看见/不必硬撑”这类需要层；正文应自然表达，不出现病句 | 修复前 `gratitudeTarget` 会落成 `的是她没有只说辛苦了`，`seenNeed` 吞入整句原因，draft 正文出现“而是她没有只说辛苦了当时...”与“像是看见了自己当时的慌和虚弱被看见了...”；修复后真实样本已收敛为 `gratitudeTarget=同事`，正文不再出现上述病句；补充优化后 `seenNeed / gratitudeReason` 统一归一为“我当时的慌和虚弱，以及不用硬撑着一边听一边记的难处”，正文不再出现“也让我不用硬撑着一边听一边记 / 也不用硬撑着一边听一边记” | `regression_passed` | `Codex` | `回归时间：2026-05-18 14:33\n回归人：Codex\n回归结果：通过\n备注：已同步修复访谈抽取层、AI draft 清洗层与 fallback draft 句式；`tests/unit/joy-interview.service.test.ts`、`tests/unit/joy-interview-ai.service.test.ts`、`tests/unit/draft-policies.test.ts` 共 106 项通过，`npm run typecheck` 通过。真实 API 样本账号 `ai05_9085986340` 生成标题“被稳稳接住”，正文使用“对方像是看见了我当时的慌和虚弱，以及不用硬撑着一边听一边记的难处”。` |
| `ISSUE-009` | `F-01` | Analysis 与评分回流 | `/analysis` 首次打开未把 URL 归一到带 `section=overview` 的规范地址 | `Bug` | `P1` | 已登录后直接打开 `http://127.0.0.1:3001/analysis` | 地址应归一到 `/analysis?month=YYYY-MM&section=overview`，保证 section 显式稳定存在 | 已修复。`normalizeAnalysisSearchParams()` 现在会在 section 缺失或非法时一并触发 URL replace；Safari 真实直接打开 `/analysis` 后，地址栏归一为 `http://127.0.0.1:3001/analysis?month=2026-05&section=overview`，页面仍渲染总览。 | `regression_passed` | `Codex` | `回归时间：2026-05-18 13:34\n回归人：Codex\n回归结果：通过\n备注：针对性单测 `analysis-view-state / analysis-shell / site-header-analysis` 已通过；127.0.0.1:3001 Safari 真实页面也已验证。` |
| `ISSUE-010` | `G-02` | Profile / Memory / 设置补充能力 | 画像生成依赖 AI endpoint，当前验收环境缺少 endpoint 导致 3 条 facts 后仍无法生成画像 | `Bug` | `P1` | 使用账号 `g01_0904549385` 登录后，通过 `/api/profile` 新增 `joy / fulfillment / reflection` 三条手动 facts；再调用 `POST /api/profile/portrait` 或在 `/profile` 点击“生成画像” | facts 达到 3 条后应生成画像，后续 facts 变化时可在画像页提示“认知数据已更新，建议重新生成画像” | 已修复。画像合成现在保留少于 3 条 facts 的门槛，但当 AI provider 不可用或 AI 摘要失败时，会生成并缓存确定性 fallback portrait；画像页 stale 判断也从“只比 fact 数量”升级为同时比较 facts 最新 `updatedAt` 与 portrait `generatedAt`。 | `regression_passed` | `Codex` | `回归时间：2026-05-18 13:34\n回归人：Codex\n回归结果：通过\n备注：在 `.env.local` 仍缺少 `VOLCENGINE_ARK_ENDPOINT_ID` 的环境下，`POST /api/profile/portrait` 对 3 条 facts 返回 `201` 和 `factCount=3` snapshot；编辑其中一条 fact 后，Safari `/profile` 真实显示“认知数据已更新，建议重新生成画像以反映最新变化。”。针对性单测 `portrait-synthesis.service` 与 `portrait-view` 已通过。` |
| `ISSUE-011` | `OPS-DB-01` | 数据持久化与部署基线 | 共享环境数据库补强 checklist 尚未成为显式上线门 | `数据风险` | `P1` | 准备把当前分支部署到共享环境，但未确认 `DATABASE_URL / DIRECT_URL` 分工、未执行 `npx prisma migrate deploy`、未核对 pgvector / 关键索引 / backup 与 auth session 清理 | 上线前应有一条明确的数据库 readiness 基线：应用走 pooler，migration 走 direct URL；先做 backup，再执行 migration，再验证索引、pgvector 和会话生命周期 | 当前仓库代码已经补齐索引、pgvector contract、auth session 生命周期和 score 约束，但如果部署仍沿用 `db push` 或把 migration 跑在 pooler 上，风险不会被代码本身消除 | `triaged` | `Codex` | `回归时间：2026-05-18 20:27\n回归人：Codex\n回归结果：通过\n备注：本条用于把 persistence hardening 作为上线 readiness 项显式挂出；对应执行口径已同步到 README 与 operator runbook，待真实共享环境 rollout 时按 checklist 回归。` |
| `ISSUE-012` | `D-05` | 异常、空态与上线阻断项 | Vercel Preview / Production AI 环境与 URL 合同仍有未闭环项 | `上线阻断` | `P0` | 在已 link 的仓库根目录执行 `vercel env ls --scope zouzhijies-projects`，观察 `zouzhijies-projects/xingfuxitong` 的 `Development / Preview / Production` 环境变量；再对照 `.env.preview.example` 与 `.env.production.example`，并补做目标环境 `vercel env pull` 或等价 readback | Preview / Production 至少应具备 `DATABASE_URL`、`AI_PROVIDER`、`VOLCENGINE_ARK_API_KEY`、`VOLCENGINE_ARK_ENDPOINT_ID`、`VOLCENGINE_ARK_BASE_URL`；`VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID` 可按当前策略留空。部署 URL 合同可由显式 `APP_URL` 或 Vercel system env 满足；preview 的最小 system-env 证据可接受 `VERCEL=1` + `VERCEL_URL`，但 production 若走 system env 仍需直接拿到 `VERCEL_PROJECT_PRODUCTION_URL`，否则就要拿到显式 `APP_URL` | 后续复查已确认：四个 AI 必填变量现在都出现在 `Development / Preview / Production`；`vercel env pull --environment=preview` 与 `--environment=production` 结果里都出现了 `VERCEL=1`、`VERCEL_TARGET_ENV`、`VERCEL_URL`。这说明 preview deployment URL 的最小证据已到位，AI 变量缺失也已解除；但本轮仍未直接看到 `APP_URL` 或 `VERCEL_PROJECT_PRODUCTION_URL`，因此 production URL contract 还不能写成已闭环。 | `fixed_pending_regression` | `Codex` | `回归时间：2026-05-19 20:10\n回归人：Codex\n回归结果：部分通过\n备注：新的 preview redeploy 已 Ready，protected preview 的最小自动化 smoke 也已固定到 vercel-curl。当前剩余缺口不是 AI 变量，也不是预览最小 URL 证据，而是 production URL contract 仍缺少 `APP_URL` 或 `VERCEL_PROJECT_PRODUCTION_URL` 的直接 readback。` |

## 记录规则

- 每个问题单独成行，不把多个问题塞进一条。
- 同一个用例发现多个独立问题时，拆成多个问题 ID。
- 修复后不能只改状态，必须补“回归结论”。
- 被接受为已知限制的问题，状态改为 `accepted_known_limit`，并写明接受理由。

## 回归结论模板

可使用以下格式：

```text
回归时间：YYYY-MM-DD HH:mm
回归人：<name or agent>
回归结果：通过 / 未通过
备注：<是否完全关闭，是否还有残余风险>
```
