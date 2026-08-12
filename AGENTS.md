# Happiness-system-codex AGENTS

## 1. 项目定位

这是一个把“幸福日志”理论翻译成 AI 访谈产品的仓库。

当前代码与生产修复状态以 `2026-08-12` 快照为准；生成式访谈产品决策状态已同步至 `2026-08-06`；网页端访谈与日记高保真收口状态同步至 `2026-08-12`：
- 已有 `joy / fulfillment / reflection / improvement / gratitude` 五个维度的通用访谈壳子。
- `joy / fulfillment / reflection / improvement / gratitude` 是当前已经完成理论对齐深化的标品维度。
- `improvement` 已完成理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完成标准执行、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- `gratitude` 已完成理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完成标准执行、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- 五个维度的 stitched 多事件日志现在都共用“完整 stitched brief 不截断”的 supporting-scene 约束：`eventWindow` 只裁剪事件列表与消息窗口，不再重建缩水版 `draftBrief`；AI prompt、质检和 fallback 都会继续保留窗口外 supporting moments，避免 `refresh_minor` 静默丢掉后续来源事件。
- 五个维度的 `thinkingSummary`、日志正文、日志标题和 `joy` 质量门现在都共用一层服务端语义解释层：系统会先判断当前片段在维度理论里属于什么主题、为什么成立，再把这层解释投影到 summary、`DraftBrief`、短标题和 draft 质检；这层内部解释不能直接写进用户可见正文或 fallback draft。`joy` 质量门现在接受语义等价的改写，但会拒绝“更像轻快乐 / 关键不是深意义 / 象征意义 / 确定性”这类内部理论腔和抽象收尾。
- `fulfillment` 质量门现在接受“没白费 / 终于落了地 / 总算收住了”这类自然换述，不再因为没有命中少数固定理论词就把有效 AI 草稿静默打回 fallback；`gratitude` 的 stitched supporting-scene loose anchor 也重新收紧，不会因为共用几个壳子短语就误放行被改写的副事件。
- 五个维度的日志标题已经统一经过语义短标题治理，后端不再把长事件句机械截断成标题。
- `joy` 标题治理会拦截 `一下被带轻 / 象征意义` 这类伪中文或理论词标题；早起、多出时间、准备感这类轻快乐场景应落到 `清醒地开始` 这类自然短标题。
- 管理员数据分析工作台已经落地：管理员用户会在 `/settings` 看到 `/admin/analytics` 入口；页面当前按“总览 -> 候选用户 -> 单人证据”三层推进，支持 `review / monitor` 两种视角、时间范围切换、候选用户筛查与内容级下钻。
- 管理员分析权限当前由 `ADMIN_USERNAMES` 控制；非管理员访问页面时走 `notFound()`，管理员接口走 `requireAdminRequest()`。
- 仓库当前已新增 `AnalyticsEvent` 与 `AdminAuditLog` 两张表：`AnalyticsEvent` 承接注册、登录、进入私有页、访谈推进、日志生成/保存、完整日志生成/保存、评分保存等埋点；`AdminAuditLog` 记录管理员查看会话 / 日志正文的审计日志。
- AI 质量数据飞轮已经覆盖生成 Trace、Prompt 血缘、规则评分与抽样 Judge、访谈/日志赞踩标签和文本、Badcase 聚类、System Prompt / Few-shot / Engineering 候选、去重、真实对话证据、回放验证、全量发布、回滚和七天效果观察；管理员入口为 `/admin/ai-quality`。
- System Prompt 与 Few-shot 候选只有在管理员批准且最近一次 `AIOptimizationValidation` 通过后才能发布；`AIPromptRelease.validationId` 绑定发布采用的验证记录，线上 Trace 分别用 `+opt:{candidateId}` 与 `+fs:{fingerprint}` 归因。
- 管理员拒绝 AI 质量候选时必须提供 `4–300` 字的 `reviewReason`；缺少通过验证时发布接口返回 `409 OPTIMIZATION_VALIDATION_REQUIRED`。
- AI 质量改进当前默认参与，注册与登录会写入或校准质量政策版本和合规时间；兼容退出请求返回 `409 AI_QUALITY_PARTICIPATION_REQUIRED`，前端设置页不提供退出开关。
- `npm run acceptance:ai-quality:seed` 默认只允许本地数据库；远程隔离测试库需要显式设置 `ALLOW_REMOTE_AI_QUALITY_ACCEPTANCE_SEED=I_UNDERSTAND`，production 环境会主动终止。`2026-07-20` 已清理共享生产库中的固定验收账号、Trace、反馈、候选与运行记录，生产数据继续只承载真实用户链路。
- 当前唯一生产主域名是 `https://dailylight.chat`；`dlight.cc.cd` 已于 `2026-07-20` 从 Vercel production aliases 中移除并正式废弃，后续部署、验收、回调和文档入口统一使用 `dailylight.chat`。
- 当前产品与事件中心候选的聊天 Provider 事实源为 DeepSeek 官方 API：运行时使用 `openai` 兼容适配器，默认地址为 `https://api.deepseek.com`；共享五维聊天模型由 `DEEPSEEK_MODEL` 提供。通用事件中心环境变量继续以 `deepseek-v4-flash` 作为兼容默认值，GI-088 v8r1 与 v8r2 私有评测候选使用独立的 `deepseek-v4-pro` 运行策略。Ark 适配器及 `VOLCENGINE_ARK_*` 变量只保留历史兼容代码；旧 Ark 探针和账务错误只作为历史证据。guarded `GET /api/debug/runtime-env` 支持返回 `ai` 诊断块和 `?probe=1` 的最小 provider 探针，但 production 默认保持关闭，只在短时验证窗口中临时打开。
- 生成式访谈事件中心已具备事件级会话、可靠提交、失败恢复、Trace、事件日志生成编辑保存重开和发布隔离底座。历史策略继续保留代码兼容与回归资产；当前产品范围、提问策略和验收状态统一以 `docs/generative-interview-refactor-map.md` 及其当前专项为准，兼容代码不直接代表当前产品结论。
- 事件中心知识治理固定区分三层：明确确认或验证的内容进入当前事实，未定性的内容保留“待讨论 / 待校准”，失效候选和失败结果保留为历史证据。自动技术通过不能替代真人体验裁决，历史候选不能承担当前发布授权。
- 事件中心发布模式为 `legacy / optional / event_centered / event_recovery`；Production 继续保持 `legacy + baseline`，`optional + generative` 只作为板块 8 内部 Preview 与人工授权目标。
- `2026-08-06` 已冻结 `GI-075～080`，板块 5 六类规则完成 `6/6`，产品决策已冻结，事件中心落地验证尚未启动。`GI-075、GI-076、GI-078` 为中置信度，`GI-077、GI-079、GI-080` 为高置信度；`GI-067 / GI-068～074` 继续保持“已冻结·高置信度”。
- 阶段 1～2 继续按 GI-075 以新的用户回答机会计数，阶段 3 继续无数字上限。问题修复由模型基于完整语境重新判断下一步，不建立语义分类路由或修复专属次数上限；原始对话持续保留，被用户否定的状态退出当前事实和日志。回复版本退出事件中心目标 MVP，Production legacy 现有换问法能力继续保留。中断与失败恢复继承结构化错误、`requestId`、原话保存和同一 `clientTurnId` 恢复。
- `2026-08-11` 已确认网页端前端方向：每条【帮我记】或【陪我聊】记录完成后形成当天时间线事件卡片；用户在日记页一键生成、查看或更新唯一的今日日记。访谈页只承接表达、回应、保存与返回当天，不展示日志生成或更新行为。详见 `docs/plans/2026-08-11-daily-light-journal-page-frontend-handoff.md`。这项方向用于设计师原型与后续网页端开发；模型、评测、Preview 与 Production 保持原有边界。方法 `v1.0` 已冻结；下一板块为板块 6 正式评测资产建设，板块 7 等待板块 6，板块 8 使用两模式 `4＋2` 完成真人验收。GI-068 的新记录显式选择、记录内保持和新记录重新选择继续生效。当前状态源为 `docs/generative-interview-refactor-map.md`，板块 5 详细事实源为 `05-board5-stability-user-control-and-interaction-scope.md`，冻结评测交接见 `04x-07-evaluation-preview-and-handoff.md`。
- `2026-08-12` 旧 UI 高保真候选曾完成收口并部署独立 Preview：无会话进入事件中心时先展示当天工作台空状态，点击【帮我记】或【陪我聊】后才创建记录；三阶段进度和“原话已保存”进入顶部导航上下文；理解与提问共用 dailylight.chat 访谈气泡；AI 回复保留赞踩与三项重新生成菜单；`/calendar?view=day|week|month&date=` 统一使用归档侧栏与报告画布骨架。该 deployment `dpl_8yNo4LoHehdowfuCtsdm4BU3w417` 只作为历史工程证据；当前新前端继续构建并等待产品验收，Production `https://dailylight.chat` 保持当前版本。
- 今日日记已新增 `JournalDailyEntry / Revision / Generation` 数据结构及 `20260810180000_add_journal_daily_generation_system` migration；正式读、生成、自动暂存和保存接口为 `/api/journal/day` 与 `/api/journal/daily*`。它与旧五维整合链路使用的 `DailyJournalEntry` 分层保存。
- 周报与月报已新增 `JournalPeriodReport / Revision / Generation` 数据结构及 `20260811100000_add_journal_period_reports` migration；读、生成、自动暂存和保存接口为 `/api/journal/period*`。周报优先已保存日报，月报优先已保存周报，来源签名、版本冲突、幂等和需更新保护继续生效。
- `DAILY_LIGHT_JOURNAL_PREVIEW_ENABLED=I_UNDERSTAND` 只用于本地固定六案例零模型回放；远程 UI Preview 和 Production 均走真实数据库链路，`.vercelignore` 排除私有评测页面、接口和脚本。
- `2026-08-06` 板块 5 完成态同步只更新产品文档；公共 API、类型、代码、配置、Prompt、数据库和运行开关保持原样。
- 事件中心已接入 `generationTraceId`、现有反馈链路和十类观测事件（九类漏斗事件加响应完成耗时事件）；日志接口复用现有事件日志表和来源快照，当前无需新增数据库迁移。
- production 共享库此前缺少 `20260521120000_add_admin_analytics_tables` migration，导致 live `POST /api/auth/register` 在写 `AnalyticsEvent` 时失败；该 migration 已于 `2026-05-25` 在 production 补齐。
- 用户表达“不想继续 / 不要再追问 / 直接生成 / 总结日志 / 整理成日志 / 追问没有意义”等边界或日志整理意图时，边界优先级高于槽位完整度。
- 历史 `choiceKind` assistant turn 在刷新 / 恢复后仍保留在 transcript 中；但只要当前正在显示 inline choice card，聊天记录里会先隐藏所有 choice turn，避免和卡片重复。只有当 live choice card 消失后，且某条历史 choice 最终停在 transcript 末尾时，它才会继续可见。
- 访谈提交错误已经结构化，`respond/stream` 与 `respond` 会返回带 `code / title / message / resolution / retryable / action / requestId` 的 `issue`，前端展示原因、解决方案、错误码和 requestId。
- 访谈回复当前采用“用户原话先持久化、AI 结果后完成”的两阶段提交：前端用 `sessionStorage` 保存输入草稿和待发 outbox，服务端用 `InterviewUserTurn` 保存 `clientTurnId / rawText / baseMessageSequence / status / attemptCount`；SSE `turn` 确认服务端已接收原话，失败或取消后 session hydrate 返回 `pendingUserTurn`，用户可点击“继续生成”用同一 `clientTurnId` 调用 `resume_turn`。
- 访谈意图识别 v1 已完成全量发布：系统把“生成日志、停止追问、修正问题、跳过、切换片段、切换维度”和用户内容分开判断。`INTERVIEW_INTENT_V2_MODE` 支持 `legacy / shadow / enforce` 三档；Production与Preview当前均使用`enforce`，`legacy`保留为P0即时回退档位。
- `20260720210000_add_interview_intent_assessment` migration 为 `InterviewUserTurn` 增加意图评估、决策、分类器版本与评估时间字段。意图评估属于内部运行记录，SSE 和 session hydrate 继续只暴露用户恢复所需字段。
- `20260720120000_add_interview_user_turn` migration 新增 `InterviewUserTurn`、相关枚举与 `InterviewMessage.userTurnId`。具体测试数量属于候选验证快照，统一记录在当前 Handoff、专项文档与候选证据中；项目级长期规则只要求类型检查、相关专项、全量测试、构建、Prisma 校验和差异检查按风险通过。
- `2026-07-21` 已完成“按意图重新生成”正式发布与线上验收：新会话可对正式追问选择简单、具体、换角度、深入或轻一点，也可纠正理解；每组回复最多三个版本，历史换问法通过活动分支保留原路径。加载状态只在目标回复气泡内呈现，操作区保留静态禁用入口。
- `2026-07-21` 已完成访谈意图识别全量发布：`INT-EVAL-252`内容边界已修正，Production切换到`enforce`，当前production deployment为`dpl_3CrHUAqd4MtrMc5PTSsNitrwB4Nr`，主域名为`https://dailylight.chat`；上一正式版本`dpl_7jpZCQTZukzFY8XMVD6wcsQScxrc`保留为即时回退入口。
- `20260720153000_add_ai_optimization_review_reason` migration 为 `AIOptimizationCandidate` 新增 `reviewReason`，用于保留管理员拒绝候选的理由。
- `/admin/ai-quality` 已完成生产工作台：首屏按待审核、待验证、待发布、观察中和历史记录分流；队列以“维度 · 具体问题”命名，右侧连续承接证据、方案、回复对照、验证和决策。影响服务用标准化后的具体 `issueKey` 计算“同一问题率”；未知问题各自保留标准化键，缺少问题码时页面显示“口径不足”。管理员时间统一固定为 `Asia/Shanghai`，避免服务端与浏览器水合文本不一致。
- `2026-07-20` 已完成 UserTurn 可靠提交改造的 production 发布：两条 migration 均已应用，PR #36（`ce1e2afbefe98eb79a21faf3d02869fe377085f4`）已合并进 main，公开 smoke 和同 `clientTurnId` 重放校验通过。
- `InterviewSession` 现在有显式 `entryDate`，日志归属日期不再默认等于 `startedAt`。
- 普通 `/interview` 入口现在默认代表当前日期的新记录入口：本地按维度缓存的 session 和当前页面已经挂载的 live session，都只有在 `entryDate` 等于运行时日期时才会被自动恢复；显式带 `entryDate` 的 deep link 仍只会恢复同一天的 session。访谈页正文区会显示“当前记录日期：YYYY-MM-DD”，避免用户误把旧日期会话当成当前日期记录。
- `reflection` 在 `continue_current_event` 场景里新增了防回卷约束：如果上一轮已经问过“具体经历 / 对话”，且用户明确回答没有，继续深聊时不能再追同一字段，而要改问更低压的具体锚点，比如某个顾虑、画面、比较时刻或选择瞬间；服务层会在最终落库前和流式输出前同时兜底，避免重复问题先漏给前端。
- 访谈 repair 协议已收紧：当用户明确表示“看不懂 / 太抽象 / 换一个 / 说简单点”时，服务端会识别 `question_repair`，并对当前问题走纯服务端确定性重问，不再请求模型；repair 轮不会抽取 snapshot、不会增加 `turnCount`、不会推进 `roundMeaningfulReplyCount`、不会触发新的 `event_complete`。`reflection` 维度现在优先按 `event_anchor / prior_assumption / reaction_evidence / insight_evidence / judgment_clue` 的强约束模板重问；如果上一轮已经命中过“没有具体经历 / 对话”的 guard，repair 不能回到 scene question，而会自动落到“具体顾虑 / 画面 / 念头”类低压锚点。连续第 `3` 次 repair 会直接进入低压 choice，不再继续换问法。
- 记录日历的 month/week/day 主链已落地：calendar 展示层读模型、calendar 聚合器、calendar repository、calendar service、`/api/calendar/day|week|month`、`/calendar` 月视图、周视图、日视图，以及回到 `/interview` 的 deep link 都已完成。日视图现在是某一天五维记录的统一阅读与分发入口。
- calendar / 当天整合日志 / 月分析的按天查询现在统一走 `Asia/Shanghai` 的整天时间窗口，不再用单个归一化时间点做精确匹配；同一天任意时刻保存的维度日志都会归到正确 `entryDate`。
- 当天整合日志已落地：`DailyJournalEntry` 独立承载日级成果物。桌面端从右侧「今日日志」面板底部的 `生成日志 / 更新日志 / 查看日志` 进入，移动端从对话区顶部的【完整日志】快捷按钮进入；生成或更新会基于当前 `entryDate` 已保存的维度日志整理章节、直接保存并打开当天日志工作区。完整日志工作区离开前会保存未自动暂存的编辑；从完整日志切回访谈或切换访谈维度时，会保留 700ms autosave 触发前的输入。
- 当天整合日志的来源集合现在会随着同日新增 `saved` 维度日志、来源维度日志更新时间变化或来源不再是 `saved` 进入 `stale`；来源签名按“同一天每个维度最新一篇 `saved` 日志”计算，重新生成后章节集合会与当天真实 `saved` 维度重新对齐。
- `SiteHeader` 现在是全宽暖色工具栏，中区承接 calendar 的 `month / week / day` 切换、前后翻段、回到今天和实时摘要；访谈维度条、calendar toolbar 和主导航都直接平铺，不再额外套内层方框；主导航当前页用贴近文字的暖棕实线下划线表达，选中项字号略大；访谈和 calendar 业务控制组用 `｜` 分隔。主导航不再包含【首页】项，点击左侧【Daily Light】品牌标识可返回首页。
- 访谈页通过 header 主导航切换到日历、分析、画像、设置或首页时直接完成路由切换；刷新或关闭访谈页面时继续由 `beforeunload` 保存会话恢复标记并提供浏览器离开保护。
- 带 `entryDate` 的访谈页里，header 当前选中维度会优先显示 live session 的实时轮次和进度圈；其余维度，以及切到当天整合日志工作区后的胶囊状态，继续以 `/api/calendar/day` 的 day snapshot 为准。只要某个维度当天已经有 `saved` 日志，胶囊会优先显示 `已完成`，即使同一天还有继续中的 session。
- opening-only 空会话（只有 opening assistant、`turnCount = 0` 且没有用户回复）不再把 header 当前维度、calendar 当天状态或相关统计点亮成“进行中”；这类空开场 session 仍会保留在库里，但不会继续污染当天状态。
- 如果当前 active choice 是 `boundary_insufficient` 或 `dimension_redirect`，header 当前选中维度的 live progress 会被压在 `88%` 以下，不再被历史 `draftGenerationUnlocked` 顶回 `90% ready`。
- 首页当前是品牌广告页，主线为“在日常里照见自己 -> 回顾一天显露纹理 -> 五维认识自己 -> 日有所记，心有所归”；文案和图片位集中在 `src/content/homepage.ts`，图片按 section 配置，当前已接入 `public/homepage/*` 本地图片，图片区统一采用“单行标题 + 图片本体”的去卡片化布局，首页木纹背景改为上浅下深。
- `/analysis?month=YYYY-MM&section=trends|dimensions` 记录分析页当前是量化趋势与五维记录两段纵向 scroll + 顶部锚点切换；可选 `preset=week|month|custom` 与 `start/end` 控制量化趋势周期。`SiteHeader` 中区承接周期 preset、日期范围、两段 tab 和 contextual chip。`量化趋势` 走 `GET /api/analysis/range`，展示周期摘要、总分柱线图、只读日志天数色块、8 要素雷达/棒棒糖；`五维记录` 走 `GET /api/analysis/month`。旧 `overview|score|rhythm` 归一到 `trends`，旧 `insights|correlation|review` 归一到 `dimensions`。幸福 8 要素评分录入在 `/interview` 的「当天评分」工作区。
- analysis 的 `narrative-service.ts` 当前仍是确定性占位文本，不是最终 AI 叙事；五维段仍保留模板叙事与证据链接。
- 全站前端壳层已经切到平铺工作台：根布局不再给页面额外包外距，首页、访谈、设置和 calendar 主体减少大圆角外框、重复模块间隙和卡片嵌套。
- `2026-06-12` 起全站执行「单层卡片制」设计规范（`docs/design/ui-conventions.md`）：每页最多“1 个底板 + 1 层卡片”，卡片内禁再嵌套 border+bg 容器，分区用标题 / hairline 分隔线 / 留白；圆角三档 `12/20/28px`（`--radius-control / --radius-card / --radius-shell`）、边框两档 `--line-soft / --line-strong`，新代码禁手写 `border-[rgba(...)]` 等任意值。共享原语在 `src/components/ui/`（`Surface / Card / SectionHeading / Divider / ActionButton`）。分析页两段工作区、日历周/日视图、设置全家桶和管理员页面均已按此重构；访谈页与日历月视图保持各自的目标形态。
- `2026-07-18` 起共享交互原语统一采用即时按下反馈与可打断运动：按钮约 `0.97`、大卡片约 `0.985`；`SlidingSegmentedControl` 使用无回弹 spring；`HorizontalPager` 可选 swipe，采用约 `10px` 原始位移判定、速度投影和边界阻尼；画像与分析启用 swipe。移动端 `SiteHeader` 上下文工具栏可横向滚动，日志书页使用底部 sheet 并支持拖动关闭；`ActionMenu` 与 `ConfirmDialog` 补齐方向键、焦点圈定与焦点恢复。全局响应 reduced motion、reduced transparency 和增强对比度偏好。
- calendar 页面当前优先首屏工作区；桌面超量信息进入局部 pane 滚动，小屏月视图改为“月历主体在上 + 当天检查面板在下”的纵向工作台，不再依赖 `1040px` 横向滚动访问右侧面板。桌面月视图仍是“月历主体 + 当天检查面板”的双栏骨架，右侧提供 `查看当天` 日期级入口。
- `SiteHeader` 现在会把真实 header 高度同步到 `--site-header-viewport-offset`；calendar / analysis / settings 这类首屏工作区会按“实际 header 高度之后的剩余视口”计算可用高度，不再假设顶部永远只有 `4rem`，因此小屏、多行 toolbar 或 header 换行时不会再因为 offset 写死而出现底部假留白或双滚动。
- 访谈维度选择页的 `CalendarMainGate` 内容层会纵向伸展到可用视口，保证页面底部背景连续；相关修复已在生产部署中生效。
- 月视图月格当前固定渲染 6 行 42 格，loading skeleton 也渲染同样的 42 格，保证加载前后高度一致。
- 月视图当前已经切到“已保存结果优先”的可见语义：`1-4` 个已保存维度显示单字 `悦 / 实 / 思 / 改 / 谢`，五维都至少保存过一次时收束为 `已完成`；`进行中 / 混合状态` 不再作为月格里的可见文字标签。
- 月视图当天检查面板当前显示 `待继续 / 已完成 / 完整日志` 三个 summary chip；`待继续` 按 `activeCount + draftCount` 投影，`完整日志` 显示 `未生成 / 可汇总 / 草稿 / 已保存 / 需更新`。过去空白日只显示轻空态，不再列出 5 个空维度；月查询失败时不会再把主区或右侧伪装成空白日，而是保留月历主体 + 当天检查的 split-pane 方框骨架，在左右 pane 内分别显示错误说明和重试动作。
- future 空白日继续改成中性待到来语义，不再按漏记处理；today 圆点也已回到日期锚点附近，避免与右上角状态区冲突。
- 周视图已经升级为真正的 7 天同屏对比板；每天卡片的主动作会优先直达 `继续访谈 / 继续编辑 / 查看日志`，无可直达动作时才回退 `查看当天`；其中 `继续访谈` 固定回活动会话，`继续编辑` 固定回草稿会话，`查看日志` 固定打开已保存日志对应会话。
- 日视图已经升级为五维紧凑操作台；`mixed` 主动作在前端固定按 `继续访谈 -> 继续编辑 -> 查看日志 -> 开始记录` 解析，`编辑日志` 只保留为已保存维度的次级轻链接。
- month / week / day 三个视图当前共用独立 calendar 视觉系统：状态五态、单字维度 badge `悦 / 实 / 思 / 改 / 谢`、badge / surface / marker class 和主次按钮层级都由前端展示 helper 统一投影；读屏仍暴露完整维度名 `开心 / 充实 / 思考 / 改进 / 感谢`。
- calendar 文案当前已经切到工作台短句语气；英文眉题已移除，`aria-busy`、loading/error inline state、focus-visible 和主要 CTA 的可访问名称已补齐。
- calendar 已接入当天整合日志轻量状态：月/周只显示轻 marker，日视图显示紧凑入口条，正文编辑仍回到访谈页。

