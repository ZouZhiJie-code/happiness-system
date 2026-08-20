import type { IntentAssessmentV1 } from "@/features/interview/intent/intent-v1";

export const INTERVIEW_CONTROL_DECISION_VERSION =
  "2026-08-10.interview-control-decision-v2" as const;
export const INTERVIEW_INTENT_CLASSIFIER_VERSION_V2 =
  "2026-08-10.interview-intent-v2" as const;

export type InterviewControlActionV2 =
  | "stop_follow_up"
  | "generate_draft"
  | "repair_question"
  | "skip_question"
  | "switch_event"
  | "switch_dimension";

export type InterviewControlDecisionInput = {
  rawText: string;
  lastAssistantMessage: string | null;
  currentQuestionTarget: string | null;
  workingTaskRef: string | null;
  semanticState: unknown;
};

export type InterviewControlCandidateV2 = {
  action: InterviewControlActionV2;
  evidenceSpan: string;
  targetScope:
    | "current_interview"
    | "current_question"
    | "current_record"
    | "event_content"
    | "third_party"
    | "unknown";
  polarity: "affirmative" | "negative" | "uncertain";
  speechMode: "user_direct" | "reported" | "quoted";
  temporalScope: "active" | "past" | "revoked";
  effective: boolean;
  reasonCodes: string[];
};

export type InterviewControlDecisionV2 = {
  decisionVersion: typeof INTERVIEW_CONTROL_DECISION_VERSION;
  classifierVersion: typeof INTERVIEW_INTENT_CLASSIFIER_VERSION_V2;
  finalAction: InterviewControlActionV2 | "none";
  candidates: InterviewControlCandidateV2[];
  contentEvidenceText: string;
  reviewCandidate: boolean;
  programTakeover: boolean;
};

type CandidateMatch = {
  action: InterviewControlActionV2;
  start: number;
  end: number;
  text: string;
  defaultScope: InterviewControlCandidateV2["targetScope"];
  reasonCode: string;
};

const CONTROL_PATTERNS: ReadonlyArray<{
  action: InterviewControlActionV2;
  pattern: RegExp;
  scope: InterviewControlCandidateV2["targetScope"];
  reasonCode: string;
}> = [
  {
    action: "stop_follow_up",
    pattern:
      /(?:(?:我|我们|咱们)?(?:今天|这次|这轮|这一轮)?(?:就|想|先|就先|想先)?(?:到这(?:里|儿)?|说到这(?:里|儿)?|聊到这(?:里|儿)?|停在这(?:里|儿)?|停一停|暂停|停止|结束|告一段落|先这样|就这样)|(?:我)?(?:不聊了|不说了|不回答了|不继续了)|(?:我)?不想(?:再)?继续(?:聊|说|回答)?(?:了)?|(?:请|麻烦)?不要再(?:追问|问|深挖)|不用再问|别(?:再)?问)(?:吧|了|一下)?/gu,
    scope: "current_interview",
    reasonCode: "EXPLICIT_CURRENT_INTERVIEW_STOP"
  },
  {
    action: "stop_follow_up",
    pattern:
      /(?:(?:我|我们|咱们)?(?:今天|这次|这轮|这一轮)(?:就|想|先|就先|想先)?收尾|(?:我|我们|咱们)(?:就|想|先|就先|想先)收尾|(?:就|先|就先)收尾)(?:吧|了|一下)?/gu,
    scope: "current_interview",
    reasonCode: "EXPLICIT_CURRENT_INTERVIEW_STOP"
  },
  {
    action: "stop_follow_up",
    pattern:
      /(?:我)?不想再?(?:(?:跟|向|给)[^，。；！？!?]{0,12})?(?:解释|争辩|劝说|沟通)(?:了)?/gu,
    scope: "event_content",
    reasonCode: "EVENT_ACTION_STOP_ONLY"
  },
  {
    action: "generate_draft",
    pattern:
      /(?:(?:请|麻烦|帮我|先|现在|直接|就)?(?:生成|整理成|总结成|写成)(?:一篇|这篇|一份|个)?(?:日志|记录)|(?:把|将)[^，。；！？!?]{0,18}(?:整理成|总结成|写成)(?:一篇|这篇|一份|个)?(?:日志|记录))/gu,
    scope: "current_record",
    reasonCode: "EXPLICIT_GENERATE_REQUEST"
  },
  {
    action: "repair_question",
    pattern:
      /(?:这个问题)?(?:看不懂|听不懂|太抽象)|(?:请|麻烦)?(?:换个|换一个)(?:问法|问题|说法)|(?:说|问)简单(?:点|一点)/gu,
    scope: "current_question",
    reasonCode: "EXPLICIT_QUESTION_REPAIR"
  },
  {
    action: "skip_question",
    pattern:
      /(?:这个问题)?(?:我)?(?:不想|不方便|先不)(?:回答|说)|(?:请|先)?跳过(?:这个|当前)?(?:问题)?|先不聊这个/gu,
    scope: "current_question",
    reasonCode: "EXPLICIT_QUESTION_SKIP"
  },
  {
    action: "switch_event",
    pattern:
      /(?:换|切到|改聊)(?:一件|一个|个)?(?:别的|另一件|另一个|新的)?(?:事|事情|事件|话题)|聊(?:另一件|别的|新的)(?:事|事情|话题)/gu,
    scope: "current_record",
    reasonCode: "EXPLICIT_EVENT_SWITCH"
  },
  {
    action: "switch_dimension",
    pattern:
      /(?:换|切|转)(?:到|去)(?:开心|充实|思考|改进|感谢)(?:维度)?/gu,
    scope: "current_record",
    reasonCode: "EXPLICIT_DIMENSION_SWITCH"
  }
];

