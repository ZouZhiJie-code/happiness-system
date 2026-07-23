import {
  decideFeelingOrThoughtStrategy,
  type AngleOutcomeCandidate,
  type AngleQuestionCandidateAssessment,
  type FeelingThoughtQuestionTarget
} from "@/features/interview/event-centered/angle-strategies-feeling-thought";
import { isIncrementalAngleOutcome } from "@/features/interview/event-centered/angle-outcome-quality";
import {
  decideRelationshipOrActionStrategy,
  type EventCenteredStrategyCandidateAssessment,
  type EventCenteredSupportedOutcome,
  type RelationshipOrActionStrategyTarget
} from "@/features/interview/event-centered/angle-strategies-relationship-action";
import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import {
  EVENT_CENTERED_HONEST_LIMIT_RESPONSE,
  isEventCenteredContinueWithinBoundaryExpression,
  resolveEventCenteredSecondCheckpointResponse
} from "@/features/interview/event-centered/turn-quality";
import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import type {
  EventCenteredAssistantPayload,
  EventCenteredDialogueState,
  EventCenteredQuestionSpec,
  EventCenteredRespondAction
} from "@/types/event-centered-dialogue";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";

export type EventCenteredPolicyDirective = Pick<
  EventCenteredAssistantPayload,
  "responseKind" | "questionSpec" | "checkpoint" | "angleOutcome"
> & {
  exactResponse: string;
};

export type EventCenteredPolicyOutcomeDraft = {
  angle: JournalEventAngle;
  kind: "insight" | "honest_limit";
  statement: string;
  supportKeys: string[];
};

export type EventCenteredTurnPolicyResult = {
  nextState: EventCenteredDialogueState;
  directive: EventCenteredPolicyDirective;
  angleOutcome: EventCenteredPolicyOutcomeDraft | null;
  preserveCurrentQuestion: boolean;
};

type PolicyFact = {
  key: string;
  statement: string;
};

export type DecideEventCenteredTurnPolicyInput = {
  state: EventCenteredDialogueState;
  action: EventCenteredRespondAction;
  rawText: string;
  selectedAngle?: JournalEventAngle;
  selectedEventOptionId?: string;
  regenerationIntent?: "simplify" | "concretize" | "change_angle" | "deepen" | "lighten";
  currentQuestionText: string | null;
  facts: JournalEventFactRecord[];
  understanding: EventCenteredUnderstandingDecision;
  bareAngleChange: boolean;
};

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
        askedTargets: [...(current.askedTargets ?? [])]
      }
    : { ...fallback, answeredTargets: [], askedTargets: [] };
  state.angleRuns[angle] = run;
  return run;
}

function questionSpec(input: {
  state: EventCenteredDialogueState;
  angle: JournalEventAngle | null;
  target: string;
  opportunityNumber: number | null;
  surfaceLevel: EventCenteredQuestionSpec["surfaceLevel"];
  anchorText?: string | null;
  repairCount?: number;
}): EventCenteredQuestionSpec {
  return {
    phase: input.state.phase,
    angle: input.angle,
    target: input.target,
    opportunityNumber: input.opportunityNumber,
    surfaceLevel: input.surfaceLevel,
    anchorText: input.anchorText ?? null,
    repairCount: input.repairCount ?? 0
  };
}

function asCheckpoint(
  state: EventCenteredDialogueState,
  kind: "first" | "second",
  outcome: string | null
): EventCenteredTurnPolicyResult {
  state.phase = kind === "first" ? "checkpoint_one" : "checkpoint_two";
  state.activeAngle = null;
  state.currentQuestion = null;
  state.focusOptions = [];
  return {
    nextState: state,
    directive: {
      responseKind: "checkpoint",
      questionSpec: null,
      checkpoint: { kind, outcome },
      angleOutcome: null,
      exactResponse: kind === "first"
        ? "这件事已经先记下来了。"
        : resolveEventCenteredSecondCheckpointResponse({ outcome }),
    },
    angleOutcome: null,
    preserveCurrentQuestion: false
  };
}

