import { Prisma, type AIOptimizationPath } from "@prisma/client";

import { CURRENT_PRIVACY_POLICY_VERSION } from "@/features/ai-feedback/feedback-config";
import { prisma } from "@/server/db/prisma";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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
        updatedAt: { gte: periodStart, lt: periodEnd }
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
  artifactType: "interview_turn" | "dimension_journal";
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
      const existing = await tx.aIOptimizationCandidate.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return { candidate: existing, created: false as const };

      const cluster = await tx.aIBadcaseCluster.create({
        data: {
          runId: input.runId,
          artifactType: input.artifactType,
          dimension: input.dimension,
          issueCode: input.issueCode,
          caseCount: input.caseCount,
          traceIds: input.traceIds,
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
          evidenceTraceIds: input.traceIds,
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
  artifactType: "interview_turn" | "dimension_journal";
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
      const existing = await tx.aIOptimizationCandidate.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return { candidate: existing, created: false as const };

      const candidate = await tx.aIOptimizationCandidate.create({
        data: {
          dedupeKey: input.dedupeKey,
          runId: input.runId,
          path: "few_shot",
          artifactType: input.artifactType,
          dimension: input.dimension,
          promptKey: input.promptKey,
          title: `Few-shot 更新：${input.promptKey}`,
          rationale: `${input.traces.length} 条获得点赞且自动评分不低于 85 分的回复可进入动态示例库。`,
          proposal: toJson({ sourceTraceIds: input.traces.map((trace) => trace.id), maxActiveExamples: 6 }),
          evidenceTraceIds: input.traces.map((trace) => trace.id),
          riskLevel: "medium"
        }
      });

      for (const trace of input.traces) {
        await tx.aIFewShotExample.upsert({
          where: { sourceTraceId: trace.id },
          create: {
            sourceTraceId: trace.id,
            candidateId: candidate.id,
            promptKey: input.promptKey,
            artifactType: input.artifactType,
            dimension: input.dimension,
            inputSnapshot: toJson(compactFewShotContext(trace.contextSnapshot)),
            output: toJson(trace.finalOutput),
            qualityScore: trace.evaluation?.totalScore ?? 85
          },
          update: {
            candidateId: candidate.id,
            qualityScore: trace.evaluation?.totalScore ?? 85,
            inputSnapshot: toJson(compactFewShotContext(trace.contextSnapshot)),
            output: toJson(trace.finalOutput)
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
      cluster: true,
      releases: { orderBy: { version: "desc" } },
      fewShotExamples: true,
      validations: { orderBy: { startedAt: "desc" }, take: 1 }
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
    include: {
      fewShotExamples: true,
      releases: { orderBy: { version: "desc" } },
      validations: { orderBy: { startedAt: "desc" }, take: 1 }
    }
  });
}

export async function loadOptimizationValidationInput(candidateId: string) {
  const candidate = await prisma.aIOptimizationCandidate.findUnique({
    where: { id: candidateId },
    include: { fewShotExamples: true }
  });
  if (!candidate) return null;

  const invocationSelect = {
    requestMessages: true,
    provider: true,
    model: true,
    promptKey: true,
    promptVersion: true
  } as const;
  const targetTraces = await prisma.aIGenerationTrace.findMany({
      where: { id: { in: candidate.evidenceTraceIds } },
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
  const regressionTraces = candidate.promptKey
      ? await prisma.aIGenerationTrace.findMany({
          where: {
            id: { notIn: candidate.evidenceTraceIds },
            artifactType: candidate.artifactType ?? undefined,
            dimension: candidate.dimension,
            status: "completed",
            feedback: { is: { status: "active", vote: "upvote" } },
            evaluation: { is: { totalScore: { gte: 85 } } },
            invocations: { some: { success: true, promptKey: candidate.promptKey } }
          },
          include: {
            evaluation: true,
            feedback: true,
            invocations: {
              where: { success: true, promptKey: candidate.promptKey },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: invocationSelect
            }
          },
          orderBy: { createdAt: "desc" },
          take: 3
        })
      : [];

  const targetById = new Map(targetTraces.map((trace) => [trace.id, trace]));
  return {
    candidate,
    targetTraces: candidate.evidenceTraceIds.flatMap((id) => {
      const trace = targetById.get(id);
      return trace ? [trace] : [];
    }).slice(0, 3),
    regressionTraces
  };
}

export function createOptimizationValidation(input: {
  candidateId: string;
  rubricVersion: string;
  createdBy: string;
}) {
  return prisma.aIOptimizationValidation.create({
    data: {
      candidateId: input.candidateId,
      rubricVersion: input.rubricVersion,
      createdBy: input.createdBy,
      results: []
    }
  });
}

export function completeOptimizationValidation(input: {
  validationId: string;
  status: "passed" | "failed";
  targetCaseCount: number;
  targetPassedCount: number;
  regressionCaseCount: number;
  regressionPassedCount: number;
  criticalRegressionCount: number;
  averageScoreDelta: number;
  summary: string;
  results: unknown;
}) {
  return prisma.aIOptimizationValidation.update({
    where: { id: input.validationId },
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
}

export function failOptimizationValidation(validationId: string, errorCode: string) {
  return prisma.aIOptimizationValidation.update({
    where: { id: validationId },
    data: { status: "error", errorCode, completedAt: new Date() }
  });
}

export async function findOptimizationCandidateEvidencePage(input: {
  candidateId: string;
  page: number;
  pageSize: number;
}) {
  const candidate = await prisma.aIOptimizationCandidate.findUnique({
    where: { id: input.candidateId },
    select: { id: true, evidenceTraceIds: true }
  });
  if (!candidate) return null;

  const total = candidate.evidenceTraceIds.length;
  const start = (input.page - 1) * input.pageSize;
  const traceIds = candidate.evidenceTraceIds.slice(start, start + input.pageSize);
  const traces = traceIds.length
    ? await prisma.aIGenerationTrace.findMany({
        where: { id: { in: traceIds } },
        include: AI_QUALITY_EVIDENCE_INCLUDE
      })
    : [];
  const traceById = new Map(traces.map((trace) => [trace.id, trace]));

  return {
    candidateId: candidate.id,
    total,
    traces: traceIds.flatMap((traceId) => {
      const trace = traceById.get(traceId);
      return trace ? [trace] : [];
    })
  };
}

export function reviewOptimizationCandidateStatus(input: {
  id: string;
  status: "approved" | "rejected";
  adminUsername: string;
  reviewReason?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.aIOptimizationCandidate.update({
      where: { id: input.id },
      data: {
        status: input.status,
        reviewedBy: input.adminUsername,
        reviewedAt: new Date(),
        reviewReason: input.status === "rejected" ? input.reviewReason?.trim() ?? null : null
      }
    });
    await tx.adminAuditLog.create({
      data: {
        adminUsername: input.adminUsername,
        resourceType: "ai_optimization_candidate",
        resourceId: input.id,
        action: input.status === "approved" ? "approve" : "reject"
      }
    });
    return candidate;
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

export async function publishOptimizationCandidate(candidateId: string, adminUsername: string) {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.aIOptimizationCandidate.findUnique({
      where: { id: candidateId },
      include: {
        fewShotExamples: true,
        validations: { where: { status: "passed" }, orderBy: { startedAt: "desc" }, take: 1 }
      }
    });

    if (!candidate) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");
    if (candidate.status !== "approved") throw new Error("OPTIMIZATION_CANDIDATE_NOT_APPROVED");
    if (candidate.path === "engineering") throw new Error("ENGINEERING_CANDIDATE_CANNOT_PUBLISH");
    if (!candidate.promptKey) throw new Error("OPTIMIZATION_PROMPT_KEY_MISSING");
    if (candidate.validations.length === 0) throw new Error("OPTIMIZATION_VALIDATION_REQUIRED");

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
      where: { promptKey: candidate.promptKey, status: "active" },
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
    await tx.aIOptimizationCandidate.update({
      where: { id: candidate.id },
      data: { status: "published", publishedBy: adminUsername, publishedAt: now }
    });
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

export function loadActivePromptOptimization(promptKey: string) {
  return Promise.all([
    prisma.aIOptimizationCandidate.findFirst({
      where: { promptKey, path: "system_prompt", status: "published" },
      select: { id: true, proposal: true, publishedAt: true },
      orderBy: { publishedAt: "desc" }
    }),
    prisma.aIFewShotExample.findMany({
      where: { promptKey, status: "active" },
      select: { id: true, inputSnapshot: true, output: true, qualityScore: true },
      orderBy: [{ qualityScore: "desc" }, { promotedAt: "desc" }],
      take: 6
    })
  ]).then(([promptCandidate, fewShotExamples]) => ({ promptCandidate, fewShotExamples }));
}
