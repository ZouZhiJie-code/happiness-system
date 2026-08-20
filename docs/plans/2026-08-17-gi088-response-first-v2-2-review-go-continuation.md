# GI-088｜回应优先 v2.2 复核通过后的继续执行

- 文档职责：当前专项
- 文档状态：No-Go
- 最后核验：`2026-08-17`
- 权威入口：[生成式访谈重构总 Map](../generative-interview-refactor-map.md)
- 历史停止证据：[事实 Low 与有依据 High](./2026-08-17-gi088-response-first-v2-2-v2-3-factual-low-grounded-high.md)

## 1. 已确认事实与产品决定

v2.2 三题均为 HTTP 200、合同有效和完整返回，耗时 `4.016 / 2.812 / 3.854s`，中位数 `3.854s`。产品负责人先后完成两次裁决：第一次在部分原文呈现后形成 `2/3`；完整相关上下文与实际输出补齐后，最新裁决为 `3/3 pass`。最新裁决覆盖当前产品判断，旧 `2/3 No-Go` 回执继续承担历史过程证据。

Low 候选 `2026-08-17.gi088-response-first-v2-2-factual-low` 保持不变。纠正后继续场景无需新增改造；关系表达允许忠实传达用户原意的自然语义转化。

从本轮开始，每个语义质量判断固定按以下顺序交付：

1. 完整相关用户／AI 上下文；
2. 当前候选实际输出；
3. 技术状态与耗时；
4. Codex 初评；
5. 产品负责人最终裁决。

## 2. 本轮身份、预算与验证门

| 阶段 | 身份 | 新调用预算 | 当前结果 |
|---|---|---:|---|
| 历史三题 | `2026-08-17.gi088-response-first-v2-2-low-quality-v1` | 已消费 `3` | 产品负责人最新复核 `3/3 pass` |
| Low 完整六题 | `2026-08-17.gi088-response-first-v2-2-low-full-quality-v2` | `6` | 技术 `6/6`；产品负责人裁决 `6/6 pass`；质量门 Go |
| High 三题＋六题 | `2026-08-17.gi088-response-first-v2-3-high-quality-v1` | `3＋6` | 第 1 题合同失败；消费 `1/9`，其余 `8 not_run` |
| High `4000` Token 单题探针 | `2026-08-17.gi088-response-first-v2-3-high-token-4000-probe-v1` | `1` | 已完成 `1/1`；本题截断解决，状态合同失败，等待原文裁决 |
| 隔离 Preview | `response_first` | 最多 `15` | `not_run` |

新离线账最大 `15` 次；并发 `1`，自动重试、质量重试、恢复调用和回退均为 `0`。Low、High 继续使用 `deepseek-v4-pro`；Low `reasoningEffort=low`、`maxTokens=1280`，High `reasoningEffort=high`、`maxTokens=2000`。

运行绑定评测总规范 SHA-256 `08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60`。不一致时在密钥与网络访问前记录 `STANDARD_SHA256_MISMATCH` 并停止。

Low 完整六题要求技术与合同有效 `6/6`，中位耗时不高于 `6s`、单例不高于 `15s`、硬超时 `45s`；五个硬案例全部通过，软案例最多一个 minor。Codex 初评只承担评审意见，不提前阻断产品负责人读取原文和裁决。

## 3. 新判尺与证据边界

新数据集身份固定为 `2026-08-17.gi088-response-first-six-real-checkpoints-v1-3-product-owner-rubric`。六题模型输入与 v2.2 完全一致，只更新评审判尺：

- `RPR-REAL-13`：允许同义、自然、符合中文表达习惯且忠实传达用户原意的语义转化；新增改变原意的事实、动机、心理状态或具体体验继续扣分。
- `RPR-REAL-19-CONTINUE`：允许简短重提当前有效焦点作为自然衔接；恢复已失效理解、加入无依据含义或阻断后续推进继续扣分。

用户正文、模型正文和逐题评价只保存在 Git 排除的私有账本、当前受控对话与私有评审卡。公开启动卡和回执只保存身份、指纹、状态、耗时、Token、数量和脱敏裁决。

## 4. 后续阶段与停止点

