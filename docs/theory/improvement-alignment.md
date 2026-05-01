# Improvement 维度对齐开发规格

最后更新：`2026-05-01`

## 理论背景

- 原始理论 PDF：`docs/theory/精简-如何实现幸福.pdf`
- 本文用于把理论里的“改进日志”收束成可执行的产品与技术规格。
- 截至 `2026-05-01`，本文是 `improvement / 改进` 的开发规格和阶段实现对照。
- 当前代码已经有 `improvement` 的通用入口、结构化数据面、草稿容器、扩展后的 `snapshotData/payload`、专属 AI 抽取 schema、fallback 抽取、提问策略、完整 / partial 完成标准、正文成稿、质量门、fallback draft、标题治理和自动化验收样例。

理论原文里，日志的总目标是：聚焦当下，通过每天做一点具体的事，慢慢改善自己的处境。

`improvement / 改进` 的核心句是：

- 如果今天过得很好，就想清楚好在什么地方，以后怎么把这种状态重复出来。
- 如果今天过得不好，就想清楚问题在哪，下一次怎么避免。
- 它的价值是让人不是被生活推着走，而是能一点点主动优化自己的生活。

因此，改进日志不是检讨书，不是效率复盘，也不是行动计划生成器。它要帮助用户把一次具体经验整理成下一次可以轻轻尝试的生活优化。

## 1. 理论目标

`improvement / 改进` 的核心任务是：

- 把一次好状态整理成可重复条件。
- 把一次不理想状态整理成可避免卡点。
- 帮用户找到下次最小、可控、低压力的调整动作。

它真正要回答的是：

> 下次遇到类似情境时，我可以怎样更容易让好状态发生，或更少让坏状态重复？

这个维度的长期价值，不是让用户变成更自律、更高效或更正确的人，而是让用户逐步获得对生活处境的主动调节感。

它与其他维度的边界：

- 与 `joy` 的区别：`joy` 关注什么让我有生命力；`improvement` 关注如何让这种状态更容易再次发生。
- 与 `fulfillment` 的区别：`fulfillment` 关注今天为什么不算白过；`improvement` 关注下次怎么做得更稳。
- 与 `reflection` 的区别：`reflection` 关注新的判断依据；`improvement` 关注下一次具体调整。
- 与 `gratitude` 的区别：`gratitude` 关注被看见、被支持和关系线索；`improvement` 关注自己能主动优化的处境。

如果用户的重点是“我看清了什么”，优先留在 `reflection`；如果用户的重点变成“下次怎么调整”，应进入 `improvement`。

## 2. 最终日志状态

一篇合格的 improvement 日志，读完后应该让人知道：

- 今天哪个具体情境让我觉得值得调整。
- 这次是想重复一个好状态，还是避免一个不理想状态。
- 好状态好在哪里，或不理想状态卡在哪里。
- 哪一部分是我下次可以稍微调整的。
- 下次最小的一次尝试是什么。
- 如果材料足够，怎样算比这次更稳一点。

这篇日志的核心，不是“我哪里做错了”，而是：

> 我看见了一个可以被优化的生活细节，并知道下一次可以从哪里轻轻动一下。

成稿读感应介于私密日记和轻复盘之间：

- 可以有整理后的清晰度。
- 不能像检讨书、工作复盘、OKR、习惯打卡或效率工具建议。
- 用户读起来应该觉得“这是我整理出的下一次小调整”，而不是“系统在教育我怎么改”。

## 3. 必填槽位

没有下面这些槽位，就不能认为一篇完整 improvement 日志已经成立。

### `situation`

改进情境。

- 必须是具体发生过的片段、动作或场景。
- 不能只是“今天状态不好”“我想改进一下”“我应该更努力”。
- 示例：`今天开会时我急着解释，没有先听完整对方的问题。`

### `improvementTrack`

改进轨道。

固定为两类：

- `repeat_good`：重复好状态。
- `avoid_bad`：避免坏状态。

判断原则：

- 用户说“这次很顺、很稳、状态很好、想下次继续这样”，倾向 `repeat_good`。
- 用户说“这次卡住、失控、后悔、消耗、想下次避免”，倾向 `avoid_bad`。
- 如果两者都有，优先看用户最后想解决的问题；仍不清楚时，追问一轮，不要硬分类。

