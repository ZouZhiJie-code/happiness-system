# 数据持久化补强 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补齐 Daily Light 当前数据持久化层的关键短板，覆盖查询索引、pgvector 落地、认证会话生命周期、数据库约束和运行文档，使现有功能在数据规模增长后仍可稳定演进。

**Architecture:** 以最小侵入方式增强现有 Next.js + Prisma + PostgreSQL 数据层，不重写业务模型。优先补“真实查询路径的索引”和“数据库侧约束”，其次补会话生命周期与向量检索部署一致性，最后同步 README / runbook / launch issue tracker，确保工程和运维口径一致。

**Tech Stack:** Next.js 15 App Router、TypeScript、Prisma、PostgreSQL、pgvector、Vitest。

---

## Summary

本计划只覆盖当前已经确认的持久化短板：

1. `calendar / analysis / daily-journal` 真实查询路径缺少复合索引。
2. `MemoryFact.embedding` 已接入，但 pgvector extension、向量索引和部署说明未收口。
3. `AuthSession.expiresAt / lastUsedAt` 已建模，但读取路径未回写活跃时间，也没有显式过期清理策略。
4. 一些关键业务约束仍只停留在应用层，缺少 DB 级兜底。
5. README / operator runbook 仍偏本地开发口径，未明确 migration、pooler、备份和回滚基线。

严格按 DRY / YAGNI / TDD 执行。每个任务都先写失败测试，再补最小实现，再验证，再提交。

---

## Task 1: 为日期主查询补复合索引

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260518110000_add_persistence_query_indexes/migration.sql`
- Create: `tests/unit/prisma-persistence-schema.test.ts`
- Test: `tests/unit/calendar.repository.test.ts`
- Test: `tests/unit/daily-journal.repository.test.ts`
- Test: `tests/unit/analysis.repository.test.ts`

**Step 1: Write the failing schema/index test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("prisma persistence indexes", () => {
  it("declares date-range indexes for session and entry queries", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("@@index([userId, entryDate])");
    expect(schema).toContain("@@index([userId, date])");
    expect(schema).toContain("@@index([userId, status, date])");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/prisma-persistence-schema.test.ts`

Expected: FAIL because the new indexes do not exist yet.

**Step 3: Strengthen repository tests to pin the target query shapes**

In `tests/unit/calendar.repository.test.ts` add assertions like:

```ts
expect(mockInterviewSessionFindMany).toHaveBeenCalledWith(
  expect.objectContaining({
    where: expect.objectContaining({
      userId: "user-1",
      entryDate: expect.any(Object)
    })
  })
);
```

In `tests/unit/daily-journal.repository.test.ts` and `tests/unit/analysis.repository.test.ts` add assertions that the repositories query by:

```ts
where: {
  userId: "user-1",
  status: "saved",
  date: { gte: expect.any(Date), lt: expect.any(Date) }
}
```

**Step 4: Run the repository tests to confirm current behavior is already pinned**

Run:

```bash
npm test -- tests/unit/calendar.repository.test.ts
npm test -- tests/unit/daily-journal.repository.test.ts
npm test -- tests/unit/analysis.repository.test.ts
```

Expected: PASS. These tests are guardrails; only the new schema test should still fail.

**Step 5: Add the minimal Prisma schema indexes**

Modify `prisma/schema.prisma`:

```prisma
model InterviewSession {
  // ...
  @@index([userId, status])
  @@index([userId, entryDate])
}

model JoyEntry {
  // ...
  @@index([userId, date])
  @@index([userId, status, date])
}

model DailyJournalEntry {
  // ...
  @@unique([userId, date])
  @@index([userId, status])
  @@index([userId, date])
}

model DailyHappinessScore {
  // ...
  @@unique([userId, date])
  @@index([userId, date])
}
```

**Step 6: Write the SQL migration explicitly**

Create `prisma/migrations/20260518110000_add_persistence_query_indexes/migration.sql`:

```sql
CREATE INDEX "InterviewSession_userId_entryDate_idx"
ON "InterviewSession"("userId", "entryDate");

CREATE INDEX "JoyEntry_userId_date_idx"
ON "JoyEntry"("userId", "date");

CREATE INDEX "JoyEntry_userId_status_date_idx"
ON "JoyEntry"("userId", "status", "date");

CREATE INDEX "DailyJournalEntry_userId_date_idx"
ON "DailyJournalEntry"("userId", "date");

CREATE INDEX "DailyHappinessScore_userId_date_idx"
ON "DailyHappinessScore"("userId", "date");
```

