import { createHash } from "node:crypto";

import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_RUNTIME,
  createGi088CompleteResponseFirstV12ProductionInput,
  observeGi088CompleteResponseFirstV12ProductionResult,
  projectGi088CompleteResponseFirstV12ProductionVisible,
  validateGi088CompleteResponseFirstV12ProductionResult
} from "../gi088-complete-response-first-v1-2-production-contract/candidate";
import {
  EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_VERSION
} from "../../../src/features/interview/event-centered/complete-response-first-v1-2-1";
import type {
  EventCenteredGenerativeGenerationResult
} from "../../../src/server/services/interview/event-centered-ai.service";
import type {
  Gi088CompleteResponseFirstCase
} from "../../../scripts/gi088-complete-response-first-fixtures";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_2_1_VERSION =
  "2026-08-20.gi088-complete-response-first-v1-2-1-json-mode-off" as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_2_1_RUNTIME = {
  ...GI088_COMPLETE_RESPONSE_FIRST_V1_2_PRODUCTION_RUNTIME,
  responseFormat: null
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

export const createGi088CompleteResponseFirstV121Input =
  createGi088CompleteResponseFirstV12ProductionInput;

export const projectGi088CompleteResponseFirstV121Visible =
  projectGi088CompleteResponseFirstV12ProductionVisible;

export function validateGi088CompleteResponseFirstV121Result(input: {
  item: Gi088CompleteResponseFirstCase;
  result: EventCenteredGenerativeGenerationResult;
}) {
  const issues = validateGi088CompleteResponseFirstV12ProductionResult(input)
    .filter((issue) => issue !== "PRODUCTION_STRATEGY_VERSION_MISMATCH");
  if (input.result.strategyVersion !== EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_VERSION) {
    issues.push("PRODUCTION_STRATEGY_VERSION_MISMATCH");
  }
  return [...new Set(issues)];
}

export const observeGi088CompleteResponseFirstV121Result =
  observeGi088CompleteResponseFirstV12ProductionResult;

export function createGi088CompleteResponseFirstV121Identity() {
  const core = {
    version: GI088_COMPLETE_RESPONSE_FIRST_V1_2_1_VERSION,
    parentProductionIdentity:
      "2026-08-20.gi088-complete-response-first-v1-2-production-contract-quality-v1",
    productionStrategyVersion:
      EVENT_CENTERED_COMPLETE_RESPONSE_FIRST_V1_2_1_VERSION,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_2_1_RUNTIME,
    inputAdapter: "full_checkpoint_to_minimal_envelope_last_8_complete_turns_v1",
    visibleProjection: "model_response_byte_preserving_single_bubble_v1",
    changedFactor: "provider_response_format_json_object_to_omitted"
  } as const;
  return { ...core, candidateFingerprint: sha(core) };
}