用户当前在产品里感知到的主线是：
1. 进入某个维度的访谈页。
2. AI 通过结构化访谈逐步推进。
3. 用户在合适时机点击“生成日志”。
4. 右侧只展示日志正文初稿，不展示结构化槽位。
5. 用户可继续编辑并保存正式日志。
6. 用户可通过今日日志面板的日级按钮进入当天日志主区，查看、编辑并保存当天整合日志；移动端提供【完整日志】快捷按钮。

## 2. 文档优先级

讨论或优化访谈链路时，先读取 `docs/interview-product-optimization-map.md`，用其中的模块边界、依赖关系和当前讨论位置保持跨会话目标一致。

讨论生成式访谈板块 5～8 时，固定按以下顺序读取：

1. `AGENTS.md`
2. `docs/interview-product-optimization-map.md`
3. `docs/generative-interview-refactor-map.md`
4. `docs/technical/interview-event-centered/00-generative-interview-ai-product-working-method.md`
5. 当前板块专项文档
6. 当前专项明确链接的上游冻结档案、实现事实或历史证据

`docs/generative-interview-refactor-map.md` 是生成式访谈板块 1～8 的唯一状态与决策索引；方法论文档规定板块怎样推进，当前专项承载详细讨论、案例和交接。方法论已经完成 `v0.1` 的板块 4 回溯检查、板块 6～8 纸面交接和板块 5 首题真实试运行，产品负责人已于 `2026-08-06` 确认并冻结 `v1.0`。

