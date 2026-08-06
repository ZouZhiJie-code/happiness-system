import { isEntryDateString, parseEntryDateInput } from "@/features/interview/entry-date";
import { resolveJournalDayMode } from "@/server/repositories/journal-day-mode.repository";

export type CalendarReadRoute = "empty" | "legacy" | "event_centered" | "dual";

export class CalendarReadRouteError extends Error {
  constructor(
    readonly code: "INVALID_CALENDAR_DATE" | "CALENDAR_READ_ROUTE_FAILED",
    message?: string,
    readonly cause?: unknown
  ) {
    super(message ?? code);
    this.name = "CalendarReadRouteError";
  }
}

function assertCalendarDate(date: string) {
  if (!isEntryDateString(date)) {
    throw new CalendarReadRouteError("INVALID_CALENDAR_DATE");
  }

  try {
    parseEntryDateInput(date);
  } catch {
    throw new CalendarReadRouteError("INVALID_CALENDAR_DATE");
  }
}

/**
 * The locator deliberately returns a route, not a merged day record. Callers
 * then read one independent calendar model, or show two explicit read-only
 * entries for a historical mixed date.
 */
export async function getCalendarReadRoute(userId: string, date: string): Promise<CalendarReadRoute> {
  assertCalendarDate(date);

  try {
    const resolved = await resolveJournalDayMode(userId, date);
    if (resolved.kind === "unclaimed") return "empty";
    if (resolved.kind === "mixed") return "dual";
    return resolved.ownership.primaryMode === "event_centered" ? "event_centered" : "legacy";
  } catch (error) {
    if (error instanceof CalendarReadRouteError) throw error;
    throw new CalendarReadRouteError("CALENDAR_READ_ROUTE_FAILED", undefined, error);
  }
}
