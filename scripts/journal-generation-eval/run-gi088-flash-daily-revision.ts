import { createHash } from "node:crypto";
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
  buildJournalDailyWriterPromptV2,
  formatJournalDailyDateTitle,
  JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH,
  type JournalDailySourceRecord,
  type JournalDailyWriterInput
} from "@/server/services/journal-daily-entry";

import {
  GI088_JOURNAL_CALIBRATION_CASES,
  GI088_JOURNAL_CALIBRATION_MODELS,
  GI088_JOURNAL_CALIBRATION_RUNTIME,
  canonicalJson,
  estimateGi088CalibrationCostCny,
  sha256Canonical,
  sha256Text,
  type Gi088CalibrationAttemptTrace,
  type Gi088CalibrationCandidate,
  type Gi088CalibrationIdentityMap,
  type Gi088CalibrationPrivatePackage,
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
import { loadGi088CalibrationSources } from "./gi088-calibration-runner";
import {
  resolveGi088CalibrationCredential,
  safeGi088CalibrationErrorCode,
  type Gi088CalibrationCredential
} from "./run-gi088-calibration";
import { sha256File } from "./private-export-importer";

const PRIVATE_ROOT_RELATIVE = "artifacts/journal-generation-evaluation/.private" as const;
const FORMAL_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/formal` as const;
const PARENT_RELATIVE = `${FORMAL_RELATIVE}/continuations/daily-completion-d95507a6` as const;
const ROUND_ROOT_RELATIVE = `${FORMAL_RELATIVE}/rounds` as const;
const MOCK_ROOT_RELATIVE = `${PRIVATE_ROOT_RELATIVE}/round2-mock` as const;
const ROUND_VERSION = "2026-08-11.gi088-flash-daily-prompt-v2" as const;
const ROUND_ID = "flash-daily-prompt-v2" as const;
const MAX_CALLS = 6 as const;
const NOMINAL_CALLS = 3 as const;
const FLASH_MODEL = GI088_JOURNAL_CALIBRATION_MODELS.find(
  (candidate) => candidate.model === "deepseek-v4-flash"
)!;

const ROUND_IMPLEMENTATION_FILES = [
  "scripts/journal-generation-eval/gi088-calibration-contract.ts",
  "scripts/journal-generation-eval/gi088-calibration-provider.ts",
  "scripts/journal-generation-eval/gi088-calibration-runner.ts",
  "scripts/journal-generation-eval/run-gi088-calibration.ts",
  "scripts/journal-generation-eval/run-gi088-flash-daily-revision.ts",
  "scripts/journal-generation-eval/run-gi088-flash-daily-revision-cli.ts",
  "src/features/ai-quality/prompt-manifest.ts",
  "src/server/services/ai/ai-provider.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/journal-daily-entry/contract.ts",
  "src/server/services/journal-daily-entry/prompt.ts",
  "src/server/services/journal-daily-entry/journal-daily-entry-generation.service.ts"
] as const;

interface ParentCommitManifest {
  status: "committed";
  execution_fingerprint: string;
  candidate_set_id: string;
  child_artifacts: {
    package_sha256: string;
    identity_sha256: string;
  };
}

interface ParentReviewEvent {
  schema_version?: string;
  event_type?: string;
  case_id?: string;
  presentation_id?: string;
  reviewer_id?: string;
  record_card_verdicts?: { A?: string; B?: string };
  daily_verdicts?: { A?: string; B?: string };
  preference?: string;
  issue_attributions?: string[];
  note?: string;
  reviewed_at?: string;
  note_updated_at?: string;
}

export interface Gi088FlashDailyRevisionParentArtifacts {
  package_sha256: string;
  identity_sha256: string;
  manifest_sha256: string;
  reviews_sha256: string;
  review_drafts_sha256: string;
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
  oldParagraphs: Gi088CalibrationCandidate["paragraphs"];
  oldReview: {
    presentation_id: string;
    flash_label: "A" | "B";
    record_card_verdict: string;
    daily_verdict: string;
    note: string;
    reviewed_at: string;
  };
}

interface ParentBundle {
  package: Gi088CalibrationPrivatePackage;
  identityMap: Gi088CalibrationIdentityMap;
  manifest: ParentCommitManifest;
  reviewEvents: ParentReviewEvent[];
  artifacts: Gi088FlashDailyRevisionParentArtifacts;
  targets: ParentTarget[];
}

export interface Gi088FlashDailyRevisionFailure {
  code: string;
  message: string;
  refs: string[];
  severity: "P0" | "technical";
}

export interface Gi088FlashDailyRevisionCase {
  case_id: string;
  source_group_id: string;
  source_file_sha256: string;
  source_projection_sha256: string;
  parent_candidate_id: string;
  parent_candidate_execution_fingerprint: string;
  record_card_sha256: string;
  record_card: Gi088CalibrationRecordCard;
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
      failures: Gi088FlashDailyRevisionFailure[];
      checks: Array<{ check: string; passed: boolean; issues: string[] }>;
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

export interface Gi088FlashDailyRevisionPackage {
  schema_version: "1.0";
  privacy_classification: "private_local_only";
  round_version: typeof ROUND_VERSION;
  round_id: typeof ROUND_ID;
  generated_at: string;
  mode: "mock" | "real";
  scope_fingerprint: string;
  execution_fingerprint: string;
  parent: {
    execution_fingerprint: string;
    candidate_set_id: string;
    artifacts: Gi088FlashDailyRevisionParentArtifacts;
  };
  prompt: {
    version: string;
    system_prompt_sha256: string;
  };
  runtime: {
    model: "deepseek-v4-flash";
    thinking: "disabled";
    temperature: 0.2;
    response_format: "json_object";
    max_technical_retries_per_case: 1;
    quality_retries: 0;
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
  provider_preflight: {
    performed_at: string;
    required_model: "deepseek-v4-flash";
    required_model_available: true;
    available_model_ids_sha256: string;
    credential_source: Gi088CalibrationCredential["source"];
  } | null;
  cases: Gi088FlashDailyRevisionCase[];
  raw_responses: Array<{
    call_fingerprint: string;
    case_id: string;
    candidate_id: string;
    attempt: 1 | 2;
    sha256: string;
    content: string;
  }>;
}

export interface Gi088FlashDailyRevisionOptions {
  mode: "dry-run" | "mock" | "real";
  confirmPrivateReplay: boolean;
  confirmScopeFingerprint: string | null;
  confirmParentExecutionFingerprint: string | null;
  maxCalls: number;
  maxCallsExplicit: boolean;
  runId: string | null;
}

export interface Gi088FlashDailyRevisionDependencies {
  resolveCredential: typeof resolveGi088CalibrationCredential;
  createRealProvider: (input: { apiKey: string }) => Gi088CalibrationProvider;
  createMockProvider: () => Gi088CalibrationProvider;
  fetcher: typeof fetch;
  now: () => Date;
}

export class Gi088FlashDailyRevisionError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Gi088FlashDailyRevisionError";
  }
}

function fail(code: string): never {
  throw new Gi088FlashDailyRevisionError(code);
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
        return [JSON.parse(line) as ParentReviewEvent];
      } catch {
        fail(errorCode);
      }
    });
  } catch (error) {
    if (error instanceof Gi088FlashDailyRevisionError) throw error;
    fail(errorCode);
  }
}

function stablePresentation(input: {
  caseId: string;
  sourceGroupId: string;
  sourceFileSha256: string;
  sourceProjectionSha256: string;
  candidateSetId: string;
  candidates: Gi088CalibrationCandidate[];
}) {
  const shouldReverse = Number.parseInt(
    createHash("sha256")
      .update(`${input.caseId}:${input.candidateSetId}`)
      .digest("hex")
      .slice(0, 2),
    16
  ) % 2 === 1;
  const ordered = shouldReverse ? [...input.candidates].reverse() : [...input.candidates];
  const visibleFingerprint = sha256Text(JSON.stringify(ordered.map((candidate) => ({
    candidate_id: candidate.candidate_id,
    title: candidate.title,
    record_cards: candidate.record_cards.map((recordCard) => ({
      record_card_id: recordCard.record_card_id,
      title: recordCard.title,
      text: recordCard.text,
      insight: recordCard.insight,
      source_refs: recordCard.source_refs
    })),
    paragraphs: candidate.paragraphs.map((paragraph) => ({
      text: paragraph.text,
      source_refs: paragraph.source_refs,
      record_card_refs: paragraph.record_card_refs
    }))
  }))));
  return {
    ordered,
    presentationId: sha256Text([
      input.caseId,
      input.sourceGroupId,
      input.sourceFileSha256,
      input.sourceProjectionSha256,
      input.candidateSetId,
      visibleFingerprint
    ].join(":"))
  };
}

function latestParentNote(events: ParentReviewEvent[], decision: ParentReviewEvent) {
  return events.filter((event) => event.event_type === "note_updated"
      && event.case_id === decision.case_id
      && event.presentation_id === decision.presentation_id
      && event.reviewer_id === decision.reviewer_id
      && typeof event.note === "string")
    .at(-1)?.note ?? decision.note ?? "";
}

function validateParentPackage(input: {
  candidatePackage: Gi088CalibrationPrivatePackage;
  identityMap: Gi088CalibrationIdentityMap;
  manifest: ParentCommitManifest;
  packageSha: string;
  identitySha: string;
}) {
  const candidateKeys = input.candidatePackage.packets.flatMap((packet) =>
    packet.candidates.map((candidate) => `${packet.case_id}\u0000${candidate.candidate_id}`)
  );
  const identityKeys = input.identityMap.identities.map((identity) =>
    `${identity.case_id}\u0000${identity.candidate_id}`
  );
  if (input.manifest.status !== "committed"
    || input.manifest.child_artifacts.package_sha256 !== input.packageSha
    || input.manifest.child_artifacts.identity_sha256 !== input.identitySha
    || input.candidatePackage.schema_version !== "2.0"
    || input.candidatePackage.privacy_classification !== "private_local_only"
    || input.candidatePackage.run.mode !== "real"
    || input.candidatePackage.packets.length !== 3
    || input.candidatePackage.execution_fingerprint !== input.manifest.execution_fingerprint
    || input.identityMap.execution_fingerprint !== input.manifest.execution_fingerprint
    || input.candidatePackage.candidate_set_id !== input.manifest.candidate_set_id
    || input.identityMap.candidate_set_id !== input.manifest.candidate_set_id
    || candidateKeys.length !== 6
    || identityKeys.length !== 6
    || sha256Canonical([...candidateKeys].sort()) !== sha256Canonical([...identityKeys].sort())) {
    fail("GI088_FLASH_DAILY_V2_PARENT_INVALID");
  }
}

async function loadParentBundle(projectRoot: string): Promise<ParentBundle> {
  const parentRoot = resolve(projectRoot, PARENT_RELATIVE);
  const paths = {
    package: resolve(parentRoot, "candidate-packets.json"),
    identity: resolve(parentRoot, "candidate-identity-map.json"),
    manifest: resolve(parentRoot, "commit-manifest.json"),
    reviews: resolve(projectRoot, FORMAL_RELATIVE, "reviews.ndjson"),
    reviewDrafts: resolve(projectRoot, FORMAL_RELATIVE, "review-drafts.ndjson")
  };
  const [candidatePackage, identityMap, manifest, reviewEvents, packageSha, identitySha,
    manifestSha, reviewsSha, reviewDraftsSha] = await Promise.all([
    readJson<Gi088CalibrationPrivatePackage>(paths.package, "GI088_FLASH_DAILY_V2_PARENT_PACKAGE_UNREADABLE"),
    readJson<Gi088CalibrationIdentityMap>(paths.identity, "GI088_FLASH_DAILY_V2_PARENT_IDENTITY_UNREADABLE"),
    readJson<ParentCommitManifest>(paths.manifest, "GI088_FLASH_DAILY_V2_PARENT_MANIFEST_UNREADABLE"),
    readNdjson(paths.reviews, "GI088_FLASH_DAILY_V2_PARENT_REVIEWS_UNREADABLE"),
    sha256File(paths.package),
    sha256File(paths.identity),
    sha256File(paths.manifest),
    sha256File(paths.reviews),
    sha256File(paths.reviewDrafts)
  ]);
  validateParentPackage({ candidatePackage, identityMap, manifest, packageSha, identitySha });
  const artifacts = {
    package_sha256: packageSha,
    identity_sha256: identitySha,
    manifest_sha256: manifestSha,
    reviews_sha256: reviewsSha,
    review_drafts_sha256: reviewDraftsSha
  };
  const targets = GI088_JOURNAL_CALIBRATION_CASES.map((selection) => {
    const packet = candidatePackage.packets.find((item) => item.case_id === selection.caseId);
    if (!packet || packet.candidates.length !== 2) fail("GI088_FLASH_DAILY_V2_CASE_MISSING");
    const flashIdentity = identityMap.identities.find((identity) =>
      identity.case_id === selection.caseId && identity.model_identity === FLASH_MODEL.model
    );
    if (!flashIdentity) fail("GI088_FLASH_DAILY_V2_FLASH_IDENTITY_MISSING");
    const flashCandidate = packet.candidates.find((candidate) =>
      candidate.candidate_id === flashIdentity.candidate_id
    );
    if (!flashCandidate || flashCandidate.record_cards.length !== 1) {
      fail("GI088_FLASH_DAILY_V2_APPROVED_RECORD_CARD_MISSING");
    }
    const recordCard = flashCandidate.record_cards[0];
    if (!recordCard.text.trim()) fail("GI088_FLASH_DAILY_V2_APPROVED_RECORD_CARD_EMPTY");
    const presentation = stablePresentation({
      caseId: packet.case_id,
      sourceGroupId: packet.source_group_id,
      sourceFileSha256: packet.source_file_sha256,
      sourceProjectionSha256: packet.source_projection_sha256,
      candidateSetId: packet.candidate_set_id,
      candidates: packet.candidates
    });
    const flashIndex = presentation.ordered.findIndex((candidate) =>
      candidate.candidate_id === flashCandidate.candidate_id
    );
    const flashLabel = flashIndex === 0 ? "A" : flashIndex === 1 ? "B" : null;
    if (!flashLabel) fail("GI088_FLASH_DAILY_V2_FLASH_PRESENTATION_INVALID");
    const review = reviewEvents.find((event) => event.schema_version === "3.0"
      && event.event_type === "decision"
      && event.case_id === packet.case_id
      && event.presentation_id === presentation.presentationId);
    const cardVerdict = review?.record_card_verdicts?.[flashLabel];
    const dailyVerdict = review?.daily_verdicts?.[flashLabel];
    if (!review || cardVerdict !== "ready_to_use" || typeof dailyVerdict !== "string"
      || typeof review.reviewed_at !== "string") {
      fail("GI088_FLASH_DAILY_V2_PARENT_REVIEW_NOT_APPROVED");
    }
    return {
      caseId: packet.case_id,
      sourceGroupId: packet.source_group_id,
      sourceFileSha256: packet.source_file_sha256,
      sourceProjectionSha256: packet.source_projection_sha256,
      entryDate: selection.entryDate,
      parentCandidateId: flashCandidate.candidate_id,
      parentCandidateExecutionFingerprint: flashCandidate.execution_fingerprint,
      recordCard,
      recordCardSha256: sha256Canonical(recordCard),
      oldTitle: flashCandidate.title,
      oldParagraphs: flashCandidate.paragraphs,
      oldReview: {
        presentation_id: presentation.presentationId,
        flash_label: flashLabel,
        record_card_verdict: cardVerdict,
        daily_verdict: dailyVerdict,
        note: latestParentNote(reviewEvents, review),
        reviewed_at: review.reviewed_at
      }
    } satisfies ParentTarget;
  });
  return { package: candidatePackage, identityMap, manifest, reviewEvents, artifacts, targets };
}

async function assertParentUnchanged(projectRoot: string, expected: Gi088FlashDailyRevisionParentArtifacts) {
  const parentRoot = resolve(projectRoot, PARENT_RELATIVE);
  const actual = {
    package_sha256: await sha256File(resolve(parentRoot, "candidate-packets.json")),
    identity_sha256: await sha256File(resolve(parentRoot, "candidate-identity-map.json")),
    manifest_sha256: await sha256File(resolve(parentRoot, "commit-manifest.json")),
    reviews_sha256: await sha256File(resolve(projectRoot, FORMAL_RELATIVE, "reviews.ndjson")),
    review_drafts_sha256: await sha256File(resolve(projectRoot, FORMAL_RELATIVE, "review-drafts.ndjson"))
  };
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail("GI088_FLASH_DAILY_V2_PARENT_CHANGED");
  }
}

async function loadCodeSnapshot(projectRoot: string) {
  return await Promise.all(ROUND_IMPLEMENTATION_FILES.map(async (path) => ({
    path,
    sha256: await sha256File(resolve(projectRoot, path))
  })));
}

function sourceRecord(target: ParentTarget): JournalDailySourceRecord {
  return {
    recordId: target.recordCard.record_card_id,
    eventId: target.recordCard.event_id,
    entryDate: target.entryDate,
    daySequence: 1,
    title: target.recordCard.title,
    content: [target.recordCard.text, target.recordCard.insight].filter((item) => item.trim()).join("\n"),
    contentRevision: 1,
    updatedAt: `${target.entryDate}T12:00:00.000Z`
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

export function assessGi088FlashDailyRevisionOutput(input: {
  content: string;
  finishReason: string | null;
  responseModel: string | null;
  reasoningPresent: boolean | null;
  reasoningTokens?: number | null;
  sourceRecord: JournalDailySourceRecord;
  invalidatedPhrases?: string[];
}) {
  const issues: string[] = [];
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

async function appendPrivateLedger(path: string, value: unknown) {
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
}) {
  return {
    roundVersion: ROUND_VERSION,
    roundId: ROUND_ID,
    parentExecutionFingerprint: input.bundle.package.execution_fingerprint,
    parentCandidateSetId: input.bundle.package.candidate_set_id,
    parentArtifacts: input.bundle.artifacts,
    cases: input.bundle.targets.map((target) => ({
      caseId: target.caseId,
      sourceFileSha256: target.sourceFileSha256,
      sourceProjectionSha256: target.sourceProjectionSha256,
      parentCandidateId: target.parentCandidateId,
      parentCandidateExecutionFingerprint: target.parentCandidateExecutionFingerprint,
      recordCardSha256: target.recordCardSha256,
      oldReviewPresentationId: target.oldReview.presentation_id
    })),
    model: FLASH_MODEL.model,
    prompt: {
      version: JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION,
      systemPromptSha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH,
      fewShotCount: 0
    },
    runtime: {
      temperature: 0.2,
      thinking: "disabled",
      responseFormat: "json_object",
      maxTechnicalRetriesPerCase: 1,
      qualityRetries: 0
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
    response = await input.fetcher("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${input.apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    fail("GI088_FLASH_DAILY_V2_MODEL_PREFLIGHT_UNREACHABLE");
  }
  if (!response.ok) fail(`GI088_FLASH_DAILY_V2_MODEL_PREFLIGHT_HTTP_${response.status}`);
  const body = await response.json() as unknown;
  const ids = isObject(body) && Array.isArray(body.data)
    ? body.data.flatMap((item) => isObject(item) && typeof item.id === "string" ? [item.id] : [])
    : [];
  if (!ids.includes(FLASH_MODEL.model)) fail("GI088_FLASH_DAILY_V2_FLASH_UNAVAILABLE");
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
  if (!value || value.startsWith("--")) fail("GI088_FLASH_DAILY_V2_ARGUMENT_VALUE_REQUIRED");
  return { value, consumed: 1 };
}

export function parseGi088FlashDailyRevisionArgs(argv: string[]): Gi088FlashDailyRevisionOptions {
  const options: Gi088FlashDailyRevisionOptions = {
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
      if (modeSet) fail("GI088_FLASH_DAILY_V2_MODE_DUPLICATE");
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
      fail(`GI088_FLASH_DAILY_V2_ARGUMENT_INVALID:${argument}`);
    }
  }
  if (!Number.isInteger(options.maxCalls) || options.maxCalls !== MAX_CALLS) {
    fail("GI088_FLASH_DAILY_V2_MAX_CALLS_MUST_EQUAL_6");
  }
  if (options.runId && !/^[a-z0-9][a-z0-9-]{2,63}$/u.test(options.runId)) {
    fail("GI088_FLASH_DAILY_V2_RUN_ID_INVALID");
  }
  if (options.mode === "real") {
    if (!options.confirmPrivateReplay) fail("GI088_FLASH_DAILY_V2_PRIVATE_REPLAY_CONFIRMATION_REQUIRED");
    if (!options.maxCallsExplicit) fail("GI088_FLASH_DAILY_V2_MAX_CALLS_CONFIRMATION_REQUIRED");
    if (!options.confirmScopeFingerprint || !options.confirmParentExecutionFingerprint) {
      fail("GI088_FLASH_DAILY_V2_EXACT_SCOPE_CONFIRMATION_REQUIRED");
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
    fail("GI088_FLASH_DAILY_V2_PRIVATE_OUTPUT_REQUIRED");
  }
}

async function assertNoPriorRealRound(root: string, parentExecution: string) {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    fail("GI088_FLASH_DAILY_V2_ROUND_HISTORY_UNREADABLE");
  }
  for (const entry of entries) {
    try {
      const lock = await readJson<Record<string, unknown>>(
        resolve(root, entry, "round-run.lock.json"),
        "GI088_FLASH_DAILY_V2_ROUND_HISTORY_INVALID"
      );
      if (lock.mode === "real" && lock.parent_execution_fingerprint === parentExecution) {
        fail("GI088_FLASH_DAILY_V2_PRIOR_REAL_ROUND_EXISTS");
      }
    } catch (error) {
      if (error instanceof Gi088FlashDailyRevisionError) throw error;
    }
  }
}

function candidateId(scopeFingerprint: string, target: ParentTarget) {
  return `flash-v2-${sha256Canonical({ scopeFingerprint, caseId: target.caseId }).slice(0, 20)}`;
}

async function runCase(input: {
  provider: Gi088CalibrationProvider;
  target: ParentTarget;
  scopeFingerprint: string;
  maxCalls: number;
  actualCalls: { value: number };
  ledgerPath: string;
  rawResponses: Gi088FlashDailyRevisionPackage["raw_responses"];
  preCallGuard: () => Promise<void>;
  now: () => Date;
}) {
  const id = candidateId(input.scopeFingerprint, input.target);
  const record = sourceRecord(input.target);
  const prompt = buildJournalDailyWriterPromptV2(writerInput(input.target, record));
  const attempts: Gi088CalibrationAttemptTrace[] = [];
  let response: Gi088CalibrationProviderResult | null = null;
  let assessment: ReturnType<typeof assessGi088FlashDailyRevisionOutput> | null = null;
  let terminalTechnicalCode: string | null = null;
  for (const attempt of [1, 2] as const) {
    if (input.actualCalls.value >= input.maxCalls) fail("GI088_FLASH_DAILY_V2_CALL_BUDGET_EXCEEDED");
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
    input.actualCalls.value += 1;
    await appendPrivateLedger(input.ledgerPath, {
      event: "call_reserved",
      at: input.now().toISOString(),
      sequence: input.actualCalls.value,
      call_fingerprint: callFingerprint,
      case_id: input.target.caseId,
      candidate_id: id,
      stage: "daily_journal",
      attempt,
      model: FLASH_MODEL.model
    });
    const started = Date.now();
    try {
      const result = await input.provider.complete({
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
      const rawSha = sha256Text(result.content);
      input.rawResponses.push({
        call_fingerprint: callFingerprint,
        case_id: input.target.caseId,
        candidate_id: id,
        attempt,
        sha256: rawSha,
        content: result.content
      });
      assessment = assessGi088FlashDailyRevisionOutput({
        content: result.content,
        finishReason: result.finishReason ?? null,
        responseModel: result.responseModel ?? null,
        reasoningPresent: result.reasoningPresent ?? null,
        reasoningTokens: result.reasoningTokens ?? null,
        sourceRecord: record
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
      await appendPrivateLedger(input.ledgerPath, {
        event: "call_completed",
        at: input.now().toISOString(),
        sequence: input.actualCalls.value,
        call_fingerprint: callFingerprint,
        raw_response_sha256: rawSha,
        finish_reason: result.finishReason ?? null,
        response_model: result.responseModel ?? null,
        reasoning_present: result.reasoningPresent ?? null,
        reasoning_tokens: result.reasoningTokens ?? null,
        quality_accepted: assessment.accepted,
        quality_issues: assessment.issues
      });
      response = result;
      terminalTechnicalCode = null;
      break;
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
      await appendPrivateLedger(input.ledgerPath, {
        event: "call_failed",
        at: input.now().toISOString(),
        sequence: input.actualCalls.value,
        call_fingerprint: callFingerprint,
        error_code: technical.code,
        retry_scheduled: retryScheduled
      });
      if (!retryScheduled) break;
    }
  }
  const qualityIssues = assessment?.issues ?? [];
  const failures: Gi088FlashDailyRevisionFailure[] = response
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
        ]
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
  } satisfies Gi088FlashDailyRevisionCase;
}

export async function runGi088FlashDailyRevision(
  options: Gi088FlashDailyRevisionOptions,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: Partial<Gi088FlashDailyRevisionDependencies> = {},
  projectRoot = process.cwd()
) {
  const deps: Gi088FlashDailyRevisionDependencies = {
    resolveCredential: dependencies.resolveCredential ?? resolveGi088CalibrationCredential,
    createRealProvider: dependencies.createRealProvider ?? createGi088OpenAICompatibleCalibrationProvider,
    createMockProvider: dependencies.createMockProvider ?? createGi088MockCalibrationProvider,
    fetcher: dependencies.fetcher ?? fetch,
    now: dependencies.now ?? (() => new Date())
  };
  const [bundle, codeSnapshot, sources] = await Promise.all([
    loadParentBundle(projectRoot),
    loadCodeSnapshot(projectRoot),
    loadGi088CalibrationSources(projectRoot)
  ]);
  for (const target of bundle.targets) {
    const source = sources.find((item) => item.selection.caseId === target.caseId);
    if (!source || source.sourceFileSha256 !== target.sourceFileSha256
      || source.sourceProjectionSha256 !== target.sourceProjectionSha256) {
      fail("GI088_FLASH_DAILY_V2_SOURCE_LINEAGE_MISMATCH");
    }
  }
  const scope = createScope({ bundle, codeSnapshot });
  const scopeFingerprint = sha256Canonical(scope);
  await assertParentUnchanged(projectRoot, bundle.artifacts);
  const dryRunPlan = {
    mode: "dry-run" as const,
    round_id: ROUND_ID,
    scope_fingerprint: scopeFingerprint,
    parent_execution_fingerprint: bundle.package.execution_fingerprint,
    parent_artifacts: bundle.artifacts,
    selected_cases: bundle.targets.map((target) => ({
      case_id: target.caseId,
      parent_candidate_id: target.parentCandidateId,
      record_card_sha256: target.recordCardSha256
    })),
    model: FLASH_MODEL.model,
    stages: ["daily_journal"] as const,
    prompt_version: JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION,
    system_prompt_sha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH,
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
    if (options.confirmScopeFingerprint !== scopeFingerprint) fail("GI088_FLASH_DAILY_V2_SCOPE_CONFIRMATION_MISMATCH");
    if (options.confirmParentExecutionFingerprint !== bundle.package.execution_fingerprint) {
      fail("GI088_FLASH_DAILY_V2_PARENT_CONFIRMATION_MISMATCH");
    }
  }
  const root = outputRoot(projectRoot, options.mode);
  assertPrivateOutput(root, projectRoot);
  if (options.mode === "real") await assertNoPriorRealRound(root, bundle.package.execution_fingerprint);
  const runName = options.runId ?? `${ROUND_ID}-${scopeFingerprint.slice(0, 8)}`;
  const directory = resolve(root, runName);
  assertPrivateOutput(directory, projectRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  try {
    await access(directory);
    fail("GI088_FLASH_DAILY_V2_OUTPUT_ALREADY_EXISTS");
  } catch (error) {
    if (error instanceof Gi088FlashDailyRevisionError) throw error;
  }
  await mkdir(directory, { mode: 0o700 });
  const ledgerPath = resolve(directory, "attempt-ledger.ndjson");
  const lockPath = resolve(directory, "round-run.lock.json");
  const packagePath = resolve(directory, "round-package.json");
  const manifestPath = resolve(directory, "commit-manifest.json");
  await writePrivateJsonAtomic(lockPath, {
    status: "reserved",
    mode: options.mode,
    reserved_at: deps.now().toISOString(),
    scope_fingerprint: scopeFingerprint,
    parent_execution_fingerprint: bundle.package.execution_fingerprint,
    parent_artifacts: bundle.artifacts
  });
  const actualCalls = { value: 0 };
  const rawResponses: Gi088FlashDailyRevisionPackage["raw_responses"] = [];
  try {
    let provider: Gi088CalibrationProvider;
    let providerPreflight: Gi088FlashDailyRevisionPackage["provider_preflight"] = null;
    if (options.mode === "real") {
      const credential = await deps.resolveCredential(env);
      providerPreflight = await validateFlashModel({
        apiKey: credential.apiKey,
        credentialSource: credential.source,
        fetcher: deps.fetcher,
        now: deps.now()
      });
      provider = deps.createRealProvider({ apiKey: credential.apiKey });
    } else {
      provider = deps.createMockProvider();
    }
    const cases: Gi088FlashDailyRevisionCase[] = [];
    for (const target of bundle.targets) {
      cases.push(await runCase({
        provider,
        target,
        scopeFingerprint,
        maxCalls: MAX_CALLS,
        actualCalls,
        ledgerPath,
        rawResponses,
        preCallGuard: () => assertParentUnchanged(projectRoot, bundle.artifacts),
        now: deps.now
      }));
    }
    if (actualCalls.value < NOMINAL_CALLS || actualCalls.value > MAX_CALLS
      || cases.length !== 3
      || cases.some((item) => item.candidate.trace.attempts.length < 1
        || item.candidate.trace.attempts.length > 2)) {
      fail("GI088_FLASH_DAILY_V2_RESULT_BUDGET_INVALID");
    }
    await assertParentUnchanged(projectRoot, bundle.artifacts);
    const executionFingerprint = sha256Canonical({
      scopeFingerprint,
      actualCalls: actualCalls.value,
      cases,
      rawResponses: rawResponses.map((response) => ({
        callFingerprint: response.call_fingerprint,
        caseId: response.case_id,
        attempt: response.attempt,
        sha256: response.sha256
      }))
    });
    const resultPackage: Gi088FlashDailyRevisionPackage = {
      schema_version: "1.0",
      privacy_classification: "private_local_only",
      round_version: ROUND_VERSION,
      round_id: ROUND_ID,
      generated_at: deps.now().toISOString(),
      mode: options.mode,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      parent: {
        execution_fingerprint: bundle.package.execution_fingerprint,
        candidate_set_id: bundle.package.candidate_set_id,
        artifacts: bundle.artifacts
      },
      prompt: {
        version: JOURNAL_DAILY_WRITER_PROMPT_V2_VERSION,
        system_prompt_sha256: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V2_HASH
      },
      runtime: {
        model: FLASH_MODEL.model,
        thinking: "disabled",
        temperature: 0.2,
        response_format: "json_object",
        max_technical_retries_per_case: 1,
        quality_retries: 0
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
      status: "completed",
      mode: options.mode,
      completed_at: deps.now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      parent_execution_fingerprint: bundle.package.execution_fingerprint,
      execution_fingerprint: executionFingerprint,
      parent_artifacts: bundle.artifacts,
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
      status: "failed",
      mode: options.mode,
      failed_at: deps.now().toISOString(),
      scope_fingerprint: scopeFingerprint,
      parent_execution_fingerprint: bundle.package.execution_fingerprint,
      parent_artifacts: bundle.artifacts,
      observed_model_calls: actualCalls.value,
      error_code: safeGi088FlashDailyRevisionErrorCode(error)
    }).catch(() => undefined);
    throw error;
  }
}

export function safeGi088FlashDailyRevisionErrorCode(error: unknown) {
  if (error instanceof Gi088FlashDailyRevisionError) return error.code;
  return safeGi088CalibrationErrorCode(error);
}

export async function mainGi088FlashDailyRevisionCli() {
  const options = parseGi088FlashDailyRevisionArgs(process.argv.slice(2));
  const result = await runGi088FlashDailyRevision(options);
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
