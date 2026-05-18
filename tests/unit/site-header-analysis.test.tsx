import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { SiteHeader } from "@/components/shared/site-header";
import { analysisToolbarRefreshEventName } from "@/features/analysis/toolbar-refresh";

const { mockPathname, mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: {
    value: "/analysis"
  },
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      dimension: null as string | null,
      view: null as string | null,
      date: null as string | null,
      month: "2026-05" as string | null,
      section: "score" as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "dimension" | "view" | "date" | "month" | "section"] ?? null
  })
}));

function buildMinimalRecord() {
  return {
    month: "2026-05",
    logOverview: { recordedDayCount: 2, savedEntryCount: 3, dailyJournalSavedDayCount: 1 },
    dailyCoverage: Array.from({ length: 31 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, "0")}`,
      savedEntryCount: i === 1 ? 3 : 0,
      savedDimensionCount: i === 1 ? 2 : 0,
      savedDimensions: i === 1 ? ["joy", "reflection"] : [],
      hasDailyJournalSaved: false,
      hasStaleDailyJournal: false,
      hasScore: i === 2,
      averageScore: i === 2 ? 7.5 : null
    })),
    rhythmOverview: {
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
    },
    dimensionBreakdown: [
      { dimension: "joy", savedEntryCount: 2, recordedDayCount: 1 },
      { dimension: "fulfillment", savedEntryCount: 0, recordedDayCount: 0 },
      { dimension: "reflection", savedEntryCount: 1, recordedDayCount: 1 },
      { dimension: "improvement", savedEntryCount: 0, recordedDayCount: 0 },
      { dimension: "gratitude", savedEntryCount: 0, recordedDayCount: 0 }
    ],
    dimensions: [
      {
        dimension: "joy",
        savedEntryCount: 2,
        recordedDayCount: 1,
        lastRecordedDate: "2026-05-02",
        thesis: "这个月让你更容易亮起来的，多半和那种不用解释也能放松的陪伴有关。",
        confidence: "medium",
        momentum: "starting",
        continuity: "single",
        turningPointDate: "2026-05-02",
        representativeDates: ["2026-05-02"],
        relatedScoreFactors: ["interest", "relationship"],
        relatedDimensions: ["reflection"],
        scoreLink: {
          average: 8.5,
          status: "supporting",
          summary: "热爱、人际在评分里也不低，这条线不只是写出来了，分数里也能看见。"
        },
        nextQuestion: "这类开心只是偶尔出现，还是已经开始重复出现了？",
        topTags: [],
        recentSignals: [],
        evidence: []
      }
    ],
    insightsOverview: {
      headline: "开心是这个月最清楚的一条线，思考也已经开始接上。",
      summary: "这个月更成形的是开心这条线，旁边陪着它一起动的，多半是思考。热爱、人际在评分里也不低，这条线不只是写出来了，分数里也能看见。",
      watchpoint: "擅长、意志、美德在评分里还不算稳，这条线也还没有真正展开。",
      featuredDimension: "joy",
      quietDimensions: ["fulfillment", "improvement", "gratitude"],
      links: [
        {
          type: "score",
          title: "评分里也在呼应",
          detail: "热爱、人际在评分里也不低，这条线不只是写出来了，分数里也能看见。",
          dimensions: ["joy"],
          anchorDate: "2026-05-02"
        }
      ]
    },
    scoreOverview: { scoredDayCount: 1, monthAverageScore: 7.5, latestScoredDate: "2026-05-03" },
    scoreTrend: { days: [], factorAverages: {} },
    scoreRecords: [{ id: "s1", date: "2026-05-03", meaningScore: 8, healthScore: 7, virtueScore: 9, autonomyScore: 6, interestScore: 8, skillScore: 7, relationshipScore: 9, livingConditionScore: 6, createdAt: "", updatedAt: "" }],
    editableDates: ["2026-05-03", "2026-05-02"]
  };
}

describe("site header analysis toolbar", () => {
  let historyReplaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    historyReplaceStateSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
    mockPathname.value = "/analysis";
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-05",
      section: "score"
    };
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify(buildMinimalRecord()), { status: 200 })
    ) as typeof fetch;
  });

  afterEach(() => {
    historyReplaceStateSpy.mockRestore();
  });

  it("renders section tabs in the toolbar with month label", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    expect(within(toolbar).getByText("2026年5月")).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /总览/ })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /评分/ })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /节奏/ })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /五维/ })).toBeInTheDocument();
  });

  it("highlights the active section tab", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    expect(within(toolbar).getByRole("button", { name: /评分/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(toolbar).getByRole("button", { name: /总览/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("navigates to a section when clicking a tab", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: /节奏/ }));
    expect(historyReplaceStateSpy).toHaveBeenCalledWith(null, "", "/analysis?month=2026-05&section=rhythm");
  });

  it("shows contextual chips after data loads", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    await waitFor(() => {
      expect(within(toolbar).getByText("1天评分")).toBeInTheDocument();
    });
    expect(within(toolbar).getByText("待整合 1 天")).toBeInTheDocument();
    expect(within(toolbar).getByText("开心")).toBeInTheDocument();
  });

  it("refreshes the score chip after the current month is updated", async () => {
    const initialRecord = {
      ...buildMinimalRecord(),
      scoreOverview: { scoredDayCount: 0, monthAverageScore: null, latestScoredDate: null },
      scoreRecords: []
    };
    const nextRecord = {
      ...buildMinimalRecord(),
      scoreOverview: { scoredDayCount: 1, monthAverageScore: 7.5, latestScoredDate: "2026-05-03" }
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(initialRecord), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(nextRecord), { status: 200 })) as typeof fetch;

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    await waitFor(() => {
      expect(within(toolbar).getByText("暂无评分")).toBeInTheDocument();
    });

    mockSearchParams.value = {
      ...mockSearchParams.value,
      month: "2026-05",
      section: "score"
    };

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(analysisToolbarRefreshEventName, {
          detail: { month: "2026-05" }
        })
      );
    });

    await waitFor(() => {
      expect(within(toolbar).getByText("1天评分")).toBeInTheDocument();
    });
  });

  it("switches months from the header toolbar", async () => {
    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看上月分析" }));
    expect(historyReplaceStateSpy).toHaveBeenCalledWith(null, "", "/analysis?month=2026-04&section=score");

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看下月分析" }));
    expect(historyReplaceStateSpy).toHaveBeenCalledWith(null, "", "/analysis?month=2026-06&section=score");

    fireEvent.click(within(toolbar).getByRole("button", { name: "回到本月分析" }));
    expect(historyReplaceStateSpy).toHaveBeenCalledWith(null, "", "/analysis?month=2026-05&section=score");
  });

  it("preserves the current analysis section when paging months", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-05",
      section: "rhythm"
    };

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("analysis-toolbar");

    fireEvent.click(within(toolbar).getByRole("button", { name: "查看上月分析" }));
    expect(historyReplaceStateSpy).toHaveBeenCalledWith(null, "", "/analysis?month=2026-04&section=rhythm");
  });

  it("normalizes invalid analysis month values in the header toolbar", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: "2026-13",
      section: "score"
    };

    render(<SiteHeader />);

    expect(historyReplaceStateSpy).toHaveBeenCalledWith(null, "", "/analysis?month=2026-05&section=score");
    expect(await screen.findByTestId("analysis-toolbar")).toBeInTheDocument();
  });
});
