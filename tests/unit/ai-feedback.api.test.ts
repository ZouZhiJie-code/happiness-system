const {
  requireCurrentUserFromRequest,
  getAIResponseFeedback,
  submitAIResponseFeedback,
  revokeAIResponseFeedbackForUser,
  getAIQualityConsentState,
  updateAIQualityConsent
} = vi.hoisted(() => ({
  requireCurrentUserFromRequest: vi.fn(),
  getAIResponseFeedback: vi.fn(),
  submitAIResponseFeedback: vi.fn(),
  revokeAIResponseFeedbackForUser: vi.fn(),
  getAIQualityConsentState: vi.fn(),
  updateAIQualityConsent: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest,
  isAuthenticationRequiredError: (error: unknown) => error instanceof Error && error.message === "AUTHENTICATION_REQUIRED"
}));

vi.mock("@/server/services/ai-quality/ai-feedback.service", async () => {
  const actual = await vi.importActual<typeof import("@/server/services/ai-quality/ai-feedback.service")>(
    "@/server/services/ai-quality/ai-feedback.service"
  );
  return {
    ...actual,
    getAIResponseFeedback,
    submitAIResponseFeedback,
    revokeAIResponseFeedbackForUser,
    getAIQualityConsentState,
    updateAIQualityConsent
  };
});

import { DELETE, GET as getFeedback, PUT } from "@/app/api/ai-feedback/[traceId]/route";
import { GET as getConsent, PATCH as patchConsent } from "@/app/api/ai-feedback/consent/route";

const context = { params: Promise.resolve({ traceId: "trace-1" }) };

describe("AI feedback API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentUserFromRequest.mockResolvedValue({ id: "user-1", username: "daily_light" });
  });

  it("binds feedback reads and writes to the authenticated user and trace", async () => {
    getAIResponseFeedback.mockResolvedValue({ traceId: "trace-1", feedback: null });
    submitAIResponseFeedback.mockResolvedValue({ id: "feedback-1", revision: 1 });

    const getResponse = await getFeedback(new Request("http://localhost/api/ai-feedback/trace-1"), context);
    const putResponse = await PUT(
      new Request("http://localhost/api/ai-feedback/trace-1", {
        method: "PUT",
        body: JSON.stringify({ vote: "downvote", tags: ["too_abstract"], comment: "问题太绕" })
      }),
      context
    );

    expect(getResponse.status).toBe(200);
    expect(putResponse.status).toBe(200);
    expect(getAIResponseFeedback).toHaveBeenCalledWith("trace-1", "user-1");
    expect(submitAIResponseFeedback).toHaveBeenCalledWith({
      traceId: "trace-1",
      userId: "user-1",
      vote: "downvote",
      tags: ["too_abstract"],
      comment: "问题太绕"
    });
  });

  it("supports revocation and rejects an empty downvote", async () => {
    revokeAIResponseFeedbackForUser.mockResolvedValue({ id: "feedback-1", status: "revoked" });

    const invalidResponse = await PUT(
      new Request("http://localhost/api/ai-feedback/trace-1", {
        method: "PUT",
        body: JSON.stringify({ vote: "downvote", tags: [], comment: "" })
      }),
      context
    );
    const deleteResponse = await DELETE(
      new Request("http://localhost/api/ai-feedback/trace-1", { method: "DELETE" }),
      context
    );

    expect(invalidResponse.status).toBe(400);
    expect(deleteResponse.status).toBe(200);
    expect(revokeAIResponseFeedbackForUser).toHaveBeenCalledWith("trace-1", "user-1");
  });

  it("exposes and updates versioned quality consent", async () => {
    getAIQualityConsentState.mockResolvedValue({ policyVersion: "2026-07-19", decisionRequired: true, participated: false });
    updateAIQualityConsent.mockResolvedValue({ policyVersion: "2026-07-19", decisionRequired: false, participated: true });

    const getResponse = await getConsent(new Request("http://localhost/api/ai-feedback/consent"));
    const patchResponse = await patchConsent(
      new Request("http://localhost/api/ai-feedback/consent", {
        method: "PATCH",
        body: JSON.stringify({ participate: true })
      })
    );

    expect(getResponse.status).toBe(200);
    expect(patchResponse.status).toBe(200);
    expect(updateAIQualityConsent).toHaveBeenCalledWith("user-1", true);

    const optOutResponse = await patchConsent(
      new Request("http://localhost/api/ai-feedback/consent", {
        method: "PATCH",
        body: JSON.stringify({ participate: false })
      })
    );
    expect(optOutResponse.status).toBe(409);
  });
});
