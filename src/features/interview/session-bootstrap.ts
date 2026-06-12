import type { CalendarDayRecord } from "@/features/calendar/types";
import {
  clearStoredInterviewSessionId,
  getStoredInterviewFreshStartEntry,
  getStoredInterviewSessionEntry,
  interviewDimensions
} from "@/features/interview/dimensions";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import type { InterviewDimension, InterviewSessionRecord } from "@/types/interview";

const interviewBootstrapTasks = new Map<string, Promise<InterviewSessionRecord>>();

export function buildInterviewBootstrapTaskKey(input: {
  dimension: InterviewDimension;
  forceNew?: boolean;
  explicitSessionId?: string | null;
  entryDate?: string | null;
}) {
  return [input.dimension, input.forceNew ? "force" : "reuse", input.explicitSessionId ?? "", input.entryDate ?? ""].join("::");
}

async function requestInterviewSession(dimension: InterviewDimension, entryDate?: string | null) {
  const response = await fetch("/api/interview/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dimension,
      ...(entryDate ? { entryDate } : {})
    })
  });

  if (!response.ok) {
    throw new Error("INTERVIEW_START_FAILED");
  }

  const data = (await response.json()) as { session: InterviewSessionRecord };
  return data.session;
}

export async function fetchInterviewSession(sessionId: string) {
  const response = await fetch(`/api/interview/session/${sessionId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return (await response.json()) as InterviewSessionRecord;
}

async function findPreferredSessionFromDaySnapshot(
  dimension: InterviewDimension,
  entryDate: string,
  excludedSessionId?: string | null
) {
  try {
    const response = await fetch(`/api/calendar/day?date=${entryDate}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const day = (await response.json()) as CalendarDayRecord;
    const dimensionStatus = day.dimensions.find((item) => item.dimension === dimension);
    const candidateSessionId =
      dimensionStatus?.savedSessionId ??
      dimensionStatus?.draftSessionId ??
      dimensionStatus?.activeSessionId ??
      dimensionStatus?.sessionId ??
      null;

    if (!candidateSessionId || candidateSessionId === excludedSessionId) {
      return null;
    }

    const candidateSession = await fetchInterviewSession(candidateSessionId);

    return isRestorableSession(candidateSession, dimension) && candidateSession.entryDate === entryDate
      ? candidateSession
      : null;
  } catch {
    return null;
  }
}

async function reopenInterviewSession(sessionId: string) {
  const response = await fetch("/api/interview/session/reopen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  });

  if (!response.ok) {
    throw new Error("SESSION_REOPEN_FAILED");
  }

  const data = (await response.json()) as { session: InterviewSessionRecord };
  return data.session;
}

function isRestorableSession(session: InterviewSessionRecord, dimension: InterviewDimension) {
  if (session.dimension !== dimension) {
    return false;
  }

  return session.status === "active" || session.status === "paused" || session.status === "completed";
}

function isOpeningOnlySession(session: InterviewSessionRecord) {
  return session.status === "active" && session.turnCount === 0 && !session.journalEntry;
}

export async function bootstrapInterviewSession(input: {
  dimension: InterviewDimension;
  forceNew?: boolean;
  explicitSessionId?: string | null;
  entryDate?: string | null;
}) {
  const { dimension, forceNew = false, explicitSessionId = null, entryDate = null } = input;
  const targetEntryDate = entryDate ?? getTodayEntryDate();
  const taskKey = buildInterviewBootstrapTaskKey({
    dimension,
    forceNew,
    explicitSessionId,
    entryDate
  });

  if (!forceNew) {
    const existingTask = interviewBootstrapTasks.get(taskKey);

    if (existingTask) {
      return existingTask;
    }
  }

  const task = (async () => {
    if (explicitSessionId) {
      const explicitSession = await fetchInterviewSession(explicitSessionId);

      if (!isRestorableSession(explicitSession, explicitSession.dimension)) {
        throw new Error("SESSION_NOT_FOUND");
      }

      if (explicitSession.status === "paused") {
        return reopenInterviewSession(explicitSession.id);
      }

      return explicitSession;
    }

    const freshStartEntry = getStoredInterviewFreshStartEntry(dimension);

    if (freshStartEntry && (!entryDate || freshStartEntry.entryDate === targetEntryDate)) {
      return requestInterviewSession(dimension, entryDate);
    }

    if (!forceNew) {
      const storedSessionEntry = getStoredInterviewSessionEntry(dimension);
      const storedSessionId = storedSessionEntry?.sessionId ?? null;

      if (storedSessionId) {
        if (!entryDate && storedSessionEntry?.entryDate && storedSessionEntry.entryDate !== targetEntryDate) {
          clearStoredInterviewSessionId(dimension);
          return requestInterviewSession(dimension, entryDate);
        }

        try {
          const restoredSession = await fetchInterviewSession(storedSessionId);

          if (isRestorableSession(restoredSession, dimension) && restoredSession.entryDate === targetEntryDate) {
            if (isOpeningOnlySession(restoredSession)) {
              const preferredSession = await findPreferredSessionFromDaySnapshot(
                dimension,
                targetEntryDate,
                restoredSession.id
              );

              if (preferredSession) {
                return preferredSession.status === "paused"
                  ? reopenInterviewSession(preferredSession.id)
                  : preferredSession;
              }
            }

            if (restoredSession.status === "paused") {
              return reopenInterviewSession(restoredSession.id);
            }

            return restoredSession;
          }
        } catch {
          if (!entryDate) {
            clearStoredInterviewSessionId(dimension);
          }
        }

        if (!entryDate) {
          clearStoredInterviewSessionId(dimension);
        }
      }
    }

    if (!forceNew && entryDate) {
      const preferredSession = await findPreferredSessionFromDaySnapshot(dimension, targetEntryDate);

      if (preferredSession) {
        return preferredSession.status === "paused"
          ? reopenInterviewSession(preferredSession.id)
          : preferredSession;
      }
    }

    return requestInterviewSession(dimension, entryDate);
  })().finally(() => {
    interviewBootstrapTasks.delete(taskKey);
  });

  interviewBootstrapTasks.set(taskKey, task);
  return task;
}

export function clearInterviewBootstrapTasks() {
  interviewBootstrapTasks.clear();
}

export function prefetchInterviewSession(input: {
  dimension: InterviewDimension;
  entryDate?: string | null;
}) {
  void bootstrapInterviewSession(input).catch(() => undefined);
}

export function prefetchStoredInterviewSessions(entryDate?: string | null) {
  const todayEntryDate = getTodayEntryDate();
  const normalizedEntryDate = entryDate && entryDate !== todayEntryDate ? entryDate : null;

  interviewDimensions.forEach((dimension) => {
    prefetchInterviewSession({
      dimension,
      entryDate: normalizedEntryDate
    });
  });
}
