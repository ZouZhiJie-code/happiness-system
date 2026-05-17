# 账户体系首版 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Daily Light 增加首版账户体系，支持用户名+密码注册登录、登录态隔离、隐私协议勾选、未登录拦截、账号注销与用户数据级联删除，移除运行时对 `local-demo-user` 的依赖。

**Architecture:** 在现有 Next.js App Router + Prisma 架构上新增一层轻量自建认证。服务端通过 `httpOnly` session cookie 识别当前用户；页面与 API 在进入业务逻辑前统一解析当前用户；现有 repository/service 改为显式按当前 `userId` 查询与写入。

**Tech Stack:** Next.js 15 App Router、React 19、TypeScript、Prisma、PostgreSQL、Zod、Vitest。

---

## Summary

本计划实现一套不依赖邮箱/短信的首版账户体系，范围限定为：
- 用户名 + 密码注册
- 用户名 + 密码登录
- `httpOnly` cookie 登录态
- 核心页面和 API 登录保护
- 所有业务数据按当前 `userId` 隔离
- 注册时强制勾选《用户协议》《隐私政策》
- 账号注销后立即级联删除用户数据
- 首版不做邮箱验证码、不做短信验证码、不做自助找回密码
- `local-demo-user` 历史数据视为开发数据，不迁移到正式账号

实现时保持 YAGNI：不引入 Auth.js，不引入外部认证平台，不额外设计管理员后台，不新增复杂设备管理/登录历史/多因子认证。

---

## Public APIs / Interfaces / Types

### New pages / routes
- 新增 `GET /login`
- 新增 `GET /register`
- 新增 `GET /settings/account` 或将账户设置并入现有 settings 页面
- 新增 `POST /api/auth/register`
- 新增 `POST /api/auth/login`
- 新增 `POST /api/auth/logout`
- 新增 `GET /api/auth/session`
- 新增 `POST /api/auth/delete-account`

### New data models
在 `prisma/schema.prisma` 中新增或扩展：
- 扩展 `User`
  - `username String @unique`
  - `passwordHash String`
  - `agreedToTermsAt DateTime`
  - `agreedToPrivacyAt DateTime`
- 新增 `AuthSession`
  - `id String @id @default(cuid())`
  - `userId String`
  - `tokenHash String @unique`
  - `expiresAt DateTime`
  - `createdAt DateTime @default(now())`
  - `lastUsedAt DateTime?`
  - `userAgent String?`
  - `ipAddress String?`
  - `user User @relation(... onDelete: Cascade)`
  - 索引：`@@index([userId])`, `@@index([expiresAt])`

### New shared types / schemas
在 `src/features/auth` 下新增：
- `auth.schema.ts`
  - `registerRequestSchema`
  - `loginRequestSchema`
  - `authSessionResponseSchema`
  - `deleteAccountRequestSchema`
- `auth.types.ts`
  - `AuthenticatedUser`
  - `AuthSessionRecord`
- `auth.constants.ts`
  - cookie 名称
  - session TTL
  - 用户名/密码规则
  - 文案常量

### Cookie contract
- 名称：`dl_session`
- 属性：
  - `httpOnly: true`
  - `secure: process.env.NODE_ENV === "production"`
  - `sameSite: "lax"`
  - `path: "/"`
  - `maxAge` 与 `AuthSession.expiresAt` 对齐

---

## Implementation Changes

### Task 1: 建立认证领域模型与 schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_auth_session_and_user_credentials/migration.sql`
- Create: `src/features/auth/auth.schema.ts`
- Create: `src/features/auth/auth.types.ts`
- Test: `src/features/auth/__tests__/auth.schema.test.ts`

**Steps:**
1. 写 Zod 测试，覆盖：
   - 用户名合法：长度、字符集、去空格
   - 密码合法：最小长度
   - 注册必须勾选协议
