# GI-088 v1.9 Production 发布工具 v1.2 结果交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 结果

v1.2 数据库回读与清理合同已经修复。复用的候选部署 Ready，真实冒烟完成注册和会话创建后，可见回答被应用的模型配置门拒绝；后台 Trace 与产品语义评审均未进入。临时用户已自动清理，正式域名仍由原 baseline 部署服务。

Vercel 运行日志给出的确定错误为 `EVENT_CENTERED_CANDIDATE_MODEL_MISMATCH`：候选要求 `deepseek-v4-pro`，实际部署环境使用 `deepseek-v4-flash`。

## 归因

本次 No-Go 只归因于发布工具遗漏模型环境切换。提问策略、Prompt、Token、数据库回读与产品语义均未在本次得到新结论。

## 接续

[v1.3 当前专项](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-9-production-release-runner-v1-3.md)同时管理候选策略与模型环境；新候选通过技术冒烟和产品原文裁决后才允许接管正式域名。
