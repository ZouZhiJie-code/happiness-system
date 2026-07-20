import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { getAssistantDisplayParts } from "@/features/joy-interview/assistant-turn";
import { assessDimensionEvidence, canGenerateFromEvidence } from "@/features/interview/dimension-evidence";
import { buildDimensionSemanticInterpretation } from "@/features/interview/server/semantic-interpretation";
import {
  assessUserTurnMessage,
  deriveDepthReachedFromSnapshot,
  isDraftOverrideRequestedFromBoundary,
  summarizeInterviewProgress
} from "@/features/joy-interview/server/interview-progress";
import {
  applyQuestionSurfaceProtocol,
  createQuestionSpec,
  inferQuestionSpecFromQuestion,
  resolveQuestionFromSpec,
  renderDeterministicRepairTurn
} from "@/features/joy-interview/server/question-protocol";
import {
  applyExplicitEvidenceRevisions,
  buildEvidenceRevisionThinkingSummary,
  detectExplicitEvidenceRevisions
} from "@/features/joy-interview/server/evidence-revision";
import {
  buildAssistantQuestion,
  hasCredibleFulfillmentProgressEvidence,
  hasCredibleFulfillmentValueSignal,
  getDelightSignature,
  getInactiveSessionMessage,
  getJoyTrack,
  getJoyMoment,
  getJoySource,
  getManualClue,
  getMeaningNeed,
  getNextStage,
  getOpeningQuestion,
  resolveFulfillmentQuestionTarget,
  getStateShift
} from "@/features/joy-interview/server/joy-interview-engine";
import {
  appendJoyInterviewTurn,
  cancelInterviewUserTurn,
  completeJoyInterviewSessionRecord,
  createJoyInterviewSession,
  findJoyInterviewSessionById,
  markInterviewUserTurnFailed,
  markJoyEntrySaved,
  pauseJoyInterviewSessionRecord,
  reopenJoyInterviewSessionRecord,
  reserveInterviewUserTurn,
  resumeInterviewUserTurn,
  resumeCurrentInterviewEvent,
  saveJoyInterviewDraft,
  startNextInterviewEvent
} from "@/server/repositories/joy-interview.repository";
import {
  appendGenerationTraceDecision,
  cancelGenerationTrace,
  createAIGenerationTrace,
  failGenerationTrace
} from "@/server/repositories/ai-quality.repository";
import { recordAnalyticsEvent } from "@/server/repositories/admin-analytics.repository";
import {
  extractJoySnapshotWithAI,
  generateJoyAssistantTurn,
  streamJoyAssistantTurn,
  generateJoyDraftWithAI
} from "@/server/services/interview/joy-interview-ai.service";
import { extractMemoriesFromSession } from "@/server/services/memory/memory-extraction.service";
import { retrieveRelevantMemories } from "@/server/services/memory/memory-retrieval.service";
import type {
  AssistantQuestionSpec,
  AssistantTurnPayload,
  DraftCompletionMode,
  GratitudeQuestionSubTarget,
  InputMode,
  InferenceEvidenceState,
  InterviewDimension,
  InterviewEventRecord,
  InterviewLens,
  InterviewMessage,
  InterviewSessionRecord,
  InterviewUserTurnAction,
  InterviewUserTurnRecord,
  JoyInterviewStage,
  JoySnapshot
} from "@/types/interview";

type InterviewRespondInput =
  | {
      userId: string;
      requestId?: string;
      action: "reply";
      sessionId: string;
      userMessage: string;
      rawText?: string;
      inputMode: InputMode;
      clientTurnId?: string;
      baseMessageSequence?: number;
    }
  | {
      userId: string;
      requestId?: string;
      action: "continue";
      sessionId: string;
      clientTurnId?: string;
      baseMessageSequence?: number;
    }
  | {
      userId: string;
      requestId?: string;
      action: "continue_current_event";
      sessionId: string;
      clientTurnId?: string;
      baseMessageSequence?: number;
    }
  | {
      userId: string;
      requestId?: string;
      action: "next_event";
      sessionId: string;
      clientTurnId?: string;
      baseMessageSequence?: number;
    }
  | {
      userId: string;
      requestId?: string;
      action: "resume_turn";
      sessionId: string;
      clientTurnId: string;
    };

type StreamingPhase = "thinking" | "summary" | "question";
type StreamingTarget = "summary" | "question";
type CanonicalInterviewAction = "reply" | "continue_current_event" | "repair_current_question" | "next_event";
const SUMMARY_STREAM_CHUNK_SIZE = 22;
type InterviewDecisionProgressData =
  | {
      kind: "event_complete";
      completionMode?: DraftCompletionMode;
    }
  | {
      kind: "dimension_redirect";
      targetDimension: "improvement";
      reason: string;
    }
  | {
      kind: "boundary_insufficient";
      reason: string;
    };

async function recordUserTurnLifecycleEvent(input: {
  eventName:
    | "user_turn_submitted"
    | "user_turn_completed"
    | "user_turn_canceled"
    | "user_turn_retried"
    | "user_turn_deduplicated"
    | "user_turn_stale_rejected";
  userId: string;
  sessionId: string;
  requestId?: string | null;
  clientTurnId?: string | null;
  turnId?: string | null;
  action?: InterviewUserTurnAction | null;
  status?: InterviewUserTurnRecord["status"] | null;
  attemptCount?: number | null;
  inputMode?: InputMode | null;
  dimension?: InterviewDimension | null;
}) {
  const dedupeSuffix =
    input.eventName === "user_turn_retried"
      ? `${input.turnId ?? input.clientTurnId}:${input.attemptCount ?? 1}`
      : input.eventName === "user_turn_deduplicated" || input.eventName === "user_turn_stale_rejected"
        ? input.requestId ?? `${input.clientTurnId}:${Date.now()}`
        : input.turnId ?? input.clientTurnId ?? input.requestId ?? `${input.sessionId}:${Date.now()}`;

  try {
    await recordAnalyticsEvent({
      eventName: input.eventName,
      userId: input.userId,
      sessionId: input.sessionId,
      requestId: input.requestId ?? null,
      dedupeKey: `${input.eventName}:${dedupeSuffix}`,
      properties: {
        clientTurnId: input.clientTurnId ?? null,
        turnId: input.turnId ?? null,
        action: input.action ?? null,
        status: input.status ?? null,
        attemptCount: input.attemptCount ?? null,
        inputMode: input.inputMode ?? null,
        dimension: input.dimension ?? null
      }
    });
  } catch {
    // Analytics must not interrupt the interview turn lifecycle.
  }
}

async function recordAcceptedUserTurn(input: InterviewRespondInput, turn: InterviewUserTurnRecord) {
  const eventName =
    turn.status === "completed"
      ? "user_turn_deduplicated"
      : input.action === "resume_turn"
        ? "user_turn_retried"
        : "user_turn_submitted";

  await recordUserTurnLifecycleEvent({
    eventName,
    userId: input.userId,
    sessionId: input.sessionId,
    requestId: input.requestId,
    clientTurnId: turn.clientTurnId,
    turnId: turn.id,
    action: turn.action,
    status: turn.status,
    attemptCount: turn.attemptCount,
    inputMode: turn.inputMode ?? null
  });
}

async function recordRejectedUserTurn(input: InterviewRespondInput, error: unknown) {
  if (!(error instanceof Error)) {
    return;
  }

  const eventName =
    error.message === "INTERVIEW_TURN_OUT_OF_DATE"
      ? "user_turn_stale_rejected"
      : error.message === "INTERVIEW_TURN_IN_PROGRESS" ||
          error.message === "INTERVIEW_TURN_RETRY_REQUIRED"
        ? "user_turn_deduplicated"
        : null;

  if (!eventName) {
    return;
  }

  await recordUserTurnLifecycleEvent({
    eventName,
    userId: input.userId,
    sessionId: input.sessionId,
    requestId: input.requestId,
    clientTurnId: "clientTurnId" in input ? input.clientTurnId ?? null : null,
    action:
      input.action === "resume_turn"
        ? null
        : input.action === "continue"
          ? "continue_current_event"
          : input.action,
    inputMode: input.action === "reply" ? input.inputMode : null
  });
}

function getUserTurnErrorCode(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (/^[A-Z][A-Z0-9_]+$/u.test(error.message)) {
    return error.message;
  }

  return error.name && error.name !== "Error" ? error.name : fallback;
}

export class DraftGenerationError extends Error {
  constructor(
    readonly code:
      | "SESSION_BATCH_UNSUPPORTED"
      | "SESSION_NOT_FOUND"
      | "DRAFT_GENERATE_NOT_READY"
      | "DRAFT_GENERATE_UPSTREAM_ERROR"
      | "DRAFT_GENERATE_DB_ERROR"
      | "DRAFT_GENERATE_UNKNOWN_ERROR",
    readonly retryable: boolean,
    message?: string,
    readonly cause?: unknown
  ) {
    super(message ?? code);
    this.name = "DraftGenerationError";
  }
}

interface PreparedInterviewTurnContext {
  session: InterviewSessionRecord;
  activeEvent: InterviewEventRecord;
  nextSnapshot: JoySnapshot;
  nextTurnCount: number;
  nextEventTurnCount: number;
  nextStage: JoyInterviewStage;
  nextEventStatus: InterviewEventRecord["status"];
  nextProgressData: InterviewDecisionProgressData | null;
  isReadyForDraft: boolean;
  userMessage: string | null;
  inputMode?: InputMode;
  isMeaningfulReply: boolean;
  coveredLenses: InterviewLens[];
  roundCoveredLenses: InterviewLens[];
  roundMeaningfulReplyCount: number;
  totalMeaningfulReplyCount: number;
  assistantTurn: AssistantTurnPayload | null;
  assistantAction: "reply" | "continue_current_event" | "repair_current_question" | null;
  questionSpec: AssistantQuestionSpec | null;
  generationTraceId: string;
  requestId?: string | null;
  outputOrigin?: "llm" | "deterministic" | "fallback";
  userTurnId: string;
  clientTurnId: string;
  userMessageId: string | null;
}

type ResolvedPreparedInterviewTurn = PreparedInterviewTurnContext & {
  assistantTurn: AssistantTurnPayload;
  assistantAction: null;
};

function getCanonicalAction(action: InterviewRespondInput["action"]): CanonicalInterviewAction {
  if (action === "continue") {
    return "continue_current_event";
  }

  if (action === "resume_turn") {
    throw new Error("INTERVIEW_ACTION_UNSUPPORTED");
  }

  return action;
}

function getActiveEvent(session: InterviewSessionRecord) {
  return (
    session.events.find((event) => event.id === session.activeEventId) ??
    session.events.find((event) => event.status !== "completed") ??
    session.events[session.events.length - 1] ??
    null
  );
}

const REFLECTION_SCENE_QUESTION_PATTERN =
  /(具体(?:的)?(?:经历|对话|事情|片段)|经历或对话|事情或对话|第一次清晰地感受到|那个时刻具体发生了什么)/u;
const DIRECT_NEGATION_PATTERN = /^(没有|没|不是|并没有|没有过)(?:[，,。！？!?]|$)/u;

function createEmptyEvidenceState(): InferenceEvidenceState {
  return {
    targets: {},
    deniedTargets: [],
    deniedHypotheses: [],
    blockedTransitions: []
  };
}

function mergeUniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getEvidenceState(snapshot: JoySnapshot) {
  return snapshot.evidenceState ?? createEmptyEvidenceState();
}

function withEvidenceState(snapshot: JoySnapshot, evidenceState: InferenceEvidenceState): JoySnapshot {
  return {
    ...snapshot,
    evidenceState
  };
}

function markConfirmedTarget(
  state: InferenceEvidenceState,
  target: GratitudeQuestionSubTarget,
  strength: "confirmed" | "weak"
): InferenceEvidenceState {
  return {
    ...state,
    targets: {
      ...state.targets,
      [target]: state.targets[target] === "confirmed" ? "confirmed" : strength
    }
  };
}

function applyGratitudeEvidenceState(input: {
  previous: JoySnapshot;
  next: JoySnapshot;
  questionSpec: AssistantQuestionSpec | null;
  assessment: ReturnType<typeof assessUserTurnMessage>;
}) {
  if (input.questionSpec?.subTarget == null && input.questionSpec?.hypothesisKey == null && !input.next.evidenceState) {
    return input.next;
  }

  const previousState = getEvidenceState(input.previous);
  let nextState = {
    ...previousState,
    targets: { ...previousState.targets },
    deniedTargets: [...previousState.deniedTargets],
    deniedHypotheses: [...previousState.deniedHypotheses],
    blockedTransitions: [...previousState.blockedTransitions]
  };

  if (input.assessment.intent === "hypothesis_denial") {
    if (input.questionSpec?.subTarget) {
      nextState.deniedTargets = mergeUniqueStrings([...nextState.deniedTargets, input.questionSpec.subTarget]) as GratitudeQuestionSubTarget[];
    }

    if (input.questionSpec?.hypothesisKey) {
      nextState.deniedHypotheses = mergeUniqueStrings([...nextState.deniedHypotheses, input.questionSpec.hypothesisKey]) as InferenceEvidenceState["deniedHypotheses"];
    }

    if (input.questionSpec?.subTarget === "relationship_signal") {
      nextState.blockedTransitions = mergeUniqueStrings([...nextState.blockedTransitions, "relationship_signal"]);
    }
  }

  if (input.next.kindAction) {
    nextState = markConfirmedTarget(nextState, "kind_action", "confirmed");
  }

  if (input.next.seenNeed && !nextState.deniedTargets.includes("seen_need")) {
    nextState = markConfirmedTarget(nextState, "seen_need", "confirmed");
  }

  if ((input.next.gratitudeReason ?? input.next.whyItMattered) && !nextState.deniedTargets.includes("gratitude_reason")) {
    nextState = markConfirmedTarget(nextState, "gratitude_reason", "confirmed");
  }

  if ((input.next.relationshipSignal ?? input.next.selfPattern) && !nextState.deniedTargets.includes("relationship_signal")) {
    nextState = markConfirmedTarget(nextState, "relationship_signal", "confirmed");
  }

  const adjustedSnapshot: JoySnapshot = {
    ...input.next,
    seenNeed: nextState.deniedTargets.includes("seen_need") ? null : input.next.seenNeed,
    relationshipSignal: nextState.deniedTargets.includes("relationship_signal") ? null : input.next.relationshipSignal,
    selfPattern: nextState.deniedTargets.includes("relationship_signal") ? null : input.next.selfPattern,
    evidenceState: nextState
  };

  return adjustedSnapshot;
}

function getAssistantQuestionText(message: InterviewMessage) {
  if (message.role !== "assistant") {
    return null;
  }

  const question = getAssistantDisplayParts(message.assistantPayload).question.trim();

  return question || null;
}

function getLatestUserMessageText(messages: InterviewMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "user") {
      const content = message.content.trim();
      return content || null;
    }
  }

  return null;
}

function getLatestAssistantQuestionSpec(messages: InterviewMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role !== "assistant") {
      continue;
    }

    const payload = message.assistantPayload;

    if (payload?.questionSpec) {
      return payload.questionSpec;
    }

    const question = getAssistantQuestionText(message);

    if (!question) {
      continue;
    }

    return inferQuestionSpecFromQuestion({
      dimension: "reflection",
      stage: "probe_pattern",
      snapshot: {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0,
        missingSlots: []
      },
      question
    });
  }

  return null;
}

