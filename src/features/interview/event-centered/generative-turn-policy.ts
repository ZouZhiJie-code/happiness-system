import type {
  EventCenteredGenerativeTurn,
  EventCenteredUnderstandingDecision
} from "@/features/interview/event-centered/ai-contract";
import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import { resolveEventCenteredFocusOptions } from "@/features/interview/event-centered/event-focus-options";
import { EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION } from "@/features/interview/event-centered/generative-strategy";
import type {
  EventCenteredPolicyOutcomeDraft,
  EventCenteredTurnPolicyResult
} from "@/features/interview/event-centered/interview-policy";
import {
  renderFeelingThoughtRepairQuestion
} from "@/features/interview/event-centered/angle-strategies-feeling-thought";
import {
  renderRelationshipOrActionRepairQuestion
} from "@/features/interview/event-centered/angle-strategies-relationship-action";
import {
  getEventCenteredReflectionMaterialStatus,
  hasEventCenteredUnableAnswerSignal as hasSharedEventCenteredUnableAnswerSignal
} from "@/features/interview/event-centered/interview-policy";
import {
  EVENT_CENTERED_HONEST_LIMIT_RESPONSE,
  EVENT_CENTERED_SECOND_CHECKPOINT_PAUSE_RESPONSE
} from "@/features/interview/event-centered/turn-quality";
import type {
  EventCenteredAssistantPayload,
  EventCenteredDialogueState,
  EventCenteredQuestionSpec,
  EventCenteredRespondAction
} from "@/types/event-centered-dialogue";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";
import { isEventCenteredThoughtOnlyScope } from "@/features/interview/event-centered-release";

export const EVENT_CENTERED_THOUGHT_TRANSITION_RESPONSE = "还可以继续和我聊聊哦～";

function cloneState(state: EventCenteredDialogueState): EventCenteredDialogueState {
  return JSON.parse(JSON.stringify(state)) as EventCenteredDialogueState;
}

function ensureAngleRun(state: EventCenteredDialogueState, angle: JournalEventAngle) {
  const fallback = createInitialEventCenteredDialogueState().angleRuns[angle]!;
  const current = state.angleRuns[angle];
  const run = current
    ? {
        ...fallback,
        ...current,
        answeredTargets: [...(current.answeredTargets ?? [])],
        askedTargets: [...(current.askedTargets ?? [])],
        deniedTargets: [...(current.deniedTargets ?? [])]
      }
    : {
        ...fallback,
        answeredTargets: [],
        askedTargets: [],
        deniedTargets: []
      };
  state.angleRuns[angle] = run;
  return run;
}

function addUnique(values: string[], value: string | null | undefined) {
  if (value && !values.includes(value)) values.push(value);
}

function clearCurrentQuestion(state: EventCenteredDialogueState) {
  state.currentQuestion = null;
  state.currentQuestionIntent = null;
}

function updateCurrentQuestionIntent(input: {
  state: EventCenteredDialogueState;
  turn: EventCenteredGenerativeTurn;
  targetId: string;
}) {
  const semanticGoal = input.turn.semanticPlan.expectedUnderstandingDelta?.trim();
  const minimumAnswerScope =
    input.turn.semanticPlan.outcomeAssessment?.missingUnderstanding?.trim();
  input.state.currentQuestionIntent = semanticGoal
    ? {
        targetId: input.targetId,
        semanticGoal,
        minimumAnswerScope: minimumAnswerScope || null
      }
    : null;
}

function evidenceStatements(input: {
  turn: EventCenteredGenerativeTurn;
  facts: JournalEventFactRecord[];
}) {
  const byRef = new Map(input.facts.map((fact) => [fact.id, fact.statement]));
  input.turn.understanding.factDeltas.forEach((fact, index) => {
    byRef.set(`new:${index + 1}`, fact.statement);
  });
  return byRef;
}

