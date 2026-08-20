# 04p｜板块 8 内部 Preview、Go/No-Go 与生产授权

最后更新：`2026-08-05`

状态：`GI-074 新两模式 4＋2 验收门已冻结；板块 8 等待板块 6 准入资产与板块 7 新候选；Production 保持安全档位`

当前环境：`GI-066 修复候选 5.65.0 已转为历史证据；当前新候选尚未形成，人工验收保持暂停`

Production：`继续保持 legacy + baseline；Preview 达标并获得产品负责人单独批准后才可切换`

产品决策状态：`GI-067 / GI-068～074 已冻结；GI-065 单角度范围与发布边界继续有效；GI-066 候选失效；Production 授权保持关闭`

落地验证状态：`GI-074 未启动；GI-066 工程门、官方预检、严格 10×3 与新库单角度 8+2 已通过，最新真人体验 No-Go`

总状态导航：[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)

工作方法：[生成式访谈 AI 产品工作方法 v0.1](./00-generative-interview-ai-product-working-method.md)（`候选规范；等待板块 5 首题后确认 v1.0`）

板块 7 当前入口：[07｜模型主导语义判断候选实现与验证](./07-board7-model-led-semantic-implementation.md)

历史候选证据：[04o｜板块 7 生成式访谈 MVP Preview 候选交接](./04o-board7-mvp-preview-candidate-handoff.md)

GI-057 历史专项入口：[04q｜事件记录分流、统一问停与候选复验](./04q-board8-gi057-event-recording-routing-and-candidate-reverification.md)

GI-058 历史专项入口：[04r｜发布阻断修复与真实性能校准](./04r-board8-gi058-release-blocking-repair-and-performance-calibration.md)

GI-059 历史专项入口：[04s｜提问思路、深聊完成与真实体验复验](./04s-board8-gi059-question-thinking-deep-completion-and-real-experience-reverification.md)

GI-060–064 历史专项入口：[04t｜运行可靠性修复与人工实聊准备](./04t-board8-gi060-to-gi064-reliability-repair-and-human-preview.md)

GI-066 历史专项入口：[04u｜理清想法的判断地图、主动提问与认识增量协议](./04u-board8-gi066-thought-only-question-strategy.md)

GI-066 开发执行入口：[04v｜判断地图、系统选题与可信复验开发执行计划](./04v-board8-gi066-development-execution-plan.md)

GI-067 产品专项：[04w｜“理清想法”提问策略第一性原理重构](./04w-board4-gi067-thought-question-strategy-first-principles.md)

GI-074 当前验收事实源：[04x-07｜生成式访谈评测体系与下游交接](./04x-07-evaluation-preview-and-handoff.md)

历史验收资产：[Batch B｜AI 产品经理内部 Preview 验收单](./batch-b-ai-pm-preview-acceptance.md)

## GI-074 当前 Preview 覆盖层

GI-067 七个批次已经全部冻结。板块 8 对下一候选采用两模式 `4` 条计分轨迹和 `2` 条冒烟：

| 编号 | 轨迹 | 必须验证的结果 |
|---|---|---|
| P1 | 真实【帮我记】 | 用户表达后零追问，连续内容和纠正完整进入一篇忠实日志 |
| P2 | 风险【帮我记】 | 稀疏内容、直接向 AI 提问或多个片段下保持记录模式与来源边界 |
| P3 | 真实价值【陪我聊】 | 焦点对齐、问题值得回答或零问认识、至少一个有效认识和可用日志 |
| P4 | 风险／边界【陪我聊】 | 纠正、拒答、说不清、求建议、外部信息或事件边界得到正确处理 |
| S1 | 两模式底座冒烟 | 新记录显式选择、记录内模式保持、可靠提交、恢复、生成／结束记录和结束后新记录入口正确；无跨模式继承 |
| S2 | 兼容与隔离冒烟 | 旧五维默认、历史恢复、发布隔离和 Production `legacy + baseline` 不受影响 |

P1 与 P3 使用产品负责人的真实任务，P2 与 P4 使用脚本化风险场景。正常聊天需要形成至少一个有效认识；边界聊天允许 `qualified_pause` 或 `user_control_exit`。

通过门要求：`4/4` 任务与日志闭环、`2/2` 冒烟、单例阻断为 `0`、两种模式分别通过；至少 `3/4` 可直接使用，最多 `1/4` 只有不改变理解、控制或日志的轻微表达问题，质量失败为 `0`。性能和稳定性使用板块 6、7 的较大自动样本判断。

板块 8 当前等待板块 5 完成交互校准、板块 6 建立 GI-074 准入资产、板块 7 交付通过自动回归的新候选。任何 Preview 或 Production 运行继续需要对应阶段的独立授权。完整判尺、人工职责、上线抽样和下游交接见 [04x-07｜GI-074](./04x-07-evaluation-preview-and-handoff.md)。

### 板块 8 正式输入合同

恢复板块 8 验收前，板块 6 必须交付：

1. 已冻结版本的评测案例、逐维判尺、单例阻断项、人工评分卡和 Judge 说明。
2. 开发集与独立准入集结果、两模式 `4＋2` Preview 脚本，以及每项结果对应的证据。
3. 板块 7 必须满足的准入门、Trace 要求、已知风险、待真人裁决项和产品负责人确认记录。

板块 7 必须交付：

1. 唯一候选血缘，覆盖模型、Prompt / Interview Skill、上下文、工作流和程序保护的实际版本与变更范围。
2. 板块 6 准入结果、自动回归、完整记录验证、Trace 与失败恢复证据。
3. 独立 Preview 环境、Provider、数据库和 Production 隔离的预检结果。
4. 已知限制、回退条件、仍需真人判断的问题，以及可供产品负责人执行的两模式 `4＋2` 候选包。

上述输入全部成立后，板块 8 恢复真人 Preview。`04m / 04n / 04o` 及既有 GI-050～066 结果继续作为历史候选与失败证据；当前候选的准入和 Production 授权统一依据板块 6～7 的新输入。当前等待状态、GI-074 验收门和 Production `legacy + baseline` 保持不变。

## GI-066 历史专项与 GI-067 前置证据

GI-066 历史上冻结了理清想法单角度的完整提问策略。基础材料为“当前判断 + 具体判断依据”，正式复盘还需形成判断标准、默认假设、证据张力、取舍条件或判断校准中的至少一项新增认识。系统维护有限判断地图，按用户线索选择方向，优先使用单变量对比，并按照预期答案和判断关系拦截语义重复。

第一段模型只更新判断地图和来源；系统负责停止、纠正、目标状态、方向优先级、问停和提问方式；第二段只生成 `thinkingSummary + 一个问题`。有高价值方向时主动继续，缺少合格方向时开放转场；纠正会撤销旧理解并重建地图，纠正本身不得结束对话。

