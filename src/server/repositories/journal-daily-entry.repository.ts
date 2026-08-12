import { Prisma } from "@prisma/client";

import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import { formatEntryDate, getEntryDateRangeBounds, parseEntryDateInput } from "@/features/interview/entry-date";
import { prisma } from "@/server/db/prisma";
import { createAIGenerationTraceWithClient } from "@/server/repositories/ai-quality.repository";
import type {
  AnyJournalDailyEntrySourceSnapshot,
  CommitJournalDailyEntryDraftInput,
  JournalDailyEntryGenerationRecord,
  JournalDailyEntryRecord,
  JournalDailyEntryRevisionRecord,
  JournalDailyEntrySourceSnapshot,
  JournalDailyJournalView,
  JournalDailyParagraphDocument,
  JournalDailySourceEntry,
  JournalDailyWritingMaterial,
  ReserveJournalDailyEntryGenerationInput,
  SaveJournalDailyEntryInput,
  SettleJournalDailyEntryGenerationInput,
  UpdateJournalDailyEntryInput
} from "@/types/journal-daily-entry";

type SourceDatabaseClient = Pick<Prisma.TransactionClient, "journalEventEntry">;
type StoredJournalDailyEntry = Prisma.JournalDailyEntryGetPayload<Record<never, never>>;
type StoredJournalDailyEntryRevision = Prisma.JournalDailyEntryRevisionGetPayload<Record<never, never>>;
type StoredJournalDailyEntryGeneration = Prisma.JournalDailyEntryGenerationGetPayload<Record<never, never>>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromJsonValue<T>(value: Prisma.JsonValue): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeDate(value: Date | null) {
  return value?.toISOString() ?? null;
}

function assertNonEmpty(value: string, code: string) {
  if (!value.trim()) throw new Error(code);
}

function assertEntryContent(title: string, content: string) {
  const normalizedTitle = title.trim();

  if (!normalizedTitle || [...normalizedTitle].length > MAX_JOURNAL_TITLE_LENGTH || !content.trim()) {
    throw new Error("JOURNAL_DAILY_ENTRY_INVALID");
  }
}

function assertContentRevision(value: number, code = "JOURNAL_DAILY_ENTRY_VERSION_INVALID") {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(code);
  }
}

function buildParagraphDocument(content: string, sourceRecordIds: string[]): JournalDailyParagraphDocument {
  const paragraphs = content
    .split(/\n\s*\n/u)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ text, sourceRecordIds: [...sourceRecordIds] }));

  return { schemaVersion: 1, paragraphs };
}

function normalizeParagraphDocument(
  value: JournalDailyParagraphDocument | undefined,
  content: string,
  sourceRecordIds: string[],
  options: { requireFullCoverage?: boolean; allowUnmappedParagraphs?: boolean } = {}
): JournalDailyParagraphDocument {
  const document = value ?? buildParagraphDocument(content, sourceRecordIds);
  const allowedSourceIds = new Set(sourceRecordIds);

  if (document.schemaVersion !== 1 || document.paragraphs.length === 0) {
    throw new Error("JOURNAL_DAILY_PARAGRAPHS_INVALID");
  }

  const normalized = document.paragraphs.map((paragraph) => {
    const text = paragraph.text.trim();
    const refs = [...new Set(paragraph.sourceRecordIds)];
    if (
      !text ||
      (!options.allowUnmappedParagraphs && refs.length === 0) ||
      refs.some((id) => !allowedSourceIds.has(id))
    ) {
      throw new Error("JOURNAL_DAILY_PARAGRAPHS_INVALID");
    }
    return { text, sourceRecordIds: refs };
  });

  if (normalized.map((paragraph) => paragraph.text).join("\n\n") !== content.trim()) {
    throw new Error("JOURNAL_DAILY_PARAGRAPHS_CONTENT_MISMATCH");
  }

  const coveredSourceIds = new Set(normalized.flatMap((paragraph) => paragraph.sourceRecordIds));
  if (options.requireFullCoverage !== false && sourceRecordIds.some((id) => !coveredSourceIds.has(id))) {
    throw new Error("JOURNAL_DAILY_SOURCE_OMITTED");
  }

  return { schemaVersion: 1, paragraphs: normalized };
}

function normalizeStoredParagraphs(
  value: Prisma.JsonValue,
  content: string,
  sourceRecordIds: string[]
): JournalDailyParagraphDocument {
  try {
    const parsed = fromJsonValue<JournalDailyParagraphDocument>(value);
    return normalizeParagraphDocument(parsed, content, sourceRecordIds, {
      requireFullCoverage: false,
      allowUnmappedParagraphs: true
    });
  } catch {
    return buildParagraphDocument(content, sourceRecordIds);
  }
}

