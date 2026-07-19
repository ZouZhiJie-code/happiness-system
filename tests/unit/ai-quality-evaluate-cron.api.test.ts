const { evaluatePendingGenerationTraces } = vi.hoisted(() => ({
  evaluatePendingGenerationTraces: vi.fn()
}));

vi.mock("@/server/services/ai-quality/ai-evaluator.service", () => ({
  evaluatePendingGenerationTraces
}));

import { GET } from "@/app/api/cron/ai-quality/evaluate/route";

describe("AI quality evaluation cron API", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    vi.clearAllMocks();
  });

  it("requires an explicitly configured cron secret", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(new Request("http://localhost/api/cron/ai-quality/evaluate"));

    expect(response.status).toBe(503);
    expect(evaluatePendingGenerationTraces).not.toHaveBeenCalled();
  });

  it("rejects an invalid bearer token", async () => {
    process.env.CRON_SECRET = "quality-secret";

    const response = await GET(
      new Request("http://localhost/api/cron/ai-quality/evaluate", {
        headers: { authorization: "Bearer wrong-secret" }
      })
    );

    expect(response.status).toBe(401);
  });

  it("evaluates a bounded batch with valid cron authorization", async () => {
    process.env.CRON_SECRET = "quality-secret";
    evaluatePendingGenerationTraces.mockResolvedValue({ scanned: 12, evaluated: 12, bad: 2, review: 3, good: 7 });

    const response = await GET(
      new Request("http://localhost/api/cron/ai-quality/evaluate?limit=1000", {
        headers: { authorization: "Bearer quality-secret" }
      })
    );

    expect(response.status).toBe(200);
    expect(evaluatePendingGenerationTraces).toHaveBeenCalledWith(100);
    await expect(response.json()).resolves.toEqual({ scanned: 12, evaluated: 12, bad: 2, review: 3, good: 7 });
  });
});
