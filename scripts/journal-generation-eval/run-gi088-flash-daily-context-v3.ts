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
  assessJournalDailyWriterOutput,
  formatJournalDailyDateTitle
} from "@/server/services/journal-daily-entry/journal-daily-entry-generation.service";
import {
  buildJournalDailyWriterPrompt,
  JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION,
  JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
  JOURNAL_DAILY_WRITER_PROMPT_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_HASH,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
} from "@/server/services/journal-daily-entry/prompt";
import type {
  JournalDailySourceRecord,
  JournalDailyWriterInput
} from "@/server/services/journal-daily-entry/contract";

import {
  GI088_JOURNAL_CALIBRATION_CASES,
  GI088_JOURNAL_CALIBRATION_MODELS,
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
  loadGi088CalibrationSources,
  type LoadedGi088CalibrationCase
} from "./gi088-calibration-runner";
import {
  resolveGi088CalibrationCredential,
  safeGi088CalibrationErrorCode,
  type Gi088CalibrationCredential
} from "./run-gi088-calibration";
import { sha256File } from "./private-export-importer";
import type {
  Gi088FlashDailyRevisionCase,
  Gi088FlashDailyRevisionPackage
} from "./run-gi088-flash-daily-revision";

const PRIVATE_ROOT_RELATIVE = "artifacts/journal-generation-evaluation/.private" as const;
const FORMAL_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/formal` as const;
const PARENT_RELATIVE = `${FORMAL_RELATIVE}/rounds/flash-daily-prompt-v2-c747dc76` as const;
const ROUND_ROOT_RELATIVE = `${FORMAL_RELATIVE}/rounds` as const;
const MOCK_ROOT_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/round3-mock` as const;
const ROUND_VERSION = "2026-08-11.gi088-flash-daily-context-v3" as const;
const ROUND_ID = "flash-daily-context-v3" as const;
const MAX_CALLS = 6 as const;
const NOMINAL_CALLS = 3 as const;
export const GI088_FLASH_DAILY_CONTEXT_V3_REAL_PROVIDER_ADAPTER =
  "deepseek_official_openai_compatible" as const;
const FLASH_MODEL = GI088_JOURNAL_CALIBRATION_MODELS.find(
  (candidate) => candidate.model === "deepseek-v4-flash"
)!;

export const GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME = Object.freeze({
  provider: "openai_compatible_rest",
  baseUrl: "https://api.deepseek.com",
  temperature: 0.2,
  thinking: "disabled",
  responseFormat: "json_object",
  headersTimeoutMs: 15_000,
  bodyIdleTimeoutMs: 45_000,
  hardTimeoutMs: 60_000,
  maxTokensPolicy: "provider_default",
  maxTechnicalRetriesPerStage: 1,
  qualityRetries: 0
} satisfies typeof GI088_JOURNAL_CALIBRATION_RUNTIME);

export function assertGi088FlashDailyContextV3Runtime(
  runtime: typeof GI088_JOURNAL_CALIBRATION_RUNTIME = GI088_JOURNAL_CALIBRATION_RUNTIME
) {
  if (canonicalJson(runtime) !== canonicalJson(GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME)) {
    fail("GI088_FLASH_DAILY_V3_RUNTIME_CONTRACT_MISMATCH");
  }
}

const ROUND_IMPLEMENTATION_FILES = [
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "tsconfig.json",
  "vitest.config.ts",
  "scripts/journal-generation-eval/gi088-calibration-contract.ts",
  "scripts/journal-generation-eval/gi088-calibration-provider.ts",
  "scripts/journal-generation-eval/gi088-calibration-runner.ts",
  "scripts/journal-generation-eval/private-export-importer.ts",
  "scripts/journal-generation-eval/run-gi088-calibration.ts",
  "scripts/journal-generation-eval/run-gi088-flash-daily-context-v3.ts",
  "scripts/journal-generation-eval/run-gi088-flash-daily-context-v3-cli.ts",
  "src/features/ai-quality/prompt-manifest.ts",
  "src/server/services/ai/ai-provider.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/journal-daily-entry/contract.ts",
  "src/server/services/journal-daily-entry/prompt.ts",
  "src/server/services/journal-daily-entry/journal-daily-entry-generation.service.ts",
  "src/types/journal-daily-entry.ts"
] as const;

const ROUND_IMPLEMENTATION_DIRECTORIES = [
  "scripts/journal-generation-eval",
  "src"
] as const;

export interface Gi088FlashDailyContextV3ParentCommitManifest {
  schema_version: "1.0";
  status: "committed";
  round_id: "flash-daily-prompt-v2";
  scope_fingerprint: string;
  execution_fingerprint: string;
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
}

export interface Gi088FlashDailyContextV3ParentRunLock {
  status: "completed";
  mode: "real";
  scope_fingerprint: string;
  execution_fingerprint: string;
  package_sha256: string;
  actual_model_calls: number;
}

export interface Gi088FlashDailyContextV3ParentReviewEvent {
  schema_version?: string;
  event_type?: string;
  round_id?: string;
  case_id?: string;
  presentation_id?: string;
  reviewer_id?: string;
  overall_verdict?: string;
  comparison_verdict?: string;
  issue_tags?: string[];
  scores?: Record<string, number>;
  note?: string;
  note_additions?: Array<{ note: string; added_at: string }>;
  reviewed_at?: string;
  added_at?: string;
}

export interface Gi088FlashDailyContextV3ParentArtifacts {
  package_sha256: string;
  manifest_sha256: string;
  reviews_sha256: string;
  review_drafts_sha256: string;
}

export interface Gi088FlashDailyContextV3ParentTransitiveArtifacts {
  attempt_ledger_sha256: string;
  run_lock_sha256: string;
}

export const GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_ARTIFACTS = Object.freeze({
  package_sha256: "9008f6daea9eaa8e1c7fef6580e401db8dcbe8bb5edd93e7448711bb78023c83",
  manifest_sha256: "fd9c14be55d6206ecf426a55f27878e2b72ccc68d7d7593581defe40cfcec21d",
  reviews_sha256: "5ec2586cf2bed0dac1f88d61d7ebe7d9947fcfb783990bc23b3a188810108587",
  review_drafts_sha256: "25de19ba7da4b164151e697f380063a0bdfc1154caa320beeaa80d227a8415b7"
} satisfies Gi088FlashDailyContextV3ParentArtifacts);

export const GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_TRANSITIVE_ARTIFACTS = Object.freeze({
  attempt_ledger_sha256: "f936baee2e5d008c14f989cd30c0148909f05b7ed941bb3d878241ab26e63383",
  run_lock_sha256: "638e95416650e4e20f618bc2c281d656e3c06f3fbaf0f8db0e804971251580a8"
} satisfies Gi088FlashDailyContextV3ParentTransitiveArtifacts);

export interface Gi088FlashDailyWritingMaterialV3 {
  eventText: string;
  supportedInsights: string[];
  questionContext: Array<{
    answerSourceMessageId: string;
    question: string;
  }>;
  basedOnContentRevision: number;
}

interface ParentTarget {
  caseId: string;
  sourceGroupId: string;
  sourceFileSha256: string;
  sourceProjectionSha256: string;
  entryDate: string;
  parentCandidateId: string;
  parentCandidateExecutionFingerprint: string;
  recordCard: Gi088CalibrationRecordCard;
  recordCardSha256: string;
  oldTitle: string;
  oldParagraphs: Gi088FlashDailyRevisionCase["candidate"]["paragraphs"];
  oldReview: {
    presentation_id: string;
    overall_verdict: string;
    scores: {
      fidelity_completeness: number;
      structure_coherence: number;
      language_naturalness: number;
      insight_integration: number;
    };
    issue_tags: string[];
    note: string;
    note_additions: Array<{ note: string; added_at: string }>;
    reviewed_at: string;
    comparison_verdict: string;
    comparison_note: string;
  };
  writingMaterial: Gi088FlashDailyWritingMaterialV3;
  writingMaterialSha256: string;
  writingMaterialRevisionBindingSha256: string;
  invalidatedUnderstandingSummaries: string[];
  invalidatedUnderstandingSummariesSha256: string;
}

interface ParentBundle {
  package: Gi088FlashDailyRevisionPackage;
  manifest: Gi088FlashDailyContextV3ParentCommitManifest;
  reviewEvents: Gi088FlashDailyContextV3ParentReviewEvent[];
  artifacts: Gi088FlashDailyContextV3ParentArtifacts;
  transitiveArtifacts: Gi088FlashDailyContextV3ParentTransitiveArtifacts;
  targets: ParentTarget[];
}

export interface Gi088FlashDailyContextV3Failure {
  code: string;
  message: string;
  refs: string[];
  severity: "P0" | "technical";
}

