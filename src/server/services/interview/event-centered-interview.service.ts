import { randomUUID } from "node:crypto";

import { getTodayEntryDate } from "@/features/interview/entry-date";
import {
  getEventCenteredAllowedActions,
  getEventCenteredCheckpoint,
  getEventCenteredProgress,
  parseEventCenteredAssistantPayload,
  parseEventCenteredDialogueState,
  serializeEventCenteredAssistantPayload
} from "@/features/interview/event-centered/dialogue-state";
import {
  decideEventCenteredTurnPolicy,
  type EventCenteredTurnPolicyResult
} from "@/features/interview/event-centered/interview-policy";
import {
  createSafeEventCenteredPayload,
  getEventCenteredFirstCheckpointFactAcknowledgement,
  isEventCenteredContinueWithinBoundaryExpression,
  runEventCenteredTurnQualityGate
} from "@/features/interview/event-centered/turn-quality";
import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import { assertEventCenteredWriteAllowed } from "@/features/interview/event-centered-release";
import {
  getAssistantDisplayParts,
  parseAssistantTurnPayload
} from "@/features/joy-interview/assistant-turn";
import {
  abandonJournalEvent,
  getEventCenteredInterviewWorkspaceData,
  getEventCenteredSessionIdentity,
  reserveEventCenteredUserAction,
  reserveEventCenteredUserTurn,
  startEventCenteredInterviewSession
} from "@/server/repositories/event-centered-interview.repository";
import { getEffectiveJournalEventAngleProjection } from "@/server/repositories/journal-event-angle-outcome.repository";
import {
  applyJournalEventFactRevision,
  assertEventCenteredForwardOperationAllowed,
  getEffectiveJournalEventFactProjection,
  rejectPendingUnderstandingClaim,
  resolvePendingJournalEventFactClarification,
  setPendingJournalEventFactClarification
} from "@/server/repositories/journal-event-fact-revision.repository";
import {
  commitEventCenteredTurnUnderstanding,
  confirmPendingUnderstandingClaim,
  getEffectiveJournalEventFacts,
  markEventCenteredTurnUnderstandingFailed,
  resumeEventCenteredTurnUnderstanding
} from "@/server/repositories/journal-event-understanding.repository";
import {
  isBareEventCenteredAngleChange,
  realizeEventCenteredTurnAI,
  understandEventCenteredTurnAI
} from "@/server/services/interview/event-centered-ai.service";
import {
  regenerateEventCenteredResponseVersion,
  selectEventCenteredResponseVersion
} from "@/server/services/interview/event-centered-response-version.service";
import { generateEventJournal } from "@/server/services/journal-event/event-journal.service";
import type {
  EventCenteredRespondRequest,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";
import type {
  EventCenteredInterviewWorkspaceData,
  EventCenteredOperationData,
  ReserveEventCenteredTurnResult
} from "@/types/event-centered-interview";
import type {
  JournalEventAngleOutcomeDraft,
  JournalEventAngleProjection
} from "@/types/journal-event-angle-outcome";
import type {
  CommitEventCenteredTurnUnderstandingInput,
  JournalEventFactProjection,
  JournalEventFactWrite
} from "@/types/journal-event-understanding";

const EVENT_CENTERED_OPENING = "先从这件事开始吧。刚刚发生了什么？";

export function startEventCenteredInterview(userId: string, entryDate = getTodayEntryDate()) {
  assertEventCenteredWriteAllowed({
    entryDate,
    today: getTodayEntryDate()
  });

  return startEventCenteredInterviewSession({
    userId,
    entryDate,
    openingQuestion: EVENT_CENTERED_OPENING
  });
}

export function getEventCenteredInterview(userId: string, sessionId: string) {
  return getEventCenteredSessionIdentity(userId, sessionId);
}

function displayWorkspaceMessage(message: EventCenteredInterviewWorkspaceData["messages"][number]) {
  if (message.role !== "assistant") return message.rawText ?? message.content;
  const eventPayload = parseEventCenteredAssistantPayload(message.content);
  if (eventPayload) {
    return [eventPayload.naturalUnderstanding, eventPayload.naturalResponse]
      .filter(Boolean)
      .join("\n");
  }
  const legacyPayload = parseAssistantTurnPayload(message.content);
  return legacyPayload ? getAssistantDisplayParts(legacyPayload).combinedText : message.content;
}

function emptyAngleProjection(): JournalEventAngleProjection {
  return {
    outcomesByAngle: {},
    completedAngles: [],
    availableAngles: ["feeling", "thought", "relationship", "action"],
    invalidatedOutcomeIds: [],
    deprioritizedOutcomeIds: [],
    logEligibleOutcomeIds: [],
    repairPendingAngles: [],
    reopenedAngles: [],
    repairs: []
  };
}

export async function getEventCenteredInterviewWorkspace(
  userId: string,
  sessionId: string
): Promise<EventCenteredWorkspaceSession | null> {
  const data = await getEventCenteredInterviewWorkspaceData(userId, sessionId);
  if (!data) return null;
  const state = parseEventCenteredDialogueState(data.snapshotData);
  const [angleProjection, factProjection] = data.identity.eventId
    ? await Promise.all([
        getEffectiveJournalEventAngleProjection(
          data.identity.eventId,
          data.identity.activeBranchSessionId
        ),
        getEffectiveJournalEventFactProjection(
          data.identity.eventId,
          data.identity.activeBranchSessionId
        )
      ])
    : [emptyAngleProjection(), null];
  const pathMessageIds = new Set(data.messages.map((message) => message.id));
  const versionGroups = new Map<string, typeof data.responseVersions>();
  for (const version of data.responseVersions) {
    if (!version.responseGroupId) continue;
    const group = versionGroups.get(version.responseGroupId) ?? [];
    group.push(version);
    versionGroups.set(version.responseGroupId, group);
  }
  const messages = data.messages.map((message) => {
    const assistantPayload = message.role === "assistant"
      ? parseEventCenteredAssistantPayload(message.content)
      : null;
    const group = message.responseGroupId
      ? versionGroups.get(message.responseGroupId) ?? []
      : [];
    return {
      id: message.id,
      role: message.role,
      content: displayWorkspaceMessage(message),
      rawText: message.rawText ?? displayWorkspaceMessage(message),
      sequence: message.sequence,
      userTurnId: message.userTurnId,
      assistantPayload,
      responseVersion: message.role === "assistant" && message.responseGroupId
        ? {
            groupId: message.responseGroupId,
            version: message.responseVersion ?? 1,
            versionCount: Math.max(1, group.length),
            canRegenerate:
              data.identity.eventStatus === "active" &&
              group.length < 3 &&
              Boolean(assistantPayload?.questionSpec),
            canSwitch: group.length > 1,
            versions: group.map((version) => ({
              messageId: version.id,
              branchSessionId: version.branchSessionId,
              version: version.responseVersion ?? 1,
              active: pathMessageIds.has(version.id)
            }))
          }
        : null,
      createdAt: message.createdAt
    };
  });
  const currentRun = state.activeAngle ? state.angleRuns[state.activeAngle] : null;
  let allowedActions = getEventCenteredAllowedActions({
    state,
    eventStatus: data.identity.eventStatus,
    hasPendingTurn: Boolean(data.pendingTurn)
  });
  if (factProjection?.pendingClarification || angleProjection.repairPendingAngles.length > 0) {
    allowedActions = allowedActions.filter((action) => action === "reply" || action === "exit_event");
  }
  const outcomes = angleProjection.completedAngles.flatMap((angle) => {
    const outcome = angleProjection.outcomesByAngle[angle];
    return outcome
      ? [{ angle, kind: outcome.kind, statement: outcome.statement }]
      : [];
  });
  const journalStatus = data.identity.eventStatus === "generating"
    ? "generating" as const
    : data.journalEntry?.status === "saved"
      ? "saved" as const
      : data.journalEntry?.status === "modified"
        ? "modified" as const
        : data.journalEntry
          ? "draft" as const
          : data.journalGeneration?.status === "failed"
            ? "failed" as const
            : "not_generated" as const;

  return {
    ...data.identity,
    messages,
    dialogue: {
      phase: state.phase,
      activeAngle: state.activeAngle,
      questionOpportunityCount: currentRun?.questionOpportunityCount ?? 0,
      focusOptions: state.focusOptions,
      completedAngles: angleProjection.completedAngles,
      availableAngles: angleProjection.availableAngles,
      reopenedAngles: angleProjection.reopenedAngles,
      outcomes,
      checkpoint: getEventCenteredCheckpoint(
        state,
        state.lastCompletedAngle
          ? angleProjection.outcomesByAngle[state.lastCompletedAngle]?.statement ?? null
          : null
      ),
      allowedActions,
      progress: getEventCenteredProgress(state)
    },
    recovery: {
      pendingTurn: data.pendingTurn
        ? {
            id: data.pendingTurn.id,
            clientTurnId: data.pendingTurn.clientTurnId,
            sessionId: data.pendingTurn.sessionId,
            rawText: data.pendingTurn.rawText,
            inputMode: data.pendingTurn.inputMode,
            baseMessageSequence: data.pendingTurn.baseMessageSequence,
            status: data.pendingTurn.status,
            createdAt: data.pendingTurn.createdAt,
            errorCode: data.pendingTurn.errorCode,
            attemptCount: data.pendingTurn.attemptCount
          }
        : null
    },
    journal: {
      status: journalStatus,
      entryId: data.journalEntry?.id ?? null,
      generationId: data.journalGeneration?.id ?? null,
      errorCode: data.journalGeneration?.errorCode ?? null,
      retryable: data.journalGeneration?.status === "failed",
      eventStatus: data.identity.eventStatus
    }
  };
}

export function acceptEventCenteredUserTurn(input: {
  userId: string;
  rootSessionId: string;
  clientTurnId: string;
  rawText: string;
  inputMode: "text" | "voice";
  baseMessageSequence: number;
  baseBranchSessionId: string;
}) {
  assertEventCenteredWriteAllowed();
  return reserveEventCenteredUserTurn(input);
}

export type EventCenteredRespondObserver = {
  onTurn?: (turn: ReserveEventCenteredTurnResult) => Promise<void> | void;
  onPhase?: (phase: string) => Promise<void> | void;
  onDelta?: (target: "summary" | "response", value: string) => Promise<void> | void;
};

function controlUnderstandingDecision(input: {
  action: EventCenteredRespondRequest["action"];
  rawText: string;
}): EventCenteredUnderstandingDecision {
  const selectedEvent = input.action === "select_current_event";
  return {
    eventBoundary: "current_event",
    coreEventIdentifiable: selectedEvent,
    answerSignal: "answered",
    facts: selectedEvent && input.rawText.trim()
      ? [{
          statement: input.rawText.trim(),
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: input.rawText.trim()
        }]
      : [],
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    correctionTargetHint: null,
    boundaryReason: null
  };
}

function actionOperationData(
  input: EventCenteredRespondRequest
): EventCenteredOperationData | null {
  if (input.action === "select_current_event") {
    return {
      kind: "select_current_event",
      optionId: input.optionId!,
      displayText: input.rawText || input.optionId
    };
  }
  if (input.action === "select_exploration_angle") {
    return {
      kind: "select_exploration_angle",
      angle: input.angle!,
      displayText: input.rawText
    };
  }
  if (input.action === "continue_exploration") {
    return {
      kind: "continue_exploration",
      angle: input.angle,
      displayText: input.rawText
    };
  }
  if (input.action === "exit_event") {
    return { kind: "exit_event", reason: input.rawText, displayText: input.rawText };
  }
  return null;
}

async function reserveRespondTurn(input: {
  userId: string;
  request: EventCenteredRespondRequest;
}): Promise<ReserveEventCenteredTurnResult> {
  const request = input.request;
  if (
    request.baseBranchSessionId === undefined ||
    request.baseMessageSequence === undefined
  ) {
    throw new Error("EVENT_STATE_CHANGED");
  }
  if (request.action === "reply" || request.action === "correct_understanding") {
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      rawText: request.rawText ?? "",
      inputMode: request.inputMode ?? "text"
    });
  }
  if (request.action === "select_current_event") {
    const operation = actionOperationData(request) as Extract<
      EventCenteredOperationData,
      { kind: "select_current_event" }
    >;
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      rawText: request.rawText || request.optionId,
      inputMode: request.inputMode ?? "text",
      eventOperationData: operation
    });
  }
  if (request.action === "select_exploration_angle") {
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      inputMode: request.inputMode ?? "text",
      eventOperationData: actionOperationData(request) as Extract<
        EventCenteredOperationData,
        { kind: "select_exploration_angle" }
      >
    });
  }
  if (request.action === "continue_exploration") {
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      inputMode: request.inputMode ?? "text",
      eventOperationData: actionOperationData(request) as Extract<
        EventCenteredOperationData,
        { kind: "continue_exploration" }
      >
    });
  }
  if (request.action === "exit_event") {
    return reserveEventCenteredUserAction({
      userId: input.userId,
      rootSessionId: request.rootSessionId,
      clientTurnId: request.clientTurnId,
      baseBranchSessionId: request.baseBranchSessionId,
      baseMessageSequence: request.baseMessageSequence,
      action: request.action,
      inputMode: request.inputMode ?? "text",
      eventOperationData: actionOperationData(request) as Extract<
        EventCenteredOperationData,
        { kind: "exit_event" }
      >
    });
  }
  throw new Error("INTERVIEW_REGENERATION_UNAVAILABLE");
}

