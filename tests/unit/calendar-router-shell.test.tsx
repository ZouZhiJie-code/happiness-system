import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

import { CalendarRouterShell } from "@/components/calendar/calendar-router-shell";
import { CalendarChromeProvider, useCalendarChrome } from "@/components/calendar/calendar-chrome-context";
import { clearAllCalendarRecordCache } from "@/features/calendar/calendar-record-cache";
import type { CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";
import type { EventCalendarMonthRecord } from "@/types/event-calendar";

const { mockSearchParams } = vi.hoisted(() => ({
  mockSearchParams: {
    value: {
      view: "month" as string | null,
      date: "2026-05-02" as string | null,
      calendarMode: null as string | null,
      readTarget: null as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
  useRouter: () => ({
    replace: vi.fn()
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "view" | "date" | "calendarMode" | "readTarget"] ?? null
  })
}));

function CalendarRouterShellHarness() {
  return (
    <CalendarChromeProvider>
      <CalendarRouterShell />
    </CalendarChromeProvider>
  );
}

function OptimisticWeekTrigger() {
  const { beginCalendarViewChange } = useCalendarChrome();

  return (
    <button type="button" onClick={() => beginCalendarViewChange("week")}>
      optimistic-week
    </button>
  );
}

function buildMonthRecord(): CalendarMonthRecord {
  return {
    month: "2026-05",
    days: [
      {
        date: "2026-05-02",
        overallStatus: "draft",
        dimensions: [],
        activeCount: 0,
        draftCount: 1,
        savedCount: 0,
        primaryTitle: "还有一版草稿",
        primarySummary: null,
        latestUpdatedAt: "2026-05-02T10:00:00.000Z",
        primaryAction: "continue_editing"
      }
    ]
  };
}

function buildWeekRecord(): CalendarWeekRecord {
  return {
    anchorDate: "2026-05-02",
    weekStartDate: "2026-04-28",
    weekEndDate: "2026-05-04",
    days: [
      {
        date: "2026-05-02",
        overallStatus: "draft",
        dimensions: [],
        activeCount: 0,
        draftCount: 1,
        savedCount: 0,
        primaryTitle: "还有一版草稿",
        primarySummary: null,
        latestUpdatedAt: "2026-05-02T10:00:00.000Z",
        primaryAction: "continue_editing"
      }
    ]
  };
}

function buildEventMonthRecord(): EventCalendarMonthRecord {
  return {
    month: "2026-05",
    days: [
      {
        date: "2026-05-02",
        overallStatus: "completed",
        events: [
          {
            eventId: "event-1",
            rootSessionId: "event-root-1",
            activeBranchSessionId: "event-root-1",
            entryDate: "2026-05-02",
            daySequence: 1,
            eventStatus: "completed",
            entryId: "event-entry-1",
            entryStatus: "saved",
            state: "saved",
            title: "把今天的事收住",
            summary: "事件日志摘要",
            latestUpdatedAt: "2026-05-02T10:00:00.000Z",
            actions: ["view_event_entry"]
          }
        ],
        dailyJournal: {
          collection: "single_entry",
          freshness: "none",
          entryId: null,
          title: null,
          sourceEntryCount: 1,
          pendingSaveEntryIds: [],
          pendingSave: false,
          updateBlockedByPendingSave: false,
          directEntryId: "event-entry-1",
          actions: ["view_event_entry"]
        },
        activeEventCount: 0,
        generatingEventCount: 0,
        pendingSaveEntryCount: 0,
        savedEntryCount: 1,
        primaryAction: "view_event_entry",
        latestUpdatedAt: "2026-05-02T10:00:00.000Z"
      }
    ]
  };
}

describe("calendar router shell", () => {
  beforeEach(() => {
    clearAllCalendarRecordCache();
    mockSearchParams.value = {
      view: "month",
      date: "2026-05-02",
      calendarMode: null,
      readTarget: null
    };
  });

  it("restores month view instantly when returning from week view", async () => {
    global.fetch = vi.fn(async (input) => {
      const url = String(input);

      if (url.includes("/api/calendar/month")) {
        return new Response(JSON.stringify(buildMonthRecord()), { status: 200 });
      }

      if (url.includes("/api/calendar/week")) {
        return new Response(JSON.stringify(buildWeekRecord()), { status: 200 });
      }

      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const view = { ...mockSearchParams.value };
    mockSearchParams.value = view;

    const { rerender } = render(<CalendarRouterShellHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-month-workspace")).toHaveAttribute("aria-busy", "false");
    });

    mockSearchParams.value = {
      view: "week",
      date: "2026-05-02",
      calendarMode: null,
      readTarget: null
    };
    rerender(<CalendarRouterShellHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-week-workspace")).toHaveAttribute("aria-busy", "false");
    });

    mockSearchParams.value = {
      view: "month",
      date: "2026-05-02",
      calendarMode: null,
      readTarget: null
    };
    rerender(<CalendarRouterShellHarness />);

    expect(screen.getByTestId("calendar-month-workspace")).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText("正在读取本月记录。")).not.toBeInTheDocument();
  });

  it("renders week shell from optimistic view before the url updates", async () => {
    global.fetch = vi.fn(async (input) => {
      const url = String(input);

      if (url.includes("/api/calendar/week")) {
        return new Response(JSON.stringify(buildWeekRecord()), { status: 200 });
      }

      if (url.includes("/api/calendar/month")) {
        return new Response(JSON.stringify(buildMonthRecord()), { status: 200 });
      }

      return new Response(null, { status: 404 });
    }) as typeof fetch;

    render(
      <CalendarChromeProvider>
        <OptimisticWeekTrigger />
        <CalendarRouterShell />
      </CalendarChromeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("calendar-month-workspace")).toBeInTheDocument();
    });

    act(() => {
      screen.getByRole("button", { name: "optimistic-week" }).click();
    });

    expect(screen.getByTestId("calendar-week-workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("calendar-month-workspace")).not.toBeInTheDocument();
  });

  it("reads the event model for month view when the explicit calendar mode is selected", async () => {
    mockSearchParams.value = {
      view: "month",
      date: "2026-05-02",
      calendarMode: "event_centered",
      readTarget: null
    };
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/api/event-calendar/month")) {
        return new Response(JSON.stringify(buildEventMonthRecord()), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    render(<CalendarRouterShellHarness />);

    const workspace = await screen.findByTestId("event-calendar-month-workspace");
    await waitFor(
      () => expect(workspace).toHaveAttribute("aria-busy", "false"),
      { timeout: 5_000 }
    );
    expect(screen.getAllByText("把今天的事收住")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /把今天的事收住/ })).toHaveAttribute(
      "href",
      "/interview?mode=event-centered&sessionId=event-root-1&entryDate=2026-05-02&panel=journal&eventEntryId=event-entry-1"
    );
  });

  it("keeps dual historical dates as two explicit reading entries", async () => {
    mockSearchParams.value = {
      view: "day",
      date: "2026-05-02",
      calendarMode: null,
      readTarget: null
    };
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/api/calendar/read-route")) {
        return new Response(JSON.stringify({ date: "2026-05-02", route: "dual" }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    render(<CalendarRouterShellHarness />);

    const dualWorkspace = await screen.findByTestId("calendar-dual-day-workspace");
    expect(dualWorkspace).toHaveTextContent("这一天有两类记录");
    expect(screen.getByRole("link", { name: /按事件顺序查看/ })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-02&calendarMode=event_centered&readTarget=event_centered"
    );
    expect(screen.getByRole("link", { name: /沿用原有阅读方式/ })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-02&calendarMode=legacy&readTarget=legacy"
    );
  });
});
