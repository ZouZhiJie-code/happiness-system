import { randomUUID } from "node:crypto";

import { Prisma, type AIFeedbackVote } from "@prisma/client";

import {
  CURRENT_PRIVACY_POLICY_VERSION,
  hasCurrentAIQualityConsent
} from "@/features/ai-feedback/feedback-config";
import { prisma } from "@/server/db/prisma";

const CONSENT_WITHDRAWAL_REVIEWED_BY = "system:ai_quality_consent_withdrawal";
const CONSENT_WITHDRAWAL_REVIEW_REASON = "AI_QUALITY_CONSENT_WITHDRAWN";

export class AIFeedbackRepositoryError extends Error {
  constructor(readonly code: "CONSENT_REQUIRED") {
    super(code);
    this.name = "AIFeedbackRepositoryError";
  }
}

async function lockCurrentAIQualityConsent(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR SHARE`
  );
  if (lockedUsers.length !== 1) return false;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      aiQualityConsentVersion: true,
      aiQualityConsentAt: true,
      aiQualityConsentRevokedAt: true
    }
  });
  return Boolean(user && hasCurrentAIQualityConsent(user));
}

type FeedbackRevocationContext = {
  traceId: string;
  feedback: {
    id: string;
    revision: number;
    status?: "active" | "revoked";
    vote: AIFeedbackVote;
    tags: string[];
    comment: string | null;
  };
  evaluation: { totalScore: number } | null;
  evaluationCase: {
    sourceSignals: string[];
    primaryIssueCode: string | null;
    summary: string | null;
  } | null;
};

async function sanitizeCaseAfterFeedbackWithdrawal(
  tx: Prisma.TransactionClient,
  context: Pick<FeedbackRevocationContext, "traceId" | "evaluation" | "evaluationCase">
) {
  if (!context.evaluationCase) return;
  const userDerivedCase = context.evaluationCase.sourceSignals.some(
    (item) => item.startsWith("user_")
  ) || context.evaluationCase.primaryIssueCode?.startsWith("user_downvote:") === true;
  if (!userDerivedCase) return;

  const sourceSignals = context.evaluationCase.sourceSignals.filter(
    (item) => !item.startsWith("user_")
  );
  const score = context.evaluation?.totalScore ?? 80;
  await tx.aICase.update({
    where: { traceId: context.traceId },
    data: {
      classification: score < 70 ? "bad" : score < 85 ? "review" : "good",
      priority: score < 70 ? 70 : score < 85 ? 50 : 10,
      sourceSignals,
      primaryIssueCode: context.evaluationCase.primaryIssueCode?.startsWith("user_downvote:")
        ? null
        : context.evaluationCase.primaryIssueCode,
      summary: "用户已撤回反馈，当前按自动评估结果分类。"
    }
  });
}

async function invalidateConsentBoundCandidates(
  tx: Prisma.TransactionClient,
  traceIds: string[],
  now: Date
) {
  const uniqueTraceIds = Array.from(new Set(traceIds));
  if (uniqueTraceIds.length === 0) return;
  const pendingCandidates = await tx.aIOptimizationCandidate.findMany({
    where: {
      evidenceTraceIds: { hasSome: uniqueTraceIds },
      OR: [
        { status: { in: ["draft", "approved"] } },
        {
          status: "rejected",
          reviewedBy: CONSENT_WITHDRAWAL_REVIEWED_BY,
          reviewReason: CONSENT_WITHDRAWAL_REVIEW_REASON
        }
      ]
    },
    select: { id: true, status: true, evidenceTraceIds: true },
    orderBy: { id: "asc" }
  });

  for (const candidate of pendingCandidates) {
    const update = await tx.aIOptimizationCandidate.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: { in: ["draft", "approved"] } },
          {
            status: "rejected",
            reviewedBy: CONSENT_WITHDRAWAL_REVIEWED_BY,
            reviewReason: CONSENT_WITHDRAWAL_REVIEW_REASON
          }
        ]
      },
      data: {
        status: "rejected",
        evidenceTraceIds: candidate.evidenceTraceIds.filter(
          (traceId) => !uniqueTraceIds.includes(traceId)
        ),
        reviewedBy: CONSENT_WITHDRAWAL_REVIEWED_BY,
        reviewedAt: now,
        reviewReason: CONSENT_WITHDRAWAL_REVIEW_REASON
      }
    });
    if (update.count !== 1) {
      throw new Error("AI_QUALITY_CONSENT_CANDIDATE_STATE_CHANGED");
    }
  }
}

async function clearConsentBoundDerivedState(
  tx: Prisma.TransactionClient,
  traceIds: string[],
  now: Date
) {
  const uniqueTraceIds = Array.from(new Set(traceIds));
  if (uniqueTraceIds.length === 0) return;
  await tx.aIGenerationTrace.updateMany({
    where: { id: { in: uniqueTraceIds } },
    data: { feedbackEvaluationPending: false }
  });
  await tx.aIResponseRegeneration.updateMany({
    where: { generatedTraceId: { in: uniqueTraceIds } },
    data: { downvotedAt: null }
  });
  await tx.aIFewShotExample.updateMany({
    where: { sourceTraceId: { in: uniqueTraceIds }, status: { in: ["candidate", "active"] } },
    data: { status: "retired", retiredAt: now }
  });
  await invalidateConsentBoundCandidates(tx, uniqueTraceIds, now);
}

async function revokeFeedbackWithinTransaction(
  tx: Prisma.TransactionClient,
  context: FeedbackRevocationContext,
  now: Date,
  options: { clearDerivedState?: boolean } = {}
) {
  const revision = context.feedback.revision + 1;
  const feedback = await tx.aIFeedback.update({
    where: { id: context.feedback.id },
    data: { status: "revoked", revokedAt: now, revision }
  });
  await tx.aIFeedbackRevision.create({
    data: {
      feedbackId: context.feedback.id,
      revision,
      vote: context.feedback.vote,
      tags: context.feedback.tags,
      comment: context.feedback.comment,
      status: "revoked"
    }
  });
  await sanitizeCaseAfterFeedbackWithdrawal(tx, context);
  if (options.clearDerivedState !== false) {
    await clearConsentBoundDerivedState(tx, [context.traceId], now);
  }

  return feedback;
}

export function getAIQualityConsent(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      privacyPolicyVersion: true,
      aiQualityConsentVersion: true,
      aiQualityConsentAt: true,
      aiQualityConsentRevokedAt: true
    }
  });
}

export async function recordAIQualityConsentDecision(userId: string, participate: boolean) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        agreedToPrivacyAt: now,
        aiQualityConsentVersion: CURRENT_PRIVACY_POLICY_VERSION,
        aiQualityConsentAt: participate ? now : null,
        aiQualityConsentRevokedAt: participate ? null : now
      },
      select: {
        privacyPolicyVersion: true,
        aiQualityConsentVersion: true,
        aiQualityConsentAt: true,
        aiQualityConsentRevokedAt: true
      }
    });

    if (!participate) {
      const traces = await tx.aIGenerationTrace.findMany({
        where: { userId },
        select: {
          id: true,
          feedback: {
            select: {
              id: true,
              revision: true,
              vote: true,
              tags: true,
              comment: true,
              status: true
            }
          },
          evaluation: { select: { totalScore: true } },
          case: {
            select: {
              sourceSignals: true,
              primaryIssueCode: true,
              summary: true
            }
          }
        }
      });

      for (const trace of traces) {
        if (trace.feedback?.status === "active") {
          await revokeFeedbackWithinTransaction(tx, {
            traceId: trace.id,
            feedback: trace.feedback,
            evaluation: trace.evaluation,
            evaluationCase: trace.case
          }, now, { clearDerivedState: false });
        } else {
          await sanitizeCaseAfterFeedbackWithdrawal(tx, {
            traceId: trace.id,
            evaluation: trace.evaluation,
            evaluationCase: trace.case
          });
        }
      }
      await clearConsentBoundDerivedState(tx, traces.map((trace) => trace.id), now);
    }

    return user;
  });
}

export function findFeedbackContext(traceId: string, userId: string) {
  return prisma.aIGenerationTrace.findFirst({
    where: { id: traceId, userId, status: "completed" },
    select: {
      id: true,
      artifactType: true,
      feedback: {
        select: {
          id: true,
          vote: true,
          tags: true,
          comment: true,
          status: true,
          revision: true,
          updatedAt: true,
          revokedAt: true
        }
      }
    }
  });
}

export async function saveAIResponseFeedback(input: {
  traceId: string;
  userId: string;
  vote: AIFeedbackVote;
  tags: string[];
  comment: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    if (!await lockCurrentAIQualityConsent(tx, input.userId)) {
      throw new AIFeedbackRepositoryError("CONSENT_REQUIRED");
    }

    const trace = await tx.aIGenerationTrace.findFirst({
      where: { id: input.traceId, userId: input.userId, status: "completed" },
      select: { id: true, artifactType: true, feedback: true, case: true }
    });

    if (!trace) return null;

    const revision = (trace.feedback?.revision ?? 0) + 1;
    const feedbackId = trace.feedback?.id ?? randomUUID();
    const feedback = await tx.aIFeedback.upsert({
      where: { traceId: trace.id },
      create: {
        id: feedbackId,
        traceId: trace.id,
        userId: input.userId,
        vote: input.vote,
        tags: input.tags,
        comment: input.comment,
        status: "active",
        revision,
        privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION
      },
      update: {
        vote: input.vote,
        tags: input.tags,
        comment: input.comment,
        status: "active",
        revision,
        privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        revokedAt: null
      }
    });

    await tx.aIFeedbackRevision.create({
      data: {
        feedbackId,
        revision,
        vote: input.vote,
        tags: input.tags,
        comment: input.comment,
        status: "active"
      }
    });
    await tx.aIGenerationTrace.update({
      where: { id: trace.id },
      data: { feedbackEvaluationPending: true }
    });
    if (input.vote === "downvote") {
      await tx.aIFewShotExample.updateMany({
        where: { sourceTraceId: trace.id, status: { in: ["candidate", "active"] } },
        data: { status: "retired", retiredAt: new Date() }
      });
    }
    await tx.aIResponseRegeneration.updateMany({
      where: { generatedTraceId: trace.id },
      data: {
        downvotedAt: input.vote === "downvote" ? new Date() : null
      }
    });

    const feedbackSignal = input.vote === "downvote" ? "user_downvote" : "user_upvote";
    const sourceSignals = Array.from(
      new Set([...(trace.case?.sourceSignals ?? []).filter((item) => !item.startsWith("user_")), feedbackSignal])
    );
    const downvoteIssue = input.vote === "downvote" ? `user_downvote:${input.tags[0] ?? "free_text"}` : null;

    await tx.aICase.upsert({
      where: { traceId: trace.id },
      create: {
        traceId: trace.id,
        classification: input.vote === "downvote" ? "bad" : "good",
        priority: input.vote === "downvote" ? 100 : 20,
        sourceSignals,
        primaryIssueCode: downvoteIssue,
        summary: input.comment ?? (input.vote === "downvote" ? "用户提交了负向反馈。" : "用户提交了正向反馈。")
      },
      update: {
        classification: input.vote === "downvote" ? "bad" : trace.case?.classification ?? "good",
        priority: input.vote === "downvote" ? 100 : trace.case?.priority ?? 20,
        sourceSignals,
        primaryIssueCode: downvoteIssue ?? trace.case?.primaryIssueCode,
        summary: input.comment ?? trace.case?.summary
      }
    });

    return feedback;
  });
}

export async function revokeAIResponseFeedback(traceId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const trace = await tx.aIGenerationTrace.findFirst({
      where: { id: traceId, userId },
      select: { id: true, feedback: true, evaluation: true, case: true }
    });

    if (!trace?.feedback || trace.feedback.status === "revoked") return trace?.feedback ?? null;

    return revokeFeedbackWithinTransaction(tx, {
      traceId: trace.id,
      feedback: trace.feedback,
      evaluation: trace.evaluation,
      evaluationCase: trace.case
    }, new Date());
  });
}
