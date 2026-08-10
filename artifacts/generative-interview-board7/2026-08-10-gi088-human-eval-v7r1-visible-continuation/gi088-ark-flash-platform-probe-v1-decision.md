# GI-088｜火山 Ark DeepSeek V4 Flash 平台对照结论

状态：`方向性通过；推荐作为下一真人候选，尚未形成稳定发生率证明`

主探针指纹：`7bec10fdf529471625ef33e73a825d5efecbbf9e75da46a1ac86a3979741034e`

E1 超时校正指纹：`3d2d6b6f48bc787638a08150883908dc221868669af84104027b01745bc1df2a`

Production：`legacy + baseline`

## 1. 为什么需要校正

主探针沿用了 DeepSeek 官方 API 的阶段化等待策略：响应头最多等待 15 秒，总时长最多 60 秒。本次火山 Ark 非流式调用的响应头等待基本覆盖了整段生成时间，E1 因而在 15 秒被本地截止，尚未触及 60 秒总上限。

校正调用只复放 E1，把响应头、正文和总时长统一为 60 秒；模型、Thinking high、JSON mode、Prompt、上下文和输出合同保持不变。E1 在 15.8 秒完成并通过完整合同，确认主探针的 E1 超时来自接入层截止策略。

## 2. 三条历史空正文请求的结果

| 案例 | 火山 Ark Flash | 等待 | 可见正文 | 旧合同 |
| --- | --- | ---: | --- | --- |
| E1 冷启动 | valid | 15.8 秒 | 有 | 通过 |
| E2 中程上下文 | valid | 7.0 秒 | 有 | 通过 |
| E3 长上下文重复失败 | protected failure | 9.8 秒 | 有 | `OUTPUT_SCHEMA_INVALID` |

聚合：

- 可见正文 `3/3`；
- `EMPTY_CONTENT=0/3`；
- 旧 v1 合同通过 `2/3`；
- 三次平均等待约 `10.9` 秒，最长 `15.8` 秒；
- 重试 `0`，降级 `0`。

E3 已经返回可见正文，因此它属于输出合同问题，继续进入语义与结构问题队列。它不承担空正文平台故障证据。

## 3. 与 DeepSeek 官方平台的同请求对照

| 方案 | 可见正文 | 旧合同通过 | 空正文 | 平均可见答案等待 | 最长等待 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 官方 Flash | 2/3 | 2/3 | 1/3 | 10.4 秒 | 12.2 秒 |
| 官方 Pro | 3/3 | 2/3 | 0/3 | 30.0 秒 | 42.5 秒 |
| 火山 Ark Flash | 3/3 | 2/3 | 0/3 | 10.9 秒 | 15.8 秒 |

这组三案例形成两项方向性证据：

1. 火山 Ark Flash 在保留 Thinking high 和 JSON mode 时，获得了与官方 Pro 相同的可见正文覆盖；
2. 火山 Ark Flash 的等待时间接近官方 Flash，明显短于官方 Pro。

三条案例仍然属于定向小样本，无法推导稳定首调用成功率。下一步需要真人 Preview 检验连续对话、当前 v7 合同和平台长尾。

火山模型能力列表明确标注该模型支持深度思考与 Chat API；结构化输出推荐模型表当前未单列 DeepSeek V4 Flash。实际 5 次调用均接受 `json_object` 参数，其中合成检查、E1、E2 返回符合预期的 JSON，E3 产生业务输出合同错误。因此 JSON mode 兼容性继续作为 Preview 风险观察项，当前证据不承担正式平台承诺。

## 4. 接入方式选择

推荐：`REST Chat Completions + 仓库现有 TypeScript OpenAI-compatible Provider`。

原因：

1. 当前 Next.js 服务可以直接复用现有 Provider、分阶段诊断、请求血缘、超时归因和隐私边界；
2. OpenAI Python SDK 与火山 Python SDK 都会增加 Python 运行时和部署依赖，它们最终仍调用同一 Ark HTTP 服务，无法天然改善模型空正文或平台长尾；
3. 当前需求只使用 Chat Completions、Thinking、reasoning effort 和 JSON mode，REST 已完整覆盖；
4. 火山非流式响应需要使用适配后的等待策略：响应头截止与总时长都设为 60 秒。未来若切流式，应缓冲完整 JSON 后再提交状态，并继续隔离隐藏思考。

仓库中的 `OpenAIProvider` 已增加对火山 Ark 域名的 Thinking 参数支持；普通 OpenAI 域名和 DeepSeek 官方 Prefix 行为保持原有边界。

## 5. 当前裁决

- 产品负责人判断：等待真人体验；
- Codex 初评：火山 Ark Flash 是当前综合最优候选；
- 已确认根因：E1 首次超时由 15 秒响应头截止与 Ark 非流式返回时机不匹配导致；
- 待验证假设：火山 Ark Flash 在连续真人轨迹中仍能保持零空正文和可接受等待；
- 兼容风险：Ark 文档的结构化输出推荐模型表未单列该模型，当前可用性由本次真实 API 结果支持；
- 发布边界：本轮未部署 Preview、未创建评测批次、未修改 Production。

公开依据：[火山 Chat API](https://docs.volcengine.com/docs/82379/1494384)、[火山模型能力列表](https://docs.volcengine.com/docs/82379/1330310)、[火山结构化输出](https://docs.volcengine.com/docs/82379/1568221)。
