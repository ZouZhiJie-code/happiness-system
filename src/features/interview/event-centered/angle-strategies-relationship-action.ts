import {
  applyQuestionSurfaceProtocol,
  createQuestionSpec
} from "@/features/joy-interview/server/question-protocol";
import {
  isIncrementalAngleOutcome,
  scopeAngleOutcomeToCurrentEvent
} from "@/features/interview/event-centered/angle-outcome-quality";
import { createEventCenteredQuestionAnchor } from "@/features/interview/event-centered/question-anchor";
import {
  EVENT_CENTERED_ACTION_QUESTION_FOCUS_ORDER,
  inferSingleEventCenteredQuestionFocus,
  textMatchesEventCenteredQuestionFocus,
  type EventCenteredActionQuestionFocus,
  type EventCenteredRelationshipQuestionFocus
} from "@/features/interview/event-centered/response-question-focus";
import type {
  AssistantQuestionSpec,
  AssistantQuestionSurfaceLevel,
  AssistantQuestionTarget,
  InterviewDimension,
  JoySnapshot
} from "@/types/interview";

export const EVENT_CENTERED_ANGLE_MAX_OPPORTUNITIES = 3;

export type RelationshipOrActionAngle = "relationship" | "action";

export type RelationshipStrategyTarget =
  | "relationship_interaction"
  | "relationship_expectation"
  | "relationship_position_or_boundary"
  | "relationship_low_pressure_anchor";

type RelationshipPositionFocus = EventCenteredRelationshipQuestionFocus;

export type ActionStrategyTarget =
  | "action_goal"
  | "action_choice"
  | "action_condition_or_friction"
  | "action_advice_condition"
  | "action_low_pressure_anchor";

export type ActionReflectionFocus = EventCenteredActionQuestionFocus;

export type RelationshipOrActionStrategyTarget =
  | RelationshipStrategyTarget
  | ActionStrategyTarget;

export interface EventCenteredAdviceOption {
  text: string;
  tradeoff: string;
}

export interface EventCenteredStrategyFact {
  id: string;
  text: string;
}

export type EventCenteredExpectedValue = "low" | "meaningful" | "high";
export type EventCenteredEvidenceStrength = "unclear" | "weak" | "clear";
export type EventCenteredCandidateScore = "low" | "medium" | "high";

export interface EventCenteredSupportedOutcome {
  statement: string;
  supportFactIds: string[];
  expectedValue: EventCenteredExpectedValue;
  evidenceStrength: EventCenteredEvidenceStrength;
}

export interface EventCenteredStrategyCandidateAssessment {
  target: RelationshipOrActionStrategyTarget;
  expectedValue: EventCenteredExpectedValue;
  answerEase: EventCenteredCandidateScore;
  specificity: EventCenteredCandidateScore;
}

export interface RelationshipOrActionStrategyInput {
  angle: RelationshipOrActionAngle;
  facts: EventCenteredStrategyFact[];
  latestUserText: string;
  questionOpportunityCount: number;
  lowPressureAnchorUsed: boolean;
  explicitUnknown?: boolean;
  stopRequested?: boolean;
  adviceRequested?: boolean;
  adviceCondition?: string | null;
  adviceOptions?: EventCenteredAdviceOption[];
  eventAnchor?: string | null;
  coveredTargets?: RelationshipOrActionStrategyTarget[];
  askedTargets?: RelationshipOrActionStrategyTarget[];
  candidateAssessments?: EventCenteredStrategyCandidateAssessment[];
  /** 角度刚被选中时允许使用低负担事实锚点，避免空控制轮提前收束。 */
  initialAngleSelection?: boolean;
  supportedOutcome?: EventCenteredSupportedOutcome | null;
  reuseCurrentOpportunity?: boolean;
}

interface StrategyDecisionBase {
  target: RelationshipOrActionStrategyTarget | null;
  question: string | null;
  statement: string | null;
  surfaceLevel: AssistantQuestionSurfaceLevel | null;
  nextOpportunityCount: number;
  lowPressureAnchorUsed: boolean;
  questionSpec: AssistantQuestionSpec | null;
}

