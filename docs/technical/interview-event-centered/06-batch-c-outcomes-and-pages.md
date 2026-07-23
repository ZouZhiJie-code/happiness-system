# Batch C｜成果与页面闭环技术交接

文档状态：`V0.2｜A / B / C 方案已确认，等待正式开发`

适用范围：`技术阶段 6–8`

对应产品章节：事件日志、今日日志与当天完整日志、日历与历史适配

对应产品验收：`P-01、P-08、P-09、P-10、P-20–P-27`

本轮交付边界：当前 worktree 只完成可操作 HTML、复用清单和设计冻结。本轮保持生产代码、数据结构和线上入口不变。HTML 方案由 AI 产品经理确认后，后续开发 agent 按本文顺序接入正式功能。

事实源说明：本文的实现盘点来自主工作区当前代码。当前`codex/batch-c-outcomes-prototype`分支基于较早的提交创建，尚未包含主工作区未提交的事件中心工作台、成果仓储和事件日历文件。正式生产开发开始前，LeadAgent需要先把已经验证的 Batch B 与 T1-01–T1-08成果形成可恢复集成基线，再让本分支接入该基线。后续 agent 应复用集成后的现有实现，避免依据当前旧基线重新实现同名能力。

## 一、目标与范围

Batch C 把已经存在的事件成果底座变成用户可见、可编辑、可保存和可回看的完整体验。

用户完成本批次后可以：

1. 从第一检查点、第二检查点或深度陪伴生成当前事件日志。
2. 在右侧书页查看、编辑、自动暂存并正式保存事件日志。
3. 在同一天连续记录多件事，并通过今日日志面板查看每件事的状态。
4. 只有一篇已保存事件日志时直接阅读该日志；两篇及以上时生成当天完整日志。
5. 在月、周、日视图中看到事件数量、待继续状态、待保存状态和完整日志状态，并直达对应工作区。
6. 继续阅读历史五维记录；事件成果与五维成果保持各自独立的读取和生成口径。

本批次保留以下产品边界：

- 分析页和画像页继续使用既有数据口径。
- Production 继续使用五维入口；事件中心只进入内部 Preview。
- 一件事只产生一篇事件日志。
- 单篇事件日志只保留当前正文版本；来源快照和生成 Trace 继续负责解释与审计。
- 当天完整日志只由当前正式保存的事件日志组成。
- 当天完整日志按事件创建顺序排列，保存时间不改变顺序。
- MVP 不提供日志历史版本、日志回滚、跨天合并和长期人格结论。

## 二、当前实现事实

### 2.1 已具备的成果底座

`JournalEventEntry`已经提供：

- `eventId`唯一约束，保证一事件一日志。
- `draft / saved / modified`保存状态。
- 标题、正文、内容修订、保存修订和编辑/保存时间。
- 活动分支、消息、事实、角度成果、来源指纹和完整来源快照。
- 一至十六字标题约束、正文非空约束和账号级联清理。

`JournalEventEntryGeneration`已经提供：

- `eventId + clientOperationId`生成幂等。
- 单事件最多一个`processing`操作。
- 活动分支、消息版本和冻结来源。
- `processing / completed / failed / canceled`状态。
- AI Trace、错误码、尝试次数和终态时间。
- 生成成功后原子创建日志、结束事件和关闭会话树。
- 生成失败或取消后恢复原事件为`active`。

`JournalDailyEntry`已经提供：

- `userId + entryDate`唯一约束。
- 至少两篇来源的数据库约束。
- 按`daySequence + savedRevision`形成的来源签名。
- 来源事件、来源日志、来源原文和保存版本快照。
- `draft / saved / modified`、内容修订、保存修订和并发保护。
- 来源变化后的`stale`判断。
- 待保存事件日志阻塞当天日志生成或更新。

### 2.2 已具备的页面和读取能力

事件中心已经具备：

- 顶部事件标签、加号入口、三段进度、完整对话、检查点和回复版本。
- 可靠原话提交、刷新恢复、失败续接和本地 outbox。
- 右侧当前事件日志纸页位置，目前显示 Batch C 占位内容。
- 独立的事件日历日、周、月读模型和 API。
- 日期级`empty / legacy / event_centered / dual`读取定位。
- `legacy / event_centered / event_recovery`发布档位。

旧五维链路已经具备：