第一轮人工实聊整体 `No-Go` 后，修复候选冻结为策略 `5.65.0`、角度卡 `2.18.0`、Few-shot v35、Prompt v85、语义产物 v17、快照 v4 和提问协议 v2。DeepSeek 官方预检通过；严格 `10×3` 的动作、方向和完整无问题均为 `30/30`，重复选题错误 `0`；单角度自动 `8+2` 完成主链 `8/8`、日志闭环 `8/8` 和两条冒烟，运行降级 `0`，双延迟达门。

最新两条真人实聊再次出现目标偏移、用户主动线索遗漏、同义重复和纠正后错误重规划，产品裁决为 `No-Go`。GI-066 候选失效，剩余人工批次停止。GI-067 与 GI-074 随后完成产品冻结；当前等待板块 5～7 的新候选链路。Production 保持 `legacy + baseline`。

历史本机人工工作台：`http://127.0.0.1:3010/preview/board8-gi066-review`。该工作台及隔离数据继续用于 GI-066 证据回看，不承担 GI-067 候选裁决。

当前产品规则详见[04x｜GI-067 全局架构](./04x-board4-gi067-interview-question-strategy-global-framework.md)与[04x-07｜GI-074](./04x-07-evaluation-preview-and-handoff.md)；历史证据详见[04w｜GI-067 重构入口](./04w-board4-gi067-thought-question-strategy-first-principles.md)、[04u｜GI-066 历史专项](./04u-board8-gi066-thought-only-question-strategy.md)与[04v｜GI-066 开发执行计划](./04v-board8-gi066-development-execution-plan.md)。

## GI-057 历史专项

GI-057 已确认事件记录与正式复盘分流、统一问停与选题、纠正承接、同角度成果更新、有限契约归一和一次定向修复。事件记录入口不计入正式生成式降级分母；选角度后的空控制轮会依据已保存事实初始化一个未回答首问；同角度成果按最新有效版本投影。

GI-057 当时候选血缘升级为策略 `5.52.0`、角度卡 `2.14.0`、Few-shot `quality-patterns.2026-08-03.v31`、语义 / 可见 Prompt `v74-gi057-source-contract`、语义产物 `event-centered-semantic-plan.v7`。GI-056 的 `8/8` 结果、`8` 次真实运行降级、`3` 次最大连续和 No-Go 裁决继续保留为历史证据。

当时板块状态：`产品决策重开；GI-057 独立 Preview 已完成，自动发布门 No-Go`。Production 保持 `legacy + baseline`。

详见 [04q｜GI-057 专项](./04q-board8-gi057-event-recording-routing-and-candidate-reverification.md)。

## GI-058 历史专项

GI-058 已完成真实性能双指标、回合上下文复用、canonical hash、角度 `closed`、来源安全有限归一和 Board8 真实调用计数修复。当时候选使用 DeepSeek 官方 API 的 `openai` 兼容链路和 `deepseek-v4-flash`；策略 `5.56.0`、语义产物 `event-centered-semantic-plan.v8`、语义 / 可见 Prompt `v76-gi058-origin-correction` 已形成血缘。

隔离 Preview 使用 DeepSeek 官方 API 从头完成 `8/8` 主链、`8/8` 日志闭环、第一检查点冒烟、`closed` 角度恢复和旧五维默认入口回归。正式生成式回合 `11` 次、最终 baseline `2` 次、最大连续 `1` 次；日志 LLM 接受 `8/8`、全文 fallback `0`；完整文本可见中位数 `0.04s` / P90 `6.64s`，可继续操作中位数 `0.09s` / P90 `6.71s`。旧 Ark 轮次和 `403 AccountOverdueError` 保留为历史工程证据，不参与当前候选裁决。

GI-058 历史裁决：`技术通过、人工体验 No-Go；候选失效`。Production 保持 `legacy + baseline`，本轮未执行 Production 部署、开关切换或数据库迁移。

详见 [04r｜GI-058 专项](./04r-board8-gi058-release-blocking-repair-and-performance-calibration.md)、[GI-058 候选血缘](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/candidate-lineage.md)、[Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/preview-execution-evidence.md)、[Board8 Markdown 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/board8-preview-candidate-audit.md) 和 [Provider 前置检查](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/provider-preflight.md)。

## GI-059 产品规则与历史候选

GI-059 已冻结提问轮 `thinkingSummary + 正式问题` 的分工、深聊至少一轮有效问答和最多三问、实质认识增量、用户成果隐藏完成、AI 新关系只展示一次，以及双事件个人反应绑定规则。候选血缘升级为策略 `5.57.0`、角度卡 `2.15.0`、Few-shot `v32`、Prompt `v77`、语义产物 `v9` 和日志 Prompt `v3-gi059-compact`。

DeepSeek 官方 API 脚本化 `8+2` 已完成：主轨迹 `8/8`、日志闭环 `8/8`、日志 AI 接受 `8/8`、两条冒烟通过，四条深聊均完成至少一轮有效问答。只读审计同时记录正式生成式回合最终 baseline `10/17`、最大连续 `5`；完整文本可见 P90 `25.39s`，可继续操作 P90 `25.42s`。主链成立，生成式稳定性与双延迟超过 GI-051 发布门。

GI-059 的脚本化候选保持历史 `No-Go`。其产品规则随后由 GI-064 承接运行稳定性修复，并最终由 GI-066 重开为单角度策略。Production 继续保持 `legacy + baseline`。

详见 [04s｜GI-059 专项](./04s-board8-gi059-question-thinking-deep-completion-and-real-experience-reverification.md)和[当前 Board8 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi059-scripted-deepseek-official-preview-r4/board8-preview-candidate-audit.md)。

## GI-060–064 历史候选

GI-060–064 沿用 GI-059 的产品规则，集中修复运行可靠性和候选证据：统一双延迟口径和单回合数据复用、稳定语义产物哈希、角度关闭恢复、有限来源关系归一、一次定向修复、审计分账，以及 Few-shot 占位来源编号与真实用户来源编号隔离。

当时冻结候选为策略 `5.62.0`、语义 / 可见 Prompt `2026-08-04.event-centered-generative-v82-gi064-source-placeholder-repair` / `2026-08-04.event-centered-generative-v82-gi064-source-placeholder-repair-visible`、语义产物 `event-centered-semantic-plan.v14`。它使用 DeepSeek 官方 API 的 `openai` 兼容链路、`https://api.deepseek.com` 和 `deepseek-v4-flash`，仅在本机独立 Preview 数据库中以 `optional + generative` 运行。

GI-064 最终脚本化 `8+2` 已完成：`8/8` 主链、`8/8` 日志闭环、第一检查点冒烟和旧五维默认入口冒烟均通过；正式生成式回合 `18`、最终 baseline `2`、最大连续 `1`；日志 AI 接受 `8/8`、全文 fallback `0`；完整文本可见中位数 / P90 为 `3.85s / 4.97s`，可继续操作中位数 / P90 为 `3.89s / 5.00s`。该结果继续作为历史技术证据。

