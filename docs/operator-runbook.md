# Operator Runbook

最后更新：`2026-07-20`

本文记录本地启动、数据库同步、测试命令与高频故障排查。

## 1. 环境变量

最小必需配置来自 `.env.example`：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `AI_RUNTIME_CONFIG_SECRET` | 用于加密数据库里 AI provider API Key 的主密钥；推荐用 `openssl rand -base64 32` 生成 |
| `AI_PROVIDER` | 当前默认是 `volcengine-ark` |
| `VOLCENGINE_ARK_API_KEY` | Ark API Key |
| `VOLCENGINE_ARK_MODEL` | Ark chat completions 的首选模型 ID；当前 production 已切到直连模型路径 |
| `VOLCENGINE_ARK_ENDPOINT_ID` | 兼容旧路径：项目绑定 endpoint，只有在 key 能访问该 endpoint 时再用 |
| `VOLCENGINE_ARK_BASE_URL` | Ark base URL |
| `APP_URL` | 前端访问地址 |
| `VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID` | embedding 模型 endpoint（记忆系统向量嵌入，可选） |
| `DIRECT_URL` | Prisma migration / 运维直连数据库 URL；共享环境建议配置 |
| `ADMIN_USERNAMES` | 逗号分隔的管理员用户名白名单，用于 `/admin/analytics` 页面与 `/api/admin/analytics/*` 接口鉴权 |
| `CRON_SECRET` | 保护 AI 每日评估与每周迭代任务的 Bearer Secret；推荐用 `openssl rand -base64 32` 生成 |

生产环境合同：

- 唯一生产主域名：`https://dailylight.chat`
- `APP_URL`：`https://dailylight.chat`
- `https://www.dailylight.chat`：兼容入口
- `dlight.cc.cd`：已于 `2026-07-20` 移除并废弃

账户体系补充说明：

- 当前登录态使用 `httpOnly` cookie `dl_session`
- 当前不要求额外 `AUTH_SESSION_SECRET`
- session token 明文只下发到浏览器 cookie，数据库只保存其 SHA-256 hash
- 首版不支持找回密码

当前默认本地值示例：

```bash
DATABASE_URL="postgresql://zouzhijie@localhost:5432/happiness_system_codex?schema=public"
DIRECT_URL="postgresql://zouzhijie@localhost:5432/happiness_system_codex?schema=public"
AI_RUNTIME_CONFIG_SECRET=""
AI_PROVIDER="volcengine-ark"
VOLCENGINE_ARK_API_KEY=""
VOLCENGINE_ARK_MODEL=""
VOLCENGINE_ARK_ENDPOINT_ID=""
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
APP_URL="http://localhost:3000"
ADMIN_USERNAMES=""
CRON_SECRET=""
```

`AI_RUNTIME_CONFIG_SECRET` 说明：

- 这是本系统自己的加密主密钥，不是 OpenAI、Anthropic 或 Ark 的 API Key。
- 推荐生成命令：`openssl rand -base64 32`
- 同一个部署环境内的所有实例必须使用完全相同的值。
- 不能提交到 git，不能从任何 provider API Key 推导生成。
- 如果修改这个值，旧密文会解不开；恢复办法只有两种：改回原值，或让管理员重新录入所有 provider API Key。

数据库连接约定：

- `DATABASE_URL` 给应用运行时使用；如果部署环境有 pooler，这里填 pooler URL。
- `DIRECT_URL` 给 Prisma migration、数据修复和运维排障使用；如果部署环境有 pooler，这里填直连库的 URL。
- 共享环境上线前先确认这两个 URL 都已配置，避免把 `migrate deploy` 跑在 pooler 上。

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

如果你是在已有本地数据的库上首次同步账户体系，并看到以下任一现象：

- `/api/auth/register` 500
- Prisma 报 `The column User.username does not exist`
- `npx prisma db push` 提示无法为 `User` 新增必填字段

先执行：

```bash
psql -h localhost -p 5432 -d happiness_system_codex -U zouzhijie -f prisma/migrations/20260516233200_add_auth_session_and_user_credentials/migration.sql
```

然后再执行：

```bash
npx prisma db push
```

如果你是在已有本地数据的库上同步管理员分析能力，并看到以下任一现象：

- `/admin/analytics` 页面可访问但相关查询报 Prisma 表不存在
- Prisma 报 `AnalyticsEvent` 或 `AdminAuditLog` 不存在
- 管理员分析相关测试提示缺少埋点 / 审计表

先执行：

```bash
psql -h localhost -p 5432 -d happiness_system_codex -U zouzhijie -f prisma/migrations/20260521120000_add_admin_analytics_tables/migration.sql
```

然后再执行：

```bash
npx prisma db push
```

补充：
- `2026-05-25` 的真实 production 排障里，缺失 `20260521120000_add_admin_analytics_tables` 会直接导致 live `POST /api/auth/register` 在 `analyticsEvent.upsert()` 阶段失败，表现为 `REGISTER_FAILED`。
- 共享环境只要出现 `The table public.AnalyticsEvent does not exist`，优先补这条 migration，而不是继续怀疑认证逻辑或前端表单。

### 2.3 记忆系统依赖（可选）

