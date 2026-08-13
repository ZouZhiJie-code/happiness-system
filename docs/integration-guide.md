# Integration Guide

最后更新：`2026-08-12`

本文记录当前可调用的 HTTP 合同。历史设计与阶段验收记录保存在 `docs/plans/`，系统分层见 `docs/architecture.md`。

## 1. 通用约定

- 应用使用 Next.js Route Handlers。
- 登录态通过 `httpOnly` cookie `dl_session` 传递。
- 认证和公开页面以外的业务接口都要求登录。
- 用户数据按 `userId` 隔离。
- 管理员页面与接口还要求用户名命中 `ADMIN_USERNAMES`。
- 天级业务日期格式固定为 `YYYY-MM-DD`，归档与“当天”判断使用 `Asia/Shanghai`。
- `joy / fulfillment / reflection / improvement / gratitude` 是当前五个访谈维度。
- 生产主域名为 `https://dailylight.chat`。

## GI-088 v8r3 当前运行合同（2026-08-12）

- 当前候选：`2026-08-11.gi088-human-eval-v8r3-skill-ark-flash`，Ark `deepseek-v4-flash-ga-260731`、Thinking high、`json_object`；请求头、正文空闲和单次硬截止均为 `60000ms`，自动恢复链为 `90000ms`。
- 当前 Preview deployment：`dpl_6t4WWXewBbr81ripbr7M76Hu5WXR`，地址见 [v8r3 Preview 证据](../artifacts/generative-interview-board7/2026-08-12-gi088-human-eval-v8r3-golden-eight-preview/README.md)，状态 `READY`。
- 当前 run：`c873ad9a-ab5a-4629-960d-03266bc17b54`，`running / 0/6 / gate=pending / calls=0`；包含 4 条计分轨迹与 2 条兼容冒烟。
- 离线候选首次有效 `76/96 = 79.17%`，可靠性硬门为 `No-Go`。Judge 20+20 作为后置门，当前不进入线上调用链。Production 保持 `legacy + baseline`。

v8r2 API 合同与历史字段继续按冻结版本读取；v8r3 新字段（Skill、模型身份、问题价值分类、v0.7 导出）只对当前候选输出，历史 run 继续按其版本兼容投影。

事件中心发布配置：

- `INTERVIEW_EVENT_CENTERED_MODE` 控制入口与写入范围：`legacy`、`optional`、`event_centered`、`event_recovery`。
- `INTERVIEW_EVENT_CENTERED_STRATEGY` 控制提问链路：`baseline` 或 `generative`。生产默认使用 `baseline`。
- `EVENT_CENTERED_GENERATIVE_MODEL` 用于候选链路独立锁定模型；新事件中心候选固定为 `deepseek-v4-flash`，共享五维聊天模型继续由 `DEEPSEEK_MODEL` 提供。
- `EVENT_CENTERED_JUDGE_*`、`DEEPSEEK_JUDGE_*` 和 `DEEPSEEK_*` 评测凭据只用于本地或隔离评测；不要放入浏览器、公开 API 参数、Trace 或生产请求。
- Board 8 批准前，Production 保持 `legacy + baseline`；已有事件与日志继续可读。
- 历史版本说明：GI-066 自动技术证据已经封存，最新真人体验裁决为 `No-Go`，候选失效。`GI-067 / GI-068～080` 产品规则已冻结；GI-081 已归档为临时 Prompt 诊断基线，GI-088 v1～v8r2 的批次、错误、恢复和 Preview 继续按冻结版本只读保留。当前 v8r3 状态见上方运行合同与 10.2 小节，Production 接入保持关闭并使用 `legacy + baseline`。

## 2. 路由速查

### 2.1 认证与设置

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/auth/register` | 注册并建立登录态 |
| `POST` | `/api/auth/login` | 登录并建立登录态 |
| `POST` | `/api/auth/logout` | 退出当前设备 |
| `GET` | `/api/auth/session` | 查询当前登录态 |
| `POST` | `/api/auth/delete-account` | 用当前密码删除账号 |
| `GET/PATCH` | `/api/settings` | 查询或修改记忆系统开关 |

### 2.2 访谈与日志

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/interview/session/start` | 启动某维度访谈 |
| `GET` | `/api/interview/session/[id]` | 恢复会话 |
| `POST` | `/api/interview/session/respond/stream` | 主前端使用的 SSE 回复 |
| `POST` | `/api/interview/session/respond` | 非流式兼容回复 |
| `POST` | `/api/interview/session/branch/preview` | 只读预览目标回复版本的活动路径 |
| `POST` | `/api/interview/session/branch/select` | 采用目标回复版本并切换活动路径 |
| `POST` | `/api/interview/session/pause` | 暂停会话 |
| `POST` | `/api/interview/session/complete` | 完成会话 |
| `POST` | `/api/interview/session/reopen` | 重开会话 |
| `POST` | `/api/interview/session/draft/generate` | 生成维度日志草稿 |
| `POST` | `/api/interview/session/draft/save` | 保存维度日志 |
| `PUT` | `/api/journal-entry/[id]` | 更新维度日志标题和正文 |
| `PUT` | `/api/joy-entry/[id]` | 兼容旧命名的等价更新接口 |

### 2.3 事件中心 MVP

