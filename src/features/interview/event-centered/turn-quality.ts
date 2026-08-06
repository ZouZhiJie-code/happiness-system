import type { EventCenteredAssistantPayload } from "@/types/event-centered-dialogue";
import type { EventCenteredUnderstandingDecision } from "@/features/interview/event-centered/ai-contract";
import {
  detectEventCenteredSafetyBlockers,
  type EventCenteredSafetyBlocker
} from "@/features/interview/event-centered/safety-policy";
import {
  inferSingleEventCenteredQuestionFocus,
  type EventCenteredResponseQuestionFocus
} from "@/features/interview/event-centered/response-question-focus";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";

export type EventCenteredTurnSafetyBlocker = EventCenteredSafetyBlocker;

export type EventCenteredTurnQualityIssue =
  | "internal_structure_exposure"
  | "third_person_observer_voice"
  | "unsolicited_advice"
  | "repeated_question"
  | "multiple_question_targets"
  | "natural_understanding_question"
  | "checkpoint_question_overreach"
  | "paper_selection_overreach"
  | "first_checkpoint_overreach"
  | "first_checkpoint_duplicate_layers"
  | "unsupported_hypothesis_mismatch";

/** 第一检查点理解层的安全回退；正文回应继续单独表达“已记下”。 */
export const EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING = "我先按你已经说清楚的内容来理解这一段。";

/**
 * 三次回答机会用尽且材料仍有限时，诚实结束当前探索，避免把有限材料包装成洞见。
 */
export const EVENT_CENTERED_HONEST_LIMIT_RESPONSE = "这部分还不急着说成一个结论，我们先停在这里。";

/** 当前角度提前结束且没有形成成果时，给第二检查点的中性承接。 */
export const EVENT_CENTERED_SECOND_CHECKPOINT_PAUSE_RESPONSE = "这个角度先停在这里。";

/** 用户愿意继续表达时，先明确承接其可说范围。 */
export const EVENT_CENTERED_CONTINUE_WITH_BOUNDARY_ACKNOWLEDGEMENT = "好，我们只聊你愿意说的部分。";

