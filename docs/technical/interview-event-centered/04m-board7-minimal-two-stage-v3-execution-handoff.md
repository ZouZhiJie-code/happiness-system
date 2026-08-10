# 04m｜板块 7 极简两段式 v3 实施交接

最后更新：`2026-08-01`

文档状态：`历史 v3 实施交接与 v70/v70 stop 证据；后续 Provider 候选均已归档`

适用范围：`板块 7｜生成式访谈提问策略与链路改造`

Production 状态：`继续使用 legacy + baseline；入口、模型、配置和生产数据保持原状`

历史承接：本文件保留 Provider v3 的实施事实。后续 Provider v4→v5 规格与失败证据见[04n](./04n-board7-semantic-skeleton-v1-spec.md)；当前产品策略见[04w｜GI-067](./04w-board4-gi067-thought-question-strategy-first-principles.md)。

## 1. 执行结论

当时候选采用同一个模型的极简两段式：

```text
第一段：形成当前可确认的理解，并决定是否需要用户继续补充
→ 系统：映射动作、维护状态、执行客观检查
→ 第二段：把冻结后的理解或提问意图写成用户可见回应
```

本轮的关键修正集中在第一段 Provider 协议：

1. 第一段只输出 `ready / needs_more / limited` 三种状态。
2. 用一张完整的 `understandingCard` 表达当前可确认的理解。
3. 用结构化 `questionIntent` 同时说明“想补清什么”和“用户可以从哪里回答”。
4. 成果来源、认识类型和通用判断说明退出 Provider 必填字段。
5. 系统兼容层继续生成现有状态、Trace 和恢复链路需要的旧字段。
6. 第二段只接收冻结后的最小信息，不能重新理解完整对话，也不能改变问停动作。

这套方案属于板块 7 的待验证 MVP 候选。它已经具备实施条件，真实模型质量门通过前继续保持落地验证阻断。

## 2. 为什么采用这次修正

### 2.1 用户结果只需要三个核心判断

每轮访谈最终只需要回答三个问题：

1. 当前已经能确认什么？
2. 当前材料是否足以形成阶段性成果？
3. 如果仍需提问，用户还需要补充什么，怎样问最容易回答？

现有 v2 第一段同时要求模型判断成果来源、认识分类、必要范围、提问目标、认知动作和通用依据。多个字段在表达同一层语义，模型需要先协调内部标签，再完成用户真正需要的判断。

### 2.2 首轮两段式证明了职责切分的诊断价值

v67 首轮结果已经能区分三类问题：

- 理解小卡正确、表达失败；
- 用户可见表达合理、小卡结构失败；
- 实际内容合理、成果来源标签失败。

这说明“理解判断”和“用户表达”分开运行有价值。当前修复继续保留两段式，并把第一段收缩到更接近用户任务的最小语义。

### 2.3 主要失败来自协议负担

首轮失败暴露出三项共同根因：

- `user_articulated / ai_synthesized` 在边界案例中不稳定，一次标签翻转会使整轮技术失败；
- `main / necessaryScope` 要求模型先判断一句内容属于主体还是限定，准确回应仍可能因分栏差异失败；
- `missingUnderstanding / selectedTargetId / cognitiveAction` 分别描述缺口、目标和问法，三者可能正确指向同一方向，却仍难以直接生成低负担问题。

v3 让每个 Provider 字段都对应一个可验证的产品职责，减少模型内部协调成本。

## 3. 综合合理性评估

| 评估维度 | 结论 | 原因 |
|---|---|---|
| 产品目标一致性 | 高 | 协议直接服务“被准确理解、问题值得回答、形成阶段性认识” |
| MVP 范围 | 高 | 保留同一模型、现有界面、状态和恢复，不引入工具、长期记忆或新数据库 |
| 两段式方向 | 中高 | 历史一次组合调用存在理解、问停与表达相互干扰；首轮两段式已提供可用的分层诊断 |
| v3 协议简化 | 高 | 移除未直接改善用户结果的强制分类，把提问缺口与作答入口合并 |
| 直接全局重写 | 风险高 | 旧字段已进入状态、恢复、Trace、评测与质量卡，直接删除会扩大回归范围 |
| Provider v3 + 兼容适配 | 风险中 | 变更集中在模型边界，现有下游继续读取系统派生的兼容结构 |
| 当前角度策略同步重写 | 暂缓 | 四角度成果上限和问停规则继续有效，本轮需要保持单一归因 |