export interface RelationshipOrActionAskDecision extends StrategyDecisionBase {
  kind: "ask";
  target: RelationshipOrActionStrategyTarget;
  question: string;
  surfaceLevel: AssistantQuestionSurfaceLevel;
  questionSpec: AssistantQuestionSpec;
  statement: null;
}

export interface RelationshipOrActionOutcomeDecision extends StrategyDecisionBase {
  kind: "outcome";
  /**
   * `null` 表示当前角度提前结束，回到第二检查点且不写角度成果。
   */
  outcomeKind: "insight" | "honest_limit" | null;
  statement: string;
  adviceOptions: [];
}

export interface RelationshipOrActionAdviceDecision extends StrategyDecisionBase {
  kind: "advice_options";
  adviceCondition: string;
  adviceOptions: EventCenteredAdviceOption[];
}

export type RelationshipOrActionStrategyDecision =
  | RelationshipOrActionAskDecision
  | RelationshipOrActionOutcomeDecision
  | RelationshipOrActionAdviceDecision;

const RELATIONSHIP_TARGET_ORDER: RelationshipStrategyTarget[] = [
  "relationship_interaction",
  "relationship_expectation",
  "relationship_position_or_boundary"
];

const ACTION_TARGET_ORDER: ActionStrategyTarget[] = [
  "action_goal",
  "action_choice",
  "action_condition_or_friction"
];
const RELATIONSHIP_MOTIVE_CLAIM =
  /(?:他|她|对方)(?:其实|就是|故意|一定|显然|根本|只是|想要|觉得|认为|不在乎|不尊重|看不起|针对)/u;
const DIRECTIVE_ADVICE = /(?:你应该|你必须|你一定要|照我说的|唯一办法)/u;
const UNRESOLVED_ACTION_FOCUS =
  /(?:还没(?:说清|想清)|没(?:有)?说清|暂时说不清|说不上来|不确定具体)/u;

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function actionFocusFromText(value: string | null | undefined) {
  return inferSingleEventCenteredQuestionFocus({
    angle: "action",
    text: value
  }) as ActionReflectionFocus | null;
}

function resolveActionReflectionFocus(
  input: RelationshipOrActionStrategyInput
): { focus: ActionReflectionFocus; anchorText: string } | null {
  if (input.angle !== "action") return null;
  const sources = [
    input.latestUserText,
    ...input.facts.map((fact) => fact.text)
  ]
    .map((text) => normalizeText(text))
    .filter(Boolean);
  const answered = new Set<ActionReflectionFocus>();
  const unresolved = new Map<ActionReflectionFocus, string>();

  for (const text of sources) {
    for (const focus of EVENT_CENTERED_ACTION_QUESTION_FOCUS_ORDER) {
      if (!textMatchesEventCenteredQuestionFocus({ focus, text })) continue;
      if (UNRESOLVED_ACTION_FOCUS.test(text)) {
        if (!unresolved.has(focus)) unresolved.set(focus, text);
      } else {
        answered.add(focus);
      }
    }
  }

  for (const focus of EVENT_CENTERED_ACTION_QUESTION_FOCUS_ORDER) {
    const anchorText = unresolved.get(focus);
    if (anchorText && !answered.has(focus)) return { focus, anchorText };
  }
  return null;
}

function normalizeOpportunityCount(value: number) {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > EVENT_CENTERED_ANGLE_MAX_OPPORTUNITIES
  ) {
    throw new RangeError(
      `questionOpportunityCount must be an integer between 0 and ${EVENT_CENTERED_ANGLE_MAX_OPPORTUNITIES}.`
    );
  }

  return value;
}

function getAnchor(input: RelationshipOrActionStrategyInput) {
  return (
    createEventCenteredQuestionAnchor(input.eventAnchor) ||
    createEventCenteredQuestionAnchor(
      input.facts.find((fact) => normalizeText(fact.text))?.text
    ) ||
    createEventCenteredQuestionAnchor(input.latestUserText)
  );
}

function createSnapshot(anchorText: string): JoySnapshot {
  return {
    event: anchorText || null,
    feeling: null,
    whyItMattered: null,
    happinessType: null,
    selfPattern: null,
    confidence: 0,
    missingSlots: []
  };
}

