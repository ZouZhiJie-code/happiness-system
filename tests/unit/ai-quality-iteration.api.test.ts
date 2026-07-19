const { requireAdminRequest, runAIQualityIteration, getAIOptimizationCandidates, reviewAIOptimizationCandidate } = vi.hoisted(() => ({
  requireAdminRequest: vi.fn(),
  runAIQualityIteration: vi.fn(),
  getAIOptimizationCandidates: vi.fn(),
  reviewAIOptimizationCandidate: vi.fn()
}));

vi.mock("@/server/services/auth/admin-access", () => ({ requireAdminRequest }));
vi.mock("@/server/services/ai-quality/ai-iteration.service", () => ({
  runAIQualityIteration,
  getAIOptimizationCandidates,
  reviewAIOptimizationCandidate
}));

import { GET as listCandidates } from "@/app/api/admin/ai-quality/candidates/route";
import { PATCH } from "@/app/api/admin/ai-quality/candidates/[candidateId]/route";
import { GET as runIteration } from "@/app/api/cron/ai-quality/iterate/route";

describe("AI quality iteration APIs", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("runs the weekly worker only with the cron bearer secret", async () => {
    process.env.CRON_SECRET = "iteration-secret";
    runAIQualityIteration.mockResolvedValue({ runId: "run-1", clusters: 2, candidates: 3, summary: "完成" });

    const denied = await runIteration(new Request("http://localhost/api/cron/ai-quality/iterate"));
    const allowed = await runIteration(
      new Request("http://localhost/api/cron/ai-quality/iterate", {
        headers: { authorization: "Bearer iteration-secret" }
      })
    );

    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
    expect(runAIQualityIteration).toHaveBeenCalledTimes(1);
  });

  it("requires admin access for listing and reviewing candidates", async () => {
    requireAdminRequest.mockResolvedValue({ id: "admin-1", username: "admin" });
    getAIOptimizationCandidates.mockResolvedValue([{ id: "candidate-1", status: "draft" }]);
    reviewAIOptimizationCandidate.mockResolvedValue({ id: "candidate-1", status: "approved" });

    const listResponse = await listCandidates(new Request("http://localhost/api/admin/ai-quality/candidates"));
    const patchResponse = await PATCH(
      new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" })
      }),
      { params: Promise.resolve({ candidateId: "candidate-1" }) }
    );

    expect(listResponse.status).toBe(200);
    expect(patchResponse.status).toBe(200);
    expect(requireAdminRequest).toHaveBeenCalledTimes(2);
    expect(reviewAIOptimizationCandidate).toHaveBeenCalledWith({
      candidateId: "candidate-1",
      action: "approve",
      adminUsername: "admin"
    });
  });

  it("rejects malformed review actions before changing candidate state", async () => {
    requireAdminRequest.mockResolvedValue({ id: "admin-1", username: "admin" });

    const response = await PATCH(
      new Request("http://localhost/api/admin/ai-quality/candidates/candidate-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "auto_publish" })
      }),
      { params: Promise.resolve({ candidateId: "candidate-1" }) }
    );

    expect(response.status).toBe(400);
    expect(reviewAIOptimizationCandidate).not.toHaveBeenCalled();
  });
});
