import {
  decideFeelingOrThoughtStrategy,
  renderFeelingThoughtRepairQuestion,
  type AngleOutcomeCandidate,
  type AngleQuestionCandidateAssessment,
  type FeelingThoughtQuestionTarget
} from "@/features/interview/event-centered/angle-strategies-feeling-thought";
import {
  isIncrementalAngleOutcome,
  scopeAngleOutcomeToCurrentEvent
} from "@/features/interview/event-centered/angle-outcome-quality";
import {
  decideRelationshipOrActionStrategy,
  renderRelationshipOrActionRepairQuestion,
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
import { resolveEventCenteredFocusOptions } from "@/features/interview/event-centered/event-focus-options";
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
  /**
   * 用户第一次明确说不清时，系统用受控低负担问法修复模型过早收束。
   * 该字段只进入内部审计，不向用户暴露流程细节。
   */
  localDeterministicRepairApplied?: boolean;
};

const EXPLICIT_STOP_PATTERN = /(?:不想回答|不想答|不想继续|我(?:想|要)?停下来|不继续聊|先停|别问了|不聊了|不用再追问|收在这里|到这里就好|暂时不想说|暂时不想聊)/u;
const UNABLE_ANSWER_SIGNAL_PATTERN = /(?:说不清(?:楚)?|讲不清(?:楚)?|分不清(?:楚)?|想不到|想不出来)/u;

function isExplicitStopText(value: string) {
  return EXPLICIT_STOP_PATTERN.test(value.replace(/\s+/gu, " ").trim());
}

/**
 * “说不清”属于共用问停边界：它由用户原话决定，不能依赖本轮模型是否成功
 * 提炼成 unknown。明确停止会走停止分支，不再进入一次具体追问。
 */
export function hasEventCenteredUnableAnswerSignal(rawText: string) {
  const normalized = rawText.trim().replace(/\s+/gu, "");
  return Boolean(normalized) &&
    UNABLE_ANSWER_SIGNAL_PATTERN.test(normalized) &&
    !isExplicitStopText(normalized);
}

type PolicyFact = {
  key: string;
  statement: string;
  sourceTexts: string[];
  recurrenceSourceTexts: string[];
  createdThisTurn: boolean;
  stance: "affirmed" | "denied" | "unknown";
  kind: JournalEventFactRecord["kind"];
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
  /** 本轮向前操作确认的上一轮推测已落成事实，应立刻具备本轮收束资格。 */
  confirmedThisTurnFactId?: string | null;
  understanding: EventCenteredUnderstandingDecision;
  bareAngleChange: boolean;
};

function cloneState(state: EventCenteredDialogueState): EventCenteredDialogueState {
  return JSON.parse(JSON.stringify(state)) as EventCenteredDialogueState;
}

function clearCurrentQuestion(state: EventCenteredDialogueState) {
  state.currentQuestion = null;
  state.currentQuestionIntent = null;
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
  outcome: string | null,
  options: { reflectionReady?: boolean } = {}
): EventCenteredTurnPolicyResult {
  state.phase = kind === "first" ? "checkpoint_one" : "checkpoint_two";
  if (kind === "first") {
    state.reflectionReady = options.reflectionReady ?? state.reflectionReady;
  }
  state.activeAngle = null;
  clearCurrentQuestion(state);
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
  const pairs = resolveEventCenteredFocusOptions({
    rawText: input.rawText,
    suggestedOptions: input.understanding.eventOptions
  });
  return (pairs ?? []).map((option, index) => ({
    id: `focus-${index + 1}`,
    label: option.label,
    sourceText: option.sourceText
  }));
}

