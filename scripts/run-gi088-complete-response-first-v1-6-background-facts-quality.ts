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
  createGi088CompleteResponseFirstV16BackgroundFactsInput,
  observeGi088CompleteResponseFirstV16BackgroundFactsOutput,
  parseGi088CompleteResponseFirstV16BackgroundFactsOutput,
  validateGi088CompleteResponseFirstV16BackgroundFactsOutput
} from "../evals/event-centered-generative/gi088-complete-response-first-v1-6-background-facts/candidate";
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
import type { EventCenteredCompleteResponseBackgroundFactsV1Output } from "../src/features/interview/event-centered/complete-response-background-facts-v1";
import {
  GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS,
  GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS,
  GI088_COMPLETE_RESPONSE_FIRST_ROOT,
  loadGi088CompleteResponseFirstCases,
  type Gi088CompleteResponseFirstCase,
  type Gi088CompleteResponseFirstCaseId,
  type Gi088CompleteResponseFirstSplit
} from "./gi088-complete-response-first-fixtures";

export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_IDENTITY =
  "2026-08-20.gi088-complete-response-first-v1-6-background-facts-quality-v1" as const;
export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_STANDARD_SHA256 =
  "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60" as const;

const PRIVATE_ROOT =
  `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/.private/complete-response-first-v1-6-background-facts-quality-v1`;

export const GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS = {
  publicStartCard:
    `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/complete-response-first-v1-6-background-facts-quality-v1-start-card.json`,
  publicReceipt:
    `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/complete-response-first-v1-6-background-facts-quality-v1-receipt.json`,
  privateLedger: `${PRIVATE_ROOT}/ledger.json`,
  privateReview: `${PRIVATE_ROOT}/review.json`,
  privateRunLock: `${PRIVATE_ROOT}/run.lock`
} as const;

const RUNNER_FILE =
  "scripts/run-gi088-complete-response-first-v1-6-background-facts-quality.ts";
const PARENT_START =
  `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/complete-response-first-v1-6-contrastive-coverage-quality-v1-start-card.json`;
const PARENT_RECEIPT =
  `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/complete-response-first-v1-6-contrastive-coverage-quality-v1-receipt.json`;
const PARENT_PRIVATE_LEDGER =
  `${GI088_COMPLETE_RESPONSE_FIRST_ROOT}/.private/complete-response-first-v1-6-contrastive-coverage-quality-v1/ledger.json`;

const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  executionPlan:
    "docs/plans/2026-08-20-gi088-complete-response-first-v1-6-background-state-readiness.md",
  fixtures: "scripts/gi088-complete-response-first-fixtures.ts",
  backgroundCandidate:
    "evals/event-centered-generative/gi088-complete-response-first-v1-6-background-facts/candidate.ts",
  backgroundContract:
    "src/features/interview/event-centered/complete-response-background-facts-v1.ts",
  parentVisibleCandidate:
    "evals/event-centered-generative/gi088-complete-response-first-v1-6-contrastive-coverage/candidate.ts",
  provider: "src/server/services/ai/openai.provider.ts",
  providerContract: "src/server/services/ai/ai-provider.ts",
  parentStart: PARENT_START,
  parentReceipt: PARENT_RECEIPT,
  parentPrivateLedger: PARENT_PRIVATE_LEDGER,
  package: "package.json",
  runner: RUNNER_FILE
} as const;

export type Gi088CompleteResponseFirstV16BackgroundFactsQualityCommand =
  | "prepare"
  | "execute-development"
  | "execute-regression"
  | "inspect";

type CapturedRequest = {
  temperature: number | null;
  maxTokens: number | null;
  timeoutMs: number | null;
  responseFormat: string | null;
  thinking: string | null;
  reasoningEffortPresent: boolean;
};

