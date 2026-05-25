const BEIJING_UTC_OFFSET_HOURS = 8;
const BEIJING_UTC_OFFSET_MS = BEIJING_UTC_OFFSET_HOURS * 60 * 60 * 1000;

function padTimestampPart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatAIRuntimeTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const shifted = new Date(new Date(value).getTime() + BEIJING_UTC_OFFSET_MS);

  return [
    `${shifted.getUTCFullYear()}-${padTimestampPart(shifted.getUTCMonth() + 1)}-${padTimestampPart(shifted.getUTCDate())}`,
    `${padTimestampPart(shifted.getUTCHours())}:${padTimestampPart(shifted.getUTCMinutes())}`
  ].join(" ");
}
