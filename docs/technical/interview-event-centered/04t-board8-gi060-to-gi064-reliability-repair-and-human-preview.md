# 04t｜GI-060–GI-064 运行可靠性修复与人工实聊准备

最后更新：`2026-08-05`

状态：`历史自动技术证据保留；GI-066 真人体验 No-Go 后由 GI-067 接管当前策略`

置信度：`高`

历史所属板块：`8｜内部 Preview、Go/No-Go 与生产授权`

Production：`继续保持 legacy + baseline；本轮未执行生产部署、开关切换、迁移或数据写入`

板块事实源：[04p｜板块 8 内部 Preview、Go/No-Go 与生产授权](./04p-board8-preview-go-no-go-production-authorization.md)

产品规则来源：[04s｜GI-059 提问思路、深聊完成与真实体验复验](./04s-board8-gi059-question-thinking-deep-completion-and-real-experience-reverification.md)

历史产品交接：[04u｜GI-066 理清想法的判断地图、主动提问与认识增量协议](./04u-board8-gi066-thought-only-question-strategy.md)

当前产品事实源：[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)与[04x-07｜GI-074 评测体系及下游交接](./04x-07-evaluation-preview-and-handoff.md)

最终候选证据：[GI-064 候选血缘](../../../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/candidate-lineage.md)、[Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/preview-execution-evidence.md)、[Board8 Markdown 审计](../../../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/board8-audit/board8-preview-candidate-audit.md)、[Board8 JSON 审计](../../../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/board8-audit/board8-preview-candidate-audit.json)

## 1. 当前结论

本文保留 GI-060–064 的实现与自动技术证据。GI-066 已将当前产品收口为理清想法单角度，并改变完成标准、提问方向、模型职责和验证方式；因此 GI-064 不再承担当前 Preview、人工裁决或 Production 授权证据。

GI-059 当时冻结的体验规则包括：每个提问轮提供一至两句 `thinkingSummary` 和一个正式问题；深聊至少完成一轮真实问答后才允许形成成果；用户自行形成成果时直接进入第二检查点；双事件先完成焦点选择，再按当前事件判断个人反应。

GI-059 的脚本化候选完成主链后，因生成式降级和等待时间未达到发布门。GI-060–GI-064 围绕该阻断形成连续可靠性修复，并由 GI-064 通过当时的自动发布门。其脚本化结果无法替代人工体验，也无法证明 GI-066 的判断地图和主动提问策略。

## 2. 本轮修复范围

本轮只解决运行可靠性和候选证据问题，GI-059 的产品规则保持有效。

| 修复方向 | 当前处理 | 对用户体验的意义 |
|---|---|---|
| 回合等待 | 统一记录完整文本可见、可继续操作、模型和非模型阶段耗时；复用单回合上下文，减少重复读取 | 用户等待有清楚的衡量口径，减少不必要的空等 |
| 语义校验 | 语义产物哈希采用稳定的对象键排序；真实内容变化继续失败 | 同一份理解在保存和恢复后保持一致 |
| 角度关闭 | 连续说不清或明确停止后，当前角度进入 `closed` 并在刷新后保留 | 用户已停止的方向不会再次出现 |
| 关系来源 | 仅对用户已经表达的“事件或行为影响体验”做有限归一；新增关系继续安全降级 | 保留自然表达，同时保护事实边界 |
| 定向修复 | 格式或可安全补齐的表达携带具体原因重试一次；安全风险立即进入 baseline | 减少可修复的无效降级，风险仍优先保护 |
| 示例来源隔离 | Few-shot 中的占位来源编号不能进入真实语义产物；真实输出只能引用当前有效事实或本轮新增事实 | 示例不会污染用户真实内容的来源链 |
| 审计分账 | 事件记录、系统控制、正式生成式回合和日志闭环分别统计 | 降级率和性能判断只反映真实生成式体验 |

## 3. 当前冻结候选

| 项目 | GI-064 值 |
|---|---|
| 运行范围 | 本机独立 Preview 数据库；`optional + generative` |
| Provider | DeepSeek 官方 API 的 `openai` 兼容链路 |
| API 地址 / 模型 | `https://api.deepseek.com` / `deepseek-v4-flash` |
| 策略版本 | `5.62.0` |
| 语义 Prompt | `2026-08-04.event-centered-generative-v82-gi064-source-placeholder-repair` |
| 可见表达 Prompt | `2026-08-04.event-centered-generative-v82-gi064-source-placeholder-repair-visible` |
| 语义产物 | `event-centered-semantic-plan.v14` |
| 候选起点 | `2026-08-04T05:24:34.641Z` |

