const { getCalendarDay, getCalendarWeek, getCalendarMonth, CalendarQueryError } = vi.hoisted(() => ({
  getCalendarDay: vi.fn(),
  getCalendarWeek: vi.fn(),
  getCalendarMonth: vi.fn(),
  CalendarQueryError: class extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
}));

vi.mock("@/server/services/calendar/calendar.service", () => ({
  getCalendarDay,
  getCalendarWeek,
  getCalendarMonth,
  CalendarQueryError
}));

import { GET as getCalendarDayRoute } from "@/app/api/calendar/day/route";
import { GET as getCalendarWeekRoute } from "@/app/api/calendar/week/route";
import { GET as getCalendarMonthRoute } from "@/app/api/calendar/month/route";

describe("calendar api routes", () => {
  beforeEach(() => {
    getCalendarDay.mockReset();
    getCalendarWeek.mockReset();
    getCalendarMonth.mockReset();
  });

  it("returns calendar day payload directly", async () => {
    getCalendarDay.mockResolvedValue({
      date: "2026-05-02",
      overallStatus: "empty",
      dimensions: [],
      activeCount: 0,
      draftCount: 0,
      savedCount: 0,
      primaryTitle: null,
      primarySummary: null,
      latestUpdatedAt: null,
      primaryAction: null
    });

    const response = await getCalendarDayRoute(new Request("http://localhost/api/calendar/day?date=2026-05-02"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      date: "2026-05-02",
      overallStatus: "empty"
    });
  });

  it("returns a full week payload", async () => {
    getCalendarWeek.mockResolvedValue({
      anchorDate: "2026-05-07",
      weekStartDate: "2026-05-04",
      weekEndDate: "2026-05-10",
      days: Array.from({ length: 7 }, (_, index) => ({
        date: `2026-05-0${index + 4}`,
        overallStatus: "empty",
        dimensions: [],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      }))
    });

    const response = await getCalendarWeekRoute(new Request("http://localhost/api/calendar/week?date=2026-05-07"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.weekStartDate).toBe("2026-05-04");
    expect(payload.weekEndDate).toBe("2026-05-10");
    expect(payload.days).toHaveLength(7);
  });

  it("returns a full month payload", async () => {
    getCalendarMonth.mockResolvedValue({
      month: "2026-02",
      days: Array.from({ length: 28 }, (_, index) => ({
        date: `2026-02-${String(index + 1).padStart(2, "0")}`,
        overallStatus: "empty",
        dimensions: [],
        activeCount: 0,
        draftCount: 0,
        savedCount: 0,
        primaryTitle: null,
        primarySummary: null,
        latestUpdatedAt: null,
        primaryAction: null
      }))
    });

    const response = await getCalendarMonthRoute(new Request("http://localhost/api/calendar/month?month=2026-02"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.month).toBe("2026-02");
    expect(payload.days).toHaveLength(28);
  });

  it("returns 400 for invalid day query", async () => {
    getCalendarDay.mockRejectedValue(new CalendarQueryError("INVALID_CALENDAR_DATE"));

    const response = await getCalendarDayRoute(new Request("http://localhost/api/calendar/day?date=2026-02-30"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_CALENDAR_DATE" });
  });

  it("returns 400 for invalid month query", async () => {
    getCalendarMonth.mockRejectedValue(new CalendarQueryError("INVALID_CALENDAR_MONTH"));

    const response = await getCalendarMonthRoute(new Request("http://localhost/api/calendar/month?month=2026-13"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_CALENDAR_MONTH" });
  });

  it("returns 400 when required query is missing", async () => {
    const response = await getCalendarWeekRoute(new Request("http://localhost/api/calendar/week"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_CALENDAR_DATE" });
  });

  it("returns 500 for calendar query failures", async () => {
    getCalendarDay.mockRejectedValue(new CalendarQueryError("CALENDAR_QUERY_FAILED"));

    const response = await getCalendarDayRoute(new Request("http://localhost/api/calendar/day?date=2026-05-02"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "CALENDAR_QUERY_FAILED" });
  });
});
