# Launch Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前仓库推进到“允许发出首批 `1-2` 个邀请制内测用户”的放行状态，并留下可复核的 go / no-go 证据。

**Architecture:** 这次不再继续扩产品能力，而是围绕四条执行线收口：域名与可访问性、验收文档回填、最终放行清单、发布环境最终回归。执行顺序采用“文档与域名并行、最终回归串行、发现 blocker 立即停线修复”的方式，避免在同一时间混改主链代码和污染发布结论。

**Tech Stack:** Next.js 15, TypeScript, Vitest, ESLint, Prisma, PostgreSQL, Vercel, DNSHE, Volcengine Ark

---

### Task 1: 固定发布执行真相源

**Files:**
- Read: `docs/plans/2026-05-24-launch-overview.md`
- Create: `docs/plans/2026-05-24-launch-final-checklist.md`
- Create: `docs/plans/2026-05-24-internal-beta-ops.md`

**Step 1: 写最终放行 checklist 文档**

在 `docs/plans/2026-05-24-launch-final-checklist.md` 新建文档，至少包含这些 section：

```md
# Final Launch Checklist

## 1. 文档回填
- [ ] AI-01 joy 结论已回填
- [ ] AI-03 reflection 结论已回填
- [ ] 发布总览已同步

## 2. 环境与域名
- [ ] dlight.cc.cd 已接入 Vercel
- [ ] DNSHE 记录已生效
- [ ] preview / production 环境变量核对完成

## 3. 自动化
- [ ] npm run typecheck
- [ ] npm test
- [ ] npm run build
- [ ] npm run lint

## 4. 人工回归
- [ ] 注册 / 登录 / 退出
- [ ] 五维访谈
- [ ] 单篇日志生成 / 保存
- [ ] 完整日志生成 / 保存
- [ ] calendar / analysis / profile / settings

## 5. 内测运营
- [ ] 种子用户已确定
- [ ] 反馈群已建立
- [ ] 暂停扩人规则已写明
```

**Step 2: 写内测运营 SOP 文档**

在 `docs/plans/2026-05-24-internal-beta-ops.md` 新建文档，至少包含：

```md
# Internal Beta Ops

## 1. 范围
- 首批 1-2 人
- 观察 24-48 小时

## 2. 反馈群规则
- 报问题必须带时间、页面、操作步骤、截图
- 涉及账号或 entryDate 必须写明

## 3. 暂停扩人条件
- 注册登录失败
- 访谈无法继续
- 日志无法保存
- 串账号 / 串日期
- 中国大陆网络稳定打不开

## 4. 可继续扩人条件
- 无新的 P0
- 核心主链可重复跑通
```

**Step 3: 交叉检查发布总览与新文档不冲突**

Run:

```bash
sed -n '1,260p' docs/plans/2026-05-24-launch-overview.md
sed -n '1,260p' docs/plans/2026-05-24-launch-final-checklist.md
sed -n '1,260p' docs/plans/2026-05-24-internal-beta-ops.md
```

Expected:
- 三份文档中的发布范围、人数、暂停规则一致
- 不出现“全量开放”和“收口功能”同时存在的冲突表述

**Step 4: Commit**

```bash
git add docs/plans/2026-05-24-launch-overview.md docs/plans/2026-05-24-launch-final-checklist.md docs/plans/2026-05-24-internal-beta-ops.md
git commit -F - <<'EOF'
Create the release-control documents for first-wave beta launch

Constraint: 本轮发布依赖明确的放行条件和运营规则，不能只靠聊天结论推进
Rejected: 继续把发布判断分散在多个旧文档里 | 进入最终回归时无法快速判断 go/no-go
Confidence: high
Scope-risk: narrow
Directive: 后续任何放行条件变化先改这三份文档，再改执行顺序
Tested: sed -n '1,260p' docs/plans/2026-05-24-launch-overview.md; sed -n '1,260p' docs/plans/2026-05-24-launch-final-checklist.md; sed -n '1,260p' docs/plans/2026-05-24-internal-beta-ops.md
Not-tested: 真实内测群执行效果
EOF
```

### Task 2: 接入 `dlight.cc.cd` 并固化中国大陆访问检查面

