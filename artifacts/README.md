# 评测产物收纳规则

- 文档职责：证据索引
- 文档状态：现役
- 最后核验：`2026-08-19`
- 权威入口：[`docs/README.md`](../docs/README.md)

最后更新：`2026-08-19`

当前状态：`正式资产、历史证据和本地过程文件已分层；GI-088 阶段 C2 technical_blocked：Plus 双 No-Go，Max 15/20 后网络阻断；当前无可推荐 Judge，独立准入继续关闭`

## 1. 为什么需要这份规则

`artifacts/` 同时保存正式评测证据、历史候选证据和运行过程文件。三类内容的保留价值不同，需要通过目录、版本和状态标签区分，保证产品判断可回溯，也避免临时文件持续进入长期资产。

本规则只治理评测产物的收纳方式。产品当前状态继续以 [`docs/generative-interview-refactor-map.md`](../docs/generative-interview-refactor-map.md) 为准。

## 2. 三类产物

### 2.1 当前正式或诊断证据

用于当前板块判断、候选比较、真人裁决或下游交接。每个版本化目录至少保留：

1. 范围与授权边界；
2. 数据版本及来源血缘；
3. Prompt、模型、参数与指纹；
4. 调用预算与实际运行记录；
5. 原始输出和技术结果；
6. 盲评材料；
7. 独立初评；
8. 产品负责人最终裁决。

当前入口：

- [Daily Light 五阶段 Production Evidence Hardening 证据索引](./production-evidence-hardening/2026-08-19/README.md)
- [Daily Light 五阶段问题台账](./production-evidence-hardening/2026-08-19/issue-ledger.md)

- [AI 评测总规范 v0.9 阶段 A 验收记录](./ai-evaluation-governance/2026-08-13-v0.9-stage-a-acceptance.md)
- [项目级 AI 评测总规范 v1.0](../docs/ai-evaluation-standard.md)
- [AI 评测专项模板 v1.0](../docs/templates/ai-evaluation-specialty-template.md)
- [GI-088 阶段 B2 双轨资产、阶段 C/C2 校准回执与 Handoff](./generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md)
- [日志成果九条真人轨迹阶段性总结](./journal-generation-evaluation/nine-human-trajectory-summary.md)
- [日志生成离线评测与隔离评审入口](./journal-generation-evaluation/README.md)
- [Daily Light 第二轮验收基线、功能 Preview 与发布前验证证据](./daily-light-visual-review/2026-08-13-second-round-closeout/README.md)
- [Daily Light 第二轮验收基线 Production 发布证据](./daily-light-visual-review/2026-08-13-production-release/README.md)
- [Daily Light 已否决的字体与色阶增强候选](./daily-light-visual-review/2026-08-13-production-typography-color/README.md)
- [GI-088 v8r2 工程底座与 2026-08-10 初始化历史快照](./generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)
- [GI-088 v8r2 已完成实施合同](../docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md)

