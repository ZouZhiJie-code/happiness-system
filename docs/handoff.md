# 当前阶段 Handoff

最后更新：`2026-08-06`

## 1. 交接结论

Daily Light 已具备完整的五维访谈、维度日志、当天整合日志、日历、分析、账户、管理员分析和 AI 质量闭环。事件中心已具备事件级会话、可靠提交、失败恢复、Trace 与事件日志闭环，当前生产主域名为：

```text
https://dailylight.chat
```

AI 质量链路已经从“收集案例”推进到“验证候选、全量发布、按版本观察七天、支持人工回滚”。访谈意图识别已于 `2026-07-21` 全量启用；小流量阶段的运营重点是持续收集真实用户 Trace 与反馈，优先记录意图识别问题，并由管理员按需运行评估和候选生成，再对通过验证的候选执行发布。

事件中心当前采用“理清想法”单角度 MVP。GI-066 的 DeepSeek 官方预检、严格 `10×3` 和单角度自动 `8+2` 已通过，继续作为历史技术证据；最新真人实聊因提问目标偏移、重要线索遗漏、同义重复和纠正后错误重规划判定为 `No-Go`，候选失效，剩余人工批次停止。

`GI-067 / GI-068～074` 已冻结板块 4 七个产品批次，`GI-075～080` 已冻结板块 5 六类规则，方法 `v1.0` 已冻结。板块 6 当前建设正式评测资产；`GI-081` 板块 7A 六题真实输出和 Codex 封存初评已经完成，等待产品负责人盲评。板块 7 正式实现继续等待板块 6，板块 8 等待新候选完成两模式 `4＋2` 真人验收。Production 继续保持 `legacy + baseline`。

## 2. 当前生产事实

- 唯一生产主域名：`https://dailylight.chat`
- 兼容入口：`https://www.dailylight.chat`
- `dlight.cc.cd` 已于 `2026-07-20` 从 Vercel production aliases 中移除并废弃
- 当前事件中心发布策略：Production 保持 `legacy + baseline`；GI-067 / GI-068～080 产品规则已冻结，板块 6 正在建设正式评测资产，GI-081 板块 7A 诊断等待产品盲评，板块 7 正式实现和板块 8 继续等待；`optional + generative` 继续保持关闭
- Vercel production 的 `APP_URL` 为 `https://dailylight.chat`
- `2026-07-21` 历史 production deployment：`dpl_3CrHUAqd4MtrMc5PTSsNitrwB4Nr`，状态为 `Ready`
- `2026-07-21` 历史 production alias：`https://xingfuxitong-dhg8kgt7f-zouzhijies-projects.vercel.app`
- `2026-07-21` 已完成访谈意图识别全量发布：正式环境采用 `enforce`，上一正式版本 `dpl_7jpZCQTZukzFY8XMVD6wcsQScxrc` 与 `legacy` 档位共同保留为 P0 问题的即时回退入口。
- `2026-07-20` 已合并 UserTurn 可靠提交改造（PR #36，`ce1e2afbefe98eb79a21faf3d02869fe377085f4`）；`InterviewUserTurn` 与 AI 候选审核理由两条 migration 已应用到 production，公开 smoke 和同 `clientTurnId` 的重放校验通过。
- 访谈维度选择页的内容层会完整伸展到可用视口，页面底部背景保持连续。
- 本地验收快捷登录在 production 返回 `404`
- 生产公开 smoke 已覆盖首页、登录、注册、协议页和 session
- AI 质量效果接口在未登录状态返回 `401`

部署和域名操作以 `docs/vercel-preview-production-lane.md` 为事实源。

## 3. 已完成产品能力

### 3.1 五维访谈与日志