const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["“", "”"],
  ["‘", "’"],
  ["\"", "\""],
  ["'", "'"]
];

function normalizeText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function collectMatches(rawText: string) {
  const matches: CandidateMatch[] = [];
  for (const definition of CONTROL_PATTERNS) {
    for (const match of rawText.matchAll(definition.pattern)) {
      const text = match[0];
      if (!text) continue;
      const start = match.index ?? 0;
      matches.push({
        action: definition.action,
        start,
        end: start + text.length,
        text,
        defaultScope: definition.scope,
        reasonCode: definition.reasonCode
      });
    }
  }
  return matches.sort((left, right) => left.start - right.start || left.end - right.end);
}

function isInsideQuote(rawText: string, start: number, end: number) {
  return QUOTE_PAIRS.some(([opening, closing]) => {
    let cursor = 0;
    while (cursor < rawText.length) {
      const quoteStart = rawText.indexOf(opening, cursor);
      if (quoteStart < 0) return false;
      const quoteEnd = rawText.indexOf(closing, quoteStart + opening.length);
      if (quoteEnd < 0) return false;
      if (start >= quoteStart && end <= quoteEnd + closing.length) return true;
      cursor = quoteEnd + closing.length;
    }
    return false;
  });
}

function clausePrefix(rawText: string, start: number) {
  const boundary = Math.max(
    rawText.lastIndexOf("，", start - 1),
    rawText.lastIndexOf(",", start - 1),
    rawText.lastIndexOf("。", start - 1),
    rawText.lastIndexOf("；", start - 1),
    rawText.lastIndexOf(";", start - 1),
    rawText.lastIndexOf("！", start - 1),
    rawText.lastIndexOf("!", start - 1),
    rawText.lastIndexOf("？", start - 1),
    rawText.lastIndexOf("?", start - 1)
  );
  return rawText.slice(boundary + 1, start);
}

function speechModeFor(rawText: string, match: CandidateMatch) {
  if (isInsideQuote(rawText, match.start, match.end)) return "quoted" as const;
  const prefix = clausePrefix(rawText, match.start);
  if (
    /(?:她|他|妈妈|爸爸|奶奶|爷爷|老师|同事|朋友|家人|对方|别人)[^，。；！？!?]{0,10}(?:说|问|叫|让|要求|希望|提醒)(?:我|我们)?[^，。；！？!?]{0,8}$/u.test(
      prefix
    )
  ) {
    return "reported" as const;
  }
  return "user_direct" as const;
}