function mapAngleToLegacyDimension(angle: RelationshipOrActionAngle): InterviewDimension {
  return angle === "relationship" ? "gratitude" : "improvement";
}

function mapTargetToQuestionTarget(
  target: RelationshipOrActionStrategyTarget
): AssistantQuestionTarget {
  switch (target) {
    case "relationship_interaction":
    case "action_goal":
    case "action_choice":
    case "relationship_low_pressure_anchor":
    case "action_low_pressure_anchor":
      return "event_anchor";
    case "relationship_expectation":
      return "reaction_evidence";
    case "relationship_position_or_boundary":
    case "action_condition_or_friction":
      return "insight_evidence";
    case "action_advice_condition":
      return "judgment_clue";
  }
}

function resolveRelationshipPositionFocus(
  input: RelationshipOrActionStrategyInput
): RelationshipPositionFocus {
  return inferSingleEventCenteredQuestionFocus({
    angle: "relationship",
    text: input.latestUserText
  }) as RelationshipPositionFocus | null ??
    inferSingleEventCenteredQuestionFocus({
      angle: "relationship",
      text: input.facts.map((fact) => fact.text).join(" ")
    }) as RelationshipPositionFocus | null ??
    "relational_position";
}

function buildCandidateQuestion(input: {
  target: RelationshipOrActionStrategyTarget;
  anchorText: string;
  relationshipPositionFocus?: RelationshipPositionFocus;
  actionFocus?: ActionReflectionFocus | null;
}) {
  const lead = "";

  switch (input.target) {
    case "relationship_interaction":
      return `${lead}当时你和对方之间，最关键的互动细节是什么？`;
    case "relationship_expectation":
      return `${lead}那次互动里，你当时最希望对方怎样回应？`;
    case "relationship_position_or_boundary":
      switch (input.relationshipPositionFocus) {
        case "trust_signal":
          return `${lead}这次互动里，对方怎样回应时，你会更确定这段关系是可靠的？`;
        case "reciprocity":
          return `${lead}在这段关系里，你希望双方怎样有来有回？`;
        case "relationship_boundary":
          return `${lead}这件事里，哪一条界限对你最重要？`;
        case "relational_position":
        default:
          return "先回到刚才那次互动。对方怎样回应时，你会更清楚自己在这段关系中的位置？";
      }
    case "relationship_low_pressure_anchor":
      return `${lead}先不用总结关系，只说一个你最确定的互动细节，会是哪一下？`;
    case "action_goal":
      return `${lead}这件事发生时，你当时最想推进的一件事是什么？`;
    case "action_choice":
      return `${lead}为了推进这件事，你当时实际做出的关键选择是什么？`;
    case "action_condition_or_friction":
      switch (input.actionFocus) {
        case "tradeoff":
          return `${lead}这次选择里，你具体在取舍哪两边？`;
        case "effective_condition":
          return `${lead}过程中，哪个具体条件已经帮上了忙？`;
        case "resistance":
          return `${lead}这次行动中，最具体的阻力是什么？`;
        case "adjustable_part":
          return `${lead}回看这次行动，哪一部分是你可以调整的？`;
        default:
          return `${lead}哪个具体条件最影响这次选择能不能推进？`;
      }
    case "action_advice_condition":
      return `${lead}在给你几个可选办法前，你最想优先守住的条件是什么？`;
    case "action_low_pressure_anchor":
      return `${lead}先不用复盘做法，只说你当时实际做了哪一步？`;
  }
}