### `stateAssessment`

状态判断。

- 在 `repeat_good` 中，它回答“这次好在哪里”。
- 在 `avoid_bad` 中，它回答“这次不理想在哪里”。
- 它不能只是情绪标签，必须和情境有关。

### `frictionPoint` 或 `repeatCondition`

二者至少成立一个。

`frictionPoint` 是坏状态的核心卡点：

- 回答“问题卡在哪里”。
- 不能写成人格否定，例如“我就是不行”“我太差了”。
- 应尽量落到表达、节奏、判断、准备、边界、协作、环境、身心状态等可观察层。

`repeatCondition` 是好状态的可重复条件：

- 回答“这次为什么顺，什么条件帮了我”。
- 不能写成空泛鸡汤，例如“保持积极心态”。
- 应尽量落到提前准备、节奏安排、外部支持、信息清晰、环境合适、身体状态等具体条件。

### `controllableFactor`

可控调整点。

- 回答“下次我能调整哪一小块”。
- 必须是用户自己可以影响的部分。
- 不要求完全解决问题，只要求能让类似情境更稳一点。
- 如果只能归因到他人、运气或外部系统，不能强行生成完整日志。

### `nextAttempt`

下一次尝试。

- 必须是低压力、具体、可执行的小动作。
- 不能是“我要变好”“我要自律”“我以后注意点”。
- 示例：
  - `下次回答前先复述一遍对方的问题。`
  - `开工前先写下今天最重要的三件事。`
  - `晚饭后不再临时打开新的复杂任务。`

## 4. 可选槽位

这些槽位会提升日志质量和后续长期价值，但不是每次都必须有。

### `successSignal`

下次怎样算更稳一点。

- 回答“我怎么知道这次调整有效”。
- 标准要轻，不要变成 KPI。
- 示例：`对方确认我理解对了之后，我再开始解释。`

### `feeling`

当时感受。

- 可以保留急、乱、后悔、松一口气、踏实、稳住等现场感。
- 不能代替卡点、条件或下一次尝试。

### `improvementType`

改进类型。

当前建议固定为：

- `表达型改进`
- `节奏型改进`
- `判断型改进`
- `协作型改进`
- `边界型改进`
- `准备型改进`
- `身心型改进`
- `环境型改进`

这个类型只用于系统组织理解和后续成稿，不应直接展示为正文结构，也不能代替实际理解。

### `tags`

标签。

- 可用于长期归纳，例如 `沟通`、`工作节奏`、`休息`、`边界`、`协作`。
- 标签不能推动完成标准。

## 5. 完整完成标准

完整模式成立需要同时满足：

- 已找到可信 `situation`
- 已判断可信 `improvementTrack`
- 已说清可信 `stateAssessment`
- `repeat_good`：已形成可信 `repeatCondition`
- `avoid_bad`：已形成可信 `frictionPoint`
- 已形成可信 `controllableFactor`
- 已形成可信 `nextAttempt`

`successSignal` 不作为完整模式硬门槛，但如果已经自然出现，应进入正文。

可信 `nextAttempt` 必须满足：

- 能从情境、卡点或可重复条件里自然推出。
- 是用户下次能做的一小步。
- 不把一次局部经验升级成长期人格改造。
- 不写成宏大目标、管理口号或自我命令。

完整模式下，结尾允许轻轻收束出下一次尝试，例如：

- 下次我想先把问题听完整，再开始解释。
- 如果还遇到这种节奏，我先给自己留一个确认问题的停顿。
- 这次最值得记下来的，是开始前先把主线写清楚，确实会让我稳很多。

完整模式仍然禁止：

- 写成检讨。
- 写成计划表。
- 写成效率工具建议。
- 写成“以后一定要”“我必须”“我应该彻底改变”。
- 从一次事件跳到稳定人格判断。

## 6. 部分完成标准

如果用户明确不想继续深挖，或者当前证据只够到半程，只要满足下面条件，就允许生成“当前版本日志”：

- 已找到可信 `situation`
- 已说清可信 `frictionPoint` 或可信 `repeatCondition`

部分模式的本质是：

- 已经看见一个值得调整的点。
- 但还没有形成足够稳的下一次尝试。

