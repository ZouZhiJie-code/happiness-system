# Integration Guide

最后更新：`2026-05-05`

本文记录当前仓库真实存在的访谈与日志接口，供前端联调、测试脚本和后续接手者使用。

## 1. 总体说明

- 所有会话相关接口都在 `src/app/api/interview/session/*`
- 主前端访谈链路使用 `respond/stream`
- 大多数成功响应最终都会返回一份完整 `session`，前端用它做 hydrate
- 当前“生成日志”只支持单个 `sessionId`
- `joy / fulfillment / reflection / improvement / gratitude` 已完成理论对齐深化
- 所有按 `entryDate / date` 取天级数据的接口，当前统一按 `Asia/Shanghai` 的整天时间窗口查询，不再按某个归一化时间点精确匹配

## 2. 路由清单

| 方法 | 路径 | 用途 | 备注 |
|---|---|---|---|
| `POST` | `/api/interview/session/start` | 启动某个维度的访谈 | 传 `dimension`，可选 `entryDate` |
| `GET` | `/api/interview/session/[id]` | 拉取某个 session | 页面恢复和维度缓存会用 |
| `POST` | `/api/interview/session/respond` | 非流式回复接口 | 当前主 UI 不走它 |
| `POST` | `/api/interview/session/respond/stream` | 流式回复接口 | 当前主 UI 使用 SSE |
| `POST` | `/api/interview/session/pause` | 暂停当前访谈 | 返回最新 session |
| `POST` | `/api/interview/session/complete` | 标记访谈完成 | 返回最新 session |
| `POST` | `/api/interview/session/reopen` | 重开可恢复的旧 session | 用于恢复已暂停或旧版会话 |
| `POST` | `/api/interview/session/draft/generate` | 生成日志草稿 | 当前只支持一个 `sessionId` |
| `POST` | `/api/interview/session/draft/save` | 保存正式日志 | 将当前 draft 标成 `saved` |
| `PUT` | `/api/journal-entry/[id]` | 更新日志标题和正文 | 当前 canonical 编辑接口 |
| `PUT` | `/api/joy-entry/[id]` | 更新日志标题和正文 | 与上面完全等价，保留兼容 |
| `GET` | `/api/daily-journal?date=YYYY-MM-DD` | 查询当天整合日志 | 返回 `none / draft / saved / stale` |
| `POST` | `/api/daily-journal/generate` | 生成当天整合日志 | 只使用已保存维度日志 |
| `PUT` | `/api/daily-journal/[id]` | 更新当天整合日志草稿 | 访谈页当天日志模式自动保存 |
| `POST` | `/api/daily-journal/[id]/save` | 保存当天整合日志 | 将日级日志标成 `saved` |
| `POST` | `/api/transcribe` | 语音转文字 | 当前是 stub |
| `GET` | `/api/analysis/month` | 查询月度日志分析 | 返回月概览、日覆盖、五维洞察、评分状态和趋势数据 |
| `PUT` | `/api/happiness-score` | 保存幸福 8 要素日评分 | 只允许保存今天和昨天 |

页面路由补充：
- `/analysis?month=YYYY-MM&section=overview|score|rhythm|insights` 是当前记录分析页面；它已接入 `GET /api/analysis/month?month=YYYY-MM` 和 `PUT /api/happiness-score`。缺失 `section` 时前端默认切到 `overview` 总览视图。`SiteHeader` 中区的 `AnalysisToolbar` 独立获取月分析数据，渲染月份翻页和 4 个 section tab（总览/评分/节奏/五维），tab 带数据依赖的 contextual chip；页面正文按 `section` 只渲染对应板块；切换 tab 或翻月后 `section` 保留在 URL 中。总览视图先给月度判断、评分可信度和“建议先看”主行动，再给评分刻度 / 记录节奏 / 五维线索轻入口，底部证据条只做辅助快扫。评分区当前是补录优先的双栏工作台：左侧先处理今天 / 昨天状态、填写进度和 8 项列表，右侧只编辑当前要素的 `1..10` 刻度，未填不再默认落在 `5` 分；今天和昨天都补齐后，首屏才回到趋势阅读。热力区支持点选某一天继续回到当天，但未来日期的 drill-down 只开放 `查看当天`，不开放 `开始这一天的记录 / 继续当天记录`。`rhythm` 会把 `saved` 但来源签名失配的当天整合日志重新标成 `待更新 / 待整合`；即使当天已经没有任何 `saved` 来源，只要这篇整合日志仍然 `stale`，分析里也会继续把它算进待处理，不会静默漏掉。未来月份不会把整个月误读成 `最长空档`，总览首屏也会直接提示回到当前月份，而不是送去今天的访谈。五维洞察现在按“本月判断 + 五维全景 + 维度之间 + 下一步”组织，回到维度访谈的 drill-down 链接会保留对应 `entryDate`；当前月评分保存成功后，toolbar 的 contextual chip 会立即刷新。评分区只有在至少 2 天评分且确实存在差异时，才展示 `长期偏高 / 最常掉下来 / 波动最大` 排名卡；样本不足或各要素持平时只保留“仅供参考”的轻提示；`insights` 的 headline / watchpoint 和“评分低点还没写出来”卡片会共用同一套 quiet lagging 维度排序。空数据月份直接显示真实空态而不是示意填充。

## 3. 请求与返回

### 3.1 启动访谈

`POST /api/interview/session/start`

请求：

```json
{
  "dimension": "fulfillment",
  "entryDate": "2026-05-02"
}
```

说明：
- `entryDate` 可选，格式固定为 `YYYY-MM-DD`
- 默认按北京时间当天生成
- `entryDate` 表示这轮访谈和最终日志应归属的日期，不再默认等于 `startedAt`

返回：

```json
{
  "sessionId": "cuid",
  "openingQuestion": "string",
  "session": { "...完整 interviewSessionSchema..." }
}
```

`session` 里现在包含：
- `entryDate: "YYYY-MM-DD"`
- `startedAt: "ISO datetime"`

两者语义不同：
- `entryDate` 是记录归属日期
- `startedAt` 是会话实际创建时间

### 3.2 流式回复

`POST /api/interview/session/respond/stream`

请求：

```json
{
  "action": "reply",
  "sessionId": "cuid",
  "userMessage": "和家人一起吃饭聊天，因为我很久没有这么放松了。",
  "inputMode": "text"
}
```

也支持：

```json
{ "action": "continue_current_event", "sessionId": "cuid" }
```

```json
{ "action": "next_event", "sessionId": "cuid" }
```

SSE 事件：
- `phase`
- `delta`
- `session`
- `error`

`delta` 里当前会出现：
- `summary`
- `question`

`summary` 对应浅色 `thinkingSummary` 思路层，用来呈现 AI 对用户回复的理解和处理焦点。服务端会先按维度规则规范化这段文本，拦截问句、系统口吻和“下一步问”等措辞；如果模型只做了浅复述，也会先基于当前维度的语义解释层重写，再通过 `summary` delta 分段流式发送。`question` delta 才是正式追问。客户端不要把 `summary` 当成第二个问题展示。

`question` 的 provider 流式文本会继续按增量展示；服务端对 provider 原始 `delta.text` 不会单独 trim 或折叠空白，跨 chunk 的空格与换行会原样保留。只有系统自己补发的完整文本才会做内部切块，避免一次性塞入长气泡。

`error` 事件从 `2026-05-01` 起会带结构化 `issue`：

```text
event: error
data: {
  "code": "MESSAGE_TOO_LONG",
  "message": "单次回复最多支持 1200 字。",
  "issue": {
    "code": "MESSAGE_TOO_LONG",
    "title": "这段回复太长",
    "message": "单次回复最多支持 1200 字。",
    "resolution": "请把内容拆成两段发送，或删短后重试。",
    "retryable": true,
    "action": "shorten_input",
    "requestId": "ir_..."
  }
}
```

前端应优先读取 `issue`；`code/message` 只作为兼容字段。

`fulfillment` 的主链路语义：
- `event` 对应内部 `experience`
- `whyItMattered` 对应内部 `progressEvidence`
- `happinessType` 对应内部 `fulfillmentType`
- `selfPattern` 对应内部 `valueSignal`，用户语义为“值得感标准”
- 如果用户拒绝继续深挖，且 `experience + progressEvidence` 已成立，会返回 `pendingDecision.kind = "event_complete"` 与 `completionMode = "user_override_partial"`
- 如果用户直接输入“总结日志 / 总结成日志 / 整理成日志 / 帮我总结 / 帮我整理 / 生成一下日志”等自然语言整理请求，也按同一条 partial 收束路径处理，不会先继续抽取或追问
- 如果用户拒绝继续深挖但材料不足，会返回 `pendingDecision.kind = "boundary_insufficient"`，actions 固定为 `continue_current_event / next_event / pause_session`

`reflection` 的主链路语义：
- `event` 对应内部 `trigger`
- `whyItMattered` 对应内部 `insight`
- `happinessType` 对应内部 `reflectionType`，当前为 `规律发现型 / 方向优势型 / 判断校准型`
- `selfPattern` 对应内部 `viewpointShift`，语义为“视角变化或判断线索”
- 如果用户已经明确回答“没有某段具体经历 / 对话”，但随后通过 `continue_current_event` 继续深聊，系统不能再重复追同一字段；后续问题必须降压到更容易回答的具体锚点，例如某个顾虑、画面、比较时刻或选择瞬间
- 如果用户拒绝继续深挖，且 `trigger + insight` 已成立，会返回 `pendingDecision.kind = "event_complete"` 与 `completionMode = "user_override_partial"`
- 如果用户直接输入“总结日志 / 整理成日志 / 生成一下日志”等自然语言整理请求，也按同一条 partial 收束路径处理，不会先继续抽取或追问
- 如果用户拒绝继续深挖但没有具体触发片段或新理解，会返回 `pendingDecision.kind = "boundary_insufficient"`，actions 固定为 `continue_current_event / next_event / pause_session`