export interface Gi088FlashDailyContextV3Case {
  case_id: string;
  source_group_id: string;
  source_file_sha256: string;
  source_projection_sha256: string;
  parent_candidate_id: string;
  parent_candidate_execution_fingerprint: string;
  record_card_sha256: string;
  record_card: Gi088CalibrationRecordCard;
  writing_material_sha256: string;
  writing_material_revision_binding_sha256: string;
  writing_material_based_on_content_revision: number;
  writing_material_supported_insight_count: number;
  writing_material_question_context_count: number;
  invalidated_understanding_summary_count: number;
  invalidated_understanding_summaries_sha256: string;
  parent_review: ParentTarget["oldReview"];
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
      failures: Gi088FlashDailyContextV3Failure[];
      checks: Array<{ check: string; passed: boolean; issues: string[] }>;
      diagnostics: string[];
      invalidation_control: {
        input_boundary: "sealed_current_record_card";
        correction_evidence: "private_source_projection_bound";
        semantic_output_check: "deterministic_phrase_check_plus_human_review";
      };
    };
    trace: {
      prompt_hash: string;
      attempts: Gi088CalibrationAttemptTrace[];
      technical_retry_count: number;
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

export interface Gi088FlashDailyContextV3ProviderPreflight {
  performed_at: string;
  required_model: "deepseek-v4-flash";
  required_model_available: true;
  available_model_ids_sha256: string;
  credential_source: Gi088CalibrationCredential["source"];
}

export interface Gi088FlashDailyContextV3PriorZeroCallFailure {
  run_id: string;
  lock_sha256: string;
  attempt_ledger_sha256: string | null;
}

export function gi088FlashDailyContextV3ProviderPreflightFingerprintPayload(
  preflight: Gi088FlashDailyContextV3ProviderPreflight | null
) {
  if (!preflight) return null;
  return {
    required_model: preflight.required_model,
    required_model_available: preflight.required_model_available,
    available_model_ids_sha256: preflight.available_model_ids_sha256,
    credential_source: preflight.credential_source
  };
}

export interface Gi088FlashDailyContextV3Package {
  schema_version: "1.0";
  privacy_classification: "private_local_only";
  round_version: typeof ROUND_VERSION;
  round_id: typeof ROUND_ID;
  generated_at: string;
  mode: "mock" | "real";
  scope_fingerprint: string;
  execution_fingerprint: string;
  prior_zero_call_failures: Gi088FlashDailyContextV3PriorZeroCallFailure[];
  parent: {
    execution_fingerprint: string;
    candidate_set_id: string;
    artifacts: Gi088FlashDailyContextV3ParentArtifacts;
    transitive_artifacts: Gi088FlashDailyContextV3ParentTransitiveArtifacts;
  };
  prompt: {
    version: string;
    system_prompt_sha256: string;
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
  budget: {
    case_count: 3;
    nominal_model_calls: 3;
    max_model_calls: 6;
  };
  run: {
    actual_model_calls: number;
    technical_retries: number;
    quality_retries: 0;
    completed_cases: number;
    admitted_cases: number;
  };
  code_snapshot: Array<{ path: string; sha256: string }>;
  provider_preflight: Gi088FlashDailyContextV3ProviderPreflight | null;
  cases: Gi088FlashDailyContextV3Case[];
  raw_responses: Array<{
    call_fingerprint: string;
    case_id: string;
    candidate_id: string;
    attempt: 1 | 2;
    sha256: string;
    content: string;
  }>;
}

export function createGi088FlashDailyContextV3ExecutionFingerprint(input: {
  scopeFingerprint: string;
  actualCalls: number;
  providerPreflight: Gi088FlashDailyContextV3ProviderPreflight | null;
  cases: Gi088FlashDailyContextV3Case[];
  rawResponses: Gi088FlashDailyContextV3Package["raw_responses"];
  providerAdapter: string;
}) {
  return sha256Canonical({
    scopeFingerprint: input.scopeFingerprint,
    actualCalls: input.actualCalls,
    providerPreflight: gi088FlashDailyContextV3ProviderPreflightFingerprintPayload(
      input.providerPreflight
    ),
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

export interface Gi088FlashDailyContextV3Options {
  mode: "dry-run" | "mock" | "real";
  confirmPrivateReplay: boolean;
  confirmScopeFingerprint: string | null;
  confirmParentExecutionFingerprint: string | null;
  maxCalls: number;
  maxCallsExplicit: boolean;
  runId: string | null;
}

export interface Gi088FlashDailyContextV3Dependencies {
  resolveCredential: typeof resolveGi088CalibrationCredential;
  createRealProvider: (input: { apiKey: string; baseUrl: string }) => Gi088CalibrationProvider;
  createMockProvider: () => Gi088CalibrationProvider;
  fetcher: typeof fetch;
  now: () => Date;
  appendLedger: typeof appendGi088FlashDailyContextV3Ledger;
  loadPriorZeroCallFailures: typeof loadGi088FlashDailyContextV3PriorZeroCallFailures;
}

export class Gi088FlashDailyContextV3Error extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Gi088FlashDailyContextV3Error";
  }
}

export function assertGi088FlashDailyContextV3ProviderIdentity(
  mode: "mock" | "real",
  provider: Gi088CalibrationProvider
) {
  if (mode === "real") {
    if (provider.kind !== "real"
      || provider.name !== GI088_FLASH_DAILY_CONTEXT_V3_REAL_PROVIDER_ADAPTER) {
      fail("GI088_FLASH_DAILY_V3_REAL_PROVIDER_IDENTITY_MISMATCH");
    }
    return;
  }
  if (provider.kind !== "mock" || !provider.name.trim()) {
    fail("GI088_FLASH_DAILY_V3_MOCK_PROVIDER_IDENTITY_MISMATCH");
  }
}

function fail(code: string): never {
  throw new Gi088FlashDailyContextV3Error(code);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson<T>(path: string, errorCode: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    fail(errorCode);
  }
}

async function readNdjson(path: string, errorCode: string) {
  try {
    return (await readFile(path, "utf8")).split(/\r?\n/u).flatMap((line) => {
      if (!line.trim()) return [];
      try {
        return [JSON.parse(line) as Gi088FlashDailyContextV3ParentReviewEvent];
      } catch {
        fail(errorCode);
      }
    });
  } catch (error) {
    if (error instanceof Gi088FlashDailyContextV3Error) throw error;
    fail(errorCode);
  }
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
  const question = normalized.slice(lastBoundary + 1).trim();
  return question || null;
}

export function buildGi088FlashDailyWritingMaterialV3(input: {
  recordCard: Gi088CalibrationRecordCard;
  source: LoadedGi088CalibrationCase;
}): Gi088FlashDailyWritingMaterialV3 {
  const answerSourceIds = new Set(input.recordCard.source_refs.flatMap((ref) => {
    const id = sourceMessageId(ref);
    return id ? [id] : [];
  }));
  for (const understanding of input.source.projection.validUnderstandings) {
    if (!input.recordCard.source_refs.includes(understanding.ref)) continue;
    for (const evidenceRef of understanding.evidenceRefs) {
      const id = sourceMessageId(evidenceRef);
      if (id) answerSourceIds.add(id);
    }
  }
  const questionContext: Gi088FlashDailyWritingMaterialV3["questionContext"] = [];
  let pendingQuestion: string | null = null;
  for (const message of input.source.projection.transcript) {
    if (message.role === "assistant") {
      // Only the nearest assistant question may provide context for the next user turn.
      pendingQuestion = lastAssistantQuestion(message.content);
      continue;
    }
    if (message.role !== "user") continue;
    const question = pendingQuestion;
    pendingQuestion = null;
    if (!question) continue;
    const answerSourceMessageId = sourceMessageId(message.ref);
    if (!answerSourceMessageId || !answerSourceIds.has(answerSourceMessageId)) continue;
    if (questionContext.some((item) =>
      item.answerSourceMessageId === answerSourceMessageId && item.question === question
    )) continue;
    questionContext.push({ answerSourceMessageId, question });
  }
  const supportedInsights = input.recordCard.insight.split(/\n{2,}/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const material = {
    eventText: input.recordCard.text.trim(),
    supportedInsights,
    questionContext,
    basedOnContentRevision: 1
  };
  if (!material.eventText
    || material.supportedInsights.length === 0
    || material.questionContext.length === 0
    || material.questionContext.some((item) => !answerSourceIds.has(item.answerSourceMessageId))) {
    fail("GI088_FLASH_DAILY_V3_WRITING_MATERIAL_INVALID");
  }
  return material;
}

export function assertGi088FlashDailyContextV3LockedParentArtifacts(
  actual: Gi088FlashDailyContextV3ParentArtifacts
) {
  if (canonicalJson(actual) !== canonicalJson(GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_ARTIFACTS)) {
    fail("GI088_FLASH_DAILY_V3_LOCKED_PARENT_ARTIFACT_MISMATCH");
  }
}

export function assertGi088FlashDailyContextV3LockedParentTransitiveArtifacts(
  actual: Gi088FlashDailyContextV3ParentTransitiveArtifacts
) {
  if (canonicalJson(actual)
    !== canonicalJson(GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_TRANSITIVE_ARTIFACTS)) {
    fail("GI088_FLASH_DAILY_V3_LOCKED_PARENT_TRANSITIVE_ARTIFACT_MISMATCH");
  }
}

export function assertGi088FlashDailyContextV3ParentSeal(input: {
  candidatePackage: Gi088FlashDailyRevisionPackage;
  manifest: Gi088FlashDailyContextV3ParentCommitManifest;
  runLock: Gi088FlashDailyContextV3ParentRunLock;
  attemptLedgerSha: string;
  runLockSha: string;
  packageSha: string;
}) {
  assertGi088FlashDailyContextV3LockedParentTransitiveArtifacts({
    attempt_ledger_sha256: input.attemptLedgerSha,
    run_lock_sha256: input.runLockSha
  });
  if (input.manifest.status !== "committed"
    || input.manifest.round_id !== "flash-daily-prompt-v2"
    || input.manifest.files.package !== "round-package.json"
    || input.manifest.files.attempt_ledger !== "attempt-ledger.ndjson"
    || input.manifest.files.run_lock !== "round-run.lock.json"
    || input.manifest.child_artifacts.package_sha256 !== input.packageSha
    || input.manifest.child_artifacts.attempt_ledger_sha256 !== input.attemptLedgerSha
    || input.manifest.child_artifacts.run_lock_sha256 !== input.runLockSha
    || input.runLock.status !== "completed"
    || input.runLock.mode !== "real"
    || input.runLock.package_sha256 !== input.packageSha
    || input.runLock.execution_fingerprint !== input.candidatePackage.execution_fingerprint
    || input.runLock.scope_fingerprint !== input.candidatePackage.scope_fingerprint
    || input.runLock.actual_model_calls !== input.candidatePackage.run.actual_model_calls
    || input.candidatePackage.schema_version !== "1.0"
    || input.candidatePackage.privacy_classification !== "private_local_only"
    || input.candidatePackage.round_id !== "flash-daily-prompt-v2"
    || input.candidatePackage.mode !== "real"
    || input.candidatePackage.runtime.model !== FLASH_MODEL.model
    || input.candidatePackage.prompt.version !== JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION
    || input.candidatePackage.prompt.system_prompt_sha256 !== JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH
    || input.candidatePackage.runtime.thinking !== "disabled"
    || input.candidatePackage.runtime.temperature !== 0.2
    || input.candidatePackage.runtime.quality_retries !== 0
    || input.candidatePackage.budget.case_count !== 3
    || input.candidatePackage.budget.nominal_model_calls !== 3
    || input.candidatePackage.budget.max_model_calls !== 6
    || input.candidatePackage.run.quality_retries !== 0
    || input.candidatePackage.run.admitted_cases !== 3
    || input.candidatePackage.run.actual_model_calls < 3
    || input.candidatePackage.cases.length !== 3
    || input.candidatePackage.cases.some((item) => !item.candidate.program_check.admitted)
    || input.candidatePackage.execution_fingerprint !== input.manifest.execution_fingerprint
    || input.candidatePackage.scope_fingerprint !== input.manifest.scope_fingerprint) {
    fail("GI088_FLASH_DAILY_V3_PARENT_INVALID");
  }
}

export function selectGi088FlashDailyContextV3ParentReview(input: {
  reviewEvents: Gi088FlashDailyContextV3ParentReviewEvent[];
  caseId: string;
}) {
  const reviews = input.reviewEvents.filter((event) => event.schema_version === "1.0"
    && event.round_id === "flash-daily-prompt-v2"
    && event.event_type === "round_decision"
    && event.case_id === input.caseId);
  if (reviews.length !== 1) fail("GI088_FLASH_DAILY_V3_PARENT_REVIEW_IDENTITY_INVALID");
  const review = reviews[0];
  if (typeof review.presentation_id !== "string" || typeof review.reviewer_id !== "string") {
    fail("GI088_FLASH_DAILY_V3_PARENT_REVIEW_IDENTITY_INVALID");
  }
  const comparisons = input.reviewEvents.filter((event) => event.schema_version === "1.0"
    && event.round_id === "flash-daily-prompt-v2"
    && event.event_type === "comparison_decision"
    && event.case_id === input.caseId
    && event.presentation_id === review.presentation_id
    && event.reviewer_id === review.reviewer_id);
  if (comparisons.length !== 1) fail("GI088_FLASH_DAILY_V3_PARENT_COMPARISON_IDENTITY_MISMATCH");
  return { review, comparison: comparisons[0] };
}

function validateParentPackage(input: {
  candidatePackage: Gi088FlashDailyRevisionPackage;
  manifest: Gi088FlashDailyContextV3ParentCommitManifest;
  runLock: Gi088FlashDailyContextV3ParentRunLock;
  attemptLedgerSha: string;
  runLockSha: string;
  packageSha: string;
  reviewEvents: Gi088FlashDailyContextV3ParentReviewEvent[];
}) {
  assertGi088FlashDailyContextV3ParentSeal(input);
  const caseIds = input.candidatePackage.cases.map((item) => item.case_id);
  const expectedCaseIds = GI088_JOURNAL_CALIBRATION_CASES.map((item) => item.caseId);
  const decisions = input.reviewEvents.filter((event) =>
    event.schema_version === "1.0"
    && event.round_id === "flash-daily-prompt-v2"
    && event.event_type === "round_decision"
  );
  const comparisons = input.reviewEvents.filter((event) =>
    event.schema_version === "1.0"
    && event.round_id === "flash-daily-prompt-v2"
    && event.event_type === "comparison_decision"
  );
  if (sha256Canonical([...caseIds].sort()) !== sha256Canonical([...expectedCaseIds].sort())
    || decisions.length !== 3
    || comparisons.length !== 3
    || [...decisions, ...comparisons].some((event) =>
      typeof event.case_id !== "string"
      || !expectedCaseIds.includes(event.case_id as (typeof expectedCaseIds)[number])
      || typeof event.presentation_id !== "string"
      || typeof event.reviewer_id !== "string"
      || typeof event.reviewed_at !== "string"
    )) {
    fail("GI088_FLASH_DAILY_V3_PARENT_INVALID");
  }
  expectedCaseIds.forEach((caseId) => {
    selectGi088FlashDailyContextV3ParentReview({ reviewEvents: input.reviewEvents, caseId });
  });
}

async function loadParentBundle(
  projectRoot: string,
  sources: LoadedGi088CalibrationCase[]
): Promise<ParentBundle> {
  const parentRoot = resolve(projectRoot, PARENT_RELATIVE);
  const paths = {
    package: resolve(parentRoot, "round-package.json"),
    manifest: resolve(parentRoot, "commit-manifest.json"),
    runLock: resolve(parentRoot, "round-run.lock.json"),
    attemptLedger: resolve(parentRoot, "attempt-ledger.ndjson"),
    reviews: resolve(parentRoot, "reviews.ndjson"),
    reviewDrafts: resolve(parentRoot, "review-drafts.ndjson")
  };
  const [candidatePackage, manifest, runLock, reviewEvents, packageSha, manifestSha,
    attemptLedgerSha, runLockSha, reviewsSha, reviewDraftsSha] = await Promise.all([
    readJson<Gi088FlashDailyRevisionPackage>(paths.package, "GI088_FLASH_DAILY_V3_PARENT_PACKAGE_UNREADABLE"),
    readJson<Gi088FlashDailyContextV3ParentCommitManifest>(
      paths.manifest,
      "GI088_FLASH_DAILY_V3_PARENT_MANIFEST_UNREADABLE"
    ),
    readJson<Gi088FlashDailyContextV3ParentRunLock>(
      paths.runLock,
      "GI088_FLASH_DAILY_V3_PARENT_LOCK_UNREADABLE"
    ),
    readNdjson(paths.reviews, "GI088_FLASH_DAILY_V3_PARENT_REVIEWS_UNREADABLE"),
    sha256File(paths.package),
    sha256File(paths.manifest),
    sha256File(paths.attemptLedger),
    sha256File(paths.runLock),
    sha256File(paths.reviews),
    sha256File(paths.reviewDrafts)
  ]);
  const artifacts = {
    package_sha256: packageSha,
    manifest_sha256: manifestSha,
    reviews_sha256: reviewsSha,
    review_drafts_sha256: reviewDraftsSha
  };
  const transitiveArtifacts = {
    attempt_ledger_sha256: attemptLedgerSha,
    run_lock_sha256: runLockSha
  };
  assertGi088FlashDailyContextV3LockedParentArtifacts(artifacts);
  assertGi088FlashDailyContextV3LockedParentTransitiveArtifacts(transitiveArtifacts);
  validateParentPackage({
    candidatePackage,
    manifest,
    runLock,
    attemptLedgerSha,
    runLockSha,
    packageSha,
    reviewEvents
  });
  const targets = GI088_JOURNAL_CALIBRATION_CASES.map((selection) => {
    const parentCase = candidatePackage.cases.find((item) => item.case_id === selection.caseId);
    const source = sources.find((item) => item.selection.caseId === selection.caseId);
    if (!parentCase || !source
      || parentCase.source_file_sha256 !== source.sourceFileSha256
      || parentCase.source_projection_sha256 !== source.sourceProjectionSha256) {
      fail("GI088_FLASH_DAILY_V3_CASE_MISSING");
    }
    const recordCard = parentCase.record_card;
    if (!recordCard || parentCase.record_card_sha256 !== sha256Canonical(recordCard)) {
      fail("GI088_FLASH_DAILY_V3_APPROVED_RECORD_CARD_MISSING");
    }
    if (!recordCard.text.trim()) fail("GI088_FLASH_DAILY_V3_APPROVED_RECORD_CARD_EMPTY");
    const { review, comparison } = selectGi088FlashDailyContextV3ParentReview({
      reviewEvents,
      caseId: parentCase.case_id
    });
    if (!review || !comparison || typeof review.overall_verdict !== "string"
      || typeof comparison.comparison_verdict !== "string"
      || typeof review.presentation_id !== "string"
      || typeof review.reviewed_at !== "string"
      || !isObject(review.scores)
      || !Array.isArray(review.issue_tags)) {
      fail("GI088_FLASH_DAILY_V3_PARENT_REVIEW_NOT_APPROVED");
    }
    const scores = review.scores;
    const scoreKeys = [
      "fidelity_completeness",
      "structure_coherence",
      "language_naturalness",
      "insight_integration"
    ] as const;
    if (scoreKeys.some((key) => !Number.isInteger(scores[key])
      || Number(scores[key]) < 1 || Number(scores[key]) > 5)) {
      fail("GI088_FLASH_DAILY_V3_PARENT_REVIEW_NOT_APPROVED");
    }
    const noteAdditions = [
      ...(review.note_additions ?? []).filter((item) =>
        typeof item.note === "string" && typeof item.added_at === "string"
      ),
      ...reviewEvents.filter((event) =>
      event.schema_version === "1.0"
      && event.round_id === "flash-daily-prompt-v2"
      && event.event_type === "round_note_added"
      && event.case_id === parentCase.case_id
      && event.presentation_id === review.presentation_id
      && event.reviewer_id === review.reviewer_id
      && typeof event.note === "string"
      && typeof event.added_at === "string"
      ).map((event) => ({ note: event.note!, added_at: event.added_at! }))
    ];
    const writingMaterial = buildGi088FlashDailyWritingMaterialV3({ recordCard, source });
    const recordCardSha256 = sha256Canonical(recordCard);
    const writingMaterialSha256 = sha256Canonical(writingMaterial);
    const writingMaterialRevisionBindingSha256 = sha256Canonical({
      recordCardSha256,
      basedOnContentRevision: writingMaterial.basedOnContentRevision,
      writingMaterialSha256
    });
    return {
      caseId: parentCase.case_id,
      sourceGroupId: parentCase.source_group_id,
      sourceFileSha256: parentCase.source_file_sha256,
      sourceProjectionSha256: parentCase.source_projection_sha256,
      entryDate: selection.entryDate,
      parentCandidateId: parentCase.candidate.candidate_id,
      parentCandidateExecutionFingerprint: sha256Canonical({
        parentExecutionFingerprint: candidatePackage.execution_fingerprint,
        candidate: parentCase.candidate
      }),
      recordCard,
      recordCardSha256,
      oldTitle: parentCase.candidate.title,
      oldParagraphs: parentCase.candidate.paragraphs,
      oldReview: {
        presentation_id: review.presentation_id,
        overall_verdict: review.overall_verdict,
        scores: {
          fidelity_completeness: Number(scores.fidelity_completeness),
          structure_coherence: Number(scores.structure_coherence),
          language_naturalness: Number(scores.language_naturalness),
          insight_integration: Number(scores.insight_integration)
        },
        issue_tags: review.issue_tags.filter((item): item is string => typeof item === "string"),
        note: review.note ?? "",
        note_additions: noteAdditions,
        reviewed_at: review.reviewed_at,
        comparison_verdict: comparison.comparison_verdict,
        comparison_note: comparison.note ?? ""
      },
      writingMaterial,
      writingMaterialSha256,
      writingMaterialRevisionBindingSha256,
      invalidatedUnderstandingSummaries: source.invalidatedUnderstandingSummaries,
      invalidatedUnderstandingSummariesSha256: sha256Canonical(
        source.invalidatedUnderstandingSummaries
      )
    } satisfies ParentTarget;
  });
  return {
    package: candidatePackage,
    manifest,
    reviewEvents,
    artifacts,
    transitiveArtifacts,
    targets
  };
}

async function assertParentUnchanged(projectRoot: string, expected: Gi088FlashDailyContextV3ParentArtifacts) {
  const parentRoot = resolve(projectRoot, PARENT_RELATIVE);
  const paths = {
    package: resolve(parentRoot, "round-package.json"),
    manifest: resolve(parentRoot, "commit-manifest.json"),
    runLock: resolve(parentRoot, "round-run.lock.json"),
    attemptLedger: resolve(parentRoot, "attempt-ledger.ndjson"),
    reviews: resolve(parentRoot, "reviews.ndjson"),
    reviewDrafts: resolve(parentRoot, "review-drafts.ndjson")
  };
  let contents: Record<keyof typeof paths, string>;
  try {
    const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) =>
      [key, await readFile(path, "utf8")] as const
    ));
    contents = Object.fromEntries(entries) as Record<keyof typeof paths, string>;
  } catch {
    fail("GI088_FLASH_DAILY_V3_PARENT_CHANGED");
  }
  const actual = {
    package_sha256: sha256Text(contents.package),
    manifest_sha256: sha256Text(contents.manifest),
    reviews_sha256: sha256Text(contents.reviews),
    review_drafts_sha256: sha256Text(contents.reviewDrafts)
  };
  assertGi088FlashDailyContextV3LockedParentArtifacts(expected);
  assertGi088FlashDailyContextV3LockedParentArtifacts(actual);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail("GI088_FLASH_DAILY_V3_PARENT_CHANGED");
  }
  let candidatePackage: Gi088FlashDailyRevisionPackage;
  let manifest: Gi088FlashDailyContextV3ParentCommitManifest;
  let runLock: Gi088FlashDailyContextV3ParentRunLock;
  try {
    candidatePackage = JSON.parse(contents.package) as Gi088FlashDailyRevisionPackage;
    manifest = JSON.parse(contents.manifest) as Gi088FlashDailyContextV3ParentCommitManifest;
    runLock = JSON.parse(contents.runLock) as Gi088FlashDailyContextV3ParentRunLock;
  } catch {
    fail("GI088_FLASH_DAILY_V3_PARENT_CHANGED");
  }
  assertGi088FlashDailyContextV3ParentSeal({
    candidatePackage,
    manifest,
    runLock,
    packageSha: actual.package_sha256,
    attemptLedgerSha: sha256Text(contents.attemptLedger),
    runLockSha: sha256Text(contents.runLock)
  });
}