export function toEventCenteredUnderstandingDecision(input: {
  turn: EventCenteredGenerativeTurn;
  rawText: string;
  facts: JournalEventFactRecord[];
}): EventCenteredUnderstandingDecision {
  const statements = evidenceStatements(input);
  const outcome = input.turn.decision.outcomeCandidate;
  const hypothesis = input.turn.understanding.tentativeInterpretation;
  const multipleEvents = input.turn.understanding.eventBoundary === "multiple_events";
  const eventOptions = multipleEvents
    ? resolveEventCenteredFocusOptions({
        rawText: input.rawText,
        suggestedOptions: input.turn.understanding.eventOptions
      }) ?? []
    : [];

  return {
    eventBoundary: input.turn.understanding.eventBoundary,
    coreEventIdentifiable: multipleEvents
      ? false
      : input.turn.understanding.coreEventIdentifiable,
    answerSignal: multipleEvents
      ? "partly_answered"
      : input.turn.understanding.answerStatus,
    facts: multipleEvents ? [] : input.turn.understanding.factDeltas,
    angleEvidence: [],
    outcomeCandidate: outcome
      ? {
          angle: outcome.angle,
          kind: "insight",
          statement: outcome.statement,
          supportFactStatements: outcome.supportEvidenceRefs
            .map((ref) => statements.get(ref))
            .filter((statement): statement is string => Boolean(statement))
        }
      : null,
    unsupportedHypothesis: hypothesis && input.turn.decision.turnAction === "ask"
      ? {
          statement: hypothesis.statement,
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation"
        }
      : null,
    adviceRequest: null,
    eventOptions,
    correctionTargetHint:
      input.turn.understanding.correctionOrBoundary?.kind === "correction"
        ? input.turn.understanding.correctionOrBoundary.reason
        : null,
    boundaryReason:
      input.turn.understanding.correctionOrBoundary?.kind === "boundary"
        ? input.turn.understanding.correctionOrBoundary.reason
        : null
  };
}

function questionSpec(input: {
  state: EventCenteredDialogueState;
  angle: JournalEventAngle | null;
  target: string;
  opportunityNumber: number | null;
  cognitiveAction: EventCenteredGenerativeTurn["decision"]["cognitiveAction"];
  surfaceLevel?: EventCenteredQuestionSpec["surfaceLevel"];
  repairCount?: number;
}): EventCenteredQuestionSpec {
  return {
    phase: input.state.phase,
    angle: input.angle,
    target: input.target,
    opportunityNumber: input.opportunityNumber,
    surfaceLevel: input.surfaceLevel ?? "open_anchor",
    anchorText: null,
    repairCount: input.repairCount ?? 0,
    cognitiveAction: input.cognitiveAction
  };
}

const PURE_UNABLE_ANSWER_PATTERN = /^(?:我)?(?:现在|暂时|一时|一下子|还是|真的|有点)?(?:还)?(?:说不清(?:楚)?|讲不清(?:楚)?|分不清(?:楚)?|想不到|想不出来)(?:这个|这些|两边|哪一个|是什么)?(?:了)?[。.!！?？]*$/u;
const EXPLICIT_REFUSAL_PATTERN = /(?:不想|不愿意|不打算|拒绝)(?:再|继续)?(?:说|讲|回答|聊|问|追问)|(?:别|不要|不用|不必)(?:再|继续)?(?:问|追问|聊|说)|不说了|不聊了|不继续了?|先到这(?:里)?|到此为止|先停(?:一下|下|在这里)?|停止(?:追问|提问|聊|问)|结束(?:吧|了)/u;

export function hasEventCenteredUnableAnswerSignal(rawText: string) {
  return hasSharedEventCenteredUnableAnswerSignal(rawText) &&
    !EXPLICIT_REFUSAL_PATTERN.test(rawText.trim());
}

export function isEventCenteredPureUnableAnswer(rawText: string) {
  const normalized = rawText.trim().replace(/\s+/gu, "");
  return Boolean(normalized) &&
    PURE_UNABLE_ANSWER_PATTERN.test(normalized) &&
    hasEventCenteredUnableAnswerSignal(normalized);
}

export function isEventCenteredGenerativeUnableAnswerRepair(input: {
  action: EventCenteredRespondAction;
  rawText: string;
  currentQuestion: EventCenteredDialogueState["currentQuestion"];
}) {
  const currentQuestion = input.currentQuestion;
  if (
    input.action !== "reply" ||
    !currentQuestion ||
    !hasEventCenteredUnableAnswerSignal(input.rawText)
  ) {
    return false;
  }
  const surfaceCanBecomeConcrete = (
    currentQuestion.surfaceLevel === "open_anchor" ||
    currentQuestion.surfaceLevel === "simplified"
  );
  return surfaceCanBecomeConcrete;
}

