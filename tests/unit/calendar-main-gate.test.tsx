import React from "react";
import { act, render, screen } from "@testing-library/react";

import { CalendarMainGate } from "@/components/calendar/calendar-main-gate";
import { CalendarChromeProvider, useCalendarChrome } from "@/components/calendar/calendar-chrome-context";

const { mockPathname } = vi.hoisted(() => ({
  mockPathname: {
    value: "/interview"
  }
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    replace: vi.fn()
  }),
  useSearchParams: () => ({
    get: () => null
  })
}));

function BeginCalendarEntryButton() {
  const { beginCalendarEntry } = useCalendarChrome();

  return (
    <button type="button" onClick={() => beginCalendarEntry()}>
      begin-entry
    </button>
  );
}

describe("calendar main gate", () => {
  beforeEach(() => {
    mockPathname.value = "/interview";
  });

  it("covers page children with calendar skeleton overlay while entering calendar", () => {
    render(
      <CalendarChromeProvider>
        <BeginCalendarEntryButton />
        <CalendarMainGate>
          <div data-testid="interview-main-content">访谈正文</div>
        </CalendarMainGate>
      </CalendarChromeProvider>
    );

    expect(screen.getByTestId("interview-main-content")).toBeVisible();
    expect(screen.queryByTestId("calendar-main-gate-overlay")).not.toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "begin-entry" }).click();
    });

    expect(screen.getByTestId("calendar-main-gate-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-month-workspace-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("interview-main-content").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("renders children when not entering calendar", () => {
    render(
      <CalendarChromeProvider>
        <CalendarMainGate>
          <div data-testid="interview-main-content">访谈正文</div>
        </CalendarMainGate>
      </CalendarChromeProvider>
    );

    expect(screen.getByTestId("interview-main-content")).toBeVisible();
    expect(screen.queryByTestId("calendar-main-gate-overlay")).not.toBeInTheDocument();
  });
});
