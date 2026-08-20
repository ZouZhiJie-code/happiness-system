# GI-066 DeepSeek 官方 Provider 前置检查

- 结果：`通过`
- Provider：`openai`
- Host：`api.deepseek.com`
- Model：`deepseek-v4-flash`
- 最小聊天调用耗时：`6.441s`
- 执行环境：本机独立 Preview
- 密钥：仅注入运行进程，未写入仓库与报告
- Production：保持 `legacy + baseline`

首次执行时，Node 直连受本机系统代理影响而连接超时；候选进程随后显式读取同一系统代理，官方域名与最小聊天调用成功。该问题归入本机执行环境，不计为候选模型失败。