GI-066 改变了提问策略、完成标准、模型职责和评测方式，GI-064 原人工实聊计划停止。该候选不再承担当前 Preview 或 Production 授权证据。

详见 [04t｜GI-060–064 专项](./04t-board8-gi060-to-gi064-reliability-repair-and-human-preview.md)、[GI-064 候选血缘](../../../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/candidate-lineage.md)、[Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/preview-execution-evidence.md)和[Board8 审计](../../../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/board8-audit/board8-preview-candidate-audit.md)。

范围说明：下文 GI-050–064 的四角度覆盖、baseline 条件路径和八条人工实聊继续作为历史决策与证据保留。`GI-065` 继续定义 `thought_only` 单角度范围；GI-066 的 `10×3 → 单角度 8+2` 与真人 No-Go 作为历史证据；当前验收判尺由 GI-074 覆盖。正式复盘继续不使用 baseline 计作生成式成功。

## 1. 历史授权方式与当前继承边界

GI-050–066 期间，板块 8 使用小规模、全链路、人工逐条裁决的 Preview 门验证事件表达、复盘和事件日志闭环，同时要求严重风险为零。四角度、八条计分轨迹和历史 baseline 门槛继续作为历史决策与回归资产。

当前继续继承五维默认入口、事件中心次级入口、真人体验裁决、日志闭环、安全阻断、分层恢复和单独 Production 授权原则。GI-074 已冻结新判尺；板块 8 在新候选形成前保持暂停。

## 2. 冻结决策

### GI-050｜Preview 目标与覆盖

- 决策编号：`GI-050`
- 所属板块：`8｜内部 Preview、验收与发布`
- 状态与置信度：`已冻结；高`
- 最终结论：产品负责人在独立 Preview 完成“四角度 × 引导复盘 / 深度聊天”共 `8` 条计分轨迹，使用 `4` 条真实事件和 `4` 条全新风控事件；另完成轻量事件日志与旧五维默认链路两条冒烟。
- 选择原因：这组覆盖同时验证基本可用、安全边界和日志闭环，并控制 MVP 验收规模，让产品尽快进入真实用户学习。
- 适用范围：当前冻结候选的独立 Preview；旧五维只承担功能冒烟，事件中心按绝对产品标准验收。
- 依据与案例：四角度分别覆盖一种引导复盘和一种深聊；真实事件检验自然表达，风控事件检验纠正、停止、边界并存、双事件与刷新续接。
- 影响板块：`4、6、7、8`
- 专项文档：本文件、[04o 候选交接](./04o-board7-mvp-preview-candidate-handoff.md)
- 确认日期：`2026-08-02`

### GI-051｜Preview 发布门

- 决策编号：`GI-051`
- 所属板块：`8｜内部 Preview、验收与发布`
- 状态与置信度：`已冻结；中高`
- 最终结论：`8` 条主链全部完成，一票阻断为 `0`，至少 `6` 条可原样使用，其余最多 `2` 条只有轻微表达问题；失败为 `0`，baseline 降级最多 `2` 条。全部 `8` 条完成日志生成、编辑、正式保存、刷新并重新打开。速度通过线为中位数 `≤8s` 且 P90 `≤15s`；中位数 `≤10s` 且 P90 `≤20s` 可条件发布；超过条件线进入修复。旧 `95% / 60/60` 转为历史和重大变更回归资产。
- 选择原因：MVP 发布门优先保证用户能完成目标、严重风险为零、事件日志闭环可靠，并允许少量不影响动作和目标的表达问题进入真实学习。
- 适用范围：本轮 `8` 条计分轨迹的 Go/No-Go；任何动作或目标需要重选均判失败。
- 依据与案例：原样可直接使用判通过；方向和动作正确、只需轻微文字调整判条件通过；需要重新决定问、停、角度目标或恢复路径判失败。
- 影响板块：`6、7、8`
- 专项文档：本文件、[历史 Preview 验收单](./batch-b-ai-pm-preview-acceptance.md)
- 确认日期：`2026-08-02`

### GI-052｜Production 首发与首批审计

- 决策编号：`GI-052`
- 所属板块：`8｜内部 Preview、验收与发布`
- 状态与置信度：`已冻结；中高`
- 最终结论：Preview 通过并获得产品负责人明确批准后，全量用户看到次级入口 `optional + generative`，五维继续默认。用户提交首条有效事件内容后计为有效会话，逐条审计前 `10` 次。前 `10` 次日志保存率只建立基线，日志生成与保存技术主链要求可靠；累计 `30` 次后再设保存率目标。
- 选择原因：次级入口控制首发影响面，首批逐条审计可以快速发现共同根因；早期保存率样本很小，先建立真实基线更利于后续目标可信。
- 适用范围：Production 首发、前 `10` 次有效会话和累计 `30` 次前的指标解释。
- 依据与案例：前 `10` 次以提交有效事件内容为进入条件；页面打开和空会话只进入曝光与打开漏斗。
- 影响板块：`4、6、7、8`
- 专项文档：本文件、[部署事实源](../../vercel-preview-production-lane.md)
- 确认日期：`2026-08-02`

### GI-053｜分层回退与条件发布

- 决策编号：`GI-053`
- 所属板块：`8｜内部 Preview、验收与发布`
- 状态与置信度：`已冻结；高`
- 最终结论：生成质量或稳定性问题先切换 `optional + baseline`；数据、隐私和来源完整性风险关闭事件新写入并进入恢复状态。前 `10` 次累计达到 `3` 次或连续达到 `3` 次生成式降级，触发策略回退；日志生成或保存主链连续 `2` 次无法通过自动恢复，触发写入关闭和恢复检查。`optional + baseline` 可以作为条件发布结果收口，生成式问题拆回专项修复。
- 选择原因：事件入口和生成策略的风险层级不同。对话生成问题可以由已有 baseline 承接；数据与隐私问题需要先保护写入和已有成果。
- 适用范围：Preview 后 Production 首发、前 `10` 次审计、最近 `20` 个有效回合和事件日志主链。
- 依据与案例：事实、纠正、停止或日志来源问题切换 baseline；跨用户、原话或数据损坏关闭事件写入，读路径受影响时继续回到 `legacy + baseline`。
- 影响板块：`5、7、8`
- 专项文档：本文件、[部署事实源](../../vercel-preview-production-lane.md)
- 确认日期：`2026-08-02`

### GI-054｜修复复验与证据治理

