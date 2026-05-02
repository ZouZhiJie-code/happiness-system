import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { CalendarMonthShell } from "@/components/calendar/calendar-month-shell";
import type { CalendarMonthRecord } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";

const { mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      view: "month" as string | null,
      date: "2026-05-02" as string | null
    }
  }
}));

function buildDimensionStatus(
  overrides: Partial<CalendarMonthRecord["days"][number]["dimensions"][number]> & {
    dimension: CalendarMonthRecord["days"][number]["dimensions"][number]["dimension"];
  }
) {
  return {
    dimension: overrides.dimension,
    status: overrides.status ?? "empty",
    title: overrides.title ?? null,
    summary: overrides.summary ?? null,
    latestUpdatedAt: overrides.latestUpdatedAt ?? null,
    sessionId: overrides.sessionId ?? null,
    journalEntryId: overrides.journalEntryId ?? null,
    actions: overrides.actions ?? [],
    hasActiveSession: overrides.hasActiveSession ?? false,
    hasDraftEntry: overrides.hasDraftEntry ?? false,
    hasSavedEntry: overrides.hasSavedEntry ?? false
  };
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "view" | "date"] ?? null
  })
}));

function buildMonthRecord(): CalendarMonthRecord {
  return {
    month: "2026-05",
    days: Array.from({ length: 31 }, (_, index) => {
      const date = `2026-05-${String(index + 1).padStart(2, "0")}`;

      return {
        date,
        overallStatus: "empty" as const,
        dimensions: [
          {
            dimension: "joy" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          },
          {
            dimension: "fulfillment" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          },
          {
            dimension: "reflection" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          },
          {
            dimension: "improvement" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          },
          {
            dimension: "gratitude" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          }
        ],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      };
    })
  };
}

function buildMixedMonthRecord(): CalendarMonthRecord {
  const base = buildMonthRecord();
  const mixedDay = base.days.find((day) => day.date === "2026-05-02");

  if (!mixedDay) {
    return base;
  }

  mixedDay.overallStatus = "mixed";
  mixedDay.activeCount = 1;
  mixedDay.draftCount = 1;
  mixedDay.savedCount = 1;
  mixedDay.primaryTitle = "这一天需要继续分流";
  mixedDay.primarySummary = "同一天里既有进行中的访谈，也有草稿和已完成日志。";
  mixedDay.latestUpdatedAt = "2026-05-02T12:00:00.000Z";
  mixedDay.primaryAction = "continue_interview";
  mixedDay.dimensions = [
    buildDimensionStatus({
      dimension: "joy",
      status: "in_progress",
      summary: "开心线索还在追问里。",
      latestUpdatedAt: "2026-05-02T10:00:00.000Z",
      sessionId: "session-joy",
      actions: ["continue_interview"],
      hasActiveSession: true
    }),
    buildDimensionStatus({
      dimension: "fulfillment",
      status: "draft",
      title: "今天不算白过",
      summary: "这条充实记录已经有草稿。",
      latestUpdatedAt: "2026-05-02T11:00:00.000Z",
      sessionId: "session-fulfillment",
      journalEntryId: "entry-draft",
      actions: ["continue_editing"],
      hasDraftEntry: true
    }),
    buildDimensionStatus({
      dimension: "reflection",
      status: "completed",
      title: "判断更清楚了",
      summary: "这一维已经正式保存。",
      latestUpdatedAt: "2026-05-02T12:00:00.000Z",
      sessionId: "session-reflection",
      journalEntryId: "entry-saved",
      actions: ["view_journal", "edit_saved_journal"],
      hasSavedEntry: true
    }),
    buildDimensionStatus({ dimension: "improvement" }),
    buildDimensionStatus({ dimension: "gratitude" })
  ];

  return base;
}

