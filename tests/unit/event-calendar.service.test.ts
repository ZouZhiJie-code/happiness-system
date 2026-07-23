import { beforeEach, describe, expect, it, vi } from "vitest";

const { listEventCalendarSourcesByDate, listEventCalendarSourcesByDateRange } = vi.hoisted(() => ({
  listEventCalendarSourcesByDate: vi.fn(),
  listEventCalendarSourcesByDateRange: vi.fn()
}));

vi.mock("@/server/repositories/event-calendar.repository", () => ({
  listEventCalendarSourcesByDate,
  listEventCalendarSourcesByDateRange
}));

import {
  EventCalendarQueryError,
  getEventCalendarDay,
  getEventCalendarMonth,
  getEventCalendarWeek
} from "@/server/services/event-calendar/event-calendar.service";

const emptySources = { events: [], entries: [], dailyJournals: [] };

describe("event-calendar.service", () => {
  beforeEach(() => {
    listEventCalendarSourcesByDate.mockReset();
    listEventCalendarSourcesByDateRange.mockReset();
    listEventCalendarSourcesByDate.mockResolvedValue(emptySources);
    listEventCalendarSourcesByDateRange.mockResolvedValue(emptySources);
  });

  it("复用日期校验并返回事件中心独立的日级读模型", async () => {
    const result = await getEventCalendarDay("user-1", "2026-07-22");

    expect(listEventCalendarSourcesByDate).toHaveBeenCalledWith("user-1", "2026-07-22");
    expect(result).toMatchObject({
      date: "2026-07-22",
      overallStatus: "empty",
      primaryAction: "start_event",
      events: []
    });
  });

  it("周与月读取使用同一来源集合和上海日期边界", async () => {
    const week = await getEventCalendarWeek("user-1", "2026-07-22");
    const month = await getEventCalendarMonth("user-1", "2026-07");

    expect(listEventCalendarSourcesByDateRange).toHaveBeenNthCalledWith(1, {
      userId: "user-1",
      startDate: "2026-07-20",
      endDate: "2026-07-26"
    });
    expect(listEventCalendarSourcesByDateRange).toHaveBeenNthCalledWith(2, {
      userId: "user-1",
      startDate: "2026-07-01",
      endDate: "2026-07-31"
    });
    expect(week.days).toHaveLength(7);
    expect(month.days).toHaveLength(31);
  });

  it("拒绝错误日期并把仓储故障归为事件日历读取错误", async () => {
    await expect(getEventCalendarDay("user-1", "2026-07-42")).rejects.toMatchObject({
      code: "INVALID_CALENDAR_DATE"
    } satisfies Partial<EventCalendarQueryError>);
    await expect(getEventCalendarMonth("user-1", "2026-13")).rejects.toMatchObject({
      code: "INVALID_CALENDAR_MONTH"
    } satisfies Partial<EventCalendarQueryError>);

    listEventCalendarSourcesByDate.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(getEventCalendarDay("user-1", "2026-07-22")).rejects.toMatchObject({
      code: "EVENT_CALENDAR_QUERY_FAILED"
    } satisfies Partial<EventCalendarQueryError>);
  });
});