结论：本次协议修正合理，实施应采用“Provider v3 新协议 + 单一兼容入口”。主会话应避免全局删除旧字段，也应避免同时改写四张角度卡的产品目标。

## 4. 已确认的产品规则

### 4.1 固定决策顺序

```text
处理用户边界和纠正
→ 更新上一问回答状态和本轮事实
→ 形成当前可确认的理解
→ 判断这份理解是否已经达到阶段成果
→ 已达到：ready
→ 未达到：检查是否存在合格的 questionIntent
→ 存在：needs_more
→ 不存在：limited
```

系统映射动作：

| 第一段状态 | 引导复盘 | 深度聊天 |
|---|---|---|
| `ready` | `complete` | `pause` |
| `needs_more` | `ask` | `ask` |
| `limited` | `honest_limit` | `honest_limit` |

### 4.2 `answerStatus` 的单一职责

`answerStatus` 只描述用户本轮回答与上一道问题的关系：

- `answered`
- `partly_answered`
- `unknown`
- `declined`
- `correction`
- `unrelated`

它用于更新已回答、拒绝、纠正和转向状态。成果是否成立、下一轮是否提问继续由 `decision.state` 独立判断。

### 4.3 当前可确认理解

`understandingCard.statement` 是当前回合能够安全确认的一条完整理解：

- 一次只保留一个主意思；
- 限定、对比和并存事实直接写进完整句子；
- 无关的新线索进入 `factDeltas`，留给后续使用；
- 每个事实性分句都有可追溯证据；
- 模型新增关系时，证据覆盖关系两侧；
- 当前事件、用户本人和现有证据构成解释边界。

Provider 运行时无需把成果强制分成 `user_articulated / ai_synthesized`。这项来源可以作为评测标签或 Trace 辅助信息，由评测案例预标或系统后处理，不能阻断正常回合。

### 4.4 提问准入条件

`needs_more` 必须提供一份合格的 `questionIntent`。它同时满足：

1. 当前成果仍缺少一项会改变理解的内容；
2. 这项内容需要用户本人提供；
3. `goal` 是单一、可检验的完成目标；
4. `answerEntry` 指向当前事件里的具体时刻、行为、原话、念头、选择或变化；
5. 问题具有较低回答负担；
6. 已问、已答、已拒绝和重复方向已经退出候选。

稳定目标身份由系统根据 `goal` 生成或复用。用户表示“说不清”后仍愿意继续时，系统保留同一 `goal`，更换 `answerEntry`；同一目标最多使用一次修复入口。

### 4.5 诚实收束

`limited` 表示当前材料无法安全形成阶段性成果，同时也缺少一个具体、低负担且有认识价值的提问入口。

- 有可确认范围时可以保留 `understandingCard`；
- 当前无法形成安全理解时，`understandingCard` 可以为空；
- `limitReason` 必填，用于第二段生成自然收口并记录停止依据。

## 5. Provider v3 最小协议

第一段只输出以下结构：

```text
understanding
- eventBoundary
- coreEventIdentifiable
- answerStatus
- factDeltas
- correctionOrBoundary
- eventOptions

decision
- state：ready / needs_more / limited

understandingCard
- statement
- evidenceRefs

questionIntent
- goal
- answerEntry
- evidenceRefs

limitReason
```

建议的结构约束：

| 状态 | understandingCard | questionIntent | limitReason |
|---|---|---|---|
| `ready` | 必填 | 空 | 空 |
| `needs_more` | 必填 | 必填 | 空 |
| `limited` | 可空 | 空 | 必填 |

通用证据规则：

- 非空 `understandingCard` 至少引用一条有效证据；
- `questionIntent` 至少引用一条能够证明缺口或作答入口的证据；
- 所有引用必须来自当前活动事件的已有事实或本轮新增事实；
- 每个事实性分句都可追溯；
- 一句话连接两侧事实时，引用覆盖两侧；
- 系统检查证据编号是否存在，产品评审判断证据是否充分、关系是否合理。

