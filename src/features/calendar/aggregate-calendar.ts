import { interviewDimensions } from "@/features/interview/dimensions";
import { buildDailyJournalSourceSignature } from "@/features/daily-journal/source-signature";
import type {
  CalendarAction,
  CalendarDayRecord,
  CalendarDayStatus,
  CalendarDailyJournalSource,
  CalendarDailyJournalStatus,
  CalendarDimensionStatus,
  CalendarEntrySource,
  CalendarMonthRecord,
  CalendarSessionSource,
  CalendarSourceDimension,
  CalendarWeekRecord
} from "@/features/calendar/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

const ACTION_PRIORITY: ReadonlyArray<CalendarAction> = [
  "continue_interview",
  "continue_editing",
  "view_journal",
  "start_interview",
  "edit_saved_journal"
];

const STATUS_PRIORITY: ReadonlyArray<CalendarDayStatus> = [
  "empty",
  "in_progress",
  "draft",
  "completed",
  "mixed"
];

interface AggregateDayInput {
  date: string;
  sessions: CalendarSessionSource[];
  entries: CalendarEntrySource[];
  dailyJournals?: CalendarDailyJournalSource[];
}

interface AggregateWeekInput {
  anchorDate: string;
  dates?: string[];
  sessions: CalendarSessionSource[];
  entries: CalendarEntrySource[];
  dailyJournals?: CalendarDailyJournalSource[];
}

interface AggregateMonthInput {
  month: string;
  sessions: CalendarSessionSource[];
  entries: CalendarEntrySource[];
  dailyJournals?: CalendarDailyJournalSource[];
}

