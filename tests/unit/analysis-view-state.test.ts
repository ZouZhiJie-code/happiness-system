import {
  buildAnalysisHref,
  formatAnalysisMonthLabel,
  normalizeAnalysisSearchParams,
  shiftAnalysisMonth
} from "@/features/analysis/view-state";

vi.mock("@/features/interview/entry-date", () => ({
  getTodayEntryDate: () => "2026-05-03"
}));

describe("analysis view state helpers", () => {
  it("normalizes empty month params to the current month", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: null,
        today: "2026-05"
      })
    ).toMatchObject({
      month: "2026-05",
      section: "trends",
      preset: "month",
      href: "/analysis?month=2026-05&section=trends",
      shouldReplace: true
    });
  });

  it("falls back invalid months to the current month", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-13",
        today: "2026-05"
      })
    ).toMatchObject({
      month: "2026-05",
      section: "trends",
      href: "/analysis?month=2026-05&section=trends",
      shouldReplace: true
    });
  });

  it("normalizes invalid sections to trends", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-05",
        section: "unknown",
        today: "2026-05"
      })
    ).toMatchObject({
      month: "2026-05",
      section: "trends",
      href: "/analysis?month=2026-05&section=trends",
      shouldReplace: true
    });
  });

  it("maps legacy score and rhythm sections to trends", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-05",
        section: "score",
        today: "2026-05"
      })
    ).toMatchObject({
      month: "2026-05",
      section: "trends",
      href: "/analysis?month=2026-05&section=trends",
      shouldReplace: true
    });

    expect(
      normalizeAnalysisSearchParams({
        month: "2026-05",
        section: "rhythm",
        today: "2026-05"
      })
    ).toMatchObject({
      month: "2026-05",
      section: "trends",
      href: "/analysis?month=2026-05&section=trends",
      shouldReplace: true
    });
  });

  it("maps legacy insights section to dimensions", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-05",
        section: "insights",
        today: "2026-05"
      })
    ).toMatchObject({
      month: "2026-05",
      section: "dimensions",
      href: "/analysis?month=2026-05&section=dimensions",
      shouldReplace: true
    });
  });

  it("keeps valid analysis sections", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-05",
        section: "correlation",
        today: "2026-05"
      })
    ).toMatchObject({
      month: "2026-05",
      section: "correlation",
      href: "/analysis?month=2026-05&section=correlation",
      shouldReplace: false
    });
  });

  it("defaults missing section to trends and normalizes the url", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-05",
        section: null,
        today: "2026-05"
      })
    ).toMatchObject({
      month: "2026-05",
      section: "trends",
      href: "/analysis?month=2026-05&section=trends",
      startDate: "2026-05-01",
      endDate: "2026-05-03",
      shouldReplace: true
    });
  });

  it("shifts months across year boundaries", () => {
    expect(shiftAnalysisMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftAnalysisMonth("2026-12", 1)).toBe("2027-01");
  });

  it("builds stable hrefs and month labels", () => {
    expect(buildAnalysisHref({ month: "2026-05" })).toBe("/analysis?month=2026-05&section=trends");
    expect(buildAnalysisHref({ month: "2026-05", section: "dimensions" })).toBe("/analysis?month=2026-05&section=dimensions");
    expect(formatAnalysisMonthLabel("2026-05")).toBe("2026年5月");
  });
});