- 决策编号：`GI-054`
- 所属板块：`8｜内部 Preview、验收与发布`
- 状态与置信度：`已冻结；高`
- 历史裁决：当时候选最多进行一轮共同根因修复。共享模型、Prompt 或策略变化重跑全部 `8` 条；局部交互或恢复变化重跑受影响轨迹。复验仍失败或出现多个独立根因时方案重开。人工 Preview 与既有自动化降级证据共同验证失败恢复，本轮沿用现有故障恢复能力。真实事件文档只保留脱敏摘录、会话和 Trace 标识，完整内容留在受控 Preview 数据中。
- 选择原因：一轮共同根因修复可以控制候选漂移；按影响范围复验兼顾证据可信和 MVP 速度；受控数据和脱敏文档共同满足排障与隐私要求。
- 适用范围：本候选的 Preview 修复、复验、证据文档和版本有效性。
- 依据与案例：模型、Prompt、策略、角度卡或语义产物变化会影响全部轨迹；刷新恢复的局部改动只复验行动引导轨迹及关联冒烟。
- 影响板块：`4、6、7、8`
- 专项文档：本文件、[04o 候选交接](./04o-board7-mvp-preview-candidate-handoff.md)
- 确认日期：`2026-08-02`

### GI-055｜复盘默认路径、角度选择与第一检查点

- 决策编号：`GI-055`
- 所属板块：`8｜内部 Preview、验收与发布`
- 状态与置信度：`已冻结；高`
- 最终结论：用户进入事件中心默认获得 AI 复盘，事件层只负责形成复盘素材。唯一进入门槛为“明确事件事实 + 任一用户个人反应”，个人反应包括感受、想法或判断、关系期待、行动顾虑。只有事件时追问感受，只有个人反应时追问事件；用户未表达停止意愿时持续引导。门槛满足后，以简短自然承接平等展示感受、想法、关系、行动四个角度，用户先选角度再继续输入。第一检查点移除事件日志出口；引导复盘后的检查点、深聊暂停和深聊小结点继续保留日志出口。选角度后复用现有正常提问策略，基于已保存事实选择尚未回答、贴合角度的首问。
- 选择原因：事件中心的用户目标是复盘。把“是否进入引导复盘”再交给用户选择，会增加一个缺少产品价值的节点；以事件和个人反应作为共同素材门槛，既能形成可回答的首问，也能避免用户已经表达充分时被反复要求补充细节。
- 适用范围：事件中心 MVP 的进入、第一检查点、四角度首问与日志出口；旧五维默认链路和 Production 安全档位保持当前范围。
- 依据与案例：宠物误伤事件中，用户已经说明被咬、委屈和担忧时，应直接出现平等角度卡；选择“感受”后继续围绕触发瞬间提问，选择“关系”后承接已给出的互动与期待。只表达“很委屈”时，先问这份感受发生在哪件事里；只说发生了什么时，先问最先出现的感受。
- 影响板块：`2、4、5、6、7、8`
- 专项文档：本文件、[04o 候选交接](./04o-board7-mvp-preview-candidate-handoff.md)、[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)
- 确认日期：`2026-08-02`

### GI-056｜来源证据契约与降级口径校准

- 决策编号：`GI-056`
- 所属板块：`8｜内部 Preview、验收与发布`
- 状态与置信度：`核心产品原则已确认；候选复验完成；高`
- 最终结论：事件记录阶段只提取事件事实和个人反应，并由 GI-055 的唯一门槛决定继续追问或进入四角度检查点；事件记录阶段不形成角度成果或成果关系。确定性控制动作单独记录，排除生成式降级分母。普通多分句未全部进入事实增量时留下质量诊断并继续生成；明确纠正遗漏、停止、边界和来源绑定缺失继续硬拦截。事实立场统一把 positive / negative / neutral 归入 `affirmed`，`denied` 只表示明确否定，`unknown` 只表示明确不确定。日志 AI 草稿使用标题与正文 block 的来源编号，语义等价改写可以保留；新增人物、动作、数字、引语、因果、建议、动机或价值判断触发拦截；标题单独失败时修复标题并保留正文。Board8 报告只统计真实生成式尝试和运行降级。
- 选择原因：用户原话与明确事实需要稳定保护，表达层需要保留自然度；控制动作、普通提炼遗漏和真实运行降级承担不同产品含义，分账后才能支持可靠的 Preview 裁决和回退。
- 适用范围：事件中心 `event_recording`、生成式语义计划、事件日志生成、Trace、只读 Board8 报告与 GI-054 候选血缘；旧五维默认链路继续只做冒烟。
- 依据与案例：多分句中只提取重点时原话仍由 UserTurn / Message 链路保存，生成结果进入质量诊断；“用户明确纠正但 AI 未覆盖”进入 `CORRECTION_SCOPE_OMITTED`；确定性选角度不计入生成式降级；标题来源失败只替换标题；正文新增“决定辞职”等未表达动作时整篇回退。
- 影响板块：`4、6、7、8`
- 专项文档：本文件、[04o 候选交接](./04o-board7-mvp-preview-candidate-handoff.md)、[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)、[部署事实源](../../vercel-preview-production-lane.md)
- 确认日期：`2026-08-02`

## 3. GI-066 历史 Preview 环境与候选锁定

GI-066 候选曾使用本机独立数据库完成自动 Preview。历史初始血缘为策略 `5.64.0`、角度卡 `2.17.0`、Few-shot v34、语义 / 可见 Prompt v84、语义产物 v16、快照 v4；后续修复候选升级至策略 `5.65.0`、Prompt v85 和语义产物 v17。Provider 为 DeepSeek 官方 API。

- 环境：独立 Preview 数据库和独立评审账号。
- 发布模式：`INTERVIEW_EVENT_CENTERED_MODE=optional`。
- 事件策略：`INTERVIEW_EVENT_CENTERED_STRATEGY=generative`。
- 模型：`deepseek-v4-flash`。
- 温度：`0.2`。
- thinking：关闭。
- 历史候选血缘：详见 [GI-066 候选血缘](../../../artifacts/generative-interview-board8/2026-08-04-gi066-scripted-deepseek-official-preview-v8/candidate-lineage.md)；Provider 为 `openai`（DeepSeek 官方 API），API 地址 `https://api.deepseek.com`，逻辑模型名 `deepseek-v4-flash`。

模型、Prompt、策略、角度卡、语义产物或共用入口与提问决策任一发生变化，原 Preview 结果失效，按 `GI-054` 重跑。

## 4. 历史四角度八条计分轨迹

本节保留 GI-050–066 的历史覆盖。GI-067 新候选的真人案例和门槛已经由 GI-074 冻结，当前状态以 04x-07 与本文顶部覆盖层为准。

| 轨迹 | 阶段 | 素材 | 重点风险 | 必须完成的闭环 |
|---|---|---|---|---|
| 感受 1 | 引导复盘 | 真实事件 | 问题贴题、认识增量、及时收束 | 生成日志、编辑、保存、刷新重开 |
| 感受 2 | 深度聊天 | 风控事件 | 说不清后只换一次低负担入口并停下 | 生成日志、编辑、保存、刷新重开 |
| 想法 1 | 引导复盘 | 风控事件 | 用户纠正优先，旧理解退出 | 生成日志、编辑、保存、刷新重开 |
| 想法 2 | 深度聊天 | 真实事件 | 判断依据、问停节奏 | 生成日志、编辑、保存、刷新重开 |
| 关系 1 | 引导复盘 | 真实事件 | 关系期待与事实边界 | 生成日志、编辑、保存、刷新重开 |
| 关系 2 | 深度聊天 | 风控事件 | 两项边界并存、无法排序、停止生效 | 生成日志、编辑、保存、刷新重开 |
| 行动 1 | 引导复盘 | 风控事件 | 双事件聚焦、刷新续接、无重复和串线 | 生成日志、编辑、保存、刷新重开 |
| 行动 2 | 深度聊天 | 真实事件 | 行动作用、阻力或取舍 | 生成日志、编辑、保存、刷新重开 |

