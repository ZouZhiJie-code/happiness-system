# Handoff

最后更新：`2026-05-05`

## 1. 当前阶段结论

项目已经从“只做 joy 的原型设计稿”进入“多维度通用壳子 + joy / fulfillment / reflection / improvement / gratitude 五个标品维度”的阶段。

当前最重要的现实：
- joy / fulfillment / reflection / improvement / gratitude 已完成理论对齐深化。
- improvement 已完成理论对齐开发规格、数据结构扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完成标准执行、正文生成、质量门、fallback draft、标题治理和自动化验收样例；仍需要端到端产品验收。
- gratitude 已完成理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完成标准执行、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- 五个维度的 stitched 多事件日志现在都恢复为“完整 stitched brief 不截断”的 supporting-scene 约束：`eventWindow` 只裁剪事件列表与消息窗口，不再重建缩水版 `draftBrief`；AI prompt、质检和 fallback 都会继续保留窗口外 supporting moments，避免 `refresh_minor` 静默丢掉后续来源事件。
- 五个维度的 `thinkingSummary`、日志正文、日志标题和 `joy` draft 质量门现在都共用一层服务端语义解释：系统会先判断当前片段在维度理论里属于什么主题、为什么成立，再把这层解释投影到 summary、`DraftBrief`、短标题和 draft 质检；`joy` 质量门现在接受语义等价改写，不再要求固定命中 `被接住 / 被理解 / 有分量` 这类字面词。
- `fulfillment` 质量门现在接受“没白费 / 终于落了地 / 总算收住了”这类自然换述，不再因为没有命中少数固定理论词就把有效 AI 草稿静默打回 fallback；`gratitude` stitched supporting-scene 的 loose anchor 也重新收紧，不会因为共用几个壳子短语就误放行被改写的副事件。
- 日志工作区对用户展示的是“日志正文”，结构化线索只保留在系统内部。
- 当天整合日志已经落地：访谈页顶部【完整日志】进入当天日志主区，基于当前 `entryDate` 已保存维度日志生成章节合集；单维度日志与完整日志加载/生成时都使用共享阶段进度、细进度轨和书页生长动效。完整日志工作区离开前会先保存未自动暂存的当天日志编辑；从完整日志切回访谈或切换访谈维度时，不会静默丢失 700ms autosave 触发前的输入，也不会让新维度被卡在完整日志工作区背后。
- calendar/day、当天整合日志和分析页的按天归档现在统一按 `Asia/Shanghai` 整天时间窗口查询，不再按单个归一化时间点精确匹配；同一天任意时刻保存的维度日志都会归到正确 `entryDate`。
- 带 `entryDate` 的访谈页里，header 当前选中维度会优先显示 live session 的实时轮次和进度圈；其余维度，以及切到当天整合日志工作区后的胶囊状态，继续以 day snapshot 为准。只要某个维度当天已有 `saved` 日志，胶囊会优先显示 `已完成`。
- 如果当前 active choice 是 `boundary_insufficient` 或 `dimension_redirect`，header 当前选中维度的 live progress 会被压在 `88%` 以下，不再被历史 `draftGenerationUnlocked` 顶回 ready。
- 全站前端壳层已经从居中大卡片改为平铺工作台：`SiteHeader` 是全宽暖色工具栏，首页、访谈、设置和 calendar 主体减少外框留白与卡片嵌套。主导航不再包含【首页】项，点击左侧【幸福系统】品牌标识可返回首页。
- 日志标题已经做五维统一语义短标题治理，后端不再用长事件句机械截断成标题。
- 用户边界和自然语言日志整理意图优先级高于槽位完整度；用户拒绝继续或输入“总结日志 / 整理成日志”等表达时，材料足够则 partial 收束，材料不足则给低压选择。
- 访谈提交失败已经结构化为 `issue`，用户能看到原因、解决方案、错误码和 requestId，不再只看到泛化“提交失败”。
- `respond/stream` 会原样透传 provider 原始 `delta.text`，不对任意流式增量单独 trim 或折叠空白，避免实时问题文本在 chunk 边界丢空格或吞掉换行。
- 历史 `choiceKind` assistant turn 在刷新 / 恢复后仍保留在 transcript 中；但只要当前正在显示 inline choice card，聊天记录里会先隐藏所有 choice turn，避免和卡片重复。只有 live choice card 消失后，且某条历史 choice 最终停在 transcript 末尾时，它才会继续可见。
- 普通 `/interview` 入口现在默认代表“今天的新记录入口”：本地按维度缓存的 session 和当前页面已经挂载的 live session，都只有在 `entryDate === 今天` 时才会被自动恢复；显式带 `entryDate` 的 deep link 仍只会恢复同一天的 session。访谈页正文区会显示“当前记录日期：YYYY-MM-DD”。