### 新会话文件发现入口

新的 AI 或协作者需要查找当前工作时，固定按以下入口导航，避免依赖旧会话记忆或遍历全部历史文件：

1. [`docs/README.md`](./docs/README.md)：五分钟项目导航、常见任务与稳定搜索词；
2. [`docs/plans/2026-08-11-daily-light-journal-page-frontend-handoff.md`](./docs/plans/2026-08-11-daily-light-journal-page-frontend-handoff.md)：网页端“访谈 → 事件卡片 → 今日日记”设计师与开发交接；
3. [`docs/generative-interview-refactor-map.md`](./docs/generative-interview-refactor-map.md)：生成式访谈唯一当前状态与决策索引；
4. 总 Map 当前链接的专项文档：当前板块 6 使用 `04j-generative-quality-evaluation-v1.md`；
5. [`artifacts/README.md`](./artifacts/README.md)：正式评测资产、历史证据和本地过程文件入口；
6. [`artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md`](./artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)：GI-088 v8r2 当前证据包与后续真人验收入口。P0／P1、最终初始化幂等、全绿静态门与不可变版本已收口；Preview 已 `READY`，全新 Thinking high run 停在 `0/12`、`gate=pending`、模型调用 `0`，等待产品负责人完成 12 项真人验收；
7. [`docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md`](./docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md)：v8r2 已完成的实施范围、合同与停止条件。v8r1 A1 误停聊事故及其历史只读 run 继续从 `artifacts/README.md` 进入。

当前检索关键词：`GI-088`、`GI-087`、`板块 6`、`board6-calibration`、`board7b-working-task-v1`、`legacy + baseline`。GI-081、GI-083、GI-084 开发失败血缘、GI-085／086 No-Go、历史 `GI-066`、旧 Board 7/8 与 Batch B 候选统一从 `artifacts/README.md` 进入，并保持各自的诊断或历史证据身份。

阅读顺序用于建立完整上下文；文档冲突按事实职责裁决。优先级如下：

1. 用户本轮最新指令
2. 本文件 `AGENTS.md`
3. `docs/generative-interview-refactor-map.md`（生成式访谈板块 1～8 的产品事实、决策状态、依赖与当前推进位置）
4. 总 Map 当前链接的上游冻结决策档案（对应决策的最终结论、范围、依据与案例）
5. 当前板块专项文档（当前开放问题、详细规则、证据与交接；保持上游冻结结论关闭）
6. `docs/technical/interview-event-centered/00-generative-interview-ai-product-working-method.md`（板块 5～8 的工作方式，不覆盖产品事实）
7. `docs/interview-product-optimization-map.md`（访谈链路全产品模块、依赖关系与衡量边界）
8. `docs/interview-intent-evaluation-source-of-truth.md`（访谈意图评测、数据集与上线门槛）
9. `README.md`
10. `docs/architecture.md`
11. `docs/integration-guide.md`
12. `docs/operator-runbook.md`
13. `docs/theory/joy-alignment.md`
14. `docs/theory/fulfillment-alignment.md`
15. `docs/theory/reflection-alignment.md`
16. `docs/theory/improvement-alignment.md`
17. `docs/theory/gratitude-alignment.md`
18. `docs/theory/dimension-draft-template.md`
19. `Tech_Design.md`（仅保留历史设计背景，不再是实时事实源）

