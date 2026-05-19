# Launch Readiness Batch 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前本地 `build / lint` 的不稳定状态收敛为可复现的自动化基线，并把通过后的 `build` 与 `lint` 纳入 CI。

**Architecture:** 这一批先修“工具链自身不稳”，再扩 CI。已确认的真实问题有三类：`next build` 在 worktree 下会因为多 lockfile 触发 workspace root warning，`next lint` 已被 Next.js 官方弃用且当前在 worktree 下因为 ESLint plugin 冲突直接失败，现有 CI 只覆盖 `typecheck + test`。官方文档给出的方向是：对嵌套项目用 `outputFileTracingRoot` 显式设 tracing root，对 lint 从 `next lint` 迁到 ESLint CLI。

**Tech Stack:** Next.js 15, TypeScript, ESLint, GitHub Actions, npm

---

### Task 1: 固定 Next.js 的 tracing root，消除多 lockfile 的根目录告警

**Files:**
- Modify: `next.config.ts`
- Test: `next.config.ts`

**Step 1: 在配置里显式声明 tracing root**

把 `next.config.ts` 从：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false
};

export default nextConfig;
```

改成：

```ts
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  outputFileTracingRoot: path.join(__dirname)
};

export default nextConfig;
```

如果验证后发现 warning 仍然保留，再改成更明确的绝对路径表达，但不要在这一步同时引入别的构建配置。

**Step 2: 跑 build 验证 warning 是否收敛**

Run:

```bash
npm run build
```

Expected:
- `build` 完成
- 不再出现 “Next.js inferred your workspace root” 这类多 lockfile tracing root warning

**Step 3: 提交这一步**

```bash
git add next.config.ts
git commit -F - <<'EOF'
Make Next.js tracing root explicit inside the execution worktree

Constraint: worktree 嵌套在主仓目录下时，Next.js 会对 workspace root 和 tracing root 做不稳定推断
Rejected: 继续依赖 Next.js 自动推断 | build 输出会持续掺杂环境相关 warning
Confidence: medium
Scope-risk: narrow
Directive: 以后在嵌套 worktree 里跑 build，优先显式声明 tracing root
Tested: npm run build
Not-tested: standalone output or custom tracing includes
EOF
```

### Task 2: 从 `next lint` 迁到 ESLint CLI

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `eslint.config.mjs`
- Delete: `.eslintrc.json`

**Step 1: 运行官方 codemod**

按 Next.js 官方迁移路径执行：

```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

Expected:
- `package.json` 的 `lint` 脚本从 `next lint` 改为 ESLint CLI
- 生成 `eslint.config.mjs`
- 自动补上需要的 ESLint 依赖

**Step 2: 审核 codemod 结果，保持最小化**

检查并确保最终结果满足这几个条件：

- `package.json` 的 `lint` 脚本使用 ESLint CLI，而不是 `next lint`
- 只保留一套 ESLint 配置真相源
- 如果 `eslint.config.mjs` 已覆盖现有配置，删除 `.eslintrc.json`
- 不顺手引入格式化器、Biome 或额外规则集

**Step 3: 跑 lint 验证迁移后基线**

Run:

```bash
npm run lint
```

Expected:
- `lint` 命令能稳定执行
- 不再报 `next lint` deprecation
- 不再报 `Plugin "@next/next" was conflicted`

如果仍有真实 lint 报错，这一步只修会阻断 CI 的确定性问题；不要扩成大规模代码洁癖改造。

**Step 4: 提交这一步**

```bash
git add package.json package-lock.json eslint.config.mjs .eslintrc.json
git commit -F - <<'EOF'
Move lint execution to the supported ESLint CLI path

Constraint: Next.js 官方已经移除 next lint 路线，当前 worktree 下它还会引发 plugin conflict
Rejected: 继续修补 next lint 调用链 | 这条路径本身已经被官方淘汰
Confidence: medium
Scope-risk: moderate
Directive: 后续 lint 相关调整都基于 ESLint CLI 和 eslint.config.mjs，不再回退到 next lint
Tested: npx @next/codemod@canary next-lint-to-eslint-cli .; npm run lint
Not-tested: 自定义 lint 规则扩展
EOF
```

### Task 3: 把 `build` 和 `lint` 纳入 CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: 扩 CI 步骤**

把当前 CI 从：

```yaml
- run: npm ci
- run: npm run typecheck
- run: npm test
```

扩成：

```yaml
- run: npm ci
- run: npm run typecheck
- run: npm test
- run: npm run build
- run: npm run lint
```

保持顺序：先类型和单测，再 build，再 lint。

**Step 2: 本地按同顺序回归**

Run:

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

Expected:
- 四条命令都通过

**Step 3: 提交这一步**

```bash
git add .github/workflows/ci.yml
git commit -F - <<'EOF'
Extend CI to cover build and lint after toolchain stabilization

Constraint: 只有在本地 build 和 lint 已稳定后，才值得把它们提升为 CI gate
Rejected: 在 lint 迁移前先把失败命令塞进 CI | 会让 workflow 变成固定红灯
Confidence: high
Scope-risk: narrow
Directive: 新增 CI gate 前，先拿到本地稳定通过证据
Tested: npm run typecheck; npm test; npm run build; npm run lint
Not-tested: GitHub Hosted Runner 上的首轮远端执行结果
EOF
```

### Task 4: 记录批次 2 证据与剩余风险

**Files:**
- Modify: `docs/plans/2026-05-18-launch-readiness-batch2.md`

**Step 1: 写回证据**

至少记录：

```md
- `npm run build` 通过
- `npm run lint` 通过
- `.github/workflows/ci.yml` 已扩到 `typecheck + test + build + lint`
```

**Step 2: 写回剩余风险**

至少记录：

```md
- GitHub Actions 上 Node 20 action runtime deprecation warning 仍待后续处理
- 测试日志中的 `DATABASE_URL` / `act(...)` warning 仍未清理
```

**Step 3: 提交这一步**

```bash
git add docs/plans/2026-05-18-launch-readiness-batch2.md
git commit -F - <<'EOF'
Capture launch-readiness batch 2 evidence and residual risks

Constraint: 工具链批次也要留下可复核证据，避免后续只凭记忆判断 build/lint 是否已经纳管
Rejected: 只在聊天里口头同步 batch 2 结果 | 后续接手人无法复核
Confidence: medium
Scope-risk: narrow
Directive: 每次扩 CI gate 后，都同步更新计划里的验证证据和剩余风险
Tested: git status --short
Not-tested: 后续 action runtime 升级方案
EOF
```
---

## Batch 2 Evidence

- `npm run typecheck` 通过
- `npm test` 通过：`76` 个 test files，`609` 个测试全部通过
- `npm run build` 通过，`Next.js inferred your workspace root` warning 已消失
- `npm run lint` 通过，当前只剩 `31` 条 warning，`0` 个 error
- `.github/workflows/ci.yml` 已扩到 `npm ci + typecheck + test + build + lint`

## Batch 2 Residual Risks

- GitHub Actions 上 Node 20 action runtime deprecation warning 仍待后续处理
- 测试日志里的 `DATABASE_URL` fallback 日志与 `act(...)` warning 仍未清理
- 当前 lint 基线仍保留 `31` 条 warning，后续如果要把 warning 收紧为 gate，还需要单独清理