如果需要启用记忆系统（`memoryEnabled = true`），需额外安装 pgvector 扩展：

```bash
brew install pgvector       # macOS
CREATE EXTENSION IF NOT EXISTS vector;  # 数据库
```

并配置 embedding endpoint：

```bash
VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID="your-embedding-endpoint-id"
```

> pgvector 向量维度 2048 超过 HNSW 索引的 2000 维限制，当前使用顺序扫描。数据量 < 200 条时性能足够。

### 2.3.1 共享环境数据库补强清单

上线前按下面顺序执行：

1. 先做 backup，至少确认最近一次全库 backup 可恢复。
2. 校验部署配置：应用使用 `DATABASE_URL`，migration 使用 `DIRECT_URL`。
3. 执行 `npx prisma migrate deploy`，不要在共享环境继续用 `npx prisma db push`。
4. 如果要启用记忆系统，确认 pgvector migration 已执行完成，再打开 `memoryEnabled`。
5. 验证关键索引、向量 extension 和认证会话清理都已生效。

建议检查命令：

```bash
npx prisma migrate status
psql "$DIRECT_URL" -c '\dx'
psql "$DIRECT_URL" -c '\d "InterviewSession"'
psql "$DIRECT_URL" -c '\d "JoyEntry"'
psql "$DIRECT_URL" -c '\d "DailyJournalEntry"'
psql "$DIRECT_URL" -c '\d "DailyHappinessScore"'
```

你应看到这些索引已经存在：

- `InterviewSession_userId_entryDate_idx`
- `JoyEntry_userId_date_idx`
- `JoyEntry_userId_status_date_idx`
- `DailyJournalEntry_userId_date_idx`
- `DailyHappinessScore_userId_date_idx`
- `MemoryFact.embedding` 列存在，且 `\dx` 能看到 `vector` extension

如果需要直接确认 auth session 生命周期逻辑，可执行：

```bash
psql "$DIRECT_URL" -c 'select count(*) as expired_sessions from "AuthSession" where "expiresAt" < now();'
psql "$DIRECT_URL" -c 'select "tokenHash", "lastUsedAt", "expiresAt" from "AuthSession" order by "lastUsedAt" desc nulls last limit 10;'
```

期望：

- 过期会话在读取路径上会被清理，不会长期堆积。
- 活跃登录的 `lastUsedAt` 会随会话读取被回写。

如果 `\dx` 中没有 `vector`：

```bash
psql "$DIRECT_URL" -c 'CREATE EXTENSION IF NOT EXISTS vector;'
npx prisma migrate deploy
```

如果 `vector` extension 无法创建，保持 `memoryEnabled=false`，先完成数据库能力开通，再继续 rollout。
当前 `2048` 维 embedding 不要再尝试补 `ivfflat / hnsw` 索引；这两个索引在这个维度下都不是 deployable contract。

### 2.3.2 回滚与恢复

- `migrate deploy` 前先做 backup；没有可验证的 backup 时不要继续。
- 如果 migration 在共享环境失败，先停止继续 rollout，保留失败日志和 `prisma migrate status` 输出。
- 如果是 pgvector 缺失导致失败，先补 extension，再重跑 `npx prisma migrate deploy`。
- 如果需要数据库级回退，优先使用最近一次 backup restore 到临时库验证，再按环境规范执行 restore。
- 不要手工删除 Prisma migration 记录来伪造回滚状态。

### 2.4 启动开发服务器

```bash
npm run dev
```

默认地址：
- `http://localhost:3000`

### 2.5 首版账户冒烟

建议至少覆盖一次：

1. 打开 `/register`
2. 不勾协议直接尝试注册，确认不能提交
3. 注册一个新用户并自动进入 `/interview`
4. 打开 `/settings/account`，确认能看到当前用户名
5. 退出登录后，再访问 `/interview`，确认被带回 `/login?next=%2Finterview`
6. 用同一账号重新登录，确认能回到私有页
7. 如要验删号，再进入 `/settings/account`，输入当前密码删除账号，确认会回到 `/register`

### 2.6 管理员分析冒烟

建议至少覆盖一次：

1. 在 `.env.local` 中配置 `ADMIN_USERNAMES="你的管理员用户名"`
2. 用该用户名登录
3. 打开 `/settings`，确认能看到“管理员数据分析”入口

### 2.7 AI 运行配置中心冒烟

建议至少覆盖一次：

1. 在 `.env.local` 中配置 `ADMIN_USERNAMES="你的管理员用户名"` 和 `AI_RUNTIME_CONFIG_SECRET`
2. 用管理员账号登录，打开 `/settings`，确认能看到“AI 运行配置中心”入口
3. 进入 `/settings/ai-runtime`，确认 chat 与 embedding 状态卡都能显示当前来源、provider、模型或 endpoint 摘要
4. 先保存一份草稿，再执行连通性测试，确认测试记录写入
5. 发布草稿，确认提示“发布后，从下一次 AI 请求开始生效”
6. 打开历史版本表，执行一次回滚，确认新版本重新发布成功
7. 如需排查当前来源，临时启用 `/api/debug/runtime-env?probe=1`，检查 `ai.chat.source` 和 `ai.embedding.source`

### 2.8 AI 质量闭环冒烟

