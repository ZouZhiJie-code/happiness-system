import React from "react";
import { render, screen } from "@testing-library/react";

import {
  JournalMonthWorkspace,
  JournalWeekWorkspace
} from "@/components/journal/journal-calendar-workspace";
import { clearEventCalendarRecordCache } from "@/features/event-calendar/calendar-client";
import type { EventCalendarDayRecord } from "@/types/event-calendar";

const { mockRouterReplace } = vi.hoisted(() => ({ mockRouterReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace })
}));

const day: EventCalendarDayRecord = {
  date: "2026-05-02",
  overallStatus: "completed",
  events: [
    {
      eventId: "event-1",
      rootSessionId: "session-1",
      activeBranchSessionId: "session-1",
      entryDate: "2026-05-02",
      daySequence: 1,
      eventStatus: "completed",
      entryId: "entry-1",
      entryStatus: "saved",
      state: "saved",
      title: "把演示稳稳讲完",
      summary: "演示顺利落地，也看见了准备带来的底气。",
      latestUpdatedAt: "2026-05-02T03:00:00.000Z",
      actions: ["view_event_entry"]
    }
  ],
  dailyJournal: {
    collection: "single_entry",
    freshness: "stale",
    entryId: "daily-1",
    title: "今天稳稳地向前走",
    sourceEntryCount: 1,
    pendingSaveEntryIds: [],
    pendingSave: false,
    updateBlockedByPendingSave: false,
    directEntryId: "entry-1",
    actions: ["update_daily_journal"]
  },
  activeEventCount: 0,
  generatingEventCount: 0,
  pendingSaveEntryCount: 0,
  savedEntryCount: 1,
  primaryAction: "view_event_entry",
  latestUpdatedAt: "2026-05-02T03:00:00.000Z"
};

describe("journal month and week workspaces", () => {
  beforeEach(() => {
    clearEventCalendarRecordCache();
    mockRouterReplace.mockReset();
  });

  it("uses record and daily-journal semantics in month view", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ month: "2026-05", days: [day] }), { status: 200 })) as typeof fetch;
    render(<JournalMonthWorkspace anchorDate="2026-05-02" />);
    expect(await screen.findByText("今天稳稳地向前走")).toBeInTheDocument();
    expect(screen.getByTestId("journal-month-workspace")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText("把演示稳稳讲完")).toBeInTheDocument();
    expect(screen.getAllByText("需更新").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "查看当天" })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-02"
    );
    expect(screen.queryByText(/事件记录|历史五维|待保存/)).not.toBeInTheDocument();
  });

  it("summarizes recorded days, record count and diary states in week view", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      anchorDate: "2026-05-02",
      weekStartDate: "2026-04-27",
      weekEndDate: "2026-05-03",
      days: [day]
    }), { status: 200 })) as typeof fetch;
    render(<JournalWeekWorkspace anchorDate="2026-05-02" />);
    expect(await screen.findByText("本周记录")).toBeInTheDocument();
    expect(screen.getByText("1 天 · 1 条")).toBeInTheDocument();
    expect(screen.getByText("今日日记：已保存 0 天 · 需更新 1 天 · 草稿 0 天")).toBeInTheDocument();
    expect(screen.getByText("把演示稳稳讲完")).toBeInTheDocument();
    expect(screen.queryByText(/事件|历史五维|待保存/)).not.toBeInTheDocument();
  });
});
