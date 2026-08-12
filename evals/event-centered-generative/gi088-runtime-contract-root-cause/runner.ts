import { createHash } from "node:crypto";
import {
  chmod,
  link,
  mkdir,
  readFile,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import { resolve } from "node:path";

import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAICompletionTokenUsage,
  sanitizeAIProviderDiagnostics,
  type AICompletionResult,
  type AIProvider,
  type AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import { normalizeGi088DeterministicStateOutput } from "@/server/services/evaluation/gi088/deterministic-state";
import {
  applyGi088SemanticDeltaValidatedResult,
  assertGi088SemanticDeltaOutput,
  parseGi088SemanticDeltaCandidateOutput,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput,
  type Gi088SemanticDeltaOutput
} from "@/server/services/evaluation/gi088/semantic-delta";
import { applyGi088SingleFocusValidationPolicy } from "@/server/services/evaluation/gi088/single-focus";
import { validateGi088StageTransitionOutput } from "@/server/services/evaluation/gi088/stage-transition";
import {
  createGi088V8r3OfflineTurnInput
} from "../gi088-v8r3-skill-evaluation/offline-executor";
import {
  createGi088V8r3CaseFingerprint,
  getGi088V8r3ConversationAtCheckpoint
} from "../gi088-v8r3-skill-evaluation/runner";
import type {
  Gi088V8r3EvaluationCase
} from "../gi088-v8r3-skill-evaluation/contracts";
import {
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_CONCURRENCY,
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_GROUP_CALLS,
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS,
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_REPORT_VERSION,
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_SHORTLIST_MINIMUM,
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM,
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_VERSION,
  GI088_RUNTIME_CONTRACT_FINAL_CASE_IDS,
  GI088_RUNTIME_CONTRACT_GROUP_ORDER,
  createGi088RuntimeContractCompletionParams,
  createGi088RuntimeContractDiagnosticFingerprint,
  createGi088RuntimeContractGroupDefinition,
  createGi088RuntimeContractSchedule,
  gi088SimplifiedDiagnosticOutputSchema,
  validateGi088SharedProductRules,
  type Gi088RuntimeContractGroup,
  type Gi088RuntimeContractIdentity,
  type Gi088RuntimeContractVisibleProjection
} from "./contracts";

export const GI088_RUNTIME_CONTRACT_PRIVATE_ROOT = resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-12-gi088-runtime-contract-root-cause-diagnostic-v1"
);
export const GI088_RUNTIME_CONTRACT_PRIVATE_REPORT_PATH = resolve(
  GI088_RUNTIME_CONTRACT_PRIVATE_ROOT,
  "private-report.json"
);
export const GI088_RUNTIME_CONTRACT_PUBLIC_SUMMARY_PATH = resolve(
  GI088_RUNTIME_CONTRACT_PRIVATE_ROOT,
  "public-summary.json"
);

type SafeTrace = {
  finishReason: string | null;
  reasoningPresent: boolean | null;
  reasoningLength: number | null;
  reasoningTokens: number | null;
  tokenUsage: ReturnType<typeof sanitizeAICompletionTokenUsage>;
  httpStatus: number | null;
  responseModel: string | null;
  choiceCount: number | null;
  contentType: string | null;
  contentLength: number | null;
  headersLatencyMs: number | null;
  bodyLatencyMs: number | null;
  totalLatencyMs: number | null;
  timeoutStage: string | null;
  abortSource: string | null;
  upstreamRequestIdHash: string | null;
};

export type Gi088RuntimeContractCallRecord = {
  scheduleIndex: number;
  caseId: string;
  caseFingerprint: string;
  group: Gi088RuntimeContractGroup;
  requestHash: string;
  responseHash: string | null;
  startedAt: string;
  completedAt: string;
  visibleContent: boolean;
  emptyContent: boolean;
  jsonParsed: boolean;
  schemaValid: boolean;
  contractValid: boolean;
  sharedProductRulesValid: boolean;
  effectiveValid: boolean;
  validationCategory:
    | "valid"
    | "empty_content"
    | "json_invalid"
    | "output_schema_invalid"
    | "semantic_validation_failed"
    | "state_transition_invalid"
    | "timeout"
    | "provider_failure";
  validationIssues: string[];
  candidateVisibleOutput: Gi088RuntimeContractVisibleProjection | null;
  safeTrace: SafeTrace;
};

