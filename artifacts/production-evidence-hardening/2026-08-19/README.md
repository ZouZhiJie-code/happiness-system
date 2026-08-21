# Daily Light Production Evidence Hardening 证据索引

- 文档职责：证据索引
- 文档状态：已确认·实施中
- 最后核验：`2026-08-21`
- 权威入口：[`DL-PROD-20260819`](../../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

## 当前资产

| 资产 | 状态 | 说明 |
|---|---|---|
| [问题台账](./issue-ledger.md) | 待验证 | 记录事实、产品判断、Codex 评估、假设和处理状态 |
| Production 发布血缘 | 阶段 1 基线已封存·当前 GI-088 v1.9 | 阶段 1 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5` 保留为回退目标；当前正式域名运行 GI-088 v1.9 `dpl_B9P64xCMMGtSR6CKAjNzRFdav39p`，策略 `complete_response_v1_9`、模型 `deepseek-v4-pro`。Stage 4 尚未部署，跨分支对账见 `PEH-043` |
| [单一发布血缘集成](./production-lineage-integration/README.md) | 产品 pass·source-main 合并已授权·Production pending | 基于 main `624b403` 迁入 GI-088 v1.9 可见回应、后台任务与 Pro 模型合同；本地、双 CI、零模型 E2E 与 Preview 通过，产品负责人授权合并 PR #51；Production 保持 `dpl_B9P...` |
| [数据口径 v2 证据](./analytics-contract-v2/README.md) | 阶段 1 发布证据已封存·当前 Production 版本复验 pending | 已封存阶段 1 CI、Preview、只读数据库对账、正式域名核心 smoke 和线上日志；当前 GI-088 Production 源提交不包含该 main 节点，整合后重新验收 |
| [零模型 E2E 证据](./e2e-zero-model/README.md) | 已合入 main·热修复远程门与 main CI 全绿·Preview 通过至需更新·Production 集成 pending | PR #41 合入 `77de8d1`；PR #43 final head 两套 CI 全绿并合入 `795417d`，main CI 全绿；产品源码 `0`。当前 Production 为 GI-088 v1.9 `dpl_B9P64xCMMGtSR6CKAjNzRFdav39p`，Stage 2 等待统一血缘集成 |
| [Golden Set v2](./golden-set-v2/README.md) | 已合入 main·收集 pending | PR #44 已合入 main `ef7bf94`；`P0=0 / P1=0 / P2=3`，完整轨迹 `0/30`，正文开关保持关闭，Production 正文读取 `0`、模型调用 `0` |
| [主链重构证据](./stage4-journal/README.md) | 第三批与治理收口已合入 main·Preview smoke blocked·Production 血缘整合 blocked | PR #48 已合入 main `dedf094`，PR #49 治理收口已合入 main `8f7ae40`，独立终审 `P0=0 / P1=0 / P2=1`。当前 Production 为独立 GI-088 v1.9 deployment；Stage 4 尚未上线，发布前先完成两条血缘整合，详见 `PEH-033`～`PEH-043` |
| [月度洞察 Go/No-Go](./monthly-insight-v1/README.md) | No-Go / insufficient_evidence | 当前成果物投影与 6 条合成合同已验证；真实用户月 `0`、模型调用 `0`，Production 继续使用确定性 `AnalysisNarrative` |

## 隐私边界

真实用户话题、对话、事件卡、日记正文、身份映射和逐例原文裁决只进入本目录下 Git 排除的 `.private`。目录权限保持 `0700`，文件权限保持 `0600`；公开证据只保存不可逆匿名编号和必要统计。
