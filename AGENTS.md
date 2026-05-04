# Happiness-system-codex AGENTS

## 1. 项目定位

这是一个把“幸福日志”理论翻译成 AI 访谈产品的仓库。

当前真实状态以 `2026-05-04` 的代码为准：
- 已有 `joy / fulfillment / reflection / improvement / gratitude` 五个维度的通用访谈壳子。
- `joy / fulfillment / reflection / improvement / gratitude` 是当前已经完成理论对齐深化的标品维度。
- `improvement` 已完成理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完成标准执行、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- `gratitude` 已完成理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完成标准执行、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- 五个维度的 stitched 多事件日志现在都共用“完整 stitched brief 不截断”的 supporting-scene 约束：`eventWindow` 只裁剪事件列表与消息窗口，不再重建缩水版 `draftBrief`；AI prompt、质检和 fallback 都会继续保留窗口外 supporting moments，避免 `refresh_minor` 静默丢掉后续来源事件。
- 五个维度的 `thinkingSummary`、日志正文、日志标题和 `joy` 质量门现在都共用一层服务端语义解释层：系统会先判断当前片段在维度理论里属于什么主题、为什么成立，再把这层解释投影到 summary、`DraftBrief`、短标题和 draft 质检；`joy` 质量门现在接受语义等价的改写，不再要求固定命中 `被接住 / 被理解 / 有分量` 这类字面词。
- `fulfillment` 质量门现在接受“没白费 / 终于落了地 / 总算收住了”这类自然换述，不再因为没有命中少数固定理论词就把有效 AI 草稿静默打回 fallback；`gratitude` 的 stitched supporting-scene loose anchor 也重新收紧，不会因为共用几个壳子短语就误放行被改写的副事件。
- 五个维度的日志标题已经统一经过语义短标题治理，后端不再把长事件句机械截断成标题。
- 用户表达“不想继续 / 不要再追问 / 直接生成 / 总结日志 / 整理成日志 / 追问没有意义”等边界或日志整理意图时，边界优先级高于槽位完整度。
- 历史 `choiceKind` assistant turn 在刷新 / 恢复后仍保留在 transcript 中；但只要当前正在显示 inline choice card，聊天记录里会先隐藏所有 choice turn，避免和卡片重复。只有当 live choice card 消失后，且某条历史 choice 最终停在 transcript 末尾时，它才会继续可见。
- 访谈提交错误已经结构化，`respond/stream` 与 `respond` 会返回带 `code / title / message / resolution / retryable / action / requestId` 的 `issue`，前端展示原因、解决方案、错误码和 requestId。
- `InterviewSession` 现在有显式 `entryDate`，日志归属日期不再默认等于 `startedAt`。
- 普通 `/interview` 入口现在默认代表“今天的新记录入口”：本地按维度缓存的 session 和当前页面已经挂载的 live session，都只有在 `entryDate === 今天` 时才会被自动恢复；显式带 `entryDate` 的 deep link 仍只会恢复同一天的 session。访谈页正文区会显示“当前记录日期：YYYY-MM-DD”，避免用户误把旧日期会话当成当天记录。
- `reflection` 在 `continue_current_event` 场景里新增了防回卷约束：如果上一轮已经问过“具体经历 / 对话”，且用户明确回答没有，继续深聊时不能再追同一字段，而要改问更低压的具体锚点，比如某个顾虑、画面、比较时刻或选择瞬间；服务层会在最终落库前和流式输出前同时兜底，避免重复问题先漏给前端。
- 记录日历的 month/week/day 主链已落地：calendar 展示层读模型、calendar 聚合器、calendar repository、calendar service、`/api/calendar/day|week|month`、`/calendar` 月视图、周视图、日视图，以及回到 `/interview` 的 deep link 都已完成。日视图现在是某一天五维记录的统一阅读与分发入口。
- calendar / 当天整合日志 / 月分析的按天查询现在统一走 `Asia/Shanghai` 的整天时间窗口，不再用单个归一化时间点做精确匹配；同一天任意时刻保存的维度日志都会归到正确 `entryDate`。
- 当天整合日志已落地：`DailyJournalEntry` 独立承载日级成果物，访谈页顶部【完整日志】会按当前 `entryDate` 打开当天日志主区，只基于已保存维度日志生成章节合集；完整日志打开/生成与单维度日志生成都显示共享阶段进度、细进度轨和书页生长动效。完整日志工作区离开前会先保存未自动暂存的当天日志编辑；从完整日志切回访谈或切换访谈维度时，不会静默丢失 700ms autosave 触发前的输入，也不会让新维度被卡在完整日志工作区背后。
- 当天整合日志的来源集合现在会随着同日新增 `saved` 维度日志、来源维度日志更新时间变化或来源不再是 `saved` 进入 `stale`；来源签名按“同一天每个维度最新一篇 `saved` 日志”计算，重新生成后章节集合会与当天真实 `saved` 维度重新对齐。
- `SiteHeader` 现在是全宽暖色工具栏，中区承接 calendar 的 `month / week / day` 切换、前后翻段、回到今天和实时摘要；访谈维度条、calendar toolbar 和主导航都直接平铺，不再额外套内层方框；主导航当前页用贴近文字的暖棕实线下划线表达，选中项字号略大；访谈和 calendar 业务控制组用 `｜` 分隔。主导航不再包含【首页】项，点击左侧【幸福系统】品牌标识可返回首页。
- 带 `entryDate` 的访谈页里，header 当前选中维度会优先显示 live session 的实时轮次和进度圈；其余维度，以及切到当天整合日志工作区后的胶囊状态，继续以 `/api/calendar/day` 的 day snapshot 为准。只要某个维度当天已经有 `saved` 日志，胶囊会优先显示 `已完成`，即使同一天还有继续中的 session。
- 如果当前 active choice 是 `boundary_insufficient` 或 `dimension_redirect`，header 当前选中维度的 live progress 会被压在 `88%` 以下，不再被历史 `draftGenerationUnlocked` 顶回 `90% ready`。
- 首页当前是品牌广告页，主线为“在日常里照见自己 -> 回顾一天显露纹理 -> 五维认识自己 -> 日有所记，心有所归”；文案和图片位集中在 `src/content/homepage.ts`，图片按 section 配置，当前已接入 `public/homepage/*` 本地图片，图片区统一采用“单行标题 + 图片本体”的去卡片化布局，首页木纹背景改为上浅下深。
- `/analysis?month=YYYY-MM&section=overview|score|rhythm|insights` 记录分析页当前已改成 tab 互斥视图的月度复盘工作台：`SiteHeader` 中区承接月份翻页和 4 个 section tab（总览/评分/节奏/五维），tab 带数据依赖的 contextual chip（评分待补状态、节奏待整合/待成文状态、主线维度名）；正文区按当前 `section` 只渲染对应板块。`overview` 总览首屏先给月度判断、评分可信度、一个“建议先看”的主行动，再给评分刻度 / 记录节奏 / 五维线索三块轻入口；底部证据条区分维度记录日、成果保存日、待整合日和评分可信度，避免把统计卡作为首屏主角。缺失 `section` 时前端默认切到 `overview` 总览视图；切换 tab 或翻月后当前 `section` 保留在 URL 中。评分区当前是补录优先的双栏工作台：左侧先处理今天 / 昨天状态、填写进度和 8 项列表，右侧只编辑当前要素的 `1..10` 刻度，未填不再默认落在 `5` 分；今天和昨天都补齐后，首屏才回到总分走势、8 要素快扫和单项细看。只有在至少 `2` 天评分且确实存在差异时，才展示 `长期偏高 / 最常掉下来 / 波动最大` 排名卡，否则只保留“仅供参考”的轻提示。`rhythm` 已改成状态优先热力工作台：未来日期保持 `待到来`，只评分未写日志的日期显示 `待成文`，同一天整合日志如果因为来源签名变化而 `stale`，即使当天已经没有任何 `saved` 来源，也仍会在分析里按 `待更新 / 待整合` 处理，不再误标成 `已整合`。`insights` 已改成“本月判断 + 五维全景 + 维度之间 + 下一步”的月度解释工作台；watchpoint 会优先提示 `stale` 的当天整合日志，单次且发生在月初的维度记录会保持 `starting`，不再被误写成“前面露过头”。分析页内”回到某维度”类 drill-down 链接会保留对应 `entryDate`；未来月份的总览首屏不会再把用户送去今天的访谈，而会提示回到当前月份；未来日期的热力区 drill-down 只允许 `查看当天`，不开放 `开始这一天的记录 / 继续当天记录`；只有评分、没有已保存维度日志的月份，`insights` 会显示空态而不是伪造主线维度；未来月份不会把整个月误算成 `最长空档`。`PUT /api/happiness-score` 只允许保存 Asia/Shanghai 口径下的今天和昨天；当前月评分保存成功后，`AnalysisToolbar` 的 contextual chip 会立即刷新；`insights` 的 headline / watchpoint 和“评分低点还没写出来”卡片现在共用同一套 quiet lagging 维度排序，不会互相打架。
- 全站前端壳层已经切到平铺工作台：根布局不再给页面额外包外距，首页、访谈、设置和 calendar 主体减少大圆角外框、重复模块间隙和卡片嵌套。
- calendar 页面当前优先首屏工作区；桌面超量信息进入局部 pane 滚动，小屏月视图改为“月历主体在上 + 当天检查面板在下”的纵向工作台，不再依赖 `1040px` 横向滚动访问右侧面板。桌面月视图仍是“月历主体 + 当天检查面板”的双栏骨架，右侧提供 `查看当天` 日期级入口。
- 月视图月格当前固定渲染 6 行 42 格，loading skeleton 也渲染同样的 42 格，保证加载前后高度一致。
- 月视图当前已经切到“已保存结果优先”的可见语义：`1-4` 个已保存维度显示单字 `悦 / 实 / 思 / 改 / 谢`，五维都至少保存过一次时收束为 `已完成`；`进行中 / 混合状态` 不再作为月格里的可见文字标签。
- 月视图当天检查面板当前显示 `待继续 / 已完成 / 完整日志` 三个 summary chip；`待继续` 按 `activeCount + draftCount` 投影，`完整日志` 显示 `未生成 / 可汇总 / 草稿 / 已保存 / 需更新`。过去空白日只显示轻空态，不再列出 5 个空维度；月查询失败时右侧不再 fallback 成假空白日，而是显示“当天检查暂时不可用”。
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
6. 用户可点击顶部【完整日志】切到当天日志主区，生成、编辑并保存当天整合日志。

