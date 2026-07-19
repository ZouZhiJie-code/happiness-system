const {
  findFeedbackContext,
  getAIQualityConsent,
  recordAIQualityConsentDecision,
  revokeAIResponseFeedback,
  saveAIResponseFeedback
} = vi.hoisted(() => ({
  findFeedbackContext: vi.fn(),
  getAIQualityConsent: vi.fn(),
  recordAIQualityConsentDecision: vi.fn(),
  revokeAIResponseFeedback: vi.fn(),
  saveAIResponseFeedback: vi.fn()
}));

vi.mock("@/server/repositories/ai-feedback.repository", () => ({
  findFeedbackContext,
  getAIQualityConsent,
  recordAIQualityConsentDecision,
  revokeAIResponseFeedback,
  saveAIResponseFeedback
}));

import { CURRENT_PRIVACY_POLICY_VERSION } from "@/features/ai-feedback/feedback-config";
import {
  getAIResponseFeedback,
  submitAIResponseFeedback,
  updateAIQualityConsent
} from "@/server/services/ai-quality/ai-feedback.service";

const currentConsent = {
  privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
  aiQualityConsentVersion: CURRENT_PRIVACY_POLICY_VERSION,
  aiQualityConsentAt: new Date("2026-07-19T00:00:00.000Z"),
  aiQualityConsentRevokedAt: null
};

describe("AI feedback service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires current versioned consent before accepting feedback", async () => {
    getAIQualityConsent.mockResolvedValue({
      ...currentConsent,
      aiQualityConsentVersion: null,
      aiQualityConsentAt: null
    });

    await expect(
      submitAIResponseFeedback({
        traceId: "trace-1",
        userId: "user-1",
        vote: "upvote",
        tags: []
      })
    ).rejects.toEqual(expect.objectContaining({ code: "CONSENT_REQUIRED" }));
    expect(saveAIResponseFeedback).not.toHaveBeenCalled();
  });

  it("returns artifact-specific labels and rejects cross-artifact tags", async () => {
    getAIQualityConsent.mockResolvedValue(currentConsent);
    findFeedbackContext.mockResolvedValue({
      id: "trace-1",
      artifactType: "interview_turn",
      feedback: null
    });

    const context = await getAIResponseFeedback("trace-1", "user-1");
    expect(context.tags.downvote).toHaveLength(6);
    expect(context.tags.downvote.map((item) => item.code)).toContain("ignored_boundary");
    expect(context.tags.upvote.map((item) => item.code)).toContain("understood_accurately");

    await expect(
      submitAIResponseFeedback({
        traceId: "trace-1",
        userId: "user-1",
        vote: "downvote",
        tags: ["bad_title"]
      })
    ).rejects.toEqual(expect.objectContaining({ code: "INVALID_FEEDBACK_TAG" }));
  });

  it("normalizes free text and saves feedback against the exact trace", async () => {
    getAIQualityConsent.mockResolvedValue(currentConsent);
    findFeedbackContext.mockResolvedValue({
      id: "trace-journal",
      artifactType: "dimension_journal",
      feedback: null
    });
    saveAIResponseFeedback.mockResolvedValue({ id: "feedback-1", revision: 1 });

    await submitAIResponseFeedback({
      traceId: "trace-journal",
      userId: "user-1",
      vote: "downvote",
      tags: ["voice_mismatch"],
      comment: "  这不像我平时写日记的语气。  "
    });

    expect(saveAIResponseFeedback).toHaveBeenCalledWith({
      traceId: "trace-journal",
      userId: "user-1",
      vote: "downvote",
      tags: ["voice_mismatch"],
      comment: "这不像我平时写日记的语气。"
    });
  });

  it("keeps AI quality participation enabled through the public service", async () => {
    await expect(updateAIQualityConsent("user-1", false)).rejects.toEqual(
      expect.objectContaining({ code: "AI_QUALITY_PARTICIPATION_REQUIRED" })
    );
    expect(recordAIQualityConsentDecision).not.toHaveBeenCalled();
  });
});
