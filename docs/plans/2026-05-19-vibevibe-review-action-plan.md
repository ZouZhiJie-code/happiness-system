# Vibevibe 评审收口执行计划

> 目的：把 `2026-05-18` 生成的 5 份 `vibevibe` 评审 HTML，收口成一份可以持续执行、回归和交接的本地 Markdown 计划。

关联输入：
- [上线前推进总计划](./2026-05-17-launch-plan.md)
- [上线前手动验收矩阵](./2026-05-17-launch-acceptance-matrix.md)
- [上线前问题池](./2026-05-17-launch-issue-tracker.md)
- [vibevibe 评审总览 HTML](./2026-05-18-vibevibe-dailylight-review-overview.html)
- [后端 API / 认证安全 HTML](./2026-05-18-vibevibe-dailylight-review-api-auth.html)
- [测试自动化 / Git 协作 HTML](./2026-05-18-vibevibe-dailylight-review-testing-git.html)
- [公网访问 / Serverless / CI-CD HTML](./2026-05-18-vibevibe-dailylight-review-access-serverless.html)
- [域名 DNS / VPS 运维 HTML](./2026-05-18-vibevibe-dailylight-review-domain-vps.html)

## 文件定位

这份文件解决两个问题：

1. `vibevibe` HTML 更像验收展示页，不适合继续承担任务拆解、状态推进和回归记录。
2. 仓库在 `2026-05-19` 的真实状态，和 `2026-05-18` HTML 生成时看到的状态之间已经出现局部漂移；后续执行必须以当前仓库真相为准。

从现在开始：
- 外部教程评审，以 `2026-05-18-vibevibe-dailylight-review-*.html` 为结论来源。
- 上线推进和代码落地，以本文件 + `2026-05-17-launch-*` 三份 Markdown 为行动依据。
- 本地未提交草稿不算完成，只有进入仓库基线的文件才算“已落地”。

## 当前仓库真相（2026-05-19）

### 已经成立

- 产品主链和后端 API 仍然是现阶段最成熟的部分。
- 账号体系、私有页守卫、`httpOnly` cookie、删号级联这条 auth 主线依旧成立。
- `.env.example`、`README.md`、`docs/operator-runbook.md` 已经表达了数据库、AI provider、`APP_URL` 等基础环境变量认知。
- `/api/transcribe` 仍是 stub，应继续保持关闭态，不纳入当前上线主链。

### 仍然没有成为仓库基线

- `.github/workflows/ci.yml` 仍处于未跟踪工作区；从 Git 语义看，CI 还没有正式进入仓库历史。
- 仓库里还没有已提交的托管平台配置、preview / production 环境分层、正式 smoke check、域名 / HTTPS / DNS 配置记录。
- 仓库里也没有任何理由支持“现在应该先走 VPS 运维主线”。

### 对“昨天已经执行过”的校正

昨天确实已经形成了 launch readiness 的思路、批次划分和局部实现草稿。截止 `2026-05-19` 当前工作区里，下面这些能力已经被补到“本地基线可验证”：

- 默认测试入口可信
- build / lint 自动门禁已在本地收口

但下面这些能力还不能算“仓库基线完成”：

- 仓库内正式 CI 仍未提交
- 托管平台主线仍只完成到本地资产
- preview / production 环境合同和 smoke 入口仍未进入提交历史

换句话说，昨天完成的是“评审、拆解、局部试做”，当前还没有完全收口成稳定仓库基线。

## 结论收口

### A. 保持不动的部分

- 后端 API 不重做架构。
- 认证模型不推倒重来。
- `memoryEnabled` 继续视为补充能力，不插队到主链之前。
- `/api/transcribe` 继续关闭，不开放给真实用户。

### B. 现在必须做的部分

1. 把默认测试入口修成可信的仓库基线。
2. 把最小 CI 变成已跟踪文件，不再停留在工作区草稿。
3. 把 `build / lint` 从“本机经验”收口成可复现门禁。
4. 选定一条托管平台主线，并把环境变量、preview / production、smoke check 固化到仓库。