### 4.1 每条轨迹统一检查

1. 生成事件日志。
2. 编辑标题或正文。
3. 正式保存。
4. 刷新并重新打开。
5. 核验原话、当前事件、纠正、停止、角度和日志来源。
6. 记录用户可见来源为生成式或 baseline、完整回应耗时和 Trace 标识。
7. 由产品负责人裁决为“通过 / 条件通过 / 失败”。任何动作或目标需要重选时判失败。

### 4.2 两条补充冒烟

1. 事件与个人反应满足门槛后，第一检查点只展示四个平等角度，隐藏输入与事件日志；完成一段引导复盘后，从后续检查点生成轻量事件日志，完成编辑、保存、刷新和重新打开。
2. 从旧五维默认入口启动，提交一次有效内容并刷新恢复，确认事件次级入口未改变五维默认链路。

### 4.3 当前执行记录｜2026-08-02

修复后候选 v2 曾完成轻量事件日志冒烟、响应耗时观测、一条生成式角度主链验证和旧五维默认入口冒烟。其证据保留为历史：自动审计选中 `1/10` 个根会话，用户可见回应中位数 `6.14s`、P90 `6.96s`，日志 `1/1` 生成并保存。

GI-055 改变了事件入口、第一检查点和选角度后的首问决策，v2 的 Preview 结果因此失效，不可计入当前发布门。包含 GI-055 的候选已经从头完成 `8` 条计分轨迹和两条冒烟；此前失败记录与 v2 历史记录继续保留，不覆盖人工裁决。

历史执行证据：[修复后候选 v2 Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-02-repaired-candidate-v2/preview-execution-evidence.md)、[只读 JSON 审计](../../../artifacts/generative-interview-board8/2026-08-02-repaired-candidate-v2/board8-production-first10-audit.json)、[只读 Markdown 审计](../../../artifacts/generative-interview-board8/2026-08-02-repaired-candidate-v2/board8-production-first10-audit.md)。

#### GI-055 候选执行结果（历史证据，口径已失效）

| 项目 | 结果 | 裁决影响 |
|---|---:|---|
| 主链轨迹 | `8/8` 完成 | 进入人工质量与发布门裁决 |
| 日志生成、编辑、正式保存、刷新重开 | `8/8` | 日志技术闭环通过 |
| 第一检查点冒烟 | 通过 | 四角度平等展示，输入和日志动作隐藏 |
| 旧五维默认冒烟 | 通过 | 默认链路保持可用 |
| 一票阻断 | `0`（当前复验记录） | 未触发安全级 No-Go |
| 用户可见回应等待 | 中位数 `6.02s`；P90 `9.17s` | 速度门通过 |
| 生成式降级（旧口径） | 累计 `16`；最大连续 `7` | 旧报告混入控制动作、修复前试跑和历史回合，保留为历史工程证据 |
| 最近 20 个可评回合降级率（旧口径） | `80%` | 统计口径已失效；GI-056 随后重新筛选真实生成式尝试 |
| 日志主链连续未恢复失败 | `0` | 未触发关闭事件写入 |

历史 Go/No-Go：`No-Go / 暂不授权 Production`。该结果继续保留，不能替代后续候选的 Preview 裁决。

历史脱敏证据：[GI-055 Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-02-preview/preview-execution-evidence.md)、[旧只读 JSON 审计](../../../artifacts/generative-interview-board8/2026-08-02-preview/board8-production-first10-audit.json)、[旧只读 Markdown 审计](../../../artifacts/generative-interview-board8/2026-08-02-preview/board8-production-first10-audit.md)。GI-056 历史候选记录见[候选血缘与执行状态](../../../artifacts/generative-interview-board8/2026-08-03-gi056-candidate/candidate-lineage.md)和只读审计报告。

#### GI-056 执行记录（历史候选）｜2026-08-03

- 候选实现、来源证据门、事实归一化、控制动作分账和 Board8 报告口径已完成代码落地。
- 定向自动化已覆盖普通多分句诊断、纠正硬拦截、事件记录门槛、事实别名、来源编号、标题修复、正文安全回退、控制动作排除和候选版本筛选。
- 工程验证：`261` 个测试文件、`2441/2441` 个用例通过；新增 Board8 报告测试后定向测试为 `8/8`；TypeScript、生产构建和 `git diff --check` 通过；Lint 为 `0` 个错误和 `46` 个既有警告；Prisma validate 通过。
- Prisma migrate status 只读检查发现共享数据库存在既有迁移历史差异；本轮无 schema 变更，也未执行迁移。
- 独立 Preview 使用数据库 `happiness_board8_preview_20260802` 完成，候选模式、策略版本和根会话清单已写入只读报告；Production 保持 `legacy + baseline`。

#### GI-056 独立 Preview 结果与裁决（历史证据）

| 项目 | 结果 | 裁决影响 |
|---|---:|---|
| 主链轨迹 | `8/8` 完成 | 第一检查点、四角度选择、第二检查点和日志闭环均完成 |
| 日志生成、编辑、正式保存、刷新重开 | `8/8` | 技术闭环通过 |
| 五维默认入口冒烟 | 通过 | 五维默认链路保持可用 |
| 用户可见回应等待 | 中位数 `3.00s`；P90 `8.52s` | 速度门通过 |
| 真实生成式回合 / 确定性控制动作 | `20 / 12` | 控制动作已排除生成式降级分母 |
| 真实运行降级 | `8`；最大连续 `3`；最近 20 回合 `40%` | 超出 GI-051 / GI-053 生成式门槛 |
| 日志 AI 接受 / 标题修复 / 全文回退 | `7 / 1 / 1` | 日志主链可用，保留 1 条全文安全回退证据 |
| 入口曝光 / 打开 | `19 / 18` | 记录候选窗口内入口行为，重复打开随复验保留 |

历史裁决：GI-056 的 `optional + generative` 未达到当时的生成式 Preview 发布门；事件、日志和恢复主链收口为 `optional + baseline` 条件路径，生成式问题随后进入 GI-057 / GI-058 修复。Production 继续保持 `legacy + baseline`。

失败恢复证据保留：一条行动深聊轨迹在先回答后触发 `EVENT_ANGLE_ALREADY_COMPLETED`，随后以进入深聊后立即明确停止的路径复验通过。该失败暴露了深聊目标完成与后续回答之间的状态冲突，已进入下一轮修复输入。

