# 事件中心生成式访谈评测

## 理解小卡两段式候选

数据集：`board7-meaning-card-candidate-v1.json`

- 四个全新故事，覆盖感受、想法、关系、行动。
- 每个故事固定运行两次，共八个正式结果。
- 旧 `SMK-R-PARTIAL-ASK` 只验证并存范围能否保留，不计入八个正式结果。
- 案例和隐藏判尺只进入评测运行器，不进入 Prompt 或 Few-shot。
- 每个结果分别裁决 `semanticCardVerdict` 和 `visibleVerdict`；边缘按未通过处理。
- 通过门为理解小卡 `8/8`、用户可见回应 `8/8`、严重错误 `0`。
- 独立预算最多两次完整运行。第二次运行需要第一次完成裁决、只剩一个共同失败原因，并且候选版本只改变一项。

首次真实运行命令：

```bash
npm run eval:event-centered:generative -- \
  --mode=meaning-card-candidate \
  --confirm-model-run \
  --pricing-json=evals/event-centered-generative/deepseek-v4-flash-pricing-2026-07-28.json \
  --output=artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-report.md \
  --json-output=artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-runs.json \
  --human-review-output=artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-review.md
```

这条命令固定使用 `deepseek-v4-flash`、关闭 thinking、两段式调用和冻结参数；无需传入 `--architecture`。

评审文件结构：

```json
{
  "meaningCardRuns": [
    {
      "runId": "MC-F-UA-01-R1",
      "runFingerprint": "运行结果中的64位指纹",
      "semanticCardVerdict": "pass",
      "semanticCardReason": null,
      "semanticCardEvidence": "主意思和必要范围完整。",
      "visibleVerdict": "pass",
      "visibleReason": null,
      "visibleEvidence": "回应忠实、自然，动作合适。",
      "severeErrors": [],
      "reviewedBy": "codex",
      "reviewedAt": "2026-08-01T00:00:00.000Z"
    }
  ]
}
```

`severeErrors` 还支持 `visible_target_or_angle_drift`。当第二段问题或成果改变冻结角度、`selectedTargetId` 对应的认识目标时，用户可见回应必须判为 `fail`，并记录该严重错误；运行时不使用关键词规则代替这项人工或代理裁决。

复用已完成结果进行裁决时使用：

```bash
npm run eval:event-centered:generative -- \
  --mode=meaning-card-candidate \
  --existing-runs-json=artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-runs.json \
  --review-json=artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-review.json \
  --output=artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-reviewed-report.md \
  --json-output=artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-reviewed-runs.json
```

预算账本固定保存在：

`artifacts/generative-interview-board7/2026-08-01/board7-meaning-card-candidate-budget.json`

## Provider v70/v70 root-visible 独立 probe

数据集：`board7-provider-v70-root-visible-probe-v1.json`

这批只验证两个冻结契约：想法角度的抽象 `goal` 能否落到可直接回答的具体 `answerEntry`，以及行动角度同时出现有效成果与结束边界时，系统能否正确分流事实、状态、动作和 root visible 回应。

- 固定案例为 `V70-RV-T-ASK-01`、`V70-RV-A-BOUNDARY-01`，每例一次，共 2 个结果；案例指纹固定为 `59e5d4e55b1bc16e163dcb5ae8a2c74518c73df9cf372a8a77ca0fb597dd9414`。
- 候选固定为 semantic Prompt v70、visible Prompt v70、策略 `5.48.0`、Few-shot v27、角度卡 `2.12.0`、语义产物 v3。
- 预算预留前恰好执行 1 次只读 `GET /models` 预检。生成预算按每例最多 4 次、整批最多 8 次 Provider 生成请求计算。
- Codex 独立裁决第一段语义与 root visible 回应，`borderline` 按失败计。任一技术、状态、动作、严重错误或 Codex 裁决失败都会直接 `stop`。
- 预算只允许一批；中止运行同样消耗额度。`gateAudit` 首次写入后保持终局。
- 这批不提供 recovery、correction、delta 或 Prompt 调优入口。通过只解锁隐藏集准备，隐藏集运行需要新的确认包与单独授权。

