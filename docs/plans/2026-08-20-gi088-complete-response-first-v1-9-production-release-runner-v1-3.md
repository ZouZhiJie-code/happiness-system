# GI-088｜完整回应优先 v1.9 Production 发布工具 v1.3

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../generative-interview-refactor-map.md)

## 1. 进入原因

v1.2 已修复本地数据库回读与清理合同。复用父候选执行真实冒烟时，注册、会话创建和临时数据清理均正常；可见回答在模型配置门被服务主动拒绝。

Vercel 运行日志确认错误为 `EVENT_CENTERED_CANDIDATE_MODEL_MISMATCH`。候选策略要求 `deepseek-v4-pro`，父候选构建时的 Production 模型环境仍为 `deepseek-v4-flash`。正式域名仍指向原 baseline 部署，临时用户已自动清理。

## 2. 首个单因素

新运行身份：`2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-3-model-environment-contract`。

- 候选构建前同时把 Production 构建环境设置为 `complete_response_v1_9 + deepseek-v4-pro`。
- 候选部署完成后回读其运行环境与应用配置；两者一致才允许真实冒烟。
- 正式回退同时恢复 `baseline + deepseek-v4-flash`。
- 发布状态机冻结模型配置源码、v1.2 父回执与父阶段账；任一漂移在访问部署凭据和网络写操作前停止。

候选应用、Prompt、上下文、Thinking、Token、数据库、冒烟输入、后台事实合同、正式域名和回退目标保持原值。

## 3. 执行门

1. 封存 v1.2 可见流失败，保留候选与正式域名身份。
2. 先把项目 Production 环境恢复为 `baseline + deepseek-v4-flash`，回读一致后建立 v1.3 启动卡。
3. 创建独立候选；候选必须 Ready、未接管正式域名，并实际使用 `complete_response_v1_9 + deepseek-v4-pro`。
4. 候选真实冒烟验证可见回答、后台事实 Trace、数据库回读和临时数据归零。
5. 按“用户输入 → AI 实际输出 → 耗时 → 后台状态”交付产品负责人；产品 `pass` 后才允许接管正式域名。
6. 切流后在正式域名执行同候选回归；任一技术门失败立即回退 `baseline + deepseek-v4-flash`。

## 4. 停止点

- 候选模型不一致、可见回答失败、后台 Trace 失败或临时数据未清理：停止切流。
- 候选语义产品裁决 `fail`：停止切流。
- 正式域名回归失败：自动回退并保存完整技术证据。
- 全部通过后再同步 Production 最终身份、线上指标、回退状态和发布证据。
