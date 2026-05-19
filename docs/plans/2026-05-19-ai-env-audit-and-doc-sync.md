# AI Env Audit And Doc Sync Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit the real Vercel Preview / Production AI environment-variable state and write the launch-readiness gap back into the repo docs, while updating the deployment URL contract to be compatible with Vercel system envs.

**Architecture:** Treat `.env.preview.example` and `.env.production.example` as the contract source, compare them against the live `vercel env ls` result for the linked `xingfuxitong` project, then sync the gap into the deployment lane doc, launch acceptance matrix, and issue tracker. This lane is docs-and-ops only; do not change application behavior yet.

**Tech Stack:** Markdown docs, Vercel CLI, repo launch-readiness plans

---

### Task 1: Capture the audit source of truth

**Files:**
- Modify: `docs/vercel-preview-production-lane.md`
- Reference: `.env.preview.example`
- Reference: `.env.production.example`

**Step 1: Record the required contract**

List the required user-defined variables for Preview / Production from the example files:
- `DATABASE_URL`
- `AI_PROVIDER`
- `VOLCENGINE_ARK_API_KEY`
- `VOLCENGINE_ARK_ENDPOINT_ID`
- `VOLCENGINE_ARK_BASE_URL`
- `VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID` as optional

Record the URL contract separately:
- explicit `APP_URL` remains a valid path
- if the project relies on Vercel system env instead, the docs must point to `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL`
- if the docs rely on that path, they must also say system env exposure still needs a direct follow-up check

**Step 2: Record the live Vercel result**

Run from the repo root already linked to `zouzhijies-projects/xingfuxitong`, or otherwise pin the command to that project explicitly:

```bash
vercel env ls --scope zouzhijies-projects
```

Working assumption before the live audit:
- Only `DATABASE_URL` and `DIRECT_URL`
- Present in `Development / Preview / Production`
- No AI variables
- No user-defined `APP_URL`

**Step 3: Write the audit snapshot**

Add a dated section to `docs/vercel-preview-production-lane.md` with:
- audit time
- project name `xingfuxitong`
- live missing-variable list
- launch impact
- explicit note that `vercel env ls` does not by itself prove whether Vercel system envs are exposed to deployments

### Task 2: Promote the audit gap into launch governance

**Files:**
- Modify: `docs/plans/2026-05-17-launch-acceptance-matrix.md`
- Modify: `docs/plans/2026-05-17-launch-issue-tracker.md`

**Step 1: Add a new acceptance case**

Create `D-05` under batch 4:
- Vercel Preview / Production AI env contract
- expected result: Preview / Production have the documented AI variables, and the deployment URL contract is satisfied either by explicit `APP_URL` or by exposed Vercel system envs
- failure class: `数据风险 / 上线阻断`

**Step 2: Add the current execution record**

Mark `D-05` as not passed with evidence from `vercel env ls`.

**Step 3: Add a new issue**

Create `ISSUE-012`:
- linked case: `D-05`
- priority: `P0`
- title about missing Vercel AI env vars and unresolved URL contract verification
- status: `triaged`

**Step 4: Tie the matrix to the issue**

Reference `ISSUE-012` from the batch-4 execution record.

### Task 3: Verify the doc sync

**Files:**
- Verify: `docs/vercel-preview-production-lane.md`
- Verify: `docs/plans/2026-05-17-launch-acceptance-matrix.md`
- Verify: `docs/plans/2026-05-17-launch-issue-tracker.md`

**Step 1: Verify the new markers exist**

Run:

```bash
rg -n "D-05|ISSUE-012|2026-05-19 审计快照" docs
```

Expected:
- one deployment-lane audit snapshot
- one new acceptance case
- one new issue row

**Step 2: Review the wording**

Confirm the docs say:
- current Vercel env state is below contract
- missing AI vars are still a real blocker
- `APP_URL` is no longer treated as an always-required user-defined env var if Vercel system envs are intentionally used instead
- relying on Vercel system envs still requires a follow-up check that exposure is enabled
- embedding endpoint can still remain optional

**Step 3: Commit after the doc batch is verified**

```bash
git add docs/vercel-preview-production-lane.md \
  docs/plans/2026-05-17-launch-acceptance-matrix.md \
  docs/plans/2026-05-17-launch-issue-tracker.md \
  docs/plans/2026-05-19-ai-env-audit-and-doc-sync.md
git commit -m $'record launch-readiness env blockers with a reproducible Vercel contract\n\nConstraint: live Vercel audit only proves user-defined env state; system env exposure still requires separate verification\nRejected: keep APP_URL as an always-required Preview/Production env | mismatches the Vercel-system-env-compatible contract\nConfidence: high\nScope-risk: narrow\nDirective: keep future launch-readiness docs aligned on the same AI-env and deployment-URL contract\nTested: targeted doc readback for D-05, ISSUE-012, and the Vercel lane audit snapshot\nNot-tested: no platform setting or runtime readback was added in this doc-only batch\nCo-authored-by: OmX <omx@oh-my-codex.dev>'
```
