import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_IDENTITY,
  GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_RUNTIME,
  buildGi088CompleteResponseFirstV17BackgroundSourceMessages,
  createGi088CompleteResponseFirstV17BackgroundSourceIdentity,
  createGi088CompleteResponseFirstV17BackgroundSourceInput,
  observeGi088CompleteResponseFirstV17BackgroundSourceOutput,
  parseGi088CompleteResponseFirstV17BackgroundSourceOutput,
  validateGi088CompleteResponseFirstV17BackgroundSourceOutput
} from "../evals/event-centered-generative/gi088-complete-response-first-v1-7-background-source-alignment/candidate";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME,
  createGi088CompleteResponseFirstV16Identity,
  createGi088CompleteResponseFirstV16Input
} from "../evals/event-centered-generative/gi088-complete-response-first-v1-6-contrastive-coverage/candidate";
import type { EventCenteredCompleteResponseBackgroundFactsV11Output } from "../src/features/interview/event-centered/complete-response-background-facts-v1-1";
import type {
  AICompletionParams,
  AIProvider,
  AIProviderDiagnostics
} from "../src/server/services/ai/ai-provider";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import type { Gi088CompleteResponseFirstCase } from "./gi088-complete-response-first-fixtures";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_CASE_IDS,
  loadGi088CompleteResponseFirstV16FreshStabilityCases,
  type Gi088CompleteResponseFirstV16FreshStabilityCase,
  type Gi088CompleteResponseFirstV16FreshStabilityCaseId
} from "./gi088-complete-response-first-v1-6-fresh-stability-fixtures";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS,
  gi088CompleteResponseFirstV16FreshStabilityReplaySha,
  type Gi088CompleteResponseFirstV16FreshStabilityLedger,
  type Gi088CompleteResponseFirstV16FreshStabilityPlan
} from "./run-gi088-complete-response-first-v1-6-fresh-stability-replay";
import {
  gi088CompleteResponseFirstV16QualitySha,
  runGi088CompleteResponseFirstV16Case,
  type Gi088CompleteResponseFirstV16QualityResult
} from "./run-gi088-complete-response-first-v1-6-contrastive-coverage-quality";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_QUALITY_IDENTITY =
  "2026-08-20.gi088-complete-response-first-v1-7-source-alignment-quality-v1" as const;
export const GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1" as const;
const PRIVATE_ROOT =
  `${ROOT}/.private/complete-response-first-v1-7-source-alignment-quality-v1` as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS = {
  publicStartCard:
    `${ROOT}/complete-response-first-v1-7-source-alignment-quality-v1-start-card.json`,
  publicReceipt:
    `${ROOT}/complete-response-first-v1-7-source-alignment-quality-v1-receipt.json`,
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateReview: `${PRIVATE_ROOT}/review.json`,
  privateRunLock: `${PRIVATE_ROOT}/run.lock`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-complete-response-first-v1-7-source-alignment-quality.ts";
const PARENT_PRIVATE_LEDGER =
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.privateLedger;

const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  executionPlan:
    "docs/plans/2026-08-20-gi088-complete-response-first-v1-7-background-source-alignment.md",
  fixtures:
    "scripts/gi088-complete-response-first-v1-6-fresh-stability-fixtures.ts",
  visibleCandidate:
    "evals/event-centered-generative/gi088-complete-response-first-v1-6-contrastive-coverage/candidate.ts",
  visibleRuntime: "src/features/interview/event-centered/complete-response-first-v1-6.ts",
  backgroundCandidate:
    "evals/event-centered-generative/gi088-complete-response-first-v1-7-background-source-alignment/candidate.ts",
  backgroundSourceAlignment:
    "src/features/interview/event-centered/complete-response-background-facts-v1-1.ts",
  backgroundParentContract:
    "src/features/interview/event-centered/complete-response-background-facts-v1.ts",
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  sourcePrivate:
    `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`,
  sourceReceipt: `${ROOT}/real-problem-regression-v1.2-receipt.json`,
  parentStart:
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.publicStartCard,
  parentReceipt:
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.publicReceipt,
  parentPrivateLedger: PARENT_PRIVATE_LEDGER,
  runner: RUNNER_FILE
} as const;

const GENERATED_VISIBLE_CASE_IDS = ["RPR-CF-02", "RPR-CF-05"] as const;

type VisibleEntry = Parameters<typeof runGi088CompleteResponseFirstV16Case>[0]["entry"];

type ParentVisibleEvidence = {
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  origin: "parent_reused";
  actualVisibleOutput: string;
  responseHash: string;
  totalLatencyMs: number | null;
};

type GeneratedVisibleEvidence = {
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  origin: "new_generated";
  actualVisibleOutput: string;
  responseHash: string;
  totalLatencyMs: number | null;
  result: Gi088CompleteResponseFirstV16QualityResult;
};

type VisibleEvidence = ParentVisibleEvidence | GeneratedVisibleEvidence;