先生成完整离线确认包：

```bash
npm run eval:event-centered:generative -- \
  --mode=provider-v70-root-visible-probe-confirmation \
  --output=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-case-confirmation.md
```

确认包会展示完整对话、冻结输入、隐藏判尺、运行参数、请求上限、产物路径、批准卡和批准卡指纹。用户确认后，从确认包复制身份字段并保存批准文件：

```json
{
  "approval": {
    "approvalType": "board7_provider_v70_root_visible_probe_run",
    "approvalVersion": "board7-provider-v70-root-visible-probe-approval-v1",
    "decision": "approved",
    "approvedBy": "product_owner",
    "approvedAt": "2026-08-01T00:00:00.000Z",
    "confirmationText": "用户确认原文",
    "taskId": "Codex 任务或会话标识",
    "approvalCardFingerprint": "从确认包复制的64位批准卡指纹",
    "datasetVersion": "2026-08-01.board7-provider-v70-root-visible-probe-v1",
    "caseFingerprint": "59e5d4e55b1bc16e163dcb5ae8a2c74518c73df9cf372a8a77ca0fb597dd9414"
  }
}
```

用户完成单独授权后的唯一正式运行命令：

```bash
npm run eval:event-centered:generative -- \
  --mode=provider-v70-root-visible-probe \
  --v70-root-visible-approval-json=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-approval.json \
  --confirm-model-run \
  --pricing-json=evals/event-centered-generative/deepseek-v4-flash-pricing-2026-07-28.json \
  --output=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1-report.md \
  --json-output=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1.json \
  --human-review-output=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1-human-review.md
```

预算账本固定保存在：

`artifacts/generative-interview-board7/2026-08-01/board7-provider-v70-root-visible-probe-budget.json`

账本会记录批准卡指纹、用户确认时间、用户确认原文与任务 / 会话标识；终局审计另用 `reviewedEnvelopeFingerprint` 绑定完整 Codex 裁决。报告、JSON、人工评审和预算路径均被冻结；命令传入其他路径时会直接停止。

模型结果产生后，Codex 使用 `repairProbeRuns` 导入独立评审。输入 JSON 保持首次生成时的未评状态；CLI 会拒绝携带内嵌裁决的 existing-runs，避免直接修改运行结果伪造终局。离线评审命令保持复用正式 JSON，无需模型确认：

```bash
npm run eval:event-centered:generative -- \
  --mode=provider-v70-root-visible-probe \
  --existing-runs-json=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1.json \
  --review-json=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1-codex-review.json \
  --output=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1-report.md \
  --json-output=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1.json \
  --human-review-output=artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1-human-review.md
```

## Provider v3.1 两条规则 repair probe

数据集：`board7-provider-v31-repair-probe-v1.json`

- 两个全新故事各运行一次，只复验具体 `answerEntry` 和 AI 对话人称。
- 数据集、案例指纹、单批预算与旧 v3 六例完全隔离。
- 每个结果分别保存第一段结构、用户可见回应、候选与实际版本、Prompt 血缘、token 和耗时。
- Codex review 使用 `repairProbeRuns` 导入；通过门为第一段语义 `2/2`、用户可见回应 `2/2`、技术完整 `2/2`、严重错误 `0`。
- 默认模式仍为离线 `rules`；确认包模式拒绝 `--confirm-model-run`，真实运行必须显式确认。

生成离线确认包：

```bash
npm run eval:event-centered:generative -- \
  --mode=provider-v31-repair-probe-confirmation \
  --output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-case-confirmation.md
```

获得单独运行授权后的命令：

```bash
npm run eval:event-centered:generative -- \
  --mode=provider-v31-repair-probe \
  --confirm-model-run \
  --pricing-json=evals/event-centered-generative/deepseek-v4-flash-pricing-2026-07-28.json \
  --output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-report.md \
  --json-output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-runs.json \
  --human-review-output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-codex-review.md
```

评审导入结构：

