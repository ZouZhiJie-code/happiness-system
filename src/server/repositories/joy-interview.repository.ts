import {
  Prisma,
  PrismaClient,
  type AIRequestStage,
  type InterviewDimension as PrismaInterviewDimension,
  type InputMode,
  type InterviewSessionStatus,
  type JoyInterviewStage
} from "@prisma/client";

import {
  createOpeningAssistantTurnPayload,
  getAssistantDisplayParts,
  parseAssistantTurnPayload,
  serializeAssistantTurnPayload
} from "@/features/joy-interview/assistant-turn";
import {
  buildJournalPayloadForDimension,
  buildSnapshotDataForDimension
} from "@/features/interview/dimension-definitions";
import { isDraftGenerationUnlocked } from "@/features/joy-interview/server/interview-progress";
import { createEmptySnapshot } from "@/features/joy-interview/server/joy-interview-engine";
import { prisma } from "@/server/db/prisma";
import type {
  AssistantTurnPayload,
  InterviewDimension,
  InterviewEventRecord,
  InterviewLens,
  InterviewSessionRecord,
  JournalEntryRecord,
  JoyEntryDraft,
  JoyEventBlock,
  JoySnapshot,
  PendingDecisionAction
} from "@/types/interview";

const DEMO_USER_ID = "local-demo-user";
const DEMO_TIMEZONE = "Asia/Shanghai";

const interviewSessionInclude = {
  activeEvent: true,
  events: {
    orderBy: {
      sequence: "asc"
    }
  },
  messages: {
    orderBy: {
      sequence: "asc"
    }
  },
  snapshots: {
    orderBy: {
      version: "desc"
    },
    take: 1
  },
  joyEntry: {
    include: {
      session: {
        select: {
          dimension: true
        }
      }
    }
  }
} as const;

type DatabaseClient = PrismaClient | Prisma.TransactionClient | any;
type InterviewSessionWithRelations = any;
type SnapshotRecord = any;
type EventRecord = any;
type JoyEntryRecord = any;

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function mapSnapshot(snapshot: SnapshotRecord | null | undefined): JoySnapshot {
  if (!snapshot) {
    return createEmptySnapshot();
  }

  return {
    event: snapshot.event,
    feeling: snapshot.feeling,
    whyItMattered: snapshot.whyItMattered,
    happinessType: snapshot.happinessType,
    selfPattern: snapshot.selfPattern,
    confidence: snapshot.confidence ?? 0,
    missingSlots: snapshot.missingSlots
  };
}

function normalizeLenses(lenses: string[]): InterviewLens[] {
  const allowed: InterviewLens[] = [
    "event_detail",
    "felt_experience",
    "importance_reason",
    "meaning_pattern",
    "self_pattern"
  ];

  return allowed.filter((lens) => lenses.includes(lens));
}

function mapEventSnapshot(event: Pick<EventRecord, "event" | "feeling" | "whyItMattered" | "happinessType" | "selfPattern" | "confidence" | "missingSlots">): JoySnapshot {
  return {
    event: event.event,
    feeling: event.feeling,
    whyItMattered: event.whyItMattered,
    happinessType: event.happinessType,
    selfPattern: event.selfPattern,
    confidence: event.confidence ?? 0,
    missingSlots: event.missingSlots
  };
}

function mapInterviewEvent(dimension: InterviewDimension, event: EventRecord): InterviewEventRecord {
  const snapshot = mapEventSnapshot(event);
  const snapshotData = event.snapshotData ? (event.snapshotData as InterviewEventRecord["snapshotData"]) : buildSnapshotDataForDimension(dimension, snapshot);

  return {
    id: event.id,
    sequence: event.sequence,
    status: event.status,
    stage: event.stage,
    explorationRound: event.explorationRound,
    coveredLenses: normalizeLenses(event.coveredLenses),
    roundCoveredLenses: normalizeLenses(event.roundCoveredLenses),
    roundMeaningfulReplyCount: event.roundMeaningfulReplyCount,
    totalMeaningfulReplyCount: event.totalMeaningfulReplyCount,
    startMessageSequence: event.startMessageSequence,
    snapshot,
    snapshotData,
    draftSummary: event.draftSummary,
    startedAt: event.startedAt.toISOString(),
    completedAt: event.completedAt?.toISOString() ?? null
  };
}