function controlledUnableAnswerRepairQuestion(input: {
  angle: JournalEventAngle;
  target: string;
  facts: JournalEventFactRecord[];
}) {
  const anchorText = input.facts.find((fact) => fact.scope === "current_event")?.statement ?? null;
  if (input.angle === "feeling" || input.angle === "thought") {
    return renderFeelingThoughtRepairQuestion({
      angle: input.angle,
      target: input.target,
      intent: "concretize",
      anchorText
    }) ?? (
      input.angle === "feeling"
        ? "只说一个具体瞬间就好：当时心里或身体最先有什么反应？"
        : "只说一个具体瞬间就好：当时脑子里最先冒出的念头是什么？"
    );
  }
  return renderRelationshipOrActionRepairQuestion({
    angle: input.angle,
    target: input.target,
    intent: "concretize",
    anchorText,
    currentQuestionText: null
  }) ?? (
    input.angle === "relationship"
      ? "只说一个互动细节就好：对方当时做了什么？"
      : "只说一个具体动作就好：你当时先做了什么？"
  );
}

function checkpointResult(input: {
  state: EventCenteredDialogueState;
  kind: "first" | "second";
  exactResponse?: string;
  angleOutcome?: EventCenteredPolicyOutcomeDraft | null;
  reflectionReady?: boolean;
}): EventCenteredTurnPolicyResult {
  input.state.phase = input.kind === "first" ? "checkpoint_one" : "checkpoint_two";
  if (input.kind === "first") input.state.reflectionReady = input.reflectionReady ?? false;
  input.state.activeAngle = null;
  clearCurrentQuestion(input.state);
  input.state.focusOptions = [];
  const outcome = input.angleOutcome ?? null;
  return {
    nextState: input.state,
    directive: {
      responseKind: "checkpoint",
      questionSpec: null,
      checkpoint: {
        kind: input.kind,
        outcome: outcome?.statement ?? null
      },
      angleOutcome: outcome
        ? {
            angle: outcome.angle,
            kind: outcome.kind,
            statement: outcome.statement
          }
        : null,
      exactResponse: input.exactResponse ?? (
        input.kind === "first"
          ? "这件事已经先记下来了。"
          : EVENT_CENTERED_SECOND_CHECKPOINT_PAUSE_RESPONSE
      )
    },
    angleOutcome: outcome,
    preserveCurrentQuestion: false
  };
}

function thoughtTransitionResult(input: {
  state: EventCenteredDialogueState;
  angleOutcome?: EventCenteredPolicyOutcomeDraft | null;
}): EventCenteredTurnPolicyResult {
  const outcome = input.angleOutcome ?? null;
  input.state.phase = "deep_companionship";
  input.state.reflectionReady = true;
  input.state.activeAngle = "thought";
  input.state.lastCompletedAngle = "thought";
  input.state.focusOptions = [];
  clearCurrentQuestion(input.state);
  return {
    nextState: input.state,
    directive: {
      responseKind: "transition",
      questionSpec: null,
      checkpoint: null,
      angleOutcome: outcome
        ? {
            angle: outcome.angle,
            kind: outcome.kind,
            statement: outcome.statement
          }
        : null,
      exactResponse: EVENT_CENTERED_THOUGHT_TRANSITION_RESPONSE
    },
    angleOutcome: outcome,
    preserveCurrentQuestion: false
  };
}

function updateAnsweredOrDeniedTarget(input: {
  state: EventCenteredDialogueState;
  angle: JournalEventAngle | null;
  answerStatus: EventCenteredGenerativeTurn["understanding"]["answerStatus"];
}) {
  if (!input.angle || !input.state.currentQuestion) return;
  const run = ensureAngleRun(input.state, input.angle);
  const target = input.state.currentQuestion.target;
  if (input.answerStatus === "answered") {
    addUnique(run.answeredTargets, target);
  }
  if (input.answerStatus === "declined") {
    addUnique(run.deniedTargets ?? (run.deniedTargets = []), target);
    clearCurrentQuestion(input.state);
  }
}

