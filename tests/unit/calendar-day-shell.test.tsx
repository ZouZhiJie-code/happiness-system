import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { CalendarDayShell } from "@/components/calendar/calendar-day-shell";
import type { CalendarDayRecord, CalendarDimensionStatus } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";

const { mockRouterPush, mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      view: "day" as string | null,
      date: "2026-05-01" as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
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
    actions: overrides.actions ?? [],
    hasActiveSession: overrides.hasActiveSession ?? false,
    hasDraftEntry: overrides.hasDraftEntry ?? false,
    hasSavedEntry: overrides.hasSavedEntry ?? false
  };
}

function buildDayRecord(): CalendarDayRecord {
  return {
    date: "2026-05-01",
    overallStatus: "mixed",
    dimensions: [
      buildDimensionStatus({
        dimension: "joy",
        status: "draft",
        title: "还在整理的那段",
        summary: "这一天已经有一版草稿。",
        latestUpdatedAt: "2026-05-01T10:00:00.000Z",
        hasDraftEntry: true,
        sessionId: "session-joy",
        actions: ["continue_editing"]
      }),
      buildDimensionStatus({
        dimension: "fulfillment",
        status: "completed",
        title: "今天没有白过",
        summary: "这条充实记录已经完成。",
        latestUpdatedAt: "2026-05-01T11:00:00.000Z",
        hasSavedEntry: true,
        sessionId: "session-fulfillment",
        actions: ["view_journal", "edit_saved_journal"]
      }),
      buildDimensionStatus({
        dimension: "reflection",
        status: "mixed",
        title: "想法还在发酵",
        summary: "既有进行中的访谈，也有已经保存的内容。",
        latestUpdatedAt: "2026-05-01T12:00:00.000Z",
        hasActiveSession: true,
        hasSavedEntry: true,
        sessionId: "session-reflection",
        actions: ["continue_interview", "view_journal", "edit_saved_journal"]
      }),
      buildDimensionStatus({
        dimension: "improvement",
        status: "in_progress",
        summary: "这一维还在访谈里。",
        latestUpdatedAt: "2026-05-01T09:00:00.000Z",
        hasActiveSession: true,
        sessionId: "session-improvement",
        actions: ["continue_interview"]
      }),
      buildDimensionStatus({
        dimension: "gratitude"
      })
    ],
    activeCount: 2,
    draftCount: 1,
    savedCount: 2,
    primaryTitle: "这一天有两条线最值得继续",
    primarySummary: "先看清五维状态，再决定回到哪一条链路继续。",
    latestUpdatedAt: "2026-05-01T12:00:00.000Z",
    primaryAction: "continue_interview"
  };
}

function buildFutureEmptyDayRecord(): CalendarDayRecord {
  return {
    date: "2099-01-01",
    overallStatus: "empty",
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
}

describe("calendar day shell", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockRouterPush.mockReset();
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      view: "day",
      date: "2026-05-01"
    };
  });

  it("normalizes missing date to today while staying in day view", async () => {
    mockSearchParams.value = {
      view: "day",
      date: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildDayRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarDayShell />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(`/calendar?view=day&date=${getTodayEntryDate()}`, { scroll: false });
    });
  });

  it("renders a dedicated day view with five dimension cards and grouped actions", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildDayRecord()), { status: 200 })) as typeof fetch;

    const { container } = render(<CalendarDayShell />);

    expect(await screen.findByTestId("calendar-day-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "回到本周" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "回到本月" })).toBeInTheDocument();
    expect(screen.queryByTestId("calendar-day-detail")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    const cards = container.querySelectorAll('[data-testid^="calendar-dimension-card-"]');
    expect(cards).toHaveLength(5);
    expect(Array.from(cards).map((card) => card.getAttribute("data-testid"))).toEqual([
      "calendar-dimension-card-joy",
      "calendar-dimension-card-fulfillment",
      "calendar-dimension-card-reflection",
      "calendar-dimension-card-improvement",
      "calendar-dimension-card-gratitude"
    ]);

    expect(screen.getByRole("link", { name: "继续编辑" })).toHaveAttribute(
      "href",
      "/interview?dimension=joy&sessionId=session-joy&panel=journal"
    );

    const completedCard = screen.getByTestId("calendar-dimension-card-fulfillment");
    expect(within(completedCard).getByRole("link", { name: "查看日志" })).toHaveAttribute(
      "href",
      "/interview?dimension=fulfillment&sessionId=session-fulfillment&panel=journal"
    );
    expect(within(completedCard).getByRole("link", { name: "编辑日志" })).toHaveAttribute(
      "href",
      "/interview?dimension=fulfillment&sessionId=session-fulfillment&panel=journal"
    );

    const mixedCard = screen.getByTestId("calendar-dimension-card-reflection");
    const mixedLinks = within(mixedCard).getAllByRole("link");
    expect(mixedLinks.map((link) => link.textContent)).toEqual(["继续访谈", "查看日志", "编辑日志"]);

    const emptyCard = screen.getByTestId("calendar-dimension-card-gratitude");
    expect(within(emptyCard).getByRole("link", { name: "开始访谈" })).toHaveAttribute(
      "href",
      "/interview?dimension=gratitude&entryDate=2026-05-01"
    );
  });

  it("disables start actions on future empty days", async () => {
    mockSearchParams.value = {
      view: "day",
      date: "2099-01-01"
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildFutureEmptyDayRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarDayShell />);

    expect(await screen.findByTestId("calendar-day-view")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "开始访谈" })).not.toBeInTheDocument();
    expect(screen.getAllByText("未来日期暂不支持开始记录")).toHaveLength(5);
  });

  it("keeps day navigation url-driven", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildDayRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarDayShell />);

    await screen.findByTestId("calendar-day-view");

    fireEvent.click(screen.getByRole("button", { name: "后一天" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=day&date=2026-05-02", { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: "回到本周" }));
    expect(mockRouterPush).toHaveBeenCalledWith("/calendar?view=week&date=2026-05-01");

    fireEvent.click(screen.getByRole("button", { name: "回到本月" }));
    expect(mockRouterPush).toHaveBeenCalledWith("/calendar?view=month&date=2026-05-01");
  });
});
