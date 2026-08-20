import { createHash } from "node:crypto";

import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME,
  parseGi088CompleteResponseFirstV11Output,
  validateGi088CompleteResponseFirstV11Output
} from "../gi088-complete-response-first-v1-1/candidate";
import {
  createGi088CompleteResponseFirstV11ProductionInput
} from "../gi088-complete-response-first-v1-1-production-contract/candidate";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION,
  eventCenteredCompleteResponseFirstV12OutputSchema,
  validateEventCenteredCompleteResponseFirstV12Output
} from "../../../src/features/interview/event-centered/complete-response-first-v1-2";
import type {
  EventCenteredGenerativeGenerationInput,
  EventCenteredGenerativeGenerationResult,
  EventCenteredGenerativeRecentTurn
} from "../../../src/server/services/interview/event-centered-ai.service";
import type {
  Gi088CompleteResponseFirstCase
} from "../../../scripts/gi088-complete-response-first-fixtures";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_CONTRACT_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-2-production-contract-quality-v1" as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_RUNTIME = {
  model: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.model,
  temperature: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.temperature,
  maxTokens: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.maxTokens,
  maxAttempts: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.maxAttempts,
  timeoutMs: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.timeoutMs,
  thinking: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_RUNTIME.thinking,
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
  return /[？?]/u.test(last)
    ? {
        understanding: paragraphs.slice(0, -1).join("\n\n"),
        question: last
      }
    : { understanding: content.trim(), question: null };
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
      assistantQuestion: assistant.question,
      assistantResponse: message.content,
      assistantMessageId: message.id
    });
    pendingUser = null;
  }
  return turns.slice(-GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_RUNTIME.recentTurnLimit);
}

export function createGi088CompleteResponseFirstV12ProductionInput(
  item: Gi088CompleteResponseFirstCase
): Omit<EventCenteredGenerativeGenerationInput, "provider"> {
  const parent = createGi088CompleteResponseFirstV11ProductionInput(item);
  return {
    ...parent,
    recentTurns: completedRecentTurns(item.turnInput.conversation),
    maxTokens: GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_RUNTIME.maxTokens,
    maxAttempts: GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_RUNTIME.maxAttempts,
    timeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_RUNTIME.timeoutMs
  };
}

export function projectGi088CompleteResponseFirstV12ProductionVisible(
  result: EventCenteredGenerativeGenerationResult
) {
  return result.completeResponseText?.trim() ?? "";
}

export function validateGi088CompleteResponseFirstV12ProductionResult(input: {
  item: Gi088CompleteResponseFirstCase;
  result: EventCenteredGenerativeGenerationResult;
}) {
  const issues: string[] = [];
  const generationInput = createGi088CompleteResponseFirstV12ProductionInput(input.item);
  if (input.result.architecture !== "one_call") {
    issues.push("PRODUCTION_ARCHITECTURE_NOT_ONE_CALL");
  }
  if (input.result.strategyVersion !== EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION) {
    issues.push("PRODUCTION_STRATEGY_VERSION_MISMATCH");
  }
  if (input.result.attempts.length !== 1) issues.push("PRODUCTION_CALL_COUNT_NOT_ONE");
  if (!input.result.turn) issues.push("PRODUCTION_TURN_NULL");
  if (!input.result.completeResponseEnvelope) issues.push("PRODUCTION_ENVELOPE_NULL");
  const visible = projectGi088CompleteResponseFirstV12ProductionVisible(input.result);
  if (!visible) {
    issues.push("PRODUCTION_VISIBLE_RESPONSE_EMPTY");
    return [...new Set(issues)];
  }
  const plainOutput = parseGi088CompleteResponseFirstV11Output(visible);
  issues.push(...validateGi088CompleteResponseFirstV11Output({
    turnInput: input.item.turnInput,
    output: plainOutput
  }));
  const envelope = input.result.completeResponseEnvelope;
  if (envelope) {
    const parsed = eventCenteredCompleteResponseFirstV12OutputSchema.safeParse(envelope);
    if (!parsed.success) {
      issues.push("PRODUCTION_ENVELOPE_SCHEMA_INVALID");
    } else {
      if (parsed.data.response !== visible) {
        issues.push("PRODUCTION_VISIBLE_RESPONSE_CHANGED");
      }
      issues.push(...validateEventCenteredCompleteResponseFirstV12Output({
        generationInput,
        output: parsed.data
      }));
      if (
        input.item.category === "explicit_stop" &&
        parsed.data.interaction.kind !== "stop"
      ) {
        issues.push("EXPLICIT_STOP_STILL_OPEN");
      }
    }
  }
  return [...new Set(issues)];
}

export function observeGi088CompleteResponseFirstV12ProductionResult(input: {
  item: Gi088CompleteResponseFirstCase;
  result: EventCenteredGenerativeGenerationResult;
}) {
  const visible = projectGi088CompleteResponseFirstV12ProductionVisible(input.result);
  const envelope = input.result.completeResponseEnvelope;
  return {
    interaction: envelope?.interaction.kind ?? null,
    factCount: envelope?.facts.length ?? 0,
    correctionKind: envelope?.correction.kind ?? null,
    visibleCharacterCount: [...visible].length,
    paragraphCount: visible ? visible.split(/\n\s*\n/u).filter(Boolean).length : 0,
    questionMarkCount: (visible.match(/[？?]/gu) ?? []).length,
    visibleHash: sha(visible),
    recentTurnCount: createGi088CompleteResponseFirstV12ProductionInput(input.item)
      .recentTurns.length
  };
}

export function createGi088CompleteResponseFirstV12ProductionIdentity() {
  const core = {
    version: GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_CONTRACT_VERSION,
    parentProductionIdentity:
      "2026-08-20.gi088-complete-response-first-v1-1-production-contract-quality-v1",
    productionStrategyVersion: EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_VERSION,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_RUNTIME,
    inputAdapter: "full_checkpoint_to_minimal_envelope_last_8_complete_turns_v1",
    visibleProjection: "model_response_byte_preserving_single_bubble_v1"
  } as const;
  return { ...core, candidateFingerprint: sha(core) };
}
