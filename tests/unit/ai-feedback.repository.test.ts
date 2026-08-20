const { prismaTransaction, tx } = vi.hoisted(() => {
  const transactionClient = {
    $queryRaw: vi.fn(),
    aIGenerationTrace: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    aIFeedback: { upsert: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    aIFeedbackRevision: { create: vi.fn() },
    aICase: { upsert: vi.fn(), update: vi.fn() },
    aIFewShotExample: { updateMany: vi.fn() },
    aIOptimizationCandidate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    aIResponseRegeneration: { updateMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() }
  };
  return {
    tx: transactionClient,
    prismaTransaction: vi.fn(async (callback: (client: typeof transactionClient) => unknown) => callback(transactionClient))
  };
});

vi.mock("@/server/db/prisma", () => ({
  prisma: { $transaction: prismaTransaction }
}));

import {
  AIFeedbackRepositoryError,
  recordAIQualityConsentDecision,
  revokeAIResponseFeedback,
  saveAIResponseFeedback
} from "@/server/repositories/ai-feedback.repository";

describe("AI feedback repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ id: "user-1" }]);
    tx.user.findUnique.mockResolvedValue({
      aiQualityConsentVersion: "2026-07-19",
      aiQualityConsentAt: new Date("2026-08-19T08:00:00.000Z"),
      aiQualityConsentRevokedAt: null
    });
    tx.aIOptimizationCandidate.findMany.mockResolvedValue([]);
    tx.aIOptimizationCandidate.updateMany.mockResolvedValue({ count: 1 });
  });

  it("appends an immutable revision and marks the exact trace for feedback evaluation", async () => {
    tx.aIGenerationTrace.findFirst.mockResolvedValue({
      id: "trace-1",
      artifactType: "interview_turn",
      feedback: { id: "feedback-1", revision: 2 },
      case: { classification: "review", priority: 50, sourceSignals: ["assistant_server_guard"], primaryIssueCode: null, summary: null }
    });
    tx.aIFeedback.upsert.mockResolvedValue({ id: "feedback-1", revision: 3, status: "active" });

    await saveAIResponseFeedback({
      traceId: "trace-1",
      userId: "user-1",
      vote: "downvote",
      tags: ["too_abstract"],
      comment: "问题很难理解"
    });

    expect(tx.aIFeedback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { traceId: "trace-1" },
        update: expect.objectContaining({ revision: 3, vote: "downvote", status: "active" })
      })
    );
    expect(tx.aIFeedbackRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ feedbackId: "feedback-1", revision: 3, status: "active" })
    });
    expect(tx.aIGenerationTrace.update).toHaveBeenCalledWith({
      where: { id: "trace-1" },
      data: { feedbackEvaluationPending: true }
    });
    expect(tx.aICase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          classification: "bad",
          priority: 100,
          primaryIssueCode: "user_downvote:too_abstract",
          sourceSignals: ["assistant_server_guard", "user_downvote"]
        })
      })
    );
    expect(tx.aIFewShotExample.updateMany).toHaveBeenCalledWith({
      where: { sourceTraceId: "trace-1", status: { in: ["candidate", "active"] } },
      data: { status: "retired", retiredAt: expect.any(Date) }
    });
    expect(tx.aIResponseRegeneration.updateMany).toHaveBeenCalledWith({
      where: { generatedTraceId: "trace-1" },
      data: { downvotedAt: expect.any(Date) }
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.aIGenerationTrace.findFirst.mock.invocationCallOrder[0]
    );
  });

  it("fails closed inside the save transaction when consent has been withdrawn", async () => {
    tx.user.findUnique.mockResolvedValue({
      aiQualityConsentVersion: "2026-07-19",
      aiQualityConsentAt: new Date("2026-08-19T08:00:00.000Z"),
      aiQualityConsentRevokedAt: new Date("2026-08-19T08:30:00.000Z")
    });

    await expect(saveAIResponseFeedback({
      traceId: "trace-1",
      userId: "user-1",
      vote: "upvote",
      tags: [],
      comment: null
    })).rejects.toEqual(
      expect.objectContaining<Partial<AIFeedbackRepositoryError>>({
        code: "CONSENT_REQUIRED"
      })
    );
    expect(tx.aIGenerationTrace.findFirst).not.toHaveBeenCalled();
    expect(tx.aIFeedback.upsert).not.toHaveBeenCalled();
  });

  it("records revocation as a new revision and removes user feedback from case signals", async () => {
    tx.aIGenerationTrace.findFirst.mockResolvedValue({
      id: "trace-1",
      feedback: {
        id: "feedback-1",
        revision: 3,
        status: "active",
        vote: "downvote",
        tags: ["too_abstract"],
        comment: "问题很难理解"
      },
      evaluation: { totalScore: 88 },
      case: {
        sourceSignals: ["user_downvote", "assistant_server_guard"],
        primaryIssueCode: "user_downvote:too_abstract",
        summary: "问题很难理解"
      }
    });
    tx.aIFeedback.update.mockResolvedValue({
      id: "feedback-1",
      revision: 4,
      status: "revoked",
      vote: "downvote",
      tags: ["too_abstract"],
      comment: "问题很难理解"
    });

    await revokeAIResponseFeedback("trace-1", "user-1");

    expect(tx.aIFeedbackRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ revision: 4, status: "revoked" })
    });
    expect(tx.aICase.update).toHaveBeenCalledWith({
      where: { traceId: "trace-1" },
      data: expect.objectContaining({
        classification: "good",
        sourceSignals: ["assistant_server_guard"],
        primaryIssueCode: null
      })
    });
    expect(tx.aIFewShotExample.updateMany).toHaveBeenCalledWith({
      where: { sourceTraceId: { in: ["trace-1"] }, status: { in: ["candidate", "active"] } },
      data: { status: "retired", retiredAt: expect.any(Date) }
    });
    expect(tx.aIResponseRegeneration.updateMany).toHaveBeenCalledWith({
      where: { generatedTraceId: { in: ["trace-1"] } },
      data: { downvotedAt: null }
    });
  });

  it("retires all consent-bound examples when a user leaves the quality program", async () => {
    tx.user.update.mockResolvedValue({
      privacyPolicyVersion: "2026-07-19",
      aiQualityConsentVersion: "2026-07-19",
      aiQualityConsentAt: null,
      aiQualityConsentRevokedAt: new Date()
    });
    tx.aIGenerationTrace.findMany.mockResolvedValue([
      {
        id: "trace-1",
        feedback: {
          id: "feedback-1",
          revision: 1,
          status: "active",
          vote: "upvote",
          tags: [],
          comment: null
        },
        evaluation: { totalScore: 60 },
        case: {
          sourceSignals: ["user_upvote", "assistant_server_guard"],
          primaryIssueCode: "user_downvote:free_text",
          summary: "用户反馈摘要"
        }
      },
      {
        id: "trace-auto-bad",
        feedback: null,
        evaluation: { totalScore: 55 },
        case: {
          sourceSignals: ["assistant_server_guard"],
          primaryIssueCode: "schema_parse_failed",
          summary: "自动质量问题"
        }
      }
    ]);
    tx.aIFeedback.update.mockResolvedValue({ id: "feedback-1" });
    tx.aIOptimizationCandidate.findMany.mockResolvedValue([
      { id: "candidate-approved" },
      { id: "candidate-draft" }
    ]);
    tx.aIOptimizationCandidate.findUnique
      .mockResolvedValueOnce({
        id: "candidate-approved",
        status: "approved",
        evidenceTraceIds: ["trace-auto-bad"],
        reviewedBy: null,
        reviewReason: null
      })
      .mockResolvedValueOnce({
        id: "candidate-draft",
        status: "draft",
        evidenceTraceIds: ["trace-1", "trace-2"],
        reviewedBy: null,
        reviewReason: null
      });
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: "candidate-approved" }])
      .mockResolvedValueOnce([{ id: "candidate-draft" }]);

    await recordAIQualityConsentDecision("user-1", false);

    expect(tx.aIFewShotExample.updateMany).toHaveBeenCalledWith({
      where: {
        sourceTraceId: { in: ["trace-1", "trace-auto-bad"] },
        status: { in: ["candidate", "active"] }
      },
      data: { status: "retired", retiredAt: expect.any(Date) }
    });
    expect(tx.aIResponseRegeneration.updateMany).toHaveBeenCalledWith({
      where: { generatedTraceId: { in: ["trace-1", "trace-auto-bad"] } },
      data: { downvotedAt: null }
    });
    expect(tx.aIOptimizationCandidate.findMany).toHaveBeenCalledWith({
      where: {
        evidenceTraceIds: { hasSome: ["trace-1", "trace-auto-bad"] },
        OR: [
          { status: { in: ["draft", "approved"] } },
          {
            status: "rejected",
            reviewedBy: "system:ai_quality_consent_withdrawal",
            reviewReason: "AI_QUALITY_CONSENT_WITHDRAWN"
          }
        ]
      },
      select: { id: true },
      orderBy: { id: "asc" }
    });
    expect(tx.aIOptimizationCandidate.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "candidate-approved",
        status: "approved"
      },
      data: {
        status: "rejected",
        evidenceTraceIds: [],
        reviewedBy: "system:ai_quality_consent_withdrawal",
        reviewedAt: expect.any(Date),
        reviewReason: "AI_QUALITY_CONSENT_WITHDRAWN"
      }
    });
    expect(tx.aIOptimizationCandidate.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "candidate-draft",
        status: "draft"
      },
      data: {
        status: "rejected",
        evidenceTraceIds: ["trace-2"],
        reviewedBy: "system:ai_quality_consent_withdrawal",
        reviewedAt: expect.any(Date),
        reviewReason: "AI_QUALITY_CONSENT_WITHDRAWN"
      }
    });
    expect(tx.aICase.update).toHaveBeenCalledWith({
      where: { traceId: "trace-1" },
      data: expect.objectContaining({
        classification: "bad",
        sourceSignals: ["assistant_server_guard"],
        primaryIssueCode: null,
        summary: "用户已撤回反馈，当前按自动评估结果分类。"
      })
    });
    expect(tx.aICase.update).toHaveBeenCalledTimes(1);
  });

  it("reads the locked candidate state before removing consent-bound trace references", async () => {
    tx.user.update.mockResolvedValue({
      privacyPolicyVersion: "2026-07-19",
      aiQualityConsentVersion: "2026-07-19",
      aiQualityConsentAt: null,
      aiQualityConsentRevokedAt: new Date()
    });
    tx.aIGenerationTrace.findMany.mockResolvedValue([{
      id: "trace-left",
      feedback: null,
      evaluation: null,
      case: null
    }]);
    tx.aIOptimizationCandidate.findMany.mockResolvedValue([{ id: "candidate-shared" }]);
    tx.$queryRaw.mockResolvedValue([{ id: "candidate-shared" }]);
    tx.aIOptimizationCandidate.findUnique.mockResolvedValue({
      id: "candidate-shared",
      status: "rejected",
      evidenceTraceIds: ["trace-right"],
      reviewedBy: "system:ai_quality_consent_withdrawal",
      reviewReason: "AI_QUALITY_CONSENT_WITHDRAWN"
    });

    await recordAIQualityConsentDecision("user-left", false);

    expect(tx.aIOptimizationCandidate.updateMany).not.toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.aIOptimizationCandidate.findUnique.mock.invocationCallOrder[0]
    );
  });
});