以下字段退出 Provider v3 必填输出：

- `origin`
- `basis`
- `missingUnderstanding`
- `selectedTargetId`
- `cognitiveAction`
- `insightKind`
- `main / necessaryScope`
- `realizationContract`
- `microgoalDelta`
- `responseCore`

这些字段仍可在系统兼容结构、历史数据读取、评测标注或 Trace 中保留。

## 6. 三层职责边界

### 6.1 第一段：语义判断

第一段负责：

- 识别当前事件边界；
- 判断上一问回答状态；
- 提取本轮新增事实；
- 识别用户纠正、拒绝与停止；
- 形成 `understandingCard`；
- 选择 `ready / needs_more / limited`；
- `needs_more` 时形成 `questionIntent`；
- `limited` 时形成 `limitReason`。

第一段不生成用户可见文案，也不输出候选列表、数字评分或完整思考过程。

### 6.2 系统层：确定性映射与保护

系统负责：

- 把 `state + 当前阶段` 映射为 `ask / complete / pause / honest_limit`；
- 生成或复用稳定目标 ID；
- 维护正式问题计数、修复入口计数和微目标状态；
- 生成现有下游需要的兼容字段；
- 执行用户边界、事实引用、活动分支、次数上限和结构检查；
- 保存语义 checkpoint、两段血缘和实际可见内容；
- 处理重试、恢复和旧产物升级。

### 6.3 第二段：用户表达

第二段只接收：

- 系统映射后的动作；
- 当前角度；
- `understandingCard`；
- 小卡引用的用户原话或事实；
- `ask` 时的 `questionIntent` 和上一道问题；
- `honest_limit` 时的 `limitReason`；
- 纠正场景需要保留的最小信息。

第二段输出：

| 动作 | 用户可见输出 |
|---|---|
| `ask` | 一至两句 `thinkingSummary` + 一个问题 |
| `complete` | 一段自然成果回应 |
| `pause` | 一段自然进展回应 |
| `honest_limit` | 一段自然收束回应 |
| 无法忠实表达 | `cannot_express + reason` |

第二段不能改变状态、动作、角度、理解内容、证据关系和提问目标。它不读取完整历史、全部事实、四张角度卡或第一段候选过程。

## 7. Prompt 结构

### 7.1 第一段 Prompt

采用以下拼装：

```text
共用决策规则
+ 当前模式规则
+ 当前一张角度卡
+ 三个短状态示例
+ 当前回合最小上下文
```

共用规则只保留：

1. 用户边界和纠正优先；
2. `answerStatus` 只描述上一问；
3. 先形成可确认理解，再判断是否达到成果；
4. `needs_more` 必须提供合格的 `questionIntent`；
5. 找不到安全提问入口时选择 `limited`；
6. 当前事件、证据和推断边界；
7. 一次只形成一个理解或一个提问目标；
8. 已问、已答、已拒绝和重复方向退出；
9. 输出结构与证据引用规则。

每个角度和模式只注入三个短例：

- 一个 `ready`；
- 一个 `needs_more`；
- 一个 `limited` 或边界失败例。

示例用于学习状态边界和字段形态。隐藏集故事与正式准入故事不得进入 Prompt。

### 7.2 第二段 Prompt

第二段只说明：

- 冻结内容必须完整保留；
- `ask` 的思路说明当前理解和提问价值，问题提供具体作答入口；
- 停止轮只显示一段回应；
- 表达使用自然、克制的日常中文；
- 用户纠正已经进入冻结小卡时，当前表达采用纠正后的理解；
- 无法忠实表达时返回结构化失败。

## 8. 与现有实现的兼容方案

### 8.1 当前实现事实

当前代码已经具备：

- `event-centered-semantic-plan.v2` 语义产物；
- `meaningCard.main / necessaryScope`；
- `origin / basis / missingUnderstanding / selectedTargetId / cognitiveAction / insightKind`；
- `deriveEventCenteredGenerativePlanFromMeaningCard` 单一兼容映射入口；
- `currentQuestionIntent.targetId / semanticGoal / minimumAnswerScope` 稳定目标状态；
- 第二段单独生成、单独重试和 checkpoint 恢复；
- v1 旧产物重新规划第一段；
- 可靠提交、纠正、轻量检查点、Trace 和 Production 隔离。