export type Gi088CompleteResponseFirstV17BackgroundResult = {
  order: number;
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  status:
    | "technical_valid"
    | "contract_failure"
    | "technical_failure"
    | "program_gate_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  generationInput: ReturnType<
    typeof createGi088CompleteResponseFirstV17BackgroundSourceInput
  >;
  parentVisibleOutput: string;
  rawProviderOutput: string | null;
  alignedOutput: EventCenteredCompleteResponseBackgroundFactsV11Output | null;
  alignedQuoteCount: number;
  rawResponseHash: string | null;
  alignedOutputHash: string | null;
  validationIssues: string[];
  errorCode: string | null;
  technicalGatePassed: boolean;
  severeProgramGateFailed: boolean;
  requestContract: CapturedRequest | null;
  totalLatencyMs: number | null;
  diagnostics: AIProviderDiagnostics | null;
  observation: ReturnType<
    typeof observeGi088CompleteResponseFirstV17BackgroundSourceOutput
  > | null;
};

type CapturedRequest = {
  temperature: number | null;
  maxTokens: number | null;
  timeoutMs: number | null;
  responseFormat: string | null;
  thinking: string | null;
  reasoningEffortPresent: boolean;
};

type Reservation = {
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  stage: "visible" | "background";
  requestFingerprint: string;
  reservedAt: string;
  status: "started" | "completed";
};

export type Gi088CompleteResponseFirstV17SourceAlignmentLedger = {
  schemaVersion: "1.0";
  identity: typeof GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_QUALITY_IDENTITY;
  planFingerprint: string;
  visibleEvidence: VisibleEvidence[];
  backgroundResults: Gi088CompleteResponseFirstV17BackgroundResult[];
  reservations: Reservation[];
  stopReason: string | null;
};

export type Gi088CompleteResponseFirstV17SourceAlignmentPlan = Awaited<
  ReturnType<typeof createGi088CompleteResponseFirstV17SourceAlignmentPlan>
>;

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function gi088CompleteResponseFirstV17SourceAlignmentSha(value: unknown) {
  const source = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : JSON.stringify(canonicalize(value));
  return createHash("sha256").update(source).digest("hex");
}

function publicCode(value: string) {
  return /^[A-Z][A-Z0-9_.:-]{0,159}$/u.test(value)
    ? value
    : `PRIVATE_DETAIL_SHA256:${gi088CompleteResponseFirstV17SourceAlignmentSha(value)}`;
}

async function fileSha(cwd: string, relativePath: string) {
  return gi088CompleteResponseFirstV17SourceAlignmentSha(
    await readFile(path.join(cwd, relativePath))
  );
}

async function pathExists(file: string) {
  return stat(file).then(() => true).catch(() => false);
}

async function readOptionalJson(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch (error) {
    if (
      error && typeof error === "object" && "code" in error &&
      error.code === "ENOENT"
    ) return null;
    throw error;
  }
}

async function writeJsonAtomic(file: string, value: unknown, privateFile = false) {
  await mkdir(path.dirname(file), {
    recursive: true,
    mode: privateFile ? 0o700 : 0o755
  });
  if (privateFile) await chmod(path.dirname(file), 0o700);
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: privateFile ? 0o600 : 0o644
  });
  await rename(temporary, file);
  if (privateFile) await chmod(file, 0o600);
}

async function acquireRunLock(cwd: string) {
  const file = path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.privateRunLock);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(file), 0o700);
  const handle = await open(file, "wx", 0o600).catch((error: unknown) => {
    if (
      error && typeof error === "object" && "code" in error &&
      error.code === "EEXIST"
    ) throw new Error("GI088_V17_SOURCE_ALIGNMENT_RUN_LOCKED");
    throw error;
  });
  await handle.writeFile(`${JSON.stringify({
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_QUALITY_IDENTITY,
    pid: process.pid,
    acquiredAt: new Date().toISOString()
  })}\n`);
  await handle.sync();
  return async () => {
    await handle.close();
    await unlink(file).catch((error: unknown) => {
      if (
        !error || typeof error !== "object" || !("code" in error) ||
        error.code !== "ENOENT"
      ) throw error;
    });
  };
}

function asFrozenCase(item: Gi088CompleteResponseFirstV16FreshStabilityCase) {
  return item as unknown as Gi088CompleteResponseFirstCase;
}