部分模式下允许写：

- 这个情境为什么值得被记下来。
- 这次不理想的卡点，或这次顺利的条件。
- 现在能看见一点可调整方向。

部分模式下明确禁止：

- 硬写 `nextAttempt`。
- 假装已经形成完整方案。
- 写成“以后我就要……”的行动计划。
- 写成稳定规律或人生结论。

如果用户拒绝继续，但没有具体情境，或只有“我很差 / 今天很糟 / 我想改变”这类总括：

- 不能继续硬追问细节。
- 不能硬生成日志。
- 应进入低压选择：“只补一句 / 换一个片段 / 先退出”。
- “只补一句”只要求补一个具体情境，不要求补完整方案。

## 7. 写作控制层

improvement 的正文生成应沿用统一写作控制接口：

- `voiceMode: "journal"`
  - 像用户自己整理出来的日志，不像外部建议。
- `narrativeOrder: "scene_core_shift_close"`
  - 正文顺序默认是：
    - 从具体情境进入。
    - 写清这次好在哪里，或不理想在哪里。
    - 写清可重复条件或核心卡点。
    - 写清可控调整点。
    - 完整模式轻收下一次尝试；部分模式停在当前看见的改进点。
- `closingMode`
  - `complete -> "stable_clue"`：在 improvement 语义里表示“轻收下一次小尝试”。
  - `partial -> "current_understanding"`：只停在当前改进点，不硬写方案。
- `toneBanSet`
  - 检讨书腔
  - 自责腔
  - 说教腔
  - 效率工具建议腔
  - OKR / KPI / 计划表腔
  - 心理诊断腔
  - 宏大成长口号
  - “我应该”
  - “我必须”
  - “以后一定要”

具体到 improvement，这套控制要确保：

- 开头不能从“我需要改进”这种抽象判断起笔。
- 中间不能只有情绪和自责，必须落到情境里的卡点或有效条件。
- 结尾不能给用户上课，不能替用户安排一整套计划。

## 8. 质量门规则

improvement 至少要拒收以下问题：

- `missing_scene_anchor`
  - 全文没有可信具体情境。
- `missing_improvement_core`
  - 没有卡点，也没有可重复条件，只是在说“我要变好”。
- `self_blame_tone`
  - 写成自责、羞辱、人格否定或检讨。
- `empty_action_plan`
  - 只有“努力、自律、坚持、注意一点”等空泛动作。
- `forced_next_attempt`
  - 用户没有提供足够依据，却硬写下一次尝试。
- `advice_tone`
  - 像系统在给建议，而不是用户自己的整理。
- `therapy_tone`
  - 写成心理诊断、人格分析或创伤解释。
- `productivity_report_tone`
  - 写成工作复盘、效率报告、OKR 或任务管理建议。
- `external_blame_without_control`
  - 只归因他人或环境，没有任何可控调整点，却强行生成完整模式。
- `partial_fake_plan`
  - 部分模式下硬写完整方案、稳定规则或强结论。
- `track_mismatch`
  - `repeat_good` 写成问题检讨，或 `avoid_bad` 写成复制成功经验。

其中最关键的产品禁令是：

- 不能像检讨书。
- 不能像效率工具。
- 不能没有具体情境。
- 不能只有自责没有可控点。
- 不能把局部小调整写成长期人生改造。

## 9. fallback 原则

improvement 的 fallback 也必须像日志，不像说明文，更不能像系统建议。

正文骨架固定为：

- 具体情境起笔。
- 写出这次状态判断。
- 写出卡点或可重复条件。
- 写出可控调整点。
- 完整模式轻收下一次尝试；部分模式停在当前看见的改进点。

完整模式 fallback：

- 可以自然写出可信 `nextAttempt`。
- 结尾力度只到“下次我想先试试这一小步”。
- 不写成计划表，不写成长期承诺。

部分模式 fallback：

- 只能停在“这件事让我看见一个可以调整的地方”。
- 不能硬写 `nextAttempt`。
- 不能写“以后我要做到……”。

fallback 标题也必须走统一语义短标题治理，不能直接使用 `今天的改进` 作为最终标题，除非没有任何可信语义候选。

## 10. 标题治理与用户边界

### 标题治理

标题上限仍为 `16` 字。

