# 上线前手动验收矩阵

> **For Codex / Worktree / Subagent:** 本文件是用例级手动验收清单。执行验收前先读本文件；发现问题后写入 [上线前问题池](./2026-05-17-launch-issue-tracker.md)。

关联文档：
- [上线前推进总计划](./2026-05-17-launch-plan.md)
- [上线前问题池](./2026-05-17-launch-issue-tracker.md)

## 用例字段规范

每条用例固定记录：
- `用例 ID`
- `批次`
- `模块`
- `优先级`
- `入口`
- `前置条件`
- `操作步骤`
- `预期结果`
- `失败归类`

失败归类只允许：
- `Bug`
- `缺失功能`
- `体验缺口`
- `数据风险`
- `上线阻断`

---

## 批次 1：账户与数据安全

### A-01 注册页协议约束

- `用例 ID`：`A-01`
- `模块`：账户与数据安全
- `优先级`：`P0`
- `入口`：`/register`
- `前置条件`：当前未登录
- `操作步骤`：
  1. 打开 `/register`
  2. 只填写用户名、密码、确认密码
  3. 不勾选协议，观察“创建账户”按钮
  4. 分别点击《用户协议》《隐私政策》链接
- `预期结果`：
  - 未勾选协议时无法提交
  - 两个协议链接都可打开到正确页面
- `失败归类`：`Bug / 缺失功能 / 上线阻断`

### A-02 注册成功自动进入私有主区

- `用例 ID`：`A-02`
- `模块`：账户与数据安全
- `优先级`：`P0`
- `入口`：`/register`
- `前置条件`：使用一个未注册的新用户名
- `操作步骤`：
  1. 填写合法用户名和密码
  2. 勾选两个协议
  3. 提交注册
- `预期结果`：
  - 注册成功
  - 自动进入 `/interview`
  - 出现私有用户工作区而不是仍停留在登录/注册页
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### A-03 登录与 next 跳转

- `用例 ID`：`A-03`
- `模块`：账户与数据安全
- `优先级`：`P0`
- `入口`：`/login?next=%2Fcalendar`
- `前置条件`：已有可登录账号，当前未登录
- `操作步骤`：
  1. 打开 `/login?next=%2Fcalendar`
  2. 输入正确账号密码并提交
- `预期结果`：
  - 登录成功
  - 跳转到 `/calendar` 而不是默认 `/interview`
- `失败归类`：`Bug / 上线阻断`

### A-04 未登录守卫

- `用例 ID`：`A-04`
- `模块`：账户与数据安全
- `优先级`：`P0`
- `入口`：`/interview`、`/calendar`、`/analysis`、`/profile`、`/settings`、`/settings/account`
- `前置条件`：当前未登录
- `操作步骤`：
  1. 依次直接打开上述私有页面
- `预期结果`：
  - 全部被重定向到 `/login?next=...`
  - `next` 保留原目标路径
- `失败归类`：`Bug / 上线阻断`

### A-05 已登录访问登录/注册页

- `用例 ID`：`A-05`
- `模块`：账户与数据安全
- `优先级`：`P1`
- `入口`：`/login`、`/register`
- `前置条件`：当前已登录
- `操作步骤`：
  1. 打开 `/login`
  2. 打开 `/register`
- `预期结果`：
  - 不应继续停留在认证页
  - 优先返回 `next`，否则回到 `/interview`
- `失败归类`：`Bug / 体验缺口`

### A-06 退出登录

- `用例 ID`：`A-06`
- `模块`：账户与数据安全
- `优先级`：`P0`
- `入口`：`/settings/account`
- `前置条件`：当前已登录
- `操作步骤`：
  1. 打开 `/settings/account`
  2. 执行退出登录
  3. 再访问 `/interview`
- `预期结果`：
  - 成功退出
  - 再次访问私有页时被拦截到登录页
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### A-07 多账号不串线

- `用例 ID`：`A-07`
- `模块`：账户与数据安全
- `优先级`：`P0`
- `入口`：`/interview`
- `前置条件`：准备两个账号
- `操作步骤`：
  1. 登录账号 A，进入任一维度并留下一些进行中状态
  2. 退出
  3. 登录账号 B
  4. 观察访谈恢复、上次维度、当天状态
- `预期结果`：
  - 账号 B 不应恢复账号 A 的会话、本地缓存、上次维度或日志状态
- `失败归类`：`数据风险 / 上线阻断`

### A-08 删号级联

- `用例 ID`：`A-08`
- `模块`：账户与数据安全
- `优先级`：`P0`
- `入口`：`/settings/account`
- `前置条件`：该账号下已有访谈、日志、评分或画像数据
- `操作步骤`：
  1. 打开 `/settings/account`
  2. 输入当前密码执行删除账号
  3. 观察跳转结果
  4. 使用原账号尝试再次登录
- `预期结果`：
  - 删号成功
  - 跳回注册或登录入口
  - 原账号不能再登录
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### 批次 1 执行记录（2026-05-17）

| 用例 ID | 结果 | 证据摘要 | 备注 |
|---|---|---|---|
| `A-01` | `通过` | `/register` 页面实测按钮在未勾选协议时保持禁用；直接调用 `POST /api/auth/register` 且不带 `acceptedTerms/acceptedPrivacy` 返回 `400 INVALID_REGISTER_REQUEST`；`/legal/terms` 与 `/legal/privacy` 均返回 `200` | 页面层和接口层都满足约束 |
| `A-02` | `通过` | 真实注册新账号 A、B、C 均返回 `200`，写入 `dl_session` cookie，并可继续访问私有 API/页面 | 主要证据来自真实注册链路和后续私有页访问 |
| `A-03` | `通过` | 已登录态访问 `/login?next=%2Fcalendar` 返回 `307` 到 `/calendar`；登录页客户端实现使用 `router.push(normalizeAuthRedirectPath(nextPath))` | 服务器跳转和前端实现一致 |
| `A-04` | `通过` | 未登录访问 `/interview`、`/calendar`、`/analysis`、`/profile`、`/settings`、`/settings/account` 均返回 `307` 到 `/login?next=...` | `analysis` 的 `next` 归一化为 `/analysis`，不保留查询参数，符合当前守卫实现 |
| `A-05` | `通过` | 已登录态访问 `/login`、`/register` 均返回 `307` 到 `/interview`；已登录态访问 `/login?next=%2Fcalendar` 返回 `307` 到 `/calendar` | 与产品约定一致 |
| `A-06` | `通过` | `POST /api/auth/logout` 后返回清空 `dl_session` 的 cookie；随后 `GET /api/auth/session` 返回 `authenticated=false`；再访问 `/interview` 返回 `307 /login?next=%2Finterview` | 退出链路闭环成立 |
| `A-07` | `通过` | 代码与运行时联合验证：本地恢复 key 通过 `getScopedLocalStorageKey(..., userId)` 按账号隔离；`logout` 会清理当前账号作用域下的恢复 key 和 `hs-auth-user-id`；同一轮验收中账号 A 与账号 B 的服务端 session 分离，B 删除后 session 为空 | 本条目前以实现核验 + 运行态证据为主，后续批次若继续浏览器长链回归，可顺手再补一次纯页面切号观察 |
| `A-08` | `通过` | 为账号 C 真实创建评分、画像、访谈 session 后执行删号；删除前数据库计数：`user=1 auth=1 session=1 score=1 memory=1 portrait=0`，删除后计数全部归零；原账号再次登录返回 `401 INVALID_CREDENTIALS` | 级联删除闭环成立 |

