import {
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  unlink
} from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import {
  assertLocalJournalEvaluationEnvironment,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import type {
  JournalExtensionCaseStatus,
  JournalExtensionCaseSummary,
  JournalExtensionCaseView,
  JournalExtensionGateView,
  JournalExtensionRecordDecisionView,
  JournalExtensionRecordDraftView,
  JournalExtensionRecordIssueTag,
  JournalQualityVerdict,
  JournalReviewRecordCardView,
  JournalRound2DraftView,
  JournalRound2IssueTag,
  JournalRound2Score,
  JournalRound2ScoreKey,
  JournalRound2Scores
} from "@/components/journal-evaluation/types";
import {
  GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
} from "../../../../scripts/journal-generation-eval/gi088-human-extension-contract";
import {
  type Gi088ExtensionRecordReviewAdmission
} from "../../../../scripts/journal-generation-eval/gi088-human-extension-record-admission";
import {
  loadCommittedGi088ExtensionRecordReviewAdmission,
  type LoadedGi088ExtensionRecordReviewAdmission
} from "../../../../scripts/journal-generation-eval/run-gi088-human-extension-record-review-admission";
import {
  loadCommittedGi088ExtensionRecordRound,
  type Gi088ExtensionRecordCase,
  type LoadedGi088ExtensionRecordRound
} from "../../../../scripts/journal-generation-eval/run-gi088-human-extension-records";
import {
  loadCommittedGi088ExtensionDailyRound,
  type LoadedGi088ExtensionDailyRound
} from "../../../../scripts/journal-generation-eval/run-gi088-human-extension-daily";
import { sha256Canonical } from "../../../../scripts/journal-generation-eval/gi088-calibration-contract";

export { isLocalJournalEvaluationEnabled, isLocalJournalEvaluationRequest };

const PRIVATE_ROOT = resolve(
  process.cwd(),
  "artifacts/journal-generation-evaluation/.private"
);
const DEFAULT_RECORD_ROOT = resolve(PRIVATE_ROOT, "formal/extension/record-cards");
const DEFAULT_RECORD_ADMISSION_ROOT = resolve(
  PRIVATE_ROOT,
  "formal/extension/record-review-admissions"
);
const REVIEW_EVENTS_FILE = "record-card-review-events.ndjson";
const REVIEW_DRAFTS_FILE = "record-card-review-drafts.ndjson";
const REVIEW_LOCK_FILE = ".record-card-review-write.lock";
const DEFAULT_DAILY_ROOT = resolve(PRIVATE_ROOT, "formal/extension/daily-v3");
const DAILY_REVIEW_EVENTS_FILE = "daily-review-events.ndjson";
const DAILY_REVIEW_DRAFTS_FILE = "daily-review-drafts.ndjson";

const QUALITY_VERDICTS = new Set<JournalQualityVerdict>([
  "ready_to_use",
  "minor_edit",
  "major_rewrite",
  "quality_failure"
]);
const ISSUE_TAGS = new Set<JournalExtensionRecordIssueTag>([
  "fact_or_source_error",
  "content_omission",
  "unnatural_language",
  "insight_error",
  "title_or_time_error",
  "no_material_issue",
  "other"
]);
const DAILY_ISSUE_TAGS = new Set<JournalRound2IssueTag>([
  "fact_or_source_error",
  "content_omission",
  "fragmented_structure",
  "question_answer_trace",
  "unnatural_language",
  "insight_not_integrated",
  "over_inference",
  "no_material_issue",
  "other"
]);
const SCORE_KEYS: JournalRound2ScoreKey[] = [
  "fidelity_completeness",
  "structure_coherence",
  "language_naturalness",
  "insight_integration"
];

type ReviewEvent = Record<string, unknown>;

interface InternalRecordDecision {
  event: ReviewEvent;
  view: JournalExtensionRecordDecisionView;
  confirmation: JournalExtensionCaseView["record_confirmation"];
}

interface LoadedExtensionRecordReviewRound extends LoadedGi088ExtensionRecordRound {
  sealed_admission_round: LoadedGi088ExtensionRecordReviewAdmission;
  sealed_admissions: Map<string, Gi088ExtensionRecordReviewAdmission>;
}

function admissionKey(caseId: string, candidateId: string) {
  return `${caseId}\u0000${candidateId}`;
}

function sealedAdmissionForCase(
  round: LoadedExtensionRecordReviewRound,
  recordCase: Gi088ExtensionRecordCase
) {
  const admission = round.sealed_admissions.get(
    admissionKey(recordCase.case_id, recordCase.candidate.candidate_id)
  );
  if (!admission) throw new Error("JOURNAL_EXTENSION_RECORD_ADMISSION_CASE_MISSING");
  return admission;
}

function publicCaseId(index: number) {
  return `extension-case-${String(index + 1).padStart(2, "0")}`;
}

function labelForIndex(index: number) {
  return `案例 ${String(index + 1).padStart(2, "0")}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertContained(path: string) {
  const fromPrivate = relative(PRIVATE_ROOT, path);
  if (!fromPrivate || fromPrivate === ".." || fromPrivate.startsWith(`..${sep}`)) {
    throw new Error("JOURNAL_EXTENSION_PRIVATE_PATH_REQUIRED");
  }
}

async function resolveContainedDirectory(path: string) {
  assertContained(path);
  const [privateReal, directoryReal] = await Promise.all([
    realpath(PRIVATE_ROOT),
    realpath(path)
  ]);
  const fromPrivate = relative(privateReal, directoryReal);
  if (!fromPrivate || fromPrivate === ".." || fromPrivate.startsWith(`..${sep}`)) {
    throw new Error("JOURNAL_EXTENSION_PRIVATE_PATH_REQUIRED");
  }
  return directoryReal;
}

async function discoverRecordDirectory() {
  const configured = process.env.JOURNAL_EVALUATION_EXTENSION_RECORD_DIRECTORY?.trim();
  if (configured) return await resolveContainedDirectory(resolve(configured));
  let entries: string[];
  try {
    entries = await readdir(DEFAULT_RECORD_ROOT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const candidates = entries.filter((entry) =>
    entry.startsWith(`${GI088_HUMAN_EXTENSION_RECORD_ROUND_ID}-`)
  );
  const committed: string[] = [];
  for (const entry of candidates) {
    const directory = resolve(DEFAULT_RECORD_ROOT, entry);
    try {
      const manifest = JSON.parse(
        await readFile(resolve(directory, "commit-manifest.json"), "utf8")
      ) as Record<string, unknown>;
      if (manifest.status === "committed") committed.push(directory);
    } catch {
      // 未完成目录保留为失败证据，不进入评审入口。
    }
  }
  if (committed.length === 0) return null;
  if (committed.length !== 1) {
    throw new Error("JOURNAL_EXTENSION_RECORD_COMMITTED_ROUND_AMBIGUOUS");
  }
  return await resolveContainedDirectory(committed[0]);
}

async function discoverRecordAdmissionDirectories() {
  const configured = process.env.JOURNAL_EVALUATION_EXTENSION_RECORD_ADMISSION_DIRECTORY?.trim();
  if (configured) return [await resolveContainedDirectory(resolve(configured))];
  let entries: string[];
  try {
    entries = await readdir(DEFAULT_RECORD_ADMISSION_ROOT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const committed: string[] = [];
  for (const entry of entries.filter((item) =>
    item.startsWith("gi088-human-extension-record-review-admission-")
  )) {
    const directory = resolve(DEFAULT_RECORD_ADMISSION_ROOT, entry);
    try {
      const manifest = JSON.parse(
        await readFile(resolve(directory, "commit-manifest.json"), "utf8")
      ) as Record<string, unknown>;
      if (manifest.status === "committed") committed.push(directory);
    } catch {
      // 未完成续包保留为运行证据，不进入评审入口。
    }
  }
  return await Promise.all(committed.map(async (directory) =>
    await resolveContainedDirectory(directory)
  ));
}

function recordRoundParentIdentity(round: LoadedGi088ExtensionRecordRound) {
  return {
    execution_fingerprint: round.package.execution_fingerprint,
    scope_fingerprint: round.package.scope_fingerprint,
    artifacts: {
      package_sha256: round.artifactSha256.package,
      manifest_sha256: round.artifactSha256.manifest,
      attempt_ledger_sha256: round.artifactSha256.attempt_ledger,
      run_lock_sha256: round.artifactSha256.run_lock
    }
  };
}

async function loadSealedRecordAdmissions(round: LoadedGi088ExtensionRecordRound) {
  const expectedParent = recordRoundParentIdentity(round);
  const directories = await discoverRecordAdmissionDirectories();
  if (directories.length === 0) {
    throw new Error("JOURNAL_EXTENSION_RECORD_ADMISSION_UNAVAILABLE");
  }
  const configured = Boolean(
    process.env.JOURNAL_EVALUATION_EXTENSION_RECORD_ADMISSION_DIRECTORY?.trim()
  );
  const compatible: LoadedGi088ExtensionRecordReviewAdmission[] = [];
  let configuredParentMismatch = false;
  for (const directory of directories) {
    try {
      const admissionRound = await loadCommittedGi088ExtensionRecordReviewAdmission(
        directory,
        process.cwd(),
        {
          allowMockParent: process.env.JOURNAL_EVALUATION_EXTENSION_ALLOW_MOCK === "I_UNDERSTAND"
        }
      );
      const actualParent = {
        execution_fingerprint: admissionRound.package.parent.execution_fingerprint,
        scope_fingerprint: admissionRound.package.parent.scope_fingerprint,
        artifacts: admissionRound.package.parent.artifacts
      };
      if (sha256Canonical(actualParent) === sha256Canonical(expectedParent)) {
        compatible.push(admissionRound);
      } else if (configured) {
        configuredParentMismatch = true;
      }
    } catch (error) {
      if (configured) throw error;
      // A sealed historical continuation can remain immutable after its
      // implementation snapshot becomes obsolete. The current package must
      // still pass every binding before it is returned below.
    }
  }
  if (compatible.length === 0) {
    if (configuredParentMismatch) {
      throw new Error("JOURNAL_EXTENSION_RECORD_ADMISSION_PARENT_MISMATCH");
    }
    throw new Error("JOURNAL_EXTENSION_RECORD_ADMISSION_CURRENT_EVIDENCE_UNAVAILABLE");
  }
  if (compatible.length !== 1) {
    throw new Error("JOURNAL_EXTENSION_RECORD_ADMISSION_COMMITTED_ROUND_AMBIGUOUS");
  }
  const admissionRound = compatible[0];
  const sealed = new Map<string, Gi088ExtensionRecordReviewAdmission>();
  for (const recordCase of round.package.cases) {
    const admissionCase = admissionRound.package.cases.find((item) =>
      item.case_id === recordCase.case_id
      && item.candidate_id === recordCase.candidate.candidate_id
    );
    const card = recordCase.candidate.record_card;
    if (!admissionCase
      || !card
      || !recordCase.candidate.trace.raw_response_sha256
      || admissionCase.raw_response_sha256 !== recordCase.candidate.trace.raw_response_sha256
      || admissionCase.record_card_sha256 !== sha256Canonical(card)
      || !admissionCase.review_ready) {
      throw new Error("JOURNAL_EXTENSION_RECORD_ADMISSION_CASE_MISMATCH");
    }
    sealed.set(admissionKey(recordCase.case_id, recordCase.candidate.candidate_id), {
      reviewReady: true,
      normalized: admissionCase.normalized,
      normalizationFingerprint: admissionCase.normalization_fingerprint
    });
  }
  if (sealed.size !== 6 || admissionRound.package.cases.length !== sealed.size) {
    throw new Error("JOURNAL_EXTENSION_RECORD_ADMISSION_CASE_SET_INVALID");
  }
  return { admissionRound, sealed };
}

async function loadRound(): Promise<LoadedExtensionRecordReviewRound | null> {
  assertLocalJournalEvaluationEnvironment();
  const directory = await discoverRecordDirectory();
  if (!directory) return null;
  const recordRound = await loadCommittedGi088ExtensionRecordRound(directory, {
    allowMock: process.env.JOURNAL_EVALUATION_EXTENSION_ALLOW_MOCK === "I_UNDERSTAND",
    allowCodeSnapshotDrift: true
  });
  const { admissionRound, sealed } = await loadSealedRecordAdmissions(recordRound);
  return {
    ...recordRound,
    sealed_admission_round: admissionRound,
    sealed_admissions: sealed
  };
}

async function discoverDailyDirectory() {
  const configured = process.env.JOURNAL_EVALUATION_EXTENSION_DAILY_DIRECTORY?.trim();
  if (configured) return await resolveContainedDirectory(resolve(configured));
  let entries: string[];
  try {
    entries = await readdir(DEFAULT_DAILY_ROOT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const committed: string[] = [];
  for (const entry of entries.filter((item) =>
    item.startsWith("gi088-human-extension-daily-v3-")
  )) {
    const directory = resolve(DEFAULT_DAILY_ROOT, entry);
    try {
      const manifest = JSON.parse(
        await readFile(resolve(directory, "commit-manifest.json"), "utf8")
      ) as Record<string, unknown>;
      if (manifest.status === "committed") committed.push(directory);
    } catch {
      // 未完成目录保留为运行证据。
    }
  }
  if (committed.length === 0) return null;
  if (committed.length !== 1) {
    throw new Error("JOURNAL_EXTENSION_DAILY_COMMITTED_ROUND_AMBIGUOUS");
  }
  return await resolveContainedDirectory(committed[0]);
}

async function loadDailyRound(recordRound: LoadedGi088ExtensionRecordRound) {
  const directory = await discoverDailyDirectory();
  if (!directory) return null;
  return await loadCommittedGi088ExtensionDailyRound(
    directory,
    recordRound.directory,
    {
      allowMock: process.env.JOURNAL_EVALUATION_EXTENSION_ALLOW_MOCK === "I_UNDERSTAND"
    }
  );
}

async function readNdjson(path: string) {
  try {
    return (await readFile(path, "utf8")).split(/\r?\n/u).flatMap((line) => {
      if (!line.trim()) return [];
      try {
        const value = JSON.parse(line) as unknown;
        return isObject(value) ? [value] : [];
      } catch {
        throw new Error("JOURNAL_EXTENSION_REVIEW_FILE_INVALID");
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function appendEvent(path: string, event: ReviewEvent) {
  await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
  const handle = await open(path, "a", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(event)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, 0o600);
}

async function withReviewLock<T>(directory: string, task: () => Promise<T>) {
  const lockPath = resolve(directory, REVIEW_LOCK_FILE);
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      handle = await open(lockPath, "wx", 0o600);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise<void>((resolveWait) => setTimeout(resolveWait, 10));
    }
  }
  if (!handle) throw new Error("JOURNAL_EXTENSION_REVIEW_BUSY");
  try {
    await handle.writeFile(`${process.pid}\n`, "utf8");
    await handle.sync();
    return await task();
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

function normalizeIssueTags(value: unknown): JournalExtensionRecordIssueTag[] {
  if (!Array.isArray(value)) throw new Error("JOURNAL_EXTENSION_ISSUE_TAGS_INVALID");
  const tags = [...new Set(value.map((item) => {
    if (typeof item !== "string" || !ISSUE_TAGS.has(item as JournalExtensionRecordIssueTag)) {
      throw new Error("JOURNAL_EXTENSION_ISSUE_TAGS_INVALID");
    }
    return item as JournalExtensionRecordIssueTag;
  }))];
  if (tags.includes("no_material_issue") && tags.length > 1) {
    throw new Error("JOURNAL_EXTENSION_ISSUE_TAGS_CONFLICT");
  }
  return tags;
}

function normalizeNote(value: unknown) {
  if (typeof value !== "string" || value.length > 1200) {
    throw new Error("JOURNAL_EXTENSION_NOTE_INVALID");
  }
  return value;
}

function normalizeEditedCard(value: unknown, fallback: JournalReviewRecordCardView) {
  if (!isObject(value)) return {
    title: fallback.title,
    text: fallback.text,
    insight: fallback.insight
  };
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const text = typeof value.text === "string" ? value.text.trim() : "";
  const insight = typeof value.insight === "string" ? value.insight.trim() : "";
  if (!title || [...title].length > 16 || !text
    || text.length > 12_000 || insight.length > 8_000) {
    throw new Error("JOURNAL_EXTENSION_EDITED_RECORD_CARD_INVALID");
  }
  return { title, text, insight };
}

function modelCard(recordCase: Gi088ExtensionRecordCase): JournalReviewRecordCardView | null {
  const card = recordCase.candidate.record_card;
  return card ? {
    record_card_id: card.record_card_id,
    title: card.title,
    text: card.text,
    insight: card.insight,
    source_refs: [...card.source_refs]
  } : null;
}

function presentationId(
  round: LoadedExtensionRecordReviewRound,
  recordCase: Gi088ExtensionRecordCase
) {
  const admission = sealedAdmissionForCase(round, recordCase);
  return sha256Canonical({
    roundId: round.package.round_id,
    executionFingerprint: round.package.execution_fingerprint,
    caseId: recordCase.case_id,
    candidateId: recordCase.candidate.candidate_id,
    recordCard: recordCase.candidate.record_card,
    ...(admission.normalizationFingerprint
      ? { recordAdmissionFingerprint: admission.normalizationFingerprint }
      : {})
  });
}

export function resolveJournalExtensionCaseId(publicId: string) {
  const match = /^extension-case-(0[1-6])$/u.exec(publicId);
  return match ? Number(match[1]) - 1 : null;
}

function loadDraftFromEvents(input: {
  events: ReviewEvent[];
  internalCaseId: string;
  publicCaseId: string;
  presentationId: string;
  reviewerId: string;
}): JournalExtensionRecordDraftView | null {
  const matches = input.events.filter((event) =>
    event.schema_version === "1.0"
    && event.event_type === "record_draft"
    && event.round_id === GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
    && event.case_id === input.internalCaseId
    && event.presentation_id === input.presentationId
    && event.reviewer_id === input.reviewerId
  );
  if (matches.length === 0) return null;
  const latest = [...matches].sort((left, right) =>
    Number(left.revision ?? 0) - Number(right.revision ?? 0)
  ).at(-1)!;
  if (!isObject(latest.edited_record_card)) {
    throw new Error("JOURNAL_EXTENSION_DRAFT_INVALID");
  }
  return {
    case_id: input.publicCaseId,
    presentation_id: input.presentationId,
    overall_verdict: typeof latest.overall_verdict === "string"
      && QUALITY_VERDICTS.has(latest.overall_verdict as JournalQualityVerdict)
      ? latest.overall_verdict as JournalQualityVerdict
      : null,
    issue_tags: normalizeIssueTags(latest.issue_tags ?? []),
    note: normalizeNote(latest.note ?? ""),
    edited_record_card: {
      title: String(latest.edited_record_card.title ?? ""),
      text: String(latest.edited_record_card.text ?? ""),
      insight: String(latest.edited_record_card.insight ?? "")
    },
    revision: Number(latest.revision),
    updated_at: String(latest.updated_at)
  };
}

function loadDecisionFromEvents(input: {
  events: ReviewEvent[];
  recordCase: Gi088ExtensionRecordCase;
  admission: Gi088ExtensionRecordReviewAdmission;
  internalCaseId: string;
  publicCaseId: string;
  presentationId: string;
  reviewerId: string;
}): InternalRecordDecision | null {
  const matches = input.events.filter((event) =>
    event.schema_version === "1.0"
    && event.event_type === "record_decision"
    && event.round_id === GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
    && event.case_id === input.internalCaseId
    && event.presentation_id === input.presentationId
    && event.reviewer_id === input.reviewerId
  );
  if (matches.length === 0) return null;
  if (matches.length !== 1) throw new Error("JOURNAL_EXTENSION_DECISION_DUPLICATE");
  const event = matches[0];
  if (typeof event.overall_verdict !== "string"
    || !QUALITY_VERDICTS.has(event.overall_verdict as JournalQualityVerdict)
    || typeof event.reviewed_at !== "string") {
    throw new Error("JOURNAL_EXTENSION_DECISION_INVALID");
  }
  const admission = input.admission;
  const original = input.recordCase.candidate.record_card;
  if (!original || typeof event.model_record_card_sha256 !== "string") {
    throw new Error("JOURNAL_EXTENSION_DECISION_BINDING_INVALID");
  }
  const eventAdmissionFingerprint = event.record_admission_fingerprint;
  if ((eventAdmissionFingerprint !== undefined && eventAdmissionFingerprint !== null
      && typeof eventAdmissionFingerprint !== "string")
    || (eventAdmissionFingerprint ?? null) !== admission.normalizationFingerprint
    || event.model_record_card_sha256 !== sha256Canonical(original)) {
    throw new Error("JOURNAL_EXTENSION_DECISION_BINDING_INVALID");
  }
  const issueTags = normalizeIssueTags(event.issue_tags ?? []);
  const noteAdditions = input.events.filter((noteEvent) =>
    noteEvent.schema_version === "1.0"
    && noteEvent.event_type === "record_note_added"
    && noteEvent.round_id === GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
    && noteEvent.case_id === input.internalCaseId
    && noteEvent.presentation_id === input.presentationId
    && noteEvent.reviewer_id === input.reviewerId
  ).map((noteEvent) => ({
    note: normalizeNote(noteEvent.note ?? ""),
    added_at: String(noteEvent.added_at)
  }));
  let confirmation: JournalExtensionCaseView["record_confirmation"] = null;
  if (isObject(event.confirmation) && isObject(event.confirmation.approved_record_card)) {
    const card = event.confirmation.approved_record_card;
    if (typeof card.record_card_id !== "string"
      || typeof card.event_id !== "string"
      || typeof card.title !== "string"
      || typeof card.text !== "string"
      || typeof card.insight !== "string"
      || !Array.isArray(card.source_refs)
      || card.source_refs.some((item) => typeof item !== "string")
      || typeof event.confirmation.approved_record_card_sha256 !== "string"
      || typeof event.confirmation.source_signature !== "string"
      || typeof event.confirmation.confirmed_at !== "string"
      || (event.confirmation.content_revision !== 1
        && event.confirmation.content_revision !== 2)
      || typeof event.confirmation.edited !== "boolean"
      || !card.title.trim()
      || [...card.title].length > 16
      || !card.text.trim()
      || card.text.length > 12_000
      || card.insight.length > 8_000) {
      throw new Error("JOURNAL_EXTENSION_CONFIRMATION_INVALID");
    }
    const approvedSha256 = sha256Canonical(card);
    const contentRevision = event.confirmation.content_revision;
    const expectedSourceSignature = sha256Canonical({
      caseId: input.recordCase.case_id,
      modelRecordCardSha256: sha256Canonical(original),
      approvedRecordCardSha256: approvedSha256,
      contentRevision,
      promptHash: input.recordCase.candidate.trace.prompt_hash,
      ...(admission.normalizationFingerprint
        ? { recordAdmissionFingerprint: admission.normalizationFingerprint }
        : {})
    });
    const originalSha256 = sha256Canonical(original);
    const matchesOriginalIdentity = card.record_card_id === original.record_card_id
      && card.event_id === original.event_id
      && sha256Canonical(card.source_refs) === sha256Canonical(original.source_refs);
    const confirmationMatchesVerdict = event.overall_verdict === "ready_to_use"
      ? !event.confirmation.edited
        && contentRevision === 1
        && approvedSha256 === originalSha256
      : event.overall_verdict === "minor_edit"
        ? event.confirmation.edited
          && contentRevision === 2
          && approvedSha256 !== originalSha256
        : false;
    if (!admission.reviewReady
      || issueTags.includes("fact_or_source_error")
      || !matchesOriginalIdentity
      || event.confirmation.approved_record_card_sha256 !== approvedSha256
      || event.confirmation.source_signature !== expectedSourceSignature
      || !confirmationMatchesVerdict) {
      throw new Error("JOURNAL_EXTENSION_CONFIRMATION_BINDING_INVALID");
    }
    confirmation = {
      approved_record_card: {
        record_card_id: card.record_card_id,
        title: card.title,
        text: card.text,
        insight: card.insight,
        source_refs: card.source_refs as string[]
      },
      approved_record_card_sha256: event.confirmation.approved_record_card_sha256,
      source_signature: event.confirmation.source_signature,
      content_revision: contentRevision,
      edited: event.confirmation.edited,
      confirmed_at: event.confirmation.confirmed_at
    };
  }
  return {
    event,
    view: {
      case_id: input.publicCaseId,
      presentation_id: input.presentationId,
      overall_verdict: event.overall_verdict as JournalQualityVerdict,
      issue_tags: issueTags,
      note: normalizeNote(event.note ?? ""),
      reviewed_at: event.reviewed_at,
      note_additions: noteAdditions
    },
    confirmation
  };
}

function normalizeDailyIssueTags(value: unknown): JournalRound2IssueTag[] {
  if (!Array.isArray(value)) throw new Error("JOURNAL_EXTENSION_DAILY_ISSUE_TAGS_INVALID");
  const tags = [...new Set(value.map((item) => {
    if (typeof item !== "string" || !DAILY_ISSUE_TAGS.has(item as JournalRound2IssueTag)) {
      throw new Error("JOURNAL_EXTENSION_DAILY_ISSUE_TAGS_INVALID");
    }
    return item as JournalRound2IssueTag;
  }))];
  if (tags.includes("no_material_issue") && tags.length > 1) {
    throw new Error("JOURNAL_EXTENSION_DAILY_ISSUE_TAGS_CONFLICT");
  }
  return tags;
}

function normalizeScores(value: unknown, complete: boolean): JournalRound2Scores {
  if (!isObject(value)) throw new Error("JOURNAL_EXTENSION_DAILY_SCORES_INVALID");
  return Object.fromEntries(SCORE_KEYS.map((key) => {
    const score = value[key];
    if (score === null && !complete) return [key, null];
    if (!Number.isInteger(score) || Number(score) < 1 || Number(score) > 5) {
      throw new Error("JOURNAL_EXTENSION_DAILY_SCORES_INVALID");
    }
    return [key, Number(score) as JournalRound2Score];
  })) as JournalRound2Scores;
}

function dailyPresentationId(
  round: LoadedGi088ExtensionDailyRound,
  caseIndex: number
) {
  const dailyCase = round.package.cases[caseIndex];
  return sha256Canonical({
    roundId: round.package.round_id,
    executionFingerprint: round.package.execution_fingerprint,
    caseId: dailyCase.case_id,
    candidateId: dailyCase.candidate.candidate_id,
    confirmationSetSha256: round.package.parent.confirmation_set_sha256,
    paragraphs: dailyCase.candidate.paragraphs
  });
}

function loadDailyDraftFromEvents(input: {
  events: ReviewEvent[];
  internalCaseId: string;
  publicCaseId: string;
  presentationId: string;
  reviewerId: string;
}): JournalRound2DraftView | null {
  const matches = input.events.filter((event) =>
    event.schema_version === "1.0"
    && event.event_type === "daily_draft"
    && event.case_id === input.internalCaseId
    && event.presentation_id === input.presentationId
    && event.reviewer_id === input.reviewerId
  );
  if (matches.length === 0) return null;
  const latest = [...matches].sort((left, right) =>
    Number(left.revision ?? 0) - Number(right.revision ?? 0)
  ).at(-1)!;
  return {
    case_id: input.publicCaseId,
    round_id: "gi088-human-extension-daily-v3",
    presentation_id: input.presentationId,
    overall_verdict: typeof latest.overall_verdict === "string"
      && QUALITY_VERDICTS.has(latest.overall_verdict as JournalQualityVerdict)
      ? latest.overall_verdict as JournalQualityVerdict
      : null,
    scores: normalizeScores(latest.scores, false),
    issue_tags: normalizeDailyIssueTags(latest.issue_tags ?? []),
    note: normalizeNote(latest.note ?? ""),
    revision: Number(latest.revision),
    updated_at: String(latest.updated_at)
  };
}

function loadDailyDecisionFromEvents(input: {
  events: ReviewEvent[];
  internalCaseId: string;
  publicCaseId: string;
  presentationId: string;
  reviewerId: string;
}): JournalExtensionCaseView["daily_decision"] {
  const matches = input.events.filter((event) =>
    event.schema_version === "1.0"
    && event.event_type === "daily_decision"
    && event.case_id === input.internalCaseId
    && event.presentation_id === input.presentationId
    && event.reviewer_id === input.reviewerId
  );
  if (matches.length === 0) return null;
  if (matches.length !== 1) throw new Error("JOURNAL_EXTENSION_DAILY_DECISION_DUPLICATE");
  const event = matches[0];
  if (typeof event.overall_verdict !== "string"
    || !QUALITY_VERDICTS.has(event.overall_verdict as JournalQualityVerdict)
    || typeof event.reviewed_at !== "string") {
    throw new Error("JOURNAL_EXTENSION_DAILY_DECISION_INVALID");
  }
  const scores = normalizeScores(event.scores, true);
  const noteAdditions = input.events.filter((noteEvent) =>
    noteEvent.schema_version === "1.0"
    && noteEvent.event_type === "daily_note_added"
    && noteEvent.case_id === input.internalCaseId
    && noteEvent.presentation_id === input.presentationId
    && noteEvent.reviewer_id === input.reviewerId
  ).map((noteEvent) => ({
    note: normalizeNote(noteEvent.note ?? ""),
    added_at: String(noteEvent.added_at)
  }));
  return {
    case_id: input.publicCaseId,
    presentation_id: input.presentationId,
    overall_verdict: event.overall_verdict as JournalQualityVerdict,
    scores: scores as Record<JournalRound2ScoreKey, JournalRound2Score>,
    issue_tags: normalizeDailyIssueTags(event.issue_tags ?? []),
    note: normalizeNote(event.note ?? ""),
    reviewed_at: event.reviewed_at,
    note_additions: noteAdditions
  };
}

function recordStatus(input: {
  recordCase: Gi088ExtensionRecordCase;
  admission: Gi088ExtensionRecordReviewAdmission;
  draft: JournalExtensionRecordDraftView | null;
  decision: InternalRecordDecision | null;
  allConfirmed: boolean;
}): JournalExtensionCaseStatus {
  if (!input.admission.reviewReady) {
    return "blocked";
  }
  if (input.decision?.confirmation) {
    return input.allConfirmed ? "daily_awaiting_generation" : "confirmed";
  }
  if (input.decision) return "blocked";
  if (input.draft?.overall_verdict === "minor_edit") return "editing_required";
  return "awaiting_review";
}

async function loadReviewState(round: LoadedExtensionRecordReviewRound, reviewerId: string) {
  const [events, drafts] = await Promise.all([
    readNdjson(resolve(round.directory, REVIEW_EVENTS_FILE)),
    readNdjson(resolve(round.directory, REVIEW_DRAFTS_FILE))
  ]);
  const rows = round.package.cases.map((recordCase, index) => {
    const publicId = publicCaseId(index);
    const presentation = presentationId(round, recordCase);
    const admission = sealedAdmissionForCase(round, recordCase);
    return {
      recordCase,
      admission,
      index,
      publicId,
      presentation,
      draft: loadDraftFromEvents({
        events: drafts,
        internalCaseId: recordCase.case_id,
        publicCaseId: publicId,
        presentationId: presentation,
        reviewerId
      }),
      decision: loadDecisionFromEvents({
        events,
        recordCase,
        admission,
        internalCaseId: recordCase.case_id,
        publicCaseId: publicId,
        presentationId: presentation,
        reviewerId
      })
    };
  });
  const confirmedCount = rows.filter((row) => row.decision?.confirmation).length;
  const blockedCount = rows.filter((row) =>
    !row.admission.reviewReady || Boolean(row.decision && !row.decision.confirmation)
  ).length;
  const allConfirmed = confirmedCount === 6;
  const gate: JournalExtensionGateView = {
    stage: "record_card",
    state: blockedCount > 0 ? "fail" : allConfirmed ? "pass" : "pending",
    confirmed_records: confirmedCount,
    reviewed_diaries: 0,
    total_cases: 6,
    reasons: [
      ...(blockedCount > 0 ? [`${blockedCount} 个案例已受阻`] : []),
      ...(!allConfirmed && blockedCount === 0 ? [`已确认 ${confirmedCount}/6 张记录卡`] : []),
      ...(allConfirmed ? ["六张记录卡均已确认，可以生成今日日记"] : [])
    ]
  };
  return { rows, gate, allConfirmed };
}

async function loadDailyReviewState(
  dailyRound: LoadedGi088ExtensionDailyRound,
  reviewerId: string
) {
  const [events, drafts] = await Promise.all([
    readNdjson(resolve(dailyRound.directory, DAILY_REVIEW_EVENTS_FILE)),
    readNdjson(resolve(dailyRound.directory, DAILY_REVIEW_DRAFTS_FILE))
  ]);
  const rows = dailyRound.package.cases.map((dailyCase, index) => {
    const publicId = publicCaseId(index);
    const presentation = dailyPresentationId(dailyRound, index);
    return {
      dailyCase,
      index,
      publicId,
      presentation,
      draft: loadDailyDraftFromEvents({
        events: drafts,
        internalCaseId: dailyCase.case_id,
        publicCaseId: publicId,
        presentationId: presentation,
        reviewerId
      }),
      decision: loadDailyDecisionFromEvents({
        events,
        internalCaseId: dailyCase.case_id,
        publicCaseId: publicId,
        presentationId: presentation,
        reviewerId
      })
    };
  });
  const reviewedCount = rows.filter((row) => row.decision).length;
  const blockedCount = rows.filter((row) => !row.dailyCase.candidate.program_check.admitted).length
    + rows.filter((row) => row.decision
      && (row.decision.overall_verdict === "major_rewrite"
        || row.decision.overall_verdict === "quality_failure")
    ).length;
  const gate: JournalExtensionGateView = {
    stage: "daily_journal",
    state: blockedCount > 0 ? "fail" : reviewedCount === 6 ? "pass" : "pending",
    confirmed_records: 6,
    reviewed_diaries: reviewedCount,
    total_cases: 6,
    reasons: [
      ...(blockedCount > 0 ? [`${blockedCount} 个日记案例已受阻`] : []),
      ...(reviewedCount < 6 && blockedCount === 0 ? [`已评价 ${reviewedCount}/6 篇日记`] : []),
      ...(reviewedCount === 6 && blockedCount === 0 ? ["六篇今日日记均已完成评价"] : [])
    ]
  };
  return { rows, gate };
}

export async function listJournalExtensionCases(reviewerId: string): Promise<{
  cases: JournalExtensionCaseSummary[];
  gate: JournalExtensionGateView;
}> {
  const round = await loadRound();
  if (!round) {
    return {
      cases: [],
      gate: {
        stage: "record_card",
        state: "pending",
        confirmed_records: 0,
        reviewed_diaries: 0,
        total_cases: 6,
        reasons: ["等待六张记录卡生成"]
      }
    };
  }
  const dailyRound = await loadDailyRound(round);
  if (dailyRound) {
    const state = await loadDailyReviewState(dailyRound, reviewerId);
    return {
      cases: state.rows.map((row) => ({
        case_id: row.publicId,
        label: labelForIndex(row.index),
        status: !row.dailyCase.candidate.program_check.admitted
          ? "blocked" as const
          : row.decision ? "completed" as const : "daily_awaiting_review" as const,
        stage: "daily_journal" as const,
        review_ready: row.dailyCase.candidate.program_check.admitted
      })),
      gate: state.gate
    };
  }
  const state = await loadReviewState(round, reviewerId);
  return {
    cases: state.rows.map((row) => ({
      case_id: row.publicId,
      label: labelForIndex(row.index),
      status: recordStatus({
        recordCase: row.recordCase,
        admission: row.admission,
        draft: row.draft,
        decision: row.decision,
        allConfirmed: state.allConfirmed
      }),
      stage: "record_card",
      review_ready: row.admission.reviewReady
    })),
    gate: state.gate
  };
}

export async function loadJournalExtensionCase(
  publicId: string,
  reviewerId: string
): Promise<JournalExtensionCaseView | null> {
  const round = await loadRound();
  if (!round) return null;
  const index = resolveJournalExtensionCaseId(publicId);
  if (index === null) return null;
  const dailyRound = await loadDailyRound(round);
  if (dailyRound) {
    const [state, recordState] = await Promise.all([
      loadDailyReviewState(dailyRound, reviewerId),
      loadReviewState(round, reviewerId)
    ]);
    const row = state.rows[index];
    const recordRow = recordState.rows[index];
    if (!row) return null;
    if (!recordRow?.decision?.confirmation) {
      throw new Error("JOURNAL_EXTENSION_RECORD_CONFIRMATION_UNAVAILABLE");
    }
    const confirmation = dailyRound.confirmations.confirmations[index];
    const source = dailyRound.confirmations.recordRound.sourceBundle.sources[index];
    const original = confirmation.originalRecordCard;
    return {
      case_id: row.publicId,
      label: labelForIndex(index),
      stage: "daily_journal",
      status: !row.dailyCase.candidate.program_check.admitted
        ? "blocked" : row.decision ? "completed" : "daily_awaiting_review",
      presentation_id: row.presentation,
      review_ready: row.dailyCase.candidate.program_check.admitted,
      transcript: source.projection.transcript
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          message_id: message.ref.replace(/^(?:message|context:assistant):/u, ""),
          role: message.role as "user" | "assistant",
          content: message.content
        })),
      model_record_card: {
        record_card_id: original.record_card_id,
        title: original.title,
        text: original.text,
        insight: original.insight,
        source_refs: [...original.source_refs]
      },
      occurred_at_text: null,
      program_check: row.decision ? {
        admitted: row.dailyCase.candidate.program_check.admitted,
        metrics: {},
        failures: row.dailyCase.candidate.program_check.failures.map((failure) => ({
          code: failure.code,
          message: failure.message,
          refs: failure.refs
        }))
      } : null,
      record_draft: null,
      record_decision: recordRow.decision.view,
      record_confirmation: {
        approved_record_card: {
          record_card_id: confirmation.approvedRecordCard.record_card_id,
          title: confirmation.approvedRecordCard.title,
          text: confirmation.approvedRecordCard.text,
          insight: confirmation.approvedRecordCard.insight,
          source_refs: [...confirmation.approvedRecordCard.source_refs]
        },
        approved_record_card_sha256: confirmation.approvedRecordCardSha256,
        source_signature: confirmation.sourceSignature,
        content_revision: confirmation.contentRevision,
        edited: confirmation.edited,
        confirmed_at: confirmation.confirmedAt
      },
      daily_candidate: {
        title: row.dailyCase.candidate.title,
        paragraphs: row.dailyCase.candidate.paragraphs.map((paragraph) => paragraph.text),
        paragraph_sources: row.dailyCase.candidate.paragraphs.map((paragraph) => ({
          source_refs: paragraph.source_refs,
          record_card_refs: paragraph.record_card_refs
        })),
        program_check: row.decision ? {
          admitted: row.dailyCase.candidate.program_check.admitted,
          metrics: {},
          failures: row.dailyCase.candidate.program_check.failures.map((failure) => ({
            code: failure.code,
            message: failure.message,
            refs: failure.refs
          }))
        } : null
      },
      daily_draft: row.draft,
      daily_decision: row.decision,
      gate: state.gate
    };
  }
  const state = await loadReviewState(round, reviewerId);
  const row = state.rows[index];
  if (!row) return null;
  const source = round.sourceBundle.sources.find(
    (item) => item.selection.caseId === row.recordCase.case_id
  );
  if (!source) throw new Error("JOURNAL_EXTENSION_SOURCE_MISSING");
  return {
    case_id: row.publicId,
    label: labelForIndex(index),
    stage: "record_card",
    status: recordStatus({
      recordCase: row.recordCase,
      admission: row.admission,
      draft: row.draft,
      decision: row.decision,
      allConfirmed: state.allConfirmed
    }),
    presentation_id: row.presentation,
    review_ready: row.admission.reviewReady,
    transcript: source.projection.transcript
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        message_id: message.ref.replace(/^(?:message|context:assistant):/u, ""),
        role: message.role as "user" | "assistant",
        content: message.content
      })),
    model_record_card: modelCard(row.recordCase),
    occurred_at_text: row.recordCase.candidate.occurred_at_text,
    program_check: row.decision ? {
      admitted: row.admission.reviewReady,
      metrics: {},
      failures: (row.admission.reviewReady
        ? [] : row.recordCase.candidate.program_check.failures).map((failure) => ({
        code: failure.code,
        message: failure.message,
        refs: failure.refs
      }))
    } : null,
    record_draft: row.draft,
    record_decision: row.decision?.view ?? null,
    record_confirmation: row.decision?.confirmation ?? null,
    daily_candidate: null,
    daily_draft: null,
    daily_decision: null,
    gate: state.gate
  };
}

async function requireCaseContext(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
}) {
  const round = await loadRound();
  if (!round) throw new Error("JOURNAL_EXTENSION_RECORD_ROUND_UNAVAILABLE");
  const index = resolveJournalExtensionCaseId(input.publicId);
  if (index === null) throw new Error("JOURNAL_EXTENSION_CASE_NOT_FOUND");
  const recordCase = round.package.cases[index];
  const presentation = presentationId(round, recordCase);
  if (presentation !== input.presentationId) {
    throw new Error("JOURNAL_EXTENSION_PRESENTATION_MISMATCH");
  }
  const card = modelCard(recordCase);
  if (!card) throw new Error("JOURNAL_EXTENSION_RECORD_CARD_UNAVAILABLE");
  const admission = sealedAdmissionForCase(round, recordCase);
  return { round, index, recordCase, presentation, card, admission };
}

export async function saveJournalExtensionRecordDraft(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
  overallVerdict: JournalQualityVerdict | null;
  issueTags: JournalExtensionRecordIssueTag[];
  note: string;
  editedRecordCard: unknown;
}) {
  const context = await requireCaseContext(input);
  if (!context.admission.reviewReady) {
    throw new Error("JOURNAL_EXTENSION_RECORD_CARD_BLOCKED");
  }
  return await withReviewLock(context.round.directory, async () => {
    const eventsPath = resolve(context.round.directory, REVIEW_EVENTS_FILE);
    const draftsPath = resolve(context.round.directory, REVIEW_DRAFTS_FILE);
    const decisions = await readNdjson(eventsPath);
    if (loadDecisionFromEvents({
      events: decisions,
      recordCase: context.recordCase,
      admission: context.admission,
      internalCaseId: context.recordCase.case_id,
      publicCaseId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    })) throw new Error("JOURNAL_EXTENSION_RECORD_ALREADY_DECIDED");
    const drafts = await readNdjson(draftsPath);
    const current = loadDraftFromEvents({
      events: drafts,
      internalCaseId: context.recordCase.case_id,
      publicCaseId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    });
    const overallVerdict = input.overallVerdict;
    if (overallVerdict !== null && !QUALITY_VERDICTS.has(overallVerdict)) {
      throw new Error("JOURNAL_EXTENSION_VERDICT_INVALID");
    }
    const edited = normalizeEditedCard(input.editedRecordCard, context.card);
    await appendEvent(draftsPath, {
      schema_version: "1.0",
      event_type: "record_draft",
      round_id: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
      case_id: context.recordCase.case_id,
      presentation_id: input.presentationId,
      reviewer_id: input.reviewerId,
      overall_verdict: overallVerdict,
      issue_tags: normalizeIssueTags(input.issueTags),
      note: normalizeNote(input.note),
      edited_record_card: edited,
      revision: (current?.revision ?? 0) + 1,
      updated_at: new Date().toISOString()
    });
  });
}

export async function decideJournalExtensionRecord(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
  overallVerdict: JournalQualityVerdict;
  issueTags: JournalExtensionRecordIssueTag[];
  note: string;
  editedRecordCard: unknown;
}) {
  const context = await requireCaseContext(input);
  return await withReviewLock(context.round.directory, async () => {
    const eventsPath = resolve(context.round.directory, REVIEW_EVENTS_FILE);
    const events = await readNdjson(eventsPath);
    if (loadDecisionFromEvents({
      events,
      recordCase: context.recordCase,
      admission: context.admission,
      internalCaseId: context.recordCase.case_id,
      publicCaseId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    })) throw new Error("JOURNAL_EXTENSION_RECORD_ALREADY_DECIDED");
    if (!QUALITY_VERDICTS.has(input.overallVerdict)) {
      throw new Error("JOURNAL_EXTENSION_VERDICT_INVALID");
    }
    const issueTags = normalizeIssueTags(input.issueTags);
    const note = normalizeNote(input.note);
    const canConfirm = context.admission.reviewReady
      && !issueTags.includes("fact_or_source_error")
      && (input.overallVerdict === "ready_to_use" || input.overallVerdict === "minor_edit");
    let confirmation: Record<string, unknown> | null = null;
    if (canConfirm) {
      const original = context.recordCase.candidate.record_card;
      if (!original) throw new Error("JOURNAL_EXTENSION_RECORD_CARD_UNAVAILABLE");
      const editedFields = normalizeEditedCard(input.editedRecordCard, context.card);
      const approved = input.overallVerdict === "ready_to_use"
        ? original
        : { ...original, ...editedFields };
      const edited = sha256Canonical(approved) !== sha256Canonical(original);
      if (input.overallVerdict === "minor_edit" && !edited) {
        throw new Error("JOURNAL_EXTENSION_MINOR_EDIT_REQUIRED");
      }
      const contentRevision = edited ? 2 : 1;
      const approvedRecordCardSha256 = sha256Canonical(approved);
      confirmation = {
        approved_record_card: approved,
        approved_record_card_sha256: approvedRecordCardSha256,
        source_signature: sha256Canonical({
          caseId: context.recordCase.case_id,
          modelRecordCardSha256: sha256Canonical(original),
          approvedRecordCardSha256,
          contentRevision,
          promptHash: context.recordCase.candidate.trace.prompt_hash,
          ...(context.admission.normalizationFingerprint
            ? { recordAdmissionFingerprint: context.admission.normalizationFingerprint }
            : {})
        }),
        content_revision: contentRevision,
        edited,
        confirmed_at: new Date().toISOString()
      };
    }
    await appendEvent(eventsPath, {
      schema_version: "1.0",
      event_type: "record_decision",
      round_id: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
      case_id: context.recordCase.case_id,
      presentation_id: input.presentationId,
      reviewer_id: input.reviewerId,
      overall_verdict: input.overallVerdict,
      issue_tags: issueTags,
      note,
      model_record_card_sha256: sha256Canonical(context.recordCase.candidate.record_card),
      ...(context.admission.normalizationFingerprint
        ? { record_admission_fingerprint: context.admission.normalizationFingerprint }
        : {}),
      confirmation,
      reviewed_at: new Date().toISOString()
    });
  });
}

export async function addJournalExtensionRecordNote(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
  note: string;
}) {
  const context = await requireCaseContext(input);
  return await withReviewLock(context.round.directory, async () => {
    const eventsPath = resolve(context.round.directory, REVIEW_EVENTS_FILE);
    const events = await readNdjson(eventsPath);
    if (!loadDecisionFromEvents({
      events,
      recordCase: context.recordCase,
      admission: context.admission,
      internalCaseId: context.recordCase.case_id,
      publicCaseId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    })) throw new Error("JOURNAL_EXTENSION_RECORD_DECISION_REQUIRED");
    await appendEvent(eventsPath, {
      schema_version: "1.0",
      event_type: "record_note_added",
      round_id: GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
      case_id: context.recordCase.case_id,
      presentation_id: input.presentationId,
      reviewer_id: input.reviewerId,
      note: normalizeNote(input.note),
      added_at: new Date().toISOString()
    });
  });
}

async function requireDailyCaseContext(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
}) {
  const recordRound = await loadRound();
  if (!recordRound) throw new Error("JOURNAL_EXTENSION_RECORD_ROUND_UNAVAILABLE");
  const dailyRound = await loadDailyRound(recordRound);
  if (!dailyRound) throw new Error("JOURNAL_EXTENSION_DAILY_ROUND_UNAVAILABLE");
  const index = resolveJournalExtensionCaseId(input.publicId);
  if (index === null) throw new Error("JOURNAL_EXTENSION_CASE_NOT_FOUND");
  const dailyCase = dailyRound.package.cases[index];
  const presentation = dailyPresentationId(dailyRound, index);
  if (presentation !== input.presentationId) {
    throw new Error("JOURNAL_EXTENSION_PRESENTATION_MISMATCH");
  }
  return { dailyRound, index, dailyCase, presentation };
}

export async function saveJournalExtensionDailyDraft(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
  overallVerdict: JournalQualityVerdict | null;
  scores: JournalRound2Scores;
  issueTags: JournalRound2IssueTag[];
  note: string;
}) {
  const context = await requireDailyCaseContext(input);
  if (!context.dailyCase.candidate.program_check.admitted) {
    throw new Error("JOURNAL_EXTENSION_DAILY_CANDIDATE_BLOCKED");
  }
  return await withReviewLock(context.dailyRound.directory, async () => {
    const eventsPath = resolve(context.dailyRound.directory, DAILY_REVIEW_EVENTS_FILE);
    const draftsPath = resolve(context.dailyRound.directory, DAILY_REVIEW_DRAFTS_FILE);
    const events = await readNdjson(eventsPath);
    if (loadDailyDecisionFromEvents({
      events,
      internalCaseId: context.dailyCase.case_id,
      publicCaseId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    })) throw new Error("JOURNAL_EXTENSION_DAILY_ALREADY_DECIDED");
    const drafts = await readNdjson(draftsPath);
    const current = loadDailyDraftFromEvents({
      events: drafts,
      internalCaseId: context.dailyCase.case_id,
      publicCaseId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    });
    if (input.overallVerdict !== null && !QUALITY_VERDICTS.has(input.overallVerdict)) {
      throw new Error("JOURNAL_EXTENSION_VERDICT_INVALID");
    }
    await appendEvent(draftsPath, {
      schema_version: "1.0",
      event_type: "daily_draft",
      round_id: "gi088-human-extension-daily-v3",
      case_id: context.dailyCase.case_id,
      presentation_id: input.presentationId,
      reviewer_id: input.reviewerId,
      overall_verdict: input.overallVerdict,
      scores: normalizeScores(input.scores, false),
      issue_tags: normalizeDailyIssueTags(input.issueTags),
      note: normalizeNote(input.note),
      revision: (current?.revision ?? 0) + 1,
      updated_at: new Date().toISOString()
    });
  });
}

export async function decideJournalExtensionDaily(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
  overallVerdict: JournalQualityVerdict;
  scores: JournalRound2Scores;
  issueTags: JournalRound2IssueTag[];
  note: string;
}) {
  const context = await requireDailyCaseContext(input);
  if (!context.dailyCase.candidate.program_check.admitted) {
    throw new Error("JOURNAL_EXTENSION_DAILY_CANDIDATE_BLOCKED");
  }
  return await withReviewLock(context.dailyRound.directory, async () => {
    const eventsPath = resolve(context.dailyRound.directory, DAILY_REVIEW_EVENTS_FILE);
    const events = await readNdjson(eventsPath);
    if (loadDailyDecisionFromEvents({
      events,
      internalCaseId: context.dailyCase.case_id,
      publicCaseId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    })) throw new Error("JOURNAL_EXTENSION_DAILY_ALREADY_DECIDED");
    if (!QUALITY_VERDICTS.has(input.overallVerdict)) {
      throw new Error("JOURNAL_EXTENSION_VERDICT_INVALID");
    }
    await appendEvent(eventsPath, {
      schema_version: "1.0",
      event_type: "daily_decision",
      round_id: "gi088-human-extension-daily-v3",
      case_id: context.dailyCase.case_id,
      presentation_id: input.presentationId,
      reviewer_id: input.reviewerId,
      overall_verdict: input.overallVerdict,
      scores: normalizeScores(input.scores, true),
      issue_tags: normalizeDailyIssueTags(input.issueTags),
      note: normalizeNote(input.note),
      reviewed_at: new Date().toISOString()
    });
  });
}

export async function addJournalExtensionDailyNote(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
  note: string;
}) {
  const context = await requireDailyCaseContext(input);
  return await withReviewLock(context.dailyRound.directory, async () => {
    const eventsPath = resolve(context.dailyRound.directory, DAILY_REVIEW_EVENTS_FILE);
    const events = await readNdjson(eventsPath);
    if (!loadDailyDecisionFromEvents({
      events,
      internalCaseId: context.dailyCase.case_id,
      publicCaseId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    })) throw new Error("JOURNAL_EXTENSION_DAILY_DECISION_REQUIRED");
    await appendEvent(eventsPath, {
      schema_version: "1.0",
      event_type: "daily_note_added",
      round_id: "gi088-human-extension-daily-v3",
      case_id: context.dailyCase.case_id,
      presentation_id: input.presentationId,
      reviewer_id: input.reviewerId,
      note: normalizeNote(input.note),
      added_at: new Date().toISOString()
    });
  });
}