function collectPolicyFacts(input: DecideEventCenteredTurnPolicyInput): PolicyFact[] {
  return [
    ...input.facts.map((fact) => {
      const evidenceTexts = fact.evidence
        .map((evidence) => evidence.quote?.trim() ?? "")
        .filter(Boolean);
      return {
        key: fact.id,
        statement: fact.statement,
        sourceTexts: evidenceTexts.length > 0 || fact.origin !== "implicit_confirmation"
          ? evidenceTexts
          : [fact.statement],
        recurrenceSourceTexts: evidenceTexts,
        createdThisTurn: fact.id === input.confirmedThisTurnFactId,
        stance: fact.stance,
        kind: fact.kind
      };
    }),
    ...input.understanding.facts.map((fact, index) => ({
      key: `new:${index}`,
      statement: fact.statement,
      sourceTexts: [fact.quote.trim()].filter(Boolean),
      recurrenceSourceTexts: [fact.quote.trim()].filter(Boolean),
      createdThisTurn: true,
      stance: fact.stance,
      kind: fact.kind
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
  const supportFacts = supportFactIds
    .map((key) => facts.find((fact) => fact.key === key))
    .filter((fact): fact is PolicyFact => Boolean(fact));
  const supportFactTexts = supportFacts.flatMap((fact) => fact.recurrenceSourceTexts);
  const statement = scopeAngleOutcomeToCurrentEvent({
    statement: candidate.statement,
    supportFactTexts
  });
  if (!isIncrementalAngleOutcome({
    statement,
    supportFactIds,
    facts: facts.map((fact) => ({
      id: fact.key,
      text: fact.statement,
      sourceTexts: fact.sourceTexts,
      recurrenceSourceTexts: fact.recurrenceSourceTexts
    }))
  })) return null;
  return {
    statement,
    supportFactIds,
    supportFactTexts,
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
  const supportFacts = supportFactIds
    .map((key) => facts.find((fact) => fact.key === key))
    .filter((fact): fact is PolicyFact => Boolean(fact));
  const supportFactTexts = supportFacts.flatMap((fact) => fact.recurrenceSourceTexts);
  const statement = scopeAngleOutcomeToCurrentEvent({
    statement: candidate.statement,
    supportFactTexts
  });
  if (!isIncrementalAngleOutcome({
    statement,
    supportFactIds,
    facts: facts.map((fact) => ({
      id: fact.key,
      text: fact.statement,
      sourceTexts: fact.sourceTexts,
      recurrenceSourceTexts: fact.recurrenceSourceTexts
    }))
  })) return null;
  return {
    statement,
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

const FEELING_EXPERIENCE_PATTERN = /(?:开心|高兴|难受|生气|委屈|失望|紧张|害怕|焦虑|放松|轻松|疲惫|累|烦躁|烦|堵|松了一口气|松口气|不安|尴尬|惊讶|失落|平静|安心|内疚|愧疚|成就感|自豪|满足|踏实|(?:心里|心情|脑子|思绪).{0,4}乱)/u;
const FEELING_TRIGGER_PATTERN = /(?:因为|由于|最先被|一(?:听到|看到|发现)|(?:说完|回答完?|看到|听到)(?:时|后)|被.{1,16}(?:时|后)|在.{1,18}(?:发生|出现|打断|改变|取消)(?:时|后))/u;
const FEELING_CHANGE_PATTERN = /(?:从.{1,18}到|后来|之后|慢慢|逐渐|越来越|一下子|开始.{1,18}后来).{0,20}(?:平静|放松|难受|生气|委屈|紧张|害怕|焦虑|失落|安心|变化|变得)/u;
const FEELING_MIXED_PATTERN = /(?:既.{1,16}又|又.{1,16}又|一边.{1,16}一边|不只是.{1,16}(?:也|还)|同时.{0,12}(?:开心|难受|生气|委屈|紧张|害怕|失落))/u;
const FEELING_BODY_PATTERN = /(?:心跳.{0,8}(?:快|加速)|胸口.{0,8}(?:紧|闷|堵)|呼吸.{0,8}(?:急|快|困难)|手心.{0,8}(?:出汗|冒汗)|肩膀.{0,8}(?:紧|僵)|胃.{0,8}(?:疼|紧|不舒服)|发抖|出汗|身体.{0,8}(?:发紧|僵住|发沉|发热|发冷))/u;
const CARE_NEED_BOUNDARY_PATTERN = /(?:在意|看重|希望|想要|需要|边界|底线|不愿|不能接受|受不了|尊重|被听见|被理解)/u;
const CONCRETE_EVENT_ANCHOR_PATTERN = /(?:被[^，,。！？!?；;]{1,24}(?:了|过|到|得)|(?:跟|和|与)[^，,。！？!?；;]{1,16}(?:玩|说|聊|开会|见|吃|走|相处)|(?:开会|会议|汇报|发言|说明|提交|处理|完成|开始|取消|打断|咬|联系|回复|回应|帮助|拒绝|答应|加入|接下|接|上线|调岗|提前|推迟|邀请|整理|准备|安排|发生|遇到|看到|听到|收到|做了)[^，,。！？!?；;]{0,32}|(?:对方|同事|朋友|伴侣|家人|负责人|客户|他|她).{0,24}(?:说|问|要求|邀请|回复|回应|打断|联系|帮助|拒绝|答应|提前|推迟|笑)[^，,。！？!?；;]{0,24})/u;
const UNCERTAIN_OPTIONAL_PATTERN = /(?:好像|似乎|可能|也许|有点说不上|不太确定|说不上来)/u;
const UNRESOLVED_TARGET_PATTERN = /(?:还没(?:说清|分清|想清)|没(?:有)?说清|暂时说不清)/u;

/**
 * GI-055 的唯一入口判断：事件中心先确认“发生了什么”，再确认用户
 * 对这件事至少有一项个人反应。只有这两类可追溯事实同时存在，才开放
 * 四个平等的复盘角度。
 */
export function getEventCenteredReflectionMaterialStatus(input: {
  facts: Array<{
    statement: string;
    stance: "affirmed" | "denied" | "unknown";
    kind: JournalEventFactRecord["kind"];
    sourceTexts?: string[];
  }>;
  rawText: string;
}) {
  return reflectionMaterialStatus(
    input.facts.map((fact, index) => ({
      key: `material:${index}`,
      statement: fact.statement,
      sourceTexts: fact.sourceTexts ?? [fact.statement],
      recurrenceSourceTexts: fact.sourceTexts ?? [fact.statement],
      createdThisTurn: false,
      stance: fact.stance,
      kind: fact.kind
    })),
    input.rawText
  );
}

function reflectionMaterialStatus(facts: PolicyFact[], rawText: string) {
  const affirmed = facts.filter((fact) => fact.stance === "affirmed");
  // 模型有时会把一段同时包含事件和感受的原话合并为一条
  // `inner_experience`。这里保留事件事实类型作为首选，同时用原话中
  // 可观察的动作或互动做兜底，避免把已经说清事件的用户再次推回事件追问。
  const hasEvent = affirmed.some((fact) =>
    fact.kind === "event_detail" ||
    CONCRETE_EVENT_ANCHOR_PATTERN.test(fact.statement) ||
    fact.sourceTexts.some((text) => CONCRETE_EVENT_ANCHOR_PATTERN.test(text))
  ) || CONCRETE_EVENT_ANCHOR_PATTERN.test(rawText);
  const hasPersonalReaction = affirmed.some((fact) =>
    fact.kind === "inner_experience" ||
    fact.kind === "stated_interpretation" ||
    fact.kind === "stated_preference" ||
    FEELING_EXPERIENCE_PATTERN.test(fact.statement) ||
    CARE_NEED_BOUNDARY_PATTERN.test(fact.statement) ||
    /(?:我(?:也|还|现在|当时|一度)?(?:想到|担心|觉得|认为|判断|决定|选择|打算|拿不准|犹豫|纠结|顾虑)|我(?:也|还|现在|当时|一度)?(?:想|希望|期待|需要|在意)|(?:拿不准|犹豫|纠结|顾虑)(?:要不要|该不该|是否)?).{0,30}/u.test(fact.statement)
  ) ||
    FEELING_EXPERIENCE_PATTERN.test(rawText) ||
    CARE_NEED_BOUNDARY_PATTERN.test(rawText) ||
    /(?:我(?:也|还|现在|当时|一度)?(?:想到|担心|觉得|认为|判断|决定|选择|打算|拿不准|犹豫|纠结|顾虑)|我(?:也|还|现在|当时|一度)?(?:想|希望|期待|需要|在意)|(?:拿不准|犹豫|纠结|顾虑)(?:要不要|该不该|是否)?).{0,30}/u.test(rawText);
  return {
    hasEvent,
    hasPersonalReaction,
    ready: hasEvent && hasPersonalReaction
  };
}

export function isEventCenteredReflectionMaterialReady(input: {
  facts: Array<{
    statement: string;
    stance: "affirmed" | "denied" | "unknown";
    kind: JournalEventFactRecord["kind"];
    sourceTexts?: string[];
  }>;
  rawText: string;
}) {
  return getEventCenteredReflectionMaterialStatus(input).ready;
}

function askForReflectionMaterial(
  input: DecideEventCenteredTurnPolicyInput,
  state: EventCenteredDialogueState
): EventCenteredTurnPolicyResult {
  // 换问法属于对既有问题的控制动作，不携带新的用户表达；材料门槛只看
  // 已保存事实，避免复用上一轮文本把事件记录阶段误推进。
  const material = reflectionMaterialStatus(
    collectPolicyFacts(input),
    input.action === "regenerate_response" ? "" : input.rawText
  );
  state.phase = "event_recording";
  state.activeAngle = null;
  state.reflectionReady = false;
  state.focusOptions = [];
  state.currentQuestionIntent = null;

  if (material.ready) {
    return asCheckpoint(state, "first", null, { reflectionReady: true });
  }

  const needsEvent = !material.hasEvent;
  state.lightAnchorOpportunityCount = 1;
  state.currentQuestion = {
    opportunityNumber: 1,
    angle: null,
    target: needsEvent ? "light_event_anchor" : "light_personal_reaction",
    surfaceLevel: needsEvent ? "concrete_anchor" : "open_anchor",
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
        target: state.currentQuestion.target,
        opportunityNumber: null,
        surfaceLevel: state.currentQuestion.surfaceLevel
      }),
      checkpoint: null,
      angleOutcome: null,
      exactResponse: needsEvent
        ? "这份感受最早是在哪件具体事情里出现的？"
        : "这件事发生时，你心里最先冒出的感受是什么？"
    },
    angleOutcome: null,
    preserveCurrentQuestion: false
  };
}

function keepEventAtBoundary(state: EventCenteredDialogueState): EventCenteredTurnPolicyResult {
  state.phase = "event_recording";
  state.activeAngle = null;
  state.reflectionReady = false;
  clearCurrentQuestion(state);
  state.focusOptions = [];
  return {
    nextState: state,
    directive: {
      responseKind: "acknowledgement",
      questionSpec: null,
      checkpoint: null,
      angleOutcome: null,
      exactResponse: "好，这件事先留在这里。"
    },
    angleOutcome: null,
    preserveCurrentQuestion: false
  };
}

function explicitTargetsForAngle(
  angle: JournalEventAngle,
  facts: PolicyFact[]
): string[] {
  const affirmed = facts.filter((fact) => fact.stance === "affirmed");
  const targets = new Set<string>();
  for (const fact of affirmed) {
    const text = fact.statement;
    const uncertain = UNCERTAIN_OPTIONAL_PATTERN.test(text) || UNRESOLVED_TARGET_PATTERN.test(text);
    if (angle === "feeling") {
      if (fact.kind === "inner_experience" || FEELING_EXPERIENCE_PATTERN.test(text)) {
        targets.add("direct_experience");
      }
      if (FEELING_TRIGGER_PATTERN.test(text)) targets.add("specific_trigger");
      if (!uncertain && FEELING_CHANGE_PATTERN.test(text)) targets.add("experience_change");
      if (!uncertain && FEELING_MIXED_PATTERN.test(text)) targets.add("mixed_feeling");
      if (!uncertain && FEELING_BODY_PATTERN.test(text)) targets.add("body_state");
      if (!uncertain && CARE_NEED_BOUNDARY_PATTERN.test(text)) targets.add("care_need_boundary");
      continue;
    }
    if (angle === "thought") {
      if (fact.kind === "stated_interpretation" || /(?:第一反应|脑子里|我当时想|我想到)/u.test(text)) {
        targets.add("immediate_thought");
      }
      if (/(?:因为|依据|主要根据|主要是由于)/u.test(text)) {
        targets.add("judgment_basis");
      }
      if (!uncertain && /(?:我原(?:先|本)(?:默认|以为|期待)|本来应该)/u.test(text)) {
        targets.add("default_expectation");
      }
      if (!uncertain && /(?:我的标准|我用.{1,16}衡量|才算做好)/u.test(text)) {
        targets.add("evaluation_standard");
      }
      if (!uncertain && /(?:在.{1,16}和.{1,16}之间|先保住.{1,16}接受|宁愿.{1,16}也)/u.test(text)) {
        targets.add("tradeoff_condition");
      }
      continue;
    }
    if (angle === "relationship") {
      if (
        fact.kind === "event_detail" &&
        /(?:对方|同事|朋友|伴侣|家人|他|她).{0,20}(?:说|问|回复|回应|打断|联系|帮助|拒绝|答应|离开)/u.test(text)
      ) {
        targets.add("relationship_interaction");
      }
      if (/(?:希望|期待|想让|想要).{0,18}(?:对方|他|她|回应|回复|理解|听)/u.test(text)) {
        targets.add("relationship_expectation");
      }
      if (
        !uncertain &&
        /(?:位置|信任|互惠|边界|底线|尊重|不能接受|关系里.{0,10}在意)/u.test(text)
      ) {
        targets.add("relationship_position_or_boundary");
      }
      continue;
    }
    if (/(?:目标|为了|打算|想要|希望).{0,20}(?:完成|推进|解决|做到|达成)/u.test(text)) {
      targets.add("action_goal");
    }
    if (/(?:决定|选择|我先|最后我|于是我|我做了|采取)/u.test(text)) targets.add("action_choice");
    if (
      !uncertain &&
      /(?:条件|阻力|困难|卡住|来不及|缺少|不够|只要|如果|影响.{0,12}(?:推进|完成|选择))/u.test(text)
    ) {
      targets.add("action_condition_or_friction");
    }
  }
  return [...targets];
}

function feelingWeakSalientTargets(facts: PolicyFact[]): FeelingThoughtQuestionTarget[] {
  const source = facts
    .filter((fact) => fact.stance === "affirmed")
    .map((fact) => fact.statement)
    .join("\n");
  const targets: FeelingThoughtQuestionTarget[] = [];
  if (/(?:好像|似乎|可能|说不上来).{0,12}(?:后来|之后|变化|变了)|(?:情绪|感受).{0,10}(?:有变化|不太一样)/u.test(source)) {
    targets.push("experience_change");
  }
  if (/(?:不止一种|好像还有|似乎还有|夹着|感受很复杂|说不上来是不是还有)/u.test(source)) {
    targets.push("mixed_feeling");
  }
  if (/(?:身体|生理).{0,10}(?:有点|好像|似乎|反应|感觉)|(?:心跳|胸口|呼吸|手心|肩膀|胃).{0,10}(?:有点|好像|似乎|不太确定)/u.test(source)) {
    targets.push("body_state");
  }
  if (CARE_NEED_BOUNDARY_PATTERN.test(source)) targets.push("care_need_boundary");
  return [...new Set(targets)];
}

function feelingThoughtSalientTargets(input: {
  angle: "feeling" | "thought";
  rawText: string;
  facts: PolicyFact[];
}): FeelingThoughtQuestionTarget[] {
  if (input.angle === "feeling") {
    return feelingWeakSalientTargets(input.facts);
  }
  const source = [input.rawText, ...input.facts.map((fact) => fact.statement)].join("\n");
  const targets: FeelingThoughtQuestionTarget[] = [];
  if (/(?:似乎|好像|像是|还没说清).{0,20}(?:原本|预想|默认|期待)|(?:原本|预想).{0,20}(?:还没说清|说不清)/u.test(source)) {
    targets.push("default_expectation");
  }
  if (/(?:似乎|好像|像是|还没说清).{0,20}(?:标准|衡量)|(?:标准|衡量).{0,20}(?:还没说清|说不清)/u.test(source)) {
    targets.push("evaluation_standard");
  }
  if (/(?:似乎|好像|像是|还没说清).{0,20}(?:取舍|两边|方向)|(?:取舍|两边).{0,20}(?:还没说清|说不清)/u.test(source)) {
    targets.push("tradeoff_condition");
  }
  return targets;
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
  surfaceLevel?: EventCenteredQuestionSpec["surfaceLevel"];
  preserveQuestionIntent?: boolean;
}): EventCenteredTurnPolicyResult {
  const run = ensureAngleRun(input.state, input.angle);
  run.status = "active";
  run.questionOpportunityCount = input.opportunityNumber;
  // `lowPressureAnchorUsed` 只为历史快照保留。文本边界直接收束，
  // 新对话不会再写入这项旧计数。
  if (!run.askedTargets.includes(input.target)) run.askedTargets.push(input.target);
  input.state.activeAngle = input.angle;
  input.state.phase = input.state.phase === "deep_companionship"
    ? "deep_companionship"
    : "guided_reflection";
  const surfaceLevel = input.surfaceLevel ??
    (input.lowPressure ? "low_pressure_choice" : "open_anchor");
  input.state.currentQuestion = {
    opportunityNumber: input.opportunityNumber,
    angle: input.angle,
    target: input.target,
    surfaceLevel,
    repairCount: input.repairCount ?? 0,
    assistantMessageId: null
  };
  if (
    !input.preserveQuestionIntent ||
    input.state.currentQuestionIntent?.targetId !== input.target
  ) {
    input.state.currentQuestionIntent = null;
  }
  const spec = questionSpec({
    state: input.state,
    angle: input.angle,
    target: input.target,
    opportunityNumber: input.opportunityNumber,
    surfaceLevel,
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
  honestLimitResponse?: string | null;
}): EventCenteredTurnPolicyResult {
  const run = ensureAngleRun(input.state, input.angle);
  run.status = "completed";
  input.state.lastCompletedAngle = input.angle;
  input.state.activeAngle = null;
  clearCurrentQuestion(input.state);
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
        ? input.honestLimitResponse || EVENT_CENTERED_HONEST_LIMIT_RESPONSE
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

function buildHonestLimitAcknowledgement(
  angle: JournalEventAngle,
  input: DecideEventCenteredTurnPolicyInput,
  facts: PolicyFact[]
) {
  const supportsAngle = (
    fact: Pick<PolicyFact, "kind" | "statement" | "stance" | "createdThisTurn">
  ) => {
    if (fact.stance !== "affirmed") return false;
    if (angle === "feeling") return fact.kind === "inner_experience";
    if (angle === "thought") return fact.kind === "stated_interpretation";
    if (angle === "relationship") {
      if (fact.createdThisTurn) {
        return fact.kind === "event_detail" || fact.kind === "stated_preference";
      }
      return fact.kind === "stated_preference" ||
        /(?:对方|同事|朋友|伴侣|家人|他|她|我们).{0,24}(?:说|问|回复|回应|打断|联系|帮助|拒绝|答应|离开|沉默|点头|听|停顿)/u.test(fact.statement);
    }
    if (fact.createdThisTurn) {
      return fact.kind === "event_detail" || fact.kind === "stated_preference";
    }
    return /(?:我|自己).{0,22}(?:决定|选择|先做|做了|推进|调整|完成|放下|提交|交了|联系|问清|缩小|放在)/u.test(fact.statement);
  };
  const latestConfirmedFact = [...facts]
    .reverse()
    .find(supportsAngle);
  const statement = latestConfirmedFact?.statement
    .replace(/\s+/gu, " ")
    .replace(/[。！!；;，,\s]+$/gu, "")
    .trim();
  if (!statement || !latestConfirmedFact) return null;
  return {
    text: `目前最确定的是：${statement}。更多部分暂时还说不清，我们先停在这里。`,
    supportKey: latestConfirmedFact.key
  };
}

/**
 * 用户在三次回答机会用尽前停止，或当前已经没有值得问的新目标时，回到第二检查点。
 * 这类结束不形成可被日志读取的角度成果。
 */
function closeAngleWithoutOutcome(input: {
  state: EventCenteredDialogueState;
  angle: JournalEventAngle;
  closeAngle?: boolean;
}): EventCenteredTurnPolicyResult {
  const run = ensureAngleRun(input.state, input.angle);
  run.status = input.closeAngle ? "closed" : "available";
  // 即使当前还不足以形成可写入日志的角度成果，用户也已经明确选择并进入了
  // 这个角度。保留它作为第二检查点“继续深入”的上下文，避免在安全收束后
  // 丢掉刚才的讨论方向。
  input.state.lastCompletedAngle = input.angle;
  if (
    input.closeAngle &&
    input.state.currentMicrogoal?.angle === input.angle &&
    input.state.currentMicrogoal.status === "active"
  ) {
    input.state.currentMicrogoal.status = "closed";
  }
  const checkpoint = asCheckpoint(input.state, "second", null);
  return {
    ...checkpoint,
    directive: {
      ...checkpoint.directive,
      exactResponse: "这个角度先停在这里。"
    }
  };
}

function oneTimeUnableAnswerRepair(
  input: DecideEventCenteredTurnPolicyInput,
  state: EventCenteredDialogueState,
  angle: JournalEventAngle,
  run: ReturnType<typeof ensureAngleRun>,
  anchorText: string | null
) {
  const currentQuestion = state.currentQuestion;
  if (
    input.action !== "reply" ||
    (input.understanding.answerSignal !== "unknown" &&
      !hasEventCenteredUnableAnswerSignal(input.rawText)) ||
    isExplicitStopText(input.rawText) ||
    !currentQuestion ||
    currentQuestion.angle !== angle ||
    currentQuestion.repairCount > 0 ||
    currentQuestion.opportunityNumber >= 3 ||
    (currentQuestion.surfaceLevel !== "open_anchor" &&
      currentQuestion.surfaceLevel !== "simplified")
  ) {
    return null;
  }
  const question = angle === "feeling" || angle === "thought"
    ? renderFeelingThoughtRepairQuestion({
        angle,
        target: currentQuestion.target,
        intent: "concretize",
        anchorText
      })
    : renderRelationshipOrActionRepairQuestion({
        angle,
        target: currentQuestion.target,
        intent: "concretize",
        anchorText,
        currentQuestionText: input.currentQuestionText
      });
  if (!question) return null;
  return {
    ...askResult({
      state,
      angle,
      target: currentQuestion.target,
    question,
    opportunityNumber: run.questionOpportunityCount,
    lowPressure: false,
    anchorText,
    repairCount: 1,
    surfaceLevel: "concrete_anchor",
      preserveQuestionIntent: true
    }),
    localDeterministicRepairApplied: true
  };
}

function decideAngle(
  input: DecideEventCenteredTurnPolicyInput,
  state: EventCenteredDialogueState,
  angle: JournalEventAngle
): EventCenteredTurnPolicyResult {
  const run = ensureAngleRun(state, angle);
  const facts = collectPolicyFacts(input);
  const answeredTargets = [
    ...currentAnswerTargets(state, input.understanding),
    ...explicitTargetsForAngle(angle, facts)
  ];
  for (const target of answeredTargets) {
    if (!run.answeredTargets.includes(target)) run.answeredTargets.push(target);
  }
  const explicitUnknown = input.understanding.answerSignal === "unknown" ||
    hasEventCenteredUnableAnswerSignal(input.rawText);
  const explicitStop = input.understanding.answerSignal === "declined" ||
    isExplicitStopText(input.rawText);
  const anchorText = facts.find((fact) => fact.statement)?.statement ?? null;

  if (
    input.action === "reply" &&
    state.currentQuestion?.angle === angle &&
    explicitStop
  ) {
    return closeAngleWithoutOutcome({ state, angle, closeAngle: true });
  }

  // 一次具体入口之后，用户再次明确说不清时直接关闭当前角度。
  // 这条文本边界优先于任意后续的选题策略，避免同一角度重新出现。
  if (
    input.action === "reply" &&
    state.currentQuestion?.angle === angle &&
    state.currentQuestion.repairCount > 0 &&
    hasEventCenteredUnableAnswerSignal(input.rawText)
  ) {
    return closeAngleWithoutOutcome({ state, angle, closeAngle: true });
  }

  const unableAnswerRepair = oneTimeUnableAnswerRepair(input, state, angle, run, anchorText);
  if (unableAnswerRepair) return unableAnswerRepair;

  if (angle === "feeling" || angle === "thought") {
    const salientTargets = feelingThoughtSalientTargets({ angle, rawText: input.rawText, facts });
    const candidateAssessments = feelingThoughtCandidateAssessments(salientTargets);
    const honestLimitAcknowledgement = buildHonestLimitAcknowledgement(
      angle,
      input,
      facts
    );
    const strategyInput = {
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
      outcomeCandidate: buildFeelingThoughtOutcome(input, angle, facts),
      honestLimitStatement: honestLimitAcknowledgement?.text
    } satisfies Parameters<typeof decideFeelingOrThoughtStrategy>[0];
    let decision = decideFeelingOrThoughtStrategy(strategyInput);
    if (
      input.action === "select_exploration_angle" &&
      decision.kind === "outcome" &&
      decision.outcomeKind === null
    ) {
      decision = decideFeelingOrThoughtStrategy({
        ...strategyInput,
        allowOptionalTargetsWithoutSalience: true
      });
    }
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
      return closeAngleWithoutOutcome({
        state,
        angle,
        closeAngle: explicitStop || (explicitUnknown && run.questionOpportunityCount > 0)
      });
    }
    const supportKeys = decision.outcomeKind === "insight"
      ? buildFeelingThoughtOutcome(input, angle, facts)?.supportFactIds ?? []
      : honestLimitAcknowledgement
        ? [honestLimitAcknowledgement.supportKey]
        : [];
    return completeAngle({
      state,
      angle,
      kind: decision.outcomeKind,
      statement: decision.statement,
      supportKeys,
      honestLimitResponse: decision.outcomeKind === "honest_limit"
        ? honestLimitAcknowledgement?.text
        : null
    });
  }

  const supportedOutcome = buildRelationshipActionOutcome(input, angle, facts);
  const honestLimitAcknowledgement = buildHonestLimitAcknowledgement(
    angle,
    input,
    facts
  );
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
    initialAngleSelection: input.action === "select_exploration_angle",
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
    clearCurrentQuestion(state);
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
    return closeAngleWithoutOutcome({
      state,
      angle,
      closeAngle: explicitStop || (explicitUnknown && run.questionOpportunityCount > 0)
    });
  }
  const supportKeys = decision.outcomeKind === "insight"
    ? supportedOutcome?.supportFactIds ?? []
    : honestLimitAcknowledgement
      ? [honestLimitAcknowledgement.supportKey]
      : [];
  return completeAngle({
    state,
    angle,
    kind: decision.outcomeKind,
    statement: decision.outcomeKind === "honest_limit" && honestLimitAcknowledgement
      ? honestLimitAcknowledgement.text
      : decision.statement,
    supportKeys,
    honestLimitResponse: decision.outcomeKind === "honest_limit"
      ? honestLimitAcknowledgement?.text
      : null
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
      if (state.currentQuestionIntent?.targetId !== state.currentQuestion.target) {
        state.currentQuestionIntent = null;
      }
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
    const angle = state.currentQuestion.angle;
    const anchorText = collectPolicyFacts(input).find(
      (fact) => fact.stance === "affirmed" && fact.statement.trim()
    )?.statement ?? null;
    const repairedQuestion = repair
      ? angle === "feeling" || angle === "thought"
        ? renderFeelingThoughtRepairQuestion({
            angle,
            target: state.currentQuestion.target,
            intent: input.regenerationIntent as "simplify" | "concretize",
            anchorText
          })
        : renderRelationshipOrActionRepairQuestion({
            angle,
            target: state.currentQuestion.target,
            intent: input.regenerationIntent as "simplify" | "concretize",
            anchorText,
            currentQuestionText: input.currentQuestionText
          })
      : null;
    const exactResponse = repairedQuestion ??
      input.currentQuestionText ??
      "我们继续停在这个问题上，你可以按最容易说的方式回答。";
    return askResult({
      state,
      angle,
      target: state.currentQuestion.target,
      question: exactResponse,
      opportunityNumber: nextCount,
      lowPressure: input.regenerationIntent === "lighten",
      anchorText,
      repairCount: state.currentQuestion.repairCount + (repair ? 1 : 0),
      surfaceLevel: input.regenerationIntent === "simplify"
        ? "simplified"
        : input.regenerationIntent === "concretize"
          ? "concrete_anchor"
          : undefined,
      preserveQuestionIntent: true
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

  // 深聊中同样复用问停规则。用户第一次说不清只换一次具体入口；
  // 已给过入口后再次说不清，或明确停止时关闭当前角度。
  if (
    state.phase === "deep_companionship" &&
    input.action === "reply" &&
    state.currentQuestion?.angle &&
    (isExplicitStopText(input.rawText) ||
      hasEventCenteredUnableAnswerSignal(input.rawText))
  ) {
    return decideAngle(input, state, state.currentQuestion.angle);
  }

  if (state.phase === "event_recording") {
    if (input.understanding.answerSignal === "declined") {
      return keepEventAtBoundary(state);
    }
    if (input.understanding.eventBoundary === "multiple_events") {
      state.phase = "event_focus_clarification";
      state.reflectionReady = false;
      state.focusOptions = focusOptionsFor(input);
      const hasReliablePaperOptions = state.focusOptions.length === 2;
      state.currentQuestion = {
        opportunityNumber: 1,
        angle: null,
        target: "event_selection",
        surfaceLevel: hasReliablePaperOptions ? "low_pressure_choice" : "simplified",
        repairCount: 0,
        assistantMessageId: null
      };
      state.currentQuestionIntent = null;
      return {
        nextState: state,
        directive: {
          responseKind: "clarification",
          questionSpec: questionSpec({
            state,
            angle: null,
            target: "event_selection",
            opportunityNumber: null,
            surfaceLevel: hasReliablePaperOptions ? "low_pressure_choice" : "simplified"
          }),
          checkpoint: null,
          angleOutcome: null,
          exactResponse: hasReliablePaperOptions
            ? "我先把你刚才提到的两件事都留在这里。"
            : "我先把这段原话留在这里。你可以直接说这次想先记录哪一件。"
        },
        angleOutcome: null,
        preserveCurrentQuestion: false
      };
    }
    return askForReflectionMaterial(input, state);
  }

  if (state.phase === "event_focus_clarification") {
    if (input.action === "select_current_event") {
      return askForReflectionMaterial(input, state);
    }
    if (
      state.focusOptions.length === 0 &&
      input.action === "reply" &&
      input.understanding.eventBoundary === "current_event" &&
      input.understanding.coreEventIdentifiable
    ) {
      return askForReflectionMaterial(input, state);
    }
    if (input.understanding.answerSignal === "declined") {
      return keepEventAtBoundary(state);
    }
    return {
      nextState: state,
      directive: {
        responseKind: "clarification",
        questionSpec: state.focusOptions.length === 0
          ? questionSpec({
              state,
              angle: null,
              target: "event_selection",
              opportunityNumber: null,
              surfaceLevel: "simplified"
            })
          : null,
        checkpoint: null,
        angleOutcome: null,
        exactResponse: state.focusOptions.length === 0
          ? "你可以直接说这次想先记录哪一件。"
          : "两件事都已经留在原话里。"
      },
      angleOutcome: null,
      preserveCurrentQuestion: true
    };
  }

  if (state.phase === "checkpoint_one" || state.phase === "checkpoint_two") {
    if (input.action === "select_exploration_angle" && input.selectedAngle) {
      if (state.angleRuns[input.selectedAngle]?.status === "closed") {
        return asCheckpoint(state, state.phase === "checkpoint_one" ? "first" : "second", null);
      }
      if (state.phase === "checkpoint_one" && !state.reflectionReady) {
        return askForReflectionMaterial(input, state);
      }
      state.activeAngle = input.selectedAngle;
      ensureAngleRun(state, input.selectedAngle).status = "active";
      return decideAngle(input, state, input.selectedAngle);
    }
    if (state.phase === "checkpoint_two" && input.action === "continue_exploration") {
      const angle = state.lastCompletedAngle;
      if (!angle || state.angleRuns[angle]?.status === "closed") {
        return asCheckpoint(state, "second", null);
      }
      state.phase = "deep_companionship";
      state.activeAngle = angle;
      ensureAngleRun(state, angle).status = "active";
      state.currentQuestion = {
        opportunityNumber: 1,
        angle,
        target: "deep_open_point",
        surfaceLevel: "open_anchor",
        repairCount: 0,
        assistantMessageId: null
      };
      state.currentQuestionIntent = null;
      return {
        nextState: state,
        directive: {
          responseKind: "question",
          questionSpec: questionSpec({
            state,
            angle,
            target: "deep_open_point",
            opportunityNumber: null,
            surfaceLevel: "open_anchor"
          }),
          checkpoint: null,
          angleOutcome: null,
          exactResponse: angle === "feeling"
            ? "这份感受持续或变化时，最关键的触发点是什么？"
            : angle === "thought"
              ? "要判断这个想法是否站得住，哪条具体依据最关键？"
              : angle === "relationship"
                ? "这段互动里，哪一个具体反应最能说明你在意的关系期待？"
                : "这次行动真正有效或受阻的关键条件是什么？"
        },
        angleOutcome: null,
        preserveCurrentQuestion: false
      };
    }
    return asCheckpoint(state, state.phase === "checkpoint_one" ? "first" : "second", null);
  }

  if (state.phase === "guided_reflection" && state.activeAngle) {
    const result = decideAngle(input, state, state.activeAngle);
    if (
      input.understanding.answerSignal === "correction" &&
      result.directive.checkpoint?.kind === "second" &&
      result.directive.angleOutcome === null
    ) {
      return {
        ...result,
        directive: {
          ...result.directive,
          exactResponse: "好，我们按这个更准确的理解继续。"
        }
      };
    }
    return result;
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
      state.currentQuestionIntent = null;
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
      clearCurrentQuestion(state);
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
  clearCurrentQuestion(state);
  return {
    nextState: state,
    directive: {
      responseKind: "acknowledgement",
      questionSpec: null,
      checkpoint: null,
      angleOutcome: null,
      exactResponse: input.understanding.answerSignal === "declined"
        ? "好，我们先停在这里。"
        : "好，我听到了。"
    },
    angleOutcome: null,
    preserveCurrentQuestion: false
  };
}
