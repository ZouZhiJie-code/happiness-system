# GI-088｜完整回应优先 v1.2.1 JSON 模式单因素结果

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么停止 v1.2.1

v1.2.1 省略了 Provider `response_format=json_object`，八次请求都收到了非空正文，HTTP、结束状态、速度、Thinking 和 Token 也保持稳定；但 `8/8` 都没有形成可接受的最小结构。

六条正文缺少完整顶层 `response` 结构，常见开头直接从 `":"` 进入内容；另外两条把自然语言与 JSON 混写，或把 `correction` 放错层级。关闭 Provider JSON 模式因此没有解决稳定结构输出，当前技术门为 No-Go。

## 已确认事实

| 项目 | 结果 |
|---|---|
| 运行身份 | `2026-08-20.gi088-complete-response-first-v1-2-1-json-mode-off-quality-v1` |
| 预算 | `8/8`；重试、恢复、回退均为 `0` |
| HTTP／结束原因 | `8/8` 为 HTTP 200、`finishReason=stop` |
| Provider 请求 | `responseFormat=null`、Thinking disabled、Temperature `0.2`、`1280` Token |
| 合同有效 | `0/8`；全部为 `INVALID_SCHEMA` |
| 原始正文 | `8/8` 非空并保存于 `0600` 私有账本；公开证据只保留状态与哈希 |
| 耗时 | 中位 `5402ms`，最长 `11488ms`；八次都低于 `15s` |
| Token | 最高 completion `542/1280`；`0` 次 length |
| 语义评审 | 未进入；模型正文无法稳定进入产品可见合同 |
| 页面／Preview／Production | 均未进入；Production 保持 `event_centered + baseline` |

## 下一方向

首个可见调用改成纯文本完整回应，删除 JSON 和状态结构职责；程序只从最终文本确定是否存在一个问题或明确停止，用户原话继续先保存。后台状态整理另用最多一次调用，不能阻断或改写本轮可见回应。

这个方向继承 v1.1 纯文本 `8/8` 完整返回、Codex `7 pass / 1 minor / 0 fail` 的历史证据；新的生产候选仍需同一八题复验并交产品负责人逐题裁决。

## 证据

- [公开启动卡](./complete-response-first-v1-2-1-json-mode-off-quality-v1-start-card.json)
- [公开回执](./complete-response-first-v1-2-1-json-mode-off-quality-v1-receipt.json)
- [阶段账](./complete-response-first-v1-2-1-json-mode-off-stage-ledger-v1.json)
- [v1.2.1 执行计划](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-2-1-json-mode-off.md)