function focusOptionsFor(input: Pick<DecideEventCenteredTurnPolicyInput, "rawText" | "understanding">) {
  const suggested = input.understanding.eventOptions ?? [];
  const valid = suggested.filter((option) => input.rawText.includes(option.sourceText));
  const fragments = input.rawText
    .split(/(?:然后|后来|同时|另外|可是|但是|又|还有|[，。；！？])/u)
    .map((value) => value.trim())
    .filter((value) => value.length >= 4)
    .slice(0, 2)
    .map((sourceText) => ({
      label: sourceText.length > 22 ? `${sourceText.slice(0, 22)}…` : sourceText,
      sourceText
    }));
  const pairs = valid.length === 2
    ? valid
    : fragments.length === 2
      ? fragments
    : [
        { label: "先记录前面提到的那件", sourceText: input.rawText },
        { label: "先记录后面提到的那件", sourceText: input.rawText }
      ];
  return pairs.slice(0, 2).map((option, index) => ({
    id: `focus-${index + 1}`,
    label: option.label,
    sourceText: option.sourceText
  }));
}

function collectPolicyFacts(input: DecideEventCenteredTurnPolicyInput): PolicyFact[] {
  return [
    ...input.facts.map((fact) => ({ key: fact.id, statement: fact.statement })),
    ...input.understanding.facts.map((fact, index) => ({
      key: `new:${index}`,
      statement: fact.statement
    }))
  ];
}

function supportKeysForOutcome(
  facts: PolicyFact[],
  understanding: EventCenteredUnderstandingDecision,
  angle: JournalEventAngle
) {
  const candidate = understanding.outcomeCandidate;
  if (!candidate || candidate.angle !== angle) return [];
  return candidate.supportFactStatements.flatMap((statement) => {
    const match = facts.find((fact) => fact.statement === statement);
    return match ? [match.key] : [];
  });
}

function buildFeelingThoughtOutcome(
  input: DecideEventCenteredTurnPolicyInput,
  angle: "feeling" | "thought",
  facts: PolicyFact[]
): AngleOutcomeCandidate | null {
  const candidate = input.understanding.outcomeCandidate;
  const supportFactIds = supportKeysForOutcome(facts, input.understanding, angle);
  if (
    !candidate ||
    candidate.angle !== angle ||
    candidate.kind !== "insight" ||
    candidate.statement.trim().length < 8 ||
    candidate.supportFactStatements.includes(candidate.statement) ||
    supportFactIds.length !== candidate.supportFactStatements.length
  ) {
    return null;
  }
  if (!isIncrementalAngleOutcome({
    statement: candidate.statement,
    supportFactIds,
    facts: facts.map((fact) => ({ id: fact.key, text: fact.statement }))
  })) return null;
  return {
    statement: candidate.statement,
    supportFactIds,
    supportFactTexts: supportFactIds.map(
      (key) => facts.find((fact) => fact.key === key)?.statement ?? ""
    ),
    expectedValue: "meaningful",
    evidenceStrength: "clear"
  };
}

function buildRelationshipActionOutcome(
  input: DecideEventCenteredTurnPolicyInput,
  angle: "relationship" | "action",
  facts: PolicyFact[]
): EventCenteredSupportedOutcome | null {
  const candidate = input.understanding.outcomeCandidate;
  const supportFactIds = supportKeysForOutcome(facts, input.understanding, angle);
  if (
    !candidate ||
    candidate.angle !== angle ||
    candidate.kind !== "insight" ||
    candidate.statement.trim().length < 8 ||
    candidate.supportFactStatements.includes(candidate.statement) ||
    supportFactIds.length !== candidate.supportFactStatements.length
  ) {
    return null;
  }
  if (!isIncrementalAngleOutcome({
    statement: candidate.statement,
    supportFactIds,
    facts: facts.map((fact) => ({ id: fact.key, text: fact.statement }))
  })) return null;
  return {
    statement: candidate.statement,
    supportFactIds,
    expectedValue: "meaningful",
    evidenceStrength: "clear"
  };
}

function currentAnswerTargets(
  state: EventCenteredDialogueState,
  understanding: EventCenteredUnderstandingDecision
) {
  if (!state.currentQuestion) return [];
  // 已答的判断需要同时有本轮原话可追溯的事实。这样既不会把空泛回复
  // 提前当作完成，也会在用户已经回答时推进到下一个目标，避免重复追问。
  const hasTraceableAnswer = understanding.facts.some(
    (fact) => fact.stance === "affirmed" && fact.statement.trim() && fact.quote.trim()
  );
  if (
    !hasTraceableAnswer ||
    (understanding.answerSignal !== "answered" && understanding.answerSignal !== "partly_answered")
  ) return [];
  return [state.currentQuestion.target];
}

