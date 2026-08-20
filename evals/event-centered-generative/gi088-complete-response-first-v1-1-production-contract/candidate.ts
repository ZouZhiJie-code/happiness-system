import { createHash } from "node:crypto";

import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME,
  GI088_COMPLETE_RESPONSE_FIRST_V1_1_VERSION,
  parseGi088CompleteResponseFirstV11Output,
  validateGi088CompleteResponseFirstV11Output
} from "../gi088-complete-response-first-v1-1/candidate";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_VERSION,
  composeEventCenteredCompleteResponse
} from "../../../src/features/interview/event-centered/complete-response-first";
import type {
  EventCenteredGenerativeGenerationInput,
  EventCenteredGenerativeGenerationResult,
  EventCenteredGenerativeRecentTurn
} from "../../../src/server/services/interview/event-centered-ai.service";
import type { JournalEventAngle } from "../../../src/types/journal-event-angle-outcome";
import type {
  Gi088CompleteResponseFirstCase,
  Gi088CompleteResponseFirstCategory
} from "../../../scripts/gi088-complete-response-first-fixtures";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_1_PRODUCTION_CONTRACT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-1-production-contract-quality-v1" as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_1_PRODUCTION_RUNTIME = {
  model: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.model,
  temperature: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.temperature,
  maxTokens: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.maxTokens,
  maxAttempts: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.maxAttempts,
  timeoutMs: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.timeoutMs,
  thinking: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.thinking,
  reasoningEffort: null,
  callsPerCase: 1,
  recentTurnLimit: 8
} as const;