`improvement` 的当前结构语义：
- `situation`：改进情境
- `improvementTrack`：`repeat_good` 或 `avoid_bad`
- `stateAssessment`：这次好在哪里，或不理想在哪里
- `frictionPoint`：`avoid_bad` 的具体卡点；不应是“我很差 / 我不行”这类全局自责
- `repeatCondition`：`repeat_good` 的可重复条件
- `controllableFactor`：用户自己能调整的一小块
- `nextAttempt`：下一次具体动作；不应是“我要变好 / 我要努力”
- `successSignal`：可选的轻量成功信号
- `improvementType / feeling / tags`：辅助字段

`improvementTrack` 可能先于 `repeatCondition / frictionPoint` 出现：当用户只表达“想重复这个好状态”或“想避免这个坏状态”，但还没有说清关键条件或卡点时，AI 抽取会保留轨道，把条件/卡点留空交给下一轮追问。客户端不要把这种 track-only 中间态视为完整或 partial 可生成材料。

当前 `improvement` 已有专属 AI 抽取 schema、prompt guardrails、fallback 抽取、阶段推进、提问策略、完整 / partial 收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例。因此对接时可以依赖字段结构、访谈 choice 触发语义和日志生成闭环存在；提问会按具体情境、改进轨道、关键条件/卡点、可控小调整、下次最小动作推进，并避免建议/计划/归责口吻。仍需补充端到端产品验收后再视为完全验收。

`gratitude` 的当前结构语义：
- `gratitudeMoment`：感谢片段
- `gratitudeTarget`：感谢对象或关系来源
- `kindAction`：对方具体做了什么
- `seenNeed`：对方看见并回应了我的什么需要或难处
- `innerEffect`：这份善意带来的内在影响
- `gratitudeReason`：为什么这份感谢重要
- `gratitudeType`：`支持回应型 / 理解体谅型 / 陪伴接住型 / 照顾减负型 / 信任机会型`
- `relationshipSignal`：完整模式下的关系线索，语义为“什么样的关系回应值得珍惜或学习”
- `reciprocityHint`：可选的自然回馈或学习意愿；不应是“我要报答 / 还人情”这类道德负债

`gratitude` 的 legacy 字段投影：
- `event = gratitudeMoment`
- `feeling = innerEffect`
- `whyItMattered = gratitudeReason`
- `happinessType = gratitudeType`
- `selfPattern = relationshipSignal`

如果用户拒绝继续深挖，且 `gratitudeMoment + kindAction + seenNeed|gratitudeReason` 已成立，会返回 `pendingDecision.kind = "event_complete"` 与 `completionMode = "user_override_partial"`。如果只有感谢对象但没有具体行为或原因，会返回 `boundary_insufficient`。

多事件 `stitched_moments` 成稿补充约束：
- 五个维度都共享 supporting scene 校验，但只校验本次 AI prompt 实际看到的 `promptEvents`，不会因为窗口外 supporting moment 把 `refresh_minor` 误判为缺少副事件
- 如果 AI draft 漏掉本次 prompt 里实际提供的 supporting moment，质量门会返回 `missing_supporting_scene_anchor`
- `gratitude` 的 `stitched_moments` supporting-scene 会先走严格锚点，再只接受仍保留明确照顾动作和足够场景锚点的自然压缩；支持事件被压缩写成近义短句时，不应直接误判回退 fallback，但语义反转或只剩少量字面重叠的改写仍应触发 `missing_supporting_scene_anchor`
- 如果因此退回 fallback draft，正文会保留主事件外最多 `2` 个 supporting moments，而不是退化成只剩主事件

### 3.3 非流式回复

`POST /api/interview/session/respond`

与流式接口入参兼容，但直接返回完整 JSON：

```json
{
  "assistantMessage": "string",
  "assistantTurn": { "...assistantTurnPayload..." },
  "sessionStatus": "active",
  "turnCount": 2,
  "snapshot": { "...joySnapshot..." },
  "snapshotData": { "...interviewSnapshotData..." },
  "isReadyForDraft": true,
  "session": { "...完整 interviewSessionSchema..." }
}
```

### 3.4 生成日志草稿

`POST /api/interview/session/draft/generate`

请求：

```json
{
  "sessionIds": ["cuid"]
}
```

注意：
- schema 允许数组
- 当前服务只支持 1 个 `sessionId`
- 多于 1 个会返回 `SESSION_BATCH_UNSUPPORTED`
- 当前前端只会在用户主动触发时调用它：
  - 顶部手动点击“生成日志”
  - 访谈分岔点里点击“现在整理日志”或“先整理当前日志”
- 当前不会因为新增访谈消息而自动触发日志整理。
- 五个维度在成稿前都会先做一层服务端语义解释，判断当前片段在维度理论里属于什么主题、为什么成立，再把这层解释投影到 `DraftBrief`、标题候选和 draft 质量门；这层解释是内部控制层，不能作为正文句子直接进入用户可见日志或 fallback draft。
- 如果当前草稿已经覆盖到最新访谈状态，再次点击“生成日志”不会重新请求，而是直接复用当前版本，并提示“当前已经是最新版本”。
- 生成中当前采用阶段式反馈：
  - `正在生成日志骨架`
  - `正在打磨日志细节`
  - `最终润色中`
- 阶段式反馈会保留共享阶段进度、细进度轨和书页生长动效；当天完整日志打开/生成也复用同一视觉反馈。
- `fulfillment` 生成日志时会按“具体片段 -> 进展 / 积累 / 贡献证据 -> 为什么今天不算白过 -> 轻收”组织正文。
- `fulfillment` 完整模式才允许轻收“值得感标准”；partial 模式不会硬写 `selfPattern`。
- `reflection` 生成日志时会按“触发片段 -> 原来的疑问或判断 -> 新理解 / 证据 -> 视角变化或判断线索”组织正文。
- `reflection` 完整模式才允许轻收“判断线索”；partial 模式不会硬写 `selfPattern`。
- `improvement` 生成日志时会按“具体情境 -> 好/不理想状态 -> 关键条件或卡点 -> 可控小调整 -> 轻收”组织正文。
- `improvement` 完整模式才允许轻收用户已经说出的 `nextAttempt`；partial 模式只停在当前看见的改进点，不硬写完整方案。
- `gratitude` 生成日志时会按“具体感谢片段 -> 对方行为 -> 被回应的需要 -> 为什么重要 -> 关系线索轻收”组织正文。
- `gratitude` 完整模式才允许轻收 `relationshipSignal`；partial 模式只停在当前感谢，不硬写稳定关系判断或回馈任务。
- `gratitude` 在 `stitched_moments` 下如果回退到 fallback draft，正文会自然并入主事件外最多 `2` 个 supporting moments。
- 五个维度的标题都会经过后端语义短标题治理，最大 `16` 字；AI 返回的坏标题、流水句或截断句会被确定性标题替换。`joy` 会拦截 `一下被带轻 / 象征意义` 这类伪中文或理论词标题，早起、多出时间、准备感场景应落到 `清醒地开始` 这类自然短标题；`improvement` 应优先落到 `表达慢下来 / 先听完再回应 / 把节奏放稳 / 提前留出缓冲 / 把边界说清楚 / 让准备更充分` 这类短标题；`gratitude` 应优先落到 `被稳稳接住 / 被认真理解 / 那句及时提醒 / 有人帮我理清 / 被信任的机会` 这类短标题。
- `joy` 的 draft 质量门当前不再要求逐字出现 `被接住 / 被理解 / 有分量` 这类固定短语；只要正文能用语义等价的方式写出状态被带轻、被回应或真正打动的那一层，也会通过。但质量门会拒绝“更像轻快乐 / 关键不是深意义 / 这种会把状态轻轻带起来的方式”这类内部理论腔，`delightSignature` 也不能用 `象征意义 / 确定性 / 动作本身` 这类抽象短语或 `清醒 / 从容 / 有准备` 这类单纯状态词提前闭合访谈。

成功返回：

```json
{
  "draftEntry": { "...journalEntrySchema..." },
  "session": { "...完整 interviewSessionSchema..." }
}
```

`fulfillment` payload 示例：

```json
{
  "kind": "fulfillment",
  "experience": "今天把一个拖了很久的任务推进完了",
  "feeling": "踏实",
  "fulfillmentType": "推进完成型",
  "progressEvidence": "原本卡住的部分终于收口了",
  "valueSignal": "能把卡住的事情真正往前推进",
  "tags": ["推进完成型", "踏实"]
}
```

`reflection` payload 示例：

```json
{
  "kind": "reflection",
  "trigger": "今天看完一个项目复盘",
  "feeling": "警醒",
  "reflectionType": "判断校准型",
  "insight": "我意识到自己以前太容易把忙碌当成进展",
  "viewpointShift": "以后判断进展时，要看判断依据有没有变清楚",
  "tags": ["判断校准型", "警醒"]
}
```

`improvement` payload 示例：

```json
{
  "kind": "improvement",
  "situation": "今天开会时我有点急，对方问题还没说完我就开始解释",
  "improvementTrack": "avoid_bad",
  "stateAssessment": "没听完整就回应，导致理解偏了",
  "feeling": "有点急",
  "improvementType": "沟通节奏",
  "frictionPoint": "回答太快，没有先确认问题",
  "repeatCondition": null,
  "controllableFactor": "回答前先确认理解",
  "nextAttempt": "下次先复述一遍问题，再开始回答",
  "successSignal": "对方确认我理解对了",
  "tags": ["沟通"]
}
```

`gratitude` payload 示例：

```json
{
  "kind": "gratitude",
  "moment": "今天同事看出我快撑不住，帮我先理清优先级",
  "gratitudeMoment": "今天同事看出我快撑不住，帮我先理清优先级",
  "gratitudeTarget": "同事",
  "kindAction": "看出我快撑不住，帮我先理清优先级",
  "seenNeed": "我当时需要有人帮我把混乱的事情理清",
  "innerEffect": "被稳稳接住",
  "feeling": "被接住",
  "gratitudeType": "支持回应型",
  "gratitudeReason": "它让我觉得自己不是一个人在扛",
  "relationshipSignal": "这样的关系回应值得我珍惜，也值得我学习",
  "reciprocityHint": "我也想学习这种先看见别人处境的方式",
  "tags": ["协作", "支持"]
}
```