function assertParentEvidence(input: {
  start: unknown;
  receipt: unknown;
  ledger: unknown;
}) {
  assert(input.start && typeof input.start === "object", "GI088_V17_PARENT_START_INVALID");
  assert(input.receipt && typeof input.receipt === "object", "GI088_V17_PARENT_RECEIPT_INVALID");
  assert(input.ledger && typeof input.ledger === "object", "GI088_V17_PARENT_LEDGER_INVALID");
  const start = input.start as Gi088CompleteResponseFirstV16FreshStabilityPlan;
  const receipt = input.receipt as Record<string, unknown>;
  const ledger = input.ledger as Gi088CompleteResponseFirstV16FreshStabilityLedger;
  assert(
    start.identity === "2026-08-20.gi088-complete-response-first-v1-6-fresh-stability-replay-v1" &&
      receipt.identity === start.identity && ledger.identity === start.identity &&
      receipt.planFingerprint === start.planFingerprint &&
      ledger.planFingerprint === start.planFingerprint,
    "GI088_V17_PARENT_IDENTITY_MISMATCH"
  );
  const budget = receipt.budget as Record<string, unknown> | undefined;
  assert(
    budget?.authorized === 16 && budget.consumed === 12 &&
      budget.completed === 12 && budget.notRun === 4 &&
      ledger.reservations.length === 12 && ledger.results.length === 6 &&
      ledger.stopReason === "SEVERE_BACKGROUND_PROGRAM_GATE:RPR-REAL-20",
    "GI088_V17_PARENT_STOP_EVIDENCE_MISMATCH"
  );
  const visibleEvidence: ParentVisibleEvidence[] = ledger.results.map((item) => {
    assert(
      item.visible.status === "technical_valid" &&
        typeof item.visible.responseHash === "string" &&
        item.visible.responseHash === gi088CompleteResponseFirstV16FreshStabilityReplaySha(
          item.visible.actualVisibleOutput
        ),
      `GI088_V17_PARENT_VISIBLE_INVALID:${item.caseId}`
    );
    return {
      caseId: item.caseId,
      origin: "parent_reused",
      actualVisibleOutput: item.visible.actualVisibleOutput,
      responseHash: item.visible.responseHash,
      totalLatencyMs: item.visible.totalLatencyMs
    };
  });
  const failed = ledger.results.find((item) => item.caseId === "RPR-REAL-20")?.background;
  assert(
    failed?.status === "program_gate_failure" &&
      failed.validationIssues.length === 1 &&
      failed.validationIssues[0] === "FACT_QUOTE_NOT_IN_SOURCE_USER_MESSAGE",
    "GI088_V17_PARENT_PUNCTUATION_FAILURE_MISMATCH"
  );
  return visibleEvidence;
}

async function loadParentVisibleEvidence(cwd: string) {
  const [start, receipt, ledger] = await Promise.all([
    readOptionalJson(path.join(cwd, FILES.parentStart)),
    readOptionalJson(path.join(cwd, FILES.parentReceipt)),
    readOptionalJson(path.join(cwd, FILES.parentPrivateLedger))
  ]);
  return assertParentEvidence({ start, receipt, ledger });
}

