# GI-058 Provider 事实校准与预检记录

检查日期：`2026-08-03`

## 产品与候选目标事实

产品负责人已确认当前候选聊天 Provider 使用 DeepSeek 官方 API 的 OpenAI 兼容链路：

- Provider：`openai`
- API 地址：`https://api.deepseek.com`
- 候选模型：`deepseek-v4-flash`
- Production：继续保持 `legacy + baseline`

## 共享运行时只读事实

2026-08-03 对本机 `.env`、`.env.local` 与其连接的共享 Neon 数据库进行了只读核对：

- 本机环境仍为 `AI_PROVIDER="volcengine-ark"`，未发现可供预检使用的 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_BASE_URL`。
- 共享数据库已发布的聊天运行配置仍为 `provider=volcengine_ark`，模型为 `deepseek-v3-2-251201`，密钥仅记录掩码。
- Vercel Production 只读核对仍为 `AI_PROVIDER=volcengine-ark`，没有 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_BASE_URL`。
- 这说明 DeepSeek 官方 API 已进入产品与候选配置口径，尚未进入当前共享运行时的可执行配置。
- 用户已明确授权统一执行 DeepSeek 官方 API；由于部署环境当前没有 DeepSeek 官方 API Key，本轮仍未修改共享数据库、未改写 Ark 密钥、未执行半成品 Provider 切换。

## 历史 Ark 记录

上一轮 GI-058 Preview 使用 Ark 旧配置进行前置检查，曾记录：

| 检查 | 历史结果 |
|---|---|
| Ark `/models` | 可读取 |
| Ark 版本化模型 | `deepseek-v4-flash-260425` |
| 最小聊天请求 | HTTP `403` |
| 上游错误码 | `AccountOverdueError` |

这组记录保留为历史排障证据，不能用于当前 DeepSeek 官方 API 的 Go/No-Go 裁决。

## 当前预检状态

DeepSeek 官方 API 的最小聊天预检暂被部署凭证阻断。需要将 `DEEPSEEK_API_KEY` 安全注入 Vercel Production/Preview，并设置 `DEEPSEEK_MODEL=deepseek-v4-flash`、`DEEPSEEK_BASE_URL=https://api.deepseek.com`；随后确认最小文本回应可用。记录状态、耗时、模型与 Trace 标识，不写入密钥、用户原话、完整请求或响应正文。

预检通过后，按 GI-054 从头重跑 GI-058 的 8 条计分轨迹、第一检查点冒烟和旧五维默认冒烟，再重新生成 Board8 Markdown/JSON 报告。
