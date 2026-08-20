import { createHash } from "node:crypto";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V25_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V25_RUNTIME,
  createGi088ResponseFirstV25HighUserPrompt,
  createGi088ResponseFirstV25Identity,
  getGi088ResponseFirstV25HighSystemPrompt,
  observeGi088ResponseFirstV25HighOutput,
  parseGi088ResponseFirstV25HighOutput,
  projectGi088ResponseFirstV25VisibleAppend,
  validateGi088ResponseFirstV25HighOutput,
  type Gi088ResponseFirstV25HighOutput
} from "../gi088-response-first-v2-5-question-self-answer/candidate";

export const GI088_RESPONSE_FIRST_V26_VERSION =
  "2026-08-19.gi088-response-first-v2-6-low-effort-audited-high" as const;

export const GI088_RESPONSE_FIRST_V26_HIGH_ASSETS =
  GI088_RESPONSE_FIRST_V25_HIGH_ASSETS;

export const GI088_RESPONSE_FIRST_V26_RUNTIME = {
  ...GI088_RESPONSE_FIRST_V25_RUNTIME,
  high: {
    ...GI088_RESPONSE_FIRST_V25_RUNTIME.high,
    reasoningEffort: "low"
  }
} as const;

export type Gi088ResponseFirstV26HighOutput =
  Gi088ResponseFirstV25HighOutput;

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

export function createGi088ResponseFirstV26HighUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return createGi088ResponseFirstV25HighUserPrompt(input);
}

export function getGi088ResponseFirstV26HighSystemPrompt() {
  return getGi088ResponseFirstV25HighSystemPrompt();
}

export function parseGi088ResponseFirstV26HighOutput(content: string) {
  return parseGi088ResponseFirstV25HighOutput(content);
}

export function projectGi088ResponseFirstV26VisibleAppend(input: {
  frozenLow: string;
  high: Gi088ResponseFirstV26HighOutput;
}) {
  return projectGi088ResponseFirstV25VisibleAppend(input);
}

export function observeGi088ResponseFirstV26HighOutput(
  high: Gi088ResponseFirstV26HighOutput
) {
  return observeGi088ResponseFirstV25HighOutput(high);
}

export function validateGi088ResponseFirstV26HighOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  high: Gi088ResponseFirstV26HighOutput;
}) {
  return validateGi088ResponseFirstV25HighOutput(input);
}

export function createGi088ResponseFirstV26Identity() {
  const parent = createGi088ResponseFirstV25Identity();
  const highSystemPrompt = getGi088ResponseFirstV26HighSystemPrompt();
  return {
    version: GI088_RESPONSE_FIRST_V26_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    frozenLowVersion: parent.frozenLowVersion,
    frozenLowCandidateFingerprint: parent.frozenLowCandidateFingerprint,
    runtime: GI088_RESPONSE_FIRST_V26_RUNTIME,
    highSystemPromptFingerprint: sha(highSystemPrompt),
    parentHighSystemPromptFingerprint: parent.highSystemPromptFingerprint,
    visibleDeliveryContractFingerprint:
      parent.visibleDeliveryContractFingerprint,
    informationGainAuditContractFingerprint:
      parent.informationGainAuditContractFingerprint,
    changedFactor: "high_reasoning_effort_high_to_low_only" as const,
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V26_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V26_RUNTIME,
      changedFactor: "high_reasoning_effort_high_to_low_only",
      highSystemPromptFingerprint: parent.highSystemPromptFingerprint,
      informationGainAuditContractFingerprint:
        parent.informationGainAuditContractFingerprint,
      visibleDeliveryContractFingerprint:
        parent.visibleDeliveryContractFingerprint
    })
  } as const;
}