- 右侧日志书页和生成阶段动效。
- 标题与正文编辑、700ms 自动暂存、手动保存和离开前刷新。
- 已保存后再编辑进入待保存的体验。
- 今日日志面板的状态概况、列表滚动和完整日志入口。
- 独立当天日志工作区、来源索引、编辑、自动暂存、保存和失败提示。
- 月、周、日工作台和直达动作。
- 标题长度、正文长度、AI结构化输出、基础版本、Trace、评测和分析埋点基础设施。

### 2.3 当前需要补齐的连接

- 事件日志生成仓储尚未接入事件中心生成服务、用户接口和正式日志书页。
- `JournalDailyEntry`尚未接入日级生成服务、用户接口和正式完整日志工作区。
- 事件工作台的`journal`读模型只返回简化状态，尚未返回编辑和失败恢复所需信息。
- `panel=daily-journal`深链已经由事件日历生成，事件工作台尚未承载对应主工作区。
- 今日日志面板尚未使用`EventCalendarDayRecord`。
- 事件日历当前已能表达状态和动作，月、周、日的成果文案与单篇直达仍需按 Batch C 原型收口。

## 三、复用清单与职责变化

| 现有能力 | 处理方式 | Batch C中的职责 |
|---|---|---|
| `JournalEventEntry / Generation` | 直接复用 | 单事件日志身份、可靠生成、来源冻结、编辑保存版本 |
| `JournalDailyEntry`及来源仓储 | 直接复用 | 多事件当天成果、来源顺序、保存资格、过期判断 |
| `EventCalendarDay/Week/MonthRecord` | 扩展复用 | 今日日志面板、月周日事件成果和直达动作的统一读模型 |
| `EventCenteredInterviewWorkspace` | 扩展复用 | 对话、事件标签、进度、右侧面板槽位和完整日志主工作区 |
| 右侧日志书页 | 提取后复用 | 事件日志的生成、编辑、暂存、保存、失败恢复 |
| `TodayJournalPanel`布局和交互 | 适配复用 | 维度列表替换为按`daySequence`排列的事件列表 |
| `DailyJournalWorkspace`布局和编辑体验 | 适配复用 | 事件中心当天完整日志；请求改走独立事件接口 |
| 生成阶段动效 | 直接复用 | 事件日志和完整日志生成中的诚实进度 |
| `Surface / Card / Divider / ActionButton` | 直接复用 | 保持暖纸色、单层卡片和可访问交互 |
| AI provider、结构化输出、Trace与质量基础设施 | 扩展复用 | 事件正文、基础版本、当天线索和评测血缘 |
| 五维`JoyEntry / DailyJournalEntry` | 保持原职责 | 继续服务历史五维成果，不接收事件中心数据 |

### 3.1 复用审查结论

正式开发优先提取共享的编辑书页、暂存状态和生成动效。事件链继续使用独立 service、schema 和 API，避免把事件身份、四角度成果和多事件来源塞入五维字段。

以下能力需要新增，原因均来自现有仓库的明确缺口：

1. **事件日志生成服务与质量门**
   - 仓储只负责冻结来源和可靠提交。
   - 新服务负责正文策略、模型调用、基础版本和内容检查。
2. **事件中心日志接口**
   - 现有五维接口以`sessionId / JoyEntry`为身份，无法表达稳定`eventId`和事件来源快照。
3. **当天完整日志可靠生成操作**
   - `JournalDailyEntry`已经能安全提交结果，当前缺少一次生成的幂等、Trace、取消和迟到结果保护。
4. **事件中心当天成果工作区**
   - 现有`DailyJournalWorkspace`绑定旧`DailyJournalEntry`接口，需要共用视图层并保留独立数据路径。

## 四、最终成果结构与内容策略

### 4.1 事件日志

用户可见内容只包含：

1. 可编辑短标题。
2. 完整、自然的事件叙事。
3. 有材料时出现的“我看见的”。

内容选择规则：

- 事件叙事读取冻结来源中的当前有效事实和必要背景。
- 另一件独立事件、已失效事实、降为非重点的成果和兄弟回复路径内容退出正文。
- 轻量记录缺少角度成果时只生成事件叙事。
- 中度和深度只读取`logEligibleOutcomeIds`对应的最新有效角度成果。
- “我看见的”保持自然段或简短条目，不显示角度字段、事实编号和内部判断。
- 新增事实、动机、情绪、因果、行动建议和抽象升华数量固定为零。

模型输出使用结构化草稿：

