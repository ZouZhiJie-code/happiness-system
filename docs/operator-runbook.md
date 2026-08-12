# Operator Runbook

最后更新：`2026-08-12`

本文记录本地启动、数据库同步、测试命令与高频故障排查。

## 1. 环境变量

最小必需配置来自 `.env.example`：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `AI_RUNTIME_CONFIG_SECRET` | 用于加密数据库里 AI provider API Key 的主密钥；推荐用 `openssl rand -base64 32` 生成 |
| `AI_PROVIDER` | 当前产品与候选统一使用 `openai`，对应 DeepSeek 官方 API 的 OpenAI 兼容接口；Ark 只保留历史兼容代码 |
| `INTERVIEW_INTENT_V2_MODE` | 访谈意图识别发布档位：`legacy` 保持既有决策，`shadow` 记录新旧对照，`enforce` 启用新决策。当前 Production 与 Preview 均使用 `enforce`，`legacy` 保留为 P0 问题的即时回退档位 |
| `INTERVIEW_EVENT_CENTERED_MODE` | 事件中心入口档位：`legacy` 保持五维入口为默认并允许读取已有事件；`optional` 保持五维默认入口并展示“从一件事开始”且允许事件写入；`event_centered` 以事件中心为默认入口并允许事件写入；`event_recovery` 仅保留已有事件的恢复阅读，关闭事件新增与修改。板块 8 Preview 使用 `optional`，Production 默认保持 `legacy`；生成式问题触发条件发布时保留 `optional` 并切换策略。 |
| `INTERVIEW_EVENT_CENTERED_STRATEGY` | 事件中心内部提问策略：`baseline` 使用现有确定性提问链路，`generative` 使用同一模型的两段式结构化链路（第一段语义判断、第二段用户表达）。默认 `baseline`；板块 8 Preview 使用 `optional + generative`，生成式质量或稳定性触发回退时切换 `optional + baseline`；数据、隐私、来源或恢复主链风险切换 `event_recovery + baseline`，读路径受影响时切换 `legacy + baseline`。 |
| `EVENT_CENTERED_GENERATIVE_MODEL` | 事件中心新候选固定使用 `deepseek-v4-flash`；只在受控 Preview 或候选验证中设置，Production 保持空值直到 Board 8 明确批准。 |
| `DAILY_LIGHT_JOURNAL_PREVIEW_ENABLED` | 本地固定六案例零模型回放开关；仅在 `localhost` / `127.0.0.1` 且显式设置 `I_UNDERSTAND` 时生效，远程 UI Preview 与 Production 不使用。 |
| `EVENT_CENTERED_EVALUATION_TIMEOUT_MS` | 事件中心离线策略回放与 Judge 的超时，范围 `1000–90000ms`，默认 `18000ms`；缺省时兼容 `EVENT_CENTERED_JUDGE_TIMEOUT_MS`。不影响线上访谈超时。 |
| `EVENT_CENTERED_JUDGE_DEEPSEEK_API_KEY` | 离线 Judge 专用 API Key；仅本地或隔离评测使用，不提交仓库、不注入客户端或生产请求。缺省时可按代码顺序兼容 `DEEPSEEK_JUDGE_API_KEY` 或回放 key。 |
| `EVENT_CENTERED_JUDGE_DEEPSEEK_MODEL` | 离线 Judge 模型名，必须显式提供；兼容别名为 `DEEPSEEK_JUDGE_MODEL`。策略回放的 `DEEPSEEK_MODEL` 不会自动充当 Judge 模型。 |
| `EVENT_CENTERED_JUDGE_DEEPSEEK_BASE_URL` | 离线 Judge 的 OpenAI-compatible base URL；兼容 `DEEPSEEK_JUDGE_BASE_URL`，最后可复用 `DEEPSEEK_BASE_URL`。只记录 host 元数据。 |
| `DEEPSEEK_API_KEY / DEEPSEEK_MODEL / DEEPSEEK_BASE_URL` | DeepSeek 官方 API 的候选/目标聊天配置。API key 仅进入运行或评测进程内 provider，不写入报告和 Trace；模型名与 base URL host 可写入安全元数据。共享运行时切换后才用于官方预检。 |
| `INTERVIEW_REGENERATION_ENABLED` | 回复“换个问法”开关；`true` 开放新会话的重新生成与版本切换，`false` 让版本 2 会话沿当前路径继续完成 |
| `DEEPSEEK_API_KEY` | DeepSeek 官方 API 候选/目标聊天 Provider 的 API Key；发布到共享运行时前需要单独授权 |
| `DEEPSEEK_MODEL` | 当前聊天模型名 |
| `DEEPSEEK_BASE_URL` | 当前聊天 API 地址，默认 `https://api.deepseek.com` |
| `VOLCENGINE_ARK_API_KEY` | 历史 Ark 回退 API Key，仅在明确执行回退时使用 |
| `VOLCENGINE_ARK_MODEL` | 历史 Ark 回退模型 ID |
| `VOLCENGINE_ARK_ENDPOINT_ID` | 历史 Ark 兼容路径 endpoint |
| `VOLCENGINE_ARK_BASE_URL` | 历史 Ark 回退地址 |
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
AI_PROVIDER="openai"
INTERVIEW_INTENT_V2_MODE="enforce"
INTERVIEW_EVENT_CENTERED_MODE="legacy"
INTERVIEW_EVENT_CENTERED_STRATEGY="baseline"
EVENT_CENTERED_GENERATIVE_MODEL="deepseek-v4-flash"
INTERVIEW_REGENERATION_ENABLED="true"
DEEPSEEK_API_KEY=""
DEEPSEEK_MODEL="deepseek-v4-pro"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
# 历史 Ark 回退兼容
VOLCENGINE_ARK_API_KEY=""
VOLCENGINE_ARK_MODEL=""
VOLCENGINE_ARK_ENDPOINT_ID=""
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
APP_URL="http://localhost:3000"
ADMIN_USERNAMES=""
CRON_SECRET=""
# 事件中心离线评测（仅本地/隔离环境，Production 保持未配置）
EVENT_CENTERED_EVALUATION_TIMEOUT_MS="18000"
EVENT_CENTERED_JUDGE_DEEPSEEK_API_KEY=""
EVENT_CENTERED_JUDGE_DEEPSEEK_MODEL="deepseek-v4-pro"
EVENT_CENTERED_JUDGE_DEEPSEEK_BASE_URL="https://api.deepseek.com"
# GI-088 私有 Preview 评测（完整契约见 .env.preview.example）
EVALUATION_DATABASE_URL="" # 专属 Preview 物理库的 gi088_evaluation_v0 schema
EVALUATION_POSTGRES_HOST=""
EVALUATION_POSTGRES_DATABASE=""
GI088_EVALUATION_DATABASE_SCHEMA="gi088_evaluation_v0"
GI088_EVALUATION_ENABLED=""
GI088_EVALUATOR_USERNAMES=""
GI088_MODEL_CALL_SCOPE="disabled"
GI088_AUTHORIZED_EXECUTION_FINGERPRINT=""
GI088_SMOKE_AUTHORIZATION_ID=""
```

`AI_RUNTIME_CONFIG_SECRET` 说明：

- 这是本系统自己的加密主密钥，和 DeepSeek API Key、历史 Ark API Key 分开管理。
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

如果当前代码包含 `20260720210000_add_interview_intent_assessment`，请先同步 schema 后再启用 `enforce`：

```bash
npx prisma db push
npx prisma generate
```

共享环境使用 `npx prisma migrate deploy` 应用同名 migration。该 migration 只为 `InterviewUserTurn` 增加意图评估与决策记录字段。推荐发布顺序为：本地 `legacy` 验证 → Preview `enforce` 验证 → production 保持 `legacy` 观察 → 小范围切换 `shadow` 或 `enforce`。

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

如果你是在已有数据库上同步可恢复用户回复能力，并看到以下任一现象：

- Prisma 报 `InterviewUserTurn` 不存在
- Prisma 报 `InterviewMessage.userTurnId` 不存在
- 访谈发送后返回 `INTERVIEW_DB_WRITE_FAILED`

执行：

```bash
psql "$DIRECT_URL" -f prisma/migrations/20260720120000_add_interview_user_turn/migration.sql
npx prisma generate
```

这条 migration 会新增用户提交动作与状态枚举、`InterviewUserTurn` 表、`InterviewMessage.userTurnId` 以及幂等和待处理查询所需索引。

如果 AI 质量候选审核页出现 `AIOptimizationCandidate.reviewReason does not exist`，执行：

```bash
psql "$DIRECT_URL" -f prisma/migrations/20260720153000_add_ai_optimization_review_reason/migration.sql
npx prisma generate
```

这条 migration 为候选记录补充管理员拒绝理由字段；审核候选时拒绝动作要求填写 `4–300` 字原因。

如果今日日记接口出现 `JournalDailyEntry does not exist`、`JournalDailyEntryRevision does not exist` 或 `JournalDailyEntryGeneration does not exist`，执行：

```bash
psql "$DIRECT_URL" -f prisma/migrations/20260810180000_add_journal_daily_generation_system/migration.sql
npx prisma generate
```

如果周报/月报接口出现 `JournalPeriodReport does not exist`、`JournalPeriodReportRevision does not exist` 或 `JournalPeriodReportGeneration does not exist`，继续执行：

```bash
psql "$DIRECT_URL" -f prisma/migrations/20260811100000_add_journal_period_reports/migration.sql
npx prisma generate
```

两条 migration 分别新增今日日记和周期报告的版本、来源与生成操作记录。Preview 或其他测试环境先备份并确认 `DIRECT_URL` 指向隔离的目标库，再执行 `npx prisma migrate deploy`；网页端 UI Preview 使用独立验收库，Production migration 需要单独授权。

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
psql "$DIRECT_URL" -c '\d "InterviewUserTurn"'
psql "$DIRECT_URL" -c '\d "JoyEntry"'
psql "$DIRECT_URL" -c '\d "DailyJournalEntry"'
psql "$DIRECT_URL" -c '\d "DailyHappinessScore"'
```

