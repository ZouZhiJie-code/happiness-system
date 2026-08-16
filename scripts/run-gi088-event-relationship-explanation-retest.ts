import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  createGi088EventRelationshipExplanationCandidateFingerprint,
  createGi088EventRelationshipExplanationPolicyFingerprint,
  getGi088EventRelationshipExplanationCandidateAssets
} from "../evals/event-centered-generative/gi088-event-relationship-explanation-v1/candidate";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AIProvider
} from "../src/server/services/ai/ai-provider";
import { createGi088EffectiveCandidateFingerprint } from "../src/server/services/evaluation/gi088/candidate";
import {
  parseGi088SemanticDeltaOutput,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput
} from "../src/server/services/evaluation/gi088/semantic-delta";
import {
  createGi088StageTransitionUserPrompt,
  validateGi088StageTransitionOutput
} from "../src/server/services/evaluation/gi088/stage-transition";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

export const GI088_EVENT_RELATIONSHIP_RETEST_IDENTITY =
  "2026-08-16.gi088-event-relationship-explanation-retest-v1" as const;
export const GI088_EVENT_RELATIONSHIP_RETEST_BUDGET = 10 as const;

export const GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED = {
  standardSha256: "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60",
  datasetVersion: "2026-08-16.gi088-real-problem-regression-v1.2",
  datasetFingerprint: "cf04a7584d74bb7cabb235fc0cc001ac6953fb01a90364d5690284c927c85eb1",
  reviewPacketFingerprint: "14e978dd3590d58ce837b6fffe51fddfbca1b81da0e68390f19babe2579b1982",
  datasetReceiptSha256: "b650328e02886730c93f0093fcd357e3b964f1007698ff62022439a8e51f8a6f",
  privateCasesSha256: "391e735110d274ded276827895a4027927dcbd16aef327042753b075a0fa8190",
  parentCandidateFingerprint: "0d5f91c0142df15035cd665a4a782f5207c4df48ef242e072452653c77b2efd6",
  candidateFingerprint: "14eeb577533a4f90127887695f78f71f660e78e5d6588da65a0cea66ccdd1dc9",
  policyFingerprint: "f9cea1c29cc8623a328dfa79c2702e0cc071c6c06aefcea5a05ef289c3810374",
  candidateFileSha256: "e49421981a8464d5b1fc165acf0417ca297631e3c124fcd10721beabb2a231f3",
  immutableCommit: "5281bc53f2b04be9c31adb6d7f4710ac818883a8",
  immutableManifestSha256: "42510166933d482a4ce2ea616a101ea354c16c73b833f09212ee3559eab4009d",
  behaviorManifestSha256: "90e56ba00a34b160ea7d836e306f3dd2dc8f09ab435f71881b76f17eddec3c67",
  real13CandidateInputFingerprint: "4714ca6367fdc4fadd5b3a3ba20e9c33363af90b1c3c0df28b5982b803566bc5",
  model: "deepseek-v4-pro",
  responseFormat: "json_object",
  reasoningEffort: "high",
  hardTimeoutMs: 120_000
} as const;

const ROOT = "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_ROOT = `${ROOT}/.private/event-relationship-explanation-retest-v1`;
const PUBLIC_RECEIPT = `${ROOT}/event-relationship-explanation-retest-v1-receipt.json`;
const DATASET_RECEIPT = `${ROOT}/real-problem-regression-v1.2-receipt.json`;
const PRIVATE_CASES = `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`;
const IMMUTABLE_MANIFEST = "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json";
const BEHAVIOR_MANIFEST = "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json";
const CANDIDATE_FILE = "evals/event-centered-generative/gi088-event-relationship-explanation-v1/candidate.ts";
const RETEST_CASE_IDS = [
  "RPR-REAL-05",
  "RPR-REAL-06",
  "RPR-REAL-08",
  "RPR-REAL-10",
  "RPR-REAL-13",
  "RPR-REAL-18",
  "RPR-REAL-19",
  "RPR-REAL-22",
  "RPR-CF-07",
  "RPR-CF-02"
] as const;