function normalizeQuestionText(value: string | null | undefined) {
  return value
    ? value.replace(/\s+/g, "").replace(/[，。！？；：,.!?;:“”"'（）()【】\[\]《》]/gu, "")
    : "";
}

function stripQuestionFraming(value: string | null | undefined) {
  let current = value?.trim() ?? "";
  let previous = "";

  while (current && current !== previous) {
    previous = current;
    current = current
      .replace(
        /^(?:如果只(?:留|看|说|收)(?:一个|这一)?点|只(?:留|看|说|收)(?:一个|这一)?点|如果再往里看一点|再往里看一点|先不说别的|先只看这一层|换句话说)[，,、：:\s]*/u,
        ""
      )
      .replace(/[，,、：:\s]*(?:的话|呢|吗|呀|啊)$/u, "")
      .trim();
  }

  return current;
}

function isQuestionFramingOnly(value: string) {
  if (!value) {
    return true;
  }

  return /^(?:如果只(?:留|看|说|收)(?:一个|这一)?点|只(?:留|看|说|收)(?:一个|这一)?点|如果再往里看一点|再往里看一点|先不说别的|先只看这一层|换句话说|的话|呢|吗|呀|啊)+$/u.test(
    value
  );
}

function hasQuestionContainmentWithFramingOnly(longer: string, shorter: string) {
  const startIndex = longer.indexOf(shorter);

  if (startIndex === -1) {
    return false;
  }

  const before = longer.slice(0, startIndex);
  const after = longer.slice(startIndex + shorter.length);

  return isQuestionFramingOnly(before) && isQuestionFramingOnly(after);
}

function isReflectionSceneQuestion(question: string | null | undefined) {
  return Boolean(question && REFLECTION_SCENE_QUESTION_PATTERN.test(question));
}

function areQuestionsEquivalent(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeQuestionText(left);
  const normalizedRight = normalizeQuestionText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const strippedLeft = normalizeQuestionText(stripQuestionFraming(left));
  const strippedRight = normalizeQuestionText(stripQuestionFraming(right));

  if (strippedLeft && strippedRight && strippedLeft === strippedRight) {
    return true;
  }

  return (
    hasQuestionContainmentWithFramingOnly(normalizedLeft, normalizedRight) ||
    hasQuestionContainmentWithFramingOnly(normalizedRight, normalizedLeft)
  );
}

type FulfillmentQuestionValidationCode =
  | "target_mismatch"
  | "semantic_duplicate"
  | "unnatural_phrasing"
  | "too_abstract";

type FulfillmentQuestionIntent = "event_detail" | "progress_evidence" | "value_signal" | "unknown";

function classifyFulfillmentQuestionTarget(question: string): FulfillmentQuestionIntent {
  const normalized = question.replace(/\s+/g, "");

  if (
    /(算数的标准|什么样的努力|什么样的投入|力气花得值|对你来说算数|对你来说值得|值得继续|愿意继续|还想继续|继续这样做|继续做下去)/u.test(
      normalized
    )
  ) {
    return "value_signal";
  }

  if (/(没有白过|不算白过|推进了什么|完成了什么|积累了什么|帮到了什么|有分量的地方)/u.test(normalized)) {
    return "progress_evidence";
  }

  if (/(具体在做什么|那一刻你在做什么|发生了什么)/u.test(normalized)) {
    return "event_detail";
  }

  return "unknown";
}

function isAbstractFulfillmentProgressQuestion(question: string) {
  const normalized = question.replace(/\s+/g, "");

  return /(有什么不同|哪里不一样|这种感觉|这种状态|这种没有停滞不前的感觉)/u.test(normalized);
}

function buildFulfillmentQuestionFallback(input: {
  target: "progress_evidence" | "value_signal";
  snapshot: JoySnapshot;
  userMessage: string | null;
  recentUserMessage: string | null;
  validationCode: FulfillmentQuestionValidationCode;
}) {
  if (input.target === "value_signal") {
    return null;
  }

  if (input.target === "progress_evidence") {
    const experience = input.snapshot.event?.trim();

    if (input.validationCode === "too_abstract" && experience && /(简历)/u.test(experience)) {
      return "哪一步最让你感觉到，简历这件事终于不是原地打转了？";
    }

    if (experience && /(简历)/u.test(experience)) {
      return "简历里哪一部分真的被你推进了，才让你觉得今天没有白过？";
    }

    return "这件事里，哪一步真的被你推进了，才让你觉得今天没有白过？";
  }

  return null;
}

function resolveQuestionStageIntent(input: {
  assistantAction: PreparedInterviewTurnContext["assistantAction"];
  existingSpec?: AssistantQuestionSpec | null;
}) {
  if (input.existingSpec?.stageIntent) {
    return input.existingSpec.stageIntent;
  }

  return input.assistantAction === "continue_current_event" ? "resume" : "advance";
}

function resolveFallbackQuestionFromSpec(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  assistantAction: PreparedInterviewTurnContext["assistantAction"];
  existingSpec?: AssistantQuestionSpec | null;
  target?: AssistantQuestionSpec["target"];
  surfaceLevel?: AssistantQuestionSpec["surfaceLevel"];
  candidateQuestion?: string | null;
  preserveStructuredCandidateQuestion?: boolean;
}) {
  const shouldPreserveReflectionConcreteInsight =
    input.dimension === "reflection" &&
    input.stage === "probe_pattern" &&
    input.existingSpec?.stageIntent === "advance" &&
    input.existingSpec.target === "insight_evidence" &&
    input.existingSpec.surfaceLevel === "concrete_anchor" &&
    !input.snapshot.selfPattern;
  const shouldInferTargetFromCurrentStage =
    input.target == null &&
    input.stage === "probe_pattern" &&
    input.existingSpec?.stageIntent !== "repair" &&
    !shouldPreserveReflectionConcreteInsight;
  const spec = createQuestionSpec({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    stageIntent: resolveQuestionStageIntent({
      assistantAction: input.assistantAction,
      existingSpec: input.existingSpec
    }),
    previousSpec: shouldInferTargetFromCurrentStage ? null : (input.existingSpec ?? null),
    target: input.target,
    surfaceLevel:
      input.surfaceLevel ??
      (shouldPreserveReflectionConcreteInsight ? input.existingSpec?.surfaceLevel : undefined)
  });

  if (input.candidateQuestion != null) {
    return applyQuestionSurfaceProtocol({
      dimension: input.dimension,
      stage: input.stage,
      snapshot: input.snapshot,
      spec,
      candidateQuestion: input.candidateQuestion,
      preserveStructuredCandidateQuestion: input.preserveStructuredCandidateQuestion
    });
  }

  return resolveQuestionFromSpec({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    spec,
    preserveStructuredCandidateQuestion: input.preserveStructuredCandidateQuestion
  });
}

function validateFulfillmentQuestion(input: {
  question: string;
  snapshot: JoySnapshot;
  userMessage: string | null;
  recentAssistantQuestions: string[];
}) {
  const target = resolveFulfillmentQuestionTarget({
    snapshot: input.snapshot,
    recentUserMessage: input.userMessage
  });

  if (!target) {
    return null;
  }

  const classifiedTarget = classifyFulfillmentQuestionTarget(input.question);
  const normalizedQuestion = input.question.replace(/\s+/g, "");

  if (
    /(意味着什么样的努力算数了|值得感标准|价值判断|什么才算有效努力|这对你意味着什么|这说明了什么|你如何理解这种充实)/u.test(
      normalizedQuestion
    )
  ) {
    return "unnatural_phrasing" as const satisfies FulfillmentQuestionValidationCode;
  }

  if (target === "value_signal" && classifiedTarget === "event_detail") {
    return "target_mismatch" as const satisfies FulfillmentQuestionValidationCode;
  }

  if (target === "progress_evidence" && classifiedTarget === "event_detail") {
    return "target_mismatch" as const satisfies FulfillmentQuestionValidationCode;
  }

  if (target === "progress_evidence" && isAbstractFulfillmentProgressQuestion(input.question)) {
    return "too_abstract" as const satisfies FulfillmentQuestionValidationCode;
  }

  if (
    target === "value_signal" &&
    input.recentAssistantQuestions.some((question) => /没有白过|不算白过/u.test(question)) &&
    /没有白过|不算白过/u.test(input.question)
  ) {
    return "semantic_duplicate" as const satisfies FulfillmentQuestionValidationCode;
  }

  if (target === "value_signal" && input.userMessage && hasCredibleFulfillmentProgressEvidence(input.snapshot, input.userMessage)) {
    if (classifiedTarget === "progress_evidence") {
      return "semantic_duplicate" as const satisfies FulfillmentQuestionValidationCode;
    }
  }

  if (target === "value_signal" && classifiedTarget === "unknown" && isAbstractFulfillmentProgressQuestion(input.question)) {
    return "too_abstract" as const satisfies FulfillmentQuestionValidationCode;
  }

  if (
    target === "value_signal" &&
    classifiedTarget === "value_signal" &&
    input.recentAssistantQuestions.some(
      (question) =>
        classifyFulfillmentQuestionTarget(question) === "value_signal" && areQuestionsEquivalent(question, input.question)
    )
  ) {
    return "semantic_duplicate" as const satisfies FulfillmentQuestionValidationCode;
  }

  return null;
}

function applyFulfillmentQuestionGuard(
  input: PreparedInterviewTurnContext,
  assistantTurn: AssistantTurnPayload
) {
  if (input.session.dimension !== "fulfillment") {
    return assistantTurn;
  }

  const question = assistantTurn.question.trim();

  if (!question) {
    return assistantTurn;
  }

  const recentAssistantQuestions = input.session.messages
    .map((message) => getAssistantQuestionText(message))
    .filter((value): value is string => Boolean(value))
    .slice(-4);
  const recentUserMessage = getLatestUserMessageText(input.session.messages);
  const validationCode = validateFulfillmentQuestion({
    question,
    snapshot: input.nextSnapshot,
    userMessage: input.userMessage ?? recentUserMessage,
    recentAssistantQuestions
  });

  if (!validationCode) {
    return assistantTurn;
  }

  const target = resolveFulfillmentQuestionTarget({
    snapshot: input.nextSnapshot,
    recentUserMessage: input.userMessage ?? recentUserMessage
  });

  if (!target || target === "event_detail") {
    return assistantTurn;
  }

  const fallbackQuestion = buildFulfillmentQuestionFallback({
    target,
    snapshot: input.nextSnapshot,
    userMessage: input.userMessage,
    recentUserMessage,
    validationCode
  });
  const surfaced = resolveFallbackQuestionFromSpec({
    dimension: input.session.dimension,
    stage: input.nextStage,
    snapshot: input.nextSnapshot,
    assistantAction: input.assistantAction,
    existingSpec: assistantTurn.questionSpec ?? input.questionSpec,
    target: target === "value_signal" ? "judgment_clue" : "insight_evidence",
    candidateQuestion: fallbackQuestion
  });

  return {
    ...assistantTurn,
    insight: "",
    thinkingSummary: assistantTurn.thinkingSummary,
    question: surfaced.question,
    questionSpec: surfaced.questionSpec
  };
}

function findLatestReflectionSceneDenial(messages: InterviewMessage[]) {
  for (let index = messages.length - 1; index > 0; index -= 1) {
    const message = messages[index];
    const previousMessage = messages[index - 1];

    if (message.role !== "user" || previousMessage.role !== "assistant") {
      continue;
    }

    const previousQuestion = getAssistantQuestionText(previousMessage);

    if (!isReflectionSceneQuestion(previousQuestion) || !DIRECT_NEGATION_PATTERN.test(message.content.trim())) {
      continue;
    }

    return {
      question: previousQuestion,
      answer: message.content.trim()
    };
  }

  return null;
}

function shouldPreserveReflectionConcreteInsightAfterRepair(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  messages: InterviewMessage[];
  userMessage: string | null;
  isMeaningfulReply: boolean;
}) {
  if (input.dimension !== "reflection" || input.stage !== "probe_pattern" || !input.isMeaningfulReply) {
    return false;
  }

  if (input.snapshot.selfPattern) {
    return false;
  }

  const latestAssistantSpec = getLatestAssistantQuestionSpec(input.messages);
  const latestAssistantQuestion = getLatestAssistantQuestion(input.messages);

  if (
    latestAssistantSpec?.stageIntent !== "repair" ||
    latestAssistantSpec.target !== "judgment_clue" ||
    latestAssistantSpec.surfaceLevel !== "concrete_anchor" ||
    !latestAssistantQuestion?.includes("不用先总结") ||
    !latestAssistantQuestion.includes("最具体的例子")
  ) {
    return false;
  }

  return Boolean(input.userMessage?.trim());
}

function questionTouchesGratitudeTarget(question: string, target: GratitudeQuestionSubTarget) {
  const normalized = question.replace(/\s+/g, "");

  switch (target) {
    case "seen_need":
      return /(看见|需要|撑不住|压力|压住|难处|慌|虚弱)/u.test(normalized);
    case "gratitude_reason":
      return /(为什么感谢|为什么重要|才会这么感谢|重要的是|感谢的原因)/u.test(normalized);
    case "relationship_signal":
      return /(关系|值得珍惜|提醒|以后也想|这类回应)/u.test(normalized);
    case "kind_action":
      return /(具体做了哪一下|帮到你的哪一下|做了什么)/u.test(normalized);
  }
}

function createGratitudeActionFallbackQuestionSpec(previousSpec: AssistantQuestionSpec | null | undefined): AssistantQuestionSpec {
  return {
    target: "insight_evidence",
    subTarget: "kind_action",
    hypothesisKey: null,
    stageIntent: previousSpec?.stageIntent ?? "advance",
    surfaceLevel: "concrete_anchor",
    anchorText: previousSpec?.anchorText ?? null,
    repairCount: previousSpec?.repairCount ?? 0
  };
}

function findLatestGratitudeHypothesisDenial(messages: InterviewMessage[]) {
  for (let index = messages.length - 1; index > 0; index -= 1) {
    const message = messages[index];
    const previousMessage = messages[index - 1];

    if (message.role !== "user" || previousMessage.role !== "assistant") {
      continue;
    }

    const assessment = assessUserTurnMessage(message.content);
    const subTarget = previousMessage.assistantPayload?.questionSpec?.subTarget;

    if (assessment.intent !== "hypothesis_denial" || !subTarget) {
      continue;
    }

    return {
      subTarget,
      question: previousMessage.assistantPayload?.question ?? previousMessage.content
    };
  }

  return null;
}

function getLatestAssistantQuestion(messages: InterviewMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const question = getAssistantQuestionText(messages[index]!);

    if (question) {
      return question;
    }
  }

  return null;
}

function uniqueLenses(...groups: InterviewLens[][]) {
  const order: InterviewLens[] = [
    "event_detail",
    "felt_experience",
    "importance_reason",
    "meaning_pattern",
    "self_pattern"
  ];
  const values = groups.flat();

  return order.filter((lens) => values.includes(lens));
}

function deriveInterviewLenses(snapshot: JoySnapshot): InterviewLens[] {
  return uniqueLenses([
    getJoyMoment(snapshot) ? "event_detail" : null,
    getStateShift(snapshot) ? "felt_experience" : null,
    getJoySource(snapshot) ? "importance_reason" : null,
    getMeaningNeed(snapshot) || (getJoyTrack(snapshot) === "delight_track" && getDelightSignature(snapshot)) ? "meaning_pattern" : null,
    getManualClue(snapshot) || getDelightSignature(snapshot) ? "self_pattern" : null
  ].filter(Boolean) as InterviewLens[]);
}

function countSnapshotSignals(snapshot: JoySnapshot) {
  return [
    snapshot.event,
    snapshot.feeling,
    snapshot.whyItMattered,
    snapshot.selfPattern,
    snapshot.joyMoment,
    snapshot.joySource,
    snapshot.stateShift,
    snapshot.meaningNeed,
    snapshot.manualClue,
    snapshot.delightSignature,
    snapshot.frictionPoint,
    snapshot.repeatCondition,
    snapshot.controllableFactor,
    snapshot.nextAttempt,
    snapshot.kindAction,
    snapshot.seenNeed,
    snapshot.gratitudeReason,
    snapshot.relationshipSignal
  ].filter(Boolean).length;
}

function hasNewProgressAchieved(input: {
  activeEvent: InterviewEventRecord;
  nextSnapshot: JoySnapshot;
  nextLenses: InterviewLens[];
  questionSpec: AssistantQuestionSpec | null;
  isMeaningfulReply: boolean;
}) {
  if (!input.isMeaningfulReply) {
    return false;
  }

  if (input.nextLenses.some((lens) => !input.activeEvent.coveredLenses.includes(lens))) {
    return true;
  }

  if (countSnapshotSignals(input.nextSnapshot) > countSnapshotSignals(input.activeEvent.snapshot)) {
    return true;
  }

  switch (input.questionSpec?.target) {
    case "event_anchor":
      return Boolean(input.nextSnapshot.event && !input.activeEvent.snapshot.event);
    case "reaction_evidence":
      return Boolean(
        (input.nextSnapshot.feeling || input.nextSnapshot.stateShift) &&
          !(input.activeEvent.snapshot.feeling || input.activeEvent.snapshot.stateShift)
      );
    case "insight_evidence":
      return Boolean(input.nextSnapshot.whyItMattered && !input.activeEvent.snapshot.whyItMattered);
    case "judgment_clue":
      return Boolean(input.nextSnapshot.selfPattern && !input.activeEvent.snapshot.selfPattern);
    case "prior_assumption":
      return Boolean(input.nextSnapshot.happinessType && !input.activeEvent.snapshot.happinessType);
    default:
      return false;
  }
}

function getGratitudeMoment(snapshot: JoySnapshot) {
  return snapshot.gratitudeMoment ?? snapshot.event;
}

function getGratitudeReason(snapshot: JoySnapshot) {
  return snapshot.gratitudeReason ?? snapshot.whyItMattered;
}

function getGratitudeRelationshipSignal(snapshot: JoySnapshot) {
  return snapshot.relationshipSignal ?? snapshot.selfPattern;
}

function isGratitudeEvidencePartial(snapshot: JoySnapshot) {
  const evidenceState = getEvidenceState(snapshot);
  const hasMoment = Boolean(getGratitudeMoment(snapshot));
  const hasAction = Boolean(snapshot.kindAction);
  const hasConfirmedReason = evidenceState.targets.gratitude_reason === "confirmed";
  const hasConfirmedNeed = evidenceState.targets.seen_need === "confirmed";
  const deniedDeeper =
    evidenceState.deniedTargets.includes("seen_need") ||
    evidenceState.deniedTargets.includes("gratitude_reason") ||
    evidenceState.deniedTargets.includes("relationship_signal");

  return hasMoment && hasAction && (hasConfirmedReason || hasConfirmedNeed || Boolean(snapshot.gratitudeReason)) && deniedDeeper;
}

function isBoundaryIntent(intent: ReturnType<typeof assessUserTurnMessage>["intent"]) {
  return intent === "boundary_stop" || intent === "hostile_boundary";
}

function isJoyDraftOverrideRequested(message: string | null) {
  return isDraftOverrideRequestedFromBoundary(message);
}

