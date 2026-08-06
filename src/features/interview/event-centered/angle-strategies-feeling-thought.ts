import { evaluateQuestionComprehension } from "@/features/joy-interview/server/comprehension-gate";
import {
  isIncrementalAngleOutcome,
  scopeAngleOutcomeToCurrentEvent
} from "@/features/interview/event-centered/angle-outcome-quality";
import { createEventCenteredQuestionAnchor } from "@/features/interview/event-centered/question-anchor";
import type {
  AssistantQuestionSpec,
  AssistantQuestionTarget,
  JoySnapshot
} from "@/types/interview";

export type FeelingThoughtAngle = "feeling" | "thought";

export type FeelingQuestionTarget =
  | "direct_experience"
  | "specific_trigger"
  | "experience_change"
  | "mixed_feeling"
  | "body_state"
  | "care_need_boundary";

export type ThoughtQuestionTarget =
  | "immediate_thought"
  | "judgment_basis"
  | "default_expectation"
  | "evaluation_standard"
  | "tradeoff_condition";

export type FeelingThoughtQuestionTarget = FeelingQuestionTarget | ThoughtQuestionTarget;
export type AngleAnswerKind = "substantive" | "unknown" | "denied" | "stop";
export type AngleExpectedValue = "below_threshold" | "meaningful";

export interface AngleOutcomeCandidate {
  statement: string;
  supportFactIds: string[];
  /** 当前活动路径中的事实文字，用于拒绝泛化占位和近似复述。 */
  supportFactTexts?: string[];
  expectedValue: AngleExpectedValue;
  evidenceStrength: "weak" | "clear";
}

export interface AngleQuestionCandidateAssessment {
  target: FeelingThoughtQuestionTarget;
  expectedValue: AngleExpectedValue;
  /** 1（难回答）到 5（很容易回答）。 */
  answerEase: 1 | 2 | 3 | 4 | 5;
  /** 1（偏抽象）到 5（非常具体）。 */
  specificity: 1 | 2 | 3 | 4 | 5;
}

export interface PlanFeelingThoughtAngleTurnInput {
  angle: FeelingThoughtAngle;
  anchorText?: string | null;
  answeredTargets?: FeelingThoughtQuestionTarget[];
  askedTargets?: FeelingThoughtQuestionTarget[];
  salientTargets?: FeelingThoughtQuestionTarget[];
  candidateAssessments?: AngleQuestionCandidateAssessment[];
  /** 角度刚被选中时，允许从尚未回答的可选目标中取一个贴题首问。 */
  allowOptionalTargetsWithoutSalience?: boolean;
  answerOpportunityCount: number;
  lowPressureAnchorUsed: boolean;
  lastAnswerKind?: AngleAnswerKind | null;
  outcomeCandidate?: AngleOutcomeCandidate | null;
  honestLimitStatement?: string | null;
}

export interface EventCenteredAngleStrategyFact {
  id: string;
  text: string;
}

export interface DecideFeelingOrThoughtStrategyInput {
  angle: FeelingThoughtAngle;
  facts: EventCenteredAngleStrategyFact[];
  latestUserText: string;
  questionOpportunityCount: number;
  lowPressureAnchorUsed: boolean;
  explicitUnknown: boolean;
  explicitStop: boolean;
  anchorText?: string | null;
  answeredTargets?: FeelingThoughtQuestionTarget[];
  askedTargets?: FeelingThoughtQuestionTarget[];
  salientTargets?: FeelingThoughtQuestionTarget[];
  candidateAssessments?: AngleQuestionCandidateAssessment[];
  allowOptionalTargetsWithoutSalience?: boolean;
  outcomeCandidate?: AngleOutcomeCandidate | null;
  honestLimitStatement?: string | null;
}

export interface AngleQuestionQuality {
  pass: boolean;
  reasonCodes: string[];
  downgradeRecommendation: string | null;
}