export type Gi088EventRelationshipRetestTechnicalStatus =
  | "valid"
  | "technical_failure"
  | "contract_failure";

export type Gi088EventRelationshipRetestCallResult = {
  order: number;
  caseId: string;
  principleId: string;
  caseFingerprint: string;
  candidateInputFingerprint: string;
  requestHash: string;
  startedAt: string;
  completedAt: string;
  status: Gi088EventRelationshipRetestTechnicalStatus;
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

export type Gi088EventRelationshipRetestPlan = {
  identity: typeof GI088_EVENT_RELATIONSHIP_RETEST_IDENTITY;
  planFingerprint: string;
  standardSha256: string;
  datasetVersion: string;
  datasetFingerprint: string;
  reviewPacketFingerprint: string;
  parentCandidateFingerprint: string;
  candidateFingerprint: string;
  policyFingerprint: string;
  immutableCommit: string;
  inputHashes: {
    datasetReceiptSha256: string;
    privateCasesSha256: string;
    candidateFileSha256: string;
    immutableManifestSha256: string;
    behaviorManifestSha256: string;
  };
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
    callBudget: 10;
  };
  retestSetFingerprint: string;
  cases: Gi088RealProblemRegressionCase[];
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
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return sha(await readFile(path.join(cwd, relativePath)));
}

