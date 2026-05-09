import type { InterviewDimension, MemoryFact } from "@prisma/client";

import { findAllMemoryFacts } from "@/server/repositories/memory.repository";
import { listCalendarSourcesByDateRange } from "@/server/repositories/calendar.repository";
import { listAnalysisSourcesByDateRange } from "@/server/repositories/analysis.repository";
import { listDailyHappinessScoresByDateRange } from "@/server/repositories/daily-happiness-score.repository";
import type { CalendarSessionSource } from "@/features/calendar/types";
import type { DailyHappinessScoreRecord } from "@/features/happiness-score/types";

const DEMO_USER_ID = "local-demo-user";
const ALL_DIMENSIONS: InterviewDimension[] = [
  "joy",
  "fulfillment",
  "reflection",
  "improvement",
  "gratitude"
];

const SCORE_KEYS: (keyof Pick<
  DailyHappinessScoreRecord,
  | "meaningScore"
  | "healthScore"
  | "virtueScore"
  | "autonomyScore"
  | "interestScore"
  | "skillScore"
  | "relationshipScore"
  | "livingConditionScore"
>)[] = [
  "meaningScore",
  "healthScore",
  "virtueScore",
  "autonomyScore",
  "interestScore",
  "skillScore",
  "relationshipScore",
  "livingConditionScore"
];

export interface PortraitData {
  facts: MemoryFact[];
  calendarSummary: {
    dimensionFrequency: Record<InterviewDimension, number>;
    totalRecordDays: number;
    recentMonthRecordDays: number;
  };
  analysisSummary: {
    recentMonths: number;
    totalSavedEntries: number;
    dimensionBreakdown: Record<InterviewDimension, number>;
  };
  scoreTrend: {
    days: number;
    average: Record<string, number> | null;
    latest: Record<string, number> | null;
    trend: "rising" | "stable" | "declining" | "insufficient";
  };
  interviewMeta: {
    totalSessions: number;
    dimensionCoverage: InterviewDimension[];
    dateRange: { first: string | null; last: string | null };
  };
}

function averageScoreOf(record: DailyHappinessScoreRecord): number {
  let sum = 0;
  for (const key of SCORE_KEYS) {
    sum += record[key] ?? 0;
  }
  return sum / SCORE_KEYS.length;
}

export async function gatherPortraitData(userId?: string): Promise<PortraitData> {
  const uid = userId || DEMO_USER_ID;

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const startDate = threeMonthsAgo.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);

  const [facts, calendarSources, analysisSources, scoreRecords] = await Promise.all([
    findAllMemoryFacts(uid),
    listCalendarSourcesByDateRange({ startDate, endDate }),
    listAnalysisSourcesByDateRange({ startDate, endDate }),
    listDailyHappinessScoresByDateRange({ startDate, endDate })
  ]);

  // Calendar summary: dimension frequency and record days
  const dimensionFrequency = {} as Record<InterviewDimension, number>;
  for (const dim of ALL_DIMENSIONS) dimensionFrequency[dim] = 0;

  const sessionDates = new Set<string>();
  for (const session of calendarSources.sessions) {
    const dim = session.dimension as InterviewDimension;
    if (dim in dimensionFrequency) {
      dimensionFrequency[dim]++;
    }
    sessionDates.add(session.date);
  }

  const recentMonthStart = new Date(now);
  recentMonthStart.setMonth(recentMonthStart.getMonth() - 1);
  const recentMonthStartStr = recentMonthStart.toISOString().slice(0, 10);
  const recentMonthRecordDays = [...sessionDates].filter((d) => d >= recentMonthStartStr).length;

  // Analysis summary
  const analysisDimensionBreakdown = {} as Record<InterviewDimension, number>;
  for (const dim of ALL_DIMENSIONS) analysisDimensionBreakdown[dim] = 0;
  for (const entry of analysisSources.entries) {
    const dim = entry.dimension as InterviewDimension;
    if (dim in analysisDimensionBreakdown) {
      analysisDimensionBreakdown[dim]++;
    }
  }

  // Score trend
  let averageScores: Record<string, number> | null = null;
  let latestScores: Record<string, number> | null = null;
  let trend: PortraitData["scoreTrend"]["trend"] = "insufficient";

  if (scoreRecords.length >= 2) {
    // Average across all records
    const sums: Record<string, number> = {};
    for (const key of SCORE_KEYS) sums[key] = 0;
    for (const record of scoreRecords) {
      for (const key of SCORE_KEYS) {
        sums[key] += record[key] ?? 0;
      }
    }
    averageScores = {};
    for (const key of SCORE_KEYS) {
      averageScores[key] = Math.round((sums[key] / scoreRecords.length) * 10) / 10;
    }

    // Latest record
    const latest = scoreRecords[scoreRecords.length - 1];
    latestScores = {};
    for (const key of SCORE_KEYS) {
      latestScores[key] = latest[key] ?? 0;
    }

    // Trend: compare first half average to second half average
    const mid = Math.floor(scoreRecords.length / 2);
    const firstHalf = scoreRecords.slice(0, mid);
    const secondHalf = scoreRecords.slice(mid);
    const avgFirst =
      firstHalf.reduce((sum: number, r: DailyHappinessScoreRecord) => sum + averageScoreOf(r), 0) / firstHalf.length;
    const avgSecond =
      secondHalf.reduce((sum: number, r: DailyHappinessScoreRecord) => sum + averageScoreOf(r), 0) / secondHalf.length;
    const diff = avgSecond - avgFirst;
    trend = diff > 0.3 ? "rising" : diff < -0.3 ? "declining" : "stable";
  }

  // Interview meta
  const sortedSessionDates = [...sessionDates].sort();
  const dimCoverage = [
    ...new Set(
      calendarSources.sessions.map((s) => s.dimension as InterviewDimension)
    )
  ];

  return {
    facts,
    calendarSummary: {
      dimensionFrequency,
      totalRecordDays: sessionDates.size,
      recentMonthRecordDays
    },
    analysisSummary: {
      recentMonths: 3,
      totalSavedEntries: analysisSources.entries.length,
      dimensionBreakdown: analysisDimensionBreakdown
    },
    scoreTrend: {
      days: scoreRecords.length,
      average: averageScores,
      latest: latestScores,
      trend
    },
    interviewMeta: {
      totalSessions: calendarSources.sessions.length,
      dimensionCoverage: dimCoverage,
      dateRange: {
        first: sortedSessionDates[0] ?? null,
        last: sortedSessionDates[sortedSessionDates.length - 1] ?? null
      }
    }
  };
}
