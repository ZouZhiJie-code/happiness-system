import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  attemptKey,
  buildStrictRequest,
  classifyHttpStatus,
  decidePlusRoute,
  estimateCostCny,
  executeArm,
  parseJudgePrediction,
  scoreMode,
  sha256,
  type ArmExecution,
  type AttemptIdentity,
  type AttemptOutcome,
  type BlindItem,
  type ExecutionBudget,
  type GoldItem,
  type JudgePrediction,
  type Mode,
  type TokenUsage
} from "./gi088-stage-c2-judge-core";

type Json = Record<string, unknown>;
type Price = { input: number; output: number };

const projectRoot = process.cwd();
const artifactBase = resolve(
  projectRoot,
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1"
);
const privateBase = resolve(artifactBase, ".private/judge-calibration-v2");
const blindPath = resolve(privateBase, "judge-blind-package.json");
const goldPath = resolve(privateBase, "gold-mapping.json");
const promptPath = resolve(artifactBase, "judge-prompt-v1.md");
const responseSchemaPath = resolve(artifactBase, "stage-c2-response-schema.json");
const authorizationPath = resolve(artifactBase, "stage-c2-authorization.json");
const executeReal = process.argv.includes("--execute-real");
const executeMock = process.argv.includes("--execute-mock");

if (executeReal === executeMock) {
  console.log(
    JSON.stringify(
      {
        status: "GI088_STAGE_C2_INSPECT_ONLY",
        executionVersion: "2026-08-13.gi088-stage-c2-runner-v1",
        realRequirements: [
          "--execute-real",
          "EVENT_CENTERED_JUDGE_QWEN_API_KEY",
          "EVENT_CENTERED_JUDGE_QWEN_BASE_URL"
        ]
      },
      null,
      2
    )
  );
  process.exit(0);
}

function json(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8")) as Json;
}

function sanitize(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? "UNKNOWN");
  return text.replace(/sk-[A-Za-z0-9._-]+/gu, "[REDACTED]").replace(/[\r\n]+/gu, " ").slice(0, 300);
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
}

function writeImmutableJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2), { flag: "wx", mode: 0o600 });
}

function writeAtomicJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(temporaryPath, path);
}

function usageFrom(payload: Json): TokenUsage {
  const usage = (payload.usage ?? {}) as Json;
  const details = (usage.completion_tokens_details ?? {}) as Json;
  return {
    inputTokens: Number(usage.prompt_tokens ?? 0),
    outputTokens: Number(usage.completion_tokens ?? 0),
    reasoningTokens: Number(details.reasoning_tokens ?? usage.reasoning_tokens ?? 0)
  };
}

function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
}

function providerRequestId(response: Response, payload: Json | null): string | null {
  const header = response.headers.get("x-request-id") ?? response.headers.get("request-id");
  const payloadId = payload && typeof payload.id === "string" ? payload.id : null;
  return header ?? payloadId;
}

function errorCauseCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return null;
  const code = (cause as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

const authorization = json(authorizationPath);
const authorizationInputs = authorization.inputs as Json;
const blindPackage = json(blindPath) as { items?: BlindItem[] };
const rawBlindItems = blindPackage.items;
const prompt = readFileSync(promptPath, "utf8");
const responseSchema = json(responseSchemaPath);
if (!Array.isArray(rawBlindItems) || rawBlindItems.length !== 20) throw new Error("STAGE_C2_BLIND_COUNT_INVALID");
const blindItems: BlindItem[] = rawBlindItems;
if (sha256(readFileSync(blindPath)) !== authorizationInputs.blindPackageSha256) throw new Error("STAGE_C2_BLIND_FINGERPRINT_MISMATCH");
if (sha256(prompt) !== authorizationInputs.promptSha256) throw new Error("STAGE_C2_PROMPT_FINGERPRINT_MISMATCH");
if (sha256(readFileSync(responseSchemaPath)) !== authorizationInputs.responseSchemaSha256) throw new Error("STAGE_C2_SCHEMA_FINGERPRINT_MISMATCH");

const route = authorization.route as Json;
const plusModel = String(route.plusModel);
const maxModel = String(route.maxModel);
const runId = `stage-c2-${new Date().toISOString().replace(/[:.]/gu, "-")}`;
const runKind = executeReal ? "real" : "mock";
const runBase = resolve(privateBase, executeReal ? "stage-c2-real-runs" : "stage-c2-mock-runs");
const runDir = resolve(runBase, runId);
const attemptsDir = resolve(runDir, "attempts");
ensureDir(attemptsDir);

const budget: ExecutionBudget = {
  calls: 0,
  retries: 0,
  knownCostCny: 0,
  maximumCalls: 64,
  maximumRetries: 4,
  maximumCostCny: 10
};
let reasoningObservedCount = 0;
let goldLoaded = false;
let activePrice: Price = { input: 2, output: 8 };

const apiKey = executeReal ? process.env.EVENT_CENTERED_JUDGE_QWEN_API_KEY : "mock-only";
const baseUrl = executeReal
  ? process.env.EVENT_CENTERED_JUDGE_QWEN_BASE_URL
  : "https://mock.invalid/compatible-mode/v1";
if (!apiKey || !baseUrl) throw new Error("STAGE_C2_SECURE_RUNTIME_CREDENTIALS_MISSING");

writeImmutableJson(resolve(runDir, "run-identity.json"), {
  schemaVersion: "1.0",
  runId,
  runKind,
  executionVersion: "2026-08-13.gi088-stage-c2-runner-v1",
  authorizationVersion: authorization.authorizationVersion,
  judgeDatasetVersion: authorizationInputs.judgeDatasetVersion,
  blindPackageSha256: authorizationInputs.blindPackageSha256,
  promptSha256: authorizationInputs.promptSha256,
  responseSchemaSha256: authorizationInputs.responseSchemaSha256,
  endpointHost: new URL(baseUrl).hostname,
  endpointIdentitySha256: sha256(baseUrl),
  budget: { maximumCalls: 64, maximumRetries: 4, maximumCostCny: 10 },
  historicalEvidenceReused: 0,
  startedAt: new Date().toISOString()
});

function persistBudget(): void {
  writeAtomicJson(resolve(runDir, "budget-ledger.json"), {
    schemaVersion: "1.0",
    calls: budget.calls,
    retries: budget.retries,
    knownCostCny: Number(budget.knownCostCny.toFixed(9)),
    reasoningObservedCount
  });
}

function attemptPath(identity: AttemptIdentity, suffix: string): string {
  return resolve(attemptsDir, `${attemptKey(identity)}.${suffix}.json`);
}

function mockPrediction(index: number): JudgePrediction {
  return {
    verdict: index % 4 === 0 ? "minor_issue" : "direct_use",
    isBlocker: false,
    blockerType: "none",
    evidence: "模拟可见证据",
    reason: "模拟结构化结果仅用于运行器验收",
    confidence: 0.9
  };
}

async function invokeMock(identity: AttemptIdentity, item: BlindItem): Promise<AttemptOutcome> {
  writeImmutableJson(attemptPath(identity, "dispatch"), { identity, requestFingerprint: sha256(JSON.stringify(item)), dispatchedAt: new Date().toISOString() });
  const index = blindItems.findIndex((candidate) => candidate.blindId === item.blindId);
  let outcome: AttemptOutcome;
  if (identity.mode === "normal" && item.blindId === "CAL-001" && identity.attemptOrdinal === 1) {
    outcome = { kind: "retryable_failure", code: "FETCH_FAILED", latencyMs: 2, usage: emptyUsage(), costCny: 0 };
  } else if (identity.mode === "normal" && item.blindId === "CAL-002") {
    outcome = { kind: "retryable_failure", code: "JUDGE_SCHEMA_INVALID", latencyMs: 3, usage: { inputTokens: 10, outputTokens: 5, reasoningTokens: 0 }, costCny: 0.00006 };
  } else {
    outcome = { kind: "valid", prediction: mockPrediction(index), latencyMs: 4, usage: { inputTokens: 10, outputTokens: 5, reasoningTokens: identity.mode === "thinking" ? 2 : 0 }, costCny: 0.00006 };
  }
  writeImmutableJson(attemptPath(identity, "result"), { identity, outcome, completedAt: new Date().toISOString() });
  persistBudget();
  return outcome;
}

async function invokeReal(identity: AttemptIdentity, item: BlindItem): Promise<AttemptOutcome> {
  const request = buildStrictRequest({ model: identity.model, prompt, item, enableThinking: identity.mode === "thinking", responseSchema });
  writeImmutableJson(attemptPath(identity, "dispatch"), {
    identity,
    requestFingerprint: sha256(JSON.stringify(request)),
    responseFormat: "strict_json_schema",
    outputTokenLimit: "omitted",
    dispatchedAt: new Date().toISOString()
  });
  persistBudget();
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${baseUrl!.replace(/\/$/u, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(300_000)
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const outcome: AttemptOutcome = { kind: "retryable_failure", code: "FETCH_FAILED", latencyMs, usage: emptyUsage(), costCny: 0 };
    writeImmutableJson(attemptPath(identity, "result"), {
      identity,
      outcome,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: sanitize(error),
      causeCode: errorCauseCode(error),
      completedAt: new Date().toISOString()
    });
    return outcome;
  }

  const latencyMs = Date.now() - startedAt;
  const rawHttpBody = await response.text();
  let payload: Json | null = null;
  try {
    payload = JSON.parse(rawHttpBody) as Json;
  } catch {
    const outcome: AttemptOutcome = { kind: "retryable_failure", code: "PROVIDER_ENVELOPE_JSON_INVALID", latencyMs, usage: emptyUsage(), costCny: 0 };
    writeImmutableJson(attemptPath(identity, "response"), {
      identity,
      httpStatus: response.status,
      providerRequestId: providerRequestId(response, null),
      rawBodySha256: sha256(rawHttpBody),
      rawBodyLength: rawHttpBody.length,
      reasoningBodyPersisted: false,
      receivedAt: new Date().toISOString()
    });
    writeImmutableJson(attemptPath(identity, "result"), { identity, outcome, completedAt: new Date().toISOString() });
    return outcome;
  }

  const usage = usageFrom(payload);
  const costCny = estimateCostCny({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, inputRate: activePrice.input, outputRate: activePrice.output });
  const choices = payload.choices as Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }> | undefined;
  const message = choices?.[0]?.message;
  const rawVisibleOutput = typeof message?.content === "string" ? message.content : "";
  const reasoningObserved = Boolean(message?.reasoning_content);
  if (reasoningObserved) reasoningObservedCount += 1;
  const providerModel = typeof payload.model === "string" ? payload.model : null;
  const errorObject = (payload.error ?? {}) as Json;
  writeImmutableJson(attemptPath(identity, "response"), {
    identity,
    httpStatus: response.status,
    providerRequestId: providerRequestId(response, payload),
    providerModel,
    finishReason: choices?.[0]?.finish_reason ?? null,
    visibleOutput: rawVisibleOutput,
    visibleOutputSha256: sha256(rawVisibleOutput),
    visibleOutputLength: rawVisibleOutput.length,
    reasoningObserved,
    reasoningBodyPersisted: false,
    usage,
    costCny,
    providerErrorCode: typeof errorObject.code === "string" ? errorObject.code : null,
    providerErrorMessage: typeof errorObject.message === "string" ? sanitize(errorObject.message) : null,
    receivedAt: new Date().toISOString()
  });

  function outcome(kind: AttemptOutcome["kind"], code: string): AttemptOutcome {
    return { kind, code, latencyMs, usage, costCny } as AttemptOutcome;
  }

  let result: AttemptOutcome;
  const httpDisposition = classifyHttpStatus(response.status);
  if (httpDisposition.kind !== "success") {
    result = outcome(httpDisposition.kind, httpDisposition.code);
  } else if (providerModel && providerModel !== identity.model) {
    result = outcome("fatal_failure", "PROVIDER_MODEL_MISMATCH");
  } else if (!rawVisibleOutput) {
    result = outcome("retryable_failure", "VISIBLE_CONTENT_MISSING");
  } else {
    try {
      const prediction = parseJudgePrediction(rawVisibleOutput);
      result = { kind: "valid", prediction, latencyMs, usage, costCny };
    } catch (error) {
      result = outcome("retryable_failure", sanitize(error));
    }
  }
  writeImmutableJson(attemptPath(identity, "result"), { identity, outcome: result, completedAt: new Date().toISOString() });
  persistBudget();
  return result;
}

async function onLocalFault(identity: AttemptIdentity, error: unknown): Promise<void> {
  writeImmutableJson(attemptPath(identity, "local-fault"), {
    identity,
    code: "LOCAL_RUNNER_FAULT",
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: sanitize(error),
    modelRetryConsumed: false,
    recordedAt: new Date().toISOString()
  });
}

function publicArm(arm: ArmExecution, score?: ReturnType<typeof scoreMode>): Json {
  const latencies = arm.valid.map((item) => item.latencyMs).sort((a, b) => a - b);
  const medianLatencyMs = latencies.length === 0
    ? null
    : latencies.length % 2 === 1
      ? latencies[Math.floor(latencies.length / 2)]
      : (latencies[latencies.length / 2 - 1] + latencies[latencies.length / 2]) / 2;
  return {
    model: arm.model,
    mode: arm.mode,
    plannedCount: arm.plannedCount,
    validCount: arm.valid.length,
    technicalFailedCount: arm.technicalFailed.length,
    notRunCount: arm.notRun.length,
    calls: arm.calls,
    retries: arm.retries,
    inputTokens: arm.usage.inputTokens,
    outputTokens: arm.usage.outputTokens,
    reasoningTokens: arm.usage.reasoningTokens,
    knownCostCny: Number(arm.knownCostCny.toFixed(6)),
    medianLatencyMs,
    fatalCode: arm.fatalCode,
    score: score ?? null
  };
}

function loadGold(): GoldItem[] {
  goldLoaded = true;
  if (sha256(readFileSync(goldPath)) !== authorizationInputs.goldMappingSha256) {
    throw new Error("STAGE_C2_GOLD_FINGERPRINT_MISMATCH");
  }
  const mapping = json(goldPath) as { items?: GoldItem[] };
  if (!Array.isArray(mapping.items) || mapping.items.length !== 20) throw new Error("STAGE_C2_GOLD_COUNT_INVALID");
  return mapping.items;
}

async function main(): Promise<void> {
  const invoke = executeReal ? invokeReal : invokeMock;
  activePrice = { input: 2, output: 8 };
  const normal = await executeArm({ runId, model: plusModel, mode: "normal", items: blindItems, budget, invoke, onLocalFault });
  persistBudget();
  writeImmutableJson(resolve(runDir, "plus-normal-arm.json"), normal);
  if (normal.fatalCode) return sealTechnicalBlocked([normal]);

  const thinking = await executeArm({ runId, model: plusModel, mode: "thinking", items: blindItems, budget, invoke, onLocalFault });
  persistBudget();
  writeImmutableJson(resolve(runDir, "plus-thinking-arm.json"), thinking);
  if (thinking.fatalCode) return sealTechnicalBlocked([normal, thinking]);

  if (executeMock) {
    const assertions = {
      normalContinuedAfterFailure: normal.valid.length === 19 && normal.technicalFailed.length === 1 && normal.notRun.length === 0,
      normalRetriesIsolated: normal.retries === 2,
      thinkingUnaffectedByNormalFailures: thinking.valid.length === 20 && thinking.retries === 0,
      goldNotLoadedDuringMock: goldLoaded === false,
      simulationAndRealDirectoriesSeparated: runDir.includes("stage-c2-mock-runs")
    };
    const passed = Object.values(assertions).every((value) => value === true);
    const receipt = {
      schemaVersion: "1.0",
      status: passed ? "simulation_pass" : "simulation_failed",
      executionKind: "mock",
      officialQualityEvidence: false,
      assertions,
      arms: [publicArm(normal), publicArm(thinking)],
      totals: { calls: budget.calls, retries: budget.retries, knownCostCny: Number(budget.knownCostCny.toFixed(6)) },
      goldLoaded,
      privateContentExported: 0
    };
    writeImmutableJson(resolve(runDir, "sealed-mock-receipt.json"), receipt);
    writeAtomicJson(resolve(artifactBase, "stage-c2-mock-validation-receipt.json"), receipt);
    console.log(JSON.stringify({ status: receipt.status, totals: receipt.totals }, null, 2));
    if (!passed) process.exitCode = 1;
    return;
  }

  if (normal.valid.length !== 20 || thinking.valid.length !== 20) {
    return sealTechnicalBlocked([normal, thinking]);
  }

  const gold = loadGold();
  const normalScore = scoreMode(normal.valid, gold);
  const thinkingScore = scoreMode(thinking.valid, gold);
  const routeDecision = decidePlusRoute(normalScore, thinkingScore);
  const arms: Array<{ arm: ArmExecution; score?: ReturnType<typeof scoreMode> }> = [
    { arm: normal, score: normalScore },
    { arm: thinking, score: thinkingScore }
  ];
  let status: "Judge qualified" | "Judge No-Go" | "technical_blocked";
  let recommendation: { model: string; mode: Mode } | null = null;

  if (routeDecision.action === "qualify") {
    status = "Judge qualified";
    recommendation = { model: plusModel, mode: routeDecision.mode };
  } else {
    activePrice = { input: 12, output: 36 };
    const maxArm = await executeArm({ runId, model: maxModel, mode: routeDecision.mode, items: blindItems, budget, invoke, onLocalFault });
    persistBudget();
    writeImmutableJson(resolve(runDir, "max-arm.json"), maxArm);
    if (maxArm.fatalCode || maxArm.valid.length !== 20) {
      arms.push({ arm: maxArm });
      return sealTechnicalBlocked(arms.map((entry) => entry.arm), arms);
    }
    const maxScore = scoreMode(maxArm.valid, gold);
    arms.push({ arm: maxArm, score: maxScore });
    status = maxScore.qualified ? "Judge qualified" : "Judge No-Go";
    recommendation = maxScore.qualified ? { model: maxModel, mode: routeDecision.mode } : null;
  }

  sealRealReceipt(status, recommendation, arms);
}

function sealTechnicalBlocked(
  arms: ArmExecution[],
  scoredArms: Array<{ arm: ArmExecution; score?: ReturnType<typeof scoreMode> }> = arms.map((arm) => ({ arm }))
): void {
  sealRealReceipt("technical_blocked", null, scoredArms);
}

function sealRealReceipt(
  status: "Judge qualified" | "Judge No-Go" | "technical_blocked",
  recommendation: { model: string; mode: Mode } | null,
  arms: Array<{ arm: ArmExecution; score?: ReturnType<typeof scoreMode> }>
): void {
  const receipt = {
    schemaVersion: "1.0",
    executionVersion: "2026-08-13.gi088-stage-c2-runner-v1",
    runId: sha256(runId).slice(0, 16),
    status,
    recommendation,
    identity: {
      region: "cn-beijing",
      judgeDatasetVersion: authorizationInputs.judgeDatasetVersion,
      blindPackageSha256: authorizationInputs.blindPackageSha256,
      promptSha256: authorizationInputs.promptSha256,
      responseSchemaSha256: authorizationInputs.responseSchemaSha256,
      runnerSha256: authorizationInputs.runnerSha256,
      scoringCoreSha256: authorizationInputs.scoringCoreSha256,
      historicalEvidenceReused: 0
    },
    arms: arms.map((entry) => publicArm(entry.arm, entry.score)),
    totals: {
      calls: budget.calls,
      retries: budget.retries,
      knownCostCny: Number(budget.knownCostCny.toFixed(6)),
      reasoningObservedCount
    },
    goldLoaded,
    privacy: {
      reasoningBodiesPersisted: 0,
      credentialPersisted: false,
      publicCardBodies: 0,
      publicGoldItems: 0
    },
    conclusionBoundary: "只判断 Judge 配置能否承担 GI-088 初评；独立准入、人工评分、Preview 和 Production 保持关闭。"
  };
  writeImmutableJson(resolve(runDir, "sealed-real-receipt.json"), receipt);
  writeAtomicJson(resolve(artifactBase, "stage-c2-calibration-receipt.json"), receipt);
  console.log(JSON.stringify({ status, recommendation, totals: receipt.totals }, null, 2));
}

main().catch((error) => {
  const receipt = {
    schemaVersion: "1.0",
    status: "technical_blocked",
    code: "LOCAL_RUNNER_FAULT",
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: sanitize(error),
    calls: budget.calls,
    retries: budget.retries,
    knownCostCny: Number(budget.knownCostCny.toFixed(6)),
    goldLoaded,
    recordedAt: new Date().toISOString()
  };
  try {
    writeImmutableJson(resolve(runDir, "terminal-local-fault.json"), receipt);
  } catch {
    // The original local fault remains the primary evidence when the filesystem is unavailable.
  }
  console.error(JSON.stringify(receipt, null, 2));
  process.exitCode = 1;
});
