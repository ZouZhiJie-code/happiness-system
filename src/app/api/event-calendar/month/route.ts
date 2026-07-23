import { NextResponse } from "next/server";

import { CalendarApiRequestError, parseCalendarMonthQuery } from "@/features/calendar/api";
import {
  EventCalendarQueryError,
  getEventCalendarMonth
} from "@/server/services/event-calendar/event-calendar.service";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const month = parseCalendarMonthQuery(request);
    return NextResponse.json(await getEventCalendarMonth(user.id, month));
  } catch (error) {
    if (
      (error instanceof CalendarApiRequestError && error.code === "INVALID_CALENDAR_MONTH") ||
      (error instanceof EventCalendarQueryError && error.code === "INVALID_CALENDAR_MONTH")
    ) {
      return NextResponse.json({ error: "INVALID_CALENDAR_MONTH" }, { status: 400 });
    }

    return NextResponse.json({ error: "EVENT_CALENDAR_QUERY_FAILED" }, { status: 500 });
  }
}