function buildFallbackEvent(session: InterviewSessionWithRelations): InterviewEventRecord {
  const snapshot = mapSnapshot(session.snapshots[0]);
  const snapshotData = buildSnapshotDataForDimension(session.dimension, snapshot);

  return {
    id: `legacy-${session.id}`,
    sequence: 1,
    status: session.stage === "finalize" ? "completed" : "active",
    stage: session.stage,
    explorationRound: 1,
    coveredLenses: [],
    roundCoveredLenses: [],
    roundMeaningfulReplyCount: 0,
    totalMeaningfulReplyCount: session.turnCount,
    startMessageSequence: 0,
    snapshot,
    snapshotData,
    draftSummary: session.draftSummary,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null
  };
}

function mapEventBlocks(blocks: Prisma.JsonValue | null | undefined): JoyEventBlock[] {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks.flatMap((block) => {
    if (!block || typeof block !== "object") {
      return [];
    }

    const value = block as Record<string, unknown>;

    if (typeof value.eventId !== "string" || typeof value.sequence !== "number" || typeof value.explorationRound !== "number") {
      return [];
    }

    return [
      {
        eventId: value.eventId,
        sequence: value.sequence,
        explorationRound: value.explorationRound,
        event: typeof value.event === "string" ? value.event : null,
        feeling: typeof value.feeling === "string" ? value.feeling : null,
        whyItMattered: typeof value.whyItMattered === "string" ? value.whyItMattered : null,
        happinessType: typeof value.happinessType === "string" ? value.happinessType : null,
        selfPattern: typeof value.selfPattern === "string" ? value.selfPattern : null
      }
    ];
  });
}

function mapJournalEntry(entry: JoyEntryRecord | null | undefined, dimensionFallback: InterviewDimension = "joy"): JournalEntryRecord | null {
  if (!entry) {
    return null;
  }

  const dimension = entry.session?.dimension ?? dimensionFallback;
  const payload =
    entry.payload ? (entry.payload as JournalEntryRecord["payload"]) : buildJournalPayloadForDimension(dimension, {
      event: entry.event,
      feeling: entry.feeling,
      whyItMattered: entry.whyItMattered,
      happinessType: entry.happinessType,
      selfPattern: entry.selfPattern,
      tags: entry.tags
    });

  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    event: entry.event,
    feeling: entry.feeling,
    whyItMattered: entry.whyItMattered,
    happinessType: entry.happinessType,
    selfPattern: entry.selfPattern,
    tags: entry.tags,
    eventBlocks: mapEventBlocks(entry.eventBlocks),
    payload,
    source: entry.source,
    status: entry.status,
    linkedSessionIds: entry.linkedSessionIds,
    updatedAt: entry.updatedAt.toISOString(),
    savedAt: entry.savedAt?.toISOString() ?? null
  };
}

function mapInterviewSession(session: InterviewSessionWithRelations): InterviewSessionRecord {
  const events = session.events.length ? session.events.map((event: EventRecord) => mapInterviewEvent(session.dimension, event)) : [buildFallbackEvent(session)];
  const activeEvent =
    events.find((event: InterviewEventRecord) => event.id === session.activeEventId) ??
    events.find((event: InterviewEventRecord) => event.status !== "completed") ??
    events[events.length - 1];
  const mappedSession = {
    id: session.id,
    dimension: session.dimension,
    status: session.status,
    stage: activeEvent?.stage ?? session.stage,
    activeEventId: activeEvent?.id ?? null,
    messages: session.messages.map((message: any) => ({
      id: message.id,
      role: message.role,
      inputMode: message.inputMode ?? undefined,
      content: message.content,
      assistantPayload: message.role === "assistant" ? parseAssistantTurnPayload(message.content) : null,
      sequence: message.sequence,
      createdAt: message.createdAt.toISOString()
    })),
    snapshot: activeEvent?.snapshot ?? mapSnapshot(session.snapshots[0]),
    snapshotData: activeEvent?.snapshotData ?? buildSnapshotDataForDimension(session.dimension, mapSnapshot(session.snapshots[0])),
    events,
    pendingDecision:
      activeEvent?.status === "ready_for_choice"
        ? {
            kind: "event_complete" as const,
            eventId: activeEvent.id,
            eventSequence: activeEvent.sequence,
            actions: ["continue_current_event", "next_event", "generate_draft"] as PendingDecisionAction[]
          }
        : null,
    startedAt: session.startedAt.toISOString(),
    pausedAt: session.pausedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    journalEntry: mapJournalEntry(session.joyEntry, session.dimension),
    turnCount: session.turnCount,
    lastAssistantQuestion: session.lastAssistantQuestion ?? "",
    draftSummary: session.draftSummary,
    draftGenerationUnlocked: false
  };

  return {
    ...mappedSession,
    draftGenerationUnlocked: isDraftGenerationUnlocked({
      messages: mappedSession.messages,
      stage: mappedSession.stage,
      journalEntry: mappedSession.journalEntry,
      pendingDecision: mappedSession.pendingDecision
    })
  };
}

