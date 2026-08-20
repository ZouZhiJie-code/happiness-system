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
  JournalExtensionCaseSummary,
  JournalExtensionCaseView,
  JournalExtensionDailyDecisionView,
  JournalExtensionGateView,
  JournalExtensionRecordIssueTag,
  JournalQualityVerdict,
  JournalReviewParagraphSourceView,
  JournalReviewProgramCheckView,
  JournalReviewRecordCardView,
  JournalRound2DraftView,
  JournalRound2IssueTag,
  JournalRound2Score,
  JournalRound2ScoreKey
} from "@/components/journal-evaluation/types";
import {
  GI088_RECORD_CARD_V3_DAILY_ROUND_ID,
  loadGi088RecordCardV3DailyConfirmations,
  type Gi088RecordCardV3DailyConfirmationBundle
} from "../../../../scripts/journal-generation-eval/gi088-record-card-v3-daily-parent";
import {
  loadCommittedGi088ExtensionDailyRound,
  type Gi088ExtensionDailyCase,
  type LoadedGi088ExtensionDailyRound
} from "../../../../scripts/journal-generation-eval/run-gi088-human-extension-daily";
import { sha256Canonical } from "../../../../scripts/journal-generation-eval/gi088-calibration-contract";

export { isLocalJournalEvaluationEnabled, isLocalJournalEvaluationRequest };

const PRIVATE_ROOT = resolve(
  process.cwd(),
  "artifacts/journal-generation-evaluation/.private"
);
const DAILY_ROOT = resolve(PRIVATE_ROOT, "formal/record-card-v3-daily");
const RECORD_CARD_V3_ROOT = resolve(PRIVATE_ROOT, "formal/record-card-rewrite-v3");
const REVIEW_EVENTS_FILE = "daily-review-events.ndjson";
const REVIEW_DRAFTS_FILE = "daily-review-drafts.ndjson";
const REVIEW_LOCK_FILE = ".record-card-v3-daily-review-write.lock";
const REQUIRED_CASE_IDS = [
  "private:sg-gi088-v6-single-focus:A1:high",
  "private:sg-gi088-v7-continuity-baseline:A1:high",
  "private:sg-gi088-v7-continuity-baseline:A2:high",
  "private:sg-gi088-v7r2-ark-flash:A1:high",
  "private:sg-gi088-v7r2-ark-flash:A2:high",
  "private:sg-gi088-v7r4-pro:A1:high"
] as const;
const QUALITY_VERDICTS = new Set<JournalQualityVerdict>([
  "ready_to_use",
  "minor_edit",
  "major_rewrite",
  "quality_failure"
]);
const ISSUE_TAGS = new Set<JournalRound2IssueTag>([
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

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function publicCaseId(index: number) {
  return `extension-case-${String(index + 1).padStart(2, "0")}`;
}

function labelForIndex(index: number) {
  return `案例 ${String(index + 1).padStart(2, "0")}`;
}

function resolveCaseIndex(publicId: string) {
  const match = /^extension-case-(0[1-6])$/u.exec(publicId);
  return match ? Number(match[1]) - 1 : null;
}

function assertContained(path: string) {
  const fromPrivate = relative(PRIVATE_ROOT, path);
  if (!fromPrivate || fromPrivate === ".." || fromPrivate.startsWith(`..${sep}`)) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_PRIVATE_PATH_REQUIRED");
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
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_PRIVATE_PATH_REQUIRED");
  }
  return directoryReal;
}

async function discoverDailyDirectory() {
  const configured = process.env.JOURNAL_EVALUATION_RECORD_CARD_V3_DAILY_DIRECTORY?.trim();
  if (configured) return resolveContainedDirectory(resolve(configured));
  let entries: string[];
  try {
    entries = await readdir(DAILY_ROOT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const committed: string[] = [];
  for (const entry of entries.filter((item) =>
    item.startsWith(`${GI088_RECORD_CARD_V3_DAILY_ROUND_ID}-`)
  )) {
    const directory = resolve(DAILY_ROOT, entry);
    try {
      const manifest = JSON.parse(
        await readFile(resolve(directory, "commit-manifest.json"), "utf8")
      ) as Record<string, unknown>;
      if (manifest.status === "committed") committed.push(directory);
    } catch {
      // 未完成运行保留为证据，不进入评审入口。
    }
  }
  if (committed.length === 0) return null;
  if (committed.length !== 1) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_COMMITTED_ROUND_AMBIGUOUS");
  }
  return resolveContainedDirectory(committed[0]);
}

async function resolveDailyParentDirectory(dailyDirectory: string) {
  const dailyPackage = await readJsonFile(resolve(dailyDirectory, "round-package.json"));
  const parent = isObject(dailyPackage.parent) ? dailyPackage.parent : null;
  const executionFingerprint = parent?.execution_fingerprint;
  if (typeof executionFingerprint !== "string" || !executionFingerprint) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_PARENT_INVALID");
  }

  const matches: string[] = [];
  for (const entry of await readdir(RECORD_CARD_V3_ROOT)) {
    if (!entry.startsWith("gi088-record-card-rewrite-v3-")) continue;
    const directory = resolve(RECORD_CARD_V3_ROOT, entry);
    try {
      const manifest = await readJsonFile(resolve(directory, "commit-manifest.json"));
      if (manifest.status === "committed" && manifest.execution_fingerprint === executionFingerprint) {
        matches.push(directory);
      }
    } catch {
      // 历史残缺包继续保留，只按当前日报声明的父指纹选择完整版本。
    }
  }
  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? "JOURNAL_RECORD_CARD_V3_DAILY_PARENT_NOT_FOUND"
      : "JOURNAL_RECORD_CARD_V3_DAILY_PARENT_AMBIGUOUS");
  }
  return resolveContainedDirectory(matches[0]);
}

