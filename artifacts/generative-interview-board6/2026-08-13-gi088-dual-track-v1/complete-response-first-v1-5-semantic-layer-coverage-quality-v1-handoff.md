# GI-088｜完整回应优先 v1.5 语义层覆盖结果

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么继续优化

v1.5 已完成 `8/8 technical_valid`，中位耗时 `3509ms`、最长 `5324ms`。纠正后继续场景不再补充遮掩动机，也进入了尚未回答的新焦点；关系表达、负担、停止和普通推进保持可用。

剩余问题仍是已答信息覆盖。小狗案例在用户已经表达“特别幸福、一天新的开始”后继续询问感觉；长上下文案例在上一问已经询问感受、用户明确回答“落差感”及一串自我判断后，再次询问最强烈感受。Codex 初评 `6 pass / 1 minor / 1 fail`，因此 v1.5 质量门 No-Go。

## 已确认事实

| 项目 | 结果 |
|---|---|
| 运行身份 | `2026-08-20.gi088-complete-response-first-v1-5-semantic-layer-coverage-quality-v1` |
| 预算 | `8/8`；重试、恢复、回退均为 `0` |
| 技术与合同 | `8/8 technical_valid`；HTTP 200、stop、正文非空、Thinking disabled |
| 耗时 | 中位 `3509ms`，最长 `5324ms`；全部低于 `15s` |
| Token | 最高 completion `109/1280`；`0` 次 length |
| Codex 初评 | `6 pass / 1 minor / 1 fail`；产品负责人裁决 pending |
| 发布 | 页面、后台状态、Preview、提交、推送、部署均未进入；Production baseline |

## 下一单因素与退出规则

v1.6 保持架构、模型、数据和运行参数不变，只增加跨场景的对比例子：用户已经明确表达某一信息层时，展示“同层近义追问”与“切换到真正未答层”的差异；明确要求模型不要默认回到感受问题。

这是最后一轮纯提示方法修复。若完整八题仍出现同层重复，后续停止叠加提示规则，转入模型能力单因素比较。

## 证据

- [公开启动卡](./complete-response-first-v1-5-semantic-layer-coverage-quality-v1-start-card.json)
- [公开回执](./complete-response-first-v1-5-semantic-layer-coverage-quality-v1-receipt.json)
- [阶段账](./complete-response-first-v1-5-semantic-layer-coverage-stage-ledger-v1.json)
- [v1.5 执行计划](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-5-semantic-layer-coverage.md)
