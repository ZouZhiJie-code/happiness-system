# GI-088｜回应优先 v2.6 Low-effort Audited High

- 文档职责：当前专项
- 文档状态：No-Go
- 最后核验：`2026-08-19`
- 权威入口：[生成式访谈重构总 Map](../generative-interview-refactor-map.md)
- 父失败证据：[v2.5 首题技术超时交接](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-5-question-self-answer-high-quality-v1-handoff.md)

## 1. 为什么调整 High 思考强度

v2.5 首题在预检和正式请求阶段均收到 HTTP 200，说明模型服务与请求链路可用。正式调用在 `60.013s` 到达技术硬门时正文仍为 0 字符，冻结 Low＋High 总耗时为 `63.354s`。因此 v2.5 只能确认完整交付失败，候选问题自答审计的语义效果保持未评价。

当前最小可验证假设是：High 的高思考强度叠加结构化问题审计后，工作量超出本轮 60 秒交付边界。v2.6 只降低 High 的思考强度，用同一首题同时观察完整性、速度、审计有效性和最终问题价值。

## 2. 身份与唯一变量

- 候选：`2026-08-19.gi088-response-first-v2-6-low-effort-audited-high`
- 运行：`2026-08-19.gi088-response-first-v2-6-low-effort-audited-high-quality-v1`
- 父候选：`2026-08-19.gi088-response-first-v2-5-question-self-answer-high`
- 唯一主要因素：High `reasoningEffort=high → low`

以下因素全部固定：

- v2.2 冻结 Low 及其六题原文；
- 六题输入、产品负责人判尺和执行顺序；
- `deepseek-v4-pro`、Thinking 开启、High `maxTokens=4000`；
- v2.5 的系统提示、`informationGainAudit`、输出结构、状态合同与可见投影；
- 两段式、Low 字节级冻结、来源校验、并发 1；
- 60 秒完整两段硬门，重试、恢复和回退均为 0。

## 3. 产品行为与质量责任

High 继续先为每个候选问题检查完整有效用户原文：

1. 原文已经能够回答的候选，记录已有答案与用户来源，并退出可见问题；
2. 原文尚未覆盖且预计能改变当前认识的候选，才允许进入可见问题；
3. 可见问题保持 0 个或 1～3 个共同服务同一回答焦点的问题；
4. 可纠正理解继续只引用当前分支中有效的用户消息。

程序继续校验字段、来源、角色、状态、结构、预算、超时和模型自身声明的一致性。Codex 按“完整相关原文 → 冻结 Low → High 原始输出 → 可见追加 → 技术与 Token → 逐问已有答案映射”提供初评；产品负责人基于同一原文作最终语义裁决。

## 4. 预算、验证门与停止点

新离线账最多 `6` 次，分为首题 `1` 次和其余五题 `5` 次：

1. 静态验证通过后，只运行 `RPR-REAL-19-CORRECTION`；
2. 首题需要 HTTP 200、目标模型正确、完整正文、JSON 与来源／状态／审计合同有效，完整两段不超过 60 秒；
3. 技术与合同有效后，交付完整原文和实际输出；产品负责人裁决 `pass` 才进入其余五题；
4. 首题出现技术失败、合同失败、`minor` 或 `fail` 时立即停止，其余 `5` 次记录为 `not_run`；
5. 其余五题逐题运行；任一题发生截断、超时、来源错误、状态合同失败或产品质量硬门失败，立即停止剩余调用；
6. 六题质量门保持五个硬案例全部 `pass`，软案例最多一个 `minor`；完整两段中位数目标不高于 45 秒，单例硬门不高于 60 秒。

## 5. 执行与证据

执行前建立独立候选、启动卡、私有结果账和公开回执，绑定 AI 评测总规范 SHA、父候选指纹、冻结 Low 指纹、六题数据指纹与本计划指纹。静态验证覆盖 High low 参数、审计—可见问题一致性、有效用户来源、空主线／已有主线状态合同、Low 冻结、4000 Token、60 秒硬门和单次调用记账。

每次语义判断继续提供直接依据：完整相关用户输入和 AI 实际输出先交付，Codex 初评随后展示，产品负责人作最终裁决。公开证据只保存脱敏状态、指标、指纹和数量；用户与模型正文继续保存在 Git 排除的私有边界。

## 6. 最终状态与发布边界

- v2.5 已以首题技术超时封存：`1/6`，其余 `5 not_run`，语义未评价。
- v2.6 首题 HTTP 200、`finishReason=stop`、完整返回且合同有效；High `56.668s`，冻结 Low＋High `60.009s`，超过 60 秒硬门 `9ms`，速度门 No-Go。
- Completion `3462/4000`，reasoning `3132`；降低 `reasoningEffort` 未使本题进入速度边界。
- High 可见追加一处理解、问题 0 个。Codex 初评 fail，产品负责人语义裁决待确认。
- v2.6 消费 `1/6`，其余 `5 not_run`。页面接入、提交、推送、部署和 Preview 均为 `not_run`。
- 下一当前专项为[v2.7 Thinking-disabled Audited High](./2026-08-19-gi088-response-first-v2-7-thinking-disabled-audited-high.md)，只关闭 High Thinking。
- Production 继续使用 `event_centered + baseline`。
