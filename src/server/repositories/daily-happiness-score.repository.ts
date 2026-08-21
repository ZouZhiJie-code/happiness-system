import { prisma } from "@/server/db/prisma";
import { formatEntryDate, getEntryDateRangeBounds, parseEntryDateInput } from "@/features/interview/entry-date";
import type { DailyHappinessScoreInput, DailyHappinessScoreRecord } from "@/features/happiness-score/types";

type DailyHappinessScoreListItem = NonNullable<Awaited<ReturnType<typeof prisma.dailyHappinessScore.findMany>>[number]>;
type DailyHappinessScoreMappedEntry = Pick<
  DailyHappinessScoreListItem,
  | "id"
  | "date"
  | "meaningScore"
  | "healthScore"
  | "virtueScore"
  | "autonomyScore"
  | "interestScore"
  | "skillScore"
  | "relationshipScore"
  | "livingConditionScore"
  | "createdAt"
  | "updatedAt"
>;

export function mapDailyHappinessScore(entry: DailyHappinessScoreMappedEntry | null): DailyHappinessScoreRecord | null {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    date: formatEntryDate(entry.date),
    meaningScore: entry.meaningScore,
    healthScore: entry.healthScore,
    virtueScore: entry.virtueScore,
    autonomyScore: entry.autonomyScore,
    interestScore: entry.interestScore,
    skillScore: entry.skillScore,
    relationshipScore: entry.relationshipScore,
    livingConditionScore: entry.livingConditionScore,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

export async function findDailyHappinessScoreByDate(userId: string, date: string) {
  const entry = await prisma.dailyHappinessScore.findUnique({
    where: {
      userId_date: {
        userId,
        date: parseEntryDateInput(date)
      }
    }
  });

  return mapDailyHappinessScore(entry);
}

export async function listDailyHappinessScoresByDateRange(userId: string, input: { startDate: string; endDate: string }) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);
  const entries = await prisma.dailyHappinessScore.findMany({
    where: {
      userId,
      date: {
        gte: startAt,
        lt: endExclusive
      }
    },
    orderBy: {
      date: "asc"
    }
  });

  return entries.flatMap((entry) => {
    const record = mapDailyHappinessScore(entry);
    return record ? [record] : [];
  });
}

export async function upsertDailyHappinessScore(userId: string, input: DailyHappinessScoreInput) {
  const dateValue = parseEntryDateInput(input.date);
  const entry = await prisma.dailyHappinessScore.upsert({
    where: {
      userId_date: {
        userId,
        date: dateValue
      }
    },
    update: {
      meaningScore: input.meaningScore,
      healthScore: input.healthScore,
      virtueScore: input.virtueScore,
      autonomyScore: input.autonomyScore,
      interestScore: input.interestScore,
      skillScore: input.skillScore,
      relationshipScore: input.relationshipScore,
      livingConditionScore: input.livingConditionScore
    },
    create: {
      userId,
      date: dateValue,
      meaningScore: input.meaningScore,
      healthScore: input.healthScore,
      virtueScore: input.virtueScore,
      autonomyScore: input.autonomyScore,
      interestScore: input.interestScore,
      skillScore: input.skillScore,
      relationshipScore: input.relationshipScore,
      livingConditionScore: input.livingConditionScore
    }
  });

  return mapDailyHappinessScore(entry);
}
