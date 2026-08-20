# 04n｜板块 7 Provider v4→v5 语义骨架规格

最后更新：`2026-08-05`

文档状态：`历史 v72/v5 语义骨架规格与停止证据；04o 与后续候选同样归入历史`

历史决策状态：`GI-047 两段职责保留、第一段质量规则重新打开；GI-048 实现保留；GI-049 已停止 v72 后续运行`

历史落地状态：`v72 六例首轮已完成并失败：语义 3/6、回应 0/6、技术 0/6；该结果保留为历史证据`

归档后续交接：`GI-067 / GI-068～074 已冻结；后续进入板块 5，板块 6 负责评测资产化，板块 7 等待板块 5～6，板块 8 等待新候选`

Production 状态：`继续使用 legacy + baseline；入口、模型、配置、接口和数据保持原状`

## 0. 历史生效的 v5 最小修订

v71 首轮证明语义骨架方向仍然有效，同时暴露两项协议责任放置问题：成果归属只能由看过用户原话的第一段可靠判断；第二段已经生成完整 `response` 时，额外成功标签会制造同义词误杀。v5 只修订这两处，后续章节中的 Provider v4 内容继续保留为历史设计和兼容依据。

当前第一段根级结构：

```json
{
  "understanding": {},
  "decision": {
    "state": "needs_more | ready | limited",
    "origin": "user_articulated | ai_synthesized | null"
  },
  "semanticFrame": null,
  "questionIntent": null,
  "limitReason": null
}
```

`ready` 必须明确成果归属；`needs_more / limited` 的 `origin` 固定为空。系统直接透传第一段结果，不再根据 `answerStatus`、单元数量或 relation 结构推测来源。`ai_synthesized` 需要一条安全关系，关系两侧都要有可追溯证据；`user_articulated` 要求成果关系能在用户原话中找到。

当前第二段根级结构：

```json
{
  "thinkingSummary": null,
  "response": "最终用户回应",
  "cannotExpressReason": null
}
```

提问轮填写 `thinkingSummary + response`；完成、暂停和诚实收束只填写 `response`。无法忠实表达时填写 `cannotExpressReason`，同时把另外两项置空。系统已经拥有冻结动作，会把 `response` 确定性映射为问题、成果或诚实收束。未知额外元数据直接丢弃，成功标签退出协议。

历史候选血缘：策略 `5.50.0`、semantic Prompt `2026-08-02.event-centered-generative-v72-semantic-origin`、visible Prompt `2026-08-02.event-centered-generative-v72-visible-response`、Few-shot `quality-patterns.2026-08-02.v29`、角度卡 `2.12.0`、artifact `event-centered-semantic-plan.v5`。数据库、界面和公开 API 保持兼容。

## 1. Provider v4 历史背景｜为什么需要升级到语义骨架

v70/v70 终局批次证明了两段链路可以稳定执行：两例的技术完整、语义状态和系统动作均为 `2/2`，严重错误为 `0`。同一批次的第一段语义和最终用户可见回应均为 `0/2`，gate 为 `fail / stop`。失败集中在第一段已经写成自然句，第二段只能沿用或轻度改写这句话，第一段文案质量因此直接限制了最终体验。

两例提供了清楚证据：

1. `V70-RV-T-ASK-01-R1` 的第一段把作答入口写成“最后一遍听到第二段时，你心里先冒出来的那个感觉是什么？”。这句话已经形成完整问题，第二段继续输出同一句，用户仍需回答抽象感受，第一段和用户回应分别因 `answer_entry_burden / question_value` 失败。
2. `V70-RV-A-BOUNDARY-01-R1` 的源证据包含“把常用香料移到手边”和“炒菜时伸手就能拿到”。第一段自然句只保留了后者，把主动调整压缩成“几罐香料在手边”；第二段沿用这份压缩，第一段和用户回应均因 `understanding_incomplete` 获得 `borderline`，按失败计算。

这两例共同说明：第一段同时承担语义判断和自然表达时，表达选择会提前固化提问负担，也会压缩关键证据。下一候选需要让第一段专注可核验判断，把完整问题和成果文案统一交给第二段首次生成。