你应看到这些索引已经存在：

- `InterviewSession_userId_entryDate_idx`
- `InterviewUserTurn_sessionId_clientTurnId_key`
- `InterviewUserTurn_sessionId_status_createdAt_idx`
- `JoyEntry_userId_date_idx`
- `JoyEntry_userId_status_date_idx`
- `DailyJournalEntry_userId_date_idx`
- `DailyHappinessScore_userId_date_idx`
- `JournalPeriodReport_userId_periodKind_periodStart_key`
- `JournalPeriodReportGeneration_userId_periodKind_periodStart_clientOperationId_key`
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
4. 查看首屏状态摘要和候选队列；需要补充数据时点击“检查最近回复”，确认本次运行先评估最多 20 条，再扫描最近 7 天案例。

5. 打开候选证据，确认可以看到脱敏背景、用户与 AI 对话、用户反馈和自动评分。
6. 批准候选并执行验证；验证通过后确认“全量应用”可用。退回调整时确认原因输入限制为 `4–300` 字，并能在历史记录中读取。
7. 在发布确认弹窗中核对 Prompt Key、验证结果和回滚说明，再由管理员发布。
8. 展开“上线效果观察”，核对发布前基线、发布后指标和真实案例。
9. 执行回滚，确认 `AdminAuditLog` 有记录，观察窗口提前截止。
10. 在影响范围检查“同一问题率”：已知问题码按具体问题键计算；候选缺少问题码时页面显示“口径不足”。

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
- `20260720153000_add_ai_optimization_review_reason`

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

### 2.9 用户回复恢复冒烟

建议至少覆盖一次：

1. 进入任一维度，输入一段文字但先不发送；刷新页面，确认输入草稿恢复。
2. 正常发送一条回复，观察流式请求先出现 `turn` 事件，再出现摘要、问题和最终 `session`。
3. 在收到 `turn` 后、收到 `session` 前取消请求或关闭页面。
4. 重新打开同一会话，确认原话仍在对话中，并显示待处理状态。
5. 点击“继续生成”，确认复用同一 `clientTurnId` 完成 AI 回应，最终不产生重复用户消息。
6. 用旧的 `baseMessageSequence` 再提交一条新回复，确认返回 `INTERVIEW_TURN_OUT_OF_DATE`。

### 2.10 事件中心 MVP 冒烟

事件中心写入需要 `INTERVIEW_EVENT_CENTERED_MODE=optional` 或 `event_centered`。本地验证时建议使用独立数据库或本地测试账号；Production 保持 `legacy + baseline`，不在本节直接切换生产环境变量。

最小事件闭环：

1. 启动开发服务：

```bash
npm run dev
```

