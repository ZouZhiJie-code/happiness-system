import {
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  stat
} from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";

import {
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  estimateGi088CalibrationCostCny,
  sha256Canonical,
  sha256Text,
  type Gi088CalibrationAttemptTrace,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderResult,
  type Gi088CalibrationRecordCard
} from "./gi088-calibration-contract";
import {
  createGi088MockCalibrationProvider,
  createGi088OpenAICompatibleCalibrationProvider,
  Gi088CalibrationProviderError
} from "./gi088-calibration-provider";
import {
  GI088_HUMAN_EXTENSION_FLASH_MODEL,
  GI088_HUMAN_EXTENSION_RUNTIME
} from "./gi088-human-extension-contract";
import {
  assertGi088HumanExtensionSourcesUnchanged,
  loadGi088HumanExtensionSources,
  type Gi088HumanExtensionSourceBundle
} from "./gi088-human-extension-source";
import {
  buildGi088RecordCardRewritePrompt,
  buildGi088RecordCardWritingMaterial,
  GI088_RECORD_CARD_REWRITE_PROMPT_VERSION,
  GI088_RECORD_CARD_REWRITE_ROUND_ID,
  GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT_HASH,
  GI088_RECORD_CARD_REWRITE_VERSION,
  parseGi088RecordCardRewriteOutput,
  type Gi088RecordCardRewriteDiagnostics
} from "./gi088-record-card-rewrite-contract";
import { sha256File } from "./private-export-importer";
import {
  resolveGi088CalibrationCredential,
  safeGi088CalibrationErrorCode,
  type Gi088CalibrationCredential
} from "./run-gi088-calibration";
import {
  appendGi088ExtensionLedger,
  loadCommittedGi088ExtensionRecordRound,
  type Gi088ExtensionRecordCase,
  type LoadedGi088ExtensionRecordRound
} from "./run-gi088-human-extension-records";

const PRIVATE_ROOT = "artifacts/journal-generation-evaluation/.private" as const;
const OUTPUT_ROOT = `${PRIVATE_ROOT}/formal/record-card-rewrite` as const;
const MOCK_ROOT = `${PRIVATE_ROOT}/record-card-rewrite-mock` as const;
const PARENT_DIRECTORY =
  `${PRIVATE_ROOT}/formal/extension/record-cards/gi088-human-extension-record-cards-a5d06697` as const;
const NOMINAL_CALLS = 6 as const;
const MAX_CALLS = 12 as const;
const REAL_PROVIDER = "deepseek_official_openai_compatible" as const;

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
  "scripts/journal-generation-eval/gi088-record-card-rewrite-contract.ts",
  "scripts/journal-generation-eval/run-gi088-record-card-rewrite.ts",
  "scripts/journal-generation-eval/run-gi088-record-card-rewrite-cli.ts",
  "scripts/journal-generation-eval/run-gi088-human-extension-records.ts",
  "src/features/ai-quality/prompt-manifest.ts",
  "src/server/services/ai/ai-provider.ts",
  "src/server/services/ai/openai.provider.ts"
] as const;

export interface Gi088RecordCardRewriteProgramFailure {
  code: string;
  severity: "P0" | "technical";
}

export interface Gi088RecordCardRewriteCase {
  case_id: string;
  source_group_id: string;
  source_file_sha256: string;
  source_projection_sha256: string;
  parent_candidate_id: string;
  baseline_record_card: Gi088CalibrationRecordCard;
  baseline_record_card_sha256: string;
  writing_material_sha256: string;
  writing_material_counts: {
    user_evidence: number;
    content_evidence: number;
    valid_insights: number;
    question_contexts: number;
    required_sources: number;
  };
  candidate: {
    candidate_id: string;
    record_card: Gi088CalibrationRecordCard | null;
    paragraphs: Array<{ text: string; sourceRefs: string[] }>;
    program_check: {
      admitted: boolean;
      failures: Gi088RecordCardRewriteProgramFailure[];
      diagnostics: Gi088RecordCardRewriteDiagnostics;
    };
    trace: {
      prompt_hash: string;
      attempts: Gi088CalibrationAttemptTrace[];
      technical_retry_count: number;
      quality_retry_count: 0;
      raw_response_sha256: string | null;
      latency_ms: number;
      cost_cny: number | null;
    };
  };
}

export interface Gi088RecordCardRewritePackage {
  schema_version: "1.0";
  privacy_classification: "private_local_only";
  version: typeof GI088_RECORD_CARD_REWRITE_VERSION;
  round_id: typeof GI088_RECORD_CARD_REWRITE_ROUND_ID;
  mode: "mock" | "real";
  generated_at: string;
  scope_fingerprint: string;
  execution_fingerprint: string;
  parent: {
    round_id: string;
    execution_fingerprint: string;
    scope_fingerprint: string;
    artifacts: LoadedGi088ExtensionRecordRound["artifactSha256"];
  };
  prompt: {
    version: typeof GI088_RECORD_CARD_REWRITE_PROMPT_VERSION;
    system_prompt_sha256: typeof GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT_HASH;
    few_shot_count: 0;
  };
  runtime: {
    model: "deepseek-v4-flash";
    provider: "openai_compatible_rest";
    base_url: "https://api.deepseek.com";
    thinking: "disabled";
    temperature: 0.2;
    response_format: "json_object";
    hard_timeout_ms: 60_000;
    max_technical_retries_per_case: 1;
    quality_retries: 0;
    provider_adapter: string;
  };
  budget: {
    cases: 6;
    nominal_model_calls: 6;
    max_model_calls: 12;
  };
  run: {
    actual_model_calls: number;
    technical_retries: number;
    quality_retries: 0;
    admitted_cases: number;
  };
  provider_preflight: {
    performed_at: string;
    required_model: "deepseek-v4-flash";
    available_model_ids_sha256: string;
    credential_source: Gi088CalibrationCredential["source"];
  } | null;
  code_snapshot: Array<{ path: string; sha256: string }>;
  cases: Gi088RecordCardRewriteCase[];
  raw_responses: Array<{
    call_fingerprint: string;
    case_id: string;
    candidate_id: string;
    attempt: 1 | 2;
    sha256: string;
    content: string;
  }>;
}

