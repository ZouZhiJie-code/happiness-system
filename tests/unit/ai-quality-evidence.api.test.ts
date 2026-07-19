const { getAIOptimizationCandidateEvidence, requireAdminRequest } = vi.hoisted(() => ({
  getAIOptimizationCandidateEvidence: vi.fn(),
  requireAdminRequest: vi.fn()
}));

vi.mock("@/server/services/ai-quality/ai-quality-evidence.service", () => ({
  getAIOptimizationCandidateEvidence
}));

vi.mock("@/server/services/auth/admin-access", () => ({
  requireAdminRequest
}));

import { GET } from "@/app/api/admin/ai-quality/candidates/[candidateId]/evidence/route";

describe("AI quality candidate evidence API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminRequest.mockResolvedValue({ id: "admin-1", username: "admin_user" });
  });

  it("loads a requested evidence page for an administrator", async () => {
    getAIOptimizationCandidateEvidence.mockResolvedValue({
      candidateId: "candidate-1",
      page: 2,
      pageSize: 5,
      total: 8,
      totalPages: 2,
      items: []
    });

    const response = await GET(
      new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/evidence?page=2"),
      { params: Promise.resolve({ candidateId: "candidate-1" }) }
    );

    expect(response.status).toBe(200);
    expect(getAIOptimizationCandidateEvidence).toHaveBeenCalledWith({
      candidateId: "candidate-1",
      adminUsername: "admin_user",
      page: 2
    });
  });

  it("returns structured authorization and missing-candidate errors", async () => {
    requireAdminRequest.mockRejectedValueOnce(new Error("ADMIN_FORBIDDEN"));
    const forbidden = await GET(new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/evidence"), {
      params: Promise.resolve({ candidateId: "candidate-1" })
    });
    expect(forbidden.status).toBe(403);

    requireAdminRequest.mockResolvedValue({ id: "admin-1", username: "admin_user" });
    getAIOptimizationCandidateEvidence.mockRejectedValue(new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND"));
    const missing = await GET(new Request("http://localhost/api/admin/ai-quality/candidates/missing/evidence"), {
      params: Promise.resolve({ candidateId: "missing" })
    });
    expect(missing.status).toBe(404);
  });
});
