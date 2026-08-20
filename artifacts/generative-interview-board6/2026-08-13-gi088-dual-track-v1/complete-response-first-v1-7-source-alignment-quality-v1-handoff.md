# GI-088｜完整回应优先 v1.7 新案例稳定性结果

- 文档职责：历史证据
- 文档状态：待确认
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么停在产品裁决

v1.7 已把 v1.6 暴露的引用标点脆弱点收进程序确定性边界：实质字符连续且唯一匹配时，允许忽略空白和标点定位来源，最终证据仍从真实用户原文截取。上一条失败原始结果的确定性重放已通过；本次八条新后台输出本身均返回逐字引用，因此实际对齐次数为 `0`。

本轮补两条可见回应并重跑八条后台事实，新增调用 `10/10` 全部技术有效。Codex 对八条可见回应初评 `6 pass / 2 minor / 0 fail`：一题把用户明确事实扩成更具体的事件过程，另一题增加未经用户明确表达的延后应对选项。后台事实初评 `8 pass / 0 minor / 0 fail`。产品负责人裁决仍为 `pending`，当前不宣称稳定性 Go。

## 已确认事实

| 项目 | 结果 |
|---|---|
| 运行身份 | `2026-08-20.gi088-complete-response-first-v1-7-source-alignment-quality-v1` |
| 新调用预算 | `10/10`；补两条可见回应、八条后台事实；重试、恢复调用、回退均为 `0` |
| 可见回应 | 八条均技术有效；六条复用、两条新生成；八条中位 `3273.5ms`、最长 `4916ms` |
| 后台事实 | `8/8 technical_valid`；中位 `6429ms`、最长 `13363ms`，最高 completion `1102/1600` |
| 完整性 | HTTP 200、stop、Thinking 关闭；`0` 次 length，`0` 次来源或状态合同失败 |
| 来源对齐 | 上一失败原始结果的确定性重放通过；本次八条新输出实际均为逐字引用，`alignedQuoteCount=0` |
| Codex 初评 | 可见 `6 pass / 2 minor / 0 fail`；后台 `8 pass / 0 minor / 0 fail` |
| 产品裁决 | `pending`；完整原文、实际可见回应与后台结果保存在私有评审材料 |
| 发布 | 页面 Preview、提交、推送、部署和 Production 切换均未进入；Production baseline |

## 当前停止点

产品负责人按“完整相关用户原文 → 实际可见回应 → 实际后台事实 → Codex 初评”裁决八题。通过后进入隔离 Preview，真实验收单气泡完整回应、后台事实晚到写入、连续回合和恢复；裁决前保持 Production `event_centered + baseline`。

## 证据

- [公开启动卡](./complete-response-first-v1-7-source-alignment-quality-v1-start-card.json)
- [公开回执](./complete-response-first-v1-7-source-alignment-quality-v1-receipt.json)
- [阶段账](./complete-response-first-v1-7-source-alignment-quality-stage-ledger-v1.json)
- [执行计划](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-7-background-source-alignment.md)
