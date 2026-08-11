# GI-088 v8r2 静态验证

## 为什么可以打开真人验收

最终不可变 commit 已在 clean worktree 完成全量测试、类型、代码规范、两套 Prisma、Production／Preview build、行为清单和差异检查。所有阻断门为绿色，现阶段可以进入全新 `0/12` Thinking high 真人验收。

## 不可变版本

- Commit：`e01c9ed5fa0334d8d717dbed2643791f1045e04d`
- Effective candidate：`0d5f91c0142df15035cd665a4a782f5207c4df48ef242e072452653c77b2efd6`
- Dataset：`191f648089ef6749024425ead17903995b307f1936cc6fc2ccef1aaaac7625cf`
- Execution：`55c0c9b0ef31f46bf638c3a90fd6323c1ef7ad83a14d367d4e2e2fe3cc34b34e`

## 最终门结果

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| 全量 Vitest | `npm test` | 309 个文件通过、1 个文件跳过；2930 个测试通过、9 个测试跳过；0 failed |
| TypeScript | `npm run typecheck` | pass |
| 全量 ESLint | `npm run lint` | 0 errors；46 条既有 warnings |
| GI-088 定向 ESLint | `npx eslint <GI-088 changed files> --max-warnings=0` | 0 errors；0 warnings |
| 主 Prisma | `npx prisma validate` | valid |
| 私有评测 Prisma | `npm run prisma:gi088:validate` | valid |
| Production build | `npm run build` | pass；63 routes |
| Preview build | `VERCEL_ENV=preview npm run build` | pass；63 routes |
| Behavior manifest | `npx tsx scripts/check-gi088-behavior-manifest.ts --require-tracked` | pass；65 files |
| 差异格式 | `git diff --check` | pass |

## Preview 运行时修复

- 最终修复提交：`e01c9ed5fa0334d8d717dbed2643791f1045e04d`。
- 构建合同：Vercel 在 `next build` 前重新生成主应用与 GI-088 评测两套 Prisma Client。
- 云端构建：Vercel Linux 远程构建通过，完成 `63` 个页面／接口路由和全部 serverless functions。
- 合同回归：`tests/unit/vercel-prisma-build-contract.test.ts` 为 `1/1` 通过，目标 ESLint 为 `0 warning`，全仓 typecheck 通过。
- 运行时验收：虚构账号登录由受影响部署的 `503 AUTH_STORAGE_NOT_READY` 恢复为当前部署的 `401 INVALID_CREDENTIALS`；当前 deployment error logs 为 `0`。
- 事务分区回归：真实 PostgreSQL 特意保持默认分区与评测分区不同，3 项事务用例全部通过；旧 run 保持零调用行政收口，新指纹创建全新 `0/12` run。

## 行为与依赖锁定

- Behavior manifest SHA-256：`68321bf7329020761cd804bbdaffdb3f7fcc76c8cf5141510474112f9962cf44`
- Behavior manifest JSON file SHA-256：`1bc52fea1e572de64954023fd85ec37b97b66c89afbafa4deb78e3c96b479c97`
- Candidate layer：`a83f235db2711c2adca02af8fac54d83d2d6559c04ac5b4d57f2b52ed5edb179`
- Dataset layer：`775442a568152748455bb51de2d232d41d6964be7cb17ace8f1d9df5b98044ac`
- Runner layer：`f14f6fd04d33521e7fddcca0e97b4c2a71d425693140558d2a7771a41f51bea5`
- Experience layer：`17c42be27cf31f38606bb076594dbd3578a8f7c699daf53c375e762053686636`
- `package-lock.json`：`8585f543c7208d28460d9b99ff547f9f5cd3f59a782cb756ebe5c61fbdc6c4c7`
- `pnpm-lock.yaml`：`24c3849ec4cd11ede0642f8ace9504d494840ca7b6e519e8954e3953fa423af6`
- `pnpm-workspace.yaml`：`4b16caf9c94750df6aa0719e21bc8859b4f5fd81b5d68944318f9c9e05bcf7aa`

## 修复闭环

预发布零模型回放曾发现 high-only 空批次同时计算两个分支，造成复核覆盖出现负数。最终版本只投影活动分支，并让空轨迹保持零复核计数。修复后的结果为：

- `reviewedTrajectoryCount=0`
- `totalTrajectoryCount=12`
- `unreviewedTrajectoryCount=0`
- 所有事件、失败、调用计数为 `0`
- 无有效分母的比率为 `null`，页面显示 `N/A`

## 安全边界

静态门和零模型验证的模型探针、真人内容提交、Production 变更均为 `0`。真实数据库验证只使用独立 Preview 测试 schema，正式证据排除连接身份。
