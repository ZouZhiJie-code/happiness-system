import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  createGi088RelationshipClaimStatusCandidateIdentity,
  getGi088RelationshipClaimStatusCandidateAssets,
  parseGi088RelationshipClaimStatusOutput,
  validateGi088RelationshipClaimStatusOutput
} from "../evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate";
import {
  createGi088ResponseFirstTwoStageCandidateIdentity,
  getGi088ResponseFirstTwoStageAssets,
  parseGi088ResponseFirstVisibleOutput,
  validateGi088ResponseFirstVisibleOutput
} from "../evals/event-centered-generative/gi088-response-first-two-stage-v1/candidate";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AICompletionParams,
  type AIProvider
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import { createGi088StageTransitionUserPrompt } from "../src/server/services/evaluation/gi088/stage-transition";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

export const GI088_VISIBLE_CONTRACT_BURDEN_AB_IDENTITY =
  "2026-08-16.gi088-visible-contract-burden-ab-v1" as const;
export const GI088_VISIBLE_CONTRACT_BURDEN_AB_BUDGET = 4 as const;
export const GI088_VISIBLE_CONTRACT_BURDEN_AB_CASE_ID = "RPR-CF-02" as const;
export const GI088_VISIBLE_CONTRACT_BURDEN_AB_SEQUENCE = [
  "A",
  "B",
  "B",
  "A"
] as const;

export const GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME = {
  model: "deepseek-v4-pro",
  thinking: "enabled",
  reasoningEffort: "low",
  responseFormat: "json_object",
  headersTimeoutMs: 15_000,
  bodyIdleTimeoutMs: 60_000,
  hardTimeoutMs: 60_000,
  firstUsefulGateMs: 45_000,
  fullVisibleGateMs: 60_000,
  concurrency: 1,
  retries: 0,
  recovery: 0,
  fallback: 0,
  callBudget: GI088_VISIBLE_CONTRACT_BURDEN_AB_BUDGET
} as const;

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_ROOT = `${ROOT}/.private/visible-contract-burden-ab-v1`;
const PRIVATE_CASES =
  `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`;
const DATASET_RECEIPT = `${ROOT}/real-problem-regression-v1.2-receipt.json`;
const PUBLIC_START_CARD = `${ROOT}/visible-contract-burden-ab-v1-start-card.json`;
const PUBLIC_AUTHORIZATION =
  `${ROOT}/visible-contract-burden-ab-v1-authorization.json`;
const PUBLIC_RECEIPT = `${ROOT}/visible-contract-burden-ab-v1-receipt.json`;
const PUBLIC_HANDOFF = `${ROOT}/visible-contract-burden-ab-v1-handoff.md`;
const RUNNER_FILE = "scripts/run-gi088-visible-contract-burden-ab.ts";

const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  datasetReceipt: DATASET_RECEIPT,
  privateCases: PRIVATE_CASES,
  fullCandidate:
    "evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate.ts",
  responseFirstCandidate:
    "evals/event-centered-generative/gi088-response-first-two-stage-v1/candidate.ts",
  board7Input:
    "evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1.ts",
  stageTransition:
    "src/server/services/evaluation/gi088/stage-transition.ts",
  provider: "src/server/services/ai/openai.provider.ts",
  runner: RUNNER_FILE
} as const;

const EXPECTED = {
  standardSha256:
    "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60",
  datasetReceiptSha256:
    "b650328e02886730c93f0093fcd357e3b964f1007698ff62022439a8e51f8a6f",
  privateCasesSha256:
    "391e735110d274ded276827895a4027927dcbd16aef327042753b075a0fa8190",
  fullCandidateFileSha256:
    "0a091dcf808af479c5bbc3288da31e3e070cb90a15c925a490518315d61904c1",
  responseFirstCandidateFileSha256:
    "3dfc2324a2cb67403408aa7b8eb27ff4fbf8dd8a428046149d1585ad540e6498",
  board7InputFileSha256:
    "521ec378de3ec5a43a03894f7ce77db1a190884b7653c23c61f172113fb1d61a",
  stageTransitionFileSha256:
    "1c8657e4473993d335eb9435e3110419769e7228965d47dad19dcea337ff0326",
  providerFileSha256:
    "75650cd9a1d8c2079a24afa2cd35a40e9c61e8951b97cf12d656732655cd7133",
  datasetVersion: "2026-08-16.gi088-real-problem-regression-v1.2",
  datasetFingerprint:
    "cf04a7584d74bb7cabb235fc0cc001ac6953fb01a90364d5690284c927c85eb1",
  reviewPacketFingerprint:
    "14e978dd3590d58ce837b6fffe51fddfbca1b81da0e68390f19babe2579b1982",
  caseFingerprint:
    "fded342a8385302a8a8b4dd0cffb29f9604ffd6070033310546c07aefa42d9cd",
  candidateInputFingerprint:
    "c75c322807a0b7605cc945fc5cd58ebb8e5a1bae3a2b78dee2e1a9939c70c163",
  principleId: "QR-08",
  fullCandidateFingerprint:
    "1f60ca82a6f12fb554efc780a3dc215b57fc1bf77599279ccf4ad570dee569cc",
  responseFirstCandidateFingerprint:
    "e806843dbcf0514d133f77818255f46f8e1a7f5a2bb6b0e8a962809f755bac96"
} as const;

export type Gi088VisibleContractBurdenAbArm =
  (typeof GI088_VISIBLE_CONTRACT_BURDEN_AB_SEQUENCE)[number];
export type Gi088VisibleContractBurdenAbRunLabel =
  | "A1"
  | "B1"
  | "B2"
  | "A2";

