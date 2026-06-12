import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

import {
  CALENDAR_ENTRY_LOADING_TOAST_MESSAGE,
  CalendarChromeProvider,
  useCalendarChrome
} from "@/components/calendar/calendar-chrome-context";
import { saveCalendarRecordCache, clearAllCalendarRecordCache } from "@/features/calendar/calendar-record-cache";
import type { CalendarMonthRecord } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";

const { mockPathname, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: {
    value: "/calendar"
  },
  mockSearchParams: {
    value: {
      view: "month" as string | null,
      date: "2026-05-02" as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    replace: vi.fn()
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "view" | "date"] ?? null
  })
}));

function CalendarChromeProbe() {
  const {
    activeView,
    optimisticView,
    isEnteringCalendar,
    isEntryLoadingToastVisible,
    beginCalendarViewChange,
    beginCalendarEntry,
    finishCalendarEntryLoading,
    cancelCalendarEntry
  } = useCalendarChrome();

  return (
    <div>
      <span data-testid="active-view">{activeView}</span>
      <span data-testid="optimistic-view">{optimisticView ?? "null"}</span>
      <span data-testid="entering-calendar">{String(isEnteringCalendar)}</span>
      <span data-testid="entry-toast-visible">{String(isEntryLoadingToastVisible)}</span>
      <button type="button" onClick={() => beginCalendarViewChange("week")}>
        begin-week
      </button>
      <button type="button" onClick={() => beginCalendarEntry()}>
        begin-entry
      </button>
      <button type="button" onClick={() => finishCalendarEntryLoading()}>
        finish-entry
      </button>
      <button type="button" onClick={() => cancelCalendarEntry()}>
        cancel-entry
      </button>
    </div>
  );
}

describe("calendar chrome context", () => {
  beforeEach(() => {
    clearAllCalendarRecordCache();
    mockPathname.value = "/calendar";
    mockSearchParams.value = {
      view: "month",
      date: "2026-05-02"
    };
  });

  it("sets optimistic view before the url catches up", () => {
    render(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    expect(screen.getByTestId("active-view")).toHaveTextContent("month");
    expect(screen.getByTestId("optimistic-view")).toHaveTextContent("null");

    act(() => {
      screen.getByRole("button", { name: "begin-week" }).click();
    });

    expect(screen.getByTestId("active-view")).toHaveTextContent("week");
    expect(screen.getByTestId("optimistic-view")).toHaveTextContent("week");
  });

  it("clears optimistic view when the url view matches", async () => {
    const { rerender } = render(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "begin-week" }).click();
    });

    expect(screen.getByTestId("optimistic-view")).toHaveTextContent("week");

    mockSearchParams.value = {
      view: "week",
      date: "2026-05-02"
    };
    rerender(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("optimistic-view")).toHaveTextContent("null");
    });
    expect(screen.getByTestId("active-view")).toHaveTextContent("week");
  });

  it("tracks calendar entry before pathname reaches /calendar", async () => {
    mockPathname.value = "/interview";

    render(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    expect(screen.getByTestId("entering-calendar")).toHaveTextContent("false");

    act(() => {
      screen.getByRole("button", { name: "begin-entry" }).click();
    });

    expect(screen.getByTestId("entering-calendar")).toHaveTextContent("true");
    expect(screen.getByTestId("entry-toast-visible")).toHaveTextContent("true");
    expect(screen.getByTestId("calendar-entry-loading-toast")).toHaveTextContent(CALENDAR_ENTRY_LOADING_TOAST_MESSAGE);
  });

  it("skips entry loading toast when calendar cache is already warm", () => {
    mockPathname.value = "/interview";
    const today = getTodayEntryDate();
    saveCalendarRecordCache("month", today, {
      month: today.slice(0, 7),
      days: []
    } satisfies CalendarMonthRecord);

    render(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "begin-entry" }).click();
    });

    expect(screen.getByTestId("entering-calendar")).toHaveTextContent("true");
    expect(screen.getByTestId("entry-toast-visible")).toHaveTextContent("false");
    expect(screen.queryByTestId("calendar-entry-loading-toast")).not.toBeInTheDocument();
  });

  it("clears entry loading toast when finishCalendarEntryLoading is called", () => {
    mockPathname.value = "/interview";

    render(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "begin-entry" }).click();
    });

    expect(screen.getByTestId("calendar-entry-loading-toast")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "finish-entry" }).click();
    });

    expect(screen.queryByTestId("calendar-entry-loading-toast")).not.toBeInTheDocument();
    expect(screen.getByTestId("entry-toast-visible")).toHaveTextContent("false");
  });

  it("cancels entry loading toast when navigation changes away from calendar entry", async () => {
    mockPathname.value = "/interview";

    const { rerender } = render(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "begin-entry" }).click();
    });

    expect(screen.getByTestId("calendar-entry-loading-toast")).toBeInTheDocument();

    mockPathname.value = "/settings";
    rerender(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId("calendar-entry-loading-toast")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("entering-calendar")).toHaveTextContent("false");
  });

  it("clears entering flag but keeps toast until shell finishes loading", async () => {
    mockPathname.value = "/interview";

    const { rerender } = render(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "begin-entry" }).click();
    });

    expect(screen.getByTestId("entering-calendar")).toHaveTextContent("true");

    mockPathname.value = "/calendar";
    rerender(
      <CalendarChromeProvider>
        <CalendarChromeProbe />
      </CalendarChromeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("entering-calendar")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("entry-toast-visible")).toHaveTextContent("true");
    expect(screen.getByTestId("calendar-entry-loading-toast")).toBeInTheDocument();
  });
});
