import { z } from "zod";

import type { AssistantQuestionSpec } from "@/types/interview";

export const INTERVIEW_INTENT_CLASSIFIER_VERSION = "interview-intent-v1" as const;
export const INTERVIEW_TURN_POLICY_VERSION = "interview-turn-policy-v1" as const;

export const interviewControlIntentSchema = z.enum([
  "none",
  "generate_draft",
  "stop_follow_up",
  "repair_question",
  "skip_question",
  "switch_event",
  "switch_dimension"
]);

export const interviewDialogueActSchema = z.enum([
  "provide_content",
  "supplement",
  "correct_previous",
  "deny_hypothesis",
  "express_uncertainty",
  "decline_answer",
  "give_feedback"
]);

export const interviewAnsweredTargetSchema = z.enum([
  "event_anchor",
  "prior_assumption",
  "reaction_evidence",
  "insight_evidence",
  "judgment_clue",
  "kind_action",
  "seen_need",
  "gratitude_reason",
  "relationship_signal",
  "current_question"
]);

export const intentAssessmentV1Schema = z
  .object({
    version: z.literal(INTERVIEW_INTENT_CLASSIFIER_VERSION),
    primaryControl: interviewControlIntentSchema,
    controlSignals: z.array(interviewControlIntentSchema).max(7),
    dialogueActs: z.array(interviewDialogueActSchema).max(7),
    content: z
      .object({
        presence: z.enum(["none", "possible", "clear"]),
        evidenceText: z.string().nullable(),
        explicitAbsence: z.boolean(),
        answeredTarget: interviewAnsweredTargetSchema.nullable()
      })
      .strict(),
    referenceTarget: z.enum([
      "current_question",
      "previous_interpretation",
      "current_event",
      "session",
      "journal",
      "dimension",
      "quoted_event",
      "unclear"
    ]),
    frustration: z.enum(["none", "mild", "strong"]),
    confidence: z.number().min(0).max(1),
    origin: z.enum(["deterministic", "llm", "hybrid", "fallback"]),
    reasonCodes: z.array(z.string().min(1).max(80)).max(16)
  })
  .strict();

export const turnDecisionV1Schema = z
  .object({
    version: z.literal(INTERVIEW_TURN_POLICY_VERSION),
    runExtraction: z.boolean(),
    advanceTurn: z.boolean(),
    advanceRound: z.boolean(),
    stopFollowUp: z.boolean(),
    nextAction: z.enum([
      "continue_interview",
      "repair_question",
      "offer_low_pressure_choice",
      "validate_and_wrap_up",
      "switch_event",
      "switch_dimension"
    ]),
    nextQuestionStyle: z.enum(["normal", "simplified", "new_angle"])
  })
  .strict();

export type InterviewControlIntent = z.infer<typeof interviewControlIntentSchema>;
export type InterviewDialogueAct = z.infer<typeof interviewDialogueActSchema>;
export type IntentAssessmentV1 = z.infer<typeof intentAssessmentV1Schema>;
export type TurnDecisionV1 = z.infer<typeof turnDecisionV1Schema>;

export interface IntentAssessmentContext {
  rawText: string;
  lastAssistantQuestion?: string | null;
  questionSpec?: AssistantQuestionSpec | null;
}

export type LegacyUserTurnIntent =
  | "content"
  | "low_signal"
  | "conversation_feedback"
  | "question_repair"
  | "hypothesis_denial"
  | "draft_request"
  | "boundary_stop"
  | "hostile_boundary";

export interface LegacyUserTurnAssessment {
  normalizedMessage: string;
  isMeaningful: boolean;
  intent: LegacyUserTurnIntent;
  shouldExtractSnapshot: boolean;
  shouldAdvanceTurn: boolean;
  shouldAdvanceRound: boolean;
  repairSignal: "rephrase" | "simplify" | "switch_angle" | null;
}

type MatchedControl = {
  control: Exclude<InterviewControlIntent, "none">;
  start: number;
  end: number;
  text: string;
  reasonCode: string;
};

const DRAFT_REQUEST_PATTERN =
  /(直接生成(?:一下)?(?:日志)?(?:吧|了)?|先生成日志|生成一下日志|生成日志(?:吧|了)?|帮我生成(?:一下)?日志|(?:现在)?帮我成稿(?:吧|了)?|可以(?:写日志|整理(?:成日志)?|成稿)(?:吧|了)?|(?:麻烦|请)?把(?:这些|前面这些|前面的内容|刚才的内容|以上|它)(?:内容)?(?:整理|收|汇总|做|写)(?:成|为|下来)(?:一篇|一份|一版|个)?(?:日志|记录|文字|稿子)?(?:吧|了)?|(?:就)?按这些出(?:一篇|一份|个)?(?:日志|记录)(?:吧|了)?|帮我(?:写下来|收成一篇)(?:吧|了)?|(?:给我|帮我|麻烦)(?:整理|写|收|汇总)(?:成|为)(?:一篇|一份|一版)?(?:日志|记录|文字|稿子)(?:吧|了)?|(?:整理|写|收)(?:成|为)(?:一篇|一份|一版)?(?:日志|记录|文字|稿子)(?:吧|就好)|现在可以(?:整理|汇总|生成)(?:了|吧)|直接整理(?:日志)?(?:吧|了)?|先整理日志|整理日志(?:吧|了)?|整理成日志(?:吧|了)?|写成日志|(?:帮我)?出(?:一篇|一份|个)?日志|总结成日志吧|总结成日志|总结日志|帮我(?:总结|整理)(?:一下)?(?:成日志|日志)?)/gu;
