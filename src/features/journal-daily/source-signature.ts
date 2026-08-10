export interface JournalDailySignatureSource {
  eventId: string;
  entryId: string;
  daySequence: number;
  savedRevision: number;
}

export function buildJournalDailySourceSignature(sources: JournalDailySignatureSource[]) {
  return [
    "v1",
    ...[...sources]
      .sort((left, right) => {
        const sequenceDiff = left.daySequence - right.daySequence;

        if (sequenceDiff !== 0) {
          return sequenceDiff;
        }

        return left.entryId.localeCompare(right.entryId);
      })
      .map(
        (source) =>
          `event:${source.eventId}|entry:${source.entryId}|seq:${source.daySequence}|saved:${source.savedRevision}`
      )
  ].join("|");
}