function buildBoundaryInsufficientAssistantTurn(
  dimension: InterviewDimension,
  intent: "draft_request" | "boundary_stop" | "hostile_boundary" | "conversation_feedback" = "boundary_stop"
): AssistantTurnPayload {
  const isHostile = intent === "hostile_boundary";
  const isFeedback = intent === "conversation_feedback";
  const insight = isHostile
    ? "我先停下这道题，不再继续追问。"
    : isFeedback
      ? "我听到了：刚才的问题让你觉得难懂、重复，或者问法太单一。我先停下当前追问。"
      : intent === "draft_request"
        ? "当前证据还不足以整理成可信日志，我先把生成停在这里。"
        : "你已经把现在的边界说清了，我先停在这里，不再继续追问细节。";
  return {
    insight,
    thinkingSummary: "",
    analysis: "控制类输入已优先处理；当前材料不足以整理成日志，下一步交给用户选择：只补一句、换一个片段，或先退出。",
    question:
      dimension === "fulfillment"
        ? "你可以只补一句这件事带来的具体进展，也可以换个片段，或者先退出。"
        : "你可以只补一句最关键的内容，也可以换个片段，或者先退出。",
    stateUpdate: {
      turnPhase: "choice",
      shouldEndDimension: false,
      offerChoice: true,
      choiceKind: "boundary_insufficient",
      choiceReason: "当前材料不足以直接整理成日志。",
    },
    meta: {
      depthReached: []
    }
  };
}

function buildControlChoiceAssistantTurn(input: {
  dimension: InterviewDimension;
  snapshot: JoySnapshot;
  explorationRound: number;
  completionMode: DraftCompletionMode;
  intent: "draft_request" | "boundary_stop" | "hostile_boundary" | "conversation_feedback";
}) {
  const turn = buildChoiceAssistantTurn(input.dimension, input.snapshot, input.explorationRound, input.completionMode);
  if (input.intent === "hostile_boundary") {
    return { ...turn, insight: "我先停下这道题，不再继续追问。" };
  }
  if (input.intent === "conversation_feedback") {
    return { ...turn, insight: "我听到了：刚才的问题让你觉得难懂、重复，或者问法太单一。我先停下当前追问。" };
  }
  return turn;
}

function buildRepairEscalationAssistantTurn(): AssistantTurnPayload {
  return {
    insight: "我先不继续换问法了，免得这轮对话一直卡在理解题目上。",
    thinkingSummary: "",
    analysis: "同一问题连续 repair 已到第 3 次；不再继续重问，改为低压 choice。",
    question: "如果你愿意，我们可以只补一句关键内容；也可以换个片段，或者先整理当前版本。",
    stateUpdate: {
      turnPhase: "choice",
      shouldEndDimension: false,
      offerChoice: true,
      choiceKind: "boundary_insufficient",
      choiceReason: "连续几次都在修同一道问题，继续换问法的收益已经很低。"
    },
    meta: {
      depthReached: []
    }
  };
}

function buildLowSignalAssistantTurn(): AssistantTurnPayload {
  return {
    insight: "我在听，你可以把刚才那句话慢慢说完。",
    thinkingSummary: "",
    analysis: "当前输入还没有形成可抽取的完整表达；保持阶段与计数，邀请用户继续原话。",
    question: "你想说的那一点，接下来是什么？",
    stateUpdate: {
      turnPhase: "digging",
      shouldEndDimension: false,
      offerChoice: false,
      choiceReason: ""
    },
    meta: { depthReached: [] }
  };
}

function buildChoiceInsight(
  dimension: InterviewDimension,
  snapshot: JoySnapshot,
  completionMode: DraftCompletionMode = "complete"
) {
  if (dimension === "joy") {
    if (completionMode === "user_override_partial") {
      return "这段开心的核心已经清楚了，已经够按当前理解写成一版日志；如果你现在不想继续往下提炼，也可以先整理。";
    }

    if (getJoyTrack(snapshot) === "delight_track" && getDelightSignature(snapshot)) {
      return "这一段已经看见一条会把你轻轻带动起来的开心线索了，已经够写成一版日志。";
    }

    if (getManualClue(snapshot)) {
      return "这一段已经沉淀出一条可继续拿来用的个人线索了，已经够写成一版日志。";
    }

    if (getMeaningNeed(snapshot) || getJoySource(snapshot)) {
      return "这一段开心背后真正打动你的点已经比较清楚了，已经够写成一版日志。";
    }

    if (getJoyMoment(snapshot)) {
      return "这个开心片段已经有了清楚的轮廓，已经够先写成一版日志。";
    }

    return "这一段已经聊出一些轮廓了，已经够先写成一版日志。";
  }

  if (dimension === "fulfillment") {
    if (completionMode === "user_override_partial") {
      return "这件事为什么不算白过已经比较清楚了，已经够按当前理解写成一版日志；如果你现在不想继续提炼值得感标准，也可以先整理。";
    }

    if (snapshot.selfPattern) {
      return "这一段已经聊到什么样的努力对你来说真的算数了，已经够写成一版日志。";
    }

    if (snapshot.whyItMattered) {
      return "这一段已经说清楚了为什么今天不是空转的一天，已经够写成一版日志。";
    }

    if (snapshot.event) {
      return "这个充实片段已经有了清楚的轮廓，已经够先写成一版日志。";
    }

    return "这一段已经聊出一些轮廓了，已经够先写成一版日志。";
  }

  if (dimension === "reflection") {
    if (completionMode === "user_override_partial") {
      return "这次思考的触发片段和新理解已经比较清楚了，已经够按当前理解写成一版日志；如果你现在不想继续提炼判断线索，也可以先整理。";
    }

    if (snapshot.selfPattern) {
      return "这一段已经聊到以后判断类似事情时可以带着的一条线索了，已经够写成一版日志。";
    }

    if (snapshot.whyItMattered) {
      return "这一段已经说清楚它带来的新理解了，已经够写成一版日志。";
    }

    if (snapshot.event) {
      return "这个触发思考的片段已经有了清楚的轮廓，已经够先写成一版日志。";
    }

    return "这一段已经聊出一些轮廓了，已经够先写成一版日志。";
  }

  if (dimension === "improvement") {
    if (completionMode === "user_override_partial") {
      return "这个改进情境和关键原因已经比较清楚了，已经够按当前理解写成一版日志；如果你现在不想继续拆动作，也可以先整理。";
    }

    if (snapshot.nextAttempt) {
      return "这一段已经聊到下次可以先尝试的具体动作了，已经够写成一版日志。";
    }

    if (snapshot.improvementTrack === "repeat_good" && snapshot.repeatCondition) {
      return "这一段已经看见了一个值得重复的好状态条件，已经够写成一版日志。";
    }

    if (snapshot.frictionPoint) {
      return "这一段已经说清了下次想避开的关键卡点，已经够写成一版日志。";
    }

    if (snapshot.event) {
      return "这个改进情境已经有了清楚的轮廓，已经够先写成一版日志。";
    }

    return "这一段已经聊出一些轮廓了，已经够先写成一版日志。";
  }

  if (dimension === "gratitude") {
    if (completionMode === "user_override_partial") {
      return "这份感谢的具体片段和重要原因已经比较清楚了，已经够按当前理解写成一版日志；如果你现在不想继续提炼关系线索，也可以先整理。";
    }

    if (getGratitudeRelationshipSignal(snapshot)) {
      return "这一段已经聊到什么样的关系回应对你来说值得珍惜了，已经够写成一版日志。";
    }

    if (snapshot.seenNeed || getGratitudeReason(snapshot)) {
      return "这一段已经说清楚对方看见并回应了你什么需要，已经够写成一版日志。";
    }

    if (snapshot.kindAction) {
      return "这份感谢里对方具体做了什么已经比较清楚了，已经够写成一版日志。";
    }

    if (getGratitudeMoment(snapshot)) {
      return "这个感谢片段已经有了清楚的轮廓，已经够先写成一版日志。";
    }

    return "这一段已经聊出一些轮廓了，已经够先写成一版日志。";
  }

  if (snapshot.selfPattern) {
    return "这一段已经聊到你的在乎和模式了，已经够写成一版日志。";
  }

  if (snapshot.happinessType || snapshot.whyItMattered) {
    return "这一段内容的来龙去脉已经比较完整了，已经够写成一版日志。";
  }

  if (snapshot.event) {
    return "这个片段已经有了清楚的轮廓，已经够先写成一版日志。";
  }

  return "这一段已经聊出一些轮廓了，已经够先写成一版日志。";
}

function buildChoiceReason(
  dimension: InterviewDimension,
  snapshot: JoySnapshot,
  round: number,
  completionMode: DraftCompletionMode = "complete"
) {
  if (dimension === "joy") {
    if (completionMode === "user_override_partial") {
      return round <= 1
        ? "当前事件的核心已经足够整理成一篇当前版本日志；如果用户不想继续提炼规律，也可以先按当前理解收束。"
        : "当前事件已经补到新的角度；如果用户不想继续提炼规律，也可以先整理成当前版本日志。";
    }

    if (getJoyTrack(snapshot) === "delight_track") {
      return round <= 1
        ? "当前事件已经形成一条可回看的轻快乐线索，交给用户决定下一步。"
        : "当前事件已经补到新的角度，也已经看见什么会把用户轻轻带动起来，交给用户决定下一步。";
    }

    return round <= 1
      ? "当前事件已经形成一条可用的开心日志线索，交给用户决定下一步。"
      : "当前事件已经补到新的角度，交给用户决定是否继续深挖或整理。";
  }

  if (dimension === "fulfillment") {
    if (completionMode === "user_override_partial") {
      return round <= 1
        ? "当前事件已经说清为什么不算白过；如果用户不想继续提炼值得感标准，也可以先整理成当前版本日志。"
        : "当前事件已经补到新的角度；如果用户不想继续提炼值得感标准，也可以先整理成当前版本日志。";
    }

    return round <= 1
      ? "当前事件已经形成一条可信的充实日志线索，交给用户决定下一步。"
      : "当前事件已经补到新的角度，交给用户决定是否继续深挖或整理。";
  }

  if (dimension === "reflection") {
    if (completionMode === "user_override_partial") {
      return round <= 1
        ? "当前事件已经说清触发片段和新理解；如果用户不想继续提炼判断线索，也可以先整理成当前版本日志。"
        : "当前事件已经补到新的角度；如果用户不想继续提炼判断线索，也可以先整理成当前版本日志。";
    }

    return round <= 1
      ? "当前事件已经形成一条可信的思考日志线索，交给用户决定下一步。"
      : "当前事件已经补到新的角度，交给用户决定是否继续深挖或整理。";
  }

  if (dimension === "improvement") {
    if (completionMode === "user_override_partial") {
      return round <= 1
        ? "当前事件已经说清改进情境和关键原因；如果用户不想继续拆具体动作，也可以先整理成当前版本日志。"
        : "当前事件已经补到新的角度；如果用户不想继续拆具体动作，也可以先整理成当前版本日志。";
    }

    return round <= 1
      ? "当前事件已经形成一条可信的改进尝试线索，交给用户决定下一步。"
      : "当前事件已经补到新的角度，交给用户决定是否继续深挖或整理。";
  }

  if (dimension === "gratitude") {
    if (completionMode === "user_override_partial") {
      return round <= 1
        ? "当前事件已经说清具体感谢片段和重要原因；如果用户不想继续提炼关系线索，也可以先整理成当前版本日志。"
        : "当前事件已经补到新的角度；如果用户不想继续提炼关系线索，也可以先整理成当前版本日志。";
    }

    return round <= 1
      ? "当前事件已经形成一条可信的感谢日志线索，交给用户决定下一步。"
      : "当前事件已经补到新的角度，交给用户决定是否继续深挖或整理。";
  }

  return round <= 1
    ? "当前事件已经完成一轮完整复盘，交给用户决定下一步。"
    : "当前事件已经完成这一轮新角度复盘，交给用户决定下一步。";
}

function buildChoiceAssistantTurn(
  dimension: InterviewDimension,
  snapshot: JoySnapshot,
  explorationRound: number,
  completionMode: DraftCompletionMode = "complete"
): AssistantTurnPayload {
  return {
    insight: buildChoiceInsight(dimension, snapshot, completionMode),
    thinkingSummary: "",
    analysis:
      dimension === "joy"
        ? completionMode === "user_override_partial"
          ? "当前事件的核心已经清楚，用户明确表示可以先不继续提炼规律；下一步交给用户决定：继续深挖、切到下一件事，或直接整理当前日志。"
          : getJoyTrack(snapshot) === "delight_track"
            ? "当前事件已经看见一条可回看的轻快乐线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。"
            : "当前事件已形成可用的开心日志线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。"
        : dimension === "fulfillment"
          ? completionMode === "user_override_partial"
            ? "当前事件已经说清为什么不算白过，用户明确表示可以先不继续提炼值得感标准；下一步交给用户决定：继续深挖、切到下一件事，或直接整理当前日志。"
            : "当前事件已形成可信的充实日志线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。"
          : dimension === "reflection"
            ? completionMode === "user_override_partial"
              ? "当前事件已经说清触发片段和新理解，用户明确表示可以先不继续提炼判断线索；下一步交给用户决定：继续深挖、切到下一件事，或直接整理当前日志。"
              : "当前事件已形成可信的思考日志线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。"
            : dimension === "improvement"
              ? completionMode === "user_override_partial"
                ? "当前事件已经说清改进情境和关键原因，用户明确表示可以先不继续拆具体动作；下一步交给用户决定：继续深挖、切到下一件事，或直接整理当前日志。"
                : "当前事件已形成可信的改进尝试线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。"
              : dimension === "gratitude"
                ? completionMode === "user_override_partial"
                  ? "当前事件已经说清具体感谢片段和重要原因，用户明确表示可以先不继续提炼关系线索；下一步交给用户决定：继续深挖、切到下一件事，或直接整理当前日志。"
                  : "当前事件已形成可信的感谢日志线索，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。"
          : "当前事件已形成完整复盘，下一步交给用户决定：继续深挖、切到下一件事，或直接生成日志。",
    question: "",
    stateUpdate: {
      turnPhase: "choice",
      shouldEndDimension: false,
      offerChoice: true,
      choiceKind: "event_complete",
      choiceReason: buildChoiceReason(dimension, snapshot, explorationRound, completionMode)
    },
    meta: {
      depthReached: deriveDepthReachedFromSnapshot(snapshot)
    }
  };
}

function buildRedirectAssistantTurn(reason: string, snapshot: JoySnapshot): AssistantTurnPayload {
  return {
    insight: "我先把这一轮停在这里，继续留在开心维度里硬找，收益已经不高了。",
    thinkingSummary: "",
    analysis: `当前轮次还没找到可信的开心片段，建议转去改进维度。原因：${reason}`,
    question: "",
    stateUpdate: {
      turnPhase: "choice",
      shouldEndDimension: true,
      offerChoice: true,
      choiceKind: "dimension_redirect",
      choiceReason: reason
    },
    meta: {
      depthReached: deriveDepthReachedFromSnapshot(snapshot)
    }
  };
}

function trimSummaryField(value: string | null, maxLength = 40) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim().replace(/[。！？!?,，；;:\s]+$/g, "");

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function splitStreamingText(text: string, chunkSize = SUMMARY_STREAM_CHUNK_SIZE) {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}

function buildThinkingSummaryLead(snapshot: JoySnapshot) {
  const joyTrack = getJoyTrack(snapshot);
  const manualClue = trimSummaryField(getManualClue(snapshot), 42);
  const delightSignature = trimSummaryField(getDelightSignature(snapshot), 42);
  const meaningNeed = trimSummaryField(getMeaningNeed(snapshot), 24);
  const joySource = trimSummaryField(getJoySource(snapshot), 24);
  const stateShift = trimSummaryField(getStateShift(snapshot), 18);
  const joyMoment = trimSummaryField(getJoyMoment(snapshot), 24);

  if (joyTrack === "delight_track" && delightSignature) {
    return `这份开心被理解为一种会被“${delightSignature}”带起的轻快乐`;
  }

  if (manualClue) {
    return `这份开心的分量落在“${manualClue}”这条个人线索`;
  }

  if (meaningNeed && joySource) {
    return `真正开心点落在“${joySource}”，背后也碰到“${meaningNeed}”这层在乎`;
  }

  if (joySource) {
    return joyTrack === "delight_track"
      ? `这种开心被理解为由“${joySource}”把状态带轻`
      : `真正让这件事有开心感的地方落在“${joySource}”`;
  }

  if (stateShift && joyMoment) {
    return `“${joyMoment}”里明显出现了${stateShift}的状态变化`;
  }

  if (stateShift) {
    return `这件事带出的${stateShift}状态已经出现`;
  }

  if (joyMoment) {
    return `“${joyMoment}”是当前开心感的入口`;
  }

  return "这个开心片段已经出现，接下来要把状态被带动的原因抓稳";
}

function buildFulfillmentThinkingSummaryLead(snapshot: JoySnapshot) {
  const experience = trimSummaryField(getJoyMoment(snapshot), 32);
  const progressEvidence = trimSummaryField(getJoySource(snapshot), 42);
  const feeling = trimSummaryField(getStateShift(snapshot), 18);
  const valueSignal = trimSummaryField(getManualClue(snapshot), 42);

  if (progressEvidence && valueSignal) {
    return `这段经历的分量落在“${progressEvidence}”，也显出了“${valueSignal}”这条值得感标准`;
  }

  if (progressEvidence && experience) {
    return `“${experience}”不只是做了什么，真正让今天不算白过的是“${progressEvidence}”`;
  }

  if (progressEvidence) {
    return `让今天不算白过的证据已经出现：${progressEvidence}`;
  }

  if (experience && feeling) {
    return `“${experience}”带来的${feeling}感已经出现，但还需要落到具体进展证据上`;
  }

  if (experience) {
    return `“${experience}”是这段充实感的入口，接下来要把它为什么有分量说实`;
  }

  return "一个可能让今天不算白过的片段已经出现，接下来要把具体证据抓稳";
}