export type Gi088RuntimeContractGroupSummary = {
  group: Gi088RuntimeContractGroup;
  identity: Gi088RuntimeContractIdentity;
  promptSha256: string;
  contractSha256: string;
  callCount: number;
  visibleContentCount: number;
  emptyContentCount: number;
  jsonParsedCount: number;
  schemaValidCount: number;
  contractValidCount: number;
  sharedProductRulesValidCount: number;
  effectiveValidCount: number;
  errors: Record<string, number>;
  latency: { p50Ms: number | null; p90Ms: number | null; maxMs: number | null };
  tokens: {
    input: number;
    reasoning: number;
    visibleOutput: number;
    total: number;
  };
  admitted: boolean;
};

export type Gi088RuntimeContractDiagnosticReport = {
  reportVersion: typeof GI088_RUNTIME_CONTRACT_DIAGNOSTIC_REPORT_VERSION;
  diagnosticVersion: typeof GI088_RUNTIME_CONTRACT_DIAGNOSTIC_VERSION;
  diagnosticFingerprint: string;
  createdAt: string;
  globalFingerprintBundleBefore: Record<string, string>;
  globalFingerprintBundleAfter: Record<string, string>;
  globalRuntimeFingerprintsUnchanged: boolean;
  privacy: {
    requestBody: "excluded";
    fullModelOutput: "excluded";
    hiddenReasoningBody: "excluded";
    apiKey: "excluded";
    upstreamRequestIdRaw: "excluded";
  };
  dataset: {
    partition: "development";
    caseIds: string[];
    caseCount: 24;
    caseSetFingerprint: string;
    hiddenDatasetRead: false;
  };
  schedule: {
    seed: string;
    shuffledCaseIds: string[];
    scheduleFingerprint: string;
    concurrency: 2;
    primaryCallCount: 96;
  };
  budget: {
    primaryMaximum: 96;
    conditionalMaximum: 24;
    totalMaximum: 120;
    totalCalls: number;
    retries: 0;
    recoveries: 0;
    judgeCalls: 0;
  };
  groups: Gi088RuntimeContractGroupSummary[];
  records: Gi088RuntimeContractCallRecord[];
  decision: {
    conditionalProTriggered: boolean;
    shortlistMinimum: 20;
    shortlistedGroups: Gi088RuntimeContractGroup[];
    status: "technical_shortlist_ready" | "no_go_no_technical_shortlist";
    finalReviewCaseIds: readonly string[];
  };
  reportFingerprint: string;
};

export type Gi088RuntimeContractPublicSummary = Omit<
  Gi088RuntimeContractDiagnosticReport,
  "records" | "globalFingerprintBundleBefore" | "globalFingerprintBundleAfter"
> & {
  globalFingerprintBundleSha256: string;
};

export type Gi088RuntimeContractProviderSet = {
  A: AIProvider;
  B: AIProvider;
  C: AIProvider;
  D: AIProvider;
  createE: () => AIProvider;
};

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeCode(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9_:-]{1,120}$/u.test(normalized) ? normalized : fallback;
}

