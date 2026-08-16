import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/server/db/prisma";
import { createAIGenerationTraceWithClient } from "@/server/repositories/ai-quality.repository";
import {
  getEffectiveJournalEventAngleProjectionWithClient
} from "@/server/repositories/journal-event-angle-outcome.repository";
import {
  assertEventCenteredForwardOperationAllowedWithClient,
  getEffectiveJournalEventFactProjectionWithClient,
  getEventCenteredRouteWithClient
} from "@/server/repositories/journal-event-fact-revision.repository";
import { confirmPendingUnderstandingClaimWithClient } from "@/server/repositories/journal-event-understanding.repository";
import { JOURNAL_EVENT_ANGLES } from "@/types/journal-event-angle-outcome";
import type {
  CompleteJournalEventEntryGenerationInput,
  JournalEventEntryGenerationRecord,
  JournalEventEntryRecord,
  JournalEventEntrySourceSnapshot,
  MaterializeJournalEventEntryCardInput,
  ReserveJournalEventEntryGenerationInput,
  ReserveJournalEventEntryGenerationResult,
  SaveJournalEventEntryInput,
  SettleJournalEventEntryGenerationInput,
  UpdateJournalEventEntryInput
} from "@/types/journal-event-entry";

type DatabaseClient = Prisma.TransactionClient;

const entryInclude = {
  event: {
    select: {
      entryDate: true,
      daySequence: true
    }
  }
} satisfies Prisma.JournalEventEntryInclude;

type StoredEntry = Prisma.JournalEventEntryGetPayload<{
  include: typeof entryInclude;
}>;

type StoredGeneration = Prisma.JournalEventEntryGenerationGetPayload<Record<never, never>>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromJsonValue<T>(value: Prisma.JsonValue): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeDate(value: Date | null) {
  return value?.toISOString() ?? null;
}

function mapEntry(entry: StoredEntry): JournalEventEntryRecord {
  return {
    id: entry.id,
    eventId: entry.eventId,
    entryDate: entry.event.entryDate.toISOString(),
    daySequence: entry.event.daySequence,
    sourceBranchSessionId: entry.sourceBranchSessionId,
    generatedByTurnId: entry.generatedByTurnId,
    currentGenerationTraceId: entry.currentGenerationTraceId,
    generationId: entry.generationId,
    title: entry.title,
    content: entry.content,
    occurredAtText: entry.occurredAtText,
    status: entry.status,
    generationOrigin: entry.generationOrigin,
    generationVersion: entry.generationVersion,
    sourceMessageSequence: entry.sourceMessageSequence,
    sourceMessageIds: entry.sourceMessageIds,
    sourceFactIds: entry.sourceFactIds,
    sourceAngleOutcomeIds: entry.sourceAngleOutcomeIds,
    sourceFingerprint: entry.sourceFingerprint,
    sourceSnapshot: fromJsonValue<JournalEventEntrySourceSnapshot>(entry.sourceSnapshot),
    contentRevision: entry.contentRevision,
    savedRevision: entry.savedRevision,
    editedAt: serializeDate(entry.editedAt),
    savedAt: serializeDate(entry.savedAt),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function mapGeneration(generation: StoredGeneration): JournalEventEntryGenerationRecord {
  return {
    id: generation.id,
    eventId: generation.eventId,
    branchSessionId: generation.branchSessionId,
    userTurnId: generation.userTurnId,
    traceId: generation.traceId,
    clientOperationId: generation.clientOperationId,
    intendedEntryId: generation.intendedEntryId,
    status: generation.status,
    attemptCount: generation.attemptCount,
    baseMessageSequence: generation.baseMessageSequence,
    sourceMessageIds: generation.sourceMessageIds,
    sourceFactIds: generation.sourceFactIds,
    sourceAngleOutcomeIds: generation.sourceAngleOutcomeIds,
    sourceFingerprint: generation.sourceFingerprint,
    sourceSnapshot: fromJsonValue<JournalEventEntrySourceSnapshot>(generation.sourceSnapshot),
    errorCode: generation.errorCode,
    startedAt: generation.startedAt.toISOString(),
    completedAt: serializeDate(generation.completedAt),
    failedAt: serializeDate(generation.failedAt),
    canceledAt: serializeDate(generation.canceledAt),
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString()
  };
}

function assertNonEmpty(value: string, code: string) {
  if (!value.trim()) throw new Error(code);
}

function assertPositiveInteger(value: number, code: string) {
  if (!Number.isInteger(value) || value < 0) throw new Error(code);
}

function assertEntryContent(title: string, content: string) {
  if (!title.trim() || [...title.trim()].length > 16 || !content.trim()) {
    throw new Error("EVENT_JOURNAL_ENTRY_INVALID");
  }
}

function uniqueNonEmptyLines(values: string[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const line = value.trim();
    const fingerprint = line.replace(/\s+/gu, "");
    if (!fingerprint || seen.has(fingerprint)) return [];
    seen.add(fingerprint);
    return [line];
  });
}

function truncateCardTitle(value: string) {
  const firstSentence = value
    .replace(/\s+/gu, " ")
    .split(/[。！？!?\n]/u, 1)[0]
    ?.trim() ?? "";
  const title = [...firstSentence].slice(0, 16).join("").trim();
  return title || "今天的一件事";
}

function extractOccurredAtText(values: string[]) {
  const timePattern = /(?:前天|昨天|今天|今早|早上|上午|中午|下午|傍晚|晚上|夜里|刚才|刚刚|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}(?::\d{2}|点(?:半|\d{1,2}分)?))/u;
  for (const value of values) {
    const match = value.match(timePattern)?.[0];
    if (match) return match.slice(0, 32);
  }
  return null;
}

