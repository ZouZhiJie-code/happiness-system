# Daily Light 隔离 Preview 联调契约

最后更新：`2026-08-12`

状态：新前端构建中，等待产品负责人验收；固定六案例本地回放、正式接口语义和自动化检查已准备完成

## 目的

前端验收前提供一套稳定的后端回放源。新前端通过产品验收后继续使用日记页正式接口语义，固定六案例回放通过本地请求标记切换。

本轮回放从已确认记录卡开始，今日日记读取封存结果，模型调用数为 `0`。`v7r4-a1` 提供编辑与更新副本，其余五个案例保持只读。

## 历史远端 UI Preview

`2026-08-12` 的独立 Vercel Preview 作为历史工程证据保留，不接入 Production：

- Deployment：`dpl_8yNo4LoHehdowfuCtsdm4BU3w417`
- URL：<https://xingfuxitong-myks9m13t-zouzhijies-projects.vercel.app/>
- 数据：独立验收数据库，用户注册、访谈、事件卡片和日报/周报/月报数据与 Production 分离
- 运行档位：`INTERVIEW_EVENT_CENTERED_MODE=event_centered`、`INTERVIEW_EVENT_CENTERED_STRATEGY=baseline`
- 评测工作台：关闭；模型质量评测与正式发布继续按独立阶段处理

历史页面入口：

```text
/interview?mode=event-centered&entryDate=2026-08-12
/calendar?view=day&date=2026-08-12
/calendar?view=week&date=2026-08-12
/calendar?view=month&date=2026-08-12
```

该远端 Preview 已完成当时的构建和浏览器复核，用于证明旧候选的工程链路可运行。当前新前端仍在构建，产品验收和六案例联调尚未开始。Production `https://dailylight.chat` 保持当前版本。

## 启用条件

本地运行时设置：

```text
DAILY_LIGHT_JOURNAL_PREVIEW_ENABLED=I_UNDERSTAND
```

请求必须满足：

- host 为 `localhost`、`127.0.0.1` 或 `[::1]`；
- `NODE_ENV` 不为 `production`；
- 不存在 `VERCEL_ENV`；
- `x-daily-light-preview: fixed-six-v1`；
- 数据请求携带 `x-daily-light-preview-session` 和 `x-daily-light-preview-case`。

生产环境、远程 host、缺少显式开关或错误模式均返回隔离错误，正式请求继续走数据库链路。

## 会话接口

创建 Preview 会话：

```http
POST /api/journal/preview/session
x-daily-light-preview: fixed-six-v1
```

返回六个案例摘要、会话 ID、可编辑标记和 `modelCalls: 0`。每次创建会话都会从固定基线复制一份临时状态；刷新与案例切换沿用同一会话，重新创建会话恢复基线。

结束会话：

```http
DELETE /api/journal/preview/session
x-daily-light-preview: fixed-six-v1
x-daily-light-preview-session: <sessionId>
```

## 正式接口接入方式

以下接口继续使用正式请求和响应结构，只增加三项 Preview 请求头：

```text
x-daily-light-preview: fixed-six-v1
x-daily-light-preview-session: <sessionId>
x-daily-light-preview-case: <caseId>
```

### 当天数据

```http
GET /api/journal/day?entryDate=YYYY-MM-DD
```

响应仍为 `JournalDailyJournalView`。Preview 额外返回响应头：

```text
X-Daily-Light-Preview: fixed-six-v1
X-Daily-Light-Preview-Case: <caseId>
X-Daily-Light-Preview-Model-Calls: 0
```

### 事件卡

```http
GET   /api/interview/event-centered/journal/:entryId
PATCH /api/interview/event-centered/journal/:entryId
POST  /api/interview/event-centered/journal/:entryId/save
```

`v6-a1`、`v7-a1`、`v7-a2`、`v7r2-a1`、`v7r2-a2` 为只读回放。`v7r4-a1` 支持乐观版本编辑和保存；保存后会使当天日记进入 `stale` / “需更新”。事件卡生成接口在 Preview 中保持关闭，避免产生模型调用。

### 今日日记

```http
POST  /api/journal/daily/generate
PATCH /api/journal/daily/:entryId
POST  /api/journal/daily/:entryId/save
```

Preview 的生成结果来自封存日记。`v7r4-a1` 的 `task=update` 使用固定更新样本，保留当前日记的人工补充，并更新来源签名和内容版本。请求中的 `expectedSourceSignature` 与 `expectedContentRevision` 必须匹配当前会话状态。

## 固定资产

回放源来自：

```text
artifacts/journal-generation-evaluation/.private/formal/record-card-v3-daily/
```

加载时校验：

- committed manifest；
- 轮次与 Flash、Thinking 关闭、温度 `0.2` 语义；
- 六个案例集合；
- package SHA；
- 来源文件 SHA 与来源投影 SHA；
- 记录卡和日记程序检查结果。

原始评测包、封存记录卡、封存日记和基线哈希保持只读。Preview 会话副本只存在当前本地进程内，服务重启后重新创建会话即可恢复固定基线。

## 前端接入时的验收顺序

1. 创建 Preview 会话并保存六个案例摘要。
2. 以案例摘要中的 `entryDate` 读取当天数据。
3. 使用 `JournalDailyJournalView` 的状态、来源和日记字段渲染页面。
4. 五个只读案例完成展示、刷新和切换验收。
5. `v7r4-a1` 完成事件卡编辑、日记需更新、日记手动修改、固定更新和再次保存。
6. 重新创建 Preview 会话，确认所有案例恢复封存基线。

## 当前验证命令

```bash
npx vitest run tests/unit/journal-preview-service.test.ts tests/unit/journal-preview-api.test.ts
npm run typecheck
```

固定六案例回放继续用于本地零模型验证；新前端通过产品验收后，再完成浏览器视觉、六案例展示、v7r4 A1 编辑更新、保存恢复和异常状态验收。`dev28＋hidden12` 与 Judge 20 当前只保留未执行骨架；私有填充、现场模型质量评测、正式运行和 Production 发布继续按后续独立阶段处理。