2. 运行单测，确认失败。
3. 新增 `User` 字段和 `AuthSession` 模型。
4. 实现 `auth.schema.ts`，给出：
   - 用户名：`3-24` 字符，只允许字母、数字、下划线
   - 密码：最少 `8` 位，最大 `72` 位
   - 协议勾选：`acceptedTerms === true` 且 `acceptedPrivacy === true`
5. 运行单测，确认通过。
6. 提交一次 commit。

**Acceptance:**
- Prisma schema 可表达账户、密码哈希、协议时间与登录会话
- 注册/登录请求结构被 schema 固定

---

### Task 2: 实现密码哈希与 session token 基础设施

**Files:**
- Create: `src/server/services/auth/password.service.ts`
- Create: `src/server/services/auth/session-token.service.ts`
- Create: `src/server/services/auth/auth-cookie.ts`
- Test: `src/server/services/auth/__tests__/password.service.test.ts`
- Test: `src/server/services/auth/__tests__/session-token.service.test.ts`

**Steps:**
1. 先写失败测试：
   - 相同密码两次哈希结果不同
   - `verifyPassword` 能通过正确密码，拒绝错误密码
   - session token 生成后可产出 raw token 与 hash
2. 运行测试，确认失败。
3. 实现密码服务：
   - 使用 Node `crypto.scrypt` 或等价安全哈希
   - 存储格式包含 salt 与 hash
4. 实现 session token 服务：
   - 生成随机 token
   - 仅将 hash 存入数据库
5. 实现 cookie helper：
   - `setAuthSessionCookie`
   - `clearAuthSessionCookie`
6. 运行测试，确认通过。
7. 提交一次 commit。

**Defaults:**
- 不额外引入外部加密库
- hash 存储不保存明文 token
- session TTL 设为 `30` 天

---

### Task 3: 新增认证 repository 与当前用户解析服务

**Files:**
- Create: `src/server/repositories/auth.repository.ts`
- Create: `src/server/services/auth/auth.service.ts`
- Create: `src/server/services/auth/current-user.service.ts`
- Test: `src/server/services/auth/__tests__/auth.service.test.ts`

**Steps:**
1. 写失败测试，覆盖：
   - 注册成功创建 `User` 与 `AuthSession`
   - 重复用户名注册失败
   - 登录成功返回新 session
   - 密码错误登录失败
   - 无效 cookie 解析为空
2. 运行测试，确认失败。
3. 实现 repository：
   - `findUserByUsername`
   - `createUserWithSession`
   - `createAuthSession`
   - `findAuthSessionByTokenHash`
   - `deleteAuthSession`
   - `deleteAllAuthSessionsForUser`
4. 实现 service：
   - `registerUser`
   - `loginUser`
   - `logoutUser`
   - `getCurrentUser`
   - `requireCurrentUser`
5. `getCurrentUser` 从 `cookies()` 取 `dl_session`，hash 后查 `AuthSession`，校验过期，再取 `User`。
6. 运行测试，确认通过。
7. 提交一次 commit。

**Important behavior:**
- 用户不存在、密码错误、session 无效都返回统一认证失败语义，避免泄露用户名存在性过多细节
- 过期 session 在读取时顺手删除或标记失效

---

### Task 4: 暴露认证 API

