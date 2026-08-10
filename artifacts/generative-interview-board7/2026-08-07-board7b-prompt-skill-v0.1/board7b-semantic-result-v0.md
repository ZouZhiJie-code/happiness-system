# 最小结构化语义结果 v0

每次调用只输出一个合法 JSON 对象，结构固定为：

```json
{
  "semantic": {
    "stage": "engage_focus | explore_clarify | deepen_integrate",
    "action": "acknowledge | ask | synthesize | pause",
    "focus": {
      "summary": "当前唯一工作焦点",
      "relation": "keep | shift | return | unclear",
      "evidenceRefs": ["用户消息 id"]
    },
    "understandingDelta": {
      "kind": "none | add | revise",
      "summary": null,
      "evidenceRefs": []
    },
    "invalidatedStateRefs": [],
    "openPart": {
      "summary": "用户主动打开且仍未解的具体部分",
      "evidenceRefs": ["用户消息 id"]
    },
    "questionDecision": {
      "goal": "希望用户回答后新增什么理解",
      "expectedChange": "不同回答会怎样改变当前理解",
      "answerOpportunity": "new | reuse"
    },
    "burdenSignal": {
      "summary": "影响本轮问停判断的用户负担信号",
      "evidenceRefs": ["用户消息 id"]
    },
    "pauseReason": null
  },
  "visible": {
    "understanding": "ask 时的一至两句新增理解，其他动作填 null",
    "response": "用户可见主回应"
  }
}
```

## 字段规则

- `openPart`、`questionDecision`、`burdenSignal` 根据当前动作允许为 `null`。
- `understandingDelta.kind = none` 时，`summary` 为 `null`，`evidenceRefs` 为空数组。
- `understandingDelta.kind = add | revise` 时，需要填写具体认识和用户消息来源。
- `ask` 需要同时填写 `openPart`、`questionDecision` 和 `visible.understanding`，全部用户可见文本合计一个问题。
- `acknowledge`、`synthesize`、`pause` 的 `questionDecision` 与 `visible.understanding` 为 `null`，全部用户可见文本保持零问题。
- `synthesize` 的 `understandingDelta.kind` 为 `add` 或 `revise`。
- `pause` 需要填写 `pauseReason`；其他动作的 `pauseReason` 为 `null`。
- `invalidatedStateRefs` 只引用输入紧凑状态中当前有效的稳定语义编号。
- 所有 `evidenceRefs` 只引用当前记录中 `role = user` 的消息编号。
- 结构只保存结论和状态变化，不保存逐步推理。

## 程序合并职责

- 程序采用本轮变化更新阶段、焦点、认识、开放部分、失效项、负担信号和回答机会账本。
- `focus.relation = keep` 沿用当前焦点身份；`shift` 创建新焦点并保留原焦点为重要支线；`return` 恢复输入状态中摘要完全一致的重要支线及其回答机会账本；`unclear` 保持当前焦点身份并记录当前最有依据的表达。
- `invalidatedStateRefs` 指向的状态退出当前有效集合，并进入失效记录。
- `questionDecision.answerOpportunity = new` 时，程序为阶段 1～2创建并计数新的回答机会；阶段 3保持动态问停。`reuse` 只复用输入中仍在等待回答的机会。
- 模型输出本轮差量，程序维护稳定身份、计数、幂等和恢复；完整历史继续保存在当前记录中。