export type FeelingThoughtAngleTurnDecision =
  | {
      kind: "ask";
      angle: FeelingThoughtAngle;
      target: FeelingThoughtQuestionTarget;
      question: string;
      surfaceLevel: "default" | "low_pressure";
      consumesAnswerOpportunity: true;
      reason: "best_answerable_increment" | "single_low_pressure_anchor";
      quality: AngleQuestionQuality;
    }
  | {
      kind: "complete";
      angle: FeelingThoughtAngle;
      /**
       * `null` 表示用户已结束当前角度，但尚未走完三次回答机会。
       * 这类结束回到第二检查点，不形成可被日志读取的角度成果。
       */
      completionKind: "insight" | "honest_limit" | null;
      statement: string;
      supportFactIds: string[];
      reason:
        | "zero_question_insight"
        | "three_opportunity_limit"
        | "unknown_anchor_exhausted"
        | "user_boundary"
        | "no_valuable_question";
    };

export type FeelingOrThoughtStrategyResult =
  | {
      kind: "ask";
      angle: FeelingThoughtAngle;
      target: FeelingThoughtQuestionTarget;
      question: string;
      statement: null;
      outcomeKind: null;
      surfaceLevel: "default" | "low_pressure";
      nextOpportunityCount: number;
      lowPressureAnchorUsed: boolean;
      reason: Extract<FeelingThoughtAngleTurnDecision, { kind: "ask" }>["reason"];
      quality: AngleQuestionQuality;
    }
  | {
      kind: "outcome";
      angle: FeelingThoughtAngle;
      target: null;
      question: null;
      statement: string;
      outcomeKind: "insight" | "honest_limit" | null;
      surfaceLevel: null;
      nextOpportunityCount: number;
      lowPressureAnchorUsed: boolean;
      reason: Extract<FeelingThoughtAngleTurnDecision, { kind: "complete" }>["reason"];
      quality: null;
    };

interface TargetDefinition {
  target: FeelingThoughtQuestionTarget;
  angle: FeelingThoughtAngle;
  pathIndex: number;
  defaultEase: 1 | 2 | 3 | 4 | 5;
  defaultSpecificity: 1 | 2 | 3 | 4 | 5;
  required: boolean;
}

const TARGET_DEFINITIONS: TargetDefinition[] = [
  {
    target: "direct_experience",
    angle: "feeling",
    pathIndex: 0,
    defaultEase: 5,
    defaultSpecificity: 4,
    required: true
  },
  {
    target: "specific_trigger",
    angle: "feeling",
    pathIndex: 1,
    defaultEase: 5,
    defaultSpecificity: 5,
    required: false
  },
  {
    target: "experience_change",
    angle: "feeling",
    pathIndex: 2,
    defaultEase: 4,
    defaultSpecificity: 4,
    required: false
  },
  {
    target: "body_state",
    angle: "feeling",
    pathIndex: 3,
    defaultEase: 4,
    defaultSpecificity: 5,
    required: false
  },
  {
    target: "mixed_feeling",
    angle: "feeling",
    pathIndex: 4,
    defaultEase: 3,
    defaultSpecificity: 3,
    required: false
  },
  {
    target: "care_need_boundary",
    angle: "feeling",
    pathIndex: 5,
    defaultEase: 2,
    defaultSpecificity: 3,
    required: false
  },
  {
    target: "immediate_thought",
    angle: "thought",
    pathIndex: 0,
    defaultEase: 5,
    defaultSpecificity: 4,
    required: true
  },
  {
    target: "judgment_basis",
    angle: "thought",
    pathIndex: 1,
    defaultEase: 4,
    defaultSpecificity: 5,
    required: true
  },
  {
    target: "default_expectation",
    angle: "thought",
    pathIndex: 2,
    defaultEase: 5,
    defaultSpecificity: 4,
    required: false
  },
  {
    target: "evaluation_standard",
    angle: "thought",
    pathIndex: 3,
    defaultEase: 4,
    defaultSpecificity: 4,
    required: false
  },
  {
    target: "tradeoff_condition",
    angle: "thought",
    pathIndex: 4,
    defaultEase: 3,
    defaultSpecificity: 4,
    required: false
  }
];

