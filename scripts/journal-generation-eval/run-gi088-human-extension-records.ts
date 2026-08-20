import {
  access,
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  rename
} from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";

import {
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION,
  GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH,
  canonicalJson,
  estimateGi088CalibrationCostCny,
  sha256Canonical,
  sha256Text,
  type Gi088CalibrationAttemptTrace,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderRequest,
  type Gi088CalibrationProviderResult,
  type Gi088CalibrationRecordCard
} from "./gi088-calibration-contract";
import {
  createGi088MockCalibrationProvider,
  createGi088OpenAICompatibleCalibrationProvider,
  Gi088CalibrationProviderError
} from "./gi088-calibration-provider";
import {
  buildGi088RecordCardCalibrationPrompt,
  parseRecordCardOutput,
  recordCardSourceCatalog,
  type LoadedGi088CalibrationCase
} from "./gi088-calibration-runner";
import {
  GI088_HUMAN_EXTENSION_FLASH_MODEL,
  GI088_HUMAN_EXTENSION_FROZEN_SCOPE_SHA256,
  GI088_HUMAN_EXTENSION_RECORD_BUDGET,
  GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
  GI088_HUMAN_EXTENSION_RUNTIME,
  GI088_HUMAN_EXTENSION_VERSION
} from "./gi088-human-extension-contract";
import {
  assertGi088HumanExtensionSourcesUnchanged,
  loadGi088HumanExtensionSources,
  type Gi088HumanExtensionSourceBundle
} from "./gi088-human-extension-source";
import { sha256File } from "./private-export-importer";
import {
  resolveGi088CalibrationCredential,
  safeGi088CalibrationErrorCode,
  type Gi088CalibrationCredential
} from "./run-gi088-calibration";

const PRIVATE_ROOT_RELATIVE = "artifacts/journal-generation-evaluation/.private";
const REAL_ROOT_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/formal/extension/record-cards`;
const MOCK_ROOT_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/extension-mock/record-cards`;
const REAL_PROVIDER_ADAPTER = "deepseek_official_openai_compatible" as const;
const NOMINAL_CALLS = 6 as const;
const MAX_CALLS = 12 as const;

const IMPLEMENTATION_FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vitest.config.ts",
  "scripts/journal-generation-eval/gi088-calibration-contract.ts",
  "scripts/journal-generation-eval/gi088-calibration-provider.ts",
  "scripts/journal-generation-eval/gi088-calibration-runner.ts",
  "scripts/journal-generation-eval/gi088-human-extension-contract.ts",
  "scripts/journal-generation-eval/gi088-human-extension-source.ts",
  "scripts/journal-generation-eval/private-export-importer.ts",
  "scripts/journal-generation-eval/run-gi088-calibration.ts",
  "scripts/journal-generation-eval/run-gi088-human-extension-records.ts",
  "scripts/journal-generation-eval/run-gi088-human-extension-records-cli.ts",
  "src/features/ai-quality/prompt-manifest.ts",
  "src/server/services/ai/ai-provider.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/interview/journal-event-entry.service.ts",
  "src/server/services/journal-daily-entry/contract.ts",
  "src/server/services/journal-daily-entry/prompt.ts",
  "src/server/services/journal-daily-entry/journal-daily-entry-generation.service.ts",
  "src/types/journal-event-entry.ts",
  "src/types/journal-daily-entry.ts"
] as const;

export interface Gi088ExtensionProviderPreflight {
  performed_at: string;
  required_model: "deepseek-v4-flash";
  required_model_available: true;
  available_model_ids_sha256: string;
  credential_source: Gi088CalibrationCredential["source"];
}

export interface Gi088ExtensionPriorZeroCallFailure {
  run_id: string;
  lock_sha256: string;
  attempt_ledger_sha256: string | null;
}

export interface Gi088ExtensionProgramFailure {
  code: string;
  message: string;
  refs: string[];
  severity: "P0" | "technical";
}

export interface Gi088ExtensionRecordCase {
  case_id: string;
  source_group_id: string;
  source_file_sha256: string;
  source_projection_sha256: string;
  source_catalog_sha256: string;
  candidate: {
    candidate_id: string;
    record_card: Gi088CalibrationRecordCard | null;
    occurred_at_text: string | null;
    program_check: {
      admitted: boolean;
      failures: Gi088ExtensionProgramFailure[];
      checks: Array<{ check: string; passed: boolean; issues: string[] }>;
    };
    trace: {
      prompt_hash: string;
      attempts: Gi088CalibrationAttemptTrace[];
      technical_retry_count: number;
      quality_retry_count: 0;
      raw_response_sha256: string | null;
      response_model: string | null;
      reasoning_present: boolean | null;
      reasoning_tokens: number | null;
      finish_reason: string | null;
      latency_ms: number;
      cost_cny: number | null;
    };
  };
}

export interface Gi088ExtensionRecordPackage {
  schema_version: "1.0";
  privacy_classification: "private_local_only";
  extension_version: typeof GI088_HUMAN_EXTENSION_VERSION;
  round_id: typeof GI088_HUMAN_EXTENSION_RECORD_ROUND_ID;
  generated_at: string;
  mode: "mock" | "real";
  scope_fingerprint: string;
  execution_fingerprint: string;
  prior_zero_call_failures: Gi088ExtensionPriorZeroCallFailure[];
  completed_calibration: Gi088HumanExtensionSourceBundle["completedCalibration"];
  imported_manifest_sha256: string;
  prompt: {
    version: typeof GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION;
    system_prompt_sha256: typeof GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH;
  };
  runtime: {
    model: "deepseek-v4-flash";
    provider: "openai_compatible_rest";
    base_url: "https://api.deepseek.com";
    thinking: "disabled";
    temperature: 0.2;
    response_format: "json_object";
    headers_timeout_ms: 15_000;
    body_idle_timeout_ms: 45_000;
    hard_timeout_ms: 60_000;
    max_tokens_policy: "provider_default";
    max_technical_retries_per_case: 1;
    quality_retries: 0;
    provider_adapter: string;
  };
  budget: typeof GI088_HUMAN_EXTENSION_RECORD_BUDGET;
  run: {
    actual_model_calls: number;
    technical_retries: number;
    quality_retries: 0;
    completed_cases: number;
    admitted_cases: number;
  };
  code_snapshot: Array<{ path: string; sha256: string }>;
  provider_preflight: Gi088ExtensionProviderPreflight | null;
  cases: Gi088ExtensionRecordCase[];
  raw_responses: Array<{
    call_fingerprint: string;
    case_id: string;
    candidate_id: string;
    attempt: 1 | 2;
    sha256: string;
    content: string;
  }>;
}

export interface Gi088ExtensionRecordOptions {
  mode: "dry-run" | "mock" | "real";
  confirmPrivateReplay: boolean;
  confirmScopeFingerprint: string | null;
  maxCalls: number;
  maxCallsExplicit: boolean;
  runId: string | null;
}