### 8.2 推荐迁移方式

新增 Provider v3 协议和 v3 语义产物，保留现有完整回合结构：

```text
Provider v3
→ deriveEventCenteredGenerativePlanFromUnderstandingCard
→ 现有 semanticPlan / 状态 / Trace / 恢复链路
```

主会话应保持一个兼容映射入口，避免把 v3 判断分散到服务、状态、评测和界面多个位置。

建议映射：

| v3 输入 | 现有兼容字段 |
|---|---|
| `decision.state` | `action`、`outcomeAssessment.state` |
| `understandingCard.evidenceRefs` | `evidenceRefs`、`supportEvidenceRefs` |
| `understandingCard.statement` | 完成轮 `expectedUnderstandingDelta`、兼容 `responseCore` |
| `questionIntent.goal` | `missingUnderstanding`、`expectedUnderstandingDelta`、稳定目标来源 |
| `questionIntent.answerEntry` | 第二段提问入口；需要时转换为系统管理的问法表层信息 |
| `limitReason` | `basis`、`stopReason` |
| 系统和评测后处理 | 可选 `origin / insightKind` |
| 系统阶段状态 | `microgoalDelta` |

`cognitiveAction` 在普通新回合中可以为空或由系统兼容生成。用户“说不清”的修复场景继续由系统记录明确的修复入口标记，并保持同一稳定目标。

### 8.3 版本与恢复

建议使用：

- Provider 产物：`event-centered-semantic-plan.v3`；
- 第一段 Prompt：当前 v67 后的下一独立版本；
- 第二段 Prompt：与 v3 输入对应的独立版本；
- 策略版本：在主会话完成代码核对后使用下一版本；
- 角度卡版本：四张卡内容保持不变时继续使用 `2.12.0`；
- Few-shot：示例内容发生变化时再升级版本。

恢复规则：

- v3 checkpoint 已保存第一段结果时，只重跑第二段；
- v1、v2 checkpoint 恢复时，使用可靠保存的用户原话重新运行 v3 第一段；
- 无需数据库迁移；
- 旧产物保持可读，历史结果和裁决保持原样。

## 9. 检查、重试与恢复

### 9.1 客观硬检查

运行时只阻断：

- JSON 结构或状态组合非法；
- 证据编号不存在或来自非活动事件；
- 用户停止、拒绝或纠正未被执行；
- `needs_more` 缺少完整 `questionIntent`；
- `ready` 缺少 `understandingCard`；
- `limited` 缺少 `limitReason`；
- 第二段改变冻结动作或生成多个问题；
- 严重事实反转；
- 人格、创伤、长期模式、他人动机等越界推断；
- 阶段动作或次数上限冲突。

### 9.2 产品质量评审

以下项目进入 Codex 初评、用户裁决和 Preview：

- `understandingCard` 是否完整；
- 限定和并存事实是否保留；
- 问停判断是否合理；
- `questionIntent.goal` 是否真会改变理解；
- `answerEntry` 是否具体、自然、容易回答；
- 思路是否准确展示提问意图；
- 问题是否值得回答；
- 用户可见成果是否自然、忠实、有价值。

有效但质量较差的输出保留为正式失败，不通过运行时重试挑选更好的文案。

### 9.3 技术重试

- 第一段结构或客观硬检查失败：只重试第一段一次；
- 第二段结构失败或返回 `cannot_express`：使用冻结的小卡只重试第二段一次；
- 第二次仍失败：保留用户原话和对应 checkpoint，展示现有“继续生成”入口；
- 已保存 v3 小卡时，恢复只运行第二段；
- 产品质量失败进入评测闭环，不触发自动重试。

## 10. 主会话实施阶段

### 阶段 A｜锁定 v3 契约

主要工作：

- 新增 v3 Provider schema 和跨字段约束；
- 保留 v2 schema 用于历史读取和回归；
- 定义 `understandingCard / questionIntent / limitReason`；
- 增加三种状态组合的单元测试；
- 增加 `answerStatus` 与状态独立的测试。

退出条件：

- 三种状态合法组合全部通过；
- 旧 v1、v2 产物仍可识别；
- Provider v3 不再强制输出已移除字段。