function buildReflectionThinkingSummaryLead(snapshot: JoySnapshot) {
  const trigger = trimSummaryField(snapshot.event, 32);
  const insight = trimSummaryField(snapshot.whyItMattered, 48);
  const reflectionType = trimSummaryField(snapshot.happinessType, 18);
  const viewpointShift = trimSummaryField(snapshot.selfPattern, 48);

  if (insight && viewpointShift) {
    return `这次思考已经从“${insight}”推进到“${viewpointShift}”这条判断线索`;
  }

  if (insight && trigger) {
    return `“${trigger}”不只是一个片段，它已经带出“${insight}”这层新理解`;
  }

  if (insight) {
    return `这次思考的核心理解落在“${insight}”`;
  }

  if (trigger && reflectionType) {
    return `“${trigger}”像是一次${reflectionType}的入口，还需要把新的判断说实`;
  }

  if (trigger) {
    return `“${trigger}”是触发思考的具体片段`;
  }

  return "这次思考已有入口，接下来要把新的理解和证据抓稳";
}

function buildImprovementThinkingSummaryLead(snapshot: JoySnapshot) {
  const situation = trimSummaryField(snapshot.event, 34);
  const repeatCondition = trimSummaryField(snapshot.repeatCondition ?? null, 44);
  const frictionPoint = trimSummaryField(snapshot.frictionPoint ?? snapshot.whyItMattered, 44);
  const controllableFactor = trimSummaryField(snapshot.controllableFactor ?? null, 42);
  const nextAttempt = trimSummaryField(snapshot.nextAttempt ?? snapshot.selfPattern, 42);

  if (nextAttempt && controllableFactor) {
    return `这次改进已经落到“${controllableFactor}”，下一次小尝试是“${nextAttempt}”`;
  }

  if (frictionPoint && controllableFactor) {
    return `卡点落在“${frictionPoint}”，可调整的小处开始指向“${controllableFactor}”`;
  }

  if (repeatCondition && controllableFactor) {
    return `值得重复的条件落在“${repeatCondition}”，可控部分开始指向“${controllableFactor}”`;
  }

  if (snapshot.improvementTrack === "repeat_good" && repeatCondition) {
    return `这次想重复的好状态，关键条件落在“${repeatCondition}”`;
  }

  if (snapshot.improvementTrack === "avoid_bad" && frictionPoint) {
    return `这次想避免的坏状态，卡点落在“${frictionPoint}”`;
  }

  if (snapshot.improvementTrack === "repeat_good") {
    return "这次改进更像在找一个值得重复的好状态";
  }

  if (snapshot.improvementTrack === "avoid_bad") {
    return "这次改进更像在看一个下次想避开的具体卡点";
  }

  if (situation) {
    return `“${situation}”是这次改进的具体情境`;
  }

  return "一个可复盘的改进情境已经出现，接下来要把关键条件或卡点抓稳";
}

function buildGratitudeThinkingSummaryLead(snapshot: JoySnapshot) {
  const moment = trimSummaryField(getGratitudeMoment(snapshot), 32);
  const kindAction = trimSummaryField(snapshot.kindAction ?? null, 44);
  const seenNeed = trimSummaryField(snapshot.seenNeed ?? null, 42);
  const reason = trimSummaryField(getGratitudeReason(snapshot), 42);
  const relationshipSignal = trimSummaryField(getGratitudeRelationshipSignal(snapshot), 42);

  if ((seenNeed || reason) && relationshipSignal) {
    return `这份感谢落在“${seenNeed ?? reason}”，也开始显出“${relationshipSignal}”这条关系线索`;
  }

  if (kindAction && seenNeed) {
    return `对方具体做的是“${kindAction}”，它回应了“${seenNeed}”这层需要`;
  }

  if (kindAction && moment) {
    return `“${moment}”里的感谢不是泛泛的，关键在于“${kindAction}”`;
  }

  if (seenNeed || reason) {
    return `这份感谢的重要性开始落到“${seenNeed ?? reason}”`;
  }

  if (kindAction) {
    return `这份感谢里的具体善意已经出现：${kindAction}`;
  }

  if (moment) {
    return `“${moment}”是这次感谢的入口，接下来要看对方回应了什么需要`;
  }

  return "一个可能值得感谢的片段已经出现，接下来要把具体善意抓稳";
}

function buildThinkingSummaryFocus(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  assistantAction: "reply" | "continue_current_event" | "repair_current_question";
}) {
  const joyTrack = getJoyTrack(input.snapshot);
  const assistantAction =
    input.assistantAction === "repair_current_question" ? "continue_current_event" : input.assistantAction;

  if (input.dimension === "fulfillment") {
    if (assistantAction === "continue_current_event") {
      return "，顺着这段投入里真正算数的部分继续说清。";
    }

    switch (input.stage) {
      case "collect_event":
        return "，先把具体画面和投入位置说清。";
      case "probe_reason":
        return "，处理重点是找到推进、积累、练到或帮到别人的真实证据。";
      case "probe_pattern":
        return "，再把这种证据为什么对你算数收成更稳定的判断。";
      case "wrap_up":
        return "，最后确认这篇日志里最该留下的分量。";
      case "finalize":
        return "";
    }
  }

  if (input.dimension === "reflection") {
    if (assistantAction === "continue_current_event") {
      return "，顺着这次新理解背后的证据和判断变化继续说清。";
    }

    switch (input.stage) {
      case "collect_event":
        return "，先把触发思考的具体片段说清。";
      case "probe_reason":
        return "，处理重点是找到它带来的新发现，而不是停在情绪或想法本身。";
      case "probe_pattern":
        return "，再把这层新理解收成以后判断类似事情时可参考的线索。";
      case "wrap_up":
        return "，最后确认这篇思考日志里最该留下的判断依据。";
      case "finalize":
        return "";
    }
  }

  if (input.dimension === "improvement") {
    if (assistantAction === "continue_current_event") {
      return "，顺着关键条件、具体卡点和可控小调整继续拆清。";
    }

    switch (input.stage) {
      case "collect_event":
        return "，先把需要复盘的具体情境说清。";
      case "probe_reason":
        return "，处理重点是分清这是值得重复的好状态，还是下次要避开的具体卡点。";
      case "probe_pattern":
        return "，再把它收成用户能调整的一小处和下一次最小动作。";
      case "wrap_up":
        return "，最后确认这篇改进日志里最该留下的可控线索。";
      case "finalize":
        return "";
    }
  }

  if (input.dimension === "gratitude") {
    if (assistantAction === "continue_current_event") {
      return "，顺着这份善意回应了什么需要继续说清。";
    }

    switch (input.stage) {
      case "collect_event":
        return "，先把具体人、具体时刻和对方做了什么说清。";
      case "probe_reason":
        return "，处理重点是看见对方回应了你的什么需要或难处。";
      case "probe_pattern":
        return "，再把这份感谢收成值得珍惜或学习的关系线索。";
      case "wrap_up":
        return "，最后确认这篇感谢日志里最该留下的善意证据。";
      case "finalize":
        return "";
    }
  }

  if (assistantAction === "continue_current_event") {
    if (joyTrack === "delight_track" && getDelightSignature(input.snapshot)) {
      return "，顺着这条轻快乐线索继续确认它是不是真的站得住。";
    }

    if (getManualClue(input.snapshot)) {
      return "，顺着这条线索继续确认它是不是真的稳定成立。";
    }

    if (joyTrack === "delight_track") {
      return "，顺着这类开心继续看清，什么样的内容、节奏或场景最容易把你带进去。";
    }

    if (getMeaningNeed(input.snapshot) || getJoySource(input.snapshot)) {
      return "，顺着真正打动你的那一层继续说清。";
    }

    return "，顺着真正打动你的点继续说具体一点。";
  }

  switch (input.stage) {
    case "collect_event":
      return "，处理重点是把真正让你有感觉的那一刻落具体。";
    case "probe_reason":
      return getStateShift(input.snapshot)
        ? "，处理重点是看清这种状态为什么偏偏会在这里冒出来。"
        : "，处理重点是分辨真正让你开心的点到底是什么。";
    case "probe_pattern":
      if (joyTrack === "delight_track" && getDelightSignature(input.snapshot)) {
        return "，再确认这条轻快乐线索是不是已经够稳，可以留下来。";
      }

      if (joyTrack === "delight_track") {
        return "，再看清这类开心通常会被什么样的内容、节奏或场景带出来。";
      }

      if (getManualClue(input.snapshot)) {
        return "，再确认这条个人线索是不是真的站得住。";
      }

      if (getMeaningNeed(input.snapshot)) {
        return "，再看清这类开心背后更稳定的条件到底是什么。";
      }

      return "，再往里推进一层，看这类开心能不能沉淀成更稳定的个人线索。";
    case "wrap_up":
      return "，最后确认你最想留下的那一层。";
    case "finalize":
      return "";
  }
}

function buildFollowUpThinkingSummary(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  assistantAction: "reply" | "continue_current_event" | "repair_current_question";
}) {
  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: input.dimension,
    snapshot: input.snapshot,
    stage: input.stage,
    action: input.assistantAction === "repair_current_question" ? "continue_current_event" : input.assistantAction
  });

  return buildNaturalThinkingSummary({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    semanticInterpretation
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function buildNaturalThinkingSummary(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  semanticInterpretation: ReturnType<typeof buildDimensionSemanticInterpretation>;
}) {
  const lead = buildNaturalThinkingSummaryLead(input);
  const focus = buildNaturalThinkingSummaryFocus(input);

  return `${lead}${focus}`;
}

function buildNaturalThinkingSummaryLead(input: {
  dimension: InterviewDimension;
  snapshot: JoySnapshot;
  semanticInterpretation: ReturnType<typeof buildDimensionSemanticInterpretation>;
}) {
  switch (input.dimension) {
    case "joy": {
      const joySource =
        input.semanticInterpretation.dimensionMeta?.joySource ??
        input.semanticInterpretation.dimensionMeta?.manualClue ??
        input.semanticInterpretation.dimensionMeta?.delightSignature;

      if (joySource) {
        const normalizedJoySource = joySource.replace(/的感觉$/u, "");
        return `你已经碰到这段开心里最打动你的那层了，这份${normalizedJoySource}也慢慢清楚了`;
      }

      return "你已经碰到这段开心里最打动你的那层了";
    }
    case "fulfillment": {
      const progressEvidence = input.semanticInterpretation.dimensionMeta?.progressEvidence;

      if (progressEvidence) {
        return `这件事对你来说是算数的，因为${progressEvidence}`;
      }

      return "这件事对你来说已经不只是忙过了";
    }
    case "reflection": {
      const insight = input.semanticInterpretation.dimensionMeta?.insight;

      if (insight) {
        return `你已经慢慢看清，${insight}`;
      }

      return "你已经慢慢碰到这次思考里新的那层了";
    }
    case "improvement": {
      const controllableFactor = input.semanticInterpretation.dimensionMeta?.controllableFactor;
      const nextAttempt = input.semanticInterpretation.dimensionMeta?.nextAttempt;

      if (controllableFactor) {
        return `你已经碰到这次最能动手调整的一小处了，${controllableFactor}`;
      }

      if (nextAttempt) {
        return `你已经开始摸到下次能怎么试了，${nextAttempt}`;
      }

      return "你已经碰到这次最值得继续拆开的那个卡点了";
    }
    case "gratitude": {
      const seenNeed = input.semanticInterpretation.dimensionMeta?.seenNeed;
      const kindAction = input.semanticInterpretation.dimensionMeta?.kindAction;

      if (seenNeed) {
        return `你会记得这一下，是因为对方接住了“${seenNeed}”这层需要`;
      }

      if (kindAction) {
        return `你会记得这一下，是因为对方真的做了“${kindAction}”这件事`;
      }

      return "你会记得这一下，是因为有人真的接住了你当时那层需要";
    }
    default:
      return input.semanticInterpretation.thinkingSummaryLead;
  }
}

function buildNaturalThinkingSummaryFocus(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
}) {
  switch (input.stage) {
    case "collect_event":
      return "，先把那个具体片段说清一点。";
    case "probe_reason":
      switch (input.dimension) {
        case "joy":
          return "，再把到底是什么让你有感觉说清一点。";
        case "fulfillment":
          return "，再把这件事到底算数在哪儿说清一点。";
        case "reflection":
          return "，再把这层新发现是怎么冒出来的说清一点。";
        case "improvement":
          return "，再把那个具体卡点或关键条件看清一点。";
        case "gratitude":
          return "，再把对方到底接住了你哪一层说清一点。";
      }
      break;
    case "probe_pattern":
      switch (input.dimension) {
        case "joy":
          return "，再看看它为什么会一直留在你心里。";
        case "fulfillment":
          return "，再看看这件事为什么会变成你想记住的一点。";
        case "reflection":
          return "，再看看这层发现之后，你的判断哪里不一样了。";
        case "improvement":
          return "，再看看下次最想先动的一小步是什么。";
        case "gratitude":
          return "，再看看这份感谢里你最想留下的是哪一点。";
      }
      break;
    case "wrap_up":
      return "，最后把今天最想留下的那一层收一下。";
    case "finalize":
      return "";
  }

  switch (input.dimension) {
    case "joy":
      return "，我们就顺着这份感觉继续往下聊。";
    case "fulfillment":
      return "，我们就顺着这件事为什么对你算数继续往下聊。";
    case "reflection":
      return "，我们就顺着这层新发现继续往下聊。";
    case "improvement":
      return "，我们就顺着这个卡点继续拆开看看。";
    case "gratitude":
      return "，我们就顺着这一下为什么让你记住继续往下聊。";
    default:
      return "";
  }
}
function extractFirstPersonIntentPhrases(value: string) {
  return Array.from(value.matchAll(/我想[^，。！？!?；;：:\n”"’'」》】]{1,40}/gu), (match) => match[0]);
}

function isUserAnchoredFirstPersonIntent(phrase: string, userMessage: string | null | undefined) {
  const normalizedUserMessage = normalizeLooseText(userMessage);

  if (!normalizedUserMessage) {
    return false;
  }

  const normalizedPhrase = normalizeLooseText(phrase);

  return Boolean(normalizedPhrase && normalizedUserMessage.includes(normalizedPhrase));
}

function hasInvalidThinkingSummaryTone(summary: string, userMessage: string | null | undefined) {
  const normalized = summary.trim();

  if (!normalized) {
    return false;
  }

  const firstPersonIntentPhrases = extractFirstPersonIntentPhrases(normalized);
  const hasUnanchoredFirstPersonIntent = firstPersonIntentPhrases.some(
    (phrase) => !isUserAnchoredFirstPersonIntent(phrase, userMessage)
  );

  return (
    /[?？]/u.test(normalized) ||
    hasUnanchoredFirstPersonIntent ||
    /(用户|用户已说|你提到|你说|你讲到|你提及|我理解到|我听到|我会(?:继续|先|再|追问|确认)|我准备(?:继续|确认|追问)|我在想|想知道|下一步|追问|提问|问你|确认一下)/u.test(normalized)
  );
}

function hasTheoryExplanationThinkingSummaryTone(summary: string) {
  return /(这份.+(?:(?:重点|核心).*(?:不是.+而是|回应了.+这层需要)|已经不是泛泛说谢谢)|这次.+(?:重点|核心).*(?:不是.+而是|判断变清楚)|这件事真正有分量的地方|这次改进的重点，不是|处理重点是|真正重要的，不是)/u.test(
    summary
  );
}

function normalizeLooseText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, "").replace(/[，。！？；：,.!?;:“”"'（）()【】\[\]《》]/gu, "");
}

function containsSemanticCandidate(text: string, candidates: Array<string | null | undefined>) {
  const normalizedText = normalizeLooseText(text);

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeLooseText(candidate);

    if (!normalizedCandidate) {
      return false;
    }

    if (normalizedCandidate.length <= 4) {
      return normalizedText.includes(normalizedCandidate);
    }

    return normalizedText.includes(normalizedCandidate.slice(0, 4)) || normalizedText.includes(normalizedCandidate.slice(-4));
  });
}

function hasParaphraseOnlyThinkingSummary(input: {
  summary: string;
  userMessage: string | null;
  semanticInterpretation: ReturnType<typeof buildDimensionSemanticInterpretation>;
}) {
  const normalizedSummary = normalizeLooseText(input.summary);
  const normalizedUserMessage = normalizeLooseText(input.userMessage);

  if (!normalizedSummary || !normalizedUserMessage) {
    return false;
  }

  if (normalizedSummary === normalizedUserMessage) {
    return true;
  }

  const summaryCoveredByUser =
    normalizedUserMessage.includes(normalizedSummary) ||
    normalizedSummary.length >= 6 && normalizedSummary.split("").filter((char) => normalizedUserMessage.includes(char)).length / normalizedSummary.length >= 0.86;

  if (!summaryCoveredByUser) {
    return false;
  }

  const hasSemanticLift =
    containsSemanticCandidate(input.summary, [
      input.semanticInterpretation.titleTheme,
      input.semanticInterpretation.theorySummary,
      ...(Object.values(input.semanticInterpretation.dimensionMeta ?? {}) as Array<string | null | undefined>)
    ]) ||
    /(不算白过|不是空转|算数|有分量|被接住|被理解|带轻|带动|判断依据|具体卡点|回应了.*需要)/u.test(input.summary);

  return !hasSemanticLift;
}

function normalizeThinkingSummary(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  assistantAction: "reply" | "continue_current_event" | "repair_current_question" | null;
  summary: string;
  userMessage?: string | null;
}) {
  const summary = input.summary.replace(/\s+/g, " ").trim();

  const revisionSummary = input.userMessage
    ? buildEvidenceRevisionThinkingSummary({
        dimension: input.dimension,
        message: input.userMessage
      })
    : null;

  if (revisionSummary) {
    return revisionSummary;
  }

  if (!summary) {
    return summary;
  }

  const semanticInterpretation = buildDimensionSemanticInterpretation({
    dimension: input.dimension,
    snapshot: input.snapshot,
    stage: input.stage,
    action: input.assistantAction === "repair_current_question" ? "continue_current_event" : input.assistantAction ?? "reply"
  });

  if (
    !hasTheoryExplanationThinkingSummaryTone(summary) &&
    !hasInvalidThinkingSummaryTone(summary, input.userMessage ?? null) &&
    !hasParaphraseOnlyThinkingSummary({
      summary,
      userMessage: input.userMessage ?? null,
      semanticInterpretation
    })
  ) {
    return summary.slice(0, 180);
  }

  return buildFollowUpThinkingSummary({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    assistantAction:
      input.assistantAction === "repair_current_question" ? "continue_current_event" : input.assistantAction ?? "reply"
  });
}

