import {
  Prisma,
  type AIGenerationArtifactType,
  type AIOptimizationPath,
  type AIOptimizationStatus
} from "@prisma/client";

import { CURRENT_PRIVACY_POLICY_VERSION } from "@/features/ai-feedback/feedback-config";
import { prisma } from "@/server/db/prisma";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export const CURRENT_CONSENT_USER_FILTER = {
  aiQualityConsentVersion: CURRENT_PRIVACY_POLICY_VERSION,
  aiQualityConsentAt: { not: null },
  aiQualityConsentRevokedAt: null
} as const;

export const CURRENT_CONSENT_TRACE_FILTER = {
  user: { is: CURRENT_CONSENT_USER_FILTER }
} as const;

type CandidateMutableStatus = Extract<AIOptimizationStatus, "draft" | "approved">;

const OPTIMIZATION_VALIDATION_METADATA_SELECT = {
  id: true,
  status: true,
  targetCaseCount: true,
  targetPassedCount: true,
  regressionCaseCount: true,
  regressionPassedCount: true,
  criticalRegressionCount: true,
  averageScoreDelta: true,
  summary: true,
  errorCode: true,
  startedAt: true,
  completedAt: true
} as const;

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function sameStringSet(left: string[], right: string[]) {
  const leftSorted = uniqueSorted(left);
  const rightSorted = uniqueSorted(right);
  return leftSorted.length === rightSorted.length
    && leftSorted.every((value, index) => value === rightSorted[index]);
}

export async function lockCurrentConsentForTraceIds(
  tx: Prisma.TransactionClient,
  traceIds: string[]
) {
  const orderedTraceIds = uniqueSorted(traceIds);
  if (orderedTraceIds.length === 0) {
    throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  }

  // First gate: only currently consented trace owners may reach the lock step.
  const traceOwners = await tx.aIGenerationTrace.findMany({
    where: {
      id: { in: orderedTraceIds },
      ...CURRENT_CONSENT_TRACE_FILTER
    },
    select: { id: true, userId: true }
  });
  if (traceOwners.length !== orderedTraceIds.length) {
    throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  }

  const orderedUserIds = uniqueSorted(traceOwners.map((trace) => trace.userId));
  const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE "id" IN (${Prisma.join(orderedUserIds)})
    ORDER BY "id" ASC
    FOR SHARE
  `);
  if (lockedUsers.length !== orderedUserIds.length) {
    throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  }

  // Second gate: re-read consent while every related User row is share-locked.
  const currentUsers = await tx.user.findMany({
    where: {
      id: { in: orderedUserIds },
      ...CURRENT_CONSENT_USER_FILTER
    },
    select: { id: true }
  });
  if (currentUsers.length !== orderedUserIds.length) {
    throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  }

  return {
    traceOwners,
    traceIds: orderedTraceIds,
    userIds: orderedUserIds
  };
}

async function lockCandidateAtExpectedStatus(
  tx: Prisma.TransactionClient,
  candidateId: string,
  expectedStatuses: AIOptimizationStatus[],
  errorCode: string
) {
  const lockedRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "AIOptimizationCandidate"
    WHERE "id" = ${candidateId}
      AND "status"::text IN (${Prisma.join(expectedStatuses)})
    FOR UPDATE
  `);
  if (lockedRows.length !== 1) throw new Error(errorCode);
}

export const AI_QUALITY_EVIDENCE_INCLUDE = Prisma.validator<Prisma.AIGenerationTraceInclude>()({
  feedback: true,
  evaluation: true,
  case: true,
  interviewMessage: { select: { id: true, sequence: true } },
  session: {
    select: {
      entryDate: true,
      messages: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          generationTraceId: true,
          role: true,
          content: true,
          sequence: true,
          createdAt: true
        }
      }
    }
  }
});

export type AIQualityEvidenceTrace = Prisma.AIGenerationTraceGetPayload<{
  include: typeof AI_QUALITY_EVIDENCE_INCLUDE;
}>;

export function createOptimizationRun(periodStart: Date, periodEnd: Date) {
  return prisma.aIOptimizationRun.create({ data: { periodStart, periodEnd } });
}

