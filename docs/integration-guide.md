# Integration Guide

最后更新：`2026-07-20`

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
| `POST` | `/api/interview/session/pause` | 暂停会话 |
| `POST` | `/api/interview/session/complete` | 完成会话 |
| `POST` | `/api/interview/session/reopen` | 重开会话 |
| `POST` | `/api/interview/session/draft/generate` | 生成维度日志草稿 |
| `POST` | `/api/interview/session/draft/save` | 保存维度日志 |
| `PUT` | `/api/journal-entry/[id]` | 更新维度日志标题和正文 |
| `PUT` | `/api/joy-entry/[id]` | 兼容旧命名的等价更新接口 |

### 2.3 当天整合日志

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/daily-journal?date=YYYY-MM-DD` | 查询当天整合日志与来源 |
| `GET` | `/api/daily-journal/board?date=YYYY-MM-DD` | 查询今日日志面板五维状态 |
| `POST` | `/api/daily-journal/generate` | 基于已保存维度日志生成日级草稿 |
| `POST` | `/api/daily-journal/save-all` | 保存可用维度草稿并生成日级日志 |
| `PUT` | `/api/daily-journal/[id]` | 更新日级日志标题和正文 |
| `POST` | `/api/daily-journal/[id]/save` | 保存日级日志 |

### 2.4 日历、分析与画像

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

### 2.5 AI 反馈与质量治理

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
| `POST` | `/api/admin/ai-quality/runs` | 立即评估并生成候选 |
| `GET` | `/api/cron/ai-quality/evaluate?limit=100` | 每日评估任务 |
| `GET` | `/api/cron/ai-quality/iterate` | 每周聚类任务 |

### 2.6 其他管理员接口

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
  "userMessage": "今天复盘后，我发现自己把忙碌误当成了进展。",
  "inputMode": "text"
}
```

分叉动作可使用：

```json
{"action":"continue_current_event","sessionId":"cuid"}
```

```json
{"action":"next_event","sessionId":"cuid"}
```

SSE 事件：

| 事件 | 数据 |
|---|---|
| `phase` | 当前处理阶段 |
| `delta` | `summary / question / thinking` 等增量 |
| `session` | 最终完整 session |
| `error` | 结构化 `issue` |

`delta.text` 的空白字符会原样传递。`question_repair` 会由服务端确定性生成 `summary -> question -> session`，不进入 provider 流式调用。

非流式接口使用同一请求 schema，并返回 `assistantMessage / assistantTurn / sessionStatus / turnCount / snapshotData / session`。

### 4.3 结构化错误

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
| `INTERVIEW_DB_WRITE_FAILED` | 500 | 本轮回复写入失败 |
| `STREAM_PROTOCOL_ERROR` | 500 | SSE 数据格式异常 |
| `INTERVIEW_RESPOND_FAILED` | 500 | 未分类兜底错误 |

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
/analysis?month=2026-07&section=trends|dimensions|correlation|review
```

旧 `overview|score|rhythm|insights` 会归一到 `trends|dimensions`。量化趋势为只读读数台；关联与复盘当前为占位。

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

验证：

```text
POST /api/admin/ai-quality/candidates/[candidateId]/validate
```

System Prompt 会回放目标和正向回归证据；Few-shot 会复查点赞有效性与至少 85 分的评估。发布要求候选已批准且最近验证通过。

当前已知接口偏差：

- 仓储缺少通过验证时抛出 `OPTIMIZATION_VALIDATION_REQUIRED`。
- 候选 PATCH 路由当前会把该错误投影为 `500 AI_QUALITY_REVIEW_FAILED`。
- 目标合同是结构化 `409 OPTIMIZATION_VALIDATION_REQUIRED`，该映射与 API 回归测试仍待补齐。

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

## 11. 通用错误语义

| 错误码 | 含义 |
|---|---|
| `AUTHENTICATION_REQUIRED` | 需要重新登录 |
| `INVALID_*_REQUEST` | 请求体或查询参数不符合 schema |
| `*_NOT_FOUND` | 资源不存在或不属于当前用户 |
| `DAILY_JOURNAL_SOURCE_EMPTY` | 当天缺少已保存维度日志 |
| `ANALYSIS_QUERY_FAILED` | 分析查询失败 |
| `CALENDAR_QUERY_FAILED` | 日历查询失败 |
| `PROFILE_QUERY_FAILED` | 画像查询失败 |
| `ADMIN_ANALYTICS_QUERY_FAILED` | 管理员分析查询失败 |

客户端应优先按 HTTP 状态和结构化 `error / issue / code / requestId` 处理，页面只展示可理解的原因与重试动作。