### 阶段 B｜建立独立的第一段 Prompt

主要工作：

- 新建 v3 Prompt builder；
- 直接组装最小输入；
- 只注入当前模式、当前角度和三个短例；
- 停止从一次调用的大型 payload 上做删字段式复用；
- 补齐 Prompt 快照和隐藏故事泄漏测试。

退出条件：

- Prompt 只包含 v3 所需字段；
- 隐藏集和正式准入故事不进入运行时；
- 四角度共用决策顺序一致。

### 阶段 C｜实现唯一兼容适配层

主要工作：

- 新增 v3 到现有完整 `semanticPlan` 的映射；
- 生成或复用稳定目标 ID；
- 系统维护 `microgoalDelta` 和修复入口计数；
- 兼容生成 `origin / insightKind / responseCore / basis` 等旧字段；
- 保持状态、Trace、持久化和恢复接口稳定。

退出条件：

- 下游无需理解 v3 字段；
- `ready / needs_more / limited` 的动作映射正确；
- 同一 `goal` 的换入口保留稳定目标；
- 旧纠正、换问法和恢复测试继续通过。

### 阶段 D｜收缩第二段输入

主要工作：

- 第二段改读 `understandingCard / questionIntent / limitReason`；
- 移除来源分类和认识类型对表达的强制分支；
- 保留 ask 双层展示和停止轮单段展示；
- 保留 `cannot_express` 与第二段单独重试。

退出条件：

- 第二段无法改变动作和目标；
- ask 只生成一个问题；
- complete、pause、honest_limit 只生成一段回应；
- 第二段输入不包含完整历史和无关事实。

### 阶段 E｜评测与报告适配

主要工作：

- 评审第一层展示真实用户可见回应；
- 第二层展示 v3 小卡、问题意图、证据和系统动作；
- 来源分类改为评测案例标注或非阻断诊断；
- 分开统计第一段理解、问停、提问意图和第二段表达失败；
- 保留延迟、token、成本、重试和结果完整率。

退出条件：

- 评测包能分别裁决小卡和用户回应；
- 历史 v67 结果保持原始裁决；
- 新旧协议结果不会混入同一候选版本。

## 11. 离线验证清单

主会话在真实模型运行前完成：

1. `ready / needs_more / limited` 三种分流；
2. `answered + ready`、`answered + needs_more`、`partly_answered + ready` 等独立组合；
3. 完整理解包含限定、并存与对比；
4. 模型连接关系时证据覆盖两侧；
5. `questionIntent.goal` 可作为稳定完成目标；
6. `answerEntry` 更换时目标 ID 保持；
7. 用户说不清后的单次修复入口；
8. 用户拒绝、停止和纠正优先；
9. 第二段无法改变冻结动作；
10. 第二段单一问题和停止轮单段回应；
11. 第一段、第二段分别重试；
12. 两次失败后保留用户原话和恢复入口；
13. v3 checkpoint 只重跑第二段；
14. v1、v2 checkpoint 重新规划第一段；
15. Trace 保留两段版本、证据、状态、动作和可见结果；
16. Production、baseline、公开 API、界面和数据库保持原状。

建议重点覆盖：

- `src/features/interview/event-centered/ai-contract.ts`
- `src/server/services/interview/event-centered-ai.service.ts`
- `src/types/event-centered-dialogue.ts`
- 生成式策略与状态更新模块
- 生成式评测 runtime、runner 和报告生成模块
- 对应的契约、服务、恢复、评测与输入快照测试

## 12. 最小真实模型验证

### 12.1 案例设计

建立六个全新场景：

| 场景 | 重点能力 |
|---|---|
| 感受｜用户已表达理解 | `ready` 与忠实整理 |
| 想法｜仍缺用户判断标准 | `needs_more` 与具体作答入口 |
| 关系｜主意思带并存边界 | 完整 `understandingCard` |
| 行动｜事实之间可安全连接 | 当前事件内证据关系 |
| 纠正｜用户撤回旧理解 | 纠正优先和新小卡 |
| 材料有限｜缺少安全入口 | `limited` 与自然收束 |

这些故事应与 v67 四个案例、现有开发集和正式准入集保持情节隔离。