模型、Prompt、策略、角度卡、Few-shot、语义产物或共用入口与提问策略发生变化后，当前 Preview 证据失效，按 GI-054 从头执行脚本化 `8+2` 和人工实聊。

## 4. 自动发布门结果

最终运行目录为 `2026-08-04-gi064-scripted-deepseek-official-preview-r2`。该运行使用新的独立 Preview 数据库和候选窗口，历史执行不会混入本轮计数。

| 发布门 | GI-064 结果 | 裁决 |
|---|---:|---|
| 8 条主链 | `8/8` | 通过 |
| 日志生成、编辑、保存、刷新和重新打开 | `8/8` | 通过 |
| 第一检查点冒烟 / 旧五维默认入口冒烟 | `1/1` / `1/1` | 通过 |
| 一票阻断 | `0` | 通过 |
| 正式生成式回合 / 最终 baseline | `18 / 2` | 通过，累计与连续均在门内 |
| 最大连续 baseline | `1` | 通过 |
| 日志 AI 接受 / 标题修复 / 全文 fallback | `8 / 0 / 0` | 通过 |
| 完整文本可见 | 中位数 `3.85s`，P90 `4.97s` | 通过 |
| 可继续操作 | 中位数 `3.89s`，P90 `5.00s` | 通过 |

审计还记录 `8` 个事件记录回合、`9` 个系统控制动作、`1` 个定向修复成功和 `6` 个局部确定性思路修复。事件记录与系统控制动作均已从正式生成式降级分母排除。

## 5. 历史证据与候选血缘

- GI-058 保留技术通过、人工体验 `No-Go` 的记录。它提供了复述、浅层深聊和双事件串线等体验问题的输入，候选已失效。
- GI-059 保留产品规则和脚本化 `8+2` 自动 `No-Go` 的记录：最终 baseline `10/17`、最大连续 `5`、双延迟 P90 约 `25.4s`。它说明功能闭环不能替代可靠性门。
- GI-064 r1 保留为脚本角色卡回复不充分的历史执行：`relationship-2` 缺少对实际问题的第三条风险回答，未作为当时候选裁决。
- GI-064 关系轨迹预检 r2 已通过；最终 r2 才是当前自动发布门的唯一证据。

完整内容继续留在受控 Preview 数据库；文档和只读报告只保留会话、事件、日志和 Trace 标识，以及脱敏结论。

## 6. 历史人工实聊计划

GI-064 自动门通过后曾计划由产品负责人使用本机工作台完成以下人工验证。GI-066 冻结后，本计划停止执行并保留作历史：

1. `4` 条真实事件自然交流，`4` 条风控角色卡根据 AI 实际问题现场作答。
2. 每条深聊至少完成一轮有效问答；每条都完成日志生成、编辑、保存、刷新和重新打开。
3. 逐条填写“通过 / 条件通过 / 失败”、脱敏问题摘要和最终决定依据。
4. 最终发布门要求至少 `6` 条通过、最多 `2` 条条件通过、失败为 `0`，并持续满足 GI-051 的安全、日志、降级和双延迟门。

工作台地址：`http://127.0.0.1:3010/preview/board8-gi064-review`。

工作台只在本机、显式开启评审环境并连接隔离 Preview 数据库时可用。浏览器只保存人工裁决和脱敏摘要；完整用户内容、AI 全文、日志正文和 Trace 上下文不会进入导出内容。

人工 Go 后仍需产品负责人单独批准，才可以执行 Production 配置快照、部署和前 `10` 次有效会话审计。人工 No-Go、失败轨迹或任一一票阻断会让板块 8 回到重新打开状态。

## 7. 工程验证

- 最新定向验证：`8` 个测试文件、`169/169` 个用例通过。
- 事件中心与 Board8 广泛回归：`59` 个测试文件、`958/958` 个用例通过。
- 全量测试：`266` 个测试文件、`2502/2502` 个用例通过。
- TypeScript、生产构建、Prisma schema validate、隔离 Preview 数据库 migrate status 和 `git diff --check` 通过。
- Lint 通过，保留仓库既有 warning；本轮不新增数据库 migration。

## 8. 当前交接状态

GI-064 状态固定为“历史自动技术证据”。GI-066 已完成判断地图、系统选题、语义重复门、`10×3` 和单角度 `8+2`，最新真人体验裁决为 `No-Go`，候选失效。`GI-067 / GI-068～074` 已冻结，后续进入板块 5；板块 6 负责评测资产化，板块 7 等待板块 5～6，板块 8 等待新候选。Production 继续保持 `legacy + baseline`。
