# Daily Light 隔离 Preview 联调契约

最后更新：`2026-08-12`

状态：新双栏前端的零写入视觉 Preview 已部署并完成本地、远端工程验收；等待产品负责人视觉验收。固定六案例回放与 Production 均保持原边界

## 目的

前端验收前提供一套稳定的后端回放源。新前端通过产品验收后继续使用日记页正式接口语义，固定六案例回放通过本地请求标记切换。

跨会话推进顺序、三方 Ready 条件、问题归属与完整端到端验收统一见[Daily Light 端到端联调总交接](./2026-08-12-daily-light-end-to-end-integration-handoff.md)。本文件只承担固定六案例日志回放契约。

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

该远端 Preview 已完成当时的构建和浏览器复核，用于证明旧候选的工程链路可运行。当前新前端已经进入新的独立零写入视觉 Preview；固定六案例联调等待产品验收通过后启动。Production `https://dailylight.chat` 保持当前版本。

## 当前零写入视觉候选

- Deployment：`dpl_5pB6hDFTd45CKFx2dPCyEiRMvhHC`
- URL：<https://xingfuxitong-5453viaw2-zouzhijies-projects.vercel.app/preview/daily-light-visual-review?clean=1>
- 状态：`READY`
- 访问：启用 Vercel Deployment Protection，需要先使用项目成员身份登录 Vercel
- 运行：六个视觉页面远端回读均为 `200`，最近 15 分钟运行错误为 `0`

新候选把访谈与日记统一为固定侧栏加内容主区：

- 访谈页内直接选择【帮我记／陪我聊】，随后原位开启会话；侧栏支持跨日期会话、新建记录、两条未完成记录上限、键盘切换与独立收起状态。
- 理解与提问按顺序显示为两个同款 AI 气泡；只有最新且用户尚未回复的一组保留赞、踩、重新生成和版本切换。
- 完成记录后保留原对话只读，释放未完成名额，并可进入对应日期日记。
- 日记侧栏固定采用日／周／月顺序；日视图提供小日历，周／月提供真实归档，来源默认收起。
- 视觉演示使用本地状态，用户操作、网络写入、模型调用和 Production 写入均为 `0`。

本地浏览器已完成 `1440 × 900` 与 `1024 × 768` 核对，截图位于：

```text
artifacts/daily-light-visual-review/2026-08-12-production-replacement/
```

已核对选择方式、双气泡生成、最新回复操作、重新生成菜单、两条会话限制、会话切换、完成只读、日记编辑保存、日／周／月切换、侧栏记忆、键盘操作、焦点恢复和两个尺寸下的溢出情况。

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

固定六案例回放继续用于本地零模型验证；当前双栏前端已进入独立零写入视觉 Preview，产品负责人确认视觉后再连接隔离测试数据库，完成六案例展示、v7r4 A1 编辑更新、保存恢复和异常状态验收。生成式访谈的开发 28、硬边界 24、Judge 20 与隐藏 12 能力蓝图已经建档并通过结构校验；私有填充、现场模型质量评测、正式运行和 Production 发布继续按后续独立阶段处理。
