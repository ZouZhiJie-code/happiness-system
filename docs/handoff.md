# 当前阶段 Handoff

最后更新：`2026-07-20`

## 1. 交接结论

Daily Light 已具备完整的五维访谈、维度日志、当天整合日志、日历、分析、账户、管理员分析和 AI 质量闭环。当前生产主域名为：

```text
https://dailylight.chat
```

AI 质量链路已经从“收集案例”推进到“验证候选、全量发布、按版本观察七天、支持人工回滚”。小流量阶段的下一项运营动作是持续收集真实用户 Trace 与反馈，由管理员按需运行评估和候选生成，再对通过验证的候选执行发布。

## 2. 当前生产事实

- 唯一生产主域名：`https://dailylight.chat`
- 兼容入口：`https://www.dailylight.chat`
- `dlight.cc.cd` 已于 `2026-07-20` 从 Vercel production aliases 中移除并废弃
- Vercel production 的 `APP_URL` 为 `https://dailylight.chat`
- 最新已验证 production deployment：`dpl_Ej4wSeiF7fJS89REK7o1TSqubr9y`
- 对应生产部署状态：`Ready`
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
- 访谈页站内 header 导航直接完成路由切换；浏览器刷新或关闭访谈页面时继续通过 `beforeunload` 保存会话恢复标记并提供离开保护

`improvement` 与 `gratitude` 的自动化验收样例已齐备，后续仍可继续进行端到端产品文风打磨。

### 3.2 日历、分析与画像

- `/calendar` 支持 month / week / day 三层记录工作台
- 天级数据统一按 `Asia/Shanghai` 整天窗口归档
- `/analysis` 使用 `trends / dimensions / correlation / review` 单页滚动结构
- 幸福 8 要素评分入口位于访谈页当天评分工作区
- `/profile` 支持记忆库、画像合成和演变视图
- 记忆系统由 `memoryEnabled` 控制，默认关闭

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

### 4.4 效果复盘

- 基线读取发布前 7 天
- 观察期最长 7 天
- 回滚或同路径新版本发布会提前截止当前窗口
- 指标覆盖生成数、赞踩、同类问题、严重问题、失败和延迟
- 页面结论包括继续观察、低样本、人工复核、建议保留和建议回滚
- 管理员可查看脱敏“需关注”与“正向反馈”真实对话

完整规则见 `docs/ai-quality-loop.md`。

## 5. 数据与迁移

AI 质量迁移顺序：

- `20260719010000_add_ai_generation_trace`
- `20260719020000_add_ai_evaluation`
- `20260719030000_add_ai_feedback_and_consent`
- `20260719040000_add_ai_optimization_engine`
- `20260719050000_default_ai_quality_and_candidate_dedupe`
- `20260719060000_add_ai_candidate_validation`
- `20260720010000_bind_prompt_release_validation`

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

- `npm test`：`168` 个测试文件、`1061` 个测试通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过
- 构建保留既有 ESLint warnings

AI 质量发布与效果观察专项验证：

- `10` 个测试文件
- `30` 个测试通过
- 覆盖验证门、System Prompt/Few-shot 归因、七天窗口、结论规则、证据分页、审计、确认弹窗、骨架、空态和错误重试

## 7. 下一步运行主线

### 7.1 收集真实反馈

1. 生产流量统一进入 `https://dailylight.chat`。
2. 观察真实访谈回复和日志的赞踩、标签与文本。
3. 确认 Trace、反馈、评估和 Prompt 版本血缘持续写入。

### 7.2 生成与验证候选

1. 管理员进入 `/admin/ai-quality`。
2. 点击“立即评估并生成候选”。
3. 阅读问题的通俗说明、背景和完整对话。
4. 批准证据充分的候选。
5. 执行回放验证，并检查目标案例与正向回归案例。

### 7.3 发布与七天复盘

1. 对通过验证的候选执行“全量应用”。
2. 核对新 Trace 的 `+opt` 或 `+fs` 版本标记。
3. 在效果观察区查看绝对数量、比例和真实案例。
4. 严重问题触发时优先人工回滚。
5. 七天结束后根据“建议保留 / 人工复核 / 建议回滚”做最终决定。

## 8. 仍需持续关注

- 候选发布缺少通过验证时，仓储会抛出 `OPTIMIZATION_VALIDATION_REQUIRED`；当前 PATCH 路由会返回通用 `500 AI_QUALITY_REVIEW_FAILED`，需要补成结构化 `409` 并增加 API 回归测试
- 小流量下样本增长较慢，低于 5 条时以真实对话判断为主
- Few-shot 依赖持续有效的点赞与 85 分以上评估
- Engineering 候选需要进入正常研发、测试和部署流程
- `improvement / gratitude` 继续安排真实用户端到端文风验收
- 记忆系统默认关闭，启用前需要确认 embedding 配置与隐私口径
- `/api/transcribe` 仍为 stub

## 9. Canonical 文档

- 项目事实与协作约束：`AGENTS.md`
- 快速入口与命令：`README.md`
- 系统分层和数据流：`docs/architecture.md`
- HTTP 接口合同：`docs/integration-guide.md`
- 运维、迁移和冒烟：`docs/operator-runbook.md`
- AI 质量完整规则：`docs/ai-quality-loop.md`
- Vercel 与生产域名：`docs/vercel-preview-production-lane.md`
- 前端设计规范：`DESIGN.md`、`docs/design/ui-conventions.md`
- 五维理论：`docs/theory/*.md`