### 3.5 保存正式日志

`POST /api/interview/session/draft/save`

请求：

```json
{
  "sessionId": "cuid"
}
```

成功返回：

```json
{
  "draftEntry": { "...journalEntrySchema..." },
  "session": { "...完整 interviewSessionSchema..." }
}
```

### 3.6 更新日志正文

`PUT /api/journal-entry/[id]`

也兼容：
- `PUT /api/joy-entry/[id]`

语义补充：
- 如果当前日志原本已经是 `saved`，这条 `PUT` 会把它重新打回 `draft`，并清空 `savedAt`
- 因此前端里的“保存修改”仍然是显式动作；自动暂存不会静默发布已保存日志的修改

请求体就是 `updateJournalEntryRequestSchema`：

```json
{
  "title": "和家人一起吃饭聊天",
  "content": "......",
  "event": "...",
  "feeling": "...",
  "whyItMattered": "...",
  "happinessType": "...",
  "selfPattern": "...",
  "joyMoment": "...",
  "joySource": "...",
  "stateShift": "...",
  "meaningNeed": "...",
  "manualClue": "...",
  "directionSignal": null,
  "valueImpact": null,
  "durability": null,
  "tags": ["关系型开心"],
  "eventBlocks": [],
  "payload": {
    "kind": "joy",
    "joyMoment": "...",
    "joySource": "...",
    "stateShift": "...",
    "meaningNeed": "...",
    "manualClue": "...",
    "directionSignal": null,
    "valueImpact": null,
    "durability": null,
    "tags": ["关系型开心"]
  },
  "source": "ai_draft_direct"
}
```

### 3.7 当天整合日志

当天整合日志独立于五个维度日志，只使用同一天已保存的维度日志生成。

查询：

```http
GET /api/daily-journal?date=2026-05-02
```

返回：

```json
{
  "dailyJournal": null,
  "availableSourceCount": 0,
  "state": "none"
}
```

`state` 取值：
- `none`：还没有当天整合日志
- `draft`：已有草稿
- `saved`：已正式保存
- `stale`：已有日级日志，但来源维度日志保存后又更新过、来源维度日志不再是 `saved`，或同一天新增了新的 `saved` 维度日志

生成：

```json
{
  "date": "2026-05-02"
}
```

`POST /api/daily-journal/generate` 只收集当天 `JoyEntry.status = saved` 的维度日志。这里的“当天”当前按 `Asia/Shanghai` 的整天时间窗口取数，而不是按单个归一化时间点精确匹配。来源集合按“同一天每个维度最新一篇 `saved` 日志”计算；没有来源时返回 `DAILY_JOURNAL_SOURCE_EMPTY`。生成成功会 upsert 一条 `DailyJournalEntry` 草稿。如果这篇当天日志之前已经 `saved`，重新生成后也会先回到 `draft`，等待用户再次显式保存。

编辑草稿：

```json
{
  "title": "今天的记录",
  "content": "## 开心\n......"
}
```

`PUT /api/daily-journal/[id]` 会把状态保持或改回 `draft`，用于访谈页当天日志模式自动保存。已保存的当天日志再次编辑时，也会先回到 `draft`，直到用户点击“保存修改”。

前端离开当天日志主区前也会主动调用同一草稿更新接口：
- 点击“回到访谈”时，会先保存未等到 700ms autosave 的标题或正文编辑；保存失败或内容非法时继续停留在当天日志主区。
- 用户在当天日志主区切换访谈维度时，也会先保存 pending 编辑，然后把主工作区切回普通访谈，避免新维度隐藏在当天日志主区背后。

正式保存：

```http
POST /api/daily-journal/[id]/save
```

保存后 `status = saved`，并写入 `savedAt`。

## 4. 错误语义

### 4.1 访谈提交错误

`respond` 与 `respond/stream` 当前共享同一套结构化错误语义：

| 错误码 | 场景 | 建议处理 |
|---|---|---|
| `NETWORK_UNAVAILABLE` | 浏览器连不上服务端或网络中断 | 确认服务运行，刷新后重试 |
| `INVALID_RESPOND_REQUEST` | 请求格式不合法 | 刷新页面后重试 |
| `MESSAGE_TOO_LONG` | `userMessage` 超过 `1200` 字 | 拆成两段或删短后重试 |
| `SESSION_NOT_FOUND` | 会话不存在或本地缓存指向旧 session | 刷新页面，必要时清除对话记录 |
| `SESSION_CHOICE_UNAVAILABLE` | 继续深挖 / 下一件事分叉已过期 | 刷新后按最新状态操作 |
| `SESSION_EVENT_NOT_FOUND` | session 缺少 active event | 刷新后重试，仍失败则清除对话记录 |
| `INTERVIEW_ACTION_UNSUPPORTED` | 前端动作不被服务端支持 | 刷新后重试 |
| `ASSISTANT_ACTION_MISSING` | 服务端没有拿到下一步访谈动作 | 刷新后重试 |
| `INTERVIEW_DB_WRITE_FAILED` | 本轮回复写库失败 | 稍后重试，原输入应保留 |
| `INTERVIEW_RESPONSE_SCHEMA_ERROR` | 服务端生成的 session payload 未通过校验 | 刷新后重试 |
| `STREAM_PROTOCOL_ERROR` | 流式数据格式异常 | 刷新后重试 |
| `INTERVIEW_RESPOND_FAILED` | 未分类兜底错误 | 重试；反复出现时带错误码和 requestId 反馈 |

### 4.2 其他接口错误

高频错误码：

| 错误码 | 场景 |
|---|---|
| `INVALID_START_REQUEST` | `start` 参数不合法 |
| `INVALID_RESPOND_REQUEST` | `respond` 或 `respond/stream` 参数不合法 |
| `SESSION_NOT_FOUND` | 找不到当前会话 |
| `SESSION_CHOICE_UNAVAILABLE` | 当前没有可执行的继续/下一件分叉 |
| `SESSION_BATCH_UNSUPPORTED` | draft generate 传了多个 session |
| `DRAFT_GENERATE_UPSTREAM_ERROR` | AI 生成链路失败 |
| `INVALID_DAILY_JOURNAL_DATE` | 查询当天整合日志时缺少或传入非法日期 |
| `INVALID_DAILY_JOURNAL_GENERATE_REQUEST` | 生成当天整合日志请求体不合法 |
| `INVALID_DAILY_JOURNAL_UPDATE_REQUEST` | 更新当天整合日志请求体不合法 |
| `DAILY_JOURNAL_SOURCE_EMPTY` | 当天没有已保存的维度日志，不能生成整合日志 |
| `DAILY_JOURNAL_NOT_FOUND` | 更新或保存当天整合日志时找不到记录 |
| `DAILY_JOURNAL_GENERATE_FAILED` | 当天整合日志生成或写入失败 |
| `DAILY_JOURNAL_UPDATE_FAILED` | 当天整合日志草稿保存失败 |
| `DAILY_JOURNAL_SAVE_FAILED` | 当天整合日志正式保存失败 |
| `DRAFT_GENERATE_DB_ERROR` | AI 生成成功但写库失败 |
| `DRAFT_NOT_FOUND` | 保存正式日志时没有 draft |
| `INVALID_JOURNAL_ENTRY_REQUEST` | 更新日志请求体不合法 |
| `JOURNAL_ENTRY_NOT_FOUND` | 日志不存在 |
| `AUDIO_FILE_REQUIRED` | transcribe 没上传 `audio` |

## 5. 兼容与现状说明

### 5.1 `journal-entry` vs `joy-entry`

当前两个编辑路由行为完全等价：
- `/api/journal-entry/[id]`
- `/api/joy-entry/[id]`

推荐：
- 新代码统一使用 `/api/journal-entry/[id]`
- `/api/joy-entry/[id]` 只保留给兼容链路

### 5.2 `transcribe`

`POST /api/transcribe` 当前不是生产级转写：
- 接收 `multipart/form-data`
- 字段名必须是 `audio`
- 返回一段占位 transcript

这说明语音链路的真实集成还没完成。

### 5.3 `respond`

当前主前端不会直接调用 `/api/interview/session/respond`，而是用 `/respond/stream`：
- 原因是聊天区需要边收 `phase/delta` 边更新 UI
- `summary` delta 对应浅色 `thinkingSummary` 思路层，用来呈现 AI 对用户回复的理解和处理焦点；前端不会把它当成正式追问气泡
- 如果只是做服务层联调，可以用非流式接口

### 5.4 开发态“清除对话记录”

当前访谈页有一个开发辅助按钮 `清除对话记录`，但它不是独立后端接口：
- 前端会清掉当前维度的本地 session 恢复记录
- 中断当前页面上的对话或日志整理请求
- 然后重新调用 `/api/interview/session/start`

这意味着：
- 这是一个前端开发态重开能力
- 不会删除数据库中的旧 `InterviewSession`
- 如果外部系统需要真正的“删除会话”能力，当前仓库还没有提供对应公开 API

### 5.5 当前日志生成的前端语义

当前与日志整理相关的真实前端语义是：
- 继续访谈、切到下一件事件、AI 新追问、用户新回答，都不会自动进入“正在整理中”
- 日志整理必须由用户显式点击触发
- 第一次生成时，右侧日志 pane 会显示阶段式 loading 状态
- 已有草稿后再生成时，旧稿会先保留可见，再叠加阶段式刷新提示
- 如果用户在生成过程中关闭日志面板，前端会 abort 这次请求，但不会删除已有草稿

### 5.6 fulfillment 验收语义

对接或冒烟时，`fulfillment` 至少要覆盖这些输入：
- 推进完成：能识别完成、推进、收口、解决等证据
- 投入积累：能识别练到、学到、积累、更熟等证据
- 协作贡献：能识别帮到、支持、配合、交接等证据
- 空忙空转：只有忙碌、会议、任务很多时，不应硬写进展证据或值得感标准
- 用户拒绝继续深挖或自然语言要求整理日志：核心材料已成立时，应允许 `user_override_partial` 生成当前版本日志
- 用户拒绝继续且材料不足：不再继续追工作细节，应展示“只补一句 / 换一个片段 / 先退出”

