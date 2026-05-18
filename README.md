# Happiness-system-codex

一个把“幸福日志”理论翻译成 AI 访谈产品的 Next.js 应用。

截至 `2026-05-17`，这个仓库的真实状态是：
- 已有 `joy / fulfillment / reflection / improvement / gratitude` 五个维度的通用访谈壳子。
- `joy / fulfillment / reflection / improvement / gratitude` 已完成理论对齐深化，是当前五个标品维度。
- `improvement` 已完成理论规格、数据结构扩展、AI 抽取独立化、fallback 抽取、访谈阶段推进、专属提问策略、完整 / partial 收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- `gratitude` 已完成理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完整 / partial 收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- 五个维度的 stitched 多事件日志现在都共用“完整 stitched brief 不截断”的 supporting-scene 约束：`eventWindow` 只裁剪事件列表与消息窗口，不再重建缩水版 `draftBrief`；AI prompt、质检和 fallback 都会继续保留窗口外 supporting moments，避免 minor refresh 静默丢掉后续来源事件。
- 五个维度的 `thinkingSummary`、日志正文、日志标题和 `joy` draft 质检现在都共用一层服务端语义解释层：系统会先判断当前片段在维度理论里属于什么主题、为什么成立，再把这层解释投影到 summary、`DraftBrief`、短标题和 quality gate；这层内部解释不能直接写进用户可见正文或 fallback draft。`joy` 质量门接受语义等价改写，但会拒绝“更像轻快乐 / 关键不是深意义 / 象征意义 / 确定性”这类内部理论腔和抽象收尾。
- `fulfillment` 质量门现在接受“没白费 / 终于落了地 / 总算收住了”这类自然换述，不再因为没有命中少数固定理论词就把有效 AI 草稿静默打回 fallback；`gratitude` stitched supporting-scene 的 loose anchor 也重新收紧，不会因为共用几个壳子短语就误放行被改写的副事件。
- `InterviewSession` 现在有显式 `entryDate`，日志归属日期不再默认等于 `startedAt`。
- 首版账户体系已经接入：
  - 支持用户名 + 密码注册与登录
  - 登录态使用 `httpOnly` cookie `dl_session`
  - 注册时必须勾选《用户协议》《隐私政策》
  - 私有页面 `/interview /calendar /analysis /profile /settings /settings/account` 未登录会跳转到 `/login?next=...`
  - 已登录访问 `/login` 或 `/register` 会优先回到 `next`，否则回到 `/interview`
  - 账号删除会级联删除该用户的会话、日志、评分、画像、记忆和认证会话
  - 前端 interview 本地恢复缓存与“上次维度”记忆已按 `userId` 做作用域隔离，避免同浏览器多账号串线
