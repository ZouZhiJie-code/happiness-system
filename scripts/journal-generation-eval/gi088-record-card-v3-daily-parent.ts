import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  canonicalJson,
  sha256Canonical,
  type Gi088CalibrationRecordCard
} from "./gi088-calibration-contract";
import {
  GI088_RECORD_CARD_REWRITE_V3_PROMPT_VERSION,
  GI088_RECORD_CARD_REWRITE_V3_SYSTEM_PROMPT_HASH
} from "./gi088-record-card-rewrite-v3-contract";
import {
  loadCommittedGi088RecordCardRewriteV3,
  type Gi088RecordCardRewriteV3Package
} from "./run-gi088-record-card-rewrite-v3";
import {
  loadGi088HumanExtensionSources,
  type Gi088HumanExtensionSourceBundle
} from "./gi088-human-extension-source";

const PRIVATE_ROOT = "artifacts/journal-generation-evaluation/.private" as const;
const RECORD_CARD_V3_ROOT = `${PRIVATE_ROOT}/formal/record-card-rewrite-v3` as const;
const REVIEWS_FILE = "record-rewrite-v3-reviews.ndjson" as const;
const DRAFTS_FILE = "record-rewrite-v3-review-drafts.ndjson" as const;
const RECORD_CARD_V3_ROUND_ID = "gi088-record-card-rewrite-v3" as const;

export const GI088_RECORD_CARD_V3_DAILY_ROUND_ID =
  "gi088-record-card-v3-daily-regression" as const;
export const GI088_RECORD_CARD_V3_DAILY_VERSION =
  "2026-08-12.gi088-record-card-v3-daily-regression" as const;

const REQUIRED_CASE_IDS = [
  "private:sg-gi088-v6-single-focus:A1:high",
  "private:sg-gi088-v7-continuity-baseline:A1:high",
  "private:sg-gi088-v7-continuity-baseline:A2:high",
  "private:sg-gi088-v7r2-ark-flash:A1:high",
  "private:sg-gi088-v7r2-ark-flash:A2:high",
  "private:sg-gi088-v7r4-pro:A1:high"
] as const;

type DailySourceRound = {
  directory: string;
  package: {
    round_id: string;
    execution_fingerprint: string;
  };
  sourceBundle: Gi088HumanExtensionSourceBundle;
  artifactSha256: Record<string, string>;
};

export interface Gi088RecordCardV3DailyConfirmation {
  caseId: string;
  sourceGroupId: string;
  sourceFileSha256: string;
  sourceProjectionSha256: string;
  originalRecordCard: Gi088CalibrationRecordCard;
  originalRecordCardSha256: string;
  approvedRecordCard: Gi088CalibrationRecordCard;
  approvedRecordCardSha256: string;
  sourceSignature: string;
  contentRevision: 1;
  edited: false;
  verdict: "ready_to_use";
  confirmationPresentationId: string;
  confirmedAt: string;
};

export interface Gi088RecordCardV3DailyConfirmationBundle {
  recordRound: DailySourceRound;
  confirmations: Gi088RecordCardV3DailyConfirmation[];
  confirmationSetSha256: string;
  parentPackage: Gi088RecordCardRewriteV3Package;
  reviewsSha256: string;
  draftsSha256: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readJson<T>(path: string, errorCode: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    throw new Error(errorCode);
  }
}

async function sha256File(path: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function assertRequiredCases(packageValue: Gi088RecordCardRewriteV3Package) {
  const actual = packageValue.cases.map((item) => item.case_id);
  if (actual.length !== REQUIRED_CASE_IDS.length
    || canonicalJson([...actual].sort()) !== canonicalJson([...REQUIRED_CASE_IDS].sort())) {
    throw new Error("GI088_RECORD_CARD_V3_DAILY_CASE_SET_INVALID");
  }
}

async function discoverParentDirectory(projectRoot: string) {
  const root = resolve(projectRoot, RECORD_CARD_V3_ROOT);
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    throw new Error("GI088_RECORD_CARD_V3_DAILY_PARENT_MISSING");
  }
  const valid: string[] = [];
  for (const entry of entries.sort()) {
    if (!entry.startsWith("gi088-record-card-rewrite-v3-")) continue;
    const directory = resolve(root, entry);
    try {
      const manifest = await readJson<Record<string, unknown>>(
        resolve(directory, "commit-manifest.json"),
        "GI088_RECORD_CARD_V3_DAILY_PARENT_INVALID"
      );
      if (manifest.status !== "committed") continue;
      const loaded = await loadCommittedGi088RecordCardRewriteV3(directory, projectRoot, false);
      if (loaded.package.mode === "real") valid.push(directory);
    } catch {
      // 旧的或实现快照过期的包保留为历史证据，不进入当前父版本。
    }
  }
  if (valid.length !== 1) {
    throw new Error("GI088_RECORD_CARD_V3_DAILY_PARENT_AMBIGUOUS");
  }
  return valid[0];
}

