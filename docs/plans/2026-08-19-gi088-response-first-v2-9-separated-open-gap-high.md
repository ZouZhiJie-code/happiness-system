# GI-088｜回应优先 v2.9 已知认识／开放目标分离计划

- 文档职责：当前专项
- 文档状态：已完成
- 最后核验：`2026-08-19`
- 权威入口：[`生成式访谈重构总 Map`](../generative-interview-refactor-map.md)

## 1. 当前结论

v2.8.1 已完成真实纠正后继续回合，产品负责人裁决 `fail`。

- Low 有效且产品语义通过；High 重复询问完整原文已经回答的最近案例。
- High 自己把已有答案判断为 `null`，说明后置信息增量审计未形成有效覆盖门。
- 输入中的 `workingTask` 与 `understanding` 保存同一条已知纠正含义，开放推进目标为空。
- High 还把审计层的 `continue` 动作写进执行层，造成状态合同失败。
- Low `5798ms`、High `5864ms`、客观两段 `11662ms`；High completion `358/4000`，速度、网络和 Token 上限均已排除。

本轮解决一个概念根因：**把“已经知道什么”和“还要弄清什么”分开，并在问题生成前完成完整原文覆盖判断。**

## 2. 候选身份与冻结项

- 候选：`2026-08-19.gi088-response-first-v2-9-separated-open-gap-high`
- 运行族：`2026-08-19.gi088-response-first-v2-9-two-turn-causal-quality-v1`
- 当前首题运行：`2026-08-19.gi088-response-first-v2-9-correction-gate-v1`
- 数据：继续绑定 `2026-08-17.gi088-response-first-six-real-checkpoints-v1-3-product-owner-rubric`
- 评测规范 SHA-256：`08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60`
- 冻结 Low：v2.2 factual-low
- 冻结模型：`deepseek-v4-pro`
- High：Thinking 关闭，`maxTokens=4000`
- 并发 `1`；自动重试、质量重试、恢复和回退均为 `0`
- 页面、Preview、提交、推送、部署和 Production 继续不运行；Production 保持 `event_centered + baseline`

## 3. 单一权威决定

High 原始输出只提交一份 `turnDecision`。现有链路需要的 `semantic` 与 `visibleAppend` 由程序根据同一份决定做确定性兼容投影；历史两份审计由 canonical decision 和观察摘要取代，模型不再重复填写同一个动作或问题。

```ts
type TurnDecision = {
  coverageGate: null | {
    checkedUserMessageRefs: string[];
    targetGap: string;
    coverage: "answered" | "partial" | "open";
    existingAnswer: {
      summary: string;
      evidenceRefs: string[];
    } | null;
    remainingGap: string | null;
    expectedGain: string | null;
    evidenceRefs: string[];
  };
  understandingChange:
    | { kind: "none" }
    | {
        kind: "add" | "revise";
        sourceMode: "ordinary" | "correction";
        targetRef?: string;
        summary: string;
        evidenceRefs: string[];
        supersededAssistantMessageRefs: string[];
      }
    | {
        kind: "invalidate";
        sourceMode: "correction";
        targetRef: string;
        reason: string;
        evidenceRefs: string[];
        supersededAssistantMessageRefs: string[];
      };
  openTaskChange:
    | { kind: "none" }
    | { kind: "set_new" }
    | { kind: "continue" | "return"; targetRef: string }
    | { kind: "clear"; targetRef: string };
  questions: string[];
  correctableUnderstanding: {
    text: string;
    evidenceRefs: string[];
  } | null;
  burdenAndControlChange: unknown;
  relationshipExplanations: unknown[];
};
```

字段顺序固定为：`coverageGate → understandingChange → openTaskChange → questions → correctableUnderstanding → burdenAndControlChange → relationshipExplanations`。

行为规则：

1. `understandingChange` 只保存已经由用户原文支持的认识。
2. `remainingGap` 是开放任务摘要的唯一模型文字来源；`workingTask` 只保存尚未解决的目标。
3. 纠正可以只保存认识并保持开放任务为空。程序允许 `workingTask=null` 与纠正认识写入同时存在。
4. 提问前必须检查当前分支全部用户消息；`checkedUserMessageRefs` 由程序核对是否完整。
5. `coverage=answered` 时 `remainingGap=null`、问题为空；`partial/open` 只有在仍存在高价值缺口时才能提问。
6. 问题只生成一次。程序把同一份问题投影到兼容字段和可见追加，避免两份问题互相矛盾。
7. 本轮最多选择一个回答焦点；问题保持 `0` 或共同服务该焦点的 `1～3` 句。问号数量只记录观察。

## 4. 模型与程序责任

模型和产品质量评测负责：

- 已有原文是否已经回答目标；
- 剩余缺口是否真实、有价值；
- 开放任务与已知认识是否语义分离；
- 问题是否只索取剩余信息；
- 可见理解是否自然、忠实并有依据。