### 12.2 运行顺序与预算

1. 冻结同一模型、Prompt、协议、示例和参数版本；
2. 六个场景各运行一次；
3. 小卡和用户回应均达到 `6/6` 后，用同一冻结版本再运行一次；
4. 最终要求小卡 `12/12`、用户回应 `12/12`；
5. 事实、边界、强推断和问停严重错误为 `0`；
6. v67 的四个旧场景只做开发回归，不进入正式候选证明。

首次 `6/6` 未通过时：

- 只允许针对一个共同根因修改 Prompt、示例或协议规则中的一项；
- 先运行最多两个受影响案例；
- 定向通过后完整重跑六个场景；
- 第二次完整运行仍未达到 `6/6`，或失败分散为多个无关原因时立即停止模型运行；
- 停止后重新打开对应产品规则，不继续增加场景正则或专用答案。

### 12.3 通过后的正式顺序

1. 建立全新隐藏集，要求全部通过；
2. 工作单轮 `24/24`；
3. 工作轨迹 `4/4`；
4. 硬边界 `24/24`；
5. 准入单轮 `24/24`；
6. 准入轨迹 `4/4`；
7. 新旧链路盲评 `8` 组；
8. 延迟和单回合成本中位数增幅不超过 `50%`；
9. 旧链路 `580/580` 回归；
10. 用户逐条裁决正式单轮和完整轨迹。

板块 7 只有在全部正式门通过后才能标记“产品与落地验证完成”，随后解除板块 8 依赖。

## 13. 停止条件

出现以下任一情况，主会话应暂停新的模型运行和 Prompt 调优：

- 离线契约与恢复测试未通过；
- 首轮失败包含两个以上无关根因；
- 单变量修正后的完整六例仍未全部通过；
- 同一主要质量问题跨两个不同新案例重复；
- 改动需要扩展到新界面、新数据库、工具调用或长期记忆；
- 主会话发现 v3 无法通过单一兼容层接入；
- 为通过案例需要新增业务关键词、场景正则或固定答案；
- 延迟或成本明显越过正式性能边界。

暂停时应保留运行版本、Prompt 哈希、案例指纹、原始模型结果、Codex 初评和用户裁决，不回写历史结果。

## 14. 实施边界

保持：

- `deepseek-v4-flash`；
- thinking 关闭；
- 同一模型的极简两段式；
- 可靠提交、状态、纠正、换问法、轻量检查点和 Trace；
- 第二段单独恢复；
- Production 的 `legacy + baseline`；
- 现有公开 API、数据库和用户界面。

暂停：

- 一次/两次调用 A/B；
- 第三次模型检查；
- 运行时 MCP、Skill 和外部工具；
- 长期记忆检索；
- 更换模型；
- 全局删除旧协议字段；
- 四张角度卡成果目标的同步重写；
- 面向少数旧案例的语义正则和固定答案。

## 15. 主会话接管要求

主会话收到本文件后按以下顺序推进：

1. 对照当前工作树核验本文的实现事实；
2. 输出逐文件差异清单，标明复用、替换、兼容和暂缓项；
3. 锁定 v3 Provider schema、兼容映射和第二段输入边界；
4. 分阶段实施，每个阶段先完成离线验证；
5. 自动测试全部通过后生成六例确认包；
6. 确认案例情节隔离和运行预算后再调用真实模型；
7. 严格执行单变量修正与停止条件；
8. 达到小门后再建立隐藏集；
9. 全部正式门通过后更新总 Map、板块 4、板块 6、板块 7专项文档和相关决策记录；
10. Production 全程保持原状。

若代码事实与本文存在实质冲突，主会话应提供具体代码证据，并优先采用更小的兼容改动。涉及产品行为变化时回到产品讨论确认。

## 16. 与当前决策记录的差异及回填要求

当前总 Map 和 04k 仍记录 v2 首轮停止状态。主会话完成代码核验后，应按下表更新对应结论：