协作语言：
- 默认用中文输出，除非用户明确要求使用其他语言，或需要保留代码、命令、错误信息、API 字段等原文。
- 如果是 review / code review / 审查结果，必须先把 findings、严重级别、文件位置和结论翻译成中文再输出；除非用户明确要求保留英文原文。必要时可在中文后附英文原文，但默认先给中文版本。

表达约束：
- 严禁使用通过先否定前者再突出后者的对举句式来制造强调效果，例如“不是……而是……”“与其……不如……”这类表达；默认改写为直接陈述核心判断、并列展开差异，或按因果/递进关系表达。
- 只把事实源已经确认、用户明确提出或已经完成清晰定义的概念写成当前事实。模型自行提出的概念必须标记为“讨论候选”，并在首次出现时说明定义、来源、适用范围、使用者、触发条件、实际作用和当前状态；缺少这些信息时，直接描述具体事实。严禁把未定义的角色、机制、层级、信号、状态或流程写成既有产品内容。
- 引用产品结论时，明确区分“已冻结事实、用户本轮选择、模型建议、待验证假设、历史证据”。自动技术通过、历史候选和外部方法不能替代当前产品结论或真人发布授权。

### 生成式访谈板块 5～8 产品讨论规则

- MVP 优先冻结跨场景核心原则、用户结果和最小必要硬边界；长尾表达、低频细节和实现枚举留给评测、后续迭代或对应下游板块。
- 每次只讨论一个会实质影响产品行为或下游交接的关键选择；先用具体用户场景说明背景、纠正原因、目标、风险和不同方案的实际影响，再引入内部概念和选项。
- 提问前先检查上游冻结事实、当前专项和已经验证的现有能力。事实源能够唯一推出的客观边界直接继承并说明依据，不重复提交产品选择。
- 在 Plan 模式中，需要产品负责人选择的关键问题必须使用选项卡，提供 `2～3` 个互斥选项并保留自由输入；推荐项同时说明原因和取舍。当前协作模式缺少选项卡能力时，保持结论开放并提示产品负责人进入 Plan 模式后选择。
- 只有会改变用户结果、模型自主权、程序硬边界或下游交接的问题才提交产品选择；表达是否清晰、具体含义和自然承接等完整语境判断直接交给模型。
- 每项候选结论形成前，检查产品负责人、模型、程序、自动评测与 Judge、真人 Preview 分别承担什么；职责缺少定义时继续保持待讨论。
- 模型负责完整语境下的焦点、认识增量、下一问价值、回答负担和自然表达判断；程序负责模式保持、问题计数、单轮一问、来源、安全、事件隔离、用户控制和失败恢复；评测与真人 Preview 提供质量证据；产品负责人确认冻结和发布。
- 完整语境能够支持模型判断时，不把语义拆成表达分类、置信度分支、场景路由、固定模板或逐案例程序规则。
- 候选规则按四类归档：跨场景原则进入产品协议或后续 Prompt／Skill，可确定执行的客观边界进入程序保护，长尾表达或单个案例进入评测集，证据不足的判断保留为待验证假设。单个案例只有在涉及严重风险时才能直接形成硬边界。
- 具体案例用于讲清背景、检验原则和形成评测资产；案例本身不自动形成程序分支。被后续选择覆盖的候选保留为讨论历史，不进入当前事实。
- `GI-068～080` 保持关闭。板块 6～8 的新讨论只承接已冻结输入；发现新证据时按总 Map 的“重新打开”流程处理。

### `/neat` 项目级同步规则

本项目使用 `/neat`（neat-freak）进行阶段性知识整理。整理不要求项目全部完成，可以在产品决策冻结、工程实现完成、Preview 裁决或板块切换后执行。

每次调用 `/neat` 时，默认遵守以下边界：

- 只有用户明确确认、冻结或已经验证的内容，才写入“当前有效事实”或长期项目规则。
- 尚未定性的方案、假设、讨论中的判断和待补证据，保留为“待讨论”“待校准”或“验证中”，不得升格为最终产品结论。
- 已失效的候选、失败案例、No-Go 裁决和历史工程证据继续保留，并明确标记为历史；当前状态与历史记录分开表达。
- Map、专项文档和项目说明中的当前板块、当前候选、依赖关系、下一步与 Production 状态保持一致。
- 事件中心的产品讨论必须保留决策编号、状态、置信度、适用范围、依据、影响板块和候选血缘，避免把讨论草案写成冻结决策。
- 全局或项目级长期说明只写稳定事实；单次会话上下文、临时猜测和尚未确认的产品偏好留在对应专项文档或会话记录中。
- Production 当前保持 `legacy + baseline`。任何生产切换、部署或生产数据写入都必须等待产品负责人单独授权。
- 发现无法自动判断的文档冲突、结论归属或状态变化时，先列出冲突与影响，等待产品负责人裁决。
- 完成整理后，报告实际修改的文件、每项修改原因、保留的历史证据、未处理事项和当前下一步。

调用 `/neat` 时，可以在本条消息中补充本阶段的范围，例如“只同步 GI-067 已冻结内容”“先做只读审计，暂不修改”或“保留 GI-066 全部历史证据”。本节规则作为本项目的默认安全边界。

子 agent / 本地 provider 熔断约定：
- 本地 provider 出现 `503 Service Unavailable`、`所有供应商已熔断`、`无可用渠道` 等错误时，优先视为可恢复的本地调度波动。
- 已明确交给子 agent 的独立任务，不因一次熔断就轻易收回主线执行；主线应保留上下文用于调度、集成、验证和关键决策。
- 处理顺序：记录失败原因 -> 等待短时间或继续其他不冲突工作 -> 重试同一子任务；只有连续多次失败、任务变成关键阻塞，或用户明确要求主线接管时，主线才接回执行。
- 重试时继续保持子任务边界清晰，要求子 agent 汇报变更文件、验证命令和阻塞点；不要让子 agent 重写全局计划。

理论原文路径：
- `docs/theory/精简-如何实现幸福.pdf`

joy 理论翻译基线：
- `docs/theory/joy-alignment.md`

fulfillment 理论翻译基线：
- `docs/theory/fulfillment-alignment.md`

reflection 理论翻译基线：
- `docs/theory/reflection-alignment.md`

improvement 理论翻译基线：
- `docs/theory/improvement-alignment.md`

gratitude 理论翻译基线：
- `docs/theory/gratitude-alignment.md`

维度正文生成模板：
- `docs/theory/dimension-draft-template.md`

## 3. 当前产品事实

### 3.1 维度与产品成熟度

- `joy`
  - 已有 joy 专属槽位：`joyMoment / joySource / stateShift / meaningNeed / manualClue / delightSignature`
  - 已有可选槽位：`directionSignal / valueImpact / durability / tags`
  - `joy` 现在有双收尾路径：
    - `meaning_track -> manualClue`
    - `delight_track -> delightSignature`
  - `delight_track` 的 `delightSignature` 必须是可直接写进日志的自然中文线索；不能再用长度兜底放行，也不能接受 `象征意义 / 确定性 / 动作本身` 这类抽象短语，或 `清醒 / 从容 / 有准备` 这类单纯状态词。
  - 如果 `joyMoment / joySource / stateShift|meaningNeed` 已经成立，且用户明确表示不想继续提炼规律，也允许生成“当前版本日志”。
  - 如果用户拒绝继续但材料不足，会停止继续追问细节，进入低压选择而不是继续补槽位式追问。
  - 连续找不到可信开心片段时，会触发建议转去 `improvement` 的分叉。
  - `2026-04-29` 已完成 joy 的正文成稿规格、写作控制层、prompt / quality gate / fallback 联动，并补上 `delight_track / meaning_track` 的双轨完成规则。
  - `joy` 现在也是维度正文生成模板的第一份标准样板。
- `fulfillment`
  - 已完成 fulfillment 理论对齐深化，产品目标固定为“今天为什么不算白过”。
  - 核心槽位：`experience / progressEvidence / valueSignal`
  - 辅助槽位：`feeling / fulfillmentType / tags`
  - `valueSignal` 的用户语义统一叫“值得感标准”。
  - `fulfillmentType` 当前按三类收束：
    - `推进完成型`
    - `投入积累型`
    - `协作贡献型`
  - 完整模式需要 `experience + progressEvidence + valueSignal`。
  - 如果用户明确拒绝继续深挖，且 `experience + progressEvidence` 已成立，允许生成 partial 当前版本日志，但不能硬写值得感标准。
  - 如果只有 `experience` 但还没有可信 `progressEvidence`，且用户拒绝继续追问，进入“只补一句 / 换一个片段 / 先退出”的低压选择。
  - 已完成 fulfillment 的抽取 schema、fallback 抽取、提问策略、进度规则、正文成稿规格、prompt / quality gate / fallback 联动。