- [板块 6 首批校准资产](./generative-interview-board6/2026-08-06/README.md)
- [GI-088 真人交互开发评测集 v1 与透明 Thinking 对照](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/README.md)
- [GI-088 v2 diagnostic 评测底座与空内容诊断结果](./generative-interview-board7/2026-08-09-gi088-human-eval-v2-diagnostic/README.md)
- [GI-088 v2 diagnostic manifest](./generative-interview-board7/2026-08-09-gi088-human-eval-v2-diagnostic/gi088-human-eval-v2-diagnostic-manifest.json)
- [GI-088 v2 diagnostic 静态验证](./generative-interview-board7/2026-08-09-gi088-human-eval-v2-diagnostic/gi088-v2-diagnostic-static-validation.md)
- [GI-088 v3 Thinking high 可见答案自动恢复候选](./generative-interview-board7/2026-08-09-gi088-human-eval-v3-empty-recovery/README.md)
- [GI-088 v3 恢复候选 manifest](./generative-interview-board7/2026-08-09-gi088-human-eval-v3-empty-recovery/gi088-human-eval-v3-empty-recovery-manifest.json)
- [GI-088 v3 恢复候选静态验证](./generative-interview-board7/2026-08-09-gi088-human-eval-v3-empty-recovery/gi088-v3-empty-recovery-static-validation.md)
- [GI-088 v4 阶段 2→3 自然转场候选](./generative-interview-board7/2026-08-09-gi088-human-eval-v4-stage-transition/README.md)
- [GI-088 v4 阶段转场 manifest](./generative-interview-board7/2026-08-09-gi088-human-eval-v4-stage-transition/gi088-human-eval-v4-stage-transition-manifest.json)
- [GI-088 v4 阶段转场静态验证](./generative-interview-board7/2026-08-09-gi088-human-eval-v4-stage-transition/gi088-v4-stage-transition-static-validation.md)
- [GI-088 v5 Thinking high 可靠性候选](./generative-interview-board7/2026-08-09-gi088-human-eval-v5-high-reliability/README.md)
- [GI-088 v6 单一回答焦点候选](./generative-interview-board7/2026-08-09-gi088-human-eval-v6-single-focus/README.md)
- [GI-088 v6 manifest](./generative-interview-board7/2026-08-09-gi088-human-eval-v6-single-focus/gi088-human-eval-v6-single-focus-manifest.json)
- [GI-088 v6 静态验证](./generative-interview-board7/2026-08-09-gi088-human-eval-v6-single-focus/gi088-v6-single-focus-static-validation.md)
- [GI-088 v7 连续性底座候选](./generative-interview-board7/2026-08-09-gi088-human-eval-v7-continuity-baseline/README.md)
- [GI-088 v7 manifest](./generative-interview-board7/2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-human-eval-v7-continuity-baseline-manifest.json)
- [GI-088 v7 静态验证](./generative-interview-board7/2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-v7-continuity-static-validation.md)
- [GI-088 当前唯一问题台账](./generative-interview-board7/2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-current-issue-ledger.json)
- [GI-088 v7r1 Thinking high 可见答案 Prefix 续写](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/README.md)
- [GI-088 v7r1 manifest](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-human-eval-v7r1-visible-continuation-manifest.json)
- [GI-088 v7r1 静态验证](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-v7r1-visible-continuation-static-validation.md)
- [GI-088 Flash / Pro 模型对照结果](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-flash-pro-model-comparison-v1-result.json)
- [GI-088 Flash / Pro 模型对照结论](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-flash-pro-model-comparison-v1-decision.md)
- [GI-088 火山 Ark Flash 平台探针结果](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-ark-flash-platform-probe-v1-result.json)
- [GI-088 火山 Ark E1 等待校正结果](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-ark-e1-timeout-correction-v1-result.json)
- [GI-088 火山 Ark Flash 平台对照结论](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-ark-flash-platform-probe-v1-decision.md)
- [GI-088 v7r2 Thinking high Ark Flash](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r2-ark-flash/README.md)
- [GI-088 v7r2 manifest](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r2-ark-flash/gi088-human-eval-v7r2-ark-flash-manifest.json)
- [GI-088 v7r2 静态验证](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r2-ark-flash/gi088-v7r2-ark-flash-static-validation.md)
- [GI-088 v7r3 程序维护确定性状态](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r3-deterministic-state/README.md)
- [GI-088 v7r3 manifest](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r3-deterministic-state/gi088-human-eval-v7r3-deterministic-state-manifest.json)
- [GI-088 v7r3 零模型回放](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r3-deterministic-state/gi088-v7r3-zero-call-replay.md)
- [GI-088 v7r4 官方 DeepSeek V4 Pro](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r4-pro/README.md)
- [GI-088 v7r4 manifest](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r4-pro/gi088-human-eval-v7r4-pro-manifest.json)
- [GI-088 v7r4 静态验证](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r4-pro/gi088-v7r4-pro-static-validation.md)
- [GI-088 v7r4 真人评测脱敏收口](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r4-pro/gi088-v7r4-human-eval-closure-summary.md)
- [GI-088 v8 统一问前决策与确定性状态修复](./generative-interview-board7/2026-08-10-gi088-human-eval-v8-question-decision-pro/README.md)
- [GI-088 v8 manifest](./generative-interview-board7/2026-08-10-gi088-human-eval-v8-question-decision-pro/gi088-human-eval-v8-question-decision-pro-manifest.json)
- [GI-088 v8 静态验证](./generative-interview-board7/2026-08-10-gi088-human-eval-v8-question-decision-pro/gi088-v8-question-decision-static-validation.md)
- [GI-088 v8 真人验收脱敏收口](./generative-interview-board7/2026-08-10-gi088-human-eval-v8-question-decision-pro/gi088-v8-human-eval-closure-summary.md)
- [GI-088 v8r1 最终 12 项候选、部署快照与 A1 阻断](./generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/README.md)
- [GI-088 v8r1 manifest](./generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/gi088-human-eval-v8r1-final12-manifest.json)
- [GI-088 v8r1 静态验证](./generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/gi088-v8r1-final12-static-validation.md)
- [GI-088 v8r2 评测底座加固、Preview 与初始化时 0/12 快照](./generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)
- [GI-088 空内容配对探针 manifest](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-empty-content-response-format-probe-v1-manifest.json)
- [GI-088 空内容配对探针脱敏结果](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-empty-content-response-format-probe-v1-result.json)
- [GI-088 空内容配对探针裁决](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-empty-content-response-format-probe-v1-decision.md)
- [GI-088 空内容 Thinking 模式探针 manifest](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-empty-content-thinking-mode-probe-v1-manifest.json)
- [GI-088 空内容 Thinking 模式探针脱敏结果](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-empty-content-thinking-mode-probe-v1-result.json)
- [GI-088 空内容 Thinking 模式探针裁决](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-empty-content-thinking-mode-probe-v1-decision.md)
- [GI-088 v1 运行清单](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-manifest.json)
- [GI-088 v1 验证记录](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-runner-validation.md)
- [GI-088 v1 提前结束与只读封存核验](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-batch-seal-audit.md)
- [GI-088 v1 产品负责人评价](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-product-review.md)
- [GI-088 v1 Codex 独立初评](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-codex-review.md)
- [GI-088 v1 Bad Case 总账](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-bad-case-ledger.json)
- [GI-088 v1 整批复盘](./generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-batch-reconciliation.md)
- [GI-088 v0 历史评测运行器建设交接卡](./generative-interview-board7/2026-08-08-gi088-human-eval-v0/gi088-evaluation-runner-build-handoff.md)
- [GI-088 v0 历史评测运行器验证记录](./generative-interview-board7/2026-08-08-gi088-human-eval-v0/gi088-runner-validation.md)
- [GI-088 v0 输出合同澄清](./generative-interview-board7/2026-08-08-gi088-human-eval-v0/gi088-output-contract-clarification-v0.1.md)
- [GI-088 v0 历史逐臂技术冒烟授权与结果](./generative-interview-board7/2026-08-08-gi088-human-eval-v0/gi088-smoke-authorization-template.md)
- [GI-088 技术冒烟历史与根因记录](./generative-interview-board7/2026-08-08-gi088-human-eval-v0/gi088-technical-smoke-history.md)
- [GI-087 板块 7B “共同任务＋当前探查”历史候选](./generative-interview-board7/2026-08-07-board7b-working-task-v1/README.md)
- [GI-088／GI-087 六题上下文资格审计](./generative-interview-board7/2026-08-07-board7b-working-task-v1/board7b-working-task-v1-context-eligibility-audit.md)
- [GI-086 板块 7B Thinking 能力校准历史](./generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/README.md)
- [GI-085 板块 7B semantic-frame-first v1 回归结果与根因](./generative-interview-board7/2026-08-07-board7b-semantic-frame-v1/README.md)
- [GI-081 板块 7A 六题真实输出诊断基线](./generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/README.md)