Low 六题完成后先交付六张原文优先评审卡并等待产品负责人裁决。Low Go 后才实现 v2.3 High；High 只在有效用户依据支持时追加一处 `correctableUnderstanding`，并允许 `0` 或 `1～3` 个共同服务一个 `answerFocus` 的问题。

Low 或 High 任一质量门失败时，后续模型调用、页面接入、提交、推送、部署和 Preview 全部记为 `not_run`。两阶段均 Go 后才接入同气泡、两次调用、四阶段恢复状态和 60 秒 Low-only 边界。Production 全程保持 `event_centered + baseline`。

## 5. 当前执行状态

- 工作区预执行指纹：`c03630eb12e1d92a343caf36affd8e5e5cd526891681e2c1294b895237c9062b`，分支 `codex/gi088-response-first-v2-20260816`，HEAD `7d392694b0d2900da32ab71b3098b9bd8d5a9e31`。
- 旧候选、旧运行器、旧产品裁决 v1 和旧阶段账保持原 SHA。
- Low 完整六题已串行调用 `6/6`，重试、恢复和回退均为 `0`；六题 HTTP 200、合同有效、完整返回和 15 秒目标均为 `6/6`。
- 六题耗时为 `2.882 / 3.341 / 6.178 / 3.580 / 4.014 / 4.188s`，中位数 `3.797s`；Token 为 prompt `6391`、completion `736`、总计 `7127`，其中缓存命中输入 `3840`。
- Codex 原文后初评为 `5 pass / 1 minor / 0 fail`；产品负责人阅读六题完整相关原文和实际输出后裁决 `6 pass / 0 minor / 0 fail`，Low 质量门 Go。
- 本停止点零调用验证：相关 v2／v2.1／v2.2 回归 `37/37`、类型检查、定向 Lint、JSON、公开正文隔离、私有文件权限、文档检查 `24` 份核心文档／`868` 条本地链接和差异格式均通过。
- v2.3 High 启动卡计划指纹为 `a2076f0a27c5a10f5a3a2827027d23a7db4ff83d35282cad59cf62e473cf96bc`。第 1 题 HTTP 200、模型正确，High 用时 `38.384s`，两段合计 `41.725s`；`2000` completion Token 用尽，其中 reasoning `1985`，可见 JSON 长度 `42`，`finishReason=length` 并解析失败。
- High 内容质量保持 `not_evaluated`。本轮累计消费 `7/15`，High 其余 `8 not_run`；页面接入、提交、推送、部署和 Preview 均停止。
- 当前停止点：以 `v23_high_checkpoint_no_go` 封存。下一轮如重开，需要新身份和新预算，并只改变一个能够解决 High 完整交付的因素。

## 6. High `4000` Token 单因素探针

产品负责人确认继续验证 Token 上限。新探针只把 High `maxTokens` 从 `2000` 调整为 `4000`；模型 `deepseek-v4-pro`、Thinking high、Prompt、Skill、JSON 合同、数据、冻结 Low、超时、来源校验和问题策略全部保持不变。

选择 `4000` 的依据：失败调用的 completion `2000` 中 reasoning 已占 `1985`，可见 JSON 只剩 `42` 个字符；同类历史结构化语义输出的 completion 为 `341～428` Token，当前合同增加一处可纠正理解后，预计可见结构仍应处于千 Token 以内。若本次推理消耗接近 `1985`，`4000` 可为完整 JSON 留出约 `2000` Token。历史其他 High 任务曾出现 `5506～8338` reasoning Token，因此 `4000` 只承担待验证的试验上限，不承担成功承诺。

本探针身份为 `2026-08-17.gi088-response-first-v2-3-high-token-4000-probe-v1`，新预算 `1` 次，并发 `1`，重试、恢复和回退均为 `0`。只运行 `RPR-REAL-19-CORRECTION`：

- HTTP 200、目标模型正确、`finishReason=stop`、JSON 可解析、来源与合同有效时，停止并交付完整相关原文、冻结 Low、实际 High 输出、技术事实和 Codex 初评，等待产品负责人裁决；
- 再次截断、技术失败、合同失败或两段超过 `60s` 时立即停止；
- 本探针不消费原 v2.3 剩余 `8` 次，不接入页面，不运行 Preview，不改变 Production。