function safeTrace(
  completion: AICompletionResult | null,
  diagnosticsInput?: AIProviderDiagnostics | null
): SafeTrace {
  const diagnostics = sanitizeAIProviderDiagnostics(
    diagnosticsInput ?? completion?.diagnostics
  );
  const upstreamRequestId = diagnostics?.upstreamRequestId?.trim() ?? null;
  const usage = sanitizeAICompletionTokenUsage(
    completion?.tokenUsage ?? diagnostics?.tokenUsage
  );
  return {
    finishReason: diagnostics?.finishReason ?? null,
    reasoningPresent: diagnostics?.reasoningPresent ?? null,
    reasoningLength: diagnostics?.reasoningLength ?? null,
    reasoningTokens: diagnostics?.reasoningTokens ?? null,
    tokenUsage: usage,
    httpStatus: diagnostics?.httpStatus ?? null,
    responseModel: diagnostics?.responseModel ?? null,
    choiceCount: diagnostics?.choiceCount ?? null,
    contentType: diagnostics?.contentType ?? null,
    contentLength:
      diagnostics?.contentLength ?? completion?.content.length ?? null,
    headersLatencyMs: diagnostics?.headersLatencyMs ?? null,
    bodyLatencyMs: diagnostics?.bodyLatencyMs ?? null,
    totalLatencyMs:
      diagnostics?.totalLatencyMs ?? completion?.latencyMs ?? null,
    timeoutStage: diagnostics?.timeoutStage ?? null,
    abortSource: diagnostics?.abortSource ?? null,
    upstreamRequestIdHash: upstreamRequestId
      ? sha256(upstreamRequestId)
      : null
  };
}

function projectionFromFullOutput(
  output: Gi088SemanticDeltaOutput
): Gi088RuntimeContractVisibleProjection {
  const evidenceRefs = [
    ...(output.semantic.workingTask?.evidenceRefs ?? []),
    ...(output.semantic.understandingChange.kind === "none"
      ? []
      : output.semantic.understandingChange.evidenceRefs),
    ...(output.semantic.nextInquiry?.evidenceRefs ?? [])
  ];
  return {
    action: output.semantic.action,
    evidenceRefs: [...new Set(evidenceRefs)],
    answerTarget: output.semantic.nextInquiry?.answerTarget ?? null,
    understanding: output.visible.understanding,
    response: output.visible.response
  };
}

function parseFullOutput(input: {
  content: string;
  evaluationCase: Gi088V8r3EvaluationCase;
}) {
  const turnInput = createGi088V8r3OfflineTurnInput(input.evaluationCase, 0);
  let output: Gi088SemanticDeltaOutput;
  try {
    const parsed = parseGi088SemanticDeltaCandidateOutput(input.content);
    const normalized = normalizeGi088DeterministicStateOutput({
      turnInput,
      output: parsed
    });
    output = assertGi088SemanticDeltaOutput(normalized.output);
  } catch {
    return {
      schemaValid: false,
      contractValid: false,
      category: "output_schema_invalid" as const,
      issues: ["OUTPUT_SCHEMA_INVALID"],
      projection: null
    };
  }
  const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
    turnInput,
    output
  );
  const semanticIssues = applyGi088SingleFocusValidationPolicy({
    output: compatibility,
    issues: validateGi088SemanticDeltaOutput({
      input: turnInput,
      output,
      deterministicStateMaintenance: true,
      controlDecisionFinalAction: "none"
    })
  });
  const stageIssues = validateGi088StageTransitionOutput({
    input: turnInput,
    output: compatibility
  });
  const projection = projectionFromFullOutput(output);
  if (stageIssues.length > 0) {
    return {
      schemaValid: true,
      contractValid: false,
      category: "state_transition_invalid" as const,
      issues: [...new Set(stageIssues)],
      projection
    };
  }
  if (semanticIssues.length > 0) {
    return {
      schemaValid: true,
      contractValid: false,
      category: "semantic_validation_failed" as const,
      issues: [...new Set(semanticIssues)],
      projection
    };
  }
  try {
    applyGi088SemanticDeltaValidatedResult({ input: turnInput, output });
  } catch {
    return {
      schemaValid: true,
      contractValid: false,
      category: "state_transition_invalid" as const,
      issues: ["STATE_TRANSITION_INVALID"],
      projection
    };
  }
  return {
    schemaValid: true,
    contractValid: true,
    category: "valid" as const,
    issues: [],
    projection
  };
}