2. 打开 `/interview?mode=event-centered&entryDate=YYYY-MM-DD`，确认事件中心工作区出现开场问题。
3. 提交一条用户原话，确认 SSE 先返回 `turn`，随后出现 `summary / question` 或完成/暂停回应与 `session`。
4. 在任一检查点选择“生成事件日志”，确认只使用当前活动分支的用户原话、有效事实和可写入成果。
5. 桌面端确认右侧日志书页打开；移动端确认底部日志 sheet 打开。
6. 修改标题或正文，等待约 `700ms` 自动暂存；刷新后确认 `GET /api/interview/event-centered/journal/{id}` 恢复修改。
7. 点击保存正式日志，确认 `POST /api/interview/event-centered/journal/{id}/save` 成功，日志进入 `saved`，当天事件标签可以重新打开。
8. 在生成式策略下制造一次模型失败，确认本轮最多重试一次后立即走 deterministic baseline；baseline 仍失败时显示“继续生成”，用户原话继续保留。

事件中心专项本地命令：

```bash
npm test -- tests/evals/event-centered-mvp-journal-closure.test.tsx tests/unit/event-centered-release.test.ts
npm run eval:event-centered:batch-b -- --mode=rules --all
npm run typecheck
npm run lint
npm run build
git diff --check
```

真实模型回放与 Judge 需要额外授权，运行前先确认模型、案例指纹和预算属于本次候选；有效但质量一般的输出进入评审，不用重试挑选更好的文案。

### 2.11 GI-066 历史人工实聊工作台

GI-066 修复候选只允许在本机显式开关、命名隔离数据库和 DeepSeek 官方 Provider 同时满足时回看。历史入口为：

```text
http://127.0.0.1:3010/preview/board8-gi066-review
```

页面顶部应显示 `openai · api.deepseek.com · deepseek-v4-flash`、候选 `5.65.0` 和语义产物 `v17`。该批次最新真人裁决为 `No-Go`，候选失效，剩余人工任务停止。工作台只用于历史证据回看，不承担 GI-067 裁决。

GI-067 / GI-068～074 已冻结产品规则和评测方法。GI-068 固定记录内模式保持和结束后新记录重选；新工作台继续等待板块 5 的计数、修复、回复版本、焦点纠正、失败恢复与交互收束规则，板块 6 正式评测资产，以及板块 7 新候选和 Provider 预检；板块 8 将使用两模式 `4＋2` 进行真人验收。Production 继续保持 `legacy + baseline`。

### 2.12 GI-088 私有真人评测工作台

当前证据包与后续真人验收入口为 [`GI-088 v8r2 评测底座加固资产`](../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)，实施合同见[已完成任务](./ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md)。v8r1 A1 已确认控制意图误停的单例阻断；其原 run 保持只读。v8r2 的 P0／P1、八项开门差额、最终初始化幂等、全绿静态门、不可变行为 commit 与 Execution fingerprint 均已收口；当前 Preview deployment `dpl_YRUQitffCQH264xiksHpLMviQZLy` 已 `READY`，两套 Prisma Client 已在 Vercel Linux 远程构建并通过登录存储验收，全新 run `b816d468-e3c3-4459-a822-04f95b1e78cd` 为 `ordinal=2 / revision=0 / running / 0/12 / gate=pending / high_only / high / calls=0`。当前暂停等待 12 项 Thinking high 真人验收；质量与发布未裁决，约 `200` 轮以上容量优化继续排除。运行前先从 [`.env.preview.example`](../.env.preview.example) 复核完整环境契约，并确认：

- `DATABASE_URL` 与 `EVALUATION_DATABASE_URL` 指向同一个专属 Preview 物理库，分别使用 `gi088_app_preview` 和 `gi088_evaluation_v0` schema；
- `ADMIN_USERNAMES` 与 `GI088_EVALUATOR_USERNAMES` 同时命中评测人；
- `GI088_EVALUATION_ENABLED=I_UNDERSTAND`；
- 正式 run 只使用 `GI088_MODEL_CALL_SCOPE=batch` 和当前精确执行指纹；
- v8r2 仅开放 Thinking high；历史 off/high 冒烟及探针授权继续只读，新的模型探针不属于本轮开门步骤。

静态检查：

```bash
npm run prisma:gi088:generate
npm run prisma:gi088:validate
npm run eval:gi088:inspect
npm run typecheck
git diff --check
```

`eval:gi088:inspect` 只重算资产、指纹和血缘，不产生模型请求。v8r2 已完成主要零模型回归、真实评测库集成、历史兼容、全量测试、typecheck、ESLint、两套 Prisma validate、Production build、Preview build、行为清单与 diff check；最终结果与线上回读已经统一进入 v8r2 资产目录。

Preview 发布上传源码并交给 Vercel Linux 远程构建；[vercel.json](../vercel.json) 会在 `next build` 前重新生成主库与评测库两套 Prisma Client。macOS 本机 `vercel build` 产物只用于本地检查，不进入 `vercel deploy --prebuilt`，避免把本机 Prisma engine 带入 Linux 运行时。

独立 schema 部署使用 `npm run prisma:gi088:deploy`，命令要求 `GI088_EVALUATION_SCHEMA_DEPLOY=I_UNDERSTAND`，并在调用前核对目标为 Preview 专属库。迁移 `20260810180000_add_v8r2_foundation_hardening` 增加 run ordinal、gate、调用账本、幂等操作、程序介入、人工修订、操作事件和导出快照；它会替换旧的 owner+version 唯一约束，同时保留旧数据和旧 JSON。兼容迁移后的只读回读确认 v8r1 原 run 仍为 `runOrdinal=1`、`running`、活动任务 A2、已完成轨迹 `1`、Provider 调用 `2` 且均为 `valid`。

故障处理：

