# GI-088 v8r3 Interview Skill 与 Ark Flash 证据包

## 为什么停在 Preview 之前

v8r3 已完成 Interview Skill、Ark Flash 运行时、Foundation 校验对齐、问题价值复核、v0.7 导出、4＋2 评测结构、【帮我记】兼容链和对话优先工作台。两轮正式离线候选均未通过独立硬门，因此本版本保持 `No-Go`，Preview 部署和全新 `0/6` 批次继续关闭。

首轮确认了 Skill 输出字段、有效提示组合和离线校验链的缺口。修复后冻结第二轮候选；Ark 随后对 `96/96` 次正式请求返回 `ACCOUNTOVERDUEERROR`，未形成可见回复。两轮正式候选累计 `194` 次调用，已达到本计划的调用上限，继续扩容明确排除。

## 当前状态

- 评测版本：`2026-08-11.gi088-human-eval-v8r3-skill-ark-flash`
- 最终实现 commit：`4e4afb2a338e376bf6783c037470dca580cdd8a3`
- Execution fingerprint：`093fa6ace9f5b8edad088ccb76a2fbffd62492ae3df92d4ad59c7dce99d719d0`
- Candidate fingerprint：`f88f0082a529870587b5e73d635c14939ad8bf6ec792aa7c72884c5b2a7ec657`
- Dataset fingerprint：`4fdc9b8c8fa9fe3cab0bac1417939647d0071c9f9fca2918a690de7fd486ba8a`
- Runner fingerprint：`5c2a74b355372376a5aef7f30c5a7c6d3f230866b252b9f98bd2e8716d2cab61`
- Experience fingerprint：`a466fee442ee85a2b701abcb34e799c0e5de2145e0fb0a30563a0a77027864d8`
- Skill：`2026-08-11.gi088-interview-skill-v8r3`，SHA-256 `a1b13e4f451a40850bd1122f5b873cce3eb9496c62ef6d42c4b8b28d0ab20494`
- 模型：Ark `deepseek-v4-flash-ga-260731`、Thinking high、`json_object`
- 任务结构：`4` 条【陪我聊】计分轨迹＋`2` 条【帮我记】兼容冒烟
- Preview deployment：未创建
- 新批次：未初始化
- Production：继续保持 `legacy + baseline`

## 两轮正式候选

### 第一轮｜实现缺口 No-Go

- 不可变 commit：`24ddd2920dfbb4002896eb039a6eb3aa1ccb689c`
- 正式调用：`98`，其中初始 `96`、自动恢复 `2`
- 首次有效：`81/96 = 84.375%`
- 最终失败：`13`；最终保护：`12`
- 主要事实：结构合同失败 `9` 次、超时 `3` 次，并出现共同任务处置、深化来源和非提问问号政策未贯通
- 可见延迟诊断：`p50 20.781s / p90 41.909s / max 88.234s`，且仅形成 `83/96` 份可见样本

### 第二轮｜Ark 账户欠费 No-Go

- 不可变 commit：`4e4afb2a338e376bf6783c037470dca580cdd8a3`
- 正式调用：`96`，自动恢复 `0`
- 首次有效：`0/96`
- 最终失败：`96`；错误码全部为 `ACCOUNTOVERDUEERROR`
- Provider 完成耗时：约 `21–703ms`，说明请求在生成前被账户状态拒绝
- 零模型确定性回归：`24` 个案例、`72` 个真实校验断言，全通过
- 人工复核包：`80` 项，外部模型调用 `0`；由于候选无可见结果，本轮不进入质量裁决

## 已完成工程验证

- 全仓：`320` 个测试文件通过、`3033` 项测试通过、`10` 项条件跳过、`0` 失败。
- TypeScript、两套 Prisma validate／generate、Production build、Preview build、Skill 校验、行为清单和差异检查通过。
- 全量 lint 为 `0 error / 45` 条既有 warning；本轮变更目标为 `0 warning`。
- 应用隔离库已完成 `39` 项 migration 和 capture 产品流 `1/1`；评测隔离库已完成 `4` 项 migration 和事务用例 `3/3`，两者清理残留均为 `0`。
- v1～v8r2 历史 Session／导出兼容、v0.6／v0.7 不可变导出与隐私清洗继续通过。

## 下一步条件

1. 恢复 Ark 账户可用状态，并用正式账户侧证据确认欠费已解除。
2. 新建不可变评测版本和新调用预算；当前两轮 `194` 次证据继续只读保留。
3. 完整重跑候选硬门；通过后再执行两轮各 `20` 条人工 Golden 校准、开发集 Judge 预筛和人工最终裁决。
4. 质量、可靠性和延迟分别通过后，才部署私有 Preview 并初始化全新 `0/6`。

## 文件索引

- [不可变清单](./gi088-v8r3-skill-ark-flash-manifest.json)
- [两轮离线结果摘要](./gi088-v8r3-offline-evaluation-summary.json)
- [静态与真实数据库验证](./gi088-v8r3-static-validation.md)

## 证据边界

- 本目录只保存脱敏聚合事实，不保存隐藏题面、用户原话、请求正文、凭据、数据库连接或隐藏推理。
- 正式模型调用仅来自两轮候选评测；模型探针、真人内容代提交和 Production 变更均为 `0`。
- 人工 Golden 和真人 Preview 质量裁决尚未发生。