### 5.7 reflection 验收语义

对接或冒烟时，`reflection` 至少要覆盖这些输入：
- 规律发现：能从具体片段里识别用户看见的新规律或模式
- 方向优势：能识别“更适合 / 更擅长 / 更有方向”的判断资产
- 判断校准：能识别“原来误判，现在判断依据变清楚”的视角变化
- 空泛想法：只有“今天想了很多 / 有点焦虑”时，不应硬写触发片段或判断线索
- 用户拒绝继续深挖或自然语言要求整理日志：已有 `trigger + insight` 后，应允许 `user_override_partial` 生成当前版本日志
- 用户拒绝继续且材料不足：不再硬追问，应展示“只补一句 / 换一个片段 / 先退出”

### 5.8 improvement 当前验收语义

当前验收数据结构、AI 抽取独立化、fallback 抽取、访谈推进、专属提问策略、完成收束、正文生成、质量门、fallback draft 和标题治理；端到端产品验收仍需继续人工覆盖：
- `avoid_bad`：例如“今天开会时我有点急，没听完就解释，后面发现对方其实问的是另一个点。下次我想先复述问题再回答。”应抽出 `situation / avoid_bad / frictionPoint / controllableFactor / nextAttempt`
- `repeat_good`：例如“今天上午先写了三条重点再开工，状态很稳。下次我想继续先定主线。”应抽出 `repeatCondition`，不强行抽 `frictionPoint`
- track-only 中间态：例如“今天这个节奏挺好，下次想重复一下”只应先保留 `improvementTrack = "repeat_good"`，不能硬抽 `repeatCondition` 或触发日志生成 choice
- 自责输入：`frictionPoint` 不应是“我很差 / 我不行”
- 空泛动作：`nextAttempt` 不应是“我要变好 / 我要努力”
- 可控点：`controllableFactor` 必须是用户能调整的小动作，不是控制别人或改变性格
- 完整模式：`situation + improvementTrack + stateAssessment + frictionPoint|repeatCondition + controllableFactor + nextAttempt` 成立后进入 complete choice
- partial 模式：`situation + frictionPoint|repeatCondition` 成立且用户说“今天沟通有点急，别追问了，直接整理。”时进入 `user_override_partial`，不硬写完整方案
- 材料不足：用户拒绝继续但缺少可信原因时进入 `boundary_insufficient`

### 5.9 calendar 后端基础

截至 `2026-05-03`，仓库里已经有记录日历的后端基础与公开 HTTP 路由：
- `src/features/calendar/aggregate-calendar.ts`
  - 纯展示层聚合器，负责 `CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord`
- `src/server/repositories/calendar.repository.ts`
  - 把 `InterviewSession / JoyEntry` 标准化成 calendar source
- `src/server/services/calendar/calendar.service.ts`
  - 暴露 `getCalendarDay / getCalendarWeek / getCalendarMonth`
- `src/app/api/calendar/day/route.ts`
- `src/app/api/calendar/week/route.ts`
- `src/app/api/calendar/month/route.ts`

这意味着：
- 当前既可以在服务层直接调用 calendar 能力，也可以通过 HTTP 调用：
  - `GET /api/calendar/day?date=YYYY-MM-DD`
  - `GET /api/calendar/week?date=YYYY-MM-DD`
  - `GET /api/calendar/month?month=YYYY-MM`
- `/calendar?view=month&date=YYYY-MM-DD` 月视图已经落地
- `/calendar?view=week&date=YYYY-MM-DD` 周视图已经落地
- `/calendar?view=day&date=YYYY-MM-DD` 日视图已经落地，按五维卡片组织单日阅读与动作分发

### 5.10 Step 4: calendar API 可执行规格

本节保留为第 4 步的实现契约回顾。当前代码已经按这份契约落地了稳定的 calendar HTTP API，继续保留是为了后续 `week / day` 视图实现时有同一份边界参考。

#### 目标

- 新增三个只读接口：
  - `GET /api/calendar/month?month=YYYY-MM`
  - `GET /api/calendar/week?date=YYYY-MM-DD`
  - `GET /api/calendar/day?date=YYYY-MM-DD`
- 响应体直接返回 calendar 读模型，不包一层 `data`，不透出 Prisma / 表名 / 内部结构字段。
- API 本身就产出三视图所需业务状态，前端不负责再拼“这一天是什么状态、该显示什么动作”。
- 未来日期可查询，但不可通过 calendar API 暴露“开始记录 / 继续访谈”动作。

#### 实现范围

本步只做 API 面，不做：
- `/calendar` 页面
- 月 / 周 / 日视图组件
- 新的数据库迁移
- 对 `JoyEntry` / `InterviewSession` 结构做额外重构

#### 依赖与复用

直接复用现有服务层：
- `getCalendarMonth(month)`
- `getCalendarWeek(date)`
- `getCalendarDay(date)`

直接复用现有读模型：
- `CalendarMonthRecord`
- `CalendarWeekRecord`
- `CalendarDayRecord`

如果为实现 API 需要补充参数校验或未来日期动作裁剪，可以修改：
- `src/server/services/calendar/calendar.service.ts`
- `src/features/calendar/types.ts`
- `src/features/calendar/aggregate-calendar.ts`

但不能改变“API 直接返回 calendar 读模型”这个对外契约。

#### 路由文件

需要新增：
- `src/app/api/calendar/month/route.ts`
- `src/app/api/calendar/week/route.ts`
- `src/app/api/calendar/day/route.ts`

如需统一 query 校验与错误映射，可补：
- `src/features/calendar/schema.ts`
- 或 `src/features/calendar/api.ts`

目标是避免三个 route 各自手写一套字符串判断。

#### 请求契约

`GET /api/calendar/month`
- 必填 query: `month`
- 格式：`YYYY-MM`
- 语义：查询该自然月的完整日记录数组

`GET /api/calendar/week`
- 必填 query: `date`
- 格式：`YYYY-MM-DD`
- 语义：查询“该日期所在周”的 7 天数据
- 周起点固定为北京时间语义下的周一，终点为周日

`GET /api/calendar/day`
- 必填 query: `date`
- 格式：`YYYY-MM-DD`
- 语义：查询某一天五维详情

统一规则：
- 只接受 query string，不接受 body
- 缺少参数按 `400` 处理
- 格式错误按 `400` 处理
- 不合法自然日也按 `400` 处理，例如 `2026-02-30`
- 不合法自然月也按 `400` 处理，例如 `2026-13`
- 日期解释、今天判定、未来日期判定全部以 `Asia/Shanghai` 为准

注意：
- 当前 `calendar.service.ts` 已能拦截非法 `YYYY-MM-DD`
- 但 `YYYY-MM` 目前只有正则形状校验，第 4 步实现时必须补上“月份范围合法性校验”，不能让 `2026-13` 进入后续逻辑

#### 成功响应契约

`GET /api/calendar/month?month=2026-05`

```json
{
  "month": "2026-05",
  "days": [
    {
      "date": "2026-05-01",
      "overallStatus": "empty",
      "dimensions": [
        {
          "dimension": "joy",
          "status": "empty",
          "title": null,
          "summary": null,
          "latestUpdatedAt": null,
          "sessionId": null,
          "journalEntryId": null,
          "actions": ["start_interview"],
          "hasActiveSession": false,
          "hasDraftEntry": false,
          "hasSavedEntry": false
        }
      ],
      "activeCount": 0,
      "draftCount": 0,
      "savedCount": 0,
      "primaryTitle": null,
      "primarySummary": null,
      "latestUpdatedAt": null,
      "primaryAction": "start_interview"
    }
  ]
}
```

`GET /api/calendar/week?date=2026-05-01`

```json
{
  "anchorDate": "2026-05-01",
  "weekStartDate": "2026-04-27",
  "weekEndDate": "2026-05-03",
  "days": []
}
```

`GET /api/calendar/day?date=2026-05-01`

```json
{
  "date": "2026-05-01",
  "overallStatus": "draft",
  "dimensions": [
    {
      "dimension": "improvement",
      "status": "draft",
      "title": "把节奏放稳",
      "summary": "今天先把事情拆小以后，状态明显稳下来。",
      "latestUpdatedAt": "2026-05-01T12:00:00.000Z",
      "sessionId": "session_123",
      "journalEntryId": "entry_123",
      "actions": ["continue_editing"],
      "hasActiveSession": false,
      "hasDraftEntry": true,
      "hasSavedEntry": false
    }
  ],
  "activeCount": 0,
  "draftCount": 1,
  "savedCount": 0,
  "primaryTitle": "把节奏放稳",
  "primarySummary": "今天先把事情拆小以后，状态明显稳下来。",
  "latestUpdatedAt": "2026-05-01T12:00:00.000Z",
  "primaryAction": "continue_editing"
}
```

说明：
- 响应直接是 `CalendarMonthRecord / CalendarWeekRecord / CalendarDayRecord`
- 不再额外包 `success`、`data`、`meta`
- `dimensions` 仍应返回完整五维状态；上面示例只展开了其中一个维度对象
- `summary` 必须继续遵守当前安全摘要规则，不暴露内部字段名，如 `snapshotData`、`payload`、`pendingDecision`

#### 错误响应契约

统一返回 JSON：

参数错误：

```json
{
  "error": "INVALID_CALENDAR_DATE"
}
```

或：

```json
{
  "error": "INVALID_CALENDAR_MONTH"
}
```

查询失败：

```json
{
  "error": "CALENDAR_QUERY_FAILED"
}
```

状态码规则：
- `400`: 缺参、格式错误、自然日错误、自然月错误
- `500`: repository / service 查询失败，或读模型生成失败

第 4 步不引入 interview 那套 `issue` 结构化错误对象。calendar API 当前只需要稳定、简单的只读错误语义。

#### 未来日期处理

这是第 4 步必须实现的服务端约束，不能只交给前端：

- 未来日期允许查询
- 未来日期不允许暴露：
  - `start_interview`
  - `continue_interview`
- 如果未来日期是空白日：
  - `primaryAction = null`
  - 对应维度的 `actions = []`