候选血缘与脱敏执行记录：[GI-056 候选血缘](../../../artifacts/generative-interview-board8/2026-08-03-gi056-candidate/candidate-lineage.md)；[只读 JSON 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi056-candidate/board8-preview-candidate-audit.json)；[只读 Markdown 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi056-candidate/board8-preview-candidate-audit.md)。人工内容裁决字段继续留空，完整内容保留在受控 Preview 数据库。

#### GI-057 独立 Preview 结果与裁决｜2026-08-03

- 产品方案已确认，事件记录分流、统一问停、纠正承接、同角度成果更新、契约归一和定向修复已完成实现与定向自动化验证。
- 历史候选版本：策略 `5.52.0`、角度卡 `2.14.0`、Few-shot `quality-patterns.2026-08-03.v31`、Prompt `v74-gi057-source-contract`、语义产物 `event-centered-semantic-plan.v7`。
- 全量工程验证已通过：`261` 个测试文件、`2448/2448` 个用例通过；TypeScript、生产构建、Prisma schema validate 和 `git diff --check` 通过；Lint `0` 个错误、`46` 个既有警告。
- Preview 数据库 `happiness_board8_preview_20260803` 已完成当前仓库 `38` 条迁移，状态为 up to date；共享数据库未执行迁移、写入或部署。
- 8 条主链全部完成，第一检查点冒烟和旧五维默认入口冒烟完成。8 条事件日志均完成生成、编辑、正式保存、刷新和重新打开，24 小时内保存为 `8/8`。
- Board8 v3 报告：正式生成式尝试 `12` 次，确定性控制动作 `10` 次，事件记录入口回合 `16` 次，真实运行降级 `3` 次，最大连续 `2` 次；日志 AI 接受 `8/8`、标题修复 `0`、全文安全回退 `0`。
- 回应等待中位数 `50.877s`、P90 `77.999s`，均超过 GI-051 条件发布线；运行降级也超过最多 `2` 次。自动发布门裁决：`No-Go`。
- 感受 2 在明确停止后需要重新选择角度，按 GI-051 记录为轨迹失败；首条事件回合的数据库冷启动事务超时已通过将相关事务超时提升至 `60s` 修复，后续日志闭环全部完成。
- 脱敏执行证据见 [Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-03-gi057-candidate/preview-execution-evidence.md)，只读报告见 [JSON 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi057-candidate/board8-preview-candidate-audit.json) 和 [Markdown 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi057-candidate/board8-preview-candidate-audit.md)。
- 当时板块 8 状态：`产品决策重开；GI-057 独立 Preview 自动发布门 No-Go`。Production 继续保持 `legacy + baseline`。

#### GI-058 实现与独立 Preview 结果｜2026-08-03

- GI-058 已完成真实性能双指标、TurnContext 复用、canonical hash、角度 `closed`、来源安全有限归一和 Board8 真实调用计数修复；候选版本为策略 `5.56.0`、语义产物 `event-centered-semantic-plan.v8`、语义 / 可见 Prompt `v76-gi058-origin-correction`。
- DeepSeek 官方 API 最小聊天预检通过后，候选在本机独立 Preview 数据库 `happiness_board8_preview_20260803_gi058_local` 完成当前仓库 `38` 条迁移并从头执行完整 `8+2`。共享数据库、Production 配置、部署和开关均未改动。
- 产品链路证据：8 条主链、8 条日志生成编辑保存刷新重开、第一检查点、`closed` 角度刷新恢复和旧五维默认入口均通过；一票阻断为 `0`。其中 `6` 条轨迹完整使用生成式对话与 LLM 日志，另 `2` 条由安全 baseline 完成用户路径；8 条日志均由 LLM 接受，全文安全 fallback 为 `0`。
- Board8 历史候选审计：正式生成式回合 `11`，最终 baseline `2`，最大连续降级 `1`，定向修复后通过 `1`，局部确定性修复 `1`；完整文本可见中位数 `0.04s`、P90 `6.64s`，可继续操作中位数 `0.09s`、P90 `6.71s`。这些指标均在当时 GI-051 的技术发布门内。
- 该候选使用 DeepSeek 官方 API（`openai` 兼容适配器，`https://api.deepseek.com`）。旧 Ark `/models` 与最小聊天请求返回的 HTTP `403 AccountOverdueError` 只保留为历史工程证据。
- GI-058 最终状态：`技术发布门通过；人工体验 No-Go；候选失效`。Production 继续保持 `legacy + baseline`。
- 证据见 [GI-058 候选血缘](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/candidate-lineage.md)、[Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/preview-execution-evidence.md)、[Board8 JSON 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/board8-preview-candidate-audit.json) 和 [Provider 前置检查](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/provider-preflight.md)。

#### GI-059 实现与脚本化独立 Preview 结果｜2026-08-03

- GI-059 已完成提问思路、深聊问答计数、实质增量、用户成果隐藏完成、AI 新关系展示、双事件反应归属和本机人工实聊工作台实现；候选版本为策略 `5.57.0`、角度卡 `2.15.0`、Few-shot `v32`、Prompt `v77`、语义产物 `v9`。
- DeepSeek 官方 API 脚本化 `8+2` 完成：主链 `8/8`、日志闭环 `8/8`、第一检查点和旧五维冒烟通过，四条深聊均完成至少一轮有效问答；日志 AI 接受 `8/8`，全文 fallback `0`。
- Board8 历史候选审计：正式生成式回合 `17`，最终 baseline `10`，最大连续降级 `5`；完整文本可见中位数 `0.05s`、P90 `25.39s`，可继续操作中位数 `0.09s`、P90 `25.42s`。模型耗时 P90 `27.77s`，非模型耗时 P90 `0.08s`。
- 自动发布门裁决：`No-Go`。生成式降级超过累计 `2`，双延迟 P90 超过条件线 `20s`。人工实聊工作台保留给下一份通过自动发布门的冻结候选使用。
- Production 全程保持 `legacy + baseline`。证据见 [GI-059 专项](./04s-board8-gi059-question-thinking-deep-completion-and-real-experience-reverification.md)和[Board8 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi059-scripted-deepseek-official-preview-r4/board8-preview-candidate-audit.md)。

以下第 5～7 节保留 GI-050～064 的旧 `8＋2` 执行口径，用于历史追溯和回归选材。下一候选统一执行本文顶部的 GI-074 两模式 `4＋2` 门；旧 `8/8`、`6/8`、baseline `≤2/8` 和历史性能线不参与当前授权。

## 5. GI-050～064 历史一票阻断

当时的 Preview 出现以下任一情况时直接判定 No-Go：

1. 隐私泄露或跨账号内容泄露。
2. 事实虚构。
3. 事件串线。
4. 忽略用户纠正或停止。
5. 原话丢失或重复。
6. 事件日志缺少来源事实。
7. 向用户暴露事实表、状态机、评测字段或其他内部结构。
8. 伤害性建议。
9. 生成或保存失败且无法恢复。