- 普通 `/interview` 入口现在默认代表”今天的新记录入口”：本地按维度缓存的 session 和当前页面已经挂载的 live session，都只有在 `entryDate === 今天` 时才会被自动恢复；显式带 `entryDate` 的 deep link 仍只会恢复同一天的 session。访谈页正文区会显示”当前记录日期：YYYY-MM-DD”。
- 记忆系统（用户画像）已合并进 main：支持 pgvector 向量嵌入、AI 自动从访谈中提取用户模式、语义检索注入访谈 prompt、独立 `/profile` 页面查看和编辑画像；该功能由 `memoryEnabled` 设置项控制，默认关闭。
- `reflection` 在 `continue_current_event` 场景里新增了防回卷约束：如果上一轮已经问过“具体经历 / 对话”，且用户明确回答没有，继续深聊时不会再追同一字段，而会改问更低压的具体锚点，比如某个顾虑、画面、比较时刻或选择瞬间。
- 记录日历的 month/week/day 三层已经落地：calendar 展示层读模型、`/api/calendar/day|week|month`、`/calendar` 月/周/日视图、以及进入访谈/日志的 deep link 都已完成。
- calendar / 当天整合日志 / 月分析的按天查询现在统一走 `Asia/Shanghai` 的整天时间窗口，不再用单个归一化时间点做精确匹配；同一天任意时刻保存的维度日志都会归到正确 `entryDate`。
- 当天整合日志已经落地：访谈页顶部【完整日志】按钮会把主工作区切到当天日志模式，基于当前 `entryDate` 已保存的维度日志生成五维章节合集；打开或生成完整日志时会显示与单维度日志一致的共享阶段进度、细进度轨和书页生长动效。
- 当天整合日志的来源集合现在会随同日新增 `saved` 维度日志或已有来源更新时间变化而进入 `stale`；来源签名按“同一天每个维度最新一篇 `saved` 日志”计算，重新生成后章节数会与当天真实 `saved` 维度集合重新对齐。
- 完整日志工作区离开前会先保存未自动暂存的当天日志编辑；从完整日志切回访谈或切换访谈维度时，不会静默丢失 700ms autosave 触发前的输入，也不会让新维度被卡在完整日志工作区背后。
- `/calendar` 顶部导航中区现在会承接 month/week/day 的全局切换、前后翻段、回到今天和实时摘要；正文不再重复放一套导航。
- 顶部导航栏当前已经统一成全宽暖色工具栏：不再作为居中大卡片悬浮，calendar toolbar、访谈维度条和主导航都直接平铺在 header 里，不再额外套内层方框；主导航当前页用贴近文字的暖棕实线下划线表达，选中项字号略大；访谈和 calendar 业务控制组用 `｜` 做轻量分隔。主导航不再包含【首页】项，点击左侧【Daily Light】品牌标识可返回首页。
- 带 `entryDate` 的访谈页里，header 当前选中维度会优先显示 live session 的实时轮次和进度圈；其余维度，以及切到当天整合日志工作区后的胶囊状态，继续以 `/api/calendar/day` 的 day snapshot 为准。只要某个维度当天已经有 `saved` 日志，胶囊会优先显示 `已完成`，即使同一天还有继续中的 session。
- opening-only 空会话（只有 opening assistant、`turnCount = 0` 且没有用户回复）不再把 header 当前维度、calendar 当天状态或相关统计点亮成“进行中”；这类空开场 session 仍会保留在库里，但不会继续污染当天状态。
- 如果当前 active choice 是 `boundary_insufficient` 或 `dimension_redirect`，当前选中维度的 live progress 会被压在 `88%` 以下，不会被历史 `draftGenerationUnlocked` 顶回 ready 状态。
- 首页已重构为品牌广告页，主线为“在日常里照见自己 -> 回顾一天显露纹理 -> 五维认识自己 -> 日有所记心有所归”；文案与图片配置集中在 `src/content/homepage.ts`，当前已接入 `public/homepage/*` 本地图片，并把 Hero / 痛点 / 日志 / 沉淀图片区统一收成“单行标题 + 图片本体”的去卡片化广告片布局，首页木纹背景也已调成上浅下深。
- `/analysis?month=YYYY-MM&section=overview|score|rhythm|insights` 记录分析页当前是 tab 互斥视图的月度复盘工作台；`score` 分区现在是纯趋势阅读（总分走势 / 8 要素快扫 / 单项细看），不再承载评分录入。幸福 8 要素评分录入入口已迁到 `/interview` 顶部「当天评分」，并作为独立 `happiness_score` 工作区展示；分析页继续负责评分趋势解释与 drill-down。`PUT /api/happiness-score` 允许保存所有非未来日期（Asia/Shanghai 口径），当前月评分保存成功后 header toolbar 的 contextual chip 会立即刷新；评分 chip 当前文案为 `暂无评分 / N天已评分`。
- 全站前端壳层已经切到平铺工作台：根布局不再给页面额外包外距，首页、访谈、设置和 calendar 主体减少大圆角外框、重复模块间隙和卡片套卡片。
- calendar 页面已经进入“首屏工作区 + 局部滚动容器”结构：
  - 月视图桌面是“月历主体 + 当天检查面板”的双栏骨架，右侧提供 `查看当天` 入口；小屏改为月历主体在上、当天检查面板在下，不再依赖横向滚动访问右侧面板
  - `SiteHeader` 会把真实 header 高度同步给首屏工作区；calendar / analysis / settings 这类页面会按剩余视口高度布局，小屏、多行 toolbar 或 header 换行时不会再因为顶部 offset 写死而制造底部假留白
  - 月查询失败时，月视图仍保持“月历主体 + 当天检查”的方框 split-pane 骨架，左右 pane 各自给出错误说明与重试，不会退回旧的圆角浮卡或伪装成空白日
  - 月格当前固定渲染 6 行 42 格，loading skeleton 也保持 42 格，保证加载前后高度一致；可见文字层优先表达“当天已经沉淀出的已保存维度结果”
  - 月格当前使用单字维度标记 `悦 / 实 / 思 / 改 / 谢`；`1-4` 个已保存维度显示对应单字，`5` 个维度都至少保存过一次时收束为 `已完成`
  - 月格当前不再把 `进行中 / 混合状态` 作为可见文字标签；未完成感主要由状态符号和颜色层承担
  - 月视图当天检查面板当前汇总 `待继续 / 已完成 / 完整日志`，完整日志状态显示 `未生成 / 可汇总 / 草稿 / 已保存 / 需更新`；过去空白日只显示轻空态，不再列 5 个空维度，月查询失败时右侧不会伪装成空白日
  - 周视图当前是 7 天同屏对比板，主动作会优先直达值得继续的业务链路；`继续访谈 / 继续编辑 / 查看日志` 会分别落到活动会话、草稿会话和已保存日志对应会话
  - 日视图当前是五维紧凑操作台，`mixed` 主动作稳定按 `继续访谈 -> 继续编辑 -> 查看日志 -> 开始记录` 解析
  - 日视图顶部会以紧凑入口条暴露当天整合日志；月/周只显示轻量 marker，不抢占月格单字维度语义
  - month / week / day 三个视图现在共用暖色 calendar 工作台：五态状态色、轻量 card 层级，以及固定维度标识；其中周视图、日视图和月视图右侧检查面板的可见 badge 已切成单字 `悦 / 实 / 思 / 改 / 谢`
  - calendar 文案当前已经切到工作台短句语气，并补齐 `aria-busy`、焦点态、错误/加载语义和主要 CTA 的可访问名称