async function readJsonFile(path: string) {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!isObject(value)) throw new Error("INVALID_JSON_OBJECT");
    return value;
  } catch {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_ARTIFACT_INVALID");
  }
}

export async function hasCommittedRecordCardV3DailyRound() {
  try {
    assertLocalJournalEvaluationEnvironment();
    const directory = await discoverDailyDirectory();
    if (!directory) return false;
    const parentDirectory = await resolveDailyParentDirectory(directory);
    const confirmations = await loadGi088RecordCardV3DailyConfirmations(parentDirectory);
    await loadCommittedGi088ExtensionDailyRound(
      directory,
      confirmations.recordRound.directory,
      {
        projectRoot: process.cwd(),
        sourceMode: "record_card_v3",
        allowHistoricalSnapshot: true,
        allowMock: false
      }
    );
    return true;
  } catch {
    return false;
  }
}

type LoadedDailyBundle = {
  dailyRound: LoadedGi088ExtensionDailyRound;
  confirmations: Gi088RecordCardV3DailyConfirmationBundle;
};

async function loadRound(): Promise<LoadedDailyBundle | null> {
  assertLocalJournalEvaluationEnvironment();
  const directory = await discoverDailyDirectory();
  if (!directory) return null;
  const parentDirectory = await resolveDailyParentDirectory(directory);
  const confirmations = await loadGi088RecordCardV3DailyConfirmations(parentDirectory);
  const dailyRound = await loadCommittedGi088ExtensionDailyRound(
    directory,
    confirmations.recordRound.directory,
    {
      projectRoot: process.cwd(),
      sourceMode: "record_card_v3",
      allowHistoricalSnapshot: true,
      allowMock: false
    }
  );
  if (dailyRound.package.round_id !== GI088_RECORD_CARD_V3_DAILY_ROUND_ID
    || dailyRound.confirmations.confirmationSetSha256 !== confirmations.confirmationSetSha256) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_PARENT_MISMATCH");
  }
  const actualIds = dailyRound.package.cases.map((item) => item.case_id);
  if (actualIds.length !== REQUIRED_CASE_IDS.length
    || sha256Canonical([...actualIds].sort())
      !== sha256Canonical([...REQUIRED_CASE_IDS].sort())) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_CASE_SET_INVALID");
  }
  return { dailyRound, confirmations };
}

