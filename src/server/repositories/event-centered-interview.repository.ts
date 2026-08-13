import { Prisma, type InputMode } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { formatEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import {
  createOpeningAssistantTurnPayload,
  serializeAssistantTurnPayload
} from "@/features/joy-interview/assistant-turn";
import { prisma } from "@/server/db/prisma";
import type {
  EventCenteredSessionIdentity,
  EventCenteredTurnConfirmation,
  JournalEventIdentity,
  ReserveEventCenteredTurnResult
} from "@/types/event-centered-interview";

type DatabaseClient = Prisma.TransactionClient;

const EVENT_CENTERED_SCHEMA_VERSION = 3 as const;

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  ) || (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function mapJournalEvent(event: {
  id: string;
  entryDate: Date;
  daySequence: number;
  status: "active" | "generating" | "completed" | "abandoned";
  startedAt: Date;
  generationStartedAt: Date | null;
  completedAt: Date | null;
  abandonedAt: Date | null;
}): JournalEventIdentity {
  return {
    id: event.id,
    entryDate: formatEntryDate(event.entryDate),
    daySequence: event.daySequence,
    status: event.status,
    startedAt: event.startedAt.toISOString(),
    generationStartedAt: event.generationStartedAt?.toISOString() ?? null,
    completedAt: event.completedAt?.toISOString() ?? null,
    abandonedAt: event.abandonedAt?.toISOString() ?? null
  };
}

function mapTurn(turn: {
  id: string;
  clientTurnId: string;
  sessionId: string;
  rawText: string | null;
  inputMode: InputMode | null;
  baseMessageSequence: number;
  status: "processing" | "completed" | "failed" | "canceled";
  createdAt: Date;
}): EventCenteredTurnConfirmation {
  return {
    id: turn.id,
    clientTurnId: turn.clientTurnId,
    sessionId: turn.sessionId,
    rawText: turn.rawText ?? "",
    inputMode: turn.inputMode ?? "text",
    baseMessageSequence: turn.baseMessageSequence,
    status: turn.status,
    createdAt: turn.createdAt.toISOString()
  };
}

async function findEventCenteredRootByDate(userId: string, entryDate: Date) {
  return prisma.interviewSession.findFirst({
    where: {
      userId,
      entryDate,
      mode: "event_centered",
      parentSessionId: null,
      status: "active"
    },
    orderBy: { startedAt: "desc" },
    select: { id: true }
  });
}

async function resolveEventCenteredRoute(
  database: typeof prisma | DatabaseClient,
  userId: string,
  requestedSessionId: string
) {
  const requested = await database.interviewSession.findFirst({
    where: {
      id: requestedSessionId,
      userId,
      mode: "event_centered"
    },
    select: {
      id: true,
      rootSessionId: true
    }
  });

  if (!requested) {
    return null;
  }

  const rootSessionId = requested.rootSessionId ?? requested.id;
  const root = await database.interviewSession.findFirst({
    where: {
      id: rootSessionId,
      userId,
      mode: "event_centered",
      parentSessionId: null
    },
    select: {
      id: true,
      userId: true,
      entryDate: true,
      status: true,
      conversationSchemaVersion: true,
      activeBranchSessionId: true,
      journalEvent: true
    }
  });

  if (!root) {
    return null;
  }

  const activeBranchSessionId = root.activeBranchSessionId ?? root.id;
  const activeBranch = await database.interviewSession.findFirst({
    where: {
      id: activeBranchSessionId,
      userId,
      mode: "event_centered",
      OR: [
        { id: root.id },
        { rootSessionId: root.id }
      ]
    },
    select: {
      id: true,
      status: true,
      activeEventId: true,
      messages: {
        orderBy: { sequence: "desc" },
        take: 1,
        select: { sequence: true }
      }
    }
  });

  if (!activeBranch) {
    return null;
  }

  return {
    root,
    activeBranch,
    latestMessageSequence: activeBranch.messages[0]?.sequence ?? -1
  };
}

function toSessionIdentity(
  route: NonNullable<Awaited<ReturnType<typeof resolveEventCenteredRoute>>>
): EventCenteredSessionIdentity {
  const event = route.root.journalEvent;

  return {
    mode: "event_centered",
    rootSessionId: route.root.id,
    activeBranchSessionId: route.activeBranch.id,
    eventId: event?.id ?? null,
    branchStateId: route.activeBranch.activeEventId,
    entryDate: formatEntryDate(route.root.entryDate),
    conversationSchemaVersion: route.root.conversationSchemaVersion,
    sessionStatus: route.root.status === "active" ? "active" : route.root.status === "abandoned" ? "abandoned" : "completed",
    eventStatus: event?.status ?? null,
    latestMessageSequence: route.latestMessageSequence,
    journalEvent: event ? mapJournalEvent(event) : null
  };
}

export async function getEventCenteredSessionIdentity(
  userId: string,
  sessionId: string
): Promise<EventCenteredSessionIdentity | null> {
  const route = await resolveEventCenteredRoute(prisma, userId, sessionId);
  return route ? toSessionIdentity(route) : null;
}

export async function startEventCenteredInterviewSession(input: {
  userId: string;
  entryDate: string;
  openingQuestion: string;
}): Promise<EventCenteredSessionIdentity> {
  const entryDate = parseEntryDateInput(input.entryDate);
  const existing = await findEventCenteredRootByDate(input.userId, entryDate);

  if (existing) {
    const identity = await getEventCenteredSessionIdentity(input.userId, existing.id);
    if (identity) return identity;
  }

  const sessionId = randomUUID();
  const branchStateId = randomUUID();
  const assistantMessageId = randomUUID();
  const assistantTurn = createOpeningAssistantTurnPayload(input.openingQuestion);

  try {
    await prisma.$transaction([
      prisma.interviewSession.create({
        data: {
          id: sessionId,
          userId: input.userId,
          mode: "event_centered",
          dimension: null,
          conversationSchemaVersion: EVENT_CENTERED_SCHEMA_VERSION,
          rootSessionId: sessionId,
          activeBranchSessionId: sessionId,
          status: "active",
          stage: "collect_event",
          entryDate,
          lastAssistantQuestion: input.openingQuestion
        }
      }),
      prisma.interviewEvent.create({
        data: {
          id: branchStateId,
          sessionId,
          sequence: 1,
          status: "active",
          stage: "collect_event",
          startMessageSequence: 0,
          snapshotData: Prisma.JsonNull,
          progressData: Prisma.JsonNull,
          missingSlots: []
        }
      }),
      prisma.interviewSession.update({
        where: { id: sessionId },
        data: { activeEventId: branchStateId }
      }),
      prisma.interviewMessage.create({
        data: {
          id: assistantMessageId,
          sessionId,
          responseGroupId: assistantMessageId,
          responseVersion: 1,
          branchSessionId: sessionId,
          role: "assistant",
          content: serializeAssistantTurnPayload(assistantTurn),
          sequence: 0
        }
      }),
      prisma.interviewBranchCheckpoint.create({
        data: {
          sessionId,
          messageId: assistantMessageId,
          schemaVersion: EVENT_CENTERED_SCHEMA_VERSION,
          sessionState: {
            mode: "event_centered",
            status: "active",
            stage: "collect_event",
            activeEventId: branchStateId,
            turnCount: 0,
            lastAssistantQuestion: input.openingQuestion,
            draftSummary: null
          },
          eventsState: [
            {
              id: branchStateId,
              sequence: 1,
              status: "active",
              stage: "collect_event",
              startMessageSequence: 0
            }
          ]
        }
      })
    ]);
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;

    const winner = await findEventCenteredRootByDate(input.userId, entryDate);
    if (!winner) throw error;
    const identity = await getEventCenteredSessionIdentity(input.userId, winner.id);
    if (!identity) throw error;
    return identity;
  }

  const identity = await getEventCenteredSessionIdentity(input.userId, sessionId);
  if (!identity) throw new Error("SESSION_CREATE_FAILED");
  return identity;
}

async function buildExistingTurnResult(input: {
  rootSessionId: string;
  activeBranchSessionId: string;
  branchStateId: string;
  turn: {
    id: string;
    clientTurnId: string;
    sessionId: string;
    rawText: string | null;
    inputMode: InputMode | null;
    baseMessageSequence: number;
    status: "processing" | "completed" | "failed" | "canceled";
    createdAt: Date;
    messages: Array<{ id: string }>;
  };
}): Promise<ReserveEventCenteredTurnResult> {
  const event = await prisma.journalEvent.findUnique({
    where: { rootSessionId: input.rootSessionId },
    select: { id: true }
  });
  const userMessageId = input.turn.messages[0]?.id;

  if (!event || !userMessageId) throw new Error("EVENT_STATE_CHANGED");

  return {
    kind: "existing",
    eventId: event.id,
    rootSessionId: input.rootSessionId,
    activeBranchSessionId: input.activeBranchSessionId,
    branchStateId: input.branchStateId,
    userMessageId,
    turn: mapTurn(input.turn)
  };
}

export async function reserveEventCenteredUserTurn(input: {
  userId: string;
  rootSessionId: string;
  clientTurnId: string;
  rawText: string;
  inputMode: InputMode;
  baseMessageSequence: number;
  baseBranchSessionId: string;
}): Promise<ReserveEventCenteredTurnResult> {
  const route = await resolveEventCenteredRoute(prisma, input.userId, input.rootSessionId);

  if (!route) throw new Error("SESSION_NOT_FOUND");

  const existing = await prisma.interviewUserTurn.findFirst({
    where: {
      clientTurnId: input.clientTurnId,
      session: {
        userId: input.userId,
        mode: "event_centered",
        OR: [
          { id: route.root.id },
          { rootSessionId: route.root.id }
        ]
      }
    },
    include: {
      messages: {
        where: { role: "user" },
        take: 1,
        select: { id: true }
      }
    }
  });

  if (existing && route.activeBranch.activeEventId) {
    return buildExistingTurnResult({
      rootSessionId: route.root.id,
      activeBranchSessionId: route.activeBranch.id,
      branchStateId: route.activeBranch.activeEventId,
      turn: existing
    });
  }

  if (
    route.root.status !== "active" ||
    route.activeBranch.status !== "active" ||
    route.activeBranch.id !== input.baseBranchSessionId ||
    route.latestMessageSequence !== input.baseMessageSequence ||
    route.root.journalEvent?.status === "generating" ||
    route.root.journalEvent?.status === "completed" ||
    route.root.journalEvent?.status === "abandoned" ||
    !route.activeBranch.activeEventId
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }

  const eventId = route.root.journalEvent?.id ?? randomUUID();
  const turnId = randomUUID();
  const userMessageId = randomUUID();

  try {
    const result = await prisma.$transaction(async (database) => {
      const currentRoute = await resolveEventCenteredRoute(database, input.userId, route.root.id);
      if (
        !currentRoute ||
        currentRoute.root.status !== "active" ||
        currentRoute.activeBranch.status !== "active" ||
        currentRoute.activeBranch.id !== input.baseBranchSessionId ||
        currentRoute.latestMessageSequence !== input.baseMessageSequence ||
        currentRoute.root.journalEvent?.status === "generating" ||
        currentRoute.root.journalEvent?.status === "completed" ||
        currentRoute.root.journalEvent?.status === "abandoned" ||
        !currentRoute.activeBranch.activeEventId
      ) {
        throw new Error("EVENT_STATE_CHANGED");
      }

      const unresolvedTurn = await database.interviewUserTurn.findFirst({
        where: {
          sessionId: currentRoute.activeBranch.id,
          status: { in: ["processing", "failed", "canceled"] }
        },
        select: { id: true }
      });
      if (unresolvedTurn) throw new Error("EVENT_STATE_CHANGED");

      let currentEvent = currentRoute.root.journalEvent;
      if (!currentEvent) {
        const latestEvent = await database.journalEvent.findFirst({
          where: {
            userId: input.userId,
            entryDate: currentRoute.root.entryDate
          },
          orderBy: { daySequence: "desc" },
          select: { daySequence: true }
        });
        currentEvent = await database.journalEvent.create({
          data: {
            id: eventId,
            userId: input.userId,
            rootSessionId: currentRoute.root.id,
            entryDate: currentRoute.root.entryDate,
            daySequence: (latestEvent?.daySequence ?? 0) + 1,
            status: "active",
            startedAt: new Date()
          }
        });
      }

      const turn = await database.interviewUserTurn.create({
        data: {
          id: turnId,
          clientTurnId: input.clientTurnId,
          sessionId: currentRoute.activeBranch.id,
          journalEventId: currentEvent.id,
          activeEventId: currentRoute.activeBranch.activeEventId,
          action: "reply",
          baseBranchSessionId: currentRoute.activeBranch.id,
          rawText: input.rawText,
          inputMode: input.inputMode,
          baseMessageSequence: input.baseMessageSequence,
          status: "processing"
        }
      });

      await database.interviewMessage.create({
        data: {
          id: userMessageId,
          sessionId: currentRoute.activeBranch.id,
          userTurnId: turn.id,
          branchSessionId: currentRoute.activeBranch.id,
          role: "user",
          inputMode: input.inputMode,
          content: input.rawText,
          sequence: input.baseMessageSequence + 1
        }
      });

      return {
        eventId: currentEvent.id,
        branchStateId: currentRoute.activeBranch.activeEventId,
        turn
      };
    });

    return {
      kind: "reserved",
      eventId: result.eventId,
      rootSessionId: route.root.id,
      activeBranchSessionId: route.activeBranch.id,
      branchStateId: result.branchStateId,
      userMessageId,
      turn: mapTurn(result.turn)
    };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;

    const duplicate = await prisma.interviewUserTurn.findUnique({
      where: {
        sessionId_clientTurnId: {
          sessionId: route.activeBranch.id,
          clientTurnId: input.clientTurnId
        }
      },
      include: {
        messages: {
          where: { role: "user" },
          take: 1,
          select: { id: true }
        }
      }
    });

    if (!duplicate) throw new Error("EVENT_STATE_CHANGED");
    return buildExistingTurnResult({
      rootSessionId: route.root.id,
      activeBranchSessionId: route.activeBranch.id,
      branchStateId: route.activeBranch.activeEventId,
      turn: duplicate
    });
  }
}

async function transitionJournalEvent(input: {
  userId: string;
  eventId: string;
  from: Array<"active" | "generating">;
  to: "active" | "generating" | "completed" | "abandoned";
}) {
  return prisma.$transaction(async (database) => {
    const event = await database.journalEvent.findFirst({
      where: {
        id: input.eventId,
        userId: input.userId
      }
    });
    if (!event) throw new Error("EVENT_NOT_FOUND");
    if (!input.from.includes(event.status as "active" | "generating")) {
      throw new Error("EVENT_STATE_CHANGED");
    }

    const now = new Date();
    const transition = await database.journalEvent.updateMany({
      where: {
        id: event.id,
        userId: input.userId,
        status: { in: input.from }
      },
      data: {
        status: input.to,
        generationStartedAt: input.to === "generating" ? now : input.to === "active" ? null : event.generationStartedAt,
        completedAt: input.to === "completed" ? now : null,
        abandonedAt: input.to === "abandoned" ? now : null
      }
    });
    if (transition.count !== 1) throw new Error("EVENT_STATE_CHANGED");

    const updated = await database.journalEvent.findUnique({
      where: { id: event.id }
    });
    if (!updated) throw new Error("EVENT_NOT_FOUND");

    if (input.to === "completed" || input.to === "abandoned") {
      await database.interviewSession.updateMany({
        where: {
          userId: input.userId,
          mode: "event_centered",
          OR: [
            { id: event.rootSessionId },
            { rootSessionId: event.rootSessionId }
          ]
        },
        data: {
          status: input.to,
          completedAt: now
        }
      });
    }

    return mapJournalEvent(updated);
  });
}

export function markJournalEventGenerating(userId: string, eventId: string) {
  return transitionJournalEvent({ userId, eventId, from: ["active"], to: "generating" });
}

export function restoreJournalEventActive(userId: string, eventId: string) {
  return transitionJournalEvent({ userId, eventId, from: ["generating"], to: "active" });
}

export function completeJournalEvent(userId: string, eventId: string) {
  return transitionJournalEvent({ userId, eventId, from: ["generating"], to: "completed" });
}

export function abandonJournalEvent(userId: string, eventId: string) {
  return transitionJournalEvent({ userId, eventId, from: ["active"], to: "abandoned" });
}
