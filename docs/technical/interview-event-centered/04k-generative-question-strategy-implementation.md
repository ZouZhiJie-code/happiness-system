# 04k｜板块 7 生成式提问策略与链路改造

最后更新：`2026-08-05`

产品决策状态：`GI-066 已转为历史候选；GI-067 / GI-068～074 已冻结目标产品规则`

落地验证状态：`GI-066 自动技术层通过、最新真人实聊 No-Go；目标规则验证未启动，板块 7 等待板块 5～6 后实施新候选`

Production 状态：`保持 legacy + baseline；入口、模型、配置和数据维持原状`

## 当前状态｜等待板块 5～6 后实施

最新真人实聊证明，GI-066 的工程链路稳定，但固定判断地图、用户线索选择、完整语义覆盖和复合纠正重规划仍会产生产品级偏航。GI-066 候选已失效，剩余人工批次停止。`GI-067 / GI-068～074` 已冻结两模式、三阶段、场景、表达和评测规则；板块 7 当前复用既有 Provider、可靠提交、日志、恢复、性能和 Trace 底座，等待板块 5 交互规则与板块 6 正式评测资产完成后形成新实施方案。

## 历史交付｜GI-066 自动技术层达门

GI-066 将理清想法收口为有限判断地图和系统选题协议：

- 第一段模型只更新当前判断、判断依据、判断标准、默认假设、证据张力、取舍条件、判断校准及其来源；
- 系统处理停止、纠正、目标状态、方向优先级、问停、提问方式和语义重复；
- 第二段模型只生成一至两句 `thinkingSummary` 和一个正式问题；
- 基础材料只代表素材闭环，正式复盘还需形成至少一项进入后的新增认识；
- 有高价值方向时主动继续，缺少合格方向时开放转场；
- 正式复盘失败保留原话、地图和进度，不使用 baseline 或“简单模式”计作成功；
- 验证顺序为 `10×3 → 单角度 8+2 → 4 条人工实聊`。

运行代码、Prompt、语义产物、评测脚本与人工工作台已经落地，候选冻结为策略 `5.64.0`、角度卡 `2.17.0`、Few-shot v34、Prompt v84、语义产物 v16 和快照 v4。DeepSeek 官方预检通过；`10×3` 为 `30/30`；自动 `8+2` 主链与日志闭环均为 `8/8`。完整产品协议见 [04u｜GI-066](./04u-board8-gi066-thought-only-question-strategy.md)，执行结果见 [04v｜GI-066 开发执行计划](./04v-board8-gi066-development-execution-plan.md)。Production 继续保持 `legacy + baseline`。

## 历史交付｜GI-059 产品规则与 GI-064 候选

GI-058 技术候选经产品负责人人工评审判定为体验 `No-Go`。该历史候选随后以 GI-059 为准：

- `ask` 强制一至两句 `thinkingSummary` 和一个正式问题。思路负责解释 AI 对问题的理解、当前认识缺口与提问理由；复述、事实堆叠、答案预告和第一人称冒用进入质量失败或定向修复。
- 非提问轮思路为空。用户自己形成成果时写入隐藏完成标记，更新成果后直接进入第二检查点，不新增 AI 气泡；AI 综合只展示新增关系。
- 深聊首条自然输入建立微目标并触发首问；有效问答计数为零时禁止完成。完成依据为相对进入深聊前成果的实质增量，同一微目标最多三问。
- 双事件选择后只使用当前事件和明确归属于该事件的个人反应；归属不清时继续澄清。
- GI-059 历史候选血缘为策略 `5.57.0`、角度卡 `2.15.0`、Few-shot `v32`、Prompt `v77`、语义产物 `v9`、日志 Prompt `v3-gi059-compact`。

GI-059 的 DeepSeek 官方 API 脚本化 `8+2` 完成主链和日志闭环，四条深聊均完成至少一轮有效问答；其审计记录正式生成式最终 baseline `10/17`、最大连续 `5`、双延迟 P90 约 `25.4s`，自动发布门为 `No-Go`，保留为历史候选证据。

GI-064 使用同一组产品规则，候选血缘升级为策略 `5.62.0`、Prompt `v82`、语义产物 `v14`。DeepSeek 官方 API 独立 Preview 完成主链 `8/8`、日志闭环 `8/8`、两条冒烟；正式生成式最终 baseline `2/18`、最大连续 `1`，完整文本可见 P90 `4.97s`，可继续操作 P90 `5.00s`，日志全文 fallback `0`。GI-066 改变提问策略、完成标准与模型职责后，该候选转为历史技术证据，原 8 条人工实聊计划停止。实现与证据见 [04t｜GI-060–GI-064 专项](./04t-board8-gi060-to-gi064-reliability-repair-and-human-preview.md)。

## 历史交付｜MVP Preview 候选

历史严格评测证明了结构完整无法直接代表用户体验，也暴露了围绕假设案例持续调优的偏差风险。当前产品需要尽快进入真人 Preview，首发门因此聚焦用户能否完成基本任务及严重风险是否受控。

板块 7 已交付以下完整候选：

1. 同一个 `deepseek-v4-flash` 的两段式正常链路：第一段负责理解、问停、成果来源和提问意图，第二段只负责用户表达。
2. 第一段或第二段耗尽技术尝试后立即使用当前确定性 baseline，继续复用已保存原话与上一份已提交状态，新增模型请求 `0`。
3. 三个检查点均可生成事件日志；日志支持来源冻结、AI 生成、来源门、安全基础版本、编辑、自动暂存、保存和刷新恢复。
4. 五维继续作为默认入口；`optional` 提供“从一件事开始”的可选入口。Production 当前维持 `legacy + baseline`，`optional + generative` 仅为板块 8 获批后的目标。
5. 入口、首条内容、检查点、日志生成/保存、降级与放弃埋点已经接入；用户原话继续只进入受控 Trace。

最小真实验证结果：完整产品链路回应 `4/4`；生成式内部技术完整 `2/4`，另外两例使用确定性 baseline 恢复；严重事实、串线、边界和强推断错误为 `0`。事件日志闭环 `1/1`；真实日志模型草稿结构成功，来源门触发安全基础版本，最终可见日志来源门通过。自动验证为专项 `691/691`、旧规则 `580/580`、全量 `2393/2393`，生产构建、Prisma 与差异检查通过。

大型工作集、隐藏集、准入集、完整轨迹和盲评继续保存，转为上线后真实问题驱动的回归资产。历史 v62–v72、Provider v2–v5 和 `3.29.0` 的失败证据保持原裁决。板块 8 在独立会话完成 Preview、Go/No-Go、Production 授权、线上冒烟与回退。

完整交接见 [04o｜板块 7 生成式访谈 MVP Preview 候选交接](./04o-board7-mvp-preview-candidate-handoff.md)。下文保留各历史候选、失败根因和停止记录，用于后续回归与归因。

## 0. 历史规格基线｜失败重置与质量重构

### 0.1 失败结论

`3.29.0` 在 24 条工作单轮中取得通过 3、边缘 1、失败 20；边缘按未通过计，实际通过率为 `12.5%`。主要失败为认识增量不足 `12`、回答负担过高 `5`、目标选择偏差 `3`、上下文或假设失真 `1`。

该候选及其场景专用修复整体作废，相关产物只保留为失败证据：

- [用户裁决与失败重置报告](../../../artifacts/generative-interview-board7/2026-07-29/candidate-v3290-failure-reset-report.md)
- [结构化逐项裁决](../../../artifacts/generative-interview-board7/2026-07-29/candidate-v3290-user-adjudication.json)

后文第 1–10 节继续保存 `3.29.0` 的历史实现与原冻结记录，用于追溯失败原因。当前开发与评测以本节规格为准。

### 0.2 每轮用户结果

用户可见输出按动作区分：

- `ask`：一至两句 `thinkingSummary`，随后只出现一个问题。
- `complete / pause / honest_limit`：只出现一段自然回应，`thinkingSummary` 固定为空。

`thinkingSummary` 不展示完整内部思考、候选列表、评分和内部字段。完成与暂停轮需要连接事实与理解；材料有限时使用简短 `honestLimit`。成果只在 AI 对话中展示一次。

AI 对话中的 `thinkingSummary`、问题和停止回应统一使用第二人称或中性表达；第一人称仅用于明确引用的用户原话。日志第一人称正文由独立日志生成环节负责。

提问轮的思路优先保留模型原句，只在客观事实错误、残句或动作与内容冲突时修复。修复必须使用完整用户分句或完整事实，禁止抽取任意公共子串拼接。思路已经包含正式问题答案，或问题只重复已知事实时，当前逻辑轮无效并使用既有第二次技术尝试；第二次仍失败时停住，不展示低质量问题。

### 0.3 认识增量与模式

认识增量固定使用六类：

- `distinction`：看见此前未明确说出的区别；
- `connection`：连接原本分散的线索；
- `tension`：说清可以同时成立的张力；
- `meaning`：识别判断标准或关系意义；
- `function`：识别行动发挥的作用或保护内容；
- `scope_only`：材料有限时说明当前认识边界，只用于收束。

纯复述、同义改写和字段拼接直接失败。

| 模式 | 目标 | 允许策略 | 停止结果 |
|---|---|---|---|
| 引导复盘 | 在 `0～3` 次有效回答内形成一条阶段性认识 | 具体澄清、连接线索、用户主动理解与有证据的 AI 直接综合 | 展示当前认识或诚实说明范围 |
| 深度聊天 | 围绕一个微目标理解意义、张力、标准或行动功能 | 保持当前角度主线，可借用其他角度事实；同一目标最多三问 | 展示这一段的认识进展并暂停 |

用户完整回答当前提问目标，或两项体验都成立且当前分不清轻重时，引导复盘立即 `complete`，深度聊天立即 `pause`。`microgoal` 只约束探索方向、允许深度和连续三问上限，不自动制造新的必答层级，也不要求用户继续排序。

四角度新成果标准见[四角度公共协议](./04-four-angle-common-interview-protocol.md)及 `04a–04d`。具体事实承担证据职责，无法单独构成认识成果。

成果来源继续作为评测与 Trace 的辅助标签，不进入 Provider v3 的必填判断：

- `user_articulated`：用户已经主动说出有效理解，至少引用一条可追溯证据；允许忠实自然转述，以及当前事件内一步轻度解释，包括常见身体反应转成常见情绪标签、明确体验转成本次行为作用；
- `ai_synthesized`：至少连接两条相关、可追溯事实，形成用户尚未明确说出的当前事件内证据关系。允许新增的关系限于区别、先后、条件、可观察结果与实际影响；达到后直接 `complete / pause`。

排他改写、原因、动机、需要、人格、长期模式与他人动机不得进入用户成果。AI 综合继续遵守 `GI-040`：未由用户提供的感受标签、判断原因、关系意义与行动动机全部排除。AI 综合成果不附加确认问题；用户否认后撤销或替换成果，并关闭原方向。

### 0.4 问题选择顺序

```text
识别用户控制与安全边界
→ 更新当前有效事实
→ 判断 currentQuestionTarget 是否已被直接、完整回答
   └─ 已完成：整理 user_articulated 成果并 complete / pause
→ 判断现有事实能否在 GI-040 上限内形成 ai_synthesized 成果
   └─ 可以：整理证据关系并 complete / pause
→ 尚未形成成果时，检查 ask 三项条件
   ├─ 当前可见问题语义目标尚未完整回答
   ├─ 剩余缺口只能由用户提供
   └─ 一个具体、低负担补问会实质改变当前事件理解
→ 三项全满足后，保留抽象 goal，并把 answerEntry 下降到当前事件中可回忆、观察或模拟的小片段
   ├─ 用户能从动作、画面、原话、比较或判断瞬间直接回答：生成一个问题
   └─ 无法形成具体 answerEntry：停止提问，进入 ready 或 limited
→ 三项未全满足：honest_limit
→ 生成可见内容并校验
```