批次 1 结论：
- 本批 `A-01` 到 `A-08` 全部通过。
- 本轮未发现需要写入问题池的 `P0 / P1 / P2` 缺陷。
- 可进入批次 2：核心记录主链路。

---

## 批次 2A：核心记录主链路

### B-01 五维新建访谈可启动

- `用例 ID`：`B-01`
- `模块`：核心记录主链路
- `优先级`：`P0`
- `入口`：`/interview?dimension=joy|fulfillment|reflection|improvement|gratitude`
- `前置条件`：当前已登录
- `操作步骤`：
  1. 依次进入五个维度入口
  2. 每个维度发送至少 1 条用户消息
- `预期结果`：
  - 五个维度都能正常开始
  - 页面能显示思路层与正式追问，而不是报错或无响应
- `失败归类`：`Bug / 上线阻断`

### B-02 访谈分岔点动作可用

- `用例 ID`：`B-02`
- `模块`：核心记录主链路
- `优先级`：`P0`
- `入口`：任一维度访谈页
- `前置条件`：访谈推进到出现 choice card
- `操作步骤`：
  1. 触发一次 `继续深聊`
  2. 触发一次 `下一件 / 换一个片段`
  3. 触发一次 `直接整理成日志` 或同义动作
- `预期结果`：
  - choice card 的动作都能进入对应分支
  - 不会点击无效、重复卡死或切到错误维度
- `失败归类`：`Bug / 上线阻断`

### B-03 单篇日志生成

- `用例 ID`：`B-03`
- `模块`：核心记录主链路
- `优先级`：`P0`
- `入口`：任一维度访谈页
- `前置条件`：已有足够材料触发生成
- `操作步骤`：
  1. 点击“生成日志”
  2. 观察阶段状态
  3. 等待右侧编辑区出现草稿
- `预期结果`：
  - 会出现阶段式生成状态
  - 右侧出现日志正文草稿，而不是结构化槽位
- `失败归类`：`Bug / 缺失功能 / 上线阻断`

### B-04 单篇日志编辑与保存

- `用例 ID`：`B-04`
- `模块`：核心记录主链路
- `优先级`：`P0`
- `入口`：已生成的单篇日志编辑区
- `前置条件`：已有草稿
- `操作步骤`：
  1. 修改标题
  2. 修改正文
  3. 执行保存正式日志
- `预期结果`：
  - 标题与正文可编辑
  - 保存后状态成为 `saved`
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### B-05 完整日志入口与来源约束

- `用例 ID`：`B-05`
- `模块`：核心记录主链路
- `优先级`：`P0`
- `入口`：访谈页顶部“完整日志”
- `前置条件`：同一天至少已有 1 篇已保存维度日志
- `操作步骤`：
  1. 点击顶部“完整日志”
  2. 观察工作区切换
  3. 观察来源索引与状态文案
- `预期结果`：
  - 能进入 `daily-journal` 工作区
  - 来源只统计已保存维度日志
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### B-06 完整日志生成与保存

- `用例 ID`：`B-06`
- `模块`：核心记录主链路
- `优先级`：`P0`
- `入口`：当天完整日志工作区
- `前置条件`：同一天至少已有 2 个维度的 `saved` 日志
- `操作步骤`：
  1. 点击“整理总日志”
  2. 观察三阶段生成状态
  3. 编辑总日志标题或正文
  4. 保存
- `预期结果`：
  - 总日志可生成
  - 可编辑并保存为 `saved`
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### B-07 五维最小功能闭环

- `用例 ID`：`B-07`
- `模块`：核心记录主链路
- `优先级`：`P0`
- `入口`：五个维度的访谈页
- `前置条件`：当前已登录
- `操作步骤`：
  1. `joy` 完成一次“访谈 -> 日志 -> 保存”
  2. 对 `fulfillment`、`reflection`、`improvement`、`gratitude` 分别重复一次
- `预期结果`：
  - 五个维度都能独立跑通最小功能闭环
  - 此用例只判断“能否跑通”，不替代 AI 访谈质量验收
- `失败归类`：`Bug / 上线阻断`

### 批次 2A 执行记录（2026-05-18）

| 用例 ID | 结果 | 证据摘要 | 备注 |
|---|---|---|---|
| `B-01` | `通过` | `POST /api/interview/session/start` 在 `127.0.0.1:3001` 上实测 `joy / fulfillment / reflection / improvement / gratitude` 五维均返回 `200`，opening question + session 正常返回 | 关联问题见 `ISSUE-002`，已完成回归 |
| `B-02` | `通过` | 以 `improvement` 的 `boundary_insufficient` 样本做 API 级验证：发送“今天很糟，我需要改进。别问了。”后，`pendingDecision.actions` 返回 `continue_current_event / next_event / pause_session`；`continue_current_event` 返回 `200`，原 event 进入 `probe_pattern`、`explorationRound=2`；修复后 `next_event` 返回 `200`，原 event `completed`，新 event `sequence=2`、`stage=collect_event`，opening question 为“如果今天还有另一个你想复盘的改进情境，我们就聊那件事。那一刻发生了什么？” | 修复前 `next_event` 稳定返回 `409 SESSION_CHOICE_UNAVAILABLE`，已记录为 `ISSUE-003` 并回归通过 |
| `B-03` | `通过` | 已有 API 级 `200` 证据，`POST /api/interview/session/draft/generate` 返回 draft entry + session | 由上一轮验收提供 |
| `B-04` | `通过` | 已有 API 级 `200` 证据，`POST /api/interview/session/draft/save` 返回 `saved` journal entry + session | 由上一轮验收提供 |
| `B-05` | `通过（API 级）` | 隔离账号同一天保存 2 篇维度日志后，`GET /api/daily-journal?date=2026-05-18` 返回 `200`，`state=none`、`availableSourceCount=2`，`sources.dimension=[joy, fulfillment]`，且此时 `dailyJournal=null` | 本轮补齐的是来源约束与状态证据；顶部入口和工作区切换的页面级观察可在后续 C-04/C-05 联动回归时再补一遍 |
| `B-06` | `通过（API 级）` | 基于同一账号与同一天来源，`POST /api/daily-journal/generate` 返回 `200`，生成 `draft` 状态的当天日志，`sourceEntryIds/sourceSessionIds` 只包含当天 2 篇 `saved` 维度日志；随后 `POST /api/daily-journal/<id>/save` 返回 `200`，再次 `GET /api/daily-journal?date=2026-05-18` 返回 `state=saved` | 生成链路在未配置外部模型时走 fallback draft，仍完成草稿生成与正式保存闭环 |
| `B-07` | `通过` | `joy` 已完成 API 级“访谈 -> 日志 -> 保存”闭环，并验证 partial 标题为 `清醒地开始`；`reflection` 已完成 API 级闭环，标题为 `忙碌不等于进展`；`improvement` 与 `gratitude` 的真实 `generate -> save` 闭环分别保存为 `先听完再回应`、`被认真理解`；本轮补齐 `fulfillment` 真实闭环：`127.0.0.1:3001` 上 `generate -> save` 均返回 `200`，最终 `saved` 标题为 `主线终于理顺`。 | 五维“访谈 -> 日志 -> 保存”最小功能闭环现已全部打通；AI 质量结论已单独记录在 `AI-01 ~ AI-05`。 |