## 2. 截至 2026-05-03 已经落成的东西

### 产品与交互

- 首页品牌广告页：围绕“在日常里照见自己”组织 Hero、痛点、日志机制、五维入口和长期沉淀；文案与图片区配置由 `src/content/homepage.ts` 管理
- 多维度访谈导航与维度缓存
- 可恢复的访谈 session
- 访谈中的分叉选择：
  - 继续当前事件
  - 聊下一件事
  - 生成日志
  - joy 场景下建议跳到 `improvement`
- 右侧日志工作区
- 日志草稿生成、再生成、编辑、保存
- 当天整合日志主区：查询、生成、自动保存草稿、离开前 flush pending 编辑、正式保存
- 首页已重构为品牌广告页：Hero 主张为“在日常里照见自己”，中段讲“经历很多却少有读懂经历”和“回顾一天显露纹理”，五维段以 `悦 / 实 / 思 / 改 / 谢` 作为认识自己的五条入口，沉淀段收束为“日有所记，心有所归”；图片位按 section 配置，当前已接入 `public/homepage/*` 本地图片，Hero / 痛点 / 日志 / 沉淀图片区统一收成“单行标题 + 图片本体”的去卡片化布局，首页木纹背景改为上浅下深
- 五维统一语义短标题治理，标题不再由长事件句机械截断
- 用户边界低压收束：材料足够时 partial，材料不足时“只补一句 / 换一个片段 / 先退出”
- 开发态 `清除对话记录` 按钮：当前维度可一键重开新访谈
- 分析页「月度驾驶舱」改版（2026-05-04）：`SiteHeader` 中区的 `AnalysisToolbar` 独立获取月分析数据，渲染月份翻页和 4 个 section tab（总览/评分/节奏/五维），tab 带数据依赖的 contextual chip（评分待补状态、节奏待整合/待成文状态、主线维度名）；`overview` 总览首屏改为月度判断、评分可信度和“建议先看”主行动，评分 / 节奏 / 五维只作为轻入口，维度记录日、成果保存日、待整合日和评分可信度收到底部证据条；当前月评分保存成功后，toolbar chip 会立即刷新；`rhythm` 的节奏摘要当前收成底部 `4` 格 summary board；五维板块展示 topTags 高频线索 chips
- 分析页 `rhythm/score` 跟进（2026-05-04 晚）：`rhythm` 已切到状态优先热力工作台，`saved` 但来源签名失配的当天整合日志会在分析里按 `待更新 / 待整合` 处理，不再误标成 `已整合`；未来月份不会再被误算成整月 `最长空档`。评分区当前改成补录优先的双栏工作台：左侧先处理今天 / 昨天状态、填写进度和 8 项列表，右侧只编辑当前要素的 `1..10` 刻度，未填不再默认落在 `5` 分；今天和昨天都补齐后，首屏才回到趋势阅读。只有在至少 2 天评分且确实存在差异时，才显示 `长期偏高 / 最常掉下来 / 波动最大` 排名卡；样本不足或全项持平时只保留“仅供参考”的轻提示。未来月份的总览首屏不会再把用户送去今天的访谈，而会提示回到当前月份；`insights` 的 headline / watchpoint 和“评分低点还没写出来”卡片现在共用同一套 quiet lagging 维度排序，不会互相打架。
- 分析页 `insights` 跟进（2026-05-04 深夜）：`insights` 已从”主线维度 + 浮现/安静维度”改成”本月判断 + 五维全景 + 维度之间 + 下一步”；每个维度卡片都会显示自然语言主题句、代表片段、评分联动和 drill-down。`stale` 的当天整合日志现在会优先进入 `watchpoint`，即使当天已经没有任何 `saved` 来源，也不会从分析里消失；月初只出现一次的维度记录会保持 `starting`，不再被误写成”前面露过头”。
- 分析页叙事驱动升级（2026-05-05）：分析页从数据展示升级为叙事驱动的结构化报告。`AnalysisNarrative` 类型（`overviewNarrative / dimensionTheses / insightCards`）已落地，`narrative-service.ts` 提供确定性占位叙事生成（预留 AI 接入口，降级到模板文本）。`overview` 总览用 `SummaryHero` 替代统计卡 + `NarrativeInsightCard` 洞察卡片 + `OverviewAnchorCTA` 数据锚点；评分趋势高亮卡自动关联维度日志上下文（如「你在『改进』维度记录 8 天，常出现『睡眠』」），评分趋势图数据点可点击弹出 `ScorePointDetailCard` 当日日志详情卡；`rhythm` 选中日面板新增日志预览区（标题 + 前两行 + 日历日链接），tooltip 显示日志整合状态；`insights` 维度主题优先使用 `narrative.dimensionTheses`，证据区增加日历日链接。`dailyCoverage` 现在携带 `journalTitle` 和 `contentPreview`，`dailyJournal` 的 `title` 和 `content` 已在 repository 层暴露。
- 分析页叙事驱动补丁（2026-05-05）：`SummaryHero` 不再无条件优先使用 `narrative.overviewNarrative`。只有 narrative 足够表达当前状态时才覆盖模板文案；未来月份空态、待整合日、只有评分未成文、没有已保存日志这些场景会继续保留原有的状态判断和动作导向。`ScorePointDetailCard` 也已拆分“已有完整日志”“已有维度记录但未整合”“完全没生成日志”三种状态，避免把待整合日误报成空白日。`src/features/analysis/narrative-service.ts` 需要和 `analysis.service.ts` 一起提交，干净 checkout 才不会因为模块缺失构建失败。
- opening-only 会话状态补丁（2026-05-05）：只有 opening assistant、`turnCount = 0` 且没有用户回复的空会话，不再把 header 当前维度、calendar 当天状态或相关统计点亮成“进行中”；这类空开场 session 仍保留在库里，但不会继续污染当天状态。