async function ensureDemoUser(database: DatabaseClient) {
  await database.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID
    }
  });

  await database.userSettings.upsert({
    where: { userId: DEMO_USER_ID },
    update: {},
    create: {
      userId: DEMO_USER_ID,
      timezone: DEMO_TIMEZONE
    }
  });

  return DEMO_USER_ID;
}

async function ensureInterviewEvents(database: DatabaseClient, sessionId: string) {
  const existing = await database.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!existing) {
    return null;
  }

  if (existing.events.length > 0 && existing.activeEventId) {
    return existing;
  }

  const fallbackSnapshot = mapSnapshot(existing.snapshots[0]);
  const createdEvent =
    existing.events[0] ??
    (await database.interviewEvent.create({
      data: {
        sessionId,
        sequence: 1,
        status: existing.stage === "finalize" ? "completed" : "active",
        stage: existing.stage,
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: existing.turnCount,
        startMessageSequence: 0,
        event: fallbackSnapshot.event,
        feeling: fallbackSnapshot.feeling,
        whyItMattered: fallbackSnapshot.whyItMattered,
        happinessType: fallbackSnapshot.happinessType,
        selfPattern: fallbackSnapshot.selfPattern,
        confidence: fallbackSnapshot.confidence,
        missingSlots: fallbackSnapshot.missingSlots,
        draftSummary: existing.draftSummary,
        startedAt: existing.startedAt,
        completedAt: existing.completedAt
      }
    }));

  await database.interviewSession.update({
    where: { id: sessionId },
    data: {
      activeEventId: existing.activeEventId ?? createdEvent.id
    }
  });

  return database.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });
}

export async function createJoyInterviewSession(dimension: InterviewDimension, openingQuestion: string) {
  const userId = await ensureDemoUser(prisma);
  const emptySnapshot = createEmptySnapshot();
  const openingAssistantTurn = createOpeningAssistantTurnPayload(openingQuestion);
  const emptySnapshotData = buildSnapshotDataForDimension(dimension, emptySnapshot);

  const session = await prisma.$transaction(async (tx) => {
    const createdSession = await tx.interviewSession.create({
      data: {
        userId,
        dimension: dimension as PrismaInterviewDimension,
        status: "active",
        stage: "collect_event",
        lastAssistantQuestion: openingQuestion,
        messages: {
          create: [
            {
              role: "assistant",
              content: serializeAssistantTurnPayload(openingAssistantTurn),
              sequence: 0
            }
          ]
        },
        snapshots: {
          create: [
            {
              version: 0,
              event: emptySnapshot.event,
              feeling: emptySnapshot.feeling,
              whyItMattered: emptySnapshot.whyItMattered,
              happinessType: emptySnapshot.happinessType,
              selfPattern: emptySnapshot.selfPattern,
              confidence: emptySnapshot.confidence,
              missingSlots: emptySnapshot.missingSlots
            }
          ]
        }
      },
      include: interviewSessionInclude
    });

    const activeEvent = await tx.interviewEvent.create({
      data: {
        sessionId: createdSession.id,
        sequence: 1,
        status: "active",
        stage: "collect_event",
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: 0,
        startMessageSequence: 0,
        event: emptySnapshot.event,
        feeling: emptySnapshot.feeling,
        whyItMattered: emptySnapshot.whyItMattered,
        happinessType: emptySnapshot.happinessType,
        selfPattern: emptySnapshot.selfPattern,
        snapshotData: toJsonValue(emptySnapshotData),
        confidence: emptySnapshot.confidence,
        missingSlots: emptySnapshot.missingSlots
      }
    });

    return tx.interviewSession.update({
      where: { id: createdSession.id },
      data: {
        activeEventId: activeEvent.id
      },
      include: interviewSessionInclude
    });
  });

  return mapInterviewSession(session);
}

