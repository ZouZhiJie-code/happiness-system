import { NextResponse } from "next/server";

import { CalendarApiRequestError, parseCalendarMonthQuery } from "@/features/calendar/api";
import { CalendarQueryError, getCalendarMonth } from "@/server/services/calendar/calendar.service";

export async function GET(request: Request) {
  try {
    const month = parseCalendarMonthQuery(request);
    const payload = await getCalendarMonth(month);

    return NextResponse.json(payload);
  } catch (error) {
    if (
      (error instanceof CalendarApiRequestError && error.code === "INVALID_CALENDAR_MONTH") ||
      (error instanceof CalendarQueryError && error.code === "INVALID_CALENDAR_MONTH")
    ) {
      return NextResponse.json({ error: "INVALID_CALENDAR_MONTH" }, { status: 400 });
    }

    return NextResponse.json({ error: "CALENDAR_QUERY_FAILED" }, { status: 500 });
  }
}