### joy 理论对齐

- joy 不再只是“事件 + 原因”的复盘
- 已有 joy 专属结构：
  - `joyMoment`
  - `joySource`
  - `stateShift`
  - `meaningNeed`
  - `manualClue`
  - `delightSignature`
- joy 现在有双轨收尾：
  - `meaning_track -> manualClue`
  - `delight_track -> delightSignature`
- 如果用户明确拒绝继续提炼规律，也允许生成“当前版本日志”
- 如果用户直接说“总结日志 / 整理成日志 / 帮我总结”等，也按同一条 partial 收束处理，不继续追问
- 如果用户拒绝继续但核心材料不足，系统会停止追问细节，给低压选择
- 连续找不到可信 joy 片段时，系统会建议转到 `improvement`

### fulfillment 理论对齐

- fulfillment 的产品目标已收束为“今天为什么不算白过”
- 已有 fulfillment 专属结构：
  - `experience`
  - `progressEvidence`
  - `fulfillmentType`
  - `valueSignal`
- `valueSignal` 的用户语义固定为“值得感标准”
- 已支持三类充实来源：
  - `推进完成型`
  - `投入积累型`
  - `协作贡献型`
- 完整模式需要 `experience + progressEvidence + valueSignal`
- 如果用户明确拒绝继续提炼，且 `experience + progressEvidence` 已成立，也允许生成“当前版本日志”
- 如果只有 `experience` 但证据不足，且用户拒绝继续追问，系统会停止追问工作细节，给“只补一句 / 换一个片段 / 先退出”
- fulfillment 已接入专属 prompt、extract fallback、提问策略、draft brief、写作控制、quality gate 和 fallback draft

### reflection 理论对齐

- reflection 的产品目标已收束为“从今天片段里看见新的判断依据”
- 已有 reflection 专属结构：
  - `trigger`
  - `insight`
  - `reflectionType`
  - `viewpointShift`