## 2. 文档优先级

如果文档之间有冲突，按以下顺序判断：
1. 用户本轮最新指令
2. 本文件 `AGENTS.md`
3. `README.md`
4. `docs/architecture.md`
5. `docs/integration-guide.md`
6. `docs/operator-runbook.md`
7. `docs/theory/joy-alignment.md`
8. `docs/theory/fulfillment-alignment.md`
9. `docs/theory/reflection-alignment.md`
10. `docs/theory/improvement-alignment.md`
11. `docs/theory/gratitude-alignment.md`
12. `docs/theory/dimension-draft-template.md`
13. `Tech_Design.md`（仅保留历史设计背景，不再是实时事实源）

协作语言：
- 默认用中文输出，除非用户明确要求使用其他语言，或需要保留代码、命令、错误信息、API 字段等原文。
- 如果是 review / code review / 审查结果，必须先把 findings、严重级别、文件位置和结论翻译成中文再输出；除非用户明确要求保留英文原文。必要时可在中文后附英文原文，但默认先给中文版本。

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
  - 工作区会进入阶段式生成状态：
    - `正在生成日志骨架`
    - `正在打磨日志细节`
    - `最终润色中`
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
- 如果用户从维度日志面板切到顶部【完整日志】当天整合日志主区：
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
- `src/features/interview`
  - 多维度通用前端定义、schema、进度与维度元信息。