用户明确说不清后，同一认识目标最多再换一次满足上述标准的具体入口。隐藏判尺可以记录 `safeAlternateEntry`，该字段不进入 Prompt、Few-shot 或模型运行时输入。找不到安全入口，或换入口后仍说不清时立即停止。

以下内容直接失败：低价值事实收集、抽象元语言、`answerEntry` 与 `goal` 停留在同一层、重复原问题、强迫二选一、遗漏用户重要线索、模式深度不符、纯复述成果，以及明确引用之外由 AI 使用第一人称替用户自述。用户回答后仍不会改变当前理解的问题不得进入可见输出。

### 0.5 过拟合清理边界

新候选需要删除：

- 针对“赴约、课程、自制力、负责人、晚饭、工作群、报名截止”等工作集原句的语义正则；
- 场景专用固定问题；
- 按失败码直接注入标准答案的修复逻辑；
- 依赖业务关键词判断产品质量的伪硬检查。

继续保留：用户停止、纠正、拒绝与切换，事实引用与活动分支，单一问题、安全边界、三问上限，可靠提交、失败恢复和 Trace。模型返回结构有效但质量差时保留为正式失败，不通过技术重试挑选更好版本。

### 0.6 极简两段式内部协议 v2（历史候选）

本节保留 v67 / Provider v2 的原始协议，用于追溯首轮失败。当前运行候选已经升级为第 0.20 节的 Provider v3；v2 字段和历史评测结果不回写。

```text
第一段｜理解小卡
- understanding
- decision.state：needs_more / ready / limited
- decision.origin：user_articulated / ai_synthesized / null
- decision.basis / missingUnderstanding / selectedTargetId / cognitiveAction / insightKind
- meaningCard.main：一个主意思及证据
- meaningCard.necessaryScope：最多两条限制、修正或补全主意思的并存内容及证据

第二段｜用户表达
- ask：thinkingSummary + 一个问题
- complete / pause / honest_limit：一段自然回应
```

第一段只做事实更新、边界与纠正识别、成果来源判断、问停判断和目标选择。`main` 只保存本轮新增的一个主意思；`necessaryScope` 只保存会改变主意思适用范围的并存内容；其他新线索进入 `factDeltas`。

系统根据理解小卡生成现有状态与 Trace 所需的兼容字段：`action`、合并后的 `evidenceRefs`、`expectedUnderstandingDelta`、AI 综合时的 `tentativeInterpretation`、`realizationContract` 和 `microgoalDelta`。Provider 不再生成这些重复语义字段。`responseCore` 只由系统生成以兼容现有内部结构，不再进入第二段输入，也不承担逐字保真约束。

第二段只接收理解小卡、小卡引用的用户原话、冻结后的动作/角度/来源/提问目标，以及提问场景中的上一道问题。它首次生成用户可见文案，并且不能改变主意思、必要范围、成果来源和问停动作。运行时不增加第三次模型检查，也不注入完整历史对话。

当前内部版本为语义计划产物 `event-centered-semantic-plan.v2`、第一段 Prompt `2026-08-01.event-centered-generative-v67-meaning-card`、第二段 Prompt `2026-08-01.event-centered-generative-v67-visible`。Trace 保存结构化最终依据和用户实际看到的内容，不保存完整思维链。新版本不生成 `test_understanding`；该动作只保留历史数据兼容。

### 0.6.1 轻量检查点与纠正

内部阶段状态继续保留，用户界面采用输入框上方的持续轻提示：

- 第一阶段结束：`这件事已经记下。选个方向继续，也可以接着补充。`，展示 `感受 / 想法 / 关系 / 行动` 四个入口；
- 引导复盘结束：`这一段先到这里。继续输入会沿刚才的方向深入。`，展示轻量“换个角度”入口；
- 用户直接输入时，系统沿上一个完成角度进入深入聊聊；
- 大卡片、阶段标题、成果副本和可见“继续深入”按钮退出当前界面；`continue_exploration` 接口继续保留兼容。

`correct_understanding` 接收可选目标 AI 回复编号。纠正阶段性认识时，用户给出新理解则替换原成果；用户只否认则撤销成果并重新打开当前角度；既有有效事实继续保留。历史客户端未提供编号时使用最近一条 AI 回复。

### 0.7 MVP 两段式职责与恢复

MVP 候选固定使用同一个 `deepseek-v4-flash`，先生成理解卡或提问意图，再根据冻结结果生成用户表达。thinking 继续关闭。该拆分把问停权留在理解阶段，让用户文案只负责准确、自然地表达已经完成的访谈判断。

第二段发生结构错误或明确返回无法表达时，只重试第二段一次。再次失败后保存语义 checkpoint 和用户原话，并显示现有“继续生成”入口。已经保存 v3 语义产物的恢复只重跑第二段；旧版 v1 / v2 产物会被忽略，系统使用可靠保存的用户原话重新生成第一段并替换为 v3。checkpoint 容器继续使用现有版本，无需数据库迁移。

固定参数、Production 入口、公开 API、数据库和界面继续保持现状。三次调用、一次/两次 A/B、运行时 MCP、Skill、外部工具与长期记忆检索继续退出当前验证范围。

### 0.8 评测重建与完成门

失败重置数据集从 `2026-07-29.v2` 开始；v64 质量卡版本为 `2026-07-30.v4`，开发数据集为 `2026-07-30.v3`。4 个角度 × 2 个模式的质量校准卡及开发反事实案例统一版本化在 [`generative-quality-calibration.ts`](../../../src/features/interview/event-centered/generative-quality-calibration.ts)。每张校准卡包含合格 `thinkingSummary`、合格回应、认识增量、推断边界和失败示例。

质量校准卡用于人工评审标尺和 Few-shot 候选制作，不作为运行时固定答案。当前 8 条反事实案例已经多次参与开发调优，自 `B7-QH-01` 第三轮起降级为开发集；故事文本仍不得进入 Prompt、Few-shot 或候选版本的运行上下文。产品策略冻结后另建全新隐藏集，正式架构评测只运行一次。

单轮、轨迹与盲评共用唯一真实用户可见回放出口。第一层只展示用户实际看到的 `thinkingSummary`、正式回应、持续轻提示、角度入口与当前操作；成果、证据和动作进入第二层，停止展示重复成果和大检查点卡片。技术完整率和产品通过率分开报告。

Provider v3 首批运行前冻结的完成门为：

1. 先运行六个全新场景各一次，覆盖成果完成、继续提问、并存边界、AI 安全综合、纠正和诚实收束；
2. 第一段语义和用户可见回应均达到 `6/6`、严重事实、用户边界、强推断与问停错误均为 `0` 后，冻结同一版本复跑六例，累计两层各 `12/12`；
3. 首批未通过时只允许围绕一个共同原因修改 Prompt、示例或协议规则中的一项；首批出现多个彼此独立的失败原因，或第二次完整运行仍未全部通过时，停止模型运行并重新打开对应产品规则；
4. 通过后建立全新隐藏集，并继续完成原正式质量门；
5. 同一候选版本的工作单轮 24/24 与工作轨迹 4/4 经用户逐条通过；
6. 硬边界 24/24、准入单轮 24/24、准入轨迹 4/4 与 8 组新旧盲评完成；
7. 无技术重试后仍失败的结果，延迟与成本门槛通过；
8. 相关自动测试、事件中心专项、类型检查、旧链路回归和差异检查通过；
9. 板块 4、6 复核完成。

Provider v3 首批已经在第 3 项触发多原因停止；以上门槛继续作为历史执行口径。两条产品规则重新冻结后，新最小确认包、运行次数与通过门需要单独确认。在后续正式门全部完成前，板块 7 保持“产品定义已冻结、落地验证阻断”，板块 8 保持阻断，Production 继续运行 `legacy + baseline`。

### 0.9 B7-QH-01 执行审计与停止条件

`B7-QH-01` 只验证一个质量假设：当用户已经给出事实和表面关系时，成果需要说明两侧各自在衡量或回应什么，纯粹重复 A 与 B 不构成认识增量。该假设共使用三轮预算；第三轮结果如下：

| 架构 | 技术完整 | Codex 通过 | 边缘 | 失败 | 相对初评胜出 |
|---|---:|---:|---:|---:|---:|
| 一次调用 | 4/4 | 1 | 1 | 2 | 4/4 |
| 两次调用 | 4/4 | 0 | 0 | 4 | 0/4 |

技术结构已经稳定，质量仍未达到 `8/8`。一次调用继续作为 MVP 对照，两次调用保留为候选；两者均不冻结。主要失败来自：

1. 系统把用户已经明确说出的规则换一种说法后直接作为成果。
2. 思路层已经形成有效关系理解，正式回应仍写成待确认问句。
3. 系统选择 `complete` 后，检查点把这条问句重复显示为已完成认识。

评测系统同步完成两项分层：

- 硬检查只阻断结构、单一问题、事实可追溯、用户控制、安全、阶段动作和三问上限等客观问题；自然度、认识增量、目标价值和表达语义保真进入质量诊断。
- 每个 A/B 结果分别保存 Codex 绝对初评、Codex 相对初评、产品负责人最终绝对裁决和产品负责人相对裁决；前一层不能写入后一层字段。

本假设已达到三轮停止条件。当时模型运行暂停，并把用户主动理解、AI 直接综合及 `ask / complete / honest_limit` 边界交回产品讨论；这些问题的最新结论见 `0.10`。

证据：

- [第 3 轮 Codex 初评](../../../artifacts/generative-interview-board7/2026-07-29/architecture-ab-v3-qh01-r3-codex-review.md)
- [第 3 轮结构化初评](../../../artifacts/generative-interview-board7/2026-07-29/architecture-ab-v3-qh01-r3-codex-review.json)
- [第 3 轮真实运行报告](../../../artifacts/generative-interview-board7/2026-07-29/architecture-ab-v3-qh01-r3-report.md)

### 0.10 当前保留的实现资产

本节记录失败重置后继续保留并已纳入 v62 的实现资产。当前架构与产品边界以 `0.18` 为准：

- 策略版本 `5.44.0`、角度卡 `2.11.0`、Few-shot 资产 `quality-patterns.2026-07-30.v23`、质量卡 `2026-07-30.v2`、Prompt `v62`；
- `thinkingSummary` 按动作变为可空，停止轮的 `naturalUnderstanding` 保存空字符串，焦点摘要使用正式回应；
- `outcomeAssessment.origin`、AI 两证据门、用户主动理解证据门、停止轮单段展示和历史 `test_understanding` 兼容；
- 第一、第二检查点轻量提示、四角度入口、直接输入深聊和隐藏 `continue_exploration` 按钮；
- 纠正目标回复、成果替换、成果重开与事实保留；
- 单轮、轨迹和盲评的统一真实回放；
- 客观硬检查与质量诊断继续分层，`visible_response_must_preserve_response_core` 只进入质量诊断。
- 8 张质量卡中的真实 `ask / ready / hard-fail` 示例已经进入一次调用运行时；当前角度与模式每轮只注入 3 个对应示例；
- Provider 必填输出已经移除 `realizationContract` 和 `microgoalDelta`，由系统兼容层补齐；新运行时不再提供 `test_understanding`。

本地联合测试 `177/177`、TypeScript 类型检查、定向 lint 和差异格式检查通过；静态硬边界为 `24/24`。

### 0.11 MVP 四角度冒烟与停止结论

一次调用四角度冒烟覆盖感受/引导复盘、想法/深度聊天、关系/引导复盘、行动/深度聊天。第一轮技术完整 `2/4`，两条失败来自系统兼容层写入超过上限的证据引用。第二轮只修正证据引用上限，Prompt、Few-shot、角度卡、模型和参数保持不变。

