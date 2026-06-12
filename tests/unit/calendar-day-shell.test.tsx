import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { CalendarDayShell } from "@/components/calendar/calendar-day-shell";
import { clearAllCalendarRecordCache } from "@/features/calendar/calendar-record-cache";
import type { CalendarDayRecord, CalendarDimensionStatus } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";

const { mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
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
        draftSessionId: "session-joy-draft",
        draftJournalEntryId: "entry-joy-draft",
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
        savedSessionId: "session-fulfillment-saved",
        savedJournalEntryId: "entry-fulfillment-saved",
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
        activeSessionId: "session-reflection-active",
        savedSessionId: "session-reflection-saved",
        savedJournalEntryId: "entry-reflection-saved",
        actions: ["edit_saved_journal", "view_journal", "continue_interview"]
      }),
      buildDimensionStatus({
        dimension: "improvement",
        status: "in_progress",
        summary: "这一维还在访谈里。",
        latestUpdatedAt: "2026-05-01T09:00:00.000Z",
        hasActiveSession: true,
        sessionId: "session-improvement",
        activeSessionId: "session-improvement-active",
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

function buildTodayEmptyDayRecord(): CalendarDayRecord {
  const today = getTodayEntryDate();

  return {
    date: today,
    overallStatus: "empty",
    dimensions: [
      buildDimensionStatus({ dimension: "joy", actions: ["start_interview"] }),
      buildDimensionStatus({ dimension: "fulfillment", actions: ["start_interview"] }),
      buildDimensionStatus({ dimension: "reflection", actions: ["start_interview"] }),
      buildDimensionStatus({ dimension: "improvement", actions: ["start_interview"] }),
      buildDimensionStatus({ dimension: "gratitude", actions: ["start_interview"] })
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

function buildPastEmptyDayRecord(date = "2026-05-01"): CalendarDayRecord {
  return {
    date,
    overallStatus: "empty",
    dimensions: [
      buildDimensionStatus({ dimension: "joy", actions: ["start_interview"] }),
      buildDimensionStatus({ dimension: "fulfillment", actions: ["start_interview"] }),
      buildDimensionStatus({ dimension: "reflection", actions: ["start_interview"] }),
      buildDimensionStatus({ dimension: "improvement", actions: ["start_interview"] }),
      buildDimensionStatus({ dimension: "gratitude", actions: ["start_interview"] })
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

describe("calendar day shell", () => {
  beforeEach(() => {
    vi.useRealTimers();
    clearAllCalendarRecordCache();
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

  it("renders a compact day workspace with stable primary actions", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildDayRecord()), { status: 200 })) as typeof fetch;

    const { container } = render(<CalendarDayShell />);

    expect(await screen.findByTestId("calendar-day-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-day-primary-pane")).toBeInTheDocument();
    expect(await screen.findByTestId("calendar-day-view")).toBeInTheDocument();
    expect(screen.queryByText("DAY OVERVIEW")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "回到本周" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "回到本月" })).not.toBeInTheDocument();
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

    expect(screen.getAllByText("进行中").length).toBeGreaterThan(0);
    expect(screen.getAllByText("草稿").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已完成").length).toBeGreaterThan(0);

    const joyCard = screen.getByTestId("calendar-dimension-card-joy");
    expect(joyCard).toHaveAttribute("data-dimension", "joy");
    expect(within(joyCard).getByText("悦")).toBeInTheDocument();
    expect(within(joyCard).getByRole("link", { name: "开心，草稿，还在整理的那段，继续编辑" })).toHaveAttribute(
      "href",
      "/interview?dimension=joy&sessionId=session-joy-draft&entryDate=2026-05-01&panel=journal"
    );
    expect(within(joyCard).getByRole("link", { name: "开心，草稿，还在整理的那段，继续编辑" })).toHaveAttribute("data-action-tone", "primary");

    const completedCard = screen.getByTestId("calendar-dimension-card-fulfillment");
    expect(completedCard).toHaveAttribute("data-dimension", "fulfillment");
    expect(within(completedCard).getByText("实")).toBeInTheDocument();
    expect(within(completedCard).getByRole("link", { name: "充实，已完成，今天没有白过，查看日志" })).toHaveAttribute(
      "href",
      "/interview?dimension=fulfillment&sessionId=session-fulfillment-saved&entryDate=2026-05-01&panel=journal"
    );
    fireEvent.click(within(completedCard).getByRole("button", { name: "充实，已完成，今天没有白过，更多操作" }));
    expect(within(completedCard).getByRole("link", { name: "充实，已完成，今天没有白过，编辑日志" })).toHaveAttribute(
      "href",
      "/interview?dimension=fulfillment&sessionId=session-fulfillment-saved&entryDate=2026-05-01&panel=journal"
    );

    const mixedCard = screen.getByTestId("calendar-dimension-card-reflection");
    expect(within(mixedCard).getByText("思")).toBeInTheDocument();
    expect(within(mixedCard).getByRole("link", { name: "思考，混合状态，想法还在发酵，继续访谈" })).toHaveAttribute(
      "href",
      "/interview?dimension=reflection&sessionId=session-reflection-active&entryDate=2026-05-01"
    );
    expect(within(mixedCard).queryByRole("link", { name: "思考，混合状态，想法还在发酵，查看日志" })).not.toBeInTheDocument();
    expect(within(mixedCard).getByRole("button", { name: "思考，混合状态，想法还在发酵，更多操作" })).toBeInTheDocument();
    fireEvent.click(within(mixedCard).getByRole("button", { name: "思考，混合状态，想法还在发酵，更多操作" }));
    const mixedLinks = within(mixedCard).getAllByRole("link");
    expect(mixedLinks.map((link) => link.textContent)).toEqual(["继续访谈", "查看日志", "编辑日志"]);
    expect(mixedLinks[1]).toHaveAttribute(
      "href",
      "/interview?dimension=reflection&sessionId=session-reflection-saved&entryDate=2026-05-01&panel=journal"
    );

    const emptyCard = screen.getByTestId("calendar-dimension-card-gratitude");
    expect(emptyCard).toHaveAttribute("data-dimension", "gratitude");
    expect(within(emptyCard).getByText("谢")).toBeInTheDocument();
    expect(within(emptyCard).getByRole("link", { name: "感谢，未记录，开始记录" })).toHaveAttribute(
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
    expect(screen.queryByRole("link", { name: "开始记录" })).not.toBeInTheDocument();
    expect(screen.getAllByText("未来日期暂不支持开始记录")).toHaveLength(5);
    expect(screen.getAllByText("未来日期暂不支持开始记录").every((node) => node.getAttribute("data-action-tone")?.startsWith("disabled"))).toBe(true);
    expect(screen.getAllByText("未来日期暂不支持开始记录")[0]).toHaveAttribute("aria-label", "开心，未记录，未来日期暂不支持开始记录");
  });

  it("opens an existing daily summary from day view without generating it", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ...buildDayRecord(),
          dailyJournal: {
            state: "saved",
            id: "daily-journal-1",
            title: "五月一日汇总",
            updatedAt: "2026-05-01T13:00:00.000Z",
            savedAt: "2026-05-01T13:00:00.000Z",
            sourceEntryCount: 2
          }
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    render(<CalendarDayShell />);

    expect(await screen.findByRole("link", { name: /查看当日汇总日志/ })).toHaveAttribute(
      "href",
      "/interview?dimension=joy&entryDate=2026-05-01&mode=daily-journal"
    );
    expect(screen.queryByText("生成当天日志")).not.toBeInTheDocument();
  });

  it("prompts to summarize real saved dimensions when no daily summary exists", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildDayRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarDayShell />);

    fireEvent.click(await screen.findByRole("button", { name: /查看当日汇总日志/ }));

    const dialog = screen.getByRole("dialog", { name: "还没有汇总的日志" });
    expect(within(dialog).getByText("当日已有 充实、思考 维度的日志。")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "汇总日志" })).toHaveAttribute(
      "href",
      "/interview?dimension=joy&entryDate=2026-05-01&mode=daily-journal"
    );
    expect(within(dialog).getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  it("traps focus in the daily journal prompt and restores focus on close", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildDayRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarDayShell />);

    const trigger = await screen.findByRole("button", { name: /查看当日汇总日志/ });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "还没有汇总的日志" });
    const cancelButton = within(dialog).getByRole("button", { name: "取消" });
    const summarizeLink = within(dialog).getByRole("link", { name: "汇总日志" });

    expect(dialog).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(summarizeLink).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "还没有汇总的日志" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("prompts today's empty day with write journal and cancel actions", async () => {
    const today = getTodayEntryDate();
    mockSearchParams.value = {
      view: "day",
      date: today
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildTodayEmptyDayRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarDayShell />);

    fireEvent.click(await screen.findByRole("button", { name: /查看今日汇总日志/ }));

    const dialog = screen.getByRole("dialog", { name: "今天还没有日志" });
    expect(within(dialog).getByText("可以先从一个维度写起，保存后再回到这里查看汇总。")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "写日志" })).toHaveAttribute("href", `/interview?dimension=joy&entryDate=${today}`);
    expect(within(dialog).getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  it("keeps selected entryDate when writing from non-today empty day", async () => {
    mockSearchParams.value = {
      view: "day",
      date: "2026-05-01"
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildPastEmptyDayRecord("2026-05-01")), { status: 200 })) as typeof fetch;

    render(<CalendarDayShell />);

    fireEvent.click(await screen.findByRole("button", { name: /查看当日汇总日志/ }));

    const dialog = screen.getByRole("dialog", { name: "这天还没有日志" });
    expect(within(dialog).getByRole("link", { name: "写日志" })).toHaveAttribute(
      "href",
      "/interview?dimension=joy&entryDate=2026-05-01"
    );
  });

  it("does not allow writing logs from a future empty day through the daily summary prompt", async () => {
    mockSearchParams.value = {
      view: "day",
      date: "2099-01-01"
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildFutureEmptyDayRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarDayShell />);

    fireEvent.click(await screen.findByRole("button", { name: /查看当日汇总日志/ }));

    const dialog = screen.getByRole("dialog", { name: "这天还没有日志" });
    expect(within(dialog).getByText("可以先从一个维度写起，保存后再回到这里查看汇总。")).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "写日志" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("写日志")).toHaveAttribute("aria-disabled", "true");
  });

  it("moves day navigation responsibility out of the shell body", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildDayRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarDayShell />);

    await screen.findByTestId("calendar-day-view");
    expect(screen.queryByRole("button", { name: "前一天" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "后一天" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "回到今天" })).not.toBeInTheDocument();
  });

  it("announces loading and error states accessibly", async () => {
    const deferred = createDeferredResponse();
    global.fetch = vi.fn(() => deferred.promise) as typeof fetch;

    render(<CalendarDayShell />);

    expect(screen.getByTestId("calendar-day-workspace")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("正在读取当天记录。");

    deferred.resolve(new Response(null, { status: 500 }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("当天记录暂时没打开。");
    });
  });
});