function currentQuestionText(data: EventCenteredInterviewWorkspaceData) {
  for (let index = data.messages.length - 1; index >= 0; index -= 1) {
    const message = data.messages[index];
    if (message?.role !== "assistant") continue;
    const payload = parseEventCenteredAssistantPayload(message.content);
    if (payload?.questionSpec) return payload.naturalResponse;
  }
  return null;
}

function turnFactWrites(input: {
  decision: EventCenteredUnderstandingDecision;
  projection: JournalEventFactProjection;
  turnId: string;
  userMessageId: string;
  action: EventCenteredRespondRequest["action"];
}): JournalEventFactWrite[] {
  return input.decision.facts.map((fact) => {
    const existing = input.projection.facts.find((record) =>
      record.statement === fact.statement &&
      record.scope === fact.scope &&
      record.stance === fact.stance &&
      record.kind === fact.kind
    );
    const evidence = [{
      sourceTurnId: input.turnId,
      pathAnchorMessageId: input.userMessageId,
      role: input.action === "select_current_event"
        ? "event_selection" as const
        : existing
          ? "repeated_support" as const
          : "direct_expression" as const,
      quote: fact.quote
    }];
    return existing
      ? { operation: "add_evidence" as const, factId: existing.id, evidence }
      : {
          operation: "create" as const,
          statement: fact.statement,
          scope: fact.scope,
          stance: fact.stance,
          kind: fact.kind,
          origin: "user_expression" as const,
          pathAnchorMessageId: input.userMessageId,
          evidence
        };
  });
}