const TARGET_DEFINITION_BY_NAME = new Map(
  TARGET_DEFINITIONS.map((definition) => [definition.target, definition])
);

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/gu, " ").trim() ?? "";
}

function withAnchor(anchorText: string | null | undefined, question: string) {
  void createEventCenteredQuestionAnchor(anchorText, 28);
  return question;
}

function renderQuestion(
  target: FeelingThoughtQuestionTarget,
  anchorText: string | null | undefined
) {
  switch (target) {
    case "direct_experience":
      return withAnchor(anchorText, "当时最先出现的具体感受是什么？");
    case "specific_trigger":
      return withAnchor(anchorText, "当时哪一下最影响这份感受？");
    case "experience_change":
      return withAnchor(anchorText, "在那一刻前后，你的感受分别是什么？");
    case "mixed_feeling":
      return withAnchor(anchorText, "如果还夹着另一层感受，最具体的是哪一种？");
    case "body_state":
      return withAnchor(anchorText, "当时身体上最明显的具体反应是什么？");
    case "care_need_boundary":
      return withAnchor(anchorText, "这份感受最具体地提醒了你在意什么？");
    case "immediate_thought":
      return withAnchor(anchorText, "当时脑子里最先冒出来的具体念头是什么？");
    case "judgment_basis":
      return withAnchor(anchorText, "当时哪个具体事实最影响你这样判断？");
    case "default_expectation":
      return withAnchor(anchorText, "这件事和你原先哪个具体期待最不一样？");
    case "evaluation_standard":
      return withAnchor(anchorText, "你当时最看重的一个具体衡量点是什么？");
    case "tradeoff_condition":
      return withAnchor(anchorText, "你当时最难取舍的那个具体点是什么？");
  }
}

function renderRepairQuestionBody(
  target: FeelingThoughtQuestionTarget,
  intent: "simplify" | "concretize"
) {
  if (intent === "simplify") {
    switch (target) {
      case "direct_experience":
        return "当时你是什么感受？";
      case "specific_trigger":
        return "是哪一刻让你有这种感受？";
      case "experience_change":
        return "后来你的感受怎么变了？";
      case "mixed_feeling":
        return "当时还有哪一种感受？";
      case "body_state":
        return "当时身体有什么反应？";
      case "care_need_boundary":
        return "这份感受说明你在意什么？";
      case "immediate_thought":
        return "当时你第一反应想到什么？";
      case "judgment_basis":
        return "哪个事实让你这样判断？";
      case "default_expectation":
        return "你原本以为会怎样？";
      case "evaluation_standard":
        return "你当时最看重什么标准？";
      case "tradeoff_condition":
        return "你当时在取舍什么？";
    }
  }

  switch (target) {
    case "direct_experience":
      return "回到当时那一刻，你最先感觉到什么？";
    case "specific_trigger":
      return "具体是哪句话或哪个动作带出了这份感受？";
    case "experience_change":
      return "从事情发生到后来，哪一刻你的感受变了？";
    case "mixed_feeling":
      return "回到当时，除了这份感受，还夹着哪一种？";
    case "body_state":
      return "回到当时，身体上最明显的反应是什么？";
    case "care_need_boundary":
      return "回到那一刻，你最想守住的一件事是什么？";
    case "immediate_thought":
      return "回到当时那一刻，脑子里冒出的第一句话是什么？";
    case "judgment_basis":
      return "具体哪个事实最影响你这样判断？";
    case "default_expectation":
      return "事情发生前，你具体预想会怎样？";
    case "evaluation_standard":
      return "当时你用哪个具体点衡量这件事？";
    case "tradeoff_condition":
      return "当时是哪两个具体方向让你难选？";
  }
}

