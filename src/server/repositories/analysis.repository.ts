import { prisma } from "@/server/db/prisma";
import { formatEntryDate, getEntryDateRangeBounds } from "@/features/interview/entry-date";
import { interviewJournalPayloadSchema } from "@/features/interview/schema/interview.schema";
import type { AnalysisSavedDailyJournalSource, AnalysisSavedEntrySource } from "@/features/analysis/types";

const DEMO_USER_ID = "local-demo-user";

interface ListAnalysisSourcesByDateRangeInput {
  startDate: string;
  endDate: string;
}

function parseAnalysisEntryPayload(payload: unknown) {
  const parsed = interviewJournalPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  if (parsed.data.kind === "joy") {
    return {
      ...parsed.data,
      psychProfile: parsed.data.psychProfile ?? undefined
    };
  }

  return parsed.data;
}

export async function listAnalysisSourcesByDateRange(input: ListAnalysisSourcesByDateRangeInput) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);

  const [entries, dailyJournals] = await Promise.all([
    prisma.joyEntry.findMany({
      where: {
        userId: DEMO_USER_ID,
        status: "saved",
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        date: true,
        tags: true,
        payload: true,
        savedAt: true,
        updatedAt: true,
        session: {
          select: {
            dimension: true
          }
        }
      }
    }),
    (prisma as any).dailyJournalEntry?.findMany?.({
      where: {
        userId: DEMO_USER_ID,
        status: "saved",
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        date: true,
        sourceSignature: true
      }
    }) ?? Promise.resolve([])
  ]);

  const savedEntries: AnalysisSavedEntrySource[] = entries.flatMap((entry) => {
    if (!entry.session?.dimension) {
      return [];
    }

    return [
      {
        id: entry.id,
        date: formatEntryDate(entry.date),
        dimension: entry.session.dimension,
        tags: entry.tags ?? [],
        payload: parseAnalysisEntryPayload(entry.payload),
        savedAt: entry.savedAt?.toISOString() ?? null,
        updatedAt: entry.updatedAt.toISOString()
      }
    ];
  });

  const savedDailyJournals: AnalysisSavedDailyJournalSource[] = dailyJournals.map((entry: any) => ({
    id: entry.id,
    date: formatEntryDate(entry.date),
    sourceSignature: entry.sourceSignature
  }));

  return {
    entries: savedEntries,
    dailyJournals: savedDailyJournals
  };
}