```ts
type EventJournalDraft = {
  title: string;
  eventNarrative: string;
  insights: Array<{
    sourceOutcomeId: string;
    text: string;
  }>;
};
```

服务端负责组装最终正文。数据库继续保存扁平的可编辑`content`，MVP不增加结构化编辑器和段落级版本。

正文组装规则：

```text
事件叙事

我看见的
有效角度线索
```

当`insights`为空时省略“我看见的”及其空白区域。

### 4.2 事件日志基础版本

AI输出失败或质量检查未通过时，使用冻结来源生成基础版本：

- 标题复用现有十六字标题规范和通用标题清洗。
- 叙事按活动消息路径和有效事实顺序整理。
- “我看见的”原样采用日志资格角度成果，只做标点和重复清理。
- 基础版本继续通过事实忠实、来源资格、越界词和标题检查。

基础版本合格时正常完成事件并打开日志书页。基础版本仍缺乏可信叙事时，生成操作进入`failed`，事件恢复原检查点，用户可重新整理或继续补充。

### 4.3 当天完整日志

当天完整日志先由服务端确定性组装：

1. 可编辑当天标题。
2. 按`daySequence`排列的每篇事件日志标题和原文。

事件标题和事件正文从`sourceSnapshot`原样写入，模型不负责改写、压缩、去重或重新排序事件原文。完整日志形成后，页面提供独立的“生成今天看见的自己”操作；用户未点击时只保留事件合集。

用户主动生成当天线索时使用结构化输出：

```ts
type JournalDailyInsightDraft = {
  title: string;
  selfInsight: {
    text: string;
    sourceEventIds: string[];
  } | null;
};
```

质量规则：

- `sourceEventIds`至少包含两个不同事件，且都属于当前冻结来源。
- 线索使用“今天暂时看见”“这几件事里都出现了”等阶段性表达。
- 证据不足时`selfInsight = null`，页面说明当前事件之间还缺少共同证据，不追加线索。
- 稳定人格、长期模式、人生方向、诊断和建议数量固定为零。
- AI不可用时事件原文合集继续可读，用户可以稍后重新生成当天线索。

生成成功后，当天线索追加到当前完整日志并进入可编辑正文。请求携带当前内容修订；生成期间正文发生变化时拒绝迟到结果并保留最新编辑。用户可以修改或删除当天线索。更新完整日志会替换当前完整日志正文；已有手动修改时必须先获得用户确认。

## 五、状态与用户动作

### 5.1 事件日志状态

```text
active事件 + 无日志
→ 用户点击生成
→ generating
→ 生成成功
→ completed事件 + draft日志
→ 用户保存
→ saved日志
→ 用户再次编辑
→ modified日志
→ 用户再次保存
→ saved日志
```

失败分支：

```text
generating
→ AI与基础版本都未通过
→ active事件 + failed生成记录
→ 回到原检查点
→ 用户发起新的生成操作
```

关键动作：

- `生成事件日志`只在事件为`active`、当前事实澄清完成、角度成果修复完成时开放。
- 生成成功后对话永久关闭，日志编辑继续开放。
- `记下一件`要求当前日志本地编辑已经完成服务端暂存；正式保存可以稍后完成。
- 切换事件标签和关闭日志书页前先暂存当前编辑。
- 暂存失败时保留书页和本地文字，展示重试入口。

### 5.2 今日日志状态

今日日志直接读取`EventCalendarDayRecord`：

- `待继续 = activeEventCount + pendingSaveEntryCount`
- `已完成 = savedEntryCount`
- `完整日志 = empty / single_entry / none / draft / modified / saved / stale`

事件列表按`daySequence`展示：

| 事件状态 | 用户文案 | 主动作 |
|---|---|---|
| `active` | 进行中 | 继续记录 |
| `generating` | 整理中 | 查看整理状态 |
| `draft` | 待保存 | 继续编辑 |
| `modified` | 修改待保存 | 保存修改 |
| `saved` | 已保存 | 查看日志 |

活动事件优先显示第一条原话形成的短摘要。日志生成后显示日志标题和正文短摘要。

### 5.3 当天完整日志状态

| 来源与成果 | 用户动作 |
|---|---|
| 0篇已保存事件日志 | 入口置灰，提示先完成一篇 |
| 1篇已保存事件日志 | 直接打开该事件日志 |
| 2篇及以上、缺少完整日志 | 生成日志 |
| 完整日志`draft / modified` | 继续编辑 |
| 完整日志`saved`且来源一致 | 查看日志 |
| 完整日志来源变化 | 更新日志 |
| 存在`draft / modified`事件日志 | 阻塞生成或更新，先完成对应事件日志 |

