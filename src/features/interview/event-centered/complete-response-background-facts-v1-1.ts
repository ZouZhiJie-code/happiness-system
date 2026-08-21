import {
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_PROMPT_VERSION,
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_RUNTIME,
  buildEventCenteredCompleteResponseBackgroundFactsV1Messages,
  observeEventCenteredCompleteResponseBackgroundFactsV1Output,
  parseEventCenteredCompleteResponseBackgroundFactsV1Output,
  validateEventCenteredCompleteResponseBackgroundFactsV1Output,
  type EventCenteredCompleteResponseBackgroundFactsV1Input,
  type EventCenteredCompleteResponseBackgroundFactsV1Output
} from "@/features/interview/event-centered/complete-response-background-facts-v1";

export const EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-7-background-source-alignment-v1" as const;

export const EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_PROMPT_VERSION =
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_PROMPT_VERSION;

export const EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_1_RUNTIME =
  EVENT_CENTERED_COMPLETE_RESPONSE_BACKGROUND_FACTS_V1_RUNTIME;

type ComparableToken = {
  value: string;
  start: number;
  end: number;
};

function isIgnorableSourceCharacter(value: string) {
  return /[\p{P}\p{Z}\s]/u.test(value);
}

function comparableSourceTokens(source: string) {
  const tokens: ComparableToken[] = [];
  for (let offset = 0; offset < source.length;) {
    const codePoint = source.codePointAt(offset);
    if (codePoint === undefined) break;
    const value = String.fromCodePoint(codePoint);
    const end = offset + value.length;
    if (!isIgnorableSourceCharacter(value)) {
      tokens.push({ value, start: offset, end });
    }
    offset = end;
  }
  return tokens;
}

function comparableQuoteTokens(quote: string) {
  return Array.from(quote).filter((value) => !isIgnorableSourceCharacter(value));
}

/**
 * 来源对齐只容忍空白和标点差异。所有可比较字符必须在同一用户消息中
 * 连续、逐字且唯一匹配；返回值始终截取自用户原文。
 */
export function alignEventCenteredBackgroundFactsQuoteToSource(input: {
  source: string;
  quote: string;
}) {
  if (input.source.includes(input.quote)) return input.quote;
  const sourceTokens = comparableSourceTokens(input.source);
  const quoteTokens = comparableQuoteTokens(input.quote);
  if (quoteTokens.length < 4 || quoteTokens.length > sourceTokens.length) return null;
  const matches: number[] = [];
  for (let start = 0; start <= sourceTokens.length - quoteTokens.length; start += 1) {
    if (quoteTokens.every((value, index) =>
      sourceTokens[start + index]?.value === value
    )) matches.push(start);
  }
  if (matches.length !== 1) return null;
  const startToken = sourceTokens[matches[0]!]!;
  const endToken = sourceTokens[matches[0]! + quoteTokens.length - 1]!;
  return input.source.slice(startToken.start, endToken.end);
}

export function alignEventCenteredCompleteResponseBackgroundFactsV11Output(input: {
  generationInput: EventCenteredCompleteResponseBackgroundFactsV1Input;
  output: EventCenteredCompleteResponseBackgroundFactsV1Output;
}) {
  const sources = new Map(input.generationInput.conversation
    .filter((message) => message.role === "user")
    .map((message) => [message.id, message.content]));
  let alignedQuoteCount = 0;
  const align = (sourceUserMessageId: string, quote: string) => {
    const source = sources.get(sourceUserMessageId);
    if (!source) return quote;
    const aligned = alignEventCenteredBackgroundFactsQuoteToSource({ source, quote });
    if (aligned && aligned !== quote) alignedQuoteCount += 1;
    return aligned ?? quote;
  };
  const output = {
    ...input.output,
    factDeltas: input.output.factDeltas.map((fact) => ({
      ...fact,
      quote: align(fact.sourceUserMessageId, fact.quote)
    })),
    corrections: input.output.corrections.map((correction) => ({
      ...correction,
      quote: align(correction.sourceUserMessageId, correction.quote)
    }))
  };
  return { output, alignedQuoteCount };
}

export function parseAndAlignEventCenteredCompleteResponseBackgroundFactsV11Output(
  input: {
    generationInput: EventCenteredCompleteResponseBackgroundFactsV1Input;
    content: string;
  }
) {
  return alignEventCenteredCompleteResponseBackgroundFactsV11Output({
    generationInput: input.generationInput,
    output: parseEventCenteredCompleteResponseBackgroundFactsV1Output(input.content)
  });
}

export function validateEventCenteredCompleteResponseBackgroundFactsV11Output(input: {
  generationInput: EventCenteredCompleteResponseBackgroundFactsV1Input;
  output: EventCenteredCompleteResponseBackgroundFactsV1Output;
}) {
  return validateEventCenteredCompleteResponseBackgroundFactsV1Output(input);
}

export function observeEventCenteredCompleteResponseBackgroundFactsV11Output(input: {
  output: EventCenteredCompleteResponseBackgroundFactsV1Output;
  alignedQuoteCount: number;
}) {
  return {
    ...observeEventCenteredCompleteResponseBackgroundFactsV1Output(input.output),
    alignedQuoteCount: input.alignedQuoteCount
  };
}

export {
  buildEventCenteredCompleteResponseBackgroundFactsV1Messages as buildEventCenteredCompleteResponseBackgroundFactsV11Messages
};

export type EventCenteredCompleteResponseBackgroundFactsV11Output =
  EventCenteredCompleteResponseBackgroundFactsV1Output;
