export function normalizeInterviewUserTurnText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function countInterviewReplyCharacters(value: string) {
  return Array.from(value).length;
}

export const INTERVIEW_USER_TURN_LEASE_MS = 90_000;

export function isInterviewUserTurnLeaseExpired(
  turn: {
    status: string;
    updatedAt: string | Date;
  },
  now = Date.now()
) {
  if (turn.status !== "processing") {
    return false;
  }

  const updatedAt = turn.updatedAt instanceof Date
    ? turn.updatedAt.getTime()
    : Date.parse(turn.updatedAt);

  return Number.isFinite(updatedAt) && now - updatedAt >= INTERVIEW_USER_TURN_LEASE_MS;
}
