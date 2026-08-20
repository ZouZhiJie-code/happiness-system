# GI-088｜完整回应优先 v1.1 生产合同复验交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈重构总 Map](../../../docs/generative-interview-refactor-map.md)

## 结论

运行身份 `2026-08-20.gi088-complete-response-first-v1-1-production-contract-quality-v1` 已完成同一开发 `3`＋回归 `5`，预算消费 `8/8`，重试、恢复和回退均为 `0`。

八次供应商请求均为 HTTP 200、`finishReason=stop`、目标模型正确、Thinking 关闭、单例低于 15 秒且未触发 `1280` Token 截断；中位耗时 `7757ms`、最长 `10843ms`。生产结构合同只有 `2/8` 有效，另外 `6/8` 因事实数量、事件边界、状态字段、来源或可见表达合同失败。

两个合同有效案例均只复述用户已经明确说出的结论后结束，没有交付新的理解或继续入口。Codex 因此将本次生产合同复验判为质量 `No-Go`。产品负责人裁决继续基于私有完整原文和实际输出完成；本页不保存正文。

## 根因与下一步

已确认根因是旧事件中心输出合同同时承载自然回应、事实抽取、事件分类、成果判断、状态动作、来源编号和页面表达。后台结构主导了生成，并用“当前问题已回答”压过“选择下一层未答目标”。

下一候选为[完整回应优先 v1.2 最小生产合同](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-2-minimal-envelope.md)：保留单次完整回应负责人，只把本回合事实、问题、停止和纠正的最少状态随同返回。模型、Thinking、Token、数据和速度门保持固定。

公开启动卡与回执：

- [启动卡](./complete-response-first-v1-1-production-contract-quality-v1-start-card.json)
- [结果回执](./complete-response-first-v1-1-production-contract-quality-v1-receipt.json)
- [阶段账](./complete-response-first-v1-1-production-contract-stage-ledger-v1.json)

页面部署、Preview 与 Production 变更均未运行。Production 保持 `event_centered + baseline`。