export function renderFeelingThoughtRepairQuestion(input: {
  angle: FeelingThoughtAngle;
  target: string;
  intent: "simplify" | "concretize";
  anchorText?: string | null;
}) {
  const definition = TARGET_DEFINITION_BY_NAME.get(
    input.target as FeelingThoughtQuestionTarget
  );
  if (!definition || definition.angle !== input.angle) return null;

  return withAnchor(
    input.anchorText,
    renderRepairQuestionBody(
      input.target as FeelingThoughtQuestionTarget,
      input.intent
    )
  );
}

function mapToLegacyQuestionTarget(
  target: FeelingThoughtQuestionTarget,
  surfaceLevel: "default" | "low_pressure"
): AssistantQuestionTarget {
  if (surfaceLevel === "low_pressure") {
    return "event_anchor";
  }

  switch (target) {
    case "direct_experience":
    case "body_state":
    case "immediate_thought":
      return "reaction_evidence";
    case "specific_trigger":
      return "event_anchor";
    case "experience_change":
    case "mixed_feeling":
    case "judgment_basis":
      return "insight_evidence";
    case "care_need_boundary":
    case "default_expectation":
    case "evaluation_standard":
    case "tradeoff_condition":
      return "judgment_clue";
  }
}

function buildLegacySnapshot(anchorText: string | null | undefined): JoySnapshot {
  return {
    event: createEventCenteredQuestionAnchor(anchorText, 28) || null,
    feeling: null,
    whyItMattered: null,
    happinessType: null,
    selfPattern: null,
    confidence: 0,
    missingSlots: []
  };
}

export function evaluateFeelingThoughtQuestion(input: {
  target: FeelingThoughtQuestionTarget;
  question: string;
  anchorText?: string | null;
  surfaceLevel: "default" | "low_pressure";
}): AngleQuestionQuality {
  const spec: AssistantQuestionSpec = {
    target: mapToLegacyQuestionTarget(input.target, input.surfaceLevel),
    stageIntent: "advance",
    surfaceLevel: input.surfaceLevel === "low_pressure" ? "low_pressure" : "default",
    // GI-059 将事实锚点留在内部选题层，正式问题只保留自然指代，
    // 因此清晰度检查不再要求问题逐字复现该锚点。
    anchorText: null,
    repairCount: 0
  };
  const result = evaluateQuestionComprehension({
    dimension: "reflection",
    question: input.question,
    spec,
    snapshot: buildLegacySnapshot(input.anchorText)
  });

  return {
    pass: result.pass,
    reasonCodes: result.reasonCodes,
    downgradeRecommendation: result.downgradeRecommendation
  };
}

function isValidOutcomeCandidate(candidate: AngleOutcomeCandidate | null | undefined) {
  const basicEligibility = Boolean(
    candidate &&
      normalizeText(candidate.statement) &&
      candidate.supportFactIds.length > 0 &&
      candidate.expectedValue === "meaningful" &&
      candidate.evidenceStrength === "clear"
  );
  if (!basicEligibility || !candidate) return false;

  // 零问成果必须带入当前投影的事实文字。这样纯策略调用也无法绕开
  // “用户原话已有明确关系”的验证。
  if (!candidate.supportFactTexts?.length) return false;
  if (candidate.supportFactTexts.length !== candidate.supportFactIds.length) return false;

  const statement = scopeAngleOutcomeToCurrentEvent({
    statement: candidate.statement,
    supportFactTexts: candidate.supportFactTexts
  });

  return isIncrementalAngleOutcome({
    statement,
    supportFactIds: candidate.supportFactIds,
    facts: candidate.supportFactIds.map((id, index) => ({
      id,
      text: candidate.supportFactTexts?.[index] ?? ""
    }))
  });
}