- `GI088_TURN_OUT_OF_DATE` 或 `GI088_REVIEW_SNAPSHOT_OUT_OF_DATE`：读取最新状态，保留草稿，重新阅读后确认；本次模型调用为零。
- `GI088_PROVIDER_PREFLIGHT_FAILED`：用户原话已保存，调用账本不计 dispatched；修复配置后按页面动作继续。
- `GI088_CALL_FINALIZATION_FAILED`：读取最新状态完成稳定失败收口，确认 pending 和 operation 已退出处理中；已经落账的 Provider 结果继续保留，读取过程不调用模型。`GI088_RESULT_PERSISTENCE_UNKNOWN`：停止自动模型重调，等待数据库恢复后按调用截止对账。
- 生成期间刷新或断线：页面每两秒只读轮询 pending turn；服务端按调用截止与共享恢复截止收口。
- 当前项阻断：使用“终止当前任务并保留部分证据”；该项进入 aborted、gate 进入 no_go，后续任务仍可继续采集。
- 历史指纹不匹配：进入只读查看和导出；创建新 run 需要当前候选与新 `clientOperationId`。
- v8r2 开门合同 `GI088_TECHNICAL_FAILURE_EVIDENCE_REQUIRED`：轨迹中缺少可支持“技术失败阻断”的冻结事实，重新选择准确的目标触发结论。
- v8r2 开门合同 `GI088_OPERATION_EVENT_LINEAGE_INVALID`：客户端事件引用了不属于当前 run 的 task 或 turn；读取最新 run 后重新上报，聊天与评价数据保持不变。
- typed error catalog 检查失败：先补齐 store／service 错误的 HTTP 状态、中文原因、保存情况和恢复动作，再开放 Preview。
- 导出：只接受终态 run；首次导出冻结 payload 与 receipt，后续下载直接返回同一快照；客户端重算 canonical payload SHA256 后再标记收据验证成功。

访问最终 v8r2 Preview 时先通过 Vercel Deployment Protection，再使用 Daily Light 应用账号登录。最终 deployment 为 `dpl_YRUQitffCQH264xiksHpLMviQZLy`，URL 为 `https://xingfuxitong-iqddtq6e2-zouzhijies-projects.vercel.app`，Execution fingerprint 为 `96f1a022aede41b3648ecd60c4770bd66ea003b870ffcec85c9db2b0531cfd0c`。该 deployment 使用修复源码 commit `0a993afad1248e67a2863456d2c35b774bb2130f` 在 Vercel Linux 远程生成两套 Prisma Client；虚构账号登录验收已返回 `401 INVALID_CREDENTIALS`，deployment error logs 为 `0`。当前 run `b816d468-e3c3-4459-a822-04f95b1e78cd` 已回读为 `ordinal=2 / revision=0 / running / 0 of 12 / gate=pending / high_only / high / calls=0`，并确认由绑定最终指纹的新 `clientOperationId` 创建。旧预发布零内容 run 已行政 `early_stopped` 并作为脱敏排除记录。Production 的 GI-088 页面和接口继续统一返回 `404`。

事件日志生成故障处理：

- AI 请求失败、JSON 无效或来源门拒绝：检查 Trace 的失败阶段与来源门结果，预期使用安全基础版本。
- 来源不足：接口返回 `EVENT_JOURNAL_SOURCE_INSUFFICIENT`，工作区恢复上一检查点，让用户补充材料。
- 版本冲突：重新 GET 当前日志，合并用户编辑后使用最新 `expectedContentRevision` PATCH/save。
- 日志生成或保存连续失败：保留原话和当前事件，暂停后续入口切换，交由 Board 8 Go/No-Go 处理。

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

## 4. 最小冒烟路径

建议每次改动后至少跑一遍 joy 主链路：

1. 打开 `/interview?dimension=joy`
2. 启动一轮 joy 访谈
3. 输入 2-3 轮内容
4. 点击“生成日志”
5. 确认右侧出现日志正文，而不是结构化线索
6. 编辑标题或正文
7. 点击“保存正式日志”
8. 刷新页面，确认 session 和日志可恢复
9. 在仍有用户回复的活动访谈中点击 header 的“日历”或“分析”，确认直接完成站内跳转
10. 在活动访谈页面执行浏览器刷新或关闭操作，确认浏览器离开保护仍会保存会话恢复标记

### 4.1 提问链路专项验证

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

### 4.2 joy 日志质量冒烟场景

如果当前改动涉及 joy 抽取、闭合判断、正文生成、fallback draft、质量门或标题治理，除主链路外至少覆盖：

1. 早起轻快乐：输入“今天早起了半小时，洗漱不赶，路上还多买了杯热豆浆，感觉整个人清醒一点。”，生成标题不应是 `一下被带轻 / 象征意义 / 确定性`，应收束为 `清醒地开始` 这类自然短标题。
2. 抽象闭合防线：如果抽取器返回 `动作本身带来的确定性 / 早起这件事的象征意义 / 清醒 / 从容 / 有准备` 作为 `delightSignature`，不应判定 `delight_track` 已完整闭合，也不应因此提前进入生成日志 choice。
3. 正文理论腔防线：AI draft 或 fallback draft 不应出现“这份开心更像轻快乐”“关键不是深意义”“这种会把状态轻轻带起来的方式”这类内部解释句。
4. partial 边界：用户已有 `joyMoment + joySource + stateShift|meaningNeed` 后说“别追问了，直接整理”，可以生成当前版本日志，但不能硬写稳定规律。

### 4.3 calendar 月视图冒烟场景

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

### 4.4 analysis 入口冒烟场景

如果当前是在调记录分析入口，每次改动后至少人工覆盖：

1. 打开 `/analysis`
2. 预期：URL 归一到 `/analysis?month=<北京时间当前 YYYY-MM>&section=trends`
3. 预期：页面连续渲染 `评分与记录趋势`、`五维记录线索` 两段，顶部显示 `量化趋势 / 五维记录` 两个锚点按钮
4. 点击 `本周 / 本月 / 自定义`，并使用前后周期按钮
5. 预期：URL 更新 `preset / month / start / end`，周期显示与 loading 文案同步变化
6. 点击 `五维记录`
7. 预期：页面滚动到五维段，URL 更新为 `section=dimensions`；手动滚回趋势段时 scroll spy 把 URL 更新为 `section=trends`
8. 直接打开旧 URL `section=overview / score / rhythm`
9. 预期：统一归一到 `section=trends`
10. 直接打开旧 URL `section=insights / correlation / review`
11. 预期：统一归一到 `section=dimensions`
12. 量化趋势段应展示周期摘要、总分柱线图、日志天数色块和 8 要素雷达/棒棒糖；页面只读，不出现评分编辑器
13. 点击雷达/棒棒糖切换，并在支持触摸或指针拖动的环境横向 swipe
14. 预期：连续快速切换从当前滑块位置继续，完整拖动切换视图，原始位移小于 `10px` 时保持当前视图，页面纵向滚动位置不被横向手势改变
15. 五维记录段展开任一维度，再展开一个代表片段
16. 预期：显示真实记录摘要、来源日期以及“在日历中打开 / 看完整日志 / 继续这条线”等有效入口
17. 点击代表片段入口
18. 预期：日期和维度保持一致，跳转到对应日历或访谈日志，不跳到其他日期
19. 切换到无评分、无日志的周期
20. 预期：两个段落都显示真实空态，不出现示意数据或历史 `建议先看 / 待成文` 文案
21. 让 `/api/analysis/range` 失败而 `/api/analysis/month` 成功
22. 预期：趋势段显示局部错误，五维记录段继续可读
23. 让 `/api/analysis/month` 失败而 `/api/analysis/range` 成功
24. 预期：五维记录段显示局部错误，趋势段继续可读

