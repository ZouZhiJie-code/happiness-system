import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AIProvider
} from "../src/server/services/ai/ai-provider";
import {
  createGi088EffectiveCandidateFingerprint,
  getGi088CandidateAssets,
  verifyGi088CandidateSnapshot
} from "../src/server/services/evaluation/gi088/candidate";
import {
  parseGi088SemanticDeltaOutput,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput
} from "../src/server/services/evaluation/gi088/semantic-delta";
import {
  createGi088StageTransitionUserPrompt,
  validateGi088StageTransitionOutput
} from "../src/server/services/evaluation/gi088/stage-transition";

export const GI088_SENTINEL_BASELINE_IDENTITY = "2026-08-16.gi088-real-problem-sentinel-baseline-v1";
export const GI088_SENTINEL_BASELINE_BUDGET = 9;
export const GI088_SENTINEL_BASELINE_EXPECTED = {
  standardSha256: "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60",
  datasetVersion: "2026-08-16.gi088-real-problem-regression-v1.1",
  datasetFingerprint: "f036425de2d60f9af81424bc2528ac80a3dd25be654888d6a3ed0865ab73dded",
  reviewPacketFingerprint: "54b0c91aa9be3da5084113390e4799cf775d4f39a4b041732fce6f48b1846522",
  candidateFingerprint: "0d5f91c0142df15035cd665a4a782f5207c4df48ef242e072452653c77b2efd6",
  immutableCommit: "5281bc53f2b04be9c31adb6d7f4710ac818883a8",
  immutableManifestSha256: "42510166933d482a4ce2ea616a101ea354c16c73b833f09212ee3559eab4009d",
  behaviorManifestSha256: "90e56ba00a34b160ea7d836e306f3dd2dc8f09ab435f71881b76f17eddec3c67",
  datasetReceiptSha256: "32011deee3e96074717781a8704599cc877d926053ed537ae458fe5c2b8680cc",
  privateCasesSha256: "53ec67c6e01b847492397dab0efca47f0df012251cae1930ff34a28c717ba95a",
  model: "deepseek-v4-pro",
  responseFormat: "json_object",
  reasoningEffort: "high",
  hardTimeoutMs: 120_000
} as const;

const ROOT = "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_ROOT = `${ROOT}/.private/real-problem-sentinel-baseline-v1`;
const PUBLIC_RECEIPT = `${ROOT}/real-problem-sentinel-baseline-v1-receipt.json`;
const IMMUTABLE_MANIFEST = "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json";
const BEHAVIOR_MANIFEST = "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json";
const SEALED_DATASET_RECEIPT = `${ROOT}/real-problem-regression-v1.1-receipt.json`;
const SEALED_PRIVATE_CASES = `${ROOT}/.private/real-problem-regression-v1.1/regression-cases.json`;