- 用户在访谈结束后点击“生成日志”，看到的是可继续编辑的日志正文，而不是结构化槽位。
- 已保存的维度日志或当天整合日志再次编辑时，会先回到 `draft`；只有用户点击“保存修改”后才重新成为正式保存版本。
- 历史 `choiceKind` assistant turn 在刷新 / 恢复后仍保留在 transcript 中；但只要当前正在显示 inline choice card，聊天记录里会先隐藏所有 choice turn，避免和卡片重复。只有卡片结束后，最终停在 transcript 末尾的历史 choice 才会继续可见。
- `gratitude` 的 `stitched_moments` supporting-scene 质量门现在只接受仍保留明确照顾动作和足够场景锚点的自然压缩：把“请我吃冰淇淋，还问要不要喝水”写成“请我吃冰，还问我渴不渴”仍可通过，但“后来她想吃冰，我陪她去买了”这类语义反转会继续被拦住。
- `respond/stream` 会原样透传 provider 的 `delta.text` 空白字符，不再在 SSE chunk 边界折叠空格或吞掉换行；用户流式阶段看到的文本与最终保存的助手消息保持一致。

## 当前产品状态

### 已完成
- 多维度访谈入口、维度切换与本地 session 恢复
- joy 维度的结构化抽取、进度判断、分叉决策、日志生成与保存
- fulfillment 维度的理论对齐、阶段推进、partial 放行、专属抽取、提问策略、日志生成、质量门与 fallback
- reflection 维度的理论对齐、阶段推进、partial 放行、专属抽取、提问策略、日志生成、质量门与 fallback
- improvement 维度的理论对齐、`snapshotData/payload` 字段扩展、专属 AI 抽取 schema、fallback 抽取、提问策略、完整 / partial 收束、日志生成、质量门、fallback draft、标题治理与自动化验收样例
- gratitude 维度的理论对齐、`snapshotData/payload` 字段扩展、专属 AI 抽取 schema、fallback 抽取、提问策略、完整 / partial 收束、日志生成、质量门、fallback draft、标题治理与自动化验收样例
- joy 日志已接入通用成稿蓝图：先组装内部 `DraftBrief + DraftWritingProfile`，再生成正文并做质检
- joy 的 `delight_track` 收束已经收紧：`delightSignature` 必须是可直接写进日志的自然中文线索，不能用长度兜底放行，也不能接受 `象征意义 / 确定性 / 动作本身` 这类抽象短语或 `清醒 / 从容 / 有准备` 这类单纯状态词
- fulfillment 日志已接入同一成稿链路，围绕“今天为什么不算白过”和“值得感标准”生成正文
- reflection 日志已接入同一成稿链路，围绕“从片段里看见新的判断依据”生成正文
- gratitude 日志已接入同一成稿链路，围绕“谁回应了我的需要”和“什么样的关系回应值得珍惜”生成正文
- 日志工作区：手动生成、编辑、保存；标题当前固定单行显示，最大 `16` 字
- 当天整合日志：只使用已保存维度日志，生成后进入独立草稿，可自动保存并正式保存；正文上限 `6000` 字
- 当天整合日志来源、calendar/day 聚合和 analysis 月范围统计统一按 `Asia/Shanghai` 的整天时间窗口取数，而不是按单个时间点精确匹配
- 五个维度的日志标题统一经过语义短标题治理，不再把长事件句机械截断成标题；joy 会拦截 `一下被带轻 / 象征意义` 这类伪中文或理论词标题，早起/多出时间/准备感场景应收束为 `清醒地开始` 这类自然短标题
- 用户表达“不想继续 / 不要再追问 / 直接生成 / 总结日志 / 整理成日志”等边界或日志整理意图时，边界优先级高于槽位完整度；材料足够则 partial 收束，材料不足则给低压选择
- 访谈提交错误已经结构化；`respond/stream` 与 `respond` 会返回带 `code / title / message / resolution / retryable / action / requestId` 的错误说明，前端展示原因、解决方案和错误码
- 日志生成已支持阶段式反馈；如果当前草稿已经是最新版本，再次点击会直接复用，不再重复等待
- 访谈页开发辅助：可清除“当前维度”的本地对话恢复记录并直接重开一轮
- `snapshotData` / `payload` 驱动的多维度结构化数据面
- `entryDate` 驱动的会话日期归属与补写过去日期基础
- `CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord` 读模型与对应服务端聚合链路
- `GET /api/calendar/day|week|month` 公开日历查询接口
- `/calendar?view=month|week|day&date=YYYY-MM-DD` 月/周/日视图页面
- `/analysis?month=YYYY-MM&section=overview|score|rhythm|insights` 月度记录分析页面
- `DailyHappinessScore` 独立数据模型、Prisma migration、zod schema、repository 映射、`PUT /api/happiness-score` 保存接口、访谈页独立评分工作区与分析页总分 / 单项评分趋势图
- `/calendar -> /interview` 的 `sessionId / entryDate / panel` 深链
- `/calendar -> /interview` 的 `mode=daily-journal` 深链会打开当天整合日志主区，且不会启动或创建新的维度访谈 session；点击“回到访谈”会先保存当天日志 pending 编辑，再移除 `mode` 并恢复所选日期的正常访谈 hydrate
- joy 理论对齐基线文档：`docs/theory/joy-alignment.md`
- fulfillment 理论对齐基线文档：`docs/theory/fulfillment-alignment.md`
- reflection 理论对齐基线文档：`docs/theory/reflection-alignment.md`
- improvement 理论对齐开发规格：`docs/theory/improvement-alignment.md`
- gratitude 理论对齐基线文档：`docs/theory/gratitude-alignment.md`