function feelingThoughtSalientTargets(input: {
  angle: "feeling" | "thought";
  rawText: string;
  facts: PolicyFact[];
}): FeelingThoughtQuestionTarget[] {
  const source = [input.rawText, ...input.facts.map((fact) => fact.statement)].join("\n");
  if (input.angle === "feeling") {
    return /(?:在意|看重|希望|想要|需要|边界|底线|不愿|不能接受|受不了|尊重|被听见|被理解)/u.test(source)
      ? ["care_need_boundary"]
      : [];
  }
  if (/(?:本来|原本|应该|以为|期待)/u.test(source)) return ["default_expectation"];
  if (/(?:标准|衡量|判断|看重|在意)/u.test(source)) return ["evaluation_standard"];
  if (/(?:取舍|优先|宁愿|相比|比起|更)/u.test(source)) return ["tradeoff_condition"];
  return [];
}

function feelingThoughtCandidateAssessments(
  targets: FeelingThoughtQuestionTarget[]
): AngleQuestionCandidateAssessment[] {
  return targets.map((target) => ({
    target,
    expectedValue: "meaningful",
    answerEase: target === "care_need_boundary" ? 3 : 4,
    specificity: target === "care_need_boundary" ? 3 : 4
  }));
}

function askResult(input: {
  state: EventCenteredDialogueState;
  angle: JournalEventAngle;
  target: string;
  question: string;
  opportunityNumber: number;
  lowPressure: boolean;
  anchorText: string | null;
  repairCount?: number;
}): EventCenteredTurnPolicyResult {
  const run = ensureAngleRun(input.state, input.angle);
  run.status = "active";
  run.questionOpportunityCount = input.opportunityNumber;
  // `lowPressureAnchorUsed` 只为历史快照保留。文本边界直接收束，
  // 新对话不会再写入这项旧计数。
  if (!run.askedTargets.includes(input.target)) run.askedTargets.push(input.target);
  input.state.activeAngle = input.angle;
  input.state.phase = "guided_reflection";
  input.state.currentQuestion = {
    opportunityNumber: input.opportunityNumber,
    angle: input.angle,
    target: input.target,
    surfaceLevel: input.lowPressure ? "low_pressure_choice" : "open_anchor",
    repairCount: input.repairCount ?? 0,
    assistantMessageId: null
  };
  const spec = questionSpec({
    state: input.state,
    angle: input.angle,
    target: input.target,
    opportunityNumber: input.opportunityNumber,
    surfaceLevel: input.lowPressure ? "low_pressure_choice" : "open_anchor",
    anchorText: input.anchorText,
    repairCount: input.repairCount
  });
  return {
    nextState: input.state,
    directive: {
      responseKind: input.repairCount ? "repair" : "question",
      questionSpec: spec,
      checkpoint: null,
      angleOutcome: null,
      exactResponse: input.question
    },
    angleOutcome: null,
    preserveCurrentQuestion: false
  };
}

function completeAngle(input: {
  state: EventCenteredDialogueState;
  angle: JournalEventAngle;
  kind: "insight" | "honest_limit";
  statement: string;
  supportKeys: string[];
}): EventCenteredTurnPolicyResult {
  const run = ensureAngleRun(input.state, input.angle);
  run.status = "completed";
  input.state.lastCompletedAngle = input.angle;
  input.state.activeAngle = null;
  input.state.currentQuestion = null;
  const outcome = {
    angle: input.angle,
    kind: input.kind,
    statement: input.statement,
    supportKeys: input.supportKeys
  };
  const checkpoint = asCheckpoint(input.state, "second", input.statement);
  return {
    ...checkpoint,
    directive: {
      ...checkpoint.directive,
      exactResponse: input.kind === "honest_limit"
        ? EVENT_CENTERED_HONEST_LIMIT_RESPONSE
        : checkpoint.directive.exactResponse,
      angleOutcome: {
        angle: input.angle,
        kind: input.kind,
        statement: input.statement
      }
    },
    angleOutcome: outcome
  };
}

