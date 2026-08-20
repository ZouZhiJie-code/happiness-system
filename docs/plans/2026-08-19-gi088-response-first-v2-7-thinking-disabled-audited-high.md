# GI-088｜回应优先 v2.7 Thinking-disabled Audited High

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-19`
- 权威入口：[生成式访谈重构总 Map](../generative-interview-refactor-map.md)
- 父结果证据：[v2.6 首题结果交接](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-6-low-effort-audited-high-quality-v1-handoff.md)

## 1. 为什么关闭 High Thinking

v2.6 首题已经完整返回，JSON、来源、状态与问题审计合同均有效，因此 `4000` Token 足以容纳本题结果。High 总耗时 `56.668s`，其中响应头只用 `0.213s`，正文等待 `56.455s`；冻结 Low 与 High 合计 `60.009s`，超过 60 秒硬门 `9ms`。本地解析和校验只占毫秒级，当前延迟集中在上游生成。

把 `reasoningEffort` 从 high 降到 low 后，模型仍生成 `3132` 个 reasoning Token。这个参数只表达思考强度偏好，不提供 reasoning Token 硬上限。历史同请求配对曾观察到 Thinking 关闭为 `2.665 / 3.365s`，Thinking high 为 `7.965 / 23.752s`；该证据使用不同模型与 Prompt，只支持把“关闭 Thinking”作为下一单因素，不能预判本轮绝对耗时或语义质量。

## 2. 身份与唯一变量

- 候选：`2026-08-19.gi088-response-first-v2-7-thinking-disabled-audited-high`
- 运行：`2026-08-19.gi088-response-first-v2-7-thinking-disabled-audited-high-quality-v1`
- 父候选：`2026-08-19.gi088-response-first-v2-6-low-effort-audited-high`
- 唯一主要因素：High `thinking=enabled → disabled`
- Provider 合同要求：Thinking 关闭时省略 `reasoningEffort`，该省略属于同一配置变化。
- Provider 既有行为：Thinking 关闭且调用方未另行指定温度时发送 `temperature=0.2`；这是模式切换后的固定运行行为，启动卡必须如实记录。

以下因素全部固定：

- v2.2 冻结 Low 及六题原文；
- 六题输入、产品负责人判尺和执行顺序；
- `deepseek-v4-pro`、High `maxTokens=4000`；
- v2.6 的系统提示、Interview Skill、`informationGainAudit`、输出结构、状态合同与可见投影；
- 两段式、Low 字节级冻结、来源校验、并发 1；
- 45 秒完整两段目标、60 秒硬门，重试、恢复和回退均为 0。

本轮不同时切换模型、压低 Token、精简合同或修改可见理解规则，确保速度差异能够归因到 Thinking 开关。

## 3. 产品行为与质量责任

High 保持 v2.6 行为：

1. 为候选问题检查完整有效用户原文；
2. 已有答案的候选退出可见问题；
3. 开放且预计能够改变当前认识的问题才进入可见输出；
4. 可见问题保持 0 个或 1～3 个共同服务同一回答焦点的问题；
5. 可纠正理解只引用当前分支中有效的用户消息。

程序校验 Thinking 实际请求、字段、来源、角色、状态、结构、预算、超时和模型自身声明的一致性。程序不判断理解是否重复、已有答案是否语义覆盖、问题是否值得追问。Codex 先提供完整原文与实际输出，再给初评；产品负责人作最终语义裁决。

## 4. 预算、验证门与停止点

新离线账最多 `6` 次，分为首题 `1` 次和其余五题 `5` 次：

1. 静态验证通过后，只运行 `RPR-REAL-19-CORRECTION`；
2. 实际请求必须提交 `thinking.type=disabled` 且不包含 `reasoning_effort`；
3. 首题需要 HTTP 200、目标模型正确、`finishReason=stop`、完整 JSON、来源／状态／审计合同有效，reasoning 正文与 Token 为空或 0；
4. 冻结 Low 与 High 合计不高于 45 秒才通过本轮速度方向门；超过 60 秒记为技术 No-Go，45～60 秒记为速度 No-Go；
5. 技术与合同有效后，仍按完整相关原文、冻结 Low、High 原始输出、可见追加、耗时与 Token、Codex 初评交付产品负责人；
6. 产品负责人裁决首题 `pass` 后才进入其余五题；首题 `minor` 或 `fail` 时停止；
7. 任一题出现截断、超时、来源错误、状态合同失败或产品质量硬门失败，立即停止后续调用；
8. 六题质量门为五个硬案例全部 `pass`，软案例最多一个 `minor`；完整两段中位数不高于 45 秒、单例不高于 60 秒。

## 5. 验证与证据

执行前建立独立候选、启动卡、私有结果账和公开回执，绑定 AI 评测总规范 SHA、父候选与父运行结果、冻结 Low、六题数据和本计划指纹。自动验证至少覆盖：

- Thinking 关闭且请求不携带 `reasoning_effort`；
- v2.6 Prompt、审计、状态合同、可见投影和 `4000` Token 保持冻结；
- 有效用户来源、空主线／已有主线、Low 字节级冻结；
- 首题 `1＋5` 停止门、45／60 秒分账、一次调用记账；
- reasoning 缺失或为 0 的观测；
- 私有正文隔离与公开证据脱敏。

公开区只保存身份、指纹、状态、指标、哈希和数量。用户输入、Low、High 与评审原文继续保存在 Git 排除且权限为 `600` 的私有目录。

## 6. 当前状态与发布边界

- v2.6 首题速度 No-Go：消费 `1/6`，其余 `5 not_run`；Codex 语义初评 fail，产品负责人裁决待确认。
- v2.7 首题技术、速度和合同通过：HTTP 200、`finishReason=stop`、校验问题 `0`；High `1.847s`、冻结 Low＋High `5.188s`，45／60 秒门均通过。
- Thinking 关闭且 `reasoningPresent=false`、`reasoningTokens=null`；prompt `2299`、completion `161`、总计 `2460`，缓存命中／未命中 `2176/123`。
- 可见理解为空、问题 `0`、审计候选 `0`。可见 Low-only 体验 Codex 初评 pass；完整 High Codex 初评 fail，产品负责人原文裁决 pending。
- 完整 High 失败依据：输入主线与认识均为空，输出仍为 `taskChange=unchanged`、`understandingChange=none`，本次纠正未保存；后续 CONTINUE 夹具预置状态，存在因果断点。
- v2.7 新账消费 `1/6`，其余 `5 not_run` 并停止。当前停止点是产品负责人首题原文裁决。
- 页面接入、提交、推送、部署和 Preview 等待离线六题 Go。
- Production 继续使用 `event_centered + baseline`。

公开证据：[首题结果交接](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-7-thinking-disabled-audited-high-quality-v1-handoff.md)、[结果回执](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-7-thinking-disabled-audited-high-quality-v1-receipt.json)与[阶段账](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-7-stage-ledger-v1.json)。公开材料不保存用户或模型正文。
