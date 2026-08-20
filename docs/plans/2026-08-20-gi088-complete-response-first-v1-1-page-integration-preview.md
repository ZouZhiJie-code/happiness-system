# GI-088｜完整回应优先 v1.1 页面接入与 Preview

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈重构总 Map](../generative-interview-refactor-map.md)

## 1. 为什么进入页面接入

完整回应优先 v1.1 已完成八条代表性离线检查点：`8/8 technical_valid / stop`，中位耗时 `3406ms`、最长 `4621ms`，Codex 与独立复核均为 `7 pass / 1 minor / 0 fail`。产品负责人对八题的最终语义裁决仍为 `pending`。

用户已授权持续推进到可实际验收的页面。当前工作不替代产品裁决，也不改变 Production；它把同一候选接入隔离 Preview，让产品负责人能够基于真实页面、真实持久化和连续回合体验完成最终验收。

## 2. 本轮目标与唯一架构选择

接入身份：`2026-08-20.gi088-complete-response-first-v1-1-page-integration-preview-v1`

采用现有事件中心 `one_call` 原子链路：

1. 一次模型调用同时生成本轮完整可见回应和最小内部状态；
2. 模型读取当前有效事实、最近完整对话、当前问题和状态；
3. v1.1 的“先选一个尚未回答的新信息目标”方法进入该次调用；
4. 页面把承接、可纠正理解和主问题合并为一个自然气泡；
5. 消息、状态、Trace 和回合完成继续在同一事务提交；
6. 生成或写入失败沿用现有 `clientTurnId`、失败回合与恢复机制。

隔离策略值使用 `INTERVIEW_EVENT_CENTERED_STRATEGY=complete_response_v1_1`。`baseline` 与历史 `generative` 行为保持兼容；Production 在产品负责人页面验收前继续使用 `event_centered + baseline`。

## 3. 固定运行条件

| 项目 | 当前值 |
|---|---|
| 模型 | `deepseek-v4-pro` |
| Thinking | `disabled`，省略 `reasoningEffort` |
| Temperature | `0.2` |
| maxTokens | `1280` |
| 单次调用 | `1` |
| 自动重试／质量重试／回退 | `0` |
| 生成硬超时 | `45s` |
| 可见目标 | 中位不高于 `6s`、单例不高于 `15s` |
| 数据库迁移 | 不需要 |

程序继续只判断策略、权限、来源、状态、预算、超时、幂等、恢复、写入权、输出非空和内部字段泄漏。语义重复、自然度、解释依据和问题价值由模型方法、Codex 原文初评与产品负责人裁决。

## 4. 验证门

### 4.1 工程门

- `baseline` 与历史 `generative` 策略解析保持兼容；
- 隔离策略固定走 `one_call`、Thinking disabled、`1280` Token、一次尝试；
- 一个助手消息只显示一个气泡；刷新后仍保持一个气泡；
- 状态、问题目标、事实、Trace 与可见回应在同一提交中恢复；
- 用户原话先保存，失败回合可以沿同一 `clientTurnId` 恢复；
- 明确停止保持零问题；内部结构字段不进入页面正文；
- 专项测试、全量测试、Lint、类型检查、Production 构建、两套 Prisma、`docs:check` 和 `git diff --check` 通过或如实分账。

### 4.2 生产合同质量门

在页面接入合同下重新运行同一 `3＋5` 八题。每题继续按“完整相关原文 → 实际 AI 输出 → 耗时与 Token → Codex 初评 → 产品负责人裁决”交付。普通语义问题完整跑完批次后统一判断；隐私泄漏、忽略明确停止或纠正、严重事实编造、连续技术故障和预算失控立即停止。

### 4.3 Preview 门

隔离 Preview 最多 `15` 次模型调用，覆盖普通表达、关系表达、负担但未停止、明确停止、纠正、纠正后继续、长上下文、刷新恢复和重复提交。Preview 只使用隔离策略；Production 配置不变。

## 5. 停止点与发布边界

本轮按已授权范围连续完成代码、测试、生产合同复验、提交、推送和隔离 Preview 部署。产品负责人在真实页面完成最终体验裁决前，Production 保持 `event_centered + baseline`。

产品负责人页面验收通过后，继续执行 Production 策略切换、部署回读、关键回合冒烟和 baseline 回退验证；发现严重内容、数据、恢复或权限问题时立即回退 baseline 并封存证据。

## 6. 实际结果与交接

生产合同复验已经按同一 `3＋5` 完成 `8/8` 次调用。八题均为 HTTP 200、`finishReason=stop`、目标模型正确、Thinking 关闭、单例低于 15 秒且未触发 `1280` Token 截断；中位耗时 `7757ms`、最长 `10843ms`。旧完整状态合同只有 `2/8` 有效，其余六题因事实数量、事件边界、状态字段、来源或可见表达合同失败；两个有效输出也只复述用户已给结论后结束。

本专项质量结论为 `No-Go`。页面部署、Preview、提交、推送和 Production 变更保持 `not_run`。下一入口已切换到[完整回应优先 v1.2 最小生产合同](./2026-08-20-gi088-complete-response-first-v1-2-minimal-envelope.md)。公开证据见[结果交接](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-1-production-contract-quality-v1-handoff.md)与[阶段账](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-1-production-contract-stage-ledger-v1.json)。
