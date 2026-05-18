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
      dailyJournals: [{ id: "daily-1", date: "2026-05-02", sourceSignature: "entry-1:2026-05-02T12:00:00.000Z|entry-3:2026-05-02T09:30:00.000Z" }]
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

    const result = await getAnalysisMonth("user-1", "2026-05");

    expect(listAnalysisSourcesByDateRange).toHaveBeenCalledWith({
      userId: "user-1",
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });
    expect(listDailyHappinessScoresByDateRange).toHaveBeenCalledWith("user-1", {
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
      savedEntryCount: 3,
      savedDimensionCount: 2,
      savedDimensions: ["joy", "reflection"],
      hasDailyJournalSaved: true,
      hasStaleDailyJournal: true,
      hasScore: false,
      averageScore: null,
      journalTitle: null,
      contentPreview: null
    });
    expect(result.dailyCoverage.find((day) => day.date === "2026-05-03")).toEqual({
      date: "2026-05-03",
      savedEntryCount: 0,
      savedDimensionCount: 0,
      savedDimensions: [],
      hasDailyJournalSaved: false,
      hasStaleDailyJournal: false,
      hasScore: true,
      averageScore: 7.5,
      journalTitle: null,
      contentPreview: null
    });
    expect(result.dailyCoverage.find((day) => day.date === "2026-05-07")).toEqual({
      date: "2026-05-07",
      savedEntryCount: 1,
      savedDimensionCount: 1,
      savedDimensions: ["gratitude"],
      hasDailyJournalSaved: false,
      hasStaleDailyJournal: false,
      hasScore: false,
      averageScore: null,
      journalTitle: null,
      contentPreview: null
    });
    expect(result.rhythmOverview).toEqual({
      activeObservedDayCount: 1,
      scoreOnlyDayCount: 1,
      pendingDailyJournalCount: 1,
      longestStreak: {
        startDate: "2026-05-02",
        endDate: "2026-05-02",
        length: 1
      },
      longestGap: {
        startDate: "2026-05-01",
        endDate: "2026-05-01",
        length: 1
      },
      latestActiveDate: "2026-05-02",
      latestScoreOnlyDate: "2026-05-03",
      latestPendingDailyJournalDate: "2026-05-02"
    });
    expect(result.dimensionBreakdown).toEqual([
      { dimension: "joy", savedEntryCount: 2, recordedDayCount: 1 },
      { dimension: "fulfillment", savedEntryCount: 0, recordedDayCount: 0 },
      { dimension: "reflection", savedEntryCount: 1, recordedDayCount: 1 },
      { dimension: "improvement", savedEntryCount: 0, recordedDayCount: 0 },
      { dimension: "gratitude", savedEntryCount: 1, recordedDayCount: 1 }
    ]);
    const joyDimension = result.dimensions.find((dimension) => dimension.dimension === "joy");
    const fulfillmentDimension = result.dimensions.find((dimension) => dimension.dimension === "fulfillment");
    const reflectionDimension = result.dimensions.find((dimension) => dimension.dimension === "reflection");
    const improvementDimension = result.dimensions.find((dimension) => dimension.dimension === "improvement");
    const gratitudeDimension = result.dimensions.find((dimension) => dimension.dimension === "gratitude");

    expect(joyDimension).toMatchObject({
      savedEntryCount: 2,
      recordedDayCount: 1,
      lastRecordedDate: "2026-05-02",
      scoreLink: {
        average: 8.5,
        status: "supporting",
        summary: "热爱、人际在评分里也不低，这条线不只是写出来了，分数里也能看见。"
      }
    });
    expect(joyDimension?.topTags).toEqual([
      { tag: "关系型开心", count: 2 },
      { tag: "轻松踏实", count: 1 }
    ]);
    expect(joyDimension?.recentSignals[0]).toEqual({
      entryId: "entry-2",
      date: "2026-05-02",
      primarySignal: "那种不用解释也能放松的陪伴",
      secondarySignal: "我会被这种没负担的陪伴带回轻松里"
    });
    expect(fulfillmentDimension).toMatchObject({
      savedEntryCount: 0,
      recordedDayCount: 0,
      lastRecordedDate: null,
      scoreLink: {
        average: 8,
        status: "missing",
        summary: "意义、擅长、美德在评分里并不低，但这条线还没写成具体记录。"
      }
    });
    expect(fulfillmentDimension?.topTags).toEqual([]);
    expect(fulfillmentDimension?.recentSignals).toEqual([]);
    expect(reflectionDimension).toMatchObject({
      savedEntryCount: 1,
      recordedDayCount: 1,
      lastRecordedDate: "2026-05-02",
      scoreLink: {
        average: 7,
        status: "supporting",
        summary: "意志、意义在评分里也不低，这条线不只是写出来了，分数里也能看见。"
      }
    });
    expect(reflectionDimension?.topTags).toEqual([{ tag: "判断校准型", count: 1 }]);
    expect(reflectionDimension?.recentSignals[0]).toEqual({
      entryId: "entry-3",
      date: "2026-05-02",
      primarySignal: "我太容易把忙碌错当进展",
      secondarySignal: "以后判断进展要看依据有没有变清楚"
    });
    expect(improvementDimension).toMatchObject({
      savedEntryCount: 0,
      recordedDayCount: 0,
      lastRecordedDate: null,
      scoreLink: {
        average: 7.3,
        status: "missing",
        summary: "擅长、意志、美德在评分里并不低，但这条线还没写成具体记录。"
      }
    });
    expect(improvementDimension?.topTags).toEqual([]);
    expect(improvementDimension?.recentSignals).toEqual([]);
    expect(gratitudeDimension).toMatchObject({
      savedEntryCount: 1,
      recordedDayCount: 1,
      lastRecordedDate: "2026-05-07",
      scoreLink: {
        average: 7.5,
        status: "supporting",
        summary: "人际、经济在评分里也不低，这条线不只是写出来了，分数里也能看见。"
      }
    });
    expect(gratitudeDimension?.topTags).toEqual([
      { tag: "协作", count: 1 },
      { tag: "支持", count: 1 }
    ]);
    expect(gratitudeDimension?.recentSignals[0]).toEqual({
      entryId: "entry-4",
      date: "2026-05-07",
      primarySignal: "看出我快撑不住，先帮我理清优先级",
      secondarySignal: "这种关系回应值得珍惜"
    });
    expect(result.insightsOverview).toMatchObject({
      headline: "开心是这个月最清楚的一条线，思考也已经开始接上。",
      featuredDimension: "joy",
      summary:
        "这个月更成形的是开心这条线，旁边陪着它一起动的，多半是思考。热爱、人际在评分里也不低，这条线不只是写出来了，分数里也能看见。",
      watchpoint: "还有 1 天的完整日志已经过时，需要重新整理。"
    });
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

    const result = await getAnalysisMonth("user-1", "2026-04");

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

  it("does not treat a future month as a full-month quiet gap", async () => {
    listAnalysisSourcesByDateRange.mockResolvedValue({
      entries: [],
      dailyJournals: []
    });

    const result = await getAnalysisMonth("user-1", "2026-06");

    expect(result.rhythmOverview).toMatchObject({
      activeObservedDayCount: 0,
      scoreOnlyDayCount: 0,
      pendingDailyJournalCount: 0,
      longestStreak: null,
      longestGap: null,
      latestActiveDate: null,
      latestScoreOnlyDate: null,
      latestPendingDailyJournalDate: null
    });
  });

  it("keeps the insight headline and score link aligned on the same quiet lagging dimension", async () => {
    listAnalysisSourcesByDateRange.mockResolvedValue({
      entries: [
        {
          id: "entry-1",
          date: "2026-05-02",
          dimension: "joy",
          tags: ["关系型开心"],
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
            tags: ["关系型开心"]
          },
          savedAt: "2026-05-02T13:00:00.000Z",
          updatedAt: "2026-05-02T12:00:00.000Z"
        },
        {
          id: "entry-2",
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
        }
      ],
      dailyJournals: [
        {
          id: "daily-1",
          date: "2026-05-02",
          sourceSignature: "entry-1:2026-05-02T12:00:00.000Z|entry-2:2026-05-02T09:30:00.000Z"
        }
      ]
    });
    listDailyHappinessScoresByDateRange.mockResolvedValue([
      {
        id: "score-1",
        date: "2026-05-03",
        meaningScore: 6,
        healthScore: 7,
        virtueScore: 5,
        autonomyScore: 5,
        interestScore: 6,
        skillScore: 5,
        relationshipScore: 6,
        livingConditionScore: 6,
        createdAt: "2026-05-03T01:00:00.000Z",
        updatedAt: "2026-05-03T02:00:00.000Z"
      }
    ]);

    const result = await getAnalysisMonth("user-1", "2026-05");
    const scoreLink = result.insightsOverview.links.find((link) => link.type === "score");

    expect(result.insightsOverview.headline).toContain("改进");
    expect(result.insightsOverview.watchpoint).toContain("擅长、意志、美德在评分里也偏弱");
    expect(result.insightsOverview.summary).toContain("擅长、意志、美德在评分里也偏弱");
    expect(scoreLink).toMatchObject({
      type: "score",
      dimensions: ["improvement"],
      detail: "擅长、意志、美德在评分里也偏弱，这条线还没有真正展开。"
    });
  });

  it("treats a stale daily journal without saved sources as pending work", async () => {
    listAnalysisSourcesByDateRange.mockResolvedValue({
      entries: [],
      dailyJournals: [
        {
          id: "daily-1",
          date: "2026-05-02",
          sourceSignature: "old-signature"
        }
      ]
    });
    listDailyHappinessScoresByDateRange.mockResolvedValue([]);

    const result = await getAnalysisMonth("user-1", "2026-05");

    expect(result.dailyCoverage.find((day) => day.date === "2026-05-02")).toMatchObject({
      savedEntryCount: 0,
      savedDimensionCount: 0,
      hasDailyJournalSaved: true,
      hasStaleDailyJournal: true
    });
    expect(result.rhythmOverview).toMatchObject({
      pendingDailyJournalCount: 1,
      latestPendingDailyJournalDate: "2026-05-02"
    });
    expect(result.insightsOverview.watchpoint).toBe("还有 1 天的完整日志已经过时，需要重新整理。");
  });

  it("treats a single early-month record as starting instead of quiet", async () => {
    listAnalysisSourcesByDateRange.mockResolvedValue({
      entries: [
        {
          id: "entry-1",
          date: "2026-05-02",
          dimension: "joy",
          tags: ["关系型开心"],
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
            tags: ["关系型开心"]
          },
          savedAt: "2026-05-02T13:00:00.000Z",
          updatedAt: "2026-05-02T12:00:00.000Z"
        }
      ],
      dailyJournals: []
    });
    listDailyHappinessScoresByDateRange.mockResolvedValue([]);

    const result = await getAnalysisMonth("user-1", "2026-05");
    const joyDimension = result.dimensions.find((dimension) => dimension.dimension === "joy");

    expect(joyDimension).toMatchObject({
      recordedDayCount: 1,
      momentum: "starting"
    });
  });

  it("keeps yesterday editable when today is the first day of the month", async () => {
    vi.setSystemTime(new Date("2026-05-01T04:00:00.000Z"));

    listAnalysisSourcesByDateRange.mockResolvedValue({
      entries: [],
      dailyJournals: []
    });
    listDailyHappinessScoresByDateRange.mockImplementation(async (_userId: string, range: { startDate: string; endDate: string }) => {
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

    const result = await getAnalysisMonth("user-1", "2026-05");

    expect(listDailyHappinessScoresByDateRange).toHaveBeenCalledWith("user-1", {
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });
    expect(listDailyHappinessScoresByDateRange).toHaveBeenCalledWith("user-1", {
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
    await expect(getAnalysisMonth("user-1", "2026-13")).rejects.toMatchObject({
      code: "INVALID_ANALYSIS_MONTH"
    } satisfies Partial<AnalysisQueryError>);
  });

  it("wraps repository failures in ANALYSIS_QUERY_FAILED", async () => {
    listAnalysisSourcesByDateRange.mockRejectedValue(new Error("db unavailable"));

    await expect(getAnalysisMonth("user-1", "2026-05")).rejects.toMatchObject({
      code: "ANALYSIS_QUERY_FAILED"
    } satisfies Partial<AnalysisQueryError>);
  });
});
