# Vercel Preview / Production Lane

最后更新：`2026-05-19`

## 目标

把 Daily Light 的首条正式托管平台主线固定为 `Vercel`，先解决：

- preview / production 用哪条平台路线
- 环境变量怎么分层
- 每次部署完最小要验什么

这份文档只定义首条可执行主线，不展开 VPS、自建网关或多云冗余。

## 为什么先选 Vercel

- 当前仓库是标准 `Next.js App Router` 应用，没有必须先走 VPS 的技术约束。
- 当前最缺的是“从本地代码到一个可访问预发布环境”的闭环，不是服务器控制权。
- Vercel 对这类应用的首条 preview / production 路线更短，和当前批次目标一致。

## 环境合同

### Preview

使用 [`.env.preview.example`](../.env.preview.example) 作为平台环境变量清单来源。

至少要填的用户自定义变量：

- `DATABASE_URL`
- `AI_PROVIDER`
- `VOLCENGINE_ARK_API_KEY`
- `VOLCENGINE_ARK_ENDPOINT_ID`
- `VOLCENGINE_ARK_BASE_URL`

可选：

- `VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID`

规则：

- Preview URL 合同不再要求一律手填 `APP_URL`
- 如果项目启用了 Vercel 的 system environment variables 暴露，可优先使用 `https://${VERCEL_URL}` 作为当前 deployment URL，或按需要使用 `https://${VERCEL_BRANCH_URL}` 作为 branch 级 preview URL
- 如果项目没有暴露上述 system env，才回退为手工维护 `APP_URL`
- 当前批次还没有直接证据证明 `xingfuxitong` 已启用该能力；依赖这条路径前，必须额外验证项目设置里的 `Automatically expose System Environment Variables` 开关，以及部署运行时是否能读到 `VERCEL=1`
- preview 数据库必须和本地库、生产库隔离

### Production

使用 [`.env.production.example`](../.env.production.example) 作为正式环境清单来源。

规则：

- Production URL 合同可由显式 `APP_URL` 或暴露后的 Vercel system env 满足
- 如果依赖 Vercel system env，生产指向应来自 `https://${VERCEL_PROJECT_PRODUCTION_URL}`；该变量在 Vercel 文档中定义为项目生产域名，即使在 preview deployment 中也会提供生产域语义
- 如果项目未暴露 system env，才要求手工维护 `APP_URL`
- 当前还没有直接证据证明 `xingfuxitong` 已在目标生产环境里直接暴露出 `VERCEL_PROJECT_PRODUCTION_URL`，也还没有拿到显式 `APP_URL` readback
- 因此，production URL 合同当前只能写成 `partially unverified`，不能写成已闭环；上线前仍需补做一次项目设置与运行时 readback，确认 `Automatically expose System Environment Variables` 已开启，并直接拿到 `APP_URL` 或 `VERCEL_PROJECT_PRODUCTION_URL`
- 生产库和 preview 库必须隔离
- 如果记忆系统暂时不开，`VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID` 可以先留空

## 最小发布步骤

1. 在 Vercel 创建项目并连接当前仓库
2. 把 preview 环境变量按 [`.env.preview.example`](../.env.preview.example) 填入平台；这里指 AI / 数据库类用户自定义变量，不再把 `APP_URL` 作为“无条件必须手填”的第一选择
3. 确认 [package.json](../package.json) 保留 `postinstall: prisma generate`
4. 确认根目录 [vercel.json](../vercel.json) 保留 `framework: "nextjs"`，避免项目后台残留 `Other` preset 时 preview 域名落到 `404`
5. 确认 Vercel 的默认 build 命令保持 `next build`
6. 首次部署前确认 `.vercelignore` 已排除 `.worktrees`、`.claude`、`.omx`
7. 等首个 preview 部署完成后：
   如果当前 preview 开启了 Deployment Protection，当前已验证通过的自动化 smoke 路径是 `vercel-curl` transport；在任意 `.worktrees/...` 目录执行时，`scripts/launch-acceptance-runner.mjs` 也会自动把 Vercel cwd 回退到父 repo 根目录。执行：

```bash
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE="your-vercel-scope" \
ACCEPTANCE_BASE_URL="https://your-preview-url.vercel.app" \
node scripts/product-smoke.mjs joy 2026-05-19 previewsmoke
```

   匿名 raw preview root 仍可能返回 `401 Vercel Authentication Required`；这不再阻断 `vercel-curl` 自动化 smoke。

   当前 `scripts/product-smoke.mjs` 的自动化覆盖范围只到：
   - 注册
   - 登录 / session 建立
   - `POST /api/interview/session/start`
   - `invalid_entry_date` 拒绝路径

   它当前不自动覆盖更深的 `joy -> respond -> wrap_up -> draft generate -> draft save` 主链。
   这部分如果需要证据，必须由 controller 手工 deep link / API 链路补证，不能混写成 “product-smoke 已自动覆盖”。

   如果 preview 没有开启保护，仍可直接执行：

```bash
SMOKE_BASE_URL="https://your-preview-url.vercel.app" npm run smoke:public
```