历史 v70/v70 终局结果继续有效：数据集 `2026-08-01.board7-provider-v70-root-visible-probe-v1`，案例指纹 `59e5d4e55b1bc16e163dcb5ae8a2c74518c73df9cf372a8a77ca0fb597dd9414`，评审包指纹 `eb347dd807f3d4d452f0c46454e270f4933c20cd8355fbef7946107b2ba70ac0`，gate=`fail / stop`，唯一预算批次已耗尽。

## 2. Provider v4 原冻结结论｜由第 0 节 v5 最小修订继续承接

Provider v4 采用以下职责边界：

```text
第一段：读取当前事件证据，输出可核验语义骨架
→ 系统：校验引用、冻结状态、映射动作并建立唯一兼容视图
→ 第二段：读取骨架与骨架引用的源证据，首次生成完整用户文案
→ 系统：执行客观检查、保存 Trace 与恢复产物
```

产品规则：

1. 第一段彻底退出用户可见自然句创作。`understanding` 继续复用现有事实抽取协议；新增的语义骨架只保存证据引用、枚举、状态和结构关系。
2. 第一段输出固定为 `understanding`、`decision.state`、`semanticFrame`、`questionIntent`、`limitReason`。
3. `semanticFrame` 最多包含 `3` 个无自然句的证据单元和 `1` 条关系。
4. `questionIntent` 只记录内部 gap 短语和可追溯的 `answerSource`，不生成问题句、作答入口句或思路文案。
5. `limitReason` 使用内部枚举对象，并保留支持该判断的证据引用。
6. 第二段只读取冻结骨架与骨架引用的源证据，独占 `thinkingSummary / question / insight / honestLimit` 的自然语言生成权。
7. 第一段完成后，系统单一适配层立即根据骨架与源证据确定性派生旧 `understandingCard / questionIntent / semanticPlan / Trace` 字段。兼容文本只服务内部状态与恢复，不作为用户文案；第二段严禁读取兼容半成品。

## 3. Provider v4 历史最小输出协议

### 3.1 根级结构

```json
{
  "understanding": {},
  "decision": {
    "state": "needs_more | ready | limited"
  },
  "semanticFrame": null,
  "questionIntent": null,
  "limitReason": null
}
```

根级只允许以上五项职责。`decision` 只保留 `state`，成果来源、认识类型、自然理解句、问题句和收束句均不进入第一段输出。

### 3.2 understanding｜事实判断与边界

`understanding` 原样复用现有 `eventCenteredTwoStageUnderstandingSchema`，本轮不改字段名、字段结构或枚举：

```json
{
  "eventBoundary": "current_event",
  "coreEventIdentifiable": true,
  "answerStatus": "answered",
  "factDeltas": [
    {
      "statement": "用户提供的当前事件事实",
      "scope": "current_event",
      "stance": "affirmed",
      "kind": "event_detail",
      "quote": "可逐字核对的用户原话"
    }
  ],
  "correctionOrBoundary": null,
  "eventOptions": []
}
```

约束：

- `eventBoundary` 继续使用 `current_event / background / another_event / multiple_events / unclear`。
- `answerStatus` 继续使用 `answered / partly_answered / unknown / declined / correction / unrelated`。
- `factDeltas` 最多 `6` 条，每条继续使用 `statement / scope / stance / kind / quote`；`scope`、`stance` 和 `kind` 均沿用现有枚举。
- `correctionOrBoundary` 继续使用 `{kind: correction | boundary, reason}` 或 `null`。
- `eventOptions` 继续使用最多 `2` 个 `{label, sourceText}`。
- `tentativeInterpretation` 继续由系统管理，不进入第一段 Provider 输出。
- 现有事实边界、纠正、拒绝、停止和安全规则继续生效。

### 3.3 semanticFrame｜最多三个证据单元和一条关系

```json
{
  "units": [
    {
      "id": "u1",
      "role": "change",
      "evidenceRefs": ["new:1"]
    },
    {
      "id": "u2",
      "role": "result",
      "evidenceRefs": ["new:2", "new:3"]
    }
  ],
  "relation": {
    "type": "change_effect",
    "fromUnitId": "u1",
    "toUnitId": "u2"
  }
}
```

最小规则：