- 如果未来日期存在异常或迁移遗留数据：
  - 允许继续返回 `draft / completed / mixed` 等状态
  - 允许保留 `continue_editing / view_journal / edit_saved_journal`
  - 但必须移除所有“启动或继续访谈”动作

这样做的原因：
- 服务端先兜底，防止前端漏拦截
- 前端仍可基于日期再次禁用 CTA，形成双保险

建议实现方式：
- 在 service 层聚合完成后统一走一层 `sanitizeCalendarActionsForFutureDate`
- 不要在 route 里逐层手改 `dimensions`，避免三条路由逻辑漂移

#### 与 `/calendar` 页面 URL 的关系

第 4 步虽然不做页面，但需要提前固定 URL 驱动约定：
- `/calendar?view=month&date=2026-05-01`
- `/calendar?view=week&date=2026-05-01`
- `/calendar?view=day&date=2026-05-01`

约定如下：
- 页面 URL 使用 `view + date`
- month API 仍然使用 `month=YYYY-MM`
- 因此前端或共享 helper 需要把 `date=2026-05-01` 派生为 `month=2026-05`
- 这种派生只属于路由参数转换，不属于业务状态二次拼装

建议在后续 UI 步骤复用同一组 helper：
- `resolveCalendarViewFromSearchParams`
- `resolveCalendarMonthKey(date)`
- `resolveCalendarDateKey(date)`

#### 实现清单

第 4 步落地时，最少应完成：

1. 新增 calendar query schema 或等价参数解析 helper
2. 为 `month / week / day` 三条路由接入 `calendar.service.ts`
3. 为非法 `month` 增加自然月合法性校验
4. 在 service 层新增未来日期动作裁剪
5. 为三条 API 增加自动化测试
6. 更新 `README.md`、`docs/architecture.md`、`docs/integration-guide.md`、`docs/handoff.md` 中“calendar 还没有公开 API”的事实表述

#### 自动化验收

至少新增这些测试：

- `GET /api/calendar/day?date=2026-05-02` 在无数据时返回 `200`，且 body 为 `CalendarDayRecord`
- `GET /api/calendar/week?date=2026-05-07` 返回 `7` 天数据，周范围按周一到周日计算
- `GET /api/calendar/month?month=2026-02` 返回 `28` 天数据
- `GET /api/calendar/day?date=2026-02-30` 返回 `400` + `INVALID_CALENDAR_DATE`
- `GET /api/calendar/month?month=2026-13` 返回 `400` + `INVALID_CALENDAR_MONTH`
- 查询未来空白日时，返回 `200`，但 `primaryAction = null`，且不包含 `start_interview`
- 查询未来某周 / 某月时，未来日期仍会出现在数组里，但不暴露启动访谈动作
- repository 或 service 抛错时，API 返回 `500` + `CALENDAR_QUERY_FAILED`

#### 人工验收

1. 访问 `GET /api/calendar/day?date=2026-05-02`
   预期：返回单日读模型；没有 `data` 包装层；没有数据库字段名。

2. 访问 `GET /api/calendar/week?date=2026-05-07`
   预期：`weekStartDate = 2026-05-04`，`weekEndDate = 2026-05-10`。

3. 访问 `GET /api/calendar/month?month=2026-13`
   预期：`400`，body 为 `{ "error": "INVALID_CALENDAR_MONTH" }`。

4. 访问未来日期，例如北京时间今天之后的 `GET /api/calendar/day?date=2099-01-01`
   预期：可查询；不会出现 `start_interview` 或 `continue_interview`。

#### 完成标志

满足以下条件，第 4 步才算完成：
- 三条 API 都可独立返回完整 `month / week / day` 读模型
- 前端不需要再按 session / entry 自己拼状态
- 未来日期即使被查询，也无法通过 API 获得“开始记录 / 继续访谈”动作
- 文档事实同步更新，不再写“calendar 只有服务层、没有公开 API”

### 5.11 Step 5: month view 可执行规格

本节现在既是第 5 步的实现契约回顾，也是当前月视图的对齐基线。`/calendar` 月视图已经完成基础功能，并在后续前端迭代里进入“全宽暖色 header + 中区统一导航 + 首屏工作区 + 双栏骨架”的结构，保留这节是为了后续继续细化内容层级时不丢掉既定边界。

#### 目标

- 新增 `/calendar` 页面和 header 导航入口。
- 当前代码已经支持 `month / week / day` 三层视图，但 month 仍然是默认落点和总入口。
- calendar 的全局导航已经统一收口到 `SiteHeader` 中区：
  - `month / week / day` 切换
  - 前后翻段
  - 回到今天
  - 实时摘要 chip
- `SiteHeader` 现在是全宽暖色工具栏，不再用居中大卡片外壳；calendar toolbar、访谈维度条和主导航都直接平铺在 header 里，不再额外套内层方框；主导航当前页用贴近文字的暖棕实线下划线表达，选中项字号略大，业务控制组用 `｜` 分隔。
- 月视图正文当前已经去掉重复 header、重复翻月按钮和统计卡，改成“月历主体 + 当天检查面板”的双栏骨架。
- 点击日期会更新右侧当天检查面板；点击 `查看当天` 才进入 `view=day`。

#### 范围

本步已完成并继续保留为当前基线：
- `src/app/calendar/page.tsx`
- `SiteHeader` 增加“记录日历”入口
- 月视图网格
- 当天检查面板
- 月视图 URL 驱动
- 月视图到访谈页的深链规则
- header 中区的 calendar 控制条
- 首屏工作区与双栏骨架

本步不做：
- 新的数据库迁移
- 单独的日志详情页

#### 默认假设

第 5 步原始规格里的这些默认假设，当前只有一部分还有效：

- `/calendar` 仍以 `view=month` 作为默认落点
- URL 现在已经正式支持：
  - `/calendar?view=month&date=2026-05-01`
  - `/calendar?view=week&date=2026-05-01`
  - `/calendar?view=day&date=2026-05-01`
- `date` 既是当前月份 anchor，也是当前选中日期
- V1 默认进入页面后就以 `date` 对应的当天作为当前选中日期，并展示右侧当天检查面板
- 如果后续产品决定“默认不自动展开面板”，可以只改前端局部状态，不需要改 API 或数据契约

#### URL 与导航契约

`/calendar`
- 无 query 时，前端应归一到：
  - `/calendar?view=month&date=<北京时间今天>`

`view`
- 当前接受：
  - `month`
  - `week`
  - `day`
- 无效值仍归一回 `month`

`date`
- 必须是 `YYYY-MM-DD`
- 非法日期归一到北京时间今天
- 月视图展示月份由 `date` 派生，不单独维护 `month` query

月份切换规则：
- 点击“上月 / 下月”时，保留当前“日”部分
- 如果目标月份没有这一日，则自动 clamp 到该月最后一天
- 例：
  - `2026-03-31 -> 上月 => 2026-02-28`
  - `2026-01-31 -> 下月 => 2026-02-28`

回到今天：
- 保留当前 `view`
- 把 `date` 归一到 `<北京时间今天>`

点击日期：
- 更新 URL 中的 `date`
- 不直接跳去别页
- 只更新选中态并刷新当天检查面板
- 进入单日阅读页的日期级入口固定为：
  - `查看当天`
  - `/calendar?view=day&date=YYYY-MM-DD`

#### header 导航

当前 `SiteHeader` 的真实行为：
- 顶部导航项里已有 `记录日历`
- 点击它会进入：
  - `/calendar?view=month&date=<北京时间今天>`
- header 中区现在会在 calendar 页面接管：
  - 当前时间范围标题
  - `month / week / day` 切换
  - 前后翻段
  - 回到今天
  - 实时 summary chips
- 主导航当前页使用贴近文字的暖棕实线下划线，不再使用填充方框；calendar toolbar 内部按“翻段 / 标题摘要 / 今天 / 视图切换”用 `｜` 分隔。
- `SiteHeader` 会在客户端测量真实 header 高度，并写回 `--site-header-viewport-offset`；calendar / analysis / settings 这类首屏工作区都按真实 header 高度后的剩余视口布局，不再假设顶部永远只有 `4rem`。
- 主导航已有 `分析` 项，点击进入 `/analysis?month=<北京时间当前 YYYY-MM>`，默认 `section=overview`。

#### 页面与组件拆分

建议最小拆分如下：

- `src/app/calendar/page.tsx`
  - 页面入口
  - 负责 search params 归一与整体壳子
- `src/components/calendar/calendar-month-shell.tsx`
  - 月视图主容器
  - 负责数据请求、选中日期、双栏工作区和错误 / loading 状态
- `src/components/calendar/calendar-month-grid.tsx`
  - 月网格与低密度日期格
- `src/components/calendar/calendar-month-day-panel.tsx`
  - 右侧当天检查面板
- `src/components/calendar/calendar-toolbar.tsx`
  - header 中区的 calendar 控制条
- `src/features/calendar/view-state.ts`
  - URL 解析、日期 clamp、month key 推导
- `src/features/calendar/month-view.ts`
  - 月格预览与当天检查面板投影
- `src/features/calendar/toolbar.ts`
  - header 标题、前后翻段与 summary chip 的前端投影
- `src/features/calendar/interview-link.ts`
  - 从 day/dimension 记录生成 day/week 主动作跳转链接

重点：
- 第 5 步不要把 month 视图逻辑塞进 `page.tsx`
- 也不要把“如何从 calendar record 生成访谈入口”散落在多个组件里

#### 数据获取策略

月视图主数据源固定为：
- `GET /api/calendar/month?month=YYYY-MM`

月视图正文默认不额外请求 day API：
- 当天检查面板直接使用 month payload 中对应 day record
- 这样可以避免点击日期后二次 loading

当前 header 中区会额外按 `view` 请求 month / week / day 数据，用来生成标题和实时摘要 chip；这层请求只服务 toolbar，不改变正文 month view 仍以 month payload 为主的事实。

#### 月视图网格规格

