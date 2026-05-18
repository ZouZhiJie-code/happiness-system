# Launch Readiness Batch 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `npm test` 在主仓和 worktree 都稳定可复现，并补上最小 GitHub CI 基线，避免发版前的自动化结论被历史 worktree 噪声或人工漏跑污染。

**Architecture:** 这一批只收敛“验证入口”问题，不碰业务逻辑。先把已发现的测试基线污染点隔离掉，再把 Vitest 的扫描范围显式写进配置，最后把同一套命令搬进 GitHub Actions，并把仓库文档改成和真实配置一致。

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, GitHub Actions, npm

---

### Task 1: 清理当前全量测试基线

**Files:**
- Modify: `tests/unit/settings-page.test.tsx`
- Test: `tests/unit/settings-page.test.tsx`

**Step 1: 写出最小隔离测试改动**

把 `SettingsForm` mock 掉，避免这个服务端页面测试误把 `react-hook-form` 客户端实现一起拉进来：

```tsx
vi.mock("@/components/joy/settings-form", () => ({
  SettingsForm: () => <div data-testid="settings-form-stub">settings form stub</div>
}));
```

这段 mock 放在：

```tsx
vi.mock("@/server/services/auth/current-user.service", () => ({
  getCurrentUserFromSessionToken: mockGetCurrentUserFromSessionToken
}));

vi.mock("@/components/joy/settings-form", () => ({
  SettingsForm: () => <div data-testid="settings-form-stub">settings form stub</div>
}));

import SettingsPage from "@/app/settings/page";
```

**Step 2: 跑单测确认这个隔离点成立**

Run:

```bash
npx vitest run tests/unit/settings-page.test.tsx
```

Expected:
- `1` file passed
- 不再出现 `Invalid hook call`

**Step 3: 跑全量测试确认基线已恢复**

Run:

```bash
npm test
```

Expected:
- 全量通过
- 不再被 `settings-page` 这个用例打断
- 允许保留既有 warning，例如 `DATABASE_URL` 缺失 warning 和 `act(...)` warning，只要测试结果是绿的

**Step 4: 提交这一步**

```bash
git add tests/unit/settings-page.test.tsx
git commit -F - <<'EOF'
Stabilize the default test baseline before launch-readiness cleanup

Constraint: settings page assertions only需要验证登录态与退出动作，不应把客户端表单实现一起拉进服务端页面测试
Rejected: 直接改 SettingsForm 生产代码 | 会把测试隔离问题误扩成业务重构
Confidence: high
Scope-risk: narrow
Directive: 以后给服务端 page 写单测时，优先 stub 掉无关的 client-only 子组件
Tested: npx vitest run tests/unit/settings-page.test.tsx; npm test
Not-tested: 浏览器端设置页真实表单交互
EOF
```

### Task 2: 把 Vitest 扫描范围写死为仓库主测试集

**Files:**
- Modify: `vitest.config.ts`
- Test: `tests/unit/settings-page.test.tsx`
- Test: `tests/unit/auth.api.test.ts`

**Step 1: 先写配置改动**

把当前只有 `environment / globals / setupFiles` 的配置补全成显式 `include / exclude`：

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.worktrees/**",
      "**/.claude/worktrees/**"
    ]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

**Step 2: 跑一个快回归，确认配置没把正常测试排掉**

Run:

```bash
npx vitest run tests/unit/settings-page.test.tsx tests/unit/auth.api.test.ts
```

Expected:
- 两个测试文件都通过
- `@` alias 仍可正常解析

**Step 3: 跑全量测试确认默认入口稳定**

Run:

```bash
npm test
```

Expected:
- 全量通过
- 结果里不再混入 `.worktrees/**` 或 `.claude/worktrees/**` 下的历史测试噪声

**Step 4: 提交这一步**

```bash
git add vitest.config.ts
git commit -F - <<'EOF'
Make the default Vitest entrypoint repo-scoped and repeatable

Constraint: 发版前默认回归命令必须只反映当前仓库主测试集，不能受历史 worktree 污染
Rejected: 继续依赖 Vitest 隐式默认扫描 | 文档与真实行为已经漂移，复现性不够
Confidence: high
Scope-risk: narrow
Directive: 后续新增测试目录时，先更新 include/exclude，再更新 README 和 runbook
Tested: npx vitest run tests/unit/settings-page.test.tsx tests/unit/auth.api.test.ts; npm test
Not-tested: Vitest coverage 配置
EOF
```

### Task 3: 同步 README 和运行手册，清理文档漂移

**Files:**
- Modify: `README.md`
- Modify: `docs/operator-runbook.md`

**Step 1: 更新 README 的自动化现状**

把自动化说明改成以配置事实为准，至少覆盖这两点：

```md
- `npm test`（Vitest）在当前 worktree 通过：`71` 个测试文件、`595` 个测试
- Vitest 现在由 `vitest.config.ts` 显式限定只扫描 `tests/**/*.test.{ts,tsx}`，并排除 `.worktrees/**` 与 `.claude/worktrees/**`
```

如果后续重跑后的计数变化，以最新一次全量通过的真实数字为准，不保留旧数字。

**Step 2: 更新 runbook 的测试说明**

把 `docs/operator-runbook.md` 里测试段落的旧结论替换成新的基线表达，至少包含：

```md
- `npm test`（Vitest）在当前基线通过，真实文件数与测试数以最近一次全量绿灯记录为准
- Vitest 当前通过 `vitest.config.ts` 显式只扫描 `tests/**/*.test.{ts,tsx}`，并排除 `.worktrees/**` 与 `.claude/worktrees/**`
```

**Step 3: 自查文档里还有没有旧说法**

Run:

```bash
rg -n "47 个测试文件|491 个测试|554 个测试|592 个测试|只扫描 `tests/\\*\\*/\\*.test" README.md docs/operator-runbook.md
```

Expected:
- 不再留下明显过期的旧计数或旧描述

**Step 4: 提交这一步**

```bash
git add README.md docs/operator-runbook.md
git commit -F - <<'EOF'
Align launch docs with the real test entrypoint