### 4.5 流动交互与无障碍冒烟

涉及共享交互、顶栏、日志书页、菜单或弹窗时，至少覆盖：

1. 在 `390×844`、`768×1024`、`1280×720` 下打开访谈、日历和分析
2. 预期：小屏 header 分成两行，上下文工具栏可以横向滚动；所有操作可见或可滚动抵达，页面本身无横向溢出
3. 按住主要按钮、交互卡片和日历格
4. 预期：pointer-down 当帧出现缩放、颜色或阴影反馈，松开后恢复；disabled 控件保持静止
5. 连续快速点击 segmented 的相邻和非相邻项
6. 预期：滑块从当前屏幕位置继续运动，无瞬移或重置
7. 在画像或分析分页上横向拖动，同时尝试页面纵向滚动
8. 预期：横向拖动达到阈值时切页，短拖保持原页，纵向滚动可继续使用
9. 在移动端打开日志书页，向下拖动超过 `90px` 或以较高速度释放
10. 预期：书页沿底部来源关闭；桌面书页沿右侧来源进入和退出
11. 打开 `ActionMenu`，依次使用 ArrowDown / ArrowUp / Home / End / Escape
12. 预期：焦点在菜单项之间循环，Escape 关闭后回到触发按钮；靠近视口边缘时菜单选择可用方向展开
13. 打开危险确认弹窗，使用 Tab / Shift+Tab / Escape
14. 预期：初始焦点位于取消按钮，焦点保持在弹窗内，关闭后回到触发按钮
15. 分别启用 reduced motion、reduced transparency 和增强对比度
16. 预期：横向拖动、平滑滚动和按压缩放关闭，spring 收敛为短缓动，弹层使用短透明度过渡；透明材质改为近实色，边框和次级文字清晰可辨

### 4.6 画像页冒烟

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

### 4.7 fulfillment 冒烟场景

fulfillment 已是理论对齐维度，每次改动 fulfillment 访谈或日志生成后，至少人工覆盖：

1. 推进完成：例如“把拖了很久的任务推进完，卡住部分收口”
2. 投入积累：例如“练习、学习、熟练度有一点真实积累”
3. 协作贡献：例如“配合、支持、交接、帮到别人”
4. 空忙空转：只有忙、会议、任务很多时，不应硬写进展证据或值得感标准
5. 用户拒绝继续深挖或自然语言要求整理日志：已有 `experience + progressEvidence` 后，用户说“先这样，直接生成日志”或“总结日志”，应进入 partial draft choice
6. 用户拒绝继续但材料不足：只有 `experience` 或只有模糊片段时，用户说“别问了”，应展示“只补一句 / 换一个片段 / 先退出”
7. 标题治理：生成的 fulfillment 标题不应是长事件句截断，例如不应出现“看了一本相关的书籍，介绍怎么解活”

### 4.8 reflection 冒烟场景

reflection 已是理论对齐维度，每次改动 reflection 访谈或日志生成后，至少人工覆盖：

1. 规律发现：例如“今天看完项目复盘后，我意识到自己以前太容易把忙碌当成进展”
2. 方向优势：例如“今天帮别人理清问题时，我发现自己更擅长把混乱信息整理成判断依据”
3. 判断校准：例如“真正有进展的是能说明判断依据变清楚了”
4. 空泛想法：只有“今天想了很多 / 有点焦虑”时，不应硬写触发片段或判断线索
5. 用户拒绝继续深挖或自然语言要求整理日志：已有 `trigger + insight` 后，用户说“先这样，直接生成日志”或“总结日志”，应进入 partial draft choice
6. 用户拒绝继续但材料不足：没有具体触发片段或新理解时，用户说“别问了”，应展示“只补一句 / 换一个片段 / 先退出”
7. 标题治理：生成的 reflection 标题不应是长事件句截断，判断校准类材料可压成“忙碌不等于进展”“判断依据变清楚”这类短标题
8. 继续深聊防回卷：如果上一轮已经问过“有没有具体经历 / 对话”，用户明确回答“没有”，再点 `继续深聊` 后不应重复追同一字段；下一问必须改成更低压的具体锚点，例如某个顾虑、脑中画面、比较时刻或选择瞬间

### 4.9 improvement 当前冒烟场景

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

### 4.10 gratitude 当前冒烟场景

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

### 4.11 当天整合日志冒烟场景

如果当前改动涉及 `/api/daily-journal*`、今日日志面板、移动端【完整日志】快捷入口或 calendar 日视图入口，至少覆盖：

1. 在同一 `entryDate` 下保存至少一篇维度日志
2. 打开 `/interview?dimension=joy&entryDate=2026-05-03`
3. 桌面端点击右侧「今日日志」面板底部的 `生成日志`；移动端点击对话区顶部的【完整日志】
4. 预期：依次请求 `POST /api/daily-journal/generate` 和 `POST /api/daily-journal/[id]/save`，随后打开当天日志工作区；来源只统计已保存维度日志
5. 预期：正文只包含已有维度章节，不出现空章节或缺失维度提醒
6. 如果随后又在同一天新增一篇 `saved` 维度日志，重新打开当天整合日志
7. 预期：今日日志面板日级按钮显示 `更新日志`；点击后章节数与当天真实 `saved` 维度集合重新对齐，并重新保存
8. 修改标题或正文，等待自动保存，再点击保存正式日志
9. 预期：`GET /api/daily-journal?date=2026-05-03` 返回 `state = "saved"`
10. 从 `/calendar?view=day&date=2026-05-03` 进入当天日志 deep link
11. 预期：`mode=daily-journal` 只打开当天日志主区，不会调用 `/api/interview/session/start`
12. 点击“回到访谈”
13. 预期：如果标题或正文有未等到 700ms 自动保存的修改，会先请求 `PUT /api/daily-journal/[id]`；保存成功后 URL 移除 `mode=daily-journal`，回到同一日期的普通访谈 hydrate 流程
14. 再次进入完整日志工作区，修改正文后直接点击另一个访谈维度
15. 预期：前端先保存当天日志 pending 编辑，再把主工作区切回普通访谈；新维度访谈保持可见

