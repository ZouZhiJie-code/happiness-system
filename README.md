# Happiness-system-codex

一个把“幸福日志”理论翻译成 AI 访谈产品的 Next.js 应用。

截至 `2026-08-13`，这个仓库的真实状态是：

### GI-088 当前快照

- 已封存的运行链根因对照确认：官方 DeepSeek Pro＋完整合同达到 `20/24` 技术有效并通过固定八条人工质量门；模型档位稳定性为当前主因，完整状态输出职责为重要放大因素。
- 官方 Pro＋完整合同与官方 Pro＋可执行精简合同＋确定性状态投影的开发配对已封存为技术 No-Go。实际调用 `126` 次，完整组有效 `53/64`、精简组 `38/64`，两组有效率和延迟门均失败；状态投影四项错误为 `0`。
- 来源责任重划零模型候选已封存：复用精简组 `15` 份既有提案，正向 `15/15`、反例全拦截、状态四项错误 `0`，精简组反事实有效达到 `53/64`；原延迟门继续失败。Provider、重试、恢复、Judge、隐藏集读取、Preview 和 Production 变更均为 `0`。
- 板块 7 当前为“来源责任闭环、速度 No-Go”，下一单一主要因素建议讨论 Pro 等待优化；D27、D28 继续等待独立授权。板块 8 暂停。
- v8r3r2 内容质量、v8r3r3 可靠性 No-Go 与前序根因证据继续只读保留。板块 8 暂停，Production 保持 `legacy + baseline`；真人内容由产品负责人提交，隐藏推理继续不持久化。
- 已有 `joy / fulfillment / reflection / improvement / gratitude` 五个维度的通用访谈壳子。
- `joy / fulfillment / reflection / improvement / gratitude` 已完成理论对齐深化，是当前五个标品维度。
- `improvement` 已完成理论规格、数据结构扩展、AI 抽取独立化、fallback 抽取、访谈阶段推进、专属提问策略、完整 / partial 收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- `gratitude` 已完成理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、阶段推进、专属提问策略、完整 / partial 收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例。
- 五个维度的 stitched 多事件日志现在都共用“完整 stitched brief 不截断”的 supporting-scene 约束：`eventWindow` 只裁剪事件列表与消息窗口，不再重建缩水版 `draftBrief`；AI prompt、质检和 fallback 都会继续保留窗口外 supporting moments，避免 minor refresh 静默丢掉后续来源事件。
- 五个维度的 `thinkingSummary`、日志正文、日志标题和 `joy` draft 质检现在都共用一层服务端语义解释层：系统会先判断当前片段在维度理论里属于什么主题、为什么成立，再把这层解释投影到 summary、`DraftBrief`、短标题和 quality gate；这层内部解释不能直接写进用户可见正文或 fallback draft。`joy` 质量门接受语义等价改写，但会拒绝“更像轻快乐 / 关键不是深意义 / 象征意义 / 确定性”这类内部理论腔和抽象收尾。
- `fulfillment` 质量门现在接受“没白费 / 终于落了地 / 总算收住了”这类自然换述，不再因为没有命中少数固定理论词就把有效 AI 草稿静默打回 fallback；`gratitude` stitched supporting-scene 的 loose anchor 也重新收紧，不会因为共用几个壳子短语就误放行被改写的副事件。
- `InterviewSession` 现在有显式 `entryDate`，日志归属日期不再默认等于 `startedAt`。
- 访谈提交已接入可恢复记录：页面保存输入草稿和待发 outbox，服务端在 AI 处理前创建 `InterviewUserTurn` 并保存用户原话；重复提交用 `clientTurnId` 去重，旧对话位置会被拦截，失败或取消后可用“继续生成”恢复同一轮。
- 访谈意图识别已完成全量启用：系统会区分“继续讲内容”“需要换个问法”“想直接生成日志”“希望停止追问”等表达；Production 与 Preview 当前均使用 `enforce`，`legacy` 保留为 P0 问题的即时回退档位。
- 正式追问已支持按意图“换个问法”：用户可选择更简单、更具体、换角度、再深入或问得轻一点，也可纠正 AI 的理解。新会话保留最多三个回复版本，历史换问法通过分支保存原路径；加载状态只在原回复气泡内呈现，避免重复反馈。`2026-07-21` 已完成 Preview 与正式环境验收并发布到 `dailylight.chat`。
- `2026-07-20` 已完成 UserTurn 可靠提交改造的 production 发布：`InterviewUserTurn` 与 AI 候选审核理由 migration 已应用，公开 smoke 和同 `clientTurnId` 重放校验通过。
- 首版账户体系已经接入：
  - 支持用户名 + 密码注册与登录
  - 登录态使用 `httpOnly` cookie `dl_session`
  - 注册时必须勾选《用户协议》《隐私政策》
  - 私有页面 `/interview /calendar /analysis /profile /settings /settings/account` 未登录会跳转到 `/login?next=...`
  - 已登录访问 `/login` 或 `/register` 会优先回到 `next`，否则回到 `/interview`
  - 账号删除会级联删除该用户的会话、日志、评分、画像、记忆和认证会话
  - 前端 interview 本地恢复缓存与“上次维度”记忆已按 `userId` 做作用域隔离，避免同浏览器多账号串线
