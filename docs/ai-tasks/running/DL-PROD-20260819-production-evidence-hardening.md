# Daily Light 五阶段生产主线完善

- 文档职责：当前专项与总计划
- 文档状态：已确认·实施中
- 最后核验：`2026-08-19`
- 权威入口：[`docs/README.md`](../../README.md)
- 任务编号：`DL-PROD-20260819`
- 工作分支：`codex/production-evidence-hardening-20260819`
- 工作区：`/Users/zouzhijie/Desktop/Happiness-system-production-evidence-hardening-20260819`

## 1. 目标与当前事实

本专项在 GI-088 生成式策略继续隔离的前提下，完善当前 Production 的证据、回归、代码结构和月度洞察评估能力。正式产品继续运行 `event_centered + baseline`；生成式访谈、月度 AI 洞察和数据库迁移继续关闭。

当前 Production 事实：

- 正式域名：`https://dailylight.chat`
- deployment：`dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2`
- 发布时间：`2026-08-13`
- 运行模式：`event_centered + baseline`
- 源码血缘：已封存 commit `ed8c36d`；新分支以最新 `origin/main` 为父节点，并通过基线提交 `5c36b49` 恢复该 Production 源码树
- 上一正式版本：`dpl_ATtwPhXLvmHURAutRzKyimNSWyir`，承担 `legacy + baseline` 回退

## 2. 实施范围

### 阶段 1｜Production 数据口径 v2

- 管理后台漏斗按唯一用户和顺序到达计算当前产品七步主链。
- 旧五维漏斗独立展示并保留一个兼容周期。
- 留存统一使用 `Asia/Shanghai` 自然日和首次事件卡保存 cohort。
- `staleRate` 使用 `JournalDailyEntry.sourceSignature` 与当天有效事件卡重建签名计算。
- 增加恢复开始、成功、失败事件及 fallback、异常退出、恢复率、P50/P95 时延。
- 本阶段只改读取层与埋点，不修改 Prisma Schema，不回写历史数据。

### 阶段 2｜零模型端到端回归

- 引入 `@playwright/test`、临时 PostgreSQL Schema、固定账号和仅测试环境启用的确定性 AI 替身。
- 覆盖 `1440×900` 与 `1024×768`，数据库并发用例串行执行。
- 覆盖登录、两种记录方式、可靠恢复、幂等并发、日记生成更新、跨天和管理后台对账。
- 同时断言 `AIRequestLog` 增量为 `0`，且生成 Trace 中模型实际执行、Provider 尝试与 LLM 来源均为 `0`。

### 阶段 3｜Production 日志 Golden Set v2

- 先完成 AI 评测启动卡，再按有效同意、未撤回、内部账号优先筛选记录。
- 正文只通过受控管理员读取，访问写入 `AdminAuditLog`；原文进入 Git 排除的 `.private`，权限保持目录 `0700`、文件 `0600`。
- Production 保持业务数据零写入，`AdminAuditLog` 是正文访问唯一允许的治理写入；首版只使用有效同意且具有样本级完整轨迹评审授权的内部账号。
- 建立 30 条真实完整链路；第 10 条和第 30 条由产品负责人完成最终裁决。
- 本阶段复盘既有输出，新增模型调用为 `0`。

### 阶段 4｜Production 主链重构

- 后端拆分会话生命周期、可靠回合、baseline 编排、工作区投影、事件卡收束和埋点。
- 事件中心前端拆分状态 Hook、outbox、消息输入、侧栏和错误恢复。
- 当天日记工作区拆分数据、事件卡、生成更新、编辑保存和时间线。
- 保持 API、SSE、数据库、错误码、幂等键、事件名和开关兼容；历史 `InterviewShell` 与 `joy-interview.service.ts` 继续封存。

### 阶段 5｜月度个性化洞察 Go/No-Go

- Production 继续使用确定性 `AnalysisNarrative`。
- 候选只在本地或隔离 Preview，输入限于月度聚合、趋势、证据摘录和日期引用。
- 候选输入从当前 `JournalPeriodReport` 材料优先级投影；现有旧五维 `/analysis` 聚合不承担评测数据源。
- 少于 3 个记录日或 3 条保存成果时模型调用为 `0`。
- 最多 6 个合成边界月与 6 个已同意真实用户月，调用上限 12、并发 1、重试 0。
- 本计划只形成 Go/No-Go；Go 仅授权下一轮接入设计。

## 3. 并行与发布顺序

开发并行分为三条：

1. 数据合同、留存与恢复观测；
2. Playwright、临时数据库与零模型证明；
3. Golden Set／月度候选的隐私、启动卡和离线资产。

生产发布保持串行：阶段 1 → 阶段 2 → 阶段 4。每次先完成本地门和 Preview，再进入 Production；阶段 3 以私有评审资产为主，阶段 5 停在候选结论。

## 4. 验证门

每个代码阶段至少通过相关专项测试，并在发布前通过：

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npx prisma validate`
- `npm run docs:check`
- `git diff --check`

阶段 2 还要求浏览器全套本地连续三次通过，自动 E2E 模型实际调用为零。阶段 4 每批要求 API、SSE、错误码、事件顺序和数据库结果兼容。

## 5. 授权与停止点

本计划已授权：计划内 Production 只读数据访问、提交、推送、Preview 部署，以及阶段 1、2、4 通过验证门后的 Production 发布。

继续使用独立停止门：

- 数据库迁移；
- GI-088 新调用和生成式策略发布；
- 月度 AI 洞察上线；
- 计划外模型预算；
- 删除分支、worktree、私有现场或其他破坏性清理。

当前结果状态统一为 `待验证`。任何核心回归、内容丢失、恢复失败、权限回归或线上指标恶化都会暂停对应批次并回退到上一正式 deployment。

## 6. 当前进度

| 阶段 | 状态 | 当前证据 |
|---|---|---|
| 0. 保护现场与工作线 | 实施中 | 新 worktree 与分支已建立；Production 基线提交 `5c36b49` 已完成；原 GI-088 分支状态冲突待封存 |
| 1. 数据口径 v2 | 待验证 | 只读审计完成，等待实现 |
| 2. 零模型 E2E | 待验证 | 只读审计完成，等待实现 |
| 3. Golden Set v2 | 待验证 | 数据治理审计进行中，真实样本数量待只读核验 |
| 4. 主链重构 | 待验证 | 等待阶段 2 回归保护 |
| 5. 月度洞察评估 | 待验证 | 数据源差异已入账，候选尚未运行 |

问题、归因和处理状态统一记录在[问题台账](../../../artifacts/production-evidence-hardening/2026-08-19/issue-ledger.md)。
