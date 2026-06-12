import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { CalendarRouterShell } from "@/components/calendar/calendar-router-shell";
import { clearAllCalendarRecordCache } from "@/features/calendar/calendar-record-cache";
import type { CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";

const { mockSearchParams } = vi.hoisted(() => ({
  mockSearchParams: {
    value: {
      view: "month" as string | null,
      date: "2026-05-02" as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn()
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "view" | "date"] ?? null
  })
}));

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

describe("calendar router shell", () => {
  beforeEach(() => {
    clearAllCalendarRecordCache();
    mockSearchParams.value = {
      view: "month",
      date: "2026-05-02"
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

    const { rerender } = render(<CalendarRouterShell />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-month-workspace")).toHaveAttribute("aria-busy", "false");
    });

    mockSearchParams.value = {
      view: "week",
      date: "2026-05-02"
    };
    rerender(<CalendarRouterShell />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-week-workspace")).toHaveAttribute("aria-busy", "false");
    });

    mockSearchParams.value = {
      view: "month",
      date: "2026-05-02"
    };
    rerender(<CalendarRouterShell />);

    expect(screen.getByTestId("calendar-month-workspace")).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText("正在读取本月记录。")).not.toBeInTheDocument();
  });
});