function polarityFor(rawText: string, match: CandidateMatch) {
  const prefix = clausePrefix(rawText, match.start);
  const immediate = `${prefix}${match.text}`.slice(-Math.max(24, match.text.length + 8));
  if (
    match.action === "stop_follow_up" &&
    /(?:(?:不是|并非|没有)不想[^，。；！？!?]{0,8}(?:聊|说|回答|继续)|(?:不是|并非|没有)不(?:聊|说|回答|继续))/u.test(
      immediate
    )
  ) {
    return "negative" as const;
  }
  if (
    (match.action === "generate_draft" ||
      match.action === "switch_event" ||
      match.action === "switch_dimension" ||
      match.action === "repair_question") &&
    /(?:不想|不要|不用|别|无需)[^，。；！？!?]{0,10}$/u.test(prefix)
  ) {
    return "negative" as const;
  }
  return "affirmative" as const;
}

function temporalScopeFor(rawText: string, match: CandidateMatch) {
  const suffix = rawText.slice(match.end);
  if (
    /^(?:[^。！？!?]{0,20})(?:算了|收回|当我没说|改主意|还是|不过|但是|但)?[^。！？!?]{0,12}(?:继续(?:问|聊|说)|还想继续|你可以继续)/u.test(
      suffix
    )
  ) {
    return "revoked" as const;
  }
  if (/(?:刚才|之前|上次|那时候)[^，。；！？!?]{0,10}$/u.test(clausePrefix(rawText, match.start))) {
    return "past" as const;
  }
  return "active" as const;
}

