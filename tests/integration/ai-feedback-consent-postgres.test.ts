// @vitest-environment node

import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient, type AIFewShotStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const INTEGRATION_ACK = "I_UNDERSTAND";
const INTEGRATION_ENABLED =
  process.env.DAILY_LIGHT_STAGE3_CONSENT_POSTGRES_INTEGRATION === INTEGRATION_ACK;
const describeIntegration = INTEGRATION_ENABLED ? describe.sequential : describe.skip;
const TEST_TIMEOUT_MS = 60_000;
const LOCK_WAIT_TIMEOUT_MS = 8_000;
const SCHEMA_PATTERN = /^daily_light_stage3_consent_[a-f0-9]{12,24}$/u;
const DATABASE_NAME = "daily_light_e2e_validation_20260819";
const REVIEWED_BY = "system:ai_quality_consent_withdrawal";
const REVIEW_REASON = "AI_QUALITY_CONSENT_WITHDRAWN";

type RepositoryModule = typeof import("@/server/repositories/ai-feedback.repository");
type OptimizationRepositoryModule = typeof import("@/server/repositories/ai-optimization.repository");
type ImpactRepositoryModule = typeof import("@/server/repositories/ai-quality-impact.repository");

type SeededScenario = {
  userId: string;
  traceId: string;
  automaticTraceId: string;
  feedbackId: string;
  fewShotId: string;
  regenerationId: string;
  runId: string;
  candidateIds: { draft: string; approved: string };
  historicalCandidateIds: { published: string; rolledBack: string };
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
  let optimizationRepository: OptimizationRepositoryModule;
  let impactRepository: ImpactRepositoryModule;
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
    await database.$executeRawUnsafe(`
      CREATE FUNCTION "stage3_pause_candidate_write"()
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
      CREATE TRIGGER "stage3_pause_candidate_write_trigger"
      BEFORE INSERT OR UPDATE ON "AIOptimizationCandidate"
      FOR EACH ROW
      EXECUTE FUNCTION "stage3_pause_candidate_write"()
    `);
    await database.$executeRawUnsafe(`
      CREATE TRIGGER "stage3_pause_validation_write_trigger"
      BEFORE INSERT OR UPDATE ON "AIOptimizationValidation"
      FOR EACH ROW
      EXECUTE FUNCTION "stage3_pause_candidate_write"()
    `);
    await database.$executeRawUnsafe(`
      CREATE TRIGGER "stage3_pause_admin_audit_write_trigger"
      BEFORE INSERT ON "AdminAuditLog"
      FOR EACH ROW
      EXECUTE FUNCTION "stage3_pause_candidate_write"()
    `);

    repository = await import("@/server/repositories/ai-feedback.repository");
    optimizationRepository = await import("@/server/repositories/ai-optimization.repository");
    impactRepository = await import("@/server/repositories/ai-quality-impact.repository");
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
    const automaticTrace = await database.aIGenerationTrace.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        artifactType: "interview_turn",
        status: "completed",
        outputOrigin: "fallback",
        contextSnapshot: {
          providerAttemptCount: 0,
          actualModelCallExecuted: false,
          source: "automatic-bad-case"
        },
        pipelineDecisions: {
          providerAttemptCount: 0,
          actualModelCallExecuted: false
        },
        finalOutput: { source: "automatic-bad-case" },
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
    await database.aICase.create({
      data: {
        traceId: automaticTrace.id,
        classification: "bad",
        priority: 70,
        sourceSignals: ["assistant_server_guard"],
        primaryIssueCode: "schema_parse_failed",
        summary: "local automatic bad case without feedback"
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
    const draftCandidate = await database.aIOptimizationCandidate.create({
      data: {
        runId: run.id,
        path: "few_shot",
        status: "draft",
        artifactType: "interview_turn",
        promptKey: "interview.question.local-integration",
        title: "local integration draft",
        rationale: "local integration only",
        proposal: { sourceTraceIds: [trace.id, automaticTrace.id] },
        evidenceTraceIds: [trace.id, automaticTrace.id]
      }
    });
    const approvedCandidate = await database.aIOptimizationCandidate.create({
      data: {
        runId: run.id,
        path: "few_shot",
        status: "approved",
        artifactType: "interview_turn",
        promptKey: "interview.question.local-integration",
        title: "local integration approved",
        rationale: "local integration only",
        proposal: { sourceTraceIds: [automaticTrace.id] },
        evidenceTraceIds: [automaticTrace.id]
      }
    });
    const publishedCandidate = await database.aIOptimizationCandidate.create({
      data: {
        runId: run.id,
        path: "system_prompt",
        status: "published",
        artifactType: "interview_turn",
        promptKey: "interview.question.local-integration",
        title: "local integration published history",
        rationale: "local integration only",
        proposal: { instructionPatch: "local" },
        evidenceTraceIds: [trace.id]
      }
    });
    const rolledBackCandidate = await database.aIOptimizationCandidate.create({
      data: {
        runId: run.id,
        path: "system_prompt",
        status: "rolled_back",
        artifactType: "interview_turn",
        promptKey: "interview.question.local-integration",
        title: "local integration rolled-back history",
        rationale: "local integration only",
        proposal: { instructionPatch: "local" },
        evidenceTraceIds: [automaticTrace.id]
      }
    });

    return {
      userId: user.id,
      traceId: trace.id,
      automaticTraceId: automaticTrace.id,
      feedbackId: feedback.id,
      fewShotId: fewShot.id,
      regenerationId: regeneration.id,
      runId: run.id,
      candidateIds: { draft: draftCandidate.id, approved: approvedCandidate.id },
      historicalCandidateIds: {
        published: publishedCandidate.id,
        rolledBack: rolledBackCandidate.id
      }
    };
  }

  async function seedMinimalConsentTrace() {
    const now = new Date();
    const user = await database.user.create({
      data: {
        id: `stage3-minimal-user-${randomUUID()}`,
        username: `stage3_minimal_${randomUUID().replaceAll("-", "")}`,
        passwordHash: "local-integration-only",
        agreedToTermsAt: now,
        agreedToPrivacyAt: now,
        privacyPolicyVersion: "2026-07-19",
        aiQualityConsentVersion: "2026-07-19",
        aiQualityConsentAt: now,
        aiQualityConsentRevokedAt: null
      }
    });
    const trace = await database.aIGenerationTrace.create({
      data: {
        userId: user.id,
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
        finalOutput: { source: "local-minimal-integration" },
        completedAt: now
      }
    });
    return { userId: user.id, traceId: trace.id };
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

  async function assertRevokedOutcome(
    seed: SeededScenario,
    options: { publishedCandidateId?: string } = {}
  ) {
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
      historicalCandidates,
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
        where: { id: { in: Object.values(seed.candidateIds) } },
        orderBy: { status: "asc" }
      }),
      database.aIOptimizationCandidate.findMany({
        where: { id: { in: Object.values(seed.historicalCandidateIds) } },
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
    expect(userSignalCases).toEqual(expect.arrayContaining([
      {
        sourceSignals: ["assistant_server_guard"],
        primaryIssueCode: null,
        summary: "用户已撤回反馈，当前按自动评估结果分类。"
      },
      {
        sourceSignals: ["assistant_server_guard"],
        primaryIssueCode: "schema_parse_failed",
        summary: "local automatic bad case without feedback"
      }
    ]));
    expect(userSignalCases).toHaveLength(2);
    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      if (candidate.id === options.publishedCandidateId) {
        expect(candidate).toMatchObject({
          status: "published",
          evidenceTraceIds: [seed.automaticTraceId]
        });
        continue;
      }
      expect(candidate).toMatchObject({
        status: "rejected",
        evidenceTraceIds: [],
        reviewedBy: REVIEWED_BY,
        reviewedAt: expect.any(Date),
        reviewReason: REVIEW_REASON
      });
      expect(candidate.evidenceTraceIds).not.toContain(seed.traceId);
      expect(candidate.evidenceTraceIds).not.toContain(seed.automaticTraceId);
    }
    expect(historicalCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: seed.historicalCandidateIds.published,
        status: "published",
        evidenceTraceIds: [seed.traceId]
      }),
      expect.objectContaining({
        id: seed.historicalCandidateIds.rolledBack,
        status: "rolled_back",
        evidenceTraceIds: [seed.automaticTraceId]
      })
    ]));
    expect(requestLogCount).toBe(0);
  }

  async function cleanupScenario(seed: SeededScenario) {
    await database.aIOptimizationRun.deleteMany({ where: { id: seed.runId } });
    await database.user.deleteMany({ where: { id: seed.userId } });
  }

  type CandidateOperation = "create" | "approve" | "publish" | "validate";

  async function prepareCandidateOperation(operation: CandidateOperation, seed: SeededScenario) {
    if (operation !== "publish") return;
    await database.aIOptimizationValidation.create({
      data: {
        candidateId: seed.candidateIds.approved,
        status: "passed",
        rubricVersion: "local-integration-rubric",
        targetCaseCount: 1,
        targetPassedCount: 1,
        results: [],
        completedAt: new Date(),
        createdBy: "local-integration"
      }
    });
  }

  function startCandidateOperation(
    operation: CandidateOperation,
    seed: SeededScenario
  ): Promise<unknown> {
    if (operation === "create") {
      return optimizationRepository.createClusterAndCandidate({
        dedupeKey: `stage3-create-${seed.userId}`,
        runId: seed.runId,
        artifactType: "interview_turn",
        dimension: "joy",
        issueCode: "schema_parse_failed",
        caseCount: 1,
        traceIds: [seed.automaticTraceId],
        summary: "local integration automatic bad case",
        path: "engineering",
        promptKey: null,
        title: "local integration create",
        rationale: "local integration only",
        proposal: {},
        riskLevel: "medium"
      });
    }
    if (operation === "approve") {
      return optimizationRepository.reviewOptimizationCandidateStatus({
        id: seed.candidateIds.draft,
        expectedStatus: "draft",
        status: "approved",
        adminUsername: "local-integration"
      });
    }
    if (operation === "publish") {
      return optimizationRepository.publishOptimizationCandidate(
        seed.candidateIds.approved,
        "local-integration"
      );
    }
    return optimizationRepository.loadOptimizationValidationInput({
      candidateId: seed.candidateIds.draft,
      rubricVersion: "local-integration-rubric",
      adminUsername: "local-integration"
    });
  }

  async function assertOperationFirstOutcome(
    operation: CandidateOperation,
    seed: SeededScenario,
    operationValue: unknown
  ) {
    if (operation === "create") {
      const created = await database.aIOptimizationCandidate.findUnique({
        where: { dedupeKey: `stage3-create-${seed.userId}` }
      });
      expect(created).toMatchObject({
        status: "rejected",
        evidenceTraceIds: [],
        reviewedBy: REVIEWED_BY,
        reviewReason: REVIEW_REASON
      });
      return;
    }
    if (operation === "publish") {
      expect(operationValue).toMatchObject({ candidateId: seed.candidateIds.approved });
      const candidate = await database.aIOptimizationCandidate.findUnique({
        where: { id: seed.candidateIds.approved }
      });
      expect(candidate).toMatchObject({
        status: "published",
        evidenceTraceIds: [seed.automaticTraceId]
      });
      return;
    }
    if (operation === "validate") {
      const started = operationValue as Awaited<ReturnType<OptimizationRepositoryModule["loadOptimizationValidationInput"]>>;
      expect(started).toMatchObject({
        validation: { status: "running" },
        expectedStatus: "draft"
      });
      if (!started) throw new Error("STAGE3_VALIDATION_START_MISSING");
      await expect(optimizationRepository.completeOptimizationValidation({
        validationId: started.validation.id,
        candidateId: started.candidate.id,
        expectedCandidateStatus: started.expectedStatus,
        consentTraceIds: started.consentTraceIds,
        status: "passed",
        targetCaseCount: started.targetTraces.length,
        targetPassedCount: started.targetTraces.length,
        regressionCaseCount: started.regressionTraces.length,
        regressionPassedCount: started.regressionTraces.length,
        criticalRegressionCount: 0,
        averageScoreDelta: 0,
        summary: "local integration",
        results: []
      })).rejects.toThrow("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
      return;
    }
    const candidate = await database.aIOptimizationCandidate.findUnique({
      where: { id: seed.candidateIds.draft }
    });
    expect(candidate).toMatchObject({
      status: "rejected",
      reviewedBy: REVIEWED_BY,
      reviewReason: REVIEW_REASON
    });
  }

  it("serializes create, approve, publish, and validation before a waiting withdrawal", async () => {
    for (const operation of ["create", "approve", "publish", "validate"] as const) {
      const seed = await seedScenario("active");
      await prepareCandidateOperation(operation, seed);
      const gate = await holdFeedbackUpdateGate();
      const operations: Array<Promise<unknown>> = [];
      try {
        const candidateOutcome = captureOutcome(startCandidateOperation(operation, seed));
        operations.push(candidateOutcome);
        await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 0 });

        const withdrawalOutcome = captureOutcome(
          repository.recordAIQualityConsentDecision(seed.userId, false)
        );
        operations.push(withdrawalOutcome);
        await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 1 });

        gate.release();
        const candidateResult = await candidateOutcome;
        expect(candidateResult.ok).toBe(true);
        if (!candidateResult.ok) throw candidateResult.error;
        await expect(withdrawalOutcome).resolves.toMatchObject({ ok: true });
        await gate.transaction;
        await assertRevokedOutcome(seed, {
          ...(operation === "publish" ? { publishedCandidateId: seed.candidateIds.approved } : {})
        });
        await assertOperationFirstOutcome(operation, seed, candidateResult.value);
      } finally {
        gate.release();
        await Promise.allSettled(operations);
        await gate.transaction.catch(() => undefined);
        await cleanupScenario(seed);
      }
    }
  }, TEST_TIMEOUT_MS);

  it("lets withdrawal reject waiting create, approve, publish, and validation operations", async () => {
    for (const operation of ["create", "approve", "publish", "validate"] as const) {
      const seed = await seedScenario("candidate");
      await prepareCandidateOperation(operation, seed);
      const gate = await holdFeedbackUpdateGate();
      const operations: Array<Promise<unknown>> = [];
      try {
        const withdrawalOutcome = captureOutcome(
          repository.recordAIQualityConsentDecision(seed.userId, false)
        );
        operations.push(withdrawalOutcome);
        await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 0 });

        const candidateOutcome = captureOutcome(startCandidateOperation(operation, seed));
        operations.push(candidateOutcome);
        await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 1 });

        gate.release();
        await expect(withdrawalOutcome).resolves.toMatchObject({ ok: true });
        const candidateResult = await candidateOutcome;
        expect(candidateResult.ok).toBe(false);
        if (candidateResult.ok) throw new Error("STAGE3_WITHDRAWAL_OPERATION_UNEXPECTEDLY_SUCCEEDED");
        expect(candidateResult.error).toBeInstanceOf(Error);
        expect((candidateResult.error as Error).message).toMatch(
          /OPTIMIZATION_(?:EVIDENCE_CONSENT_REQUIRED|CANDIDATE_(?:NOT_(?:DRAFT|APPROVED|REVIEWABLE|VALIDATABLE)|STATE_CHANGED))/u
        );
        await gate.transaction;
        await assertRevokedOutcome(seed);

        if (operation === "create") {
          await expect(database.aIOptimizationCandidate.findUnique({
            where: { dedupeKey: `stage3-create-${seed.userId}` }
          })).resolves.toBeNull();
        }
        if (operation === "publish") {
          await expect(database.aIPromptRelease.count({
            where: { candidateId: seed.candidateIds.approved }
          })).resolves.toBe(0);
        }
        if (operation === "validate") {
          await expect(database.aIOptimizationValidation.count({
            where: { candidateId: seed.candidateIds.draft }
          })).resolves.toBe(0);
        }
      } finally {
        gate.release();
        await Promise.allSettled(operations);
        await gate.transaction.catch(() => undefined);
        await cleanupScenario(seed);
      }
    }
  }, TEST_TIMEOUT_MS);

  it("keeps an active few-shot example unchanged when a new draft reuses its source trace", async () => {
    const seed = await seedScenario("active");
    try {
      const before = await database.aIFewShotExample.findUniqueOrThrow({
        where: { id: seed.fewShotId }
      });

      await expect(optimizationRepository.createFewShotCandidate({
        dedupeKey: `stage3-few-shot-reuse-${seed.userId}`,
        runId: seed.runId,
        promptKey: "interview.question.local-integration",
        artifactType: "interview_turn",
        dimension: "joy",
        traces: [{
          id: seed.traceId,
          contextSnapshot: { source: "new-draft-must-not-rewrite" },
          finalOutput: { source: "new-draft-must-not-rewrite" },
          evaluation: { totalScore: 99 }
        }]
      })).rejects.toThrow("OPTIMIZATION_FEW_SHOT_SOURCE_ALREADY_BOUND");

      const after = await database.aIFewShotExample.findUniqueOrThrow({
        where: { id: seed.fewShotId }
      });
      expect(after).toMatchObject({
        candidateId: before.candidateId,
        status: "active",
        inputSnapshot: before.inputSnapshot,
        output: before.output,
        qualityScore: before.qualityScore,
        promotedAt: before.promotedAt
      });
      await expect(database.aIOptimizationCandidate.findUnique({
        where: { dedupeKey: `stage3-few-shot-reuse-${seed.userId}` }
      })).resolves.toBeNull();
      await expect(database.aIRequestLog.count()).resolves.toBe(0);
    } finally {
      await cleanupScenario(seed);
    }
  }, TEST_TIMEOUT_MS);

  it("serializes concurrent validation starts and creates exactly one running validation", async () => {
    const seed = await seedScenario("candidate");
    const gate = await holdFeedbackUpdateGate();
    const operations: Array<Promise<unknown>> = [];
    try {
      const firstOutcome = captureOutcome(optimizationRepository.loadOptimizationValidationInput({
        candidateId: seed.candidateIds.draft,
        rubricVersion: "local-integration-rubric",
        adminUsername: "local-integration-first"
      }));
      operations.push(firstOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 0 });

      const secondOutcome = captureOutcome(optimizationRepository.loadOptimizationValidationInput({
        candidateId: seed.candidateIds.draft,
        rubricVersion: "local-integration-rubric",
        adminUsername: "local-integration-second"
      }));
      operations.push(secondOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 1 });

      gate.release();
      const firstResult = await firstOutcome;
      expect(firstResult.ok).toBe(true);
      const secondResult = await secondOutcome;
      expect(secondResult.ok).toBe(false);
      if (secondResult.ok) throw new Error("STAGE3_DUPLICATE_VALIDATION_UNEXPECTEDLY_STARTED");
      expect(secondResult.error).toBeInstanceOf(Error);
      expect((secondResult.error as Error).message).toBe("OPTIMIZATION_VALIDATION_ALREADY_RUNNING");
      await gate.transaction;

      await expect(database.aIOptimizationValidation.count({
        where: { candidateId: seed.candidateIds.draft, status: "running" }
      })).resolves.toBe(1);
      await expect(database.aIRequestLog.count()).resolves.toBe(0);
    } finally {
      gate.release();
      await Promise.allSettled(operations);
      await gate.transaction.catch(() => undefined);
      await cleanupScenario(seed);
    }
  }, TEST_TIMEOUT_MS);

  it("uses one stable multi-user lock order while two source users withdraw", async () => {
    const left = await seedScenario("candidate");
    const right = await seedScenario("candidate");
    const gate = await holdFeedbackUpdateGate();
    const operations: Array<Promise<unknown>> = [];
    const dedupeKey = `stage3-multi-user-${randomUUID()}`;
    try {
      const reverseUserOrderTraceIds = [
        { userId: left.userId, traceId: left.automaticTraceId },
        { userId: right.userId, traceId: right.automaticTraceId }
      ]
        .sort((first, second) => second.userId.localeCompare(first.userId))
        .map((item) => item.traceId);
      const createOutcome = captureOutcome(optimizationRepository.createClusterAndCandidate({
        dedupeKey,
        runId: left.runId,
        artifactType: "interview_turn",
        dimension: "joy",
        issueCode: "schema_parse_failed",
        caseCount: 2,
        traceIds: reverseUserOrderTraceIds,
        summary: "local integration multi-user evidence",
        path: "engineering",
        promptKey: null,
        title: "local integration multi-user create",
        rationale: "local integration only",
        proposal: {},
        riskLevel: "medium"
      }));
      operations.push(createOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 0 });

      const leftWithdrawal = captureOutcome(
        repository.recordAIQualityConsentDecision(left.userId, false)
      );
      const rightWithdrawal = captureOutcome(
        repository.recordAIQualityConsentDecision(right.userId, false)
      );
      operations.push(leftWithdrawal, rightWithdrawal);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 2 });

      gate.release();
      await expect(createOutcome).resolves.toMatchObject({ ok: true });
      await expect(leftWithdrawal).resolves.toMatchObject({ ok: true });
      await expect(rightWithdrawal).resolves.toMatchObject({ ok: true });
      await gate.transaction;

      await expect(database.aIOptimizationCandidate.findUnique({ where: { dedupeKey } })).resolves.toMatchObject({
        status: "rejected",
        evidenceTraceIds: [],
        reviewedBy: REVIEWED_BY,
        reviewReason: REVIEW_REASON
      });
      await assertRevokedOutcome(left);
      await assertRevokedOutcome(right);
    } finally {
      gate.release();
      await Promise.allSettled(operations);
      await gate.transaction.catch(() => undefined);
      await cleanupScenario(left);
      await cleanupScenario(right);
    }
  }, TEST_TIMEOUT_MS);

  it("serializes shared-candidate updates when both withdrawals reach the original evidence set", async () => {
    const left = await seedMinimalConsentTrace();
    const right = await seedMinimalConsentTrace();
    const run = await database.aIOptimizationRun.create({
      data: {
        periodStart: new Date("2026-08-01T00:00:00.000Z"),
        periodEnd: new Date("2026-09-01T00:00:00.000Z"),
        status: "completed",
        completedAt: new Date()
      }
    });
    const candidate = await database.aIOptimizationCandidate.create({
      data: {
        runId: run.id,
        path: "engineering",
        status: "draft",
        artifactType: "interview_turn",
        title: "shared candidate stale-read guard",
        rationale: "local integration only",
        proposal: {},
        evidenceTraceIds: [left.traceId, right.traceId]
      }
    });
    const gate = await holdFeedbackUpdateGate();
    const operations: Array<Promise<unknown>> = [];
    try {
      const leftWithdrawal = captureOutcome(
        repository.recordAIQualityConsentDecision(left.userId, false)
      );
      const rightWithdrawal = captureOutcome(
        repository.recordAIQualityConsentDecision(right.userId, false)
      );
      operations.push(leftWithdrawal, rightWithdrawal);

      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 1 });
      gate.release();
      await expect(leftWithdrawal).resolves.toMatchObject({ ok: true });
      await expect(rightWithdrawal).resolves.toMatchObject({ ok: true });
      await gate.transaction;

      await expect(database.aIOptimizationCandidate.findUnique({
        where: { id: candidate.id }
      })).resolves.toMatchObject({
        status: "rejected",
        evidenceTraceIds: [],
        reviewedBy: REVIEWED_BY,
        reviewReason: REVIEW_REASON
      });
      await expect(database.aIRequestLog.count()).resolves.toBe(0);
    } finally {
      gate.release();
      await Promise.allSettled(operations);
      await gate.transaction.catch(() => undefined);
      await database.aIOptimizationRun.deleteMany({ where: { id: run.id } });
      await database.user.deleteMany({ where: { id: { in: [left.userId, right.userId] } } });
    }
  }, TEST_TIMEOUT_MS);

  it("keeps validation dispatch inside the consent lease until withdrawal can finish", async () => {
    const seed = await seedScenario("candidate");
    const dispatchGate = createReleaseGate();
    let markDispatchStarted!: () => void;
    const dispatchStarted = new Promise<void>((resolve) => {
      markDispatchStarted = resolve;
    });
    let leaseResolvedAt: number | null = null;
    let withdrawalResolvedAt: number | null = null;
    const operations: Array<Promise<unknown>> = [];
    try {
      const leaseOutcome = captureOutcome(
        optimizationRepository.runOptimizationValidationWithConsentLease({
          candidateId: seed.candidateIds.draft,
          rubricVersion: "local-integration-rubric",
          adminUsername: "local-integration"
        }, async (validationInput) => {
          markDispatchStarted();
          await dispatchGate.released;
          return {
            status: "passed",
            targetCaseCount: validationInput.targetTraces.length,
            targetPassedCount: validationInput.targetTraces.length,
            regressionCaseCount: validationInput.regressionTraces.length,
            regressionPassedCount: validationInput.regressionTraces.length,
            criticalRegressionCount: 0,
            averageScoreDelta: 0,
            summary: "local integration dispatch lease",
            results: []
          };
        })
      ).then((result) => {
        leaseResolvedAt = Date.now();
        return result;
      });
      operations.push(leaseOutcome);
      await dispatchStarted;

      const withdrawalOutcome = captureOutcome(
        repository.recordAIQualityConsentDecision(seed.userId, false)
      ).then((result) => {
        withdrawalResolvedAt = Date.now();
        return result;
      });
      operations.push(withdrawalOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 0, rowWaiting: 1 });
      expect(withdrawalResolvedAt).toBeNull();

      dispatchGate.release();
      await expect(leaseOutcome).resolves.toMatchObject({
        ok: true,
        value: { status: "passed" }
      });
      await expect(withdrawalOutcome).resolves.toMatchObject({ ok: true });
      expect(leaseResolvedAt).not.toBeNull();
      expect(withdrawalResolvedAt).not.toBeNull();
      expect(withdrawalResolvedAt!).toBeGreaterThanOrEqual(leaseResolvedAt!);
      await assertRevokedOutcome(seed);
      await expect(database.aIOptimizationValidation.findFirst({
        where: { candidateId: seed.candidateIds.draft },
        orderBy: { startedAt: "desc" }
      })).resolves.toMatchObject({ status: "passed" });
    } finally {
      dispatchGate.release();
      await Promise.allSettled(operations);
      await cleanupScenario(seed);
    }
  }, TEST_TIMEOUT_MS);

  it("records one validation provider failure and never retries the dispatch callback", async () => {
    const seed = await seedScenario("candidate");
    let dispatchCount = 0;
    try {
      await expect(optimizationRepository.runOptimizationValidationWithConsentLease({
        candidateId: seed.candidateIds.draft,
        rubricVersion: "local-integration-rubric",
        adminUsername: "local-integration"
      }, async () => {
        dispatchCount += 1;
        throw new Error("VALIDATION_PROVIDER_UNAVAILABLE");
      })).rejects.toThrow("VALIDATION_PROVIDER_UNAVAILABLE");

      expect(dispatchCount).toBe(1);
      await expect(database.aIOptimizationValidation.findFirst({
        where: { candidateId: seed.candidateIds.draft },
        orderBy: { startedAt: "desc" }
      })).resolves.toMatchObject({
        status: "error",
        errorCode: "VALIDATION_PROVIDER_UNAVAILABLE"
      });
      await expect(database.aIRequestLog.count()).resolves.toBe(0);
    } finally {
      await cleanupScenario(seed);
    }
  }, TEST_TIMEOUT_MS);

  it("keeps active few-shot content inside one dispatch lease and removes it after withdrawal", async () => {
    const seed = await seedScenario("active");
    const dispatchGate = createReleaseGate();
    let markDispatchStarted!: () => void;
    const dispatchStarted = new Promise<void>((resolve) => {
      markDispatchStarted = resolve;
    });
    let withdrawalResolved = false;
    const operations: Array<Promise<unknown>> = [];
    try {
      const dispatchOutcome = captureOutcome(
        optimizationRepository.runWithActivePromptOptimizationConsentLease(
          "interview.question.local-integration",
          async (optimization) => {
            expect(optimization.fewShotExamples).toEqual([
              expect.objectContaining({
                id: seed.fewShotId,
                inputSnapshot: { source: "local-integration" },
                output: { source: "local-integration" }
              })
            ]);
            markDispatchStarted();
            await dispatchGate.released;
            return "provider-dispatched-once";
          }
        )
      );
      operations.push(dispatchOutcome);
      await dispatchStarted;

      const withdrawalOutcome = captureOutcome(
        repository.recordAIQualityConsentDecision(seed.userId, false)
      ).then((result) => {
        withdrawalResolved = true;
        return result;
      });
      operations.push(withdrawalOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 0, rowWaiting: 1 });
      expect(withdrawalResolved).toBe(false);

      dispatchGate.release();
      await expect(dispatchOutcome).resolves.toEqual({
        ok: true,
        value: "provider-dispatched-once"
      });
      await expect(withdrawalOutcome).resolves.toMatchObject({ ok: true });
      await assertRevokedOutcome(seed);

      let postWithdrawalExamples: unknown[] | null = null;
      await optimizationRepository.runWithActivePromptOptimizationConsentLease(
        "interview.question.local-integration",
        async (optimization) => {
          postWithdrawalExamples = optimization.fewShotExamples;
          return null;
        }
      );
      expect(postWithdrawalExamples).toEqual([]);
      await expect(database.aIRequestLog.count()).resolves.toBe(0);
    } finally {
      dispatchGate.release();
      await Promise.allSettled(operations);
      await cleanupScenario(seed);
    }
  }, TEST_TIMEOUT_MS);

  it("serializes impact-evidence content, audit and withdrawal with zero visible request-log fixtures", async () => {
    const seed = await seedScenario("candidate");
    const gate = await holdFeedbackUpdateGate();
    const operations: Array<Promise<unknown>> = [];
    const promptKey = "interview.question.local-integration";
    const versionMarker = "+opt:impact-consent";
    const impactInput = {
      candidateId: seed.candidateIds.draft,
      adminUsername: "local-integration",
      promptKey,
      start: new Date(Date.now() - 86_400_000),
      end: new Date(Date.now() + 86_400_000),
      versionMarker,
      kind: "attention" as const,
      page: 1,
      pageSize: 5
    };
    try {
      const readOutcome = captureOutcome(database.$transaction(async (tx) => {
        const requestLog = await tx.aIRequestLog.create({
          data: {
            traceId: seed.automaticTraceId,
            stage: "question",
            provider: "local-uncommitted-fixture",
            promptKey,
            promptVersion: `v1${versionMarker}`,
            success: true
          }
        });
        const result = await impactRepository.findAIQualityImpactEvidencePageWithinTransaction(
          tx,
          impactInput
        );
        await tx.aIRequestLog.delete({ where: { id: requestLog.id } });
        return result;
      }));
      operations.push(readOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 0 });

      const withdrawalOutcome = captureOutcome(
        repository.recordAIQualityConsentDecision(seed.userId, false)
      );
      operations.push(withdrawalOutcome);
      await waitForBlockedLocks({ advisoryWaiting: 1, rowWaiting: 1 });

      gate.release();
      await expect(readOutcome).resolves.toMatchObject({
        ok: true,
        value: {
          total: 1,
          traces: [{ id: seed.automaticTraceId }]
        }
      });
      await expect(withdrawalOutcome).resolves.toMatchObject({ ok: true });
      await gate.transaction;
      await expect(database.adminAuditLog.count({
        where: {
          adminUsername: "local-integration",
          resourceType: "ai_quality_impact_evidence",
          resourceId: seed.automaticTraceId,
          action: "view_content"
        }
      })).resolves.toBe(1);

      const auditCountBefore = await database.adminAuditLog.count();
      const afterWithdrawal = await database.$transaction(async (tx) => {
        const requestLog = await tx.aIRequestLog.create({
          data: {
            traceId: seed.automaticTraceId,
            stage: "question",
            provider: "local-uncommitted-fixture",
            promptKey,
            promptVersion: `v1${versionMarker}`,
            success: true
          }
        });
        const result = await impactRepository.findAIQualityImpactEvidencePageWithinTransaction(
          tx,
          impactInput
        );
        await tx.aIRequestLog.delete({ where: { id: requestLog.id } });
        return result;
      });
      expect(afterWithdrawal).toMatchObject({ total: 0, traces: [] });
      await expect(database.adminAuditLog.count()).resolves.toBe(auditCountBefore);
      await expect(database.aIRequestLog.count()).resolves.toBe(0);
    } finally {
      gate.release();
      await Promise.allSettled(operations);
      await gate.transaction.catch(() => undefined);
      await cleanupScenario(seed);
    }
  }, TEST_TIMEOUT_MS);

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
