# Architecture

最后更新：`2026-05-04`

## 1. 系统概览

这是一个单仓库的 Next.js 应用，用 AI 访谈来帮助用户完成“幸福日志”记录。

当前架构形态不是“一个开放聊天机器人”，而是：
- 一个受状态控制的访谈系统
- 一个以 `snapshotData` 和 `payload` 为内部真相的结构化采集系统
- 一个把结构化信息再压缩成日志正文草稿的生成系统

截至 `2026-05-03`，`joy / fulfillment / reflection / improvement / gratitude` 是已经完成理论对齐深化的五个标品维度。

技术栈：
- 前端：Next.js 15、React 19、TypeScript、Tailwind、Zustand
- 后端：Next.js Route Handlers + service layer
- 数据库：PostgreSQL + Prisma
- AI：provider adapter + structured output 校验

## 2. 当前分层

### 页面与 API

- `src/app`
  - 首页：品牌广告页，内容从 `src/content/homepage.ts` 读取，按“认识自己 -> 日志如何起作用 -> 五维入口 -> 长期沉淀”组织叙事；图片位按 section 配置，当前已接入 `public/homepage/*` 本地图片，图片区统一为“单行标题 + 图片本体”的去卡片化布局
- `src/app/interview`
  - 访谈页与日志工作区
- `src/app/calendar`
  - 记录日历 month/week/day 页面
- `src/app/analysis`
  - 记录分析月度页面
- `src/app/api/interview/session/*`
  - 会话 start / respond / stream / pause / complete / reopen / draft
- `src/app/api/calendar/*`
  - 记录日历的 `day / week / month` 查询接口
- `src/app/api/analysis/month`
  - 月度记录分析查询接口
- `src/app/api/daily-journal/*`
  - 当天整合日志的查询、生成、草稿更新与正式保存接口
- `src/app/api/journal-entry/[id]`
  - 当前日志正文编辑主路由
- `src/app/api/joy-entry/[id]`
  - 兼容旧 joy 命名的别名路由
- `src/app/api/transcribe`
  - 当前仍是 stub

### 功能层

- `src/features/interview`
  - 多维度共用：schema、维度定义、进度算法、前端元信息
- `src/features/calendar`
  - 纯展示层记录读模型：`CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord`
  - 以及 `day / week / month` 聚合器、month/week/day URL/helper、月/周统计、header toolbar 投影、状态/维度视觉 helper 与 deep link helper，不直接访问数据库
- `src/features/analysis`
  - `month=YYYY-MM` 与 `section=overview|score|rhythm|insights` URL 状态归一化、月份跳转、中文月份标题格式化、月分析类型与纯聚合器
- `src/features/happiness-score`
  - 幸福 8 要素日评分的数据类型、`1-10` 输入 schema、保存请求 schema 和评分 key 定义
- `src/components/calendar`
  - 月网格、月检查面板、周视图 7 天对比板、日视图 overview、五维紧凑卡片、header toolbar、view switcher 与 month/week/day 工作区容器
- `src/components/analysis`
  - 记录分析页壳、3 栏状态看板（评分/节奏/主线）、总览摘要、评分走势与 8 要素快扫（左侧色带选中态）、本月热力图与底部 summary bar、当天追踪 drill-in、五维主线 / 浮现 / 安静维度布局（带 topTags 高频线索 chips），以及幸福 8 要素评分录入面板。`analysis-toolbar.tsx` 独立获取月分析数据，在 `SiteHeader` 中区渲染月份翻页和 4 个 section tab（总览/评分/节奏/五维），tab 带数据依赖 contextual chip
- `src/features/joy-interview`
  - joy-first 的 prompt、引擎、AI schema、服务端逻辑
  - 当前也承载 fulfillment、reflection、improvement 与 gratitude 的理论对齐分支、专属抽取 schema，以及多维度提问 / fallback 逻辑

### 服务层

- `src/server/services/interview/interview.service.ts`
  - 当前对外暴露的统一访谈 service
  - 现实上主要是 re-export joy service 的壳子
- `src/server/services/interview/joy-interview.service.ts`
  - 会话编排、分叉决策、draft 生成与保存的主逻辑
- `src/server/services/interview/joy-interview-ai.service.ts`
  - joy、fulfillment、reflection、improvement 与 gratitude 的结构化抽取 schema 分发；同时承载问题生成、日志草稿生成与 fallback