export async function findJoyInterviewSessionById(sessionId: string) {
  const session = await ensureInterviewEvents(prisma, sessionId);

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

interface AppendJoyInterviewTurnInput {
  sessionId: string;
  activeEventId: string;
  userMessage?: string;
  inputMode?: InputMode;
  assistantTurn: AssistantTurnPayload;
  snapshot: JoySnapshot;
  eventStatus: InterviewEventRecord["status"];
  nextStage: JoyInterviewStage;
  nextStatus: InterviewSessionStatus;
  nextTurnCount: number;
  coveredLenses: InterviewLens[];
  roundCoveredLenses: InterviewLens[];
  roundMeaningfulReplyCount: number;
  totalMeaningfulReplyCount: number;
  draftSummary: string | null;
  completedAt: Date | null;
}

export async function appendJoyInterviewTurn(input: AppendJoyInterviewTurnInput) {
  const session = await prisma.$transaction(async (tx) => {
    const existing = await ensureInterviewEvents(tx, input.sessionId);

    if (!existing) {
      return null;
    }

    const nextSequence = existing.messages.length;
    const nextSnapshotVersion = (existing.snapshots[0]?.version ?? -1) + 1;
    const serializedAssistantTurn = serializeAssistantTurnPayload(input.assistantTurn);
    const assistantQuestion = getAssistantDisplayParts(input.assistantTurn).question;

    const messagesToCreate: Prisma.InterviewMessageCreateManyInput[] = [];

    if (input.userMessage) {
      messagesToCreate.push({
        sessionId: input.sessionId,
        role: "user",
        inputMode: input.inputMode,
        content: input.userMessage,
        sequence: nextSequence
      });
    }

    messagesToCreate.push({
      sessionId: input.sessionId,
      role: "assistant",
      content: serializedAssistantTurn,
      sequence: nextSequence + (input.userMessage ? 1 : 0)
    });

    await tx.interviewMessage.createMany({ data: messagesToCreate });

    await tx.joyInterviewSnapshot.create({
      data: {
        sessionId: input.sessionId,
        version: nextSnapshotVersion,
        event: input.snapshot.event,
        feeling: input.snapshot.feeling,
        whyItMattered: input.snapshot.whyItMattered,
        happinessType: input.snapshot.happinessType,
        selfPattern: input.snapshot.selfPattern,
        confidence: input.snapshot.confidence,
        missingSlots: input.snapshot.missingSlots
      }
    });

    await tx.interviewEvent.update({
      where: { id: input.activeEventId },
      data: {
        status: input.eventStatus,
        stage: input.nextStage,
        coveredLenses: input.coveredLenses,
        roundCoveredLenses: input.roundCoveredLenses,
        roundMeaningfulReplyCount: input.roundMeaningfulReplyCount,
        totalMeaningfulReplyCount: input.totalMeaningfulReplyCount,
        event: input.snapshot.event,
        feeling: input.snapshot.feeling,
        whyItMattered: input.snapshot.whyItMattered,
        happinessType: input.snapshot.happinessType,
        selfPattern: input.snapshot.selfPattern,
        snapshotData: toJsonValue(buildSnapshotDataForDimension(existing.dimension, input.snapshot)),
        confidence: input.snapshot.confidence,
        missingSlots: input.snapshot.missingSlots,
        draftSummary: input.draftSummary,
        completedAt: input.eventStatus === "completed" ? (input.completedAt ?? new Date()) : null
      }
    });

    return tx.interviewSession.update({
      where: { id: input.sessionId },
      data: {
        turnCount: input.nextTurnCount,
        stage: input.nextStage,
        status: input.nextStatus,
        lastAssistantQuestion: assistantQuestion,
        draftSummary: input.draftSummary,
        completedAt: input.completedAt
      },
      include: interviewSessionInclude
    });
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function resumeCurrentInterviewEvent(sessionId: string) {
  const session = await prisma.$transaction(async (tx) => {
    const existing = await ensureInterviewEvents(tx, sessionId);

    if (!existing?.activeEventId) {
      return null;
    }

    const activeEvent = existing.events.find((event: any) => event.id === existing.activeEventId);

    if (!activeEvent) {
      return null;
    }

    await tx.interviewEvent.update({
      where: { id: activeEvent.id },
      data: {
        status: "active",
        stage: activeEvent.stage === "wrap_up" ? "probe_pattern" : activeEvent.stage,
        explorationRound: activeEvent.explorationRound + 1,
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        progressData: Prisma.JsonNull,
        completedAt: null
      }
    });

    return tx.interviewSession.findUnique({
      where: { id: sessionId },
      include: interviewSessionInclude
    });
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function startNextInterviewEvent(sessionId: string, openingQuestion: string) {
  const session = await prisma.$transaction(async (tx) => {
    const existing = await ensureInterviewEvents(tx, sessionId);

    if (!existing) {
      return null;
    }

    if (existing.activeEventId) {
      await tx.interviewEvent.update({
        where: { id: existing.activeEventId },
        data: {
          status: "completed",
          completedAt: new Date()
        }
      });
    }

    const nextSequence = (existing.events[existing.events.length - 1]?.sequence ?? 0) + 1;
    const emptySnapshot = createEmptySnapshot();
    const nextEvent = await tx.interviewEvent.create({
      data: {
        sessionId,
        sequence: nextSequence,
        status: "active",
        stage: "collect_event",
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: 0,
        startMessageSequence: existing.messages.length,
        event: emptySnapshot.event,
        feeling: emptySnapshot.feeling,
        whyItMattered: emptySnapshot.whyItMattered,
        happinessType: emptySnapshot.happinessType,
        selfPattern: emptySnapshot.selfPattern,
        snapshotData: toJsonValue(buildSnapshotDataForDimension(existing.dimension, emptySnapshot)),
        confidence: emptySnapshot.confidence,
        missingSlots: emptySnapshot.missingSlots
      }
    });

    const assistantTurn = createOpeningAssistantTurnPayload(openingQuestion);

    await tx.interviewMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: serializeAssistantTurnPayload(assistantTurn),
        sequence: existing.messages.length
      }
    });

    await tx.interviewSession.update({
      where: { id: sessionId },
      data: {
        activeEventId: nextEvent.id,
        stage: "collect_event",
        lastAssistantQuestion: openingQuestion
      }
    });

    return tx.interviewSession.findUnique({
      where: { id: sessionId },
      include: interviewSessionInclude
    });
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function saveJoyInterviewDraft(sessionId: string, draftEntry: JoyEntryDraft) {
  const session = await prisma.$transaction(async (tx) => {
    const existing = await tx.interviewSession.findUnique({
      where: { id: sessionId },
      include: interviewSessionInclude
    });

    if (!existing) {
      return null;
    }

    await ensureDemoUser(tx);
    const payload = buildJournalPayloadForDimension(existing.dimension, {
      event: draftEntry.event,
      feeling: draftEntry.feeling,
      whyItMattered: draftEntry.whyItMattered,
      happinessType: draftEntry.happinessType,
      selfPattern: draftEntry.selfPattern,
      tags: draftEntry.tags
    });

    const draft = await tx.joyEntry.upsert({
      where: { sessionId },
      update: {
        title: draftEntry.title,
        content: draftEntry.content,
        event: draftEntry.event,
        feeling: draftEntry.feeling,
        whyItMattered: draftEntry.whyItMattered,
        happinessType: draftEntry.happinessType,
        selfPattern: draftEntry.selfPattern,
        tags: draftEntry.tags,
        payload: toJsonValue(payload),
        eventBlocks: draftEntry.eventBlocks as unknown as Prisma.InputJsonValue,
        source: draftEntry.source,
        status: "draft",
        linkedSessionIds: [sessionId],
        savedAt: null
      },
      create: {
        userId: existing.userId,
        sessionId,
        date: existing.startedAt,
        title: draftEntry.title,
        content: draftEntry.content,
        event: draftEntry.event,
        feeling: draftEntry.feeling,
        whyItMattered: draftEntry.whyItMattered,
        happinessType: draftEntry.happinessType,
        selfPattern: draftEntry.selfPattern,
        tags: draftEntry.tags,
        payload: toJsonValue(payload),
        eventBlocks: draftEntry.eventBlocks as unknown as Prisma.InputJsonValue,
        source: draftEntry.source,
        status: "draft",
        linkedSessionIds: [sessionId]
      }
    });

    return tx.interviewSession.update({
      where: { id: sessionId },
      data: {
        draftSummary: draftEntry.whyItMattered ?? draftEntry.event,
        finalEntryId: draft.id
      },
      include: interviewSessionInclude
    });
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function reopenJoyInterviewSessionRecord(sessionId: string) {
  const session = await prisma.$transaction(async (tx) => {
    const existing = await tx.interviewSession.findUnique({
      where: { id: sessionId },
      include: interviewSessionInclude
    });

    if (!existing) {
      return null;
    }

    return tx.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "active",
        stage: existing.stage === "finalize" ? "wrap_up" : existing.stage,
        pausedAt: null,
        completedAt: null
      },
      include: interviewSessionInclude
    });
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

export async function pauseJoyInterviewSessionRecord(sessionId: string) {
  const pausedAt = new Date();

  const session = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: "paused",
      pausedAt,
      completedAt: null
    },
    include: interviewSessionInclude
  });

  return mapInterviewSession(session);
}

export async function completeJoyInterviewSessionRecord(sessionId: string) {
  const completedAt = new Date();

  const session = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: "completed",
      completedAt,
      pausedAt: null
    },
    include: interviewSessionInclude
  });

  return mapInterviewSession(session);
}

export async function updateJoyEntry(entryId: string, draftEntry: JoyEntryDraft) {
  const existing = await prisma.joyEntry.findUnique({
    where: { id: entryId },
    include: {
      session: {
        select: {
          dimension: true
        }
      }
    }
  });

  if (!existing) {
    throw new Prisma.PrismaClientKnownRequestError("Journal entry not found.", {
      code: "P2025",
      clientVersion: Prisma.prismaVersion.client
    });
  }

  const payload = buildJournalPayloadForDimension(existing.session?.dimension ?? "joy", {
    event: draftEntry.event,
    feeling: draftEntry.feeling,
    whyItMattered: draftEntry.whyItMattered,
    happinessType: draftEntry.happinessType,
    selfPattern: draftEntry.selfPattern,
    tags: draftEntry.tags
  });

  const updated = await prisma.joyEntry.update({
    where: { id: entryId },
    data: {
      title: draftEntry.title,
      content: draftEntry.content,
      event: draftEntry.event,
      feeling: draftEntry.feeling,
      whyItMattered: draftEntry.whyItMattered,
      happinessType: draftEntry.happinessType,
      selfPattern: draftEntry.selfPattern,
      tags: draftEntry.tags,
      payload: toJsonValue(payload),
      eventBlocks: draftEntry.eventBlocks as unknown as Prisma.InputJsonValue,
      source: "ai_draft_edited",
      status: "draft",
      savedAt: null
    },
    include: {
      session: {
        select: {
          dimension: true
        }
      }
    }
  });

  return mapJournalEntry(updated);
}

export async function markJoyEntrySaved(sessionId: string) {
  const session = await prisma.$transaction(async (tx) => {
    const existing = await tx.interviewSession.findUnique({
      where: { id: sessionId },
      include: interviewSessionInclude
    });

    if (!existing?.joyEntry) {
      return null;
    }

    const savedAt = new Date();

    await tx.joyEntry.update({
      where: { sessionId },
      data: {
        status: "saved",
        savedAt,
        linkedSessionIds: [sessionId]
      }
    });

    if (existing.activeEventId) {
      await tx.interviewEvent.update({
        where: { id: existing.activeEventId },
        data: {
          status: "completed",
          completedAt: savedAt
        }
      });
    }

    return tx.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        stage: "finalize",
        pausedAt: null,
        completedAt: savedAt,
        draftSummary: existing.joyEntry.whyItMattered ?? existing.joyEntry.event,
        finalEntryId: existing.joyEntry.id
      },
      include: interviewSessionInclude
    });
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

interface CreateAIRequestLogInput {
  sessionId: string;
  stage: AIRequestStage;
  provider: string;
  success: boolean;
  latencyMs: number | null;
  errorCode: string | null;
}

export async function createAIRequestLog(input: CreateAIRequestLogInput) {
  await prisma.aIRequestLog.create({
    data: {
      sessionId: input.sessionId,
      stage: input.stage,
      provider: input.provider,
      success: input.success,
      latencyMs: input.latencyMs,
      errorCode: input.errorCode
    }
  });
}
