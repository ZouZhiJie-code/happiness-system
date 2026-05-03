const { listAnalysisSourcesByDateRange, listDailyHappinessScoresByDateRange } = vi.hoisted(() => ({
  listAnalysisSourcesByDateRange: vi.fn(),
  listDailyHappinessScoresByDateRange: vi.fn()
}));

vi.mock("@/server/repositories/analysis.repository", () => ({
  listAnalysisSourcesByDateRange
}));

vi.mock("@/server/repositories/daily-happiness-score.repository", () => ({
  listDailyHappinessScoresByDateRange
}));

import { AnalysisQueryError, getAnalysisMonth } from "@/server/services/analysis/analysis.service";

describe("analysis.service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T04:00:00.000Z"));
    listAnalysisSourcesByDateRange.mockReset();
    listDailyHappinessScoresByDateRange.mockReset();
    listDailyHappinessScoresByDateRange.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a full month analysis model with overview and coverage", async () => {
    listAnalysisSourcesByDateRange.mockResolvedValue({
      entries: [
        {
          id: "entry-1",
          date: "2026-05-02",
          dimension: "joy",
          tags: ["关系型开心", "轻松踏实"],
          payload: {
            kind: "joy",
            joyMoment: "和家人一起吃晚饭",
            joySource: "被家人的陪伴接住了",
            stateShift: "从绷着到松下来",
            meaningNeed: "连接感",
            manualClue: "慢下来相处时，我会恢复能量",
            delightSignature: null,
            directionSignal: null,
            valueImpact: null,
            durability: null,
            tags: ["关系型开心", "轻松踏实"]
          },
          savedAt: "2026-05-02T13:00:00.000Z",
          updatedAt: "2026-05-02T12:00:00.000Z"
        },
        {
          id: "entry-2",
          date: "2026-05-02",
          dimension: "joy",
          tags: ["关系型开心"],
          payload: {
            kind: "joy",
            joyMoment: "一起散步",
            joySource: "那种不用解释也能放松的陪伴",
            stateShift: "更稳",
            meaningNeed: "陪伴",
            manualClue: null,
            delightSignature: "我会被这种没负担的陪伴带回轻松里",
            directionSignal: null,
            valueImpact: null,
            durability: null,
            tags: ["关系型开心"]
          },
          savedAt: "2026-05-02T14:00:00.000Z",
          updatedAt: "2026-05-02T13:30:00.000Z"
        },
        {
          id: "entry-3",
          date: "2026-05-02",
          dimension: "reflection",
          tags: ["判断校准型"],
          payload: {
            kind: "reflection",
            trigger: "和朋友聊完项目节奏",
            feeling: "警醒",
            reflectionType: "判断校准型",
            insight: "我太容易把忙碌错当进展",
            viewpointShift: "以后判断进展要看依据有没有变清楚",
            tags: ["判断校准型"]
          },
          savedAt: "2026-05-02T10:00:00.000Z",
          updatedAt: "2026-05-02T09:30:00.000Z"
        },
        {
          id: "entry-4",
          date: "2026-05-07",
          dimension: "gratitude",
          tags: ["支持", "协作"],
          payload: {
            kind: "gratitude",
            moment: "同事帮我理清优先级",
            gratitudeMoment: "同事帮我理清优先级",
            gratitudeTarget: "同事",
            kindAction: "看出我快撑不住，先帮我理清优先级",
            seenNeed: "我需要有人帮我把混乱先收住",
            innerEffect: "松了一口气",
            feeling: "被接住",
            gratitudeType: "支持回应型",
            gratitudeReason: "让我觉得不是一个人在扛",
            relationshipSignal: "这种关系回应值得珍惜",
            reciprocityHint: null,
            tags: ["支持", "协作"]
          },
          savedAt: "2026-05-07T12:00:00.000Z",
          updatedAt: "2026-05-07T11:00:00.000Z"
        }
      ],
      dailyJournals: [{ id: "daily-1", date: "2026-05-02" }]
    });
    listDailyHappinessScoresByDateRange.mockResolvedValue([
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
    ]);

    const result = await getAnalysisMonth("2026-05");

    expect(listAnalysisSourcesByDateRange).toHaveBeenCalledWith({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });
    expect(listDailyHappinessScoresByDateRange).toHaveBeenCalledWith({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });
    expect(result.month).toBe("2026-05");
    expect(result.logOverview).toEqual({
      recordedDayCount: 2,
      savedEntryCount: 4,
      dailyJournalSavedDayCount: 1
    });
    expect(result.dailyCoverage).toHaveLength(31);
    expect(result.dailyCoverage.find((day) => day.date === "2026-05-02")).toEqual({
      date: "2026-05-02",
      savedDimensionCount: 2,
      savedDimensions: ["joy", "reflection"],
      hasDailyJournalSaved: true
    });
    expect(result.dailyCoverage.find((day) => day.date === "2026-05-07")).toEqual({
      date: "2026-05-07",
      savedDimensionCount: 1,
      savedDimensions: ["gratitude"],
      hasDailyJournalSaved: false
    });
    expect(result.dimensionBreakdown).toEqual([
      { dimension: "joy", savedEntryCount: 2, recordedDayCount: 1 },
      { dimension: "fulfillment", savedEntryCount: 0, recordedDayCount: 0 },
      { dimension: "reflection", savedEntryCount: 1, recordedDayCount: 1 },
      { dimension: "improvement", savedEntryCount: 0, recordedDayCount: 0 },
      { dimension: "gratitude", savedEntryCount: 1, recordedDayCount: 1 }
    ]);
    expect(result.dimensions).toEqual([
      {
        dimension: "joy",
        savedEntryCount: 2,
        recordedDayCount: 1,
        lastRecordedDate: "2026-05-02",
        topTags: [
          { tag: "关系型开心", count: 2 },
          { tag: "轻松踏实", count: 1 }
        ],
        recentSignals: [
          {
            entryId: "entry-2",
            date: "2026-05-02",
            primarySignal: "那种不用解释也能放松的陪伴",
            secondarySignal: "我会被这种没负担的陪伴带回轻松里"
          },
          {
            entryId: "entry-1",
            date: "2026-05-02",
            primarySignal: "被家人的陪伴接住了",
            secondarySignal: "慢下来相处时，我会恢复能量"
          }
        ]
      },
      {
        dimension: "fulfillment",
        savedEntryCount: 0,
        recordedDayCount: 0,
        lastRecordedDate: null,
        topTags: [],
        recentSignals: []
      },
      {
        dimension: "reflection",
        savedEntryCount: 1,
        recordedDayCount: 1,
        lastRecordedDate: "2026-05-02",
        topTags: [{ tag: "判断校准型", count: 1 }],
        recentSignals: [
          {
            entryId: "entry-3",
            date: "2026-05-02",
            primarySignal: "我太容易把忙碌错当进展",
            secondarySignal: "以后判断进展要看依据有没有变清楚"
          }
        ]
      },
      {
        dimension: "improvement",
        savedEntryCount: 0,
        recordedDayCount: 0,
        lastRecordedDate: null,
        topTags: [],
        recentSignals: []
      },
      {
        dimension: "gratitude",
        savedEntryCount: 1,
        recordedDayCount: 1,
        lastRecordedDate: "2026-05-07",
        topTags: [
          { tag: "协作", count: 1 },
          { tag: "支持", count: 1 }
        ],
        recentSignals: [
          {
            entryId: "entry-4",
            date: "2026-05-07",
            primarySignal: "看出我快撑不住，先帮我理清优先级",
            secondarySignal: "这种关系回应值得珍惜"
          }
        ]
      }
    ]);
    expect(result.scoreRecords).toEqual([
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
    ]);
    expect(result.scoreOverview).toEqual({
      scoredDayCount: 1,
      monthAverageScore: 7.5,
      latestScoredDate: "2026-05-03"
    });
    expect(result.scoreTrend.days).toHaveLength(31);
    expect(result.scoreTrend.days[0]).toMatchObject({
      date: "2026-05-01",
      averageScore: null,
      hasScore: false,
      scores: {
        meaning: null,
        health: null,
        virtue: null,
        autonomy: null,
        interest: null,
        skill: null,
        relationship: null,
        livingCondition: null
      }
    });
    expect(result.scoreTrend.days[2]).toMatchObject({
      date: "2026-05-03",
      averageScore: 7.5,
      hasScore: true,
      scores: {
        meaning: 8,
        health: 7,
        virtue: 9,
        autonomy: 6,
        interest: 8,
        skill: 7,
        relationship: 9,
        livingCondition: 6
      }
    });
    expect(result.scoreTrend.factorAverages).toEqual({
      meaning: 8,
      health: 7,
      virtue: 9,
      autonomy: 6,
      interest: 8,
      skill: 7,
      relationship: 9,
      livingCondition: 6
    });
    expect(result.editableDates).toEqual(["2026-05-03", "2026-05-02"]);
  });

  it("returns no editable dates for old months", async () => {
    listAnalysisSourcesByDateRange.mockResolvedValue({
      entries: [],
      dailyJournals: []
    });

    const result = await getAnalysisMonth("2026-04");

    expect(result.editableDates).toEqual([]);
    expect(result.scoreRecords).toEqual([]);
    expect(result.scoreOverview).toEqual({
      scoredDayCount: 0,
      monthAverageScore: null,
      latestScoredDate: null
    });
    expect(result.scoreTrend.days).toHaveLength(30);
    expect(result.scoreTrend.days.every((day) => day.averageScore === null && !day.hasScore)).toBe(true);
  });

  it("keeps yesterday editable when today is the first day of the month", async () => {
    vi.setSystemTime(new Date("2026-05-01T04:00:00.000Z"));

    listAnalysisSourcesByDateRange.mockResolvedValue({
      entries: [],
      dailyJournals: []
    });
    listDailyHappinessScoresByDateRange.mockImplementation(async (range: { startDate: string; endDate: string }) => {
      if (range.startDate === "2026-05-01") {
        return [
          {
            id: "score-today",
            date: "2026-05-01",
            meaningScore: 8,
            healthScore: 7,
            virtueScore: 9,
            autonomyScore: 6,
            interestScore: 8,
            skillScore: 7,
            relationshipScore: 9,
            livingConditionScore: 6,
            createdAt: "2026-05-01T01:00:00.000Z",
            updatedAt: "2026-05-01T02:00:00.000Z"
          }
        ];
      }

      return [
        {
          id: "score-yesterday",
          date: "2026-04-30",
          meaningScore: 6,
          healthScore: 6,
          virtueScore: 7,
          autonomyScore: 7,
          interestScore: 6,
          skillScore: 7,
          relationshipScore: 8,
          livingConditionScore: 6,
          createdAt: "2026-04-30T01:00:00.000Z",
          updatedAt: "2026-04-30T02:00:00.000Z"
        }
      ];
    });

    const result = await getAnalysisMonth("2026-05");

    expect(listDailyHappinessScoresByDateRange).toHaveBeenCalledWith({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });
    expect(listDailyHappinessScoresByDateRange).toHaveBeenCalledWith({
      startDate: "2026-04-30",
      endDate: "2026-04-30"
    });
    expect(result.editableDates).toEqual(["2026-05-01", "2026-04-30"]);
    expect(result.scoreRecords.map((record) => record.date)).toEqual(["2026-05-01", "2026-04-30"]);
    expect(result.scoreOverview).toEqual({
      scoredDayCount: 1,
      monthAverageScore: 7.5,
      latestScoredDate: "2026-05-01"
    });
    expect(result.scoreTrend.days.find((day) => day.date === "2026-04-30")).toBeUndefined();
    expect(result.scoreTrend.days.find((day) => day.date === "2026-05-01")).toMatchObject({
      averageScore: 7.5,
      hasScore: true
    });
  });

  it("throws a typed error for invalid month input", async () => {
    await expect(getAnalysisMonth("2026-13")).rejects.toMatchObject({
      code: "INVALID_ANALYSIS_MONTH"
    } satisfies Partial<AnalysisQueryError>);
  });

  it("wraps repository failures in ANALYSIS_QUERY_FAILED", async () => {
    listAnalysisSourcesByDateRange.mockRejectedValue(new Error("db unavailable"));

    await expect(getAnalysisMonth("2026-05")).rejects.toMatchObject({
      code: "ANALYSIS_QUERY_FAILED"
    } satisfies Partial<AnalysisQueryError>);
  });
});
