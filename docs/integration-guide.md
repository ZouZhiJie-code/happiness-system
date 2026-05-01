# Integration Guide

最后更新：`2026-05-01`

本文记录当前仓库真实存在的访谈与日志接口，供前端联调、测试脚本和后续接手者使用。

## 1. 总体说明

- 所有会话相关接口都在 `src/app/api/interview/session/*`
- 主前端访谈链路使用 `respond/stream`
- 大多数成功响应最终都会返回一份完整 `session`，前端用它做 hydrate
- 当前“生成日志”只支持单个 `sessionId`
- `joy / fulfillment / reflection / improvement / gratitude` 已完成理论对齐深化

## 2. 路由清单

| 方法 | 路径 | 用途 | 备注 |
|---|---|---|---|
| `POST` | `/api/interview/session/start` | 启动某个维度的访谈 | 传 `dimension` |
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
| `POST` | `/api/transcribe` | 语音转文字 | 当前是 stub |

## 3. 请求与返回

### 3.1 启动访谈

`POST /api/interview/session/start`

请求：

```json
{
  "dimension": "fulfillment"
}
```

返回：

```json
{
  "sessionId": "cuid",
  "openingQuestion": "string",
  "session": { "...完整 interviewSessionSchema..." }
}
```

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
- 如果当前草稿已经覆盖到最新访谈状态，再次点击“生成日志”不会重新请求，而是直接复用当前版本，并提示“当前已经是最新版本”。
- 生成中当前采用阶段式反馈：
  - `正在生成日志骨架`
  - `正在打磨日志细节`
  - `最终润色中`
- `fulfillment` 生成日志时会按“具体片段 -> 进展 / 积累 / 贡献证据 -> 为什么今天不算白过 -> 轻收”组织正文。
- `fulfillment` 完整模式才允许轻收“值得感标准”；partial 模式不会硬写 `selfPattern`。
- `reflection` 生成日志时会按“触发片段 -> 原来的疑问或判断 -> 新理解 / 证据 -> 视角变化或判断线索”组织正文。
- `reflection` 完整模式才允许轻收“判断线索”；partial 模式不会硬写 `selfPattern`。
- `improvement` 生成日志时会按“具体情境 -> 好/不理想状态 -> 关键条件或卡点 -> 可控小调整 -> 轻收”组织正文。
- `improvement` 完整模式才允许轻收用户已经说出的 `nextAttempt`；partial 模式只停在当前看见的改进点，不硬写完整方案。
- `gratitude` 生成日志时会按“具体感谢片段 -> 对方行为 -> 被回应的需要 -> 为什么重要 -> 关系线索轻收”组织正文。
- `gratitude` 完整模式才允许轻收 `relationshipSignal`；partial 模式只停在当前感谢，不硬写稳定关系判断或回馈任务。
- 五个维度的标题都会经过后端语义短标题治理，最大 `16` 字；AI 返回的坏标题、流水句或截断句会被确定性标题替换。`improvement` 应优先落到 `表达慢下来 / 先听完再回应 / 把节奏放稳 / 提前留出缓冲 / 把边界说清楚 / 让准备更充分` 这类短标题；`gratitude` 应优先落到 `被稳稳接住 / 被认真理解 / 那句及时提醒 / 有人帮我理清 / 被信任的机会` 这类短标题。

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
- 第一次生成时，右侧会显示阶段式 loading card
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