function repairQuestionBody(
  target: RelationshipOrActionStrategyTarget,
  intent: "simplify" | "concretize",
  relationshipPositionFocus?: RelationshipPositionFocus | null,
  actionFocus?: ActionReflectionFocus | null
) {
  if (intent === "simplify") {
    switch (target) {
      case "relationship_interaction":
        return "当时你们具体说了或做了什么？";
      case "relationship_expectation":
        return "你希望对方怎么回应？";
      case "relationship_position_or_boundary":
        switch (relationshipPositionFocus) {
          case "trust_signal":
            return "哪种回应最影响你对这段关系的信任？";
          case "reciprocity":
            return "你希望双方怎样有来有回？";
          case "relationship_boundary":
            return "这件事里，什么是你不能接受的？";
          case "relational_position":
            return "刚才那次互动里，哪种回应会让你更有平等说话的感觉？";
          default:
            return "这件事里，你最想守住什么？";
        }
      case "relationship_low_pressure_anchor":
        return "你最确定的互动细节是什么？";
      case "action_goal":
        return "当时你最想完成什么？";
      case "action_choice":
        return "当时你做了什么选择？";
      case "action_condition_or_friction":
        switch (actionFocus) {
          case "tradeoff":
            return "当时，你想兼顾的两件事是什么？";
          case "effective_condition":
            return "哪个条件已经帮上了忙？";
          case "resistance":
            return "做到哪一步时，你最难继续？";
          case "adjustable_part":
            return "哪一部分是你可以调整的？";
          default:
            return "什么最影响这件事推进？";
        }
      case "action_advice_condition":
        return "你最想优先守住什么条件？";
      case "action_low_pressure_anchor":
        return "当时你实际做了哪一步？";
    }
  }

  switch (target) {
    case "relationship_interaction":
      return "回到当时，哪句话或哪个动作最关键？";
    case "relationship_expectation":
      return "回到那次互动，你最希望对方接下来做什么？";
    case "relationship_position_or_boundary":
      switch (relationshipPositionFocus) {
        case "trust_signal":
          return "回到那次互动，哪一个具体回应最影响你的信任？";
        case "reciprocity":
          return "回到那次互动，你希望双方各自怎样回应？";
        case "relationship_boundary":
          return "回到那一刻，哪一条具体界限对你最重要？";
        case "relational_position":
          return "回到那次互动，对方怎样回应时，你会更清楚自己在这段关系中的位置？";
        default:
          return "回到那一刻，你最想守住的边界是什么？";
      }
    case "relationship_low_pressure_anchor":
      return "回到当时，只说一个你最确定的互动细节，会是哪一下？";
    case "action_goal":
      return "回到当时，你最想先完成哪一步？";
    case "action_choice":
      return "回到当时，你先做的那个决定是什么？";
    case "action_condition_or_friction":
      switch (actionFocus) {
        case "tradeoff":
          return "回到这个选择，当时要兼顾的两边分别是什么？";
        case "effective_condition":
          return "回到推进过程，具体哪个环节已经起了作用？";
        case "resistance":
          return "回到推进过程，具体卡住你的是哪一点？";
        case "adjustable_part":
          return "回看这次行动，具体哪一步是你可以调整的？";
        default:
          return "具体哪个条件让这件事推进或卡住？";
      }
    case "action_advice_condition":
      return "在考虑办法前，你最想优先守住的具体条件是什么？";
    case "action_low_pressure_anchor":
      return "回到当时，你实际做出的第一步是什么？";
  }
}

export function renderRelationshipOrActionRepairQuestion(input: {
  angle: RelationshipOrActionAngle;
  target: string;
  intent: "simplify" | "concretize";
  anchorText?: string | null;
  currentQuestionText?: string | null;
}) {
  const validTargets = input.angle === "relationship"
    ? new Set<RelationshipOrActionStrategyTarget>([
        "relationship_interaction",
        "relationship_expectation",
        "relationship_position_or_boundary",
        "relationship_low_pressure_anchor"
      ])
    : new Set<RelationshipOrActionStrategyTarget>([
        "action_goal",
        "action_choice",
        "action_condition_or_friction",
        "action_advice_condition",
        "action_low_pressure_anchor"
      ]);
  if (!validTargets.has(input.target as RelationshipOrActionStrategyTarget)) return null;

  const lead = "";
  const relationshipPositionFocus =
    input.angle === "relationship" &&
    input.target === "relationship_position_or_boundary"
      ? inferSingleEventCenteredQuestionFocus({
          angle: "relationship",
          text: input.currentQuestionText
        }) as RelationshipPositionFocus | null ??
        inferSingleEventCenteredQuestionFocus({
          angle: "relationship",
          text: input.anchorText
        }) as RelationshipPositionFocus | null
      : null;
  const actionFocus =
    input.angle === "action" &&
    input.target === "action_condition_or_friction"
      ? actionFocusFromText(input.currentQuestionText) ??
        actionFocusFromText(input.anchorText)
      : null;
  const omitMechanicalLead = input.angle === "relationship" &&
    input.target === "relationship_position_or_boundary" &&
    relationshipPositionFocus === "relational_position";
  return `${omitMechanicalLead ? "" : lead}${repairQuestionBody(
    input.target as RelationshipOrActionStrategyTarget,
    input.intent,
    relationshipPositionFocus,
    actionFocus
  )}`;
}