Constraint: README 和 runbook 必须能直接指导发版前回归，不能继续陈列过期测试口径
Rejected: 先只改代码不改文档 | 下一位执行者会继续被旧数字和旧行为误导
Confidence: medium
Scope-risk: narrow
Directive: 每次自动化基线变化后，同步更新 README 与 runbook 的测试现实段落
Tested: rg -n "47 个测试文件|491 个测试|554 个测试|592 个测试|只扫描 `tests/\\*\\*/\\*.test" README.md docs/operator-runbook.md
Not-tested: 其他历史计划文档中的旧计数引用
EOF
```

### Task 4: 增加最小 GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Test: `.github/workflows/ci.yml`

**Step 1: 新建 workflow**

创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches:
      - main
      - "feature/**"
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run typecheck
        run: npm run typecheck

      - name: Run tests
        run: npm test
```

说明：
- 仓库当前没有 `.nvmrc` 和 `engines`，先用 GitHub Actions 上更稳的 `Node 20` LTS。
- 这一批不把 `npm run build` 和 `npm run lint` 放进 CI，先守住“类型 + 单测”最小闭环。

**Step 2: 本地做 workflow 结构检查**

Run:

```bash
sed -n '1,220p' .github/workflows/ci.yml
```

Expected:
- YAML 结构完整
- 只包含 checkout / setup-node / npm ci / typecheck / test 这五步

**Step 3: 再跑一次本地等价命令**

Run:

```bash
npm ci
npm run typecheck
npm test
```

Expected:
- 三条命令都通过
- 本地结果和 CI 将执行的命令保持一致

**Step 4: 提交这一步**

```bash
git add .github/workflows/ci.yml package-lock.json
git commit -F - <<'EOF'
Add a minimal CI gate for launch-readiness work

Constraint: 当前最缺的是机器兜底的类型检查和测试回归，不是更重的部署流水线
Rejected: 一次性把 build、lint、deploy 全塞进首版 CI | 会把当前批次从验证闭环拉成大规模平台建设
Confidence: high
Scope-risk: moderate
Directive: 后续只有在 build 和 lint 基线稳定后，再把它们加入同一条 workflow
Tested: npm ci; npm run typecheck; npm test
Not-tested: GitHub Hosted Runner 上的首轮远端执行结果
EOF
```

### Task 5: 收尾回归并准备进入下一批

**Files:**
- Modify: `docs/plans/2026-05-18-launch-readiness-batch1.md`

**Step 1: 记录本批完成证据**

把最终通过结果写回本计划底部或同目录 handoff 补充段，至少记下：

```md
- `npx vitest run tests/unit/settings-page.test.tsx` 通过
- `npm run typecheck` 通过
- `npm test` 通过
- `.github/workflows/ci.yml` 已创建
```

**Step 2: 列出仍然留待下一批的问题**

至少记录这三类未处理项：

```md
- CI 还没覆盖 `npm run build`
- CI 还没覆盖 `npm run lint`
- 测试 warning 噪声（`DATABASE_URL`、`act(...)`）仍未清理
```

**Step 3: 最终检查工作树**

Run:

```bash
git status --short
```

Expected:
- 只剩这批计划内文件变更
- 没有意外脏文件

**Step 4: 提交收尾记录**

```bash
git add docs/plans/2026-05-18-launch-readiness-batch1.md
git commit -F - <<'EOF'
Capture the first launch-readiness batch evidence and remaining gaps

Constraint: 每一批发版准备都要留下可复核证据，方便后续继续拆批
Rejected: 只在聊天里口头说明结果 | 证据不可追溯，交接成本高
Confidence: medium
Scope-risk: narrow
Directive: 后续批次继续沿用“实现 + 验证 + 剩余风险”三段式收尾
Tested: git status --short
Not-tested: 下一批 CI 扩容后的远端表现
EOF
```

---

## Execution Evidence

- `npx vitest run tests/unit/settings-page.test.tsx tests/unit/auth.api.test.ts` 通过：`2` 个测试文件，`7` 个测试通过
- `npm run typecheck` 通过
- `npm test` 通过：`71` 个测试文件，`595` 个测试通过
- `.github/workflows/ci.yml` 已创建，并已本地读取确认步骤顺序为 `checkout -> setup-node -> npm ci -> npm run typecheck -> npm test`

## Remaining Gaps

- CI 还没覆盖 `npm run build`
- CI 还没覆盖 `npm run lint`
- 测试过程里的 warning / 日志噪声仍存在，包括 `DATABASE_URL` 缺失相关 Prisma warning 和 `act(...)` warning
