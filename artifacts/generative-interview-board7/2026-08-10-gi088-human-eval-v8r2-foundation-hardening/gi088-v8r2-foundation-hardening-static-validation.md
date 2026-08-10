# GI-088 v8r2 静态验证

## 为什么可以打开真人验收

最终不可变 commit 已在 clean worktree 完成全量测试、类型、代码规范、两套 Prisma、Production／Preview build、行为清单和差异检查。所有阻断门为绿色，现阶段可以进入全新 `0/12` Thinking high 真人验收。

## 不可变版本

- Commit：`5281bc53f2b04be9c31adb6d7f4710ac818883a8`
- Build ID：`cfGovtoHY1ZF9Mk6RTvZa`
- Effective candidate：`0d5f91c0142df15035cd665a4a782f5207c4df48ef242e072452653c77b2efd6`
- Dataset：`191f648089ef6749024425ead17903995b307f1936cc6fc2ccef1aaaac7625cf`
- Execution：`96f1a022aede41b3648ecd60c4770bd66ea003b870ffcec85c9db2b0531cfd0c`

## 最终门结果

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| 全量 Vitest | `npm test` | 308 个文件通过、1 个文件跳过；2929 个测试通过、9 个测试跳过；0 failed |
| TypeScript | `npm run typecheck` | pass |
| 全量 ESLint | `npm run lint` | 0 errors；46 条既有 warnings |
| GI-088 定向 ESLint | `npx eslint <GI-088 changed files> --max-warnings=0` | 0 errors；0 warnings |
| 主 Prisma | `npx prisma validate` | valid |
| 私有评测 Prisma | `npm run prisma:gi088:validate` | valid |
| Production build | `npm run build` | pass；63 routes |
| Preview build | `VERCEL_ENV=preview npm run build` | pass；63 routes |
| Behavior manifest | `npx tsx scripts/check-gi088-behavior-manifest.ts --require-tracked` | pass；65 files |
| 差异格式 | `git diff --check` | pass |

## 行为与依赖锁定

- Behavior manifest SHA-256：`e38e5798e635c8100d804de4953ae2cd3d726a38926ae8a4ea1661537dc6f222`
- Behavior manifest JSON file SHA-256：`90e56ba00a34b160ea7d836e306f3dd2dc8f09ab435f71881b76f17eddec3c67`
- Candidate layer：`a83f235db2711c2adca02af8fac54d83d2d6559c04ac5b4d57f2b52ed5edb179`
- Dataset layer：`775442a568152748455bb51de2d232d41d6964be7cb17ace8f1d9df5b98044ac`
- Runner layer：`1943497a658d882aeb6682a49c2d9c90a11f6b3a1a8736f9f16c7ef8327539bb`
- Experience layer：`b98dc88431ea5feb1a614593f2c3b996f144d6a493c156b707e26bb55ea4a744`
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
