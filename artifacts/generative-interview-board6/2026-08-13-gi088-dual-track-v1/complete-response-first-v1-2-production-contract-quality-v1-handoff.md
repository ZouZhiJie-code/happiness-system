# GI-088｜完整回应优先 v1.2 最小合同结果交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么停止 v1.2

v1.2 已经把模型输出从旧完整事件状态收缩为“完整回应＋互动类型＋最多四条本轮事实＋纠正来源”。这一步让通过合同的输出恢复了完整、自然的单气泡正文，但同一批八次请求中有四次在 HTTP 200、`finishReason=stop`、远低于 Token 上限的情况下产生了无法解析的 JSON；本地错误均为 `Unexpected end of JSON input`。

因此 v1.2 当前无法作为页面候选。失败集中在结构传输稳定性，不能归因于超时或 Token 截断。

## 已确认事实

| 项目 | 结果 |
| --- | --- |
| 运行身份 | `2026-08-20.gi088-complete-response-first-v1-2-production-contract-quality-v1` |
| 预算 | `8/8`；重试、恢复、回退均为 `0` |
| HTTP／结束原因 | `8/8` 为 HTTP 200、`finishReason=stop` |
| 合同有效 | `4/8` |
| JSON 解析失败 | `4/8`，均为 `Unexpected end of JSON input` |
| 耗时 | 中位 `3497.5ms`，最长 `6376ms`；八次都低于 `15s` |
| Token | 最高 completion `373/1280`；`0` 次 length |
| 有效互动 | `respond / ask / stop / respond` 各按实际结果保存 |
| 页面／Preview／Production | 均未进入；Production 保持 `event_centered + baseline` |

四条有效正文继续保留在 `0600` 私有账本中，等待后续技术稳定后与新候选按完整原文评审。公开回执只保存状态、指标、数量和哈希。

## 下一单因素

下一候选只取消 Provider 请求中的 `response_format=json_object`，继续要求模型输出同一份严格 JSON，并继续使用同一本地解析、同一 Prompt、模型、Thinking、Temperature、`1280` Token、八题和一次调用。

这个比较用于判断：当前四次 `Unexpected end` 是否由供应商 JSON 模式触发。结构语义、问题策略和状态映射保持不变。解析失败时增加原始响应的私有诊断保存，不改变候选行为。

## 证据

- [公开启动卡](./complete-response-first-v1-2-production-contract-quality-v1-start-card.json)
- [公开回执](./complete-response-first-v1-2-production-contract-quality-v1-receipt.json)
- [阶段账](./complete-response-first-v1-2-production-contract-stage-ledger-v1.json)
- [v1.2 执行计划](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-2-minimal-envelope.md)