function parseSimplifiedOutput(input: {
  content: string;
  evaluationCase: Gi088V8r3EvaluationCase;
}) {
  try {
    const output = gi088SimplifiedDiagnosticOutputSchema.parse(
      JSON.parse(input.content.trim()) as unknown
    );
    return {
      schemaValid: true,
      contractValid: true,
      category: "valid" as const,
      issues: [],
      projection: {
        action: output.action,
        evidenceRefs: output.evidenceRefs,
        answerTarget: output.answerTarget,
        understanding: output.understanding,
        response: output.response
      } satisfies Gi088RuntimeContractVisibleProjection
    };
  } catch {
    return {
      schemaValid: false,
      contractValid: false,
      category: "output_schema_invalid" as const,
      issues: ["OUTPUT_SCHEMA_INVALID"],
      projection: null
    };
  }
}

function requestHash(input: {
  group: Gi088RuntimeContractGroup;
  evaluationCase: Gi088V8r3EvaluationCase;
  scheduleIndex: number;
}) {
  const definition = createGi088RuntimeContractGroupDefinition(input.group);
  const params = createGi088RuntimeContractCompletionParams(input);
  return sha256(stableJson({
    diagnosticVersion: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_VERSION,
    group: input.group,
    identity: definition.identity,
    promptSha256: definition.promptSha256,
    contractSha256: definition.contractSha256,
    caseFingerprint: createGi088V8r3CaseFingerprint(input.evaluationCase),
    scheduleIndex: input.scheduleIndex,
    callConfig: {
      responseFormat: params.responseFormat,
      thinking: params.thinking,
      reasoningEffort: params.reasoningEffort ?? null,
      useProviderDefaultMaxTokens: params.useProviderDefaultMaxTokens,
      headersTimeoutMs: params.headersTimeoutMs,
      bodyIdleTimeoutMs: params.bodyIdleTimeoutMs,
      hardTimeoutMs: params.hardTimeoutMs
    }
  }));
}

export async function executeGi088RuntimeContractCall(input: {
  provider: AIProvider;
  group: Gi088RuntimeContractGroup;
  evaluationCase: Gi088V8r3EvaluationCase;
  scheduleIndex: number;
  now?: () => Date;
}): Promise<Gi088RuntimeContractCallRecord> {
  const now = input.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const hash = requestHash(input);
  let completion: AICompletionResult;
  try {
    completion = await input.provider.complete(
      createGi088RuntimeContractCompletionParams(input)
    );
  } catch (error) {
    const code = safeCode(getAIProviderFailureCode(error), "PROVIDER_FAILURE");
    const category = code === "EMPTY_CONTENT"
      ? "empty_content" as const
      : code === "TIMEOUT"
        ? "timeout" as const
        : "provider_failure" as const;
    return {
      scheduleIndex: input.scheduleIndex,
      caseId: input.evaluationCase.id,
      caseFingerprint: createGi088V8r3CaseFingerprint(input.evaluationCase),
      group: input.group,
      requestHash: hash,
      responseHash: null,
      startedAt,
      completedAt: now().toISOString(),
      visibleContent: false,
      emptyContent: code === "EMPTY_CONTENT",
      jsonParsed: false,
      schemaValid: false,
      contractValid: false,
      sharedProductRulesValid: false,
      effectiveValid: false,
      validationCategory: category,
      validationIssues: [code],
      candidateVisibleOutput: null,
      safeTrace: safeTrace(null, getAIProviderDiagnostics(error))
    };
  }
  const content = completion.content.trim();
  let jsonParsed = false;
  try {
    JSON.parse(content);
    jsonParsed = true;
  } catch {
    // The contract validator below keeps the precise structure category.
  }
  if (!content) {
    return {
      scheduleIndex: input.scheduleIndex,
      caseId: input.evaluationCase.id,
      caseFingerprint: createGi088V8r3CaseFingerprint(input.evaluationCase),
      group: input.group,
      requestHash: hash,
      responseHash: null,
      startedAt,
      completedAt: now().toISOString(),
      visibleContent: false,
      emptyContent: true,
      jsonParsed: false,
      schemaValid: false,
      contractValid: false,
      sharedProductRulesValid: false,
      effectiveValid: false,
      validationCategory: "empty_content",
      validationIssues: ["EMPTY_CONTENT"],
      candidateVisibleOutput: null,
      safeTrace: safeTrace(completion)
    };
  }
  const parsed = input.group === "B"
    ? parseSimplifiedOutput({
        content,
        evaluationCase: input.evaluationCase
      })
    : parseFullOutput({
        content,
        evaluationCase: input.evaluationCase
      });
  const sharedIssues = parsed.projection
    ? validateGi088SharedProductRules({
        evaluationCase: input.evaluationCase,
        projection: parsed.projection
      })
    : ["SHARED_PROJECTION_UNAVAILABLE"];
  const sharedProductRulesValid = sharedIssues.length === 0;
  const category = !jsonParsed
    ? "json_invalid" as const
    : parsed.category;
  return {
    scheduleIndex: input.scheduleIndex,
    caseId: input.evaluationCase.id,
    caseFingerprint: createGi088V8r3CaseFingerprint(input.evaluationCase),
    group: input.group,
    requestHash: hash,
    responseHash: sha256(content),
    startedAt,
    completedAt: now().toISOString(),
    visibleContent: true,
    emptyContent: false,
    jsonParsed,
    schemaValid: parsed.schemaValid,
    contractValid: parsed.contractValid,
    sharedProductRulesValid,
    effectiveValid: parsed.contractValid && sharedProductRulesValid,
    validationCategory: category,
    validationIssues: [...new Set([...parsed.issues, ...sharedIssues])],
    candidateVisibleOutput: parsed.projection,
    safeTrace: safeTrace(completion)
  };
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
}