- `reflectionType` 当前按三类收束：
  - `规律发现型`
  - `方向优势型`
  - `判断校准型`
- 完整模式需要 `trigger + insight + viewpointShift`
- 如果用户明确拒绝继续提炼，且 `trigger + insight` 已成立，也允许生成“当前版本日志”
- 如果没有具体触发片段或新理解，且用户拒绝继续追问，系统会停止硬追问，给“只补一句 / 换一个片段 / 先退出”
- 如果用户已经明确说没有某段具体经历 / 对话，但又点击了 `继续深聊`，系统不能回卷去追同一字段；会改问更低压的具体锚点，例如某个顾虑、画面、比较时刻或选择瞬间
- reflection 已接入专属 prompt、extract fallback、提问策略、draft brief、写作控制、quality gate 和 fallback draft

### improvement 理论对齐开发规格与已落地部分

- improvement 的产品目标已收束为“帮助用户把一次好/坏状态，整理成下次更容易重复好状态、避免坏状态的具体调整”
- 规格文档：`docs/theory/improvement-alignment.md`
- improvement 固定为双轨：
  - `repeat_good`：重复好状态
  - `avoid_bad`：避免坏状态
- 规格定义的核心结构：
  - `situation`
  - `improvementTrack`
  - `stateAssessment`
  - `frictionPoint`
  - `repeatCondition`
  - `controllableFactor`
  - `nextAttempt`
  - `successSignal`
- 完整模式需要 `situation + improvementTrack + stateAssessment + frictionPoint|repeatCondition + controllableFactor + nextAttempt`
- partial 模式需要 `situation + frictionPoint|repeatCondition`
- 已落地第 2 阶段：`snapshotData/payload` 已扩展到上述结构，继续复用 JSON 字段承载，不新增 DB migration
- 已落地第 3 阶段：新增 `improvementExtractResultSchema`，`getExtractResultSchema("improvement")` 走专属分支，抽取 prompt 会约束：
  - 不把“我很差 / 我不行”抽成 `frictionPoint`
  - `nextAttempt` 必须是具体动作
  - `controllableFactor` 必须是用户能调整的一小块
  - `repeat_good` 在用户说清原因时抽 `repeatCondition`；如果还只是分清轨道，允许先保留 track，下一轮继续问条件，不强行抽 `frictionPoint`
  - `avoid_bad` 在用户说清原因时抽 `frictionPoint`；如果还只是分清轨道，允许先保留 track，下一轮继续问卡点，不强行抽 `repeatCondition`
- 已落地第 4 阶段：`src/features/joy-interview/server/joy-interview-engine.ts` 有 improvement 专属 fallback 抽取、`getNextStage` 分支和 `buildAssistantQuestion` 分支；`joy-interview.service.ts` 已按完整 / partial 标准触发 choice。
- 已落地第 5 阶段：improvement 的开场、分轨、好状态/坏状态、可控点和收束问题已经固化；AI follow-up prompt 会避免“你应该怎么做 / 制定一个计划 / 你为什么会这样 / 以后一定要”这类建议、计划和归责口吻。
- 已落地第 6 阶段：improvement 已接入 `DraftBrief / DraftWritingProfile`、AI draft prompt、quality gate、fallback draft 和语义短标题治理。
- 已落地第 7 阶段：improvement 标题候选覆盖 `表达慢下来 / 先听完再回应 / 把节奏放稳 / 提前留出缓冲 / 把边界说清楚 / 让准备更充分`，并拦截长事件句截断和 `改进日志 / 下一次尝试 / 我要变得更好`。
- 已落地第 8 阶段：自动化测试覆盖 `avoid_bad` 抽取、`repeat_good` 抽取、track-only 中间态、partial 边界收束、fallback draft 标题和质量门。
- 尚未落地：端到端产品验收与文风继续打磨

### gratitude 理论对齐

