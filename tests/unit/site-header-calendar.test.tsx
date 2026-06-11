import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { SiteHeader } from "@/components/shared/site-header";
import type { CalendarDayRecord, CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";

const CURRENT_MONTH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit"
}).format(new Date());

const { mockPathname, mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: {
    value: "/calendar"
  },
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      dimension: null as string | null,
      view: "month" as string | null,
      date: "2026-05-02" as string | null,
      month: null as string | null
    }
  }
}));

const resizeObserverState = vi.hoisted(() => ({
  callback: null as ResizeObserverCallback | null,
  observe: vi.fn(),
  disconnect: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "dimension" | "view" | "date" | "month"] ?? null
  })
}));

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverState.callback = callback;
  }

  observe = resizeObserverState.observe;

  disconnect = resizeObserverState.disconnect;
}

function buildMonthRecord(): CalendarMonthRecord {
  return {
    month: "2026-05",
    days: [
      {
        date: "2026-05-01",
        overallStatus: "completed",
        dimensions: [],
        activeCount: 0,
        draftCount: 0,
        savedCount: 1,
        primaryTitle: "完成了一篇日志",
        primarySummary: null,
        latestUpdatedAt: "2026-05-01T10:00:00.000Z",
        primaryAction: "view_journal"
      },
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
      },
      {
        date: "2026-05-03",
        overallStatus: "in_progress",
        dimensions: [],
        activeCount: 1,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: "还在聊",
        primarySummary: null,
        latestUpdatedAt: "2026-05-03T10:00:00.000Z",
        primaryAction: "continue_interview"
      }
    ]
  };
}

function buildWeekRecord(): CalendarWeekRecord {
  return {
    anchorDate: "2026-05-07",
    weekStartDate: "2026-05-04",
    weekEndDate: "2026-05-10",
    days: [
      {
        date: "2026-05-04",
        overallStatus: "completed",
        dimensions: [],
        activeCount: 0,
        draftCount: 0,
        savedCount: 1,
        primaryTitle: "完成",
        primarySummary: null,
        latestUpdatedAt: "2026-05-04T10:00:00.000Z",
        primaryAction: "view_journal"
      },
      {
        date: "2026-05-05",
        overallStatus: "draft",
        dimensions: [],
        activeCount: 0,
        draftCount: 1,
        savedCount: 0,
        primaryTitle: "草稿",
        primarySummary: null,
        latestUpdatedAt: "2026-05-05T10:00:00.000Z",
        primaryAction: "continue_editing"
      },
      {
        date: "2026-05-06",
        overallStatus: "empty",
        dimensions: [],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      },
      {
        date: "2026-05-07",
        overallStatus: "empty",
        dimensions: [],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      },
      {
        date: "2026-05-08",
        overallStatus: "empty",
        dimensions: [],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      },
      {
        date: "2026-05-09",
        overallStatus: "empty",
        dimensions: [],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      },
      {
        date: "2026-05-10",
        overallStatus: "empty",
        dimensions: [],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      }
    ]
  };
}

