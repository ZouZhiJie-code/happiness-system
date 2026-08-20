# 材料与证据

这份文件用于内部核对文章中的时间、过程和方法来源。文章正文保持连续阅读，来源不承担解释工作。

## 飞书 Daily Light 知识库

### 产品起点与早期判断

- [背景｜从零 Vibe Coding 一款 AI 时代的产品｜为什么要做 Daily Light](https://my.feishu.cn/wiki/VV3EwaPoKi9DRNkVQNScZ8ISnoh)
- [思路｜从零 Vibe Coding 一款 AI 时代的产品｜怎么做 Daily Light（二）](https://my.feishu.cn/wiki/JLDqwfEHbiA9rhkoXjDc8CggnCh)
- [PRD｜从零 Vibe Coding 一款 AI 时代的产品｜怎么做 Daily Light（三）](https://my.feishu.cn/wiki/UJtRw9a9XizlaJkhu5EcsMiHnxf)

### 开发流程与个人协作

- [提示词｜如何 Vibe Coding](https://my.feishu.cn/wiki/N4B1wjKx0itwbSkac8sctB7infb)
- [Vibe Coding 工作流](https://my.feishu.cn/wiki/EhYRwdeBzib95CkI8r8cAZdUnEc)
- [Vibe Coding 标准流程](https://my.feishu.cn/wiki/Zw9JwWsH5iGKwSkntEzcC0HunCh)
- [Cc 开发过程记录](https://my.feishu.cn/wiki/OI6UwJYOxiFJzJ4KkZv2EcqZJ3nzd)
- [Codex CLI 的使用 tips](https://my.feishu.cn/wiki/WvvFwU201iNr7QkIPLscvEXvnjc)
- [Superpowers skills&omx](https://my.feishu.cn/wiki/ArPrwxkDFiZmRAktYRWcWDI1n8f)

### 架构与质量

- [DL｜主链路 Agent 的架构选择](https://my.feishu.cn/wiki/KfnAwPe6NixDm3kEjOOcubMPnxg)
- [梳理｜Daily Light 的对话链路](https://my.feishu.cn/wiki/OkXzwOd1bi9ls8kzglPcFn1fncd)
- [Daily Light 模型评估](https://my.feishu.cn/wiki/BnL8wPAe5ilWAmk9CZCcuGa9nkc)
- [Daily Light 产品需求文档](https://my.feishu.cn/wiki/CgpFwI5DLi81A4kbKNHcAAtmnvc)

## 仓库时间线

### 产品闭环形成

- `c749970`，2026-04-19，仓库初始提交。
- `f3f32ad`，2026-04-23，加入结构化 joy 访谈流程。
- `003bef7`，2026-04-23，简化日志生成流程。
- `9b9a28e`，2026-04-23，稳定分支、日志流程和会话恢复。
- `7a5f6e8`、`03cd584`、`4281e1f`，2026-05-01，补充 improvement 与 gratitude 维度。

### 工程与质量体系形成

- `f57bf0e`，2026-05-07，加入带 TDD 测试的记忆抽取服务。
- `fa7f498`，2026-05-07，加入记忆检索和 Prompt 注入，并补充单元测试。
- `32948e2`，2026-05-18，稳定发布验收流程，加入 925 行验收矩阵和运行脚本。
- `64f0e67`，2026-05-18，完成发布验收修复与文档同步。
- `33ef573`，2026-05-18，加入 CI 与发布准备文档。
- `de379a3`，2026-05-19，把发布验证和 Preview 部署整理成可复现分支。

### 当前方法继续演进

- `0b35c13`，2026-07-23，冻结 Batch C 的成果契约。
- `3a1c547`，2026-07-23，完成 Batch C 成果体验、评测样本、规则和运行器。

### 生成式访谈评测实战

- [板块 6 首批 8 张校准卡](../../artifacts/generative-interview-board6/2026-08-06/README.md)
- [GI-081 临时 Prompt 下的真实输出诊断](../../artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/README.md)
- [GI-084 到 GI-087 候选血缘入口](../../artifacts/generative-interview-board7/2026-08-07-board7b-working-task-v1/README.md)
- [GI-088 v0 人交互开发评测](../../artifacts/generative-interview-board7/2026-08-08-gi088-human-eval-v0/README.md)
- [GI-088 v1 八项真人批次](../../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v1/README.md)
- [GI-088 v2 到 v7 诊断与恢复血缘入口](../../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v7-continuity-baseline/README.md)
- [GI-088 v7r1 到 v8 平台、状态与问前决策血缘](../../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8-question-decision-pro/README.md)
- [GI-088 v8r1 最终 12 项独立验收](../../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/README.md)
- [GI-088 v8r2 意图控制与评测底座加固](../ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md)
- [GI-088 v0 到 v8r1 端到端详细复盘](../retrospectives/2026-08-10-gi088-end-to-end-iteration-retrospective.md)
- [生成式访谈总 Map](../generative-interview-refactor-map.md)
- [板块 6 生成质量评测专项](../technical/interview-event-centered/04j-generative-quality-evaluation-v1.md)

## 口径说明

- 模型评估文档中的 60 条用例，属于首版五维基线设计。
- Agent 架构文档中的 580 条黄金 Benchmark，属于后续更大规模的基准沉淀。
- 两组数字来自不同阶段和不同口径，文章分别呈现。
- 早期技术栈、Provider 和自动化设想只作为历史证据，当前产品事实以仓库 AGENTS 和对应状态文档为准。
- 历史开发文档中曾出现凭据管理风险。文章保留风险形成和修正过程，具体凭据值不进入文章材料。
