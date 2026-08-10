# GI-083｜一次调用结构与程序校验

版本：`2026-08-06.gi083-one-call-output-v0`

## 内部最小结果

```text
semantic:
  action: acknowledge | ask | synthesize | pause
  focus
  evidenceRefs
  questionGoal
  limitReason

visible:
  understanding
  response
```

完整 JSON 合同：

```json
{
  "semantic": {
    "action": "acknowledge | ask | synthesize | pause",
    "focus": "当前唯一焦点",
    "evidenceRefs": ["当前轨迹中的用户消息 id"],
    "questionGoal": "ask 时填写希望新增的理解，其他动作填 null",
    "limitReason": "pause 时填写继续价值有限的原因，其他动作填 null"
  },
  "visible": {
    "understanding": "ask 时填写自然理解回应，其他动作填 null",
    "response": "给用户看的主回应；ask 时只放一个问题，其他动作零问题"
  }
}
```

## 程序校验

1. `evidenceRefs` 至少一条，只能指向当前轨迹中的用户消息编号。
2. `ask` 必须有 `questionGoal` 和 `understanding`，全部可见文本合计一个问题。
3. `acknowledge / synthesize / pause` 保持零问题，`questionGoal` 和 `understanding` 为空。
4. `pause` 必须有 `limitReason`；其他动作的 `limitReason` 为空。
5. 一个用户提交只创建一个生成请求；读取或刷新页面只恢复状态。
6. 技术失败保留当前用户轮，产品负责人点击手动重试后才创建新请求。
7. 质量问题保留原结果，不自动重试。
8. 轨迹结束后保持终态，无法继续提交或生成。
9. 本机运行编号由运行指纹唯一生成；同一批准记录只能恢复这一条轨迹，无法创建第二条轨迹。

结构校验失败时，原始输出和失败原因保存到本机 Trace，用户可见回应不进入对话。只保存这些可核查结论字段，不保存隐藏推理过程。
