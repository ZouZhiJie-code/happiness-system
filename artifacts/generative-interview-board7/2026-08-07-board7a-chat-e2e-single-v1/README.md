# GI-083 v1｜真实用户直连单轨迹候选包

状态：`历史诊断候选；运行前由 GI-084 正式资产候选承接；产品负责人真实轨迹待开始；工程合成自测已通过`

候选指纹：`2ceb7bb37e196f47dbd70fcd6ffaf0cf3b4c7727ae2e8721e62b593751dbbe46`

当前候选版本：`2026-08-07.board7a-chat-e2e-single-v1.1`。v1.1 根据真实首轮结构拦截补充动作与表达一致性，产品策略与一次调用结构保持不变。

当前入口：[GI-084 基础 Prompt v0 与 Interview Skill v0 正式资产候选](../2026-08-07-board7b-prompt-skill-v0/README.md)

## 为什么修正

GI-083 v0 要求产品负责人先填写事实卡、目标和成功标志。这些准备会提前整理真实用户的思路，削弱端到端体验证据。v1 将真实链路固定为：

`产品负责人 → 本机网页 → DeepSeek`

Codex 在聊天期间不参与交流。轨迹封存后，Codex 才读取本机原始材料并独立完成评分、阻断检查、根因归类和板块 6 回填建议。

## 当前候选

- 模式：【陪我聊】
- 固定开场：`此刻你想聊点什么？`
- 开场调用：`0`
- 模型：`deepseek-v4-flash`
- 调用结构：每次用户发送对应一次结构化生成
- 温度：`0.2`
- Thinking：关闭
- 质量重试：`0`
- 自动技术重试：`0`
- Trace：每轮始终向产品负责人显示
- 调用身份：显示 DeepSeek 官方地址、`deepseek-v4-flash`、Prompt／Skill 版本、请求指纹、耗时与 Token
- 内容回合上限：由产品负责人自然决定结束时点
- 结束反馈：`better / same / worse` 加可选理由
- 日志链路：本轮不包含

## 文件入口

- [运行说明](./board7a-chat-e2e-single-v1-run-guide.md)
- [基础 Prompt v1](./board7a-chat-e2e-single-v1-base-prompt.md)
- [Interview Skill v1](./board7a-chat-e2e-single-v1-interview-skill.md)
- [结构与程序校验](./board7a-chat-e2e-single-v1-structure.md)
- [脱敏裁决模板](./board7a-chat-e2e-single-v1-redacted-review-template.md)
- [候选清单与指纹](./board7a-chat-e2e-single-v1-manifest.json)

## 工程自测与产品停止点

1. 服务器只在本机钥匙串凭据通过 DeepSeek 官方认证、且 `deepseek-v4-flash` 可用后启动；认证失败时不提供网页。
2. `v1.1` 已使用三条合成轨迹完成真实链路自测，共产生 `5` 次 DeepSeek 请求；`5/5` 通过结构与程序保护，技术失败和程序拦截均为 `0`。
3. 自测覆盖零调用开场、连续两轮、纠正承接、一次发送一次请求、刷新恢复、结束封存、结束后拒绝继续、二次启动拒绝和无令牌拒绝。
4. 自测中两次出现“空落落”这类用户原话未提供的情绪推断，作为板块 6 产品质量证据保留；它不影响直连、计数和恢复等技术链路结论。
5. 产品负责人真实轨迹仍未开始。工程合成自测不承担产品体验裁决，也不改变 GI-084 的当前正式资产身份。

## 原文与隐私

完整对话、原始模型输出、逐轮 Trace、批准记录和运行指纹只写入 Git 已排除的 `artifacts/local-runtime/`。产品负责人确认脱敏后，裁决、根因、版本和指纹才进入本目录。API Key、数据库连接和 Production 数据均不进入候选资产。
