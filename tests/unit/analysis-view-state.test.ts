import {
  buildAnalysisHref,
  formatAnalysisMonthLabel,
  normalizeAnalysisSearchParams,
  shiftAnalysisMonth
} from "@/features/analysis/view-state";

describe("analysis view state helpers", () => {
  it("normalizes empty month params to the current month", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: null,
        today: "2026-05"
      })
    ).toEqual({
      month: "2026-05",
      section: "score",
      hasExplicitSection: false,
      href: "/analysis?month=2026-05&section=score",
      shouldReplace: true
    });
  });

  it("falls back invalid months to the current month", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-13",
        today: "2026-05"
      })
    ).toEqual({
      month: "2026-05",
      section: "score",
      hasExplicitSection: false,
      href: "/analysis?month=2026-05&section=score",
      shouldReplace: true
    });
  });

  it("normalizes invalid sections to score", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-05",
        section: "unknown",
        today: "2026-05"
      })
    ).toEqual({
      month: "2026-05",
      section: "score",
      hasExplicitSection: false,
      href: "/analysis?month=2026-05&section=score",
      shouldReplace: false
    });
  });

  it("keeps valid analysis sections", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-05",
        section: "rhythm",
        today: "2026-05"
      })
    ).toEqual({
      month: "2026-05",
      section: "rhythm",
      hasExplicitSection: true,
      href: "/analysis?month=2026-05&section=rhythm",
      shouldReplace: false
    });
  });

  it("defaults missing section to score without forcing a replace", () => {
    expect(
      normalizeAnalysisSearchParams({
        month: "2026-05",
        section: null,
        today: "2026-05"
      })
    ).toEqual({
      month: "2026-05",
      section: "score",
      hasExplicitSection: false,
      href: "/analysis?month=2026-05&section=score",
      shouldReplace: false
    });
  });

  it("shifts months across year boundaries", () => {
    expect(shiftAnalysisMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftAnalysisMonth("2026-12", 1)).toBe("2027-01");
  });

  it("builds stable hrefs and month labels", () => {
    expect(buildAnalysisHref({ month: "2026-05" })).toBe("/analysis?month=2026-05&section=score");
    expect(buildAnalysisHref({ month: "2026-05", section: "insights" })).toBe("/analysis?month=2026-05&section=insights");
    expect(formatAnalysisMonthLabel("2026-05")).toBe("2026年5月");
  });
});