- `reflection`
  - 已完成 reflection 理论对齐深化，产品目标固定为“从今天片段里看见新的判断依据”。
  - 核心槽位：`trigger / insight / viewpointShift`
  - 辅助槽位：`feeling / reflectionType / tags`
  - `reflectionType` 当前按三类收束：
    - `规律发现型`
    - `方向优势型`
    - `判断校准型`
  - 完整模式需要 `trigger + insight + viewpointShift`。
  - 如果用户明确拒绝继续深挖，且 `trigger + insight` 已成立，允许生成 partial 当前版本日志，但不能硬写稳定判断线索。
  - 如果没有具体触发片段或新理解，且用户拒绝继续追问，进入“只补一句 / 换一个片段 / 先退出”的低压选择。
  - 如果用户已经明确说“没有某段具体经历 / 对话”，但又点击了 `继续深聊`，系统不能再重复追同一字段；会改问更低压的具体锚点，把外部事件层降压到内部但可描述的选择顾虑、脑中画面或判断瞬间。
  - 已完成 reflection 的抽取 schema、fallback 抽取、提问策略、进度规则、正文成稿规格、prompt / quality gate / fallback 联动。
- `improvement`
  - 已完成理论对齐开发规格：`docs/theory/improvement-alignment.md`
  - 已扩展结构化 `snapshotData/payload`：
    - `situation`
    - `improvementTrack`
    - `stateAssessment`
    - `frictionPoint`
    - `repeatCondition`
    - `controllableFactor`
    - `nextAttempt`
    - `successSignal`
    - `improvementType / feeling / tags`
  - 已新增专属 AI 抽取 schema：`improvementExtractResultSchema`
  - `getExtractResultSchema("improvement")` 已走 improvement 专属分支。
  - 抽取规则已经约束：不把全局自责抽成 `frictionPoint`，`nextAttempt` 必须是具体动作，`controllableFactor` 必须是用户可调整的小块，`repeat_good` 在用户说清原因时抽 `repeatCondition`，`avoid_bad` 在用户说清原因时抽 `frictionPoint`；如果用户只分清改进轨道，允许先保留 `improvementTrack`，把 `repeatCondition / frictionPoint` 留给下一轮追问。
  - 已完成 fallback 抽取、阶段推进、专属提问策略和完整 / partial 收束：
    - `collect_event` 抓具体情境
    - `probe_reason` 判断 `repeat_good / avoid_bad` 并问清 `repeatCondition / frictionPoint`
    - `probe_pattern` 收可控点和具体下次尝试
    - `wrap_up` 交给用户生成日志选择
  - 提问策略已固化为“具体情境 -> 改进轨道 -> 关键条件/卡点 -> 可控小调整 -> 下次最小动作/成功信号”，并避免“你应该怎么做 / 制定一个计划 / 你为什么会这样 / 以后一定要”这类建议、计划和归责口吻。
  - 完整模式需要 `situation + improvementTrack + stateAssessment + frictionPoint|repeatCondition + controllableFactor + nextAttempt`。
  - partial 模式需要 `situation + frictionPoint|repeatCondition`，且用户明确不想继续或自然语言要求整理日志。
  - 材料不足且用户拒绝继续时，沿用 `boundary_insufficient` 和“只补一句 / 换一个片段 / 先退出”。
  - 已完成正文生成、写作控制层、AI draft prompt、质量门、fallback draft、标题治理和第 8 阶段自动化验收样例。
  - 标题治理优先收束为 `表达慢下来 / 先听完再回应 / 把节奏放稳 / 提前留出缓冲 / 把边界说清楚 / 让准备更充分` 这类语义短标题，不能回退到长事件句截断或 `改进日志 / 下一次尝试 / 我要变得更好`。
  - 尚未完成端到端产品验收，文风仍可继续打磨。
- `gratitude`
  - 已完成理论对齐开发规格：`docs/theory/gratitude-alignment.md`
  - 产品目标固定为“看见谁回应了我的需要，以及什么样的关系回应值得珍惜”。
  - 已扩展结构化 `snapshotData/payload`：
    - `gratitudeMoment`
    - `gratitudeTarget`
    - `kindAction`
    - `seenNeed`
    - `innerEffect`
    - `gratitudeReason`
    - `gratitudeType`
    - `relationshipSignal`
    - `reciprocityHint`
  - `gratitudeType` 当前按五类收束：
    - `支持回应型`
    - `理解体谅型`
    - `陪伴接住型`
    - `照顾减负型`
    - `信任机会型`
  - 完整模式需要 `gratitudeMoment + kindAction + seenNeed + gratitudeReason + relationshipSignal`。
  - partial 模式需要 `gratitudeMoment + kindAction + seenNeed|gratitudeReason`，且用户明确不想继续或自然语言要求整理日志。
  - 已接入专属 AI 抽取 schema、fallback 抽取、阶段推进、专属提问策略和完整 / partial 收束。
  - 提问策略已固化为“具体被照顾/支持的时刻 -> 对方做了什么 -> 哪个需要被看见 -> 为什么珍惜 -> 关系信号/回应方式”，并避免感谢信模板、道德负债、强行回馈任务和泛泛正能量。
  - 已完成正文生成、写作控制层、AI draft prompt、质量门、fallback draft、标题治理和自动化验收样例。
  - `gratitude` 的 `stitched_moments` supporting-scene 质量门现在先走严格锚点，再只接受仍保留明确照顾动作和足够场景锚点的自然压缩；像“请我吃冰淇淋，还问要不要喝水”写成“请我吃冰，还问我渴不渴”仍可通过，但“后来她想吃冰，我陪她去买了”这种语义反转会继续触发 `missing_supporting_scene_anchor`。
  - 标题治理优先收束为 `被稳稳接住 / 被认真理解 / 那句及时提醒 / 有人帮我理清 / 被信任的机会` 这类语义短标题，不能回退到长事件句截断或 `感谢日志 / 谢谢你 / 今天很感恩`。

### 3.2 用户可见与系统内部的边界

必须保持这个边界：
- 用户只看对话和日志正文。
- 对话中的 `thinkingSummary` 是浅色思路层，用来呈现 AI 对用户回复的理解和处理焦点；五个维度都会通过 `summary` SSE delta 流式展示这层内容，且不能写成第二个正式追问。
- 如果模型给出的 `thinkingSummary` 只是复述用户原话、语气不对或写成第二个追问，服务端会基于同一层维度语义解释重写它，而不是直接把浅复述透传给前端。
- 访谈提交失败时，用户可以看到结构化错误说明和处理建议，但不能看到内部异常堆栈、数据库细节或原始 provider 错误。
- `snapshotData`、结构化槽位、进度判断、`pendingDecision` 都属于系统内部状态。
- 右侧日志面板当前不再显示“日志”标题，只保留关闭按钮与正文编辑区。
- 日志工作区不再向用户展示“结构化线索”卡片。
- 标题输入仍是用户可编辑的正文标题，但后端生成 draft 时会统一产出不超过 `16` 字的总结型短标题。

### 3.3 日志工作区当前行为

- 第一次生成日志时：
  - 工作区会进入阶段式生成状态：overlay / 内嵌卡片展示维度个性化标题、骨架流光占位和三阶段副文案（骨架 → 细节 → 润色），进度条采用约 `10s` 匀速爬升到 `88%`、超时慢蠕动到 `96%`、草稿到达后补满 `100%` 的诚实节奏。
  - 如果用户在整理过程中直接关闭日志面板，当前这次整理会被取消，不会继续后台占用 choice 卡状态。
- 已有 AI 直出 draft，且用户还没有手动改稿时：
  - 新的访谈消息不会自动触发日志整理；日志生成只由用户手动点击触发。
  - 如果当前草稿已经落后于最新访谈内容，顶部“生成日志”按钮仍保持可点击，由用户决定何时刷新。
  - 如果当前草稿已经覆盖到最新访谈状态，再次点击“生成日志”只会直接复用当前草稿，不会重复发起生成请求。
- 如果当前稿件已经被用户手动编辑：
  - 系统不会再自动刷新，避免静默覆盖用户修改。
- 如果用户打开的是一篇已经 `saved` 的维度日志：
  - 标题或正文一旦通过 `PUT /api/journal-entry/[id]` 自动暂存，会先回到 `draft`
  - 只有用户再次点击“保存修改”，这篇日志才会重新成为正式保存版本
- 如果用户从单维度日志书页切到今日日志面板的日级动作或移动端【完整日志】快捷入口：
  - 前端必须先复用日志面板关闭路径，保存未暂存编辑或取消正在生成的 draft，再切换主工作区。
- 如果用户从完整日志主区返回访谈，或在完整日志主区切换访谈维度：
  - 前端必须先 flush 当天日志的 pending 编辑；保存失败或内容非法时留在完整日志主区并展示错误。
  - 维度变化且 URL 不再携带 `mode=daily-journal` 时，主工作区必须回到 `interview`，不能让新维度访谈隐藏在完整日志工作区后面。
- 如果用户打开的是一篇已经 `saved` 的当天整合日志：
  - 重新生成或正文编辑都会先回到 `draft`
  - 只有再次点击“保存修改”，这篇当天日志才会重新成为正式保存版本
- 访谈页顶部现在还有一个开发辅助按钮：
  - `清除对话记录`
  - 只作用于当前维度
  - 会清本地恢复记录、终止当前前端请求，并强制新开一轮会话
  - 不新增后端“删除会话”接口，也不要求删库

### 3.4 用户边界与低压收束

- `assessUserTurnMessage` 会识别 `content / low_signal / boundary_stop / hostile_boundary`。
- 命中 `boundary_stop` 或 `hostile_boundary` 时，服务层会先处理边界，不再继续抽取和生成追问。
- 材料足够时：
  - `joy` 已有核心材料，`fulfillment` 已有 `experience + progressEvidence`，`reflection` 已有 `trigger + insight`，`improvement` 已有 `situation + frictionPoint|repeatCondition`，或 `gratitude` 已有 `gratitudeMoment + kindAction + seenNeed|gratitudeReason`，会直接进入 `event_complete + user_override_partial`。
  - “总结日志 / 总结成日志 / 整理成日志 / 帮我总结 / 帮我整理 / 生成一下日志”等自然语言整理请求也按同一条边界收束处理，不会继续抽取或追问。