function buildDayRecord(): CalendarDayRecord {
  return {
    date: "2026-05-01",
    overallStatus: "mixed",
    dimensions: [],
    activeCount: 2,
    draftCount: 1,
    savedCount: 2,
    primaryTitle: "今天有两条线值得继续",
    primarySummary: null,
    latestUpdatedAt: "2026-05-01T12:00:00.000Z",
    primaryAction: "continue_interview"
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

describe("site header calendar toolbar", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    resizeObserverState.callback = null;
    resizeObserverState.observe.mockReset();
    resizeObserverState.disconnect.mockReset();
    document.documentElement.style.removeProperty("--site-header-viewport-offset");
    mockPathname.value = "/calendar";
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      dimension: null,
      view: "month",
      date: "2026-05-02",
      month: null
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty("--site-header-viewport-offset");
  });

  it("renders month toolbar state and real summary chips", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("aria-busy", "false");
    });

    expect(within(toolbar).getByText("2026年5月")).toBeInTheDocument();
    expect(within(toolbar).getByText("3天")).toBeInTheDocument();
    expect(within(toolbar).getByText("2天")).toBeInTheDocument();
    expect(within(toolbar).getByText("0维")).toBeInTheDocument();
    expect(toolbar).toHaveAttribute("aria-busy", "false");
  });

  it("keeps calendar header sticky frosted without spacer", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<SiteHeader />);
    const header = screen.getByRole("banner");

    expect(header).toHaveClass("sticky", "top-0", "backdrop-blur-md", "site-header-frosted");
    expect(header.className).not.toContain("fixed");
    expect(header.previousElementSibling).toBeNull();
  });

  it("uses sticky frosted header without spacer on interview page", async () => {
    mockPathname.value = "/interview";
    mockSearchParams.value = {
      dimension: "joy",
      view: null,
      date: null,
      month: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<SiteHeader />);
    const header = screen.getByRole("banner");

    expect(header).toHaveClass("sticky", "top-0", "backdrop-blur-md", "site-header-frosted", "isolate");
    expect(header.className).not.toContain("fixed");
    expect(header.previousElementSibling).toBeNull();
  });

  it("syncs the viewport offset css variable to the measured header height", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<SiteHeader />);

    const header = screen.getByRole("banner");
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 118,
      right: 1200,
      width: 1200,
      height: 118,
      toJSON: () => ({})
    });

    resizeObserverState.callback?.([], {} as ResizeObserver);

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--site-header-viewport-offset")).toBe("118px");
    });

    expect(resizeObserverState.observe).toHaveBeenCalledWith(header);
  });

  it("switches the active view and keeps the current date", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");
    fireEvent.click(within(toolbar).getByRole("button", { name: "切换到周视图" }));

    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=week&date=2026-05-02", { scroll: false });
  });

  it("uses week data and navigation labels for week view", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: "week",
      date: "2026-05-07",
      month: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildWeekRecord()), { status: 200 })) as typeof fetch;

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("aria-busy", "false");
    });
    expect(within(toolbar).getByText("5月4日 - 10日")).toBeInTheDocument();
    expect(within(toolbar).getByText("2天")).toBeInTheDocument();
    expect(within(toolbar).getAllByText("1条")).toHaveLength(2);

    fireEvent.click(within(toolbar).getByRole("button", { name: "下一周" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=week&date=2026-05-14", { scroll: false });
  });

  it("uses day counts and keeps the current view when returning to today", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: "day",
      date: "2026-05-01",
      month: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildDayRecord()), { status: 200 })) as typeof fetch;

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("aria-busy", "false");
    });
    expect(within(toolbar).getByText(/5月1日.*周/)).toBeInTheDocument();
    expect(within(toolbar).getAllByText("2项")).toHaveLength(2);
    expect(within(toolbar).getByText("1项")).toBeInTheDocument();

    fireEvent.click(within(toolbar).getByRole("button", { name: "回到今天" }));

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(`/calendar?view=day&date=${getTodayEntryDate()}`, { scroll: false });
    });
  });

  it("falls back to placeholder chips when the toolbar query fails", async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch;

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");

    await waitFor(() => {
      expect(within(toolbar).getAllByText("--")).toHaveLength(3);
    });
    expect(within(toolbar).getByRole("alert")).toHaveTextContent("摘要暂时不可用。");
  });

  it("announces toolbar loading while the summary request is pending", async () => {
    const deferred = createDeferredResponse();
    global.fetch = vi.fn(() => deferred.promise) as typeof fetch;

    render(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");
    expect(toolbar).toHaveAttribute("aria-busy", "true");
    expect(within(toolbar).getByRole("status")).toHaveTextContent("正在读取摘要。");

    deferred.resolve(new Response(JSON.stringify(buildMonthRecord()), { status: 200 }));
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("aria-busy", "false");
    });
  });

  it("renders an analysis nav item that links to the current month", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<SiteHeader />);

    expect(await screen.findByRole("link", { name: "分析" })).toHaveAttribute("href", `/analysis?month=${CURRENT_MONTH}`);
  });
});