async function readNdjson(path: string) {
  try {
    return (await readFile(path, "utf8")).split(/\r?\n/u).flatMap((line) => {
      if (!line.trim()) return [];
      const value = JSON.parse(line) as unknown;
      return isObject(value) ? [value] : [];
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_REVIEW_FILE_INVALID");
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
  if (!handle) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_REVIEW_BUSY");
  try {
    await handle.writeFile(`${process.pid}\n`, "utf8");
    await handle.sync();
    return await task();
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

function normalizeIssueTags(value: unknown) {
  if (!Array.isArray(value)) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_ISSUE_TAGS_INVALID");
  const tags = [...new Set(value.map((item) => {
    if (typeof item !== "string" || !ISSUE_TAGS.has(item as JournalRound2IssueTag)) {
      throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_ISSUE_TAGS_INVALID");
    }
    return item as JournalRound2IssueTag;
  }))];
  if (tags.includes("no_material_issue") && tags.length > 1) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_ISSUE_TAGS_CONFLICT");
  }
  return tags;
}

function normalizeNote(value: unknown) {
  if (typeof value !== "string" || value.length > 1200) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_NOTE_INVALID");
  }
  return value;
}

function normalizeScores(value: unknown, complete: boolean): Record<JournalRound2ScoreKey, JournalRound2Score | null> {
  if (!isObject(value)) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_SCORES_INVALID");
  return Object.fromEntries(SCORE_KEYS.map((key) => {
    const score = value[key];
    if (score === null && !complete) return [key, null];
    if (!Number.isInteger(score) || Number(score) < 1 || Number(score) > 5) {
      throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_SCORES_INVALID");
    }
    return [key, Number(score) as JournalRound2Score];
  })) as Record<JournalRound2ScoreKey, JournalRound2Score | null>;
}

function dailyPresentationId(round: LoadedGi088ExtensionDailyRound, dailyCase: Gi088ExtensionDailyCase) {
  return sha256Canonical({
    roundId: round.package.round_id,
    executionFingerprint: round.package.execution_fingerprint,
    caseId: dailyCase.case_id,
    candidateId: dailyCase.candidate.candidate_id,
    confirmationSetSha256: round.package.parent.confirmation_set_sha256,
    paragraphs: dailyCase.candidate.paragraphs
  });
}

function loadDraft(input: {
  events: ReviewEvent[];
  caseId: string;
  publicId: string;
  presentationId: string;
  reviewerId: string;
}): JournalRound2DraftView | null {
  const matches = input.events.filter((event) =>
    event.schema_version === "1.0"
    && event.event_type === "daily_draft"
    && event.round_id === GI088_RECORD_CARD_V3_DAILY_ROUND_ID
    && event.case_id === input.caseId
    && event.presentation_id === input.presentationId
    && event.reviewer_id === input.reviewerId
  );
  if (matches.length === 0) return null;
  const latest = [...matches].sort((left, right) =>
    Number(left.revision ?? 0) - Number(right.revision ?? 0)
  ).at(-1)!;
  return {
    case_id: input.publicId,
    round_id: GI088_RECORD_CARD_V3_DAILY_ROUND_ID,
    presentation_id: input.presentationId,
    overall_verdict: typeof latest.overall_verdict === "string"
      && QUALITY_VERDICTS.has(latest.overall_verdict as JournalQualityVerdict)
      ? latest.overall_verdict as JournalQualityVerdict : null,
    scores: normalizeScores(latest.scores, false),
    issue_tags: normalizeIssueTags(latest.issue_tags ?? []),
    note: normalizeNote(latest.note ?? ""),
    revision: Number(latest.revision),
    updated_at: String(latest.updated_at)
  };
}

function loadDecision(input: {
  events: ReviewEvent[];
  caseId: string;
  publicId: string;
  presentationId: string;
  reviewerId: string;
}): JournalExtensionDailyDecisionView | null {
  const matches = input.events.filter((event) =>
    event.schema_version === "1.0"
    && event.event_type === "daily_decision"
    && event.round_id === GI088_RECORD_CARD_V3_DAILY_ROUND_ID
    && event.case_id === input.caseId
    && event.presentation_id === input.presentationId
    && event.reviewer_id === input.reviewerId
  );
  if (matches.length === 0) return null;
  if (matches.length !== 1) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_DECISION_DUPLICATE");
  const event = matches[0];
  if (typeof event.overall_verdict !== "string"
    || !QUALITY_VERDICTS.has(event.overall_verdict as JournalQualityVerdict)
    || typeof event.reviewed_at !== "string") {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_DECISION_INVALID");
  }
  const noteAdditions = input.events.filter((noteEvent) =>
    noteEvent.schema_version === "1.0"
    && noteEvent.event_type === "daily_note_added"
    && noteEvent.round_id === GI088_RECORD_CARD_V3_DAILY_ROUND_ID
    && noteEvent.case_id === input.caseId
    && noteEvent.presentation_id === input.presentationId
    && noteEvent.reviewer_id === input.reviewerId
  ).map((noteEvent) => ({
    note: normalizeNote(noteEvent.note ?? ""),
    added_at: String(noteEvent.added_at)
  }));
  return {
    case_id: input.publicId,
    presentation_id: input.presentationId,
    overall_verdict: event.overall_verdict as JournalQualityVerdict,
    scores: normalizeScores(event.scores, true) as Record<JournalRound2ScoreKey, JournalRound2Score>,
    issue_tags: normalizeIssueTags(event.issue_tags ?? []),
    note: normalizeNote(event.note ?? ""),
    reviewed_at: event.reviewed_at,
    note_additions: noteAdditions
  };
}

function cardView(card: Gi088RecordCardV3DailyConfirmationBundle["confirmations"][number]["approvedRecordCard"]): JournalReviewRecordCardView {
  return {
    record_card_id: card.record_card_id,
    title: card.title,
    text: card.text,
    insight: card.insight,
    source_refs: [...card.source_refs]
  };
}

function programCheck(dailyCase: Gi088ExtensionDailyCase): JournalReviewProgramCheckView {
  return {
    admitted: dailyCase.candidate.program_check.admitted,
    metrics: {},
    failures: dailyCase.candidate.program_check.failures.map((failure) => ({
      code: failure.code,
      message: failure.message,
      refs: failure.refs
    }))
  };
}

function transcriptFor(source: Gi088RecordCardV3DailyConfirmationBundle["recordRound"]["sourceBundle"]["sources"][number]) {
  return source.projection.transcript
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      message_id: message.ref.replace(/^(?:message|context:assistant):/u, ""),
      role: message.role as "user" | "assistant",
      content: message.content
    }));
}