第二轮结果：

| 指标 | 结果 |
|---|---:|
| 技术完整 | `4/4` |
| Codex 初评通过 | `3/4` |
| 严重事实、边界或过强推断错误 | `0` |

感受、关系和行动结果形成了有证据的连接、边界或行动张力。想法结果把用户已经明确说出的“坏结果不等于坏决定”再次表述，未增加判断标准、证据关系或内部矛盾，因此按“认识增量不足”判失败。

四角度冒烟要求 `4/4`，两轮后实际为 `3/4`，已经触发停止条件。开发稳定性 `16` 条、全新隐藏集、工作集和正式准入继续暂停。下一步重新校准“用户已有理解的有效整理”和“AI 带来的新认识”的分界，形成新的产品规格和执行清单后再恢复开发与评测。

证据：

- [第二轮 Codex 初评](../../../artifacts/generative-interview-board7/2026-07-29/mvp-quality-repair-v1-smoke-r2-codex-review.md)
- [第二轮真实用户可见评审包](../../../artifacts/generative-interview-board7/2026-07-29/mvp-quality-repair-v1-smoke-r2-review.md)
- [第二轮结构化结果](../../../artifacts/generative-interview-board7/2026-07-29/mvp-quality-repair-v1-smoke-r2.json)

### 0.12 产品定义冻结与 v62 实施状态

三项核心分流规则已经全部确认；对 `honest_limit`、纠正恢复、思路展示、多线索选择和微目标边界的剩余审计未产生新产品决策。板块 7 产品定义自 `2026-07-30` 起冻结，v62 实施版本固定为：

- Prompt：`2026-07-30.event-centered-generative-v62`；
- 策略：`5.44.0`；
- 角度卡：`2.11.0`；
- Few-shot：`quality-patterns.2026-07-30.v23`；
- 质量卡与开发数据集：`2026-07-30.v2`。

联合测试 `177/177`、静态硬边界 `24/24`、TypeScript 类型检查、定向 lint 和差异格式检查均通过。严格冒烟案例确认包版本为 `2026-07-30.v2`，案例指纹为 `1fbf5707f4c829ee4a94131f03e1748b5acd2252b096dff00bc295dd099ad5ae`，并已获产品负责人批准：[严格冒烟案例确认包 v2](../../../artifacts/generative-interview-board7/2026-07-30/board7-smoke-case-confirmation-v2.md)。

v62 已完成唯一一次 Strict12 真实模型运行：技术完整 `11/12`；Codex 初评通过 `3/12`、边缘 `1/12`、失败 `8/12`，边缘按失败后有效通过 `3/12`，其中 ask `1/4`、用户成果 `2/4`、AI 综合 `0/4`。通过项为 `SMK-R-PARTIAL-ASK / SMK-T-USER / SMK-A-CLOSED`。`SMK-T-ASK` 出现来源误标，`SMK-A-PARTIAL-ASK` 出现表达结构硬失败，`SMK-F-CLOSED / SMK-R-CLOSED` 与四条 AI 综合案例出现过度追问；严重事实错误 `1`、强推断 `1`、来源误判 `1`。

证据保留在 [结构化运行结果](../../../artifacts/generative-interview-board7/2026-07-30/board7-v62-final-smoke-runs.json)、[运行报告](../../../artifacts/generative-interview-board7/2026-07-30/board7-v62-final-smoke-report.md)、[Codex 初评](../../../artifacts/generative-interview-board7/2026-07-30/board7-v62-final-smoke-codex-review.json)与[用户裁决包](../../../artifacts/generative-interview-board7/2026-07-30/board7-v62-final-smoke-user-review.md)。本轮定位到目标完成标准未完整进入运行时状态的输入契约断点；产品定义保持冻结，落地验证失败。下一步只形成离线修复清单，并判断目标完成表达是否需要用户确认；新的模型运行、开发稳定性、隐藏集、工作集、正式准入、一次/两次调用 A/B 和 Prompt 调优全部暂停。

### 0.13 v63 离线输入契约修复

v62 的真实模型失败证据继续保留。v63 已完成针对运行时输入断点的离线修复，当前版本固定为：

- Prompt：`2026-07-30.event-centered-generative-v63`；
- 策略：`5.45.0`；
- 角度卡：`2.11.0`；
- Few-shot：`quality-patterns.2026-07-30.v24`；
- 质量卡：`2026-07-30.v3`；
- 开发数据集：`2026-07-30.v2`。

本轮实现内容：

1. 事件状态顶层新增可选 `currentQuestionIntent`，内部保存 `targetId / semanticGoal / minimumAnswerScope`；`currentQuestion.target` 继续保存稳定 ID。旧快照缺省为空，目标错配时忽略；同目标换问法保留，完成、暂停、诚实收束、拒绝、纠正和切换时按生命周期清空。
2. one/two 语义输入统一注入 `currentQuestionIntent + userSemanticSignals`。两次调用仅完成输入兼容，不恢复 A/B；MVP 继续执行 `GI-009` 的一次调用选择。
3. `32` 个 Few-shot 补齐 `question / target / semanticGoal / minimumAnswerScope / coveredContent`，使当前问题、目标完成标准和用户已覆盖内容同时进入模型上下文。
4. `SMK-A-PARTIAL-ASK` 恢复“部分回答仍保持目标开放”的边界；严格冒烟案例据此生成 v3 确认包。

状态扩展写入现有 JSON，无需数据库迁移；界面、Provider 输出协议、Production 入口、模型、配置和数据保持原状。相关 `9` 个测试文件 `202/202`、Strict12 模拟请求 `12/12`、静态硬边界 `24/24`、TypeScript 类型检查、定向 lint 与差异格式检查均通过。

[严格冒烟案例确认包 v3](../../../artifacts/generative-interview-board7/2026-07-30/board7-smoke-case-confirmation-v3.md) 指纹为 `3d82475acb485e102dc6c8ac277b73d9a9fe379fd6a8eede6c119b0a82a784d7`。案例内容与指纹变化后，旧 v2 批准失效；随后 v3 获得本轮运行授权，真实基线结果见 `0.14`。

### 0.14 v63 真实基线与停止结论

v63 仅执行了这一轮真实模型基线：架构 `one_call`、模型 `deepseek-v4-flash`、严格冒烟 `12` 条各运行一次。运行前完成两项离线正确性修复：

1. 将模型可见事实编号改为中性序号，避免案例编号和类别标记泄露预期分流答案。
2. 当前问题文本只在稳定目标与当前意图目标一致时进入模型输入；目标错配时安全置空。

技术完整为 `12/12`。严格 Codex 初评为通过 `1`、边缘 `2`、失败 `9`；边缘按失败计算后严格有效 `1/12`。分项为 ask `0/4`、用户成果 `1/4`、AI 综合 `0/4`；严重错误 `2` 条。`SMK-T-AI` 出现一次成果来源误判。

本轮已触发停止条件。Codex 严格初评未达到 `12/12`，当前不进入用户逐条裁决。新的模型运行、Prompt 调优和一次/两次调用 A/B 暂停；开发稳定性、全新隐藏集、工作集、正式准入和板块 8 继续阻断。Production 入口、模型、配置和数据保持原状。

证据：[严格冒烟确认包 v3](../../../artifacts/generative-interview-board7/2026-07-30/board7-smoke-case-confirmation-v3.md)、[v63 结构化运行结果](../../../artifacts/generative-interview-board7/2026-07-30/board7-v63-baseline-smoke-runs.json)、[运行报告](../../../artifacts/generative-interview-board7/2026-07-30/board7-v63-baseline-smoke-report.md)、[前 8 条 Codex 初评](../../../artifacts/generative-interview-board7/2026-07-30/board7-v63-baseline-first8-codex-review.md)、[后 4 条 AI 综合 Codex 初评](../../../artifacts/generative-interview-board7/2026-07-30/board7-v63-baseline-smoke-ai-synthesis-codex-review.md)、[统一 Codex 初评](../../../artifacts/generative-interview-board7/2026-07-30/board7-v63-baseline-smoke-codex-report.md)。

### 0.15 v64 产品规则与 Strict12 v4

v63 原始运行与正式 `1/12` 报告继续保留。按 v64 新确认的用户成果边界回看，`SMK-F-CLOSED / SMK-T-USER / SMK-A-CLOSED` 可通过，结果为 `3/12`；该回看只解释产品判尺变化，不覆盖历史初评。

Strict12 v4 固定为：ask 使用 `SMK-F-PARTIAL-ASK / SMK-T-ASK / SMK-R-CLEAN-ASK / SMK-A-PARTIAL-ASK`；用户成果使用 `SMK-F-CLOSED / SMK-T-USER / SMK-R-PARTIAL-ASK / SMK-A-CLOSED`；AI 综合继续覆盖四角度。`SMK-R-CLOSED` 替换同为关系角度、引导模式、用户成果的 `AB-RG-01`，进入常规 stability 开发回归；稳定性集合继续保持 `8` 个案例 × `2` 次与 `ask 4 / user_articulated 6 / ai_synthesized 6`。F、R、A 三个 AI 综合故事改为只提供分散事实，避免用户原话提前给出目标关系。F/A 的安全换入口只写入确认包第二层，不进入模型输入。

v64 首版确认资产采用策略 `5.46.0`、角度卡 `2.12.0`、Few-shot `quality-patterns.2026-07-30.v25`、Prompt `2026-07-30.event-centered-generative-v64`、质量卡 `2026-07-30.v4`、开发数据集 `2026-07-30.v3`、确认包 `2026-07-30.v4`。[Strict12 v4 案例确认包](../../../artifacts/generative-interview-board7/2026-07-30/board7-smoke-case-confirmation-v4.md) 的案例指纹为 `dc0089c7747d23eff35c139f40e1c96fa28d20a29121f253890f54725c7de846`。产品终审发现案例有效性问题后，v4 已退出当前批准候选，原文件和指纹继续作为作废审计证据。

本轮只完成案例资产、确认包与离线测试。产品定义重新冻结，落地验证继续阻断；真实模型运行需要新的单独授权。Production 入口、模型、配置和数据保持原状。

### 0.16 Strict12 v5 案例最小修复

此次实现只调整 [`generative-quality-calibration.ts`](../../../src/features/interview/event-centered/generative-quality-calibration.ts) 中三条案例及其直接测试，Prompt、策略、角度卡、Few-shot、Provider 协议、界面和数据库均保持现状：

1. `SMK-A-PARTIAL-ASK` 使用申请文档空白场景。用户反复查看申请要求且说不清原因时，严格补问固定落到最后反复看的哪一句要求，避免原列提纲故事同时支持 AI 直接综合行为作用。
2. `SMK-R-PARTIAL-ASK` 把“两件事都被越过、无法排序”写进用户原话，可信事实只保存用户已经明确表达的边界。
3. `SMK-R-AI` 的可信事实删除“未经确认”，仅保存当前自然对话能够逐句追溯的三项结果。

当前确认包升级为 `2026-07-30.v5`：[Strict12 v5 案例确认包](../../../artifacts/generative-interview-board7/2026-07-30/board7-smoke-case-confirmation-v5.md)，案例指纹 `79885a71f4eb8c3a355d933f2776422219464423e910df9fa29ef56f5a0cb24f`，批准状态 `pending`。v4 md/json 的文件哈希保持不变。相关 `4` 个直接测试文件 `38/38` 通过；本轮未调用真实模型。