---

## 批次 2B：AI 访谈效果验收

> 本批不再只看“能不能生成日志”，而是验证当前 AI 访谈是否符合各维度理论目标、partial / boundary 收束、标题治理和质量门约束。  
> 当前标准来自：`docs/operator-runbook.md`、`docs/integration-guide.md`、`docs/theory/*-alignment.md`。

### AI-01 joy 访谈效果

- `用例 ID`：`AI-01`
- `模块`：AI 访谈效果验收
- `优先级`：`P0`
- `入口`：`/interview?dimension=joy`
- `前置条件`：当前已登录；可使用 `清除对话记录` 重开 joy 会话
- `操作步骤`：
  1. 输入“今天早起了半小时，洗漱不赶，路上还多买了杯热豆浆，感觉整个人清醒一点。”
  2. 观察追问、choice 和生成出的标题
  3. 再测试一轮：已有 `joyMoment + joySource + stateShift|meaningNeed` 后，用户说“别追问了，直接整理”
  4. 再测试一轮：只给出抽象 `delightSignature` 候选，例如“清醒 / 从容 / 有准备 / 动作本身带来的确定性”
- `预期结果`：
  - 标题应收束为 `清醒地开始` 这类自然短标题，不是 `一下被带轻 / 象征意义 / 确定性`
  - 材料已够时，用户要求直接整理，应进入 partial 当前版本日志
  - 抽象 `delightSignature` 不应被当成可信闭合，不应过早进入生成日志
  - 正文和 fallback draft 不应出现“更像轻快乐 / 关键不是深意义”这类内部理论腔
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### AI-02 fulfillment 访谈效果

- `用例 ID`：`AI-02`
- `模块`：AI 访谈效果验收
- `优先级`：`P0`
- `入口`：`/interview?dimension=fulfillment`
- `前置条件`：当前已登录；可使用 `清除对话记录` 重开 fulfillment 会话
- `操作步骤`：
  1. 覆盖“推进完成型”样本
  2. 覆盖“投入积累型”样本
  3. 覆盖“协作贡献型”样本
  4. 输入只有忙和会议的空忙样本
  5. 在已有 `experience + progressEvidence` 后说“先这样，直接生成日志”
  6. 在只有模糊 `experience` 时说“别问了”
- `预期结果`：
  - 三类样本都能围绕“今天为什么不算白过”推进
  - 空忙样本不应硬写进展证据或值得感标准
  - `experience + progressEvidence` 成立后可进入 partial
  - 材料不足时进入 `boundary_insufficient`，展示“只补一句 / 换一个片段 / 先退出”
  - 标题不应是长事件句截断
  - draft 不应写成口号、汇报腔或强行拔高值得感
- `失败归类`：`Bug / 数据风险 / 上线阻断`

当前补充观察（2026-05-18）：
- 当样本只有 `experience`，用户又立刻要求“直接整理成日志”时，当前会稳定进入 `boundary_insufficient`，并返回“只补一句 / 换一个片段 / 先退出”语义。
- 修复 `ISSUE-004` 后，这类材料不足样本已不能再通过 API 直接生成 draft；会返回 `409 DRAFT_GENERATE_NOT_READY`。
- `推进完成型` 正向样本现已稳定进入 `event_complete`，`draftGenerationUnlocked=true`，真实 complete 样本 draft 标题为 `主线终于理顺`；partial 样本在 `experience + progressEvidence` 成立且用户要求直接整理时，会进入 `event_complete(user_override_partial)`，标题收束为 `把事情往前推`。
- 当前问题池中 `ISSUE-005`、`ISSUE-006` 均已回归通过；本条此前暴露的主逻辑问题已关闭。
- 本条当前判定：`AI-02 通过`。

### AI-03 reflection 访谈效果

- `用例 ID`：`AI-03`
- `模块`：AI 访谈效果验收
- `优先级`：`P0`
- `入口`：`/interview?dimension=reflection`
- `前置条件`：当前已登录；可使用 `清除对话记录` 重开 reflection 会话
- `操作步骤`：
  1. 覆盖“规律发现型”样本
  2. 覆盖“方向优势型”样本
  3. 覆盖“判断校准型”样本
  4. 输入只有“今天想了很多 / 有点焦虑”的空泛样本
  5. 在已有 `trigger + insight` 后说“先这样，直接生成日志”
  6. 测一次“上一轮已回答没有具体经历 / 对话，再点继续深聊”
- `预期结果`：
  - 三类样本都围绕“看见新的判断依据”推进
  - 空泛样本不应硬写触发片段或判断线索
  - `trigger + insight` 成立后可进入 partial
  - 材料不足时进入 `boundary_insufficient`
  - 已明确说“没有具体经历 / 对话”后，再次深聊时不能重复追同一字段
  - 标题应收成“忙碌不等于进展”“判断依据变清楚”这类短标题，而不是长句截断
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### AI-04 improvement 访谈效果

- `用例 ID`：`AI-04`
- `模块`：AI 访谈效果验收
- `优先级`：`P0`
- `入口`：`/interview?dimension=improvement`
- `前置条件`：当前已登录；可使用 `清除对话记录` 重开 improvement 会话
- `操作步骤`：
  1. 覆盖 `avoid_bad` 样本
  2. 覆盖 `repeat_good` 样本
  3. 覆盖 track-only 中间态
  4. 覆盖自责输入
  5. 覆盖空泛动作输入
  6. 在已有 `situation + frictionPoint|repeatCondition` 后说“别追问了，直接整理”
  7. 输入“今天很糟，我需要改进。别问了。”
- `预期结果`：
  - `avoid_bad` 应抽出具体 `frictionPoint / controllableFactor / nextAttempt`
  - `repeat_good` 应抽出 `repeatCondition`，不强行补 `frictionPoint`
  - track-only 中间态不能硬抽完整字段，也不能过早进入生成日志
  - 自责输入不应被当成 `frictionPoint`
  - `nextAttempt` 不能是“我要变好 / 我要努力”
  - partial 场景进入 `user_override_partial`
  - 材料不足时进入 `boundary_insufficient`
  - 提问口吻不能落入建议、计划或归责腔
  - 标题应收成 `先听完再回应 / 把节奏放稳 / 把边界说清楚` 这类短标题