事件中心采用事件级会话和事件级日志。所有路由要求当前用户登录，并按用户校验根会话、活动分支和日志来源。

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/interview/event-centered/session/start` | 创建或恢复指定 `entryDate` 的事件中心会话 |
| `GET` | `/api/interview/event-centered/session/[id]` | 读取事件中心工作区、消息、检查点和 `allowedActions` |
| `POST` | `/api/interview/event-centered/session/turn` | 显式预留一条用户原话并返回可靠回合确认；供兼容客户端和受控测试使用 |
| `POST` | `/api/interview/event-centered/session/respond/stream` | 执行两段式理解/表达，SSE 返回 `turn / phase / delta / session / error` |
| `POST` | `/api/interview/event-centered/journal/generate` | 冻结来源并生成事件日志草稿；生成位置由 `allowedActions` 控制 |
| `GET` | `/api/interview/event-centered/journal/[id]` | 读取事件日志及当前内容版本 |
| `PATCH` | `/api/interview/event-centered/journal/[id]` | 自动暂存标题和正文；要求 `expectedContentRevision` |
| `POST` | `/api/interview/event-centered/journal/[id]/save` | 将当前草稿按版本号正式保存 |

#### GI-088 私有 Preview 评测接口

这组接口只服务板块 6／7 开发评测，页面入口为 `/preview/gi088-evaluation`。全部请求要求 Preview 环境、专用开关、应用登录和“管理员 ∩ GI-088 评测名单”。

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET/POST` | `/api/preview/gi088/runs` | 列出 run，或以 `clientOperationId` 幂等创建同候选的新 run；创建调用数为零 |
| `GET` | `/api/preview/gi088/session?runId=&taskId=` | 读取指定 run、任务、真实 `runRevision`、gate 和 Trace；历史指纹进入只读投影 |
| `POST` | `/api/preview/gi088/start-task` | 在指定 run 启动 Thinking high 任务并写入操作账本 |
| `POST` | `/api/preview/gi088/turn` | 绑定 `clientTurnId` 与 `baseAssistantMessageId` 提交真实输入 |
| `POST` | `/api/preview/gi088/retry` | 只接受用户主动的第三次生成；自动恢复由服务端执行 |
| `POST` | `/api/preview/gi088/question-review`、`program-intervention-review`、`end-trajectory` | 绑定观察或轨迹快照提交、修订人工证据 |
| `POST` | `/api/preview/gi088/abort-current-task` | 保留部分证据并终止当前项，后续任务仍可采集 |
| `POST` | `/api/preview/gi088/early-stop`、`seal` | 分别收口部分 run 或完整 run |
| `POST` | `/api/preview/gi088/compare` | 历史兼容占位；v8r2 固定返回 `GI088_COMPARISON_NOT_REQUIRED` |
| `POST` | `/api/preview/gi088/operation-events` | 幂等保存脱敏客户端摩擦，并校验 run／task／turn 血缘 |
| `POST` | `/api/preview/gi088/compatibility-smoke` | 为 v8r3 的【帮我记】兼容冒烟登记产品会话证据；不调用模型 |
| `GET` | `/api/preview/gi088/export?runId=` | 当前候选冻结 v0.7 payload 与 receipt；历史 v0.6 run 逐字节只读兼容，重复下载返回同一快照 |
| `POST` | `/api/preview/gi088/smoke` | 历史隔离技术冒烟入口；v8r2 开门流程不调用 |

### 2.4 当天整合日志

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/daily-journal?date=YYYY-MM-DD` | 查询当天整合日志与来源 |
| `GET` | `/api/daily-journal/board?date=YYYY-MM-DD` | 查询今日日志面板五维状态 |
| `POST` | `/api/daily-journal/generate` | 基于已保存维度日志生成日级草稿 |
| `POST` | `/api/daily-journal/save-all` | 保存可用维度草稿并生成日级日志 |
| `PUT` | `/api/daily-journal/[id]` | 更新日级日志标题和正文 |
| `POST` | `/api/daily-journal/[id]/save` | 保存日级日志 |

### 2.5 日历、分析与画像

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/calendar/day?date=YYYY-MM-DD` | 查询单日五维状态 |
| `GET` | `/api/calendar/week?date=YYYY-MM-DD` | 查询目标日期所在周 |
| `GET` | `/api/calendar/month?month=YYYY-MM` | 查询目标月份 |
| `GET` | `/api/analysis/range?preset=week|month|custom&start=...&end=...` | 查询量化趋势 |
| `GET` | `/api/analysis/month?month=YYYY-MM` | 查询五维月度全景 |
| `PUT` | `/api/happiness-score` | 保存幸福 8 要素日评分 |
| `GET/POST/PATCH/DELETE` | `/api/profile` | 画像记忆 CRUD |
| `GET/POST` | `/api/profile/portrait` | 查询或生成画像快照 |
| `POST` | `/api/transcribe` | 语音占位接口，当前为 stub |

