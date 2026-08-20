import { randomUUID } from "node:crypto";

import { Prisma, type AIFeedbackVote } from "@prisma/client";

import {
  CURRENT_PRIVACY_POLICY_VERSION,
  hasCurrentAIQualityConsent
} from "@/features/ai-feedback/feedback-config";
import { prisma } from "@/server/db/prisma";

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

async function revokeFeedbackWithinTransaction(
  tx: Prisma.TransactionClient,
  context: FeedbackRevocationContext,
  now: Date
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
  await tx.aIGenerationTrace.update({
    where: { id: context.traceId },
    data: { feedbackEvaluationPending: false }
  });
  await tx.aIResponseRegeneration.updateMany({
    where: { generatedTraceId: context.traceId },
    data: { downvotedAt: null }
  });
  await tx.aIFewShotExample.updateMany({
    where: { sourceTraceId: context.traceId, status: { in: ["candidate", "active"] } },
    data: { status: "retired", retiredAt: now }
  });

  if (context.evaluationCase) {
    const sourceSignals = context.evaluationCase.sourceSignals.filter(
      (item) => !item.startsWith("user_")
    );
    const score = context.evaluation?.totalScore ?? 80;
    const userDerivedCase = context.evaluationCase.sourceSignals.some(
      (item) => item.startsWith("user_")
    ) || context.evaluationCase.primaryIssueCode?.startsWith("user_downvote:") === true;
    await tx.aICase.update({
      where: { traceId: context.traceId },
      data: {
        classification: score < 70 ? "bad" : score < 85 ? "review" : "good",
        priority: score < 70 ? 70 : score < 85 ? 50 : 10,
        sourceSignals,
        primaryIssueCode: context.evaluationCase.primaryIssueCode?.startsWith("user_downvote:")
          ? null
          : context.evaluationCase.primaryIssueCode,
        summary: userDerivedCase
          ? "用户已撤回反馈，当前按自动评估结果分类。"
          : context.evaluationCase.summary
      }
    });
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
      const activeFeedback = await tx.aIFeedback.findMany({
        where: { userId, status: "active" },
        select: {
          id: true,
          traceId: true,
          revision: true,
          vote: true,
          tags: true,
          comment: true,
          trace: {
            select: {
              evaluation: { select: { totalScore: true } },
              case: {
                select: {
                  sourceSignals: true,
                  primaryIssueCode: true,
                  summary: true
                }
              }
            }
          }
        }
      });

      for (const feedback of activeFeedback) {
        await revokeFeedbackWithinTransaction(tx, {
          traceId: feedback.traceId,
          feedback,
          evaluation: feedback.trace.evaluation,
          evaluationCase: feedback.trace.case
        }, now);
      }
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
