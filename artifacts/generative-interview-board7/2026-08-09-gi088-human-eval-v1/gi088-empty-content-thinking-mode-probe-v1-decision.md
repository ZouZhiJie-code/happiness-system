# GI-088｜空内容 Thinking 模式配对探针裁决

状态：`4/4 已完成；Thinking 主要影响因素未确认；EMPTY_CONTENT 根因继续开放`

探针版本：`2026-08-09.gi088-empty-content-thinking-mode-probe-v1`

探针指纹：`7179da479b614c6380709fc1094034f489d4803d11741b852522616dee7e3498`

## 1. 为什么当前无法归因给 Thinking

预设支持门要求 disabled 侧 `2/2 valid`，同时 high 侧至少复现一次 `EMPTY_CONTENT`。本次 disabled 达到 `2/2 valid`，high 同样达到 `2/2 valid`，两条历史空内容请求都未复现空内容。

因此，Thinking 作为空内容主要影响因素仍未确认。产品基线继续保留 Thinking high；disabled 结果只承担因果诊断，不能替代 high 的正式质量评分。

## 2. 四次结果

| 冻结请求 | high | disabled |
| --- | --- | --- |
| E1｜冷启动 | `valid`；7.965s；reasoning 478 / completion 789 tokens | `valid`；2.665s；无 reasoning |
| E3｜长上下文重复失败 | `valid`；23.752s；reasoning 1996 / completion 2405 tokens | `valid`；3.365s；无 reasoning |

四条请求都为 HTTP 200、`finishReason=stop`、字符串类型可见内容，业务输出合同校验通过。请求血缘 `4/4` 匹配；自动重试、质量重试、fallback、超时和取消均为 `0`。

high 两条都同时形成隐藏推理与可见回答。E1 约有 `311` 个可见 completion tokens，E3 约有 `409` 个；这与历史空内容事件中“completion tokens 全部进入 reasoning、可见内容为 0”的形态不同。

## 3. 结论分账

### 产品负责人判断

探针运行前已确认继续保留 Thinking high，disabled 只用于诊断。本次结果后的下一修复或新诊断选择等待产品负责人确认。

### Codex 初评

- Thinking 作为主要影响因素：`未确认`；
- 预设定向支持门：`未通过，原因是 high 未复现空内容`；
- 反向证据门：`未触发`，disabled 未出现空内容；
- 当前基线：继续保留 Thinking high 与 `response_format=json_object`；
- 当前问题：继续停留在 `EMPTY_CONTENT`，暂不进入 TIMEOUT 轮或真人复测。

### 已确认事实

1. 两条历史失败请求在本次 high 精确重放中都可以返回有效输出，证明失败具有间歇性。
2. disabled 在两条配对请求中都有效；当前样本无法将这一结果与 high 的空内容失败建立因果关系。
3. high 在两组配对中都更慢：E1 为 `7.965s / 2.665s`，E3 为 `23.752s / 3.365s`。等待时长差异已形成观测，和空内容之间的关系仍待验证。
4. response format 继续保留。上一轮已确认移除 JSON mode 会带来空内容与输出合同漂移，候选保持 No-Go。

### 已确认根因

`尚未形成`。历史证据继续确认近端机制：上游可能在隐藏推理后以 HTTP 200 和 `stop` 结束，同时给出零长度可见内容。本探针未复现该形态。

### 待验证假设

1. Thinking high 可能间歇性地出现 reasoning-only stop；
2. 请求内容、上下文或上游随机性可能改变发生概率；
3. Thinking high 会增加等待时长，等待时长与空内容是否存在共同上游机制仍待验证。

## 4. 当前停止点

本次精确授权已消费生成调用 `4/4`，重试 `0`，降级 `0`。Preview 新批次、部署、评测库写入和 Production 变化均为 `0`。

本轮继续停留在 `EMPTY_CONTENT`。按已确认迭代策略，证据不足时先继续定位，TIMEOUT、输出合同、内容与边界问题保持排队，定向真人复测也继续等待可验证修复。

下一轮建议只验证一个因素：相同 high 请求的空内容复现稳定性。可使用 E1 与 E3 的冻结请求做交错重复，继续保留 `json_object`、Thinking high、Provider 默认 Token 和零重试；调用次数、停止门与新指纹需先形成静态清单，再由产品负责人单独授权。完整脱敏数据见 [结果 JSON](./gi088-empty-content-thinking-mode-probe-v1-result.json)，运行合同见 [探针 manifest](./gi088-empty-content-thinking-mode-probe-v1-manifest.json)。
