# GI-088｜v2 Diagnostic 评测底座、空内容结果与 Thinking 探针准备

状态：`历史诊断完成；后续复现探针已停止；v3 自动恢复候选接续`

评测方案版本：`2026-08-09.gi088-human-eval-v2-diagnostic`

服务版本：`2026-08-09.gi088-diagnostic-service-v2`

Production：`legacy + baseline`

## 1. 为什么先完善底座

GI-088 v1 在 A1～A8 完成后由产品负责人主动提前结束。前 8 项的数据完整，数据库记录仍为 `running`、`sealedAt=null`。v1 继续以只读快照承担历史证据，v2 从独立评测版本开始承接提前结束、部分导出、任务目标确认和安全诊断，避免新运行器行为与旧执行指纹混用。

产品负责人已确认分阶段迭代顺序：保留 Thinking high；先处理 `EMPTY_CONTENT`，通过后再处理 `TIMEOUT`；high→off 降级进入独立恢复验证；输出合同、内容与边界问题继续排队。每轮只改变一个主要影响因素。

## 2. 当前血缘

- 历史来源批次：`2026-08-09.gi088-human-eval-v1`；
- 历史来源执行指纹：`4b65801390264df957189efbc968c9b2584e212154e98671370b8167e7ff70b2`；
- Effective candidate：`58074d31e96d18c2fd196a344c6f471a98024897f6578b97ed8288913308b884`；
- v2 数据集指纹：`ab74f00de4fb07315045ac5f2d7aff58fc9d8585fe3a00cf18cb2e6d724c7052`；
- v2 执行指纹：`96a555c6ecef0efd8ff2946bbf7ec9c7ee6b717157520a1e6944bb888b29f943`。

Prompt、Interview Skill、输出合同、模型和 off／high 配置保持 v1 有效候选；v2 指纹变化来自运行器版本、任务触发提示、评价合同、提前结束和诊断能力。

## 3. 已完成的评测底座

1. 新增 `early_stopped` 终态。完成至少一项且处在完整任务边界时可以提前结束；剩余任务必须保持未执行。
2. 全量封存和提前结束都可以导出只读结果。部分导出明确列出已完成任务与 `not_run` 任务。
3. 每条轨迹评价增加必选任务目标判断：已触发、未触发、技术失败阻断。技术阻断必须存在真实技术失败证据。
4. 12 项任务分别增加页面触发提示与判定标准；两者只供评测人查看，不进入模型消息或请求哈希。
5. Provider 增加安全分阶段诊断：响应头等待、正文读取、总时长、超时阶段、取消来源、HTTP 状态、响应模型、choice 数、可见内容形态和上游 Request ID。诊断继续隔离用户原话、可见正文和隐藏推理正文。
6. v1 与 v2 都进入同一数据保留治理范围；终态时间与数据库状态保持一致。

## 4. 空内容配对探针

DeepSeek 官方文档说明 JSON Output 偶尔可能返回空内容，并建议通过 Prompt 调整缓解。[DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode)

本探针从 v1 只读快照选择 E1、E2、E3 三个历史 `EMPTY_CONTENT` 请求。每个请求固定运行两臂：

- `high + response_format=json_object`；
- `high + 普通文本 JSON`，省略 `response_format`。

两臂共享同一模型、Prompt、Skill、完整对话、语义状态、Thinking high、默认 Token 边界和 30 秒总截止。每臂只调用一次，自动重试、质量重试和 fallback 均为 `0`，最坏调用上限为 `6`。

- 探针版本：`2026-08-09.gi088-empty-content-response-format-probe-v1`；
- 探针指纹：`7c0fbbb98bc9c3804a5614e90acd0ecb4b13f023e3b96ddf68820a241c6c9b65`；
- 当前进度：`6/6`；
- 当前授权：`已消费`；
- 运行清单含私有 turn/call 定位符，继续保留在本地受控资产中。

运行器私有清单保留在本地，公开自动检查见 [静态验证记录](./gi088-v2-diagnostic-static-validation.md)。

实际结果如下：

