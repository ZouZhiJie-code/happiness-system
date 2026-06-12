import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { AnalysisShell } from "@/components/analysis/analysis-shell";
import { analysisPeriodLoadingEventName } from "@/features/analysis/period-nav";
import type { AnalysisMonthRecord, AnalysisTrendsRangeRecord } from "@/features/analysis/types";

const { mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      month: null as string | null,
      section: null as string | null,
      preset: null as string | null,
      start: null as string | null,
      end: null as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "month" | "section" | "preset" | "start" | "end"] ?? null
  })
}));

function setMockSearchParams(overrides: Partial<(typeof mockSearchParams)["value"]>) {
  mockSearchParams.value = {
    month: null,
    section: null,
    preset: null,
    start: null,
    end: null,
    ...overrides
  };
}

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
              title: "清醒地开始",
              summary: "那种不用解释也能放松的陪伴",
              detail: "我会被这种没负担的陪伴带回轻松里",
              excerpt: "那天早上比平时早醒半小时，没有急着看手机，先把窗口推开，让风进来。"
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
              title: "别把忙碌当进展",
              summary: "我太容易把忙碌错当进展",
              detail: "以后判断进展要看依据有没有变清楚",
              excerpt: "忙了一整天以后，我才意识到真正推进的事情其实只有一件。"
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
              title: "有人帮我理清",
              summary: "看出我快撑不住，先帮我理清优先级",
              detail: "这种关系回应值得珍惜",
              excerpt: "她看出我快撑不住，没有继续催进度，而是先帮我理清优先级。"
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

  function buildAnalysisTrendsRangeRecord(monthRecord = buildAnalysisMonthRecord()): AnalysisTrendsRangeRecord {
    const month = monthRecord.month;
    const startDate = `${month}-01`;
    const endDate = "2026-05-03";

    return {
      preset: "month",
      startDate,
      endDate,
      logOverview: monthRecord.logOverview,
      dailyCoverage: monthRecord.dailyCoverage.filter((day) => day.date <= endDate),
      scoreOverview: monthRecord.scoreOverview,
      scoreTrend: {
        days: monthRecord.scoreTrend.days.filter((day) => day.date <= endDate),
        factorAverages: monthRecord.scoreTrend.factorAverages
      }
    };
  }

  function createAnalysisFetchMock(monthRecord = buildAnalysisMonthRecord()) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/analysis/month")) {
        return new Response(JSON.stringify(monthRecord), { status: 200 });
      }

      if (url.includes("/api/analysis/range")) {
        return new Response(JSON.stringify(buildAnalysisTrendsRangeRecord(monthRecord)), { status: 200 });
      }

      if (url === "/api/happiness-score" && init?.method === "PUT") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      return new Response(null, { status: 404 });
    });
  }

  beforeEach(() => {
    historyReplaceStateSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
    mockRouterReplace.mockReset();
    setMockSearchParams({});
    global.fetch = createAnalysisFetchMock() as typeof fetch;
  });

  afterEach(() => {
    historyReplaceStateSpy.mockRestore();
  });

  it("normalizes missing month search params to the current month", async () => {
    render(<AnalysisShell />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=trends", { scroll: false });
    await screen.findByTestId("analysis-trends-section");
  });

  it("renders all analysis sections on a single scroll page by default", async () => {
    setMockSearchParams({
      month: "2026-05",
      section: null
    });

    render(<AnalysisShell />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=trends", { scroll: false });
    await screen.findByTestId("analysis-trends-section");
    expect(screen.getByRole("heading", { name: "总分走势" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "日志天数" })).toBeInTheDocument();
    await screen.findByTestId("analysis-dimension-cards");

    expect(screen.getByTestId("analysis-dimensions-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("analysis-correlation-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("analysis-review-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("analysis-month-hero")).not.toBeInTheDocument();
  });

  it("keeps a valid month and canonical section without rewriting the url", async () => {
    setMockSearchParams({
      month: "2026-04",
      section: "correlation"
    });

    render(<AnalysisShell />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(historyReplaceStateSpy).not.toHaveBeenCalled();
    expect(await screen.findByTestId("analysis-correlation-placeholder")).toBeInTheDocument();
  });

  it("falls back invalid month params to the current month", async () => {
    setMockSearchParams({
      month: "2026-13",
      section: "score"
    });

    render(<AnalysisShell />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=trends", { scroll: false });
    await screen.findByTestId("analysis-trends-section");
  });

  it("does not render month controls in the page body", async () => {
    setMockSearchParams({
      month: "2026-05",
      section: "score"
    });

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-trends-section");
    expect(screen.queryByTestId("analysis-month-controls")).not.toBeInTheDocument();
  });

  it("does not render the legacy overview hero on the single-page layout", async () => {
    setMockSearchParams({
      month: "2026-05",
      section: "trends"
    });

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-trends-section");

    expect(screen.queryByTestId("analysis-month-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("analysis-status-board")).not.toBeInTheDocument();
  });

  it("renders the five-dimension accordion layout with equal summary rows", async () => {
    setMockSearchParams({
      month: "2026-05",
      section: "insights"
    });

    render(<AnalysisShell />);

    await waitFor(() => {
      expect(screen.getByTestId("analysis-dimension-cards")).toBeInTheDocument();
    });

    expect(screen.getByTestId("analysis-dimension-row-joy")).toHaveTextContent("开心");
    expect(screen.getByTestId("analysis-dimension-row-reflection")).toHaveTextContent("思考");
    expect(screen.getByTestId("analysis-dimension-row-gratitude")).toHaveTextContent("感谢");
    expect(screen.queryByText("本月判断")).not.toBeInTheDocument();
    expect(screen.queryByText("维度之间")).not.toBeInTheDocument();
    expect(screen.queryByText("下一步")).not.toBeInTheDocument();
  });

  it("renders all sections together even when deep-linking to a legacy rhythm section", async () => {
    setMockSearchParams({
      month: "2026-05",
      section: "rhythm"
    });

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-trends-section");
    expect(screen.getByRole("heading", { name: "幸福 8 要素评分" })).toBeInTheDocument();
    expect(screen.getByTestId("analysis-dimensions-placeholder")).toBeInTheDocument();
  });

  it("renders a read-only log-days heatmap without drill-down actions", async () => {
    setMockSearchParams({
      month: "2026-05",
      section: "trends"
    });

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-trends-section");
    expect(screen.getByRole("heading", { name: "日志天数" })).toBeInTheDocument();
    expect(screen.queryByTestId("analysis-rhythm-board")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "开始这一天的记录" })).not.toBeInTheDocument();
  });

  it("shows empty-state accordion rows when the month has scores but no saved entries", async () => {
    const scoreOnlyRecord = buildAnalysisMonthRecord();
    const scoreOnlyCoverage: AnalysisMonthRecord["dailyCoverage"] = scoreOnlyRecord.dailyCoverage.map((day) => ({
      ...day,
      savedEntryCount: 0,
      savedDimensionCount: 0,
      savedDimensions: [],
      hasDailyJournalSaved: false
    }));

    global.fetch = createAnalysisFetchMock({
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
    }) as typeof fetch;

    setMockSearchParams({
      month: "2026-05",
      section: "insights"
    });

    render(<AnalysisShell />);

    expect(await screen.findByTestId("analysis-dimension-cards")).toBeInTheDocument();
    expect(screen.getAllByText("本月还没有记录")).toHaveLength(5);
  });

  it("keeps entryDate context in analysis drill-down interview links", async () => {
    setMockSearchParams({
      month: "2026-05",
      section: "insights"
    });

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-dimension-cards");
    fireEvent.click(within(screen.getByTestId("analysis-dimension-row-joy")).getByRole("button"));
    const panel = await screen.findByTestId("analysis-dimension-panel-joy");
    fireEvent.click(within(panel).getByTestId("analysis-evidence-chip-entry-joy-2"));
    const hrefs = within(panel)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs.some((href) => href?.includes("/interview?dimension=joy&entryDate=2026-05-02"))).toBe(true);
  });

  it("renders the trends section in read-only mode", async () => {
    setMockSearchParams({
      month: "2026-05",
      section: "trends"
    });

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-trends-section");

    expect(screen.getByRole("heading", { name: "总分走势" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "日志天数" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "幸福 8 要素评分" })).toBeInTheDocument();
    expect(screen.getByLabelText("总分柱线走势")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存评分" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("analysis-rhythm-board")).not.toBeInTheDocument();
  });

  it("shows an empty score chart state when the range has no scores", async () => {
    const emptyRecord = {
      ...buildAnalysisMonthRecord(),
      ...buildScoreFields([]),
      scoreRecords: []
    };

    global.fetch = createAnalysisFetchMock(emptyRecord) as typeof fetch;
    setMockSearchParams({
      month: "2026-05",
      section: "trends"
    });

    render(<AnalysisShell />);

    expect(await screen.findByText("这个周期还没有评分记录。")).toBeInTheDocument();
  });

  it("renders inline body excerpts when selecting evidence date chips", async () => {
    setMockSearchParams({
      month: "2026-05",
      section: "insights"
    });

    render(<AnalysisShell />);

    const dimensionCards = await screen.findByTestId("analysis-dimension-cards");
    fireEvent.click(within(within(dimensionCards).getByTestId("analysis-dimension-row-joy")).getByRole("button"));
    const panel = await screen.findByTestId("analysis-dimension-panel-joy");
    fireEvent.click(within(panel).getByTestId("analysis-evidence-chip-entry-joy-2"));

    expect(screen.getByTestId("analysis-evidence-preview-entry-joy-2")).toHaveTextContent("清醒地开始");
    expect(screen.getByTestId("analysis-evidence-preview-entry-joy-2")).toHaveTextContent(
      "那天早上比平时早醒半小时，没有急着看手机，先把窗口推开，让风进来。"
    );

    const calendarLink = within(screen.getByTestId("analysis-evidence-preview-entry-joy-2")).getByRole("link", {
      name: "在日历中打开"
    });
    expect(calendarLink).toHaveAttribute("href", expect.stringContaining("/calendar?"));
  });

  it("fetches month and range records in parallel", async () => {
    const fetchMock = createAnalysisFetchMock();
    global.fetch = fetchMock as typeof fetch;
    setMockSearchParams({
      month: "2026-05",
      section: "trends"
    });

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-trends-section");

    const monthCallIndex = fetchMock.mock.calls.findIndex(([input]) => String(input).includes("/api/analysis/month"));
    const rangeCallIndex = fetchMock.mock.calls.findIndex(([input]) => String(input).includes("/api/analysis/range"));

    expect(monthCallIndex).toBeGreaterThanOrEqual(0);
    expect(rangeCallIndex).toBeGreaterThanOrEqual(0);
    expect(Math.abs(monthCallIndex - rangeCallIndex)).toBeLessThanOrEqual(1);
  });

  it("broadcasts period loading events while fetching", async () => {
    const loadingEvents: boolean[] = [];
    const listener = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as { loading?: boolean } | null) : null;
      if (typeof detail?.loading === "boolean") {
        loadingEvents.push(detail.loading);
      }
    };

    window.addEventListener(analysisPeriodLoadingEventName, listener);
    setMockSearchParams({
      month: "2026-05",
      section: "trends"
    });

    try {
      render(<AnalysisShell />);
      await screen.findByTestId("analysis-trends-section");
      expect(loadingEvents).toContain(true);
      expect(loadingEvents.at(-1)).toBe(false);
    } finally {
      window.removeEventListener(analysisPeriodLoadingEventName, listener);
    }
  });

});
