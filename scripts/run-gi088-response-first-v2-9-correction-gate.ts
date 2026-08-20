import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import type {
  Board7bWorkingTaskV1SemanticState,
  Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V29_RUNTIME,
  createGi088ResponseFirstV29HighUserPrompt,
  createGi088ResponseFirstV29Identity,
  getGi088ResponseFirstV29HighSystemPrompt,
  observeGi088ResponseFirstV29HighOutput,
  parseGi088ResponseFirstV29HighOutput,
  projectGi088ResponseFirstV29CompatibilityHigh,
  projectGi088ResponseFirstV29VisibleAppend,
  validateGi088ResponseFirstV29HighOutput,
  type Gi088ResponseFirstV29ProjectedHighOutput,
  type Gi088ResponseFirstV29RawHighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2-9-separated-open-gap-high/candidate";
import {
  projectGi088ResponseFirstV2HighOutput,
  type Gi088ResponseFirstV2HighOutput
} from "../evals/event-centered-generative/gi088-response-first-v2/candidate";
import { createGi088ResponseFirstV22Identity } from "../evals/event-centered-generative/gi088-response-first-v2-2/candidate";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AICompletionParams,
  type AIProvider
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  applyGi088SemanticDeltaValidatedResult,
  type Gi088SemanticDeltaOutput
} from "../src/server/services/evaluation/gi088/semantic-delta";
import {
  GI088_RESPONSE_FIRST_V22_RUBRIC_V13_DATASET_VERSION,
  GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT,
  loadGi088ResponseFirstV22RubricV13Cases
} from "./gi088-response-first-v2-2-rubric-v1-3-fixtures";

export const GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY =
  "2026-08-19.gi088-response-first-v2-9-correction-gate-v1" as const;
export const GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID =
  "RPR-REAL-19-CORRECTION" as const;
export const GI088_RESPONSE_FIRST_V29_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;

const PRIVATE_ROOT =
  `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-9/correction-gate-v1`;

export const GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS = {
  publicStartCard:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-9-correction-gate-v1-start-card.json`,
  publicReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-9-correction-gate-v1-receipt.json`,
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateReviewHtml: `${PRIVATE_ROOT}/review.html`,
  privateProductReviewTemplate: `${PRIVATE_ROOT}/product-owner-review.template.json`,
  privateProductReview: `${PRIVATE_ROOT}/product-owner-review.json`,
  frozenLowReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-2-low-full-quality-v2-receipt.json`,
  frozenLowLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-2/low-full-quality-v2/ledger.json`,
  parentReceipt:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-8-1-causal-continuation-probe-v1-receipt.json`,
  parentStageLedger:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/response-first-v2-8-1-stage-ledger-v1.json`,
  parentProductReview:
    `${GI088_RESPONSE_FIRST_V22_RUBRIC_V13_ROOT}/.private/response-first-v2-8-1/causal-continuation-probe-v1/product-owner-semantic-review.json`
} as const;

const RUNNER_FILE = "scripts/run-gi088-response-first-v2-9-correction-gate.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  plan: "docs/plans/2026-08-19-gi088-response-first-v2-9-separated-open-gap-high.md",
  candidate:
    "evals/event-centered-generative/gi088-response-first-v2-9-separated-open-gap-high/candidate.ts",
  baseProjection:
    "evals/event-centered-generative/gi088-response-first-v2/candidate.ts",
  semanticStateMerge: "src/server/services/evaluation/gi088/semantic-delta.ts",
  fixtures: "scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures.ts",
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  runner: RUNNER_FILE
} as const;

type Verdict = "pass" | "minor" | "fail";
type SafeDiagnostics = ReturnType<typeof sanitizeAIProviderDiagnostics>;

export type Gi088ResponseFirstV29CorrectionGateResult = {
  caseId: typeof GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID;
  status: "valid" | "contract_failure" | "technical_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  frozenLowHash: string;
  frozenLowLatencyMs: number;
  responseHash: string | null;
  responseLength: number;
  rawOutput: string | null;
  parsedRaw: Gi088ResponseFirstV29RawHighOutput | null;
  projectedHigh: Gi088ResponseFirstV29ProjectedHighOutput | null;
  postState: Board7bWorkingTaskV1SemanticState | null;
  visibleDelivery: ReturnType<typeof projectGi088ResponseFirstV29VisibleAppend> | null;
  observation: ReturnType<typeof observeGi088ResponseFirstV29HighOutput> | null;
  validationIssues: string[];
  errorCode: string | null;
  highLatencyMs: number;
  observedFullRoundLatencyMs: number;
  observed45sTargetPassed: boolean;
  observed60sHardPassed: boolean;
  diagnostics: SafeDiagnostics;
};

type FrozenLow = {
  rawOutput: string;
  responseHash: string;
  totalLatencyMs: number;
  planFingerprint: string;
  candidateFingerprint: string;
  receiptSha256: string;
  ledgerSha256: string;
};

type GatePlan = Awaited<ReturnType<typeof createGi088ResponseFirstV29CorrectionGatePlan>>;

