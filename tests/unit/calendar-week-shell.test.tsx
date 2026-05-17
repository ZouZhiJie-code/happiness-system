import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";

import { CalendarWeekShell } from "@/components/calendar/calendar-week-shell";
import type { CalendarDayRecord, CalendarDimensionStatus, CalendarWeekRecord } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";

const { mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      view: "week" as string | null,
      date: "2026-05-07" as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "view" | "date"] ?? null
  })
}));

function buildDimensionStatus(
  overrides: Partial<CalendarDimensionStatus> & Pick<CalendarDimensionStatus, "dimension">
): CalendarDimensionStatus {
  return {
    dimension: overrides.dimension,
    status: overrides.status ?? "empty",
    title: overrides.title ?? null,
    summary: overrides.summary ?? null,
    latestUpdatedAt: overrides.latestUpdatedAt ?? null,
    sessionId: overrides.sessionId ?? null,
    journalEntryId: overrides.journalEntryId ?? null,
    activeSessionId: overrides.activeSessionId ?? null,
    draftSessionId: overrides.draftSessionId ?? null,
    draftJournalEntryId: overrides.draftJournalEntryId ?? null,
    savedSessionId: overrides.savedSessionId ?? null,
    savedJournalEntryId: overrides.savedJournalEntryId ?? null,
    actions: overrides.actions ?? [],
    hasActiveSession: overrides.hasActiveSession ?? false,
    hasDraftEntry: overrides.hasDraftEntry ?? false,
    hasSavedEntry: overrides.hasSavedEntry ?? false
  };
}

function buildDay(date: string, overrides?: Partial<CalendarDayRecord>): CalendarDayRecord {
  const dimensions: CalendarDimensionStatus[] =
    overrides?.dimensions ??
    [
      buildDimensionStatus({ dimension: "joy" }),
      buildDimensionStatus({ dimension: "fulfillment" }),
      buildDimensionStatus({ dimension: "reflection" }),
      buildDimensionStatus({ dimension: "improvement" }),
      buildDimensionStatus({ dimension: "gratitude" })
    ];

  return {
    date,
    overallStatus: overrides?.overallStatus ?? "empty",
    dimensions,
    activeCount: overrides?.activeCount ?? 0,
    draftCount: overrides?.draftCount ?? 0,
    savedCount: overrides?.savedCount ?? 0,
    primaryTitle: overrides?.primaryTitle ?? null,
    primarySummary: overrides?.primarySummary ?? null,
    latestUpdatedAt: overrides?.latestUpdatedAt ?? null,
    primaryAction: overrides?.primaryAction ?? null
  };
}

function buildWeekRecord(): CalendarWeekRecord {
  return {
    anchorDate: "2026-05-07",
    weekStartDate: "2026-05-04",
    weekEndDate: "2026-05-10",
    days: [
      buildDay("2026-05-04", {
        overallStatus: "completed",
        savedCount: 1,
        primaryTitle: "项目终于收束",
        latestUpdatedAt: "2026-05-04T10:00:00.000Z",
        primaryAction: "view_journal",
        dimensions: [
          buildDimensionStatus({
            dimension: "joy",
            status: "completed",
            hasSavedEntry: true,
            sessionId: "session-joy-completed",
            savedSessionId: "session-joy-completed",
            savedJournalEntryId: "entry-joy-completed",
            actions: ["view_journal", "edit_saved_journal"]
          }),
          buildDimensionStatus({ dimension: "fulfillment" }),
          buildDimensionStatus({ dimension: "reflection" }),
          buildDimensionStatus({ dimension: "improvement" }),
          buildDimensionStatus({ dimension: "gratitude" })
        ]
      }),
      buildDay("2026-05-05", {
        overallStatus: "draft",
        draftCount: 1,
        primarySummary: "还有一段没整理完。",
        latestUpdatedAt: "2026-05-05T12:00:00.000Z",
        primaryAction: "continue_editing",
        dimensions: [
          buildDimensionStatus({ dimension: "joy" }),
          buildDimensionStatus({
            dimension: "fulfillment",
            status: "draft",
            hasDraftEntry: true,
            sessionId: "session-fulfillment-draft",
            draftSessionId: "session-fulfillment-draft",
            draftJournalEntryId: "entry-fulfillment-draft",
            actions: ["continue_editing"]
          }),
          buildDimensionStatus({ dimension: "reflection" }),
          buildDimensionStatus({ dimension: "improvement" }),
          buildDimensionStatus({ dimension: "gratitude" })
        ]
      }),
      buildDay("2026-05-06", {
        overallStatus: "in_progress",
        activeCount: 1,
        primarySummary: "这一天还有访谈线索没收住。",
        latestUpdatedAt: "2026-05-06T09:00:00.000Z",
        primaryAction: "continue_interview",
        dimensions: [
          buildDimensionStatus({
            dimension: "reflection",
            status: "in_progress",
            hasActiveSession: true,
            sessionId: "session-reflection-active",
            activeSessionId: "session-reflection-active",
            actions: ["continue_interview"]
          }),
          buildDimensionStatus({ dimension: "joy" }),
          buildDimensionStatus({ dimension: "fulfillment" }),
          buildDimensionStatus({ dimension: "improvement" }),
          buildDimensionStatus({ dimension: "gratitude" })
        ]
      }),
      buildDay("2026-05-07"),
      buildDay("2026-05-08"),
      buildDay("2026-05-09"),
      buildDay("2026-05-10")
    ]
  };
}