function angleOutcomeDraft(
  policy: EventCenteredTurnPolicyResult
): JournalEventAngleOutcomeDraft | null {
  if (!policy.angleOutcome || policy.angleOutcome.supportKeys.length === 0) return null;
  return {
    angle: policy.angleOutcome.angle,
    kind: policy.angleOutcome.kind,
    statement: policy.angleOutcome.statement,
    dependencies: policy.angleOutcome.supportKeys.map((key) =>
      key.startsWith("new:")
        ? { role: "support" as const, factWriteIndex: Number(key.slice(4)) }
        : { role: "support" as const, factId: key }
    )
  };
}

function combineOutputOrigin(
  left: "llm" | "deterministic" | "fallback",
  right: "llm" | "deterministic" | "fallback"
) {
  if (left === "llm" && right === "llm") return "llm" as const;
  if (left === "deterministic" && right === "deterministic") return "deterministic" as const;
  return "fallback" as const;
}

function revisionTargetsForDecision(input: {
  factIds: string[];
  decision: EventCenteredUnderstandingDecision;
}) {
  const relation = input.decision.facts.some((fact) => fact.stance === "unknown")
    ? "withdraw" as const
    : input.decision.facts.some((fact) => fact.stance === "denied")
      ? "negate" as const
      : "supersede" as const;
  return input.factIds.map((factId) => ({ factId, relation }));
}