- `src/server/services/calendar/calendar.service.ts`
  - 记录日历的 `day / week / month` 服务端查询入口
  - 只负责参数校验、日期范围计算与调用 calendar 聚合器
- `src/server/services/analysis/analysis.service.ts`
  - 月度记录分析的服务端查询入口
  - 负责月份校验、月范围计算和日志分析聚合
- `src/server/services/daily-journal/daily-journal.service.ts`
  - 当天整合日志的 source 收集、AI 轻整理、fallback 章节合集、草稿更新与保存

### 持久化层

- `src/server/repositories/joy-interview.repository.ts`
  - 会话、事件、日志、payload、legacy 字段投影映射
- `src/server/repositories/calendar.repository.ts`
  - 从 `InterviewSession / JoyEntry / DailyJournalEntry` 查询标准化 calendar source
  - 不直接计算 calendar 状态
- `src/server/repositories/analysis.repository.ts`
  - 从 `JoyEntry / DailyJournalEntry` 查询 `saved` 分析 source
- `src/server/repositories/daily-happiness-score.repository.ts`
  - 维护 `DailyHappinessScore` 的日期查询、upsert 与 record 映射
- `src/server/repositories/daily-journal.repository.ts`
  - 查询当天已保存维度日志，维护独立日级日志草稿和保存状态

## 3. 领域模型

### 3.1 维度

当前维度枚举：
- `joy`
- `fulfillment`
- `reflection`
- `improvement`
- `gratitude`

这五个维度都已经进入通用类型系统、导航和 `snapshotData / payload` 结构。

### 3.2 会话与事件

核心实体：
- `InterviewSession`
  - 维度级会话，包含当前状态、当前事件、日志引用
  - 从 `2026-05-02` 起新增 `entryDate` 作为日志归属日期真相；`startedAt` 只表示会话实际创建时间
- `InterviewEvent`
  - 单个事件级访谈单元，记录 `snapshotData`、`progressData` 和事件级状态
- `InterviewMessage`
  - 全部可恢复消息

当前事件状态：
- `active`
- `ready_for_choice`
- `completed`

当前会话状态：
- `active`
- `paused`
- `completed`
- `abandoned`

### 3.3 阶段字段的历史痕迹

虽然系统已经多维度化，但 `InterviewSession.stage` / `InterviewEvent.stage` 仍使用 `JoyInterviewStage`：
- `collect_event`
- `probe_reason`
- `probe_pattern`
- `wrap_up`
- `finalize`

这说明当前架构仍然是 joy-first 演进而来，只是外层已经做了多维度包裹。

### 3.4 日志实体

`JoyEntry` 是当前维度日志表，已经承担多维度日志容器角色：
- `title`
- `content`
- legacy 字段：`event / feeling / whyItMattered / happinessType / selfPattern`
- 新结构：`payload`
- 事件列表：`eventBlocks`
- 状态：`draft / saved`

现实上：
- legacy 字段是兼容投影
- 多维度真相在 `payload`
- joy 的更细结构也落在 `payload` 与 `snapshotData`
- `JoyEntry.date` 现在与 `InterviewSession.entryDate` 对齐，用来承接“补写过去日期”的日志归属
- repository 层读取 `JoyEntry.date` / `InterviewSession.entryDate` 时，统一按 `Asia/Shanghai` 的整天时间窗口查询（`gte dayStartUtc`、`lt nextDayStartUtc`），而不是按某个归一化时间点精确匹配

`DailyJournalEntry` 是独立日级整合日志表：
- `userId + date` 唯一
- `title / content`
- 状态：`draft / saved`
- `sourceEntryIds / sourceSessionIds / sourceSignature / sourceUpdatedAt`

现实上：
- 当天整合日志只使用同一天 `status = saved` 的维度日志
- 正文是按已有维度组织的章节合集，不补空维度
- `sourceSignature` 用于判断维度日志保存后，日级日志是否进入 `stale` 状态
- 如果来源维度日志后来不再是 `saved`、保存后的更新时间变化，或同一天新增了新的 `saved` 维度日志，当前签名都会不一致，日级日志会进入 `stale`

`DailyHappinessScore` 是独立幸福 8 要素日评分表：
- `userId + date` 唯一
- `meaning / health / virtue / autonomy / interest / skill / relationship / livingCondition` 8 个显式整数分数字段
- 只承载评分事实，不复用五维日志或当天整合日志的表结构

