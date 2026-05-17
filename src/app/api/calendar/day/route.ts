import { NextResponse } from "next/server";

import { CalendarApiRequestError, parseCalendarDateQuery } from "@/features/calendar/api";
import { CalendarQueryError, getCalendarDay } from "@/server/services/calendar/calendar.service";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const date = parseCalendarDateQuery(request);
    const payload = await getCalendarDay(user.id, date);

    return NextResponse.json(payload);
  } catch (error) {
    if (
      (error instanceof CalendarApiRequestError && error.code === "INVALID_CALENDAR_DATE") ||
      (error instanceof CalendarQueryError && error.code === "INVALID_CALENDAR_DATE")
    ) {
      return NextResponse.json({ error: "INVALID_CALENDAR_DATE" }, { status: 400 });
    }

    return NextResponse.json({ error: "CALENDAR_QUERY_FAILED" }, { status: 500 });
  }
}
