# Board 7 评测与候选资产索引

- 文档职责：历史证据
- 文档状态：历史证据
- 最后核验：`2026-08-16`
- 权威入口：[GI-088 历史真实金标库当前入口](../generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md)

本目录保存 Board 7 的候选、诊断、真人轨迹、Prompt／Skill 迭代和工程底座历史。GI-088 当前状态与下一停止点统一从[生成式访谈总 Map](../../docs/generative-interview-refactor-map.md)读取。

v8r2 的 commit、执行指纹、静态门、READY Preview 和 `running 0/12` 只保留 `2026-08-10` 的运行身份；阶段 B、C、C2、C3 及历史真实金标库的后续事实由当前证据包承担。

## 1. GI-088 真人评测历史

| 时期 | 包级入口 | 历史价值 |
|---|---|---|
| v8r2 | [评测底座加固与初始化快照](./2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md) | 工程底座、不可变版本与初始化历史 |
| v8r1 | [最终 12 项候选与 A1 阻断](./2026-08-10-gi088-human-eval-v8r1-final12/README.md) | 控制意图误停单例阻断 |
| v8 | [统一问前决策](./2026-08-10-gi088-human-eval-v8-question-decision-pro/README.md) | `1/4 early_stopped` 产品通过历史 |
| v7r1～v7r4 | [v7r1 Prefix](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/README.md)、[v7r2 Ark](./2026-08-10-gi088-human-eval-v7r2-ark-flash/README.md)、[v7r3 状态底座](./2026-08-10-gi088-human-eval-v7r3-deterministic-state/README.md)、[v7r4 Pro](./2026-08-10-gi088-human-eval-v7r4-pro/README.md) | 平台、状态、延迟与真人 No-Go 血缘 |
| v1～v7 | [v1 真人批次](./2026-08-09-gi088-human-eval-v1/README.md)、[v2 空内容诊断](./2026-08-09-gi088-human-eval-v2-diagnostic/README.md)、[v7 连续性底座](./2026-08-09-gi088-human-eval-v7-continuity-baseline/README.md) | 运行器演进、失败恢复、阶段转场和单问合同 |
| v0 | [1600 Token 上限与技术失败](./2026-08-08-gi088-human-eval-v0/README.md) | 原始技术失败与恢复边界 |

## 2. GI-081～087 诊断历史

- [GI-081 六题 A/B 诊断](./2026-08-06-board7a-real-output-ab-v1/README.md)
- [GI-083 v0](./2026-08-06-board7a-chat-e2e-single-v0/README.md)与[GI-083 v1](./2026-08-07-board7a-chat-e2e-single-v1/README.md)
- [GI-084 Prompt／Skill v0](./2026-08-07-board7b-prompt-skill-v0/README.md)及 v0.1～v0.4 目录
- [GI-085 semantic-frame-first](./2026-08-07-board7b-semantic-frame-v1/README.md)
- [GI-086 Thinking 能力校准](./2026-08-07-board7b-thinking-capability-v1/README.md)
- [GI-087 共同任务与上下文资格审计](./2026-08-07-board7b-working-task-v1/README.md)

## 3. 早期历史目录

`2026-07-28/`、`2026-07-29/`、`2026-07-30/`、`2026-08-01/` 和 `2026-08-02/` 保存架构比较、语义框架、MVP 候选、恢复、事件日志和早期质量诊断。

[完整文档与包级台账](../../docs/maintenance/2026-08-16-document-inventory.csv)保存本目录 502 份 Markdown 的逐项职责和处置建议。原始 manifest、结果、裁决、Bad Case 与指纹继续在各版本目录内保持原位。