| 决策 | 当前记录 | v3 修正方向 |
|---|---|---|
| `GI-009` | 极简两段式 v2 候选首轮失败 | 保留两段式职责切分，候选协议升级为 v3；一次组合调用继续作为历史失败基线 |
| `GI-039` | 用户成果、AI 综合、ask 三项分流 | Provider 统一判断当前理解是否达到成果；`questionIntent` 成为 ask 的准入证明；成果来源退出运行时硬分流 |
| `GI-040` | AI 综合固定要求两条证据，并强制记录来源 | 改为事实性分句全部可追溯；新增关系时证据覆盖关系两侧；来源继续作为评测辅助标签 |
| `GI-041` | `meaningCard.main / necessaryScope` 与 v2 字段 | 升级为 `understandingCard + questionIntent + limitReason` 的 Provider v3；完整下游协议由系统适配 |
| `GI-042` | 来源、必要范围和固定证据数参与部分结构检查 | 客观检查只保留结构、引用、边界、动作和严重错误；来源充分性、限定完整性和认识价值进入质量评审 |
| `GI-045` | 四个全新场景 × 2，首轮已停止 | 采用六个全新场景的分段运行门；先 `6/6`，冻结版本复跑后要求双层 `12/12`；只允许一次共同根因修正 |

板块影响：

- 板块 4：四角度成果目标与 AI 综合上限继续有效；成果来源改为非阻断标签后需要复核文字口径。
- 板块 6：质量评审继续区分“忠实整理”和“AI 新增关系”两类案例，运行时无需依赖模型自报来源。
- 板块 7：v3 实施和全部质量门继续阻断完成状态。
- 板块 8：等待板块 7 的隐藏集、工作集、准入、轨迹、盲评和性能门。

历史 v67 报告、裁决和失败原因继续保持原样。新规则只用于 v3 新候选，不回写历史通过率。

## 17. 当前状态

- 产品方案：`Provider v3 保留为历史实现；GI-047 已冻结 Provider v4 语义骨架规则`
- 技术状态：`v70/v70 两例技术、状态和动作均为 2/2；Provider v4 待实现`
- 落地验证：`v70/v70 第一段语义与 root visible 回应均为 0/2，gate=fail / stop；Provider v4 当前模型调用 0 次`
- 板块 8：`阻断`
- Production：`保持 legacy + baseline`
- 下一步：`按 04n 完成 Provider v4、artifact v4、单一适配层和离线验证；新的确认包与独立授权前，隐藏集、工作集和模型调用继续阻断`

终局批次使用数据集 `2026-08-01.board7-provider-v70-root-visible-probe-v1`，案例指纹 `59e5d4e55b1bc16e163dcb5ae8a2c74518c73df9cf372a8a77ca0fb597dd9414`，批准卡指纹 `e4e4c7bbdab7d4c88a5257d92b1008487ffbb13efb4295177f3d03a0e2e7c94f`；两例各运行一次，共完成 `1` 次只读预检与 `4` 次生成请求。想法案例为 `fail / fail`（`answer_entry_burden / question_value`），行动边界案例为 `borderline / borderline`（`understanding_incomplete`，按失败计），严重错误 `0`。两例累计耗时 `9,640ms`、估算成本 `0.0012035688`，预算一批已耗尽，终局评审包指纹为 `eb347dd807f3d4d452f0c46454e270f4933c20cd8355fbef7946107b2ba70ac0`。历史 v69、v63 及更早结果继续保留。

证据：终局运行报告（本机历史证据，公开精简包未收录：`provider-v70-root-visible-probe-run-1-report.md`）、终局结构化结果（本机历史证据，公开精简包未收录：`provider-v70-root-visible-probe-run-1.json`）、独立预算账本（本机历史证据，公开精简包未收录：`board7-provider-v70-root-visible-probe-budget.json`）。

## 18. 参考材料

- [生成式访谈重构总 Map](../../generative-interview-refactor-map.md)
- [04k｜板块 7 生成式提问策略与链路改造](./04k-generative-question-strategy-implementation.md)
- [04l｜板块 7 MVP 质量修复执行交接](./04l-board7-mvp-quality-repair-handoff.md)
- [04n｜板块 7 Provider v4 语义骨架 v1 规格](./04n-board7-semantic-skeleton-v1-spec.md)
- `src/features/interview/event-centered/ai-contract.ts`
- `src/server/services/interview/event-centered-ai.service.ts`
- `src/types/event-centered-dialogue.ts`