- 管理员工作台 `/admin/analytics` 已落地；只有命中 `ADMIN_USERNAMES` 白名单的登录用户会在设置页看到入口
- AI 质量数据飞轮已落地：生成 Trace 与 Prompt 血缘、规则 + 抽样 Judge、赞踩标签与文本、Badcase 聚类、候选去重、回放验证、管理员全量发布与回滚、七天效果观察和真实对话证据均已接入。`/admin/ai-quality` 采用状态摘要、候选队列和连续审核区；管理员退回候选时填写 `4–300` 字原因，发布缺少通过验证时接口返回 `409 OPTIMIZATION_VALIDATION_REQUIRED`。影响观察按标准化后的具体问题键计算“同一问题率”，缺少问题码时显示“口径不足”。
- 管理员分析链路已接入事件埋点和内容查看审计：`AnalyticsEvent` 记录注册、登录、进入私有页、访谈推进、日志生成/保存、完整日志生成/保存、评分保存等事件，`AdminAuditLog` 记录管理员查看会话/日志正文的行为
- 当前唯一生产主域名是 `https://dailylight.chat`；`dlight.cc.cd` 已于 `2026-07-20` 从 Vercel production aliases 中移除并正式废弃，后续生产部署、验收与回调统一使用 `dailylight.chat`。
- 访谈维度选择页通过 `CalendarMainGate` 的内容层纵向伸展完整承接可用视口，页面底部背景保持连续，修复内容区结束后露出全局木色背景的断层问题。
- 当前产品与事件中心生产链的聊天 Provider 统一使用 DeepSeek 官方 API 的 OpenAI 兼容接口：运行时 Provider 为 `openai`，默认地址为 `https://api.deepseek.com`；共享五维聊天模型由 `DEEPSEEK_MODEL` 提供。通用事件中心环境变量继续以 `deepseek-v4-flash` 作为兼容默认值。GI-088 v8r3r2 的 Ark Flash Preview 与前序 Ark 证据继续只读保留；官方 Pro 双合同开发配对和来源责任重划零模型候选均已封存，当前停止在速度 No-Go，未形成 Preview 或 Production 候选。`VOLCENGINE_ARK_*` 变量继续服务历史 Preview 兼容链，Production 生成式路径保持关闭。
- 生成式访谈事件中心已经具备事件级会话、可靠提交、失败恢复、Trace、事件日志生成编辑保存重开和发布隔离底座。`GI-065` 已把新会话产品范围收口为“理清想法”单角度，感受、关系和行动继续保留历史数据与代码兼容，新会话入口保持隐藏。
- `GI-067 / GI-068～074`、`GI-075～080` 和方法 `v1.0` 继续冻结。GI-087 保留为 GI-088 基础候选；GI-088 v1～v8r3r3 的真人结果、探针、提前结束、恢复、连续性、平台对照与 No-Go 继续承担历史证据。v8r2 的 P0／P1、Preview 和零调用初始化已经收口并保持只读；v8r3r2 的内容质量与兼容性通过，等待体验未达发布线；v8r3r3 可靠性门 No-Go。运行链根因对照确认官方 Pro 的模型档位稳定性为主因，完整状态输出职责为重要放大因素；官方 Pro 双合同开发配对以完整组 `53/64`、精简组原始 `38/64` 和两组延迟门失败封存技术 No-Go。来源责任重划随后以零模型 `15/15` 闭环，精简组反事实有效达到 `53/64`，速度继续 No-Go。板块 8 暂停，约 `200` 轮以上容量优化继续排除，Production 保持 `legacy + baseline`。
- v8r2 私有评测 schema 在原批次表之外新增调用账本、幂等操作、程序介入、人工修订、操作事件和不可变导出快照；`runOrdinal` 支持同一冻结候选的多次独立运行。旧 run 数据和旧 JSON 继续只读兼容，Production 数据库不进入本次迁移范围。
- 事件中心日志支持生成、编辑、700ms 自动暂存、正式保存、刷新恢复和通过当天事件标签重新打开；事件日志接口、Trace、反馈和九类漏斗埋点已接入，未新增数据库迁移。
- GI-066 使用 DeepSeek 官方 API 完成严格 `10×3` 与单角度自动 `8+2`，这些结果保留为历史技术证据；最新真人实聊因目标偏移、重要线索遗漏、同义重复和纠正后错误重规划判定为 `No-Go`，候选失效。Production 继续保持 `legacy + baseline`。
- 同一轮 production 排障中，已补齐 `20260521120000_add_admin_analytics_tables` migration，修复了 live 注册路径因 `AnalyticsEvent` 表缺失而出现的 `REGISTER_FAILED`。
- 普通 `/interview` 入口现在默认代表”今天的新记录入口”：本地按维度缓存的 session 和当前页面已经挂载的 live session，都只有在 `entryDate === 今天` 时才会被自动恢复；显式带 `entryDate` 的 deep link 仍只会恢复同一天的 session。访谈页正文区会显示”当前记录日期：YYYY-MM-DD”。
- 记忆系统（用户画像）已合并进 main：支持 pgvector 向量嵌入、AI 自动从访谈中提取用户模式、语义检索注入访谈 prompt、独立 `/profile` 页面查看和编辑画像；该功能由 `memoryEnabled` 设置项控制，默认关闭。
- `reflection` 在 `continue_current_event` 场景里新增了防回卷约束：如果上一轮已经问过“具体经历 / 对话”，且用户明确回答没有，继续深聊时不会再追同一字段，而会改问更低压的具体锚点，比如某个顾虑、画面、比较时刻或选择瞬间。
- 访谈 repair 协议已升级成稳定的服务端闭环：当用户输入“看不懂 / 太抽象 / 换一个 / 说简单点”等修问题表达时，系统会识别 `question_repair`，直接在服务端对当前问题做确定性重问，不再请求模型；repair 轮不会增加 `turnCount`、不会改写 snapshot、不会推进 round，也不会贡献新的完成进度。`reflection` 维度现在有专属 repair 模板，并且在用户已明确说“没有某段具体经历 / 对话”后，不会再回卷到 scene question。连续第 `3` 次 repair 会进入低压 choice，让用户改为“只补一句 / 换一个片段 / 先退出”。
- 记录日历的 month/week/day 三层已经落地：calendar 展示层读模型、`/api/calendar/day|week|month`、`/calendar` 月/周/日视图、以及进入访谈/日志的 deep link 都已完成。
- calendar / 当天整合日志 / 月分析的按天查询现在统一走 `Asia/Shanghai` 的整天时间窗口，不再用单个归一化时间点做精确匹配；同一天任意时刻保存的维度日志都会归到正确 `entryDate`。
- 当天整合日志已经落地：桌面端从右侧「今日日志」面板底部的 `生成日志 / 更新日志 / 查看日志` 进入，移动端从对话区顶部的【完整日志】快捷按钮进入；生成或更新会基于当前 `entryDate` 已保存的维度日志整理章节、直接保存并打开当天日志工作区。
- 当天整合日志的来源集合现在会随同日新增 `saved` 维度日志或已有来源更新时间变化而进入 `stale`；来源签名按“同一天每个维度最新一篇 `saved` 日志”计算，重新生成后章节数会与当天真实 `saved` 维度集合重新对齐。
- 完整日志工作区离开前会先保存未自动暂存的当天日志编辑；从完整日志切回访谈或切换访谈维度时，不会静默丢失 700ms autosave 触发前的输入，也不会让新维度被卡在完整日志工作区背后。
- `/calendar` 顶部导航中区现在会承接 month/week/day 的全局切换、前后翻段、回到今天和实时摘要；正文不再重复放一套导航。
- 顶部导航栏当前已经统一成全宽暖色工具栏：不再作为居中大卡片悬浮，calendar toolbar、访谈维度条和主导航都直接平铺在 header 里，不再额外套内层方框；主导航当前页用贴近文字的暖棕实线下划线表达，选中项字号略大；访谈和 calendar 业务控制组用 `｜` 做轻量分隔。主导航不再包含【首页】项，点击左侧【Daily Light】品牌标识可返回首页。
- 带 `entryDate` 的访谈页里，header 当前选中维度会优先显示 live session 的实时轮次和进度圈；其余维度，以及切到当天整合日志工作区后的胶囊状态，继续以 `/api/calendar/day` 的 day snapshot 为准。只要某个维度当天已经有 `saved` 日志，胶囊会优先显示 `已完成`，即使同一天还有继续中的 session。
- opening-only 空会话（只有 opening assistant、`turnCount = 0` 且没有用户回复）不再把 header 当前维度、calendar 当天状态或相关统计点亮成“进行中”；这类空开场 session 仍会保留在库里，但不会继续污染当天状态。
- 如果当前 active choice 是 `boundary_insufficient` 或 `dimension_redirect`，当前选中维度的 live progress 会被压在 `88%` 以下，不会被历史 `draftGenerationUnlocked` 顶回 ready 状态。
- 首页已重构为品牌广告页，主线为“在日常里照见自己 -> 回顾一天显露纹理 -> 五维认识自己 -> 日有所记心有所归”；文案与图片配置集中在 `src/content/homepage.ts`，当前已接入 `public/homepage/*` 本地图片，并把 Hero / 痛点 / 日志 / 沉淀图片区统一收成“单行标题 + 图片本体”的去卡片化广告片布局，首页木纹背景也已调成上浅下深。
- `/analysis?month=YYYY-MM&section=trends|dimensions` 记录分析页为量化趋势与五维记录两段纵向 scroll + 顶部锚点切换；量化趋势走 `GET /api/analysis/range`（本周/本月/自定义），五维记录走 `GET /api/analysis/month`。旧 `overview / score / rhythm` 归一到 `trends`，旧 `insights / correlation / review` 归一到 `dimensions`。幸福 8 要素评分录入位于 `/interview`「当天评分」工作区。
- 全站视觉已在 `2026-06-12` 收敛为「单层卡片制」：创意与页面形态见 **`DESIGN.md`**；容器层级、圆角/边框 token 与共享原语见 **`docs/design/ui-conventions.md`**（`Surface / Card / SectionHeading / Divider / ActionButton` 在 `src/components/ui/`）。分析页、日历周/日视图、设置与管理员页面已按此重构。
- 全站交互已在 `2026-07-18` 收敛到共享流动体验：按钮和交互卡片提供即时按下反馈；segmented 使用可重定向 spring；画像与分析分页支持横向 swipe；移动端上下文工具栏可横向滚动；日志书页、菜单和确认弹窗具备连续进出场、键盘操作与焦点恢复；系统统一响应 reduced motion、reduced transparency 和增强对比度偏好。
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
- `2026-06-13` 访谈页已按 v3 原型收束为“全屏对话 + 覆盖式书页”：单维度日志通过右侧书签打开，不再挤压对话区；保存成功后书页自动收回，不再在对话框上方弹出保存成功模块；访谈完成后不再显示结束卡，输入框保持可用，用户继续输入时会自动重开同一会话；切换维度会先静默持久化当前会话，不再弹原生离开确认。
- 访谈页通过 header 主导航切换到其他站内页面时直接完成路由切换；刷新或关闭访谈页面时继续由浏览器离开保护保存会话恢复标记。
- `2026-06-14` 访谈页改为“全屏对话（左）+ 常驻今日日志面板（右）”双栏：右侧面板全程显示五维折叠块，可在任一维度回看其他维度日志；单维度生成按钮改名 `生成{维}维度日志`；完整日志的生成、更新、查看都收口到面板底部的日级按钮 `生成日志 / 更新日志 / 查看日志`，点击后整页跳转到完整日志页。header 不再有【完整日志】和【回到访谈】按钮，回访谈靠点维度胶囊；完整日志页改为只读 + 编辑，仅在改了正文后出现【保存修改】。
- 已保存的维度日志或当天整合日志再次编辑时，会先回到 `draft`；只有用户点击“保存修改”后才重新成为正式保存版本。
- 历史 `choiceKind` assistant turn 在刷新 / 恢复后仍保留在 transcript 中；但只要当前正在显示 inline choice card，聊天记录里会先隐藏所有 choice turn，避免和卡片重复。只有卡片结束后，最终停在 transcript 末尾的历史 choice 才会继续可见。
- `gratitude` 的 `stitched_moments` supporting-scene 质量门现在只接受仍保留明确照顾动作和足够场景锚点的自然压缩：把“请我吃冰淇淋，还问要不要喝水”写成“请我吃冰，还问我渴不渴”仍可通过，但“后来她想吃冰，我陪她去买了”这类语义反转会继续被拦住。
- `respond/stream` 会先缓冲模型候选问题，完成服务端协议检查、纠偏和 fallback 后，再分块发送最终摘要与问题；用户流式阶段看到的文本与最终保存的助手消息保持一致。
- `respond/stream` 在 repair 模式下不再依赖模型流式输出：服务端会直接返回确定性 `turn -> summary -> question -> session` 事件序列，不会先进入 provider `thinking` 流程。

