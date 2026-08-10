import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEventCalendarDay, getEventCalendarWeek, getEventCalendarMonth, EventCalendarQueryError } = vi.hoisted(() => ({
  getEventCalendarDay: vi.fn(),
  getEventCalendarWeek: vi.fn(),
  getEventCalendarMonth: vi.fn(),
  EventCalendarQueryError: class extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
}));

const { requireCurrentUserFromRequest } = vi.hoisted(() => ({
  requireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/event-calendar/event-calendar.service", () => ({
  getEventCalendarDay,
  getEventCalendarWeek,
  getEventCalendarMonth,
  EventCalendarQueryError
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest
}));

import { GET as getEventCalendarDayRoute } from "@/app/api/event-calendar/day/route";
import { GET as getEventCalendarMonthRoute } from "@/app/api/event-calendar/month/route";
import { GET as getEventCalendarWeekRoute } from "@/app/api/event-calendar/week/route";

describe("event-calendar api routes", () => {
  beforeEach(() => {
    getEventCalendarDay.mockReset();
    getEventCalendarWeek.mockReset();
    getEventCalendarMonth.mockReset();
    requireCurrentUserFromRequest.mockReset();
    requireCurrentUserFromRequest.mockResolvedValue({ id: "user-1" });
  });

  it("分别提供事件日历的日、周、月读取入口", async () => {
    getEventCalendarDay.mockResolvedValue({ date: "2026-07-22", events: [] });
    getEventCalendarWeek.mockResolvedValue({ anchorDate: "2026-07-22", days: [] });
    getEventCalendarMonth.mockResolvedValue({ month: "2026-07", days: [] });

    const [day, week, month] = await Promise.all([
      getEventCalendarDayRoute(new Request("http://localhost/api/event-calendar/day?date=2026-07-22")),
      getEventCalendarWeekRoute(new Request("http://localhost/api/event-calendar/week?date=2026-07-22")),
      getEventCalendarMonthRoute(new Request("http://localhost/api/event-calendar/month?month=2026-07"))
    ]);

    expect(day.status).toBe(200);
    expect(week.status).toBe(200);
    expect(month.status).toBe(200);
    expect(getEventCalendarDay).toHaveBeenCalledWith("user-1", "2026-07-22");
    expect(getEventCalendarWeek).toHaveBeenCalledWith("user-1", "2026-07-22");
    expect(getEventCalendarMonth).toHaveBeenCalledWith("user-1", "2026-07");
  });

  it("保留原有的参数错误语义，并独立报告事件日历查询失败", async () => {
    const missing = await getEventCalendarDayRoute(new Request("http://localhost/api/event-calendar/day"));
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({ error: "INVALID_CALENDAR_DATE" });

    getEventCalendarMonth.mockRejectedValue(new EventCalendarQueryError("EVENT_CALENDAR_QUERY_FAILED"));
    const failed = await getEventCalendarMonthRoute(
      new Request("http://localhost/api/event-calendar/month?month=2026-07")
    );
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ error: "EVENT_CALENDAR_QUERY_FAILED" });
  });
});