export interface Gi088ExtensionRecordDependencies {
  resolveCredential: typeof resolveGi088CalibrationCredential;
  createRealProvider: (input: { apiKey: string; baseUrl: string }) => Gi088CalibrationProvider;
  createMockProvider: () => Gi088CalibrationProvider;
  fetcher: typeof fetch;
  now: () => Date;
  appendLedger: typeof appendGi088ExtensionLedger;
}

export class Gi088ExtensionRecordError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Gi088ExtensionRecordError";
  }
}

function fail(code: string): never {
  throw new Gi088ExtensionRecordError(code);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertRuntime() {
  if (canonicalJson(GI088_HUMAN_EXTENSION_RUNTIME)
    !== canonicalJson(GI088_JOURNAL_CALIBRATION_RUNTIME)
    || GI088_HUMAN_EXTENSION_RUNTIME.temperature !== 0.2
    || GI088_HUMAN_EXTENSION_RUNTIME.thinking !== "disabled"
    || GI088_HUMAN_EXTENSION_RUNTIME.qualityRetries !== 0
    || GI088_HUMAN_EXTENSION_RUNTIME.maxTechnicalRetriesPerStage !== 1) {
    fail("GI088_EXTENSION_RECORD_RUNTIME_CONTRACT_MISMATCH");
  }
}

function assertProviderIdentity(mode: "mock" | "real", provider: Gi088CalibrationProvider) {
  if (mode === "real") {
    if (provider.kind !== "real" || provider.name !== REAL_PROVIDER_ADAPTER) {
      fail("GI088_EXTENSION_RECORD_REAL_PROVIDER_IDENTITY_MISMATCH");
    }
    return;
  }
  if (provider.kind !== "mock" || !provider.name.trim()) {
    fail("GI088_EXTENSION_RECORD_MOCK_PROVIDER_IDENTITY_MISMATCH");
  }
}

async function loadCodeSnapshot(projectRoot: string) {
  return await Promise.all(IMPLEMENTATION_FILES.map(async (path) => ({
    path,
    sha256: await sha256File(resolve(projectRoot, path))
  })));
}

export async function appendGi088ExtensionLedger(path: string, value: unknown) {
  const handle = await open(path, "a", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writePrivateFile(path: string, content: string, exclusive = true) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  const handle = await open(path, exclusive ? "wx" : "w", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writePrivateJsonAtomic(path: string, value: unknown) {
  const temporary = resolve(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  await writePrivateFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

function outputRoot(projectRoot: string, mode: "mock" | "real") {
  return resolve(projectRoot, mode === "real" ? REAL_ROOT_RELATIVE : MOCK_ROOT_RELATIVE);
}

function assertPrivateOutput(path: string, projectRoot: string) {
  const privateRoot = resolve(projectRoot, PRIVATE_ROOT_RELATIVE);
  const fromPrivate = relative(privateRoot, path);
  if (!fromPrivate || fromPrivate === ".." || fromPrivate.startsWith(`..${sep}`)) {
    fail("GI088_EXTENSION_RECORD_PRIVATE_OUTPUT_REQUIRED");
  }
}

export async function loadGi088ExtensionPriorZeroCallFailures(
  root: string,
  excludeRunId: string | null = null
): Promise<Gi088ExtensionPriorZeroCallFailure[]> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    fail("GI088_EXTENSION_RECORD_HISTORY_UNREADABLE");
  }
  const recoverable: Gi088ExtensionPriorZeroCallFailure[] = [];
  for (const entry of entries.sort()) {
    if (!entry.startsWith(`${GI088_HUMAN_EXTENSION_RECORD_ROUND_ID}-`)
      || entry === excludeRunId) continue;
    const lockPath = resolve(root, entry, "round-run.lock.json");
    let lockText: string;
    try {
      lockText = await readFile(lockPath, "utf8");
    } catch {
      fail("GI088_EXTENSION_RECORD_HISTORY_INVALID");
    }
    let lock: Record<string, unknown>;
    try {
      lock = JSON.parse(lockText) as Record<string, unknown>;
    } catch {
      fail("GI088_EXTENSION_RECORD_HISTORY_INVALID");
    }
    if (lock.mode !== "real") continue;
    let ledgerText: string | null = null;
    try {
      ledgerText = await readFile(resolve(root, entry, "attempt-ledger.ndjson"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        fail("GI088_EXTENSION_RECORD_HISTORY_INVALID");
      }
    }
    const reserved = ledgerText?.split(/\r?\n/u).some((line) => {
      if (!line.trim()) return false;
      try {
        return (JSON.parse(line) as Record<string, unknown>).event === "call_reserved";
      } catch {
        fail("GI088_EXTENSION_RECORD_HISTORY_INVALID");
      }
    }) ?? false;
    if (lock.status !== "failed" || lock.observed_model_calls !== 0 || reserved) {
      fail("GI088_EXTENSION_RECORD_PRIOR_REAL_RUN_EXISTS");
    }
    recoverable.push({
      run_id: entry,
      lock_sha256: sha256Text(lockText),
      attempt_ledger_sha256: ledgerText === null ? null : sha256Text(ledgerText)
    });
  }
  return recoverable;
}

async function validateFlashModel(input: {
  apiKey: string;
  credentialSource: Gi088CalibrationCredential["source"];
  fetcher: typeof fetch;
  now: Date;
}): Promise<Gi088ExtensionProviderPreflight> {
  let response: Response;
  try {
    response = await input.fetcher(`${GI088_HUMAN_EXTENSION_RUNTIME.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${input.apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    fail("GI088_EXTENSION_RECORD_MODEL_PREFLIGHT_UNREACHABLE");
  }
  if (!response.ok) fail(`GI088_EXTENSION_RECORD_MODEL_PREFLIGHT_HTTP_${response.status}`);
  const body = await response.json() as unknown;
  const ids = isObject(body) && Array.isArray(body.data)
    ? body.data.flatMap((item) => isObject(item) && typeof item.id === "string" ? [item.id] : [])
    : [];
  if (!ids.includes(GI088_HUMAN_EXTENSION_FLASH_MODEL.model)) {
    fail("GI088_EXTENSION_RECORD_FLASH_MODEL_UNAVAILABLE");
  }
  return {
    performed_at: input.now.toISOString(),
    required_model: "deepseek-v4-flash",
    required_model_available: true,
    available_model_ids_sha256: sha256Canonical([...new Set(ids)].sort()),
    credential_source: input.credentialSource
  };
}

function normalizeProviderError(error: unknown, elapsedMs: number) {
  if (error instanceof Gi088CalibrationProviderError) return error;
  return new Gi088CalibrationProviderError(
    safeGi088CalibrationErrorCode(error),
    false,
    elapsedMs
  );
}

function candidateId(scopeFingerprint: string, source: LoadedGi088CalibrationCase) {
  return `flash-record-${sha256Canonical({
    scopeFingerprint,
    caseId: source.selection.caseId
  }).slice(0, 20)}`;
}

async function runRecordCase(input: {
  provider: Gi088CalibrationProvider;
  source: LoadedGi088CalibrationCase;
  scopeFingerprint: string;
  actualCalls: { value: number };
  ledgerPath: string;
  rawResponses: Gi088ExtensionRecordPackage["raw_responses"];
  preCallGuard: () => Promise<void>;
  now: () => Date;
  appendLedger: typeof appendGi088ExtensionLedger;
}) {
  const id = candidateId(input.scopeFingerprint, input.source);
  const prompt = buildGi088RecordCardCalibrationPrompt(input.source);
  const catalog = recordCardSourceCatalog(input.source);
  const attempts: Gi088CalibrationAttemptTrace[] = [];
  let response: Gi088CalibrationProviderResult | null = null;
  let parsed: ReturnType<typeof parseRecordCardOutput> | null = null;
  let terminalCode: string | null = null;
  for (const attempt of [1, 2] as const) {
    if (input.actualCalls.value >= MAX_CALLS) {
      fail("GI088_EXTENSION_RECORD_CALL_BUDGET_EXCEEDED");
    }
    assertRuntime();
    await input.preCallGuard();
    const callFingerprint = sha256Canonical({
      scopeFingerprint: input.scopeFingerprint,
      caseId: input.source.selection.caseId,
      candidateId: id,
      stage: "record_card",
      attempt,
      promptHash: prompt.resolvedPromptHash,
      sourceProjectionSha256: input.source.sourceProjectionSha256
    });
    const sequence = input.actualCalls.value + 1;
    await input.appendLedger(input.ledgerPath, {
      event: "call_reserved",
      at: input.now().toISOString(),
      sequence,
      call_fingerprint: callFingerprint,
      case_id: input.source.selection.caseId,
      candidate_id: id,
      stage: "record_card",
      attempt,
      model: GI088_HUMAN_EXTENSION_FLASH_MODEL.model,
      provider_adapter: input.provider.name
    });
    input.actualCalls.value = sequence;
    const startedAt = Date.now();
    let result: Gi088CalibrationProviderResult;
    try {
      result = await input.provider.complete({
        callFingerprint,
        caseId: input.source.selection.caseId,
        candidateId: id,
        stage: "record_card",
        attempt,
        model: GI088_HUMAN_EXTENSION_FLASH_MODEL,
        messages: prompt.messages,
        promptHash: prompt.resolvedPromptHash,
        sourceRefs: catalog.refs,
        sourceTextByRef: catalog.textByRef,
        sourceRecordIds: [],
        sourceRecordTextById: {},
        runtime: GI088_JOURNAL_CALIBRATION_RUNTIME
      } satisfies Gi088CalibrationProviderRequest);
    } catch (error) {
      const technical = normalizeProviderError(error, Date.now() - startedAt);
      const retryScheduled = attempt === 1 && technical.retryable;
      attempts.push({
        call_fingerprint: callFingerprint,
        stage: "record_card",
        attempt,
        outcome: "technical_failure",
        error_code: technical.code,
        retry_scheduled: retryScheduled,
        latency_ms: technical.latencyMs,
        token_usage: technical.tokenUsage,
        finish_reason: technical.finishReason,
        upstream_request_id: technical.upstreamRequestId,
        provider: null,
        response_model: null,
        reasoning_present: null,
        reasoning_tokens: null,
        cost_cny: estimateGi088CalibrationCostCny({
          model: GI088_HUMAN_EXTENSION_FLASH_MODEL.model,
          tokenUsage: technical.tokenUsage
        }),
        raw_response_sha256: null
      });
      terminalCode = technical.code;
      await input.appendLedger(input.ledgerPath, {
        event: "call_failed",
        at: input.now().toISOString(),
        sequence,
        call_fingerprint: callFingerprint,
        provider_adapter: input.provider.name,
        error_code: technical.code,
        retry_scheduled: retryScheduled
      });
      if (retryScheduled) continue;
      break;
    }
    const rawSha = sha256Text(result.content);
    const responseContractIssues = [
      ...(result.responseModel === GI088_HUMAN_EXTENSION_FLASH_MODEL.model
        ? [] : [`RECORD_CARD_RESPONSE_MODEL_MISMATCH:${result.responseModel ?? "missing"}`]),
      ...(result.reasoningPresent === false && (result.reasoningTokens ?? 0) === 0
        ? [] : ["RECORD_CARD_THINKING_NOT_DISABLED"])
    ];
    parsed = responseContractIssues.length === 0
      ? parseRecordCardOutput({
          source: input.source,
          content: result.content,
          finishReason: result.finishReason ?? null
        })
      : {
          accepted: false as const,
          downstreamEligible: false,
          issues: responseContractIssues,
          compiled: null,
          strictBlockLimitOnly: false
        };
    input.rawResponses.push({
      call_fingerprint: callFingerprint,
      case_id: input.source.selection.caseId,
      candidate_id: id,
      attempt,
      sha256: rawSha,
      content: result.content
    });
    attempts.push({
      call_fingerprint: callFingerprint,
      stage: "record_card",
      attempt,
      outcome: "valid_response",
      error_code: null,
      retry_scheduled: false,
      latency_ms: result.latencyMs,
      token_usage: result.tokenUsage ?? null,
      finish_reason: result.finishReason ?? null,
      upstream_request_id: result.upstreamRequestId ?? null,
      provider: result.provider,
      response_model: result.responseModel ?? null,
      reasoning_present: result.reasoningPresent ?? null,
      reasoning_tokens: result.reasoningTokens ?? null,
      cost_cny: estimateGi088CalibrationCostCny({
        model: GI088_HUMAN_EXTENSION_FLASH_MODEL.model,
        tokenUsage: result.tokenUsage
      }),
      raw_response_sha256: rawSha
    });
    await input.appendLedger(input.ledgerPath, {
      event: "call_completed",
      at: input.now().toISOString(),
      sequence,
      call_fingerprint: callFingerprint,
      provider_adapter: input.provider.name,
      raw_response_sha256: rawSha,
      response_model: result.responseModel ?? null,
      reasoning_present: result.reasoningPresent ?? null,
      reasoning_tokens: result.reasoningTokens ?? null,
      finish_reason: result.finishReason ?? null,
      quality_accepted: parsed.accepted,
      quality_issues: parsed.issues
    });
    response = result;
    terminalCode = null;
    break;
  }
  const issues = parsed?.issues ?? [];
  const failures: Gi088ExtensionProgramFailure[] = response
    ? issues.map((issue) => ({
        code: issue,
        message: "记录卡未通过客观来源或结构检查，原始结果已保留并停止模型改写。",
        refs: [input.source.selection.caseId],
        severity: "P0" as const
      }))
    : [{
        code: terminalCode ?? "RECORD_CARD_TECHNICAL_FAILURE",
        message: "记录卡生成在允许的技术尝试内未获得完整响应。",
        refs: [input.source.selection.caseId],
        severity: "technical" as const
      }];
  const recordCard = parsed?.compiled?.recordCard ?? null;
  const costs = attempts.flatMap((attempt) => attempt.cost_cny === null ? [] : [attempt.cost_cny]);
  return {
    case_id: input.source.selection.caseId,
    source_group_id: input.source.selection.sourceGroupId,
    source_file_sha256: input.source.sourceFileSha256,
    source_projection_sha256: input.source.sourceProjectionSha256,
    source_catalog_sha256: sha256Canonical(catalog.trace),
    candidate: {
      candidate_id: id,
      record_card: recordCard,
      occurred_at_text: parsed?.compiled?.occurredAtText ?? null,
      program_check: {
        admitted: Boolean(response && parsed?.accepted && recordCard),
        failures,
        checks: [
          {
            check: "strict_json_and_record_structure",
            passed: !issues.some((issue) => /JSON|SCHEMA|EMPTY/u.test(issue)),
            issues
          },
          {
            check: "source_refs_numbers_quotes_and_time",
            passed: !issues.some((issue) => /SOURCE_REF|UNVERIFIED|UNGROUNDED/u.test(issue)),
            issues
          },
          {
            check: "model_thinking_and_finish_reason",
            passed: !issues.some((issue) => /MODEL|THINKING|FINISH_REASON|INCOMPLETE|FILTERED/u.test(issue)),
            issues
          },
          {
            check: "invalidated_understanding_excluded",
            passed: !issues.some((issue) => /INVALIDATED|CORRECTION/u.test(issue)),
            issues
          }
        ]
      },
      trace: {
        prompt_hash: prompt.resolvedPromptHash,
        attempts,
        technical_retry_count: attempts.filter((attempt) => attempt.attempt === 2).length,
        quality_retry_count: 0,
        raw_response_sha256: [...attempts].reverse().find(
          (attempt) => attempt.raw_response_sha256
        )?.raw_response_sha256 ?? null,
        response_model: response?.responseModel ?? null,
        reasoning_present: response?.reasoningPresent ?? null,
        reasoning_tokens: response?.reasoningTokens ?? null,
        finish_reason: response?.finishReason ?? null,
        latency_ms: attempts.reduce((sum, attempt) => sum + attempt.latency_ms, 0),
        cost_cny: costs.length > 0
          ? Number(costs.reduce((sum, cost) => sum + cost, 0).toFixed(8))
          : null
      }
    }
  } satisfies Gi088ExtensionRecordCase;
}

function createScope(input: {
  sourceBundle: Gi088HumanExtensionSourceBundle;
  codeSnapshot: Array<{ path: string; sha256: string }>;
  priorZeroCallFailures: Gi088ExtensionPriorZeroCallFailure[];
}) {
  return {
    extensionVersion: GI088_HUMAN_EXTENSION_VERSION,
    frozenScopeSha256: GI088_HUMAN_EXTENSION_FROZEN_SCOPE_SHA256,
    roundId: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
    completedCalibration: input.sourceBundle.completedCalibration,
    importedManifestSha256: input.sourceBundle.importedManifestSha256,
    cases: input.sourceBundle.sources.map((source) => ({
      caseId: source.selection.caseId,
      sourceGroupId: source.selection.sourceGroupId,
      sourceFileSha256: source.sourceFileSha256,
      sourceProjectionSha256: source.sourceProjectionSha256
    })),
    model: GI088_HUMAN_EXTENSION_FLASH_MODEL.model,
    prompt: {
      version: GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION,
      systemPromptSha256: GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH
    },
    runtime: { ...GI088_HUMAN_EXTENSION_RUNTIME, providerAdapter: REAL_PROVIDER_ADAPTER },
    budget: GI088_HUMAN_EXTENSION_RECORD_BUDGET,
    priorZeroCallFailures: input.priorZeroCallFailures,
    codeSnapshot: input.codeSnapshot
  };
}

export function createGi088ExtensionRecordExecutionFingerprint(input: {
  scopeFingerprint: string;
  actualCalls: number;
  providerPreflight: Gi088ExtensionProviderPreflight | null;
  providerAdapter: string;
  cases: Gi088ExtensionRecordCase[];
  rawResponses: Gi088ExtensionRecordPackage["raw_responses"];
}) {
  return sha256Canonical({
    scopeFingerprint: input.scopeFingerprint,
    actualCalls: input.actualCalls,
    providerPreflight: input.providerPreflight && {
      requiredModel: input.providerPreflight.required_model,
      availableModelIdsSha256: input.providerPreflight.available_model_ids_sha256,
      credentialSource: input.providerPreflight.credential_source
    },
    providerAdapter: input.providerAdapter,
    cases: input.cases,
    rawResponses: input.rawResponses.map((response) => ({
      callFingerprint: response.call_fingerprint,
      caseId: response.case_id,
      attempt: response.attempt,
      sha256: response.sha256
    }))
  });
}

export async function runGi088HumanExtensionRecords(
  options: Gi088ExtensionRecordOptions,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: Partial<Gi088ExtensionRecordDependencies> = {},
  projectRoot = process.cwd()
) {
  assertRuntime();
  if (options.maxCalls !== MAX_CALLS) fail("GI088_EXTENSION_RECORD_MAX_CALLS_MUST_EQUAL_12");
  if (options.mode === "real" && (!options.confirmPrivateReplay
    || !options.maxCallsExplicit
    || !options.confirmScopeFingerprint)) {
    fail("GI088_EXTENSION_RECORD_REAL_CONFIRMATION_INCOMPLETE");
  }
  const deps: Gi088ExtensionRecordDependencies = {
    resolveCredential: dependencies.resolveCredential ?? resolveGi088CalibrationCredential,
    createRealProvider: dependencies.createRealProvider ?? createGi088OpenAICompatibleCalibrationProvider,
    createMockProvider: dependencies.createMockProvider ?? createGi088MockCalibrationProvider,
    fetcher: dependencies.fetcher ?? fetch,
    now: dependencies.now ?? (() => new Date()),
    appendLedger: dependencies.appendLedger ?? appendGi088ExtensionLedger
  };
  const [sourceBundle, codeSnapshot] = await Promise.all([
    loadGi088HumanExtensionSources(projectRoot),
    loadCodeSnapshot(projectRoot)
  ]);
  const realRoot = outputRoot(projectRoot, "real");
  // Completed real evidence prevents a second real replay. Mock and dry-run
  // verification remain isolated so they can continue to validate the runner.
  const priorZeroCallFailures = options.mode === "real"
    ? await loadGi088ExtensionPriorZeroCallFailures(realRoot)
    : [];
  const scope = createScope({ sourceBundle, codeSnapshot, priorZeroCallFailures });
  const scopeFingerprint = sha256Canonical(scope);
  const plan = {
    mode: "dry-run" as const,
    round_id: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
    scope_fingerprint: scopeFingerprint,
    completed_calibration_manifest_sha256:
      sourceBundle.completedCalibration.manifest_sha256,
    selected_cases: sourceBundle.sources.map((source) => ({
      case_id: source.selection.caseId,
      source_file_sha256: source.sourceFileSha256,
      source_projection_sha256: source.sourceProjectionSha256
    })),
    excluded_completed_cases: 3,
    model: GI088_HUMAN_EXTENSION_FLASH_MODEL.model,
    stage: "record_card" as const,
    prompt_version: GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION,
    system_prompt_sha256: GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH,
    nominal_model_calls: NOMINAL_CALLS,
    max_model_calls: MAX_CALLS,
    model_calls_executed: 0 as const,
    required_real_run_confirmation: {
      private_replay: true,
      scope_fingerprint: scopeFingerprint,
      max_calls: MAX_CALLS
    }
  };
  if (options.mode === "dry-run") return { plan, outputWritten: false as const };
  if (options.mode === "real" && options.confirmScopeFingerprint !== scopeFingerprint) {
    fail("GI088_EXTENSION_RECORD_SCOPE_CONFIRMATION_MISMATCH");
  }

  const root = outputRoot(projectRoot, options.mode);
  assertPrivateOutput(root, projectRoot);
  const runName = options.runId ?? (options.mode === "real"
    ? `${GI088_HUMAN_EXTENSION_RECORD_ROUND_ID}-${scopeFingerprint.slice(0, 8)}`
    : `${GI088_HUMAN_EXTENSION_RECORD_ROUND_ID}-mock-${scopeFingerprint.slice(0, 8)}-${deps.now().getTime()}`);
  const directory = resolve(root, runName);
  assertPrivateOutput(directory, projectRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(resolve(projectRoot, PRIVATE_ROOT_RELATIVE), 0o700);
  await chmod(root, 0o700);
  try {
    await access(directory);
    fail("GI088_EXTENSION_RECORD_OUTPUT_ALREADY_EXISTS");
  } catch (error) {
    if (error instanceof Gi088ExtensionRecordError) throw error;
  }
  await mkdir(directory, { mode: 0o700 });
  const ledgerPath = resolve(directory, "attempt-ledger.ndjson");
  const lockPath = resolve(directory, "round-run.lock.json");
  const packagePath = resolve(directory, "round-package.json");
  const manifestPath = resolve(directory, "commit-manifest.json");
  await writePrivateJsonAtomic(lockPath, {
    round_id: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
    status: "reserved",
    mode: options.mode,
    reserved_at: deps.now().toISOString(),
    scope_fingerprint: scopeFingerprint,
    prior_zero_call_failures: priorZeroCallFailures,
    observed_model_calls: 0
  });
  const actualCalls = { value: 0 };
  const rawResponses: Gi088ExtensionRecordPackage["raw_responses"] = [];
  let providerAdapter: string | null = null;
  try {
    let provider: Gi088CalibrationProvider;
    let providerPreflight: Gi088ExtensionProviderPreflight | null = null;
    if (options.mode === "real") {
      const credential = await deps.resolveCredential(env);
      providerPreflight = await validateFlashModel({
        apiKey: credential.apiKey,
        credentialSource: credential.source,
        fetcher: deps.fetcher,
        now: deps.now()
      });
      provider = deps.createRealProvider({
        apiKey: credential.apiKey,
        baseUrl: GI088_HUMAN_EXTENSION_RUNTIME.baseUrl
      });
    } else {
      provider = deps.createMockProvider();
    }
    assertProviderIdentity(options.mode, provider);
    providerAdapter = provider.name;
    const cases: Gi088ExtensionRecordCase[] = [];
    for (const source of sourceBundle.sources) {
      cases.push(await runRecordCase({
        provider,
        source,
        scopeFingerprint,
        actualCalls,
        ledgerPath,
        rawResponses,
        preCallGuard: async () => {
          await assertGi088HumanExtensionSourcesUnchanged(sourceBundle, projectRoot);
          if (options.mode === "real") {
            const current = await loadGi088ExtensionPriorZeroCallFailures(realRoot, runName);
            if (canonicalJson(current) !== canonicalJson(priorZeroCallFailures)) {
              fail("GI088_EXTENSION_RECORD_HISTORY_CHANGED");
            }
          }
        },
        now: deps.now,
        appendLedger: deps.appendLedger
      }));
    }
    if (cases.length !== 6
      || actualCalls.value < NOMINAL_CALLS
      || actualCalls.value > MAX_CALLS
      || cases.some((item) => item.candidate.trace.attempts.length < 1
        || item.candidate.trace.attempts.length > 2)) {
      fail("GI088_EXTENSION_RECORD_RESULT_BUDGET_INVALID");
    }
    await assertGi088HumanExtensionSourcesUnchanged(sourceBundle, projectRoot);
    const executionFingerprint = createGi088ExtensionRecordExecutionFingerprint({
      scopeFingerprint,
      actualCalls: actualCalls.value,
      providerPreflight,
      providerAdapter,
      cases,
      rawResponses
    });
    const resultPackage: Gi088ExtensionRecordPackage = {
      schema_version: "1.0",
      privacy_classification: "private_local_only",
      extension_version: GI088_HUMAN_EXTENSION_VERSION,
      round_id: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
      generated_at: deps.now().toISOString(),
      mode: options.mode,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      prior_zero_call_failures: priorZeroCallFailures,
      completed_calibration: sourceBundle.completedCalibration,
      imported_manifest_sha256: sourceBundle.importedManifestSha256,
      prompt: {
        version: GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION,
        system_prompt_sha256: GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH
      },
      runtime: {
        model: "deepseek-v4-flash",
        provider: "openai_compatible_rest",
        base_url: "https://api.deepseek.com",
        thinking: "disabled",
        temperature: 0.2,
        response_format: "json_object",
        headers_timeout_ms: 15_000,
        body_idle_timeout_ms: 45_000,
        hard_timeout_ms: 60_000,
        max_tokens_policy: "provider_default",
        max_technical_retries_per_case: 1,
        quality_retries: 0,
        provider_adapter: providerAdapter
      },
      budget: GI088_HUMAN_EXTENSION_RECORD_BUDGET,
      run: {
        actual_model_calls: actualCalls.value,
        technical_retries: cases.reduce(
          (sum, item) => sum + item.candidate.trace.technical_retry_count,
          0
        ),
        quality_retries: 0,
        completed_cases: cases.filter((item) => item.candidate.record_card).length,
        admitted_cases: cases.filter((item) => item.candidate.program_check.admitted).length
      },
      code_snapshot: codeSnapshot,
      provider_preflight: providerPreflight,
      cases,
      raw_responses: rawResponses
    };
    const packageContent = `${JSON.stringify(resultPackage, null, 2)}\n`;
    const temporaryPackage = resolve(directory, `.round-package.${process.pid}.tmp`);
    await writePrivateFile(temporaryPackage, packageContent);
    await rename(temporaryPackage, packagePath);
    await chmod(packagePath, 0o600);
    const packageSha256 = sha256Text(packageContent);
    await writePrivateJsonAtomic(lockPath, {
      round_id: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
      status: "completed",
      mode: options.mode,
      completed_at: deps.now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      provider_adapter: providerAdapter,
      package_sha256: packageSha256,
      actual_model_calls: actualCalls.value
    });
    const [attemptLedgerSha256, runLockSha256] = await Promise.all([
      sha256File(ledgerPath),
      sha256File(lockPath)
    ]);
    await writePrivateJsonAtomic(manifestPath, {
      schema_version: "1.0",
      status: "committed",
      committed_at: deps.now().toISOString(),
      round_id: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      provider_adapter: providerAdapter,
      completed_calibration_manifest_sha256:
        sourceBundle.completedCalibration.manifest_sha256,
      child_artifacts: {
        package_sha256: packageSha256,
        attempt_ledger_sha256: attemptLedgerSha256,
        run_lock_sha256: runLockSha256
      },
      files: {
        package: "round-package.json",
        attempt_ledger: "attempt-ledger.ndjson",
        run_lock: "round-run.lock.json"
      },
      calls: { nominal: NOMINAL_CALLS, actual: actualCalls.value, maximum: MAX_CALLS }
    });
    return {
      package: resultPackage,
      outputWritten: true as const,
      outputDirectory: directory,
      packagePath,
      manifestPath,
      scopeFingerprint
    };
  } catch (error) {
    await writePrivateJsonAtomic(lockPath, {
      round_id: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
      status: "failed",
      mode: options.mode,
      failed_at: deps.now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      provider_adapter: providerAdapter,
      provider_adapter_expected: options.mode === "real" ? REAL_PROVIDER_ADAPTER : "mock",
      observed_model_calls: actualCalls.value,
      error_code: safeGi088ExtensionRecordErrorCode(error)
    }).catch(() => undefined);
    throw error;
  }
}

interface Gi088ExtensionCommitManifest {
  schema_version: "1.0";
  status: "committed";
  round_id: typeof GI088_HUMAN_EXTENSION_RECORD_ROUND_ID;
  scope_fingerprint: string;
  execution_fingerprint: string;
  provider_adapter: string;
  completed_calibration_manifest_sha256: string;
  child_artifacts: {
    package_sha256: string;
    attempt_ledger_sha256: string;
    run_lock_sha256: string;
  };
  files: {
    package: "round-package.json";
    attempt_ledger: "attempt-ledger.ndjson";
    run_lock: "round-run.lock.json";
  };
  calls: { nominal: 6; actual: number; maximum: 12 };
}

interface Gi088ExtensionRunLock {
  round_id: typeof GI088_HUMAN_EXTENSION_RECORD_ROUND_ID;
  status: "completed";
  mode: "mock" | "real";
  scope_fingerprint: string;
  execution_fingerprint: string;
  provider_adapter: string;
  package_sha256: string;
  actual_model_calls: number;
}

async function readJson<T>(path: string, code: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    fail(code);
  }
}

async function readLedger(path: string) {
  try {
    return (await readFile(path, "utf8")).split(/\r?\n/u).flatMap((line) => {
      if (!line.trim()) return [];
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        fail("GI088_EXTENSION_RECORD_LEDGER_INVALID");
      }
    });
  } catch (error) {
    if (error instanceof Gi088ExtensionRecordError) throw error;
    fail("GI088_EXTENSION_RECORD_LEDGER_INVALID");
  }
}

export interface LoadedGi088ExtensionRecordRound {
  directory: string;
  package: Gi088ExtensionRecordPackage;
  manifest: Gi088ExtensionCommitManifest;
  runLock: Gi088ExtensionRunLock;
  ledger: Array<Record<string, unknown>>;
  sourceBundle: Gi088HumanExtensionSourceBundle;
  artifactSha256: {
    package: string;
    manifest: string;
    attempt_ledger: string;
    run_lock: string;
  };
}

export async function loadCommittedGi088ExtensionRecordRound(
  directory: string,
  options: {
    allowMock?: boolean;
    projectRoot?: string;
    /**
     * A later, zero-call review continuation can revalidate the sealed raw
     * response against its parent package while recording its own current code
     * fingerprint. The original generation package remains immutable.
     */
    allowCodeSnapshotDrift?: boolean;
  } = {}
): Promise<LoadedGi088ExtensionRecordRound> {
  const projectRoot = options.projectRoot ?? process.cwd();
  assertPrivateOutput(directory, projectRoot);
  const paths = {
    package: resolve(directory, "round-package.json"),
    manifest: resolve(directory, "commit-manifest.json"),
    attemptLedger: resolve(directory, "attempt-ledger.ndjson"),
    runLock: resolve(directory, "round-run.lock.json")
  };
  const [resultPackage, manifest, runLock, ledger, sourceBundle,
    packageSha256, manifestSha256, attemptLedgerSha256, runLockSha256] = await Promise.all([
    readJson<Gi088ExtensionRecordPackage>(paths.package, "GI088_EXTENSION_RECORD_PACKAGE_INVALID"),
    readJson<Gi088ExtensionCommitManifest>(paths.manifest, "GI088_EXTENSION_RECORD_MANIFEST_INVALID"),
    readJson<Gi088ExtensionRunLock>(paths.runLock, "GI088_EXTENSION_RECORD_LOCK_INVALID"),
    readLedger(paths.attemptLedger),
    loadGi088HumanExtensionSources(projectRoot),
    sha256File(paths.package),
    sha256File(paths.manifest),
    sha256File(paths.attemptLedger),
    sha256File(paths.runLock)
  ]);
  if (manifest.schema_version !== "1.0"
    || manifest.status !== "committed"
    || manifest.round_id !== GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
    || manifest.files.package !== "round-package.json"
    || manifest.files.attempt_ledger !== "attempt-ledger.ndjson"
    || manifest.files.run_lock !== "round-run.lock.json"
    || manifest.child_artifacts.package_sha256 !== packageSha256
    || manifest.child_artifacts.attempt_ledger_sha256 !== attemptLedgerSha256
    || manifest.child_artifacts.run_lock_sha256 !== runLockSha256
    || manifest.completed_calibration_manifest_sha256
      !== sourceBundle.completedCalibration.manifest_sha256
    || runLock.status !== "completed"
    || runLock.round_id !== GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
    || runLock.package_sha256 !== packageSha256
    || runLock.scope_fingerprint !== resultPackage.scope_fingerprint
    || runLock.execution_fingerprint !== resultPackage.execution_fingerprint
    || runLock.actual_model_calls !== resultPackage.run.actual_model_calls
    || resultPackage.schema_version !== "1.0"
    || resultPackage.privacy_classification !== "private_local_only"
    || resultPackage.extension_version !== GI088_HUMAN_EXTENSION_VERSION
    || resultPackage.round_id !== GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
    || (resultPackage.mode !== "real" && !options.allowMock)
    || resultPackage.prompt.version !== GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION
    || resultPackage.prompt.system_prompt_sha256
      !== GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH
    || resultPackage.runtime.model !== "deepseek-v4-flash"
    || resultPackage.runtime.thinking !== "disabled"
    || resultPackage.runtime.temperature !== 0.2
    || resultPackage.runtime.quality_retries !== 0
    || resultPackage.budget.caseCount !== 6
    || resultPackage.budget.nominalModelCalls !== 6
    || resultPackage.budget.maxModelCalls !== 12
    || resultPackage.cases.length !== 6) {
    fail("GI088_EXTENSION_RECORD_COMMIT_INVALID");
  }
  if (resultPackage.mode === "real"
    && resultPackage.runtime.provider_adapter !== REAL_PROVIDER_ADAPTER) {
    fail("GI088_EXTENSION_RECORD_PROVIDER_ADAPTER_INVALID");
  }
  const expectedSnapshotPaths = [...IMPLEMENTATION_FILES];
  if (resultPackage.code_snapshot.length !== expectedSnapshotPaths.length
    || resultPackage.code_snapshot.map((item) => item.path).join("\n")
      !== expectedSnapshotPaths.join("\n")) {
    fail("GI088_EXTENSION_RECORD_CODE_SNAPSHOT_INVALID");
  }
  if (!options.allowCodeSnapshotDrift) {
    await Promise.all(resultPackage.code_snapshot.map(async (item) => {
      if (await sha256File(resolve(projectRoot, item.path)) !== item.sha256) {
        fail("GI088_EXTENSION_RECORD_CODE_SNAPSHOT_CHANGED");
      }
    }));
  }
  await assertGi088HumanExtensionSourcesUnchanged(sourceBundle, projectRoot);
  const expectedScope = sha256Canonical(createScope({
    sourceBundle,
    codeSnapshot: resultPackage.code_snapshot,
    priorZeroCallFailures: resultPackage.prior_zero_call_failures
  }));
  if (expectedScope !== resultPackage.scope_fingerprint
    || manifest.scope_fingerprint !== resultPackage.scope_fingerprint
    || manifest.execution_fingerprint !== resultPackage.execution_fingerprint
    || resultPackage.imported_manifest_sha256 !== sourceBundle.importedManifestSha256
    || canonicalJson(resultPackage.completed_calibration)
      !== canonicalJson(sourceBundle.completedCalibration)) {
    fail("GI088_EXTENSION_RECORD_SCOPE_INVALID");
  }

  const reserved = ledger.filter((event) => event.event === "call_reserved");
  const terminal = ledger.filter((event) =>
    event.event === "call_completed" || event.event === "call_failed"
  );
  const reservedByFingerprint = new Map(reserved.map((event) => [
    String(event.call_fingerprint ?? ""), event
  ]));
  const terminalByFingerprint = new Map(terminal.map((event) => [
    String(event.call_fingerprint ?? ""), event
  ]));
  const rawByFingerprint = new Map(resultPackage.raw_responses.map((response) => [
    response.call_fingerprint, response
  ]));
  if (reserved.length !== resultPackage.run.actual_model_calls
    || terminal.length !== reserved.length
    || reservedByFingerprint.size !== reserved.length
    || terminalByFingerprint.size !== terminal.length
    || rawByFingerprint.size !== resultPackage.raw_responses.length) {
    fail("GI088_EXTENSION_RECORD_LEDGER_INVALID");
  }
  let retryCount = 0;
  for (const recordCase of resultPackage.cases) {
    const source = sourceBundle.sources.find(
      (item) => item.selection.caseId === recordCase.case_id
    );
    if (!source
      || source.selection.sourceGroupId !== recordCase.source_group_id
      || source.sourceFileSha256 !== recordCase.source_file_sha256
      || source.sourceProjectionSha256 !== recordCase.source_projection_sha256) {
      fail("GI088_EXTENSION_RECORD_SOURCE_BINDING_INVALID");
    }
    const catalog = recordCardSourceCatalog(source);
    const prompt = buildGi088RecordCardCalibrationPrompt(source);
    const expectedCandidateId = candidateId(resultPackage.scope_fingerprint, source);
    if (recordCase.candidate.candidate_id !== expectedCandidateId
      || recordCase.source_catalog_sha256 !== sha256Canonical(catalog.trace)
      || recordCase.candidate.trace.prompt_hash !== prompt.resolvedPromptHash) {
      fail("GI088_EXTENSION_RECORD_CANDIDATE_BINDING_INVALID");
    }
    const attempts = recordCase.candidate.trace.attempts;
    if (attempts.length < 1 || attempts.length > 2
      || attempts[0].attempt !== 1
      || (attempts.length === 2 && (attempts[0].outcome !== "technical_failure"
        || attempts[0].retry_scheduled !== true
        || attempts[1].attempt !== 2))
      || attempts.at(-1)?.retry_scheduled !== false) {
      fail("GI088_EXTENSION_RECORD_ATTEMPT_SEQUENCE_INVALID");
    }
    retryCount += attempts.filter((attempt) => attempt.attempt === 2).length;
    let finalRaw: Gi088ExtensionRecordPackage["raw_responses"][number] | null = null;
    let finalAttempt: Gi088CalibrationAttemptTrace | null = null;
    for (const attempt of attempts) {
      const expectedCallFingerprint = sha256Canonical({
        scopeFingerprint: resultPackage.scope_fingerprint,
        caseId: recordCase.case_id,
        candidateId: expectedCandidateId,
        stage: "record_card",
        attempt: attempt.attempt,
        promptHash: prompt.resolvedPromptHash,
        sourceProjectionSha256: source.sourceProjectionSha256
      });
      const reserveEvent = reservedByFingerprint.get(attempt.call_fingerprint);
      const terminalEvent = terminalByFingerprint.get(attempt.call_fingerprint);
      const raw = rawByFingerprint.get(attempt.call_fingerprint);
      if (attempt.call_fingerprint !== expectedCallFingerprint
        || !reserveEvent || !terminalEvent
        || reserveEvent.case_id !== recordCase.case_id
        || reserveEvent.candidate_id !== expectedCandidateId
        || reserveEvent.stage !== "record_card"
        || reserveEvent.model !== "deepseek-v4-flash"
        || reserveEvent.attempt !== attempt.attempt) {
        fail("GI088_EXTENSION_RECORD_CALL_BINDING_INVALID");
      }
      if (attempt.outcome === "valid_response") {
        if (!raw
          || terminalEvent.event !== "call_completed"
          || raw.case_id !== recordCase.case_id
          || raw.candidate_id !== expectedCandidateId
          || raw.attempt !== attempt.attempt
          || sha256Text(raw.content) !== raw.sha256
          || raw.sha256 !== attempt.raw_response_sha256
          || terminalEvent.raw_response_sha256 !== raw.sha256) {
          fail("GI088_EXTENSION_RECORD_RAW_RESPONSE_INVALID");
        }
        finalRaw = raw;
        finalAttempt = attempt;
      } else if (raw || terminalEvent.event !== "call_failed") {
        fail("GI088_EXTENSION_RECORD_TECHNICAL_ATTEMPT_INVALID");
      }
    }
    if (finalRaw && finalAttempt) {
      const contractIssues = [
        ...(finalAttempt.response_model === "deepseek-v4-flash"
          ? [] : [`RECORD_CARD_RESPONSE_MODEL_MISMATCH:${finalAttempt.response_model ?? "missing"}`]),
        ...(finalAttempt.reasoning_present === false
          && (finalAttempt.reasoning_tokens ?? 0) === 0
          ? [] : ["RECORD_CARD_THINKING_NOT_DISABLED"])
      ];
      const parsed = contractIssues.length === 0
        ? parseRecordCardOutput({
            source,
            content: finalRaw.content,
            finishReason: finalAttempt.finish_reason
          })
        : null;
      if (canonicalJson(recordCase.candidate.record_card)
          !== canonicalJson(parsed?.compiled?.recordCard ?? null)
        || recordCase.candidate.occurred_at_text
          !== (parsed?.compiled?.occurredAtText ?? null)
        || recordCase.candidate.program_check.admitted
          !== Boolean(parsed?.accepted && parsed.compiled?.recordCard)
        || recordCase.candidate.trace.raw_response_sha256 !== finalRaw.sha256
        || recordCase.candidate.trace.response_model !== finalAttempt.response_model
        || recordCase.candidate.trace.reasoning_present !== finalAttempt.reasoning_present
        || recordCase.candidate.trace.reasoning_tokens !== finalAttempt.reasoning_tokens
        || recordCase.candidate.trace.finish_reason !== finalAttempt.finish_reason) {
        fail("GI088_EXTENSION_RECORD_RAW_PROJECTION_INVALID");
      }
    } else if (recordCase.candidate.record_card
      || recordCase.candidate.program_check.admitted
      || recordCase.candidate.trace.raw_response_sha256) {
      fail("GI088_EXTENSION_RECORD_TECHNICAL_PROJECTION_INVALID");
    }
  }
  const executionFingerprint = createGi088ExtensionRecordExecutionFingerprint({
    scopeFingerprint: resultPackage.scope_fingerprint,
    actualCalls: resultPackage.run.actual_model_calls,
    providerPreflight: resultPackage.provider_preflight,
    providerAdapter: resultPackage.runtime.provider_adapter,
    cases: resultPackage.cases,
    rawResponses: resultPackage.raw_responses
  });
  if (executionFingerprint !== resultPackage.execution_fingerprint
    || resultPackage.run.technical_retries !== retryCount
    || resultPackage.run.quality_retries !== 0
    || resultPackage.run.completed_cases
      !== resultPackage.cases.filter((item) => item.candidate.record_card).length
    || resultPackage.run.admitted_cases
      !== resultPackage.cases.filter((item) => item.candidate.program_check.admitted).length
    || manifest.calls.nominal !== 6
    || manifest.calls.maximum !== 12
    || manifest.calls.actual !== resultPackage.run.actual_model_calls) {
    fail("GI088_EXTENSION_RECORD_EXECUTION_INVALID");
  }
  return {
    directory,
    package: resultPackage,
    manifest,
    runLock,
    ledger,
    sourceBundle,
    artifactSha256: {
      package: packageSha256,
      manifest: manifestSha256,
      attempt_ledger: attemptLedgerSha256,
      run_lock: runLockSha256
    }
  };
}

function argumentValue(argv: string[], index: number, flag: string) {
  const inline = argv[index].startsWith(`${flag}=`) ? argv[index].slice(flag.length + 1) : null;
  if (inline !== null) return { value: inline, consumed: 0 };
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail("GI088_EXTENSION_RECORD_ARGUMENT_VALUE_REQUIRED");
  return { value, consumed: 1 };
}

export function parseGi088ExtensionRecordArgs(argv: string[]): Gi088ExtensionRecordOptions {
  const options: Gi088ExtensionRecordOptions = {
    mode: "dry-run",
    confirmPrivateReplay: false,
    confirmScopeFingerprint: null,
    maxCalls: MAX_CALLS,
    maxCallsExplicit: false,
    runId: null
  };
  let modeSet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute-mock" || argument === "--execute-real") {
      if (modeSet) fail("GI088_EXTENSION_RECORD_MODE_DUPLICATE");
      options.mode = argument === "--execute-real" ? "real" : "mock";
      modeSet = true;
    } else if (argument === "--confirm-private-replay") {
      options.confirmPrivateReplay = true;
    } else if (argument === "--confirm-scope" || argument.startsWith("--confirm-scope=")) {
      const parsed = argumentValue(argv, index, "--confirm-scope");
      options.confirmScopeFingerprint = parsed.value;
      index += parsed.consumed;
    } else if (argument === "--max-calls" || argument.startsWith("--max-calls=")) {
      const parsed = argumentValue(argv, index, "--max-calls");
      options.maxCalls = Number(parsed.value);
      options.maxCallsExplicit = true;
      index += parsed.consumed;
    } else if (argument === "--run-id" || argument.startsWith("--run-id=")) {
      const parsed = argumentValue(argv, index, "--run-id");
      options.runId = parsed.value;
      index += parsed.consumed;
    } else {
      fail(`GI088_EXTENSION_RECORD_ARGUMENT_INVALID:${argument}`);
    }
  }
  if (!Number.isInteger(options.maxCalls) || options.maxCalls !== MAX_CALLS) {
    fail("GI088_EXTENSION_RECORD_MAX_CALLS_MUST_EQUAL_12");
  }
  if (options.runId && !/^[a-z0-9][a-z0-9-]{2,90}$/u.test(options.runId)) {
    fail("GI088_EXTENSION_RECORD_RUN_ID_INVALID");
  }
  if (options.mode === "real" && (!options.confirmPrivateReplay
    || !options.maxCallsExplicit
    || !options.confirmScopeFingerprint)) {
    fail("GI088_EXTENSION_RECORD_EXACT_CONFIRMATION_REQUIRED");
  }
  return options;
}

export function safeGi088ExtensionRecordErrorCode(error: unknown) {
  if (error instanceof Gi088ExtensionRecordError) return error.code;
  return safeGi088CalibrationErrorCode(error);
}

export async function mainGi088ExtensionRecordCli() {
  const options = parseGi088ExtensionRecordArgs(process.argv.slice(2));
  const result = await runGi088HumanExtensionRecords(options);
  if ("plan" in result) {
    process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    status: "committed",
    mode: result.package.mode,
    scope_fingerprint: result.scopeFingerprint,
    execution_fingerprint: result.package.execution_fingerprint,
    actual_model_calls: result.package.run.actual_model_calls,
    admitted_cases: result.package.run.admitted_cases,
    output_directory: relative(process.cwd(), result.outputDirectory)
  }, null, 2)}\n`);
}