实际调用 `1/1`，HTTP 200、模型正确；High `37.066s`、两段合计 `40.407s`。completion `2072`、reasoning `1898`、`finishReason=stop`，完整 JSON `596` 字符。`4000` 在本题解决了 Token 截断，且实际完成点只比原 `2000` 上限多 `72` Token。

模型在 `workingTask=null` 时提交 `understandingChange=add`，触发 `NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL`，合同有效 `0/1`。`visibleAppend.correctableUnderstanding=null`、问题 `0`，当前可见交付只能以冻结 Low 完成。完整 High 内容等待 Codex 初评和产品负责人原文裁决；探针已按单次停止点结束。

## 7. High 空主线状态对齐 v2.4｜No-Go

产品负责人按 Codex 初评完成 `4000` Token 探针裁决：High 内部认识内容通过；High 没有可见追加记为轻微问题；完整链路因状态合同失败而 No-Go。执行前逐题回读确认：六题输入中四题的 `workingTask` 初始为空；“纠正后继续”和长上下文两题继承已有主线。原计划的“五空一已有”属于来源计数错误，模型调用前已纠正，六题输入保持原样。当前合同已经支持模型在同一结果中先建立新主线，再保存认识；程序继续保留 `NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL`，不放宽状态门。

新候选身份为 `2026-08-17.gi088-response-first-v2-4-null-task-aligned-high`。首个单因素只补充 High 的状态对齐方法：

- 空主线且需要保存认识、追问或总结时，提交 `taskChange=set`、`continuity=new`、`targetRef=null`，主线摘要和依据来自有效用户消息，随后才能提交 `understandingChange=add`；
- 空主线且只需承接时，保持 `taskChange=unchanged`、`understandingChange=none`，允许零可见理解、零问题结束；
- 已有主线继续使用原有 `continue／return／clear` 行为。

`deepseek-v4-pro`、Thinking high、High `maxTokens=4000`、冻结 v2.2 Low、数据输入、输出结构、程序校验、60 秒硬门均保持不变。新离线预算最多 `6` 次，并发 `1`，重试、恢复和回退均为 `0`。

执行顺序固定为：先重跑 `RPR-REAL-19-CORRECTION` 一次；技术、完整性、来源和状态合同有效后，按“完整上下文 → Low → High → Codex 初评”交付产品负责人；产品裁决为 pass 或 minor 后再运行其余五题。任一题截断、超时、来源错误或状态合同失败，立即停止剩余调用。五个硬案例须全部 pass，软案例最多一个 minor；完整两段中位耗时不高于 `45s`、单例不高于 `60s`。

本阶段只验证离线 High。页面接入、提交、推送、部署和 Preview 保持 `not_run`；Production 继续使用 `event_centered + baseline`。首题已完成产品裁决并触发质量停止门。

### v2.4 首题实际结果

- 运行身份：`2026-08-17.gi088-response-first-v2-4-null-task-aligned-high-quality-v1`；计划指纹 `864d9da7872fbe831aefa4270e158a43c53b0155e688dc5fc6fc44691c01be4d`。
- 新账消费 `1/6`，其余 `5 not_run`；并发 `1`，重试、恢复和回退 `0`。
- HTTP 200、目标模型正确、`finishReason=stop`、来源与状态合同有效。High `51.656s`，冻结 Low＋High `54.997s`；60 秒硬门通过，45 秒目标未达到。
- prompt `2020`、completion `3747`、reasoning `3311`、总计 `5767`；距离 `4000` completion 上限剩余 `253` Token。本题完整返回不支持“其余五题一定不会截断”的扩展结论。
- 模型按 v2.4 方法提交 `taskChange=set／continuity=new／targetRef=null`，随后提交 `understandingChange=add`；原状态合同错误未再出现。
- High 可见追加包含一处可纠正理解和两个同一回答焦点的问题。Codex 初评为 fail：U1 已给出比较的触发情境，U2 已明确感受为愤慨，两问都在重复索取已知信息。
- 产品负责人阅读完整原文后裁决 fail。v2.4 质量门 No-Go；其余五题、页面接入、提交、推送、部署和 Preview 均保持 `not_run`，Production 保持 `event_centered + baseline`。
