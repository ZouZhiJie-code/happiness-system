import { createHash, randomUUID } from "node:crypto";

import { getTodayEntryDate } from "@/features/interview/entry-date";
import {
  getEventCenteredAllowedActions,
  getEventCenteredCheckpoint,
  getEventCenteredCurrentQuestionIntent,
  getEventCenteredProgress,
  parseEventCenteredAssistantPayload,
  parseEventCenteredDialogueState,
  serializeEventCenteredAssistantPayload
} from "@/features/interview/event-centered/dialogue-state";
import {
  decideEventCenteredTurnPolicy,
  getEventCenteredReflectionMaterialStatus,
  hasEventCenteredUnableAnswerSignal,
  type EventCenteredTurnPolicyResult
} from "@/features/interview/event-centered/interview-policy";
import { splitEventCenteredSourceGroups } from "@/features/interview/event-centered/event-focus-options";
import {
  applyGenerativeEventCenteredTurnPolicy,
  createGenerativeEventCenteredPayload,
  toEventCenteredUnderstandingDecision
} from "@/features/interview/event-centered/generative-turn-policy";
import {
  isCompleteResponseFirstEventCenteredStrategyEnabled,
  isGenerativeEventCenteredStrategyEnabled
} from "@/features/interview/event-centered/generative-release";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME
} from "@/features/interview/event-centered/complete-response-first";
import {
  EVENT_CENTERED_ANGLE_CARD_VERSION,
  EVENT_CENTERED_FEW_SHOT_VERSION,
  EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION
} from "@/features/interview/event-centered/generative-strategy";
import {
  createSafeEventCenteredPayload,
  getEventCenteredFirstCheckpointPresentation,
  getEventCenteredTextBoundaryUnderstanding,
  isEventCenteredContinueWithinBoundaryExpression,
  runEventCenteredTurnQualityGate
} from "@/features/interview/event-centered/turn-quality";
import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import {
  applyThoughtMapUpdate,
  applyThoughtDeterministicUserSignals,
  classifyThoughtCorrectionKind,
  createInitialThoughtProtocol,
  type ThoughtProtocolState,
  type ThoughtQuestionPlan
} from "@/features/interview/event-centered/thought-judgment-map";
import {
  decideThoughtQuestionPlan,
  GI066_OPEN_TRANSITION
} from "@/features/interview/event-centered/thought-question-policy";
import type {
  ThoughtMapProviderOutput,
  ThoughtQuestionExpression
} from "@/features/interview/event-centered/thought-ai-contract";
import {
  assertEventCenteredWriteAllowed,
  getEventCenteredProductScope,
  isEventCenteredThoughtOnlyScope
} from "@/features/interview/event-centered-release";
import {
  getAssistantDisplayParts,
  parseAssistantTurnPayload
} from "@/features/joy-interview/assistant-turn";
import {
  abandonJournalEvent,
  consumeEventCenteredGenerativePlanCheckpoint,
  discardEventCenteredGenerativePlanCheckpoint,
  getEventCenteredGenerativePlanCheckpoint,
  getEventCenteredInterviewWorkspaceData,
  getEventCenteredSessionIdentity,
  persistEventCenteredGenerativePlanCheckpoint,
  reserveEventCenteredUserAction,
  reserveEventCenteredUserTurn,
  startEventCenteredInterviewSession
} from "@/server/repositories/event-centered-interview.repository";
import { materializeJournalEventEntryCard } from "@/server/repositories/journal-event-entry.repository";
import { recordEventCenteredAnalyticsEvent } from "@/server/services/interview/event-centered-analytics.service";
import {
  getEffectiveJournalEventAngleProjection,
  getEffectiveJournalEventAngleProjectionForPath,
  getEffectiveJournalEventWorkspaceProjectionsForPath
} from "@/server/repositories/journal-event-angle-outcome.repository";
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
  EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION,
  isBareEventCenteredAngleChange,
  type EventCenteredGenerativeArchitecture,
  type EventCenteredGenerativeGenerationInput,
  type EventCenteredGenerativeGenerationResult,
  type EventCenteredGenerativeSemanticPlanArtifact,
  type EventCenteredGenerativeSemanticPlanStageResult,
  collectEventCenteredVisibleRetryDiagnostics,
  extractEventCenteredPersonalReactionFact,
  generateEventCenteredGenerativeSemanticPlanAI,
  generateEventCenteredGenerativeVisibleTurnAI,
  generateEventCenteredThoughtMapUpdateAI,
  generateEventCenteredThoughtQuestionAI,
  generateEventCenteredTurnOnceAI,
  realizeEventCenteredTurnAI,
  understandEventCenteredTurnAI
} from "@/server/services/interview/event-centered-ai.service";
import {
  regenerateEventCenteredResponseVersion,
  selectEventCenteredResponseVersion
} from "@/server/services/interview/event-centered-response-version.service";
import type {
  EventCenteredAllowedAction,
  EventCenteredAssistantPayload,
  EventCenteredDialogueState,
  EventCenteredRespondRequest,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";
import type {
  EventCenteredInterviewWorkspaceData,
  EventCenteredOperationData,
  ReserveEventCenteredTurnResult
} from "@/types/event-centered-interview";
import {
  JOURNAL_EVENT_ANGLES,
  type JournalEventAngleOutcomeDraft,
  type JournalEventAngleProjection,
  type JournalEventAngleRepairResolutionInput
} from "@/types/journal-event-angle-outcome";
import type {
  CommitEventCenteredTurnUnderstandingInput,
  JournalEventFactProjection,
  JournalEventFactWrite
} from "@/types/journal-event-understanding";

export const EVENT_CENTERED_OPENINGS = [
  "先从这件事开始吧。刚刚发生了什么？",
  "想从哪件事说起？先讲讲当时发生了什么。",
  "从你最想说的那一部分开始吧。",
  "先说一个具体的时刻。那时发生了什么？",
  "这件事里，哪个瞬间最留在你脑海里？",
  "把这件事慢慢说给我听就好。"
] as const;

type GI066ThoughtExecution = {
  mapUpdate: ThoughtMapProviderOutput;
  protocol: ThoughtProtocolState;
  plan: ThoughtQuestionPlan;
  expression: ThoughtQuestionExpression | null;
  attempts: EventCenteredGenerativeGenerationResult["attempts"];
  promptLineage: EventCenteredGenerativeGenerationResult["promptLineage"];
  repaired: boolean;
};

export type EventCenteredGenerationFailureCategory =
  | "transient_provider"
  | "configuration"
  | "content_check";

export class EventCenteredGenerationBlockedError extends Error {
  constructor(
    readonly category: EventCenteredGenerationFailureCategory,
    readonly detailCode: string
  ) {
    super(
      category === "transient_provider"
        ? "EVENT_CENTERED_TRANSIENT_PROVIDER_FAILURE"
        : category === "configuration"
          ? "EVENT_CENTERED_CONFIGURATION_FAILURE"
          : "EVENT_CENTERED_CONTENT_CHECK_FAILURE"
    );
    this.name = "EventCenteredGenerationBlockedError";
  }
}

function classifyEventCenteredGenerationFailure(code: string) {
  if (/(?:TIMEOUT|REQUEST_FAILED|SERVICE_UNAVAILABLE|UPSTREAM_HTTP|RATE_LIMIT|429|5\d\d)/iu.test(code)) {
    return "transient_provider" as const;
  }
  if (/(?:ACCOUNT|OVERDUE|UNAUTHORIZED|FORBIDDEN|INVALID_API|API_KEY|401|403|PROVIDER_NOT_CONFIGURED|MISMATCH|MISSING_MODEL|MISSING_API_KEY)/iu.test(code)) {
    return "configuration" as const;
  }
  return "content_check" as const;
}

export function startEventCenteredInterview(
  userId: string,
  entryDate = getTodayEntryDate(),
  recordMode: "capture" | "chat" | null = null,
  clientOperationId: string | null = null
) {
  assertEventCenteredWriteAllowed({
    entryDate,
    today: getTodayEntryDate()
  });

  return startEventCenteredInterviewSession({
    userId,
    entryDate,
    recordMode,
    clientOperationId,
    openingQuestions: EVENT_CENTERED_OPENINGS
  });
}

export function getEventCenteredInterview(userId: string, sessionId: string) {
  return getEventCenteredSessionIdentity(userId, sessionId);
}

function displayWorkspaceMessage(message: EventCenteredInterviewWorkspaceData["messages"][number]) {
  if (message.role !== "assistant") return message.rawText ?? message.content;
  const eventPayload = parseEventCenteredAssistantPayload(message.content);
  if (eventPayload) {
    if (eventPayload.presentation === "hidden") return "";
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

function hasEventCenteredUserExpression(
  messages: EventCenteredInterviewWorkspaceData["messages"]
) {
  return messages.some((message) =>
    message.role === "user" && Boolean((message.rawText ?? message.content).trim())
  );
}

function hasPendingFactClarification(snapshotData: unknown) {
  if (!snapshotData || typeof snapshotData !== "object" || Array.isArray(snapshotData)) {
    return false;
  }
  return Boolean(
    (snapshotData as Record<string, unknown>).pendingFactRevisionClarification
  );
}

function getWorkspaceAllowedActions(input: {
  data: EventCenteredInterviewWorkspaceData;
  state: EventCenteredDialogueState;
  pendingFactClarification?: boolean;
  pendingAngleRepair?: boolean;
}): EventCenteredAllowedAction[] {
  let allowedActions = getEventCenteredAllowedActions({
    state: input.state,
    eventStatus: input.data.identity.eventStatus,
    hasPendingTurn: Boolean(input.data.pendingTurn)
  });
  if (input.pendingFactClarification || input.pendingAngleRepair) {
    allowedActions = allowedActions.filter(
      (action) => action === "reply" || action === "exit_event"
    );
  }
  if (input.data.identity.recordMode !== "capture") return allowedActions;

  if (
    input.data.identity.eventStatus !== null &&
    input.data.identity.eventStatus !== "active"
  ) return [];
  if (input.data.pendingTurn) {
    return allowedActions.filter(
      (action) => action === "resume_turn" || action === "exit_event"
    );
  }
  return hasEventCenteredUserExpression(input.data.messages)
    ? ["reply", "exit_event"]
    : ["reply"];
}

export async function getEventCenteredInterviewWorkspace(
  userId: string,
  sessionId: string
): Promise<EventCenteredWorkspaceSession | null> {
  const data = await getEventCenteredInterviewWorkspaceData(userId, sessionId);
  if (!data) return null;
  const state = parseEventCenteredDialogueState(data.snapshotData);
  const workspaceProjections = data.identity.eventId
    ? await getEffectiveJournalEventWorkspaceProjectionsForPath({
        eventId: data.identity.eventId,
        messageIds: data.messages.map((message) => message.id),
        snapshotData: data.snapshotData
      })
    : null;
  const angleProjection = workspaceProjections?.angleProjection ?? emptyAngleProjection();
  const factProjection = workspaceProjections?.factProjection ?? null;
  const pathMessageIds = new Set(data.messages.map((message) => message.id));
  const versionGroups = new Map<string, typeof data.responseVersions>();
  for (const version of data.responseVersions) {
    if (!version.responseGroupId) continue;
    const group = versionGroups.get(version.responseGroupId) ?? [];
    group.push(version);
    versionGroups.set(version.responseGroupId, group);
  }
  const messages = data.messages.flatMap((message) => {
    const assistantPayload = message.role === "assistant"
      ? parseEventCenteredAssistantPayload(message.content)
      : null;
    if (assistantPayload?.presentation === "hidden") return [];
    const group = message.responseGroupId
      ? versionGroups.get(message.responseGroupId) ?? []
      : [];
    return [{
      id: message.id,
      role: message.role,
      content: displayWorkspaceMessage(message),
      rawText: message.rawText ?? displayWorkspaceMessage(message),
      sequence: message.sequence,
      userTurnId: message.userTurnId,
      clientTurnId: message.clientTurnId,
      generationTraceId: message.generationTraceId ?? null,
      assistantPayload,
      responseVersion: message.role === "assistant" && message.responseGroupId
        ? {
            groupId: message.responseGroupId,
            version: message.responseVersion ?? 1,
            versionCount: Math.max(1, group.length),
            canRegenerate:
              data.identity.eventStatus === "active" &&
              group.length < 3 &&
              data.messages.at(-1)?.id === message.id &&
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
    }];
  });
  const currentRun = state.activeAngle ? state.angleRuns[state.activeAngle] : null;
  const allowedActions = getWorkspaceAllowedActions({
    data,
    state,
    pendingFactClarification: Boolean(factProjection?.pendingClarification),
    pendingAngleRepair: angleProjection.repairPendingAngles.length > 0
  });
  const outcomes = angleProjection.completedAngles.flatMap((angle) => {
    const outcome = angleProjection.outcomesByAngle[angle];
    return outcome
      ? [{ angle, kind: outcome.kind, statement: outcome.statement }]
      : [];
  });
  const closedAngles = JOURNAL_EVENT_ANGLES.filter(
    (angle) => state.angleRuns[angle]?.status === "closed"
  );
  const productScope = getEventCenteredProductScope();
  const availableAngles = angleProjection.availableAngles.filter(
    (angle) => !closedAngles.includes(angle) &&
      (productScope === "thought_only" ? angle === "thought" : true)
  );
  const journalStatus = data.identity.eventStatus === "generating"
    ? "generating" as const
    : data.journalEntry?.status === "saved"
      ? "saved" as const
      : data.journalEntry
        ? "draft" as const
        : "not_generated" as const;

  return {
    ...data.identity,
    messages,
    dialogue: {
      productScope,
      phase: state.phase,
      activeAngle: state.activeAngle,
      questionOpportunityCount: currentRun?.questionOpportunityCount ?? 0,
      focusOptions: state.focusOptions,
      completedAngles: angleProjection.completedAngles,
      availableAngles,
      closedAngles,
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

type EventCenteredRespondInternalOptions = EventCenteredRespondObserver & {
  requestId?: string;
  signal?: AbortSignal;
  /** 候选验证可显式保留 one_call 对照；生成式入口默认使用 two_call。 */
  generativeArchitecture?: EventCenteredGenerativeArchitecture;
};

type EventCenteredTurnTiming = {
  initialWorkspaceReadMs: number | null;
  turnReservationPersistenceMs: number | null;
  factsAndOutcomesReadMs: number | null;
  semanticModelMs: number | null;
  visibleResponseModelMs: number | null;
  writeCommitMs: number | null;
  finalWorkspaceRecoveryMs: number | null;
  visibleResponseReadyMs: number | null;
  interactiveReadyMs: number | null;
};

type EventCenteredTurnContext = {
  workspace: EventCenteredInterviewWorkspaceData;
  state: ReturnType<typeof parseEventCenteredDialogueState>;
  facts: JournalEventFactProjection | null;
  angleProjection: JournalEventAngleProjection | null;
  versions: {
    strategyVersion: string | null;
    schemaVersion: number;
  };
  timing: EventCenteredTurnTiming;
};

function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

function addElapsedMs(current: number | null, startedAt: number) {
  return (current ?? 0) + elapsedMs(startedAt);
}

function canonicalizeGenerativeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeGenerativeFingerprintValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key, item]) =>
          key !== "signal" && key !== "provider" && !key.startsWith("on") && item !== undefined
        )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalizeGenerativeFingerprintValue(item)])
    );
  }
  return value;
}