运行护栏同步收口：CLI 当前只开放 `rules / case-confirmation / development`；其余模型模式与两次调用保持暂停。`development` 按“目录预检 → Provider 校验 → 预算预留 → 调用”推进；实际输出与人工裁决使用同一 `runFingerprint`，旧结果无法进入 v64 门。定向失败返回 `1`，定向全部通过但尚未完成 Strict12 全量门时返回 `2`。最终离线验证达到测试文件 `243/243`、用例 `2228/2228`、旧链路 `580/580`，类型检查和差异检查通过；真实模型调用 `0` 次，预算账本文件不存在。Production 入口、模型、配置和数据保持原状，板块 7 继续验证阻断，板块 8 继续等待。

### 0.17 v64 R2、v65 单变量失败与 GI-009 重开

v64 R1 因 DNS 预检缺口导致 `12/12` 均无可见结果，已经审计为基础设施作废轮。R2 技术完整 `10/12`；产品负责人明确委托 Codex 完成初评与最终裁决，严格有效 `1/12`，其中 ask `1/4`、用户成果 `0/4`、AI 综合 `0/4`。

R2 的共同失败集中在证据充分后仍继续提问。v65 仅调整 Prompt 中成果动作的优先级，模型、策略、角度卡、Few-shot、案例和参数保持一致。定向运行 `SMK-R-PARTIAL-ASK / SMK-F-AI` 技术 `2/2`、质量 `0/2`：前者再次确认用户已经明确的整体边界，后者再次要求描述已经完整提供的身体变化。

Prompt 单变量假设已经判定无效并触发停止条件。剩余 `2` 条定向额度和 `2` 次全量额度停止消耗；模型运行、Prompt 调优、开发稳定性、隐藏集、工作集与准入暂停。`GI-009` 重新打开，下一步只复核语义理解与动作决策、用户可见表达的任务拆分，以及两次调用的状态传递、表达约束、失败恢复、延迟和成本。轻量检查点、成果来源、纠正链路、硬检查、可靠提交、状态与 Trace 继续保留。

证据：[R1 作废审计](../../../artifacts/generative-interview-board7/2026-07-30/board7-v64-strict12-v5-baseline-r1-audited-report.md)、[R2 委托终审报告](../../../artifacts/generative-interview-board7/2026-07-30/board7-v64-strict12-v5-baseline-r2-reviewed-report.md)、[v65 定向终审报告](../../../artifacts/generative-interview-board7/2026-07-30/board7-v65-targeted-r1-reviewed-report.md)。

### 0.18 极简两段式理解小卡实施状态

`2026-08-01` 已完成 `GI-009` 的架构复核并实现待验证候选。历史一次组合调用继续保留为失败基线；当时候选把模型任务拆成“纯语义判断 → 用户表达”，第一段通过理解小卡冻结访谈判断，第二段首次生成用户文案。

本轮实现包含：

1. Provider 第一段只输出 `understanding + decision + meaningCard`；`meaningCard.main` 保存一个主意思，`necessaryScope` 最多保存两条会限制、修正或补全主意思的并存内容。
2. 系统从理解小卡生成现有完整回合需要的动作、证据、预期理解增量、试探解释、`realizationContract` 和 `microgoalDelta`。`responseCore` 只保留为系统兼容字段，第二段不读取它。
3. 第二段只接收小卡、被引用的用户原话、冻结后的元数据和必要的上一问；它不能改变问停动作、成果来源、主意思和必要范围。
4. 新语义产物版本为 `event-centered-semantic-plan.v2`；第一段 Prompt 为 `2026-08-01.event-centered-generative-v67-meaning-card`，第二段 Prompt 为 `2026-08-01.event-centered-generative-v67-visible`。
5. v2 checkpoint 恢复只重跑第二段；旧 v1 语义产物使用可靠保存的用户原话重新生成第一段，再以 v2 产物替换。现有 checkpoint 容器、数据库和公开接口保持兼容。
6. 第二段结构失败或明确无法表达时只重试第二段一次；再次失败后保留语义 checkpoint 和用户原话，继续使用现有“继续生成”入口。

离线验证覆盖用户成果、AI 综合、继续提问、主意思与必要范围、并存内容、回答状态与成果来源独立、纠正、兼容字段、两段输入边界、第二段重试及旧产物升级。当前生成式单元套件 `224/224`、相关联合回归 `703/703`、类型检查和差异检查通过。以上结果只证明实现与客观契约成立；真实模型的理解质量、问停质量和用户表达仍等待下一轮 `8` 个结果验证。

当前状态因此更新为“产品规则已确认、实现完成待真实模型验证”。板块 7 与板块 8 继续阻断；Production 入口、配置、模型和数据保持原状。

### 0.19 首轮真实验证、根因分层与停止

`2026-08-01` 已使用固定候选完成四个全新场景 × 2。运行期间未修改 Prompt、Few-shot、策略卡或协议规则。Codex 按产品负责人授权分别裁决理解小卡和用户可见回应：

| 指标 | 结果 | 门槛 |
|---|---:|---:|
| 技术完整 | `5/8` | `8/8` |
| 理解小卡 | `5/8` | `8/8` |
| 用户可见回应 | `5/8` | `8/8` |
| 严重错误 | `1` | `0` |
| 完整回合耗时中位数 | `4730ms` | 后续与基线比较 |
| 单回合成本中位数 | 约 `$0.000435` | 后续与基线比较 |

首轮证明两段职责已经能够把问题定位到具体层级：

1. 感受用户成果两次均通过，说明“第一段冻结成果、第二段自然表达”在明确成果场景中可以成立。
2. 关系场景两次都未把主要边界与需要保留的帮助价值分到 `main / necessaryScope`；一次把“希望”加强为“必须”。当前协议划分对模型仍不稳定，也需要重新判断这项划分对用户结果是否必需。
3. 行动 AI 综合一次通过、一次成果来源误判。事实连接形成“本次实际作用”时，`user_articulated / ai_synthesized` 的边界仍不稳定。
4. 想法场景两次都识别出正确缺口，表达阶段仍生成抽象原因追问或候选答案引导。`missingUnderstanding` 还缺少可直接转成低负担问题的表达标准。
5. 第二段两次返回了语义上可读的“思路＋问题”，因省略无关空字段触发 `INVALID_SCHEMA`。这项执行缺陷已改为由系统补空，相关自动测试 `139/139` 通过；本轮原始运行和历史裁决不回写。

失败同时覆盖必要范围、成果来源和问题入口，满足 `GI-045` 的“多个无关原因”停止条件。本轮不使用第二次完整运行额度，不进行 Prompt 单变量调优。下一步只复核三项产品规则，优先判断理解小卡能否减少字段和判断负担；规则确认前隐藏集、工作集、准入与板块 8 继续阻断。

证据：[原始结果](../../../artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-runs.json)、[Codex 裁决](../../../artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-codex-review.json)、[评审后结果](../../../artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-reviewed-runs.json)、[评审后报告](../../../artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-reviewed-report.md)、[真实回放评审包](../../../artifacts/generative-interview-board7/2026-08-01/meaning-card-candidate-reviewed-review.md)。

### 0.20 Provider v3 首批实现与兼容状态（5.47.0 历史候选）

`2026-08-01` 已按[极简两段式 v3 实施交接](./04m-board7-minimal-two-stage-v3-execution-handoff.md)完成运行时改造。v2 历史代码与评测证据继续保留；新候选通过一个兼容入口接入现有状态、恢复和 Trace，未进行全局旧字段删除。

第一段 Provider v3 只输出：

```text
understanding
decision.state：needs_more / ready / limited
understandingCard：statement + evidenceRefs，允许 limited 时为空
questionIntent：goal + answerEntry + evidenceRefs，只用于 needs_more
limitReason：只用于 limited
```

`origin / insightKind / basis / necessaryScope / missingUnderstanding / selectedTargetId / cognitiveAction / responseCore` 均退出 Provider 必填输出。成果来源和认识类型只作为系统兼容或评测辅助标签，不能阻断有效回合。非空理解卡至少引用一条可追溯证据；模型新增关系时，证据需要覆盖关系两侧。`limited` 可以不提供理解卡，但必须说明收束原因。

系统层根据 v3 结果生成现有 `semanticPlan`、稳定目标、`microgoalDelta`、兼容字段和 Trace。第二段只接收冻结动作与角度、理解卡、提问意图或收束原因、引用证据及必要的上一问；它不读取成果来源、认识类型、目标编号和完整历史，也不能重新判断问停与角度。第一段和第二段各自最多执行一次技术重试；结构有效但产品质量较差的输出保留为正式失败。

首批冻结版本为：

- 语义计划产物：`event-centered-semantic-plan.v3`；
- 第一段 Prompt：`2026-08-01.event-centered-generative-v68-understanding-card`；
- 第二段 Prompt：`2026-08-01.event-centered-generative-v68-visible`；
- 策略：`5.47.0`；
- 角度卡：`2.12.0`；
- Few-shot：`quality-patterns.2026-08-01.v26`。

v3 checkpoint 恢复只重跑第二段；v1 / v2 checkpoint 使用已经可靠保存的用户原话重新生成第一段，并在输入指纹一致时替换为 v3。相关 `9` 个定向测试文件 `209/209` 通过；最终事件中心联合回归为 `37` 个测试文件、`722/722`，TypeScript 类型检查和差异格式检查通过。Production、数据库、公开 API、界面、可靠提交、纠正、换问法、轻量检查点和生产数据均保持现状。

### 0.21 Provider v3 首批六例与停止结论

同一冻结版本已完成六个全新场景各一次，覆盖感受成果、想法提问、关系并存边界、行动 AI 综合、纠正和诚实收束。Codex 按两层判尺完成裁决：

| 指标 | 结果 | 首批门槛 |
|---|---:|---:|
| 技术完整 | `6/6` | `6/6` |
| 第一段结构完整 | `6/6` | `6/6` |
| 第一段语义通过 | `5/6` | `6/6` |
| 用户可见回应通过 | `4/6` | `6/6` |
| 语义状态偏差 | `0` | `0` |
| 系统动作偏差 | `0` | `0` |
| 严重错误 | `0` | `0` |

五个案例的第一段语义通过，四个案例的用户回应通过；感受成果、行动综合、纠正和诚实收束均完整通过。失败归并为两个彼此独立的产品原因：

1. **提问入口仍停留在抽象缺口。** `V3-T-ASK-01` 正确判断需要继续问，也正确识别“用户想确认什么”的缺口；`answerEntry` 仍要求用户直接回答“心里最想确认哪一点”，未落到“看到某一页样张时会检查什么”的具体回忆入口。该问题同时导致第一段语义和最终问题失败，对应 `answer_entry_burden / question_value`。
2. **停止回应的人称视角不稳定。** `V3-R-READY-01` 的理解卡完整保留浇水帮助与更换标签需要共同决定的边界；第二段把面向用户的“你”改写为“我”，形成 AI 冒用用户口吻的体验，对应 `expression_naturalness`。

两类失败分别位于提问准入的作答入口和停止回应的表达视角，无法用一次共同根因的单变量修正同时解释。依据 `GI-045` 停止条件，本轮立即停止新的模型运行、Prompt 调优和同版本冻结复跑；累计 `12/12` 门、隐藏集、工作集、准入和板块 8 继续阻断。首批结束时，下一步进入“低负担作答入口”与停止回应人称规则复核；后续确认见 `0.22`。两段式职责切分、v3 兼容层、客观硬检查和严重错误为零的证据继续保留。

