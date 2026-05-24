# 2026-05-24 Final Regression Report

最后更新：`2026-05-25`

## 范围

- Lane：`D1`
- 域名：`https://dlight.cc.cd`
- 边界：只验证首批邀请关键主链，不做功能修改
- 本轮用例：
  - `A-02` 注册成功自动进入私有主区
  - `A-03` 登录与 `next` 跳转
  - `A-06` 退出登录
  - `B-01` 五维新建访谈可启动
  - `B-03` 单篇日志生成
  - `B-04` 单篇日志编辑与保存
  - `B-05` 完整日志入口与来源约束
  - `B-06` 完整日志生成 / 保存
  - `B-07` 五维最小闭环是否仍成立

## 当前状态

- 执行完成
- 当前结论：`主链可继续`

## 已完成用例与结果

- `A-02` 注册成功自动进入私有主区：`通过（API + 前端跳转逻辑补证）`
  - `2026-05-24` 对 `https://dlight.cc.cd` 运行现有 `product-smoke`，`register` 返回 `200`，已建立 `dl_session` cookie。
  - 同一脚本后续 `session` 与 `start` 均返回 `200`，说明注册出的账户已可直接进入私有链路。
  - 前端代码补证：`src/components/auth/register-page-client.tsx` 在注册成功后执行 `router.push(normalizeAuthRedirectPath(nextPath))`；`src/features/auth/auth-local.ts` 在 `nextPath` 为空时回退到 `/interview`。
- `A-03` 登录与 `next` 跳转：`通过（HTTP + 前端逻辑 + 单测补证）`
  - 线上未登录访问 `/interview` 返回 `307 -> /login?next=%2Finterview`。
  - 线上未登录访问 `/calendar?view=day&date=2026-05-24` 返回 `307 -> /login?next=%2Fcalendar`。
  - 使用真实账号 `laned1auth_3424972322` 登录后，请求 `GET /calendar?view=day&date=2026-05-24` 返回 `200`，响应头 `x-matched-path=/calendar`，没有再次重定向。
  - 前端代码补证：`src/components/auth/login-page-client.tsx` 登录成功后执行 `router.push(normalizeAuthRedirectPath(nextPath))`。
  - 单测补证：`tests/unit/auth-page-client.test.tsx` 已覆盖 `nextPath` 成功跳转；当前样例验证 `LoginPageClient nextPath=\"/analysis?month=2026-05\"` 会调用 `router.push(nextPath)`，`RegisterPageClient nextPath=\"/calendar\"` 会调用 `router.push(\"/calendar\")`。
- `A-06` 退出登录：`通过（API + 前端行为补证）`
  - 使用真实登录 cookie 调用 `POST /api/auth/logout` 返回 `200`，并返回清空 cookie：`dl_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax`。
  - 对同一旧 cookie 继续请求 `GET /api/auth/session` 返回 `authenticated=false`、`user=null`。
  - 对同一旧 cookie 继续请求 `/interview` 返回 `307 -> /login?next=%2Finterview`。
  - 前端补证：`src/components/auth/account-settings-client.tsx` 退出成功后会清空本地 auth / interview cache，并跳回 `/login`。
  - 单测补证：`tests/unit/account-settings-client.test.tsx` 已覆盖退出后清本地状态并跳回 `/login`。
- `B-01` 五维新建访谈可启动：`通过`
  - `joy`：`product-smoke` 已验证 `POST /api/interview/session/start -> 200`，`stage=collect_event`。
  - `fulfillment / reflection / improvement / gratitude`：使用真实登录账号 `laned1auth_3424972322` 逐维调用 `POST /api/interview/session/start`，四个维度均返回 `200`，均进入 `stage=collect_event`，`draftGenerationUnlocked=false`，没有额外错误。
- `B-03` 单篇日志生成：`通过（fulfillment）`
  - 使用真实账号 `laned1full_3553480523`，在 `fulfillment` 维度依次提交：
    - “今天下午我把拖了两天的发布说明梳理完了，前后逻辑终于顺了。”
    - “最有分量的是我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂。”
    - “对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数。”
  - 第三轮后进入 `pendingDecision.kind=event_complete`、`completionMode=complete`、`draftGenerationUnlocked=true`。
  - `POST /api/interview/session/draft/generate` 返回 `200`，标题为 `主线终于理顺`，草稿状态为 `draft`。