- `units` 数量为 `1–3`；每个 unit 只包含 `id / role / evidenceRefs`。
- `id` 只能使用 `u1 / u2 / u3`，且同一骨架内唯一。
- `role` 只能使用 `event / change / result / experience / judgment / reason / meaning / scope`。
- 每个 unit 的 `evidenceRefs` 为 `1–6` 条唯一有效引用，不存在单数 `evidenceRef` 字段。
- 一个 unit 时 `relation` 必须为 `null`；两个或三个 unit 时必须且只能提供一条 `relation`。
- `relation.type` 只能使用 `sequence / contrast / condition / change_effect / coexistence / user_stated_reason`；关系端点必须存在且不同。
- `change_effect` 强制从 `change` unit 指向 `result` unit；`user_stated_reason` 只用于用户明确说出的原因。
- 每个单元和关系两侧都必须有可追溯证据；第一段不解释关系含义。

### 3.4 questionIntent｜内部缺口与作答来源

```json
{
  "gap": "choice_criterion",
  "answerSource": {
    "kind": "direct_comparison",
    "evidenceRefs": ["new:1", "new:2"],
    "anchorQuote": "用户原话中的逐字片段"
  }
}
```

约束：

- `gap` 是 `4–120` 字的内部短语，只表达当前缺口；它不包含问号、第二人称动作叙述、完整问题或预写问题。
- `answerSource.kind` 只能使用 `sensory_detail / observable_action / exact_words / mental_image / change_moment / direct_comparison`。
- `answerSource.evidenceRefs` 必须包含 `1–2` 条唯一有效引用。
- `anchorQuote` 必填，且必须能在 `evidenceRefs` 指向的源证据中逐字追溯；它不能改写成问题、回答提示或候选答案。
- `needs_more` 必须提供完整 `questionIntent`；`ready / limited` 的 `questionIntent` 固定为 `null`。
- 第二段依据 gap、来源类型和对应原始证据生成一个具体、低负担问题。第一段不预写 `goal / answerEntry / question` 自然句。

### 3.5 limitReason｜内部枚举对象

```json
{
  "kind": "no_safe_question",
  "evidenceRefs": ["new:1"]
}
```

`limitReason.kind` 只能使用 `insufficient_evidence / no_safe_question / user_boundary`；`evidenceRefs` 包含 `0–3` 条唯一有效引用。`limited` 必须提供 `limitReason`，`needs_more / ready` 的 `limitReason` 固定为 `null`。自然收束说明由第二段生成。

### 3.6 状态组合

| `decision.state` | `semanticFrame` | `questionIntent` | `limitReason` | 系统动作 |
|---|---|---|---|---|
| `needs_more` | 必填 | 必填 | `null` | `ask` |
| `ready` | 必填 | `null` | `null` | 引导复盘 `complete`；深度聊天 `pause` |
| `limited` | 可为空 | `null` | 必填 | `honest_limit` |

## 4. 第二段独占用户文案

第二段输入由系统从第一段产物生成，只包含：

- `semanticFrame / questionIntent / limitReason`；
- 上述骨架实际引用的 `sourceEvidence` 原文；每项只包含 `ref / sourceText`。

完整历史、第一段 `understanding`、旧 `understandingCard`、旧 `questionIntent`、旧 `semanticPlan`、Few-shot 隐藏判尺和预写用户文案均不进入第二段。缺少逐字 `quote` 的旧事实不进入 v4 可引用证据集合。第二段不能改变状态、系统动作、证据引用、unit、role、relation、gap、answerSource 或 limitReason。

第二段根级只输出：

```json
{
  "status": "ok",
  "thinkingSummary": null,
  "question": null,
  "insight": null,
  "honestLimit": null
}
```

状态组合：

| 第一段状态 | 第二段用户可见职责 |
|---|---|
| `needs_more` | 生成一至两句 `thinkingSummary` 和一个完整 `question` |
| `ready` | 生成一段完整 `insight`，`thinkingSummary / question / honestLimit` 为空 |
| `limited` | 生成一段完整 `honestLimit`，`thinkingSummary / question / insight` 为空 |

自然语言第一次出现在第二段。`thinkingSummary`、问题、成果和诚实收束继续遵守第二人称或中性表达、事实保真、单一问题、低回答负担和 AI 综合上限。

## 5. 单一适配层与兼容边界

第一段通过客观校验后，系统立即调用唯一 v4 适配入口。适配层只读取第一段骨架与源证据，确定性生成现有状态、恢复、质量评测和 Trace 所需兼容字段；第二段尚未执行，也不参与兼容字段派生。

