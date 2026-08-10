# 04f｜Batch B 前端复用与 A 方案接入审查

最后更新：`2026-07-22`

状态：`历史前端接入审查；已实现能力继续作为兼容底座，当前产品策略与验收状态以 GI-067 和总 Map 为准`

当前交接：[04w｜GI-067 “理清想法”提问策略第一性原理重构](./04w-board4-gi067-thought-question-strategy-first-principles.md)。本文保留当时的四角度前端方案、复用边界和接入事实，不承担当前候选或发布状态判断。

## 1. 审查结论

事件中心的正式界面以现有 `EventCenteredInterviewWorkspace` 为唯一接入点。它已经具备当天事件标签、三阶段进度、对话主区、输入框、右侧事件日志抽屉、稳定深链和事件日历读取能力。A 方案在对话流中加入两次检查点和自然成果纸笺，能够延续当前暖纸色工作台与“大面积对话”的核心体验。

正式接入直接消费服务端的完整工作台读模型和统一流式接口。前端只保留输入草稿、流式预览、当前面板与临时焦点等展示状态；阶段、角度、进度、允许动作、成果、回复版本和失败续接均以服务端返回为准。

## 2. 直接复用清单

| 能力 | 复用位置 | A 方案中的职责 |
|---|---|---|
| 事件工作台骨架 | `src/components/interview/event-centered/event-centered-interview-workspace.tsx` | 保留事件标签、加号、三阶段进度、对话区、输入框和右侧日志抽屉；在此组件内接入 Batch B 子组件。 |
| 事件标签与稳定深链 | `EventTab`、`buildEventCenteredWorkspaceHref` | 继续以根会话为标签身份，支持当天多件事跳转与日志抽屉深链。 |
| 暖纸色页面原语 | `src/components/ui/Surface`、`Card`、`Divider`、`SectionHeading`、`ActionButton` | A 的检查点纸笺使用一层 `Card`，角度选择和主次动作使用既有按钮层级，遵守单层卡片制。 |
| 对话气泡与流式呈现模式 | `src/components/interview/interview-shell.tsx` 的 `MessageBubble`、`ConversationMessage` | 抽取可供事件中心调用的消息组展示能力：自然理解为浅色旁注，自然回应和问题为正式对话内容。现有五维调用保持原行为。 |
| 问题修复、纠正与回复版本 | `src/components/interview/interview-response-regeneration.tsx` 的交互协议与 `ActionButton` | 事件中心采用薄适配层承接同一套问题修复、纠正、三版本切换、键盘与触控语义；动作改由统一流式接口提交。 |
| 输入可靠保存与失败续接体验 | `src/features/interview/user-turn-storage.ts`、`InterviewShell` 的 outbox 交互模式 | 复用“先保留输入、收到 `turn` 确认后清空、失败时继续生成”的交互原则；事件中心以 `rootSessionId + activeBranchSessionId` 的专属 sessionStorage 键保存草稿和outbox，避免写入五维维度缓存。 |
| 小屏日志书页 | `InterviewShell` 的日志抽屉拖动、关闭与动画模式 | Batch B 的 MVP 范围为桌面端，当前使用可并行阅读的日志侧栏；后续需要小屏交付时，再复用底部 sheet、拖动关闭与焦点圈定。事件日志正文继续标记为批次 C 待接入。 |
| 事件日历读模型 | `src/components/event-calendar/event-calendar-workspace.tsx`、`src/features/event-calendar/calendar-client.ts` | 保留事件数量、顺序、继续访谈与日志深链口径；工作台完成一次动作后刷新当天事件缓存。 |

## 3. 正式接入边界

### 3.1 组件组织

`EventCenteredInterviewWorkspace` 继续负责入口、会话加载、地址同步、当天事件标签、日志抽屉和页面级错误。

在其内部增加以下轻量子组件：

1. `EventConversation`：渲染完整活动分支消息、自然理解、自然回应、问题、流式占位和回复版本。
2. `EventCheckpointPaperNote`：A 方案的第一、第二检查点纸笺，展示自然线索、四角度、继续、退出与批次 C 日志占位。
3. `EventAngleChooser`：只在服务端允许选择角度时展示四个平级选项。
4. `EventProgressSummary`：直接展示服务端 `dialogue.progress`，避免客户端重复推导阶段百分比。
5. `EventTurnController`：统一处理发送、按钮动作、SSE、outbox、恢复、版本切换与错误。

