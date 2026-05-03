# Operator Runbook

最后更新：`2026-05-03`

本文记录本地启动、数据库同步、测试命令与高频故障排查。

## 1. 环境变量

最小必需配置来自 `.env.example`：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `AI_PROVIDER` | 当前默认是 `volcengine-ark` |
| `VOLCENGINE_ARK_API_KEY` | Ark API Key |
| `VOLCENGINE_ARK_ENDPOINT_ID` | Ark endpoint |
| `VOLCENGINE_ARK_BASE_URL` | Ark base URL |
| `APP_URL` | 前端访问地址 |

当前默认本地值示例：

```bash
DATABASE_URL="postgresql://zouzhijie@localhost:5432/happiness_system_codex?schema=public"
AI_PROVIDER="volcengine-ark"
VOLCENGINE_ARK_API_KEY=""
VOLCENGINE_ARK_ENDPOINT_ID=""
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
APP_URL="http://localhost:3000"
```

## 2. 本地启动

### 2.1 安装依赖

```bash
npm install
```

### 2.2 同步数据库 schema

```bash
npx prisma db push
```

如果你是在已有本地数据的数据库上同步到 `2026-05-02` 之后的代码，`db push` 可能会因为新增必填 `InterviewSession.entryDate` 失败。当前可用处理方式：

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260501123000_add_interview_session_entry_date/migration.sql
```

说明：
- 这是当前仓库本地已有数据时最稳的同步方式
- 该 migration 会先补列，再把历史 `entryDate` 回填为 `startedAt`
- 当前 `prisma migrate dev` 在本仓库的 shadow DB 链路上还有历史 migration 问题，不是这次 `entryDate` 改动单独引起的

### 2.3 启动开发服务器

```bash
npm run dev
```

默认地址：
- `http://localhost:3000`

## 3. 最小冒烟路径

建议每次改动后至少跑一遍 joy 主链路：

1. 打开 `/interview?dimension=joy`
2. 启动一轮 joy 访谈
3. 输入 2-3 轮内容
4. 点击“生成日志”
5. 确认右侧出现日志正文，而不是结构化线索
6. 编辑标题或正文
7. 点击“保存正式日志”
8. 刷新页面，确认 session 和日志可恢复

### 3.0 calendar 月视图冒烟场景

如果当前是在调记录日历月视图，每次改动后至少人工覆盖：

1. 打开 `/calendar?view=month&date=2026-05-02`
2. 确认月视图固定渲染 6 行 42 格；`2026-03`、`2026-05`、`2026-12` 的月历主体高度一致
3. 点击一个过去但未记录的日期
4. 预期：月格不出现 `进行中 / 混合状态` 这类文字；如果没有已保存维度，不会出现单字标签；左侧不出现 `本月还没有记录。` 横幅，右侧当天检查面板保持过去空白语气
5. 点击一个未来空白日
6. 预期：月格不显示 `未记录 / 还没有记录。`；右侧当天检查面板改成中性 future 语义，但仍保留 `查看当天`
7. 找一个 today 且有状态的日期
8. 预期：today 圆点在日期锚点附近，右上角状态文案不与圆点重叠
9. 找一个已有保存维度但未满五维的日期
10. 预期：月格显示单字 `悦 / 实 / 思 / 改 / 谢` 中对应结果；不再显示双字 badge
11. 找一个五维都至少保存过一次的日期
12. 预期：月格文字层收束为 `已完成`
13. 在较矮视口打开月视图
14. 预期：底部日期不会被裁切，父级 pane 可以滚动访问月底日期

### 3.0.1 analysis 入口冒烟场景

如果当前是在调记录分析入口，每次改动后至少人工覆盖：

