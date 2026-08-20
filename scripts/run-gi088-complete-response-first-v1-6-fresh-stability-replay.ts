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
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_IDENTITY,
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME,
  buildGi088CompleteResponseFirstV16BackgroundFactsMessages,
  createGi088CompleteResponseFirstV16BackgroundFactsIdentity,
  createGi088CompleteResponseFirstV16BackgroundFactsInput
} from "../evals/event-centered-generative/gi088-complete-response-first-v1-6-background-facts/candidate";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME,
  createGi088CompleteResponseFirstV16Identity,
  createGi088CompleteResponseFirstV16Input
} from "../evals/event-centered-generative/gi088-complete-response-first-v1-6-contrastive-coverage/candidate";
import type { AIProvider } from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import type { Gi088CompleteResponseFirstCase } from "./gi088-complete-response-first-fixtures";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_CASE_IDS,
  loadGi088CompleteResponseFirstV16FreshStabilityCases,
  type Gi088CompleteResponseFirstV16FreshStabilityCase,
  type Gi088CompleteResponseFirstV16FreshStabilityCaseId
} from "./gi088-complete-response-first-v1-6-fresh-stability-fixtures";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS,
  gi088CompleteResponseFirstV16BackgroundFactsQualitySha,
  runGi088CompleteResponseFirstV16BackgroundFactsCase,
  type Gi088CompleteResponseFirstV16BackgroundFactsQualityResult
} from "./run-gi088-complete-response-first-v1-6-background-facts-quality";
import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_QUALITY_PATHS,
  gi088CompleteResponseFirstV16QualitySha,
  runGi088CompleteResponseFirstV16Case,
  type Gi088CompleteResponseFirstV16QualityResult
} from "./run-gi088-complete-response-first-v1-6-contrastive-coverage-quality";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_IDENTITY =
  "2026-08-20.gi088-complete-response-first-v1-6-fresh-stability-replay-v1" as const;
export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1" as const;
const PRIVATE_ROOT =
  `${ROOT}/.private/complete-response-first-v1-6-fresh-stability-replay-v1` as const;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS = {
  publicStartCard:
    `${ROOT}/complete-response-first-v1-6-fresh-stability-replay-v1-start-card.json`,
  publicReceipt:
    `${ROOT}/complete-response-first-v1-6-fresh-stability-replay-v1-receipt.json`,
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateReview: `${PRIVATE_ROOT}/review.json`,
  privateRunLock: `${PRIVATE_ROOT}/run.lock`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-complete-response-first-v1-6-fresh-stability-replay.ts";
const FIXTURE_FILE =
  "scripts/gi088-complete-response-first-v1-6-fresh-stability-fixtures.ts";
const EXECUTION_PLAN =
  "docs/plans/2026-08-20-gi088-complete-response-first-v1-6-fresh-stability-replay.md";

const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  executionPlan: EXECUTION_PLAN,
  fixtures: FIXTURE_FILE,
  visibleCandidate:
    "evals/event-centered-generative/gi088-complete-response-first-v1-6-contrastive-coverage/candidate.ts",
  visibleRuntime: "src/features/interview/event-centered/complete-response-first-v1-6.ts",
  backgroundCandidate:
    "evals/event-centered-generative/gi088-complete-response-first-v1-6-background-facts/candidate.ts",
  backgroundContract:
    "src/features/interview/event-centered/complete-response-background-facts-v1.ts",
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  sourcePrivate:
    `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`,
  sourceReceipt: `${ROOT}/real-problem-regression-v1.2-receipt.json`,
  parentVisibleReceipt:
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_QUALITY_PATHS.publicReceipt,
  parentBackgroundReceipt:
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.publicReceipt,
  runner: RUNNER_FILE
} as const;

export type Gi088CompleteResponseFirstV16FreshStabilityCommand =
  | "prepare"
  | "execute"
  | "inspect";