export async function createGi088CompleteResponseFirstV17SourceAlignmentPlan(
  cwd = process.cwd()
) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(
    standardSha256 === GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const [dataset, parentVisibleEvidence] = await Promise.all([
    loadGi088CompleteResponseFirstV16FreshStabilityCases(cwd),
    loadParentVisibleEvidence(cwd)
  ]);
  const inputHashes = Object.fromEntries(
    await Promise.all(Object.entries(FILES).map(async ([key, relativePath]) => [
      `${key}Sha256`,
      await fileSha(cwd, relativePath)
    ]))
  );
  const visibleIdentity = createGi088CompleteResponseFirstV16Identity();
  const backgroundIdentity = {
    candidate: GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_IDENTITY,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_RUNTIME
  };
  const backgroundCandidateFingerprint =
    gi088CompleteResponseFirstV17SourceAlignmentSha(backgroundIdentity);
  const cases = dataset.cases.map((item, index) => {
    const parent = parentVisibleEvidence.find((candidate) => candidate.caseId === item.caseId);
    const frozen = asFrozenCase(item);
    const visibleGenerationInput = createGi088CompleteResponseFirstV16Input(frozen);
    return {
      order: index + 1,
      caseId: item.caseId,
      hardGate: item.hardGate,
      sourceFingerprint: item.sourceFingerprint,
      visibleOrigin: parent ? "parent_reused" as const : "new_generated" as const,
      parentVisibleOutputHash: parent?.responseHash ?? null,
      visibleRequestFingerprint: parent ? null : gi088CompleteResponseFirstV16QualitySha({
        candidateFingerprint: visibleIdentity.candidateFingerprint,
        caseId: item.caseId,
        generationInput: visibleGenerationInput
      }),
      backgroundAuthorizationFingerprint:
        gi088CompleteResponseFirstV17SourceAlignmentSha({
          caseId: item.caseId,
          sourceFingerprint: item.sourceFingerprint,
          backgroundCandidateFingerprint
        })
    };
  });
  assert(
    cases.filter((item) => item.visibleOrigin === "parent_reused").length === 6 &&
      cases.filter((item) => item.visibleOrigin === "new_generated")
        .map((item) => item.caseId).join(",") === GENERATED_VISIBLE_CASE_IDS.join(","),
    "GI088_V17_VISIBLE_LINEAGE_MISMATCH"
  );
  const core = {
    schemaVersion: "1.0" as const,
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_QUALITY_IDENTITY,
    status: "ready" as const,
    standardSha256,
    dataset: {
      version: dataset.datasetVersion,
      fingerprint: dataset.datasetFingerprint,
      sourceVersion: dataset.sourceDatasetVersion,
      sourceFingerprint: dataset.sourceDatasetFingerprint,
      privacyLevel: "private_sensitive" as const,
      count: dataset.cases.length
    },
    candidates: {
      visible: visibleIdentity,
      background: { ...backgroundIdentity, candidateFingerprint: backgroundCandidateFingerprint }
    },
    parentEvidence: {
      identity: "2026-08-20.gi088-complete-response-first-v1-6-fresh-stability-replay-v1",
      consumed: 12,
      completed: 12,
      remainingNotRun: 4,
      reusedVisibleCases: 6,
      confirmedFailure:
        "RPR-REAL-20_FACT_QUOTE_PUNCTUATION_ONLY_SOURCE_MISMATCH"
    },
    cases,
    runtime: {
      visible: GI088_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME,
      background: GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_RUNTIME,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    budget: { authorized: 10, visible: 2, background: 8 },
    changedFactor:
      "align_punctuation_and_whitespace_only_then_store_exact_source_substring",
    stopRules: {
      ordinarySemanticIssueStopsBatch: false,
      singleSevereProgramGateStopsBatch: true,
      consecutiveTechnicalFailures: 2,
      unresolvedReservationRecovery: 0
    },
    releaseBoundary: {
      preview: "not_run",
      production: "event_centered_plus_baseline_unchanged"
    },
    inputHashes
  };
  return {
    ...core,
    planFingerprint: gi088CompleteResponseFirstV17SourceAlignmentSha(core)
  };
}

function emptyLedger(input: {
  plan: Gi088CompleteResponseFirstV17SourceAlignmentPlan;
  parentVisibleEvidence: ParentVisibleEvidence[];
}): Gi088CompleteResponseFirstV17SourceAlignmentLedger {
  return {
    schemaVersion: "1.0",
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_QUALITY_IDENTITY,
    planFingerprint: input.plan.planFingerprint,
    visibleEvidence: input.parentVisibleEvidence,
    backgroundResults: [],
    reservations: [],
    stopReason: null
  };
}

function publicBackground(item: Gi088CompleteResponseFirstV17BackgroundResult) {
  return {
    caseId: item.caseId,
    status: item.status,
    rawResponseHash: item.rawResponseHash,
    alignedOutputHash: item.alignedOutputHash,
    alignedQuoteCount: item.alignedQuoteCount,
    validationIssueCount: item.validationIssues.length,
    validationIssueHashes: item.validationIssues.map((issue) =>
      gi088CompleteResponseFirstV17SourceAlignmentSha(issue)
    ),
    errorCode: item.errorCode ? publicCode(item.errorCode) : null,
    technicalGatePassed: item.technicalGatePassed,
    totalLatencyMs: item.totalLatencyMs,
    finishReason: item.diagnostics?.finishReason ?? null,
    promptTokens: item.diagnostics?.tokenUsage?.promptTokens ?? null,
    completionTokens: item.diagnostics?.tokenUsage?.completionTokens ?? null,
    reasoningTokens: item.diagnostics?.reasoningTokens ?? null
  };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

async function saveEvidence(
  cwd: string,
  plan: Gi088CompleteResponseFirstV17SourceAlignmentPlan,
  ledger: Gi088CompleteResponseFirstV17SourceAlignmentLedger,
  dataset: Awaited<ReturnType<typeof loadGi088CompleteResponseFirstV16FreshStabilityCases>>
) {
  const completed = ledger.reservations.filter((item) => item.status === "completed").length;
  const latencies = [
    ...ledger.visibleEvidence.filter((item) => item.origin === "new_generated")
      .map((item) => item.totalLatencyMs),
    ...ledger.backgroundResults.map((item) => item.totalLatencyMs)
  ].filter((value): value is number => typeof value === "number");
  const receipt = {
    schemaVersion: "1.0",
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: ledger.stopReason
      ? "stopped"
      : completed === plan.budget.authorized
        ? "awaiting_product_review"
        : "in_progress",
    budget: {
      authorized: plan.budget.authorized,
      consumed: ledger.reservations.length,
      completed,
      notRun: plan.budget.authorized - ledger.reservations.length
    },
    visible: {
      parentReused: ledger.visibleEvidence.filter((item) => item.origin === "parent_reused").length,
      newlyGenerated: ledger.visibleEvidence.filter((item) => item.origin === "new_generated").length,
      evidence: ledger.visibleEvidence.map((item) => ({
        caseId: item.caseId,
        origin: item.origin,
        responseHash: item.responseHash,
        totalLatencyMs: item.totalLatencyMs,
        status: item.origin === "parent_reused" ? "parent_technical_valid" : item.result.status
      }))
    },
    background: ledger.backgroundResults.map(publicBackground),
    latency: {
      medianMs: median(latencies),
      maxMs: latencies.length > 0 ? Math.max(...latencies) : null
    },
    stopReason: ledger.stopReason ? publicCode(ledger.stopReason) : null,
    productOwnerReview: "pending",
    privateBoundary: {
      publicReceiptContainsUserOrModelBody: false,
      rawInputsOutputsAndReviews: "git_ignored_private_directory"
    }
  };
  const review = {
    schemaVersion: "1.0",
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    instruction:
      "逐例阅读完整用户输入、实际可见回应和对齐后的后台事实，再填写 Codex 初评与产品负责人裁决。",
    cases: GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_CASE_IDS.map((caseId) => {
      const item = dataset.cases.find((candidate) => candidate.caseId === caseId)!;
      const visible = ledger.visibleEvidence.find((candidate) => candidate.caseId === caseId);
      const background = ledger.backgroundResults.find((candidate) => candidate.caseId === caseId);
      return {
        caseId,
        expectedBehavior: item.expectedBehavior,
        prohibitedRisks: item.prohibitedRisks,
        turnInput: item.turnInput,
        actualVisibleOutput: visible?.actualVisibleOutput ?? null,
        visibleResponseHash: visible?.responseHash ?? null,
        visibleOrigin: visible?.origin ?? "not_run",
        backgroundOutput: background?.alignedOutput ?? null,
        backgroundRawOutput: background?.rawProviderOutput ?? null,
        backgroundAlignedQuoteCount: background?.alignedQuoteCount ?? null,
        backgroundStatus: background?.status ?? "not_run",
        codexReview: null,
        productOwnerReview: null
      };
    })
  };
  await Promise.all([
    writeJsonAtomic(path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.privateLedger), ledger, true),
    writeJsonAtomic(path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.privateReview), review, true),
    writeJsonAtomic(path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.publicReceipt), receipt)
  ]);
}

