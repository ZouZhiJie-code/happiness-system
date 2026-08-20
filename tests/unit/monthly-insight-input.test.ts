import type { AnalysisScoreTrend } from "@/features/analysis/types";
import {
  buildMonthlyInsightCandidateInput,
  deterministicInsufficientEvidenceNarrative
} from "@/features/analysis/monthly-insight-input";
import type { JournalPeriodMaterial } from "@/types/journal-period-report";

function material(
  sourceId: string,
  date: string,
  content = `记录 ${sourceId}`
): JournalPeriodMaterial {
  return {
    sourceId,
    kind: "daily_report",
    title: sourceId,
    content,
    contentRevision: 1,
    updatedAt: `${date}T12:00:00.000Z`,
    startDate: date,
    endDate: date,
    sourceEventIds: [],
    upstreamSourceIds: []
  };
}

const emptyScoreTrend: AnalysisScoreTrend = {
  days: [],
  factorAverages: {
    meaning: null,
    health: null,
    virtue: null,
    autonomy: null,
    interest: null,
    skill: null,
    relationship: null,
    livingCondition: null
  }
};

describe("monthly insight candidate input", () => {
  it("returns a deterministic zero-call result below the three-day gate", () => {
    const input = buildMonthlyInsightCandidateInput({
      month: "2026-08",
      materials: [
        material("daily:1", "2026-08-01"),
        material("daily:2", "2026-08-02"),
        material("daily:3", "2026-08-02")
      ],
      scoreTrend: emptyScoreTrend
    });

    expect(input.eligibility).toEqual({
      eligible: false,
      recordedDayCount: 2,
      savedOutcomeCount: 3,
      reason: "recorded_days_below_3"
    });
    expect(deterministicInsufficientEvidenceNarrative(input)).toEqual({
      overviewNarrative: "本月目前有 2 个记录日、3 条已保存成果，材料还不足以形成可靠的个性化洞察。",
      dimensionTheses: {},
      insightCards: []
    });
  });

  it("builds bounded source excerpts from current period materials", () => {
    const input = buildMonthlyInsightCandidateInput({
      month: "2026-08",
      materials: [
        material("daily:1", "2026-08-01", `  第一条\n${"很长的内容".repeat(100)}  `),
        material("daily:2", "2026-08-02"),
        material("event:3", "2026-08-03")
      ],
      scoreTrend: emptyScoreTrend
    });

    expect(input.eligibility.eligible).toBe(true);
    expect(input.sources).toHaveLength(3);
    expect(input.sources[0]?.excerpt.length).toBeLessThanOrEqual(320);
    expect(input.sources[0]?.excerpt).not.toMatch(/\n/u);
    expect(input.dimensionLabels).toEqual([]);
  });

  it("rejects sources outside the requested month", () => {
    expect(() => buildMonthlyInsightCandidateInput({
      month: "2026-08",
      materials: [material("daily:1", "2026-07-31")],
      scoreTrend: emptyScoreTrend
    })).toThrow("MONTHLY_INSIGHT_SOURCE_OUTSIDE_MONTH");
  });
});
