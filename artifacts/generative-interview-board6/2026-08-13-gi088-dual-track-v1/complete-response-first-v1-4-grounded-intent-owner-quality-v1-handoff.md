# GI-088｜完整回应优先 v1.4 有依据的意图兑现结果

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么继续优化

v1.4 已把纯文本首调的工程稳定性提升到 `8/8 technical_valid`，中位耗时 `2701.5ms`、最长 `3350ms`。奶奶案例不再替第三方补原因，长上下文、关系表达和停止控制也通过 Codex 初评。

剩余问题来自“信息层覆盖”判断。模型把用户已经回答的感受层继续细分成新的感受选项：小狗案例再次询问已经表达过的幸福感；纠正后继续案例再次解释纠正并询问感受，同时增加“不想显得计较”的动机。Codex 初评 `6 pass / 1 minor / 1 fail`，因此 v1.4 质量门 No-Go。

## 已确认事实

| 项目 | 结果 |
|---|---|
| 运行身份 | `2026-08-20.gi088-complete-response-first-v1-4-grounded-intent-owner-quality-v1` |
| 预算 | `8/8`；重试、恢复、回退均为 `0` |
| 技术与合同 | `8/8 technical_valid`；HTTP 200、stop、正文非空、Thinking disabled |
| 耗时 | 中位 `2701.5ms`，最长 `3350ms`；全部低于 `15s` |
| Token | 最高 completion `77/1280`；`0` 次 length |
| Codex 初评 | `6 pass / 1 minor / 1 fail`；产品负责人裁决 pending |
| 发布 | 页面、后台状态、Preview、提交、推送、部署均未进入；Production baseline |

## 下一单因素

下一候选使用语义信息层覆盖表：事件／触发、感受／身体、想法／判断、需要／价值、行为／回应、关系意义、变化／规律、影响／下一步。用户在任一处已经明确回答的信息层视为已覆盖，换成更细的近义选项不能重新作为新增目标。

承接句只自然转述用户明确内容；未经确认的原因、动机和第三方心理不能写进陈述。这个方法在完整八题上统一验证，当前比较案例继续排在最后。

## 证据

- [公开启动卡](./complete-response-first-v1-4-grounded-intent-owner-quality-v1-start-card.json)
- [公开回执](./complete-response-first-v1-4-grounded-intent-owner-quality-v1-receipt.json)
- [阶段账](./complete-response-first-v1-4-grounded-intent-owner-stage-ledger-v1.json)
- [v1.4 执行计划](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-4-grounded-intent-owner.md)