| v4 来源 | 旧字段 / 下游职责 | 映射规则 |
|---|---|---|
| `decision.state` | `action / outcomeState` | 使用现有确定性映射 |
| `semanticFrame.units + sourceEvidence` | 旧 `understandingCard.statement / evidenceRefs / supportEvidenceRefs` | 按 unit 与 relation 确定性拼接内部兼容文本，并汇总引用；兼容文本不进入用户界面 |
| `questionIntent.gap` | 旧 `questionIntent.goal / missingUnderstanding` | 保留内部 gap 标识或既有稳定映射，不扩写自然句 |
| `questionIntent.answerSource` | 旧 `questionIntent.answerEntry / evidenceRefs`、稳定目标来源与 Trace | 根据 `kind + anchorQuote` 确定性形成内部兼容入口，并保存证据引用；兼容入口不作为用户问题 |
| `limitReason.kind + evidenceRefs` | 旧收束原因与 Trace | 按枚举确定性映射内部兼容原因并保留引用 |
| 完整第一段 v4 产物 | `semanticPlan / Trace` | 保存状态、骨架、引用、校验和第一段血缘 |

适配层只承担确定性字段投影和兼容读取。新语义判断来自第一段，新用户文案来自第二段；第二段严禁读取适配层生成的 `understandingCard.statement / questionIntent.answerEntry / semanticPlan`，旧字段也不能反向覆盖 v4 骨架。第二段完成后，系统只把最终可见内容及第二段血缘追加到 Trace。

## 6. 产物版本、恢复与迁移

1. 新语义产物版本升级为 `event-centered-semantic-plan.v4`。
2. v4 第一段成功后保存可恢复 checkpoint；第二段技术失败时可以使用同一 v4 checkpoint 只重跑第二段。
3. 旧 `event-centered-semantic-plan.v3` 恢复时重新运行第一段，生成新的 v4 骨架后再进入第二段；v3 自然句不能直接升级成 v4 `semanticFrame`。
4. v1 / v2 / v3 checkpoint 统一重跑 v4 第一段，成功形成 `event-centered-semantic-plan.v4` 后再进入第二段。
5. 本候选无需数据库迁移、界面迁移或对外 API 迁移。状态 JSON 继续承载版本化产物，用户界面仍展示现有 `thinkingSummary / question / insight / honestLimit`。
6. Production 继续运行 `legacy + baseline`，生成式入口保持关闭。

## 7. 最终候选版本与血缘

| 项目 | Provider v4 最终离线候选 |
|---|---|
| 策略版本 | `5.49.0` |
| 第一段 semantic Prompt | `2026-08-01.event-centered-generative-v71-semantic-skeleton` |
| 第二段 visible Prompt | `2026-08-01.event-centered-generative-v71-visible` |
| Few-shot | `quality-patterns.2026-08-01.v28` |
| 角度卡 | `2.12.0` |
| 语义产物 | `event-centered-semantic-plan.v4` |

角度卡继续保持 `2.12.0`，确保本轮只验证职责切分与语义骨架。v70/v70、Provider v3 和更早版本继续作为历史证据，不回写原版本、运行结果或裁决。

## 8. 实施顺序

### 阶段 A｜协议与校验

- 建立 Provider v4 schema、根级白名单和状态组合校验。
- 建立无自然句校验：`semanticFrame / questionIntent / limitReason` 禁止出现用户文案字段与完整问句。
- 建立 `1–3` 个 units、`2+` units 强制 relation、`change_effect` 的 `change → result`、关系双侧引用、answerSource `anchorQuote` 逐字可追溯和 limitReason 枚举校验。

### 阶段 B｜单一适配与恢复

- 建立第一段后立即执行的 v4 到旧 `understandingCard / questionIntent / semanticPlan / Trace` 唯一确定性映射，并验证第二段输入不包含兼容半成品。
- 升级 checkpoint 到 artifact v4。
- 覆盖 v4 第二段恢复、v3 重新运行第一段和旧产物安全升级。

### 阶段 C｜两段 Prompt 与 Few-shot

- 第一段示例中的 `understanding` 继续使用现有事实抽取结构；`semanticFrame / questionIntent / limitReason` 只展示证据引用、枚举和关系结构，不包含用户可见理解句、问题句或成果句。
- 第二段示例首次展示完整 `thinkingSummary / question / insight / honestLimit`。
- v70 两例只用于离线回归和判尺，不进入新 Prompt、Few-shot 或新模型确认包的故事内容。