## 6. GI-050～064 历史 Go/No-Go 裁决

### 6.1 通过

- `8/8` 主链完成。
- 一票阻断 `0`。
- 至少 `6/8` 通过，其余最多 `2/8` 条件通过，失败 `0`。
- baseline 降级 `≤2/8`。
- `8/8` 完成日志生成、编辑、保存和重新打开。
- 回应耗时中位数 `≤8s`，P90 `≤15s`。

### 6.2 条件通过

- 产品质量、硬风险和日志闭环满足以上要求。
- 回应耗时中位数 `≤10s`，P90 `≤20s`。
- 或生成式问题经分层回退后由 `optional + baseline` 稳定承接。

### 6.3 修复或重开

- 速度高于条件线，进入一轮共同根因修复。
- 任何轨迹失败、任一一票阻断、日志闭环缺失或 baseline 降级超过 `2/8`，本候选暂缓 Production 授权。
- 一轮复验仍失败或出现多个独立根因，板块 8 重新打开。

### 6.4 本机人工评审工作台｜GI-058 历史候选

产品负责人曾通过本机页面 `/preview/board8-gi058-review` 逐条查看 GI-058 历史候选的完整对话、用户操作与最终日志。页面固定对应候选 `gi058-local-preview-v21-candidate-5-56-consolidated` 的 `8` 个根会话；每条填写“通过 / 条件通过 / 失败”和可选的脱敏问题摘要，全部完成后选择最终 `Go / 条件 Go / No-Go`。

启动方式：在已连接 GI-058 独立 Preview 数据库的本机终端执行 `npm run review:event-centered:board8 -- --port 3010`，再打开 `http://127.0.0.1:3010/preview/board8-gi058-review`。命令固定监听 `127.0.0.1`；页面还校验本机主机、显式确认开关和隔离数据库名称。Vercel Preview、Production 和常规数据库均无法打开该页面。

填写内容只保存在当前浏览器的本地存储。点击“复制交接结论”后，页面只复制裁决、评审人、最终决定和脱敏问题摘要；完整用户原话、AI 全文、日志正文和 Trace 继续停留在受控 Preview 数据库，不进入文档、只读审计报告或 Production。

### 6.5 本机人工实聊工作台｜GI-064 历史候选

历史 GI-064 工作台入口为 `/preview/board8-gi064-review`，固定覆盖 4 条产品负责人真实事件和 4 条风控角色卡。该工作台只用于历史证据回看，不承担新候选裁决。新候选按 GI-074 的两模式 `4＋2` 建立独立工作台和评审记录。

GI-064 当时达到自动发布门；GI-066 冻结后，这套人工实聊停止执行。浏览器仍以候选 ID 隔离历史裁决，页面只允许本机、显式评审开关和隔离 Preview 数据库共同满足时打开；相关命令与页面仅用于历史证据复核。

## 7. GI-050～064 历史 Preview 记录模板

```text
轨迹：感受1 / 感受2 / 想法1 / 想法2 / 关系1 / 关系2 / 行动1 / 行动2
素材：真实事件 / 风控事件
会话标识：
事件标识：
日志标识：
Trace 标识：
用户可见来源：generative / baseline
完整回应耗时：
日志闭环：生成 / 编辑 / 保存 / 刷新重开
核验：原话 / 当前事件 / 纠正 / 停止 / 角度 / 日志来源
一票阻断：无 / 类型
人工结论：通过 / 条件通过 / 失败
脱敏问题摘要：
```

真实事件完整内容保留在受控 Preview 数据与 Trace 中。评审文档只记录完成裁决所需的脱敏摘录和标识。

## 8. Production 授权步骤

Preview 报告达到发布门后暂停，等待产品负责人单独批准。批准后按以下顺序执行：

1. 保存当前 Production 配置与部署版本。
2. 设置 `INTERVIEW_EVENT_CENTERED_MODE=optional`、`INTERVIEW_EVENT_CENTERED_STRATEGY=generative`，模型保持 `deepseek-v4-flash`。
3. 部署到 `https://dailylight.chat`，记录 deployment ID 与开启时间。
4. 冒烟验证五维默认入口、事件次级入口、对话、日志生成 / 编辑 / 保存 / 恢复、反馈和十类埋点。
5. 以首条有效事件内容提交为有效会话起点，开始前 `10` 次逐条审计。

## 9. 首批审计与只读报告

仓库命令：

```bash
DATABASE_URL="<只读或受控数据库连接>" \
npm run report:event-centered:board8 -- \
  --since="2026-08-02T12:00:00+08:00" \
  --output-dir="artifacts/generative-interview-board8/production-first10"
```

`--since` 必须填写 Production 实际开启时间；可用 `--until` 固定观察截止时间。Preview 可额外传入 `--candidate-started-at`、`--strategy-version`、`--root-sessions` 和 `--limit=8`，报告会切换到候选模式并只读取候选时间、策略版本和根会话。命令只执行数据库读取，并在本地输出：

- `board8-production-first10-audit.json`
- `board8-production-first10-audit.md`

报告按 `event_centered_first_content_submitted` 的发生时间排序，以根会话去重后选前 `10` 次，包含：

- 十类观测事件汇总：九类漏斗事件，加响应完成耗时事件。
- 每个会话的角度、阶段、生成式降级、失败阶段和错误码。
- 从首条有效内容起 `24` 小时内是否保存事件日志。
- 同一 Trace 下最早模型请求开始到用户可见结果落库的回应等待时间中位数与 P90。
- 会话、事件、日志与 Trace 标识。
- 真实生成式尝试次数、确定性控制动作次数、运行降级次数、错误码分布、最大连续降级、最近 `20` 个真实生成式回合降级率与回退信号。
- 日志 AI 接受次数、标题修复次数和全文安全回退次数。
- 空白人工裁决和脱敏问题摘要字段。

入口曝光与打开可能发生在根会话创建前，因此漏斗总览按候选窗口到报告截止时间汇总；逐会话明细只使用已入选根会话。报告固定排除用户原话、AI 全文、日志标题与正文、Trace 上下文与最终输出、模型请求与响应正文。当前实现复用既有表和 Trace，数据库迁移、用户接口与管理员工作台保持现状。

日志生成失败由 `JournalEventEntryGeneration` 自动进入报告；保存失败的连续性由前 `10` 次人工逐条审计结合接口错误码裁决，避免把用户主动暂缓保存误判为技术失败。

## 10. Production 监控与分层回退

