import { beforeEach, describe, expect, it } from "vitest";

import {
  buildCalendarRecordCacheKey,
  clearAllCalendarRecordCache,
  getCachedCalendarDayRecord,
  getCachedCalendarMonthRecord,
  getCachedCalendarWeekRecord,
  getCalendarRecordCache,
  hasCalendarRecordCache,
  saveCalendarRecordCache,
  touchCalendarRecordCacheWindow
} from "@/features/calendar/calendar-record-cache";
import type { CalendarDayRecord, CalendarMonthRecord, CalendarWeekRecord } from "@/features/calendar/types";

const monthRecord: CalendarMonthRecord = {
  month: "2026-05",
  days: []
};

const weekRecord: CalendarWeekRecord = {
  anchorDate: "2026-05-02",
  weekStartDate: "2026-04-28",
  weekEndDate: "2026-05-04",
  days: []
};

const dayRecord: CalendarDayRecord = {
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
};

describe("calendar-record-cache", () => {
  beforeEach(() => {
    clearAllCalendarRecordCache();
  });

  it("builds stable cache keys per view", () => {
    expect(buildCalendarRecordCacheKey("month", "2026-05-02")).toBe("month:2026-05");
    expect(buildCalendarRecordCacheKey("week", "2026-05-02")).toBe("week:2026-05-02");
    expect(buildCalendarRecordCacheKey("day", "2026-05-02")).toBe("day:2026-05-02");
  });

  it("saves and reads typed month/week/day records", () => {
    saveCalendarRecordCache("month", "2026-05-02", monthRecord);
    saveCalendarRecordCache("week", "2026-05-02", weekRecord);
    saveCalendarRecordCache("day", "2026-05-02", dayRecord);

    expect(getCachedCalendarMonthRecord("2026-05-02")).toEqual(monthRecord);
    expect(getCachedCalendarWeekRecord("2026-05-02")).toEqual(weekRecord);
    expect(getCachedCalendarDayRecord("2026-05-02")).toEqual(dayRecord);
    expect(hasCalendarRecordCache("month", "2026-05-12")).toBe(true);
    expect(getCalendarRecordCache("month", "2026-05-12")).toEqual(monthRecord);
  });

  it("clears cached records when the month window changes", () => {
    saveCalendarRecordCache("month", "2026-05-02", monthRecord);
    saveCalendarRecordCache("day", "2026-05-02", dayRecord);

    touchCalendarRecordCacheWindow("2026-06-01");

    expect(getCachedCalendarMonthRecord("2026-05-02")).toBeNull();
    expect(getCachedCalendarDayRecord("2026-05-02")).toBeNull();
  });

  it("keeps cache entries when navigating within the same month", () => {
    saveCalendarRecordCache("month", "2026-05-02", monthRecord);
    saveCalendarRecordCache("day", "2026-05-02", dayRecord);

    touchCalendarRecordCacheWindow("2026-05-18");

    expect(getCachedCalendarMonthRecord("2026-05-18")).toEqual(monthRecord);
    expect(getCachedCalendarDayRecord("2026-05-18")).toBeNull();
  });
});
