import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import {
  AI_QUALITY_EVIDENCE_INCLUDE,
  CURRENT_CONSENT_TRACE_FILTER,
  lockCurrentConsentForTraceIds,
  type AIQualityEvidenceTrace
} from "@/server/repositories/ai-optimization.repository";

const IMPACT_TRACE_INCLUDE = Prisma.validator<Prisma.AIGenerationTraceInclude>()({
  feedback: { select: { status: true, vote: true, tags: true } },
  evaluation: { select: { totalScore: true, ruleSignals: true, deductions: true } },
  case: { select: { classification: true, primaryIssueCode: true } },
  invocations: {
    select: {
      success: true,
      latencyMs: true,
      promptKey: true,
      promptVersion: true,
      createdAt: true
    }
  }
});

export type AIQualityImpactTrace = Prisma.AIGenerationTraceGetPayload<{
  include: typeof IMPACT_TRACE_INCLUDE;
}>;

export function findAIQualityImpactRelease(candidateId: string) {
  return prisma.aIOptimizationCandidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      path: true,
      promptKey: true,
      cluster: { select: { issueCode: true } },
      releases: {
        where: { status: { in: ["published", "rolled_back"] } },
        orderBy: { publishedAt: "desc" },
        take: 1,
        select: {
          id: true,
          validationId: true,
          promptKey: true,
          version: true,
          fewShotExampleIds: true,
          publishedAt: true,
          rolledBackAt: true
        }
      }
    }
  });
}

export function findNextSamePathRelease(input: {
  candidateId: string;
  promptKey: string;
  path: "system_prompt" | "few_shot" | "engineering";
  publishedAt: Date;
}) {
  return prisma.aIPromptRelease.findFirst({
    where: {
      candidateId: { not: input.candidateId },
      promptKey: input.promptKey,
      publishedAt: { gt: input.publishedAt },
      candidate: { is: { path: input.path } }
    },
    orderBy: { publishedAt: "asc" },
    select: { publishedAt: true }
  });
}

function traceWindowWhere(input: {
  promptKey: string;
  start: Date;
  end: Date;
  versionMarker?: string | null;
}): Prisma.AIGenerationTraceWhereInput {
  return {
    createdAt: { gte: input.start, lt: input.end },
    invocations: {
      some: {
        promptKey: input.promptKey,
        ...(input.versionMarker ? { promptVersion: { contains: input.versionMarker } } : {})
      }
    }
  };
}

export function findAIQualityImpactTraces(input: {
  promptKey: string;
  start: Date;
  end: Date;
  versionMarker?: string | null;
}) {
  return prisma.aIGenerationTrace.findMany({
    where: traceWindowWhere(input),
    include: IMPACT_TRACE_INCLUDE,
    orderBy: { createdAt: "desc" }
  });
}

function impactEvidenceWhere(input: {
  promptKey: string;
  start: Date;
  end: Date;
  versionMarker: string;
  kind: "attention" | "positive";
}): Prisma.AIGenerationTraceWhereInput {
  const base = {
    ...traceWindowWhere(input),
    ...CURRENT_CONSENT_TRACE_FILTER
  };
  if (input.kind === "attention") {
    return {
      ...base,
      OR: [
        { feedback: { is: { status: "active", vote: "downvote" } } },
        { case: { is: { classification: { in: ["bad", "review"] } } } }
      ]
    };
  }
  return {
    ...base,
    feedback: { is: { status: "active", vote: "upvote" } },
    OR: [
      { case: { is: { classification: "good" } } },
      { evaluation: { is: { totalScore: { gte: 85 } } } }
    ]
  };
}

export type AIQualityImpactEvidencePageInput = {
  candidateId: string;
  adminUsername: string;
  promptKey: string;
  start: Date;
  end: Date;
  versionMarker: string;
  kind: "attention" | "positive";
  page: number;
  pageSize: number;
};

export async function findAIQualityImpactEvidencePageWithinTransaction(
  tx: Prisma.TransactionClient,
  input: AIQualityImpactEvidencePageInput
) {
  const where = impactEvidenceWhere(input);
  const total = await tx.aIGenerationTrace.count({ where });
  const metadata = await tx.aIGenerationTrace.findMany({
    where,
    select: { id: true, userId: true },
    orderBy: { createdAt: "desc" },
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize
  });
  if (metadata.length === 0) {
    return { candidateId: input.candidateId, total, traces: [] as AIQualityEvidenceTrace[] };
  }

  const traceIds = metadata.map((trace) => trace.id);
  await lockCurrentConsentForTraceIds(tx, traceIds);

  const currentMetadata = await tx.aIGenerationTrace.findMany({
    where: { ...where, id: { in: traceIds } },
    select: { id: true, userId: true }
  });
  if (
    currentMetadata.length !== traceIds.length
    || traceIds.some((traceId) => !currentMetadata.some((trace) => trace.id === traceId))
  ) {
    throw new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  }

  const traces = await tx.aIGenerationTrace.findMany({
    where: { ...where, id: { in: traceIds } },
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
      resourceType: "ai_quality_impact_evidence",
      resourceId: trace.id,
      action: "view_content"
    }))
  });

  return {
    candidateId: input.candidateId,
    total,
    traces: orderedTraces as AIQualityEvidenceTrace[]
  };
}

export function findAIQualityImpactEvidencePage(input: AIQualityImpactEvidencePageInput) {
  return prisma.$transaction((tx) => (
    findAIQualityImpactEvidencePageWithinTransaction(tx, input)
  ));
}