async function readLedger(
  cwd: string,
  plan: Gi088CompleteResponseFirstV17SourceAlignmentPlan
) {
  const raw = await readOptionalJson(path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.privateLedger));
  assert(raw && typeof raw === "object", "GI088_V17_LEDGER_MISSING");
  const ledger = raw as Gi088CompleteResponseFirstV17SourceAlignmentLedger;
  assert(
    ledger.identity === plan.identity && ledger.planFingerprint === plan.planFingerprint,
    "GI088_V17_LEDGER_IDENTITY_DRIFT"
  );
  return ledger;
}

export function assertGi088CompleteResponseFirstV17SourceAlignmentFrozenPlan(input: {
  frozen: Gi088CompleteResponseFirstV17SourceAlignmentPlan;
  current: Gi088CompleteResponseFirstV17SourceAlignmentPlan;
}) {
  assert(
    gi088CompleteResponseFirstV17SourceAlignmentSha(input.frozen) ===
      gi088CompleteResponseFirstV17SourceAlignmentSha(input.current),
    "GI088_V17_FROZEN_PLAN_DRIFT"
  );
}

export async function prepareGi088CompleteResponseFirstV17SourceAlignment(
  cwd = process.cwd()
) {
  const startFile = path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.publicStartCard);
  if (await pathExists(startFile)) {
    const frozen = JSON.parse(await readFile(startFile, "utf8")) as
      Gi088CompleteResponseFirstV17SourceAlignmentPlan;
    const current = await createGi088CompleteResponseFirstV17SourceAlignmentPlan(cwd);
    assertGi088CompleteResponseFirstV17SourceAlignmentFrozenPlan({ frozen, current });
    return frozen;
  }
  const [plan, parentVisibleEvidence, dataset] = await Promise.all([
    createGi088CompleteResponseFirstV17SourceAlignmentPlan(cwd),
    loadParentVisibleEvidence(cwd),
    loadGi088CompleteResponseFirstV16FreshStabilityCases(cwd)
  ]);
  assert(
    !(await pathExists(path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.publicReceipt))) &&
      !(await pathExists(path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.privateLedger))),
    "GI088_V17_EVIDENCE_EXISTS_WITHOUT_START_CARD"
  );
  const ledger = emptyLedger({ plan, parentVisibleEvidence });
  await writeJsonAtomic(startFile, plan);
  await saveEvidence(cwd, plan, ledger, dataset);
  return plan;
}

function captureProvider(base: AIProvider, observed: {
  request: CapturedRequest | null;
  diagnostics: AIProviderDiagnostics | null;
}): AIProvider {
  return {
    name: base.name,
    complete: async (params: AICompletionParams) => {
      observed.request = {
        temperature: params.temperature ?? null,
        maxTokens: params.maxTokens ?? null,
        timeoutMs: params.timeoutMs ?? null,
        responseFormat: params.responseFormat ?? null,
        thinking: params.thinking ?? null,
        reasoningEffortPresent: Object.hasOwn(params, "reasoningEffort")
      };
      const result = await base.complete(params);
      observed.diagnostics = sanitizeAIProviderDiagnostics(result.diagnostics);
      return result;
    }
  };
}

function backgroundRequestValid(request: CapturedRequest | null) {
  return Boolean(
    request && request.temperature === 0.2 && request.maxTokens === 1_600 &&
      request.timeoutMs === 20_000 && request.responseFormat === "json_object" &&
      request.thinking === "disabled" && !request.reasoningEffortPresent
  );
}

