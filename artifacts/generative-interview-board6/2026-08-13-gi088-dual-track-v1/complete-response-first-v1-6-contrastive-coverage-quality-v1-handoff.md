# GI-088｜完整回应优先 v1.6 对比式覆盖结果

- 文档职责：历史证据
- 文档状态：待确认
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么停在产品裁决

v1.6 已完成 `8/8 technical_valid`，中位耗时 `2915ms`、最长 `5152ms`。v1.5 的两处同层回问均已修复：日常互动题进入行为层，长上下文题进入应对层；纠正后继续也进入后续反应，没有重问用户已明确的感受。

Codex 初评为 `7 pass / 1 minor / 0 fail`。唯一待裁决边界是关系题新增一处未经用户明确确认的感受；其余关系对比与问题焦点有原文支持。该题属于硬案例，因此产品负责人把它判为 pass 后，首批质量门才成立；判为 minor 或 fail 时按退出规则转入模型能力比较。

## 已确认事实

| 项目 | 结果 |
|---|---|
| 运行身份 | `2026-08-20.gi088-complete-response-first-v1-6-contrastive-coverage-quality-v1` |
| 预算 | `8/8`；重试、恢复、回退均为 `0` |
| 技术与合同 | `8/8 technical_valid`；HTTP 200、stop、正文非空、Thinking disabled |
| 耗时 | 中位 `2915ms`，最长 `5152ms`；全部低于 `15s` |
| Token | 最高 completion `91/1280`；`0` 次 length |
| Codex 初评 | `7 pass / 1 minor / 0 fail`；产品负责人裁决 pending |
| 发布 | 页面、后台状态、Preview、提交、推送、部署均未进入；Production baseline |

## 当前停止点

逐题向产品负责人展示相关完整原文与实际输出。产品负责人确认八题质量后，若首批达到硬案例全 pass，则另建独立稳定性复验身份；稳定后再进入后台状态调用和隔离 Preview。

## 证据

- [公开启动卡](./complete-response-first-v1-6-contrastive-coverage-quality-v1-start-card.json)
- [公开回执](./complete-response-first-v1-6-contrastive-coverage-quality-v1-receipt.json)
- [阶段账](./complete-response-first-v1-6-contrastive-coverage-stage-ledger-v1.json)
- [v1.6 执行计划](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-6-contrastive-coverage.md)