**Files:**
- Modify: `docs/vercel-preview-production-lane.md`
- Create: `docs/plans/2026-05-24-mainland-access-checklist.md`

**Step 1: 在 Vercel 项目中添加域名**

Run:

```bash
vercel domains add dlight.cc.cd
```

Expected:
- 命令返回域名已添加，或者明确提示需要配置 DNS 记录
- 如果命令不可用或项目未 link，先执行 `vercel link` 并重试

**Step 2: 按 Vercel 提示在 DNSHE 配置 DNS 记录**

在 DNSHE 控制台中按 Vercel 实际提示填写，默认优先检查：

- `@` -> `A` -> `76.76.21.21`
- `www` -> `CNAME` -> Vercel 实际提示值
- 必要时添加 Vercel 要求的 `TXT`

把最终生效记录写入 `docs/plans/2026-05-24-mainland-access-checklist.md`，格式至少包含：

```md
# Mainland Access Checklist

## 1. 域名接入
- apex: dlight.cc.cd
- DNS provider: DNSHE
- A record:
- CNAME record:
- TXT verification:

## 2. 访问检查
- 首页
- /login
- /register
- /interview
- 访谈 respond 流式
- draft generate / save
```

**Step 3: 验证 DNS 与域名状态**

Run:

```bash
dig dlight.cc.cd
dig www.dlight.cc.cd
vercel domains inspect dlight.cc.cd
```

Expected:
- `dig` 能返回已配置记录
- `vercel domains inspect` 显示 `Valid Configuration` 或同等通过态

**Step 4: 用自定义域名补最小 smoke**

Run:

```bash
SMOKE_BASE_URL="https://dlight.cc.cd" npm run smoke:public
```

Expected:
- `/`
- `/login`
- `/register`
- `/legal/terms`
- `/legal/privacy`
- `/api/auth/session`
  均满足脚本通过条件

**Step 5: Commit**

```bash
git add docs/vercel-preview-production-lane.md docs/plans/2026-05-24-mainland-access-checklist.md
git commit -F - <<'EOF'
Capture the custom-domain rollout path for mainland-access checks

Constraint: 中国大陆访问验证必须基于正式自定义域名，而不是继续使用 *.vercel.app
Rejected: 只在聊天里记 DNS 记录 | 域名切换和后续复测无法复现
Confidence: medium
Scope-risk: narrow
Directive: 以后变更发布域名时，先同步 mainland-access checklist 和 Vercel lane
Tested: vercel domains add dlight.cc.cd; dig dlight.cc.cd; dig www.dlight.cc.cd; vercel domains inspect dlight.cc.cd; SMOKE_BASE_URL="https://dlight.cc.cd" npm run smoke:public
Not-tested: 多地区中国大陆实网访问
EOF
```

### Task 3: 回填 `AI-01` 和 `AI-03` 的正式验收结论

**Files:**
- Modify: `docs/plans/2026-05-17-launch-acceptance-matrix.md`
- Read: `docs/operator-runbook.md`
- Read: `docs/theory/joy-alignment.md`
- Read: `docs/theory/reflection-alignment.md`

**Step 1: 补 joy 的结论段**

在 `AI-01 joy 访谈效果` 小节后补一段“当前补充观察”，格式与 `AI-02 / AI-04 / AI-05` 保持一致，至少覆盖：

- `清醒地开始` 标题样本
- `user_override_partial` 收束
- 抽象 `delightSignature` 不被当成可信闭合
- 正文 / fallback draft 不出现内部理论腔

收尾固定写：

```md
- 本条当前判定：`AI-01 通过`。
```

**Step 2: 补 reflection 的结论段**

在 `AI-03 reflection 访谈效果` 小节后补一段“当前补充观察”，至少覆盖：

- `trigger + insight` 后的 partial 收束
- 空泛样本会进入 `boundary_insufficient`
- “没有具体经历 / 对话”后的继续深聊不回卷
- 标题收束为 `忙碌不等于进展` 等自然短标题

收尾固定写：

```md
- 本条当前判定：`AI-03 通过`。
```