基础规则：
- 一周从周一开始，到周日结束
- 固定 7 列
- 固定渲染 6 行 `42` 格，保证每个月份的网格高度一致
- 当前月之外的格子用占位空槽补齐，不展示相邻月份真实数据
- 占位槽不响应点击

为什么继续保留占位槽而不是相邻月数据：
- 第 5 步直接复用 month API，不额外请求前后月份
- 先把“当前月分布 + 当日详情 + 下一步动作”这条主链做稳

每个当月日期格至少展示：
- 日期数字
- today / selected 视觉态
- 整体状态底色/描边
- 月格可见文字层：
  - `1-4` 个已保存维度：显示单字 `悦 / 实 / 思 / 改 / 谢`
  - `5` 个维度都至少保存过一次：显示 `已完成`
  - 纯草稿且没有任何已保存维度：显示 `草稿`
- 其余状态不再额外占用文字位，由状态符号和颜色层承担

状态视觉要求：
- `empty`
  - 低对比、轻边框
- `in_progress`
  - 明显提示“还在进行中”
- `draft`
  - 比进行中更稳定，但弱于已完成
- `completed`
  - 最强调
- `mixed`
  - 不伪装成单一状态，要保留“多状态并存”的感觉

今天态与选中态：
- 今天高亮和选中态必须可同时存在
- 不能因为今天被选中，就看不出“今天”本身
- today 圆点绑定到日期锚点附近，不再与右上角状态文本争同一块区域

空白日语义：
- `过去 / 今天` 的空白日：
  - 不强制显示 `未记录`
  - 不强制显示 `还没有记录。`
  - 没有单字结果标签本身就表示尚未形成已保存结果
- `未来` 的空白日：
  - 不显示 `未记录`
  - 不显示 `还没有记录。`
  - 只保留日期和更轻的空白表面，表达“这一天还没到”

未来日期：
- 仍然在月历中展示
- 视觉上比过去/今天更轻一点
- 如果 API 返回没有动作，前端不能自己补 `start_interview`

#### 五维轻量标记

每个日期格都要展示五维轻量标记，维度顺序固定为：
- `joy`
- `fulfillment`
- `reflection`
- `improvement`
- `gratitude`

当前形式：
- 月格把“已保存维度”投影到可见文字层
- 可见 token 固定为 `悦 / 实 / 思 / 改 / 谢`
- token 只表示“该维度当天已有保存结果”，不直接表示正在访谈或仅有草稿

辅助语义要求：
- 可见 token 可以是单字
- accessible name 仍需保留完整维度名 `开心 / 充实 / 思考 / 改进 / 感谢`
- 周视图、日视图与月视图右侧检查面板沿用同一套单字 badge 语法，但读屏语义不能退化

#### 顶部摘要 chip

月视图正文不再放 4 张统计卡。当前摘要收口到 header 中区的实时 chip，由 `src/features/calendar/toolbar.ts` 基于当前 `view/date` 请求结果投影：

- 月视图：本月有记录天数、待继续天数、覆盖维度数
- 周视图：本周有记录天数、草稿条数、完成条数
- 日视图：当天进行中、草稿、已完成数量

第 5 步不做：
- 连续记录 streak
- 完成率百分比
- 跨月趋势图

#### 当天检查面板规格

交互形式固定采用：
- 桌面：月历主体在左，当天检查面板常驻右侧
- 中小屏：月历主体在上，当天检查面板在下，同一套选中日期和 `查看当天` 语义不变，不再依赖横向滚动访问右侧面板

采用这个默认的原因：
- 月视图只回答“先扫月分布，再锁定某一天”
- 当天具体五维动作分发统一交给 `view=day`
- 避免 month 视图和 day 视图同时承载五维入口，导致动作语义分裂

当天检查面板只展示：
- 日期
- 整体状态
- 当日标题 / 摘要
- `待继续 / 已完成 / 完整日志` summary chip
- 如果有进行中或草稿，显示一句低压待继续提示
- 非空日展示已触达维度的状态、标题和安全摘要
- 过去空白日只展示轻空态，不列 5 个空维度
- 最后更新时间
- 日期级入口 `查看当天`

`完整日志` chip 的显示规则：
- 已保存当天整合日志：`已保存`
- 当天整合日志草稿：`草稿`
- 来源维度日志更新后：`需更新`
- 没有当天整合日志但已有已保存维度日志：`可汇总`
- 没有可汇总来源：`未生成`

当天检查面板明确不展示：
- 原始数据库 id
- `payload / snapshotData / pendingDecision`
- 多段长正文
- 访谈消息列表
- 五个维度的开始 / 继续 / 编辑按钮

#### 当天检查面板动作规则

月视图只保留一个明确主入口：
- `查看当天`
- `/calendar?view=day&date=YYYY-MM-DD`

原因：
- 月视图是总入口，不直接替代日视图
- 同一天可能有多个维度并存，月视图不做维度级主动作决策
- `start_interview / continue_interview / continue_editing / view_journal / edit_saved_journal` 的完整优先级统一在 day view 和 week view 解析

#### 从月视图跳到访谈页的深链契约

这是第 5 步必须一起定死的内容，否则月视图按钮无法真正可用。

开始某一维度访谈：
- `/interview?dimension=<dimension>&entryDate=YYYY-MM-DD`

继续某个会话：
- `/interview?dimension=<dimension>&sessionId=<sessionId>&entryDate=YYYY-MM-DD`

继续编辑草稿：
- `/interview?dimension=<dimension>&sessionId=<sessionId>&panel=journal`

查看日志：
- `/interview?dimension=<dimension>&sessionId=<sessionId>&panel=journal`

编辑日志：
- `/interview?dimension=<dimension>&sessionId=<sessionId>&panel=journal`

说明：
- 当前产品还没有独立日志详情页
- 所以 `查看日志 / 编辑日志` 当前都落到同一个 journaling 工作区，但前端展示语义必须区分：
  - 已保存维度的主按钮是 `查看日志`
  - `编辑日志` 只作为次级轻链接保留
- 如果实现成本可控，`编辑日志` 可以额外把焦点落到正文编辑器；但这不是第 5 步硬要求

#### 访谈页需要补齐的接缝

为了让第 5 步真正闭环，`/interview` 页至少要补这几个 deep-link 规则：

1. 显式 `sessionId` 优先级最高
   - 如果 URL 里有 `sessionId`
   - 先拉这个 session
   - 不允许本地“按维度缓存恢复”的旧逻辑把它覆盖掉

2. 显式 `entryDate` 其次
   - 如果没有 `sessionId`，但有 `entryDate`
   - 新开会话时要把这个日期带给 `POST /api/interview/session/start`
   - 进入带 `entryDate` 的访谈页后，当前选中维度胶囊应优先反映 live session 的实时轮次 / 进度圈；其余维度继续按 day snapshot 展示

2.5. 普通 `/interview` 默认按“今天”恢复
   - 如果没有显式 `sessionId`，也没有显式 `entryDate`
   - 本地按维度缓存的 session 只有在 `entryDate === 今天` 时才允许自动恢复
   - 当前页面已经挂载的 live session 也只有在 `entryDate === 今天` 时才允许被 plain `/interview` 静默复用；如果它属于昨天，前端必须新开今天 session
   - 如果缓存里的 session 属于别的日期，前端应清掉该维度缓存并新开今天的 session
   - 访谈页正文区应明确显示“当前记录日期：YYYY-MM-DD”，让用户知道这轮内容会归到哪一天
   - 如果当前正在显示 inline choice card，聊天记录里应隐藏所有 choice turn；只有当 card 消失后、且某条历史 choice 最终停在 transcript 末尾时，它才应重新可见

3. 显式 query 高于本地 remembered dimension
   - `dimension / sessionId / entryDate / panel` 都高于 localStorage fallback

4. `panel=journal`
   - 进入后默认打开右侧日志工作区

5. `mode=daily-journal`
   - 进入后打开当天整合日志主区
   - 日期优先使用 URL 的 `entryDate`
   - 这个模式不启动普通维度访谈，不调用 `/api/interview/session/start`，也不会因为 calendar 的当天日志入口创建新的 joy session
   - 用户点击“回到访谈”时应先保存当天日志 pending 编辑，再移除 `mode=daily-journal`，回到同一 `dimension + entryDate` 的普通访谈 hydrate 流程
   - 如果用户在当天日志主区切换维度，且 URL 没有继续携带 `mode=daily-journal`，前端应保存 pending 编辑并回到普通访谈工作区

第 5 步不要求把 session 缓存结构从“按维度”彻底重构成“按维度 + 日期”，但显式 deep link 不能再被旧缓存误恢复；普通 `/interview` 也不能再跨天误恢复旧 session。

#### 页面状态

至少覆盖这些状态：

加载中：
- 页面壳子先出来
- 月格子区域保持工作区结构，并渲染与真实月格一致的 6 行 `42` 格 skeleton
- 当天检查面板有对应 skeleton

空月：
- 即整个月 `recordedDayCount = 0`
- 仍然正常显示日历网格
- 右侧当天检查面板默认落在当前选中日
- 给出一句轻提示，例如：
  - `这个月还没有开始记录，可以从某一天先写起。`

请求失败：
- 保留“月历主体 + 当天检查”的 split-pane 方框骨架
- 主区和右侧 pane 各自展示错误说明与重试按钮
- 不要把整个页面打成空白
- 右侧当天检查面板不能 fallback 成当前选中日期的假空白日，应显示“当天检查暂时不可用”并提供重试

未来日期空状态：
- 页面能展示
- 当天检查面板不出现开始按钮
- 需要有明确的未来日期说明

#### 响应式规则

桌面：
- 月网格 + 当天检查面板并列
- 当天检查面板默认常驻右侧

平板：
- 月网格在上，当天检查面板在下，保留同一套选中日期状态

手机：
- 不再生成底部重复详情
- 月网格在上，当天检查面板在下，不通过 `1040px` 最小宽度制造横向滚动

#### 可访问性与交互底线

- 日期格必须是 button，不是 div
- 当前选中日期要有 `aria-pressed` 或等价选中语义
- 今天要有可被读屏识别的文案，例如 `今天`
- 键盘可以切换日期格并更新当天检查面板
- `查看当天` 必须是可聚焦链接，目标固定为 `view=day`