现实上：
- 当前已落数据模型、zod schema、repository、Prisma migration、`PUT /api/happiness-score`、`/analysis` 评分录入面板和评分趋势图
- 保存只允许 Asia/Shanghai 口径下的今天和昨天；8 项必填且必须是 `1..10` 整数
- `/analysis` 已接入轻量 SVG 趋势图：总分平均走势和 8 要素单项切换走势，未评分日期断线，不补 0

### 3.5 calendar 读模型

当前已经落地并通过 HTTP 路由公开的记录日历读模型有：
- `CalendarDayRecord`
- `CalendarWeekRecord`
- `CalendarMonthRecord`

前端当前会同时用这些读模型做两类投影：
- 正文视图本身的 month / week / day 渲染
- `SiteHeader` 中区的 calendar toolbar 标题、前后翻段和 summary chips

聚合来源固定为：
- `InterviewSession`
  - 提供 `active / paused / completed`
  - 提供 `entryDate`、`draftSummary`
  - legacy 兼容上，如果历史 session 缺少 `entryDate`，calendar source 会回退到 `startedAt` 做日期归档
- `JoyEntry`
  - 提供 `draft / saved`
  - 提供标题、正文摘要与更新时间
- `DailyJournalEntry`
  - 提供当天整合日志 `none / draft / saved / stale` 轻量状态
  - 月/周只消费轻 marker，日视图提供入口条；不在 calendar 内编辑正文

聚合规则固定为：
- 同一天同维度优先取最新有效记录
- 同一天多个维度允许并存
- `InterviewSession.entryDate`、`JoyEntry.date` 与 `DailyJournalEntry.date` 的范围查询统一按 `Asia/Shanghai` 整天窗口执行，避免同日非零点时间戳被漏算到前一天或下一天
- 无日志时只允许使用安全摘要，不暴露内部结构字段名
- 未来日期允许查询，但服务端会裁掉 `start_interview / continue_interview`，避免前端误开记录入口

### 3.6 calendar 前端工作区现实

截至 `2026-05-03`，calendar 前端已经不是“每个视图都各自放一套顶部按钮和统计卡”的自然文档流页面，而是：
- `SiteHeader` 中区承接全局 calendar 导航：
  - `month / week / day` 切换
  - 前后翻段
  - 回到今天
  - 3 个实时摘要 chip
  - calendar toolbar 与访谈维度条现在共用 header 中区高度预算，业务控制组用 `｜` 分隔，但不再套独立中区方框
  - 当页面处于 `entryDate` 访谈上下文时，当前选中维度胶囊优先显示 live session 的实时轮次 / 进度圈；其余维度，以及切到 `daily_journal` 工作区后的胶囊状态，继续使用 `CalendarDayRecord.dimensions`
- 全站 `SiteHeader` 已改为全宽暖色工具栏，不再使用居中 `page-shell` 大卡片外壳；主导航也不再包内层方框，当前页改用贴近文字的暖棕实线下划线表达，选中项字号略大；主导航不再包含【首页】项，点击左侧【幸福系统】品牌标识可返回首页
- `src/app/calendar/page.tsx` 与三个 shell 共同形成首屏工作区
- 页面本身优先不长滚动，超量内容进入 pane 内局部滚动
- 根布局不再给页面额外外边距；首页、访谈、设置和 calendar 主体都以平铺 surface 承载内容，减少大圆角外框和卡片嵌套

当前三个视图的工作区状态：
- `month`
  - 已进入双栏骨架：月历主体 + 当天检查面板
  - 右栏固定提供 `查看当天` 日期级入口
  - 月格当前固定渲染 6 行 42 格，保证每个月份的网格高度一致
  - 小格当前不再优先解释“还有什么没做完”，而是优先表达“这一天已经沉淀出的已保存维度结果”
  - 月格可见文字层固定为：
    - `1-4` 个已保存维度：显示单字 `悦 / 实 / 思 / 改 / 谢`
    - `5` 个维度都至少保存过一次：显示 `已完成`
    - 纯草稿且还没有任何已保存维度：显示 `草稿`
  - `进行中 / 混合状态` 不再作为月格可见文字出现；未完成感主要由状态符号和颜色层承担
  - today 圆点已回到日期锚点附近，右上角只保留状态词或状态点位
