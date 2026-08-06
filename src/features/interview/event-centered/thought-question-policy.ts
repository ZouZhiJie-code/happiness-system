import {
  THOUGHT_DIRECTIONS,
  canonicalThoughtQuestionSignature,
  hashThoughtQuestionPlan,
  thoughtDemandKey,
  type ThoughtDirection,
  type ThoughtProbeOperation,
  type ThoughtProtocolState,
  type ThoughtQuestionPlan,
  type ThoughtQuestionSignature
} from "@/features/interview/event-centered/thought-judgment-map";

export const GI066_OPEN_TRANSITION =
  "如果这件事里还有哪个判断、矛盾或选择让你拿不准，可以直接告诉我；也可以先生成日志。";

export function isEventCenteredJournalRequestText(value: string) {
  const text = value.replace(/\s+/gu, "").trim();
  return /^(?:请|帮我|可以)?(?:生成|整理(?:成)?|总结|写成|做成)(?:当前|这件事|事件)?(?:的)?日志(?:吧|了|一下)?[。！!]?$|^(?:生成|整理(?:成)?)(?:事件)?日志/u.test(text);
}

type ThoughtControl = "none" | "continue" | "stop" | "exit" | "journal" | "correction";

type RouteInput = {
  protocol: ThoughtProtocolState;
  control: ThoughtControl;
  knownAnswerRefs?: string[];
  latestAnswerKeys?: string[];
};

function eligible(protocol: ThoughtProtocolState, direction: ThoughtDirection) {
  const status = protocol.targets[direction].status;
  return status === "untouched" || status === "partial" || status === "unclear";
}

function signalDirection(protocol: ThoughtProtocolState): ThoughtDirection | null {
  if (protocol.routeSignals.dualEvidence && eligible(protocol, "evidence_tension")) {
    return "evidence_tension";
  }
  if (protocol.routeSignals.competingGoals && eligible(protocol, "tradeoff_condition")) {
    return "tradeoff_condition";
  }
  if (
    protocol.routeSignals.explicitRuleOrAssumption &&
    eligible(protocol, "default_assumption")
  ) {
    return "default_assumption";
  }
  if (
    protocol.routeSignals.newEvidenceOrUncertainty &&
    protocol.routeSignals.sourceRefs.length > 0 &&
    eligible(protocol, "judgment_calibration")
  ) {
    return "judgment_calibration";
  }
  return eligible(protocol, "judgment_criterion") ? "judgment_criterion" : null;
}

function selectDirection(protocol: ThoughtProtocolState) {
  if (eligible(protocol, "current_judgment")) return "current_judgment" as const;
  if (eligible(protocol, "judgment_basis")) return "judgment_basis" as const;
  return signalDirection(protocol);
}

function selectOperation(
  protocol: ThoughtProtocolState,
  direction: ThoughtDirection
): ThoughtProbeOperation {
  if (protocol.targets[direction].status === "unclear") return "specific_instance";
  if (
    direction === "judgment_criterion" ||
    direction === "default_assumption" ||
    direction === "judgment_calibration" ||
    direction === "evidence_tension" ||
    direction === "tradeoff_condition"
  ) {
    return "single_variable_contrast";
  }
  return "specific_instance";
}

function expectedRelation(direction: ThoughtDirection) {
  const map: Record<ThoughtDirection, string> = {
    current_judgment: "current_judgment_identified",
    judgment_basis: "concrete_basis_supports_judgment",
    judgment_criterion: "condition_changes_judgment_criterion",
    default_assumption: "assumption_dependency_checked",
    evidence_tension: "supporting_and_conflicting_evidence_distinguished",
    tradeoff_condition: "priority_condition_distinguished",
    judgment_calibration: "new_evidence_calibrates_judgment"
  };
  return map[direction];
}

function routeReason(direction: ThoughtDirection) {
  const map: Record<ThoughtDirection, string> = {
    current_judgment: "basic_material_missing_current_judgment",
    judgment_basis: "basic_material_missing_concrete_basis",
    judgment_criterion: "no_stronger_route_signal_use_criterion_fallback",
    default_assumption: "explicit_rule_or_assumption_signal",
    evidence_tension: "dual_evidence_signal",
    tradeoff_condition: "competing_goals_signal",
    judgment_calibration: "new_evidence_uncertainty_or_correction_signal"
  };
  return map[direction];
}

function buildAskPlan(input: {
  protocol: ThoughtProtocolState;
  direction: ThoughtDirection;
  operation: ThoughtProbeOperation;
  knownAnswerRefs: string[];
}) {
  const conditionKey = input.protocol.routeSignals.conditionKeys[0] ??
    input.protocol.targets[input.direction].relationKey ??
    input.direction;
  const signature: ThoughtQuestionSignature = {
    direction: input.direction,
    operation: input.operation,
    coreConditionKey: conditionKey,
    expectedRelation: expectedRelation(input.direction)
  };
  const base = {
    action: "ask" as const,
    direction: input.direction,
    operation: input.operation,
    signature,
    sourceRefs: [...new Set([
      ...input.protocol.targets[input.direction].sourceRefs,
      ...input.protocol.routeSignals.sourceRefs
    ])].slice(0, 6),
    knownAnswerRefs: [...new Set(input.knownAnswerRefs)],
    expectedDelta: signature.expectedRelation,
    summaryJob: `解释当前需要确认的${input.direction}关系及其判断价值`,
    questionJob: `围绕${conditionKey}执行${input.operation}，只索取${signature.expectedRelation}`,
    routeReason: routeReason(input.direction)
  };
  return { ...base, planHash: hashThoughtQuestionPlan(base) };
}

