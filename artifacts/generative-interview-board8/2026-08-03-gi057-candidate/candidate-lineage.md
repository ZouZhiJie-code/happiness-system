# GI-057｜候选血缘与 Preview 执行状态

## 1. 候选身份

- 候选目标：板块 8 独立 Preview；Production 保持 `legacy + baseline`。
- `candidateStartedAt`：`2026-08-03T07:32:44Z`（候选版本冻结时间；已用于本轮 Preview）。
- Preview 数据库：`happiness_board8_preview_20260803`，与共享数据库隔离。
- 候选模型：`deepseek-v4-flash`。
- 事件中心生成策略：`5.52.0`。
- 角度卡：`2.14.0`。
- Few-shot：`quality-patterns.2026-08-03.v31`。
- 访谈语义 Prompt：`2026-08-03.event-centered-generative-v74-gi057-source-contract`。
- 可见回应 Prompt：`2026-08-03.event-centered-generative-v74-gi057-source-contract-visible`。
- 语义契约产物：`event-centered-semantic-plan.v7`。
- 报告版本：`board8.candidate-aware.v3`。

## 2. Preview 范围

- 主链：四角度 × 引导复盘 / 深聊共 8 条。
- 补充链路：第一检查点四角度平等展示；五维默认入口启动、提交一次有效内容并刷新恢复。
- 日志闭环：每条主链完成生成、编辑标题或正文、正式保存、刷新和重新打开。
- 审计字段：入口识别、确定性控制动作、正式生成式回合、运行降级、定向修复、日志闭环、Trace 和人工裁决空字段。
- 原话、AI 全文、日志正文和 Trace 上下文只允许保留在受控 Preview 数据中，不写入本目录报告。

## 3. 当前状态

`preview_executed; automatic_no_go; manual_adjudication_pending`

GI-057 已完成代码实现、定向自动化验证、全量工程验证和独立 Preview。Preview 数据库为 `happiness_board8_preview_20260803`，已应用当前仓库全部 `38` 条迁移，数据库状态为 up to date；共享数据库未执行迁移、写入、部署或 Production 开关切换。

本轮从候选起始时间开始按首条有效内容排序并根会话去重，8 条主链全部完成。事件日志生成、编辑、保存和刷新重开为 `8/8`，24 小时内保存为 `8/8`。正式生成式尝试 `12` 次，最终运行降级 `3` 次，最大连续 `2` 次；回应等待中位数 `50.877s`、P90 `77.999s`。候选超过 GI-051 的速度条件线，并超过最多 `2` 次运行降级上限，因此自动发布门裁决为 `No-Go`。

第一检查点冒烟通过，旧五维默认入口使用独立账号完成启动、提交一次有效内容和刷新恢复。感受 2 因明确停止后需要重新选择角度，按 GI-051 记录为轨迹失败；该问题与日志主链保存成功分开记录。

只读报告和脱敏执行证据见 [Board8 JSON 审计](./board8-preview-candidate-audit.json)、[Board8 Markdown 审计](./board8-preview-candidate-audit.md) 和 [Preview 执行证据](./preview-execution-evidence.md)。人工内容裁决字段继续由产品负责人填写，完整内容留在受控 Preview 数据库。

## 4. 已完成的工程证据

- 定向事件中心测试：入口分流、四角度首问、共用问停、纠正、来源关系、同角度成果更新、定向修复和 Board8 分账均通过。
- 全量测试：`261` 个测试文件、`2448/2448` 个用例通过。
- TypeScript：通过。
- Production build：通过。
- Prisma schema validate：通过。
- Lint：`0` 个错误、`46` 个既有警告。
- `git diff --check`：通过。

## 5. Preview 执行与后续

本轮已在隔离 Preview 环境设置 `INTERVIEW_EVENT_CENTERED_MODE=optional`、`INTERVIEW_EVENT_CENTERED_STRATEGY=generative`，模型为 `deepseek-v4-flash`；已从头执行 8 条主链、第一检查点冒烟、旧五维默认入口冒烟和 8 条日志闭环，并使用 `candidateStartedAt` 与 `strategyVersion=5.52.0` 运行 Board8 v3 只读报告。

自动发布门为 `No-Go`。下一步由产品负责人完成隐私、原话、事实、纠正、停止、来源和伤害性建议的人工裁决，并判断共同根因修复范围；若确认多个独立根因，方案重新打开。修复候选必须按 GI-054 从头重跑全部 8 条主链。

Production 继续保持 `legacy + baseline`。当前候选 No-Go 后，下一步按 GI-054 判断共同根因修复范围；若确认多个独立根因，方案重新打开。
