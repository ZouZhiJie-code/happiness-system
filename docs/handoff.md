# 当前阶段 Handoff

最后更新：`2026-07-21`

## 1. 交接结论

Daily Light 已具备完整的五维访谈、维度日志、当天整合日志、日历、分析、账户、管理员分析和 AI 质量闭环。当前生产主域名为：

```text
https://dailylight.chat
```

AI 质量链路已经从“收集案例”推进到“验证候选、全量发布、按版本观察七天、支持人工回滚”。访谈意图识别已于 `2026-07-21` 全量启用；模块二“本轮理解与事实更新”也已完成生产上线。小流量阶段的运营重点是持续收集真实用户反馈，优先记录理解、边界和日志事实问题，并由管理员按需运行评估和候选生成，再对通过验证的候选执行发布。

## 2. 当前生产事实

- 唯一生产主域名：`https://dailylight.chat`
- 兼容入口：`https://www.dailylight.chat`
- `dlight.cc.cd` 已于 `2026-07-20` 从 Vercel production aliases 中移除并废弃
- Vercel production 的 `APP_URL` 为 `https://dailylight.chat`
- 当前 production deployment：`dpl_CKPntUXFtyrqFSQW8eqGEvgKA8rZ`
- 对应生产部署状态：`Ready`
- 当前 production alias 指向：`https://xingfuxitong-bh0w23b5x-zouzhijies-projects.vercel.app`
- `2026-07-21` 已完成访谈意图识别全量发布；正式与预览环境采用当前识别策略，出现高影响问题时可以恢复到上一稳定处理版本。
- `2026-07-21` 已完成模块二生产上线：生产数据库已应用两项理解数据升级，正式环境采用第二版本轮理解协议。公开页面检查、真实感谢维度回答、本轮理解写入、事件累计状态和用户侧隐藏边界均通过；上一正式部署 `dpl_3CrHUAqd4MtrMc5PTSsNitrwB4Nr` 保留快速恢复能力。
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
- 访谈意图识别 v1 已完成全量启用，用户内容、换问法、日志整理、停止追问、跳过和切换要求会分别理解；正式与预览环境采用当前识别策略，并保留快速恢复能力。
- 本轮理解与事实更新已完成生产上线：操作要求保留顺序，内容可并行进入理解；同一轮支持多个回答目标、明确修正、含糊冲突、候选事件和候选维度。进度、下一问和日志从同一份生效材料读取信息，用户侧继续只看到对话和日志正文。
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

本轮理解与事实更新迁移：

- `20260721120000_add_interview_trusted_understanding`
- `20260721153000_add_interview_turn_understanding_result`

两项迁移分别为事件增加累计理解状态，并为用户回答增加本轮理解结果、协议版本和理解完成时间。它们已于 `2026-07-21` 应用到 production；当前 production 数据库有 31 条 migration。

`2026-07-20` 已完成生产数据安全清理：

- 固定验收管理员账号已删除
- 固定验收 Trace、反馈、评估、案例、候选、运行和审计记录已删除
- 真实用户候选与业务数据得到保留
- `npm run acceptance:ai-quality:seed` 已增加远程数据库保护

验收脚本规则：

- 默认只写本地数据库
- 远程隔离测试库要求 `ALLOW_REMOTE_AI_QUALITY_ACCEPTANCE_SEED=I_UNDERSTAND`
- production 环境主动终止

## 6. 验证基线

最近一次全量代码验证：

- 当前工作区 `npm test`：`191` 个测试文件、`1711` 个测试通过
- `npm run lint`：通过，保留 `44` 条既有 warning
- `npx tsc --noEmit`：通过
- `npm run build`：通过，保留既有 ESLint warnings

AI 质量发布与效果观察专项验证：

- `10` 个测试文件
- `30` 个测试通过
- 覆盖验证门、System Prompt/Few-shot 归因、七天窗口、结论规则、证据分页、审计、确认弹窗、骨架、空态和错误重试

流动交互专项回归入口：

- 当前专项回归：`7` 个测试文件、`50` 个测试通过
- `tests/unit/sliding-segmented-control.test.tsx`
- `tests/unit/horizontal-pager.test.tsx`
- `tests/unit/action-menu.test.tsx`
- `tests/unit/confirm-dialog.test.tsx`
- `tests/unit/site-header-calendar.test.tsx`
- `tests/unit/site-header-analysis.test.tsx`
- `tests/unit/analysis-shell.test.tsx`

## 7. 下一步运行主线

### 7.1 收集真实反馈

1. 生产流量统一进入 `https://dailylight.chat`。
2. 观察真实访谈回复和日志的赞踩、标签与文本。
3. 确认 Trace、反馈、评估和 Prompt 版本血缘持续写入。
4. 记录意图识别中的重复追问、修正理解、停止后追问、未完成表达和下游采用异常；P0 问题出现 1 条即进入修复与回退判断，P1 问题按语义家族归类后排期。

### 7.2 生成与验证候选

1. 管理员进入 `/admin/ai-quality`。
2. 先按待发布、待验证、待审核查看候选；需要补充数据时点击“检查最近回复”。
3. 阅读问题的通俗说明、背景、证据与回复对照。
4. 批准证据充分的候选。
5. 执行回放验证，并检查目标案例与正向回归案例。

### 7.3 发布与七天复盘

1. 对通过验证的候选执行“全量应用”；需要调整时退回并记录原因。
2. 核对新 Trace 的 `+opt` 或 `+fs` 版本标记。
3. 在效果观察区查看绝对数量、比例和真实案例。
4. 严重问题触发时优先人工回滚。
5. 七天结束后根据“建议保留 / 人工复核 / 建议回滚”做最终决定。

## 8. 仍需持续关注

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
- 模块二产品规格、技术设计和验收：`docs/interview-understanding-product-spec.md`、`docs/interview-understanding-technical-design.md`、`docs/interview-understanding-acceptance-report.md`
- AI 质量完整规则：`docs/ai-quality-loop.md`
- Vercel 与生产域名：`docs/vercel-preview-production-lane.md`
- 前端设计规范：`DESIGN.md`、`docs/design/ui-conventions.md`
- 五维理论：`docs/theory/*.md`
