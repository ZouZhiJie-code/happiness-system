import { prisma } from "@/server/db/prisma";
import { formatEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import type { DailyHappinessScoreInput, DailyHappinessScoreRecord } from "@/features/happiness-score/types";

const DEMO_USER_ID = "local-demo-user";

async function ensureDemoUser(database: any) {
  await database.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID
    }
  });
}

export function mapDailyHappinessScore(entry: any): DailyHappinessScoreRecord | null {
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

export async function findDailyHappinessScoreByDate(date: string) {
  const database = prisma as any;
  const entry = await database.dailyHappinessScore?.findUnique?.({
    where: {
      userId_date: {
        userId: DEMO_USER_ID,
        date: parseEntryDateInput(date)
      }
    }
  });

  return mapDailyHappinessScore(entry);
}

export async function listDailyHappinessScoresByDateRange(input: { startDate: string; endDate: string }) {
  const database = prisma as any;
  const entries =
    (await database.dailyHappinessScore?.findMany?.({
      where: {
        userId: DEMO_USER_ID,
        date: {
          gte: parseEntryDateInput(input.startDate),
          lte: parseEntryDateInput(input.endDate)
        }
      },
      orderBy: {
        date: "asc"
      }
    })) ?? [];

  return entries.flatMap((entry: any) => {
    const record = mapDailyHappinessScore(entry);
    return record ? [record] : [];
  });
}

export async function upsertDailyHappinessScore(input: DailyHappinessScoreInput) {
  const database = prisma as any;
  const dateValue = parseEntryDateInput(input.date);
  await ensureDemoUser(database);
  const entry = await database.dailyHappinessScore.upsert({
    where: {
      userId_date: {
        userId: DEMO_USER_ID,
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
      userId: DEMO_USER_ID,
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