完整日志更新失败时保留旧版本，状态继续显示`stale`或`modified`。

## 六、接口与数据流

### 6.1 统一用户错误

事件成果接口继续使用事件工作台已有的结构化`issue`：

```ts
type EventOutcomeIssue = {
  code: string;
  title: string;
  message: string;
  resolution: string;
  retryable: boolean;
  action: "retry" | "refresh" | "complete_entry" | "confirm_replace" | "leave";
  requestId: string;
};
```

所有接口先校验当前用户、事件/成果归属、日期归属和发布档位。普通用户响应不返回事实、来源全文、内部角度名、Trace和原始模型错误。

### 6.2 事件日志读取与编辑

新增：

```text
GET  /api/event-journal/[entryId]
PUT  /api/event-journal/[entryId]
POST /api/event-journal/[entryId]/save
POST /api/event-journal/generation/[generationId]/cancel
```

`GET`返回：

```ts
type EventJournalEntryView = {
  entry: {
    id: string;
    eventId: string;
    title: string;
    content: string;
    status: "draft" | "saved" | "modified";
    contentRevision: number;
    savedRevision: number | null;
    updatedAt: string;
    savedAt: string | null;
  };
};
```

`PUT`请求：

```ts
{
  expectedContentRevision: number;
  title: string;   // 1–16字
  content: string; // 1–3000字
}
```

`POST /save`请求：

```ts
{ expectedContentRevision: number }
```

版本冲突返回`409 EVENT_JOURNAL_ENTRY_VERSION_CONFLICT`。前端保留本地文字并提供刷新最新版本；服务端不会覆盖更新版本。

### 6.3 事件日志生成

生成动作扩展现有事件中心流式接口：

```text
POST /api/interview/event-centered/session/respond/stream
```

`EventCenteredRespondAction`增加`generate_event_journal`。请求继续使用：

```ts
{
  action: "generate_event_journal";
  rootSessionId: string;
  clientTurnId: string;
  baseBranchSessionId: string;
  baseMessageSequence: number;
}
```

处理顺序：

```text
可靠保存生成动作
→ 确认当前可确认推测
→ 复检事实澄清与角度修复
→ 冻结活动路径、有效事实和日志资格成果
→ 事件进入generating
→ AI结构化生成
→ 事实、来源、标题、越界与基础质量检查
→ 失败时尝试基础版本
→ 原子创建唯一日志并结束会话树
→ 流式返回最新workspace
```

流式阶段沿用现有`phase / session / error`事件，新增前端可读阶段：

- `journal_source`：正在整理已经确认的内容。
- `journal_drafting`：正在形成事件叙事。
- `journal_checking`：正在检查事实和表达。
- `complete`：日志草稿已经打开。

工作台`journal`读模型扩展为：

```ts
type EventCenteredJournalState = {
  status: "not_generated" | "generating" | "draft" | "modified" | "saved" | "failed";
  entryId: string | null;
  generationId: string | null;
  errorCode: string | null;
  retryable: boolean;
  eventStatus: "active" | "generating" | "completed" | "abandoned" | null;
};
```

生成失败记录由日志状态展示。对话`pendingTurn`排除`generate_event_journal`操作，避免日志失败占用普通对话的“继续生成”恢复入口。再次整理使用新的`clientTurnId`，同一请求重放继续返回同一生成或日志。

### 6.4 今日日志

今日日志不新增聚合接口，直接复用：

```text
GET /api/event-calendar/day?date=YYYY-MM-DD
```

事件日读模型扩展一项安全展示摘要：

```ts
EventCalendarEventRecord.displaySummary: string | null
```

展示摘要来源优先级：

1. 事件日志正文短摘要。
2. 当前事件第一条用户原话的安全截断。
3. `第 N 件事`。

摘要只用于列表展示，不进入事实、日志和分析。

### 6.5 当天完整日志

新增：

```text
GET  /api/journal-daily?date=YYYY-MM-DD
POST /api/journal-daily/generate
POST /api/journal-daily/[entryId]/insight
PUT  /api/journal-daily/[entryId]
POST /api/journal-daily/[entryId]/save
POST /api/journal-daily/generation/[generationId]/cancel
```

