# Daily Light 单轮模型输入合同 v1

模型每轮只接收以下内容：

```text
mode
conversation[]
latestUserMessageId
semanticContext:
  stage
  focus
  understandings[]
  openPart
  importantBranches[]
  archivedFocuses[]
  burdenSignal
  questionBoundary
```

## 语义引用

`focus`、`understandings`、`openPart`、`importantBranches`、`archivedFocuses` 和 `burdenSignal` 只包含：

```text
ref
summary
evidenceRefs[]
```

当前活动语义的 `ref` 可用于 `invalidatedRefs`、`archivedRefs` 和 `importantBranchDelta.preserveRefs`。`focus` 的当前引用可用于 `keep`；已有支线或 `archivedFocuses` 的引用可用于 `return`。归档焦点继续保留原回答机会账本；用户后续明确否定该焦点时，也可把其引用写入 `invalidatedRefs`，程序会删除归档索引和原账本。归档焦点不再进入归档、保留或同摘要新增支线。完整对话继续承担事实源；紧凑语境只承担当前状态索引。

## 提问边界

`questionBoundary` 只暴露程序已经计算的可行动边界：

```text
currentFocus:
  focusRef
  newOpportunityAvailableByStage
  pendingOpportunity
importantBranches[]:
  focusRef
  newOpportunityAvailableByStage
  pendingOpportunity
archivedFocuses[]:
  focusRef
  newOpportunityAvailableByStage
  pendingOpportunity
```

`pendingOpportunity` 只在当前焦点、当前阶段存在可修复或可恢复的待回答任务时提供 `opportunityRef` 和阶段。它与唯一的 `semanticContext.openPart` 指向同一待处理语义。重要支线和归档焦点暂停期间不携带待回答机会。`opportunityRef` 只用于判断是否复用当前回答机会，也不属于语义去向字段的可选范围。模型看不到原始次数账本、状态合并算法、失效历史、不可返回的归档内容、幂等字段或评测答案。

初次建立的新焦点拥有各阶段的首次新回答机会；沿当前焦点、返回已有支线或返回归档焦点时，使用 `questionBoundary` 中对应引用的可用边界。`archivedFocuses` 只保留仍然成立、当前暂时退出工作的旧焦点及原账本；用户明确回到其中一项时使用 `return`。