function revisionResultFacts(input: {
  decision: EventCenteredUnderstandingDecision;
  turnId: string;
  userMessageId: string;
}) {
  return input.decision.facts.map((fact) => ({
    statement: fact.statement,
    scope: fact.scope,
    stance: fact.stance,
    kind: fact.kind,
    origin: "user_expression" as const,
    pathAnchorMessageId: input.userMessageId,
    evidence: [{
      sourceTurnId: input.turnId,
      pathAnchorMessageId: input.userMessageId,
      role: "direct_expression" as const,
      quote: fact.quote
    }]
  }));
}

async function applyCorrectionDecision(input: {
  userId: string;
  eventId: string;
  branchSessionId: string;
  branchStateId: string;
  turn: ReserveEventCenteredTurnResult;
  rawText: string;
  decision: EventCenteredUnderstandingDecision;
  projection: JournalEventFactProjection;
  stateSnapshot: ReturnType<typeof parseEventCenteredDialogueState>;
  requestId?: string;
}) {
  const trace = {
    requestId: input.requestId ?? null,
    outputOrigin: "llm" as const,
    contextSnapshot: {
      kind: "event_centered_correction",
      effectiveFactIds: input.projection.effectiveFactIds
    },
    finalOutput: { decision: input.decision },
    pipelineDecisions: [{
      kind: "correction_priority",
      answerSignal: input.decision.answerSignal
    }]
  };
  const resultFacts = revisionResultFacts({
    decision: input.decision,
    turnId: input.turn.turn.id,
    userMessageId: input.turn.userMessageId
  });

  if (input.projection.pendingClarification) {
    return {
      kind: "revised" as const,
      result: await resolvePendingJournalEventFactClarification({
        userId: input.userId,
        eventId: input.eventId,
        activeBranchSessionId: input.branchSessionId,
        branchStateId: input.branchStateId,
        sourceTurnId: input.turn.turn.id,
        pathAnchorMessageId: input.turn.userMessageId,
        contextMessageId: input.projection.pendingClarification.clarificationMessageId,
        quote: input.rawText,
        baseMessageSequence: input.turn.turn.baseMessageSequence,
        targets: revisionTargetsForDecision({
          factIds: input.projection.pendingClarification.candidateTargetFactIds,
          decision: input.decision
        }),
        resultFacts,
        trace,
        clarificationResolution: input.decision.answerSignal === "unknown"
          ? "withdraw_as_unknown"
          : "apply_revision"
      })
    };
  }

  const hint = input.decision.correctionTargetHint?.trim() ?? "";
  const candidates = hint
    ? input.projection.facts.filter((fact) =>
        fact.statement.includes(hint) || hint.includes(fact.statement)
      )
    : input.projection.facts;
  const targets = candidates.length === 1
    ? candidates
    : !hint && input.projection.facts.length === 1
      ? input.projection.facts
      : [];

  if (targets.length === 0 && input.projection.facts.length >= 2) {
    const clarificationMessageId = randomUUID();
    const clarificationPayload = {
      naturalUnderstanding: "我知道你在纠正刚才的理解，但目前可能对应不止一条内容。",
      naturalResponse: "你想改的是哪一条？可以直接引用那句话，或说出其中最关键的几个字。",
      responseKind: "clarification" as const,
      questionSpec: null,
      checkpoint: null,
      angleOutcome: null
    };
    await setPendingJournalEventFactClarification({
      userId: input.userId,
      eventId: input.eventId,
      activeBranchSessionId: input.branchSessionId,
      branchStateId: input.branchStateId,
      sourceTurnId: input.turn.turn.id,
      pathAnchorMessageId: input.turn.userMessageId,
      baseMessageSequence: input.turn.turn.baseMessageSequence,
      kind: "ambiguous_target",
      candidateTargetFactIds: input.projection.effectiveFactIds,
      candidateFactDrafts: input.decision.facts.map((fact) => ({
        statement: fact.statement,
        scope: fact.scope,
        stance: fact.stance,
        kind: fact.kind
      })),
      clarificationMessage: {
        id: clarificationMessageId,
        content: serializeEventCenteredAssistantPayload(clarificationPayload)
      },
      trace
    });
    return { kind: "clarification" as const, payload: clarificationPayload };
  }

  if (targets.length === 0) return { kind: "unmatched" as const };
  return {
    kind: "revised" as const,
    result: await applyJournalEventFactRevision({
      userId: input.userId,
      eventId: input.eventId,
      activeBranchSessionId: input.branchSessionId,
      branchStateId: input.branchStateId,
      sourceTurnId: input.turn.turn.id,
      pathAnchorMessageId: input.turn.userMessageId,
      contextMessageId: input.stateSnapshot.currentQuestion?.assistantMessageId ?? null,
      quote: input.rawText,
      baseMessageSequence: input.turn.turn.baseMessageSequence,
      targets: revisionTargetsForDecision({
        factIds: targets.map((fact) => fact.id),
        decision: input.decision
      }),
      resultFacts,
      rejectUnderstandingClaimId: input.stateSnapshot.pendingUnderstandingClaimId,
      trace
    })
  };
}