function isBlockingDecision(decision: JournalExtensionDailyDecisionView) {
  return decision.overall_verdict === "major_rewrite"
    || decision.overall_verdict === "quality_failure"
    || decision.issue_tags.some((tag) =>
      tag === "fact_or_source_error" || tag === "content_omission" || tag === "over_inference"
    )
    || Object.values(decision.scores).some((score) => score < 4);
}

async function reviewState(bundle: LoadedDailyBundle, reviewerId: string) {
  const [events, drafts] = await Promise.all([
    readNdjson(resolve(bundle.dailyRound.directory, REVIEW_EVENTS_FILE)),
    readNdjson(resolve(bundle.dailyRound.directory, REVIEW_DRAFTS_FILE))
  ]);
  const rows = REQUIRED_CASE_IDS.map((caseId, index) => {
    const dailyCase = bundle.dailyRound.package.cases.find((item) => item.case_id === caseId);
    const confirmation = bundle.confirmations.confirmations.find((item) => item.caseId === caseId);
    const source = bundle.confirmations.recordRound.sourceBundle.sources.find(
      (item) => item.selection.caseId === caseId
    );
    if (!dailyCase || !confirmation || !source) {
      throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_CASE_BINDING_INVALID");
    }
    const publicId = publicCaseId(index);
    const presentation = dailyPresentationId(bundle.dailyRound, dailyCase);
    return {
      index,
      publicId,
      dailyCase,
      confirmation,
      source,
      presentation,
      draft: loadDraft({ events: drafts, caseId, publicId, presentationId: presentation, reviewerId }),
      decision: loadDecision({ events, caseId, publicId, presentationId: presentation, reviewerId })
    };
  });
  const reviewedCount = rows.filter((row) => row.decision).length;
  const blockedCount = rows.filter((row) =>
    !row.dailyCase.candidate.program_check.admitted
    || Boolean(row.decision && isBlockingDecision(row.decision))
  ).length;
  const gate: JournalExtensionGateView = {
    stage: "daily_journal",
    state: blockedCount > 0 ? "fail" : reviewedCount === 6 ? "pass" : "pending",
    confirmed_records: 6,
    reviewed_diaries: reviewedCount,
    total_cases: 6,
    reasons: [
      ...(blockedCount > 0 ? [`${blockedCount} 个案例触发日记准入阻断`] : []),
      ...(reviewedCount < 6 && blockedCount === 0 ? [`已评价 ${reviewedCount}/6 篇日记`] : []),
      ...(reviewedCount === 6 && blockedCount === 0 ? ["六篇今日日记均已完成评价，达到当前阶段门槛"] : [])
    ]
  };
  return { rows, gate };
}

