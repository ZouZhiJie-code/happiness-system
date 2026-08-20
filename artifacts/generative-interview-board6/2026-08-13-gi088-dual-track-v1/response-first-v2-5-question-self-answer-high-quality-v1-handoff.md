# GI-088｜回应优先 v2.5 首题技术超时交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-19`
- 权威入口：[v2.5 执行专项](../../../docs/plans/2026-08-19-gi088-response-first-v2-5-question-self-answer-audit.md)

## 当前结果

v2.5 首题已运行并触发 60 秒技术硬门。预检确认目标模型可用；正式请求收到 HTTP 200，但在硬门到达时正文仍为 0 字符，因此问题自答审计、可见理解和问题质量均没有可评价输出。

- 候选：`2026-08-19.gi088-response-first-v2-5-question-self-answer-high`
- 运行：`2026-08-19.gi088-response-first-v2-5-question-self-answer-high-quality-v1`
- 计划指纹：`2d82da338d4034069e800fbad102fc7b74c82b29262ac1759ebfcdb254c322d7`
- 预检：HTTP 200，目标模型 `deepseek-v4-pro` 可用
- 首题：`RPR-REAL-19-CORRECTION`
- 请求结果：HTTP 200，`TIMEOUT`，正文 `0` 字符
- 耗时：High `60.013s`；冻结 Low＋High `63.354s`
- Token 与结束原因：正文缺失，供应商未返回可用 Token 统计和 `finishReason`
- 语义评价：`not_evaluated`
- 调用：`1/6`，其余 `5 not_run`；重试、恢复、回退均为 `0`

## 归因边界

### 已确认事实

目标模型在预检时可用，正式请求也建立成功。当前失败发生在正文等待阶段，完整两段超过 60 秒硬门，运行器按预设规则停止后续五题。

### 产品判断

v2.5 只能形成技术 No-Go。正文为空意味着当前证据无法判断候选问题自答审计是否减少重复追问，也无法判断 High 的自然度、来源忠实度和信息增量。

### 待验证假设

v2.5 在 `reasoningEffort=high` 下的工作量可能使首题无法在 60 秒内完成。下一候选只把 High 的 `reasoningEffort` 从 `high` 调整为 `low`，用于验证完整交付速度与语义质量能否同时达到门槛。

## 当前停止点

v2.5 以首题技术超时停止，剩余 `5` 次保持 `not_run`。页面接入、提交、推送、部署和 Preview 均为 `not_run`；Production 继续使用 `event_centered + baseline`。

公开证据：[启动卡](./response-first-v2-5-question-self-answer-high-quality-v1-start-card.json)、[结果回执](./response-first-v2-5-question-self-answer-high-quality-v1-receipt.json)、[阶段账](./response-first-v2-5-stage-ledger-v1.json)。用户正文、Low、模型请求和私有运行记录继续保存在 Git 排除的受控目录。
