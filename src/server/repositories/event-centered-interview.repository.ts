import { Prisma, type InputMode } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { formatEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import {
  createInitialEventCenteredDialogueState,
  serializeEventCenteredAssistantPayload
} from "@/features/interview/event-centered/dialogue-state";
import { prisma } from "@/server/db/prisma";
import {
  claimJournalDayModeInTransaction,
  resolveJournalDayMode
} from "@/server/repositories/journal-day-mode.repository";
import type {
  EventCenteredInterviewWorkspaceData,
  EventCenteredOperationData,
  EventCenteredSessionIdentity,
  EventCenteredTurnConfirmation,
  EventCenteredUserAction,
  EventCenteredWorkspaceMessageData,
  EventCenteredWorkspacePendingTurn,
  JournalEventIdentity,
  ReserveEventCenteredUserActionInput,
  ReserveEventCenteredTurnResult
} from "@/types/event-centered-interview";

type DatabaseClient = Prisma.TransactionClient;

const EVENT_CENTERED_SCHEMA_VERSION = 3 as const;

type StoredWorkspaceMessage = {
  id: string;
  sessionId: string;
  branchSessionId: string | null;
  userTurnId: string | null;
  role: "user" | "assistant" | "system";
  inputMode: InputMode | null;
  content: string;
  sequence: number;
  responseGroupId: string | null;
  responseVersion: number | null;
  regenerationIntent: "simplify" | "concretize" | "change_angle" | "deepen" | "lighten" | null;
  regeneratedFromMessageId: string | null;
  createdAt: Date;
  userTurn: { rawText: string | null } | null;
};

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

function mapWorkspaceMessage(message: StoredWorkspaceMessage): EventCenteredWorkspaceMessageData {
  return {
    id: message.id,
    sessionId: message.sessionId,
    branchSessionId: message.branchSessionId ?? message.sessionId,
    userTurnId: message.userTurnId,
    role: message.role,
    inputMode: message.inputMode,
    content: message.content,
    rawText: message.userTurn?.rawText ?? null,
    sequence: message.sequence,
    responseGroupId: message.responseGroupId,
    responseVersion: message.responseVersion,
    regenerationIntent: message.regenerationIntent,
    regeneratedFromMessageId: message.regeneratedFromMessageId,
    createdAt: message.createdAt.toISOString()
  };
}

function mapOperationData(value: Prisma.JsonValue | null): EventCenteredOperationData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const kind = value.kind;
  if (
    kind !== "select_current_event" &&
    kind !== "select_exploration_angle" &&
    kind !== "continue_exploration" &&
    kind !== "exit_event"
  ) {
    return null;
  }
  return value as EventCenteredOperationData;
}

function mapPendingTurn(turn: {
  id: string;
  clientTurnId: string;
  sessionId: string;
  activeEventId: string | null;
  action: string;
  targetMessageId: string | null;
  baseBranchSessionId: string | null;
  rawText: string | null;
  inputMode: InputMode | null;
  baseMessageSequence: number;
  status: "processing" | "completed" | "failed" | "canceled";
  attemptCount: number;
  errorCode: string | null;
  eventOperationData: Prisma.JsonValue | null;
  createdAt: Date;
}): EventCenteredWorkspacePendingTurn {
  return {
    ...mapTurn(turn),
    action: turn.action as EventCenteredUserAction,
    activeEventId: turn.activeEventId,
    targetMessageId: turn.targetMessageId,
    baseBranchSessionId: turn.baseBranchSessionId,
    eventOperationData: mapOperationData(turn.eventOperationData),
    errorCode: turn.errorCode,
    attemptCount: turn.attemptCount
  };
}

