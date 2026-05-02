import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { CalendarMonthShell } from "@/components/calendar/calendar-month-shell";
import type { CalendarMonthRecord } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";

const { mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      view: "month" as string | null,
      date: "2026-05-02" as string | null
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

function buildMonthRecord(): CalendarMonthRecord {
  return {
    month: "2026-05",
    days: Array.from({ length: 31 }, (_, index) => {
      const date = `2026-05-${String(index + 1).padStart(2, "0")}`;

      return {
        date,
        overallStatus: "empty" as const,
        dimensions: [
          {
            dimension: "joy" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          },
          {
            dimension: "fulfillment" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          },
          {
            dimension: "reflection" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          },
          {
            dimension: "improvement" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          },
          {
            dimension: "gratitude" as const,
            status: "empty" as const,
            title: null,
            summary: null,
            latestUpdatedAt: null,
            sessionId: null,
            journalEntryId: null,
            actions: [],
            hasActiveSession: false,
            hasDraftEntry: false,
            hasSavedEntry: false
          }
        ],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      };
    })
  };
}

describe("calendar month shell", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      view: "month",
      date: "2026-05-02"
    };
  });

  it("normalizes missing search params to today", async () => {
    mockSearchParams.value = {
      view: null,
      date: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarMonthShell />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(`/calendar?view=month&date=${getTodayEntryDate()}`, { scroll: false });
    });
  });

  it("renders a full 42-slot grid and exposes five start links for an empty past day", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    const { container } = render(<CalendarMonthShell />);

    const detailPanels = await screen.findAllByTestId("calendar-day-detail");

    expect(container.querySelectorAll('[data-testid^="calendar-day-2026-"], [data-testid^="calendar-placeholder-"]')).toHaveLength(42);
    const startLinks = within(detailPanels[0] as HTMLElement).getAllByRole("link", { name: /开始访谈/ });
    expect(startLinks).toHaveLength(5);
    expect(startLinks[0]?.getAttribute("href")).toContain("entryDate=2026-05-02");
  });

  it("updates the url when selecting another day", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildMonthRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarMonthShell />);

    await screen.findAllByTestId("calendar-day-detail");
    fireEvent.click(screen.getByTestId("calendar-day-2026-05-03"));

    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=month&date=2026-05-03", { scroll: false });
  });
});
