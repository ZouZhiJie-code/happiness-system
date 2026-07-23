import type { EventCenteredAssistantPayload } from "@/types/event-centered-dialogue";
import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import {
  detectEventCenteredSafetyBlockers,
  type EventCenteredSafetyBlocker
} from "@/features/interview/event-centered/safety-policy";

export type EventCenteredTurnSafetyBlocker = EventCenteredSafetyBlocker;

export type EventCenteredTurnQualityIssue =
  | "internal_structure_exposure"
  | "unsolicited_advice"
  | "repeated_question"
  | "multiple_question_targets"
  | "natural_understanding_question"
  | "checkpoint_question_overreach"
  | "paper_selection_overreach"
  | "first_checkpoint_overreach"
  | "unsupported_hypothesis_mismatch";

/** 第一检查点只承接“这件事已被记录”，不额外解释感受、意义或洞见。 */
export const EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING = "这件事已经先记下来了。";

/**
 * 三次回答机会用尽且材料仍有限时，诚实结束当前探索，避免把有限材料包装成洞见。
 */
export const EVENT_CENTERED_HONEST_LIMIT_RESPONSE = "这部分还不急着说成一个结论，我们先停在这里。";

/** 当前角度提前结束且没有形成成果时，给第二检查点的中性承接。 */
export const EVENT_CENTERED_SECOND_CHECKPOINT_PAUSE_RESPONSE = "这个角度先停在这里。";

/** 用户愿意继续表达时，先明确承接其可说范围。 */
export const EVENT_CENTERED_CONTINUE_WITH_BOUNDARY_ACKNOWLEDGEMENT = "好，我们只停在你愿意说的部分。";

export type EventCenteredFirstCheckpointFactAcknowledgement = {
  kind: "correction" | "denial";
  understanding: string;
  safeFallback: string;
};

function checkpointFactText(value: string) {
  return value
    .replace(/[？?]/gu, "")
    .replace(/[。！!；;，,\s]+$/gu, "")
    .trim()
    .slice(0, 72);
}

/**
 * 第一检查点通常只确认“已记录”。当本轮已经通过现有理解协议识别为纠正，
 * 或写入了明确否定事实时，理解层需要承接这次变化，避免用户看到旧口径。
 */
export function getEventCenteredFirstCheckpointFactAcknowledgement(
  decision: Pick<EventCenteredUnderstandingDecision, "answerSignal" | "facts">
): EventCenteredFirstCheckpointFactAcknowledgement | null {
  if (decision.answerSignal === "correction") {
    const statement = checkpointFactText(decision.facts[0]?.statement ?? "");
    return {
      kind: "correction",
      understanding: statement
        ? `我已按你的纠正更新：${statement}。`
        : "我已按你的纠正更新这处。",
      safeFallback: "我已按你的纠正更新这处。"
    };
  }

  const deniedFact = decision.facts.find((fact) => fact.stance === "denied");
  if (!deniedFact) return null;
  const statement = checkpointFactText(deniedFact.statement);
  return {
    kind: "denial",
    understanding: statement
      ? `我已按你的原话记下：${statement}。`
      : "我已按你明确否定的内容更新这处。",
    safeFallback: "我已按你明确否定的内容更新这处。"
  };
}

/**
 * 用户明确愿意继续、同时要求尊重可说范围时，安全收束可以自然承接这份
 * 主动性，并继续保留已经冻结的单一问题。文本停止表达仍由既有边界策略优先
 * 收束，因此这条判断只由安全回退调用。
 */
const CONTINUE_WITH_BOUNDARY_PATTERN = /(?:愿意|想|可以|能).{0,10}(?:继续|再说|往下).{0,24}(?:尊重|按照|按).{0,12}(?:我(?:的)?|自己的)?边界|(?:尊重|按照|按).{0,12}(?:我(?:的)?|自己的)?边界.{0,24}(?:愿意|想|可以|能).{0,10}(?:继续|再说|往下)/u;
const DIRECT_TEXT_STOP_PATTERN = /(?:不想回答|不想答|不想继续|我(?:想|要)?停下来|不继续聊(?:这个|了)?|先停|别问了|不聊了|不用再追问|(?:先|就先)?收(?:在|到)?这里|暂时不想(?:说|聊)|到这里就好)/u;

export function isEventCenteredContinueWithinBoundaryExpression(rawText: string) {
  const normalized = rawText.trim();
  return CONTINUE_WITH_BOUNDARY_PATTERN.test(normalized) && !DIRECT_TEXT_STOP_PATTERN.test(normalized);
}

/**
 * 正常生成与安全回退共用的理解层口径。第一检查点、明确继续边界与待确认推测
 * 都在这里拥有固定优先级，避免不同调用链写出不同的用户可见文本。
 */
export function resolveEventCenteredNaturalUnderstanding(input: {
  rawText: string;
  directive: Pick<EventCenteredAssistantPayload, "questionSpec" | "checkpoint">;
  naturalUnderstanding: string;
  hypothesisStatement?: string | null;
  firstCheckpointUnderstanding?: string | null;
}) {
  if (input.directive.checkpoint?.kind === "first") {
    return input.firstCheckpointUnderstanding ?? EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING;
  }
  if (
    input.directive.questionSpec !== null &&
    input.directive.checkpoint === null &&
    isEventCenteredContinueWithinBoundaryExpression(input.rawText)
  ) {
    return EVENT_CENTERED_CONTINUE_WITH_BOUNDARY_ACKNOWLEDGEMENT;
  }
  if (input.hypothesisStatement && !input.naturalUnderstanding.includes(input.hypothesisStatement)) {
    return `${input.naturalUnderstanding} 也许，${input.hypothesisStatement}。`;
  }
  return input.naturalUnderstanding;
}

