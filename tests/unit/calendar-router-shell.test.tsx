import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { CalendarRouterShell } from "@/components/calendar/calendar-router-shell";
import { CalendarChromeProvider, useCalendarChrome } from "@/components/calendar/calendar-chrome-context";

const { mockSearchParams } = vi.hoisted(() => ({
  mockSearchParams: {
    value: {
      view: null as string | null,
      date: "2026-05-02" as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as "view" | "date"] ?? null
  })
}));

vi.mock("@/components/journal/journal-day-workspace", () => ({
  JournalDayWorkspace: ({ entryDate }: { entryDate: string }) => (
    <div data-testid="journal-day-workspace">day:{entryDate}</div>
  )
}));

vi.mock("@/components/journal/journal-period-report-container", () => ({
  JournalPeriodReportContainer: ({ kind, anchorDate }: { kind: "week" | "month"; anchorDate: string }) => (
    <div data-testid={`journal-${kind}-report-workspace`}>{kind}:{anchorDate}</div>
  )
}));

function Harness({ children }: { children?: React.ReactNode }) {
  return (
    <CalendarChromeProvider>
      {children}
      <CalendarRouterShell />
    </CalendarChromeProvider>
  );
}

function OptimisticWeekTrigger() {
  const { beginCalendarViewChange } = useCalendarChrome();
  return <button onClick={() => beginCalendarViewChange("week")}>切换周视图</button>;
}

describe("journal router shell", () => {
  beforeEach(() => {
    mockSearchParams.value = { view: null, date: "2026-05-02" };
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ kind: "day", selectedKey: "2026-05-02", items: [], monthDates: [] })
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the selected date in day view when the url has no explicit view", async () => {
    render(<Harness />);
    expect(screen.getByTestId("journal-day-workspace")).toHaveTextContent("day:2026-05-02");
    expect(await screen.findByText("还没有可回看的记录。")).toBeInTheDocument();
  });

  it("keeps month view on the journal record model", async () => {
    mockSearchParams.value = { view: "month", date: "2026-05-02" };
    render(<Harness />);
    expect(screen.getByTestId("journal-month-report-workspace")).toHaveTextContent("month:2026-05-02");
    expect(await screen.findByText("还没有可回看的记录。")).toBeInTheDocument();
  });

  it("keeps week view on the journal record model", async () => {
    mockSearchParams.value = { view: "week", date: "2026-05-07" };
    render(<Harness />);
    expect(screen.getByTestId("journal-week-report-workspace")).toHaveTextContent("week:2026-05-07");
    expect(await screen.findByText("还没有可回看的记录。")).toBeInTheDocument();
  });

  it("renders an optimistic week view before the url updates", async () => {
    mockSearchParams.value = { view: "month", date: "2026-05-02" };
    render(<Harness><OptimisticWeekTrigger /></Harness>);
    fireEvent.click(screen.getByRole("button", { name: "切换周视图" }));
    expect(screen.getByTestId("journal-week-report-workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-month-report-workspace")).not.toBeInTheDocument();
    expect(await screen.findByText("还没有可回看的记录。")).toBeInTheDocument();
  });
});