- `src/features/calendar`
  - 纯展示层记录读模型：`CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord`
  - 以及 `day / week / month` 聚合器、header toolbar 投影 helper、月/周视图展示 helper、future/past 空白语义 helper 与 deep link/action helper。
- `src/features/analysis`
  - 月度记录分析的 `month=YYYY-MM` 与 `section=overview|score|rhythm|insights` URL 归一化、月份跳转、标题格式化、类型与聚合 helper；analysis read model 额外承载 `dailyCoverage / rhythmOverview / insightsOverview` 以及按来源签名判断的当天整合日志 `stale` 语义。
- `src/content`
  - 首页文案、CTA 和图片位配置；当前首页配置在 `homepage.ts`。
- `src/features/happiness-score`
  - 幸福 8 要素日评分的数据类型、`1-10` zod schema、保存请求 schema 与评分 key 定义。
- `src/features/daily-journal`
  - 当天整合日志 schema、正文长度约束和 source signature helper。
- `src/components/calendar`
  - `calendar-toolbar.tsx` 负责 `SiteHeader` 中区的 calendar 控制条与摘要展示。
  - month / week / day shell 当前都已经进入工作区壳层；month 桌面是双栏检查面板、小屏是上下堆叠工作台，week 是 7 天对比板，day 是五维紧凑操作台。
