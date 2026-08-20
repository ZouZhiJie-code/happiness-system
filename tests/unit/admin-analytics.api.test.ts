const {
  mockGetAdminAnalyticsFunnel,
  mockGetAdminAnalyticsOverview,
  mockGetAdminAnalyticsQuality,
  mockGetAdminAnalyticsRetention
} = vi.hoisted(() => ({
  mockGetAdminAnalyticsFunnel: vi.fn(),
  mockGetAdminAnalyticsOverview: vi.fn(),
  mockGetAdminAnalyticsQuality: vi.fn(),
  mockGetAdminAnalyticsRetention: vi.fn()
}));

const {
  MockAdminAuthorizationError,
  mockRequireAdminRequest
} = vi.hoisted(() => ({
  MockAdminAuthorizationError: class AdminAuthorizationError extends Error {},
  mockRequireAdminRequest: vi.fn()
}));

vi.mock("@/server/services/admin-analytics/admin-analytics.service", () => ({
  AdminAnalyticsQueryError: class AdminAnalyticsQueryError extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  getAdminAnalyticsFunnel: mockGetAdminAnalyticsFunnel,
  getAdminAnalyticsOverview: mockGetAdminAnalyticsOverview,
  getAdminAnalyticsQuality: mockGetAdminAnalyticsQuality,
  getAdminAnalyticsRetention: mockGetAdminAnalyticsRetention
}));

vi.mock("@/server/services/auth/admin-access", () => ({
  AdminAuthorizationError: MockAdminAuthorizationError,
  requireAdminRequest: mockRequireAdminRequest
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  AuthenticationError: class AuthenticationError extends Error {}
}));

import { GET as getFunnelRoute } from "@/app/api/admin/analytics/funnel/route";
import { GET as getOverviewRoute } from "@/app/api/admin/analytics/overview/route";
import { GET as getQualityRoute } from "@/app/api/admin/analytics/quality/route";
import { GET as getRetentionRoute } from "@/app/api/admin/analytics/retention/route";