- `joy / fulfillment / reflection / improvement / gratitude` 已完成理论对齐深化
- 五维均具备专属抽取、fallback、阶段推进、完成标准、正文生成、质量门和短标题治理
- 用户停止边界与自然语言日志整理意图优先处理
- `question_repair` 走服务端确定性重问，并避免重复回卷
- `thinkingSummary`、正文、标题和质量门共享服务端语义解释层
- stitched 多事件日志保留完整 supporting moments
- 访谈回复、维度日志和当天整合日志均可恢复与保存
- 用户回复采用两阶段持久化：`InterviewUserTurn` 先保存原话和提交位置，AI 处理成功后再完成本轮；失败或取消后，页面可用同一 `clientTurnId` 继续生成
- 访谈意图识别 v1 已完成全量启用：`legacy` 保持既有决策，`shadow` 记录新旧判断对照，`enforce` 让新决策参与访谈推进。Production 与 Preview 当前均采用 `enforce`；`legacy` 作为 P0 问题的即时回退档位。
- 事件中心已交付事件级会话、可靠原话提交、用户气泡即时显示、失败续接、退出记录回看和事件日志闭环；历史四角度数据与代码继续兼容。
- `GI-065` 的“理清想法”单角度验证目标继续约束【陪我聊】；新记录由用户在【帮我记】与【陪我聊】之间明确选择。`GI-067 / GI-068～074` 已冻结目标产品规则，兼容两段式链路和历史 baseline 能力仍只代表既有实现，新候选等待板块 5～7。
- 事件日志支持来源快照、标题/正文编辑、自动暂存、正式保存、刷新恢复和当天事件标签重开；事件中心反馈通过 `generationTraceId` 连接现有 AI 质量链路。
- 按意图重新生成已完成正式发布：新会话的正式追问支持简单、具体、换角度、深入、轻一点与纠正理解；每组最多保留三个版本，历史换问法通过分支保留原对话，日志边界锁定已存在后续回答的历史路径。
- 重新生成的加载、替换和版本切换都发生在目标回复原位置。纠正理解支持 `Enter` 提交、`Shift + Enter` 换行；操作区维持静态禁用入口，气泡承担唯一加载状态。
- 访谈页站内 header 导航直接完成路由切换；浏览器刷新或关闭访谈页面时继续通过 `beforeunload` 保存会话恢复标记并提供离开保护

`improvement` 与 `gratitude` 的自动化验收样例已齐备，后续仍可继续进行端到端产品文风打磨。

### 3.2 日历、分析与画像

- `/calendar` 支持 month / week / day 三层记录工作台
- 天级数据统一按 `Asia/Shanghai` 整天窗口归档
- `/analysis` 使用 `trends / dimensions` 两段纵向滚动结构；历史 `overview / score / rhythm` 归一到 `trends`，历史 `insights / correlation / review` 归一到 `dimensions`
- 幸福 8 要素评分入口位于访谈页当天评分工作区
- `/profile` 支持记忆库、画像合成和演变视图
- 记忆系统由 `memoryEnabled` 控制，默认关闭
- 共享交互体验已收口：按钮与交互卡片有即时按下反馈，segmented 使用可重定向 spring，画像与分析支持横向 swipe，移动端日志书页支持拖动关闭，菜单与确认弹窗具备完整键盘和焦点管理

### 3.3 管理员能力

- `/admin/analytics` 支持总览、候选用户和内容级下钻
- `/settings/ai-runtime` 支持 AI 配置草稿、测试、发布、历史和回滚
- 管理员权限统一由 `ADMIN_USERNAMES` 白名单控制
- 内容级查看统一写入 `AdminAuditLog`
- Prisma `P1001 / P1017 / P2024` 等临时连接问题在管理员只读路径中会重试一次，并投影为友好错误状态

## 4. AI 质量闭环现状

### 4.1 用户侧

- 访谈回复和日志统一使用赞、踩图标
- 赞与踩均支持专属标签和自由文本
- 点赞允许空提交，点踩要求标签或文本
- 再次点击已保存图标会撤回反馈
- 反馈当前状态与 revision 历史均绑定 `Trace_ID`
- 质量改进默认参与，注册和登录会维护政策版本与审计时间
- 兼容退出请求返回 `409 AI_QUALITY_PARTICIPATION_REQUIRED`

### 4.2 自动化侧

- 每个用户可见生成物绑定 `AIGenerationTrace`
- 每次模型调用绑定 `AIRequestLog`
- 每条 Trace 运行规则评估，高风险和稳定抽样进入 LLM Judge
- `AIEvaluation` 保存评分与扣分原因
- `AICase` 保存 Goodcase / Badcase / Review 分类
- 手动运行先评估最多 20 条待处理 Trace，再扫描最近 7 天案例
- 定时任务继续执行每日评估和每周聚类
- 候选使用 `dedupeKey` 防止相同证据重复生成

### 4.3 发布侧

- 候选路径：System Prompt、Few-shot、Engineering
- System Prompt 和 Few-shot 要求管理员批准并完成回放验证
- `AIOptimizationValidation` 保存目标和回归案例结果
- `AIPromptRelease.validationId` 绑定发布采用的验证记录
- System Prompt Trace 使用 `+opt:{candidateId}` 归因
- Few-shot Trace 使用 `+fs:{fingerprint}` 归因
- 全量发布和回滚均由管理员确认
- 审核页面采用“状态摘要 + 候选队列 + 连续审核区”工作台；退回调整要求填写 `4–300` 字原因，并在历史记录中保留处理人、时间和理由

### 4.4 效果复盘