function buildFutureEmptyMonthRecord(): CalendarMonthRecord {
  return {
    month: "2099-01",
    days: Array.from({ length: 31 }, (_, index) => {
      const date = `2099-01-${String(index + 1).padStart(2, "0")}`;

      return {
        date,
        overallStatus: "empty" as const,
        dimensions: [
          buildDimensionStatus({ dimension: "joy" }),
          buildDimensionStatus({ dimension: "fulfillment" }),
          buildDimensionStatus({ dimension: "reflection" }),
          buildDimensionStatus({ dimension: "improvement" }),
          buildDimensionStatus({ dimension: "gratitude" })
        ],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      };
    })
  };
}

describe("calendar month shell", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      view: "month",
      date: "2026-05-02"
    };
  });

  it("normalizes missing search params to today", async () => {
    mockSearchParams.value = {
      view: null,
      date: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarMonthShell />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(`/calendar?view=month&date=${getTodayEntryDate()}`, { scroll: false });
    });
  });

  it("renders a full 42-slot grid and a dedicated day check panel for an empty past day", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    const { container } = render(<CalendarMonthShell />);

    await screen.findByTestId("calendar-month-workspace");
    expect(screen.getByTestId("calendar-month-primary-pane")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-month-secondary-pane")).toBeInTheDocument();
    const dayPanel = await screen.findByTestId("calendar-month-day-panel");

    expect(container.querySelectorAll('[data-testid^="calendar-day-2026-"], [data-testid^="calendar-placeholder-"]')).toHaveLength(42);
    expect(screen.queryByTestId("calendar-day-detail")).not.toBeInTheDocument();
    expect(within(dayPanel).getByText("这一天还没有形成标题。")).toBeInTheDocument();
    expect(within(dayPanel).getByText("还没有记录内容，可以先进入当天查看五个维度。")).toBeInTheDocument();
    expect(within(dayPanel).queryByRole("link", { name: /开始访谈/ })).not.toBeInTheDocument();
    expect(within(dayPanel).getByRole("link", { name: "查看当天" })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-02"
    );
  });

  it("updates the url and panel immediately when selecting another day without refetching the month", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;
    global.fetch = fetchMock;

    render(<CalendarMonthShell />);

    const dayPanel = await screen.findByTestId("calendar-month-day-panel");
    fireEvent.click(screen.getByTestId("calendar-day-2026-05-03"));

    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=month&date=2026-05-03", { scroll: false });
    expect(within(dayPanel).getByRole("heading", { name: /5月3日/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows mixed day summary chips, touched dimensions and the single day-view entry", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMixedMonthRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarMonthShell />);

    const detailPanel = await screen.findByTestId("calendar-month-day-panel");

    expect(within(detailPanel).getByText("混合状态")).toBeInTheDocument();
    expect(within(detailPanel).getByText("这一天需要继续分流")).toBeInTheDocument();
    expect(within(detailPanel).getByText("同一天里既有进行中的访谈，也有草稿和已完成日志。")).toBeInTheDocument();
    expect(within(detailPanel).getAllByText("1项")).toHaveLength(3);
    expect(within(detailPanel).getByText("开心")).toBeInTheDocument();
    expect(within(detailPanel).getByText("充实")).toBeInTheDocument();
    expect(within(detailPanel).getByText("思考")).toBeInTheDocument();
    expect(within(detailPanel).getByRole("link", { name: "查看当天" })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-02"
    );
    expect(within(detailPanel).queryByRole("link", { name: /继续访谈|继续编辑|查看日志|编辑日志/ })).not.toBeInTheDocument();
  });

  it("shows future empty messaging while keeping day-view access", async () => {
    mockSearchParams.value = {
      view: "month",
      date: "2099-01-01"
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildFutureEmptyMonthRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarMonthShell />);

    const detailPanel = await screen.findByTestId("calendar-month-day-panel");

    expect(within(detailPanel).getByText("未来日期暂不支持开始记录，但可以先查看当天页。")).toBeInTheDocument();
    expect(within(detailPanel).getByTestId("calendar-month-day-panel-empty")).toHaveTextContent("这一天还没有进入记录阶段。先保留这格，之后再回来。");
    expect(within(detailPanel).getByRole("link", { name: "查看当天" })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2099-01-01"
    );
  });
});
