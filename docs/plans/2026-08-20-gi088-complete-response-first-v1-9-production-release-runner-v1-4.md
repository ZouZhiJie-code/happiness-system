# GI-088｜完整回应优先 v1.9 Production 发布工具 v1.4

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../generative-interview-refactor-map.md)

## 1. 进入原因

v1.3 已创建同时冻结 `complete_response_v1_9 + deepseek-v4-pro` 的新候选 `dpl_B9P64xCMMGtSR6CKAjNzRFdav39p`。候选 Ready、正式域名未切换；真实冒烟在受保护运行配置回读处停止，生成请求未发出，临时用户已自动清理。

v1.3 同时要求运行回读返回 `VERCEL_DEPLOYMENT_ID`。当前 Vercel Production 环境不稳定提供该可选系统字段；候选专属请求已经由 `vercel curl --deployment` 定向，回读还会返回实际 `requestHost`。

## 2. 唯一变化

新运行身份：`2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-4-runtime-host-contract`。

- 部署身份硬门改为：运行回读 `requestHost` 必须等于候选专属域名。
- 继续硬核对 `event_centered + complete_response_v1_9 + deepseek-v4-pro`。
- 模型环境、候选代码、Prompt、Token、数据库、冒烟输入、后台合同、正式域名和回退目标保持不变。

## 3. 执行与停止点

1. 封存 v1.3 运行身份回读 No-Go；绑定其候选、回执和阶段账。
2. 复用 v1.3 Ready 候选，前提是应用代码与候选提交之间无变化，且候选仍未接管正式域名。
3. 完成受保护运行回读、可见回答、后台 Trace、数据库回读和临时数据清理。
4. 按“用户输入 → AI 实际输出 → 耗时 → 后台状态”交付产品负责人。
5. 产品 `pass` 后才允许正式切流；线上回归失败时恢复 `baseline + deepseek-v4-flash`。

运行主机、策略或模型任一不一致时立即停止；候选产品裁决 `fail` 时停止；正式回归失败时自动回退。
