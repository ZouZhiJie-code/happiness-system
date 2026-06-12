import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { AnalysisShell } from "@/components/analysis/analysis-shell";
import type { AnalysisMonthRecord } from "@/features/analysis/types";

const { mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      month: null as string | null,
      section: null as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "month" | "section"] ?? null
  })
}));

vi.mock("@/features/interview/entry-date", () => ({
  getTodayEntryDate: () => "2026-05-03"
}));

describe("analysis shell", () => {
  let historyReplaceStateSpy: ReturnType<typeof vi.spyOn>;

  const scoreKeys = [
    "meaning",
    "health",
    "virtue",
    "autonomy",
    "interest",
    "skill",
    "relationship",
    "livingCondition"
  ] as const;
  const scoreRecordKeys = [
    "meaningScore",
    "healthScore",
    "virtueScore",
    "autonomyScore",
    "interestScore",
    "skillScore",
    "relationshipScore",
    "livingConditionScore"
  ] as const;

  function roundScoreAverage(value: number) {
    return Math.round(value * 10) / 10;
  }

  function buildScoreFields(scoreRecords: AnalysisMonthRecord["scoreRecords"], month = "2026-05") {
    const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
    const monthDates = Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
    const recordByDate = new Map(scoreRecords.filter((record) => record.date.startsWith(month)).map((record) => [record.date, record]));
    const trendDays = monthDates.map((date) => {
      const record = recordByDate.get(date);

      if (!record) {
        return {
          date,
          averageScore: null,
          scores: Object.fromEntries(scoreKeys.map((key) => [key, null])) as AnalysisMonthRecord["scoreTrend"]["days"][number]["scores"],
          hasScore: false
        };
      }

      const values = scoreRecordKeys.map((key) => record[key]);

      return {
        date,
        averageScore: roundScoreAverage(values.reduce((sum, value) => sum + value, 0) / values.length),
        scores: Object.fromEntries(scoreKeys.map((key, index) => [key, record[scoreRecordKeys[index]]])) as AnalysisMonthRecord["scoreTrend"]["days"][number]["scores"],
        hasScore: true
      };
    });
    const scoredDays = trendDays.filter((day) => day.hasScore);

    return {
      scoreOverview: {
        scoredDayCount: scoredDays.length,
        monthAverageScore:
          scoredDays.length > 0
            ? roundScoreAverage(scoredDays.reduce((sum, day) => sum + (day.averageScore ?? 0), 0) / scoredDays.length)
            : null,
        latestScoredDate: scoredDays.at(-1)?.date ?? null
      },
      scoreTrend: {
        days: trendDays,
        factorAverages: Object.fromEntries(
          scoreKeys.map((key) => {
            const values = scoredDays
              .map((day) => day.scores[key])
              .filter((value): value is number => typeof value === "number");

            return [
              key,
              values.length > 0
                ? roundScoreAverage(values.reduce((sum, value) => sum + value, 0) / values.length)
                : null
            ];
          })
        ) as AnalysisMonthRecord["scoreTrend"]["factorAverages"]
      }
    };
  }

  function buildDailyCoverage(
    scoreRecords: AnalysisMonthRecord["scoreRecords"],
    month = "2026-05"
  ): AnalysisMonthRecord["dailyCoverage"] {
    const recordByDate = new Map(scoreRecords.filter((record) => record.date.startsWith(month)).map((record) => [record.date, record]));
    const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, "0")}`;
      const scoreRecord = recordByDate.get(date);
      const averageScore = scoreRecord
        ? roundScoreAverage(scoreRecordKeys.map((key) => scoreRecord[key]).reduce((sum, value) => sum + value, 0) / scoreRecordKeys.length)
        : null;

      if (date === "2026-05-02") {
        return {
          date,
          savedEntryCount: 3,
          savedDimensionCount: 2,
          savedDimensions: ["joy", "reflection"] as AnalysisMonthRecord["dailyCoverage"][number]["savedDimensions"],
          hasDailyJournalSaved: true,
          hasStaleDailyJournal: false,
          hasScore: Boolean(scoreRecord),
          averageScore,
          journalTitle: "五月二日的记录",
          contentPreview: "今天和朋友聚了一次，聊了很多最近的状态变化。"
        };
      }

      if (date === "2026-05-07") {
        return {
          date,
          savedEntryCount: 1,
          savedDimensionCount: 1,
          savedDimensions: ["gratitude"] as AnalysisMonthRecord["dailyCoverage"][number]["savedDimensions"],
          hasDailyJournalSaved: false,
          hasStaleDailyJournal: false,
          hasScore: Boolean(scoreRecord),
          averageScore,
          journalTitle: null,
          contentPreview: null
        };
      }

      return {
        date,
        savedEntryCount: 0,
        savedDimensionCount: 0,
        savedDimensions: [] as AnalysisMonthRecord["dailyCoverage"][number]["savedDimensions"],
        hasDailyJournalSaved: false,
        hasStaleDailyJournal: false,
        hasScore: Boolean(scoreRecord),
        averageScore,
        journalTitle: null,
        contentPreview: null
      };
    });
  }

  function buildEmptyDailyCoverage(month = "2026-05"): AnalysisMonthRecord["dailyCoverage"] {
    return buildDailyCoverage([], month).map((day) => ({
      ...day,
      savedEntryCount: 0,
      savedDimensionCount: 0,
      savedDimensions: [],
      hasDailyJournalSaved: false,
      hasStaleDailyJournal: false
    }));
  }

  function buildRhythmOverview(
    dailyCoverage: AnalysisMonthRecord["dailyCoverage"],
    month = "2026-05",
    today = "2026-05-03"
  ): AnalysisMonthRecord["rhythmOverview"] {
    const observedDays = month > today.slice(0, 7) ? [] : month === today.slice(0, 7) ? dailyCoverage.filter((day) => day.date <= today) : dailyCoverage;
    const isPendingDailyJournalDay = (day: AnalysisMonthRecord["dailyCoverage"][number]) =>
      day.hasStaleDailyJournal || (day.savedDimensionCount > 0 && !day.hasDailyJournalSaved);

    function buildLongestSpan(predicate: (day: AnalysisMonthRecord["dailyCoverage"][number]) => boolean) {
      let best: { startDate: string; endDate: string; length: number } | null = null;
      let currentStart: string | null = null;
      let currentEnd: string | null = null;
      let currentLength = 0;

      for (const day of observedDays) {
        if (predicate(day)) {
          currentStart ??= day.date;
          currentEnd = day.date;
          currentLength += 1;
          continue;
        }

        if (currentStart && currentEnd && (!best || currentLength > best.length)) {
          best = {
            startDate: currentStart,
            endDate: currentEnd,
            length: currentLength
          };
        }

        currentStart = null;
        currentEnd = null;
        currentLength = 0;
      }

      if (currentStart && currentEnd && (!best || currentLength > best.length)) {
        best = {
          startDate: currentStart,
          endDate: currentEnd,
          length: currentLength
        };
      }

      return best;
    }

    function findLatest(predicate: (day: AnalysisMonthRecord["dailyCoverage"][number]) => boolean) {
      return observedDays.filter(predicate).sort((left, right) => right.date.localeCompare(left.date))[0]?.date ?? null;
    }

    return {
      activeObservedDayCount: observedDays.filter((day) => day.savedDimensionCount > 0 || day.hasDailyJournalSaved).length,
      scoreOnlyDayCount: observedDays.filter((day) => day.hasScore && day.savedDimensionCount === 0 && !day.hasDailyJournalSaved).length,
      pendingDailyJournalCount: observedDays.filter(isPendingDailyJournalDay).length,
      longestStreak: buildLongestSpan((day) => day.savedDimensionCount > 0 || day.hasDailyJournalSaved),
      longestGap: buildLongestSpan((day) => day.savedDimensionCount === 0 && !day.hasDailyJournalSaved && !day.hasScore),
      latestActiveDate: findLatest((day) => day.savedDimensionCount > 0 || day.hasDailyJournalSaved),
      latestScoreOnlyDate: findLatest((day) => day.hasScore && day.savedDimensionCount === 0 && !day.hasDailyJournalSaved),
      latestPendingDailyJournalDate: findLatest(isPendingDailyJournalDay)
    };
  }

  function buildDimensionInsight(
    input: Partial<AnalysisMonthRecord["dimensions"][number]> & Pick<AnalysisMonthRecord["dimensions"][number], "dimension">
  ): AnalysisMonthRecord["dimensions"][number] {
    return {
      dimension: input.dimension,
      savedEntryCount: input.savedEntryCount ?? 0,
      recordedDayCount: input.recordedDayCount ?? 0,
      lastRecordedDate: input.lastRecordedDate ?? null,
      thesis: input.thesis ?? null,
      confidence: input.confidence ?? "low",
      momentum: input.momentum ?? "quiet",
      continuity: input.continuity ?? "none",
      turningPointDate: input.turningPointDate ?? null,
      representativeDates: input.representativeDates ?? [],
      relatedScoreFactors: input.relatedScoreFactors ?? [],
      relatedDimensions: input.relatedDimensions ?? [],
      scoreLink: input.scoreLink ?? {
        average: null,
        status: "unknown",
        summary: "评分里暂时还看不出这条线。"
      },
      nextQuestion: input.nextQuestion ?? null,
      topTags: input.topTags ?? [],
      recentSignals: input.recentSignals ?? [],
      evidence: input.evidence ?? []
    };
  }

  function buildInsightsOverview(
    featuredDimension: AnalysisMonthRecord["insightsOverview"]["featuredDimension"] = "joy"
  ): AnalysisMonthRecord["insightsOverview"] {
    return {
      headline: "开心是这个月最清楚的一条线，思考也已经开始接上。",
      summary: "这个月更成形的是开心这条线，旁边陪着它一起动的，多半是思考。投入感、关系支持在评分里也不低，这条线不只是写出来了，分数里也能看见。",
      watchpoint: "成长感、自主感、自我认可在评分里还不算稳，这条线也还没有真正展开。",
      featuredDimension,
      quietDimensions: ["fulfillment", "improvement"],
      links: [
        {
          type: "score",
          title: "评分里也在呼应",
          detail: "投入感、关系支持在评分里也不低，这条线不只是写出来了，分数里也能看见。",
          dimensions: ["joy"],
          anchorDate: "2026-05-02"
        },
        {
          type: "pairing",
          title: "常常会一起出现",
          detail: "5月2日这一天，开心和思考一起冒了出来。",
          dimensions: ["joy", "reflection"],
          anchorDate: "2026-05-02"
        },
        {
          type: "gap",
          title: "还没怎么展开的",
          detail: "充实、改进这几条线，这个月还没有留下已保存记录。",
          dimensions: ["fulfillment", "improvement"],
          anchorDate: null
        }
      ]
    };
  }

  function buildAnalysisMonthRecord(): AnalysisMonthRecord {
    const scoreRecords: AnalysisMonthRecord["scoreRecords"] = [
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
      },
      {
        id: "score-2",
        date: "2026-05-02",
        meaningScore: 6,
        healthScore: 6,
        virtueScore: 7,
        autonomyScore: 7,
        interestScore: 6,
        skillScore: 7,
        relationshipScore: 8,
        livingConditionScore: 6,
        createdAt: "2026-05-02T01:00:00.000Z",
        updatedAt: "2026-05-02T02:00:00.000Z"
      }
    ];
    const dailyCoverage = buildDailyCoverage(scoreRecords);

    return {
      month: "2026-05",
      logOverview: {
        recordedDayCount: 2,
        savedEntryCount: 4,
        dailyJournalSavedDayCount: 1
      },
      dailyCoverage,
      rhythmOverview: buildRhythmOverview(dailyCoverage),
      dimensionBreakdown: [
        { dimension: "joy", savedEntryCount: 2, recordedDayCount: 1 },
        { dimension: "fulfillment", savedEntryCount: 0, recordedDayCount: 0 },
        { dimension: "reflection", savedEntryCount: 1, recordedDayCount: 1 },
        { dimension: "improvement", savedEntryCount: 0, recordedDayCount: 0 },
        { dimension: "gratitude", savedEntryCount: 1, recordedDayCount: 1 }
      ],
      dimensions: [
        buildDimensionInsight({
          dimension: "joy",
          savedEntryCount: 2,
          recordedDayCount: 1,
          lastRecordedDate: "2026-05-02",
          thesis: "这个月让你更容易亮起来的，多半和那种不用解释也能放松的陪伴有关。",
          confidence: "medium",
          momentum: "steady",
          continuity: "single",
          turningPointDate: "2026-05-02",
          representativeDates: ["2026-05-02"],
          relatedScoreFactors: ["interest", "relationship"],
          relatedDimensions: ["reflection"],
          scoreLink: {
            average: 8.5,
            status: "supporting",
            summary: "投入感、关系支持在评分里也不低，这条线不只是写出来了，分数里也能看见。"
          },
          nextQuestion: "这类开心只是偶尔出现，还是已经开始重复出现了？",
          topTags: [
            { tag: "关系型开心", count: 2 },
            { tag: "轻松踏实", count: 1 }
          ],
          recentSignals: [
            {
              entryId: "entry-joy-2",
              date: "2026-05-02",
              primarySignal: "那种不用解释也能放松的陪伴",
              secondarySignal: "我会被这种没负担的陪伴带回轻松里"
            }
          ],
          evidence: [
            {
              entryId: "entry-joy-2",
              date: "2026-05-02",
              summary: "那种不用解释也能放松的陪伴",
              detail: "我会被这种没负担的陪伴带回轻松里"
            }
          ]
        }),
        buildDimensionInsight({
          dimension: "fulfillment",
          relatedScoreFactors: ["meaning", "skill", "virtue"],
          scoreLink: {
            average: 7.3,
            status: "missing",
            summary: "意义感、成长感、自我认可在评分里并不低，但这条线还没写成具体记录。"
          },
          nextQuestion: "最近有没有一件事，让你觉得今天不算白过？"
        }),
        buildDimensionInsight({
          dimension: "reflection",
          savedEntryCount: 1,
          recordedDayCount: 1,
          lastRecordedDate: "2026-05-02",
          thesis: "这个月反复冒出来的一条判断，是我太容易把忙碌错当进展。",
          confidence: "low",
          momentum: "starting",
          continuity: "single",
          turningPointDate: "2026-05-02",
          representativeDates: ["2026-05-02"],
          relatedScoreFactors: ["autonomy", "meaning"],
          relatedDimensions: ["joy"],
          scoreLink: {
            average: 7,
            status: "supporting",
            summary: "自主感、意义感在评分里也不低，这条线不只是写出来了，分数里也能看见。"
          },
          nextQuestion: "这条判断线索，只在一件事里出现，还是已经开始反复冒出来？",
          topTags: [{ tag: "判断校准型", count: 1 }],
          recentSignals: [
            {
              entryId: "entry-reflection-1",
              date: "2026-05-02",
              primarySignal: "我太容易把忙碌错当进展",
              secondarySignal: "以后判断进展要看依据有没有变清楚"
            }
          ],
          evidence: [
            {
              entryId: "entry-reflection-1",
              date: "2026-05-02",
              summary: "我太容易把忙碌错当进展",
              detail: "以后判断进展要看依据有没有变清楚"
            }
          ]
        }),
        buildDimensionInsight({
          dimension: "improvement",
          relatedScoreFactors: ["skill", "autonomy", "virtue"],
          scoreLink: {
            average: 6.8,
            status: "lagging",
            summary: "成长感、自主感、自我认可在评分里还不算稳，这条线也还没有真正展开。"
          },
          nextQuestion: "最近有没有一个时刻，让你觉得下次想做得更稳一点？"
        }),
        buildDimensionInsight({
          dimension: "gratitude",
          savedEntryCount: 1,
          recordedDayCount: 1,
          lastRecordedDate: "2026-05-07",
          thesis: "这个月最容易被你记住的回应，多半是看出我快撑不住，先帮我理清优先级。",
          confidence: "low",
          momentum: "starting",
          continuity: "single",
          turningPointDate: "2026-05-07",
          representativeDates: ["2026-05-07"],
          relatedScoreFactors: ["relationship", "livingCondition"],
          relatedDimensions: [],
          scoreLink: {
            average: 7,
            status: "supporting",
            summary: "关系支持、生活托住在评分里也不低，这条线不只是写出来了，分数里也能看见。"
          },
          nextQuestion: "这类被回应的感觉，是一次例外，还是这段关系里常有的经验？",
          topTags: [{ tag: "支持", count: 1 }],
          recentSignals: [
            {
              entryId: "entry-gratitude-1",
              date: "2026-05-07",
              primarySignal: "看出我快撑不住，先帮我理清优先级",
              secondarySignal: "这种关系回应值得珍惜"
            }
          ],
          evidence: [
            {
              entryId: "entry-gratitude-1",
              date: "2026-05-07",
              summary: "看出我快撑不住，先帮我理清优先级",
              detail: "这种关系回应值得珍惜"
            }
          ]
        })
      ],
      insightsOverview: buildInsightsOverview(),
      ...buildScoreFields(scoreRecords),
      scoreRecords,
      editableDates: ["2026-05-03", "2026-05-02"],
      narrative: null
    };
  }

  beforeEach(() => {
    historyReplaceStateSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      month: null,
      section: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildAnalysisMonthRecord()), { status: 200 })) as typeof fetch;
  });

  afterEach(() => {
    historyReplaceStateSpy.mockRestore();
  });

  it("normalizes missing month search params to the current month", async () => {
    render(<AnalysisShell />);

    expect(historyReplaceStateSpy).toHaveBeenCalledWith(null, "", "/analysis?month=2026-05&section=trends");
    await screen.findByTestId("analysis-trends-placeholder");
  });

  it("renders all analysis sections on a single scroll page by default", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: null
    };

    render(<AnalysisShell />);

    expect(historyReplaceStateSpy).toHaveBeenCalledWith(null, "", "/analysis?month=2026-05&section=trends");
    await screen.findByTestId("analysis-trends-placeholder");
    await screen.findByTestId("happiness-score-panel");
    await screen.findByTestId("analysis-rhythm-board");
    await screen.findByTestId("analysis-dimension-cards");

    expect(screen.getByTestId("analysis-dimensions-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("analysis-correlation-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("analysis-review-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("analysis-month-hero")).not.toBeInTheDocument();
  });

  it("keeps a valid month and canonical section without rewriting the url", async () => {
    mockSearchParams.value = {
      month: "2026-04",
      section: "correlation"
    };

    render(<AnalysisShell />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(historyReplaceStateSpy).not.toHaveBeenCalled();
    expect(await screen.findByTestId("analysis-correlation-placeholder")).toBeInTheDocument();
  });

  it("falls back invalid month params to the current month", async () => {
    mockSearchParams.value = {
      month: "2026-13",
      section: "score"
    };

    render(<AnalysisShell />);

    expect(historyReplaceStateSpy).toHaveBeenCalledWith(null, "", "/analysis?month=2026-05&section=trends");
    await screen.findByTestId("happiness-score-panel");
  });

  it("removes month controls from the page body", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("happiness-score-panel");
    expect(screen.queryByTestId("analysis-month-controls")).not.toBeInTheDocument();
  });

  it("renders the rhythm heatmap section", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "rhythm"
    };

    render(<AnalysisShell />);

    await waitFor(() => {
      expect(screen.getByTestId("analysis-rhythm-board")).toBeInTheDocument();
    });

    expect(screen.getByTestId("analysis-heatmap-day-2026-05-02")).toHaveTextContent("2维");
    expect(screen.queryByTestId("analysis-month-hero")).not.toBeInTheDocument();
  });

  it("does not render the legacy overview hero on the single-page layout", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "trends"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("happiness-score-panel");

    expect(screen.queryByTestId("analysis-month-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("analysis-status-board")).not.toBeInTheDocument();
  });

  it("renders the five-dimension insight layout without an even card grid", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "insights"
    };

    render(<AnalysisShell />);

    await waitFor(() => {
      expect(screen.getByTestId("analysis-dimension-cards")).toBeInTheDocument();
    });

    expect(screen.getByTestId("analysis-dimension-featured-joy")).toHaveTextContent("开心");
    expect(screen.getByTestId("analysis-dimension-cards")).toHaveTextContent("思考");
    expect(screen.getByTestId("analysis-dimension-cards")).toHaveTextContent("感谢");
  });

  it("renders all sections together even when deep-linking to a legacy rhythm section", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "rhythm"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-rhythm-board");

    expect(screen.getByTestId("analysis-trends-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("happiness-score-panel")).toBeInTheDocument();
  });

  it("renders a stable empty state when the month has no saved records", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          month: "2026-05",
          logOverview: {
            recordedDayCount: 0,
            savedEntryCount: 0,
            dailyJournalSavedDayCount: 0
          },
          dailyCoverage: buildEmptyDailyCoverage(),
          rhythmOverview: buildRhythmOverview(buildEmptyDailyCoverage()),
          dimensionBreakdown: [
            { dimension: "joy", savedEntryCount: 0, recordedDayCount: 0 },
            { dimension: "fulfillment", savedEntryCount: 0, recordedDayCount: 0 },
            { dimension: "reflection", savedEntryCount: 0, recordedDayCount: 0 },
            { dimension: "improvement", savedEntryCount: 0, recordedDayCount: 0 },
            { dimension: "gratitude", savedEntryCount: 0, recordedDayCount: 0 }
          ],
          dimensions: [
            buildDimensionInsight({ dimension: "joy", relatedScoreFactors: ["interest", "relationship"] }),
            buildDimensionInsight({ dimension: "fulfillment", relatedScoreFactors: ["meaning", "skill", "virtue"] }),
            buildDimensionInsight({ dimension: "reflection", relatedScoreFactors: ["autonomy", "meaning"] }),
            buildDimensionInsight({ dimension: "improvement", relatedScoreFactors: ["skill", "autonomy", "virtue"] }),
            buildDimensionInsight({ dimension: "gratitude", relatedScoreFactors: ["relationship", "livingCondition"] })
          ],
          insightsOverview: {
            headline: "这个月先别急着下五维结论。",
            summary: "这个月已经有了一些起伏，但还没有足够的文字材料把五维线索说清楚。",
            watchpoint: null,
            featuredDimension: null,
            quietDimensions: ["joy", "fulfillment", "reflection", "improvement", "gratitude"],
            links: []
          },
          ...buildScoreFields([]),
          scoreRecords: [],
          editableDates: ["2026-05-03", "2026-05-02"],
          narrative: null
        } satisfies AnalysisMonthRecord),
        { status: 200 }
      )
    );

    mockSearchParams.value = {
      month: "2026-05",
      section: "rhythm"
    };

    render(<AnalysisShell />);

    expect(await screen.findByTestId("analysis-rhythm-board")).toBeInTheDocument();
    expect(screen.getByTestId("analysis-heatmap-day-2026-05-19")).toHaveTextContent("待到来");
    expect(screen.getByTestId("analysis-trends-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("analysis-demo-data-notice")).not.toBeInTheDocument();
  });

  it("does not offer interview start for future dates from the heatmap drill-down", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "rhythm"
    };

    render(<AnalysisShell />);

    const futureDay = await screen.findByTestId("analysis-heatmap-day-2026-05-31");
    fireEvent.click(futureDay);

    expect(screen.getByText("这一天还没到来。可以先查看当天，但未来日期不开放开始记录。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "开始这一天的记录" })).not.toBeInTheDocument();
  });

  it("does not report a hottest day when the month has scores but no saved entries", async () => {
    const scoreOnlyRecord = buildAnalysisMonthRecord();
    const scoreOnlyCoverage: AnalysisMonthRecord["dailyCoverage"] = scoreOnlyRecord.dailyCoverage.map((day) => ({
      ...day,
      savedEntryCount: 0,
      savedDimensionCount: 0,
      savedDimensions: [],
      hasDailyJournalSaved: false
    }));

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...scoreOnlyRecord,
          logOverview: {
            recordedDayCount: 0,
            savedEntryCount: 0,
            dailyJournalSavedDayCount: 0
          },
          dailyCoverage: scoreOnlyCoverage,
          rhythmOverview: buildRhythmOverview(scoreOnlyCoverage),
          dimensionBreakdown: scoreOnlyRecord.dimensionBreakdown.map((item) => ({
            ...item,
            savedEntryCount: 0,
            recordedDayCount: 0
          })),
          dimensions: scoreOnlyRecord.dimensions.map((item) => ({
            ...item,
            savedEntryCount: 0,
            recordedDayCount: 0,
            lastRecordedDate: null,
            thesis: "这个月这条线还没有形成能回看的材料。",
            confidence: "low",
            momentum: "quiet",
            continuity: "none",
            turningPointDate: null,
            representativeDates: [],
            relatedDimensions: [],
            nextQuestion: item.nextQuestion,
            topTags: [],
            recentSignals: [],
            evidence: []
          })),
          insightsOverview: {
            ...scoreOnlyRecord.insightsOverview,
            headline: "这个月先别急着下五维结论。",
            featuredDimension: null,
            summary: "这个月已经有了一些起伏，但还没有足够的文字材料把五维线索说清楚。",
            watchpoint: "已经有 2 天先留下了评分，但还没写成具体记录。"
          }
        } satisfies AnalysisMonthRecord),
        { status: 200 }
      )
    );

    mockSearchParams.value = {
      month: "2026-05",
      section: "rhythm"
    };

    render(<AnalysisShell />);

    const board = await screen.findByTestId("analysis-rhythm-board");
    expect(within(board).getByText("待成文日")).toBeInTheDocument();
    expect(within(board).getAllByText("暂无").length).toBeGreaterThan(0);
  });

  it("shows an empty-state featured panel when the month has scores but no saved entries", async () => {
    const scoreOnlyRecord = buildAnalysisMonthRecord();
    const scoreOnlyCoverage: AnalysisMonthRecord["dailyCoverage"] = scoreOnlyRecord.dailyCoverage.map((day) => ({
      ...day,
      savedEntryCount: 0,
      savedDimensionCount: 0,
      savedDimensions: [],
      hasDailyJournalSaved: false
    }));

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...scoreOnlyRecord,
          logOverview: {
            recordedDayCount: 0,
            savedEntryCount: 0,
            dailyJournalSavedDayCount: 0
          },
          dailyCoverage: scoreOnlyCoverage,
          rhythmOverview: buildRhythmOverview(scoreOnlyCoverage),
          dimensionBreakdown: scoreOnlyRecord.dimensionBreakdown.map((item) => ({
            ...item,
            savedEntryCount: 0,
            recordedDayCount: 0
          })),
          dimensions: scoreOnlyRecord.dimensions.map((item) => ({
            ...item,
            savedEntryCount: 0,
            recordedDayCount: 0,
            lastRecordedDate: null,
            thesis: "这个月这条线还没有形成能回看的材料。",
            confidence: "low",
            momentum: "quiet",
            continuity: "none",
            turningPointDate: null,
            representativeDates: [],
            relatedDimensions: [],
            nextQuestion: item.nextQuestion,
            topTags: [],
            recentSignals: [],
            evidence: []
          })),
          insightsOverview: {
            ...scoreOnlyRecord.insightsOverview,
            headline: "这个月先别急着下五维结论。",
            featuredDimension: null,
            summary: "这个月已经有了一些起伏，但还没有足够的文字材料把五维线索说清楚。",
            watchpoint: "已经有 2 天先留下了评分，但还没写成具体记录。"
          }
        } satisfies AnalysisMonthRecord),
        { status: 200 }
      )
    );

    mockSearchParams.value = {
      month: "2026-05",
      section: "insights"
    };

    render(<AnalysisShell />);

    expect(await screen.findByTestId("analysis-dimension-empty-state")).toHaveTextContent("这个月还没有形成文字线索");
    expect(screen.queryByTestId("analysis-dimension-featured-joy")).not.toBeInTheDocument();
  });

  it("keeps entryDate context in analysis drill-down interview links", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "insights"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-dimension-cards");

    const featuredCard = screen.getByTestId("analysis-dimension-featured-joy");
    const hrefs = within(featuredCard)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs.some((href) => href?.includes("/interview?dimension=joy&entryDate=2026-05-02"))).toBe(true);
  });

  it("does not count future dates toward the current month's longest quiet streak", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "rhythm"
    };

    render(<AnalysisShell />);

    const board = await screen.findByTestId("analysis-rhythm-board");
    const quietCard = within(board).getByText("最长空档").closest("div");

    expect(quietCard).not.toBeNull();
    expect(quietCard).toHaveTextContent("1 天");
    expect(quietCard).not.toHaveTextContent("5月8日 - 5月31日");
  });

  it("renders the score trend panel in read-only mode", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "trends"
    };

    render(<AnalysisShell />);

    const panel = await screen.findByTestId("happiness-score-panel");

    expect(screen.getByTestId("analysis-trends-placeholder")).toHaveTextContent("评分与记录趋势");
    expect(within(panel).getByRole("heading", { name: "评分走势" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "保存评分" })).not.toBeInTheDocument();
    expect(within(panel).getByTestId("score-factor-button-livingCondition")).toHaveTextContent("6.0");
  });

  it("renders average and factor score trends with gaps for unscored days", async () => {
    const gapScoreRecords: AnalysisMonthRecord["scoreRecords"] = [
      {
        id: "score-1",
        date: "2026-05-01",
        meaningScore: 5,
        healthScore: 5,
        virtueScore: 5,
        autonomyScore: 5,
        interestScore: 5,
        skillScore: 5,
        relationshipScore: 5,
        livingConditionScore: 5,
        createdAt: "2026-05-01T01:00:00.000Z",
        updatedAt: "2026-05-01T02:00:00.000Z"
      },
      {
        id: "score-3",
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
    ];

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...buildAnalysisMonthRecord(),
          ...buildScoreFields(gapScoreRecords),
          scoreRecords: gapScoreRecords
        } satisfies AnalysisMonthRecord),
        { status: 200 }
      )
    );
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const panel = await screen.findByTestId("happiness-score-trend-panel");

    expect(within(panel).getByText("总分平均走势")).toBeInTheDocument();
    expect(within(panel).getByText("单项走势")).toBeInTheDocument();
    expect(within(panel).getByText("已评分")).toBeInTheDocument();
    expect(within(panel).getByText("2 天")).toBeInTheDocument();
    expect(within(panel).getByText("月均总分")).toBeInTheDocument();
    expect(within(panel).getByText("6.3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "本月每日 8 项平均分走势，未评分日期断线" })).toBeInTheDocument();
    expect(screen.getAllByTestId("score-average-trend-chart-segment")).toHaveLength(2);
  });

  it("suppresses ranking highlights when there is only one scored day", async () => {
    const singleScoreRecord: AnalysisMonthRecord["scoreRecords"] = [
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
    ];

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...buildAnalysisMonthRecord(),
          ...buildScoreFields(singleScoreRecord),
          scoreRecords: singleScoreRecord
        } satisfies AnalysisMonthRecord),
        { status: 200 }
      )
    );
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const panel = await screen.findByTestId("happiness-score-trend-panel");

    expect(within(panel).queryByText("长期偏高")).not.toBeInTheDocument();
    expect(within(panel).queryByText("最常掉下来")).not.toBeInTheDocument();
    expect(within(panel).queryByText("波动最大")).not.toBeInTheDocument();
    expect(within(panel).getByTestId("score-trend-sample-note")).toHaveTextContent("评分样本还不足");
  });

  it("suppresses ranking highlights when all factors are tied", async () => {
    const flatScoreRecords: AnalysisMonthRecord["scoreRecords"] = [
      {
        id: "score-1",
        date: "2026-05-01",
        meaningScore: 6,
        healthScore: 6,
        virtueScore: 6,
        autonomyScore: 6,
        interestScore: 6,
        skillScore: 6,
        relationshipScore: 6,
        livingConditionScore: 6,
        createdAt: "2026-05-01T01:00:00.000Z",
        updatedAt: "2026-05-01T02:00:00.000Z"
      },
      {
        id: "score-2",
        date: "2026-05-02",
        meaningScore: 6,
        healthScore: 6,
        virtueScore: 6,
        autonomyScore: 6,
        interestScore: 6,
        skillScore: 6,
        relationshipScore: 6,
        livingConditionScore: 6,
        createdAt: "2026-05-02T01:00:00.000Z",
        updatedAt: "2026-05-02T02:00:00.000Z"
      }
    ];

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...buildAnalysisMonthRecord(),
          ...buildScoreFields(flatScoreRecords),
          scoreRecords: flatScoreRecords
        } satisfies AnalysisMonthRecord),
        { status: 200 }
      )
    );
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const panel = await screen.findByTestId("happiness-score-trend-panel");

    expect(within(panel).queryByText("长期偏高")).not.toBeInTheDocument();
    expect(within(panel).queryByText("最常掉下来")).not.toBeInTheDocument();
    expect(within(panel).queryByText("波动最大")).not.toBeInTheDocument();
    expect(within(panel).getByTestId("score-trend-sample-note")).toHaveTextContent("评分差异还不够明显");
  });

  it("switches the factor score trend without changing the month url", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("happiness-score-trend-panel");
    mockRouterReplace.mockClear();
    fireEvent.click(screen.getByTestId("score-factor-button-autonomy"));

    expect(screen.getByText("意志月均 6.5")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "本月意志评分走势，未评分日期断线" })).toBeInTheDocument();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("keeps the selected factor when the same score data re-renders", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    const { rerender } = render(<AnalysisShell />);

    await screen.findByTestId("happiness-score-trend-panel");
    fireEvent.click(screen.getByTestId("score-factor-button-autonomy"));

    rerender(<AnalysisShell />);

    expect(await screen.findByText("意志月均 6.5")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "本月意志评分走势，未评分日期断线" })).toBeInTheDocument();
  });

  it("does not render score entry controls in analysis score section", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("happiness-score-panel");
    expect(screen.queryByTestId("happiness-score-date-switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存评分" })).not.toBeInTheDocument();
  });

  it("does not call happiness-score save api from analysis score section", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/analysis/month")) {
        return new Response(JSON.stringify(buildAnalysisMonthRecord()), { status: 200 });
      }

      if (url === "/api/happiness-score" && init?.method === "PUT") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      return new Response(null, { status: 404 });
    });
    global.fetch = fetchMock as typeof fetch;
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("happiness-score-panel");
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/happiness-score")).toBe(false);
  });

  it("shows score trend empty state for months outside the edit window", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...buildAnalysisMonthRecord(),
          month: "2026-04",
          ...buildScoreFields([], "2026-04"),
          scoreRecords: [],
          editableDates: []
        } satisfies AnalysisMonthRecord),
        { status: 200 }
      )
    );
    mockSearchParams.value = {
      month: "2026-04",
      section: "score"
    };

    render(<AnalysisShell />);

    expect(await screen.findByTestId("score-average-trend-chart-empty")).toHaveTextContent("本月还没有可展示的评分走势");
    expect(screen.queryByRole("button", { name: "保存评分" })).not.toBeInTheDocument();
  });

  it("shows a score trend detail card when a chart data point is clicked", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const trendPanel = await screen.findByTestId("happiness-score-trend-panel");

    expect(screen.queryByTestId("score-trend-detail-card")).not.toBeInTheDocument();

    const point = await within(trendPanel).findByTestId("score-average-trend-chart-point-2026-05-02");
    fireEvent.click(point);

    const detailCard = await screen.findByTestId("score-trend-detail-card", undefined, { timeout: 3000 });
    expect(detailCard).toHaveTextContent("5月2日");
    expect(detailCard).toHaveTextContent("当天均分");

    fireEvent.click(within(detailCard).getByRole("button", { name: "关闭当日详情" }));

    expect(screen.queryByTestId("score-trend-detail-card")).not.toBeInTheDocument();
  });

  it("shows journal preview in score detail card for days with saved journals", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const trendPanel = await screen.findByTestId("happiness-score-trend-panel");
    const point = await within(trendPanel).findByTestId("score-average-trend-chart-point-2026-05-02");
    fireEvent.click(point);

    const detailCard = await screen.findByTestId("score-trend-detail-card", undefined, { timeout: 3000 });
    expect(detailCard).toHaveTextContent("五月二日的记录");
    expect(detailCard).toHaveTextContent("今天和朋友聚了一次");
    expect(within(detailCard).getByRole("link", { name: "查看完整日志 →" })).toHaveAttribute("href", expect.stringContaining("/calendar?"));
  });

  it("shows a placeholder for days without journal in score detail card", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const trendPanel = await screen.findByTestId("happiness-score-trend-panel");
    const point = await within(trendPanel).findByTestId("score-average-trend-chart-point-2026-05-03");
    fireEvent.click(point);

    const detailCard = await screen.findByTestId("score-trend-detail-card", undefined, { timeout: 3000 });
    expect(detailCard).toHaveTextContent("这一天还没有生成日志");
    expect(within(detailCard).getByRole("link", { name: "去日历看这一天 →" })).toHaveAttribute("href", expect.stringContaining("/calendar?"));
  });

  it("shows pending-daily-journal copy for days with saved dimension logs but no daily journal", async () => {
    const scoreRecords: AnalysisMonthRecord["scoreRecords"] = [
      ...buildAnalysisMonthRecord().scoreRecords,
      {
        id: "score-3",
        date: "2026-05-07",
        meaningScore: 7,
        healthScore: 6,
        virtueScore: 7,
        autonomyScore: 7,
        interestScore: 6,
        skillScore: 7,
        relationshipScore: 8,
        livingConditionScore: 7,
        createdAt: "2026-05-07T01:00:00.000Z",
        updatedAt: "2026-05-07T02:00:00.000Z"
      }
    ];
    const dailyCoverage = buildDailyCoverage(scoreRecords);

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...buildAnalysisMonthRecord(),
          dailyCoverage,
          rhythmOverview: buildRhythmOverview(dailyCoverage),
          ...buildScoreFields(scoreRecords),
          scoreRecords
        } satisfies AnalysisMonthRecord),
        { status: 200 }
      )
    );
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const trendPanel = await screen.findByTestId("happiness-score-trend-panel");
    fireEvent.click(await within(trendPanel).findByTestId("score-average-trend-chart-point-2026-05-07"));

    const detailCard = await screen.findByTestId("score-trend-detail-card", undefined, { timeout: 3000 });
    expect(detailCard).toHaveTextContent("这一天已有 1 条维度记录，但还没有整合成完整日志");
    expect(detailCard).not.toHaveTextContent("这一天还没有生成日志");
    expect(within(detailCard).getByRole("link", { name: "去日历看这一天 →" })).toHaveAttribute("href", expect.stringContaining("/calendar?"));
  });

  it("shows journal preview in rhythm day detail panel for days with saved journals", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "rhythm"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-rhythm-board");

    fireEvent.click(screen.getByTestId("analysis-heatmap-day-2026-05-02"));

    const preview = screen.getByTestId("rhythm-day-journal-preview");
    expect(preview).toHaveTextContent("五月二日的记录");
    expect(preview).toHaveTextContent("今天和朋友聚了一次");
    expect(within(preview).getByRole("link", { name: "查看完整日志 →" })).toBeInTheDocument();
  });

  it("shows signal preview in rhythm day detail panel for days without journal but with entries", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "rhythm"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-rhythm-board");

    fireEvent.click(screen.getByTestId("analysis-heatmap-day-2026-05-07"));

    const preview = screen.getByTestId("rhythm-day-signal-preview");
    expect(preview).toHaveTextContent("已有 1 条记录，但还没有整合成日志");
  });

  it("renders evidence date links in dimension insight cards", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "insights"
    };

    render(<AnalysisShell />);

    const dimensionCards = await screen.findByTestId("analysis-dimension-cards");

    const links = within(dimensionCards).getAllByRole("link", { name: /5月2日 →/ });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", expect.stringContaining("/calendar?"));
  });

  it("shows journal context in score trend highlight cards", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const trendPanel = await screen.findByTestId("happiness-score-trend-panel");

    expect(trendPanel).toHaveTextContent("你在「开心」维度记录 1 天，常出现「关系型开心」");
  });
});
