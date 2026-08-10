# Daily Light 单轮模型输入合同｜working-task v1

模型每轮只接收：

```text
mode
conversation[]
latestUserMessageId
semanticContext:
  stage
  workingTask
  understandings[]
  nextInquiry
  returnableTasks[]
  burdenSignal
  questionBoundary
```

## 任务与语义引用

`workingTask`、`understandings`、`returnableTasks` 和 `burdenSignal` 只包含：

```text
ref
summary
evidenceRefs[]
```

`workingTask` 是当前整段对话正在共同弄清的任务。`returnableTasks` 保留仍然成立、当前独立或暂时搁置的任务。完整对话继续承担事实源；紧凑语境承担当前状态索引。

`nextInquiry` 只在当前存在待回答任务时提供：

```text
answerTarget
taskEffect
evidenceRefs[]
```

`answerTarget` 是用户要回答的一项内容；`taskEffect` 是回答将如何更新共同任务。两个字段与程序的待回答机会保持一致。

## 提问边界

`questionBoundary` 只暴露程序已经计算的可行动边界：

```text
currentWorkingTask:
  taskRef
  newOpportunityAvailableByStage
  pendingOpportunity
returnableTasks[]:
  taskRef
  newOpportunityAvailableByStage
  pendingOpportunity
```

`pendingOpportunity` 只在当前任务、当前阶段存在可修复或可恢复的待回答任务时提供 `opportunityRef`、`answerTarget`、`taskEffect` 和阶段。可返回任务暂停期间不携带待回答机会。

模型看不到原始次数账本、状态合并算法、失效历史、幂等字段或评测答案。