| 冻结请求 | `json_object` | 普通文本 JSON |
| --- | --- | --- |
| E1 | `valid` | `EMPTY_CONTENT` |
| E2 | `valid` | `valid` |
| E3 | `EMPTY_CONTENT` | `OUTPUT_SCHEMA_INVALID` |

普通文本侧只有 `1/3` 有效，未达到预设 `3/3` 可解析门；两种格式都出现空内容。Codex 初评为：移除 `response_format=json_object` 候选 `No-Go`，`response_format` 无法确认为主要影响因素，继续保留 JSON mode。产品负责人随后确认本探针保持 `completed No-Go`。已确认的近端机制为“上游 HTTP 200 正常结束、隐藏推理存在、可见内容长度为 0”；已确认根因仍为空。

脱敏结果见 [结果 JSON](../2026-08-09-gi088-human-eval-v1/gi088-empty-content-response-format-probe-v1-result.json)，结论分账见 [探针裁决](../2026-08-09-gi088-human-eval-v1/gi088-empty-content-response-format-probe-v1-decision.md)。

## 5. Thinking 模式配对探针

response format 探针已排除“移除 JSON mode”这条修复路径，下一轮只隔离 Thinking 模式。探针选择 E1 冷启动和 E3 长上下文两条冻结请求，每条各运行 `high` 与 `disabled`，总预算固定为 `4` 次：

- 两臂都保留 `response_format=json_object`；
- 每个 case 的 Prompt、完整上下文、Provider、模型和其他请求字段在配对臂间完全一致；
- 两臂都省略应用层 `max_tokens`，使用 Provider 默认边界；
- 两臂实际请求都省略 temperature；
- 总截止均为 `30s`；自动重试、质量重试和 fallback 均为 `0`。

disabled 只承担因果诊断，产品负责人已确认产品候选继续保留 Thinking high。探针已按精确指纹完成：

- 探针版本：`2026-08-09.gi088-empty-content-thinking-mode-probe-v1`；
- 当前状态：`completed_inconclusive_no_empty_reproduction_4_of_4`；
- 当前模型调用：`4/4`；
- 探针指纹：`7179da479b614c6380709fc1094034f489d4803d11741b852522616dee7e3498`；
- 运行清单含私有 turn/call 定位符，继续保留在本地受控资产中。

实际四条输出全部有效：E1 high／disabled 与 E3 high／disabled 均为 `valid`。请求血缘 `4/4` 匹配，自动重试、质量重试、fallback、超时和取消均为 `0`。disabled 达到 `2/2 valid`，high 同样达到 `2/2 valid`，未出现预设要求的 high `EMPTY_CONTENT`，因此 Thinking 主要影响因素未确认。

两条 high 都同时形成隐藏推理与可见正文；E1 总耗时 `7.965s`，E3 总耗时 `23.752s`。disabled 对应为 `2.665s` 与 `3.365s`。等待时长差异形成观测，和空内容之间的关系仍待验证。完整脱敏结果见 [结果 JSON](../2026-08-09-gi088-human-eval-v1/gi088-empty-content-thinking-mode-probe-v1-result.json)，结论分账见 [探针裁决](../2026-08-09-gi088-human-eval-v1/gi088-empty-content-thinking-mode-probe-v1-decision.md)。

## 6. 当前停止点

两轮空内容诊断已分别消费模型生成调用 `6/6` 与 `4/4`，自动重试、质量重试和 fallback 均为 `0`。Preview 新批次、部署、评测库写入和 Production 变化均为 `0`。

response format 候选已经 No-Go；Thinking 模式探针因 high 未复现空内容而形成 inconclusive。产品负责人随后确认：项目已能把问题边界收敛到“上游在 reasoning 后返回零长度可见正文”，继续复现无法解释 DeepSeek 内部原因，因此停止“相同 high 请求复现稳定性”探针。

下一步已转入 [v3 Thinking high 可见答案自动恢复候选](../2026-08-09-gi088-human-eval-v3-empty-recovery/README.md)。`TIMEOUT`、输出合同和内容问题继续排队。
