# GI-088｜完整回应优先 v1.6 后台任务工程接入交接

- 文档职责：历史证据
- 文档状态：待验证
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么形成这份交接

v1.6 可见回应与后台事实整理都已完成离线八题，工程阶段随后把“先给用户完整回应，再异步整理事实与纠正”接入隔离策略。当前本地验证证明任务创建、调用记账、顺序写入、恢复和失败隔离能够按合同工作；产品负责人对两组真实输出的裁决和真人页面体验仍是进入 Preview 与 Production 的独立门。

## 已确认的工程事实

| 项目 | 结果 |
|---|---|
| 接入范围 | 只在 `complete_response_v1_6` 可见生成成功后建立后台事实任务；Production baseline 不受影响 |
| 用户可见路径 | 用户原话、完整可见回应和后台任务在同一事务提交；页面响应结束后才触发后台排队处理 |
| 调用预算 | 每个后台任务最多一次模型调用；调用前写入已开始状态；自动重试、恢复调用和回退均为 0 |
| 结果恢复 | 模型结果先持久保存为待写入结果；进程在写入前中断时，后续只重放确定性写入，不再次调用模型 |
| 中断处理 | 模型调用中断形成失败记录；后续任务可以继续，不以重复调用填补本次结果 |
| 顺序与写入权 | 同一会话按创建顺序处理；分支、用户消息或可见回复失去当前写入权时取消落库 |
| 事实与纠正 | 只写入有用户消息和逐字引用支持的事实；修订会使目标事实退出有效集合，并标记被替代的旧 AI 解释 |
| 可见边界 | 后台任务不能追加、改写或撤回用户已经看到的回应 |
| 数据结构 | 复用现有 `AIGenerationTrace` 持久状态，不需要数据库迁移；可见主 Trace 使用版本 1，后台任务使用版本 2 |

## 本地验证结果

| 门禁 | 结果 |
|---|---|
| 专项测试 | `84/84` 通过 |
| 全量测试 | `451` 个测试文件通过、`2` 个按既有条件跳过；`3649` 条测试通过、`10` 条跳过 |
| TypeScript | 通过 |
| ESLint | `0` error；`45` 条既有 warning；本次新增文件 `0` warning |
| Prisma | 主应用与评测两套 schema 均通过校验 |
| Production build | 通过；保留 `16` 条既有 Turbopack 动态文件系统 warning，本次后台接入未引入对应路径 |
| 模型调用 | 工程接入阶段 `0`；沿用已封存的离线可见与后台八题证据 |

## 当前结论与停止点

- 工程接入达到隔离 Preview 的本地技术门。
- v1.6 可见回应仍为 Codex `7 pass / 1 minor / 0 fail`、产品裁决 pending。
- v1.6 后台事实整理仍为 Codex `7 pass / 1 minor / 0 fail`、产品裁决 pending。
- 产品负责人完成两项原文裁决后，才进入隔离 Preview 的真实页面、连续回合和失败恢复验收。
- 页面 Preview、提交、推送、部署和 Production 切换均保持 `not_run`；Production 继续使用 `event_centered + baseline`。

## 证据入口

- [后台事实离线结果](./complete-response-first-v1-6-background-facts-quality-v1-handoff.md)
- [后台事实离线阶段账](./complete-response-first-v1-6-background-facts-stage-ledger-v1.json)
- [工程接入阶段账](./complete-response-first-v1-6-background-integration-stage-ledger-v1.json)
- [冻结执行计划](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-6-background-state-readiness.md)