function backgroundRequest(input: {
  item: Gi088CompleteResponseFirstV16FreshStabilityCase;
  actualVisibleOutput: string;
}) {
  const generationInput = createGi088CompleteResponseFirstV17BackgroundSourceInput({
    item: asFrozenCase(input.item),
    actualVisibleOutput: input.actualVisibleOutput
  });
  const identity = createGi088CompleteResponseFirstV17BackgroundSourceIdentity({
    caseId: input.item.caseId,
    input: generationInput
  });
  const messages = buildGi088CompleteResponseFirstV17BackgroundSourceMessages(generationInput);
  const candidateFingerprint = gi088CompleteResponseFirstV17SourceAlignmentSha({
    candidate: GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_IDENTITY,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_RUNTIME
  });
  return {
    generationInput,
    messages,
    requestFingerprint: gi088CompleteResponseFirstV17SourceAlignmentSha({
      candidateFingerprint,
      identity,
      messages
    })
  };
}

export async function runGi088CompleteResponseFirstV17BackgroundCase(input: {
  order: number;
  item: Gi088CompleteResponseFirstV16FreshStabilityCase;
  actualVisibleOutput: string;
  expectedRequestFingerprint: string;
  provider: AIProvider;
}): Promise<Gi088CompleteResponseFirstV17BackgroundResult> {
  const request = backgroundRequest({
    item: input.item,
    actualVisibleOutput: input.actualVisibleOutput
  });
  assert(
    request.requestFingerprint === input.expectedRequestFingerprint,
    `GI088_V17_BACKGROUND_REQUEST_DRIFT:${input.item.caseId}`
  );
  const observed: {
    request: CapturedRequest | null;
    diagnostics: AIProviderDiagnostics | null;
  } = { request: null, diagnostics: null };
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let rawProviderOutput: string | null = null;
  let alignedOutput: EventCenteredCompleteResponseBackgroundFactsV11Output | null = null;
  let alignedQuoteCount = 0;
  let providerErrorCode: string | null = null;
  try {
    const completion = await captureProvider(input.provider, observed).complete({
      messages: request.messages,
      temperature: GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_RUNTIME.temperature,
      maxTokens: GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_RUNTIME.maxTokens,
      timeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_RUNTIME.timeoutMs,
      responseFormat: "json_object",
      thinking: "disabled"
    });
    rawProviderOutput = completion.content;
    observed.diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
    try {
      const parsed = parseGi088CompleteResponseFirstV17BackgroundSourceOutput({
        generationInput: request.generationInput,
        content: completion.content
      });
      alignedOutput = parsed.output;
      alignedQuoteCount = parsed.alignedQuoteCount;
    } catch (error) {
      providerErrorCode = error instanceof Error
        ? error.message
        : "BACKGROUND_FACTS_OUTPUT_PARSE_FAILED";
    }
  } catch (error) {
    providerErrorCode = getAIProviderFailureCode(error);
    observed.diagnostics = getAIProviderDiagnostics(error);
  }
  const diagnostics = observed.diagnostics;
  const totalLatencyMs = diagnostics?.totalLatencyMs ?? diagnostics?.latencyMs ??
    Math.max(0, Date.now() - startedMs);
  const validationIssues = alignedOutput
    ? validateGi088CompleteResponseFirstV17BackgroundSourceOutput({
        generationInput: request.generationInput,
        output: alignedOutput
      })
    : [];
  if (!backgroundRequestValid(observed.request)) {
    validationIssues.push("BACKGROUND_FACTS_REQUEST_CONTRACT_MISMATCH");
  }
  const uniqueIssues = [...new Set(validationIssues)];
  const severeProgramGateFailed = uniqueIssues.length > 0;
  const finishLength = diagnostics?.finishReason === "length";
  const status = severeProgramGateFailed
    ? "program_gate_failure" as const
    : finishLength
      ? "technical_failure" as const
      : providerErrorCode && providerErrorCode !== "BACKGROUND_FACTS_OUTPUT_INVALID_SCHEMA"
        ? "technical_failure" as const
        : !alignedOutput
          ? "contract_failure" as const
          : "technical_valid" as const;
  const technicalGatePassed = status === "technical_valid" &&
    diagnostics?.responseModel ===
      GI088_COMPLETE_RESPONSE_FIRST_V1_7_BACKGROUND_SOURCE_ALIGNMENT_RUNTIME.model &&
    diagnostics.finishReason === "stop" && diagnostics.reasoningPresent === false &&
    (diagnostics.reasoningTokens === null || diagnostics.reasoningTokens === 0) &&
    totalLatencyMs <= 20_000;
  return {
    order: input.order,
    caseId: input.item.caseId,
    status,
    startedAt,
    completedAt: new Date().toISOString(),
    requestFingerprint: request.requestFingerprint,
    generationInput: request.generationInput,
    parentVisibleOutput: input.actualVisibleOutput,
    rawProviderOutput,
    alignedOutput,
    alignedQuoteCount,
    rawResponseHash: rawProviderOutput
      ? gi088CompleteResponseFirstV17SourceAlignmentSha(rawProviderOutput)
      : null,
    alignedOutputHash: alignedOutput
      ? gi088CompleteResponseFirstV17SourceAlignmentSha(alignedOutput)
      : null,
    validationIssues: uniqueIssues,
    errorCode: finishLength
      ? "TOKEN_CEILING_INCONCLUSIVE"
      : providerErrorCode ?? (status === "contract_failure"
        ? "BACKGROUND_FACTS_CONTRACT_FAILURE"
        : severeProgramGateFailed
          ? "BACKGROUND_FACTS_SOURCE_OR_REFERENCE_INVALID"
          : null),
    technicalGatePassed,
    severeProgramGateFailed,
    requestContract: observed.request,
    totalLatencyMs,
    diagnostics,
    observation: alignedOutput
      ? observeGi088CompleteResponseFirstV17BackgroundSourceOutput({
          output: alignedOutput,
          alignedQuoteCount
        })
      : null
  };
}