function effectiveOperation(action: EventCenteredRespondRequest["action"]): EventCenteredUserOperation {
  if (action === "select_current_event") return "select_current_event";
  if (action === "select_exploration_angle") return "select_exploration_angle";
  if (action === "continue_exploration") return "continue_exploration";
  if (action === "exit_event") return "exit_event";
  if (action === "correct_understanding") return "correct_understanding";
  if (action === "regenerate_response") return "regenerate_response";
  if (action === "resume_turn") return "resume_failed_turn";
  return "content_reply";
}

export async function respondEventCenteredInterview(
  userId: string,
  request: EventCenteredRespondRequest,
  options?: EventCenteredRespondObserver & { requestId?: string; signal?: AbortSignal }
) {
  assertEventCenteredWriteAllowed();
  const before = await getEventCenteredInterviewWorkspaceData(userId, request.rootSessionId);
  if (!before) throw new Error("SESSION_NOT_FOUND");
  if (request.action === "generate_event_journal") {
    if (
      !before.identity.eventId ||
      !before.identity.branchStateId ||
      !request.baseBranchSessionId ||
      request.baseMessageSequence === undefined
    ) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    await assertEventCenteredOperationAllowed({
      eventId: before.identity.eventId,
      activeBranchSessionId: before.identity.activeBranchSessionId,
      operation: "generate_event_journal"
    });
    await generateEventJournal(
      {
        userId,
        eventId: before.identity.eventId,
        activeBranchSessionId: request.baseBranchSessionId,
        clientOperationId: request.clientTurnId,
        baseMessageSequence: request.baseMessageSequence,
        requestId: options?.requestId
      },
      {
        signal: options?.signal,
        onPhase: options?.onPhase,
        onReserved: async (generation, reservedNow) => {
          if (!generation.userTurnId || !generation.branchSessionId) return;
          await options?.onTurn?.({
            kind: reservedNow ? "reserved" : "existing",
            eventId: before.identity.eventId!,
            rootSessionId: before.identity.rootSessionId,
            activeBranchSessionId: generation.branchSessionId,
            branchStateId: before.identity.branchStateId!,
            userMessageId: generation.userTurnId,
            turn: {
              id: generation.userTurnId,
              clientTurnId: generation.clientOperationId,
              sessionId: generation.branchSessionId,
              rawText: "",
              inputMode: "text",
              baseMessageSequence: generation.baseMessageSequence,
              status: generation.status,
              createdAt: generation.startedAt
            }
          });
        }
      }
    );
    const workspace = await getEventCenteredInterviewWorkspace(
      userId,
      request.rootSessionId
    );
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    return { workspace, assistantPayload: null };
  }
  if (request.action === "regenerate_response") {
    if (
      !request.targetMessageId ||
      !request.regenerationIntent ||
      request.baseMessageSequence === undefined ||
      !request.baseBranchSessionId
    ) {
      throw new Error("INVALID_RESPOND_REQUEST");
    }
    await options?.onPhase?.("generating_response_version");
    const regenerated = await regenerateEventCenteredResponseVersion({
      userId,
      rootSessionId: request.rootSessionId,
      targetMessageId: request.targetMessageId,
      intent: request.regenerationIntent,
      clientTurnId: request.clientTurnId,
      baseMessageSequence: request.baseMessageSequence,
      baseBranchSessionId: request.baseBranchSessionId,
      requestId: options?.requestId,
      signal: options?.signal
    });
    const assistantPayload = "assistantPayload" in regenerated
      ? regenerated.assistantPayload
      : null;
    if (assistantPayload) {
      await options?.onDelta?.("summary", assistantPayload.naturalUnderstanding);
      await options?.onDelta?.("response", assistantPayload.naturalResponse);
    }
    const workspace = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    await options?.onPhase?.("complete");
    return { workspace, assistantPayload };
  }
  if (request.action === "switch_response_version") {
    if (!request.targetBranchSessionId || !request.baseBranchSessionId) {
      throw new Error("INVALID_RESPOND_REQUEST");
    }
    await selectEventCenteredResponseVersion({
      userId,
      rootSessionId: request.rootSessionId,
      targetBranchSessionId: request.targetBranchSessionId,
      baseBranchSessionId: request.baseBranchSessionId,
      targetMessageId: request.targetMessageId
    });
    const workspace = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    await options?.onPhase?.("complete");
    return { workspace, assistantPayload: null };
  }

  let effectiveRequest = request;
  let reservation: ReserveEventCenteredTurnResult;
  if (request.action === "resume_turn") {
    const pending = before.pendingTurn;
    if (!pending || pending.clientTurnId !== request.clientTurnId) {
      const current = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
      if (!current) throw new Error("SESSION_NOT_FOUND");
      return { workspace: current, assistantPayload: null };
    }
    await resumeEventCenteredTurnUnderstanding({
      userId,
      activeBranchSessionId: before.identity.activeBranchSessionId,
      clientTurnId: request.clientTurnId
    });
    const userMessage = before.messages.find((message) => message.userTurnId === pending.id);
    if (!before.identity.eventId || !before.identity.branchStateId || !userMessage) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    const operation = pending.eventOperationData;
    effectiveRequest = {
      action: pending.action,
      rootSessionId: before.identity.rootSessionId,
      clientTurnId: pending.clientTurnId,
      baseBranchSessionId: pending.baseBranchSessionId ?? before.identity.activeBranchSessionId,
      baseMessageSequence: pending.baseMessageSequence,
      rawText: pending.rawText,
      inputMode: pending.inputMode,
      angle: operation?.kind === "select_exploration_angle" ? operation.angle : undefined,
      optionId: operation?.kind === "select_current_event" ? operation.optionId : undefined
    };
    reservation = {
      kind: "existing",
      eventId: before.identity.eventId,
      rootSessionId: before.identity.rootSessionId,
      activeBranchSessionId: before.identity.activeBranchSessionId,
      branchStateId: before.identity.branchStateId,
      userMessageId: userMessage.id,
      turn: {
        id: pending.id,
        clientTurnId: pending.clientTurnId,
        sessionId: pending.sessionId,
        rawText: pending.rawText,
        inputMode: pending.inputMode,
        baseMessageSequence: pending.baseMessageSequence,
        status: "processing",
        createdAt: pending.createdAt
      }
    };
  } else {
    if (request.action === "select_current_event") {
      const state = parseEventCenteredDialogueState(before.snapshotData);
      const selected = state.focusOptions.find((option) => option.id === request.optionId);
      if (!selected) throw new Error("EVENT_STATE_CHANGED");
      effectiveRequest = { ...request, rawText: selected.sourceText };
    }
    if (
      before.identity.eventId &&
      (effectiveRequest.action === "select_exploration_angle" || effectiveRequest.action === "continue_exploration")
    ) {
      await assertEventCenteredOperationAllowed({
        eventId: before.identity.eventId,
        activeBranchSessionId: before.identity.activeBranchSessionId,
        operation: effectiveOperation(effectiveRequest.action)
      });
    }
    reservation = await reserveRespondTurn({ userId, request: effectiveRequest });
  }
  await options?.onTurn?.(reservation);

  if (reservation.turn.status === "completed") {
    const workspace = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    return { workspace, assistantPayload: null };
  }
  if (effectiveRequest.action === "exit_event") {
    await abandonJournalEvent(userId, reservation.eventId, reservation.turn.id);
    const workspace = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    return { workspace, assistantPayload: null };
  }

  try {
    options?.signal?.throwIfAborted();
    await options?.onPhase?.("understanding");
    const state = parseEventCenteredDialogueState(before.snapshotData);
    let factProjection = await getEffectiveJournalEventFactProjection(
      reservation.eventId,
      reservation.activeBranchSessionId
    );
    const rawText = reservation.turn.rawText || effectiveRequest.rawText || "";
    const isControl =
      effectiveRequest.action === "select_current_event" ||
      effectiveRequest.action === "select_exploration_angle" ||
      effectiveRequest.action === "continue_exploration";
    const understandingResult = isControl
      ? {
          decision: controlUnderstandingDecision({ action: effectiveRequest.action, rawText }),
          outputOrigin: "deterministic" as const,
          attempts: [],
          promptLineage: []
        }
      : await understandEventCenteredTurnAI({
          rawText,
          phase: state.phase,
          activeAngle: state.activeAngle,
          currentQuestion: currentQuestionText(before),
          facts: factProjection.facts,
          allowUnsupportedHypothesis:
            effectiveRequest.action === "reply" &&
            (state.phase === "guided_reflection" || state.phase === "deep_companionship"),
          signal: options?.signal
        });
    let decision = understandingResult.decision;
    if (
      decision.eventBoundary === "another_event" ||
      decision.eventBoundary === "multiple_events"
    ) {
      decision = { ...decision, facts: [], outcomeCandidate: null, unsupportedHypothesis: null };
    }
    const correction =
      effectiveRequest.action === "correct_understanding" ||
      decision.answerSignal === "correction" ||
      Boolean(factProjection.pendingClarification);
    const bareAngleChange = isBareEventCenteredAngleChange(rawText);
    const continuesWithinBoundary = effectiveRequest.action === "reply" &&
      Boolean(state.currentQuestion) &&
      isEventCenteredContinueWithinBoundaryExpression(rawText);
    if (bareAngleChange) {
      decision = {
        ...decision,
        facts: [],
        outcomeCandidate: null,
        unsupportedHypothesis: null,
        adviceRequest: null
      };
    }
    if (continuesWithinBoundary) {
      decision = {
        ...decision,
        facts: [],
        outcomeCandidate: null,
        unsupportedHypothesis: null,
        adviceRequest: null
      };
    }

    const keepsCurrentEventBoundary =
      decision.eventBoundary !== "another_event" &&
      decision.eventBoundary !== "multiple_events";
    if (!correction && !bareAngleChange && !continuesWithinBoundary && keepsCurrentEventBoundary) {
      await confirmEventCenteredUnderstandingAfterIntent({
        operation: effectiveOperation(effectiveRequest.action),
        userTurnId: reservation.turn.id,
        activeBranchSessionId: reservation.activeBranchSessionId
      });
      factProjection = await getEffectiveJournalEventFactProjection(
        reservation.eventId,
        reservation.activeBranchSessionId
      );
    }

    let revisionApplied = false;
    if (correction) {
      decision = { ...decision, unsupportedHypothesis: null, outcomeCandidate: null };
      const correctionResult = await applyCorrectionDecision({
        userId,
        eventId: reservation.eventId,
        branchSessionId: reservation.activeBranchSessionId,
        branchStateId: reservation.branchStateId,
        turn: reservation,
        rawText,
        decision,
        projection: factProjection,
        stateSnapshot: state,
        requestId: options?.requestId
      });
      if (correctionResult.kind === "clarification") {
        await options?.onDelta?.("summary", correctionResult.payload.naturalUnderstanding);
        await options?.onDelta?.("response", correctionResult.payload.naturalResponse);
        const workspace = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
        if (!workspace) throw new Error("SESSION_NOT_FOUND");
        return { workspace, assistantPayload: correctionResult.payload };
      }
      revisionApplied = correctionResult.kind === "revised";
      factProjection = await getEffectiveJournalEventFactProjection(
        reservation.eventId,
        reservation.activeBranchSessionId
      );
    }

    const policy = decideEventCenteredTurnPolicy({
      state,
      action: effectiveRequest.action,
      rawText,
      selectedAngle: effectiveRequest.angle,
      selectedEventOptionId: effectiveRequest.optionId,
      regenerationIntent: effectiveRequest.regenerationIntent,
      currentQuestionText: currentQuestionText(before),
      facts: factProjection.facts,
      understanding: decision,
      bareAngleChange
    });
    const assistantMessageId = randomUUID();
    if (policy.nextState.currentQuestion) {
      policy.nextState.currentQuestion.assistantMessageId = assistantMessageId;
    }
    const committedOutcome = correction ? null : angleOutcomeDraft(policy);
    if (committedOutcome) decision = { ...decision, unsupportedHypothesis: null };

    await options?.onPhase?.("responding");
    const responseResult = await realizeEventCenteredTurnAI({
      rawText,
      phase: state.phase,
      activeAngle: state.activeAngle,
      decision,
      directive: policy.directive,
      signal: options?.signal
    });
    const firstCheckpointAcknowledgement = policy.directive.checkpoint?.kind === "first"
      ? getEventCenteredFirstCheckpointFactAcknowledgement(decision)
      : null;
    const quality = runEventCenteredTurnQualityGate({
      payload: responseResult.payload,
      previousAssistantResponses: before.messages
        .filter((message) => message.role === "assistant")
        .map(displayWorkspaceMessage),
      adviceRequested: Boolean(decision.adviceRequest),
      pendingHypothesisStatement: decision.unsupportedHypothesis?.statement ?? null,
      firstCheckpointUnderstanding: firstCheckpointAcknowledgement?.understanding ?? null
    });
    let responsePayload = responseResult.payload;
    if (!quality.passed) {
      responsePayload = createSafeEventCenteredPayload({
        payload: responseResult.payload,
        exactResponse: policy.directive.exactResponse,
        firstCheckpointUnderstanding: firstCheckpointAcknowledgement?.safeFallback ?? null,
        acknowledgeBoundaryContinuation: quality.safetyBlockers.length > 0 &&
          continuesWithinBoundary
      });
      decision = { ...decision, unsupportedHypothesis: null };
    }
    await options?.onDelta?.("summary", responsePayload.naturalUnderstanding);
    await options?.onDelta?.("response", responsePayload.naturalResponse);
    await options?.onPhase?.("committing");

    const facts = revisionApplied
      ? []
      : turnFactWrites({
          decision,
          projection: factProjection,
          turnId: reservation.turn.id,
          userMessageId: reservation.userMessageId,
          action: effectiveRequest.action
        });
    const pendingClaim = committedOutcome ? null : decision.unsupportedHypothesis;
    await commitEventCenteredTurnUnderstanding({
      userId,
      eventId: reservation.eventId,
      activeBranchSessionId: reservation.activeBranchSessionId,
      branchStateId: reservation.branchStateId,
      userTurnId: reservation.turn.id,
      assistantMessage: {
        id: assistantMessageId,
        content: serializeEventCenteredAssistantPayload(responsePayload),
        responseGroupId: assistantMessageId,
        responseVersion: 1,
        lastAssistantQuestion: policy.directive.questionSpec
          ? policy.directive.exactResponse
          : null
      },
      facts,
      pendingClaim,
      focusSummary: responsePayload.naturalUnderstanding,
      snapshotData: policy.nextState,
      trace: {
        requestId: options?.requestId ?? null,
        outputOrigin: combineOutputOrigin(
          understandingResult.outputOrigin,
          responseResult.outputOrigin
        ),
        contextSnapshot: {
          phase: state.phase,
          activeAngle: state.activeAngle,
          effectiveFactIds: factProjection.effectiveFactIds,
          promptLineage: [
            ...understandingResult.promptLineage,
            ...responseResult.promptLineage
          ]
        },
        finalOutput: {
          understanding: decision,
          assistant: responsePayload
        },
        pipelineDecisions: [
          { kind: "event_centered_policy", nextState: policy.nextState },
          { kind: "event_centered_ai_attempts", attempts: [
            ...understandingResult.attempts,
            ...responseResult.attempts
          ] },
          { kind: "event_centered_turn_quality", ...quality }
        ]
      },
      checks: {
        eventBoundaryPassed:
          (decision.eventBoundary !== "another_event" && decision.eventBoundary !== "multiple_events") ||
          decision.facts.length === 0,
        factsHaveUserSource: decision.facts.every((fact) => rawText.includes(fact.quote)),
        visibleUnderstandingMatchesClaim:
          !pendingClaim || responsePayload.naturalUnderstanding.includes(pendingClaim.statement),
        unsupportedClaimCount: pendingClaim ? 1 : 0
      },
      angleOutcome: committedOutcome
    });
    const workspace = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    await options?.onPhase?.("complete");
    return { workspace, assistantPayload: responsePayload };
  } catch (error) {
    await markEventCenteredTurnUnderstandingFailed(
      reservation.turn.id,
      options?.signal?.aborted ? "REQUEST_CANCELED" : error instanceof Error ? error.message : "EVENT_TURN_FAILED"
    );
    throw error;
  }
}

