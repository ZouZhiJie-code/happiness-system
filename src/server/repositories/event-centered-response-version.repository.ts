import { Prisma, type InterviewRegenerationIntent } from "@prisma/client";
import { randomUUID } from "node:crypto";

import {
  parseEventCenteredAssistantPayload,
  parseEventCenteredDialogueState,
  serializeEventCenteredAssistantPayload
} from "@/features/interview/event-centered/dialogue-state";
import { isEventCenteredThoughtOnlyScope } from "@/features/interview/event-centered-release";
import { prisma } from "@/server/db/prisma";
import type {
  EventCenteredAssistantPayload,
  EventCenteredDialogueState
} from "@/types/event-centered-dialogue";

type DatabaseClient = Prisma.TransactionClient;

const REPAIR_INTENTS = new Set<InterviewRegenerationIntent>([
  "simplify",
  "concretize",
  "lighten"
]);

export function assertEventCenteredResponseVersionCapacity(versionCount: number) {
  if (versionCount >= 3) throw new Error("INTERVIEW_REGENERATION_LIMIT_REACHED");
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isActiveEventStatus(value: string | null | undefined) {
  return value === "active";
}

async function resolveEventRoute(
  database: typeof prisma | DatabaseClient,
  input: { userId: string; rootSessionId: string }
) {
  const root = await database.interviewSession.findFirst({
    where: {
      id: input.rootSessionId,
      userId: input.userId,
      mode: "event_centered",
      parentSessionId: null
    },
    include: { journalEvent: true }
  });
  if (!root) throw new Error("SESSION_NOT_FOUND");
  const activeBranchSessionId = root.activeBranchSessionId ?? root.id;
  const activeBranch = await database.interviewSession.findFirst({
    where: {
      id: activeBranchSessionId,
      userId: input.userId,
      mode: "event_centered",
      OR: [{ id: root.id }, { rootSessionId: root.id }]
    }
  });
  if (!activeBranch) throw new Error("EVENT_STATE_CHANGED");
  return { root, activeBranch, activeBranchSessionId };
}

async function resolveEffectiveMessages(
  database: typeof prisma | DatabaseClient,
  rootSessionId: string,
  branchSessionId: string
) {
  const branches = await database.interviewSession.findMany({
    where: { OR: [{ id: rootSessionId }, { rootSessionId }] },
    select: { id: true, parentSessionId: true, forkMessageSequence: true }
  });
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const chain: typeof branches = [];
  const visited = new Set<string>();
  let cursor: string | null = branchSessionId;
  while (cursor) {
    if (visited.has(cursor)) throw new Error("INTERVIEW_BRANCH_CYCLE");
    visited.add(cursor);
    const branch = byId.get(cursor);
    if (!branch) throw new Error("EVENT_STATE_CHANGED");
    chain.push(branch);
    cursor = branch.parentSessionId;
  }
  if (chain.at(-1)?.id !== rootSessionId) throw new Error("EVENT_STATE_CHANGED");

  const messages = await database.interviewMessage.findMany({
    where: { sessionId: { in: chain.map((branch) => branch.id) } },
    orderBy: [{ sequence: "asc" }, { createdAt: "asc" }]
  });
  const byBranch = new Map<string, typeof messages>();
  for (const message of messages) {
    const list = byBranch.get(message.sessionId) ?? [];
    list.push(message);
    byBranch.set(message.sessionId, list);
  }
  let effective: typeof messages = [];
  for (const branch of chain.reverse()) {
    if (branch.forkMessageSequence !== null) {
      effective = effective.filter((message) => message.sequence < branch.forkMessageSequence!);
    }
    effective = [...effective, ...(byBranch.get(branch.id) ?? [])].sort(
      (left, right) => left.sequence - right.sequence || left.createdAt.getTime() - right.createdAt.getTime()
    );
  }
  return effective;
}

export type ReservedEventCenteredResponseVersion = {
  kind: "reserved" | "completed";
  regenerationId: string;
  generationTraceId: string;
  userTurnId: string;
  eventId: string;
  rootSessionId: string;
  sourceBranchSessionId: string;
  targetMessageId: string;
  targetPayload: EventCenteredAssistantPayload;
  targetContent: string;
  responseGroupId: string;
  responseVersion: number;
};

export async function reserveEventCenteredResponseVersion(input: {
  userId: string;
  rootSessionId: string;
  targetMessageId: string;
  intent: InterviewRegenerationIntent;
  clientTurnId: string;
  baseMessageSequence: number;
  baseBranchSessionId: string;
}): Promise<ReservedEventCenteredResponseVersion> {
  const route = await resolveEventRoute(prisma, input);
  if (
    route.root.status !== "active" ||
    !route.root.journalEvent ||
    !isActiveEventStatus(route.root.journalEvent.status)
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }

  const existingTurn = await prisma.interviewUserTurn.findFirst({
    where: {
      clientTurnId: input.clientTurnId,
      action: "regenerate_question",
      session: { OR: [{ id: route.root.id }, { rootSessionId: route.root.id }] }
    },
    include: { responseRegeneration: true }
  });
  if (existingTurn?.responseRegeneration?.generatedTraceId) {
    const sourceMessageId = existingTurn.status === "completed"
      ? existingTurn.responseRegeneration.generatedMessageId ?? existingTurn.responseRegeneration.sourceMessageId
      : existingTurn.responseRegeneration.sourceMessageId;
    const source = await prisma.interviewMessage.findUnique({
      where: { id: sourceMessageId }
    });
    const payload = source ? parseEventCenteredAssistantPayload(source.content) : null;
    if (!source?.responseGroupId || !payload?.questionSpec) {
      throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
    }
    if (existingTurn.status === "processing") throw new Error("INTERVIEW_TURN_IN_PROGRESS");
    if (existingTurn.status !== "completed") throw new Error("INTERVIEW_TURN_RETRY_REQUIRED");
    return {
      kind: "completed",
      regenerationId: existingTurn.responseRegeneration.id,
      generationTraceId: existingTurn.responseRegeneration.generatedTraceId,
      userTurnId: existingTurn.id,
      eventId: route.root.journalEvent.id,
      rootSessionId: route.root.id,
      sourceBranchSessionId: existingTurn.responseRegeneration.branchSessionId,
      targetMessageId: source.id,
      targetPayload: payload,
      targetContent: source.content,
      responseGroupId: source.responseGroupId,
      responseVersion: source.responseVersion ?? 1
    };
  }

  if (route.activeBranchSessionId !== input.baseBranchSessionId) {
    throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
  }
  const effectiveMessages = await resolveEffectiveMessages(
    prisma,
    route.root.id,
    route.activeBranchSessionId
  );
  const target = effectiveMessages.find((message) => message.id === input.targetMessageId);
  const latest = effectiveMessages.at(-1);
  const payload = target?.role === "assistant"
    ? parseEventCenteredAssistantPayload(target.content)
    : null;
  if (
    !target ||
    latest?.id !== target.id ||
    !payload?.questionSpec ||
    !target.responseGroupId
  ) {
    throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
  }
  if (input.baseMessageSequence !== latest.sequence) throw new Error("INTERVIEW_TURN_OUT_OF_DATE");
  const versionCount = await prisma.interviewMessage.count({
    where: { responseGroupId: target.responseGroupId }
  });
  assertEventCenteredResponseVersionCapacity(versionCount);
  const opportunity = payload.questionSpec.opportunityNumber ?? 0;
  if (!isEventCenteredThoughtOnlyScope() && REPAIR_INTENTS.has(input.intent) && opportunity >= 3) {
    throw new Error("INTERVIEW_QUESTION_OPPORTUNITY_LIMIT_REACHED");
  }
  const questionTarget = payload.questionSpec.target;

  const ids = {
    turn: randomUUID(),
    trace: randomUUID(),
    regeneration: randomUUID()
  };
  await prisma.$transaction(async (database) => {
    const current = await resolveEventRoute(database, input);
    if (
      current.activeBranchSessionId !== route.activeBranchSessionId ||
      current.root.journalEvent?.id !== route.root.journalEvent?.id ||
      !isActiveEventStatus(current.root.journalEvent?.status)
    ) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    const unresolved = await database.interviewUserTurn.findFirst({
      where: {
        sessionId: route.activeBranchSessionId,
        status: { in: ["processing", "failed", "canceled"] }
      },
      select: { id: true }
    });
    if (unresolved) throw new Error("INTERVIEW_TURN_IN_PROGRESS");

    await database.interviewUserTurn.create({
      data: {
        id: ids.turn,
        clientTurnId: input.clientTurnId,
        sessionId: route.activeBranchSessionId,
        journalEventId: route.root.journalEvent!.id,
        activeEventId: route.activeBranch.activeEventId,
        action: "regenerate_question",
        targetMessageId: target.id,
        regenerationIntent: input.intent,
        baseBranchSessionId: input.baseBranchSessionId,
        baseMessageSequence: input.baseMessageSequence,
        eventOperationData: toJsonValue({
          kind: "regenerate_question",
          intent: input.intent,
          responseGroupId: target.responseGroupId,
          sourceQuestionTarget: questionTarget
        }),
        status: "processing"
      }
    });
    await database.aIGenerationTrace.create({
      data: {
        id: ids.trace,
        userId: input.userId,
        sessionId: route.activeBranchSessionId,
        journalEventId: route.root.journalEvent!.id,
        artifactType: "interview_turn",
        triggerMessageId: target.id,
        status: "pending",
        contextSnapshot: toJsonValue({
          mode: "event_centered",
          action: "regenerate_question",
          rootSessionId: route.root.id,
          sourceBranchSessionId: route.activeBranchSessionId,
          targetMessageId: target.id,
          intent: input.intent,
          eventId: route.root.journalEvent!.id,
          questionTarget
        }),
        pipelineDecisions: toJsonValue([])
      }
    });
    await database.aIResponseRegeneration.create({
      data: {
        id: ids.regeneration,
        rootSessionId: route.root.id,
        branchSessionId: route.activeBranchSessionId,
        targetMessageId: target.id,
        sourceMessageId: target.id,
        sourceTraceId: target.generationTraceId,
        generatedTraceId: ids.trace,
        userTurnId: ids.turn,
        intent: input.intent,
        status: "processing"
      }
    });
  });

  return {
    kind: "reserved",
    regenerationId: ids.regeneration,
    generationTraceId: ids.trace,
    userTurnId: ids.turn,
    eventId: route.root.journalEvent.id,
    rootSessionId: route.root.id,
    sourceBranchSessionId: route.activeBranchSessionId,
    targetMessageId: target.id,
    targetPayload: payload,
    targetContent: target.content,
    responseGroupId: target.responseGroupId,
    responseVersion: versionCount + 1
  };
}

function cloneDialogueStateForVersion(input: {
  snapshotData: unknown;
  payload: EventCenteredAssistantPayload;
  intent: InterviewRegenerationIntent;
}) {
  const state = parseEventCenteredDialogueState(input.snapshotData);
  const spec = input.payload.questionSpec;
  if (!spec || !REPAIR_INTENTS.has(input.intent)) return state;
  const nextOpportunity = isEventCenteredThoughtOnlyScope()
    ? Math.max(1, spec.opportunityNumber ?? 1)
    : Math.min(3, (spec.opportunityNumber ?? 0) + 1);
  if (state.currentQuestion) {
    state.currentQuestion.opportunityNumber = nextOpportunity;
    state.currentQuestion.repairCount = Math.min(3, state.currentQuestion.repairCount + 1);
    state.currentQuestion.surfaceLevel = input.intent === "simplify"
      ? "simplified"
      : input.intent === "concretize"
        ? "concrete_anchor"
        : "low_pressure_choice";
  }
  if (spec.angle) {
    const run = state.angleRuns[spec.angle];
    if (run) {
      run.questionOpportunityCount = nextOpportunity;
    }
  }
  return state;
}

export async function completeEventCenteredResponseVersion(input: {
  userId: string;
  regenerationId: string;
  userTurnId: string;
  payload: EventCenteredAssistantPayload;
  candidates: unknown;
  selectedCandidate: number;
  checks: unknown;
  requestId?: string | null;
  outputOrigin: "llm" | "deterministic" | "fallback";
  latencyMs: number;
}) {
  const assistantMessageId = randomUUID();
  const childSessionId = randomUUID();
  return prisma.$transaction(async (database) => {
    const regeneration = await database.aIResponseRegeneration.findUnique({
      where: { id: input.regenerationId }
    });
    if (
      !regeneration ||
      regeneration.userTurnId !== input.userTurnId ||
      !regeneration.generatedTraceId
    ) {
      throw new Error("INTERVIEW_REGENERATION_FAILED");
    }
    if (regeneration.status === "completed" && regeneration.generatedMessageId) {
      const root = await database.interviewSession.findUnique({
        where: { id: regeneration.rootSessionId },
        include: { journalEvent: true }
      });
      if (!root?.journalEvent) throw new Error("EVENT_STATE_CHANGED");
      return {
        eventId: root.journalEvent.id,
        rootSessionId: root.id,
        activeBranchSessionId: root.activeBranchSessionId ?? root.id,
        assistantMessageId: regeneration.generatedMessageId
      };
    }
    const target = await database.interviewMessage.findUnique({
      where: { id: regeneration.sourceMessageId }
    });
    const [root, sourceBranch, checkpoint] = await Promise.all([
      database.interviewSession.findUnique({
        where: { id: regeneration.rootSessionId },
        include: { journalEvent: true }
      }),
      database.interviewSession.findUnique({ where: { id: regeneration.branchSessionId } }),
      database.interviewBranchCheckpoint.findUnique({ where: { messageId: regeneration.sourceMessageId } })
    ]);
    if (
      !root ||
      !sourceBranch ||
      !checkpoint ||
      !target?.responseGroupId ||
      root.userId !== input.userId ||
      root.mode !== "event_centered" ||
      root.status !== "active" ||
      !root.journalEvent ||
      !isActiveEventStatus(root.journalEvent.status) ||
      (root.activeBranchSessionId ?? root.id) !== sourceBranch.id
    ) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    const sourcePayload = parseEventCenteredAssistantPayload(target.content);
    if (!sourcePayload?.questionSpec || !input.payload.questionSpec) {
      throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
    }
    if (
      input.payload.questionSpec.angle !== sourcePayload.questionSpec.angle ||
      input.payload.questionSpec.target !== sourcePayload.questionSpec.target
    ) {
      throw new Error("INTERVIEW_REGENERATION_TARGET_CHANGED");
    }
    const versionCount = await database.interviewMessage.count({
      where: { responseGroupId: target.responseGroupId }
    });
    assertEventCenteredResponseVersionCapacity(versionCount);

    const checkpointEvent = Array.isArray(checkpoint.eventsState)
      ? checkpoint.eventsState.find((value) => recordValue(value).id === sourceBranch.activeEventId)
      : null;
    const sourceEvent = checkpointEvent
      ? recordValue(checkpointEvent)
      : sourceBranch.activeEventId
        ? await database.interviewEvent.findUnique({ where: { id: sourceBranch.activeEventId } })
        : null;
    if (!sourceEvent) throw new Error("EVENT_STATE_CHANGED");
    const childBranchStateId = randomUUID();
    const sourceSnapshot = recordValue(sourceEvent.snapshotData);
    const nextState = cloneDialogueStateForVersion({
      snapshotData: sourceSnapshot,
      payload: sourcePayload,
      intent: regeneration.intent
    });
    const mergedSnapshot = {
      ...sourceSnapshot,
      ...nextState,
      currentQuestion: nextState.currentQuestion
        ? { ...nextState.currentQuestion, assistantMessageId }
        : null
    };
    const nextPayload: EventCenteredAssistantPayload = {
      ...input.payload,
      questionSpec: input.payload.questionSpec && REPAIR_INTENTS.has(regeneration.intent)
        ? {
            ...input.payload.questionSpec,
            opportunityNumber: isEventCenteredThoughtOnlyScope()
              ? Math.max(1, sourcePayload.questionSpec.opportunityNumber ?? 1)
              : Math.min(3, (sourcePayload.questionSpec.opportunityNumber ?? 0) + 1),
            repairCount: Math.min(3, sourcePayload.questionSpec.repairCount + 1),
            surfaceLevel: regeneration.intent === "simplify"
              ? "simplified"
              : regeneration.intent === "concretize"
                ? "concrete_anchor"
                : "low_pressure_choice"
          }
        : input.payload.questionSpec
    };

    await database.interviewSession.create({
      data: {
        id: childSessionId,
        userId: root.userId,
        mode: "event_centered",
        dimension: null,
        conversationSchemaVersion: root.conversationSchemaVersion,
        rootSessionId: root.id,
        parentSessionId: sourceBranch.id,
        forkMessageSequence: target.sequence,
        forkedFromMessageId: target.id,
        branchDepth: sourceBranch.branchDepth + 1,
        status: "active",
        stage: sourceBranch.stage,
        turnCount: sourceBranch.turnCount,
        entryDate: root.entryDate,
        startedAt: root.startedAt,
        lastAssistantQuestion: nextPayload.naturalResponse,
        draftSummary: sourceBranch.draftSummary
      }
    });
    await database.interviewEvent.create({
      data: {
        id: childBranchStateId,
        sessionId: childSessionId,
        sequence: Number(sourceEvent.sequence ?? 1),
        status: sourceEvent.status === "completed" || sourceEvent.status === "ready_for_choice"
          ? sourceEvent.status
          : "active",
        stage: sourceBranch.stage,
        explorationRound: Number(sourceEvent.explorationRound ?? 1),
        coveredLenses: Array.isArray(sourceEvent.coveredLenses) ? sourceEvent.coveredLenses as string[] : [],
        roundCoveredLenses: Array.isArray(sourceEvent.roundCoveredLenses) ? sourceEvent.roundCoveredLenses as string[] : [],
        roundMeaningfulReplyCount: Number(sourceEvent.roundMeaningfulReplyCount ?? 0),
        totalMeaningfulReplyCount: Number(sourceEvent.totalMeaningfulReplyCount ?? 0),
        startMessageSequence: Number(sourceEvent.startMessageSequence ?? 0),
        event: typeof sourceEvent.event === "string" ? sourceEvent.event : null,
        feeling: typeof sourceEvent.feeling === "string" ? sourceEvent.feeling : null,
        whyItMattered: typeof sourceEvent.whyItMattered === "string" ? sourceEvent.whyItMattered : null,
        happinessType: typeof sourceEvent.happinessType === "string" ? sourceEvent.happinessType : null,
        selfPattern: typeof sourceEvent.selfPattern === "string" ? sourceEvent.selfPattern : null,
        snapshotData: toJsonValue(mergedSnapshot),
        progressData: sourceEvent.progressData == null ? Prisma.JsonNull : toJsonValue(sourceEvent.progressData),
        confidence: typeof sourceEvent.confidence === "number" ? sourceEvent.confidence : null,
        missingSlots: Array.isArray(sourceEvent.missingSlots) ? sourceEvent.missingSlots as string[] : [],
        draftSummary: typeof sourceEvent.draftSummary === "string" ? sourceEvent.draftSummary : null
      }
    });
    await database.interviewSession.update({
      where: { id: childSessionId },
      data: { activeEventId: childBranchStateId }
    });
    await database.aIGenerationTrace.update({
      where: { id: regeneration.generatedTraceId },
      data: {
        requestId: input.requestId ?? null,
        sessionId: childSessionId,
        artifactId: assistantMessageId,
        triggerMessageId: target.id,
        status: "completed",
        outputOrigin: input.outputOrigin,
        finalOutput: toJsonValue(nextPayload),
        pipelineDecisions: toJsonValue([{
          kind: "event_centered_response_version",
          intent: regeneration.intent,
          questionTarget: sourcePayload.questionSpec.target,
          answerOpportunityIncremented: REPAIR_INTENTS.has(regeneration.intent) &&
            !isEventCenteredThoughtOnlyScope(),
          selectedCandidate: input.selectedCandidate,
          checks: input.checks
        }]),
        completedAt: new Date()
      }
    });
    await database.interviewMessage.create({
      data: {
        id: assistantMessageId,
        sessionId: childSessionId,
        userTurnId: input.userTurnId,
        generationTraceId: regeneration.generatedTraceId,
        responseGroupId: target.responseGroupId,
        responseVersion: versionCount + 1,
        regenerationIntent: regeneration.intent,
        regeneratedFromMessageId: target.id,
        branchSessionId: childSessionId,
        role: "assistant",
        content: serializeEventCenteredAssistantPayload(nextPayload),
        sequence: target.sequence
      }
    });
    await database.interviewBranchCheckpoint.create({
      data: {
        sessionId: childSessionId,
        messageId: assistantMessageId,
        schemaVersion: 4,
        sessionState: toJsonValue({
          ...recordValue(checkpoint.sessionState),
          activeEventId: childBranchStateId,
          lastAssistantQuestion: nextPayload.naturalResponse
        }),
        eventsState: toJsonValue([{ ...sourceEvent, id: childBranchStateId, sessionId: childSessionId, snapshotData: mergedSnapshot }])
      }
    });
    await database.interviewSession.update({
      where: { id: root.id },
      data: { activeBranchSessionId: childSessionId }
    });
    await database.interviewUserTurn.update({
      where: { id: input.userTurnId },
      data: { status: "completed", errorCode: null, completedAt: new Date() }
    });
    await database.aIResponseRegeneration.update({
      where: { id: regeneration.id },
      data: {
        branchSessionId: childSessionId,
        generatedMessageId: assistantMessageId,
        generatedTraceId: regeneration.generatedTraceId,
        candidates: toJsonValue(input.candidates),
        selectedCandidate: input.selectedCandidate,
        checks: toJsonValue(input.checks),
        status: "completed",
        latencyMs: input.latencyMs,
        completedAt: new Date(),
        errorCode: null
      }
    });
    return {
      eventId: root.journalEvent.id,
      rootSessionId: root.id,
      activeBranchSessionId: childSessionId,
      assistantMessageId
    };
  });
}

export async function failEventCenteredResponseVersion(input: {
  regenerationId: string;
  userTurnId: string;
  errorCode: string;
}) {
  const regeneration = await prisma.aIResponseRegeneration.findUnique({
    where: { id: input.regenerationId },
    select: { generatedTraceId: true }
  });
  await prisma.$transaction([
    prisma.interviewUserTurn.updateMany({
      where: { id: input.userTurnId, status: "processing" },
      data: { status: "failed", errorCode: input.errorCode }
    }),
    prisma.aIResponseRegeneration.updateMany({
      where: { id: input.regenerationId, status: "processing" },
      data: { status: "failed", errorCode: input.errorCode }
    }),
    ...(regeneration?.generatedTraceId
      ? [prisma.aIGenerationTrace.updateMany({
          where: { id: regeneration.generatedTraceId, status: "pending" },
          data: { status: "failed", errorCode: input.errorCode, failedAt: new Date() }
        })]
      : [])
  ]);
}

export async function switchEventCenteredResponseVersion(input: {
  userId: string;
  rootSessionId: string;
  targetBranchSessionId: string;
  baseBranchSessionId: string;
  targetMessageId?: string;
}) {
  return prisma.$transaction(async (database) => {
    const route = await resolveEventRoute(database, input);
    if (
      route.root.status !== "active" ||
      !route.root.journalEvent ||
      !isActiveEventStatus(route.root.journalEvent.status) ||
      route.activeBranchSessionId !== input.baseBranchSessionId
    ) {
      throw new Error("INTERVIEW_BRANCH_OUT_OF_DATE");
    }
    const target = await database.interviewSession.findFirst({
      where: {
        id: input.targetBranchSessionId,
        userId: input.userId,
        mode: "event_centered",
        OR: [{ id: route.root.id }, { rootSessionId: route.root.id }]
      },
      select: { id: true }
    });
    if (!target) throw new Error("INTERVIEW_BRANCH_TARGET_INVALID");
    const currentPath = await resolveEffectiveMessages(
      database,
      route.root.id,
      route.activeBranchSessionId
    );
    const currentQuestion = [...currentPath].reverse().find((message) => {
      return message.role === "assistant" && Boolean(parseEventCenteredAssistantPayload(message.content)?.questionSpec);
    });
    const selectedMessage = input.targetMessageId
      ? await database.interviewMessage.findFirst({
          where: { id: input.targetMessageId, sessionId: target.id }
        })
      : await database.interviewMessage.findFirst({
          where: { sessionId: target.id, role: "assistant", responseVersion: { not: null } },
          orderBy: [{ sequence: "desc" }, { createdAt: "desc" }]
        });
    if (
      !currentQuestion?.responseGroupId ||
      !selectedMessage?.responseGroupId ||
      selectedMessage.responseGroupId !== currentQuestion.responseGroupId ||
      !parseEventCenteredAssistantPayload(selectedMessage.content)?.questionSpec
    ) {
      throw new Error("INTERVIEW_BRANCH_TARGET_INVALID");
    }
    const targetPath = await resolveEffectiveMessages(database, route.root.id, target.id);
    if (!targetPath.some((message) => message.id === selectedMessage.id)) {
      throw new Error("INTERVIEW_BRANCH_TARGET_INVALID");
    }
    const generated = selectedMessage;
    await database.interviewSession.update({
      where: { id: route.root.id },
      data: { activeBranchSessionId: target.id }
    });
    await database.aIResponseRegeneration.updateMany({
      where: {
        rootSessionId: route.root.id,
        branchSessionId: route.activeBranchSessionId,
        status: "completed"
      },
      data: { switchedBackAt: new Date() }
    });
    return {
      eventId: route.root.journalEvent.id,
      rootSessionId: route.root.id,
      activeBranchSessionId: target.id,
      assistantMessageId: generated.id
    };
  });
}

export function incrementEventCenteredRepairOpportunity(
  state: EventCenteredDialogueState,
  payload: EventCenteredAssistantPayload,
  intent: InterviewRegenerationIntent
) {
  return cloneDialogueStateForVersion({ snapshotData: state, payload, intent });
}
