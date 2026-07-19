const { requireAdminRequest, evaluatePendingGenerationTraces, runAIQualityIteration } = vi.hoisted(() => ({
  requireAdminRequest: vi.fn(),
  evaluatePendingGenerationTraces: vi.fn(),
  runAIQualityIteration: vi.fn()
}));

vi.mock("@/server/services/auth/admin-access", () => ({ requireAdminRequest }));
vi.mock("@/server/services/ai-quality/ai-evaluator.service", () => ({ evaluatePendingGenerationTraces }));
vi.mock("@/server/services/ai-quality/ai-iteration.service", () => ({ runAIQualityIteration }));

import { POST } from "@/app/api/admin/ai-quality/runs/route";

describe("manual AI quality run API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminRequest.mockResolvedValue({ id: "admin-1", username: "admin" });
    evaluatePendingGenerationTraces.mockResolvedValue({ scanned: 2, evaluated: 2, bad: 1, review: 0, good: 1 });
    runAIQualityIteration.mockResolvedValue({ runId: "run-1", candidates: 2, reused: 0, summary: "完成" });
  });

  it("evaluates a bounded batch before running the seven-day iteration", async () => {
    const response = await POST(new Request("http://localhost/api/admin/ai-quality/runs", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(evaluatePendingGenerationTraces).toHaveBeenCalledWith(20, {
      concurrency: 4,
      judgeTimeoutMs: 7_000,
      maxJudgeAttempts: 1
    });
    expect(runAIQualityIteration).toHaveBeenCalledWith({ lookbackDays: 7 });
    expect(evaluatePendingGenerationTraces.mock.invocationCallOrder[0]).toBeLessThan(
      runAIQualityIteration.mock.invocationCallOrder[0]
    );
  });

  it("requires an administrator session", async () => {
    requireAdminRequest.mockRejectedValue(new Error("ADMIN_FORBIDDEN"));
    const response = await POST(new Request("http://localhost/api/admin/ai-quality/runs", { method: "POST" }));
    expect(response.status).toBe(403);
    expect(evaluatePendingGenerationTraces).not.toHaveBeenCalled();
  });
});
