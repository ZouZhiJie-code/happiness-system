const { listCalendarSourcesByDate, listCalendarSourcesByDateRange } = vi.hoisted(() => ({
  listCalendarSourcesByDate: vi.fn(),
  listCalendarSourcesByDateRange: vi.fn()
}));

vi.mock("@/server/repositories/calendar.repository", () => ({
  listCalendarSourcesByDate,
  listCalendarSourcesByDateRange
}));

import {
  CalendarQueryError,
  getCalendarDay,
  getCalendarMonth,
  getCalendarWeek
} from "@/server/services/calendar/calendar.service";

describe("calendar.service", () => {
  beforeEach(() => {
    listCalendarSourcesByDate.mockReset();
    listCalendarSourcesByDateRange.mockReset();
  });

  it("returns an empty day record when no sources exist", async () => {
    listCalendarSourcesByDate.mockResolvedValue({
      sessions: [],
      entries: []
    });

    const result = await getCalendarDay("2026-05-02");

    expect(result.date).toBe("2026-05-02");
    expect(result.overallStatus).toBe("empty");
    expect(result.dimensions).toHaveLength(5);
    expect(listCalendarSourcesByDate).toHaveBeenCalledWith("2026-05-02");
  });

  it("returns a full week model using the repository range query", async () => {
    listCalendarSourcesByDateRange.mockResolvedValue({
      sessions: [
        {
          kind: "session",
          id: "session-1",
          dimension: "fulfillment",
          date: "2026-05-05",
          status: "active",
          updatedAt: "2026-05-05T10:00:00.000Z",
          startedAt: "2026-05-05T09:00:00.000Z",
          completedAt: null,
          pausedAt: null,
          draftSummary: "这件事已经有点推进感了。",
          journalEntryId: null
        }
      ],
      entries: [
        {
          kind: "entry",
          id: "entry-1",
          sessionId: "session-2",
          dimension: "joy",
          date: "2026-05-07",
          status: "saved",
          title: "和家人吃饭",
          content: "今天和家人一起吃饭聊天，整个人慢慢放松下来。",
          updatedAt: "2026-05-07T12:00:00.000Z",
          savedAt: "2026-05-07T12:30:00.000Z"
        }
      ]
    });

    const result = await getCalendarWeek("2026-05-07");

    expect(listCalendarSourcesByDateRange).toHaveBeenCalledWith({
      startDate: "2026-05-04",
      endDate: "2026-05-10"
    });
    expect(result.weekStartDate).toBe("2026-05-04");
    expect(result.weekEndDate).toBe("2026-05-10");
    expect(result.days).toHaveLength(7);
    expect(result.days.find((day) => day.date === "2026-05-05")?.overallStatus).toBe("in_progress");
    expect(result.days.find((day) => day.date === "2026-05-07")?.overallStatus).toBe("completed");
  });

  it("returns a full month model using the repository range query", async () => {
    listCalendarSourcesByDateRange.mockResolvedValue({
      sessions: [],
      entries: []
    });

    const result = await getCalendarMonth("2026-02");

    expect(listCalendarSourcesByDateRange).toHaveBeenCalledWith({
      startDate: "2026-02-01",
      endDate: "2026-02-28"
    });
    expect(result.month).toBe("2026-02");
    expect(result.days).toHaveLength(28);
  });

  it("throws a typed error for invalid day input", async () => {
    await expect(getCalendarDay("2026/05/02")).rejects.toMatchObject({
      code: "INVALID_CALENDAR_DATE"
    } satisfies Partial<CalendarQueryError>);
  });

  it("throws a typed error for invalid month input", async () => {
    await expect(getCalendarMonth("2026/05")).rejects.toMatchObject({
      code: "INVALID_CALENDAR_MONTH"
    } satisfies Partial<CalendarQueryError>);
  });

  it("wraps repository failures in CALENDAR_QUERY_FAILED", async () => {
    listCalendarSourcesByDate.mockRejectedValue(new Error("db unavailable"));

    await expect(getCalendarDay("2026-05-02")).rejects.toMatchObject({
      code: "CALENDAR_QUERY_FAILED"
    } satisfies Partial<CalendarQueryError>);
  });
});