- `失败归类`：`Bug / 数据风险 / 上线阻断`

当前补充观察（2026-05-18）：
- 当样本只够到 `situation + improvementTrack`，用户立刻要求整理时，当前会进入 `boundary_insufficient`，不会再被接口层错误放行成 draft。
- 材料不足样本即使偶发出现可读标题，也不会被记为质量通过证据，仍以 partial/complete 准入为准。
- 本轮真实回归确认：`avoid_bad` 样本可走到 `event_complete + complete`，`draft/generate` 与 `draft/save` 都返回 `200`，标题为 `先听完再回应`；`repeat_good` 样本也已可走到 `event_complete + complete`，真实 draft 标题为 `开工前定主线`，并保留 `repeatCondition / controllableFactor / nextAttempt`。
- 当前问题池中 `ISSUE-007` 已回归通过；此前的中间态抽取不稳、重复前缀和正文重复问题均已收敛到可接受范围内。
- 本条当前判定：`AI-04 通过`。

### AI-05 gratitude 访谈效果

- `用例 ID`：`AI-05`
- `模块`：AI 访谈效果验收
- `优先级`：`P0`
- `入口`：`/interview?dimension=gratitude`
- `前置条件`：当前已登录；可使用 `清除对话记录` 重开 gratitude 会话
- `操作步骤`：
  1. 覆盖“支持回应型”样本
  2. 覆盖“理解体谅型”样本
  3. 覆盖“信任机会型”样本
  4. 输入只有“今天挺感谢大家的”的空泛样本
  5. 在已有 `gratitudeMoment + kindAction + seenNeed|gratitudeReason` 后说“先这样，直接整理成日志”
  6. 输入“我也说不上来，就是想感谢一下。别问了。”
  7. 测一轮 stitched 多事件，确认 supporting moment 在 draft / fallback 中都不丢
- `预期结果`：
  - 能围绕“谁回应了我的需要，以及为什么值得珍惜”推进
  - 空泛感谢不应硬写 `seenNeed / gratitudeReason / relationshipSignal`
  - partial 场景进入 `user_override_partial`
  - 材料不足时进入 `boundary_insufficient`
  - draft 不应写成感谢信、道德负债或以后一定回报的自我要求
  - 标题不应生成 `感谢日志 / 谢谢你 / 今天很感恩`
  - stitched 多事件下，supporting moment 在 fallback 中也应保留，而不是退化成只剩主事件
- `失败归类`：`Bug / 数据风险 / 上线阻断`

当前补充观察（2026-05-18）：
- 当样本只有 `gratitudeMoment + kindAction`，还没说清 `seenNeed / gratitudeReason` 时，当前会进入 `boundary_insufficient`；修复 `ISSUE-004` 后，接口已不能再直接生成并保存 draft。
- 材料不足样本即使出现合理标题，也不作为 gratitude 质量通过证据。
- 本轮真实回归确认：支持回应型样本可走到 `event_complete + user_override_partial`，`draft/generate` 与 `draft/save` 均返回 `200`，标题为 `被认真理解`；`gratitudeTarget` 已收敛为 `同事`，正文已去除“的是她没有只说辛苦了 / 被看见了被看见了”类病句。
- 当前问题池中 `ISSUE-008` 已回归通过；剩余只有一处轻微文风生硬表达“也让我不用硬撑着一边听一边记”，可归入上线后打磨，不再构成阻断。
- 本条当前判定：`AI-05 通过`。

---

## 批次 3：状态恢复与工作区切换

### C-01 刷新恢复进行中访谈

- `用例 ID`：`C-01`
- `模块`：状态恢复与工作区切换
- `优先级`：`P0`
- `入口`：任一进行中的访谈页
- `前置条件`：已有进行中 session
- `操作步骤`：
  1. 发送至少 2 轮消息
  2. 刷新页面
- `预期结果`：
  - 会话可恢复
  - 已有消息、当前维度、记录日期正确
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### C-02 普通 interview 入口只恢复今天

- `用例 ID`：`C-02`
- `模块`：状态恢复与工作区切换
- `优先级`：`P0`
- `入口`：`/interview`
- `前置条件`：存在一个非今天的历史未完成 session
- `操作步骤`：
  1. 直接打开 `/interview`
- `预期结果`：
  - 不应静默恢复到旧日期 session
  - 页面应代表“今天的新记录入口”
- `失败归类`：`数据风险 / 上线阻断`

### C-03 entryDate deep link 只恢复对应日期

- `用例 ID`：`C-03`
- `模块`：状态恢复与工作区切换
- `优先级`：`P0`
- `入口`：`/interview?dimension=joy&entryDate=YYYY-MM-DD`
- `前置条件`：该日期下已有对应 session 或日志
- `操作步骤`：
  1. 打开带 `entryDate` 的 deep link
  2. 刷新一次
- `预期结果`：
  - 只恢复对应日期的数据
  - 不误串到今天或别的日期
- `失败归类`：`数据风险 / 上线阻断`

### C-04 单篇日志到完整日志切换不丢编辑

- `用例 ID`：`C-04`
- `模块`：状态恢复与工作区切换
- `优先级`：`P0`
- `入口`：维度日志编辑区
- `前置条件`：已打开单篇日志，并修改了标题或正文
- `操作步骤`：
  1. 在单篇日志编辑区输入但先不手动保存
  2. 直接点击顶部“完整日志”
- `预期结果`：
  - 页面先处理 pending 编辑
  - 不静默丢掉未落盘内容
- `失败归类`：`数据风险 / 上线阻断`

### C-05 完整日志返回访谈与切维度

- `用例 ID`：`C-05`
- `模块`：状态恢复与工作区切换
- `优先级`：`P0`
- `入口`：完整日志工作区
- `前置条件`：完整日志已打开并有未保存输入
- `操作步骤`：
  1. 修改完整日志正文
  2. 返回访谈
  3. 再切换到另一个维度
- `预期结果`：
  - 先 flush pending 编辑
  - 新维度访谈不会被旧完整日志工作区遮住
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### C-06 saved / draft / stale 投影

- `用例 ID`：`C-06`
- `模块`：状态恢复与工作区切换
- `优先级`：`P1`
- `入口`：维度日志与完整日志工作区
- `前置条件`：已有一篇 `saved` 日志
- `操作步骤`：
  1. 打开一篇 `saved` 维度日志并编辑
  2. 观察是否回到 `draft`
  3. 保存后再生成完整日志
  4. 再新增或更新同日 `saved` 维度日志
- `预期结果`：
  - 已保存稿编辑后先变 `draft`
  - 完整日志在来源更新后变 `stale`
- `失败归类`：`Bug / 数据风险`

### 批次 3 执行记录（2026-05-18）