标题必须是总结型短短语，优先从 `frictionPoint / repeatCondition / controllableFactor / nextAttempt` 提炼。

推荐标题方向：

- `先听完再回应`
- `表达慢下来`
- `把节奏放稳`
- `开工前定主线`
- `提前留出缓冲`
- `把边界说清楚`
- `让准备更充分`

禁止标题：

- `改进日志`
- `今天的改进`
- `下一次尝试`
- `我要变得更好`
- 长事件句机械截断，例如 `今天开会时我有点急`

### 用户边界

用户明确表达以下意思时，边界优先级高于槽位完整度：

- 不想继续。
- 不要再追问。
- 直接生成。
- 总结日志。
- 整理成日志。
- 追问没有意义。

材料足够时：

- 如果满足完整标准，进入完整日志。
- 如果满足部分标准，进入 partial 当前版本日志。

材料不足时：

- 不继续补槽位式追问。
- 进入 `boundary_insufficient`。
- 前端保持“只补一句 / 换一个片段 / 先退出”。
- 对 improvement，“只补一句”应引导用户补一个具体情境或一句卡点，不要求完整方案。

## 11. 访谈策略开发规格

### 分步策略

第 5 阶段已经落到可执行提问策略：

- 入口开场：`src/features/interview/server/dimension-config.ts`
- fallback/stage 问题：`src/features/joy-interview/server/joy-interview-engine.ts`
- AI follow-up 规则：`src/features/joy-interview/prompts/joy-prompts.ts`
- 回归测试：`tests/unit/joy-interview.service.test.ts`、`tests/unit/joy-prompts.test.ts`

第 1 步：抓具体情境。

- 目标：拿到 `situation`。
- 问法：今天有没有一个让你觉得“下次可以更好一点”的具体时刻？

第 2 步：判断改进轨道。

- 目标：拿到 `improvementTrack` 和 `stateAssessment`。
- 问法：你更想记住的是，这次为什么顺，还是下次想避免哪里再发生？

第 3 步：找核心机制。

- `repeat_good`：找 `repeatCondition`。
- `avoid_bad`：找 `frictionPoint`。
- 问法：
  - 好状态：这次好在哪里？如果想重复它，最关键的条件是什么？
  - 坏状态：真正卡住你的地方是什么？是节奏、表达、判断、协作，还是别的？

第 4 步：找可控点。

- 目标：拿到 `controllableFactor`。
- 问法：如果下次只调整一小处，哪一处最可能让情况变好？

第 5 步：收束下一次尝试。

- 目标：拿到 `nextAttempt`，可选拿到 `successSignal`。
- 问法：下次你想试的最小动作是什么？怎样算比这次稳了一点？

### 什么时候继续追问

- 有情境，但不清楚是重复好状态还是避免坏状态。
- 有坏状态，但只有情绪，没有卡点。
- 有好状态，但只有“很顺”，没有可重复条件。
- 有卡点或条件，但没有用户可控点。
- 有可控点，但下一次尝试仍然太空泛。

### 什么时候停止

- 完整模式所有必填槽位成立。
- 用户明确拒绝继续，且 partial 标准成立。
- 用户拒绝继续但材料不足，进入低压选择。
- 用户输入明显转向感谢、思考或充实，应考虑转维度，不硬留在 improvement。

## 12. 技术落地清单

后续实现应按以下顺序推进：

1. 更新 schema（已完成）
   - `src/features/interview/schema/interview.schema.ts`
   - 扩展 `improvementSnapshotDataSchema`
   - 扩展 `improvementJournalPayloadSchema`

2. 更新维度定义（已完成）
   - `src/features/interview/dimension-definitions.ts`
   - 映射 `improvementTrack / stateAssessment / repeatCondition / controllableFactor / successSignal`
   - 更新进度分数规则

3. 新增 AI 抽取 schema（已完成）
   - `src/features/joy-interview/schema/joy-ai.schema.ts`
   - 新增 `improvementExtractResultSchema`
   - 更新 `getExtractResultSchema`
   - 抽取 guardrails：
     - 不允许从“我很差 / 我不行”抽成 `frictionPoint`
     - `nextAttempt` 必须是具体动作
     - `controllableFactor` 必须是用户能调整的一小块
     - `repeat_good` 如果用户已经说清原因，需要抽 `repeatCondition`；如果还没说清，允许先只保留轨道，下一轮再追问，不强行抽 `frictionPoint`
     - `avoid_bad` 如果用户已经说清原因，需要抽 `frictionPoint`；如果还没说清，允许先只保留轨道，下一轮再追问，不强行抽 `repeatCondition`

