# GI-088｜真人交互开发评测集 v1

状态：`产品负责人主动提前结束；8/12 只读封存快照已形成；response format 探针 completed No-Go；Thinking 模式探针 4/4 已完成、未复现空内容，根因继续开放`

评测方案版本：`2026-08-09.gi088-human-eval-v1`

Production：`legacy + baseline`

## 1. 为什么产生 v1

v0 在 A2 high 的同一轮共执行 `3` 次调用。三次都以 `finishReason=length` 结束，`completionTokens=1600` 与 `reasoningTokens=1600` 完全相等，最终可见回答为空。手动重试继续使用相同输入、Prompt、Skill、模型和预算，因此重复得到同类结果。

v1 只调整两项运行与恢复能力：

1. off 与 high 都省略应用层 `max_tokens`，由 DeepSeek 使用模型自身输出边界；
2. 技术失败可以保留原始结果后直接结束并由产品负责人评价，手动重试继续保持显式选择和一次一调用。

基础 Prompt、Interview Skill、任务结构、输出合同、严格 Schema、12 项任务、A0＋U1 同起点、零自动重试和两组 Thinking 差异保持不变。

## 2. 当前配置与血缘

- 模型：`deepseek-v4-flash`；
- 输出：结构化 JSON；
- 输出空间：应用不发送 `max_tokens`；
- off：Thinking 关闭，温度 `0.2`；
- high：Thinking 开启，`reasoning_effort=high`，温度 `N/A`；
- Base GI-087 候选：`e45f431f21819b668422c5da64678ad22fb6ef3f3eee285aa9e9c8fb533321aa`；
- Effective candidate：`58074d31e96d18c2fd196a344c6f471a98024897f6578b97ed8288913308b884`；
- 数据集：`93c9808b6f805caea801eeb06d8d0bac46d35a08df68257d74c03cdfc1774e29`；
- 执行指纹：`4b65801390264df957189efbc968c9b2584e212154e98671370b8167e7ff70b2`。

两组共同省略上限，因此 Thinking 继续是组间唯一配置差异。相对 v0，输出预算策略是本版唯一主要影响因素。

## 3. 运行结果

- Preview deployment：`dpl_9VjwswqWK9QUoojXXKNs5BWjBvCS`；
- 访问地址：`https://xingfuxitong-5vak37bgb-zouzhijies-projects.vercel.app/preview/gi088-evaluation`；
- 访问顺序：先通过 Vercel Deployment Protection，再使用 Daily Light 应用账号登录；
- 登录与 session 只读验收：通过；
- 当前批次：A1～A8 完成，`8/12`；A2-R、A3-R、A4-R、A6-R 未开始；
- 产品负责人已保存 `16` 条逐轨迹评价与 `8` 条配置比较，并主动取消四项复测；
- 数据库系统状态：`running`、`sealedAt = null`；现有运行器只支持 `12/12` 后 sealed；
- v1 正式调用：`66`，其中有效 `37`、程序保护 `10`、技术失败 `19`、显式手动重试 `17`；
- high 的技术失败：`EMPTY_CONTENT 12`、`TIMEOUT 7`；关闭组技术失败 `0`，程序保护 `7`；
- 当前作用域已经停止继续运行；原授权只绑定本 v1 精确执行指纹；
- Production 页面与 session API：`404`。

构建阶段 `42/42` 定向测试、TypeScript、定向 ESLint、差异检查、本地构建和 Preview 构建均通过。请求测试确认 v1 的 DeepSeek 请求体省略 `max_tokens`，其他既有调用继续使用原默认行为。

## 4. 本批判断

产品负责人判断：high 在 `6/8` 组比较中更好，有效输出的自然表达、提问切入、认识深度和总结质量形成正向信号；技术失败与手动重试严重损害访谈体验，并成为提前结束原因。

Codex 独立初评：high 同样在 A1～A5、A8 显示内容优势；`16/16` 候选输入血缘合格，`11/16` 任务能力血缘合格；内容分类为 `direct_use 2`、`minor_issue 5`、`quality_failure 7`、`single_case_blocker 2`。A5 off 命中无充分来源的长期模式推断，A7 off 命中最新纠正未完成端到端提交。

产品负责人已确认保留 Thinking high，并将问题按独立轮次处理：先验证和修复 `EMPTY_CONTENT`，通过后处理 `TIMEOUT`；high→off 降级作为独立恢复方案验证；输出合同、内容与边界问题继续排队。v2 diagnostic 已完成评测底座和安全诊断实现。空内容 response format 配对探针已完成 `6/6`：`json_object` 为 `2 valid / 1 EMPTY_CONTENT`，普通文本 JSON 为 `1 valid / 1 EMPTY_CONTENT / 1 OUTPUT_SCHEMA_INVALID`。移除 `response_format` 候选 No-Go，已确认近端机制为上游 reasoning-only stop，根因继续开放。

E1／E3 × high／disabled 的 Thinking 模式配对探针随后按精确指纹完成 `4/4`，重试与降级均为 `0`。四条输出全部有效：high `2/2 valid`、disabled `2/2 valid`，两条历史空内容请求在 high 侧都未复现失败。预设 Thinking 定向支持门因此未通过，Thinking 作为主要影响因素仍未确认；产品基线继续保留 high 与 JSON mode，当前问题继续停留在 `EMPTY_CONTENT`，暂不进入 TIMEOUT 或真人复测。

## 5. 证据入口

- [8/12 提前结束与只读封存核验](./gi088-human-eval-v1-batch-seal-audit.md)
- [产品负责人真人体验评价](./gi088-human-eval-v1-product-review.md)
- [Codex 独立九维初评与阻断检查](./gi088-human-eval-v1-codex-review.md)
- [Bad Case 总账](./gi088-human-eval-v1-bad-case-ledger.json)
- [整批复盘与下一主要影响因素](./gi088-human-eval-v1-batch-reconciliation.md)
- [运行清单](./gi088-human-eval-v1-manifest.json)
- [运行器验证记录](./gi088-runner-validation.md)
- [空内容配对探针 manifest](./gi088-empty-content-response-format-probe-v1-manifest.json)
- [空内容配对探针脱敏结果](./gi088-empty-content-response-format-probe-v1-result.json)
- [空内容配对探针裁决](./gi088-empty-content-response-format-probe-v1-decision.md)
- [空内容 Thinking 模式探针 manifest](./gi088-empty-content-thinking-mode-probe-v1-manifest.json)
- [空内容 Thinking 模式探针脱敏结果](./gi088-empty-content-thinking-mode-probe-v1-result.json)
- [空内容 Thinking 模式探针裁决](./gi088-empty-content-thinking-mode-probe-v1-decision.md)
- [v2 diagnostic 评测底座与当前停止点](../2026-08-09-gi088-human-eval-v2-diagnostic/README.md)

旧 v0 批次、`9` 次正式调用和 A2 high 三次预算耗尽证据见 [v0 历史记录](../2026-08-08-gi088-human-eval-v0/README.md)。v1 结果只用于开发评测，板块 6 继续进行中，板块 7 正式接入与板块 8 继续等待。