`GET`直接返回`JournalDailyJournalView`并补充当前生成状态。它是今日日志入口、独立完整日志工作区和日历状态说明的共同事实源。

`POST /generate`请求：

```ts
{
  entryDate: string;
  clientOperationId: string;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  replaceManualEditsConfirmed: boolean;
}
```

生成服务执行：

```text
复检至少两篇已保存事件日志
→ 复检不存在待保存事件日志
→ 冻结来源签名与来源原文
→ 服务端原样组装每篇事件日志
→ 再次复检来源签名与内容修订
→ commitJournalDailyEntryDraft
→ 返回最新JournalDailyJournalView
```

编辑与保存请求均携带`expectedContentRevision`。来源签名变化、手动修改覆盖确认缺失和版本冲突统一返回`409`并保留当前成果。

`POST /api/journal-daily/[entryId]/insight`请求：

```ts
{
  clientOperationId: string;
  expectedSourceSignature: string;
  expectedContentRevision: number;
}
```

该操作只生成“今天看见的自己”。服务端冻结当前来源，验证至少两个不同事件共同支持候选线索；成功后把该节追加到当前正文并增加内容修订。证据不足时返回可理解的空结果，不改变正文。来源或正文修订变化时拒绝迟到结果，用户可以基于最新版本重新发起。

### 6.6 当天生成操作

新增独立`JournalDailyEntryGeneration`，承担完整日志组装和当天线索生成的可靠性：

- `userId / entryDate / clientOperationId`唯一。
- `operationKind = daily_journal / self_insight`。
- `processing / completed / failed / canceled`。
- 当前来源签名、来源哈希、来源快照。
- 开始时的完整日志`contentRevision`。
- 是否已经确认覆盖手动修改。
- `attemptCount / traceId / errorCode / startedAt / completedAt / failedAt / canceledAt`。
- 同一用户同一天最多一个`processing`操作。

这一实体不会替代`JournalDailyEntry`。生成操作负责幂等与恢复，成果实体继续负责用户当前正文。

## 七、页面接入

### 7.1 事件工作台

事件工作台保留现有对话主区，并增加单一右侧面板槽位：

```ts
type EventCenteredRightPanel = "today" | "event-journal" | null;
type EventCenteredMainWorkspace = "dialogue" | "daily-journal";
```

规则：

- “当前事件日志”打开右侧事件书页。
- “今日日志”打开右侧事件列表和当天成果入口。
- 两个右侧面板共用一个位置，避免桌面出现三栏拥挤。
- `panel=journal&eventEntryId=...`打开指定事件日志。
- `panel=today`打开今日日志。
- `panel=daily-journal`切换主区为当天完整日志，不创建空白事件会话。
- 从完整日志返回访谈或切换事件前先刷新未暂存编辑。
- 移动端继续复用底部书页/抽屉承载右侧面板。

事件日志的三种呈现方案只改变书页内部排版。数据、接口、保存和来源语义保持一致，HTML选择不会引起后端返工。

### 7.2 今日日志面板

面板保留三个概况和按事件顺序的短列表。列表只显示：

- 序号。
- 事件标题或一行摘要。
- 当前状态。
- 一个主动作。

事件正文阅读留在事件日志书页，面板内部不展开长正文。

### 7.3 完整日志工作区

复用`DailyJournalWorkspace`的视图结构和离开前刷新能力，抽出与旧接口解耦的编辑书页：

- 顶部显示日期、来源数量和新鲜度。
- 来源索引按事件顺序展示标题。
- 主体是可编辑标题和正文。
- 底部提供保存修改。
- `stale`时提供更新入口。
- 更新会覆盖当前手工修改时先弹出确认。
- 一篇来源时直接转到事件日志，不渲染完整日志空壳。

### 7.4 日历

月视图：

- 日期主体优先显示已保存事件日志数量。
- 活动、生成中和待保存使用轻量状态提示。
- 已保存完整日志显示轻量完整状态。

周视图：

- 每天展示事件总数、待继续数量、已保存数量和完整日志状态。
- 主动作优先级保持：继续记录、查看整理状态、继续编辑、查看事件日志、继续编辑完整日志、查看完整日志、更新完整日志、生成完整日志、开始记录。

日视图：

- 按`daySequence`展示事件列表。
- 单篇完整日志入口使用`dailyJournal.directEntryId`匹配真实事件，避免默认打开当天第一件事。
- 两篇及以上显示完整日志入口、待保存门禁和来源过期状态。

