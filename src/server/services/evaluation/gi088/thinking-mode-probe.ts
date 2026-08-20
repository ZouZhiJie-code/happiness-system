import { createHash } from "node:crypto";

import {
  parseBoard7bWorkingTaskV1Output,
  validateBoard7bWorkingTaskV1Output
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import {
  GI088_EMPTY_CONTENT_PROBE_RUNTIME,
  GI088_EMPTY_CONTENT_PROBE_VERSION,
  createGi088EmptyContentProbeCompletionParams,
  createGi088EmptyContentProbePlan,
  createGi088EmptyContentProbePublicCase,
  type Gi088EmptyContentProbeCase
} from "./empty-content-probe";
import type {
  AICompletionParams,
  AIProvider,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAICompletionTokenUsage,
  sanitizeAIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import { createGi088OutputSchemaIssues } from "@/server/services/evaluation/gi088/schema-diagnostics";

export const GI088_THINKING_MODE_PROBE_VERSION =
  "2026-08-09.gi088-empty-content-thinking-mode-probe-v1" as const;
export const GI088_THINKING_MODE_SOURCE_PROBE_FINGERPRINT =
  "7c0fbbb98bc9c3804a5614e90acd0ecb4b13f023e3b96ddf68820a241c6c9b65" as const;
export const GI088_THINKING_MODE_PROBE_CALL_BUDGET = 4 as const;
export const GI088_THINKING_MODE_PROBE_ADAPTER_CONTRACT_VERSION =
  "2026-08-09.gi088-thinking-mode-adapter-v1" as const;
export const GI088_THINKING_MODE_PROBE_DECISION_RULE_VERSION =
  "2026-08-09.gi088-thinking-mode-decision-rule-v1" as const;
export const GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION = "1.0" as const;
export const GI088_THINKING_MODE_PROBE_PUBLIC_SUMMARY_CONTRACT = {
  version: "2026-08-09.gi088-thinking-mode-public-summary-v1",
  userContent: "excluded",
  prompt: "hash_only",
  rawOutput: "excluded",
  reasoningBody: "excluded",
  upstreamRequestId: "sha256_or_null",
  validationIssues: "code_only"
} as const;
export const GI088_THINKING_MODE_PROBE_RUNTIME =
  GI088_EMPTY_CONTENT_PROBE_RUNTIME;
export const GI088_THINKING_MODE_PROBE_CASE_IDS = ["E1", "E3"] as const;
export const GI088_THINKING_MODE_PROBE_VARIANTS = [
  "high",
  "disabled"
] as const;
export const GI088_THINKING_MODE_PROBE_SCHEDULE = [
  { order: 1, caseId: "E1", variant: "high" },
  { order: 2, caseId: "E1", variant: "disabled" },
  { order: 3, caseId: "E3", variant: "disabled" },
  { order: 4, caseId: "E3", variant: "high" }
] as const;
export const GI088_THINKING_MODE_PROBE_DECISION_RULE = {
  supportsThinkingModeAsPrimaryInfluence:
    "disabled returns 2 of 2 valid outputs and high reproduces at least one EMPTY_CONTENT; this is directional support to enter a high-compatible fix candidate and does not confirm a general root cause",
  counterEvidence:
    "a disabled arm returns EMPTY_CONTENT while its paired high arm is valid",
  nonEmptyTechnicalFailure:
    "any non-EMPTY_CONTENT technical failure makes that paired case non-judgeable and does not count as EMPTY_CONTENT support",
  schemaFailure:
    "a high schema failure does not count as EMPTY_CONTENT support",
  inconclusive:
    "both high arms are valid, either paired case is non-judgeable, both variants fail in the same paired case, or results are mixed without the directional pattern",
  productBaselineAfterProbe:
    "retain Thinking high pending a separately confirmed compatible fix"
} as const;

export type Gi088ThinkingModeProbeVariant =
  (typeof GI088_THINKING_MODE_PROBE_VARIANTS)[number];
export type Gi088ThinkingModeProbeCase = Gi088EmptyContentProbeCase;

export type Gi088ThinkingModeProbePlan = {
  probeVersion: typeof GI088_THINKING_MODE_PROBE_VERSION;
  probeFingerprint: string;
  sourceProbeVersion: typeof GI088_EMPTY_CONTENT_PROBE_VERSION;
  sourceProbeFingerprint: typeof GI088_THINKING_MODE_SOURCE_PROBE_FINGERPRINT;
  sourceSnapshotSha256: string;
  sourceEvaluationVersion: string;
  sourceCandidateFingerprint: string;
  sourceExecutionFingerprint: string;
  effectiveCandidateFingerprint: string;
  runtime: typeof GI088_THINKING_MODE_PROBE_RUNTIME;
  authorizedCallBudget: typeof GI088_THINKING_MODE_PROBE_CALL_BUDGET;
  automaticRetries: 0;
  fallbackCalls: 0;
  variants: Gi088ThinkingModeProbeVariant[];
  cases: Gi088ThinkingModeProbeCase[];
  schedule: Array<{
    order: number;
    caseId: (typeof GI088_THINKING_MODE_PROBE_CASE_IDS)[number];
    variant: Gi088ThinkingModeProbeVariant;
  }>;
  decisionRule: typeof GI088_THINKING_MODE_PROBE_DECISION_RULE;
  decisionRuleVersion: typeof GI088_THINKING_MODE_PROBE_DECISION_RULE_VERSION;
  adapterContractVersion: typeof GI088_THINKING_MODE_PROBE_ADAPTER_CONTRACT_VERSION;
  ledgerSchemaVersion: typeof GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION;
  publicSummaryContract: typeof GI088_THINKING_MODE_PROBE_PUBLIC_SUMMARY_CONTRACT;
};

export type Gi088ThinkingModeProbeResult = {
  caseId: string;
  variant: Gi088ThinkingModeProbeVariant;
  sourceCallId: string;
  sourceRequestHash: string;
  probeRequestHash: string;
  requestHashVerified: true;
  status: "valid" | "technical_failure" | "protected_failure";
  errorCode: string | null;
  responseHash: string | null;
  rawFinalOutput: string | null;
  validationIssues: string[];
  latencyMs: number | null;
  tokenUsage: ReturnType<typeof sanitizeAICompletionTokenUsage>;
  providerDiagnostics: AIProviderDiagnostics | null;
};

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function createGi088ThinkingModeProbeCompletionParams(
  probeCase: Gi088ThinkingModeProbeCase,
  variant: Gi088ThinkingModeProbeVariant
): AICompletionParams {
  const base = createGi088EmptyContentProbeCompletionParams(
    probeCase,
    "json_object"
  );
  const common = {
    messages: base.messages,
    useProviderDefaultTemperature: true as const,
    useProviderDefaultMaxTokens: true,
    timeoutMs: 30_000,
    responseFormat: "json_object" as const
  };
  return variant === "high"
    ? {
        ...common,
        thinking: "enabled",
        reasoningEffort: "high"
      }
    : {
        ...common,
        thinking: "disabled"
      };
}

export function createGi088ThinkingModeProbeRequestHash(
  probeCase: Gi088ThinkingModeProbeCase,
  variant: Gi088ThinkingModeProbeVariant
) {
  return sha256(
    JSON.stringify(
      createGi088ThinkingModeProbeCompletionParams(probeCase, variant)
    )
  );
}

export function createGi088ThinkingModeProbePublicRequest(
  probeCase: Gi088ThinkingModeProbeCase,
  variant: Gi088ThinkingModeProbeVariant
) {
  const params = createGi088ThinkingModeProbeCompletionParams(
    probeCase,
    variant
  );
  return {
    caseId: probeCase.caseId,
    variant,
    requestHash: sha256(JSON.stringify(params)),
    messagesHash: sha256(JSON.stringify(params.messages)),
    messageCount: params.messages.length,
    messageRoles: params.messages.map((message) => message.role),
    temperature: params.temperature ?? null,
    useProviderDefaultTemperature:
      params.useProviderDefaultTemperature === true,
    maxTokens: params.maxTokens ?? null,
    useProviderDefaultMaxTokens: params.useProviderDefaultMaxTokens === true,
    timeoutMs: params.timeoutMs ?? null,
    responseFormat: params.responseFormat ?? null,
    thinking: params.thinking ?? null,
    reasoningEffort: params.reasoningEffort ?? null,
    adapterContractVersion:
      GI088_THINKING_MODE_PROBE_ADAPTER_CONTRACT_VERSION
  };
}

export function createGi088ThinkingModeProbePlan(input: {
  snapshot: unknown;
  snapshotBytes: Uint8Array;
}): Gi088ThinkingModeProbePlan {
  const sourcePlan = createGi088EmptyContentProbePlan(input);
  if (
    sourcePlan.probeFingerprint !==
    GI088_THINKING_MODE_SOURCE_PROBE_FINGERPRINT
  ) {
    throw new Error("GI088_THINKING_PROBE_SOURCE_PROBE_MISMATCH");
  }
  const cases = GI088_THINKING_MODE_PROBE_CASE_IDS.map((caseId) => {
    const probeCase = sourcePlan.cases.find((item) => item.caseId === caseId);
    if (!probeCase) {
      throw new Error(`GI088_THINKING_PROBE_CASE_NOT_FOUND:${caseId}`);
    }
    return probeCase;
  });
  const variants = [...GI088_THINKING_MODE_PROBE_VARIANTS];
  const probeFingerprint = sha256(
    JSON.stringify({
      probeVersion: GI088_THINKING_MODE_PROBE_VERSION,
      sourceProbeVersion: sourcePlan.probeVersion,
      sourceProbeFingerprint: sourcePlan.probeFingerprint,
      sourceSnapshotSha256: sourcePlan.sourceSnapshotSha256,
      sourceEvaluationVersion: sourcePlan.sourceEvaluationVersion,
      sourceCandidateFingerprint: sourcePlan.sourceCandidateFingerprint,
      sourceExecutionFingerprint: sourcePlan.sourceExecutionFingerprint,
      effectiveCandidateFingerprint: sourcePlan.effectiveCandidateFingerprint,
      runtime: GI088_THINKING_MODE_PROBE_RUNTIME,
      authorizedCallBudget: GI088_THINKING_MODE_PROBE_CALL_BUDGET,
      automaticRetries: 0,
      fallbackCalls: 0,
      adapterContractVersion:
        GI088_THINKING_MODE_PROBE_ADAPTER_CONTRACT_VERSION,
      decisionRuleVersion: GI088_THINKING_MODE_PROBE_DECISION_RULE_VERSION,
      ledgerSchemaVersion: GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION,
      publicSummaryContract: GI088_THINKING_MODE_PROBE_PUBLIC_SUMMARY_CONTRACT,
      variants,
      cases: cases.map(createGi088EmptyContentProbePublicCase),
      schedule: GI088_THINKING_MODE_PROBE_SCHEDULE.map((item) => {
        const probeCase = cases.find(
          (candidate) => candidate.caseId === item.caseId
        );
        if (!probeCase) {
          throw new Error(
            `GI088_THINKING_PROBE_SCHEDULE_CASE_NOT_FOUND:${item.caseId}`
          );
        }
        return {
          ...item,
          request: createGi088ThinkingModeProbePublicRequest(
            probeCase,
            item.variant
          )
        };
      }),
      decisionRule: GI088_THINKING_MODE_PROBE_DECISION_RULE
    })
  );

  return {
    probeVersion: GI088_THINKING_MODE_PROBE_VERSION,
    probeFingerprint,
    sourceProbeVersion: GI088_EMPTY_CONTENT_PROBE_VERSION,
    sourceProbeFingerprint: GI088_THINKING_MODE_SOURCE_PROBE_FINGERPRINT,
    sourceSnapshotSha256: sourcePlan.sourceSnapshotSha256,
    sourceEvaluationVersion: sourcePlan.sourceEvaluationVersion,
    sourceCandidateFingerprint: sourcePlan.sourceCandidateFingerprint,
    sourceExecutionFingerprint: sourcePlan.sourceExecutionFingerprint,
    effectiveCandidateFingerprint: sourcePlan.effectiveCandidateFingerprint,
    runtime: GI088_THINKING_MODE_PROBE_RUNTIME,
    authorizedCallBudget: GI088_THINKING_MODE_PROBE_CALL_BUDGET,
    automaticRetries: 0,
    fallbackCalls: 0,
    variants,
    cases,
    schedule: GI088_THINKING_MODE_PROBE_SCHEDULE.map((item) => ({ ...item })),
    decisionRule: GI088_THINKING_MODE_PROBE_DECISION_RULE,
    decisionRuleVersion: GI088_THINKING_MODE_PROBE_DECISION_RULE_VERSION,
    adapterContractVersion:
      GI088_THINKING_MODE_PROBE_ADAPTER_CONTRACT_VERSION,
    ledgerSchemaVersion: GI088_THINKING_MODE_PROBE_LEDGER_SCHEMA_VERSION,
    publicSummaryContract: GI088_THINKING_MODE_PROBE_PUBLIC_SUMMARY_CONTRACT
  };
}

export async function runGi088ThinkingModeProbeCall(input: {
  provider: AIProvider;
  probeCase: Gi088ThinkingModeProbeCase;
  variant: Gi088ThinkingModeProbeVariant;
}): Promise<Gi088ThinkingModeProbeResult> {
  const params = createGi088ThinkingModeProbeCompletionParams(
    input.probeCase,
    input.variant
  );
  const probeRequestHash = sha256(JSON.stringify(params));
  let completion: Awaited<ReturnType<AIProvider["complete"]>>;
  try {
    completion = await input.provider.complete(params);
  } catch (error) {
    const diagnostics = getAIProviderDiagnostics(error);
    return {
      caseId: input.probeCase.caseId,
      variant: input.variant,
      sourceCallId: input.probeCase.sourceCallId,
      sourceRequestHash: input.probeCase.sourceRequestHash,
      probeRequestHash,
      requestHashVerified: true,
      status: "technical_failure",
      errorCode: getAIProviderFailureCode(error),
      responseHash: null,
      rawFinalOutput: null,
      validationIssues: [],
      latencyMs: diagnostics?.latencyMs ?? null,
      tokenUsage: diagnostics?.tokenUsage ?? null,
      providerDiagnostics: diagnostics
    };
  }

  try {
    const output = parseBoard7bWorkingTaskV1Output(completion.content);
    const validationIssues = validateBoard7bWorkingTaskV1Output({
      input: input.probeCase.turnInput,
      output
    });
    return {
      caseId: input.probeCase.caseId,
      variant: input.variant,
      sourceCallId: input.probeCase.sourceCallId,
      sourceRequestHash: input.probeCase.sourceRequestHash,
      probeRequestHash,
      requestHashVerified: true,
      status: validationIssues.length ? "protected_failure" : "valid",
      errorCode: validationIssues.length ? "MODEL_OUTPUT_PROTECTED" : null,
      responseHash: sha256(completion.content),
      rawFinalOutput: completion.content,
      validationIssues,
      latencyMs: completion.latencyMs,
      tokenUsage: sanitizeAICompletionTokenUsage(completion.tokenUsage),
      providerDiagnostics: sanitizeAIProviderDiagnostics(completion.diagnostics)
    };
  } catch (error) {
    return {
      caseId: input.probeCase.caseId,
      variant: input.variant,
      sourceCallId: input.probeCase.sourceCallId,
      sourceRequestHash: input.probeCase.sourceRequestHash,
      probeRequestHash,
      requestHashVerified: true,
      status: "protected_failure",
      errorCode: "MODEL_OUTPUT_PROTECTED",
      responseHash: sha256(completion.content),
      rawFinalOutput: completion.content,
      validationIssues: createGi088OutputSchemaIssues(error),
      latencyMs: completion.latencyMs,
      tokenUsage: sanitizeAICompletionTokenUsage(completion.tokenUsage),
      providerDiagnostics: sanitizeAIProviderDiagnostics(completion.diagnostics)
    };
  }
}

export function createGi088ThinkingModeProbePublicSummary(
  result: Gi088ThinkingModeProbeResult
) {
  const errorCode =
    result.errorCode === null ||
    /^[A-Z][A-Z0-9_]{0,127}$/u.test(result.errorCode)
      ? result.errorCode
      : "PROVIDER_ERROR";
  const validationIssues = [
    ...new Set(
      result.validationIssues.map((issue) => {
        const code = issue.split(":", 1)[0] ?? "";
        return /^[A-Z][A-Z0-9_]{0,127}$/u.test(code)
          ? code
          : "VALIDATION_ISSUE";
      })
    )
  ];
  const diagnostics = sanitizeAIProviderDiagnostics(result.providerDiagnostics);
  let publicDiagnostics = null;
  if (diagnostics) {
    const { upstreamRequestId, ...diagnosticFields } = diagnostics;
    publicDiagnostics = {
      ...diagnosticFields,
      upstreamRequestIdHash: upstreamRequestId
        ? sha256(upstreamRequestId)
        : null
    };
  }
  return {
    caseId: result.caseId,
    variant: result.variant,
    sourceCallId: result.sourceCallId,
    sourceRequestHash: result.sourceRequestHash,
    probeRequestHash: result.probeRequestHash,
    requestHashVerified: result.requestHashVerified,
    status: result.status,
    errorCode,
    responseHash: result.responseHash,
    validationIssues,
    latencyMs: result.latencyMs,
    tokenUsage: sanitizeAICompletionTokenUsage(result.tokenUsage),
    providerDiagnostics: publicDiagnostics
  };
}