## 当前产品状态

### GI-088 板块 7 当前交接（2026-08-13）

- v8r3r2 的 Golden 32＋8、双恢复 `10/10`、真人 `4＋2` 内容结论与 v8r3r3 的可靠性 No-Go 继续只读保留。
- A～E 根因对照已经封存；官方 Pro 完整合同成为质量可用方向，精简合同显示出降低空内容、等待和 Token 的潜力。
- 官方 Pro 完整合同与可执行精简合同＋状态投影的同样本开发配对已封存技术 No-Go；人工配对裁决源未生成，隐藏准入未启动。板块 8 暂停，Judge 20＋20 后置，Production 保持 `legacy + baseline`。
- 来源责任重划零模型候选已完成 `15/15` 回放并封存；精简组反事实有效 `53/64`，原延迟门继续失败。下一单一主要因素建议讨论 Pro 等待优化，D27、D28 保持待授权。

### 已完成
- 多维度访谈入口、维度切换静默持久化与本地 session 恢复
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
- 日志工作区：手动生成、编辑、保存；单维度日志以覆盖式书页打开，保存后自动收回并进入右侧常驻「今日日志」面板，标题当前固定单行显示，最大 `16` 字
- 今日日志面板：访谈页右侧常驻五维折叠块 + 日级 `生成 / 更新 / 查看日志` 按钮，数据走 `GET /api/daily-journal/board?date=`（只读聚合）
- 当天整合日志：只使用已保存维度日志，生成后进入独立草稿，可自动保存并正式保存；正文上限 `6000` 字
- 当天整合日志来源、calendar/day 聚合和 analysis 月范围统计统一按 `Asia/Shanghai` 的整天时间窗口取数，而不是按单个时间点精确匹配
- 五个维度的日志标题统一经过语义短标题治理，不再把长事件句机械截断成标题；joy 会拦截 `一下被带轻 / 象征意义` 这类伪中文或理论词标题，早起/多出时间/准备感场景应收束为 `清醒地开始` 这类自然短标题
- 用户表达“不想继续 / 不要再追问 / 直接生成 / 总结日志 / 整理成日志”等边界或日志整理意图时，边界优先级高于槽位完整度；材料足够则 partial 收束，材料不足则给低压选择
- 访谈提交错误已经结构化；`respond/stream` 与 `respond` 会返回带 `code / title / message / resolution / retryable / action / requestId` 的错误说明，前端展示原因、解决方案和错误码
- 用户回复持久化与恢复：`InterviewUserTurn`、输入草稿、客户端 outbox、SSE `turn` 确认、`pendingUserTurn` 恢复和 `resume_turn` 继续生成
- 日志生成已支持阶段式反馈；如果当前草稿已经是最新版本，再次点击会直接复用，不再重复等待
- 访谈页开发辅助：可清除“当前维度”的本地对话恢复记录并直接重开一轮
- `snapshotData` / `payload` 驱动的多维度结构化数据面
- `entryDate` 驱动的会话日期归属与补写过去日期基础
- `CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord` 读模型与对应服务端聚合链路
- `GET /api/calendar/day|week|month` 公开日历查询接口
- `/calendar?view=month|week|day&date=YYYY-MM-DD` 月/周/日视图页面
- `/analysis?month=YYYY-MM&section=trends|dimensions` 记录分析页（两段 scroll + 锚点切换；`GET /api/analysis/range` 量化趋势 + `GET /api/analysis/month` 五维记录）
- `DailyHappinessScore` 独立数据模型、Prisma migration、zod schema、repository 映射、`PUT /api/happiness-score` 保存接口、访谈页独立评分工作区；分析页趋势段为只读读数台
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
DIRECT_URL="postgresql://zouzhijie@localhost:5432/happiness_system_codex?schema=public"
AI_RUNTIME_CONFIG_SECRET=""            # 用 openssl rand -base64 32 生成；用于加密数据库里的 provider API Key
AI_PROVIDER="openai"                    # 当前聊天 Provider：DeepSeek 官方 API 的 OpenAI 兼容接口
INTERVIEW_INTENT_V2_MODE="enforce"      # enforce 是当前正式行为；legacy 保留为即时回退档位
INTERVIEW_REGENERATION_ENABLED="true"   # false 时暂停“换个问法”与版本入口；已有会话继续沿当前路径完成
INTERVIEW_EVENT_CENTERED_MODE="legacy"  # legacy / optional / event_centered / event_recovery
INTERVIEW_EVENT_CENTERED_STRATEGY="baseline" # 仅板块 8 Preview 才考虑 generative
EVENT_CENTERED_GENERATIVE_MODEL="deepseek-v4-flash" # 通用事件中心兼容默认值；GI-088 v8r1／v8r2 使用独立 V4 Pro 运行策略
DEEPSEEK_API_KEY=""                     # 当前聊天 Provider 的 key
DEEPSEEK_MODEL="deepseek-v4-pro"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
EVENT_CENTERED_JUDGE_DEEPSEEK_MODEL="deepseek-v4-pro"
EVENT_CENTERED_JUDGE_TIMEOUT_MS="20000"
VOLCENGINE_ARK_API_KEY=""               # 可选：历史回退兼容
VOLCENGINE_ARK_MODEL=""                # 可选：历史回退兼容
VOLCENGINE_ARK_ENDPOINT_ID=""          # 兼容旧路径：项目绑定 endpoint；只有确认 key 能访问该 endpoint 时再用
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3" # 可选：历史回退兼容
APP_URL="http://localhost:3000"
VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID=""  # embedding 模型（doubao-embedding），用于记忆系统向量嵌入
ADMIN_USERNAMES=""                       # 逗号分隔的管理员用户名白名单，例如 "alice,bob"
```

GI-088 私有评测 Preview 使用独立的环境合同和评测 schema，不纳入普通本地快速启动。配置时以 [`.env.preview.example`](.env.preview.example) 和 [`Operator Runbook`](docs/operator-runbook.md#212-gi-088-私有真人评测工作台) 为准；Production 继续不配置 GI-088 开关。

### 2.2 AI 运行配置中心

- 管理员入口是 `/settings/ai-runtime`，用于维护聊天能力和向量嵌入能力两条独立运行线的草稿、测试、发布和历史回滚。
- 当前运行时优先级固定为：数据库已发布配置 > 环境变量回退配置。
- 发布流程固定为：保存草稿 -> 执行连通性测试 -> 发布。修改草稿后，旧测试结果立即失效。
- 发布后，从下一次 AI 请求开始生效；不需要重新部署。
- 如果数据库配置不可用，系统会改用环境变量配置。

`AI_RUNTIME_CONFIG_SECRET` 的约束：

- 它是本系统自己的加密主密钥，不是 OpenAI、Anthropic 或 Ark 的 API Key。
- 生成命令：`openssl rand -base64 32`
- 部署要求：同一个环境的所有实例必须使用完全相同的值，且不能提交到 git。
- 如果修改了这个值，旧密文会解不开。恢复方式只有两种：把密钥改回原值，或让管理员重新录入所有 provider API Key。

管理员操作要点：

- 保存后不会再次明文显示 API Key。
- 回滚入口在历史版本表；回滚会复制历史版本并重新发布，不会原地改旧记录。
- 当前正在使用数据库配置还是环境变量配置，可以在 `/settings/ai-runtime` 状态卡里确认，也可以在启用受保护的 `/api/debug/runtime-env?probe=1` 后查看 `ai.chat.source` 与 `ai.embedding.source`。
- 如果要批量采集“保存草稿 / 测试 / 发布 / 回滚 / runtime readback”证据，可以配置管理员与 provider 环境变量后运行：

```bash
node scripts/admin-ai-runtime-smoke.mjs
```

### 2.1 数据库环境约定

- 本地开发默认继续使用 `DATABASE_URL` + `npx prisma db push`，适合快速同步 schema。
- 共享开发、staging、production 不再使用 `db push`，统一执行 `npx prisma migrate deploy`。
- 应用运行时连接使用 `DATABASE_URL`；如果目标环境接了 pooler，`DATABASE_URL` 应指向 pooler URL。
- Prisma migration 和需要直连的运维动作使用 `DIRECT_URL`；如果目标环境接了 pooler，`DIRECT_URL` 应指向 direct URL。
- 启用记忆系统前，先确认 pgvector migration 已成功执行；`MemoryFact.embedding` 列和 extension 没准备好时，不要打开 `memoryEnabled`。当前 `2048` 维 embedding 不提供 ANN 向量索引，运行时会接受顺序扫描或降级检索。

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

如果你是在共享环境或准备上线，请改用：

```bash
npx prisma migrate deploy
```

### 4. 启动开发服务器

```bash
npm run dev
```

默认地址：
- `http://localhost:3000`

