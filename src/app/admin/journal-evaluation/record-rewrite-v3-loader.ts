import {
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  unlink
} from "node:fs/promises";
import { resolve } from "node:path";

import { assertLocalJournalEvaluationEnvironment } from "@/app/admin/journal-evaluation/private-loader";
import type {
  JournalQualityVerdict,
  JournalRecordRewriteCaseSummary,
  JournalRecordRewriteCaseView,
  JournalRecordRewriteComparison,
  JournalRecordRewriteIssueTag,
  JournalRecordRewriteReviewForm,
  JournalRound2Score,
  JournalRound2ScoreKey,
  JournalRound2Scores
} from "@/components/journal-evaluation/types";
import { sha256Canonical } from "../../../../scripts/journal-generation-eval/gi088-calibration-contract";
import {
  loadGi088HumanExtensionSources
} from "../../../../scripts/journal-generation-eval/gi088-human-extension-source";
import {
  GI088_RECORD_CARD_REWRITE_V3_ROUND_ID
} from "../../../../scripts/journal-generation-eval/gi088-record-card-rewrite-v3-contract";
import {
  GI088_RECORD_CARD_REWRITE_V3_PARENT_DIRECTORY,
  loadCommittedGi088RecordCardRewriteV3,
  type Gi088RecordCardRewriteV3Case
} from "../../../../scripts/journal-generation-eval/run-gi088-record-card-rewrite-v3";

const DEFAULT_ROOT = resolve(
  process.cwd(),
  "artifacts/journal-generation-evaluation/.private/formal/record-card-rewrite-v3"
);
const DRAFT_FILE = "record-rewrite-v3-review-drafts.ndjson";
const DECISION_FILE = "record-rewrite-v3-reviews.ndjson";
const REVIEW_LOCK = ".record-rewrite-v3-review.lock";
const V2_REVIEW_DIRECTORY = resolve(process.cwd(), GI088_RECORD_CARD_REWRITE_V3_PARENT_DIRECTORY);

const LABELS = new Map([
  ["private:sg-gi088-v6-single-focus:A1:high", "v6 A1"],
  ["private:sg-gi088-v7-continuity-baseline:A1:high", "v7 A1"],
  ["private:sg-gi088-v7-continuity-baseline:A2:high", "v7 A2"],
  ["private:sg-gi088-v7r2-ark-flash:A1:high", "v7r2 A1"],
  ["private:sg-gi088-v7r2-ark-flash:A2:high", "v7r2 A2"],
  ["private:sg-gi088-v7r4-pro:A1:high", "v7r4 A1"]
]);

const VERDICTS = new Set<JournalQualityVerdict>([
  "ready_to_use", "minor_edit", "major_rewrite", "quality_failure"
]);
const ISSUE_TAGS = new Set<JournalRecordRewriteIssueTag>([
  "fact_or_source_error", "content_omission", "qa_residue", "repetition",
  "unnatural_language", "style_deviation", "insight_integration",
  "no_material_issue", "other"
]);
const COMPARISONS = new Set<JournalRecordRewriteComparison>([
  "material_improvement", "minor_improvement", "no_change", "regression"
]);
const SCORE_KEYS: JournalRound2ScoreKey[] = [
  "fidelity_completeness", "structure_coherence", "language_naturalness", "insight_integration"
];

