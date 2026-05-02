# Handoff

最后更新：`2026-05-02`

## 1. 当前阶段结论

项目已经从“只做 joy 的原型设计稿”进入“多维度通用壳子 + joy / fulfillment / reflection / improvement / gratitude 五个标品维度”的阶段。

当前最重要的现实：
- joy / fulfillment / reflection / improvement / gratitude 已完成理论对齐深化。
- improvement 已完成理论对齐开发规格、数据结构扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完成标准执行、正文生成、质量门、fallback draft、标题治理和自动化验收样例；仍需要端到端产品验收。
- gratitude 已完成理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完成标准执行、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- 日志工作区对用户展示的是“日志正文”，结构化线索只保留在系统内部。
- 日志标题已经做五维统一语义短标题治理，后端不再用长事件句机械截断成标题。
- 用户边界和自然语言日志整理意图优先级高于槽位完整度；用户拒绝继续或输入“总结日志 / 整理成日志”等表达时，材料足够则 partial 收束，材料不足则给低压选择。
- 访谈提交失败已经结构化为 `issue`，用户能看到原因、解决方案、错误码和 requestId，不再只看到泛化“提交失败”。

## 2. 截至 2026-05-02 已经落成的东西

### 产品与交互

- 多维度访谈导航与维度缓存
- 可恢复的访谈 session
- 访谈中的分叉选择：
  - 继续当前事件
  - 聊下一件事
  - 生成日志
  - joy 场景下建议跳到 `improvement`
- 右侧日志工作区
- 日志草稿生成、再生成、编辑、保存
- 五维统一语义短标题治理，标题不再由长事件句机械截断
- 用户边界低压收束：材料足够时 partial，材料不足时“只补一句 / 换一个片段 / 先退出”
- 开发态 `清除对话记录` 按钮：当前维度可一键重开新访谈

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
  - 已有 `CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord`
  - `/api/calendar/day|week|month` 已落地
  - 未来日期允许查询，但服务端会裁掉 `start_interview / continue_interview`
  - `/calendar` 月视图、周视图、日视图与 deep link 已落地
  - `SiteHeader` 中区现在承接 calendar 的 `month / week / day` 切换、前后翻段、回到今天和实时摘要
  - calendar 页面当前优先首屏工作区；超量内容进入 pane 内局部滚动
  - 月视图当前是“月历主体 + 当天检查面板”的双栏骨架，右侧有 `查看当天` 日期级入口
  - 周视图已经升级为 7 天同屏对比板；主动作会优先直达 `继续访谈 / 继续编辑 / 查看日志`，无可直达动作时回退 `查看当天`
  - 日视图已经升级为五维紧凑操作台；`mixed` 主动作稳定按 `继续访谈 -> 继续编辑 -> 查看日志 -> 开始记录` 解析
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
- 标题、正文和保存动作已经收拢到同一张日志编辑卡片
- 标题当前固定单行显示，限制 `16` 字，不再依赖横向滑动查看
- 已有草稿后，新访谈内容不会自动触发日志整理；是否刷新由用户手动点击“生成日志”决定
- 日志生成现在带阶段式反馈：`正在生成日志骨架 / 正在打磨日志细节 / 最终润色中`
- 如果当前草稿已经覆盖到最新访谈状态，再次点击“生成日志”会直接复用当前版本，不再重复等待
- 日志工作区不再展示“正在根据最新访谈重整”或“我已经整理出一版日志”这类解释性文案
- 如果用户在日志整理过程中关闭面板，这次整理会被取消，访谈分岔点按钮会恢复可点击
- 对话里的 `thinkingSummary` 已明确为浅色思路层，用来呈现 AI 对用户回复的理解和处理焦点，不再作为第二个正式追问展示
- 顶部新增开发辅助按钮 `清除对话记录`，方便重开当前维度的新一轮访谈
- 标题生成已经改为语义短标题治理；坏 AI 标题和 fallback 标题都会被后端兜底。
- 用户拒绝继续或用自然语言要求整理日志时，服务层会先处理边界，不再继续抽取和追问。
- 访谈提交错误现在会给用户展示结构化处理建议，例如 `MESSAGE_TOO_LONG` 提示拆分发送，`SESSION_NOT_FOUND` 提示刷新或清除对话记录。

## 6. 当前验证基线

截至 `2026-05-02`，本地已验证：
- `npx tsc --noEmit`
- `npm test`

测试结果：
- `27` 个测试文件
- `248` 个测试全部通过

已覆盖的关键回归面：
- 阶段推进
- partial 放行
- `thinkingSummary` 浅色思路层不会退回第二个正式追问
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
- calendar month view 双栏工作区、`查看当天` 日期级入口，以及 `/calendar -> /interview` deep link
- calendar week view 7 天对比板、轻量 `WEEK SNAPSHOT` 摘要、day view 五维紧凑操作台，以及 month/week/day 工作区壳层
- `tests/unit/site-header-calendar.test.tsx` 覆盖 header 中区的 calendar 标题、翻段、视图切换和摘要 chip

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
- 继续统一 month / week / day 三个视图里的状态 class、badge 密度和动作文案层级
- 补齐 calendar 的可访问性细节：可访问名称、焦点态、键盘路径和主要 CTA 的读屏语义
- 继续完善 loading / error / empty / future day 的语义一致性，并补齐中小屏层级收束
