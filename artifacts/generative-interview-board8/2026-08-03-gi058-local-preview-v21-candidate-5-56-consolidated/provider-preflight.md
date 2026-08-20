# GI-058｜DeepSeek 官方 API 前置检查

检查日期：`2026-08-03`

## 结果

独立 Preview 使用 DeepSeek 官方 API 的最小聊天检查通过，随后以同一 Provider、模型和策略完成 8 条计分轨迹与两条冒烟。

| 检查项 | 结果 |
| --- | --- |
| 运行时 Provider | `openai` 兼容适配器 |
| API 地址 | `https://api.deepseek.com` |
| 候选模型 | `deepseek-v4-flash` |
| Thinking | 关闭 |
| 最小聊天检查 | 通过 |
| 独立 Preview 运行 | 通过 |
| Production 配置 | 保持 `legacy + baseline` |

密钥、请求正文、响应正文和用户内容不写入本文件。旧 Ark 的 `403 AccountOverdueError` 仅保留为历史排障证据，不参与本候选裁决。