### 阶段 D｜离线验证与确认门

- 完成契约、状态、兼容、恢复、Trace、旧链路和无故事泄漏检查。
- 用 v70 两例验证骨架能够保留“选择判断缺口”和“把香料移到手边 → 伸手可拿”双侧证据，验证过程不调用模型。
- 建立全新案例确认包、预算账本和人工裁决模板。
- 产品负责人确认新包并提供独立运行授权后，才允许进行下一次模型调用。

## 9. 质量评测与停止门

Provider v4 继续使用双层人工判尺，并把职责分界更新为：

1. 第一层评审语义骨架：状态是否正确、关键证据是否完整、`2+` units 是否提供有效 relation、`change_effect` 方向是否正确、gap 是否必要、answerSource 的 `kind / evidenceRefs / anchorQuote` 是否具体且逐字可追溯，以及边界与收束原因是否正确。
2. 第二层评审用户回应：第二段是否忠实使用骨架与源证据，问题是否值得回答，成果是否完整自然，回答负担、人称、事实和边界是否合格。

技术完整率与两层产品通过率继续分开统计；`borderline` 按失败计算。v70/v70 的 `0/2` 继续作为历史 stop 证据，不能由新规格覆盖。

v72 六例首轮已经完成。第一段技术 `6/6`、严格语义 `3/6`；第二段 `12/12` 请求因结构化输出合同缺口失败，用户回应与技术完整均为 `0/6`。隐藏集、工作集、正式准入和板块 8继续阻断；第一段产品规则与结构化输出基础合同重新冻结前，不恢复定向模型验证。

## 10. 产品决策记录

### 决策 GI-047｜第一段只输出可核验语义骨架，第二段首次生成完整文案

- 所属板块：4、6、7、8
- 状态与置信度：两段职责和骨架形态保留；第一段质量规则重新打开；中
- 最终结论：第一段退出用户可见自然句创作，输出 `understanding / decision.state / decision.origin / semanticFrame / questionIntent / limitReason`。`semanticFrame.units` 使用 `1–3` 个无自然句单元，`2+` units 必须提供一条受控 relation；`questionIntent` 只保留内部 gap 和可追溯 answerSource；`limitReason` 使用内部枚举与证据引用。系统从骨架与源证据派生内部兼容字段。第二段只读冻结的来源、骨架、提问意图、停止原因与源证据，以统一 `response` 首次生成完整用户文案。
- 选择原因：v70 两例的技术、状态和动作均正确，第一段自然句分别固化了抽象问题入口和压缩后的成果内容，第二段沿用后造成双层质量 `0/2`。语义骨架保留可核验判断和证据覆盖，把完整表达集中到一个生成阶段，可以减少重复文案决策并让失败层级更清楚。
- 适用范围：四角度引导复盘与深度聊天的正常内容轮；现有用户边界、安全、纠正、可靠提交、轻量检查点、状态、Trace 和 Production 隔离继续有效。
- 依据与案例：`V70-RV-T-ASK-01-R1` 的“心里先冒出来的感觉”在第一段已经形成抽象问题，双层分别因 `answer_entry_burden / question_value` 失败；`V70-RV-A-BOUNDARY-01-R1` 未明确保留“把常用香料移到手边”这一行动侧，双层均因 `understanding_incomplete` 获得 `borderline` 并按失败计。v70/v70 技术、语义状态和系统动作 `2/2`、第一段语义与用户回应 `0/2`、严重错误 `0`，gate=`fail / stop`。
- 影响板块：板块 4重新打开显式关系归属、纠正优先级与必要证据覆盖；板块 6双层判尺继续有效；板块 7和板块 8继续阻断。
- 专项文档：本文、[04j｜生成式质量评测 v1](./04j-generative-quality-evaluation-v1.md)、[04k｜板块 7 生成式提问策略与链路改造](./04k-generative-question-strategy-implementation.md)、[04m｜极简两段式 v3 实施交接](./04m-board7-minimal-two-stage-v3-execution-handoff.md)
- 确认日期：`2026-08-01`

### 决策 GI-048｜成果归属与表达成功采用最小充分协议