| 用例 ID | 结果 | 证据摘要 | 备注 |
|---|---|---|---|
| `C-01` | `通过` | Safari 真实页面实测：账号 `cgroup_3513469683` 在 `127.0.0.1:3001/interview?dimension=joy` 连续发送 2 轮消息后刷新；确认离页后，页面先显示“我正在把你上一次停下来的访谈接回来。”，随后恢复原消息、当前维度和 `当前记录日期：2026-05-18`。 | 进行中会话刷新恢复成立。 |
| `C-02` | `通过` | Safari 真实页面实测：账号 `c23_3836754892` 仅预置了 `2026-05-17` 的未完成 session，直接打开 plain `/interview` 后页面显示 `当前记录日期：2026-05-18`，没有静默恢复到昨天。 | “今天的新记录入口”语义成立。 |
| `C-03` | `通过` | Safari 真实页面实测：账号 `c23_3836754892` 打开 `http://127.0.0.1:3001/interview?dimension=joy&entryDate=2026-05-17`，页面显示 `当前记录日期：2026-05-17`；刷新后仍保持 `2026-05-17`，没有串回今天。 | deep link 只恢复对应日期。 |
| `C-04` | `通过` | Safari 真实页面实测：在 `fulfillment` 已保存单篇日志里把标题改成 `主线终于理顺 C-04`，未手动点“保存修改”，直接点击顶部“完整日志”；页面成功切到当天总日志工作区。随后接口 `GET /api/interview/session/1a69f074-95b7-410c-b3cf-0d9727d5d3cd` 返回该篇 `journalEntry.title=\"主线终于理顺 C-04\"`，且 `journalEntry.status=\"draft\"`、`savedAt=null`。 | 证明单篇日志到完整日志切换前已先 flush pending 编辑，且未丢输入。 |
| `C-05` | `通过` | Safari 真实页面实测：在当天完整日志正文末尾输入 `C-05` 标记但不手动保存，点击“回到访谈”后立即切到 `fulfillment` 维度，新维度访谈正常出现，没有被旧完整日志工作区遮住。随后接口 `GET /api/daily-journal?date=2026-05-18` 返回正文已包含 `C-05`，且该篇当天日志 `status=\"draft\"`。 | 证明完整日志返回访谈和切维度前都先处理了 pending 编辑。 |
| `C-06` | `通过` | 页面级与接口级联合验证：同一账号 `c456_3836755748` 打开当天完整日志工作区时，页面真实显示“已有总日志落后于最新来源 / 来源已更新”；接口 `GET /api/daily-journal?date=2026-05-18` 同时返回 `availableSourceCount=2`、`state=\"stale\"`。在 `fulfillment` 已保存单篇日志编辑后，接口再返回该篇 `journalEntry.status=\"draft\"`。 | 本条覆盖了“saved 编辑后先回 draft”与“来源更新后完整日志变 stale”两层投影。 |

批次 3 结论：
- `C-01` 到 `C-06` 本轮全部通过。
- 本批未发现需要新增写入问题池的 `P0 / P1` 缺陷。
- 批次 4 可继续转向异常、空态与上线阻断项。

---

## 批次 4：异常、空态与上线阻断项

### D-01 访谈失败结构化错误

- `用例 ID`：`D-01`
- `模块`：异常、空态与上线阻断项
- `优先级`：`P0`
- `入口`：访谈提交路径
- `前置条件`：制造一次可复现的提交失败
- `操作步骤`：
  1. 触发失败
  2. 观察前端错误展示
- `预期结果`：
  - 出现结构化错误信息
  - 用户能看到原因、建议、错误码或 requestId 级别信息
- `失败归类`：`Bug / 上线阻断`

### D-02 过去空白日与未来日空态

- `用例 ID`：`D-02`
- `模块`：异常、空态与上线阻断项
- `优先级`：`P1`
- `入口`：calendar 与 analysis
- `前置条件`：选择一个过去空白日和一个未来日
- `操作步骤`：
  1. 分别打开过去空白日与未来日
  2. 观察文案、动作与状态语义
- `预期结果`：
  - 过去空白日是轻空态
  - 未来日是待到来语义
  - 不误导用户为“漏记”
- `失败归类`：`Bug / 体验缺口`

### D-03 opening-only session 不误点亮

- `用例 ID`：`D-03`
- `模块`：异常、空态与上线阻断项
- `优先级`：`P1`
- `入口`：访谈页 header、calendar 当天状态
- `前置条件`：制造一个只有 opening assistant、没有用户回复的 session
- `操作步骤`：
  1. 打开对应日期或维度
  2. 观察 header 与 calendar 投影
- `预期结果`：
  - opening-only session 不应被显示为进行中
- `失败归类`：`Bug / 数据风险`

### D-04 transcribe stub 上线处理

- `用例 ID`：`D-04`
- `模块`：异常、空态与上线阻断项
- `优先级`：`P0`
- `入口`：`/api/transcribe`
- `前置条件`：无
- `操作步骤`：
  1. 确认当前实现状态
  2. 判断是否在用户可触达链路中
- `预期结果`：
  - 该能力要么被明确隐藏/禁用
  - 要么被列为上线前必须补齐
- `失败归类`：`缺失功能 / 上线阻断`

### 批次 4 当前执行记录（2026-05-18）

| 用例 ID | 结果 | 证据摘要 | 备注 |
|---|---|---|---|
| `D-01` | `通过` | 接口级与页面级联合验证：直调 `POST /api/interview/session/respond` 并传入失效 `sessionId` 后，返回 `issue.code=SESSION_NOT_FOUND`，且结构化对象完整包含 `title/message/resolution/retryable/action/requestId`。Safari 真实页面打开 `http://127.0.0.1:3001/interview?dimension=joy&sessionId=does-not-exist` 后，访谈区稳定显示结构化错误卡：“这条访谈暂时打不开 / 当前想继续的那条访谈不存在或已经失效。/ 请回到日历重新选择，或直接开始一条新的访谈。/ 错误码：SESSION_NOT_FOUND”。 | 页面级错误 notice 已补齐，结构化错误闭环成立。 |
| `D-02` | `通过` | Safari 真实页面实测：`/calendar?view=month&date=2026-05-02` 的过去空白日当天检查区显示“这一天还空着。进入当天后，可以从任一维开始。”；切到 `/calendar?view=month&date=2026-05-19` 的未来日后，页面显示“这一天还没到。到了当天再记录。”以及“五维状态：未来日期先保留。” | 过去空白日与未来日都保持中性工作台语义，没有“漏记”指责感。 |
| `D-03` | `通过（实现+测试级）` | 代码与测试联合验证：`src/features/calendar/aggregate-calendar.ts` 里的 `isOpeningOnlyCalendarSession` 会把 `status=active && messageCount<=1 && !journalEntryId && !completedAt && !pausedAt` 的空开场 session 排除出 `in_progress`；`tests/unit/calendar-aggregate.test.ts` 已显式断言 opening-only day 的 `overallStatus=empty`、`activeCount=0`、`primaryAction=null`。 | 本轮尝试为新账号现场造 opening-only 页面证据时，临时 cookie 抽取脚本未带上有效会话，没有形成额外页面截图；现有实现和单测已足以支撑本条通过。 |
| `D-04` | `通过（判定为上线前需隐藏/不走用户主链）` | 仓库检索确认没有任何前端代码调用 `/api/transcribe`，唯一实现只有 [src/app/api/transcribe/route.ts](/Users/zouzhijie/Desktop/Happiness-system-codex/.worktrees/launch-acceptance/src/app/api/transcribe/route.ts:1) 这个 stub route；无文件上传时不会进入真实转写，有文件上传时只返回“当前版本先保留接口与回退链路，下一步接入真实转写模型。”。文档 `docs/integration-guide.md`、`docs/operator-runbook.md` 也明确标注当前是 stub。 | 当前判断：它不在用户可触达主链里，因此不构成当前上线阻断；若后续开放语音入口，必须先补真实模型再重做验收。 |

