export const THOUGHT_DIRECTIONS = [
  "current_judgment",
  "judgment_basis",
  "judgment_criterion",
  "default_assumption",
  "evidence_tension",
  "tradeoff_condition",
  "judgment_calibration"
] as const;

export type ThoughtDirection = (typeof THOUGHT_DIRECTIONS)[number];

export const THOUGHT_TARGET_STATUSES = [
  "untouched",
  "partial",
  "answered",
  "denied",
  "unclear",
  "closed",
  "invalidated"
] as const;

export type ThoughtTargetStatus = (typeof THOUGHT_TARGET_STATUSES)[number];

export const THOUGHT_PROBE_OPERATIONS = [
  "specific_instance",
  "clarify_term",
  "single_variable_contrast",
  "explain_reason",
  "open_exploration"
] as const;

export type ThoughtProbeOperation = (typeof THOUGHT_PROBE_OPERATIONS)[number];

export type ThoughtQuestionSignature = {
  direction: ThoughtDirection;
  operation: ThoughtProbeOperation;
  coreConditionKey: string;
  expectedRelation: string;
};

export const THOUGHT_ANSWER_STATUSES = [
  "complete",
  "partial",
  "denied",
  "unclear",
  "correction",
  "unrelated"
] as const;

export type ThoughtAnswerStatus = (typeof THOUGHT_ANSWER_STATUSES)[number];

export const THOUGHT_CORRECTION_KINDS = [
  "fact_or_judgment",
  "answer_coverage",
  "question_premise",
  "supplement"
] as const;

export type ThoughtCorrectionKind = (typeof THOUGHT_CORRECTION_KINDS)[number];

export type ThoughtDemandResolution = {
  demandKey: string;
  direction: ThoughtDirection;
  status: "answered" | "denied" | "premise_rejected";
  sourceRefs: string[];
  resolvedAtTurnId: string;
};

export type ThoughtTargetState = {
  status: ThoughtTargetStatus;
  sourceRefs: string[];
  relationKey: string | null;
  updatedAtTurnId: string | null;
};

export type ThoughtRouteSignals = {
  dualEvidence: boolean;
  competingGoals: boolean;
  explicitRuleOrAssumption: boolean;
  newEvidenceOrUncertainty: boolean;
  sourceRefs: string[];
  conditionKeys: string[];
};

export type ThoughtInsightIncrement = {
  kind: "user_new_relation" | "ai_safe_relation" | "correction_update";
  direction: ThoughtDirection;
  sourceRefs: string[];
  relationKey: string;
  outcomeId: string | null;
};

export type ThoughtQuestionPlan = {
  action: "ask" | "transition" | "stop" | "fail";
  direction: ThoughtDirection | null;
  operation: ThoughtProbeOperation | null;
  signature: ThoughtQuestionSignature | null;
  sourceRefs: string[];
  knownAnswerRefs: string[];
  expectedDelta: string | null;
  summaryJob: string | null;
  questionJob: string | null;
  routeReason: string;
  planHash: string;
};

export type ThoughtProtocolState = {
  version: 2;
  targets: Record<ThoughtDirection, ThoughtTargetState>;
  currentDirection: ThoughtDirection | null;
  directionBaselineRefs: string[];
  directionQuestionCount: number;
  currentPlan: ThoughtQuestionPlan | null;
  validQuestionSignatures: ThoughtQuestionSignature[];
  resolvedDemands: ThoughtDemandResolution[];
  explainReasonUsedDirections: ThoughtDirection[];
  lowPressureRetryUsedDirections: ThoughtDirection[];
  insightIncrements: ThoughtInsightIncrement[];
  openExplorationCount: number;
  invalidatedSourceRefs: string[];
  invalidatedRelationKeys: string[];
  invalidatedOutcomeIds: string[];
  routeSignals: ThoughtRouteSignals;
};

export type ThoughtMapModelUpdate = {
  answerStatus: ThoughtAnswerStatus;
  targetUpdates: Array<{
    direction: ThoughtDirection;
    status: Extract<ThoughtTargetStatus, "partial" | "answered" | "denied" | "unclear">;
    sourceRefs: string[];
    relationKey: string | null;
  }>;
  routeSignals: ThoughtRouteSignals;
  relationCandidate: {
    origin: "user_articulated" | "ai_synthesized";
    direction: ThoughtDirection;
    relationKey: string;
    sourceRefs: string[];
  } | null;
  correction: {
    kind: ThoughtCorrectionKind;
    invalidatedSourceRefs: string[];
    invalidatedRelationKeys: string[];
    invalidatedOutcomeIds: string[];
    affectedDirections: ThoughtDirection[];
  } | null;
};