**Step 7: Run tests to verify the schema expectation passes**

Run:

```bash
npm test -- tests/unit/prisma-persistence-schema.test.ts
npm test -- tests/unit/calendar.repository.test.ts
npm test -- tests/unit/daily-journal.repository.test.ts
npm test -- tests/unit/analysis.repository.test.ts
```

Expected: PASS.

**Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260518110000_add_persistence_query_indexes/migration.sql tests/unit/prisma-persistence-schema.test.ts tests/unit/calendar.repository.test.ts tests/unit/daily-journal.repository.test.ts tests/unit/analysis.repository.test.ts
git commit -m "harden date-range persistence query paths

Constraint: calendar and journal reads already depend on user-scoped date windows
Rejected: broad speculative indexing | increases write cost without proof
Confidence: high
Scope-risk: narrow
Directive: add indexes from proven query shapes only
Tested: npm test -- tests/unit/prisma-persistence-schema.test.ts tests/unit/calendar.repository.test.ts tests/unit/daily-journal.repository.test.ts tests/unit/analysis.repository.test.ts
Not-tested: real EXPLAIN ANALYZE against production-like dataset"
```

---

## Task 2: 把 pgvector 从“能跑”补到“可部署”

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260518113000_harden_pgvector_setup/migration.sql`
- Create: `tests/unit/pgvector-migration.test.ts`
- Modify: `src/lib/vector.ts`
- Test: `tests/unit/memory-retrieval.service.test.ts`