function terminalPlan(
  action: "transition" | "stop" | "fail",
  routeReason: string
): ThoughtQuestionPlan {
  const base = {
    action,
    direction: null,
    operation: null,
    signature: null,
    sourceRefs: [],
    knownAnswerRefs: [],
    expectedDelta: null,
    summaryJob: null,
    questionJob: null,
    routeReason
  };
  return { ...base, planHash: hashThoughtQuestionPlan(base) };
}

function questionAlreadyAnswered(input: {
  signature: ThoughtQuestionSignature;
  protocol: ThoughtProtocolState;
  knownAnswerRefs: string[];
  latestAnswerKeys: string[];
}) {
  const canonical = canonicalThoughtQuestionSignature(input.signature);
  const demandKey = thoughtDemandKey(input.signature);
  if (input.protocol.resolvedDemands.some((item) => item.demandKey === demandKey)) {
    return true;
  }
  if (input.protocol.validQuestionSignatures.some(
    (item) => canonicalThoughtQuestionSignature(item) === canonical
  )) return true;
  const expected = input.signature.expectedRelation.toLowerCase();
  return [...input.knownAnswerRefs, ...input.latestAnswerKeys].some((item) =>
    item.trim().toLowerCase() === expected ||
    item.trim().toLowerCase() === input.signature.coreConditionKey.trim().toLowerCase()
  );
}

export function decideThoughtQuestionPlan(input: RouteInput): {
  protocol: ThoughtProtocolState;
  plan: ThoughtQuestionPlan;
} {
  const protocol = structuredClone(input.protocol);
  if (input.control === "stop" || input.control === "exit" || input.control === "journal") {
    const plan = terminalPlan("stop", `user_control_${input.control}`);
    protocol.currentPlan = plan;
    return { protocol, plan };
  }

  if (protocol.currentDirection && protocol.directionQuestionCount >= 3) {
    protocol.targets[protocol.currentDirection].status = "closed";
    protocol.currentDirection = null;
    protocol.directionQuestionCount = 0;
  }

  for (let guard = 0; guard < THOUGHT_DIRECTIONS.length; guard += 1) {
    const direction = selectDirection(protocol);
    if (!direction) break;
    const sameDirection = protocol.currentDirection === direction;
    const questionCount = sameDirection ? protocol.directionQuestionCount : 0;
    if (questionCount >= 3) {
      protocol.targets[direction].status = "closed";
      protocol.currentDirection = null;
      protocol.directionQuestionCount = 0;
      continue;
    }
    if (
      protocol.targets[direction].status === "unclear" &&
      protocol.lowPressureRetryUsedDirections.includes(direction)
    ) {
      protocol.targets[direction].status = "closed";
      protocol.currentDirection = null;
      protocol.directionQuestionCount = 0;
      continue;
    }
    const operation = selectOperation(protocol, direction);
    const plan = buildAskPlan({
      protocol,
      direction,
      operation,
      knownAnswerRefs: input.knownAnswerRefs ?? []
    });
    if (questionAlreadyAnswered({
      signature: plan.signature!,
      protocol,
      knownAnswerRefs: input.knownAnswerRefs ?? [],
      latestAnswerKeys: input.latestAnswerKeys ?? []
    })) {
      protocol.targets[direction].status = "answered";
      protocol.currentDirection = null;
      protocol.directionQuestionCount = 0;
      continue;
    }
    protocol.currentDirection = direction;
    protocol.directionBaselineRefs = [...protocol.routeSignals.sourceRefs];
    protocol.directionQuestionCount = questionCount + 1;
    if (protocol.targets[direction].status === "unclear") {
      protocol.lowPressureRetryUsedDirections = [...new Set([
        ...protocol.lowPressureRetryUsedDirections,
        direction
      ])];
    }
    if (operation === "explain_reason") {
      protocol.explainReasonUsedDirections = [...new Set([
        ...protocol.explainReasonUsedDirections,
        direction
      ])];
    }
    protocol.validQuestionSignatures.push(plan.signature!);
    protocol.currentPlan = plan;
    return { protocol, plan };
  }

  if (input.control === "continue" && protocol.openExplorationCount === 0) {
    protocol.openExplorationCount = 1;
  }
  const plan = terminalPlan("transition", input.control === "continue"
    ? "no_eligible_direction_after_continue"
    : "no_eligible_direction");
  protocol.currentPlan = plan;
  return { protocol, plan };
}