const BOUNDARY_PATTERN =
  /(不要再(?:追问|问|深挖|纠结)(?:了)?|(?:先)?别(?:再)?(?:追问|问)了|不想(?:再)?(?:继续|深挖|聊了|说了|回答)|已经(?:讲|说)得很具体|先这样|就这样吧|先到这|(?:今天|这次|这轮|这一轮)?(?:我)?(?:就)?先停在(?:这里|这儿|这)(?:吧|了)?|(?:这轮|这一轮|这次)?先打住(?:吧|了)?|(?:我想)?(?:这轮|这次|今天)?(?:想|就)?先?(?:说到|聊到)(?:这里|这儿)(?:[，,]先休息(?:了|一下)?)?|(?:我)?(?:这轮|这次|今天)?(?:想|就)?先(?:说到|聊到|收尾|停一停|缓到)(?:这里|这儿)?(?:吧|了)?|(?:咱们)?先暂停在(?:这里|这儿)(?:吧|了)?|到此为止|(?:这轮|这次|今天)?(?:就)?先(?:聊|说)(?:这些|这么多)(?:吧|了)?|(?:这次|今天)?先告一段落(?:吧|了)?|(?:这轮|这次|今天)?(?:就)?(?:到这儿|聊到这里)(?:吧|了)?|想先收一收|不用(?:再)?问(?:了)?|没必要(?:再)?问|够了|(?:结束|停止|停下|退出)(?:这个|当前|本次|这次)?(?:维度|访谈|对话|话题)?(?:吧|了)?)/gu;
const REPAIR_PATTERN =
  /(看不懂|没看懂|没听懂|什么意思|啥意思|太抽象|太绕(?:了)?|换个问法|换种说法|换个说法|(?:你能)?换成(?:生活里|日常|更具体|更简单)的?说法(?:吗)?|(?:这句|这个问题)(?:能|可以)换成我(?:更)?容易回答的(?:方式|问法)(?:吗)?|能不能改成(?:更)?(?:好懂|容易懂|简单|具体)的?(?:问题|问法|说法)|说简单点|简单点说|简单点|说白一点|说直白点|听不太懂|听不懂|问题太抽象|这个问题太抽象|(?:这个|这道)?问题(?:能|可以)(?:再)?问得(?:更)?(?:具体|落地)(?:一点|些)?(?:吗)?|(?:这个问题)?(?:能|可以)?(?:再)?(?:问得具体|落地)(?:一点|些)(?:吗)?)/gu;
const SKIP_PATTERN =
  /(跳过(?:这个问题)?(?:吧)?|这个(?:问题)?不想说|先不说这个|这个问题我不太想碰|(?:这一题|这个问题)我先放着|关于(?:这一题|这个问题)我想先略过|(?:这一问|这题|这一个)(?:暂时|暂且|先)(?:过掉|放过|越过去)(?:吧)?|先把(?:这一问|这题|这个问题)放一边|(?:这块|这部分)先(?:留白|搁着)(?:可以吗|吧)?|换个问题|换个角度)/gu;
const SWITCH_EVENT_PATTERN =
  /((?:我想)?(?:换一件事|换一个片段|说另一件事|下一个片段)|还有另一件事|我还想讲个别的片段|换个事情讲(?:吧)?|先翻到(?:另外一个|另一个|别的)(?:一件)?事情(?:吧)?|(?:我们)?换到(?:下一件|另一件|另外一件)事情)/gu;
const SWITCH_DIMENSION_PATTERN =
  /((?:这个|这件事|这段)?(?:切到|换到|转到|更像)(开心|充实|思考|改进|感谢)(?:维度)?|(?:我觉得)?(?:该|应该|想)?记在(?:开心|充实|思考|改进|感谢)(?:维度)?里|(?:这个|这件事|这段)?放到(?:开心|充实|思考|改进|感谢)(?:维度)?那边更合适|(?:这一段|这件事|这段)(?:更适合)(?:放进|归到)(?:开心|充实|思考|改进|感谢)(?:维度)?|我想把(?:它|这件事|这段)?归到(?:开心|充实|思考|改进|感谢)(?:维度)?|(?:这个|这件事|这段)(?:应该|可以)?归在(?:开心|充实|思考|改进|感谢)(?:维度)?)/gu;