function buildReflectionContinuationFallbackQuestion(snapshot: JoySnapshot, hadSceneDenial: boolean) {
  const anchor = trimSummaryField(snapshot.event, 28);

  if (hadSceneDenial) {
    return anchor
      ? `在“${anchor}”这件事里，最先卡住你的一个具体顾虑、画面或念头是什么？`
      : "当时最先卡住你的一个具体顾虑、画面或念头是什么？";
  }

  if (anchor) {
    return `你说“${anchor}”。当时最直接让你纠结的是什么？`;
  }

  return "当时最直接让你纠结的是什么？";
}

function buildContinuationFallbackQuestion(
  input: PreparedInterviewTurnContext,
  repeatedQuestion: string,
  existingSpec: AssistantQuestionSpec | null
) {
  if (input.session.dimension === "reflection") {
    const reflectionFallback = resolveFallbackQuestionFromSpec({
      dimension: input.session.dimension,
      stage: input.nextStage,
      snapshot: input.nextSnapshot,
      assistantAction: input.assistantAction,
      existingSpec,
      target: "insight_evidence",
      surfaceLevel: "concrete_anchor",
      candidateQuestion: buildReflectionContinuationFallbackQuestion(
        input.nextSnapshot,
        Boolean(findLatestReflectionSceneDenial(input.session.messages))
      ),
      preserveStructuredCandidateQuestion: true
    });

    if (!areQuestionsEquivalent(reflectionFallback.question, repeatedQuestion)) {
      return reflectionFallback;
    }
  }

  const stageFallback = resolveFallbackQuestionFromSpec({
    dimension: input.session.dimension,
    stage: input.nextStage,
    snapshot: input.nextSnapshot,
    assistantAction: input.assistantAction,
    existingSpec
  });

  if (stageFallback.question && !areQuestionsEquivalent(stageFallback.question, repeatedQuestion)) {
    return stageFallback;
  }

  if (existingSpec) {
    const repairTurn = renderDeterministicRepairTurn({
      dimension: input.session.dimension,
      stage: input.nextStage,
      snapshot: input.nextSnapshot,
      spec: {
        ...existingSpec,
        stageIntent: "repair",
        surfaceLevel: existingSpec.surfaceLevel === "default" ? "simplified" : "concrete_anchor",
        repairCount: existingSpec.repairCount + 1
      },
      previousQuestion: repeatedQuestion,
      hadReflectionSceneDenial:
        input.session.dimension === "reflection" && Boolean(findLatestReflectionSceneDenial(input.session.messages))
    });

    if (repairTurn.question && !areQuestionsEquivalent(repairTurn.question, repeatedQuestion)) {
      return {
        question: repairTurn.question,
        questionSpec: repairTurn.questionSpec
      };
    }
  }

  return {
    question: repeatedQuestion,
    questionSpec: existingSpec
  };
}

function applyQuestionGuard(
  input: PreparedInterviewTurnContext,
  assistantTurn: AssistantTurnPayload
) {
  const question = assistantTurn.question.trim();

  if (!question) {
    return assistantTurn;
  }

  const isChoiceContinuation = input.assistantAction === "continue_current_event";

  if (isChoiceContinuation && input.session.dimension === "reflection") {
    const deniedSceneQuestion = findLatestReflectionSceneDenial(input.session.messages);

    if (deniedSceneQuestion && isReflectionSceneQuestion(question)) {
      return {
        ...assistantTurn,
        insight: "",
        thinkingSummary: "",
        ...resolveFallbackQuestionFromSpec({
          dimension: input.session.dimension,
          stage: input.nextStage,
          snapshot: input.nextSnapshot,
          assistantAction: input.assistantAction,
          existingSpec: assistantTurn.questionSpec ?? input.questionSpec,
          target: "insight_evidence",
          surfaceLevel: "concrete_anchor",
          candidateQuestion: buildReflectionContinuationFallbackQuestion(
            input.nextSnapshot,
            Boolean(findLatestReflectionSceneDenial(input.session.messages))
          ),
          preserveStructuredCandidateQuestion: true
        })
      };
    }
  }

  if (isChoiceContinuation && input.session.dimension === "gratitude") {
    const deniedTargets = new Set(input.nextSnapshot.evidenceState?.deniedTargets ?? []);
    const latestDenial = findLatestGratitudeHypothesisDenial(input.session.messages);

    if (
      (assistantTurn.questionSpec?.subTarget && deniedTargets.has(assistantTurn.questionSpec.subTarget)) ||
      (assistantTurn.questionSpec?.hypothesisKey &&
        input.nextSnapshot.evidenceState?.deniedHypotheses.includes(assistantTurn.questionSpec.hypothesisKey))
      || (latestDenial && questionTouchesGratitudeTarget(question, latestDenial.subTarget))
    ) {
      return {
        ...assistantTurn,
        insight: "",
        thinkingSummary: "",
        question: "撇开原因判断不说，最让你想记住的还是他具体帮到你的哪一下？",
        questionSpec: createGratitudeActionFallbackQuestionSpec(assistantTurn.questionSpec ?? input.questionSpec)
      };
    }
  }

  const existingSpec = assistantTurn.questionSpec ?? input.questionSpec;
  const recentAssistantQuestions = input.session.messages
    .map((message) => getAssistantQuestionText(message))
    .filter((value): value is string => Boolean(value))
    .slice(-4);
  const hasRepeatedQuestion = recentAssistantQuestions.some((previousQuestion) =>
    areQuestionsEquivalent(previousQuestion, question)
  );

  if (!hasRepeatedQuestion) {
    return assistantTurn;
  }

  return {
    ...assistantTurn,
    ...(isChoiceContinuation
      ? {
          insight: "",
          thinkingSummary: ""
        }
      : {}),
    ...buildContinuationFallbackQuestion(input, question, existingSpec)
  };
}

function getVisibleAssistantText(assistantTurn: AssistantTurnPayload | null | undefined) {
  const parts = getAssistantDisplayParts(assistantTurn);
  const firstBubble = parts.summary || parts.insight;

  return {
    firstBubble,
    question: parts.question,
    combinedText: [firstBubble, parts.question].filter(Boolean).join("\n")
  };
}

function getChoiceCompletionMode(input: {
  dimension: InterviewDimension;
  activeEvent: InterviewEventRecord;
  nextSnapshot: JoySnapshot;
  nextStage: JoyInterviewStage;
  userMessage: string | null;
  isMeaningfulReply: boolean;
  nextEventTurnCount: number;
  nextRoundMeaningfulReplyCount: number;
  nextLenses: InterviewLens[];
  questionSpec: AssistantQuestionSpec | null;
}) {
  const newProgressAchieved =
    input.activeEvent.explorationRound <= 1
      ? true
      : hasNewProgressAchieved({
          activeEvent: input.activeEvent,
          nextSnapshot: input.nextSnapshot,
          nextLenses: input.nextLenses,
          questionSpec: input.questionSpec,
          isMeaningfulReply: input.isMeaningfulReply
        });

  const evidence = assessDimensionEvidence(input.dimension, input.nextSnapshot);

  if (evidence.readiness === "complete") {
    if (!input.isMeaningfulReply || input.nextStage !== "wrap_up") {
      return null;
    }
    return input.activeEvent.explorationRound <= 1 || newProgressAchieved ? "complete" : null;
  }

  const gratitudeEvidencePartial = input.dimension === "gratitude" && isGratitudeEvidencePartial(input.nextSnapshot);
  if (
    evidence.readiness !== "partial" ||
    (!isJoyDraftOverrideRequested(input.userMessage) && !(input.nextStage === "wrap_up" && gratitudeEvidencePartial))
  ) {
    return null;
  }

  if (input.activeEvent.explorationRound <= 1) {
    const minimumTurns = input.dimension === "joy" ? 3 : 2;
    return input.nextEventTurnCount >= minimumTurns || gratitudeEvidencePartial ? "user_override_partial" : null;
  }

  return newProgressAchieved || gratitudeEvidencePartial ? "user_override_partial" : null;
}

function looksLikeNoJoyMessage(message: string | null) {
  if (!message) {
    return false;
  }

  const normalized = message.replace(/\s+/g, "");

  return /(没什么开心|没有开心|想不出来|想不到|乏善可陈|都在上班|都在上课|糟糕的一天|今天很差|没啥可记)/.test(normalized);
}

function getImprovementRedirectReason(input: {
  dimension: InterviewDimension;
  session: InterviewSessionRecord;
  nextSnapshot: JoySnapshot;
  userMessage: string | null;
  isMeaningfulReply: boolean;
  nextEventTurnCount: number;
}) {
  if (input.dimension !== "joy") {
    return null;
  }

  if (getJoyMoment(input.nextSnapshot)) {
    return null;
  }

  const progress = summarizeInterviewProgress(input.session.messages);
  const nextInvalidReplies = progress.consecutiveInvalidReplies + (input.isMeaningfulReply ? 0 : 1);

  if (looksLikeNoJoyMessage(input.userMessage) && input.nextEventTurnCount >= 2) {
    return "已经尝试降低门槛，但这一天仍然没有找到可信的开心片段，更适合转去复盘改进。";
  }

  if (input.nextEventTurnCount >= 3) {
    return "已经聊了几轮，仍然没有形成明确开心片段，继续停在这里容易变成硬找开心。";
  }

  if (nextInvalidReplies >= 2) {
    return "连续几轮都没有形成可展开的开心内容，继续追问的收益已经很低。";
  }

  return null;
}

function normalizeActiveStageBeforeChoice(input: {
  nextStage: JoyInterviewStage;
  shouldOfferChoiceNow: boolean;
}) {
  if (input.nextStage !== "wrap_up" || input.shouldOfferChoiceNow) {
    return input.nextStage;
  }

  // "wrap_up" only exists to hand control to the choice card. If we have not
  // reached that threshold yet, keep the event in the probing stage so the user
  // always receives a concrete follow-up instead of getting stuck on a summary.
  return "probe_pattern" as const;
}

function getNextEventOpeningQuestion(dimension: InterviewDimension) {
  switch (dimension) {
    case "joy":
      return "如果今天还有另一件让你开心的事，我们就聊那一件。那个瞬间是什么？";
    case "fulfillment":
      return "如果今天还有另一段让你觉得充实的经历，我们就聊那一段。那时发生了什么？";
    case "reflection":
      return "如果今天还有另一个让你停下来思考的片段，我们就聊那个时刻。它是什么？";
    case "improvement":
      return "如果今天还有另一个你想复盘的改进情境，我们就聊那件事。那一刻发生了什么？";
    case "gratitude":
      return "如果今天还有另一段让你想说谢谢的经历，我们就聊那一段。那个片段是什么？";
  }
}

async function createInterviewTurnTrace(input: {
  requestId?: string | null;
  session: InterviewSessionRecord;
  activeEvent: InterviewEventRecord;
  action: CanonicalInterviewAction;
  userMessage?: string | null;
  inputMode?: InputMode;
  outputOrigin?: "llm" | "deterministic" | "fallback";
  userTurnId?: string | null;
  triggerMessageId?: string | null;
}) {
  return createAIGenerationTrace({
    requestId: input.requestId,
    userId: input.session.userId,
    sessionId: input.session.id,
    dimension: input.session.dimension,
    artifactType: "interview_turn",
    triggerMessageId: input.triggerMessageId,
    outputOrigin: input.outputOrigin,
    contextSnapshot: {
      action: input.action,
      userTurnId: input.userTurnId ?? null,
      inputMode: input.inputMode ?? null,
      userMessage: input.userMessage ?? null,
      entryDate: input.session.entryDate,
      stage: input.session.stage,
      activeEventId: input.activeEvent.id,
      snapshot: input.activeEvent.snapshotData ?? input.activeEvent.snapshot,
      messageIds: input.session.messages.map((message) => message.id),
      messages: input.session.messages.map((message) => ({
        id: message.id,
        role: message.role,
        sequence: message.sequence,
        content: message.content
      }))
    }
  });
}

function assessSessionDimensionEvidence(session: InterviewSessionRecord) {
  const candidates = [
    ...session.events.map((event) => assessDimensionEvidence(session.dimension, event.snapshot, event.snapshotData)),
    assessDimensionEvidence(session.dimension, session.snapshot, session.snapshotData)
  ];
  return candidates.find((candidate) => candidate.readiness === "complete")
    ?? candidates.find((candidate) => candidate.readiness === "partial")
    ?? candidates[0];
}

async function appendEvidenceDecisionTrace(input: {
  traceId: string;
  detectedIntent: ReturnType<typeof assessUserTurnMessage>["intent"];
  dimension: InterviewDimension;
  snapshot: JoySnapshot;
  snapshotData?: unknown;
  decisionOrigin: "deterministic" | "llm" | "fallback";
  extractionSkipped: boolean;
  turnAdvanced: boolean;
  evidence?: ReturnType<typeof assessDimensionEvidence>;
}) {
  const evidence = input.evidence ?? assessDimensionEvidence(input.dimension, input.snapshot, input.snapshotData);
  await appendGenerationTraceDecision(input.traceId, {
    kind: "interview_evidence_decision",
    detectedIntent: input.detectedIntent,
    readiness: evidence.readiness,
    missingSlots: evidence.missingSlots,
    completionMode: evidence.completionMode,
    decisionOrigin: input.decisionOrigin,
    extractionSkipped: input.extractionSkipped,
    turnAdvanced: input.turnAdvanced
  });
  return evidence;
}

function buildImmediateResponseFromSession(session: InterviewSessionRecord) {
  const latestAssistantMessage = [...session.messages].reverse().find((message) => message.role === "assistant");
  const assistantTurn = latestAssistantMessage?.assistantPayload ?? null;
  const visibleText = getVisibleAssistantText(assistantTurn);

  return {
    assistantMessage: visibleText.combinedText || latestAssistantMessage?.content || "",
    assistantTurn,
    sessionStatus: session.status,
    turnCount: session.turnCount,
    snapshot: session.snapshot,
    snapshotData: session.snapshotData,
    isReadyForDraft: session.draftGenerationUnlocked,
    session
  };
}

function applyFallbackQuestion(input: {
  dimension: InterviewDimension;
  stage: JoyInterviewStage;
  snapshot: JoySnapshot;
  assistantAction: PreparedInterviewTurnContext["assistantAction"];
  questionSpec: AssistantQuestionSpec | null;
  assistantTurn: AssistantTurnPayload;
}) {
  if (input.assistantTurn.question.trim()) {
    return input.assistantTurn;
  }

  const surfaced = resolveFallbackQuestionFromSpec({
    dimension: input.dimension,
    stage: input.stage,
    snapshot: input.snapshot,
    assistantAction: input.assistantAction,
    existingSpec: input.assistantTurn.questionSpec ?? input.questionSpec
  });

  return {
    ...input.assistantTurn,
    question: surfaced.question,
    questionSpec: surfaced.questionSpec
  };
}

function applyAssistantTurnFallbacks(
  input: PreparedInterviewTurnContext,
  assistantTurn: AssistantTurnPayload
) {
  const withQuestion = applyFallbackQuestion({
    dimension: input.session.dimension,
    stage: input.nextStage,
    snapshot: input.nextSnapshot,
    assistantAction: input.assistantAction,
    questionSpec: input.questionSpec,
    assistantTurn
  });

  if (!withQuestion.question.trim()) {
    return withQuestion;
  }

  if (withQuestion.thinkingSummary.trim()) {
    return withQuestion;
  }

  if (withQuestion.insight.trim()) {
    return {
      ...withQuestion,
      thinkingSummary: withQuestion.insight.trim()
    };
  }

  if (!input.assistantAction) {
    return withQuestion;
  }

  return {
    ...withQuestion,
    thinkingSummary: buildFollowUpThinkingSummary({
      dimension: input.session.dimension,
      stage: input.nextStage,
      snapshot: input.nextSnapshot,
      assistantAction: input.assistantAction
    })
  };
}

