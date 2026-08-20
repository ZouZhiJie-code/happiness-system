# GI-088｜回应优先 v2.6 首题结果交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-19`
- 权威入口：[v2.6 执行专项](../../../docs/plans/2026-08-19-gi088-response-first-v2-6-low-effort-audited-high.md)

## 当前结果

**首题速度门 No-Go，产品语义裁决待确认。**

v2.6 首题完整返回，来源、状态和问题审计合同有效。冻结 Low＋High 总耗时为 `60.009s`，超过 60 秒硬门 `9ms`，因此预设速度门已经触发停止。正文具备语义评价条件；Codex 初评为 fail，产品负责人最终裁决仍为 pending。

- 候选：`2026-08-19.gi088-response-first-v2-6-low-effort-audited-high`
- 运行：`2026-08-19.gi088-response-first-v2-6-low-effort-audited-high-quality-v1`
- 计划指纹：`53e98f8de3e262e7cd1670f1ceb46cfff68ddf672f7cd67b4458e9b5e6671faa`
- 首题：`RPR-REAL-19-CORRECTION`
- 技术与合同：HTTP 200、目标模型正确、`finishReason=stop`、校验问题 `0`
- 耗时：High `56.668s`；冻结 Low `3.341s`；完整两段 `60.009s`
- Token：prompt `2299`、completion `3462`、reasoning `3132`、总计 `5761`
- 可见追加：一处可纠正理解，问题 `0`
- 问题审计：候选 `1`；`existingAnswer=null`；`worthAsking=false`；最终未显示问题
- 调用：`1/6`，其余 `5 not_run`；重试、恢复、回退均为 `0`

## 语义初评与裁决边界

Codex 初评为 fail，包含两项依据：

1. High 的可见理解重复了冻结 Low 已经表达的含义，没有形成新的可见价值；
2. 内部感受候选在有效用户消息中已有对应答案，审计仍记录为 `existingAnswer=null`。该候选因 `worthAsking=false` 没有进入可见问题，因此用户未收到重复追问，审计的自答判断仍未达到预期。

产品负责人需要在受控对话中查看完整相关用户输入、冻结 Low 和实际 High 后作最终语义裁决。公开证据只保存摘要、指标与哈希，不保存用户或模型正文。

## 公开证据哈希

- 请求指纹：`e4bd5c53e9edecba7d7548300cb2f2860693933e83dbdd9c6eabecdb9c767711`
- 冻结 Low 哈希：`df15169aca894d310e3e686dc1d105827e81983b823ab15d25e1b8761e2059c8`
- High 响应哈希：`c84d1ae0b3d13c25f19f14b28f125e9855228bbd01654c1d8933a95f5b0bd93b`
- 可见理解哈希：`a56a73b3d633574bcb4160848c5cfe8474394953bc8d7bbdc74fb7218d97a38a`

## 当前停止点

速度硬门已触发，其余五题保持 `not_run`。页面接入、提交、推送、部署和 Preview 均为 `not_run`；Production 继续使用 `event_centered + baseline`。当前只等待产品负责人完成首题语义裁决，后续方案保持开放。

公开证据：[启动卡](./response-first-v2-6-low-effort-audited-high-quality-v1-start-card.json)、[结果回执](./response-first-v2-6-low-effort-audited-high-quality-v1-receipt.json)、[阶段账](./response-first-v2-6-stage-ledger-v1.json)。私有原文和逐项评价继续保存在 Git 排除的受控目录。
