import { Prisma, type AIEvaluationTrigger } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function findTraceForEvaluation(traceId: string) {
  return prisma.aIGenerationTrace.findUnique({
    where: { id: traceId },
    include: {
      invocations: { orderBy: [{ stage: "asc" }, { attempt: "asc" }] },
      evaluation: true,
      feedback: true,
      user: {
        select: {
          aiQualityConsentVersion: true,
          aiQualityConsentAt: true,
          aiQualityConsentRevokedAt: true
        }
      }
    }
  });
}

export function listTraceIdsNeedingEvaluation(limit = 50) {
  const retryBefore = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return prisma.aIGenerationTrace.findMany({
    where: {
      status: "completed",
      OR: [
        { evaluation: null },
        { evaluation: { is: { status: "rules_completed", judgeTriggered: true, evaluatedAt: { lt: retryBefore } } } },
        { feedbackEvaluationPending: true }
      ]
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 200))
  });
}

export async function persistEvaluationReport(input: {
  traceId: string;
  status: "rules_completed" | "completed" | "failed";
  trigger: AIEvaluationTrigger;
  rubricVersion: string;
  ruleScore: number;
  judgeScore: number | null;
  totalScore: number;
  dimensionScores: unknown;
  deductions: unknown;
  reasons: string[];
  ruleSignals: string[];
  judgeTriggered: boolean;
  judgeTriggerReason: string | null;
  judgeResult: unknown | null;
  errorCode: string | null;
  classification: "bad" | "review" | "good";
  priority: number;
  primaryIssueCode: string | null;
  summary: string;
}) {
  const evaluationData = {
    status: input.status,
    trigger: input.trigger,
    rubricVersion: input.rubricVersion,
    ruleScore: input.ruleScore,
    judgeScore: input.judgeScore,
    totalScore: input.totalScore,
    dimensionScores: toJson(input.dimensionScores),
    deductions: toJson(input.deductions),
    reasons: input.reasons,
    ruleSignals: input.ruleSignals,
    judgeTriggered: input.judgeTriggered,
    judgeTriggerReason: input.judgeTriggerReason,
    judgeResult: input.judgeResult === null ? Prisma.JsonNull : toJson(input.judgeResult),
    errorCode: input.errorCode,
    evaluatedAt: new Date()
  } satisfies Prisma.AIEvaluationUncheckedCreateWithoutTraceInput;

  await prisma.$transaction([
    prisma.aIEvaluation.upsert({
      where: { traceId: input.traceId },
      create: { traceId: input.traceId, ...evaluationData },
      update: evaluationData
    }),
    prisma.aICase.upsert({
      where: { traceId: input.traceId },
      create: {
        traceId: input.traceId,
        classification: input.classification,
        priority: input.priority,
        sourceSignals: input.ruleSignals,
        primaryIssueCode: input.primaryIssueCode,
        summary: input.summary
      },
      update: {
        classification: input.classification,
        priority: input.priority,
        sourceSignals: input.ruleSignals,
        primaryIssueCode: input.primaryIssueCode,
        summary: input.summary
      }
    }),
    prisma.aIGenerationTrace.update({
      where: { id: input.traceId },
      data: { feedbackEvaluationPending: false }
    })
  ]);
}