**Files:**
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/session/route.ts`
- Create: `src/app/api/auth/delete-account/route.ts`
- Test: `src/app/api/auth/__tests__/register-route.test.ts`
- Test: `src/app/api/auth/__tests__/login-route.test.ts`

**Steps:**
1. 写 route 级失败测试：
   - 注册成功返回当前用户信息并写 cookie
   - 协议未勾选返回 `400`
   - 登录成功写 cookie
   - 登录失败返回 `401`
   - 注销清 cookie
   - 删除账号成功后清 cookie
2. 运行测试，确认失败。
3. 实现路由：
   - 统一解析 Zod schema
   - 调用 auth service
   - 写或清 `dl_session` cookie
4. `GET /api/auth/session` 返回最小当前用户信息：
   - `authenticated`
   - `user: { id, username } | null`
5. `POST /api/auth/delete-account` 需要求当前已登录，并二次提交当前密码确认删除。
6. 运行测试，确认通过。
7. 提交一次 commit。

**Response shape defaults:**
- 成功注册/登录：
  - `{ authenticated: true, user: { id, username } }`
- 未登录：
  - `{ authenticated: false, user: null }`

---

### Task 5: 构建登录、注册、账户设置 UI

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/register/page.tsx`
- Modify: 现有 settings 页面入口与布局
- Create: `src/components/auth/login-form.tsx`
- Create: `src/components/auth/register-form.tsx`
- Create: `src/components/auth/account-danger-zone.tsx`
- Test: `src/components/auth/__tests__/login-form.test.tsx`
- Test: `src/components/auth/__tests__/register-form.test.tsx`

**Steps:**
1. 写前端测试：
   - 注册表单缺协议勾选时禁用或报错
   - 登录提交成功后跳转 `/interview`
   - 错误状态展示清晰文案
   - 注销按钮调用 delete-account 流程前要求密码确认
2. 运行测试，确认失败。
3. 实现注册页：
   - 用户名
   - 密码
   - 确认密码
   - 两个协议勾选
   - 协议链接
4. 实现登录页：
   - 用户名
   - 密码
   - 无找回密码入口，只展示“请妥善保管密码”
5. 实现账户设置危险区：
   - 当前用户名展示
   - 退出登录
   - 删除账号
6. 运行测试，确认通过。
7. 提交一次 commit。

**UX defaults:**
- 未做找回密码，不出现伪入口
- 文案明确说明首版暂不支持找回密码
- 协议页可先用静态文档页承载

---

### Task 6: 为核心页面和 API 加登录保护

**Files:**
- Create: `src/middleware.ts` 或服务端页面守卫 helper
- Modify: `src/app/interview/page.tsx`
- Modify: `src/app/profile/page.tsx`
- Modify: calendar / analysis / settings 页面入口
- Test: `src/app/__tests__/auth-guard.test.ts`

**Steps:**
1. 写失败测试：
   - 未登录访问 `/interview` 重定向 `/login`
   - 已登录访问 `/login` 可重定向回 `/interview`
   - 未登录请求核心 API 返回 `401`
2. 运行测试，确认失败。
3. 实现页面保护：
   - 公开页：首页、登录、注册、协议文档
   - 私有页：`/interview`、`/calendar`、`/analysis`、`/profile`、`/settings`
4. 实现 API 保护：
   - 认证 API 除外
   - 其余业务 API 在 route handler 首行调用 `requireCurrentUser()`
5. 运行测试，确认通过。
6. 提交一次 commit。

**Default redirect behavior:**
- 未登录进入私有页：跳 `/login?next=<path>`
- 登录成功后优先回 `next`，否则去 `/interview`

---

### Task 7: 移除 `DEMO_USER_ID` 运行时依赖并改造业务 repository

**Files:**
- Modify: `src/server/repositories/joy-interview.repository.ts`
- Modify: `src/server/repositories/calendar.repository.ts`
- Modify: `src/server/repositories/daily-journal.repository.ts`
- Modify: `src/server/repositories/daily-happiness-score.repository.ts`
- Modify: `src/server/repositories/memory.repository.ts`
- Modify: `src/server/repositories/analysis.repository.ts`
- Modify: `src/server/services/memory/profile.service.ts`
- Modify: `src/server/services/memory/memory-extraction.service.ts`
- Modify: `src/server/services/memory/memory-retrieval.service.ts`
- Modify: `src/server/services/portrait/portrait-data.service.ts`
- Test: 各 repository/service 对应测试文件；如缺失则新增最小覆盖

