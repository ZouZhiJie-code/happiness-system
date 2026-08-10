# Daily Light 单轮结果合同 v1

只输出一个合法 JSON 对象：

```json
{
  "semantic": {
    "stage": "engage_focus | explore_clarify | deepen_integrate",
    "action": "acknowledge | ask | synthesize | pause",
    "focus": {
      "change": "set | keep | return",
      "targetRef": "当前焦点、已有支线或归档焦点引用；set 时为 null",
      "summary": "本轮实际工作的焦点",
      "evidenceRefs": ["用户消息 id"]
    },
    "understandingDelta": {
      "summary": "本轮新增或修订的认识",
      "evidenceRefs": ["用户消息 id"]
    },
    "invalidatedRefs": [],
    "archivedRefs": [],
    "importantBranchDelta": {
      "preserveRefs": [],
      "add": [
        {
          "summary": "仍会影响当前选择、值得保留的支线",
          "evidenceRefs": ["用户消息 id"]
        }
      ]
    },
    "openPart": {
      "summary": "当前焦点中唯一仍需处理的部分",
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
- 初次建立或切换焦点使用 `set`，`targetRef` 为 `null`；沿当前焦点使用 `keep`，`targetRef` 指向当前焦点并保持焦点摘要不变；返回已有支线或归档焦点使用 `return`，`targetRef` 指向目标引用并沿用目标摘要。`keep` 和 `return` 的证据至少保留一条原焦点或目标引用的证据，保证状态血缘连续。焦点下的新理解写入 `understandingDelta`，新待处理部分写入 `openPart`。用户此刻只表达停止或负担、尚无可工作的内容时，`focus` 可以为 `null`。
- `set` 用于语义上确实发生变化的新焦点。与当前焦点或已有支线摘要相同的内容继续使用 `keep` 或 `return`，避免通过新建引用重置回答机会。
- 当前焦点被替换、返回支线或清空时，旧焦点必须且只能进入一种去向：用户已经否定的内容写入 `invalidatedRefs`；仍然成立但退出当前工作的内容写入 `archivedRefs`，程序保留其原账本和可返回索引；仍会影响当前选择的重要内容写入 `importantBranchDelta.preserveRefs`。
- `invalidatedRefs`、`archivedRefs` 和 `importantBranchDelta.preserveRefs` 互斥。`archivedRefs` 与 `preserveRefs` 只引用输入紧凑语境中的当前活动引用，`preserveRefs` 只承接当前焦点。`invalidatedRefs` 还可引用用户本轮明确否定的归档焦点；程序会同时删除其可返回索引和原回答机会账本。
- 归档焦点通过 `focus.change = return` 返回。用户新表达了与当前焦点持续相关的重要条件，同时当前焦点继续保持时，把这项条件写入 `importantBranchDelta.add`。新增支线与当前焦点、已有支线、可返回归档焦点保持不同语义；同一回合也不能新增摘要相同的两条支线。已有重要支线会由程序继续保留。
- 同一回合已经失效、归档或保留的语义，不能用完全相同的摘要和证据重新新建。
- `invalidatedRefs` 不引用 `questionBoundary` 中的回答机会编号；机会的完成、复用与失效由程序处理。
- 无认识变化时 `understandingDelta` 为 `null`。修订已有认识时，把被覆盖的认识引用写入 `invalidatedRefs`；程序据此执行替换。
- 无开放部分时 `openPart` 为 `null`；无负担信号时 `burdenSignal` 为 `null`。
- `ask` 必须同时填写 `openPart`、`answerOpportunity` 和 `visible.understanding`；用户可见内容合计一个问题和一项可直接回答的内容。
- `openPart.summary` 是下一问唯一语义来源，`answerOpportunity` 只声明新建或复用回答机会。
- `reuse` 只用于输入中当前阶段已有的待回答机会；新阶段使用新的回答机会。
- `acknowledge`、`synthesize`、`pause` 的 `answerOpportunity` 与 `visible.understanding` 为 `null`，用户可见内容保持零问题。
- `synthesize` 必须填写 `understandingDelta`；`pause` 必须填写 `pauseReason`。
- `ask` 和 `synthesize` 必须拥有焦点。空焦点只用于 `acknowledge` 或 `pause`，并同时保持 `understandingDelta`、`openPart`、`answerOpportunity` 和新增重要支线为空。
- 其他动作的 `pauseReason` 为 `null`。