async function loadCodeSnapshot(projectRoot: string) {
  const discovered: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(resolve(projectRoot, directory), { withFileTypes: true });
    for (const entry of entries) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile() && /\.(?:cjs|js|json|mjs|ts|tsx)$/u.test(entry.name)) {
        discovered.push(path);
      }
    }
  };
  for (const directory of ROUND_IMPLEMENTATION_DIRECTORIES) await walk(directory);
  const paths = [...new Set([...ROUND_IMPLEMENTATION_FILES, ...discovered])].sort();
  return await Promise.all(paths.map(async (path) => ({
    path,
    sha256: await sha256File(resolve(projectRoot, path))
  })));
}

type JournalDailySourceRecordV3 = JournalDailySourceRecord & {
  writingMaterial: Gi088FlashDailyWritingMaterialV3;
};

function sourceRecord(target: ParentTarget): JournalDailySourceRecordV3 {
  return {
    recordId: target.recordCard.record_card_id,
    eventId: target.recordCard.event_id,
    entryDate: target.entryDate,
    daySequence: 1,
    title: target.recordCard.title,
    content: [target.recordCard.text, target.recordCard.insight]
      .filter((item) => item.trim())
      .join("\n\n"),
    contentRevision: 1,
    updatedAt: `${target.entryDate}T12:00:00.000Z`,
    writingMaterial: target.writingMaterial
  };
}