- `week`
  - 已升级为 7 天同屏对比板
  - 主摘要压缩成轻量周摘要块，不再保留厚重侧栏
  - 每天卡片只保留日期、状态、完成/草稿/进行中摘要、短判断文案和唯一主动作
- `day`
  - 已升级为“一条总览 + 五维紧凑操作台”
  - 总览区下方有当天整合日志入口条，进入访谈页 `mode=daily-journal`
  - 每条只保留维度身份、状态、标题或摘要、唯一主按钮和少量次级轻链接
  - `mixed` 主动作由前端稳定按 `继续访谈 -> 继续编辑 -> 查看日志 -> 开始记录` 解析
- month / week / day 三个视图当前共用暖色 calendar 工作台：
  - 五态状态色固定区分 `empty / in_progress / draft / completed / mixed`
  - 五个维度当前在可见 badge 上固定使用单字标识 `悦 / 实 / 思 / 改 / 谢`，辅助技术继续暴露完整维度名 `开心 / 充实 / 思考 / 改进 / 感谢`
  - badge、surface、marker 和主次按钮层级由 `src/features/calendar/presentation.ts` 统一投影，不再由各组件各自拼样式
  - 色温已经回收到全局暖纸张/墨色系统，不再维持蓝灰后台式分叉
  - 文案改为工作台短句，不再保留 `DAY / WEEK` 这类模板化英文眉题
  - shell / toolbar 会补 `aria-busy`，loading 用 `status`，error 用 inline `alert`，主要 CTA 有完整可访问名称

### 3.7 记录分析页现实

截至 `2026-05-04`，`/analysis?month=YYYY-MM&section=overview|score|rhythm|insights` 已进入月度记录分析的 tab 互斥视图阶段：
- `SiteHeader` 中区的 `AnalysisToolbar` 独立获取 `/api/analysis/month` 月分析数据，渲染月份翻页和 4 个 section tab（总览/评分/节奏/五维），tab 带数据依赖的 contextual chip（今天已评/未评、有记录天数、主线维度名）
- 缺失或非法 `month` 参数会被归一到当前月；缺失 `section` 时前端默认切到 `overview` 总览视图
- 已有 `GET /api/analysis/month?month=YYYY-MM`
- 页面内已有上月 / 本月 / 下月切换（在 header toolbar 中）
- 页面当前已展示：
  - SummaryHero 3 栏状态看板（评分/节奏/主线维度）始终可见于正文区顶部
  - `overview`：OverviewCards 统计卡
  - `score`：幸福 8 要素评分默认入口，先展示总分平均走势，再展示 8 要素快扫和单项细看，并只允许编辑今天和昨天，8 项 slider 全部填写后才能保存
  - `rhythm`：本月记录热力图、最长连续记录 / 空档和当天 drill-in，替代旧的记录页同款分布表
  - `insights`：主线维度 + 正在浮现 + 安静维度，避免五张卡按偶数栅格硬排
- `section` 是视图选择状态：总览 / 评分 / 节奏 / 五维四个 tab 互斥渲染，同一时间只展示一个板块；切换 tab 或翻月后 `section` 保留在 URL 中
- 分析页里“回到某维度”的 drill-down 链接会带回对应 `entryDate`，避免历史月份误跳到今天的访谈上下文
- 分析页热力区点到未来日期时，只保留 `查看当天`，不暴露 `开始这一天的记录 / 继续当天记录`
- 当前月 `rhythm` 的 `最长空档` 只统计已经发生的日期，不把未来自然日当成空档
- `GET /api/analysis/month?month=YYYY-MM` 当前额外返回 `scoreOverview`、`scoreTrend`、`scoreRecords` 与 `editableDates`
- 当月份没有任何真实分析数据时，前端直接显示真实空态，不再使用示意填充冒充分析结果
- 当月份只有评分、没有任何已保存维度日志时，`rhythm` 不会伪造最高密度日，`insights` 不会伪造主线维度，而是显示明确空态
- `PUT /api/happiness-score` 按 `userId + date` upsert `DailyHappinessScore`，保存前会确保 demo user 存在
- 当今天是自然月 1 日时，`editableDates` 仍保留昨天，保证上月最后一天的评分在当前月入口可编辑
- 趋势图只做单月查看，不做跨月同比；AI 洞察仍未接入

## 4. 结构化数据面

### 4.1 snapshot vs snapshotData

当前系统同时维护两层结构：

- `snapshot`
  - 历史 joy 结构的兼容快照