- `src/components/analysis`
  - 记录分析页壳、`overview` 总览的月度判断、评分可信度、建议先看主行动、三块轻入口和底部证据条、补录优先的评分工作台（左侧日期状态 / 8 项列表，右侧当前要素 `1..10` 刻度）、样本/差异不足提示、状态优先本月热力图、当天追踪 drill-down，以及“本月判断 + 五维全景 + 维度之间 + 下一步”的 `insights` 布局。`analysis-toolbar.tsx` 独立获取月分析数据，在 `SiteHeader` 中区渲染月份翻页和 4 个 section tab（总览/评分/节奏/五维），tab 带数据依赖 contextual chip，并会在当前月评分保存成功后即时刷新。
- `src/features/joy-interview`
  - joy-first 的 prompt、引擎、schema 与服务端逻辑。
  - 当前也承载 fulfillment / reflection / improvement / gratitude 的理论对齐分支。
- `src/server/services/interview`
  - 当前对外暴露的访谈 service 层。
  - 现实情况：`interview.service.ts` 目前主要是 re-export `joy-interview.service.ts`。
  - `respond-error.ts` 负责把访谈提交错误归一化为用户可展示的 `issue`。
- `src/server/services/calendar`
  - 记录日历的 `day / week / month` 服务端查询入口。
- `src/server/services/daily-journal`
  - 当天整合日志 source 收集、AI 轻整理、fallback 章节合集、草稿更新与正式保存。
- `src/server/repositories`
  - 会话、事件、日志、payload 映射与数据库读写。
  - `calendar.repository.ts` 把 `InterviewSession / JoyEntry` 标准化成 calendar source。
  - `daily-journal.repository.ts` 维护 `DailyJournalEntry` 和当天已保存维度日志 source。
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
  - 全部可恢复对话消息。
- `JoyInterviewSnapshot`
  - 历史兼容快照表，仍保留旧 joy 结构投影。
- `JoyEntry`
  - 日志标题、正文、legacy 字段、`payload`、`eventBlocks`、保存状态。
- `DailyJournalEntry`
  - 日级整合日志，`userId + date` 唯一，记录 `draft / saved`、正文、来源维度日志 ids、session ids、source signature 和 stale 判断所需时间。
- `DailyHappinessScore`
  - 幸福 8 要素日评分，`userId + date` 唯一，8 项分数均为 `1..10` 整数；当前只允许通过 `/analysis` 保存今天和昨天。
- `MemoryFact`
  - 长期记忆摘要，默认功能仍关闭。
- `AIRequestLog`
  - `transcribe / extract / generate` 三阶段调用日志。

关键事实：
- 新的多维度结构主要落在 `snapshotData` 和 `payload` 里。
- 新增的 `boundary_insufficient` 只存在于 `InterviewEvent.progressData` 到 API response 的映射中，不需要 DB migration。
- legacy 列仍保留，用于兼容旧代码与旧数据投影。
- `entryDate` / `date` 的日期范围查询当前统一按 `Asia/Shanghai` 整天窗口执行：`gte dayStartUtc`、`lt nextDayStartUtc`。
- 当前没有额外的 DB migration 依赖才能理解 joy 结构；但本地数据库必须和 `prisma/schema.prisma` 同步。

## 6. API 面与调用语义

当前主要接口：
- `POST /api/interview/session/start`
- `GET /api/interview/session/[id]`
- `POST /api/interview/session/respond`
- `POST /api/interview/session/respond/stream`
- `POST /api/interview/session/pause`
- `POST /api/interview/session/complete`
- `POST /api/interview/session/reopen`
- `POST /api/interview/session/draft/generate`
- `POST /api/interview/session/draft/save`
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
- `PUT /api/happiness-score`

必须记住：
- 前端主链路使用的是 `respond/stream`，不是普通 `respond`。
- `POST /api/interview/session/start` 现在支持可选 `entryDate: YYYY-MM-DD`；session hydrate 也会返回 `entryDate`。
- `respond/stream` 的 SSE `error` 事件现在会带 `issue`；非流式 `respond` 错误 JSON 也带同一结构。
- `respond/stream` 的 provider 原始 `delta.text` 会原样透传给前端，不对任意流式增量单独 trim 或折叠空白；只有完整文本或系统生成的补发文本才允许分块。
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
  - `GET /api/analysis/month?month=YYYY-MM`
  - 当前返回 `month / logOverview / dailyCoverage / rhythmOverview / dimensionBreakdown / dimensions / insightsOverview / scoreOverview / scoreTrend / scoreRecords / editableDates`
  - 只统计 `saved` 维度日志和 `saved` 当天整合日志；但若当天整合日志的 `sourceSignature` 与同日最新 `saved` 维度来源不一致，analysis 会把它标成 `stale`，并在 `rhythm / insights` 中都按待更新处理；即使当天已没有任何 `saved` 来源，这个 `stale` 状态也不会被漏掉
