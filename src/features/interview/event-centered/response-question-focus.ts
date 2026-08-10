import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";

export type EventCenteredRelationshipQuestionFocus =
  | "relational_position"
  | "trust_signal"
  | "reciprocity"
  | "relationship_boundary";

export type EventCenteredActionQuestionFocus =
  | "tradeoff"
  | "effective_condition"
  | "resistance"
  | "adjustable_part";

export type EventCenteredResponseQuestionFocus =
  | EventCenteredRelationshipQuestionFocus
  | EventCenteredActionQuestionFocus;

export const EVENT_CENTERED_ACTION_QUESTION_FOCUS_ORDER =
  ["tradeoff", "effective_condition", "resistance", "adjustable_part"] as const;

const RELATIONSHIP_QUESTION_FOCUS_PATTERNS:
  Record<EventCenteredRelationshipQuestionFocus, RegExp> = {
    relational_position: /(?:位置|怎么站|如何站|处在|平等|参与.{0,8}决定|参与到什么程度|发言权)/u,
    trust_signal: /(?:信任|可靠|靠不靠谱)/u,
    reciprocity:
      /(?:互惠|来有回|双方怎样|双方如何|双方.{0,10}(?:一起|共同|回应|投入|各自)|彼此.{0,10}(?:回应|投入|各自))/u,
    relationship_boundary:
      /(?:边界|界限|底线|可说范围|不能接受|可以拒绝|拒绝.{0,8}(?:理由|解释)|证明理由)/u
  };

const ACTION_QUESTION_FOCUS_PATTERNS:
  Record<EventCenteredActionQuestionFocus, RegExp> = {
    tradeoff: /(?:取舍|权衡|两边|两端|兼顾|一边.{0,20}另一边|在.{1,20}和.{1,20}之间)/u,
    effective_condition:
      /(?:帮上.{0,3}忙|奏效|有效条件|起了作用|哪个环节.{0,8}作用|让.{0,16}推进|推进起来|反馈.{0,16}(?:有效|推进))/u,
    resistance:
      /(?:阻力|卡住|卡着|拖住|没敢|来不及|缺少|不够|难以推进|推进不了|哪一步.{0,8}难继续|难往下继续)/u,
    adjustable_part:
      /(?:(?:可以|能|可).{0,5}调整|调整的部分|调整哪|一小块|哪一块|哪一部分|能改变|哪.{0,8}(?:可以|能|可)改变)/u
  };

function normalizeQuestionFocusText(value: string | null | undefined) {
  return value?.replace(/\s+/gu, " ").trim() ?? "";
}

export function textMatchesEventCenteredQuestionFocus(input: {
  focus: EventCenteredResponseQuestionFocus;
  text: string | null | undefined;
}) {
  const text = normalizeQuestionFocusText(input.text);
  if (!text) return false;
  const relationshipPattern = RELATIONSHIP_QUESTION_FOCUS_PATTERNS[
    input.focus as EventCenteredRelationshipQuestionFocus
  ];
  if (relationshipPattern) return relationshipPattern.test(text);
  return ACTION_QUESTION_FOCUS_PATTERNS[
    input.focus as EventCenteredActionQuestionFocus
  ].test(text);
}

export function detectEventCenteredQuestionFocuses(input: {
  angle: JournalEventAngle | null;
  text: string | null | undefined;
}): EventCenteredResponseQuestionFocus[] {
  const text = normalizeQuestionFocusText(input.text);
  if (!text) return [];

  if (input.angle === "relationship") {
    return (Object.keys(RELATIONSHIP_QUESTION_FOCUS_PATTERNS) as
      EventCenteredRelationshipQuestionFocus[]).filter(
      (focus) => RELATIONSHIP_QUESTION_FOCUS_PATTERNS[focus].test(text)
    );
  }
  if (input.angle === "action") {
    return EVENT_CENTERED_ACTION_QUESTION_FOCUS_ORDER.filter(
      (focus) => ACTION_QUESTION_FOCUS_PATTERNS[focus].test(text)
    );
  }
  return [];
}

export function inferSingleEventCenteredQuestionFocus(input: {
  angle: JournalEventAngle | null;
  text: string | null | undefined;
}) {
  const focuses = detectEventCenteredQuestionFocuses(input);
  return focuses.length === 1 ? focuses[0] : null;
}

export function inspectEventCenteredQuestionFocusPreservation(input: {
  angle: JournalEventAngle | null;
  sourceQuestion: string | null | undefined;
  candidateQuestion: string | null | undefined;
}) {
  const expectedFocuses = detectEventCenteredQuestionFocuses({
    angle: input.angle,
    text: input.sourceQuestion
  });
  const candidateFocuses = detectEventCenteredQuestionFocuses({
    angle: input.angle,
    text: input.candidateQuestion
  });
  const expectedFocus = expectedFocuses.length === 1 ? expectedFocuses[0] : null;
  const candidateFocus = candidateFocuses.length === 1 ? candidateFocuses[0] : null;

  return {
    expectedFocus,
    candidateFocus,
    candidateFocuses,
    passed:
      expectedFocus === null ||
      (candidateFocuses.length === 1 && candidateFocus === expectedFocus)
  };
}
