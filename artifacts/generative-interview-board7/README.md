# Board 7 评测与候选资产索引

最后更新：`2026-08-12`

## 当前入口

[GI-088｜官方 Pro 双合同与状态投影配对技术 No-Go](./2026-08-12-gi088-pro-contract-projection-paired-v1/README.md)

状态：`官方 Pro 双合同＋状态投影配对开发验证已封存为技术 No-Go：126 次调用中完整组有效 53/64、精简组 38/64，两组延迟门均失败，状态投影四项错误均为 0。人工裁决源未生成，隐藏集未读取；新 Preview 与 0/6 保持关闭，Production 继续 legacy + baseline。`

当前迭代证据：

- [官方 Pro 双合同与状态投影配对技术 No-Go](./2026-08-12-gi088-pro-contract-projection-paired-v1/README.md)
- [模型运行链与输出合同根因对照](./2026-08-12-gi088-runtime-contract-root-cause-diagnostic-v1/README.md)
- [v8r3r3 30/60 秒自适应恢复 No-Go](./2026-08-12-gi088-v8r3r3-adaptive-recovery-30-60/README.md)
- [v8r3r2 双恢复与板块 7 正式封存](./2026-08-12-gi088-v8r3r2-empty-content-recovery-2/README.md)
- [v8r3 Golden 32＋8 与历史 Preview](./2026-08-12-gi088-human-eval-v8r3-golden-eight-preview/README.md)
- [v8r3 Interview Skill、Ark Flash 与历史离线 No-Go](./2026-08-11-gi088-human-eval-v8r3-skill-ark-flash/README.md)
- [v8r2 评测底座加固、Preview 与新 0/12 run](./2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)
- [v8r2 已完成实施合同](../../docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md)
- [v2 diagnostic 运行器说明](./2026-08-09-gi088-human-eval-v2-diagnostic/README.md)
- [v2 diagnostic manifest](./2026-08-09-gi088-human-eval-v2-diagnostic/gi088-human-eval-v2-diagnostic-manifest.json)
- [v2 diagnostic 静态验证](./2026-08-09-gi088-human-eval-v2-diagnostic/gi088-v2-diagnostic-static-validation.md)
- [v3 恢复候选说明](./2026-08-09-gi088-human-eval-v3-empty-recovery/README.md)
- [v3 恢复候选 manifest](./2026-08-09-gi088-human-eval-v3-empty-recovery/gi088-human-eval-v3-empty-recovery-manifest.json)
- [v3 恢复候选静态验证](./2026-08-09-gi088-human-eval-v3-empty-recovery/gi088-v3-empty-recovery-static-validation.md)
- [v4 阶段转场候选说明](./2026-08-09-gi088-human-eval-v4-stage-transition/README.md)
- [v4 阶段转场 manifest](./2026-08-09-gi088-human-eval-v4-stage-transition/gi088-human-eval-v4-stage-transition-manifest.json)
- [v4 阶段转场静态验证](./2026-08-09-gi088-human-eval-v4-stage-transition/gi088-v4-stage-transition-static-validation.md)
- [v5 High-only 候选说明](./2026-08-09-gi088-human-eval-v5-high-reliability/README.md)
- [v5 High-only manifest](./2026-08-09-gi088-human-eval-v5-high-reliability/gi088-human-eval-v5-high-reliability-manifest.json)
- [v5 High-only 静态验证](./2026-08-09-gi088-human-eval-v5-high-reliability/gi088-v5-high-reliability-static-validation.md)
- [v6 单一回答焦点候选说明](./2026-08-09-gi088-human-eval-v6-single-focus/README.md)
- [v6 单一回答焦点 manifest](./2026-08-09-gi088-human-eval-v6-single-focus/gi088-human-eval-v6-single-focus-manifest.json)
- [v6 单一回答焦点静态验证](./2026-08-09-gi088-human-eval-v6-single-focus/gi088-v6-single-focus-static-validation.md)
- [v7 连续性底座候选说明](./2026-08-09-gi088-human-eval-v7-continuity-baseline/README.md)
- [v7 连续性底座 manifest](./2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-human-eval-v7-continuity-baseline-manifest.json)
- [v7 连续性底座静态验证](./2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-v7-continuity-static-validation.md)
- [当前唯一问题台账](./2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-current-issue-ledger.json)
- [v7r1 Prefix 续写候选说明](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/README.md)
- [v7r1 manifest](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-human-eval-v7r1-visible-continuation-manifest.json)
- [v7r1 静态验证](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-v7r1-visible-continuation-static-validation.md)
- [v7r1 Flash / Pro 模型对照结果](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-flash-pro-model-comparison-v1-result.json)
- [v7r1 Flash / Pro 模型对照结论](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-flash-pro-model-comparison-v1-decision.md)
- [v7r1 火山 Ark Flash 平台探针结果](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-ark-flash-platform-probe-v1-result.json)
- [v7r1 火山 Ark E1 等待校正结果](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-ark-e1-timeout-correction-v1-result.json)
- [v7r1 火山 Ark Flash 平台对照结论](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-ark-flash-platform-probe-v1-decision.md)
- [v7r2 Ark Flash 候选说明](./2026-08-10-gi088-human-eval-v7r2-ark-flash/README.md)
- [v7r2 manifest](./2026-08-10-gi088-human-eval-v7r2-ark-flash/gi088-human-eval-v7r2-ark-flash-manifest.json)
- [v7r2 静态验证](./2026-08-10-gi088-human-eval-v7r2-ark-flash/gi088-v7r2-ark-flash-static-validation.md)
- [v7r3 确定性状态候选说明](./2026-08-10-gi088-human-eval-v7r3-deterministic-state/README.md)
- [v7r3 manifest](./2026-08-10-gi088-human-eval-v7r3-deterministic-state/gi088-human-eval-v7r3-deterministic-state-manifest.json)
- [v7r3 零模型回放](./2026-08-10-gi088-human-eval-v7r3-deterministic-state/gi088-v7r3-zero-call-replay.md)
- [v7r4 官方 V4 Pro 候选说明](./2026-08-10-gi088-human-eval-v7r4-pro/README.md)
- [v7r4 manifest](./2026-08-10-gi088-human-eval-v7r4-pro/gi088-human-eval-v7r4-pro-manifest.json)
- [v7r4 静态验证](./2026-08-10-gi088-human-eval-v7r4-pro/gi088-v7r4-pro-static-validation.md)
- [v7r4 真人评测脱敏收口](./2026-08-10-gi088-human-eval-v7r4-pro/gi088-v7r4-human-eval-closure-summary.md)
- [v8 候选说明](./2026-08-10-gi088-human-eval-v8-question-decision-pro/README.md)
- [v8 manifest](./2026-08-10-gi088-human-eval-v8-question-decision-pro/gi088-human-eval-v8-question-decision-pro-manifest.json)
- [v8 静态验证](./2026-08-10-gi088-human-eval-v8-question-decision-pro/gi088-v8-question-decision-static-validation.md)
- [v8 真人验收脱敏收口](./2026-08-10-gi088-human-eval-v8-question-decision-pro/gi088-v8-human-eval-closure-summary.md)
- [v8r1 最终 12 项候选、部署快照与 A1 阻断](./2026-08-10-gi088-human-eval-v8r1-final12/README.md)
- [v8r1 manifest](./2026-08-10-gi088-human-eval-v8r1-final12/gi088-human-eval-v8r1-final12-manifest.json)
- [v8r1 静态验证](./2026-08-10-gi088-human-eval-v8r1-final12/gi088-v8r1-final12-static-validation.md)
- [空内容配对探针 manifest](./2026-08-09-gi088-human-eval-v1/gi088-empty-content-response-format-probe-v1-manifest.json)
- [空内容配对探针脱敏结果](./2026-08-09-gi088-human-eval-v1/gi088-empty-content-response-format-probe-v1-result.json)
- [空内容配对探针裁决](./2026-08-09-gi088-human-eval-v1/gi088-empty-content-response-format-probe-v1-decision.md)
- [空内容 Thinking 模式探针 manifest](./2026-08-09-gi088-human-eval-v1/gi088-empty-content-thinking-mode-probe-v1-manifest.json)
- [空内容 Thinking 模式探针脱敏结果](./2026-08-09-gi088-human-eval-v1/gi088-empty-content-thinking-mode-probe-v1-result.json)
- [空内容 Thinking 模式探针裁决](./2026-08-09-gi088-human-eval-v1/gi088-empty-content-thinking-mode-probe-v1-decision.md)

