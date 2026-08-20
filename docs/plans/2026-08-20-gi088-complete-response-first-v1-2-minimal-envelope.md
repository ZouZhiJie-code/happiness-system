# GI-088｜完整回应优先 v1.2 最小生产合同

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈重构总 Map](../generative-interview-refactor-map.md)

## 1. 为什么重开生产合同

v1.1 纯文本候选已经证明“一个模型独立写完整回应”具备质量和速度方向：八题技术有效，Codex 初评 `7 pass / 1 minor / 0 fail`。同一方法接入旧事件中心完整结构合同后，八题虽然全部 HTTP 200、`finishReason=stop`、单例低于 15 秒且未截断，只有 `2/8` 通过合同；这两条可见结果都只复述用户结论后结束，语义质量未通过。其余六条因事实数组、事件边界、状态字段或证据结构被整条拒绝。

本轮已确认根因：旧合同同时要求一个模型完成自然回应、事实抽取、事件分类、成果判断、状态变更、来源编号和页面表达。后台结构占用了生成注意力，并用“当前问题已经回答”覆盖了 v1.1 的“选择下一层新信息目标”。

## 2. 唯一变化与固定因素

新候选身份：`2026-08-20.gi088-complete-response-first-v1-2-minimal-envelope`

唯一主要因素：把旧的完整事件中心模型输出收缩为“完整可见回应＋本回合最少状态”。模型先输出用户看到的完整回应，随后只提交程序当前写入所需的四类信息：

```ts
{
  response: string;
  interaction: {
    kind: "ask" | "respond" | "stop";
    question: string | null;
  };
  facts: Array<{
    statement: string;
    quote: string;
    kind:
      | "event_detail"
      | "inner_experience"
      | "stated_interpretation"
      | "stated_preference"
      | "boundary_answer";
  }>;
  correction: {
    kind: "none" | "correction";
    supersededAssistantMessageId: string | null;
  };
}
```

确定性边界：

- `response` 是本轮唯一可见正文，页面只显示一个气泡；
- `ask` 必须有且只有一个 `question`，该问题必须逐字包含在 `response` 中；`respond / stop` 的问题为 `null`；
- `facts` 最多四项，`quote` 必须逐字来自本轮用户原话；
- `correction` 只能引用当前有效分支中存在的助手消息；
- 模型输出先由最小合同校验，再由程序确定性映射为现有事实写入、当前问题、状态和 Trace；
- 程序继续负责来源、权限、预算、超时、幂等、恢复和原子写入；自然度、重复、问题价值和推测依据继续由模型方法、Codex 与产品负责人裁决。

固定因素：`deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`maxTokens=1280`、一次调用、一次尝试、45 秒硬门、最近八轮、同一 `3＋5` 八题、一个气泡、原子提交、零重试／恢复／回退。

## 3. 运行与质量门

新离线预算 `8` 次，开发 `3`＋回归 `5`，并发 `1`。普通语义失败与普通合同失败完整跑完整批；连续两次技术失败、内部字段泄漏、忽略明确停止、严重来源造假或预算失控立即停止。

工程门：

- 最小合同严格解析、来源与问题一致性校验；
- 确定性映射后能够沿现有事务保存事实、当前问题、Trace 和助手消息；
- 明确停止零问题；纠正可标记被替代的助手消息；
- 刷新、恢复和重新生成后仍为一个气泡；
- `baseline`、历史 `generative` 和 v1.1 隔离身份保持兼容。

质量门：

- 八题全部得到非空完整回应；纠正、继续、停止、负担和长上下文五个硬场景全部 pass；
- 全体 `0 fail`，最多 `1 minor`；
- 每题按“完整相关原文 → 实际页面输出 → 耗时与 Token → Codex 初评 → 产品负责人裁决”交付；
- 中位不高于 6 秒、单例不高于 15 秒，硬超时 45 秒。

## 4. 页面、Preview 与发布边界

v1.2 使用新的隔离策略 `INTERVIEW_EVENT_CENTERED_STRATEGY=complete_response_v1_2`。离线生产合同质量门通过后，部署隔离 Preview，最多 `15` 次真人调用，覆盖普通表达、关系表达、负担、明确停止、纠正、纠正后继续、长上下文、刷新恢复和重复提交。

产品负责人页面验收通过后才切换 Production。Production 当前继续使用 `event_centered + baseline`；发现严重内容、状态、恢复或权限问题时保持或恢复 baseline。

当前结果：`待验证`。
