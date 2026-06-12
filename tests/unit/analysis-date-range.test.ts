import {
  buildEntryDateRange,
  getMonthDateRangeForAnalysis,
  getWeekDateRange,
  shiftWeekDateRange
} from "@/features/analysis/date-range";
import {
  normalizeAnalysisSearchParams,
  shiftAnalysisTrendsRange
} from "@/features/analysis/view-state";

describe("analysis date range helpers", () => {
  it("builds inclusive date ranges", () => {
    expect(buildEntryDateRange("2026-06-01", "2026-06-03")).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03"
    ]);
  });

  it("resolves current month to today", () => {
    expect(getMonthDateRangeForAnalysis("2026-05", "2026-05-03")).toEqual({
      startDate: "2026-05-01",
      endDate: "2026-05-03"
    });
  });

  it("resolves monday-sunday week ranges", () => {
    expect(getWeekDateRange("2026-06-12")).toEqual({
      startDate: "2026-06-08",
      endDate: "2026-06-14"
    });
  });

  it("shifts week ranges by whole weeks", () => {
    expect(shiftWeekDateRange("2026-06-08", -1)).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-07"
    });
  });
});

describe("analysis search params with presets", () => {
  it("defaults to month preset and resolved range", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-06",
        section: "trends",
        todayEntryDate: "2026-06-12"
      })
    ).toMatchObject({
      month: "2026-06",
      preset: "month",
      startDate: "2026-06-01",
      endDate: "2026-06-12",
      rangeLabel: "2026-06-01 — 2026-06-12"
    });
  });

  it("keeps custom ranges in the url", () => {
    const normalized = normalizeAnalysisSearchParams({
      month: "2026-06",
      section: "trends",
      preset: "custom",
      startDate: "2026-06-02",
      endDate: "2026-06-10",
      todayEntryDate: "2026-06-12"
    });

    expect(normalized).toMatchObject({
      preset: "custom",
      startDate: "2026-06-02",
      endDate: "2026-06-10",
      href: "/analysis?month=2026-06&section=trends&preset=custom&start=2026-06-02&end=2026-06-10"
    });
  });

  it("shifts month and week periods", () => {
    expect(
      shiftAnalysisTrendsRange({
        preset: "month",
        month: "2026-06",
        startDate: "2026-06-01",
        endDate: "2026-06-12",
        offset: -1
      })
    ).toEqual({ month: "2026-05", preset: "month" });

    expect(
      shiftAnalysisTrendsRange({
        preset: "week",
        month: "2026-06",
        startDate: "2026-06-08",
        endDate: "2026-06-14",
        offset: 1
      })
    ).toEqual({
      month: "2026-06",
      preset: "week",
      startDate: "2026-06-15",
      endDate: "2026-06-21"
    });
  });
});