- `snapshotData`
  - 多维度 discriminated union
  - 是当前进度判断、摘要生成和收尾逻辑的主要结构来源

### 4.2 payload

日志生成后，结构化结果进入 `journalEntry.payload`：
- `joy`：`joyMoment / joySource / stateShift / meaningNeed / manualClue / ...`
- 其他维度：各自的维度专属字段

用户当前不直接看到这些字段，但它们会影响：
- 是否可以进入“生成日志”
- 是否建议跳维度
- 日志正文生成时取哪些上下文

`fulfillment` 的当前 payload 语义：
- `experience`：具体充实片段
- `progressEvidence`：今天没有白过的证据
- `fulfillmentType`：`推进完成型 / 投入积累型 / 协作贡献型`
- `valueSignal`：值得感标准

`reflection` 的当前 payload 语义：
- `trigger`：触发思考的具体片段
- `insight`：新发现 / 新理解
- `reflectionType`：`规律发现型 / 方向优势型 / 判断校准型`
- `viewpointShift`：视角变化或判断线索

`improvement` 的当前结构语义已经进入 `snapshotData` 和 `payload`：
- `situation`：改进情境
- `improvementTrack`：`repeat_good / avoid_bad`
- `stateAssessment`：这次好在哪里或不理想在哪里
- `frictionPoint`：`avoid_bad` 的具体卡点
- `repeatCondition`：`repeat_good` 的可重复条件
- `controllableFactor`：用户自己能调整的一小块
- `nextAttempt`：下一次具体尝试
- `successSignal`：可选的轻量成功信号
- `improvementType / feeling / tags`：辅助组织字段

当前 `improvement` 的 AI 抽取已经独立于 joy 泛化 schema，抽取 prompt 会禁止把“我很差 / 我不行”这类全局自责写成 `frictionPoint`，并要求 `nextAttempt` 是具体动作。用户只说清 `repeat_good / avoid_bad` 轨道、但还没有说清条件或卡点时，AI 抽取会先保留 `improvementTrack`，让 `repeatCondition / frictionPoint` 维持为空并交给下一轮追问；这类中间态不能触发完整或 partial 完成。fallback 抽取也按轨道补齐 `repeatCondition / frictionPoint / controllableFactor / nextAttempt` 的轻量线索。提问策略已经按“具体情境 -> 重复好状态或避免坏状态 -> 关键条件/具体卡点 -> 可控小调整 -> 下次最小动作/成功信号”推进，并禁止建议式、计划式和归责式口吻。由于后端仍是 joy-first 架构，新字段会先进入 `JoySnapshot` 的可选属性，再投影到 `snapshotData/payload`；legacy 列仍只承担兼容投影。

## 5. 访谈与日志流

### 5.1 启动会话

`POST /api/interview/session/start`

做的事：
- 建 session
- 建第一个 active event
- 写入显式 `entryDate`
- 生成开场问题
- 返回完整 `session hydrate` 数据

### 5.2 访谈回复

前端主链路走：
- `POST /api/interview/session/respond/stream`

SSE 事件：
- `phase`
- `delta`
- `summary`
- `question`
- `session`
- `error`

非流式路由 `respond` 仍存在，但当前主 UI 使用的是 stream 版本。

provider 流式返回的正式追问原始 `delta.text` 会原样透传给前端，不能对单个任意增量做 trim 或空白折叠；系统自己生成的完整文本、fallback 文本、最终补齐文本，以及规范化后的 `summary` 文本才进入内部切块逻辑。

截至 `2026-05-01`，访谈回复错误不再只用一句“提交失败”兜底。`respond/stream` 的 `error` 事件和非流式 `respond` 的错误 JSON 都会携带结构化 `issue`：
- `code`
- `title`
- `message`
- `resolution`
- `retryable`
- `action`
- `requestId`

这层结构由 `src/features/interview/interview-issue.ts` 定义，并由 `src/server/services/interview/respond-error.ts` 统一把 schema 校验、session 状态、分叉过期、数据库写入和未知异常映射成用户可执行的错误说明。前端 `InterviewShell` 只展示用户有行动价值的信息：原因、解决方案、错误码和 requestId。

### 5.3 分叉决策

`pendingDecision` 当前有三个分支：
- `event_complete`
  - `continue_current_event`
  - `next_event`
  - `generate_draft`
- `dimension_redirect`
  - `continue_current_event`
  - `switch_dimension`