- 材料不足时：
  - 进入 `boundary_insufficient`
  - actions 固定为 `continue_current_event / next_event / pause_session`
  - 前端文案固定收束为“我不再继续追问细节了”
  - 三个按钮分别是“只补一句 / 换一个片段 / 先退出”
- `pause_session` 复用现有 `POST /api/interview/session/pause`，不新增数据库字段或外部 URL。

## 4. 代码结构

### 4.1 目录职责

- `src/app`
  - 页面与 API 入口。
- `src/components`
  - 纯 UI 组件。
- `src/components/ui`
  - 单层卡片与交互共享原语：`Surface`、`Card`、`SectionHeading`、`Divider`、`ActionButton`、`SlidingSegmentedControl`、`HorizontalPager`、`ActionMenu`、`ConfirmDialog`；新页面优先扩展原语后复用。
- `src/features/interview`
  - 多维度通用前端定义、schema、进度与维度元信息。
- `src/features/interview/event-centered`
  - 事件中心对话状态、历史四角度与 `thought_only` 兼容策略、生成协议、发布模式和专项评测资产。当前产品策略以总 Map 和当前专项为准。
- `src/features/calendar`
  - 纯展示层记录读模型：`CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord`
  - 以及 `day / week / month` 聚合器、header toolbar 投影 helper、月/周视图展示 helper、future/past 空白语义 helper 与 deep link/action helper。
- `src/features/analysis`
  - 记录分析的 `month=YYYY-MM`、`section=trends|dimensions`、`preset=week|month|custom` 与 `start/end` URL 归一化；旧 `overview|score|rhythm` 映射到 `trends`，旧 `insights|correlation|review` 映射到 `dimensions`；`date-range.ts` 推导周期窗口；`aggregate-trends-range.ts` 与 `GET /api/analysis/range` 服务量化趋势读数台；`GET /api/analysis/month` 服务五维记录；`generateMonthNarrative` 保留占位叙事。
- `src/content`
  - 首页文案、CTA 和图片位配置；当前首页配置在 `homepage.ts`。
- `src/features/happiness-score`
  - 幸福 8 要素日评分的数据类型、`1-10` zod schema、保存请求 schema 与评分 key 定义。
- `src/features/daily-journal`
  - 当天整合日志 schema、正文长度约束和 source signature helper。
- `src/features/ai-feedback`
  - 访谈与日志的赞踩标签、提交约束和当前质量政策版本。
- `src/features/ai-quality`
  - 评分量表、Judge schema、候选策略、Prompt 清单、管理员证据读模型和七天影响结论规则。
- `src/components/calendar`
  - `calendar-toolbar.tsx` 负责 `SiteHeader` 中区的 calendar 控制条与摘要展示。
  - month / week / day shell 当前都已经进入工作区壳层；month 桌面是双栏检查面板、小屏是上下堆叠工作台，week 是 7 天对比板，day 是五维紧凑操作台。
- `src/components/analysis`
  - 记录分析页壳：`analysis-shell.tsx` 只挂载 `analysis-trends-section` 与 `analysis-insights-section` 两段，并由 `use-analysis-section-spy` 更新当前锚点；`analysis-toolbar.tsx` 在 `SiteHeader` 中区渲染周期 preset、日期范围、两段 tab 与 contextual chip。`analysis-correlation-section.tsx`、`analysis-review-section.tsx` 等历史占位文件当前未被 shell 引用。
- `src/features/joy-interview`
  - joy-first 的 prompt、引擎、schema 与服务端逻辑。
  - 当前也承载 fulfillment / reflection / improvement / gratitude 的理论对齐分支。
- `src/server/services/interview`
  - 当前对外暴露的访谈 service 层。
  - 现实情况：`interview.service.ts` 目前主要是 re-export `joy-interview.service.ts`。
  - `respond-error.ts` 负责把访谈提交错误归一化为用户可展示的 `issue`。
- `src/server/services/interview/event-centered-interview.service.ts`
  - 事件中心问答、候选生成编排、语义 checkpoint、Trace、恢复和兼容降级能力。当前候选是否允许降级由冻结产品规则与发布档位共同决定。
- `src/server/services/interview/journal-event-entry.service.ts`
  - 事件日志来源快照、AI 草稿、来源质量门、安全基础版本、自动暂存和正式保存。
- `src/server/services/interview/event-centered-analytics.service.ts`
  - 事件中心入口、响应完成、检查点、生成、保存、降级和放弃的十类 AnalyticsEvent。
- `src/server/services/calendar`
  - 记录日历的 `day / week / month` 服务端查询入口。
- `src/server/services/daily-journal`
  - 当天整合日志 source 收集、AI 轻整理、fallback 章节合集、草稿更新与正式保存。
- `src/server/services/auth`
  - `admin-access.ts`：管理员白名单解析、页面鉴权和接口鉴权。
- `src/server/services/admin-analytics`
  - 管理员分析工作台的总览、候选用户、单人详情和内容级下钻服务。
- `src/server/services/ai-quality`
  - Trace 评估、用户反馈、Badcase 聚类、候选验证、Prompt/Few-shot 发布、效果统计和真实证据服务。
- `src/server/services/memory`
  - `memory-extraction.service.ts`：访谈结束后从会话数据中 AI 提取用户模式，去重后存入 MemoryFact，生成向量嵌入；fire-and-forget，失败静默。
  - `memory-retrieval.service.ts`：访谈问题生成时，从用户历史记忆中语义检索相关条目（pgvector 余弦相似度 Top-K），注入 AI prompt；embedding 不可用时降级为按维度 + confidence 排序。
  - `profile.service.ts`：画像 CRUD，支持手动添加（sourceType: user_added, confidence: 1.0）、编辑摘要/标签、软删除。
- `src/server/services/portrait`
  - `portrait-data.service.ts`：画像数据聚合，并行查询 MemoryFact、日历、分析、幸福分四个数据源。
  - `portrait-synthesis.service.ts`：AI 合成画像，生成跨维度总述 + 五维度洞察，缓存到 PortraitSnapshot。
- `src/features/portrait/prompts`
  - `portrait-synthesis.prompts.ts`：画像 AI 合成的 prompt builder（总述 + 分维度洞察）。
- `src/server/repositories`
  - 会话、事件、日志、payload 映射与数据库读写。
  - `calendar.repository.ts` 把 `InterviewSession / JoyEntry` 标准化成 calendar source。
  - `daily-journal.repository.ts` 维护 `DailyJournalEntry` 和当天已保存维度日志 source。
  - `ai-quality.repository.ts / ai-evaluation.repository.ts / ai-feedback.repository.ts / ai-optimization.repository.ts / ai-quality-impact.repository.ts` 维护 AI 质量血缘、反馈、评估、候选、验证、发布与效果数据。
  - `memory.repository.ts` 维护 `MemoryFact` 的 CRUD、文本去重（关键词重叠率 > 0.6）和向量操作。
- `prisma`
  - 数据模型与迁移。

### 4.2 重要架构现实

- `InterviewSession.stage` 和 `InterviewEvent.stage` 仍复用 `JoyInterviewStage` 枚举名：
  - `collect_event / probe_reason / probe_pattern / wrap_up / finalize`
  - 这已经在多维度框架中通用了，但命名还带有 joy 历史痕迹。
- 后端主服务仍是 joy-first 架构：
  - 多维度已经有通用 wrapper 和类型分发。
  - 但维度实现还没有拆成真正独立的通用引擎；fulfillment / reflection / improvement / gratitude 当前是在 joy-first 壳子内完成理论分支。

## 5. 数据模型要点

当前数据库重点看这几类：
- `InterviewSession`
  - 维度、状态、当前阶段、当前事件、最终日志引用。
  - `entryDate` 是日志归属日期真相；`startedAt` 只表示会话创建时间。
- `InterviewEvent`
  - 事件级状态、轮次、覆盖镜头、`snapshotData`、`progressData`。
- `InterviewMessage`
  - 全部可恢复对话消息；正式追问的 `responseGroupId / responseVersion` 维护版本组，`regenerationIntent / regeneratedFromMessageId / branchSessionId` 保留来源与路径。
- `InterviewUserTurn`
  - 用户回复与选择动作的可恢复提交记录；同一会话内 `clientTurnId` 唯一。
  - 保存原话、提交时的消息位置、处理状态、尝试次数与错误码；`processing / failed / canceled` 会进入 session 的 `pendingUserTurn`。
  - `intentAssessment / intentDecision / intentClassifierVersion / intentAssessedAt` 保存可回放的意图判断；仅在 `enforce` 模式参与正式决策。
- `InterviewBranchCheckpoint / AIResponseRegeneration`
  - 前者保存正式追问处的可恢复会话状态；后者记录重新生成的原问题、候选、意图、Trace、耗时、状态与采用结果。
- `InterviewSession`
  - 新会话写入 `conversationSchemaVersion = 2`；根会话用 `activeBranchSessionId` 指向当前采用路径，分支通过 `rootSessionId / parentSessionId / forkMessageSequence` 继承此前对话。
- `JoyInterviewSnapshot`
  - 历史兼容快照表，仍保留旧 joy 结构投影。
- `JoyEntry`
  - 日志标题、正文、legacy 字段、`payload`、`eventBlocks`、保存状态。
- `DailyJournalEntry`
  - 日级整合日志，`userId + date` 唯一，记录 `draft / saved`、正文、来源维度日志 ids、session ids、source signature 和 stale 判断所需时间。