#### 实现清单

第 5 步当前已完成并应继续保持：

1. 新增 `/calendar` 页面
2. `SiteHeader` 增加“记录日历”导航项
3. 新增 month view 的 URL 解析与日期 helper
4. 接 `GET /api/calendar/month`
5. 做 7x6 月网格、状态强提示、短标题 / 摘要和少量维度标识
6. 删除正文里的 4 张统计卡，摘要收口到 header chip
7. 做桌面右侧常驻、小屏下方堆叠的当天检查面板
8. 点击日期即时更新右侧面板，不直接跳页
9. `查看当天` 跳转到 `/calendar?view=day&date=YYYY-MM-DD`
10. 让 `/interview` 正确响应 day/week 产生的 `sessionId / entryDate / panel`
11. 更新 `README.md`、`docs/architecture.md`、`docs/integration-guide.md`、`docs/handoff.md` 中的当前事实

#### 自动化验收

当前已覆盖：

- `tests/unit/calendar-month-shell.test.tsx`
  - 校验 `/calendar?view=month` 缺省日期归一到北京时间今天
  - 校验月视图稳定渲染 `42` 个格位
  - 校验有记录日、无记录日、今天、当前选中日具备可区分状态标记
  - 校验点击某一天会更新右侧当天检查面板
  - 校验 `查看当天` 会跳到 `/calendar?view=day&date=YYYY-MM-DD`
  - 校验未来空白日不再显示 `未记录 / 还没有记录。`
  - 校验 loading skeleton 也保持 `42` 个格位
  - 校验月查询失败时右侧不显示假空白日
  - 校验过去空白日右侧走轻空态，不渲染 5 个空维度
  - 校验正文 shell 不再承载旧导航和统计卡

#### 人工验收

1. 访问 `/calendar`
   预期：进入当月月视图；能看到今天高亮、header 中区的实时摘要，以及当天检查面板。

2. 点击某个有记录的日期
   预期：不跳页；右侧当天检查面板即时更新；能看到日期、状态、当日概况、涉及维度，以及 `查看当天` 入口。

3. 点击某个过去但未记录的日期
   预期：当天检查面板不直接展示 5 个维度开始按钮，而是提示先进入 `view=day` 再从五维里选择。

4. 点击某个未来日期
   预期：能打开当天检查面板，但没有直接开始入口；月格和当天检查面板都不再显示 `未记录 / 还没有记录。`，而改成中性 future 语义。

5. 点击某个“进行中”日期的继续访谈
   预期：跳去正确维度的 `/interview`，且带显式 `sessionId`，不会被旧的维度缓存恢复到别的日期。

#### 完成标志

满足以下条件，第 5 步才算完成：
- `/calendar` 月视图能独立展示当月分布
- 用户能在月视图内看清某一天的整体状态与五维情况
- 点击某一天后，右侧当天检查面板会即时更新，并能通过 `查看当天` 进入单日日视图
- 未来日期限制、状态展示和 `view=day` 衔接都按规格跑通

### 5.12 Step 6: week view 可执行规格回顾

本节记录第 6 步已经落地的基线。当前周视图不是小时级时间轴，也不是纵向 7 条列表，而是 7 天同屏对比板；用户可以直接在这一层判断哪一天最值得继续，并通过主动作直达业务链路。

#### 当前实现结果

- `/calendar` 已支持 `view=week`
- 周视图主数据源固定为 `GET /api/calendar/week?date=YYYY-MM-DD`
- 顶部支持：
  - `month / week / day` 切换
  - 前后翻段
  - 回到今天
- 周主体固定展示 7 张等权重日卡，每天只保留：
  - 日期
  - 整体状态
  - 完成 / 草稿 / 进行中摘要
  - 一句短判断文案
  - 唯一主动作
- 主动作优先级当前按现有 `primaryAction` 直达：
  - `继续访谈`
  - `继续编辑`
  - `查看日志`
  - 如果没有可直达动作，则回退 `查看当天`
- 周摘要已经压缩成轻量顶部辅助块，不再保留厚重侧栏
- 周视图当前已经被收进首屏工作区；7 天卡片会在一个固定板体内同屏比较，窄屏时通过横向滚动保持列板语义
- 周视图与月视图、日视图共享同一套状态颜色和单字 badge `悦 / 实 / 思 / 改 / 谢`，但不复用 month 的当天检查面板结构

#### 自动化验收

本步新增并已通过：

- `tests/unit/calendar-view-state.test.ts`
  - 校验 `week / day` view 归一
  - 校验周范围按周一到周日计算
  - 校验周切换以 7 天为步长
- `tests/unit/calendar-week-shell.test.tsx`
  - 校验 `/calendar?view=week` 缺省日期会归一到北京时间今天
  - 校验周视图固定渲染 7 张对比卡
  - 校验已完成 / 草稿 / 进行中日期会给出稳定的主动作跳转
  - 校验空白日和 future day 会回退到 `查看当天`
  - 校验周导航按钮不再出现在正文 shell 内

#### 当前边界

- 周视图已经能独立完成“看这周节奏”和“判断先点哪一天”
- day 视图已经是“某一天五维记录”的统一阅读与动作分发入口
- day 视图仍然不做时间轴、不展示内部槽位、不内联正文编辑

### 5.13 Step 7: day view 可执行规格回顾

本节记录第 7 步已经落地的基线。当前 `view=day` 不再复用 month 的当天检查面板放大版，而是使用 dedicated day layout，按“五维紧凑操作台”组织某一天的统一阅读与分发。

#### 当前实现结果

- `/calendar` 已支持 `view=day`
- 日视图主数据源固定为 `GET /api/calendar/day?date=YYYY-MM-DD`
- 顶部支持：
  - `month / week / day` 切换
  - 前后翻段
  - 回到今天
- 页面总览区固定展示：
  - 日期
  - 当天整体状态
  - 主标题或主摘要
  - 最后更新时间
  - `active / draft / saved` 数量概览
- 页面主体按固定顺序展示五维卡片：
  - `joy`
  - `fulfillment`
  - `reflection`
  - `improvement`
  - `gratitude`
- 每条卡当前固定展示：
  - 维度身份
  - 当前状态
  - 标题或一句摘要
  - 唯一主按钮
  - 最多 1-2 个次级轻链接
- 主按钮当前不再吃 `dimension.actions` 原始顺序，而是前端固定按以下优先级解析：
  - 有进行中会话：`继续访谈`
  - 否则有草稿：`继续编辑`
  - 否则有已保存：`查看日志`
  - 否则：`开始记录`
- 已保存维度当前固定：
  - 主按钮：`查看日志`
  - 次级轻链接：`编辑日志`
- `mixed` 维度当前固定：
  - 主按钮按上述优先级稳定选择
  - 其余入口降为次级轻链接
- 日视图继续复用现有 `/interview` 工作区链路：
  - 访谈入口用 `entryDate`
  - 已完成日志继续落到现有 `panel=journal` 工作区
- 日视图当前已经进入首屏工作区；主内容放进固定主 pane 内滚动，不再依赖整页长滚动
- 日视图当前已经收成固定顺序的五维紧凑操作台；可见维度 badge 统一改成单字 `悦 / 实 / 思 / 改 / 谢`

#### 自动化验收

本步新增并已通过：

- `tests/unit/calendar-day-shell.test.tsx`
  - 校验 `view=day` 缺省日期归一
  - 校验 dedicated day view 会固定渲染 5 张维度卡
  - 校验草稿维度主按钮固定为 `继续编辑`
  - 校验已保存维度主按钮固定为 `查看日志`，`编辑日志` 只作为次级入口保留
  - 校验 mixed 维度即使 `actions` 顺序被打乱，主按钮仍稳定为 `继续访谈`
  - 校验未来空白卡不会暴露可点击 `开始记录` 入口
  - 校验正文 shell 不再承载旧的日级导航按钮
- `tests/unit/calendar-interview-link.test.ts`
  - 校验 `resolveCalendarPrimaryAction` 会按状态优先级稳定决策
  - 校验 day view 卡片的主 / 次动作输出不依赖原始 action 顺序

#### 当前边界

- 日视图是主阅读与分发页，不是编辑页
- 不展示内部槽位
- 不做时间轴
- 不在页面内联正文编辑

### 5.14 Step 7: 文案、可达性与验收收口回顾

本节记录同一轮 calendar 收尾里已经补齐的文案和可达性基线。它不改变 `month / week / day` 的信息架构和主动作优先级，只让当前工作台更短句、更可达、更易回归。

#### 当前实现结果

- calendar 内已移除模板化英文眉题，不再保留 `DAY / WEEK` 装饰性标题
- month / week / day 的 fallback 文案已经压成工作台短句：
  - `还没有记录。`
  - `未来日期暂不支持开始记录。`
  - `本周还没有记录。`
  - `正在读取本月/本周/当天记录。`
- `CalendarToolbar`、month shell、week shell、day shell 当前都补了 `aria-busy`
- loading 当前统一用结构化 skeleton + `role="status"` 短状态文案
- error 当前统一为卡片内联 `role="alert"` + 单个 `重新加载`
- month 日期按钮、week/day 主动作、次动作和 `查看当天` 当前都补了更完整的 accessible name
- view switcher 当前保留原生 button 语义，并给 `月 / 周 / 日` 补了明确切换名称
- 维度状态当前不再只靠颜色；month / week / day 三层都能从 badge 或 accessible name 读到文本状态

#### 自动化验收

本步新增并已通过：

- `tests/unit/calendar-month-shell.test.tsx`
  - 校验 month shell loading 期 `aria-busy` 和 `status`
  - 校验日期按钮 accessible name 包含今天 / 选中 / 状态 / 摘要
  - 校验 month panel 已移除英文眉题
- `tests/unit/calendar-week-shell.test.tsx`
  - 校验 week shell 的 loading/error 语义
  - 校验周卡主动作的 accessible name 含状态与判断信息
- `tests/unit/calendar-day-shell.test.tsx`
  - 校验 day shell 的 loading/error 语义
  - 校验 future day 禁用态的 accessible name
  - 校验日视图已移除英文眉题