function buildAssistantGenerationInput(input: PreparedInterviewTurnContext & {
  assistantAction: "reply" | "continue_current_event" | "repair_current_question";
}) {
  return {
    dimension: input.session.dimension,
    sessionId: input.session.id,
    stage: input.nextStage,
    snapshot: input.nextSnapshot,
    events: input.session.events,
    activeEvent: input.activeEvent,
    userMessage: input.userMessage,
    messages: input.session.messages,
    nextTurnCount: input.nextTurnCount,
    nextEventTurnCount: input.nextEventTurnCount,
    previousDepthReached: deriveDepthReachedFromSnapshot(input.activeEvent.snapshot),
    nextDepthReached: deriveDepthReachedFromSnapshot(input.nextSnapshot),
    coveredLenses: input.coveredLenses,
    roundCoveredLenses: input.roundCoveredLenses,
    isMeaningfulReply: input.isMeaningfulReply,
    action: input.assistantAction === "repair_current_question" ? "continue_current_event" : input.assistantAction,
    questionSpec: input.questionSpec
    ,traceId: input.generationTraceId
    ,requestId: input.requestId
  } as const;
}

function finalizeAssistantTurn(
  input: PreparedInterviewTurnContext,
  assistantTurn: AssistantTurnPayload
): ResolvedPreparedInterviewTurn {
  const guardedAssistantTurn = applyQuestionGuard(input, assistantTurn);
  const fulfillmentGuardedAssistantTurn = applyFulfillmentQuestionGuard(input, guardedAssistantTurn);
  const fallbackAssistantTurn = applyAssistantTurnFallbacks(input, fulfillmentGuardedAssistantTurn);
  const evidenceRevisions = input.userMessage
    ? detectExplicitEvidenceRevisions({
        dimension: input.session.dimension,
        message: input.userMessage
      })
    : [];
  const revisionGuardedAssistantTurn =
    input.session.dimension === "fulfillment" &&
    evidenceRevisions.some((revision) => revision.field === "whyItMattered" && revision.action === "clear")
      ? {
          ...fallbackAssistantTurn,
          question: "那这段先放下。今天还有哪个片段，留下了一点看得见的结果？想不到也可以直接说没有。",
          questionSpec: {
            target: "event_anchor" as const,
            stageIntent: "advance" as const,
            surfaceLevel: "concrete_anchor" as const,
            anchorText: null,
            repairCount: 0
          }
        }
      : fallbackAssistantTurn;
  const finalizedAssistantTurn = {
    ...revisionGuardedAssistantTurn,
    questionSpec: revisionGuardedAssistantTurn.questionSpec ?? input.questionSpec ?? null,
    thinkingSummary: normalizeThinkingSummary({
      dimension: input.session.dimension,
      stage: input.nextStage,
      snapshot: input.nextSnapshot,
      assistantAction: input.assistantAction,
      summary: revisionGuardedAssistantTurn.thinkingSummary,
      userMessage: input.userMessage
    })
  };

  if (input.assistantAction === "continue_current_event" || input.assistantAction === "repair_current_question") {
    return {
      ...input,
      assistantAction: null,
      assistantTurn: {
        ...finalizedAssistantTurn,
        stateUpdate: {
          ...finalizedAssistantTurn.stateUpdate,
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceKind: null,
          choiceReason: ""
        }
      }
    };
  }

  return {
    ...input,
    assistantAction: null,
    assistantTurn: {
      ...finalizedAssistantTurn,
      stateUpdate: {
        ...finalizedAssistantTurn.stateUpdate,
        turnPhase: input.nextStage === "collect_event" ? "opening" : "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceKind: null,
        choiceReason: ""
      }
    }
  };
}

async function resolvePreparedInterviewTurn(
  input: PreparedInterviewTurnContext,
  callbacks?: {
    onDelta?: (delta: { target: StreamingTarget; text: string }) => Promise<void> | void;
    signal?: AbortSignal;
  }
) : Promise<ResolvedPreparedInterviewTurn> {
  callbacks?.signal?.throwIfAborted();
  if (input.assistantTurn) {
    return {
      ...input,
      assistantTurn: input.assistantTurn,
      assistantAction: null
    };
  }

  if (!input.assistantAction) {
    throw new Error("ASSISTANT_ACTION_MISSING");
  }

  const assistantInput = buildAssistantGenerationInput({
    ...input,
    assistantAction: input.assistantAction
  });

  // Fire-and-forget memory retrieval for prompt enrichment
  const { formattedContext: memoryContext } = await retrieveRelevantMemories({
    userId: input.session.userId,
    dimension: input.session.dimension,
    snapshot: input.nextSnapshot,
    currentEventText: input.userMessage ?? undefined
  }).catch(() => ({ formattedContext: null }));
  callbacks?.signal?.throwIfAborted();

  const enrichedInput = memoryContext
    ? { ...assistantInput, memoryContext }
    : assistantInput;

  const generatedAssistantTurn = callbacks?.onDelta
    ? await streamJoyAssistantTurn(enrichedInput, {
        onDelta: async (delta) => callbacks.onDelta?.(delta)
      }, { signal: callbacks.signal })
    : await generateJoyAssistantTurn(enrichedInput);

  callbacks?.signal?.throwIfAborted();

  const finalized = finalizeAssistantTurn(input, generatedAssistantTurn);

  if (
    finalized.assistantTurn.question !== generatedAssistantTurn.question ||
    finalized.assistantTurn.thinkingSummary !== generatedAssistantTurn.thinkingSummary
  ) {
    await appendGenerationTraceDecision(input.generationTraceId, {
      kind: "assistant_server_guard",
      questionChanged: finalized.assistantTurn.question !== generatedAssistantTurn.question,
      summaryChanged: finalized.assistantTurn.thinkingSummary !== generatedAssistantTurn.thinkingSummary
    });
  }

  return finalized;
}

async function getActiveInterviewSession(userId: string, sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId, userId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status !== "active") {
    return {
      assistantMessage: getInactiveSessionMessage(session.dimension, session.status),
      assistantTurn: null,
      sessionStatus: session.status,
      turnCount: session.turnCount,
      snapshot: session.snapshot,
      snapshotData: session.snapshotData,
      isReadyForDraft: session.draftGenerationUnlocked,
      session
    };
  }

  return session;
}

export async function startJoyInterview(
  userId: string,
  dimension: InterviewDimension,
  entryDate?: string,
  options?: { requestId?: string | null }
) {
  const openingQuestion = getOpeningQuestion(dimension);
  const session = await createJoyInterviewSession(userId, dimension, openingQuestion, entryDate, options);

  await recordAnalyticsEvent({
    eventName: "interview_session_started",
    userId,
    sessionId: session.id,
    dedupeKey: `interview_session_started:${session.id}`,
    properties: {
      dimension,
      entryDate: session.entryDate
    }
  });

  return {
    sessionId: session.id,
    openingQuestion,
    session
  };
}

export async function getJoyInterviewSession(userId: string, sessionId: string) {
  return findJoyInterviewSessionById(sessionId, userId);
}

export async function reopenJoyInterviewSession(userId: string, sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId, userId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status === "active") {
    return {
      session
    };
  }

  if (session.status !== "paused" && session.status !== "completed") {
    throw new Error("SESSION_NOT_REOPENABLE");
  }

  const reopenedSession = await reopenJoyInterviewSessionRecord(sessionId);

  if (!reopenedSession) {
    throw new Error("SESSION_NOT_FOUND");
  }

  await recordAnalyticsEvent({
    eventName: "interview_session_reopened",
    userId,
    sessionId,
    dedupeKey: `interview_session_reopened:${sessionId}`,
    properties: {
      dimension: reopenedSession.dimension
    }
  });

  return {
    session: reopenedSession
  };
}

export async function pauseJoyInterviewSession(userId: string, sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId, userId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status === "paused") {
    return {
      session
    };
  }

  if (session.status === "completed") {
    throw new Error("SESSION_ALREADY_COMPLETED");
  }

  if (session.status === "abandoned") {
    throw new Error("SESSION_NOT_PAUSABLE");
  }

  const pausedSession = await pauseJoyInterviewSessionRecord(sessionId);

  await recordAnalyticsEvent({
    eventName: "interview_session_paused",
    userId,
    sessionId,
    dedupeKey: `interview_session_paused:${sessionId}`,
    properties: {
      dimension: pausedSession.dimension
    }
  });

  return {
    session: pausedSession
  };
}

export async function completeJoyInterviewSession(userId: string, sessionId: string) {
  const session = await findJoyInterviewSessionById(sessionId, userId);

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.status === "completed") {
    return {
      session
    };
  }

  if (session.status === "abandoned") {
    throw new Error("SESSION_NOT_COMPLETABLE");
  }

  const completedSession = await completeJoyInterviewSessionRecord(sessionId);

  return {
    session: completedSession
  };
}

