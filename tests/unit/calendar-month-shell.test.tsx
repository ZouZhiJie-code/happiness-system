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

  it("renders a full 42-slot grid and exposes five start links for an empty past day", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    const { container } = render(<CalendarMonthShell />);

    await screen.findByTestId("calendar-month-workspace");
    expect(screen.getByTestId("calendar-month-primary-pane")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-month-secondary-pane")).toBeInTheDocument();
    const detailPanels = await screen.findAllByTestId("calendar-day-detail");

    expect(container.querySelectorAll('[data-testid^="calendar-day-2026-"], [data-testid^="calendar-placeholder-"]')).toHaveLength(42);
    const startLinks = within(detailPanels[0] as HTMLElement).getAllByRole("link", { name: /开始访谈/ });
    expect(startLinks).toHaveLength(5);
    expect(startLinks[0]?.getAttribute("href")).toContain("entryDate=2026-05-02");
    expect(within(detailPanels[0] as HTMLElement).getByRole("link", { name: "查看当天" })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-02"
    );
  });

  it("updates the url when selecting another day", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarMonthShell />);

    await screen.findAllByTestId("calendar-day-detail");
    fireEvent.click(screen.getByTestId("calendar-day-2026-05-03"));

    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=month&date=2026-05-03", { scroll: false });
  });

  it("shows real mixed split details for a day with active, draft and saved dimensions", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMixedMonthRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarMonthShell />);

    const detailPanels = await screen.findAllByTestId("calendar-day-detail");
    const detailPanel = detailPanels[0] as HTMLElement;

    expect(within(detailPanel).getByText("混合状态")).toBeInTheDocument();
    expect(within(detailPanel).getByRole("link", { name: "查看当天" })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-02"
    );
    expect(within(detailPanel).getByRole("link", { name: "开心 · 继续访谈" })).toHaveAttribute(
      "href",
      "/interview?dimension=joy&sessionId=session-joy&entryDate=2026-05-02"
    );
    expect(within(detailPanel).getByRole("link", { name: "充实 · 继续编辑" })).toHaveAttribute(
      "href",
      "/interview?dimension=fulfillment&sessionId=session-fulfillment&panel=journal"
    );
    expect(within(detailPanel).getByRole("link", { name: "思考 · 查看日志" })).toHaveAttribute(
      "href",
      "/interview?dimension=reflection&sessionId=session-reflection&panel=journal"
    );
    expect(within(detailPanel).getByRole("link", { name: "思考 · 编辑日志" })).toHaveAttribute(
      "href",
      "/interview?dimension=reflection&sessionId=session-reflection&panel=journal"
    );
  });
});
