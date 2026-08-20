import { createHash } from "node:crypto";

import {
  GI088_RESPONSE_FIRST_V23_RUNTIME,
  createGi088ResponseFirstV23Identity
} from "../gi088-response-first-v2-3/candidate";

export {
  createGi088ResponseFirstV23HighUserPrompt as createGi088ResponseFirstV23Token4000HighUserPrompt,
  getGi088ResponseFirstV23HighSystemPrompt as getGi088ResponseFirstV23Token4000HighSystemPrompt,
  observeGi088ResponseFirstV23Questions as observeGi088ResponseFirstV23Token4000Questions,
  parseGi088ResponseFirstV23HighOutput as parseGi088ResponseFirstV23Token4000HighOutput,
  projectGi088ResponseFirstV23VisibleDelivery as projectGi088ResponseFirstV23Token4000VisibleDelivery,
  validateGi088ResponseFirstV23HighAndProjection as validateGi088ResponseFirstV23Token4000HighAndProjection,
  type Gi088ResponseFirstV23HighOutput as Gi088ResponseFirstV23Token4000HighOutput
} from "../gi088-response-first-v2-3/candidate";

export const GI088_RESPONSE_FIRST_V23_TOKEN_4000_VERSION =
  "2026-08-17.gi088-response-first-v2-3-grounded-high-max4000" as const;

export const GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME = {
  ...GI088_RESPONSE_FIRST_V23_RUNTIME,
  high: {
    ...GI088_RESPONSE_FIRST_V23_RUNTIME.high,
    maxTokens: 4_000
  }
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

export function createGi088ResponseFirstV23Token4000Identity() {
  const parent = createGi088ResponseFirstV23Identity();
  return {
    version: GI088_RESPONSE_FIRST_V23_TOKEN_4000_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    frozenLowVersion: parent.frozenLowVersion,
    frozenLowCandidateFingerprint: parent.frozenLowCandidateFingerprint,
    runtime: GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME,
    highSystemPromptFingerprint: parent.highSystemPromptFingerprint,
    visibleDeliveryContractFingerprint:
      parent.visibleDeliveryContractFingerprint,
    changedFactor: "high_max_tokens_2000_to_4000_only" as const,
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V23_TOKEN_4000_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME,
      highSystemPromptFingerprint: parent.highSystemPromptFingerprint,
      visibleDeliveryContractFingerprint:
        parent.visibleDeliveryContractFingerprint,
      changedFactor: "high_max_tokens_2000_to_4000_only"
    })
  };
}
