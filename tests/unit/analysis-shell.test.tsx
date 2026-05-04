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

describe("analysis shell", () => {
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

    return {
      month: "2026-05",
      logOverview: {
        recordedDayCount: 2,
        savedEntryCount: 4,
        dailyJournalSavedDayCount: 1
      },
      dailyCoverage: Array.from({ length: 31 }, (_, index) => {
        const date = `2026-05-${String(index + 1).padStart(2, "0")}`;

        if (date === "2026-05-02") {
          return {
            date,
            savedDimensionCount: 2,
            savedDimensions: ["joy", "reflection"],
            hasDailyJournalSaved: true
          };
        }

        if (date === "2026-05-07") {
          return {
            date,
            savedDimensionCount: 1,
            savedDimensions: ["gratitude"],
            hasDailyJournalSaved: false
          };
        }

        return {
          date,
          savedDimensionCount: 0,
          savedDimensions: [],
          hasDailyJournalSaved: false
        };
      }),
      dimensionBreakdown: [
        { dimension: "joy", savedEntryCount: 2, recordedDayCount: 1 },
        { dimension: "fulfillment", savedEntryCount: 0, recordedDayCount: 0 },
        { dimension: "reflection", savedEntryCount: 1, recordedDayCount: 1 },
        { dimension: "improvement", savedEntryCount: 0, recordedDayCount: 0 },
        { dimension: "gratitude", savedEntryCount: 1, recordedDayCount: 1 }
      ],
      dimensions: [
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
              entryId: "entry-joy-2",
              date: "2026-05-02",
              primarySignal: "那种不用解释也能放松的陪伴",
              secondarySignal: "我会被这种没负担的陪伴带回轻松里"
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
              entryId: "entry-reflection-1",
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
          topTags: [{ tag: "支持", count: 1 }],
          recentSignals: [
            {
              entryId: "entry-gratitude-1",
              date: "2026-05-07",
              primarySignal: "看出我快撑不住，先帮我理清优先级",
              secondarySignal: "这种关系回应值得珍惜"
            }
          ]
        }
      ],
      ...buildScoreFields(scoreRecords),
      scoreRecords,
      editableDates: ["2026-05-03", "2026-05-02"]
    };
  }

  beforeEach(() => {
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      month: null,
      section: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildAnalysisMonthRecord()), { status: 200 })) as typeof fetch;
  });

  it("normalizes missing month search params to the current month", async () => {
    render(<AnalysisShell />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=overview", { scroll: false });
    await screen.findByTestId("analysis-overview-placeholder");
  });

  it("shows the overview section by default when section param is absent", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: null
    };

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-overview-cards");

    expect(screen.queryByTestId("happiness-score-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("analysis-rhythm-board")).not.toBeInTheDocument();
    expect(screen.queryByTestId("analysis-dimension-cards")).not.toBeInTheDocument();
  });

  it("keeps a valid month and section without rewriting the url", async () => {
    mockSearchParams.value = {
      month: "2026-04",
      section: "score"
    };

    render(<AnalysisShell />);

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(await screen.findByTestId("analysis-score-placeholder")).toBeInTheDocument();
  });

  it("falls back invalid month params to the current month", async () => {
    mockSearchParams.value = {
      month: "2026-13",
      section: "score"
    };

    render(<AnalysisShell />);

    expect(mockRouterReplace).toHaveBeenCalledWith("/analysis?month=2026-05&section=score", { scroll: false });
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
    expect(screen.queryByTestId("analysis-overview-cards")).not.toBeInTheDocument();
  });

  it("keeps the month summary hero exclusive to the overview tab", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
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

  it("renders only the requested section on initial deep-link navigation", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "rhythm"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("analysis-rhythm-board");

    expect(screen.queryByTestId("analysis-overview-placeholder")).not.toBeInTheDocument();
    expect(screen.queryByTestId("happiness-score-panel")).not.toBeInTheDocument();
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
          dailyCoverage: Array.from({ length: 31 }, (_, index) => ({
            date: `2026-05-${String(index + 1).padStart(2, "0")}`,
            savedDimensionCount: 0,
            savedDimensions: [],
            hasDailyJournalSaved: false
          })),
          dimensionBreakdown: [
            { dimension: "joy", savedEntryCount: 0, recordedDayCount: 0 },
            { dimension: "fulfillment", savedEntryCount: 0, recordedDayCount: 0 },
            { dimension: "reflection", savedEntryCount: 0, recordedDayCount: 0 },
            { dimension: "improvement", savedEntryCount: 0, recordedDayCount: 0 },
            { dimension: "gratitude", savedEntryCount: 0, recordedDayCount: 0 }
          ],
          dimensions: [
            { dimension: "joy", savedEntryCount: 0, recordedDayCount: 0, lastRecordedDate: null, topTags: [], recentSignals: [] },
            { dimension: "fulfillment", savedEntryCount: 0, recordedDayCount: 0, lastRecordedDate: null, topTags: [], recentSignals: [] },
            { dimension: "reflection", savedEntryCount: 0, recordedDayCount: 0, lastRecordedDate: null, topTags: [], recentSignals: [] },
            { dimension: "improvement", savedEntryCount: 0, recordedDayCount: 0, lastRecordedDate: null, topTags: [], recentSignals: [] },
            { dimension: "gratitude", savedEntryCount: 0, recordedDayCount: 0, lastRecordedDate: null, topTags: [], recentSignals: [] }
          ],
          ...buildScoreFields([]),
          scoreRecords: [],
          editableDates: ["2026-05-03", "2026-05-02"]
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
    expect(screen.getByTestId("analysis-heatmap-day-2026-05-19")).toHaveTextContent("0维");
    expect(screen.getByTestId("analysis-coverage-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("analysis-overview-placeholder")).not.toBeInTheDocument();
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

    expect(screen.getByText("这一天还没到来。你可以先查看当天，但未来日期暂不开放开始记录。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "开始这一天的记录" })).not.toBeInTheDocument();
  });

  it("does not report a hottest day when the month has scores but no saved entries", async () => {
    const scoreOnlyRecord = buildAnalysisMonthRecord();

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...scoreOnlyRecord,
          logOverview: {
            recordedDayCount: 0,
            savedEntryCount: 0,
            dailyJournalSavedDayCount: 0
          },
          dailyCoverage: scoreOnlyRecord.dailyCoverage.map((day) => ({
            ...day,
            savedDimensionCount: 0,
            savedDimensions: [],
            hasDailyJournalSaved: false
          })),
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
            topTags: [],
            recentSignals: []
          }))
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
    expect(within(board).getByText("最高密度")).toBeInTheDocument();
    expect(within(board).getAllByText("暂无").length).toBeGreaterThan(0);
  });

  it("shows an empty-state featured panel when the month has scores but no saved entries", async () => {
    const scoreOnlyRecord = buildAnalysisMonthRecord();

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...scoreOnlyRecord,
          logOverview: {
            recordedDayCount: 0,
            savedEntryCount: 0,
            dailyJournalSavedDayCount: 0
          },
          dailyCoverage: scoreOnlyRecord.dailyCoverage.map((day) => ({
            ...day,
            savedDimensionCount: 0,
            savedDimensions: [],
            hasDailyJournalSaved: false
          })),
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
            topTags: [],
            recentSignals: []
          }))
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

    const links = screen
      .getAllByRole("link", { name: "回到开心" })
      .map((link) => link.getAttribute("href"));

    expect(links.length).toBeGreaterThan(0);
    expect(links.every((href) => href?.includes("/interview?dimension=joy&entryDate=2026-05-02"))).toBe(true);
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
    expect(quietCard).toHaveTextContent("2 天");
    expect(quietCard).not.toHaveTextContent("5月8日 - 5月31日");
  });

  it("renders the happiness score editor with filled values", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const panel = await screen.findByTestId("happiness-score-panel");

    expect(screen.getByTestId("analysis-score-placeholder")).toHaveTextContent("幸福 8 要素评分");
    expect(within(panel).getByLabelText("意义感评分")).toHaveValue("8");
    expect(within(panel).getByLabelText("生活条件评分")).toHaveValue("6");
    expect(within(panel).getByRole("button", { name: "保存评分" })).toBeEnabled();
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

  it("switches the factor score trend without changing the month url", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    await screen.findByTestId("happiness-score-trend-panel");
    mockRouterReplace.mockClear();
    fireEvent.click(screen.getByTestId("score-factor-button-relationship"));

    expect(screen.getByText("关系月均 8.5")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "本月关系评分走势，未评分日期断线" })).toBeInTheDocument();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("switches between today and yesterday score records", async () => {
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const panel = await screen.findByTestId("happiness-score-panel");

    expect(within(panel).getByLabelText("意义感评分")).toHaveValue("8");
    fireEvent.click(within(panel).getByRole("button", { name: "昨天" }));
    expect(within(panel).getByLabelText("意义感评分")).toHaveValue("6");
    expect(within(panel).getByText("当前日期：5月2日")).toBeInTheDocument();
  });

  it("keeps save disabled until all eight score items are filled", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...buildAnalysisMonthRecord(),
          ...buildScoreFields([]),
          scoreRecords: [],
          editableDates: ["2026-05-03", "2026-05-02"]
        } satisfies AnalysisMonthRecord),
        { status: 200 }
      )
    );
    mockSearchParams.value = {
      month: "2026-05",
      section: "score"
    };

    render(<AnalysisShell />);

    const panel = await screen.findByTestId("happiness-score-panel");

    expect(within(panel).getByRole("button", { name: "保存评分" })).toBeDisabled();
    fireEvent.change(within(panel).getByLabelText("意义感评分"), { target: { value: "8" } });
    expect(within(panel).getByRole("button", { name: "保存评分" })).toBeDisabled();
  });

  it("saves a complete happiness score and refreshes the month analysis", async () => {
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

    const panel = await screen.findByTestId("happiness-score-panel");
    fireEvent.click(within(panel).getByRole("button", { name: "保存评分" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/happiness-score",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            date: "2026-05-03",
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
          })
        })
      );
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/analysis/month"))).toHaveLength(2);
    });
  });

  it("shows a read-only score note for months outside the edit window", async () => {
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

    expect(await screen.findByTestId("happiness-score-readonly")).toHaveTextContent("这个月份的评分只能查看");
    expect(await screen.findByTestId("score-average-trend-chart-empty")).toHaveTextContent("本月还没有可展示的评分走势");
    expect(screen.queryByRole("button", { name: "保存评分" })).not.toBeInTheDocument();
  });
});