const HOSTILE_PATTERN =
  /(烦不烦|别烦我(?:了)?|别(?:再)?逼(?:着)?我(?:继续)?(?:想|答|回答)(?:了)?|别再追着问|别揪着我问个没完|有病|傻逼|滚|闭嘴|废话|神经病|妈的|他妈|卧槽|我操|操(?:你|他|这|$)|草(?:泥马|你妈|$)|你(?:到底)?在说什么|到底在问什么|这问的什么(?:东西)?|问的什么东西)/u;
const FEEDBACK_PATTERN =
  /((?:问题|问法|提问|访谈|产品|设计).*(?:难懂|看不懂|听不懂|重复|反复|一样|单一|绕|抽象|有问题|不合理|奇怪|糟糕|不好)|(?:一直|总是|反复).*(?:问|追问).*(?:一样|同一个|重复)|(?:只会|来回)(?:问|追问)|(?:中文|人话).*(?:说|问))/u;
const REPEATED_QUESTION_FEEDBACK_PATTERN =
  /(重复|一样|同一(?:个|件事|问题|块)|反复|一直问|总是问|来回问|问过|又在问|第三次问|又绕回.*问题|这个方向.*(?:聊过|说过|问过)|(?:这块|这部分|这个).*(?:前面|刚才).*(?:聊过|说过|问过|提过))/u;
const FATIGUE_FEEDBACK_PATTERN =
  /((?:有点|有些|挺|很)?累(?:了)?|状态不太行|脑子.*转不动|有点接不住|精力见底|没什么力气继续|想先收一收|想先停一停|先缓到这里|先歇会儿|不想(?:再)?(?:聊|想这么多|回答))/u;
const QUESTION_DISCOMFORT_PATTERN =
  /(?:这个|这道)?(?:问题|问法).*(?:不舒服|有(?:点|些)?压力|让我累|让我难受)/u;
const FORCED_ANSWER_FEEDBACK_PATTERN =
  /(?:逼(?:着)?|强迫|非要)(?:我)?(?:继续)?(?:回答|答|说|想)/u;
const CORRECTION_PATTERN =
  /(刚才说错了|前面说错了|我改一下|更准确地说|应该说|其实是|你理解错了|理解偏了)/u;
const CAUSAL_CORRECTION_PATTERN =
  /^(?:这|那)?不是(?:因为)?.+[，,。；;]?是(?:因为)?/u;
const COMPARATIVE_CORRECTION_PATTERN = /与其说是.+[，,。；;]?更像是/u;
const INACCURATE_CORRECTION_PATTERN =
  /(?:说|讲)(?:是)?[^，,。；;]+(?:不太|不够)?准确[，,。；;]+其实是/u;
const WORDING_CORRECTION_PATTERN =
  /(?:这个)?说法(?:偏了|不对|不准确)[，,。；;]+(?:我更多是|其实是|应该是)/u;
const FIT_CORRECTION_PATTERN =
  /[^，,。；;]+(?:不太|不够)?贴切[，,。；;]+(?:准确说是|更准确是|其实是)/u;
const WITHDRAW_CORRECTION_PATTERN =
  /我收回(?:刚才|前面)?(?:那个|这个)?(?:判断|说法)[，,。；;]+(?:实际是|其实是|应该是)/u;
const DENIAL_PATTERN =
  /^(真|确实|的确|真的|压根儿?|完全)?(没有|没|不是|并没有|没有过|不算|并不是)(?:[，,。！？!?]|$)|没有关联|不是因为这个|不是这个意思|不是这层|不是因为这个原因/u;
const UNCERTAINTY_PATTERN =
  /(不知道|不确定|不能确定|说不上来|说不准|拿不准|不好判断|判断不了|还难说|可能|大概|也许|算是)/u;
const INCOMPLETE_UTTERANCE_PATTERN = /(?:我觉得就是|我想说的是|可能就是|应该就是|大概就是)[，,、：:….\s]*$/u;
const GENERIC_FILLER_PATTERN = /^(嗯+|哦+|啊+|好(?:的)?|行|ok|okay|随便)$/iu;
const EXPLICIT_ANSWER_FRAME_PATTERN =
  /(?:核心|关键|真正(?:打动我|重要的地方)|最重要的地方|(?:我)?最在意的(?:地方)?|真正(?:让我)?觉得(?:今天)?没白(?:过|费)的)(?:就)?是|(?:我下次|下次我|接下来我|我准备|我会先)/u;
const THIRD_PARTY_REPORTING_PATTERN =
  /(?:他|她|同事|朋友|家人|妈妈|爸爸|领导|老师|对方|那个人)(?:当时|后来|还|就|又|突然|特意|直接|也)?(?:跟我|对我|冲我|和我|让我)?(?:说(?!错|不上|不清)|问(?!题)|骂|告诉|回复|回了句|讲)/u;