function withdrawCorrectedUnderstanding(input: {
  state: EventCenteredDialogueState;
  angle: JournalEventAngle | null;
  action: EventCenteredRespondAction;
  turn: EventCenteredGenerativeTurn;
}) {
  const correctionRecorded = input.action === "correct_understanding" ||
    input.turn.understanding.answerStatus === "correction" ||
    input.turn.understanding.correctionOrBoundary?.kind === "correction";
  if (!correctionRecorded) return;

  input.state.pendingUnderstandingClaimId = null;
  const rejectedTarget = input.state.currentQuestion && (
    input.turn.understanding.answerStatus === "declined" ||
    input.state.currentQuestion.cognitiveAction === "test_understanding"
  )
    ? input.state.currentQuestion.target
    : null;
  if (!input.angle) {
    clearCurrentQuestion(input.state);
    return;
  }

  const run = ensureAngleRun(input.state, input.angle);
  const wasClosed = run.status === "closed";
  addUnique(run.deniedTargets ?? (run.deniedTargets = []), rejectedTarget);
  clearCurrentQuestion(input.state);
  run.currentOutcomeId = null;
  run.status = wasClosed ? "closed" : "reopened";
}

function angleForTurn(input: {
  state: EventCenteredDialogueState;
  selectedAngle?: JournalEventAngle;
}) {
  return input.selectedAngle ?? input.state.activeAngle ?? (
    input.state.phase === "checkpoint_two" || input.state.phase === "deep_companionship"
      ? input.state.lastCompletedAngle
      : null
  );
}

function outcomeDraft(input: {
  turn: EventCenteredGenerativeTurn;
  angle: JournalEventAngle | null;
}): EventCenteredPolicyOutcomeDraft | null {
  const outcome = input.turn.decision.outcomeCandidate;
  if (!outcome || !input.angle || outcome.angle !== input.angle) return null;
  return {
    angle: input.angle,
    kind: "insight",
    statement: outcome.statement,
    supportKeys: outcome.supportEvidenceRefs
  };
}

function applyMicrogoal(input: {
  state: EventCenteredDialogueState;
  turn: EventCenteredGenerativeTurn;
  angle: JournalEventAngle;
  answeredCurrentQuestion: boolean;
}) {
  const delta = input.turn.decision.microgoalDelta;
  const target = input.turn.decision.selectedTarget ?? "deep_open_point";
  if (!delta) return;
  if (delta.operation === "start" || !input.state.currentMicrogoal) {
    input.state.currentMicrogoal = {
      id: `microgoal:${input.angle}:${target}`,
      angle: input.angle,
      statement: delta?.statement ?? target,
      questionCount: input.turn.decision.turnAction === "ask" ? 1 : 0,
      answerCount: input.answeredCurrentQuestion ? 1 : 0,
      status: input.turn.decision.turnAction === "ask" ? "active" : "completed",
      evidenceRefs: delta?.supportEvidenceRefs ?? input.turn.decision.evidenceRefs
    };
    return;
  }
  const microgoal = input.state.currentMicrogoal;
  if (input.answeredCurrentQuestion) {
    microgoal.answerCount = Math.min(3, (microgoal.answerCount ?? 0) + 1);
  }
  microgoal.statement = delta.statement ?? microgoal.statement;
  microgoal.evidenceRefs = [...new Set([
    ...microgoal.evidenceRefs,
    ...delta.supportEvidenceRefs
  ])];
  if (delta.operation === "continue" && input.turn.decision.turnAction === "ask") {
    microgoal.questionCount = Math.min(3, microgoal.questionCount + 1);
    microgoal.status = "active";
  } else if (delta.operation === "close") {
    microgoal.status = "closed";
  } else if (delta.operation === "complete") {
    microgoal.status = "completed";
  }
}