### 4.1 首版账户体系说明

- 首版账户标识是 `username`，不是邮箱，也不是手机号
- 首版不支持找回密码，UI 只提示用户妥善保管密码，不提供伪入口
- 管理员权限当前也基于 `username` 白名单判断，环境变量名为 `ADMIN_USERNAMES`
- 核心认证页面与接口：
  - 页面：`/login`、`/register`、`/settings/account`、`/legal/terms`、`/legal/privacy`
  - API：`/api/auth/register`、`/api/auth/login`、`/api/auth/logout`、`/api/auth/session`、`/api/auth/delete-account`
  - 管理员页面：`/admin/analytics`
  - 管理员 API：`/api/admin/analytics/*`
  - AI 质量页面：`/admin/ai-quality`
  - AI 反馈 API：`/api/ai-feedback/*`
  - AI 质量管理员 API：`/api/admin/ai-quality/*`
  - AI 质量 Cron：`/api/cron/ai-quality/evaluate`、`/api/cron/ai-quality/iterate`

事件中心 MVP API：

  - `POST /api/interview/event-centered/session/start`
  - `GET /api/interview/event-centered/session/[id]`
  - `POST /api/interview/event-centered/session/respond/stream`
  - `POST /api/interview/event-centered/session/turn`
  - `POST /api/interview/event-centered/journal/generate`
  - `GET/PATCH /api/interview/event-centered/journal/[id]`
  - `POST /api/interview/event-centered/journal/[id]/save`

