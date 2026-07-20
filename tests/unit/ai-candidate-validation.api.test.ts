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
    validateAIOptimizationCandidate.mockResolvedValue({ id: "validation-1", status: "passed" });
    const response = await POST(new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/validate", { method: "POST" }), {
      params: Promise.resolve({ candidateId: "candidate-1" })
    });
    expect(response.status).toBe(200);
    expect(validateAIOptimizationCandidate).toHaveBeenCalledWith({ candidateId: "candidate-1", adminUsername: "admin_user" });
  });

  it("returns 403 for a non-admin caller", async () => {
    requireAdminRequest.mockRejectedValue(new Error("ADMIN_FORBIDDEN"));
    const response = await POST(new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/validate", { method: "POST" }), {
      params: Promise.resolve({ candidateId: "candidate-1" })
    });
    expect(response.status).toBe(403);
  });
});