证据：[案例确认包](../../../artifacts/generative-interview-board7/2026-08-01/minimal-two-stage-v3-case-confirmation.md)、[原始运行](../../../artifacts/generative-interview-board7/2026-08-01/minimal-two-stage-v3-batch-1.json)、[Codex 裁决](../../../artifacts/generative-interview-board7/2026-08-01/minimal-two-stage-v3-batch-1-codex-review.json)、[评审后结果](../../../artifacts/generative-interview-board7/2026-08-01/minimal-two-stage-v3-batch-1-reviewed.json)、[评审后报告](../../../artifacts/generative-interview-board7/2026-08-01/minimal-two-stage-v3-batch-1-reviewed-report.md)、[真实回放评审包](../../../artifacts/generative-interview-board7/2026-08-01/minimal-two-stage-v3-batch-1-reviewed-human-review.md)。

### 0.22 两条产品规则重新冻结与 5.48.0 离线候选

`2026-08-01`，产品负责人确认：

1. `questionIntent.goal` 可以保留抽象认识缺口；`answerEntry` 必须下降一层，落到当前事件里可回忆、观察或模拟的动作、画面、原话、比较或判断瞬间。用户应能用一个小片段直接回答。第一段无法形成这种入口时停止提问，并按已有理解进入 `ready`，或按材料边界进入 `limited`。
2. 第二段生成的 AI 对话回应使用第二人称或中性表达；第一人称仅用于明确引用的用户原话。日志第一人称正文继续由独立日志生成环节承担。

离线候选血缘升级为：

- 策略：`5.48.0`；
- 第一段 Prompt：`2026-08-01.event-centered-generative-v69-understanding-card`；
- 第二段 Prompt：`2026-08-01.event-centered-generative-v69-visible`；
- Few-shot：`quality-patterns.2026-08-01.v27`；
- 角度卡：`2.12.0`；
- 语义计划产物：继续使用 `event-centered-semantic-plan.v3`。

本节记录产品规则冻结与 v69/v69 离线实施时点。v3 首批历史结果继续保留原失败裁决，`GI-045` 停止门继续生效；随后修复探针、一次性恢复和 v70/v70 当时候选见 `0.23`。板块 7 落地验证、隐藏集、工作集、正式准入和板块 8 继续阻断。Production 保持 `legacy + baseline`。

### 0.23 Provider v3.1 修复探针、恢复失败与 v70/v70 离线修正

`2026-08-01`，两例修复探针按冻结确认包各运行一次：

| 案例 | 版本 | 技术完整 | 产品裁决 |
|---|---|---:|---|
| `V31-RP-T-ENTRY-01-R1`｜想法具体入口 | semantic v69 + visible v69 | 是 | 第一段语义 `pass`；用户可见回应 `pass`；严重错误 `0` |
| `V31-RP-R-VOICE-01-R1`｜关系对话人称 | semantic v69 + visible v69 | 否 | 首次 `TIMEOUT + INVALID_SCHEMA`；保持待评 |

想法案例的第一段把 `goal` 保留为“补清停止比较时依据的具体画面”，并把 `answerEntry` 下沉为“放大后，你目光先停在哪一处？”。第二段使用第二人称提出同一问题。该结果说明 `GI-039` 与 `GI-041` 的规则在这个想法场景中被正确执行。

关系案例获得一次预算内技术恢复，第一段升级为 v70、第二段继续使用 v69。第一段一次成功并形成正确的 `ready / pause`：朋友先等用户讲完，只补充漏掉的发作时间，让用户感到慌乱被接住，同时保留说明情况的主导权。第二段连续两次返回第二人称、语义自然的停止回应；两次都使用 `{"status":"ok","visibleTurn":{...}}` 嵌套包装，而运行时根级结构契约要求直接返回 `thinkingSummary / question / insight / honestLimit`，因此均触发 `INVALID_SCHEMA / root:unrecognized_keys`。系统层合法 `visibleTurn` 与用户可见回应保持为空，关系人称规则继续待正式产品裁决。

合并保留想法案例与关系恢复结果后，技术完整为 `1/2`，当前门为 `fail / stop`。关系案例未形成合法用户可见结果，修复探针整体保持失败；预算已经审计停止。`GI-039 / GI-041` 产品规则继续冻结，`GI-045`、板块 7 落地验证、隐藏集、工作集、正式准入和板块 8 继续阻断。

根因已定位为第二段 Few-shot 包装层与根级 contract 冲突。离线修正将当时候选升级为：

- 策略：`5.48.0`；
- 第一段 Prompt：`2026-08-01.event-centered-generative-v70-understanding-card`；
- 第二段 Prompt：`2026-08-01.event-centered-generative-v70-visible`；
- Few-shot：`quality-patterns.2026-08-01.v27`；
- 角度卡：`2.12.0`；
- 语义计划产物：`event-centered-semantic-plan.v3`。

第二段 v70 已统一示例与根级输出契约。源头修复定向验证 `132/132`、最终事件中心 `38` 个测试文件 `734/734` 与 TypeScript 类型检查通过；该结果只证明离线结构修正成立，v70/v70 尚未进行真实模型验证。如需再次运行，先重新确认最小范围、预算与单独授权。

证据：[run-1 原始结果](../../../artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-run-1.json)、[run-1 报告](../../../artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-run-1-report.md)、[恢复评审后结果](../../../artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-reviewed.json)、[恢复评审后报告](../../../artifacts/generative-interview-board7/2026-08-01/provider-v31-repair-probe-recovery-1-reviewed-report.md)、[预算审计](../../../artifacts/generative-interview-board7/2026-08-01/board7-provider-v31-repair-probe-budget.json)。

### 0.24 v70/v70 root-visible probe 终局执行

`2026-08-01`，产品负责人批准唯一一批 v70/v70 root-visible 最小验证。数据集为 `2026-08-01.board7-provider-v70-root-visible-probe-v1`，案例指纹为 `59e5d4e55b1bc16e163dcb5ae8a2c74518c73df9cf372a8a77ca0fb597dd9414`，批准卡指纹为 `e4e4c7bbdab7d4c88a5257d92b1008487ffbb13efb4295177f3d03a0e2e7c94f`。冻结血缘为策略 `5.48.0`、第一段 Prompt `2026-08-01.event-centered-generative-v70-understanding-card`、第二段 Prompt `2026-08-01.event-centered-generative-v70-visible`、Few-shot `quality-patterns.2026-08-01.v27`、角度卡 `2.12.0` 与语义产物 `event-centered-semantic-plan.v3`；模型继续使用 `deepseek-v4-flash`，thinking 关闭。

本批包含 `2` 个全新案例，各运行 `1` 次。预算预留前完成 `1` 次只读 `GET /models` 预检，生成阶段完成 `4` 次请求。技术完整 `2/2`、语义状态匹配 `2/2`、系统动作匹配 `2/2`、严重错误 `0`；Codex 双层裁决如下：

| 案例 | 第一段语义 | root visible 回应 | 主要原因 |
|---|---|---|---|
| `V70-RV-T-ASK-01-R1` | `fail` | `fail` | `answer_entry_burden / question_value`：入口仍要求用户说明“心里先冒出来的感觉”，没有落到具体声音瞬间和点击动作 |
| `V70-RV-A-BOUNDARY-01-R1` | `borderline` | `borderline` | `understanding_incomplete`：位置变化仅通过“伸手可拿”隐含表达，按确认包计失败 |

因此第一段语义与 root visible 回应均为 `0/2`，gate=`fail / stop`。两例累计耗时 `9,640ms`、累计 `8,674` tokens、估算成本 `0.0012035688`；想法案例为 `4,681ms / 0.00065842`，行动边界案例为 `4,959ms / 0.0005451488`。预算账本的一批上限已经耗尽，终局评审包指纹为 `eb347dd807f3d4d452f0c46454e270f4933c20cd8355fbef7946107b2ba70ac0`。

本轮保留两段职责和现有决策结构，只新增落地验证证据。v69、v63 和更早结果继续保存原裁决；隐藏集、工作集、板块 8 与新的模型调用继续阻断。Production 保持 `legacy + baseline`，入口、模型、配置和生产数据维持原状。

证据：[终局运行报告](../../../artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1-report.md)、[终局结构化结果](../../../artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1.json)、[Codex 终局评审包](../../../artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1-human-review.md)、[独立预算账本](../../../artifacts/generative-interview-board7/2026-08-01/board7-provider-v70-root-visible-probe-budget.json)。

### 0.25 GI-047 与 Provider v4 语义骨架候选

v70/v70 的两例状态与动作正确，第一段自然句仍分别固化了抽象作答入口和缺少行动侧的成果表达，第二段沿用后形成双层质量 `0/2`。`2026-08-01`，产品负责人据此确认 `GI-047`：第一段彻底退出自然句生成，只输出可核验语义骨架；第二段读取骨架与源证据，并首次生成完整问题或成果文案。

Provider v4 的最小根级输出为 `understanding / decision.state / semanticFrame / questionIntent / limitReason`，`understanding` 原样复用 `eventCenteredTwoStageUnderstandingSchema`。`semanticFrame.units` 使用 `1–3` 个无自然句单元，`2+` units 必须提供一条受控 relation；`questionIntent` 只保留内部 gap 与带 `kind / evidenceRefs / anchorQuote` 的可追溯 `answerSource`；`limitReason` 使用 `{kind, evidenceRefs}`。第一段完成后，系统立即从骨架与源证据确定性派生旧 `understandingCard / questionIntent / semanticPlan / Trace` 字段；兼容文本只供内部使用，第二段严禁读取兼容半成品。

候选血缘建议为策略 `5.49.0`、semantic v71、visible v71、Few-shot `quality-patterns.2026-08-01.v28`、角度卡 `2.12.0`、语义产物 `event-centered-semantic-plan.v4`。旧 v3 checkpoint 恢复时重跑第一段；本候选无需数据库、界面或对外 API 迁移。当前只冻结产品规则和实施规格，代码、离线验证与新确认包待完成，模型调用为 `0`。新的确认包与独立授权前，隐藏集、工作集和板块 8 继续阻断。

专项规格：[04n｜Provider v4 语义骨架 v1](./04n-board7-semantic-skeleton-v1-spec.md)。

### 0.26 Provider v4 离线实施结果

`2026-08-01`，`GI-047` 以高置信度完成规则冻结、Provider v4 实现与离线落地验证。最终离线候选固定为策略 `5.49.0`、semantic Prompt `2026-08-01.event-centered-generative-v71-semantic-skeleton`、visible Prompt `2026-08-01.event-centered-generative-v71-visible`、Few-shot `quality-patterns.2026-08-01.v28`、角度卡 `2.12.0` 与语义产物 `event-centered-semantic-plan.v4`。

本轮实现收口六项根因：第二段只接收 `semanticFrame / questionIntent / limitReason / sourceEvidence`，其中每条 `sourceEvidence` 仅含 `ref / sourceText`；缺少逐字 `quote` 的旧事实退出 v4 可引用集合；v1 / v2 / v3 checkpoint 恢复时统一重跑第一段升级到 v4；同一目标复用来源时同时要求 `decision.state` 与 `questionIntent.gap` 一致；兼容 `origin` 解除 `answerStatus` 绑定并仅作为旧 schema 标签；v64、v65 与 `GI-009` 历史血缘保持只读隔离，不参与 v4 派生、恢复或质量计数。

板块 4 的语义骨架投影复核、板块 6 的双层判尺与 runner 适配均已完成。六例确认矩阵为四角度 + 纠正 + 材料有限；[离线案例确认包](../../../artifacts/generative-interview-board7/2026-08-01/semantic-frame-v4-offline-case-confirmation.md) 指纹为 `ae2c1e801cd121a3372dec9bb8ae52d0897dc3b0d430c91d69b8ddf0c4203f62`。运行策略固定为 `modelRunAllowed=false`，本轮预算 `0`、模型调用 `0`。

离线验证结果为事件中心 unit `30` 个测试文件、`622` 个用例通过；生成式 eval `6` 个测试文件、`56` 个用例通过；TypeScript 类型检查通过；ESLint `0 error / 4 existing warnings`；差异格式检查通过。六例随后完成产品确认，当前等待首轮独立预算授权；真实模型、正式质量门、隐藏集、工作集和板块 8 继续阻断，Production 保持 `legacy + baseline`。

