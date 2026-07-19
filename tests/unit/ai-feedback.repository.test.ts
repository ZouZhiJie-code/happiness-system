const { prismaTransaction, tx } = vi.hoisted(() => {
  const transactionClient = {
    aIGenerationTrace: { findFirst: vi.fn(), update: vi.fn() },
    aIFeedback: { upsert: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    aIFeedbackRevision: { create: vi.fn() },
    aICase: { upsert: vi.fn(), update: vi.fn() },
    aIFewShotExample: { updateMany: vi.fn() },
    user: { update: vi.fn() }
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
  recordAIQualityConsentDecision,
  revokeAIResponseFeedback,
  saveAIResponseFeedback
} from "@/server/repositories/ai-feedback.repository";

describe("AI feedback repository", () => {
  beforeEach(() => vi.clearAllMocks());

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
      where: { sourceTraceId: "trace-1", status: { in: ["candidate", "active"] } },
      data: { status: "retired", retiredAt: expect.any(Date) }
    });
  });

  it("retires all consent-bound examples when a user leaves the quality program", async () => {
    tx.user.update.mockResolvedValue({
      privacyPolicyVersion: "2026-07-19",
      aiQualityConsentVersion: "2026-07-19",
      aiQualityConsentAt: null,
      aiQualityConsentRevokedAt: new Date()
    });
    tx.aIFeedback.findMany.mockResolvedValue([
      {
        id: "feedback-1",
        traceId: "trace-1",
        revision: 1,
        vote: "upvote",
        tags: [],
        comment: null
      }
    ]);
    tx.aIFeedback.update.mockResolvedValue({ id: "feedback-1" });

    await recordAIQualityConsentDecision("user-1", false);

    expect(tx.aIFewShotExample.updateMany).toHaveBeenCalledWith({
      where: { sourceTraceId: "trace-1", status: { in: ["candidate", "active"] } },
      data: { status: "retired", retiredAt: expect.any(Date) }
    });
  });
});
