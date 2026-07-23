import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";
import { validateJournalDailyInsightDraft } from "@/features/journal-daily/insight-policy";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import { createAIGenerationTraceWithClient } from "@/server/repositories/ai-quality.repository";
import { prisma } from "@/server/db/prisma";
import { formatEntryDate, getEntryDateRangeBounds, parseEntryDateInput } from "@/features/interview/entry-date";
import type {
  CompleteJournalDailyEntryGenerationInput,
  CompleteJournalDailySelfInsightGenerationInput,
  CompleteJournalDailySelfInsightGenerationResult,
  CommitJournalDailyEntryDraftInput,
  JournalDailyEntryRecord,
  JournalDailyEntryGenerationRecord,
  JournalDailyEntrySourceSnapshot,
  JournalDailyJournalView,
  JournalDailySourceEntry,
  ReserveJournalDailyEntryGenerationInput,
  ReserveJournalDailyEntryGenerationResult,
  SaveJournalDailyEntryInput,
  SettleJournalDailyEntryGenerationInput,
  UpdateJournalDailyEntryInput
} from "@/types/journal-daily-entry";

type SourceDatabaseClient = Pick<Prisma.TransactionClient, "journalEventEntry">;
type StoredJournalDailyEntry = Prisma.JournalDailyEntryGetPayload<Record<never, never>>;
type StoredJournalDailyEntryGeneration =
  Prisma.JournalDailyEntryGenerationGetPayload<Record<never, never>>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromJsonValue<T>(value: Prisma.JsonValue): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeDate(value: Date | null) {
  return value?.toISOString() ?? null;
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

function mapJournalDailyEntry(entry: StoredJournalDailyEntry | null): JournalDailyEntryRecord | null {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    entryDate: formatEntryDate(entry.entryDate),
    title: entry.title,
    content: entry.content,
    status: entry.status,
    sourceEntryIds: entry.sourceEntryIds,
    sourceEventIds: entry.sourceEventIds,
    sourceSignature: entry.sourceSignature,
    sourceSnapshot: fromJsonValue<JournalDailyEntrySourceSnapshot>(entry.sourceSnapshot),
    sourceUpdatedAt: serializeDate(entry.sourceUpdatedAt),
    contentRevision: entry.contentRevision,
    savedRevision: entry.savedRevision,
    editedAt: serializeDate(entry.editedAt),
    savedAt: serializeDate(entry.savedAt),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function mapJournalDailyEntryGeneration(
  generation: StoredJournalDailyEntryGeneration | null
): JournalDailyEntryGenerationRecord | null {
  if (!generation) {
    return null;
  }

  return {
    id: generation.id,
    entryDate: formatEntryDate(generation.entryDate),
    operationKind: generation.operationKind,
    clientOperationId: generation.clientOperationId,
    intendedEntryId: generation.intendedEntryId,
    resultEntryId: generation.resultEntryId,
    traceId: generation.traceId,
    status: generation.status,
    attemptCount: generation.attemptCount,
    sourceSignature: generation.sourceSignature,
    sourceEntryIds: generation.sourceEntryIds,
    sourceEventIds: generation.sourceEventIds,
    sourceSnapshot: fromJsonValue<JournalDailyEntrySourceSnapshot>(generation.sourceSnapshot),
    baseContentRevision: generation.baseContentRevision,
    replaceManualEditsConfirmed: generation.replaceManualEditsConfirmed,
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
  return {
    schemaVersion: 1,
    entryDate,
    sources
  };
}

function getSourceSignature(sources: JournalDailySourceEntry[]) {
  return buildJournalDailySourceSignature(sources);
}

function getGenerationSourceHash(sourceSignature: string) {
  return createHash("sha256").update(sourceSignature).digest("hex");
}

function isUniqueConflict(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002")
  );
}

function getLatestSavedAt(sources: JournalDailySourceEntry[]) {
  const latest = sources.reduce<string | null>((current, source) => {
    if (!current || source.savedAt > current) {
      return source.savedAt;
    }

    return current;
  }, null);

  return latest ? new Date(latest) : null;
}

async function listSavedJournalEventEntriesForDailyJournalWithClient(
  database: SourceDatabaseClient,
  userId: string,
  entryDate: string
): Promise<JournalDailySourceEntry[]> {
  const { startAt, endExclusive } = getEntryDateRangeBounds(entryDate);
  const entries = await database.journalEventEntry.findMany({
    where: {
      status: "saved",
      savedRevision: { not: null },
      savedAt: { not: null },
      event: {
        userId,
        status: "completed",
        entryDate: {
          gte: startAt,
          lt: endExclusive
        }
      }
    },
    select: {
      id: true,
      title: true,
      content: true,
      contentRevision: true,
      savedRevision: true,
      savedAt: true,
      event: {
        select: {
          id: true,
          entryDate: true,
          daySequence: true
        }
      }
    },
    orderBy: [
      { event: { daySequence: "asc" } },
      { id: "asc" }
    ]
  });

  return entries.flatMap((entry) => {
    if (
      entry.savedRevision === null ||
      entry.savedRevision !== entry.contentRevision ||
      !entry.savedAt
    ) {
      return [];
    }

    return [{
      eventId: entry.event.id,
      entryId: entry.id,
      entryDate: formatEntryDate(entry.event.entryDate),
      daySequence: entry.event.daySequence,
      title: entry.title,
      content: entry.content,
      savedRevision: entry.savedRevision,
      savedAt: entry.savedAt.toISOString()
    }];
  });
}

async function listPendingJournalEventEntryIdsForDateWithClient(
  database: SourceDatabaseClient,
  userId: string,
  entryDate: string
) {
  const { startAt, endExclusive } = getEntryDateRangeBounds(entryDate);
  const entries = await database.journalEventEntry.findMany({
    where: {
      status: { in: ["draft", "modified"] },
      event: {
        userId,
        status: "completed",
        entryDate: {
          gte: startAt,
          lt: endExclusive
        }
      }
    },
    select: { id: true },
    orderBy: { id: "asc" }
  });

  return entries.map((entry) => entry.id);
}

async function findJournalDailyEntryByDateWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntry">,
  userId: string,
  entryDate: string
) {
  return database.journalDailyEntry.findUnique({
    where: {
      userId_entryDate: {
        userId,
        entryDate: parseEntryDateInput(entryDate)
      }
    }
  });
}

async function findJournalDailyEntryForUserWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntry">,
  userId: string,
  entryId: string
) {
  return database.journalDailyEntry.findFirst({
    where: { id: entryId, userId }
  });
}

async function findJournalDailyEntryGenerationForUserWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntryGeneration">,
  userId: string,
  generationId: string
) {
  return database.journalDailyEntryGeneration.findFirst({
    where: { id: generationId, userId }
  });
}

async function findJournalDailyEntryGenerationForOperationWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntryGeneration">,
  input: Pick<
    ReserveJournalDailyEntryGenerationInput,
    "userId" | "entryDate" | "clientOperationId"
  >
) {
  return database.journalDailyEntryGeneration.findUnique({
    where: {
      userId_entryDate_clientOperationId: {
        userId: input.userId,
        entryDate: parseEntryDateInput(input.entryDate),
        clientOperationId: input.clientOperationId
      }
    }
  });
}

async function findLatestJournalDailyEntryGenerationWithClient(
  database: Pick<Prisma.TransactionClient, "journalDailyEntryGeneration">,
  userId: string,
  entryDate: string
) {
  return database.journalDailyEntryGeneration.findFirst({
    where: {
      userId,
      entryDate: parseEntryDateInput(entryDate)
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function listSavedJournalEventEntriesForDailyJournal(userId: string, entryDate: string) {
  return listSavedJournalEventEntriesForDailyJournalWithClient(prisma, userId, entryDate);
}

export async function getJournalDailyEntry(userId: string, entryDate: string) {
  const entry = await findJournalDailyEntryByDateWithClient(prisma, userId, entryDate);
  return mapJournalDailyEntry(entry);
}

export async function getJournalDailyEntryForUser(userId: string, entryId: string) {
  const entry = await findJournalDailyEntryForUserWithClient(prisma, userId, entryId);
  return mapJournalDailyEntry(entry);
}

export async function getJournalDailyEntryGenerationForUser(
  userId: string,
  generationId: string
) {
  const generation = await findJournalDailyEntryGenerationForUserWithClient(
    prisma,
    userId,
    generationId
  );
  return mapJournalDailyEntryGeneration(generation);
}

export async function getJournalDailyJournalView(
  userId: string,
  entryDate: string
): Promise<JournalDailyJournalView> {
  const [entry, generation, savedSources, pendingSaveEntryIds] = await Promise.all([
    findJournalDailyEntryByDateWithClient(prisma, userId, entryDate),
    findLatestJournalDailyEntryGenerationWithClient(prisma, userId, entryDate),
    listSavedJournalEventEntriesForDailyJournalWithClient(prisma, userId, entryDate),
    listPendingJournalEventEntryIdsForDateWithClient(prisma, userId, entryDate)
  ]);
  const sourceSignature = getSourceSignature(savedSources);
  const collection =
    savedSources.length === 0
      ? { kind: "empty" as const }
      : savedSources.length === 1
        ? { kind: "single_entry" as const, entryId: savedSources[0]!.entryId }
        : { kind: "multiple_entries" as const };
  const mappedEntry = mapJournalDailyEntry(entry);
  const freshness = !mappedEntry
    ? "none"
    : mappedEntry.sourceSignature === sourceSignature
      ? mappedEntry.status
      : "stale";

  return {
    entryDate,
    savedSources,
    pendingSaveEntryIds,
    sourceSignature,
    collection,
    entry: mappedEntry,
    generation: mapJournalDailyEntryGeneration(generation),
    freshness,
    updateBlockedByPendingSource: collection.kind === "multiple_entries" && pendingSaveEntryIds.length > 0
  };
}

async function readReservedJournalDailyEntryGenerationResult(
  database: Pick<
    Prisma.TransactionClient,
    "journalDailyEntryGeneration" | "journalDailyEntry"
  >,
  input: Pick<
    ReserveJournalDailyEntryGenerationInput,
    "userId" | "entryDate" | "clientOperationId" | "operationKind"
  >
): Promise<ReserveJournalDailyEntryGenerationResult | null> {
  const generation = await findJournalDailyEntryGenerationForOperationWithClient(
    database,
    input
  );
  if (!generation) {
    return null;
  }
  if (generation.operationKind !== input.operationKind) {
    throw new Error("JOURNAL_DAILY_OPERATION_CONFLICT");
  }
  if (generation.status === "completed") {
    if (!generation.resultEntryId) {
      throw new Error("JOURNAL_DAILY_GENERATION_STATE_CHANGED");
    }
    const entry = await findJournalDailyEntryForUserWithClient(
      database,
      input.userId,
      generation.resultEntryId
    );
    const mappedEntry = mapJournalDailyEntry(entry);
    if (!mappedEntry) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }
    return {
      kind: "entry",
      entry: mappedEntry,
      generation: mapJournalDailyEntryGeneration(generation)!
    };
  }
  return {
    kind: "generation",
    generation: mapJournalDailyEntryGeneration(generation)!,
    newlyReserved: false
  };
}

export async function reserveJournalDailyEntryGeneration(
  input: ReserveJournalDailyEntryGenerationInput
): Promise<ReserveJournalDailyEntryGenerationResult> {
  if (
    !input.userId.trim() ||
    !input.entryDate.trim() ||
    !input.clientOperationId.trim() ||
    !input.expectedSourceSignature.trim()
  ) {
    throw new Error("JOURNAL_DAILY_OPERATION_INVALID");
  }
  if (
    input.expectedContentRevision !== null &&
    (!Number.isInteger(input.expectedContentRevision) || input.expectedContentRevision < 1)
  ) {
    throw new Error("JOURNAL_DAILY_ENTRY_VERSION_INVALID");
  }

  try {
    return await prisma.$transaction(async (database) => {
      const replay = await readReservedJournalDailyEntryGenerationResult(
        database,
        input
      );
      if (replay) {
        return replay;
      }

      const [savedSources, pendingSaveEntryIds, existingEntry] = await Promise.all([
        listSavedJournalEventEntriesForDailyJournalWithClient(
          database,
          input.userId,
          input.entryDate
        ),
        listPendingJournalEventEntryIdsForDateWithClient(
          database,
          input.userId,
          input.entryDate
        ),
        findJournalDailyEntryByDateWithClient(
          database,
          input.userId,
          input.entryDate
        )
      ]);
      if (savedSources.length < 2) {
        throw new Error("JOURNAL_DAILY_SOURCE_INSUFFICIENT");
      }
      if (pendingSaveEntryIds.length > 0) {
        throw new Error("JOURNAL_DAILY_PENDING_EVENT_ENTRY");
      }

      const currentSourceSignature = getSourceSignature(savedSources);
      if (currentSourceSignature !== input.expectedSourceSignature) {
        throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
      }

      if (input.operationKind === "self_insight") {
        if (
          !existingEntry ||
          input.expectedContentRevision === null ||
          existingEntry.contentRevision !== input.expectedContentRevision ||
          existingEntry.sourceSignature !== currentSourceSignature
        ) {
          throw new Error(
            existingEntry?.sourceSignature !== currentSourceSignature
              ? "JOURNAL_DAILY_SOURCE_CHANGED"
              : "JOURNAL_DAILY_ENTRY_VERSION_CHANGED"
          );
        }
      } else if (existingEntry) {
        if (existingEntry.contentRevision !== input.expectedContentRevision) {
          throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
        }
        if (
          existingEntry.status === "modified" &&
          !input.replaceManualEditsConfirmed
        ) {
          throw new Error("JOURNAL_DAILY_MANUAL_EDITS_CONFIRMATION_REQUIRED");
        }
      } else if (input.expectedContentRevision !== null) {
        throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
      }

      const sourceSnapshot = buildSourceSnapshot(input.entryDate, savedSources);
      const sourceHash = getGenerationSourceHash(currentSourceSignature);
      const intendedEntryId = existingEntry?.id ?? randomUUID();
      const generationId = randomUUID();
      const traceId = randomUUID();
      await createAIGenerationTraceWithClient(database, {
        id: traceId,
        requestId: input.requestId ?? null,
        userId: input.userId,
        artifactType:
          input.operationKind === "daily_journal"
            ? "daily_journal"
            : "daily_journal_insight",
        artifactId: intendedEntryId,
        artifactVersion: (existingEntry?.contentRevision ?? 0) + 1,
        contextSnapshot: sourceSnapshot,
        pipelineDecisions: [
          {
            kind: "journal_daily_generation_reserved",
            generationId,
            operationKind: input.operationKind,
            sourceSignature: currentSourceSignature,
            sourceHash,
            baseContentRevision: existingEntry?.contentRevision ?? null,
            replaceManualEditsConfirmed: input.replaceManualEditsConfirmed
          }
        ]
      });
      const generation = await database.journalDailyEntryGeneration.create({
        data: {
          id: generationId,
          userId: input.userId,
          entryDate: parseEntryDateInput(input.entryDate),
          operationKind: input.operationKind,
          clientOperationId: input.clientOperationId,
          intendedEntryId,
          resultEntryId:
            input.operationKind === "self_insight"
              ? existingEntry!.id
              : existingEntry?.id ?? null,
          traceId,
          status: "processing",
          sourceSignature: sourceHash,
          sourceEntryIds: savedSources.map((source) => source.entryId),
          sourceEventIds: savedSources.map((source) => source.eventId),
          sourceSnapshot: toJsonValue(sourceSnapshot),
          baseContentRevision: existingEntry?.contentRevision ?? null,
          replaceManualEditsConfirmed: input.replaceManualEditsConfirmed
        }
      });
      return {
        kind: "generation",
        generation: mapJournalDailyEntryGeneration(generation)!,
        newlyReserved: true
      };
    });
  } catch (error) {
    const replay = await readReservedJournalDailyEntryGenerationResult(
      prisma,
      input
    );
    if (replay) {
      return replay;
    }
    if (isUniqueConflict(error)) {
      throw new Error("JOURNAL_DAILY_OPERATION_IN_PROGRESS");
    }
    throw error;
  }
}

export async function commitJournalDailyEntryDraft(
  input: CommitJournalDailyEntryDraftInput
): Promise<JournalDailyEntryRecord> {
  assertEntryContent(input.title, input.content);
  if (!input.expectedSourceSignature.trim()) {
    throw new Error("JOURNAL_DAILY_SOURCE_SIGNATURE_INVALID");
  }
  if (input.expectedContentRevision !== null) {
    assertContentRevision(input.expectedContentRevision);
  }

  return prisma.$transaction(async (database) => {
    const [savedSources, pendingSaveEntryIds] = await Promise.all([
      listSavedJournalEventEntriesForDailyJournalWithClient(
        database,
        input.userId,
        input.entryDate
      ),
      listPendingJournalEventEntryIdsForDateWithClient(database, input.userId, input.entryDate)
    ]);
    const currentSignature = getSourceSignature(savedSources);

    if (savedSources.length < 2) {
      throw new Error("JOURNAL_DAILY_SOURCE_INSUFFICIENT");
    }
    if (pendingSaveEntryIds.length > 0) {
      throw new Error("JOURNAL_DAILY_PENDING_EVENT_ENTRY");
    }
    if (currentSignature !== input.expectedSourceSignature) {
      throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
    }

    const existing = await findJournalDailyEntryByDateWithClient(
      database,
      input.userId,
      input.entryDate
    );
    if (existing) {
      if (input.expectedContentRevision !== existing.contentRevision) {
        throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
      }
      if (existing.status === "modified" && !input.replaceManualEditsConfirmed) {
        throw new Error("JOURNAL_DAILY_MANUAL_EDITS_CONFIRMATION_REQUIRED");
      }
    } else if (input.expectedContentRevision !== null) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const sourceSnapshot = buildSourceSnapshot(input.entryDate, savedSources);
    const nextContentRevision = (existing?.contentRevision ?? 0) + 1;
    const data = {
      title: input.title.trim(),
      content: input.content.trim(),
      status: "draft" as const,
      sourceEntryIds: savedSources.map((source) => source.entryId),
      sourceEventIds: savedSources.map((source) => source.eventId),
      sourceSignature: currentSignature,
      sourceSnapshot: toJsonValue(sourceSnapshot),
      sourceUpdatedAt: getLatestSavedAt(savedSources),
      contentRevision: nextContentRevision,
      savedRevision: null,
      editedAt: null,
      savedAt: null
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
      if (update.count !== 1) {
        throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
      }
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

    const mapped = mapJournalDailyEntry(entry);
    if (!mapped) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }

    return mapped;
  });
}

async function getGenerationCompletionContext(
  database: Prisma.TransactionClient,
  input: {
    userId: string;
    generationId: string;
    operationKind: "daily_journal" | "self_insight";
    sourceSignature: string;
  }
) {
  const generation = await findJournalDailyEntryGenerationForUserWithClient(
    database,
    input.userId,
    input.generationId
  );
  if (!generation) {
    throw new Error("JOURNAL_DAILY_GENERATION_NOT_FOUND");
  }
  if (generation.operationKind !== input.operationKind) {
    throw new Error("JOURNAL_DAILY_OPERATION_CONFLICT");
  }
  if (generation.sourceSignature !== getGenerationSourceHash(input.sourceSignature)) {
    throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
  }

  const [savedSources, pendingSaveEntryIds] = await Promise.all([
    listSavedJournalEventEntriesForDailyJournalWithClient(
      database,
      input.userId,
      formatEntryDate(generation.entryDate)
    ),
    listPendingJournalEventEntryIdsForDateWithClient(
      database,
      input.userId,
      formatEntryDate(generation.entryDate)
    )
  ]);
  if (savedSources.length < 2) {
    throw new Error("JOURNAL_DAILY_SOURCE_INSUFFICIENT");
  }
  if (pendingSaveEntryIds.length > 0) {
    throw new Error("JOURNAL_DAILY_PENDING_EVENT_ENTRY");
  }
  const currentSourceSignature = getSourceSignature(savedSources);
  if (
    currentSourceSignature !== input.sourceSignature ||
    getGenerationSourceHash(currentSourceSignature) !== generation.sourceSignature
  ) {
    throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
  }

  return {
    generation,
    savedSources,
    sourceSnapshot: buildSourceSnapshot(
      formatEntryDate(generation.entryDate),
      savedSources
    )
  };
}

async function completeJournalDailyGenerationTrace(
  database: Prisma.TransactionClient,
  input: {
    traceId: string | null;
    outputOrigin: CompleteJournalDailyEntryGenerationInput["outputOrigin"];
    finalOutput: Record<string, unknown>;
    decisions?: Array<Record<string, unknown>>;
  }
) {
  if (!input.traceId) {
    return;
  }
  const trace = await database.aIGenerationTrace.findUnique({
    where: { id: input.traceId },
    select: { status: true, pipelineDecisions: true }
  });
  if (!trace || trace.status !== "pending") {
    throw new Error("JOURNAL_DAILY_GENERATION_STATE_CHANGED");
  }
  const previousDecisions = Array.isArray(trace.pipelineDecisions)
    ? trace.pipelineDecisions
    : [];
  const updated = await database.aIGenerationTrace.updateMany({
    where: { id: input.traceId, status: "pending" },
    data: {
      status: "completed",
      outputOrigin: input.outputOrigin,
      finalOutput: toJsonValue(input.finalOutput),
      pipelineDecisions: toJsonValue([
        ...previousDecisions,
        ...(input.decisions ?? [])
      ]),
      completedAt: new Date()
    }
  });
  if (updated.count !== 1) {
    throw new Error("JOURNAL_DAILY_GENERATION_STATE_CHANGED");
  }
}

export async function completeJournalDailyEntryGeneration(
  input: CompleteJournalDailyEntryGenerationInput
): Promise<JournalDailyEntryRecord> {
  assertEntryContent(input.title, input.content);
  if (!input.sourceSignature.trim()) {
    throw new Error("JOURNAL_DAILY_SOURCE_SIGNATURE_INVALID");
  }

  return prisma.$transaction(async (database) => {
    const context = await getGenerationCompletionContext(database, {
      userId: input.userId,
      generationId: input.generationId,
      operationKind: "daily_journal",
      sourceSignature: input.sourceSignature
    });
    const { generation, savedSources, sourceSnapshot } = context;
    if (generation.status === "completed") {
      if (!generation.resultEntryId) {
        throw new Error("JOURNAL_DAILY_GENERATION_STATE_CHANGED");
      }
      const completed = await findJournalDailyEntryForUserWithClient(
        database,
        input.userId,
        generation.resultEntryId
      );
      const mapped = mapJournalDailyEntry(completed);
      if (!mapped) {
        throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
      }
      return mapped;
    }
    if (generation.status !== "processing") {
      throw new Error("JOURNAL_DAILY_GENERATION_STATE_CHANGED");
    }

    const existing = await findJournalDailyEntryByDateWithClient(
      database,
      input.userId,
      formatEntryDate(generation.entryDate)
    );
    if (generation.baseContentRevision === null) {
      if (existing) {
        throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
      }
    } else if (
      !existing ||
      existing.id !== generation.intendedEntryId ||
      existing.contentRevision !== generation.baseContentRevision
    ) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }
    if (
      existing?.status === "modified" &&
      !generation.replaceManualEditsConfirmed
    ) {
      throw new Error("JOURNAL_DAILY_MANUAL_EDITS_CONFIRMATION_REQUIRED");
    }

    const now = new Date();
    const nextContentRevision = (existing?.contentRevision ?? 0) + 1;
    const entryData = {
      title: input.title.trim(),
      content: input.content.trim(),
      status: "draft" as const,
      sourceEntryIds: savedSources.map((source) => source.entryId),
      sourceEventIds: savedSources.map((source) => source.eventId),
      sourceSignature: input.sourceSignature,
      sourceSnapshot: toJsonValue(sourceSnapshot),
      sourceUpdatedAt: getLatestSavedAt(savedSources),
      contentRevision: nextContentRevision,
      savedRevision: null,
      editedAt: null,
      savedAt: null,
      updatedAt: now
    };
    let entry: StoredJournalDailyEntry | null;
    if (existing) {
      const update = await database.journalDailyEntry.updateMany({
        where: {
          id: existing.id,
          userId: input.userId,
          contentRevision: generation.baseContentRevision!
        },
        data: entryData
      });
      if (update.count !== 1) {
        throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
      }
      entry = await findJournalDailyEntryForUserWithClient(
        database,
        input.userId,
        existing.id
      );
    } else {
      entry = await database.journalDailyEntry.create({
        data: {
          id: generation.intendedEntryId,
          userId: input.userId,
          entryDate: generation.entryDate,
          ...entryData
        }
      });
    }
    const mappedEntry = mapJournalDailyEntry(entry);
    if (!mappedEntry) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }

    const generationUpdate = await database.journalDailyEntryGeneration.updateMany({
      where: { id: generation.id, status: "processing" },
      data: {
        status: "completed",
        resultEntryId: mappedEntry.id,
        completedAt: now,
        errorCode: null
      }
    });
    if (generationUpdate.count !== 1) {
      throw new Error("JOURNAL_DAILY_GENERATION_STATE_CHANGED");
    }
    await completeJournalDailyGenerationTrace(database, {
      traceId: generation.traceId,
      outputOrigin: input.outputOrigin,
      finalOutput: {
        title: mappedEntry.title,
        content: mappedEntry.content,
        sourceEventIds: mappedEntry.sourceEventIds
      },
      decisions: [
        ...(input.pipelineDecisions ?? []),
        {
          kind: "journal_daily_generation_completed",
          generationId: generation.id,
          sourceEntryIds: mappedEntry.sourceEntryIds,
          contentRevision: mappedEntry.contentRevision
        }
      ]
    });
    return mappedEntry;
  });
}

function appendSelfInsight(content: string, insight: string) {
  if (/^##\s*今天看见的自己\s*$/mu.test(content)) {
    throw new Error("JOURNAL_DAILY_INSIGHT_ALREADY_PRESENT");
  }
  return `${content.trimEnd()}\n\n## 今天看见的自己\n${insight.trim()}`;
}

export async function completeJournalDailySelfInsightGeneration(
  input: CompleteJournalDailySelfInsightGenerationInput
): Promise<CompleteJournalDailySelfInsightGenerationResult> {
  if (
    !input.sourceSignature.trim() ||
    !Number.isInteger(input.baseContentRevision) ||
    input.baseContentRevision < 1
  ) {
    throw new Error("JOURNAL_DAILY_OPERATION_INVALID");
  }

  return prisma.$transaction(async (database) => {
    const context = await getGenerationCompletionContext(database, {
      userId: input.userId,
      generationId: input.generationId,
      operationKind: "self_insight",
      sourceSignature: input.sourceSignature
    });
    const { generation, savedSources } = context;
    const resultEntryId = generation.resultEntryId ?? generation.intendedEntryId;
    const currentEntry = await findJournalDailyEntryForUserWithClient(
      database,
      input.userId,
      resultEntryId
    );
    const mappedCurrent = mapJournalDailyEntry(currentEntry);
    if (!mappedCurrent) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }
    if (generation.status === "completed") {
      return {
        kind:
          mappedCurrent.contentRevision === generation.baseContentRevision
            ? "insufficient_evidence"
            : "appended",
        entry: mappedCurrent
      };
    }
    if (generation.status !== "processing") {
      throw new Error("JOURNAL_DAILY_GENERATION_STATE_CHANGED");
    }
    if (
      generation.baseContentRevision !== input.baseContentRevision ||
      currentEntry!.contentRevision !== input.baseContentRevision ||
      currentEntry!.sourceSignature !== input.sourceSignature
    ) {
      throw new Error(
        currentEntry!.sourceSignature !== input.sourceSignature
          ? "JOURNAL_DAILY_SOURCE_CHANGED"
          : "JOURNAL_DAILY_ENTRY_VERSION_CHANGED"
      );
    }

    const now = new Date();
    let resultEntry = currentEntry!;
    let resultKind: CompleteJournalDailySelfInsightGenerationResult["kind"] =
      "insufficient_evidence";
    if (input.selfInsight) {
      const validation = validateJournalDailyInsightDraft(
        {
          title: currentEntry!.title,
          selfInsight: input.selfInsight
        },
        savedSources
      );
      if (!validation.accepted || !validation.insight) {
        throw new Error("JOURNAL_DAILY_INSIGHT_QUALITY_CHECK_FAILED");
      }
      const nextContent = appendSelfInsight(
        currentEntry!.content,
        validation.insight.text
      );
      const update = await database.journalDailyEntry.updateMany({
        where: {
          id: currentEntry!.id,
          userId: input.userId,
          contentRevision: input.baseContentRevision,
          sourceSignature: input.sourceSignature
        },
        data: {
          content: nextContent,
          status: currentEntry!.status === "draft" ? "draft" : "modified",
          contentRevision: { increment: 1 },
          editedAt: now
        }
      });
      if (update.count !== 1) {
        throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
      }
      const updated = await findJournalDailyEntryForUserWithClient(
        database,
        input.userId,
        currentEntry!.id
      );
      if (!updated) {
        throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
      }
      resultEntry = updated;
      resultKind = "appended";
    }
    const mappedEntry = mapJournalDailyEntry(resultEntry)!;
    const generationUpdate = await database.journalDailyEntryGeneration.updateMany({
      where: { id: generation.id, status: "processing" },
      data: {
        status: "completed",
        resultEntryId: mappedEntry.id,
        completedAt: now,
        errorCode: null
      }
    });
    if (generationUpdate.count !== 1) {
      throw new Error("JOURNAL_DAILY_GENERATION_STATE_CHANGED");
    }
    await completeJournalDailyGenerationTrace(database, {
      traceId: generation.traceId,
      outputOrigin: input.outputOrigin,
      finalOutput: {
        selfInsight: input.selfInsight,
        outcome: resultKind,
        contentRevision: mappedEntry.contentRevision
      },
      decisions: [
        ...(input.pipelineDecisions ?? []),
        {
          kind: "journal_daily_self_insight_completed",
          generationId: generation.id,
          outcome: resultKind,
          sourceEventIds: input.selfInsight?.sourceEventIds ?? []
        }
      ]
    });
    return { kind: resultKind, entry: mappedEntry };
  });
}