**Step 3: 自查矩阵内 AI-01 ~ AI-05 是否全部有最终判定**

Run:

```bash
grep -n "本条当前判定" docs/plans/2026-05-17-launch-acceptance-matrix.md
```

Expected:
- `AI-01`
- `AI-02`
- `AI-03`
- `AI-04`
- `AI-05`
  都有最终判定

**Step 4: Commit**

```bash
git add docs/plans/2026-05-17-launch-acceptance-matrix.md
git commit -F - <<'EOF'
Close the remaining AI acceptance writebacks before launch sign-off

Constraint: 最终放行前，五维 AI 访谈效果不能只靠口头判断，必须在验收矩阵里显式落结论
Rejected: 默认用 B-07 闭环证据替代 AI 质量结论 | 能跑通不等于问得对、收得住
Confidence: medium
Scope-risk: narrow
Directive: 后续调整任一维度的 prompt、quality gate 或 partial 规则时，同步更新对应 AI 验收结论
Tested: grep -n "本条当前判定" docs/plans/2026-05-17-launch-acceptance-matrix.md
Not-tested: 新一轮真实样本重跑
EOF
```

### Task 4: 跑发布前最终自动化基线

**Files:**
- Read: `package.json`
- Modify: `docs/plans/2026-05-24-launch-final-checklist.md`

**Step 1: 跑类型检查**

Run:

```bash
npm run typecheck
```

Expected:
- 退出码为 `0`

**Step 2: 跑单测**

Run:

```bash
npm test
```

Expected:
- 全量通过
- 文件数和测试数以当次绿灯结果为准

**Step 3: 跑构建**

Run:

```bash
npm run build
```

Expected:
- 构建成功

**Step 4: 跑 lint**

Run:

```bash
npm run lint
```

Expected:
- 命令成功退出
- 如果仍有 warning，确认不是新的发布阻断

**Step 5: 把自动化结果回填到最终 checklist**

在 `docs/plans/2026-05-24-launch-final-checklist.md` 中记录每条命令的执行时间和结果，格式至少为：

```md
## 自动化结果
- 2026-05-24 21:30 `npm run typecheck`：通过
- 2026-05-24 21:38 `npm test`：通过
- 2026-05-24 21:50 `npm run build`：通过
- 2026-05-24 21:56 `npm run lint`：通过
```

**Step 6: Commit**

```bash
git add docs/plans/2026-05-24-launch-final-checklist.md
git commit -F - <<'EOF'
Record the final automation baseline before launch regression

Constraint: 发版前自动化结论必须和当次环境对应，不能继续引用 5 月 18-20 日的旧证据
Rejected: 直接沿用历史绿灯记录 | 当前发布判断必须绑定最新代码和最新环境
Confidence: high
Scope-risk: narrow
Directive: 每次计划发出邀请前，重新跑一遍 automation baseline 并写回 checklist
Tested: npm run typecheck; npm test; npm run build; npm run lint
Not-tested: 真实浏览器用户链路
EOF
```

### Task 5: 跑最终人工回归并做 go / no-go 判断

**Files:**
- Modify: `docs/plans/2026-05-24-launch-final-checklist.md`
- Modify: `docs/plans/2026-05-17-launch-issue-tracker.md`
- Modify: `docs/plans/2026-05-24-launch-overview.md`

**Step 1: 依照验收矩阵重跑用户可见全量面**

至少重跑这些高优先级路径：

- `A-02 / A-03 / A-06`
- `B-01 ~ B-07`
- `C-01 ~ C-06`
- `D-01 / D-02 / D-03`
- `E-04`
- `F-03 / F-04 / F-05`
- `G-01 / G-02 / G-04`

优先使用：

- 准备发布的环境
- 自定义域名 `dlight.cc.cd`
- 真实登录态

**Step 2: 发现问题立即写入问题池**

如果发现新问题，不要先改代码，先写入 `docs/plans/2026-05-17-launch-issue-tracker.md`，新增一行并标：

- `new`
- `P0 / P1 / P2`
- `复现步骤`
- `预期`
- `实际`

**Step 3: 如果存在新的 P0，立即停止发放判断**