export async function listRecordCardV3DailyCases(reviewerId: string): Promise<{
  cases: JournalExtensionCaseSummary[];
  gate: JournalExtensionGateView;
}> {
  const bundle = await loadRound();
  if (!bundle) {
    return {
      cases: [],
      gate: {
        stage: "daily_journal",
        state: "pending",
        confirmed_records: 6,
        reviewed_diaries: 0,
        total_cases: 6,
        reasons: ["等待六篇今日日记回归结果"]
      }
    };
  }
  const state = await reviewState(bundle, reviewerId);
  return {
    cases: state.rows.map((row) => ({
      case_id: row.publicId,
      label: labelForIndex(row.index),
      status: !row.dailyCase.candidate.program_check.admitted || (row.decision && isBlockingDecision(row.decision))
        ? "blocked" as const
        : row.decision ? "completed" as const : "daily_awaiting_review" as const,
      stage: "daily_journal" as const,
      review_ready: row.dailyCase.candidate.program_check.admitted
    })),
    gate: state.gate
  };
}

export async function loadRecordCardV3DailyCase(
  publicId: string,
  reviewerId: string
): Promise<JournalExtensionCaseView | null> {
  const bundle = await loadRound();
  if (!bundle) return null;
  const index = resolveCaseIndex(publicId);
  if (index === null) return null;
  const state = await reviewState(bundle, reviewerId);
  const row = state.rows[index];
  if (!row) return null;
  const original = cardView(row.confirmation.originalRecordCard);
  const approved = cardView(row.confirmation.approvedRecordCard);
  const recordDecision = {
    case_id: publicId,
    presentation_id: row.presentation,
    overall_verdict: "ready_to_use" as const,
    issue_tags: [] as JournalExtensionRecordIssueTag[],
    note: "记录卡 v3 已完成真人确认",
    reviewed_at: row.confirmation.confirmedAt,
    note_additions: []
  };
  const dailyProgramCheck = row.decision ? programCheck(row.dailyCase) : null;
  const paragraphSources: JournalReviewParagraphSourceView[] = row.dailyCase.candidate.paragraphs.map((paragraph) => ({
    source_refs: [...paragraph.source_refs],
    record_card_refs: [...paragraph.record_card_refs]
  }));
  return {
    case_id: publicId,
    label: labelForIndex(index),
    stage: "daily_journal",
    status: !row.dailyCase.candidate.program_check.admitted || (row.decision && isBlockingDecision(row.decision))
      ? "blocked" : row.decision ? "completed" : "daily_awaiting_review",
    presentation_id: row.presentation,
    review_ready: row.dailyCase.candidate.program_check.admitted,
    transcript: transcriptFor(row.source),
    model_record_card: original,
    occurred_at_text: null,
    program_check: dailyProgramCheck,
    record_draft: null,
    record_decision: recordDecision,
    record_confirmation: {
      approved_record_card: approved,
      approved_record_card_sha256: row.confirmation.approvedRecordCardSha256,
      source_signature: row.confirmation.sourceSignature,
      content_revision: row.confirmation.contentRevision,
      edited: row.confirmation.edited,
      confirmed_at: row.confirmation.confirmedAt
    },
    daily_candidate: {
      title: row.dailyCase.candidate.title,
      paragraphs: row.dailyCase.candidate.paragraphs.map((paragraph) => paragraph.text),
      paragraph_sources: paragraphSources,
      program_check: dailyProgramCheck
    },
    daily_draft: row.draft,
    daily_decision: row.decision,
    gate: state.gate
  };
}

async function requireContext(input: { publicId: string; presentationId: string; reviewerId: string }) {
  const bundle = await loadRound();
  if (!bundle) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_ROUND_UNAVAILABLE");
  const index = resolveCaseIndex(input.publicId);
  if (index === null) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_CASE_NOT_FOUND");
  const state = await reviewState(bundle, input.reviewerId);
  const row = state.rows[index];
  if (!row) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_CASE_NOT_FOUND");
  if (row.presentation !== input.presentationId) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_PRESENTATION_MISMATCH");
  }
  return { bundle, row };
}