export interface Gi088RecordCardRewriteOptions {
  mode: "dry-run" | "mock" | "real";
  confirmPrivateReplay: boolean;
  confirmScope: string | null;
  maxCalls: number;
  maxCallsExplicit: boolean;
  runId: string | null;
}

export class Gi088RecordCardRewriteError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Gi088RecordCardRewriteError";
  }
}

function fail(code: string): never {
  throw new Gi088RecordCardRewriteError(code);
}

function assertRunId(runId: string) {
  if (!/^[a-z0-9][a-z0-9-]{3,120}$/u.test(runId)) {
    fail("GI088_RECORD_REWRITE_RUN_ID_INVALID");
  }
}

function assertContainedPath(root: string, target: string) {
  const child = relative(root, target);
  if (child === "" || child === ".." || child.startsWith(`..${sep}`) || child.startsWith(sep)) {
    fail("GI088_RECORD_REWRITE_PATH_OUTSIDE_PRIVATE_ROOT");
  }
}

function assertRuntime() {
  if (sha256Canonical(GI088_HUMAN_EXTENSION_RUNTIME)
      !== sha256Canonical(GI088_JOURNAL_CALIBRATION_RUNTIME)
    || GI088_JOURNAL_CALIBRATION_RUNTIME.temperature !== 0.2
    || GI088_JOURNAL_CALIBRATION_RUNTIME.thinking !== "disabled"
    || GI088_JOURNAL_CALIBRATION_RUNTIME.maxTechnicalRetriesPerStage !== 1
    || GI088_JOURNAL_CALIBRATION_RUNTIME.qualityRetries !== 0) {
    fail("GI088_RECORD_REWRITE_RUNTIME_MISMATCH");
  }
}

