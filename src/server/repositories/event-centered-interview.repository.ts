import { Prisma, type InputMode } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { formatEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import {
  createInitialEventCenteredDialogueState,
  parseEventCenteredDialogueState,
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
  EventCenteredSessionTabRecord,
  EventCenteredTurnConfirmation,
  EventCenteredUserAction,
  EventCenteredWorkspaceMessageData,
  EventCenteredWorkspacePendingTurn,
  JournalEventIdentity,
  ReserveEventCenteredUserActionInput,
  ReserveEventCenteredTurnResult
} from "@/types/event-centered-interview";

type DatabaseClient = Prisma.TransactionClient;

const EVENT_CENTERED_SCHEMA_VERSION = 4 as const;

export const EVENT_CENTERED_GENERATIVE_PLAN_CHECKPOINT_KIND =
  "generative_semantic_plan_checkpoint" as const;
export const EVENT_CENTERED_GENERATIVE_PLAN_CHECKPOINT_VERSION =
  "2026-07-30.v1" as const;
const EVENT_CENTERED_CURRENT_SEMANTIC_PLAN_ARTIFACT_VERSION =
  "event-centered-semantic-plan.v17" as const;
const EVENT_CENTERED_LEGACY_SEMANTIC_PLAN_ARTIFACT_VERSIONS = new Set([
  "event-centered-semantic-plan.v1",
  "event-centered-semantic-plan.v2",
  "event-centered-semantic-plan.v3",
  "event-centered-semantic-plan.v4",
  "event-centered-semantic-plan.v5",
  "event-centered-semantic-plan.v6",
  "event-centered-semantic-plan.v7",
  "event-centered-semantic-plan.v8",
  "event-centered-semantic-plan.v9",
  "event-centered-semantic-plan.v10",
  "event-centered-semantic-plan.v11",
  "event-centered-semantic-plan.v12",
  "event-centered-semantic-plan.v13",
  "event-centered-semantic-plan.v14",
  "event-centered-semantic-plan.v15",
  "event-centered-semantic-plan.v16"
]);

export type EventCenteredGenerativePlanCheckpoint = {
  kind: typeof EVENT_CENTERED_GENERATIVE_PLAN_CHECKPOINT_KIND;
  checkpointVersion: typeof EVENT_CENTERED_GENERATIVE_PLAN_CHECKPOINT_VERSION;
  status: "ready" | "consumed";
  rootSessionId: string;
  activeBranchSessionId: string;
  eventId: string;
  branchStateId: string;
  inputFingerprint: string;
  artifactVersion: string;
  strategyVersion: string;
  angleCardVersion: string;
  fewShotVersion: string;
  promptVersion: string;
  artifact: Record<string, unknown>;
  operationData: EventCenteredOperationData | null;
  createdAt: string;
  consumedAt: string | null;
};

type StoredWorkspaceMessage = {
  id: string;
  sessionId: string;
  branchSessionId: string | null;
  userTurnId: string | null;
  generationTraceId: string | null;
  role: "user" | "assistant" | "system";
  inputMode: InputMode | null;
  content: string;
  sequence: number;
  responseGroupId: string | null;
  responseVersion: number | null;
  regenerationIntent: "simplify" | "concretize" | "change_angle" | "deepen" | "lighten" | null;
  regeneratedFromMessageId: string | null;
  createdAt: Date;
  userTurn: { rawText: string | null; clientTurnId: string } | null;
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
    clientTurnId: message.userTurn?.clientTurnId ?? null,
    generationTraceId: message.generationTraceId,
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function mapGenerativePlanCheckpoint(
  value: Prisma.JsonValue | null
): EventCenteredGenerativePlanCheckpoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    value.kind !== EVENT_CENTERED_GENERATIVE_PLAN_CHECKPOINT_KIND ||
    value.checkpointVersion !== EVENT_CENTERED_GENERATIVE_PLAN_CHECKPOINT_VERSION ||
    (value.status !== "ready" && value.status !== "consumed") ||
    !isNonEmptyString(value.rootSessionId) ||
    !isNonEmptyString(value.activeBranchSessionId) ||
    !isNonEmptyString(value.eventId) ||
    !isNonEmptyString(value.branchStateId) ||
    !isNonEmptyString(value.inputFingerprint) ||
    !isNonEmptyString(value.artifactVersion) ||
    !isNonEmptyString(value.strategyVersion) ||
    !isNonEmptyString(value.angleCardVersion) ||
    !isNonEmptyString(value.fewShotVersion) ||
    !isNonEmptyString(value.promptVersion) ||
    !value.artifact ||
    typeof value.artifact !== "object" ||
    Array.isArray(value.artifact) ||
    !isNonEmptyString(value.createdAt) ||
    (value.consumedAt !== null && !isNonEmptyString(value.consumedAt))
  ) {
    return null;
  }
  const operationData = value.operationData === null
    ? null
    : mapOperationData(value.operationData as Prisma.JsonValue);
  if (value.operationData !== null && !operationData) return null;
  return {
    kind: value.kind,
    checkpointVersion: value.checkpointVersion,
    status: value.status,
    rootSessionId: value.rootSessionId,
    activeBranchSessionId: value.activeBranchSessionId,
    eventId: value.eventId,
    branchStateId: value.branchStateId,
    inputFingerprint: value.inputFingerprint,
    artifactVersion: value.artifactVersion,
    strategyVersion: value.strategyVersion,
    angleCardVersion: value.angleCardVersion,
    fewShotVersion: value.fewShotVersion,
    promptVersion: value.promptVersion,
    artifact: value.artifact as Record<string, unknown>,
    operationData,
    createdAt: value.createdAt,
    consumedAt: value.consumedAt
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function canonicalizeGenerativeCheckpointArtifact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeGenerativeCheckpointArtifact);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalizeGenerativeCheckpointArtifact(item)])
    );
  }
  return value;
}

function generativeCheckpointArtifactsEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>
) {
  return JSON.stringify(canonicalizeGenerativeCheckpointArtifact(left)) ===
    JSON.stringify(canonicalizeGenerativeCheckpointArtifact(right));
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
      generationTraceId: true,
      role: true,
      inputMode: true,
      content: true,
      sequence: true,
      responseGroupId: true,
      responseVersion: true,
      regenerationIntent: true,
      regeneratedFromMessageId: true,
      createdAt: true,
      userTurn: { select: { rawText: true, clientTurnId: true } }
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

async function findEventCenteredRootByDate(
  userId: string,
  entryDate: Date,
  recordMode: "capture" | "chat"
) {
  return prisma.interviewSession.findFirst({
    where: {
      userId,
      entryDate,
      mode: "event_centered",
      recordMode,
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
      recordMode: true,
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
    recordMode: route.root.recordMode ?? "chat",
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

/**
 * 对话页的事件标签需要保留已退出记录；日历继续沿用“成果状态”读取口径。
 * 该读模型只返回标签所需字段，不暴露用户原话或对话正文。
 */
export async function listEventCenteredSessionTabsByDate(
  userId: string,
  entryDateInput: string
): Promise<EventCenteredSessionTabRecord[]> {
  const entryDate = parseEntryDateInput(entryDateInput);
  const events = await prisma.journalEvent.findMany({
    where: { userId, entryDate },
    select: {
      rootSessionId: true,
      daySequence: true,
      status: true,
      rootSession: { select: { recordMode: true } },
      entry: { select: { title: true } }
    },
    orderBy: [{ daySequence: "asc" }, { startedAt: "asc" }]
  });
  return events.map((event) => ({
    rootSessionId: event.rootSessionId,
    recordMode: event.rootSession?.recordMode ?? "chat",
    label: event.entry?.title.trim() || `事件 ${event.daySequence}`,
    status: event.status
  }));
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
            generationTraceId: true,
            role: true,
            inputMode: true,
            content: true,
            sequence: true,
            responseGroupId: true,
            responseVersion: true,
            regenerationIntent: true,
            regeneratedFromMessageId: true,
            createdAt: true,
            userTurn: { select: { rawText: true, clientTurnId: true } }
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
  recordMode?: "capture" | "chat";
  openingMessage?: string;
  /** Historical test/script compatibility; new callers use openingMessage. */
  openingQuestion?: string;
  lastAssistantQuestion?: string | null;
}): Promise<EventCenteredSessionIdentity> {
  const entryDate = parseEntryDateInput(input.entryDate);
  const recordMode = input.recordMode ?? "chat";
  const openingMessage =
    input.openingMessage ?? input.openingQuestion ?? "先从这件事开始吧。刚刚发生了什么？";
  const lastAssistantQuestion = input.lastAssistantQuestion === undefined
    ? recordMode === "chat" ? openingMessage : null
    : input.lastAssistantQuestion;
  const dayMode = await resolveJournalDayMode(input.userId, input.entryDate);
  if (dayMode.kind === "mixed") {
    throw new Error(dayMode.code);
  }
  if (dayMode.kind === "clean" && dayMode.ownership.primaryMode !== "event_centered") {
    throw new Error("JOURNAL_DAY_MODE_CONFLICT");
  }
  const existing = await findEventCenteredRootByDate(
    input.userId,
    entryDate,
    recordMode
  );

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
    naturalResponse: openingMessage,
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
          recordMode,
          dimension: null,
          conversationSchemaVersion: EVENT_CENTERED_SCHEMA_VERSION,
          rootSessionId: sessionId,
          activeBranchSessionId: sessionId,
          status: "active",
          stage: "collect_event",
          entryDate,
          lastAssistantQuestion
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
            lastAssistantQuestion,
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

    const winner = await findEventCenteredRootByDate(
      input.userId,
      entryDate,
      recordMode
    );
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
  eventId: string;
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
  const userMessageId = input.turn.messages[0]?.id;

  if (!input.eventId || !userMessageId) throw new Error("EVENT_STATE_CHANGED");

  return {
    kind: "existing",
    eventId: input.eventId,
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
  const eventId = randomUUID();
  const turnId = randomUUID();
  const userMessageId = randomUUID();

  try {
    const result = await prisma.$transaction(async (database) => {
      const currentRoute = await resolveEventCenteredRoute(
        database,
        input.userId,
        input.rootSessionId
      );
      if (!currentRoute) throw new Error("SESSION_NOT_FOUND");
      const branchStateId = currentRoute.activeBranch.activeEventId;
      if (!branchStateId) throw new Error("EVENT_STATE_CHANGED");

      const existing = await database.interviewUserTurn.findFirst({
        where: {
          clientTurnId: input.clientTurnId,
          session: {
            userId: input.userId,
            mode: "event_centered",
            OR: [
              { id: currentRoute.root.id },
              { rootSessionId: currentRoute.root.id }
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

      if (existing && currentRoute.activeBranch.activeEventId) {
        const existingEventId = currentRoute.root.journalEvent?.id ?? existing.journalEventId;
        if (!existingEventId) throw new Error("EVENT_STATE_CHANGED");
        return {
          kind: "existing" as const,
          eventId: existingEventId,
          branchStateId,
          route: currentRoute,
          turn: existing
        };
      }

      if (
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

      if (input.action === "select_exploration_angle") {
        const branchStateSnapshot = await database.interviewEvent.findUnique({
          where: { id: currentRoute.activeBranch.activeEventId },
          select: { snapshotData: true }
        });
        const dialogueState = parseEventCenteredDialogueState(
          branchStateSnapshot?.snapshotData ?? null
        );
        if (dialogueState.angleRuns[input.eventOperationData.angle]?.status === "closed") {
          throw new Error("EVENT_ANGLE_CLOSED");
        }
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
          targetMessageId: input.action === "correct_understanding"
            ? input.targetMessageId ?? null
            : null,
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
        kind: "reserved" as const,
        eventId: currentEvent.id,
        branchStateId,
        route: currentRoute,
        turn
      };
    });

    if (result.kind === "existing") {
      return buildExistingTurnResult({
        eventId: result.eventId,
        rootSessionId: result.route.root.id,
        activeBranchSessionId: result.route.activeBranch.id,
        branchStateId: result.branchStateId,
        turn: result.turn
      });
    }
    return {
      kind: "reserved",
      eventId: result.eventId,
      rootSessionId: result.route.root.id,
      activeBranchSessionId: result.route.activeBranch.id,
      branchStateId: result.branchStateId,
      userMessageId,
      turn: mapTurn(result.turn)
    };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;

    const route = await resolveEventCenteredRoute(prisma, input.userId, input.rootSessionId);
    if (!route) throw new Error("SESSION_NOT_FOUND");

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

    if (!duplicate || !duplicate.journalEventId || !route.activeBranch.activeEventId) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    return buildExistingTurnResult({
      eventId: route.root.journalEvent?.id ?? duplicate.journalEventId,
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

function isGenerativePlanCheckpointValue(value: Prisma.JsonValue | null) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.kind === EVENT_CENTERED_GENERATIVE_PLAN_CHECKPOINT_KIND
  );
}

function assertGenerativePlanCheckpointRoute(input: {
  checkpoint: EventCenteredGenerativePlanCheckpoint;
  rootSessionId: string;
  activeBranchSessionId: string;
  eventId: string;
  branchStateId: string;
}) {
  if (
    input.checkpoint.rootSessionId !== input.rootSessionId ||
    input.checkpoint.activeBranchSessionId !== input.activeBranchSessionId ||
    input.checkpoint.eventId !== input.eventId ||
    input.checkpoint.branchStateId !== input.branchStateId
  ) {
    throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_STALE");
  }
}

export async function persistEventCenteredGenerativePlanCheckpoint(input: {
  userId: string;
  userTurnId: string;
  rootSessionId: string;
  activeBranchSessionId: string;
  eventId: string;
  branchStateId: string;
  inputFingerprint: string;
  artifactVersion: string;
  strategyVersion: string;
  angleCardVersion: string;
  fewShotVersion: string;
  promptVersion: string;
  artifact: Record<string, unknown>;
}): Promise<EventCenteredGenerativePlanCheckpoint> {
  return prisma.$transaction(async (database) => {
    const route = await resolveEventCenteredRoute(database, input.userId, input.rootSessionId);
    if (
      !route ||
      route.root.id !== input.rootSessionId ||
      route.activeBranch.id !== input.activeBranchSessionId ||
      route.root.journalEvent?.id !== input.eventId ||
      route.activeBranch.activeEventId !== input.branchStateId
    ) {
      throw new Error("EVENT_STATE_CHANGED");
    }

    const turn = await database.interviewUserTurn.findUnique({
      where: { id: input.userTurnId },
      select: {
        id: true,
        sessionId: true,
        journalEventId: true,
        activeEventId: true,
        status: true,
        eventOperationData: true
      }
    });
    if (
      !turn ||
      turn.sessionId !== input.activeBranchSessionId ||
      turn.journalEventId !== input.eventId ||
      turn.activeEventId !== input.branchStateId ||
      turn.status !== "processing"
    ) {
      throw new Error("EVENT_TURN_RETRY_REQUIRED");
    }

    const existing = mapGenerativePlanCheckpoint(turn.eventOperationData);
    if (existing) {
      assertGenerativePlanCheckpointRoute({
        checkpoint: existing,
        rootSessionId: input.rootSessionId,
        activeBranchSessionId: input.activeBranchSessionId,
        eventId: input.eventId,
        branchStateId: input.branchStateId
      });
      const matchesIncomingVersion =
        existing.status === "ready" &&
        existing.inputFingerprint === input.inputFingerprint &&
        existing.artifactVersion === input.artifactVersion &&
        existing.strategyVersion === input.strategyVersion &&
        existing.angleCardVersion === input.angleCardVersion &&
        existing.fewShotVersion === input.fewShotVersion &&
        existing.promptVersion === input.promptVersion;
      if (matchesIncomingVersion) {
        if (generativeCheckpointArtifactsEqual(existing.artifact, input.artifact)) {
          return existing;
        }
        throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_CONFLICT");
      }

      const canReplaceLegacySemanticPlan =
        existing.status === "ready" &&
        existing.inputFingerprint === input.inputFingerprint &&
        EVENT_CENTERED_LEGACY_SEMANTIC_PLAN_ARTIFACT_VERSIONS.has(
          existing.artifactVersion
        ) &&
        input.artifactVersion ===
          EVENT_CENTERED_CURRENT_SEMANTIC_PLAN_ARTIFACT_VERSION;
      if (!canReplaceLegacySemanticPlan) {
        throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_CONFLICT");
      }

      const replacement: EventCenteredGenerativePlanCheckpoint = {
        ...existing,
        artifactVersion: input.artifactVersion,
        strategyVersion: input.strategyVersion,
        angleCardVersion: input.angleCardVersion,
        fewShotVersion: input.fewShotVersion,
        promptVersion: input.promptVersion,
        artifact: input.artifact,
        createdAt: new Date().toISOString(),
        consumedAt: null
      };
      const replaced = await database.interviewUserTurn.updateMany({
        where: {
          id: turn.id,
          sessionId: input.activeBranchSessionId,
          journalEventId: input.eventId,
          activeEventId: input.branchStateId,
          status: "processing",
          eventOperationData: {
            equals: turn.eventOperationData === null
              ? Prisma.DbNull
              : turn.eventOperationData
          }
        },
        data: { eventOperationData: toJsonValue(replacement) }
      });
      if (replaced.count === 1) return replacement;

      const winner = await database.interviewUserTurn.findUnique({
        where: { id: turn.id },
        select: { eventOperationData: true }
      });
      const winnerCheckpoint = mapGenerativePlanCheckpoint(
        winner?.eventOperationData ?? null
      );
      if (
        winnerCheckpoint?.status === "ready" &&
        winnerCheckpoint.inputFingerprint === input.inputFingerprint &&
        winnerCheckpoint.artifactVersion === input.artifactVersion &&
        winnerCheckpoint.strategyVersion === input.strategyVersion &&
        winnerCheckpoint.angleCardVersion === input.angleCardVersion &&
        winnerCheckpoint.fewShotVersion === input.fewShotVersion &&
        winnerCheckpoint.promptVersion === input.promptVersion
      ) {
        assertGenerativePlanCheckpointRoute({
          checkpoint: winnerCheckpoint,
          rootSessionId: input.rootSessionId,
          activeBranchSessionId: input.activeBranchSessionId,
          eventId: input.eventId,
          branchStateId: input.branchStateId
        });
        return winnerCheckpoint;
      }
      throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_CONFLICT");
    }
    if (isGenerativePlanCheckpointValue(turn.eventOperationData)) {
      throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_VERSION_UNSUPPORTED");
    }

    const checkpoint: EventCenteredGenerativePlanCheckpoint = {
      kind: EVENT_CENTERED_GENERATIVE_PLAN_CHECKPOINT_KIND,
      checkpointVersion: EVENT_CENTERED_GENERATIVE_PLAN_CHECKPOINT_VERSION,
      status: "ready",
      rootSessionId: input.rootSessionId,
      activeBranchSessionId: input.activeBranchSessionId,
      eventId: input.eventId,
      branchStateId: input.branchStateId,
      inputFingerprint: input.inputFingerprint,
      artifactVersion: input.artifactVersion,
      strategyVersion: input.strategyVersion,
      angleCardVersion: input.angleCardVersion,
      fewShotVersion: input.fewShotVersion,
      promptVersion: input.promptVersion,
      artifact: input.artifact,
      operationData: mapOperationData(turn.eventOperationData),
      createdAt: new Date().toISOString(),
      consumedAt: null
    };
    const updated = await database.interviewUserTurn.updateMany({
      where: {
        id: turn.id,
        sessionId: input.activeBranchSessionId,
        journalEventId: input.eventId,
        activeEventId: input.branchStateId,
        status: "processing",
        eventOperationData: {
          equals: turn.eventOperationData === null
            ? Prisma.DbNull
            : turn.eventOperationData
        }
      },
      data: { eventOperationData: toJsonValue(checkpoint) }
    });
    if (updated.count !== 1) {
      const winner = await database.interviewUserTurn.findUnique({
        where: { id: turn.id },
        select: { eventOperationData: true }
      });
      const winnerCheckpoint = mapGenerativePlanCheckpoint(
        winner?.eventOperationData ?? null
      );
      if (
        winnerCheckpoint?.status === "ready" &&
        winnerCheckpoint.inputFingerprint === input.inputFingerprint &&
        winnerCheckpoint.artifactVersion === input.artifactVersion &&
        winnerCheckpoint.strategyVersion === input.strategyVersion &&
        winnerCheckpoint.angleCardVersion === input.angleCardVersion &&
        winnerCheckpoint.fewShotVersion === input.fewShotVersion &&
        winnerCheckpoint.promptVersion === input.promptVersion
      ) {
        assertGenerativePlanCheckpointRoute({
          checkpoint: winnerCheckpoint,
          rootSessionId: input.rootSessionId,
          activeBranchSessionId: input.activeBranchSessionId,
          eventId: input.eventId,
          branchStateId: input.branchStateId
        });
        return winnerCheckpoint;
      }
      throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_CONFLICT");
    }
    return checkpoint;
  });
}

export async function getEventCenteredGenerativePlanCheckpoint(input: {
  userId: string;
  rootSessionId: string;
  activeBranchSessionId: string;
  clientTurnId: string;
}): Promise<EventCenteredGenerativePlanCheckpoint | null> {
  const route = await resolveEventCenteredRoute(prisma, input.userId, input.rootSessionId);
  if (!route) throw new Error("SESSION_NOT_FOUND");
  if (
    route.root.id !== input.rootSessionId ||
    route.activeBranch.id !== input.activeBranchSessionId ||
    !route.root.journalEvent?.id ||
    !route.activeBranch.activeEventId
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  const turn = await prisma.interviewUserTurn.findUnique({
    where: {
      sessionId_clientTurnId: {
        sessionId: input.activeBranchSessionId,
        clientTurnId: input.clientTurnId
      }
    },
    select: {
      journalEventId: true,
      activeEventId: true,
      status: true,
      eventOperationData: true
    }
  });
  if (!turn || (turn.status !== "processing" && turn.status !== "failed" && turn.status !== "canceled")) {
    return null;
  }
  const checkpoint = mapGenerativePlanCheckpoint(turn.eventOperationData);
  if (!checkpoint) {
    if (isGenerativePlanCheckpointValue(turn.eventOperationData)) {
      throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_VERSION_UNSUPPORTED");
    }
    return null;
  }
  if (checkpoint.status !== "ready") return null;
  assertGenerativePlanCheckpointRoute({
    checkpoint,
    rootSessionId: route.root.id,
    activeBranchSessionId: route.activeBranch.id,
    eventId: route.root.journalEvent.id,
    branchStateId: route.activeBranch.activeEventId
  });
  if (
    turn.journalEventId !== checkpoint.eventId ||
    turn.activeEventId !== checkpoint.branchStateId
  ) {
    throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_STALE");
  }
  return checkpoint;
}

export async function consumeEventCenteredGenerativePlanCheckpoint(input: {
  userId: string;
  userTurnId: string;
  rootSessionId: string;
  activeBranchSessionId: string;
  eventId: string;
  branchStateId: string;
}) {
  const route = await resolveEventCenteredRoute(prisma, input.userId, input.rootSessionId);
  if (
    !route ||
    route.root.id !== input.rootSessionId ||
    route.activeBranch.id !== input.activeBranchSessionId ||
    route.root.journalEvent?.id !== input.eventId ||
    route.activeBranch.activeEventId !== input.branchStateId
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  const turn = await prisma.interviewUserTurn.findUnique({
    where: { id: input.userTurnId },
    select: {
      sessionId: true,
      journalEventId: true,
      activeEventId: true,
      status: true,
      eventOperationData: true
    }
  });
  const checkpoint = mapGenerativePlanCheckpoint(turn?.eventOperationData ?? null);
  if (
    !turn ||
    turn.sessionId !== input.activeBranchSessionId ||
    turn.journalEventId !== input.eventId ||
    turn.activeEventId !== input.branchStateId ||
    turn.status !== "completed" ||
    !checkpoint
  ) {
    throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_NOT_READY");
  }
  assertGenerativePlanCheckpointRoute({ checkpoint, ...input });
  if (checkpoint.status === "consumed") return checkpoint;
  const consumed: EventCenteredGenerativePlanCheckpoint = {
    ...checkpoint,
    status: "consumed",
    consumedAt: new Date().toISOString()
  };
  const updated = await prisma.interviewUserTurn.updateMany({
    where: {
      id: input.userTurnId,
      sessionId: input.activeBranchSessionId,
      journalEventId: input.eventId,
      activeEventId: input.branchStateId,
      status: "completed"
    },
    data: { eventOperationData: toJsonValue(consumed) }
  });
  if (updated.count !== 1) throw new Error("EVENT_STATE_CHANGED");
  return consumed;
}

/**
 * 生成式表达在同一用户轮内耗尽技术尝试后，baseline 必须从上一份已提交
 * 状态重新执行。这里用一次带路由与原值校验的更新撤销尚未提交的语义
 * checkpoint，同时恢复该轮原有的确定性操作数据。
 */
export async function discardEventCenteredGenerativePlanCheckpoint(input: {
  userId: string;
  userTurnId: string;
  rootSessionId: string;
  activeBranchSessionId: string;
  eventId: string;
  branchStateId: string;
}) {
  const route = await resolveEventCenteredRoute(prisma, input.userId, input.rootSessionId);
  if (
    !route ||
    route.root.id !== input.rootSessionId ||
    route.activeBranch.id !== input.activeBranchSessionId ||
    route.root.journalEvent?.id !== input.eventId ||
    route.activeBranch.activeEventId !== input.branchStateId
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  const turn = await prisma.interviewUserTurn.findUnique({
    where: { id: input.userTurnId },
    select: {
      sessionId: true,
      journalEventId: true,
      activeEventId: true,
      status: true,
      eventOperationData: true
    }
  });
  const checkpoint = mapGenerativePlanCheckpoint(turn?.eventOperationData ?? null);
  if (
    !turn ||
    turn.sessionId !== input.activeBranchSessionId ||
    turn.journalEventId !== input.eventId ||
    turn.activeEventId !== input.branchStateId ||
    turn.status !== "processing" ||
    !checkpoint ||
    checkpoint.status !== "ready"
  ) {
    throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_NOT_READY");
  }
  assertGenerativePlanCheckpointRoute({ checkpoint, ...input });
  const updated = await prisma.interviewUserTurn.updateMany({
    where: {
      id: input.userTurnId,
      sessionId: input.activeBranchSessionId,
      journalEventId: input.eventId,
      activeEventId: input.branchStateId,
      status: "processing",
      eventOperationData: {
        equals: turn.eventOperationData === null
          ? Prisma.DbNull
          : turn.eventOperationData
      }
    },
    data: {
      eventOperationData: checkpoint.operationData === null
        ? Prisma.DbNull
        : toJsonValue(checkpoint.operationData)
    }
  });
  if (updated.count !== 1) throw new Error("EVENT_STATE_CHANGED");
  return checkpoint.operationData;
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