function createAskDecision(input: {
  source: RelationshipOrActionStrategyInput;
  target: RelationshipOrActionStrategyTarget;
  lowPressure: boolean;
  opportunityCount: number;
}): RelationshipOrActionAskDecision {
  const actionFocus = input.target === "action_condition_or_friction"
    ? resolveActionReflectionFocus(input.source)
    : null;
  const anchorText = actionFocus
    ? createEventCenteredQuestionAnchor(actionFocus.anchorText)
    : getAnchor(input.source);
  const dimension = mapAngleToLegacyDimension(input.source.angle);
  const snapshot = createSnapshot(anchorText);
  const relationshipPositionFocus =
    input.source.angle === "relationship" &&
    input.target === "relationship_position_or_boundary"
      ? resolveRelationshipPositionFocus(input.source)
      : undefined;
  const questionSpec = createQuestionSpec({
    dimension,
    stage: "probe_reason",
    snapshot,
    stageIntent: "advance",
    target: mapTargetToQuestionTarget(input.target),
    surfaceLevel: input.lowPressure ? "low_pressure" : "default"
  });
  const candidateQuestion = buildCandidateQuestion({
    target: input.target,
    anchorText,
    relationshipPositionFocus,
    actionFocus: actionFocus?.focus ?? null
  });
  const resolved = applyQuestionSurfaceProtocol({
    dimension,
    stage: "probe_reason",
    snapshot,
    spec: questionSpec,
    candidateQuestion,
    preserveStructuredCandidateQuestion: true
  });
  const nextOpportunityCount = input.source.reuseCurrentOpportunity
    ? input.opportunityCount
    : Math.min(
        EVENT_CENTERED_ANGLE_MAX_OPPORTUNITIES,
        input.opportunityCount + 1
      );

  return {
    kind: "ask",
    target: input.target,
    // GI-059 的角度策略已经完成目标选择与自然问题表达；旧五维表面协议
    // 只继续提供 questionSpec 和降压级别，避免它把问题改写回“你提到……”
    // 或替换成另一个维度的槽位问题。
    question: candidateQuestion,
    statement: null,
    surfaceLevel: resolved.questionSpec.surfaceLevel,
    nextOpportunityCount,
    lowPressureAnchorUsed: input.source.lowPressureAnchorUsed || input.lowPressure,
    questionSpec: resolved.questionSpec
  };
}

function isSupportedOutcomeAllowed(input: RelationshipOrActionStrategyInput) {
  const currentFactIds = new Set(
    input.facts
      .filter((fact) => normalizeText(fact.id) && normalizeText(fact.text))
      .map((fact) => fact.id)
  );
  const supportFactIds = [
    ...new Set(input.supportedOutcome?.supportFactIds ?? [])
  ];
  const supportFactIdSet = new Set(supportFactIds);
  const statement = normalizeText(scopeAngleOutcomeToCurrentEvent({
    statement: input.supportedOutcome?.statement,
    supportFactTexts: input.facts
      .filter((fact) => supportFactIdSet.has(fact.id))
      .map((fact) => fact.text)
  }));

  if (
    !statement ||
    supportFactIds.length === 0 ||
    supportFactIds.some((factId) => !currentFactIds.has(factId)) ||
    (input.supportedOutcome?.expectedValue !== "meaningful" &&
      input.supportedOutcome?.expectedValue !== "high") ||
    input.supportedOutcome?.evidenceStrength !== "clear"
  ) {
    return false;
  }

  if (!isIncrementalAngleOutcome({
    statement,
    supportFactIds,
    facts: input.facts.map((fact) => ({ id: fact.id, text: fact.text }))
  })) {
    return false;
  }

  if (input.angle === "relationship" && RELATIONSHIP_MOTIVE_CLAIM.test(statement)) {
    return false;
  }

  return input.angle !== "action" || !DIRECTIVE_ADVICE.test(statement);
}

