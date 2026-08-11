# GI-088 v8r3r1 账户恢复后正式评测证据

## 为什么停在质量裁决之前

Ark 账户恢复后，v8r3r1 使用原 v8r3 Skill、模型与正式数据重新运行完整离线候选。`96` 个有效检查点全部形成可见结果，首次有效率、自动恢复和用户等待三项运行门均通过。

当前还需要产品负责人完成 `80` 份结果的独立质量裁决，并提供两轮各 `20` 条、互不重复的真实人工 Golden Set。质量门、Judge 校准和开发集预筛将在这些人工输入齐备后继续。Preview deployment 与全新 `0/6` 批次继续关闭，避免用运行稳定性代替产品质量结论。

## 当前状态

- 正式评测版本：`2026-08-11.gi088-v8r3r1-account-restored-formal-evaluation`
- 冻结 commit：`8ec55fb64ac6a1794f95d5bbe86923374c41cef9`
- Candidate fingerprint：`f88f0082a529870587b5e73d635c14939ad8bf6ec792aa7c72884c5b2a7ec657`
- Dataset fingerprint：`6b54d6b533766f8add1884cfa274d057fcf345b67836e9bfaa6743efafc4a750`
- Runner fingerprint：`1bf31d40d16a3fc5a62185c937cc3b6398a2adc59f82a697e93860b6db48c19a`
- Experience fingerprint：`a466fee442ee85a2b701abcb34e799c0e5de2145e0fb0a30563a0a77027864d8`
- Execution fingerprint：`6a657b1993acc7eab93be0970b26546ce07e00762c4d0fd6b1c05c7368c4012f`
- Skill：`2026-08-11.gi088-interview-skill-v8r3`，SHA-256 `a1b13e4f451a40850bd1122f5b873cce3eb9496c62ef6d42c4b8b28d0ab20494`
- 模型：Ark `deepseek-v4-flash-ga-260731`、Thinking high、`json_object`
- 当前裁决：`运行门通过，质量门等待真人裁决`
- Judge 调用：`0`
- Preview deployment：`0`
- 新 `0/6` 批次：`0`
- Production：继续保持 `legacy + baseline`

## 正式候选结果

| 维度 | 结果 | 硬门 |
|---|---:|---:|
| 有效检查点 | `96/96` | 完整 |
| 首次有效 | `95/96 = 98.96%` | `≥85%`，通过 |
| 自动恢复 | `1` 次，成功 `1` 次 | `≤2`，通过 |
| 最终失败／最终保护 | `0 / 0` | 均为 `0`，通过 |
| 人工恢复／重复消息／遗留 pending | `0 / 0 / 0` | 均为 `0`，通过 |
| 可见延迟样本 | `96/96` | 完整 |
| 可见延迟 p50 | `7.484s` | `≤20s`，通过 |
| 可见延迟 p90 | `27.263s` | `≤40s`，通过 |
| 单次最大可见延迟 | `43.416s` | `≤60s`，通过 |
| 确定性回归 | `24` 例、`72` 个校验断言 | 全通过，模型调用 `0` |
| 质量裁决 | `80` 份结果待人工填写 | 待完成 |

## 当前继续条件

1. 产品负责人完成 `80` 份结果的质量标签与失败原因复核。
2. 准备两轮各 `20` 条、内容互不重复且带真实人工来源的 Golden Set。
3. 运行独立 DeepSeek V4 Pro Judge 校准；连续两轮达到协议阈值后，只预筛开发集。
4. 人工最终裁决、质量门、可靠性门和延迟门同时通过后，再冻结发布提交、远程构建私有 Preview 并初始化全新 `0/6`。

## 文件索引

- [不可变清单](./gi088-v8r3r1-account-restored-manifest.json)
- [运行门摘要](./gi088-v8r3r1-operational-summary.json)
- [静态验证](./gi088-v8r3r1-static-validation.md)

## 证据边界

- 本目录只保存聚合事实，不保存隐藏题面、用户原话、候选可见输出、请求正文、凭据、Provider 请求标识或隐藏推理。
- 本轮模型调用仅用于正式候选离线评测；Judge、模型探针、真人内容代提交、Preview 模型调用和 Production 变更均为 `0`。
- v8r3 前两轮 No-Go 证据继续只读保留，v8r3r1 不覆盖其历史身份。
