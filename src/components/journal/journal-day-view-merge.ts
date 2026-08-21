import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";
import type {
  JournalDailyEntryGenerationRecord,
  JournalDailyEntryRecord,
  JournalDailyJournalView,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";

type JournalSourceResponse = Pick<
  JournalDailySourceEntry,
  "title" | "content" | "contentRevision" | "updatedAt"
> & Partial<Pick<JournalDailySourceEntry, "savedRevision" | "savedAt">>;

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function savedRevision(value: number | null | undefined) {
  return value ?? -1;
}

function preferNewerSource(
  current: JournalDailySourceEntry,
  incoming: JournalDailySourceEntry
) {
  if (current.contentRevision !== incoming.contentRevision) {
    return current.contentRevision > incoming.contentRevision ? current : incoming;
  }
  if (savedRevision(current.savedRevision) !== savedRevision(incoming.savedRevision)) {
    return savedRevision(current.savedRevision) > savedRevision(incoming.savedRevision)
      ? current
      : incoming;
  }
  return timestamp(current.updatedAt) > timestamp(incoming.updatedAt) ? current : incoming;
}

function preferNewerEntry(
  current: JournalDailyEntryRecord | null,
  incoming: JournalDailyEntryRecord | null
) {
  if (!current) return incoming;
  if (!incoming) return current;
  if (current.id !== incoming.id) {
    return timestamp(current.updatedAt) > timestamp(incoming.updatedAt) ? current : incoming;
  }
  if (current.contentRevision !== incoming.contentRevision) {
    return current.contentRevision > incoming.contentRevision ? current : incoming;
  }
  if (savedRevision(current.savedRevision) !== savedRevision(incoming.savedRevision)) {
    return savedRevision(current.savedRevision) > savedRevision(incoming.savedRevision)
      ? current
      : incoming;
  }
  return timestamp(current.updatedAt) > timestamp(incoming.updatedAt) ? current : incoming;
}

function preferNewerGeneration(
  current: JournalDailyEntryGenerationRecord | null,
  incoming: JournalDailyEntryGenerationRecord | null
) {
  if (!current) return incoming;
  if (!incoming) return current;
  const currentTime = Math.max(timestamp(current.updatedAt), timestamp(current.createdAt));
  const incomingTime = Math.max(timestamp(incoming.updatedAt), timestamp(incoming.createdAt));
  return currentTime > incomingTime ? current : incoming;
}

function mergeSources(
  current: JournalDailySourceEntry[],
  incoming: JournalDailySourceEntry[]
) {
  // Record cards currently have no delete path. Keep a client write that completed
  // after this GET started when the older response has not observed it yet.
  const currentById = new Map(current.map((source) => [source.entryId, source]));
  const merged = incoming.map((source) => {
    const currentSource = currentById.get(source.entryId);
    currentById.delete(source.entryId);
    return currentSource ? preferNewerSource(currentSource, source) : source;
  });
  return [...merged, ...currentById.values()];
}

function mergeLegacyHistory(
  current: JournalDailyJournalView["legacyHistory"],
  incoming: JournalDailyJournalView["legacyHistory"]
) {
  const currentById = new Map(current.map((item) => [`${item.kind}:${item.id}`, item]));
  const merged = incoming.map((item) => {
    const key = `${item.kind}:${item.id}`;
    const currentItem = currentById.get(key);
    currentById.delete(key);
    return currentItem && timestamp(currentItem.updatedAt) > timestamp(item.updatedAt)
      ? currentItem
      : item;
  });
  return [...merged, ...currentById.values()];
}

export function deriveJournalDayView(view: JournalDailyJournalView): JournalDailyJournalView {
  const sourceSignature = buildJournalDailySourceSignature(view.savedSources);
  const collection = view.savedSources.length === 0
    ? ({ kind: "empty" } as const)
    : view.savedSources.length === 1
      ? ({ kind: "single_entry", entryId: view.savedSources[0]!.entryId } as const)
      : ({ kind: "multiple_entries" } as const);
  const freshness = !view.entry
    ? ("none" as const)
    : view.entry.sourceSignature === sourceSignature
      ? view.entry.status
      : ("stale" as const);
  const displayStatus = view.latestGeneration?.status === "processing" || (
    view.displayStatus === "generating" && !view.latestGeneration
  )
    ? ("generating" as const)
    : view.latestGeneration?.status === "failed" && view.latestGeneration.kind === "update" && view.entry
      ? ("update_failed" as const)
      : !view.entry
        ? ("ungenerated" as const)
        : freshness === "stale"
          ? ("stale" as const)
          : view.entry.status === "saved"
            ? ("saved" as const)
            : ("draft" as const);

  return {
    ...view,
    sourceSignature,
    collection,
    freshness,
    displayStatus
  };
}

export function mergeJournalDayRefresh(
  current: JournalDailyJournalView,
  incoming: JournalDailyJournalView
) {
  if (current.entryDate !== incoming.entryDate) return incoming;
  const latestGeneration = preferNewerGeneration(current.latestGeneration, incoming.latestGeneration);
  const preserveOptimisticGeneration = current.displayStatus === "generating" && !incoming.latestGeneration;

  return deriveJournalDayView({
    ...incoming,
    savedSources: mergeSources(current.savedSources, incoming.savedSources),
    legacyHistory: mergeLegacyHistory(current.legacyHistory, incoming.legacyHistory),
    entry: preferNewerEntry(current.entry, incoming.entry),
    latestGeneration,
    displayStatus: preserveOptimisticGeneration ? "generating" : incoming.displayStatus
  });
}

export function mergeJournalRecordResponse(
  current: JournalDailyJournalView,
  entryId: string,
  response: JournalSourceResponse
) {
  return deriveJournalDayView({
    ...current,
    savedSources: current.savedSources.map((source) =>
      source.entryId === entryId ? { ...source, ...response } : source
    )
  });
}

export function mergeJournalDailyResponse(
  current: JournalDailyJournalView,
  response: JournalDailyEntryRecord
) {
  if (current.entry && current.entry.id !== response.id) return current;
  return deriveJournalDayView({ ...current, entry: preferNewerEntry(current.entry, response) });
}