async function privateWrite(path: string, content: string, exclusive = true) {
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

async function privateJsonAtomic(path: string, value: unknown) {
  const temporary = resolve(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  await privateWrite(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

async function codeSnapshot(projectRoot: string) {
  return await Promise.all(IMPLEMENTATION_FILES.map(async (path) => ({
    path,
    sha256: await sha256File(resolve(projectRoot, path))
  })));
}

async function parentRound(projectRoot: string) {
  return await loadCommittedGi088ExtensionRecordRound(resolve(projectRoot, PARENT_DIRECTORY), {
    projectRoot,
    allowCodeSnapshotDrift: true
  });
}

function parentIdentity(parent: LoadedGi088ExtensionRecordRound) {
  return {
    round_id: parent.package.round_id,
    execution_fingerprint: parent.package.execution_fingerprint,
    scope_fingerprint: parent.package.scope_fingerprint,
    artifacts: parent.artifactSha256
  };
}

function baselineCase(parent: LoadedGi088ExtensionRecordRound, caseId: string) {
  const matches = parent.package.cases.filter((item) => item.case_id === caseId);
  if (matches.length !== 1 || !matches[0].candidate.record_card) {
    fail(`GI088_RECORD_REWRITE_BASELINE_CASE_INVALID:${caseId}`);
  }
  return matches[0] as Gi088ExtensionRecordCase & {
    candidate: Gi088ExtensionRecordCase["candidate"] & { record_card: Gi088CalibrationRecordCard };
  };
}

async function assertEvidenceUnchanged(input: {
  projectRoot: string;
  sources: Gi088HumanExtensionSourceBundle;
  parent: LoadedGi088ExtensionRecordRound;
}) {
  await assertGi088HumanExtensionSourcesUnchanged(input.sources, input.projectRoot);
  const currentParent = await parentRound(input.projectRoot);
  if (sha256Canonical(parentIdentity(currentParent)) !== sha256Canonical(parentIdentity(input.parent))) {
    fail("GI088_RECORD_REWRITE_PARENT_CHANGED");
  }
}

async function assertNoPriorObservedRealRun(projectRoot: string, scopeFingerprint: string) {
  const root = resolve(projectRoot, OUTPUT_ROOT);
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const lockPath = resolve(root, entry, "round-run.lock.json");
    let lock: Record<string, unknown>;
    try {
      lock = JSON.parse(await readFile(lockPath, "utf8")) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (lock.mode === "real"
      && lock.round_id === GI088_RECORD_CARD_REWRITE_ROUND_ID
      && lock.scope_fingerprint === scopeFingerprint
      && (lock.status === "completed" || Number(lock.observed_model_calls ?? 0) > 0)) {
      fail("GI088_RECORD_REWRITE_PRIOR_REAL_RUN_EXISTS");
    }
  }
}

function mockProvider() {
  return createGi088MockCalibrationProvider((request) => {
    const payload = JSON.parse(request.messages.at(-1)?.content ?? "{}") as {
      userEvidence?: Array<{ sourceRef: string; text: string; usage: string }>;
      validInsights?: Array<{ sourceRef: string; text: string }>;
      requiredSourceRefs?: string[];
    };
    const contentEvidence = (payload.userEvidence ?? []).filter((item) => item.usage === "content");
    const insights = payload.validInsights ?? [];
    const allText = [...contentEvidence.map((item) => item.text), ...insights.map((item) => item.text)];
    return {
      content: JSON.stringify({
        title: {
          text: [...(contentEvidence[0]?.text ?? "今天的记录")].slice(0, 12).join(""),
          sourceRefs: [contentEvidence[0]?.sourceRef ?? payload.requiredSourceRefs?.[0]]
        },
        paragraphs: [{
          text: allText.join("。"),
          sourceRefs: payload.requiredSourceRefs ?? []
        }]
      }),
      latencyMs: 8,
      provider: "mock",
      finishReason: "stop",
      tokenUsage: {
        promptTokens: 240,
        completionTokens: 100,
        totalTokens: 340,
        promptCacheHitTokens: 40,
        promptCacheMissTokens: 200
      },
      upstreamRequestId: `mock-${request.callFingerprint.slice(0, 16)}`,
      reasoningPresent: false,
      reasoningTokens: 0,
      responseModel: "deepseek-v4-flash"
    };
  });
}

function normalizeProviderError(error: unknown, elapsed: number) {
  return error instanceof Gi088CalibrationProviderError
    ? error
    : new Gi088CalibrationProviderError(safeGi088CalibrationErrorCode(error), false, elapsed);
}

async function runCase(input: {
  provider: Gi088CalibrationProvider;
  source: Gi088HumanExtensionSourceBundle["sources"][number];
  baseline: ReturnType<typeof baselineCase>;
  scopeFingerprint: string;
  actualCalls: { value: number };
  ledgerPath: string;
  rawResponses: Gi088RecordCardRewritePackage["raw_responses"];
  now: () => Date;
  preCallGuard: () => Promise<void>;
}) {
  const material = buildGi088RecordCardWritingMaterial(input.source);
  const prompt = buildGi088RecordCardRewritePrompt(input.source, material);
  const id = `record-rewrite-${sha256Canonical({
    scopeFingerprint: input.scopeFingerprint,
    caseId: input.source.selection.caseId
  }).slice(0, 20)}`;
  const attempts: Gi088CalibrationAttemptTrace[] = [];
  let final: Gi088CalibrationProviderResult | null = null;
  let parsed: ReturnType<typeof parseGi088RecordCardRewriteOutput> | null = null;
  let terminalCode = "RECORD_REWRITE_TECHNICAL_FAILURE";
  for (const attempt of [1, 2] as const) {
    if (input.actualCalls.value >= MAX_CALLS) fail("GI088_RECORD_REWRITE_CALL_BUDGET_EXCEEDED");
    await input.preCallGuard();
    const callFingerprint = sha256Canonical({
      scopeFingerprint: input.scopeFingerprint,
      caseId: input.source.selection.caseId,
      candidateId: id,
      attempt,
      promptHash: prompt.resolvedPromptHash,
      writingMaterialSha256: sha256Canonical(material)
    });
    const sequence = input.actualCalls.value + 1;
    await appendGi088ExtensionLedger(input.ledgerPath, {
      event: "call_reserved",
      at: input.now().toISOString(),
      sequence,
      call_fingerprint: callFingerprint,
      case_id: input.source.selection.caseId,
      candidate_id: id,
      stage: "record_card",
      attempt,
      model: "deepseek-v4-flash",
      provider_adapter: input.provider.name
    });
    input.actualCalls.value = sequence;
    const started = Date.now();
    let response: Gi088CalibrationProviderResult;
    try {
      response = await input.provider.complete({
        callFingerprint,
        caseId: input.source.selection.caseId,
        candidateId: id,
        stage: "record_card",
        attempt,
        model: GI088_HUMAN_EXTENSION_FLASH_MODEL,
        messages: prompt.messages,
        promptHash: prompt.resolvedPromptHash,
        sourceRefs: material.allowedSourceRefs,
        sourceTextByRef: Object.fromEntries([
          ...material.userEvidence.map((item) => [item.sourceRef, item.text]),
          ...material.validInsights.map((item) => [item.sourceRef, item.text])
        ]),
        sourceRecordIds: [],
        sourceRecordTextById: {},
        runtime: GI088_JOURNAL_CALIBRATION_RUNTIME
      });
    } catch (error) {
      const technical = normalizeProviderError(error, Date.now() - started);
      const retry = attempt === 1 && technical.retryable;
      terminalCode = technical.code;
      attempts.push({
        call_fingerprint: callFingerprint,
        stage: "record_card",
        attempt,
        outcome: "technical_failure",
        error_code: technical.code,
        retry_scheduled: retry,
        latency_ms: technical.latencyMs,
        token_usage: technical.tokenUsage,
        finish_reason: technical.finishReason,
        upstream_request_id: technical.upstreamRequestId,
        provider: null,
        response_model: null,
        reasoning_present: null,
        reasoning_tokens: null,
        cost_cny: estimateGi088CalibrationCostCny({
          model: "deepseek-v4-flash",
          tokenUsage: technical.tokenUsage
        }),
        raw_response_sha256: null
      });
      await appendGi088ExtensionLedger(input.ledgerPath, {
        event: "call_failed",
        at: input.now().toISOString(),
        sequence,
        call_fingerprint: callFingerprint,
        error_code: technical.code,
        retry_scheduled: retry
      });
      if (retry) continue;
      break;
    }
    const rawSha = sha256Text(response.content);
    const contractIssues = [
      ...(response.responseModel === "deepseek-v4-flash" ? [] : ["RECORD_REWRITE_MODEL_MISMATCH"]),
      ...(response.reasoningPresent === false && (response.reasoningTokens ?? 0) === 0
        ? [] : ["RECORD_REWRITE_THINKING_NOT_DISABLED"])
    ];
    parsed = contractIssues.length === 0
      ? parseGi088RecordCardRewriteOutput({
          source: input.source,
          material,
          content: response.content,
          finishReason: response.finishReason ?? null
        })
      : {
          accepted: false,
          issues: contractIssues,
          diagnostics: {
            question_context_leakage: [],
            qa_process_residue: [],
            long_source_copy: [],
            repeated_sentence_openings: [],
            insight_dump_markers: [],
            oral_repetition_markers: []
          },
          recordCard: null,
          paragraphs: []
        };
    input.rawResponses.push({
      call_fingerprint: callFingerprint,
      case_id: input.source.selection.caseId,
      candidate_id: id,
      attempt,
      sha256: rawSha,
      content: response.content
    });
    attempts.push({
      call_fingerprint: callFingerprint,
      stage: "record_card",
      attempt,
      outcome: "valid_response",
      error_code: null,
      retry_scheduled: false,
      latency_ms: response.latencyMs,
      token_usage: response.tokenUsage ?? null,
      finish_reason: response.finishReason ?? null,
      upstream_request_id: response.upstreamRequestId ?? null,
      provider: response.provider,
      response_model: response.responseModel ?? null,
      reasoning_present: response.reasoningPresent ?? null,
      reasoning_tokens: response.reasoningTokens ?? null,
      cost_cny: estimateGi088CalibrationCostCny({
        model: "deepseek-v4-flash",
        tokenUsage: response.tokenUsage ?? null
      }),
      raw_response_sha256: rawSha
    });
    await appendGi088ExtensionLedger(input.ledgerPath, {
      event: "call_completed",
      at: input.now().toISOString(),
      sequence,
      call_fingerprint: callFingerprint,
      raw_response_sha256: rawSha,
      quality_accepted: parsed.accepted,
      quality_issues: parsed.issues,
      writing_diagnostics: parsed.diagnostics
    });
    final = response;
    break;
  }
  const costs = attempts.flatMap((attempt) => attempt.cost_cny === null ? [] : [attempt.cost_cny]);
  const failures = final
    ? (parsed?.issues ?? []).map((code) => ({ code, severity: "P0" as const }))
    : [{ code: terminalCode, severity: "technical" as const }];
  return {
    case_id: input.source.selection.caseId,
    source_group_id: input.source.selection.sourceGroupId,
    source_file_sha256: input.source.sourceFileSha256,
    source_projection_sha256: input.source.sourceProjectionSha256,
    parent_candidate_id: input.baseline.candidate.candidate_id,
    baseline_record_card: input.baseline.candidate.record_card,
    baseline_record_card_sha256: sha256Canonical(input.baseline.candidate.record_card),
    writing_material_sha256: sha256Canonical(material),
    writing_material_counts: {
      user_evidence: material.userEvidence.length,
      content_evidence: material.userEvidence.filter((item) => item.usage === "content").length,
      valid_insights: material.validInsights.length,
      question_contexts: material.questionContext.length,
      required_sources: material.requiredSourceRefs.length
    },
    candidate: {
      candidate_id: id,
      record_card: parsed?.recordCard ?? null,
      paragraphs: parsed?.paragraphs ?? [],
      program_check: {
        admitted: Boolean(final && parsed?.accepted && parsed.recordCard),
        failures,
        diagnostics: parsed?.diagnostics ?? {
          question_context_leakage: [],
          qa_process_residue: [],
          long_source_copy: [],
          repeated_sentence_openings: [],
          insight_dump_markers: [],
          oral_repetition_markers: []
        }
      },
      trace: {
        prompt_hash: prompt.resolvedPromptHash,
        attempts,
        technical_retry_count: attempts.filter((item) => item.attempt === 2).length,
        quality_retry_count: 0,
        raw_response_sha256: [...attempts].reverse().find(
          (item) => item.raw_response_sha256
        )?.raw_response_sha256 ?? null,
        latency_ms: attempts.reduce((sum, item) => sum + item.latency_ms, 0),
        cost_cny: costs.length
          ? Number(costs.reduce((sum, item) => sum + item, 0).toFixed(8))
          : null
      }
    }
  } satisfies Gi088RecordCardRewriteCase;
}

export function createGi088RecordCardRewriteExecutionFingerprint(input: {
  scopeFingerprint: string;
  providerPreflight: Gi088RecordCardRewritePackage["provider_preflight"];
  actualCalls: number;
  cases: Gi088RecordCardRewriteCase[];
  rawResponses: Gi088RecordCardRewritePackage["raw_responses"];
}) {
  return sha256Canonical({
    scopeFingerprint: input.scopeFingerprint,
    providerPreflight: input.providerPreflight,
    actualCalls: input.actualCalls,
    cases: input.cases,
    rawResponses: input.rawResponses.map((item) => ({
      callFingerprint: item.call_fingerprint,
      sha256: item.sha256
    }))
  });
}

async function preflight(input: {
  apiKey: string;
  credential: Gi088CalibrationCredential["source"];
  now: Date;
}) {
  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${input.apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    fail("GI088_RECORD_REWRITE_MODEL_PREFLIGHT_UNREACHABLE");
  }
  if (!response.ok) fail(`GI088_RECORD_REWRITE_MODEL_PREFLIGHT_HTTP_${response.status}`);
  const body = await response.json() as { data?: Array<{ id?: string }> };
  const ids = (body.data ?? []).flatMap((item) => typeof item.id === "string" ? [item.id] : []);
  if (!ids.includes("deepseek-v4-flash")) fail("GI088_RECORD_REWRITE_FLASH_UNAVAILABLE");
  return {
    performed_at: input.now.toISOString(),
    required_model: "deepseek-v4-flash" as const,
    available_model_ids_sha256: sha256Canonical([...new Set(ids)].sort()),
    credential_source: input.credential
  };
}

function createScope(input: {
  sources: Gi088HumanExtensionSourceBundle;
  parent: LoadedGi088ExtensionRecordRound;
  code: Array<{ path: string; sha256: string }>;
}) {
  return {
    version: GI088_RECORD_CARD_REWRITE_VERSION,
    roundId: GI088_RECORD_CARD_REWRITE_ROUND_ID,
    parent: parentIdentity(input.parent),
    cases: input.sources.sources.map((source) => ({
      caseId: source.selection.caseId,
      sourceFileSha256: source.sourceFileSha256,
      sourceProjectionSha256: source.sourceProjectionSha256,
      writingMaterialSha256: sha256Canonical(buildGi088RecordCardWritingMaterial(source)),
      baselineRecordCardSha256: sha256Canonical(
        baselineCase(input.parent, source.selection.caseId).candidate.record_card
      )
    })),
    prompt: {
      version: GI088_RECORD_CARD_REWRITE_PROMPT_VERSION,
      systemPromptSha256: GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT_HASH,
      fewShotCount: 0
    },
    runtime: {
      model: "deepseek-v4-flash",
      ...GI088_HUMAN_EXTENSION_RUNTIME,
      providerAdapter: REAL_PROVIDER
    },
    budget: { nominal: NOMINAL_CALLS, maximum: MAX_CALLS },
    codeSnapshot: input.code
  };
}

export async function runGi088RecordCardRewrite(
  options: Gi088RecordCardRewriteOptions,
  env: NodeJS.ProcessEnv = process.env,
  projectRoot = process.cwd()
) {
  assertRuntime();
  if (options.maxCalls !== MAX_CALLS) fail("GI088_RECORD_REWRITE_MAX_CALLS_MUST_EQUAL_12");
  if (options.mode === "real" && (!options.confirmPrivateReplay
      || !options.maxCallsExplicit || !options.confirmScope)) {
    fail("GI088_RECORD_REWRITE_REAL_CONFIRMATION_INCOMPLETE");
  }
  const [sources, parent, code] = await Promise.all([
    loadGi088HumanExtensionSources(projectRoot),
    parentRound(projectRoot),
    codeSnapshot(projectRoot)
  ]);
  const scope = createScope({ sources, parent, code });
  const scopeFingerprint = sha256Canonical(scope);
  const plan = {
    mode: "dry-run" as const,
    round_id: GI088_RECORD_CARD_REWRITE_ROUND_ID,
    scope_fingerprint: scopeFingerprint,
    selected_cases: sources.sources.map((source) => source.selection.caseId),
    model: "deepseek-v4-flash",
    prompt_version: GI088_RECORD_CARD_REWRITE_PROMPT_VERSION,
    system_prompt_sha256: GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT_HASH,
    few_shot_count: 0,
    nominal_model_calls: NOMINAL_CALLS,
    max_model_calls: MAX_CALLS,
    model_calls_executed: 0,
    required_real_run_confirmation: {
      private_replay: true,
      scope_fingerprint: scopeFingerprint,
      max_calls: MAX_CALLS
    }
  };
  if (options.mode === "dry-run") return { plan, outputWritten: false as const };
  if (options.mode === "real" && options.confirmScope !== scopeFingerprint) {
    fail("GI088_RECORD_REWRITE_SCOPE_CONFIRMATION_MISMATCH");
  }
  if (options.mode === "real") {
    await assertNoPriorObservedRealRun(projectRoot, scopeFingerprint);
  }
  const now = () => new Date();
  const mode = options.mode;
  const provider = mode === "real"
    ? await (async () => {
        const credential = await resolveGi088CalibrationCredential(env);
        return {
          provider: createGi088OpenAICompatibleCalibrationProvider({ apiKey: credential.apiKey }),
          credential,
          providerPreflight: await preflight({
            apiKey: credential.apiKey,
            credential: credential.source,
            now: now()
          })
        };
      })()
    : {
        provider: mockProvider(),
        credential: null,
        providerPreflight: null
      };
  if ((mode === "real" && (provider.provider.kind !== "real" || provider.provider.name !== REAL_PROVIDER))
    || (mode === "mock" && provider.provider.kind !== "mock")) {
    fail("GI088_RECORD_REWRITE_PROVIDER_IDENTITY_INVALID");
  }
  const runId = options.runId ?? (mode === "real"
    ? `${GI088_RECORD_CARD_REWRITE_ROUND_ID}-${scopeFingerprint.slice(0, 8)}`
    : `${GI088_RECORD_CARD_REWRITE_ROUND_ID}-mock-${scopeFingerprint.slice(0, 8)}-${Date.now()}`);
  assertRunId(runId);
  const root = resolve(projectRoot, mode === "real" ? OUTPUT_ROOT : MOCK_ROOT);
  const directory = resolve(root, runId);
  assertContainedPath(root, directory);
  try {
    await stat(directory);
    fail("GI088_RECORD_REWRITE_OUTPUT_EXISTS");
  } catch (error) {
    if (error instanceof Gi088RecordCardRewriteError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const ledgerPath = resolve(directory, "attempt-ledger.ndjson");
  const lockPath = resolve(directory, "round-run.lock.json");
  await privateJsonAtomic(lockPath, {
    schema_version: "1.0",
    status: "reserved",
    mode,
    round_id: GI088_RECORD_CARD_REWRITE_ROUND_ID,
    scope_fingerprint: scopeFingerprint,
    observed_model_calls: 0,
    created_at: now().toISOString()
  });
  const actualCalls = { value: 0 };
  const rawResponses: Gi088RecordCardRewritePackage["raw_responses"] = [];
  try {
    const cases: Gi088RecordCardRewriteCase[] = [];
    for (const source of sources.sources) {
      cases.push(await runCase({
        provider: provider.provider,
        source,
        baseline: baselineCase(parent, source.selection.caseId),
        scopeFingerprint,
        actualCalls,
        ledgerPath,
        rawResponses,
        now,
        preCallGuard: async () => {
          assertRuntime();
          await assertEvidenceUnchanged({ projectRoot, sources, parent });
        }
      }));
    }
    const executionFingerprint = createGi088RecordCardRewriteExecutionFingerprint({
      scopeFingerprint,
      providerPreflight: provider.providerPreflight,
      actualCalls: actualCalls.value,
      cases,
      rawResponses
    });
    const resultPackage: Gi088RecordCardRewritePackage = {
      schema_version: "1.0",
      privacy_classification: "private_local_only",
      version: GI088_RECORD_CARD_REWRITE_VERSION,
      round_id: GI088_RECORD_CARD_REWRITE_ROUND_ID,
      mode,
      generated_at: now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      parent: parentIdentity(parent),
      prompt: {
        version: GI088_RECORD_CARD_REWRITE_PROMPT_VERSION,
        system_prompt_sha256: GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT_HASH,
        few_shot_count: 0
      },
      runtime: {
        model: "deepseek-v4-flash",
        provider: "openai_compatible_rest",
        base_url: "https://api.deepseek.com",
        thinking: "disabled",
        temperature: 0.2,
        response_format: "json_object",
        hard_timeout_ms: 60_000,
        max_technical_retries_per_case: 1,
        quality_retries: 0,
        provider_adapter: provider.provider.name
      },
      budget: { cases: 6, nominal_model_calls: 6, max_model_calls: 12 },
      run: {
        actual_model_calls: actualCalls.value,
        technical_retries: cases.flatMap((item) => item.candidate.trace.attempts)
          .filter((item) => item.attempt === 2).length,
        quality_retries: 0,
        admitted_cases: cases.filter((item) => item.candidate.program_check.admitted).length
      },
      provider_preflight: provider.providerPreflight,
      code_snapshot: code,
      cases,
      raw_responses: rawResponses
    };
    await privateJsonAtomic(resolve(directory, "round-package.json"), resultPackage);
    const packageSha256 = await sha256File(resolve(directory, "round-package.json"));
    const ledgerSha256 = await sha256File(ledgerPath);
    await privateJsonAtomic(lockPath, {
      schema_version: "1.0",
      status: "completed",
      mode,
      round_id: GI088_RECORD_CARD_REWRITE_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      observed_model_calls: actualCalls.value,
      completed_at: now().toISOString()
    });
    const lockSha256 = await sha256File(lockPath);
    await privateJsonAtomic(resolve(directory, "commit-manifest.json"), {
      schema_version: "1.0",
      status: "committed",
      mode,
      round_id: GI088_RECORD_CARD_REWRITE_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      artifacts: {
        "round-package.json": packageSha256,
        "attempt-ledger.ndjson": ledgerSha256,
        "round-run.lock.json": lockSha256
      },
      calls: { nominal: 6, maximum: 12, actual: actualCalls.value },
      committed_at: now().toISOString()
    });
    return { package: resultPackage, directory, scopeFingerprint };
  } catch (error) {
    await privateJsonAtomic(lockPath, {
      schema_version: "1.0",
      status: "failed",
      mode,
      round_id: GI088_RECORD_CARD_REWRITE_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      observed_model_calls: actualCalls.value,
      error_code: safeGi088RecordCardRewriteErrorCode(error),
      failed_at: now().toISOString()
    }).catch(() => undefined);
    throw error;
  }
}

function argValue(argv: string[], index: number, name: string) {
  const argument = argv[index];
  if (argument.startsWith(`${name}=`)) return { value: argument.slice(name.length + 1), consumed: 0 };
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail("GI088_RECORD_REWRITE_ARGUMENT_REQUIRED");
  return { value, consumed: 1 };
}

export function parseGi088RecordCardRewriteArgs(argv: string[]): Gi088RecordCardRewriteOptions {
  const options: Gi088RecordCardRewriteOptions = {
    mode: "dry-run",
    confirmPrivateReplay: false,
    confirmScope: null,
    maxCalls: MAX_CALLS,
    maxCallsExplicit: false,
    runId: null
  };
  let modeSeen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute-real" || argument === "--execute-mock") {
      if (modeSeen) fail("GI088_RECORD_REWRITE_MODE_DUPLICATE");
      modeSeen = true;
      options.mode = argument === "--execute-real" ? "real" : "mock";
    } else if (argument === "--confirm-private-replay") {
      options.confirmPrivateReplay = true;
    } else if (argument === "--confirm-scope" || argument.startsWith("--confirm-scope=")) {
      const parsed = argValue(argv, index, "--confirm-scope");
      options.confirmScope = parsed.value;
      index += parsed.consumed;
    } else if (argument === "--max-calls" || argument.startsWith("--max-calls=")) {
      const parsed = argValue(argv, index, "--max-calls");
      options.maxCalls = Number(parsed.value);
      options.maxCallsExplicit = true;
      index += parsed.consumed;
    } else if (argument === "--run-id" || argument.startsWith("--run-id=")) {
      const parsed = argValue(argv, index, "--run-id");
      options.runId = parsed.value;
      index += parsed.consumed;
    } else {
      fail(`GI088_RECORD_REWRITE_ARGUMENT_UNKNOWN:${argument}`);
    }
  }
  return options;
}

export function safeGi088RecordCardRewriteErrorCode(error: unknown) {
  return error instanceof Gi088RecordCardRewriteError
    ? error.code
    : safeGi088CalibrationErrorCode(error);
}

export async function mainGi088RecordCardRewriteCli() {
  const options = parseGi088RecordCardRewriteArgs(process.argv.slice(2));
  const result = await runGi088RecordCardRewrite(options);
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
    output_directory: relative(process.cwd(), result.directory)
  }, null, 2)}\n`);
}

export async function loadCommittedGi088RecordCardRewrite(
  directory: string,
  projectRoot = process.cwd(),
  allowMock = false
) {
  const privateRoot = resolve(projectRoot, PRIVATE_ROOT);
  const resolvedDirectory = resolve(directory);
  assertContainedPath(privateRoot, resolvedDirectory);
  const [actualPrivateRoot, actualDirectory] = await Promise.all([
    realpath(privateRoot),
    realpath(resolvedDirectory)
  ]);
  assertContainedPath(actualPrivateRoot, actualDirectory);
  const manifestPath = resolve(directory, "commit-manifest.json");
  const packagePath = resolve(directory, "round-package.json");
  const ledgerPath = resolve(directory, "attempt-ledger.ndjson");
  const lockPath = resolve(directory, "round-run.lock.json");
  const [manifestText, packageText, ledgerText, lockText] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(packagePath, "utf8"),
    readFile(ledgerPath, "utf8"),
    readFile(lockPath, "utf8")
  ]);
  const manifest = JSON.parse(manifestText) as Record<string, unknown>;
  const resultPackage = JSON.parse(packageText) as Gi088RecordCardRewritePackage;
  const lock = JSON.parse(lockText) as Record<string, unknown>;
  if (manifest.status !== "committed" || lock.status !== "completed"
    || resultPackage.round_id !== GI088_RECORD_CARD_REWRITE_ROUND_ID
    || (resultPackage.mode === "mock" && !allowMock)
    || resultPackage.cases.length !== 6
    || resultPackage.prompt.version !== GI088_RECORD_CARD_REWRITE_PROMPT_VERSION
    || resultPackage.prompt.system_prompt_sha256 !== GI088_RECORD_CARD_REWRITE_SYSTEM_PROMPT_HASH
    || resultPackage.prompt.few_shot_count !== 0
    || resultPackage.runtime.model !== "deepseek-v4-flash"
    || resultPackage.runtime.thinking !== "disabled"
    || resultPackage.runtime.temperature !== 0.2
    || resultPackage.runtime.quality_retries !== 0
    || resultPackage.runtime.max_technical_retries_per_case !== 1
    || resultPackage.budget.cases !== 6
    || resultPackage.budget.nominal_model_calls !== 6
    || resultPackage.budget.max_model_calls !== 12
    || (resultPackage.mode === "real" && (
      resultPackage.runtime.provider_adapter !== REAL_PROVIDER
      || !resultPackage.provider_preflight
      || resultPackage.provider_preflight.required_model !== "deepseek-v4-flash"
    ))) {
    fail("GI088_RECORD_REWRITE_COMMITTED_PACKAGE_INVALID");
  }
  const artifacts = manifest.artifacts as Record<string, string>;
  if (await sha256File(packagePath) !== artifacts["round-package.json"]
    || await sha256File(ledgerPath) !== artifacts["attempt-ledger.ndjson"]
    || await sha256File(lockPath) !== artifacts["round-run.lock.json"]
    || manifest.scope_fingerprint !== resultPackage.scope_fingerprint
    || manifest.execution_fingerprint !== resultPackage.execution_fingerprint
    || lock.execution_fingerprint !== resultPackage.execution_fingerprint
    || lock.scope_fingerprint !== resultPackage.scope_fingerprint
    || lock.observed_model_calls !== resultPackage.run.actual_model_calls) {
    fail("GI088_RECORD_REWRITE_COMMITTED_ARTIFACT_MISMATCH");
  }
  const [sources, parent, code] = await Promise.all([
    loadGi088HumanExtensionSources(projectRoot),
    parentRound(projectRoot),
    codeSnapshot(projectRoot)
  ]);
  const expectedScope = sha256Canonical(createScope({ sources, parent, code }));
  if (expectedScope !== resultPackage.scope_fingerprint
    || sha256Canonical(parentIdentity(parent)) !== sha256Canonical(resultPackage.parent)) {
    fail("GI088_RECORD_REWRITE_SCOPE_REPLAY_INVALID");
  }
  const ledger = ledgerText.trim().split("\n").filter(Boolean).map((line) =>
    JSON.parse(line) as Record<string, unknown>
  );
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
  const rawByFingerprint = new Map(resultPackage.raw_responses.map((item) => [item.call_fingerprint, item]));
  if (reserved.length !== resultPackage.run.actual_model_calls
    || terminal.length !== reserved.length
    || reservedByFingerprint.size !== reserved.length
    || terminalByFingerprint.size !== terminal.length
    || rawByFingerprint.size !== resultPackage.raw_responses.length) {
    fail("GI088_RECORD_REWRITE_CALL_LEDGER_INVALID");
  }
  const caseIds = new Set(resultPackage.cases.map((item) => item.case_id));
  if (caseIds.size !== 6 || sources.sources.some((source) => !caseIds.has(source.selection.caseId))) {
    fail("GI088_RECORD_REWRITE_CASE_SET_INVALID");
  }
  let retryCount = 0;
  for (const source of sources.sources) {
    const recordCase = resultPackage.cases.find((item) => item.case_id === source.selection.caseId);
    if (!recordCase) fail("GI088_RECORD_REWRITE_CASE_SET_INVALID");
    const material = buildGi088RecordCardWritingMaterial(source);
    const prompt = buildGi088RecordCardRewritePrompt(source, material);
    const expectedCandidateId = `record-rewrite-${sha256Canonical({
      scopeFingerprint: resultPackage.scope_fingerprint,
      caseId: source.selection.caseId
    }).slice(0, 20)}`;
    if (sha256Canonical(material) !== recordCase.writing_material_sha256
      || prompt.resolvedPromptHash !== recordCase.candidate.trace.prompt_hash
      || sha256Canonical(baselineCase(parent, source.selection.caseId).candidate.record_card)
        !== recordCase.baseline_record_card_sha256
      || sha256Canonical(recordCase.baseline_record_card)
        !== recordCase.baseline_record_card_sha256
      || recordCase.candidate.candidate_id !== expectedCandidateId) {
      fail("GI088_RECORD_REWRITE_CASE_BINDING_INVALID");
    }
    const attempts = recordCase.candidate.trace.attempts;
    if (attempts.length < 1 || attempts.length > 2
      || attempts[0].attempt !== 1
      || (attempts.length === 2 && (attempts[0].outcome !== "technical_failure"
        || attempts[0].retry_scheduled !== true
        || attempts[1].attempt !== 2))
      || attempts.at(-1)?.retry_scheduled !== false) {
      fail("GI088_RECORD_REWRITE_ATTEMPT_SEQUENCE_INVALID");
    }
    retryCount += attempts.filter((attempt) => attempt.attempt === 2).length;
    let finalAttempt: Gi088CalibrationAttemptTrace | null = null;
    let finalRaw: Gi088RecordCardRewritePackage["raw_responses"][number] | null = null;
    for (const attempt of attempts) {
      const expectedCallFingerprint = sha256Canonical({
        scopeFingerprint: resultPackage.scope_fingerprint,
        caseId: source.selection.caseId,
        candidateId: expectedCandidateId,
        attempt: attempt.attempt,
        promptHash: prompt.resolvedPromptHash,
        writingMaterialSha256: sha256Canonical(material)
      });
      const reserveEvent = reservedByFingerprint.get(attempt.call_fingerprint);
      const terminalEvent = terminalByFingerprint.get(attempt.call_fingerprint);
      const raw = rawByFingerprint.get(attempt.call_fingerprint);
      if (attempt.call_fingerprint !== expectedCallFingerprint
        || !reserveEvent || !terminalEvent
        || reserveEvent.case_id !== source.selection.caseId
        || reserveEvent.candidate_id !== expectedCandidateId
        || reserveEvent.stage !== "record_card"
        || reserveEvent.model !== "deepseek-v4-flash"
        || reserveEvent.provider_adapter !== resultPackage.runtime.provider_adapter
        || reserveEvent.attempt !== attempt.attempt) {
        fail("GI088_RECORD_REWRITE_CALL_BINDING_INVALID");
      }
      if (attempt.outcome === "valid_response") {
        if (!raw || terminalEvent.event !== "call_completed"
          || raw.case_id !== source.selection.caseId
          || raw.candidate_id !== expectedCandidateId
          || raw.attempt !== attempt.attempt
          || sha256Text(raw.content) !== raw.sha256
          || raw.sha256 !== attempt.raw_response_sha256
          || terminalEvent.raw_response_sha256 !== raw.sha256
          || attempt.response_model !== "deepseek-v4-flash"
          || attempt.reasoning_present !== false
          || (attempt.reasoning_tokens ?? 0) !== 0) {
          fail("GI088_RECORD_REWRITE_RAW_INVALID");
        }
        finalAttempt = attempt;
        finalRaw = raw;
      } else if (raw || terminalEvent.event !== "call_failed") {
        fail("GI088_RECORD_REWRITE_TECHNICAL_ATTEMPT_INVALID");
      }
    }
    if (finalRaw && finalAttempt) {
      const parsed = parseGi088RecordCardRewriteOutput({
        source,
        material,
        content: finalRaw.content,
        finishReason: finalAttempt.finish_reason
      });
      if (sha256Canonical(parsed.recordCard) !== sha256Canonical(recordCase.candidate.record_card)
        || sha256Canonical(parsed.paragraphs) !== sha256Canonical(recordCase.candidate.paragraphs)
        || parsed.accepted !== recordCase.candidate.program_check.admitted
        || sha256Canonical(parsed.issues) !== sha256Canonical(
          recordCase.candidate.program_check.failures.map((item) => item.code)
        )
        || sha256Canonical(parsed.diagnostics)
          !== sha256Canonical(recordCase.candidate.program_check.diagnostics)
        || recordCase.candidate.trace.raw_response_sha256 !== finalRaw.sha256) {
        fail("GI088_RECORD_REWRITE_RAW_PROJECTION_INVALID");
      }
    } else if (recordCase.candidate.record_card
      || recordCase.candidate.paragraphs.length > 0
      || recordCase.candidate.program_check.admitted
      || recordCase.candidate.trace.raw_response_sha256) {
      fail("GI088_RECORD_REWRITE_TECHNICAL_PROJECTION_INVALID");
    }
  }
  const expectedExecution = createGi088RecordCardRewriteExecutionFingerprint({
    scopeFingerprint: resultPackage.scope_fingerprint,
    providerPreflight: resultPackage.provider_preflight,
    actualCalls: resultPackage.run.actual_model_calls,
    cases: resultPackage.cases,
    rawResponses: resultPackage.raw_responses
  });
  const manifestCalls = manifest.calls as Record<string, unknown>;
  if (expectedExecution !== resultPackage.execution_fingerprint
    || resultPackage.run.actual_model_calls !== resultPackage.cases
      .flatMap((item) => item.candidate.trace.attempts).length
    || resultPackage.run.technical_retries !== retryCount
    || resultPackage.run.quality_retries !== 0
    || resultPackage.run.admitted_cases !== resultPackage.cases.filter(
      (item) => item.candidate.program_check.admitted
    ).length
    || manifestCalls.nominal !== 6
    || manifestCalls.maximum !== 12
    || manifestCalls.actual !== resultPackage.run.actual_model_calls) {
    fail("GI088_RECORD_REWRITE_EXECUTION_INVALID");
  }
  return { directory, package: resultPackage, manifest, lock, ledgerText, ledger, sources, parent };
}