export function summarizeGi088RuntimeContractGroup(
  group: Gi088RuntimeContractGroup,
  records: readonly Gi088RuntimeContractCallRecord[]
): Gi088RuntimeContractGroupSummary {
  const matching = records.filter((record) => record.group === group);
  const latencies = matching.flatMap((record) =>
    record.safeTrace.totalLatencyMs === null
      ? []
      : [record.safeTrace.totalLatencyMs]
  );
  const errors: Record<string, number> = {};
  for (const record of matching) {
    if (record.validationCategory === "valid") continue;
    errors[record.validationCategory] =
      (errors[record.validationCategory] ?? 0) + 1;
  }
  const tokenTotals = matching.reduce((totals, record) => {
    const usage = record.safeTrace.tokenUsage;
    const input = usage?.promptTokens ?? 0;
    const completion = usage?.completionTokens ?? 0;
    const reasoning = record.safeTrace.reasoningTokens ?? 0;
    totals.input += input;
    totals.reasoning += reasoning;
    totals.visibleOutput += Math.max(0, completion - reasoning);
    totals.total += usage?.totalTokens ?? input + completion;
    return totals;
  }, { input: 0, reasoning: 0, visibleOutput: 0, total: 0 });
  const definition = createGi088RuntimeContractGroupDefinition(group);
  const effectiveValidCount = matching.filter(
    (record) => record.effectiveValid
  ).length;
  return {
    group,
    identity: definition.identity,
    promptSha256: definition.promptSha256,
    contractSha256: definition.contractSha256,
    callCount: matching.length,
    visibleContentCount: matching.filter((record) => record.visibleContent).length,
    emptyContentCount: matching.filter((record) => record.emptyContent).length,
    jsonParsedCount: matching.filter((record) => record.jsonParsed).length,
    schemaValidCount: matching.filter((record) => record.schemaValid).length,
    contractValidCount: matching.filter((record) => record.contractValid).length,
    sharedProductRulesValidCount: matching.filter(
      (record) => record.sharedProductRulesValid
    ).length,
    effectiveValidCount,
    errors,
    latency: {
      p50Ms: percentile(latencies, 0.5),
      p90Ms: percentile(latencies, 0.9),
      maxMs: latencies.length > 0 ? Math.max(...latencies) : null
    },
    tokens: tokenTotals,
    admitted:
      matching.length === GI088_RUNTIME_CONTRACT_DIAGNOSTIC_GROUP_CALLS &&
      effectiveValidCount >= GI088_RUNTIME_CONTRACT_DIAGNOSTIC_SHORTLIST_MINIMUM
  };
}

