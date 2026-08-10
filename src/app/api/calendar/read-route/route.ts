import { NextResponse } from "next/server";

import { CalendarApiRequestError, parseCalendarDateQuery } from "@/features/calendar/api";
import {
  CalendarReadRouteError,
  getCalendarReadRoute
} from "@/server/services/calendar/calendar-read-route.service";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const date = parseCalendarDateQuery(request);
    const route = await getCalendarReadRoute(user.id, date);
    return NextResponse.json({ date, route });
  } catch (error) {
    if (
      (error instanceof CalendarApiRequestError && error.code === "INVALID_CALENDAR_DATE") ||
      (error instanceof CalendarReadRouteError && error.code === "INVALID_CALENDAR_DATE")
    ) {
      return NextResponse.json({ error: "INVALID_CALENDAR_DATE" }, { status: 400 });
    }

    return NextResponse.json({ error: "CALENDAR_READ_ROUTE_FAILED" }, { status: 500 });
  }
}