export type Gi088CompleteResponseFirstV16BackgroundFactsQualityResult = {
  order: number;
  caseId: Gi088CompleteResponseFirstCaseId;
  split: Gi088CompleteResponseFirstSplit;
  status:
    | "technical_valid"
    | "contract_failure"
    | "technical_failure"
    | "program_gate_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  generationInput: ReturnType<typeof createGi088CompleteResponseFirstV16BackgroundFactsInput>;
  turnInput: Gi088CompleteResponseFirstCase["turnInput"];
  parentVisibleOutput: string;
  rawProviderOutput: string | null;
  parsedOutput: EventCenteredCompleteResponseBackgroundFactsV1Output | null;
  responseHash: string | null;
  validationIssues: string[];
  errorCode: string | null;
  technicalGatePassed: boolean;
  severeProgramGateFailed: boolean;
  requestContract: CapturedRequest | null;
  technicalChecks: {
    oneProviderCall: boolean;
    oneCallArchitecture: boolean;
    targetModel: boolean;
    finishStop: boolean;
    finishLength: boolean;
    nonEmpty: boolean;
    thinkingDisabled: boolean;
    reasoningEffortAbsent: boolean;
    maxTokens1600: boolean;
    hardTimeout20s: boolean;
  };
  observation: ReturnType<typeof observeGi088CompleteResponseFirstV16BackgroundFactsOutput> | null;
  totalLatencyMs: number | null;
  diagnostics: AIProviderDiagnostics | null;
};

type QualityPlan = Awaited<ReturnType<
  typeof createGi088CompleteResponseFirstV16BackgroundFactsQualityPlan
>>;

