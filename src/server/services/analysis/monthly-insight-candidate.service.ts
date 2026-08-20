import { buildAnalysisScoreTrend } from "@/features/analysis/aggregate-month";
import {
  buildMonthlyInsightCandidateInput,
  type MonthlyInsightCandidateInput
} from "@/features/analysis/monthly-insight-input";
import type { DailyHappinessScoreRecord } from "@/features/happiness-score/types";
import type { JournalPeriodReportView } from "@/types/journal-period-report";
import { listDailyHappinessScoresByDateRange } from "@/server/repositories/daily-happiness-score.repository";
import { getJournalPeriodReportView } from "@/server/repositories/journal-period-report.repository";

export interface MonthlyInsightCandidateInputStore {
  loadMonthView(userId: string, anchorDate: string): Promise<JournalPeriodReportView>;
  listScores(
    userId: string,
    range: { startDate: string; endDate: string }
  ): Promise<DailyHappinessScoreRecord[]>;
}

export function createMonthlyInsightCandidateInputService(
  store: MonthlyInsightCandidateInputStore
) {
  return {
    async load(userId: string, month: string): Promise<MonthlyInsightCandidateInput> {
      const view = await store.loadMonthView(userId, `${month}-01`);
      if (
        view.period.kind !== "month"
        || view.period.startDate.slice(0, 7) !== month
        || view.period.endDate.slice(0, 7) !== month
      ) {
        throw new Error("MONTHLY_INSIGHT_PERIOD_MISMATCH");
      }
      const scores = await store.listScores(userId, {
        startDate: view.period.startDate,
        endDate: view.period.endDate
      });
      const { scoreTrend } = buildAnalysisScoreTrend({ month, scoreRecords: scores });

      return buildMonthlyInsightCandidateInput({
        month,
        materials: view.materials,
        scoreTrend
      });
    }
  };
}

/**
 * Candidate-only projection. It is intentionally not wired to a Production API
 * or to the deterministic AnalysisNarrative used by the product.
 */
export const monthlyInsightCandidateInputService = createMonthlyInsightCandidateInputService({
  loadMonthView(userId, anchorDate) {
    return getJournalPeriodReportView(userId, "month", anchorDate);
  },
  listScores: listDailyHappinessScoresByDateRange
});