- 所属板块：4、6、7、8
- 状态与置信度：最小协议实现保留；中高；真实验证失败
- 最终结论：第一段在 `ready` 时直接输出 `origin`，系统停止依据骨架形态猜测来源。第二段以 `response` 交付最终内容；能够表达时不再填写成功标签，无法忠实表达时填写 `cannotExpressReason`。系统根据冻结动作映射用户可见字段。
- 选择原因：成果归属必须对照用户原话，第一段拥有必要上下文；完整内容本身已经证明表达成功，额外标签只会增加无产品价值的协议失败点。
- 适用范围：Provider v5 正常内容轮、checkpoint、状态、Trace、离线评测和后续 Preview。历史产物继续按原版本只读追溯。
- 依据与案例：v71 感受案例的用户成果被系统结构推测误标；同案第二段两条完整自然回应因 `expressible` 同义状态被拒绝。v72 感受和关系用户成果来源正确，行动案例仍误标来源；第二段六例受统一 JSON 请求合同缺口阻断。
- 影响板块：板块 4 成果来源、板块 6 双层判尺、板块 7 协议与恢复、板块 8 准入。
- 专项文档：本文、[04j｜生成式质量评测 v1](./04j-generative-quality-evaluation-v1.md)、[04k｜生成式提问策略与链路改造](./04k-generative-question-strategy-implementation.md)
- 确认日期：`2026-08-02`

### 决策 GI-049｜v72 六例首轮失败后停止并重开第一段质量规则

- 所属板块：4、6、7、8
- 状态与置信度：已执行；高
- 最终结论：v72 不进入隐藏集、工作集、准入或板块 8。结构化输出层补齐 JSON 请求合同，第一段重新冻结显式关系归属、纠正优先级和必要证据覆盖；多个产品原因收敛前停止模型运行和 Prompt 调优。
- 选择原因：第一段技术 `6/6`、严格语义 `3/6`；第二段十二次请求全部被供应商拒绝。格式修复只能恢复表达请求，无法修复行动来源、纠正和材料范围三项产品失败。
- 适用范围：v72 候选、下一份定向候选、结构化输出基础设施和板块 8依赖门。
- 依据与案例：`SF4-A-EFFECT-01 / SF4-CORRECTION-READY-01 / SF4-LIMITED-01` 三类语义失败，以及六例统一 `Prompt must contain the word 'json'` 技术失败。
- 影响板块：板块 4部分重开；板块 6保留双层判尺；板块 7与板块 8继续阻断。
- 专项文档：本文、[04j｜生成式质量评测 v1](./04j-generative-quality-evaluation-v1.md)、[04k｜生成式提问策略与链路改造](./04k-generative-question-strategy-implementation.md)、[Codex 双层验收](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-v2-codex-review.md)
- 确认日期：`2026-08-02`

## 11. v72 停止时的状态与下一步（历史记录）

以下状态对应 v72 停止时点。后续候选交付和职责已经由 GI-067 / GI-068～074 及当前总 Map 接管。

- 产品规则：两段职责和最小传输协议继续保留；第一段来源与必要内容规则重新打开。
- 板块 4：语义骨架与成果来源投影复核完成；既有成果上限、问停顺序与具体低负担入口标准继续有效，真实质量证据等待板块 7 模型门。
- 板块 6：双层判尺、成果来源判尺与 runner 适配完成；v70/v70 与 v71 结论继续作为只读历史证据，真实质量证据等待板块 7 模型门。
- 板块 7：v72 六例已完成并触发 `GI-049 fail / stop`；新的模型运行、隐藏集和正式质量门继续关闭。
- 板块 8：继续阻断。
- 模型调用：v72 正式首轮使用 `1` 次预检和 `18` 次生成请求；账本已完成并封存。
- Production：保持 `legacy + baseline`。

下一步先修复结构化输出基础合同，并重新讨论显式关系归属、纠正优先级与必要证据覆盖。形成新候选、案例指纹和独立授权后，才能恢复定向模型验证。

## 12. 2026-08-01 Provider v4 离线实施结果

最终离线候选固定为策略 `5.49.0`、semantic Prompt `2026-08-01.event-centered-generative-v71-semantic-skeleton`、visible Prompt `2026-08-01.event-centered-generative-v71-visible`、Few-shot `quality-patterns.2026-08-01.v28`、角度卡 `2.12.0` 与语义产物 `event-centered-semantic-plan.v4`。

