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
  formatJournalDailyDateTitle
} from "@/server/services/journal-daily-entry/journal-daily-entry-generation.service";
import {
  buildJournalDailyWriterPrompt,
  JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
} from "@/server/services/journal-daily-entry/prompt";
import type {
  JournalDailySourceRecord,
  JournalDailyWriterInput
} from "@/server/services/journal-daily-entry/contract";
import type { JournalDailyWritingMaterial } from "@/types/journal-daily-entry";

import {
  GI088_JOURNAL_CALIBRATION_RUNTIME,
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
  assertGi088ExtensionConfirmationsUnchanged,
  loadGi088ExtensionConfirmations,
  type Gi088ConfirmedExtensionRecord,
  type Gi088ExtensionConfirmationBundle
} from "./gi088-human-extension-confirmations";
import {
  GI088_HUMAN_EXTENSION_DAILY_BUDGET,
  GI088_HUMAN_EXTENSION_DAILY_ROUND_ID,
  GI088_HUMAN_EXTENSION_FLASH_MODEL,
  GI088_HUMAN_EXTENSION_FROZEN_SCOPE_SHA256,
  GI088_HUMAN_EXTENSION_RUNTIME,
  GI088_HUMAN_EXTENSION_VERSION
} from "./gi088-human-extension-contract";
import {
  GI088_RECORD_CARD_V3_DAILY_ROUND_ID,
  GI088_RECORD_CARD_V3_DAILY_VERSION,
  assertGi088RecordCardV3DailyConfirmationsUnchanged,
  loadGi088RecordCardV3DailyConfirmations,
  type Gi088RecordCardV3DailyConfirmationBundle
} from "./gi088-record-card-v3-daily-parent";
import { sha256File } from "./private-export-importer";
import {
  resolveGi088CalibrationCredential,
  safeGi088CalibrationErrorCode,
  type Gi088CalibrationCredential
} from "./run-gi088-calibration";
import {
  assessGi088FlashDailyContextV3Output
} from "./run-gi088-flash-daily-context-v3";
import {
  appendGi088ExtensionLedger,
  type Gi088ExtensionProgramFailure,
  type Gi088ExtensionProviderPreflight,
  type Gi088ExtensionPriorZeroCallFailure
} from "./run-gi088-human-extension-records";

