const { getAnalysisMonth, AnalysisQueryError } = vi.hoisted(() => ({
  getAnalysisMonth: vi.fn(),
  AnalysisQueryError: class extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
}));

vi.mock("@/server/services/analysis/analysis.service", () => ({
  getAnalysisMonth,
  AnalysisQueryError
}));

import { GET as getAnalysisMonthRoute } from "@/app/api/analysis/month/route";

describe("analysis api route", () => {
  beforeEach(() => {
    getAnalysisMonth.mockReset();
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
      dimensionBreakdown: [],
      dimensions: [],
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
});