export type EventCenteredUserOperation =
  | "content_reply"
  | "select_current_event"
  | "select_exploration_angle"
  | "continue_exploration"
  | "generate_event_journal"
  | "correct_understanding"
  | "regenerate_response"
  | "switch_response_version"
  | "repair_question"
  | "exit_event"
  | "resume_failed_turn";

const confirmingOperations = new Set<EventCenteredUserOperation>([
  "content_reply",
  "select_current_event",
  "select_exploration_angle",
  "continue_exploration",
  "generate_event_journal"
]);

export function isEventCenteredForwardOperation(operation: EventCenteredUserOperation) {
  return confirmingOperations.has(operation);
}

export function confirmEventCenteredUnderstandingAfterIntent(input: {
  operation: EventCenteredUserOperation;
  userTurnId: string;
  activeBranchSessionId: string;
  pendingClaimConflict?: boolean;
}) {
  if (input.pendingClaimConflict || !isEventCenteredForwardOperation(input.operation)) {
    return Promise.resolve({
      kind: "no_eligible_claim" as const,
      claimId: null,
      factId: null
    });
  }
  return confirmPendingUnderstandingClaim(input.userTurnId, input.activeBranchSessionId);
}

export function assertEventCenteredOperationAllowed(input: {
  eventId: string;
  activeBranchSessionId: string;
  operation: EventCenteredUserOperation;
}) {
  if (
    input.operation !== "select_exploration_angle" &&
    input.operation !== "continue_exploration" &&
    input.operation !== "generate_event_journal" &&
    input.operation !== "content_reply" &&
    input.operation !== "exit_event"
  ) {
    return Promise.resolve();
  }
  return assertEventCenteredForwardOperationAllowed({
    eventId: input.eventId,
    activeBranchSessionId: input.activeBranchSessionId,
    operation: input.operation
  });
}

export function commitEventCenteredUnderstanding(
  input: CommitEventCenteredTurnUnderstandingInput
) {
  return commitEventCenteredTurnUnderstanding(input);
}

export {
  applyJournalEventFactRevision,
  getEffectiveJournalEventFactProjection,
  getEffectiveJournalEventFacts,
  rejectPendingUnderstandingClaim,
  resolvePendingJournalEventFactClarification,
  setPendingJournalEventFactClarification,
  markEventCenteredTurnUnderstandingFailed,
  resumeEventCenteredTurnUnderstanding
};
