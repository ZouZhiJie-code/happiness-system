# GI-064 候选血缘

候选状态：`自动发布门通过；等待人工实聊与最终 Go/No-Go`

生成时间：`2026-08-04`

## 冻结范围

| 项目 | 值 |
|---|---|
| 候选目录 | `2026-08-04-gi064-scripted-deepseek-official-preview-r2` |
| 候选起点 | `2026-08-04T05:24:34.641Z` |
| 环境 | 本机独立 Preview 数据库，`optional + generative` |
| Provider | DeepSeek 官方 API 的 `openai` 兼容链路 |
| API 地址 / 模型 | `https://api.deepseek.com` / `deepseek-v4-flash` |
| 策略版本 | `5.62.0` |
| 语义 Prompt | `2026-08-04.event-centered-generative-v82-gi064-source-placeholder-repair` |
| 可见 Prompt | `2026-08-04.event-centered-generative-v82-gi064-source-placeholder-repair-visible` |
| 语义产物 | `event-centered-semantic-plan.v14` |

## 形成原因

GI-059 已冻结提问思路、深聊完成和双事件绑定规则，但其脚本化候选因为运行降级与等待时间未达到发布门。后续修复逐步处理性能口径、单回合上下文复用、语义哈希、角度关闭、来源关系、定向修复和审计分账。

GI-063 预检仍发现 Few-shot 示例中的占位来源编号 `existing:1` 被模型复制到真实语义产物。GI-064 将示例占位编号与真实来源编号明确隔离：真实输出只能引用当前有效事实 ID 或本轮生成的 `new:N`。现有安全门继续拒绝无效来源引用。

## 证据窗口

- 关系轨迹预检 r2：`2026-08-04-gi064-official-preflight-relationship2-r2`，通过。
- 脚本化 r1：`2026-08-04-gi064-scripted-deepseek-official-preview-r1`，保留为角色卡回复不足的历史执行，不参与当前裁决。
- 脚本化 r2：当前唯一自动发布门证据，8 条主链与 8 条日志闭环完成。

## 当前裁决

自动发布门通过：正式生成式回合 `18`、最终 baseline `2`、最大连续 `1`；日志 AI 接受 `8/8`、全文 fallback `0`；完整文本可见中位数 / P90 `3.85s / 4.97s`，可继续操作中位数 / P90 `3.89s / 5.00s`。

本候选只能进入人工实聊，不构成 Production 授权。模型、Prompt、策略、角度卡、Few-shot、语义产物或入口策略变更后，当前证据失效。
