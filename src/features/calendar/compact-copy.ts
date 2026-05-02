function normalizeCalendarCopy(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function truncateCalendarCopy(text: string, maxLength: number) {
  const normalized = normalizeCalendarCopy(text);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`;
}

export function buildCalendarCompactCopy(
  sources: Array<string | null | undefined>,
  fallback: string,
  maxLength: number
) {
  const firstContent = sources.find((value) => typeof value === "string" && value.trim().length > 0);

  return truncateCalendarCopy(firstContent ?? fallback, maxLength);
}
