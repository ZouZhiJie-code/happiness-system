import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { SiteHeader } from "@/components/shared/site-header";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { renderWithCalendarChrome } from "../helpers/render-with-calendar-chrome";

const { mockPathname, mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: { value: "/calendar" },
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      dimension: null as string | null,
      view: "month" as string | null,
      date: "2026-05-02" as string | null,
      month: null as string | null,
      mode: null as string | null
    }
  }
}));

const resizeObserverState = vi.hoisted(() => ({
  instances: [] as Array<{ callback: ResizeObserverCallback; element: Element | null }>
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as keyof typeof mockSearchParams.value] ?? null
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
  };

  disconnect = vi.fn();
}

describe("site header journal toolbar", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    global.fetch = vi.fn(async () => new Response(null, { status: 404 })) as typeof fetch;
    mockPathname.value = "/calendar";
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      dimension: null,
      view: "month",
      date: "2026-05-02",
      month: null,
      mode: null
    };
    resizeObserverState.instances = [];
    document.documentElement.style.removeProperty("--site-header-viewport-offset");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty("--site-header-viewport-offset");
  });

  it("uses 日记 as the main navigation label and opens today's day view", () => {
    renderWithCalendarChrome(<SiteHeader />);
    expect(screen.getByRole("link", { name: "日记" })).toHaveAttribute(
      "href",
      `/calendar?view=day&date=${getTodayEntryDate()}`
    );
    expect(screen.getByRole("link", { name: "日记" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "日历" })).not.toBeInTheDocument();
  });

  it("renders a journal month toolbar without the historical model switch", () => {
    renderWithCalendarChrome(<SiteHeader />);
    const toolbar = screen.getByTestId("journal-toolbar");
    expect(within(toolbar).getByTestId("journal-period-display")).toHaveTextContent("2026年5月");
    const viewSwitcher = within(toolbar).getByRole("group", { name: "切换日记视图" });
    expect(within(viewSwitcher).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "切换到日视图",
      "切换到周视图",
      "切换到月视图"
    ]);
    expect(within(toolbar).queryByRole("button", { name: "切换到事件记录" })).not.toBeInTheDocument();
  });

  it("switches views while preserving the selected date", () => {
    renderWithCalendarChrome(<SiteHeader />);
    const toolbar = screen.getByTestId("journal-toolbar");
    fireEvent.click(within(toolbar).getByRole("button", { name: "切换到周视图" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=week&date=2026-05-02", { scroll: false });
  });

  it("uses week navigation labels and moves by seven days", () => {
    mockSearchParams.value.view = "week";
    mockSearchParams.value.date = "2026-05-07";
    renderWithCalendarChrome(<SiteHeader />);
    const toolbar = screen.getByTestId("journal-toolbar");
    expect(within(toolbar).getByTestId("journal-period-display")).toHaveTextContent("5月4日 - 10日");
    fireEvent.click(within(toolbar).getByRole("button", { name: "下一周" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=week&date=2026-05-14", { scroll: false });
  });

  it("returns to today without changing the active view", () => {
    mockSearchParams.value.view = "day";
    mockSearchParams.value.date = "2026-05-01";
    renderWithCalendarChrome(<SiteHeader />);
    fireEvent.click(within(screen.getByTestId("journal-toolbar")).getByRole("button", { name: "回到今天" }));
    expect(mockRouterReplace).toHaveBeenCalledWith(`/calendar?view=day&date=${getTodayEntryDate()}`, { scroll: false });
  });

  it("does not query historical calendar summaries from the journal toolbar", () => {
    renderWithCalendarChrome(<SiteHeader />);
    fireEvent.pointerEnter(within(screen.getByTestId("journal-toolbar")).getByRole("button", { name: "切换到周视图" }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows the journal toolbar optimistically when entering from interview", async () => {
    mockPathname.value = "/interview";
    mockSearchParams.value = {
      dimension: "joy",
      view: null,
      date: null,
      month: null,
      mode: null
    };
    renderWithCalendarChrome(<SiteHeader />);
    expect(screen.getByTestId("interview-dimension-bar")).toBeInTheDocument();
    const journalLink = screen.getByRole("link", { name: "日记" });
    journalLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(journalLink);
    expect(await screen.findByTestId("journal-toolbar")).toBeInTheDocument();
    expect(screen.queryByTestId("interview-dimension-bar")).not.toBeInTheDocument();
  });

  it("keeps the shared header sticky and synchronizes its measured height", async () => {
    renderWithCalendarChrome(<SiteHeader />);
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("sticky", "top-0", "site-header-frosted");
    const observer = resizeObserverState.instances.find((item) => item.element === header);
    expect(observer).toBeTruthy();
    Object.defineProperty(header, "offsetHeight", { configurable: true, value: 112 });
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 112,
      right: 1200,
      width: 1200,
      height: 112,
      toJSON: () => ({})
    });
    observer?.callback([], {} as ResizeObserver);
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--site-header-viewport-offset")).toBe("112px");
    });
  });

  it("keeps the analysis navigation anchored to the current month", () => {
    renderWithCalendarChrome(<SiteHeader />);
    expect(screen.getByRole("link", { name: "分析" })).toHaveAttribute(
      "href",
      `/analysis?month=${getTodayEntryDate().slice(0, 7)}`
    );
  });
});