1. 打开 `/analysis`
2. 预期：URL 被归一到 `/analysis?month=<北京时间当前 YYYY-MM>&section=score`
3. 点击 `上月 / 下月 / 本月`
4. 预期：URL 更新 `month` 并保留当前 `section`，页面标题同步成对应月份
5. 预期：评分分区默认打开；页内可切到 `评分 / 热力 / 五维洞察`
6. 如果当前月是干净库，没有任何已保存数据：
7. 先通过任一维度访谈生成并保存至少 1 篇维度日志，再从访谈页顶部【日志】进入当天整合日志主区，生成并保存 1 篇当天整合日志
8. 回到 `/analysis?month=<该月>&section=rhythm`
9. 预期：对应日期显示 `1-5维` 和单字维度标识 `悦 / 实 / 思 / 改 / 谢`
10. 预期：该日期出现轻量整合标记
11. 切到 `/analysis?month=<该月>&section=insights`
12. 预期：`五维洞察` 中至少有对应维度的篇数、覆盖天数和最近结构化线索；有真实数据时不应出现示意样板短句
12. 在当前月找到 `幸福 8 要素评分` 模块
13. 预期：能看到 `总分平均走势` 和 `单项走势`；未评分日期断线，不补 0
14. 点击任一 8 要素切换按钮
15. 预期：单项走势切换到对应要素，URL 的 `month` 不变
16. 预期：今天 / 昨天可切换；已有评分会回填，未填完整时保存按钮禁用
17. 拖动 8 项 slider 到 `1..10` 内的整数并保存
18. 预期：请求 `PUT /api/happiness-score` 成功，页面重新拉取 `/api/analysis/month` 并保留最新分数，趋势图同步更新
19. 切到一个没有已保存记录的旧月份
20. 预期：`score / rhythm / insights` 分区都能稳定打开；如果进入示意填充态，页面会明确标注示意数据，仅影响展示，不改变评分保存规则

如果当前是在做 prompt / 访谈质量调试，而不是验恢复逻辑：
1. 可以直接点顶部 `清除对话记录`
2. 它会只重开当前维度的一轮新访谈
3. 不需要手动清 localStorage，也不需要改数据库

### 3.1 fulfillment 冒烟场景

fulfillment 已是理论对齐维度，每次改动 fulfillment 访谈或日志生成后，至少人工覆盖：

1. 推进完成：例如“把拖了很久的任务推进完，卡住部分收口”
2. 投入积累：例如“练习、学习、熟练度有一点真实积累”
3. 协作贡献：例如“配合、支持、交接、帮到别人”
4. 空忙空转：只有忙、会议、任务很多时，不应硬写进展证据或值得感标准
5. 用户拒绝继续深挖或自然语言要求整理日志：已有 `experience + progressEvidence` 后，用户说“先这样，直接生成日志”或“总结日志”，应进入 partial draft choice
6. 用户拒绝继续但材料不足：只有 `experience` 或只有模糊片段时，用户说“别问了”，应展示“只补一句 / 换一个片段 / 先退出”
7. 标题治理：生成的 fulfillment 标题不应是长事件句截断，例如不应出现“看了一本相关的书籍，介绍怎么解活”

### 3.2 reflection 冒烟场景

reflection 已是理论对齐维度，每次改动 reflection 访谈或日志生成后，至少人工覆盖：

1. 规律发现：例如“今天看完项目复盘后，我意识到自己以前太容易把忙碌当成进展”
2. 方向优势：例如“今天帮别人理清问题时，我发现自己更擅长把混乱信息整理成判断依据”
3. 判断校准：例如“真正有进展的是能说明判断依据变清楚了”
4. 空泛想法：只有“今天想了很多 / 有点焦虑”时，不应硬写触发片段或判断线索
5. 用户拒绝继续深挖或自然语言要求整理日志：已有 `trigger + insight` 后，用户说“先这样，直接生成日志”或“总结日志”，应进入 partial draft choice
6. 用户拒绝继续但材料不足：没有具体触发片段或新理解时，用户说“别问了”，应展示“只补一句 / 换一个片段 / 先退出”
7. 标题治理：生成的 reflection 标题不应是长事件句截断，判断校准类材料可压成“忙碌不等于进展”“判断依据变清楚”这类短标题

### 3.3 improvement 当前冒烟场景

improvement 目前完成了数据结构、AI 抽取独立化、fallback 抽取、访谈推进、专属提问策略、完成收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例。每次改动 improvement 抽取、结构、访谈推进、提问策略或正文生成时，至少覆盖：

1. `avoid_bad`：输入“今天开会时我有点急，没听完就解释，后面发现对方其实问的是另一个点。下次我想先复述问题再回答。”，应抽出 `improvementTrack = "avoid_bad"`、具体 `frictionPoint`、`controllableFactor` 和具体 `nextAttempt`
2. `repeat_good`：输入“今天上午先写了三条重点再开工，状态很稳。下次我想继续先定主线。”，应抽出 `improvementTrack = "repeat_good"` 和 `repeatCondition`，不强行抽 `frictionPoint`
3. track-only 中间态：输入“今天这个节奏挺好，下次想重复一下”，应保留 `improvementTrack = "repeat_good"`，不硬抽 `repeatCondition`，也不进入生成日志 choice
4. 自责输入：只有“我很差 / 我不行”时，不应抽成 `frictionPoint`
5. 空泛动作：`nextAttempt` 不应是“我要变好 / 我要努力”
6. 可控点：`controllableFactor` 必须是用户自己能调整的一小块
7. 提问口吻：fallback/stage 问题应覆盖“具体情境 -> 改进轨道 -> 关键条件/卡点 -> 可控小调整 -> 下次最小动作/成功信号”，且不出现“你应该怎么做 / 制定一个计划 / 你为什么会这样 / 以后一定要”
8. 完整收束：`situation + improvementTrack + stateAssessment + frictionPoint|repeatCondition + controllableFactor + nextAttempt` 成立后，应进入生成日志 choice
9. partial 收束：有 `situation + frictionPoint|repeatCondition`，且用户说“今天沟通有点急，别追问了，直接整理。”时，应进入 `user_override_partial`，不硬写完整方案
10. 材料不足：只有“今天很糟，我需要改进。别问了。”时，不生成日志，应进入 `boundary_insufficient`