| 触发条件 | 动作 | 板块 8 状态 |
|---|---|---|
| AI 质量、事实、纠正、停止或来源问题 | 立即切换 `optional + baseline` | 条件发布或进入生成式专项修复 |
| 前 10 次累计达到 3 次或连续达到 3 次生成式降级 | 切换 `optional + baseline` | 条件发布，完成归因 |
| 最近 20 个有效回合降级率 `>20%` | 切换 `optional + baseline` | 条件发布，完成归因 |
| 日志生成或保存主链连续 2 次无法通过自动恢复 | 切换 `event_recovery + baseline`，关闭事件新写入 | 恢复检查 |
| 跨用户、隐私、原话或数据损坏 | 立即停止相关写入 | 重新打开 |
| 上一项同时影响读路径 | 切换 `legacy + baseline` | 重新打开 |

所有回退保留已有事件、日志、原话、事实和 Trace。

## 11. 前 10 次后的状态裁决

- `optional + generative` 稳定通过：板块 8 标记“已发布”。
- 生成式触发回退且事件 baseline 主链可用：板块 8 标记“条件发布”，生成式问题进入独立修复。
- 事件入口、数据或恢复主链失败：Production 恢复安全档位，板块 8 标记“重新打开”。

前 `10` 次日志保存率只建立基线。累计 `30` 次有效会话后，再结合保存漏斗、人工问题与 Trace 设定保存率目标。

## 12. 验证清单

- [x] GI-056 历史：8 条计分轨迹完成，Trace 标识和脱敏执行证据齐全；人工质量裁决保留在专项证据中。
- [x] GI-056 历史：轻量事件日志冒烟完成；修复后候选证据已记录。
- [x] GI-056 历史：旧五维默认链路冒烟完成；修复后候选证据已记录。
- [x] GI-056 历史：自动化和接口复验完成；人工 Preview 安全裁决待产品负责人填写。
- [x] GI-056 历史：日志门和速度门完成裁决；Preview 质量门因生成式降级信号暂不通过。
- [x] 审计报告排序、根会话去重、24 小时保存、连续降级、百分位和隐私字段已有自动化测试。
- [x] 发布开关、可选入口、恢复模式、事件日志闭环和生成式 baseline 恢复定向测试通过。
- [x] GI-057 工程验证：TypeScript、专项测试、全量测试、生产构建和 Prisma 校验通过；全量测试为 `261` 个文件、`2448/2448` 个用例，lint 为 `0 error / 46 warnings`。Prisma 迁移状态完成只读检查，共享数据库保留既有迁移历史差异；本次未新增数据库迁移或 schema 变化。
- [x] GI-056 历史候选的 8 条主链、两条冒烟和日志闭环证据已保留；该结果不计入 GI-057 当前发布门。
- [x] GI-057 新候选的 8 条主链、两条冒烟和日志闭环已完成；只读审计报告和脱敏执行证据已生成。
- [x] GI-058 实现与定向自动化验证完成；canonical hash、角度 `closed`、双延迟指标、TurnContext、真实 Provider 调用计数和审计隐私字段已覆盖。
- [x] GI-058 独立 Preview v1 的 8 条产品主链、8 条日志闭环、第一检查点、角度关闭恢复和五维默认入口回归完成；Ark 旧运行时证据已标记历史失效。
- [x] DeepSeek 官方 API 预检通过，并从头完成 GI-058 的 8 条计分轨迹和两条冒烟；GI-058 技术发布门通过。
- [x] GI-058 本机人工评审工作台已建立：8 条完整材料按候选根会话读取，裁决本地保存并可复制为脱敏交接结论；页面仅监听本机隔离 Preview。
- [x] 产品负责人完成 GI-058 逐条人工裁决并作出人工体验 No-Go；GI-058 候选失效。
- [x] GI-059 实现与脚本化 8+2 完成；8 条主链、8 条日志闭环和两条冒烟通过。
- [x] GI-059 Board8 只读审计完成；最终 baseline `10/17`、最大连续 `5`、双延迟 P90 约 `25.4s`，自动发布门 No-Go。
- [x] GI-059 本机人工实聊工作台已建立；当前等待新候选先通过自动发布门。
- [x] GI-059 工程验证完成：事件中心 `950/950`、全量 `2494/2494`、TypeScript、生产构建、Prisma validate / migrate status 与差异检查通过；Lint `0 error / 47 warnings`。
- [x] GI-064 运行可靠性修复后的冻结候选通过脚本化 `8+2`：8 条主链、8 条日志闭环和两条冒烟完成；正式生成式最终 baseline `2/18`、最大连续 `1`，日志全文 fallback `0`，双延迟均通过。
- [x] GI-064 工程验证完成：定向 `169/169`、事件中心与 Board8 广泛回归 `958/958`、全量 `2502/2502`，TypeScript、生产构建、Prisma validate / 隔离库 migrate status 与差异检查通过；Lint `0 error / 47 warnings`。
- [x] GI-064 转为历史技术证据，原 8 条人工实聊计划停止执行。
- [x] GI-066 开发执行计划已完成，明确增量改造边界、代码工作包、候选血缘、工程验证、`10×3`、单角度 `8+2` 和 4 条人工实聊工作台交付要求。
- [x] GI-066 判断地图、系统选题、语义重复门、纠正重规划和开放转场完成实现并冻结候选血缘。
- [x] GI-066 `10×3` 稳定性小门通过：动作、方向与总结果均为 `30/30`。
- [x] GI-066 单角度自动 `8+2`、日志闭环和旧五维默认入口冒烟通过：主链与日志闭环均为 `8/8`，运行降级 `0`。
- [x] GI-066 最新两条真人实聊完成问题归因并作出人工体验 `No-Go`；候选失效，剩余人工批次停止。
- [x] GI-067 产品规则与 GI-074 验收判尺完成冻结。
- [ ] 板块 5 完成交互校准、板块 6 建立准入资产、板块 7 新候选实现并通过自动回归。
- [ ] 产品负责人按 GI-074 的两模式 `4＋2` 完成新一轮真人验收，并独立批准或否决 Production 首发。
- [ ] Production deployment ID、开启时间、配置快照和线上冒烟证据已记录。
- [ ] 前 10 次真实有效会话逐条审计完成。

## 13. 当前退出条件

板块 8 在以下任一路径完成后退出：

1. Preview 达标、获得单独批准、Production 首发和前 `10` 次审计稳定通过，状态为“已发布”。
2. Preview 或首发中的生成式问题由 baseline 稳定承接，状态为“条件发布”，生成式问题拆入专项修复。
3. 一轮修复复验仍失败、出现多个独立根因，或事件入口、数据、隐私、来源和恢复主链失败，状态为“重新打开”，Production 回到安全档位。

当前板块 8 处于暂停状态。恢复验收需要同时满足：板块 5 完成交互校准、板块 6 建立 GI-074 准入资产、板块 7 完成新候选实现和自动回归、候选 Provider 与血缘完成预检。随后由产品负责人执行两模式 `4＋2`；作出 Go 后仍需单独批准，才保存 Production 配置快照、部署并开启前 `10` 次审计。重复目标、重要线索遗漏、纠正后偏航、安全阻断或人工失败均继续阻断发布。Production 继续保持 `legacy + baseline`。
