# GI-088 v0.5｜逐臂技术冒烟授权文本

当前身份：`历史授权记录；两次授权已消费，指纹只对 v0.5 有效`

历史执行指纹：`3bea0a9e01205a8a2cf6723b35cffc4272cf44da5cee077d0c0609fee45d4113`

两次授权均已分别消费。每次使用独立 UUID，只覆盖对应配置的一次技术冒烟。正式 `12` 项真人评测、Production 和候选调整继续使用各自授权边界。

## 第一次｜Thinking 关闭

> 我已核对 GI-088 v0.5 评测方案、运行器验证记录与执行指纹 `3bea0a9e01205a8a2cf6723b35cffc4272cf44da5cee077d0c0609fee45d4113`；授权 Thinking 关闭配置执行 1 次 DeepSeek Preview 技术冒烟。

## 第二次｜Thinking high

关闭组结果封存并核对后使用：

> 我已核对 GI-088 v0.5 Thinking 关闭技术冒烟结果与执行指纹 `3bea0a9e01205a8a2cf6723b35cffc4272cf44da5cee077d0c0609fee45d4113`；授权 Thinking high 配置执行 1 次 DeepSeek Preview 技术冒烟。

## v0.5 冒烟结果

| 配置 | 结果 | 请求 UUID | 冒烟 deployment | Token 与推理摘要 | Provider 耗时 |
|---|---|---|---|---|---:|
| Thinking 关闭 | `valid`，`finishReason=stop` | `redacted-operational-id` | `redacted-deployment-id` | 总 Token `2553`；reasoning `false / 0` 字符；推理 Token 未返回 | `369ms` |
| Thinking high | `valid`，`finishReason=stop` | `redacted-operational-id` | `redacted-deployment-id` | 总 Token `3377`；reasoning `true / 2971` 字符；推理 Token `722` | `411ms` |

## 当前授权边界

- 技术冒烟结束后的 disabled deployment：`redacted-deployment-id`，保留为历史检查点；
- 历史 formal batch deployment：`redacted-deployment-id`；当时访问地址：`https://xingfuxitong-34pbcz5so-example-team.vercel.app/preview/gi088-evaluation`；
- v0.5 两臂冒烟授权已经消费，后续新增冒烟需要绑定新授权、对应 arm 和全新 UUID；
- 同一授权重复提交只读回原记录，不产生第二次 Provider 调用；
- 技术失败、结构保护失败和进程中断都会消费该 UUID；
- 不执行自动技术重试或质量重试。

## 历史授权记录

- v0.2 指纹 `53731dc2…f01f20b1` 的关闭组授权在模型请求前停止，调用 `0`，已失效；
- v0.3 指纹 `90ed8b4d…32cac7cc` 已消费 off、high 各一次，共 `2` 次调用；
- v0.4 指纹 `efbade80…8c8f56a8` 已消费 high 一次，共 `1` 次调用；
- v0.5 指纹 `3bea0a9e…e45d4113` 已消费 off、high 各一次，共 `2` 次调用；
- 累计历史 DeepSeek 技术冒烟调用为 `5`，五条记录均保留；v0 正式批次后续累计 `9` 次调用；
- v0.3、v0.4 与 v0.5 技术冒烟授权均不能用于正式真人评测。