- gratitude 的产品目标已收束为“看见谁回应了我的需要，以及什么样的关系回应值得珍惜”
- 规格文档：`docs/theory/gratitude-alignment.md`
- 已有 gratitude 专属结构：
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
- 完整模式需要 `gratitudeMoment + kindAction + seenNeed + gratitudeReason + relationshipSignal`
- partial 模式需要 `gratitudeMoment + kindAction + seenNeed|gratitudeReason`
- 已接入专属抽取 schema、fallback 抽取、阶段推进、提问策略、完整 / partial 收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例
- 标题候选优先收束为 `被稳稳接住 / 被认真理解 / 那句及时提醒 / 有人帮我理清 / 被信任的机会`
- 质量门会拒收感谢信模板、道德负债感、强行回馈任务、缺少具体善意和缺少被回应需要的 draft
- `gratitude` 的 `stitched_moments` supporting-scene 质量门现在先走严格锚点，再只接受仍保留明确照顾动作和足够场景锚点的自然压缩；像“请我吃冰淇淋，还问要不要喝水”写成“请我吃冰，还问我渴不渴”仍可通过，但“后来她想吃冰，我陪她去买了”这种语义反转会继续触发 `missing_supporting_scene_anchor`

### 技术层

- `snapshotData` 与 `payload` 已成为多维度结构化真相层
- `InterviewSession.entryDate` 已落地，日志归属日期不再默认等于 `startedAt`
- `DraftWritingProfile` 已进入 joy / fulfillment / reflection / improvement / gratitude 正文生成链，承担内部写作控制层
- `pendingDecision` 已支持：
  - `event_complete`
  - `dimension_redirect`
  - `boundary_insufficient`
- `pause_session` 复用现有 pause 接口，不新增公开 URL 或数据库字段
- `respond/stream` 已是当前主前端访谈通路
- `respond/stream` 与非流式 `respond` 共享结构化错误语义，错误对象包含 `code / title / message / resolution / retryable / action / requestId`
- `journal-entry/[id]` 已是日志正文主编辑接口
- `docs/theory/dimension-draft-template.md` 已成为后续维度正文生成的统一模板入口
- calendar 读模型基础已落地：
  - `src/features/calendar/aggregate-calendar.ts`
  - `src/server/repositories/calendar.repository.ts`
  - `src/server/services/calendar/calendar.service.ts`
  - `src/server/services/daily-journal/daily-journal.service.ts`
  - 已有 `CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord`
  - `/api/calendar/day|week|month` 已落地
  - `/api/daily-journal`、`/api/daily-journal/generate`、`/api/daily-journal/[id]`、`/api/daily-journal/[id]/save` 已落地
  - 未来日期允许查询，但服务端会裁掉 `start_interview / continue_interview`
