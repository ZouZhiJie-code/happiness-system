export class CalendarApiRequestError extends Error {
  constructor(
    readonly code: "INVALID_CALENDAR_DATE" | "INVALID_CALENDAR_MONTH",
    message?: string
  ) {
    super(message ?? code);
    this.name = "CalendarApiRequestError";
  }
}

function getRequiredQueryParam(request: Request, key: string) {
  const { searchParams } = new URL(request.url);
  const value = searchParams.get(key)?.trim() ?? "";

  return value;
}

export function parseCalendarDateQuery(request: Request) {
  const date = getRequiredQueryParam(request, "date");

  if (!date) {
    throw new CalendarApiRequestError("INVALID_CALENDAR_DATE");
  }

  return date;
}

export function parseCalendarMonthQuery(request: Request) {
  const month = getRequiredQueryParam(request, "month");

  if (!month) {
    throw new CalendarApiRequestError("INVALID_CALENDAR_MONTH");
  }

  return month;
}