### C. 可以后置的部分

- 密码找回、邮箱验证、多设备会话管理
- 完整监控大盘与成本面板
- 域名 / HTTPS / DNS 细化配置

### D. 现阶段不建议做的部分

- 直接开 VPS 运维主线
- 为了“更安全”先重写认证系统
- 在默认测试入口还不可信之前，继续追求测试总量扩面

## 执行批次

### 批次 0：先把“已做但没收口”的工作区草稿调查清楚

目标：
- 分清哪些是昨天留下的半成品，哪些已经进入仓库基线。

当前重点对象：
- `tests/unit/settings-page.test.tsx`
- `.github/workflows/ci.yml`
- `docs/plans/2026-05-18-launch-plan-summary.html`
- `docs/plans/2026-05-18-vibevibe-dailylight-review-*.html`

通过标准：
- 每个脏文件都被归类为 `保留并提交 / 迁移到新分支继续 / 明确放弃` 三者之一。
- 不再出现“HTML 里写完成了，但仓库基线里没有”的叙述混乱。

本轮分类结果（2026-05-19）：

| 文件 | 当前性质 | 证据 | 分类 | 处理说明 |
|---|---|---|---|---|
| `tests/unit/settings-page.test.tsx` | 基线修复补丁 | 补丁内容是把 `SettingsForm` stub 掉；但 `npx vitest run tests/unit/settings-page.test.tsx` 实测仍会扫进 `.worktrees/launch-readiness-*` 里的同名测试并失败 | `保留并提交` | 这条补丁本身有效，但不能单独提交；必须和 `vitest.config.ts` 的 `include / exclude` 一起进入批次 1 |
| `.github/workflows/ci.yml` | 最小 CI 草稿 | 文件已存在于工作区，但 `git ls-files` 仍为空，说明尚未进入仓库基线；内容当前覆盖 `npm ci + typecheck + test` | `保留并提交` | 作为批次 1 的正式 CI 基线提交，批次 2 再扩到 `build + lint` |
| `docs/plans/2026-05-18-database-persistence-hardening.md` | 独立实现计划 | 文件是完整的数据库补强执行计划，包含索引、pgvector、会话生命周期、数据库约束与 runbook 任务 | `迁移到新分支继续` | 不和当前 launch readiness 批次混提；后续如继续该主题，单独开分支按计划执行 |
| `docs/plans/2026-05-18-launch-plan-summary.html` | 展示型摘要产物 | 这是对 launch plan 的可视化摘要，不是主执行文档 | `保留并提交` | 只作为验收 / 浏览产物归档，不承担后续任务分解 |
| `docs/plans/2026-05-18-vibevibe-dailylight-review-*.html` | 外部评审证据 | 这是用户明确要求生成并打开的验收页；当前新建的 `2026-05-19` action plan 已把它们降级为证据源 | `保留并提交` | 保留为外部能力评审归档，不再承担执行面 |
| `docs/plans/2026-05-19-vibevibe-review-action-plan.md` | 当前主执行文档 | 已明确把 HTML 与 Markdown 的职责分开，并按 2026-05-19 仓库真相重写执行批次 | `保留并提交` | 这份文件从现在开始承担 vibevibe 评审的主收口面 |

批次 0 结论：
- 当前没有必须“明确放弃”的文件。
- 真正需要立刻收口到仓库基线的，是 `tests/unit/settings-page.test.tsx`、`vitest.config.ts` 和 `.github/workflows/ci.yml` 这一组。
- `database-persistence-hardening.md` 属于独立主题，继续推进时应从当前 launch readiness 主线拆开。

### 批次 1：锁住验证入口

目标：
- 让 `npm test` 和最小 CI 的结论可信。