### 4.12 同一天的维度数与完整日志来源数对不上

症状：
- 顶部维度胶囊、`/api/calendar/day` 和当天整合日志里的 `availableSourceCount` 看起来不一致

处理：
1. 先确认查询日期用的是 `entryDate`，不是浏览器当前自然日
2. 直接看：
   - `GET /api/calendar/day?date=YYYY-MM-DD`
   - `GET /api/daily-journal?date=YYYY-MM-DD`
3. 当前仓库按 `Asia/Shanghai` 整天时间窗口归档：同一天任意时刻保存的维度日志，都会被归到对应 `entryDate`
4. 如果 `dailyJournal.state = "stale"`，说明同一天 `saved` 维度集合已经变化；此时点击“重新生成”让章节数与最新来源重新对齐

## 5. 测试命令

```bash
npm run typecheck
npm test
```

`npm run typecheck` 会先执行 `next typegen`，再执行 `tsc --noEmit`。`next-env.d.ts` 由 Next.js 自动生成并保留在本地忽略范围；`.firecrawl/` 只保存本地研究缓存，正式结论进入来源文档、评测报告或复盘。

截至 `2026-08-12`，当前验证口径是：
- `npm test`（Vitest）以主仓测试集为准；真实文件数与测试数以最近一次全量绿灯记录为准
- 旧 UI Preview 网页端高保真专项：`8` 个测试文件、`36/36` 个测试通过，作为历史工程证据保留
- `npm run typecheck`、`npm run lint`、`npm test`、`npm run build` 与 `git diff --check` 以当前分支最近一次完整验证记录为准
- 旧远程 Vercel UI Preview 构建状态为 `Ready`；当前新前端仍在构建，尚未完成产品验收
- 日志生成评测资产的结构验证、隔离检查和 mock/静态单测单独记录；真实模型调用、远程数据库写入和真人提交需要独立授权
- Vitest 当前默认只扫描 `tests/**/*.test.{ts,tsx}`，并排除 `.worktrees/**` 与 `.claude/worktrees/**`，避免历史 worktree 测试噪声污染主仓回归

## 6. 托管平台主线

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

### 6.1 Preview 部署后最小检查

#### Daily Light 旧 UI Preview 历史工程证据（2026-08-12）

以下独立 UI Preview 已部署完成，作为当前新前端的工程联调参考：

```text
https://xingfuxitong-myks9m13t-zouzhijies-projects.vercel.app
deployment: dpl_8yNo4LoHehdowfuCtsdm4BU3w417 (Ready)
```

Preview 使用独立验收数据库，环境为 `INTERVIEW_EVENT_CENTERED_MODE=event_centered`、`INTERVIEW_EVENT_CENTERED_STRATEGY=baseline`，`GI088_EVALUATION_ENABLED` 关闭；`.vercelignore` 已排除私有评测页面、评测接口与本地评测脚本。Production `https://dailylight.chat` 保持当前版本、数据库和开关。

历史验收清单：

1. 打开 `/interview?mode=event-centered&entryDate=2026-08-12`，确认无会话时看到当天工作台空状态；点击【帮我记】或【陪我聊】后才开始记录。
2. 确认三阶段进度位于顶部导航上下文区，聊天区只显示消息和输入框；理解、提问与用户消息使用统一的 dailylight.chat 气泡体系。
3. 在 AI 回复下方依次验证赞、踩、重新生成；打开菜单后验证“更简单一点 / 更具体一点 / 换一个角度”、键盘方向键、Esc 关闭和焦点回到触发按钮。
4. 打开 day / week / month 三个 `/calendar` 地址，确认加载、错误、空状态和有数据时都保留归档侧栏 + 报告画布骨架。
5. 在 `1440×900` 与 `1024×768` 两个桌面尺寸各刷新一次，确认顶部进度、输入区和报告主动作仍可见；保存后再次刷新，确认状态和内容恢复。

浏览器核验已覆盖空工作台、访谈启动、事件保存和日报/周报/月报结构。当前新前端完成产品验收后，再接入固定六案例 Preview；真实模型质量评测、正式 `dev28＋hidden12` 和 Production 发布沿后续阶段单独处理。

以 `docs/vercel-preview-production-lane.md` 为 source of truth，按 preview 是否受保护分流：

1. protected preview：

