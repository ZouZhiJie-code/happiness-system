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
  GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME,
  createGi088CompleteResponseFirstV11Identity,
  createGi088CompleteResponseFirstV11ModelInput,
  createGi088CompleteResponseFirstV11UserPrompt,
  getGi088CompleteResponseFirstV11SystemPrompt,
  observeGi088CompleteResponseFirstV11Output,
  parseGi088CompleteResponseFirstV11Output,
  validateGi088CompleteResponseFirstV11Output
} from "../evals/event-centered-generative/gi088-complete-response-first-v1-1/candidate";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AICompletionParams,
  type AIProvider,
  type AIProviderDiagnostics
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS,
  GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS,
  GI088_COMPLETE_RESPONSE_FIRST_ROOT,
  loadGi088CompleteResponseFirstCases,
  type Gi088CompleteResponseFirstCase,
  type Gi088CompleteResponseFirstCaseId,
  type Gi088CompleteResponseFirstSplit
} from "./gi088-complete-response-first-fixtures";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_IDENTITY =
  "2026-08-19.gi088-complete-response-first-v1-1-quality-v1" as const;
export const GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;

const PRIVATE_ROOT =
  `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/.private/complete-response-first-v1-1-quality-v1`;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS = {
  publicStartCard:
    `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/complete-response-first-v1-1-quality-v1-start-card.json`,
  publicReceipt:
    `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/complete-response-first-v1-1-quality-v1-receipt.json`,
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateReview: `${PRIVATE_ROOT}/review.json`,
  privateRunLock: `${PRIVATE_ROOT}/run.lock`
} as const;

const RUNNER_FILE = "scripts/run-gi088-complete-response-first-v1-1-quality.ts";
const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  executionPlan:
    "docs/plans/2026-08-19-gi088-complete-response-first-v1-1-new-information-target.md",
  executionContract:
    "docs/technical/interview-event-centered/07-board7-model-led-semantic-implementation.md",
  candidate:
    "evals/event-centered-generative/gi088-complete-response-first-v1-1/candidate.ts",
  parentCandidate:
    "evals/event-centered-generative/gi088-complete-response-first-v1/candidate.ts",
  board7Input:
    "evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1.ts",
  fixtures: "scripts/gi088-complete-response-first-fixtures.ts",
  parentStart:
    `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/complete-response-first-quality-v1-start-card.json`,
  parentReceipt:
    `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/complete-response-first-quality-v1-receipt.json`,
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  runner: RUNNER_FILE
} as const;

export type Gi088CompleteResponseFirstV11QualityCommand =
  | "prepare"
  | "execute-development"
  | "execute-regression"
  | "inspect";