function completeDecision(
  input: PlanFeelingThoughtAngleTurnInput,
  reason: Extract<FeelingThoughtAngleTurnDecision, { kind: "complete" }>["reason"],
  options?: { allowInsight?: boolean }
): FeelingThoughtAngleTurnDecision {
  if (options?.allowInsight !== false && isValidOutcomeCandidate(input.outcomeCandidate)) {
    const statement = scopeAngleOutcomeToCurrentEvent({
      statement: input.outcomeCandidate?.statement,
      supportFactTexts: input.outcomeCandidate?.supportFactTexts ?? []
    });
    return {
      kind: "complete",
      angle: input.angle,
      completionKind: "insight",
      statement: normalizeText(statement),
      supportFactIds: [...new Set(input.outcomeCandidate?.supportFactIds ?? [])],
      reason
    };
  }

  if (input.answerOpportunityCount < 3) {
    return {
      kind: "complete",
      angle: input.angle,
      completionKind: null,
      statement: "这个角度先停在这里。",
      supportFactIds: [],
      reason
    };
  }

  return {
    kind: "complete",
    angle: input.angle,
    completionKind: "honest_limit",
    statement:
      normalizeText(input.honestLimitStatement) ||
      "目前能确认的内容还有限，先保留到这里。",
    supportFactIds: [],
    reason
  };
}

function validateAnswerOpportunityCount(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 3) {
    throw new RangeError("answerOpportunityCount must be an integer between 0 and 3");
  }
}

function chooseQuestionCandidate(input: PlanFeelingThoughtAngleTurnInput) {
  const answeredTargets = new Set(input.answeredTargets ?? []);
  const askedTargets = new Set(input.askedTargets ?? []);
  const salientTargets = new Set(input.salientTargets ?? []);
  const assessmentByTarget = new Map(
    (input.candidateAssessments ?? []).map((assessment) => [assessment.target, assessment])
  );
  const requiredTargetsStillOpen = TARGET_DEFINITIONS.filter(
    (definition) => definition.angle === input.angle && definition.required
  )
    .sort((left, right) => left.pathIndex - right.pathIndex)
    .filter((definition) => !answeredTargets.has(definition.target));
  const nextRequiredTarget = requiredTargetsStillOpen[0]?.target;

  // 一个基础目标已经问过、用户也未给出可追溯回答时，当前轮不再原样
  // 重问或跳到更深目标。策略会回到检查点，等用户主动选择是否继续。
  if (nextRequiredTarget && askedTargets.has(nextRequiredTarget)) return undefined;

  return TARGET_DEFINITIONS.filter((definition) => {
    if (
      definition.angle !== input.angle ||
      answeredTargets.has(definition.target) ||
      askedTargets.has(definition.target)
    ) {
      return false;
    }

    if (nextRequiredTarget && definition.target !== nextRequiredTarget) {
      return false;
    }

    if (
      !nextRequiredTarget &&
      !definition.required &&
      !salientTargets.has(definition.target) &&
      !input.allowOptionalTargetsWithoutSalience
    ) {
      return false;
    }

    const assessment = assessmentByTarget.get(definition.target);
    return assessment?.expectedValue !== "below_threshold";
  })
    .map((definition) => {
      const assessment = assessmentByTarget.get(definition.target);
      return {
        definition,
        answerEase: assessment?.answerEase ?? definition.defaultEase,
        specificity: assessment?.specificity ?? definition.defaultSpecificity
      };
    })
    .sort((left, right) => {
      if (right.answerEase !== left.answerEase) {
        return right.answerEase - left.answerEase;
      }

      if (right.specificity !== left.specificity) {
        return right.specificity - left.specificity;
      }

      return left.definition.pathIndex - right.definition.pathIndex;
    })[0]?.definition.target;
}

