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

至少要填：

- `DATABASE_URL`
- `AI_PROVIDER`
- `VOLCENGINE_ARK_API_KEY`
- `VOLCENGINE_ARK_ENDPOINT_ID`
- `VOLCENGINE_ARK_BASE_URL`
- `APP_URL`

可选：

- `VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID`

规则：

- `APP_URL` 必须指向当前 preview 域名
- preview 数据库必须和本地库、生产库隔离

### Production

使用 [`.env.production.example`](../.env.production.example) 作为正式环境清单来源。

规则：

- `APP_URL` 必须改成正式域名
- 生产库和 preview 库必须隔离
- 如果记忆系统暂时不开，`VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID` 可以先留空

## 最小发布步骤

1. 在 Vercel 创建项目并连接当前仓库
2. 把 preview 环境变量按 [`.env.preview.example`](../.env.preview.example) 填入平台
3. 确认 [package.json](../package.json) 保留 `postinstall: prisma generate`
4. 确认根目录 [vercel.json](../vercel.json) 保留 `framework: "nextjs"`，避免项目后台残留 `Other` preset 时 preview 域名落到 `404`
5. 确认 Vercel 的默认 build 命令保持 `next build`
6. 首次部署前确认 `.vercelignore` 已排除 `.worktrees`、`.claude`、`.omx`
7. 等首个 preview 部署完成后：
   如果当前 preview 开启了 Deployment Protection，先在项目设置里创建或复用 automation bypass secret，再执行：

```bash
VERCEL_AUTOMATION_BYPASS_SECRET="your-bypass-secret" \
SMOKE_BASE_URL="https://your-preview-url.vercel.app" \
npm run smoke:public
```

   如果 preview 没有开启保护，仍可直接执行：

```bash
SMOKE_BASE_URL="https://your-preview-url.vercel.app" npm run smoke:public
```

8. smoke 通过后，再决定要不要开放给真实试用

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

## 当前刻意不开放的能力

- `/api/transcribe` 继续视为关闭态，不纳入 preview smoke
- 没有真实转写模型前，不开放语音入口

## 暂不做的事

- 不先上 VPS
- 不先做多环境矩阵
- 不先做复杂灰度发布