- `boundary_insufficient`
  - `continue_current_event`
  - `next_event`
  - `pause_session`

joy 场景下，如果连续没有形成可信开心片段，会建议跳到 `improvement`。

用户表达“不想继续、不要再追问、直接生成、总结日志、整理成日志、帮我总结、追问没有意义”等边界或日志整理意图时，系统会在抽取和追问前优先处理：
- 当前维度材料足够时，直接进入 `event_complete + user_override_partial`
- 材料不足时，进入 `boundary_insufficient`，前端展示“只补一句 / 换一个片段 / 先退出”
- `pause_session` 复用现有 pause 接口，不新增数据库字段或外部 URL

### 5.4 生成日志

`POST /api/interview/session/draft/generate`

流程：
1. 收集当前 session 的 source events
2. 先组装维度无关的 `DraftBrief`
3. 再组装内部写作控制层 `DraftWritingProfile`
4. 尝试让 AI 基于 `DraftBrief + DraftWritingProfile` 生成结构化 draft
5. 对生成结果做规则质检，并统一进行语义短标题治理；如果 AI 不可用、schema 不合法或质检失败，则用 fallback draft
6. upsert `JoyEntry`
7. 用最新 session hydrate 前端

当前只支持单个 `sessionId` 生成，虽然请求体是数组。

补充说明：
- 同一个 `draft/generate` 路由同时承担首次“生成日志”和用户手动触发的后续重整。
- 当前不会再因为新增访谈消息而自动触发日志刷新；是否重整由用户自己决定。
- 这些控制都属于内部实现层：
  - 不新增公开 API
  - 不改数据库 schema
  - 不改前端日志面板交互
- 如果用户在前端日志面板里直接关闭工作区，而这次生成仍在进行，前端会主动 abort 当前请求。
- 这不会删除已有 draft，也不会修改服务端会话状态；只是终止这次前端发起的整理。
- 五个维度标题都保持 `16` 字上限，但不会再把长事件句直接 `slice` 成不完整标题；`gratitude` 会优先收束为 `被稳稳接住 / 被认真理解 / 那句及时提醒 / 有人帮我理清 / 被信任的机会` 这类语义短标题，`improvement` 会优先收束为 `表达慢下来 / 先听完再回应 / 把节奏放稳 / 提前留出缓冲 / 把边界说清楚 / 让准备更充分` 这类语义短标题。

### 5.5 保存正式日志

`POST /api/interview/session/draft/save`

做的事：
- 将当前 draft 标记为 `saved`
- 更新 session 状态
- 返回最新 `session` 与 `draftEntry`

编辑正文时走：
- `PUT /api/journal-entry/[id]`
- `PUT /api/joy-entry/[id]`（兼容）

### 5.6 当天整合日志

当天整合日志是独立于维度日志的日级成果物：
- `GET /api/daily-journal?date=YYYY-MM-DD`
- `POST /api/daily-journal/generate`
- `PUT /api/daily-journal/[id]`
- `POST /api/daily-journal/[id]/save`

生成流程：
1. 按 `date` 查询当天 `status = saved` 的 `JoyEntry`
2. 按 `joy / fulfillment / reflection / improvement / gratitude` 顺序整理 source
3. AI 轻整理为已有维度章节合集；AI 不可用时用确定性 fallback 章节
4. upsert `DailyJournalEntry` 为 `draft`
5. 后续编辑自动保存草稿，用户确认后标记为 `saved`

约束：
- 没有已保存维度日志时返回 `DAILY_JOURNAL_SOURCE_EMPTY`
- 不读取未保存草稿，不直接读取访谈消息
- 不生成空章节，不提示缺失维度
- 访谈页顶部【完整日志】按钮把主工作区切到当天日志模式，不弹层、不跳转；打开或生成当天完整日志时显示阶段进度和小树生长动效
- `mode=daily-journal` 深链只打开当天日志主区；如果页面尚未 hydrate 访谈 session，也不会调用 `/api/interview/session/start` 创建新的 joy session
- 从 `mode=daily-journal` 点击“回到访谈”时，前端会先通过 `DailyJournalWorkspace.flushPendingEdits()` 保存未触发 autosave 的草稿编辑，再移除 URL 里的 `mode`，回到同一 `dimension + entryDate` 的普通访谈 hydrate 流程
- 从维度日志 pane 切到当天日志主区前，前端会先复用日志 pane 的关闭路径：保存未暂存编辑，或取消正在生成的 draft
- 从当天日志主区返回访谈，或在当天日志主区切换访谈维度时，前端会先通过 `DailyJournalWorkspace.flushPendingEdits()` 保存未触发 autosave 的草稿编辑；保存失败或内容非法时不卸载当天日志主区，避免静默丢稿
- 当访谈维度变化且 URL 没有 `mode=daily-journal` 时，`InterviewShell` 会把 `workspaceMode` 重置为 `interview`，避免新维度会话被完整日志工作区遮住
- calendar 只展示轻量状态，不内联编辑