type PrivateLedger = {
  identity: typeof GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY;
  planFingerprint: string;
  callStarted: boolean;
  turnInput: Board7bWorkingTaskV1TurnInput | null;
  frozenLow: FrozenLow | null;
  result: Gi088ResponseFirstV29CorrectionGateResult | null;
  productDecision: {
    verdict: Verdict;
    noteHash: string;
    reviewHash: string;
  } | null;
};

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

export function gi088ResponseFirstV29CorrectionGateSha(value: unknown) {
  return createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(canonicalize(value))
    )
    .digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return gi088ResponseFirstV29CorrectionGateSha(
    await readFile(path.join(cwd, relativePath))
  );
}

async function pathExists(file: string) {
  return stat(file).then(() => true).catch(() => false);
}

async function writeAtomic(
  file: string,
  content: string,
  privateFile = false
) {
  await mkdir(path.dirname(file), {
    recursive: true,
    mode: privateFile ? 0o700 : 0o755
  });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, content, { mode: privateFile ? 0o600 : 0o644 });
  await rename(temporary, file);
  if (privateFile) await chmod(file, 0o600);
}

async function writeJsonAtomic(
  file: string,
  value: unknown,
  privateFile = false
) {
  await writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`, privateFile);
}

async function loadFrozenLow(cwd: string): Promise<FrozenLow> {
  const [receiptSource, ledgerSource] = await Promise.all([
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.frozenLowReceipt), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.frozenLowLedger), "utf8")
  ]);
  const receipt = JSON.parse(receiptSource) as {
    identity: string;
    planFingerprint: string;
    candidateFingerprint: string;
    status: string;
    productDecision: { gatePassed?: boolean } | null;
    results: Array<{
      caseId: string;
      status: string;
      responseHash: string | null;
      totalLatencyMs: number;
    }>;
  };
  const ledger = JSON.parse(ledgerSource) as {
    identity: string;
    planFingerprint: string;
    productDecision: { gatePassed?: boolean } | null;
    results: Array<{
      caseId: string;
      status: string;
      rawOutput: string | null;
      responseHash: string | null;
      totalLatencyMs: number;
    }>;
  };
  const result = ledger.results.find(
    (item) => item.caseId === GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID
  );
  const publicResult = receipt.results.find(
    (item) => item.caseId === GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID
  );
  assert(
    receipt.identity === "2026-08-17.gi088-response-first-v2-2-low-full-quality-v2" &&
      ledger.identity === receipt.identity &&
      receipt.planFingerprint === ledger.planFingerprint &&
      receipt.candidateFingerprint ===
        createGi088ResponseFirstV22Identity().candidateFingerprint &&
      receipt.status === "low_quality_gate_passed_by_product_owner" &&
      receipt.productDecision?.gatePassed === true &&
      ledger.productDecision?.gatePassed === true &&
      result?.status === "valid" &&
      publicResult?.status === result.status &&
      typeof result.rawOutput === "string" &&
      typeof result.responseHash === "string" &&
      publicResult?.responseHash === result.responseHash &&
      publicResult.totalLatencyMs === result.totalLatencyMs &&
      gi088ResponseFirstV29CorrectionGateSha(result.rawOutput) === result.responseHash &&
      Number.isFinite(result.totalLatencyMs),
    "GI088_RESPONSE_FIRST_V29_FROZEN_LOW_INVALID"
  );
  return {
    rawOutput: result.rawOutput,
    responseHash: result.responseHash,
    totalLatencyMs: result.totalLatencyMs,
    planFingerprint: receipt.planFingerprint,
    candidateFingerprint: receipt.candidateFingerprint,
    receiptSha256: gi088ResponseFirstV29CorrectionGateSha(receiptSource),
    ledgerSha256: gi088ResponseFirstV29CorrectionGateSha(ledgerSource)
  };
}

async function loadParentFailEvidence(cwd: string) {
  const [receiptSource, stageSource, reviewSource] = await Promise.all([
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.parentReceipt), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.parentStageLedger), "utf8"),
    readFile(path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.parentProductReview), "utf8")
  ]);
  const receipt = JSON.parse(receiptSource) as {
    identity: string;
    planFingerprint: string;
    budget: { consumed: number };
    high: { responseHash: string | null; status: string } | null;
  };
  const stage = JSON.parse(stageSource) as {
    identity: string;
    planFingerprint: string;
    parentGate: { responseHash: string; postStateHash: string };
    causalInput: { effectiveTurnInputHash: string };
    low: { responseHash: string };
    high: { responseHash: string; continuationPostStatePresent: boolean };
    result: { productOwnerVerdict: string; gate: string };
  };
  const review = JSON.parse(reviewSource) as {
    identity: string;
    planFingerprint: string;
    phase: string;
    reviewerRole: string;
    evidenceBinding: { highResponseHash: string };
    decision: { verdict: string };
  };
  const binding = review.evidenceBinding as {
    parentResponseHash: string;
    parentPostStateHash: string;
    effectiveTurnInputHash: string;
    lowResponseHash: string;
    highResponseHash: string;
    continuationPostStateHash: string | null;
  };
  assert(
    receipt.identity === "2026-08-19.gi088-response-first-v2-8-1-causal-continuation-probe-v1" &&
      stage.identity === receipt.identity &&
      review.identity === receipt.identity &&
      receipt.planFingerprint === stage.planFingerprint &&
      review.planFingerprint === receipt.planFingerprint &&
      receipt.budget.consumed === 2 &&
      receipt.high?.status === "contract_failure" &&
      typeof receipt.high.responseHash === "string" &&
      stage.high.responseHash === receipt.high.responseHash &&
      stage.high.continuationPostStatePresent === false &&
      stage.result.productOwnerVerdict === "fail" &&
      stage.result.gate === "no_go_stop" &&
      review.phase === "causal_continuation_gate" &&
      review.reviewerRole === "product_owner" &&
      review.decision.verdict === "fail" &&
      binding.parentResponseHash === stage.parentGate.responseHash &&
      binding.parentPostStateHash === stage.parentGate.postStateHash &&
      binding.effectiveTurnInputHash === stage.causalInput.effectiveTurnInputHash &&
      binding.lowResponseHash === stage.low.responseHash &&
      binding.highResponseHash === receipt.high.responseHash &&
      binding.continuationPostStateHash === null,
    "GI088_RESPONSE_FIRST_V29_PARENT_FAIL_EVIDENCE_INVALID"
  );
  return {
    identity: receipt.identity,
    planFingerprint: receipt.planFingerprint,
    highResponseHash: receipt.high.responseHash,
    receiptSha256: gi088ResponseFirstV29CorrectionGateSha(receiptSource),
    stageLedgerSha256: gi088ResponseFirstV29CorrectionGateSha(stageSource),
    productReviewSha256: gi088ResponseFirstV29CorrectionGateSha(reviewSource),
    productVerdict: "fail" as const
  };
}

export async function createGi088ResponseFirstV29CorrectionGatePlan(
  cwd = process.cwd()
) {
  assert(
    await fileSha(cwd, FILES.standard) === GI088_RESPONSE_FIRST_V29_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const [dataset, frozenLow, parent, inputHashes] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd),
    loadParentFailEvidence(cwd),
    Object.fromEntries(
      await Promise.all(
        Object.entries(FILES).map(async ([key, relativePath]) => [
          `${key}Sha256`,
          await fileSha(cwd, relativePath)
        ])
      )
    ) as Promise<Record<string, string>>
  ]);
  const item = dataset.cases.find(
    (candidate) => candidate.caseId === GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID
  );
  assert(item, "GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_MISSING");
  const candidate = createGi088ResponseFirstV29Identity();
  const core = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY,
    status: "ready_to_run_one_high_then_wait_product_review",
    productDecision:
      "whether_a_correction_can_persist_as_known_understanding_without_creating_a_false_open_task",
    candidateIdentity: candidate,
    dataset: {
      version: dataset.datasetVersion,
      expectedVersion: GI088_RESPONSE_FIRST_V22_RUBRIC_V13_DATASET_VERSION,
      fingerprint: dataset.datasetFingerprint,
      caseId: item.caseId,
      sourceFingerprint: item.sourceFingerprint,
      turnInputHash: gi088ResponseFirstV29CorrectionGateSha(item.turnInput)
    },
    frozenLow: {
      identity: "2026-08-17.gi088-response-first-v2-2-low-full-quality-v2",
      responseHash: frozenLow.responseHash,
      observedLatencyMs: frozenLow.totalLatencyMs,
      planFingerprint: frozenLow.planFingerprint,
      candidateFingerprint: frozenLow.candidateFingerprint,
      receiptSha256: frozenLow.receiptSha256,
      ledgerSha256: frozenLow.ledgerSha256,
      productGatePassed: true
    },
    parentV281: parent,
    runtime: {
      provider: GI088_RESPONSE_FIRST_V29_RUNTIME.provider,
      model: GI088_RESPONSE_FIRST_V29_RUNTIME.model,
      high: GI088_RESPONSE_FIRST_V29_RUNTIME.high,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    budget: {
      currentIdentityAuthorized: 1,
      remainingFamilyBudgetNotRun: 6,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    gate: {
      providerHttp200: true,
      finishReasonStop: true,
      highHardMs: 60_000,
      observedFullRoundTargetMs: 45_000,
      observedFullRoundHardMs: 60_000,
      workingTaskAfterTurn: null,
      correctionUnderstandingPersisted: true,
      visibleQuestions: 0,
      correctableUnderstanding: null,
      productReviewRequiredAfterRun: true
    },
    privacy: {
      level: "private_sensitive",
      publicBodies: false,
      privateMode: "0600"
    },
    releaseBoundary: {
      pageIntegration: "not_run",
      preview: "not_run",
      commit: "not_run",
      push: "not_run",
      deployment: "not_run",
      production: "event_centered_baseline"
    },
    inputHashes,
    stopPoint: "after_one_high_wait_hash_bound_product_review"
  } as const;
  assert(
    core.dataset.version === core.dataset.expectedVersion,
    "GI088_RESPONSE_FIRST_V29_DATASET_VERSION_MISMATCH"
  );
  return {
    ...core,
    planFingerprint: gi088ResponseFirstV29CorrectionGateSha(core)
  };
}

function emptyLedger(plan: GatePlan): PrivateLedger {
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    callStarted: false,
    turnInput: null,
    frozenLow: null,
    result: null,
    productDecision: null
  };
}

async function readFrozenPlan(cwd: string): Promise<GatePlan> {
  const source = await readFile(
    path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.publicStartCard),
    "utf8"
  );
  const plan = JSON.parse(source) as GatePlan;
  const { planFingerprint, ...core } = plan;
  assert(
    plan.identity === GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_IDENTITY &&
      gi088ResponseFirstV29CorrectionGateSha(core) === planFingerprint &&
      plan.candidateIdentity.candidateFingerprint ===
        createGi088ResponseFirstV29Identity().candidateFingerprint,
    "GI088_RESPONSE_FIRST_V29_START_CARD_INVALID"
  );
  return plan;
}

async function verifyGi088ResponseFirstV29FrozenInputs(input: {
  cwd: string;
  plan: GatePlan;
  dataset: Awaited<ReturnType<typeof loadGi088ResponseFirstV22RubricV13Cases>>;
  frozenLow: FrozenLow;
  parent: Awaited<ReturnType<typeof loadParentFailEvidence>>;
}) {
  assert(
    await fileSha(input.cwd, FILES.standard) ===
      GI088_RESPONSE_FIRST_V29_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  for (const [key, relativePath] of Object.entries(FILES)) {
    const expected = input.plan.inputHashes[`${key}Sha256`];
    assert(
      typeof expected === "string" &&
        await fileSha(input.cwd, relativePath) === expected,
      `GI088_RESPONSE_FIRST_V29_FROZEN_INPUT_SHA_MISMATCH:${key}`
    );
  }
  const item = input.dataset.cases.find(
    (candidate) => candidate.caseId === GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID
  );
  assert(
    item &&
      input.dataset.datasetVersion === input.plan.dataset.version &&
      input.dataset.datasetFingerprint === input.plan.dataset.fingerprint &&
      item.sourceFingerprint === input.plan.dataset.sourceFingerprint &&
      gi088ResponseFirstV29CorrectionGateSha(item.turnInput) ===
        input.plan.dataset.turnInputHash,
    "GI088_RESPONSE_FIRST_V29_FROZEN_DATASET_MISMATCH"
  );
  assert(
    input.frozenLow.responseHash === input.plan.frozenLow.responseHash &&
      input.frozenLow.totalLatencyMs === input.plan.frozenLow.observedLatencyMs &&
      input.frozenLow.planFingerprint === input.plan.frozenLow.planFingerprint &&
      input.frozenLow.candidateFingerprint ===
        input.plan.frozenLow.candidateFingerprint &&
      input.frozenLow.receiptSha256 === input.plan.frozenLow.receiptSha256 &&
      input.frozenLow.ledgerSha256 === input.plan.frozenLow.ledgerSha256,
    "GI088_RESPONSE_FIRST_V29_FROZEN_LOW_BINDING_MISMATCH"
  );
  assert(
    input.parent.identity === input.plan.parentV281.identity &&
      input.parent.planFingerprint === input.plan.parentV281.planFingerprint &&
      input.parent.highResponseHash === input.plan.parentV281.highResponseHash &&
      input.parent.receiptSha256 === input.plan.parentV281.receiptSha256 &&
      input.parent.stageLedgerSha256 ===
        input.plan.parentV281.stageLedgerSha256 &&
      input.parent.productReviewSha256 ===
        input.plan.parentV281.productReviewSha256 &&
      input.parent.productVerdict === "fail",
    "GI088_RESPONSE_FIRST_V29_PARENT_FAIL_BINDING_MISMATCH"
  );
  return item;
}

async function readLedger(cwd: string, plan: GatePlan) {
  const file = path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateLedger);
  if (!(await pathExists(file))) return emptyLedger(plan);
  const ledger = JSON.parse(await readFile(file, "utf8")) as PrivateLedger;
  assert(
    ledger.identity === plan.identity &&
      ledger.planFingerprint === plan.planFingerprint,
    "GI088_RESPONSE_FIRST_V29_LEDGER_IDENTITY_MISMATCH"
  );
  return ledger;
}

function receiptStatus(ledger: PrivateLedger) {
  if (ledger.productDecision) {
    return ledger.productDecision.verdict === "fail"
      ? "v29_correction_gate_product_fail"
      : "v29_correction_gate_product_pass_or_minor";
  }
  if (ledger.result) {
    return ledger.result.status === "valid"
      ? "v29_correction_gate_complete_waiting_product_review"
      : "v29_correction_gate_no_go";
  }
  return ledger.callStarted
    ? "v29_correction_gate_started_requires_audit"
    : "v29_correction_gate_ready";
}

function publicResult(result: Gi088ResponseFirstV29CorrectionGateResult | null) {
  if (!result) return null;
  const validationIssueCodes = [...new Set(result.validationIssues.map((issue) =>
    issue.match(/^[A-Z0-9_]+/u)?.[0] ?? "HIGH_OUTPUT_CONTRACT_INVALID"
  ))];
  return {
    caseId: result.caseId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    requestFingerprint: result.requestFingerprint,
    frozenLowHash: result.frozenLowHash,
    frozenLowLatencyMs: result.frozenLowLatencyMs,
    responseHash: result.responseHash,
    responseLength: result.responseLength,
    postStateHash: result.postState
      ? gi088ResponseFirstV29CorrectionGateSha(result.postState)
      : null,
    validationIssueCount: result.validationIssues.length,
    validationIssueCodes,
    validationIssuesHash: gi088ResponseFirstV29CorrectionGateSha(
      result.validationIssues
    ),
    errorCode: result.errorCode,
    highLatencyMs: result.highLatencyMs,
    observedFullRoundLatencyMs: result.observedFullRoundLatencyMs,
    observed45sTargetPassed: result.observed45sTargetPassed,
    observed60sHardPassed: result.observed60sHardPassed,
    observation: result.observation,
    httpStatus: result.diagnostics?.httpStatus ?? null,
    finishReason: result.diagnostics?.finishReason ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    reasoningPresent: result.diagnostics?.reasoningPresent ?? null,
    reasoningTokens: result.diagnostics?.reasoningTokens ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null
  };
}

async function saveLedger(cwd: string, plan: GatePlan, ledger: PrivateLedger) {
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateLedger),
    ledger,
    true
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.publicReceipt),
    {
      schemaVersion: "1.0",
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      candidateVersion: plan.candidateIdentity.version,
      candidateFingerprint: plan.candidateIdentity.candidateFingerprint,
      status: receiptStatus(ledger),
      budget: {
        authorized: 1,
        consumed: ledger.callStarted ? 1 : 0,
        completed: ledger.result ? 1 : 0,
        notRun: ledger.callStarted ? 0 : 1,
        remainingFamilyNotRun: 6,
        retries: 0,
        recovery: 0,
        fallback: 0
      },
      parentV281: plan.parentV281,
      result: publicResult(ledger.result),
      productDecision: ledger.productDecision,
      releaseBoundary: plan.releaseBoundary,
      privacy: {
        publicReceiptContainsBodies: false,
        privateLedgerAndReview: "git_ignored_mode_0600"
      }
    }
  );
  return ledger;
}

function parentHigh(
  high: Gi088ResponseFirstV29ProjectedHighOutput
): Gi088ResponseFirstV2HighOutput {
  return { semantic: high.semantic };
}

export function projectGi088ResponseFirstV29CorrectionPostState(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  projectedHigh: Gi088ResponseFirstV29ProjectedHighOutput;
}) {
  const projected = projectGi088ResponseFirstV2HighOutput({
    turnInput: input.turnInput,
    frozenLow: input.frozenLow,
    high: parentHigh(input.projectedHigh)
  });
  const semantic = { ...projected.semantic };
  delete (semantic as Record<string, unknown>).relationshipClaims;
  delete (semantic as Record<string, unknown>).relationshipClaimUsage;
  return applyGi088SemanticDeltaValidatedResult({
    input: input.turnInput,
    output: {
      semantic,
      visible: projected.visible
    } satisfies Gi088SemanticDeltaOutput
  });
}

function requestFor(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}): AICompletionParams {
  const runtime = GI088_RESPONSE_FIRST_V29_RUNTIME.high;
  return {
    messages: [
      { role: "system", content: getGi088ResponseFirstV29HighSystemPrompt() },
      {
        role: "user",
        content: createGi088ResponseFirstV29HighUserPrompt(input)
      }
    ],
    maxTokens: runtime.maxTokens,
    headersTimeoutMs: runtime.headersTimeoutMs,
    bodyIdleTimeoutMs: runtime.bodyIdleTimeoutMs,
    hardTimeoutMs: runtime.hardTimeoutMs,
    timeoutMs: runtime.hardTimeoutMs,
    responseFormat: runtime.responseFormat,
    thinking: runtime.thinking
  };
}

export async function runGi088ResponseFirstV29CorrectionCall(input: {
  provider: AIProvider;
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: FrozenLow;
}): Promise<Gi088ResponseFirstV29CorrectionGateResult> {
  const request = requestFor({
    turnInput: input.turnInput,
    frozenLow: input.frozenLow.rawOutput
  });
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const requestFingerprint = gi088ResponseFirstV29CorrectionGateSha(request);
  try {
    const completion = await input.provider.complete(request);
    const diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
    const highLatencyMs = diagnostics?.totalLatencyMs ?? completion.latencyMs ??
      Math.max(0, Date.now() - startedMs);
    const observedFullRoundLatencyMs = input.frozenLow.totalLatencyMs + highLatencyMs;
    try {
      const parsedRaw = parseGi088ResponseFirstV29HighOutput(completion.content);
      const projectedHigh = projectGi088ResponseFirstV29CompatibilityHigh({
        turnInput: input.turnInput,
        raw: parsedRaw
      });
      const validationIssues = validateGi088ResponseFirstV29HighOutput({
        turnInput: input.turnInput,
        frozenLow: input.frozenLow.rawOutput,
        raw: parsedRaw,
        projected: projectedHigh
      });
      let postState: Board7bWorkingTaskV1SemanticState | null = null;
      try {
        postState = projectGi088ResponseFirstV29CorrectionPostState({
          turnInput: input.turnInput,
          frozenLow: input.frozenLow.rawOutput,
          projectedHigh
        });
      } catch (error) {
        validationIssues.push(
          `POST_STATE_PROJECTION_FAILED:${error instanceof Error ? error.message : "unknown"}`
        );
      }
      const visibleDelivery = projectGi088ResponseFirstV29VisibleAppend({
        frozenLow: input.frozenLow.rawOutput,
        high: projectedHigh
      });
      if (diagnostics?.httpStatus !== 200) {
        validationIssues.push(`HIGH_HTTP_STATUS_INVALID:${diagnostics?.httpStatus ?? "missing"}`);
      }
      if (diagnostics?.finishReason !== "stop") {
        validationIssues.push(`HIGH_FINISH_REASON_INVALID:${diagnostics?.finishReason ?? "missing"}`);
      }
      if (diagnostics?.responseModel !== GI088_RESPONSE_FIRST_V29_RUNTIME.model) {
        validationIssues.push(`HIGH_RESPONSE_MODEL_INVALID:${diagnostics?.responseModel ?? "missing"}`);
      }
      if (diagnostics?.reasoningPresent !== false) {
        validationIssues.push(`HIGH_REASONING_PRESENT_INVALID:${diagnostics?.reasoningPresent ?? "missing"}`);
      }
      if (diagnostics?.reasoningTokens !== null && diagnostics?.reasoningTokens !== 0) {
        validationIssues.push(`HIGH_REASONING_TOKENS_INVALID:${diagnostics?.reasoningTokens ?? "missing"}`);
      }
      if (!postState || postState.workingTask !== null) {
        validationIssues.push("CORRECTION_GATE_OPEN_TASK_MUST_REMAIN_NULL");
      }
      if (!postState || postState.understandings.length <=
        input.turnInput.semanticState.understandings.length) {
        validationIssues.push("CORRECTION_GATE_UNDERSTANDING_MUST_PERSIST");
      }
      if (visibleDelivery.questions.length !== 0) {
        validationIssues.push("CORRECTION_GATE_QUESTIONS_MUST_BE_EMPTY");
      }
      if (visibleDelivery.highUnderstanding !== null) {
        validationIssues.push("CORRECTION_GATE_HIGH_UNDERSTANDING_MUST_BE_NULL");
      }
      if (highLatencyMs > 60_000) {
        validationIssues.push(`HIGH_HARD_TIMEOUT_EXCEEDED:${highLatencyMs}`);
      }
      const uniqueIssues = [...new Set(validationIssues)];
      const status = uniqueIssues.length === 0
        ? "valid" as const
        : "contract_failure" as const;
      return {
        caseId: GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID,
        status,
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint,
        frozenLowHash: input.frozenLow.responseHash,
        frozenLowLatencyMs: input.frozenLow.totalLatencyMs,
        responseHash: gi088ResponseFirstV29CorrectionGateSha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedRaw,
        projectedHigh,
        postState,
        visibleDelivery,
        observation: observeGi088ResponseFirstV29HighOutput(parsedRaw),
        validationIssues: uniqueIssues,
        errorCode: status === "valid"
          ? null
          : diagnostics?.finishReason === "length"
            ? "GI088_RESPONSE_FIRST_V29_TOKEN_CEILING_INCONCLUSIVE"
            : "GI088_RESPONSE_FIRST_V29_CONTRACT_INVALID",
        highLatencyMs,
        observedFullRoundLatencyMs,
        observed45sTargetPassed: observedFullRoundLatencyMs <= 45_000,
        observed60sHardPassed: observedFullRoundLatencyMs <= 60_000,
        diagnostics
      };
    } catch (error) {
      return {
        caseId: GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID,
        status: "contract_failure",
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint,
        frozenLowHash: input.frozenLow.responseHash,
        frozenLowLatencyMs: input.frozenLow.totalLatencyMs,
        responseHash: gi088ResponseFirstV29CorrectionGateSha(completion.content),
        responseLength: completion.content.length,
        rawOutput: completion.content,
        parsedRaw: null,
        projectedHigh: null,
        postState: null,
        visibleDelivery: null,
        observation: null,
        validationIssues: [error instanceof Error ? error.message : "HIGH_PARSE_FAILED"],
        errorCode: diagnostics?.finishReason === "length"
          ? "GI088_RESPONSE_FIRST_V29_TOKEN_CEILING_INCONCLUSIVE"
          : "GI088_RESPONSE_FIRST_V29_PARSE_FAILED",
        highLatencyMs,
        observedFullRoundLatencyMs,
        observed45sTargetPassed: observedFullRoundLatencyMs <= 45_000,
        observed60sHardPassed: observedFullRoundLatencyMs <= 60_000,
        diagnostics
      };
    }
  } catch (error) {
    const diagnostics = sanitizeAIProviderDiagnostics(getAIProviderDiagnostics(error));
    const highLatencyMs = diagnostics?.totalLatencyMs ??
      Math.max(0, Date.now() - startedMs);
    const observedFullRoundLatencyMs = input.frozenLow.totalLatencyMs + highLatencyMs;
    return {
      caseId: GI088_RESPONSE_FIRST_V29_CORRECTION_CASE_ID,
      status: "technical_failure",
      startedAt,
      completedAt: new Date().toISOString(),
      requestFingerprint,
      frozenLowHash: input.frozenLow.responseHash,
      frozenLowLatencyMs: input.frozenLow.totalLatencyMs,
      responseHash: null,
      responseLength: 0,
      rawOutput: null,
      parsedRaw: null,
      projectedHigh: null,
      postState: null,
      visibleDelivery: null,
      observation: null,
      validationIssues: [],
      errorCode: getAIProviderFailureCode(error),
      highLatencyMs,
      observedFullRoundLatencyMs,
      observed45sTargetPassed: observedFullRoundLatencyMs <= 45_000,
      observed60sHardPassed: observedFullRoundLatencyMs <= 60_000,
      diagnostics
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function writeReviewFiles(
  cwd: string,
  plan: GatePlan,
  ledger: PrivateLedger
) {
  const result = ledger.result;
  assert(result, "GI088_RESPONSE_FIRST_V29_REVIEW_RESULT_MISSING");
  const conversation = ledger.turnInput?.conversation ?? [];
  const html = `<!doctype html><meta charset="utf-8"><title>GI-088 v2.9 correction gate</title><style>body{font:16px/1.6 system-ui;max-width:980px;margin:32px auto;padding:0 20px}pre{white-space:pre-wrap;background:#f5f5f5;padding:16px;border-radius:8px}</style><h1>GI-088 v2.9 correction gate</h1><h2>完整上下文</h2>${conversation.map((message) => `<h3>${escapeHtml(message.id)} · ${escapeHtml(message.role)}</h3><pre>${escapeHtml(message.content)}</pre>`).join("")}<h2>冻结 Low</h2><pre>${escapeHtml(ledger.frozenLow?.rawOutput ?? "")}</pre><h2>High 原始输出</h2><pre>${escapeHtml(result.rawOutput ?? "")}</pre><h2>兼容投影</h2><pre>${escapeHtml(JSON.stringify(result.projectedHigh, null, 2))}</pre><h2>post-state</h2><pre>${escapeHtml(JSON.stringify(result.postState, null, 2))}</pre><h2>技术指标</h2><pre>${escapeHtml(JSON.stringify(publicResult(result), null, 2))}</pre>`;
  await writeAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateReviewHtml),
    html,
    true
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateProductReviewTemplate),
    {
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      reviewerRole: "product_owner",
      evidenceBinding: {
        caseId: result.caseId,
        turnInputHash: ledger.turnInput
          ? gi088ResponseFirstV29CorrectionGateSha(ledger.turnInput)
          : null,
        frozenLowHash: result.frozenLowHash,
        responseHash: result.responseHash,
        projectedHighHash: result.projectedHigh
          ? gi088ResponseFirstV29CorrectionGateSha(result.projectedHigh)
          : null,
        visibleDeliveryHash: result.visibleDelivery
          ? gi088ResponseFirstV29CorrectionGateSha(result.visibleDelivery)
          : null,
        postStateHash: result.postState
          ? gi088ResponseFirstV29CorrectionGateSha(result.postState)
          : null
      },
      verdict: "fail",
      note: "复制为 product-owner-review.json，并基于完整原文填写 pass、minor 或 fail。"
    },
    true
  );
}

