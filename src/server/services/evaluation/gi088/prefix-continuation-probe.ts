import { createHash } from "node:crypto";

import {
  GI088_PREFIX_CONTINUATION_POLICY,
  createGi088EffectiveCandidateFingerprint,
  createGi088ExecutionFingerprint
} from "./candidate";

export const GI088_PREFIX_PROBE_VERSION =
  "2026-08-10.gi088-prefix-beta-compatibility-probe-v1" as const;
export const GI088_PREFIX_PROBE_CALL_BUDGET = 1 as const;
export const GI088_PREFIX_PROBE_RUNTIME = {
  provider: "openai",
  model: "deepseek-v4-flash",
  baseUrlHost: "api.deepseek.com",
  endpoint: "/beta/chat/completions",
  thinking: "enabled",
  reasoningEffort: "high",
  responseFormat: "json_object",
  visiblePrefix: "{",
  automaticRetries: 0,
  fallbackCalls: 0
} as const;

export const GI088_PREFIX_PROBE_USER_MESSAGE =
  "这是一次合成兼容检查。请继续输出一个 JSON 对象，其中 ok 为 true，note 为 prefix-compatible。" as const;
export const GI088_PREFIX_PROBE_SYNTHETIC_REASONING =
  "The user requests a small JSON object. The final visible answer should contain ok=true and note=prefix-compatible." as const;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createGi088PrefixProbePlan() {
  const safeRequest = {
    messagesHash: sha256(GI088_PREFIX_PROBE_USER_MESSAGE),
    syntheticReasoningHash: sha256(GI088_PREFIX_PROBE_SYNTHETIC_REASONING),
    syntheticReasoningLength: GI088_PREFIX_PROBE_SYNTHETIC_REASONING.length,
    visiblePrefix: GI088_PREFIX_PROBE_RUNTIME.visiblePrefix,
    hiddenReasoningPersistence: "forbidden"
  } as const;
  const base = {
    probeVersion: GI088_PREFIX_PROBE_VERSION,
    candidateFingerprint: createGi088EffectiveCandidateFingerprint(),
    executionFingerprint: createGi088ExecutionFingerprint(),
    recoveryPolicyVersion: GI088_PREFIX_CONTINUATION_POLICY.version,
    runtime: GI088_PREFIX_PROBE_RUNTIME,
    authorizedCallBudget: GI088_PREFIX_PROBE_CALL_BUDGET,
    safeRequest,
    publicSummaryContract: {
      prompt: "hash_only",
      rawOutput: "excluded",
      reasoningBody: "excluded",
      responseContent: "hash_and_json_shape_only",
      diagnostics: "safe_provider_summary_only"
    }
  } as const;
  return {
    ...base,
    probeFingerprint: sha256(JSON.stringify(base))
  };
}
