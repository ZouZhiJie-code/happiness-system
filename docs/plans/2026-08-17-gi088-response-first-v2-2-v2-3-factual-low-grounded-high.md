# GI-088｜回应优先 v2.2／v2.3：事实 Low 与有依据 High

- 文档职责：当前专项
- 文档状态：No-Go
- 最后核验：`2026-08-17`
- 权威入口：[生成式访谈重构总 Map](../generative-interview-refactor-map.md)
- 上游 No-Go：[回应优先 v2.1 最终结果](./2026-08-17-gi088-response-first-v2-1-quality-repair-and-preview.md)

## 1. 本轮产品决定

回应优先 v2.1 已证明 Low 能在约 5 秒完整返回；三题内容失败集中在未经确认的动机与心理结论、纠正后重复承接和缺少依据的具体体验。本轮保持两段式、最多两次模型调用、模型、Thinking、上下文和 Token 配置，只分两步收紧语义职责。

1. `v2.2 factual-low`：Low 只自然承接用户明确说出的事实与感受。简短、平实、自然且忠实的回应可以直接通过。
2. `v2.3 grounded-high`：继承通过的 v2.2 Low；High 只有在有效用户依据支持时，才追加一处可纠正理解，并可提出一至三个共同服务同一回答焦点的问题句。

Low 的零提问继续承担两段式阶段边界。High 的问号数量只作观察；语义重复、自然度、推测合理性和具体体验是否有依据，由模型方法、Codex 质量评测与产品负责人裁决。

Production 保持 `event_centered + baseline`。Judge、模型／Thinking 比较、合同精简、页面接入、Preview 和 Production 均遵守本页阶段门。

## 2. 身份、预算与运行条件

| 阶段 | 固定身份 | 预算 | 当前状态 |
|---|---|---:|---|
| v2.1 父证据 | `2026-08-17.gi088-response-first-v2-1-low-quality-v1` | 已消费 `3/35` | `No-Go`；剩余 `32 not_run` |
| v2.2 候选 | `2026-08-17.gi088-response-first-v2-2-factual-low` | 三题检查点 `3`＋完整六题 `6` | Codex 初评 `1/3`；产品负责人裁决 `2/3`，`No-Go` |
| v2.3 候选 | `2026-08-17.gi088-response-first-v2-3-grounded-high` | 冻结 Low 的三题 `3`＋完整六题 `6` | `0/9 not_run` |
| 隔离 Preview | `response_first` | 最多 `15` 次 | `not_run` |

- 评测总规范完整 SHA-256：`08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60`。不一致时在密钥和网络访问前停止。
- 模型：`deepseek-v4-pro`；Low `reasoningEffort=low`、High `reasoningEffort=high`。
- Low `maxTokens=1280`；High `maxTokens=2000`；并发 `1`；自动重试、质量重试、恢复调用和回退均为 `0`。
- 离线新账最大 `18` 次，Preview 独立最大 `15` 次。旧 v2.1 账本保持冻结。
- 私有正文、模型正文和逐题评价写入 Git 排除目录；公开证据只保存身份、指纹、耗时、Token、状态和数量。

## 3. 第一阶段｜v2.2 factual-low

唯一主要因素：移除 Low“可补充一个高层感受或张力”的权限，明确只使用用户最新一句、仍有效的用户事实、用户明确表达的感受和控制要求。最近 8 条消息、最多 3 条已失效认识、纯文本输出、`1280` Token、模型和 Thinking 均保持 v2.1 原值。

先运行 `RPR-REAL-19-CORRECTION`、`RPR-REAL-19-CONTINUE`、`RPR-REAL-13` 三题检查点：

- 技术与合同有效 `3/3`，正文完整，Low 零提问且无内部字段泄漏；
- Codex 内容初评 `3 pass / 0 minor / 0 fail`；
- 中位耗时不高于 `6s`，单例不高于 `15s`，技术硬超时 `45s`；
- 新纠正只承接一次，已承接纠正沿修正后的内容推进，关系题只使用已有依据；
- 平实但自然、忠实的回应按 pass 处理。

检查点任一门失败时，封存实际结果，完整六题、v2.3、产品接入与 Preview 记为 `not_run`。检查点通过后才运行完整六题；五个硬案例全部 pass，软焦点案例最多 minor。

## 4. 第二阶段｜v2.3 grounded-high

v2.3 只在 v2.2 通过后启动，并复用冻结 Low 输出。High 保留现有完整语义合同和信息增量策略 B，新增：

```ts
visibleAppend: {
  correctableUnderstanding: {
    text: string;
    evidenceRefs: string[];
  } | null;
}
```

程序只校验 `evidenceRefs` 是否属于当前分支仍有效的用户来源、结构是否有效、状态迁移与预算是否一致。可纠正理解保持 `unconfirmed`；依据不足时省略理解，可使用中性追问或结束本轮。问题继续位于 `semantic.nextResponse.questions`，结构上允许 `0` 或 `1～3` 个，并共享一个 `answerFocus`。

v2.3 先运行三题检查点，再运行完整六题；每阶段要求来源合同有效、Low 保持冻结、无重复纠正、无新增动机或具体体验，并满足完整两段中位数不高于 `45s`、单例不高于 `60s`。任一门失败后停止后续任务。

