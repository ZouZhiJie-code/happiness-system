import type {
  JournalDailyEntryRecord,
  JournalDailyJournalView,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";
import type { JournalEventEntryRecord } from "@/types/journal-event-entry";

export class JournalClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code);
    this.name = "JournalClientError";
  }
}

async function readErrorCode(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof payload?.error === "string" ? payload.error : fallback;
}

async function assertSuccessful(response: Response, fallbackCode: string) {
  if (!response.ok) {
    throw new JournalClientError(await readErrorCode(response, fallbackCode), response.status);
  }
}

export async function fetchJournalDay(entryDate: string, signal?: AbortSignal) {
  const response = await fetch(`/api/journal/day?entryDate=${encodeURIComponent(entryDate)}`, {
    cache: "no-store",
    signal
  });
  await assertSuccessful(response, "JOURNAL_DAY_READ_FAILED");
  return (await response.json()) as JournalDailyJournalView;
}

export async function requestJournalDailyGeneration(input: {
  entryDate: string;
  task: "generate" | "update";
  sourceSignature: string;
  contentRevision: number | null;
}) {
  const response = await fetch("/api/journal/daily/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryDate: input.entryDate,
      task: input.task,
      clientOperationId: `journal-daily-${input.entryDate}-${Date.now()}`,
      expectedSourceSignature: input.sourceSignature,
      expectedContentRevision: input.contentRevision
    })
  });
  await assertSuccessful(response, "JOURNAL_DAILY_GENERATION_FAILED");
}

export async function updateJournalDailyEntry(input: {
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
}) {
  const response = await fetch(`/api/journal/daily/${encodeURIComponent(input.entryId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      content: input.content,
      expectedContentRevision: input.expectedContentRevision
    })
  });
  await assertSuccessful(response, "JOURNAL_DAILY_UPDATE_FAILED");
  const payload = (await response.json()) as JournalDailyEntryRecord | { entry: JournalDailyEntryRecord };
  return "entry" in payload ? payload.entry : payload;
}

export async function saveJournalDailyEntry(input: {
  entryId: string;
  expectedContentRevision: number;
}) {
  const response = await fetch(`/api/journal/daily/${encodeURIComponent(input.entryId)}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedContentRevision: input.expectedContentRevision })
  });
  await assertSuccessful(response, "JOURNAL_DAILY_SAVE_FAILED");
  const payload = (await response.json()) as JournalDailyEntryRecord | { entry: JournalDailyEntryRecord };
  return "entry" in payload ? payload.entry : payload;
}

export async function updateJournalRecord(input: {
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
}) {
  const response = await fetch(
    `/api/interview/event-centered/journal/${encodeURIComponent(input.entryId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        expectedContentRevision: input.expectedContentRevision
      })
    }
  );
  await assertSuccessful(response, "JOURNAL_RECORD_UPDATE_FAILED");
  return (await response.json()) as JournalEventEntryRecord;
}

export async function fetchJournalRecordOriginal(entryId: string) {
  const response = await fetch(
    `/api/interview/event-centered/journal/${encodeURIComponent(entryId)}`,
    { cache: "no-store" }
  );
  await assertSuccessful(response, "JOURNAL_RECORD_ORIGINAL_READ_FAILED");
  const entry = (await response.json()) as JournalEventEntryRecord;
  return entry.sourceSnapshot.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function replaceJournalSourceEntry(
  view: JournalDailyJournalView,
  entryId: string,
  nextEntry: Pick<JournalDailySourceEntry, "title" | "content" | "contentRevision" | "updatedAt">
): JournalDailyJournalView {
  return {
    ...view,
    savedSources: view.savedSources.map((source) =>
      source.entryId === entryId ? { ...source, ...nextEntry } : source
    )
  };
}
