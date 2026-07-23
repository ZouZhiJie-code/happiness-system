import {
  eventCenteredNaturalResponseSchema,
  eventCenteredUnderstandingDecisionSchema,
  validateEventCenteredEvidenceQuotes,
  validateEventCenteredHypothesisAlignment,
  validateEventCenteredOutcomeAlignment,
  validateEventCenteredResponsePresentation,
  type EventCenteredNaturalResponse,
  type EventCenteredUnderstandingDecision
} from "@/features/interview/event-centered/ai-contract";
import { createPromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import { getAIProvider } from "@/server/services/ai";
import {
  completeStructuredOutput,
  type StructuredOutputAttempt
} from "@/server/services/ai/structured-output";
import {
  EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING,
  getEventCenteredFirstCheckpointFactAcknowledgement,
  resolveEventCenteredNaturalUnderstanding
} from "@/features/interview/event-centered/turn-quality";
import type {
  EventCenteredAssistantPayload,
  EventCenteredDialoguePhase,
  EventCenteredResponseKind
} from "@/types/event-centered-dialogue";
import type { JournalEventAngle } from "@/types/journal-event-angle-outcome";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";

export const EVENT_CENTERED_UNDERSTANDING_PROMPT_VERSION = "2026-07-22.event-centered-v1";
export const EVENT_CENTERED_RESPONSE_PROMPT_VERSION = "2026-07-22.event-centered-v1";

const UNKNOWN_PATTERN = /(不知道|不清楚|想不起来|记不清|说不清|都不贴切|没法再具体|无法再具体)/u;
/**
 * 文本访谈里，这些表达已经足够说明用户希望结束当前展开。
 * MVP 不猜测用户是在“暂时想不起来”还是“还可以被说服”，直接收束，
 * 保留已记录内容并回到检查点。
 */
const STOP_PATTERN = /(?:不想回答|不想答|不想继续|我(?:想|要)?停下来|不继续聊(?:这个|了)?|先停|别问了|不聊了|不用再追问|(?:先|就先)?收(?:在|到)?这里|暂时不想(?:说|聊)|到这里就好)/u;
const CORRECTION_PATTERN = /(不是|不对|我说错了|纠正|应该是|刚才.*别算)/u;
const MULTIPLE_EVENT_PATTERN = /(还有一件|另外一件|另一件事|第二件事)/u;
const INNER_EXPERIENCE_PATTERN = /(开心|高兴|难受|生气|委屈|失望|紧张|害怕|焦虑|放松|轻松|疲惫|累|在意|担心)/u;
const ADVICE_REQUEST_PATTERN = /(怎么办|怎么做|有什么建议|给我.*建议|你建议)/u;

export type EventCenteredResponseDirective = Pick<
  EventCenteredAssistantPayload,
  "responseKind" | "questionSpec" | "checkpoint" | "angleOutcome"
> & {
  exactResponse: string;
};

export type EventCenteredAIGenerationResult = {
  decision: EventCenteredUnderstandingDecision;
  response: EventCenteredNaturalResponse;
  payload: EventCenteredAssistantPayload;
  outputOrigin: "llm" | "deterministic" | "fallback";
  attempts: StructuredOutputAttempt[];
  promptLineage: Array<{
    promptKey: string;
    promptVersion: string;
    resolvedPromptHash: string;
  }>;
};

export type EventCenteredUnderstandingGenerationResult = Pick<
  EventCenteredAIGenerationResult,
  "decision" | "outputOrigin" | "attempts" | "promptLineage"
>;

export type EventCenteredResponseGenerationResult = Pick<
  EventCenteredAIGenerationResult,
  "response" | "payload" | "outputOrigin" | "attempts" | "promptLineage"
>;

function normalizeText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

/**
 * 纯文本中无法可靠区分“暂时想不起来”与“希望结束”。MVP 将明确的
 * 否定或无法继续表达统一视为边界；纠正表达由更高优先级的修订链处理。
 */
export function isEventCenteredTextBoundaryExpression(rawText: string) {
  const normalized = normalizeText(rawText);
  return Boolean(normalized) && (
    UNKNOWN_PATTERN.test(normalized) ||
    STOP_PATTERN.test(normalized) ||
    /没有/u.test(normalized)
  );
}

function boundaryFallbackFact(rawText: string) {
  const normalized = normalizeText(rawText);
  const isSpecificDenial = /没有/u.test(normalized);
  return {
    statement: normalized,
    scope: "current_event" as const,
    stance: isSpecificDenial ? "denied" as const : "unknown" as const,
    kind: INNER_EXPERIENCE_PATTERN.test(normalized)
      ? "inner_experience" as const
      : "boundary_answer" as const,
    quote: rawText.trim()
  };
}

/**
 * 在模型理解之后加上的确定性产品边界。它不会改写纠正轮；对具体否定
 * 补一条原话可追溯的 denied 事实，避免“我没有生气”在收束时丢失。
 */
export function enforceEventCenteredTextBoundaryDecision(input: {
  rawText: string;
  decision: EventCenteredUnderstandingDecision;
}): EventCenteredUnderstandingDecision {
  const normalized = normalizeText(input.rawText);
  if (
    !isEventCenteredTextBoundaryExpression(normalized) ||
    input.decision.answerSignal === "correction" ||
    CORRECTION_PATTERN.test(normalized)
  ) {
    return input.decision;
  }

  const hasSpecificDenial = /没有/u.test(normalized);
  const hasDeniedFact = input.decision.facts.some((fact) =>
    fact.stance === "denied" && fact.quote.includes("没有")
  );
  const facts = hasSpecificDenial && !hasDeniedFact
    ? [...input.decision.facts.slice(0, 5), boundaryFallbackFact(input.rawText)]
    : input.decision.facts.length > 0
      ? input.decision.facts
      : [boundaryFallbackFact(input.rawText)];

  return {
    ...input.decision,
    coreEventIdentifiable: false,
    answerSignal: "declined",
    facts,
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    eventOptions: []
  };
}

function fallbackEventOptions(rawText: string) {
  const fragments = rawText
    .split(/(?:然后|后来|同时|另外|可是|但是|又|还有|[，。；！？])/u)
    .map((value) => normalizeText(value))
    .filter((value) => value.length >= 4)
    .slice(0, 2);
  if (fragments.length === 2) {
    return fragments.map((sourceText) => ({
      label: sourceText.length > 22 ? `${sourceText.slice(0, 22)}…` : sourceText,
      sourceText
    }));
  }
  return [
    { label: "先记录前面提到的那件", sourceText: rawText },
    { label: "先记录后面提到的那件", sourceText: rawText }
  ];
}

function fallbackDecision(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
}): EventCenteredUnderstandingDecision {
  const rawText = input.rawText.trim();
  const normalized = normalizeText(rawText);
  const unknown = UNKNOWN_PATTERN.test(normalized);
  const stopped = STOP_PATTERN.test(normalized);
  const textBoundary = isEventCenteredTextBoundaryExpression(normalized);
  const correction = CORRECTION_PATTERN.test(normalized);
  const multipleEvents = MULTIPLE_EVENT_PATTERN.test(normalized);
  const coreEventIdentifiable = Boolean(
    normalized.length >= 4 && !textBoundary && !STOP_PATTERN.test(normalized)
  );

  return {
    eventBoundary: multipleEvents ? "multiple_events" : "current_event",
    coreEventIdentifiable: multipleEvents ? false : coreEventIdentifiable,
    answerSignal: correction
      ? "correction"
      : textBoundary
        ? "declined"
        : unknown
          ? "unknown"
          : coreEventIdentifiable
            ? "answered"
            : "partly_answered",
    facts: multipleEvents || !normalized
      ? []
      : [{
          statement: normalized,
          scope: "current_event",
          stance: normalized.includes("没有") ? "denied" : unknown ? "unknown" : stopped ? "denied" : "affirmed",
          kind: unknown || stopped || textBoundary
            ? "boundary_answer"
            : INNER_EXPERIENCE_PATTERN.test(normalized)
              ? "inner_experience"
              : "event_detail",
          quote: rawText
        }],
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: ADVICE_REQUEST_PATTERN.test(normalized)
      ? { requested: true, condition: null, options: [] }
      : null,
    eventOptions: multipleEvents ? fallbackEventOptions(rawText) : [],
    correctionTargetHint: null,
    boundaryReason: multipleEvents ? "表达中出现了两件并列事件，需要用户选择当前主线。" : null
  };
}

