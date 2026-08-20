// @vitest-environment node

import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient, type AIFewShotStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const INTEGRATION_ACK = "I_UNDERSTAND";
const INTEGRATION_ENABLED =
  process.env.DAILY_LIGHT_STAGE3_CONSENT_POSTGRES_INTEGRATION === INTEGRATION_ACK;
const describeIntegration = INTEGRATION_ENABLED ? describe.sequential : describe.skip;
const TEST_TIMEOUT_MS = 30_000;
const LOCK_WAIT_TIMEOUT_MS = 8_000;
const SCHEMA_PATTERN = /^daily_light_stage3_consent_[a-f0-9]{12,24}$/u;
const DATABASE_NAME = "daily_light_e2e_validation_20260819";
const REVIEWED_BY = "system:ai_quality_consent_withdrawal";
const REVIEW_REASON = "AI_QUALITY_CONSENT_WITHDRAWN";

type RepositoryModule = typeof import("@/server/repositories/ai-feedback.repository");

type SeededScenario = {
  userId: string;
  traceId: string;
  feedbackId: string;
  fewShotId: string;
  regenerationId: string;
  runId: string;
  candidateIds: string[];
};

type OperationOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

function resolveIsolatedDatabaseUrl() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("STAGE3_CONSENT_INTEGRATION_PRODUCTION_FORBIDDEN");
  }
  const source = process.env.DAILY_LIGHT_STAGE3_TEST_DATABASE_URL?.trim();
  const expectedApplicationName = process.env.DAILY_LIGHT_STAGE3_APPLICATION_NAME?.trim();
  if (!source || !expectedApplicationName) {
    throw new Error("STAGE3_CONSENT_INTEGRATION_DATABASE_URL_REQUIRED");
  }
  const url = new URL(source);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const schema = url.searchParams.get("schema");
  const applicationName = url.searchParams.get("application_name");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    databaseName !== DATABASE_NAME ||
    !schema ||
    !SCHEMA_PATTERN.test(schema) ||
    applicationName !== expectedApplicationName
  ) {
    throw new Error("STAGE3_CONSENT_INTEGRATION_DATABASE_NOT_ISOLATED");
  }
  return { source, schema, applicationName };
}

function captureOutcome<T>(operation: Promise<T>): Promise<OperationOutcome<T>> {
  return operation.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error })
  );
}

function createReleaseGate() {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { release, released };
}

