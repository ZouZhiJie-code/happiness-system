import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCurrentUserFromRequest, getInsightsTrends, getInsightsSelf } = vi.hoisted(() => ({
  requireCurrentUserFromRequest: vi.fn(),
  getInsightsTrends: vi.fn(),
  getInsightsSelf: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest,
  isAuthenticationRequiredError: () => false
}));
vi.mock("@/server/services/insights", async () => {
  const actual = await vi.importActual<typeof import("@/server/services/insights")>("@/server/services/insights");
  return { ...actual, getInsightsTrends, getInsightsSelf };
});
import { GET as getSelf } from "@/app/api/insights/self/route";
import { GET as getTrends } from "@/app/api/insights/trends/route";
import { InsightsRangeError } from "@/server/services/insights";

describe("insights api", () => {
  beforeEach(() => {
    requireCurrentUserFromRequest.mockResolvedValue({ id: "user-1" });
    getInsightsTrends.mockReset();
    getInsightsSelf.mockReset();
    getInsightsTrends.mockResolvedValue({ summary: {} });
    getInsightsSelf.mockResolvedValue({ title: "记录中的我" });
  });

  it("reads a private trends view", async () => {
    const response = await getTrends(new Request(
      "http://localhost/api/insights/trends?preset=custom&startDate=2026-08-01&endDate=2026-08-13"
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getInsightsTrends).toHaveBeenCalledWith("user-1", {
      preset: "custom",
      startDate: "2026-08-01",
      endDate: "2026-08-13"
    });
  });

  it("returns 400 for an invalid trends range", async () => {
    getInsightsTrends.mockRejectedValue(new InsightsRangeError("INVALID_INSIGHTS_RANGE"));
    const response = await getTrends(new Request("http://localhost/api/insights/trends?preset=year"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_INSIGHTS_RANGE" });
  });

  it("reads the factual self view", async () => {
    const response = await getSelf(new Request("http://localhost/api/insights/self"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getInsightsSelf).toHaveBeenCalledWith("user-1");
  });
});