function reviewEvents(value: string) {
  return value.split(/\r?\n/u).flatMap((line) => {
    if (!line.trim()) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      throw new Error("GI088_RECORD_CARD_V3_DAILY_REVIEWS_INVALID");
    }
    if (!isObject(parsed) || parsed.event_type !== "decision") return [];
    return [parsed];
  });
}

function numberScore(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export async function loadGi088RecordCardV3DailyConfirmations(
  parentDirectory: string | null = null,
  options: { projectRoot?: string } = {}
): Promise<Gi088RecordCardV3DailyConfirmationBundle> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const directory = parentDirectory
    ? resolve(parentDirectory)
    : await discoverParentDirectory(projectRoot);
  const loaded = await loadCommittedGi088RecordCardRewriteV3(directory, projectRoot, false, true);
  const parentPackage = loaded.package;
  if (parentPackage.round_id !== RECORD_CARD_V3_ROUND_ID
    || parentPackage.prompt.version !== GI088_RECORD_CARD_REWRITE_V3_PROMPT_VERSION
    || parentPackage.prompt.system_prompt_sha256 !== GI088_RECORD_CARD_REWRITE_V3_SYSTEM_PROMPT_HASH
    || parentPackage.run.actual_model_calls !== 6
    || parentPackage.run.admitted_cases !== 6) {
    throw new Error("GI088_RECORD_CARD_V3_DAILY_PARENT_SEMANTICS_INVALID");
  }
  assertRequiredCases(parentPackage);

  const reviewsPath = resolve(directory, REVIEWS_FILE);
  const draftsPath = resolve(directory, DRAFTS_FILE);
  const [reviewsText, draftsText, sourceBundle] = await Promise.all([
    readFile(reviewsPath, "utf8").catch(() => {
      throw new Error("GI088_RECORD_CARD_V3_DAILY_REVIEWS_MISSING");
    }),
    readFile(draftsPath, "utf8").catch(() => {
      throw new Error("GI088_RECORD_CARD_V3_DAILY_DRAFTS_MISSING");
    }),
    loadGi088HumanExtensionSources(projectRoot)
  ]);
  if (!draftsText.trim()) {
    throw new Error("GI088_RECORD_CARD_V3_DAILY_DRAFTS_INVALID");
  }
  const reviews = reviewEvents(reviewsText);
  if (reviews.length !== REQUIRED_CASE_IDS.length
    || new Set(reviews.map((item) => item.case_id)).size !== REQUIRED_CASE_IDS.length) {
    throw new Error("GI088_RECORD_CARD_V3_DAILY_REVIEWS_INCOMPLETE");
  }
  const draftsSha256 = await sha256File(draftsPath);
  const reviewsSha256 = await sha256File(reviewsPath);
  const confirmations = REQUIRED_CASE_IDS.map((caseId) => {
    const recordCase = parentPackage.cases.find((item) => item.case_id === caseId);
    const review = reviews.find((item) => item.case_id === caseId);
    const source = sourceBundle.sources.find((item) => item.selection.caseId === caseId);
    if (!recordCase || !review || !source || !recordCase.candidate.record_card) {
      throw new Error(`GI088_RECORD_CARD_V3_DAILY_PARENT_CASE_MISSING:${caseId}`);
    }
    const finalAttempt = [...recordCase.candidate.trace.attempts].reverse().find(
      (attempt) => attempt.outcome === "valid_response"
    );
    const rawResponseSha256 = finalAttempt?.raw_response_sha256 ?? null;
    const reviewCandidateSha256 = sha256Canonical({
      card: recordCase.candidate.record_card,
      raw_response_sha256: rawResponseSha256
    });
    if (review.overall_verdict !== "ready_to_use"
      || !isObject(review.scores)
      || !Object.values(review.scores).every(numberScore)
      || (review.issue_tags as unknown[] | undefined)?.length
      || review.candidate_record_card_sha256 !== reviewCandidateSha256
      || review.baseline_record_card_sha256 !== recordCase.baseline_record_card_sha256
      || typeof review.presentation_id !== "string"
      || typeof review.reviewed_at !== "string") {
      throw new Error(`GI088_RECORD_CARD_V3_DAILY_PARENT_REVIEW_INVALID:${caseId}`);
    }
    const card = recordCase.candidate.record_card;
    const cardSha = sha256Canonical(card);
    const sourceSignature = sha256Canonical({
      roundId: RECORD_CARD_V3_ROUND_ID,
      caseId,
      sourceProjectionSha256: recordCase.source_projection_sha256,
      originalRecordCardSha256: cardSha,
      approvedRecordCardSha256: cardSha,
      contentRevision: 1,
      promptVersion: parentPackage.prompt.version,
      promptHash: parentPackage.prompt.system_prompt_sha256,
      parentExecutionFingerprint: parentPackage.execution_fingerprint
    });
    return {
      caseId,
      sourceGroupId: recordCase.source_group_id,
      sourceFileSha256: recordCase.source_file_sha256,
      sourceProjectionSha256: recordCase.source_projection_sha256,
      originalRecordCard: card,
      originalRecordCardSha256: cardSha,
      approvedRecordCard: card,
      approvedRecordCardSha256: cardSha,
      sourceSignature,
      contentRevision: 1,
      edited: false,
      verdict: "ready_to_use",
      confirmationPresentationId: review.presentation_id as string,
      confirmedAt: review.reviewed_at as string
    } satisfies Gi088RecordCardV3DailyConfirmation;
  });

  const confirmationSetSha256 = sha256Canonical(confirmations.map((item) => ({
    caseId: item.caseId,
    sourceProjectionSha256: item.sourceProjectionSha256,
    originalRecordCardSha256: item.originalRecordCardSha256,
    approvedRecordCardSha256: item.approvedRecordCardSha256,
    sourceSignature: item.sourceSignature,
    contentRevision: item.contentRevision,
    edited: item.edited,
    verdict: item.verdict,
    confirmationPresentationId: item.confirmationPresentationId
  })));
  const [packageSha256, manifestSha256, ledgerSha256, lockSha256] = await Promise.all([
    sha256File(resolve(directory, "round-package.json")),
    sha256File(resolve(directory, "commit-manifest.json")),
    sha256File(resolve(directory, "attempt-ledger.ndjson")),
    sha256File(resolve(directory, "round-run.lock.json"))
  ]);
  return {
    recordRound: {
      directory,
      package: {
        round_id: parentPackage.round_id,
        execution_fingerprint: parentPackage.execution_fingerprint
      },
      sourceBundle,
      artifactSha256: {
        package: packageSha256,
        manifest: manifestSha256,
        attempt_ledger: ledgerSha256,
        run_lock: lockSha256,
        reviews: reviewsSha256,
        drafts: draftsSha256
      }
    },
    confirmations,
    confirmationSetSha256,
    parentPackage,
    reviewsSha256,
    draftsSha256
  };
}

export async function assertGi088RecordCardV3DailyConfirmationsUnchanged(
  expected: Gi088RecordCardV3DailyConfirmationBundle,
  options: { projectRoot?: string } = {}
) {
  const current = await loadGi088RecordCardV3DailyConfirmations(
    expected.recordRound.directory,
    options
  );
  if (current.confirmationSetSha256 !== expected.confirmationSetSha256
    || current.parentPackage.execution_fingerprint !== expected.parentPackage.execution_fingerprint
    || canonicalJson(current.recordRound.artifactSha256)
      !== canonicalJson(expected.recordRound.artifactSha256)) {
    throw new Error("GI088_RECORD_CARD_V3_DAILY_PARENT_CHANGED");
  }
}
