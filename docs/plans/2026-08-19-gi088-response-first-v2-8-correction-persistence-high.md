# GI-088｜回应优先 v2.8 Correction-persistence High

- 文档职责：历史证据
- 文档状态：待验证
- 最后核验：`2026-08-19`
- 权威入口：[生成式访谈重构总 Map](../generative-interview-refactor-map.md)
- 父结果证据：[v2.7 首题结果交接](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-7-thinking-disabled-audited-high-quality-v1-handoff.md)

## 1. 为什么只修复纠正状态持久化

v2.7 首题已经证明关闭 High Thinking 可以同时保住快速可见回应和完整结构：High `1.847s`，冻结 Low＋High `5.188s`，HTTP 200、`finishReason=stop`、来源与状态合同均有效；可见理解为空、问题 `0`，Codex 对 Low-only 可见体验初评为 pass。

完整 High 仍然失败。首题输入中的 `workingTask` 与 `understandings` 均为空，High 输出 `taskChange=unchanged`、`understandingChange=none`，本次纠正没有形成可供后续使用的主线、认识或旧接纳失效。后续 CONTINUE 夹具又直接预置了这些状态，形成因果断点，无法证明真实连续性。

因此 v2.8 保留 v2.7 已通过的速度与可见行为，只让 High 在组织问题和可见追加前，显式审计本轮纠正是否需要进入状态，并提交与审计一致的状态变化。

## 2. 身份与唯一主要因素

- 候选：`2026-08-19.gi088-response-first-v2-8-correction-persistence-high`
- 运行：`2026-08-19.gi088-response-first-v2-8-correction-persistence-high-quality-v1`
- 父候选：`2026-08-19.gi088-response-first-v2-7-thinking-disabled-audited-high`
- 唯一主要因素：High 增加 audit-first 的显式纠正状态持久化方法。

以下因素全部冻结：

- `deepseek-v4-pro`、High Thinking `disabled`、省略 `reasoningEffort`、`maxTokens=4000`；
- v2.2 冻结 Low、Low 字节级输出、六题用户原文和产品判尺；
- v2.7 的问题自答审计、JSON 主体、来源与状态合同、可见理解和问题规则；
- 首题可见行为：冻结 Low 保持原样，High 可见理解为 `null`、问题为 `0`；
- 两段式、并发 1、45 秒完整两段目标、60 秒技术硬门；
- 自动重试、质量重试、恢复调用和回退均为 `0`。

CONTINUE 题的用户原文与判尺保持不变；其内部状态改为真实继承首题产出的 post-state，用于修复评测因果链，不预置人工主线、认识或失效项。

## 3. audit-first 纠正持久化方法

High 在决定可见理解、问题和 `informationGainAudit` 之前先完成 `correctionPersistenceAudit`：

```ts
correctionPersistenceAudit: {
  decision: "none" | "persist";
  correctedMeaning: {
    summary: string;
    evidenceRefs: string[];
  } | null;
  supersededAssistantMessageRefs: string[];
  statePlan: {
    task:
      | { kind: "set_new" }
      | { kind: "continue"; targetRef: string };
    understanding:
      | { kind: "add" }
      | { kind: "revise" | "invalidate"; targetRef: string };
  } | null;
}
```

行为规则：

1. 当前有效用户消息明确纠正既有理解时，审计使用 `decision=persist`，在 `correctedMeaning` 引用纠正来源，并通过 `supersededAssistantMessageRefs` 标明被替代的 AI 理解；
2. 空主线、空认识下仍需要保存纠正时，`statePlan` 使用 `task.set_new` 与 `understanding.add`，语义结果必须提交对应的 `taskChange=set/new` 与 `understandingChange=add`；
3. 已有认识被纠正时使用 `understanding.revise`；用户撤回一条已有认识且没有替代认识时可以使用 `invalidate`。已有主线内继续纠正后的焦点时使用 `task.continue`；
4. 本轮没有明确纠正时使用 `decision=none`，其余审计字段为空；普通表达仍可按既有合同形成自己的状态变化；
5. 状态持久化与用户可见追加分开决定，保存纠正不强迫重复展示纠正，也不强迫提问。

程序只校验审计字段、用户来源、引用状态、审计声明与状态变化的一致性。程序不判断自然语言是否构成纠正，也不判断状态摘要是否语义合理；这些继续由模型方法、Codex 初评和产品负责人原文裁决承担。

## 4. 预算、验证门与停止点

新离线账最多 `6` 次：首题 `1` 次，其余五题 `5` 次；并发 `1`，重试、恢复和回退均为 `0`。