export type Gi088VisibleContractBurdenAbCallResult = {
  order: number;
  runLabel: Gi088VisibleContractBurdenAbRunLabel;
  arm: Gi088VisibleContractBurdenAbArm;
  status: "valid" | "contract_failure" | "technical_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  candidateFingerprint: string;
  httpStatus: number | null;
  responseModel: string | null;
  headersLatencyMs: number | null;
  bodyLatencyMs: number | null;
  totalLatencyMs: number | null;
  firstUsefulAtMs: number | null;
  fullVisibleAtMs: number | null;
  firstUsefulGatePassed: boolean;
  fullVisibleGatePassed: boolean;
  responseHash: string | null;
  responseLength: number;
  visibleText: string | null;
  rawOutput: string | null;
  parsedOutput: unknown | null;
  validationIssues: string[];
  errorCode: string | null;
  deadlineTimeout: boolean;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

export type Gi088VisibleContractBurdenAbNotRun = {
  order: number;
  runLabel: Gi088VisibleContractBurdenAbRunLabel;
  arm: Gi088VisibleContractBurdenAbArm;
  status: "not_run";
  reason:
    | "preflight_technical_failure"
    | "stopped_after_non_latency_technical_failure";
};

export type Gi088VisibleContractBurdenAbDecision =
  | "visible_contract_strong_directional_support"
  | "visible_contract_directional_support"
  | "shared_low_or_provider_slow"
  | "burden_not_materially_reproduced"
  | "inconclusive_mixed_direction"
  | "technical_blocked";

type Authorization = {
  schemaVersion: "1.0";
  identity: typeof GI088_VISIBLE_CONTRACT_BURDEN_AB_IDENTITY;
  planFingerprint: string;
  startCardSha256: string;
  status: "authorized";
  authorizedAt: string;
  authorizedBy: "product_owner";
  authorizationSource: "current_session_explicit_provider_call_authorization";
  sequence: ["A", "B", "B", "A"];
  runtime: typeof GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME;
  executionBoundary: {
    providerCallsAuthorized: 4;
    providerCallsConsumedBeforeRun: 0;
    retriesAuthorized: 0;
    recoveryAuthorized: 0;
    fallbackAuthorized: 0;
    judgeCallsAuthorized: 0;
    hiddenSetReadsAuthorized: 0;
    databaseChangesAuthorized: 0;
    previewChangesAuthorized: 0;
    productionChangesAuthorized: 0;
    commitsAuthorized: 0;
    pushesAuthorized: 0;
    deploymentsAuthorized: 0;
  };
  stopPoint: "four_results_or_first_non_latency_technical_failure";
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

export function canonicalGi088VisibleContractBurdenAbJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function shaGi088VisibleContractBurdenAb(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return shaGi088VisibleContractBurdenAb(
    await readFile(path.join(cwd, relativePath))
  );
}

export function toGi088VisibleContractBurdenAbTurnInput(
  item: Gi088RealProblemRegressionCase
): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: item.candidateInput.messages,
    latestUserMessageId: item.candidateInput.messages.at(-1)!.id,
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

export function createGi088VisibleContractBurdenAbRequest(input: {
  arm: Gi088VisibleContractBurdenAbArm;
  item: Gi088RealProblemRegressionCase;
}): AICompletionParams {
  const fullAssets = getGi088RelationshipClaimStatusCandidateAssets();
  const responseFirstAssets = getGi088ResponseFirstTwoStageAssets();
  const systemPrompt =
    input.arm === "A"
      ? fullAssets.systemPrompt
      : responseFirstAssets.visible.systemPrompt;
  const userPrompt = createGi088StageTransitionUserPrompt(
    toGi088VisibleContractBurdenAbTurnInput(input.item)
  );
  return {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    useProviderDefaultMaxTokens: true,
    headersTimeoutMs: GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.headersTimeoutMs,
    bodyIdleTimeoutMs:
      GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.bodyIdleTimeoutMs,
    hardTimeoutMs: GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.hardTimeoutMs,
    timeoutMs: GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.hardTimeoutMs,
    responseFormat: "json_object",
    thinking: "enabled",
    reasoningEffort: "low"
  };
}

async function readBoundCase(cwd: string) {
  const allCases = JSON.parse(
    await readFile(path.join(cwd, PRIVATE_CASES), "utf8")
  ) as Gi088RealProblemRegressionCase[];
  const item = allCases.find(
    (candidate) => candidate.caseId === GI088_VISIBLE_CONTRACT_BURDEN_AB_CASE_ID
  );
  assert(item, "GI088_VISIBLE_CONTRACT_BURDEN_AB_CASE_MISSING");
  assert(
    item.caseFingerprint === EXPECTED.caseFingerprint &&
      item.candidateInputFingerprint === EXPECTED.candidateInputFingerprint &&
      item.evaluation.primaryPrincipleId === EXPECTED.principleId,
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_CASE_DRIFT"
  );
  return item;
}

export async function createGi088VisibleContractBurdenAbPlan(
  cwd = process.cwd()
) {
  const inputHashes = {
    standardSha256: await fileSha(cwd, FILES.standard),
    datasetReceiptSha256: await fileSha(cwd, FILES.datasetReceipt),
    privateCasesSha256: await fileSha(cwd, FILES.privateCases),
    fullCandidateFileSha256: await fileSha(cwd, FILES.fullCandidate),
    responseFirstCandidateFileSha256: await fileSha(
      cwd,
      FILES.responseFirstCandidate
    ),
    board7InputFileSha256: await fileSha(cwd, FILES.board7Input),
    stageTransitionFileSha256: await fileSha(cwd, FILES.stageTransition),
    providerFileSha256: await fileSha(cwd, FILES.provider),
    runnerFileSha256: await fileSha(cwd, FILES.runner)
  };
  for (const [key, expected] of Object.entries({
    standardSha256: EXPECTED.standardSha256,
    datasetReceiptSha256: EXPECTED.datasetReceiptSha256,
    privateCasesSha256: EXPECTED.privateCasesSha256,
    fullCandidateFileSha256: EXPECTED.fullCandidateFileSha256,
    responseFirstCandidateFileSha256:
      EXPECTED.responseFirstCandidateFileSha256,
    board7InputFileSha256: EXPECTED.board7InputFileSha256,
    stageTransitionFileSha256: EXPECTED.stageTransitionFileSha256,
    providerFileSha256: EXPECTED.providerFileSha256
  })) {
    assert(
      inputHashes[key as keyof typeof inputHashes] === expected,
      `GI088_VISIBLE_CONTRACT_BURDEN_AB_INPUT_DRIFT:${key}`
    );
  }

  const datasetReceipt = JSON.parse(
    await readFile(path.join(cwd, DATASET_RECEIPT), "utf8")
  ) as {
    receiptVersion: string;
    datasetFingerprint: string;
    reviewPacketFingerprint: string;
  };
  assert(
    datasetReceipt.receiptVersion === EXPECTED.datasetVersion &&
      datasetReceipt.datasetFingerprint === EXPECTED.datasetFingerprint &&
      datasetReceipt.reviewPacketFingerprint ===
        EXPECTED.reviewPacketFingerprint,
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_DATASET_DRIFT"
  );

  const item = await readBoundCase(cwd);
  const fullIdentity = createGi088RelationshipClaimStatusCandidateIdentity();
  const responseFirstIdentity =
    createGi088ResponseFirstTwoStageCandidateIdentity();
  assert(
    fullIdentity.candidateFingerprint === EXPECTED.fullCandidateFingerprint,
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_FULL_CANDIDATE_DRIFT"
  );
  assert(
    responseFirstIdentity.candidateFingerprint ===
        EXPECTED.responseFirstCandidateFingerprint &&
      responseFirstIdentity.parentCandidateFingerprint ===
        fullIdentity.candidateFingerprint,
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_RESPONSE_FIRST_CANDIDATE_DRIFT"
  );

  const fullAssets = getGi088RelationshipClaimStatusCandidateAssets();
  const responseFirstAssets = getGi088ResponseFirstTwoStageAssets();
  const requestA = createGi088VisibleContractBurdenAbRequest({
    arm: "A",
    item
  });
  const requestB = createGi088VisibleContractBurdenAbRequest({
    arm: "B",
    item
  });
  const userPromptA = requestA.messages.at(-1)?.content;
  const userPromptB = requestB.messages.at(-1)?.content;
  assert(
    userPromptA && userPromptA === userPromptB,
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_USER_PAYLOAD_NOT_FIXED"
  );
  const requestFingerprintA = shaGi088VisibleContractBurdenAb(
    canonicalGi088VisibleContractBurdenAbJson(requestA)
  );
  const requestFingerprintB = shaGi088VisibleContractBurdenAb(
    canonicalGi088VisibleContractBurdenAbJson(requestB)
  );
  const arms = {
    A: {
      label: "current_full_prompt_skill_output_contract",
      candidateVersion: fullIdentity.version,
      candidateFingerprint: fullIdentity.candidateFingerprint,
      systemPromptSha256: shaGi088VisibleContractBurdenAb(
        fullAssets.systemPrompt
      ),
      systemPromptLength: fullAssets.systemPrompt.length,
      outputContractSha256: shaGi088VisibleContractBurdenAb(
        fullAssets.outputContract
      ),
      outputContractLength: fullAssets.outputContract.length,
      requestFingerprint: requestFingerprintA
    },
    B: {
      label: "response_first_visible_prompt_skill_output_contract",
      candidateVersion: responseFirstIdentity.version,
      candidateFingerprint: responseFirstIdentity.candidateFingerprint,
      systemPromptSha256: shaGi088VisibleContractBurdenAb(
        responseFirstAssets.visible.systemPrompt
      ),
      systemPromptLength: responseFirstAssets.visible.systemPrompt.length,
      outputContractSha256: shaGi088VisibleContractBurdenAb(
        responseFirstAssets.visible.outputContract
      ),
      outputContractLength: responseFirstAssets.visible.outputContract.length,
      requestFingerprint: requestFingerprintB
    }
  } as const;
  const runLabels = ["A1", "B1", "B2", "A2"] as const;
  const sequence = GI088_VISIBLE_CONTRACT_BURDEN_AB_SEQUENCE.map(
    (arm, index) => ({
      order: index + 1,
      runLabel: runLabels[index],
      arm,
      requestFingerprint: arms[arm].requestFingerprint
    })
  );
  const core = {
    schemaVersion: "1.0" as const,
    identity: GI088_VISIBLE_CONTRACT_BURDEN_AB_IDENTITY,
    status: "ready_waiting_authorization_card" as const,
    scope: "single_case_visible_contract_workload_latency_probe" as const,
    productDecision: {
      userFirstUsefulGateMs: 45_000,
      userFullVisibleGateMs: 60_000,
      twoStageDirectionAccepted: true,
      latencyAttributionOnly: true,
      isolatedRunnerIsPageEvidence: false
    },
    dataset: {
      version: datasetReceipt.receiptVersion,
      fingerprint: datasetReceipt.datasetFingerprint,
      reviewPacketFingerprint: datasetReceipt.reviewPacketFingerprint
    },
    case: {
      caseId: item.caseId,
      principleId: item.evaluation.primaryPrincipleId,
      caseFingerprint: item.caseFingerprint,
      candidateInputFingerprint: item.candidateInputFingerprint,
      userPayloadSha256: shaGi088VisibleContractBurdenAb(userPromptA),
      userPayloadLength: userPromptA.length
    },
    changedFactor:
      "prompt_skill_and_output_contract_workload_bundle_only" as const,
    fixedFactors: {
      sameFullUserPayload: true,
      model: GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.model,
      thinking: GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.thinking,
      reasoningEffort:
        GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.reasoningEffort,
      responseFormat: GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.responseFormat,
      provider: "api.deepseek.com",
      providerDefaultMaxTokens: true,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    arms,
    sequence,
    inputHashes,
    runtime: GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME,
    decisionRules: {
      strongDirection:
        "both_B_valid_within_45000ms_and_both_A_comparable_over_45000ms",
      directionalSupport:
        "both_paired_A_minus_B_total_latency_at_least_10000ms",
      sharedSlow:
        "all_four_comparable_total_latencies_exceed_45000ms",
      burdenNotReproduced:
        "all_four_valid_within_45000ms_without_both_paired_10000ms_improvement",
      technicalBlocked:
        "authentication_model_network_or_non_body_deadline_failure_stops_remaining_calls",
      mixedDirection: "all_other_complete_patterns_are_inconclusive"
    },
    authorization: {
      providerCallsRequested: 4,
      providerCallsAuthorizedInConversation: 4,
      retriesAuthorized: 0,
      judgeCallsAuthorized: 0,
      hiddenSetReadsAuthorized: 0,
      previewChangesAuthorized: 0,
      productionChangesAuthorized: 0,
      commitsAuthorized: 0,
      pushesAuthorized: 0,
      deploymentsAuthorized: 0
    },
    conclusionBoundary: {
      supported: [
        "可见 Prompt、Skill 与输出合同这一组工作负担是否形成稳定延迟方向",
        "首段合同在隔离运行器中的有效正文等待"
      ],
      unsupported: [
        "第一段语义质量",
        "模型与程序职责重划的端到端收益",
        "真实页面点击到显示的速度",
        "第二段完整处理速度",
        "Preview 或发布资格"
      ]
    }
  };
  return {
    ...core,
    planFingerprint: shaGi088VisibleContractBurdenAb(
      canonicalGi088VisibleContractBurdenAbJson(core)
    )
  };
}

export type Gi088VisibleContractBurdenAbPlan = Awaited<
  ReturnType<typeof createGi088VisibleContractBurdenAbPlan>
>;

export function assertGi088VisibleContractBurdenAbAuthorization(input: {
  authorization: Authorization;
  plan: Gi088VisibleContractBurdenAbPlan;
  startCardSha256: string;
}) {
  const { authorization, plan, startCardSha256 } = input;
  assert(
    authorization.schemaVersion === "1.0" &&
      authorization.identity === plan.identity &&
      authorization.status === "authorized" &&
      authorization.authorizedBy === "product_owner" &&
      authorization.authorizationSource ===
        "current_session_explicit_provider_call_authorization",
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_AUTHORIZATION_IDENTITY_MISMATCH"
  );
  assert(
    authorization.planFingerprint === plan.planFingerprint &&
      authorization.startCardSha256 === startCardSha256,
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_AUTHORIZATION_FINGERPRINT_MISMATCH"
  );
  assert(
    canonicalGi088VisibleContractBurdenAbJson(authorization.sequence) ===
        canonicalGi088VisibleContractBurdenAbJson(
          plan.sequence.map((entry) => entry.arm)
        ) &&
      canonicalGi088VisibleContractBurdenAbJson(authorization.runtime) ===
        canonicalGi088VisibleContractBurdenAbJson(plan.runtime),
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_AUTHORIZATION_RUNTIME_MISMATCH"
  );
  assert(
    authorization.executionBoundary.providerCallsAuthorized === 4 &&
      authorization.executionBoundary.providerCallsConsumedBeforeRun === 0 &&
      authorization.executionBoundary.retriesAuthorized === 0 &&
      authorization.executionBoundary.recoveryAuthorized === 0 &&
      authorization.executionBoundary.fallbackAuthorized === 0,
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_AUTHORIZATION_BUDGET_MISMATCH"
  );
}

async function loadExecutionPlan(cwd: string) {
  const plan = await createGi088VisibleContractBurdenAbPlan(cwd);
  const startCardRaw = await readFile(
    path.join(cwd, PUBLIC_START_CARD),
    "utf8"
  );
  const startCard = JSON.parse(startCardRaw) as Gi088VisibleContractBurdenAbPlan;
  assert(
    canonicalGi088VisibleContractBurdenAbJson(startCard) ===
      canonicalGi088VisibleContractBurdenAbJson(plan),
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_START_CARD_DRIFT"
  );
  const authorizationRaw = await readFile(
    path.join(cwd, PUBLIC_AUTHORIZATION),
    "utf8"
  );
  const authorization = JSON.parse(authorizationRaw) as Authorization;
  const startCardSha256 = shaGi088VisibleContractBurdenAb(startCardRaw);
  assertGi088VisibleContractBurdenAbAuthorization({
    authorization,
    plan,
    startCardSha256
  });
  return {
    plan,
    authorization,
    startCardSha256,
    authorizationSha256: shaGi088VisibleContractBurdenAb(authorizationRaw),
    item: await readBoundCase(cwd)
  };
}

async function assertTargetModelAvailable(input: {
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
      throw new Error(
        "GI088_VISIBLE_CONTRACT_BURDEN_AB_AUTHENTICATION_FAILED"
      );
    }
    assert(
      response.ok,
      `GI088_VISIBLE_CONTRACT_BURDEN_AB_MODELS_HTTP_${response.status}`
    );
    const payload = (await response.json()) as {
      data?: Array<{ id?: unknown }>;
    };
    const models = Array.isArray(payload.data)
      ? payload.data
          .map((entry) => (typeof entry.id === "string" ? entry.id : ""))
          .filter(Boolean)
          .sort()
      : [];
    assert(
      models.includes(GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.model),
      "GI088_VISIBLE_CONTRACT_BURDEN_AB_TARGET_MODEL_MISSING"
    );
    return {
      httpStatus: response.status,
      targetModelAvailable: true,
      modelListHash: shaGi088VisibleContractBurdenAb(
        canonicalGi088VisibleContractBurdenAbJson(models)
      )
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isComparableDeadlineTimeout(input: {
  errorCode: string | null;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
}) {
  return Boolean(
    input.errorCode === "TIMEOUT" &&
      input.diagnostics?.abortSource === "deadline" &&
      (input.diagnostics.timeoutStage === "body" ||
        input.diagnostics.timeoutStage === "hard_total")
  );
}

function timingFields(
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>,
  fallbackLatencyMs: number | null
) {
  return {
    headersLatencyMs: diagnostics?.headersLatencyMs ?? null,
    bodyLatencyMs: diagnostics?.bodyLatencyMs ?? null,
    totalLatencyMs:
      diagnostics?.totalLatencyMs ?? diagnostics?.latencyMs ?? fallbackLatencyMs
  };
}

export function shouldContinueGi088VisibleContractBurdenAbAfter(
  result: Gi088VisibleContractBurdenAbCallResult
) {
  return result.status !== "technical_failure" || result.deadlineTimeout;
}

export async function runGi088VisibleContractBurdenAbCalls(input: {
  plan: Gi088VisibleContractBurdenAbPlan;
  item: Gi088RealProblemRegressionCase;
  provider: AIProvider;
  onResult?: (
    result: Gi088VisibleContractBurdenAbCallResult
  ) => Promise<void> | void;
}) {
  const results: Gi088VisibleContractBurdenAbCallResult[] = [];
  for (const sequenceEntry of input.plan.sequence) {
    assert(
      results.length < GI088_VISIBLE_CONTRACT_BURDEN_AB_BUDGET,
      "GI088_VISIBLE_CONTRACT_BURDEN_AB_BUDGET_EXCEEDED"
    );
    const request = createGi088VisibleContractBurdenAbRequest({
      arm: sequenceEntry.arm,
      item: input.item
    });
    const requestFingerprint = shaGi088VisibleContractBurdenAb(
      canonicalGi088VisibleContractBurdenAbJson(request)
    );
    assert(
      requestFingerprint === sequenceEntry.requestFingerprint,
      `GI088_VISIBLE_CONTRACT_BURDEN_AB_REQUEST_DRIFT:${sequenceEntry.runLabel}`
    );
    const candidateFingerprint =
      input.plan.arms[sequenceEntry.arm].candidateFingerprint;
    const startedAt = new Date().toISOString();
    let result: Gi088VisibleContractBurdenAbCallResult;
    try {
      const completion = await input.provider.complete(request);
      const diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
      const timing = timingFields(diagnostics, completion.latencyMs);
      try {
        let parsedOutput: unknown;
        let visibleText: string;
        let validationIssues: string[];
        if (sequenceEntry.arm === "A") {
          const output = parseGi088RelationshipClaimStatusOutput(
            completion.content
          );
          const userMessageIds = new Set(
            input.item.candidateInput.messages
              .filter((message) => message.role === "user")
              .map((message) => message.id)
          );
          parsedOutput = output;
          visibleText = [
            output.visible.understanding,
            output.visible.response
          ]
            .filter(Boolean)
            .join("\n")
            .trim();
          validationIssues = validateGi088RelationshipClaimStatusOutput({
            output,
            userMessageIds
          });
        } else {
          const output = parseGi088ResponseFirstVisibleOutput(
            completion.content
          );
          parsedOutput = output;
          visibleText = [
            output.visible.understanding,
            output.visible.response
          ]
            .filter(Boolean)
            .join("\n")
            .trim();
          validationIssues = validateGi088ResponseFirstVisibleOutput({
            output
          });
        }
        if (!visibleText) validationIssues.push("VISIBLE_TEXT_EMPTY");
        validationIssues = [...new Set(validationIssues)];
        const responseModel =
          diagnostics?.responseModel ??
          GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.model;
        const responseModelMismatch =
          responseModel !== GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.model;
        if (responseModelMismatch) {
          validationIssues.push(`RESPONSE_MODEL_MISMATCH:${responseModel}`);
        }
        const status = responseModelMismatch
          ? ("technical_failure" as const)
          : validationIssues.length
            ? ("contract_failure" as const)
            : ("valid" as const);
        const visibleAtMs =
          status === "valid" ? timing.totalLatencyMs : null;
        result = {
          order: sequenceEntry.order,
          runLabel: sequenceEntry.runLabel,
          arm: sequenceEntry.arm,
          status,
          startedAt,
          completedAt: new Date().toISOString(),
          requestFingerprint,
          candidateFingerprint,
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel,
          ...timing,
          firstUsefulAtMs: visibleAtMs,
          fullVisibleAtMs: visibleAtMs,
          firstUsefulGatePassed:
            visibleAtMs !== null &&
            visibleAtMs <=
              GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.firstUsefulGateMs,
          fullVisibleGatePassed:
            visibleAtMs !== null &&
            visibleAtMs <=
              GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.fullVisibleGateMs,
          responseHash: shaGi088VisibleContractBurdenAb(completion.content),
          responseLength: completion.content.length,
          visibleText,
          rawOutput: completion.content,
          parsedOutput,
          validationIssues,
          errorCode: responseModelMismatch
            ? "GI088_VISIBLE_CONTRACT_BURDEN_AB_RESPONSE_MODEL_MISMATCH"
            : validationIssues.length
              ? `GI088_VISIBLE_CONTRACT_BURDEN_AB_ARM_${sequenceEntry.arm}_CONTRACT_INVALID`
              : null,
          deadlineTimeout: false,
          diagnostics
        };
      } catch (error) {
        result = {
          order: sequenceEntry.order,
          runLabel: sequenceEntry.runLabel,
          arm: sequenceEntry.arm,
          status: "contract_failure",
          startedAt,
          completedAt: new Date().toISOString(),
          requestFingerprint,
          candidateFingerprint,
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel:
            diagnostics?.responseModel ??
            GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.model,
          ...timing,
          firstUsefulAtMs: null,
          fullVisibleAtMs: null,
          firstUsefulGatePassed: false,
          fullVisibleGatePassed: false,
          responseHash: shaGi088VisibleContractBurdenAb(completion.content),
          responseLength: completion.content.length,
          visibleText: null,
          rawOutput: completion.content,
          parsedOutput: null,
          validationIssues: [
            error instanceof Error
              ? error.message
              : "GI088_VISIBLE_CONTRACT_BURDEN_AB_OUTPUT_PARSE_FAILED"
          ],
          errorCode:
            `GI088_VISIBLE_CONTRACT_BURDEN_AB_ARM_${sequenceEntry.arm}_OUTPUT_PARSE_FAILED`,
          deadlineTimeout: false,
          diagnostics
        };
      }
    } catch (error) {
      const diagnostics = sanitizeAIProviderDiagnostics(
        getAIProviderDiagnostics(error)
      );
      const errorCode = getAIProviderFailureCode(error);
      const timing = timingFields(diagnostics, null);
      const deadlineTimeout = isComparableDeadlineTimeout({
        errorCode,
        diagnostics
      });
      result = {
        order: sequenceEntry.order,
        runLabel: sequenceEntry.runLabel,
        arm: sequenceEntry.arm,
        status: "technical_failure",
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint,
        candidateFingerprint,
        httpStatus: diagnostics?.httpStatus ?? null,
        responseModel: diagnostics?.responseModel ?? null,
        ...timing,
        firstUsefulAtMs: null,
        fullVisibleAtMs: null,
        firstUsefulGatePassed: false,
        fullVisibleGatePassed: false,
        responseHash: null,
        responseLength: 0,
        visibleText: null,
        rawOutput: null,
        parsedOutput: null,
        validationIssues: [],
        errorCode,
        deadlineTimeout,
        diagnostics
      };
    }
    results.push(result);
    await input.onResult?.(result);
    if (!shouldContinueGi088VisibleContractBurdenAbAfter(result)) break;
  }
  const completedOrders = new Set(results.map((result) => result.order));
  const notRun: Gi088VisibleContractBurdenAbNotRun[] =
    results.length < input.plan.sequence.length
      ? input.plan.sequence
          .filter((entry) => !completedOrders.has(entry.order))
          .map((entry) => ({
            order: entry.order,
            runLabel: entry.runLabel,
            arm: entry.arm,
            status: "not_run" as const,
            reason: "stopped_after_non_latency_technical_failure" as const
          }))
      : [];
  assert(
    results.length + notRun.length ===
      GI088_VISIBLE_CONTRACT_BURDEN_AB_BUDGET,
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_RESULT_ACCOUNTING_MISMATCH"
  );
  return { results, notRun };
}

function comparableLatency(result: Gi088VisibleContractBurdenAbCallResult) {
  if (result.totalLatencyMs === null) return null;
  return result.status === "valid" ||
    result.status === "contract_failure" ||
    result.deadlineTimeout
    ? result.totalLatencyMs
    : null;
}

export function evaluateGi088VisibleContractBurdenAb(input: {
  results: Gi088VisibleContractBurdenAbCallResult[];
  notRun?: Gi088VisibleContractBurdenAbNotRun[];
}) {
  const notRun = input.notRun ?? [];
  const byLabel = new Map(input.results.map((result) => [result.runLabel, result]));
  const a1 = byLabel.get("A1");
  const b1 = byLabel.get("B1");
  const b2 = byLabel.get("B2");
  const a2 = byLabel.get("A2");
  const complete = Boolean(
    input.results.length === GI088_VISIBLE_CONTRACT_BURDEN_AB_BUDGET &&
      notRun.length === 0 &&
      a1 &&
      b1 &&
      b2 &&
      a2
  );
  const nonLatencyTechnicalFailure = input.results.some(
    (result) => result.status === "technical_failure" && !result.deadlineTimeout
  );
  const pairDeltasMs = {
    A1MinusB1:
      a1 && b1 &&
      comparableLatency(a1) !== null &&
      comparableLatency(b1) !== null
        ? comparableLatency(a1)! - comparableLatency(b1)!
        : null,
    A2MinusB2:
      a2 && b2 &&
      comparableLatency(a2) !== null &&
      comparableLatency(b2) !== null
        ? comparableLatency(a2)! - comparableLatency(b2)!
        : null
  };
  const strongDirection = Boolean(
    complete &&
      b1?.status === "valid" &&
      b1.firstUsefulGatePassed &&
      b2?.status === "valid" &&
      b2.firstUsefulGatePassed &&
      a1 &&
      comparableLatency(a1) !== null &&
      comparableLatency(a1)! > 45_000 &&
      a2 &&
      comparableLatency(a2) !== null &&
      comparableLatency(a2)! > 45_000
  );
  const directionalSupport = Boolean(
    complete &&
      pairDeltasMs.A1MinusB1 !== null &&
      pairDeltasMs.A1MinusB1 >= 10_000 &&
      pairDeltasMs.A2MinusB2 !== null &&
      pairDeltasMs.A2MinusB2 >= 10_000
  );
  const sharedSlow = Boolean(
    complete &&
      input.results.every((result) => {
        const latency = comparableLatency(result);
        return latency !== null && latency > 45_000;
      })
  );
  const allPass = Boolean(
    complete &&
      input.results.every(
        (result) => result.status === "valid" && result.firstUsefulGatePassed
      )
  );
  let decision: Gi088VisibleContractBurdenAbDecision;
  if (!complete || nonLatencyTechnicalFailure) {
    decision = "technical_blocked";
  } else if (strongDirection) {
    decision = "visible_contract_strong_directional_support";
  } else if (directionalSupport) {
    decision = "visible_contract_directional_support";
  } else if (sharedSlow) {
    decision = "shared_low_or_provider_slow";
  } else if (allPass) {
    decision = "burden_not_materially_reproduced";
  } else {
    decision = "inconclusive_mixed_direction";
  }
  return {
    decision,
    complete,
    nonLatencyTechnicalFailure,
    pairDeltasMs,
    strongDirection,
    directionalSupport,
    sharedSlow,
    allPass
  };
}

export function nextStepForGi088VisibleContractBurdenAb(
  decision: Gi088VisibleContractBurdenAbDecision
) {
  switch (decision) {
    case "visible_contract_strong_directional_support":
    case "visible_contract_directional_support":
      return "validate_visible_stage_semantic_fidelity_before_product_integration";
    case "shared_low_or_provider_slow":
      return "test_shared_model_or_provider_base_latency_as_next_single_factor";
    case "burden_not_materially_reproduced":
      return "treat_contract_burden_as_not_reproduced_and_test_time_period_variance";
    case "inconclusive_mixed_direction":
      return "review_mixed_direction_and_choose_one_new_factor_without_calls";
    case "technical_blocked":
      return "repair_execution_evidence_before_requesting_any_new_calls";
  }
}

async function writePrivateJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600
  });
  await rename(temporary, filePath);
  await chmod(filePath, 0o600);
}

function publicRun(result: Gi088VisibleContractBurdenAbCallResult) {
  return {
    order: result.order,
    runLabel: result.runLabel,
    arm: result.arm,
    status: result.status,
    requestFingerprint: result.requestFingerprint,
    candidateFingerprint: result.candidateFingerprint,
    httpStatus: result.httpStatus,
    responseModel: result.responseModel,
    headersLatencyMs: result.headersLatencyMs,
    bodyLatencyMs: result.bodyLatencyMs,
    totalLatencyMs: result.totalLatencyMs,
    firstUsefulAtMs: result.firstUsefulAtMs,
    fullVisibleAtMs: result.fullVisibleAtMs,
    firstUsefulGatePassed: result.firstUsefulGatePassed,
    fullVisibleGatePassed: result.fullVisibleGatePassed,
    responseHash: result.responseHash,
    responseLength: result.responseLength,
    validationIssueCount: result.validationIssues.length,
    errorCode: result.errorCode,
    deadlineTimeout: result.deadlineTimeout,
    finishReason: result.diagnostics?.finishReason ?? null,
    reasoningPresent: result.diagnostics?.reasoningPresent ?? null,
    reasoningTokens: result.diagnostics?.reasoningTokens ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null
  };
}

function buildPublicHandoff(input: {
  evaluation: ReturnType<typeof evaluateGi088VisibleContractBurdenAb>;
  results: Gi088VisibleContractBurdenAbCallResult[];
  notRun: Gi088VisibleContractBurdenAbNotRun[];
}) {
  const latencyLine = input.results
    .map((result) => `${result.runLabel}=${String(result.totalLatencyMs)}ms`)
    .join("；");
  return [
    "# GI-088｜可见合同负担 A/B 结果",
    "",
    `- 运行身份：\`${GI088_VISIBLE_CONTRACT_BURDEN_AB_IDENTITY}\``,
    `- 裁决：\`${input.evaluation.decision}\``,
    `- 已运行：\`${input.results.length}/4\`；未运行：\`${input.notRun.length}\``,
    `- 总耗时：${latencyLine || "无"}`,
    `- 成对差值：A1-B1 \`${String(input.evaluation.pairDeltasMs.A1MinusB1)}ms\`；A2-B2 \`${String(input.evaluation.pairDeltasMs.A2MinusB2)}ms\``,
    "- 语义质量：`not_evaluated`",
    "",
    "本轮只判断完整 Prompt／Skill／输出合同与首段可见合同这一组工作负担的延迟方向。模型正文与用户题目保留在私有边界；页面体验、第一段语义质量、第二段完整处理、Preview 与发布继续使用各自证据。",
    ""
  ].join("\n");
}

async function sealRun(input: {
  cwd: string;
  execution: Awaited<ReturnType<typeof loadExecutionPlan>>;
  modelCheck: unknown;
  results: Gi088VisibleContractBurdenAbCallResult[];
  notRun: Gi088VisibleContractBurdenAbNotRun[];
  preflightErrorCode?: string;
}) {
  const evaluation = evaluateGi088VisibleContractBurdenAb({
    results: input.results,
    notRun: input.notRun
  });
  const nextStep = nextStepForGi088VisibleContractBurdenAb(
    evaluation.decision
  );
  const completedAt = new Date().toISOString();
  const privateReport = {
    schemaVersion: "1.0",
    identity: GI088_VISIBLE_CONTRACT_BURDEN_AB_IDENTITY,
    status: "sealed_directional_result",
    completedAt,
    execution: input.execution,
    modelCheck: input.modelCheck,
    preflightErrorCode: input.preflightErrorCode ?? null,
    results: input.results,
    notRun: input.notRun,
    evaluation,
    semanticQuality: "not_evaluated",
    nextStep
  };
  const privateReportPath = path.join(
    input.cwd,
    PRIVATE_ROOT,
    "final-report.json"
  );
  await writePrivateJson(privateReportPath, privateReport);
  const publicReceipt = {
    schemaVersion: "1.0",
    identity: GI088_VISIBLE_CONTRACT_BURDEN_AB_IDENTITY,
    status: "sealed_directional_result",
    completedAt,
    planFingerprint: input.execution.plan.planFingerprint,
    standardSha256: input.execution.plan.inputHashes.standardSha256,
    dataset: input.execution.plan.dataset,
    case: input.execution.plan.case,
    changedFactor: input.execution.plan.changedFactor,
    fixedFactors: input.execution.plan.fixedFactors,
    arms: input.execution.plan.arms,
    sequence: input.execution.plan.sequence,
    runtime: input.execution.plan.runtime,
    evidenceHashes: {
      startCardSha256: input.execution.startCardSha256,
      authorizationSha256: input.execution.authorizationSha256,
      runnerFileSha256: input.execution.plan.inputHashes.runnerFileSha256
    },
    modelCheck: input.modelCheck,
    preflightErrorCode: input.preflightErrorCode ?? null,
    budget: {
      requested: 4,
      authorized: 4,
      consumed: input.results.length,
      notRun: input.notRun.length,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    technicalSummary: {
      valid: input.results.filter((result) => result.status === "valid").length,
      contractFailures: input.results.filter(
        (result) => result.status === "contract_failure"
      ).length,
      technicalFailures: input.results.filter(
        (result) => result.status === "technical_failure"
      ).length,
      http200: input.results.filter((result) => result.httpStatus === 200).length,
      firstUsefulGatePassed: input.results.filter(
        (result) => result.firstUsefulGatePassed
      ).length,
      fullVisibleGatePassed: input.results.filter(
        (result) => result.fullVisibleGatePassed
      ).length
    },
    runs: input.results.map(publicRun),
    notRun: input.notRun,
    decision: evaluation.decision,
    decisionChecks: evaluation,
    semanticQuality: "not_evaluated",
    nextStep,
    publicContentBoundary: {
      userText: 0,
      modelText: 0,
      hiddenReasoningText: 0,
      upstreamRequestIds: 0,
      exposed: "identity_fingerprints_timing_status_and_counts_only"
    },
    excluded: {
      judgeCalls: 0,
      hiddenSetReads: 0,
      databaseChanges: 0,
      previewChanges: 0,
      productionChanges: 0,
      commits: 0,
      pushes: 0,
      deployments: 0
    },
    stopPoint:
      "four_results_or_first_non_latency_technical_failure_no_automatic_followup"
  };
  await writeFile(
    path.join(input.cwd, PUBLIC_RECEIPT),
    `${JSON.stringify(publicReceipt, null, 2)}\n`
  );
  await writeFile(
    path.join(input.cwd, PUBLIC_HANDOFF),
    buildPublicHandoff({
      evaluation,
      results: input.results,
      notRun: input.notRun
    })
  );
  return { evaluation, nextStep, privateReportPath };
}

async function prepare() {
  const cwd = process.cwd();
  const plan = await createGi088VisibleContractBurdenAbPlan(cwd);
  await writeFile(
    path.join(cwd, PUBLIC_START_CARD),
    `${JSON.stringify(plan, null, 2)}\n`
  );
  process.stdout.write(
    `${JSON.stringify({
      identity: plan.identity,
      status: plan.status,
      planFingerprint: plan.planFingerprint,
      startCard: path.join(cwd, PUBLIC_START_CARD),
      modelCalls: 0
    }, null, 2)}\n`
  );
}

async function inspect() {
  const cwd = process.cwd();
  const plan = await createGi088VisibleContractBurdenAbPlan(cwd);
  const startCardRaw = await readFile(
    path.join(cwd, PUBLIC_START_CARD),
    "utf8"
  );
  const startCard = JSON.parse(startCardRaw);
  assert(
    canonicalGi088VisibleContractBurdenAbJson(startCard) ===
      canonicalGi088VisibleContractBurdenAbJson(plan),
    "GI088_VISIBLE_CONTRACT_BURDEN_AB_START_CARD_DRIFT"
  );
  process.stdout.write(
    `${JSON.stringify({
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      startCardSha256: shaGi088VisibleContractBurdenAb(startCardRaw),
      userPayloadSha256: plan.case.userPayloadSha256,
      sequence: plan.sequence.map((entry) => entry.arm),
      arms: plan.arms,
      modelCalls: 0
    }, null, 2)}\n`
  );
}

async function execute() {
  const cwd = process.cwd();
  const execution = await loadExecutionPlan(cwd);
  const privateRoot = path.join(cwd, PRIVATE_ROOT);
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  const reservationPath = path.join(privateRoot, "run-reservation.json");
  const reservation = await open(reservationPath, "wx", 0o600).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST") {
        throw new Error("GI088_VISIBLE_CONTRACT_BURDEN_AB_ALREADY_RESERVED");
      }
      throw error;
    }
  );
  await reservation.writeFile(
    `${JSON.stringify({
      identity: execution.plan.identity,
      planFingerprint: execution.plan.planFingerprint,
      authorizationSha256: execution.authorizationSha256,
      reservedAt: new Date().toISOString(),
      callBudget: 4,
      retries: 0,
      recovery: 0,
      fallback: 0
    })}\n`
  );
  await reservation.close();
  await chmod(reservationPath, 0o600);

  loadEnvConfig(cwd);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_VISIBLE_CONTRACT_BURDEN_AB_API_KEY_MISSING");
  let modelCheck: unknown;
  try {
    modelCheck = await assertTargetModelAvailable({ apiKey });
  } catch (error) {
    const notRun = execution.plan.sequence.map((entry) => ({
      order: entry.order,
      runLabel: entry.runLabel,
      arm: entry.arm,
      status: "not_run" as const,
      reason: "preflight_technical_failure" as const
    }));
    const preflightErrorCode =
      error instanceof Error ? error.message : "PREFLIGHT_TECHNICAL_FAILURE";
    const sealed = await sealRun({
      cwd,
      execution,
      modelCheck: null,
      results: [],
      notRun,
      preflightErrorCode
    });
    process.stdout.write(
      `${JSON.stringify({
        identity: execution.plan.identity,
        decision: sealed.evaluation.decision,
        calls: 0,
        notRun: 4,
        preflightErrorCode
      }, null, 2)}\n`
    );
    return;
  }

  const ledgerPath = path.join(privateRoot, "run-ledger.json");
  const ledger = {
    schemaVersion: "1.0",
    execution,
    modelCheck,
    status: "running",
    results: [] as Gi088VisibleContractBurdenAbCallResult[],
    notRun: [] as Gi088VisibleContractBurdenAbNotRun[]
  };
  await writePrivateJson(ledgerPath, ledger);
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_VISIBLE_CONTRACT_BURDEN_AB_RUNTIME.hardTimeoutMs
  });
  const outcome = await runGi088VisibleContractBurdenAbCalls({
    plan: execution.plan,
    item: execution.item,
    provider,
    onResult: async (result) => {
      ledger.results.push(result);
      await writePrivateJson(ledgerPath, ledger);
      process.stdout.write(
        `${JSON.stringify({
          order: result.order,
          runLabel: result.runLabel,
          arm: result.arm,
          status: result.status,
          httpStatus: result.httpStatus,
          totalLatencyMs: result.totalLatencyMs,
          callsCompleted: ledger.results.length,
          callBudget: 4
        })}\n`
      );
    }
  });
  ledger.notRun = outcome.notRun;
  ledger.status = "sealed_waiting_public_receipt";
  await writePrivateJson(ledgerPath, ledger);
  const sealed = await sealRun({
    cwd,
    execution,
    modelCheck,
    results: outcome.results,
    notRun: outcome.notRun
  });
  ledger.status = "sealed_directional_result";
  await writePrivateJson(ledgerPath, ledger);
  process.stdout.write(
    `${JSON.stringify({
      identity: execution.plan.identity,
      decision: sealed.evaluation.decision,
      pairDeltasMs: sealed.evaluation.pairDeltasMs,
      calls: outcome.results.length,
      notRun: outcome.notRun.length,
      nextStep: sealed.nextStep,
      publicReceipt: path.join(cwd, PUBLIC_RECEIPT),
      publicHandoff: path.join(cwd, PUBLIC_HANDOFF),
      privateReport: sealed.privateReportPath
    }, null, 2)}\n`
  );
}

async function main() {
  const command = process.env.GI088_VISIBLE_CONTRACT_BURDEN_AB_COMMAND;
  if (command === "prepare") return prepare();
  if (command === "execute" || process.argv.includes("--execute")) {
    return execute();
  }
  return inspect();
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_VISIBLE_CONTRACT_BURDEN_AB_COMMAND === "prepare" ||
    process.env.GI088_VISIBLE_CONTRACT_BURDEN_AB_COMMAND === "inspect" ||
    process.env.GI088_VISIBLE_CONTRACT_BURDEN_AB_COMMAND === "execute" ||
    (process.argv[1] &&
      path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