实现收口包含：第二段每条 `sourceEvidence` 只保留 `ref / sourceText`；缺少逐字 `quote` 的旧事实不可引用；v1 / v2 / v3 checkpoint 统一重跑第一段升级到 v4；同一目标复用来源必须同时满足 `decision.state` 与 `questionIntent.gap` 一致；兼容 `origin` 解除 `answerStatus` 绑定并仅作为旧 schema 标签；v64、v65 与 `GI-009` 血缘只读隔离，不参与当时候选派生、恢复或质量计数。

板块 4 语义骨架投影复核、板块 6 双层判尺与 runner 适配已经完成。六例矩阵覆盖四角度、纠正与材料有限；确认包路径为 [semantic-frame-v4-offline-case-confirmation.md](../../../artifacts/generative-interview-board7/2026-08-01/semantic-frame-v4-offline-case-confirmation.md)，案例指纹为 `ae2c1e801cd121a3372dec9bb8ae52d0897dc3b0d430c91d69b8ddf0c4203f62`。运行策略为 `modelRunAllowed=false`，本轮预算 `0`、模型调用 `0`。

离线验证结果：事件中心 unit `30` 个测试文件、`622` 个用例通过；生成式 eval `6` 个测试文件、`56` 个用例通过；TypeScript 类型检查通过；ESLint `0 error / 4 existing warnings`；差异格式检查通过。该结果确认协议、适配、恢复和离线评测链路可用；真实模型与正式质量门仍待验证，板块 7 与板块 8 继续阻断，Production 保持 `legacy + baseline`。

## 13. 2026-08-01 v71 首轮六例运行授权门

六例已经完成产品确认，数据集为 `evals/event-centered-generative/board7-semantic-frame-v4-offline-confirmation-v1.json`，案例指纹为 `ae2c1e801cd121a3372dec9bb8ae52d0897dc3b0d430c91d69b8ddf0c4203f62`。首轮[运行授权卡](../../../artifacts/generative-interview-board7/2026-08-01/board7-provider-v71-semantic-frame-first-pass-approval.md)在该历史时点为 `pending`，模型调用 `0`。

[pending 预算账本](../../../artifacts/generative-interview-board7/2026-08-01/board7-provider-v71-semantic-frame-first-pass-budget.json)已经生成，scopeFingerprint 为 `960eae47ec6b0026e44fed960520fc92b3cc6c6faf22f4aceae778140c28ed98`；程序化护栏拒绝未授权运行，`v71 live` 入口保持关闭，模型调用 `0`。

运行参数固定为 `two_call / deepseek-v4-flash / temperature 0.2 / max tokens 1500 / timeout 12s / thinking off`。六例对应 `12` 次名义生成请求，技术极限为 `24` 次；最多 `1` 次 `/models` 只读预检单列。有效但低质量的结果不重试，首轮六例结束即停；失败后归因并重新审批，成功后也只生成下一轮独立预算。

用户另行明确授权前，真实模型、正式质量门、板块 7 与板块 8 继续阻断。Production 保持 `legacy + baseline`。

## 14. 2026-08-02 首轮六例实际运行与停止

用户已授权首轮六例。运行先完成 `1` 次只读预检，随后在 `SF4-F-READY-01` 运行第一段与第二段两次技术尝试，共 `3` 次生成请求。第一段返回可追溯的 `ready → complete` 语义骨架；第二段两次均使用顶层 `status=expressible`，而既定结构只接收 `ok` 或 `cannot_express`，因此被判为 `INVALID_SCHEMA` 并中止整轮。余下 `5` 例未运行。

首轮报告见 [2026-08-02 运行报告](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v71-semantic-frame-first-pass-report.md)，账本见 [终局预算记录](../../../artifacts/generative-interview-board7/2026-08-01/board7-provider-v71-semantic-frame-first-pass-budget.json)。第二段 Prompt 已在离线层明确成功状态必须是 `ok`，后续模型运行仍需新的确认包与独立授权。该运行还发现用户已经说清“松快”的场景被兼容层标为 `ai_synthesized`，成果来源判定进入板块 4、6、7复核。板块 8继续等待，Production 保持 `legacy + baseline`。

## 15. 2026-08-02 v72 根因修复与新授权门

首轮两项信号已经完成源头修复：