```bash
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE="your-vercel-scope" \
ACCEPTANCE_BASE_URL="https://your-preview-url.vercel.app" \
node scripts/product-smoke.mjs joy 2026-05-19
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

`product-smoke.mjs` 默认复用固定的 `preview_acceptance` 账号，仅在首次缺失时注册；可通过 `PRODUCT_SMOKE_USERNAME / PRODUCT_SMOKE_PASSWORD` 显式切换另一组固定凭据。当前自动化只覆盖：

- 固定验收账号复用或首次注册
- 登录 / session 建立
- `POST /api/interview/session/start`
- `invalid_entry_date` 拒绝路径

它当前不自动覆盖更深的 `joy -> respond -> wrap_up -> draft generate -> draft save`。这条更深链路如果需要证据，仍由 controller 手工 deep-chain 补证。

### 6.2 Production URL contract direct readback

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

### 6.3 UserTurn 可恢复提交验收

公开 smoke 覆盖账户、会话创建与日期校验。每次涉及访谈提交、流式输出或数据库 migration 的 production 发布后，还应补一次可恢复提交验收：

1. 用临时账号新建一条访谈会话，记录请求中的 `clientTurnId` 与 `baseMessageSequence`。
2. 提交一段普通文本，确认 SSE 先收到 `turn`，最终收到完整 `session`。
3. 使用相同的 `clientTurnId` 重放该提交，确认会话轮次和消息数量保持稳定，服务端直接返回既有完成结果。
4. 通过刷新或停止生成制造待恢复状态，确认 hydrate 返回 `pendingUserTurn`，点击“继续生成”后只补出一条对应的 AI 消息。
5. 在 Preview 的 `enforce` 模式下提交“直接生成日志”“换个问法”“先到这里”等表达，确认生成、重问和收束符合用户意图；引用事件里的相似措辞继续作为对话内容处理。
6. 清理临时账号及其测试数据；production 只保留真实用户数据。

若需要数据库侧佐证，可按第 `7.5` 节“访谈回复显示结构化错误”查询 `InterviewUserTurn` 状态、重试次数和错误码。

### 6.4 当前不开放的能力

- `/api/transcribe` 仍是 stub，不纳入 preview / production smoke
- 没有真实转写模型前，不开放语音入口

### 6.5 按意图重新生成发布检查

涉及 `20260720223000_add_interview_response_regeneration` 的发布按以下顺序执行：

1. 对目标数据库执行 `npx prisma migrate deploy`，确认迁移已应用。
2. Preview 使用独立数据库，设置 `INTERVIEW_REGENERATION_ENABLED=true`，完成五维换问法、纠正理解、历史分支、三个版本上限和日志锁定验收。
3. 确认目标回复气泡承担唯一加载反馈；操作区保持静态禁用入口，避免第二套加载状态。
4. 推广已验收的 Preview 或重新部署同一代码版本到 production。
5. 生产只做真实用户可用性检查；固定验收账号与验收数据继续留在 Preview 数据库。

功能暂停时设置：

```bash
INTERVIEW_REGENERATION_ENABLED=false
```

已有版本和分支会保留，用户继续沿当前采用路径完成访谈。

## 7. 高频故障排查

### 7.1 `npm run build` 失败

当前 `2026-07-20` 验证基线为生产构建通过，并保留既有 ESLint warnings。新出现的非零退出码需要按本次构建日志定位：

1. 先运行 `npm run typecheck`，区分 TypeScript 错误与 Next.js 构建错误。
2. 再运行 `npm run lint`，记录新增 error 与既有 warning。
3. 确认 Prisma Client 已通过 `npm install` 的 `postinstall` 生成；需要时执行 `npx prisma generate`。
4. 检查部署环境是否已应用当前 migrations。
5. 用首次出现的文件位置和错误码排查，避免把 warning 当成构建失败原因。

### 7.2 启动访谈失败，报缺少 `snapshotData` 或 `payload` 列

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

### 7.3 旧本地库同步后报 `entryDate` 必填列无法新增

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

### 7.4 “生成日志”按钮长时间显示忙碌

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

### 7.5 访谈回复显示结构化错误

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
| `INTERVIEW_TURN_IN_PROGRESS` | 服务端已经接收这条回复；等待完成或刷新查看 `pendingUserTurn` |
| `INTERVIEW_TURN_OUT_OF_DATE` | 页面停留在较早对话位置；刷新后重新发送 |
| `INTERVIEW_TURN_RETRY_REQUIRED` | 原话已经保留；在待处理提示中点击“继续生成” |
| `INTERVIEW_TURN_NOT_FOUND` | 指定的待恢复提交已经失效；刷新后按最新会话状态继续 |
| `INTERVIEW_DB_WRITE_FAILED` | 检查数据库连接与 Prisma 报错，用户原输入应仍在输入框 |
| `INTERVIEW_RESPONSE_SCHEMA_ERROR` | 检查服务端返回的 session hydrate 是否符合 schema |
| `STREAM_PROTOCOL_ERROR` | 检查 SSE `event/data` 格式与前端流式解析 |
| `INTERVIEW_RESPOND_FAILED` | 看 dev server 日志里的 requestId 和堆栈 |

如果要快速验证结构化错误链路，可发一个超过 `1200` 字的回复；预期返回 `MESSAGE_TOO_LONG`，前端提示拆成两段发送。

如果页面长期显示“这条回复仍在处理中”，可直接检查：

```bash
psql "$DIRECT_URL" -c 'select "clientTurnId", "status", "attemptCount", "errorCode", "updatedAt" from "InterviewUserTurn" order by "updatedAt" desc limit 10;'
```

`failed / canceled` 应在页面提供“继续生成”；`processing` 长时间不变化时，结合 requestId、服务端日志和当前请求是否仍在运行判断。

### 7.6 draft 生成失败，但页面保持可用

这是预期保护行为。

当前 draft 生成链路：
- 先尝试 AI structured output
- 如果 provider 不可用或 schema 不合法，会退回 fallback draft
- 只有写库失败或严重上游错误，才会真正返回失败状态

如果看到“日志草稿风格太机械”，不一定是 bug，也可能是触发了 fallback。

### 7.7 AI provider 排障顺序

当 production / preview 看起来“像没接大模型”时，优先按下面顺序排：

1. 先查配置形态
2. 再查 provider 最小探针
3. 最后才看访谈主链日志

当前代码事实：

- `DEEPSEEK_MODEL` 是当前聊天模型，`DEEPSEEK_BASE_URL` 默认指向 `https://api.deepseek.com`
- provider 初始化阶段会识别：
  - 缺少 DeepSeek key / model
  - `$DEEPSEEK_...` 这类占位串
  - 非法 `DEEPSEEK_BASE_URL`
- guarded `GET /api/debug/runtime-env?probe=1` 会返回：
  - `ai.state`
  - `ai.code`
  - `ai.issues`
  - `ai.probe.status`
  - `ai.probe.code`
- 这条 route 在 production 默认应保持关闭；只在短时验证窗口中临时开启，验证结束后立即恢复 `ENABLE_RUNTIME_ENV_READBACK=0`

排障判断：

- `ai.state=config_invalid`
  - 说明问题还在 env 值形态层，例如把 `$DEEPSEEK_API_KEY` 当作字面值写进平台
- `ai.state=ready` 且 `ai.probe.status=200`
  - 说明 provider 真实可用；如果用户仍觉得“像 fallback”，再去看访谈 prompt / 追问质量
- `ai.probe.code=ACCOUNTOVERDUEERROR`
  - 说明当前被探测的上游账户额度或计费状态阻断了调用；先确认探针记录的 base URL，DeepSeek 官方 API 与历史 Ark 运行时分别判断
- `ai.probe.code=ACCESSDENIED`
  - 说明当前 key 无权访问所配置的模型或地址；先核对 DeepSeek 官方 API 的 key、模型名和 base URL，历史 Ark endpoint 只在明确回退时排查

历史 Ark 运行时曾验证过的一条模型路径（仅供历史追溯）：

```bash
VOLCENGINE_ARK_MODEL="deepseek-v3-2-251201"
VOLCENGINE_ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
```

### 7.8 标题看起来像半截句子

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

### 7.9 用户说“不想继续 / 总结日志”，系统还在追问细节

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