export async function createGi088EventRelationshipRetestPlan(
  cwd = process.cwd()
): Promise<Gi088EventRelationshipRetestPlan> {
  const standardSha256 = await fileSha(cwd, "docs/ai-evaluation-standard.md");
  assert(standardSha256 === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.standardSha256, "GI088_EVENT_RELATIONSHIP_STANDARD_SHA_MISMATCH");
  const inputHashes = {
    datasetReceiptSha256: await fileSha(cwd, DATASET_RECEIPT),
    privateCasesSha256: await fileSha(cwd, PRIVATE_CASES),
    candidateFileSha256: await fileSha(cwd, CANDIDATE_FILE),
    immutableManifestSha256: await fileSha(cwd, IMMUTABLE_MANIFEST),
    behaviorManifestSha256: await fileSha(cwd, BEHAVIOR_MANIFEST)
  };
  assert(inputHashes.datasetReceiptSha256 === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.datasetReceiptSha256, "GI088_EVENT_RELATIONSHIP_DATASET_RECEIPT_DRIFT");
  assert(inputHashes.privateCasesSha256 === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.privateCasesSha256, "GI088_EVENT_RELATIONSHIP_PRIVATE_CASES_DRIFT");
  assert(inputHashes.candidateFileSha256 === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.candidateFileSha256, "GI088_EVENT_RELATIONSHIP_CANDIDATE_FILE_DRIFT");
  assert(inputHashes.immutableManifestSha256 === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.immutableManifestSha256, "GI088_EVENT_RELATIONSHIP_IMMUTABLE_MANIFEST_DRIFT");
  assert(inputHashes.behaviorManifestSha256 === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.behaviorManifestSha256, "GI088_EVENT_RELATIONSHIP_BEHAVIOR_MANIFEST_DRIFT");

  const receipt = JSON.parse(await readFile(path.join(cwd, DATASET_RECEIPT), "utf8")) as {
    receiptVersion: string;
    datasetFingerprint: string;
    reviewPacketFingerprint: string;
  };
  assert(receipt.receiptVersion === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.datasetVersion, "GI088_EVENT_RELATIONSHIP_DATASET_VERSION_MISMATCH");
  assert(receipt.datasetFingerprint === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.datasetFingerprint, "GI088_EVENT_RELATIONSHIP_DATASET_FINGERPRINT_MISMATCH");
  assert(receipt.reviewPacketFingerprint === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.reviewPacketFingerprint, "GI088_EVENT_RELATIONSHIP_REVIEW_PACKET_FINGERPRINT_MISMATCH");
  assert(createGi088EffectiveCandidateFingerprint() === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.parentCandidateFingerprint, "GI088_EVENT_RELATIONSHIP_PARENT_CANDIDATE_DRIFT");
  assert(createGi088EventRelationshipExplanationPolicyFingerprint() === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.policyFingerprint, "GI088_EVENT_RELATIONSHIP_POLICY_DRIFT");
  assert(createGi088EventRelationshipExplanationCandidateFingerprint() === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.candidateFingerprint, "GI088_EVENT_RELATIONSHIP_CANDIDATE_DRIFT");

  const allCases = JSON.parse(await readFile(path.join(cwd, PRIVATE_CASES), "utf8")) as Gi088RealProblemRegressionCase[];
  const byId = new Map(allCases.map((item) => [item.caseId, item]));
  const cases = RETEST_CASE_IDS.map((caseId) => {
    const item = byId.get(caseId);
    assert(item, `GI088_EVENT_RELATIONSHIP_CASE_MISSING:${caseId}`);
    return item;
  });
  assert(new Set(cases.map((item) => item.caseId)).size === GI088_EVENT_RELATIONSHIP_RETEST_BUDGET, "GI088_EVENT_RELATIONSHIP_CASE_DUPLICATE");
  assert(cases.find((item) => item.caseId === "RPR-REAL-13")?.candidateInputFingerprint === GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.real13CandidateInputFingerprint, "GI088_EVENT_RELATIONSHIP_REAL13_INPUT_DRIFT");
  const retestSetFingerprint = sha(canonicalJson(cases.map((item) => ({
    caseId: item.caseId,
    caseFingerprint: item.caseFingerprint,
    candidateInputFingerprint: item.candidateInputFingerprint,
    principleId: item.evaluation.primaryPrincipleId
  }))));
  const runtime = {
    model: GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.model,
    thinking: "enabled" as const,
    reasoningEffort: "high" as const,
    responseFormat: "json_object" as const,
    headersTimeoutMs: 15_000 as const,
    bodyIdleTimeoutMs: 45_000 as const,
    hardTimeoutMs: GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.hardTimeoutMs,
    concurrency: 1 as const,
    retries: 0 as const,
    callBudget: GI088_EVENT_RELATIONSHIP_RETEST_BUDGET
  };
  const core: Omit<Gi088EventRelationshipRetestPlan, "planFingerprint" | "cases"> = {
    identity: GI088_EVENT_RELATIONSHIP_RETEST_IDENTITY,
    standardSha256,
    datasetVersion: receipt.receiptVersion,
    datasetFingerprint: receipt.datasetFingerprint,
    reviewPacketFingerprint: receipt.reviewPacketFingerprint,
    parentCandidateFingerprint: GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.parentCandidateFingerprint,
    candidateFingerprint: GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.candidateFingerprint,
    policyFingerprint: GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.policyFingerprint,
    immutableCommit: GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.immutableCommit,
    inputHashes,
    runtime,
    retestSetFingerprint
  };
  return { ...core, planFingerprint: sha(canonicalJson(core)), cases };
}

export async function assertGi088EventRelationshipModelAvailable(input: {
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
    if (response.status === 401 || response.status === 403) {
      throw new Error("GI088_EVENT_RELATIONSHIP_AUTHENTICATION_FAILED");
    }
    if (!response.ok) {
      throw new Error(`GI088_EVENT_RELATIONSHIP_MODELS_HTTP_${response.status}`);
    }
    const payload = await response.json() as { data?: Array<{ id?: unknown }> };
    const models = Array.isArray(payload.data)
      ? payload.data.map((item) => typeof item.id === "string" ? item.id : "").filter(Boolean)
      : [];
    assert(models.includes(GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.model), "GI088_EVENT_RELATIONSHIP_TARGET_MODEL_MISSING");
    return {
      httpStatus: response.status,
      targetModelAvailable: true,
      modelListHash: sha(canonicalJson(models.sort()))
    };
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
    ...(semantic.burdenSignalChange.kind === "set"
      ? semantic.burdenSignalChange.evidenceRefs
      : [])
  ];
}