function paragraphTokens(value: string) {
  return new Set(value.replace(/\s+/gu, "").split(""));
}

function paragraphSimilarity(left: string, right: string) {
  const leftTokens = paragraphTokens(left);
  const rightTokens = paragraphTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function reconcileManualParagraphs(
  existing: JournalDailyParagraphDocument,
  content: string,
  sourceRecordIds: string[]
): JournalDailyParagraphDocument {
  const nextTexts = content
    .split(/\n\s*\n/u)
    .map((text) => text.trim())
    .filter(Boolean);
  const remaining = new Set(existing.paragraphs.map((_, index) => index));
  const paragraphs = nextTexts.map((text, nextIndex) => {
    let matchedIndex = existing.paragraphs.findIndex(
      (paragraph, index) => remaining.has(index) && paragraph.text.trim() === text
    );
    if (matchedIndex < 0) {
      const ranked = [...remaining]
        .map((index) => ({
          index,
          score: paragraphSimilarity(existing.paragraphs[index]!.text, text),
          distance: Math.abs(index - nextIndex)
        }))
        .sort((left, right) => right.score - left.score || left.distance - right.distance);
      if (ranked[0] && (ranked[0].score >= 0.35 || nextTexts.length === existing.paragraphs.length)) {
        matchedIndex = ranked[0].index;
      }
    }

    if (matchedIndex >= 0) {
      remaining.delete(matchedIndex);
      return {
        text,
        sourceRecordIds: existing.paragraphs[matchedIndex]!.sourceRecordIds.filter((id) =>
          sourceRecordIds.includes(id)
        )
      };
    }
    return { text, sourceRecordIds: [] };
  });

  return { schemaVersion: 1, paragraphs };
}

function getSnapshotSourceRecordIds(value: Prisma.JsonValue) {
  try {
    const snapshot = fromJsonValue<{ sources?: Array<{ entryId?: unknown }> }>(value);
    return (snapshot.sources ?? []).flatMap((source) =>
      typeof source.entryId === "string" && source.entryId ? [source.entryId] : []
    );
  } catch {
    return [];
  }
}

function mapJournalDailyEntry(entry: StoredJournalDailyEntry | null): JournalDailyEntryRecord | null {
  if (!entry) return null;

  return {
    id: entry.id,
    entryDate: formatEntryDate(entry.entryDate),
    title: entry.title,
    content: entry.content,
    paragraphs: normalizeStoredParagraphs(entry.paragraphs, entry.content, entry.sourceEntryIds),
    status: entry.status,
    sourceEntryIds: entry.sourceEntryIds,
    sourceEventIds: entry.sourceEventIds,
    sourceSignature: entry.sourceSignature,
    sourceSnapshot: fromJsonValue<AnyJournalDailyEntrySourceSnapshot>(entry.sourceSnapshot),
    sourceUpdatedAt: serializeDate(entry.sourceUpdatedAt),
    contentRevision: entry.contentRevision,
    savedRevision: entry.savedRevision,
    currentGenerationTraceId: entry.currentGenerationTraceId,
    lastGenerationErrorCode: entry.lastGenerationErrorCode,
    editedAt: serializeDate(entry.editedAt),
    savedAt: serializeDate(entry.savedAt),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function mapJournalDailyEntryRevision(
  revision: StoredJournalDailyEntryRevision
): JournalDailyEntryRevisionRecord {
  return {
    id: revision.id,
    entryId: revision.entryId,
    kind: revision.kind,
    title: revision.title,
    content: revision.content,
    paragraphs: normalizeStoredParagraphs(
      revision.paragraphs,
      revision.content,
      getSnapshotSourceRecordIds(revision.sourceSnapshot)
    ),
    sourceSignature: revision.sourceSignature,
    sourceSnapshot: fromJsonValue<AnyJournalDailyEntrySourceSnapshot>(revision.sourceSnapshot),
    contentRevision: revision.contentRevision,
    generationTraceId: revision.generationTraceId,
    createdAt: revision.createdAt.toISOString()
  };
}

function mapJournalDailyEntryGeneration(
  generation: StoredJournalDailyEntryGeneration | null
): JournalDailyEntryGenerationRecord | null {
  if (!generation) return null;
  return {
    id: generation.id,
    entryDate: formatEntryDate(generation.entryDate),
    entryId: generation.entryId,
    traceId: generation.traceId,
    clientOperationId: generation.clientOperationId,
    kind: generation.kind,
    status: generation.status,
    expectedSourceSignature: generation.expectedSourceSignature,
    expectedContentRevision: generation.expectedContentRevision,
    resultRevisionId: generation.resultRevisionId,
    attemptCount: generation.attemptCount,
    errorCode: generation.errorCode,
    startedAt: generation.startedAt.toISOString(),
    completedAt: serializeDate(generation.completedAt),
    failedAt: serializeDate(generation.failedAt),
    canceledAt: serializeDate(generation.canceledAt),
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString()
  };
}

function buildSourceSnapshot(entryDate: string, sources: JournalDailySourceEntry[]): JournalDailyEntrySourceSnapshot {
  return { schemaVersion: 2, entryDate, sources };
}

function getSourceSignature(sources: JournalDailySourceEntry[]) {
  return buildJournalDailySourceSignature(sources);
}

function getLatestSourceUpdate(sources: JournalDailySourceEntry[]) {
  const latest = sources.reduce<string | null>((current, source) => {
    if (!current || source.updatedAt > current) return source.updatedAt;
    return current;
  }, null);
  return latest ? new Date(latest) : null;
}

function getSourceMessageProjection(sourceSnapshot: Prisma.JsonValue) {
  const snapshot = fromJsonValue<{
    messages?: Array<{ id?: unknown; role?: unknown }>;
  }>(sourceSnapshot);
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const userMessages = messages.filter((message) => message.role === "user");
  return {
    sourceMessageIds: messages.flatMap((message) =>
      typeof message.id === "string" && message.id ? [message.id] : []
    ),
    recordCount: Math.max(userMessages.length, 1),
    sourceMode: userMessages.length <= 1 ? ("capture" as const) : ("chat" as const)
  };
}

interface JournalDailySourceProjection {
  source: JournalDailySourceEntry;
  writingMaterial: JournalDailyWritingMaterial;
}

interface WritingContextMessage {
  id: string;
  role: "user" | "assistant" | "system";
  sequence: number;
  content: string;
  originalIndex: number;
}

function getWritingContextMessages(sourceSnapshot: Prisma.JsonValue): WritingContextMessage[] {
  const snapshot = fromJsonValue<{
    messages?: Array<{
      id?: unknown;
      role?: unknown;
      sequence?: unknown;
      content?: unknown;
    }>;
  }>(sourceSnapshot);
  if (!Array.isArray(snapshot.messages)) return [];

  return snapshot.messages.flatMap((message, originalIndex) => {
    if (
      typeof message.id !== "string" ||
      !message.id ||
      (message.role !== "user" && message.role !== "assistant" && message.role !== "system") ||
      typeof message.sequence !== "number" ||
      !Number.isFinite(message.sequence) ||
      typeof message.content !== "string"
    ) {
      return [];
    }
    return [{
      id: message.id,
      role: message.role as WritingContextMessage["role"],
      sequence: message.sequence,
      content: message.content,
      originalIndex
    }];
  }).sort((left, right) => left.sequence - right.sequence || left.originalIndex - right.originalIndex);
}

function extractActualAssistantQuestion(content: string) {
  const normalized = content.replace(/\s+/gu, " ").trim();
  if (!/[？?]$/u.test(normalized)) return null;
  const withoutTerminal = normalized.slice(0, -1);
  const lastBoundary = Math.max(
    withoutTerminal.lastIndexOf("。"),
    withoutTerminal.lastIndexOf("！"),
    withoutTerminal.lastIndexOf("!"),
    withoutTerminal.lastIndexOf("？"),
    withoutTerminal.lastIndexOf("?"),
    withoutTerminal.lastIndexOf(".")
  );
  return normalized.slice(lastBoundary + 1).trim() || null;
}

function buildQuestionContext(
  sourceSnapshot: Prisma.JsonValue,
  sourceMessageIds: string[]
): JournalDailyWritingMaterial["questionContext"] {
  const referencedIds = new Set(sourceMessageIds);
  const context: JournalDailyWritingMaterial["questionContext"] = [];
  let pendingQuestion: string | null = null;

  for (const message of getWritingContextMessages(sourceSnapshot)) {
    if (message.role === "assistant") {
      pendingQuestion = extractActualAssistantQuestion(message.content);
      continue;
    }
    if (message.role === "system") continue;

    if (pendingQuestion && referencedIds.has(message.id)) {
      context.push({ answerSourceMessageId: message.id, question: pendingQuestion });
    }
    // Every user turn closes the preceding question, including an unreferenced turn.
    pendingQuestion = null;
  }

  return context;
}

function splitCurrentRecordContent(content: string) {
  const normalized = content.replace(/\r\n?/gu, "\n").trim();
  const marker = /\n\s*\n我看见的\n\s*\n/u;
  const match = marker.exec(normalized);
  if (!match || match.index < 0) {
    return { eventText: normalized, supportedInsights: [] as string[] };
  }

  const eventText = normalized.slice(0, match.index).trim();
  const insightText = normalized.slice(match.index + match[0].length).trim();
  return {
    eventText: eventText || normalized,
    supportedInsights: insightText
      ? insightText.split(/\n\s*\n/gu).map((value) => value.trim()).filter(Boolean)
      : []
  };
}

export function buildJournalDailyWritingMaterial(input: {
  content: string;
  contentRevision: number;
  editedAt: Date | null;
  sourceMessageIds: string[];
  sourceSnapshot: Prisma.JsonValue;
}): JournalDailyWritingMaterial {
  // Historical revision-1 rows wrote editedAt during AI generation. Revision 1
  // therefore remains the compatibility signal for an unedited record card.
  const userEdited = input.contentRevision > 1 ||
    (input.contentRevision !== 1 && input.editedAt !== null);
  if (userEdited) {
    return {
      eventText: input.content.trim(),
      supportedInsights: [],
      questionContext: [],
      basedOnContentRevision: input.contentRevision
    };
  }

  return {
    ...splitCurrentRecordContent(input.content),
    questionContext: buildQuestionContext(input.sourceSnapshot, input.sourceMessageIds),
    basedOnContentRevision: input.contentRevision
  };
}

async function listCurrentJournalEventEntryProjectionsForDailyJournalWithClient(
  database: SourceDatabaseClient,
  userId: string,
  entryDate: string
): Promise<JournalDailySourceProjection[]> {
  const { startAt, endExclusive } = getEntryDateRangeBounds(entryDate);
  const entries = await database.journalEventEntry.findMany({
    where: {
      event: {
        userId,
        status: { not: "abandoned" },
        entryDate: { gte: startAt, lt: endExclusive }
      }
    },
    select: {
      id: true,
      title: true,
      content: true,
      occurredAtText: true,
      contentRevision: true,
      savedRevision: true,
      savedAt: true,
      updatedAt: true,
      editedAt: true,
      sourceMessageIds: true,
      sourceSnapshot: true,
      event: {
        select: {
          id: true,
          entryDate: true,
          daySequence: true,
          startedAt: true,
          rootSession: {
            select: { recordMode: true }
          }
        }
      }
    },
    orderBy: [{ event: { daySequence: "asc" } }, { id: "asc" }]
  });

  return entries.map((entry) => {
    const messageProjection = getSourceMessageProjection(entry.sourceSnapshot);
    const source: JournalDailySourceEntry = {
      eventId: entry.event.id,
      entryId: entry.id,
      entryDate: formatEntryDate(entry.event.entryDate),
      daySequence: entry.event.daySequence,
      title: entry.title,
      content: entry.content,
      contentRevision: entry.contentRevision,
      savedRevision: entry.savedRevision,
      savedAt: serializeDate(entry.savedAt),
      updatedAt: entry.updatedAt.toISOString(),
      recordedAt: entry.event.startedAt.toISOString(),
      occurredAt: entry.occurredAtText,
      ...messageProjection,
      sourceMode: entry.event.rootSession?.recordMode ?? messageProjection.sourceMode
    };
    const sourceMessageIds = Array.isArray(entry.sourceMessageIds)
      ? entry.sourceMessageIds
      : messageProjection.sourceMessageIds;
    return {
      source,
      writingMaterial: buildJournalDailyWritingMaterial({
        content: entry.content,
        contentRevision: entry.contentRevision,
        editedAt: entry.editedAt ?? null,
        sourceMessageIds,
        sourceSnapshot: entry.sourceSnapshot
      })
    };
  });
}

async function listCurrentJournalEventEntriesForDailyJournalWithClient(
  database: SourceDatabaseClient,
  userId: string,
  entryDate: string
): Promise<JournalDailySourceEntry[]> {
  const projections = await listCurrentJournalEventEntryProjectionsForDailyJournalWithClient(
    database,
    userId,
    entryDate
  );
  return projections.map((projection) => projection.source);
}

async function findJournalDailyEntryByDateWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntry">,
  userId: string,
  entryDate: string
) {
  return database.journalDailyEntry.findUnique({
    where: { userId_entryDate: { userId, entryDate: parseEntryDateInput(entryDate) } }
  });
}

async function findJournalDailyEntryForUserWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntry">,
  userId: string,
  entryId: string
) {
  return database.journalDailyEntry.findFirst({ where: { id: entryId, userId } });
}

async function findLatestGenerationWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntryGeneration">,
  userId: string,
  entryDate: string
) {
  return database.journalDailyEntryGeneration.findFirst({
    where: { userId, entryDate: parseEntryDateInput(entryDate) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export function listSavedJournalEventEntriesForDailyJournal(userId: string, entryDate: string) {
  return listCurrentJournalEventEntriesForDailyJournalWithClient(prisma, userId, entryDate);
}

export const listCurrentJournalEventEntriesForDailyJournal =
  listSavedJournalEventEntriesForDailyJournal;

export async function getJournalDailyEntry(userId: string, entryDate: string) {
  return mapJournalDailyEntry(await findJournalDailyEntryByDateWithClient(prisma, userId, entryDate));
}

function buildJournalDailyJournalView(input: {
  entryDate: string;
  entry: StoredJournalDailyEntry | null;
  sources: JournalDailySourceEntry[];
  latestGeneration: StoredJournalDailyEntryGeneration | null;
}): JournalDailyJournalView {
  const { entryDate, entry, sources, latestGeneration } = input;
  const sourceSignature = getSourceSignature(sources);
  const collection = sources.length === 0
    ? ({ kind: "empty" } as const)
    : sources.length === 1
      ? ({ kind: "single_entry", entryId: sources[0]!.entryId } as const)
      : ({ kind: "multiple_entries" } as const);
  const mappedEntry = mapJournalDailyEntry(entry);
  const freshness = !mappedEntry
    ? "none"
    : mappedEntry.sourceSignature === sourceSignature
      ? mappedEntry.status
      : "stale";
  const mappedGeneration = mapJournalDailyEntryGeneration(latestGeneration);
  const displayStatus = mappedGeneration?.status === "processing"
    ? "generating"
    : mappedGeneration?.status === "failed" && mappedGeneration.kind === "update" && mappedEntry
      ? "update_failed"
      : !mappedEntry
        ? "ungenerated"
        : freshness === "stale"
          ? "stale"
          : mappedEntry.status === "saved"
            ? "saved"
            : "draft";

  return {
    entryDate,
    savedSources: sources,
    pendingSaveEntryIds: [],
    sourceSignature,
    collection,
    entry: mappedEntry,
    freshness,
    displayStatus,
    latestGeneration: mappedGeneration,
    updateBlockedByPendingSource: false
  };
}

async function readJournalDailyJournalProjection(userId: string, entryDate: string) {
  const [entry, sourceProjections, latestGeneration] = await Promise.all([
    findJournalDailyEntryByDateWithClient(prisma, userId, entryDate),
    listCurrentJournalEventEntryProjectionsForDailyJournalWithClient(prisma, userId, entryDate),
    findLatestGenerationWithClient(prisma, userId, entryDate)
  ]);
  return {
    journalView: buildJournalDailyJournalView({
      entryDate,
      entry,
      sources: sourceProjections.map((projection) => projection.source),
      latestGeneration
    }),
    sourceWritingMaterials: sourceProjections.map((projection) => ({
      entryId: projection.source.entryId,
      writingMaterial: projection.writingMaterial
    }))
  };
}

export async function getJournalDailyJournalView(
  userId: string,
  entryDate: string
): Promise<JournalDailyJournalView> {
  return (await readJournalDailyJournalProjection(userId, entryDate)).journalView;
}

/** Internal generation read. Writer-only material is kept separate from the public journal view. */
export function getJournalDailyGenerationRepositoryView(userId: string, entryDate: string) {
  return readJournalDailyJournalProjection(userId, entryDate);
}

export async function reserveJournalDailyEntryGeneration(
  input: ReserveJournalDailyEntryGenerationInput
): Promise<JournalDailyEntryGenerationRecord> {
  assertNonEmpty(input.clientOperationId, "JOURNAL_DAILY_OPERATION_ID_INVALID");
  assertNonEmpty(input.expectedSourceSignature, "JOURNAL_DAILY_SOURCE_SIGNATURE_INVALID");
  if (input.expectedContentRevision !== null) assertContentRevision(input.expectedContentRevision);

  const generation = await prisma.$transaction(async (database) => {
    const normalizedDate = parseEntryDateInput(input.entryDate);
    const existingOperation = await database.journalDailyEntryGeneration.findUnique({
      where: {
        userId_entryDate_clientOperationId: {
          userId: input.userId,
          entryDate: normalizedDate,
          clientOperationId: input.clientOperationId
        }
      }
    });
    if (existingOperation) return existingOperation;

    const [sources, entry] = await Promise.all([
      listCurrentJournalEventEntriesForDailyJournalWithClient(database, input.userId, input.entryDate),
      findJournalDailyEntryByDateWithClient(database, input.userId, input.entryDate)
    ]);
    if (sources.length === 0) throw new Error("JOURNAL_DAILY_SOURCE_INSUFFICIENT");
    if (getSourceSignature(sources) !== input.expectedSourceSignature) {
      throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
    }
    if ((entry?.contentRevision ?? null) !== input.expectedContentRevision) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }
    if (input.kind === "update" && !entry) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }

    const inputSnapshot = {
      schemaVersion: 1,
      entryDate: input.entryDate,
      sourceSignature: input.expectedSourceSignature,
      sources,
      currentEntry: mapJournalDailyEntry(entry)
    };
    const traceId = input.traceId ?? (await createAIGenerationTraceWithClient(database, {
      requestId: input.requestId ?? null,
      userId: input.userId,
      artifactType: "daily_journal",
      artifactId: `journal-daily:${input.userId}:${input.entryDate}`,
      artifactVersion: (entry?.contentRevision ?? 0) + 1,
      contextSnapshot: inputSnapshot,
      pipelineDecisions: [{
        kind: "journal_daily_generation_reserved",
        taskType: input.kind,
        clientOperationId: input.clientOperationId,
        sourceSignature: input.expectedSourceSignature,
        expectedContentRevision: input.expectedContentRevision
      }]
    })).id;

    return database.journalDailyEntryGeneration.create({
      data: {
        userId: input.userId,
        entryDate: normalizedDate,
        entryId: entry?.id ?? null,
        traceId,
        clientOperationId: input.clientOperationId,
        kind: input.kind,
        expectedSourceSignature: input.expectedSourceSignature,
        expectedContentRevision: input.expectedContentRevision,
        inputSnapshot: toJsonValue(inputSnapshot)
      }
    });
  });

  return mapJournalDailyEntryGeneration(generation)!;
}

export async function commitJournalDailyEntryDraft(
  input: CommitJournalDailyEntryDraftInput
): Promise<JournalDailyEntryRecord> {
  assertEntryContent(input.title, input.content);
  assertNonEmpty(input.expectedSourceSignature, "JOURNAL_DAILY_SOURCE_SIGNATURE_INVALID");
  if (input.expectedContentRevision !== null) assertContentRevision(input.expectedContentRevision);

  return prisma.$transaction(async (database) => {
    const generation = input.generationId
      ? await database.journalDailyEntryGeneration.findFirst({
          where: { id: input.generationId, userId: input.userId }
        })
      : null;
    if (input.generationId && !generation) throw new Error("JOURNAL_DAILY_GENERATION_NOT_FOUND");
    if (generation?.status !== undefined && generation.status !== "processing") {
      if (generation.status === "completed" && generation.entryId) {
        const completedEntry = await findJournalDailyEntryForUserWithClient(
          database,
          input.userId,
          generation.entryId
        );
        const mappedCompleted = mapJournalDailyEntry(completedEntry);
        if (mappedCompleted) return mappedCompleted;
      }
      throw new Error("JOURNAL_DAILY_GENERATION_ALREADY_SETTLED");
    }
    if (
      generation &&
      (generation.expectedSourceSignature !== input.expectedSourceSignature ||
        generation.expectedContentRevision !== input.expectedContentRevision)
    ) {
      throw new Error("JOURNAL_DAILY_GENERATION_INPUT_CHANGED");
    }

    const sources = await listCurrentJournalEventEntriesForDailyJournalWithClient(
      database,
      input.userId,
      input.entryDate
    );
    const currentSignature = getSourceSignature(sources);
    if (sources.length === 0) throw new Error("JOURNAL_DAILY_SOURCE_INSUFFICIENT");
    if (currentSignature !== input.expectedSourceSignature) {
      throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
    }

    const existing = await findJournalDailyEntryByDateWithClient(database, input.userId, input.entryDate);
    if ((existing?.contentRevision ?? null) !== input.expectedContentRevision) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const sourceEntryIds = sources.map((source) => source.entryId);
    const sourceEventIds = sources.map((source) => source.eventId);
    const isUpdateDraft = input.revisionKind === "updated" || generation?.kind === "update";
    const paragraphDocument = normalizeParagraphDocument(
      input.paragraphs,
      input.content,
      sourceEntryIds,
      { allowUnmappedParagraphs: isUpdateDraft }
    );
    const sourceSnapshot = buildSourceSnapshot(input.entryDate, sources);
    const nextContentRevision = (existing?.contentRevision ?? 0) + 1;
    const generationTraceId = input.generationTraceId ?? generation?.traceId ?? null;
    const hasSavedBase = existing?.savedRevision !== null && existing?.savedRevision !== undefined;
    const data = {
      title: input.title.trim(),
      content: input.content.trim(),
      paragraphs: toJsonValue(paragraphDocument),
      status: hasSavedBase ? ("modified" as const) : ("draft" as const),
      sourceEntryIds,
      sourceEventIds,
      sourceSignature: currentSignature,
      sourceSnapshot: toJsonValue(sourceSnapshot),
      sourceUpdatedAt: getLatestSourceUpdate(sources),
      contentRevision: nextContentRevision,
      savedRevision: existing?.savedRevision ?? null,
      currentGenerationTraceId: generationTraceId,
      lastGenerationErrorCode: null,
      editedAt: hasSavedBase ? new Date() : null,
      savedAt: existing?.savedAt ?? null
    };

    let entry: StoredJournalDailyEntry | null;
    if (existing) {
      const update = await database.journalDailyEntry.updateMany({
        where: {
          id: existing.id,
          userId: input.userId,
          contentRevision: existing.contentRevision
        },
        data
      });
      if (update.count !== 1) throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
      entry = await findJournalDailyEntryForUserWithClient(database, input.userId, existing.id);
    } else {
      entry = await database.journalDailyEntry.create({
        data: {
          userId: input.userId,
          entryDate: parseEntryDateInput(input.entryDate),
          ...data
        }
      });
    }
    if (!entry) throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");

    const revisionKind = input.revisionKind ??
      (generation?.kind === "update" || hasSavedBase ? "updated" : "generated");
    const revision = await database.journalDailyEntryRevision.create({
      data: {
        entryId: entry.id,
        kind: revisionKind,
        title: entry.title,
        content: entry.content,
        paragraphs: toJsonValue(entry.paragraphs),
        sourceSignature: entry.sourceSignature,
        sourceSnapshot: toJsonValue(entry.sourceSnapshot),
        contentRevision: entry.contentRevision,
        generationTraceId
      }
    });

    if (generation) {
      const completed = await database.journalDailyEntryGeneration.updateMany({
        where: { id: generation.id, userId: input.userId, status: "processing" },
        data: {
          status: "completed",
          entryId: entry.id,
          resultRevisionId: revision.id,
          outputSnapshot: toJsonValue({
            schemaVersion: 1,
            title: entry.title,
            paragraphs: paragraphDocument,
            contentRevision: entry.contentRevision
          }),
          completedAt: new Date(),
          errorCode: null
        }
      });
      if (completed.count !== 1) throw new Error("JOURNAL_DAILY_GENERATION_ALREADY_SETTLED");
    }

    if (generationTraceId) {
      const trace = await database.aIGenerationTrace.findUnique({
        where: { id: generationTraceId },
        select: { pipelineDecisions: true }
      });
      if (!trace) throw new Error("JOURNAL_DAILY_GENERATION_TRACE_NOT_FOUND");
      const previousDecisions = Array.isArray(trace.pipelineDecisions)
        ? trace.pipelineDecisions
        : [];
      const traceUpdate = await database.aIGenerationTrace.updateMany({
        where: { id: generationTraceId, status: "pending" },
        data: {
          status: "completed",
          outputOrigin: input.outputOrigin ?? "deterministic",
          artifactId: entry.id,
          artifactVersion: entry.contentRevision,
          finalOutput: toJsonValue({
            title: entry.title,
            content: entry.content,
            paragraphs: paragraphDocument
          }),
          pipelineDecisions: toJsonValue([
            ...previousDecisions,
            ...(input.pipelineDecisions ?? []),
            {
              kind: "journal_daily_generation_completed",
              generationId: generation?.id ?? null,
              sourceSignature: entry.sourceSignature,
              contentRevision: entry.contentRevision
            }
          ]),
          completedAt: new Date()
        }
      });
      if (traceUpdate.count !== 1) throw new Error("JOURNAL_DAILY_GENERATION_TRACE_CHANGED");
    }

    return mapJournalDailyEntry(entry)!;
  });
}

export async function updateJournalDailyEntry(
  input: UpdateJournalDailyEntryInput
): Promise<JournalDailyEntryRecord> {
  assertEntryContent(input.title, input.content);
  assertContentRevision(input.expectedContentRevision);

  return prisma.$transaction(async (database) => {
    const existing = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    if (!existing) throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const title = input.title.trim();
    const content = input.content.trim();
    const existingParagraphs = normalizeStoredParagraphs(
      existing.paragraphs,
      existing.content,
      existing.sourceEntryIds
    );
    const paragraphs = input.paragraphs
      ? normalizeParagraphDocument(input.paragraphs, content, existing.sourceEntryIds, {
          requireFullCoverage: false,
          allowUnmappedParagraphs: true
        })
      : reconcileManualParagraphs(existingParagraphs, content, existing.sourceEntryIds);
    if (existing.title === title && existing.content === content) return mapJournalDailyEntry(existing)!;

    const update = await database.journalDailyEntry.updateMany({
      where: {
        id: existing.id,
        userId: input.userId,
        contentRevision: existing.contentRevision
      },
      data: {
        title,
        content,
        paragraphs: toJsonValue(paragraphs),
        status: existing.savedRevision ? "modified" : "draft",
        contentRevision: { increment: 1 },
        editedAt: new Date()
      }
    });
    if (update.count !== 1) throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");

    const updated = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    if (!updated) throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    return mapJournalDailyEntry(updated)!;
  });
}

export async function saveJournalDailyEntry(
  input: SaveJournalDailyEntryInput
): Promise<JournalDailyEntryRecord> {
  assertContentRevision(input.expectedContentRevision);

  return prisma.$transaction(async (database) => {
    const existing = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    if (!existing) throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }
    if (existing.status === "saved" && existing.savedRevision === existing.contentRevision) {
      return mapJournalDailyEntry(existing)!;
    }

    const sources = await listCurrentJournalEventEntriesForDailyJournalWithClient(
      database,
      input.userId,
      formatEntryDate(existing.entryDate)
    );
    if (sources.length === 0 || getSourceSignature(sources) !== existing.sourceSignature) {
      throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
    }

    const now = new Date();
    const update = await database.journalDailyEntry.updateMany({
      where: {
        id: existing.id,
        userId: input.userId,
        contentRevision: input.expectedContentRevision
      },
      data: {
        status: "saved",
        savedRevision: input.expectedContentRevision,
        savedAt: now,
        updatedAt: now
      }
    });
    if (update.count !== 1) throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");

    const saved = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    if (!saved) throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    await database.journalDailyEntryRevision.create({
      data: {
        entryId: saved.id,
        kind: "user_saved",
        title: saved.title,
        content: saved.content,
        paragraphs: toJsonValue(saved.paragraphs),
        sourceSignature: saved.sourceSignature,
        sourceSnapshot: toJsonValue(saved.sourceSnapshot),
        contentRevision: saved.contentRevision,
        generationTraceId: null
      }
    });
    return mapJournalDailyEntry(saved)!;
  });
}

export async function getLatestSavedJournalDailyEntryRevision(
  userId: string,
  entryId: string
): Promise<JournalDailyEntryRevisionRecord | null> {
  const revision = await prisma.journalDailyEntryRevision.findFirst({
    where: { entryId, kind: "user_saved", entry: { userId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
  return revision ? mapJournalDailyEntryRevision(revision) : null;
}

async function settleJournalDailyEntryGeneration(
  input: SettleJournalDailyEntryGenerationInput,
  status: "failed" | "canceled"
): Promise<JournalDailyEntryGenerationRecord> {
  assertNonEmpty(input.errorCode, "JOURNAL_DAILY_GENERATION_ERROR_INVALID");
  const settled = await prisma.$transaction(async (database) => {
    const generation = await database.journalDailyEntryGeneration.findFirst({
      where: { id: input.generationId, userId: input.userId }
    });
    if (!generation) throw new Error("JOURNAL_DAILY_GENERATION_NOT_FOUND");
    if (generation.status !== "processing") return generation;

    const now = new Date();
    const updated = await database.journalDailyEntryGeneration.update({
      where: { id: generation.id },
      data: status === "failed"
        ? { status, errorCode: input.errorCode, failedAt: now }
        : { status, errorCode: input.errorCode, canceledAt: now }
    });
    if (status === "failed" && generation.entryId) {
      await database.journalDailyEntry.updateMany({
        where: { id: generation.entryId, userId: input.userId },
        data: { lastGenerationErrorCode: input.errorCode }
      });
    }
    if (generation.traceId) {
      await database.aIGenerationTrace.updateMany({
        where: { id: generation.traceId, status: "pending" },
        data: status === "failed"
          ? { status: "failed", errorCode: input.errorCode, failedAt: now }
          : { status: "canceled", errorCode: input.errorCode }
      });
    }
    return updated;
  });
  return mapJournalDailyEntryGeneration(settled)!;
}

export function failJournalDailyEntryGeneration(input: SettleJournalDailyEntryGenerationInput) {
  return settleJournalDailyEntryGeneration(input, "failed");
}

export function cancelJournalDailyEntryGeneration(input: SettleJournalDailyEntryGenerationInput) {
  return settleJournalDailyEntryGeneration(input, "canceled");
}