### 7.5 历史与发布保护

- `/api/calendar/read-route`继续决定日期进入五维、事件或双轨阅读。
- `legacy`日期只调用旧五维接口和组件。
- `event_centered`日期只调用事件成果接口和组件。
- `dual`日期显示两条只读入口，关闭当天新增和编辑。
- `event_recovery`允许阅读既有事件、日志和完整日志，关闭生成、编辑、保存和新事件。
- 事件中心接口校验`JournalDayOwnership.primaryMode = event_centered`和`status = clean`。
- 所有新增表和接口保持增量；回退发布档位时已存在成果继续可读。

## 八、失败恢复与并发

| 场景 | 用户结果 |
|---|---|
| 事件日志AI失败、基础版本合格 | 正常打开基础版本草稿 |
| AI与基础版本都失败 | 返回原检查点，保留全部访谈成果，允许重新整理 |
| 事件日志生成中关闭书页 | 取消当前操作，事件恢复可继续 |
| 生成结果迟到 | 来源指纹或操作状态不一致时拒绝落稿 |
| 两页同时生成事件日志 | 唯一约束收敛为同一日志或`409`刷新 |
| 自动暂存失败 | 本地文字保留，书页保持打开并展示重试 |
| 两页同时编辑 | 旧修订返回`409`，本地文字继续保留 |
| 当天来源在生成中变化 | 拒绝旧结果，原完整日志保持可读 |
| 完整日志更新失败 | 保留旧内容和`stale`状态 |
| 完整日志存在手动修改 | 用户确认后才允许更新覆盖 |
| 日历读取失败 | 保留工作台骨架，显示重试，避免显示为空白日 |

编辑器继续使用`sessionStorage`保存未确认的本地文字。页面刷新后先读取服务端修订，再恢复仍未提交的本地草稿；检测到版本变化时让用户选择复制本地内容或采用最新版本。

## 九、正式开发顺序

### 步骤 0｜原型与冻结

1. 完成`batch-c-outcomes-and-pages.html`。
2. AI产品经理确认事件日志呈现、当天线索和今日日志信息密度。
3. 把确认结果回填本文版本记录。

### 步骤 1｜公共契约

1. 由LeadAgent建立包含 Batch B 与 T1-01–T1-08的可恢复集成基线。
2. 扩展事件工作台日志状态和`generate_event_journal`流式动作。
3. 新增事件日志、当天完整日志的请求/响应 schema。
4. 新增`JournalDailyEntryGeneration`增量 migration。
5. 冻结错误码、修订字段和发布档位行为。

### 步骤 2｜事件日志

1. 实现事件日志 Prompt、结构化输出、基础版本和质量门。
2. 接通冻结、生成、完成、失败和取消。
3. 接通查询、自动暂存和手动保存接口。
4. 将右侧占位纸页替换为真实事件日志书页。

### 步骤 3｜今日日志与完整日志

1. 用事件日读模型实现今日日志概况和事件列表。
2. 实现当天原文组装和独立的跨事件线索生成操作。
3. 接通完整日志查询、生成、更新、暂存和保存接口。
4. 接入`panel=today / journal / daily-journal`导航与离开前刷新。

### 步骤 4｜日历与历史

1. 收口月、周、日事件成果文案与状态。
2. 修正单篇直达和多篇完整日志动作。
3. 验证五维、事件、双轨和恢复档位。

### 步骤 5｜集成与Preview

1. 完成定向测试、完整回归、类型检查、构建和差异检查。
2. 完成事件日志与当天线索 AI 评测。
3. 部署内部 Preview。
4. 由 AI 产品经理完成人工抽检和主链验收。

## 十、测试与验收门

### 10.1 自动化测试

事件日志：

- 清晰事件从第一检查点生成，正文只包含已有事件材料。
- 轻量记录没有有效角度成果时省略“我看见的”。
- 中度和深度只包含当前路径的日志资格成果。
- 已失效事实、降重点成果和兄弟分支内容不进入日志。
- 同一操作重放与两页并发只形成一篇日志。
- AI失败时基础版本合格即完成；基础版本不合格时回到原检查点。
- 生成成功后会话树关闭，日志进入`draft`。
- 自动暂存、正式保存、保存后编辑和再次保存状态正确。
- 版本冲突不覆盖用户本地文字。
- 直接记下一件前先完成当前编辑暂存。