export type Gi088SentinelTechnicalStatus = "valid" | "technical_failure" | "contract_failure";
export type Gi088SentinelCallResult = {
  order: number;
  caseId: string;
  principleId: string;
  caseFingerprint: string;
  requestHash: string;
  startedAt: string;
  completedAt: string;
  status: Gi088SentinelTechnicalStatus;
  httpStatus: number | null;
  responseModel: string | null;
  latencyMs: number | null;
  responseHash: string | null;
  responseLength: number;
  visibleText: string | null;
  rawOutput: string | null;
  parsedOutput: unknown | null;
  validationIssues: string[];
  errorCode: string | null;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

export type Gi088SentinelBaselinePlan = {
  identity: typeof GI088_SENTINEL_BASELINE_IDENTITY;
  planFingerprint: string;
  datasetVersion: string;
  datasetFingerprint: string;
  reviewPacketFingerprint: string;
  candidateFingerprint: string;
  immutableCommit: string;
  standardSha256: string;
  runtime: {
    model: string;
    thinking: "enabled";
    reasoningEffort: "high";
    responseFormat: "json_object";
    headersTimeoutMs: 15_000;
    bodyIdleTimeoutMs: 45_000;
    hardTimeoutMs: 120_000;
    concurrency: 1;
    retries: 0;
    callBudget: 9;
  };
  sentinelSetFingerprint: string;
  sentinels: Gi088RealProblemRegressionCase[];
};

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

async function fileSha(cwd: string, relativePath: string) {
  return sha(await readFile(path.join(cwd, relativePath)));
}

export async function createGi088SentinelBaselinePlan(cwd = process.cwd()): Promise<Gi088SentinelBaselinePlan> {
  const standardSha256 = await fileSha(cwd, "docs/ai-evaluation-standard.md");
  assert(standardSha256 === GI088_SENTINEL_BASELINE_EXPECTED.standardSha256, "GI088_SENTINEL_STANDARD_SHA_MISMATCH");
  assert(await fileSha(cwd, IMMUTABLE_MANIFEST) === GI088_SENTINEL_BASELINE_EXPECTED.immutableManifestSha256, "GI088_SENTINEL_IMMUTABLE_MANIFEST_DRIFT");
  assert(await fileSha(cwd, BEHAVIOR_MANIFEST) === GI088_SENTINEL_BASELINE_EXPECTED.behaviorManifestSha256, "GI088_SENTINEL_BEHAVIOR_MANIFEST_DRIFT");
  const immutable = JSON.parse(await readFile(path.join(cwd, IMMUTABLE_MANIFEST), "utf8")) as Record<string, unknown>;
  const evidence = immutable.immutableEvidence as Record<string, unknown>;
  assert(evidence.commit === GI088_SENTINEL_BASELINE_EXPECTED.immutableCommit, "GI088_SENTINEL_IMMUTABLE_COMMIT_MISMATCH");
  assert(evidence.effectiveCandidateFingerprint === GI088_SENTINEL_BASELINE_EXPECTED.candidateFingerprint, "GI088_SENTINEL_IMMUTABLE_CANDIDATE_MISMATCH");
  verifyGi088CandidateSnapshot();
  assert(createGi088EffectiveCandidateFingerprint() === GI088_SENTINEL_BASELINE_EXPECTED.candidateFingerprint, "GI088_SENTINEL_CANDIDATE_DRIFT");

  assert(await fileSha(cwd, SEALED_DATASET_RECEIPT) === GI088_SENTINEL_BASELINE_EXPECTED.datasetReceiptSha256, "GI088_SENTINEL_DATASET_RECEIPT_DRIFT");
  assert(await fileSha(cwd, SEALED_PRIVATE_CASES) === GI088_SENTINEL_BASELINE_EXPECTED.privateCasesSha256, "GI088_SENTINEL_PRIVATE_CASES_DRIFT");
  const receipt = JSON.parse(await readFile(path.join(cwd, SEALED_DATASET_RECEIPT), "utf8")) as {
    receiptVersion: string;
    datasetFingerprint: string;
    reviewPacketFingerprint: string;
  };
  assert(receipt.receiptVersion === GI088_SENTINEL_BASELINE_EXPECTED.datasetVersion, "GI088_SENTINEL_DATASET_VERSION_MISMATCH");
  assert(receipt.datasetFingerprint === GI088_SENTINEL_BASELINE_EXPECTED.datasetFingerprint, "GI088_SENTINEL_DATASET_FINGERPRINT_MISMATCH");
  assert(receipt.reviewPacketFingerprint === GI088_SENTINEL_BASELINE_EXPECTED.reviewPacketFingerprint, "GI088_SENTINEL_REVIEW_PACKET_FINGERPRINT_MISMATCH");
  const cases = JSON.parse(await readFile(path.join(cwd, SEALED_PRIVATE_CASES), "utf8")) as Gi088RealProblemRegressionCase[];
  const sentinels = cases.filter((item) => item.evaluation.sentinel);
  assert(sentinels.length === GI088_SENTINEL_BASELINE_BUDGET, "GI088_SENTINEL_COUNT_MISMATCH");
  assert(new Set(sentinels.map((item) => item.evaluation.primaryPrincipleId)).size === 9, "GI088_SENTINEL_PRINCIPLE_COVERAGE_MISMATCH");
  const sentinelSetFingerprint = sha(canonicalJson(sentinels.map((item) => ({
    caseId: item.caseId,
    caseFingerprint: item.caseFingerprint,
    primaryPrincipleId: item.evaluation.primaryPrincipleId
  }))));
  const runtime = {
    model: GI088_SENTINEL_BASELINE_EXPECTED.model,
    thinking: "enabled" as const,
    reasoningEffort: "high" as const,
    responseFormat: "json_object" as const,
    headersTimeoutMs: 15_000 as const,
    bodyIdleTimeoutMs: 45_000 as const,
    hardTimeoutMs: GI088_SENTINEL_BASELINE_EXPECTED.hardTimeoutMs,
    concurrency: 1 as const,
    retries: 0 as const,
    callBudget: GI088_SENTINEL_BASELINE_BUDGET as 9
  };
  const core: Omit<Gi088SentinelBaselinePlan, "planFingerprint" | "sentinels"> = {
    identity: GI088_SENTINEL_BASELINE_IDENTITY,
    datasetVersion: receipt.receiptVersion,
    datasetFingerprint: receipt.datasetFingerprint,
    reviewPacketFingerprint: receipt.reviewPacketFingerprint,
    candidateFingerprint: GI088_SENTINEL_BASELINE_EXPECTED.candidateFingerprint,
    immutableCommit: GI088_SENTINEL_BASELINE_EXPECTED.immutableCommit,
    standardSha256,
    runtime,
    sentinelSetFingerprint
  };
  return { ...core, planFingerprint: sha(canonicalJson(core)), sentinels };
}

export async function assertGi088SentinelModelAvailable(input: {
  apiKey: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${input.apiKey}` },
      cache: "no-store",
      signal: controller.signal
    });
    if (response.status === 401 || response.status === 403) throw new Error("GI088_SENTINEL_AUTHENTICATION_FAILED");
    if (!response.ok) throw new Error(`GI088_SENTINEL_MODELS_HTTP_${response.status}`);
    const payload = await response.json() as { data?: Array<{ id?: unknown }> };
    const models = Array.isArray(payload.data)
      ? payload.data.map((item) => typeof item.id === "string" ? item.id : "").filter(Boolean)
      : [];
    assert(models.includes(GI088_SENTINEL_BASELINE_EXPECTED.model), "GI088_SENTINEL_TARGET_MODEL_MISSING");
    return { httpStatus: response.status, targetModelAvailable: true, modelListHash: sha(canonicalJson(models.sort())) };
  } finally {
    clearTimeout(timeout);
  }
}

function toTurnInput(item: Gi088RealProblemRegressionCase): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: item.candidateInput.messages,
    latestUserMessageId: item.candidateInput.messages.at(-1)!.id,
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

function collectEvidenceRefs(output: ReturnType<typeof parseGi088SemanticDeltaOutput>) {
  const semantic = output.semantic;
  return [
    ...(semantic.workingTask?.evidenceRefs ?? []),
    ...(semantic.understandingChange.kind === "none" ? [] : semantic.understandingChange.evidenceRefs),
    ...semantic.returnableTaskDelta.add.flatMap((item) => item.evidenceRefs),
    ...(semantic.nextInquiry?.evidenceRefs ?? []),
    ...(semantic.burdenSignalChange.kind === "set" ? semantic.burdenSignalChange.evidenceRefs : [])
  ];
}

export function classifyGi088SentinelValidationIssues(issues: string[]) {
  const semanticOnlyIssues = issues.filter((issue) => issue.startsWith("ASK_QUESTION_COUNT_INVALID:"));
  const blockingIssues = issues.filter((issue) => !issue.startsWith("ASK_QUESTION_COUNT_INVALID:"));
  return {
    blockingIssues,
    semanticOnlyIssues,
    status: blockingIssues.length ? "contract_failure" as const : "valid" as const
  };
}

export async function runGi088SentinelCalls(input: {
  plan: Gi088SentinelBaselinePlan;
  provider: AIProvider;
  onResult?: (result: Gi088SentinelCallResult) => Promise<void> | void;
}) {
  const results: Gi088SentinelCallResult[] = [];
  for (const [index, item] of input.plan.sentinels.entries()) {
    assert(results.length < input.plan.runtime.callBudget, "GI088_SENTINEL_CALL_BUDGET_EXCEEDED");
    const turnInput = toTurnInput(item);
    const params = {
      messages: [
        { role: "system" as const, content: getGi088CandidateAssets().systemPrompt },
        { role: "user" as const, content: createGi088StageTransitionUserPrompt(turnInput) }
      ],
      useProviderDefaultMaxTokens: true,
      headersTimeoutMs: input.plan.runtime.headersTimeoutMs,
      bodyIdleTimeoutMs: input.plan.runtime.bodyIdleTimeoutMs,
      hardTimeoutMs: input.plan.runtime.hardTimeoutMs,
      timeoutMs: input.plan.runtime.hardTimeoutMs,
      responseFormat: input.plan.runtime.responseFormat,
      thinking: input.plan.runtime.thinking,
      reasoningEffort: input.plan.runtime.reasoningEffort
    };
    const startedAt = new Date().toISOString();
    const requestHash = sha(canonicalJson(params));
    let result: Gi088SentinelCallResult;
    try {
      const completion = await input.provider.complete(params);
      const diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
      try {
        const output = parseGi088SemanticDeltaOutput(completion.content);
        const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(turnInput, output);
        const messageIds = new Set(turnInput.conversation.map((message) => message.id));
        const unknownSourceRefs = collectEvidenceRefs(output).filter((ref) => !messageIds.has(ref));
        const observedIssues = [...new Set([
          ...validateGi088SemanticDeltaOutput({ input: turnInput, output }),
          ...validateGi088StageTransitionOutput({ input: turnInput, output: compatibility }),
          ...unknownSourceRefs.map((ref) => `UNKNOWN_SOURCE_REF:${ref}`)
        ])];
        const visibleText = [output.visible.understanding, output.visible.response].filter(Boolean).join("\n").trim();
        if (!visibleText) observedIssues.push("VISIBLE_TEXT_EMPTY");
        const classification = classifyGi088SentinelValidationIssues(observedIssues);
        result = {
          order: index + 1,
          caseId: item.caseId,
          principleId: item.evaluation.primaryPrincipleId,
          caseFingerprint: item.caseFingerprint,
          requestHash,
          startedAt,
          completedAt: new Date().toISOString(),
          status: classification.status,
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel: diagnostics?.responseModel ?? GI088_SENTINEL_BASELINE_EXPECTED.model,
          latencyMs: diagnostics?.latencyMs ?? completion.latencyMs,
          responseHash: sha(completion.content),
          responseLength: completion.content.length,
          visibleText,
          rawOutput: completion.content,
          parsedOutput: output,
          validationIssues: [...classification.blockingIssues, ...classification.semanticOnlyIssues],
          errorCode: classification.blockingIssues.length ? "GI088_SENTINEL_CONTRACT_INVALID" : null,
          diagnostics
        };
      } catch (error) {
        result = {
          order: index + 1,
          caseId: item.caseId,
          principleId: item.evaluation.primaryPrincipleId,
          caseFingerprint: item.caseFingerprint,
          requestHash,
          startedAt,
          completedAt: new Date().toISOString(),
          status: "contract_failure",
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel: diagnostics?.responseModel ?? GI088_SENTINEL_BASELINE_EXPECTED.model,
          latencyMs: diagnostics?.latencyMs ?? completion.latencyMs,
          responseHash: sha(completion.content),
          responseLength: completion.content.length,
          visibleText: null,
          rawOutput: completion.content,
          parsedOutput: null,
          validationIssues: [error instanceof Error ? error.message : "GI088_SENTINEL_OUTPUT_PARSE_FAILED"],
          errorCode: "GI088_SENTINEL_OUTPUT_PARSE_FAILED",
          diagnostics
        };
      }
    } catch (error) {
      const diagnostics = sanitizeAIProviderDiagnostics(getAIProviderDiagnostics(error));
      result = {
        order: index + 1,
        caseId: item.caseId,
        principleId: item.evaluation.primaryPrincipleId,
        caseFingerprint: item.caseFingerprint,
        requestHash,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "technical_failure",
        httpStatus: diagnostics?.httpStatus ?? null,
        responseModel: diagnostics?.responseModel ?? null,
        latencyMs: diagnostics?.latencyMs ?? null,
        responseHash: null,
        responseLength: 0,
        visibleText: null,
        rawOutput: null,
        parsedOutput: null,
        validationIssues: [],
        errorCode: getAIProviderFailureCode(error),
        diagnostics
      };
    }
    results.push(result);
    await input.onResult?.(result);
  }
  return results;
}

async function writePrivateJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, filePath);
  await chmod(filePath, 0o600);
}

function publicTechnicalReceipt(plan: Gi088SentinelBaselinePlan, modelCheck: unknown, results: Gi088SentinelCallResult[]) {
  const valid = results.filter((item) => item.status === "valid").length;
  const contractFailures = results.filter((item) => item.status === "contract_failure").length;
  const technicalFailures = results.filter((item) => item.status === "technical_failure").length;
  return {
    schemaVersion: "1.0",
    identity: plan.identity,
    status: "technical_complete_waiting_codex_content_review",
    completedAt: new Date().toISOString(),
    planFingerprint: plan.planFingerprint,
    standardSha256: plan.standardSha256,
    datasetVersion: plan.datasetVersion,
    datasetFingerprint: plan.datasetFingerprint,
    reviewPacketFingerprint: plan.reviewPacketFingerprint,
    sentinelSetFingerprint: plan.sentinelSetFingerprint,
    candidateFingerprint: plan.candidateFingerprint,
    immutableCommit: plan.immutableCommit,
    runtime: plan.runtime,
    modelCheck,
    budget: { authorized: 9, consumed: results.length, retries: 0 },
    technicalSummary: { valid, contractFailures, technicalFailures, technicalSuccessRate: valid / 9 },
    cases: results.map((item) => ({
      order: item.order,
      caseId: item.caseId,
      principleId: item.principleId,
      status: item.status,
      httpStatus: item.httpStatus,
      responseModel: item.responseModel,
      latencyMs: item.latencyMs,
      responseHash: item.responseHash,
      responseLength: item.responseLength,
      validationIssues: item.validationIssues,
      errorCode: item.errorCode
    })),
    contentReview: "pending_codex_delegated_review",
    publicContentBoundary: { userText: 0, modelText: 0, hiddenReasoning: 0, upstreamRequestIds: 0 },
    excluded: { judgeCalls: 0, databaseChanges: 0, hiddenSetReads: 0, previewChanges: 0, productionChanges: 0 }
  };
}

async function execute() {
  const cwd = process.cwd();
  const plan = await createGi088SentinelBaselinePlan(cwd);
  loadEnvConfig(cwd);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_SENTINEL_API_KEY_MISSING");
  const modelCheck = await assertGi088SentinelModelAvailable({ apiKey });
  const privateRoot = path.join(cwd, PRIVATE_ROOT);
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  const reservationPath = path.join(privateRoot, "run-reservation.json");
  const reservation = await open(reservationPath, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new Error("GI088_SENTINEL_RUN_ALREADY_RESERVED");
    throw error;
  });
  await reservation.writeFile(`${JSON.stringify({ identity: plan.identity, planFingerprint: plan.planFingerprint, reservedAt: new Date().toISOString(), callBudget: 9 })}\n`);
  await reservation.close();
  const ledgerPath = path.join(privateRoot, "run-ledger.json");
  const ledger = { schemaVersion: "1.0", plan, modelCheck, status: "running", results: [] as Gi088SentinelCallResult[] };
  await writePrivateJson(ledgerPath, ledger);
  const provider = new OpenAIProvider({ apiKey, model: GI088_SENTINEL_BASELINE_EXPECTED.model, baseUrl: "https://api.deepseek.com", timeoutMs: 120_000 });
  const results = await runGi088SentinelCalls({
    plan,
    provider,
    onResult: async (result) => {
      ledger.results.push(result);
      await writePrivateJson(ledgerPath, ledger);
      process.stdout.write(`${JSON.stringify({ order: result.order, caseId: result.caseId, principleId: result.principleId, status: result.status, httpStatus: result.httpStatus, latencyMs: result.latencyMs, callsCompleted: ledger.results.length, callBudget: 9 })}\n`);
    }
  });
  ledger.status = "technical_complete_waiting_codex_content_review";
  await writePrivateJson(ledgerPath, ledger);
  await writeFile(path.join(cwd, PUBLIC_RECEIPT), `${JSON.stringify(publicTechnicalReceipt(plan, modelCheck, results), null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ identity: plan.identity, status: ledger.status, calls: results.length, privateLedger: ledgerPath, publicReceipt: path.join(cwd, PUBLIC_RECEIPT) }, null, 2)}\n`);
}

async function main() {
  const plan = await createGi088SentinelBaselinePlan();
  if (process.argv.includes("--execute")) return execute();
  process.stdout.write(`${JSON.stringify({ ...plan, sentinels: plan.sentinels.map((item) => ({ caseId: item.caseId, principleId: item.evaluation.primaryPrincipleId, caseFingerprint: item.caseFingerprint })), executionAuthorized: false, modelCalls: 0 }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve("scripts/run-gi088-real-problem-sentinel-baseline.ts")
) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
