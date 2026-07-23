import type { JournalDailySourceEntry } from "@/types/journal-daily-entry";

export function assembleJournalDailyEntry(
  sources: JournalDailySourceEntry[]
): { title: string; content: string } {
  const orderedSources = [...sources].sort(
    (left, right) =>
      left.daySequence - right.daySequence ||
      left.entryId.localeCompare(right.entryId)
  );

  return {
    title: "今天的记录",
    content: orderedSources
      .map((source) => `## ${source.title}\n${source.content}`)
      .join("\n\n")
  };
}

export function journalDailyAssemblyPreservesSources(
  content: string,
  sources: JournalDailySourceEntry[]
) {
  let searchFrom = 0;

  for (const source of [...sources].sort(
    (left, right) =>
      left.daySequence - right.daySequence ||
      left.entryId.localeCompare(right.entryId)
  )) {
    const block = `## ${source.title}\n${source.content}`;
    const blockIndex = content.indexOf(block, searchFrom);

    if (blockIndex < searchFrom) {
      return false;
    }
    searchFrom = blockIndex + block.length;
  }

  return true;
}
