import { prisma } from "@/server/db/prisma";
import { formatEntryDate, getEntryDateRangeBounds } from "@/features/interview/entry-date";
import type { CalendarDailyJournalSource, CalendarEntrySource, CalendarSessionSource } from "@/features/calendar/types";

interface ListCalendarSourcesByDateRangeInput {
  userId: string;
  startDate: string;
  endDate: string;
}

type CalendarDailyJournalEntry = Awaited<ReturnType<typeof prisma.dailyJournalEntry.findMany>>[number];
type CalendarDailyJournalListItem = Pick<
  CalendarDailyJournalEntry,
  "id" | "date" | "status" | "title" | "updatedAt" | "savedAt" | "sourceEntryIds" | "sourceSignature"
>;

function resolveSessionUpdatedAt(session: {
  completedAt: Date | null;
  pausedAt: Date | null;
  startedAt: Date;
  messages?: Array<{ createdAt: Date }>;
}) {
  const lastMessageAt = session.messages?.[0]?.createdAt ?? null;
  const latestTimestamp = Math.max(
    session.startedAt.getTime(),
    session.pausedAt?.getTime() ?? 0,
    session.completedAt?.getTime() ?? 0,
    lastMessageAt?.getTime() ?? 0
  );

  return new Date(latestTimestamp).toISOString();
}

function resolveSessionMessageCount(session: { _count?: { messages?: number } }) {
  return typeof session._count?.messages === "number" ? session._count.messages : undefined;
}

export async function listCalendarSourcesByDateRange(input: ListCalendarSourcesByDateRangeInput) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(input.startDate, input.endDate);

  const [sessions, entries, dailyJournals] = await Promise.all([
    prisma.interviewSession.findMany({
      where: {
        userId: input.userId,
        parentSessionId: null,
        entryDate: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        activeBranchSessionId: true,
        dimension: true,
        entryDate: true,
        status: true,
        _count: {
          select: {
            messages: {
              where: { role: "user" }
            }
          }
        },
        startedAt: true,
        completedAt: true,
        pausedAt: true,
        draftSummary: true,
        finalEntryId: true,
        messages: {
          orderBy: {
            sequence: "desc"
          },
          take: 1,
          select: {
            createdAt: true
          }
        }
      }
    }),
    prisma.joyEntry.findMany({
      where: {
        userId: input.userId,
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        sessionId: true,
        date: true,
        status: true,
        title: true,
        content: true,
        updatedAt: true,
        savedAt: true,
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
        date: {
          gte: startAt,
          lt: endExclusive
        }
      },
      select: {
        id: true,
        date: true,
        status: true,
        title: true,
        updatedAt: true,
        savedAt: true,
        sourceEntryIds: true,
        sourceSignature: true
      }
    })
  ]);

  const activeBranchIds = sessions.flatMap((session) =>
    session.activeBranchSessionId && session.activeBranchSessionId !== session.id
      ? [session.activeBranchSessionId]
      : []
  );
  const branchSessions = activeBranchIds.length
    ? await prisma.interviewSession.findMany({
        where: {
          rootSessionId: { in: sessions.map((session) => session.id) }
        },
        select: {
          id: true,
          rootSessionId: true,
          status: true,
          startedAt: true,
          completedAt: true,
          pausedAt: true,
          draftSummary: true,
          _count: {
            select: {
              messages: {
                where: { role: "user" }
              }
            }
          },
          messages: {
            orderBy: { sequence: "desc" },
            take: 1,
            select: { createdAt: true }
          }
        }
      })
    : [];
  const activeBranchesById = new Map(branchSessions.map((branch) => [branch.id, branch]));
  const branchUserMessageCounts = new Map<string, number>();
  for (const branch of branchSessions) {
    if (!branch.rootSessionId) continue;
    branchUserMessageCounts.set(
      branch.rootSessionId,
      (branchUserMessageCounts.get(branch.rootSessionId) ?? 0) +
        (resolveSessionMessageCount(branch) ?? 0)
    );
  }

  const calendarSessions: CalendarSessionSource[] = sessions
    .filter((session) => {
      const projected = session.activeBranchSessionId
        ? activeBranchesById.get(session.activeBranchSessionId)
        : null;
      return (projected?.status ?? session.status) !== "abandoned";
    })
    .map((session) => {
      const projected = session.activeBranchSessionId
        ? activeBranchesById.get(session.activeBranchSessionId)
        : null;
      const rootUserMessageCount = resolveSessionMessageCount(session);
      const effectiveUserMessageCount = projected
        ? branchUserMessageCounts.get(session.id) ?? 0
        : rootUserMessageCount ?? 0;
      const messageCount =
        projected || typeof rootUserMessageCount === "number"
          ? effectiveUserMessageCount > 0 ? 2 : 1
          : undefined;

      return {
        kind: "session" as const,
        id: session.id,
        dimension: session.dimension,
        date: formatEntryDate(session.entryDate ?? session.startedAt),
        status: projected?.status ?? session.status,
        ...(typeof messageCount === "number" ? { messageCount } : {}),
        updatedAt: resolveSessionUpdatedAt(projected ?? session),
        startedAt: session.startedAt.toISOString(),
        completedAt: (projected?.completedAt ?? session.completedAt)?.toISOString() ?? null,
        pausedAt: (projected?.pausedAt ?? session.pausedAt)?.toISOString() ?? null,
        draftSummary: projected?.draftSummary ?? session.draftSummary,
        journalEntryId: session.finalEntryId
      };
    });

  const calendarEntries: CalendarEntrySource[] = entries.flatMap((entry) => {
    if (!entry.session?.dimension) {
      return [];
    }

    return [
      {
        kind: "entry" as const,
        id: entry.id,
        sessionId: entry.sessionId,
        dimension: entry.session.dimension,
        date: formatEntryDate(entry.date),
        status: entry.status,
        title: entry.title,
        content: entry.content,
        updatedAt: entry.updatedAt.toISOString(),
        savedAt: entry.savedAt?.toISOString() ?? null
      }
    ];
  });

  const calendarDailyJournals: CalendarDailyJournalSource[] = dailyJournals.map((entry: CalendarDailyJournalListItem) => ({
    kind: "daily_journal" as const,
    id: entry.id,
    date: formatEntryDate(entry.date),
    status: entry.status,
    title: entry.title,
    updatedAt: entry.updatedAt.toISOString(),
    savedAt: entry.savedAt?.toISOString() ?? null,
    sourceEntryIds: entry.sourceEntryIds ?? [],
    sourceSignature: entry.sourceSignature
  }));

  return {
    sessions: calendarSessions,
    entries: calendarEntries,
    dailyJournals: calendarDailyJournals
  };
}

export async function listCalendarSourcesByDate(userId: string, date: string) {
  return listCalendarSourcesByDateRange({
    userId,
    startDate: date,
    endDate: date
  });
}