- `DailyHappinessScore`
  - 幸福 8 要素日评分，`userId + date` 唯一，8 项分数均为 `1..10` 整数；当前通过 `/interview` 顶部「当天评分」进入独立评分工作区录入，API 允许保存所有非未来日期。
- `AnalyticsEvent`
  - 管理员分析埋点表，`dedupeKey` 唯一；用于漏斗、质量和候选用户筛查。
- `AdminAuditLog`
  - 管理员内容查看审计表，记录管理员查看会话 / 维度日志 / 完整日志正文的行为。
- `MemoryFact`
  - 长期记忆摘要，当前功能由 `memoryEnabled` 设置项控制，默认关闭。
  - 已支持 pgvector 向量嵌入（`embedding vector(2048)`）、AI 提取、语义检索与画像页面 `/profile`。
  - `topicTags / sourceType / confidence / evidenceSessionIds / deletedAt` 等扩展字段已随 `feature/memory-vector-extension` 合并进 main。
- `PortraitSnapshot`
  - 画像合成缓存，存储 AI 从多数据源合成的跨维度总述和分维度洞察。
  - 每次重新合成清除旧记录，只保留最新一条。
  - 字段：`summary`（总述）、`dimensionInsights`（JSON，五维度洞察）、`factCount`、`generatedAt`。
- `AIRequestLog`
  - `transcribe / extract / generate / question / evaluate / iterate / portrait_synthesis` 调用日志。
- 事件中心日志复用现有 `JournalEventEntry`、`InterviewSession`、`InterviewEvent`、`AIGenerationTrace` 与 `AnalyticsEvent`；本轮没有新增数据库表或迁移，事件日志生成、编辑、保存和恢复通过事件中心专用 API 完成。
- `AIGenerationTrace / AIFeedback / AIFeedbackRevision / AIEvaluation / AICase`
  - AI 生成血缘、当前用户反馈、反馈修订、结构化评分和案例分类。
- `AIOptimizationRun / AIBadcaseCluster / AIOptimizationCandidate / AIOptimizationValidation / AIFewShotExample / AIPromptRelease`
  - AI 质量运行、聚类、候选、回放验证、动态示例和线上发布版本；候选的 `reviewReason` 保存管理员拒绝理由。

关键事实：
- 新的多维度结构主要落在 `snapshotData` 和 `payload` 里。
- 新增的 `boundary_insufficient` 只存在于 `InterviewEvent.progressData` 到 API response 的映射中，不需要 DB migration。
- legacy 列仍保留，用于兼容旧代码与旧数据投影。
- `entryDate` / `date` 的日期范围查询当前统一按 `Asia/Shanghai` 整天窗口执行：`gte dayStartUtc`、`lt nextDayStartUtc`。
- 用户提交恢复链路依赖 `prisma/migrations/20260720120000_add_interview_user_turn/migration.sql`；本地和共享数据库必须与 `prisma/schema.prisma` 同步。

## 6. API 面与调用语义

