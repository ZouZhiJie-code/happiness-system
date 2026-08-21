# GI-088｜完整回应优先 v1.9 Production 发布准备交接

- 文档职责：当前执行交接
- 文档状态：待验证
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么先完成发布准备

v1.9 隔离 Preview 四轮连续链已经完成，Codex 初评 `4/4 pass`，产品负责人仍需依据原文作最终裁决。提前完成只读快照、数据库备份和回退核对，可以在裁决通过后直接发布，并在出现线上问题时快速恢复。

当前 Production 持续使用 `event_centered + baseline`。本次准备没有修改 Production 环境变量、部署、别名或数据库内容。

## 已确认事实

| 项目 | 结果 |
|---|---|
| 当前 Production | `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`，`Ready`，正式域名 `https://dailylight.chat` |
| 当前运行策略 | `event_centered + baseline` |
| 发布候选 | `complete_response_v1_9`，代码提交 `82214e5`，发布准备父提交 `e290a5b` |
| 隔离 Preview | `dpl_J4oYShrzC9rtTMyUDFbew485Gvm4`，Codex `4 pass / 0 minor / 0 fail`，产品裁决 `pending` |
| 数据库变化 | 无迁移；Production 只读备份完成，未写入生产数据 |
| 备份 | PostgreSQL custom dump，`1451891` bytes，SHA-256 `02f4c070714ecee041421540696330aa0aedc83ebeb07ddaa769c64b37c49260` |
| 备份验证 | `pg_restore --list` 通过；私有文件权限 `0600` |
| 回退目标 | 当前 Production 部署 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5` |
| 发布状态 | `ready_waiting_product_owner_preview_verdict`；Production 变更 `not_run` |

## 已核对的发布与回退路径

产品负责人裁决通过后，先把 Production 策略更新为 `complete_response_v1_9`，再使用 `--skip-domain` 构建新的 Production 目标部署。直连地址冒烟通过后才把正式域名切到新部署，随后执行线上回归。

若构建、冒烟或线上回归失败，先把 Production 策略恢复为 `baseline`，再使用 Vercel 回退命令恢复到 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`，最后回读域名和策略。

## 当前停止点

等待产品负责人对四轮 Preview 原文和实际 AI 输出作最终裁决。裁决通过前，Production 环境、部署和域名保持现状。

## 证据

- [v1.9 Preview 验收交接](./complete-response-first-v1-9-isolated-preview-v1-handoff.md)
- [v1.9 Preview 阶段账](./complete-response-first-v1-9-isolated-preview-stage-ledger-v1.json)
- [Production 发布准备阶段账](./complete-response-first-v1-9-production-readiness-stage-ledger-v1.json)
- 私有发布准备：`.private/complete-response-first-v1-9-production-release/readiness.json`，权限 `0600`，SHA-256 `a9c6f3712b12f911a52f60a60fc6786a6c21eed550dbd39bf120347d66c250c2`
- 私有数据库备份：`.private/complete-response-first-v1-9-production-release/production-before-v1-9-20260820.dump`，权限 `0600`，SHA-256 `02f4c070714ecee041421540696330aa0aedc83ebeb07ddaa769c64b37c49260`
