import {
  buildCalendarMonthGrid,
  normalizeCalendarSearchParams,
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

  it("clamps month shifts when the target month has fewer days", () => {
    expect(shiftCalendarMonth("2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftCalendarMonth("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("always builds a 42-slot month grid", () => {
    const grid = buildCalendarMonthGrid("2026-05");

    expect(grid).toHaveLength(42);
    expect(grid.filter((cell) => cell.isCurrentMonth)).toHaveLength(31);
  });
});