const PRIVATE_ROOT_RELATIVE = "artifacts/journal-generation-evaluation/.private";
const RECORD_ROOT_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/formal/extension/record-cards`;
const REAL_ROOT_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/formal/extension/daily-v3`;
const MOCK_ROOT_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/extension-mock/daily-v3`;
const RECORD_CARD_V3_REAL_ROOT_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/formal/record-card-v3-daily`;
const RECORD_CARD_V3_MOCK_ROOT_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/record-card-v3-daily-mock`;
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
  "scripts/journal-generation-eval/gi088-human-extension-confirmations.ts",
  "scripts/journal-generation-eval/gi088-human-extension-contract.ts",
  "scripts/journal-generation-eval/gi088-human-extension-source.ts",
  "scripts/journal-generation-eval/private-export-importer.ts",
  "scripts/journal-generation-eval/run-gi088-calibration.ts",
  "scripts/journal-generation-eval/run-gi088-flash-daily-context-v3.ts",
  "scripts/journal-generation-eval/run-gi088-human-extension-records.ts",
  "scripts/journal-generation-eval/gi088-record-card-v3-daily-parent.ts",
  "scripts/journal-generation-eval/run-gi088-human-extension-daily.ts",
  "scripts/journal-generation-eval/run-gi088-human-extension-daily-cli.ts",
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

export interface Gi088ExtensionDailyCase {
  case_id: string;
  source_group_id: string;
  source_file_sha256: string;
  source_projection_sha256: string;
  original_record_card_sha256: string;
  approved_record_card: Gi088CalibrationRecordCard;
  approved_record_card_sha256: string;
  source_signature: string;
  content_revision: 1 | 2;
  record_card_edited: boolean;
  writing_material_sha256: string;
  writing_material_supported_insight_count: number;
  writing_material_question_context_count: number;
  candidate: {
    candidate_id: string;
    title: string;
    paragraphs: Array<{
      paragraph_id: string;
      text: string;
      source_refs: string[];
      record_card_refs: string[];
    }>;
    program_check: {
      admitted: boolean;
      failures: Gi088ExtensionProgramFailure[];
      checks: Array<{ check: string; passed: boolean; issues: string[] }>;
      diagnostics: string[];
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

export interface Gi088ExtensionDailyPackage {
  schema_version: "1.0";
  privacy_classification: "private_local_only";
  extension_version: string;
  round_id: string;
  generated_at: string;
  mode: "mock" | "real";
  scope_fingerprint: string;
  execution_fingerprint: string;
  prior_zero_call_failures: Gi088ExtensionPriorZeroCallFailure[];
  parent: {
    round_id: string;
    execution_fingerprint: string;
    confirmation_set_sha256: string;
    artifacts: {
      package_sha256: string;
      manifest_sha256: string;
      attempt_ledger_sha256: string;
      run_lock_sha256: string;
    };
  };
  prompt: {
    version: typeof JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION;
    system_prompt_sha256: typeof JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH;
    few_shot_count: 0;
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
  budget: typeof GI088_HUMAN_EXTENSION_DAILY_BUDGET;
  run: {
    actual_model_calls: number;
    technical_retries: number;
    quality_retries: 0;
    completed_cases: number;
    admitted_cases: number;
  };
  code_snapshot: Array<{ path: string; sha256: string }>;
  provider_preflight: Gi088ExtensionProviderPreflight | null;
  cases: Gi088ExtensionDailyCase[];
  raw_responses: Array<{
    call_fingerprint: string;
    case_id: string;
    candidate_id: string;
    attempt: 1 | 2;
    sha256: string;
    content: string;
  }>;
}

export interface Gi088ExtensionDailyOptions {
  mode: "dry-run" | "mock" | "real";
  confirmPrivateReplay: boolean;
  confirmScopeFingerprint: string | null;
  confirmParentFingerprint: string | null;
  maxCalls: number;
  maxCallsExplicit: boolean;
  runId: string | null;
  parentDirectory: string | null;
  sourceMode?: "legacy_extension" | "record_card_v3";
}

type Gi088DailyConfirmationBundle = Gi088ExtensionConfirmationBundle
  | Gi088RecordCardV3DailyConfirmationBundle;

type Gi088DailyRunProfile = {
  sourceMode: "legacy_extension" | "record_card_v3";
  roundId: string;
  version: string;
  realRootRelative: string;
  mockRootRelative: string;
  frozenScopeSha256: string;
};

function runProfile(sourceMode: Gi088ExtensionDailyOptions["sourceMode"]): Gi088DailyRunProfile {
  if (sourceMode === "record_card_v3") {
    return {
      sourceMode,
      roundId: GI088_RECORD_CARD_V3_DAILY_ROUND_ID,
      version: GI088_RECORD_CARD_V3_DAILY_VERSION,
      realRootRelative: RECORD_CARD_V3_REAL_ROOT_RELATIVE,
      mockRootRelative: RECORD_CARD_V3_MOCK_ROOT_RELATIVE,
      frozenScopeSha256: sha256Canonical({
        sourceMode,
        roundId: GI088_RECORD_CARD_V3_DAILY_ROUND_ID,
        version: GI088_RECORD_CARD_V3_DAILY_VERSION,
        promptVersion: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
        promptHash: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH,
        budget: GI088_HUMAN_EXTENSION_DAILY_BUDGET
      })
    };
  }
  return {
    sourceMode: "legacy_extension",
    roundId: GI088_HUMAN_EXTENSION_DAILY_ROUND_ID,
    version: GI088_HUMAN_EXTENSION_VERSION,
    realRootRelative: REAL_ROOT_RELATIVE,
    mockRootRelative: MOCK_ROOT_RELATIVE,
    frozenScopeSha256: GI088_HUMAN_EXTENSION_FROZEN_SCOPE_SHA256
  };
}

async function assertDailyConfirmationsUnchanged(
  confirmations: Gi088DailyConfirmationBundle,
  profile: Gi088DailyRunProfile,
  options: { allowMock?: boolean; projectRoot?: string }
) {
  if (profile.sourceMode === "record_card_v3") {
    await assertGi088RecordCardV3DailyConfirmationsUnchanged(
      confirmations as Gi088RecordCardV3DailyConfirmationBundle,
      { projectRoot: options.projectRoot }
    );
    return;
  }
  const legacy = confirmations as Gi088ExtensionConfirmationBundle;
  await assertGi088ExtensionConfirmationsUnchanged(legacy, options);
}

export interface Gi088ExtensionDailyDependencies {
  resolveCredential: typeof resolveGi088CalibrationCredential;
  createRealProvider: (input: { apiKey: string; baseUrl: string }) => Gi088CalibrationProvider;
  createMockProvider: () => Gi088CalibrationProvider;
  fetcher: typeof fetch;
  now: () => Date;
  appendLedger: typeof appendGi088ExtensionLedger;
}

export class Gi088ExtensionDailyError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Gi088ExtensionDailyError";
  }
}

function fail(code: string): never {
  throw new Gi088ExtensionDailyError(code);
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
    fail("GI088_EXTENSION_DAILY_RUNTIME_CONTRACT_MISMATCH");
  }
}

async function loadCodeSnapshot(projectRoot: string) {
  return await Promise.all(IMPLEMENTATION_FILES.map(async (path) => ({
    path,
    sha256: await sha256File(resolve(projectRoot, path))
  })));
}

function assertPrivateOutput(path: string, projectRoot: string) {
  const privateRoot = resolve(projectRoot, PRIVATE_ROOT_RELATIVE);
  const fromPrivate = relative(privateRoot, path);
  if (!fromPrivate || fromPrivate === ".." || fromPrivate.startsWith(`..${sep}`)) {
    fail("GI088_EXTENSION_DAILY_PRIVATE_OUTPUT_REQUIRED");
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

async function discoverRecordParent(projectRoot: string, explicit: string | null) {
  if (explicit) return resolve(explicit);
  const root = resolve(projectRoot, RECORD_ROOT_RELATIVE);
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    fail("GI088_EXTENSION_DAILY_RECORD_PARENT_MISSING");
  }
  const committed: string[] = [];
  for (const entry of entries) {
    if (!entry.startsWith("gi088-human-extension-record-cards-")) continue;
    try {
      const manifest = JSON.parse(
        await readFile(resolve(root, entry, "commit-manifest.json"), "utf8")
      ) as Record<string, unknown>;
      if (manifest.status === "committed") committed.push(resolve(root, entry));
    } catch {
      // 未完成记录轮保留为失败证据。
    }
  }
  if (committed.length !== 1) fail("GI088_EXTENSION_DAILY_RECORD_PARENT_AMBIGUOUS");
  return committed[0];
}

function sourceMessageId(ref: string) {
  return ref.startsWith("message:") ? ref.slice("message:".length) : null;
}

function lastAssistantQuestion(content: string) {
  const normalized = content.replace(/\s+/gu, " ").trim();
  if (!/[?？]$/u.test(normalized)) return null;
  const withoutTerminal = normalized.slice(0, -1);
  const lastBoundary = Math.max(
    withoutTerminal.lastIndexOf("。"),
    withoutTerminal.lastIndexOf("！"),
    withoutTerminal.lastIndexOf("!"),
    withoutTerminal.lastIndexOf("？"),
    withoutTerminal.lastIndexOf("?"),
    withoutTerminal.lastIndexOf(".")
  );
  return normalized.slice(lastBoundary + 1).trim() || null;
}

export function buildGi088ExtensionWritingMaterial(input: {
  confirmation: Gi088ConfirmedExtensionRecord;
  source: Gi088ExtensionConfirmationBundle["recordRound"]["sourceBundle"]["sources"][number];
}): JournalDailyWritingMaterial {
  const card = input.confirmation.approvedRecordCard;
  const supportedInsights = card.insight.split(/\n{2,}/u)
    .map((item) => item.trim())
    .filter(Boolean);
  if (input.confirmation.edited) {
    return {
      eventText: card.text.trim(),
      supportedInsights,
      questionContext: [],
      basedOnContentRevision: input.confirmation.contentRevision
    };
  }
  const answerIds = new Set(card.source_refs.flatMap((ref) => {
    const id = sourceMessageId(ref);
    return id ? [id] : [];
  }));
  for (const understanding of input.source.projection.validUnderstandings) {
    if (!card.source_refs.includes(understanding.ref)) continue;
    for (const evidenceRef of understanding.evidenceRefs) {
      const id = sourceMessageId(evidenceRef);
      if (id) answerIds.add(id);
    }
  }
  const questionContext: JournalDailyWritingMaterial["questionContext"] = [];
  let pendingQuestion: string | null = null;
  for (const message of input.source.projection.transcript) {
    if (message.role === "assistant") {
      pendingQuestion = lastAssistantQuestion(message.content);
      continue;
    }
    if (message.role !== "user") continue;
    const question = pendingQuestion;
    pendingQuestion = null;
    const answerId = sourceMessageId(message.ref);
    if (!question || !answerId || !answerIds.has(answerId)) continue;
    questionContext.push({ answerSourceMessageId: answerId, question });
  }
  return {
    eventText: card.text.trim(),
    supportedInsights,
    questionContext,
    basedOnContentRevision: input.confirmation.contentRevision
  };
}

function sourceRecord(input: {
  confirmation: Gi088ConfirmedExtensionRecord;
  entryDate: string;
  writingMaterial: JournalDailyWritingMaterial;
}): JournalDailySourceRecord {
  const card = input.confirmation.approvedRecordCard;
  return {
    recordId: card.record_card_id,
    eventId: card.event_id,
    entryDate: input.entryDate,
    daySequence: 1,
    title: card.title,
    content: [card.text, card.insight].filter((item) => item.trim()).join("\n\n"),
    contentRevision: input.confirmation.contentRevision,
    updatedAt: `${input.entryDate}T12:00:00.000Z`,
    writingMaterial: input.writingMaterial
  };
}

function writerInput(record: JournalDailySourceRecord): JournalDailyWriterInput {
  return {
    task: "generate",
    entryDate: record.entryDate,
    title: formatJournalDailyDateTitle(record.entryDate),
    sourceRecords: [record],
    currentEntry: null,
    savedRevision: null,
    updatePlan: null
  };
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
    fail("GI088_EXTENSION_DAILY_MODEL_PREFLIGHT_UNREACHABLE");
  }
  if (!response.ok) fail(`GI088_EXTENSION_DAILY_MODEL_PREFLIGHT_HTTP_${response.status}`);
  const body = await response.json() as unknown;
  const ids = isObject(body) && Array.isArray(body.data)
    ? body.data.flatMap((item) => isObject(item) && typeof item.id === "string" ? [item.id] : [])
    : [];
  if (!ids.includes("deepseek-v4-flash")) fail("GI088_EXTENSION_DAILY_FLASH_MODEL_UNAVAILABLE");
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

function candidateId(scopeFingerprint: string, caseId: string) {
  return `flash-daily-${sha256Canonical({ scopeFingerprint, caseId }).slice(0, 20)}`;
}

async function runDailyCase(input: {
  provider: Gi088CalibrationProvider;
  confirmation: Gi088ConfirmedExtensionRecord;
  source: Gi088ExtensionConfirmationBundle["recordRound"]["sourceBundle"]["sources"][number];
  scopeFingerprint: string;
  actualCalls: { value: number };
  ledgerPath: string;
  rawResponses: Gi088ExtensionDailyPackage["raw_responses"];
  preCallGuard: () => Promise<void>;
  now: () => Date;
  appendLedger: typeof appendGi088ExtensionLedger;
}) {
  const writingMaterial = buildGi088ExtensionWritingMaterial({
    confirmation: input.confirmation,
    source: input.source
  });
  const record = sourceRecord({
    confirmation: input.confirmation,
    entryDate: input.source.selection.entryDate,
    writingMaterial
  });
  const prompt = buildJournalDailyWriterPrompt(writerInput(record));
  if (prompt.promptVersion !== JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION
    || JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH.length !== 64) {
    fail("GI088_EXTENSION_DAILY_PROMPT_NOT_READY");
  }
  const id = candidateId(input.scopeFingerprint, input.confirmation.caseId);
  const attempts: Gi088CalibrationAttemptTrace[] = [];
  let response: Gi088CalibrationProviderResult | null = null;
  let assessment: ReturnType<typeof assessGi088FlashDailyContextV3Output> | null = null;
  let terminalCode: string | null = null;
  for (const attempt of [1, 2] as const) {
    if (input.actualCalls.value >= MAX_CALLS) fail("GI088_EXTENSION_DAILY_CALL_BUDGET_EXCEEDED");
    assertRuntime();
    await input.preCallGuard();
    const callFingerprint = sha256Canonical({
      scopeFingerprint: input.scopeFingerprint,
      caseId: input.confirmation.caseId,
      candidateId: id,
      stage: "daily_journal",
      attempt,
      promptHash: prompt.resolvedPromptHash,
      approvedRecordCardSha256: input.confirmation.approvedRecordCardSha256,
      sourceSignature: input.confirmation.sourceSignature
    });
    const sequence = input.actualCalls.value + 1;
    await input.appendLedger(input.ledgerPath, {
      event: "call_reserved",
      at: input.now().toISOString(),
      sequence,
      call_fingerprint: callFingerprint,
      case_id: input.confirmation.caseId,
      candidate_id: id,
      stage: "daily_journal",
      attempt,
      model: "deepseek-v4-flash",
      provider_adapter: input.provider.name
    });
    input.actualCalls.value = sequence;
    const startedAt = Date.now();
    let result: Gi088CalibrationProviderResult;
    try {
      result = await input.provider.complete({
        callFingerprint,
        caseId: input.confirmation.caseId,
        candidateId: id,
        stage: "daily_journal",
        attempt,
        model: GI088_HUMAN_EXTENSION_FLASH_MODEL,
        messages: prompt.messages,
        promptHash: prompt.resolvedPromptHash,
        sourceRefs: input.confirmation.approvedRecordCard.source_refs,
        sourceTextByRef: {},
        sourceRecordIds: [record.recordId],
        sourceRecordTextById: { [record.recordId]: record.content },
        runtime: GI088_JOURNAL_CALIBRATION_RUNTIME
      } satisfies Gi088CalibrationProviderRequest);
    } catch (error) {
      const technical = normalizeProviderError(error, Date.now() - startedAt);
      const retryScheduled = attempt === 1 && technical.retryable;
      attempts.push({
        call_fingerprint: callFingerprint,
        stage: "daily_journal",
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
          model: "deepseek-v4-flash",
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
    assessment = assessGi088FlashDailyContextV3Output({
      content: result.content,
      finishReason: result.finishReason ?? null,
      responseModel: result.responseModel ?? null,
      reasoningPresent: result.reasoningPresent ?? null,
      reasoningTokens: result.reasoningTokens ?? null,
      sourceRecord: record,
      invalidatedPhrases: input.source.invalidatedUnderstandingSummaries
    });
    input.rawResponses.push({
      call_fingerprint: callFingerprint,
      case_id: input.confirmation.caseId,
      candidate_id: id,
      attempt,
      sha256: rawSha,
      content: result.content
    });
    attempts.push({
      call_fingerprint: callFingerprint,
      stage: "daily_journal",
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
        model: "deepseek-v4-flash",
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
      quality_accepted: assessment.accepted,
      quality_issues: assessment.issues,
      quality_diagnostics: assessment.diagnostics
    });
    response = result;
    terminalCode = null;
    break;
  }
  const issues = assessment?.issues ?? [];
  const failures: Gi088ExtensionProgramFailure[] = response
    ? issues.map((issue) => ({
        code: issue,
        message: "今日日记未通过客观来源或结构检查，首个完整结果已保留并停止模型改写。",
        refs: [input.confirmation.approvedRecordCard.record_card_id],
        severity: "P0" as const
      }))
    : [{
        code: terminalCode ?? "DAILY_JOURNAL_TECHNICAL_FAILURE",
        message: "今日日记生成在允许的技术尝试内未获得完整响应。",
        refs: [input.confirmation.approvedRecordCard.record_card_id],
        severity: "technical" as const
      }];
  const paragraphs = (assessment?.paragraphs ?? []).map((paragraph, index) => ({
    paragraph_id: `${id}:p${index + 1}`,
    text: paragraph.text,
    source_refs: [...input.confirmation.approvedRecordCard.source_refs],
    record_card_refs: paragraph.sourceRecordIds
  }));
  const costs = attempts.flatMap((attempt) => attempt.cost_cny === null ? [] : [attempt.cost_cny]);
  return {
    case_id: input.confirmation.caseId,
    source_group_id: input.confirmation.sourceGroupId,
    source_file_sha256: input.confirmation.sourceFileSha256,
    source_projection_sha256: input.confirmation.sourceProjectionSha256,
    original_record_card_sha256: input.confirmation.originalRecordCardSha256,
    approved_record_card: input.confirmation.approvedRecordCard,
    approved_record_card_sha256: input.confirmation.approvedRecordCardSha256,
    source_signature: input.confirmation.sourceSignature,
    content_revision: input.confirmation.contentRevision,
    record_card_edited: input.confirmation.edited,
    writing_material_sha256: sha256Canonical(writingMaterial),
    writing_material_supported_insight_count: writingMaterial.supportedInsights.length,
    writing_material_question_context_count: writingMaterial.questionContext.length,
    candidate: {
      candidate_id: id,
      title: formatJournalDailyDateTitle(input.source.selection.entryDate),
      paragraphs,
      program_check: {
        admitted: Boolean(response && assessment?.accepted),
        failures,
        checks: [
          {
            check: "strict_json_non_empty",
            passed: !issues.some((item) => /JSON|SCHEMA|EMPTY/u.test(item)),
            issues
          },
          {
            check: "source_record_ids_and_coverage",
            passed: !issues.some((item) => /SOURCE_RECORD/u.test(item)),
            issues
          },
          {
            check: "model_thinking_and_finish_reason",
            passed: !issues.some((item) => /MODEL|THINKING|FINISH_REASON/u.test(item)),
            issues
          },
          {
            check: "unsupported_number_and_invalidated_content",
            passed: !issues.some((item) => /UNSUPPORTED|INVALIDATED/u.test(item)),
            issues
          }
        ],
        diagnostics: assessment?.diagnostics ?? []
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
  } satisfies Gi088ExtensionDailyCase;
}

function createScope(input: {
  confirmations: Gi088DailyConfirmationBundle;
  writingMaterials: Map<string, JournalDailyWritingMaterial>;
  codeSnapshot: Array<{ path: string; sha256: string }>;
  priorZeroCallFailures: Gi088ExtensionPriorZeroCallFailure[];
  profile: Gi088DailyRunProfile;
}) {
  return {
    extensionVersion: input.profile.version,
    frozenScopeSha256: input.profile.frozenScopeSha256,
    roundId: input.profile.roundId,
    sourceMode: input.profile.sourceMode,
    parent: {
      roundId: input.confirmations.recordRound.package.round_id,
      executionFingerprint: input.confirmations.recordRound.package.execution_fingerprint,
      confirmationSetSha256: input.confirmations.confirmationSetSha256,
      artifacts: input.confirmations.recordRound.artifactSha256
    },
    cases: input.confirmations.confirmations.map((confirmation) => ({
      caseId: confirmation.caseId,
      sourceFileSha256: confirmation.sourceFileSha256,
      sourceProjectionSha256: confirmation.sourceProjectionSha256,
      originalRecordCardSha256: confirmation.originalRecordCardSha256,
      approvedRecordCardSha256: confirmation.approvedRecordCardSha256,
      sourceSignature: confirmation.sourceSignature,
      contentRevision: confirmation.contentRevision,
      edited: confirmation.edited,
      writingMaterial: input.writingMaterials.get(confirmation.caseId)
    })),
    model: "deepseek-v4-flash",
    prompt: {
      version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
      systemPromptSha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH,
      fewShotCount: 0
    },
    runtime: { ...GI088_HUMAN_EXTENSION_RUNTIME, providerAdapter: REAL_PROVIDER_ADAPTER },
    budget: GI088_HUMAN_EXTENSION_DAILY_BUDGET,
    priorZeroCallFailures: input.priorZeroCallFailures,
    codeSnapshot: input.codeSnapshot
  };
}

function executionFingerprint(input: {
  scopeFingerprint: string;
  actualCalls: number;
  providerPreflight: Gi088ExtensionProviderPreflight | null;
  providerAdapter: string;
  cases: Gi088ExtensionDailyCase[];
  rawResponses: Gi088ExtensionDailyPackage["raw_responses"];
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

async function loadPriorZeroCallFailures(
  root: string,
  roundId: string,
  excludeRunId: string | null = null
) {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    fail("GI088_EXTENSION_DAILY_HISTORY_UNREADABLE");
  }
  const failures: Gi088ExtensionPriorZeroCallFailure[] = [];
  for (const entry of entries.sort()) {
    if (!entry.startsWith(`${roundId}-`)
      || entry === excludeRunId) continue;
    let lockText: string;
    try {
      lockText = await readFile(resolve(root, entry, "round-run.lock.json"), "utf8");
    } catch {
      fail("GI088_EXTENSION_DAILY_HISTORY_INVALID");
    }
    let lock: Record<string, unknown>;
    try {
      lock = JSON.parse(lockText) as Record<string, unknown>;
    } catch {
      fail("GI088_EXTENSION_DAILY_HISTORY_INVALID");
    }
    if (lock.mode !== "real") continue;
    let ledgerText: string | null = null;
    try {
      ledgerText = await readFile(resolve(root, entry, "attempt-ledger.ndjson"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        fail("GI088_EXTENSION_DAILY_HISTORY_INVALID");
      }
    }
    const reserved = ledgerText?.includes('"event":"call_reserved"') ?? false;
    if (lock.status !== "failed" || lock.observed_model_calls !== 0 || reserved) {
      fail("GI088_EXTENSION_DAILY_PRIOR_REAL_RUN_EXISTS");
    }
    failures.push({
      run_id: entry,
      lock_sha256: sha256Text(lockText),
      attempt_ledger_sha256: ledgerText === null ? null : sha256Text(ledgerText)
    });
  }
  return failures;
}

export async function runGi088HumanExtensionDaily(
  options: Gi088ExtensionDailyOptions,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: Partial<Gi088ExtensionDailyDependencies> = {},
  projectRoot = process.cwd()
) {
  const profile = runProfile(options.sourceMode);
  assertRuntime();
  if (options.maxCalls !== MAX_CALLS) fail("GI088_EXTENSION_DAILY_MAX_CALLS_MUST_EQUAL_12");
  if (options.mode === "real" && (!options.confirmPrivateReplay
    || !options.maxCallsExplicit
    || !options.confirmScopeFingerprint
    || !options.confirmParentFingerprint)) {
    fail("GI088_EXTENSION_DAILY_REAL_CONFIRMATION_INCOMPLETE");
  }
  const deps: Gi088ExtensionDailyDependencies = {
    resolveCredential: dependencies.resolveCredential ?? resolveGi088CalibrationCredential,
    createRealProvider: dependencies.createRealProvider ?? createGi088OpenAICompatibleCalibrationProvider,
    createMockProvider: dependencies.createMockProvider ?? createGi088MockCalibrationProvider,
    fetcher: dependencies.fetcher ?? fetch,
    now: dependencies.now ?? (() => new Date()),
    appendLedger: dependencies.appendLedger ?? appendGi088ExtensionLedger
  };
  const parentDirectory = options.sourceMode === "record_card_v3"
    ? options.parentDirectory
    : await discoverRecordParent(projectRoot, options.parentDirectory);
  if (options.sourceMode === "record_card_v3" && !parentDirectory) {
    // The v3 parent loader performs its own committed-package discovery.
  }
  if (parentDirectory) assertPrivateOutput(parentDirectory, projectRoot);
  const [confirmations, codeSnapshot] = await Promise.all([
    options.sourceMode === "record_card_v3"
      ? loadGi088RecordCardV3DailyConfirmations(parentDirectory, { projectRoot })
      : loadGi088ExtensionConfirmations(parentDirectory!, {
        allowMock: options.mode === "mock",
        projectRoot
      }),
    loadCodeSnapshot(projectRoot)
  ]);
  const writingMaterials = new Map<string, JournalDailyWritingMaterial>();
  for (const confirmation of confirmations.confirmations) {
    const source = confirmations.recordRound.sourceBundle.sources.find(
      (item) => item.selection.caseId === confirmation.caseId
    );
    if (!source) fail("GI088_EXTENSION_DAILY_SOURCE_MISSING");
    writingMaterials.set(confirmation.caseId, buildGi088ExtensionWritingMaterial({
      confirmation,
      source
    }));
  }
  const realRoot = resolve(projectRoot, profile.realRootRelative);
  const priorZeroCallFailures = await loadPriorZeroCallFailures(realRoot, profile.roundId);
  const scope = createScope({
    confirmations,
    writingMaterials,
    codeSnapshot,
    priorZeroCallFailures,
    profile
  });
  const scopeFingerprint = sha256Canonical(scope);
  const plan = {
    mode: "dry-run" as const,
    round_id: profile.roundId,
    scope_fingerprint: scopeFingerprint,
    parent_execution_fingerprint:
      confirmations.recordRound.package.execution_fingerprint,
    confirmation_set_sha256: confirmations.confirmationSetSha256,
    selected_cases: confirmations.confirmations.map((item) => ({
      case_id: item.caseId,
      approved_record_card_sha256: item.approvedRecordCardSha256,
      source_signature: item.sourceSignature,
      content_revision: item.contentRevision,
      edited: item.edited,
      question_context_count:
        writingMaterials.get(item.caseId)?.questionContext.length ?? 0
    })),
    model: "deepseek-v4-flash" as const,
    stage: "daily_journal" as const,
    prompt_version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
    system_prompt_sha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH,
    few_shot_count: 0,
    nominal_model_calls: NOMINAL_CALLS,
    max_model_calls: MAX_CALLS,
    model_calls_executed: 0 as const,
    required_real_run_confirmation: {
      private_replay: true,
      scope_fingerprint: scopeFingerprint,
      parent_fingerprint: confirmations.confirmationSetSha256,
      max_calls: MAX_CALLS
    }
  };
  if (options.mode === "dry-run") return { plan, outputWritten: false as const };
  if (options.mode === "real" && (
    options.confirmScopeFingerprint !== scopeFingerprint
    || options.confirmParentFingerprint !== confirmations.confirmationSetSha256
  )) fail("GI088_EXTENSION_DAILY_SCOPE_CONFIRMATION_MISMATCH");

  const root = resolve(
    projectRoot,
    options.mode === "real" ? profile.realRootRelative : profile.mockRootRelative
  );
  assertPrivateOutput(root, projectRoot);
  const runName = options.runId ?? (options.mode === "real"
    ? `${profile.roundId}-${scopeFingerprint.slice(0, 8)}`
    : `${profile.roundId}-mock-${scopeFingerprint.slice(0, 8)}-${deps.now().getTime()}`);
  const directory = resolve(root, runName);
  assertPrivateOutput(directory, projectRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(resolve(projectRoot, PRIVATE_ROOT_RELATIVE), 0o700);
  await chmod(root, 0o700);
  try {
    await access(directory);
    fail("GI088_EXTENSION_DAILY_OUTPUT_ALREADY_EXISTS");
  } catch (error) {
    if (error instanceof Gi088ExtensionDailyError) throw error;
  }
  await mkdir(directory, { mode: 0o700 });
  const ledgerPath = resolve(directory, "attempt-ledger.ndjson");
  const lockPath = resolve(directory, "round-run.lock.json");
  const packagePath = resolve(directory, "round-package.json");
  const manifestPath = resolve(directory, "commit-manifest.json");
  await writePrivateJsonAtomic(lockPath, {
    round_id: profile.roundId,
    status: "reserved",
    mode: options.mode,
    reserved_at: deps.now().toISOString(),
    scope_fingerprint: scopeFingerprint,
    parent_execution_fingerprint: confirmations.recordRound.package.execution_fingerprint,
    confirmation_set_sha256: confirmations.confirmationSetSha256,
    observed_model_calls: 0
  });
  const actualCalls = { value: 0 };
  const rawResponses: Gi088ExtensionDailyPackage["raw_responses"] = [];
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
      if (provider.kind !== "real" || provider.name !== REAL_PROVIDER_ADAPTER) {
        fail("GI088_EXTENSION_DAILY_REAL_PROVIDER_IDENTITY_MISMATCH");
      }
    } else {
      provider = deps.createMockProvider();
      if (provider.kind !== "mock") fail("GI088_EXTENSION_DAILY_MOCK_PROVIDER_IDENTITY_MISMATCH");
    }
    providerAdapter = provider.name;
    const cases: Gi088ExtensionDailyCase[] = [];
    for (const confirmation of confirmations.confirmations) {
      const source = confirmations.recordRound.sourceBundle.sources.find(
        (item) => item.selection.caseId === confirmation.caseId
      );
      if (!source) fail("GI088_EXTENSION_DAILY_SOURCE_MISSING");
      cases.push(await runDailyCase({
        provider,
        confirmation,
        source,
        scopeFingerprint,
        actualCalls,
        ledgerPath,
        rawResponses,
        preCallGuard: async () => {
          await assertDailyConfirmationsUnchanged(confirmations, profile, {
            allowMock: options.mode === "mock",
            projectRoot
          });
          if (options.mode === "real") {
            const current = await loadPriorZeroCallFailures(realRoot, profile.roundId, runName);
            if (canonicalJson(current) !== canonicalJson(priorZeroCallFailures)) {
              fail("GI088_EXTENSION_DAILY_HISTORY_CHANGED");
            }
          }
        },
        now: deps.now,
        appendLedger: deps.appendLedger
      }));
    }
    if (cases.length !== 6
      || actualCalls.value < NOMINAL_CALLS
      || actualCalls.value > MAX_CALLS) {
      fail("GI088_EXTENSION_DAILY_RESULT_BUDGET_INVALID");
    }
    await assertDailyConfirmationsUnchanged(confirmations, profile, {
      allowMock: options.mode === "mock",
      projectRoot
    });
    const execution = executionFingerprint({
      scopeFingerprint,
      actualCalls: actualCalls.value,
      providerPreflight,
      providerAdapter,
      cases,
      rawResponses
    });
    const resultPackage: Gi088ExtensionDailyPackage = {
      schema_version: "1.0",
      privacy_classification: "private_local_only",
      extension_version: profile.version,
      round_id: profile.roundId,
      generated_at: deps.now().toISOString(),
      mode: options.mode,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: execution,
      prior_zero_call_failures: priorZeroCallFailures,
      parent: {
        round_id: confirmations.recordRound.package.round_id,
        execution_fingerprint: confirmations.recordRound.package.execution_fingerprint,
        confirmation_set_sha256: confirmations.confirmationSetSha256,
        artifacts: {
          package_sha256: confirmations.recordRound.artifactSha256.package,
          manifest_sha256: confirmations.recordRound.artifactSha256.manifest,
          attempt_ledger_sha256: confirmations.recordRound.artifactSha256.attempt_ledger,
          run_lock_sha256: confirmations.recordRound.artifactSha256.run_lock
        }
      },
      prompt: {
        version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
        system_prompt_sha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH,
        few_shot_count: 0
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
      budget: GI088_HUMAN_EXTENSION_DAILY_BUDGET,
      run: {
        actual_model_calls: actualCalls.value,
        technical_retries: cases.reduce(
          (sum, item) => sum + item.candidate.trace.technical_retry_count,
          0
        ),
        quality_retries: 0,
        completed_cases: cases.filter((item) => item.candidate.paragraphs.length > 0).length,
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
      round_id: profile.roundId,
      status: "completed",
      mode: options.mode,
      completed_at: deps.now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: execution,
      parent_execution_fingerprint: confirmations.recordRound.package.execution_fingerprint,
      confirmation_set_sha256: confirmations.confirmationSetSha256,
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
      round_id: profile.roundId,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: execution,
      parent_execution_fingerprint: confirmations.recordRound.package.execution_fingerprint,
      confirmation_set_sha256: confirmations.confirmationSetSha256,
      provider_adapter: providerAdapter,
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
      scopeFingerprint
    };
  } catch (error) {
    await writePrivateJsonAtomic(lockPath, {
      round_id: profile.roundId,
      status: "failed",
      mode: options.mode,
      failed_at: deps.now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      parent_execution_fingerprint: confirmations.recordRound.package.execution_fingerprint,
      confirmation_set_sha256: confirmations.confirmationSetSha256,
      provider_adapter: providerAdapter,
      observed_model_calls: actualCalls.value,
      error_code: safeGi088ExtensionDailyErrorCode(error)
    }).catch(() => undefined);
    throw error;
  }
}

interface Gi088ExtensionDailyCommitManifest {
  schema_version: "1.0";
  status: "committed";
  round_id: string;
  scope_fingerprint: string;
  execution_fingerprint: string;
  parent_execution_fingerprint: string;
  confirmation_set_sha256: string;
  provider_adapter: string;
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

interface Gi088ExtensionDailyRunLock {
  round_id: string;
  status: "completed";
  mode: "mock" | "real";
  scope_fingerprint: string;
  execution_fingerprint: string;
  parent_execution_fingerprint: string;
  confirmation_set_sha256: string;
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
        fail("GI088_EXTENSION_DAILY_LEDGER_INVALID");
      }
    });
  } catch (error) {
    if (error instanceof Gi088ExtensionDailyError) throw error;
    fail("GI088_EXTENSION_DAILY_LEDGER_INVALID");
  }
}

export interface LoadedGi088ExtensionDailyRound {
  directory: string;
  package: Gi088ExtensionDailyPackage;
  manifest: Gi088ExtensionDailyCommitManifest;
  runLock: Gi088ExtensionDailyRunLock;
  ledger: Array<Record<string, unknown>>;
  confirmations: Gi088DailyConfirmationBundle;
  artifactSha256: {
    package: string;
    manifest: string;
    attempt_ledger: string;
    run_lock: string;
  };
}

export async function loadCommittedGi088ExtensionDailyRound(
  directory: string,
  parentDirectory: string,
  options: {
    allowMock?: boolean;
    allowHistoricalSnapshot?: boolean;
    projectRoot?: string;
    sourceMode?: "legacy_extension" | "record_card_v3";
  } = {}
): Promise<LoadedGi088ExtensionDailyRound> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const profile = runProfile(options.sourceMode);
  assertPrivateOutput(directory, projectRoot);
  assertPrivateOutput(parentDirectory, projectRoot);
  const paths = {
    package: resolve(directory, "round-package.json"),
    manifest: resolve(directory, "commit-manifest.json"),
    attemptLedger: resolve(directory, "attempt-ledger.ndjson"),
    runLock: resolve(directory, "round-run.lock.json")
  };
  const [resultPackage, manifest, runLock, ledger, confirmations,
    packageSha256, manifestSha256, attemptLedgerSha256, runLockSha256] = await Promise.all([
    readJson<Gi088ExtensionDailyPackage>(paths.package, "GI088_EXTENSION_DAILY_PACKAGE_INVALID"),
    readJson<Gi088ExtensionDailyCommitManifest>(paths.manifest, "GI088_EXTENSION_DAILY_MANIFEST_INVALID"),
    readJson<Gi088ExtensionDailyRunLock>(paths.runLock, "GI088_EXTENSION_DAILY_LOCK_INVALID"),
    readLedger(paths.attemptLedger),
    profile.sourceMode === "record_card_v3"
      ? loadGi088RecordCardV3DailyConfirmations(parentDirectory, { projectRoot })
      : loadGi088ExtensionConfirmations(parentDirectory, {
        allowMock: options.allowMock,
        projectRoot
      }),
    sha256File(paths.package),
    sha256File(paths.manifest),
    sha256File(paths.attemptLedger),
    sha256File(paths.runLock)
  ]);
  if (manifest.schema_version !== "1.0"
    || manifest.status !== "committed"
    || manifest.round_id !== profile.roundId
    || manifest.files.package !== "round-package.json"
    || manifest.files.attempt_ledger !== "attempt-ledger.ndjson"
    || manifest.files.run_lock !== "round-run.lock.json"
    || manifest.child_artifacts.package_sha256 !== packageSha256
    || manifest.child_artifacts.attempt_ledger_sha256 !== attemptLedgerSha256
    || manifest.child_artifacts.run_lock_sha256 !== runLockSha256
    || runLock.status !== "completed"
    || runLock.round_id !== profile.roundId
    || runLock.package_sha256 !== packageSha256
    || runLock.scope_fingerprint !== resultPackage.scope_fingerprint
    || runLock.execution_fingerprint !== resultPackage.execution_fingerprint
    || runLock.actual_model_calls !== resultPackage.run.actual_model_calls
    || resultPackage.schema_version !== "1.0"
    || resultPackage.privacy_classification !== "private_local_only"
    || resultPackage.extension_version !== profile.version
    || resultPackage.round_id !== profile.roundId
    || (resultPackage.mode !== "real" && !options.allowMock)
    || resultPackage.prompt.version !== JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION
    || resultPackage.prompt.system_prompt_sha256 !== JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
    || resultPackage.prompt.few_shot_count !== 0
    || resultPackage.runtime.model !== "deepseek-v4-flash"
    || resultPackage.runtime.thinking !== "disabled"
    || resultPackage.runtime.temperature !== 0.2
    || resultPackage.runtime.quality_retries !== 0
    || resultPackage.budget.caseCount !== 6
    || resultPackage.budget.nominalModelCalls !== 6
    || resultPackage.budget.maxModelCalls !== 12
    || resultPackage.cases.length !== 6
    || resultPackage.parent.execution_fingerprint
      !== confirmations.recordRound.package.execution_fingerprint
    || resultPackage.parent.confirmation_set_sha256 !== confirmations.confirmationSetSha256
    || manifest.parent_execution_fingerprint !== resultPackage.parent.execution_fingerprint
    || manifest.confirmation_set_sha256 !== resultPackage.parent.confirmation_set_sha256
    || runLock.parent_execution_fingerprint !== resultPackage.parent.execution_fingerprint
    || runLock.confirmation_set_sha256 !== resultPackage.parent.confirmation_set_sha256
    || canonicalJson(resultPackage.parent.artifacts) !== canonicalJson({
      package_sha256: confirmations.recordRound.artifactSha256.package,
      manifest_sha256: confirmations.recordRound.artifactSha256.manifest,
      attempt_ledger_sha256: confirmations.recordRound.artifactSha256.attempt_ledger,
      run_lock_sha256: confirmations.recordRound.artifactSha256.run_lock
    })) {
    fail("GI088_EXTENSION_DAILY_COMMIT_INVALID");
  }
  if (resultPackage.mode === "real"
    && resultPackage.runtime.provider_adapter !== REAL_PROVIDER_ADAPTER) {
    fail("GI088_EXTENSION_DAILY_PROVIDER_ADAPTER_INVALID");
  }
  if (resultPackage.code_snapshot.length !== IMPLEMENTATION_FILES.length
    || resultPackage.code_snapshot.map((item) => item.path).join("\n")
      !== [...IMPLEMENTATION_FILES].join("\n")) {
    fail("GI088_EXTENSION_DAILY_CODE_SNAPSHOT_INVALID");
  }
  if (!options.allowHistoricalSnapshot) {
    await Promise.all(resultPackage.code_snapshot.map(async (item) => {
      if (await sha256File(resolve(projectRoot, item.path)) !== item.sha256) {
        fail("GI088_EXTENSION_DAILY_CODE_SNAPSHOT_CHANGED");
      }
    }));
  }
  await assertDailyConfirmationsUnchanged(confirmations, profile, {
    allowMock: options.allowMock,
    projectRoot
  });
  const writingMaterials = new Map<string, JournalDailyWritingMaterial>();
  for (const confirmation of confirmations.confirmations) {
    const source = confirmations.recordRound.sourceBundle.sources.find(
      (item) => item.selection.caseId === confirmation.caseId
    );
    if (!source) fail("GI088_EXTENSION_DAILY_SOURCE_MISSING");
    writingMaterials.set(confirmation.caseId, buildGi088ExtensionWritingMaterial({
      confirmation,
      source
    }));
  }
  const expectedScope = sha256Canonical(createScope({
    confirmations,
    writingMaterials,
    codeSnapshot: resultPackage.code_snapshot,
    priorZeroCallFailures: resultPackage.prior_zero_call_failures,
    profile
  }));
  if (expectedScope !== resultPackage.scope_fingerprint) {
    fail("GI088_EXTENSION_DAILY_SCOPE_INVALID");
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
    fail("GI088_EXTENSION_DAILY_LEDGER_INVALID");
  }
  let retryCount = 0;
  for (const dailyCase of resultPackage.cases) {
    const confirmation = confirmations.confirmations.find(
      (item) => item.caseId === dailyCase.case_id
    );
    const source = confirmations.recordRound.sourceBundle.sources.find(
      (item) => item.selection.caseId === dailyCase.case_id
    );
    const material = writingMaterials.get(dailyCase.case_id);
    if (!confirmation || !source || !material
      || dailyCase.source_group_id !== confirmation.sourceGroupId
      || dailyCase.source_file_sha256 !== confirmation.sourceFileSha256
      || dailyCase.source_projection_sha256 !== confirmation.sourceProjectionSha256
      || dailyCase.original_record_card_sha256 !== confirmation.originalRecordCardSha256
      || dailyCase.approved_record_card_sha256 !== confirmation.approvedRecordCardSha256
      || canonicalJson(dailyCase.approved_record_card)
        !== canonicalJson(confirmation.approvedRecordCard)
      || dailyCase.source_signature !== confirmation.sourceSignature
      || dailyCase.content_revision !== confirmation.contentRevision
      || dailyCase.record_card_edited !== confirmation.edited
      || dailyCase.writing_material_sha256 !== sha256Canonical(material)
      || dailyCase.writing_material_supported_insight_count !== material.supportedInsights.length
      || dailyCase.writing_material_question_context_count !== material.questionContext.length) {
      fail("GI088_EXTENSION_DAILY_SOURCE_BINDING_INVALID");
    }
    const record = sourceRecord({
      confirmation,
      entryDate: source.selection.entryDate,
      writingMaterial: material
    });
    const prompt = buildJournalDailyWriterPrompt(writerInput(record));
    const expectedCandidateId = candidateId(resultPackage.scope_fingerprint, dailyCase.case_id);
    if (dailyCase.candidate.candidate_id !== expectedCandidateId
      || dailyCase.candidate.trace.prompt_hash !== prompt.resolvedPromptHash) {
      fail("GI088_EXTENSION_DAILY_CANDIDATE_BINDING_INVALID");
    }
    const attempts = dailyCase.candidate.trace.attempts;
    if (attempts.length < 1 || attempts.length > 2
      || attempts[0].attempt !== 1
      || (attempts.length === 2 && (attempts[0].outcome !== "technical_failure"
        || attempts[0].retry_scheduled !== true
        || attempts[1].attempt !== 2))
      || attempts.at(-1)?.retry_scheduled !== false) {
      fail("GI088_EXTENSION_DAILY_ATTEMPT_SEQUENCE_INVALID");
    }
    retryCount += attempts.filter((attempt) => attempt.attempt === 2).length;
    let finalRaw: Gi088ExtensionDailyPackage["raw_responses"][number] | null = null;
    let finalAttempt: Gi088CalibrationAttemptTrace | null = null;
    for (const attempt of attempts) {
      const expectedCallFingerprint = sha256Canonical({
        scopeFingerprint: resultPackage.scope_fingerprint,
        caseId: dailyCase.case_id,
        candidateId: expectedCandidateId,
        stage: "daily_journal",
        attempt: attempt.attempt,
        promptHash: prompt.resolvedPromptHash,
        approvedRecordCardSha256: confirmation.approvedRecordCardSha256,
        sourceSignature: confirmation.sourceSignature
      });
      const reserveEvent = reservedByFingerprint.get(attempt.call_fingerprint);
      const terminalEvent = terminalByFingerprint.get(attempt.call_fingerprint);
      const raw = rawByFingerprint.get(attempt.call_fingerprint);
      if (attempt.call_fingerprint !== expectedCallFingerprint
        || !reserveEvent || !terminalEvent
        || reserveEvent.case_id !== dailyCase.case_id
        || reserveEvent.candidate_id !== expectedCandidateId
        || reserveEvent.stage !== "daily_journal"
        || reserveEvent.model !== "deepseek-v4-flash"
        || reserveEvent.attempt !== attempt.attempt) {
        fail("GI088_EXTENSION_DAILY_CALL_BINDING_INVALID");
      }
      if (attempt.outcome === "valid_response") {
        if (!raw
          || terminalEvent.event !== "call_completed"
          || raw.case_id !== dailyCase.case_id
          || raw.candidate_id !== expectedCandidateId
          || raw.attempt !== attempt.attempt
          || sha256Text(raw.content) !== raw.sha256
          || raw.sha256 !== attempt.raw_response_sha256
          || terminalEvent.raw_response_sha256 !== raw.sha256) {
          fail("GI088_EXTENSION_DAILY_RAW_RESPONSE_INVALID");
        }
        finalRaw = raw;
        finalAttempt = attempt;
      } else if (raw || terminalEvent.event !== "call_failed") {
        fail("GI088_EXTENSION_DAILY_TECHNICAL_ATTEMPT_INVALID");
      }
    }
    if (finalRaw && finalAttempt) {
      const assessment = assessGi088FlashDailyContextV3Output({
        content: finalRaw.content,
        finishReason: finalAttempt.finish_reason,
        responseModel: finalAttempt.response_model,
        reasoningPresent: finalAttempt.reasoning_present,
        reasoningTokens: finalAttempt.reasoning_tokens,
        sourceRecord: record,
        invalidatedPhrases: source.invalidatedUnderstandingSummaries
      });
      const expectedParagraphs = assessment.paragraphs.map((paragraph, index) => ({
        paragraph_id: `${expectedCandidateId}:p${index + 1}`,
        text: paragraph.text,
        source_refs: [...confirmation.approvedRecordCard.source_refs],
        record_card_refs: paragraph.sourceRecordIds
      }));
      if (canonicalJson(dailyCase.candidate.paragraphs) !== canonicalJson(expectedParagraphs)
        || dailyCase.candidate.program_check.admitted !== assessment.accepted
        || dailyCase.candidate.trace.raw_response_sha256 !== finalRaw.sha256
        || dailyCase.candidate.trace.response_model !== finalAttempt.response_model
        || dailyCase.candidate.trace.reasoning_present !== finalAttempt.reasoning_present
        || dailyCase.candidate.trace.reasoning_tokens !== finalAttempt.reasoning_tokens
        || dailyCase.candidate.trace.finish_reason !== finalAttempt.finish_reason) {
        fail("GI088_EXTENSION_DAILY_RAW_PROJECTION_INVALID");
      }
    } else if (dailyCase.candidate.paragraphs.length > 0
      || dailyCase.candidate.program_check.admitted
      || dailyCase.candidate.trace.raw_response_sha256) {
      fail("GI088_EXTENSION_DAILY_TECHNICAL_PROJECTION_INVALID");
    }
  }
  const expectedExecution = executionFingerprint({
    scopeFingerprint: resultPackage.scope_fingerprint,
    actualCalls: resultPackage.run.actual_model_calls,
    providerPreflight: resultPackage.provider_preflight,
    providerAdapter: resultPackage.runtime.provider_adapter,
    cases: resultPackage.cases,
    rawResponses: resultPackage.raw_responses
  });
  if (expectedExecution !== resultPackage.execution_fingerprint
    || resultPackage.run.technical_retries !== retryCount
    || resultPackage.run.quality_retries !== 0
    || resultPackage.run.completed_cases
      !== resultPackage.cases.filter((item) => item.candidate.paragraphs.length > 0).length
    || resultPackage.run.admitted_cases
      !== resultPackage.cases.filter((item) => item.candidate.program_check.admitted).length
    || manifest.calls.nominal !== 6
    || manifest.calls.maximum !== 12
    || manifest.calls.actual !== resultPackage.run.actual_model_calls) {
    fail("GI088_EXTENSION_DAILY_EXECUTION_INVALID");
  }
  return {
    directory,
    package: resultPackage,
    manifest,
    runLock,
    ledger,
    confirmations,
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
  if (!value || value.startsWith("--")) fail("GI088_EXTENSION_DAILY_ARGUMENT_VALUE_REQUIRED");
  return { value, consumed: 1 };
}

export function parseGi088ExtensionDailyArgs(argv: string[]): Gi088ExtensionDailyOptions {
  const options: Gi088ExtensionDailyOptions = {
    mode: "dry-run",
    confirmPrivateReplay: false,
    confirmScopeFingerprint: null,
    confirmParentFingerprint: null,
    maxCalls: MAX_CALLS,
    maxCallsExplicit: false,
    runId: null,
    parentDirectory: null,
    sourceMode: "legacy_extension"
  };
  let modeSet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute-mock" || argument === "--execute-real") {
      if (modeSet) fail("GI088_EXTENSION_DAILY_MODE_DUPLICATE");
      options.mode = argument === "--execute-real" ? "real" : "mock";
      modeSet = true;
    } else if (argument === "--confirm-private-replay") {
      options.confirmPrivateReplay = true;
    } else if (argument === "--confirm-scope" || argument.startsWith("--confirm-scope=")) {
      const parsed = argumentValue(argv, index, "--confirm-scope");
      options.confirmScopeFingerprint = parsed.value;
      index += parsed.consumed;
    } else if (argument === "--confirm-parent" || argument.startsWith("--confirm-parent=")) {
      const parsed = argumentValue(argv, index, "--confirm-parent");
      options.confirmParentFingerprint = parsed.value;
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
    } else if (argument === "--parent-directory" || argument.startsWith("--parent-directory=")) {
      const parsed = argumentValue(argv, index, "--parent-directory");
      options.parentDirectory = parsed.value;
      index += parsed.consumed;
    } else if (argument === "--record-card-v3-parent") {
      options.sourceMode = "record_card_v3";
    } else {
      fail(`GI088_EXTENSION_DAILY_ARGUMENT_INVALID:${argument}`);
    }
  }
  if (!Number.isInteger(options.maxCalls) || options.maxCalls !== MAX_CALLS) {
    fail("GI088_EXTENSION_DAILY_MAX_CALLS_MUST_EQUAL_12");
  }
  if (options.runId && !/^[a-z0-9][a-z0-9-]{2,90}$/u.test(options.runId)) {
    fail("GI088_EXTENSION_DAILY_RUN_ID_INVALID");
  }
  if (options.mode === "real" && (!options.confirmPrivateReplay
    || !options.maxCallsExplicit
    || !options.confirmScopeFingerprint
    || !options.confirmParentFingerprint)) {
    fail("GI088_EXTENSION_DAILY_EXACT_CONFIRMATION_REQUIRED");
  }
  return options;
}

export function safeGi088ExtensionDailyErrorCode(error: unknown) {
  if (error instanceof Gi088ExtensionDailyError) return error.code;
  return safeGi088CalibrationErrorCode(error);
}

export async function mainGi088ExtensionDailyCli() {
  const options = parseGi088ExtensionDailyArgs(process.argv.slice(2));
  const result = await runGi088HumanExtensionDaily(options);
  if ("plan" in result) {
    process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    status: "committed",
    mode: result.package.mode,
    scope_fingerprint: result.scopeFingerprint,
    parent_confirmation_fingerprint: result.package.parent.confirmation_set_sha256,
    execution_fingerprint: result.package.execution_fingerprint,
    actual_model_calls: result.package.run.actual_model_calls,
    admitted_cases: result.package.run.admitted_cases,
    output_directory: relative(process.cwd(), result.outputDirectory)
  }, null, 2)}\n`);
}