8. smoke 通过后，再决定要不要开放给真实试用

## URL 合同补充说明

- 相关平台文档路径：`Vercel -> Environment Variables -> System Environment Variables`
- 当前这条 launch lane 认可两种 URL 合同实现：
  1. 显式维护 `APP_URL`
  2. 依赖 Vercel system env，在运行时拼出 `https://${VERCEL_URL}` / `https://${VERCEL_BRANCH_URL}` / `https://${VERCEL_PROJECT_PRODUCTION_URL}`
- 只要选择第 2 条路径，就不能只看 `vercel env ls`。`vercel env ls` 只能证明用户自定义变量现状，不能单独证明 system env 是否已向 deployment 暴露。
- 因此，任何把 Preview / Production 判定为“URL 合同已满足”的结论，都必须附带一条额外证据：项目设置中 `Automatically expose System Environment Variables` 已开启，且部署构建或运行时能读到 `VERCEL=1`
- 当前最小已到位证据只足以支撑 preview deployment URL 语义：`VERCEL=1` + `VERCEL_URL`
- 生产 URL 语义仍需 `APP_URL` 或 `VERCEL_PROJECT_PRODUCTION_URL` 的直接 readback；在拿到前，不应把 production URL contract 写成已满足

## 当前仓库的构建注意事项

- 这个仓库使用 Prisma；在 Vercel 上如果只依赖默认依赖缓存，`Prisma Client` 可能不会自动重新生成。
- 当前仓库已经通过 `postinstall: prisma generate` 解决这个问题；不要删掉这条脚本，否则 preview 构建可能在 `/_not-found` 的 page data 阶段报 `PrismaClientInitializationError`。
- 当前仓库还用 [vercel.json](../vercel.json) 把 framework 固定为 `nextjs`；不要随手删掉，否则项目后台如果还停在 `Other` preset，新的 preview 可能重新回到“部署 Ready 但域名 `404`”。
- 如果未来要在部署时顺带执行数据库迁移，再单独评估是否引入 `prisma migrate deploy`，不要和“先把 preview 构建打通”混成同一个步骤。

## 最小 smoke 范围

当前脚本 [scripts/http-smoke.mjs](../scripts/http-smoke.mjs) 会检查：

- `/`
- `/login`
- `/register`
- `/legal/terms`
- `/legal/privacy`
- `/api/auth/session`

通过标准：

- 页面型路由返回 `200`
- `/api/auth/session` 返回 `200`
- `/api/auth/session` 的 JSON 里存在 `authenticated: boolean`
- 如果设置了 `SMOKE_BYPASS_SECRET` 或 `VERCEL_AUTOMATION_BYPASS_SECRET`，脚本会先走一次 Vercel bypass cookie 流，再检查上述路由；当前受保护 preview 的仓库基线以这条路径为准

## 2026-05-19 审计快照

审计命令：

```bash
# run from the linked xingfuxitong project root
vercel env ls --scope zouzhijies-projects
```

执行前提：
- 当前 shell 必须位于已 link 到 `zouzhijies-projects/xingfuxitong` 的仓库根目录
- 如果不在这个项目根目录执行，就必须先显式切到该目录，或用其他方式把命令固定到 `xingfuxitong`，否则这条审计结果不具备可复现性

审计对象：
- Vercel team：`zouzhijies-projects`
- project：`xingfuxitong`

当前真实结果：
- `Development / Preview / Production` 三套环境都只看到了 `DATABASE_URL` 与 `DIRECT_URL`
- 没有看到 `AI_PROVIDER`
- 没有看到 `VOLCENGINE_ARK_API_KEY`
- 没有看到 `VOLCENGINE_ARK_ENDPOINT_ID`
- 没有看到 `VOLCENGINE_ARK_BASE_URL`
- 没有看到用户自定义 `APP_URL`
- 也没有看到可选的 `VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID`

结论：
- 当前平台环境状态低于本文件定义的 Preview / Production 合同
- 这里能被直接确认的阻断项仍然是 AI 变量缺失；仅凭这次 `vercel env ls` 结果，不能把“没有看到 APP_URL”单独等同于 URL 合同必然失败，因为系统环境变量不会通过这条命令显式列出
- 当前仍然不能把 Preview / Production 视为“可验证真实 AI 主链”的环境：一方面 AI 变量明确缺失；另一方面如果要依赖 Vercel system env，还缺少 `Automatically expose System Environment Variables` 已开启的直接证据
- 产品主链 smoke 仍可以先覆盖公开页和无 AI 前置的 API，但涉及访谈、日志生成、画像 AI 直出和完整部署 URL 语义时，当前平台配置仍不满足上线 readiness

## 2026-05-19 跟进结果

后续动作：
- 已把 `AI_PROVIDER`、`VOLCENGINE_ARK_API_KEY`、`VOLCENGINE_ARK_ENDPOINT_ID`、`VOLCENGINE_ARK_BASE_URL` 写入 `Development / Preview / Production`
- 已触发一版新的 preview redeploy：
  - `https://xingfuxitong-8w6xmyh95-zouzhijies-projects.vercel.app`
  - `vercel inspect` 返回 `Ready`