- 基线读取发布前 7 天
- 观察期最长 7 天
- 回滚或同路径新版本发布会提前截止当前窗口
- 指标覆盖生成数、赞踩、同一问题、严重问题、失败和延迟；同一问题按标准化后的具体问题键计算，缺少问题码时显示“口径不足”
- 页面结论包括继续观察、低样本、人工复核、建议保留和建议回滚
- 管理员可查看脱敏“需关注”与“正向反馈”真实对话

完整规则见 `docs/ai-quality-loop.md`。

访谈功能的产品架构、主链时序和逐节点图解统一收录在 [访谈功能图谱](./diagrams/README.md)。

## 5. 数据与迁移

AI 质量迁移顺序：

- `20260719010000_add_ai_generation_trace`
- `20260719020000_add_ai_evaluation`
- `20260719030000_add_ai_feedback_and_consent`
- `20260719040000_add_ai_optimization_engine`
- `20260719050000_default_ai_quality_and_candidate_dedupe`
- `20260719060000_add_ai_candidate_validation`
- `20260720010000_bind_prompt_release_validation`
- `20260720153000_add_ai_optimization_review_reason`

访谈用户提交恢复迁移：

- `20260720120000_add_interview_user_turn`
- `20260720210000_add_interview_intent_assessment`
- `20260720223000_add_interview_response_regeneration`

第一条 migration 新增 `InterviewUserTurn`、动作与状态枚举、`InterviewMessage.userTurnId`，并建立同会话 `clientTurnId` 唯一约束和待处理状态索引。第二条 migration 为同一提交记录增加意图评估、决策、分类器版本与评估时间，支持安全重放和分阶段发布。

第三条 migration 为会话、消息和用户动作增加回复版本与分支字段，并新增 `InterviewBranchCheckpoint` 和 `AIResponseRegeneration`。它已于 `2026-07-21` 应用到 production；当前 production 数据库有 30 条 migration。

`2026-07-20` 已完成生产数据安全清理：

- 固定验收管理员账号已删除
- 固定验收 Trace、反馈、评估、案例、候选、运行和审计记录已删除
- 真实用户候选与业务数据得到保留
- `npm run acceptance:ai-quality:seed` 已增加远程数据库保护

事件中心 MVP 复用现有 `InterviewSession`、`InterviewEvent`、`JournalEventEntry`、`AIGenerationTrace` 和 `AnalyticsEvent`；本轮实现没有新增数据库表或 migration。事件中心日志接口为：

- `POST /api/interview/event-centered/session/start`
- `GET /api/interview/event-centered/session/[id]`
- `POST /api/interview/event-centered/session/respond/stream`
- `POST /api/interview/event-centered/session/turn`
- `POST /api/interview/event-centered/journal/generate`
- `GET/PATCH /api/interview/event-centered/journal/[id]`
- `POST /api/interview/event-centered/journal/[id]/save`

验收脚本规则：

- 默认只写本地数据库
- 远程隔离测试库要求 `ALLOW_REMOTE_AI_QUALITY_ACCEPTANCE_SEED=I_UNDERSTAND`
- production 环境主动终止

## 6. 验证基线

最近一次已记录的全量代码验证来自 `2026-08-04` GI-066 阻断修复候选：

- 全量测试：`268` 个测试文件、`2541/2541` 个用例通过
- 严格 `10×3`：动作、方向和完整无问题均为 `30/30`，重复选题错误 `0`
- 自动 `8+2`：主链 `8/8`、日志闭环 `8/8`、两条冒烟通过、运行降级 `0`
- `npm run lint`：`0 error / 46 warnings`，警告为仓库既有基线
- `npx tsc --noEmit`、生产构建、Prisma validate、隔离库 migrate status 和差异检查通过

该快照只证明 GI-066 当时候选的技术状态。最新真人体验 `No-Go` 已使候选失效；GI-067 新候选需要重新完成对应验证。

AI 质量发布与效果观察专项验证：

- `10` 个测试文件
- `30` 个测试通过
- 覆盖验证门、System Prompt/Few-shot 归因、七天窗口、结论规则、证据分页、审计、确认弹窗、骨架、空态和错误重试

流动交互专项回归入口：

- 流动交互专项历史回归：`7` 个测试文件、`50` 个测试通过；当前总量以全量快照与事件中心专项为准
- `tests/unit/sliding-segmented-control.test.tsx`
- `tests/unit/horizontal-pager.test.tsx`
- `tests/unit/action-menu.test.tsx`
- `tests/unit/confirm-dialog.test.tsx`
- `tests/unit/site-header-calendar.test.tsx`
- `tests/unit/site-header-analysis.test.tsx`
- `tests/unit/analysis-shell.test.tsx`

## 7. 下一步运行主线

### 7.0 当前交付顺序