### 尚未完成
- `improvement` 的端到端产品验收与文风继续打磨
- 真实语音转写模型接入
- 跨天长期记忆与稳定规律汇总
- joy / fulfillment / reflection 日志正文的最终产品级文风打磨

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local`，至少保证这些字段存在：

```bash
DATABASE_URL="postgresql://zouzhijie@localhost:5432/happiness_system_codex?schema=public"
AI_PROVIDER="volcengine-ark"
VOLCENGINE_ARK_API_KEY=""
VOLCENGINE_ARK_ENDPOINT_ID=""
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
APP_URL="http://localhost:3000"
VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID=""  # embedding 模型（doubao-embedding），用于记忆系统向量嵌入
```

### 3. 同步数据库 schema

首次启动或拉到最新代码后，先执行：

```bash
npx prisma db push
```

如果你看到类似 `InterviewEvent.snapshotData does not exist` 的报错，基本也是这一步没做。
如果你是在已有本地数据的库上同步到 `2026-05-02` 之后的代码，且 `db push` 提示无法新增必填 `entryDate`，请改看 `docs/operator-runbook.md` 里的 `entryDate` 同步说明。
如果你是在已有本地数据的库上首次同步账户体系，且注册时报 `User.username does not exist` 或 `db push` 无法为 `User` 新增必填认证字段，请先执行：

```bash
psql -h localhost -p 5432 -d happiness_system_codex -U zouzhijie -f prisma/migrations/20260516233200_add_auth_session_and_user_credentials/migration.sql
```

执行完这条 migration 后，再继续 `npx prisma db push` 或直接启动开发服务器。

### 4. 启动开发服务器

```bash
npm run dev
```

默认地址：
- `http://localhost:3000`

