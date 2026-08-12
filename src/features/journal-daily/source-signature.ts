export interface JournalDailySignatureSource {
  entryId: string;
  daySequence: number;
  contentRevision: number;
}

export function buildJournalDailySourceSignature(sources: JournalDailySignatureSource[]) {
  return [
    "v2",
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
          `record:${source.entryId}|revision:${source.contentRevision}|seq:${source.daySequence}`
      )
  ].join("|");
}