function reserve(input: {
  ledger: Gi088CompleteResponseFirstV17SourceAlignmentLedger;
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  stage: Reservation["stage"];
  requestFingerprint: string;
}) {
  assert(
    input.ledger.reservations.length < 10 &&
      !input.ledger.reservations.some((item) =>
        item.caseId === input.caseId && item.stage === input.stage
      ),
    `GI088_V17_BUDGET_OR_DUPLICATE:${input.caseId}:${input.stage}`
  );
  input.ledger.reservations.push({
    caseId: input.caseId,
    stage: input.stage,
    requestFingerprint: input.requestFingerprint,
    reservedAt: new Date().toISOString(),
    status: "started"
  });
}

function completeReservation(
  ledger: Gi088CompleteResponseFirstV17SourceAlignmentLedger,
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId,
  stage: Reservation["stage"]
) {
  const reservation = ledger.reservations.find((item) =>
    item.caseId === caseId && item.stage === stage
  );
  assert(reservation, `GI088_V17_RESERVATION_MISSING:${caseId}:${stage}`);
  reservation.status = "completed";
}

function visibleEntry(input: {
  plan: Gi088CompleteResponseFirstV17SourceAlignmentPlan;
  item: Gi088CompleteResponseFirstV16FreshStabilityCase;
}) {
  const entry = input.plan.cases.find((candidate) => candidate.caseId === input.item.caseId);
  assert(entry?.visibleRequestFingerprint, `GI088_V17_VISIBLE_REQUEST_MISSING:${input.item.caseId}`);
  const generationInput = createGi088CompleteResponseFirstV16Input(asFrozenCase(input.item));
  return {
    order: entry.order,
    caseId: input.item.caseId,
    split: "regression",
    hardGate: input.item.hardGate,
    sourceFingerprint: input.item.sourceFingerprint,
    generationInputFingerprint: gi088CompleteResponseFirstV16QualitySha(generationInput),
    requestFingerprint: entry.visibleRequestFingerprint
  } as unknown as VisibleEntry;
}

