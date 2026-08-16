# Daily Light 文档导航

- 文档职责：知识导航
- 文档状态：现役
- 最后核验：`2026-08-16`
- 权威入口：[当前阶段 Handoff](./handoff.md)

这份导航帮助产品负责人和 Codex 在五分钟内找到当前事实、当前任务、授权边界、实施说明与证据。它只保留路由和一屏状态，详细事实由对应权威文档承担。

## 1. 五分钟恢复路线

1. [项目协作与事实规则](../AGENTS.md)
2. [当前阶段 Handoff](./handoff.md)
3. 与任务相关的产品总 Map 或稳定合同
4. 当前专项及其明确链接的上游冻结档案
5. [评测证据总入口](../artifacts/README.md)

涉及评测集、模型比较、Judge、准入、真人 Preview、Bad Case 或线上 AI 质量时，在进入专项前读取 [AI 评测总规范 v1.0](./ai-evaluation-standard.md)。

## 2. 当前一屏状态

- Production 正式域名为 `https://dailylight.chat`；`2026-08-16` 已验证公开首页返回 `200`。
- 仓库当前批准的 Production 主链为 `event_centered + baseline`；生成式访谈能力继续关闭。
- 网页端用户路径为 `访谈记录 → 当天时间线事件卡片 → 今日日记`。
- GI-088 回归集 v1.2 已封存；`relationship_claim_status_v1` 两题探针保持 `technical_blocked` 与语义未知。响应等待父合同 A/B 已裁决 `inconclusive_mixed_direction`；先回应后整理本地候选 `e806843d…bac96` 已完成，可见合同负担 A/B 已裁决 `visible_contract_directional_support`。首段六题技术有效、45 秒门和 60 秒门均为 `6/6`，当前等待产品负责人私有六卡内容裁决；程序职责迁移、第二段耗时、真实页面、完整 10 题回归、Judge、独立准入、真人 Preview 和发布继续待验证或关闭。
- 文档治理两阶段及授权清理已经完成；[最终治理记录](./maintenance/2026-08-16-document-governance-cleanup-preview.md)保留全量台账、清理结果和仍受保护的独立成果。

当前任务、工作区血缘、验证门和停止点统一从 [Handoff](./handoff.md) 读取；专项数字与裁决从对应 Map 和证据包读取。

## 3. 按任务找文件

### 产品与体验

| 需要回答的问题 | 权威入口 |
|---|---|
| Daily Light 服务谁、解决什么、用户路径是什么 | [PRODUCT.md](../PRODUCT.md) |
| 当前视觉和交互合同 | [DESIGN.md](../DESIGN.md) 与 [UI conventions](./design/ui-conventions.md) |
| 访谈产品模块、依赖和衡量边界 | [访谈产品优化总 Map](./interview-product-optimization-map.md) |
| 生成式访谈板块 1～8 状态与冻结决策 | [生成式访谈重构总 Map](./generative-interview-refactor-map.md) |
| 五维理论与完成规则 | [docs/theory](./theory/) |

### 当前执行与交接

| 需要回答的问题 | 权威入口 |
|---|---|
| 现在正在做什么、停在哪里 | [当前阶段 Handoff](./handoff.md) |
| 当前工作区怎样分批提交、验证和停止 | [2026-08-16 工作区提交收口](./maintenance/2026-08-16-workspace-commit-consolidation.md) |
| 两段式怎么实施、Prompt／Skill／程序怎样分工 | [先回应后整理与职责重划实施计划](./plans/2026-08-16-gi088-response-first-two-stage-and-responsibility-split.md) |
| 为什么模型长期等待、下一会话讨论什么 | [GI-088 模型长等待根因讨论交接](./plans/2026-08-16-gi088-response-latency-root-cause-discussion-handoff.md) |
| 当前文档治理范围与问题台账 | [2026-08-16 文档治理与工作区审计](./maintenance/2026-08-16-documentation-governance-and-workspace-audit.md) |
| 第二阶段全量台账、清理候选与保护清单 | [2026-08-16 文档与工作区清理预览](./maintenance/2026-08-16-document-governance-cleanup-preview.md) |
| ChatGPT 与 Codex 任务状态 | [AI tasks](./ai-tasks/README.md) |