describeIntegration("AI quality consent PostgreSQL serialization", () => {
  let database: PrismaClient;
  let blocker: PrismaClient;
  let observer: PrismaClient;
  let serviceDatabase: PrismaClient;
  let repository: RepositoryModule;
  let schema: string;
  let applicationName: string;
  let advisoryLockKey: bigint;

  beforeAll(async () => {
    const resolved = resolveIsolatedDatabaseUrl();
    schema = resolved.schema;
    applicationName = resolved.applicationName;
    database = new PrismaClient({ datasources: { db: { url: resolved.source } } });
    blocker = new PrismaClient({ datasources: { db: { url: resolved.source } } });
    observer = new PrismaClient({ datasources: { db: { url: resolved.source } } });

    const runtime = await database.$queryRaw<Array<{
      schema: string;
      database: string;
      applicationName: string;
    }>>`
      SELECT
        current_schema() AS schema,
        current_database() AS database,
        current_setting('application_name') AS "applicationName"
    `;
    expect(runtime).toEqual([{
      schema,
      database: DATABASE_NAME,
      applicationName
    }]);

    const lockRows = await database.$queryRaw<Array<{ key: bigint }>>`
      SELECT hashtextextended(${schema}, 0) AS key
    `;
    const lockKey = lockRows[0]?.key;
    if (typeof lockKey !== "bigint") {
      throw new Error("STAGE3_CONSENT_ADVISORY_LOCK_KEY_MISSING");
    }
    advisoryLockKey = lockKey;

    await database.$executeRawUnsafe(`
      CREATE FUNCTION "stage3_pause_feedback_update"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $trigger$
      BEGIN
        PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_SCHEMA, 0));
        RETURN NEW;
      END;
      $trigger$
    `);
    await database.$executeRawUnsafe(`
      CREATE TRIGGER "stage3_pause_feedback_update_trigger"
      BEFORE UPDATE ON "AIFeedback"
      FOR EACH ROW
      EXECUTE FUNCTION "stage3_pause_feedback_update"()
    `);

    repository = await import("@/server/repositories/ai-feedback.repository");
    serviceDatabase = (await import("@/server/db/prisma")).prisma;
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await Promise.allSettled([
      database?.$disconnect(),
      blocker?.$disconnect(),
      observer?.$disconnect(),
      serviceDatabase?.$disconnect()
    ]);
  });

  async function seedScenario(fewShotStatus: AIFewShotStatus): Promise<SeededScenario> {
    const now = new Date();
    const userId = `stage3-user-${randomUUID()}`;
    const username = `stage3_${randomUUID().replaceAll("-", "")}`;
    const user = await database.user.create({
      data: {
        id: userId,
        username,
        passwordHash: "local-integration-only",
        agreedToTermsAt: now,
        agreedToPrivacyAt: now,
        privacyPolicyVersion: "2026-07-19",
        aiQualityConsentVersion: "2026-07-19",
        aiQualityConsentAt: now,
        aiQualityConsentRevokedAt: null
      }
    });
    const session = await database.interviewSession.create({
      data: {
        userId: user.id,
        entryDate: new Date("2026-08-20T00:00:00.000Z"),
        dimension: "joy"
      }
    });
    const targetMessage = await database.interviewMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: "local integration target",
        sequence: 0
      }
    });
    const sourceMessage = await database.interviewMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: "local integration source",
        sequence: 1
      }
    });
    const trace = await database.aIGenerationTrace.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        artifactType: "interview_turn",
        status: "completed",
        outputOrigin: "fallback",
        contextSnapshot: {
          providerAttemptCount: 0,
          actualModelCallExecuted: false
        },
        pipelineDecisions: {
          providerAttemptCount: 0,
          actualModelCallExecuted: false
        },
        finalOutput: { source: "local-integration" },
        feedbackEvaluationPending: true,
        completedAt: now
      }
    });
    const feedback = await database.aIFeedback.create({
      data: {
        traceId: trace.id,
        userId: user.id,
        vote: "downvote",
        tags: ["repetitive_question"],
        comment: "local integration feedback",
        status: "active",
        revision: 1,
        privacyPolicyVersion: "2026-07-19"
      }
    });
    await database.aICase.create({
      data: {
        traceId: trace.id,
        classification: "bad",
        priority: 100,
        sourceSignals: ["assistant_server_guard", "user_downvote"],
        primaryIssueCode: "user_downvote:repetitive_question",
        summary: "local integration case"
      }
    });
    const fewShot = await database.aIFewShotExample.create({
      data: {
        sourceTraceId: trace.id,
        promptKey: "interview.question.local-integration",
        artifactType: "interview_turn",
        inputSnapshot: { source: "local-integration" },
        output: { source: "local-integration" },
        qualityScore: 90,
        status: fewShotStatus,
        promotedAt: fewShotStatus === "active" ? now : null
      }
    });
    const regeneration = await database.aIResponseRegeneration.create({
      data: {
        rootSessionId: session.id,
        branchSessionId: session.id,
        targetMessageId: targetMessage.id,
        sourceMessageId: sourceMessage.id,
        generatedTraceId: trace.id,
        intent: "simplify",
        status: "completed",
        downvotedAt: now,
        completedAt: now
      }
    });
    const run = await database.aIOptimizationRun.create({
      data: {
        periodStart: new Date("2026-08-01T00:00:00.000Z"),
        periodEnd: new Date("2026-09-01T00:00:00.000Z"),
        status: "completed",
        completedAt: now
      }
    });
    const candidates = await Promise.all(
      (["draft", "approved"] as const).map((status) =>
        database.aIOptimizationCandidate.create({
          data: {
            runId: run.id,
            path: "few_shot",
            status,
            artifactType: "interview_turn",
            promptKey: "interview.question.local-integration",
            title: `local integration ${status}`,
            rationale: "local integration only",
            proposal: { sourceTraceIds: [trace.id] },
            evidenceTraceIds: [trace.id]
          }
        })
      )
    );

    return {
      userId: user.id,
      traceId: trace.id,
      feedbackId: feedback.id,
      fewShotId: fewShot.id,
      regenerationId: regeneration.id,
      runId: run.id,
      candidateIds: candidates.map((candidate) => candidate.id)
    };
  }

  async function holdFeedbackUpdateGate() {
    const gate = createReleaseGate();
    let ready!: () => void;
    const acquired = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const transaction = blocker.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT 1::int AS acquired
        FROM pg_advisory_xact_lock(${advisoryLockKey})
      `);
      ready();
      await gate.released;
    }, { timeout: 15_000 });
    await Promise.race([
      acquired,
      transaction.then(
        () => Promise.reject(new Error("STAGE3_CONSENT_GATE_RELEASED_BEFORE_READY")),
        (error: unknown) => Promise.reject(error)
      )
    ]);
    return { release: gate.release, transaction };
  }

  async function waitForBlockedLocks(expected: {
    advisoryWaiting: number;
    rowWaiting: number;
  }) {
    const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
    let latest = { advisoryWaiting: 0, rowWaiting: 0 };
    while (Date.now() < deadline) {
      const rows = await observer.$queryRaw<Array<{
        advisoryWaiting: number;
        rowWaiting: number;
      }>>(Prisma.sql`
        SELECT
          COUNT(*) FILTER (
            WHERE locks.locktype = 'advisory' AND NOT locks.granted
          )::int AS "advisoryWaiting",
          COUNT(*) FILTER (
            WHERE locks.locktype IN ('tuple', 'transactionid') AND NOT locks.granted
          )::int AS "rowWaiting"
        FROM pg_locks AS locks
        JOIN pg_stat_activity AS activity ON activity.pid = locks.pid
        WHERE activity.datname = current_database()
          AND activity.application_name = ${applicationName}
          AND activity.pid <> pg_backend_pid()
      `);
      latest = rows[0] ?? latest;
      if (
        latest.advisoryWaiting >= expected.advisoryWaiting &&
        latest.rowWaiting >= expected.rowWaiting
      ) {
        return latest;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(
      `STAGE3_CONSENT_LOCK_WAIT_TIMEOUT:${latest.advisoryWaiting}:${latest.rowWaiting}`
    );
  }

  async function assertRevokedOutcome(seed: SeededScenario) {
    const [
      user,
      feedback,
      trace,
      regeneration,
      fewShot,
      activeFeedbackCount,
      userSignalCases,
      downvotedRegenerationCount,
      activeFewShotCount,
      candidates,
      requestLogCount
    ] = await Promise.all([
      database.user.findUnique({ where: { id: seed.userId } }),
      database.aIFeedback.findUnique({ where: { id: seed.feedbackId } }),
      database.aIGenerationTrace.findUnique({ where: { id: seed.traceId } }),
      database.aIResponseRegeneration.findUnique({ where: { id: seed.regenerationId } }),
      database.aIFewShotExample.findUnique({ where: { id: seed.fewShotId } }),
      database.aIFeedback.count({ where: { userId: seed.userId, status: "active" } }),
      database.aICase.findMany({
        where: { trace: { is: { userId: seed.userId } } },
        select: { sourceSignals: true, primaryIssueCode: true, summary: true }
      }),
      database.aIResponseRegeneration.count({
        where: { generatedTraceId: seed.traceId, downvotedAt: { not: null } }
      }),
      database.aIFewShotExample.count({
        where: { sourceTraceId: seed.traceId, status: { in: ["candidate", "active"] } }
      }),
      database.aIOptimizationCandidate.findMany({
        where: { id: { in: seed.candidateIds } },
        orderBy: { status: "asc" }
      }),
      database.aIRequestLog.count()
    ]);

    expect(user).toMatchObject({
      aiQualityConsentAt: null,
      aiQualityConsentRevokedAt: expect.any(Date)
    });
    expect(activeFeedbackCount).toBe(0);
    expect(feedback).toMatchObject({
      status: "revoked",
      revokedAt: expect.any(Date)
    });
    expect(trace).toMatchObject({
      feedbackEvaluationPending: false,
      outputOrigin: "fallback",
      contextSnapshot: {
        providerAttemptCount: 0,
        actualModelCallExecuted: false
      },
      pipelineDecisions: {
        providerAttemptCount: 0,
        actualModelCallExecuted: false
      }
    });
    expect(downvotedRegenerationCount).toBe(0);
    expect(regeneration?.downvotedAt).toBeNull();
    expect(activeFewShotCount).toBe(0);
    expect(fewShot).toMatchObject({ status: "retired", retiredAt: expect.any(Date) });
    expect(userSignalCases).toEqual([{
      sourceSignals: ["assistant_server_guard"],
      primaryIssueCode: null,
      summary: "用户已撤回反馈，当前按自动评估结果分类。"
    }]);
    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      expect(candidate).toMatchObject({
        status: "rejected",
        evidenceTraceIds: [],
        reviewedBy: REVIEWED_BY,
        reviewedAt: expect.any(Date),
        reviewReason: REVIEW_REASON
      });
      expect(candidate.evidenceTraceIds).not.toContain(seed.traceId);
    }
    expect(requestLogCount).toBe(0);
  }

  async function cleanupScenario(seed: SeededScenario) {
    await database.aIOptimizationRun.deleteMany({ where: { id: seed.runId } });
    await database.user.deleteMany({ where: { id: seed.userId } });
  }

  it("lets a save holding FOR SHARE finish before a waiting withdrawal", async () => {
    const seed = await seedScenario("active");
    const gate = await holdFeedbackUpdateGate();
    const operations: Array<Promise<unknown>> = [];
    try {
      const saveOutcome = captureOutcome(repository.saveAIResponseFeedback({
        traceId: seed.traceId,
        userId: seed.userId,
        vote: "downvote",
        tags: ["too_abstract"],
        comment: "local integration save first"
      }));
      operations.push(saveOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 0 });

      const withdrawalOutcome = captureOutcome(
        repository.recordAIQualityConsentDecision(seed.userId, false)
      );
      operations.push(withdrawalOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 1 });

      gate.release();
      await expect(saveOutcome).resolves.toMatchObject({ ok: true });
      await expect(withdrawalOutcome).resolves.toMatchObject({ ok: true });
      await gate.transaction;
      await assertRevokedOutcome(seed);
    } finally {
      gate.release();
      await Promise.allSettled(operations);
      await gate.transaction.catch(() => undefined);
      await cleanupScenario(seed);
    }
  }, TEST_TIMEOUT_MS);

  it("lets a withdrawal holding the exclusive lock reject a waiting save", async () => {
    const seed = await seedScenario("candidate");
    const gate = await holdFeedbackUpdateGate();
    const operations: Array<Promise<unknown>> = [];
    try {
      const withdrawalOutcome = captureOutcome(
        repository.recordAIQualityConsentDecision(seed.userId, false)
      );
      operations.push(withdrawalOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 0 });

      const saveOutcome = captureOutcome(repository.saveAIResponseFeedback({
        traceId: seed.traceId,
        userId: seed.userId,
        vote: "upvote",
        tags: [],
        comment: null
      }));
      operations.push(saveOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 1 });

      gate.release();
      await expect(withdrawalOutcome).resolves.toMatchObject({ ok: true });
      const saveResult = await saveOutcome;
      expect(saveResult.ok).toBe(false);
      if (saveResult.ok) throw new Error("STAGE3_CONSENT_SAVE_UNEXPECTEDLY_SUCCEEDED");
      expect(saveResult.error).toBeInstanceOf(repository.AIFeedbackRepositoryError);
      expect(saveResult.error).toMatchObject({ code: "CONSENT_REQUIRED" });
      await gate.transaction;
      await assertRevokedOutcome(seed);
    } finally {
      gate.release();
      await Promise.allSettled(operations);
      await gate.transaction.catch(() => undefined);
      await cleanupScenario(seed);
    }
  }, TEST_TIMEOUT_MS);
});
