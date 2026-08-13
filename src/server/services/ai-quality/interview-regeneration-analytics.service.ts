import { aggregateInterviewRegenerationMetrics } from "@/features/ai-quality/regeneration-metrics";
import { parseAssistantTurnPayload } from "@/features/joy-interview/assistant-turn";
import { findInterviewRegenerationsForMetrics } from "@/server/repositories/interview-regeneration-analytics.repository";

const DEFAULT_LOOKBACK_DAYS = 30;

export async function getInterviewRegenerationMetrics(input?: {
  periodEnd?: Date;
  lookbackDays?: number;
}) {
  const periodEnd = input?.periodEnd ?? new Date();
  const lookbackDays = Math.min(90, Math.max(1, input?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS));
  const periodStart = new Date(periodEnd.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const records = await findInterviewRegenerationsForMetrics({ periodStart, periodEnd });
  const items = records.map((record) => ({
    ...record,
    usedFallback: record.generatedTrace?.outputOrigin === "fallback",
    dimension: record.rootSession.dimension,
    questionTarget:
      parseAssistantTurnPayload(record.sourceMessage.content)?.questionSpec?.target ?? null
  }));
  return aggregateInterviewRegenerationMetrics({ items, periodStart, periodEnd });
}