### 0.27 v71 首轮六例运行授权门

六例已于 `2026-08-01` 完成产品确认，数据集路径、案例指纹与 v71 最终候选保持冻结。首轮[运行授权卡](../../../artifacts/generative-interview-board7/2026-08-01/board7-provider-v71-semantic-frame-first-pass-approval.md)当前为 `pending`，模型调用 `0`。本轮采用 `two_call + deepseek-v4-flash`，固定 `temperature=0.2`、`max tokens=1500`、`timeout=12s`、`thinking=off`；名义生成请求 `12` 次、技术极限 `24` 次，最多 `1` 次 `/models` 只读预检单列。

[pending 预算账本](../../../artifacts/generative-interview-board7/2026-08-01/board7-provider-v71-semantic-frame-first-pass-budget.json)已经生成，scopeFingerprint 为 `960eae47ec6b0026e44fed960520fc92b3cc6c6faf22f4aceae778140c28ed98`；程序化护栏拒绝未授权运行，`v71 live` 入口保持关闭，模型调用 `0`。

有效但低质量的结果不重试，首轮六例结束即停。失败后先完成归因并重新审批，成功后也只允许建立下一轮独立预算。用户另行明确授权本卡前，板块 7、板块 8 与后续质量门继续阻断，Production 保持 `legacy + baseline`。

## 1. 历史候选 3.29.0｜原单次调用选择

当前产品处于内部 Preview 前的 MVP 阶段。每轮访谈真正需要交付的用户结果只有一个：准确承接当前表达，并在仍有价值时提出一个值得回答的问题。

一次结构化调用已经能够在同一份上下文里完成理解、方向选择、提问和自检，同时减少两次调用之间的信息损耗、延迟与成本。系统继续持有事实、阶段、用户操作、次数、安全和失败恢复等稳定能力。两次调用保留为质量证据证明组合任务互相干扰后的升级路径。

本轮沿用现有模型与 Provider，没有引入运行时 MCP、Skill、外部工具、长期记忆检索和新数据表。

## 2. 历史候选 3.29.0｜已实现链路

```text
可靠接收用户原话
→ 系统识别确定性操作、边界和当前活动分支
→ 单次结构化模型调用
   ├─ 理解上一问回答与事实增量
   ├─ 判断成果或微目标进展
   ├─ 选择一个认知动作和目标
   └─ 生成一句自然理解与一个问题，或给出停止动作
→ 系统执行硬检查
→ 更新事实、阶段、次数、微目标和成果
→ 运行现有可见文本质量门
→ 保存回复与结构化 Trace
```

同一逻辑调用最多进行两次技术尝试。第一次结果结构非法或违反硬约束时，第二次调用只补充失败代码并要求修正。第二次仍失败时：

- 普通内容轮保存原话和失败状态，用户可使用“继续生成”。
- 选择事件、选择角度和继续深入等可靠操作使用现有确定性问法完成承接。
- 明确停止、退出和纯换角度表达直接按系统规则执行。

## 3. 历史候选 3.29.0｜模型策略资产

### 3.1 共用决策顺序

模型 Prompt 已固化以下顺序：

```text
识别用户操作与边界
→ 判断上一问回答状态
→ 更新有效证据
→ 判断角度成果或微目标是否完成
→ 判断继续提问是否仍有新增价值
→ 形成可问方向并淘汰违规方向
→ 按用户控制、最新焦点、当前微目标、最低成果缺口排序
→ 选择一个认知动作
→ 生成一句理解和一个问题
```

模型只输出最终选择和可核查依据，不输出候选列表、数字评分或完整思考过程。

### 3.2 八类认知动作

正式动作固定为：

- `anchor_specific`
- `clarify_user_term`
- `differentiate`
- `connect_clues`
- `trace_change`
- `surface_tension`
- `test_understanding`
- `open_possibility`

`open_possibility` 只允许深入聊聊。`test_understanding` 要求至少两条证据，一次只验证一个可能理解，用户否认后关闭该目标。

### 3.3 四张角度卡与 16 个示例

四张卡均已版本化，包含最低成果、有效证据、引导与深入方向、新线索、排除方向、推断边界、完成和暂停条件。示例库固定为四角度 × 两模式 × 正例/边界例，共 16 个案例；每轮只注入当前角度和模式对应的两例。

策略资产位置：

- `src/features/interview/event-centered/generative-strategy.ts`

## 4. 历史候选 3.29.0｜单次调用协议与硬检查

结构化输出分为三段：

1. `understanding`：事件边界、回答状态、事实增量、纠正或边界、试探理解、事件选项。
2. `decision`：问、完成、暂停或诚实收束，认知动作、目标、证据、微目标变化、预期价值、停止原因和成果候选。
3. `reply`：一句自然理解，以及问答轮中的单一问题。

系统硬检查覆盖：

- 事实摘录必须来自本轮原话。
- 证据编号必须指向当前有效事实或本轮新增事实。
- 明确边界、纠正和双事件检测优先于模型选择。
- 已回答、已拒绝、已问过和刚刚答完的目标不可重复。
- 引导复盘和同一微目标均遵守三问上限。
- 深入模式每个问题必须说明微目标变化。
- 试探理解需要两条证据并在可见理解中保持可否认。
- 想法引导阶段保持用户当前立场。
- 关系角度不能把他人动机写成事实。
- 行动角度排除未来计划、下一次尝试和主动建议。
- 理解层不含问题，提问轮只含一个问题，停止轮不附加问题。

协议位置：

- `src/features/interview/event-centered/ai-contract.ts`
- `src/server/services/interview/event-centered-ai.service.ts`

## 5. 历史候选 3.29.0｜状态、编排、换问法与 Trace

现有 JSON 状态增加以下兼容字段：

- `strategyMode`
- `strategyVersion`
- `deniedTargets`
- `currentMicrogoal`
- 当前问题的 `cognitiveAction`

状态 schema 继续兼容版本 3，无需数据库迁移。现有五种换问法、活动分支、每组最多三个版本和不增加回答机会的规则继续复用；问题规格会一并保留认知动作与原目标。

每轮 Trace 继续写入现有 `AIGenerationTrace`，新增记录策略、角度卡、示例版本与示例编号、最近上下文、有效事实、最终动作、目标、证据、微目标变化、硬检查结果、技术尝试和用户最终可见内容。完整思考过程不保存。

编排位置：

- `src/features/interview/event-centered/generative-turn-policy.ts`
- `src/server/services/interview/event-centered-interview.service.ts`
- `src/features/interview/event-centered/dialogue-state.ts`
- `src/types/event-centered-dialogue.ts`

## 6. 保留能力｜发布隔离与回退

两层开关已经建立：

| 层级 | 变量 | 默认值 | 作用 |
|---|---|---|---|
| 事件中心入口 | `INTERVIEW_EVENT_CENTERED_MODE` | `legacy` | 决定是否进入事件中心 |
| 事件中心内部策略 | `INTERVIEW_EVENT_CENTERED_STRATEGY` | `baseline` | 在事件中心内选择现有策略或生成式单次调用 |

内部 Preview 进入板块 8 后使用 `event_centered + generative`。任何严重问题都可把内部策略恢复为 `baseline`；会话原话、事实和已保存成果仍然保留。Production 当前继续使用 `legacy + baseline`。

## 7. 历史候选 3.29.0｜原评测资产

已建立独立于旧 `580` 条回归的生成式评测资产：

- 12 组反事实边界，共 24 条。
- 8 个母场景 × 4 个决策点，共 32 条单轮案例。
- 8 张完整轨迹角色卡。
- 工作集：24 条单轮 + 4 段轨迹。
- 准入集：8 条单轮 + 4 段轨迹；单轮每例正式运行三次。

当前规则预检结果：`24/24` 条硬边界通过，数据资产数量、分组和覆盖检查通过。模型质量运行和真人轨迹评审需要在确定候选模型配置后执行。

评测位置：

- `src/features/interview/event-centered/generative-evaluation-catalog.ts`
- `src/features/interview/event-centered/generative-evaluation-runner.ts`
- `scripts/run-event-centered-generative-eval.ts`

常用命令：

```bash
# 数据资产和 24 条硬边界，零模型费用
npm run eval:event-centered:generative -- --mode=rules

# 工作集 24 条单轮，每例一次
npm run eval:event-centered:generative -- --mode=model --split=work --confirm-model-run

# 准入集 8 条单轮，每例三次，共 24 个正式输出
npm run eval:event-centered:generative -- --mode=model --split=gate --confirm-model-run
```

可追加 `--human-review-output=<路径>` 生成两屏式人工评审包。模型运行只负责产出固定版本结果和最小 Trace，产品质量结论继续由人工填写。

## 8. 历史候选 3.29.0｜验证记录

已经完成：

- 单次调用、结构化协议、硬检查、状态推进、普通失败恢复、控制轮降级和纯换角度保留路径的针对性自动测试。
- 评测目录、边界规则、单轮三次运行协议和人工评审包测试。
- TypeScript 类型检查与 Next.js 生产构建。
- 全量自动化回归：`239` 个测试文件、`2022` 个用例通过。
- 事件中心专项回归：`27` 个测试文件、`458` 个用例通过。
- 生成式规则评测：数据资产预检通过，硬边界 `24/24`。
- 旧链路独立规则回归：`580/580` 通过。

以下大型评测转为上线后重大模型或策略变更的回归资产：

1. 用冻结的模型与参数运行 28 条工作集，并完成 4 段工作轨迹。
2. 工作集问题收敛后运行 12 条准入集，形成 24 个单轮输出与 4 段准入轨迹。
3. 按板块 6 门槛整理延迟、成本、重试和人工质量结论。

## 9. 原冻结决策与当前影响

本节保留历史决策全文。各项历史状态以对应日期和 [04o Preview 候选交接](./04o-board7-mvp-preview-candidate-handoff.md)为准；后续产品状态以总 Map 与板块 5 当前专项为准。

### GI-009｜调用架构与任务拆分

- 状态与置信度：MVP 两段式 Preview 候选已冻结；高；下文 v70/v70 为历史失败证据
- 当前结论：一次组合调用保留为历史失败基线。当前 Provider v5 继续采用“语义判断 → 用户表达”的两段职责，`ready.origin` 由第一段直接判断；第二段只表达冻结结果。生成式阶段耗尽技术尝试后立即转入确定性 baseline，新增模型请求 `0`。调用架构 A/B 退出首发范围。
- 选择原因：v64 R2 与 v65 证明文字优先级无法稳定隔离理解、问停和表达。把切分点前移到用户文案生成之前，可以让第一段专注判断“已经理解到哪里、是否还需用户补充”，第二段只承担表达，减少组合任务互相干扰和重复语义字段。
- 适用范围：四角度引导复盘与深度聊天正常内容轮；现有产品规则、硬边界、状态、可靠提交、纠正、轻量检查点和 Trace 继续作为输入。
- 依据与案例：v64 R1 基础设施作废；R2 技术 `10/12`、严格有效 `1/12`；v65 定向技术 `2/2`、质量 `0/2`；Provider v2 首轮技术 `5/8`、小卡 `5/8`、回应 `5/8`、严重来源错误 `1`。Provider v3 首批技术 `6/6`、语义 `5/6`、回应 `4/6`、严重错误 `0`。修复探针中的想法案例双层通过；关系恢复第一段正确，第二段两次 `INVALID_SCHEMA`，合并技术完整 `1/2`、门为 `fail / stop`。v70/v70 root-visible probe 技术、状态和动作均为 `2/2`，第一段语义与用户回应均为 `0/2`，说明职责链路可运行，候选质量仍未过门。
- 影响板块：4、6、7、8
- 专项文档：本文
- 候选确认日期：`2026-08-01`