export async function prepareGi088ResponseFirstV29CorrectionGate(
  cwd = process.cwd()
) {
  const startFile = path.join(
    cwd,
    GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.publicStartCard
  );
  if (await pathExists(startFile)) return readFrozenPlan(cwd);
  const plan = await createGi088ResponseFirstV29CorrectionGatePlan(cwd);
  await writeJsonAtomic(startFile, plan);
  await saveLedger(cwd, plan, emptyLedger(plan));
  return plan;
}

export async function executeGi088ResponseFirstV29CorrectionGate(input: {
  cwd?: string;
  provider?: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const plan = await prepareGi088ResponseFirstV29CorrectionGate(cwd);
  const ledger = await readLedger(cwd, plan);
  if (ledger.result) return ledger;
  assert(!ledger.callStarted, "GI088_RESPONSE_FIRST_V29_STARTED_CALL_REQUIRES_AUDIT");
  const [dataset, frozenLow, parent] = await Promise.all([
    loadGi088ResponseFirstV22RubricV13Cases(cwd),
    loadFrozenLow(cwd),
    loadParentFailEvidence(cwd)
  ]);
  const item = await verifyGi088ResponseFirstV29FrozenInputs({
    cwd,
    plan,
    dataset,
    frozenLow,
    parent
  });
  ledger.callStarted = true;
  ledger.turnInput = item.turnInput;
  ledger.frozenLow = frozenLow;
  await saveLedger(cwd, plan, ledger);

  let provider = input.provider;
  if (!provider) {
    loadEnvConfig(cwd, true);
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    assert(apiKey, "GI088_RESPONSE_FIRST_V29_DEEPSEEK_API_KEY_MISSING");
    provider = new OpenAIProvider({
      apiKey,
      model: GI088_RESPONSE_FIRST_V29_RUNTIME.model,
      baseUrl: "https://api.deepseek.com",
      timeoutMs: GI088_RESPONSE_FIRST_V29_RUNTIME.high.hardTimeoutMs
    });
  }
  ledger.result = await runGi088ResponseFirstV29CorrectionCall({
    provider,
    turnInput: item.turnInput,
    frozenLow
  });
  await saveLedger(cwd, plan, ledger);
  await writeReviewFiles(cwd, plan, ledger);
  return ledger;
}

export async function finalizeGi088ResponseFirstV29CorrectionProductReview(
  cwd = process.cwd()
) {
  const plan = await readFrozenPlan(cwd);
  const ledger = await readLedger(cwd, plan);
  const result = ledger.result;
  assert(result, "GI088_RESPONSE_FIRST_V29_PRODUCT_REVIEW_RESULT_MISSING");
  const review = JSON.parse(
    await readFile(
      path.join(cwd, GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.privateProductReview),
      "utf8"
    )
  ) as {
    identity: string;
    planFingerprint: string;
    reviewerRole: string;
    evidenceBinding: {
      caseId: string;
      turnInputHash: string | null;
      frozenLowHash: string;
      responseHash: string | null;
      projectedHighHash: string | null;
      visibleDeliveryHash: string | null;
      postStateHash: string | null;
    };
    verdict: Verdict;
    note: string;
  };
  const postStateHash = result.postState
    ? gi088ResponseFirstV29CorrectionGateSha(result.postState)
    : null;
  const turnInputHash = ledger.turnInput
    ? gi088ResponseFirstV29CorrectionGateSha(ledger.turnInput)
    : null;
  const projectedHighHash = result.projectedHigh
    ? gi088ResponseFirstV29CorrectionGateSha(result.projectedHigh)
    : null;
  const visibleDeliveryHash = result.visibleDelivery
    ? gi088ResponseFirstV29CorrectionGateSha(result.visibleDelivery)
    : null;
  assert(
    review.identity === plan.identity &&
      review.planFingerprint === plan.planFingerprint &&
      review.reviewerRole === "product_owner" &&
      review.evidenceBinding.caseId === result.caseId &&
      review.evidenceBinding.turnInputHash === turnInputHash &&
      review.evidenceBinding.frozenLowHash === result.frozenLowHash &&
      review.evidenceBinding.responseHash === result.responseHash &&
      review.evidenceBinding.projectedHighHash === projectedHighHash &&
      review.evidenceBinding.visibleDeliveryHash === visibleDeliveryHash &&
      review.evidenceBinding.postStateHash === postStateHash &&
      ["pass", "minor", "fail"].includes(review.verdict) &&
      (review.verdict === "fail" || result.status === "valid") &&
      review.note.trim().length > 0,
    "GI088_RESPONSE_FIRST_V29_PRODUCT_REVIEW_INVALID"
  );
  ledger.productDecision = {
    verdict: review.verdict,
    noteHash: gi088ResponseFirstV29CorrectionGateSha(review.note),
    reviewHash: gi088ResponseFirstV29CorrectionGateSha(review)
  };
  return saveLedger(cwd, plan, ledger);
}

async function main() {
  const command = process.env.GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_COMMAND;
  if (command === "prepare") {
    const plan = await prepareGi088ResponseFirstV29CorrectionGate();
    process.stdout.write(`${JSON.stringify({
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      status: "ready",
      publicStartCard: GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.publicStartCard,
      publicReceipt: GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.publicReceipt
    }, null, 2)}\n`);
    return;
  }
  if (command === "execute") {
    const ledger = await executeGi088ResponseFirstV29CorrectionGate({});
    process.stdout.write(`${JSON.stringify({
      identity: ledger.identity,
      status: receiptStatus(ledger),
      consumed: ledger.callStarted ? 1 : 0,
      completed: ledger.result ? 1 : 0,
      publicReceipt: GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_PATHS.publicReceipt
    }, null, 2)}\n`);
    return;
  }
  if (command === "finalize") {
    const ledger = await finalizeGi088ResponseFirstV29CorrectionProductReview();
    process.stdout.write(`${JSON.stringify({
      identity: ledger.identity,
      productDecision: ledger.productDecision,
      status: receiptStatus(ledger)
    }, null, 2)}\n`);
    return;
  }
  throw new Error("GI088_RESPONSE_FIRST_V29_COMMAND_REQUIRED");
}

if (process.env.GI088_RESPONSE_FIRST_V29_CORRECTION_GATE_COMMAND) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