- 页面当前已改成 tab 互斥视图的月度复盘工作台：`SiteHeader` 中区的 `AnalysisToolbar` 独立获取月分析数据，渲染月份翻页和 4 个 section tab（总览/评分/节奏/五维），tab 带数据依赖的 chip；正文区按 `section` 只渲染对应板块，`overview` 总览首屏先给月度判断、评分可信度和唯一主行动，再展示评分 / 节奏 / 五维轻入口与证据条；当前月评分保存成功后，toolbar chip 会即时刷新
  - 缺失 `section` 时默认切到 `overview` 总览视图；切换 tab 或翻月后 `section` 保留在 URL 中
  - 热力区点到未来日期时，只提供 `查看当天`，不暴露 `开始这一天的记录 / 继续当天记录`
  - `rhythm` 会把 `saved` 但来源签名失配的当天整合日志重新标成 `待更新 / 待整合`，不会误算成 `已整合`
  - 未来月份不会再把整个月误算成 `最长空档`
  - `editableDates` 在当前月返回今天和昨天；如果今天是月初，昨天即使属于上月也会保留为可编辑日期
  - `PUT /api/happiness-score` 请求体是 `date + scores.{meaning,health,virtue,autonomy,interest,skill,relationship,livingCondition}`，8 项必填且必须是 `1..10` 整数
  - `scoreTrend.days` 覆盖当前分析月自然日；未评分日期返回 `null` 并在图表中断线
  - 只有在至少 `2` 天评分且确实存在均值/波动差异时，前端才把评分数据投影成 `长期偏高 / 最常掉下来 / 波动最大` 排名卡；样本不足或各项持平时只显示“仅供参考”的提示

## 7. 本地开发与排障

最常用命令：
- `npm run dev`
- `npm test`
- `npx tsc --noEmit`
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
  - 先区分是不是这次改动引起的
  - 截至 `2026-05-04`，当前仓库仍有一批既有 ESLint `no-explicit-any` 错误，集中在 `src/server/repositories/*`，以及 `tests/unit/interview-shell.test.tsx` 的旧断言漂移；这些问题会让 full build / full test 继续报红，不能误记成“本次改动引入”
- 如果用户看到结构化访谈提交错误：
  - `NETWORK_UNAVAILABLE`：先确认 `npm run dev` 仍在运行，再刷新页面
  - `MESSAGE_TOO_LONG`：单次回复超过 `1200` 字，拆成两段发送
  - `SESSION_NOT_FOUND`：刷新页面；仍失败则点击 `清除对话记录`
  - `SESSION_CHOICE_UNAVAILABLE`：分叉状态过期，刷新后按最新状态操作
  - `INTERVIEW_DB_WRITE_FAILED` / `INTERVIEW_RESPONSE_SCHEMA_ERROR` / `INTERVIEW_RESPOND_FAILED`：看 dev server 日志里的 requestId 和堆栈
- 如果日志能生成但风格偏保守：
  - 优先检查 `src/features/joy-interview/prompts/joy-prompts.ts`
  - 再检查 `joy-interview-ai.service.ts` 的 fallback 文本
- 如果语音链路看起来“可用但质量很怪”：
  - 先确认这不是 bug，`/api/transcribe` 当前就是 stub

## 8. 测试与交付要求

当前回归基线：
- `npm test`
- `npx tsc --noEmit`

截至 `2026-05-04`，本地测试基线为：
- `40` 个测试文件
- `381` 个测试；当前 `npx tsc --noEmit` 通过，但 `npm test` 仍有 `16` 个失败，全部集中在 `tests/unit/interview-shell.test.tsx`，主要是旧的 `第 2 轮` / header live progress 断言没有跟上最新访谈页展示。

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

## 10. 修改文档时的规则

- 新事实优先更新 `README.md` 和 `docs/*`，不要只改本文件。
- 所有日期用绝对日期，例如 `2026-04-29`。
- 不要再把 `Tech_Design.md` 当成实时事实源。
- 如果产品交互发生变化，必须同步：
  - `README.md`
  - `docs/architecture.md`
  - `docs/integration-guide.md`
  - `docs/handoff.md`