1. 产品负责人完成 GI-081 六题真实输出盲评；随后揭晓架构、校准分歧并检查每种候选的 `4/6` 门槛。
2. 板块 6B 只根据重复出现的真实问题扩建判尺，并继续建立复标后的 `24＋40`、`28＋12`、Judge 说明、人工评分卡和正式准入报告。
3. 板块 7 将冻结产品规则和板块 6 正式资产落实为 Prompt / Interview Skill、状态、Trace、确定性保护、运行器和版本血缘，并重新完成 DeepSeek 官方 Provider 预检与候选回归。
4. 板块 8 使用独立 Preview 数据和新候选完成 `4` 条计分轨迹与 `2` 条冒烟，逐条形成真人裁决和 Go/No-Go。
5. 真人 Go 后暂停并等待产品负责人单独授权；获得授权后再切换 Production，完成线上冒烟和首批 `10` 次有效会话全审。任意单例阻断立即进入停止、修复或回退。

### 7.1 上线后收集真实反馈

1. 生产流量继续统一进入 `https://dailylight.chat`；事件中心在获得板块 8 授权后按 `optional + generative` 开放。
2. 前 `10` 次有效事件会话逐条审计，观察事件中心回复和日志的赞踩、标签与文本。
3. 确认 Trace、反馈、事件漏斗和 Prompt 版本血缘持续写入。
4. 记录生成式降级、重复追问、修正理解、停止后追问、未完成表达和日志来源异常；P0 问题出现 1 条即进入修复与回退判断，P1 问题按语义家族归类后排期。

### 7.2 生成与验证候选

1. 管理员进入 `/admin/ai-quality`，先处理事件中心真实案例中的高频共同根因。
2. 先按待发布、待验证、待审核查看候选；需要补充数据时点击“检查最近回复”。
3. 阅读问题的通俗说明、背景、证据与回复对照。
4. 批准证据充分的候选。
5. 执行回放验证，并检查目标案例与正向回归案例。

### 7.3 发布与七天复盘

1. 对通过验证的候选执行“全量应用”；需要调整时退回并记录原因。
2. 核对新 Trace 的 `+opt` 或 `+fs` 版本标记。
3. 在效果观察区查看绝对数量、比例和真实案例。
4. 严重问题触发时优先人工回滚到 `legacy + baseline`。
5. 事件中心累计 `30` 次有效事件会话后，每轮只挑选一个真实共同根因进入候选验证；原工作集、隐藏集、准入集和完整轨迹保留为重大变更回归资产。
6. 七天结束后根据“建议保留 / 人工复核 / 建议回滚”做最终决定。

## 8. 仍需持续关注

- 板块 5 已冻结 GI-075～080 六类规则，落地验证仍待板块 7 正式候选承接。
- 板块 6 仍需完成六题真实输出盲评、判尺扩建及可运行、可复标的正式评测资产；板块 7 正式实现等待板块 6，板块 8 等待新候选。
- GI-066 自动层通过、真人体验 `No-Go` 和候选失效三类状态继续分开保存；Production 授权前保持 `legacy + baseline`。
- 小流量下样本增长较慢，低于 5 条时以真实对话判断为主
- Few-shot 依赖持续有效的点赞与 85 分以上评估
- Engineering 候选需要进入正常研发、测试和部署流程
- `improvement / gratitude` 继续安排真实用户端到端文风验收
- 记忆系统默认关闭，启用前需要确认 embedding 配置与隐私口径
- 日历、访谈和分析仍有少量 `0.64–0.68rem` 的遗留辅助标签；后续触及对应区域时按 `0.75rem` 核心控制基线逐步收口
- `/api/transcribe` 仍为 stub

## 9. Canonical 文档

- 项目事实与协作约束：`AGENTS.md`
- 快速入口与命令：`README.md`
- 系统分层和数据流：`docs/architecture.md`
- HTTP 接口合同：`docs/integration-guide.md`
- 运维、迁移和冒烟：`docs/operator-runbook.md`
- AI 质量完整规则：`docs/ai-quality-loop.md`
- Vercel 与生产域名：`docs/vercel-preview-production-lane.md`
- 生成式访谈当前状态与依赖：`docs/generative-interview-refactor-map.md`
- GI-067 七批次架构与冻结结论：`docs/technical/interview-event-centered/04x-board4-gi067-interview-question-strategy-global-framework.md`
- GI-074 评测体系与下游交接：`docs/technical/interview-event-centered/04x-07-evaluation-preview-and-handoff.md`
- 事件中心公共产品协议：`docs/technical/interview-event-centered/04-four-angle-common-interview-protocol.md`
- 历史板块 7 Preview 候选：`docs/technical/interview-event-centered/04o-board7-mvp-preview-candidate-handoff.md`
- 前端设计规范：`DESIGN.md`、`docs/design/ui-conventions.md`
- 五维理论：`docs/theory/*.md`