当前主要接口：
- `POST /api/interview/session/start`
- `GET /api/interview/session/[id]`
- `POST /api/interview/session/respond`
- `POST /api/interview/session/respond/stream`
- `POST /api/interview/session/branch/preview`
- `POST /api/interview/session/branch/select`
- `POST /api/interview/session/pause`
- `POST /api/interview/session/complete`
- `POST /api/interview/session/reopen`
- `POST /api/interview/session/draft/generate`
- `POST /api/interview/session/draft/save`
- `POST /api/interview/event-centered/session/start`
- `GET /api/interview/event-centered/session/[id]`
- `POST /api/interview/event-centered/session/respond/stream`
- `POST /api/interview/event-centered/session/turn`
- `POST /api/interview/event-centered/journal/generate`
- `GET/PATCH /api/interview/event-centered/journal/[id]`
- `POST /api/interview/event-centered/journal/[id]/save`
- `PUT /api/journal-entry/[id]`
- `PUT /api/joy-entry/[id]`（兼容别名）
- `GET /api/daily-journal?date=YYYY-MM-DD`
- `POST /api/daily-journal/generate`
- `PUT /api/daily-journal/[id]`
- `POST /api/daily-journal/[id]/save`
- `POST /api/transcribe`
- `GET /api/calendar/day?date=YYYY-MM-DD`
- `GET /api/calendar/week?date=YYYY-MM-DD`
- `GET /api/calendar/month?month=YYYY-MM`
- `GET /api/analysis/month?month=YYYY-MM`
- `GET /api/analysis/range?preset=week|month|custom&month=YYYY-MM&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `PUT /api/happiness-score`
- `GET /api/profile` — 获取全部画像（分维度分组）
- `POST /api/profile` — 手动添加画像条目（sourceType: user_added, confidence: 1.0）
- `PATCH /api/profile` — 更新画像条目（编辑摘要、标签）
- `DELETE /api/profile?id=xxx` — 删除画像条目（软删除）
- `GET /api/profile/portrait` — 获取缓存的画像快照（PortraitSnapshot）
- `POST /api/profile/portrait` — 触发 AI 画像合成（需 ≥3 条 facts）
- `GET /api/admin/analytics/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/admin/analytics/funnel?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/admin/analytics/retention?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/admin/analytics/quality?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/admin/analytics/users?...`
- `GET /api/admin/analytics/users/[userId]`
- `GET /api/admin/analytics/sessions/[sessionId]`
- `GET /api/admin/analytics/entries/[entryId]`
- `GET /api/admin/analytics/daily-journals/[id]`
- `GET/PUT/DELETE /api/ai-feedback/[traceId]`
- `GET/PATCH /api/ai-feedback/consent`
- `GET /api/admin/ai-quality/candidates`
- `PATCH /api/admin/ai-quality/candidates/[candidateId]`
- `GET /api/admin/ai-quality/candidates/[candidateId]/evidence`
- `POST /api/admin/ai-quality/candidates/[candidateId]/validate`
- `GET /api/admin/ai-quality/candidates/[candidateId]/impact`
- `GET /api/admin/ai-quality/candidates/[candidateId]/impact/evidence`
- `POST /api/admin/ai-quality/runs`
- `GET /api/cron/ai-quality/evaluate`
- `GET /api/cron/ai-quality/iterate`

必须记住：
- 前端主链路使用的是 `respond/stream`，不是普通 `respond`。
- `POST /api/interview/session/start` 现在支持可选 `entryDate: YYYY-MM-DD`；session hydrate 也会返回 `entryDate`。
- `respond/stream` 的 SSE `error` 事件现在会带 `issue`；非流式 `respond` 错误 JSON 也带同一结构。
- `respond/stream` 会在 AI 处理前发送 SSE `turn`，确认用户原话已经进入服务端持久状态；成功完成后再发送 `session`。
- 普通回复请求优先使用 `rawText + clientTurnId + baseMessageSequence`；兼容旧客户端的 `userMessage`。失败或取消的提交使用 `action: resume_turn` 和原 `clientTurnId` 恢复。
- 换问法使用 `action: regenerate_question`，提交 `targetMessageId / intent / clientTurnId / baseMessageSequence / baseBranchSessionId`；纠正理解使用 `action: correct_understanding` 与 `rawText`。SSE `version` 事件返回当前版本与活动分支；分支 preview 只读，select 才切换活动路径。
- `INTERVIEW_REGENERATION_ENABLED=false` 可暂停新换问法与版本入口；版本 2 会话继续沿当前活动路径完成，已有分支、Trace 和质量记录保留。
- 意图识别字段属于服务端内部记录，不加入 `turn` SSE 事件或公开 session 读模型。`shadow` 只记录新旧决策对照，`enforce` 才让新决策参与访谈推进。
- `respond/stream` 当前会在服务端累计 provider 候选输出，完成问题协议、重复保护、维度专项检查和 fallback 后，再分块发送最终摘要与问题；分块过程保持最终文本的空格和换行。
- `/admin/analytics` 当前是管理员工作台，不向普通用户暴露；筛查和下钻主要通过 URL 查询参数驱动页面重新取数。
- `draft/generate` 当前只支持单个 `sessionId`，虽然 schema 接受数组。
- `transcribe` 现在还是占位 stub，不是真实语音转写。
- calendar 当前已经有公开只读能力：
  - `getCalendarDay`
  - `getCalendarWeek`
  - `getCalendarMonth`
  - `GET /api/calendar/day|week|month`
  - `GET /api/analysis/month?month=YYYY-MM`
  - `GET /api/daily-journal?date=YYYY-MM-DD`
  - `POST /api/daily-journal/generate`
  - `PUT /api/daily-journal/[id]`
  - `POST /api/daily-journal/[id]/save`
  - `/calendar?view=month|week|day&date=YYYY-MM-DD`
  - `SiteHeader` 中区会基于当前 `view/date` 独立请求 month / week / day 数据，用于标题和实时摘要
  - month / week / day 正文已经去掉重复导航，页面优先首屏工作区
  - 周视图当前是 7 天同屏对比板，主动作优先直达业务链路
  - 日视图按五维紧凑操作台组织，不展示内部槽位、不做时间轴、不内联正文编辑
  - 当天整合日志状态会进入 day/week/month 读模型，但 calendar 不内联编辑正文
  - `/interview?dimension=joy&entryDate=YYYY-MM-DD&mode=daily-journal` 只打开当天日志主区，不会 bootstrap 或创建新的 joy 访谈 session；点击“回到访谈”会先保存当天日志 pending 编辑，再移除 `mode=daily-journal`，让 `/interview?dimension=joy&entryDate=YYYY-MM-DD` 正常 hydrate 或创建对应日期访谈
  - 未来日期允许查询，但不允许通过 calendar API 暴露 `start_interview / continue_interview`
- analysis 当前已经有公开只读能力：
  - `GET /api/analysis/month?month=YYYY-MM` — 五维全景等按月聚合；返回 `month / logOverview / dailyCoverage / rhythmOverview / dimensionBreakdown / dimensions / insightsOverview / scoreOverview / scoreTrend / scoreRecords / editableDates / narrative` 等
  - `GET /api/analysis/range?preset=week|month|custom&startDate=&endDate=` — 量化趋势读数台；返回 `AnalysisTrendsRangeRecord`（`preset / startDate / endDate / logOverview / dailyCoverage / scoreOverview / scoreTrend`）
  - 只统计 `saved` 维度日志和 `saved` 当天整合日志；`stale` 整合日志在 read model 中仍按待更新处理
- 页面当前为量化趋势与五维记录两段纵向 scroll + 顶部锚点切换：`section=trends|dimensions`；旧 `overview|score|rhythm` 映射到 `trends`，旧 `insights|correlation|review` 映射到 `dimensions`；`SiteHeader` 中区 `AnalysisToolbar` 渲染周期 preset、日期范围、两段 tab 与 contextual chip，scroll spy 更新 URL
  - 缺失 `section` 时默认 `trends`；`preset` 缺省为 `month`
  - 量化趋势段只读，无评分录入与补漏 CTA；幸福 8 要素评分录入在 `/interview`「当天评分」工作区
  - `PUT /api/happiness-score` 允许保存所有非未来日期（Asia/Shanghai 口径）

## 7. 本地开发与排障

最常用命令：
- `npm run dev`
- `npm test`
- `npm run typecheck`
- `npx prisma db push`

开发服务器默认策略：
- 完成功能开发或修复后，默认确认 `npm run dev` 是否仍在运行。
- 如果 dev server 已经在运行，保持当前进程，不重复启动。
- 如果 dev server 未运行、已崩溃，或本次变更需要重启才能生效，默认启动 `npm run dev`。
- 交付回复里说明 dev server 状态和可访问地址。
- 纯文档修改不强制启动 dev server，除非用户明确要求。

高频问题：
- 如果启动访谈时报 `InterviewEvent.snapshotData does not exist` 或类似列缺失：
  - 先执行 `npx prisma db push`
  - 再重启 `npm run dev`
- 如果 `npm run build` 失败：
  - 先运行 `npm run typecheck` 和 `npm run lint`，区分 TypeScript、ESLint 与 Next.js 构建错误
  - `2026-08-02` 当前基线为 `npm run build` 通过并保留既有 ESLint warnings；新的非零退出码按首次错误位置排查
  - Prisma Client 缺失或 schema 版本不一致时，执行 `npx prisma generate` 并确认 migrations
- 如果用户看到结构化访谈提交错误：
  - `NETWORK_UNAVAILABLE`：先确认 `npm run dev` 仍在运行，再刷新页面
  - `MESSAGE_TOO_LONG`：单次回复超过 `1200` 字，拆成两段发送
  - `SESSION_NOT_FOUND`：刷新页面；仍失败则点击 `清除对话记录`
  - `SESSION_CHOICE_UNAVAILABLE`：分叉状态过期，刷新后按最新状态操作
  - `INTERVIEW_TURN_IN_PROGRESS`：同一会话已有回复正在处理，等待或刷新
  - `INTERVIEW_TURN_OUT_OF_DATE`：提交基于旧对话位置，刷新后重新发送
  - `INTERVIEW_TURN_RETRY_REQUIRED`：原话已保留，点击“继续生成”
  - `INTERVIEW_TURN_NOT_FOUND`：待恢复提交已失效，刷新后按最新对话继续
  - `INTERVIEW_DB_WRITE_FAILED` / `INTERVIEW_RESPONSE_SCHEMA_ERROR` / `INTERVIEW_RESPOND_FAILED`：看 dev server 日志里的 requestId 和堆栈
- 如果日志能生成但风格偏保守：
  - 优先检查 `src/features/joy-interview/prompts/joy-prompts.ts`
  - 再检查 `joy-interview-ai.service.ts` 的 fallback 文本
- 如果语音链路看起来“可用但质量很怪”：
  - 当前 `/api/transcribe` 是 stub，先按占位能力处理

## 8. 测试与交付要求

当前回归基线：
- `npm test`
- `npm run typecheck`

候选验证快照写入对应专项文档和 `docs/handoff.md`，避免把会持续变化的测试数量写成长期项目规则。默认交付门包括：

- 相关专项测试与全量 `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx prisma validate`，涉及迁移时再验证隔离库 `migrate status`
- `git diff --check`

每次开发或修复一个功能后，交付回复里必须给出至少一个可执行测试用例：
- 可以是已经自动化落地的测试名称与覆盖点
- 也可以是人工验收步骤
- 必须包含输入 / 操作、预期结果，以及必要时的失败判据

修改访谈或日志体验时，至少要覆盖：
- 访谈主链路
- 生成日志
- 重新生成已有日志
- 保存日志
- 页面刷新后的 session 恢复
- 用户边界表达后的 partial 收束或低压选择
- 标题不能退回长事件句截断

## 9. 当前已知缺口

这些是事实，不要误写成已完成：
- joy 日志正文已经比结构卡更自然，但仍需继续优化文风和产品完成度。
- fulfillment 日志正文已经完成理论对齐与质量门，但仍需继续优化文风和产品完成度。
- reflection 日志正文已经完成理论对齐与质量门，但仍需继续优化文风和产品完成度。
- `improvement` 已完成正文生成、质量门、fallback draft、标题治理和自动化验收样例，但还没有完成端到端产品验收。
- gratitude 日志正文已经完成理论对齐、质量门、fallback draft、标题治理和自动化验收样例，但仍需继续优化文风和产品完成度。
- `interview.service.ts` 仍是 joy-first 的导出壳子，不是真正抽象后的通用引擎。
- 语音转写仍未接入真实模型。
- 事件中心板块 4 已冻结 `GI-067 / GI-068～074`，板块 5 已冻结 `GI-075～080`，方法 v1.0 保持冻结。GI-087 保留为 GI-088 基础候选，v0～v8 继续承担历史证据。v8r1 的历史 run 只读保留：活动任务 A2、已完成轨迹 `1`、Provider 调用 `2` 且均为 `valid`；A1 控制误停使该 run 退出最终准入。v8r2 已收口意图控制、调用落账、快照绑定、人工证据治理、工作台恢复、八项 Preview 开门差额和主要零模型／真实评测库／历史兼容验证；最终行为 commit 为 `5281bc53f2b04be9c31adb6d7f4710ac818883a8`，Execution fingerprint 为 `96f1a022aede41b3648ecd60c4770bd66ea003b870ffcec85c9db2b0531cfd0c`。当前 Preview deployment `dpl_YRUQitffCQH264xiksHpLMviQZLy` 已 `READY`，两套 Prisma Client 由 Vercel Linux 远程构建，虚构账号登录已返回预期的 `401 INVALID_CREDENTIALS`，deployment error logs 为 `0`；全新 run `b816d468-e3c3-4459-a822-04f95b1e78cd` 回读为 `running / 0 of 12 / gate=pending / high_only / high / calls=0`，当前暂停等待 12 项真人验收。旧预发布 v8r2 run 已行政 `early_stopped`，其 `0/12`、零调用、零真人和质量未评测只作为排除记录。质量与发布未裁决。约 `200` 轮以上的容量优化继续留在本轮边界外；板块 7 正式接入与板块 8 继续等待；Production 使用 `legacy + baseline`。
- GI-088 只在私有 Preview 中开放：先通过 Vercel Deployment Protection，再通过 Daily Light 登录与 `ADMIN_USERNAMES ∩ GI088_EVALUATOR_USERNAMES`。应用登录和评测数据使用同一专属 Preview 物理库的 `gi088_app_preview` / `gi088_evaluation_v0` 两个 schema；完整环境、授权和排障契约见 `.env.preview.example`与 `docs/operator-runbook.md`。
- 记忆系统（`feature/memory-vector-extension`）已合并进 main，包含 pgvector 向量嵌入、AI 提取、语义检索和画像页面 `/profile`；当前由 `memoryEnabled` 设置项控制，默认关闭。`2026-08-02` 的全量类型检查与测试基线均已通过。

## 10. 修改文档时的规则

- 新事实优先更新 `README.md` 和 `docs/*`，不要只改本文件。
- 所有日期用绝对日期，例如 `2026-04-29`。
- 不要再把 `Tech_Design.md` 当成实时事实源。
- 如果产品交互发生变化，必须同步：
  - `README.md`
  - `docs/architecture.md`
  - `docs/integration-guide.md`
  - `docs/handoff.md`

## 11. ChatGPT × Codex 任务交接

本项目支持通过 `docs/ai-tasks/` 接收 ChatGPT 生成的本地执行方案。

- ChatGPT 负责读取项目背景、讨论方案并创建 `docs/ai-tasks/inbox/` 下的 Markdown 任务。
- 在项目目录打开 Codex 后，用户输入“执行最新 ChatGPT 方案”，Codex 读取最新 `ready` 任务并开始执行。
- Codex 使用可复用 Skill `chatgpt-plan-executor` 处理任务选取、状态流转、验证和结果回写。
- Codex 执行前先读取本文件和任务全文；任务状态按 `inbox -> running -> done|blocked` 推进。
- Codex 必须在结果文档中记录完成摘要、修改文件、验证命令、验证结果、风险和下一步建议。
- 任务方案与执行结果使用同一个 `task_id`，结果文件命名为 `<task_id>.result.md`。
- Codex 默认保留 Git 变更，不自动提交、推送或部署。
- 任务格式、目录状态和 ChatGPT 权限边界见 `docs/ai-tasks/README.md`。