function createOutcomeDecision(input: {
  source: RelationshipOrActionStrategyInput;
  opportunityCount: number;
  kind: "insight" | "honest_limit" | null;
}): RelationshipOrActionOutcomeDecision {
  const statement =
    input.kind === "insight"
      ? normalizeText(scopeAngleOutcomeToCurrentEvent({
          statement: input.source.supportedOutcome?.statement,
          supportFactTexts: input.source.facts
            .filter((fact) => input.source.supportedOutcome?.supportFactIds.includes(fact.id))
            .map((fact) => fact.text)
        }))
      : input.kind === "honest_limit" && input.source.angle === "relationship"
        ? "目前能确认的是这次互动本身，关系里的期待或边界还暂时说不清。"
        : input.kind === "honest_limit"
          ? "目前能确认的是这次行动本身，目标、选择或影响条件还暂时说不清。"
          : "这个角度先停在这里。";

  return {
    kind: "outcome",
    target: null,
    question: null,
    statement,
    surfaceLevel: null,
    nextOpportunityCount: input.opportunityCount,
    lowPressureAnchorUsed: input.source.lowPressureAnchorUsed,
    questionSpec: null,
    outcomeKind: input.kind,
    adviceOptions: []
  };
}

function normalizeAdviceOptions(options: EventCenteredAdviceOption[] | undefined) {
  return (options ?? [])
    .map((option) => ({
      text: normalizeText(option.text),
      tradeoff: normalizeText(option.tradeoff)
    }))
    .filter(
      (option) =>
        option.text && option.tradeoff && !DIRECTIVE_ADVICE.test(option.text)
    )
    .slice(0, 3);
}

