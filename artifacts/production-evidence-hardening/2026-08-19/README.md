# Daily Light Production Evidence Hardening 证据索引

- 文档职责：证据索引
- 文档状态：已确认·实施中
- 最后核验：`2026-08-21`
- 权威入口：[`DL-PROD-20260819`](../../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

## 当前资产

| 资产 | 状态 | 说明 |
|---|---|---|
| [问题台账](./issue-ledger.md) | 现役 | 记录事实、产品判断、Codex 评估、假设和处理状态；统一血缘发布由 `PEH-043`～`PEH-045` 闭环 |
| Production 发布血缘 | 统一血缘已发布·线上验证通过 | 当前正式 deployment `dpl_ACg3o7tqmwCJzU6Nzx3qz3B28prW` 运行 `complete_response_v1_9 + deepseek-v4-pro`，源码 main `e3284b5`；上一正式与阶段 1 deployment 分别保留为即时和更深回退 |
| [单一发布血缘集成](./production-lineage-integration/README.md) | 已完成·Production live verified | PR #51 合入统一血缘，PR #52 封存 source-main；Production 第二次候选验收、正式切流和线上零模型回归均通过 |
| [数据口径 v2 证据](./analytics-contract-v2/README.md) | 阶段 1 证据已封存·统一血缘已发布 | 阶段 1 数据口径随统一血缘源码进入 Production；本轮候选与线上身份验证通过，既有数据口径证据继续承担专项职责 |
| [零模型 E2E 证据](./e2e-zero-model/README.md) | 已合入 main·统一血缘已发布 | PR #41 合入 `77de8d1`；PR #43 热修合入 `795417d`；统一血缘 PR #51 合入 `0f483567`，main CI 与 Production 线上零模型回归均通过 |
| [Golden Set v2](./golden-set-v2/README.md) | 已合入 main·收集 pending | PR #44 已合入 main `ef7bf94`；`P0=0 / P1=0 / P2=3`，完整轨迹 `0/30`，正文开关保持关闭，Production 正文读取 `0`、模型调用 `0` |
| [主链重构证据](./stage4-journal/README.md) | 第三批与治理收口已合入 main·统一血缘已发布 | PR #48 合入 main `dedf094`，PR #49 治理收口合入 main `8f7ae40`，独立终审 `P0=0 / P1=0 / P2=1`；Stage 4 工程成果已随统一血缘进入 Production，详见 `PEH-033`～`PEH-045` |
| [月度洞察 Go/No-Go](./monthly-insight-v1/README.md) | No-Go / insufficient_evidence | 当前成果物投影与 6 条合成合同已验证；真实用户月 `0`、模型调用 `0`，Production 继续使用确定性 `AnalysisNarrative` |

## 隐私边界

真实用户话题、对话、事件卡、日记正文、身份映射和逐例原文裁决只进入本目录下 Git 排除的 `.private`。目录权限保持 `0700`，文件权限保持 `0600`；公开证据只保存不可逆匿名编号和必要统计。
