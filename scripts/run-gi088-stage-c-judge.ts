import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertExecutionBudget,
  buildRequest,
  decidePlusRoute,
  estimateCostCny,
  parseJudgePrediction,
  scoreMode,
  sha256,
  type GoldItem,
  type JudgePrediction,
  type ScoredPrediction
} from "./gi088-stage-c-judge-core";

type Json = Record<string, unknown>;
type Mode = "normal" | "thinking";
type PrivatePrediction = ScoredPrediction & { rawVisibleOutput: string };
type ArmResult = {
  model: string;
  mode: Mode;
  predictions: PrivatePrediction[];
  calls: number;
  retries: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  reasoningObservedCount: number;
  costCny: number;
  technicalFailures: Array<{ blindId: string; code: string }>;
};

const root = process.cwd();
const base = resolve(root, "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1");
const privateBase = resolve(base, ".private/judge-calibration-v2");
const blindPath = resolve(privateBase, "judge-blind-package.json");
const goldPath = resolve(privateBase, "gold-mapping.json");
const promptPath = resolve(base, "judge-prompt-v1.md");
const authPath = resolve(base, "stage-c-authorization.json");
const globalLedgerPath = resolve(privateBase, "stage-c-global-ledger.json");
const isReal = process.argv.includes("--execute-real");
const isMock = process.argv.includes("--execute-mock");

if (isReal === isMock) {
  console.log(JSON.stringify({ status: "GI088_STAGE_C_INSPECT_ONLY", realRequires: ["--execute-real", "EVENT_CENTERED_JUDGE_QWEN_API_KEY", "EVENT_CENTERED_JUDGE_QWEN_BASE_URL"] }, null, 2));
  process.exit(0);
}

const auth = JSON.parse(readFileSync(authPath, "utf8")) as Json;
const blind = JSON.parse(readFileSync(blindPath, "utf8")) as { items: Json[] };
const prompt = readFileSync(promptPath, "utf8");
const authInputs = auth.inputs as Json;
if (sha256(prompt) !== authInputs.promptSha256) throw new Error("STAGE_C_PROMPT_FINGERPRINT_MISMATCH");
if (sha256(readFileSync(blindPath)) !== authInputs.blindPackageSha256) throw new Error("STAGE_C_BLIND_FINGERPRINT_MISMATCH");
if (blind.items.length !== 20) throw new Error("STAGE_C_BLIND_COUNT_INVALID");

const apiKey = isReal ? process.env.EVENT_CENTERED_JUDGE_QWEN_API_KEY : "mock-secret";
const baseUrl = isReal ? process.env.EVENT_CENTERED_JUDGE_QWEN_BASE_URL : "https://mock.invalid/compatible-mode/v1";
if (!apiKey || !baseUrl) throw new Error("STAGE_C_SECURE_RUNTIME_CREDENTIALS_MISSING");

