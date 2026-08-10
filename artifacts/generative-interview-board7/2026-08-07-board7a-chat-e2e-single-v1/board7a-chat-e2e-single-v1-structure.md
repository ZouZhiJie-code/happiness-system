# GI-083 v1｜结构与程序校验

## 每轮内部结果

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

## 字段关系

- `evidenceRefs` 至少一项，只引用当前轨迹中的用户消息编号。
- `ask`：`questionGoal` 与 `understanding` 必填，最多一个问题，`limitReason` 为空。
- `acknowledge / synthesize`：零问题，`understanding / questionGoal / limitReason` 为空。
- `pause`：零问题，`limitReason` 必填，`understanding / questionGoal` 为空。
- 任何期待用户回答的询问、邀请或请求都必须使用 `ask`；其他动作自然停住。
- Trace 只保存以上可核查结论字段，不保存隐藏推理过程。

## 轨迹状态

```text
awaiting_start
  → running
  → technical_failure（可手动重试）
  → protected_failure（可结束）
  → completed（永久终态）
```

点击【开始真实体验】只创建本机批准记录、唯一 `trajectoryId`、运行指纹、checkpoint 和固定开场 `A0`。首次用户发送才产生第一个模型请求。

## 程序保护

- 本机只绑定 `127.0.0.1`，使用随机访问令牌。
- 单个服务器实例只允许创建一条轨迹。
- 一个用户提交严格对应一个模型请求。
- 页面读取和刷新只恢复状态，不生成新回应。
- 技术失败只允许产品负责人手动重试，并保留原失败记录。
- 质量问题不触发重试。
- 结束只接受 `better / same / worse` 与可选文字理由。
- 轨迹结束后拒绝发送、重试和二次启动。
- 完整本机过程写入 Git 排除目录。
