export interface DailyJournalSignatureSource {
  id: string;
  updatedAt: string;
}

export function buildDailyJournalSourceSignature(sources: DailyJournalSignatureSource[]) {
  return sources
    .map((source) => `${source.id}:${source.updatedAt}`)
    .sort()
    .join("|");
}
