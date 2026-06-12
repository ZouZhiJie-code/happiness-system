import { prisma } from "@/server/db/prisma";
import { formatEntryDate, getEntryDateRangeBounds } from "@/features/interview/entry-date";
import { interviewJournalPayloadSchema } from "@/features/interview/schema/interview.schema";
import type { AnalysisSavedDailyJournalSource, AnalysisSavedEntrySource } from "@/features/analysis/types";

interface ListAnalysisSourcesByDateRangeInput {
  userId: string;
  startDate: string;
  endDate: string;
}

type AnalysisDailyJournalEntry = Awaited<ReturnType<typeof prisma.dailyJournalEntry.findMany>>[number];
type AnalysisDailyJournalListItem = Pick<AnalysisDailyJournalEntry, "id" | "date" | "sourceSignature" | "title" | "content">;

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
        userId: input.userId,
        status: "saved",
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        date: true,
        title: true,
        content: true,
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
    prisma.dailyJournalEntry.findMany({
      where: {
        userId: input.userId,
        status: "saved",
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        date: true,
        sourceSignature: true,
        title: true,
        content: true
      }
    })
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
        title: entry.title,
        content: entry.content,
        tags: entry.tags ?? [],
        payload: parseAnalysisEntryPayload(entry.payload),
        savedAt: entry.savedAt?.toISOString() ?? null,
        updatedAt: entry.updatedAt.toISOString()
      }
    ];
  });

  const savedDailyJournals: AnalysisSavedDailyJournalSource[] = dailyJournals.map((entry: AnalysisDailyJournalListItem) => ({
    id: entry.id,
    date: formatEntryDate(entry.date),
    sourceSignature: entry.sourceSignature,
    title: entry.title ?? null,
    content: entry.content ?? null
  }));

  return {
    entries: savedEntries,
    dailyJournals: savedDailyJournals
  };
}
