import type { InterviewRegenerationIntent } from "@prisma/client";
import type {
  AssistantQuestionTarget,
  InterviewDimension
} from "@/types/interview";

export type InterviewRegenerationMetricItem = {
  intent: InterviewRegenerationIntent;
  status: "processing" | "completed" | "failed" | "canceled";
  latencyMs: number | null;
  answeredAt: Date | null;
  replacedAt: Date | null;
  switchedBackAt: Date | null;
  downvotedAt: Date | null;
  abandonedAt: Date | null;
  usedFallback: boolean;
  dimension: InterviewDimension;
  questionTarget: AssistantQuestionTarget | null;
};

export type InterviewRegenerationIntentMetrics = {
  intent: InterviewRegenerationIntent;
  total: number;
  completed: number;
  successCount: number;
  successRate: number;
};

export type InterviewRegenerationBreakdownMetrics = {
  key: string;
  total: number;
  completed: number;
  successCount: number;
  successRate: number;
};

export type InterviewRegenerationMetrics = {
  periodStart: Date;
  periodEnd: Date;
  total: number;
  completed: number;
  successCount: number;
  successRate: number;
  adoptionRate: number;
  repeatedRate: number;
  switchedBackRate: number;
  failureRate: number;
  fallbackRate: number;
  averageLatencyMs: number | null;
  p95LatencyMs: number | null;
  intents: InterviewRegenerationIntentMetrics[];
  dimensions: InterviewRegenerationBreakdownMetrics[];
  questionTargets: InterviewRegenerationBreakdownMetrics[];
};

export type InterviewRegenerationMetricsView = Omit<
  InterviewRegenerationMetrics,
  "periodStart" | "periodEnd"
> & {
  periodStart: string;
  periodEnd: string;
};

const INTENTS: InterviewRegenerationIntent[] = [
  "simplify",
  "concretize",
  "change_angle",
  "deepen",
  "lighten"
];

const DIMENSIONS: InterviewDimension[] = [
  "joy",
  "fulfillment",
  "reflection",
  "improvement",
  "gratitude"
];

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function isSuccessfulRegeneration(item: InterviewRegenerationMetricItem) {
  return item.status === "completed"
    && item.answeredAt !== null
    && item.replacedAt === null
    && item.switchedBackAt === null
    && item.downvotedAt === null
    && item.abandonedAt === null;
}

function aggregateBreakdown(
  items: InterviewRegenerationMetricItem[],
  keys: string[],
  readKey: (item: InterviewRegenerationMetricItem) => string | null
) {
  return keys.map((key) => {
    const matching = items.filter((item) => readKey(item) === key);
    const completedItems = matching.filter((item) => item.status === "completed");
    const successCount = completedItems.filter(isSuccessfulRegeneration).length;
    return {
      key,
      total: matching.length,
      completed: completedItems.length,
      successCount,
      successRate: rate(successCount, completedItems.length)
    };
  });
}

export function aggregateInterviewRegenerationMetrics(input: {
  items: InterviewRegenerationMetricItem[];
  periodStart: Date;
  periodEnd: Date;
}): InterviewRegenerationMetrics {
  const completedItems = input.items.filter((item) => item.status === "completed");
  const completed = completedItems.length;
  const successCount = completedItems.filter(isSuccessfulRegeneration).length;
  const adoptedCount = completedItems.filter((item) => item.answeredAt !== null).length;
  const repeatedCount = completedItems.filter((item) => item.replacedAt !== null).length;
  const switchedBackCount = completedItems.filter((item) => item.switchedBackAt !== null).length;
  const failureCount = input.items.filter((item) => item.status === "failed" || item.status === "canceled").length;
  const fallbackCount = completedItems.filter((item) => item.usedFallback).length;
  const latencies = completedItems
    .flatMap((item) => item.latencyMs === null ? [] : [item.latencyMs])
    .sort((left, right) => left - right);
  const averageLatencyMs = latencies.length
    ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
    : null;
  const p95LatencyMs = latencies.length
    ? latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)]
    : null;

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    total: input.items.length,
    completed,
    successCount,
    successRate: rate(successCount, completed),
    adoptionRate: rate(adoptedCount, completed),
    repeatedRate: rate(repeatedCount, completed),
    switchedBackRate: rate(switchedBackCount, completed),
    failureRate: rate(failureCount, input.items.length),
    fallbackRate: rate(fallbackCount, completed),
    averageLatencyMs,
    p95LatencyMs,
    intents: INTENTS.map((intent) => {
      const intentItems = input.items.filter((item) => item.intent === intent);
      const intentCompleted = intentItems.filter((item) => item.status === "completed");
      const intentSuccessCount = intentCompleted.filter(isSuccessfulRegeneration).length;
      return {
        intent,
        total: intentItems.length,
        completed: intentCompleted.length,
        successCount: intentSuccessCount,
        successRate: rate(intentSuccessCount, intentCompleted.length)
      };
    }),
    dimensions: aggregateBreakdown(
      input.items,
      DIMENSIONS,
      (item) => item.dimension
    ),
    questionTargets: aggregateBreakdown(
      input.items,
      Array.from(
        new Set(
          input.items.flatMap((item) => item.questionTarget ? [item.questionTarget] : [])
        )
      ),
      (item) => item.questionTarget
    )
  };
}