function buildFutureWeekRecord(): CalendarWeekRecord {
  return {
    anchorDate: "2099-01-07",
    weekStartDate: "2099-01-05",
    weekEndDate: "2099-01-11",
    days: [
      buildDay("2099-01-05"),
      buildDay("2099-01-06"),
      buildDay("2099-01-07"),
      buildDay("2099-01-08"),
      buildDay("2099-01-09"),
      buildDay("2099-01-10"),
      buildDay("2099-01-11")
    ]
  };
}

function createDeferredResponse() {
  let resolve: (value: Response) => void;

  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve: resolve!
  };
}

describe("calendar week shell", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      view: "week",
      date: "2026-05-07"
    };
  });

  it("normalizes missing date to today while staying in week view", async () => {
    mockSearchParams.value = {
      view: "week",
      date: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildWeekRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarWeekShell />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(`/calendar?view=week&date=${getTodayEntryDate()}`, { scroll: false });
    });
  });

  it("renders seven comparison cards with direct actions and a compact summary block", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildWeekRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarWeekShell />);

    expect(await screen.findByTestId("calendar-week-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-week-primary-pane")).toBeInTheDocument();
    expect(screen.queryByTestId("calendar-week-secondary-pane")).not.toBeInTheDocument();
    expect(screen.getByTestId("calendar-week-summary")).toBeInTheDocument();
    expect(await screen.findByTestId("calendar-week-board")).toBeInTheDocument();
    expect(screen.getAllByTestId(/calendar-week-day-/)).toHaveLength(7);
    expect(screen.queryByText("WEEK SNAPSHOT")).not.toBeInTheDocument();

    expect(screen.getByText("本周有 3 天有记录，触达 3 维。 还有 1 条草稿。")).toBeInTheDocument();
    expect(screen.getByText("先补 1 条草稿。")).toBeInTheDocument();

    const completedCard = screen.getByTestId("calendar-week-day-2026-05-04");
    expect(within(completedCard).getByText("已完成 1 项")).toBeInTheDocument();
    expect(completedCard.querySelector('[data-dimension="joy"]')).not.toBeNull();
    expect(within(completedCard).getByText("悦")).toBeInTheDocument();
    expect(within(completedCard).getByLabelText("开心")).toBeInTheDocument();
    expect(within(completedCard).getByRole("link", { name: /已完成.*项目终于收束.*查看日志/ })).toHaveAttribute(
      "href",
      "/interview?dimension=joy&sessionId=session-joy-completed&entryDate=2026-05-04&panel=journal"
    );
    expect(within(completedCard).getByRole("link", { name: /已完成.*项目终于收束.*查看日志/ })).toHaveAttribute("data-action-tone", "primary");

    const draftCard = screen.getByTestId("calendar-week-day-2026-05-05");
    expect(within(draftCard).getByText("草稿 1 项")).toBeInTheDocument();
    expect(draftCard.querySelector('[data-dimension="fulfillment"]')).not.toBeNull();
    expect(within(draftCard).getByText("实")).toBeInTheDocument();
    expect(within(draftCard).getByRole("link", { name: /草稿.*还有一段没整理完。.*继续编辑/ })).toHaveAttribute(
      "href",
      "/interview?dimension=fulfillment&sessionId=session-fulfillment-draft&entryDate=2026-05-05&panel=journal"
    );

    const activeCard = screen.getByTestId("calendar-week-day-2026-05-06");
    expect(within(activeCard).getByText("思")).toBeInTheDocument();
    expect(within(activeCard).getByRole("link", { name: /进行中.*这一天还有访谈线索没收住。.*继续访谈/ })).toHaveAttribute(
      "href",
      "/interview?dimension=reflection&sessionId=session-reflection-active&entryDate=2026-05-06"
    );

    const emptyCard = screen.getByTestId("calendar-week-day-2026-05-07");
    expect(within(emptyCard).getByRole("link", { name: /未记录.*这一天还空着。.*查看当天/ })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-07"
    );
    expect(within(emptyCard).getByRole("link", { name: /未记录.*这一天还空着。.*查看当天/ })).toHaveAttribute("data-action-tone", "secondary");
  });

  it("moves week navigation responsibility out of the shell body", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildWeekRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarWeekShell />);

    await screen.findByTestId("calendar-week-board");
    expect(screen.queryByRole("button", { name: "上周" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下周" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "回到今天" })).not.toBeInTheDocument();
  });

  it("falls back to day view on future empty days instead of exposing interview actions", async () => {
    mockSearchParams.value = {
      view: "week",
      date: "2099-01-07"
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildFutureWeekRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarWeekShell />);

    const futureCard = await screen.findByTestId("calendar-week-day-2099-01-07");
    expect(within(futureCard).getByRole("link", { name: /未记录.*未来日期先保留。.*查看当天/ })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2099-01-07"
    );
    expect(within(futureCard).queryByRole("link", { name: "开始访谈" })).not.toBeInTheDocument();
    expect(within(futureCard).queryByRole("link", { name: "继续访谈" })).not.toBeInTheDocument();
  });

  it("announces loading and error states accessibly", async () => {
    const deferred = createDeferredResponse();
    global.fetch = vi.fn(() => deferred.promise) as typeof fetch;

    render(<CalendarWeekShell />);

    expect(screen.getByTestId("calendar-week-workspace")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("正在读取本周记录。");

    deferred.resolve(new Response(null, { status: 500 }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("本周记录暂时没打开。");
    });
  });
});
