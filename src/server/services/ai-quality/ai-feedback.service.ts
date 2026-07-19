import {
  CURRENT_PRIVACY_POLICY_VERSION,
  getFeedbackTags,
  hasCurrentAIQualityConsent
} from "@/features/ai-feedback/feedback-config";
import {
  findFeedbackContext,
  getAIQualityConsent,
  recordAIQualityConsentDecision,
  revokeAIResponseFeedback,
  saveAIResponseFeedback
} from "@/server/repositories/ai-feedback.repository";

export class AIFeedbackError extends Error {
  constructor(
    readonly code:
      | "TRACE_NOT_FOUND"
      | "CONSENT_REQUIRED"
      | "INVALID_FEEDBACK_TAG"
      | "AI_QUALITY_PARTICIPATION_REQUIRED"
  ) {
    super(code);
  }
}

export async function getAIQualityConsentState(userId: string) {
  const user = await getAIQualityConsent(userId);
  if (!user) throw new AIFeedbackError("TRACE_NOT_FOUND");

  return {
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    decisionRequired: user.aiQualityConsentVersion !== CURRENT_PRIVACY_POLICY_VERSION,
    participated: hasCurrentAIQualityConsent(user)
  };
}

export async function updateAIQualityConsent(userId: string, participate: boolean) {
  if (!participate) {
    throw new AIFeedbackError("AI_QUALITY_PARTICIPATION_REQUIRED");
  }
  const user = await recordAIQualityConsentDecision(userId, participate);
  return {
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    decisionRequired: false,
    participated: hasCurrentAIQualityConsent(user)
  };
}

async function requireCurrentConsent(userId: string) {
  const consent = await getAIQualityConsent(userId);
  if (!consent || !hasCurrentAIQualityConsent(consent)) {
    throw new AIFeedbackError("CONSENT_REQUIRED");
  }
}

export async function getAIResponseFeedback(traceId: string, userId: string) {
  const trace = await findFeedbackContext(traceId, userId);
  if (!trace) throw new AIFeedbackError("TRACE_NOT_FOUND");
  const consent = await getAIQualityConsentState(userId);

  return {
    traceId,
    artifactType: trace.artifactType,
    tags: {
      upvote: getFeedbackTags(trace.artifactType, "upvote"),
      downvote: getFeedbackTags(trace.artifactType, "downvote")
    },
    consent,
    feedback: trace.feedback?.status === "active" ? trace.feedback : null
  };
}

export async function submitAIResponseFeedback(input: {
  traceId: string;
  userId: string;
  vote: "upvote" | "downvote";
  tags: string[];
  comment?: string | null;
}) {
  await requireCurrentConsent(input.userId);
  const trace = await findFeedbackContext(input.traceId, input.userId);
  if (!trace) throw new AIFeedbackError("TRACE_NOT_FOUND");

  const allowedTags = new Set<string>(getFeedbackTags(trace.artifactType, input.vote).map((item) => item.code));
  if (input.tags.some((tag) => !allowedTags.has(tag))) {
    throw new AIFeedbackError("INVALID_FEEDBACK_TAG");
  }

  const feedback = await saveAIResponseFeedback({
    traceId: input.traceId,
    userId: input.userId,
    vote: input.vote,
    tags: input.tags,
    comment: input.comment?.trim() || null
  });
  if (!feedback) throw new AIFeedbackError("TRACE_NOT_FOUND");

  return feedback;
}

export async function revokeAIResponseFeedbackForUser(traceId: string, userId: string) {
  const trace = await findFeedbackContext(traceId, userId);
  if (!trace) throw new AIFeedbackError("TRACE_NOT_FOUND");
  return revokeAIResponseFeedback(traceId, userId);
}