- `/calendar` 月视图、周视图、日视图与 deep link 已落地
- `SiteHeader` 现在是全宽暖色工具栏，中区承接 calendar 的 `month / week / day` 切换、前后翻段、回到今天和实时摘要；访谈维度条、calendar toolbar 和主导航都直接平铺，不再套内层方框；主导航当前页用贴近文字的暖棕实线下划线表达，选中项字号略大，访谈和 calendar 业务组用 `｜` 分隔
- `SiteHeader` 现在会把真实 header 高度同步到 `--site-header-viewport-offset`；calendar / analysis / settings 的首屏工作区会按实际 header 高度后的剩余视口布局，小屏、多行 toolbar 或 header 换行时不再因为顶部 offset 写死而出现底部假留白或双滚动
- `/analysis?month=YYYY-MM&section=overview|score|rhythm|insights` 记录分析页已改为 tab 互斥视图：`SiteHeader` 中区的 `AnalysisToolbar` 独立获取月分析数据，渲染月份翻页和 4 个 section tab（总览/评分/节奏/五维），tab 带数据依赖的 contextual chip；`overview` 总览首屏先给月度判断、评分可信度和一个“建议先看”的主行动，再展示评分 / 节奏 / 五维轻入口与底部证据条；正文区按 `section` 只渲染对应板块；切换 tab 或翻月后 `section` 保留在 URL 中。分析页回到维度访谈的 drill-down 链接会保留对应 `entryDate`；未来日期的热力区 drill-down 只保留 `查看当天`，不开放开始/继续访谈；`rhythm` 会把 `saved` 但来源签名失配的当天整合日志重新标成 `待更新 / 待整合`，即使当天已没有 `saved` 来源也仍会算进待处理；未来月份不会再把整个月误算成 `最长空档`。评分区只有在至少 2 天评分且确实存在差异时，才展示 `长期偏高 / 最常掉下来 / 波动最大` 排名卡；样本不足或各要素持平时只保留“仅供参考”的轻提示。`insights` 已改成“本月判断 + 五维全景 + 维度之间 + 下一步”，watchpoint 优先提示 `stale` 整合日志，月初单次记录保持 `starting`，不再被误写成“已经退下去”。`PUT /api/happiness-score` 只允许保存今天和昨天，且当前月评分保存成功后 toolbar chip 会立即刷新；空数据月份现在直接显示真实空态，不再使用示意填充，只有评分没有维度日志的月份也不会伪造 `已整合`、密度结论或 `主线维度`
  - calendar 页面当前优先首屏工作区；超量内容进入 pane 内局部滚动
  - 月视图桌面是“月历主体 + 当天检查面板”的双栏骨架，小屏是月历主体在上、当天检查面板在下，右侧/下方面板有 `查看当天` 日期级入口
  - 月格当前固定渲染 6 行 42 格，loading skeleton 也保持 42 格，保证每个月份和加载前后的网格高度一致
  - 月格当前已改成“已保存结果优先”的可见语义：`1-4` 个已保存维度显示单字 `悦 / 实 / 思 / 改 / 谢`，五维都至少保存过一次时收束为 `已完成`
  - 月格当前不再把 `进行中 / 混合状态` 作为可见文字标签；未完成感主要由状态符号和颜色层承担
  - 月视图当天检查面板汇总 `待继续 / 已完成 / 完整日志`，过去空白日走轻空态，不渲染 5 个空维度；月查询失败时仍保留月历主体 + 当天检查的方框 split-pane 骨架，左右 pane 各自显示错误说明和重试，不再退回旧的圆角浮卡或假空白日
  - future 空白日继续保留中性待到来语义；today 圆点回到日期锚点附近，避免和右上角状态区冲突
  - 周视图已经升级为 7 天同屏对比板；主动作会优先直达 `继续访谈 / 继续编辑 / 查看日志`，无可直达动作时回退 `查看当天`
  - 日视图已经升级为五维紧凑操作台；`mixed` 主动作稳定按 `继续访谈 -> 继续编辑 -> 查看日志 -> 开始记录` 解析
  - 当天整合日志状态已经进入 calendar 读模型；月/周只显示轻 marker，日视图显示紧凑入口条，正文编辑仍回访谈页
  - month / week / day 三个视图当前已经切到暖色 calendar 工作台：状态五态、维度单字 badge `悦 / 实 / 思 / 改 / 谢`、badge/surface 层级和主次按钮语义都由 `presentation.ts` 统一；读屏仍保留完整维度名
  - calendar 文案已经切到工作台短句语气；英文眉题已清掉，`aria-busy`、loading/error inline 语义、焦点态和主要 CTA 的可访问名称已补齐
  - `SiteHeader` 已统一为全宽暖色工具栏，访谈维度条与 calendar toolbar 共用同一套中区高度预算，业务组用 `｜` 分隔；主导航当前页改用实线下划线，不再套独立中区外框
  - `mode=daily-journal` 深链只打开当天整合日志主区，不会启动或创建新的维度访谈 session；点击“回到访谈”会先保存当天日志 pending 编辑，再移除 `mode`，回到同一 `dimension + entryDate` 的普通访谈 hydrate 流程；在完整日志主区切换维度时也会先保存 pending 编辑并回到普通访谈工作区
  - 第 4 步的接口契约与验收基线保留在 `docs/integration-guide.md` 的 `5.10 Step 4: calendar API 可执行规格`

## 3. 当前仍然没有完成的事

### 产品层

- joy / fulfillment / reflection 日志正文已经从结构卡转向正文优先，但文风和完成度还要继续打磨
- improvement 已完成理论规格、结构字段、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完成收束、日志生成、质量门、fallback draft、标题治理和自动化验收样例，但还没有完成端到端产品验收
- 跨天长期汇总、稳定规律沉淀还没开始做