**Steps:**
1. 先写失败测试：
   - 当前用户 A 看不到用户 B 的 session / 日志 / 画像 / 评分
   - 按 ID 拉 session 时，非 owner 用户拿不到数据
2. 运行测试，确认失败。
3. 删除 repository 内部的 `DEMO_USER_ID` fallback。
4. 所有读写函数显式接收 `userId`，或在 service 层提前解析当前用户后传入。
5. 对于 `findInterviewSessionById`、`reopen/pause/complete/respond/draft/save` 这类按 `sessionId` 操作，必须同时校验 `session.userId === currentUser.id`。
6. 运行测试，确认通过。
7. 提交一次 commit。

**Critical rule:**
- 禁止任何业务查询继续默默回退到 demo 用户
- 所有“按 ID 直取”的接口都必须验证 owner

---

### Task 8: 改造 interview / journal / profile / analysis 业务 service 以接入当前用户

**Files:**
- Modify: `src/server/services/interview/interview.service.ts`
- Modify: `src/server/services/interview/joy-interview.service.ts`
- Modify: `src/app/api/interview/session/*`
- Modify: `src/app/api/daily-journal/*`
- Modify: `src/app/api/journal-entry/[id]/route.ts`
- Modify: `src/app/api/profile/*`
- Modify: `src/app/api/calendar/*`
- Modify: `src/app/api/happiness-score/route.ts` 或对应评分接口
- Test: 对应 route/service 测试

**Steps:**
1. 写失败测试：
   - 已登录用户只能启动自己的 session
   - 传入别人的 `sessionId` 时返回 `404` 或 `403` 的统一语义
   - 日历与分析只返回当前用户数据
2. 运行测试，确认失败。
3. 在 route 层取当前用户并传入 service。
4. 在 service 层将 `userId` 继续传到底层 repository。
5. 对所有 `sessionId` / `entryId` / `dailyJournalId` 路径参数增加 owner 校验。
6. 运行测试，确认通过。
7. 提交一次 commit。

**Default error semantics:**
- 对不存在或无权访问的资源统一返回 `404` 更稳妥，减少信息泄露
- 未登录返回 `401`

---

### Task 9: 增加协议页面与注册勾选闭环

**Files:**
- Create: `src/app/legal/terms/page.tsx`
- Create: `src/app/legal/privacy/page.tsx`
- Modify: `src/components/auth/register-form.tsx`
- Test: `src/app/legal/__tests__/legal-pages.test.tsx`

**Steps:**
1. 写测试：
   - 协议页面可访问
   - 注册表单含协议链接
   - 未勾选不能提交
2. 运行测试，确认失败。
3. 实现两份静态法律页面：
   - 用户协议
   - 隐私政策
4. 注册成功时落库：
   - `agreedToTermsAt`
   - `agreedToPrivacyAt`
5. 运行测试，确认通过。
6. 提交一次 commit。

**Content default:**
- 先提供基础版本，覆盖账号、日志内容、隐私保护、注销删除、AI 服务处理说明
- 不等待律师级修订再阻塞开发

---

### Task 10: 实现退出登录与删除账号闭环

**Files:**
- Modify: `src/server/services/auth/auth.service.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/api/auth/delete-account/route.ts`
- Modify: settings/account UI
- Test: `src/server/services/auth/__tests__/delete-account.test.ts`

**Steps:**
1. 写失败测试：
   - 退出登录只删除当前 session
   - 删除账号会清掉 user 及所有关联数据
   - 删除账号后旧 cookie 失效
2. 运行测试，确认失败。
3. 实现：
   - `logoutUser` 删除当前 `AuthSession`
   - `deleteAccount` 先校验当前密码，再删除 `User`
4. 借助外键级联完成会话、日志、评分、记忆、画像等关联数据删除。
5. 运行测试，确认通过。
6. 提交一次 commit。

**Default deletion flow:**
- UI 二次确认
- 输入当前密码确认
- 成功后跳回首页或登录页