批次 4 当前结论：
- `D-02`、`D-03`、`D-04` 已完成并通过。
- `D-01` 已通过真实失效会话 deep link 补齐页面级错误卡证据。
- 本批当前未新增需要写入问题池的 `P0 / P1` 缺陷。

---

## 批次 5：Calendar 回看链路

### E-01 月视图高度与 42 格稳定性

- `用例 ID`：`E-01`
- `模块`：Calendar 回看链路
- `优先级`：`P1`
- `入口`：`/calendar?view=month&date=2026-05-02`
- `前置条件`：当前已登录
- `操作步骤`：
  1. 打开月视图
  2. 检查是否固定 6 行 42 格
  3. 切换几个月份
- `预期结果`：
  - 月视图与 skeleton 高度稳定
  - 不因月份不同跳高跳低
- `失败归类`：`Bug / 体验缺口`

### E-02 月视图状态表达

- `用例 ID`：`E-02`
- `模块`：Calendar 回看链路
- `优先级`：`P1`
- `入口`：月视图
- `前置条件`：准备空白日、部分维度已保存日、五维全保存日
- `操作步骤`：
  1. 点击过去空白日
  2. 点击未来日
  3. 点击部分维度已保存日
  4. 点击五维已保存日
- `预期结果`：
  - 空白日不显示误导性的状态词
  - 未来日是中性待到来
  - 部分已保存日显示 `悦 / 实 / 思 / 改 / 谢`
  - 五维全保存日显示 `已完成`
- `失败归类`：`Bug / 体验缺口`

### E-03 周视图主动作解析

- `用例 ID`：`E-03`
- `模块`：Calendar 回看链路
- `优先级`：`P1`
- `入口`：`/calendar?view=week&date=YYYY-MM-DD`
- `前置条件`：准备包含进行中、草稿、已保存的不同日期
- `操作步骤`：
  1. 打开周视图
  2. 检查 `继续访谈 / 继续编辑 / 查看日志` 主动作
- `预期结果`：
  - 主动作会落到对应业务链路
- `失败归类`：`Bug / 数据风险`

### E-04 日视图与 deep link

- `用例 ID`：`E-04`
- `模块`：Calendar 回看链路
- `优先级`：`P0`
- `入口`：`/calendar?view=day&date=YYYY-MM-DD`
- `前置条件`：该日期已有多种状态的维度数据
- `操作步骤`：
  1. 打开日视图
  2. 点击任一维度主动作
  3. 观察跳转的 `dimension` 与 `entryDate`
- `预期结果`：
  - deep link 日期准确
  - 主动作落到正确维度与正确日期
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### 批次 5 当前执行记录（2026-05-18）

| 用例 ID | 结果 | 证据摘要 | 备注 |
|---|---|---|---|
| `E-01` | `通过（页面级 + 实现级）` | 页面级：Safari 真实打开 `/calendar?view=month&date=2026-05-19` 后，月视图保持固定 6 行网格；切换周/月/日和前后日期时，主区没有出现因月份天数变化导致的跳高跳低。实现级：`src/components/calendar/calendar-month-shell.tsx` 的 loading skeleton 与正式网格都固定渲染 `42` 个 cell，且主区最小高度按 `6` 行 `--calendar-month-cell-min-height` 计算。 | 本账号当前只有 `2026-05-18` 一天有记录，页面级主要验证“固定 6 行”与切换稳定性；42 格数量的硬证据来自实现。 |
| `E-02` | `通过（页面级 + 测试级）` | 页面级：Safari 真实月视图中，过去空白日 `2026-05-02` 只显示轻空态文案，未来日 `2026-05-19` 显示“这一天还没到。到了当天再记录。”，不出现“漏记”；同一月已有记录日 `2026-05-18` 的月格显示已保存维度单字 badge `悦 / 实 / 谢`。测试级：`tests/unit/calendar-month-shell.test.tsx` 已覆盖“五维全保存日底部只显示单个 `已完成` badge，不再显示 `悦/实/思/改/谢`”的断言。 | 当前真实账号没有现成“五维全保存日”，该子场景本轮以测试级证据收口。 |
| `E-03` | `通过` | Safari 真实打开 `/calendar?view=week&date=2026-05-18` 后，`2026-05-18` 周卡显示混合状态、`悦 / 实 / 谢` badge 和主动作 `继续访谈`；该主动作真实链接到 `/interview?dimension=joy&sessionId=24de0316-8429-4ae2-8cf4-b073f4f709fa&entryDate=2026-05-18`。同页未来空白日 `2026-05-19` 的主动作是 `查看当天`，链接到 `/calendar?view=day&date=2026-05-19`，没有误暴露访谈动作。 | 当前周内没有“单独草稿日”与“单独已完成日”，但本条要点“主动作解析到正确链路”已在真实周卡上成立。 |
| `E-04` | `通过` | Safari 真实打开 `/calendar?view=day&date=2026-05-18` 后，日视图五维卡片分别暴露正确 deep link：`joy` 主动作为 `/interview?dimension=joy&sessionId=24de0316-8429-4ae2-8cf4-b073f4f709fa&entryDate=2026-05-18`，`fulfillment` 为 `/interview?dimension=fulfillment&sessionId=e02442e7-2fee-46f7-948a-a6895bcf32cc&entryDate=2026-05-18`，`reflection/improvement` 为对应维度的 `start_interview` deep link，`gratitude` 的已完成主动作指向 `/interview?dimension=gratitude&sessionId=d4b0d232-5300-40d7-a431-8eb4d43dd661&entryDate=2026-05-18&panel=journal`；周视图中的 `joy` 主动作点击后也真实落到同一日期的访谈页。 | 本条页面级闭环已覆盖“进行中 / 未记录 / 已完成”三类跳转。 |

批次 5 当前结论：
- `E-01` 到 `E-04` 已完成。
- 月视图“五维全保存日显示单个已完成”本轮缺少现成真实账号样本，已用现有单测补足该子场景证据。
- 本批当前未新增需要写入问题池的 `P0 / P1` 缺陷。

---

## 批次 6：Analysis 与评分回流

### F-01 analysis URL 归一化

- `用例 ID`：`F-01`
- `模块`：Analysis 与评分回流
- `优先级`：`P1`
- `入口`：`/analysis`
- `前置条件`：当前已登录
- `操作步骤`：
  1. 打开 `/analysis`
  2. 点击 `上月 / 下月 / 本月`
  3. 切换 `overview / score / rhythm / insights`