### 4.1 首版账户体系说明

- 首版账户标识是 `username`，不是邮箱，也不是手机号
- 首版不支持找回密码，UI 只提示用户妥善保管密码，不提供伪入口
- 核心认证页面与接口：
  - 页面：`/login`、`/register`、`/settings/account`、`/legal/terms`、`/legal/privacy`
  - API：`/api/auth/register`、`/api/auth/login`、`/api/auth/logout`、`/api/auth/session`、`/api/auth/delete-account`

### 5. 回归检查

```bash
npx tsc --noEmit
npm test
```

截至 `2026-05-17`，当前自动化现实为：
- `npm test`（Vitest）在当前 worktree 通过：`65` 个测试文件、`554` 个测试
- `npx tsc --noEmit` 通过
- `npm run build` 通过；仍有既有 ESLint warnings（主要是未使用变量和部分 hook 依赖提示），但不阻塞构建
- Vitest 当前默认只扫描 `tests/**/*.test.{ts,tsx}`，并排除 `.worktrees/**` 与 `.claude/worktrees/**`，避免历史 worktree 噪声污染主仓结果

## 常用命令

```bash
npm run dev
npm test
npx tsc --noEmit
npx prisma db push
```

## 文档导航

- 项目级 agent 说明：`AGENTS.md`
- 设计系统规范：`DESIGN.md`
- 当前架构：`docs/architecture.md`
- 当前 API 面：`docs/integration-guide.md`
- 本地排障与运行手册：`docs/operator-runbook.md`
- 当前阶段 handoff：`docs/handoff.md`
- joy 理论对齐：`docs/theory/joy-alignment.md`
- fulfillment 理论对齐：`docs/theory/fulfillment-alignment.md`
- reflection 理论对齐：`docs/theory/reflection-alignment.md`
- improvement 理论对齐开发规格：`docs/theory/improvement-alignment.md`
- gratitude 理论对齐：`docs/theory/gratitude-alignment.md`
- 维度正文生成模板：`docs/theory/dimension-draft-template.md`
- 理论原文：`docs/theory/精简-如何实现幸福.pdf`
- 记忆系统实施计划：`docs/memory-system-implementation-plan.md`
- 历史设计稿：`Tech_Design.md`

## 关键实现现实

- `src/server/services/interview/interview.service.ts` 目前主要是对 `joy-interview.service.ts` 的导出壳子。
- `src/server/services/calendar/calendar.service.ts` 与 `src/server/repositories/calendar.repository.ts` 负责 `day / week / month` 记录读模型查询；`src/app/api/calendar/*` 已公开这三条只读 HTTP 路由。
- `src/app/calendar/page.tsx` 与 `src/components/calendar/*` 已落地 month/week/day 路由分发、header 中区的 calendar 控制条、工作区壳层、月视图双栏检查面板、周视图 7 天对比板与日视图五维紧凑操作台。
- `src/components/shared/site-header.tsx` 现在会在客户端测量真实 header 高度，并把结果写回 `--site-header-viewport-offset`；calendar / analysis / settings 这类首屏工作区会按这个真实高度扣减剩余视口，而不是依赖固定 `4rem`。
- `src/app/analysis/page.tsx`、`src/components/analysis/analysis-shell.tsx`、`src/features/analysis/view-state.ts`、`src/features/analysis/types.ts`、`src/features/analysis/narrative-service.ts`、`src/features/analysis/aggregate-month.ts`、`src/server/services/analysis/analysis.service.ts` 与 `src/server/repositories/analysis.repository.ts` 已落地记录分析入口、`month + section` URL 归一化、`/api/analysis/month`、`AnalysisNarrative` 叙事数据结构、`generateMonthNarrative` 占位叙事生成服务（预留 AI 接入口，降级到模板文本）、`dailyCoverage` 中的日志标题与内容预览、总览叙事驱动布局（`SummaryHero` + 洞察卡片 + 数据锚点）、评分趋势高亮卡关联维度日志上下文、评分图数据点可点击弹出当日日志详情卡、热力图选中日日志预览区与 tooltip 日志状态、五维 `dimensionTheses` 优先使用 AI 叙事与证据日历日链接、`dailyCoverage / rhythmOverview / insightsOverview / scoreOverview / scoreTrend / scoreRecords / editableDates / narrative` 返回、评分趋势阅读工作台（录入入口已迁移到访谈页独立评分工作区）与样本不足提示。
- `src/features/happiness-score/schema.ts`、`src/features/happiness-score/types.ts`、`src/features/happiness-score/presentation.ts`、`src/components/interview/happiness-score-entry.tsx`、`src/server/services/happiness-score/happiness-score.service.ts`、`src/server/repositories/daily-happiness-score.repository.ts`、`src/app/api/happiness-score/route.ts` 与 `prisma/migrations/20260503143000_add_daily_happiness_score/migration.sql` 已落地幸福 8 要素日评分的数据模型、zod schema、展示顺序配置、访谈页独立评分工作区与保存接口（非未来日期可保存）。
- `src/features/calendar/presentation.ts` 现在是 calendar 状态色、维度标识和 badge / surface / marker class 的单一视觉真相源。
- `src/features/calendar/toolbar.ts` 负责把当前 `view/date` 投影成 header 标题、前后翻段和摘要 chip。
- `fulfillment`、`reflection`、`improvement` 与 `gratitude` 已在 joy-first 服务壳子内完成理论对齐。
- `/api/transcribe` 当前只是占位接口，返回模拟 transcript。
- `/api/journal-entry/[id]` 是当前日志编辑主路由，`/api/joy-entry/[id]` 只是兼容别名。
- `/api/daily-journal*` 是当天整合日志的查询、生成、草稿更新和保存接口。
- `/api/interview/session/start` 现在支持可选 `entryDate: YYYY-MM-DD`，session hydrate 也会返回 `entryDate`。