### GI-039｜共用决策流程与方向优先级

- 状态与置信度：MVP 问停顺序与具体作答入口冻结；高；自然度与目标贴合进入 Preview 观察
- 最终结论：确定性边界继续优先。当前理解已经达到成果时停止；只有当前成果仍缺一项会改变理解、该内容只能由用户提供、且存在一个具体低负担入口时才进入 `needs_more`。`questionIntent.goal` 可以保留抽象认识缺口；`answerEntry` 必须下降一层，落到当前事件中可回忆、观察或模拟的动作、画面、原话、比较或判断瞬间，让用户能用一个小片段直接回答。第一段无法形成这种入口时停止提问。用户明确说不清后，同目标最多换一次满足同一标准的入口；再次说不清时停止。`microgoal` 不新增必答层级。
- 选择原因：每个问题都会占用一次用户回答。三项条件把提问限制在“任务未完成、AI 无法代答、补问确有理解价值”的交集，减少追深、追标签和追动机造成的负担，同时保留真正需要用户判断标准时的提问空间。
- 适用范围：四角度引导复盘与深度聊天正常内容轮，覆盖用户成果、AI 综合成果与 ask 三项核心分流。用户边界、安全与异常降级继续使用各自规则。
- 依据与案例：旧 `SMK-F-ASK` 改为 `complete`；`SMK-T-ASK` 保持 `ask`；`SMK-R-ASK` 改为 `complete`；`SMK-A-ASK` 改为 `pause`。v3 六例的语义状态与系统动作偏差均为 `0`；`V3-T-ASK-01` 暴露抽象入口问题。修复探针 `V31-RP-T-ENTRY-01-R1` 已将入口落到“放大后，你目光先停在哪一处？”，Codex 第一段语义与可见回应均判为通过。v70/v70 的 `V70-RV-T-ASK-01-R1` 仍以“心里先冒出来的感觉”作为入口，第一段以 `answer_entry_burden` 失败、用户回应以 `question_value` 失败，形成新的落地失败证据。
- 数据集影响：下一版确认包、开发数据集、质量卡与 Few-shot 统一检查“用户能否用一个当前事件小片段直接回答”。要求用户解释抽象缺口、先分析自己或重新回答刚才说不清的判断均失败。历史运行产物和原裁决保持不变。
- 影响板块：4、6、7、8
- 专项文档：本文、[四角度公共协议](./04-four-angle-common-interview-protocol.md)、[生成式质量评测 v1](./04j-generative-quality-evaluation-v1.md)
- 首次确认日期：`2026-07-30`
- 扩展确认日期：`2026-08-01`

### GI-040｜认知动作、四角度策略卡与两种模式

- 状态与置信度：AI 综合安全上限冻结；高；成果深度进入 Preview 观察
- 最终结论：MVP 中，AI 可以把相关、可追溯事实连接成用户尚未明确说出的当前事件内证据关系并直接 `complete / pause`。AI 可以新增的关系限于区别、先后、条件、可观察结果和实际影响；新增关系的证据需要覆盖关系两侧。感受标签、判断原因、关系意义与行动动机只有在用户已经提供时才能使用；人格、长期模式、他人动机及证据之外的主观解释全部排除。一次只形成一个证据关系。当前 Provider v5 在 `ready` 时由第一段明确输出 `user_articulated / ai_synthesized`，`insightKind` 继续由系统兼容；`test_understanding` 只保留历史兼容。
- 选择原因：证据关系是 AI 能稳定提供新增价值的最小单位，可以帮助用户看见事实之间已经存在的联系，同时保持结论可追溯。原因、意义和动机需要更强的主观解释，在 MVP 阶段会显著增加强推断与误解风险，因此只使用用户已经提供的内容。
- 适用范围：四角度引导复盘与深度聊天中的 `ai_synthesized → complete / pause`，且只解释当前事件。用户主动成果与 ask 触发条件按 `GI-039` 处理，用户否认后的撤销与重开规则继续生效。
- 依据与案例：`SMK-F-AI / SMK-T-AI / SMK-R-AI / SMK-A-AI` 继续定义四角度证据关系上限。v3 的感受、行动、纠正和诚实收束均通过；六例严重事实、边界和强推断错误为 `0`。Provider v2 曾因成果来源标签产生严重错误，v3 移除运行时强制来源后本批来源与动作阻断为 `0`。v70/v70 root-visible probe 同样保持严重错误 `0`，两例分别验证 ask 与用户主动行动成果，未新增 AI 综合准入样本。
- 影响板块：4、6、7、8
- 专项文档：本文、[四角度公共协议](./04-four-angle-common-interview-protocol.md)、[生成式质量评测 v1](./04j-generative-quality-evaluation-v1.md)
- 确认日期：`2026-07-30`

### GI-041｜Prompt、结构化输出与 Trace

- 状态与置信度：Provider v3 为历史实现；Provider v5、AI 对话人称和 Trace 已形成 Preview 候选；高
- 最终结论：v70/v70 及更早运行继续按 Provider v3 追溯。当前 Provider v5 第一段输出 `understanding / decision.state / decision.origin / semanticFrame / questionIntent / limitReason`，第二段输出 `thinkingSummary / response / cannotExpressReason`；系统通过唯一兼容入口生成现有完整 `semanticPlan`、状态、恢复和 Trace。候选版本为策略 `5.50.0`、semantic/visible Prompt v72、Few-shot v29、角度卡 `2.12.0`、产物 `event-centered-semantic-plan.v5`。AI 对话回应使用第二人称或中性表达，日志第一人称正文由独立日志生成承担。
- 选择原因：v3 用一条完整理解替代 `main / necessaryScope`，用 `goal / answerEntry` 替代模型生成的目标编号、缺口和认知动作，并把成果来源与认识分类降为非阻断标签。第一段承担可审阅的语义判断，第二段获得完成表达所需的最小信息，完整历史不会重新影响冻结判断。对话与日志分别管理叙述身份，使 AI 气泡持续面向用户说话，日志生成继续承担第一人称日记表达。
- 适用范围：每个生成式内容轮、状态更新、质量评测和版本回放。
- 依据与案例：v3 契约、独立第一段 Prompt、兼容映射、第二段最小输入、v1 / v2 重新规划、v3 只重跑第二段和重试均已完成离线验证；首批真实运行技术与第一段结构均为 `6/6`，第一段语义 `5/6`、回应 `4/6`。想法修复探针的第二段使用第二人称并通过；关系恢复的两次原始文案也使用第二人称且语义自然，合法可见结果因嵌套包装结构失败而未形成。v70/v70 root-visible probe 两例均形成合法根级五字段结果，技术完整 `2/2`，AI 对话均使用第二人称或中性表达；Codex 双层质量均为 `0/2`，gate=`fail / stop`。
- 影响板块：6、7、8
- 专项文档：本文
- 确认日期：`2026-08-01`

### GI-042｜系统硬检查与分层失败恢复

- 状态与置信度：硬检查、两段重试与确定性快速降级已实现；高；最小安全门通过
- 最终结论：字段结构与状态组合、证据可追溯、用户纠正/拒绝/停止、当前事件与活动分支、单一问题、模式动作和次数上限、严重事实反转和越界推断继续作为客观检查。非空理解至少一条证据，新增关系的证据覆盖关系两侧。理解完整性、问停合理性、`answerEntry` 负担、思路意图、问题价值、人称视角和自然表达进入产品质量评审。第一段与第二段各自最多一次技术重试；耗尽后直接使用已保存原话和上一份已提交状态运行确定性 baseline，不追加模型请求。语义 checkpoint 可供第二段恢复。
- 选择原因：语义价值交给模型，可验证正确性交给系统，兼顾个性化、控制权和连续性。
- 适用范围：生成输出校验、重试、可靠提交与异常恢复。
- 依据与案例：离线测试已覆盖未知证据阻断、关系证据覆盖、表达失败重试、v3 checkpoint 恢复和 v1 / v2 安全升级。v3 首批技术 `6/6`、语义状态偏差 `0`、系统动作偏差 `0`、严重错误 `0`；修复探针进一步捕获第二段嵌套包装与根级契约冲突。v70 离线修正后的定向验证为 `132/132`，最终事件中心为 `38` 个测试文件 `734/734`，类型检查通过。v70/v70 root-visible probe 的技术、语义状态和系统动作均为 `2/2`、严重错误 `0`，回答负担、问题价值和理解完整性由 Codex 人工层识别并触发停止。
- 影响板块：5、6、7、8
- 专项文档：本文
- 确认日期：`2026-08-01`

### GI-043｜五种换问法保持同一目标

- 状态与置信度：已冻结；高
- 最终结论：简单、具体、换角度、深入、轻一点五种换问法保持当前产品角度和提问目标，不写入事实、不增加回答机会；同一问题最多三个版本。
- 选择原因：换问法承担当前问题的可理解性和负担修复，保持目标可以避免意外推进访谈状态。
- 适用范围：生成式问题的回复版本；产品级角度切换继续走独立操作。
- 依据与案例：“具体”增加时刻或行为锚点，“轻一点”缩小回答范围，两者都保留原目标和次数。
- 影响板块：5、6、7、8
- 专项文档：本文
- 确认日期：`2026-07-28`

### GI-044｜复用、发布隔离与快速回退

- 状态与置信度：已冻结；高
- 最终结论：复用现有模型与 Provider、事实、纠正、检查点、回复版本、可靠提交、日志成果和 Trace；状态扩展写入现有 JSON。Production 保持 `legacy + baseline`，内部 Preview 使用 `event_centered + generative`，现有确定性策略提供即时回退。
- 选择原因：复用稳定底座可以集中验证提问策略；两层开关能够独立控制入口与策略，并保留会话和用户成果。
- 适用范围：状态兼容、Preview 配置、Production 隔离与回退。
- 依据与案例：`INTERVIEW_EVENT_CENTERED_MODE` 控制入口，`INTERVIEW_EVENT_CENTERED_STRATEGY` 控制内部策略；运行默认值保持安全基线。
- 影响板块：1、5、7、8
- 专项文档：本文
- 确认日期：`2026-07-28`

### GI-045｜落地验证门与架构复核条件

- 状态与置信度：MVP Preview 候选门已通过；高；Production 资格由板块 8决定
- 最终结论：板块 7 首发门使用四角度基本回应、严重风险、快速降级和事件日志闭环。当前最终产品回应 `4/4`、严重错误 `0`、日志闭环 `1/1`，候选可进入板块 8。大型工作集、隐藏集、准入集、完整轨迹和盲评进入上线后重大变更回归。v62–v72 与各 Provider 历史失败完整保留。
- 选择原因：真实用户数据能够更快校准回答意愿、认识价值与保存漏斗；首发前继续拦截原话丢失、事件串线、用户控制失效、无来源日志和主链不可用。
- 适用范围：板块 7 Preview 候选交付与板块 8 进入条件。
- 依据与案例：生成式内部 `2/4`，两例确定性 baseline 恢复新增模型请求 `0`；事件日志最终来源门通过；专项 `691/691`、旧规则 `580/580`、全量 `2393/2393`。
- 影响板块：4、6、7、8
- 专项文档：本文
- Preview 候选确认日期：`2026-08-02`

### GI-046｜轻量检查点与成果单次展示