### 5. 回归检查

访谈意图评测、数据集建设和上线门槛统一以
[访谈意图评测与上线事实源](docs/interview-intent-evaluation-source-of-truth.md)
为依据。后续新增案例、调整门槛或改变发布流程时，先更新该文档的当前阶段、决策记录和新输入记录。

```bash
npx tsc --noEmit
npm test
```

截至 `2026-08-04`，最近一份完整候选验证记录为：
- `npm test`（Vitest）以主仓测试集为准；真实文件数与测试数以最近一次全量绿灯记录为准
- GI-066 阻断修复候选：`npm test` = `268` 个测试文件、`2541/2541` 个用例通过；该候选随后因真人体验 `No-Go` 失效，数据只作为历史技术证据。
- `npm run lint` 通过，`0 error`，保留 `46` 条仓库既有 warning
- `npx tsc --noEmit` 通过
- `npm run build` 通过，保留既有 ESLint warnings
- `npx prisma validate`、隔离库 migrate status 与 `git diff --check` 通过
- GI-066 严格 `10×3`：动作、方向和完整无问题均为 `30/30`，重复选题错误 `0`
- GI-066 自动 `8+2`：主链 `8/8`、日志闭环 `8/8`、两条冒烟通过、运行降级 `0`
- AI 质量发布与效果观察专项验证：`10` 个测试文件、`30` 个测试通过
- Vitest 当前默认只扫描 `tests/**/*.test.{ts,tsx}`，并排除 `.worktrees/**` 与 `.claude/worktrees/**`，避免历史 worktree 噪声污染主仓结果