## 6. joy 维度为什么是当前标品

joy 已经实现的核心不是“有一个 prompt”，而是以下整套机制：

### 6.1 joy 专属槽位

强必需：
- `joyMoment`
- `joySource`
- `stateShift`
- `meaningNeed`
- `manualClue`
- `delightSignature`

可选：
- `directionSignal`
- `valueImpact`
- `durability`
- `tags`

### 6.2 完成规则

当前 joy 的关键完成标准不是“聊完一件事”，而是：
- 找到可信 `joyMoment`
- 说清 `joySource`
- `meaning_track` 至少确认 `stateShift` 或 `meaningNeed`，最终沉淀出 `manualClue`
- `delight_track` 必须确认 `stateShift`，最终沉淀出 `delightSignature`

这意味着 joy 不再只有一条“越深越好”的收尾路径。

但当前产品还支持一个明确的例外路径：
- 如果 `joyMoment / joySource / stateShift|meaningNeed` 已经成立
- 且用户明确表示不想继续提炼规律
- 系统可以开放“生成当前版本日志”，但正文不能伪装成已经形成稳定规律

### 6.3 用户可见产物

用户现在看到的是：
- 对话中的浅色 `thinkingSummary` 思路层：呈现 AI 对用户回复的理解和处理焦点，五个维度都会通过 `summary` SSE delta 流式展示；它不能写成第二个正式追问
- 日志正文初稿

用户不再看到：
- 结构化线索卡
- 槽位化的 joy 结构摘要

这意味着 joy 已经完成了“结构内隐、正文外显”的第一阶段产品化。

## 7. fulfillment 维度为什么也是当前标品

fulfillment 已经从“普通完成感复盘”收束为“今天为什么不算白过”的专属访谈维度。

### 7.1 fulfillment 专属槽位

核心槽位：
- `experience`
- `progressEvidence`
- `valueSignal`

辅助槽位：
- `feeling`
- `fulfillmentType`
- `tags`

`valueSignal` 在产品中文里固定称为“值得感标准”。它不是抽象价值观口号，而是从具体推进、积累或贡献证据里长出来的判断。

### 7.2 完成规则

完整模式成立需要：
- 找到可信 `experience`
- 说清可信 `progressEvidence`
- 形成可信 `valueSignal`

部分模式成立需要：
- 找到可信 `experience`
- 说清可信 `progressEvidence`
- 用户明确表示不想继续提炼值得感标准

部分模式下，日志只能停在“这件事为什么让今天不算白过”，不能伪装成已经形成稳定值得感标准。

### 7.3 成稿与质量门

fulfillment 已接入统一成稿链路：
- `DraftBrief`
- `DraftWritingProfile`
- AI draft prompt
- draft quality gate
- fallback draft

质量门会拒收：
- 周报、汇报、绩效总结口吻
- 只有忙碌没有进展证据
- 空泛成长口号
- 部分模式硬写值得感标准
- 从一次局部推进硬拔到人生方向或职业使命

## 8. reflection 维度为什么也是当前标品

reflection 已经从“普通想法记录”收束为“从今天片段里看见新的判断依据”的专属访谈维度。

### 8.1 reflection 专属槽位

核心槽位：
- `trigger`
- `insight`
- `viewpointShift`

辅助槽位：
- `feeling`
- `reflectionType`
- `tags`

`reflectionType` 当前固定为：
- `规律发现型`
- `方向优势型`
- `判断校准型`

### 8.2 完成规则

完整模式成立需要：
- 找到可信 `trigger`
- 说清可信 `insight`
- 形成可信 `viewpointShift`

部分模式成立需要：
- 找到可信 `trigger`
- 说清可信 `insight`
- 用户明确表示不想继续提炼判断线索

partial 模式下，日志只能停在“这次片段带来的当前理解”，不能伪装成已经形成稳定判断标准。