async function prepareJoyInterviewResponseContext(
  requestInput: InterviewRespondInput,
  options?: {
    signal?: AbortSignal;
    onTurn?: (turn: InterviewUserTurnRecord) => Promise<void> | void;
  }
) {
  options?.signal?.throwIfAborted();
  let session = await getActiveInterviewSession(requestInput.userId, requestInput.sessionId);
  options?.signal?.throwIfAborted();

  if ("assistantMessage" in session) {
    return session;
  }

  let canonicalAction =
    requestInput.action === "resume_turn"
      ? null
      : getCanonicalAction(requestInput.action);
  let activeEvent = getActiveEvent(session);

  if (!activeEvent) {
    throw new Error("SESSION_EVENT_NOT_FOUND");
  }

  if (requestInput.action !== "resume_turn") {
    if (
      canonicalAction === "continue_current_event" &&
      session.pendingDecision?.eventId !== activeEvent.id
    ) {
      throw new Error("SESSION_CONTINUE_UNAVAILABLE");
    }

    if (
      canonicalAction === "next_event" &&
      (
        !session.pendingDecision ||
        session.pendingDecision.kind === "dimension_redirect" ||
        !session.pendingDecision.actions.includes("next_event") ||
        session.pendingDecision.eventId !== activeEvent.id
      )
    ) {
      throw new Error("SESSION_NEXT_EVENT_UNAVAILABLE");
    }
  }

  const reservation =
    requestInput.action === "resume_turn"
      ? await resumeInterviewUserTurn({
          userId: requestInput.userId,
          sessionId: requestInput.sessionId,
          clientTurnId: requestInput.clientTurnId
        })
      : await reserveInterviewUserTurn({
          userId: requestInput.userId,
          sessionId: requestInput.sessionId,
          activeEventId: activeEvent.id,
          clientTurnId: requestInput.clientTurnId ?? randomUUID(),
          action: canonicalAction as InterviewUserTurnAction,
          rawText:
            requestInput.action === "reply"
              ? requestInput.rawText ?? requestInput.userMessage
              : null,
          inputMode: requestInput.action === "reply" ? requestInput.inputMode : undefined,
          baseMessageSequence: requestInput.baseMessageSequence
        });

  await options?.onTurn?.(reservation.turn);

  if (reservation.kind === "completed") {
    return buildImmediateResponseFromSession(reservation.session);
  }

  canonicalAction = reservation.turn.action;

  if (requestInput.action === "resume_turn") {
    session = {
      ...reservation.session,
      messages: reservation.session.messages.filter(
        (message) => message.sequence <= reservation.turn.baseMessageSequence
      ),
      pendingUserTurn: reservation.turn
    };
    activeEvent =
      session.events.find((event) => event.id === reservation.turn.activeEventId) ??
      getActiveEvent(session);

    if (!activeEvent) {
      await markInterviewUserTurnFailed(reservation.turn.id, "SESSION_EVENT_NOT_FOUND");
      throw new Error("SESSION_EVENT_NOT_FOUND");
    }
  }

  const input: InterviewRespondInput =
    reservation.turn.action === "reply"
      ? {
          userId: requestInput.userId,
          requestId: requestInput.requestId,
          action: "reply",
          sessionId: requestInput.sessionId,
          userMessage: reservation.turn.rawText ?? "",
          rawText: reservation.turn.rawText ?? "",
          inputMode: reservation.turn.inputMode ?? "text",
          clientTurnId: reservation.turn.clientTurnId,
          baseMessageSequence: reservation.turn.baseMessageSequence
        }
      : {
          userId: requestInput.userId,
          requestId: requestInput.requestId,
          action: reservation.turn.action,
          sessionId: requestInput.sessionId,
          clientTurnId: reservation.turn.clientTurnId,
          baseMessageSequence: reservation.turn.baseMessageSequence
        };

  if (canonicalAction === "continue_current_event") {
    const shouldResumeEvent = activeEvent.status !== "active" || Boolean(session.pendingDecision);
    const resumedSession = shouldResumeEvent
      ? await resumeCurrentInterviewEvent(session.id)
      : reservation.session;
    const resumedEvent = resumedSession ? getActiveEvent(resumedSession) : null;

    if (!resumedSession || !resumedEvent) {
      await markInterviewUserTurnFailed(reservation.turn.id, "SESSION_NOT_FOUND");
      throw new Error("SESSION_NOT_FOUND");
    }
    const trace = await createInterviewTurnTrace({
      requestId: input.requestId,
      session: resumedSession,
      activeEvent: resumedEvent,
      action: canonicalAction,
      userTurnId: reservation.turn.id,
      triggerMessageId: reservation.userMessageId
    });

    return {
      session: resumedSession,
      activeEvent: resumedEvent,
      nextSnapshot: resumedEvent.snapshot,
      nextTurnCount: resumedSession.turnCount,
      nextEventTurnCount: resumedEvent.totalMeaningfulReplyCount,
      nextStage: resumedEvent.stage,
      nextEventStatus: "active" as const,
      nextProgressData: null,
      isReadyForDraft: false,
      userMessage: null,
      isMeaningfulReply: false,
      coveredLenses: resumedEvent.coveredLenses,
      roundCoveredLenses: resumedEvent.roundCoveredLenses,
      roundMeaningfulReplyCount: resumedEvent.roundMeaningfulReplyCount,
      totalMeaningfulReplyCount: resumedEvent.totalMeaningfulReplyCount,
      assistantTurn: null,
      assistantAction: "continue_current_event",
      generationTraceId: trace.id,
      requestId: input.requestId ?? null,
      outputOrigin: "llm",
      userTurnId: reservation.turn.id,
      clientTurnId: reservation.turn.clientTurnId,
      userMessageId: reservation.userMessageId,
      questionSpec: createQuestionSpec({
        dimension: resumedSession.dimension,
        stage: resumedEvent.stage,
        snapshot: resumedEvent.snapshot,
        stageIntent: "resume",
        previousSpec: getLatestAssistantQuestionSpec(resumedSession.messages)
      })
    } satisfies PreparedInterviewTurnContext;
  }

  if (canonicalAction === "next_event") {
    const pendingDecision = requestInput.action === "resume_turn"
      ? reservation.session.pendingDecision
      : session.pendingDecision;

    if (
      !pendingDecision ||
      pendingDecision.kind === "dimension_redirect" ||
      !pendingDecision.actions.includes("next_event") ||
      pendingDecision.eventId !== activeEvent.id
    ) {
      throw new Error("SESSION_NEXT_EVENT_UNAVAILABLE");
    }

    const nextSession = await startNextInterviewEvent(session.id, getNextEventOpeningQuestion(session.dimension), {
      requestId: input.requestId,
      userTurnId: reservation.turn.id
    });

    if (!nextSession) {
      await markInterviewUserTurnFailed(reservation.turn.id, "SESSION_NOT_FOUND");
      throw new Error("SESSION_NOT_FOUND");
    }

    return buildImmediateResponseFromSession(nextSession);
  }

  if (input.action !== "reply") {
    await markInterviewUserTurnFailed(reservation.turn.id, "INTERVIEW_ACTION_UNSUPPORTED");
    throw new Error("INTERVIEW_ACTION_UNSUPPORTED");
  }

  const assessment = assessUserTurnMessage(input.userMessage);
  const trace = await createInterviewTurnTrace({
    requestId: input.requestId,
    session,
    activeEvent,
    action: canonicalAction,
    userMessage: input.userMessage,
    inputMode: input.inputMode,
    userTurnId: reservation.turn.id,
    triggerMessageId: reservation.userMessageId
  });
  if (
    assessment.intent === "draft_request" ||
    isBoundaryIntent(assessment.intent) ||
    assessment.intent === "conversation_feedback"
  ) {
    const controlRevision = applyExplicitEvidenceRevisions({
      dimension: session.dimension,
      previousSnapshot: activeEvent.snapshot,
      candidateSnapshot: activeEvent.snapshot,
      message: input.userMessage
    });
    const controlSnapshot = controlRevision.snapshot;

    if (controlRevision.revisions.length) {
      await appendGenerationTraceDecision(trace.id, {
        kind: "interview_evidence_revision",
        decisionOrigin: "deterministic",
        revisions: controlRevision.revisions
      });
    }

    const selectedEvidence = controlRevision.revisions.length
      ? assessDimensionEvidence(session.dimension, controlSnapshot)
      : assessment.intent === "draft_request"
        ? assessSessionDimensionEvidence(session)
        : assessDimensionEvidence(session.dimension, activeEvent.snapshot, activeEvent.snapshotData);
    const evidence = await appendEvidenceDecisionTrace({
      traceId: trace.id,
      detectedIntent: assessment.intent,
      dimension: session.dimension,
      snapshot: controlSnapshot,
      snapshotData: controlRevision.revisions.length ? undefined : activeEvent.snapshotData,
      decisionOrigin: "deterministic",
      extractionSkipped: true,
      turnAdvanced: false,
      evidence: selectedEvidence
    });
    const canGenerate = canGenerateFromEvidence(evidence);
    const completionMode = evidence.completionMode ?? "user_override_partial";
    const assistantTurn = canGenerate
      ? buildControlChoiceAssistantTurn({
          dimension: session.dimension,
          snapshot: controlSnapshot,
          explorationRound: activeEvent.explorationRound,
          completionMode,
          intent: assessment.intent
        })
      : buildBoundaryInsufficientAssistantTurn(session.dimension, assessment.intent);

    return {
      session,
      activeEvent,
      nextSnapshot: controlSnapshot,
      nextTurnCount: session.turnCount,
      nextEventTurnCount: activeEvent.totalMeaningfulReplyCount,
      nextStage: "wrap_up",
      nextEventStatus: "ready_for_choice",
      nextProgressData: canGenerate
        ? {
            kind: "event_complete",
            completionMode
          }
        : {
            kind: "boundary_insufficient",
            reason: "我不再继续追问细节了。"
          },
      isReadyForDraft: canGenerate,
      userMessage: input.userMessage,
      inputMode: input.inputMode,
      isMeaningfulReply: false,
      coveredLenses: activeEvent.coveredLenses,
      roundCoveredLenses: activeEvent.roundCoveredLenses,
      roundMeaningfulReplyCount: activeEvent.roundMeaningfulReplyCount,
      totalMeaningfulReplyCount: activeEvent.totalMeaningfulReplyCount,
      assistantTurn,
      assistantAction: null,
      generationTraceId: trace.id,
      requestId: input.requestId ?? null,
      outputOrigin: "deterministic",
      userTurnId: reservation.turn.id,
      clientTurnId: reservation.turn.clientTurnId,
      userMessageId: reservation.userMessageId,
      questionSpec: null
    } satisfies PreparedInterviewTurnContext;
  }

  if (assessment.intent === "low_signal") {
    await appendEvidenceDecisionTrace({
      traceId: trace.id,
      detectedIntent: assessment.intent,
      dimension: session.dimension,
      snapshot: activeEvent.snapshot,
      snapshotData: activeEvent.snapshotData,
      decisionOrigin: "deterministic",
      extractionSkipped: true,
      turnAdvanced: false
    });
    return {
      session,
      activeEvent,
      nextSnapshot: activeEvent.snapshot,
      nextTurnCount: session.turnCount,
      nextEventTurnCount: activeEvent.totalMeaningfulReplyCount,
      nextStage: activeEvent.stage,
      nextEventStatus: activeEvent.status,
      nextProgressData: null,
      isReadyForDraft: Boolean(session.journalEntry),
      userMessage: input.userMessage,
      inputMode: input.inputMode,
      isMeaningfulReply: false,
      coveredLenses: activeEvent.coveredLenses,
      roundCoveredLenses: activeEvent.roundCoveredLenses,
      roundMeaningfulReplyCount: activeEvent.roundMeaningfulReplyCount,
      totalMeaningfulReplyCount: activeEvent.totalMeaningfulReplyCount,
      assistantTurn: buildLowSignalAssistantTurn(),
      assistantAction: null,
      generationTraceId: trace.id,
      requestId: input.requestId ?? null,
      outputOrigin: "deterministic",
      userTurnId: reservation.turn.id,
      clientTurnId: reservation.turn.clientTurnId,
      userMessageId: reservation.userMessageId,
      questionSpec: null
    } satisfies PreparedInterviewTurnContext;
  }

  if (assessment.intent === "question_repair") {
    await appendEvidenceDecisionTrace({
      traceId: trace.id,
      detectedIntent: assessment.intent,
      dimension: session.dimension,
      snapshot: activeEvent.snapshot,
      snapshotData: activeEvent.snapshotData,
      decisionOrigin: "deterministic",
      extractionSkipped: true,
      turnAdvanced: false
    });
    const previousSpec = getLatestAssistantQuestionSpec(session.messages);
    const nextRepairCount = (previousSpec?.repairCount ?? 0) + 1;
    const requestedSurfaceLevel =
      nextRepairCount >= 2
        ? "concrete_anchor"
        : assessment.repairSignal === "switch_angle"
          ? "concrete_anchor"
          : "simplified";
    const repairSpec = createQuestionSpec({
      dimension: session.dimension,
      stage: activeEvent.stage,
      snapshot: activeEvent.snapshot,
      stageIntent: "repair",
      previousSpec,
      surfaceLevel: requestedSurfaceLevel
    });
    const shouldEscalateRepair = repairSpec.repairCount >= 3;

    return {
      session,
      activeEvent,
      nextSnapshot: activeEvent.snapshot,
      nextTurnCount: session.turnCount,
      nextEventTurnCount: activeEvent.totalMeaningfulReplyCount,
      nextStage: activeEvent.stage,
      nextEventStatus: shouldEscalateRepair ? "ready_for_choice" : "active",
      nextProgressData: shouldEscalateRepair
        ? {
            kind: "boundary_insufficient",
            reason: "我先不继续换问法了。你可以只补一句关键内容，也可以换个片段，或者先整理当前版本。"
          }
        : null,
      isReadyForDraft: Boolean(session.journalEntry),
      userMessage: input.userMessage,
      inputMode: input.inputMode,
      isMeaningfulReply: false,
      coveredLenses: activeEvent.coveredLenses,
      roundCoveredLenses: activeEvent.roundCoveredLenses,
      roundMeaningfulReplyCount: activeEvent.roundMeaningfulReplyCount,
      totalMeaningfulReplyCount: activeEvent.totalMeaningfulReplyCount,
      assistantTurn: shouldEscalateRepair
        ? buildRepairEscalationAssistantTurn()
        : renderDeterministicRepairTurn({
            dimension: session.dimension,
            stage: activeEvent.stage,
            snapshot: activeEvent.snapshot,
            spec: repairSpec,
            previousQuestion: getLatestAssistantQuestion(session.messages),
            hadReflectionSceneDenial: session.dimension === "reflection" && Boolean(findLatestReflectionSceneDenial(session.messages))
          }),
      assistantAction: null,
      generationTraceId: trace.id,
      requestId: input.requestId ?? null,
      outputOrigin: "deterministic",
      userTurnId: reservation.turn.id,
      clientTurnId: reservation.turn.clientTurnId,
      userMessageId: reservation.userMessageId,
      questionSpec: shouldEscalateRepair ? null : repairSpec
    } satisfies PreparedInterviewTurnContext;
  }

  const isMeaningfulReply = assessment.isMeaningful;
  let rawNextSnapshot: JoySnapshot;
  try {
    rawNextSnapshot = assessment.shouldExtractSnapshot
      ? await extractJoySnapshotWithAI({
          session,
          userMessage: input.userMessage,
          signal: options?.signal,
          traceId: trace.id,
          requestId: input.requestId
        })
      : activeEvent.snapshot;
  } catch (error) {
    if (options?.signal?.aborted) {
      await cancelGenerationTrace(trace.id);
      await cancelInterviewUserTurn(reservation.turn.id);
    } else {
      await failGenerationTrace(trace.id, error instanceof Error ? error.name : "EXTRACT_FAILED");
      await markInterviewUserTurnFailed(
        reservation.turn.id,
        getUserTurnErrorCode(error, "EXTRACT_FAILED")
      );
    }
    throw error;
  }
  options?.signal?.throwIfAborted();
  const revisedExtraction = applyExplicitEvidenceRevisions({
    dimension: session.dimension,
    previousSnapshot: activeEvent.snapshot,
    candidateSnapshot: rawNextSnapshot,
    message: input.userMessage
  });
  const nextSnapshot =
    session.dimension === "gratitude"
      ? applyGratitudeEvidenceState({
          previous: activeEvent.snapshot,
          next: revisedExtraction.snapshot,
          questionSpec: getLatestAssistantQuestionSpec(session.messages),
          assessment
        })
      : revisedExtraction.snapshot;
  const evidenceRevisions = revisedExtraction.revisions;

  if (evidenceRevisions.length) {
    await appendGenerationTraceDecision(trace.id, {
      kind: "interview_evidence_revision",
      decisionOrigin: "deterministic",
      revisions: evidenceRevisions
    });
  }
  const nextTurnCount = session.turnCount + (assessment.shouldAdvanceTurn ? 1 : 0);
  const nextEventTurnCount = activeEvent.totalMeaningfulReplyCount + (assessment.shouldAdvanceRound ? 1 : 0);
  const derivedNextStage = getNextStage(session.dimension, nextSnapshot, nextEventTurnCount);
  const nextLenses = deriveInterviewLenses(nextSnapshot);
  const coveredLenses = uniqueLenses(activeEvent.coveredLenses, nextLenses);
  const roundCoveredLenses = isMeaningfulReply
    ? uniqueLenses(activeEvent.roundCoveredLenses, nextLenses)
    : activeEvent.roundCoveredLenses;
  const roundMeaningfulReplyCount = activeEvent.roundMeaningfulReplyCount + (assessment.shouldAdvanceRound ? 1 : 0);
  const totalMeaningfulReplyCount = nextEventTurnCount;
  const redirectReason = getImprovementRedirectReason({
    dimension: session.dimension,
    session,
    nextSnapshot,
    userMessage: input.userMessage,
    isMeaningfulReply,
    nextEventTurnCount
  });
  const choiceCompletionMode = getChoiceCompletionMode({
    dimension: session.dimension,
    activeEvent,
    nextSnapshot,
    nextStage: derivedNextStage,
    userMessage: input.userMessage,
    isMeaningfulReply,
    nextEventTurnCount,
    nextRoundMeaningfulReplyCount: roundMeaningfulReplyCount,
    nextLenses,
    questionSpec: createQuestionSpec({
      dimension: session.dimension,
      stage: derivedNextStage,
      snapshot: nextSnapshot,
      stageIntent: "advance"
    })
  });
  const shouldOfferChoiceNow = Boolean(choiceCompletionMode);
  const shouldOfferRedirectNow = Boolean(redirectReason) && !shouldOfferChoiceNow;
  const nextStage = normalizeActiveStageBeforeChoice({
    nextStage: shouldOfferChoiceNow ? "wrap_up" : derivedNextStage,
    shouldOfferChoiceNow: shouldOfferChoiceNow || shouldOfferRedirectNow
  });
  await appendEvidenceDecisionTrace({
    traceId: trace.id,
    detectedIntent: assessment.intent,
    dimension: session.dimension,
    snapshot: nextSnapshot,
    decisionOrigin: shouldOfferChoiceNow || shouldOfferRedirectNow ? "deterministic" : "llm",
    extractionSkipped: !assessment.shouldExtractSnapshot,
    turnAdvanced: assessment.shouldAdvanceTurn
  });

  return {
    session,
    activeEvent,
    nextSnapshot,
    nextTurnCount,
    nextEventTurnCount,
    nextStage,
    nextEventStatus: shouldOfferChoiceNow || shouldOfferRedirectNow ? "ready_for_choice" : "active",
    nextProgressData: shouldOfferChoiceNow
      ? {
          kind: "event_complete",
          completionMode: choiceCompletionMode ?? undefined
        }
      : shouldOfferRedirectNow && redirectReason
        ? {
            kind: "dimension_redirect",
            targetDimension: "improvement",
            reason: redirectReason
          }
        : null,
    isReadyForDraft: shouldOfferChoiceNow || Boolean(session.journalEntry),
    userMessage: input.userMessage,
    inputMode: input.inputMode,
    isMeaningfulReply,
    coveredLenses,
    roundCoveredLenses,
    roundMeaningfulReplyCount,
    totalMeaningfulReplyCount,
    assistantTurn: shouldOfferChoiceNow
      ? buildChoiceAssistantTurn(session.dimension, nextSnapshot, activeEvent.explorationRound, choiceCompletionMode ?? "complete")
      : shouldOfferRedirectNow && redirectReason
        ? buildRedirectAssistantTurn(redirectReason, nextSnapshot)
        : null,
    assistantAction: shouldOfferChoiceNow || shouldOfferRedirectNow ? null : "reply",
    generationTraceId: trace.id,
    requestId: input.requestId ?? null,
    outputOrigin: shouldOfferChoiceNow || shouldOfferRedirectNow ? "deterministic" : "llm",
    userTurnId: reservation.turn.id,
    clientTurnId: reservation.turn.clientTurnId,
    userMessageId: reservation.userMessageId,
    questionSpec: shouldOfferChoiceNow || shouldOfferRedirectNow
      ? null
      : shouldPreserveReflectionConcreteInsightAfterRepair({
            dimension: session.dimension,
            stage: nextStage,
            snapshot: nextSnapshot,
            messages: session.messages,
            userMessage: input.userMessage,
            isMeaningfulReply
          })
        ? createQuestionSpec({
            dimension: session.dimension,
            stage: nextStage,
            snapshot: nextSnapshot,
            stageIntent: "advance",
            target: "insight_evidence",
            surfaceLevel: "concrete_anchor"
          })
        : createQuestionSpec({
            dimension: session.dimension,
            stage: nextStage,
            snapshot: nextSnapshot,
            stageIntent: "advance"
          })
  } satisfies PreparedInterviewTurnContext;
}

export async function prepareJoyInterviewResponse(input: InterviewRespondInput) {
  const acceptedTurnRef: { current: InterviewUserTurnRecord | null } = { current: null };
  let prepared;

  try {
    prepared = await prepareJoyInterviewResponseContext(input, {
      onTurn: async (turn) => {
        acceptedTurnRef.current = turn;
        await recordAcceptedUserTurn(input, turn);
      }
    });
  } catch (error) {
    await recordRejectedUserTurn(input, error);

    const acceptedTurn = acceptedTurnRef.current;

    if (acceptedTurn?.status === "processing") {
      if (error instanceof Error && error.name === "AbortError") {
        await cancelInterviewUserTurn(acceptedTurn.id);
        await recordUserTurnLifecycleEvent({
          eventName: "user_turn_canceled",
          userId: input.userId,
          sessionId: input.sessionId,
          requestId: input.requestId,
          clientTurnId: acceptedTurn.clientTurnId,
          turnId: acceptedTurn.id,
          action: acceptedTurn.action,
          status: "canceled",
          attemptCount: acceptedTurn.attemptCount,
          inputMode: acceptedTurn.inputMode ?? null
        });
      } else {
        await markInterviewUserTurnFailed(
          acceptedTurn.id,
          getUserTurnErrorCode(error, "INTERVIEW_PREPARE_FAILED")
        );
      }
    }

    throw error;
  }

  if (
    "assistantMessage" in prepared &&
    acceptedTurnRef.current?.status === "processing"
  ) {
    await recordUserTurnLifecycleEvent({
      eventName: "user_turn_completed",
      userId: input.userId,
      sessionId: input.sessionId,
      requestId: input.requestId,
      clientTurnId: acceptedTurnRef.current.clientTurnId,
      turnId: acceptedTurnRef.current.id,
      action: acceptedTurnRef.current.action,
      status: "completed",
      attemptCount: acceptedTurnRef.current.attemptCount,
      inputMode: acceptedTurnRef.current.inputMode ?? null,
      dimension: prepared.session.dimension
    });
  }

  if (!("assistantMessage" in prepared)) {
    const progressData = prepared.nextProgressData;

    if (
      input.action === "reply" &&
      prepared.isMeaningfulReply &&
      prepared.activeEvent.totalMeaningfulReplyCount === 0 &&
      prepared.totalMeaningfulReplyCount > 0
    ) {
      await recordAnalyticsEvent({
        eventName: "interview_first_user_reply",
        userId: prepared.session.userId,
        sessionId: prepared.session.id,
        dedupeKey: `interview_first_user_reply:${prepared.session.id}`,
        properties: {
          dimension: prepared.session.dimension
        }
      });
    }

    if (progressData?.kind === "boundary_insufficient") {
      await recordAnalyticsEvent({
        eventName: "interview_boundary_insufficient_shown",
        userId: prepared.session.userId,
        sessionId: prepared.session.id,
        dedupeKey: `interview_boundary_insufficient_shown:${prepared.session.id}:${prepared.activeEvent.id}`,
        properties: {
          dimension: prepared.session.dimension
        }
      });
    }

    if (progressData?.kind === "dimension_redirect") {
      await recordAnalyticsEvent({
        eventName: "interview_dimension_redirect_shown",
        userId: prepared.session.userId,
        sessionId: prepared.session.id,
        dedupeKey: `interview_dimension_redirect_shown:${prepared.session.id}:${prepared.activeEvent.id}`,
        properties: {
          dimension: prepared.session.dimension,
          targetDimension: progressData.targetDimension
        }
      });
    }

    if (input.action === "reply" && prepared.userMessage) {
      const assessment = assessUserTurnMessage(prepared.userMessage);

      if (assessment.intent === "boundary_stop" || assessment.intent === "hostile_boundary") {
        await recordAnalyticsEvent({
          eventName: "interview_boundary_stop_triggered",
          userId: prepared.session.userId,
          sessionId: prepared.session.id,
          dedupeKey: `interview_boundary_stop_triggered:${prepared.session.id}:${prepared.activeEvent.id}`,
          properties: {
            dimension: prepared.session.dimension
          }
        });
      }
    }
  }

  if ("assistantMessage" in prepared) {
    return prepared;
  }

  try {
    return await resolvePreparedInterviewTurn(prepared);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      await cancelGenerationTrace(prepared.generationTraceId);
      await cancelInterviewUserTurn(prepared.userTurnId);
      await recordUserTurnLifecycleEvent({
        eventName: "user_turn_canceled",
        userId: prepared.session.userId,
        sessionId: prepared.session.id,
        requestId: prepared.requestId,
        clientTurnId: prepared.clientTurnId,
        turnId: prepared.userTurnId,
        action: prepared.userMessage ? "reply" : "continue_current_event",
        status: "canceled",
        inputMode: prepared.inputMode ?? null,
        dimension: prepared.session.dimension
      });
    } else {
      await failGenerationTrace(
        prepared.generationTraceId,
        error instanceof Error ? error.name : "ASSISTANT_GENERATION_FAILED"
      );
      await markInterviewUserTurnFailed(
        prepared.userTurnId,
        getUserTurnErrorCode(error, "ASSISTANT_GENERATION_FAILED")
      );
    }
    throw error;
  }
}

