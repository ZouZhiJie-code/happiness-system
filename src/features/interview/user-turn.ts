export function normalizeInterviewUserTurnText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function countInterviewReplyCharacters(value: string) {
  return Array.from(value).length;
}
