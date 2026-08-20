# GI-066 第一轮人工阻断修复候选血缘

- 候选：`gi066-thought-map-live-preview-v2-candidate-5-65`
- 状态：`自动层达门；等待 4 条人工实聊`
- Strategy：`5.65.0`
- Angle Card：`2.18.0`
- Few-shot：`quality-patterns.2026-08-04.v35`
- Semantic Prompt：`2026-08-04.event-centered-thought-pilot-v85-gi066-fix`
- Visible Prompt：`2026-08-04.event-centered-thought-pilot-v85-gi066-fix-visible`
- Semantic Artifact：`event-centered-semantic-plan.v17`
- Dialogue Snapshot：`v4`
- Thought Protocol：`v2`
- Provider：`openai` 兼容适配器
- Host：`api.deepseek.com`
- Model：`deepseek-v4-flash`
- Preview 数据库：`happiness_board8_preview_20260804_gi066_fix_candidate_5_65_v3`
- Production：`legacy + baseline`

## 候选变更

本候选承接 GI-066 第一轮人工实聊的整体 `No-Go`。修复范围包括语义需求关闭、重复与同义问题拦截、四类纠正、纠正后的重新选题、每个认识方向独立计数、换问不占正式问题次数、用户消息即时入列、日志全程可用、退出记录回看，以及“换个问法”图标交互。

稳定性复核中进一步发现旧 10×3 裁决器会放过同一场景的重复方向错误。本候选增加“低估、高估、忽略或漏掉判断依据”的高置信判断校准信号，并将重复方向错误设为硬门。修复前报告保存在 `2026-08-04-gi066-fix-thought-stability-pre-hard-gate`，不进入最终准入证据。

## 冻结证据

- DeepSeek 官方最小预检：通过，耗时 `6.441s`。
- 10×3：动作 `30/30`、方向 `30/30`、完整无问题 `30/30`、重复选题错误 `0`。
- 自动 8+2：主链 `8/8`、日志闭环 `8/8`、两条冒烟通过、失败 `0`。
- 正式生成式回合：`21`；运行降级 `0`；最大连续降级 `0`。
- 日志：AI 接受 `7/8`、标题修复 `1`、全文安全回退 `1/8`。
- 完整文本可见：中位数 `3.820s`、P90 `5.371s`。
- 可继续操作：中位数 `3.860s`、P90 `5.410s`。
- 非模型耗时：中位数 `0.070s`、P90 `0.080s`。
- 隐私检查：通过；只读报告排除用户原话、AI 全文、日志正文和 Trace 内容。

候选代码、Provider、模型、Prompt、策略、语义产物或状态协议变化时，本证据失效并重新执行预检、10×3、自动 8+2 和人工实聊。