export function applyGenerativeEventCenteredTurnPolicy(input: {
  state: EventCenteredDialogueState;
  action: EventCenteredRespondAction;
  selectedAngle?: JournalEventAngle;
  rawText: string;
  turn: EventCenteredGenerativeTurn;
  facts?: JournalEventFactRecord[];
}): EventCenteredTurnPolicyResult {
  const state = cloneState(input.state);
  const thoughtOnly = isEventCenteredThoughtOnlyScope();
  state.strategyMode = "generative";
  state.strategyVersion = EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION;
  const angle = thoughtOnly
    ? "thought" as const
    : angleForTurn({ state, selectedAngle: input.selectedAngle });
  const previousQuestion = state.currentQuestion
    ? { ...state.currentQuestion }
    : null;
  const previousQuestionIntent = state.currentQuestionIntent
    ? { ...state.currentQuestionIntent }
    : null;
  const answeredCurrentQuestion = Boolean(
    previousQuestion &&
    input.action === "reply" &&
    (
      input.turn.understanding.answerStatus === "answered" ||
      input.turn.understanding.answerStatus === "correction" ||
      (
        input.turn.understanding.answerStatus === "partly_answered" &&
        input.turn.understanding.factDeltas.length > 0
      )
    )
  );
  withdrawCorrectedUnderstanding({
    state,
    angle,
    action: input.action,
    turn: input.turn
  });
  updateAnsweredOrDeniedTarget({
    state,
    angle,
    answerStatus: input.turn.understanding.answerStatus
  });

  if (input.turn.understanding.eventBoundary === "multiple_events") {
    const options = resolveEventCenteredFocusOptions({
      rawText: input.rawText,
      suggestedOptions: input.turn.understanding.eventOptions
    }) ?? [];
    state.phase = "event_focus_clarification";
    state.activeAngle = null;
    clearCurrentQuestion(state);
    state.focusOptions = options.map((option, index) => ({
      id: `focus-${index + 1}`,
      label: option.label,
      sourceText: option.sourceText
    }));
    return {
      nextState: state,
      directive: {
        responseKind: "clarification",
        questionSpec: options.length > 0
          ? {
              phase: "event_focus_clarification",
              angle: null,
              target: "event_selection",
              opportunityNumber: null,
              surfaceLevel: "low_pressure_choice",
              anchorText: null,
              repairCount: 0,
              cognitiveAction: null
            }
          : null,
        checkpoint: null,
        angleOutcome: null,
        exactResponse: options.length > 0
          ? "两件事都已经留在原话里。"
          : "你可以直接说这次想先记录哪一件。"
      },
      angleOutcome: null,
      preserveCurrentQuestion: false
    };
  }

  const turnAction = input.turn.decision.turnAction;
  if (!angle) {
    const reflectionMaterial = getEventCenteredReflectionMaterialStatus({
      rawText: input.rawText,
      facts: [
        ...(input.facts ?? []).map((fact) => ({
          statement: fact.statement,
          stance: fact.stance,
          kind: fact.kind,
          sourceTexts: fact.evidence
            .map((evidence) => evidence.quote?.trim())
            .filter((quote): quote is string => Boolean(quote))
        })),
        ...input.turn.understanding.factDeltas.map((fact) => ({
          statement: fact.statement,
          stance: fact.stance,
          kind: fact.kind,
          sourceTexts: [fact.quote]
        }))
      ]
    });
    const reflectionReady = reflectionMaterial.ready;
    if (reflectionReady) {
      return checkpointResult({
        state,
        kind: "first",
        reflectionReady: true
      });
    }
    if (turnAction === "ask" && input.turn.reply.question && input.turn.decision.selectedTarget) {
      state.phase = "event_recording";
      state.lightAnchorOpportunityCount = Math.min(1, state.lightAnchorOpportunityCount + 1);
      state.currentQuestion = {
        opportunityNumber: 1,
        angle: null,
        target: input.turn.decision.selectedTarget,
        surfaceLevel: "open_anchor",
        repairCount: 0,
        assistantMessageId: null,
        cognitiveAction: input.turn.decision.cognitiveAction
      };
      updateCurrentQuestionIntent({
        state,
        turn: input.turn,
        targetId: input.turn.decision.selectedTarget
      });
      return {
        nextState: state,
        directive: {
          responseKind: "question",
          questionSpec: questionSpec({
            state,
            angle: null,
            target: input.turn.decision.selectedTarget,
            opportunityNumber: 1,
            cognitiveAction: input.turn.decision.cognitiveAction
          }),
          checkpoint: null,
          angleOutcome: null,
          exactResponse: input.turn.reply.question
        },
        angleOutcome: null,
        preserveCurrentQuestion: false
      };
    }
    const fallbackTarget = reflectionMaterial.hasEvent
      ? "light_personal_reaction"
      : "light_event_anchor";
    const fallbackSurfaceLevel = reflectionMaterial.hasEvent
      ? "open_anchor"
      : "concrete_anchor";
    state.phase = "event_recording";
    state.lightAnchorOpportunityCount = 1;
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: null,
      target: fallbackTarget,
      surfaceLevel: fallbackSurfaceLevel,
      repairCount: 0,
      assistantMessageId: null,
      cognitiveAction: "anchor_specific"
    };
    state.currentQuestionIntent = null;
    return {
      nextState: state,
      directive: {
        responseKind: "question",
        questionSpec: questionSpec({
          state,
          angle: null,
          target: fallbackTarget,
          opportunityNumber: 1,
          cognitiveAction: "anchor_specific",
          surfaceLevel: fallbackSurfaceLevel
        }),
        checkpoint: null,
        angleOutcome: null,
        exactResponse: reflectionMaterial.hasEvent
          ? "这件事发生时，你心里最先冒出的感受或反应是什么？"
          : "这份感受最早是在哪件具体事情里出现的？"
      },
      angleOutcome: null,
      preserveCurrentQuestion: false
    };
  }

  const run = ensureAngleRun(state, angle);
  const isDeep = state.phase === "checkpoint_two" || state.phase === "deep_companionship" ||
    input.action === "continue_exploration";
  const outcome = outcomeDraft({ turn: input.turn, angle });

  const isUnableAnswer = input.action === "reply" &&
    previousQuestion?.angle === angle &&
    hasEventCenteredUnableAnswerSignal(input.rawText);
  const isExplicitRefusal = input.action === "reply" &&
    previousQuestion?.angle === angle && (
      input.turn.understanding.answerStatus === "declined" ||
      EXPLICIT_REFUSAL_PATTERN.test(input.rawText.trim())
    );
  if (
    previousQuestion &&
    (isUnableAnswer || isExplicitRefusal)
  ) {
    if (isEventCenteredGenerativeUnableAnswerRepair({
      action: input.action,
      rawText: input.rawText,
      currentQuestion: previousQuestion
    })) {
      const repairQuestion = controlledUnableAnswerRepairQuestion({
        angle,
        target: previousQuestion.target,
        facts: input.facts ?? []
      });
      run.status = "active";
      state.phase = isDeep ? "deep_companionship" : "guided_reflection";
      state.activeAngle = angle;
      const nextRepairCount = Math.min(3, previousQuestion.repairCount + 1);
      state.currentQuestion = {
        ...previousQuestion,
        angle,
        surfaceLevel: "concrete_anchor",
        repairCount: nextRepairCount,
        assistantMessageId: null,
        cognitiveAction: "anchor_specific"
      };
      state.currentQuestionIntent = previousQuestionIntent?.targetId === previousQuestion.target
        ? previousQuestionIntent
        : null;
      return {
        nextState: state,
        directive: {
          responseKind: "repair",
          questionSpec: questionSpec({
            state,
            angle,
            target: previousQuestion.target,
            opportunityNumber: previousQuestion.opportunityNumber,
            cognitiveAction: "anchor_specific",
            surfaceLevel: "concrete_anchor",
            repairCount: nextRepairCount
          }),
          checkpoint: null,
          angleOutcome: null,
          exactResponse: repairQuestion
        },
        angleOutcome: null,
        preserveCurrentQuestion: false,
        localDeterministicRepairApplied: true
      };
    }

    state.lastCompletedAngle = angle;
    if (isExplicitRefusal) {
      addUnique(run.deniedTargets ?? (run.deniedTargets = []), previousQuestion.target);
    }
    if (isDeep && state.currentMicrogoal?.status === "active") {
      state.currentMicrogoal.status = "closed";
    }
    run.status = "closed";
    return checkpointResult({
      state,
      kind: "second",
      exactResponse: EVENT_CENTERED_HONEST_LIMIT_RESPONSE
    });
  }

  if (turnAction === "ask" && input.turn.reply.question && input.turn.decision.selectedTarget) {
    run.status = "active";
    addUnique(run.askedTargets, input.turn.decision.selectedTarget);
    const opportunityNumber = isDeep
      ? Math.min(3, (state.currentMicrogoal?.questionCount ?? 0) + 1)
      : Math.min(3, run.questionOpportunityCount + 1);
    if (isDeep) {
      state.phase = "deep_companionship";
      applyMicrogoal({ state, turn: input.turn, angle, answeredCurrentQuestion });
    } else {
      state.phase = "guided_reflection";
      run.questionOpportunityCount = opportunityNumber;
    }
    state.activeAngle = angle;
    state.lastCompletedAngle = isDeep ? state.lastCompletedAngle ?? angle : state.lastCompletedAngle;
    state.currentQuestion = {
      opportunityNumber,
      angle,
      target: input.turn.decision.selectedTarget,
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: null,
      cognitiveAction: input.turn.decision.cognitiveAction
    };
    updateCurrentQuestionIntent({
      state,
      turn: input.turn,
      targetId: input.turn.decision.selectedTarget
    });
    return {
      nextState: state,
      directive: {
        responseKind: "question",
        questionSpec: questionSpec({
          state,
          angle,
          target: input.turn.decision.selectedTarget,
          opportunityNumber,
          cognitiveAction: input.turn.decision.cognitiveAction
        }),
        checkpoint: null,
        angleOutcome: null,
        exactResponse: input.turn.reply.question
      },
      angleOutcome: null,
      preserveCurrentQuestion: false
    };
  }

  state.lastCompletedAngle = angle;
  if (isDeep) applyMicrogoal({ state, turn: input.turn, angle, answeredCurrentQuestion });
  if (turnAction === "complete" && outcome) {
    run.status = "completed";
    if (thoughtOnly) {
      return thoughtTransitionResult({ state, angleOutcome: outcome });
    }
    return checkpointResult({
      state,
      kind: "second",
      exactResponse: input.turn.visibleTurn?.insight ?? outcome.statement,
      angleOutcome: outcome
    });
  }
  if (turnAction === "honest_limit") {
    run.status = outcome ? "completed" : "available";
    if (thoughtOnly && !input.turn.understanding.correctionOrBoundary) {
      return thoughtTransitionResult({ state, angleOutcome: outcome });
    }
    return checkpointResult({
      state,
      kind: "second",
      exactResponse: input.turn.visibleTurn?.honestLimit ?? EVENT_CENTERED_HONEST_LIMIT_RESPONSE
    });
  }
  run.status = outcome ? "completed" : run.status;
  if (thoughtOnly) {
    return thoughtTransitionResult({ state, angleOutcome: outcome });
  }
  return checkpointResult({
    state,
    kind: "second",
    exactResponse: input.turn.visibleTurn?.insight ??
      "这条线索先停在这里，你可以决定是否继续。",
    angleOutcome: outcome
  });
}