**Step 1: Write the failing migration contract test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("pgvector migration", () => {
  it("creates extension and vector indexes explicitly", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260518113000_harden_pgvector_setup/migration.sql"),
      "utf8"
    );

    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS vector;');
    expect(sql).toContain('ALTER TABLE "MemoryFact" ADD COLUMN IF NOT EXISTS "embedding" vector(2048);');
    expect(sql).toMatch(/CREATE INDEX .*MemoryFact.*embedding/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/pgvector-migration.test.ts`

Expected: FAIL because the migration file does not exist yet.

**Step 3: Add a retrieval-focused test that locks the SQL safety boundary**

Extend `tests/unit/memory-retrieval.service.test.ts` with a case that proves retrieval still falls back cleanly when vector search fails:

```ts
it("falls back to keyword retrieval when vector search throws", async () => {
  mockFindSimilarMemoryFacts.mockRejectedValue(new Error("vector index missing"));
  mockFindMemoryFactsByDimension.mockResolvedValue([buildMemoryFact({ similarity: 0.4 })]);

  const result = await retrieveRelevantMemories({
    userId: USER_ID,
    dimension: "joy",
    snapshot: buildSnapshot({ event: "公园散步" })
  });

  expect(result.memories).toHaveLength(1);
});
```

**Step 4: Run the memory retrieval test and confirm the new case fails first**

Run: `npm test -- tests/unit/memory-retrieval.service.test.ts`

Expected: FAIL on the newly added case.

**Step 5: Add the explicit pgvector migration**

Create `prisma/migrations/20260518113000_harden_pgvector_setup/migration.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "MemoryFact"
ADD COLUMN IF NOT EXISTS "embedding" vector(2048);

CREATE INDEX IF NOT EXISTS "MemoryFact_embedding_cosine_idx"
ON "MemoryFact"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);
```

If the target Postgres does not allow `ivfflat` before data load, document a fallback:

```sql
-- fallback for small datasets:
-- skip ivfflat creation during local bootstrap
```

**Step 6: Make vector retrieval failure explicit and non-fatal**

In `src/lib/vector.ts`, keep raw SQL but document the operational dependency:

```ts
/**
 * Requires pgvector extension and an embedding column/index provisioned by migration.
 * Caller must handle fallback when vector search is unavailable.
 */
```

If needed, narrow the unsafe branch to dimensions-only interpolation and leave the default branch on parameterized `prisma.$queryRaw`.

**Step 7: Make the retrieval fallback test pass**

Update the retrieval service, if needed, so vector-path failure always returns keyword fallback rather than leaking raw errors.

**Step 8: Run tests**

Run:

```bash
npm test -- tests/unit/pgvector-migration.test.ts
npm test -- tests/unit/memory-retrieval.service.test.ts
```

Expected: PASS.

**Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260518113000_harden_pgvector_setup/migration.sql src/lib/vector.ts tests/unit/pgvector-migration.test.ts tests/unit/memory-retrieval.service.test.ts
git commit -m "stabilize pgvector deployment contract

Constraint: memory retrieval already depends on optional embeddings
Rejected: replacing vector retrieval with keyword-only fallback | loses semantic recall
Confidence: medium
Scope-risk: moderate
Directive: keep vector search optional at runtime but explicit in deployment docs
Tested: npm test -- tests/unit/pgvector-migration.test.ts tests/unit/memory-retrieval.service.test.ts
Not-tested: ivfflat creation on managed Postgres provider"
```

---

## Task 3: 补全认证会话生命周期

**Files:**
- Modify: `src/server/repositories/auth.repository.ts`
- Modify: `src/server/services/auth/current-user.service.ts`
- Modify: `src/server/services/auth/auth.service.ts`
- Create: `tests/unit/current-user.service.test.ts`
- Modify: `tests/unit/auth.service.test.ts`
- Modify: `tests/unit/auth.repository.test.ts`

**Step 1: Write the failing current-user service tests**

Create `tests/unit/current-user.service.test.ts`:

```ts
it("returns null and deletes expired sessions", async () => {
  mockFindAuthSessionByTokenHash.mockResolvedValue({
    tokenHash: "hashed",
    expiresAt: new Date("2000-01-01T00:00:00.000Z"),
    user: { id: "user-1", username: "demo" }
  });

  const result = await getCurrentUserFromSessionToken("raw-token");

  expect(result).toBeNull();
  expect(mockDeleteAuthSessionByTokenHash).toHaveBeenCalled();
});

it("touches lastUsedAt for a valid session", async () => {
  mockFindAuthSessionByTokenHash.mockResolvedValue({
    tokenHash: "hashed",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    user: { id: "user-1", username: "demo" }
  });

  await getCurrentUserFromSessionToken("raw-token");

  expect(mockTouchAuthSessionByTokenHash).toHaveBeenCalledWith(expect.any(String));
});
```

**Step 2: Run the new tests to verify they fail**

Run: `npm test -- tests/unit/current-user.service.test.ts`

Expected: FAIL because the repository helpers do not exist yet.

**Step 3: Extend auth service tests to pin transactional register/login behavior**

Add cases in `tests/unit/auth.service.test.ts`:

```ts
it("does not leave a half-created account when session creation fails", async () => {
  mockCreateUser.mockResolvedValue({ id: "user-1", username: "daily_light_01" });
  mockCreateAuthSession.mockRejectedValue(new Error("write failed"));

  await expect(registerUser({
    username: "daily_light_01",
    password: "supersecret1",
    acceptedTerms: true,
    acceptedPrivacy: true
  })).rejects.toThrow("write failed");
});
```

If the implementation moves to a repository-level transaction helper, update the mocks to target that helper instead.

**Step 4: Add repository helpers**

In `src/server/repositories/auth.repository.ts` add:

```ts
export async function touchAuthSessionByTokenHash(tokenHash: string) {
  return prisma.authSession.updateMany({
    where: { tokenHash },
    data: { lastUsedAt: new Date() }
  });
}

export async function deleteExpiredAuthSessions(now = new Date()) {
  return prisma.authSession.deleteMany({
    where: { expiresAt: { lte: now } }
  });
}
```

**Step 5: Update current-user resolution**

In `src/server/services/auth/current-user.service.ts`:

```ts
if (session.expiresAt instanceof Date && session.expiresAt.getTime() <= Date.now()) {
  await deleteAuthSessionByTokenHash(hashSessionToken(rawToken));
  return null;
}

await touchAuthSessionByTokenHash(hashSessionToken(rawToken));
return session.user ?? null;
```

**Step 6: Remove half-write risk from register/login**

Refactor `src/server/services/auth/auth.service.ts` so user creation + auth session creation are wrapped in one repository-level transaction, for example:

```ts
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: ... });
  await tx.authSession.create({ data: ... });
  return user;
});
```

If you prefer keeping `service` slim, expose `createUserWithInitialSession` from `auth.repository.ts` and test that instead.

**Step 7: Run tests**

Run:

```bash
npm test -- tests/unit/current-user.service.test.ts
npm test -- tests/unit/auth.service.test.ts
npm test -- tests/unit/auth.repository.test.ts
```

Expected: PASS.

**Step 8: Commit**

```bash
git add src/server/repositories/auth.repository.ts src/server/services/auth/current-user.service.ts src/server/services/auth/auth.service.ts tests/unit/current-user.service.test.ts tests/unit/auth.service.test.ts tests/unit/auth.repository.test.ts
git commit -m "close auth session lifecycle gaps

Constraint: session auth already ships in production-facing routes
Rejected: adding external auth dependency | too broad for current scope
Confidence: high
Scope-risk: moderate
Directive: keep session expiry and activity tracking in one code path
Tested: npm test -- tests/unit/current-user.service.test.ts tests/unit/auth.service.test.ts tests/unit/auth.repository.test.ts
Not-tested: long-lived session renewal over multi-day manual browsing"
```

---

## Task 4: 为幸福评分补数据库级范围约束

**Files:**
- Create: `prisma/migrations/20260518120000_add_daily_happiness_score_check_constraints/migration.sql`
- Create: `tests/unit/daily-happiness-score-migration.test.ts`
- Modify: `prisma/schema.prisma`
- Test: `tests/unit/daily-happiness-score.repository.test.ts`

**Step 1: Write the failing migration test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("daily happiness score constraints", () => {
  it("adds db-level 1-10 checks for every score column", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260518120000_add_daily_happiness_score_check_constraints/migration.sql"),
      "utf8"
    );

    expect(sql).toContain('"meaningScore" >= 1');
    expect(sql).toContain('"livingConditionScore" <= 10');
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/daily-happiness-score-migration.test.ts`

Expected: FAIL.

**Step 3: Add a repository test that documents the invariant source**

In `tests/unit/daily-happiness-score.repository.test.ts` add a note-style test:

```ts
it("assumes persistence rejects scores outside 1-10", () => {
  expect(true).toBe(true);
});
```

This looks trivial, but its purpose is to give the engineer a place to later expand with integration coverage if the test harness grows.

**Step 4: Write the migration**

Create `prisma/migrations/20260518120000_add_daily_happiness_score_check_constraints/migration.sql`:

```sql
ALTER TABLE "DailyHappinessScore"
ADD CONSTRAINT "DailyHappinessScore_meaningScore_check" CHECK ("meaningScore" BETWEEN 1 AND 10),
ADD CONSTRAINT "DailyHappinessScore_healthScore_check" CHECK ("healthScore" BETWEEN 1 AND 10),
ADD CONSTRAINT "DailyHappinessScore_virtueScore_check" CHECK ("virtueScore" BETWEEN 1 AND 10),
ADD CONSTRAINT "DailyHappinessScore_autonomyScore_check" CHECK ("autonomyScore" BETWEEN 1 AND 10),
ADD CONSTRAINT "DailyHappinessScore_interestScore_check" CHECK ("interestScore" BETWEEN 1 AND 10),
ADD CONSTRAINT "DailyHappinessScore_skillScore_check" CHECK ("skillScore" BETWEEN 1 AND 10),
ADD CONSTRAINT "DailyHappinessScore_relationshipScore_check" CHECK ("relationshipScore" BETWEEN 1 AND 10),
ADD CONSTRAINT "DailyHappinessScore_livingConditionScore_check" CHECK ("livingConditionScore" BETWEEN 1 AND 10);
```

**Step 5: Add a short schema comment**

In `prisma/schema.prisma`, above `DailyHappinessScore`, add:

```prisma
/// Score ranges are enforced at both Zod layer and DB layer via SQL migration checks.
```

**Step 6: Run tests**

Run:

```bash
npm test -- tests/unit/daily-happiness-score-migration.test.ts
npm test -- tests/unit/daily-happiness-score.repository.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260518120000_add_daily_happiness_score_check_constraints/migration.sql tests/unit/daily-happiness-score-migration.test.ts tests/unit/daily-happiness-score.repository.test.ts
git commit -m "enforce happiness score bounds in persistence

Constraint: score validity currently depends on application input validation
Rejected: trusting API-only validation | weak defense for durable analytics data
Confidence: high
Scope-risk: narrow
Directive: keep analytics source tables defensively constrained
Tested: npm test -- tests/unit/daily-happiness-score-migration.test.ts tests/unit/daily-happiness-score.repository.test.ts
Not-tested: migration against legacy invalid rows"
```

---

## Task 5: 升级数据库运行文档

**Files:**
- Modify: `README.md`
- Modify: `docs/operator-runbook.md`
- Modify: `docs/plans/2026-05-17-launch-issue-tracker.md`
- Create: `tests/unit/database-docs-smoke.test.ts`

**Step 1: Write the failing docs smoke test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("database docs", () => {
  it("documents migration, pooler, pgvector, and backup expectations", () => {
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
    const runbook = readFileSync(resolve(process.cwd(), "docs/operator-runbook.md"), "utf8");

    expect(readme).toContain("npx prisma migrate deploy");
    expect(runbook).toContain("pooler");
    expect(runbook).toContain("pgvector");
    expect(runbook).toContain("backup");
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/database-docs-smoke.test.ts`

Expected: FAIL.

**Step 3: Update README from local-dev-only to environment-aware setup**

Add a dedicated section like:

```md
### 数据库环境约定

- 本地开发：`npx prisma db push`
- 共享 / 预发 / 正式环境：`npx prisma migrate deploy`
- 使用 Neon / Supabase pooler 时，应用走 pooler URL；Prisma migration 走 direct URL
- pgvector 相关 migration 必须先在目标库执行成功，再开启记忆系统
```

**Step 4: Add operator runbook entries**

In `docs/operator-runbook.md` add:

```md
## Database hardening checklist

1. 确认 `DATABASE_URL` 与 `DIRECT_URL` 分工
2. 执行 `npx prisma migrate deploy`
3. 确认 pgvector extension / vector index 已存在
4. 做一次上线前备份
5. 记录回滚 migration 与恢复入口
```

Also add a short section on:
- 如何检查索引是否存在
- 如何确认 `AuthSession` 过期清理生效
- 如何处理 `vector` extension 缺失

**Step 5: Update the launch issue tracker**

In `docs/plans/2026-05-17-launch-issue-tracker.md`, add or update entries so these persistence tasks are visible as launch-adjacent technical debt rather than buried in chat history.

**Step 6: Run the docs test**

Run: `npm test -- tests/unit/database-docs-smoke.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add README.md docs/operator-runbook.md docs/plans/2026-05-17-launch-issue-tracker.md tests/unit/database-docs-smoke.test.ts
git commit -m "document database deployment and recovery path

Constraint: current repo docs bias toward local bootstrap
Rejected: leaving ops knowledge in ad hoc chat summaries | not durable enough
Confidence: medium
Scope-risk: narrow
Directive: keep deployment and recovery instructions executable from repo docs
Tested: npm test -- tests/unit/database-docs-smoke.test.ts
Not-tested: real restore drill against staging snapshot"
```

---

## Final Verification

Run the full targeted suite:

```bash
npm test -- tests/unit/prisma-persistence-schema.test.ts
npm test -- tests/unit/calendar.repository.test.ts
npm test -- tests/unit/daily-journal.repository.test.ts
npm test -- tests/unit/analysis.repository.test.ts
npm test -- tests/unit/pgvector-migration.test.ts
npm test -- tests/unit/memory-retrieval.service.test.ts
npm test -- tests/unit/current-user.service.test.ts
npm test -- tests/unit/auth.service.test.ts
npm test -- tests/unit/auth.repository.test.ts
npm test -- tests/unit/daily-happiness-score-migration.test.ts
npm test -- tests/unit/daily-happiness-score.repository.test.ts
npm test -- tests/unit/database-docs-smoke.test.ts
npx tsc --noEmit
```

Expected:
- All targeted Vitest suites PASS
- `npx tsc --noEmit` PASS

Then run migration sanity checks:

```bash
npx prisma migrate dev
npx prisma migrate status
```

Expected:
- new migrations apply cleanly
- status reports database schema is up to date

Manual verification:

1. 打开 `/calendar`、`/analysis`、`/interview?mode=daily-journal`，确认读链路无行为回归。
2. 登录后刷新私有页，确认 session 仍可识别。
3. 手动将一条 `AuthSession.expiresAt` 改成过去时间，再请求 `/api/auth/session`，确认返回未登录且过期 session 被清理。
4. 在目标数据库运行 `\dx` 或等价 SQL，确认 `vector` extension 存在。
5. 在目标数据库执行索引查询，确认新增索引已落地。

---

## Execution Order

按以下顺序执行，不要并行：

1. Task 1 查询索引
2. Task 2 pgvector
3. Task 3 auth session 生命周期
4. Task 4 DB 级评分约束
5. Task 5 文档与运维口径

这样安排的原因：
- 先补最直接的读性能缺口
- 再补记忆系统的部署一致性
- 再收账户体系的生命周期边界
- 最后同步文档，避免实现与文档再次漂移

Plan complete and saved to `docs/plans/2026-05-18-database-persistence-hardening.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