当天成果：

- 0篇来源禁用完整日志入口。
- 1篇来源直达对应事件日志。
- 2篇来源按`daySequence`原样进入完整日志。
- 完整日志首次生成只形成事件合集，用户点击后才生成当天线索。
- 当天线索至少引用两个来源事件；证据不足时不改变正文并给出自然说明。
- 当天线索生成期间正文或来源变化时拒绝迟到结果。
- 新来源、重新保存和来源退出使完整日志进入`stale`。
- 待保存事件日志阻塞生成和更新。
- 更新失败保留旧完整日志。
- 手动修改的完整日志需要确认后才能被更新覆盖。
- 两页编辑和生成冲突通过内容修订与来源签名收敛。

页面与兼容：

- 事件标签、进度、今日日志和当前事件日志状态一致。
- `panel=daily-journal`不会创建空白事件。
- 月、周、日动作进入正确事件、日志或完整日志。
- 单篇直达使用真实`directEntryId`。
- 未来日期无新增和继续动作。
- 历史五维日期保持原页面和原接口。
- 双轨历史日期只读分流。
- `legacy / event_recovery`关闭事件写入，既有成果可读。

### 10.2 AI内容评测

事件日志评测至少覆盖：

- 轻量、中度、深度三种材料密度。
- 事实忠实、事件边界、纠正后最新事实、角度成果资格。
- 自然中文、第一人称、事件叙事完整度和“我看见的”增量价值。
- 标题自然度、内部结构暴露、诊断、建议和抽象升华。
- AI失败后的基础版本。

当天线索评测至少覆盖：

- 两件事有共同证据时形成阶段性线索。
- 两件事主题相似但证据不足时省略线索。
- 互不相关事件保持原文合集。
- 事件原文逐字保持，顺序保持。
- 禁止稳定人格、长期模式和人生方向推断。

Batch C完成门：

- P0成果场景全部通过。
- 规则预检全部通过。
- 事件日志和当天线索正式模型评测分别达到`95%`以上。
- 事实虚构、事件串线、忽略纠正、改写事件原文、心理诊断、伤害性建议和内部结构暴露为`0`。
- AI产品经理查看全部失败案例、Judge冲突案例和各组随机通过案例。
- 完整回归、类型检查和生产构建通过。
- 内部 Preview 用户验收通过。

## 十一、Preview验收脚本

1. 输入一件清晰的小事，在第一检查点直接生成；预期只出现事件叙事。
2. 选择一个角度完成中度复盘后生成；预期出现对应自然线索。
3. 修改日志标题和正文，等待自动暂存后刷新；预期文字恢复、状态为待保存。
4. 保存日志后再次修改；预期进入“修改待保存”，完整日志来源状态同步变化。
5. 点击“记下一件”，完成第二篇日志并保存；预期今日日志按记录顺序展示两篇。
6. 生成当天完整日志；预期先得到两篇事件原文完整、顺序不变的事件合集。
7. 点击“生成今天看见的自己”；预期至少两件事共同支持时追加线索，证据不足时正文保持不变。
8. 修改其中一篇事件日志并重新保存；预期完整日志显示需更新。
9. 在完整日志已有手动修改时点击更新；预期先提示更新会覆盖手动修改。
10. 从月、周、日视图分别进入继续记录、继续编辑、查看日志和完整日志。
11. 打开历史五维日期和双轨历史日期；预期各自进入独立阅读路径。

## 十二、版本记录与回填

| 版本 | 日期 | 状态 | 说明 |
|---|---|---|---|
| V0.1 | 2026-07-23 | 原型与设计冻结中 | 完成复用盘点、接口语义、失败恢复、开发顺序和验收门；本轮只做原型与文档 |
| V0.2 | 2026-07-23 | 产品方案已确认 | AI产品经理选择A连续阅读、B额外生成当天线索、C展示正文片段 |

### HTML选择回填

- 事件日志呈现：`已确认A｜同页连续阅读`
- “今天看见的自己”：`已确认B｜完整日志形成后由用户额外点击生成；至少两篇共同证据才追加`
- 今日日志信息密度：`已确认C｜序号 + 标题 + 正文片段 + 状态 + 单一主动作`

### 开发回填

- 实际变更摘要：
- 数据库与接口变化：
- 与本文差异：
- 测试命令与结果：
- Preview地址：
- 已知限制：
- 对阶段9的影响：
