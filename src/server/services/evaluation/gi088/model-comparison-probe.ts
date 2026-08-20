import { createHash } from "node:crypto";

import {
  parseBoard7bWorkingTaskV1Output,
  validateBoard7bWorkingTaskV1Output
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import {
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

export const GI088_MODEL_COMPARISON_PROBE_VERSION =
  "2026-08-10.gi088-empty-content-flash-pro-comparison-v1" as const;
export const GI088_MODEL_COMPARISON_SOURCE_PROBE_FINGERPRINT =
  "7c0fbbb98bc9c3804a5614e90acd0ecb4b13f023e3b96ddf68820a241c6c9b65" as const;
export const GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET = 6 as const;
export const GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION = "1.0" as const;
export const GI088_MODEL_COMPARISON_PUBLIC_SUMMARY_CONTRACT = {
  version: "2026-08-10.gi088-model-comparison-public-summary-v1",
  userContent: "excluded",
  prompt: "hash_only",
  rawOutput: "excluded",
  reasoningBody: "excluded",
  validationIssues: "code_only",
  upstreamRequestId: "sha256_or_null"
} as const;
export const GI088_MODEL_COMPARISON_VARIANTS = ["flash", "pro"] as const;
export type Gi088ModelComparisonVariant =
  (typeof GI088_MODEL_COMPARISON_VARIANTS)[number];

export const GI088_MODEL_COMPARISON_RUNTIME = {
  provider: "openai",
  baseUrl: "https://api.deepseek.com",
  baseUrlHost: "api.deepseek.com",
  models: {
    flash: "deepseek-v4-flash",
    pro: "deepseek-v4-pro"
  },
  thinking: "enabled",
  reasoningEffort: "high",
  responseFormat: "json_object",
  useProviderDefaultTemperature: true,
  useProviderDefaultMaxTokens: true,
  headersTimeoutMs: 15_000,
  bodyIdleTimeoutMs: 45_000,
  hardTimeoutMs: 60_000,
  automaticRetries: 0,
  fallbackCalls: 0
} as const;

export const GI088_MODEL_COMPARISON_SCHEDULE = [
  { order: 1, caseId: "E1", variant: "flash" },
  { order: 2, caseId: "E1", variant: "pro" },
  { order: 3, caseId: "E2", variant: "pro" },
  { order: 4, caseId: "E2", variant: "flash" },
  { order: 5, caseId: "E3", variant: "flash" },
  { order: 6, caseId: "E3", variant: "pro" }
] as const satisfies readonly {
  order: number;
  caseId: "E1" | "E2" | "E3";
  variant: Gi088ModelComparisonVariant;
}[];

export type Gi088ModelComparisonProbeCase = Gi088EmptyContentProbeCase;

export type Gi088ModelComparisonProbePlan = {
  probeVersion: typeof GI088_MODEL_COMPARISON_PROBE_VERSION;
  probeFingerprint: string;
  sourceProbeVersion: typeof GI088_EMPTY_CONTENT_PROBE_VERSION;
  sourceProbeFingerprint: typeof GI088_MODEL_COMPARISON_SOURCE_PROBE_FINGERPRINT;
  sourceSnapshotSha256: string;
  sourceEvaluationVersion: string;
  sourceCandidateFingerprint: string;
  sourceExecutionFingerprint: string;
  runtime: typeof GI088_MODEL_COMPARISON_RUNTIME;
  authorizedCallBudget: typeof GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET;
  cases: Gi088ModelComparisonProbeCase[];
  schedule: Array<{
    order: number;
    caseId: "E1" | "E2" | "E3";
    variant: Gi088ModelComparisonVariant;
  }>;
  ledgerSchemaVersion: typeof GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION;
  publicSummaryContract: typeof GI088_MODEL_COMPARISON_PUBLIC_SUMMARY_CONTRACT;
};

export type Gi088ModelComparisonProbeResult = {
  order: number;
  caseId: string;
  contextClass: string;
  variant: Gi088ModelComparisonVariant;
  requestedModel: string;
  sourceCallId: string;
  sourceRequestHash: string;
  probeRequestHash: string;
  requestHashVerified: true;
  status: "valid" | "technical_failure" | "protected_failure";
  errorCode: string | null;
  responseHash: string | null;
  validationIssues: string[];
  latencyMs: number | null;
  tokenUsage: ReturnType<typeof sanitizeAICompletionTokenUsage>;
  providerDiagnostics: AIProviderDiagnostics | null;
};

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function createGi088ModelComparisonCompletionParams(
  probeCase: Gi088ModelComparisonProbeCase
): AICompletionParams {
  const source = createGi088EmptyContentProbeCompletionParams(
    probeCase,
    "json_object"
  );
  return {
    messages: source.messages,
    useProviderDefaultTemperature: true,
    useProviderDefaultMaxTokens: true,
    headersTimeoutMs: GI088_MODEL_COMPARISON_RUNTIME.headersTimeoutMs,
    bodyIdleTimeoutMs: GI088_MODEL_COMPARISON_RUNTIME.bodyIdleTimeoutMs,
    hardTimeoutMs: GI088_MODEL_COMPARISON_RUNTIME.hardTimeoutMs,
    responseFormat: "json_object",
    thinking: "enabled",
    reasoningEffort: "high"
  } satisfies AICompletionParams;
}

export function createGi088ModelComparisonRequestHash(input: {
  probeCase: Gi088ModelComparisonProbeCase;
  variant: Gi088ModelComparisonVariant;
}) {
  return sha256(
    JSON.stringify({
      model: GI088_MODEL_COMPARISON_RUNTIME.models[input.variant],
      params: createGi088ModelComparisonCompletionParams(input.probeCase)
    })
  );
}

export function createGi088ModelComparisonPublicRequest(input: {
  probeCase: Gi088ModelComparisonProbeCase;
  variant: Gi088ModelComparisonVariant;
}) {
  const params = createGi088ModelComparisonCompletionParams(input.probeCase);
  return {
    caseId: input.probeCase.caseId,
    variant: input.variant,
    requestedModel: GI088_MODEL_COMPARISON_RUNTIME.models[input.variant],
    requestHash: createGi088ModelComparisonRequestHash(input),
    messagesHash: sha256(JSON.stringify(params.messages)),
    messageCount: params.messages.length,
    messageRoles: params.messages.map((message) => message.role),
    useProviderDefaultTemperature:
      params.useProviderDefaultTemperature === true,
    useProviderDefaultMaxTokens: params.useProviderDefaultMaxTokens === true,
    headersTimeoutMs: params.headersTimeoutMs,
    bodyIdleTimeoutMs: params.bodyIdleTimeoutMs,
    hardTimeoutMs: params.hardTimeoutMs,
    responseFormat: params.responseFormat,
    thinking: params.thinking,
    reasoningEffort: params.reasoningEffort
  };
}

export function createGi088ModelComparisonProbePlan(input: {
  snapshot: unknown;
  snapshotBytes: Uint8Array;
}): Gi088ModelComparisonProbePlan {
  const sourcePlan = createGi088EmptyContentProbePlan(input);
  if (
    sourcePlan.probeFingerprint !==
    GI088_MODEL_COMPARISON_SOURCE_PROBE_FINGERPRINT
  ) {
    throw new Error("GI088_MODEL_COMPARISON_SOURCE_PROBE_MISMATCH");
  }
  const cases = sourcePlan.cases;
  const schedule = GI088_MODEL_COMPARISON_SCHEDULE.map((item) => ({
    ...item
  }));
  const publicSchedule = schedule.map((item) => {
    const probeCase = cases.find((candidate) => candidate.caseId === item.caseId);
    if (!probeCase) {
      throw new Error(`GI088_MODEL_COMPARISON_CASE_NOT_FOUND:${item.caseId}`);
    }
    return {
      ...item,
      request: createGi088ModelComparisonPublicRequest({
        probeCase,
        variant: item.variant
      })
    };
  });
  const probeFingerprint = sha256(
    JSON.stringify({
      probeVersion: GI088_MODEL_COMPARISON_PROBE_VERSION,
      sourceProbeVersion: sourcePlan.probeVersion,
      sourceProbeFingerprint: sourcePlan.probeFingerprint,
      sourceSnapshotSha256: sourcePlan.sourceSnapshotSha256,
      sourceEvaluationVersion: sourcePlan.sourceEvaluationVersion,
      sourceCandidateFingerprint: sourcePlan.sourceCandidateFingerprint,
      sourceExecutionFingerprint: sourcePlan.sourceExecutionFingerprint,
      runtime: GI088_MODEL_COMPARISON_RUNTIME,
      authorizedCallBudget: GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET,
      cases: cases.map(createGi088EmptyContentProbePublicCase),
      schedule: publicSchedule,
      ledgerSchemaVersion: GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION,
      publicSummaryContract: GI088_MODEL_COMPARISON_PUBLIC_SUMMARY_CONTRACT
    })
  );
  return {
    probeVersion: GI088_MODEL_COMPARISON_PROBE_VERSION,
    probeFingerprint,
    sourceProbeVersion: sourcePlan.probeVersion,
    sourceProbeFingerprint: GI088_MODEL_COMPARISON_SOURCE_PROBE_FINGERPRINT,
    sourceSnapshotSha256: sourcePlan.sourceSnapshotSha256,
    sourceEvaluationVersion: sourcePlan.sourceEvaluationVersion,
    sourceCandidateFingerprint: sourcePlan.sourceCandidateFingerprint,
    sourceExecutionFingerprint: sourcePlan.sourceExecutionFingerprint,
    runtime: GI088_MODEL_COMPARISON_RUNTIME,
    authorizedCallBudget: GI088_MODEL_COMPARISON_PROBE_CALL_BUDGET,
    cases,
    schedule,
    ledgerSchemaVersion: GI088_MODEL_COMPARISON_LEDGER_SCHEMA_VERSION,
    publicSummaryContract: GI088_MODEL_COMPARISON_PUBLIC_SUMMARY_CONTRACT
  };
}

export async function runGi088ModelComparisonProbeCall(input: {
  provider: AIProvider;
  order: number;
  probeCase: Gi088ModelComparisonProbeCase;
  variant: Gi088ModelComparisonVariant;
}): Promise<Gi088ModelComparisonProbeResult> {
  const params = createGi088ModelComparisonCompletionParams(input.probeCase);
  const probeRequestHash = createGi088ModelComparisonRequestHash({
    probeCase: input.probeCase,
    variant: input.variant
  });
  const base = {
    order: input.order,
    caseId: input.probeCase.caseId,
    contextClass: input.probeCase.contextClass,
    variant: input.variant,
    requestedModel: GI088_MODEL_COMPARISON_RUNTIME.models[input.variant],
    sourceCallId: input.probeCase.sourceCallId,
    sourceRequestHash: input.probeCase.sourceRequestHash,
    probeRequestHash,
    requestHashVerified: true as const
  };
  let completion: Awaited<ReturnType<AIProvider["complete"]>>;
  try {
    completion = await input.provider.complete(params);
  } catch (error) {
    const diagnostics = getAIProviderDiagnostics(error);
    return {
      ...base,
      status: "technical_failure",
      errorCode: getAIProviderFailureCode(error),
      responseHash: null,
      validationIssues: [],
      latencyMs: diagnostics?.latencyMs ?? null,
      tokenUsage: sanitizeAICompletionTokenUsage(diagnostics?.tokenUsage),
      providerDiagnostics: sanitizeAIProviderDiagnostics(diagnostics)
    };
  }
  try {
    const output = parseBoard7bWorkingTaskV1Output(completion.content);
    const validationIssues = validateBoard7bWorkingTaskV1Output({
      input: input.probeCase.turnInput,
      output
    });
    return {
      ...base,
      status: validationIssues.length ? "protected_failure" : "valid",
      errorCode: validationIssues.length ? "MODEL_OUTPUT_PROTECTED" : null,
      responseHash: sha256(completion.content),
      validationIssues,
      latencyMs: completion.latencyMs,
      tokenUsage: sanitizeAICompletionTokenUsage(completion.tokenUsage),
      providerDiagnostics: sanitizeAIProviderDiagnostics(completion.diagnostics)
    };
  } catch (error) {
    return {
      ...base,
      status: "protected_failure",
      errorCode: "MODEL_OUTPUT_PROTECTED",
      responseHash: sha256(completion.content),
      validationIssues: createGi088OutputSchemaIssues(error),
      latencyMs: completion.latencyMs,
      tokenUsage: sanitizeAICompletionTokenUsage(completion.tokenUsage),
      providerDiagnostics: sanitizeAIProviderDiagnostics(completion.diagnostics)
    };
  }
}

function sanitizeIssueCodes(issues: string[]) {
  return [
    ...new Set(
      issues.map((issue) => {
        const code = issue.split(":", 1)[0] ?? "";
        return /^[A-Z][A-Z0-9_]{0,127}$/u.test(code)
          ? code
          : "VALIDATION_ISSUE";
      })
    )
  ];
}

export function createGi088ModelComparisonPublicSummary(
  result: Gi088ModelComparisonProbeResult
) {
  const diagnostics = sanitizeAIProviderDiagnostics(result.providerDiagnostics);
  return {
    ...result,
    errorCode:
      result.errorCode === null || /^[A-Z][A-Z0-9_]{0,127}$/u.test(result.errorCode)
        ? result.errorCode
        : "PROVIDER_ERROR",
    validationIssues: sanitizeIssueCodes(result.validationIssues),
    tokenUsage: sanitizeAICompletionTokenUsage(result.tokenUsage),
    providerDiagnostics: diagnostics
      ? {
          ...diagnostics,
          upstreamRequestId: diagnostics.upstreamRequestId
            ? sha256(diagnostics.upstreamRequestId)
            : null
        }
      : null
  };
}

export function createGi088ModelComparisonDecision(
  results: Gi088ModelComparisonProbeResult[]
) {
  const aggregate = Object.fromEntries(
    GI088_MODEL_COMPARISON_VARIANTS.map((variant) => {
      const items = results.filter((result) => result.variant === variant);
      return [
        variant,
        {
          valid: items.filter((item) => item.status === "valid").length,
          emptyContent: items.filter(
            (item) => item.errorCode === "EMPTY_CONTENT"
          ).length,
          protectedFailure: items.filter(
            (item) => item.status === "protected_failure"
          ).length,
          otherTechnicalFailure: items.filter(
            (item) => item.status === "technical_failure" && item.errorCode !== "EMPTY_CONTENT"
          ).length
        }
      ];
    })
  ) as Record<Gi088ModelComparisonVariant, {
    valid: number;
    emptyContent: number;
    protectedFailure: number;
    otherTechnicalFailure: number;
  }>;
  const pro = aggregate.pro;
  const flash = aggregate.flash;
  const disposition =
    pro.valid === 3 && flash.valid < 3
      ? "directional_support_for_pro_candidate"
      : pro.emptyContent > 0
        ? "shared_empty_content_risk_pro_not_qualified"
        : pro.valid < flash.valid
          ? "reject_pro_candidate"
          : "inconclusive_intermittent_failure_not_reproduced";
  return { aggregate, disposition };
}