function buildUnderstandingMessages(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  currentQuestion: string | null;
  facts: JournalEventFactRecord[];
}) {
  const factLines = input.facts.map((fact) => ({
    id: fact.id,
    statement: fact.statement,
    scope: fact.scope,
    stance: fact.stance,
    kind: fact.kind
  }));
  return [
    {
      role: "system" as const,
      content: [
        "你负责事件中心访谈的证据判断，只输出 JSON。",
        "用户原话是最高依据。事实 quote 必须逐字出现在本轮原话中。",
        "当前事件、解释当前事件的背景、另一独立事件必须分开。",
        "两件并列事件在用户选择前不建立事实。",
        "每轮最多一个缺少原话支持的可能性推测；轻量记录与纠正轮禁止推测。",
        "准确复述不算角度成果，成果需要形成有证据的新增区分。",
        "用户明确求行动建议时标记 adviceRequest；先澄清一个取舍条件。当前问题正在询问该条件时，用回答填写 condition，并给2到3个带取舍的非强制备选。",
        "不诊断、不替用户归因、不推测他人动机、不主动给建议。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        phase: input.phase,
        activeAngle: input.activeAngle,
        currentQuestion: input.currentQuestion,
        effectiveFacts: factLines,
        rawText: input.rawText,
        outputSchema: {
          eventBoundary: "current_event|background|another_event|multiple_events|unclear",
          coreEventIdentifiable: "boolean",
          answerSignal: "answered|partly_answered|unknown|declined|correction|unrelated",
          facts: "[{statement,scope,stance,kind,quote}]",
          angleEvidence: "[{angle,evidence,valueAddedInsightPossible}]",
          outcomeCandidate: "null|{angle,kind,statement,supportFactStatements}",
          unsupportedHypothesis: "null|{statement,scope,stance,kind}",
          adviceRequest: "null|{requested:true,condition:string|null,options:[{text,tradeoff}]}",
          eventOptions: "仅当multiple_events时输出最多两项[{label,sourceText}]；sourceText必须是用户原话中的连续短摘录",
          correctionTargetHint: "string|null",
          boundaryReason: "string|null"
        }
      })
    }
  ];
}

