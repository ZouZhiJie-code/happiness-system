# 评测与运行证据导航

- 文档职责：证据索引
- 文档状态：现役
- 最后核验：`2026-08-20`
- 权威入口：[项目知识导航](../docs/README.md)

本目录保存当前正式证据、历史候选证据与本地运行过程。产品当前状态由相应总 Map 和稳定合同承担；证据包只证明自己的运行身份、版本、结果与裁决。

## 1. 当前证据入口

| 主题 | 当前入口 | 证据职责 |
|---|---|---|
| GI-088 生成式访谈 | [当前评测资产入口](./generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md) | v1.7 新案例续跑 `10/10` 技术有效；当前分支隔离 Preview 实施中；Production baseline |
| AI 评测治理 | [AI 评测总规范](../docs/ai-evaluation-standard.md)与[阶段 A 验收记录](./ai-evaluation-governance/2026-08-13-v0.9-stage-a-acceptance.md) | 项目级启动门、身份、预算、隐私和职责 |
| 日志生成质量 | [日志生成评测入口](./journal-generation-evaluation/README.md) | 真人轨迹、记录卡、今日日记与独立准入准备 |
| 网页端产品验收 | [第二轮产品验收证据](./daily-light-visual-review/2026-08-13-second-round-closeout/README.md) | 当前 Production 的上游视觉与交互验收基线 |
| Production 发布 | [2026-08-13 Production 发布证据](./daily-light-visual-review/2026-08-13-production-release/README.md) | deployment、迁移、正式域名、回退和线上验收 |

当前 Production 使用 `event_centered + baseline`；GI-088 隔离 Preview 按[当前专项](../docs/plans/2026-08-20-gi088-complete-response-first-v1-6-isolated-preview-acceptance.md)实施，独立准入与 Production 发布继续按[生成式访谈总 Map](../docs/generative-interview-refactor-map.md)推进。

## 2. 历史证据入口

| 历史范围 | 包级索引 | 当前替代入口 |
|---|---|---|
| Board 6 早期校准 | [Board 6 索引](./generative-interview-board6/README.md) | 历史真实金标库 v1；旧审题包保留历史身份 |
| Board 7 候选、诊断与真人轨迹 | [Board 7 历史索引](./generative-interview-board7/README.md) | 生成式访谈总 Map |
| Board 8 Preview、修复与 No-Go | [Board 8 历史索引](./generative-interview-board8/README.md) | 生成式访谈总 Map |
| Batch B 根目录历史文件 | [Batch B 历史清单](./event-centered-batch-b-manifest.md) | Board 6/7/8 对应包级入口 |
| 网页端旧视觉候选与否决版本 | [视觉证据索引](./daily-light-visual-review/README.md) | 第二轮验收与 Production 发布证据 |
| 访谈节点历史成果 | [`interview-nodes/`](./interview-nodes/) | 产品与架构文档 |

旧候选的自动通过、Preview `READY`、运行数字和部署编号只承担对应时期的证据职责，不能自动转化为当前产品结论或发布授权。

## 3. 全量台账

- [文档逐项清单](../docs/maintenance/2026-08-16-document-inventory.csv)：每份 Markdown 的职责、状态、现役入口、替代关系、隐私等级和处置建议；
- [证据包逐项清单](../docs/maintenance/2026-08-16-evidence-package-inventory.csv)：`artifacts/` 与 `evals/` 共 161 个集合／版本包；
- [完整清理预览](../docs/maintenance/2026-08-16-document-governance-cleanup-preview.md)：需要保留、转历史、人工判断和待授权清理的汇总。

机械台账承担完整发现性，本文件只保留当前入口和包级历史路线。

## 4. 收纳规则

正式证据包至少保存：

1. 产品决策、授权范围与停止点；
2. 候选、数据集和运行身份；
3. Prompt、模型、参数、版本与指纹；
4. 调用预算、实际运行和技术失败；
5. 原始结果、盲评、Codex 初评和产品负责人裁决；
6. 当前适用范围、历史身份与替代入口。

新增运行过程、debug、checkpoint、retry 和完整真人导出先进入被 Git 忽略的 `artifacts/local-runtime/` 或专项 `.private/`。升级为正式证据时，提取必要的脱敏结果、来源、版本、裁决和回执；私有正文继续留在隔离区。

## 5. 保留与清理边界

- 保留唯一裁决、关键原始结果、冻结规则、版本身份和不可再生材料；
- 重复状态摘要进入包级索引，原始证据保持原位；
- 结束计划、旧 Preview 和旧候选通过历史标记退出当前路线；
- 精确重复、空壳副本、可再生缓存和失效引用先进入清理预览；
- 私有正文、隐藏题、真实话题、凭证和个人信息不进入公开索引；
- 任何删除或清场都等待产品负责人查看完整预览后的逐项确认。