- `预期结果`：
  - URL 归一到 `month + section`
  - 切换月份时保留当前 section
- `失败归类`：`Bug / 体验缺口`

### F-02 overview 首屏与空态

- `用例 ID`：`F-02`
- `模块`：Analysis 与评分回流
- `优先级`：`P1`
- `入口`：`/analysis?month=YYYY-MM&section=overview`
- `前置条件`：准备一个无数据月份和一个有数据月份
- `操作步骤`：
  1. 打开无数据月份
  2. 打开有数据月份
- `预期结果`：
  - 无数据时给真实空态
  - 有数据时显示月度判断、建议先看和证据条
- `失败归类`：`Bug / 体验缺口`

### F-03 当天评分录入闭环

- `用例 ID`：`F-03`
- `模块`：Analysis 与评分回流
- `优先级`：`P0`
- `入口`：访谈页 header 的“当天评分”
- `前置条件`：当前已登录，进入任一具体日期访谈页
- `操作步骤`：
  1. 点击“当天评分”
  2. 为 8 项全部打分
  3. 点击“保存并退出”
  4. 返回 `/analysis?month=当前月&section=score`
- `预期结果`：
  - 保存前未打满不可提交
  - 保存后回到访谈工作区
  - analysis score 区能读到这次评分
- `失败归类`：`Bug / 上线阻断`

### F-04 rhythm 待整合与 stale

- `用例 ID`：`F-04`
- `模块`：Analysis 与评分回流
- `优先级`：`P0`
- `入口`：`/analysis?month=YYYY-MM&section=rhythm`
- `前置条件`：准备“只有评分无日志”“有完整日志后来源又更新”的样本
- `操作步骤`：
  1. 打开 `rhythm`
  2. 查看对应日期状态
- `预期结果`：
  - 只评分无日志显示待成文语义
  - 来源更新后的完整日志显示待更新/待整合，而不是仍显示已整合
- `失败归类`：`Bug / 数据风险 / 上线阻断`

### F-05 insights drill-down

- `用例 ID`：`F-05`
- `模块`：Analysis 与评分回流
- `优先级`：`P1`
- `入口`：`/analysis?month=YYYY-MM&section=insights`
- `前置条件`：该月已有至少 1 条可 drill-down 的数据
- `操作步骤`：
  1. 点击任一“回到某维度”链接
- `预期结果`：
  - 跳转到 `/interview?dimension=<维度>&entryDate=YYYY-MM-DD`
  - 不误跳到今天
- `失败归类`：`Bug / 数据风险`

### 批次 6 当前执行记录（2026-05-18）

| 用例 ID | 结果 | 证据摘要 | 备注 |
|---|---|---|---|
| `F-01` | `通过（修复后回归）` | 初次验收时，Safari 真实直接打开 `http://127.0.0.1:3001/analysis` 后，页面会渲染 `2026-05` 的 `overview` 内容，但地址栏实际停留在 `/analysis?month=2026-05`，没有补齐 `section=overview`；修复后再次真实打开 `/analysis`，地址栏已归一为 `/analysis?month=2026-05&section=overview`。 | `ISSUE-009` 已回归通过。 |
| `F-02` | `通过` | Safari 真实打开 `/analysis?month=2026-04&section=overview` 后，页面显示“这个月还没有开始留下分析材料。先补今天评分，或从一个维度开始记录。”、“先留下今天的第一条记录”、“0 天有材料 / 尚未形成”等真实空态；打开 `/analysis?month=2026-05&section=overview` 时，则显示“先收住5月18日”、证据条和分流入口。 | 已覆盖无数据月与有数据月两类首屏。 |
| `F-03` | `通过` | Safari 真实在 `/interview?dimension=joy&entryDate=2026-05-18` 打开“当天评分”后，初始 `保存并退出` 按钮禁用；按键录入 8 项分数后，页面提示“8项已完成，可保存并退出”，按钮解锁；点击保存后返回访谈工作区。随后打开 `/analysis?month=2026-05&section=score`，页面显示 `已评分 1 天`、`月均总分 7.0`。接口 `GET /api/analysis/month?month=2026-05` 也返回 `scoredDayCount=1`、`latestScoredDate=2026-05-18`，且 8 项分数均为 `7`。 | 本轮真实写入了 `2026-05-18` 的评分数据。 |
| `F-04` | `通过` | 主账号 Safari 真实打开 `/analysis?month=2026-05&section=rhythm` 后，toolbar chip 显示 `待整合 1 天`；热力图中的 `2026-05-18` 被标记为 `待整合 / 1维`；当天追踪区显示“已有 1 条记录，但还没有整合成日志”。补充纯评分样本：隔离账号 `f04_9085317058` 只在 `2026-05-16` 保存 8 项评分，没有创建任何维度日志；接口 `GET /api/analysis/month?month=2026-05` 返回 `rhythmOverview.scoreOnlyDayCount=1`、`latestScoreOnlyDate=2026-05-16`，对应 `dailyCoverage` 为 `hasScore=true / savedDimensionCount=0 / savedEntryCount=0`。页面级 Playwright 打开 `/analysis?month=2026-05&section=rhythm` 后显示 `待成文 1 天`、`只评未记`、`待成文日 1 天 / 最近 5月16日`，且不误显示 `待整合 1 天`。 | `待整合` 主场景和“只评分无日志 -> 待成文”子场景均已覆盖。 |
| `F-05` | `通过` | Safari 真实打开 `/analysis?month=2026-05&section=insights` 后，`gratitude` 维度卡片上的“继续这条线”真实指向 `/interview?dimension=gratitude&entryDate=2026-05-18`；页面下方“整理完整日志”真实指向 `/interview?dimension=joy&entryDate=2026-05-18&mode=daily-journal`；全程没有误跳回今天默认入口。 | 已覆盖维度 drill-down 和当天整合日志 drill-down 两类链接。 |

批次 6 当前结论：
- `F-01`、`F-02`、`F-03`、`F-04`、`F-05` 已完成并通过。
- `F-01` 初次验收发现的 URL 规范化问题已修复并回归通过。
- `F-04` 的“只评分无日志 -> 待成文”子场景已用隔离账号补齐真实 API 与页面级证据。

---

## 批次 7：Profile / Memory / 设置补充能力

### G-01 画像页空态与生成门槛

- `用例 ID`：`G-01`
- `模块`：Profile / Memory / 设置补充能力
- `优先级`：`P1`
- `入口`：`/profile`
- `前置条件`：当前账号 facts 少于 3 条
- `操作步骤`：
  1. 打开 `/profile`
  2. 保持在“画像”tab
  3. 点击“生成画像”
- `预期结果`：
  - 显示数据不足提示
  - 不会伪生成画像
- `失败归类`：`Bug / 体验缺口`

### G-02 记忆库新增与画像刷新提示