export function resolveEventCenteredSecondCheckpointResponse(input: {
  outcome: string | null;
  angleOutcomeKind?: EventCenteredAssistantPayload["angleOutcome"] extends infer Outcome
    ? Outcome extends { kind: infer Kind } ? Kind : never
    : never;
}) {
  if (input.angleOutcomeKind === "honest_limit") {
    return EVENT_CENTERED_HONEST_LIMIT_RESPONSE;
  }
  return input.outcome?.trim() || EVENT_CENTERED_SECOND_CHECKPOINT_PAUSE_RESPONSE;
}

const INTERNAL_PATTERN = /(snapshotData|branchStateId|pendingUnderstandingClaim|事实表|槽位|状态机|内部命题|Trace\b)/iu;
const ADVICE_PATTERN = /(你可以试试|建议你|你应该|不妨去|最好去)/u;

function normalize(value: string) {
  return value.replace(/[\s，。！？、,.!?：:；;]/gu, "").toLowerCase();
}

export function runEventCenteredTurnQualityGate(input: {
  payload: EventCenteredAssistantPayload;
  previousAssistantResponses: string[];
  adviceRequested: boolean;
  pendingHypothesisStatement: string | null;
  firstCheckpointUnderstanding?: string | null;
}) {
  const visible = `${input.payload.naturalUnderstanding}\n${input.payload.naturalResponse}`;
  const safetyBlockers = detectEventCenteredSafetyBlockers(visible);
  const qualityIssues: EventCenteredTurnQualityIssue[] = [];

  if (INTERNAL_PATTERN.test(visible)) qualityIssues.push("internal_structure_exposure");
  if (!input.adviceRequested && ADVICE_PATTERN.test(visible)) qualityIssues.push("unsolicited_advice");

  const understandingQuestionCount = (input.payload.naturalUnderstanding.match(/[？?]/gu) ?? []).length;
  const questionCount = (input.payload.naturalResponse.match(/[？?]/gu) ?? []).length;
  if (understandingQuestionCount > 0) qualityIssues.push("natural_understanding_question");
  if (understandingQuestionCount + questionCount > 1) qualityIssues.push("multiple_question_targets");
  if (input.payload.checkpoint && questionCount > 0) qualityIssues.push("checkpoint_question_overreach");
  const isPaperSelection = input.payload.responseKind === "clarification" &&
    input.payload.questionSpec?.surfaceLevel === "low_pressure_choice";
  if (
    isPaperSelection &&
    (questionCount > 0 || /(请选择|选(?:择|哪|一件)|点击|继续补充|直接生成)/u.test(input.payload.naturalResponse))
  ) {
    qualityIssues.push("paper_selection_overreach");
  }
  if (
    input.payload.checkpoint?.kind === "first" &&
    (
      input.payload.naturalUnderstanding !== (
        input.firstCheckpointUnderstanding ?? EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING
      ) ||
      input.payload.questionSpec !== null ||
      questionCount > 0
    )
  ) {
    qualityIssues.push("first_checkpoint_overreach");
  }
  const current = normalize(input.payload.naturalResponse);
  const preservesCurrentQuestion = input.payload.responseKind === "boundary" &&
    input.payload.questionSpec !== null;
  if (
    input.payload.questionSpec &&
    !preservesCurrentQuestion &&
    input.previousAssistantResponses.some((response) => normalize(response) === current)
  ) {
    qualityIssues.push("repeated_question");
  }
  if (
    input.pendingHypothesisStatement &&
    !input.payload.naturalUnderstanding.includes(input.pendingHypothesisStatement)
  ) {
    qualityIssues.push("unsupported_hypothesis_mismatch");
  }

  return {
    passed: safetyBlockers.length === 0 && qualityIssues.length === 0,
    safetyBlockers: [...new Set(safetyBlockers)],
    qualityIssues: [...new Set(qualityIssues)]
  };
}

export function createSafeEventCenteredPayload(input: {
  payload: EventCenteredAssistantPayload;
  exactResponse: string;
  firstCheckpointUnderstanding?: string | null;
  /**
   * 仅当用户明确表达“愿意继续、请尊重边界”，且模型草稿被安全门清除时传入。
   * 调用方已完成文本停止边界判断，因此这里不改变对话状态或问题机会。
   */
  acknowledgeBoundaryContinuation?: boolean;
}) {
  const checkpointResponse = input.payload.checkpoint?.kind === "first"
    ? "这件事已经先记下来了。"
    : input.payload.checkpoint?.kind === "second"
      ? resolveEventCenteredSecondCheckpointResponse({
        outcome: input.payload.checkpoint.outcome,
        angleOutcomeKind: input.payload.angleOutcome?.kind
      })
      : null;
  const isPaperSelection = input.payload.responseKind === "clarification" &&
    input.payload.questionSpec?.surfaceLevel === "low_pressure_choice";
  const boundaryContinuation = input.acknowledgeBoundaryContinuation &&
    input.payload.questionSpec !== null &&
    input.payload.checkpoint === null;
  return {
    ...input.payload,
    naturalUnderstanding: input.payload.checkpoint?.kind === "first"
      ? input.firstCheckpointUnderstanding ?? EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING
      : boundaryContinuation
        ? EVENT_CENTERED_CONTINUE_WITH_BOUNDARY_ACKNOWLEDGEMENT
      : "我先按你已经明确表达的内容来理解。",
    naturalResponse: checkpointResponse ?? (isPaperSelection
      ? "我先把你刚才提到的两件事都留在这里。"
      : input.exactResponse)
  } satisfies EventCenteredAssistantPayload;
}