## 5. 产品接入、恢复与 Preview 门

只有 v2.2、v2.3 离线质量门及产品负责人六卡裁决均为 Go，才接入 `INTERVIEW_EVENT_CENTERED_STRATEGY=response_first`。用户看到 Low 先在一个气泡中出现，High 在同一气泡追加；Low 前缀保持冻结。

持久化继续复用 `InterviewUserTurn.eventOperationData`，用 `low_started / low_ready / high_started / high_ready` 记录每次调用前后的确定状态。每个 `clientTurnId` 最多两次模型调用；60 秒到达、High 失败或写入权失效时提交 Low-only 回应并解锁输入。无需新增 Prisma 表或字段。

隔离 Preview 覆盖普通表达、新纠正、纠正后继续、关系表达、停止／少问和刷新／恢复六类回合，最多 `15` 次调用。Preview 通过仍保持 Production 关闭，Production 变更进入独立裁决。

## 6. 执行与验证

1. 执行前指纹化当前脏工作区，并保护已有 v2／v2.1 文件和私有证据。
2. 实现候选、固定指纹、启动卡、运行器、私有账本、公开回执与专项测试。
3. 严格按三题检查点 → 六题完整批次推进；技术失败、质量失败和体验失败分别记账。
4. 离线 Go 后实现同气泡、SSE 分段、两次调用检查点与 60 秒写入权边界。
5. 验证专项与全量测试、Lint、类型检查、Production 构建、两套 Prisma、文档检查和 `git diff --check`；并行失败与隔离复跑分别报告。
6. 按补丁块暂存本轮明确文件，形成候选证据、产品接入、最终文档三组提交；推送当前分支并部署隔离 Preview。
7. 结束前同步总 Map、本专项、README、AGENTS、Handoff、证据索引和问题台账。

## 7. 当前停止点

v2.2 三题检查点已完成并触发内容停止门。新离线账消费 `3/18`，其余 `15 not_run`；Preview `0/15 not_run`。v2.2 完整六题、v2.3、产品负责人六卡、页面接入、提交、推送、部署和 Preview 均保持 `not_run`。Production 保持 `event_centered + baseline`。

## 8. 最终执行结果

| 项目 | 结果 |
|---|---|
| 候选／运行身份 | `2026-08-17.gi088-response-first-v2-2-factual-low`／`2026-08-17.gi088-response-first-v2-2-low-quality-v1` |
| 计划／候选／数据集指纹 | `da8fbf66…811f`／`c0e99522…b01f`／`59d524f8…48cc` |
| 调用 | 三题检查点 `3/3`；重试、恢复、降级 `0`；其余离线调用 `15 not_run` |
| 技术与速度 | HTTP 200、合同有效、`finishReason=stop` 均为 `3/3`；耗时 `4.016 / 2.812 / 3.854s`，中位数 `3.854s` |
| Token 与费用 | prompt `3261`、completion `326`、reasoning `225`、总计 `3587`；按项目 `2026-08-10` 冻结价估算 `¥0.011739`，Provider 回执未返回实际账单金额 |
| Codex 私有初评 | `1 pass / 0 minor / 2 fail` |
| 产品负责人裁决 | 查看对应用户输入与 AI 输出后，`2 pass / 0 minor / 1 fail` |
| 通过案例 | 新纠正通过；关系题的自然语义转化被确认能够表达用户原意，无需干预 |
| 失败案例 | 已承接纠正后仍重复复述，没有沿用户“继续深挖”的要求推进 |
| 裁决 | `No-Go · stopped_by_checkpoint_quality_gate` |
| 产品与发布 | v2.3、六卡、页面接入、提交、推送、部署与 Preview 均为 `not_run`；Production 保持 `event_centered + baseline` |
| 工程验证 | v2.2 专项 `7/7`、父版本与相邻回归 `30/30`、全量测试 `3404` 通过／`10` 跳过；类型检查、两套 Prisma、文档检查、JSON、隐私边界、差异格式和 Production 构建通过；Lint `0` 错误／`45` 警告；构建保留 `16` 条既有动态文件访问警告 |

本次单因素在新纠正与关系表达两题达到产品负责人要求；当前唯一剩余质量问题是纠正已经承接后仍重复复述。三题门要求 `3/3`，因此 `2/3` 仍触发 No-Go。运行器继承了 v2.1 已知的顶层状态选择遗漏，私有账与阶段决定始终正确；公开顶层状态通过零调用修正回执校正，执行时运行器 SHA 与候选保持原样。

产品负责人的关系题裁决同时更新后续判尺：能够表达用户原意的自然语义转化可以通过，无需逐字复刻。回归集 v1.2 与本次运行继续保持原身份和指纹；任何后续模型运行需先建立承接该裁决的新数据集身份，避免沿用旧判尺再次误判。

公开证据见[启动卡](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-2-low-quality-v1-start-card.json)、[结果回执](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-2-low-quality-v1-receipt.json)、[零调用修正](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-2-low-quality-v1-runner-fix.json)、[产品负责人三题裁决](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-2-product-owner-checkpoint-review-v1.json)、[阶段账](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-2-v2-3-stage-ledger.json)和[结果交接](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-2-low-quality-v1-handoff.md)。