- `tests/unit/site-header-calendar.test.tsx`
  - 校验 toolbar 的 `aria-busy`
  - 校验 loading `status` 与 error `alert`
  - 校验 `切换到周视图 / 回到今天` 等更完整按钮名称
- `tests/unit/calendar-presentation.test.ts`
  - 校验 accessible name helper 与 loading/error copy helper 的稳定输出

### 5.15 Step 8: 回归、文档与交付收口基线

本节记录第 8 步已经落地后的最终交付基线。它不新增 public API，而是把 `entryDate`、calendar read model、month/week/day 三视图和 `/calendar -> /interview` 深链固化为稳定契约。

当前视觉层也已经补齐：
- month / week / day 三个视图共用暖色 calendar 工作台
- 状态五态 `empty / in_progress / draft / completed / mixed` 的 badge / surface / marker class 由 `src/features/calendar/presentation.ts` 统一投影
- 五个维度当前在可见 badge 上统一使用单字 `悦 / 实 / 思 / 改 / 谢`，辅助技术继续暴露完整维度名 `开心 / 充实 / 思考 / 改进 / 感谢`
- 主按钮、次按钮和禁用态现在有稳定层级，不再由各视图各自拼装
- `SiteHeader` 已统一为全宽暖色工具栏，访谈维度条与 calendar toolbar 共用中区高度预算与横向 gutter，业务组用 `｜` 分隔；主导航当前页使用贴近文字的实线下划线，不再套独立中区外框

#### 当前自动化基线

- `npx tsc --noEmit`
- `npm test`

### 5.14 Analysis 评分、热力与五维洞察

当前 `/analysis?month=YYYY-MM&section=overview|score|rhythm|insights` 已完成月份级日志分析的 tab 互斥视图与页面接线，并接入五维结构化洞察、幸福 8 要素评分录入面板、本月热力图和轻量 SVG 评分趋势图。

已落地行为：
- 缺失或非法 `month` 参数归一到北京时间当前月；缺失或非法 `section` 参数归一到 `overview`
- `上月 / 本月 / 下月` 控件通过 `router.replace` 更新 `month` 并保留当前 `section`
- 页面按 `section` 只渲染对应板块（总览 / 评分 / 节奏 / 五维洞察）；`overview` 总览只在默认视图内渲染月度判断、建议先看主行动、轻入口和证据条；切换 tab 或翻月后 `section` 保留在 URL 中
- 已有 `GET /api/analysis/month?month=YYYY-MM`
- API 当前返回：
  - `month`
  - `logOverview`
  - `dailyCoverage`
  - `rhythmOverview`
  - `dimensionBreakdown`
  - `dimensions`
  - `insightsOverview`
  - `scoreOverview`
  - `scoreTrend`
  - `scoreRecords`
  - `editableDates`
  - `narrative`（当前为确定性占位，预留 AI 接入口；不可用时返回 `null`，前端自动降级到模板文本）
- 页面当前已展示：
  - 顶部月度摘要：`SummaryHero` 月度判断面板；只有在 `narrative.overviewNarrative` 足够表达当前状态时才覆盖模板文案。未来月份空态、待整合日、只有评分未成文、没有已保存日志这些场景会继续保留模板侧的状态判断和动作导向
  - `overview`：默认视图，展示 `SummaryHero` + 洞察卡片（`narrative.insightCards`，类型 / 标题 / 证据 / 关联日期）+ `OverviewAnchorCTA` 数据锚点
  - `score`：展示 `幸福 8 要素评分` 录入面板；评分区当前是补录优先的双栏工作台，左侧先处理今天 / 昨天状态、填写进度和 8 项列表，右侧只编辑当前要素的 `1..10` 刻度，未填不再默认落在 `5` 分；今天和昨天都补齐后，首屏再回到总分平均走势、8 要素快扫和单项细看。趋势高亮卡自动关联维度日志上下文；总分趋势图数据点可点击弹出当日日志详情卡（均分 + 日志标题 / 预览 + 日历日链接），并区分“已有完整日志”“已有维度记录但未整合”“完全没生成日志”
  - `rhythm`：本月状态优先热力图、最长连续记录 / 空档与当天 drill-in；选中日面板新增日志预览区（`journalTitle` / `contentPreview` + 日历日链接），tooltip 显示日志整合状态；`saved` 但来源签名失配的当天整合日志会显示为 `待更新 / 待整合`
  - `insights`：本月判断、五维全景、维度之间和下一步四层洞察布局；维度主题优先使用 `narrative.dimensionTheses`，降级到模板文本；证据区增加日历日链接；watchpoint 优先提示 `stale` 的当天整合日志，再退回 quiet lagging / quiet missing 的评分联动提示
  - 空数据月份直接显示真实空态，不再使用示意填充；这不会影响评分保存和 `editableDates`
  - 只有评分、没有维度日志的月份不会伪造 `已整合`、密度结论或 `主线维度`，而是显示空态
  - 未来月份如果没有任何材料，总览首屏会给中性提示并引导回到当前月份，不会把用户送去今天的访谈
  - 分析页里“回到某维度”的下钻链接会保留对应 `entryDate`，保证历史月份能回到原始记录日期
  - 未来日期的热力区 drill-down 只允许 `查看当天`，不暴露 `开始这一天的记录 / 继续当天记录`
  - `insights` 的 headline / watchpoint 和“评分低点还没写出来”卡片会共用同一套 quiet lagging 维度排序，避免不同模块给出互相矛盾的维度指引

当前聚合规则：
- 只统计 `JoyEntry.status = saved`
- 只把 `DailyJournalEntry.status = saved` 计入整合日志完成天数；如果其 `sourceSignature` 与“同一天每个维度最新一篇 `saved` 日志”的签名不一致，analysis 会把它标为 `hasStaleDailyJournal = true`，并在 `rhythm / insights` 中按待更新处理；即使当天已没有任何 `saved` 来源，这个 `stale` 状态也不会被漏掉
- `dailyCoverage` 覆盖当月所有自然日，并按天返回 `savedEntryCount / savedDimensionCount / hasDailyJournalSaved / hasStaleDailyJournal / hasScore / averageScore / journalTitle / contentPreview`；`journalTitle` 和 `contentPreview` 只在当天有 `saved` 整合日志时有值，`contentPreview` 为正文前 3 行截断（最长 120 字）
- 当前月 `最长空档` 只在已发生的自然日范围内计算，不把未来日期计入空档；未来月份直接返回 `longestGap = null`
- `dimensionBreakdown` 固定返回五维顺序
- `scoreTrend.days` 覆盖当月所有自然日，每日总分为 8 项平均分，保留 1 位小数
- 未评分日期返回 `averageScore: null`、单项分数为 `null`、`hasScore: false`，前端 SVG 断线，不补 0
- `scoreTrend.factorAverages` 返回 8 要素本月平均分，只统计已评分日期，保留 1 位小数
- 前端只有在至少 2 天评分且各要素间存在真实均值/波动差异时，才把 `scoreTrend.factorAverages` 投影成 `长期偏高 / 最常掉下来 / 波动最大` 排名卡；否则只显示“仅供参考”的提示
- `scoreRecords` 返回当前分析月内已有评分记录；如果今天是自然月 1 日，也会额外带上昨天的评分记录
- `editableDates` 只在当前分析月返回今天和昨天；月初时昨天即使属于上月也会保留

当前未完成：
- 生成式 AI 月度洞察

#### 5.14.1 保存幸福 8 要素日评分

`PUT /api/happiness-score`

请求体固定为：

```json
{
  "date": "2026-05-03",
  "scores": {
    "meaning": 8,
    "health": 7,
    "virtue": 9,
    "autonomy": 6,
    "interest": 8,
    "skill": 7,
    "relationship": 9,
    "livingCondition": 6
  }
}
```

规则：
- 8 项必填
- 每项必须是 `1..10` 整数
- 只允许保存 Asia/Shanghai 口径下的今天和昨天
- 保存按 `userId + date` upsert，写入前会确保 demo user 存在

错误码：
- `INVALID_HAPPINESS_SCORE_REQUEST`：请求体缺项、日期非法、分数非整数或越界
- `HAPPINESS_SCORE_EDIT_WINDOW_EXCEEDED`：日期不在今天或昨天
- `HAPPINESS_SCORE_SAVE_FAILED`：数据库保存失败

#### Step 8 明确补齐的回归面

- `tests/unit/interview-start.api.test.ts`
  - 校验 `POST /api/interview/session/start` 会透传 `entryDate`
  - 校验非法 `entryDate` 返回 `INVALID_START_REQUEST`
- `tests/unit/calendar.repository.test.ts`
  - 校验 legacy session 缺少 `entryDate` 时，calendar source 会回退到 `startedAt`
- `tests/unit/calendar-month-shell.test.tsx`
  - 校验月视图桌面双栏语义、小屏上下堆叠约束、当天检查面板和 `查看当天` 日期级入口
- `tests/unit/calendar-presentation.test.ts`
  - 校验状态五态映射为不同 visual meta
  - 校验五个维度的单字 badge `悦 / 实 / 思 / 改 / 谢` 与完整语义映射稳定
- `tests/unit/calendar-day-shell.test.tsx`
  - 额外校验维度卡会暴露稳定 `data-dimension`
  - 额外校验未来空白卡的禁用动作语义
- `tests/unit/calendar-week-shell.test.tsx`
  - 额外校验周卡会展示稳定维度标识
  - 额外校验 `查看日志 / 查看当天` 的动作层级语义
- `tests/unit/site-header-calendar.test.tsx`
  - 额外校验 toolbar 的 `aria-busy`、loading `status` 和 error `alert`

#### 当前人工验收基线

- 访谈主链路正常
- 生成日志 / 重新生成已有日志 / 保存日志正常
- 刷新恢复 session 正常
- 用户边界表达后的 partial 收束正常
- 标题不会退回长事件句截断
- 从 calendar 进入访谈 / 编辑 / 查看的链路正确
- 过去日期补写以 `entryDate` 为准
- 未来日期可查询，但不能开始或继续访谈
