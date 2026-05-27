import type {
  AssistantQuestionSpec,
  InterviewDimension,
  JoySnapshot
} from "@/types/interview";

const FORBIDDEN_THEORY_TERMS = /(判断依据|判断线索|视角变化|稳定公式|方法论)/u;
const CROSS_CATEGORY_COMPARE_PATTERN =
  /(?:(?:冲动|状态).{0,12}(?:同一种|一样|同一类)|(?:感受|动作结果).{0,12}(?:同一种|一样|同一类)|(?:冲动.{0,8}状态|状态.{0,8}冲动|感受.{0,8}动作结果|动作结果.{0,8}感受))/u;
const MULTI_HOP_PATTERN =
  /(?:(?:怎么理解|为什么).{0,24}(?:所以|因此|又|还)|(?:是不是|算不算).{0,18}(?:同一种|一样|同一类))/u;
const CONCRETE_ANCHOR_CUES = /(具体|反应|念头|画面|细节|瞬间|哪一下|哪一幕|信号)/u;
const ABSTRACT_LEAD_PATTERN =
  /^(?:回头看[^。！？?]*?(?:进展|成长))?[，,]?(?:什么样的(?:投入|努力)|如果只留一句最算数的标准|(?:先看|看)哪个更具体的(?:反应|信号))/u;
const MULTI_COGNITIVE_ACTION_PATTERN =
  /(?:会先看.+提醒自己|哪个瞬间.+而不是|哪个瞬间.+比.+更|比较哪两个选项|闪过什么念头或画面.+才让你决定)/u;
const NOT_EXAMPLE_ANSWERABLE_PATTERN =
  /(?:什么样的内容或场景节奏|什么样的投入|什么样的努力|(?:先看|看)哪个更具体的(?:反应|信号))/u;
const EXAMPLE_SHAPE_CUES =
  /(哪一下|哪一幕|哪一点|哪句|哪一步|哪个瞬间|最直接|最打动|最想记住|具体的|先试哪一步|先抓住哪一点)/u;

export type ComprehensionGateReasonCode =
  | "forbidden_theory_term"
  | "cross_category_compare"
  | "multi_hop_reasoning"
  | "reflection_missing_concrete_anchor"
  | "abstract_lead_phrasing"
  | "multi_cognitive_actions"
  | "weak_anchor"
  | "not_example_answerable";

export type ComprehensionGateDowngradeRecommendation =
  | "rewrite_with_user_words"
  | "narrow_to_single_action"
  | "add_concrete_anchor"
  | "rewrite_as_example_first";

export interface ComprehensionGateResult {
  pass: boolean;
  reasonCodes: ComprehensionGateReasonCode[];
  downgradeRecommendation: ComprehensionGateDowngradeRecommendation | null;
}

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeAnchorToken(value: string) {
  return value
    .replace(/[“”"'（）()【】\[\]《》]/gu, "")
    .replace(/\s+/g, "")
    .trim();
}

function hasStrongAnchor(question: string, spec: AssistantQuestionSpec) {
  const anchorText = normalizeText(spec.anchorText);

  if (!anchorText || spec.target === "event_anchor") {
    return true;
  }

  if (
    question.includes(`回到“${anchorText}”`) ||
    question.includes(`说到“${anchorText}”`) ||
    question.includes(`在“${anchorText}”`) ||
    question.includes(`“${anchorText}”`)
  ) {
    return true;
  }

  const compactAnchor = normalizeAnchorToken(anchorText);

  if (compactAnchor && normalizeAnchorToken(question).includes(compactAnchor)) {
    return true;
  }

  if (/回头看“[^”]+”|回头看'[^']+'|回头看“[^”]+”这层进展/u.test(question)) {
    return true;
  }

  return false;
}

function needsStrongAnchor(spec: AssistantQuestionSpec) {
  return (
    spec.target === "judgment_clue" ||
    spec.target === "insight_evidence" ||
    spec.stageIntent === "repair"
  );
}

function collectReasonCodes(input: {
  dimension: InterviewDimension;
  question: string;
  spec: AssistantQuestionSpec;
  snapshot: JoySnapshot;
}) {
  const reasonCodes: ComprehensionGateReasonCode[] = [];
  const normalizedQuestion = normalizeText(input.question);

  if (!normalizedQuestion) {
    return ["weak_anchor", "not_example_answerable"] satisfies ComprehensionGateReasonCode[];
  }

  if (FORBIDDEN_THEORY_TERMS.test(normalizedQuestion)) {
    reasonCodes.push("forbidden_theory_term");
  }

  if (CROSS_CATEGORY_COMPARE_PATTERN.test(normalizedQuestion)) {
    reasonCodes.push("cross_category_compare");
  }

  if (MULTI_HOP_PATTERN.test(normalizedQuestion)) {
    reasonCodes.push("multi_hop_reasoning");
  }

  if (
    input.dimension === "reflection" &&
    input.spec.target !== "prior_assumption" &&
    input.spec.target !== "judgment_clue" &&
    !CONCRETE_ANCHOR_CUES.test(normalizedQuestion)
  ) {
    reasonCodes.push("reflection_missing_concrete_anchor");
  }

  if (ABSTRACT_LEAD_PATTERN.test(normalizedQuestion)) {
    reasonCodes.push("abstract_lead_phrasing");
  }

  if (MULTI_COGNITIVE_ACTION_PATTERN.test(normalizedQuestion)) {
    reasonCodes.push("multi_cognitive_actions");
  }

  if (needsStrongAnchor(input.spec) && !hasStrongAnchor(normalizedQuestion, input.spec)) {
    reasonCodes.push("weak_anchor");
  }

  if (
    NOT_EXAMPLE_ANSWERABLE_PATTERN.test(normalizedQuestion) &&
    !EXAMPLE_SHAPE_CUES.test(normalizedQuestion)
  ) {
    reasonCodes.push("not_example_answerable");
  }

  return reasonCodes;
}

function dedupeReasonCodes(reasonCodes: ComprehensionGateReasonCode[]) {
  return [...new Set(reasonCodes)];
}

function chooseDowngradeRecommendation(reasonCodes: ComprehensionGateReasonCode[]) {
  if (reasonCodes.includes("forbidden_theory_term")) {
    return "rewrite_with_user_words" as const;
  }

  if (
    reasonCodes.includes("multi_cognitive_actions") ||
    reasonCodes.includes("multi_hop_reasoning") ||
    reasonCodes.includes("cross_category_compare")
  ) {
    return "narrow_to_single_action" as const;
  }

  if (reasonCodes.includes("abstract_lead_phrasing")) {
    return "rewrite_with_user_words" as const;
  }

  if (reasonCodes.includes("not_example_answerable")) {
    return "rewrite_as_example_first" as const;
  }

  if (
    reasonCodes.includes("weak_anchor") ||
    reasonCodes.includes("reflection_missing_concrete_anchor")
  ) {
    return "add_concrete_anchor" as const;
  }

  return null;
}

export function evaluateQuestionComprehension(input: {
  dimension: InterviewDimension;
  question: string | null | undefined;
  spec: AssistantQuestionSpec;
  snapshot: JoySnapshot;
}): ComprehensionGateResult {
  const normalizedQuestion = normalizeText(input.question);
  const reasonCodes = dedupeReasonCodes(
    collectReasonCodes({
      dimension: input.dimension,
      question: normalizedQuestion,
      spec: input.spec,
      snapshot: input.snapshot
    })
  );

  return {
    pass: reasonCodes.length === 0,
    reasonCodes,
    downgradeRecommendation: chooseDowngradeRecommendation(reasonCodes)
  };
}
