import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CalendarWeekShell } from "@/components/calendar/calendar-week-shell";
import type { CalendarDayRecord, CalendarDimensionStatus, CalendarWeekRecord } from "@/features/calendar/types";
import { getTodayEntryDate } from "@/features/interview/entry-date";

const { mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      view: "week" as string | null,
      date: "2026-05-07" as string | null
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

function buildDimensionStatus(
  overrides: Partial<CalendarDimensionStatus> & Pick<CalendarDimensionStatus, "dimension">
): CalendarDimensionStatus {
  return {
    dimension: overrides.dimension,
    status: overrides.status ?? "empty",
    title: overrides.title ?? null,
    summary: overrides.summary ?? null,
    latestUpdatedAt: overrides.latestUpdatedAt ?? null,
    sessionId: overrides.sessionId ?? null,
    journalEntryId: overrides.journalEntryId ?? null,
    actions: overrides.actions ?? [],
    hasActiveSession: overrides.hasActiveSession ?? false,
    hasDraftEntry: overrides.hasDraftEntry ?? false,
    hasSavedEntry: overrides.hasSavedEntry ?? false
  };
}

function buildDay(date: string, overrides?: Partial<CalendarDayRecord>): CalendarDayRecord {
  const dimensions: CalendarDimensionStatus[] =
    overrides?.dimensions ??
    [
      buildDimensionStatus({ dimension: "joy" }),
      buildDimensionStatus({ dimension: "fulfillment" }),
      buildDimensionStatus({ dimension: "reflection" }),
      buildDimensionStatus({ dimension: "improvement" }),
      buildDimensionStatus({ dimension: "gratitude" })
    ];

  return {
    date,
    overallStatus: overrides?.overallStatus ?? "empty",
    dimensions,
    activeCount: overrides?.activeCount ?? 0,
    draftCount: overrides?.draftCount ?? 0,
    savedCount: overrides?.savedCount ?? 0,
    primaryTitle: overrides?.primaryTitle ?? null,
    primarySummary: overrides?.primarySummary ?? null,
    latestUpdatedAt: overrides?.latestUpdatedAt ?? null,
    primaryAction: overrides?.primaryAction ?? null
  };
}

function buildWeekRecord(): CalendarWeekRecord {
  return {
    anchorDate: "2026-05-07",
    weekStartDate: "2026-05-04",
    weekEndDate: "2026-05-10",
    days: [
      buildDay("2026-05-04", {
        overallStatus: "completed",
        savedCount: 1,
        primaryTitle: "项目终于收束",
        latestUpdatedAt: "2026-05-04T10:00:00.000Z",
        dimensions: [
          buildDimensionStatus({ dimension: "joy", status: "completed", hasSavedEntry: true }),
          buildDimensionStatus({ dimension: "fulfillment" }),
          buildDimensionStatus({ dimension: "reflection" }),
          buildDimensionStatus({ dimension: "improvement" }),
          buildDimensionStatus({ dimension: "gratitude" })
        ]
      }),
      buildDay("2026-05-05", {
        overallStatus: "draft",
        draftCount: 1,
        primarySummary: "还有一段没整理完。",
        latestUpdatedAt: "2026-05-05T12:00:00.000Z",
        dimensions: [
          buildDimensionStatus({ dimension: "joy" }),
          buildDimensionStatus({ dimension: "fulfillment", status: "draft", hasDraftEntry: true }),
          buildDimensionStatus({ dimension: "reflection" }),
          buildDimensionStatus({ dimension: "improvement" }),
          buildDimensionStatus({ dimension: "gratitude" })
        ]
      }),
      buildDay("2026-05-06"),
      buildDay("2026-05-07"),
      buildDay("2026-05-08"),
      buildDay("2026-05-09"),
      buildDay("2026-05-10")
    ]
  };
}

describe("calendar week shell", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      view: "week",
      date: "2026-05-07"
    };
  });

  it("normalizes missing date to today while staying in week view", async () => {
    mockSearchParams.value = {
      view: "week",
      date: null
    };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildWeekRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarWeekShell />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(`/calendar?view=week&date=${getTodayEntryDate()}`, { scroll: false });
    });
  });

  it("renders seven day cards and links each day to day view", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildWeekRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarWeekShell />);

    expect(await screen.findByTestId("calendar-week-board")).toBeInTheDocument();
    expect(screen.getAllByTestId(/calendar-week-day-/)).toHaveLength(7);
    expect(screen.getByRole("link", { name: /5\/4周一，已完成|5月4日周一，已完成|周一/ }).getAttribute("href")).toBe(
      "/calendar?view=day&date=2026-05-04"
    );
    expect(screen.getByText("这周有 2 天留下记录，已经触达 2 个维度。 还有 1 条草稿值得继续补完。")).toBeInTheDocument();
  });

  it("updates the url when switching weeks", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(buildWeekRecord()), { status: 200 })) as typeof fetch;

    render(<CalendarWeekShell />);

    await screen.findByTestId("calendar-week-board");
    fireEvent.click(screen.getByRole("button", { name: "下周" }));

    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar?view=week&date=2026-05-14", { scroll: false });
  });
});