### 6. 首条托管平台主线

当前默认托管平台路线固定为 `Vercel`。

- preview 环境变量合同：`.env.preview.example`
- production 环境变量合同：`.env.production.example`
- 部署与 smoke source of truth：`docs/vercel-preview-production-lane.md`
- preview 部署后的分流：
  - protected preview：按 `docs/vercel-preview-production-lane.md` 里的 `vercel-curl + product-smoke.mjs` 路径执行
  - non-protected preview：可继续走 `SMOKE_BASE_URL="https://your-preview-url.vercel.app" npm run smoke:public`
- 当前 `product-smoke.mjs` 默认复用固定的 `preview_acceptance` 验收账号，仅在账号首次缺失时注册；可通过 `PRODUCT_SMOKE_USERNAME / PRODUCT_SMOKE_PASSWORD` 覆盖
- 当前 `product-smoke.mjs` 只自动覆盖最小 `auth/session/start/invalid_entry_date`
- 更深的 `joy -> draft generate -> draft save` 仍属于 controller 手工 deep-chain 补证，不是该脚本当前自动化覆盖
- 事件中心专项命令包括 `npm run eval:event-centered:batch-b` 与 `npm run eval:event-centered:generative`；板块 7 的四角度 smoke、baseline recovery 和事件日志探针使用 `scripts/run-board7-*.ts`，证据集中在 `artifacts/generative-interview-board7/2026-08-02/`
- 事件中心当前产品状态以 [`生成式访谈重构总 Map`](docs/generative-interview-refactor-map.md) 为准；板块 6 当前评测资产与开放校准见 [`04j｜生成式质量评测 v1`](docs/technical/interview-event-centered/04j-generative-quality-evaluation-v1.md)，当前已封存证据入口见 [`GI-088 来源责任重划零模型候选`](artifacts/generative-interview-board7/2026-08-13-gi088-compact-source-responsibility-v1/README.md)，职责边界与状态投影见 [`07｜板块 7 专项`](docs/technical/interview-event-centered/07-board7-model-led-semantic-implementation.md)，双合同配对、运行链根因对照、v8r3r3 No-Go、v8r3r2 内容质量、v8r2 评测底座与 v8r1 事故继续作为历史证据，板块 8 Preview 与 Production 授权边界见 [`04p`](docs/technical/interview-event-centered/04p-board8-preview-go-no-go-production-authorization.md)。
- production URL contract 与 AI provider 诊断 lane 走 `docs/vercel-preview-production-lane.md` 里的 `runtime-env-readback.mjs + /api/debug/runtime-env`；它和公开 smoke 分开，默认保持关闭，只在短时验证窗口中临时打开
- `/api/transcribe` 当前仍是关闭态，不纳入公开预发布能力面