- 状态与置信度：已冻结并实现；高
- 最终结论：第一检查点显示持续轻提示和四角度入口；第二检查点显示持续轻提示和“换个角度”，用户直接输入即沿上一完成角度进入深聊。大卡片、阶段标题、成果副本和可见“继续深入”按钮退出当前界面。
- 选择原因：AI 正式回应已经承担成果展示，轻提示只承担状态和下一步入口，能够减少重复与流程感。
- 适用范围：事件中心第一、第二检查点、恢复回放和内部 Preview；旧 `continue_exploration` 接口保留兼容。
- 依据与案例：停止轮只出现一段成果；提示始终位于输入框上方，用户可以直接输入或选择角度。
- 影响板块：2、4、5、6、7、8
- 专项文档：本文
- 确认日期：`2026-07-29`

### GI-047｜第一段只输出可核验语义骨架，第二段首次生成完整文案

- 状态与置信度：两段职责和骨架形态保留；第一段质量规则重新打开；中
- 最终结论：第一段退出用户可见自然句创作，输出 `understanding / decision.state / decision.origin / semanticFrame / questionIntent / limitReason`。`semanticFrame.units` 使用 `1–3` 个无自然句单元，`2+` units 必须提供一条受控 relation；`questionIntent` 只保留内部 gap，以及带 `kind / evidenceRefs / anchorQuote` 的可追溯 answerSource；`limitReason` 使用 `{kind,evidenceRefs}`。系统从骨架与源证据派生内部兼容字段。第二段只读冻结的成果归属、骨架、提问意图、停止原因与源证据，并首次生成统一 `response`；系统按冻结动作映射为问题、成果或诚实收束。
- 选择原因：v70 两例的技术、状态和动作均正确，第一段自然句分别固化了抽象问题入口和压缩后的成果内容，第二段沿用后造成双层质量 `0/2`。语义骨架保留可核验判断和证据覆盖，把完整表达集中到一个生成阶段，可以减少重复文案决策并让失败层级更清楚。
- 适用范围：四角度引导复盘与深度聊天的正常内容轮；现有用户边界、安全、纠正、可靠提交、轻量检查点、状态、Trace 和 Production 隔离继续有效。
- 依据与案例：`V70-RV-T-ASK-01-R1` 的“心里先冒出来的感觉”在第一段已经形成抽象问题，双层分别因 `answer_entry_burden / question_value` 失败；`V70-RV-A-BOUNDARY-01-R1` 未明确保留“把常用香料移到手边”这一行动侧，双层均因 `understanding_incomplete` 获得 `borderline` 并按失败计。v70/v70 技术、语义状态和系统动作 `2/2`、第一段语义与用户回应 `0/2`、严重错误 `0`，gate=`fail / stop`。
- 影响板块：板块 4重新打开显式关系归属、纠正优先级与必要证据覆盖；板块 6双层判尺继续有效；板块 7和板块 8继续阻断。
- 专项文档：[04n｜Provider v4→v5 语义骨架规格](./04n-board7-semantic-skeleton-v1-spec.md)
- 确认日期：`2026-08-01`

### GI-048｜成果归属由第一段直出，第二段以内容本身表示成功

- 状态与置信度：最小协议实现保留；中高；真实验证失败
- 最终结论：`ready.origin` 由第一段直接输出，系统停止依据语义单元、关系结构或 `answerStatus` 猜测成果来源。第二段只输出 `thinkingSummary / response / cannotExpressReason`；存在合格 `response` 即表示成功，无法忠实表达时填写 `cannotExpressReason`。系统依据第一段冻结动作确定回应类型，未知额外元数据直接丢弃。
- 选择原因：成果来源必须对照用户原话，第一段拥有完整判断材料；第二段完整内容已经足以证明表达成功，额外状态标签会制造同义值误杀。
- 适用范围：四角度引导复盘与深度聊天的两段式内容轮、checkpoint 恢复、状态、Trace 与评测。用户控制、Production 隔离和旧链路保持现状。
- 依据与案例：v71 感受场景的“那一刻就是松快”被旧兼容层误标为 AI 综合；同案两条自然成果句因 `status=expressible` 未命中 `ok` 被拒绝。v72 感受与关系用户成果来源正确，行动案例仍误标来源；第二段六例受统一 JSON 请求合同缺口阻断。
- 影响板块：4、6、7、8
- 专项文档：[04n｜Provider v4→v5 语义骨架规格](./04n-board7-semantic-skeleton-v1-spec.md)、[04j｜生成式质量评测 v1](./04j-generative-quality-evaluation-v1.md)
- 确认日期：`2026-08-02`

### GI-049｜v72 六例首轮失败后停止并重新打开第一段质量规则

- 状态与置信度：已执行；高
- 最终结论：v72 不进入隐藏集、工作集、准入或板块 8。结构化输出层补齐 JSON 请求合同，第一段重新冻结显式关系归属、纠正优先级和必要证据覆盖；多个产品原因收敛前停止模型运行和 Prompt 调优。
- 选择原因：第一段技术 `6/6`、严格语义 `3/6`；第二段十二次请求全部被供应商拒绝。格式修复只能恢复表达请求，无法修复行动来源、纠正和材料范围三项产品失败。
- 适用范围：v72 候选与下一份定向候选；Production 保持 `legacy + baseline`。
- 依据与案例：`SF4-A-EFFECT-01 / SF4-CORRECTION-READY-01 / SF4-LIMITED-01` 三类语义失败，以及六例统一 `Prompt must contain the word 'json'` 技术失败。
- 影响板块：4、6、7、8
- 专项文档：本文、[04n｜Provider v5 规格](./04n-board7-semantic-skeleton-v1-spec.md)、[04j｜生成式质量评测 v1](./04j-generative-quality-evaluation-v1.md)、[Codex 双层验收](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-v2-codex-review.md)
- 确认日期：`2026-08-02`

## 10. 当前板块状态、影响复核与下一步

- 当前板块：板块 5 正在校准阶段 1～2 问题计数、问题修复、回复版本、焦点纠正、失败恢复与成果／暂停后交互；GI-068 的记录级模式边界直接继承。
- 板块 4：`GI-067 / GI-068～074` 已冻结，产品决策完成，落地验证尚未启动。
- 板块 6：按 GI-074 建立 `24＋40`、`28＋12`、评分卡、Judge 说明和两模式 `4＋2` 正式资产；GI-066 的 `10×3` 与单角度 `8+2` 继续作为历史自动证据。
- 板块 7：等待板块 5～6 后实施；实现发现产品冲突时携带证据返回对应产品板块。
- 板块 8：GI-066 最新真人体验 `No-Go`，当前等待新候选并沿用独立 Production 授权。
- Production：继续运行 `legacy + baseline`；入口、模型、配置和数据保持原状。

当前产品事实见[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)与[板块 5 当前专项](./05-board5-stability-user-control-and-interaction-scope.md)，冻结评测交接见[04x-07｜GI-074](./04x-07-evaluation-preview-and-handoff.md)，GI-066 历史协议见[04u｜GI-066](./04u-board8-gi066-thought-only-question-strategy.md)，发布边界见[04p｜板块 8](./04p-board8-preview-go-no-go-production-authorization.md)。`optional + generative` 只有在新候选通过板块 8 真人验收并获得产品负责人单独授权后才可人工开启。

### 0.27 `2026-08-02` v71 首轮运行中止

首轮用户授权已执行。`SF4-F-READY-01` 的第一段成功；第二段两次都生成了自然成果句，但顶层成功状态使用 `expressible`，与服务端接受的 `ok / cannot_express` 协议不一致，连续触发 `INVALID_SCHEMA`。账本在 `1` 次预检和 `3` 次生成请求后封存，后续 `5` 例、隐藏集、工作集、准入与板块 8均未继续。

本轮需要复核两项现有实现：第二段成功状态的 Prompt 与结构协议对齐，以及“用户已直接表达的理解”到兼容 `origin` 的系统投影。前者已完成离线契约补强并通过回归；后者仍是产品/策略复核项。完整证据见 [首轮运行报告](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v71-semantic-frame-first-pass-report.md)。Production 继续 `legacy + baseline`。

### 0.28 `2026-08-02` v72 成果归属与统一回应根因修复

v71 的技术中止来自两个重复职责：第一段没有交付下游必需的成果归属，系统只能根据骨架形态猜测；第二段生成完整内容后还要额外声明成功状态，同义值 `expressible` 让可用回应被结构门拒绝。v72 采用最小充分交接：

1. 第一段 `decision` 固定为 `state + origin`。`ready` 直接给出 `user_articulated / ai_synthesized`，其他状态为 `null`。系统删除“多单元或有关系即 AI 综合”的推测逻辑。
2. 第二段固定输出 `thinkingSummary / response / cannotExpressReason`。系统按冻结动作把 `response` 映射为 question、insight 或 honestLimit；未知额外元数据不参与技术成败。
3. AI 综合继续要求一条安全关系且证据覆盖关系两侧；用户成果要求关系可以在用户原话中找到。`answerStatus` 与成果来源保持独立。
4. 旧两条 `status=expressible` 原始回应已通过离线归一回放；旧 v71 报告和 `aborted` 账本保持原样。
5. checkpoint 升级为 `event-centered-semantic-plan.v5`，并保存 `decisionOrigin`；现有状态、可靠提交、纠正、轻量检查点和 Trace 继续复用。

候选版本为策略 `5.50.0`、semantic Prompt `2026-08-02.event-centered-generative-v72-semantic-origin`、visible Prompt `2026-08-02.event-centered-generative-v72-visible-response`、Few-shot `quality-patterns.2026-08-02.v29`、角度卡 `2.12.0`。新的六例确认包补齐一条真正由 AI 连接两侧事实的行动案例，指纹为 `481c86765c4d7f1866887705b5af2e032975dc2818c27e9792dedefe3fee2229`：[确认包](../../../artifacts/generative-interview-board7/2026-08-02/semantic-frame-v5-offline-case-confirmation.md)。

本轮事件中心与生成式评测 `35` 个测试文件、`679/679` 用例通过，TypeScript 与 ESLint 通过，模型请求 `0`。六例确认后仍需建立新预算并获得独立授权；隐藏集、工作集、准入与板块 8继续阻断，Production 保持 `legacy + baseline`。

### 0.29 `2026-08-02` v72 六例首轮失败与停止

六例完成产品确认和独立授权后，评测入口补齐独立账本、每次请求预留、第一段即时 checkpoint、第二段恢复、单例失败继续跑完整批，以及运行完成和产品通过的分离状态。离线门为 `36` 个文件、`687/687` 个专项用例通过，TypeScript、ESLint 与差异检查通过。

首个账本在零 Provider 请求下暴露环境加载缺口：脚本只看到旧 Endpoint，没有读取 `.env.local` 中冻结的 `deepseek-v4-flash` 直连配置。该账本保持 `aborted` 并作为基础设施空跑审计；入口改为加载与应用一致的完整环境层级后，v2 替代账本完成同一首轮。

v2 使用 `1` 次预检和 `18` 次生成请求跑完六例。第一段六次请求均合法，严格产品通过 `3/6`；第二段十二次请求均被 DeepSeek 拒绝，原因是 `response_format=json_object` 时 Prompt 中缺少 `json`。用户回应和技术完整均为 `0/6`。第一段失败分别为行动来源误判、纠正与必要限定遗漏、材料有限时遗漏唯一证据。

`GI-049` 据此固定当前处理：

1. 结构化输出基础层保证 `json_object` 与中性 JSON 输出指令成对出现；
2. 第一段重新打开“显式关系才归用户成果”、纠正优先和必要证据强制携带；
3. 当前不进行第二轮模型调用、Prompt 调优、隐藏集或工作集；
4. 多个产品原因收敛并形成新版本、案例指纹和授权后，才允许恢复定向验证。

完整证据：[v72 原始报告](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-v2-report.md)、[Codex 双层验收](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-v2-codex-review.md)、[基础设施空跑审计](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-infrastructure-void.md)。Production 保持 `legacy + baseline`。