type ConversationMessage = Gi088CompleteResponseFirstCase["turnInput"]["conversation"][number];

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function sha(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function splitAssistantContent(content: string) {
  const paragraphs = content
    .split(/\n\s*\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const last = paragraphs.at(-1) ?? content.trim();
  if (!/[？?]/u.test(last)) {
    return { understanding: content.trim(), question: null };
  }
  return {
    understanding: paragraphs.slice(0, -1).join("\n\n"),
    question: last
  };
}

function completedRecentTurns(
  conversation: ConversationMessage[]
): EventCenteredGenerativeRecentTurn[] {
  const turns: EventCenteredGenerativeRecentTurn[] = [];
  let pendingUser: string | null = null;
  for (const message of conversation.slice(0, -1)) {
    if (message.role === "user") {
      pendingUser = message.content;
      continue;
    }
    if (!pendingUser) continue;
    const assistant = splitAssistantContent(message.content);
    turns.push({
      user: pendingUser,
      assistantUnderstanding: assistant.understanding,
      assistantQuestion: assistant.question
    });
    pendingUser = null;
  }
  return turns.slice(-GI088_COMPLETE_RESPONSE_FIRST_V1_1_PRODUCTION_RUNTIME.recentTurnLimit);
}

function latestAssistantQuestion(conversation: ConversationMessage[]) {
  const assistant = [...conversation.slice(0, -1)]
    .reverse()
    .find((message) => message.role === "assistant");
  return assistant ? splitAssistantContent(assistant.content).question : null;
}

function angleForCategory(
  category: Gi088CompleteResponseFirstCategory
): JournalEventAngle {
  if (
    category === "relationship_boundary" ||
    category === "concrete_answer_entry" ||
    category === "burden_not_stop" ||
    category === "long_context"
  ) {
    return "relationship";
  }
  if (category === "answered_information" || category === "explicit_stop") {
    return "feeling";
  }
  return "thought";
}

export function createGi088CompleteResponseFirstV11ProductionInput(
  item: Gi088CompleteResponseFirstCase
): Omit<EventCenteredGenerativeGenerationInput, "provider"> {
  const conversation = item.turnInput.conversation;
  const latest = conversation.at(-1);
  if (!latest || latest.role !== "user" || latest.id !== item.turnInput.latestUserMessageId) {
    throw new Error(`GI088_COMPLETE_RESPONSE_PRODUCTION_LATEST_USER_INVALID:${item.caseId}`);
  }
  const currentQuestion = latestAssistantQuestion(conversation);
  return {
    rawText: latest.content,
    phase: "deep_companionship",
    activeAngle: angleForCategory(item.category),
    currentQuestion,
    currentQuestionTarget: currentQuestion ? "historical_current_question" : null,
    currentQuestionIntent: null,
    currentQuestionSurfaceLevel: currentQuestion ? "open_anchor" : null,
    currentQuestionCognitiveAction: currentQuestion ? "anchor_specific" : null,
    correctionRequested: false,
    facts: [],
    recentTurns: completedRecentTurns(conversation),
    askedTargets: currentQuestion ? ["historical_current_question"] : [],
    answeredTargets: [],
    deniedTargets: [],
    guidedQuestionOpportunityCount: 0,
    microgoal: null,
    completeResponseFirst: true,
    maxTokens: GI088_COMPLETE_RESPONSE_FIRST_V1_1_PRODUCTION_RUNTIME.maxTokens,
    maxAttempts: GI088_COMPLETE_RESPONSE_FIRST_V1_1_PRODUCTION_RUNTIME.maxAttempts,
    timeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_1_PRODUCTION_RUNTIME.timeoutMs
  };
}

function fallbackVisibleText(result: EventCenteredGenerativeGenerationResult) {
  const turn = result.turn;
  if (!turn) return "";
  if (turn.semanticPlan.action === "ask") return turn.visibleTurn.question ?? "";
  if (turn.semanticPlan.action === "complete" || turn.semanticPlan.action === "pause") {
    return turn.visibleTurn.insight ?? "";
  }
  return turn.visibleTurn.honestLimit ?? "";
}

export function projectGi088CompleteResponseFirstV11ProductionVisible(
  result: EventCenteredGenerativeGenerationResult
) {
  return result.turn
    ? composeEventCenteredCompleteResponse(result.turn, fallbackVisibleText(result))
    : "";
}

export function validateGi088CompleteResponseFirstV11ProductionResult(input: {
  item: Gi088CompleteResponseFirstCase;
  result: EventCenteredGenerativeGenerationResult;
}) {
  const issues: string[] = [];
  if (input.result.architecture !== "one_call") issues.push("PRODUCTION_ARCHITECTURE_NOT_ONE_CALL");
  if (
    input.result.strategyVersion !== EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_VERSION
  ) {
    issues.push("PRODUCTION_STRATEGY_VERSION_MISMATCH");
  }
  if (input.result.attempts.length !== 1) issues.push("PRODUCTION_CALL_COUNT_NOT_ONE");
  if (!input.result.turn) {
    issues.push("PRODUCTION_TURN_NULL");
    return issues;
  }
  const visible = projectGi088CompleteResponseFirstV11ProductionVisible(input.result);
  const plainOutput = parseGi088CompleteResponseFirstV11Output(visible);
  issues.push(...validateGi088CompleteResponseFirstV11Output({
    turnInput: input.item.turnInput,
    output: plainOutput
  }));
  if (
    input.item.category === "explicit_stop" &&
    (
      input.result.turn.semanticPlan.action === "ask" ||
      Boolean(input.result.turn.visibleTurn.question)
    )
  ) {
    issues.push("EXPLICIT_STOP_STILL_ASKED");
  }
  return [...new Set(issues)];
}

export function observeGi088CompleteResponseFirstV11ProductionResult(input: {
  item: Gi088CompleteResponseFirstCase;
  result: EventCenteredGenerativeGenerationResult;
}) {
  const visible = projectGi088CompleteResponseFirstV11ProductionVisible(input.result);
  return {
    action: input.result.turn?.semanticPlan.action ?? null,
    visibleCharacterCount: [...visible].length,
    paragraphCount: visible ? visible.split(/\n\s*\n/u).filter(Boolean).length : 0,
    questionMarkCount: (visible.match(/[？?]/gu) ?? []).length,
    visibleHash: sha(visible),
    recentTurnCount: createGi088CompleteResponseFirstV11ProductionInput(input.item)
      .recentTurns.length
  };
}

export function createGi088CompleteResponseFirstV11ProductionIdentity() {
  const core = {
    version: GI088_COMPLETE_RESPONSE_FIRST_V1_1_PRODUCTION_CONTRACT_VERSION,
    parentSemanticVersion: GI088_COMPLETE_RESPONSE_FIRST_V1_1_VERSION,
    productionStrategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_1_VERSION,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_1_PRODUCTION_RUNTIME,
    inputAdapter: "full_checkpoint_to_event_centered_last_8_turns_v1",
    visibleProjection: "single_bubble_v1"
  } as const;
  return { ...core, candidateFingerprint: sha(core) };
}