必须完成：
- 给 `vitest.config.ts` 加上显式 `include / exclude`
- 排除 `.worktrees/**` 与其他历史噪声目录
- 处理 `settings-page` 这类会污染全量测试入口的单测问题
- 把 `.github/workflows/ci.yml` 提交为正式仓库文件
- 先跑通 `npm run typecheck` 与 `npm test`
- 同步 `README.md` 和 `docs/operator-runbook.md` 的测试口径

停止条件：
- `git ls-files .github/workflows/ci.yml` 能返回正式跟踪文件
- `npm test` 的含义与文档描述一致

当前证据（2026-05-19）：
- `npx vitest run tests/unit/settings-page.test.tsx` 通过；在给 `vitest.config.ts` 增加 `include / exclude` 之前，这条命令会额外扫进 `.worktrees/launch-readiness-*` 的同名测试并失败，现已收敛为只跑主仓 1 个文件。
- `npx vitest run tests/unit/analysis-shell.test.tsx` 通过；已把测试里的“今天”锚点固定到 `2026-05-03`，避免这类跟真实日期漂移耦合。
- `npm test` 通过：`71` 个测试文件、`595` 个测试全部通过。
- `npm run typecheck` 通过。
- `README.md` 与 `docs/operator-runbook.md` 已改为“以最近一次全量绿灯记录为准”的测试口径，不再继续写死过期数字。

剩余差距：
- `.github/workflows/ci.yml` 当前仍处于未提交工作区；从 Git 跟踪语义看，它还没有正式进入仓库基线。

### 批次 2：锁住 build / lint 门禁

目标：
- 让 `build / lint` 也成为稳定自动门禁，而不是人工口头确认。

必须完成：
- 在 `next.config.ts` 中显式设置 `outputFileTracingRoot`
- 把 `package.json` 的 `lint` 从 `next lint` 迁到 ESLint CLI
- 收口 ESLint 配置真相源
- 在 CI 里补上 `build` 与 `lint`

停止条件：
- 本地可稳定执行 `npm run typecheck`
- 本地可稳定执行 `npm test`
- 本地可稳定执行 `npm run build`
- 本地可稳定执行 `npm run lint`
- CI 至少覆盖 `typecheck + test + build + lint`

当前证据（2026-05-19）：
- `next.config.ts` 已显式设置 `outputFileTracingRoot`，`npm run build` 继续通过。
- `package.json` 的 `lint` 已从 `next lint` 迁到 `eslint .`。
- `eslint.config.mjs` 已收口为单一 flat config 真相源，并显式忽略 `.next/**`、`.worktrees/**`、`.claude/worktrees/**` 与 `next-env.d.ts`；旧 `.eslintrc.json` 已删除。
- `npm run lint` 可稳定执行，当前结果为 `31` 条 warning、`0` 条 error。
- `.github/workflows/ci.yml` 的工作区内容已扩到 `npm ci -> typecheck -> test -> build -> lint`。
- 最终回归顺序已跑通：`npm run typecheck`、`npm test`、`npm run build`、`npm run lint` 全部通过。

剩余差距：
- 这批改动仍在工作区，尚未形成提交；因此从 Git 历史语义看，CI 和 lint/build 门禁还没真正进入仓库基线。

### 批次 3：建立一条正式托管平台主线

目标：
- 把“本地能跑”推进到“存在一个可访问、可复现、可回归的预发布环境”。

必须完成：
- 明确唯一首选托管平台
- 固化 preview / production 的环境变量合同
- 把部署前置条件写回仓库文档
- 增加最小 smoke check
- 明确 `/api/transcribe` 继续关闭，不进入对外能力面

当前约束：
- 在没有托管平台主线前，不讨论 VPS。
- 在没有 preview 环境前，不把域名 / DNS 当成第一优先级。

停止条件：
- 新人只靠仓库文档就能完成一次 preview 部署
- 每次提交至少有一条统一的预发布落点可验证