### 3.4 gratitude 当前冒烟场景

gratitude 目前完成了理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、访谈推进、专属提问策略、完成收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例。每次改动 gratitude 抽取、结构、访谈推进、提问策略或正文生成时，至少覆盖：

1. 支持回应：输入“今天同事看出我快撑不住，先陪我把优先级理了一遍，我一下子没那么慌了。”，应抽出 `gratitudeMoment`、`gratitudeTarget`、`kindAction`、`seenNeed`、`gratitudeReason`
2. 理解体谅：输入“我没解释太多，她就先把我的顾虑接住了，这让我觉得自己被认真理解。”，应能收束到 `理解体谅型`，不把内容写成泛泛感谢
3. 信任机会：输入“主管把这个需要协调很多人的任务交给我，我会记住这种被信任的感觉。”，应能抽出 `gratitudeType = "信任机会型"`，并继续追问为什么这份信任值得珍惜
4. 空泛感谢：只有“今天挺感谢大家的”时，不应硬写 `seenNeed`、`gratitudeReason` 或关系判断
5. partial 收束：已有 `gratitudeMoment + kindAction + seenNeed|gratitudeReason` 后，用户说“先这样，直接整理成日志”，应进入 `user_override_partial`
6. 材料不足：只有“我也说不上来，就是想感谢一下。别问了。”时，不生成日志，应进入 `boundary_insufficient`
7. 质量门：draft 不应写成感谢信、道德负债、自我要求以后一定回报，也不应把关系意义硬拔高
8. 标题治理：标题不应退回长事件句截断，也不应生成 `感谢日志 / 谢谢你 / 今天很感恩` 这类泛标题

### 3.5 当天整合日志冒烟场景

如果当前改动涉及 `/api/daily-journal*`、calendar 日视图入口或访谈页顶部【日志】，至少覆盖：

1. 在同一 `entryDate` 下保存至少一篇维度日志
2. 打开 `/interview?dimension=joy&entryDate=2026-05-03`
3. 点击顶部【日志】
4. 预期：主工作区切到当天整合日志；只统计已保存维度日志，不读取未保存草稿
5. 点击“生成当天日志”
6. 预期：正文只包含已有维度章节，不出现空章节或缺失维度提醒
7. 修改标题或正文，等待自动保存，再点击保存正式日志
8. 预期：`GET /api/daily-journal?date=2026-05-03` 返回 `state = "saved"`
9. 从 `/calendar?view=day&date=2026-05-03` 进入当天日志 deep link
10. 预期：`mode=daily-journal` 只打开当天日志主区，不会调用 `/api/interview/session/start`
11. 点击“回到访谈”
12. 预期：URL 移除 `mode=daily-journal`，回到同一日期的普通访谈 hydrate 流程

## 4. 测试命令

```bash
npx tsc --noEmit
npm test
```

截至 `2026-05-03`，当前基线是：
- `38` 个测试文件
- `321` 个测试全部通过

## 5. 高频故障排查

### 5.1 启动访谈失败，报缺少 `snapshotData` 或 `payload` 列

症状：
- `/api/interview/session/start` 返回 500
- 控制台出现类似：
  - `InterviewEvent.snapshotData does not exist`
  - `JoyEntry.payload does not exist`
  - `DailyJournalEntry does not exist`

处理：

```bash
npx prisma db push
```

然后重启：

```bash
npm run dev
```

这是当前最常见的本地环境问题。

### 5.1.1 旧本地库同步后报 `entryDate` 必填列无法新增

症状：
- `npx prisma db push` 报 required column `entryDate` 无法新增
- 本地 `InterviewSession` 表里已经有历史数据

