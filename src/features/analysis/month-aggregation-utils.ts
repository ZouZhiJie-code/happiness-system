const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function parseMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function buildMonthDates(month: string) {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error("INVALID_MONTH");
  }

  const startDate = parseMonthKey(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const currentDate = new Date(startDate);
    currentDate.setUTCDate(index + 1);
    return formatDateKey(currentDate);
  });
}

export function compareDateDesc(left: string | null, right: string | null) {
  return right === left ? 0 : right && (!left || right > left) ? 1 : -1;
}

export function roundScoreAverage(value: number) {
  return Math.round(value * 10) / 10;
}