async function resolveEffectiveMessagePath(
  database: typeof prisma | DatabaseClient,
  rootSessionId: string,
  branchSessionId: string
): Promise<StoredWorkspaceMessage[] | null> {
  const branches = await database.interviewSession.findMany({
    where: {
      OR: [{ id: rootSessionId }, { rootSessionId }]
    },
    select: {
      id: true,
      parentSessionId: true,
      forkMessageSequence: true
    }
  });
  const branchesById = new Map(branches.map((branch) => [branch.id, branch]));
  const chain: typeof branches = [];
  const visited = new Set<string>();
  let cursor: string | null = branchSessionId;

  while (cursor) {
    if (visited.has(cursor)) throw new Error("INTERVIEW_BRANCH_CYCLE");
    visited.add(cursor);
    const branch = branchesById.get(cursor);
    if (!branch) return null;
    chain.push(branch);
    cursor = branch.parentSessionId;
  }

  if (chain.at(-1)?.id !== rootSessionId) return null;

  const branchIds = chain.map((branch) => branch.id);
  const storedMessages = await database.interviewMessage.findMany({
    where: { sessionId: { in: branchIds } },
    orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      sessionId: true,
      branchSessionId: true,
      userTurnId: true,
      role: true,
      inputMode: true,
      content: true,
      sequence: true,
      responseGroupId: true,
      responseVersion: true,
      regenerationIntent: true,
      regeneratedFromMessageId: true,
      createdAt: true,
      userTurn: { select: { rawText: true } }
    }
  });
  const messagesByBranch = new Map<string, StoredWorkspaceMessage[]>();
  for (const message of storedMessages) {
    const branchMessages = messagesByBranch.get(message.sessionId) ?? [];
    branchMessages.push(message);
    messagesByBranch.set(message.sessionId, branchMessages);
  }

  let messages: StoredWorkspaceMessage[] = [];
  for (const branch of chain.reverse()) {
    if (branch.forkMessageSequence !== null) {
      messages = messages.filter((message) => message.sequence < branch.forkMessageSequence!);
    }
    messages = [...messages, ...(messagesByBranch.get(branch.id) ?? [])].sort(
      (left, right) =>
        left.sequence - right.sequence || left.createdAt.getTime() - right.createdAt.getTime()
    );
  }
  return messages;
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
      activeEventId: true
    }
  });

  if (!activeBranch) {
    return null;
  }

  const effectiveMessages = await resolveEffectiveMessagePath(
    database,
    root.id,
    activeBranch.id
  );
  if (!effectiveMessages) return null;

  return {
    root,
    activeBranch,
    effectiveMessages,
    latestMessageSequence: effectiveMessages.at(-1)?.sequence ?? -1
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

export async function getEventCenteredInterviewWorkspaceData(
  userId: string,
  sessionId: string
): Promise<EventCenteredInterviewWorkspaceData | null> {
  const route = await resolveEventCenteredRoute(prisma, userId, sessionId);
  if (!route) return null;

  const responseGroupIds = Array.from(new Set(
    route.effectiveMessages.flatMap((message) =>
      message.responseGroupId ? [message.responseGroupId] : []
    )
  ));
  const [branchState, pendingTurn, journalEntry, responseVersions] = await Promise.all([
    route.activeBranch.activeEventId
      ? prisma.interviewEvent.findUnique({
          where: { id: route.activeBranch.activeEventId },
          select: { snapshotData: true }
        })
      : null,
    prisma.interviewUserTurn.findFirst({
      where: {
        sessionId: route.activeBranch.id,
        status: { in: ["processing", "failed", "canceled"] }
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        clientTurnId: true,
        sessionId: true,
        activeEventId: true,
        action: true,
        targetMessageId: true,
        baseBranchSessionId: true,
        rawText: true,
        inputMode: true,
        baseMessageSequence: true,
        status: true,
        attemptCount: true,
        errorCode: true,
        eventOperationData: true,
        createdAt: true
      }
    }),
    route.root.journalEvent
      ? prisma.journalEventEntry.findFirst({
          where: { eventId: route.root.journalEvent.id },
          select: {
            id: true,
            status: true,
            generationVersion: true,
            contentRevision: true,
            savedRevision: true,
            updatedAt: true
          }
        })
      : null,
    responseGroupIds.length
      ? prisma.interviewMessage.findMany({
          where: { responseGroupId: { in: responseGroupIds } },
          orderBy: [{ responseGroupId: "asc" }, { responseVersion: "asc" }],
          select: {
            id: true,
            sessionId: true,
            branchSessionId: true,
            userTurnId: true,
            role: true,
            inputMode: true,
            content: true,
            sequence: true,
            responseGroupId: true,
            responseVersion: true,
            regenerationIntent: true,
            regeneratedFromMessageId: true,
            createdAt: true,
            userTurn: { select: { rawText: true } }
          }
        })
      : []
  ]);

  return {
    identity: toSessionIdentity(route),
    messages: route.effectiveMessages.map(mapWorkspaceMessage),
    responseVersions: responseVersions.map(mapWorkspaceMessage),
    snapshotData: branchState?.snapshotData ?? null,
    pendingTurn: pendingTurn ? mapPendingTurn(pendingTurn) : null,
    journalEntry: journalEntry
      ? {
          id: journalEntry.id,
          status: journalEntry.status,
          generationVersion: journalEntry.generationVersion,
          contentRevision: journalEntry.contentRevision,
          savedRevision: journalEntry.savedRevision,
          updatedAt: journalEntry.updatedAt.toISOString()
        }
      : null
  };
}

export async function startEventCenteredInterviewSession(input: {
  userId: string;
  entryDate: string;
  openingQuestion: string;
}): Promise<EventCenteredSessionIdentity> {
  const entryDate = parseEntryDateInput(input.entryDate);
  const dayMode = await resolveJournalDayMode(input.userId, input.entryDate);
  if (dayMode.kind === "mixed") {
    throw new Error(dayMode.code);
  }
  if (dayMode.kind === "clean" && dayMode.ownership.primaryMode !== "event_centered") {
    throw new Error("JOURNAL_DAY_MODE_CONFLICT");
  }
  const existing = await findEventCenteredRootByDate(input.userId, entryDate);

  if (existing) {
    const identity = await getEventCenteredSessionIdentity(input.userId, existing.id);
    if (identity) return identity;
  }

  const sessionId = randomUUID();
  const branchStateId = randomUUID();
  const assistantMessageId = randomUUID();
  const dialogueState = createInitialEventCenteredDialogueState();
  const assistantTurn = {
    naturalUnderstanding: "",
    naturalResponse: input.openingQuestion,
    responseKind: "opening" as const,
    questionSpec: null,
    checkpoint: null,
    angleOutcome: null
  };

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
          snapshotData: dialogueState,
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
          content: serializeEventCenteredAssistantPayload(assistantTurn),
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
              startMessageSequence: 0,
              snapshotData: dialogueState
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

const EVENT_ANGLE_LABELS = {
  feeling: "理解感受",
  thought: "理清想法",
  relationship: "梳理关系",
  action: "复盘行动"
} as const;

function assertActionOperationData(input: ReserveEventCenteredUserActionInput) {
  if (input.action === "reply" || input.action === "correct_understanding") return;
  if (input.eventOperationData.kind !== input.action) {
    throw new Error("INVALID_EVENT_OPERATION_DATA");
  }
  if (
    input.action === "select_current_event" &&
    !input.eventOperationData.optionId.trim()
  ) {
    throw new Error("INVALID_EVENT_OPERATION_DATA");
  }
}

function resolveActionMessageContent(input: ReserveEventCenteredUserActionInput) {
  if (input.action === "reply" || input.action === "correct_understanding") return input.rawText;
  if (input.rawText) return input.rawText;
  if (input.eventOperationData.displayText) return input.eventOperationData.displayText;
  if (input.action === "select_current_event") return "选择这件事";
  if (input.action === "select_exploration_angle") {
    return EVENT_ANGLE_LABELS[input.eventOperationData.angle];
  }
  if (input.action === "continue_exploration") return "继续深入";
  return "退出这件事";
}

function toOperationJson(input: ReserveEventCenteredUserActionInput): Prisma.InputJsonValue | undefined {
  if (input.action === "reply" || input.action === "correct_understanding") return undefined;
  return Object.fromEntries(
    Object.entries(input.eventOperationData).filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonValue;
}

export async function reserveEventCenteredUserAction(
  input: ReserveEventCenteredUserActionInput
): Promise<ReserveEventCenteredTurnResult> {
  assertActionOperationData(input);
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
    (!route.root.journalEvent && input.action !== "reply") ||
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
        (!currentRoute.root.journalEvent && input.action !== "reply") ||
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

      const dayMode = await claimJournalDayModeInTransaction(database, {
        userId: input.userId,
        entryDate: formatEntryDate(currentRoute.root.entryDate),
        mode: "event_centered",
        claimedBySessionId: currentRoute.root.id
      });
      if (dayMode.kind === "conflict" || dayMode.kind === "mixed") {
        throw new Error(dayMode.code);
      }

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
          action: input.action,
          baseBranchSessionId: currentRoute.activeBranch.id,
          rawText: input.rawText ?? null,
          inputMode: input.inputMode ?? null,
          baseMessageSequence: input.baseMessageSequence,
          eventOperationData: toOperationJson(input),
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
          inputMode: input.inputMode ?? null,
          content: resolveActionMessageContent(input),
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

export function reserveEventCenteredUserTurn(input: {
  userId: string;
  rootSessionId: string;
  clientTurnId: string;
  rawText: string;
  inputMode: InputMode;
  baseMessageSequence: number;
  baseBranchSessionId: string;
}): Promise<ReserveEventCenteredTurnResult> {
  return reserveEventCenteredUserAction({
    ...input,
    action: "reply"
  });
}

async function abandonActiveJournalEvent(input: {
  userId: string;
  eventId: string;
  turnId?: string;
}) {
  return prisma.$transaction(async (database) => {
    const event = await database.journalEvent.findFirst({
      where: {
        id: input.eventId,
        userId: input.userId
      }
    });
    if (!event) throw new Error("EVENT_NOT_FOUND");
    if (event.status !== "active") {
      throw new Error("EVENT_STATE_CHANGED");
    }

    const now = new Date();
    const transition = await database.journalEvent.updateMany({
      where: {
        id: event.id,
        userId: input.userId,
        status: "active"
      },
      data: {
        status: "abandoned",
        abandonedAt: now
      }
    });
    if (transition.count !== 1) throw new Error("EVENT_STATE_CHANGED");

    const updated = await database.journalEvent.findUnique({
      where: { id: event.id }
    });
    if (!updated) throw new Error("EVENT_NOT_FOUND");

    if (input.turnId) {
      const completedTurn = await database.interviewUserTurn.updateMany({
        where: {
          id: input.turnId,
          journalEventId: event.id,
          action: "exit_event",
          status: "processing"
        },
        data: {
          status: "completed",
          errorCode: null,
          completedAt: now
        }
      });
      if (completedTurn.count !== 1) throw new Error("EVENT_STATE_CHANGED");
    }

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
        status: "abandoned",
        completedAt: now
      }
    });

    return mapJournalEvent(updated);
  });
}

export function abandonJournalEvent(userId: string, eventId: string, turnId?: string) {
  return abandonActiveJournalEvent({ userId, eventId, turnId });
}