### 7.10 语音转写看起来“能用”，但文本明显不对

当前 `/api/transcribe` 只是 stub：
- 上传 `audio`
- 返回一段占位 transcript

这意味着：
- 现在不应该把语音质量问题当作模型 bug 排查
- 真正的转写模型还没接上

### 7.11 浅色 `thinkingSummary` 看起来像第二个追问

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

### 7.12 AI 质量后台读取失败

症状：

- `/admin/ai-quality` 的效果区提示数据连接暂不可用
- 响应包含 `P1001 / P1017 / P2024` 或 `AI_QUALITY_IMPACT_FAILED`

处理：

1. 记录页面展示的 `requestId`。
2. 先点击局部“重新加载”；管理员只读查询已经等待约 `300ms` 并重试一次。
3. 检查 `DATABASE_URL` 的 pooler 连通性与连接池占用。
4. 检查服务端对应 requestId 日志；Prisma 原始错误只会出现在服务端。
5. 数据库恢复后重新展开效果区或真实案例。

候选缺少通过验证时，候选 PATCH 路由返回 `409 OPTIMIZATION_VALIDATION_REQUIRED`。管理员完成回放验证并获得通过结果后，可以重新发布。

### 7.13 事件中心生成失败或事件日志无法保存

先确认请求所在发布档位：

```bash
printf '%s\n' "$INTERVIEW_EVENT_CENTERED_MODE" "$INTERVIEW_EVENT_CENTERED_STRATEGY"
```

预期生产值为 `legacy` 与 `baseline`。Preview 发布门通过且获得单独批准后才设置 `optional + generative`；生成式问题按分层回退顺序切换到 `optional + baseline`，数据、隐私、来源或恢复主链风险切换到 `event_recovery + baseline`，读路径受影响时切换到 `legacy + baseline`。事件中心写入只有在 `optional` 或 `event_centered` 时开放；`event_recovery` 只允许读取已有事件。

按现象排查：

- `EVENT_CENTERED_ENTRY_DISABLED` / `EVENT_CENTERED_FUTURE_DATE`：检查入口档位和 `entryDate`，不要修改数据库绕过写入门。
- `EVENT_STATE_CHANGED` / `EVENT_OPERATION_CONFLICT`：刷新事件中心工作区，确认活动分支与最后消息序号，再用新的 `clientTurnId` 或原提交恢复。
- SSE `error` 且 `turn` 已到达：用户原话已经保存；从工作区点击“继续生成”，服务端复用同一 `clientTurnId`，不会重复原话。
- 生成式第一段或第二段失败：查看 `AIGenerationTrace` 的请求策略、失败阶段、错误码和最终策略；当前最多一次技术重试，随后应直接记录 `effectiveStrategy=baseline`。
- 事件日志 AI 草稿被来源门拒绝：确认 Trace 中的 `sourceFingerprint`、`sourceGrounded` 与拒绝原因；预期使用安全基础版本，基础版本只整理来源事实。
- `EVENT_JOURNAL_SOURCE_INSUFFICIENT`：当前事件材料不足，保留上一检查点并让用户补充；不要通过关闭来源门强行生成。
- `EVENT_JOURNAL_ENTRY_VERSION_CONFLICT`：重新 GET 当前内容版本，合并编辑后用最新 `expectedContentRevision` PATCH/save。
- `JOURNAL_DAY_MODE_CONFLICT` / `JOURNAL_DAY_MODE_MIXED`：同一日期存在活动事件或不一致日志工作区，先从当前事件标签恢复并完成保存，再重试当天操作。

离线 Judge 的 API key、模型和 base URL 仅供本地/隔离评测。生产排障不应临时把 Judge 凭据加入 Production，也不应通过 `/api/debug/runtime-env` 读取 key；该诊断面只允许白名单运行环境字段。

### 7.14 GI-088 轨迹出现 `EMPTY_CONTENT` 或程序保护

先在右侧 Trace 区分两类结果：

- `finishReason=length`、`completionTokens` 与 `reasoningTokens` 相等、可见内容为空：输出空间被 Thinking 耗尽。v0 在 `1600` Token 上限下已连续复现三次；v1 已省略应用层 `max_tokens`。
- `protected_failure`：Provider 已返回最终内容，结构、来源或“单轮一问”等确定性边界未通过。原始结果和校验问题保留，状态不合并进正式对话。

v1 在两类失败下都提供“结束并评价当前技术失败”。手动重试每次都会新增一次模型请求，适合偶发网络、超时或 Provider 抖动。相同参数已稳定复现的预算耗尽直接保留失败并评价，避免消费额外请求。

### 7.15 周报/月报读取或保存失败

- `JournalPeriodReport does not exist`：按第 2.2 节应用 `20260811100000_add_journal_period_reports`，再执行 `npx prisma generate`。
- `409` 且提示来源变化：先重新读取 `/api/journal/period`，确认新的 `sourceSignature`，再由页面使用“更新”动作生成；用户手工编辑内容会保留在当前草稿版本。
- `409` 且提示版本冲突：重新读取报告，合并需要保留的正文后使用最新 `expectedContentRevision` 自动暂存或保存。
- 生成中刷新页面：读取 `latestGeneration`，状态恢复为 `generating / draft / stale / update_failed` 之一；重复点击使用同一个客户端操作编号，不应产生重复报告。
- 日报、周报或月报显示空状态：先核对 `Asia/Shanghai` 日期范围和有效事件卡片 / 已保存上层报告来源，再判断是否确实没有可汇总素材。

## 8. 关键日志与定位点

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
- `InterviewUserTurn`（事件中心原话、可靠提交、重试与失败码）
- `JournalEventEntry` 及生成预留记录（来源快照、内容版本、生成状态）
- `AnalyticsEvent`（事件中心入口、检查点、回合降级、日志生成/保存和放弃）
- `JoyEntry`

## 9. 当前已知非故障现实

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
- `/analysis?month=YYYY-MM&section=trends|dimensions` 当前为量化趋势与五维记录两段纵向 scroll + 顶部锚点工作台；缺失 `section` 时默认 `trends`。旧 `overview|score|rhythm` 归一到 `trends`，旧 `insights|correlation|review` 归一到 `dimensions`。量化趋势走 `GET /api/analysis/range`，五维记录走 `GET /api/analysis/month`。`PUT /api/happiness-score` 允许保存所有非未来日期，评分录入入口位于访谈页「当天评分」工作区。