处理：

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260501123000_add_interview_session_entry_date/migration.sql
```

然后确认 dev server 仍在运行；如果之前已经崩掉，再重启：

```bash
npm run dev
```

### 5.2 “生成日志”按钮长时间显示忙碌

要先区分两种情况：

1. 第一次生成，没有旧稿  
   右侧会显示真正的阶段式 loading 状态：
   - `正在生成日志骨架`
   - `正在打磨日志细节`
   - `最终润色中`

2. 已有旧稿后再次生成  
   顶部按钮只有在用户手动点击“生成日志”后才会进入忙碌状态。  
   日志面板会先保留旧稿，再叠加阶段式刷新反馈，直到新稿替换完成。

3. 已有旧稿且已经覆盖到最新访谈状态  
   再次点击“生成日志”不会重新发起生成，而是直接复用当前版本，并给出“当前已经是最新版本”的轻提示。

补充：
- 如果用户在整理过程中直接关闭日志面板，当前这次整理会被取消。
- 这时访谈分岔点卡片会恢复可点击，不属于故障。

如果一直不结束，再检查：
- AI provider 是否可用
- 网络是否超时
- 服务端是否返回了 `DRAFT_GENERATE_*` 错误

### 5.3 访谈回复显示结构化错误

截至 `2026-05-01`，访谈提交失败时前端会展示：
- 错误原因
- 解决方案
- 错误码
- requestId

高频处理：

| 错误码 | 处理 |
|---|---|
| `NETWORK_UNAVAILABLE` | 确认 `npm run dev` 仍在运行，再刷新页面 |
| `MESSAGE_TOO_LONG` | 单次回复超过 `1200` 字，拆成两段发送 |
| `SESSION_NOT_FOUND` | 刷新页面；仍失败则点击 `清除对话记录` 重开当前维度 |
| `SESSION_CHOICE_UNAVAILABLE` | 当前分叉选择过期，刷新后按最新状态操作 |
| `INTERVIEW_DB_WRITE_FAILED` | 检查数据库连接与 Prisma 报错，用户原输入应仍在输入框 |
| `INTERVIEW_RESPONSE_SCHEMA_ERROR` | 检查服务端返回的 session hydrate 是否符合 schema |
| `STREAM_PROTOCOL_ERROR` | 检查 SSE `event/data` 格式与前端流式解析 |
| `INTERVIEW_RESPOND_FAILED` | 看 dev server 日志里的 requestId 和堆栈 |

如果要快速验证结构化错误链路，可发一个超过 `1200` 字的回复；预期返回 `MESSAGE_TOO_LONG`，前端提示拆成两段发送。

### 5.4 draft 生成失败，但页面没有崩

这是预期保护行为。

当前 draft 生成链路：
- 先尝试 AI structured output
- 如果 provider 不可用或 schema 不合法，会退回 fallback draft
- 只有写库失败或严重上游错误，才会真正返回失败状态

如果看到“日志草稿风格太机械”，不一定是 bug，也可能是触发了 fallback。

### 5.5 标题看起来像半截句子

截至 `2026-05-01`，这不应再是正常现象。

当前规则：
- 五个维度标题都由后端统一治理
- 标题上限仍是 `16` 字
- AI 返回的流水句、截断句、字段句会被确定性语义短标题替换
- fallback draft 也使用同一套标题策略

如果复现半截句标题，优先检查：
- `src/features/interview/journal-title.ts`
- `src/server/services/interview/joy-interview-ai.service.ts` 的 `normalizeDraftTitle`
- `src/features/interview/server/draft-policies.ts` 的 fallback draft 标题路径

### 5.6 用户说“不想继续 / 总结日志”，系统还在追问细节

截至 `2026-05-01`，这不应再是正常现象。

当前规则：
- `boundary_stop / hostile_boundary` 会在服务层抽取前处理
- “总结日志 / 总结成日志 / 整理成日志 / 帮我总结 / 帮我整理 / 生成一下日志”等自然语言整理请求也会进入同一套边界收束
- 材料足够时直接给 partial 生成选择
- 材料不足时返回 `boundary_insufficient`
- 前端应展示“只补一句 / 换一个片段 / 先退出”

如果仍在追问细节，优先检查：
- `src/features/joy-interview/server/interview-progress.ts`
- `src/server/services/interview/joy-interview.service.ts`
- `src/components/interview/interview-shell.tsx` 的 `ChoiceActionCard`

### 5.7 语音转写看起来“能用”，但文本明显不对

当前 `/api/transcribe` 只是 stub：
- 上传 `audio`
- 返回一段占位 transcript

这意味着：
- 现在不应该把语音质量问题当作模型 bug 排查
- 真正的转写模型还没接上

### 5.8 浅色 `thinkingSummary` 看起来像第二个追问

截至 `2026-05-01`，这不应再是正常现象。

当前规则：
- `thinkingSummary` 是浅色思路层，用来呈现 AI 对用户回复的理解和处理焦点
- 它不能带问号，不能使用“你提到 / 我想知道 / 下一步问”等口吻
- 前端会用低权重样式展示它，正式追问只应出现在更深色的 `question` 气泡里

如果仍复现，优先检查：
- `src/features/joy-interview/prompts/joy-prompts.ts`
- `src/server/services/interview/joy-interview.service.ts` 的 `normalizeThinkingSummary`
- `src/components/interview/interview-shell.tsx` 的 `MessageBubble` variant

## 6. 关键日志与定位点

优先看：
- `npm run dev` 终端输出
- draft 相关接口返回码：
  - `DRAFT_GENERATE_UPSTREAM_ERROR`
  - `DRAFT_GENERATE_DB_ERROR`
  - `DRAFT_GENERATE_SCHEMA_ERROR`
- Prisma 报错
- 访谈提交相关结构化错误：
  - `NETWORK_UNAVAILABLE`
  - `MESSAGE_TOO_LONG`
  - `SESSION_NOT_FOUND`
  - `SESSION_CHOICE_UNAVAILABLE`
  - `INTERVIEW_DB_WRITE_FAILED`
  - `INTERVIEW_RESPONSE_SCHEMA_ERROR`
  - `STREAM_PROTOCOL_ERROR`
  - `INTERVIEW_RESPOND_FAILED`

数据库里当前也会记录：
- `AIRequestLog`
  - `transcribe / extract / generate`
- `InterviewSession`
- `InterviewEvent`
- `JoyEntry`

## 7. 当前已知非故障现实

这些现象当前属于产品或架构现状，不是立即修的故障：

- joy / fulfillment / reflection / improvement / gratitude 维度完成了理论对齐深化
- 五个维度标题都已接入语义短标题治理
- 用户边界优先级高于槽位完整度，材料不足时会进入低压选择
- improvement / gratitude 已完成专属结构、AI 抽取独立化、fallback 抽取、访谈推进、专属提问策略、完成收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例，但仍需要端到端产品验收
- `transcribe` 是 stub
- `interview.service.ts` 仍是 joy-first 的导出层
- joy 正文生成还会继续做风格优化
- `/api/daily-journal*` 是当天整合日志的查询、生成、草稿更新和保存接口。
- `/interview?...&mode=daily-journal` 只进入当天整合日志主区，不会启动或创建新的维度访谈 session；点击“回到访谈”会移除 `mode` 并恢复同一日期的普通访谈 hydrate。
- calendar 功能当前已完成 month / week / day 三层：
  - `InterviewSession.entryDate`
  - `CalendarDayRecord / CalendarWeekRecord / CalendarMonthRecord`
  - `calendar.repository.ts`
  - `calendar.service.ts`
  - `GET /api/calendar/day|week|month`
  - `/calendar?view=month|week|day&date=YYYY-MM-DD`
  - `SiteHeader` 当前是全宽暖色工具栏，中区是唯一的全局 calendar 导航入口，承接视图切换、前后翻段、回到今天和实时摘要；calendar toolbar 直接平铺在 header 里，不再套内层方框；主导航当前页使用贴近文字的暖棕实线下划线
  - calendar 正文里已经没有旧的翻月 / 翻周 / 翻日按钮
  - 页面本身默认不应长滚动；超量内容应进入 pane 内局部滚动
  - calendar 文案已切到工作台短句语气，英文眉题已删除
  - 月格可见文字层当前按“已保存结果优先”显示：单字 `悦 / 实 / 思 / 改 / 谢` 或 `已完成`
  - 周视图、日视图和月视图右侧当天检查面板的可见维度 badge 也已统一改成单字；辅助技术仍保留完整维度名
  - month / week / day / toolbar 已补 `aria-busy`、loading `status`、error `alert`、focus-visible 和主要 CTA 的可访问名称
  - 日视图按五维紧凑操作台组织，不做时间轴，也不内联正文编辑
- `/analysis?month=YYYY-MM&section=score|rhythm|insights` 当前已接入 `saved` 日志的评分分区、本月记录热力图、主线维度式五维洞察、幸福 8 要素评分录入和轻量 SVG 评分趋势图；`PUT /api/happiness-score` 只允许保存今天和昨天，AI 洞察仍未接入