- `B-04` 单篇日志编辑与保存：`通过（fulfillment）`
  - 初次回归时，我误用了不完整请求体，`PUT /api/journal-entry/[id]` 返回 `400`；复查 schema 后确认是回归脚本请求体不完整，不是产品缺陷。
  - 复跑使用完整 draft payload：真实账号 `laned1edit_3633000975` 的 `PUT /api/journal-entry/[id]` 返回 `200`，标题更新为 `主线回归稿`，`source=ai_draft_edited`，正文尾部保留 `回归编辑确认。`。
  - 随后 `POST /api/interview/session/draft/save` 返回 `200`，标题仍为 `主线回归稿`，状态变为 `saved`，`savedAt` 已写入。
- `B-05` 完整日志入口与来源约束：`通过（API 证据）`
  - 在当天没有任何已保存维度日志时，真实账号 `laned1jrnl_3501634350` 调用 `POST /api/daily-journal/generate` 返回 `409 DAILY_JOURNAL_SOURCE_EMPTY`，提示“当天还没有已保存的维度日志，先保存至少一篇维度日志后再生成。”
  - 在 `fulfillment` 单篇日志保存成功后，真实账号 `laned1full_3553480523` 调用 `GET /api/daily-journal?date=2026-05-24` 返回 `200`，`availableSourceCount=1`，`state=none`，`sources.dimension=[fulfillment]`。
  - 当前证明来源约束生效：没有 saved source 时不允许生成；有 1 条 saved source 时，完整日志只看到这 1 条来源。
  - 前端入口补证：`tests/unit/interview-shell.test.tsx` 已覆盖顶部“查看汇总当天日志”按钮会把主工作区切到 `daily-journal-workspace`，并请求 `GET /api/daily-journal?date=<entryDate>`。
  - 同一组单测还覆盖了：
    - 进入完整日志工作区时显示 loading / editor
    - 从完整日志返回访谈时先 flush 未保存编辑
    - 从单篇日志切到完整日志前，先 flush 单篇日志未保存编辑
- `B-06` 完整日志生成 / 保存：`通过（fulfillment 单来源场景）`
  - 基于上面同一账号 `laned1full_3553480523`，调用 `POST /api/daily-journal/generate` 返回 `200`，`state=draft`，`availableSourceCount=1`，来源维度仍为 `[fulfillment]`，标题为 `今天的记录`。
  - 随后 `POST /api/daily-journal/{id}/save` 返回 `200`，完整日志状态变为 `saved`，`savedAt` 已写入。
- `B-07` 五维最小闭环是否仍成立：`通过`
  - `joy`：初版最短样本材料不足，停在 `boundary_insufficient`，`draft/generate -> 409 DRAFT_GENERATE_NOT_READY`；换用更贴近既有通过样本的四轮最短路径后，进入 `event_complete(user_override_partial)`，`generate -> 200`，`save -> 200`，标题为 `清醒地开始`。
  - `fulfillment`：本轮真实 API 已跑通 `generate -> 200`、`save -> 200`，标题为 `主线终于理顺`。
  - `reflection`：本轮真实 API 已跑通 `event_complete(user_override_partial)`，`generate -> 200`、`save -> 200`，标题为 `忙碌不等于进展`。
  - `improvement`：初版最短样本材料不足，停在 `boundary_insufficient`，`draft/generate -> 409 DRAFT_GENERATE_NOT_READY`；换用更贴近既有通过样本的 `repeat_good` 路径后，进入 `event_complete(complete)`，`generate -> 200`、`save -> 200`，标题为 `把节奏放稳`。
  - `gratitude`：本轮真实 API 已跑通 `event_complete(user_override_partial)`，`generate -> 200`、`save -> 200`，标题为 `被稳稳接住`。
  - 结论：五维“访谈 -> 日志生成 -> 保存”最小闭环在 `https://dlight.cc.cd` 仍成立；本轮 `joy / improvement` 的首次失败来自样本材料不足，不是接口或主链回归损坏。

## 部分完成中的用例

- 无。

## 新 blocker

- 暂无新的产品级 blocker。
- 当前仅遇到回归执行层问题：整合版 Node heredoc 首次执行时被 shell 提前展开模板字符串，导致脚本失败。这个问题发生在本地回归脚本引用层，不是站点产品缺陷；后续改为分步执行继续补证。