## 常用命令

```bash
npm run dev
npm test
npm run lint
npm run smoke:public -- http://127.0.0.1:3000
npm run acceptance:ai-quality:seed
node scripts/product-smoke.mjs joy 2026-05-19
node scripts/runtime-env-readback.mjs https://your-target-host runtime
npx tsc --noEmit
npx prisma db push
npx prisma migrate deploy
```

## 文档导航

- 新会话五分钟导航：`docs/README.md`
- 项目级 agent 说明：`AGENTS.md`
- 设计系统总纲：`DESIGN.md`（创意方向、页面形态、Do/Don't）
- 容器与 token 工程规范：`docs/design/ui-conventions.md`（DESIGN.md 附录）
- 当前架构：`docs/architecture.md`
- 访谈功能架构图、主链时序图与节点图谱：`docs/diagrams/README.md`
- 当前 API 面：`docs/integration-guide.md`
- 本地排障与运行手册：`docs/operator-runbook.md`
- AI 评估、反馈与自迭代闭环：`docs/ai-quality-loop.md`
- 托管平台部署主线：`docs/vercel-preview-production-lane.md`
- 当前阶段 handoff：`docs/handoff.md`
- 评测资产总入口：`artifacts/README.md`
- 生成式访谈当前状态与讨论位置：`docs/generative-interview-refactor-map.md`
- 板块 6 当前评测与校准：`docs/technical/interview-event-centered/04j-generative-quality-evaluation-v1.md`
- GI-088 当前已封存证据入口：`artifacts/generative-interview-board7/2026-08-13-gi088-compact-source-responsibility-v1/README.md`
- GI-088 当前实施专项：`docs/technical/interview-event-centered/07-board7-model-led-semantic-implementation.md`
- GI-088 v8r2 历史底座与行政收口：`artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md`
- GI-088 v8r2 已完成实施合同：`docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md`
- GI-088 v8r1 事故与部署时快照：`artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/README.md`
- GI-088 v1 历史真人复盘：`artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v1/README.md`
- GI-087 “共同任务＋当前探查”候选基线与 GI-088 上下文资格审计：`artifacts/generative-interview-board7/2026-08-07-board7b-working-task-v1/README.md`
- GI-086 DeepSeek Thinking 能力校准历史：`artifacts/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/README.md`
- GI-085 semantic-frame-first v1 回归结果与根因：`artifacts/generative-interview-board7/2026-08-07-board7b-semantic-frame-v1/README.md`
- 板块 5 冻结产品输入：`docs/technical/interview-event-centered/05-board5-stability-user-control-and-interaction-scope.md`
- GI-067 七批次架构与冻结结论：`docs/technical/interview-event-centered/04x-board4-gi067-interview-question-strategy-global-framework.md`
- GI-074 评测体系与下游交接：`docs/technical/interview-event-centered/04x-07-evaluation-preview-and-handoff.md`
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
- `src/server/services/auth/admin-access.ts` 负责管理员白名单鉴权；`src/app/settings/page.tsx` 与 `src/components/auth/settings-account-panel.tsx` 负责设置页管理员入口显隐。
- `src/app/admin/analytics/page.tsx`、`src/components/admin/admin-analytics-shell.tsx`、`src/features/admin-analytics/*`、`src/server/services/admin-analytics/admin-analytics.service.ts` 与 `src/server/repositories/admin-analytics.repository.ts` 已落地管理员数据分析工作台、筛查/下钻 URL 状态、真实读模型查询和管理员审计日志。
- `src/app/api/admin/analytics/*` 已公开管理员分析接口：总览、漏斗、留存、质量、候选用户和内容级下钻；所有接口都要求已登录且命中 `ADMIN_USERNAMES`。
- `src/app/admin/ai-quality/page.tsx`、`src/components/admin/admin-ai-quality-*`、`src/features/ai-quality/*`、`src/server/services/ai-quality/*` 与 `src/server/repositories/ai-*` 已落地 AI 质量候选、真实证据、回放验证、全量发布、回滚和七天效果观察。
- `AIPromptRelease.validationId` 将线上版本绑定到最近通过的候选验证；System Prompt 使用 `+opt:{candidateId}`，Few-shot 使用 `+fs:{fingerprint}` 归因线上 Trace。
- `AIOptimizationCandidate.reviewReason` 保存候选拒绝原因；对应 migration 为 `20260720153000_add_ai_optimization_review_reason`。
- `npm run acceptance:ai-quality:seed` 默认只写本地数据库；远程隔离测试库需要显式设置 `ALLOW_REMOTE_AI_QUALITY_ACCEPTANCE_SEED=I_UNDERSTAND`，production 环境会主动终止。
- `src/server/services/calendar/calendar.service.ts` 与 `src/server/repositories/calendar.repository.ts` 负责 `day / week / month` 记录读模型查询；`src/app/api/calendar/*` 已公开这三条只读 HTTP 路由。
- `src/features/interview/event-centered-release.ts` 与 `src/features/interview/event-centered/generative-release.ts` 负责事件中心发布模式和策略分流；`legacy / optional / event_centered / event_recovery` 分别表达默认入口与事件中心写入范围。
- `src/server/services/interview/event-centered-interview.service.ts` 负责事件中心问答、两段式生成和 baseline 快速降级；`src/server/services/interview/journal-event-entry.service.ts` 与 `src/app/api/interview/event-centered/journal/*` 负责事件日志生成、来源快照、编辑、暂存、保存和恢复。
- `src/server/services/interview/event-centered-analytics.service.ts` 负责事件中心九类漏斗埋点；事件中心生成消息通过 `generationTraceId` 接入现有 AI 反馈链路。
- `src/app/calendar/page.tsx` 与 `src/components/calendar/*` 已落地 month/week/day 路由分发、header 中区的 calendar 控制条、工作区壳层、月视图双栏检查面板、周视图 7 天对比板与日视图五维紧凑操作台。
- `src/components/shared/site-header.tsx` 现在会在客户端测量真实 header 高度，并把结果写回 `--site-header-viewport-offset`；calendar / analysis / settings 这类首屏工作区会按这个真实高度扣减剩余视口，而不是依赖固定 `4rem`。
- `src/app/analysis/page.tsx`、`src/components/analysis/analysis-shell.tsx`、`src/features/analysis/view-state.ts`、`src/features/analysis/date-range.ts`、`src/features/analysis/aggregate-trends-range.ts`、`src/features/analysis/aggregate-month.ts`、`src/server/services/analysis/analysis.service.ts` 与 `src/server/repositories/analysis.repository.ts` 已落地记录分析入口、`trends / dimensions` 两段 scroll + scroll spy、旧 section keys 归一化、`GET /api/analysis/range` 量化趋势读数台、`GET /api/analysis/month` 五维记录和 `generateMonthNarrative` 占位叙事。
- `src/features/happiness-score/schema.ts`、`src/features/happiness-score/types.ts`、`src/features/happiness-score/presentation.ts`、`src/components/interview/happiness-score-entry.tsx`、`src/server/services/happiness-score/happiness-score.service.ts`、`src/server/repositories/daily-happiness-score.repository.ts`、`src/app/api/happiness-score/route.ts` 与 `prisma/migrations/20260503143000_add_daily_happiness_score/migration.sql` 已落地幸福 8 要素日评分的数据模型、zod schema、展示顺序配置、访谈页独立评分工作区与保存接口（非未来日期可保存）。
- `src/features/calendar/presentation.ts` 现在是 calendar 状态色、维度标识和 badge / surface / marker class 的单一视觉真相源。
- `src/features/calendar/toolbar.ts` 负责把当前 `view/date` 投影成 header 标题、前后翻段和摘要 chip。
- `fulfillment`、`reflection`、`improvement` 与 `gratitude` 已在 joy-first 服务壳子内完成理论对齐。
- `/api/transcribe` 当前只是占位接口，返回模拟 transcript。
- 事件中心板块 4 已冻结 `GI-067 / GI-068～074`，板块 5 已冻结 `GI-075～080` 六类规则。GI-088 v0～v8r3r3 的失败、诊断与真人结论继续作为历史证据；v8r3r3 因最终可见 `50/96` 判定 `No-Go`。运行链根因对照、官方 Pro 双合同开发配对技术 No-Go 与来源责任重划零模型候选已经封存；板块 7 当前为“来源责任闭环、速度 No-Go”，板块 8 暂停。Production 保持 `legacy + baseline`。
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
- 如果从单维度日志书页切到完整日志入口，前端会先保存未暂存编辑或取消正在生成的 draft，再切换主工作区。
- 如果从完整日志主区返回访谈，或在完整日志主区切换访谈维度，前端会先 flush 当天日志的未自动保存编辑；保存失败或内容非法时会留在完整日志工作区并展示错误。
- 结构化线索仍然存在于系统内部，用来驱动进度、收尾和日志生成，但不会直接展示给用户。
- `thinkingSummary` 是用户可见的浅色思路层，用来呈现 AI 对用户回复的理解和处理焦点；五个维度都会通过 `summary` SSE delta 流式展示这层内容，并且不能写成第二个正式追问。
- 如果模型给出的 `thinkingSummary` 只是浅复述、语气不对或写成第二个追问，服务端会基于同一层维度语义解释重写它，不会直接把浅复述透传给用户。
- `respond/stream` 当前统一输出经过服务端检查的最终摘要与问题，分块过程保持最终文本的空格和换行；模型候选增量只在服务端内部累计。
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