export function createGenerativeEventCenteredPayload(input: {
  turn: EventCenteredGenerativeTurn;
  policy: EventCenteredTurnPolicyResult;
}): EventCenteredAssistantPayload {
  const semanticPlan = input.turn.semanticPlan as
    | EventCenteredGenerativeTurn["semanticPlan"]
    | undefined;
  const action = semanticPlan?.action ?? input.turn.decision.turnAction;
  const thoughtTransition = isEventCenteredThoughtOnlyScope() &&
    input.policy.directive.responseKind === "transition";
  const hiddenUserCompletion = Boolean(
    !thoughtTransition &&
    (action === "complete" || action === "pause") &&
    semanticPlan?.outcomeAssessment?.origin === "user_articulated" &&
    input.policy.directive.angleOutcome
  );
  return {
    naturalUnderstanding: thoughtTransition
      ? input.turn.visibleTurn?.insight ??
        input.turn.semanticPlan.expectedUnderstandingDelta ??
        "当前判断和它背后的依据已经形成一条可继续检验的线索。"
      : hiddenUserCompletion
      ? ""
      : input.policy.localDeterministicRepairApplied
      ? "你暂时还说不清这一部分，我换成一个更具体的入口。"
      : input.turn.reply.naturalUnderstanding,
    // “说不清”的第一次修复采用受控句式，避免模型原问题覆盖这次低负担入口。
    naturalResponse: thoughtTransition
      ? EVENT_CENTERED_THOUGHT_TRANSITION_RESPONSE
      : hiddenUserCompletion
      ? ""
      : input.policy.localDeterministicRepairApplied
      ? input.policy.directive.exactResponse
      : input.policy.directive.questionSpec
      ? input.turn.reply.question ?? input.policy.directive.exactResponse
      : input.policy.directive.exactResponse,
    responseKind: input.policy.directive.responseKind,
    questionSpec: input.policy.directive.questionSpec,
    checkpoint: input.policy.directive.checkpoint,
    angleOutcome: input.policy.directive.angleOutcome,
    presentation: hiddenUserCompletion ? "hidden" : "visible"
  };
}
