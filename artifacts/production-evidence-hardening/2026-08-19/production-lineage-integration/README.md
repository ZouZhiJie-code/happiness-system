# GI-088 v1.9 与五阶段 main 单一发布血缘集成

- 文档职责：证据索引
- 文档状态：已确认·实施中
- 最后核验：`2026-08-21`
- 权威入口：[`DL-PROD-20260819`](../../../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

## 1. 产品目标

形成一条同时包含当前 Production GI-088 v1.9 用户体验与五阶段 main 工程成果的发布候选。候选只在完整本地门和 Preview 门通过后进入发布裁决。

## 2. 冻结身份

- 候选分支：`codex/production-lineage-integration-20260821`
- 候选基线：`origin/main@624b403b81a7b4774cf8617973a5663ccf16cea0`
- Production 功能来源：`d8dfae7bb05987f906d6917ed0e7343829136c2f`
- 当前 Production：`dpl_B9P64xCMMGtSR6CKAjNzRFdav39p`
- 当前策略与模型：`event_centered + complete_response_v1_9 + deepseek-v4-pro`
- 回退目标：`dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`

## 3. 范围与门禁

迁入可见回应、后台事实任务、恢复与 Pro 模型合同；保留阶段 1～4 数据口径、零模型 E2E、同意边界、可靠回合、前端恢复和日记内容保护。验证包含生成式专项、后台任务、真实 PostgreSQL、全量工程门、零模型 E2E 和独立 Preview。

本地自动门模型调用 `0`。Production 正文读取、数据库迁移、环境变量修改和正式切流均为 `0`。任何核心合同失败都会暂停候选。

## 4. 当前结果

本地候选代码节点为 `e869cf194b34de598be3ba3f9ccefc9f85cfadb1`。生成式专项 `325/325`、真实 PostgreSQL `3/3`、全量 `3401/3401`、Production build `77/77` 与零模型 E2E `11/11` 均通过；E2E `AIRequestLog=0`、Trace `12`、模型违规 `0`，临时 Schema 已删除。当前状态为 `local gates passed / Preview pending / Production unchanged`。

本地公开回执见 [`local-validation-receipt.json`](./local-validation-receipt.json)。旧 Production 发布运行器继续保留原候选身份，新候选会生成独立的提交身份、哈希和运行回执。

过程问题与裁决见 [`PEH-044`](../issue-ledger.md)。