function buildResponseMessages(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  decision: EventCenteredUnderstandingDecision;
  directive: EventCenteredResponseDirective;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "你负责把已经确定的访谈策略写成自然、克制、容易回答的中文，只输出 JSON。",
        "理解层简短呈现 AI 此刻怎样理解用户，不重复堆叠原话。",
        "策略给出的提问、检查点和成果内容必须原样保留，模型不能改变阶段和问题目标。",
        "每条回复只让用户完成一个动作：回答一个问题，或点击一张纸笺。自然理解只能承接和说明，不能包含问号、追问或选择指令。",
        "当 fixedDirective 是检查点时，自然回应只做一句承接，不能提问；检查点纸笺会呈现后续动作。",
        "当 fixedDirective 是纸笺选择时，自然回应只做一句承接，不能提问、要求选择或复述选项；纸笺会承载选择。",
        "普通追问只围绕 fixedDirective 中唯一的问题目标，不能附带第二个问题。",
        `普通第一检查点的自然理解固定为“${EVENT_CENTERED_FIRST_CHECKPOINT_UNDERSTANDING}”；纠正或明确否定轮只承接已经识别的变化。不要补写感受、意义、规律或角度洞见。`,
        "自然理解中的可能性推测必须与 hypothesisStatement 完全一致。",
        "不诊断、不说教、不主动建议、不暴露事实表、槽位、状态机等内部结构。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        rawText: input.rawText,
        phase: input.phase,
        activeAngle: input.activeAngle,
        understandingDecision: input.decision,
        fixedDirective: input.directive,
        outputSchema: {
          naturalUnderstanding: "string",
          naturalResponse: "string",
          hypothesisStatement: "string|null",
          outcomeStatement: "string|null"
        }
      })
    }
  ];
}

