const { validateAIOptimizationCandidate, requireAdminRequest } = vi.hoisted(() => ({
  validateAIOptimizationCandidate: vi.fn(),
  requireAdminRequest: vi.fn()
}));

vi.mock("@/server/services/ai-quality/ai-candidate-validation.service", () => ({ validateAIOptimizationCandidate }));
vi.mock("@/server/services/auth/admin-access", () => ({ requireAdminRequest }));

import { POST } from "@/app/api/admin/ai-quality/candidates/[candidateId]/validate/route";

describe("AI candidate validation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminRequest.mockResolvedValue({ id: "admin-1", username: "admin_user" });
  });

  it("starts validation for an admin candidate", async () => {
    validateAIOptimizationCandidate.mockResolvedValue({
      id: "validation-1",
      status: "passed",
      targetCaseCount: 1,
      targetPassedCount: 1,
      regressionCaseCount: 1,
      regressionPassedCount: 1,
      criticalRegressionCount: 0,
      averageScoreDelta: 8,
      summary: "验证通过",
      errorCode: null,
      startedAt: new Date("2026-08-20T00:00:00.000Z"),
      completedAt: new Date("2026-08-20T00:00:01.000Z"),
      results: [{
        traceId: "trace-1",
        inputSnapshot: { userMessage: "private input" },
        requestMessages: [{ role: "user", content: "private request" }],
        candidateOutput: { question: "private output" },
        output: { question: "private output alias" }
      }]
    });
    const response = await POST(new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/validate", { method: "POST" }), {
      params: Promise.resolve({ candidateId: "candidate-1" })
    });
    expect(response.status).toBe(200);
    expect(validateAIOptimizationCandidate).toHaveBeenCalledWith({ candidateId: "candidate-1", adminUsername: "admin_user" });
    const payload = await response.json();
    expect(payload).toEqual({
      validation: {
        id: "validation-1",
        status: "passed",
        targetCaseCount: 1,
        targetPassedCount: 1,
        regressionCaseCount: 1,
        regressionPassedCount: 1,
        criticalRegressionCount: 0,
        averageScoreDelta: 8,
        summary: "验证通过",
        errorCode: null,
        startedAt: "2026-08-20T00:00:00.000Z",
        completedAt: "2026-08-20T00:00:01.000Z"
      }
    });
    const serialized = JSON.stringify(payload);
    for (const forbiddenField of [
      "results",
      "candidateOutput",
      "inputSnapshot",
      "requestMessages",
      "private input",
      "private output",
      "private request"
    ]) expect(serialized).not.toContain(forbiddenField);
    expect(payload.validation).not.toHaveProperty("results");
  });

  it("returns 403 for a non-admin caller", async () => {
    requireAdminRequest.mockRejectedValue(new Error("ADMIN_FORBIDDEN"));
    const response = await POST(new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/validate", { method: "POST" }), {
      params: Promise.resolve({ candidateId: "candidate-1" })
    });
    expect(response.status).toBe(403);
  });

  it("returns a structured conflict when validation is already running", async () => {
    validateAIOptimizationCandidate.mockRejectedValue(
      new Error("OPTIMIZATION_VALIDATION_ALREADY_RUNNING")
    );
    const response = await POST(
      new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/validate", { method: "POST" }),
      { params: Promise.resolve({ candidateId: "candidate-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "OPTIMIZATION_VALIDATION_ALREADY_RUNNING"
    });
  });
});