type VisibleEntry = Parameters<typeof runGi088CompleteResponseFirstV16Case>[0]["entry"];
type BackgroundEntry = Parameters<
  typeof runGi088CompleteResponseFirstV16BackgroundFactsCase
>[0]["entry"];

export type Gi088CompleteResponseFirstV16FreshStabilityCaseResult = {
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  visible: Gi088CompleteResponseFirstV16QualityResult;
  background: Gi088CompleteResponseFirstV16BackgroundFactsQualityResult | null;
  backgroundNotRunReason: string | null;
};

type Reservation = {
  order: number;
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  stage: "visible" | "background";
  requestFingerprint: string;
  reservedAt: string;
  status: "started" | "completed";
};

export type Gi088CompleteResponseFirstV16FreshStabilityLedger = {
  schemaVersion: "1.0";
  identity: typeof GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_IDENTITY;
  planFingerprint: string;
  reservations: Reservation[];
  results: Gi088CompleteResponseFirstV16FreshStabilityCaseResult[];
  stopReason: string | null;
};

export type Gi088CompleteResponseFirstV16FreshStabilityPlan = Awaited<
  ReturnType<typeof createGi088CompleteResponseFirstV16FreshStabilityPlan>
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

export function gi088CompleteResponseFirstV16FreshStabilityReplaySha(value: unknown) {
  const source = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : JSON.stringify(canonicalize(value));
  return createHash("sha256").update(source).digest("hex");
}

function publicCode(value: string) {
  return /^[A-Z][A-Z0-9_.:-]{0,159}$/u.test(value)
    ? value
    : `PRIVATE_DETAIL_SHA256:${gi088CompleteResponseFirstV16FreshStabilityReplaySha(value)}`;
}