function writerInput(target: ParentTarget, record: JournalDailySourceRecord): JournalDailyWriterInput {
  return {
    task: "generate",
    entryDate: target.entryDate,
    title: formatJournalDailyDateTitle(target.entryDate),
    sourceRecords: [record],
    currentEntry: null,
    savedRevision: null,
    updatePlan: null
  };
}

function normalizedText(value: string) {
  return value.replace(/\s+/gu, "").replace(/[，。！？、；：“”‘’'"（）()《》【】\[\]—…,.!?;:\-]/gu, "");
}

export function assessGi088FlashDailyContextV3Output(input: {
  content: string;
  finishReason: string | null;
  responseModel: string | null;
  reasoningPresent: boolean | null;
  reasoningTokens: number | null;
  sourceRecord: JournalDailySourceRecord;
  invalidatedPhrases?: string[];
}) {
  const issues: string[] = [];
  const diagnostics: string[] = [];
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(input.content) as unknown;
  } catch {
    issues.push("DAILY_JOURNAL_JSON_INVALID");
  }
  let paragraphs: ReturnType<typeof assessJournalDailyWriterOutput>["paragraphs"] = [];
  if (parsed !== null) {
    try {
      const assessed = assessJournalDailyWriterOutput({
        output: parsed,
        sourceRecords: [input.sourceRecord],
        task: "generate",
        updatePlan: null
      });
      paragraphs = assessed.paragraphs;
      issues.push(...assessed.issues);
      diagnostics.push(...assessed.diagnostics);
    } catch (error) {
      const errorIssues = isObject(error) && Array.isArray(error.issues)
        ? error.issues.filter((item): item is string => typeof item === "string")
        : [];
      issues.push("DAILY_JOURNAL_SCHEMA_INVALID", ...errorIssues);
    }
  }
  if (input.finishReason !== "stop") issues.push(`DAILY_JOURNAL_FINISH_REASON:${input.finishReason ?? "missing"}`);
  if (input.responseModel !== FLASH_MODEL.model) issues.push("DAILY_JOURNAL_RESPONSE_MODEL_MISMATCH");
  if (input.reasoningPresent !== false || (input.reasoningTokens ?? 0) > 0) {
    issues.push("DAILY_JOURNAL_THINKING_NOT_DISABLED");
  }
  const outputText = paragraphs.map((paragraph) => paragraph.text).join("\n");
  const sourceNumbers = new Set(input.sourceRecord.content.match(/\d+(?:\.\d+)?/gu) ?? []);
  const unsupportedNumbers = (outputText.match(/\d+(?:\.\d+)?/gu) ?? [])
    .filter((value) => !sourceNumbers.has(value));
  if (unsupportedNumbers.length > 0) issues.push("DAILY_JOURNAL_UNSUPPORTED_NUMBER");
  const normalizedOutput = normalizedText(outputText);
  if ((input.invalidatedPhrases ?? []).some((phrase) => {
    const normalized = normalizedText(phrase);
    return normalized.length >= 4 && normalizedOutput.includes(normalized);
  })) {
    issues.push("DAILY_JOURNAL_INVALIDATED_CONTENT_RESURRECTED");
  }
  return {
    accepted: issues.length === 0,
    issues: [...new Set(issues)],
    diagnostics: [...new Set(diagnostics)],
    paragraphs
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

export async function appendGi088FlashDailyContextV3Ledger(path: string, value: unknown) {
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

function createScope(input: {
  bundle: ParentBundle;
  codeSnapshot: Array<{ path: string; sha256: string }>;
  priorZeroCallFailures: Gi088FlashDailyContextV3PriorZeroCallFailure[];
}) {
  return {
    roundVersion: ROUND_VERSION,
    roundId: ROUND_ID,
    parentExecutionFingerprint: input.bundle.package.execution_fingerprint,
    parentCandidateSetId: input.bundle.package.parent.candidate_set_id,
    parentArtifacts: GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_ARTIFACTS,
    parentTransitiveArtifacts: GI088_FLASH_DAILY_CONTEXT_V3_LOCKED_PARENT_TRANSITIVE_ARTIFACTS,
    priorZeroCallFailures: input.priorZeroCallFailures,
    cases: input.bundle.targets.map((target) => ({
      caseId: target.caseId,
      sourceFileSha256: target.sourceFileSha256,
      sourceProjectionSha256: target.sourceProjectionSha256,
      parentCandidateId: target.parentCandidateId,
      parentCandidateExecutionFingerprint: target.parentCandidateExecutionFingerprint,
      recordCardSha256: target.recordCardSha256,
      writingMaterial: target.writingMaterial,
      writingMaterialSha256: target.writingMaterialSha256,
      writingMaterialRevisionBindingSha256: target.writingMaterialRevisionBindingSha256,
      questionContextCount: target.writingMaterial.questionContext.length,
      invalidatedUnderstandingSummaryCount: target.invalidatedUnderstandingSummaries.length,
      invalidatedUnderstandingSummariesSha256: target.invalidatedUnderstandingSummariesSha256,
      oldReviewPresentationId: target.oldReview.presentation_id
    })),
    model: FLASH_MODEL.model,
    prompt: {
      version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
      systemPromptSha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH,
      fewShotCount: 0
    },
    runtime: {
      ...GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME,
      providerAdapter: GI088_FLASH_DAILY_CONTEXT_V3_REAL_PROVIDER_ADAPTER
    },
    budget: { nominalCalls: NOMINAL_CALLS, maxCalls: MAX_CALLS },
    codeSnapshot: input.codeSnapshot
  };
}

async function validateFlashModel(input: {
  apiKey: string;
  credentialSource: Gi088CalibrationCredential["source"];
  fetcher: typeof fetch;
  now: Date;
}) {
  let response: Response;
  try {
    response = await input.fetcher(`${GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${input.apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    fail("GI088_FLASH_DAILY_V3_MODEL_PREFLIGHT_UNREACHABLE");
  }
  if (!response.ok) fail(`GI088_FLASH_DAILY_V3_MODEL_PREFLIGHT_HTTP_${response.status}`);
  const body = await response.json() as unknown;
  const ids = isObject(body) && Array.isArray(body.data)
    ? body.data.flatMap((item) => isObject(item) && typeof item.id === "string" ? [item.id] : [])
    : [];
  if (!ids.includes(FLASH_MODEL.model)) fail("GI088_FLASH_DAILY_V3_FLASH_UNAVAILABLE");
  return {
    performed_at: input.now.toISOString(),
    required_model: FLASH_MODEL.model,
    required_model_available: true as const,
    available_model_ids_sha256: sha256Canonical([...new Set(ids)].sort()),
    credential_source: input.credentialSource
  };
}

function argumentValue(argv: string[], index: number, flag: string) {
  const inline = argv[index].startsWith(`${flag}=`) ? argv[index].slice(flag.length + 1) : null;
  if (inline !== null) return { value: inline, consumed: 0 };
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail("GI088_FLASH_DAILY_V3_ARGUMENT_VALUE_REQUIRED");
  return { value, consumed: 1 };
}

export function parseGi088FlashDailyContextV3Args(argv: string[]): Gi088FlashDailyContextV3Options {
  const options: Gi088FlashDailyContextV3Options = {
    mode: "dry-run",
    confirmPrivateReplay: false,
    confirmScopeFingerprint: null,
    confirmParentExecutionFingerprint: null,
    maxCalls: MAX_CALLS,
    maxCallsExplicit: false,
    runId: null
  };
  let modeSet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute-mock" || argument === "--execute-real") {
      if (modeSet) fail("GI088_FLASH_DAILY_V3_MODE_DUPLICATE");
      options.mode = argument === "--execute-real" ? "real" : "mock";
      modeSet = true;
    } else if (argument === "--confirm-private-replay") {
      options.confirmPrivateReplay = true;
    } else if (argument === "--confirm-scope" || argument.startsWith("--confirm-scope=")) {
      const parsed = argumentValue(argv, index, "--confirm-scope");
      options.confirmScopeFingerprint = parsed.value;
      index += parsed.consumed;
    } else if (argument === "--confirm-parent-execution" || argument.startsWith("--confirm-parent-execution=")) {
      const parsed = argumentValue(argv, index, "--confirm-parent-execution");
      options.confirmParentExecutionFingerprint = parsed.value;
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
      fail(`GI088_FLASH_DAILY_V3_ARGUMENT_INVALID:${argument}`);
    }
  }
  if (!Number.isInteger(options.maxCalls) || options.maxCalls !== MAX_CALLS) {
    fail("GI088_FLASH_DAILY_V3_MAX_CALLS_MUST_EQUAL_6");
  }
  if (options.runId && !/^[a-z0-9][a-z0-9-]{2,63}$/u.test(options.runId)) {
    fail("GI088_FLASH_DAILY_V3_RUN_ID_INVALID");
  }
  if (options.mode === "real") {
    if (!options.confirmPrivateReplay) fail("GI088_FLASH_DAILY_V3_PRIVATE_REPLAY_CONFIRMATION_REQUIRED");
    if (!options.maxCallsExplicit) fail("GI088_FLASH_DAILY_V3_MAX_CALLS_CONFIRMATION_REQUIRED");
    if (!options.confirmScopeFingerprint || !options.confirmParentExecutionFingerprint) {
      fail("GI088_FLASH_DAILY_V3_EXACT_SCOPE_CONFIRMATION_REQUIRED");
    }
    if (options.runId && !options.runId.startsWith(`${ROUND_ID}-`)) {
      fail("GI088_FLASH_DAILY_V3_REAL_RUN_ID_PREFIX_REQUIRED");
    }
  }
  return options;
}

function outputRoot(projectRoot: string, mode: "mock" | "real") {
  return resolve(projectRoot, mode === "real" ? ROUND_ROOT_RELATIVE : MOCK_ROOT_RELATIVE);
}

function assertPrivateOutput(path: string, projectRoot: string) {
  const privateRoot = resolve(projectRoot, PRIVATE_ROOT_RELATIVE);
  const pathFromRoot = relative(privateRoot, path);
  if (pathFromRoot === "" || pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
    fail("GI088_FLASH_DAILY_V3_PRIVATE_OUTPUT_REQUIRED");
  }
}

export async function loadGi088FlashDailyContextV3PriorZeroCallFailures(
  root: string,
  parentExecution: string,
  excludeRunId: string | null = null
) {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    fail("GI088_FLASH_DAILY_V3_ROUND_HISTORY_UNREADABLE");
  }
  const recoverable: Gi088FlashDailyContextV3PriorZeroCallFailure[] = [];
  for (const entry of entries.sort()) {
    if (!entry.startsWith(`${ROUND_ID}-`)) continue;
    if (entry === excludeRunId) continue;
    const lockPath = resolve(root, entry, "round-run.lock.json");
    let lockContent: string;
    try {
      lockContent = await readFile(lockPath, "utf8");
    } catch {
      fail("GI088_FLASH_DAILY_V3_ROUND_HISTORY_INVALID");
    }
    let lock: Record<string, unknown>;
    try {
      lock = JSON.parse(lockContent) as Record<string, unknown>;
    } catch {
      fail("GI088_FLASH_DAILY_V3_ROUND_HISTORY_INVALID");
    }
    if (lock.mode !== "real" || lock.parent_execution_fingerprint !== parentExecution) continue;
    let attemptLedgerContent: string | null = null;
    try {
      attemptLedgerContent = await readFile(resolve(root, entry, "attempt-ledger.ndjson"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        fail("GI088_FLASH_DAILY_V3_ROUND_HISTORY_INVALID");
      }
    }
    let hasReservedCall = false;
    if (attemptLedgerContent !== null) {
      try {
        hasReservedCall = attemptLedgerContent.split(/\r?\n/u).some((line) => {
          if (!line.trim()) return false;
          const event = JSON.parse(line) as Record<string, unknown>;
          return event.event === "call_reserved";
        });
      } catch {
        fail("GI088_FLASH_DAILY_V3_ROUND_HISTORY_INVALID");
      }
    }
    const observedCalls = lock.observed_model_calls;
    if (lock.status !== "failed" || observedCalls !== 0 || hasReservedCall) {
      fail("GI088_FLASH_DAILY_V3_PRIOR_REAL_ROUND_EXISTS");
    }
    recoverable.push({
      run_id: entry,
      lock_sha256: sha256Text(lockContent),
      attempt_ledger_sha256: attemptLedgerContent === null
        ? null
        : sha256Text(attemptLedgerContent)
    });
  }
  return recoverable;
}

function candidateId(scopeFingerprint: string, target: ParentTarget) {
  return `flash-v3-${sha256Canonical({ scopeFingerprint, caseId: target.caseId }).slice(0, 20)}`;
}

async function runCase(input: {
  provider: Gi088CalibrationProvider;
  target: ParentTarget;
  scopeFingerprint: string;
  maxCalls: number;
  actualCalls: { value: number };
  ledgerPath: string;
  rawResponses: Gi088FlashDailyContextV3Package["raw_responses"];
  preCallGuard: () => Promise<void>;
  now: () => Date;
  appendLedger: typeof appendGi088FlashDailyContextV3Ledger;
}) {
  const id = candidateId(input.scopeFingerprint, input.target);
  const record = sourceRecord(input.target);
  const prompt = buildJournalDailyWriterPrompt(writerInput(input.target, record));
  if (prompt.promptVersion !== JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION) {
    fail("GI088_FLASH_DAILY_V3_PROMPT_NOT_READY");
  }
  const attempts: Gi088CalibrationAttemptTrace[] = [];
  let response: Gi088CalibrationProviderResult | null = null;
  let assessment: ReturnType<typeof assessGi088FlashDailyContextV3Output> | null = null;
  let terminalTechnicalCode: string | null = null;
  for (const attempt of [1, 2] as const) {
    if (input.actualCalls.value >= input.maxCalls) fail("GI088_FLASH_DAILY_V3_CALL_BUDGET_EXCEEDED");
    assertGi088FlashDailyContextV3Runtime();
    await input.preCallGuard();
    const callFingerprint = sha256Canonical({
      scopeFingerprint: input.scopeFingerprint,
      caseId: input.target.caseId,
      candidateId: id,
      stage: "daily_journal",
      attempt,
      promptHash: prompt.resolvedPromptHash,
      recordCardSha256: input.target.recordCardSha256
    });
    const sequence = input.actualCalls.value + 1;
    await input.appendLedger(input.ledgerPath, {
      event: "call_reserved",
      at: input.now().toISOString(),
      sequence,
      call_fingerprint: callFingerprint,
      case_id: input.target.caseId,
      candidate_id: id,
      stage: "daily_journal",
      attempt,
      model: FLASH_MODEL.model,
      provider_adapter: input.provider.name
    });
    input.actualCalls.value = sequence;
    const started = Date.now();
    let result: Gi088CalibrationProviderResult;
    try {
      result = await input.provider.complete({
        callFingerprint,
        caseId: input.target.caseId,
        candidateId: id,
        stage: "daily_journal",
        attempt,
        model: FLASH_MODEL,
        messages: prompt.messages,
        promptHash: prompt.resolvedPromptHash,
        sourceRefs: input.target.recordCard.source_refs,
        sourceTextByRef: {},
        sourceRecordIds: [record.recordId],
        sourceRecordTextById: { [record.recordId]: record.content },
        runtime: GI088_JOURNAL_CALIBRATION_RUNTIME
      } satisfies Gi088CalibrationProviderRequest);
    } catch (error) {
      const technical = normalizeProviderError(error, Date.now() - started);
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
          model: FLASH_MODEL.model,
          tokenUsage: technical.tokenUsage
        }),
        raw_response_sha256: null
      });
      terminalTechnicalCode = technical.code;
      await input.appendLedger(input.ledgerPath, {
        event: "call_failed",
        at: input.now().toISOString(),
        sequence: input.actualCalls.value,
        call_fingerprint: callFingerprint,
        provider_adapter: input.provider.name,
        error_code: technical.code,
        retry_scheduled: retryScheduled
      });
      if (retryScheduled) continue;
      break;
    }
    const rawSha = sha256Text(result.content);
    input.rawResponses.push({
      call_fingerprint: callFingerprint,
      case_id: input.target.caseId,
      candidate_id: id,
      attempt,
      sha256: rawSha,
      content: result.content
    });
    assessment = assessGi088FlashDailyContextV3Output({
      content: result.content,
      finishReason: result.finishReason ?? null,
      responseModel: result.responseModel ?? null,
      reasoningPresent: result.reasoningPresent ?? null,
      reasoningTokens: result.reasoningTokens ?? null,
      sourceRecord: record,
      invalidatedPhrases: input.target.invalidatedUnderstandingSummaries
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
        model: FLASH_MODEL.model,
        tokenUsage: result.tokenUsage
      }),
      raw_response_sha256: rawSha
    });
    await input.appendLedger(input.ledgerPath, {
      event: "call_completed",
      at: input.now().toISOString(),
      sequence: input.actualCalls.value,
      call_fingerprint: callFingerprint,
      provider_adapter: input.provider.name,
      raw_response_sha256: rawSha,
      finish_reason: result.finishReason ?? null,
      response_model: result.responseModel ?? null,
      reasoning_present: result.reasoningPresent ?? null,
      reasoning_tokens: result.reasoningTokens ?? null,
      quality_accepted: assessment.accepted,
      quality_issues: assessment.issues,
      quality_diagnostics: assessment.diagnostics
    });
    response = result;
    terminalTechnicalCode = null;
    break;
  }
  const qualityIssues = assessment?.issues ?? [];
  const failures: Gi088FlashDailyContextV3Failure[] = response
    ? qualityIssues.map((issue) => ({
        code: issue,
        message: "新版日记未通过客观质量检查，保留首个完整结果并停止模型修稿。",
        refs: [input.target.recordCard.record_card_id],
        severity: "P0" as const
      }))
    : [{
        code: terminalTechnicalCode ?? "DAILY_JOURNAL_TECHNICAL_FAILURE",
        message: "两次技术尝试后仍未获得完整响应。",
        refs: [input.target.recordCard.record_card_id],
        severity: "technical" as const
      }];
  const paragraphs = (assessment?.paragraphs ?? []).map((paragraph, index) => ({
    paragraph_id: `${id}:p${index + 1}`,
    text: paragraph.text,
    source_refs: [...input.target.recordCard.source_refs],
    record_card_refs: paragraph.sourceRecordIds
  }));
  const totalLatency = attempts.reduce((sum, attempt) => sum + attempt.latency_ms, 0);
  const costs = attempts.map((attempt) => attempt.cost_cny).filter((value): value is number => value !== null);
  return {
    case_id: input.target.caseId,
    source_group_id: input.target.sourceGroupId,
    source_file_sha256: input.target.sourceFileSha256,
    source_projection_sha256: input.target.sourceProjectionSha256,
    parent_candidate_id: input.target.parentCandidateId,
    parent_candidate_execution_fingerprint: input.target.parentCandidateExecutionFingerprint,
    record_card_sha256: input.target.recordCardSha256,
    record_card: input.target.recordCard,
    writing_material_sha256: input.target.writingMaterialSha256,
    writing_material_revision_binding_sha256:
      input.target.writingMaterialRevisionBindingSha256,
    writing_material_based_on_content_revision:
      input.target.writingMaterial.basedOnContentRevision,
    writing_material_supported_insight_count:
      input.target.writingMaterial.supportedInsights.length,
    writing_material_question_context_count:
      input.target.writingMaterial.questionContext.length,
    invalidated_understanding_summary_count:
      input.target.invalidatedUnderstandingSummaries.length,
    invalidated_understanding_summaries_sha256:
      input.target.invalidatedUnderstandingSummariesSha256,
    parent_review: input.target.oldReview,
    candidate: {
      candidate_id: id,
      title: formatJournalDailyDateTitle(input.target.entryDate),
      paragraphs,
      program_check: {
        admitted: Boolean(response && assessment?.accepted),
        failures,
        checks: [
          { check: "strict_json_non_empty", passed: !qualityIssues.some((item) => /JSON|SCHEMA|EMPTY/u.test(item)), issues: qualityIssues },
          { check: "source_record_ids_and_coverage", passed: !qualityIssues.some((item) => /SOURCE_RECORD/u.test(item)), issues: qualityIssues },
          { check: "model_and_thinking", passed: !qualityIssues.some((item) => /MODEL|THINKING|FINISH_REASON/u.test(item)), issues: qualityIssues },
          { check: "unsupported_number_and_invalidated_content", passed: !qualityIssues.some((item) => /UNSUPPORTED|INVALIDATED/u.test(item)), issues: qualityIssues }
        ],
        diagnostics: assessment?.diagnostics ?? [],
        invalidation_control: {
          input_boundary: "sealed_current_record_card",
          correction_evidence: "private_source_projection_bound",
          semantic_output_check: "deterministic_phrase_check_plus_human_review"
        }
      },
      trace: {
        prompt_hash: prompt.resolvedPromptHash,
        attempts,
        technical_retry_count: attempts.filter((attempt) => attempt.attempt === 2).length,
        raw_response_sha256: [...attempts].reverse().find(
          (attempt) => attempt.raw_response_sha256
        )?.raw_response_sha256 ?? null,
        response_model: response?.responseModel ?? null,
        reasoning_present: response?.reasoningPresent ?? null,
        reasoning_tokens: response?.reasoningTokens ?? null,
        finish_reason: response?.finishReason ?? null,
        latency_ms: totalLatency,
        cost_cny: costs.length > 0 ? Number(costs.reduce((sum, value) => sum + value, 0).toFixed(8)) : null
      }
    }
  } satisfies Gi088FlashDailyContextV3Case;
}

export async function runGi088FlashDailyContextV3(
  options: Gi088FlashDailyContextV3Options,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: Partial<Gi088FlashDailyContextV3Dependencies> = {},
  projectRoot = process.cwd()
) {
  assertGi088FlashDailyContextV3Runtime();
  if (options.maxCalls !== MAX_CALLS) fail("GI088_FLASH_DAILY_V3_MAX_CALLS_MUST_EQUAL_6");
  if (options.mode === "real" && (!options.confirmPrivateReplay
    || !options.maxCallsExplicit
    || !options.confirmScopeFingerprint
    || !options.confirmParentExecutionFingerprint)) {
    fail("GI088_FLASH_DAILY_V3_REAL_CONFIRMATION_INCOMPLETE");
  }
  const deps: Gi088FlashDailyContextV3Dependencies = {
    resolveCredential: dependencies.resolveCredential ?? resolveGi088CalibrationCredential,
    createRealProvider: dependencies.createRealProvider ?? createGi088OpenAICompatibleCalibrationProvider,
    createMockProvider: dependencies.createMockProvider ?? createGi088MockCalibrationProvider,
    fetcher: dependencies.fetcher ?? fetch,
    now: dependencies.now ?? (() => new Date()),
    appendLedger: dependencies.appendLedger ?? appendGi088FlashDailyContextV3Ledger,
    loadPriorZeroCallFailures: dependencies.loadPriorZeroCallFailures
      ?? loadGi088FlashDailyContextV3PriorZeroCallFailures
  };
  const [codeSnapshot, sources] = await Promise.all([
    loadCodeSnapshot(projectRoot),
    loadGi088CalibrationSources(projectRoot)
  ]);
  const bundle = await loadParentBundle(projectRoot, sources);
  if (JOURNAL_DAILY_WRITER_PROMPT_VERSION !== JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION
    || JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_HASH !== JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH) {
    fail("GI088_FLASH_DAILY_V3_PROMPT_NOT_READY");
  }
  const formalRoundRoot = outputRoot(projectRoot, "real");
  const priorZeroCallFailures = await deps.loadPriorZeroCallFailures(
    formalRoundRoot,
    bundle.package.execution_fingerprint
  );
  let activeRunId: string | null = null;
  const assertPriorZeroCallFailuresUnchanged = async () => {
    const current = await deps.loadPriorZeroCallFailures(
      formalRoundRoot,
      bundle.package.execution_fingerprint,
      activeRunId
    );
    if (canonicalJson(current) !== canonicalJson(priorZeroCallFailures)) {
      fail("GI088_FLASH_DAILY_V3_PRIOR_ZERO_CALL_LINEAGE_CHANGED");
    }
  };
  const scope = createScope({ bundle, codeSnapshot, priorZeroCallFailures });
  const scopeFingerprint = sha256Canonical(scope);
  await assertParentUnchanged(projectRoot, bundle.artifacts);
  const dryRunPlan = {
    mode: "dry-run" as const,
    round_id: ROUND_ID,
    scope_fingerprint: scopeFingerprint,
    parent_execution_fingerprint: bundle.package.execution_fingerprint,
    parent_artifacts: bundle.artifacts,
    parent_transitive_artifacts: bundle.transitiveArtifacts,
    prior_zero_call_failures: priorZeroCallFailures,
    selected_cases: bundle.targets.map((target) => ({
      case_id: target.caseId,
      parent_candidate_id: target.parentCandidateId,
      record_card_sha256: target.recordCardSha256,
      writing_material_sha256: target.writingMaterialSha256,
      writing_material_revision_binding_sha256:
        target.writingMaterialRevisionBindingSha256,
      question_context_count: target.writingMaterial.questionContext.length,
      invalidated_understanding_summary_count: target.invalidatedUnderstandingSummaries.length,
      invalidated_understanding_summaries_sha256:
        target.invalidatedUnderstandingSummariesSha256
    })),
    model: FLASH_MODEL.model,
    provider_adapter_expected: GI088_FLASH_DAILY_CONTEXT_V3_REAL_PROVIDER_ADAPTER,
    stages: ["daily_journal"] as const,
    prompt_version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
    system_prompt_sha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH,
    few_shot_count: 0,
    nominal_model_calls: NOMINAL_CALLS,
    max_model_calls: MAX_CALLS,
    model_calls_executed: 0 as const,
    required_real_run_confirmation: {
      private_replay: true,
      scope_fingerprint: scopeFingerprint,
      parent_execution_fingerprint: bundle.package.execution_fingerprint,
      max_calls: MAX_CALLS
    }
  };
  if (options.mode === "dry-run") return { plan: dryRunPlan, outputWritten: false as const };
  if (options.mode === "real") {
    if (options.confirmScopeFingerprint !== scopeFingerprint) fail("GI088_FLASH_DAILY_V3_SCOPE_CONFIRMATION_MISMATCH");
    if (options.confirmParentExecutionFingerprint !== bundle.package.execution_fingerprint) {
      fail("GI088_FLASH_DAILY_V3_PARENT_CONFIRMATION_MISMATCH");
    }
  }
  const root = outputRoot(projectRoot, options.mode);
  assertPrivateOutput(root, projectRoot);
  const runName = options.runId ?? `${ROUND_ID}-${scopeFingerprint.slice(0, 8)}`;
  activeRunId = runName;
  const directory = resolve(root, runName);
  assertPrivateOutput(directory, projectRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(resolve(projectRoot, PRIVATE_ROOT_RELATIVE), 0o700);
  await chmod(root, 0o700);
  try {
    await access(directory);
    fail("GI088_FLASH_DAILY_V3_OUTPUT_ALREADY_EXISTS");
  } catch (error) {
    if (error instanceof Gi088FlashDailyContextV3Error) throw error;
  }
  await mkdir(directory, { mode: 0o700 });
  const ledgerPath = resolve(directory, "attempt-ledger.ndjson");
  const lockPath = resolve(directory, "round-run.lock.json");
  const packagePath = resolve(directory, "round-package.json");
  const manifestPath = resolve(directory, "commit-manifest.json");
  await writePrivateJsonAtomic(lockPath, {
    round_id: ROUND_ID,
    status: "reserved",
    mode: options.mode,
    reserved_at: deps.now().toISOString(),
    scope_fingerprint: scopeFingerprint,
    parent_execution_fingerprint: bundle.package.execution_fingerprint,
    parent_artifacts: bundle.artifacts,
    parent_transitive_artifacts: bundle.transitiveArtifacts,
    prior_zero_call_failures: priorZeroCallFailures,
    provider_adapter_expected: options.mode === "real"
      ? GI088_FLASH_DAILY_CONTEXT_V3_REAL_PROVIDER_ADAPTER
      : "mock",
    observed_model_calls: 0
  });
  const actualCalls = { value: 0 };
  const rawResponses: Gi088FlashDailyContextV3Package["raw_responses"] = [];
  let providerAdapter: string | null = null;
  try {
    let provider: Gi088CalibrationProvider;
    let providerPreflight: Gi088FlashDailyContextV3Package["provider_preflight"] = null;
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
        baseUrl: GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME.baseUrl
      });
    } else {
      provider = deps.createMockProvider();
    }
    assertGi088FlashDailyContextV3ProviderIdentity(options.mode, provider);
    providerAdapter = provider.name;
    const cases: Gi088FlashDailyContextV3Case[] = [];
    for (const target of bundle.targets) {
      cases.push(await runCase({
        provider,
        target,
        scopeFingerprint,
        maxCalls: MAX_CALLS,
        actualCalls,
        ledgerPath,
        rawResponses,
        preCallGuard: async () => {
          await Promise.all([
            assertParentUnchanged(projectRoot, bundle.artifacts),
            assertPriorZeroCallFailuresUnchanged()
          ]);
        },
        now: deps.now,
        appendLedger: deps.appendLedger
      }));
    }
    if (actualCalls.value < NOMINAL_CALLS || actualCalls.value > MAX_CALLS
      || cases.length !== 3
      || cases.some((item) => item.candidate.trace.attempts.length < 1
        || item.candidate.trace.attempts.length > 2)) {
      fail("GI088_FLASH_DAILY_V3_RESULT_BUDGET_INVALID");
    }
    await Promise.all([
      assertParentUnchanged(projectRoot, bundle.artifacts),
      assertPriorZeroCallFailuresUnchanged()
    ]);
    const executionFingerprint = createGi088FlashDailyContextV3ExecutionFingerprint({
      scopeFingerprint,
      actualCalls: actualCalls.value,
      providerPreflight,
      cases,
      rawResponses,
      providerAdapter
    });
    const resultPackage: Gi088FlashDailyContextV3Package = {
      schema_version: "1.0",
      privacy_classification: "private_local_only",
      round_version: ROUND_VERSION,
      round_id: ROUND_ID,
      generated_at: deps.now().toISOString(),
      mode: options.mode,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      prior_zero_call_failures: priorZeroCallFailures,
      parent: {
        execution_fingerprint: bundle.package.execution_fingerprint,
        candidate_set_id: bundle.package.parent.candidate_set_id,
        artifacts: bundle.artifacts,
        transitive_artifacts: bundle.transitiveArtifacts
      },
      prompt: {
        version: JOURNAL_DAILY_WRITER_PROMPT_V3_VERSION,
        system_prompt_sha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V3_HASH
      },
      runtime: {
        model: FLASH_MODEL.model,
        provider: GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME.provider,
        base_url: GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME.baseUrl,
        thinking: "disabled",
        temperature: 0.2,
        response_format: "json_object",
        headers_timeout_ms: GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME.headersTimeoutMs,
        body_idle_timeout_ms: GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME.bodyIdleTimeoutMs,
        hard_timeout_ms: GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME.hardTimeoutMs,
        max_tokens_policy: GI088_FLASH_DAILY_CONTEXT_V3_RUNTIME.maxTokensPolicy,
        max_technical_retries_per_case: 1,
        quality_retries: 0,
        provider_adapter: providerAdapter
      },
      budget: {
        case_count: 3,
        nominal_model_calls: NOMINAL_CALLS,
        max_model_calls: MAX_CALLS
      },
      run: {
        actual_model_calls: actualCalls.value,
        technical_retries: cases.reduce((sum, item) => sum + item.candidate.trace.technical_retry_count, 0),
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
    await writePrivateFile(resolve(directory, `.round-package.${process.pid}.tmp`), packageContent);
    await rename(resolve(directory, `.round-package.${process.pid}.tmp`), packagePath);
    await chmod(packagePath, 0o600);
    const packageSha = sha256Text(packageContent);
    await writePrivateJsonAtomic(lockPath, {
      round_id: ROUND_ID,
      status: "completed",
      mode: options.mode,
      completed_at: deps.now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      parent_execution_fingerprint: bundle.package.execution_fingerprint,
      execution_fingerprint: executionFingerprint,
      parent_artifacts: bundle.artifacts,
      parent_transitive_artifacts: bundle.transitiveArtifacts,
      prior_zero_call_failures: priorZeroCallFailures,
      provider_adapter: providerAdapter,
      package_sha256: packageSha,
      actual_model_calls: actualCalls.value
    });
    const [ledgerSha, lockSha] = await Promise.all([
      sha256File(ledgerPath),
      sha256File(lockPath)
    ]);
    await writePrivateJsonAtomic(manifestPath, {
      schema_version: "1.0",
      status: "committed",
      committed_at: deps.now().toISOString(),
      round_id: ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      parent_execution_fingerprint: bundle.package.execution_fingerprint,
      parent_artifacts: bundle.artifacts,
      parent_transitive_artifacts: bundle.transitiveArtifacts,
      prior_zero_call_failures: priorZeroCallFailures,
      provider_adapter: providerAdapter,
      child_artifacts: {
        package_sha256: packageSha,
        attempt_ledger_sha256: ledgerSha,
        run_lock_sha256: lockSha
      },
      files: {
        package: basename(packagePath),
        attempt_ledger: basename(ledgerPath),
        run_lock: basename(lockPath)
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
      round_id: ROUND_ID,
      status: "failed",
      mode: options.mode,
      failed_at: deps.now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      parent_execution_fingerprint: bundle.package.execution_fingerprint,
      parent_artifacts: bundle.artifacts,
      parent_transitive_artifacts: bundle.transitiveArtifacts,
      prior_zero_call_failures: priorZeroCallFailures,
      provider_adapter: providerAdapter,
      provider_adapter_expected: options.mode === "real"
        ? GI088_FLASH_DAILY_CONTEXT_V3_REAL_PROVIDER_ADAPTER
        : "mock",
      observed_model_calls: actualCalls.value,
      error_code: safeGi088FlashDailyContextV3ErrorCode(error)
    }).catch(() => undefined);
    throw error;
  }
}

export function safeGi088FlashDailyContextV3ErrorCode(error: unknown) {
  if (error instanceof Gi088FlashDailyContextV3Error) return error.code;
  return safeGi088CalibrationErrorCode(error);
}

export async function mainGi088FlashDailyContextV3Cli() {
  const options = parseGi088FlashDailyContextV3Args(process.argv.slice(2));
  const result = await runGi088FlashDailyContextV3(options);
  if ("plan" in result) {
    process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    status: "committed",
    mode: result.package.mode,
    scope_fingerprint: result.scopeFingerprint,
    parent_execution_fingerprint: result.package.parent.execution_fingerprint,
    execution_fingerprint: result.package.execution_fingerprint,
    actual_model_calls: result.package.run.actual_model_calls,
    output_directory: relative(process.cwd(), result.outputDirectory),
    commit_manifest: relative(process.cwd(), result.manifestPath)
  }, null, 2)}\n`);
}