const FIRST_PERSON_REPORTING_PATTERN =
  /我(?:当时|后来|还|就|又|直接)?(?:(?:说|问|告诉|回复|回了句|讲)(?:他|她|对方|同事|朋友|家人|妈妈|爸爸|领导|老师)|(?:说|问)[“"「『])/u;
const QUOTED_PATTERN =
  /[“”"'「」『』].*(有病|什么意思|结束|别问|不用再问|停下|停止|滚|闭嘴).*[“”"'「」『』]/u;

function normalizeText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function collectMatches(
  rawText: string,
  pattern: RegExp,
  control: MatchedControl["control"],
  reasonCode: string
): MatchedControl[] {
  pattern.lastIndex = 0;
  return Array.from(rawText.matchAll(pattern)).map((match) => ({
    control,
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: match[0],
    reasonCode
  }));
}

function removeMatchedControls(rawText: string, matches: MatchedControl[]) {
  if (!matches.length) {
    return normalizeText(rawText);
  }

  const characters = rawText.split("");
  for (const match of matches) {
    for (let index = match.start; index < match.end; index += 1) {
      characters[index] = " ";
    }
  }

  const evidenceText = normalizeText(characters.join(""))
    .replace(/^[，,。；;、\s]+|[，,。；;、\s]+$/gu, "")
    .replace(/^(?:那|然后|所以|不过|但是|并且|还有)[，,\s]*/u, "")
    .replace(/[，,]\s*(?:吧|了)$/u, "")
    .trim();
  const residue = evidenceText.replace(/[，,。；;、！？!?\s]/gu, "");

  if (
    matches.length > 0 &&
    /^(?:(?:先|这个|当前|请|麻烦|吧|了|呢|呀|啊|说|简单点|简单一点|我想|我想要|我希望))+$/u.test(
      residue
    )
  ) {
    return "";
  }

  return evidenceText;
}

function isQuotedOrReportedEvent(rawText: string) {
  return (
    QUOTED_PATTERN.test(rawText) ||
    (
      (THIRD_PARTY_REPORTING_PATTERN.test(rawText) ||
        FIRST_PERSON_REPORTING_PATTERN.test(rawText)) &&
      !/(我(?:想)?问你|你(?:到底)?(?:在说|问)什么|你.*什么意思)/u.test(rawText)
    )
  );
}

function isInsideQuotedText(rawText: string, match: MatchedControl) {
  const quotePattern = /[“"「『][^”"」』]*[”"」』]/gu;
  return Array.from(rawText.matchAll(quotePattern)).some((quotedMatch) => {
    const start = quotedMatch.index ?? 0;
    const end = start + quotedMatch[0].length;
    return match.start >= start && match.end <= end;
  });
}

function isInsideThirdPartyReportedSpeech(rawText: string, match: MatchedControl) {
  const reportingMatch = rawText.match(THIRD_PARTY_REPORTING_PATTERN);
  if (!reportingMatch) {
    return false;
  }

  const reportingEnd = (reportingMatch.index ?? 0) + reportingMatch[0].length;
  if (match.start < reportingEnd) {
    return false;
  }

  const transition = rawText.slice(reportingEnd, match.start);
  return !/(?:我想|我希望|我需要|我决定|那就|现在|接下来)[^，。；;]{0,8}$/u.test(
    transition
  );
}

function isContextualShortAnswer(input: IntentAssessmentContext, normalized: string) {
  if (!normalized || normalized.length > 8 || GENERIC_FILLER_PATTERN.test(normalized)) {
    return false;
  }

  const question = normalizeText(input.lastAssistantQuestion ?? "");
  const hasQuestionContext = Boolean(input.questionSpec || question);

  if (!hasQuestionContext) {
    return false;
  }

  if (DENIAL_PATTERN.test(normalized) || /^(有|算是|是的|对|不算|不是)$/u.test(normalized)) {
    return true;
  }

  if (/(谁|哪个人|什么人|对象)/u.test(question)) {
    return /^[\p{L}\p{N}·]{2,8}$/u.test(normalized);
  }

  if (/(感觉|感受|心里|状态|情绪)/u.test(question)) {
    return /^[\p{L}]{2,8}$/u.test(normalized);
  }

  return Boolean(input.questionSpec && /^[\p{L}\p{N}·]{2,8}$/u.test(normalized));
}

function choosePrimaryControl(signals: InterviewControlIntent[]): InterviewControlIntent {
  const order: InterviewControlIntent[] = [
    "generate_draft",
    "stop_follow_up",
    "repair_question",
    "skip_question",
    "switch_event",
    "switch_dimension"
  ];
  return order.find((control) => signals.includes(control)) ?? "none";
}

function getAnsweredTarget(input: IntentAssessmentContext) {
  return input.questionSpec?.subTarget ?? input.questionSpec?.target ?? null;
}

export function assessUserTurnIntent(input: IntentAssessmentContext): IntentAssessmentV1 {
  const normalized = normalizeText(input.rawText);
  const quotedOrReported = isQuotedOrReportedEvent(normalized);
  const matches: MatchedControl[] = [
    ...collectMatches(normalized, DRAFT_REQUEST_PATTERN, "generate_draft", "explicit_generate_request"),
    ...collectMatches(normalized, BOUNDARY_PATTERN, "stop_follow_up", "explicit_stop_request"),
    ...collectMatches(normalized, REPAIR_PATTERN, "repair_question", "explicit_repair_request"),
    ...collectMatches(normalized, SKIP_PATTERN, "skip_question", "explicit_skip_request"),
    ...collectMatches(normalized, SWITCH_EVENT_PATTERN, "switch_event", "explicit_event_switch"),
    ...collectMatches(normalized, SWITCH_DIMENSION_PATTERN, "switch_dimension", "explicit_dimension_switch")
  ];

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    if (
      match?.control === "stop_follow_up" &&
      /^(结束|停止|停下|退出)(?:吧|了)?$/u.test(match.text) &&
      !/^(?:请)?(?:结束|停止|停下|退出)(?:吧|了)?$/u.test(normalized)
    ) {
      matches.splice(index, 1);
    }
  }

  if (quotedOrReported) {
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index];
      if (
        match &&
        (
          isInsideQuotedText(normalized, match) ||
          isInsideThirdPartyReportedSpeech(normalized, match) ||
          (match.control === "repair_question" && /什么意思/u.test(match.text))
        )
      ) {
        matches.splice(index, 1);
      }
    }
  }

  const hostileMatches = quotedOrReported
    ? []
    : Array.from(normalized.matchAll(new RegExp(HOSTILE_PATTERN.source, "gu")));
  const directHostility = hostileMatches.length > 0;
  if (directHostility) {
    for (const hostileMatch of hostileMatches) {
      if (!hostileMatch[0]) continue;
      const start = hostileMatch.index ?? 0;
      const end = start + hostileMatch[0].length;
      if (
        !matches.some(
          (match) =>
            match.control === "stop_follow_up" &&
            match.start === start &&
            match.end === end
        )
      ) {
        matches.push({
          control: "stop_follow_up",
          start,
          end,
          text: hostileMatch[0],
          reasonCode: "direct_hostility"
        });
      }
    }
  }

  let evidenceText = removeMatchedControls(normalized, matches);
  if (
    directHostility &&
    /^(?:你|你吧|你呢|吧|了)$/u.test(evidenceText.replace(/\s+/gu, ""))
  ) {
    evidenceText = "";
  }
  const hasExplicitRepair = matches.some((match) => match.control === "repair_question");
  const hasExplicitStop = matches.some(
    (match) => match.control === "stop_follow_up"
  );
  const hasRepeatedQuestionFeedback = REPEATED_QUESTION_FEEDBACK_PATTERN.test(normalized);
  const hasFatigueFeedback =
    FATIGUE_FEEDBACK_PATTERN.test(normalized) ||
    (hasExplicitStop && /(?:压力(?:有点|有些|挺|很)?大|(?:有点|有些|挺|很)压力)/u.test(normalized));
  const hasForcedAnswerFeedback = FORCED_ANSWER_FEEDBACK_PATTERN.test(normalized);
  const hasConversationFeedback =
    directHostility ||
    (FEEDBACK_PATTERN.test(normalized) && (!hasExplicitRepair || hasRepeatedQuestionFeedback)) ||
    hasRepeatedQuestionFeedback ||
    hasFatigueFeedback ||
    hasForcedAnswerFeedback ||
    QUESTION_DISCOMFORT_PATTERN.test(normalized);
  if (hasConversationFeedback) {
    const mixedFeedbackContent = normalized.match(
      /(?:其实|不过|但是|但我|我的回答是|我想说的是)[，,\s]*(.+)$/u
    )?.[1];
    evidenceText = normalizeText(mixedFeedbackContent ?? "");
  }
  const explicitAbsence = DENIAL_PATTERN.test(normalized);
  const correctsPrevious =
    CORRECTION_PATTERN.test(normalized) ||
    CAUSAL_CORRECTION_PATTERN.test(normalized) ||
    COMPARATIVE_CORRECTION_PATTERN.test(normalized) ||
    INACCURATE_CORRECTION_PATTERN.test(normalized) ||
    WORDING_CORRECTION_PATTERN.test(normalized) ||
    FIT_CORRECTION_PATTERN.test(normalized) ||
    WITHDRAW_CORRECTION_PATTERN.test(normalized);
  const contextualShortAnswer = isContextualShortAnswer(input, normalized);
  const hasExplicitAnswerFrame = EXPLICIT_ANSWER_FRAME_PATTERN.test(evidenceText || normalized);
  const incomplete = INCOMPLETE_UTTERANCE_PATTERN.test(normalized);
  const genericFiller = GENERIC_FILLER_PATTERN.test(normalized);
  const controlSignals = unique(matches.map((match) => match.control));
  const dialogueActs: InterviewDialogueAct[] = [];

  if (evidenceText && !genericFiller && !incomplete) {
    dialogueActs.push("provide_content");
  }
  if (correctsPrevious) {
    dialogueActs.push("correct_previous");
  }
  if (
    (
      DENIAL_PATTERN.test(normalized) ||
      CORRECTION_PATTERN.test(normalized) ||
      CAUSAL_CORRECTION_PATTERN.test(normalized) ||
      COMPARATIVE_CORRECTION_PATTERN.test(normalized) ||
      INACCURATE_CORRECTION_PATTERN.test(normalized) ||
      WORDING_CORRECTION_PATTERN.test(normalized) ||
      FIT_CORRECTION_PATTERN.test(normalized) ||
      WITHDRAW_CORRECTION_PATTERN.test(normalized)
    ) &&
    (Boolean(input.questionSpec?.hypothesisKey) ||
      Boolean(input.questionSpec?.subTarget) ||
      /(是不是|有没有|是否|会不会|吗[？?]?$)/u.test(input.lastAssistantQuestion ?? ""))
  ) {
    dialogueActs.push("deny_hypothesis");
  }
  if (UNCERTAINTY_PATTERN.test(normalized)) {
    dialogueActs.push("express_uncertainty");
  }
  if (/(不想说|不方便说|不太想碰|先不说这个|先放着|先略过|先留白|先搁着|暂时过掉|暂时放过|暂且放过|先越过去|放一边|跳过)/u.test(normalized)) {
    dialogueActs.push("decline_answer");
  }
  if (hasConversationFeedback) {
    dialogueActs.push("give_feedback");
    if (hasRepeatedQuestionFeedback && !controlSignals.includes("repair_question")) {
      controlSignals.push("repair_question");
    }
    if (
      hasFatigueFeedback &&
      !controlSignals.includes("skip_question") &&
      !controlSignals.includes("stop_follow_up")
    ) {
      controlSignals.push("stop_follow_up");
    }
  }

  const contentPresence =
    !normalized || genericFiller || incomplete
      ? "possible"
      : evidenceText && (evidenceText.length > 3 || contextualShortAnswer || explicitAbsence)
        ? "clear"
        : evidenceText
          ? "possible"
          : "none";
  const primaryControl = choosePrimaryControl(controlSignals);
  const referenceTarget =
    quotedOrReported && !controlSignals.length
      ? "quoted_event"
      : primaryControl === "generate_draft"
        ? "journal"
        : primaryControl === "stop_follow_up"
          ? "session"
          : primaryControl === "repair_question" || primaryControl === "skip_question"
            ? "current_question"
            : primaryControl === "switch_event"
              ? "current_event"
            : primaryControl === "switch_dimension"
              ? "dimension"
              : correctsPrevious
                ? "previous_interpretation"
                : input.questionSpec
                  ? "current_question"
                  : "unclear";
  const reasonCodes = unique([
    ...matches.map((match) => match.reasonCode),
    ...(quotedOrReported ? ["quoted_or_reported_event"] : []),
    ...(contextualShortAnswer ? ["contextual_short_answer"] : []),
    ...(hasExplicitAnswerFrame ? ["explicit_answer_frame"] : []),
    ...(explicitAbsence ? ["explicit_absence"] : []),
    ...(incomplete ? ["incomplete_utterance"] : []),
    ...(genericFiller ? ["generic_filler"] : []),
    ...(hasConversationFeedback ? ["conversation_feedback"] : []),
    ...(hasFatigueFeedback ? ["fatigue_feedback"] : [])
  ]);

  return {
    version: INTERVIEW_INTENT_CLASSIFIER_VERSION,
    primaryControl,
    controlSignals: unique(controlSignals),
    dialogueActs: unique(dialogueActs),
    content: {
      presence: contentPresence,
      evidenceText:
        contentPresence === "none" || incomplete ? null : evidenceText || null,
      explicitAbsence,
      answeredTarget: contentPresence === "clear" ? getAnsweredTarget(input) : null
    },
    referenceTarget,
    frustration: directHostility ? "strong" : hasConversationFeedback ? "mild" : "none",
    confidence:
      primaryControl !== "none" || contextualShortAnswer || quotedOrReported || explicitAbsence ? 0.96 : contentPresence === "clear" ? 0.9 : 0.72,
    origin: "deterministic",
    reasonCodes
  };
}

export function decideUserTurn(assessment: IntentAssessmentV1): TurnDecisionV1 {
  const hasClearContent = assessment.content.presence === "clear";

  switch (assessment.primaryControl) {
    case "generate_draft":
    case "stop_follow_up":
      return {
        version: INTERVIEW_TURN_POLICY_VERSION,
        runExtraction: hasClearContent,
        advanceTurn: hasClearContent,
        advanceRound: hasClearContent,
        stopFollowUp: true,
        nextAction: "validate_and_wrap_up",
        nextQuestionStyle: "normal"
      };
    case "repair_question":
      return {
        version: INTERVIEW_TURN_POLICY_VERSION,
        runExtraction: hasClearContent,
        advanceTurn: hasClearContent,
        advanceRound: hasClearContent,
        stopFollowUp: false,
        nextAction: hasClearContent ? "continue_interview" : "repair_question",
        nextQuestionStyle: assessment.reasonCodes.includes("conversation_feedback") ? "new_angle" : "simplified"
      };
    case "skip_question":
      return {
        version: INTERVIEW_TURN_POLICY_VERSION,
        runExtraction: hasClearContent,
        advanceTurn: hasClearContent,
        advanceRound: hasClearContent,
        stopFollowUp: false,
        nextAction: "continue_interview",
        nextQuestionStyle: "new_angle"
      };
    case "switch_event":
      return {
        version: INTERVIEW_TURN_POLICY_VERSION,
        runExtraction: false,
        advanceTurn: false,
        advanceRound: false,
        stopFollowUp: true,
        nextAction: "switch_event",
        nextQuestionStyle: "normal"
      };
    case "switch_dimension":
      return {
        version: INTERVIEW_TURN_POLICY_VERSION,
        runExtraction: false,
        advanceTurn: false,
        advanceRound: false,
        stopFollowUp: true,
        nextAction: "switch_dimension",
        nextQuestionStyle: "normal"
      };
    case "none":
      if (assessment.content.presence === "clear") {
        return {
          version: INTERVIEW_TURN_POLICY_VERSION,
          runExtraction: true,
          advanceTurn: true,
          advanceRound: true,
          stopFollowUp: false,
          nextAction: "continue_interview",
          nextQuestionStyle: assessment.dialogueActs.includes("give_feedback") ? "new_angle" : "normal"
        };
      }

      return {
        version: INTERVIEW_TURN_POLICY_VERSION,
        runExtraction: false,
        advanceTurn: false,
        advanceRound: false,
        stopFollowUp: false,
        nextAction: assessment.dialogueActs.includes("give_feedback")
          ? "offer_low_pressure_choice"
          : "continue_interview",
        nextQuestionStyle: assessment.dialogueActs.includes("give_feedback") ? "new_angle" : "normal"
      };
  }
}

function isEvidenceTextSupported(rawText: string, evidenceText: string | null) {
  if (!evidenceText) {
    return true;
  }

  const normalizedRaw = normalizeText(rawText).replace(/\s+/gu, "");
  const normalizedEvidence = normalizeText(evidenceText).replace(/\s+/gu, "");
  return Boolean(normalizedEvidence && normalizedRaw.includes(normalizedEvidence));
}

export function mergeIntentAssessments(input: {
  rawText: string;
  deterministic: IntentAssessmentV1;
  llm: IntentAssessmentV1;
}): IntentAssessmentV1 {
  const { deterministic, llm } = input;
  const highImpactControls: InterviewControlIntent[] = [
    "generate_draft",
    "stop_follow_up",
    "switch_event",
    "switch_dimension"
  ];
  const acceptedLlmControls = llm.controlSignals.filter((control) => {
    if (control === "none" || llm.referenceTarget === "quoted_event") {
      return false;
    }
    if (highImpactControls.includes(control)) {
      return deterministic.controlSignals.includes(control) && llm.confidence >= 0.85;
    }
    return llm.confidence >= 0.8;
  });
  const controlSignals = unique([
    ...deterministic.controlSignals,
    ...acceptedLlmControls
  ]);
  const useLlmContent =
    llm.confidence >= 0.8 &&
    isEvidenceTextSupported(input.rawText, llm.content.evidenceText);
  const deterministicTargetIsGrounded =
    deterministic.reasonCodes.includes("contextual_short_answer") ||
    deterministic.reasonCodes.includes("explicit_absence") ||
    deterministic.reasonCodes.includes("explicit_answer_frame") ||
    deterministic.dialogueActs.includes("correct_previous") ||
    deterministic.dialogueActs.includes("deny_hypothesis");
  const llmRejectsCandidateTarget =
    llm.content.answeredTarget === null &&
    llm.reasonCodes.includes("semantic_target_mismatch");
  const mergedAnsweredTarget = (() => {
    if (!useLlmContent) {
      return deterministic.content.answeredTarget;
    }
    if (deterministicTargetIsGrounded) {
      return deterministic.content.answeredTarget ?? llm.content.answeredTarget;
    }
    if (
      llm.content.answeredTarget === "current_question" &&
      deterministic.content.answeredTarget &&
      deterministic.content.answeredTarget !== "current_question"
    ) {
      return deterministic.content.answeredTarget;
    }
    if (
      llm.content.answeredTarget === null &&
      deterministic.content.answeredTarget &&
      !llmRejectsCandidateTarget
    ) {
      return deterministic.content.answeredTarget;
    }
    return llm.content.answeredTarget;
  })();
  const deterministicEvidenceIsMoreComplete = (() => {
    if (
      !useLlmContent ||
      deterministic.controlSignals.length > 0 ||
      deterministic.dialogueActs.includes("give_feedback") ||
      deterministic.content.presence !== "clear" ||
      llm.content.presence !== "clear" ||
      !deterministic.content.evidenceText ||
      !llm.content.evidenceText
    ) {
      return false;
    }

    const deterministicEvidence = normalizeText(
      deterministic.content.evidenceText
    ).replace(/\s+/gu, "");
    const llmEvidence = normalizeText(llm.content.evidenceText).replace(
      /\s+/gu,
      ""
    );

    return (
      deterministicEvidence.length > llmEvidence.length &&
      deterministicEvidence.includes(llmEvidence)
    );
  })();
  const content = useLlmContent
    ? {
        ...llm.content,
        evidenceText: deterministicEvidenceIsMoreComplete
          ? deterministic.content.evidenceText
          : llm.content.evidenceText,
        explicitAbsence:
          deterministic.content.explicitAbsence || llm.content.explicitAbsence,
        answeredTarget: mergedAnsweredTarget
      }
    : deterministic.content;
  const acceptedLlmDialogueActs =
    llm.confidence >= 0.8
      ? llm.dialogueActs.filter(
          (dialogueAct) =>
            !(
              dialogueAct === "give_feedback" &&
              deterministic.primaryControl !== "none" &&
              !deterministic.dialogueActs.includes("give_feedback")
            )
        )
      : [];
  const shouldKeepDeterministicReference =
    deterministic.referenceTarget !== "unclear";

  const mergedDialogueActs = unique([
    ...deterministic.dialogueActs,
    ...acceptedLlmDialogueActs
  ]).filter(
    (dialogueAct) =>
      dialogueAct !== "provide_content" || content.presence === "clear"
  );

  return {
    version: INTERVIEW_INTENT_CLASSIFIER_VERSION,
    primaryControl: choosePrimaryControl(controlSignals),
    controlSignals,
    dialogueActs: mergedDialogueActs,
    content,
    referenceTarget: shouldKeepDeterministicReference
      ? deterministic.referenceTarget
      : llm.confidence >= 0.8
        ? llm.referenceTarget
        : deterministic.referenceTarget,
    frustration:
      deterministic.frustration === "strong" || llm.frustration === "strong"
        ? "strong"
        : deterministic.frustration === "mild" || llm.frustration === "mild"
          ? "mild"
          : "none",
    confidence: Math.max(deterministic.confidence, llm.confidence),
    origin: "hybrid",
    reasonCodes: unique([
      ...deterministic.reasonCodes,
      ...(llm.confidence >= 0.8
        ? llm.reasonCodes.filter(
            (code) => code !== "answer_target_requires_semantic_validation"
          )
        : []),
      ...(useLlmContent &&
      Boolean(deterministic.content.answeredTarget) &&
      llmRejectsCandidateTarget &&
      !deterministicTargetIsGrounded
        ? ["answer_target_not_supported"]
        : []),
      "llm_intent_reconciled"
    ])
  };
}

export function toLegacyUserTurnAssessment(
  rawText: string,
  assessment: IntentAssessmentV1,
  decision = decideUserTurn(assessment)
): LegacyUserTurnAssessment {
  let intent: LegacyUserTurnIntent = "content";

  if (assessment.primaryControl === "generate_draft") {
    intent = "draft_request";
  } else if (assessment.primaryControl === "stop_follow_up") {
    intent = assessment.frustration === "strong" ? "hostile_boundary" : "boundary_stop";
  } else if (
    assessment.primaryControl === "repair_question" ||
    assessment.primaryControl === "skip_question"
  ) {
    intent = "question_repair";
  } else if (assessment.primaryControl === "switch_event") {
    intent = "boundary_stop";
  } else if (assessment.dialogueActs.includes("deny_hypothesis")) {
    intent = "hypothesis_denial";
  } else if (assessment.dialogueActs.includes("give_feedback")) {
    intent = "conversation_feedback";
  } else if (assessment.content.presence !== "clear") {
    intent = "low_signal";
  }

  const repairSignal =
    intent !== "question_repair"
      ? null
      : decision.nextQuestionStyle === "new_angle"
        ? "switch_angle"
        : assessment.reasonCodes.includes("explicit_repair_request")
          ? "simplify"
          : "rephrase";

  return {
    normalizedMessage: normalizeText(rawText),
    isMeaningful: decision.advanceTurn,
    intent,
    shouldExtractSnapshot: decision.runExtraction,
    shouldAdvanceTurn: decision.advanceTurn,
    shouldAdvanceRound: decision.advanceRound,
    repairSignal
  };
}

export function parsePersistedIntentAssessment(value: unknown) {
  return intentAssessmentV1Schema.safeParse(value);
}

export function parsePersistedTurnDecision(value: unknown) {
  return turnDecisionV1Schema.safeParse(value);
}

export type InterviewIntentV2Mode = "legacy" | "shadow" | "enforce";

export function getInterviewIntentV2Mode(): InterviewIntentV2Mode {
  const mode = process.env.INTERVIEW_INTENT_V2_MODE?.trim().toLowerCase();
  return mode === "shadow" || mode === "enforce" ? mode : "legacy";
}