async function fileSha(cwd: string, relativePath: string) {
  return gi088CompleteResponseFirstV16FreshStabilityReplaySha(
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
  const file = path.join(
    cwd,
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.privateRunLock
  );
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(file), 0o700);
  const handle = await open(file, "wx", 0o600).catch((error: unknown) => {
    if (
      error && typeof error === "object" && "code" in error &&
      error.code === "EEXIST"
    ) throw new Error("GI088_V16_FRESH_STABILITY_RUN_LOCKED");
    throw error;
  });
  await handle.writeFile(`${JSON.stringify({
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_IDENTITY,
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

async function assertParentReceipts(cwd: string) {
  const [visible, background] = await Promise.all([
    readOptionalJson(path.join(cwd, FILES.parentVisibleReceipt)),
    readOptionalJson(path.join(cwd, FILES.parentBackgroundReceipt))
  ]);
  assert(visible && typeof visible === "object", "GI088_V16_FRESH_STABILITY_VISIBLE_PARENT_INVALID");
  assert(background && typeof background === "object", "GI088_V16_FRESH_STABILITY_BACKGROUND_PARENT_INVALID");
  const visibleReceipt = visible as Record<string, unknown>;
  const backgroundReceipt = background as Record<string, unknown>;
  for (const receipt of [visibleReceipt, backgroundReceipt]) {
    const budget = receipt.budget as Record<string, unknown> | undefined;
    assert(
      budget?.consumed === 8 && budget.completed === 8 && budget.notRun === 0,
      "GI088_V16_FRESH_STABILITY_PARENT_BUDGET_INVALID"
    );
    assert(
      Array.isArray(receipt.results) && receipt.results.length === 8 &&
        receipt.results.every((item) =>
          item && typeof item === "object" &&
          (item as Record<string, unknown>).status === "technical_valid"
        ),
      "GI088_V16_FRESH_STABILITY_PARENT_RESULTS_INVALID"
    );
  }
}

export async function createGi088CompleteResponseFirstV16FreshStabilityPlan(
  cwd = process.cwd()
) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(
    standardSha256 === GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  await assertParentReceipts(cwd);
  const dataset = await loadGi088CompleteResponseFirstV16FreshStabilityCases(cwd);
  const visibleIdentity = createGi088CompleteResponseFirstV16Identity();
  const backgroundIdentity = {
    candidate: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_IDENTITY,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME
  };
  const backgroundCandidateFingerprint =
    gi088CompleteResponseFirstV16BackgroundFactsQualitySha(backgroundIdentity);
  const inputHashes = Object.fromEntries(
    await Promise.all(Object.entries(FILES).map(async ([key, relativePath]) => [
      `${key}Sha256`,
      await fileSha(cwd, relativePath)
    ]))
  );
  const cases = dataset.cases.map((item, index) => {
    const frozen = asFrozenCase(item);
    const generationInput = createGi088CompleteResponseFirstV16Input(frozen);
    return {
      order: index + 1,
      caseId: item.caseId,
      hardGate: item.hardGate,
      sourceFingerprint: item.sourceFingerprint,
      visibleGenerationInputFingerprint:
        gi088CompleteResponseFirstV16QualitySha(generationInput),
      visibleRequestFingerprint: gi088CompleteResponseFirstV16QualitySha({
        candidateFingerprint: visibleIdentity.candidateFingerprint,
        caseId: item.caseId,
        generationInput
      }),
      backgroundAuthorizationFingerprint:
        gi088CompleteResponseFirstV16FreshStabilityReplaySha({
          caseId: item.caseId,
          sourceFingerprint: item.sourceFingerprint,
          backgroundCandidateFingerprint
        })
    };
  });
  const core = {
    schemaVersion: "1.0" as const,
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_IDENTITY,
    status: "ready" as const,
    standardSha256,
    dataset: {
      version: dataset.datasetVersion,
      fingerprint: dataset.datasetFingerprint,
      sourceVersion: dataset.sourceDatasetVersion,
      sourceFingerprint: dataset.sourceDatasetFingerprint,
      privacyLevel: "private_sensitive" as const,
      count: dataset.cases.length,
      candidateExposure: "fresh_to_v1_6_tuning" as const
    },
    candidates: {
      visible: visibleIdentity,
      background: { ...backgroundIdentity, candidateFingerprint: backgroundCandidateFingerprint }
    },
    cases,
    runtime: {
      visible: GI088_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME,
      background: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    budget: {
      authorized: 16,
      visible: 8,
      background: 8
    },
    stopRules: {
      ordinarySemanticIssueStopsBatch: false,
      singleSevereProgramGateStopsBatch: true,
      consecutiveTechnicalFailures: 2,
      unresolvedReservationRecovery: 0
    },
    productGate: {
      visibleFailMax: 0,
      visibleMinorMax: 1,
      controlCorrectionEventBoundaryAllPass: true,
      backgroundSourceFabricationMax: 0,
      productOwnerFinalAuthority: true
    },
    inputHashes,
    releaseBoundary: {
      preview: "not_run",
      production: "event_centered_plus_baseline_unchanged"
    }
  };
  return {
    ...core,
    planFingerprint: gi088CompleteResponseFirstV16FreshStabilityReplaySha(core)
  };
}

function emptyLedger(
  plan: Gi088CompleteResponseFirstV16FreshStabilityPlan
): Gi088CompleteResponseFirstV16FreshStabilityLedger {
  return {
    schemaVersion: "1.0",
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_IDENTITY,
    planFingerprint: plan.planFingerprint,
    reservations: [],
    results: [],
    stopReason: null
  };
}

function publicResult(item: Gi088CompleteResponseFirstV16FreshStabilityCaseResult) {
  const publicStage = (
    value: Gi088CompleteResponseFirstV16QualityResult |
      Gi088CompleteResponseFirstV16BackgroundFactsQualityResult
  ) => ({
    status: value.status,
    responseHash: value.responseHash,
    technicalGatePassed: value.technicalGatePassed,
    severeProgramGateFailed: value.severeProgramGateFailed,
    errorCode: value.errorCode ? publicCode(value.errorCode) : null,
    validationIssueCount: value.validationIssues.length,
    validationIssueHashes: value.validationIssues.map((issue) =>
      gi088CompleteResponseFirstV16FreshStabilityReplaySha(issue)
    ),
    totalLatencyMs: value.totalLatencyMs,
    finishReason: value.diagnostics?.finishReason ?? null,
    promptTokens: value.diagnostics?.tokenUsage?.promptTokens ?? null,
    completionTokens: value.diagnostics?.tokenUsage?.completionTokens ?? null,
    reasoningTokens: value.diagnostics?.reasoningTokens ?? null
  });
  return {
    caseId: item.caseId,
    visible: publicStage(item.visible),
    background: item.background ? publicStage(item.background) : null,
    backgroundNotRunReason: item.backgroundNotRunReason
      ? publicCode(item.backgroundNotRunReason)
      : null
  };
}

async function saveEvidence(
  cwd: string,
  plan: Gi088CompleteResponseFirstV16FreshStabilityPlan,
  ledger: Gi088CompleteResponseFirstV16FreshStabilityLedger
) {
  const latencies = ledger.results.flatMap((item) => [
    item.visible.totalLatencyMs,
    item.background?.totalLatencyMs ?? null
  ]).filter((value): value is number => typeof value === "number");
  const completed = ledger.reservations.filter((item) => item.status === "completed").length;
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
    casesCompleted: ledger.results.length,
    stopReason: ledger.stopReason ? publicCode(ledger.stopReason) : null,
    latency: {
      medianMs: median(latencies),
      maxMs: latencies.length > 0 ? Math.max(...latencies) : null
    },
    results: ledger.results.map(publicResult),
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
      "逐例阅读完整用户输入、实际可见回应和实际后台事实，再填写 Codex 初评与产品负责人裁决。",
    cases: ledger.results.map((item) => ({
      caseId: item.caseId,
      turnInput: item.visible.turnInput,
      actualVisibleOutput: item.visible.actualVisibleOutput,
      visibleResponseHash: item.visible.responseHash,
      visibleTechnicalStatus: item.visible.status,
      backgroundOutput: item.background?.parsedOutput ?? null,
      backgroundRawOutput: item.background?.rawProviderOutput ?? null,
      backgroundResponseHash: item.background?.responseHash ?? null,
      backgroundTechnicalStatus: item.background?.status ?? "not_run",
      codexReview: null,
      productOwnerReview: null
    }))
  };
  await Promise.all([
    writeJsonAtomic(
      path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.privateLedger),
      ledger,
      true
    ),
    writeJsonAtomic(
      path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.privateReview),
      review,
      true
    ),
    writeJsonAtomic(
      path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.publicReceipt),
      receipt
    )
  ]);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

async function readLedger(
  cwd: string,
  plan: Gi088CompleteResponseFirstV16FreshStabilityPlan
) {
  const raw = await readOptionalJson(path.join(
    cwd,
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.privateLedger
  ));
  assert(raw && typeof raw === "object", "GI088_V16_FRESH_STABILITY_LEDGER_MISSING");
  const ledger = raw as Gi088CompleteResponseFirstV16FreshStabilityLedger;
  assert(
    ledger.identity === plan.identity && ledger.planFingerprint === plan.planFingerprint,
    "GI088_V16_FRESH_STABILITY_LEDGER_IDENTITY_DRIFT"
  );
  return ledger;
}

export function assertGi088CompleteResponseFirstV16FreshStabilityFrozenPlan(input: {
  frozen: Gi088CompleteResponseFirstV16FreshStabilityPlan;
  current: Gi088CompleteResponseFirstV16FreshStabilityPlan;
}) {
  assert(
    gi088CompleteResponseFirstV16FreshStabilityReplaySha(input.frozen) ===
      gi088CompleteResponseFirstV16FreshStabilityReplaySha(input.current),
    "GI088_V16_FRESH_STABILITY_FROZEN_PLAN_DRIFT"
  );
}

export async function prepareGi088CompleteResponseFirstV16FreshStabilityReplay(
  cwd = process.cwd()
) {
  const startFile = path.join(
    cwd,
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.publicStartCard
  );
  if (await pathExists(startFile)) {
    const frozen = JSON.parse(await readFile(startFile, "utf8")) as
      Gi088CompleteResponseFirstV16FreshStabilityPlan;
    const current = await createGi088CompleteResponseFirstV16FreshStabilityPlan(cwd);
    assertGi088CompleteResponseFirstV16FreshStabilityFrozenPlan({ frozen, current });
    return frozen;
  }
  const plan = await createGi088CompleteResponseFirstV16FreshStabilityPlan(cwd);
  assert(
    !(await pathExists(path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.publicReceipt
    ))) &&
    !(await pathExists(path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.privateLedger
    ))),
    "GI088_V16_FRESH_STABILITY_EVIDENCE_EXISTS_WITHOUT_START_CARD"
  );
  await writeJsonAtomic(startFile, plan);
  await saveEvidence(cwd, plan, emptyLedger(plan));
  return plan;
}

function visibleEntry(
  plan: Gi088CompleteResponseFirstV16FreshStabilityPlan,
  item: Gi088CompleteResponseFirstV16FreshStabilityCase
) {
  const entry = plan.cases.find((candidate) => candidate.caseId === item.caseId);
  assert(entry, `GI088_V16_FRESH_STABILITY_PLAN_CASE_MISSING:${item.caseId}`);
  return {
    order: entry.order,
    caseId: item.caseId,
    split: "regression",
    hardGate: item.hardGate,
    sourceFingerprint: item.sourceFingerprint,
    generationInputFingerprint: entry.visibleGenerationInputFingerprint,
    requestFingerprint: entry.visibleRequestFingerprint
  } as unknown as VisibleEntry;
}

function backgroundEntry(input: {
  plan: Gi088CompleteResponseFirstV16FreshStabilityPlan;
  item: Gi088CompleteResponseFirstV16FreshStabilityCase;
  actualVisibleOutput: string;
}) {
  const entry = input.plan.cases.find((candidate) => candidate.caseId === input.item.caseId);
  assert(entry, `GI088_V16_FRESH_STABILITY_PLAN_CASE_MISSING:${input.item.caseId}`);
  const frozen = asFrozenCase(input.item);
  const generationInput = createGi088CompleteResponseFirstV16BackgroundFactsInput({
    item: frozen,
    actualVisibleOutput: input.actualVisibleOutput
  });
  const identity = createGi088CompleteResponseFirstV16BackgroundFactsIdentity({
    caseId: input.item.caseId,
    input: generationInput
  });
  const candidateFingerprint =
    gi088CompleteResponseFirstV16BackgroundFactsQualitySha({
      candidate: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_IDENTITY,
      runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME
    });
  const requestFingerprint =
    gi088CompleteResponseFirstV16BackgroundFactsQualitySha({
      candidateFingerprint,
      identity,
      messages: buildGi088CompleteResponseFirstV16BackgroundFactsMessages(generationInput)
    });
  return {
    entry: {
      order: entry.order,
      caseId: input.item.caseId,
      split: "regression",
      hardGate: input.item.hardGate,
      sourceFingerprint: input.item.sourceFingerprint,
      generationInputFingerprint:
        gi088CompleteResponseFirstV16BackgroundFactsQualitySha(generationInput),
      parentVisibleOutputHash:
        gi088CompleteResponseFirstV16BackgroundFactsQualitySha(input.actualVisibleOutput),
      requestFingerprint
    } as unknown as BackgroundEntry,
    requestFingerprint
  };
}

function unresolvedReservation(ledger: Gi088CompleteResponseFirstV16FreshStabilityLedger) {
  return ledger.reservations.find((reservation) =>
    reservation.status === "started"
  );
}

function reserve(input: {
  ledger: Gi088CompleteResponseFirstV16FreshStabilityLedger;
  order: number;
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId;
  stage: Reservation["stage"];
  requestFingerprint: string;
}) {
  assert(
    input.ledger.reservations.length < 16 &&
      !input.ledger.reservations.some((item) =>
        item.caseId === input.caseId && item.stage === input.stage
      ),
    `GI088_V16_FRESH_STABILITY_BUDGET_OR_DUPLICATE:${input.caseId}:${input.stage}`
  );
  input.ledger.reservations.push({
    order: input.order,
    caseId: input.caseId,
    stage: input.stage,
    requestFingerprint: input.requestFingerprint,
    reservedAt: new Date().toISOString(),
    status: "started"
  });
}

function completeReservation(
  ledger: Gi088CompleteResponseFirstV16FreshStabilityLedger,
  caseId: Gi088CompleteResponseFirstV16FreshStabilityCaseId,
  stage: Reservation["stage"]
) {
  const reservation = ledger.reservations.find((item) =>
    item.caseId === caseId && item.stage === stage
  );
  assert(reservation, `GI088_V16_FRESH_STABILITY_RESERVATION_MISSING:${caseId}:${stage}`);
  reservation.status = "completed";
}

export async function runGi088CompleteResponseFirstV16FreshStabilityReplay(input: {
  cwd?: string;
  plan: Gi088CompleteResponseFirstV16FreshStabilityPlan;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const release = await acquireRunLock(cwd);
  try {
    const currentPlan = await createGi088CompleteResponseFirstV16FreshStabilityPlan(cwd);
    assertGi088CompleteResponseFirstV16FreshStabilityFrozenPlan({
      frozen: input.plan,
      current: currentPlan
    });
    const dataset = await loadGi088CompleteResponseFirstV16FreshStabilityCases(cwd);
    const ledger = await readLedger(cwd, input.plan);
    assert(
      !unresolvedReservation(ledger),
      "GI088_V16_FRESH_STABILITY_UNRESOLVED_RESERVATION_NO_RECOVERY"
    );
    let consecutiveTechnicalFailures = 0;
    for (const caseId of GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_CASE_IDS) {
      if (ledger.stopReason) break;
      if (ledger.results.some((result) => result.caseId === caseId)) continue;
      const item = dataset.cases.find((candidate) => candidate.caseId === caseId);
      assert(item, `GI088_V16_FRESH_STABILITY_CASE_MISSING:${caseId}`);
      const entry = visibleEntry(input.plan, item);
      reserve({
        ledger,
        order: entry.order,
        caseId,
        stage: "visible",
        requestFingerprint: entry.requestFingerprint
      });
      await saveEvidence(cwd, input.plan, ledger);
      const visible = await runGi088CompleteResponseFirstV16Case({
        entry,
        item: asFrozenCase(item),
        provider: input.provider
      });
      completeReservation(ledger, caseId, "visible");
      consecutiveTechnicalFailures = visible.status === "technical_failure"
        ? consecutiveTechnicalFailures + 1
        : 0;
      const caseResult: Gi088CompleteResponseFirstV16FreshStabilityCaseResult = {
        caseId,
        visible,
        background: null,
        backgroundNotRunReason: null
      };
      ledger.results.push(caseResult);
      if (visible.severeProgramGateFailed) {
        ledger.stopReason = `SEVERE_VISIBLE_PROGRAM_GATE:${caseId}`;
      } else if (consecutiveTechnicalFailures >= 2) {
        ledger.stopReason = `TWO_CONSECUTIVE_TECHNICAL_FAILURES:${caseId}`;
      } else if (visible.status !== "technical_valid") {
        caseResult.backgroundNotRunReason = "VISIBLE_NOT_TECHNICAL_VALID";
      }
      await saveEvidence(cwd, input.plan, ledger);
      if (ledger.stopReason || caseResult.backgroundNotRunReason) continue;

      const background = backgroundEntry({
        plan: input.plan,
        item,
        actualVisibleOutput: visible.actualVisibleOutput
      });
      reserve({
        ledger,
        order: entry.order,
        caseId,
        stage: "background",
        requestFingerprint: background.requestFingerprint
      });
      await saveEvidence(cwd, input.plan, ledger);
      caseResult.background =
        await runGi088CompleteResponseFirstV16BackgroundFactsCase({
          entry: background.entry,
          item: asFrozenCase(item),
          parentVisibleOutput: visible.actualVisibleOutput,
          provider: input.provider
        });
      completeReservation(ledger, caseId, "background");
      consecutiveTechnicalFailures = caseResult.background.status === "technical_failure"
        ? consecutiveTechnicalFailures + 1
        : 0;
      if (caseResult.background.severeProgramGateFailed) {
        ledger.stopReason = `SEVERE_BACKGROUND_PROGRAM_GATE:${caseId}`;
      } else if (consecutiveTechnicalFailures >= 2) {
        ledger.stopReason = `TWO_CONSECUTIVE_TECHNICAL_FAILURES:${caseId}`;
      }
      await saveEvidence(cwd, input.plan, ledger);
    }
    return ledger;
  } finally {
    await release();
  }
}

export async function inspectGi088CompleteResponseFirstV16FreshStabilityReplay(
  cwd = process.cwd()
) {
  const plan = await prepareGi088CompleteResponseFirstV16FreshStabilityReplay(cwd);
  const ledger = await readLedger(cwd, plan);
  const completed = ledger.reservations.filter((item) => item.status === "completed").length;
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    casesCompleted: ledger.results.length,
    budget: {
      authorized: plan.budget.authorized,
      consumed: ledger.reservations.length,
      completed,
      notRun: plan.budget.authorized - ledger.reservations.length
    },
    statuses: {
      visibleTechnicalValid: ledger.results.filter((item) =>
        item.visible.status === "technical_valid"
      ).length,
      backgroundTechnicalValid: ledger.results.filter((item) =>
        item.background?.status === "technical_valid"
      ).length
    },
    stopReason: ledger.stopReason,
    publicReceipt:
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.publicReceipt,
    privateReview:
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_PATHS.privateReview
  };
}

async function providerForExecution(cwd: string) {
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_V16_FRESH_STABILITY_DEEPSEEK_API_KEY_MISSING");
  return new OpenAIProvider({
    apiKey,
    model: GI088_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_6_RUNTIME.timeoutMs
  });
}

async function main() {
  const cwd = process.cwd();
  const command = (
    process.env.GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_COMMAND ??
    process.argv[2] ??
    "prepare"
  ) as Gi088CompleteResponseFirstV16FreshStabilityCommand;
  assert(
    command === "prepare" || command === "execute" || command === "inspect",
    "GI088_V16_FRESH_STABILITY_UNKNOWN_COMMAND"
  );
  if (command === "prepare") {
    await prepareGi088CompleteResponseFirstV16FreshStabilityReplay(cwd);
  } else if (command === "execute") {
    const plan = await prepareGi088CompleteResponseFirstV16FreshStabilityReplay(cwd);
    const provider = await providerForExecution(cwd);
    await runGi088CompleteResponseFirstV16FreshStabilityReplay({
      cwd,
      plan,
      provider
    });
  }
  process.stdout.write(`${JSON.stringify(
    await inspectGi088CompleteResponseFirstV16FreshStabilityReplay(cwd),
    null,
    2
  )}\n`);
}

export function shouldRunGi088CompleteResponseFirstV16FreshStabilityCli(input: {
  argv?: string[];
  env?: Partial<NodeJS.ProcessEnv>;
} = {}) {
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;
  return env.VITEST !== "true" && Boolean(
    env.GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_COMMAND ||
      argv.some((item) => path.resolve(item) === path.resolve(RUNNER_FILE))
  );
}

if (shouldRunGi088CompleteResponseFirstV16FreshStabilityCli()) {
  void main().catch((error) => {
    process.stderr.write(`${
      error instanceof Error ? error.stack ?? error.message : String(error)
    }\n`);
    process.exitCode = 1;
  });
}
