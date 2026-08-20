import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { SiteHeader } from "@/components/shared/site-header";
import { authLocalUserIdStorageKey } from "@/features/auth/auth-local";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { interviewSessionStorageKey } from "@/features/interview/dimensions";
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
    window.localStorage.clear();
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

  it("uses the three confirmed product destinations", () => {
    renderWithCalendarChrome(<SiteHeader />);
    const navigation = screen.getByRole("navigation", { name: "主要导航" });

    expect(within(navigation).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "记录",
      "日记",
      "认识自己"
    ]);
    expect(within(navigation).getByRole("link", { name: "记录" })).toHaveAttribute("href", "/interview");
    expect(within(navigation).getByRole("link", { name: "认识自己" })).toHaveAttribute(
      "href",
      "/insights?section=trends"
    );
    expect(within(navigation).queryByRole("link", { name: "分析" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "画像" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "设置" })).not.toBeInTheDocument();
  });

  it("opens the accessible account menu and restores focus with Escape", async () => {
    renderWithCalendarChrome(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "打开账户菜单" });

    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveAccessibleName("打开账户菜单");
    expect(within(menu).getByRole("menuitem", { name: "设置" })).toHaveAttribute("href", "/settings");
    expect(within(menu).getByRole("menuitem", { name: "隐私政策" })).toHaveAttribute("href", "/legal/privacy");
    expect(within(menu).getByRole("menuitem", { name: "用户协议" })).toHaveAttribute("href", "/legal/terms");
    expect(within(menu).getByRole("menuitem", { name: "退出登录" })).toBeInTheDocument();

    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(menu).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("shows an in-place message when logout fails", async () => {
    renderWithCalendarChrome(<SiteHeader />);
    fireEvent.click(screen.getByRole("button", { name: "打开账户菜单" }));
    const menu = await screen.findByRole("menu");

    fireEvent.click(within(menu).getByRole("menuitem", { name: "退出登录" }));

    expect(await screen.findByTestId("account-menu-error")).toHaveTextContent("退出失败，请稍后再试");
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });

  it("clears local interview state and uses the Next router after logout", async () => {
    window.localStorage.setItem(authLocalUserIdStorageKey, "user-1");
    window.localStorage.setItem(
      `${interviewSessionStorageKey}::user-1`,
      JSON.stringify({ joy: { sessionId: "session-joy" } })
    );
    global.fetch = vi.fn(async () => new Response(null, { status: 204 })) as typeof fetch;

    renderWithCalendarChrome(<SiteHeader />);
    fireEvent.click(screen.getByRole("button", { name: "打开账户菜单" }));
    const menu = await screen.findByRole("menu");

    fireEvent.click(within(menu).getByRole("menuitem", { name: "退出登录" }));

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/");
    });
    expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBeNull();
    expect(window.localStorage.getItem(`${interviewSessionStorageKey}::user-1`)).toBeNull();
  });

  it("keeps public authentication actions separate from product navigation", () => {
    renderWithCalendarChrome(<SiteHeader authenticated={false} />);

    expect(screen.getByRole("navigation", { name: "账户入口" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "创建账户" })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("navigation", { name: "主要导航" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /账户菜单/u })).not.toBeInTheDocument();
  });

  it("keeps journal period controls out of the global header", () => {
    renderWithCalendarChrome(<SiteHeader />);
    expect(screen.queryByTestId("journal-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "切换日记视图" })).not.toBeInTheDocument();
  });

  it("does not query journal data from the global header", () => {
    renderWithCalendarChrome(<SiteHeader />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("keeps interview context in the header until the route changes", () => {
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
    expect(screen.queryByTestId("journal-toolbar")).not.toBeInTheDocument();
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

  it("opens the new self-understanding workspace from the shared navigation", () => {
    renderWithCalendarChrome(<SiteHeader />);
    expect(screen.getByRole("link", { name: "认识自己" })).toHaveAttribute("href", "/insights?section=trends");
  });
});