const runId = `stage-c-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const runDir = resolve(privateBase, "stage-c-runs", runId);
mkdirSync(runDir, { recursive: true, mode: 0o700 });

const existingLedger = isReal
  ? JSON.parse(readFileSync(globalLedgerPath, "utf8")) as { calls: number; retries: number; costCny: number; failedBlindIds: string[] }
  : { calls: 0, retries: 0, costCny: 0, failedBlindIds: [] as string[] };
let totalCalls = existingLedger.calls;
let totalRetries = existingLedger.retries;
let totalCostCny = existingLedger.costCny;
const failedBlindIds = new Set(existingLedger.failedBlindIds);

function persistGlobalLedger(): void {
  if (!isReal) return;
  writeFileSync(globalLedgerPath, JSON.stringify({ schemaVersion: "1.0", calls: totalCalls, retries: totalRetries, costCny: Number(totalCostCny.toFixed(9)), failedBlindIds: [...failedBlindIds] }, null, 2), { mode: 0o600 });
}

function sanitizeCode(error: unknown): string {
  const value = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  return value.replace(/[^A-Z0-9_:.-]/gi, "_").slice(0, 120);
}

function mockPrediction(index: number): JudgePrediction {
  const labels = ["direct_use", "minor_issue", "quality_failure", "single_case_blocker"] as const;
  const blockerTypes = ["correction_ignored", "unsupported_fabrication", "event_boundary", "explicit_stop_ignored", "false_stop"] as const;
  const verdict = labels[Math.floor(index / 5)] ?? "direct_use";
  const isBlocker = verdict === "single_case_blocker";
  return { verdict, isBlocker, blockerType: isBlocker ? blockerTypes[index % 5] : "none", evidence: "最小可见证据", reason: "依据评分尺给出校准结论", confidence: 0.9 };
}

async function invoke(model: string, mode: Mode, item: Json, index: number): Promise<{ prediction: JudgePrediction; rawVisibleOutput: string; latencyMs: number; inputTokens: number; outputTokens: number; reasoningTokens: number; reasoningObserved: boolean }> {
  const request = buildRequest({ model, prompt, item, enableThinking: mode === "thinking" });
  if (isMock) {
    const prediction = mockPrediction(index);
    return { prediction, rawVisibleOutput: JSON.stringify(prediction), latencyMs: 10 + index, inputTokens: 800, outputTokens: 100, reasoningTokens: mode === "thinking" ? 50 : 0, reasoningObserved: mode === "thinking" };
  }
  const started = Date.now();
  const response = await fetch(`${baseUrl!.replace(/\/$/u, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(90_000)
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const payload = await response.json() as Json;
  const choices = payload.choices as Array<{ message?: { content?: string; reasoning_content?: string } }> | undefined;
  const message = choices?.[0]?.message;
  if (!message?.content) throw new Error("VISIBLE_CONTENT_MISSING");
  const usage = (payload.usage ?? {}) as Json;
  return {
    prediction: parseJudgePrediction(message.content),
    rawVisibleOutput: message.content,
    latencyMs: Date.now() - started,
    inputTokens: Number(usage.prompt_tokens ?? 0),
    outputTokens: Number(usage.completion_tokens ?? 0),
    reasoningTokens: Number(((usage.completion_tokens_details ?? {}) as Json).reasoning_tokens ?? usage.reasoning_tokens ?? usage.reasoning_tokens_count ?? 0),
    reasoningObserved: Boolean(message.reasoning_content)
  };
}

async function runArm(model: string, mode: Mode, rates: { input: number; output: number }): Promise<ArmResult> {
  const result: ArmResult = { model, mode, predictions: [], calls: 0, retries: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, reasoningObservedCount: 0, costCny: 0, technicalFailures: [] };
  for (let index = 0; index < blind.items.length; index += 1) {
    const item = blind.items[index];
    const blindId = String(item.blindId);
    let completed = false;
    const firstAttempt = isReal && failedBlindIds.has(blindId) ? 1 : 0;
    for (let attempt = firstAttempt; attempt < 2 && !completed; attempt += 1) {
      assertExecutionBudget({ calls: totalCalls, retries: totalRetries, costCny: totalCostCny, nextIsRetry: attempt === 1 });
      if (attempt === 1) {
        totalRetries += 1;
        result.retries += 1;
      }
      totalCalls += 1;
      result.calls += 1;
      persistGlobalLedger();
      try {
        const response = await invoke(model, mode, item, index);
        const cost = estimateCostCny({ inputTokens: response.inputTokens, outputTokens: response.outputTokens, inputRate: rates.input, outputRate: rates.output });
        totalCostCny += cost;
        result.costCny += cost;
        persistGlobalLedger();
        if (totalCostCny > 10) throw new Error("STAGE_C_COST_CAP_EXCEEDED");
        result.inputTokens += response.inputTokens;
        result.outputTokens += response.outputTokens;
        result.reasoningTokens += response.reasoningTokens;
        result.reasoningObservedCount += response.reasoningObserved ? 1 : 0;
        result.predictions.push({ blindId, prediction: response.prediction, rawVisibleOutput: response.rawVisibleOutput, latencyMs: response.latencyMs });
        failedBlindIds.delete(blindId);
        persistGlobalLedger();
        completed = true;
      } catch (error) {
        failedBlindIds.add(blindId);
        persistGlobalLedger();
        if (attempt === 1 || totalRetries >= 4) result.technicalFailures.push({ blindId, code: sanitizeCode(error) });
      }
    }
    if (!completed) break;
  }
  writeFileSync(resolve(runDir, `${model}-${mode}.json`), JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
  return result;
}

function loadGoldAfterArmCompletion(): GoldItem[] {
  const mapping = JSON.parse(readFileSync(goldPath, "utf8")) as { items: GoldItem[] };
  if (sha256(readFileSync(goldPath)) !== authInputs.goldMappingSha256) throw new Error("STAGE_C_GOLD_FINGERPRINT_MISMATCH");
  return mapping.items;
}

function publicArm(arm: ArmResult, score?: ReturnType<typeof scoreMode>) {
  return { model: arm.model, mode: arm.mode, validResults: arm.predictions.length, calls: arm.calls, retries: arm.retries, inputTokens: arm.inputTokens, outputTokens: arm.outputTokens, reasoningTokens: arm.reasoningTokens, reasoningObservedCount: arm.reasoningObservedCount, costCny: Number(arm.costCny.toFixed(6)), technicalFailureCount: arm.technicalFailures.length, score };
}

async function main() {
  const plusModel = String((auth.route as Json).plusModel);
  const maxModel = String((auth.route as Json).maxModel);
  const normal = await runArm(plusModel, "normal", { input: 2, output: 8 });
  const thinking = await runArm(plusModel, "thinking", { input: 2, output: 8 });
  let status: "Judge qualified" | "Judge No-Go" | "technical_blocked" = "technical_blocked";
  let recommendation: { model: string; mode: Mode } | null = null;
  const publicArms: unknown[] = [];
  if (normal.predictions.length === 20 && thinking.predictions.length === 20) {
    const gold = loadGoldAfterArmCompletion();
    const normalScore = scoreMode(normal.predictions, gold);
    const thinkingScore = scoreMode(thinking.predictions, gold);
    publicArms.push(publicArm(normal, normalScore), publicArm(thinking, thinkingScore));
    const route = decidePlusRoute(normalScore, thinkingScore);
    if (route.action === "qualify") {
      status = "Judge qualified";
      recommendation = { model: plusModel, mode: route.mode };
    } else {
      const better = route.mode;
      const max = await runArm(maxModel, better, { input: 12, output: 36 });
      if (max.predictions.length === 20) {
        const maxScore = scoreMode(max.predictions, gold);
        publicArms.push(publicArm(max, maxScore));
        status = maxScore.qualified ? "Judge qualified" : "Judge No-Go";
        recommendation = maxScore.qualified ? { model: maxModel, mode: better } : null;
      } else {
        publicArms.push(publicArm(max));
      }
    }
  } else {
    publicArms.push(publicArm(normal), publicArm(thinking));
  }
  const receipt = { schemaVersion: "1.0", runId, status, recommendation, arms: publicArms, totals: { calls: totalCalls, retries: totalRetries, costCny: Number(totalCostCny.toFixed(6)) }, conclusionBoundary: "仅判断 Judge 配置能否承担 GI-088 初评；独立准入、人工评分、Preview 和 Production 保持关闭。" };
  writeFileSync(resolve(runDir, "sealed-private-receipt.json"), JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 });
  const publicReceiptName = isMock ? "stage-c-mock-validation-receipt.json" : "stage-c-calibration-receipt.json";
  writeFileSync(resolve(base, publicReceiptName), JSON.stringify({ ...receipt, runId: sha256(runId).slice(0, 16) }, null, 2));
  console.log(JSON.stringify({ status, recommendation, totals: receipt.totals }, null, 2));
}

main().catch((error) => {
  const blocked = { status: "technical_blocked", code: sanitizeCode(error), calls: totalCalls, retries: totalRetries, costCny: Number(totalCostCny.toFixed(6)) };
  writeFileSync(resolve(runDir, "technical-blocked.json"), JSON.stringify(blocked, null, 2), { flag: "wx", mode: 0o600 });
  console.error(JSON.stringify(blocked, null, 2));
  process.exitCode = 1;
});
