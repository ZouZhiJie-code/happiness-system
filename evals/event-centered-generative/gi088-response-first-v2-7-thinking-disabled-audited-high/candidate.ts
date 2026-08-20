import { createHash } from "node:crypto";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V26_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V26_RUNTIME,
  createGi088ResponseFirstV26HighUserPrompt,
  createGi088ResponseFirstV26Identity,
  getGi088ResponseFirstV26HighSystemPrompt,
  observeGi088ResponseFirstV26HighOutput,
  parseGi088ResponseFirstV26HighOutput,
  projectGi088ResponseFirstV26VisibleAppend,
  validateGi088ResponseFirstV26HighOutput,
  type Gi088ResponseFirstV26HighOutput
} from "../gi088-response-first-v2-6-low-effort-audited-high/candidate";

export const GI088_RESPONSE_FIRST_V27_VERSION =
  "2026-08-19.gi088-response-first-v2-7-thinking-disabled-audited-high" as const;

export const GI088_RESPONSE_FIRST_V27_HIGH_ASSETS =
  GI088_RESPONSE_FIRST_V26_HIGH_ASSETS;

function omitReasoningEffort<
  T extends { readonly reasoningEffort: unknown }
>(runtime: T): Omit<T, "reasoningEffort"> {
  const result = { ...runtime };
  delete (result as Partial<{ reasoningEffort: unknown }>).reasoningEffort;
  return result;
}

const highRuntimeWithoutReasoningEffort = omitReasoningEffort(
  GI088_RESPONSE_FIRST_V26_RUNTIME.high
);

export const GI088_RESPONSE_FIRST_V27_RUNTIME = {
  ...GI088_RESPONSE_FIRST_V26_RUNTIME,
  high: {
    ...highRuntimeWithoutReasoningEffort,
    thinking: "disabled"
  }
} as const;

export type Gi088ResponseFirstV27HighOutput =
  Gi088ResponseFirstV26HighOutput;

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

export function createGi088ResponseFirstV27HighUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return createGi088ResponseFirstV26HighUserPrompt(input);
}

export function getGi088ResponseFirstV27HighSystemPrompt() {
  return getGi088ResponseFirstV26HighSystemPrompt();
}

export function parseGi088ResponseFirstV27HighOutput(content: string) {
  return parseGi088ResponseFirstV26HighOutput(content);
}

export function projectGi088ResponseFirstV27VisibleAppend(input: {
  frozenLow: string;
  high: Gi088ResponseFirstV27HighOutput;
}) {
  return projectGi088ResponseFirstV26VisibleAppend(input);
}

export function observeGi088ResponseFirstV27HighOutput(
  high: Gi088ResponseFirstV27HighOutput
) {
  return observeGi088ResponseFirstV26HighOutput(high);
}

export function validateGi088ResponseFirstV27HighOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  high: Gi088ResponseFirstV27HighOutput;
}) {
  return validateGi088ResponseFirstV26HighOutput(input);
}

export function createGi088ResponseFirstV27Identity() {
  const parent = createGi088ResponseFirstV26Identity();
  const highSystemPrompt = getGi088ResponseFirstV27HighSystemPrompt();
  return {
    version: GI088_RESPONSE_FIRST_V27_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    frozenLowVersion: parent.frozenLowVersion,
    frozenLowCandidateFingerprint: parent.frozenLowCandidateFingerprint,
    runtime: GI088_RESPONSE_FIRST_V27_RUNTIME,
    highSystemPromptFingerprint: sha(highSystemPrompt),
    parentHighSystemPromptFingerprint: parent.highSystemPromptFingerprint,
    visibleDeliveryContractFingerprint:
      parent.visibleDeliveryContractFingerprint,
    informationGainAuditContractFingerprint:
      parent.informationGainAuditContractFingerprint,
    changedFactor: "high_thinking_enabled_to_disabled_only" as const,
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V27_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V27_RUNTIME,
      changedFactor: "high_thinking_enabled_to_disabled_only",
      highSystemPromptFingerprint: parent.highSystemPromptFingerprint,
      informationGainAuditContractFingerprint:
        parent.informationGainAuditContractFingerprint,
      visibleDeliveryContractFingerprint:
        parent.visibleDeliveryContractFingerprint
    })
  } as const;
}
