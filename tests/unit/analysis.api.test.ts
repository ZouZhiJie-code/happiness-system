const { getAnalysisMonth, getAnalysisTrendsRange, AnalysisQueryError } = vi.hoisted(() => ({
  getAnalysisMonth: vi.fn(),
  getAnalysisTrendsRange: vi.fn(),
  AnalysisQueryError: class extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
}));

const { mockRequireCurrentUserFromRequest } = vi.hoisted(() => ({
  mockRequireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/analysis/analysis.service", () => ({
  getAnalysisMonth,
  getAnalysisTrendsRange,
  AnalysisQueryError
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest
}));

import { GET as getAnalysisMonthRoute } from "@/app/api/analysis/month/route";
import { GET as getAnalysisRangeRoute } from "@/app/api/analysis/range/route";

describe("analysis api route", () => {
  beforeEach(() => {
    getAnalysisMonth.mockReset();
    getAnalysisTrendsRange.mockReset();
    mockRequireCurrentUserFromRequest.mockReset();
    mockRequireCurrentUserFromRequest.mockResolvedValue({ id: "user-1", username: "daily_light_01" });
  });

  it("returns a full month analysis payload", async () => {
    getAnalysisMonth.mockResolvedValue({
      month: "2026-05",
      logOverview: {
        recordedDayCount: 2,
        savedEntryCount: 4,
        dailyJournalSavedDayCount: 1
      },
      dailyCoverage: [],
      rhythmOverview: {
        activeObservedDayCount: 1,
        scoreOnlyDayCount: 1,
        pendingDailyJournalCount: 0,
        longestStreak: null,
        longestGap: null,
        latestActiveDate: "2026-05-02",
        latestScoreOnlyDate: "2026-05-03",
        latestPendingDailyJournalDate: null
      },
      dimensionBreakdown: [],
      dimensions: [],
      insightsOverview: {
        headline: "开心是这个月最清楚的一条线。",
        summary: "这个月更成形的是开心这条线。",
        watchpoint: null,
        featuredDimension: "joy",
        quietDimensions: ["fulfillment", "improvement"],
        links: []
      },
      scoreOverview: {
        scoredDayCount: 1,
        monthAverageScore: 7.5,
        latestScoredDate: "2026-05-03"
      },
      scoreTrend: {
        days: [
          {
            date: "2026-05-01",
            averageScore: null,
            scores: {
              meaning: null,
              health: null,
              virtue: null,
              autonomy: null,
              interest: null,
              skill: null,
              relationship: null,
              livingCondition: null
            },
            hasScore: false
          },
          {
            date: "2026-05-03",
            averageScore: 7.5,
            scores: {
              meaning: 8,
              health: 7,
              virtue: 9,
              autonomy: 6,
              interest: 8,
              skill: 7,
              relationship: 9,
              livingCondition: 6
            },
            hasScore: true
          }
        ],
        factorAverages: {
          meaning: 8,
          health: 7,
          virtue: 9,
          autonomy: 6,
          interest: 8,
          skill: 7,
          relationship: 9,
          livingCondition: 6
        }
      },
      scoreRecords: [
        {
          id: "score-1",
          date: "2026-05-03",
          meaningScore: 8,
          healthScore: 7,
          virtueScore: 9,
          autonomyScore: 6,
          interestScore: 8,
          skillScore: 7,
          relationshipScore: 9,
          livingConditionScore: 6,
          createdAt: "2026-05-03T01:00:00.000Z",
          updatedAt: "2026-05-03T02:00:00.000Z"
        }
      ],
      editableDates: ["2026-05-03", "2026-05-02"]
    });

    const response = await getAnalysisMonthRoute(new Request("http://localhost/api/analysis/month?month=2026-05"));

    expect(response.status).toBe(200);
    expect(getAnalysisMonth).toHaveBeenCalledWith("user-1", "2026-05");
    await expect(response.json()).resolves.toMatchObject({
      month: "2026-05",
      logOverview: {
        recordedDayCount: 2
      },
      scoreOverview: {
        scoredDayCount: 1,
        monthAverageScore: 7.5
      },
      scoreTrend: {
        days: [
          {
            date: "2026-05-01",
            averageScore: null,
            hasScore: false
          },
          {
            date: "2026-05-03",
            averageScore: 7.5,
            hasScore: true
          }
        ],
        factorAverages: {
          meaning: 8
        }
      },
      scoreRecords: [{ id: "score-1", date: "2026-05-03" }],
      editableDates: ["2026-05-03", "2026-05-02"]
    });
  });

  it("returns 400 for invalid month query", async () => {
    getAnalysisMonth.mockRejectedValue(new AnalysisQueryError("INVALID_ANALYSIS_MONTH"));

    const response = await getAnalysisMonthRoute(new Request("http://localhost/api/analysis/month?month=2026-13"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_ANALYSIS_MONTH" });
  });

  it("returns 400 when required query is missing", async () => {
    const response = await getAnalysisMonthRoute(new Request("http://localhost/api/analysis/month"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_ANALYSIS_MONTH" });
  });

  it("returns 500 for analysis query failures", async () => {
    getAnalysisMonth.mockRejectedValue(new AnalysisQueryError("ANALYSIS_QUERY_FAILED"));

    const response = await getAnalysisMonthRoute(new Request("http://localhost/api/analysis/month?month=2026-05"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "ANALYSIS_QUERY_FAILED" });
  });

  it("returns a trends range payload", async () => {
    getAnalysisTrendsRange.mockResolvedValue({
      preset: "month",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      logOverview: { recordedDayCount: 1, savedEntryCount: 1, dailyJournalSavedDayCount: 0 },
      dailyCoverage: [],
      scoreOverview: { scoredDayCount: 1, monthAverageScore: 7.5, latestScoredDate: "2026-05-03" },
      scoreTrend: { days: [], factorAverages: {} }
    });

    const response = await getAnalysisRangeRoute(
      new Request("http://localhost/api/analysis/range?preset=month&month=2026-05")
    );

    expect(response.status).toBe(200);
    expect(getAnalysisTrendsRange).toHaveBeenCalledWith("user-1", {
      preset: "month",
      month: "2026-05",
      startDate: "",
      endDate: ""
    });
  });

  it("returns 400 for invalid range query", async () => {
    getAnalysisTrendsRange.mockRejectedValue(new AnalysisQueryError("INVALID_ANALYSIS_RANGE"));

    const response = await getAnalysisRangeRoute(
      new Request("http://localhost/api/analysis/range?preset=custom&start=2026-05-10&end=2026-05-01")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_ANALYSIS_RANGE" });
  });
});