1. 静态验证通过后先运行 `RPR-REAL-19-CORRECTION`；
2. 首题必须以 `U3` 为纠正依据，把本次纠正保存到 post-state，并把承载旧“已经接纳”理解的 AI 消息标为被替代；本题初始状态中没有对应旧认识，因此 post-state 只保留纠正后含义；
3. 首题可见行为保持 v2.7：冻结 Low 不变，High 可见理解为 `null`、问题为 `0`；
4. 首题需要 HTTP 200、目标模型正确、`finishReason=stop`、完整 JSON、来源／状态／两个审计合同有效；
5. 完整两段不高于 `45s` 才通过速度方向门，`45～60s` 记为速度 No-Go，超过 `60s` 记为技术 No-Go；
6. 技术、状态、可见行为和 Codex 初评通过后，按完整原文与实际输出交付产品负责人；首题产品裁决 `pass` 后才进入其余五题；
7. CONTINUE 题必须从首题实际 post-state 构造输入，并证明该题读取到首题保存的纠正；
8. 任一题出现截断、超时、来源错误、状态合同失败、纠正未保存、可见行为退化或产品质量硬门失败，立即停止剩余调用；
9. 六题质量门为五个硬案例全部 `pass`，软案例最多一个 `minor`；完整两段中位数不高于 45 秒、单例不高于 60 秒。

## 5. 自动验证与证据

自动验证至少覆盖：

- 明确纠正且空状态时，审计要求 `set/add`，post-state 包含 `U3`；
- 明确纠正已有状态时，旧接纳失效或被修订；
- 无需持久化时允许 `unchanged/none`；
- `decision=persist` 与声明的 `statePlan`、实际 `taskChange`、`understandingChange` 不一致时被拒绝；
- 审计引用只来自当前有效用户消息或可引用的旧状态；
- 首题冻结 Low 与可见 High 行为保持 v2.7；
- CONTINUE 使用首题实际 post-state，禁止夹具预置目标状态；
- Thinking 关闭、`reasoningEffort` 省略、`4000` Token、45／60 秒分账和 `1＋5` 停止门；
- 私有正文隔离，公开证据只保存身份、指纹、状态、指标、哈希和数量。

执行前绑定 AI 评测总规范 SHA、候选指纹、计划指纹、数据指纹、父结果、启动卡和私有结果账。自动测试只证明结构和因果链；自然度、纠正含义与长期价值继续等待原文质量裁决。

## 6. 最终分层结果与发布边界

- v2.8 首题技术、速度和合同通过：HTTP 200、`finishReason=stop`、校验问题 `0`；High `4.445s`、冻结 Low＋High `7.786s`，45／60 秒门均通过。
- Thinking 关闭且 `reasoningPresent=false`、`reasoningTokens=null`；prompt `3007`、completion `369`、总计 `3376`。
- 纠正审计选择 `persist`，引用 `U3`、标记 `A2` 被替代，状态计划为主线 `set_new`、认识 `add`；真实 post-state 形成一条引用 `U3` 的主线和一条引用 `U3` 的认识。
- 冻结 Low 保持原文；High 可见理解为 `null`、问题为 `0`，可见体验 Codex 初评 `pass`；纠正持久化 Codex 初评 `pass`。
- post-state 的 `workingTask` 与 `understanding` 使用同一摘要。项目合同中前者承担“共同还要弄清什么”，后者承担“当前已经知道什么”，因此 Codex 将状态职责折叠记为 `state-role minor`；当前可见伤害尚未发生，产品负责人原文裁决保持 `pending`。
- 新账消费 `1/6`，其余 `5 not_run` 并随原 v2.8 runner 退役。真实连续性改由 v2.8.1 独立探针验证，不继续使用本计划的其余五题入口。
- 页面接入、提交、推送、部署和 Preview 均为 `not_run`。
- Production 继续使用 `event_centered + baseline`；生成式能力保持关闭。

公开证据：[首题结果交接](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-8-correction-persistence-high-quality-v1-handoff.md)、[结果回执](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-8-correction-persistence-high-quality-v1-receipt.json)与[阶段账](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-8-stage-ledger-v1.json)。公开材料不保存用户、Low 或 High 正文。

下一当前专项：[v2.8.1 真实连续回合因果探针](./2026-08-19-gi088-response-first-v2-8-1-causal-continuation-probe.md)。该探针继续使用 v2.8 候选，只在产品负责人将首题判为 `pass` 或 `minor` 后，按真实顺序各调用一次 Low 与 High。