export type Gi088CompleteResponseFirstV11QualityResult = {
  order: number;
  caseId: Gi088CompleteResponseFirstCaseId;
  split: Gi088CompleteResponseFirstSplit;
  status: "technical_valid" | "technical_failure" | "program_gate_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  responseHash: string | null;
  responseLength: number;
  rawOutput: string | null;
  parsedOutput: string | null;
  turnInput: Gi088CompleteResponseFirstCase["turnInput"];
  validationIssues: string[];
  errorCode: string | null;
  technicalGatePassed: boolean;
  severeProgramGateFailed: boolean;
  technicalChecks: {
    http200: boolean;
    targetModel: boolean;
    finishStop: boolean;
    finishLength: boolean;
    nonEmpty: boolean;
    noInternalLeak: boolean;
    thinkingDisabled: boolean;
    hard45sPassed: boolean;
    single15sTargetPassed: boolean;
  };
  observation: {
    characterCount: number;
    paragraphCount: number;
    questionMarkCount: number;
  } | null;
  totalLatencyMs: number | null;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

type QualityPlan = Awaited<ReturnType<typeof createGi088CompleteResponseFirstV11QualityPlan>>;

export type Gi088CompleteResponseFirstV11QualityLedger = {
  schemaVersion: "1.0";
  identity: string;
  planFingerprint: string;
  reservations: Array<{
    order: number;
    caseId: Gi088CompleteResponseFirstCaseId;
    split: Gi088CompleteResponseFirstSplit;
    requestFingerprint: string;
    reservedAt: string;
    status: "started" | "completed";
  }>;
  results: Gi088CompleteResponseFirstV11QualityResult[];
  stopReason: string | null;
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

export function gi088CompleteResponseFirstV11QualitySha(value: unknown) {
  const source = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : JSON.stringify(canonicalize(value));
  return createHash("sha256").update(source).digest("hex");
}

export function gi088CompleteResponseFirstV11QualityPublicCode(value: string) {
  return /^[A-Z][A-Z0-9_.:-]{0,159}$/u.test(value)
    ? value
    : `PRIVATE_DETAIL_SHA256:${gi088CompleteResponseFirstV11QualitySha(value)}`;
}

async function fileSha(cwd: string, relativePath: string) {
  return gi088CompleteResponseFirstV11QualitySha(
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
    ) {
      return null;
    }
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
    GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.privateRunLock
  );
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(file), 0o700);
  const handle = await open(file, "wx", 0o600).catch((error: unknown) => {
    if (
      error && typeof error === "object" && "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error("GI088_COMPLETE_RESPONSE_FIRST_RUN_LOCKED");
    }
    throw error;
  });
  await handle.writeFile(`${JSON.stringify({
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_IDENTITY,
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
      ) {
        throw error;
      }
    });
  };
}

function requestForCase(item: Gi088CompleteResponseFirstCase) {
  return {
    messages: [
      { role: "system" as const, content: getGi088CompleteResponseFirstV11SystemPrompt() },
      { role: "user" as const, content: createGi088CompleteResponseFirstV11UserPrompt(item.turnInput) }
    ],
    maxTokens: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.maxTokens,
    headersTimeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.headersTimeoutMs,
    bodyIdleTimeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.bodyIdleTimeoutMs,
    hardTimeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.hardTimeoutMs,
    timeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.hardTimeoutMs,
    thinking: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.thinking,
    temperature: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.temperature
  } satisfies AICompletionParams;
}

export async function createGi088CompleteResponseFirstV11QualityPlan(
  cwd = process.cwd()
) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(
    standardSha256 === GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const dataset = await loadGi088CompleteResponseFirstCases(cwd);
  const candidateIdentity = createGi088CompleteResponseFirstV11Identity();
  const inputHashes = Object.fromEntries(
    await Promise.all(Object.entries(FILES).map(async ([key, relativePath]) => [
      `${key}Sha256`,
      await fileSha(cwd, relativePath)
    ]))
  );
  const cases = dataset.cases.map((item, index) => ({
    order: index + 1,
    caseId: item.caseId,
    split: item.split,
    hardGate: item.hardGate,
    sourceFingerprint: item.sourceFingerprint,
    modelInputFingerprint: gi088CompleteResponseFirstV11QualitySha(
      createGi088CompleteResponseFirstV11ModelInput(item.turnInput)
    ),
    requestFingerprint: gi088CompleteResponseFirstV11QualitySha(requestForCase(item))
  }));
  const core = {
    schemaVersion: "1.0",
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_IDENTITY,
    status: "ready",
    standardSha256,
    candidateIdentity,
    dataset: {
      version: dataset.datasetVersion,
      fingerprint: dataset.datasetFingerprint,
      sourceVersion: dataset.sourceDatasetVersion,
      sourceFingerprint: dataset.sourceDatasetFingerprint,
      privacyLevel: "private_sensitive",
      developmentCount: dataset.developmentCases.length,
      regressionCount: dataset.regressionCases.length
    },
    cases,
    runtime: {
      ...GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    budget: {
      authorized: 8,
      development: 3,
      regression: 5,
      callsPerCase: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    stopPolicy: {
      ordinarySemanticQualityStopsCalls: false,
      consecutiveTechnicalFailures: 2,
      severeProgramGateFailure: 1,
      regressionRequiresDevelopmentTechnicalGate: true,
      productDecisionStoredInPrivateReview: true
    },
    publicBoundary: {
      startAndReceiptContainUserOrModelBody: false,
      onlyIdentifiersHashesMetricsAndSafeCodes: true
    },
    inputHashes
  } as const;
  return { ...core, planFingerprint: gi088CompleteResponseFirstV11QualitySha(core) };
}

function emptyLedger(plan: QualityPlan): Gi088CompleteResponseFirstV11QualityLedger {
  return {
    schemaVersion: "1.0",
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    reservations: [],
    results: [],
    stopReason: null
  };
}

async function readLedger(cwd: string, plan: QualityPlan) {
  const file = path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.privateLedger);
  const source = await readOptionalJson(file);
  const ledger = source === null
    ? emptyLedger(plan)
    : source as Gi088CompleteResponseFirstV11QualityLedger;
  assert(ledger.identity === plan.identity, "GI088_COMPLETE_RESPONSE_FIRST_LEDGER_IDENTITY_MISMATCH");
  assert(ledger.planFingerprint === plan.planFingerprint, "GI088_COMPLETE_RESPONSE_FIRST_LEDGER_PLAN_MISMATCH");
  assert(
    Array.isArray(ledger.reservations) && Array.isArray(ledger.results),
    "GI088_COMPLETE_RESPONSE_FIRST_LEDGER_SHAPE_INVALID"
  );
  assert(
    new Set(ledger.reservations.map((item) => item.caseId)).size ===
      ledger.reservations.length &&
      new Set(ledger.results.map((item) => item.caseId)).size ===
        ledger.results.length,
    "GI088_COMPLETE_RESPONSE_FIRST_LEDGER_DUPLICATE_CASE"
  );
  assert(
    ledger.reservations.length <= plan.budget.authorized &&
      ledger.results.every((result) => ledger.reservations.some(
        (reservation) => reservation.caseId === result.caseId &&
          reservation.status === "completed"
      )) &&
      ledger.reservations.every((reservation) =>
        reservation.status === "started" || ledger.results.some(
          (result) => result.caseId === reservation.caseId
        )
      ),
    "GI088_COMPLETE_RESPONSE_FIRST_LEDGER_RESERVATION_INVALID"
  );
  return ledger;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function publicResult(result: Gi088CompleteResponseFirstV11QualityResult) {
  return {
    order: result.order,
    caseId: result.caseId,
    split: result.split,
    status: result.status,
    requestFingerprint: result.requestFingerprint,
    responseHash: result.responseHash,
    responseLength: result.responseLength,
    validationIssueCodes: result.validationIssues.map(
      gi088CompleteResponseFirstV11QualityPublicCode
    ),
    errorCode: result.errorCode
      ? gi088CompleteResponseFirstV11QualityPublicCode(result.errorCode)
      : null,
    technicalGatePassed: result.technicalGatePassed,
    severeProgramGateFailed: result.severeProgramGateFailed,
    technicalChecks: result.technicalChecks,
    observation: result.observation,
    totalLatencyMs: result.totalLatencyMs,
    finishReason: result.diagnostics?.finishReason ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null
  };
}

function stageState(
  split: Gi088CompleteResponseFirstSplit,
  results: Gi088CompleteResponseFirstV11QualityResult[]
) {
  const expected = split === "development"
    ? GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS
    : GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS;
  const stageResults = results.filter((item) => item.split === split);
  if (stageResults.length === expected.length) return "complete";
  if (stageResults.length > 0) return "stopped_or_partial";
  return "not_run";
}

async function saveEvidence(
  cwd: string,
  plan: QualityPlan,
  ledger: Gi088CompleteResponseFirstV11QualityLedger
) {
  await writeJsonAtomic(
    path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.privateLedger),
    ledger,
    true
  );
  const reviewFile = path.join(
    cwd,
    GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.privateReview
  );
  const previousReview = await readOptionalJson(reviewFile) as
    | Record<string, unknown>
    | null;
  if (previousReview) {
    assert(
      previousReview.identity === plan.identity &&
        previousReview.planFingerprint === plan.planFingerprint,
      "GI088_COMPLETE_RESPONSE_FIRST_REVIEW_BINDING_MISMATCH"
    );
  }
  const previousCases = Array.isArray(previousReview?.cases)
    ? previousReview.cases as Array<Record<string, unknown>>
    : [];
  await writeJsonAtomic(
    reviewFile,
    {
      ...previousReview,
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      reviewOrder: "完整原文 → 实际输出 → 技术指标 → Codex初评 → 产品负责人裁决",
      cases: ledger.results.map((result) => ({
        ...previousCases.find((item) => item.caseId === result.caseId),
        caseId: result.caseId,
        split: result.split,
        turnInput: result.turnInput,
        actualOutput: result.rawOutput,
        metrics: {
          status: result.status,
          technicalGatePassed: result.technicalGatePassed,
          technicalChecks: result.technicalChecks,
          observation: result.observation,
          totalLatencyMs: result.totalLatencyMs
        },
        codexReview: previousCases.find((item) => item.caseId === result.caseId)
          ?.codexReview ?? null,
        productOwnerReview: previousCases.find((item) => item.caseId === result.caseId)
          ?.productOwnerReview ?? null
      }))
    },
    true
  );
  const latencies = ledger.results.flatMap((item) =>
    item.totalLatencyMs === null ? [] : [item.totalLatencyMs]
  );
  await writeJsonAtomic(
    path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.publicReceipt),
    {
      schemaVersion: "1.0",
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      candidateFingerprint: plan.candidateIdentity.candidateFingerprint,
      datasetFingerprint: plan.dataset.fingerprint,
      stages: {
        development: stageState("development", ledger.results),
        regression: stageState("regression", ledger.results)
      },
      budget: {
        authorized: plan.budget.authorized,
        consumed: ledger.reservations.length,
        completed: ledger.results.length,
        notRun: plan.budget.authorized - ledger.reservations.length,
        retries: 0,
        recovery: 0,
        fallback: 0
      },
      stopReason: ledger.stopReason,
      reservations: ledger.reservations.map((item) => ({
        order: item.order,
        caseId: item.caseId,
        split: item.split,
        requestFingerprint: item.requestFingerprint,
        status: item.status
      })),
      medianLatencyMs: median(latencies),
      results: ledger.results.map(publicResult),
      privateBoundary: {
        publicReceiptContainsUserOrModelBody: false,
        rawInputsOutputsAndReviews: "git_ignored_private_directory"
      }
    }
  );
  return ledger;
}

function internalLeak(issues: string[]) {
  return issues.some((issue) =>
    issue === "VISIBLE_RESPONSE_INTERNAL_LANGUAGE_LEAK" ||
    issue === "VISIBLE_RESPONSE_STRUCTURED_WRAPPER_LEAK"
  );
}

async function runCase(input: {
  entry: QualityPlan["cases"][number];
  item: Gi088CompleteResponseFirstCase;
  provider: AIProvider;
}) {
  const request = requestForCase(input.item);
  assert(
    gi088CompleteResponseFirstV11QualitySha(request) === input.entry.requestFingerprint,
    `GI088_COMPLETE_RESPONSE_FIRST_REQUEST_DRIFT:${input.entry.caseId}`
  );
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let rawOutput = "";
  let diagnostics: AIProviderDiagnostics | null = null;
  try {
    assert(input.provider.stream, "GI088_COMPLETE_RESPONSE_FIRST_STREAM_UNAVAILABLE");
    for await (const chunk of input.provider.stream({
      ...request,
      onStreamDiagnostics: (value) => {
        diagnostics = value;
      }
    })) {
      rawOutput += chunk;
    }
    const safeDiagnostics = sanitizeAIProviderDiagnostics(diagnostics);
    const totalLatencyMs = safeDiagnostics?.totalLatencyMs ?? Math.max(0, Date.now() - startedMs);
    let parsedOutput: string | null = null;
    let validationIssues: string[] = [];
    try {
      parsedOutput = parseGi088CompleteResponseFirstV11Output(rawOutput);
      validationIssues = validateGi088CompleteResponseFirstV11Output({
        turnInput: input.item.turnInput,
        output: parsedOutput
      });
    } catch (error) {
      validationIssues = [error instanceof Error ? error.message : "VISIBLE_RESPONSE_PARSE_FAILED"];
    }
    const leak = internalLeak(validationIssues);
    const checks = {
      http200: safeDiagnostics?.httpStatus === 200,
      targetModel: safeDiagnostics?.responseModel === GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.model,
      finishStop: safeDiagnostics?.finishReason === "stop",
      finishLength: safeDiagnostics?.finishReason === "length",
      nonEmpty: Boolean(parsedOutput),
      noInternalLeak: !leak,
      thinkingDisabled: safeDiagnostics?.reasoningPresent === false &&
        (safeDiagnostics.reasoningTokens === null ||
          safeDiagnostics.reasoningTokens === 0),
      hard45sPassed: totalLatencyMs <= GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.hardTimeoutMs,
      single15sTargetPassed: totalLatencyMs <= 15_000
    };
    const technicalGatePassed = checks.http200 && checks.targetModel &&
      checks.finishStop && checks.nonEmpty && checks.noInternalLeak &&
      checks.thinkingDisabled && checks.hard45sPassed;
    const status = leak
      ? "program_gate_failure" as const
      : technicalGatePassed
        ? "technical_valid" as const
        : "technical_failure" as const;
    return {
      order: input.entry.order,
      caseId: input.entry.caseId,
      split: input.entry.split,
      status,
      startedAt,
      completedAt: new Date().toISOString(),
      requestFingerprint: input.entry.requestFingerprint,
      responseHash: rawOutput ? gi088CompleteResponseFirstV11QualitySha(rawOutput) : null,
      responseLength: rawOutput.length,
      rawOutput: rawOutput || null,
      parsedOutput,
      turnInput: input.item.turnInput,
      validationIssues,
      errorCode: technicalGatePassed
        ? null
        : leak
          ? "GI088_COMPLETE_RESPONSE_FIRST_SEVERE_PROGRAM_GATE"
          : checks.finishLength
            ? "GI088_COMPLETE_RESPONSE_FIRST_TOKEN_CEILING_INCONCLUSIVE"
            : "GI088_COMPLETE_RESPONSE_FIRST_TECHNICAL_GATE_FAILED",
      technicalGatePassed,
      severeProgramGateFailed: leak,
      technicalChecks: checks,
      observation: parsedOutput
        ? observeGi088CompleteResponseFirstV11Output(parsedOutput)
        : null,
      totalLatencyMs,
      diagnostics: safeDiagnostics
    } satisfies Gi088CompleteResponseFirstV11QualityResult;
  } catch (error) {
    const safeDiagnostics = sanitizeAIProviderDiagnostics(
      diagnostics ?? getAIProviderDiagnostics(error)
    );
    const totalLatencyMs = safeDiagnostics?.totalLatencyMs ?? Math.max(0, Date.now() - startedMs);
    return {
      order: input.entry.order,
      caseId: input.entry.caseId,
      split: input.entry.split,
      status: "technical_failure",
      startedAt,
      completedAt: new Date().toISOString(),
      requestFingerprint: input.entry.requestFingerprint,
      responseHash: rawOutput ? gi088CompleteResponseFirstV11QualitySha(rawOutput) : null,
      responseLength: rawOutput.length,
      rawOutput: rawOutput || null,
      parsedOutput: null,
      turnInput: input.item.turnInput,
      validationIssues: [],
      errorCode: getAIProviderFailureCode(error),
      technicalGatePassed: false,
      severeProgramGateFailed: false,
      technicalChecks: {
        http200: safeDiagnostics?.httpStatus === 200,
        targetModel: safeDiagnostics?.responseModel === GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.model,
        finishStop: safeDiagnostics?.finishReason === "stop",
        finishLength: safeDiagnostics?.finishReason === "length",
        nonEmpty: false,
        noInternalLeak: true,
        thinkingDisabled: safeDiagnostics?.reasoningPresent === false &&
          (safeDiagnostics.reasoningTokens === null ||
            safeDiagnostics.reasoningTokens === 0),
        hard45sPassed: totalLatencyMs <= GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.hardTimeoutMs,
        single15sTargetPassed: totalLatencyMs <= 15_000
      },
      observation: null,
      totalLatencyMs,
      diagnostics: safeDiagnostics
    } satisfies Gi088CompleteResponseFirstV11QualityResult;
  }
}

async function runGi088CompleteResponseFirstV11QualityStageUnlocked(input: {
  cwd?: string;
  workspaceRoot?: string;
  plan: QualityPlan;
  split: Gi088CompleteResponseFirstSplit;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const ledger = await readLedger(cwd, input.plan);
  const expected = input.split === "development"
    ? GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS
    : GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS;
  const existing = ledger.results.filter((item) => item.split === input.split);
  assert(
    !ledger.reservations.some((reservation) =>
      reservation.status === "started" &&
      !ledger.results.some((result) => result.caseId === reservation.caseId)
    ),
    "GI088_COMPLETE_RESPONSE_FIRST_UNRESOLVED_RESERVATION_NO_RECOVERY"
  );
  if (existing.length === expected.length) return saveEvidence(cwd, input.plan, ledger);
  assert(existing.length === 0, `GI088_COMPLETE_RESPONSE_FIRST_${input.split.toUpperCase()}_PARTIAL_REQUIRES_AUDIT`);
  if (input.split === "regression") {
    const development = ledger.results.filter((item) => item.split === "development");
    assert(
      development.length === GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS.length &&
        development.every((item) => item.technicalGatePassed),
      "GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_REQUIRES_DEVELOPMENT_TECHNICAL_GATE"
    );
  }
  assert(ledger.reservations.length + expected.length <= input.plan.budget.authorized, "GI088_COMPLETE_RESPONSE_FIRST_BUDGET_EXCEEDED");
  const dataset = await loadGi088CompleteResponseFirstCases(workspaceRoot);
  let consecutiveTechnicalFailures = 0;
  for (const caseId of expected) {
    const entry = input.plan.cases.find((candidate) => candidate.caseId === caseId);
    const item = dataset.cases.find((candidate) => candidate.caseId === caseId);
    assert(entry && item, `GI088_COMPLETE_RESPONSE_FIRST_CASE_MISSING:${caseId}`);
    assert(
      !ledger.reservations.some((reservation) => reservation.caseId === caseId),
      `GI088_COMPLETE_RESPONSE_FIRST_CASE_ALREADY_RESERVED:${caseId}`
    );
    ledger.reservations.push({
      order: entry.order,
      caseId: entry.caseId,
      split: entry.split,
      requestFingerprint: entry.requestFingerprint,
      reservedAt: new Date().toISOString(),
      status: "started"
    });
    await saveEvidence(cwd, input.plan, ledger);
    const result = await runCase({ entry, item, provider: input.provider });
    ledger.results.push(result);
    const reservation = ledger.reservations.find(
      (candidate) => candidate.caseId === caseId
    );
    assert(reservation, `GI088_COMPLETE_RESPONSE_FIRST_RESERVATION_LOST:${caseId}`);
    reservation.status = "completed";
    consecutiveTechnicalFailures = result.status === "technical_failure"
      ? consecutiveTechnicalFailures + 1
      : 0;
    if (result.severeProgramGateFailed) {
      ledger.stopReason = `SEVERE_PROGRAM_GATE:${caseId}`;
    } else if (consecutiveTechnicalFailures >= 2) {
      ledger.stopReason = `TWO_CONSECUTIVE_TECHNICAL_FAILURES:${caseId}`;
    }
    await saveEvidence(cwd, input.plan, ledger);
    if (ledger.stopReason) break;
  }
  return saveEvidence(cwd, input.plan, ledger);
}

export async function runGi088CompleteResponseFirstV11QualityStage(input: {
  cwd?: string;
  workspaceRoot?: string;
  plan: QualityPlan;
  split: Gi088CompleteResponseFirstSplit;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const release = await acquireRunLock(cwd);
  try {
    return await runGi088CompleteResponseFirstV11QualityStageUnlocked(input);
  } finally {
    await release();
  }
}

export async function prepareGi088CompleteResponseFirstV11Quality(cwd = process.cwd()) {
  const startFile = path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.publicStartCard);
  if (await pathExists(startFile)) {
    const frozen = JSON.parse(await readFile(startFile, "utf8")) as QualityPlan;
    const current = await createGi088CompleteResponseFirstV11QualityPlan(cwd);
    assertGi088CompleteResponseFirstV11QualityFrozenPlan({ frozen, current });
    return frozen;
  }
  const plan = await createGi088CompleteResponseFirstV11QualityPlan(cwd);
  assert(
    !(await pathExists(path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.privateLedger
    ))) &&
      !(await pathExists(path.join(
        cwd,
        GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.privateReview
      ))),
    "GI088_COMPLETE_RESPONSE_FIRST_ORPHAN_PRIVATE_EVIDENCE_REQUIRES_AUDIT"
  );
  await writeJsonAtomic(startFile, plan);
  await saveEvidence(cwd, plan, emptyLedger(plan));
  return plan;
}

export function assertGi088CompleteResponseFirstV11QualityFrozenPlan(input: {
  frozen: QualityPlan;
  current: QualityPlan;
}) {
  assert(
    gi088CompleteResponseFirstV11QualitySha(input.frozen) ===
      gi088CompleteResponseFirstV11QualitySha(input.current),
    "GI088_COMPLETE_RESPONSE_FIRST_FROZEN_PLAN_DRIFT"
  );
}

export async function inspectGi088CompleteResponseFirstV11Quality(cwd = process.cwd()) {
  const plan = await prepareGi088CompleteResponseFirstV11Quality(cwd);
  const ledger = await readLedger(cwd, plan);
  return {
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    stages: {
      development: stageState("development", ledger.results),
      regression: stageState("regression", ledger.results)
    },
    budget: {
      authorized: plan.budget.authorized,
      consumed: ledger.reservations.length,
      completed: ledger.results.length,
      notRun: plan.budget.authorized - ledger.reservations.length
    },
    stopReason: ledger.stopReason,
    publicReceipt: GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.publicReceipt,
    privateReview: GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_PATHS.privateReview
  };
}

async function providerForExecution(cwd: string) {
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_COMPLETE_RESPONSE_FIRST_DEEPSEEK_API_KEY_MISSING");
  return new OpenAIProvider({
    apiKey,
    model: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_1_RUNTIME.hardTimeoutMs
  });
}

async function main() {
  const cwd = process.cwd();
  const command = (process.env.GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_COMMAND ??
    process.argv[2] ?? "prepare") as Gi088CompleteResponseFirstV11QualityCommand;
  assert(
    command === "prepare" || command === "execute-development" ||
      command === "execute-regression" || command === "inspect",
    "GI088_COMPLETE_RESPONSE_FIRST_UNKNOWN_COMMAND"
  );
  if (command === "prepare") {
    await prepareGi088CompleteResponseFirstV11Quality(cwd);
  } else if (command === "inspect") {
    process.stdout.write(`${JSON.stringify(await inspectGi088CompleteResponseFirstV11Quality(cwd), null, 2)}\n`);
    return;
  } else {
    const plan = await prepareGi088CompleteResponseFirstV11Quality(cwd);
    const provider = await providerForExecution(cwd);
    await runGi088CompleteResponseFirstV11QualityStage({
      cwd,
      workspaceRoot: cwd,
      plan,
      split: command === "execute-development" ? "development" : "regression",
      provider
    });
  }
  process.stdout.write(`${JSON.stringify(await inspectGi088CompleteResponseFirstV11Quality(cwd), null, 2)}\n`);
}

export function shouldRunGi088CompleteResponseFirstV11QualityCli(input: {
  argv?: string[];
  env?: Partial<NodeJS.ProcessEnv>;
} = {}) {
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;
  return env.VITEST !== "true" && Boolean(
    env.GI088_COMPLETE_RESPONSE_FIRST_V1_1_QUALITY_COMMAND ||
      argv.some((item) => path.resolve(item) === path.resolve(RUNNER_FILE))
  );
}

if (shouldRunGi088CompleteResponseFirstV11QualityCli()) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
