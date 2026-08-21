# GI-088｜完整回应优先 v1.9 Production 发布工具 v1.5

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../generative-interview-refactor-map.md)

## 原因与唯一变化

v1.4 受保护运行回读返回 404；受控诊断确认 Production 明确设置 `ENABLE_RUNTIME_ENV_READBACK=0`。该接口属于调试能力，发布不为冒烟扩大运行表面。

新身份 `2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-5-service-config-gate` 只移除调试回读前置门，继续使用三层确定证据：

1. Vercel 候选专属域名和 Ready 部署身份；
2. 项目环境回读必须为 `event_centered + complete_response_v1_9 + deepseek-v4-pro`；
3. 可见生成服务自身继续执行 Provider、模型、地址和密钥合同，不一致时返回确定错误并阻止生成。

候选、Prompt、Token、数据库、输入、后台合同、正式域名和回退目标均保持不变。

## 执行门

- 复用 v1.3 Ready 候选，应用代码无变化才允许继续。
- 真实冒烟必须完成可见回答、后台 Trace、数据库回读和临时数据清理。
- 候选实际输入与 AI 输出交产品负责人裁决；`pass` 后才切流。
- 正式回归失败时恢复 `baseline + deepseek-v4-flash`。