v1 复盘入口：

- [8/12 提前结束与只读封存核验](./2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-batch-seal-audit.md)
- [产品负责人真人体验评价](./2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-product-review.md)
- [Codex 独立九维初评](./2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-codex-review.md)
- [Bad Case 总账](./2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-bad-case-ledger.json)
- [整批复盘与下一主要影响因素](./2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-batch-reconciliation.md)

## 诊断历史入口

- [GI-088 v0｜1600 Token 上限与技术失败恢复历史](./2026-08-08-gi088-human-eval-v0/README.md)
- [GI-081｜六题真实输出 A/B 诊断基线](./2026-08-06-board7a-real-output-ab-v1/README.md)
- [GI-086｜DeepSeek Thinking 能力校准](./2026-08-07-board7b-thinking-capability-v1/README.md)
- [GI-085｜semantic-frame-first v1 回归结果与根因](./2026-08-07-board7b-semantic-frame-v1/README.md)
- [GI-087｜“共同任务＋当前探查”历史候选与上下文资格审计](./2026-08-07-board7b-working-task-v1/README.md)
- [GI-083 v1｜真实用户直连一次调用诊断候选](./2026-08-07-board7a-chat-e2e-single-v1/README.md)
- [GI-083 v0｜运行前事实卡诊断候选](./2026-08-06-board7a-chat-e2e-single-v0/README.md)
- [GI-084 v0｜初始正式资产候选](./2026-08-07-board7b-prompt-skill-v0/README.md)
- `GI-084 v0.1～v0.3`：三轮授权回归与 No-Go 证据；`v0.4`：运行前关闭、模型调用 `0`。

## 历史目录

- `2026-07-28/`：早期生成质量诊断、候选迭代、人工 review 与回归报告；
- `2026-07-29/`：单次／两段架构比较、问题修复和跨角度 smoke；
- `2026-07-30/`、`2026-08-01/`：后续候选与兼容诊断；
- `2026-08-02/`：历史 MVP Preview 候选、四角度 smoke、恢复和事件日志验证。

这些目录保存候选形成过程与失败证据。当前产品事实继续以总 Map、板块 5 冻结输入和板块 6 当前专项为准。

检索词：`architecture-ab`、`semantic-frame`、`mvp-quality-repair`、`baseline-recovery`、`historical Board 7`。