export async function saveRecordCardV3DailyDraft(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
  overallVerdict: JournalQualityVerdict | null;
  scores: Record<JournalRound2ScoreKey, JournalRound2Score | null>;
  issueTags: JournalRound2IssueTag[];
  note: string;
}) {
  const context = await requireContext(input);
  if (!context.row.dailyCase.candidate.program_check.admitted) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_CANDIDATE_BLOCKED");
  }
  return withReviewLock(context.bundle.dailyRound.directory, async () => {
    const eventsPath = resolve(context.bundle.dailyRound.directory, REVIEW_EVENTS_FILE);
    const draftsPath = resolve(context.bundle.dailyRound.directory, REVIEW_DRAFTS_FILE);
    const events = await readNdjson(eventsPath);
    if (loadDecision({
      events,
      caseId: context.row.dailyCase.case_id,
      publicId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    })) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_ALREADY_DECIDED");
    const drafts = await readNdjson(draftsPath);
    const current = loadDraft({
      events: drafts,
      caseId: context.row.dailyCase.case_id,
      publicId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    });
    if (input.overallVerdict !== null && !QUALITY_VERDICTS.has(input.overallVerdict)) {
      throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_VERDICT_INVALID");
    }
    await appendEvent(draftsPath, {
      schema_version: "1.0",
      event_type: "daily_draft",
      round_id: GI088_RECORD_CARD_V3_DAILY_ROUND_ID,
      case_id: context.row.dailyCase.case_id,
      presentation_id: input.presentationId,
      reviewer_id: input.reviewerId,
      overall_verdict: input.overallVerdict,
      scores: normalizeScores(input.scores, false),
      issue_tags: normalizeIssueTags(input.issueTags),
      note: normalizeNote(input.note),
      revision: (current?.revision ?? 0) + 1,
      updated_at: new Date().toISOString()
    });
  });
}

export async function decideRecordCardV3Daily(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
  overallVerdict: JournalQualityVerdict;
  scores: Record<JournalRound2ScoreKey, JournalRound2Score | null>;
  issueTags: JournalRound2IssueTag[];
  note: string;
}) {
  const context = await requireContext(input);
  if (!context.row.dailyCase.candidate.program_check.admitted) {
    throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_CANDIDATE_BLOCKED");
  }
  return withReviewLock(context.bundle.dailyRound.directory, async () => {
    const eventsPath = resolve(context.bundle.dailyRound.directory, REVIEW_EVENTS_FILE);
    const events = await readNdjson(eventsPath);
    if (loadDecision({
      events,
      caseId: context.row.dailyCase.case_id,
      publicId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    })) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_ALREADY_DECIDED");
    if (!QUALITY_VERDICTS.has(input.overallVerdict)) {
      throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_VERDICT_INVALID");
    }
    await appendEvent(eventsPath, {
      schema_version: "1.0",
      event_type: "daily_decision",
      round_id: GI088_RECORD_CARD_V3_DAILY_ROUND_ID,
      case_id: context.row.dailyCase.case_id,
      presentation_id: input.presentationId,
      reviewer_id: input.reviewerId,
      overall_verdict: input.overallVerdict,
      scores: normalizeScores(input.scores, true),
      issue_tags: normalizeIssueTags(input.issueTags),
      note: normalizeNote(input.note),
      reviewed_at: new Date().toISOString()
    });
  });
}

export async function addRecordCardV3DailyNote(input: {
  publicId: string;
  presentationId: string;
  reviewerId: string;
  note: string;
}) {
  const context = await requireContext(input);
  return withReviewLock(context.bundle.dailyRound.directory, async () => {
    const eventsPath = resolve(context.bundle.dailyRound.directory, REVIEW_EVENTS_FILE);
    const events = await readNdjson(eventsPath);
    if (!loadDecision({
      events,
      caseId: context.row.dailyCase.case_id,
      publicId: input.publicId,
      presentationId: input.presentationId,
      reviewerId: input.reviewerId
    })) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_DECISION_REQUIRED");
    await appendEvent(eventsPath, {
      schema_version: "1.0",
      event_type: "daily_note_added",
      round_id: GI088_RECORD_CARD_V3_DAILY_ROUND_ID,
      case_id: context.row.dailyCase.case_id,
      presentation_id: input.presentationId,
      reviewer_id: input.reviewerId,
      note: normalizeNote(input.note),
      added_at: new Date().toISOString()
    });
  });
}
