# GI-088｜技术冒烟历史与根因记录

## 已封存结果

| 运行器 | 执行指纹 | 配置 | 状态 | 关键证据 | 调用数 |
|---|---|---|---|---|---:|
| v0.3 | `90ed8b4d…32cac7cc` | off | `valid` | 耗时 `579ms`，总 Token `2422` | 1 |
| v0.3 | `90ed8b4d…32cac7cc` | high | `technical_failure` | `EMPTY_CONTENT`；旧运行器未保存结束原因 | 1 |
| v0.4 | `efbade80…8c8f56a8` | high | `protected_failure` | `finishReason=stop`，推理 Token `797`，完整 JSON；唯一结构错误为 `burdenSignal.evidenceRefs=[]` | 1 |
| v0.5 | `3bea0a9e…e45d4113` | off | `valid` | UUID `b1389fce-5488-45ac-b300-f6ce3c52f132`；`finishReason=stop`，总 Token `2553`，reasoning `false / 0` 字符，Provider 耗时 `369ms` | 1 |
| v0.5 | `3bea0a9e…e45d4113` | high | `valid` | UUID `bb756d3c-af07-4072-9bb5-8e88209a2167`；`finishReason=stop`，总 Token `3377`，reasoning `true / 2971` 字符、推理 Token `722`，Provider 耗时 `411ms` | 1 |

累计历史 DeepSeek 技术冒烟调用：`5`；其中 v0.5 调用 `2`。v0 正式批次后续累计 `9` 次调用。质量重试和自动技术重试均为 `0`。

## v0.4 根因

模型把“未出现明显的负担信号”编码成非空 `burdenSignal`，同时给出空证据。严格 Schema 要求非空对象至少引用一条用户消息，因此正确拦截。

根因位于输出合同的可空编码表达：原示例展示了对象，硬约束未明确当前缺少负担证据时应输出 JSON `null`。Provider 正常结束，输出预算、空 content 和隐藏推理均已排除。

v0.5 保留 GI-087 原 Prompt、Skill、任务结构和严格 Schema，只增加版本化输出合同澄清。v0.4 结果保留为历史根因证据，不能与 v0.5 任一臂组成对照。

## 空批次清理审计

- 批次 ID：`a12756bb-024a-4135-b727-ac13db13a1db`；
- 执行指纹：`efbade8059ee0a85b377115593584e04bc88ffb327123a18ca4058f88c8f56a8`；
- 删除前条件：`running`、revision `0`、`activeTaskId=null`、消息总数 `0`、回合总数 `0`；
- 精确定向删除：`1` 条；
- 删除时既有技术冒烟记录：`3` 条完整保留；随后新增 v0.5 两条 `valid` 记录，当前合计 `5` 条；
- v0.5 登录读回当时创建 `0/12` 批次，该时点正式模型调用为 `0`。

技术冒烟结束后曾恢复 `disabled`。formal batch 随后进入 `batch` 作用域；A1 关闭组首轮正式调用为 `1`，当时页面恢复 deployment 为 `dpl_EhDcw5vVpHbLzAPFQp9wXJ2aNCiW`。v0 批次最终停在 A2 high，当前入口见 [`GI-088 v1`](../2026-08-09-gi088-human-eval-v1/README.md)。

原始最终输出和逐条 Provider 记录继续保存在 Preview 独立评测数据库；本文件只保存足够复核的脱敏结论，不保存隐藏推理正文。