## 当前主链判断

- 当前主链可继续：`是`
- 依据：
  - 账户主链 `A-02 / A-03 / A-06` 当前均已补到真实线上证据。
  - 访谈启动 `B-01` 五维当前均可成功创建会话。
  - 单篇日志 `B-03 / B-04` 已至少在 `fulfillment` 维度跑通“生成 -> 编辑 -> 保存”。
  - 完整日志 `B-05 / B-06` 已至少在“单来源 fulfillment”场景跑通“入口补证 -> 来源约束 -> 生成 -> 保存”。
  - 五维 `B-07` 本轮最新 API 闭环已全部补齐，没有出现新的产品级阻断。
- 仍待补齐的证据：
  - 本轮仍以 API 级和现有前端单测为主，缺少人工浏览器逐点击穿“登录页 -> `/calendar` -> 访谈页顶部完整日志入口”这一条视觉层直接证据。
  - 如果发版前还要补最后一层人工观感确认，应把这个缺口留给浏览器人工 smoke，而不是作为当前主链阻断。

## 过程记录

### 2026-05-24 初始化

- 已确认 worktree：`/Users/zouzhijie/Desktop/Happiness-system-codex/.worktrees/launch-lane-d-regression`
- 已确认可复用脚本：
  - `scripts/product-smoke.mjs`
  - `scripts/launch-acceptance-runner.mjs`
- 当前策略：优先用 API / 脚本补证注册、登录、会话启动和草稿保存相关链路；需要前端跳转与完整日志工作区时再补浏览器证据

### 2026-05-24 第一批结果

- `product-smoke`（沙箱外 Node fetch）已在 `https://dlight.cc.cd` 跑通：
  - `register=200`
  - `login=200`
  - `session=200`
  - `start(joy)=200`
  - `invalid_entry_date=400`
- 线上未登录私有页重定向已确认：
  - `/interview -> /login?next=%2Finterview`
  - `/calendar?view=day&date=2026-05-24 -> /login?next=%2Fcalendar`
- 本地代码补证已确认：
  - 注册成功默认回到 `/interview`
  - 登录成功优先回到 `nextPath`

### 2026-05-24 第二批结果

- 真实登录后访问 `/calendar?view=day&date=2026-05-24`：
  - `status=200`
  - `x-matched-path=/calendar`
  - 没有再次重定向
- 真实退出登录后：
  - `POST /api/auth/logout -> 200`
  - `GET /api/auth/session -> authenticated=false`
  - 用旧 cookie 访问 `/interview -> 307 /login?next=%2Finterview`
- 剩余四维 `start`：
  - `fulfillment -> 200 collect_event`
  - `reflection -> 200 collect_event`
  - `improvement -> 200 collect_event`
  - `gratitude -> 200 collect_event`
- `fulfillment` 单篇日志闭环：
  - 第 3 轮后进入 `event_complete + complete`
  - `draft/generate -> 200`
  - 标题 `主线终于理顺`
  - 使用完整 draft payload 复跑 `PUT /api/journal-entry/[id] -> 200`
  - `draft/save -> 200`
- 当天完整日志：
  - 无 saved source 时：`POST /api/daily-journal/generate -> 409 DAILY_JOURNAL_SOURCE_EMPTY`
  - 有 1 条 `fulfillment` saved source 后：`GET /api/daily-journal?date=2026-05-24 -> availableSourceCount=1`
  - `POST /api/daily-journal/generate -> 200`
  - `POST /api/daily-journal/{id}/save -> 200`

### 2026-05-24 第三批结果

- 五维最小闭环统一脚本首轮结果：
  - `fulfillment / reflection / gratitude` 直接跑通 `generate -> save`
  - `joy / improvement` 首轮最短样本停在 `DRAFT_GENERATE_NOT_READY`
- 针对 `joy / improvement` 进行更强样本复测后：
  - `joy` 进入 `event_complete(user_override_partial)`，`generate -> 200`，标题 `清醒地开始`，`save -> 200`
  - `improvement` 进入 `event_complete(complete)`，`generate -> 200`，标题 `把节奏放稳`，`save -> 200`
- 当前判断：
  - 本轮没有发现新的产品级 `P0`
  - `B-07` 当前应判为通过，不应把首轮材料不足样本误记为回归阻断

## 改动文件

- `docs/plans/2026-05-24-final-regression-report.md`
