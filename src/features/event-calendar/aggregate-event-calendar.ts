import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";
import type {
  AggregateEventCalendarDayInput,
  AggregateEventCalendarMonthInput,
  AggregateEventCalendarWeekInput,
  EventCalendarAction,
  EventCalendarDailyJournalSource,
  EventCalendarDailyJournalStatus,
  EventCalendarDayRecord,
  EventCalendarDayStatus,
  EventCalendarEventEntrySource,
  EventCalendarEventRecord,
  EventCalendarEventSource,
  EventCalendarMonthRecord,
  EventCalendarWeekRecord
} from "@/types/event-calendar";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** 页面主动作与产品约定一致：先继续，再编辑，再查看，最后开始新记录。 */
export const eventCalendarActionPriority: ReadonlyArray<EventCalendarAction> = [
  "continue_event",
  "view_generation_state",
  "continue_event_entry_editing",
  "view_event_entry",
  "continue_daily_journal_editing",
  "view_daily_journal",
  "update_daily_journal",
  "generate_daily_journal",
  "start_event"
];

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
  const next = parseDateKey(date);
  next.setUTCDate(next.getUTCDate() + offset);
  return formatDateKey(next);
}

function buildWeekDates(anchorDate: string) {
  const current = parseDateKey(anchorDate);
  const dayOfWeek = current.getUTCDay();
  current.setUTCDate(current.getUTCDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
  const weekStart = formatDateKey(current);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function buildMonthDates(month: string) {
  assertMonthString(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function sortByEventSequence(events: EventCalendarEventSource[]) {
  return [...events].sort((left, right) => {
    const sequenceDiff = left.daySequence - right.daySequence;
    return sequenceDiff !== 0 ? sequenceDiff : left.eventId.localeCompare(right.eventId);
  });
}

function sortByLatestUpdated<T extends { updatedAt: string }>(sources: T[]) {
  return [...sources].sort((left, right) => {
    const updatedDiff = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    return updatedDiff !== 0 ? updatedDiff : 0;
  });
}

function summarizeContent(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > 80 ? `${normalized.slice(0, 80).trimEnd()}...` : normalized;
}

function uniqueActions(actions: EventCalendarAction[]) {
  return eventCalendarActionPriority.filter((action) => actions.includes(action));
}

function toEventRecord(
  event: EventCalendarEventSource,
  entry: EventCalendarEventEntrySource | null
): EventCalendarEventRecord {
  const state =
    event.status === "active"
      ? "active"
      : event.status === "generating"
        ? "generating"
        : entry?.status ?? "completed";
  const actions =
    state === "active"
      ? (["continue_event"] satisfies EventCalendarAction[])
      : state === "generating"
        ? (["view_generation_state"] satisfies EventCalendarAction[])
      : state === "draft" || state === "modified"
        ? (["continue_event_entry_editing"] satisfies EventCalendarAction[])
        : state === "saved"
          ? (["view_event_entry"] satisfies EventCalendarAction[])
          : [];

  return {
    eventId: event.eventId,
    rootSessionId: event.rootSessionId,
    activeBranchSessionId: event.activeBranchSessionId,
    entryDate: event.entryDate,
    daySequence: event.daySequence,
    eventStatus: event.status,
    entryId: entry?.entryId ?? null,
    entryStatus: entry?.status ?? null,
    state,
    title: entry?.title ?? null,
    summary: entry ? summarizeContent(entry.content) : null,
    latestUpdatedAt: entry && new Date(entry.updatedAt).getTime() > new Date(event.updatedAt).getTime()
      ? entry.updatedAt
      : event.updatedAt,
    actions
  };
}

function buildDailyJournalStatus(input: {
  date: string;
  eventEntries: EventCalendarEventEntrySource[];
  dailyJournals?: EventCalendarDailyJournalSource[];
}): EventCalendarDailyJournalStatus {
  const currentEntries = input.eventEntries;
  const pendingSaveEntryIds: string[] = [];
  const collection =
    currentEntries.length === 0
      ? "empty"
      : currentEntries.length === 1
        ? "single_entry"
        : "multiple_entries";
  const currentSignature = buildJournalDailySourceSignature(
    currentEntries.map((entry) => ({
      entryId: entry.entryId,
      daySequence: entry.daySequence,
      contentRevision: entry.contentRevision
    }))
  );
  const dailyJournal = sortByLatestUpdated(
    (input.dailyJournals ?? []).filter((item) => item.entryDate === input.date)
  )[0] ?? null;
  const freshness = !dailyJournal
    ? "none"
    : dailyJournal.sourceSignature === currentSignature
      ? dailyJournal.status
      : "stale";
  const pendingSave = false;
  const updateBlockedByPendingSave = false;
  const actions: EventCalendarAction[] = [];

  if (collection !== "empty") {
    if (freshness === "none") {
      actions.push("generate_daily_journal");
    } else if (freshness === "draft" || freshness === "modified") {
      actions.push("continue_daily_journal_editing");
    } else if (freshness === "saved") {
      actions.push("view_daily_journal");
    } else if (freshness === "stale") {
      actions.push("update_daily_journal");
    }
  }

  return {
    collection,
    freshness,
    entryId: dailyJournal?.entryId ?? null,
    title: dailyJournal?.title ?? null,
    sourceEntryCount: currentEntries.length,
    pendingSaveEntryIds,
    pendingSave,
    updateBlockedByPendingSave,
    directEntryId: null,
    actions: uniqueActions(actions)
  };
}

function resolveDayStatus(events: EventCalendarEventRecord[]): EventCalendarDayStatus {
  if (!events.length) {
    return "empty";
  }

  const kinds = new Set(
    events.map((event) => {
      if (event.state === "active") return "in_progress";
      if (event.state === "generating") return "generating";
      if (event.state === "draft" || event.state === "modified") return "draft";
      if (event.state === "saved" || event.state === "completed") return "completed";
      return "empty";
    })
  );

  return kinds.size === 1 ? [...kinds][0]! : "mixed";
}

export function aggregateEventCalendarDay(input: AggregateEventCalendarDayInput): EventCalendarDayRecord {
  assertDateString(input.date, "date");
  const events = sortByEventSequence(input.events.filter((event) => event.entryDate === input.date));
  const eventIds = new Set(events.map((event) => event.eventId));
  const eventEntries = input.entries.filter(
    (entry) => entry.entryDate === input.date && eventIds.has(entry.eventId)
  );
  const eventRecords = events.map((event) => {
    const entry = sortByLatestUpdated(eventEntries.filter((candidate) => candidate.eventId === event.eventId))[0] ?? null;
    return toEventRecord(event, entry);
  });
  const dailyJournal = buildDailyJournalStatus({
    date: input.date,
    eventEntries,
    dailyJournals: input.dailyJournals
  });
  const eventActions = eventRecords.flatMap((event) => event.actions);
  const actions = uniqueActions([...eventActions, ...dailyJournal.actions]);
  const allUpdates = [
    ...eventRecords.map((event) => event.latestUpdatedAt),
    ...(dailyJournal.entryId
      ? (input.dailyJournals ?? [])
          .filter((daily) => daily.entryId === dailyJournal.entryId)
          .map((daily) => daily.updatedAt)
      : [])
  ];

  if (eventRecords.length === 0) {
    actions.push("start_event");
  }

  return {
    date: input.date,
    overallStatus: resolveDayStatus(eventRecords),
    events: eventRecords,
    dailyJournal,
    activeEventCount: eventRecords.filter((event) => event.state === "active").length,
    generatingEventCount: eventRecords.filter((event) => event.state === "generating").length,
    pendingSaveEntryCount: eventRecords.filter(
      (event) => event.entryStatus === "draft" || event.entryStatus === "modified"
    ).length,
    savedEntryCount: eventRecords.filter((event) => event.entryStatus === "saved").length,
    primaryAction: uniqueActions(actions)[0] ?? null,
    latestUpdatedAt: allUpdates.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null
  };
}

export function aggregateEventCalendarWeek(input: AggregateEventCalendarWeekInput): EventCalendarWeekRecord {
  assertDateString(input.anchorDate, "anchor_date");
  const dates = input.dates ? [...input.dates] : buildWeekDates(input.anchorDate);
  if (dates.length !== 7) {
    throw new Error("INVALID_WEEK_DATES");
  }
  dates.forEach((date) => assertDateString(date, "date"));

  return {
    anchorDate: input.anchorDate,
    weekStartDate: dates[0]!,
    weekEndDate: dates[dates.length - 1]!,
    days: dates.map((date) => aggregateEventCalendarDay({ ...input, date }))
  };
}

export function aggregateEventCalendarMonth(input: AggregateEventCalendarMonthInput): EventCalendarMonthRecord {
  const dates = buildMonthDates(input.month);
  return {
    month: input.month,
    days: dates.map((date) => aggregateEventCalendarDay({ ...input, date }))
  };
}