export async function completeJoyInterviewResponse(
  input: ResolvedPreparedInterviewTurn,
  options?: { signal?: AbortSignal }
) {
  if (options?.signal?.aborted) {
    await cancelGenerationTrace(input.generationTraceId);
    await cancelInterviewUserTurn(input.userTurnId);
    await recordUserTurnLifecycleEvent({
      eventName: "user_turn_canceled",
      userId: input.session.userId,
      sessionId: input.session.id,
      requestId: input.requestId,
      clientTurnId: input.clientTurnId,
      turnId: input.userTurnId,
      action: input.userMessage ? "reply" : "continue_current_event",
      status: "canceled",
      inputMode: input.inputMode ?? null,
      dimension: input.session.dimension
    });
    options.signal.throwIfAborted();
  }
  let updatedSession;
  try {
    updatedSession = await appendJoyInterviewTurn({
    sessionId: input.session.id,
    activeEventId: input.activeEvent.id,
    userMessage: input.userMessage ?? undefined,
    inputMode: input.inputMode,
    assistantTurn: input.assistantTurn,
    snapshot: input.nextSnapshot,
    eventStatus: input.nextEventStatus,
    progressData: input.nextProgressData,
    nextStage: input.nextStage,
    nextStatus: "active",
    nextTurnCount: input.nextTurnCount,
    coveredLenses: input.coveredLenses,
    roundCoveredLenses: input.roundCoveredLenses,
    roundMeaningfulReplyCount: input.roundMeaningfulReplyCount,
    totalMeaningfulReplyCount: input.totalMeaningfulReplyCount,
    draftSummary:
      getManualClue(input.nextSnapshot) ??
      getDelightSignature(input.nextSnapshot) ??
      getJoySource(input.nextSnapshot) ??
      getJoyMoment(input.nextSnapshot),
    completedAt: null,
    generationTraceId: input.generationTraceId,
    requestId: input.requestId,
    outputOrigin: input.outputOrigin,
    userTurnId: input.userTurnId
    });
  } catch (error) {
    if (options?.signal?.aborted) {
      await cancelGenerationTrace(input.generationTraceId);
      await cancelInterviewUserTurn(input.userTurnId);
      await recordUserTurnLifecycleEvent({
        eventName: "user_turn_canceled",
        userId: input.session.userId,
        sessionId: input.session.id,
        requestId: input.requestId,
        clientTurnId: input.clientTurnId,
        turnId: input.userTurnId,
        action: input.userMessage ? "reply" : "continue_current_event",
        status: "canceled",
        inputMode: input.inputMode ?? null,
        dimension: input.session.dimension
      });
    } else {
      await failGenerationTrace(input.generationTraceId, error instanceof Error ? error.name : "TRACE_PERSIST_FAILED");
      await markInterviewUserTurnFailed(
        input.userTurnId,
        getUserTurnErrorCode(error, "TRACE_PERSIST_FAILED")
      );
    }
    throw error;
  }

  if (!updatedSession) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (input.userMessage && !options?.signal?.aborted) {
    await recordAnalyticsEvent({
      eventName: "interview_response_submitted",
      userId: updatedSession.userId,
      sessionId: updatedSession.id,
      dedupeKey: `interview_response_submitted:${updatedSession.id}:${updatedSession.turnCount}`,
      properties: {
        dimension: updatedSession.dimension,
        inputMode: input.inputMode ?? null
      }
    });
  }

  await recordUserTurnLifecycleEvent({
    eventName: "user_turn_completed",
    userId: updatedSession.userId,
    sessionId: updatedSession.id,
    requestId: input.requestId,
    clientTurnId: input.clientTurnId,
    turnId: input.userTurnId,
    action: input.userMessage ? "reply" : "continue_current_event",
    status: "completed",
    inputMode: input.inputMode ?? null,
    dimension: updatedSession.dimension
  });

  const visibleText = getVisibleAssistantText(input.assistantTurn);

  return {
    assistantMessage: visibleText.combinedText,
    assistantTurn: input.assistantTurn,
    sessionStatus: updatedSession.status,
    turnCount: updatedSession.turnCount,
    snapshot: updatedSession.snapshot,
    snapshotData: updatedSession.snapshotData,
    isReadyForDraft: updatedSession.draftGenerationUnlocked || input.isReadyForDraft,
    session: updatedSession
  };
}

export async function respondToJoyInterview(input: InterviewRespondInput) {
  const prepared = await prepareJoyInterviewResponse(input);

  if ("assistantMessage" in prepared) {
    return prepared;
  }

  return completeJoyInterviewResponse(prepared);
}

export async function streamJoyInterviewResponse(
  input: InterviewRespondInput,
  callbacks: {
    onPhase: (phase: StreamingPhase) => Promise<void> | void;
    onDelta: (delta: { target: StreamingTarget; text: string }) => Promise<void> | void;
    onTurn?: (turn: InterviewUserTurnRecord) => Promise<void> | void;
  },
  options?: { signal?: AbortSignal }
) {
  const signal = options?.signal;
  signal?.throwIfAborted();
  const acceptedTurnRef: { current: InterviewUserTurnRecord | null } = { current: null };
  let prepared;

  try {
    prepared = await prepareJoyInterviewResponseContext(input, {
      signal,
      onTurn: async (turn) => {
        acceptedTurnRef.current = turn;
        await callbacks.onTurn?.(turn);
        await recordAcceptedUserTurn(input, turn);
      }
    });
  } catch (error) {
    await recordRejectedUserTurn(input, error);

    const acceptedTurn = acceptedTurnRef.current;

    if (acceptedTurn?.status === "processing") {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        await cancelInterviewUserTurn(acceptedTurn.id);
        await recordUserTurnLifecycleEvent({
          eventName: "user_turn_canceled",
          userId: input.userId,
          sessionId: input.sessionId,
          requestId: input.requestId,
          clientTurnId: acceptedTurn.clientTurnId,
          turnId: acceptedTurn.id,
          action: acceptedTurn.action,
          status: "canceled",
          attemptCount: acceptedTurn.attemptCount,
          inputMode: acceptedTurn.inputMode ?? null
        });
      } else {
        await markInterviewUserTurnFailed(
          acceptedTurn.id,
          getUserTurnErrorCode(error, "INTERVIEW_PREPARE_FAILED")
        );
      }
    }

    throw error;
  }

  if (
    "assistantMessage" in prepared &&
    acceptedTurnRef.current?.status === "processing"
  ) {
    await recordUserTurnLifecycleEvent({
      eventName: "user_turn_completed",
      userId: input.userId,
      sessionId: input.sessionId,
      requestId: input.requestId,
      clientTurnId: acceptedTurnRef.current.clientTurnId,
      turnId: acceptedTurnRef.current.id,
      action: acceptedTurnRef.current.action,
      status: "completed",
      attemptCount: acceptedTurnRef.current.attemptCount,
      inputMode: acceptedTurnRef.current.inputMode ?? null,
      dimension: prepared.session.dimension
    });
  }
  const emitText = async (target: StreamingTarget, text: string, chunkSize = SUMMARY_STREAM_CHUNK_SIZE) => {
    for (const chunk of splitStreamingText(text, chunkSize)) {
      signal?.throwIfAborted();
      await callbacks.onDelta({
        target,
        text: chunk
      });
    }
  };
  const emitRawDelta = async (target: StreamingTarget, text: string) => {
    signal?.throwIfAborted();
    await callbacks.onDelta({
      target,
      text
    });
  };

  if ("assistantMessage" in prepared) {
    const visibleText = getVisibleAssistantText(prepared.assistantTurn);

    if (visibleText.firstBubble) {
      await callbacks.onPhase("summary");
      await emitText("summary", visibleText.firstBubble);
    }

    if (visibleText.question || prepared.assistantMessage) {
      await callbacks.onPhase("question");
      await emitText("question", visibleText.question || prepared.assistantMessage, 80);
    }

    return prepared;
  }

  if (prepared.assistantTurn) {
    const resolvedPrepared: ResolvedPreparedInterviewTurn = {
      ...prepared,
      assistantTurn: prepared.assistantTurn,
      assistantAction: null
    };
    const visibleText = getVisibleAssistantText(resolvedPrepared.assistantTurn);

    if (visibleText.firstBubble) {
      await callbacks.onPhase("summary");
      await emitText("summary", visibleText.firstBubble);
    }

    if (visibleText.question) {
      await callbacks.onPhase("question");
      await emitText("question", visibleText.question, 80);
    }

    return completeJoyInterviewResponse(resolvedPrepared, { signal });
  }

  await callbacks.onPhase("thinking");

  const streamedText: Record<StreamingTarget, string> = {
    summary: "",
    question: ""
  };
  const shouldBufferContinuationOutput = true;
  // Questions pass through deterministic semantic and repetition guards after model generation.
  // Buffer the question until those guards have selected the final user-visible wording.
  const shouldBufferQuestionOutput = true;
  let emittedSummary = "";
  let activePhase: StreamingPhase | null = "thinking";
  const emitPhase = async (phase: StreamingPhase) => {
    if (activePhase === phase) {
      return;
    }

    activePhase = phase;
    await callbacks.onPhase(phase);
  };
  const emitSummaryOnce = async (summary: string) => {
    if (!summary || emittedSummary) {
      return;
    }

    await emitPhase("summary");
    await emitText("summary", summary);
    emittedSummary = summary;
    streamedText.summary = summary;
  };
  let completed: ResolvedPreparedInterviewTurn;
  try {
    completed = await resolvePreparedInterviewTurn(prepared, {
      signal,
      onDelta: async (delta) => {
      if (!delta.text) {
        return;
      }

      streamedText[delta.target] += delta.text;

      if (shouldBufferContinuationOutput) {
        return;
      }

      if (delta.target === "summary") {
        return;
      }

      if (streamedText.summary) {
        const normalizedSummary = normalizeThinkingSummary({
          dimension: prepared.session.dimension,
          stage: prepared.nextStage,
          snapshot: prepared.nextSnapshot,
          assistantAction: prepared.assistantAction,
          summary: streamedText.summary,
          userMessage: prepared.userMessage
        });

        if (normalizedSummary) {
          await emitSummaryOnce(normalizedSummary);
        }

        streamedText.summary = normalizedSummary;
      }

      if (shouldBufferQuestionOutput) {
        return;
      }

      await emitPhase(delta.target);
      await emitRawDelta(delta.target, delta.text);
      }
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      await cancelGenerationTrace(prepared.generationTraceId);
      await cancelInterviewUserTurn(prepared.userTurnId);
      await recordUserTurnLifecycleEvent({
        eventName: "user_turn_canceled",
        userId: prepared.session.userId,
        sessionId: prepared.session.id,
        requestId: prepared.requestId,
        clientTurnId: prepared.clientTurnId,
        turnId: prepared.userTurnId,
        action: prepared.userMessage ? "reply" : "continue_current_event",
        status: "canceled",
        inputMode: prepared.inputMode ?? null,
        dimension: prepared.session.dimension
      });
    } else {
      await failGenerationTrace(
        prepared.generationTraceId,
        error instanceof Error ? error.name : "ASSISTANT_STREAM_FAILED"
      );
      await markInterviewUserTurnFailed(
        prepared.userTurnId,
        getUserTurnErrorCode(error, "ASSISTANT_STREAM_FAILED")
      );
    }
    throw error;
  }
  const completedVisibleText = getVisibleAssistantText(completed.assistantTurn);

  if (
    completedVisibleText.firstBubble &&
    !emittedSummary
  ) {
    await emitSummaryOnce(completedVisibleText.firstBubble);
  }

  if ((shouldBufferContinuationOutput || shouldBufferQuestionOutput) && completedVisibleText.question) {
    await emitPhase("question");
    await emitText("question", completedVisibleText.question, 80);
  }

  if (
    !shouldBufferContinuationOutput &&
    !shouldBufferQuestionOutput &&
    completedVisibleText.question &&
    completedVisibleText.question.startsWith(streamedText.question) &&
    streamedText.question !== completedVisibleText.question
  ) {
    await emitPhase("question");
    await emitText("question", completedVisibleText.question.slice(streamedText.question.length), 80);
  }

  signal?.throwIfAborted();
  return completeJoyInterviewResponse(completed, { signal });
}

export async function generateJoyInterviewDraft(
  userId: string,
  sessionIds: string[],
  options?: { requestId?: string | null }
) {
  if (sessionIds.length !== 1) {
    throw new DraftGenerationError("SESSION_BATCH_UNSUPPORTED", false);
  }

  const session = await findJoyInterviewSessionById(sessionIds[0], userId);

  if (!session) {
    throw new DraftGenerationError("SESSION_NOT_FOUND", false);
  }

  const trace = await createAIGenerationTrace({
    requestId: options?.requestId,
    userId: session.userId,
    sessionId: session.id,
    dimension: session.dimension,
    artifactType: "dimension_journal",
    artifactId: session.journalEntry?.id ?? null,
    artifactVersion: (session.journalEntry?.generationVersion ?? 0) + 1,
    contextSnapshot: {
      action: session.journalEntry ? "regenerate_dimension_journal" : "generate_dimension_journal",
      entryDate: session.entryDate,
      stage: session.stage,
      messageIds: session.messages.map((message) => message.id),
      messages: session.messages.map((message) => ({
        id: message.id,
        role: message.role,
        sequence: message.sequence,
        content: message.content
      })),
      eventIds: session.events.map((event) => event.id),
      events: session.events.map((event) => ({
        id: event.id,
        sequence: event.sequence,
        snapshot: event.snapshotData ?? event.snapshot
      })),
      currentDraft: session.journalEntry
        ? { title: session.journalEntry.title, content: session.journalEntry.content }
        : null
    }
  });
  const evidence = assessSessionDimensionEvidence(session);
  await appendGenerationTraceDecision(trace.id, {
    kind: "draft_evidence_gate",
    detectedIntent: "draft_request",
    readiness: evidence.readiness,
    missingSlots: evidence.missingSlots,
    completionMode: evidence.completionMode,
    decisionOrigin: "deterministic",
    extractionSkipped: true,
    turnAdvanced: false
  });
  if (!canGenerateFromEvidence(evidence)) {
    await cancelGenerationTrace(trace.id, "DRAFT_GENERATE_NOT_READY");
    throw new DraftGenerationError("DRAFT_GENERATE_NOT_READY", false, "Draft generation is not available yet.");
  }

  let draftEntry;

  try {
    draftEntry = await generateJoyDraftWithAI(session, {
      traceId: trace.id,
      requestId: options?.requestId
    });
  } catch (error) {
    await failGenerationTrace(trace.id, error instanceof Error ? error.name : "DRAFT_GENERATE_UPSTREAM_ERROR");
    throw new DraftGenerationError("DRAFT_GENERATE_UPSTREAM_ERROR", true, "Draft generation failed upstream.", error);
  }

  let draftSession;

  try {
    draftSession = await saveJoyInterviewDraft(session.id, draftEntry, {
      traceId: trace.id,
      requestId: options?.requestId
    });
  } catch (error) {
    await failGenerationTrace(trace.id, error instanceof Error ? error.name : "DRAFT_PERSIST_FAILED");
    if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError) {
      throw new DraftGenerationError("DRAFT_GENERATE_DB_ERROR", true, "Draft persistence failed.", error);
    }

    throw new DraftGenerationError("DRAFT_GENERATE_UNKNOWN_ERROR", true, "Draft generation failed unexpectedly.", error);
  }

  // Fire-and-forget: extract user memories from this session
  void extractMemoriesFromSession({
    userId: session.userId,
    sessionId: session.id,
    session,
    draftEntry
  }).catch(() => {
    // Errors are already caught and logged inside extractMemoriesFromSession
  });

  if (!draftSession?.journalEntry) {
    throw new DraftGenerationError("DRAFT_GENERATE_DB_ERROR", true, "Draft record was not created.");
  }

  await recordAnalyticsEvent({
    eventName: "interview_draft_generated",
    userId: session.userId,
    sessionId: session.id,
    entryId: draftSession.journalEntry.id,
    dedupeKey: `interview_draft_generated:${session.id}:${draftSession.journalEntry.id}`,
    properties: {
      dimension: session.dimension
    }
  });

  return {
    draftEntry: draftSession.journalEntry,
    session: draftSession
  };
}

export async function saveGeneratedJoyEntry(userId: string, sessionId: string) {
  const existingSession = await findJoyInterviewSessionById(sessionId, userId);

  if (!existingSession) {
    throw new Error("DRAFT_NOT_FOUND");
  }

  const savedSession = await markJoyEntrySaved(sessionId);

  if (!savedSession?.journalEntry) {
    throw new Error("DRAFT_NOT_FOUND");
  }

  await recordAnalyticsEvent({
    eventName: "interview_draft_saved",
    userId,
    sessionId,
    entryId: savedSession.journalEntry.id,
    dedupeKey: `interview_draft_saved:${sessionId}:${savedSession.journalEntry.id}`,
    properties: {
      dimension: savedSession.dimension
    }
  });

  return {
    draftEntry: savedSession.journalEntry,
    session: savedSession
  };
}