export function classifyGi088EventRelationshipValidationIssues(issues: string[]) {
  const semanticOnlyIssues = issues.filter((issue) => issue.startsWith("ASK_QUESTION_COUNT_INVALID:"));
  const blockingIssues = issues.filter((issue) => !issue.startsWith("ASK_QUESTION_COUNT_INVALID:"));
  return {
    blockingIssues,
    semanticOnlyIssues,
    status: blockingIssues.length ? "contract_failure" as const : "valid" as const
  };
}

export async function runGi088EventRelationshipRetestCalls(input: {
  plan: Gi088EventRelationshipRetestPlan;
  provider: AIProvider;
  onResult?: (result: Gi088EventRelationshipRetestCallResult) => Promise<void> | void;
}) {
  const results: Gi088EventRelationshipRetestCallResult[] = [];
  const systemPrompt = getGi088EventRelationshipExplanationCandidateAssets().systemPrompt;
  for (const [index, item] of input.plan.cases.entries()) {
    assert(results.length < input.plan.runtime.callBudget, "GI088_EVENT_RELATIONSHIP_CALL_BUDGET_EXCEEDED");
    const turnInput = toTurnInput(item);
    const params = {
      messages: [
        { role: "system" as const, content: systemPrompt },
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
    let result: Gi088EventRelationshipRetestCallResult;
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
        const visibleText = [output.visible.understanding, output.visible.response]
          .filter(Boolean)
          .join("\n")
          .trim();
        if (!visibleText) observedIssues.push("VISIBLE_TEXT_EMPTY");
        const classification = classifyGi088EventRelationshipValidationIssues(observedIssues);
        result = {
          order: index + 1,
          caseId: item.caseId,
          principleId: item.evaluation.primaryPrincipleId,
          caseFingerprint: item.caseFingerprint,
          candidateInputFingerprint: item.candidateInputFingerprint,
          requestHash,
          startedAt,
          completedAt: new Date().toISOString(),
          status: classification.status,
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel: diagnostics?.responseModel ?? GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.model,
          latencyMs: diagnostics?.latencyMs ?? completion.latencyMs,
          responseHash: sha(completion.content),
          responseLength: completion.content.length,
          visibleText,
          rawOutput: completion.content,
          parsedOutput: output,
          validationIssues: [...classification.blockingIssues, ...classification.semanticOnlyIssues],
          errorCode: classification.blockingIssues.length ? "GI088_EVENT_RELATIONSHIP_CONTRACT_INVALID" : null,
          diagnostics
        };
      } catch (error) {
        result = {
          order: index + 1,
          caseId: item.caseId,
          principleId: item.evaluation.primaryPrincipleId,
          caseFingerprint: item.caseFingerprint,
          candidateInputFingerprint: item.candidateInputFingerprint,
          requestHash,
          startedAt,
          completedAt: new Date().toISOString(),
          status: "contract_failure",
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel: diagnostics?.responseModel ?? GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.model,
          latencyMs: diagnostics?.latencyMs ?? completion.latencyMs,
          responseHash: sha(completion.content),
          responseLength: completion.content.length,
          visibleText: null,
          rawOutput: completion.content,
          parsedOutput: null,
          validationIssues: [error instanceof Error ? error.message : "GI088_EVENT_RELATIONSHIP_OUTPUT_PARSE_FAILED"],
          errorCode: "GI088_EVENT_RELATIONSHIP_OUTPUT_PARSE_FAILED",
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
        candidateInputFingerprint: item.candidateInputFingerprint,
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

function publicTechnicalReceipt(
  plan: Gi088EventRelationshipRetestPlan,
  modelCheck: unknown,
  results: Gi088EventRelationshipRetestCallResult[]
) {
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
    retestSetFingerprint: plan.retestSetFingerprint,
    parentCandidateFingerprint: plan.parentCandidateFingerprint,
    candidateFingerprint: plan.candidateFingerprint,
    policyFingerprint: plan.policyFingerprint,
    immutableCommit: plan.immutableCommit,
    inputHashes: plan.inputHashes,
    runtime: plan.runtime,
    modelCheck,
    budget: { authorized: GI088_EVENT_RELATIONSHIP_RETEST_BUDGET, consumed: results.length, retries: 0 },
    technicalSummary: {
      valid,
      contractFailures,
      technicalFailures,
      technicalSuccessRate: valid / GI088_EVENT_RELATIONSHIP_RETEST_BUDGET
    },
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
    publicContentBoundary: { userText: 0, modelText: 0, reviewRationale: 0, hiddenReasoning: 0, upstreamRequestIds: 0 },
    excluded: { judgeCalls: 0, databaseChanges: 0, hiddenSetReads: 0, previewChanges: 0, productionChanges: 0 }
  };
}

async function execute() {
  const cwd = process.cwd();
  const plan = await createGi088EventRelationshipRetestPlan(cwd);
  loadEnvConfig(cwd);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_EVENT_RELATIONSHIP_API_KEY_MISSING");
  const modelCheck = await assertGi088EventRelationshipModelAvailable({ apiKey });
  const privateRoot = path.join(cwd, PRIVATE_ROOT);
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  const reservationPath = path.join(privateRoot, "run-reservation.json");
  const reservation = await open(reservationPath, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new Error("GI088_EVENT_RELATIONSHIP_RUN_ALREADY_RESERVED");
    throw error;
  });
  await reservation.writeFile(`${JSON.stringify({
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    reservedAt: new Date().toISOString(),
    callBudget: GI088_EVENT_RELATIONSHIP_RETEST_BUDGET
  })}\n`);
  await reservation.close();
  await chmod(reservationPath, 0o600);
  const ledgerPath = path.join(privateRoot, "run-ledger.json");
  const ledger = {
    schemaVersion: "1.0",
    plan,
    modelCheck,
    status: "running",
    results: [] as Gi088EventRelationshipRetestCallResult[]
  };
  await writePrivateJson(ledgerPath, ledger);
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.hardTimeoutMs
  });
  const results = await runGi088EventRelationshipRetestCalls({
    plan,
    provider,
    onResult: async (result) => {
      ledger.results.push(result);
      await writePrivateJson(ledgerPath, ledger);
      process.stdout.write(`${JSON.stringify({
        order: result.order,
        caseId: result.caseId,
        principleId: result.principleId,
        status: result.status,
        httpStatus: result.httpStatus,
        latencyMs: result.latencyMs,
        callsCompleted: ledger.results.length,
        callBudget: GI088_EVENT_RELATIONSHIP_RETEST_BUDGET
      })}\n`);
    }
  });
  ledger.status = "technical_complete_waiting_codex_content_review";
  await writePrivateJson(ledgerPath, ledger);
  await writeFile(
    path.join(cwd, PUBLIC_RECEIPT),
    `${JSON.stringify(publicTechnicalReceipt(plan, modelCheck, results), null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify({
    identity: plan.identity,
    status: ledger.status,
    calls: results.length,
    privateLedger: ledgerPath,
    publicReceipt: path.join(cwd, PUBLIC_RECEIPT)
  }, null, 2)}\n`);
}

async function main() {
  const plan = await createGi088EventRelationshipRetestPlan();
  if (process.argv.includes("--execute")) return execute();
  process.stdout.write(`${JSON.stringify({
    ...plan,
    cases: plan.cases.map((item) => ({
      caseId: item.caseId,
      principleId: item.evaluation.primaryPrincipleId,
      caseFingerprint: item.caseFingerprint,
      candidateInputFingerprint: item.candidateInputFingerprint
    })),
    executionAuthorized: false,
    modelCalls: 0
  }, null, 2)}\n`);
}

if (
  process.env.VITEST !== "true" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve("scripts/run-gi088-event-relationship-explanation-retest.ts")
) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
