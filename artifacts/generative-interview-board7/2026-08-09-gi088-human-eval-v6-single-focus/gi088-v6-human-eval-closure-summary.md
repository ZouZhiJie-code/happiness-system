# GI-088 v6｜真人评测收口摘要

收口时间：`2026-08-10T04:06:21.860Z`

状态：`2/4 early_stopped；单一回答焦点真人验证通过`

## 1. 产品负责人判断

- 完成 A1、A2 后，原有“按问号数量过度限制自然提问”的问题已经解决，可以提前结束。
- A3、A4 保持 `not_run`，不会被计入能力通过证据。

## 2. Codex 初评

- 11 条可见提问全部完成逐轮人工分类：`same_focus_low_burden=9`、`same_focus_heavy=2`、`multiple_independent_tasks=0`。
- v6 的唯一主要因素达到真人验证通过；问号数量继续只承担观察和复核候选职责。
- 本批共 17 次 Provider 调用，`EMPTY_CONTENT=0`；A2 出现一次正文阶段超时，并由同一 Thinking high 自动恢复成功。

## 3. 已确认根因与后续问题

- 已确认根因：v5 使用问号数量代替回答焦点，形成了过度修复；v6 改为“一个独立回答任务＋逐轮人工复核”后，原问题消除。
- v6 新发现：A1 最终回合因旧完整状态合同中的 `burdenSignal.ref` 被拒绝，进入 v7 语义变化合同处理。
- 脱敏血缘：
  - A1 turn：`redacted-operational-id`；call：`redacted-operational-id`；错误：`OUTPUT_SCHEMA_INVALID:semantic.burdenSignal:unrecognized_keys`。
  - A2 turn：`redacted-operational-id`；首次 call：`redacted-operational-id`；错误：`TIMEOUT`；最终状态：`complete_after_auto_recovery`。

## 4. 私有完整结果

- 本地文件：`artifacts/local-runtime/gi088/2026-08-09-gi088-human-eval-v6-single-focus/gi088-v6-2-of-4-private-export.json`
- 导出版本：`2026-08-09.gi088-readonly-export-v0.4`
- 文件大小：`295042 bytes`
- SHA-256：`73e83d47e93204229b78aaf3aaf72b7e9c4344294659c0a608f5c28433b94393`
- 权限：目录 `0700`，文件 `0600`。
- 完整导出包含 A1、A2 对话、逐轮分类、评价、调用血缘和安全诊断；A3、A4 明确标记为 `not_run`。
- 正式证据目录不保存用户原话、完整 Prompt、模型原始输出或隐藏推理正文。

## 5. 批次边界

- 批次：`redacted-operational-id`
- 评测版本：`2026-08-09.gi088-human-eval-v6-single-focus`
- 执行指纹：`a5042e9700f09b7d9d5a9746e87091e9ed8b4cc0cee4e7741435ce7badfc094d`
- Production：`legacy + baseline`。