function eventCenteredGenerativeInputFingerprint(
  input: EventCenteredGenerativeGenerationInput
) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeGenerativeFingerprintValue(input)))
    .digest("hex");
}

function uniqueGenerativePromptLineage(
  ...groups: EventCenteredGenerativeGenerationResult["promptLineage"][]
) {
  const seen = new Set<string>();
  return groups.flat().filter((item) => {
    const key = `${item.promptKey}:${item.promptVersion}:${item.resolvedPromptHash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function semanticPlanArtifactFromCheckpoint(
  checkpoint: NonNullable<Awaited<ReturnType<typeof getEventCenteredGenerativePlanCheckpoint>>>
): EventCenteredGenerativeSemanticPlanArtifact {
  const artifact = checkpoint.artifact as unknown as EventCenteredGenerativeSemanticPlanArtifact;
  if (
    checkpoint.artifactVersion !== EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION ||
    artifact.artifactVersion !== checkpoint.artifactVersion ||
    artifact.strategyVersion !== checkpoint.strategyVersion ||
    artifact.angleCardVersion !== checkpoint.angleCardVersion ||
    artifact.fewShotVersion !== checkpoint.fewShotVersion ||
    artifact.promptVersion !== checkpoint.promptVersion
  ) {
    throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_VERSION_MISMATCH");
  }
  return artifact;
}

async function generateVisibleTurnFromFrozenPlan(input: {
  generationInput: EventCenteredGenerativeGenerationInput;
  artifact: EventCenteredGenerativeSemanticPlanArtifact;
  planStage?: EventCenteredGenerativeSemanticPlanStageResult;
}): Promise<EventCenteredGenerativeGenerationResult> {
  const visibleResults: Awaited<ReturnType<
    typeof generateEventCenteredGenerativeVisibleTurnAI
  >>[] = [];
  let lastError: unknown = null;
  const retryExceptionDiagnostics: string[] = [];
  let retryIssues = input.generationInput.retryIssues ?? [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await generateEventCenteredGenerativeVisibleTurnAI({
        ...input.generationInput,
        artifact: input.artifact,
        retryIssues
      });
      visibleResults.push(result);
      if (result.turn) break;
      retryIssues = result.validationIssues;
      if (attempt === 0 && hasTransientGenerativeFailure(result.validationIssues)) {
        await input.generationInput.onRetry?.({
          stage: "visible",
          attempt: 1,
          reasonCodes: result.validationIssues
        });
      }
      input.generationInput.signal?.throwIfAborted();
    } catch (error) {
      lastError = error;
      retryExceptionDiagnostics.push(
        `visible_retry_exception:${error instanceof Error ? error.name : "UNKNOWN_ERROR"}`
      );
      if (input.generationInput.signal?.aborted) throw error;
    }
  }
  const finalVisible = visibleResults.at(-1);
  const planAttempts = input.planStage?.attempts ?? [];
  const planLineage = input.planStage?.promptLineage ?? input.artifact.promptLineage;
  if (!finalVisible) {
    return {
      turn: null,
      semanticArtifact: input.artifact,
      outputOrigin: "fallback",
      attempts: planAttempts,
      promptLineage: planLineage,
      validationIssues: [
        `VISIBLE_REQUEST_FAILED:${lastError instanceof Error ? lastError.name : "UNKNOWN_ERROR"}`
      ],
      qualityDiagnostics: retryExceptionDiagnostics,
      strategyVersion: input.artifact.strategyVersion,
      angleCardVersion: input.artifact.angleCardVersion,
      fewShotVersion: input.artifact.fewShotVersion,
      fewShotIds: input.artifact.fewShotIds,
      architecture: "two_call"
    };
  }
  return {
    ...finalVisible,
    attempts: [
      ...planAttempts,
      ...visibleResults.flatMap((result) => result.attempts)
    ],
    promptLineage: uniqueGenerativePromptLineage(
      planLineage,
      ...visibleResults.map((result) => result.promptLineage)
    ),
    validationIssues: finalVisible.turn
      ? finalVisible.validationIssues
      : Array.from(new Set(visibleResults.flatMap((result) => result.validationIssues))),
    qualityDiagnostics: Array.from(new Set([
      ...(input.planStage?.qualityDiagnostics ?? []),
      ...visibleResults.flatMap((result) => result.qualityDiagnostics),
      ...collectEventCenteredVisibleRetryDiagnostics(visibleResults),
      ...(finalVisible.turn ? retryExceptionDiagnostics : [])
    ])),
    strategyVersion: input.artifact.strategyVersion,
    angleCardVersion: input.artifact.angleCardVersion,
    fewShotVersion: input.artifact.fewShotVersion,
    fewShotIds: input.artifact.fewShotIds,
    architecture: "two_call"
  };
}

function controlUnderstandingDecision(input: {
  action: EventCenteredRespondRequest["action"];
  rawText: string;
}): EventCenteredUnderstandingDecision {
  const selectedEvent = input.action === "select_current_event";
  const personalReaction = selectedEvent
    ? extractEventCenteredPersonalReactionFact(input.rawText)
    : null;
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
        }, ...(personalReaction ? [personalReaction] : [])]
      : [],
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    correctionTargetHint: null,
    boundaryReason: null
  };
}

function gi066ThoughtControl(input: {
  action: EventCenteredRespondRequest["action"];
  rawText: string;
}) {
  if (input.action === "exit_event") return "exit" as const;
  if (input.action === "correct_understanding") return "correction" as const;
  const normalized = input.rawText.replace(/\s+/gu, "").trim();
  if (/(?:不想继续|先停|别问了|不聊了|到这里|就这样|停止)/u.test(normalized)) {
    return "stop" as const;
  }
  if (/^(?:继续|再聊聊|接着聊|继续聊)$/u.test(normalized)) return "continue" as const;
  return "none" as const;
}

function materializeThoughtMapRefs(
  update: ThoughtMapProviderOutput,
  turnId: string,
  correctionRawText?: string,
  activeDirection?: ThoughtProtocolState["currentDirection"]
): ThoughtMapProviderOutput {
  const mapRef = (ref: string) => ref.replace(/^new:(\d+)$/u, `turn:${turnId}:$1`);
  return {
    ...update,
    targetUpdates: update.targetUpdates.map((target) => ({
      ...target,
      sourceRefs: target.sourceRefs.map(mapRef)
    })),
    routeSignals: {
      ...update.routeSignals,
      sourceRefs: update.routeSignals.sourceRefs.map(mapRef)
    },
    relationCandidate: update.relationCandidate
      ? {
          ...update.relationCandidate,
          sourceRefs: update.relationCandidate.sourceRefs.map(mapRef)
        }
      : null,
    correction: update.correction
      ? {
          ...update.correction,
          kind: correctionRawText
            ? classifyThoughtCorrectionKind(correctionRawText)
            : update.correction.kind,
          affectedDirections: update.correction.affectedDirections.length > 0
            ? update.correction.affectedDirections
            : activeDirection
              ? [activeDirection]
              : update.correction.affectedDirections,
          invalidatedSourceRefs: update.correction.invalidatedSourceRefs.map(mapRef)
        }
      : null
  };
}

function thoughtUpdateUnderstandingDecision(
  update: ThoughtMapProviderOutput
): EventCenteredUnderstandingDecision {
  const answerSignal = update.answerStatus === "complete"
    ? "answered"
    : update.answerStatus === "partial"
      ? "partly_answered"
      : update.answerStatus === "denied"
        ? "declined"
        : update.answerStatus === "unclear"
          ? "unknown"
          : update.answerStatus === "correction"
            ? "correction"
            : "unrelated";
  return {
    eventBoundary: update.eventBoundary,
    coreEventIdentifiable: update.eventBoundary === "current_event",
    answerSignal,
    facts: update.factDeltas,
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    correctionTargetHint: null,
    boundaryReason: null
  };
}

function gi066CognitiveAction(plan: ThoughtQuestionPlan) {
  if (plan.operation === "specific_instance") return "anchor_specific" as const;
  if (plan.operation === "clarify_term") return "clarify_user_term" as const;
  if (plan.direction === "evidence_tension" || plan.direction === "tradeoff_condition") {
    return "surface_tension" as const;
  }
  if (plan.direction === "judgment_calibration") return "trace_change" as const;
  if (plan.operation === "single_variable_contrast") return "differentiate" as const;
  return "connect_clues" as const;
}

function applyGI066ThoughtPolicy(input: {
  state: EventCenteredDialogueState;
  protocol: ThoughtProtocolState;
  plan: ThoughtQuestionPlan;
  expression: ThoughtQuestionExpression | null;
  relationCandidate: ThoughtMapProviderOutput["relationCandidate"];
}): EventCenteredTurnPolicyResult {
  const nextState = structuredClone(input.state);
  nextState.thoughtProtocol = input.protocol;
  nextState.reflectionReady = true;
  nextState.activeAngle = "thought";
  nextState.focusOptions = [];
  const run = nextState.angleRuns.thought ?? {
    status: "active" as const,
    questionOpportunityCount: 0,
    currentOutcomeId: null,
    answeredTargets: [],
    askedTargets: [],
    deniedTargets: []
  };
  nextState.angleRuns.thought = run;
  const relationCandidate = input.relationCandidate &&
    input.relationCandidate.sourceRefs.length >= 2 &&
    !/[_:]/u.test(input.relationCandidate.relationKey) &&
    input.relationCandidate.relationKey.trim().length >= 8
    ? {
        angle: "thought" as const,
        kind: "insight" as const,
        statement: input.relationCandidate.relationKey.trim(),
        supportKeys: input.relationCandidate.sourceRefs
      }
    : null;

  if (input.plan.action === "ask" && input.plan.signature && input.expression) {
    nextState.phase = nextState.phase === "deep_companionship"
      ? "deep_companionship"
      : "guided_reflection";
    run.status = "active";
    const directionOpportunityNumber = Math.max(
      1,
      Math.min(3, input.protocol.directionQuestionCount)
    );
    run.questionOpportunityCount = directionOpportunityNumber;
    const target = `gi066:${input.plan.signature.direction}:${input.plan.signature.operation}:${input.plan.signature.coreConditionKey}`;
    if (!run.askedTargets.includes(target)) run.askedTargets.push(target);
    const cognitiveAction = gi066CognitiveAction(input.plan);
    nextState.currentQuestion = {
      opportunityNumber: directionOpportunityNumber,
      angle: "thought",
      target,
      surfaceLevel: input.plan.operation === "specific_instance"
        ? "concrete_anchor"
        : "open_anchor",
      repairCount: 0,
      assistantMessageId: null,
      cognitiveAction
    };
    nextState.currentQuestionIntent = {
      targetId: target,
      semanticGoal: input.plan.expectedDelta ?? target,
      minimumAnswerScope: input.plan.signature.expectedRelation
    };
    return {
      nextState,
      directive: {
        responseKind: "question",
        questionSpec: {
          phase: nextState.phase,
          angle: "thought",
          target,
          opportunityNumber: directionOpportunityNumber,
          surfaceLevel: nextState.currentQuestion.surfaceLevel,
          anchorText: null,
          repairCount: 0,
          cognitiveAction
        },
        checkpoint: null,
        angleOutcome: input.relationCandidate?.origin === "ai_synthesized" && relationCandidate
          ? {
              angle: "thought",
              kind: "insight",
              statement: relationCandidate.statement
            }
          : null,
        exactResponse: input.expression.question
      },
      angleOutcome: relationCandidate,
      preserveCurrentQuestion: false
    };
  }

  nextState.phase = "deep_companionship";
  nextState.currentQuestion = null;
  nextState.currentQuestionIntent = null;
  if (input.plan.action === "transition") {
    return {
      nextState,
      directive: {
        responseKind: "transition",
        questionSpec: null,
        checkpoint: null,
        angleOutcome: input.relationCandidate?.origin === "ai_synthesized" && relationCandidate
          ? {
              angle: "thought",
              kind: "insight",
              statement: relationCandidate.statement
            }
          : null,
        exactResponse: GI066_OPEN_TRANSITION
      },
      angleOutcome: relationCandidate,
      preserveCurrentQuestion: false
    };
  }
  return {
    nextState,
    directive: {
      responseKind: "boundary",
      questionSpec: null,
      checkpoint: null,
      angleOutcome: null,
      exactResponse: "好，这一段先停在这里。"
    },
    angleOutcome: null,
    preserveCurrentQuestion: false
  };
}

function eventRecordingUnderstanding(input: {
  correction: boolean;
  answerSignal: EventCenteredUnderstandingDecision["answerSignal"];
  eventBoundary: EventCenteredUnderstandingDecision["eventBoundary"];
}) {
  if (input.correction) return "好，我按你刚才更准确的说法记下。";
  if (input.answerSignal === "declined") return "好，我按你愿意说的范围记下。";
  if (input.eventBoundary === "multiple_events") {
    return "我先把你刚才提到的几件事留在这里。";
  }
  return "我先把这件事和你的反应记下来。";
}

function responseAcknowledgesCorrection(value: string) {
  return /(?:刚才|之前|前面).{0,12}(?:理解|判断|说法).{0,8}(?:需要改|不准确|不对|撤回)|(?:按|根据)你.{0,10}(?:纠正|更正|更准确)|你.{0,8}(?:纠正|更正)(?:了)?|(?:这里|现在)(?:应|要)?改成|我.{0,8}(?:理解错|听错|弄错)/u.test(
    value
  );
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
      inputMode: request.inputMode ?? "text",
      targetMessageId: request.action === "correct_understanding"
        ? request.targetMessageId
        : undefined
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

function resolveCurrentQuestionContext(
  data: EventCenteredInterviewWorkspaceData,
  currentQuestion: { assistantMessageId: string | null; target: string } | null
) {
  if (!currentQuestion) return { text: null, targetMismatch: false };

  const matchingQuestionText = (
    message: EventCenteredInterviewWorkspaceData["messages"][number]
  ) => {
    const payload = parseEventCenteredAssistantPayload(message.content);
    if (!payload?.questionSpec) return { text: null, isQuestion: false };
    return {
      text: payload.questionSpec.target === currentQuestion.target
        ? payload.naturalResponse
        : null,
      isQuestion: true
    };
  };

  if (currentQuestion.assistantMessageId) {
    const activeQuestionMessage = data.messages.find((message) =>
      message.id === currentQuestion.assistantMessageId && message.role === "assistant"
    );
    if (activeQuestionMessage) {
      const exact = matchingQuestionText(activeQuestionMessage);
      return {
        text: exact.text,
        targetMismatch: !exact.text
      };
    }
  }
  let foundOtherQuestion = false;
  for (let index = data.messages.length - 1; index >= 0; index -= 1) {
    const message = data.messages[index];
    if (message?.role !== "assistant") continue;
    const candidate = matchingQuestionText(message);
    foundOtherQuestion ||= candidate.isQuestion;
    if (candidate.text) return { text: candidate.text, targetMismatch: false };
  }
  return { text: null, targetMismatch: foundOtherQuestion };
}

function recentGenerativeTurns(
  data: EventCenteredInterviewWorkspaceData,
  limit = 3
) {
  const turns: Array<{
    user: string;
    assistantUnderstanding: string;
    assistantQuestion: string | null;
  }> = [];
  let latestUser: string | null = null;
  for (const message of data.messages) {
    if (message.role === "user") {
      latestUser = message.rawText ?? message.content;
      continue;
    }
    if (message.role !== "assistant" || !latestUser) continue;
    const payload = parseEventCenteredAssistantPayload(message.content);
    if (!payload) continue;
    if (payload.presentation === "hidden") {
      latestUser = null;
      continue;
    }
    turns.push({
      user: latestUser,
      assistantUnderstanding: payload.naturalUnderstanding,
      assistantQuestion: payload.questionSpec ? payload.naturalResponse : null
    });
    latestUser = null;
  }
  return turns.slice(-Math.max(1, limit));
}

function generativeAngleForTurn(input: {
  state: ReturnType<typeof parseEventCenteredDialogueState>;
  request: EventCenteredRespondRequest;
}) {
  return input.request.angle ?? input.state.activeAngle ?? (
    input.state.phase === "checkpoint_two" || input.state.phase === "deep_companionship"
      ? input.state.lastCompletedAngle
      : null
  );
}

/**
 * “第一次说不清”是统一问停协议的一部分。它只需要把原问题换成同目标的
 * 具体入口，跳过模型与 checkpoint，避免把一条已明确的用户边界误计为运行降级。
 */
function needsDeterministicUnableAnswerHandling(input: {
  state: ReturnType<typeof parseEventCenteredDialogueState>;
  request: EventCenteredRespondRequest;
  rawText: string;
}) {
  const question = input.state.currentQuestion;
  if (
    input.request.action !== "reply" ||
    !question?.angle ||
    !hasEventCenteredUnableAnswerSignal(input.rawText)
  ) {
    return false;
  }
  // 已给过一次具体入口后，第二次“说不清”直接由共用策略关闭当前角度。
  if (question.repairCount > 0) return true;
  return question.opportunityNumber < 3 &&
    (question.surfaceLevel === "open_anchor" || question.surfaceLevel === "simplified");
}

function turnFactWrites(input: {
  decision: EventCenteredUnderstandingDecision;
  projection: JournalEventFactProjection;
  turnId: string;
  userMessageId: string;
  action: EventCenteredRespondRequest["action"];
  contextMessageId: string | null;
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
      contextMessageId: input.contextMessageId,
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
        // Generative evidence refs use the public `new:1` convention. The
        // understanding repository receives a zero-based write index.
        ? { role: "support" as const, factWriteIndex: Number(key.slice(4)) - 1 }
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

type EventCenteredGenerativeFailureStage = "semantic" | "visible" | "combined";

function generativeFailureStage(input: {
  architecture: EventCenteredGenerativeArchitecture;
  result: EventCenteredGenerativeGenerationResult | null;
}): EventCenteredGenerativeFailureStage {
  if (input.architecture === "one_call") return "combined";
  const reachedVisibleStage = Boolean(
    input.result?.semanticArtifact ||
    input.result?.attempts.some((attempt) => attempt.stage === "question") ||
    input.result?.promptLineage.some((prompt) =>
      prompt.promptKey === "interview.event_centered.generative_visible_turn"
    )
  );
  return reachedVisibleStage ? "visible" : "semantic";
}

function generativeFailureCode(
  result: EventCenteredGenerativeGenerationResult | null
) {
  const attemptCode = [...(result?.attempts ?? [])]
    .reverse()
    .find((attempt) => !attempt.success && attempt.errorCode)
    ?.errorCode;
  if (attemptCode) return attemptCode;
  const issue = result?.validationIssues[0]?.trim();
  return issue ? issue.split(":", 1)[0]!.slice(0, 120) : "GENERATION_UNAVAILABLE";
}

function hasTransientGenerativeFailure(issues: readonly string[]) {
  return issues.some((issue) =>
    /(?:SERVICE_UNAVAILABLE|TIMEOUT|REQUEST_FAILED|UPSTREAM_HTTP|HTTP_429|HTTP_5\d\d)/u.test(issue)
  );
}

function generativeRepairApplied(result: EventCenteredGenerativeGenerationResult | null) {
  if (result?.qualityDiagnostics?.some((issue) =>
    issue.startsWith("semantic_retry:") || issue.startsWith("visible_retry:")
  )) {
    return true;
  }
  let hadFailure = false;
  for (const attempt of result?.attempts ?? []) {
    if (!attempt.success) {
      hadFailure = true;
      continue;
    }
    if (hadFailure) return true;
  }
  return false;
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
  contextMessageId?: string | null;
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
      contextMessageId: input.contextMessageId ?? null,
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
  targetOutcomeMessageId?: string | null;
  explicitCorrectionAction: boolean;
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
    userMessageId: input.turn.userMessageId,
    contextMessageId: input.projection.pendingClarification?.clarificationMessageId ??
      input.stateSnapshot.currentQuestion?.assistantMessageId ?? null
  });

  if (input.targetOutcomeMessageId) {
    return {
      kind: "revised" as const,
      result: await applyJournalEventFactRevision({
        userId: input.userId,
        eventId: input.eventId,
        activeBranchSessionId: input.branchSessionId,
        branchStateId: input.branchStateId,
        sourceTurnId: input.turn.turn.id,
        pathAnchorMessageId: input.turn.userMessageId,
        contextMessageId: input.targetOutcomeMessageId,
        quote: input.rawText,
        baseMessageSequence: input.turn.turn.baseMessageSequence,
        targets: [],
        resultFacts: [],
        rejectUnderstandingClaimId: input.stateSnapshot.pendingUnderstandingClaimId,
        targetOutcomeMessageId: input.targetOutcomeMessageId,
        trace
      })
    };
  }

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

  if (
    targets.length === 0 &&
    input.projection.facts.length >= 2 &&
    !(input.explicitCorrectionAction && !hint)
  ) {
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

const OUTCOME_CORRECTION_ONLY_DENIAL = /^(?:不对|不是这样|我不认同|我不同意|没有这回事|这个理解不准确|你理解错了)(?:了|啊|呀|呢|吧)?[。！!？?]?$/u;

function replacementOutcomeStatement(input: {
  rawText: string;
  decision: EventCenteredUnderstandingDecision;
}) {
  const statedUnderstanding = input.decision.facts.find((fact) =>
    fact.kind === "stated_interpretation" || fact.kind === "stated_preference"
  )?.statement.trim();
  if (statedUnderstanding) return statedUnderstanding.replace(/^用户/u, "你");
  const rawText = input.rawText.trim();
  if (!rawText || OUTCOME_CORRECTION_ONLY_DENIAL.test(rawText)) return null;
  if (!/(?:我的意思|我想表达|准确地说|更准确|更像|其实|应该是|而是|对我来说|我觉得|我在意)/u.test(rawText)) {
    return null;
  }
  return rawText
    .replace(/^(?:不对|不是这样|这个理解不准确|你理解错了)[，,:：\s]*/u, "")
    .trim() || null;
}

function correctionTargetAssistantMessage(
  data: EventCenteredInterviewWorkspaceData,
  targetMessageId?: string
) {
  if (targetMessageId) {
    const target = data.messages.find((message) =>
      message.id === targetMessageId && message.role === "assistant"
    );
    if (!target) throw new Error("EVENT_STATE_CHANGED");
    return target;
  }
  return [...data.messages].reverse().find((message) => message.role === "assistant") ?? null;
}

function correctionAngleRepairResolutions(input: {
  projection: JournalEventAngleProjection;
  revisionId: string;
  replacementStatement: string | null;
}): JournalEventAngleRepairResolutionInput[] {
  return input.projection.repairs
    .filter((repair) => repair.status === "pending" && repair.factRevisionId === input.revisionId)
    .map((repair) => {
      if (!input.replacementStatement) {
        return { repairId: repair.id, decision: "reopen" as const };
      }
      const prior = input.projection.outcomesByAngle[repair.angle];
      if (!prior || prior.facts.length === 0) {
        return { repairId: repair.id, decision: "reopen" as const };
      }
      return {
        repairId: repair.id,
        decision: "replace" as const,
        outcome: {
          kind: "insight" as const,
          statement: input.replacementStatement,
          dependencies: prior.facts.map((fact) => ({
            role: fact.role,
            factId: fact.factId
          }))
        }
      };
    });
}

async function rejectPendingHypothesisDecision(input: {
  userId: string;
  eventId: string;
  branchSessionId: string;
  branchStateId: string;
  turn: ReserveEventCenteredTurnResult;
  rawText: string;
  decision: EventCenteredUnderstandingDecision;
  stateSnapshot: ReturnType<typeof parseEventCenteredDialogueState>;
  requestId?: string;
}) {
  const claimId = input.stateSnapshot.pendingUnderstandingClaimId;
  if (!claimId) throw new Error("EVENT_STATE_CHANGED");
  return applyJournalEventFactRevision({
    userId: input.userId,
    eventId: input.eventId,
    activeBranchSessionId: input.branchSessionId,
    branchStateId: input.branchStateId,
    sourceTurnId: input.turn.turn.id,
    pathAnchorMessageId: input.turn.userMessageId,
    contextMessageId: input.stateSnapshot.currentQuestion?.assistantMessageId ?? null,
    quote: input.rawText,
    baseMessageSequence: input.turn.turn.baseMessageSequence,
    targets: [],
    resultFacts: revisionResultFacts({
      decision: input.decision,
      turnId: input.turn.turn.id,
      userMessageId: input.turn.userMessageId
    }),
    rejectUnderstandingClaimId: claimId,
    trace: {
      requestId: input.requestId ?? null,
      outputOrigin: "llm",
      contextSnapshot: {
        kind: "event_centered_hypothesis_rejection",
        claimId,
        questionTarget: input.stateSnapshot.currentQuestion?.target ?? null
      },
      finalOutput: { decision: input.decision },
      pipelineDecisions: [{
        kind: "hypothesis_rejection_priority",
        answerSignal: input.decision.answerSignal
      }]
    }
  });
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
  options?: EventCenteredRespondInternalOptions
) {
  assertEventCenteredWriteAllowed();
  const responseStartedAt = Date.now();
  const timing: EventCenteredTurnTiming = {
    initialWorkspaceReadMs: null,
    turnReservationPersistenceMs: null,
    factsAndOutcomesReadMs: null,
    semanticModelMs: null,
    visibleResponseModelMs: null,
    writeCommitMs: null,
    finalWorkspaceRecoveryMs: null,
    visibleResponseReadyMs: null,
    interactiveReadyMs: null
  };
  const initialWorkspaceStartedAt = Date.now();
  const before = await getEventCenteredInterviewWorkspaceData(userId, request.rootSessionId);
  timing.initialWorkspaceReadMs = elapsedMs(initialWorkspaceStartedAt);
  if (!before) throw new Error("SESSION_NOT_FOUND");
  const stateBeforeRequest = parseEventCenteredDialogueState(before.snapshotData);
  const currentAllowedActions = getWorkspaceAllowedActions({
    data: before,
    state: stateBeforeRequest,
    pendingFactClarification: hasPendingFactClarification(before.snapshotData),
    pendingAngleRepair: stateBeforeRequest.repairPendingAngles.length > 0
  });
  if (!currentAllowedActions.includes(request.action)) {
    throw new Error("INTERVIEW_ACTION_UNSUPPORTED");
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
    if (
      isEventCenteredThoughtOnlyScope() &&
      request.regenerationIntent === "simplify"
    ) {
      throw new EventCenteredGenerationBlockedError(
        "content_check",
        "EVENT_CENTERED_SIMPLE_MODE_DISABLED"
      );
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
  let resumedGenerativeCheckpoint: Awaited<
    ReturnType<typeof getEventCenteredGenerativePlanCheckpoint>
  > = null;
  const reservationStartedAt = Date.now();
  if (request.action === "resume_turn") {
    const pending = before.pendingTurn;
    if (!pending || pending.clientTurnId !== request.clientTurnId) {
      const current = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
      if (!current) throw new Error("SESSION_NOT_FOUND");
      return { workspace: current, assistantPayload: null };
    }
    resumedGenerativeCheckpoint = await getEventCenteredGenerativePlanCheckpoint({
      userId,
      rootSessionId: before.identity.rootSessionId,
      activeBranchSessionId: before.identity.activeBranchSessionId,
      clientTurnId: request.clientTurnId
    });
    await resumeEventCenteredTurnUnderstanding({
      userId,
      activeBranchSessionId: before.identity.activeBranchSessionId,
      clientTurnId: request.clientTurnId
    });
    const userMessage = before.messages.find((message) => message.userTurnId === pending.id);
    if (!before.identity.eventId || !before.identity.branchStateId || !userMessage) {
      throw new Error("EVENT_STATE_CHANGED");
    }
    const operation = resumedGenerativeCheckpoint?.operationData ?? pending.eventOperationData;
    effectiveRequest = {
      action: pending.action,
      rootSessionId: before.identity.rootSessionId,
      clientTurnId: pending.clientTurnId,
      baseBranchSessionId: pending.baseBranchSessionId ?? before.identity.activeBranchSessionId,
      baseMessageSequence: pending.baseMessageSequence,
      rawText: pending.rawText,
      inputMode: pending.inputMode,
      angle: operation?.kind === "select_exploration_angle" ? operation.angle : undefined,
      optionId: operation?.kind === "select_current_event" ? operation.optionId : undefined,
      targetMessageId: pending.targetMessageId ?? undefined
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
  timing.turnReservationPersistenceMs = elapsedMs(reservationStartedAt);
  await options?.onTurn?.(reservation);
  const stateBeforeTurn = stateBeforeRequest;
  const turnContext: EventCenteredTurnContext = {
    workspace: before,
    state: stateBeforeTurn,
    facts: null,
    angleProjection: null,
    versions: {
      strategyVersion: stateBeforeTurn.strategyVersion ?? null,
      schemaVersion: before.identity.conversationSchemaVersion
    },
    timing
  };

  if (reservation.turn.status === "completed") {
    const workspace = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    return { workspace, assistantPayload: null };
  }
  if (effectiveRequest.action === "exit_event") {
    try {
      await materializeJournalEventEntryCard({
        userId,
        eventId: reservation.eventId,
        activeBranchSessionId: reservation.activeBranchSessionId,
        // `exit_event` 已先以可靠用户回合写入；卡片需要绑定这条返回动作
        // 之后的完整来源快照，才能通过并发版本校验。
        baseMessageSequence: reservation.turn.baseMessageSequence + 1,
        returnTurnId: reservation.turn.id
      });
    } catch (error) {
      // Opening-only records do not form a timeline card. They keep the
      // established abandonment behavior so calendar views remain truthful.
      if (!(error instanceof Error) || error.message !== "EVENT_RECORD_CARD_SOURCE_INSUFFICIENT") {
        throw error;
      }
      await abandonJournalEvent(userId, reservation.eventId, reservation.turn.id);
      await recordEventCenteredAnalyticsEvent({
        eventName: "event_centered_session_abandoned",
        userId,
        dedupeKey: `event_centered_session_abandoned:${reservation.eventId}`,
        rootSessionId: reservation.rootSessionId,
        journalEventId: reservation.eventId,
        requestId: options?.requestId ?? null,
        entryDate: before.identity.entryDate,
        stage: stateBeforeTurn.phase,
        angle: stateBeforeTurn.activeAngle
      });
    }
    const workspace = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    return { workspace, assistantPayload: null };
  }
  if (
    effectiveRequest.action === "reply" &&
    reservation.turn.rawText.trim()
  ) {
    await recordEventCenteredAnalyticsEvent({
      eventName: "event_centered_first_content_submitted",
      userId,
      dedupeKey: `event_centered_first_content_submitted:${reservation.rootSessionId}`,
      rootSessionId: reservation.rootSessionId,
      journalEventId: reservation.eventId,
      requestId: options?.requestId ?? null,
      entryDate: before.identity.entryDate,
      stage: stateBeforeTurn.phase,
      angle: stateBeforeTurn.activeAngle
    });
  }

  try {
    options?.signal?.throwIfAborted();
    await options?.onPhase?.("understanding");
    const state = turnContext.state;
    if (
      before.identity.recordMode === "capture" &&
      effectiveRequest.action === "reply"
    ) {
      const rawText = reservation.turn.rawText.trim();
      const responsePayload: EventCenteredAssistantPayload = {
        naturalUnderstanding: "",
        naturalResponse: "好，这段已经记下了。",
        responseKind: "acknowledgement",
        questionSpec: null,
        checkpoint: null,
        angleOutcome: null
      };
      const nextState = structuredClone(state);
      nextState.phase = "event_recording";
      nextState.reflectionReady = false;
      nextState.activeAngle = null;
      nextState.lastCompletedAngle = null;
      nextState.currentQuestion = null;
      nextState.currentQuestionIntent = null;
      nextState.focusOptions = [];
      nextState.pendingUnderstandingClaimId = null;
      nextState.currentMicrogoal = null;

      await options?.onPhase?.("responding");
      await options?.onDelta?.("response", responsePayload.naturalResponse);
      timing.visibleResponseReadyMs = elapsedMs(responseStartedAt);
      await options?.onPhase?.("committing");
      const writeCommitStartedAt = Date.now();
      await commitEventCenteredTurnUnderstanding({
        userId,
        eventId: reservation.eventId,
        activeBranchSessionId: reservation.activeBranchSessionId,
        branchStateId: reservation.branchStateId,
        userTurnId: reservation.turn.id,
        assistantMessage: {
          id: randomUUID(),
          content: serializeEventCenteredAssistantPayload(responsePayload),
          lastAssistantQuestion: null
        },
        facts: [],
        pendingClaim: null,
        focusSummary: rawText.slice(0, 240) || "这段已经记下",
        snapshotData: nextState,
        trace: {
          requestId: options?.requestId ?? null,
          outputOrigin: "deterministic",
          contextSnapshot: {
            strategyMode: "capture",
            recordMode: "capture",
            phase: state.phase,
            currentQuestionTarget: null,
            recentContextMessageIds: before.messages.slice(-6).map((message) => message.id)
          },
          finalOutput: {
            assistant: responsePayload
          },
          pipelineDecisions: [{
            kind: "event_centered_capture_zero_question",
            recordMode: "capture",
            questionSpec: null
          }]
        },
        checks: {
          eventBoundaryPassed: true,
          factsHaveUserSource: true,
          visibleUnderstandingMatchesClaim: true,
          unsupportedClaimCount: 0
        },
        angleOutcome: null,
        angleRepairResolutions: []
      });
      timing.writeCommitMs = elapsedMs(writeCommitStartedAt);
      const finalWorkspaceStartedAt = Date.now();
      const workspace = await getEventCenteredInterviewWorkspace(
        userId,
        request.rootSessionId
      );
      timing.finalWorkspaceRecoveryMs = elapsedMs(finalWorkspaceStartedAt);
      if (!workspace) throw new Error("SESSION_NOT_FOUND");
      timing.interactiveReadyMs = elapsedMs(responseStartedAt);
      await recordEventCenteredAnalyticsEvent({
        eventName: "event_centered_response_completed",
        userId,
        dedupeKey: `event_centered_response_completed:${reservation.turn.id}`,
        rootSessionId: reservation.rootSessionId,
        journalEventId: reservation.eventId,
        requestId: options?.requestId ?? null,
        entryDate: before.identity.entryDate,
        stage: nextState.phase,
        angle: null,
        requestedStrategy: "capture",
        effectiveStrategy: "capture",
        generativeAttempted: false,
        deterministicControlAction: "capture_acknowledgement",
        eventRecordingRecognition: true,
        attemptCount: 0,
        latencyMs: timing.interactiveReadyMs,
        visibleResponseReadyMs: timing.visibleResponseReadyMs,
        interactiveReadyMs: timing.interactiveReadyMs,
        initialWorkspaceReadMs: timing.initialWorkspaceReadMs,
        turnReservationPersistenceMs: timing.turnReservationPersistenceMs,
        factsAndOutcomesReadMs: null,
        semanticModelMs: null,
        visibleResponseModelMs: null,
        modelMs: 0,
        nonModelMs: timing.interactiveReadyMs,
        writeCommitMs: timing.writeCommitMs,
        finalWorkspaceRecoveryMs: timing.finalWorkspaceRecoveryMs
      });
      await options?.onPhase?.("complete");
      return { workspace, assistantPayload: responsePayload };
    }
    const answeredQuestionContext = resolveCurrentQuestionContext(
      before,
      state.currentQuestion
    );
    const answeredQuestionText = answeredQuestionContext.text;
    const answeredQuestionTarget = state.currentQuestion?.target ?? null;
    const answeredQuestionSurfaceLevel = state.currentQuestion?.surfaceLevel ?? null;
    const answeredQuestionIntent = answeredQuestionContext.targetMismatch
      ? null
      : getEventCenteredCurrentQuestionIntent(state);
    const answeredQuestionMessageId = state.currentQuestion?.assistantMessageId ?? null;
    const factsReadStartedAt = Date.now();
    let factProjection = await getEffectiveJournalEventFactProjection(
      reservation.eventId,
      reservation.activeBranchSessionId
    );
    timing.factsAndOutcomesReadMs = elapsedMs(factsReadStartedAt);
    turnContext.facts = factProjection;
    const rawText = reservation.turn.rawText || effectiveRequest.rawText || "";
    const correctionTargetMessage = effectiveRequest.action === "correct_understanding"
      ? correctionTargetAssistantMessage(before, effectiveRequest.targetMessageId)
      : null;
    const correctionTargetPayload = correctionTargetMessage
      ? parseEventCenteredAssistantPayload(correctionTargetMessage.content)
      : null;
    const targetOutcomeMessageId = correctionTargetPayload?.angleOutcome
      ? correctionTargetMessage?.id ?? null
      : null;
    let angleRepairResolutions: JournalEventAngleRepairResolutionInput[] = [];
    let correctedOutcomeStatement: string | null = null;
    const isControl =
      effectiveRequest.action === "select_current_event" ||
      effectiveRequest.action === "select_exploration_angle" ||
      effectiveRequest.action === "continue_exploration";
    const thoughtOnly = isEventCenteredThoughtOnlyScope();
    const generativeEnabled = isGenerativeEventCenteredStrategyEnabled();
    const completeResponseFirstEnabled =
      isCompleteResponseFirstEventCenteredStrategyEnabled();
    const thoughtControl = thoughtOnly
      ? gi066ThoughtControl({ action: effectiveRequest.action, rawText })
      : "none" as const;
    const thoughtDeterministicControl = thoughtOnly &&
      (thoughtControl === "stop" || thoughtControl === "exit");
    const bareAngleChange = isBareEventCenteredAngleChange(rawText);
    const continuesWithinBoundary = effectiveRequest.action === "reply" &&
      Boolean(state.currentQuestion) &&
      isEventCenteredContinueWithinBoundaryExpression(rawText);
    const preservesCurrentQuestionDeterministically = bareAngleChange || continuesWithinBoundary;
    const isEventRecordingPhase = state.phase === "event_recording" ||
      state.phase === "event_focus_clarification";
    const entryMaterial = getEventCenteredReflectionMaterialStatus({
      rawText,
      facts: factProjection.facts.map((fact) => ({
        statement: fact.statement,
        stance: fact.stance,
        kind: fact.kind,
        sourceTexts: fact.evidence
          .map((evidence) => evidence.quote?.trim())
          .filter((quote): quote is string => Boolean(quote))
      }))
    });
    const autoEnterThought = Boolean(
      thoughtOnly &&
      isEventRecordingPhase &&
      (effectiveRequest.action === "reply" || effectiveRequest.action === "select_current_event") &&
      entryMaterial.ready &&
      splitEventCenteredSourceGroups(rawText).length <= 1 &&
      !preservesCurrentQuestionDeterministically
    );
    const deterministicControlOnly = (isControl || thoughtDeterministicControl) && !autoEnterThought;
    const eventRecordingRecognition = isEventRecordingPhase &&
      !deterministicControlOnly &&
      !autoEnterThought &&
      !preservesCurrentQuestionDeterministically;
    const deterministicUnableAnswerHandling = !thoughtOnly && needsDeterministicUnableAnswerHandling({
      state,
      request: effectiveRequest,
      rawText
    });
    const generativeAttempted = generativeEnabled &&
      !deterministicControlOnly &&
      (!isEventRecordingPhase || autoEnterThought) &&
      !preservesCurrentQuestionDeterministically &&
      !deterministicUnableAnswerHandling;
    const requiresThoughtCandidateGeneration = thoughtOnly &&
      !deterministicControlOnly &&
      (!isEventRecordingPhase || autoEnterThought) &&
      !preservesCurrentQuestionDeterministically &&
      !deterministicUnableAnswerHandling;
    if (requiresThoughtCandidateGeneration && !generativeEnabled) {
      throw new EventCenteredGenerationBlockedError(
        "configuration",
        "EVENT_CENTERED_GENERATIVE_STRATEGY_REQUIRED"
      );
    }
    const deterministicControlAction = deterministicControlOnly
      ? thoughtDeterministicControl
        ? `gi066_${thoughtControl}`
        : effectiveRequest.action
      : bareAngleChange
        ? "angle_change"
        : continuesWithinBoundary
          ? "continue_within_boundary"
          : deterministicUnableAnswerHandling
            ? state.currentQuestion?.repairCount
              ? "unable_answer_close"
              : "unable_answer_repair"
          : eventRecordingRecognition
            ? "event_recording"
            : null;
    const requestedStrategyForTurn = eventRecordingRecognition
      ? "baseline"
      : deterministicUnableAnswerHandling
        ? "baseline"
      : completeResponseFirstEnabled
        ? "complete_response_v1_1"
        : generativeEnabled
          ? "generative"
        : "baseline";
    const generativeAngle = autoEnterThought
      ? "thought" as const
      : generativeAngleForTurn({ state, request: effectiveRequest });
    const generativeRun = generativeAngle ? state.angleRuns[generativeAngle] : null;
    if (
      generativeAngle &&
      (state.phase === "checkpoint_two" || state.phase === "deep_companionship")
    ) {
      const angleProjectionStartedAt = Date.now();
      turnContext.angleProjection = await getEffectiveJournalEventAngleProjectionForPath({
        eventId: reservation.eventId,
        messageIds: before.messages.map((message) => message.id),
        factProjection
      });
      timing.factsAndOutcomesReadMs = addElapsedMs(
        timing.factsAndOutcomesReadMs,
        angleProjectionStartedAt
      );
    }
    const priorAngleOutcome = generativeAngle
      ? turnContext.angleProjection?.outcomesByAngle[generativeAngle] ?? null
      : null;
    const startsDeepMicrogoal = (
      state.phase === "checkpoint_two" || state.phase === "deep_companionship"
    ) &&
      effectiveRequest.action === "reply" &&
      !state.currentQuestion &&
      state.currentMicrogoal?.status !== "active";
    const requestedGenerativeArchitecture = options?.generativeArchitecture ??
      (completeResponseFirstEnabled ? "one_call" : "two_call");
    if (
      generativeEnabled &&
      generativeAttempted &&
      !requiresThoughtCandidateGeneration &&
      !resumedGenerativeCheckpoint &&
      (requestedGenerativeArchitecture === "two_call" || reservation.kind === "existing")
    ) {
      resumedGenerativeCheckpoint = await getEventCenteredGenerativePlanCheckpoint({
        userId,
        rootSessionId: reservation.rootSessionId,
        activeBranchSessionId: reservation.activeBranchSessionId,
        clientTurnId: reservation.turn.clientTurnId
      });
    }
    const regeneratesLegacySemanticPlan = Boolean(
      generativeEnabled &&
      resumedGenerativeCheckpoint &&
      resumedGenerativeCheckpoint.artifactVersion !==
        EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION
    );
    if (regeneratesLegacySemanticPlan) resumedGenerativeCheckpoint = null;
    const generativeArchitecture = resumedGenerativeCheckpoint || regeneratesLegacySemanticPlan
      ? "two_call"
      : requestedGenerativeArchitecture;
    const generationPhase = autoEnterThought ? "guided_reflection" as const : state.phase;
    const generativeInput: EventCenteredGenerativeGenerationInput = {
      rawText,
      phase: generationPhase,
      activeAngle: generativeAngle,
      currentQuestion: answeredQuestionText,
      currentQuestionTarget: answeredQuestionTarget,
      currentQuestionIntent: answeredQuestionIntent,
      currentQuestionSurfaceLevel: answeredQuestionSurfaceLevel,
      currentQuestionCognitiveAction: state.currentQuestion?.cognitiveAction ?? null,
      correctionRequested: effectiveRequest.action === "correct_understanding",
      facts: factProjection.facts,
      recentTurns: recentGenerativeTurns(before, completeResponseFirstEnabled ? 8 : 3),
      askedTargets: generativeRun?.askedTargets ?? [],
      answeredTargets: generativeRun?.answeredTargets ?? [],
      deniedTargets: generativeRun?.deniedTargets ?? [],
      guidedQuestionOpportunityCount: generativeRun?.questionOpportunityCount ??
        state.lightAnchorOpportunityCount,
      microgoal: state.currentMicrogoal && !startsDeepMicrogoal
        ? {
            statement: state.currentMicrogoal.statement,
            questionCount: state.currentMicrogoal.questionCount,
            answerCount: state.currentMicrogoal.answerCount ?? 0,
            status: state.currentMicrogoal.status,
            evidenceRefs: state.currentMicrogoal.evidenceRefs
          }
        : null,
      priorAngleOutcome: priorAngleOutcome
        ? {
            id: priorAngleOutcome.id,
            statement: priorAngleOutcome.statement,
            supportFactIds: priorAngleOutcome.facts.map((fact) => fact.factId)
          }
        : null,
      completeResponseFirst: completeResponseFirstEnabled,
      ...(completeResponseFirstEnabled
        ? {
            maxTokens: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.maxTokens,
            maxAttempts: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.maxAttempts,
            timeoutMs: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.timeoutMs
          }
        : {}),
      onRetry: async ({ attempt }) => {
        if (attempt === 1) await options?.onPhase?.("provider_retry_1");
      },
      signal: options?.signal
    };
    const generativeStartedAt = Date.now();
    const checkpointBeforeGeneration = resumedGenerativeCheckpoint;
    let generativeResult: EventCenteredGenerativeGenerationResult | null = null;
    let gi066ThoughtExecution: GI066ThoughtExecution | null = null;
    // 选择事件、选择角度和继续探索都是状态控制操作。它们没有新的用户
    // 原话可供语义判断，必须直接沿用已持久化事实完成状态切换；否则空
    // rawText 会把已有事实误判成当前回合没有材料。
    if (generativeAttempted) {
      if (requiresThoughtCandidateGeneration) {
        const mapStartedAt = Date.now();
        const mapResult = await generateEventCenteredThoughtMapUpdateAI({
          rawText,
          protocol: state.thoughtProtocol ?? createInitialThoughtProtocol(),
          facts: factProjection.facts,
          recentTurns: recentGenerativeTurns(before),
          correctionRequested: effectiveRequest.action === "correct_understanding",
          signal: options?.signal
        });
        timing.semanticModelMs = elapsedMs(mapStartedAt);
        if (!mapResult.update) {
          throw new EventCenteredGenerationBlockedError(
            "content_check",
            mapResult.validationIssues[0] ?? "THOUGHT_MAP_OUTPUT_UNAVAILABLE"
          );
        }
        const materializedUpdate = materializeThoughtMapRefs(
          mapResult.update,
          reservation.turn.id,
          effectiveRequest.action === "correct_understanding" ? rawText : undefined,
          state.thoughtProtocol?.currentDirection ?? null
        );
        const updatedProtocol = applyThoughtDeterministicUserSignals({
          rawText,
          sourceRef: `turn:${reservation.turn.id}:1`,
          protocol: applyThoughtMapUpdate({
          protocol: state.thoughtProtocol ?? createInitialThoughtProtocol(),
          update: materializedUpdate,
          turnId: reservation.turn.id
          })
        });
        const routed = decideThoughtQuestionPlan({
          protocol: updatedProtocol,
          control: thoughtControl,
          knownAnswerRefs: Object.values(updatedProtocol.targets).flatMap((target) => [
            ...target.sourceRefs,
            ...(target.relationKey ? [target.relationKey] : [])
          ]),
          latestAnswerKeys: materializedUpdate.targetUpdates.flatMap((target) => [
            ...target.sourceRefs,
            ...(target.relationKey ? [target.relationKey] : [])
          ])
        });
        const sourceEvidence = [
          ...factProjection.facts.map((fact) => ({
            ref: fact.id,
            sourceText: fact.statement
          })),
          ...mapResult.update.factDeltas.map((fact, index) => ({
            ref: `turn:${reservation.turn.id}:${index + 1}`,
            sourceText: fact.quote
          }))
        ];
        const expressionStartedAt = Date.now();
        const expressionResult = routed.plan.action === "ask"
          ? await generateEventCenteredThoughtQuestionAI({
              plan: routed.plan,
              sourceEvidence,
              correctionRequested: effectiveRequest.action === "correct_understanding",
              signal: options?.signal
            })
          : null;
        timing.visibleResponseModelMs = routed.plan.action === "ask"
          ? elapsedMs(expressionStartedAt)
          : 0;
        if (routed.plan.action === "ask" && !expressionResult?.expression) {
          throw new EventCenteredGenerationBlockedError(
            "content_check",
            expressionResult?.validationIssues[0] ?? "THOUGHT_EXPRESSION_OUTPUT_UNAVAILABLE"
          );
        }
        gi066ThoughtExecution = {
          mapUpdate: materializedUpdate,
          protocol: routed.protocol,
          plan: routed.plan,
          expression: expressionResult?.expression ?? null,
          attempts: [
            ...mapResult.attempts,
            ...(expressionResult?.attempts ?? [])
          ],
          promptLineage: [
            ...mapResult.promptLineage,
            ...(expressionResult?.promptLineage ?? [])
          ],
          repaired: mapResult.repaired || (expressionResult?.repaired ?? false)
        };
      } else if (generativeArchitecture === "one_call") {
        const modelStartedAt = Date.now();
        generativeResult = await generateEventCenteredTurnOnceAI(generativeInput);
        timing.visibleResponseModelMs = elapsedMs(modelStartedAt);
      } else {
        const inputFingerprint = eventCenteredGenerativeInputFingerprint(generativeInput);
        let planStage: EventCenteredGenerativeSemanticPlanStageResult | undefined;
        if (resumedGenerativeCheckpoint) {
          if (resumedGenerativeCheckpoint.inputFingerprint !== inputFingerprint) {
            throw new Error("EVENT_GENERATIVE_PLAN_CHECKPOINT_INPUT_MISMATCH");
          }
        } else {
          const semanticModelStartedAt = Date.now();
          planStage = await generateEventCenteredGenerativeSemanticPlanAI(generativeInput);
          timing.semanticModelMs = elapsedMs(semanticModelStartedAt);
          if (planStage.artifact) {
            resumedGenerativeCheckpoint = await persistEventCenteredGenerativePlanCheckpoint({
              userId,
              userTurnId: reservation.turn.id,
              rootSessionId: reservation.rootSessionId,
              activeBranchSessionId: reservation.activeBranchSessionId,
              eventId: reservation.eventId,
              branchStateId: reservation.branchStateId,
              inputFingerprint,
              artifactVersion: planStage.artifact.artifactVersion,
              strategyVersion: planStage.artifact.strategyVersion,
              angleCardVersion: planStage.artifact.angleCardVersion,
              fewShotVersion: planStage.artifact.fewShotVersion,
              promptVersion: planStage.artifact.promptVersion,
              artifact: planStage.artifact as unknown as Record<string, unknown>
            });
          } else {
            generativeResult = {
              ...planStage,
              turn: null,
              semanticArtifact: null,
              architecture: "two_call"
            };
          }
        }
        if (resumedGenerativeCheckpoint) {
          const artifact = semanticPlanArtifactFromCheckpoint(resumedGenerativeCheckpoint);
          const visibleModelStartedAt = Date.now();
          generativeResult = await generateVisibleTurnFromFrozenPlan({
            generationInput: generativeInput,
            artifact,
            planStage
          });
          timing.visibleResponseModelMs = elapsedMs(visibleModelStartedAt);
        }
      }
    }
    const generativeRuntimeFallback = Boolean(
      generativeAttempted &&
      !generativeResult?.turn &&
      !gi066ThoughtExecution &&
      !deterministicControlOnly &&
      !preservesCurrentQuestionDeterministically
    );
    const deepEntryRuntimeFallback = startsDeepMicrogoal && generativeRuntimeFallback;
    const effectiveStrategyForTurn = eventRecordingRecognition
      ? "baseline"
      : deterministicUnableAnswerHandling
        ? "baseline"
      : generativeRuntimeFallback
        ? "baseline"
        : generativeEnabled
          ? "generative"
          : "baseline";
    const generativeRepairWasApplied = generativeAttempted && (
      generativeRepairApplied(generativeResult) || Boolean(gi066ThoughtExecution?.repaired)
    );
    const generativeFallbackStage = generativeRuntimeFallback
      ? generativeFailureStage({
          architecture: generativeArchitecture,
          result: generativeResult
        })
      : null;
    const generativeFallbackCode = generativeRuntimeFallback
      ? generativeFailureCode(generativeResult)
      : null;
    if (thoughtOnly && generativeRuntimeFallback && generativeFallbackCode) {
      throw new EventCenteredGenerationBlockedError(
        classifyEventCenteredGenerationFailure(generativeFallbackCode),
        generativeFallbackCode
      );
    }
    if (
      generativeRuntimeFallback &&
      (checkpointBeforeGeneration || resumedGenerativeCheckpoint)
    ) {
      await discardEventCenteredGenerativePlanCheckpoint({
        userId,
        userTurnId: reservation.turn.id,
        rootSessionId: reservation.rootSessionId,
        activeBranchSessionId: reservation.activeBranchSessionId,
        eventId: reservation.eventId,
        branchStateId: reservation.branchStateId
      });
      resumedGenerativeCheckpoint = null;
    }
    const generativeTurn = generativeResult?.turn ?? null;
    const generativeDeterministicFallback = generativeEnabled &&
      (
        deterministicControlOnly ||
        preservesCurrentQuestionDeterministically ||
        deterministicUnableAnswerHandling ||
        deepEntryRuntimeFallback
      ) &&
      !generativeTurn;
    const understandingResult = gi066ThoughtExecution
      ? {
          decision: thoughtUpdateUnderstandingDecision(gi066ThoughtExecution.mapUpdate),
          outputOrigin: "llm" as const,
          attempts: [],
          promptLineage: []
        }
      : generativeTurn
      ? {
          decision: toEventCenteredUnderstandingDecision({
            turn: generativeTurn,
            rawText,
            facts: factProjection.facts
          }),
          outputOrigin: generativeResult?.outputOrigin ?? "llm" as const,
          attempts: generativeResult?.attempts ?? [],
          promptLineage: generativeResult?.promptLineage ?? []
        }
      : deterministicControlOnly || preservesCurrentQuestionDeterministically || deterministicUnableAnswerHandling
        ? {
            decision: controlUnderstandingDecision({ action: effectiveRequest.action, rawText }),
            outputOrigin: "deterministic" as const,
            attempts: [],
            promptLineage: []
          }
        : eventRecordingRecognition
          ? await understandEventCenteredTurnAI({
              rawText,
              phase: state.phase,
              activeAngle: state.activeAngle,
              currentQuestion: answeredQuestionText,
              facts: factProjection.facts,
              allowUnsupportedHypothesis: false,
              provider: null,
              maxAttempts: 1,
              signal: options?.signal
            })
        : await understandEventCenteredTurnAI({
            rawText,
            phase: state.phase,
            activeAngle: state.activeAngle,
            currentQuestion: answeredQuestionText,
            facts: factProjection.facts,
            allowUnsupportedHypothesis:
              effectiveRequest.action === "reply" &&
              (state.phase === "guided_reflection" || state.phase === "deep_companionship"),
            ...(generativeRuntimeFallback
              ? { provider: null, maxAttempts: 1 }
              : {}),
            signal: options?.signal
          });
    let decision = understandingResult.decision;
    if (
      decision.eventBoundary === "another_event" ||
      decision.eventBoundary === "multiple_events"
    ) {
      decision = { ...decision, facts: [], outcomeCandidate: null, unsupportedHypothesis: null };
    }
    const rejectsPendingHypothesis = Boolean(
      state.pendingUnderstandingClaimId &&
      state.currentQuestion?.cognitiveAction === "test_understanding" &&
      (
        decision.answerSignal === "declined" ||
        decision.answerSignal === "unknown" ||
        decision.answerSignal === "correction"
      )
    );
    if (rejectsPendingHypothesis) {
      decision = {
        ...decision,
        answerSignal: "declined",
        outcomeCandidate: null,
        unsupportedHypothesis: null,
        adviceRequest: null
      };
    }
    const correction = !rejectsPendingHypothesis && (
      effectiveRequest.action === "correct_understanding" ||
      decision.answerSignal === "correction" ||
      Boolean(factProjection.pendingClarification)
    );
    const thoughtCorrectionKind = thoughtOnly && correction
      ? gi066ThoughtExecution?.mapUpdate.correction?.kind ?? classifyThoughtCorrectionKind(rawText)
      : null;
    const factRevisionCorrection = correction && (
      !thoughtOnly || thoughtCorrectionKind === "fact_or_judgment"
    );
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
    let confirmedThisTurnFactId: string | null = null;
    if (
      !factRevisionCorrection &&
      !rejectsPendingHypothesis &&
      !bareAngleChange &&
      !continuesWithinBoundary &&
      keepsCurrentEventBoundary
    ) {
      const confirmation = await confirmEventCenteredUnderstandingAfterIntent({
        operation: effectiveOperation(effectiveRequest.action),
        userTurnId: reservation.turn.id,
        activeBranchSessionId: reservation.activeBranchSessionId
      });
      confirmedThisTurnFactId = confirmation.factId;
      const factsRefreshStartedAt = Date.now();
      factProjection = await getEffectiveJournalEventFactProjection(
        reservation.eventId,
        reservation.activeBranchSessionId
      );
      timing.factsAndOutcomesReadMs = addElapsedMs(
        timing.factsAndOutcomesReadMs,
        factsRefreshStartedAt
      );
      turnContext.facts = factProjection;
    }

    let revisionApplied = false;
    if (rejectsPendingHypothesis) {
      await rejectPendingHypothesisDecision({
        userId,
        eventId: reservation.eventId,
        branchSessionId: reservation.activeBranchSessionId,
        branchStateId: reservation.branchStateId,
        turn: reservation,
        rawText,
        decision,
        stateSnapshot: state,
        requestId: options?.requestId
      });
      revisionApplied = true;
      const factsRefreshStartedAt = Date.now();
      factProjection = await getEffectiveJournalEventFactProjection(
        reservation.eventId,
        reservation.activeBranchSessionId
      );
      timing.factsAndOutcomesReadMs = addElapsedMs(
        timing.factsAndOutcomesReadMs,
        factsRefreshStartedAt
      );
      turnContext.facts = factProjection;
    } else if (factRevisionCorrection) {
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
        targetOutcomeMessageId,
        explicitCorrectionAction: effectiveRequest.action === "correct_understanding",
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
      const factsRefreshStartedAt = Date.now();
      factProjection = await getEffectiveJournalEventFactProjection(
        reservation.eventId,
        reservation.activeBranchSessionId
      );
      timing.factsAndOutcomesReadMs = addElapsedMs(
        timing.factsAndOutcomesReadMs,
        factsRefreshStartedAt
      );
      turnContext.facts = factProjection;
      if (correctionResult.kind === "revised" && targetOutcomeMessageId) {
        correctedOutcomeStatement = replacementOutcomeStatement({ rawText, decision });
        const angleProjectionStartedAt = Date.now();
        const angleProjection = await getEffectiveJournalEventAngleProjection(
          reservation.eventId,
          reservation.activeBranchSessionId
        );
        timing.factsAndOutcomesReadMs = addElapsedMs(
          timing.factsAndOutcomesReadMs,
          angleProjectionStartedAt
        );
        turnContext.angleProjection = angleProjection;
        angleRepairResolutions = correctionAngleRepairResolutions({
          projection: angleProjection,
          revisionId: correctionResult.result.revisionId,
          replacementStatement: correctedOutcomeStatement
        });
      }
    }

    const effectiveGenerativeTurn = generativeTurn
      ? {
          ...generativeTurn,
          understanding: {
            ...generativeTurn.understanding,
            answerStatus: rejectsPendingHypothesis
              ? "declined"
              : generativeTurn.understanding.answerStatus,
            tentativeInterpretation: correction || rejectsPendingHypothesis
              ? null
              : generativeTurn.understanding.tentativeInterpretation
          },
          decision: {
            ...generativeTurn.decision,
            outcomeCandidate: correction || rejectsPendingHypothesis
              ? null
              : generativeTurn.decision.outcomeCandidate
          }
        }
      : null;
    const policy = gi066ThoughtExecution
      ? applyGI066ThoughtPolicy({
          state,
          protocol: gi066ThoughtExecution.protocol,
          plan: gi066ThoughtExecution.plan,
          expression: gi066ThoughtExecution.expression,
          relationCandidate: gi066ThoughtExecution.mapUpdate.relationCandidate
        })
      : effectiveGenerativeTurn
        ? applyGenerativeEventCenteredTurnPolicy({
          state,
          action: effectiveRequest.action,
          selectedAngle: effectiveRequest.angle,
          rawText,
          facts: factProjection.facts,
          turn: effectiveGenerativeTurn,
          strategyVersion: completeResponseFirstEnabled
            ? generativeResult?.strategyVersion
            : undefined
        })
        : decideEventCenteredTurnPolicy({
          state,
          // 深聊入口的自然表达已经确定“继续当前角度”的用户意愿。生成式
          // 表达被质量门拦截后，仍要确定性地产生首个深聊问题，避免回到
          // 第二检查点并要求用户重复选择。
          action: deepEntryRuntimeFallback
            ? "continue_exploration"
            : effectiveRequest.action,
          rawText,
          selectedAngle: effectiveRequest.angle,
          selectedEventOptionId: effectiveRequest.optionId,
          regenerationIntent: effectiveRequest.regenerationIntent,
          currentQuestionText: answeredQuestionText,
          facts: factProjection.facts,
          confirmedThisTurnFactId,
          understanding: decision,
          bareAngleChange
        });
    if (
      deepEntryRuntimeFallback &&
      generativeAngle &&
      policy.nextState.currentQuestion
    ) {
      policy.nextState.currentMicrogoal = {
        id: `microgoal:${generativeAngle}:deep_open_point:${reservation.turn.id}`,
        angle: generativeAngle,
        statement: rawText.trim().slice(0, 240) || "继续深入当前角度",
        questionCount: 1,
        answerCount: 0,
        status: "active",
        evidenceRefs: [...new Set([
          ...(confirmedThisTurnFactId ? [confirmedThisTurnFactId] : []),
          ...(priorAngleOutcome?.facts.map((fact) => fact.factId) ?? [])
        ])]
      };
    }
    const localDeterministicRepairApplied = Boolean(
      policy.localDeterministicRepairApplied ||
      generativeResult?.qualityDiagnostics?.some((issue) =>
        issue.startsWith("local_deterministic_thinking_summary_repair:")
      )
    );
    const isGenerativeQuestionRepair = Boolean(
      effectiveGenerativeTurn &&
      policy.directive.responseKind === "repair" &&
      state.currentQuestion &&
      policy.nextState.currentQuestion &&
      policy.nextState.currentQuestion.target === state.currentQuestion.target &&
      policy.nextState.currentQuestion.surfaceLevel === "concrete_anchor"
    );
    if (isGenerativeQuestionRepair && state.currentQuestion && policy.nextState.currentQuestion) {
      policy.nextState.currentQuestion.opportunityNumber = state.currentQuestion.opportunityNumber;
      const repairedAngle = state.currentQuestion.angle;
      if (repairedAngle) {
        const previousRun = state.angleRuns[repairedAngle];
        const nextRun = policy.nextState.angleRuns[repairedAngle];
        if (previousRun && nextRun) {
          nextRun.questionOpportunityCount = previousRun.questionOpportunityCount;
        }
      }
      if (state.currentMicrogoal && policy.nextState.currentMicrogoal) {
        policy.nextState.currentMicrogoal.questionCount = state.currentMicrogoal.questionCount;
      }
    }
    if (rejectsPendingHypothesis) {
      policy.nextState.pendingUnderstandingClaimId = null;
    }
    const assistantMessageId = randomUUID();
    if (policy.nextState.currentQuestion) {
      policy.nextState.currentQuestion.assistantMessageId = assistantMessageId;
    }
    const committedOutcome = correction ? null : angleOutcomeDraft(policy);
    if (committedOutcome) decision = { ...decision, unsupportedHypothesis: null };

    await options?.onPhase?.("responding");
    const responseResult = gi066ThoughtExecution
      ? {
          payload: {
            naturalUnderstanding: gi066ThoughtExecution.expression?.thinkingSummary ?? "",
            naturalResponse: policy.directive.exactResponse,
            responseKind: policy.directive.responseKind,
            questionSpec: policy.directive.questionSpec,
            checkpoint: policy.directive.checkpoint,
            angleOutcome: policy.directive.angleOutcome
          },
          outputOrigin: gi066ThoughtExecution.plan.action === "ask"
            ? "llm" as const
            : "deterministic" as const,
          attempts: gi066ThoughtExecution.attempts,
          promptLineage: gi066ThoughtExecution.promptLineage
        }
      : effectiveGenerativeTurn
        ? {
          payload: createGenerativeEventCenteredPayload({
            turn: effectiveGenerativeTurn,
            policy,
            completeResponseFirst: completeResponseFirstEnabled
          }),
          outputOrigin: "llm" as const,
          attempts: [],
          promptLineage: []
          }
        : eventRecordingRecognition
        ? {
            payload: {
              naturalUnderstanding: eventRecordingUnderstanding({
                correction,
                answerSignal: decision.answerSignal,
                eventBoundary: decision.eventBoundary
              }),
              naturalResponse: policy.directive.exactResponse,
              responseKind: policy.directive.responseKind,
              questionSpec: policy.directive.questionSpec,
              checkpoint: policy.directive.checkpoint,
              angleOutcome: policy.directive.angleOutcome
            },
            outputOrigin: "deterministic" as const,
            attempts: [],
            promptLineage: []
          }
      : deterministicUnableAnswerHandling
        ? {
            payload: {
              naturalUnderstanding: localDeterministicRepairApplied
                ? "你暂时还说不清这一部分，我换成一个更具体的入口。"
                : "好，这一部分先停在这里。",
              naturalResponse: policy.directive.exactResponse,
              responseKind: policy.directive.responseKind,
              questionSpec: policy.directive.questionSpec,
              checkpoint: policy.directive.checkpoint,
              angleOutcome: policy.directive.angleOutcome
            },
            outputOrigin: "deterministic" as const,
            attempts: [],
            promptLineage: []
          }
      : generativeDeterministicFallback
        ? {
            payload: {
              naturalUnderstanding: bareAngleChange
                ? "你想换一个观察入口，我先保留当前问题和进度。"
                : continuesWithinBoundary
                  ? "你愿意继续，也希望这部分保持在你愿意说的范围内。"
                  : effectiveRequest.action === "select_current_event"
                    ? "这件事先作为当前记录。"
                    : effectiveRequest.action === "select_exploration_angle"
                      ? "我们从你选择的角度继续。"
                      : "我们沿着刚才的线索继续。",
              naturalResponse: policy.directive.exactResponse,
              responseKind: policy.directive.responseKind,
              questionSpec: policy.directive.questionSpec,
              checkpoint: policy.directive.checkpoint,
              angleOutcome: policy.directive.angleOutcome
            },
            outputOrigin: "fallback" as const,
            attempts: [],
            promptLineage: []
          }
        : await realizeEventCenteredTurnAI({
            rawText,
            phase: state.phase,
            activeAngle: state.activeAngle,
            currentQuestion: answeredQuestionText,
            currentQuestionTarget: answeredQuestionTarget,
            decision,
            directive: policy.directive,
            ...(generativeRuntimeFallback
              ? { provider: null, maxAttempts: 1 }
              : {}),
            signal: options?.signal
          });
    const firstCheckpointPresentation = policy.directive.checkpoint?.kind === "first"
      ? getEventCenteredFirstCheckpointPresentation({
          rawText,
          decision,
          currentQuestionText: answeredQuestionText,
          currentQuestionTarget: answeredQuestionTarget
        })
      : null;
    const boundaryUnderstanding = getEventCenteredTextBoundaryUnderstanding({
      rawText,
      currentQuestionText: answeredQuestionText,
      currentQuestionTarget: answeredQuestionTarget
    });
    const correctionRepairApplied = Boolean(
      correction &&
      effectiveGenerativeTurn &&
      !responseAcknowledgesCorrection(responseResult.payload.naturalUnderstanding)
    );
    const responsePayloadForQuality = correctionRepairApplied
      ? {
          ...responseResult.payload,
          naturalUnderstanding: [
            "我已按新信息调整理解。",
            responseResult.payload.naturalUnderstanding
          ].filter(Boolean).join("")
        }
      : responseResult.payload;
    const quality = runEventCenteredTurnQualityGate({
      payload: responsePayloadForQuality,
      previousAssistantResponses: before.messages
        .filter((message) => message.role === "assistant")
        .map(displayWorkspaceMessage),
      adviceRequested: Boolean(decision.adviceRequest),
      pendingHypothesisStatement: decision.unsupportedHypothesis?.statement ?? null,
      firstCheckpointUnderstanding: firstCheckpointPresentation?.understanding ?? null
    });
    let responsePayload: EventCenteredAssistantPayload = responsePayloadForQuality;
    if (!quality.passed) {
      if (thoughtOnly && generativeAttempted) {
        throw new EventCenteredGenerationBlockedError(
          "content_check",
          quality.safetyBlockers[0] ?? quality.qualityIssues[0] ?? "EVENT_CENTERED_VISIBLE_CONTENT_REJECTED"
        );
      }
      responsePayload = createSafeEventCenteredPayload({
        payload: responsePayloadForQuality,
        exactResponse: policy.directive.exactResponse,
        firstCheckpointUnderstanding: firstCheckpointPresentation?.safeFallback ?? null,
        boundaryUnderstanding,
        acknowledgeBoundaryContinuation: quality.safetyBlockers.length > 0 &&
          continuesWithinBoundary
      });
      decision = { ...decision, unsupportedHypothesis: null };
    }
    if (angleRepairResolutions.length > 0 && !thoughtOnly) {
      const reopened = angleRepairResolutions.some((resolution) =>
        resolution.decision === "reopen"
      );
      responsePayload = {
        naturalUnderstanding: "",
        naturalResponse: reopened
          ? "好，这个理解先撤回。我们回到刚才的角度。"
          : `好，我按你更准确的理解记下：${correctedOutcomeStatement}`,
        responseKind: reopened ? "checkpoint" : "angle_outcome",
        questionSpec: null,
        checkpoint: { kind: "second", outcome: null },
        angleOutcome: null
      };
      policy.nextState.phase = "checkpoint_two";
      policy.nextState.currentQuestion = null;
      if (reopened) policy.nextState.lastCompletedAngle = null;
    }
    if (responsePayload.presentation !== "hidden") {
      await options?.onDelta?.("summary", responsePayload.naturalUnderstanding);
      await options?.onDelta?.("response", responsePayload.naturalResponse);
    }
    // 隐藏完成标记不会生成 AI 气泡；用户真正看到的是提交完成后的第二检查点。
    // 这类回合的“完整文本可见”时间在最终工作区恢复后与可操作时间对齐。
    timing.visibleResponseReadyMs = responsePayload.presentation === "hidden"
      ? null
      : elapsedMs(responseStartedAt);
    const modelMs = [timing.semanticModelMs, timing.visibleResponseModelMs]
      .filter((value): value is number => value !== null)
      .reduce((total, value) => total + value, 0);
    const hasModelTiming = timing.semanticModelMs !== null ||
      timing.visibleResponseModelMs !== null;
    let nonModelMs: number | null = null;
    await options?.onPhase?.("committing");

    const facts = revisionApplied
      ? []
      : turnFactWrites({
          decision,
          projection: factProjection,
          turnId: reservation.turn.id,
          userMessageId: reservation.userMessageId,
          action: effectiveRequest.action,
          contextMessageId: answeredQuestionMessageId
        });
    const pendingClaim = committedOutcome ? null : decision.unsupportedHypothesis;
    const traceAttempts = [
      ...(generativeRuntimeFallback ? generativeResult?.attempts ?? [] : []),
      ...understandingResult.attempts,
      ...responseResult.attempts
    ];
    const providerAttemptCount = traceAttempts.filter(
      (attempt) => attempt.provider !== "disabled"
    ).length;
    const deterministicAttemptCount = traceAttempts.filter(
      (attempt) => attempt.provider === "disabled"
    ).length;
    const writeCommitStartedAt = Date.now();
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
      focusSummary: responsePayload.naturalUnderstanding ||
        responsePayload.naturalResponse ||
        committedOutcome?.statement ||
        decision.facts.at(-1)?.statement ||
        "当前角度成果已更新",
      snapshotData: policy.nextState,
      trace: {
        requestId: options?.requestId ?? null,
        outputOrigin: generativeRuntimeFallback
          ? "fallback"
          : combineOutputOrigin(
              understandingResult.outputOrigin,
              responseResult.outputOrigin
            ),
        contextSnapshot: {
          strategyMode: eventRecordingRecognition ? "event_recording" :
            deterministicUnableAnswerHandling ? "deterministic_repair" :
            generativeEnabled ? "generative" : "baseline",
          requestedStrategy: requestedStrategyForTurn,
          effectiveStrategy: effectiveStrategyForTurn,
          generativeAttempted,
          deterministicControlAction,
          eventRecordingRecognition,
          correctionRepairApplied,
          generativeRepairApplied: generativeRepairWasApplied,
          localDeterministicRepairApplied,
          generativeFailureStage: generativeFallbackStage,
          generativeFailureCode: generativeFallbackCode,
          strategyVersion: generativeResult?.strategyVersion ??
            (generativeAttempted ? EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION : null),
          generativeArchitecture: gi066ThoughtExecution
            ? "thought_map_system_route_visible"
            : generativeResult?.architecture ?? null,
          angleCardVersion: gi066ThoughtExecution
            ? EVENT_CENTERED_ANGLE_CARD_VERSION
            : generativeResult?.angleCardVersion ?? null,
          fewShotVersion: gi066ThoughtExecution
            ? EVENT_CENTERED_FEW_SHOT_VERSION
            : generativeResult?.fewShotVersion ?? null,
          fewShotIds: generativeResult?.fewShotIds ?? [],
          phase: state.phase,
          activeAngle: state.activeAngle,
          currentQuestionTarget: answeredQuestionTarget,
          currentQuestionSurfaceLevel: answeredQuestionSurfaceLevel,
          currentQuestionCognitiveAction: state.currentQuestion?.cognitiveAction ?? null,
          currentMicrogoal: state.currentMicrogoal,
          recentContextMessageIds: before.messages.slice(-6).map((message) => message.id),
          effectiveFactIds: factProjection.effectiveFactIds,
          providerAttemptCount,
          deterministicAttemptCount,
          initialWorkspaceReadMs: timing.initialWorkspaceReadMs,
          turnReservationPersistenceMs: timing.turnReservationPersistenceMs,
          factsAndOutcomesReadMs: timing.factsAndOutcomesReadMs,
          semanticModelMs: timing.semanticModelMs,
          visibleResponseModelMs: timing.visibleResponseModelMs,
          modelMs: hasModelTiming ? modelMs : null,
          nonModelMs: hasModelTiming && timing.visibleResponseReadyMs !== null
            ? Math.max(0, timing.visibleResponseReadyMs - modelMs)
            : null,
          visibleResponseReadyMs: timing.visibleResponseReadyMs,
          writeCommitMs: timing.writeCommitMs,
          finalWorkspaceRecoveryMs: timing.finalWorkspaceRecoveryMs,
          promptLineage: [
            ...(generativeRuntimeFallback ? generativeResult?.promptLineage ?? [] : []),
            ...understandingResult.promptLineage,
            ...responseResult.promptLineage
          ]
        },
        finalOutput: {
          understanding: decision,
          generativeDecision: effectiveGenerativeTurn?.decision ?? null,
          generativeUnderstandingCard:
            generativeResult?.semanticArtifact?.understandingCard ?? null,
          generativeQuestionIntent:
            generativeResult?.semanticArtifact?.questionIntent ?? null,
          generativeLimitReason: generativeResult?.semanticArtifact?.limitReason ?? null,
          generativeSemanticPlan: effectiveGenerativeTurn?.semanticPlan ?? null,
          generativeVisibleTurn: effectiveGenerativeTurn?.visibleTurn ?? null,
          thoughtDecision: gi066ThoughtExecution
            ? {
                action: gi066ThoughtExecution.plan.action,
                direction: gi066ThoughtExecution.plan.direction,
                operation: gi066ThoughtExecution.plan.operation,
                planHash: gi066ThoughtExecution.plan.planHash,
                routeReason: gi066ThoughtExecution.plan.routeReason,
                targetStatuses: Object.fromEntries(Object.entries(
                  gi066ThoughtExecution.protocol.targets
                ).map(([direction, target]) => [direction, target.status])),
                insightIncrementKinds: gi066ThoughtExecution.protocol.insightIncrements
                  .map((increment) => increment.kind),
                expressionRepairApplied: gi066ThoughtExecution.repaired
              }
            : null,
          assistant: responsePayload
        },
        pipelineDecisions: [
          { kind: "event_centered_policy", nextState: policy.nextState },
          {
            kind: "event_centered_generative_validation",
            strategyMode: eventRecordingRecognition ? "event_recording" :
              deterministicUnableAnswerHandling ? "deterministic_repair" :
              generativeEnabled ? "generative" : "baseline",
            issues: generativeResult?.validationIssues ?? [],
            deterministicFallback: generativeDeterministicFallback,
            runtimeFallback: generativeRuntimeFallback,
            generativeAttempted,
            deterministicControlAction,
            eventRecordingRecognition,
            correctionRepairApplied,
            generativeRepairApplied: generativeRepairWasApplied,
            localDeterministicRepairApplied
          },
          {
            kind: "event_centered_strategy_resolution",
            requestedStrategy: requestedStrategyForTurn,
            effectiveStrategy: effectiveStrategyForTurn,
            generativeAttempted,
            deterministicControlAction,
            eventRecordingRecognition,
            correctionRepairApplied,
            generativeRepairApplied: generativeRepairWasApplied,
            localDeterministicRepairApplied,
            strategyVersion: generativeResult?.strategyVersion ??
              (generativeAttempted ? EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION : null),
            failedStage: generativeFallbackStage,
            errorCode: generativeFallbackCode,
            finalAssistant: responsePayload
          },
          {
            kind: "event_centered_generative_quality_diagnostics",
            issues: generativeResult?.qualityDiagnostics ?? []
          },
          {
            kind: "event_centered_gi066_thought_route",
            applied: Boolean(gi066ThoughtExecution),
            action: gi066ThoughtExecution?.plan.action ?? null,
            direction: gi066ThoughtExecution?.plan.direction ?? null,
            operation: gi066ThoughtExecution?.plan.operation ?? null,
            planHash: gi066ThoughtExecution?.plan.planHash ?? null,
            routeReason: gi066ThoughtExecution?.plan.routeReason ?? null,
            expressionRepairApplied: gi066ThoughtExecution?.repaired ?? false,
            invalidatedSourceCount:
              gi066ThoughtExecution?.protocol.invalidatedSourceRefs.length ?? 0,
            invalidatedRelationCount:
              gi066ThoughtExecution?.protocol.invalidatedRelationKeys.length ?? 0,
            invalidatedOutcomeCount:
              gi066ThoughtExecution?.protocol.invalidatedOutcomeIds.length ?? 0
          },
          {
            kind: "event_centered_ai_attempts",
            attempts: traceAttempts,
            providerAttemptCount,
            deterministicAttemptCount
          },
          { kind: "event_centered_turn_quality", ...quality }
        ]
      },
      checks: {
        eventBoundaryPassed:
          (decision.eventBoundary !== "another_event" && decision.eventBoundary !== "multiple_events") ||
          decision.facts.length === 0,
        factsHaveUserSource: decision.facts
          .every((fact) => rawText.includes(fact.quote)),
        visibleUnderstandingMatchesClaim:
          !pendingClaim || responsePayload.naturalUnderstanding.includes(pendingClaim.statement),
        unsupportedClaimCount: pendingClaim ? 1 : 0
      },
      angleOutcome: committedOutcome,
      angleRepairResolutions
    });
    timing.writeCommitMs = elapsedMs(writeCommitStartedAt);
    const reachedCheckpoint = effectiveGenerativeTurn?.semanticPlan?.action === "pause" ||
      (!effectiveGenerativeTurn && state.phase === "deep_companionship" &&
        (policy.directive.checkpoint || policy.nextState.currentQuestion === null))
      ? "deep_pause" as const
      : policy.directive.checkpoint?.kind ?? null;
    if (reachedCheckpoint) {
      await recordEventCenteredAnalyticsEvent({
        eventName: "event_centered_checkpoint_reached",
        userId,
        dedupeKey: [
          "event_centered_checkpoint_reached",
          reservation.rootSessionId,
          reachedCheckpoint,
          state.activeAngle ?? "record"
        ].join(":"),
        rootSessionId: reservation.rootSessionId,
        journalEventId: reservation.eventId,
        requestId: options?.requestId ?? null,
        entryDate: before.identity.entryDate,
        stage: policy.nextState.phase,
        angle: state.activeAngle,
        checkpoint: reachedCheckpoint
      });
    }
    if (generativeRuntimeFallback) {
      await recordEventCenteredAnalyticsEvent({
        eventName: "event_centered_turn_fallback",
        userId,
        dedupeKey: `event_centered_turn_fallback:${reservation.turn.id}`,
        rootSessionId: reservation.rootSessionId,
        journalEventId: reservation.eventId,
        requestId: options?.requestId ?? null,
        entryDate: before.identity.entryDate,
        stage: state.phase,
        angle: state.activeAngle,
        requestedStrategy: "generative",
        effectiveStrategy: "baseline",
        strategyVersion: generativeResult?.strategyVersion ?? EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
        generativeAttempted: true,
        failedStage: generativeFallbackStage,
        errorCode: generativeFallbackCode,
        attemptCount: traceAttempts.filter(
          (attempt) => attempt.provider !== "disabled"
        ).length,
        latencyMs: Math.max(0, Date.now() - generativeStartedAt)
      });
    }
    if (resumedGenerativeCheckpoint) {
      await consumeEventCenteredGenerativePlanCheckpoint({
        userId,
        userTurnId: reservation.turn.id,
        rootSessionId: reservation.rootSessionId,
        activeBranchSessionId: reservation.activeBranchSessionId,
        eventId: reservation.eventId,
        branchStateId: reservation.branchStateId
      });
    }
    const finalWorkspaceStartedAt = Date.now();
    const workspace = await getEventCenteredInterviewWorkspace(userId, request.rootSessionId);
    timing.finalWorkspaceRecoveryMs = elapsedMs(finalWorkspaceStartedAt);
    if (!workspace) throw new Error("SESSION_NOT_FOUND");
    timing.interactiveReadyMs = elapsedMs(responseStartedAt);
    if (responsePayload.presentation === "hidden") {
      timing.visibleResponseReadyMs = timing.interactiveReadyMs;
    }
    nonModelMs = hasModelTiming && timing.interactiveReadyMs !== null
      ? Math.max(0, timing.interactiveReadyMs - modelMs)
      : null;
    turnContext.timing = {
      ...timing,
      semanticModelMs: timing.semanticModelMs,
      visibleResponseModelMs: timing.visibleResponseModelMs
    };
    await recordEventCenteredAnalyticsEvent({
      eventName: "event_centered_response_completed",
      userId,
      dedupeKey: `event_centered_response_completed:${reservation.turn.id}`,
      rootSessionId: reservation.rootSessionId,
      journalEventId: reservation.eventId,
      requestId: options?.requestId ?? null,
      entryDate: before.identity.entryDate,
      stage: policy.nextState.phase,
      angle: state.activeAngle,
      checkpoint: reachedCheckpoint,
      requestedStrategy: requestedStrategyForTurn,
      effectiveStrategy: effectiveStrategyForTurn,
      strategyVersion: generativeResult?.strategyVersion ??
        (generativeAttempted ? EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION : null),
      generativeAttempted,
      deterministicControlAction,
      eventRecordingRecognition,
      correctionRepairApplied,
      generativeRepairApplied: generativeRepairWasApplied,
      localDeterministicRepairApplied,
      failedStage: generativeFallbackStage,
      errorCode: generativeFallbackCode,
      attemptCount: providerAttemptCount,
      latencyMs: timing.interactiveReadyMs,
      visibleResponseReadyMs: timing.visibleResponseReadyMs,
      interactiveReadyMs: timing.interactiveReadyMs,
      initialWorkspaceReadMs: timing.initialWorkspaceReadMs,
      turnReservationPersistenceMs: timing.turnReservationPersistenceMs,
      factsAndOutcomesReadMs: timing.factsAndOutcomesReadMs,
      semanticModelMs: timing.semanticModelMs,
      visibleResponseModelMs: timing.visibleResponseModelMs,
      modelMs: hasModelTiming ? modelMs : null,
      nonModelMs,
      writeCommitMs: timing.writeCommitMs,
      finalWorkspaceRecoveryMs: timing.finalWorkspaceRecoveryMs
    });
    await options?.onPhase?.("complete");
    return { workspace, assistantPayload: responsePayload };
  } catch (error) {
    await markEventCenteredTurnUnderstandingFailed(
      reservation.turn.id,
      options?.signal?.aborted
        ? "REQUEST_CANCELED"
        : error instanceof EventCenteredGenerationBlockedError
          ? error.detailCode
          : error instanceof Error
            ? error.message
            : "EVENT_TURN_FAILED"
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