完整架构、评分权重、标签与数据表见 `docs/ai-quality-loop.md`。上线前至少覆盖一次：

1. 配置 `ADMIN_USERNAMES` 与 `CRON_SECRET`，用管理员账号登录。
2. 在 `/settings` 确认出现“AI 质量改进中心”，进入 `/admin/ai-quality`。
3. 用普通账号完成一轮访谈，分别验证赞、踩、标签、自由文本、切换和撤回。
4. 点击“立即评估并生成候选”，确认本次运行先评估最多 20 条，再扫描最近 7 天案例。
5. 打开候选证据，确认可以看到脱敏背景、用户与 AI 对话、用户反馈和自动评分。
6. 批准候选并执行验证；验证通过后确认“全量应用”可用。
7. 在发布确认弹窗中核对 Prompt Key、验证结果和回滚说明，再由管理员发布。
8. 展开“上线效果观察”，核对发布前基线、发布后指标和真实案例。
9. 执行回滚，确认 `AdminAuditLog` 有记录，观察窗口提前截止。

手工调用任务：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/ai-quality/evaluate?limit=100"

curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/ai-quality/iterate"
```

管理员登录态下也可以直接触发手动运行：

```bash
curl -X POST \
  --cookie "dl_session=<本地管理员会话 Cookie>" \
  "http://localhost:3000/api/admin/ai-quality/runs"