### 技术层

- `interview.service.ts` 仍是 joy-first 的导出壳子，不是真正抽象后的多维度引擎
- `JoyEntry` 已经承担多维度容器角色，但数据库命名还是 joy 历史命名
- `/api/transcribe` 仍是 stub，没有真实转写模型
- `npm run build` 当前仍会停在既有 ESLint `no-explicit-any` 错误（集中在 `src/server/repositories/*`）上；这不是本轮语义解释层改动引入的新问题，但在继续交付前需要单独收尾

## 4. 当前代码与文档的 canonical 关系

后续接手请优先看：
- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/integration-guide.md`
- `docs/operator-runbook.md`
- `docs/theory/joy-alignment.md`
- `docs/theory/fulfillment-alignment.md`
- `docs/theory/reflection-alignment.md`
- `docs/theory/improvement-alignment.md`
- `docs/theory/gratitude-alignment.md`
- `docs/theory/dimension-draft-template.md`

`Tech_Design.md` 只保留历史设计背景，不再当成实时事实源。

## 5. 本轮重要产品修正

这一轮已经完成的关键交互修正：
- 右侧日志面板不再显示“日志”标题，只保留关闭按钮和正文编辑区
- 用户点击“生成日志”后，右侧不再看到结构化线索卡
- 日志工作区支持纵向滚动
- 标题、正文和保存动作已经收拢到同一个日志编辑 pane
- 标题当前固定单行显示，限制 `16` 字，不再依赖横向滑动查看
- 已有草稿后，新访谈内容不会自动触发日志整理；是否刷新由用户手动点击“生成日志”决定
- 日志生成现在带阶段式反馈：`正在生成日志骨架 / 正在打磨日志细节 / 最终润色中`
- 如果当前草稿已经覆盖到最新访谈状态，再次点击“生成日志”会直接复用当前版本，不再重复等待
- 日志工作区不再展示“正在根据最新访谈重整”或“我已经整理出一版日志”这类解释性文案
- 如果用户在日志整理过程中关闭面板，这次整理会被取消，访谈分岔点按钮会恢复可点击
- 对话里的 `thinkingSummary` 已明确为浅色思路层，用来呈现 AI 对用户回复的理解和处理焦点；五个维度都会通过 `summary` SSE delta 流式展示这层内容，不再作为第二个正式追问展示
- 如果模型给出的 `thinkingSummary` 只是浅复述、语气不对或写成第二个追问，服务端会基于同一层维度语义解释重写它，不会直接把浅复述透传给用户
- 顶部新增开发辅助按钮 `清除对话记录`，方便重开当前维度的新一轮访谈
- 标题生成已经改为语义短标题治理；坏 AI 标题和 fallback 标题都会被后端兜底。
- 用户拒绝继续或用自然语言要求整理日志时，服务层会先处理边界，不再继续抽取和追问。
- 访谈提交错误现在会给用户展示结构化处理建议，例如 `MESSAGE_TOO_LONG` 提示拆分发送，`SESSION_NOT_FOUND` 提示刷新或清除对话记录。

## 6. 当前验证基线

截至 `2026-05-05`，本地已验证：
- `npx tsc --noEmit`
- `npm test`

测试结果：
- `40` 个测试文件
- `406` 个测试；当前 `npx tsc --noEmit` 通过，但 `npm test` 仍有 `1` 个失败：`tests/unit/calendar-presentation.test.ts` 里的 mixed month-dimension pill 视觉区分断言还停留在旧规则

已覆盖的关键回归面：
- 阶段推进
- partial 放行
- `thinkingSummary` 浅色思路层不会退回第二个正式追问，并覆盖五个维度的 summary 流式输出
- joy redirect 到 `improvement`
- fulfillment extract fallback
- reflection extract fallback
- improvement 数据结构兼容旧 JSON
- improvement AI 抽取 schema 分发和抽取 guardrails
- improvement fallback 抽取、阶段推进、完整 / partial 收束和 boundary insufficient
- improvement 专属提问策略：开场、分轨、好状态/坏状态、可控点、下次最小动作和禁用建议/计划/归责口吻
- improvement 正文生成、quality gate、fallback draft、语义短标题治理和第 8 阶段自动化验收样例
- gratitude AI 抽取 schema 分发、fallback 抽取、阶段推进、完整 / partial 收束和 boundary insufficient
- gratitude 专属提问策略：具体被照顾/支持的时刻、具体动作、被回应的需要、珍惜原因、关系信号和禁用感谢信/负债口吻
- gratitude 正文生成、quality gate、fallback draft、语义短标题治理和自动化验收样例
- draft quality gate
- gratitude stitched 多事件 fallback：主事件外最多 `2` 个 supporting moments 会保留在正文里
- gratitude 专属 `missing_supporting_scene_anchor` 质量门，不再误伤非 gratitude 的 stitched 草稿
- 重新生成已有日志
- 保存正式日志
- 页面刷新后的 session 恢复
- 标题语义压缩和坏标题替换
- 用户边界 partial 收束与 `boundary_insufficient`
- 访谈提交结构化错误展示与原输入保留
- `entryDate` 解析、北京时间日期归属
- `POST /api/interview/session/start` 的 `entryDate` 透传与非法日期校验
- calendar `day / week / month` 聚合器
- calendar repository 标准化 source
- calendar legacy session 在缺少 `entryDate` 时回退 `startedAt`
- calendar service 查询与参数校验
- calendar API `day / week / month` 路由、错误映射与未来日期动作裁剪
- calendar header 中区控制条、month/week/day 共享导航和实时摘要
- calendar month view 桌面双栏 / 小屏上下堆叠工作区、`查看当天` 日期级入口、42 格 loading skeleton、基于真实 header 高度的首屏剩余视口布局、错误态 split-pane 不显示假空白日，以及 `/calendar -> /interview` deep link
- calendar week view 7 天对比板、轻量周摘要块、day view 五维紧凑操作台，以及 month/week/day 工作区壳层
- calendar 视觉系统：状态 class、维度单字 badge `悦 / 实 / 思 / 改 / 谢`、主次按钮层级和 month/week/day 共享样式投影
- calendar 可达性与交付收口：短句文案、focus-visible、accessible name、`aria-busy`、loading/error inline state
- `tests/unit/site-header-calendar.test.tsx` 覆盖 header 中区的 calendar 标题、翻段、视图切换和摘要 chip
- `tests/unit/daily-journal.service.test.ts` 覆盖当天整合日志 stale 判断、无保存来源拒绝生成、fallback 章节生成、草稿更新与正式保存
- `tests/unit/interview-shell.test.tsx` 覆盖 `mode=daily-journal` deep link 不启动普通访谈、“回到访谈”先保存当天日志 pending 编辑并移除 `mode`、以及从完整日志主区切换维度后回到普通访谈工作区

fulfillment 人工 smoke 基线：
- 推进完成
- 投入积累
- 协作贡献
- 空忙空转
- 用户拒绝继续深挖
- 用户拒绝继续且材料不足
- 标题不能退回长事件句截断

reflection 人工 smoke 基线：
- 规律发现
- 方向优势
- 判断校准
- 空泛想法
- 用户拒绝继续深挖
- 用户拒绝继续且材料不足
- 标题不能退回长事件句截断

## 7. 下一个最合理的工作面

如果继续做维度理论深化，最合理的下一步是：

1. 继续按 `docs/theory/improvement-alignment.md` 做 improvement 端到端产品验收
   - 生成、重新生成、保存、刷新恢复和边界收束的整链路人工验收
   - 正文风格继续打磨

2. 对 gratitude 做同等级产品验收
   - 覆盖支持回应、理解体谅、陪伴接住、照顾减负、信任机会五类材料
   - 重点看 partial 收束、质量门和标题治理是否稳定

3. 处理多维度通用引擎的历史技术债
   - 把 `interview.service.ts` 和 joy-first 分支逐步抽成真正的维度无关实现
   - 减少后续新增维度或继续打磨维度时的重复改动面

如果继续做记录日历这条线，下一步更合理的是：
- 继续细化月格里的轻量待继续 marker，让用户不用进入当天检查面板也能扫出哪些天还有尾巴
- 补一份键盘-only / 读屏人工 smoke checklist，方便后续回归