当前证据（2026-05-19）：
- 默认托管平台路线已收口为 `Vercel`。
- 已新增 `.env.preview.example` 与 `.env.production.example` 作为 preview / production 环境合同样板。
- 已新增 `docs/vercel-preview-production-lane.md`，把首条部署主线和 `/api/transcribe` 的关闭策略写回仓库。
- 已新增 `scripts/http-smoke.mjs`，并通过 `node --check scripts/http-smoke.mjs` 验证脚本语法。
- `README.md` 与 `docs/operator-runbook.md` 已补充 preview / production 与 smoke 入口说明。
- `npm run lint` 在加入 smoke 脚本和部署文档后仍可通过，保持 `31` 条 warning、`0` 条 error。
- 已在 `Vercel / zouzhijies-projects` 下成功 link 到现有项目 `xingfuxitong`；`.vercel/project.json` 已包含 `projectId` 和 `orgId`。
- `.vercelignore` 已补充 `.worktrees`、`.claude`、`.omx`，上传体积已从早期的超大上下文收敛到可稳定上传。
- 已新增 `vercel.json`，把 framework 固定为 `nextjs`；这条配置已用于覆盖 Vercel 项目后台残留的 `Other` preset，避免 preview 域名在部署 `Ready` 后仍返回 `404`。
- 首次真实 preview 部署曾因缺少 `lottie-react` 失败；该依赖现已补入 `package.json`，本地 `npm run build` 继续通过。
- 第二次真实 preview 部署曾在 `/_not-found` 的 page data 阶段触发 `PrismaClientInitializationError`；现已按 Prisma 官方建议补上 `postinstall: prisma generate`。
- 最新 preview 已成功 Ready：`https://xingfuxitong-ranjnvulr-zouzhijies-projects.vercel.app`。
- `vercel inspect` 已返回 `status: Ready`，部署时间为 `2026-05-19 11:44:49 CST`。
- 受保护 preview 的仓库内 smoke 已打通：在设置 `VERCEL_AUTOMATION_BYPASS_SECRET` 或 `SMOKE_BYPASS_SECRET` 后，`npm run smoke:public` 已实测通过 `/`、`/login`、`/register`、`/legal/terms`、`/legal/privacy`、`/api/auth/session`。

剩余差距：
- 当前 smoke 仍只覆盖公开页面和 `/api/auth/session`；登录、注册提交、访谈、日志生成和 AI 链路还没有形成统一自动验收。
- `vercel env ls --scope zouzhijies-projects` 最新结果仍只有 `DATABASE_URL` 与 `DIRECT_URL`，还没有看到 AI 相关环境变量进入 Preview / Production。
- 这批文件仍在工作区，尚未进入提交历史。

### 批次 4：正式上线前补平台安全项

目标：
- 在平台主线确定后，再补域名、安全和运维最小闭环。

必须完成：
- 绑定正式域名
- 打通 HTTPS
- 复核生产 cookie 策略
- 增加日志脱敏和基础错误监控

可以后置：
- 更重的审计、限流、设备管理
- VPS、自建反向代理、复杂备份矩阵

## 当前优先级判断

### P0

- 正式 CI 仍未进入仓库基线
- 平台侧 AI 环境变量与真实产品链路还未完成验收

### P1

- `build / lint` 门禁虽已在工作区完成，但还未进入提交历史
- 生产环境变量与 preview / production 合同虽已落到工作区文件，但还未进入提交历史
- 登录后链路、访谈链路和 AI 链路仍需继续补验收，浏览器 / 人工回归还不能省掉

### P2

- 域名 / DNS / HTTPS 细节
- 更重的安全能力和 VPS 运维

## 执行依据

后续如果继续推进 launch readiness，统一按下面这组依据执行：

1. [2026-05-17-launch-plan.md](./2026-05-17-launch-plan.md)
2. [2026-05-17-launch-acceptance-matrix.md](./2026-05-17-launch-acceptance-matrix.md)
3. [2026-05-17-launch-issue-tracker.md](./2026-05-17-launch-issue-tracker.md)
4. 本文件

`2026-05-18-vibevibe-dailylight-review-*.html` 不再承担主执行面，只作为外部能力评审证据保留。