### 8.3 成稿与质量门

reflection 已接入统一成稿链路：
- `DraftBrief`
- `DraftWritingProfile`
- AI draft prompt
- draft quality gate
- fallback draft

质量门会拒收：
- 没有触发片段
- 没有新理解
- 行动计划腔
- 心理诊断腔
- 人生结论腔
- partial 模式硬写稳定判断线索

## 9. gratitude 维度为什么也是当前标品

gratitude 已经从“通用感谢复盘”收束为“看见谁回应了我的需要”的专属访谈维度。

### 9.1 gratitude 专属槽位

核心槽位：
- `gratitudeMoment`
- `gratitudeTarget`
- `kindAction`
- `seenNeed`
- `gratitudeReason`
- `relationshipSignal`

辅助槽位：
- `innerEffect`
- `gratitudeType`
- `reciprocityHint`
- `tags`

`gratitudeType` 当前固定为：
- `支持回应型`
- `理解体谅型`
- `陪伴接住型`
- `照顾减负型`
- `信任机会型`

### 9.2 完成规则

完整模式成立需要：
- 找到可信 `gratitudeMoment`
- 说清可信 `kindAction`
- 说清可信 `seenNeed`
- 说清可信 `gratitudeReason`
- 形成可信 `relationshipSignal`

部分模式成立需要：
- 找到可信 `gratitudeMoment`
- 说清可信 `kindAction`
- 说清 `seenNeed` 或 `gratitudeReason`
- 用户明确表示不想继续提炼关系线索

partial 模式下，日志只能停在“这份感谢为什么重要”，不能伪装成稳定关系判断，也不能硬写回馈任务。

### 9.3 成稿与质量门

gratitude 已接入统一成稿链路：
- `DraftBrief`
- `DraftWritingProfile`
- AI draft prompt
- draft quality gate
- fallback draft

质量门会拒收：
- 没有具体感谢片段
- 没有具体善意行为
- 没有被回应的需要
- 感谢信模板或表扬稿
- 道德负债感、还人情、强行回馈任务
- partial 模式硬写稳定关系线索

## 10. 前端工作区现状

访谈页当前是左右布局：
- 左侧：对话区
- 右侧：日志

日志工作区行为：
- 只有在已有 `journalEntry` 时才会打开
- 第一次生成时显示阶段式 loading 状态
- 当前草稿已经覆盖到最新访谈状态时，再次点击“生成日志”会直接复用，不再重复发起生成
- 标题、正文和保存动作现在收拢在同一个日志编辑 pane 里
- 标题当前固定单行显示，限制 `16` 字，不再依赖横向滑动查看
- 面板头部不再显示“日志”标题，只保留关闭按钮，正文整体上移
- 已有草稿后，新访谈内容不会自动触发刷新；用户手动点击“生成日志”后才会进入阶段式刷新
- 工作区不再额外展示“正在根据最新访谈重整”或“我已经整理出一版日志”这类说明文案
- 当前工作区支持纵向滚动
- 如果用户在生成过程中关闭工作区，这次整理会被取消，访谈分岔点按钮恢复可点击

访谈页顶部当前还带一个开发辅助动作：
- `清除对话记录`
- 只清当前维度的本地恢复入口，并强制前端新开一轮会话
- 不对应新的后端删除接口，也不会清历史数据库记录

对用户来说，右侧的唯一主对象是“日志正文”，不是结构化摘要。

## 11. 已知架构债务

这些是当前最重要的架构现实：

1. `interview.service.ts` 仍是 joy-first 的导出层  
   多维度看起来已经通用，但后端编排内核还没有真正拆开。

2. `improvement` 与 `gratitude` 已完成正文产品闭环，但仍需要端到端产品验收  
   二者都已经有专属结构、AI 抽取 guardrails、fallback 抽取、阶段推进、完成标准、正文生成、质量门、fallback draft、标题治理和自动化验收样例。

3. `JoyEntry` 表名已不再准确  
   它已经承担多维度日志容器角色，但数据库命名仍带有 joy 历史痕迹。

4. 语音转写仍是 stub  
   `/api/transcribe` 只保留了接口与回退位置，没有接真实模型。

5. joy、fulfillment、reflection、improvement 与 gratitude 正文文风仍需继续打磨  
   当前已经从结构卡转向正文优先，但“产品完成度”还没有完全到位。