async function settleJournalDailyEntryGeneration(
  input: SettleJournalDailyEntryGenerationInput,
  status: "failed" | "canceled"
) {
  if (!input.errorCode.trim()) {
    throw new Error("JOURNAL_DAILY_GENERATION_ERROR_INVALID");
  }
  return prisma.$transaction(async (database) => {
    const generation = await findJournalDailyEntryGenerationForUserWithClient(
      database,
      input.userId,
      input.generationId
    );
    if (!generation) {
      throw new Error("JOURNAL_DAILY_GENERATION_NOT_FOUND");
    }
    if (generation.status !== "processing") {
      return mapJournalDailyEntryGeneration(generation)!;
    }
    const now = new Date();
    const update = await database.journalDailyEntryGeneration.updateMany({
      where: { id: generation.id, status: "processing" },
      data:
        status === "failed"
          ? {
              status,
              failedAt: now,
              errorCode: input.errorCode
            }
          : {
              status,
              canceledAt: now,
              errorCode: input.errorCode
            }
    });
    if (update.count !== 1) {
      throw new Error("JOURNAL_DAILY_GENERATION_STATE_CHANGED");
    }
    if (generation.traceId) {
      await database.aIGenerationTrace.updateMany({
        where: { id: generation.traceId, status: "pending" },
        data: {
          status,
          errorCode: input.errorCode,
          failedAt: now
        }
      });
    }
    const settled = await findJournalDailyEntryGenerationForUserWithClient(
      database,
      input.userId,
      input.generationId
    );
    return mapJournalDailyEntryGeneration(settled)!;
  });
}

