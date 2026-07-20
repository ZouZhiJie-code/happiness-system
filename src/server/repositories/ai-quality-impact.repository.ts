import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import {
  AI_QUALITY_EVIDENCE_INCLUDE,
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
  const base = traceWindowWhere(input);
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

export async function findAIQualityImpactEvidencePage(input: {
  candidateId: string;
  promptKey: string;
  start: Date;
  end: Date;
  versionMarker: string;
  kind: "attention" | "positive";
  page: number;
  pageSize: number;
}) {
  const where = impactEvidenceWhere(input);
  const total = await prisma.aIGenerationTrace.count({ where });
  const traces = await prisma.aIGenerationTrace.findMany({
    where,
    include: AI_QUALITY_EVIDENCE_INCLUDE,
    orderBy: { createdAt: "desc" },
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize
  });
  return { candidateId: input.candidateId, total, traces: traces as AIQualityEvidenceTrace[] };
}