function normalizeQuestionAnchor(value: string | null | undefined) {
  return value?.replace(/[\s，。！？、,.!?：:；;“”‘’'"（）()…]/gu, "").trim() ?? "";
}

function understandingContainsQuestionAnchor(input: {
  naturalUnderstanding: string;
  anchorText: string;
}) {
  const understanding = normalizeQuestionAnchor(input.naturalUnderstanding);
  const anchor = normalizeQuestionAnchor(input.anchorText);
  if (!understanding || !anchor) return false;
  if (understanding.includes(anchor)) return true;

  const windowLength = Math.min(8, anchor.length);
  if (windowLength < 6) return false;
  for (let index = 0; index <= anchor.length - windowLength; index += 1) {
    if (understanding.includes(anchor.slice(index, index + windowLength))) return true;
  }
  return false;
}

/**
 * 理解层已经承接事实锚点时，问题直接进入目标，避免连续两句“你提到……”。
 * 理解层缺少同一锚点时保留问题前缀，让确定性回退仍有清晰上下文。
 */
export function removeRepeatedEventCenteredQuestionAnchor(input: {
  naturalUnderstanding: string;
  naturalResponse: string;
  anchorText: string | null | undefined;
}) {
  if (!input.anchorText || !understandingContainsQuestionAnchor({
    naturalUnderstanding: input.naturalUnderstanding,
    anchorText: input.anchorText
  })) return input.naturalResponse;

  const prefix = input.naturalResponse.match(/^\s*你提到[“"]([^”"]+)[”"][。.]?\s*/u);
  if (!prefix?.[1]) return input.naturalResponse;
  const renderedAnchor = normalizeQuestionAnchor(prefix[1]);
  const expectedAnchor = normalizeQuestionAnchor(input.anchorText);
  if (
    !renderedAnchor ||
    !expectedAnchor ||
    !(renderedAnchor.includes(expectedAnchor) || expectedAnchor.includes(renderedAnchor))
  ) return input.naturalResponse;

  return input.naturalResponse.slice(prefix[0].length).trimStart() || input.naturalResponse;
}

export type EventCenteredFirstCheckpointFactAcknowledgement = {
  kind: "correction" | "denial";
  understanding: string;
  safeFallback: string;
};

export type EventCenteredFirstCheckpointPresentation =
  EventCenteredFirstCheckpointFactAcknowledgement | {
    kind: "boundary" | "evidence";
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

function checkpointEvidenceUnderstanding(input: {
  rawText: string;
  factStatement: string;
}) {
  const rawText = input.rawText
    .replace(/\s+/gu, " ")
    .trim();
  const normalizedRawText = rawText
    .replace(/[。！!；;，,\s]+$/gu, "")
    .trim();

  if (normalizedRawText && normalizedRawText.length <= 72) {
    return `你刚刚说到：“${normalizedRawText}”。`;
  }

  if (normalizedRawText) {
    const preview = normalizedRawText.slice(0, 72);
    const boundaries = [...preview.matchAll(/[。！？!?；;，,]/gu)]
      .map((match) => match.index ?? -1)
      .filter((index) => index >= 12);
    const lastBoundary = boundaries.at(-1);
    if (lastBoundary !== undefined) {
      const excerpt = preview
        .slice(0, lastBoundary + 1)
        .replace(/[。！？!?；;，,\s]+$/gu, "")
        .trim();
      if (excerpt) return `你刚刚说到：“${excerpt}……”`;
    }
  }

  const factStatement = input.factStatement
    .replace(/[？?]/gu, "")
    .replace(/[。！!；;，,\s]+$/gu, "")
    .trim();
  if (factStatement && factStatement.length <= 72) {
    return `你刚刚说到，${factStatement}。`;
  }

  return EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING;
}

const FIRST_CHECKPOINT_TEXT_BOUNDARY_PATTERN = /^(?:我)?(?:(?:也|还是|暂时|现在|目前|确实|真的|实在))?(?:没有|不知道|不清楚|不了解|想不起来|记不起来|记不清|说不清(?:楚)?|没法再具体(?:说|讲|描述)?|无法再具体(?:说|讲|描述)?|(?:这些|那些|这几个|那几个)?都不贴切|都不合适|不想(?:回答|答|说))(?:了|啊|呀|呢|吧)?$/u;

const SHORT_BOUNDARY_DENIAL_PATTERN = /^(?:我)?(?:(?:也|还是|暂时|现在|目前|确实|真的|实在))?(?:并)?没有(?:了|啊|呀|呢|吧)?$/u;
const SHORT_BOUNDARY_RECALL_PATTERN = /^(?:我)?(?:(?:也|还是|暂时|现在|目前|确实|真的|实在))?(?:想不起来|记不起来|记不清)(?:了|啊|呀|呢|吧)?$/u;
const SHORT_BOUNDARY_UNKNOWN_PATTERN = /^(?:我)?(?:(?:也|还是|暂时|现在|目前|确实|真的|实在))?(?:不知道|不清楚|不了解|说不清(?:楚)?)(?:了|啊|呀|呢|吧)?$/u;
const SHORT_BOUNDARY_REFUSAL_PATTERN = /^(?:我)?(?:(?:也|还是|暂时|现在|目前|确实|真的|实在))?(?:不想(?:回答|答|说))(?:了|啊|呀|呢|吧)?$/u;
const SHORT_BOUNDARY_MISMATCH_PATTERN = /^(?:我)?(?:(?:也|还是|暂时|现在|目前))?(?:(?:这些|那些|这几个|那几个)?都不贴切|都不合适)(?:了|啊|呀|呢|吧)?$/u;
const SHORT_BOUNDARY_DETAIL_LIMIT_PATTERN = /^(?:我)?(?:(?:也|还是|暂时|现在|目前))?(?:没法|无法)再具体(?:说|讲|描述)?(?:了|啊|呀|呢|吧)?$/u;

type EventCenteredBoundaryQuestionContext =
  | "event_moment"
  | "feeling"
  | "thought"
  | "judgment_basis"
  | "expected_response"
  | "relationship_position"
  | "relationship_trust"
  | "relationship_reciprocity"
  | "relationship_boundary"
  | "action_goal"
  | "action_choice"
  | "action_tradeoff"
  | "action_effective_condition"
  | "action_resistance"
  | "action_adjustable_part";

function normalizeBoundaryText(value: string) {
  return value
    .replace(/[“”"'‘’]/gu, "")
    .replace(/[。！!？?，,；;\s]+/gu, "")
    .trim();
}

/**
 * 问题前缀只是对上一轮原话的回扣，不承载新的提问目标。
 * 用户原话里可能本身含有“怎么／什么”，计数时跳过这段引用，避免把
 * 一个清楚的问题误判成两个问题。
 */
function questionWithoutEventAnchor(value: string | null | undefined) {
  return value?.trim().replace(/你提到[“"][^”"]+[”"][。.]?\s*/gu, "") ?? "";
}

function hasOneQuestionTarget(currentQuestionText: string | null | undefined) {
  const question = questionWithoutEventAnchor(currentQuestionText);
  if (!question) return false;
  if ((question.match(/[？?]/gu) ?? []).length > 1) return false;
  if (/(?:更接近|比较像|是哪种).{0,20}(?:还是|或者|或).{0,20}/u.test(question)) return false;
  const interrogatives = question.match(/什么|哪(?:个|种|一|句|条|部分|一步|两边)|怎么|怎样|是否|几(?:个|次|种)/gu) ?? [];
  if (interrogatives.length > 1) return false;
  return !/(?:感受|情绪|念头|想法|回应|动作|条件).{0,8}(?:或|还是|以及|和).{0,8}(?:感受|情绪|念头|想法|回应|动作|条件)/u.test(question);
}

function questionAngleFromTarget(
  currentQuestionTarget: string | null | undefined
): JournalEventAngle | null {
  switch (currentQuestionTarget) {
    case "relationship_expectation":
    case "relationship_position_or_boundary":
      return "relationship";
    case "action_goal":
    case "action_choice":
    case "action_condition_or_friction":
      return "action";
    default:
      return null;
  }
}

/**
 * 关系与行动角度已有公共焦点识别协议。边界承接复用同一份识别结果，
 * 让在线访谈、换问法与评测对“用户正在回答什么”保持同一口径。
 */
function inferBoundaryResponseQuestionFocus(input: {
  currentQuestionText?: string | null;
  currentQuestionTarget?: string | null;
}): EventCenteredResponseQuestionFocus | null {
  const currentQuestionText = questionWithoutEventAnchor(input.currentQuestionText);
  const targetAngle = questionAngleFromTarget(input.currentQuestionTarget);
  if (targetAngle) {
    return inferSingleEventCenteredQuestionFocus({
      angle: targetAngle,
      text: currentQuestionText
    });
  }

  const candidates = (["relationship", "action"] as const)
    .map((angle) => inferSingleEventCenteredQuestionFocus({
      angle,
      text: currentQuestionText
    }))
    .filter((focus): focus is EventCenteredResponseQuestionFocus => focus !== null);
  return candidates.length === 1 ? candidates[0] : null;
}

function boundaryContextFromResponseQuestionFocus(
  focus: EventCenteredResponseQuestionFocus
): EventCenteredBoundaryQuestionContext {
  switch (focus) {
    case "relational_position":
      return "relationship_position";
    case "trust_signal":
      return "relationship_trust";
    case "reciprocity":
      return "relationship_reciprocity";
    case "relationship_boundary":
      return "relationship_boundary";
    case "tradeoff":
      return "action_tradeoff";
    case "effective_condition":
      return "action_effective_condition";
    case "resistance":
      return "action_resistance";
    case "adjustable_part":
      return "action_adjustable_part";
  }
}

function boundaryQuestionContext(input: {
  currentQuestionText?: string | null;
  currentQuestionTarget?: string | null;
}): EventCenteredBoundaryQuestionContext | null {
  if (!hasOneQuestionTarget(input.currentQuestionText)) return null;
  const text = input.currentQuestionText ?? "";

  const responseQuestionFocus = inferBoundaryResponseQuestionFocus(input);
  if (responseQuestionFocus) {
    return boundaryContextFromResponseQuestionFocus(responseQuestionFocus);
  }

  if (/(?:具体时刻|哪个时刻|瞬间|哪一下|发生了什么|想留下)/u.test(text)) return "event_moment";
  if (/(?:感受|情绪|身体.{0,6}(?:感觉|反应))/u.test(text)) return "feeling";
  if (/(?:念头|想法|脑子里|怎么想)/u.test(text)) return "thought";
  if (/(?:判断|依据|事实)/u.test(text)) return "judgment_basis";
  if (/(?:希望|期待).{0,12}(?:回应|怎么做)|怎样回应/u.test(text)) return "expected_response";
  if (/(?:关系).{0,12}(?:位置|怎么站)|(?:位置|怎么站).{0,12}(?:关系)/u.test(text)) return "relationship_position";
  if (/(?:目标|想推进|想完成)/u.test(text)) return "action_goal";
  if (/(?:选择|决定|实际做)/u.test(text)) return "action_choice";

  switch (input.currentQuestionTarget) {
    case "light_event_anchor":
    case "event_anchor":
    case "specific_trigger":
      return "event_moment";
    case "direct_experience":
    case "experience_change":
      return "feeling";
    case "immediate_thought":
      return "thought";
    case "judgment_basis":
      return "judgment_basis";
    case "relationship_expectation":
      return "expected_response";
    case "relationship_position_or_boundary":
      return "relationship_position";
    case "action_goal":
      return "action_goal";
    case "action_choice":
      return "action_choice";
    default:
      return null;
  }
}

const BOUNDARY_CONTEXT_COPY: Record<
  EventCenteredBoundaryQuestionContext,
  { denial: string; recall: string; unknown: string; refusal: string }
> = {
  event_moment: {
    denial: "你说没有更具体的时刻了。",
    recall: "你暂时想不起更具体的时刻了。",
    unknown: "你暂时还说不清更具体的时刻。",
    refusal: "你暂时不想再说这个具体时刻。"
  },
  feeling: {
    denial: "你说当时没有更明确的感受了。",
    recall: "你暂时想不起当时更具体的感受了。",
    unknown: "你暂时还说不清当时的感受。",
    refusal: "你暂时不想再说当时的感受。"
  },
  thought: {
    denial: "你说当时没有更明确的想法了。",
    recall: "你暂时想不起当时更具体的想法了。",
    unknown: "你暂时还说不清当时的想法。",
    refusal: "你暂时不想再说当时的想法。"
  },
  judgment_basis: {
    denial: "你说当时没有更具体的判断依据了。",
    recall: "你暂时想不起更具体的判断依据了。",
    unknown: "你暂时还说不清当时的判断依据。",
    refusal: "你暂时不想再说当时的判断依据。"
  },
  expected_response: {
    denial: "你说当时没有更明确期待的回应了。",
    recall: "你暂时想不起当时更期待怎样的回应了。",
    unknown: "你暂时还说不清当时期待的回应。",
    refusal: "你暂时不想再说当时期待的回应。"
  },
  relationship_position: {
    denial: "你说这次互动里没有更明确的位置感了。",
    recall: "你暂时想不起哪种回应会让位置更清楚了。",
    unknown: "你暂时还说不清自己在这段关系中的位置。",
    refusal: "你暂时不想再说自己在这段关系中的位置。"
  },
  relationship_trust: {
    denial: "你说这次互动里没有更明确的可信信号了。",
    recall: "你暂时想不起什么回应会让你更信任对方了。",
    unknown: "你暂时还说不清什么回应会让这段关系显得可靠。",
    refusal: "你暂时不想再说这段关系里的信任。"
  },
  relationship_reciprocity: {
    denial: "你说这次互动里没有更明确的有来有回了。",
    recall: "你暂时想不起双方希望怎样有来有回了。",
    unknown: "你暂时还说不清双方希望怎样有来有回。",
    refusal: "你暂时不想再说双方希望怎样有来有回。"
  },
  relationship_boundary: {
    denial: "你说这次互动里没有更明确的关系边界了。",
    recall: "你暂时想不起这段关系里什么不能接受了。",
    unknown: "你暂时还说不清这段关系里什么不能接受。",
    refusal: "你暂时不想再说这段关系里的边界。"
  },
  action_goal: {
    denial: "你说当时没有更明确的目标了。",
    recall: "你暂时想不起当时更具体的目标了。",
    unknown: "你暂时还说不清当时的目标。",
    refusal: "你暂时不想再说当时的目标。"
  },
  action_choice: {
    denial: "你说当时没有更明确的选择了。",
    recall: "你暂时想不起当时更具体的选择了。",
    unknown: "你暂时还说不清当时的选择。",
    refusal: "你暂时不想再说当时的选择。"
  },
  action_tradeoff: {
    denial: "你说这次行动里没有更明确的取舍了。",
    recall: "你暂时想不起这次行动里最难取舍的两边了。",
    unknown: "你暂时还说不清这次行动里最难取舍的两边。",
    refusal: "你暂时不想再说这次行动里的取舍。"
  },
  action_effective_condition: {
    denial: "你说这次行动里没有哪个条件明确帮上了忙。",
    recall: "你暂时想不起哪个条件真正帮上了忙。",
    unknown: "你暂时还说不清哪个条件真正帮上了忙。",
    refusal: "你暂时不想再说这次行动里起作用的条件。"
  },
  action_resistance: {
    denial: "你说这次行动里没有更明确的阻力了。",
    recall: "你暂时想不起这次行动具体卡在哪里了。",
    unknown: "你暂时还说不清这次行动具体卡在哪里。",
    refusal: "你暂时不想再说这次行动里的阻力。"
  },
  action_adjustable_part: {
    denial: "你说这次行动里没有更明确可调整的部分了。",
    recall: "你暂时想不起这次行动里哪一小块可以调整了。",
    unknown: "你暂时还说不清这次行动里哪一小块可以调整。",
    refusal: "你暂时不想再说这次行动里可调整的部分。"
  }
};

/**
 * 短边界优先带回它所回应的唯一问题目标。上下文缺失或同时包含多个问题时，
 * 保持通用承接，避免系统替用户猜测“没有／不知道”具体否定了什么。
 */
export function getEventCenteredTextBoundaryUnderstanding(input: {
  rawText: string;
  currentQuestionText?: string | null;
  currentQuestionTarget?: string | null;
}) {
  const normalized = normalizeBoundaryText(input.rawText);
  if (SHORT_BOUNDARY_MISMATCH_PATTERN.test(normalized)) {
    return "你说这些说法都不贴切。";
  }
  if (SHORT_BOUNDARY_DETAIL_LIMIT_PATTERN.test(normalized)) {
    return "你说这部分没法再具体了。";
  }

  const context = boundaryQuestionContext(input);
  if (!context) return null;
  if (SHORT_BOUNDARY_DENIAL_PATTERN.test(normalized)) {
    return BOUNDARY_CONTEXT_COPY[context].denial;
  }
  if (SHORT_BOUNDARY_RECALL_PATTERN.test(normalized)) {
    return BOUNDARY_CONTEXT_COPY[context].recall;
  }
  if (SHORT_BOUNDARY_UNKNOWN_PATTERN.test(normalized)) {
    return BOUNDARY_CONTEXT_COPY[context].unknown;
  }
  if (SHORT_BOUNDARY_REFUSAL_PATTERN.test(normalized)) {
    return BOUNDARY_CONTEXT_COPY[context].refusal;
  }
  return null;
}

function isFirstCheckpointTextBoundary(rawText: string) {
  const normalized = rawText
    .replace(/[“”"'‘’]/gu, "")
    .replace(/[。！!？?，,；;\s]+/gu, "")
    .trim();
  return FIRST_CHECKPOINT_TEXT_BOUNDARY_PATTERN.test(normalized);
}

/**
 * 第一检查点通常只确认“已记录”。当本轮已经通过现有理解协议识别为纠正，
 * 或写入了明确否定事实时，理解层需要承接这次变化，避免用户看到旧口径。
 */
export function getEventCenteredFirstCheckpointFactAcknowledgement(
  decision: Pick<EventCenteredUnderstandingDecision, "answerSignal" | "facts">,
  rawText?: string
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
  const explicitDenialInRawText = Boolean(rawText?.trim()) &&
    /(?:^|[，,。！？!?；;\s])(?:我|自己)(?:现在|当时|其实|确实)?(?:并没有|没有|没|并非|不是|不觉得|不认为|不在意|不需要|不想|不愿意|没感到)/u.test(rawText!.trim());
  if (!deniedFact || (decision.answerSignal !== "declined" && !explicitDenialInRawText)) return null;
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
 * 第一检查点的用户可见理解统一在这里生成：纠正与否定最优先；文本边界
 * 直接收住；普通清晰事件只摘取原话或已识别事实，不补充解释。
 */
export function getEventCenteredFirstCheckpointPresentation(input: {
  rawText: string;
  decision: Pick<EventCenteredUnderstandingDecision, "answerSignal" | "facts">;
  currentQuestionText?: string | null;
  currentQuestionTarget?: string | null;
}): EventCenteredFirstCheckpointPresentation {
  const factAcknowledgement = getEventCenteredFirstCheckpointFactAcknowledgement(
    input.decision,
    input.rawText
  );
  if (factAcknowledgement?.kind === "correction") return factAcknowledgement;

  if (
    isFirstCheckpointTextBoundary(input.rawText) ||
    (
      !factAcknowledgement &&
      (input.decision.answerSignal === "declined" || input.decision.answerSignal === "unknown")
    )
  ) {
    const contextualUnderstanding = getEventCenteredTextBoundaryUnderstanding(input);
    return {
      kind: "boundary",
      understanding: contextualUnderstanding ?? "好，这部分先停在这里。",
      safeFallback: contextualUnderstanding ?? "好，这部分先停在这里。"
    };
  }

  if (factAcknowledgement) return factAcknowledgement;

  const understanding = checkpointEvidenceUnderstanding({
    rawText: input.rawText,
    factStatement: input.decision.facts[0]?.statement ?? ""
  });
  return {
    kind: "evidence",
    understanding,
    safeFallback: EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING
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
  currentQuestionText?: string | null;
  currentQuestionTarget?: string | null;
}) {
  if (input.directive.checkpoint?.kind === "first") {
    return input.firstCheckpointUnderstanding ?? EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING;
  }
  const boundaryUnderstanding = getEventCenteredTextBoundaryUnderstanding(input);
  if (boundaryUnderstanding) return boundaryUnderstanding;
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
    const outcome = input.outcome?.trim() ?? "";
    return /^目前最确定的是[:：]/u.test(outcome)
      ? outcome
      : EVENT_CENTERED_HONEST_LIMIT_RESPONSE;
  }
  return input.outcome?.trim() || EVENT_CENTERED_SECOND_CHECKPOINT_PAUSE_RESPONSE;
}

const INTERNAL_PATTERN = /(snapshotData|branchStateId|pendingUnderstandingClaim|事实表|槽位|状态机|内部命题|Trace\b)/iu;
const ADVICE_PATTERN = /(你可以试试|建议你|你应该|不妨去|最好去)/u;
const THIRD_PERSON_OBSERVER_SUBJECT_PATTERN = /^(?:(?:当前|该|这位|这名)\s*)?(?:用户|来访者)(.*)$/u;
const THIRD_PERSON_OBSERVER_ACTION_PATTERN = /^(?:(?:从|在|通过|于)[^，,]{0,18})?(?:已经?|刚刚?|刚才|明确|主动|本轮|此次)?\s*(?:提到|描述|表达|表示|认为|希望|说到|说道|说了|选择(?:了)?|点击(?:了)?|操作(?:了)?|完成(?:了)?(?:[^，,]{0,12})?(?:选择|点击|操作)|进行(?:了)?(?:[^，,]{0,12})?(?:选择|点击|操作)|的(?:选择|点击|操作))/u;

function hasThirdPersonObserverVoice(value: string) {
  return value
    .split(/[\n。！？!?；;]/u)
    .some((rawClause) => {
      const subject = rawClause.trim().match(THIRD_PERSON_OBSERVER_SUBJECT_PATTERN);
      return subject ? THIRD_PERSON_OBSERVER_ACTION_PATTERN.test(subject[1] ?? "") : false;
    });
}

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
  if (input.payload.presentation === "hidden") {
    return { passed: true, safetyBlockers: [], qualityIssues: [] };
  }
  const visible = `${input.payload.naturalUnderstanding}\n${input.payload.naturalResponse}`;
  const safetyBlockers = detectEventCenteredSafetyBlockers(visible);
  const qualityIssues: EventCenteredTurnQualityIssue[] = [];

  if (INTERNAL_PATTERN.test(visible)) qualityIssues.push("internal_structure_exposure");
  if (hasThirdPersonObserverVoice(input.payload.naturalUnderstanding)) {
    qualityIssues.push("third_person_observer_voice");
  }
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
  if (
    input.payload.checkpoint?.kind === "first" &&
    normalize(input.payload.naturalUnderstanding) === normalize(input.payload.naturalResponse)
  ) {
    qualityIssues.push("first_checkpoint_duplicate_layers");
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
  boundaryUnderstanding?: string | null;
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
      : input.boundaryUnderstanding ?? "我先按你已经明确表达的内容来理解。",
    naturalResponse: checkpointResponse ?? (isPaperSelection
      ? "我先把你刚才提到的两件事都留在这里。"
      : input.exactResponse)
  } satisfies EventCenteredAssistantPayload;
}