export function planFeelingThoughtAngleTurn(
  input: PlanFeelingThoughtAngleTurnInput
): FeelingThoughtAngleTurnDecision {
  validateAnswerOpportunityCount(input.answerOpportunityCount);

  const userEndedCurrentAngle =
    input.lastAnswerKind === "stop" ||
    input.lastAnswerKind === "unknown" ||
    input.lastAnswerKind === "denied";

  // 文本边界优先于本轮的推测性整理。三次机会前只回到检查点；
  // 三次机会已经用尽时，才允许写入 honest_limit。
  if (userEndedCurrentAngle && input.answerOpportunityCount < 3) {
    return completeDecision(input, "user_boundary", { allowInsight: false });
  }

  if (isValidOutcomeCandidate(input.outcomeCandidate)) {
    return completeDecision(input, "zero_question_insight");
  }

  if (input.answerOpportunityCount >= 3) {
    return completeDecision(
      input,
      userEndedCurrentAngle ? "user_boundary" : "three_opportunity_limit"
    );
  }

  const target = chooseQuestionCandidate(input);

  if (!target) {
    return completeDecision(input, "no_valuable_question");
  }

  const question = renderQuestion(target, input.anchorText);

  return {
    kind: "ask",
    angle: input.angle,
    target,
    question,
    surfaceLevel: "default",
    consumesAnswerOpportunity: true,
    reason: "best_answerable_increment",
    quality: evaluateFeelingThoughtQuestion({
      target,
      question,
      anchorText: input.anchorText,
      surfaceLevel: "default"
    })
  };
}

function restrictOutcomeToKnownFacts(
  candidate: AngleOutcomeCandidate | null | undefined,
  facts: EventCenteredAngleStrategyFact[]
) {
  if (!candidate) {
    return null;
  }

  const knownFactIds = new Set(facts.map((fact) => fact.id));
  if (candidate.supportFactIds.some((factId) => !knownFactIds.has(factId))) {
    return null;
  }

  const supportFactTexts = candidate.supportFactIds.map(
    (factId) => facts.find((fact) => fact.id === factId)?.text ?? ""
  );
  return {
    ...candidate,
    statement: scopeAngleOutcomeToCurrentEvent({
      statement: candidate.statement,
      supportFactTexts
    }),
    supportFactTexts
  };
}

/**
 * 公共编排层使用的统一入口。策略层只决定下一问或角度成果，事实写入、
 * 分支、幂等和回复生成继续由上层服务负责。
 */
export function decideFeelingOrThoughtStrategy(
  input: DecideFeelingOrThoughtStrategyInput
): FeelingOrThoughtStrategyResult {
  const anchorText =
    normalizeText(input.anchorText) ||
    normalizeText(input.facts[0]?.text) ||
    normalizeText(input.latestUserText) ||
    null;
  const decision = planFeelingThoughtAngleTurn({
    angle: input.angle,
    anchorText,
    answeredTargets: input.answeredTargets,
    askedTargets: input.askedTargets,
    salientTargets: input.salientTargets,
    candidateAssessments: input.candidateAssessments,
    allowOptionalTargetsWithoutSalience: input.allowOptionalTargetsWithoutSalience,
    answerOpportunityCount: input.questionOpportunityCount,
    lowPressureAnchorUsed: input.lowPressureAnchorUsed,
    lastAnswerKind: input.explicitStop
      ? "stop"
      : input.explicitUnknown
        ? "unknown"
        : input.latestUserText
          ? "substantive"
          : null,
    outcomeCandidate: restrictOutcomeToKnownFacts(input.outcomeCandidate, input.facts),
    honestLimitStatement: input.honestLimitStatement
  });

  if (decision.kind === "ask") {
    return {
      kind: "ask",
      angle: decision.angle,
      target: decision.target,
      question: decision.question,
      statement: null,
      outcomeKind: null,
      surfaceLevel: decision.surfaceLevel,
      nextOpportunityCount: input.questionOpportunityCount + 1,
      lowPressureAnchorUsed:
        input.lowPressureAnchorUsed || decision.surfaceLevel === "low_pressure",
      reason: decision.reason,
      quality: decision.quality
    };
  }

  return {
    kind: "outcome",
    angle: decision.angle,
    target: null,
    question: null,
    statement: decision.statement,
    outcomeKind: decision.completionKind,
    surfaceLevel: null,
    nextOpportunityCount: input.questionOpportunityCount,
    lowPressureAnchorUsed: input.lowPressureAnchorUsed,
    reason: decision.reason,
    quality: null
  };
}

export function isFeelingThoughtTargetForAngle(
  target: FeelingThoughtQuestionTarget,
  angle: FeelingThoughtAngle
) {
  return TARGET_DEFINITION_BY_NAME.get(target)?.angle === angle;
}