function emptyTarget(): ThoughtTargetState {
  return {
    status: "untouched",
    sourceRefs: [],
    relationKey: null,
    updatedAtTurnId: null
  };
}

export function createInitialThoughtProtocol(): ThoughtProtocolState {
  return {
    version: 2,
    targets: Object.fromEntries(
      THOUGHT_DIRECTIONS.map((direction) => [direction, emptyTarget()])
    ) as Record<ThoughtDirection, ThoughtTargetState>,
    currentDirection: null,
    directionBaselineRefs: [],
    directionQuestionCount: 0,
    currentPlan: null,
    validQuestionSignatures: [],
    resolvedDemands: [],
    explainReasonUsedDirections: [],
    lowPressureRetryUsedDirections: [],
    insightIncrements: [],
    openExplorationCount: 0,
    invalidatedSourceRefs: [],
    invalidatedRelationKeys: [],
    invalidatedOutcomeIds: [],
    routeSignals: {
      dualEvidence: false,
      competingGoals: false,
      explicitRuleOrAssumption: false,
      newEvidenceOrUncertainty: false,
      sourceRefs: [],
      conditionKeys: []
    }
  };
}

function unique(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function canonicalThoughtQuestionSignature(signature: ThoughtQuestionSignature) {
  return [
    signature.direction,
    signature.operation,
    signature.coreConditionKey.trim().toLowerCase(),
    signature.expectedRelation.trim().toLowerCase()
  ].join("|");
}

/**
 * 同一认识需求允许出现更具体的表达，但一旦被完整回答或前提被否定，
 * 后续表达变化不能重新打开同一需求。
 */
export function thoughtDemandKey(signature: ThoughtQuestionSignature) {
  return [
    signature.direction,
    signature.expectedRelation.trim().toLowerCase()
  ].join("|");
}

function resolveActiveDemand(input: {
  protocol: ThoughtProtocolState;
  status: ThoughtDemandResolution["status"];
  sourceRefs: string[];
  turnId: string;
}) {
  const signature = input.protocol.currentPlan?.action === "ask"
    ? input.protocol.currentPlan.signature
    : null;
  if (!signature) return;
  const resolution: ThoughtDemandResolution = {
    demandKey: thoughtDemandKey(signature),
    direction: signature.direction,
    status: input.status,
    sourceRefs: unique(input.sourceRefs),
    resolvedAtTurnId: input.turnId
  };
  input.protocol.resolvedDemands = [
    ...input.protocol.resolvedDemands.filter((item) => item.demandKey !== resolution.demandKey),
    resolution
  ].slice(-80);
  input.protocol.targets[signature.direction] = {
    ...input.protocol.targets[signature.direction],
    status: input.status === "answered" ? "answered" : "denied",
    sourceRefs: unique([
      ...input.protocol.targets[signature.direction].sourceRefs,
      ...input.sourceRefs
    ]),
    updatedAtTurnId: input.turnId
  };
  input.protocol.currentDirection = null;
  input.protocol.directionQuestionCount = 0;
}

export function hashThoughtQuestionPlan(
  plan: Omit<ThoughtQuestionPlan, "planHash">
) {
  const serialized = JSON.stringify({
    ...plan,
    sourceRefs: [...plan.sourceRefs].sort(),
    knownAnswerRefs: [...plan.knownAnswerRefs].sort()
  });
  let hash = 2166136261;
  for (const character of serialized) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `gi066-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function applyThoughtMapUpdate(input: {
  protocol: ThoughtProtocolState;
  update: ThoughtMapModelUpdate;
  turnId: string;
  outcomeId?: string | null;
}) {
  const next = structuredClone(input.protocol);
  const correction = input.update.correction;
  const invalidatesPriorUnderstanding = correction?.kind === "fact_or_judgment";
  if (correction && invalidatesPriorUnderstanding) {
    next.invalidatedSourceRefs = unique([
      ...next.invalidatedSourceRefs,
      ...correction.invalidatedSourceRefs
    ]);
    next.invalidatedRelationKeys = unique([
      ...next.invalidatedRelationKeys,
      ...correction.invalidatedRelationKeys
    ]);
    next.invalidatedOutcomeIds = unique([
      ...next.invalidatedOutcomeIds,
      ...correction.invalidatedOutcomeIds
    ]);
    for (const direction of correction.affectedDirections) {
      next.targets[direction] = {
        ...next.targets[direction],
        status: "invalidated",
        relationKey: null,
        updatedAtTurnId: input.turnId
      };
    }
    next.resolvedDemands = next.resolvedDemands.filter(
      (item) => !correction.affectedDirections.includes(item.direction)
    );
    next.insightIncrements.push({
      kind: "correction_update",
      direction: correction.affectedDirections[0] ?? "judgment_calibration",
      sourceRefs: unique(input.update.routeSignals.sourceRefs),
      relationKey: `correction:${input.turnId}`,
      outcomeId: input.outcomeId ?? null
    });
  }

  for (const update of input.update.targetUpdates) {
    const previous = next.targets[update.direction];
    const preservesAnsweredTarget = !invalidatesPriorUnderstanding &&
      previous.status === "answered" &&
      (update.status === "partial" || update.status === "unclear");
    next.targets[update.direction] = {
      status: preservesAnsweredTarget ? "answered" : update.status,
      sourceRefs: unique([
        ...(preservesAnsweredTarget ? previous.sourceRefs : []),
        ...update.sourceRefs
      ]).filter(
        (ref) => !next.invalidatedSourceRefs.includes(ref)
      ),
      relationKey: update.relationKey ?? (preservesAnsweredTarget ? previous.relationKey : null),
      updatedAtTurnId: input.turnId
    };
  }

  next.routeSignals = {
    dualEvidence: input.update.routeSignals.dualEvidence,
    competingGoals: input.update.routeSignals.competingGoals,
    explicitRuleOrAssumption: input.update.routeSignals.explicitRuleOrAssumption,
    newEvidenceOrUncertainty: input.update.routeSignals.newEvidenceOrUncertainty,
    sourceRefs: unique(input.update.routeSignals.sourceRefs).filter(
      (ref) => !next.invalidatedSourceRefs.includes(ref)
    ),
    conditionKeys: unique(input.update.routeSignals.conditionKeys)
  };

  const relation = input.update.relationCandidate;
  if (
    relation &&
    relation.sourceRefs.length >= 2 &&
    !next.invalidatedRelationKeys.includes(relation.relationKey) &&
    relation.sourceRefs.every((ref) => !next.invalidatedSourceRefs.includes(ref))
  ) {
    next.targets[relation.direction] = {
      status: "answered",
      sourceRefs: unique(relation.sourceRefs),
      relationKey: relation.relationKey,
      updatedAtTurnId: input.turnId
    };
    next.insightIncrements.push({
      kind: relation.origin === "user_articulated"
        ? "user_new_relation"
        : "ai_safe_relation",
      direction: relation.direction,
      sourceRefs: unique(relation.sourceRefs),
      relationKey: relation.relationKey,
      outcomeId: input.outcomeId ?? null
    });
  }

  const activeDirection = next.currentPlan?.action === "ask"
    ? next.currentPlan.signature?.direction ?? null
    : null;
  const activeSourceRefs = unique([
    ...input.update.routeSignals.sourceRefs,
    ...input.update.targetUpdates
      .filter((item) => item.direction === activeDirection)
      .flatMap((item) => item.sourceRefs)
  ]).filter((ref) => !next.invalidatedSourceRefs.includes(ref));
  if (correction?.kind === "answer_coverage") {
    resolveActiveDemand({
      protocol: next,
      status: "answered",
      sourceRefs: activeSourceRefs,
      turnId: input.turnId
    });
  } else if (correction?.kind === "question_premise") {
    resolveActiveDemand({
      protocol: next,
      status: "premise_rejected",
      sourceRefs: activeSourceRefs,
      turnId: input.turnId
    });
  } else if (!invalidatesPriorUnderstanding && input.update.answerStatus === "complete") {
    resolveActiveDemand({
      protocol: next,
      status: "answered",
      sourceRefs: activeSourceRefs,
      turnId: input.turnId
    });
  } else if (!invalidatesPriorUnderstanding && input.update.answerStatus === "denied") {
    resolveActiveDemand({
      protocol: next,
      status: "denied",
      sourceRefs: activeSourceRefs,
      turnId: input.turnId
    });
  } else if (activeDirection && input.update.answerStatus === "partial") {
    if (next.targets[activeDirection].status !== "answered") {
      next.targets[activeDirection].status = "partial";
      next.targets[activeDirection].updatedAtTurnId = input.turnId;
    }
  } else if (activeDirection && input.update.answerStatus === "unclear") {
    next.targets[activeDirection].status = "unclear";
    next.targets[activeDirection].updatedAtTurnId = input.turnId;
  }

  return next;
}

/** 纠正入口同时承载事实纠正、重复问题反馈、错误前提和补充说明。 */
export function classifyThoughtCorrectionKind(rawText: string): ThoughtCorrectionKind {
  const text = rawText.replace(/\s+/gu, "").trim();
  if (/(?:已经回答|回答过|刚才说过|前面说过|问过了|重复(?:问|提问)|同一个问题|前面回答)/u.test(text)) {
    return "answer_coverage";
  }
  if (/(?:没有|没|并未|从未).{0,10}(?:改变|变化|转变|动摇)|(?:前提|这个问题).{0,8}(?:不对|错了|不成立)/u.test(text)) {
    return "question_premise";
  }
  if (/(?:补充|再加一点|还有一点|另外)/u.test(text)) return "supplement";
  return "fact_or_judgment";
}

export function hasThoughtInsightIncrement(protocol: ThoughtProtocolState) {
  return protocol.insightIncrements.length > 0;
}

/** 用户原话中的高置信路线和边界信号由系统补强，避免模型漏标改变选题。 */
export function applyThoughtDeterministicUserSignals(input: {
  protocol: ThoughtProtocolState;
  rawText: string;
  sourceRef?: string;
}) {
  const next = structuredClone(input.protocol);
  const text = input.rawText.replace(/\s+/gu, "").trim();
  const unableAnswer = /(?:说不清|讲不清|分不清|想不出来)/u.test(text);
  if (unableAnswer && next.currentDirection) {
    next.targets[next.currentDirection].status = "unclear";
  }
  const explicitDualEvidence = /(?:一方面.+(?:另一方面|但|同时)|(?:支持|说明).+(?:但|同时|又).+(?:支持|说明)|两(?:条|边|方面).+(?:证据|理由))/u.test(text);
  const explicitCompetingGoals = /(?:既.+也|一边.+一边|同时想|互相挤压|两项?都重要)/u.test(text);
  if (explicitDualEvidence) next.routeSignals.dualEvidence = true;
  if (explicitCompetingGoals) {
    next.routeSignals.competingGoals = true;
    if (!explicitDualEvidence) next.routeSignals.dualEvidence = false;
  }
  if (/(?:只要|一定|必须|默认|绝对|前提)/u.test(text)) {
    next.routeSignals.explicitRuleOrAssumption = true;
  }
  const explicitNewEvidence = /(?:新证据|后来|看到.+后|重新(?:考虑|评估)|开始动摇|发现自己(?:低估|高估|忽略|漏掉)|(?:低估|高估)了|此前没考虑|之前没考虑)/u.test(text);
  if (explicitNewEvidence) {
    next.routeSignals.newEvidenceOrUncertainty = true;
    if (input.sourceRef && !next.routeSignals.sourceRefs.includes(input.sourceRef)) {
      next.routeSignals.sourceRefs.push(input.sourceRef);
    }
  }
  if (unableAnswer && !explicitNewEvidence) {
    next.routeSignals.newEvidenceOrUncertainty = false;
  }
  if (/(?:我.{0,8}(?:判断|决定|认为|觉得|选择|更倾向)|我的判断是|我会.{0,12}(?:接|做|答应|拒绝|加入|接受)|我(?:还是|现在|暂时)?(?:拿不准|犹豫|纠结)|(?:拿不准|犹豫|纠结).{0,8}(?:要不要|该不该|是否)|(?:要不要|该不该|是否).{0,12}(?:接|做|答应|拒绝|加入)|(?:没有|没)(?:马上|直接|立刻)?(?:答应|拒绝|加入|接受|决定))/u.test(text)) {
    next.targets.current_judgment.status = "answered";
  }
  if (/(?:因为|依据是|理由是|直接依据|会挤掉|会影响|支持.{0,12}(?:加入|接受|等待|拒绝)|导致我.{0,8}(?:判断|决定))/u.test(text)) {
    next.targets.judgment_basis.status = "answered";
  }
  return next;
}