```

共享环境发布时按顺序应用以下迁移：

- `20260719010000_add_ai_generation_trace`
- `20260719020000_add_ai_evaluation`
- `20260719030000_add_ai_feedback_and_consent`
- `20260719040000_add_ai_optimization_engine`
- `20260719050000_default_ai_quality_and_candidate_dedupe`
- `20260719060000_add_ai_candidate_validation`
- `20260720010000_bind_prompt_release_validation`

本地验收数据：

- `npm run acceptance:ai-quality:seed` 只用于可重复的本地验收。
- 执行前先确认 `DATABASE_URL` 指向本机数据库。
- 远程隔离测试库需要显式设置 `ALLOW_REMOTE_AI_QUALITY_ACCEPTANCE_SEED=I_UNDERSTAND`。
- production 环境会主动终止脚本。
- 共享生产库只保留真实用户数据；验收完成后清理固定验收账号、Trace、反馈、候选和运行记录。
- 本地快捷登录 `/api/dev/acceptance-login` 在 production 统一返回 `404`。

本地验收顺序：

```bash
npm run acceptance:ai-quality:seed
npm run dev
```

随后打开：

```text
http://127.0.0.1:3000/api/dev/acceptance-login?token=local-ai-quality-acceptance&redirect=%2Fadmin%2Fai-quality
```

`ACCEPTANCE_LOGIN_TOKEN`、`ACCEPTANCE_ADMIN_USERNAME` 和 `ACCEPTANCE_ADMIN_PASSWORD` 可以覆盖默认验收凭据。快捷登录只接受 localhost/127.0.0.1 请求，并用恒定时间比较 token。

## 3. AI 运行配置中心

### 3.1 这个后台做什么

- 管理员在产品后台维护聊天能力和向量嵌入能力两条独立的运行时配置。
- 每条能力线都支持保存草稿、执行连通性测试、发布、查看历史版本和回滚。
- 运行时优先使用数据库里当前已发布配置；如果数据库配置不可用，系统会自动回退到现有环境变量配置。

### 3.2 发布与回滚规则

- 发布流程固定为：保存草稿 -> 执行连通性测试 -> 发布。
- 修改草稿后，旧测试结果立即失效，必须重新执行连通性测试。
- 发布后，从下一次 AI 请求开始生效，不需要重新部署。
- 回滚不会原地修改历史记录；系统会复制目标历史版本并重新发布。

### 3.3 当前支持的 provider

- chat：`openai`、`anthropic`、`volcengine_ark`
- embedding：`openai`、`volcengine_ark`
- `anthropic` 不进入 embedding 选项，本次没有 Anthropic embedding 合同。

### 3.4 如何确认当前在用数据库配置还是环境变量配置

- 管理员后台 `/settings/ai-runtime` 的状态卡会直接显示“当前使用数据库配置”或“当前使用环境变量配置”。
- 受保护的诊断接口 `/api/debug/runtime-env?probe=1` 会返回：
  - `ai.chat.source`
  - `ai.embedding.source`
  - 当前 provider
  - 当前模型或 endpoint 摘要
- 诊断接口不会返回任何明文 API Key。

### 3.5 如何批量采集最终交付证据

配置下面这些变量后，可以直接运行：

```bash
node scripts/admin-ai-runtime-smoke.mjs
```

脚本会依次执行：

1. 管理员登录
2. 保存草稿
3. 执行连通性测试
4. 发布
5. 再发布一个变体版本
6. 读取历史并执行一次回滚
7. 可选读取 `/api/debug/runtime-env?probe=1`

常用变量：

- `ADMIN_AI_RUNTIME_USERNAME`
- `ADMIN_AI_RUNTIME_PASSWORD`
- `RUNTIME_ENV_READBACK_TOKEN`
- `ADMIN_AI_RUNTIME_OPENAI_API_KEY`
- `ADMIN_AI_RUNTIME_OPENAI_CHAT_MODEL`
- `ADMIN_AI_RUNTIME_OPENAI_EMBEDDING_MODEL`
- `ADMIN_AI_RUNTIME_ANTHROPIC_API_KEY`
- `ADMIN_AI_RUNTIME_ANTHROPIC_CHAT_MODEL`
- `ADMIN_AI_RUNTIME_ARK_API_KEY`
- `ADMIN_AI_RUNTIME_ARK_CHAT_MODEL_ID`
- `ADMIN_AI_RUNTIME_ARK_CHAT_ENDPOINT_ID`
- `ADMIN_AI_RUNTIME_ARK_EMBEDDING_ENDPOINT_ID`
4. 打开 `/admin/analytics`
5. 切换 `复盘视角 / 监控视角`
6. 切换 `最近 7 天 / 最近 30 天 / 本月`
7. 输入用户名或启用一个筛选条件，确认候选用户列表出现
8. 进入某个候选用户详情，确认会话 / 维度日志 / 完整日志可下钻
9. 切到非管理员账号访问 `/admin/analytics`，确认页面返回 404

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

### 提问链路专项验证

如果改动涉及访谈问题生成、repair、follow-up fallback 或文案回归，最少补跑：

```bash
npm run typecheck
npm test -- tests/unit/interview/question-clarity.badcase.test.ts
npm test -- tests/unit/question-copy-guard.test.ts
```

说明：

- `question-clarity.badcase` 锁的是真实 badcase 行为边界
- `question-copy-guard` 锁的是高风险坏问法和关键 intent 的推荐问法族
- 这两组测试当前是提问链路回归的最低门槛，不能只跑纯函数单测就宣称“问题自然了”

### 3.0 joy 日志质量冒烟场景

如果当前改动涉及 joy 抽取、闭合判断、正文生成、fallback draft、质量门或标题治理，除主链路外至少覆盖：

1. 早起轻快乐：输入“今天早起了半小时，洗漱不赶，路上还多买了杯热豆浆，感觉整个人清醒一点。”，生成标题不应是 `一下被带轻 / 象征意义 / 确定性`，应收束为 `清醒地开始` 这类自然短标题。
2. 抽象闭合防线：如果抽取器返回 `动作本身带来的确定性 / 早起这件事的象征意义 / 清醒 / 从容 / 有准备` 作为 `delightSignature`，不应判定 `delight_track` 已完整闭合，也不应因此提前进入生成日志 choice。
3. 正文理论腔防线：AI draft 或 fallback draft 不应出现“这份开心更像轻快乐”“关键不是深意义”“这种会把状态轻轻带起来的方式”这类内部解释句。
4. partial 边界：用户已有 `joyMoment + joySource + stateShift|meaningNeed` 后说“别追问了，直接整理”，可以生成当前版本日志，但不能硬写稳定规律。

### 3.0.1 calendar 月视图冒烟场景

如果当前是在调记录日历月视图，每次改动后至少人工覆盖：

1. 打开 `/calendar?view=month&date=2026-05-02`
2. 确认月视图固定渲染 6 行 42 格；`2026-03`、`2026-05`、`2026-12` 的月历主体高度一致
3. 点击一个过去但未记录的日期
4. 预期：月格不出现 `进行中 / 混合状态` 这类文字；如果没有已保存维度，不会出现单字标签；左侧不出现 `本月还没有记录。` 横幅，右侧当天检查面板保持过去空白语气，并显示轻空态而不是 5 个空维度
5. 点击一个未来空白日
6. 预期：月格不显示 `未记录 / 还没有记录。`；右侧当天检查面板改成中性 future 语义，但仍保留 `查看当天`
7. 找一个 today 且有状态的日期
8. 预期：today 圆点在日期锚点附近，右上角状态文案不与圆点重叠
9. 找一个已有保存维度但未满五维的日期
10. 预期：月格显示单字 `悦 / 实 / 思 / 改 / 谢` 中对应结果；不再显示双字 badge
11. 找一个五维都至少保存过一次的日期
12. 预期：月格文字层收束为 `已完成`
13. 在较矮视口打开月视图
14. 预期：底部日期不会被裁切，父级 pane 可以滚动访问月底日期；如果此时 header 因小屏或内容换行变高，月视图仍应按真实 header 高度后的剩余视口收口，不出现因为顶部 offset 写死而产生的底部假留白或双滚动
15. 在手机宽度打开月视图
16. 预期：月历主体在上、当天检查面板在下，不出现必须横向拖动才能看到右侧面板的布局
17. 让 `/api/calendar/month` 返回失败
18. 预期：月视图仍保留“月历主体 + 当天检查”的方框 split-pane 骨架；主区与右侧 pane 各自出现错误说明和重试按钮；右侧显示“当天检查暂时不可用”，且两侧都不显示“这一天还空着”这类假空白状态

### 3.0.2 analysis 入口冒烟场景

如果当前是在调记录分析入口，每次改动后至少人工覆盖：

1. 打开 `/analysis`
2. 预期：URL 被归一到 `/analysis?month=<北京时间当前 YYYY-MM>&section=overview`
3. 点击 `上月 / 下月 / 本月`
4. 预期：URL 更新 `month` 并保留当前 `section`，页面标题同步成对应月份
5. 直接打开 `/analysis?month=<该月>&section=rhythm` 或 `/analysis?month=<该月>&section=insights`
6. 预期：页面选中对应 tab，只渲染节奏或五维洞察板块；非 `overview` 视图不显示月度判断、建议先看和证据条
7. 再直接打开 `/analysis`
8. 预期：首屏停在顶部月度判断与总览，不会自动跳到评分区
9. 预期：总览是默认视图；首屏能看到评分可信度、“建议先看”主行动，以及维度记录日 / 成果保存日 / 待整合日 / 评分可信度证据条；页内可切到 `评分 / 节奏 / 五维`
10. 如果当前月是干净库，没有任何已保存数据：
11. 先通过任一维度访谈生成并保存至少 1 篇维度日志，再从访谈页顶部【完整日志】进入当天整合日志主区，生成并保存 1 篇当天整合日志
12. 回到 `/analysis?month=<该月>&section=rhythm`
13. 预期：对应日期显示 `1-5维` 和单字维度标识 `悦 / 实 / 思 / 改 / 谢`
14. 预期：该日期出现轻量整合标记
15. 切到 `/analysis?month=<该月>&section=insights`
16. 预期：`五维洞察` 首屏会显示 `本月判断`，下方是五维全景卡片，以及 `维度之间 / 下一步`；有真实数据时不应出现示意样板短句或旧的“主线维度 + 浮现/安静维度”布局
17. 点击任一“回到某维度”链接
18. 预期：跳转到 `/interview?dimension=<维度>&entryDate=YYYY-MM-DD`，日期应对应被分析的那条记录，不应误跳到今天
19. 如果当前查看的是本月 `rhythm`
20. 预期：`最长空档` 不应把今天之后的未来日期算进去
21. 切到一个未来月份的 `/analysis?month=<未来月>&section=rhythm`
22. 预期：月格保持 `待到来` 语义，`最长空档` 显示 `暂无`，不应把整个月误算成空档
23. 直接打开一个未来月份的 `/analysis?month=<未来月>&section=overview`
24. 预期：总览首屏会提示“这个月还没到来”并提供 `回到本月`，不会出现 `开始记录`
25. 在热力图里点一个未来日期
26. 预期：右侧只保留 `查看当天`，不会出现 `开始这一天的记录 / 继续当天记录`
27. 进入任意日期访谈页，在 header 点击 `当天评分`
28. 预期：主工作区切到独立评分工作区（不是访谈消息流）；`当天评分` 按钮高亮，维度按钮不被整体置灰
29. 预期：评分项首次进入无预选，点某个分值后才选中并自动跳到下一个“未评分维度”
30. 预期：评分区显示 8 项打分总览（每项 `未评分/几分`）
31. 预期：按键 `1..9` 和 `0`（=10分）可直接打分；悬浮提示延迟约 `1s` 才出现
32. 在 8 项未全部打完前
33. 预期：`保存并退出` 按钮置灰
34. 8 项全部打完后点击 `保存并退出`
35. 预期：请求 `PUT /api/happiness-score` 成功并返回访谈工作区，`entryDate` 不变
36. 切回 `/analysis?month=当前月&section=score`
37. 预期：评分区为趋势阅读（`总分平均走势 / 8 项快扫 / 单项走势`），不再出现评分编辑器
38. 如果当前月只有 `1` 天评分，或多天但 `8` 项评分完全持平
39. 预期：不显示 `长期偏高 / 最常掉下来 / 波动最大` 排名卡，而是显示“样本/差异不足，仅供参考”的提示
40. 点击任一 8 要素快扫按钮
41. 预期：单项走势切换到对应要素，URL 的 `month` 不变
42. 切到一个没有已保存记录的旧月份
43. 预期：`overview / score / rhythm / insights` 视图都能稳定打开，并显示真实空态；不应出现示意填充或伪造数据
44. 切到一个“只有评分、没有已保存维度日志”的月份
45. 预期：`rhythm` 会把对应日期保留在 `只评未记 / 待成文` 语义，不会伪造 `已整合`、密度结论或整月空档；`insights` 显示空态，不出现伪造的 `主线维度`
46. 如果某一天先保存了完整日志，再新增或更新同日 `saved` 维度日志
47. 预期：`rhythm` 会把这一天重新标成 `待更新 / 待整合`，并提供更新完整日志入口，而不是继续显示 `已整合`
48. 如果同一天所有来源维度日志后来都回到了 `draft`，只剩一篇 `stale` 的当天整合日志
49. 预期：`rhythm` 仍把这一天算进待处理；切到 `insights` 后，`watchpoint` 会优先提示”完整日志已经过时，需要重新整理”，而不是被安静维度或评分提示盖过去

### 3.6 画像页冒烟

如果当前改动涉及画像（profile/portrait）系统：

1. 打开 `/profile`
2. 预期：默认进入「画像」tab，显示”还没有生成画像”空状态 + 「生成画像」按钮
3. 点击「生成画像」
4. 预期：按钮下方显示”认知数据不足。请先通过访谈或手动添加至少 3 条认知，再生成画像。”
5. 切到「记忆库」tab
6. 预期：显示维度分组的列表（当前为空），每个维度有「+ 添加」按钮
7. 手动添加 3 条以上画像条目（不同维度）
8. 切回「画像」tab，点击「生成画像」
9. 预期：按钮变为「生成中…」，完成后显示 AI 总述 + 五维度洞察卡片
10. 切到「演变」tab
11. 预期：显示认知时间轴，按月分组，包含刚添加的条目
12. 在「记忆库」tab 编辑一条画像
13. 切回「画像」tab
14. 预期：若 fact 数量变化，显示”认知数据已更新，建议重新生成画像”

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
8. 继续深聊防回卷：如果上一轮已经问过“有没有具体经历 / 对话”，用户明确回答“没有”，再点 `继续深聊` 后不应重复追同一字段；下一问必须改成更低压的具体锚点，例如某个顾虑、脑中画面、比较时刻或选择瞬间

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
9. stitched 多事件：先形成一条主感谢，再补一条像“赵月请我吃冰淇淋/喝水”的 supporting moment；如果 AI 生成超时或质检回退，fallback draft 正文仍应保留两条片段，不应退化成只剩主事件

### 3.5 当天整合日志冒烟场景

如果当前改动涉及 `/api/daily-journal*`、calendar 日视图入口或访谈页顶部【完整日志】，至少覆盖：

1. 在同一 `entryDate` 下保存至少一篇维度日志
2. 打开 `/interview?dimension=joy&entryDate=2026-05-03`
3. 点击顶部【完整日志】
4. 预期：主工作区切到当天整合日志；只统计已保存维度日志，不读取未保存草稿
5. 点击“生成当天日志”
6. 预期：正文只包含已有维度章节，不出现空章节或缺失维度提醒
7. 如果随后又在同一天新增一篇 `saved` 维度日志，重新打开当天整合日志
8. 预期：`GET /api/daily-journal?date=...` 返回 `state = "stale"`；点击“重新生成”后，章节数应与当天真实 `saved` 维度集合重新对齐
9. 修改标题或正文，等待自动保存，再点击保存正式日志
10. 预期：`GET /api/daily-journal?date=2026-05-03` 返回 `state = "saved"`
11. 从 `/calendar?view=day&date=2026-05-03` 进入当天日志 deep link
12. 预期：`mode=daily-journal` 只打开当天日志主区，不会调用 `/api/interview/session/start`
13. 点击“回到访谈”
14. 预期：如果标题或正文有未等到 700ms 自动保存的修改，会先请求 `PUT /api/daily-journal/[id]`；保存成功后 URL 移除 `mode=daily-journal`，回到同一日期的普通访谈 hydrate 流程
15. 再次进入顶部【完整日志】，修改正文后直接点击另一个访谈维度
16. 预期：前端先保存当天日志 pending 编辑，再把主工作区切回普通访谈；新维度访谈不应被完整日志工作区遮住

### 5.1.2 同一天的维度数与完整日志来源数对不上

症状：
- 顶部维度胶囊、`/api/calendar/day` 和当天整合日志里的 `availableSourceCount` 看起来不一致

处理：
1. 先确认查询日期用的是 `entryDate`，不是浏览器当前自然日
2. 直接看：
   - `GET /api/calendar/day?date=YYYY-MM-DD`
   - `GET /api/daily-journal?date=YYYY-MM-DD`
3. 当前仓库按 `Asia/Shanghai` 整天时间窗口归档：同一天任意时刻保存的维度日志，都会被归到对应 `entryDate`
4. 如果 `dailyJournal.state = "stale"`，说明同一天 `saved` 维度集合已经变化；此时点击“重新生成”让章节数与最新来源重新对齐

## 4. 测试命令

```bash
npx tsc --noEmit
npm test
```

截至 `2026-07-20`，当前基线是：
- `npm test`（Vitest）以主仓测试集为准；真实文件数与测试数以最近一次全量绿灯记录为准
- `npx tsc --noEmit` 以最近一次回归结果为准
- `npm run lint` / `npm run build` 是否通过，以最近一次回归结果为准
- 当前最新全量验证快照：`npm test` = `168` 个测试文件、`1061` 个测试通过
- AI 质量发布与效果观察专项验证：`10` 个测试文件、`30` 个测试通过
- `npx tsc --noEmit` 与 `npm run build` 通过；构建仍会输出既有 ESLint warnings
- Vitest 当前默认只扫描 `tests/**/*.test.{ts,tsx}`，并排除 `.worktrees/**` 与 `.claude/worktrees/**`，避免历史 worktree 测试噪声污染主仓回归

## 5. 托管平台主线

当前默认托管平台路线固定为 `Vercel`。

生产 smoke、回调和人工验收统一使用 `https://dailylight.chat`。`https://www.dailylight.chat` 只承担兼容访问。

相关文件：

- 根环境样板：`.env.example`
- preview 环境合同：`.env.preview.example`
- production 环境合同：`.env.production.example`
- 部署说明与最新 smoke 口径：`docs/vercel-preview-production-lane.md`
- 最小 smoke 脚本：`scripts/http-smoke.mjs`
- protected preview 自动化 smoke 脚本：`scripts/product-smoke.mjs`
- production / preview URL 合同 runtime 直读脚本：`scripts/runtime-env-readback.mjs`

### 5.1 Preview 部署后最小检查

以 `docs/vercel-preview-production-lane.md` 为 source of truth，按 preview 是否受保护分流：

1. protected preview：

```bash
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE="your-vercel-scope" \
ACCEPTANCE_BASE_URL="https://your-preview-url.vercel.app" \
node scripts/product-smoke.mjs joy 2026-05-19 previewsmoke
```

2. non-protected preview：

```bash
SMOKE_BASE_URL="https://your-preview-url.vercel.app" npm run smoke:public
```

说明：
- 如果当前 preview 没开 Vercel Deployment Protection，可以继续用 `smoke:public`
- 在这台机器上，如果 shell 走 Clash/Verge 系统代理，preview smoke 可能需要额外带上：

```bash
NODE_USE_ENV_PROXY=1 \
HTTPS_PROXY=http://127.0.0.1:7897 \
HTTP_PROXY=http://127.0.0.1:7897 \
ALL_PROXY=http://127.0.0.1:7897
```

`product-smoke.mjs` 当前自动化只覆盖：

- 注册
- 登录 / session 建立
- `POST /api/interview/session/start`
- `invalid_entry_date` 拒绝路径

它当前不自动覆盖更深的 `joy -> respond -> wrap_up -> draft generate -> draft save`。这条更深链路如果需要证据，仍由 controller 手工 deep-chain 补证。

### 5.1.1 Production URL contract direct readback

当 launch gate 需要直接验证 `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` / `APP_URL` 的运行时值时，使用当前仓库的最小直读面：

- route：`GET /api/debug/runtime-env`
- script：`scripts/runtime-env-readback.mjs`

这个面只在同时满足下列条件时可用：

- `ENABLE_RUNTIME_ENV_READBACK=1`
- `RUNTIME_ENV_READBACK_TOKEN` 已配置
- 请求方已登录
- 请求头带 `x-runtime-readback-token`

最小执行方式：

```bash
RUNTIME_ENV_READBACK_TOKEN="your-readback-token" \
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE="your-vercel-scope" \
ACCEPTANCE_BASE_URL="https://dailylight.chat" \
node scripts/runtime-env-readback.mjs "https://dailylight.chat" runtime
```

返回只允许读取这些白名单字段：

- `VERCEL`
- `VERCEL_TARGET_ENV`
- `VERCEL_URL`
- `VERCEL_BRANCH_URL`
- `VERCEL_PROJECT_PRODUCTION_URL`
- `VERCEL_DEPLOYMENT_ID`
- `APP_URL`

不要把这个 route 当成公开 smoke 面，也不要向其中加入任何数据库、AI key 或其他敏感 env。

`smoke:public` 当前检查：

- `/`
- `/login`
- `/register`
- `/legal/terms`
- `/legal/privacy`
- `/api/auth/session`

通过标准：

- 页面路由返回 `200`
- `/api/auth/session` 返回 `200`
- session JSON 里存在 `authenticated: boolean`

### 5.2 当前不开放的能力

- `/api/transcribe` 仍是 stub，不纳入 preview / production smoke
- 没有真实转写模型前，不开放语音入口

## 6. 高频故障排查

### 5.0 `npm run build` 失败

当前 `2026-07-20` 验证基线为生产构建通过，并保留既有 ESLint warnings。新出现的非零退出码需要按本次构建日志定位：

1. 先运行 `npm run typecheck`，区分 TypeScript 错误与 Next.js 构建错误。
2. 再运行 `npm run lint`，记录新增 error 与既有 warning。
3. 确认 Prisma Client 已通过 `npm install` 的 `postinstall` 生成；需要时执行 `npx prisma generate`。
4. 检查部署环境是否已应用当前 migrations。
5. 用首次出现的文件位置和错误码排查，避免把 warning 当成构建失败原因。

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

### 5.4.1 AI provider 排障顺序

当 production / preview 看起来“像没接大模型”时，优先按下面顺序排：

1. 先查配置形态
2. 再查 provider 最小探针
3. 最后才看访谈主链日志

当前代码事实：

- `VOLCENGINE_ARK_MODEL` 是首选路径，`VOLCENGINE_ARK_ENDPOINT_ID` 只作为兼容旧路径的 fallback
- provider 初始化阶段会识别：
  - 缺少 key / model
  - `$VOLCENGINE_...` 这类占位串
  - 非法 `VOLCENGINE_ARK_BASE_URL`
- guarded `GET /api/debug/runtime-env?probe=1` 会返回：
  - `ai.state`
  - `ai.code`
  - `ai.issues`
  - `ai.probe.status`
  - `ai.probe.code`
- 这条 route 在 production 默认应保持关闭；只在短时验证窗口中临时开启，验证结束后立即恢复 `ENABLE_RUNTIME_ENV_READBACK=0`

排障判断：

- `ai.state=config_invalid`
  - 说明问题还在 env 值形态层，例如把 `$VOLCENGINE_ARK_API_KEY` 当作字面值写进平台
- `ai.state=ready` 且 `ai.probe.status=200`
  - 说明 provider 真实可用；如果用户仍觉得“像 fallback”，再去看访谈 prompt / 追问质量
- `ai.probe.code=ACCOUNTOVERDUEERROR`
  - 说明 key 已生效，但账户额度 / 计费状态阻断了上游调用
- `ai.probe.code=ACCESSDENIED`
  - 常见于 key 无权访问当前 `endpoint`；优先切换到直连 `VOLCENGINE_ARK_MODEL`

当前 production 已验证过的一条可用模型路径：

```bash
VOLCENGINE_ARK_MODEL="deepseek-v3-2-251201"
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
```

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
- 如果当前维度历史上已经出现过 `event_complete`，但新事件停在 `boundary_insufficient` 或 `dimension_redirect`，header 当前维度进度仍应压在 `88%` 以下，不能被历史 `draftGenerationUnlocked` 顶回 ready

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
- 五个维度的 `thinkingSummary` 都应通过 `summary` SSE delta 流式出现，再由 `question` delta 展示正式追问
- 它不能带问号，不能使用“你提到 / 我想知道 / 下一步问”等口吻
- 前端会用低权重样式展示它，正式追问只应出现在更深色的 `question` 气泡里

如果仍复现，优先检查：
- `src/features/joy-interview/prompts/joy-prompts.ts`
- `src/server/services/interview/joy-interview.service.ts` 的 `normalizeThinkingSummary`
- `src/components/interview/interview-shell.tsx` 的 `MessageBubble` variant

### 5.9 AI 质量后台读取失败

症状：

- `/admin/ai-quality` 的效果区提示数据连接暂不可用
- 响应包含 `P1001 / P1017 / P2024` 或 `AI_QUALITY_IMPACT_FAILED`

处理：

1. 记录页面展示的 `requestId`。
2. 先点击局部“重新加载”；管理员只读查询已经等待约 `300ms` 并重试一次。
3. 检查 `DATABASE_URL` 的 pooler 连通性与连接池占用。
4. 检查服务端对应 requestId 日志；Prisma 原始错误只会出现在服务端。
5. 数据库恢复后重新展开效果区或真实案例。

候选缺少通过验证时，底层会阻止发布并抛出 `OPTIMIZATION_VALIDATION_REQUIRED`。当前候选 PATCH 路由会返回通用 `500 AI_QUALITY_REVIEW_FAILED`；补齐结构化 `409` 映射前，管理员应先执行候选验证，再重新发布。

## 7. 关键日志与定位点

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
  - `transcribe / extract / generate / question / evaluate / iterate / portrait_synthesis`
- `AIGenerationTrace / AIEvaluation / AICase`
- `AIFeedback / AIFeedbackRevision`
- `AIOptimizationRun / AIBadcaseCluster / AIOptimizationCandidate / AIOptimizationValidation`
- `AIFewShotExample / AIPromptRelease`
- `InterviewSession`
- `InterviewEvent`
- `JoyEntry`

## 8. 当前已知非故障现实

这些现象当前属于产品或架构现状，不是立即修的故障：

- joy / fulfillment / reflection / improvement / gratitude 维度完成了理论对齐深化
- 五个维度标题都已接入语义短标题治理
- 用户边界优先级高于槽位完整度，材料不足时会进入低压选择
- improvement / gratitude 已完成专属结构、AI 抽取独立化、fallback 抽取、访谈推进、专属提问策略、完成收束、正文生成、质量门、fallback draft、标题治理和自动化验收样例，但仍需要端到端产品验收
- `transcribe` 是 stub
- `interview.service.ts` 仍是 joy-first 的导出层
- joy 正文生成还会继续做风格优化
- `/api/daily-journal*` 是当天整合日志的查询、生成、草稿更新和保存接口。
- `/interview?...&mode=daily-journal` 只进入当天整合日志主区，不会启动或创建新的维度访谈 session；点击“回到访谈”会先保存当天日志 pending 编辑，再移除 `mode` 并恢复同一日期的普通访谈 hydrate。若在当天日志主区切换访谈维度，前端也会先保存 pending 编辑并回到普通访谈工作区。
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
  - 月视图小屏为上下堆叠工作台，不再依赖横向滚动访问当天检查面板；loading 期月格 skeleton 与真实网格同为 42 格
  - 月视图当天检查面板汇总 `待继续 / 已完成 / 完整日志`，过去空白日使用轻空态，月查询失败时右侧不伪装成空白日
  - 周视图、日视图和月视图右侧当天检查面板的可见维度 badge 也已统一改成单字；辅助技术仍保留完整维度名
  - month / week / day / toolbar 已补 `aria-busy`、loading `status`、error `alert`、focus-visible 和主要 CTA 的可访问名称
  - 日视图按五维紧凑操作台组织，不做时间轴，也不内联正文编辑
- `/analysis?month=YYYY-MM&section=trends|dimensions|correlation|review` 当前为单页四段纵向 scroll + 顶部锚点工作台；缺失 `section` 时默认 `trends`，旧 `overview|score|rhythm|insights` 会归一到新 keys。量化趋势走 `GET /api/analysis/range`，五维全景走 `GET /api/analysis/month`，关联与复盘仍为占位。`PUT /api/happiness-score` 允许保存所有非未来日期，评分录入入口位于访谈页「当天评分」工作区。