function assertDateString(value: string, fieldName: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}`);
  }
}

function assertMonthString(value: string) {
  if (!MONTH_PATTERN.test(value)) {
    throw new Error("INVALID_MONTH");
  }
}

function parseDateKey(date: string) {
  assertDateString(date, "date");
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(date: string, offset: number) {
  const nextDate = parseDateKey(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + offset);
  return formatDateKey(nextDate);
}

function getWeekStartDate(date: string) {
  const current = parseDateKey(date);
  const dayOfWeek = current.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setUTCDate(current.getUTCDate() + offset);
  return formatDateKey(current);
}

function buildWeekDates(anchorDate: string) {
  const startDate = getWeekStartDate(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(startDate, index));
}

function buildMonthDates(month: string) {
  assertMonthString(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: daysInMonth }, (_, index) =>
    `${month}-${String(index + 1).padStart(2, "0")}`
  );
}

function sortByLatestUpdated<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const timeDiff = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

    if (timeDiff !== 0) {
      return timeDiff;
    }

    return 0;
  });
}

function summarizeContent(content: string) {
  const collapsed = content.replace(/\s+/g, " ").trim();

  if (!collapsed) {
    return null;
  }

  return collapsed.length > 80 ? `${collapsed.slice(0, 80).trimEnd()}...` : collapsed;
}

function uniqueActions(actions: CalendarAction[]) {
  return ACTION_PRIORITY.filter((action) => actions.includes(action));
}

function pickPrimaryAction(actions: CalendarAction[]) {
  return ACTION_PRIORITY.find((action) => actions.includes(action)) ?? null;
}

function resolveDimensionStatus(input: {
  hasSession: boolean;
  hasActiveSession: boolean;
  hasDraftEntry: boolean;
  hasSavedEntry: boolean;
}) {
  const { hasSession, hasActiveSession, hasDraftEntry, hasSavedEntry } = input;

  if (!hasSession && !hasDraftEntry && !hasSavedEntry) {
    return "empty" satisfies CalendarDayStatus;
  }

  const statusKinds = [hasActiveSession, hasDraftEntry, hasSavedEntry].filter(Boolean).length;

  if (statusKinds > 1) {
    return "mixed" satisfies CalendarDayStatus;
  }

  if (hasDraftEntry) {
    return "draft" satisfies CalendarDayStatus;
  }

  if (hasSavedEntry) {
    return "completed" satisfies CalendarDayStatus;
  }

  return "in_progress" satisfies CalendarDayStatus;
}

function buildDimensionActions(input: {
  status: CalendarDayStatus;
  hasActiveSession: boolean;
  hasDraftEntry: boolean;
  hasSavedEntry: boolean;
}) {
  const { status, hasActiveSession, hasDraftEntry, hasSavedEntry } = input;

  if (status === "empty") {
    return ["start_interview"] satisfies CalendarAction[];
  }

  if (status === "in_progress") {
    return ["continue_interview"] satisfies CalendarAction[];
  }

  if (status === "draft") {
    return ["continue_editing"] satisfies CalendarAction[];
  }

  if (status === "completed") {
    return ["view_journal", "edit_saved_journal"] satisfies CalendarAction[];
  }

  return uniqueActions([
    ...(hasActiveSession ? (["continue_interview"] as CalendarAction[]) : []),
    ...(hasDraftEntry ? (["continue_editing"] as CalendarAction[]) : []),
    ...(hasSavedEntry ? (["view_journal", "edit_saved_journal"] as CalendarAction[]) : [])
  ]);
}

function pickPrimaryDimension(dimensions: CalendarDimensionStatus[]) {
  const statusWeight = new Map<CalendarDayStatus, number>([
    ["in_progress", 0],
    ["mixed", 0],
    ["draft", 1],
    ["completed", 2],
    ["empty", 3]
  ]);

  const nonEmptyDimensions = dimensions.filter((dimension) => dimension.status !== "empty");

  if (!nonEmptyDimensions.length) {
    return null;
  }

  return [...nonEmptyDimensions].sort((left, right) => {
    const leftWeight = statusWeight.get(left.status) ?? Number.MAX_SAFE_INTEGER;
    const rightWeight = statusWeight.get(right.status) ?? Number.MAX_SAFE_INTEGER;

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    const updatedDiff =
      new Date(right.latestUpdatedAt ?? 0).getTime() - new Date(left.latestUpdatedAt ?? 0).getTime();

    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return interviewDimensions.indexOf(left.dimension) - interviewDimensions.indexOf(right.dimension);
  })[0];
}

function resolveOverallStatus(dimensions: CalendarDimensionStatus[]) {
  const statuses = dimensions.map((dimension) => dimension.status).filter((status) => status !== "empty");

  if (!statuses.length) {
    return "empty" satisfies CalendarDayStatus;
  }

  if (new Set(statuses).size === 1) {
    return statuses[0];
  }

  return "mixed" satisfies CalendarDayStatus;
}

function resolveDailyJournalStatus(input: {
  date: string;
  entries: CalendarEntrySource[];
  dailyJournals?: CalendarDailyJournalSource[];
}): CalendarDailyJournalStatus {
  const dailyJournal =
    sortByLatestUpdated((input.dailyJournals ?? []).filter((entry) => entry.date === input.date))[0] ?? null;
  const savedEntries = input.entries.filter((entry) => entry.date === input.date && entry.status === "saved");
  const sourceSignature = buildDailyJournalSourceSignature(savedEntries);

  if (!dailyJournal) {
    return {
      state: "none",
      id: null,
      title: null,
      updatedAt: null,
      savedAt: null,
      sourceEntryCount: savedEntries.length
    };
  }

  return {
    state: sourceSignature !== dailyJournal.sourceSignature ? "stale" : dailyJournal.status,
    id: dailyJournal.id,
    title: dailyJournal.title,
    updatedAt: dailyJournal.updatedAt,
    savedAt: dailyJournal.savedAt,
    sourceEntryCount: savedEntries.length
  };
}

export function aggregateCalendarDimension(input: {
  date: string;
  dimension: CalendarSourceDimension;
  sessions: CalendarSessionSource[];
  entries: CalendarEntrySource[];
}): CalendarDimensionStatus {
  assertDateString(input.date, "date");

  const sessions = sortByLatestUpdated(
    input.sessions.filter((session) => session.date === input.date && session.dimension === input.dimension)
  );
  const entries = sortByLatestUpdated(
    input.entries.filter((entry) => entry.date === input.date && entry.dimension === input.dimension)
  );

  const latestSession = sessions[0] ?? null;
  const latestDraftEntry = entries.find((entry) => entry.status === "draft") ?? null;
  const latestSavedEntry = entries.find((entry) => entry.status === "saved") ?? null;
  const latestEntry = latestDraftEntry ?? latestSavedEntry ?? null;
  const hasSession = sessions.length > 0;
  const hasActiveSession = sessions.some((session) => session.status === "active" || session.status === "paused" || (session.status === "completed" && !entries.length));
  const hasDraftEntry = Boolean(latestDraftEntry);
  const hasSavedEntry = Boolean(latestSavedEntry);
  const latestUpdatedAt = [...sessions, ...entries]
    .map((source) => source.updatedAt)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const status = resolveDimensionStatus({
    hasSession,
    hasActiveSession,
    hasDraftEntry,
    hasSavedEntry
  });
  const actions = buildDimensionActions({
    status,
    hasActiveSession,
    hasDraftEntry,
    hasSavedEntry
  });

  return {
    dimension: input.dimension,
    status,
    title: latestEntry?.title ?? null,
    summary: latestEntry ? summarizeContent(latestEntry.content) : latestSession?.draftSummary ?? null,
    latestUpdatedAt,
    sessionId: latestSession?.id ?? latestEntry?.sessionId ?? null,
    journalEntryId: latestEntry?.id ?? null,
    actions,
    hasActiveSession,
    hasDraftEntry,
    hasSavedEntry
  };
}

export function aggregateCalendarDay(input: AggregateDayInput): CalendarDayRecord {
  assertDateString(input.date, "date");

  const dimensions = interviewDimensions.map((dimension) =>
    aggregateCalendarDimension({
      date: input.date,
      dimension,
      sessions: input.sessions,
      entries: input.entries
    })
  );
  const primaryDimension = pickPrimaryDimension(dimensions);

  return {
    date: input.date,
    overallStatus: resolveOverallStatus(dimensions),
    dailyJournal: resolveDailyJournalStatus({
      date: input.date,
      entries: input.entries,
      dailyJournals: input.dailyJournals
    }),
    dimensions,
    activeCount: dimensions.filter((dimension) => dimension.hasActiveSession).length,
    draftCount: dimensions.filter((dimension) => dimension.hasDraftEntry).length,
    savedCount: dimensions.filter((dimension) => dimension.hasSavedEntry).length,
    primaryTitle: primaryDimension?.title ?? null,
    primarySummary: primaryDimension?.summary ?? null,
    latestUpdatedAt:
      [...dimensions]
        .map((dimension) => dimension.latestUpdatedAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null,
    primaryAction: primaryDimension ? pickPrimaryAction(primaryDimension.actions) : null
  };
}

export function aggregateCalendarWeek(input: AggregateWeekInput): CalendarWeekRecord {
  assertDateString(input.anchorDate, "anchor_date");
  const dates = input.dates ? [...input.dates] : buildWeekDates(input.anchorDate);

  if (dates.length !== 7) {
    throw new Error("INVALID_WEEK_DATES");
  }

  dates.forEach((date) => assertDateString(date, "date"));

  return {
    anchorDate: input.anchorDate,
    weekStartDate: dates[0],
    weekEndDate: dates[dates.length - 1],
    days: dates.map((date) =>
      aggregateCalendarDay({
        date,
        sessions: input.sessions,
        entries: input.entries,
        dailyJournals: input.dailyJournals
      })
    )
  };
}

export function aggregateCalendarMonth(input: AggregateMonthInput): CalendarMonthRecord {
  const dates = buildMonthDates(input.month);

  return {
    month: input.month,
    days: dates.map((date) =>
      aggregateCalendarDay({
        date,
        sessions: input.sessions,
        entries: input.entries,
        dailyJournals: input.dailyJournals
      })
    )
  };
}

export const calendarStatusOrder = STATUS_PRIORITY;
export const calendarActionPriority = ACTION_PRIORITY;
