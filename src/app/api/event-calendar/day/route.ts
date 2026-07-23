import { NextResponse } from "next/server";

import { CalendarApiRequestError, parseCalendarDateQuery } from "@/features/calendar/api";
import {
  EventCalendarQueryError,
  getEventCalendarDay
} from "@/server/services/event-calendar/event-calendar.service";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const date = parseCalendarDateQuery(request);
    return NextResponse.json(await getEventCalendarDay(user.id, date));
  } catch (error) {
    if (
      (error instanceof CalendarApiRequestError && error.code === "INVALID_CALENDAR_DATE") ||
      (error instanceof EventCalendarQueryError && error.code === "INVALID_CALENDAR_DATE")
    ) {
      return NextResponse.json({ error: "INVALID_CALENDAR_DATE" }, { status: 400 });
    }

    return NextResponse.json({ error: "EVENT_CALENDAR_QUERY_FAILED" }, { status: 500 });
  }
}