export async function runGi088CompleteResponseFirstV17SourceAlignmentQuality(input: {
  cwd?: string;
  plan: Gi088CompleteResponseFirstV17SourceAlignmentPlan;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const release = await acquireRunLock(cwd);
  try {
    const current = await createGi088CompleteResponseFirstV17SourceAlignmentPlan(cwd);
    assertGi088CompleteResponseFirstV17SourceAlignmentFrozenPlan({
      frozen: input.plan,
      current
    });
    const dataset = await loadGi088CompleteResponseFirstV16FreshStabilityCases(cwd);
    const ledger = await readLedger(cwd, input.plan);
    assert(
      !ledger.reservations.some((item) => item.status === "started"),
      "GI088_V17_UNRESOLVED_RESERVATION_NO_RECOVERY"
    );
    let consecutiveTechnicalFailures = 0;

    for (const caseId of GENERATED_VISIBLE_CASE_IDS) {
      if (ledger.stopReason) break;
      if (ledger.visibleEvidence.some((item) => item.caseId === caseId)) continue;
      const item = dataset.cases.find((candidate) => candidate.caseId === caseId)!;
      const planCase = input.plan.cases.find((candidate) => candidate.caseId === caseId)!;
      const entry = visibleEntry({ plan: input.plan, item });
      reserve({
        ledger,
        caseId,
        stage: "visible",
        requestFingerprint: entry.requestFingerprint
      });
      await saveEvidence(cwd, input.plan, ledger, dataset);
      const result = await runGi088CompleteResponseFirstV16Case({
        entry,
        item: asFrozenCase(item),
        provider: input.provider
      });
      completeReservation(ledger, caseId, "visible");
      consecutiveTechnicalFailures = result.status === "technical_failure"
        ? consecutiveTechnicalFailures + 1
        : 0;
      assert(result.responseHash, `GI088_V17_VISIBLE_RESPONSE_HASH_MISSING:${caseId}`);
      ledger.visibleEvidence.push({
        caseId,
        origin: "new_generated",
        actualVisibleOutput: result.actualVisibleOutput,
        responseHash: result.responseHash,
        totalLatencyMs: result.totalLatencyMs,
        result
      });
      if (result.severeProgramGateFailed) {
        ledger.stopReason = `SEVERE_VISIBLE_PROGRAM_GATE:${caseId}`;
      } else if (consecutiveTechnicalFailures >= 2) {
        ledger.stopReason = `TWO_CONSECUTIVE_TECHNICAL_FAILURES:${caseId}`;
      } else if (result.status !== "technical_valid") {
        ledger.stopReason = `VISIBLE_NOT_TECHNICAL_VALID:${caseId}`;
      }
      assert(planCase.visibleOrigin === "new_generated", "GI088_V17_VISIBLE_ORIGIN_DRIFT");
      await saveEvidence(cwd, input.plan, ledger, dataset);
    }

    for (const caseId of GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_CASE_IDS) {
      if (ledger.stopReason) break;
      if (ledger.backgroundResults.some((item) => item.caseId === caseId)) continue;
      const item = dataset.cases.find((candidate) => candidate.caseId === caseId)!;
      const visible = ledger.visibleEvidence.find((candidate) => candidate.caseId === caseId);
      assert(visible, `GI088_V17_VISIBLE_EVIDENCE_MISSING:${caseId}`);
      const planCase = input.plan.cases.find((candidate) => candidate.caseId === caseId)!;
      const request = backgroundRequest({ item, actualVisibleOutput: visible.actualVisibleOutput });
      reserve({
        ledger,
        caseId,
        stage: "background",
        requestFingerprint: request.requestFingerprint
      });
      await saveEvidence(cwd, input.plan, ledger, dataset);
      const result = await runGi088CompleteResponseFirstV17BackgroundCase({
        order: planCase.order,
        item,
        actualVisibleOutput: visible.actualVisibleOutput,
        expectedRequestFingerprint: request.requestFingerprint,
        provider: input.provider
      });
      ledger.backgroundResults.push(result);
      completeReservation(ledger, caseId, "background");
      consecutiveTechnicalFailures = result.status === "technical_failure"
        ? consecutiveTechnicalFailures + 1
        : 0;
      if (result.severeProgramGateFailed) {
        ledger.stopReason = `SEVERE_BACKGROUND_PROGRAM_GATE:${caseId}`;
      } else if (consecutiveTechnicalFailures >= 2) {
        ledger.stopReason = `TWO_CONSECUTIVE_TECHNICAL_FAILURES:${caseId}`;
      }
      await saveEvidence(cwd, input.plan, ledger, dataset);
    }
    return ledger;
  } finally {
    await release();
  }
}

export async function inspectGi088CompleteResponseFirstV17SourceAlignmentQuality(
  cwd = process.cwd()
) {
  const plan = await prepareGi088CompleteResponseFirstV17SourceAlignment(cwd);
  const ledger = await readLedger(cwd, plan);
  const completed = ledger.reservations.filter((item) => item.status === "completed").length;
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    visible: {
      parentReused: ledger.visibleEvidence.filter((item) => item.origin === "parent_reused").length,
      newlyGenerated: ledger.visibleEvidence.filter((item) => item.origin === "new_generated").length
    },
    background: {
      completed: ledger.backgroundResults.length,
      technicalValid: ledger.backgroundResults.filter((item) => item.status === "technical_valid").length,
      alignedQuotes: ledger.backgroundResults.reduce((total, item) => total + item.alignedQuoteCount, 0)
    },
    budget: {
      authorized: plan.budget.authorized,
      consumed: ledger.reservations.length,
      completed,
      notRun: plan.budget.authorized - ledger.reservations.length
    },
    stopReason: ledger.stopReason,
    publicReceipt: GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.publicReceipt,
    privateReview: GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_PATHS.privateReview
  };
}

async function providerForExecution(cwd: string) {
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_V17_DEEPSEEK_API_KEY_MISSING");
  return new OpenAIProvider({
    apiKey,
    model: GI088_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME.timeoutMs
  });
}

async function main() {
  const cwd = process.cwd();
  const command = process.env.GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_COMMAND ??
    process.argv[2] ?? "prepare";
  assert(
    command === "prepare" || command === "execute" || command === "inspect",
    "GI088_V17_UNKNOWN_COMMAND"
  );
  if (command === "prepare") {
    await prepareGi088CompleteResponseFirstV17SourceAlignment(cwd);
  } else if (command === "execute") {
    const plan = await prepareGi088CompleteResponseFirstV17SourceAlignment(cwd);
    const provider = await providerForExecution(cwd);
    await runGi088CompleteResponseFirstV17SourceAlignmentQuality({
      cwd,
      plan,
      provider
    });
  }
  process.stdout.write(`${JSON.stringify(
    await inspectGi088CompleteResponseFirstV17SourceAlignmentQuality(cwd),
    null,
    2
  )}\n`);
}

export function shouldRunGi088CompleteResponseFirstV17SourceAlignmentCli(input: {
  argv?: string[];
  env?: Partial<NodeJS.ProcessEnv>;
} = {}) {
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;
  return env.VITEST !== "true" && Boolean(
    env.GI088_COMPLETE_RESPONSE_FIRST_V1_7_SOURCE_ALIGNMENT_COMMAND ||
      argv.some((item) => path.resolve(item) === path.resolve(RUNNER_FILE))
  );
}

if (shouldRunGi088CompleteResponseFirstV17SourceAlignmentCli()) {
  void main().catch((error) => {
    process.stderr.write(`${
      error instanceof Error ? error.stack ?? error.message : String(error)
    }\n`);
    process.exitCode = 1;
  });
}
