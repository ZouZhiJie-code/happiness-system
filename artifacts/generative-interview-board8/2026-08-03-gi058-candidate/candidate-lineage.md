# GI-058 候选血缘与 Preview 状态

记录日期：`2026-08-03`

状态：`候选 v1 完成工作流 Preview（旧 Ark 配置历史证据）；候选目标 Provider 已校准为 DeepSeek 官方 API，共享运行时仍待授权切换与预检`

Production：`legacy + baseline，未切换`

## 候选血缘

| 项目 | 值 |
|---|---|
| Preview 数据库 | `happiness_board8_preview_20260803_gi058` |
| 数据库迁移 | `38` 条，up to date |
| 模式 | `optional` |
| 策略 | `generative` |
| 逻辑模型 | `deepseek-v4-flash` |
| GI-058 候选目标聊天 Provider | `openai`（DeepSeek 官方 API） |
| API 地址 | `https://api.deepseek.com` |
| Strategy | `5.53.0` |
| Semantic artifact | `event-centered-semantic-plan.v8` |
| Board8 report | `board8.candidate-aware.v4` |

## 计分根会话

以下仅保留会话标识，不保留用户原话、AI 全文、日志正文或 Trace 上下文。

| 序号 | 根会话 ID | 角度 |
|---:|---|---|
| 1 | `1f08e16c-ec4d-4ada-814a-1a1b76ace2b7` | `feeling` |
| 2 | `fe9f9d6c-4d70-45c2-86b0-cbb01f679e0e` | `thought` |
| 3 | `0da6b851-635c-42e5-b2b5-a5132e2c1d2e` | `feeling` |
| 4 | `cc926ae5-9069-4483-8ac8-028a4306cd09` | `thought` |
| 5 | `2464f5c5-a229-415c-ac12-2168590d6d53` | `relationship` |
| 6 | `4798a97b-5beb-46b7-a71c-29ad5a2483d2` | `relationship` |
| 7 | `06c9429f-af70-4544-9162-d2e1bb9c8318` | `action` |
| 8 | `cfec791a-e928-4961-b1a4-961641674c1d` | `action` |

## 证据索引

- [Preview 执行证据](./preview-execution-evidence.md)
- [Provider 前置检查](./provider-preflight.md)
- [Board8 JSON 只读报告](./board8-preview-candidate-audit.json)
- [Board8 Markdown 只读报告](./board8-preview-candidate-audit.md)

## 候选版本有效性

候选 v1 的 8 条主链和日志闭环已完成，但该轮使用 Ark 旧配置，真实生成式调用均降级；相关报告只保留为历史工程证据。当前代码与候选环境契约已将聊天 Provider 统一为 DeepSeek 官方 API 的 `openai` 兼容链路，逻辑模型名直接使用 `deepseek-v4-flash`。共享运行时只读核对仍显示已发布聊天配置为旧 Ark，需单独授权切换后再执行官方预检。

旧 Ark 版本化模型检查得到的 `403 AccountOverdueError` 已标记为历史失效证据。当前候选需先完成 DeepSeek 官方 API 预检，再按 GI-054 从头重跑 8 条计分轨迹和两条冒烟。