### 2.2 历史决策证据

历史候选、失败结果和 No-Go 裁决继续保留。长期价值集中在候选血缘、关键输入、最终报告、代表性失败、真人判断和当时的 Production 边界。

每份历史材料需要明确标记候选版本、当时产品前提、验证结果、当前适用范围和历史状态。历史自动通过与旧候选只承担证据职责。

根目录中的 Batch B 历史文件见 [Batch B 历史证据清单](./event-centered-batch-b-manifest.md)。

其他历史入口：

- [GI-088 v0 运行与 1600 Token 上限证据](./generative-interview-board7/2026-08-08-gi088-human-eval-v0/README.md)
- [GI-083 v1 真实用户直连诊断候选](./generative-interview-board7/2026-08-07-board7a-chat-e2e-single-v1/README.md)
- [GI-083 v0 运行前事实卡候选](./generative-interview-board7/2026-08-06-board7a-chat-e2e-single-v0/README.md)
- [GI-084 Prompt／Skill 开发与失败血缘](./generative-interview-board7/README.md)
- [Board 7 候选与诊断证据](./generative-interview-board7/README.md)
- [Board 8 Preview、修复与 No-Go 证据](./generative-interview-board8/README.md)

### 2.3 本地运行临时文件

未来的 checkpoint、probe、debug、retry、完整真人导出和中间报告统一放入 `artifacts/local-runtime/`。该目录已加入 `.gitignore`，用于包含真实对话或可重新生成、无需长期公开审计的过程文件。

需要升级为正式证据的文件，应复制到对应版本化目录，并补齐来源、运行参数、结果状态和引用关系。

## 3. 保留与清理原则

1. 保留最终有效结果、首个能够解释问题的失败结果和产品负责人最终裁决。
2. 盲评材料、Codex 独立初评和产品负责人裁决分别保存，避免相互覆盖。
3. 文件名包含板块、日期、候选版本和用途；目录中的 `README` 或确认包说明当前入口。
4. API Key、完整数据库连接、Cookie 和其他凭据禁止写入产物。
5. 原始用户内容只在已有授权范围内保存，并保留脱敏状态和来源血缘。
6. 删除历史产物前先检查文档引用、候选血缘、真人裁决和隐私风险；存在判断分歧时保留并提交产品负责人裁决。

## 4. 2026-08-06 收口结果

- 保留全部当前 Board 6、GI-087 六题筛选结果与 GI-088 上下文资格审计、GI-086 能力校准、GI-081 诊断基线、GI-083 诊断历史、GI-084 开发失败血缘和 GI-085 回归 No-Go 证据；
- 历史 Board 7/8 通过独立索引保持可发现；
- 根目录及历史目录中无引用的 checkpoint、resume log 已移动到 `artifacts/local-runtime/`；
- `33` 份精确重复且无引用的历史副本已清理，保留同内容的规范命名文件；
- 本地过程文件继续保留在当前机器，并由 `.gitignore` 排除；
- Production、线上 Prompt、API、数据库和运行开关保持原样。