- `用例 ID`：`G-02`
- `模块`：Profile / Memory / 设置补充能力
- `优先级`：`P1`
- `入口`：`/profile`
- `前置条件`：当前已登录
- `操作步骤`：
  1. 切到“记忆库”
  2. 手动添加至少 3 条不同维度 facts
  3. 回到“画像”
  4. 生成画像
  5. 再回记忆库编辑其中一条
  6. 回到画像页
- `预期结果`：
  - 能生成画像
  - facts 变化后会提示画像数据已更新
- `失败归类`：`Bug / 体验缺口`

### G-03 演变 tab 可读

- `用例 ID`：`G-03`
- `模块`：Profile / Memory / 设置补充能力
- `优先级`：`P2`
- `入口`：`/profile`
- `前置条件`：已有画像或记忆数据
- `操作步骤`：
  1. 切到“演变”
- `预期结果`：
  - 能看到按时间组织的演变视图
  - 不报错，不空白卡死
- `失败归类`：`Bug / 体验缺口`

### G-04 设置页补充能力不影响主流程

- `用例 ID`：`G-04`
- `模块`：Profile / Memory / 设置补充能力
- `优先级`：`P2`
- `入口`：`/settings`、`/settings/account`
- `前置条件`：当前已登录
- `操作步骤`：
  1. 打开设置页
  2. 检查 memory 相关配置
  3. 再返回访谈、calendar、analysis
- `预期结果`：
  - 设置页可访问
  - 可选能力的异常不会拖垮主流程
- `失败归类`：`Bug / 体验缺口`

### 批次 7 当前执行记录（2026-05-18）

| 用例 ID | 结果 | 证据摘要 | 备注 |
|---|---|---|---|
| `G-01` | `通过` | 使用隔离账号 `g01_0904549385` 验收。API 证据：`GET /api/profile` 返回五维 facts 均为空，`GET /api/profile/portrait` 返回 `snapshot:null`，`POST /api/profile/portrait` 返回 `422 PORTRAIT_SYNTHESIS_FAILED`。Safari 真实打开 `/profile` 后，画像 tab 显示“还没有生成画像”；点击“生成画像”后出现“认知数据不足。请先通过访谈或手动添加至少 3 条认知，再生成画像。”，五维卡片仍停留在“生成画像后将显示洞察”。 | 已覆盖 facts 少于 3 条时的数据不足提示与“不伪生成画像”。 |
| `G-02` | `通过（修复后回归）` | 同一隔离账号下已通过 `/api/profile` 新增 3 条手动 facts，分别属于 `joy / fulfillment / reflection`；Safari 真实的“记忆库”tab 显示 `共 3 条`、标签云、三条用户添加的事实和编辑入口；API 编辑其中一条后，记忆库可见摘要与标签已更新。修复后，在 `.env.local` 仍缺少 `VOLCENGINE_ARK_ENDPOINT_ID` 的环境里，`POST /api/profile/portrait` 返回 `201`，生成 `factCount=3` 的 fallback snapshot；Safari 真实回到“画像”tab 后可见画像摘要和五维洞察。再次编辑其中一条 fact 后，画像页显示“认知数据已更新，建议重新生成画像以反映最新变化。” | `ISSUE-010` 已回归通过。画像 AI 直出质量仍需在真实 endpoint 配置后单独做效果验收；当前回归覆盖的是“补充能力不因 AI endpoint 缺失拖垮主流程”。 |
| `G-03` | `通过` | Safari 真实在 `/profile` 切到“演变”tab 后，页面显示“认知演变”、“共 3 条认知 · 跨越 1 个月”、“2026年5月 3 条”，并按 `思 / 实 / 悦` 展示三条事实、标签和 `2026/5/18` 日期；页面不报错、不空白卡死。 | 演变视图依赖记忆 facts，当前不依赖画像 snapshot。 |
| `G-04` | `通过` | Safari 真实打开 `/settings`，页面显示“启用历史记忆”“转写失败自动回退”和“当前配置摘要”；点击“启用历史记忆”后摘要从“记忆功能：关闭”更新为“记忆功能：开启”。`/settings/account` 可访问并显示当前账号与退出/删除入口。API 直查 `/settings`、`/settings/account`、`/interview?dimension=joy`、`/calendar?view=month&date=2026-05-18`、`/analysis?month=2026-05&section=overview` 均返回 `200`。 | 设置页的可选能力没有拖垮访谈、日历、分析主流程。 |

批次 7 当前结论：
- `G-01`、`G-03`、`G-04` 已完成并通过。
- `G-02` 初次验收发现的画像生成阻断已修复并回归通过：少于 3 条 facts 仍保留门槛，3 条 facts 后即使 AI provider 不可用也能生成 fallback snapshot，facts 编辑后能提示画像数据已更新。

### 修复回归记录（2026-05-18）

| 问题 ID | 关联用例 | 回归结果 | 证据摘要 |
|---|---|---|---|
| `ISSUE-009` | `F-01` | `通过` | Safari 真实直接打开 `/analysis` 后，地址栏归一为 `/analysis?month=2026-05&section=overview`；针对性单测 `analysis-view-state / analysis-shell / site-header-analysis` 共覆盖 URL normalize 与 toolbar 跳转。 |
| `ISSUE-010` | `G-02` | `通过` | API `POST /api/profile/portrait` 在 AI endpoint 缺失环境中对 3 条 facts 返回 `201` 和 fallback snapshot；Safari `/profile` 能展示画像，编辑 fact 后显示 stale 提示；针对性单测 `portrait-synthesis.service / portrait-view` 已覆盖 fallback 与 stale 判断。 |

### 收尾门禁记录（2026-05-18）

| 检查项 | 结果 | 证据摘要 | 备注 |
|---|---|---|---|
| `typecheck` | `通过` | `npm run typecheck` 已通过，此前 `next_event` action 类型收窄问题和 `toMatchObject` 泛型用法问题已修复。 | 修复文件：`src/server/services/interview/joy-interview.service.ts`、`tests/unit/joy-interview-response.service.test.ts`。 |
| `targeted-regression-tests` | `通过` | `npm test -- tests/unit/joy-interview-response.service.test.ts tests/unit/analysis-view-state.test.ts tests/unit/analysis-shell.test.tsx tests/unit/portrait-synthesis.service.test.ts tests/unit/portrait-view.test.tsx` 通过，`5` 个测试文件、`83` 个测试通过。 | 测试日志仍有缺少 `DATABASE_URL` 导致的 Prisma warning，但相关用例最终通过，属于当前测试环境噪声。 |
| `full-unit-tests` | `通过` | `npm test` 全量通过，`70` 个测试文件、`590` 个测试通过。 | 首轮全量测试发现 `joy-prompts.test.ts` 仍断言 fulfillment 旧字段名；已更新为 `experience / progressEvidence / valueSignal` 后重跑通过。 |

---

## 执行记录规则

执行本矩阵时：
- 每跑完一个模块，先写“通过项 / 未通过项”摘要。
- 每发现一个问题，立即写入问题池。
- 修复后必须回原用例回归，并在问题池写回归结论。
