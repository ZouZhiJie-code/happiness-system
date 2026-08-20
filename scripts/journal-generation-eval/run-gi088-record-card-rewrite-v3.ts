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
  buildGi088RecordCardWritingMaterial,
  type Gi088RecordCardWritingMaterial
} from "./gi088-record-card-rewrite-contract";
import {
  buildGi088RecordCardRewriteV3Prompt,
  GI088_RECORD_CARD_REWRITE_V3_PROMPT_VERSION,
  GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
  GI088_RECORD_CARD_REWRITE_V3_SYSTEM_PROMPT_HASH,
  GI088_RECORD_CARD_REWRITE_V3_VERSION,
  parseGi088RecordCardRewriteV3Output,
  type Gi088RecordCardRewriteV3Diagnostics,
  type Gi088RecordCardV3MaterialUnit,
  type Gi088RecordCardV3Paragraph
} from "./gi088-record-card-rewrite-v3-contract";
import { sha256File } from "./private-export-importer";
import {
  resolveGi088CalibrationCredential,
  safeGi088CalibrationErrorCode,
  type Gi088CalibrationCredential
} from "./run-gi088-calibration";
import {
  type Gi088RecordCardRewritePackage
} from "./run-gi088-record-card-rewrite";
import { appendGi088ExtensionLedger } from "./run-gi088-human-extension-records";

const PRIVATE_ROOT = "artifacts/journal-generation-evaluation/.private" as const;
const OUTPUT_ROOT = `${PRIVATE_ROOT}/formal/record-card-rewrite-v3` as const;
const MOCK_ROOT = `${PRIVATE_ROOT}/record-card-rewrite-v3-mock` as const;
export const GI088_RECORD_CARD_REWRITE_V3_PARENT_DIRECTORY =
  `${PRIVATE_ROOT}/formal/record-card-rewrite-v2/gi088-record-card-rewrite-v2-f8b036c5` as const;
const NOMINAL_CALLS = 6 as const;
const MAX_CALLS = 12 as const;
const REAL_PROVIDER = "deepseek_official_openai_compatible" as const;

export const GI088_RECORD_CARD_REWRITE_V3_PARENT_HASHES = {
  package: "4f6a55dec3c1aad9e102125e769d06548ee3fb4708520dad48c818fe86085b82",
  manifest: "945d9789d603b0f6d4fadd4c0cba39c86c23c30a77a55b371ff8b8cc4822beb2",
  ledger: "f1c791f808970b2ba19e7e064929b5c3c977fa9ab9a58d4c1e0b5c6b1df17855",
  lock: "3dc7c7cb718d265cc1a78733f3d1ee56601bcaf498ab66b6869159d2b90612f3",
  reviews: "b65c1df44b7b346da59f527ad73304fe9e7c365d82536c4aeb6c2c5f6cdd4872",
  drafts: "44d0c1ba4d1a0ffb6d0f80818ed2e34e480f9552d1f40c4d69721646816c15eb"
} as const;

const IMPLEMENTATION_FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vitest.config.ts",
  "scripts/journal-generation-eval/gi088-calibration-contract.ts",
  "scripts/journal-generation-eval/gi088-calibration-provider.ts",
  "scripts/journal-generation-eval/gi088-human-extension-contract.ts",
  "scripts/journal-generation-eval/gi088-human-extension-source.ts",
  "scripts/journal-generation-eval/gi088-record-card-rewrite-contract.ts",
  "scripts/journal-generation-eval/gi088-record-card-rewrite-v3-contract.ts",
  "scripts/journal-generation-eval/run-gi088-record-card-rewrite.ts",
  "scripts/journal-generation-eval/run-gi088-record-card-rewrite-v3.ts",
  "scripts/journal-generation-eval/run-gi088-record-card-rewrite-v3-cli.ts",
  "src/features/ai-quality/prompt-manifest.ts",
  "src/server/services/ai/ai-provider.ts",
  "src/server/services/ai/openai.provider.ts"
] as const;

export interface Gi088RecordCardRewriteV3ProgramFailure {
  code: string;
  severity: "P0" | "technical";
}

