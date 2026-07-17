import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { SiteHeader } from "@/components/shared/site-header";
import { CalendarMonthShell } from "@/components/calendar/calendar-month-shell";
import { CALENDAR_ENTRY_LOADING_TOAST_MESSAGE } from "@/components/calendar/calendar-chrome-context";
import { clearAllCalendarRecordCache, saveCalendarRecordCache } from "@/features/calendar/calendar-record-cache";
import type { CalendarDayRecord, CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { renderWithCalendarChrome } from "../helpers/render-with-calendar-chrome";

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
  instances: [] as Array<{ callback: ResizeObserverCallback; element: Element | null }>,
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
  private instance: { callback: ResizeObserverCallback; element: Element | null };

  constructor(callback: ResizeObserverCallback) {
    this.instance = { callback, element: null };
    resizeObserverState.instances.push(this.instance);
  }

  observe = (element: Element) => {
    this.instance.element = element;
    resizeObserverState.observe(element);
  };

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

function mockAllCalendarFetch() {
  global.fetch = vi.fn(async (input) => {
    const url = String(input);

    if (url.includes("/api/calendar/month")) {
      return new Response(JSON.stringify(buildMonthRecord()), { status: 200 });
    }

    if (url.includes("/api/calendar/week")) {
      return new Response(JSON.stringify(buildWeekRecord()), { status: 200 });
    }

    if (url.includes("/api/calendar/day")) {
      return new Response(JSON.stringify(buildDayRecord()), { status: 200 });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;
}

describe("site header calendar toolbar", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    clearAllCalendarRecordCache();
    mockAllCalendarFetch();
    resizeObserverState.instances = [];
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

    renderWithCalendarChrome(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("aria-busy", "false");
    });

    expect(within(toolbar).getByText("2026年5月")).toBeInTheDocument();
    expect(within(toolbar).getByTestId("calendar-period-stepper")).toBeInTheDocument();
    expect(within(toolbar).getByTestId("calendar-period-display")).toHaveTextContent("2026年5月");
    expect(within(toolbar).getByText("3天")).toBeInTheDocument();
    expect(within(toolbar).getByText("2天")).toBeInTheDocument();
    expect(within(toolbar).getByText("0维")).toBeInTheDocument();
    expect(toolbar).toHaveAttribute("aria-busy", "false");
  });

  it("keeps calendar header sticky frosted without spacer", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);
    const header = screen.getByRole("banner");

    expect(header).toHaveClass("sticky", "top-0", "site-header-frosted");
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

    renderWithCalendarChrome(<SiteHeader />);
    const header = screen.getByRole("banner");

    expect(header).toHaveClass("sticky", "top-0", "site-header-frosted", "isolate");
    expect(header.className).not.toContain("fixed");
    expect(header.previousElementSibling).toBeNull();
  });

  it("keeps the dimension toolbar hidden on the generic interview picker", () => {
    mockPathname.value = "/interview";
    mockSearchParams.value = {
      dimension: null,
      view: null,
      date: null,
      month: null
    };

    renderWithCalendarChrome(<SiteHeader />);

    expect(screen.queryByTestId("interview-dimension-bar")).not.toBeInTheDocument();
  });

  it("syncs the viewport offset css variable to the measured header height", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

    await screen.findByTestId("calendar-toolbar");
    const observedHeader = screen.getByRole("banner");
    const headerObserver = resizeObserverState.instances.find((instance) => instance.element === observedHeader);
    expect(headerObserver).toBeTruthy();
    Object.defineProperty(observedHeader, "offsetHeight", {
      configurable: true,
      value: 118
    });
    vi.spyOn(observedHeader, "getBoundingClientRect").mockReturnValue({
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

    headerObserver?.callback([], {} as ResizeObserver);

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--site-header-viewport-offset")).toBe("118px");
    });

    expect(resizeObserverState.observe).toHaveBeenCalledWith(observedHeader);
  });

  it("switches the active view and keeps the current date", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");
    const weekButton = within(toolbar).getByRole("button", { name: "切换到周视图" });

    fireEvent.click(weekButton);

    expect(weekButton).toHaveAttribute("data-active", "true");
    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=week&date=2026-05-02", { scroll: false });
  });

  it("prefetches calendar views when hovering the segmented control", async () => {
    global.fetch = vi.fn(async (input) => {
      const url = String(input);

      if (url.includes("/api/calendar/week")) {
        return new Response(JSON.stringify(buildWeekRecord()), { status: 200 });
      }

      return new Response(JSON.stringify(buildMonthRecord()), { status: 200 });
    }) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("aria-busy", "false");
    });

    fireEvent.pointerEnter(within(toolbar).getByRole("button", { name: "切换到周视图" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/calendar/week?date=2026-05-02"),
        expect.anything()
      );
    });
  });

  it("uses week data and navigation labels for week view", async () => {
    mockSearchParams.value = {
      dimension: null,
      view: "week",
      date: "2026-05-07",
      month: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildWeekRecord()), { status: 200 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

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

    renderWithCalendarChrome(<SiteHeader />);

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

    renderWithCalendarChrome(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");

    await waitFor(() => {
      expect(within(toolbar).getAllByText("--")).toHaveLength(3);
    });
    expect(within(toolbar).getByRole("alert")).toHaveTextContent("摘要暂时不可用。");
  });

  it("announces toolbar loading while the summary request is pending", async () => {
    const deferred = createDeferredResponse();
    global.fetch = vi.fn((input) => {
      const url = String(input);

      if (url.includes("/api/calendar/month")) {
        return deferred.promise;
      }

      if (url.includes("/api/calendar/week")) {
        return Promise.resolve(new Response(JSON.stringify(buildWeekRecord()), { status: 200 }));
      }

      if (url.includes("/api/calendar/day")) {
        return Promise.resolve(new Response(JSON.stringify(buildDayRecord()), { status: 200 }));
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    }) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

    const toolbar = await screen.findByTestId("calendar-toolbar");
    expect(toolbar).toHaveAttribute("aria-busy", "true");
    expect(within(toolbar).getByTestId("calendar-period-stepper")).toHaveAttribute("aria-busy", "true");
    expect(within(toolbar).getByTestId("calendar-period-stepper").querySelector(".sr-only")).toHaveTextContent(
      "正在读取摘要。"
    );

    deferred.resolve(new Response(JSON.stringify(buildMonthRecord()), { status: 200 }));
    await waitFor(() => {
      expect(toolbar).toHaveAttribute("aria-busy", "false");
    });
  });

  it("renders an analysis nav item that links to the current month", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

    expect(await screen.findByRole("link", { name: "分析" })).toHaveAttribute("href", `/analysis?month=${CURRENT_MONTH}`);
  });

  it("shows calendar toolbar optimistically when entering from another page", async () => {
    mockPathname.value = "/interview";
    mockSearchParams.value = {
      dimension: "joy",
      view: null,
      date: null,
      month: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

    expect(screen.queryByTestId("calendar-toolbar")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "日历" }));

    expect(await screen.findByTestId("calendar-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "日历" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "访谈" })).not.toHaveAttribute("aria-current");
  });

  it("hides interview toolbar when optimistically entering calendar", async () => {
    mockPathname.value = "/interview";
    mockSearchParams.value = {
      dimension: "joy",
      view: null,
      date: null,
      month: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

    expect(await screen.findByTestId("interview-dimension-bar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "日历" }));

    expect(await screen.findByTestId("calendar-toolbar")).toBeInTheDocument();
    expect(screen.queryByTestId("interview-dimension-bar")).not.toBeInTheDocument();
  });

  it("shows entry loading toast when entering calendar from another page", async () => {
    mockPathname.value = "/interview";
    mockSearchParams.value = {
      dimension: "joy",
      view: null,
      date: null,
      month: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

    fireEvent.click(screen.getByRole("link", { name: "日历" }));

    expect(screen.getByTestId("calendar-entry-loading-toast")).toHaveTextContent(CALENDAR_ENTRY_LOADING_TOAST_MESSAGE);
  });

  it("skips entry loading toast on repeat calendar entry when cache is warm", async () => {
    mockPathname.value = "/interview";
    mockSearchParams.value = {
      dimension: "joy",
      view: null,
      date: null,
      month: null
    };
    saveCalendarRecordCache("month", getTodayEntryDate(), buildMonthRecord());
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);

    fireEvent.click(screen.getByRole("link", { name: "日历" }));

    expect(screen.queryByTestId("calendar-entry-loading-toast")).not.toBeInTheDocument();
    expect(await screen.findByTestId("calendar-toolbar")).toBeInTheDocument();
  });

  it("dismisses entry loading toast after calendar shell finishes loading", async () => {
    mockPathname.value = "/interview";
    mockSearchParams.value = {
      dimension: "joy",
      view: null,
      date: null,
      month: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    const { rerender } = renderWithCalendarChrome(<SiteHeader />);

    fireEvent.click(screen.getByRole("link", { name: "日历" }));
    expect(screen.getByTestId("calendar-entry-loading-toast")).toBeInTheDocument();

    mockPathname.value = "/calendar";
    mockSearchParams.value = {
      dimension: null,
      view: "month",
      date: "2026-05-02",
      month: null
    };

    rerender(
      <>
        <SiteHeader />
        <CalendarMonthShell />
      </>
    );

    await waitFor(() => {
      expect(screen.queryByTestId("calendar-entry-loading-toast")).not.toBeInTheDocument();
    });
  });
});