/**
 * 用户在三次回答机会用尽前停止，或当前已经没有值得问的新目标时，回到第二检查点。
 * 这类结束不形成可被日志读取的角度成果。
 */
function closeAngleWithoutOutcome(input: {
  state: EventCenteredDialogueState;
  angle: JournalEventAngle;
}): EventCenteredTurnPolicyResult {
  const run = ensureAngleRun(input.state, input.angle);
  run.status = "available";
  const checkpoint = asCheckpoint(input.state, "second", null);
  return {
    ...checkpoint,
    directive: {
      ...checkpoint.directive,
      exactResponse: "这个角度先停在这里。"
    }
  };
}

function decideAngle(
  input: DecideEventCenteredTurnPolicyInput,
  state: EventCenteredDialogueState,
  angle: JournalEventAngle
): EventCenteredTurnPolicyResult {
  const run = ensureAngleRun(state, angle);
  const facts = collectPolicyFacts(input);
  for (const target of currentAnswerTargets(state, input.understanding)) {
    if (!run.answeredTargets.includes(target)) run.answeredTargets.push(target);
  }
  const explicitUnknown = input.understanding.answerSignal === "unknown";
  const explicitStop = input.understanding.answerSignal === "declined";
  const anchorText = facts.find((fact) => fact.statement)?.statement ?? null;

  if (angle === "feeling" || angle === "thought") {
    const salientTargets = feelingThoughtSalientTargets({ angle, rawText: input.rawText, facts });
    const candidateAssessments = feelingThoughtCandidateAssessments(salientTargets);
    const decision = decideFeelingOrThoughtStrategy({
      angle,
      facts: facts.map((fact) => ({ id: fact.key, text: fact.statement })),
      latestUserText: input.rawText,
      questionOpportunityCount: run.questionOpportunityCount,
      lowPressureAnchorUsed: run.lowPressureAnchorUsed ?? false,
      explicitUnknown,
      explicitStop,
      anchorText,
      answeredTargets: run.answeredTargets as FeelingThoughtQuestionTarget[],
      askedTargets: run.askedTargets as FeelingThoughtQuestionTarget[],
      salientTargets,
      candidateAssessments,
      allowSingleCareNeedQuestion:
        angle === "feeling" &&
        run.answeredTargets.includes("direct_experience") &&
        run.answeredTargets.includes("specific_trigger") &&
        run.questionOpportunityCount < 3,
      outcomeCandidate: buildFeelingThoughtOutcome(input, angle, facts)
    });
    if (decision.kind === "ask") {
      return askResult({
        state,
        angle,
        target: decision.target,
        question: decision.question,
        opportunityNumber: decision.nextOpportunityCount,
        lowPressure: decision.surfaceLevel === "low_pressure",
        anchorText
      });
    }
    if (decision.outcomeKind === null) {
      return closeAngleWithoutOutcome({ state, angle });
    }
    const supportKeys = decision.outcomeKind === "insight"
      ? buildFeelingThoughtOutcome(input, angle, facts)?.supportFactIds ?? []
      : facts.slice(0, 1).map((fact) => fact.key);
    return completeAngle({
      state,
      angle,
      kind: decision.outcomeKind,
      statement: decision.statement,
      supportKeys
    });
  }

  const supportedOutcome = buildRelationshipActionOutcome(input, angle, facts);
  const advice = input.understanding.adviceRequest;
  const assessments: EventCenteredStrategyCandidateAssessment[] | undefined = undefined;
  const decision = decideRelationshipOrActionStrategy({
    angle,
    facts: facts.map((fact) => ({ id: fact.key, text: fact.statement })),
    latestUserText: input.rawText,
    questionOpportunityCount: run.questionOpportunityCount,
    lowPressureAnchorUsed: run.lowPressureAnchorUsed ?? false,
    explicitUnknown,
    stopRequested: explicitStop,
    adviceRequested: angle === "action" && Boolean(advice),
    adviceCondition: advice?.condition ?? null,
    adviceOptions: advice?.options ?? [],
    eventAnchor: anchorText,
    coveredTargets: run.answeredTargets as RelationshipOrActionStrategyTarget[],
    askedTargets: run.askedTargets as RelationshipOrActionStrategyTarget[],
    candidateAssessments: assessments,
    supportedOutcome
  });
  if (decision.kind === "ask") {
    return askResult({
      state,
      angle,
      target: decision.target,
      question: decision.question,
      opportunityNumber: decision.nextOpportunityCount,
      lowPressure: decision.surfaceLevel === "low_pressure",
      anchorText
    });
  }
  if (decision.kind === "advice_options") {
    const response = decision.adviceOptions
      .map((option, index) => `${index + 1}. ${option.text}（取舍：${option.tradeoff}）`)
      .join("\n");
    state.phase = "deep_companionship";
    state.currentQuestion = null;
    return {
      nextState: state,
      directive: {
        responseKind: "acknowledgement",
        questionSpec: null,
        checkpoint: null,
        angleOutcome: null,
        exactResponse: response
      },
      angleOutcome: null,
      preserveCurrentQuestion: false
    };
  }
  if (decision.outcomeKind === null) {
    return closeAngleWithoutOutcome({ state, angle });
  }
  const supportKeys = decision.outcomeKind === "insight"
    ? supportedOutcome?.supportFactIds ?? []
    : facts.slice(0, 1).map((fact) => fact.key);
  return completeAngle({
    state,
    angle,
    kind: decision.outcomeKind,
    statement: decision.statement,
    supportKeys
  });
}

