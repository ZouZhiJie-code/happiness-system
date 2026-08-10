# Daily Light 单轮结果合同｜working-task v1

只输出一个合法 JSON 对象：

```json
{
  "semantic": {
    "stage": "engage_focus | explore_clarify | deepen_integrate",
    "action": "acknowledge | ask | synthesize | pause",
    "workingTask": {
      "continuity": "new | continue | return",
      "targetRef": "continue 时为当前任务引用；return 时为可返回任务引用；new 时为 null",
      "summary": "整段对话当前正在共同弄清的任务",
      "evidenceRefs": ["用户消息 id"]
    },
    "understandingDelta": {
      "summary": "本轮新增或修订的认识",
      "evidenceRefs": ["用户消息 id"]
    },
    "invalidatedRefs": [],
    "returnableTaskDelta": {
      "preserveRefs": [],
      "add": [
        {
          "summary": "仍然成立、当前独立或暂时搁置的任务",
          "evidenceRefs": ["用户消息 id"]
        }
      ]
    },
    "nextInquiry": {
      "answerTarget": "用户本轮要回答的一项内容",
      "taskEffect": "这份回答将如何更新共同任务",
      "evidenceRefs": ["用户消息 id"]
    },
    "answerOpportunity": "new | reuse | null",
    "burdenSignal": {
      "summary": "影响本轮问停判断的用户负担信号",
      "evidenceRefs": ["用户消息 id"]
    },
    "pauseReason": null
  },
  "visible": {
    "understanding": "ask 时的一至两句陈述式理解回应",
    "response": "用户可见主回应"
  }
}
```

## 硬约束

- 所有 `evidenceRefs` 只引用当前记录中的用户消息。
- 初次建立或真正切换到新任务使用 `new`，`targetRef` 为 `null`。继续当前任务使用 `continue`，`targetRef` 指向当前任务；返回旧任务使用 `return`，`targetRef` 指向可返回任务。
- `continue` 可以根据新原话细化 `summary`，同时保留全部仍有效的原任务证据，且不创建新任务引用。用户明确纠正或放下旧任务时，按失效、切换或可返回规则处理。
- 当前任务被切换或清空时，旧任务必须选择一种去向：用户已经否定时写入 `invalidatedRefs`；仍然成立时写入 `returnableTaskDelta.preserveRefs`。两者互斥。
- 用户新表达了一项与当前任务独立或暂时搁置的内容时，写入 `returnableTaskDelta.add`。相同语义的任务不重复新增。
- 无认识变化时 `understandingDelta` 为 `null`。修订旧认识时，把被覆盖的认识引用写入 `invalidatedRefs`。
- `ask` 必须同时填写 `workingTask`、`nextInquiry`、`answerOpportunity` 和 `visible.understanding`。用户可见内容合计一个问题和一项可直接回答的内容。
- `nextInquiry.answerTarget` 是下一问的直接语义来源；`taskEffect` 说明这项回答将怎样更新 `workingTask`，并且不预设答案。
- `nextInquiry` 与程序待回答机会同时存在；`answerTarget` 和 `taskEffect` 内容一致。`reuse` 只用于当前阶段已有的待回答机会。
- `acknowledge`、`synthesize`、`pause` 的 `nextInquiry`、`answerOpportunity` 和 `visible.understanding` 为 `null`，用户可见内容保持零问题。
- `synthesize` 必须填写 `understandingDelta`；`pause` 必须填写 `pauseReason`。其他动作的 `pauseReason` 为 `null`。
- 用户只表达停止或当前无可聊内容时，`workingTask` 可以为 `null`。空任务只用于 `acknowledge` 或 `pause`。
