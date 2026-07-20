const service = vi.hoisted(() => ({
  getAIQualityCandidateImpact: vi.fn(),
  getAIQualityCandidateImpactEvidence: vi.fn()
}));
const requireAdminRequest = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/ai-quality/ai-quality-impact.service", () => service);
vi.mock("@/server/services/auth/admin-access", () => ({ requireAdminRequest }));

import { GET as getImpact } from "@/app/api/admin/ai-quality/candidates/[candidateId]/impact/route";
import { GET as getEvidence } from "@/app/api/admin/ai-quality/candidates/[candidateId]/impact/evidence/route";

describe("AI quality impact APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminRequest.mockResolvedValue({ id: "admin-1", username: "admin_user" });
  });

  it("loads candidate impact for an administrator", async () => {
    service.getAIQualityCandidateImpact.mockResolvedValue({ candidateId: "candidate-1" });
    const response = await getImpact(
      new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/impact"),
      { params: Promise.resolve({ candidateId: "candidate-1" }) }
    );
    expect(response.status).toBe(200);
    expect(service.getAIQualityCandidateImpact).toHaveBeenCalledWith("candidate-1");
  });

  it("validates evidence kind and passes pagination plus administrator identity", async () => {
    const invalid = await getEvidence(
      new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/impact/evidence?kind=unknown"),
      { params: Promise.resolve({ candidateId: "candidate-1" }) }
    );
    expect(invalid.status).toBe(400);

    service.getAIQualityCandidateImpactEvidence.mockResolvedValue({ candidateId: "candidate-1", items: [] });
    const response = await getEvidence(
      new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/impact/evidence?kind=attention&page=2"),
      { params: Promise.resolve({ candidateId: "candidate-1" }) }
    );
    expect(response.status).toBe(200);
    expect(service.getAIQualityCandidateImpactEvidence).toHaveBeenCalledWith({
      candidateId: "candidate-1",
      adminUsername: "admin_user",
      kind: "attention",
      page: 2
    });
  });

  it("returns structured authorization and request identifiers", async () => {
    requireAdminRequest.mockRejectedValue(new Error("ADMIN_FORBIDDEN"));
    const response = await getImpact(
      new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1/impact"),
      { params: Promise.resolve({ candidateId: "candidate-1" }) }
    );
    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: "ADMIN_FORBIDDEN", code: "ADMIN_FORBIDDEN" });
    expect(payload.requestId).toEqual(expect.any(String));
  });
});
