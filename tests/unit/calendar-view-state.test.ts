import {
  buildCalendarMonthGrid,
  getCalendarWeekRange,
  normalizeCalendarSearchParams,
  normalizeCalendarView,
  shiftCalendarWeek,
  shiftCalendarMonth
} from "@/features/calendar/view-state";

describe("calendar view state helpers", () => {
  it("normalizes empty search params to month view and today", () => {
    expect(
      normalizeCalendarSearchParams({
        view: null,
        date: null,
        today: "2026-05-02"
      })
    ).toEqual({
      view: "month",
      date: "2026-05-02",
      href: "/calendar?view=month&date=2026-05-02"
    });
  });

  it("accepts week and day views while defaulting unknown values to month", () => {
    expect(normalizeCalendarView("week")).toBe("week");
    expect(normalizeCalendarView("day")).toBe("day");
    expect(normalizeCalendarView("something-else")).toBe("month");
  });

  it("clamps month shifts when the target month has fewer days", () => {
    expect(shiftCalendarMonth("2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftCalendarMonth("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("shifts week anchors by seven days and keeps monday-sunday ranges", () => {
    expect(shiftCalendarWeek("2026-05-07", 1)).toBe("2026-05-14");
    expect(getCalendarWeekRange("2026-05-07")).toEqual({
      startDate: "2026-05-04",
      endDate: "2026-05-10"
    });
  });

  it("builds only the visible calendar weeks for each month", () => {
    const minimumFiveRowGrid = buildCalendarMonthGrid("2027-02");
    const fiveRowGrid = buildCalendarMonthGrid("2026-05");
    const sixRowGrid = buildCalendarMonthGrid("2026-08");

    expect(minimumFiveRowGrid).toHaveLength(35);
    expect(minimumFiveRowGrid.filter((cell) => cell.isCurrentMonth)).toHaveLength(28);
    expect(fiveRowGrid).toHaveLength(35);
    expect(fiveRowGrid.filter((cell) => cell.isCurrentMonth)).toHaveLength(31);
    expect(sixRowGrid).toHaveLength(42);
    expect(sixRowGrid.filter((cell) => cell.isCurrentMonth)).toHaveLength(31);
  });
});
