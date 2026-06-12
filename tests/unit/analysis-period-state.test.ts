import {
  buildAnalysisPeriodState,
  buildAnalysisPeriodStateFromShift,
  periodStatesEqual,
  resolvePeriodDisplayLabel,
  resolvePeriodNavLabel
} from "@/features/analysis/period-state";
import { shiftAnalysisTrendsRange } from "@/features/analysis/view-state";

vi.mock("@/features/interview/entry-date", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/interview/entry-date")>();

  return {
    ...actual,
    getTodayEntryDate: () => "2026-05-03"
  };
});

describe("analysis period state helpers", () => {
  it("builds month period labels", () => {
    const period = buildAnalysisPeriodState({
      preset: "month",
      month: "2026-05"
    });

    expect(resolvePeriodDisplayLabel(period)).toBe("2026年5月");
    expect(resolvePeriodNavLabel(period)).toBe("2026年5月");
  });

  it("builds week period labels", () => {
    const period = buildAnalysisPeriodState({
      preset: "week",
      month: "2026-05"
    });

    expect(resolvePeriodDisplayLabel(period)).toBe("2026-04-27 — 2026-05-03");
    expect(resolvePeriodNavLabel(period)).toBe("周");
  });

  it("builds custom period labels", () => {
    const period = buildAnalysisPeriodState({
      preset: "custom",
      month: "2026-05",
      startDate: "2026-05-01",
      endDate: "2026-05-10"
    });

    expect(resolvePeriodDisplayLabel(period)).toBe("2026-05-01 — 2026-05-10");
    expect(resolvePeriodNavLabel(period)).toBe("区间");
  });

  it("compares period states by preset and range", () => {
    const left = buildAnalysisPeriodState({ preset: "month", month: "2026-05" });
    const right = buildAnalysisPeriodState({ preset: "month", month: "2026-05" });
    const shifted = buildAnalysisPeriodStateFromShift(
      shiftAnalysisTrendsRange({
        preset: "month",
        month: "2026-05",
        startDate: "2026-05-01",
        endDate: "2026-05-03",
        offset: 1
      })
    );

    expect(periodStatesEqual(left, right)).toBe(true);
    expect(periodStatesEqual(left, shifted)).toBe(false);
  });
});
