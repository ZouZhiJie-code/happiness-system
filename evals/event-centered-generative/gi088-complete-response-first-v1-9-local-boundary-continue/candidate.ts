import { createHash } from "node:crypto";

import {
  createGi088CompleteResponseFirstV16Input
} from "../gi088-complete-response-first-v1-6-contrastive-coverage/candidate";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_VERSION,
  observeEventCenteredCompleteResponseFirstV19Text,
  validateEventCenteredCompleteResponseFirstV19Output
} from "../../../src/features/interview/event-centered/complete-response-first-v1-9";
import type {
  EventCenteredGenerativeGenerationResult
} from "../../../src/server/services/interview/event-centered-ai.service";
import type {
  Gi088CompleteResponseFirstCase
} from "../../../scripts/gi088-complete-response-first-fixtures";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_9_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-9-local-boundary-continue-priority" as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME = {
  model: "deepseek-v4-pro",
  ...EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME,
  reasoningEffort: null,
  callsPerCase: 1,
  recentTurnLimit: 8
} as const;

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

export const createGi088CompleteResponseFirstV19Input =
  createGi088CompleteResponseFirstV16Input;

export function projectGi088CompleteResponseFirstV19Visible(
  result: EventCenteredGenerativeGenerationResult
) {
  return result.completeResponseText?.trim() ?? "";
}

export function validateGi088CompleteResponseFirstV19Result(input: {
  item: Gi088CompleteResponseFirstCase;
  result: EventCenteredGenerativeGenerationResult;
}) {
  const issues: string[] = [];
  const generationInput = createGi088CompleteResponseFirstV19Input(input.item);
  const visible = projectGi088CompleteResponseFirstV19Visible(input.result);
  if (input.result.architecture !== "one_call") {
    issues.push("PRODUCTION_ARCHITECTURE_NOT_ONE_CALL");
  }
  if (input.result.strategyVersion !== EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_VERSION) {
    issues.push("PRODUCTION_STRATEGY_VERSION_MISMATCH");
  }
  if (input.result.attempts.length !== 1) {
    issues.push("PRODUCTION_CALL_COUNT_NOT_ONE");
  }
  if (!input.result.turn) issues.push("PRODUCTION_TURN_NULL");
  if (!visible) {
    issues.push("PRODUCTION_VISIBLE_RESPONSE_EMPTY");
    return [...new Set(issues)];
  }
  if (input.result.attempts[0]?.responseText?.trim() !== visible) {
    issues.push("PRODUCTION_VISIBLE_RESPONSE_CHANGED");
  }
  issues.push(...validateEventCenteredCompleteResponseFirstV19Output({
    generationInput,
    response: visible
  }));
  return [...new Set(issues)];
}

export function observeGi088CompleteResponseFirstV19Result(input: {
  item: Gi088CompleteResponseFirstCase;
  result: EventCenteredGenerativeGenerationResult;
}) {
  const visible = projectGi088CompleteResponseFirstV19Visible(input.result);
  const observation = observeEventCenteredCompleteResponseFirstV19Text(visible);
  return {
    interaction: input.result.completeResponseEnvelope?.interaction.kind ?? null,
    visibleCharacterCount: observation.characterCount,
    paragraphCount: observation.paragraphCount,
    questionMarkCount: observation.questionMarkCount,
    questionFocusHash: observation.questionFocus
      ? sha(observation.questionFocus)
      : null,
    visibleHash: sha(visible),
    recentTurnCount: createGi088CompleteResponseFirstV19Input(input.item)
      .recentTurns.length
  };
}

export function createGi088CompleteResponseFirstV19Identity() {
  const core = {
    version: GI088_COMPLETE_RESPONSE_FIRST_V1_9_VERSION,
    parentProductionIdentity:
      "2026-08-20.gi088-complete-response-first-v1-8-explicit-progress-obligation",
    productionStrategyVersion:
      EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_9_VERSION,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME,
    inputAdapter:
      "full_checkpoint_to_plain_visible_response_last_8_complete_turns_v1",
    visibleProjection: "provider_text_byte_preserving_single_bubble_v1",
    changedFactor:
      "local_answer_refusal_with_explicit_continue_overrides_global_stop_projection"
  } as const;
  return { ...core, candidateFingerprint: sha(core) };
}