export function failJournalDailyEntryGeneration(
  input: SettleJournalDailyEntryGenerationInput
) {
  return settleJournalDailyEntryGeneration(input, "failed");
}

export function cancelJournalDailyEntryGeneration(
  input: SettleJournalDailyEntryGenerationInput
) {
  return settleJournalDailyEntryGeneration(input, "canceled");
}

export async function updateJournalDailyEntry(
  input: UpdateJournalDailyEntryInput
): Promise<JournalDailyEntryRecord> {
  assertEntryContent(input.title, input.content);
  assertContentRevision(input.expectedContentRevision);

  return prisma.$transaction(async (database) => {
    const existing = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    if (!existing) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const savedSources = await listSavedJournalEventEntriesForDailyJournalWithClient(
      database,
      input.userId,
      formatEntryDate(existing.entryDate)
    );
    if (savedSources.length < 2) {
      throw new Error("JOURNAL_DAILY_ENTRY_READ_ONLY");
    }
    if (getSourceSignature(savedSources) !== existing.sourceSignature) {
      throw new Error("JOURNAL_DAILY_SOURCE_CHANGED");
    }

    const update = await database.journalDailyEntry.updateMany({
      where: {
        id: existing.id,
        userId: input.userId,
        contentRevision: existing.contentRevision
      },
      data: {
        title: input.title.trim(),
        content: input.content.trim(),
        status: existing.status === "draft" ? "draft" : "modified",
        contentRevision: { increment: 1 },
        editedAt: new Date()
      }
    });
    if (update.count !== 1) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const updated = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    const mapped = mapJournalDailyEntry(updated);
    if (!mapped) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }

    return mapped;
  });
}

export async function saveJournalDailyEntry(
  input: SaveJournalDailyEntryInput
): Promise<JournalDailyEntryRecord> {
  assertContentRevision(input.expectedContentRevision);

  return prisma.$transaction(async (database) => {
    const existing = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    if (!existing) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const savedSources = await listSavedJournalEventEntriesForDailyJournalWithClient(
      database,
      input.userId,
      formatEntryDate(existing.entryDate)
    );
    if (savedSources.length < 2 || getSourceSignature(savedSources) !== existing.sourceSignature) {
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
    if (update.count !== 1) {
      throw new Error("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }

    const saved = await findJournalDailyEntryForUserWithClient(database, input.userId, input.entryId);
    const mapped = mapJournalDailyEntry(saved);
    if (!mapped) {
      throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
    }

    return mapped;
  });
}