在 `docs/plans/2026-05-24-launch-overview.md` 里把：

```md
当前状态：`Pending final sign-off`
```

改成：

```md
当前状态：`Blocked by final regression`
```

并补一段阻断说明。

**Step 4: 如果没有新的 P0，写出 go / no-go 结论**

在 `docs/plans/2026-05-24-launch-final-checklist.md` 末尾补：

```md
## Launch Decision
- Decision: Go / No-Go
- Decided at:
- Basis:
- Remaining accepted limits:
```

同时把 `docs/plans/2026-05-24-launch-overview.md` 里的当前状态更新为：

- `Ready for controlled beta release`
  或
- `Blocked by final regression`

**Step 5: Commit**

```bash
git add docs/plans/2026-05-24-launch-final-checklist.md docs/plans/2026-05-17-launch-issue-tracker.md docs/plans/2026-05-24-launch-overview.md
git commit -F - <<'EOF'
Capture the final go-no-go decision for first-wave beta release

Constraint: 首批邀请发出前必须有明确的 go/no-go 记录，而不是靠口头判断
Rejected: 发现问题后先修再补文档 | 会丢失最终回归时的真实发布判断上下文
Confidence: medium
Scope-risk: narrow
Directive: 每次重新进入发布窗口，都重新生成一次新的 launch decision 记录
Tested: 按 docs/plans/2026-05-17-launch-acceptance-matrix.md 重跑最终人工回归
Not-tested: 扩到 5 人后的真实持续使用表现
EOF
```

### Task 6: 若最终回归发现 blocker，进入最小修复循环

**Files:**
- Modify: `docs/plans/2026-05-17-launch-issue-tracker.md`
- Modify: `docs/plans/2026-05-24-launch-overview.md`
- Modify: `[only the exact code files implicated by the new blocker]`
- Test: `[targeted tests matching the blocker]`

**Step 1: 只修当前 blocker，不扩 scope**

规则：

- 只处理最终回归中新出现的 `P0`
- 不顺手清理无关 warning
- 不把文案优化扩成重构

**Step 2: 先补 targeted test，再做最小修复**

Run:

```bash
npm test -- <targeted test path>
```

Expected:
- 先失败，证明测试覆盖到 blocker

然后做最小代码修复，再重跑 targeted test。

**Step 3: 回原用例回归**

按问题池中的关联用例回到原路径重跑，只有原用例通过后，才允许回到 `Task 5` 重新做 go / no-go。

**Step 4: Commit**

```bash
git add [targeted files]
git commit -F - <<'EOF'
Remove the final-regression blocker before beta release

Constraint: 最终回归阶段只能做阻断修复，不能顺手扩 scope
Rejected: 借机继续做体验打磨 | 会污染发布窗口并延长验证面
Confidence: medium
Scope-risk: moderate
Directive: 修复 blocker 后必须回到原用例重跑，再更新 launch decision
Tested: npm test -- <targeted test path>; 原用例手工回归
Not-tested: 未受影响的非主链场景
EOF
```

---

## 执行顺序

按以下顺序执行，不要跳步：

1. `Task 1` 文档真相源
2. `Task 2` 域名与中国大陆访问检查面
3. `Task 3` AI 验收结论回填
4. `Task 4` 最终自动化基线
5. `Task 5` 最终人工回归与 go / no-go
6. 如有 blocker，再进 `Task 6`

## 并行边界

可并行：

- `Task 1`
- `Task 2`
- `Task 3`

必须串行：

- `Task 4`
- `Task 5`
- `Task 6`

原因：

- `Task 4 ~ 6` 共享同一套准备发布环境、同一套发布判断和同一份问题池结论
- 在最终回归阶段混入并行改动会污染 go / no-go 证据

## 完成定义

只有以下条件全部成立，才算本计划完成：

- `dlight.cc.cd` 可用
- `AI-01 ~ AI-05` 全部有正式结论
- 最终 checklist 已写满
- 自动化四件套已通过
- 最终人工回归完成
- 发布总览状态变为 `Ready for controlled beta release` 或 `Blocked by final regression`
- 如果是 `Go`，已准备好首批 `1-2` 个种子用户与反馈群
