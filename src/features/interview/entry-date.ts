const ENTRY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHANGHAI_UTC_OFFSET_HOURS = 8;
const SHANGHAI_UTC_OFFSET_MS = SHANGHAI_UTC_OFFSET_HOURS * 60 * 60 * 1000;

export const ENTRY_DATE_TIMEZONE = "Asia/Shanghai";
export const ENTRY_DATE_REGEX = ENTRY_DATE_PATTERN;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function buildEntryDateString(date: Date) {
  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
}

export function isEntryDateString(value: string) {
  return ENTRY_DATE_PATTERN.test(value);
}

export function parseEntryDateInput(value: string) {
  if (!isEntryDateString(value)) {
    throw new Error("INVALID_ENTRY_DATE");
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utcMillis = Date.UTC(year, month - 1, day, -SHANGHAI_UTC_OFFSET_HOURS, 0, 0, 0);
  const parsed = new Date(utcMillis);

  if (formatEntryDate(parsed) !== value) {
    throw new Error("INVALID_ENTRY_DATE");
  }

  return parsed;
}

export function formatEntryDate(date: Date) {
  return buildEntryDateString(new Date(date.getTime() + SHANGHAI_UTC_OFFSET_MS));
}

export function getTodayEntryDate(now = new Date()) {
  return formatEntryDate(now);
}