新增证据：
- 复查 `vercel env ls --scope zouzhijies-projects` 后，四个 AI 必填变量已经出现在 `Development / Preview / Production`
- `vercel env pull --environment=preview` 与 `vercel env pull --environment=production` 的拉取结果里都出现了：
  - `VERCEL=1`
  - `VERCEL_TARGET_ENV`
  - `VERCEL_URL`
- 这说明当前项目至少已经暴露出一条可直接用于 deployment URL 语义的 system env 路径；到这一步，`APP_URL` 不再是当前 launch lane 的直接阻断项

仍未直接证实的部分：
- 本轮拉取结果里没有直接看到 `VERCEL_BRANCH_URL` 或 `VERCEL_PROJECT_PRODUCTION_URL`
- 因此，当前能被直接确认的 system env URL 证据只有 `VERCEL_URL`
- 这足以支撑 preview 的最小 deployment URL 语义，但不足以单独关闭 production URL contract

本机验证边界与重试结果：
- 先前 shell 侧的 `fetch failed` / `UND_ERR_CONNECT_TIMEOUT` 不能直接作为 preview 不可用证据：同机系统代理当时已经启用并指向 `127.0.0.1:7897`，且 `verge-mih` 正在监听，但执行命令的 shell 没有显式带上 `HTTP_PROXY` / `HTTPS_PROXY`
- 在显式代理条件下，`curl` 访问 `https://google.com` 与 `https://*.vercel.app` 已可成功返回，因此当前可用代理路径上的基础网络 / DNS 不再构成 blocker
- 匿名直打 preview root 的 raw 响应是 `Vercel Authentication Required (401)`，说明 public/anonymous 路径当前受 Deployment Protection 或鉴权策略约束
- 在显式代理加 `vercel curl` 的控制侧重试里：
  - `GET /api/auth/session` 返回 `200`，body 为 `{\"authenticated\":false,\"user\":null}`
  - `GET /login`、`GET /register`、`GET /legal/terms` 均返回 `200`
  - `GET /interview` 在未登录态下返回 `307` 并跳转到 `/login?next=%2Finterview`
  - `GET /` 返回 `401 Vercel Authentication Required` 以外的真实首页 HTML，而不是 Vercel 认证拦截页
- 在同一条显式代理加 `vercel curl` 路径上，controller 手工 deep-chain 已被正向证明可用：
  - 测试账号 `smoke_1779197755` 执行注册返回 `200`，并建立 `dl_session` cookie
  - 带 cookie 请求 `GET /api/auth/session` 返回 `200`，且 `authenticated=true`
  - 带 cookie 请求 `GET /login?next=/calendar` 返回 `307` 到 `/calendar`
  - `POST /api/interview/session/start` 以 `dimension=joy`、`entryDate=2026-05-19` 返回 `200`，`status=collect_event`，并给出开场问题
  - 第一次 `respond` 后 `turnCount=1`，阶段推进到 `probe_pattern`
  - 第二次 `respond` 后 `missingSlots=[]`
  - 用户发送“先这样，直接整理成日志。”后，session 进入 `wrap_up`，且 `draftGenerationUnlocked=true`，`pendingDecision.kind=event_complete`，`completionMode=user_override_partial`
  - `draft generate` 返回标题为“状态轻起来”的 `draftEntry`，状态为 `draft`
  - `draft save` 返回同一条 `draftEntry`，状态为 `saved`
  - session 最终状态为 `completed`
- 这组重试证据表明：当前已不再是“这台机器到 `vercel.app` 没有可用网络路径”，也不是“应用已经无法返回页面 / API 响应”；匿名 raw preview root 的 `401` 与 smoke gate 更一致地指向 Deployment Protection / auth strategy

当前结论：
- 已被直接证实的 AI 环境变量阻断已解除
- preview URL 合同在当前仓库接受的最小证据面上可视为已满足：system env 路径至少已通过 `VERCEL=1` + `VERCEL_URL` 得到证据支持
- production URL 合同尚未闭环：当前既没有直接读到 `APP_URL`，也没有直接读到 `VERCEL_PROJECT_PRODUCTION_URL`，所以只能标记为 `partially unverified / not closed`
- 当前剩余 blocker 已不再是“平台缺少 AI 变量”，也不再是“可用代理路径上的网络 / DNS 不通”
- 受保护 preview 的自动化 smoke auth path 已固定为 `vercel-curl`：匿名 raw preview root 仍是 `401`，但最小自动化 smoke 已不再被 Deployment Protection 卡住
- 当前自动化脚本证据与 controller 手工补证必须分开读：
  - `product-smoke.mjs` 自动化：只覆盖最小 auth/session/start/invalid_entry_date
  - controller 手工 deep-chain：补到 `joy -> draft generate -> draft save`

## 当前刻意不开放的能力

- `/api/transcribe` 继续视为关闭态，不纳入 preview smoke
- 没有真实转写模型前，不开放语音入口

## 暂不做的事

- 不先上 VPS
- 不先做多环境矩阵
- 不先做复杂灰度发布
