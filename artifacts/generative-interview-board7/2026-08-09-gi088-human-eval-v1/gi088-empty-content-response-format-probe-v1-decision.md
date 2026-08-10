# GI-088｜空内容 response format 配对探针裁决

状态：`6/6 已完成；移除 response_format 候选 No-Go；EMPTY_CONTENT 根因继续开放`

探针版本：`2026-08-09.gi088-empty-content-response-format-probe-v1`

探针指纹：`7c0fbbb98bc9c3804a5614e90acd0ecb4b13f023e3b96ddf68820a241c6c9b65`

## 1. 为什么当前不能移除 JSON mode

预设通过门要求普通文本 JSON 侧 `3/3` 可解析，同时 `json_object` 侧至少复现一次 `EMPTY_CONTENT`。实际普通文本侧只有 `1/3` 有效，另有一次空内容和一次非 JSON 输出；两种格式都出现空内容。

因此，移除 `response_format=json_object` 无法成为当前修复。`json_object` 继续承担结构输出基线，空内容问题留在当前轮继续定位。

## 2. 六次结果

| 冻结请求 | `json_object` | 普通文本 JSON |
| --- | --- | --- |
| E1｜冷启动 | `valid` | `EMPTY_CONTENT` |
| E2｜中段轨迹 | `valid` | `valid` |
| E3｜长上下文重复失败 | `EMPTY_CONTENT` | `OUTPUT_SCHEMA_INVALID` |

聚合结果：

- `json_object`：有效 `2/3`，空内容 `1/3`；
- 普通文本 JSON：有效 `1/3`，空内容 `1/3`，结构保护失败 `1/3`；
- 六次请求血缘全部通过，自动重试、质量重试、fallback、超时和取消均为 `0`。

## 3. 结论分账

### 产品负责人判断

后续已确认本探针保持 `completed No-Go`：继续保留 `response_format=json_object` 与 Thinking high，下一唯一诊断因素转为 Thinking 模式。原始结果 JSON 与 completed manifest 中的 `pending_discussion` 保存探针刚完成时的判断时点，不改写运行证据。

### Codex 初评

- 移除 `response_format`：`No-Go`；
- `response_format` 作为空内容主要影响因素：`未确认`；
- 当前基线：继续保留 Thinking high 与 `json_object`；
- 当前问题：继续停留在 `EMPTY_CONTENT`，暂不进入 TIMEOUT 轮。

### 已确认事实

两次空内容都由上游返回 HTTP 200、`finishReason=stop`、一个 choice、字符串类型 `content`，隐藏推理存在，可见内容长度为 `0`。两次的 completion Token 全部计入 reasoning Token。Provider 在业务 JSON 与 Schema 校验前正确转为 `EMPTY_CONTENT`。

普通文本 E3 返回了 `124` 字符的可见内容，但不含 JSON 对象或数组边界，命中 `OUTPUT_SCHEMA_INVALID`。这说明省略 JSON mode 同时带来输出合同漂移风险。

### 已确认根因

`尚未形成`。当前只确认近端机制：上游可能在完成隐藏推理后正常停止，同时不给出可见回答。

### 待验证假设

1. Thinking high 存在间歇性的 reasoning-only stop；
2. 请求内容或上下文特征可能改变失败概率；
3. 普通文本 JSON 会增加结构漂移概率。

## 4. 官方合同对照

DeepSeek 官方 JSON Output 文档确认两点：Prompt 需要明确 JSON 并提供结构示例；JSON Output 偶尔可能返回空 `content`，Prompt 调整可能缓解。本候选已包含 JSON 协议词和完整结构示例，本次普通文本侧仍出现空内容与非 JSON 输出。[DeepSeek JSON Output](https://api-docs.deepseek.com/zh-cn/guides/json_mode)

两次空内容的 `finishReason=stop` 且 reasoning Token 等于 completion Token，当前证据不支持 Token 截断解释。

## 5. 当前停止点

本次精确授权已消费：生成调用 `6/6`，重试 `0`，降级 `0`。Preview 新批次、部署、评测库写入和 Production 变化均为 `0`。

下一唯一诊断因素已确认为 Thinking 模式，只承担因果隔离，产品候选继续保留 Thinking high：

- 选择 E1 冷启动与 E3 长上下文两条冻结请求；
- 零调用 inspect 已确认 E1 high→disabled、E3 disabled→high 的固定 `4` 次顺序；
- 固定 Provider、模型、Prompt、完整上下文、`json_object`、默认 Token 和 30 秒截止；disabled 侧同样省略 temperature；
- 自动重试、质量重试和 fallback 均为 `0`。

若 disabled `2/2 valid` 且 high 至少一次 `EMPTY_CONTENT`，只形成“Thinking 获得主要影响因素的定向支持，可进入 high-compatible 修复候选”。通用根因继续开放；high 的 Schema failure 不计作空内容支持，任何非 `EMPTY_CONTENT` 技术失败会让对应配对不可判。未形成该方向组合时，本轮继续保留为未确认。

后续 Thinking 模式探针已按精确指纹 `7179da479b614c6380709fc1094034f489d4803d11741b852522616dee7e3498` 完成 `4/4`：high 与 disabled 均为 `2/2 valid`，high 未复现空内容，Thinking 主要影响因素未确认。完整脱敏数据见 [结果 JSON](./gi088-empty-content-response-format-probe-v1-result.json)，本探针运行计划见 [探针 manifest](./gi088-empty-content-response-format-probe-v1-manifest.json)，下一轮见 [Thinking 模式探针 manifest](./gi088-empty-content-thinking-mode-probe-v1-manifest.json)与[Thinking 探针裁决](./gi088-empty-content-thinking-mode-probe-v1-decision.md)。