function fallbackResponse(input: {
  rawText: string;
  decision: EventCenteredUnderstandingDecision;
  directive: EventCenteredResponseDirective;
}): EventCenteredNaturalResponse {
  const understanding = input.decision.answerSignal === "unknown"
    ? "你现在还不容易把这部分说清楚。"
    : input.decision.answerSignal === "declined"
      ? "你希望先停在这里，我会按现有内容收住。"
      : input.decision.eventBoundary === "multiple_events"
        ? "这里同时出现了两件值得记录的事。"
        : `我先记住你刚才说的这部分：${normalizeText(input.rawText).slice(0, 60)}`;
  return {
    naturalUnderstanding: understanding,
    naturalResponse: input.directive.exactResponse,
    hypothesisStatement: input.decision.unsupportedHypothesis?.statement ?? null,
    outcomeStatement: input.decision.outcomeCandidate?.statement ?? null
  };
}

export async function understandEventCenteredTurnAI(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  currentQuestion: string | null;
  facts: JournalEventFactRecord[];
  allowUnsupportedHypothesis: boolean;
  signal?: AbortSignal;
}): Promise<EventCenteredUnderstandingGenerationResult> {
  const provider = await getAIProvider("chat");
  const attempts: StructuredOutputAttempt[] = [];
  const understandingEnvelope = createPromptEnvelope({
    promptKey: "interview.event_centered.understanding",
    promptVersion: EVENT_CENTERED_UNDERSTANDING_PROMPT_VERSION,
    messages: buildUnderstandingMessages(input)
  });
  const aiDecision = await completeStructuredOutput({
    provider,
    stage: "extract",
    schema: eventCenteredUnderstandingDecisionSchema,
    messages: understandingEnvelope.messages,
    maxTokens: 1100,
    timeoutMs: 12_000,
    signal: input.signal,
    onAttempt: (attempt) => {
      attempts.push(attempt);
    }
  });
  let decision = aiDecision && validateEventCenteredEvidenceQuotes(aiDecision, input.rawText)
    ? aiDecision
    : fallbackDecision(input);
  decision = enforceEventCenteredTextBoundaryDecision({
    rawText: input.rawText,
    decision
  });
  if (!input.allowUnsupportedHypothesis && decision.unsupportedHypothesis) {
    decision = { ...decision, unsupportedHypothesis: null };
  }

  return {
    decision,
    outputOrigin: aiDecision ? "llm" : provider ? "fallback" : "deterministic",
    attempts,
    promptLineage: [{
      promptKey: understandingEnvelope.promptKey,
      promptVersion: understandingEnvelope.promptVersion,
      resolvedPromptHash: understandingEnvelope.resolvedPromptHash
    }]
  };
}

