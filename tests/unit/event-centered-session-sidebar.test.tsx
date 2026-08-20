import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { EventCenteredSessionSidebar } from "@/components/interview/event-centered/event-centered-session-sidebar";
import { formatEntryDate, getTodayEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import type { EventCenteredSessionListItem } from "@/types/event-centered-interview";

function item(overrides: Partial<EventCenteredSessionListItem> = {}): EventCenteredSessionListItem {
  return {
    rootSessionId: "root-today",
    entryDate: getTodayEntryDate(),
    recordMode: "chat",
    title: "今天的第一条记录",
    startedAt: "2026-08-12T01:00:00.000Z",
    lastActivityAt: "2026-08-12T01:10:00.000Z",
    lifecycle: "unfinished",
    hasUserMessage: true,
    readOnly: false,
    ...overrides
  };
}

describe("event-centered session sidebar", () => {
  beforeEach(() => window.localStorage.clear());

  it("groups cross-date sessions and supports list keyboard navigation", () => {
    const today = getTodayEntryDate();
    const yesterday = formatEntryDate(new Date(parseEntryDateInput(today).getTime() - 86_400_000));
    const onSelect = vi.fn();
    render(
      <EventCenteredSessionSidebar
        items={[
          item(),
          item({ rootSessionId: "root-yesterday", entryDate: yesterday, title: "昨天的记录", lifecycle: "completed", readOnly: true })
        ]}
        activeSessionId="root-today"
        unfinishedCount={1}
        unfinishedLimit={2}
        busy={false}
        onNew={vi.fn()}
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole("region", { name: "今天" })).toBeVisible();
    expect(screen.getByRole("region", { name: "昨天" })).toBeVisible();
    const list = screen.getByRole("listbox", { name: "会话列表" });
    const options = within(list).getAllByRole("option");
    fireEvent.keyDown(options[0]!, { key: "ArrowDown" });
    expect(options[1]).toHaveFocus();
    expect(onSelect).toHaveBeenCalledWith("root-yesterday");
    fireEvent.keyDown(options[1]!, { key: "Home" });
    expect(options[0]).toHaveFocus();
  });

  it("keeps creation clickable at the two-record limit and reports the limit", () => {
    const onNew = vi.fn();
    const onLimitReached = vi.fn();
    render(
      <EventCenteredSessionSidebar
        items={[item(), item({ rootSessionId: "root-two", title: "第二条记录", lifecycle: "blank", hasUserMessage: false })]}
        activeSessionId={null}
        unfinishedCount={2}
        unfinishedLimit={2}
        busy={false}
        onNew={onNew}
        onLimitReached={onLimitReached}
        onSelect={vi.fn()}
      />
    );

    const newRecord = screen.getByRole("button", { name: "新建记录" });
    expect(newRecord).not.toBeDisabled();
    expect(newRecord).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(newRecord);
    expect(onLimitReached).toHaveBeenCalledOnce();
    expect(screen.getByText("未完成 2 / 2")).toBeVisible();
    const collapseButton = screen.getByRole("button", { name: "收起记录侧栏" });
    expect(collapseButton).toHaveClass("absolute", "size-11", "bg-transparent");
    expect(collapseButton.querySelector("span")).toHaveClass("size-7", "opacity-65");
    fireEvent.click(collapseButton);
    expect(screen.getByRole("complementary", { name: "记录列表" })).toHaveAttribute("data-collapsed", "true");
    expect(window.localStorage.getItem("daily-light:interview-sidebar-collapsed")).toBe("true");
    expect(onNew).not.toHaveBeenCalled();
  });

  it("resizes by pointer and keyboard, persists the width, and restores it after collapse", () => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MouseEvent
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    render(
      <EventCenteredSessionSidebar
        items={[item()]}
        activeSessionId="root-today"
        unfinishedCount={1}
        unfinishedLimit={2}
        busy={false}
        onNew={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const sidebar = screen.getByRole("complementary", { name: "记录列表" });
    const resizer = screen.getByRole("separator", { name: "调整记录侧栏宽度" });
    expect(sidebar).toHaveStyle({ width: "280px" });
    fireEvent.pointerDown(resizer, { pointerId: 7, clientX: 280 });
    fireEvent.pointerMove(resizer, { pointerId: 7, clientX: 344 });
    fireEvent.pointerUp(resizer, { pointerId: 7, clientX: 344 });
    expect(sidebar).toHaveStyle({ width: "344px" });
    expect(window.localStorage.getItem("daily-light:interview-sidebar-width")).toBe("344");

    fireEvent.keyDown(resizer, { key: "End" });
    expect(sidebar).toHaveStyle({ width: "460px" });
    fireEvent.keyDown(resizer, { key: "ArrowLeft" });
    expect(sidebar).toHaveStyle({ width: "444px" });
    fireEvent.keyDown(resizer, { key: "Home" });
    expect(sidebar).toHaveStyle({ width: "240px" });
    fireEvent.doubleClick(resizer);
    expect(sidebar).toHaveStyle({ width: "280px" });

    fireEvent.click(screen.getByRole("button", { name: "收起记录侧栏" }));
    expect(sidebar).toHaveStyle({ width: "64px" });
    fireEvent.click(screen.getByRole("button", { name: "展开记录侧栏" }));
    expect(sidebar).toHaveStyle({ width: "280px" });

    const collapseResizer = screen.getByRole("separator", { name: "调整记录侧栏宽度" });
    fireEvent.pointerDown(collapseResizer, { pointerId: 8, clientX: 280 });
    fireEvent.pointerMove(collapseResizer, { pointerId: 8, clientX: 190 });
    fireEvent.pointerUp(collapseResizer, { pointerId: 8, clientX: 190 });
    expect(sidebar).toHaveAttribute("data-collapsed", "true");
    expect(sidebar).toHaveStyle({ width: "64px" });
    expect(window.localStorage.getItem("daily-light:interview-sidebar-collapsed")).toBe("true");

    const collapsedResizer = screen.getByRole("separator", { name: "调整记录侧栏宽度" });
    fireEvent.pointerDown(collapsedResizer, { pointerId: 9, clientX: 64 });
    fireEvent.pointerMove(collapsedResizer, { pointerId: 9, clientX: 260 });
    fireEvent.pointerUp(collapsedResizer, { pointerId: 9, clientX: 260 });
    expect(sidebar).toHaveAttribute("data-collapsed", "false");
    expect(sidebar).toHaveStyle({ width: "260px" });
  });
});