这些组件属于事件中心目录，避免把事件阶段、四角度文案或事件状态写入 `InterviewShell`。

### 3.2 服务端契约

正式前端使用以下现成接口：

| 场景 | 接口与字段 |
|---|---|
| 打开或恢复工作台 | `POST /api/interview/event-centered/session/start`、`GET /api/interview/event-centered/session/[id]`，读取完整 `EventCenteredWorkspaceSession`。 |
| 发送原话、选择事件或角度、纠正、继续、退出、问题修复、重新生成、切换版本、失败续接 | `POST /api/interview/event-centered/session/respond/stream`。请求使用 `rootSessionId`、`clientTurnId`、活动分支和基础消息序号。 |
| 流式显示 | 复用 `turn`、`phase`、`delta`、`session`、`error` 事件；`session` 到达后以其完整工作台替换临时预览。 |
| 当天事件标签 | `GET /api/event-calendar/day`，继续按 `daySequence` 排序。 |

当前工作台中的 `/session/turn` 仅承担首段原话保存，Batch B 正式界面改用统一流式写入接口。`localSavedTurn` 只可作为请求确认前的本地预览，消息列表、进度和恢复结果统一读取完整工作台。

### 3.3 A 方案映射

| A 方案元素 | 数据来源 | 可执行动作 |
|---|---|---|
| 第一检查点纸笺 | `dialogue.checkpoint.kind = first` 与自然理解 | 继续补充、选择四角度、退出；日志按钮展示 Batch C 待接入状态。 |
| 角度选择 | `dialogue.availableAngles` 与 `dialogue.allowedActions` | `select_exploration_angle`。 |
| 中度复盘对话 | `messages[].assistantPayload`、`dialogue.activeAngle`、`questionOpportunityCount` | 普通回复、问题修复、纠正理解、版本切换。 |
| 第二检查点纸笺 | `dialogue.checkpoint.kind = second` 与 `dialogue.outcomes` | 选择剩余角度、继续深入、纠正线索、退出；日志按钮仍为批次 C 占位。 |
| 深度陪伴 | `phase = deep_companionship` 与最新角度成果 | 用户直接补充；无问题回应沿用普通消息组，不额外制造空白卡片。 |
| 三阶段进度 | `dialogue.progress` | 纯展示，当前阶段具备选中态和百分比。 |

## 4. 五维隔离与发布边界

1. `src/app/interview/page.tsx` 已按 `mode=event-centered` 路由到事件工作台；五维链路继续由 `InterviewShell` 承接。
2. 事件中心状态、接口、Prompt 和前端子组件保持在 `event-centered` 命名空间；五维 `useInterviewStore`、维度缓存和五维日志面板保持原职责。
3. `INTERVIEW_EVENT_CENTERED_MODE` 继续作为发布门：Production 保持 `legacy`，内部 Preview 使用 `event_centered`；`event_recovery` 保留已产生事件的只读恢复入口。
4. 日历通过 `getCalendarReadRoute` 区分 `legacy / event_centered / dual`。同一天的两类记录保持独立阅读入口，不合并为同一统计或工作台。
5. Batch B 只展示事件日志的状态占位。事件日志正文、编辑保存和当天完整日志在批次 C 接入，避免提前连入五维日志接口。

## 5. 可访问性与小屏风险

| 风险 | 接入要求 |
|---|---|
| 当天事件标签使用 `tablist` | 已补齐左右方向键、Home、End、焦点移动与关联 `tabpanel`；当前点击切换继续保留。 |
| 检查点纸笺中的动作较多 | 按主动作、次动作、轻动作排序；焦点顺序与视觉顺序一致，避免按钮组在窄屏出现阅读顺序跳跃。 |
| 回复版本与问题修复菜单 | 直接复用现有菜单的箭头键、Escape、焦点返回、视觉视口定位和最小触控尺寸。 |
| 事件日志侧栏 | 桌面打开后焦点进入侧栏，收起后回到触发按钮；当前侧栏允许与对话并行阅读。后续小屏 sheet 需要补焦点圈定、Escape 与拖动关闭。 |
| 输入法与发送 | 发送键处理中文输入法组合状态；Shift+Enter 换行；流式生成中保留可见的禁用原因和可靠接收状态。 |
| 流式自然理解 | 使用单一礼貌播报区，避免每段 delta 反复打断读屏；最终自然回应到达后提供完整可读内容。 |
| 三阶段进度 | 桌面保持三列；小屏使用紧凑三列或可横向浏览的进度带，百分比、当前阶段和阶段名都要保持可读。 |
| 动效与高对比度 | 延续 `useReducedMotion`、既有焦点圈和设计变量；纸笺出现、抽屉滑入和流式状态支持减少动态效果。 |

