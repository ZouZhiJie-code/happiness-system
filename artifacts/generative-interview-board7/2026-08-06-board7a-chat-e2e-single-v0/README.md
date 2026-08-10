# GI-083｜单轨迹透明诊断候选包

状态：`历史候选；运行前被真实用户入口校正替代；模型调用 0`

候选指纹：`87919ef577f7c967888d231887e854dfd565ee1f09f1f81148306bfd54c9e8e4`

当前入口：[`GI-083 v1 真实用户直连单轨迹`](../2026-08-07-board7a-chat-e2e-single-v1/README.md)

## 为什么建立这份候选

GI-081 六题使用了未经产品负责人提前确认的临时 Prompt，适合保留为真实失败诊断基线，暂不承担正式架构裁决。GI-083 先把基础 Prompt、Interview Skill、程序保护和评测案例的职责分开，再用一次调用完成一条真实【陪我聊】轨迹，帮助板块 6 根据透明 Trace 定位实际问题。

这条轨迹只承担诊断证据。板块 6 继续进行中，板块 7 正式候选继续等待板块 6，板块 8 继续等待。Production 保持 `legacy + baseline`。

## 当前候选

- 模型：`deepseek-v4-flash`
- 调用结构：每个用户提交对应一次结构化生成
- 温度：`0.2`
- Thinking：关闭
- 质量重试：`0`
- 自动技术重试：`0`
- 模式：【陪我聊】
- 内容回合上限：由产品负责人自然决定结束时点
- 终点：`价值结果 / 合格暂停 / 主动结束 / 质量失败`
- 日志链路：本轮不包含

## 文件入口

- 运行确认（本机历史证据，公开精简包未收录：`board7a-chat-e2e-single-v0-confirmation.md`）
- [基础 Prompt v0](./board7a-chat-e2e-single-v0-base-prompt.md)
- [Interview Skill v0](./board7a-chat-e2e-single-v0-interview-skill.md)
- [结构与程序校验](./board7a-chat-e2e-single-v0-structure.md)
- [事实卡模板](./board7a-chat-e2e-single-v0-user-fact-card-template.json)
- 批准模板（本机历史证据，公开精简包未收录：`board7a-chat-e2e-single-v0-approval-template.json`）
- [脱敏裁决模板](./board7a-chat-e2e-single-v0-redacted-review-template.md)
- [候选清单与指纹](./board7a-chat-e2e-single-v0-manifest.json)

## 历史停止点

1. 已达到：文档、候选包、本机工作台和自动检查完成，模型调用保持 `0`。
2. 产品负责人提供并确认第一段真实表达与希望弄清的目标；Codex 生成事实卡及运行指纹后再次暂停。
3. 产品负责人针对该运行指纹单独授权；完成一条轨迹后立即封存并暂停。

v0 在第一项后停止。事实卡、运行指纹和批准均未创建，DeepSeek 调用保持 `0`。后两项由 v1 的网页内直接开始流程取代。

## 原文与隐私

完整对话、模型原始输出和逐轮 Trace 只写入 Git 已排除的 `artifacts/local-runtime/`。产品负责人确认脱敏副本后，裁决、根因、版本和指纹才进入本目录。API Key、数据库连接和 Production 数据均不进入候选资产。