function rankGroups(groups: Gi088RuntimeContractGroupSummary[]) {
  const order = new Map(
    GI088_RUNTIME_CONTRACT_GROUP_ORDER.map((group, index) => [group, index])
  );
  return [...groups].sort((left, right) =>
    right.effectiveValidCount - left.effectiveValidCount ||
    left.emptyContentCount - right.emptyContentCount ||
    (left.latency.p90Ms ?? Number.POSITIVE_INFINITY) -
      (right.latency.p90Ms ?? Number.POSITIVE_INFINITY) ||
    (order.get(left.group) ?? 99) - (order.get(right.group) ?? 99)
  );
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await operation(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
}

function assertFingerprintBundle(value: Record<string, string>) {
  const keys = [
    "candidateFingerprint",
    "datasetFingerprint",
    "runnerFingerprint",
    "experienceFingerprint",
    "executionFingerprint"
  ];
  if (keys.some((key) => !/^[a-f0-9]{64}$/u.test(value[key] ?? ""))) {
    throw new Error("GI088_RUNTIME_CONTRACT_FINGERPRINT_BUNDLE_INVALID");
  }
}

export async function executeGi088RuntimeContractDiagnostic(input: {
  cases: readonly Gi088V8r3EvaluationCase[];
  providers: Gi088RuntimeContractProviderSet;
  globalFingerprintBundleBefore: Record<string, string>;
  readGlobalFingerprintBundleAfter: () => Record<string, string>;
  now?: () => Date;
}) {
  assertFingerprintBundle(input.globalFingerprintBundleBefore);
  const now = input.now ?? (() => new Date());
  const schedule = createGi088RuntimeContractSchedule(input.cases);
  const casesById = new Map(input.cases.map((item) => [item.id, item]));
  const primaryRecords = await mapWithConcurrency(
    schedule.schedule,
    GI088_RUNTIME_CONTRACT_DIAGNOSTIC_CONCURRENCY,
    (item) => executeGi088RuntimeContractCall({
      provider: input.providers[item.group],
      group: item.group,
      evaluationCase: casesById.get(item.caseId)!,
      scheduleIndex: item.scheduleIndex,
      now
    })
  );
  const primarySummaries = (["A", "B", "C", "D"] as const).map((group) =>
    summarizeGi088RuntimeContractGroup(group, primaryRecords)
  );
  const conditionalProTriggered = primarySummaries.every(
    (summary) => !summary.admitted
  );
  let records = [...primaryRecords];
  if (conditionalProTriggered) {
    const provider = input.providers.createE();
    const proRecords = await mapWithConcurrency(
      schedule.shuffledCaseIds,
      GI088_RUNTIME_CONTRACT_DIAGNOSTIC_CONCURRENCY,
      (caseId) => executeGi088RuntimeContractCall({
        provider,
        group: "E",
        evaluationCase: casesById.get(caseId)!,
        scheduleIndex: records.length + schedule.shuffledCaseIds.indexOf(caseId) + 1,
        now
      })
    );
    records = [...records, ...proRecords];
  }
  if (
    records.length > GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM ||
    records.length !==
      (conditionalProTriggered
        ? GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM
        : GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS)
  ) {
    throw new Error("GI088_RUNTIME_CONTRACT_CALL_BUDGET_INVALID");
  }
  const groups = [
    ...primarySummaries,
    ...(conditionalProTriggered
      ? [summarizeGi088RuntimeContractGroup("E", records)]
      : [])
  ];
  const shortlistedGroups = rankGroups(groups.filter((group) => group.admitted))
    .slice(0, 2)
    .map((group) => group.group);
  const globalFingerprintBundleAfter = input.readGlobalFingerprintBundleAfter();
  assertFingerprintBundle(globalFingerprintBundleAfter);
  const unchanged = stableJson(input.globalFingerprintBundleBefore) ===
    stableJson(globalFingerprintBundleAfter);
  if (!unchanged) {
    throw new Error("GI088_RUNTIME_CONTRACT_GLOBAL_FINGERPRINT_CHANGED");
  }
  const caseSetFingerprint = sha256(stableJson(
    input.cases.map((item) => ({
      caseId: item.id,
      fingerprint: createGi088V8r3CaseFingerprint(item)
    })).sort((left, right) => left.caseId.localeCompare(right.caseId))
  ));
  const reportPayload = {
    reportVersion: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_REPORT_VERSION,
    diagnosticVersion: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_VERSION,
    diagnosticFingerprint: createGi088RuntimeContractDiagnosticFingerprint({
      cases: input.cases,
      globalFingerprintBundle: input.globalFingerprintBundleBefore
    }),
    createdAt: now().toISOString(),
    globalFingerprintBundleBefore: input.globalFingerprintBundleBefore,
    globalFingerprintBundleAfter,
    globalRuntimeFingerprintsUnchanged: unchanged,
    privacy: {
      requestBody: "excluded",
      fullModelOutput: "excluded",
      hiddenReasoningBody: "excluded",
      apiKey: "excluded",
      upstreamRequestIdRaw: "excluded"
    },
    dataset: {
      partition: "development",
      caseIds: [...input.cases].map((item) => item.id).sort(),
      caseCount: 24,
      caseSetFingerprint,
      hiddenDatasetRead: false
    },
    schedule: {
      seed: schedule.seed,
      shuffledCaseIds: schedule.shuffledCaseIds,
      scheduleFingerprint: schedule.scheduleFingerprint,
      concurrency: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_CONCURRENCY,
      primaryCallCount: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS
    },
    budget: {
      primaryMaximum: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS,
      conditionalMaximum: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_GROUP_CALLS,
      totalMaximum: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM,
      totalCalls: records.length,
      retries: 0,
      recoveries: 0,
      judgeCalls: 0
    },
    groups,
    records,
    decision: {
      conditionalProTriggered,
      shortlistMinimum: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_SHORTLIST_MINIMUM,
      shortlistedGroups,
      status: shortlistedGroups.length > 0
        ? "technical_shortlist_ready"
        : "no_go_no_technical_shortlist",
      finalReviewCaseIds: GI088_RUNTIME_CONTRACT_FINAL_CASE_IDS
    }
  } satisfies Omit<Gi088RuntimeContractDiagnosticReport, "reportFingerprint">;
  return {
    ...reportPayload,
    reportFingerprint: sha256(stableJson(reportPayload))
  } satisfies Gi088RuntimeContractDiagnosticReport;
}

export function createGi088RuntimeContractPublicSummary(
  report: Gi088RuntimeContractDiagnosticReport
): Gi088RuntimeContractPublicSummary {
  const safe = Object.fromEntries(
    Object.entries(report).filter(([key]) =>
      key !== "records" &&
      key !== "globalFingerprintBundleBefore" &&
      key !== "globalFingerprintBundleAfter"
    )
  ) as Omit<
    Gi088RuntimeContractDiagnosticReport,
    "records" | "globalFingerprintBundleBefore" | "globalFingerprintBundleAfter"
  >;
  return {
    ...safe,
    globalFingerprintBundleSha256: sha256(
      stableJson(report.globalFingerprintBundleBefore)
    )
  };
}

async function writeExclusiveAtomic(path: string, value: unknown) {
  await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
  await chmod(temporaryPath, 0o600);
  try {
    await link(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
  await chmod(path, 0o600);
}

export async function writeGi088RuntimeContractDiagnosticArtifacts(input: {
  report: Gi088RuntimeContractDiagnosticReport;
  privateReportPath?: string;
  publicSummaryPath?: string;
}) {
  const privateReportPath =
    input.privateReportPath ?? GI088_RUNTIME_CONTRACT_PRIVATE_REPORT_PATH;
  const publicSummaryPath =
    input.publicSummaryPath ?? GI088_RUNTIME_CONTRACT_PUBLIC_SUMMARY_PATH;
  await writeExclusiveAtomic(privateReportPath, input.report);
  await writeExclusiveAtomic(
    publicSummaryPath,
    createGi088RuntimeContractPublicSummary(input.report)
  );
  for (const path of [privateReportPath, publicSummaryPath]) {
    const metadata = await stat(path);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
      throw new Error("GI088_RUNTIME_CONTRACT_REPORT_PERMISSIONS_INVALID");
    }
  }
  return { privateReportPath, publicSummaryPath };
}

export async function readGi088RuntimeContractDiagnosticReport(
  path: string = GI088_RUNTIME_CONTRACT_PRIVATE_REPORT_PATH
) {
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
    throw new Error("GI088_RUNTIME_CONTRACT_PRIVATE_REPORT_INVALID");
  }
  const report = JSON.parse(
    await readFile(path, "utf8")
  ) as Gi088RuntimeContractDiagnosticReport;
  const fingerprintPayload = Object.fromEntries(
    Object.entries(report).filter(([key]) => key !== "reportFingerprint")
  );
  if (
    report.reportVersion !== GI088_RUNTIME_CONTRACT_DIAGNOSTIC_REPORT_VERSION ||
    report.diagnosticVersion !== GI088_RUNTIME_CONTRACT_DIAGNOSTIC_VERSION ||
    !/^[a-f0-9]{64}$/u.test(report.reportFingerprint) ||
    report.reportFingerprint !== sha256(stableJson(fingerprintPayload))
  ) {
    throw new Error("GI088_RUNTIME_CONTRACT_REPORT_INTEGRITY_INVALID");
  }
  return report;
}

export function createGi088RuntimeContractReviewSource(input: {
  report: Gi088RuntimeContractDiagnosticReport;
  cases: readonly Gi088V8r3EvaluationCase[];
}) {
  if (input.report.decision.shortlistedGroups.length === 0) return null;
  const casesById = new Map(input.cases.map((item) => [item.id, item]));
  const selectedRecords = input.report.records.filter(
    (record) =>
      input.report.decision.shortlistedGroups.includes(record.group) &&
      (GI088_RUNTIME_CONTRACT_FINAL_CASE_IDS as readonly string[])
        .includes(record.caseId)
  );
  const items = GI088_RUNTIME_CONTRACT_FINAL_CASE_IDS.map((caseId) => {
    const evaluationCase = casesById.get(caseId);
    if (!evaluationCase) {
      throw new Error("GI088_RUNTIME_CONTRACT_REVIEW_CASE_MISSING");
    }
    const candidates = input.report.decision.shortlistedGroups.map((group) => {
      const record = selectedRecords.find(
        (item) => item.caseId === caseId && item.group === group
      );
      if (!record) {
        throw new Error("GI088_RUNTIME_CONTRACT_REVIEW_OUTPUT_MISSING");
      }
      return {
        group,
        requestHash: record.requestHash,
        responseHash: record.responseHash,
        available: Boolean(record.candidateVisibleOutput),
        output: record.candidateVisibleOutput ?? {
          action: "acknowledge" as const,
          evidenceRefs: [],
          answerTarget: null,
          understanding: null,
          response: "本次未形成可见合法回应。"
        }
      };
    });
    return {
      caseId,
      workingTask: evaluationCase.workingTask,
      visibleConversation: getGi088V8r3ConversationAtCheckpoint(
        evaluationCase,
        0
      ).map((message) => ({ role: message.role, content: message.content })),
      candidates
    };
  });
  return {
    diagnosticVersion: input.report.diagnosticVersion,
    diagnosticFingerprint: input.report.diagnosticFingerprint,
    reportFingerprint: input.report.reportFingerprint,
    shortlistedGroups: input.report.decision.shortlistedGroups,
    groupSummaries: input.report.groups.filter((group) =>
      input.report.decision.shortlistedGroups.includes(group.group)
    ),
    items
  };
}