function removeControlSpans(
  rawText: string,
  matches: CandidateMatch[],
  candidates: InterviewControlCandidateV2[]
) {
  const removable = matches.filter((match, index) => {
    const candidate = candidates[index];
    return candidate?.effective ||
      (candidate?.speechMode === "user_direct" && candidate.temporalScope === "revoked");
  });
  let result = rawText;
  for (const match of [...removable].sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, match.start)} ${result.slice(match.end)}`;
  }
  return normalizeText(result)
    .replace(/^[，,。.!！；;、\s]+|[，,。.!！；;、\s]+$/gu, "")
    .replace(
      /^(?:(?:好|好的|好呀|好啊|嗯|嗯嗯|行|可以|明白了|知道了|很好|挺好|谢谢|谢谢你|多谢|辛苦了)[，,。.!！；;、\s]*)+$/u,
      ""
    )
    .replace(/^(?:算了|不过|但是|但)?[，,。.!！；;、\s]*(?:我)?(?:还想|想|可以)?继续(?:问我|问|聊|说)?(?:吧|了)?$/u, "")
    .trim();
}

function hasAmbiguousControlLanguage(rawText: string) {
  return /(?:好累|很累|累了|烦|费劲|压力大|重复|不想再[^，。；！？!?]{0,12}(?:解释|争辩|劝说|沟通)|继续问我|还想继续聊|换个角度想)/u.test(
    rawText
  );
}

export function decideInterviewControlV2(
  input: InterviewControlDecisionInput
): InterviewControlDecisionV2 {
  const rawText = normalizeText(input.rawText);
  const matches = collectMatches(rawText);
  const candidates = matches.map((match) => {
    const speechMode = speechModeFor(rawText, match);
    const polarity = polarityFor(rawText, match);
    const temporalScope = temporalScopeFor(rawText, match);
    const targetScope = speechMode === "user_direct"
      ? match.defaultScope
      : "third_party";
    const effective =
      speechMode === "user_direct" &&
      polarity === "affirmative" &&
      temporalScope === "active" &&
      targetScope !== "event_content" &&
      targetScope !== "third_party" &&
      targetScope !== "unknown";
    return {
      action: match.action,
      evidenceSpan: match.text,
      targetScope,
      polarity,
      speechMode,
      temporalScope,
      effective,
      reasonCodes: [
        match.reasonCode,
        `TARGET_${targetScope.toUpperCase()}`,
        `SPEECH_${speechMode.toUpperCase()}`,
        `POLARITY_${polarity.toUpperCase()}`,
        `TEMPORAL_${temporalScope.toUpperCase()}`
      ]
    } satisfies InterviewControlCandidateV2;
  });
  const effectiveCandidates = candidates.filter((candidate) => candidate.effective);
  const finalAction = effectiveCandidates.at(-1)?.action ?? "none";
  const contentEvidenceText = removeControlSpans(rawText, matches, candidates);
  return {
    decisionVersion: INTERVIEW_CONTROL_DECISION_VERSION,
    classifierVersion: INTERVIEW_INTENT_CLASSIFIER_VERSION_V2,
    finalAction,
    candidates,
    contentEvidenceText,
    reviewCandidate:
      candidates.length > 0 || hasAmbiguousControlLanguage(rawText),
    programTakeover: finalAction !== "none"
  };
}

export function assessExplicitStopFromControlDecision(
  decision: InterviewControlDecisionV2
) {
  if (decision.finalAction !== "stop_follow_up") return "none" as const;
  return decision.contentEvidenceText ? ("mixed" as const) : ("pure" as const);
}

function referenceTargetFor(
  action: InterviewControlDecisionV2["finalAction"],
  fallback: IntentAssessmentV1["referenceTarget"]
) {
  if (action === "stop_follow_up") return "session" as const;
  if (action === "generate_draft") return "journal" as const;
  if (action === "repair_question" || action === "skip_question") {
    return "current_question" as const;
  }
  if (action === "switch_event") return "current_event" as const;
  if (action === "switch_dimension") return "dimension" as const;
  return fallback === "session" || fallback === "journal" || fallback === "dimension"
    ? ("unclear" as const)
    : fallback;
}

export function reconcileIntentAssessmentWithControlDecisionV2(input: {
  assessment: IntentAssessmentV1;
  decision: InterviewControlDecisionV2;
}): IntentAssessmentV1 {
  if (!input.decision.reviewCandidate && !input.decision.programTakeover) {
    return input.assessment;
  }
  const contentEvidenceText = input.decision.contentEvidenceText || null;
  const contentPresence = contentEvidenceText
    ? contentEvidenceText.length > 3
      ? "clear"
      : "possible"
    : "none";
  const effectiveSignals = [
    ...new Set(
      input.decision.candidates
        .filter((candidate) => candidate.effective)
        .map((candidate) => candidate.action)
    )
  ];
  const dialogueActs: IntentAssessmentV1["dialogueActs"] = [
    ...input.assessment.dialogueActs.filter(
      (act) => act !== "provide_content"
    )
  ];
  if (contentPresence !== "none") dialogueActs.unshift("provide_content");
  return {
    ...input.assessment,
    primaryControl: input.decision.finalAction,
    controlSignals: effectiveSignals,
    dialogueActs: [...new Set(dialogueActs)],
    content: {
      ...input.assessment.content,
      presence: contentPresence,
      evidenceText: contentEvidenceText,
      answeredTarget:
        contentPresence === "clear"
          ? input.assessment.content.answeredTarget
          : null
    },
    referenceTarget: referenceTargetFor(
      input.decision.finalAction,
      input.assessment.referenceTarget
    ),
    confidence: 0.99,
    origin: "deterministic",
    reasonCodes: [
      ...new Set([
        ...input.assessment.reasonCodes.filter(
          (code) =>
            code !== "explicit_stop_request" && code !== "fatigue_feedback"
        ),
        `control_decision:${INTERVIEW_CONTROL_DECISION_VERSION}`,
        `intent_classifier:${INTERVIEW_INTENT_CLASSIFIER_VERSION_V2}`,
        ...input.decision.candidates.flatMap((candidate) => candidate.reasonCodes)
      ])
    ]
  };
}