程序负责：

- 字段、顺序、来源角色、当前状态引用和全部用户消息检查范围；
- `remainingGap`、任务动作、问题和兼容输出之间的确定性映射；
- 权限、预算、超时、恢复、幂等、写入权和私有证据；
- 记录任务摘要与认识摘要字节级相同的碰撞；同义碰撞继续交质量评测。

程序不把畸形旧输出自动补成合法状态，也不判断某个缺口在语义上是否真的开放。

## 5. 调用预算与运行顺序

新离线预算最多 `7` 次，按产品停止门拆成独立冻结运行身份；当前只开放首题 `1` 次，其余 `6` 次保持 `not_run`：

1. `RPR-REAL-19-CORRECTION`：使用产品已通过的冻结 Low，只运行 High，`1` 次。
   - 必须保存纠正后的认识；开放任务保持空；High 可见理解为空、问题为 `0`。
   - 技术、合同或产品语义失败立即停止。
2. `RPR-REAL-19-CONTINUE`：使用第 1 题实际 post-state 和实际气泡，重新运行 Low → High，`2` 次。
   - 必须建立一个此前尚未回答的开放目标。
   - 禁止重新询问最近时间、事情经过或用户是否仍在意比较。
   - 技术、合同或产品语义失败立即停止。
3. `RPR-LC-21`：长上下文覆盖门，High `1` 次。
4. `RPR-REAL-22`：停止／控制门，High `1` 次。
5. `RPR-REAL-13`：关系表达依据门，High `1` 次。
6. `RPR-REAL-06`：普通表达软案例，High `1` 次。

每题都按“完整相关原文 → 实际 Low → 实际 High 原始决定 → 程序投影 → Codex 初评 → 产品负责人裁决”交付。任一硬案例 `fail` 后，剩余调用全部记为 `not_run`。

## 6. 技术门与质量门

- Provider HTTP 200、目标模型一致、`finishReason=stop`、JSON 完整。
- High 单次不高于 `60s`；真实 Low → High 回合目标不高于 `45s`、硬门不高于 `60s`。
- `finishReason=length` 单独记为 Token 上限不确定，停止后续调用。
- Low 字节级冻结或在真实连续回合中通过 v2.2 合同。
- 引用只来自当前有效消息；修订、失效、继续和返回只引用当前有效状态。
- 纠正题的 post-state 必须允许 `workingTask=null` 且认识已保存。
- 继续题的 post-state 必须让任务表达尚待弄清的方向，认识表达已经知道的内容。
- 五个硬案例全部通过；普通软案例最多一个轻微问题。

## 7. 实现与停止点

执行顺序：

1. 封存 v2.8.1 产品 `fail` 与两条独立失败原因。
2. 实现 v2.9 canonical decision、兼容投影、状态规则和专项测试。
3. 先实现首题 `1` 次的独立运行器、启动卡、私有账本、公开回执和原文评审卡。产品通过后再以新的冻结身份实现真实 CONTINUE `2` 次；其余四题同样在前门通过后建立后续身份，避免运行后改写已封存 runner。
4. 完成专项测试、类型检查、定向 Lint、评测规范 SHA、JSON、隐私权限、`docs:check` 和 `git diff --check`。
5. 只运行纠正首题，交付原文并等待产品裁决。

当前停止点：**v2.9 首题输出完成后停止；在产品负责人裁决前不运行真实 CONTINUE。**

主要风险：单次 High 仍可能把已有答案错误标成开放。真实 CONTINUE 与长上下文题分别验证近期覆盖和跨窗口覆盖；程序保持观察与来源校验，不承担语义拦截。

## 8. 纠正首题实际结果

- 运行身份：`2026-08-19.gi088-response-first-v2-9-correction-gate-v1`
- 调用：High `1/1` 已消费并完成；其余运行族额度 `6 not_run`
- 技术与合同：HTTP 200、目标模型正确、`finishReason=stop`、校验问题 `0`
- 时间：冻结 Low `3341ms`、High `3325ms`、观察两段 `6666ms`，45／60 秒门通过
- Token：prompt `1981`、completion `151`、总计 `2132`；High 上限 `4000`，未触发截断
- 状态：纠正认识引用 `U3`，标记 `A2` 被替代；`workingTask=null`、`nextInquiry=null`
- 可见结果：High 可见理解为空、问题为 `0`，用户只看到冻结 Low
- Codex 初评：`pass`
- 产品负责人裁决：`pass`

产品负责人已基于完整相关原文与实际 AI 输出将首题裁决为 `pass`。首题停止门已经通过，后续真实 CONTINUE 转入独立专项[回应优先 v2.9 真实纠正后继续验证](./2026-08-19-gi088-response-first-v2-9-causal-continuation-gate.md)；本文件继续承担候选设计与首题父证据职责。