export function decideEventCenteredTurnPolicy(
  input: DecideEventCenteredTurnPolicyInput
): EventCenteredTurnPolicyResult {
  const state = cloneState(input.state);

  if (input.action === "regenerate_response" && state.currentQuestion) {
    const repair = input.regenerationIntent === "simplify" || input.regenerationIntent === "concretize";
    const currentCount = state.currentQuestion.opportunityNumber;
    if (!state.currentQuestion.angle) {
      const exactResponse = input.regenerationIntent === "concretize"
        ? "只说一个具体时刻就好：当时发生了什么？"
        : "简单说一句就好：你最想记住哪一下？";
      state.phase = state.phase === "event_focus_clarification"
        ? "event_focus_clarification"
        : "event_recording";
      state.activeAngle = null;
      state.currentQuestion = {
        ...state.currentQuestion,
        surfaceLevel: input.regenerationIntent === "concretize" ? "concrete_anchor" : "simplified",
        repairCount: state.currentQuestion.repairCount + (repair ? 1 : 0),
        assistantMessageId: null
      };
      return {
        nextState: state,
        directive: {
          responseKind: "repair",
          questionSpec: questionSpec({
            state,
            angle: null,
            target: state.currentQuestion.target,
            opportunityNumber: null,
            surfaceLevel: state.currentQuestion.surfaceLevel,
            repairCount: state.currentQuestion.repairCount
          }),
          checkpoint: null,
          angleOutcome: null,
          exactResponse
        },
        angleOutcome: null,
        preserveCurrentQuestion: false
      };
    }
    if (repair && currentCount >= 3 && state.currentQuestion.angle) {
      return completeAngle({
        state,
        angle: state.currentQuestion.angle,
        kind: "honest_limit",
        statement: "目前能确认的内容先保留到这里，这个方向不再继续增加问题。",
        supportKeys: input.facts.slice(0, 1).map((fact) => fact.id)
      });
    }
    const nextCount = repair ? Math.min(3, currentCount + 1) : currentCount;
    const exactResponse = input.regenerationIntent === "concretize"
      ? "我换个更具体的问法：这件事里，你最确定的那个时刻发生了什么？"
      : input.regenerationIntent === "simplify"
        ? "我换个简单一点的问法：你现在最确定的一点是什么？"
        : input.currentQuestionText ?? "我们继续停在这个问题上，你可以按最容易说的方式回答。";
    return askResult({
      state,
      angle: state.currentQuestion.angle!,
      target: state.currentQuestion.target,
      question: exactResponse,
      opportunityNumber: nextCount,
      lowPressure: input.regenerationIntent === "lighten",
      anchorText: null,
      repairCount: state.currentQuestion.repairCount + (repair ? 1 : 0)
    });
  }

  /**
   * “愿意继续、请尊重边界”是在保留可说范围，不构成对当前问题的新回答。
   * 因此继续沿用当前问题，不推进角度、机会或成果；真正的停止表达仍会在
   * 下面的文本边界分支中收束。
   */
  if (
    input.action === "reply" &&
    state.currentQuestion &&
    isEventCenteredContinueWithinBoundaryExpression(input.rawText)
  ) {
    return {
      nextState: state,
      directive: {
        responseKind: "boundary",
        questionSpec: questionSpec({
          state,
          angle: state.currentQuestion.angle,
          target: state.currentQuestion.target,
          opportunityNumber: state.currentQuestion.angle
            ? state.currentQuestion.opportunityNumber
            : null,
          surfaceLevel: state.currentQuestion.surfaceLevel,
          repairCount: state.currentQuestion.repairCount
        }),
        checkpoint: null,
        angleOutcome: null,
        exactResponse: input.currentQuestionText ?? "我们继续停在这个问题上，按你愿意说的部分回答就好。"
      },
      angleOutcome: null,
      preserveCurrentQuestion: true
    };
  }

  if (input.bareAngleChange && state.currentQuestion) {
    return {
      nextState: state,
      directive: {
        responseKind: "boundary",
        questionSpec: questionSpec({
          state,
          angle: state.currentQuestion.angle,
          target: state.currentQuestion.target,
          opportunityNumber: state.currentQuestion.opportunityNumber,
          surfaceLevel: state.currentQuestion.surfaceLevel,
          repairCount: state.currentQuestion.repairCount
        }),
        checkpoint: null,
        angleOutcome: null,
        exactResponse: "我们先保留眼前这个问题。等这一段聊完后，你可以再选想看的方向。"
      },
      angleOutcome: null,
      preserveCurrentQuestion: true
    };
  }

  if (
    state.phase !== "event_recording" &&
    state.phase !== "event_focus_clarification" &&
    (input.understanding.eventBoundary === "another_event" ||
      input.understanding.eventBoundary === "multiple_events")
  ) {
    if (state.currentQuestion) {
      return {
        nextState: state,
        directive: {
          responseKind: "boundary",
          questionSpec: questionSpec({
            state,
            angle: state.currentQuestion.angle,
            target: state.currentQuestion.target,
            opportunityNumber: state.currentQuestion.opportunityNumber,
            surfaceLevel: state.currentQuestion.surfaceLevel,
            repairCount: state.currentQuestion.repairCount
          }),
          checkpoint: null,
          angleOutcome: null,
          exactResponse: `这件新提到的事会留在原话里。当前记录继续围绕刚才这件事：${input.currentQuestionText ?? "按你最容易说的方式回答就好。"}`
        },
        angleOutcome: null,
        preserveCurrentQuestion: true
      };
    }
    return {
      nextState: state,
      directive: {
        responseKind: "boundary",
        questionSpec: null,
        checkpoint: null,
        angleOutcome: null,
        exactResponse: "这件新提到的事会留在原话里。当前记录继续围绕已经选定的这件事，需要时可以用顶部加号另开一件。"
      },
      angleOutcome: null,
      preserveCurrentQuestion: false
    };
  }

  if (
    (input.understanding.answerSignal === "declined" ||
      input.understanding.answerSignal === "unknown") &&
    state.phase === "event_recording"
  ) {
    return asCheckpoint(state, "first", null);
  }

  if (state.phase === "event_recording") {
    if (input.understanding.eventBoundary === "multiple_events") {
      state.phase = "event_focus_clarification";
      state.focusOptions = focusOptionsFor(input);
      state.currentQuestion = {
        opportunityNumber: 1,
        angle: null,
        target: "event_selection",
        surfaceLevel: "low_pressure_choice",
        repairCount: 0,
        assistantMessageId: null
      };
      return {
        nextState: state,
        directive: {
          responseKind: "clarification",
          questionSpec: questionSpec({
            state,
            angle: null,
            target: "event_selection",
            opportunityNumber: null,
            surfaceLevel: "low_pressure_choice"
          }),
          checkpoint: null,
          angleOutcome: null,
          exactResponse: "我先把你刚才提到的两件事都留在这里。"
        },
        angleOutcome: null,
        preserveCurrentQuestion: false
      };
    }
    if (input.understanding.coreEventIdentifiable || state.lightAnchorOpportunityCount >= 1) {
      return asCheckpoint(state, "first", null);
    }
    state.lightAnchorOpportunityCount = 1;
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: null,
      target: "light_event_anchor",
      surfaceLevel: "concrete_anchor",
      repairCount: 0,
      assistantMessageId: null
    };
    return {
      nextState: state,
      directive: {
        responseKind: "question",
        questionSpec: questionSpec({
          state,
          angle: null,
          target: "light_event_anchor",
          opportunityNumber: null,
          surfaceLevel: "concrete_anchor"
        }),
        checkpoint: null,
        angleOutcome: null,
        exactResponse: "不用说完整，只说你最想留下的那个时刻发生了什么？"
      },
      angleOutcome: null,
      preserveCurrentQuestion: false
    };
  }

  if (state.phase === "event_focus_clarification") {
    if (input.action === "select_current_event") return asCheckpoint(state, "first", null);
    if (
      input.understanding.answerSignal === "declined" ||
      input.understanding.answerSignal === "unknown"
    ) {
      return asCheckpoint(state, "first", null);
    }
    return {
      nextState: state,
      directive: {
        responseKind: "clarification",
        questionSpec: null,
        checkpoint: null,
        angleOutcome: null,
        exactResponse: "两件事都已经留在原话里。"
      },
      angleOutcome: null,
      preserveCurrentQuestion: true
    };
  }

  if (state.phase === "checkpoint_one" || state.phase === "checkpoint_two") {
    if (input.action === "select_exploration_angle" && input.selectedAngle) {
      state.activeAngle = input.selectedAngle;
      ensureAngleRun(state, input.selectedAngle).status = "active";
      return decideAngle(input, state, input.selectedAngle);
    }
    if (state.phase === "checkpoint_two" && input.action === "continue_exploration") {
      state.phase = "deep_companionship";
      state.currentQuestion = null;
      return {
        nextState: state,
        directive: {
          responseKind: "question",
          questionSpec: questionSpec({
            state,
            angle: state.lastCompletedAngle,
            target: "deep_open_point",
            opportunityNumber: null,
            surfaceLevel: "open_anchor"
          }),
          checkpoint: null,
          angleOutcome: null,
          exactResponse: "沿着刚才这条线索，你还想从哪一点继续说？"
        },
        angleOutcome: null,
        preserveCurrentQuestion: false
      };
    }
    return asCheckpoint(state, state.phase === "checkpoint_one" ? "first" : "second", null);
  }

  if (state.phase === "guided_reflection" && state.activeAngle) {
    return decideAngle(input, state, state.activeAngle);
  }

  state.phase = "deep_companionship";
  const advice = input.understanding.adviceRequest;
  if (advice && state.lastCompletedAngle === "action") {
    const answeringAdviceCondition = state.currentQuestion?.target === "action_advice_condition";
    if (!answeringAdviceCondition) {
      state.currentQuestion = {
        opportunityNumber: 1,
        angle: "action",
        target: "action_advice_condition",
        surfaceLevel: "open_anchor",
        repairCount: 0,
        assistantMessageId: null
      };
      return {
        nextState: state,
        directive: {
          responseKind: "question",
          questionSpec: questionSpec({
            state,
            angle: "action",
            target: "action_advice_condition",
            opportunityNumber: null,
            surfaceLevel: "open_anchor"
          }),
          checkpoint: null,
          angleOutcome: null,
          exactResponse: "在给你几个可选办法前，你最想优先守住的条件是什么？"
        },
        angleOutcome: null,
        preserveCurrentQuestion: false
      };
    }
    if (advice.options.length >= 2) {
      state.currentQuestion = null;
      return {
        nextState: state,
        directive: {
          responseKind: "acknowledgement",
          questionSpec: null,
          checkpoint: null,
          angleOutcome: null,
          exactResponse: advice.options
            .slice(0, 3)
            .map((option, index) => `${index + 1}. ${option.text}（取舍：${option.tradeoff}）`)
            .join("\n")
        },
        angleOutcome: null,
        preserveCurrentQuestion: false
      };
    }
  }
  state.currentQuestion = null;
  return {
    nextState: state,
    directive: {
      responseKind: "acknowledgement",
      questionSpec: null,
      checkpoint: null,
      angleOutcome: null,
      exactResponse: input.understanding.answerSignal === "declined"
        ? "好，我们先停在这里。刚才形成的内容已经保留下来。"
        : "我接住了你补充的这一层，也把它并入当前线索。"
    },
    angleOutcome: null,
    preserveCurrentQuestion: false
  };
}
