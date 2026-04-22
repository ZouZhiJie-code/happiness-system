import {
  Prisma,
  PrismaClient,
  type AIRequestStage,
  type InterviewDimension as PrismaInterviewDimension,
  type InputMode,
  type InterviewSessionStatus,
  type JoyEntryStatus,
  type JoyInterviewStage
} from "@prisma/client";

import { createEmptySnapshot } from "@/features/joy-interview/server/joy-interview-engine";
import { prisma } from "@/server/db/prisma";
import type {
  InterviewDimension,
  InterviewSessionRecord,
  JournalEntryRecord,
  JoyEntryDraft,
  JoySnapshot
} from "@/types/interview";

const DEMO_USER_ID = "local-demo-user";
const DEMO_TIMEZONE = "Asia/Shanghai";

const interviewSessionInclude = {
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
  joyEntry: true
} satisfies Prisma.InterviewSessionInclude;

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type InterviewSessionWithRelations = Prisma.InterviewSessionGetPayload<{
  include: typeof interviewSessionInclude;
}>;
type SnapshotRecord = InterviewSessionWithRelations["snapshots"][number];
type JoyEntryRecord = NonNullable<InterviewSessionWithRelations["joyEntry"]>;

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

function mapJournalEntry(entry: JoyEntryRecord | null | undefined): JournalEntryRecord | null {
  if (!entry) {
    return null;
  }

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
    source: entry.source,
    status: entry.status,
    linkedSessionIds: entry.linkedSessionIds,
    updatedAt: entry.updatedAt.toISOString(),
    savedAt: entry.savedAt?.toISOString() ?? null
  };
}

function mapInterviewSession(session: InterviewSessionWithRelations): InterviewSessionRecord {
  return {
    id: session.id,
    dimension: session.dimension,
    status: session.status,
    stage: session.stage,
    turnCount: session.turnCount,
    lastAssistantQuestion: session.lastAssistantQuestion ?? "",
    draftSummary: session.draftSummary,
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      inputMode: message.inputMode ?? undefined,
      content: message.content,
      sequence: message.sequence,
      createdAt: message.createdAt.toISOString()
    })),
    snapshot: mapSnapshot(session.snapshots[0]),
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    journalEntry: mapJournalEntry(session.joyEntry)
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

export async function createJoyInterviewSession(dimension: InterviewDimension, openingQuestion: string) {
  const userId = await ensureDemoUser(prisma);
  const emptySnapshot = createEmptySnapshot();

  const session = await prisma.interviewSession.create({
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
            content: openingQuestion,
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

  return mapInterviewSession(session);
}

export async function findJoyInterviewSessionById(sessionId: string) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: interviewSessionInclude
  });

  if (!session) {
    return null;
  }

  return mapInterviewSession(session);
}

interface AppendJoyInterviewTurnInput {
  sessionId: string;
  userMessage: string;
  inputMode: InputMode;
  assistantMessage: string;
  snapshot: JoySnapshot;
  nextStage: JoyInterviewStage;
  nextStatus: InterviewSessionStatus;
  nextTurnCount: number;
  draftSummary: string | null;
  completedAt: Date | null;
}

export async function appendJoyInterviewTurn(input: AppendJoyInterviewTurnInput) {
  const session = await prisma.$transaction(async (tx) => {
    const existing = await tx.interviewSession.findUnique({
      where: { id: input.sessionId },
      include: interviewSessionInclude
    });

    if (!existing) {
      return null;
    }

    const nextSequence = existing.messages.length;
    const nextSnapshotVersion = (existing.snapshots[0]?.version ?? -1) + 1;

    await tx.interviewMessage.createMany({
      data: [
        {
          sessionId: input.sessionId,
          role: "user",
          inputMode: input.inputMode,
          content: input.userMessage,
          sequence: nextSequence
        },
        {
          sessionId: input.sessionId,
          role: "assistant",
          content: input.assistantMessage,
          sequence: nextSequence + 1
        }
      ]
    });

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

    return tx.interviewSession.update({
      where: { id: input.sessionId },
      data: {
        turnCount: input.nextTurnCount,
        stage: input.nextStage,
        status: input.nextStatus,
        lastAssistantQuestion: input.assistantMessage,
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
  const session = await prisma.interviewSession.update({
    where: { id: sessionId },
    data: {
      status: "active",
      stage: "wrap_up",
      completedAt: null
    },
    include: interviewSessionInclude
  });

  return mapInterviewSession(session);
}

export async function updateJoyEntry(entryId: string, draftEntry: JoyEntryDraft) {
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
      source: "ai_draft_edited",
      status: "draft",
      savedAt: null
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
        status: "saved" satisfies JoyEntryStatus,
        savedAt,
        linkedSessionIds: [sessionId]
      }
    });

    return tx.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        stage: "finalize",
        completedAt: existing.completedAt ?? savedAt,
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