describe("admin analytics api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminRequest.mockResolvedValue({
      id: "user-1",
      username: "admin_user"
    });
  });

  it("returns overview data for admin requests", async () => {
    mockGetAdminAnalyticsOverview.mockResolvedValue({
      contractVersion: 2,
      range: { startDate: "2026-05-01", endDate: "2026-05-31" },
      northStar: { name: "MRU-7", value: 12 },
      overview: {
        savedJournalUsers: 8,
        savedJournalCount: 15,
        savedDailyJournalUsers: 5,
        savedDailyJournalCount: 7,
        happinessScoreUsers: 9,
        happinessScoreCount: 18
      },
      currentOverview: {
        savedEventCardUsers: 7,
        savedEventCardCount: 13,
        savedDailyJournalUsers: 4,
        savedDailyJournalCount: 6
      },
      legacyOverview: {
        savedJournalUsers: 8,
        savedJournalCount: 15,
        savedDailyJournalUsers: 5,
        savedDailyJournalCount: 7,
        happinessScoreUsers: 9,
        happinessScoreCount: 18
      },
      ai: { successRate: 0.92, p50LatencyMs: 820, p95LatencyMs: 1840 }
    });

    const response = await getOverviewRoute(
      new Request("http://localhost/api/admin/analytics/overview?startDate=2026-05-01&endDate=2026-05-31")
    );

    expect(response.status).toBe(200);
    expect(mockRequireAdminRequest).toHaveBeenCalledTimes(1);
    expect(mockGetAdminAnalyticsOverview).toHaveBeenCalledWith({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });
  });

  it("returns funnel, retention, and quality data for admin requests", async () => {
    mockGetAdminAnalyticsFunnel.mockResolvedValue({
      contractVersion: 2,
      currentProductFunnel: [],
      legacyFunnel: { mainFunnel: [], secondaryFunnel: [], qualitySignals: {} },
      mainFunnel: [],
      secondaryFunnel: [],
      qualitySignals: {}
    });
    mockGetAdminAnalyticsRetention.mockResolvedValue({
      contractVersion: 2,
      timezone: "Asia/Shanghai",
      cohort: { anchor: "first_event_journal_saved", userCount: 10 },
      retention: {
        d1ReturnToRecordRate: 0.4,
        d7ReturnToRecordRate: 0.3,
        d30ReturnToRecordRate: 0.1,
        d7RepeatSaveRate: 0.25,
        d30RepeatSaveRate: 0.09
      },
      eligibility: { d1EligibleUsers: 10, d7EligibleUsers: 9, d30EligibleUsers: 5 },
      d1ReturnToRecordRate: 0.4,
      d7ReturnToRecordRate: 0.3,
      d30ReturnToRecordRate: 0.1,
      d7RepeatSaveRate: 0.25,
      d30RepeatSaveRate: 0.09
    });
    mockGetAdminAnalyticsQuality.mockResolvedValue({
      contractVersion: 2,
      qualitySignals: {
        fallbackRate: 0,
        abnormalExitRate: 0,
        resumeSuccessRate: 0,
        staleRate: 0.05,
        firstVisibleLatency: { sampleCount: 0, p50Ms: null, p95Ms: null },
        fullInteractionLatency: { sampleCount: 0, p50Ms: null, p95Ms: null },
        counts: {
          completedResponses: 0,
          fallbackTurns: 0,
          startedSessions: 0,
          abandonedSessions: 0,
          resumeStarted: 0,
          resumeCompleted: 0,
          resumeFailed: 0
        }
      },
      dimensionSaveBreakdown: [],
      draftEditRate: 0.2,
      boundaryInsufficientRate: 0.1,
      staleRate: 0.05,
      ai: { successRate: 0.9, p50LatencyMs: 800, p95LatencyMs: 1800, errorCodeBreakdown: [] },
      legacyQuality: {
        dimensionSaveBreakdown: [],
        draftEditRate: 0.2,
        boundaryInsufficientRate: 0.1,
        ai: { successRate: 0.9, p50LatencyMs: 800, p95LatencyMs: 1800, errorCodeBreakdown: [] }
      }
    });

    const funnelResponse = await getFunnelRoute(
      new Request("http://localhost/api/admin/analytics/funnel?startDate=2026-05-01&endDate=2026-05-31")
    );
    const retentionResponse = await getRetentionRoute(
      new Request("http://localhost/api/admin/analytics/retention?startDate=2026-05-01&endDate=2026-05-31")
    );
    const qualityResponse = await getQualityRoute(
      new Request("http://localhost/api/admin/analytics/quality?startDate=2026-05-01&endDate=2026-05-31")
    );

    expect(funnelResponse.status).toBe(200);
    expect(retentionResponse.status).toBe(200);
    expect(qualityResponse.status).toBe(200);
    await expect(funnelResponse.json()).resolves.toMatchObject({ contractVersion: 2 });
    await expect(retentionResponse.json()).resolves.toMatchObject({ contractVersion: 2 });
    await expect(qualityResponse.json()).resolves.toMatchObject({ contractVersion: 2 });
  });

  it("returns 403 for authenticated non-admin callers", async () => {
    mockRequireAdminRequest.mockRejectedValue(new MockAdminAuthorizationError("ADMIN_FORBIDDEN"));

    const response = await getOverviewRoute(
      new Request("http://localhost/api/admin/analytics/overview?startDate=2026-05-01&endDate=2026-05-31")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "ADMIN_FORBIDDEN" });
  });

  it("returns 401 when authentication is missing", async () => {
    mockRequireAdminRequest.mockRejectedValue(new Error("AUTHENTICATION_REQUIRED"));

    const response = await getFunnelRoute(
      new Request("http://localhost/api/admin/analytics/funnel?startDate=2026-05-01&endDate=2026-05-31")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });
  });

  it("returns 400 for invalid ranges and 500 for unexpected failures", async () => {
    mockGetAdminAnalyticsQuality.mockRejectedValueOnce({ code: "INVALID_ADMIN_ANALYTICS_RANGE" });
    mockGetAdminAnalyticsRetention.mockRejectedValueOnce(new Error("db unavailable"));

    const badRequest = await getQualityRoute(
      new Request("http://localhost/api/admin/analytics/quality?startDate=2026-05-31&endDate=2026-05-01")
    );
    const failedRequest = await getRetentionRoute(
      new Request("http://localhost/api/admin/analytics/retention?startDate=2026-05-01&endDate=2026-05-31")
    );

    expect(badRequest.status).toBe(400);
    expect(failedRequest.status).toBe(500);
    await expect(badRequest.json()).resolves.toEqual({ error: "INVALID_ADMIN_ANALYTICS_RANGE" });
    await expect(failedRequest.json()).resolves.toEqual({ error: "ADMIN_ANALYTICS_QUERY_FAILED" });
  });
});