## 已知限制

- joy 现在已支持双收尾：
  - `meaning_track` 收束到“个人规律 / 使用说明书线索”
  - `delight_track` 收束到“轻快乐线索”
- fulfillment 现在以 `experience / progressEvidence / valueSignal` 为核心槽位，完整模式收束“值得感标准”，部分模式只停在“今天为什么不算白过”。
- reflection 现在以 `trigger / insight / viewpointShift` 为核心槽位，完整模式收束“判断线索”，部分模式只停在“这次片段带来的当前理解”。
- improvement 现在的内部数据结构已扩展为 `situation / improvementTrack / stateAssessment / frictionPoint / repeatCondition / controllableFactor / nextAttempt / successSignal / improvementType / feeling / tags`，AI 抽取和 fallback 抽取都会区分 `repeat_good` 与 `avoid_bad`；如果用户只分清了改进轨道但还没有说清条件或卡点，AI 抽取会先保留 `improvementTrack`，把 `repeatCondition / frictionPoint` 留给下一轮追问，不把中间态误判成可完成材料；访谈提问已按“具体情境 -> 改进轨道 -> 关键条件/卡点 -> 可控小调整 -> 下次最小动作/成功信号”推进，并避免建议、计划和自责归因口吻；日志成稿已接入正文生成、质量门、fallback draft 和标题治理，标题候选会优先收束为 `表达慢下来 / 先听完再回应 / 把节奏放稳 / 提前留出缓冲 / 把边界说清楚 / 让准备更充分` 这类语义短标题。
- gratitude 现在的内部数据结构已扩展为 `gratitudeMoment / gratitudeTarget / kindAction / seenNeed / innerEffect / gratitudeReason / gratitudeType / relationshipSignal / reciprocityHint / tags`，完整模式收束“关系线索”，partial 模式只停在“这份感谢为什么重要”，并禁止感谢信模板、道德负债感和强行回馈任务。
- 五个维度在多事件 `stitched_moments` 场景下，都共享 supporting-scene 质量门；当前 `eventWindow` 只裁剪 `events` 与消息窗口，完整 `draftBrief` 里的 supporting moments 不会被截断，因此 `refresh_minor` 不会静默丢掉窗口外来源事件。若 AI draft 仍被拒收，fallback draft 会保留主事件外最多 `2` 个 supporting moments，而不是退化成只剩主事件。
- 如果用户明确拒绝继续提炼，或用“总结日志 / 整理成日志 / 帮我总结”等自然语言要求收束，五个维度都允许在核心材料成立时先生成当前版本日志。
- 如果用户拒绝继续但材料不足，系统会停止追问细节，提供“只补一句 / 换一个片段 / 先退出”。
- 如果访谈提交失败，前端会展示结构化错误原因、处理建议、错误码和 requestId；例如 `MESSAGE_TOO_LONG` 会提示拆成两段发送，服务不可用会提示确认服务运行后刷新。
- joy / fulfillment / reflection / improvement / gratitude 的最终正文文风还要继续打磨。
- 已有草稿后，新的访谈内容不会自动触发日志整理；用户手动点击“生成日志”后才会刷新。
- 如果用户在日志整理过程中直接关闭日志面板，当前这次整理会被取消；这也是当前有意设计。
- 如果从维度日志面板切到顶部【完整日志】当天整合日志主区，前端会先保存未暂存编辑或取消正在生成的 draft，再切换主工作区。
- 如果从完整日志主区返回访谈，或在完整日志主区切换访谈维度，前端会先 flush 当天日志的未自动保存编辑；保存失败或内容非法时会留在完整日志工作区并展示错误。
- 结构化线索仍然存在于系统内部，用来驱动进度、收尾和日志生成，但不会直接展示给用户。
- `thinkingSummary` 是用户可见的浅色思路层，用来呈现 AI 对用户回复的理解和处理焦点；五个维度都会通过 `summary` SSE delta 流式展示这层内容，并且不能写成第二个正式追问。
- 如果模型给出的 `thinkingSummary` 只是浅复述、语气不对或写成第二个追问，服务端会基于同一层维度语义解释重写它，不会直接把浅复述透传给用户。
- `respond/stream` 现在会原样透传 provider 的 `delta.text`，不对任意流式增量单独 trim 或折叠空白；只有系统自己生成的完整补发文本才允许内部切块。
- calendar 功能当前已完成 month/week/day 三层：
  - `InterviewSession.entryDate`
  - `CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord`
  - `getCalendarDay / getCalendarWeek / getCalendarMonth`
  - `GET /api/calendar/day|week|month`
  - `/calendar?view=month|week|day&date=YYYY-MM-DD`
  - 顶部导航中区承接 `month / week / day` 切换、前后翻段、回到今天与实时摘要
  - calendar 页面正文已进入首屏工作区；超量信息进入 pane 内局部滚动
  - 月视图桌面是“月历主体 + 当天检查面板”的双栏骨架，小屏是上下堆叠工作台，并提供 `查看当天` 日期级入口
  - 月格 loading skeleton 与真实月格一样固定为 6 行 42 格；请求失败时右侧当天检查不会回退成假空白日
  - 月格当前按“已保存结果优先”的规则表达：有已保存维度时显示单字 `悦 / 实 / 思 / 改 / 谢`，五维都至少保存过一次时显示 `已完成`
  - 月格当前不再把 `进行中 / 混合状态` 作为可见文字标签；未完成感主要由状态符号和颜色层承担
  - 月视图当天检查面板汇总 `待继续 / 已完成 / 完整日志`，过去空白日使用轻空态而不是展示 5 个空维度
  - 未来空白日继续改为中性待到来语义，不再制造“漏记”感觉
  - 周视图当前是 7 天同屏对比板，卡片主动作优先直达 `继续访谈 / 继续编辑 / 查看日志`，无可直达动作时回退 `查看当天`
  - 日视图当前按五维紧凑操作台组织，主按钮稳定按 `继续访谈 -> 继续编辑 -> 查看日志 -> 开始记录` 解析；`编辑日志` 只保留为已保存维度的次级轻链接
  - 带 `entryDate` 的访谈页里，当前选中维度胶囊会优先显示 live session 的实时轮次 / 进度圈；其余维度和完整日志工作区内的胶囊继续按 day snapshot 展示
  - 当天整合日志状态已经进入 calendar 读模型；月/周用轻 marker，日视图用紧凑入口条，编辑仍回到访谈页主工作区
  - month / week / day 当前共用暖色 calendar 工作台：状态 badge、卡片 surface、维度单字 badge `悦 / 实 / 思 / 改 / 谢` 和主次按钮层级都由前端展示 helper 统一投影；读屏仍保留完整维度名
  - calendar 当前已经删掉英文眉题，统一为短句反馈，并补齐键盘焦点、读屏名称、loading/error inline 语义
  - 日视图不做时间轴，也不内联正文编辑
