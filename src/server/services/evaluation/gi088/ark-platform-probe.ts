import { createHash } from "node:crypto";

import {
  parseBoard7bWorkingTaskV1Output,
  validateBoard7bWorkingTaskV1Output
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import {
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

export const GI088_ARK_PLATFORM_PROBE_VERSION =
  "2026-08-10.gi088-empty-content-ark-flash-platform-probe-v1" as const;
export const GI088_ARK_PLATFORM_PROBE_CALL_BUDGET = 3 as const;
export const GI088_ARK_PLATFORM_PROBE_LEDGER_SCHEMA_VERSION = "1.0" as const;
export const GI088_ARK_PLATFORM_PROBE_RUNTIME = {
  transport: "direct_rest_openai_compatible",
  provider: "volcengine_ark",
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  baseUrlHost: "ark.cn-beijing.volces.com",
  model: "deepseek-v4-flash-ga-260731",
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
export const GI088_ARK_PLATFORM_PROBE_PUBLIC_SUMMARY_CONTRACT = {
  version: "2026-08-10.gi088-ark-platform-public-summary-v1",
  userContent: "excluded",
  prompt: "hash_only",
  rawOutput: "excluded",
  reasoningBody: "excluded",
  validationIssues: "code_only",
  upstreamRequestId: "sha256_or_null"
} as const;

export type Gi088ArkPlatformProbePlan = {
  probeVersion: typeof GI088_ARK_PLATFORM_PROBE_VERSION;
  probeFingerprint: string;
  sourceProbeVersion: string;
  sourceProbeFingerprint: string;
  sourceSnapshotSha256: string;
  sourceEvaluationVersion: string;
  sourceCandidateFingerprint: string;
  sourceExecutionFingerprint: string;
  runtime: typeof GI088_ARK_PLATFORM_PROBE_RUNTIME;
  authorizedCallBudget: typeof GI088_ARK_PLATFORM_PROBE_CALL_BUDGET;
  cases: Gi088EmptyContentProbeCase[];
  ledgerSchemaVersion: typeof GI088_ARK_PLATFORM_PROBE_LEDGER_SCHEMA_VERSION;
  publicSummaryContract: typeof GI088_ARK_PLATFORM_PROBE_PUBLIC_SUMMARY_CONTRACT;
};

export type Gi088ArkPlatformProbeResult = {
  order: number;
  caseId: string;
  contextClass: string;
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

export function createGi088ArkPlatformCompletionParams(
  probeCase: Gi088EmptyContentProbeCase
): AICompletionParams {
  const source = createGi088EmptyContentProbeCompletionParams(
    probeCase,
    "json_object"
  );
  return {
    messages: source.messages,
    useProviderDefaultTemperature: true,
    useProviderDefaultMaxTokens: true,
    headersTimeoutMs: GI088_ARK_PLATFORM_PROBE_RUNTIME.headersTimeoutMs,
    bodyIdleTimeoutMs: GI088_ARK_PLATFORM_PROBE_RUNTIME.bodyIdleTimeoutMs,
    hardTimeoutMs: GI088_ARK_PLATFORM_PROBE_RUNTIME.hardTimeoutMs,
    responseFormat: "json_object",
    thinking: "enabled",
    reasoningEffort: "high"
  } satisfies AICompletionParams;
}

export function createGi088ArkPlatformRequestHash(
  probeCase: Gi088EmptyContentProbeCase
) {
  return sha256(
    JSON.stringify({
      baseUrl: GI088_ARK_PLATFORM_PROBE_RUNTIME.baseUrl,
      model: GI088_ARK_PLATFORM_PROBE_RUNTIME.model,
      params: createGi088ArkPlatformCompletionParams(probeCase)
    })
  );
}

export function createGi088ArkPlatformPublicRequest(
  probeCase: Gi088EmptyContentProbeCase
) {
  const params = createGi088ArkPlatformCompletionParams(probeCase);
  return {
    caseId: probeCase.caseId,
    requestedModel: GI088_ARK_PLATFORM_PROBE_RUNTIME.model,
    requestHash: createGi088ArkPlatformRequestHash(probeCase),
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

export function createGi088ArkPlatformProbePlan(input: {
  snapshot: unknown;
  snapshotBytes: Uint8Array;
}): Gi088ArkPlatformProbePlan {
  const sourcePlan = createGi088EmptyContentProbePlan(input);
  const cases = sourcePlan.cases;
  if (cases.length !== GI088_ARK_PLATFORM_PROBE_CALL_BUDGET) {
    throw new Error("GI088_ARK_PLATFORM_CASE_COUNT_MISMATCH");
  }
  const probeFingerprint = sha256(
    JSON.stringify({
      probeVersion: GI088_ARK_PLATFORM_PROBE_VERSION,
      sourceProbeVersion: sourcePlan.probeVersion,
      sourceProbeFingerprint: sourcePlan.probeFingerprint,
      sourceSnapshotSha256: sourcePlan.sourceSnapshotSha256,
      sourceEvaluationVersion: sourcePlan.sourceEvaluationVersion,
      sourceCandidateFingerprint: sourcePlan.sourceCandidateFingerprint,
      sourceExecutionFingerprint: sourcePlan.sourceExecutionFingerprint,
      runtime: GI088_ARK_PLATFORM_PROBE_RUNTIME,
      authorizedCallBudget: GI088_ARK_PLATFORM_PROBE_CALL_BUDGET,
      cases: cases.map((probeCase) => ({
        ...createGi088EmptyContentProbePublicCase(probeCase),
        request: createGi088ArkPlatformPublicRequest(probeCase)
      })),
      ledgerSchemaVersion: GI088_ARK_PLATFORM_PROBE_LEDGER_SCHEMA_VERSION,
      publicSummaryContract:
        GI088_ARK_PLATFORM_PROBE_PUBLIC_SUMMARY_CONTRACT
    })
  );
  return {
    probeVersion: GI088_ARK_PLATFORM_PROBE_VERSION,
    probeFingerprint,
    sourceProbeVersion: sourcePlan.probeVersion,
    sourceProbeFingerprint: sourcePlan.probeFingerprint,
    sourceSnapshotSha256: sourcePlan.sourceSnapshotSha256,
    sourceEvaluationVersion: sourcePlan.sourceEvaluationVersion,
    sourceCandidateFingerprint: sourcePlan.sourceCandidateFingerprint,
    sourceExecutionFingerprint: sourcePlan.sourceExecutionFingerprint,
    runtime: GI088_ARK_PLATFORM_PROBE_RUNTIME,
    authorizedCallBudget: GI088_ARK_PLATFORM_PROBE_CALL_BUDGET,
    cases,
    ledgerSchemaVersion: GI088_ARK_PLATFORM_PROBE_LEDGER_SCHEMA_VERSION,
    publicSummaryContract: GI088_ARK_PLATFORM_PROBE_PUBLIC_SUMMARY_CONTRACT
  };
}

export async function runGi088ArkPlatformProbeCall(input: {
  provider: AIProvider;
  order: number;
  probeCase: Gi088EmptyContentProbeCase;
}): Promise<Gi088ArkPlatformProbeResult> {
  const params = createGi088ArkPlatformCompletionParams(input.probeCase);
  const base = {
    order: input.order,
    caseId: input.probeCase.caseId,
    contextClass: input.probeCase.contextClass,
    requestedModel: GI088_ARK_PLATFORM_PROBE_RUNTIME.model,
    sourceCallId: input.probeCase.sourceCallId,
    sourceRequestHash: input.probeCase.sourceRequestHash,
    probeRequestHash: createGi088ArkPlatformRequestHash(input.probeCase),
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

export function createGi088ArkPlatformPublicSummary(
  result: Gi088ArkPlatformProbeResult
) {
  const diagnostics = sanitizeAIProviderDiagnostics(result.providerDiagnostics);
  return {
    ...result,
    errorCode:
      result.errorCode === null ||
      /^[A-Z][A-Z0-9_]{0,127}$/u.test(result.errorCode)
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

export function createGi088ArkPlatformDecision(
  results: Gi088ArkPlatformProbeResult[]
) {
  const aggregate = {
    valid: results.filter((item) => item.status === "valid").length,
    emptyContent: results.filter((item) => item.errorCode === "EMPTY_CONTENT")
      .length,
    protectedFailure: results.filter(
      (item) => item.status === "protected_failure"
    ).length,
    otherTechnicalFailure: results.filter(
      (item) =>
        item.status === "technical_failure" &&
        item.errorCode !== "EMPTY_CONTENT"
    ).length
  };
  const disposition =
    aggregate.valid === 3
      ? "ark_flash_platform_candidate_supported"
      : aggregate.emptyContent > 0
        ? "ark_flash_shared_empty_content_risk"
        : aggregate.otherTechnicalFailure > 0
          ? "ark_flash_platform_not_qualified"
          : "ark_flash_quality_contract_requires_review";
  return { aggregate, disposition };
}
