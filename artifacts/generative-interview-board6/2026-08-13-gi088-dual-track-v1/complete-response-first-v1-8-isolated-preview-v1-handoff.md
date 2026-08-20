# GI-088｜完整回应优先 v1.8 隔离 Preview 交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么形成 No-Go

v1.8 在真实连续链中完成了三项修复验证：普通表达、纠正和“跳过上一题后继续深挖”均由 Codex 初评为 `pass`。相邻控制表达“这个方向不想回答，换个方向继续聊”随后触发第一检查点，实际回应只复述并保存，未兑现换方向继续。

当前证据说明明确推进方法本身可以生效，用户控制范围仍存在确定性冲突：局部拒答被旧规则识别为整轮停止，正向的“换方向继续”没有取得优先级。因此 v1.8 Preview 质量门为 `No-Go`，Production 保持 `event_centered + baseline`。

## 已确认事实

| 项目 | 结果 |
|---|---|
| 运行身份 | `2026-08-20.gi088-complete-response-first-v1-8-isolated-preview-v1` |
| 部署 | `dpl_AnbbXcx2qMZe4b59tB1wsbUdqTi9`，Ready，提交 `50607a726584d953543dc4321d5c99bfcb9ecd8f` |
| Preview 策略 | `event_centered + complete_response_v1_8 + deepseek-v4-pro` |
| 可见调用 | 本轮 `4`，家族累计 `11/15`，剩余 `4`；重试、恢复、回退均为 `0` |
| 核心链 | 普通表达 `pass`；纠正 `pass`；明确继续深挖 `pass` |
| 相邻控制 | 局部拒答并要求换方向继续为 `fail`；实际进入 `checkpoint_one` |
| 等待时间 | `12307 / 12479 / 14838 / 14566ms`；均低于单例 `15s` 门，整体明显高于约 `5～6s` 理想目标 |
| Codex 初评 | `3 pass / 0 minor / 1 fail` |
| 产品裁决 | `pending` |
| Production | `event_centered + baseline`，未改变 |

## 根因与下一步

程序当前用“不想回答”等词判断显式停止，没有同时识别“这个方向”限定范围和“换方向继续”的正向动作。下一候选只修复用户控制范围：局部拒答＋继续视为跳过当前问题，整轮停止表达继续收束。具体新方向与回应内容仍由模型生成。

下一专项：[v1.9 局部边界与继续优先级](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-9-local-boundary-continue.md)。

## 证据

- [v1.8 阶段账](./complete-response-first-v1-8-isolated-preview-stage-ledger-v1.json)
- 私有原文证据：`.private/complete-response-first-v1-8-isolated-preview-v1/technical-smoke-and-codex-review.json`，权限 `0600`，SHA-256 `2c2b8304d1910fd01ce6840aeb1460d418921ef2ac87452b46ba7cfac90d7dd3`
