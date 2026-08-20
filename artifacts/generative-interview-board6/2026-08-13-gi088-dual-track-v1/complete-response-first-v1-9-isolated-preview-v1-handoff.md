# GI-088｜完整回应优先 v1.9 隔离 Preview 验收交接

- 文档职责：当前执行交接
- 文档状态：待验证
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么进入产品验收

v1.9 只调整用户控制范围：局部拒答同时带有继续／换方向时继续对话；明确整轮停止时收住。新的隔离 Preview 已用完整四轮因果链重放，Codex 初评 `4 pass / 0 minor / 0 fail`。原失败句没有进入检查点，AI 换到一个新的、有原文依据的焦点继续。

当前仍由产品负责人依据完整原文和实际输出作最终裁决。Production 保持 `event_centered + baseline`。

## 已确认事实

| 项目 | 结果 |
|---|---|
| 运行身份 | `2026-08-20.gi088-complete-response-first-v1-9-isolated-preview-v1` |
| 部署 | `dpl_J4oYShrzC9rtTMyUDFbew485Gvm4`，Preview Ready，提交 `82214e5` |
| 运行策略 | 分支 Preview `complete_response_v1_9`；模型 `deepseek-v4-pro`；Production baseline |
| 连续链 | 普通表达、纠正、明确深挖、局部拒答＋换方向继续共四轮 |
| Codex 初评 | `4 pass / 0 minor / 0 fail` |
| 状态结果 | 最终 `phase=event_recording`、`checkpoint=null`、`responseKind=question`，继续输入仍可用 |
| 等待时间 | `10880 / 10387 / 11505 / 9545ms`；中位 `10633.5ms`、最大 `11505ms` |
| 速度门 | 单例 `≤15s` 通过；理想中位 `≤6s` 未通过，记录为独立发布风险 |
| 预算 | 家族可见调用 `15/15`；重试、恢复、回退均为 `0` |
| 产品裁决 | `pending` |

## 质量边界

- 语义验收候选：四轮完整原文与实际输出已在本任务对话逐例交付。
- 真正停止：历史 v1.6 Preview 实际通过；v1.9 自动回归验证明确停止仍零问题。本轮剩余可见预算用于完整连续链，未追加真人停止调用。
- 关系表达：历史 v1.6 为 minor；完整回应 v1.1 离线真实批次的关系题为 pass。本轮 v1.9 没有改变关系问题选择方法，未用已耗尽预算重复调用。
- 后台：本轮四条后台任务未回读，不承担当前可见语义 Go 证据。

## 当前停止点

等待产品负责人逐例裁决。若四轮均通过，则按已授权范围进入 Production 快照、备份、回退准备与发布；若任一轮 fail，Production 保持 baseline，并停止扩展调用预算。

## 证据

- [当前专项](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-9-local-boundary-continue.md)
- [Preview 阶段账](./complete-response-first-v1-9-isolated-preview-stage-ledger-v1.json)
- 私有原文证据：`.private/complete-response-first-v1-9-isolated-preview-v1/technical-smoke-and-codex-review.json`，权限 `0600`，SHA-256 `feacbc123e798e8de482fd12c2e4e0679ab9fca88520d2b7898e1459e9c0f46b`
