import { createHash } from "node:crypto";

import {
  parseGi088CompleteResponseFirstV11Output,
  validateGi088CompleteResponseFirstV11Output
} from "../gi088-complete-response-first-v1-1/candidate";
import {
  createGi088CompleteResponseFirstV14Input
} from "../gi088-complete-response-first-v1-4-grounded-intent-owner/candidate";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_RUNTIME,
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_VERSION,
  observeEventCenteredCompleteResponseFirstV15Text,
  validateEventCenteredCompleteResponseFirstV15Output
} from "../../../src/features/interview/event-centered/complete-response-first-v1-5";
import type {
  EventCenteredGenerativeGenerationResult
} from "../../../src/server/services/interview/event-centered-ai.service";
import type {
  Gi088CompleteResponseFirstCase
} from "../../../scripts/gi088-complete-response-first-fixtures";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_5_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-5-semantic-layer-coverage" as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_5_RUNTIME = {
  model: "deepseek-v4-pro",
  ...EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_RUNTIME,
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

export const createGi088CompleteResponseFirstV15Input =
  createGi088CompleteResponseFirstV14Input;

export function projectGi088CompleteResponseFirstV15Visible(
  result: EventCenteredGenerativeGenerationResult
) {
  return result.completeResponseText?.trim() ?? "";
}

export function validateGi088CompleteResponseFirstV15Result(input: {
  item: Gi088CompleteResponseFirstCase;
  result: EventCenteredGenerativeGenerationResult;
}) {
  const issues: string[] = [];
  const generationInput = createGi088CompleteResponseFirstV15Input(input.item);
  const visible = projectGi088CompleteResponseFirstV15Visible(input.result);
  if (input.result.architecture !== "one_call") {
    issues.push("PRODUCTION_ARCHITECTURE_NOT_ONE_CALL");
  }
  if (
    input.result.strategyVersion !==
      EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_VERSION
  ) {
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
  issues.push(...validateEventCenteredCompleteResponseFirstV15Output({
    generationInput,
    response: visible
  }));
  issues.push(...validateGi088CompleteResponseFirstV11Output({
    turnInput: input.item.turnInput,
    output: parseGi088CompleteResponseFirstV11Output(visible)
  }));
  return [...new Set(issues)];
}

export function observeGi088CompleteResponseFirstV15Result(input: {
  item: Gi088CompleteResponseFirstCase;
  result: EventCenteredGenerativeGenerationResult;
}) {
  const visible = projectGi088CompleteResponseFirstV15Visible(input.result);
  const observation = observeEventCenteredCompleteResponseFirstV15Text(visible);
  return {
    interaction: input.result.completeResponseEnvelope?.interaction.kind ?? null,
    visibleCharacterCount: observation.characterCount,
    paragraphCount: observation.paragraphCount,
    questionMarkCount: observation.questionMarkCount,
    questionFocusHash: observation.questionFocus
      ? sha(observation.questionFocus)
      : null,
    visibleHash: sha(visible),
    recentTurnCount: createGi088CompleteResponseFirstV15Input(input.item)
      .recentTurns.length
  };
}

export function createGi088CompleteResponseFirstV15Identity() {
  const core = {
    version: GI088_COMPLETE_RESPONSE_FIRST_V1_5_VERSION,
    parentProductionIdentity:
      "2026-08-20.gi088-complete-response-first-v1-4-grounded-intent-owner-quality-v1",
    productionStrategyVersion:
      EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_5_VERSION,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_5_RUNTIME,
    inputAdapter:
      "full_checkpoint_to_plain_visible_response_last_8_complete_turns_v1",
    visibleProjection: "provider_text_byte_preserving_single_bubble_v1",
    changedFactor: "semantic_layer_coverage_before_new_information_target"
  } as const;
  return { ...core, candidateFingerprint: sha(core) };
}