1. 第一段协议增加 `decision.origin`。第一段直接区分用户已经说出的关系与 AI 新连接的关系；系统兼容层只做透传和字段映射。`answerStatus` 继续单独描述上一问回答情况。
2. 第二段删除 `status / question / insight / honestLimit` 等重复职责，只保留 `thinkingSummary / response / cannotExpressReason`。系统依据冻结动作解释 `response`，成功由内容本身成立。
3. 两条封存的 `status=expressible` 原始成果句已完成离线回放，均被归一为合法 `response`。历史原文、失败裁决和账本保持原样。
4. artifact 升级为 v5，并在 checkpoint 中保存 `decisionOrigin`。v5 checkpoint 恢复只重跑第二段；旧 v1–v4 checkpoint 忽略旧语义计划，使用已可靠保存的用户原话重跑第一段。
5. Trace 继续保存第一段成果归属、语义骨架、证据、两段尝试、用户最终看到的内容和失败原因；完整内部推理不进入记录。

新的六例开发冒烟集沿用感受、想法、关系、纠正和材料有限故事，并调整行动故事，使用户只提供“横排三页乐谱、手未离开琴键、连续弹完三页”三项事实，AI 负责连接横排改动与原中断消失的实际效果。这样六例真正覆盖 `3 user_articulated + 1 ai_synthesized + 1 needs_more + 1 limited`。

确认包：[semanticFrame v5 成果归属与统一回应确认包](../../../artifacts/generative-interview-board7/2026-08-02/semantic-frame-v5-offline-case-confirmation.md)。数据集版本为 `2026-08-02.board7-semantic-frame-v5-offline-confirmation-v1`，案例指纹为 `481c86765c4d7f1866887705b5af2e032975dc2818c27e9792dedefe3fee2229`。

当前模型预算为 `0`。v71 `aborted` 账本不可再次消费；v72 六例需要先完成产品确认，再建立新的独立预算并获得明确授权。六例质量门、隐藏集、工作集、准入和板块 8继续阻断，Production 保持 `legacy + baseline`。

## 16. 2026-08-02 v72 六例首轮、双层验收与停止

产品负责人确认六例并批准一次真实首轮。首个 v1 账本在 Provider 请求发生前因脚本只读取旧 Endpoint 配置而中止，预检和生成请求均为 `0`，已通过[基础设施空跑审计](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-infrastructure-void.md)封存。评测入口随后加载与应用相同的完整环境层级，以明确引用 v1 空跑的 v2 账本恢复同一首轮。

v2 共使用 `1` 次只读预检与 `18` 次生成请求，六例全部到达终态：

- 第一段请求 `6/6` 技术成功，严格语义 `3/6`；
- 第二段 `12/12` 请求均因 Prompt 缺少 `json` 协议词而被 DeepSeek 在生成前拒绝；
- 用户回应 `0/6`，技术完整 `0/6`；
- 成果来源误判 `1`、严重纠正遗漏 `1`、关键证据遗漏 `1`；
- 严重事实反转和强推断均为 `0`。

第一段三个产品失败为：行动案例把 AI 新连接误标为用户成果；纠正案例没有识别“你理解反了”，并遗漏“房间没有变暗”的必要限定；材料有限案例遗漏唯一仍可确认的“终于”。这些问题分别涉及来源、纠正和必要范围，尚未收敛为一个产品变量。

`GI-049` 据此固定为 `fail / stop`。结构化输出层需要保证所有 `json_object` 请求都携带中性 JSON 输出要求；第一段重新打开显式关系归属、纠正优先级和必要证据覆盖。当前停止新的模型运行和 Prompt 调优，不进入隐藏集、工作集、准入或板块 8。下一候选需要重新冻结产品规则、升级版本和案例指纹，并获得独立授权。

证据：[原始运行报告](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-v2-report.md)、[Codex 双层验收](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-v2-codex-review.md)、[v2 终局账本](../../../artifacts/generative-interview-board7/2026-08-02/board7-provider-v72-semantic-frame-first-pass-budget-v2.json)。Production 保持 `legacy + baseline`。

历史离线基线为事件中心与生成式评测 `35` 个测试文件、`679/679` 用例通过；v72 运行门补齐后为 `36` 个文件、`687/687` 用例通过。离线结果证明协议、兼容、恢复、默认两段式编排和评测资产可以执行；真实六例已经由本节结果判定失败。