```json
{
  "repairProbeRuns": [
    {
      "runId": "V31-RP-T-ENTRY-01-R1",
      "runFingerprint": "运行结果中的64位指纹",
      "semanticCardVerdict": "pass",
      "semanticCardReason": null,
      "semanticCardEvidence": "goal 保持认识目标，answerEntry 已下沉到放大照片时的一处具体画面。",
      "visibleVerdict": "pass",
      "visibleReason": null,
      "visibleEvidence": "问题可用一个小片段直接回答。",
      "severeErrors": [],
      "reviewedBy": "codex",
      "reviewedAt": "2026-08-01T00:00:00.000Z"
    }
  ]
}
```

导入评审时复用原始结果，无需再次确认模型调用：

```bash
npm run eval:event-centered:generative -- \
  --mode=provider-v31-repair-probe \
  --existing-runs-json=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-runs.json \
  --review-json=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-codex-review.json \
  --output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-reviewed-report.md \
  --json-output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-reviewed-runs.json
```

独立预算账本固定保存在：

`artifacts/generative-interview-board7/2026-08-01/board7-provider-v31-repair-probe-budget.json`

### run-1 一次性技术恢复

run-1 的关系案例在第一段连续遇到超时和结构校验失败，想法案例已经技术完成。为了保留这批真实证据，恢复入口沿用原 `reservationId`、数据集和案例指纹，并在同一预算条目下追加独立 recovery 审计。原 envelope、原失败 attempts、想法案例运行和 v69 指纹都会完整保留。

本次恢复固定执行以下边界：

- 仅重跑系统识别出的 `technicalComplete=false` 关系案例 `V31-RP-R-VOICE-01`。
- 候选只允许第一段 semantic Prompt 从 `v69-understanding-card` 更新到 `v70-understanding-card`；visible Prompt、策略、角度卡、Few-shot、结构产物和运行参数保持一致。
- 同一个原预算条目最多追加一次 recovery 审计。恢复后仍有技术失败时直接 `stop`。
- 模型恢复继续要求 `--confirm-model-run`。请保留预算账本，入口会自动完成预约并追加恢复审计。

recovery-1 已完成并以 `stop` 封口。以下命令作为该次真实执行的历史记录保留：

```bash
npm run eval:event-centered:generative -- \
  --mode=provider-v31-repair-probe-recovery \
  --recovery-source-runs-json=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-run-1.json \
  --recovery-reservation-id=056d21bd-c880-46e2-b2d3-1447443ba6f1 \
  --confirm-model-run \
  --pricing-json=evals/event-centered-generative/deepseek-v4-flash-pricing-2026-07-28.json \
  --output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-report.md \
  --json-output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1.json \
  --human-review-output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-codex-review.md
```

命令会直接读取 run-1 顶层 JSON 中的 `singleRuns`，同时容纳文件内已有的 `gate` 和 `budget` 信息。恢复案例由账本和原运行共同判定，命令保持省略 `--cases`；运行参数保持冻结，命令保持省略 `--max-tokens`。

历史证据采用独立版本解析：source 固定为 semantic v69 + visible v69，recovery-1 固定为 semantic v70 + visible v69。当前新候选使用 semantic v70 + visible v70，版本更新不会改变既有 recovery-1 的指纹、报告和预算审计。预算中的既有 `recoveryAudit` 会继续阻断新的恢复运行。

仅按最新归因口径重新生成报告与 JSON 时，使用以下只读命令。该命令会把技术未完整的关系案例归为 `technical:INVALID_SCHEMA`，整体门槛继续为 `fail / stop`，预算账本保持原审计状态：

```bash
npm run eval:event-centered:generative -- \
  --mode=provider-v31-repair-probe-recovery \
  --recovery-existing-runs-json=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1.json \
  --recovery-report-only \
  --review-json=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-run-1-codex-review-partial.json \
  --output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-reviewed-report.md \
  --json-output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-reviewed.json
```

恢复结果完成后，可离线导入 Codex review：

```bash
npm run eval:event-centered:generative -- \
  --mode=provider-v31-repair-probe-recovery \
  --recovery-existing-runs-json=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1.json \
  --review-json=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-codex-review.json \
  --output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-reviewed-report.md \
  --json-output=artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-reviewed.json
```