### 2.6 AI 反馈与质量治理

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET/PUT/DELETE` | `/api/ai-feedback/[traceId]` | 查询、提交、切换或撤回赞踩 |
| `GET/PATCH` | `/api/ai-feedback/consent` | 查询质量政策状态及兼容写入 |
| `GET` | `/api/admin/ai-quality/candidates?status=draft` | 查询优化候选 |
| `PATCH` | `/api/admin/ai-quality/candidates/[candidateId]` | 批准、拒绝、发布或回滚 |
| `GET` | `/api/admin/ai-quality/candidates/[candidateId]/evidence?page=1` | 查看候选对话证据 |
| `POST` | `/api/admin/ai-quality/candidates/[candidateId]/validate` | 回放验证候选 |
| `GET` | `/api/admin/ai-quality/candidates/[candidateId]/impact` | 查询发布前后七天指标 |
| `GET` | `/api/admin/ai-quality/candidates/[candidateId]/impact/evidence?kind=attention&page=1` | 查询上线后真实案例 |
| `POST` | `/api/admin/ai-quality/runs` | 评估待处理 Trace，并聚类生成或复用候选 |
| `GET` | `/api/cron/ai-quality/evaluate?limit=100` | 每日评估任务 |
| `GET` | `/api/cron/ai-quality/iterate` | 每周聚类任务 |

### 2.7 其他管理员接口

- `/api/admin/analytics/*`：总览、漏斗、留存、质量、候选用户和内容级下钻。
- `/api/admin/ai-runtime/*`：chat/embedding 配置草稿、探针、发布、历史和回滚。
- `/api/debug/runtime-env`：受登录、开关和 token 保护的最小运行环境诊断。
- `/api/dev/acceptance-login`：仅 localhost 开发环境可用，production 返回 `404`。

## 3. 认证

### 3.1 注册

`POST /api/auth/register`

```json
{
  "username": "demo_user",
  "password": "your-password",
  "acceptedTerms": true,
  "acceptedPrivacy": true
}
```

注册成功会写入当前隐私与 AI 质量政策版本、合规时间，并设置 `dl_session`。合规文案覆盖用户协议、隐私政策以及对话、AI 生成内容和反馈用于质量评估与持续改进。

### 3.2 登录

`POST /api/auth/login`

```json
{
  "username": "demo_user",
  "password": "your-password"
}
```

登录成功会校准当前质量政策版本和审计时间。

## 4. 访谈

客户端导航约定：访谈页通过 header 主导航切换到日历、分析、画像、设置或首页时直接完成路由切换。浏览器刷新或关闭访谈页面时，前端继续通过 `beforeunload` 保存会话恢复标记并提供离开保护；该保护与站内路由切换分开处理。

### 4.1 启动会话

`POST /api/interview/session/start`

```json
{
  "dimension": "reflection",
  "entryDate": "2026-07-20"
}
```

`entryDate` 可省略，省略时使用北京时间当天。成功响应包含：

```json
{
  "sessionId": "cuid",
  "openingQuestion": "今天哪个片段让你产生了新的想法？",
  "session": {}
}
```

### 4.2 回复与动作

主前端调用：

```text
POST /api/interview/session/respond/stream
Content-Type: application/json
Accept: text/event-stream
```

普通回复：

```json
{
  "action": "reply",
  "sessionId": "cuid",
  "rawText": "今天复盘后，我发现自己把忙碌误当成了进展。",
  "inputMode": "text",
  "clientTurnId": "浏览器生成的唯一 ID",
  "baseMessageSequence": 4
}
```

`rawText` 是当前主前端字段；`userMessage` 继续作为旧客户端兼容字段。`baseMessageSequence` 表示页面发送时看到的最后一条消息序号，服务端用它拦截基于旧对话位置发起的提交。

分叉动作可使用：

```json
{
  "action": "continue_current_event",
  "sessionId": "cuid",
  "clientTurnId": "浏览器生成的唯一 ID",
  "baseMessageSequence": 4
}
```

```json
{
  "action": "next_event",
  "sessionId": "cuid",
  "clientTurnId": "浏览器生成的唯一 ID",
  "baseMessageSequence": 4
}
```

失败或取消后继续同一轮：

```json
{
  "action": "resume_turn",
  "sessionId": "cuid",
  "clientTurnId": "原提交的唯一 ID"
}
```

按意图重新生成正式追问：

```json
{
  "action": "regenerate_question",
  "sessionId": "cuid",
  "targetMessageId": "assistant-message-cuid",
  "intent": "simplify",
  "clientTurnId": "浏览器生成的唯一 ID",
  "baseMessageSequence": 4,
  "baseBranchSessionId": "当前活动分支 ID"
}
```

`intent` 支持 `simplify / concretize / change_angle / deepen / lighten`。纠正理解使用 `action: "correct_understanding"`，并提交同样的定位字段与用户输入 `rawText`。分支预览和选择接口使用 `{ sessionId, targetMessageId, baseBranchSessionId }`；预览响应返回 `targetBranchSessionId` 与只读 `session`，选择响应返回已采用路径的 `session`。

SSE 事件：

| 事件 | 数据 |
|---|---|
| `turn` | 服务端已接收的 `InterviewUserTurn`；用户原话此时已经持久化 |
| `phase` | 当前处理阶段 |
| `delta` | `summary / question / thinking` 等增量 |
| `session` | 最终完整 session |
| `version` | 回复版本的组标识、当前版本、版本数与活动分支 |
| `error` | 结构化 `issue` |

主链时序为 `turn -> phase / delta -> session`。`turn` 确认“原话已收到”，`session` 确认“AI 回应和会话状态已完整保存”。处理失败或浏览器取消后，session hydrate 会通过 `pendingUserTurn` 返回原提交，页面可显示“继续生成”。

服务端会为每轮回复判断用户是在补充内容、修正理解、要求换问法、希望停止追问，还是要求生成日志。这些判断用于保护对话体验和支持重放，属于内部运行记录；客户端继续以 `turn / delta / session / error` 事件完成交互，无需新增请求字段或解析内部判断结果。

`delta.text` 来自服务端检查后的最终摘要或问题，分块过程保留最终文本的空格和换行。`question_repair` 会由服务端确定性生成 `turn -> summary -> question -> session`，不进入 provider 流式调用。

非流式接口使用同一请求 schema，并返回 `assistantMessage / assistantTurn / sessionStatus / turnCount / snapshotData / session`。

### 4.3 事件中心会话与两段式生成

事件中心入口地址：

```text
/interview?mode=event-centered&entryDate=YYYY-MM-DD
```

五维选择页在 `optional` 档位会保留五维默认入口，并展示事件中心次级入口。历史文案为“从一件事开始”，GI-065 候选文案为“直接开始”；Production 当前使用 `legacy`，因此事件中心新写入入口保持关闭。事件中心默认以今天的 `entryDate` 启动；未来日期由服务端拒绝写入。

启动或恢复会话：

```text
POST /api/interview/event-centered/session/start
Content-Type: application/json
```

```json
{"entryDate":"2026-08-02"}
```

发送一轮用户原话时，主界面直接调用 SSE 接口；服务端会在同一请求内完成可靠预留和用户原话持久化。需要显式预留的兼容客户端或受控测试可以单独调用：

```text
POST /api/interview/event-centered/session/turn
```

```json
{
  "rootSessionId": "root-session-cuid",
  "baseBranchSessionId": "active-branch-cuid",
  "baseMessageSequence": 4,
  "clientTurnId": "browser-generated-id",
  "rawText": "今天把一件拖着的事终于收住了。"
}
```

主界面调用：

```text
POST /api/interview/event-centered/session/respond/stream
Accept: text/event-stream
```

不要对同一条用户原话同时调用 `/session/turn` 和 `/session/respond/stream`，以免创建重复预留。正常回合的 SSE 顺序包含 `turn -> phase / delta -> session`；`turn` 表示原话已写入，`session` 表示本轮助手回应和会话状态已提交。页面刷新或生成中断后，使用同一 `clientTurnId` 继续生成，不重复保存用户原话。

历史候选使用“第一段理解与计划、第二段用户表达”的两段式合同，并保留 deterministic baseline 兼容路径。`GI-067 / GI-068～080` 已冻结目标产品职责和稳定性输入：产品协议固定结果和硬边界，Interview Skill / Prompt 承载方法与案例，大模型自主判断回应，程序执行确定性保护，Trace、Evals 与真人 Preview 共同验收。GI-081 的一次调用／两阶段结构只承担六题离线诊断；正式调用次数、字段、状态结构和失败处理由板块 7 在板块 6 正式资产完成后确定，并同步更新本节。可靠原话保存、同一 `clientTurnId` 续接、结构化错误和 Trace 继续有效。

事件日志生成由工作区 `allowedActions` 控制：

```text
POST /api/interview/event-centered/journal/generate
```

```json
{
  "rootSessionId": "root-session-cuid",
  "baseBranchSessionId": "active-branch-cuid",
  "baseMessageSequence": 8,
  "clientOperationId": "browser-operation-id"
}
```

生成后，桌面端打开右侧日志书页，移动端打开底部 sheet。编辑使用：

```text
GET   /api/interview/event-centered/journal/{id}
PATCH /api/interview/event-centered/journal/{id}
POST  /api/interview/event-centered/journal/{id}/save
```

`PATCH` 请求至少携带 `title`、`content` 和 `expectedContentRevision`；自动暂存使用同一接口，版本不一致时返回冲突并保留用户当前编辑。`save` 也携带 `expectedContentRevision`，成功后日志状态变为 `saved`。刷新后通过 `GET` 恢复；当天事件标签可以重新打开同一事件日志。

日志来源快照只包含当前活动分支、有效用户原话、确认事实和允许写入日志的角度成果。AI 草稿经过来源门检查；AI 请求失败、结构无效或来源门拒绝时使用安全基础版本。基础版本只整理来源中已经出现的事件与理解，来源不足时返回 `EVENT_JOURNAL_SOURCE_INSUFFICIENT` 并恢复上一检查点。

事件中心的入口与提问策略分开设置：

| 配置 | 值 | 作用 |
|---|---|---|
| `INTERVIEW_EVENT_CENTERED_MODE` | `legacy` / `optional` / `event_centered` / `event_recovery` | 五维默认入口、可选事件入口、事件中心默认入口、历史事件恢复档位 |
| `INTERVIEW_EVENT_CENTERED_STRATEGY` | `baseline` / `generative` | 确定性提问链路或两段式生成链路 |
| `EVENT_CENTERED_GENERATIVE_MODEL` | `deepseek-v4-flash` | 新事件中心候选固定模型；共享五维聊天模型继续由 `DEEPSEEK_MODEL` 提供 |

Production 继续使用 `legacy + baseline`。Board 8 Preview 经过人工开启后才使用 `optional` 或 `event_centered` 搭配 `generative`；事件已有数据在回退档位仍可读取。

### 4.4 结构化错误

`respond` 和 `respond/stream` 的错误包含：

```json
{
  "error": "MESSAGE_TOO_LONG",
  "message": "这段内容有点长，请拆成两段发送。",
  "issue": {
    "code": "MESSAGE_TOO_LONG",
    "title": "这段内容有点长",
    "message": "这段内容有点长，请拆成两段发送。",
    "resolution": "拆成两段后重新发送。",
    "retryable": false,
    "action": "edit",
    "requestId": "request-id"
  }
}
```

高频错误：

| 错误码 | HTTP | 含义 |
|---|---:|---|
| `INVALID_RESPOND_REQUEST` | 400 | 请求体不符合 schema |
| `MESSAGE_TOO_LONG` | 400 | 用户回复超过 1200 字 |
| `AUTHENTICATION_REQUIRED` | 401 | 登录态缺失或失效 |
| `SESSION_NOT_FOUND` | 404 | 会话不存在或不属于当前用户 |
| `SESSION_CHOICE_UNAVAILABLE` | 409 | 分叉动作已过期 |
| `INTERVIEW_TURN_IN_PROGRESS` | 409 | 当前会话已有用户提交正在处理，或已有未解决提交 |
| `INTERVIEW_TURN_OUT_OF_DATE` | 409 | `baseMessageSequence` 落后于服务端最新消息位置 |
| `INTERVIEW_TURN_RETRY_REQUIRED` | 409 | 同一 `clientTurnId` 已失败或取消，需要使用 `resume_turn` |
| `INTERVIEW_TURN_NOT_FOUND` | 404 | 指定的待恢复提交不存在或不属于当前用户 |
| `INTERVIEW_REGENERATION_UNAVAILABLE` | 409 | 当前会话、日志边界或服务开关暂不支持换问法 |
| `INTERVIEW_REGENERATION_INTENT_UNAVAILABLE` | 409 | 当前证据不足以使用所选换问法，例如“再深入一点” |
| `INTERVIEW_REGENERATION_LIMIT_REACHED` | 409 | 该正式追问已保留三个版本 |
| `INTERVIEW_BRANCH_OUT_OF_DATE` | 409 | 请求基于较早的活动分支 |
| `INTERVIEW_BRANCH_LOCKED_BY_JOURNAL` | 409 | 已生成日志锁定了历史路径 |
| `INTERVIEW_DB_WRITE_FAILED` | 500 | 本轮回复写入失败 |
| `STREAM_PROTOCOL_ERROR` | 500 | SSE 数据格式异常 |
| `INTERVIEW_RESPOND_FAILED` | 500 | 未分类兜底错误 |

流式连接建立后的冲突通过 SSE `error` 事件返回；非流式接口使用表中的 HTTP 状态。

## 5. 维度日志

### 5.1 生成草稿

`POST /api/interview/session/draft/generate`

```json
{
  "sessionIds": ["cuid"]
}
```

schema 允许最多 4 个 ID，当前服务只支持 1 个。关键语义：

- 日志由用户主动触发生成。
- 草稿已覆盖最新访谈状态时直接复用。
- 用户手动编辑后的稿件不会被新访谈内容静默覆盖。
- 五维正文都经过语义解释、质量门、fallback 和不超过 16 字的短标题治理。
- 结构化 `snapshotData / payload` 保持系统内部可见。

主要错误：

| 错误码 | HTTP | 含义 |
|---|---:|---|
| `SESSION_BATCH_UNSUPPORTED` | 400 | 传入多个会话 |
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `DRAFT_GENERATE_NOT_READY` | 409 | 材料不足 |
| `DRAFT_GENERATE_UPSTREAM_ERROR` | 502 | AI 整理失败，可重试 |
| `DRAFT_GENERATE_DB_ERROR` | 500 | 草稿写入失败 |

### 5.2 更新与保存

- `PUT /api/journal-entry/[id]`：更新标题与正文，已保存日志会先回到 `draft`。
- `POST /api/interview/session/draft/save`：把当前维度日志保存为正式版本。
- `/api/joy-entry/[id]` 与 canonical 更新接口等价，仅承担兼容。

## 6. 当天整合日志

查询：

```text
GET /api/daily-journal?date=2026-07-20
GET /api/daily-journal/board?date=2026-07-20
```

日级状态：

- `none`
- `draft`
- `saved`
- `stale`

`stale` 表示同日已保存维度集合或来源更新时间已经变化。

生成：

```http
POST /api/daily-journal/generate
Content-Type: application/json

{"date":"2026-07-20"}
```

只使用同一天每个维度最新的一篇 `saved` 日志。来源为空时返回 `409 DAILY_JOURNAL_SOURCE_EMPTY`。

更新与保存：

```json
{
  "title": "一天的纹理",
  "content": "正文"
}
```

- `PUT /api/daily-journal/[id]` 更新后进入 `draft`。
- `POST /api/daily-journal/[id]/save` 重新保存为正式版本。

## 7. 日历、分析与评分

### 7.1 日历

```text
GET /api/calendar/day?date=2026-07-20
GET /api/calendar/week?date=2026-07-20
GET /api/calendar/month?month=2026-07
```

calendar 输出是纯展示读模型。状态统一为：

- `empty`
- `in_progress`
- `draft`
- `completed`
- `mixed`

opening-only 空会话不计入进行中。月视图以已保存结果为主要可见语义，周视图提供 7 天对比，日视图提供五维操作入口。

### 7.2 分析

量化趋势：

```text
GET /api/analysis/range?preset=week
GET /api/analysis/range?preset=month
GET /api/analysis/range?preset=custom&start=2026-07-01&end=2026-07-20
```

五维全景：

```text
GET /api/analysis/month?month=2026-07
```

前端 URL：

```text
/analysis?month=2026-07&section=trends|dimensions
```

旧 `overview|score|rhythm` 会归一到 `trends`，旧 `insights|correlation|review` 会归一到 `dimensions`。量化趋势为只读读数台，五维记录展示按月聚合的线索与代表片段。

### 7.3 幸福 8 要素评分

`PUT /api/happiness-score`

```json
{
  "date": "2026-07-20",
  "scores": {
    "meaning": 7,
    "health": 6,
    "virtue": 7,
    "autonomy": 6,
    "interest": 8,
    "skill": 7,
    "relationship": 8,
    "livingCondition": 6
  }
}
```

分数范围为整数 `1-10`。所有非未来日期都可保存；未来日期返回 `403 HAPPINESS_SCORE_EDIT_WINDOW_EXCEEDED`。评分录入入口位于 `/interview` 的当天评分工作区。

## 8. AI 反馈

### 8.1 查询、提交与撤回

`PUT /api/ai-feedback/[traceId]`

```json
{
  "vote": "upvote",
  "tags": ["理解准确", "尊重节奏"],
  "comment": "问题具体，也照顾到了我的节奏。"
}
```

规则：

- `vote` 允许 `upvote / downvote`。
- 点赞可空提交。
- 点踩至少需要一个标签或非空文本。
- 标签最多 6 个，文本最多 1000 字。
- 再次提交会创建新 revision 并更新当前反馈。
- `DELETE` 会撤回当前反馈并保留 revision 历史。
- 当前用户只能操作自己的 Trace。

### 8.2 质量政策

`GET /api/ai-feedback/consent` 返回当前政策版本、参与状态和审计时间。产品默认参与；提交：

```json
{"participate":false}
```

返回：

```json
{"error":"AI_QUALITY_PARTICIPATION_REQUIRED"}
```

HTTP 状态为 `409`。

## 9. AI 质量治理

### 9.1 手动运行

`POST /api/admin/ai-quality/runs`

执行顺序：

1. 评估最多 20 条待处理 Trace。
2. 扫描运行时点之前 7 天的 Badcase 和点赞 Goodcase。
3. 聚类并生成或复用 System Prompt、Few-shot、Engineering 候选。

响应为 `{ evaluation, iteration }`，其中 iteration 包含 `runId / clusters / candidates / reused / summary`。

### 9.2 候选动作与验证

`PATCH /api/admin/ai-quality/candidates/[candidateId]`

```json
{"action":"approve"}
```

`action` 允许 `approve / reject / publish / rollback`。

拒绝候选时必须提供 `4–300` 字原因：

```json
{"action":"reject","reason":"当前证据不足以支持这项修改，先补充更多同类对话。"}
```

验证：

```text
POST /api/admin/ai-quality/candidates/[candidateId]/validate
```

System Prompt 会回放目标和正向回归证据；Few-shot 会复查点赞有效性与至少 85 分的评估。发布要求候选已批准且最近验证通过；缺少通过验证时接口返回 `409 OPTIMIZATION_VALIDATION_REQUIRED`。

管理页将 `draft / approved / published / rejected / rolled_back` 投影为待审核、待验证、待发布、观察中和历史记录；Engineering 路径的已批准候选进入待技术处理。接口仍返回原始状态，客户端应按最近验证结果和候选路径完成展示投影。

### 9.3 七天效果

```text
GET /api/admin/ai-quality/candidates/[candidateId]/impact
```

响应包含：

- `release`：版本、Prompt Key、`validationId`、时间和版本标记
- `observation`：基线、观察窗口、观察天数和完成状态
- `baseline / after / changes`：生成、反馈、问题、严重问题、失败和延迟
- `conclusion`：继续观察、低样本、人工复核、建议保留或建议回滚
- `evidenceCounts`：需关注和正向案例数

`sameIssueCount / sameIssueRate` 以标准化后的具体问题键计算。候选缺少问题码时，两个窗口的 `sameIssueRate` 返回 `null`，客户端应显示“口径不足”，不应把未知问题聚合为同一类。

真实案例：

```text
GET /api/admin/ai-quality/candidates/[candidateId]/impact/evidence?kind=attention&page=1
GET /api/admin/ai-quality/candidates/[candidateId]/impact/evidence?kind=positive&page=1
```

每页 5 条。展开脱敏对话时会写入 `AdminAuditLog`。

### 9.4 鉴权与数据库错误

| 错误码 | HTTP | 含义 |
|---|---:|---|
| `AUTHENTICATION_REQUIRED` | 401 | 登录态缺失 |
| `ADMIN_FORBIDDEN` | 403 | 用户未命中管理员白名单 |
| `OPTIMIZATION_CANDIDATE_NOT_FOUND` | 404 | 候选不存在 |
| `OPTIMIZATION_VALIDATION_REQUIRED` | 409 | 候选缺少最近一次通过的回放验证 |
| `OPTIMIZATION_IMPACT_UNAVAILABLE` | 409 | 候选尚未发布，无法统计效果 |
| `P1001 / P1017 / P2024` | 500 | 管理员只读查询重试一次后数据库仍不可用 |
| `AI_QUALITY_IMPACT_FAILED` | 500 | 效果查询兜底错误 |

效果和证据接口的错误响应会包含 `code` 与 `requestId`；原始 Prisma 错误只写服务端日志。

## 10. Cron 与本地验收

Cron 使用：

```text
Authorization: Bearer $CRON_SECRET
```

本地验收：

```bash
npm run acceptance:ai-quality:seed
npm run dev
```

快捷登录：

```text
http://127.0.0.1:3000/api/dev/acceptance-login?token=local-ai-quality-acceptance&redirect=%2Fadmin%2Fai-quality
```

安全边界：

- seed 默认只接受本地数据库。
- 远程隔离测试库要求 `ALLOW_REMOTE_AI_QUALITY_ACCEPTANCE_SEED=I_UNDERSTAND`。
- production 环境会终止 seed。
- acceptance login 只接受 localhost 请求，production 返回 `404`。

### 10.1 事件中心离线评测

事件中心批量回放与 Judge 只用于受控的本地或隔离评测环境，不参与用户请求链路。策略回放读取 `DEEPSEEK_API_KEY / DEEPSEEK_MODEL / DEEPSEEK_BASE_URL`；Judge 使用独立模型配置，优先读取：

- `EVENT_CENTERED_JUDGE_DEEPSEEK_API_KEY`、`EVENT_CENTERED_JUDGE_DEEPSEEK_MODEL`、`EVENT_CENTERED_JUDGE_DEEPSEEK_BASE_URL`
- 兼容别名：`DEEPSEEK_JUDGE_API_KEY`、`DEEPSEEK_JUDGE_MODEL`、`DEEPSEEK_JUDGE_BASE_URL`
- 最后才复用策略回放的 `DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL`；Judge 模型名必须显式提供

超时配置读取 `EVENT_CENTERED_EVALUATION_TIMEOUT_MS`，缺省时兼容 `EVENT_CENTERED_JUDGE_TIMEOUT_MS`，有效范围为 `1,000–90,000ms`，默认 `18,000ms`。评测运行器会把模型名和 base URL host 写入运行元数据，API key 只用于进程内请求，不写入报告、Trace 或用户可见响应。

常用本地命令：

```bash
npm run eval:event-centered:batch-b -- --mode=rules --all
npm run eval:event-centered:generative
npm test -- tests/evals/event-centered-mvp-journal-closure.test.tsx
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

`--mode=rules` 只回归确定性规则；真实模型回放、Judge 和用户质量判断需要单独授权。Production 保持 `legacy + baseline`，不得把评测 key 或 Judge 开关放入生产请求路径。

### 10.2 GI-088 真人交互开发评测

v8r3r2 Ark Flash 候选、服务版本、`60/60/60/90` 配置、Preview deployment 与 `0/6` run 继续作为历史工程和真人验收证据只读保留；v8r3r3 可靠性门为 `No-Go`。运行链根因对照确认官方 Pro 的模型档位稳定性为主因，完整状态输出职责为重要放大因素。后续两条独立评测链——官方 Pro＋完整合同，以及官方 Pro＋可执行精简合同＋确定性状态投影——已完成开发配对：实际调用 `126` 次，完整组 `53/64`、精简组 `38/64`，两组延迟门失败，状态投影四项错误为 `0`，判定技术 No-Go。人工裁决源未生成，隐藏集未读取，本轮未部署 Preview。页面任务说明、目标触发提示和人工判尺只对评测人可见，不进入模型上下文。v1～v8r3r3 的批次、错误、恢复和导出继续按冻结版本只读兼容；Judge 20＋20 后置，Production 保持 `legacy + baseline`。

#### v8r2 历史 API 合同

v8r2 API 以 `runId` 明确一次真人运行：

- `GET/POST /api/preview/gi088/runs`：列出 run；创建时必须提供 `clientOperationId`，同一冻结候选终态后可创建下一 `runOrdinal`。
- `GET /api/preview/gi088/session?runId=&taskId=`：读取指定 run 和任务；历史指纹不匹配时返回只读投影并继续允许导出。
- `POST /api/preview/gi088/start-task`：提交 `runId / taskId / initialUserMessage / clientOperationId`，仅开放 high。
- `POST /api/preview/gi088/turn`：提交 `runId / taskId / content / clientTurnId / clientOperationId / baseAssistantMessageId`；同一操作先做幂等回放，再校验对话锚点，陈旧标签页返回 `GI088_TURN_OUT_OF_DATE` 且模型调用为零。
- `POST /api/preview/gi088/retry`：只接受产品负责人主动触发的 `manual_after_auto_recovery`；自动恢复由服务端执行并与首次调用共享截止。
- `POST /api/preview/gi088/question-review`、`program-intervention-review`、`end-trajectory`：分别绑定 observation 或 review snapshot fingerprint；终态前的人工修订追加保存旧值、新值和原因。
- `POST /api/preview/gi088/abort-current-task`：把当前项收口为 `aborted_with_partial_evidence`，保留对话和 Trace，并让后续项保持可采集。
- `POST /api/preview/gi088/early-stop`、`seal`：分别结束部分 run 或完整 run；collection status 与 gate status 独立保存。
- `POST /api/preview/gi088/compare`：只读兼容旧双分支协议；v8r2 固定返回 `GI088_COMPARISON_NOT_REQUIRED`。
- `GET /api/preview/gi088/export?runId=`：终态 run 首次返回并冻结 `{ payload, receipt }`，导出版本为 `2026-08-10.gi088-readonly-export-v0.6`；SHA256 只覆盖 canonical payload，receipt 不参与哈希；重复下载直接返回首次快照。
- `POST /api/preview/gi088/operation-events`：以独立追加记录保存草稿恢复、下载失败等安全操作摩擦，校验 task／turn 属于 run，不推进 run revision，也不阻断聊天或导出。首次导出后的新事件留在事件表，不改变已冻结 payload。

每次 Provider 调用在 `Gi088EvaluationCallLedger` 中按 `reserved → dispatched → provider_succeeded/provider_failed → finalized` 留痕。Provider 返回后先保存结果，再由可重入 finalizer 提交可见回答与语义状态；CAS 冲突、刷新和断线只重试落账或 finalizer。实际调用预算只统计 `dispatched` 及其后续状态。v8r2 已补齐 preflight 原话、完整请求身份和 `finalization_failed` session 对账，并通过零模型、真实评测库与历史兼容验证。

每个用户提交最多经历首次、一次自动恢复和一次人工再次生成。首次与自动恢复共享 `90` 秒，人工再次生成获得独立 `60` 秒。页面刷新后对任意 pending turn 只读轮询；服务端根据 `executionDeadlineAt / automaticDeadlineAt` 对账，浏览器关闭不会改变已经消费的调用额度。

控制决策把访谈内容和控制动作分开保存。明确继续可以撤销同一句中更早的停止或生成动作，并作为独立 `continue_interview` 候选进入证据 Trace；明确停止只有在说话人、目标、肯定极性和本人直接表达同时成立时执行。程序接管的停止、继续或配置失败全部进入 intervention review；技术阻断评价必须绑定同轨迹冻结失败事实，人工复核完成后再进入质量裁决。

空内容探针默认只做本地血缘检查：

```bash
npm run eval:gi088:probe:empty:inspect
npm run eval:gi088:probe:thinking:inspect
```

空内容 response format 真实探针已使用精确指纹、独立授权 UUID 和 `6` 次预算完成，零重试、零降级；移除参数候选 No-Go。Thinking 模式探针也已按精确指纹 `7179da479b614c6380709fc1094034f489d4803d11741b852522616dee7e3498` 完成 `4/4`；high 与 disabled 均为 `2/2 valid`，high 未复现空内容，主要影响因素未确认。历史诊断以 [`GI-088 v2 diagnostic`](../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v2-diagnostic/README.md) 为准；v8r1 事故与部署快照见 [`GI-088 v8r1 最终 12 项`](../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/README.md)。v8r2 当前 Preview deployment `dpl_CGXsLzU5ZaTX8PYFkt2hUzBwgskz` 已 `READY`，Execution fingerprint 为 `55c0c9b0ef31f46bf638c3a90fd6323c1ef7ad83a14d367d4e2e2fe3cc34b34e`；两套 Prisma Client 已在 Vercel Linux 远程构建，登录存储验收通过。全新 run `e1dccbfd-d808-4706-8ddf-be5e254f4d2d` 为 `ordinal=4 / revision=0 / running / 0/12 / gate=pending / high_only / high / calls=0`。旧预发布 v8r2 零内容 run 已行政 `early_stopped`，其 `0/12`、调用 `0`、真人提交 `0` 和质量未评价只作为脱敏排除记录。当前结构、证据和发布边界见 [`GI-088 v8r2 证据包`](../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)。

## 11. 通用错误语义

| 错误码 | 含义 |
|---|---|
| `AUTHENTICATION_REQUIRED` | 需要重新登录 |
| `INVALID_*_REQUEST` | 请求体或查询参数不符合 schema |
| `*_NOT_FOUND` | 资源不存在或不属于当前用户 |
| `EVENT_CENTERED_ENTRY_DISABLED` | 当前发布档位暂停事件中心新增和修改 |
| `EVENT_CENTERED_FUTURE_DATE` | 事件中心禁止写入未来日期 |
| `EVENT_STATE_CHANGED` | 活动分支或消息位置已变化，需要刷新工作区 |
| `EVENT_OPERATION_CONFLICT` | 事件操作已被同一客户端或另一请求占用 |
| `EVENT_JOURNAL_GENERATION_NOT_ALLOWED` | 当前检查点尚未提供生成事件日志的操作 |
| `EVENT_JOURNAL_ENTRY_NOT_FOUND` | 事件日志不存在或不属于当前用户 |
| `EVENT_JOURNAL_ENTRY_VERSION_CONFLICT` | 自动暂存或保存使用了过期内容版本 |
| `EVENT_JOURNAL_SOURCE_INSUFFICIENT` | 来源材料不足以形成可信的事件日志 |
| `JOURNAL_DAY_MODE_CONFLICT` | 当前日期已被另一日志工作区或活动事件占用 |
| `JOURNAL_DAY_MODE_MIXED` | 同一天存在无法统一投影的日志状态 |
| `DAILY_JOURNAL_SOURCE_EMPTY` | 当天缺少已保存维度日志 |
| `ANALYSIS_QUERY_FAILED` | 分析查询失败 |
| `CALENDAR_QUERY_FAILED` | 日历查询失败 |
| `PROFILE_QUERY_FAILED` | 画像查询失败 |
| `ADMIN_ANALYTICS_QUERY_FAILED` | 管理员分析查询失败 |

客户端应优先按 HTTP 状态和结构化 `error / issue / code / requestId` 处理，页面只展示可理解的原因与重试动作。