## 6. 建议的集成测试清单

### 主链

1. 清晰首段表达进入第一检查点，消息、进度和动作均来自最新工作台。
2. 模糊表达且用户仍主动补充时只出现一次普通事实锚点；用户表达否定或无法继续时直接进入第一检查点。
3. 第一检查点选择四个任一角度后，A 纸笺消失并进入对应中度对话。
4. 每个角度覆盖零问收束、普通追问、文本否定直接收束、三次回答上限和第二检查点。
5. 第二检查点展示自然线索、剩余角度和深度陪伴入口；事件日志入口明确显示批次 C 待接入。

### 控制、恢复与分支

1. “换个角度”文本保持当前问题；明确角度按钮改变阶段。
2. 问题修复、纠正理解、三个回复版本、版本切换与分支恢复均更新完整工作台。
3. `turn → delta → session` 的流式顺序可见；AI失败后保留原话并可用同一轮继续生成。
4. 并发导致状态变化时刷新最新工作台，同时保留输入草稿供用户决定是否补充发送。
5. 退出后关闭写入入口；浏览历史事件维持只读可访问。

### 兼容、日历与体验

1. `legacy` 发布档继续进入五维选择与 `InterviewShell`；事件深链在关闭发布档时以只读方式打开。
2. 事件中心入口不读取或写入五维 session cache、维度状态和日志接口。
3. 事件日历按 `daySequence` 展示，继续访谈与日志深链保持正确；混合日期提供独立读取入口。
4. 键盘完成事件标签切换、检查点选择、问题修复菜单、回复版本、抽屉关闭和输入框焦点返回。
5. 窄屏验证事件标签溢出、进度、长自然理解、底部日志 sheet、触控操作和软键盘遮挡。

## 7. 接入顺序

1. 将工作台会话类型升级为 `EventCenteredWorkspaceSession`，接入统一 SSE 控制器。
2. 抽取消息组与回复版本适配层，保持五维现有调用稳定。
3. 按 A 方案接入第一检查点、四角度、中度消息组、第二检查点和深度回应。
4. 接入服务端进度、恢复态、错误态和事件日历缓存刷新。
5. 完成上述集成测试、键盘/小屏走查和内部 Preview。
6. 在内部 Preview 进行真实模型回放与 AI 产品验收；通过后进入批次 C 的成果闭环设计。

## 8. A方案实际接入回填

- 工作台通过 `EventCenteredWorkspaceSession` 读取完整活动路径，以服务端的阶段、允许动作、进度、成果、版本和恢复状态作为唯一依据。
- 用户输入在本地草稿与事件专属 outbox 中保留；收到 SSE `turn` 确认后，后续流式失败会重新读取工作台并展示“继续生成”，继续请求沿用同一 `clientTurnId`。
- 纠正理解在服务端未确认前保留原文和表单；服务端确认后由恢复卡片继续后续生成。
- 两件并列事件展示两条低压力选择。服务端只接受快照内的候选编号，并以对应的原话摘录建立当前事件依据；“都不贴切”继续允许用户换一种说法。
- 澄清、修复或恢复期间，版本与角度操作依据 `allowedActions` 自动关闭；退出事件后顶部加号可直接开启下一件。
- 可访问性：事件标签已支持方向键、Home、End 与面板关联；日志侧栏打开后焦点进入侧栏，收起后回到触发按钮。
- 验证：事件工作台定向测试、580条规则预检、完整回归、类型检查、Prisma校验和生产构建均通过。真实模型公共协议基线为91/120（75.83%），内部 Preview 保持关闭；小屏走查在桌面端策略质量达到门槛后进行。