---

### Task 11: 清理前端本地恢复与跨用户缓存风险

**Files:**
- Modify: `src/stores/interview-store.ts`
- Modify: `src/components/interview/interview-shell.tsx`
- Modify: localStorage/sessionStorage 相关 helper
- Test: `src/components/interview/__tests__/auth-session-cache.test.tsx`

**Steps:**
1. 写失败测试：
   - 用户 A 退出后，本地 session 恢复缓存不污染用户 B
   - 登录用户变化时，旧的按维度缓存被清除
2. 运行测试，确认失败。
3. 给本地缓存加用户维度隔离：
   - key 带 `userId`
   - 或在登录切换时统一清空相关缓存
4. 退出登录、删除账号时清理本地恢复状态。
5. 运行测试，确认通过。
6. 提交一次 commit。

**Important behavior:**
- 当前项目已有按维度恢复逻辑，必须防止同浏览器多账号串线
- 这是前端层的数据隔离补丁，不能漏

---

### Task 12: 文档、环境变量、回归验证

**Files:**
- Modify: `README.md`
- Modify: `docs/integration-guide.md`
- Modify: `docs/operator-runbook.md`
- Create: `docs/plans/2026-05-16-account-system-v1.md`

**Steps:**
1. 文档补充：
   - 新增认证架构说明
   - 新增 API 列表
   - 新增本地开发初始化说明
   - 新增“首版不支持找回密码”的产品约束
2. 环境变量说明：
   - `AUTH_SESSION_SECRET`
   - 如不需要 secret 也要说明 token/hash 机制
3. 回归验证：
   - 注册 -> 登录 -> 开启访谈 -> 生成日志 -> 查看 calendar -> 查看 analysis -> 退出 -> 再登录
   - A/B 两个用户互相隔离
   - 删除账号后无法再访问旧数据
4. 全量跑：
   - `npm test`
   - `npm run typecheck`
   - `npm run build`
5. 提交一次 commit。

---

## Test Plan

必须覆盖以下测试场景：

### Auth domain
- 用户名校验通过/失败
- 密码长度校验通过/失败
- 协议未勾选时注册失败
- 密码哈希与校验正确
- session token 仅 hash 落库

### Auth routes
- 注册成功
- 重复用户名注册失败
- 登录成功
- 错误密码登录失败
- 退出登录成功
- 删除账号成功并清 cookie

### Access control
- 未登录访问私有页面被重定向
- 未登录访问私有 API 返回 `401`
- 已登录访问登录页按 `next` 跳转
- 非 owner 访问别人的 `sessionId` / `entryId` / `dailyJournalId` 返回 `404`

### Data isolation
- 用户 A 的访谈、日志、评分、画像、记忆不会出现在用户 B 页面
- 本地缓存不会跨账号恢复
- 删除用户后关联数据清空

### Regression
- 当前 interview 流程不因用户体系损坏
- calendar / analysis / profile 仍能读取当前用户数据
- daily journal 与 single-dimension journal 的保存/编辑/恢复仍正常

---

## Assumptions / Defaults

- 首版登录标识采用 `username`，不是邮箱，也不是手机号。
- 首版不做自助找回密码；UI 要明确提示用户妥善保管密码。
- 首版不接入 Auth.js、Resend、短信平台等外部认证依赖。
- `local-demo-user` 历史数据视为开发数据，不迁移。
- 对“资源不存在”和“资源存在但无权访问”统一返回 `404`。
- 使用数据库 `User` 删除级联完成账号删除。
- 登录 session 默认有效期 `30` 天。
- 私有页最小集合包括：`/interview`、`/calendar`、`/analysis`、`/profile`、`/settings`。
- 法律文档先用基础静态版本上线，后续再做法务打磨。
- 本计划目标文件为 `docs/plans/2026-05-16-account-system-v1.md`；后续 session 统一基于这份文件推进。
