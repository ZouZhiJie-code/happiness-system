# Daily Light Production Evidence Hardening 证据索引

- 文档职责：证据索引
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[`DL-PROD-20260819`](../../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

## 当前资产

| 资产 | 状态 | 说明 |
|---|---|---|
| [问题台账](./issue-ledger.md) | 实施中 | 记录事实、产品判断、Codex 评估、假设和处理状态 |
| Production 发布血缘 | 已封存 | `a86a4ba` → tree `70ca8f4` = main merge `305f209` → `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5` → `https://dailylight.chat`；回退目标 `dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2` READY |
| [数据口径 v2 证据](./analytics-contract-v2/README.md) | Production 已发布·核心回验通过·管理员成功读取 pending | 已封存最终 CI、Preview、只读数据库对账、正式域名核心 smoke 和线上日志；公开回执保持零正文 |
| [零模型 E2E 证据](./e2e-zero-model/README.md) | 已合入 main·热修复远程门与 main CI 全绿·Preview 通过至需更新·Production blocked | PR #41 合入 `77de8d1`；PR #43 final head 两套 CI 全绿并合入 `795417d`，main CI 全绿；产品源码 `0`，Production 继续使用 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5` |
| [Golden Set v2](./golden-set-v2/README.md) | 已合入 main·收集 pending | PR #44 已合入 main `ef7bf94`；`P0=0 / P1=0 / P2=3`，完整轨迹 `0/30`，正文开关保持关闭，Production 正文读取 `0`、模型调用 `0` |
| 主链重构证据 | 第一批与画像热修已合入 main·第二批 source head 远程门全绿·最终回执头 pending·Production P1 blocked | PR #47 source head `7976c1c` 的 push／PR CI attempt 1 全绿，Preview `dpl_FCiuGt6fnLt9hUm5uWnNHwcvWqHd` Ready；受控 smoke 通过匿名保护、固定账号登录、登录态和列表 HTTP `200`，随后因本地解析器误读 `items` 合同停止，session start `not_run`、重试 `0`；详见 `PEH-033`～`PEH-036` |
| [月度洞察 Go/No-Go](./monthly-insight-v1/README.md) | No-Go / insufficient_evidence | 当前成果物投影与 6 条合成合同已验证；真实用户月 `0`、模型调用 `0`，Production 继续使用确定性 `AnalysisNarrative` |

## 隐私边界

真实用户话题、对话、事件卡、日记正文、身份映射和逐例原文裁决只进入本目录下 Git 排除的 `.private`。目录权限保持 `0700`，文件权限保持 `0600`；公开证据只保存不可逆匿名编号和必要统计。
