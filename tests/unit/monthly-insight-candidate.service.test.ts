import { createMonthlyInsightCandidateInputService } from "@/server/services/analysis/monthly-insight-candidate.service";
import type { JournalPeriodReportView } from "@/types/journal-period-report";

function monthView(): JournalPeriodReportView {
  return {
    period: { kind: "month", startDate: "2026-08-01", endDate: "2026-08-31" },
    materials: [1, 2, 3].map((day) => ({
      sourceId: `event:${day}`,
      kind: "event_card" as const,
      title: `记录 ${day}`,
      content: `内容 ${day}`,
      contentRevision: 1,
      updatedAt: `2026-08-0${day}T12:00:00.000Z`,
      startDate: `2026-08-0${day}`,
      endDate: `2026-08-0${day}`,
      sourceEventIds: [`event-${day}`],
      upstreamSourceIds: []
    })),
    sourceSignature: "signature",
    report: null,
    freshness: "none",
    displayStatus: "ungenerated",
    latestGeneration: null,
    statistics: {
      materialCount: 3,
      dailyReportCount: 0,
      weeklyReportCount: 0,
      eventCardCount: 3,
      coveredDayCount: 3
    },
    primaryAction: { kind: "generate", label: "生成月报" }
  };
}

describe("monthly insight current-product projection", () => {
  it("loads JournalPeriod materials and scores without the legacy analysis source repository", async () => {
    const loadMonthView = vi.fn(async () => monthView());
    const listScores = vi.fn(async () => []);
    const service = createMonthlyInsightCandidateInputService({ loadMonthView, listScores });

    const input = await service.load("user-1", "2026-08");

    expect(loadMonthView).toHaveBeenCalledWith("user-1", "2026-08-01");
    expect(listScores).toHaveBeenCalledWith("user-1", {
      startDate: "2026-08-01",
      endDate: "2026-08-31"
    });
    expect(input.sources.map((source) => source.sourceId)).toEqual([
      "event:1",
      "event:2",
      "event:3"
    ]);
    expect(input.eligibility.eligible).toBe(true);
  });

  it("rejects a repository projection for a different month", async () => {
    const view = monthView();
    view.period = { kind: "month", startDate: "2026-07-01", endDate: "2026-07-31" };
    const service = createMonthlyInsightCandidateInputService({
      loadMonthView: async () => view,
      listScores: async () => []
    });

    await expect(service.load("user-1", "2026-08")).rejects.toThrow("MONTHLY_INSIGHT_PERIOD_MISMATCH");
  });
});