export interface Gi088RecordCardRewriteV3Case {
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
    material_units: Gi088RecordCardV3MaterialUnit[];
    record_card: Gi088CalibrationRecordCard | null;
    paragraphs: Gi088RecordCardV3Paragraph[];
    program_check: {
      admitted: boolean;
      failures: Gi088RecordCardRewriteV3ProgramFailure[];
      diagnostics: Gi088RecordCardRewriteV3Diagnostics;
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

export interface Gi088RecordCardRewriteV3Package {
  schema_version: "2.0";
  privacy_classification: "private_local_only";
  version: typeof GI088_RECORD_CARD_REWRITE_V3_VERSION;
  round_id: typeof GI088_RECORD_CARD_REWRITE_V3_ROUND_ID;
  stage: "remediation_six";
  mode: "mock" | "real";
  generated_at: string;
  scope_fingerprint: string;
  execution_fingerprint: string;
  parent: {
    round_id: string;
    execution_fingerprint: string;
    scope_fingerprint: string;
    artifacts: { [K in keyof typeof GI088_RECORD_CARD_REWRITE_V3_PARENT_HASHES]: string };
  };
  prompt: {
    version: typeof GI088_RECORD_CARD_REWRITE_V3_PROMPT_VERSION;
    system_prompt_sha256: typeof GI088_RECORD_CARD_REWRITE_V3_SYSTEM_PROMPT_HASH;
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
  cases: Gi088RecordCardRewriteV3Case[];
  raw_responses: Array<{
    call_fingerprint: string;
    case_id: string;
    candidate_id: string;
    attempt: 1 | 2;
    sha256: string;
    content: string;
  }>;
}

export interface Gi088RecordCardRewriteV3Options {
  mode: "dry-run" | "mock" | "real";
  confirmPrivateReplay: boolean;
  confirmScope: string | null;
  confirmParentExecution: string | null;
  maxCalls: number;
  maxCallsExplicit: boolean;
  runId: string | null;
}

export class Gi088RecordCardRewriteV3Error extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Gi088RecordCardRewriteV3Error";
  }
}

function fail(code: string): never {
  throw new Gi088RecordCardRewriteV3Error(code);
}

function assertRunId(runId: string) {
  if (!/^[a-z0-9][a-z0-9-]{3,120}$/u.test(runId)) {
    fail("GI088_RECORD_REWRITE_V3_RUN_ID_INVALID");
  }
}

function assertContainedPath(root: string, target: string) {
  const child = relative(root, target);
  if (child === "" || child === ".." || child.startsWith(`..${sep}`) || child.startsWith(sep)) {
    fail("GI088_RECORD_REWRITE_V3_PATH_OUTSIDE_PRIVATE_ROOT");
  }
}

function assertRuntime() {
  if (sha256Canonical(GI088_HUMAN_EXTENSION_RUNTIME)
      !== sha256Canonical(GI088_JOURNAL_CALIBRATION_RUNTIME)
    || GI088_JOURNAL_CALIBRATION_RUNTIME.temperature !== 0.2
    || GI088_JOURNAL_CALIBRATION_RUNTIME.thinking !== "disabled"
    || GI088_JOURNAL_CALIBRATION_RUNTIME.responseFormat !== "json_object"
    || GI088_JOURNAL_CALIBRATION_RUNTIME.hardTimeoutMs !== 60_000
    || GI088_JOURNAL_CALIBRATION_RUNTIME.maxTechnicalRetriesPerStage !== 1
    || GI088_JOURNAL_CALIBRATION_RUNTIME.qualityRetries !== 0) {
    fail("GI088_RECORD_REWRITE_V3_RUNTIME_MISMATCH");
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

export async function createGi088RecordCardRewriteV3CodeSnapshot(projectRoot: string) {
  return codeSnapshot(projectRoot);
}

async function parentArtifacts(projectRoot: string) {
  const directory = resolve(projectRoot, GI088_RECORD_CARD_REWRITE_V3_PARENT_DIRECTORY);
  const paths = {
    package: resolve(directory, "round-package.json"),
    manifest: resolve(directory, "commit-manifest.json"),
    ledger: resolve(directory, "attempt-ledger.ndjson"),
    lock: resolve(directory, "round-run.lock.json"),
    reviews: resolve(directory, "record-rewrite-v2-reviews.ndjson"),
    drafts: resolve(directory, "record-rewrite-v2-review-drafts.ndjson")
  };
  const actual = {
    package: await sha256File(paths.package),
    manifest: await sha256File(paths.manifest),
    ledger: await sha256File(paths.ledger),
    lock: await sha256File(paths.lock),
    reviews: await sha256File(paths.reviews),
    drafts: await sha256File(paths.drafts)
  };
  if (sha256Canonical(actual) !== sha256Canonical(GI088_RECORD_CARD_REWRITE_V3_PARENT_HASHES)) {
    fail("GI088_RECORD_REWRITE_V3_PARENT_HASH_MISMATCH");
  }
  const loadedPackage = JSON.parse(await readFile(paths.package, "utf8")) as Gi088RecordCardRewritePackage;
  const loadedManifest = JSON.parse(await readFile(paths.manifest, "utf8")) as Record<string, unknown>;
  const loadedLock = JSON.parse(await readFile(paths.lock, "utf8")) as Record<string, unknown>;
  if (loadedPackage.mode !== "real"
    || String(loadedPackage.round_id) !== "gi088-record-card-rewrite-v2"
    || loadedPackage.run.actual_model_calls !== 6
    || loadedManifest.status !== "committed"
    || loadedLock.status !== "completed"
    || loadedManifest.execution_fingerprint !== loadedPackage.execution_fingerprint
    || loadedLock.execution_fingerprint !== loadedPackage.execution_fingerprint) {
    fail("GI088_RECORD_REWRITE_V3_PARENT_COMMIT_INVALID");
  }
  if (loadedPackage.execution_fingerprint
      !== "cc726491b3452eb2bcded191d1a1f4eacc46758915970d2cf77ddce16395c674"
    || loadedPackage.scope_fingerprint
      !== "f8b036c572d9eed6dac43f01fa5102ff49e0cf1a68a3f91071e259ed9c5ed0b1") {
    fail("GI088_RECORD_REWRITE_V3_PARENT_IDENTITY_MISMATCH");
  }
  return { directory, loaded: { package: loadedPackage }, hashes: actual };
}

function finalRawForCase(parent: Gi088RecordCardRewritePackage, candidateId: string) {
  const matching = parent.raw_responses.filter((item) => item.candidate_id === candidateId);
  return matching.at(-1) ?? null;
}

function baselineCard(input: {
  parent: Gi088RecordCardRewritePackage;
  caseId: string;
  source: Gi088HumanExtensionSourceBundle["sources"][number];
}) {
  const matches = input.parent.cases.filter((item) => item.case_id === input.caseId);
  if (matches.length !== 1) fail(`GI088_RECORD_REWRITE_V3_BASELINE_CASE_INVALID:${input.caseId}`);
  const candidate = matches[0].candidate;
  if (candidate.record_card) {
    return { card: candidate.record_card, candidateId: candidate.candidate_id };
  }
  const raw = finalRawForCase(input.parent, candidate.candidate_id);
  if (!raw || sha256Text(raw.content) !== raw.sha256) {
    fail(`GI088_RECORD_REWRITE_V3_BASELINE_RAW_MISSING:${input.caseId}`);
  }
  let parsed: {
    title?: { text?: unknown; sourceRefs?: unknown };
    paragraphs?: Array<{ text?: unknown; sourceRefs?: unknown }>;
    card?: {
      title?: { text?: unknown; usedUnitIds?: unknown };
      paragraphs?: Array<{ text?: unknown; usedUnitIds?: unknown }>;
    };
    materialUnits?: Array<{
      unitId?: unknown;
      evidenceSpans?: Array<{ sourceRef?: unknown }>;
      validInsightRefs?: unknown;
    }>;
  };
  try {
    parsed = JSON.parse(raw.content) as typeof parsed;
  } catch {
    fail(`GI088_RECORD_REWRITE_V3_BASELINE_RAW_INVALID:${input.caseId}`);
  }
  const structuredCard = parsed.card && Array.isArray(parsed.card.paragraphs)
    ? parsed.card
    : null;
  const sourceByUnit = new Map((parsed.materialUnits ?? []).flatMap((unit) => {
    const id = typeof unit.unitId === "string" ? unit.unitId : null;
    if (!id) return [];
    return [[id, [
      ...(unit.evidenceSpans ?? []).flatMap((span) => typeof span.sourceRef === "string" ? [span.sourceRef] : []),
      ...(Array.isArray(unit.validInsightRefs)
        ? unit.validInsightRefs.filter((ref): ref is string => typeof ref === "string")
        : [])
    ]] as const];
  }));
  const title = structuredCard?.title && typeof structuredCard.title.text === "string"
    ? { text: structuredCard.title.text, sourceRefs: (structuredCard.title.usedUnitIds as unknown[] ?? [])
      .flatMap((id) => typeof id === "string" ? sourceByUnit.get(id) ?? [] : []) }
    : parsed.title?.text && Array.isArray(parsed.title.sourceRefs)
      ? { text: parsed.title.text, sourceRefs: parsed.title.sourceRefs.map(String) }
      : null;
  const paragraphs = structuredCard
    ? structuredCard.paragraphs!.map((item) => ({
        text: item.text,
        sourceRefs: (item.usedUnitIds as unknown[] ?? []).flatMap((id) =>
          typeof id === "string" ? sourceByUnit.get(id) ?? [] : [])
      }))
    : parsed.paragraphs;
  if (!title || !Array.isArray(paragraphs) || paragraphs.length === 0
    || paragraphs.some((item) => typeof item.text !== "string" || !Array.isArray(item.sourceRefs))) {
    fail(`GI088_RECORD_REWRITE_V3_BASELINE_PROJECTION_INVALID:${input.caseId}`);
  }
  const card: Gi088CalibrationRecordCard = {
    record_card_id: `record-rewrite-v1-review-${sha256Canonical({
      caseId: input.caseId,
      rawSha256: raw.sha256
    }).slice(0, 20)}`,
    event_id: input.source.snapshot.eventId,
    title: String(title.text).trim(),
    text: paragraphs.map((item) => String(item.text).trim()).join("\n\n"),
    insight: "",
    source_refs: [...new Set([
      ...title.sourceRefs.map(String),
      ...paragraphs.flatMap((item) => (item.sourceRefs as unknown[]).map(String))
    ])]
  };
  return { card, candidateId: candidate.candidate_id };
}

async function assertEvidenceUnchanged(input: {
  projectRoot: string;
  sources: Gi088HumanExtensionSourceBundle;
}) {
  await assertGi088HumanExtensionSourcesUnchanged(input.sources, input.projectRoot);
  await parentArtifacts(input.projectRoot);
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
      && lock.round_id === GI088_RECORD_CARD_REWRITE_V3_ROUND_ID
      && lock.scope_fingerprint === scopeFingerprint
      && (lock.status === "completed" || Number(lock.observed_model_calls ?? 0) > 0)) {
      fail("GI088_RECORD_REWRITE_V3_PRIOR_REAL_RUN_EXISTS");
    }
  }
}

function mockProvider() {
  return createGi088MockCalibrationProvider((request) => {
    const payload = JSON.parse(request.messages.at(-1)?.content ?? "{}") as {
      userEvidence?: Array<{ sourceRef: string; text: string; usage: string }>;
      validInsights?: Array<{ sourceRef: string; text: string }>;
    };
    const contentEvidence = (payload.userEvidence ?? []).filter((item) => item.usage === "content");
    const insights = payload.validInsights ?? [];
    const units = contentEvidence.map((item, index) => ({
      unitId: `M${index + 1}`,
      coreMeaning: `材料 ${index + 1}`,
      evidenceSpans: [{ sourceRef: item.sourceRef, quote: item.text }],
      validInsightRefs: index === 0 ? insights.map((insight) => insight.sourceRef) : [],
      excludedInteractionSpans: []
    }));
    return {
      content: JSON.stringify({
        materialUnits: units,
        card: {
          title: {
            text: [...(contentEvidence[0]?.text ?? "今天的记录")].slice(0, 12).join(""),
            usedUnitIds: [units[0]?.unitId ?? "M1"]
          },
          paragraphs: [{
            text: contentEvidence.map((item) => item.text).join("。"),
            usedUnitIds: units.map((unit) => unit.unitId)
          }]
        }
      }),
      latencyMs: 8,
      provider: "mock",
      finishReason: "stop",
      tokenUsage: {
        promptTokens: 260,
        completionTokens: 130,
        totalTokens: 390,
        promptCacheHitTokens: 40,
        promptCacheMissTokens: 220
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

function emptyDiagnostics(): Gi088RecordCardRewriteV3Diagnostics {
  return {
    question_context_leakage: [],
    qa_process_residue: [],
    long_source_copy: [],
    repeated_sentence_openings: [],
    insight_dump_markers: [],
    oral_repetition_markers: [],
    possible_unit_repetition: [],
    title_too_long: [],
    unmapped_content_sources: []
  };
}

async function runCase(input: {
  provider: Gi088CalibrationProvider;
  source: Gi088HumanExtensionSourceBundle["sources"][number];
  baseline: { card: Gi088CalibrationRecordCard; candidateId: string };
  scopeFingerprint: string;
  actualCalls: { value: number };
  ledgerPath: string;
  rawResponses: Gi088RecordCardRewriteV3Package["raw_responses"];
  now: () => Date;
  preCallGuard: () => Promise<void>;
}) {
  const material = buildGi088RecordCardWritingMaterial(input.source);
  const prompt = buildGi088RecordCardRewriteV3Prompt(input.source, material);
  const id = `record-rewrite-v3-${sha256Canonical({
    scopeFingerprint: input.scopeFingerprint,
    caseId: input.source.selection.caseId
  }).slice(0, 20)}`;
  const attempts: Gi088CalibrationAttemptTrace[] = [];
  let final: Gi088CalibrationProviderResult | null = null;
  let parsed: ReturnType<typeof parseGi088RecordCardRewriteV3Output> | null = null;
  let terminalCode = "RECORD_REWRITE_V3_TECHNICAL_FAILURE";
  for (const attempt of [1, 2] as const) {
    if (input.actualCalls.value >= MAX_CALLS) fail("GI088_RECORD_REWRITE_V3_CALL_BUDGET_EXCEEDED");
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
      ...(response.responseModel === "deepseek-v4-flash" ? [] : ["RECORD_REWRITE_V3_MODEL_MISMATCH"]),
      ...(response.reasoningPresent === false && (response.reasoningTokens ?? 0) === 0
        ? [] : ["RECORD_REWRITE_V3_THINKING_NOT_DISABLED"])
    ];
    parsed = contractIssues.length === 0
      ? parseGi088RecordCardRewriteV3Output({
          source: input.source,
          material,
          content: response.content,
          finishReason: response.finishReason ?? null
        })
      : {
          accepted: false,
          issues: contractIssues,
          diagnostics: emptyDiagnostics(),
          materialUnits: [],
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
    parent_candidate_id: input.baseline.candidateId,
    baseline_record_card: input.baseline.card,
    baseline_record_card_sha256: sha256Canonical(input.baseline.card),
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
      material_units: parsed?.materialUnits ?? [],
      record_card: parsed?.recordCard ?? null,
      paragraphs: parsed?.paragraphs ?? [],
      program_check: {
        admitted: Boolean(final && parsed?.accepted && parsed.recordCard),
        failures,
        diagnostics: parsed?.diagnostics ?? emptyDiagnostics()
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
  } satisfies Gi088RecordCardRewriteV3Case;
}

export function createGi088RecordCardRewriteV3ExecutionFingerprint(input: {
  scopeFingerprint: string;
  providerPreflight: Gi088RecordCardRewriteV3Package["provider_preflight"];
  actualCalls: number;
  cases: Gi088RecordCardRewriteV3Case[];
  rawResponses: Gi088RecordCardRewriteV3Package["raw_responses"];
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

async function providerPreflight(input: {
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
    fail("GI088_RECORD_REWRITE_V3_MODEL_PREFLIGHT_UNREACHABLE");
  }
  if (!response.ok) fail(`GI088_RECORD_REWRITE_V3_MODEL_PREFLIGHT_HTTP_${response.status}`);
  const body = await response.json() as { data?: Array<{ id?: string }> };
  const ids = (body.data ?? []).flatMap((item) => typeof item.id === "string" ? [item.id] : []);
  if (!ids.includes("deepseek-v4-flash")) fail("GI088_RECORD_REWRITE_V3_FLASH_UNAVAILABLE");
  return {
    performed_at: input.now.toISOString(),
    required_model: "deepseek-v4-flash" as const,
    available_model_ids_sha256: sha256Canonical([...new Set(ids)].sort()),
    credential_source: input.credential
  };
}

function createScope(input: {
  sources: Gi088HumanExtensionSourceBundle;
  parent: Awaited<ReturnType<typeof parentArtifacts>>;
  snapshot: Array<{ path: string; sha256: string }>;
}) {
  return sha256Canonical({
    version: GI088_RECORD_CARD_REWRITE_V3_VERSION,
    roundId: GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
    stage: "remediation_six",
    sources: input.sources.sources.map((source) => ({
      caseId: source.selection.caseId,
      sourceGroupId: source.selection.sourceGroupId,
      sourceFileSha256: source.sourceFileSha256,
      sourceProjectionSha256: source.sourceProjectionSha256,
      writingMaterialSha256: sha256Canonical(buildGi088RecordCardWritingMaterial(source))
    })),
    parent: {
      executionFingerprint: input.parent.loaded.package.execution_fingerprint,
      scopeFingerprint: input.parent.loaded.package.scope_fingerprint,
      hashes: input.parent.hashes
    },
    prompt: {
      version: GI088_RECORD_CARD_REWRITE_V3_PROMPT_VERSION,
      systemPromptSha256: GI088_RECORD_CARD_REWRITE_V3_SYSTEM_PROMPT_HASH,
      fewShotCount: 0
    },
    runtime: GI088_JOURNAL_CALIBRATION_RUNTIME,
    budget: { cases: 6, nominalCalls: NOMINAL_CALLS, maxCalls: MAX_CALLS },
    implementation: input.snapshot
  });
}

export function createGi088RecordCardRewriteV3Scope(input: Parameters<typeof createScope>[0]) {
  return createScope(input);
}

export async function runGi088RecordCardRewriteV3(
  options: Gi088RecordCardRewriteV3Options,
  dependencies: {
    projectRoot?: string;
    provider?: Gi088CalibrationProvider;
    now?: () => Date;
  } = {}
) {
  const projectRoot = resolve(dependencies.projectRoot ?? process.cwd());
  const now = dependencies.now ?? (() => new Date());
  assertRuntime();
  if (options.maxCalls !== MAX_CALLS || (options.mode === "real" && !options.maxCallsExplicit)) {
    fail("GI088_RECORD_REWRITE_V3_MAX_CALLS_INVALID");
  }
  const [sources, parent, snapshot] = await Promise.all([
    loadGi088HumanExtensionSources(projectRoot),
    parentArtifacts(projectRoot),
    codeSnapshot(projectRoot)
  ]);
  if (sources.sources.length !== 6) fail("GI088_RECORD_REWRITE_V3_SOURCE_COUNT_INVALID");
  const scopeFingerprint = createScope({ sources, parent, snapshot });
  const parentExecution = parent.loaded.package.execution_fingerprint;
  if (options.mode === "dry-run") {
    return {
      plan: {
        scope_fingerprint: scopeFingerprint,
        parent_execution_fingerprint: parentExecution,
        selected_cases: sources.sources.map((source) => source.selection.caseId),
        model_calls_executed: 0,
        nominal_model_calls: NOMINAL_CALLS,
        max_model_calls: MAX_CALLS
      },
      directory: null,
      package: null
    };
  }
  if (options.mode === "real") {
    if (!options.confirmPrivateReplay
      || options.confirmScope !== scopeFingerprint
      || options.confirmParentExecution !== parentExecution) {
      fail("GI088_RECORD_REWRITE_V3_REAL_CONFIRMATION_INVALID");
    }
    await assertNoPriorObservedRealRun(projectRoot, scopeFingerprint);
  }
  const credential = options.mode === "real"
    ? await resolveGi088CalibrationCredential()
    : null;
  const provider = dependencies.provider ?? (options.mode === "mock"
    ? mockProvider()
    : createGi088OpenAICompatibleCalibrationProvider({
        apiKey: credential?.apiKey ?? fail("GI088_RECORD_REWRITE_V3_CREDENTIAL_MISSING")
      }));
  if ((options.mode === "real" && (provider.kind !== "real" || provider.name !== REAL_PROVIDER))
    || (options.mode === "mock" && provider.kind !== "mock")) {
    fail("GI088_RECORD_REWRITE_V3_PROVIDER_INVALID");
  }
  const root = resolve(projectRoot, options.mode === "real" ? OUTPUT_ROOT : MOCK_ROOT);
  const privateRoot = await realpath(resolve(projectRoot, PRIVATE_ROOT));
  await mkdir(root, { recursive: true, mode: 0o700 });
  const realRoot = await realpath(root);
  assertContainedPath(privateRoot, realRoot);
  const runId = options.runId ?? `${GI088_RECORD_CARD_REWRITE_V3_ROUND_ID}-${scopeFingerprint.slice(0, 8)}`;
  assertRunId(runId);
  const directory = resolve(realRoot, runId);
  assertContainedPath(realRoot, directory);
  await mkdir(directory, { recursive: false, mode: 0o700 });
  await chmod(directory, 0o700);
  const ledgerPath = resolve(directory, "attempt-ledger.ndjson");
  await privateWrite(ledgerPath, "");
  const lockPath = resolve(directory, "round-run.lock.json");
  await privateJsonAtomic(lockPath, {
    schema_version: "2.0",
    status: "running",
    mode: options.mode,
    round_id: GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
    scope_fingerprint: scopeFingerprint,
    parent_execution_fingerprint: parentExecution,
    observed_model_calls: 0,
    started_at: now().toISOString()
  });
  const actualCalls = { value: 0 };
  try {
    await assertEvidenceUnchanged({ projectRoot, sources });
    const preflightResult = credential
      ? await providerPreflight({ apiKey: credential.apiKey, credential: credential.source, now: now() })
      : null;
    const rawResponses: Gi088RecordCardRewriteV3Package["raw_responses"] = [];
    const cases: Gi088RecordCardRewriteV3Case[] = [];
    for (const source of sources.sources) {
      const baseline = baselineCard({
        parent: parent.loaded.package,
        caseId: source.selection.caseId,
        source
      });
      cases.push(await runCase({
        provider,
        source,
        baseline,
        scopeFingerprint,
        actualCalls,
        ledgerPath,
        rawResponses,
        now,
        preCallGuard: async () => {
          await assertEvidenceUnchanged({ projectRoot, sources });
          await privateJsonAtomic(lockPath, {
            schema_version: "2.0",
            status: "running",
            mode: options.mode,
            round_id: GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
            scope_fingerprint: scopeFingerprint,
            parent_execution_fingerprint: parentExecution,
            observed_model_calls: actualCalls.value,
            updated_at: now().toISOString()
          });
        }
      }));
    }
    const executionFingerprint = createGi088RecordCardRewriteV3ExecutionFingerprint({
      scopeFingerprint,
      providerPreflight: preflightResult,
      actualCalls: actualCalls.value,
      cases,
      rawResponses
    });
    const resultPackage: Gi088RecordCardRewriteV3Package = {
      schema_version: "2.0",
      privacy_classification: "private_local_only",
      version: GI088_RECORD_CARD_REWRITE_V3_VERSION,
      round_id: GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
      stage: "remediation_six",
      mode: options.mode,
      generated_at: now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      parent: {
        round_id: parent.loaded.package.round_id,
        execution_fingerprint: parentExecution,
        scope_fingerprint: parent.loaded.package.scope_fingerprint,
        artifacts: parent.hashes
      },
      prompt: {
        version: GI088_RECORD_CARD_REWRITE_V3_PROMPT_VERSION,
        system_prompt_sha256: GI088_RECORD_CARD_REWRITE_V3_SYSTEM_PROMPT_HASH,
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
        provider_adapter: provider.name
      },
      budget: {
        cases: 6,
        nominal_model_calls: NOMINAL_CALLS,
        max_model_calls: MAX_CALLS
      },
      run: {
        actual_model_calls: actualCalls.value,
        technical_retries: cases.reduce(
          (sum, item) => sum + item.candidate.trace.technical_retry_count, 0
        ),
        quality_retries: 0,
        admitted_cases: cases.filter((item) => item.candidate.program_check.admitted).length
      },
      provider_preflight: preflightResult,
      code_snapshot: snapshot,
      cases,
      raw_responses: rawResponses
    };
    const packagePath = resolve(directory, "round-package.json");
    await privateJsonAtomic(packagePath, resultPackage);
    await privateJsonAtomic(lockPath, {
      schema_version: "2.0",
      status: "completed",
      mode: options.mode,
      round_id: GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      parent_execution_fingerprint: parentExecution,
      observed_model_calls: actualCalls.value,
      completed_at: now().toISOString()
    });
    const manifest = {
      schema_version: "2.0",
      status: "committed",
      mode: options.mode,
      round_id: GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      parent_execution_fingerprint: parentExecution,
      artifacts: {
        "round-package.json": await sha256File(packagePath),
        "attempt-ledger.ndjson": await sha256File(ledgerPath),
        "round-run.lock.json": await sha256File(lockPath)
      },
      calls: {
        nominal: NOMINAL_CALLS,
        maximum: MAX_CALLS,
        actual: actualCalls.value
      },
      committed_at: now().toISOString()
    };
    await privateJsonAtomic(resolve(directory, "commit-manifest.json"), manifest);
    await loadCommittedGi088RecordCardRewriteV3(directory, projectRoot, true);
    return { plan: null, directory, package: resultPackage };
  } catch (error) {
    await privateJsonAtomic(lockPath, {
      schema_version: "2.0",
      status: "failed",
      mode: options.mode,
      round_id: GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      parent_execution_fingerprint: parentExecution,
      observed_model_calls: actualCalls.value,
      error_code: safeGi088RecordCardRewriteV3ErrorCode(error),
      failed_at: now().toISOString()
    });
    throw error;
  }
}

export function parseGi088RecordCardRewriteV3Args(argv: string[]): Gi088RecordCardRewriteV3Options {
  const real = argv.includes("--execute-real");
  const mock = argv.includes("--execute-mock");
  if (real && mock) fail("GI088_RECORD_REWRITE_V3_MODE_CONFLICT");
  const maxArg = argv.find((item) => item.startsWith("--max-calls="));
  const scopeArg = argv.find((item) => item.startsWith("--confirm-scope="));
  const parentArg = argv.find((item) => item.startsWith("--confirm-parent-execution="));
  const runIdArg = argv.find((item) => item.startsWith("--run-id="));
  return {
    mode: real ? "real" : mock ? "mock" : "dry-run",
    confirmPrivateReplay: argv.includes("--confirm-private-replay"),
    confirmScope: scopeArg?.slice("--confirm-scope=".length) || null,
    confirmParentExecution: parentArg?.slice("--confirm-parent-execution=".length) || null,
    maxCalls: maxArg ? Number(maxArg.slice("--max-calls=".length)) : MAX_CALLS,
    maxCallsExplicit: Boolean(maxArg),
    runId: runIdArg?.slice("--run-id=".length) || null
  };
}

export function safeGi088RecordCardRewriteV3ErrorCode(error: unknown) {
  return error instanceof Gi088RecordCardRewriteV3Error
    ? error.code
    : safeGi088CalibrationErrorCode(error);
}

export async function mainGi088RecordCardRewriteV3Cli() {
  const result = await runGi088RecordCardRewriteV3(
    parseGi088RecordCardRewriteV3Args(process.argv.slice(2))
  );
  process.stdout.write(`${JSON.stringify(result.plan ?? {
    output_directory: result.directory,
    scope_fingerprint: result.package?.scope_fingerprint,
    execution_fingerprint: result.package?.execution_fingerprint,
    parent_execution_fingerprint: result.package?.parent.execution_fingerprint,
    actual_model_calls: result.package?.run.actual_model_calls,
    technical_retries: result.package?.run.technical_retries,
    quality_retries: result.package?.run.quality_retries,
    admitted_cases: result.package?.run.admitted_cases
  }, null, 2)}\n`);
}

export async function loadCommittedGi088RecordCardRewriteV3(
  directory: string,
  projectRoot = process.cwd(),
  allowMock = false,
  allowHistoricalSnapshot = false
) {
  const root = await realpath(resolve(projectRoot, PRIVATE_ROOT));
  const target = await realpath(resolve(directory));
  assertContainedPath(root, target);
  const [packageText, manifestText, lockText, ledgerText] = await Promise.all([
    readFile(resolve(target, "round-package.json"), "utf8"),
    readFile(resolve(target, "commit-manifest.json"), "utf8"),
    readFile(resolve(target, "round-run.lock.json"), "utf8"),
    readFile(resolve(target, "attempt-ledger.ndjson"), "utf8")
  ]);
  const resultPackage = JSON.parse(packageText) as Gi088RecordCardRewriteV3Package;
  const manifest = JSON.parse(manifestText) as Record<string, unknown>;
  const lock = JSON.parse(lockText) as Record<string, unknown>;
  if (resultPackage.schema_version !== "2.0"
    || resultPackage.version !== GI088_RECORD_CARD_REWRITE_V3_VERSION
    || resultPackage.round_id !== GI088_RECORD_CARD_REWRITE_V3_ROUND_ID
    || resultPackage.stage !== "remediation_six"
    || resultPackage.prompt.version !== GI088_RECORD_CARD_REWRITE_V3_PROMPT_VERSION
    || resultPackage.prompt.system_prompt_sha256 !== GI088_RECORD_CARD_REWRITE_V3_SYSTEM_PROMPT_HASH
    || resultPackage.prompt.few_shot_count !== 0
    || (!allowMock && resultPackage.mode !== "real")
    || manifest.status !== "committed"
    || lock.status !== "completed"
    || manifest.execution_fingerprint !== resultPackage.execution_fingerprint
    || lock.execution_fingerprint !== resultPackage.execution_fingerprint
    || resultPackage.parent.execution_fingerprint
      !== "cc726491b3452eb2bcded191d1a1f4eacc46758915970d2cf77ddce16395c674"
    || sha256Canonical(resultPackage.parent.artifacts)
      !== sha256Canonical(GI088_RECORD_CARD_REWRITE_V3_PARENT_HASHES)) {
    fail("GI088_RECORD_REWRITE_V3_COMMITTED_PACKAGE_INVALID");
  }
  const artifacts = manifest.artifacts as Record<string, unknown>;
  if (artifacts["round-package.json"] !== sha256Text(packageText)
    || artifacts["round-run.lock.json"] !== sha256Text(lockText)
    || artifacts["attempt-ledger.ndjson"] !== sha256Text(ledgerText)) {
    fail("GI088_RECORD_REWRITE_V3_MANIFEST_HASH_INVALID");
  }
  const currentSnapshot = await codeSnapshot(resolve(projectRoot));
  const snapshotMatches = sha256Canonical(currentSnapshot) === sha256Canonical(resultPackage.code_snapshot);
  if (!snapshotMatches && !allowHistoricalSnapshot) {
    fail("GI088_RECORD_REWRITE_V3_CODE_SNAPSHOT_DRIFT");
  }
  const [sources, parent] = await Promise.all([
    loadGi088HumanExtensionSources(resolve(projectRoot)),
    parentArtifacts(resolve(projectRoot))
  ]);
  const expectedScope = createScope({
    sources,
    parent,
    snapshot: snapshotMatches ? currentSnapshot : resultPackage.code_snapshot
  });
  if (expectedScope !== resultPackage.scope_fingerprint) {
    fail("GI088_RECORD_REWRITE_V3_SCOPE_INVALID");
  }
  const lines = ledgerText.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
  if (resultPackage.cases.length !== 6 || sources.sources.length !== 6) {
    fail("GI088_RECORD_REWRITE_V3_CASE_COUNT_INVALID");
  }
  for (let index = 0; index < resultPackage.cases.length; index += 1) {
    const recordCase = resultPackage.cases[index];
    const source = sources.sources[index];
    if (!source || source.selection.caseId !== recordCase.case_id
      || source.sourceProjectionSha256 !== recordCase.source_projection_sha256) {
      fail("GI088_RECORD_REWRITE_V3_CASE_BINDING_INVALID");
    }
    const material: Gi088RecordCardWritingMaterial = buildGi088RecordCardWritingMaterial(source);
    const prompt = buildGi088RecordCardRewriteV3Prompt(source, material);
    if (sha256Canonical(material) !== recordCase.writing_material_sha256
      || prompt.resolvedPromptHash !== recordCase.candidate.trace.prompt_hash) {
      fail("GI088_RECORD_REWRITE_V3_INPUT_BINDING_INVALID");
    }
    const finalAttempt = [...recordCase.candidate.trace.attempts].reverse()
      .find((attempt) => attempt.outcome === "valid_response");
    const raw = finalAttempt ? resultPackage.raw_responses.find(
      (item) => item.call_fingerprint === finalAttempt.call_fingerprint
    ) : null;
    if (finalAttempt && raw) {
      if (sha256Text(raw.content) !== raw.sha256
        || raw.sha256 !== finalAttempt.raw_response_sha256
        || finalAttempt.response_model !== "deepseek-v4-flash"
        || finalAttempt.reasoning_present !== false
        || (finalAttempt.reasoning_tokens ?? 0) !== 0) {
        fail("GI088_RECORD_REWRITE_V3_RAW_INVALID");
      }
      const parsed = parseGi088RecordCardRewriteV3Output({
        source,
        material,
        content: raw.content,
        finishReason: finalAttempt.finish_reason
      });
      if (sha256Canonical(parsed.materialUnits) !== sha256Canonical(recordCase.candidate.material_units)
        || sha256Canonical(parsed.recordCard) !== sha256Canonical(recordCase.candidate.record_card)
        || sha256Canonical(parsed.paragraphs) !== sha256Canonical(recordCase.candidate.paragraphs)
        || parsed.accepted !== recordCase.candidate.program_check.admitted
        || sha256Canonical(parsed.issues) !== sha256Canonical(
          recordCase.candidate.program_check.failures.map((failure) => failure.code)
        )
        || sha256Canonical(parsed.diagnostics)
          !== sha256Canonical(recordCase.candidate.program_check.diagnostics)) {
        fail("GI088_RECORD_REWRITE_V3_RAW_PROJECTION_INVALID");
      }
    } else if (recordCase.candidate.record_card || recordCase.candidate.material_units.length > 0) {
      fail("GI088_RECORD_REWRITE_V3_TECHNICAL_PROJECTION_INVALID");
    }
  }
  const attempts = resultPackage.cases.flatMap((item) => item.candidate.trace.attempts);
  const expectedExecution = createGi088RecordCardRewriteV3ExecutionFingerprint({
    scopeFingerprint: resultPackage.scope_fingerprint,
    providerPreflight: resultPackage.provider_preflight,
    actualCalls: resultPackage.run.actual_model_calls,
    cases: resultPackage.cases,
    rawResponses: resultPackage.raw_responses
  });
  const calls = manifest.calls as Record<string, unknown>;
  if (expectedExecution !== resultPackage.execution_fingerprint
    || resultPackage.run.actual_model_calls !== attempts.length
    || lines.filter((item) => item.event === "call_reserved").length !== attempts.length
    || calls.nominal !== NOMINAL_CALLS
    || calls.maximum !== MAX_CALLS
    || calls.actual !== resultPackage.run.actual_model_calls) {
    fail("GI088_RECORD_REWRITE_V3_EXECUTION_INVALID");
  }
  for (const file of [
    "round-package.json",
    "commit-manifest.json",
    "round-run.lock.json",
    "attempt-ledger.ndjson"
  ]) {
    const mode = (await stat(resolve(target, file))).mode & 0o777;
    if (mode !== 0o600) fail("GI088_RECORD_REWRITE_V3_FILE_PERMISSION_INVALID");
  }
  return { directory: target, package: resultPackage, manifest, lock, ledger: lines };
}