4. 更新 fallback 抽取与阶段推进（已完成）
   - `src/features/joy-interview/server/joy-interview-engine.ts`
   - 新增 improvement 专属推断函数
   - 新增 improvement 专属 `getNextStage` 分支
   - 新增 improvement 专属 `buildAssistantQuestion` 分支
   - 在 `src/server/services/interview/joy-interview.service.ts` 接入完整 / partial choice 触发

5. 更新正文生成策略（已完成）
   - `src/features/interview/server/draft-policies.ts`
   - 新增 `buildImprovementBrief`
   - 新增 `resolveImprovementCompletionMode`
   - 新增 `IMPROVEMENT_TONE_BAN_SET`
   - 新增 improvement 质量门
   - 新增 improvement fallback draft

6. 更新标题治理（已完成）
   - `src/features/interview/journal-title.ts`
   - 增加 improvement 语义短标题候选和坏标题替换规则

7. 增加测试（已完成阶段 8 自动化覆盖）
   - `repeat_good` 抽取与阶段推进
   - `avoid_bad` 抽取与阶段推进
   - track-only 中间态抽取
   - partial 边界收束
   - boundary insufficient
   - 标题不能退回长事件句截断
   - 正文生成、quality gate、fallback draft 和标题候选治理
   - 生成、重新生成、保存、刷新恢复仍作为端到端产品验收继续执行

## 13. 验收用例

### 用例 1：避免坏状态

输入：

> 今天开会时我有点急，对方问题还没说完我就开始解释。后来发现他问的其实是另一个点。下次我想先复述一遍问题，再开始回答。

预期：

- `situation`：开会时急着解释。
- `improvementTrack`：`avoid_bad`
- `stateAssessment`：没有听完整就回应，导致理解偏了。
- `frictionPoint`：回应太快 / 没先确认问题。
- `controllableFactor`：回答前先确认理解。
- `nextAttempt`：先复述问题再回答。
- 正文不能写成自责或检讨。
- 标题可类似 `先听完再回应`。

### 用例 2：重复好状态

输入：

> 今天上午我先写了三条重点再开工，整个人很稳，没有被消息带着跑。下次我想继续先定主线，再开始处理细节。

预期：

- `situation`：上午先写三条重点再开工。
- `improvementTrack`：`repeat_good`
- `stateAssessment`：节奏更稳，没有被消息带跑。
- `repeatCondition`：开工前先定主线。
- `controllableFactor`：开始处理细节前先写重点。
- `nextAttempt`：先定主线再处理细节。
- 正文不能写成问题反省。
- 标题可类似 `开工前定主线`。

### 用例 3：partial 收束

输入：

> 今天沟通有点急，没太听完就回了。别追问了，直接整理吧。

预期：

- 有 `situation` 和 `frictionPoint`，允许 partial。
- 不硬写完整 `nextAttempt`。
- 正文停在“我看见这个地方可以调整”。
- 不能写成“以后我一定要认真倾听”。

### 用例 4：材料不足

输入：

> 今天很糟，我需要改进。别问了。

预期：

- 没有可信 `situation`。
- 不生成日志。
- 进入 `boundary_insufficient`。
- 展示“只补一句 / 换一个片段 / 先退出”。
- “只补一句”只要求补一个具体情境。

## 14. 当前实现状态声明

截至 `2026-05-01`：

- 本文已完成 improvement 的理论对齐开发规格。
- 当前代码已完成结构字段扩展、AI 抽取独立化、fallback 抽取、阶段推进、提问策略、完成标准执行、正文成稿、质量门、fallback draft、标题治理和阶段 8 自动化验收样例。
- 当前代码尚未完成端到端产品验收，文风仍可继续打磨。
- 后续完成端到端验收后，需要再同步 `README.md / docs/architecture.md / docs/integration-guide.md / docs/operator-runbook.md / docs/handoff.md`。