export async function realizeEventCenteredTurnAI(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  decision: EventCenteredUnderstandingDecision;
  directive: EventCenteredResponseDirective;
  signal?: AbortSignal;
}): Promise<EventCenteredResponseGenerationResult> {
  const provider = await getAIProvider("chat");
  const attempts: StructuredOutputAttempt[] = [];

  const responseEnvelope = createPromptEnvelope({
    promptKey: "interview.event_centered.response",
    promptVersion: EVENT_CENTERED_RESPONSE_PROMPT_VERSION,
    messages: buildResponseMessages(input)
  });
  const aiResponse = await completeStructuredOutput({
    provider,
    stage: "question",
    schema: eventCenteredNaturalResponseSchema,
    messages: responseEnvelope.messages,
    maxTokens: 650,
    timeoutMs: 8_000,
    signal: input.signal,
    onAttempt: (attempt) => {
      attempts.push(attempt);
    }
  });
  const alignedResponse = aiResponse &&
    validateEventCenteredHypothesisAlignment({ decision: input.decision, response: aiResponse }) &&
    validateEventCenteredOutcomeAlignment({ decision: input.decision, response: aiResponse }) &&
    validateEventCenteredResponsePresentation({ response: aiResponse, directive: input.directive })
      ? aiResponse
      : fallbackResponse({ rawText: input.rawText, decision: input.decision, directive: input.directive });
  const hypothesisStatement = input.decision.unsupportedHypothesis?.statement ?? null;
  const firstCheckpointAcknowledgement = input.directive.checkpoint?.kind === "first"
    ? getEventCenteredFirstCheckpointFactAcknowledgement(input.decision)
    : null;
  const naturalUnderstanding = resolveEventCenteredNaturalUnderstanding({
    rawText: input.rawText,
    directive: input.directive,
    naturalUnderstanding: alignedResponse.naturalUnderstanding,
    hypothesisStatement,
    firstCheckpointUnderstanding: firstCheckpointAcknowledgement?.understanding ?? null
  });
  const response = {
    ...alignedResponse,
    naturalUnderstanding,
    naturalResponse: input.directive.exactResponse,
    hypothesisStatement,
    outcomeStatement: input.directive.angleOutcome?.statement ?? null
  };
  const payload: EventCenteredAssistantPayload = {
    naturalUnderstanding: response.naturalUnderstanding,
    naturalResponse: response.naturalResponse,
    responseKind: input.directive.responseKind,
    questionSpec: input.directive.questionSpec,
    checkpoint: input.directive.checkpoint,
    angleOutcome: input.directive.angleOutcome
  };

  return {
    response,
    payload,
    outputOrigin: aiResponse ? "llm" : provider ? "fallback" : "deterministic",
    attempts,
    promptLineage: [{
      promptKey: responseEnvelope.promptKey,
      promptVersion: responseEnvelope.promptVersion,
      resolvedPromptHash: responseEnvelope.resolvedPromptHash
    }]
  };
}

export async function generateEventCenteredTurnAI(input: {
  rawText: string;
  phase: EventCenteredDialoguePhase;
  activeAngle: JournalEventAngle | null;
  currentQuestion: string | null;
  facts: JournalEventFactRecord[];
  directive: EventCenteredResponseDirective;
  allowUnsupportedHypothesis: boolean;
  signal?: AbortSignal;
}): Promise<EventCenteredAIGenerationResult> {
  const understanding = await understandEventCenteredTurnAI(input);
  const response = await realizeEventCenteredTurnAI({
    rawText: input.rawText,
    phase: input.phase,
    activeAngle: input.activeAngle,
    decision: understanding.decision,
    directive: input.directive,
    signal: input.signal
  });
  return {
    decision: understanding.decision,
    response: response.response,
    payload: response.payload,
    outputOrigin: understanding.outputOrigin === "llm" && response.outputOrigin === "llm"
      ? "llm"
      : understanding.outputOrigin === "deterministic" && response.outputOrigin === "deterministic"
        ? "deterministic"
        : "fallback",
    attempts: [...understanding.attempts, ...response.attempts],
    promptLineage: [...understanding.promptLineage, ...response.promptLineage]
  };
}

export function isEventCenteredStopExpression(rawText: string) {
  return STOP_PATTERN.test(normalizeText(rawText));
}

export function isEventCenteredUnknownExpression(rawText: string) {
  return UNKNOWN_PATTERN.test(normalizeText(rawText));
}

export function isBareEventCenteredAngleChange(rawText: string) {
  return /^(换个角度|换一个角度|换角度)[。！!？?]?$/u.test(normalizeText(rawText));
}

export function responseKindAllowsUnsupportedHypothesis(
  phase: EventCenteredDialoguePhase,
  responseKind: EventCenteredResponseKind
) {
  return (phase === "guided_reflection" || phase === "deep_companionship") &&
    responseKind !== "repair" && responseKind !== "checkpoint";
}