function scoreCandidate(value: EventCenteredCandidateScore) {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function createAdviceDecision(input: {
  source: RelationshipOrActionStrategyInput;
  opportunityCount: number;
}): RelationshipOrActionAdviceDecision {
  const adviceCondition = normalizeText(input.source.adviceCondition);

  return {
    kind: "advice_options",
    target: null,
    question: null,
    statement: null,
    surfaceLevel: null,
    nextOpportunityCount: input.opportunityCount,
    lowPressureAnchorUsed: input.source.lowPressureAnchorUsed,
    questionSpec: null,
    adviceCondition,
    adviceOptions: normalizeAdviceOptions(input.source.adviceOptions)
  };
}

function getNextTarget(input: RelationshipOrActionStrategyInput) {
  const coveredTargets = new Set(input.coveredTargets ?? []);
  const askedTargets = new Set(input.askedTargets ?? []);
  const targetOrder =
    input.angle === "relationship"
      ? RELATIONSHIP_TARGET_ORDER
      : ACTION_TARGET_ORDER;
  const initialFallbackTarget: RelationshipOrActionStrategyTarget =
    input.angle === "relationship"
      ? "relationship_low_pressure_anchor"
      : "action_low_pressure_anchor";
  const canUseInitialFallback = input.initialAngleSelection &&
    !coveredTargets.has(initialFallbackTarget) &&
    !askedTargets.has(initialFallbackTarget);

  const mandatoryTarget = input.angle === "relationship"
    ? !coveredTargets.has("relationship_interaction")
      ? "relationship_interaction"
      : null
    : !coveredTargets.has("action_goal")
      ? "action_goal"
      : !coveredTargets.has("action_choice")
        ? "action_choice"
        : null;
  if (mandatoryTarget) {
    // 基础目标已经问过却没有可追溯回答时，当前轮不重复原问，也不越过
    // 它去问更深一层。由上层回到检查点承接用户控制。
    if (askedTargets.has(mandatoryTarget)) return null;
    return mandatoryTarget;
  }

  const remainingTargets = targetOrder.filter(
    (target) => !coveredTargets.has(target) && !askedTargets.has(target)
  );

  if (remainingTargets.length === 0) {
    return canUseInitialFallback ? initialFallbackTarget : null;
  }

  if (
    input.angle === "action" &&
    remainingTargets.includes("action_condition_or_friction") &&
    !resolveActionReflectionFocus(input)
  ) {
    return canUseInitialFallback ? initialFallbackTarget : null;
  }

  if (!input.candidateAssessments) {
    return remainingTargets[0] ?? null;
  }

  const targetOrderIndex = new Map(
    targetOrder.map((target, index) => [target, index])
  );
  const remainingTargetSet = new Set<RelationshipOrActionStrategyTarget>(
    remainingTargets
  );
  const eligible = input.candidateAssessments
    .filter(
      (assessment) =>
        remainingTargetSet.has(assessment.target) &&
        (assessment.expectedValue === "meaningful" ||
          assessment.expectedValue === "high")
    )
    .sort((left, right) => {
      const answerEaseDifference =
        scoreCandidate(right.answerEase) - scoreCandidate(left.answerEase);

      if (answerEaseDifference !== 0) {
        return answerEaseDifference;
      }

      const specificityDifference =
        scoreCandidate(right.specificity) - scoreCandidate(left.specificity);

      if (specificityDifference !== 0) {
        return specificityDifference;
      }

      return (
        (targetOrderIndex.get(left.target) ?? Number.MAX_SAFE_INTEGER) -
        (targetOrderIndex.get(right.target) ?? Number.MAX_SAFE_INTEGER)
      );
    });

  return eligible[0]?.target ?? null;
}

export function decideRelationshipOrActionStrategy(
  input: RelationshipOrActionStrategyInput
): RelationshipOrActionStrategyDecision {
  const opportunityCount = normalizeOpportunityCount(input.questionOpportunityCount);
  const supportedOutcomeAllowed = isSupportedOutcomeAllowed(input);

  if (input.stopRequested || input.explicitUnknown) {
    return createOutcomeDecision({
      source: input,
      opportunityCount,
      kind: opportunityCount >= EVENT_CENTERED_ANGLE_MAX_OPPORTUNITIES
        ? supportedOutcomeAllowed ? "insight" : "honest_limit"
        : null
    });
  }

  if (supportedOutcomeAllowed && !input.adviceRequested) {
    return createOutcomeDecision({
      source: input,
      opportunityCount,
      kind: "insight"
    });
  }

  if (input.angle === "action" && input.adviceRequested) {
    if (normalizeText(input.adviceCondition)) {
      if (normalizeAdviceOptions(input.adviceOptions).length < 2) {
        return createOutcomeDecision({
          source: input,
          opportunityCount,
          kind: opportunityCount >= EVENT_CENTERED_ANGLE_MAX_OPPORTUNITIES
            ? supportedOutcomeAllowed ? "insight" : "honest_limit"
            : null
        });
      }

      return createAdviceDecision({
        source: input,
        opportunityCount
      });
    }

    if (opportunityCount < EVENT_CENTERED_ANGLE_MAX_OPPORTUNITIES) {
      return createAskDecision({
        source: input,
        target: "action_advice_condition",
        lowPressure: false,
        opportunityCount
      });
    }

    return createOutcomeDecision({
      source: input,
      opportunityCount,
      kind: supportedOutcomeAllowed ? "insight" : "honest_limit"
    });
  }

  if (opportunityCount >= EVENT_CENTERED_ANGLE_MAX_OPPORTUNITIES) {
    return createOutcomeDecision({
      source: input,
      opportunityCount,
      kind: supportedOutcomeAllowed ? "insight" : "honest_limit"
    });
  }

  const nextTarget = getNextTarget(input);

  if (!nextTarget) {
    return createOutcomeDecision({
      source: input,
      opportunityCount,
      kind: opportunityCount >= EVENT_CENTERED_ANGLE_MAX_OPPORTUNITIES
        ? supportedOutcomeAllowed ? "insight" : "honest_limit"
        : null
    });
  }

  return createAskDecision({
    source: input,
    target: nextTarget,
    lowPressure: false,
    opportunityCount
  });
}