export type Gi088CompleteResponseFirstV16BackgroundFactsQualityLedger = {
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
  results: Gi088CompleteResponseFirstV16BackgroundFactsQualityResult[];
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

export function gi088CompleteResponseFirstV16BackgroundFactsQualitySha(value: unknown) {
  const source = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : JSON.stringify(canonicalize(value));
  return createHash("sha256").update(source).digest("hex");
}

function publicCode(value: string) {
  return /^[A-Z][A-Z0-9_.:-]{0,159}$/u.test(value)
    ? value
    : `PRIVATE_DETAIL_SHA256:${gi088CompleteResponseFirstV16BackgroundFactsQualitySha(value)}`;
}

async function fileSha(cwd: string, relativePath: string) {
  return gi088CompleteResponseFirstV16BackgroundFactsQualitySha(
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
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.privateRunLock
  );
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(file), 0o700);
  const handle = await open(file, "wx", 0o600).catch((error: unknown) => {
    if (
      error && typeof error === "object" && "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error("GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_RUN_LOCKED");
    }
    throw error;
  });
  await handle.writeFile(`${JSON.stringify({
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_IDENTITY,
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

function assertParentEvidence(start: unknown, receipt: unknown, ledger: unknown) {
  assert(start && typeof start === "object", "GI088_COMPLETE_RESPONSE_PARENT_START_INVALID");
  assert(receipt && typeof receipt === "object", "GI088_COMPLETE_RESPONSE_PARENT_RECEIPT_INVALID");
  assert(ledger && typeof ledger === "object", "GI088_COMPLETE_RESPONSE_PARENT_LEDGER_INVALID");
  const parentStart = start as Record<string, unknown>;
  const parentReceipt = receipt as Record<string, unknown>;
  const parentLedger = ledger as Record<string, unknown>;
  assert(
    parentStart.identity ===
      "2026-08-20.gi088-complete-response-first-v1-6-contrastive-coverage-quality-v1" &&
      parentReceipt.identity === parentStart.identity &&
      parentReceipt.planFingerprint === parentStart.planFingerprint &&
      parentLedger.identity === parentStart.identity &&
      parentLedger.planFingerprint === parentStart.planFingerprint,
    "GI088_COMPLETE_RESPONSE_PARENT_IDENTITY_MISMATCH"
  );
  const budget = parentReceipt.budget as Record<string, unknown> | undefined;
  const publicResults = parentReceipt.results;
  const privateResults = parentLedger.results;
  assert(
    budget?.consumed === 8 && budget.completed === 8 && budget.notRun === 0 &&
      Array.isArray(publicResults) && publicResults.length === 8 &&
      Array.isArray(privateResults) && privateResults.length === 8 &&
      publicResults.filter((item) =>
        item && typeof item === "object" &&
        (item as Record<string, unknown>).status === "technical_valid"
      ).length === 8,
    "GI088_COMPLETE_RESPONSE_PARENT_TECHNICAL_EVIDENCE_MISMATCH"
  );
  const outputs: Record<string, string> = {};
  for (const raw of privateResults) {
    assert(raw && typeof raw === "object", "GI088_COMPLETE_RESPONSE_PARENT_RESULT_INVALID");
    const item = raw as Record<string, unknown>;
    assert(
      typeof item.caseId === "string" && item.status === "technical_valid" &&
        typeof item.actualVisibleOutput === "string" && item.actualVisibleOutput.length > 0 &&
        typeof item.responseHash === "string" &&
        item.responseHash === gi088CompleteResponseFirstV16BackgroundFactsQualitySha(
          item.actualVisibleOutput
        ),
      "GI088_COMPLETE_RESPONSE_PARENT_VISIBLE_OUTPUT_INVALID"
    );
    const publicItem = publicResults.find((candidate) =>
      candidate && typeof candidate === "object" &&
      (candidate as Record<string, unknown>).caseId === item.caseId
    ) as Record<string, unknown> | undefined;
    assert(
      publicItem?.responseHash === item.responseHash,
      "GI088_COMPLETE_RESPONSE_PARENT_VISIBLE_HASH_MISMATCH"
    );
    outputs[item.caseId] = item.actualVisibleOutput;
  }
  return outputs;
}

export async function createGi088CompleteResponseFirstV16BackgroundFactsQualityPlan(
  cwd = process.cwd()
) {
  const standardSha256 = await fileSha(cwd, FILES.standard);
  assert(
    standardSha256 === GI088_COMPLETE_RESPONSE_FIRST_V1_6_STANDARD_SHA256,
    "STANDARD_SHA256_MISMATCH"
  );
  const [dataset, parentStart, parentReceipt, parentLedger] = await Promise.all([
    loadGi088CompleteResponseFirstCases(cwd),
    readOptionalJson(path.join(cwd, PARENT_START)),
    readOptionalJson(path.join(cwd, PARENT_RECEIPT)),
    readOptionalJson(path.join(cwd, PARENT_PRIVATE_LEDGER))
  ]);
  const parentOutputs = assertParentEvidence(parentStart, parentReceipt, parentLedger);
  const candidateIdentity = {
    candidate: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_IDENTITY,
    runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME
  };
  const candidateFingerprint =
    gi088CompleteResponseFirstV16BackgroundFactsQualitySha(candidateIdentity);
  const inputHashes = Object.fromEntries(
    await Promise.all(Object.entries(FILES).map(async ([key, relativePath]) => [
      `${key}Sha256`,
      await fileSha(cwd, relativePath)
    ]))
  );
  const cases = dataset.cases.map((item, index) => {
    const actualVisibleOutput = parentOutputs[item.caseId];
    assert(actualVisibleOutput, `GI088_COMPLETE_RESPONSE_PARENT_CASE_MISSING:${item.caseId}`);
    const generationInput = createGi088CompleteResponseFirstV16BackgroundFactsInput({
      item,
      actualVisibleOutput
    });
    const identity = createGi088CompleteResponseFirstV16BackgroundFactsIdentity({
      caseId: item.caseId,
      input: generationInput
    });
    return {
      order: index + 1,
      caseId: item.caseId,
      split: item.split,
      hardGate: item.hardGate,
      sourceFingerprint: item.sourceFingerprint,
      generationInputFingerprint:
        gi088CompleteResponseFirstV16BackgroundFactsQualitySha(generationInput),
      parentVisibleOutputHash:
        gi088CompleteResponseFirstV16BackgroundFactsQualitySha(actualVisibleOutput),
      requestFingerprint: gi088CompleteResponseFirstV16BackgroundFactsQualitySha({
        candidateFingerprint,
        identity,
        messages: buildGi088CompleteResponseFirstV16BackgroundFactsMessages(
          generationInput
        )
      })
    };
  });
  const core = {
    schemaVersion: "1.0",
    identity: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_IDENTITY,
    status: "ready",
    standardSha256,
    candidateIdentity: { ...candidateIdentity, candidateFingerprint },
    parentEvidence: {
      identity:
        "2026-08-20.gi088-complete-response-first-v1-6-contrastive-coverage-quality-v1",
      startSha256: inputHashes.parentStartSha256,
      receiptSha256: inputHashes.parentReceiptSha256,
      privateLedgerSha256: inputHashes.parentPrivateLedgerSha256,
      technicalCases: 8,
      contractValidCases: 8,
      visibleProductVerdict: "pending"
    },
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
      ...GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME,
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
      ordinaryContractFailureStopsCalls: false,
      consecutiveTechnicalFailures: 2,
      severeProgramGateFailure: 1,
      severeProgramIssues: [
        "BACKGROUND_FACTS_SOURCE_OR_REFERENCE_INVALID",
        "BACKGROUND_FACTS_REQUEST_CONTRACT_MISMATCH"
      ]
    },
    publicBoundary: {
      startAndReceiptContainUserOrModelBody: false,
      onlyIdentifiersHashesMetricsAndSafeCodes: true
    },
    inputHashes
  } as const;
  return {
    ...core,
    planFingerprint: gi088CompleteResponseFirstV16BackgroundFactsQualitySha(core)
  };
}

function emptyLedger(
  plan: QualityPlan
): Gi088CompleteResponseFirstV16BackgroundFactsQualityLedger {
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
  const file = path.join(
    cwd,
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.privateLedger
  );
  const source = await readOptionalJson(file);
  const ledger = source === null
    ? emptyLedger(plan)
    : source as Gi088CompleteResponseFirstV16BackgroundFactsQualityLedger;
  assert(
    ledger.identity === plan.identity && ledger.planFingerprint === plan.planFingerprint,
    "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_LEDGER_BINDING_MISMATCH"
  );
  assert(
    new Set(ledger.reservations.map((item) => item.caseId)).size ===
      ledger.reservations.length &&
      new Set(ledger.results.map((item) => item.caseId)).size === ledger.results.length,
    "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_LEDGER_DUPLICATE_CASE"
  );
  assert(
    ledger.reservations.length <= plan.budget.authorized &&
      ledger.results.every((result) => ledger.reservations.some(
        (reservation) =>
          reservation.caseId === result.caseId && reservation.status === "completed"
      )),
    "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_LEDGER_RESERVATION_INVALID"
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

function stageState(
  split: Gi088CompleteResponseFirstSplit,
  results: Gi088CompleteResponseFirstV16BackgroundFactsQualityResult[]
) {
  const expected = split === "development"
    ? GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS
    : GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS;
  const count = results.filter((item) => item.split === split).length;
  if (count === expected.length) return "complete";
  return count > 0 ? "stopped_or_partial" : "not_run";
}

function publicResult(result: Gi088CompleteResponseFirstV16BackgroundFactsQualityResult) {
  return {
    order: result.order,
    caseId: result.caseId,
    split: result.split,
    status: result.status,
    requestFingerprint: result.requestFingerprint,
    responseHash: result.responseHash,
    validationIssueCodes: result.validationIssues.map(publicCode),
    errorCode: result.errorCode ? publicCode(result.errorCode) : null,
    technicalGatePassed: result.technicalGatePassed,
    severeProgramGateFailed: result.severeProgramGateFailed,
    requestContract: result.requestContract,
    technicalChecks: result.technicalChecks,
    observation: result.observation,
    totalLatencyMs: result.totalLatencyMs,
    finishReason: result.diagnostics?.finishReason ?? null,
    responseModel: result.diagnostics?.responseModel ?? null,
    httpStatus: result.diagnostics?.httpStatus ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null
  };
}

async function saveEvidence(
  cwd: string,
  plan: QualityPlan,
  ledger: Gi088CompleteResponseFirstV16BackgroundFactsQualityLedger
) {
  await writeJsonAtomic(
    path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.privateLedger
    ),
    ledger,
    true
  );
  const reviewFile = path.join(
    cwd,
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.privateReview
  );
  const previous = await readOptionalJson(reviewFile) as Record<string, unknown> | null;
  if (previous) {
    assert(
      previous.identity === plan.identity &&
        previous.planFingerprint === plan.planFingerprint,
      "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_REVIEW_BINDING_MISMATCH"
    );
  }
  const previousCases = Array.isArray(previous?.cases)
    ? previous.cases as Array<Record<string, unknown>>
    : [];
  await writeJsonAtomic(reviewFile, {
    ...previous,
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    reviewOrder: "完整相关原文 → 实际页面可见输出 → 实际后台输出 → 技术指标 → Codex初评 → 产品负责人裁决",
    cases: ledger.results.map((result) => ({
      ...previousCases.find((item) => item.caseId === result.caseId),
      caseId: result.caseId,
      split: result.split,
      turnInput: result.turnInput,
      generationInput: result.generationInput,
      parentVisibleOutput: result.parentVisibleOutput,
      rawProviderOutput: result.rawProviderOutput,
      parsedOutput: result.parsedOutput,
      responseHash: result.responseHash,
      metrics: {
        status: result.status,
        technicalGatePassed: result.technicalGatePassed,
        technicalChecks: result.technicalChecks,
        observation: result.observation,
        totalLatencyMs: result.totalLatencyMs,
        diagnostics: result.diagnostics
      },
      codexReview: previousCases.find((item) => item.caseId === result.caseId)
        ?.codexReview ?? null,
      productOwnerReview: previousCases.find((item) => item.caseId === result.caseId)
        ?.productOwnerReview ?? null
    }))
  }, true);
  const latencies = ledger.results.flatMap((item) =>
    item.totalLatencyMs === null ? [] : [item.totalLatencyMs]
  );
  await writeJsonAtomic(
    path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.publicReceipt
    ),
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
      medianLatencyMs: median(latencies),
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : null,
      results: ledger.results.map(publicResult),
      privateBoundary: {
        publicReceiptContainsUserOrModelBody: false,
        rawInputsOutputsAndReviews: "git_ignored_private_directory"
      }
    }
  );
  return ledger;
}

function captureProvider(base: AIProvider, observed: {
  request: CapturedRequest | null;
  diagnostics: AIProviderDiagnostics | null;
}) : AIProvider {
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

function isRequestContractValid(request: CapturedRequest | null) {
  return Boolean(
    request &&
    request.temperature === 0.2 &&
    request.maxTokens === 1_600 &&
    request.timeoutMs === 20_000 &&
    request.responseFormat === "json_object" &&
    request.thinking === "disabled" &&
    !request.reasoningEffortPresent
  );
}

async function loadParentVisibleOutputs(cwd: string) {
  const [start, receipt, ledger] = await Promise.all([
    readOptionalJson(path.join(cwd, PARENT_START)),
    readOptionalJson(path.join(cwd, PARENT_RECEIPT)),
    readOptionalJson(path.join(cwd, PARENT_PRIVATE_LEDGER))
  ]);
  return assertParentEvidence(start, receipt, ledger);
}

export async function runGi088CompleteResponseFirstV16BackgroundFactsCase(input: {
  entry: QualityPlan["cases"][number];
  item: Gi088CompleteResponseFirstCase;
  parentVisibleOutput: string;
  provider: AIProvider;
}) : Promise<Gi088CompleteResponseFirstV16BackgroundFactsQualityResult> {
  const generationInput = createGi088CompleteResponseFirstV16BackgroundFactsInput({
    item: input.item,
    actualVisibleOutput: input.parentVisibleOutput
  });
  const identity = createGi088CompleteResponseFirstV16BackgroundFactsIdentity({
    caseId: input.item.caseId,
    input: generationInput
  });
  const messages = buildGi088CompleteResponseFirstV16BackgroundFactsMessages(
    generationInput
  );
  const stableRequestFingerprint =
    gi088CompleteResponseFirstV16BackgroundFactsQualitySha({
      candidateFingerprint:
        gi088CompleteResponseFirstV16BackgroundFactsQualitySha({
          candidate: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_IDENTITY,
          runtime: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME
        }),
      identity,
      messages
    });
  assert(
    stableRequestFingerprint === input.entry.requestFingerprint,
    `GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_REQUEST_DRIFT:${input.item.caseId}`
  );
  const observed: {
    request: CapturedRequest | null;
    diagnostics: AIProviderDiagnostics | null;
  } = { request: null, diagnostics: null };
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let rawProviderOutput: string | null = null;
  let parsedOutput: EventCenteredCompleteResponseBackgroundFactsV1Output | null = null;
  let providerErrorCode: string | null = null;
  try {
    const result = await captureProvider(input.provider, observed).complete({
      messages,
      temperature: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME.temperature,
      maxTokens: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME.maxTokens,
      timeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME.timeoutMs,
      responseFormat: "json_object",
      thinking: "disabled"
    });
    rawProviderOutput = result.content;
    observed.diagnostics = sanitizeAIProviderDiagnostics(result.diagnostics);
    try {
      parsedOutput = parseGi088CompleteResponseFirstV16BackgroundFactsOutput(
        result.content
      );
    } catch (error) {
      providerErrorCode = error instanceof Error
        ? error.message
        : "BACKGROUND_FACTS_OUTPUT_PARSE_FAILED";
    }
  } catch (error) {
    providerErrorCode = getAIProviderFailureCode(error);
    observed.diagnostics = getAIProviderDiagnostics(error);
  }
  const elapsedMs = Math.max(0, Date.now() - startedMs);
  const diagnostics = observed.diagnostics;
  const requestContractValid = isRequestContractValid(observed.request);
  const validationIssues = parsedOutput
    ? validateGi088CompleteResponseFirstV16BackgroundFactsOutput({
        generationInput,
        output: parsedOutput
      })
    : [];
  if (!requestContractValid) {
    validationIssues.push("BACKGROUND_FACTS_REQUEST_CONTRACT_MISMATCH");
  }
  const uniqueIssues = [...new Set(validationIssues)];
  const severeProgramGateFailed = uniqueIssues.length > 0;
  const finishLength = diagnostics?.finishReason === "length";
  const status = severeProgramGateFailed
    ? "program_gate_failure" as const
    : providerErrorCode && providerErrorCode !== "BACKGROUND_FACTS_OUTPUT_INVALID_SCHEMA"
      ? "technical_failure" as const
      : !parsedOutput
        ? "contract_failure" as const
        : finishLength
          ? "technical_failure" as const
        : "technical_valid" as const;
  const totalLatencyMs = diagnostics?.totalLatencyMs ??
    diagnostics?.latencyMs ?? elapsedMs;
  const errorCode = finishLength
    ? "TOKEN_CEILING_INCONCLUSIVE"
    : providerErrorCode ??
      (status === "contract_failure" ? "BACKGROUND_FACTS_CONTRACT_FAILURE" :
        severeProgramGateFailed ? "BACKGROUND_FACTS_SOURCE_OR_REFERENCE_INVALID" : null);
  const technicalChecks = {
    oneProviderCall: observed.request !== null,
    oneCallArchitecture: true,
    targetModel: diagnostics?.responseModel ===
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME.model,
    finishStop: diagnostics?.finishReason === "stop",
    finishLength,
    nonEmpty: Boolean(rawProviderOutput?.trim()),
    thinkingDisabled: diagnostics?.reasoningPresent === false &&
      (diagnostics.reasoningTokens === null || diagnostics.reasoningTokens === 0),
    reasoningEffortAbsent: observed.request?.reasoningEffortPresent === false,
    maxTokens1600: observed.request?.maxTokens === 1_600,
    hardTimeout20s: totalLatencyMs <= 20_000
  };
  return {
    order: input.entry.order,
    caseId: input.item.caseId,
    split: input.item.split,
    status,
    startedAt,
    completedAt: new Date().toISOString(),
    requestFingerprint: stableRequestFingerprint,
    generationInput,
    turnInput: input.item.turnInput,
    parentVisibleOutput: input.parentVisibleOutput,
    rawProviderOutput,
    parsedOutput,
    responseHash: rawProviderOutput
      ? gi088CompleteResponseFirstV16BackgroundFactsQualitySha(rawProviderOutput)
      : null,
    validationIssues: uniqueIssues,
    errorCode,
    technicalGatePassed: status === "technical_valid" &&
      technicalChecks.oneProviderCall &&
      technicalChecks.oneCallArchitecture &&
      technicalChecks.targetModel &&
      technicalChecks.finishStop &&
      technicalChecks.nonEmpty &&
      technicalChecks.thinkingDisabled &&
      technicalChecks.reasoningEffortAbsent &&
      technicalChecks.maxTokens1600 &&
      technicalChecks.hardTimeout20s,
    severeProgramGateFailed,
    requestContract: observed.request,
    technicalChecks,
    observation: parsedOutput
      ? observeGi088CompleteResponseFirstV16BackgroundFactsOutput(parsedOutput)
      : null,
    totalLatencyMs,
    diagnostics
  };
}

async function runStageUnlocked(input: {
  cwd: string;
  plan: QualityPlan;
  split: Gi088CompleteResponseFirstSplit;
  provider: AIProvider;
}) {
  const ledger = await readLedger(input.cwd, input.plan);
  assert(
    !ledger.reservations.some((reservation) =>
      reservation.status === "started" &&
      !ledger.results.some((result) => result.caseId === reservation.caseId)
    ),
    "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_UNRESOLVED_RESERVATION_NO_RECOVERY"
  );
  const expected = input.split === "development"
    ? GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS
    : GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS;
  const existing = ledger.results.filter((item) => item.split === input.split);
  if (existing.length === expected.length) return saveEvidence(input.cwd, input.plan, ledger);
  assert(
    existing.length === 0,
    `GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_${input.split.toUpperCase()}_PARTIAL_REQUIRES_AUDIT`
  );
  if (input.split === "regression") {
    const development = ledger.results.filter((item) => item.split === "development");
    assert(
      development.length === GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS.length &&
        !ledger.stopReason,
      "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_REGRESSION_REQUIRES_DEVELOPMENT_COMPLETION"
    );
  }
  const dataset = await loadGi088CompleteResponseFirstCases(input.cwd);
  const parentVisibleOutputs = await loadParentVisibleOutputs(input.cwd);
  let consecutiveTechnicalFailures = 0;
  for (const caseId of expected) {
    const entry = input.plan.cases.find((candidate) => candidate.caseId === caseId);
    const item = dataset.cases.find((candidate) => candidate.caseId === caseId);
    assert(entry && item, `GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_CASE_MISSING:${caseId}`);
    assert(
      !ledger.reservations.some((reservation) => reservation.caseId === caseId) &&
        ledger.reservations.length < input.plan.budget.authorized,
      `GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_BUDGET_OR_DUPLICATE:${caseId}`
    );
    ledger.reservations.push({
      order: entry.order,
      caseId: entry.caseId,
      split: entry.split,
      requestFingerprint: entry.requestFingerprint,
      reservedAt: new Date().toISOString(),
      status: "started"
    });
    await saveEvidence(input.cwd, input.plan, ledger);
    const result = await runGi088CompleteResponseFirstV16BackgroundFactsCase({
      entry,
      item,
      parentVisibleOutput: parentVisibleOutputs[caseId]!,
      provider: input.provider
    });
    ledger.results.push(result);
    const reservation = ledger.reservations.find((candidate) => candidate.caseId === caseId)!;
    reservation.status = "completed";
    consecutiveTechnicalFailures = result.status === "technical_failure"
      ? consecutiveTechnicalFailures + 1
      : 0;
    if (result.severeProgramGateFailed) {
      ledger.stopReason = `SEVERE_PROGRAM_GATE:${caseId}`;
    } else if (consecutiveTechnicalFailures >= 2) {
      ledger.stopReason = `TWO_CONSECUTIVE_TECHNICAL_FAILURES:${caseId}`;
    }
    await saveEvidence(input.cwd, input.plan, ledger);
    if (ledger.stopReason) break;
  }
  return saveEvidence(input.cwd, input.plan, ledger);
}

export async function runGi088CompleteResponseFirstV16BackgroundFactsQualityStage(input: {
  cwd?: string;
  plan: QualityPlan;
  split: Gi088CompleteResponseFirstSplit;
  provider: AIProvider;
}) {
  const cwd = input.cwd ?? process.cwd();
  const release = await acquireRunLock(cwd);
  try {
    return await runStageUnlocked({ ...input, cwd });
  } finally {
    await release();
  }
}

export function assertGi088CompleteResponseFirstV16FrozenPlan(input: {
  frozen: QualityPlan;
  current: QualityPlan;
}) {
  assert(
    gi088CompleteResponseFirstV16BackgroundFactsQualitySha(input.frozen) ===
      gi088CompleteResponseFirstV16BackgroundFactsQualitySha(input.current),
    "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_FROZEN_PLAN_DRIFT"
  );
}

export async function prepareGi088CompleteResponseFirstV16BackgroundFactsQuality(
  cwd = process.cwd()
) {
  const startFile = path.join(
    cwd,
    GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.publicStartCard
  );
  if (await pathExists(startFile)) {
    const frozen = JSON.parse(await readFile(startFile, "utf8")) as QualityPlan;
    const current = await createGi088CompleteResponseFirstV16BackgroundFactsQualityPlan(cwd);
    assertGi088CompleteResponseFirstV16FrozenPlan({ frozen, current });
    return frozen;
  }
  const plan = await createGi088CompleteResponseFirstV16BackgroundFactsQualityPlan(cwd);
  assert(
    !(await pathExists(path.join(
      cwd,
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.privateLedger
    ))),
    "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_ORPHAN_PRIVATE_EVIDENCE"
  );
  await writeJsonAtomic(startFile, plan);
  await saveEvidence(cwd, plan, emptyLedger(plan));
  return plan;
}

export async function inspectGi088CompleteResponseFirstV16BackgroundFactsQuality(
  cwd = process.cwd()
) {
  const plan = await prepareGi088CompleteResponseFirstV16BackgroundFactsQuality(cwd);
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
    publicReceipt:
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.publicReceipt,
    privateReview:
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_PATHS.privateReview
  };
}

async function providerForExecution(cwd: string) {
  loadEnvConfig(cwd, true);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_DEEPSEEK_API_KEY_MISSING");
  return new OpenAIProvider({
    apiKey,
    model: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_RUNTIME.timeoutMs
  });
}

async function main() {
  const cwd = process.cwd();
  const command = (
    process.env.GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_COMMAND ??
    process.argv[2] ??
    "prepare"
  ) as Gi088CompleteResponseFirstV16BackgroundFactsQualityCommand;
  assert(
    command === "prepare" || command === "execute-development" ||
      command === "execute-regression" || command === "inspect",
    "GI088_COMPLETE_RESPONSE_BACKGROUND_FACTS_UNKNOWN_COMMAND"
  );
  if (command === "prepare") {
    await prepareGi088CompleteResponseFirstV16BackgroundFactsQuality(cwd);
  } else if (command === "inspect") {
    process.stdout.write(`${JSON.stringify(
      await inspectGi088CompleteResponseFirstV16BackgroundFactsQuality(cwd),
      null,
      2
    )}\n`);
    return;
  } else {
    const plan = await prepareGi088CompleteResponseFirstV16BackgroundFactsQuality(cwd);
    const provider = await providerForExecution(cwd);
    await runGi088CompleteResponseFirstV16BackgroundFactsQualityStage({
      cwd,
      plan,
      split: command === "execute-development" ? "development" : "regression",
      provider
    });
  }
  process.stdout.write(`${JSON.stringify(
    await inspectGi088CompleteResponseFirstV16BackgroundFactsQuality(cwd),
    null,
    2
  )}\n`);
}

export function shouldRunGi088CompleteResponseFirstV16BackgroundFactsQualityCli(input: {
  argv?: string[];
  env?: Partial<NodeJS.ProcessEnv>;
} = {}) {
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;
  return env.VITEST !== "true" && Boolean(
    env.GI088_COMPLETE_RESPONSE_FIRST_V1_6_BACKGROUND_FACTS_QUALITY_COMMAND ||
      argv.some((item) => path.resolve(item) === path.resolve(RUNNER_FILE))
  );
}

if (shouldRunGi088CompleteResponseFirstV16BackgroundFactsQualityCli()) {
  void main().catch((error) => {
    process.stderr.write(`${
      error instanceof Error ? error.stack ?? error.message : String(error)
    }\n`);
    process.exitCode = 1;
  });
}
