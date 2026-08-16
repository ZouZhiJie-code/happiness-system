import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { JournalWorkspaceFrame } from "@/components/journal/journal-workspace-frame";
import type { JournalArchiveIndexView } from "@/types/journal-archive";

const routerReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace })
}));

function archive(kind: "day" | "week" | "month" = "day"): JournalArchiveIndexView {
  return {
    kind,
    selectedKey: "2026-08-12",
    monthDates: kind === "day" ? ["2026-08-11", "2026-08-12"] : [],
    items: [
      {
        key: "2026-08-12",
        kind,
        startDate: "2026-08-12",
        endDate: "2026-08-12",
        title: "今天的日记",
        recordCount: 2,
        displayStatus: "saved"
      },
      {
        key: "2026-08-11",
        kind,
        startDate: "2026-08-11",
        endDate: "2026-08-11",
        title: "昨天的日记",
        recordCount: 1,
        displayStatus: "draft"
      }
    ]
  };
}

describe("journal workspace frame", () => {
  beforeEach(() => {
    routerReplace.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps day week month in the left sidebar and navigates without a header switcher", () => {
    const onNavigate = vi.fn();
    render(
      <JournalWorkspaceFrame
        activeView="day"
        date="2026-08-12"
        archiveOverride={archive()}
        onNavigateOverride={onNavigate}
        layout="embedded"
      >
        <main>日记正文</main>
      </JournalWorkspaceFrame>
    );

    const sidebar = screen.getByRole("complementary", { name: "日记归档" });
    expect(within(sidebar).getByRole("button", { name: "收起日记侧栏" })).toBeVisible();
    expect(["日", "周", "月"].map((label) =>
      within(sidebar).getByRole("button", { name: `切换到${label}视图` }).textContent
    )).toEqual(["日", "周", "月"]);
    expect(within(sidebar).getByRole("heading", { name: "最近日记" })).toBeVisible();
    expect(within(sidebar).getByRole("button", { name: "2026-08-11，有记录" })).toBeVisible();
    fireEvent.click(within(sidebar).getByRole("button", { name: "切换到周视图" }));
    expect(onNavigate).toHaveBeenCalledWith("week", "2026-08-12");
    fireEvent.click(within(sidebar).getByRole("link", { name: /昨天的日记/u }));
    expect(onNavigate).toHaveBeenCalledWith("day", "2026-08-11");
    expect(routerReplace).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "回到今天" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "前一天" })).not.toBeInTheDocument();
  });

  it("remembers a journal-specific collapsed state", () => {
    render(
      <JournalWorkspaceFrame activeView="day" date="2026-08-12" archiveOverride={archive()} layout="embedded">
        <main>日记正文</main>
      </JournalWorkspaceFrame>
    );
    fireEvent.click(screen.getByRole("button", { name: "收起日记侧栏" }));
    expect(screen.getByRole("complementary", { name: "日记归档" })).toHaveAttribute("data-collapsed", "true");
    expect(window.localStorage.getItem("daily-light:journal-sidebar-collapsed")).toBe("true");
  });

  it("resizes, persists and collapses the journal sidebar from the drag threshold", () => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MouseEvent
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => true)
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    render(
      <JournalWorkspaceFrame activeView="day" date="2026-08-12" archiveOverride={archive()} layout="embedded">
        <main>日记正文</main>
      </JournalWorkspaceFrame>
    );

    const sidebar = screen.getByRole("complementary", { name: "日记归档" });
    const resizer = screen.getByRole("separator", { name: "调整日记侧栏宽度" });
    expect(sidebar).toHaveStyle({ width: "280px" });
    fireEvent.pointerDown(resizer, { pointerId: 7, clientX: 280 });
    fireEvent.pointerMove(resizer, { pointerId: 7, clientX: 344 });
    expect(window.localStorage.getItem("daily-light:journal-sidebar-width")).toBeNull();
    fireEvent.pointerUp(resizer, { pointerId: 7, clientX: 344 });
    expect(sidebar).toHaveStyle({ width: "344px" });
    expect(window.localStorage.getItem("daily-light:journal-sidebar-width")).toBe("344");

    fireEvent.keyDown(resizer, { key: "End" });
    expect(sidebar).toHaveStyle({ width: "460px" });
    fireEvent.keyDown(resizer, { key: "Home" });
    expect(sidebar).toHaveStyle({ width: "240px" });
    fireEvent.doubleClick(resizer);
    expect(sidebar).toHaveStyle({ width: "280px" });

    fireEvent.pointerDown(resizer, { pointerId: 8, clientX: 280 });
    fireEvent.pointerMove(resizer, { pointerId: 8, clientX: 190 });
    fireEvent.pointerUp(resizer, { pointerId: 8, clientX: 190 });
    expect(sidebar).toHaveAttribute("data-collapsed", "true");
    expect(sidebar).toHaveStyle({ width: "64px" });
    const collapsedResizer = screen.getByRole("separator", { name: "调整日记侧栏宽度" });
    fireEvent.pointerDown(collapsedResizer, { pointerId: 9, clientX: 64 });
    fireEvent.pointerMove(collapsedResizer, { pointerId: 9, clientX: 260 });
    fireEvent.pointerUp(collapsedResizer, { pointerId: 9, clientX: 260 });
    expect(sidebar).toHaveAttribute("data-collapsed", "false");
    expect(sidebar).toHaveStyle({ width: "260px" });
  });

  it("keeps archive loading feedback beside the heading without inserting a list row", () => {
    vi.spyOn(global, "fetch").mockImplementation(() => new Promise<Response>(() => undefined));
    const { rerender } = render(
      <JournalWorkspaceFrame activeView="day" date="2026-08-12" archiveOverride={archive()} layout="embedded">
        <main>日记正文</main>
      </JournalWorkspaceFrame>
    );

    rerender(
      <JournalWorkspaceFrame activeView="day" date="2026-08-12" layout="embedded">
        <main>日记正文</main>
      </JournalWorkspaceFrame>
    );

    const status = screen.getByRole("status", { name: "正在读取归档" });
    expect(status.parentElement).toContainElement(screen.getByRole("heading", { name: "最近日记" }));
    expect(screen.getByRole("link", { name: /昨天的日记/u })).toBeVisible();
    expect(screen.queryByText("正在读取归档…")).not.toBeInTheDocument();
  });

  it("does not repeat generated date titles inside recent journals", () => {
    const dateArchive = archive();
    dateArchive.items[0] = {
      ...dateArchive.items[0]!,
      title: "2026年8月12日 周三",
      displayStatus: "stale"
    };
    render(
      <JournalWorkspaceFrame activeView="day" date="2026-08-12" archiveOverride={dateArchive} layout="embedded">
        <main>日记正文</main>
      </JournalWorkspaceFrame>
    );

    const selected = screen.getByRole("link", { current: "page" });
    expect(within(selected).queryByText("2026年8月12日 周三")).not.toBeInTheDocument();
    expect(within(selected).getByText("需更新")).toHaveClass("ui-status-badge");
    expect(within(selected).getByText("需更新")).toHaveAttribute("data-tone", "stale");
  });
});