function buildDeterministicRecordCardDraft(snapshot: JournalEventEntrySourceSnapshot) {
  const effectiveFactIds = new Set(snapshot.effectiveFactIds);
  const effectiveFacts = snapshot.facts
    .filter((fact) => effectiveFactIds.has(fact.id) && fact.stance === "affirmed")
    .map((fact) => fact.statement);
  const userMessages = snapshot.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content);
  const sourceLines = uniqueNonEmptyLines(
    effectiveFacts.length > 0 ? effectiveFacts : userMessages
  );
  if (sourceLines.length === 0) return null;
  return {
    title: truncateCardTitle(sourceLines[0]!),
    content: sourceLines.join("\n\n"),
    occurredAtText: extractOccurredAtText([...sourceLines, ...userMessages])
  };
}

function isUniqueConflict(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    (typeof error === "object" && error !== null && "code" in error &&
      (error as { code?: unknown }).code === "P2002")
  );
}

function hashSource(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildJournalEventEntrySourceFingerprint(input: {
  eventId: string;
  activeBranchSessionId: string;
  baseMessageSequence: number;
  sourceMessageIds: string[];
  sourceFactIds: string[];
  deprioritizedFactIds: string[];
  explorationFactIds: string[];
  sourceAngleOutcomeIds: string[];
}) {
  return hashSource({
    eventId: input.eventId,
    activeBranchSessionId: input.activeBranchSessionId,
    baseMessageSequence: input.baseMessageSequence,
    sourceMessageIds: input.sourceMessageIds,
    sourceFactIds: input.sourceFactIds,
    deprioritizedFactIds: [...input.deprioritizedFactIds].sort(),
    explorationFactIds: [...input.explorationFactIds].sort(),
    sourceAngleOutcomeIds: input.sourceAngleOutcomeIds
  });
}

async function readCurrentSourceFingerprintWithClient(
  database: DatabaseClient,
  input: {
    eventId: string;
    activeBranchSessionId: string;
    baseMessageSequence: number;
    returnTurnId?: string | null;
  }
) {
  const [route, factProjection, angleProjection] = await Promise.all([
    getEventCenteredRouteWithClient(database, {
      eventId: input.eventId,
      activeBranchSessionId: input.activeBranchSessionId,
      requireWritable: false
    }),
    getEffectiveJournalEventFactProjectionWithClient(
      database,
      input.eventId,
      input.activeBranchSessionId
    ),
    getEffectiveJournalEventAngleProjectionWithClient(
      database,
      input.eventId,
      input.activeBranchSessionId
    )
  ]);
  if ((route.path.messages.at(-1)?.sequence ?? 0) !== input.baseMessageSequence) {
    return null;
  }
  const messageRows = await database.interviewMessage.findMany({
    where: { id: { in: route.path.messages.map((message) => message.id) } },
    select: { id: true, userTurnId: true }
  });
  const internalReturnMessageIds = new Set(
    messageRows
      .filter((message) => input.returnTurnId && message.userTurnId === input.returnTurnId)
      .map((message) => message.id)
  );
  const sourceMessageIds = route.path.messages
    .map((message) => message.id)
    .filter((messageId) => !internalReturnMessageIds.has(messageId));
  const eligibleOutcomeIds = new Set(angleProjection.logEligibleOutcomeIds);
  const sourceAngleOutcomeIds = JOURNAL_EVENT_ANGLES.flatMap((angle) => {
    const outcome = angleProjection.outcomesByAngle[angle];
    return outcome && eligibleOutcomeIds.has(outcome.id) ? [outcome.id] : [];
  });
  return buildJournalEventEntrySourceFingerprint({
    eventId: input.eventId,
    activeBranchSessionId: input.activeBranchSessionId,
    baseMessageSequence: input.baseMessageSequence,
    sourceMessageIds,
    sourceFactIds: factProjection.effectiveFactIds,
    deprioritizedFactIds: factProjection.deprioritizedFactIds,
    explorationFactIds: factProjection.explorationFactIds,
    sourceAngleOutcomeIds
  });
}

async function settleRecordCardReturnWithClient(
  database: DatabaseClient,
  input: Pick<
    MaterializeJournalEventEntryCardInput,
    "userId" | "eventId" | "returnTurnId"
  >
) {
  const event = await database.journalEvent.findFirst({
    where: { id: input.eventId, userId: input.userId },
    select: { id: true, rootSessionId: true, status: true }
  });
  if (!event || event.status === "abandoned") throw new Error("EVENT_STATE_CHANGED");

  const now = new Date();
  if (event.status === "active") {
    const transition = await database.journalEvent.updateMany({
      where: { id: event.id, userId: input.userId, status: "active" },
      data: { status: "completed", completedAt: now, generationStartedAt: null }
    });
    if (transition.count !== 1) throw new Error("EVENT_STATE_CHANGED");
  } else if (event.status !== "completed") {
    throw new Error("EVENT_STATE_CHANGED");
  }

  if (input.returnTurnId) {
    await database.interviewUserTurn.updateMany({
      where: {
        id: input.returnTurnId,
        journalEventId: event.id,
        action: "exit_event",
        status: "processing"
      },
      data: { status: "completed", errorCode: null, completedAt: now }
    });
  }

  await database.interviewSession.updateMany({
    where: {
      userId: input.userId,
      mode: "event_centered",
      OR: [{ id: event.rootSessionId }, { rootSessionId: event.rootSessionId }]
    },
    data: { status: "completed", completedAt: now, lastActivityAt: now }
  });
}

async function findEntryForUser(
  database: Pick<Prisma.TransactionClient, "journalEventEntry">,
  userId: string,
  entryId: string
) {
  return database.journalEventEntry.findFirst({
    where: {
      id: entryId,
      event: { userId }
    },
    include: entryInclude
  });
}

async function findEntryForEvent(
  database: Pick<Prisma.TransactionClient, "journalEventEntry">,
  userId: string,
  eventId: string
) {
  return database.journalEventEntry.findFirst({
    where: {
      eventId,
      event: { userId }
    },
    include: entryInclude
  });
}

async function confirmRecordCardForReturnWithClient(
  database: DatabaseClient,
  input: MaterializeJournalEventEntryCardInput
) {
  const existing = await findEntryForEvent(database, input.userId, input.eventId);
  if (!existing) throw new Error("EVENT_JOURNAL_ENTRY_NOT_FOUND");
  if (
    existing.status === "saved" &&
    existing.savedRevision === existing.contentRevision &&
    existing.savedAt
  ) {
    return existing;
  }

  const update = await database.journalEventEntry.updateMany({
    where: {
      id: existing.id,
      contentRevision: existing.contentRevision
    },
    data: {
      status: "saved",
      savedRevision: existing.contentRevision,
      savedAt: new Date(),
      generatedByTurnId: existing.generatedByTurnId ?? input.returnTurnId ?? null
    }
  });
  if (update.count !== 1) throw new Error("EVENT_STATE_CHANGED");

  const saved = await findEntryForEvent(database, input.userId, input.eventId);
  if (
    !saved ||
    saved.status !== "saved" ||
    saved.savedRevision !== saved.contentRevision ||
    !saved.savedAt
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  return saved;
}

async function findGenerationForOperation(
  database: Pick<Prisma.TransactionClient, "journalEventEntryGeneration">,
  userId: string,
  eventId: string,
  clientOperationId: string
) {
  return database.journalEventEntryGeneration.findFirst({
    where: {
      eventId,
      clientOperationId,
      event: { userId }
    }
  });
}

async function findGenerationForUser(
  database: Pick<Prisma.TransactionClient, "journalEventEntryGeneration">,
  userId: string,
  generationId: string
) {
  return database.journalEventEntryGeneration.findFirst({
    where: {
      id: generationId,
      event: { userId }
    }
  });
}

async function readReservedResult(
  database: Pick<
    Prisma.TransactionClient,
    "journalEventEntry" | "journalEventEntryGeneration"
  >,
  userId: string,
  eventId: string,
  clientOperationId: string
): Promise<ReserveJournalEventEntryGenerationResult | null> {
  const [entry, generation] = await Promise.all([
    findEntryForEvent(database, userId, eventId),
    findGenerationForOperation(database, userId, eventId, clientOperationId)
  ]);
  if (entry) return { kind: "entry", entry: mapEntry(entry) };
  if (generation) return { kind: "generation", generation: mapGeneration(generation) };
  return null;
}

function assertSourceFingerprint(value: string) {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error("EVENT_JOURNAL_SOURCE_FINGERPRINT_INVALID");
  }
}

export async function reserveJournalEventEntryGeneration(
  input: ReserveJournalEventEntryGenerationInput
): Promise<ReserveJournalEventEntryGenerationResult> {
  assertNonEmpty(input.userId, "EVENT_OPERATION_INVALID");
  assertNonEmpty(input.eventId, "EVENT_OPERATION_INVALID");
  assertNonEmpty(input.activeBranchSessionId, "EVENT_OPERATION_INVALID");
  assertNonEmpty(input.clientOperationId, "EVENT_OPERATION_INVALID");
  assertPositiveInteger(input.baseMessageSequence, "EVENT_OPERATION_INVALID");

  try {
    return await prisma.$transaction(async (database) => {
      const existing = await readReservedResult(
        database,
        input.userId,
        input.eventId,
        input.clientOperationId
      );
      if (existing) return existing;

      const completedEntry = await findEntryForEvent(database, input.userId, input.eventId);
      if (completedEntry) return { kind: "entry", entry: mapEntry(completedEntry) };

      const route = await getEventCenteredRouteWithClient(database, {
        eventId: input.eventId,
        activeBranchSessionId: input.activeBranchSessionId,
        userId: input.userId,
        requireWritable: true
      });
      const currentMessageSequence = route.path.messages.at(-1)?.sequence ?? 0;
      if (currentMessageSequence !== input.baseMessageSequence) {
        throw new Error("EVENT_STATE_CHANGED");
      }

      const existingTurn = await database.interviewUserTurn.findUnique({
        where: {
          sessionId_clientTurnId: {
            sessionId: input.activeBranchSessionId,
            clientTurnId: input.clientOperationId
          }
        },
        select: { id: true, action: true, journalEventId: true }
      });
      if (existingTurn) {
        if (
          existingTurn.action === "generate_event_journal" &&
          existingTurn.journalEventId === input.eventId
        ) {
          const replay = await readReservedResult(
            database,
            input.userId,
            input.eventId,
            input.clientOperationId
          );
          if (replay) return replay;
        }
        throw new Error("EVENT_OPERATION_CONFLICT");
      }

      const userTurnId = randomUUID();
      await database.interviewUserTurn.create({
        data: {
          id: userTurnId,
          clientTurnId: input.clientOperationId,
          sessionId: input.activeBranchSessionId,
          journalEventId: input.eventId,
          action: "generate_event_journal",
          baseMessageSequence: input.baseMessageSequence,
          status: "processing"
        }
      });

      const pendingClaimConfirmation = await confirmPendingUnderstandingClaimWithClient(
        database,
        { userTurnId, activeBranchSessionId: input.activeBranchSessionId }
      );
      await assertEventCenteredForwardOperationAllowedWithClient(database, {
        eventId: input.eventId,
        activeBranchSessionId: input.activeBranchSessionId,
        operation: "generate_event_journal"
      });

      const [factProjection, angleProjection, messageRows] = await Promise.all([
        getEffectiveJournalEventFactProjectionWithClient(
          database,
          input.eventId,
          input.activeBranchSessionId
        ),
        getEffectiveJournalEventAngleProjectionWithClient(
          database,
          input.eventId,
          input.activeBranchSessionId
        ),
        database.interviewMessage.findMany({
          where: { id: { in: route.path.messages.map((message) => message.id) } },
          select: { id: true, role: true, sequence: true, content: true }
        })
      ]);
      const messagesById = new Map(messageRows.map((message) => [message.id, message]));
      const sourceMessages = route.path.messages.map((message) => {
        const stored = messagesById.get(message.id);
        if (!stored) throw new Error("EVENT_STATE_CHANGED");
        return {
          id: stored.id,
          role: stored.role,
          sequence: stored.sequence,
          content: stored.content
        };
      });
      const sourceFactIds = factProjection.effectiveFactIds;
      if (sourceMessages.length === 0 || sourceFactIds.length === 0) {
        throw new Error("EVENT_JOURNAL_SOURCE_INSUFFICIENT");
      }
      const logEligibleIds = new Set(angleProjection.logEligibleOutcomeIds);
      const angleOutcomes = JOURNAL_EVENT_ANGLES.flatMap((angle) => {
        const outcome = angleProjection.outcomesByAngle[angle];
        return outcome ? [outcome] : [];
      });
      const sourceAngleOutcomeIds = angleOutcomes
        .map((outcome) => outcome.id)
        .filter((outcomeId) => logEligibleIds.has(outcomeId));
      const sourceFingerprint = buildJournalEventEntrySourceFingerprint({
        eventId: input.eventId,
        activeBranchSessionId: input.activeBranchSessionId,
        baseMessageSequence: input.baseMessageSequence,
        sourceMessageIds: sourceMessages.map((message) => message.id),
        sourceFactIds,
        deprioritizedFactIds: factProjection.deprioritizedFactIds,
        explorationFactIds: factProjection.explorationFactIds,
        sourceAngleOutcomeIds
      });
      const sourceSnapshot: JournalEventEntrySourceSnapshot = {
        schemaVersion: 1,
        eventId: input.eventId,
        branchSessionId: input.activeBranchSessionId,
        baseMessageSequence: input.baseMessageSequence,
        messages: sourceMessages,
        facts: factProjection.facts,
        effectiveFactIds: factProjection.effectiveFactIds,
        deprioritizedFactIds: factProjection.deprioritizedFactIds,
        explorationFactIds: factProjection.explorationFactIds,
        angleOutcomes,
        logEligibleOutcomeIds: sourceAngleOutcomeIds,
        pendingClaimConfirmation
      };
      const generationId = randomUUID();
      const intendedEntryId = randomUUID();
      const traceId = randomUUID();
      const transition = await database.journalEvent.updateMany({
        where: {
          id: input.eventId,
          userId: input.userId,
          status: "active"
        },
        data: {
          status: "generating",
          generationStartedAt: new Date()
        }
      });
      if (transition.count !== 1) throw new Error("EVENT_STATE_CHANGED");

      await createAIGenerationTraceWithClient(database, {
        id: traceId,
        requestId: input.requestId ?? null,
        userId: input.userId,
        sessionId: input.activeBranchSessionId,
        journalEventId: input.eventId,
        dimension: null,
        artifactType: "event_journal",
        artifactId: intendedEntryId,
        artifactVersion: 1,
        triggerMessageId: route.path.messages.at(-1)?.id ?? null,
        contextSnapshot: sourceSnapshot,
        pipelineDecisions: [
          {
            kind: "event_journal_generation_reserved",
            generationId,
            sourceFingerprint,
            sourceFactIds,
            sourceAngleOutcomeIds,
            pendingClaimConfirmation
          }
        ]
      });
      const generation = await database.journalEventEntryGeneration.create({
        data: {
          id: generationId,
          eventId: input.eventId,
          branchSessionId: input.activeBranchSessionId,
          userTurnId,
          traceId,
          clientOperationId: input.clientOperationId,
          intendedEntryId,
          status: "processing",
          baseMessageSequence: input.baseMessageSequence,
          sourceMessageIds: sourceMessages.map((message) => message.id),
          sourceFactIds,
          sourceAngleOutcomeIds,
          sourceFingerprint,
          sourceSnapshot: toJsonValue(sourceSnapshot)
        }
      });
      return { kind: "generation", generation: mapGeneration(generation) };
    }, {
      // The first Preview request may wake a cold database before the journal
      // generation reservation is written; keep this state transition atomic.
      maxWait: 15_000,
      timeout: 60_000
    });
  } catch (error) {
    const replay = await readReservedResult(
      prisma,
      input.userId,
      input.eventId,
      input.clientOperationId
    );
    if (replay) return replay;
    if (isUniqueConflict(error)) throw new Error("EVENT_STATE_CHANGED");
    throw error;
  }
}

export async function getJournalEventEntryForUser(input: {
  userId: string;
  entryId: string;
}): Promise<JournalEventEntryRecord | null> {
  const entry = await findEntryForUser(prisma, input.userId, input.entryId);
  return entry ? mapEntry(entry) : null;
}

export async function getJournalEventEntryForEvent(input: {
  userId: string;
  eventId: string;
}): Promise<JournalEventEntryRecord | null> {
  const entry = await findEntryForEvent(prisma, input.userId, input.eventId);
  return entry ? mapEntry(entry) : null;
}

export async function getJournalEventEntryGenerationForUser(input: {
  userId: string;
  generationId: string;
}): Promise<JournalEventEntryGenerationRecord | null> {
  const generation = await findGenerationForUser(prisma, input.userId, input.generationId);
  return generation ? mapGeneration(generation) : null;
}

/**
 * 为“返回当天 / 暂存当前记录”创建事件卡片。
 *
 * 这条路径只使用已经持久化的用户原话与有效事实，直接写入
 * `JournalEventEntry`，因此不会触发模型调用或产生一条事件日志生成任务。
 * `eventId` 的唯一约束与可靠提交一起保证重复点击、刷新重放后只留下同一张卡片。
 */
export async function materializeJournalEventEntryCard(
  input: MaterializeJournalEventEntryCardInput
): Promise<JournalEventEntryRecord> {
  assertNonEmpty(input.userId, "EVENT_OPERATION_INVALID");
  assertNonEmpty(input.eventId, "EVENT_OPERATION_INVALID");
  assertNonEmpty(input.activeBranchSessionId, "EVENT_OPERATION_INVALID");
  assertPositiveInteger(input.baseMessageSequence, "EVENT_OPERATION_INVALID");

  const finishExisting = async () => prisma.$transaction(async (database) => {
    const existing = await confirmRecordCardForReturnWithClient(database, input);
    await settleRecordCardReturnWithClient(database, input);
    return mapEntry(existing);
  });

  try {
    return await prisma.$transaction(async (database) => {
      const existing = await findEntryForEvent(database, input.userId, input.eventId);
      if (existing) {
        const confirmed = await confirmRecordCardForReturnWithClient(database, input);
        await settleRecordCardReturnWithClient(database, input);
        return mapEntry(confirmed);
      }

      const route = await getEventCenteredRouteWithClient(database, {
        eventId: input.eventId,
        activeBranchSessionId: input.activeBranchSessionId,
        userId: input.userId,
        requireWritable: true
      });
      if ((route.path.messages.at(-1)?.sequence ?? 0) !== input.baseMessageSequence) {
        throw new Error("EVENT_STATE_CHANGED");
      }

      const [factProjection, angleProjection, messageRows] = await Promise.all([
        getEffectiveJournalEventFactProjectionWithClient(
          database,
          input.eventId,
          input.activeBranchSessionId
        ),
        getEffectiveJournalEventAngleProjectionWithClient(
          database,
          input.eventId,
          input.activeBranchSessionId
        ),
        database.interviewMessage.findMany({
          where: { id: { in: route.path.messages.map((message) => message.id) } },
          select: { id: true, userTurnId: true, role: true, sequence: true, content: true }
        })
      ]);
      const messagesById = new Map(messageRows.map((message) => [message.id, message]));
      const sourceMessages = route.path.messages.flatMap((message) => {
        const stored = messagesById.get(message.id);
        if (!stored) throw new Error("EVENT_STATE_CHANGED");
        if (input.returnTurnId && stored.userTurnId === input.returnTurnId) return [];
        return [{
          id: stored.id,
          role: stored.role,
          sequence: stored.sequence,
          content: stored.content
        }];
      });
      const logEligibleIds = new Set(angleProjection.logEligibleOutcomeIds);
      const angleOutcomes = JOURNAL_EVENT_ANGLES.flatMap((angle) => {
        const outcome = angleProjection.outcomesByAngle[angle];
        return outcome ? [outcome] : [];
      });
      const sourceAngleOutcomeIds = angleOutcomes
        .map((outcome) => outcome.id)
        .filter((outcomeId) => logEligibleIds.has(outcomeId));
      const sourceFingerprint = buildJournalEventEntrySourceFingerprint({
        eventId: input.eventId,
        activeBranchSessionId: input.activeBranchSessionId,
        baseMessageSequence: input.baseMessageSequence,
        sourceMessageIds: sourceMessages.map((message) => message.id),
        sourceFactIds: factProjection.effectiveFactIds,
        deprioritizedFactIds: factProjection.deprioritizedFactIds,
        explorationFactIds: factProjection.explorationFactIds,
        sourceAngleOutcomeIds
      });
      const sourceSnapshot: JournalEventEntrySourceSnapshot = {
        schemaVersion: 1,
        eventId: input.eventId,
        branchSessionId: input.activeBranchSessionId,
        baseMessageSequence: input.baseMessageSequence,
        messages: sourceMessages,
        facts: factProjection.facts,
        effectiveFactIds: factProjection.effectiveFactIds,
        deprioritizedFactIds: factProjection.deprioritizedFactIds,
        explorationFactIds: factProjection.explorationFactIds,
        angleOutcomes,
        logEligibleOutcomeIds: sourceAngleOutcomeIds,
        pendingClaimConfirmation: {
          kind: "no_eligible_claim",
          claimId: null,
          factId: null
        }
      };
      const draft = buildDeterministicRecordCardDraft(sourceSnapshot);
      if (!draft) throw new Error("EVENT_RECORD_CARD_SOURCE_INSUFFICIENT");

      const currentFingerprint = await readCurrentSourceFingerprintWithClient(database, {
        eventId: input.eventId,
        activeBranchSessionId: input.activeBranchSessionId,
        baseMessageSequence: input.baseMessageSequence,
        returnTurnId: input.returnTurnId
      });
      if (currentFingerprint !== sourceFingerprint) throw new Error("EVENT_STATE_CHANGED");

      const savedAt = new Date();
      const created = await database.journalEventEntry.create({
        data: {
          id: randomUUID(),
          eventId: input.eventId,
          sourceBranchSessionId: input.activeBranchSessionId,
          generatedByTurnId: input.returnTurnId ?? null,
          currentGenerationTraceId: null,
          generationId: null,
          title: draft.title,
          content: draft.content,
          occurredAtText: draft.occurredAtText,
          status: "saved",
          generationOrigin: "deterministic",
          generationVersion: 1,
          sourceMessageSequence: input.baseMessageSequence,
          sourceMessageIds: sourceMessages.map((message) => message.id),
          sourceFactIds: factProjection.effectiveFactIds,
          sourceAngleOutcomeIds,
          sourceFingerprint,
          sourceSnapshot: toJsonValue(sourceSnapshot),
          contentRevision: 1,
          savedRevision: 1,
          editedAt: null,
          savedAt
        },
        include: entryInclude
      });
      await settleRecordCardReturnWithClient(database, input);
      return mapEntry(created);
    });
  } catch (error) {
    try {
      return await finishExisting();
    } catch {
      if (isUniqueConflict(error)) throw new Error("EVENT_STATE_CHANGED");
      throw error;
    }
  }
}

export async function completeJournalEventEntryGeneration(
  input: CompleteJournalEventEntryGenerationInput
): Promise<JournalEventEntryRecord> {
  assertEntryContent(input.title, input.content);
  assertSourceFingerprint(input.sourceFingerprint);
  if (!input.qualityChecks.sourceGrounded || !input.qualityChecks.basicQualityPassed) {
    throw new Error("EVENT_JOURNAL_QUALITY_CHECK_FAILED");
  }

  const completed = await prisma.$transaction(async (database) => {
    const generation = await findGenerationForUser(database, input.userId, input.generationId);
    if (!generation) throw new Error("EVENT_GENERATION_NOT_FOUND");
    const existingEntry = await findEntryForEvent(database, input.userId, generation.eventId);
    if (generation.status === "completed") {
      if (!existingEntry) throw new Error("EVENT_GENERATION_STATE_CHANGED");
      return mapEntry(existingEntry);
    }
    if (
      generation.status !== "processing" ||
      generation.sourceFingerprint !== input.sourceFingerprint ||
      !generation.traceId
    ) {
      throw new Error("EVENT_GENERATION_STATE_CHANGED");
    }
    if (existingEntry) return mapEntry(existingEntry);

    const event = await database.journalEvent.findFirst({
      where: {
        id: generation.eventId,
        userId: input.userId,
        status: "generating"
      },
      select: { id: true, rootSessionId: true }
    });
    if (!event) throw new Error("EVENT_GENERATION_STATE_CHANGED");
    const trace = await database.aIGenerationTrace.findFirst({
      where: {
        id: generation.traceId,
        userId: input.userId,
        journalEventId: generation.eventId,
        artifactType: "event_journal",
        artifactId: generation.intendedEntryId,
        status: "pending"
      },
      select: { id: true, pipelineDecisions: true }
    });
    if (!trace) throw new Error("EVENT_GENERATION_STATE_CHANGED");

    if (!generation.branchSessionId) {
      await markJournalEventEntryGenerationTerminalWithClient(database, {
        generation,
        userId: input.userId,
        status: "failed",
        errorCode: "EVENT_GENERATION_SOURCE_CHANGED"
      });
      return null;
    }
    let currentSourceFingerprint: string | null;
    try {
      currentSourceFingerprint = await readCurrentSourceFingerprintWithClient(database, {
        eventId: generation.eventId,
        activeBranchSessionId: generation.branchSessionId,
        baseMessageSequence: generation.baseMessageSequence
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "EVENT_STATE_CHANGED") throw error;
      await markJournalEventEntryGenerationTerminalWithClient(database, {
        generation,
        userId: input.userId,
        status: "failed",
        errorCode: "EVENT_GENERATION_SOURCE_CHANGED"
      });
      return null;
    }
    if (currentSourceFingerprint !== generation.sourceFingerprint) {
      await markJournalEventEntryGenerationTerminalWithClient(database, {
        generation,
        userId: input.userId,
        status: "failed",
        errorCode: "EVENT_GENERATION_SOURCE_CHANGED"
      });
      return null;
    }

    const now = new Date();
    await database.journalEventEntry.create({
      data: {
        id: generation.intendedEntryId,
        eventId: generation.eventId,
        sourceBranchSessionId: generation.branchSessionId,
        generatedByTurnId: generation.userTurnId,
        currentGenerationTraceId: generation.traceId,
        generationId: generation.id,
        title: input.title.trim(),
        content: input.content,
        occurredAtText: input.occurredAtText?.trim() || null,
        status: "draft",
        generationOrigin: input.outputOrigin,
        generationVersion: generation.attemptCount,
        sourceMessageSequence: generation.baseMessageSequence,
        sourceMessageIds: generation.sourceMessageIds,
        sourceFactIds: generation.sourceFactIds,
        sourceAngleOutcomeIds: generation.sourceAngleOutcomeIds,
        sourceFingerprint: generation.sourceFingerprint,
        sourceSnapshot: toJsonValue(generation.sourceSnapshot),
        contentRevision: 1,
        editedAt: null
      }
    });
    const eventUpdate = await database.journalEvent.updateMany({
      where: { id: event.id, status: "generating" },
      data: { status: "completed", completedAt: now }
    });
    if (eventUpdate.count !== 1) throw new Error("EVENT_GENERATION_STATE_CHANGED");
    await database.interviewSession.updateMany({
      where: {
        userId: input.userId,
        mode: "event_centered",
        OR: [{ id: event.rootSessionId }, { rootSessionId: event.rootSessionId }]
      },
      data: { status: "completed", completedAt: now, lastActivityAt: now }
    });
    const generationUpdate = await database.journalEventEntryGeneration.updateMany({
      where: { id: generation.id, status: "processing" },
      data: { status: "completed", completedAt: now, errorCode: null }
    });
    if (generationUpdate.count !== 1) throw new Error("EVENT_GENERATION_STATE_CHANGED");
    if (generation.userTurnId) {
      await database.interviewUserTurn.updateMany({
        where: { id: generation.userTurnId, status: "processing" },
        data: { status: "completed", completedAt: now, errorCode: null }
      });
    }
    const previousDecisions = Array.isArray(trace.pipelineDecisions)
      ? trace.pipelineDecisions
      : [];
    const traceUpdate = await database.aIGenerationTrace.updateMany({
      where: { id: trace.id, status: "pending" },
      data: {
        status: "completed",
        outputOrigin: input.outputOrigin,
        finalOutput: toJsonValue({
          title: input.title.trim(),
          content: input.content,
          occurredAtText: input.occurredAtText?.trim() || null
        }),
        pipelineDecisions: toJsonValue([
          ...previousDecisions,
          {
            kind: "event_journal_generation_completed",
            generationId: generation.id,
            sourceFingerprint: generation.sourceFingerprint,
            qualityChecks: input.qualityChecks,
            ...(input.pipelineDecisions?.length
              ? { completionDecisions: input.pipelineDecisions }
              : {})
          },
          {
            kind: "event_journal_quality_gate",
            accepted: true,
            issues: [],
            sourceGrounded: input.qualityChecks.sourceGrounded,
            basicQualityPassed: input.qualityChecks.basicQualityPassed
          }
        ]),
        completedAt: now
      }
    });
    if (traceUpdate.count !== 1) throw new Error("EVENT_GENERATION_STATE_CHANGED");
    const completedEntry = await findEntryForEvent(database, input.userId, generation.eventId);
    if (!completedEntry) throw new Error("EVENT_GENERATION_STATE_CHANGED");
    return mapEntry(completedEntry);
  });
  if (!completed) throw new Error("EVENT_GENERATION_SOURCE_CHANGED");
  return completed;
}

async function markJournalEventEntryGenerationTerminalWithClient(
  database: DatabaseClient,
  input: {
    generation: StoredGeneration;
    userId: string;
    status: "failed" | "canceled";
    errorCode: string;
  }
): Promise<JournalEventEntryGenerationRecord> {
  const now = new Date();
  const generationUpdate = await database.journalEventEntryGeneration.updateMany({
    where: { id: input.generation.id, status: "processing" },
    data:
      input.status === "failed"
        ? { status: input.status, failedAt: now, errorCode: input.errorCode }
        : { status: input.status, canceledAt: now, errorCode: input.errorCode }
  });
  if (generationUpdate.count !== 1) throw new Error("EVENT_GENERATION_STATE_CHANGED");
  const eventUpdate = await database.journalEvent.updateMany({
    where: {
      id: input.generation.eventId,
      userId: input.userId,
      status: "generating"
    },
    data: { status: "active", generationStartedAt: null }
  });
  if (eventUpdate.count !== 1) throw new Error("EVENT_GENERATION_STATE_CHANGED");
  if (input.generation.userTurnId) {
    await database.interviewUserTurn.updateMany({
      where: { id: input.generation.userTurnId, status: "processing" },
      data: { status: input.status, errorCode: input.errorCode }
    });
  }
  if (input.generation.traceId) {
    await database.aIGenerationTrace.updateMany({
      where: { id: input.generation.traceId, status: "pending" },
      data: { status: input.status, errorCode: input.errorCode, failedAt: now }
    });
  }
  const settled = await database.journalEventEntryGeneration.findUnique({
    where: { id: input.generation.id }
  });
  if (!settled) throw new Error("EVENT_GENERATION_NOT_FOUND");
  return mapGeneration(settled);
}

async function settleJournalEventEntryGeneration(
  input: SettleJournalEventEntryGenerationInput,
  status: "failed" | "canceled"
): Promise<JournalEventEntryGenerationRecord> {
  assertNonEmpty(input.errorCode, "EVENT_GENERATION_ERROR_INVALID");
  return prisma.$transaction(async (database) => {
    const generation = await findGenerationForUser(database, input.userId, input.generationId);
    if (!generation) throw new Error("EVENT_GENERATION_NOT_FOUND");
    if (generation.status !== "processing") return mapGeneration(generation);
    return markJournalEventEntryGenerationTerminalWithClient(database, {
      generation,
      userId: input.userId,
      status,
      errorCode: input.errorCode
    });
  });
}

export function failJournalEventEntryGeneration(
  input: SettleJournalEventEntryGenerationInput
) {
  return settleJournalEventEntryGeneration(input, "failed");
}

export function cancelJournalEventEntryGeneration(
  input: SettleJournalEventEntryGenerationInput
) {
  return settleJournalEventEntryGeneration(input, "canceled");
}

export async function updateJournalEventEntry(
  input: UpdateJournalEventEntryInput
): Promise<JournalEventEntryRecord> {
  assertEntryContent(input.title, input.content);
  assertPositiveInteger(input.expectedContentRevision, "EVENT_JOURNAL_ENTRY_VERSION_INVALID");
  return prisma.$transaction(async (database) => {
    const existing = await findEntryForUser(database, input.userId, input.entryId);
    if (!existing) throw new Error("EVENT_JOURNAL_ENTRY_NOT_FOUND");
    const title = input.title.trim();
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT");
    }
    if (existing.title === title && existing.content === input.content) return mapEntry(existing);

    const nextStatus = existing.status === "draft" ? "draft" : "modified";
    const update = await database.journalEventEntry.updateMany({
      where: {
        id: existing.id,
        contentRevision: input.expectedContentRevision
      },
      data: {
        title,
        content: input.content,
        status: nextStatus,
        contentRevision: { increment: 1 },
        editedAt: new Date()
      }
    });
    if (update.count !== 1) throw new Error("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT");
    const updated = await findEntryForUser(database, input.userId, input.entryId);
    if (!updated) throw new Error("EVENT_JOURNAL_ENTRY_NOT_FOUND");
    return mapEntry(updated);
  });
}

export async function saveJournalEventEntry(
  input: SaveJournalEventEntryInput
): Promise<JournalEventEntryRecord> {
  assertPositiveInteger(input.expectedContentRevision, "EVENT_JOURNAL_ENTRY_VERSION_INVALID");
  return prisma.$transaction(async (database) => {
    const existing = await findEntryForUser(database, input.userId, input.entryId);
    if (!existing) throw new Error("EVENT_JOURNAL_ENTRY_NOT_FOUND");
    if (existing.contentRevision !== input.expectedContentRevision) {
      throw new Error("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT");
    }
    if (existing.status === "saved" && existing.savedRevision === existing.contentRevision) {
      return mapEntry(existing);
    }
    const now = new Date();
    const update = await database.journalEventEntry.updateMany({
      where: {
        id: existing.id,
        contentRevision: input.expectedContentRevision
      },
      data: {
        status: "saved",
        savedRevision: existing.contentRevision,
        savedAt: now
      }
    });
    if (update.count !== 1) throw new Error("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT");
    const saved = await findEntryForUser(database, input.userId, input.entryId);
    if (!saved) throw new Error("EVENT_JOURNAL_ENTRY_NOT_FOUND");
    return mapEntry(saved);
  });
}