interface ReviewEvent extends Record<string, unknown> {
  schema_version: "2.0";
  event_type: "draft" | "decision";
  round_id: typeof GI088_RECORD_CARD_REWRITE_V3_ROUND_ID;
  case_id: string;
  presentation_id: string;
  reviewer_id: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readNdjson(path: string) {
  try {
    return (await readFile(path, "utf8")).split(/\r?\n/u).flatMap((line) => {
      if (!line.trim()) return [];
      const value = JSON.parse(line) as unknown;
      if (!isObject(value)) throw new Error("JOURNAL_RECORD_REWRITE_REVIEW_INVALID");
      return [value];
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function appendEvent(path: string, value: unknown) {
  await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
  const handle = await open(path, "a", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, 0o600);
}

async function withLock<T>(directory: string, task: () => Promise<T>) {
  const lockPath = resolve(directory, REVIEW_LOCK);
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      handle = await open(lockPath, "wx", 0o600);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise<void>((done) => setTimeout(done, 10));
    }
  }
  if (!handle) throw new Error("JOURNAL_RECORD_REWRITE_REVIEW_BUSY");
  try {
    return await task();
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

async function discoverDirectory() {
  const configured = process.env.JOURNAL_EVALUATION_RECORD_REWRITE_V3_DIRECTORY?.trim();
  if (configured) return resolve(configured);
  let entries: string[];
  try {
    entries = await readdir(DEFAULT_ROOT);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const committed: string[] = [];
  for (const entry of entries.filter((item) => item.startsWith(`${GI088_RECORD_CARD_REWRITE_V3_ROUND_ID}-`))) {
    const directory = resolve(DEFAULT_ROOT, entry);
    try {
      const manifest = JSON.parse(
        await readFile(resolve(directory, "commit-manifest.json"), "utf8")
      ) as Record<string, unknown>;
      if (manifest.status === "committed" && manifest.mode === "real") committed.push(directory);
    } catch {
      // 未提交目录保留为运行证据，不进入评审。
    }
  }
  if (committed.length === 0) return null;
  const valid: string[] = [];
  for (const directory of committed) {
    try {
      await loadCommittedGi088RecordCardRewriteV3(
        directory,
        process.cwd(),
        process.env.JOURNAL_EVALUATION_RECORD_REWRITE_V3_ALLOW_MOCK === "I_UNDERSTAND"
      );
      valid.push(directory);
    } catch {
      // 已封存但实现快照过期的历史包继续保留，不进入当前评审。
    }
  }
  if (valid.length === 0) return null;
  if (valid.length !== 1) throw new Error("JOURNAL_RECORD_REWRITE_ROUND_AMBIGUOUS");
  return valid[0];
}

async function loadRound() {
  assertLocalJournalEvaluationEnvironment();
  const directory = await discoverDirectory();
  if (!directory) return null;
  const loaded = await loadCommittedGi088RecordCardRewriteV3(
    directory,
    process.cwd(),
    process.env.JOURNAL_EVALUATION_RECORD_REWRITE_V3_ALLOW_MOCK === "I_UNDERSTAND"
  );
  return {
    ...loaded,
    sources: await loadGi088HumanExtensionSources(process.cwd())
  };
}

function publicId(index: number) {
  return `record-rewrite-case-${String(index + 1).padStart(2, "0")}`;
}

function caseIndex(id: string) {
  const match = /^record-rewrite-case-(0[1-6])$/u.exec(id);
  return match ? Number(match[1]) - 1 : null;
}

function presentationId(round: Awaited<ReturnType<typeof loadCommittedGi088RecordCardRewriteV3>>, item: Gi088RecordCardRewriteV3Case) {
  const reviewCandidate = candidateForReview(round, item);
  return sha256Canonical({
    roundId: round.package.round_id,
    executionFingerprint: round.package.execution_fingerprint,
    caseId: item.case_id,
    baseline: item.baseline_record_card_sha256,
    candidate: reviewCandidate?.card ?? null,
    candidateRawSha256: reviewCandidate?.rawSha256 ?? null,
    programCheck: item.candidate.program_check
  });
}

function candidateForReview(
  round: Awaited<ReturnType<typeof loadCommittedGi088RecordCardRewriteV3>>,
  item: Gi088RecordCardRewriteV3Case
) {
  const finalAttempt = [...item.candidate.trace.attempts].reverse().find(
    (attempt) => attempt.outcome === "valid_response"
  );
  const raw = finalAttempt && round.package.raw_responses.find(
    (response) => response.call_fingerprint === finalAttempt.call_fingerprint
  );
  if (!raw) return null;
  return {
    card: item.candidate.record_card,
    rawContent: raw.content,
    rawSha256: raw.sha256,
    objectiveIssueCount: item.candidate.program_check.failures.filter(
      (failure) => failure.severity === "P0"
    ).length
  };
}

function candidateBinding(candidate: NonNullable<ReturnType<typeof candidateForReview>>) {
  return sha256Canonical({ card: candidate.card, raw_response_sha256: candidate.rawSha256 });
}

function normalizeScores(value: unknown, allowNull: boolean): JournalRound2Scores {
  if (!isObject(value)) throw new Error("JOURNAL_RECORD_REWRITE_SCORES_INVALID");
  return Object.fromEntries(SCORE_KEYS.map((key) => {
    const score = value[key];
    if (score === null && allowNull) return [key, null];
    if (![1, 2, 3, 4, 5].includes(Number(score))) {
      throw new Error("JOURNAL_RECORD_REWRITE_SCORES_INVALID");
    }
    return [key, Number(score) as JournalRound2Score];
  })) as JournalRound2Scores;
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) throw new Error("JOURNAL_RECORD_REWRITE_TAGS_INVALID");
  const tags = [...new Set(value.map((item) => {
    if (typeof item !== "string" || !ISSUE_TAGS.has(item as JournalRecordRewriteIssueTag)) {
      throw new Error("JOURNAL_RECORD_REWRITE_TAGS_INVALID");
    }
    return item as JournalRecordRewriteIssueTag;
  }))];
  if (tags.includes("no_material_issue") && tags.length > 1) {
    throw new Error("JOURNAL_RECORD_REWRITE_TAGS_CONFLICT");
  }
  return tags;
}

function normalizeNote(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) {
    throw new Error("JOURNAL_RECORD_REWRITE_NOTE_INVALID");
  }
  return value;
}

function reviewForm(event: Record<string, unknown>, allowIncomplete: boolean): JournalRecordRewriteReviewForm {
  const overall = event.overall_verdict;
  const comparison = event.comparison_verdict;
  if (overall !== null && (typeof overall !== "string" || !VERDICTS.has(overall as JournalQualityVerdict))) {
    throw new Error("JOURNAL_RECORD_REWRITE_VERDICT_INVALID");
  }
  if (comparison !== null
    && (typeof comparison !== "string" || !COMPARISONS.has(comparison as JournalRecordRewriteComparison))) {
    throw new Error("JOURNAL_RECORD_REWRITE_COMPARISON_INVALID");
  }
  if (!allowIncomplete && (!overall || !comparison)) {
    throw new Error("JOURNAL_RECORD_REWRITE_DECISION_INCOMPLETE");
  }
  return {
    overall_verdict: overall as JournalQualityVerdict | null,
    scores: normalizeScores(event.scores, allowIncomplete),
    issue_tags: normalizeTags(event.issue_tags),
    comparison_verdict: comparison as JournalRecordRewriteComparison | null,
    note: normalizeNote(event.note)
  };
}

async function reviewState(input: {
  directory: string;
  caseId: string;
  presentationId: string;
  reviewerId: string;
  baselineRecordCardSha256: string;
  candidateRecordCardSha256: string | null;
}) {
  const [drafts, decisions] = await Promise.all([
    readNdjson(resolve(input.directory, DRAFT_FILE)),
    readNdjson(resolve(input.directory, DECISION_FILE))
  ]);
  const match = (event: Record<string, unknown>) =>
    event.round_id === GI088_RECORD_CARD_REWRITE_V3_ROUND_ID
    && event.case_id === input.caseId
    && event.presentation_id === input.presentationId
    && event.reviewer_id === input.reviewerId;
  const decisionEvents = decisions.filter(match);
  if (decisionEvents.length > 1) throw new Error("JOURNAL_RECORD_REWRITE_DECISION_DUPLICATE");
  const decision = decisionEvents[0];
  if (decision && (
    decision.baseline_record_card_sha256 !== input.baselineRecordCardSha256
    || decision.candidate_record_card_sha256 !== input.candidateRecordCardSha256
  )) {
    throw new Error("JOURNAL_RECORD_REWRITE_DECISION_BINDING_INVALID");
  }
  const draft = drafts.filter(match).sort((left, right) =>
    Number(left.revision ?? 0) - Number(right.revision ?? 0)
  ).at(-1);
  return {
    draft: draft ? {
      ...reviewForm(draft, true),
      revision: Number(draft.revision),
      updated_at: String(draft.updated_at)
    } : null,
    decision: decision ? {
      ...reviewForm(decision, false),
      overall_verdict: decision.overall_verdict as JournalQualityVerdict,
      comparison_verdict: decision.comparison_verdict as JournalRecordRewriteComparison,
      reviewed_at: String(decision.reviewed_at)
    } : null
  };
}

async function baselineFeedback(input: {
  internalCaseId: string;
  reviewerId: string;
}) {
  const events = await readNdjson(resolve(V2_REVIEW_DIRECTORY, "record-rewrite-v2-reviews.ndjson"));
  const caseEvents = events.filter((event) => event.case_id === input.internalCaseId);
  const latest = caseEvents.find((event) => event.reviewer_id === input.reviewerId)
    ?? (caseEvents.length === 1 ? caseEvents[0] : null);
  if (!latest) return null;
  return {
    overall_verdict: typeof latest.overall_verdict === "string"
      && VERDICTS.has(latest.overall_verdict as JournalQualityVerdict)
      ? latest.overall_verdict as JournalQualityVerdict : null,
    scores: normalizeScores(latest.scores, false),
    issue_tags: Array.isArray(latest.issue_tags)
      ? latest.issue_tags.filter((item): item is string => typeof item === "string") : [],
    comparison_verdict: typeof latest.comparison_verdict === "string"
      && COMPARISONS.has(latest.comparison_verdict as JournalRecordRewriteComparison)
      ? latest.comparison_verdict as JournalRecordRewriteComparison : null,
    note: typeof latest.note === "string" ? latest.note : ""
  };
}

async function gate(round: NonNullable<Awaited<ReturnType<typeof loadRound>>>, reviewerId: string) {
  const states = await Promise.all(round.package.cases.map(async (item, index) => {
    const source = round.sources.sources[index];
    const reviewCandidate = source ? candidateForReview(round, item) : null;
    return await reviewState({
      directory: round.directory,
      caseId: item.case_id,
      presentationId: presentationId(round, item),
      reviewerId,
      baselineRecordCardSha256: item.baseline_record_card_sha256,
      candidateRecordCardSha256: reviewCandidate
        ? candidateBinding(reviewCandidate) : null
    });
  }));
  const decisions = states.flatMap((state, index) => state.decision
    ? [{ index, decision: state.decision }] : []);
  const ready = decisions.filter((item) => item.decision.overall_verdict === "ready_to_use").length;
  const reasons: string[] = [];
  for (const [index, item] of round.package.cases.entries()) {
    const source = round.sources.sources[index];
    const reviewCandidate = source ? candidateForReview(round, item) : null;
    if (!reviewCandidate || reviewCandidate.objectiveIssueCount > 0) {
      reasons.push(`CASE_${index + 1}_P0`);
    }
  }
  for (const { index, decision } of decisions) {
    if (!["ready_to_use", "minor_edit"].includes(decision.overall_verdict)) {
      reasons.push(`CASE_${index + 1}_QUALITY_BELOW_GATE`);
    }
    if (Object.values(decision.scores).some((score) => score === null || score < 4)) {
      reasons.push(`CASE_${index + 1}_SCORE_BELOW_4`);
    }
    if (index <= 1) {
      if (decision.overall_verdict !== "ready_to_use"
        || Object.values(decision.scores).some((score) => score !== 5)
        || decision.comparison_verdict === "regression") {
        reasons.push(`CASE_${index + 1}_READY_BASELINE_REGRESSED`);
      }
    } else if (!["material_improvement", "minor_improvement"].includes(
      decision.comparison_verdict
    )) {
      reasons.push(`CASE_${index + 1}_REMEDIATION_NOT_IMPROVED`);
    }
    if (decision.issue_tags.includes("fact_or_source_error")) {
      reasons.push(`CASE_${index + 1}_P0`);
    }
  }
  if (decisions.length === 6 && ready < 5) reasons.push("READY_TO_USE_BELOW_5_OF_6");
  return {
    state: decisions.length < 6 ? "pending" as const : reasons.length ? "fail" as const : "pass" as const,
    completed_cases: decisions.length,
    total_cases: 6 as const,
    ready_to_use_cases: ready,
    reasons: [...new Set(reasons)]
  };
}

export async function listJournalRecordRewriteV3Cases(reviewerId: string) {
  const round = await loadRound();
  if (!round) return { cases: [], gate: null };
  const currentGate = await gate(round, reviewerId);
  const cases: JournalRecordRewriteCaseSummary[] = await Promise.all(round.package.cases.map(async (item, index) => {
    const source = round.sources.sources[index];
    const reviewCandidate = source ? candidateForReview(round, item) : null;
    const reviewReady = Boolean(reviewCandidate);
    const state = await reviewState({
      directory: round.directory,
      caseId: item.case_id,
      presentationId: presentationId(round, item),
      reviewerId,
      baselineRecordCardSha256: item.baseline_record_card_sha256,
      candidateRecordCardSha256: reviewCandidate
        ? candidateBinding(reviewCandidate) : null
    });
    return {
      case_id: publicId(index),
      label: LABELS.get(item.case_id) ?? `案例 ${index + 1}`,
      status: !reviewReady ? "blocked" : state.decision ? "completed" : state.draft ? "in_progress" : "not_started",
      review_ready: reviewReady
    };
  }));
  return { cases, gate: currentGate };
}

export async function loadJournalRecordRewriteV3Case(publicCaseId: string, reviewerId: string) {
  const round = await loadRound();
  const index = caseIndex(publicCaseId);
  if (!round || index === null) return null;
  const item = round.package.cases[index];
  const source = round.sources.sources[index];
  if (!item || !source || item.case_id !== source.selection.caseId) {
    throw new Error("JOURNAL_RECORD_REWRITE_CASE_BINDING_INVALID");
  }
  const presentation = presentationId(round, item);
  const reviewCandidate = candidateForReview(round, item);
  const state = await reviewState({
    directory: round.directory,
    caseId: item.case_id,
    presentationId: presentation,
    reviewerId,
      baselineRecordCardSha256: item.baseline_record_card_sha256,
      candidateRecordCardSha256: reviewCandidate
        ? candidateBinding(reviewCandidate) : null
  });
  const reviewReady = Boolean(reviewCandidate);
  const cardView = (card: Gi088RecordCardRewriteV3Case["baseline_record_card"]) => ({
    record_card_id: card.record_card_id,
    title: card.title,
    text: card.text,
    insight: card.insight,
    source_refs: [...card.source_refs]
  });
  return {
    case_id: publicCaseId,
    label: LABELS.get(item.case_id) ?? `案例 ${index + 1}`,
    presentation_id: presentation,
    status: !reviewReady ? "blocked" : state.decision ? "completed" : state.draft ? "in_progress" : "not_started",
    review_ready: reviewReady,
    transcript: source.projection.transcript.flatMap((message, messageIndex) =>
      message.role === "user" || message.role === "assistant" ? [{
        message_id: `${message.ref}-${messageIndex}`,
        role: message.role,
        content: message.content
      }] : []
    ),
    baseline_record_card: cardView(item.baseline_record_card),
    baseline_feedback: await baselineFeedback({ internalCaseId: item.case_id, reviewerId }),
    candidate_record_card: reviewCandidate?.card ? cardView(reviewCandidate.card) : null,
    candidate_raw_response: reviewCandidate?.rawContent ?? null,
    objective_issue_count: reviewCandidate?.objectiveIssueCount
      ?? item.candidate.program_check.failures.filter((failure) => failure.severity === "P0").length,
    objective_admitted: item.candidate.program_check.admitted,
    mechanical_review_projection: false,
    material_reveal: state.decision ? {
      material_units: item.candidate.material_units.map((unit) => ({
        unit_id: unit.unitId,
        core_meaning: unit.coreMeaning,
        evidence_spans: unit.evidenceSpans.map((span) => ({
          source_ref: span.sourceRef,
          quote: span.quote
        })),
        valid_insight_refs: [...unit.validInsightRefs],
        excluded_interaction_spans: unit.excludedInteractionSpans.map((span) => ({
          source_ref: span.sourceRef,
          quote: span.quote
        }))
      })),
      failures: item.candidate.program_check.failures.map((failure) => ({ ...failure })),
      diagnostics: Object.fromEntries(Object.entries(item.candidate.program_check.diagnostics).map(
        ([key, values]) => [key, [...values]]
      ))
    } : null,
    draft: state.draft,
    decision: state.decision,
    gate: await gate(round, reviewerId)
  } satisfies JournalRecordRewriteCaseView;
}

export async function saveJournalRecordRewriteV3Draft(input: {
  publicCaseId: string;
  presentationId: string;
  reviewerId: string;
  form: JournalRecordRewriteReviewForm;
}) {
  const round = await loadRound();
  const index = caseIndex(input.publicCaseId);
  if (!round || index === null) throw new Error("JOURNAL_RECORD_REWRITE_CASE_NOT_FOUND");
  const item = round.package.cases[index];
  const source = round.sources.sources[index];
  if (!source || source.selection.caseId !== item.case_id) {
    throw new Error("JOURNAL_RECORD_REWRITE_CASE_BINDING_INVALID");
  }
  const reviewCandidate = candidateForReview(round, item);
  const expectedPresentation = presentationId(round, item);
  if (expectedPresentation !== input.presentationId) throw new Error("JOURNAL_RECORD_REWRITE_PRESENTATION_STALE");
  if (!reviewCandidate) {
    throw new Error("JOURNAL_RECORD_REWRITE_CASE_BLOCKED");
  }
  await withLock(round.directory, async () => {
    const current = await reviewState({
      directory: round.directory,
      caseId: item.case_id,
      presentationId: expectedPresentation,
      reviewerId: input.reviewerId,
      baselineRecordCardSha256: item.baseline_record_card_sha256,
      candidateRecordCardSha256: candidateBinding(reviewCandidate)
    });
    if (current.decision) throw new Error("JOURNAL_RECORD_REWRITE_ALREADY_DECIDED");
    const normalized = reviewForm(input.form as unknown as Record<string, unknown>, true);
    await appendEvent(resolve(round.directory, DRAFT_FILE), {
      schema_version: "2.0",
      event_type: "draft",
      round_id: GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
      case_id: item.case_id,
      presentation_id: expectedPresentation,
      reviewer_id: input.reviewerId,
      ...normalized,
      revision: (current.draft?.revision ?? 0) + 1,
      updated_at: new Date().toISOString()
    } satisfies ReviewEvent);
  });
}

export async function decideJournalRecordRewriteV3(input: {
  publicCaseId: string;
  presentationId: string;
  reviewerId: string;
  form: JournalRecordRewriteReviewForm;
}) {
  const round = await loadRound();
  const index = caseIndex(input.publicCaseId);
  if (!round || index === null) throw new Error("JOURNAL_RECORD_REWRITE_CASE_NOT_FOUND");
  const item = round.package.cases[index];
  const source = round.sources.sources[index];
  if (!source || source.selection.caseId !== item.case_id) {
    throw new Error("JOURNAL_RECORD_REWRITE_CASE_BINDING_INVALID");
  }
  const reviewCandidate = candidateForReview(round, item);
  const expectedPresentation = presentationId(round, item);
  if (expectedPresentation !== input.presentationId) throw new Error("JOURNAL_RECORD_REWRITE_PRESENTATION_STALE");
  if (!reviewCandidate) {
    throw new Error("JOURNAL_RECORD_REWRITE_CASE_BLOCKED");
  }
  await withLock(round.directory, async () => {
    const current = await reviewState({
      directory: round.directory,
      caseId: item.case_id,
      presentationId: expectedPresentation,
      reviewerId: input.reviewerId,
      baselineRecordCardSha256: item.baseline_record_card_sha256,
      candidateRecordCardSha256: candidateBinding(reviewCandidate)
    });
    if (current.decision) throw new Error("JOURNAL_RECORD_REWRITE_ALREADY_DECIDED");
    const normalized = reviewForm(input.form as unknown as Record<string, unknown>, false);
    await appendEvent(resolve(round.directory, DECISION_FILE), {
      schema_version: "2.0",
      event_type: "decision",
      round_id: GI088_RECORD_CARD_REWRITE_V3_ROUND_ID,
      case_id: item.case_id,
      presentation_id: expectedPresentation,
      reviewer_id: input.reviewerId,
      ...normalized,
      candidate_record_card_sha256: candidateBinding(reviewCandidate),
      baseline_record_card_sha256: item.baseline_record_card_sha256,
      reviewed_at: new Date().toISOString()
    } satisfies ReviewEvent);
  });
}