export async function loadOptimizationEvidence(periodStart: Date, periodEnd: Date) {
  const [badCases, goodTraces] = await Promise.all([
    prisma.aICase.findMany({
      where: {
        classification: { in: ["bad", "review"] },
        updatedAt: { gte: periodStart, lt: periodEnd },
        trace: {
          is: {
            user: {
              is: {
                aiQualityConsentVersion: CURRENT_PRIVACY_POLICY_VERSION,
                aiQualityConsentAt: { not: null },
                aiQualityConsentRevokedAt: null
              }
            }
          }
        }
      },
      include: {
        trace: {
          select: { id: true, artifactType: true, dimension: true }
        }
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.aIGenerationTrace.findMany({
      where: {
        status: "completed",
        outputOrigin: "llm",
        createdAt: { gte: periodStart, lt: periodEnd },
        feedback: { is: { status: "active", vote: "upvote" } },
        evaluation: { is: { totalScore: { gte: 85 } } },
        fewShotExample: null,
        user: {
          is: {
            aiQualityConsentVersion: CURRENT_PRIVACY_POLICY_VERSION,
            aiQualityConsentAt: { not: null },
            aiQualityConsentRevokedAt: null
          }
        }
      },
      include: {
        evaluation: { select: { totalScore: true } },
        invocations: {
          where: { success: true, stage: { in: ["question", "generate"] } },
          select: { promptKey: true },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    })
  ]);

  return { badCases, goodTraces };
}

export async function createClusterAndCandidate(input: {
  dedupeKey: string;
  runId: string;
  artifactType: AIGenerationArtifactType;
  dimension: "joy" | "fulfillment" | "reflection" | "improvement" | "gratitude" | null;
  issueCode: string;
  caseCount: number;
  traceIds: string[];
  summary: string;
  path: AIOptimizationPath;
  promptKey: string | null;
  title: string;
  rationale: string;
  proposal: unknown;
  riskLevel: string;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const traceIds = uniqueSorted(input.traceIds);
      await lockCurrentConsentForTraceIds(tx, traceIds);
      const existing = await tx.aIOptimizationCandidate.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return { candidate: existing, created: false as const };

      const cluster = await tx.aIBadcaseCluster.create({
        data: {
          runId: input.runId,
          artifactType: input.artifactType,
          dimension: input.dimension,
          issueCode: input.issueCode,
          caseCount: input.caseCount,
          traceIds,
          summary: input.summary,
          suggestedPath: input.path
        }
      });
      const candidate = await tx.aIOptimizationCandidate.create({
        data: {
          dedupeKey: input.dedupeKey,
          runId: input.runId,
          clusterId: cluster.id,
          path: input.path,
          artifactType: input.artifactType,
          dimension: input.dimension,
          promptKey: input.promptKey,
          title: input.title,
          rationale: input.rationale,
          proposal: toJson(input.proposal),
          evidenceTraceIds: traceIds,
          riskLevel: input.riskLevel
        }
      });
      return { candidate, created: true as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.aIOptimizationCandidate.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return { candidate: existing, created: false as const };
    }
    throw error;
  }
}

export async function createFewShotCandidate(input: {
  dedupeKey: string;
  runId: string;
  promptKey: string;
  artifactType: AIGenerationArtifactType;
  dimension: "joy" | "fulfillment" | "reflection" | "improvement" | "gratitude" | null;
  traces: Array<{
    id: string;
    contextSnapshot: unknown;
    finalOutput: unknown;
    evaluation: { totalScore: number } | null;
  }>;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const traceById = new Map(input.traces.map((trace) => [trace.id, trace]));
      const traceIds = uniqueSorted(Array.from(traceById.keys()));
      await lockCurrentConsentForTraceIds(tx, traceIds);
      const existing = await tx.aIOptimizationCandidate.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return { candidate: existing, created: false as const };

      const alreadyBoundExamples = await tx.aIFewShotExample.findMany({
        where: { sourceTraceId: { in: traceIds } },
        select: { sourceTraceId: true }
      });
      if (alreadyBoundExamples.length > 0) {
        throw new Error("OPTIMIZATION_FEW_SHOT_SOURCE_ALREADY_BOUND");
      }

      const candidate = await tx.aIOptimizationCandidate.create({
        data: {
          dedupeKey: input.dedupeKey,
          runId: input.runId,
          path: "few_shot",
          artifactType: input.artifactType,
          dimension: input.dimension,
          promptKey: input.promptKey,
          title: `Few-shot 更新：${input.promptKey}`,
          rationale: `${traceIds.length} 条获得点赞且自动评分不低于 85 分的回复可进入动态示例库。`,
          proposal: toJson({ sourceTraceIds: traceIds, maxActiveExamples: 6 }),
          evidenceTraceIds: traceIds,
          riskLevel: "medium"
        }
      });

      for (const traceId of traceIds) {
        const trace = traceById.get(traceId);
        if (!trace) throw new Error("OPTIMIZATION_FEW_SHOT_SOURCE_MISSING");
        await tx.aIFewShotExample.create({
          data: {
            sourceTraceId: trace.id,
            candidateId: candidate.id,
            promptKey: input.promptKey,
            artifactType: input.artifactType,
            dimension: input.dimension,
            inputSnapshot: toJson(compactFewShotContext(trace.contextSnapshot)),
            output: toJson(trace.finalOutput),
            qualityScore: trace.evaluation?.totalScore ?? 85
          }
        });
      }

      return { candidate, created: true as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.aIOptimizationCandidate.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return { candidate: existing, created: false as const };
    }
    throw error;
  }
}

function compactFewShotContext(value: unknown) {
  const context = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const messages = Array.isArray(context.messages) ? context.messages.slice(-6) : [];
  const events = Array.isArray(context.events) ? context.events.slice(-3) : [];
  return {
    action: context.action ?? null,
    stage: context.stage ?? null,
    userMessage: context.userMessage ?? null,
    snapshot: context.snapshot ?? null,
    messages,
    events
  };
}

export function completeOptimizationRun(input: {
  runId: string;
  scannedBad: number;
  scannedGood: number;
  clusterCount: number;
  candidateCount: number;
  summary: string;
}) {
  return prisma.aIOptimizationRun.update({
    where: { id: input.runId },
    data: {
      status: "completed",
      scannedBad: input.scannedBad,
      scannedGood: input.scannedGood,
      clusterCount: input.clusterCount,
      candidateCount: input.candidateCount,
      summary: input.summary,
      completedAt: new Date()
    }
  });
}

export function failOptimizationRun(runId: string, errorCode: string) {
  return prisma.aIOptimizationRun.update({
    where: { id: runId },
    data: { status: "failed", errorCode, completedAt: new Date() }
  });
}

export function listOptimizationCandidates(status?: "draft" | "approved" | "published" | "rejected" | "rolled_back") {
  return prisma.aIOptimizationCandidate.findMany({
    where: status ? { status } : undefined,
    include: {
      cluster: { select: { issueCode: true, caseCount: true } },
      releases: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          status: true,
          version: true,
          publishedAt: true,
          rolledBackAt: true
        }
      },
      fewShotExamples: {
        select: {
          id: true,
          status: true,
          qualityScore: true,
          promotedAt: true,
          retiredAt: true,
          createdAt: true,
          updatedAt: true
        }
      },
      validations: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          targetCaseCount: true,
          targetPassedCount: true,
          regressionCaseCount: true,
          regressionPassedCount: true,
          criticalRegressionCount: true,
          averageScoreDelta: true,
          summary: true,
          errorCode: true,
          startedAt: true,
          completedAt: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export function listOptimizationRuns(limit = 10) {
  return prisma.aIOptimizationRun.findMany({
    orderBy: { startedAt: "desc" },
    take: Math.max(1, Math.min(limit, 50))
  });
}

export function findOptimizationCandidate(id: string) {
  return prisma.aIOptimizationCandidate.findUnique({
    where: { id },
    select: { id: true, status: true }
  });
}

async function loadOptimizationValidationInputWithinTransaction(
  tx: Prisma.TransactionClient,
  input: {
    candidateId: string;
    rubricVersion: string;
    adminUsername: string;
  }
) {
  // This snapshot contains only identity and relation metadata. Content is
  // selected after the related User rows are share-locked and rechecked.
  const snapshot = await tx.aIOptimizationCandidate.findUnique({
    where: { id: input.candidateId },
    select: {
      id: true,
      status: true,
      path: true,
      artifactType: true,
      dimension: true,
      promptKey: true,
      evidenceTraceIds: true,
      fewShotExamples: { select: { id: true, sourceTraceId: true } }
    }
  });
  if (!snapshot) return null;
  if (!(snapshot.status === "draft" || snapshot.status === "approved")) {
    throw new Error("OPTIMIZATION_CANDIDATE_NOT_VALIDATABLE");
  }
  if (snapshot.path === "engineering") {
    throw new Error("ENGINEERING_CANDIDATE_REQUIRES_MANUAL_VALIDATION");
  }

  const evidenceTraceIds = uniqueSorted(snapshot.evidenceTraceIds);
  const targetMetadata = await tx.aIGenerationTrace.findMany({
    where: {
      id: { in: evidenceTraceIds },
      ...CURRENT_CONSENT_TRACE_FILTER
    },
    select: { id: true, userId: true }
  });
  if (targetMetadata.length !== evidenceTraceIds.length) {
    throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  }

  const regressionMetadata = snapshot.promptKey
    ? await tx.aIGenerationTrace.findMany({
        where: {
          id: { notIn: evidenceTraceIds },
          artifactType: snapshot.artifactType ?? undefined,
          dimension: snapshot.dimension,
          status: "completed",
          feedback: { is: { status: "active", vote: "upvote" } },
          evaluation: { is: { totalScore: { gte: 85 } } },
          invocations: { some: { success: true, promptKey: snapshot.promptKey } },
          ...CURRENT_CONSENT_TRACE_FILTER
        },
        select: { id: true, userId: true },
        orderBy: { createdAt: "desc" },
        take: 3
      })
    : [];
  const eligibleFewShotMetadata = snapshot.fewShotExamples.length
    ? await tx.aIFewShotExample.findMany({
        where: {
          id: { in: snapshot.fewShotExamples.map((example) => example.id) },
          sourceTrace: { is: CURRENT_CONSENT_TRACE_FILTER }
        },
        select: { id: true, sourceTraceId: true }
      })
    : [];
  if (eligibleFewShotMetadata.length !== snapshot.fewShotExamples.length) {
    throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  }

  const consentTraceIds = uniqueSorted([
    ...evidenceTraceIds,
    ...regressionMetadata.map((trace) => trace.id),
    ...eligibleFewShotMetadata.map((example) => example.sourceTraceId)
  ]);
  await lockCurrentConsentForTraceIds(tx, consentTraceIds);
  await lockCandidateAtExpectedStatus(
    tx,
    snapshot.id,
    [snapshot.status],
    "OPTIMIZATION_CANDIDATE_STATE_CHANGED"
  );

  const runningValidation = await tx.aIOptimizationValidation.findFirst({
    where: { candidateId: snapshot.id, status: "running" },
    select: { id: true }
  });
  if (runningValidation) {
    throw new Error("OPTIMIZATION_VALIDATION_ALREADY_RUNNING");
  }

  const candidate = await tx.aIOptimizationCandidate.findUnique({
    where: { id: snapshot.id },
    include: {
      fewShotExamples: {
        where: { sourceTrace: { is: CURRENT_CONSENT_TRACE_FILTER } },
        include: { sourceTrace: { select: { userId: true } } }
      }
    }
  });
  if (
    !candidate
    || candidate.status !== snapshot.status
    || !sameStringSet(candidate.evidenceTraceIds, evidenceTraceIds)
    || !sameStringSet(
      candidate.fewShotExamples.map((example) => example.id),
      snapshot.fewShotExamples.map((example) => example.id)
    )
  ) {
    throw new Error("OPTIMIZATION_CANDIDATE_STATE_CHANGED");
  }

  const invocationSelect = {
    requestMessages: true,
    provider: true,
    model: true,
    promptKey: true,
    promptVersion: true
  } as const;
  const selectedTargetTraceIds = evidenceTraceIds.slice(0, 3);
  const targetTraces = await tx.aIGenerationTrace.findMany({
    where: {
      id: { in: selectedTargetTraceIds },
      ...CURRENT_CONSENT_TRACE_FILTER
    },
    include: {
      evaluation: true,
      feedback: true,
      invocations: {
        where: { success: true, ...(candidate.promptKey ? { promptKey: candidate.promptKey } : {}) },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: invocationSelect
      }
    }
  });
  if (targetTraces.length !== selectedTargetTraceIds.length) {
    throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  }

  const regressionTraceIds = regressionMetadata.map((trace) => trace.id);
  const regressionTraces = regressionTraceIds.length
    ? await tx.aIGenerationTrace.findMany({
        where: {
          id: { in: regressionTraceIds },
          ...CURRENT_CONSENT_TRACE_FILTER
        },
        include: {
          evaluation: true,
          feedback: true,
          invocations: {
            where: { success: true, promptKey: candidate.promptKey ?? undefined },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: invocationSelect
          }
        }
      })
    : [];
  if (regressionTraces.length !== regressionTraceIds.length) {
    throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  }

  const targetById = new Map(targetTraces.map((trace) => [trace.id, trace]));
  const regressionById = new Map(regressionTraces.map((trace) => [trace.id, trace]));
  const orderedTargets = selectedTargetTraceIds.flatMap((traceId) => {
    const trace = targetById.get(traceId);
    return trace ? [trace] : [];
  });
  const orderedRegressions = regressionTraceIds.flatMap((traceId) => {
    const trace = regressionById.get(traceId);
    return trace ? [trace] : [];
  });

  const auditRows = [
    ...orderedTargets.map((trace) => ({
      adminUsername: input.adminUsername,
      targetUserId: trace.userId,
      resourceType: "ai_optimization_validation_trace",
      resourceId: trace.id,
      action: "validate_content"
    })),
    ...orderedRegressions.map((trace) => ({
      adminUsername: input.adminUsername,
      targetUserId: trace.userId,
      resourceType: "ai_optimization_validation_trace",
      resourceId: trace.id,
      action: "validate_content"
    })),
    ...candidate.fewShotExamples.map((example) => ({
      adminUsername: input.adminUsername,
      targetUserId: example.sourceTrace.userId,
      resourceType: "ai_optimization_validation_few_shot",
      resourceId: example.id,
      action: "validate_content"
    }))
  ];
  if (auditRows.length > 0) {
    await tx.adminAuditLog.createMany({ data: auditRows });
  }

  const validation = await tx.aIOptimizationValidation.create({
    data: {
      candidateId: candidate.id,
      rubricVersion: input.rubricVersion,
      createdBy: input.adminUsername,
      results: []
    }
  });

  return {
    validation,
    expectedStatus: snapshot.status as CandidateMutableStatus,
    consentTraceIds,
    candidate,
    targetTraces: orderedTargets,
    regressionTraces: orderedRegressions
  };
}

export function loadOptimizationValidationInput(input: {
  candidateId: string;
  rubricVersion: string;
  adminUsername: string;
}) {
  return prisma.$transaction((tx) => loadOptimizationValidationInputWithinTransaction(tx, input));
}

export type OptimizationValidationLeaseInput = NonNullable<
  Awaited<ReturnType<typeof loadOptimizationValidationInputWithinTransaction>>
>;

export type OptimizationValidationCompletion = {
  status: "passed" | "failed";
  targetCaseCount: number;
  targetPassedCount: number;
  regressionCaseCount: number;
  regressionPassedCount: number;
  criticalRegressionCount: number;
  averageScoreDelta: number;
  summary: string;
  results: unknown;
};

type CompleteOptimizationValidationInput = OptimizationValidationCompletion & {
  validationId: string;
  candidateId: string;
  expectedCandidateStatus: CandidateMutableStatus;
  consentTraceIds: string[];
};

async function completeOptimizationValidationWithinTransaction(
  tx: Prisma.TransactionClient,
  input: CompleteOptimizationValidationInput
) {
  await lockCurrentConsentForTraceIds(tx, input.consentTraceIds);
  await lockCandidateAtExpectedStatus(
    tx,
    input.candidateId,
    [input.expectedCandidateStatus],
    "OPTIMIZATION_CANDIDATE_STATE_CHANGED"
  );
  const result = await tx.aIOptimizationValidation.updateMany({
    where: {
      id: input.validationId,
      candidateId: input.candidateId,
      status: "running"
    },
    data: {
      status: input.status,
      targetCaseCount: input.targetCaseCount,
      targetPassedCount: input.targetPassedCount,
      regressionCaseCount: input.regressionCaseCount,
      regressionPassedCount: input.regressionPassedCount,
      criticalRegressionCount: input.criticalRegressionCount,
      averageScoreDelta: input.averageScoreDelta,
      summary: input.summary,
      results: toJson(input.results),
      completedAt: new Date()
    }
  });
  if (result.count !== 1) throw new Error("OPTIMIZATION_VALIDATION_NOT_RUNNING");
  return tx.aIOptimizationValidation.findUniqueOrThrow({
    where: { id: input.validationId },
    select: OPTIMIZATION_VALIDATION_METADATA_SELECT
  });
}

export function completeOptimizationValidation(input: CompleteOptimizationValidationInput) {
  return prisma.$transaction((tx) => completeOptimizationValidationWithinTransaction(tx, input));
}

async function failOptimizationValidationWithinTransaction(
  tx: Prisma.TransactionClient,
  validationId: string,
  errorCode: string
) {
  return tx.aIOptimizationValidation.updateMany({
    where: { id: validationId, status: "running" },
    data: { status: "error", errorCode, completedAt: new Date() }
  });
}

export function failOptimizationValidation(validationId: string, errorCode: string) {
  return failOptimizationValidationWithinTransaction(prisma, validationId, errorCode);
}

export async function runOptimizationValidationWithConsentLease(
  input: {
    candidateId: string;
    rubricVersion: string;
    adminUsername: string;
  },
  operation: (
    validationInput: OptimizationValidationLeaseInput
  ) => Promise<OptimizationValidationCompletion>
) {
  const outcome = await prisma.$transaction(async (tx) => {
    const validationInput = await loadOptimizationValidationInputWithinTransaction(tx, input);
    if (!validationInput) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");

    try {
      const completion = await operation(validationInput);
      const validation = await completeOptimizationValidationWithinTransaction(tx, {
        validationId: validationInput.validation.id,
        candidateId: validationInput.candidate.id,
        expectedCandidateStatus: validationInput.expectedStatus,
        consentTraceIds: validationInput.consentTraceIds,
        ...completion
      });
      return { ok: true as const, validation };
    } catch (error) {
      const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,119}$/u.test(error.message)
        ? error.message
        : "OPTIMIZATION_VALIDATION_FAILED";
      await failOptimizationValidationWithinTransaction(
        tx,
        validationInput.validation.id,
        code
      );
      return { ok: false as const, error };
    }
  }, { maxWait: 5_000, timeout: 55_000 });

  if (!outcome.ok) throw outcome.error;
  return outcome.validation;
}

export async function findOptimizationCandidateEvidencePage(input: {
  candidateId: string;
  adminUsername: string;
  page: number;
  pageSize: number;
}) {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.aIOptimizationCandidate.findUnique({
      where: { id: input.candidateId },
      select: { id: true, evidenceTraceIds: true }
    });
    if (!candidate) return null;

    const eligibleTraceRows = candidate.evidenceTraceIds.length
      ? await tx.aIGenerationTrace.findMany({
        where: {
          id: { in: candidate.evidenceTraceIds },
          ...CURRENT_CONSENT_TRACE_FILTER
        },
        select: { id: true, userId: true }
      })
      : [];
    const eligibleTraceIds = new Set(eligibleTraceRows.map((trace) => trace.id));
    const orderedEligibleTraceIds = candidate.evidenceTraceIds.filter((traceId) =>
      eligibleTraceIds.has(traceId)
    );
    const total = orderedEligibleTraceIds.length;
    const start = (input.page - 1) * input.pageSize;
    const traceIds = orderedEligibleTraceIds.slice(start, start + input.pageSize);
    if (traceIds.length === 0) {
      return { candidateId: candidate.id, total, traces: [] };
    }

    await lockCurrentConsentForTraceIds(tx, traceIds);
    const lockedCandidates = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "AIOptimizationCandidate"
      WHERE "id" = ${candidate.id}
      FOR SHARE
    `);
    if (lockedCandidates.length !== 1) return null;

    const currentCandidate = await tx.aIOptimizationCandidate.findUnique({
      where: { id: candidate.id },
      select: { evidenceTraceIds: true }
    });
    if (
      !currentCandidate
      || traceIds.some((traceId) => !currentCandidate.evidenceTraceIds.includes(traceId))
    ) {
      throw new Error("OPTIMIZATION_CANDIDATE_STATE_CHANGED");
    }

    const traces = await tx.aIGenerationTrace.findMany({
        where: {
          id: { in: traceIds },
          ...CURRENT_CONSENT_TRACE_FILTER
        },
        include: AI_QUALITY_EVIDENCE_INCLUDE
      });
    if (traces.length !== traceIds.length) {
      throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
    }
    const traceById = new Map(traces.map((trace) => [trace.id, trace]));
    const orderedTraces = traceIds.flatMap((traceId) => {
      const trace = traceById.get(traceId);
      return trace ? [trace] : [];
    });
    await tx.adminAuditLog.createMany({
      data: orderedTraces.map((trace) => ({
        adminUsername: input.adminUsername,
        targetUserId: trace.userId,
        resourceType: "ai_quality_evidence",
        resourceId: trace.id,
        action: "view_content"
      }))
    });

    return { candidateId: candidate.id, total, traces: orderedTraces };
  });
}

export function reviewOptimizationCandidateStatus(input: {
  id: string;
  expectedStatus: CandidateMutableStatus;
  status: "approved" | "rejected";
  adminUsername: string;
  reviewReason?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.aIOptimizationCandidate.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        evidenceTraceIds: true,
        fewShotExamples: { select: { sourceTraceId: true } }
      }
    });
    if (!snapshot) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");
    await lockCurrentConsentForTraceIds(tx, [
      ...snapshot.evidenceTraceIds,
      ...snapshot.fewShotExamples.map((example) => example.sourceTraceId)
    ]);
    await lockCandidateAtExpectedStatus(
      tx,
      input.id,
      [input.expectedStatus],
      input.status === "approved"
        ? "OPTIMIZATION_CANDIDATE_NOT_DRAFT"
        : "OPTIMIZATION_CANDIDATE_NOT_REVIEWABLE"
    );
    const updated = await tx.aIOptimizationCandidate.updateMany({
      where: { id: input.id, status: input.expectedStatus },
      data: {
        status: input.status,
        reviewedBy: input.adminUsername,
        reviewedAt: new Date(),
        reviewReason: input.status === "rejected" ? input.reviewReason?.trim() ?? null : null
      }
    });
    if (updated.count !== 1) {
      throw new Error(
        input.status === "approved"
          ? "OPTIMIZATION_CANDIDATE_NOT_DRAFT"
          : "OPTIMIZATION_CANDIDATE_NOT_REVIEWABLE"
      );
    }
    await tx.adminAuditLog.create({
      data: {
        adminUsername: input.adminUsername,
        resourceType: "ai_optimization_candidate",
        resourceId: input.id,
        action: input.status === "approved" ? "approve" : "reject"
      }
    });
    return tx.aIOptimizationCandidate.findUniqueOrThrow({ where: { id: input.id } });
  });
}

export async function retireIneligibleFewShotExamples() {
  const examples = await prisma.aIFewShotExample.findMany({
    where: {
      status: { in: ["candidate", "active"] },
      OR: [
        { sourceTrace: { is: { feedback: { isNot: { status: "active", vote: "upvote" } } } } },
        { sourceTrace: { is: { evaluation: { isNot: { totalScore: { gte: 85 } } } } } },
        {
          sourceTrace: {
            is: {
              user: {
                isNot: {
                  aiQualityConsentVersion: CURRENT_PRIVACY_POLICY_VERSION,
                  aiQualityConsentAt: { not: null },
                  aiQualityConsentRevokedAt: null
                }
              }
            }
          }
        }
      ]
    },
    select: { id: true }
  });

  if (examples.length === 0) return 0;
  const result = await prisma.aIFewShotExample.updateMany({
    where: { id: { in: examples.map((item) => item.id) } },
    data: { status: "retired", retiredAt: new Date() }
  });
  return result.count;
}

function readProposal(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function loadValidationTraceIds(
  tx: Prisma.TransactionClient,
  validationId: string
) {
  const rows = await tx.$queryRaw<Array<{ traceId: string | null }>>(Prisma.sql`
    SELECT DISTINCT result_item ->> 'traceId' AS "traceId"
    FROM "AIOptimizationValidation" AS validation
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(validation."results") = 'array' THEN validation."results"
        ELSE '[]'::jsonb
      END
    ) AS result_item
    WHERE validation."id" = ${validationId}
      AND result_item ? 'traceId'
  `);
  return uniqueSorted(rows.flatMap((row) =>
    typeof row.traceId === "string" && row.traceId ? [row.traceId] : []
  ));
}

export async function publishOptimizationCandidate(candidateId: string, adminUsername: string) {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.aIOptimizationCandidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        status: true,
        evidenceTraceIds: true,
        fewShotExamples: { select: { id: true, sourceTraceId: true } },
        validations: {
          where: { status: "passed" },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { id: true }
        }
      }
    });
    if (!snapshot) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");
    if (snapshot.status !== "approved") throw new Error("OPTIMIZATION_CANDIDATE_NOT_APPROVED");
    if (snapshot.validations.length === 0) throw new Error("OPTIMIZATION_VALIDATION_REQUIRED");
    const validationTraceIds = await loadValidationTraceIds(tx, snapshot.validations[0].id);
    await lockCurrentConsentForTraceIds(tx, [
      ...snapshot.evidenceTraceIds,
      ...snapshot.fewShotExamples.map((example) => example.sourceTraceId),
      ...validationTraceIds
    ]);
    await lockCandidateAtExpectedStatus(
      tx,
      candidateId,
      ["approved"],
      "OPTIMIZATION_CANDIDATE_NOT_APPROVED"
    );
    const candidate = await tx.aIOptimizationCandidate.findUnique({
      where: { id: candidateId },
      include: {
        fewShotExamples: {
          where: { sourceTrace: { is: CURRENT_CONSENT_TRACE_FILTER } }
        },
        validations: {
          where: { status: "passed" },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { id: true }
        }
      }
    });
    if (
      !candidate
      || candidate.status !== "approved"
      || !sameStringSet(candidate.evidenceTraceIds, snapshot.evidenceTraceIds)
      || !sameStringSet(
        candidate.fewShotExamples.map((example) => example.id),
        snapshot.fewShotExamples.map((example) => example.id)
      )
      || candidate.validations[0]?.id !== snapshot.validations[0].id
    ) {
      throw new Error("OPTIMIZATION_CANDIDATE_STATE_CHANGED");
    }
    if (candidate.path === "engineering") throw new Error("ENGINEERING_CANDIDATE_CANNOT_PUBLISH");
    if (!candidate.promptKey) throw new Error("OPTIMIZATION_PROMPT_KEY_MISSING");

    const now = new Date();
    const proposal = readProposal(candidate.proposal);
    const instructionPatch = candidate.path === "system_prompt" && typeof proposal.instructionPatch === "string"
      ? proposal.instructionPatch.trim()
      : null;
    if (candidate.path === "system_prompt" && !instructionPatch) {
      throw new Error("OPTIMIZATION_PROMPT_PATCH_MISSING");
    }

    if (candidate.path === "few_shot") {
      await tx.aIFewShotExample.updateMany({
        where: { candidateId: candidate.id, status: "candidate" },
        data: { status: "active", promotedAt: now, retiredAt: null }
      });
    }

    const rankedExamples = await tx.aIFewShotExample.findMany({
      where: {
        promptKey: candidate.promptKey,
        status: "active",
        sourceTrace: { is: CURRENT_CONSENT_TRACE_FILTER }
      },
      select: { id: true },
      orderBy: [{ qualityScore: "desc" }, { promotedAt: "desc" }]
    });
    const activeExampleIds = rankedExamples.slice(0, 6).map((item) => item.id);
    const retiredExampleIds = rankedExamples.slice(6).map((item) => item.id);
    if (retiredExampleIds.length > 0) {
      await tx.aIFewShotExample.updateMany({
        where: { id: { in: retiredExampleIds } },
        data: { status: "retired", retiredAt: now }
      });
    }

    const latestRelease = await tx.aIPromptRelease.findFirst({
      where: { promptKey: candidate.promptKey },
      select: { version: true },
      orderBy: { version: "desc" }
    });
    const release = await tx.aIPromptRelease.create({
      data: {
        candidateId: candidate.id,
        validationId: candidate.validations[0].id,
        promptKey: candidate.promptKey,
        version: (latestRelease?.version ?? 0) + 1,
        instructionPatch,
        fewShotExampleIds: activeExampleIds,
        publishedBy: adminUsername
      }
    });
    const published = await tx.aIOptimizationCandidate.updateMany({
      where: { id: candidate.id, status: "approved" },
      data: { status: "published", publishedBy: adminUsername, publishedAt: now }
    });
    if (published.count !== 1) throw new Error("OPTIMIZATION_CANDIDATE_NOT_APPROVED");
    await tx.adminAuditLog.create({
      data: {
        adminUsername,
        resourceType: "ai_optimization_candidate",
        resourceId: candidate.id,
        action: "publish"
      }
    });
    return release;
  });
}

export async function rollbackOptimizationCandidate(candidateId: string, adminUsername: string) {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.aIOptimizationCandidate.findUnique({
      where: { id: candidateId },
      include: { releases: { where: { status: "published" }, orderBy: { version: "desc" }, take: 1 } }
    });
    if (!candidate) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");
    if (candidate.status !== "published") throw new Error("OPTIMIZATION_CANDIDATE_NOT_PUBLISHED");

    const now = new Date();
    if (candidate.releases[0]) {
      await tx.aIPromptRelease.update({
        where: { id: candidate.releases[0].id },
        data: { status: "rolled_back", rolledBackBy: adminUsername, rolledBackAt: now }
      });
    }
    if (candidate.path === "few_shot") {
      await tx.aIFewShotExample.updateMany({
        where: { candidateId: candidate.id, status: "active" },
        data: { status: "retired", retiredAt: now }
      });
    }
    const updated = await tx.aIOptimizationCandidate.update({
      where: { id: candidate.id },
      data: { status: "rolled_back", rolledBackBy: adminUsername, rolledBackAt: now }
    });
    await tx.adminAuditLog.create({
      data: {
        adminUsername,
        resourceType: "ai_optimization_candidate",
        resourceId: candidate.id,
        action: "rollback"
      }
    });
    return updated;
  });
}

export type ActivePromptOptimization = {
  promptCandidate: {
    id: string;
    proposal: Prisma.JsonValue;
    publishedAt: Date | null;
  } | null;
  fewShotExamples: Array<{
    id: string;
    inputSnapshot: Prisma.JsonValue;
    output: Prisma.JsonValue;
    qualityScore: number;
  }>;
};

export async function runWithActivePromptOptimizationConsentLease<T>(
  promptKey: string,
  operation: (optimization: ActivePromptOptimization) => Promise<T>
) {
  const [promptCandidate, exampleMetadata] = await Promise.all([
    prisma.aIOptimizationCandidate.findFirst({
      where: { promptKey, path: "system_prompt", status: "published" },
      select: { id: true, proposal: true, publishedAt: true },
      orderBy: { publishedAt: "desc" }
    }),
    prisma.aIFewShotExample.findMany({
      where: {
        promptKey,
        status: "active",
        sourceTrace: { is: CURRENT_CONSENT_TRACE_FILTER }
      },
      select: { id: true, sourceTraceId: true },
      orderBy: [{ qualityScore: "desc" }, { promotedAt: "desc" }],
      take: 6
    })
  ]);

  if (exampleMetadata.length === 0) {
    return operation({ promptCandidate, fewShotExamples: [] });
  }

  return prisma.$transaction(async (tx) => {
    await lockCurrentConsentForTraceIds(
      tx,
      exampleMetadata.map((example) => example.sourceTraceId)
    );

    const orderedExampleIds = uniqueSorted(exampleMetadata.map((example) => example.id));
    const lockedExamples = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "AIFewShotExample"
      WHERE "id" IN (${Prisma.join(orderedExampleIds)})
      ORDER BY "id" ASC
      FOR SHARE
    `);
    if (lockedExamples.length !== orderedExampleIds.length) {
      throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
    }

    const fewShotExamples = await tx.aIFewShotExample.findMany({
      where: {
        id: { in: orderedExampleIds },
        promptKey,
        status: "active",
        sourceTrace: { is: CURRENT_CONSENT_TRACE_FILTER }
      },
      select: {
        id: true,
        sourceTraceId: true,
        inputSnapshot: true,
        output: true,
        qualityScore: true
      },
      orderBy: [{ qualityScore: "desc" }, { promotedAt: "desc" }]
    });
    if (
      fewShotExamples.length !== exampleMetadata.length
      || !sameStringSet(
        fewShotExamples.map((example) => example.id),
        exampleMetadata.map((example) => example.id)
      )
      || fewShotExamples.some((example) =>
        exampleMetadata.find((metadata) => metadata.id === example.id)?.sourceTraceId
          !== example.sourceTraceId
      )
    ) {
      throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
    }

    return operation({ promptCandidate, fewShotExamples });
  }, { maxWait: 5_000, timeout: 55_000 });
}