### AI 评测

| 需要回答的问题 | 权威入口 |
|---|---|
| 跨专项评测规则与授权门 | [AI 评测总规范](./ai-evaluation-standard.md) |
| 生成式访谈当前专项 | [板块 6｜生成式访谈质量评测](./technical/interview-event-centered/04j-generative-quality-evaluation-v1.md) |
| GI-088 真实问题回归集 v1、历史真实金标与旧双轨资产 | [GI-088 评测资产入口](../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md) |
| 日志生成评测 | [日志生成评测入口](../artifacts/journal-generation-evaluation/README.md) |
| 访谈意图评测 | [访谈意图评测事实源](./interview-intent-evaluation-source-of-truth.md) |

### 工程与运行

| 需要回答的问题 | 权威入口 |
|---|---|
| 系统怎么工作 | [Architecture](./architecture.md) |
| HTTP 接口怎么调用 | [Integration Guide](./integration-guide.md) |
| 怎么启动、验证和排障 | [Operator Runbook](./operator-runbook.md) |
| Preview、Production 与回退 | [Vercel 发布主线](./vercel-preview-production-lane.md) |

### 历史证据

| 证据范围 | 入口 |
|---|---|
| 评测产物的分层与保留规则 | [artifacts 总入口](../artifacts/README.md) |
| Board 7 历史候选与运行 | [Board 7 资产索引](../artifacts/generative-interview-board7/README.md) |
| Board 8 Preview 与发布证据 | [Board 8 资产索引](../artifacts/generative-interview-board8/README.md) |
| 项目方法与复盘 | [Retrospectives](./retrospectives/) 与 [Vibe Coding 系列](./vibe-coding-series/README.md) |

## 4. 文档职责与生命周期

| 文档职责 | 保存内容 | 常见位置 |
|---|---|---|
| 项目入口 | 产品摘要、快速启动、最短导航 | 根 `README.md` |
| 知识导航 | 按任务路由和一屏状态 | 本文件 |
| 稳定合同 | 产品、设计、架构、接口和运维事实 | `PRODUCT.md`、`DESIGN.md`、`docs/` |
| 总 Map | 模块状态、冻结决策、当前专项指针 | `docs/*-map.md` |
| 当前执行交接 | 当前任务、开放问题、验证门、停止点和下一位执行者 | `docs/handoff.md` |
| 当前专项 | 目标、范围、版本、验证门和停止点 | `docs/technical/`、`docs/maintenance/` |
| 任务记录 | 可执行计划、结果和阻塞 | `docs/ai-tasks/` |
| 证据索引 | 运行身份、原始证据、裁决和隐私边界 | `artifacts/`、`evals/` |
| 历史证据 | 已结束候选、旧 Preview、事故和复盘 | 版本化证据包、复盘与 Git 历史 |

现役文档使用以下文档状态：`现役`、`待确认`、`已确认·实施中`、`待验证`、`已完成`、`暂停`、`No-Go`、`历史证据`。文档状态描述材料本身；产品结论、执行状态、证据状态和发布状态继续分别记录。

核心现役文档顶部固定标明：`文档职责`、`文档状态`、`最后核验`、`权威入口`。历史材料优先在包级索引标记身份，保留原始运行内容。

## 5. 写回与事实规则

文档同步固定使用三个时机：

1. 执行前预同步：写入“已确认、实施中”的目标、范围、验证门和停止点，结果保持待验证；
2. 过程问题入账：记录改变归因、方案、风险或下游交接的关键问题；
3. 结束前证据封存：同步结果、版本、指标、证据、停止状态和下一步，并检查所有现役入口一致。

事实冲突依次由用户本轮最新指令、`AGENTS.md`、相关总 Map、总规范、上游冻结档案、当前专项和真实代码／运行证据裁决。无法验证的结论标记为待验证。历史候选、自动测试和 Ready Preview 均保留各自证据身份。
