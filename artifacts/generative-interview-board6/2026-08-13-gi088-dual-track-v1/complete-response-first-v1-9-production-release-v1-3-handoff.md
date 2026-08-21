# GI-088 v1.9 Production 发布工具 v1.3 结果交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 结果

v1.3 创建的新候选 `dpl_B9P64xCMMGtSR6CKAjNzRFdav39p` Ready，构建环境同时绑定 v1.9 策略与 Pro 模型。真实冒烟在受保护运行配置回读处停止；生成、后台与产品语义评审均未运行，临时用户已自动清理，正式域名继续使用原 baseline。

## 归因

运行配置门把 Vercel 可选的 `VERCEL_DEPLOYMENT_ID` 作为必需字段。候选请求已经由候选专属域名定向，v1.4 改用回读 `requestHost` 核对部署身份，并继续严格核对策略与模型。

## 接续

[v1.4 当前专项](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-9-production-release-runner-v1-4.md)复用该 Ready 候选；完整冒烟和候选产品裁决通过后才允许接管正式域名。
