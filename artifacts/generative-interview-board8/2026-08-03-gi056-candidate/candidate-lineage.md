# GI-056｜2026-08-03 独立 Preview 候选血缘与裁决

## 1. 候选身份

- 候选目标：板块 8 独立 Preview；Production 保持 `legacy + baseline`。
- 候选观察起点：`2026-08-03T00:00:00Z`。
- 候选模型：`deepseek-v4-flash`。
- 事件中心生成策略：`5.51.0`。
- 角度卡：`2.13.0`。
- Few-shot：`quality-patterns.2026-08-02.v30`。
- 访谈语义 / 可见表达 Prompt：`2026-08-02.event-centered-generative-v73-source-contract` / `2026-08-02.event-centered-generative-v73-source-contract-visible`。
- 语义契约产物：`event-centered-semantic-plan.v6`。
- 事件日志来源 Prompt：`2026-08-02.event-journal-source-refs-v2`。

## 2. Preview 范围

- 独立数据库：`happiness_board8_preview_20260802`。
- 主链：8 条，覆盖感受、想法、关系、行动四个角度，以及引导复盘和深聊路径。
- 补充链路：第一检查点四角度平等展示；五维默认入口 `joy` 启动、提交一次有效内容并刷新恢复。
- 日志闭环：8 条主链均完成生成、编辑、正式保存、刷新和重新打开。
- 真实事件与风控事件：按 GI-054 / GI-056 轨迹矩阵执行；原始内容仅保留在受控 Preview 数据库。

## 3. 候选根会话

最终审计纳入的 8 个根会话：

1. `b1eed7e6-c824-4060-bb67-d2681ecfe9b7`
2. `c5dd5fad-6294-448b-b2ed-9b76af72bb65`
3. `bfa023a9-925e-4bee-b9f8-9711cfd47d0f`
4. `7c3a0197-30eb-491d-be85-88d3788fd8e9`
5. `c30d0993-109e-46c5-ad7f-b720bdbc6871`
6. `b43a074a-074e-454f-89dd-53e73a32d604`
7. `5e07086f-94c5-41d9-94e5-2b6a7399fa66`
8. `4b4d72c8-ad35-4fcb-9212-fdec4cffaeb1`

补充保留的失败证据：`7bfa1499-8b1b-4c03-ba83-e20523580bb5`。该会话在深聊中先回答后触发 `EVENT_ANGLE_ALREADY_COMPLETED`，停止恢复路径随后以新根会话复验通过；原始失败数据继续留在 Preview 数据库，未写入最终 8 条候选清单。

## 4. 自动化 Preview 结果

- 8/8 根会话完成首条有效内容、第一检查点、角度选择、第二检查点和日志保存恢复。
- 入口曝光 / 打开漏斗：`19 / 18`；其中包含候选执行期间的重复打开与复验请求，根会话主链按首条有效内容去重为 8 条。
- 真实生成式回合：`20`；确定性控制动作：`12`。
- 运行降级：`8`；最大连续：`3`；最近 20 个真实生成式回合降级率：`40%`。
- 降级错误码分布：`ask_requires_single_question: 1`、`INVALID_SCHEMA: 6`、`thinking_summary_must_acknowledge_correction: 1`。
- 用户可见回应等待：中位数 `3.00s`、P90 `8.52s`，速度档位通过。
- 日志生成 / 保存：`8 / 8`；24 小时内保存：`8 / 8`。
- 日志 AI 接受：`7`；标题修复：`1`；全文安全回退：`1`。
- 五维默认入口冒烟：`joy` 启动、有效内容提交、刷新恢复均通过。

完整只读审计：

- [JSON 报告](/Users/zouzhijie/Desktop/Happiness-system-codex/artifacts/generative-interview-board8/2026-08-03-gi056-candidate/board8-preview-candidate-audit.json)
- [Markdown 报告](/Users/zouzhijie/Desktop/Happiness-system-codex/artifacts/generative-interview-board8/2026-08-03-gi056-candidate/board8-preview-candidate-audit.md)

## 5. 当前裁决

- `optional + generative` 未达到 GI-056 生成式 Preview 发布门：运行降级超过累计 2 次，最大连续超过 2 次，最近 20 回合降级率超过 20%。
- 事件主链、日志生成保存主链和恢复主链可用；当前候选可收口为 `optional + baseline` 条件路径，生成式问题进入独立修复。
- Production 未切换，继续保持 `legacy + baseline`。
- 产品负责人人工裁决字段继续留空；隐私、原话、事实、纠正、停止、来源和伤害性建议的最终人工裁决仍需在 Preview 界面完成。

## 6. 证据边界

- 本文件只记录候选版本、会话 / Trace 标识、计数和脱敏错误码。
- 用户原话、AI 全文、事件日志正文、Trace 上下文和模型请求响应正文继续保留在受控 Preview 数据库，不写入文档或报告。
- 候选代码、模型、Prompt、策略和角度卡发生变化后，本批 Preview 结果失效。
