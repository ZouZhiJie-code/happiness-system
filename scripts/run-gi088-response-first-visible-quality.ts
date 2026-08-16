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
  type Board7bWorkingTaskV1SemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  createGi088ResponseFirstTwoStageCandidateIdentity,
  createGi088ResponseFirstVisibleUserPrompt,
  getGi088ResponseFirstTwoStageAssets,
  parseGi088ResponseFirstVisibleOutput,
  validateGi088ResponseFirstVisibleOutput,
  type Gi088ResponseFirstVisibleOutput
} from "../evals/event-centered-generative/gi088-response-first-two-stage-v1/candidate";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AICompletionParams,
  type AIProvider
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

export const GI088_RESPONSE_FIRST_VISIBLE_QUALITY_IDENTITY =
  "2026-08-16.gi088-response-first-visible-quality-v1" as const;
export const GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS = [
  "RPR-REAL-06",
  "RPR-REAL-19",
  "RPR-REAL-22",
  "RPR-REAL-13",
  "RPR-REAL-18",
  "RFT-CX-01"
] as const;
export const GI088_RESPONSE_FIRST_VISIBLE_QUALITY_HARD_CASE_IDS = [
  "RPR-REAL-19",
  "RPR-REAL-22",
  "RPR-REAL-13",
  "RFT-CX-01"
] as const;
export const GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME = {
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
  callBudget: 6
} as const;

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_CASES =
  `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`;
const DATASET_RECEIPT = `${ROOT}/real-problem-regression-v1.2-receipt.json`;
const PRIVATE_ROOT = `${ROOT}/.private/response-first-visible-quality-v1`;
const PUBLIC_START_CARD = `${ROOT}/response-first-visible-quality-v1-start-card.json`;
const PUBLIC_AUTHORIZATION =
  `${ROOT}/response-first-visible-quality-v1-authorization.json`;
const PUBLIC_TECHNICAL_RECEIPT =
  `${ROOT}/response-first-visible-quality-v1-technical-receipt.json`;
const PUBLIC_HANDOFF = `${ROOT}/response-first-visible-quality-v1-handoff.md`;
const PUBLIC_FINAL_RECEIPT =
  `${ROOT}/response-first-visible-quality-v1-receipt.json`;
const RUNNER_FILE = "scripts/run-gi088-response-first-visible-quality.ts";

const FILES = {
  standard: "docs/ai-evaluation-standard.md",
  datasetReceipt: DATASET_RECEIPT,
  privateCases: PRIVATE_CASES,
  candidate:
    "evals/event-centered-generative/gi088-response-first-two-stage-v1/candidate.ts",
  board7Input:
    "evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1.ts",
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
  candidateFileSha256:
    "3dfc2324a2cb67403408aa7b8eb27ff4fbf8dd8a428046149d1585ad540e6498",
  board7InputFileSha256:
    "521ec378de3ec5a43a03894f7ce77db1a190884b7653c23c61f172113fb1d61a",
  providerFileSha256:
    "75650cd9a1d8c2079a24afa2cd35a40e9c61e8951b97cf12d656732655cd7133",
  datasetVersion: "2026-08-16.gi088-real-problem-regression-v1.2",
  datasetFingerprint:
    "cf04a7584d74bb7cabb235fc0cc001ac6953fb01a90364d5690284c927c85eb1",
  reviewPacketFingerprint:
    "14e978dd3590d58ce837b6fffe51fddfbca1b81da0e68390f19babe2579b1982",
  candidateFingerprint:
    "e806843dbcf0514d133f77818255f46f8e1a7f5a2bb6b0e8a962809f755bac96",
  realCases: {
    "RPR-REAL-06": {
      caseFingerprint:
        "304dda7130959684e3a34e4c7dab11e5dae6ae6cf469f1c128f642c5088eb41b",
      candidateInputFingerprint:
        "16d361d437ca33738bdc7aada7d05968dd736ba8825df065bbc8799490c076ca",
      principleId: "QR-01"
    },
    "RPR-REAL-19": {
      caseFingerprint:
        "6385f5687671aabb0decfe3bcd3e9b81b2d58b8f5713e505f068b46d93137048",
      candidateInputFingerprint:
        "25b75bd9adaedc02104345f52b4f9b59b8c624b6c298c7001b9f4d4feb01bdb4",
      principleId: "QR-06"
    },
    "RPR-REAL-22": {
      caseFingerprint:
        "f9e3f08f99516df9cba966f350b7c2d95a6c1a20c59ef24a458471f48343b943",
      candidateInputFingerprint:
        "e081aaef3f86266f591897635c4923cda03483c1ab881fc62f4d98076e049815",
      principleId: "QR-07"
    },
    "RPR-REAL-13": {
      caseFingerprint:
        "aa6d91e160f110fb00ad93ceb1b7cf5b89476d73a2c02d0ec088d470b13429f2",
      candidateInputFingerprint:
        "4714ca6367fdc4fadd5b3a3ba20e9c33363af90b1c3c0df28b5982b803566bc5",
      principleId: "QR-08"
    },
    "RPR-REAL-18": {
      caseFingerprint:
        "cc66263f65c727500b304ecdf5ec0619e91abcf6a888f1fe05fede49e75cb9fc",
      candidateInputFingerprint:
        "4ac7f361a791b96542771b9cbc177f8327088312af44092760f7d79bd098f71b",
      principleId: "QR-05"
    }
  }
} as const;

type CaseId = (typeof GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS)[number];
type Verdict = "pass" | "minor" | "fail";

export type Gi088ResponseFirstVisibleQualityCase = {
  caseId: CaseId;
  title: string;
  category:
    | "focus"
    | "correction"
    | "control"
    | "relationship"
    | "naturalness"
    | "long_context";
  hardGate: boolean;
  privacyLevel: "private_sensitive" | "public_synthetic";
  sourceFingerprint: string;
  expectedBehavior: string;
  prohibitedRisks: string[];
  turnInput: Board7bWorkingTaskV1TurnInput;
};

export type Gi088ResponseFirstVisibleQualityCallResult = {
  order: number;
  caseId: CaseId;
  status: "valid" | "contract_failure" | "technical_failure";
  startedAt: string;
  completedAt: string;
  requestFingerprint: string;
  httpStatus: number | null;
  responseModel: string | null;
  headersLatencyMs: number | null;
  bodyLatencyMs: number | null;
  totalLatencyMs: number | null;
  firstUsefulGatePassed: boolean;
  fullVisibleGatePassed: boolean;
  responseHash: string | null;
  responseLength: number;
  rawOutput: string | null;
  output: Gi088ResponseFirstVisibleOutput | null;
  validationIssues: string[];
  errorCode: string | null;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
};

export type Gi088ResponseFirstVisibleQualityDecision = {
  caseId: CaseId;
  verdict: Verdict;
  note: string;
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

export function canonicalGi088ResponseFirstVisibleQualityJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function shaGi088ResponseFirstVisibleQuality(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return shaGi088ResponseFirstVisibleQuality(
    await readFile(path.join(cwd, relativePath))
  );
}

function syntheticLongContextState(): Board7bWorkingTaskV1SemanticState {
  return {
    stage: "explore_clarify",
    workingTask: {
      taskRef: "task-rft-cx-01",
      summary: "理解用户已经准备充分却仍会在重要表达前紧张的体验",
      evidenceRefs: ["RFT-U1"]
    },
    understandings: [
      {
        stateId: "state-rft-cx-01",
        summary: "用户已经准备充分，仍会在重要表达前紧张",
        evidenceRefs: ["RFT-U1"]
      }
    ],
    nextInquiry: null,
    invalidatedItems: [],
    returnableTasks: [],
    burdenSignal: null,
    answerOpportunities: {
      currentTaskRef: "task-rft-cx-01",
      ledgers: [
        {
          taskRef: "task-rft-cx-01",
          stage1Used: 1,
          stage2Used: 0,
          awaiting: null
        }
      ]
    }
  };
}

function syntheticLongContextCase(): Gi088ResponseFirstVisibleQualityCase {
  const conversation: Board7bWorkingTaskV1TurnInput["conversation"] = [
    {
      id: "RFT-U1",
      role: "user",
      content: "我想聊那次准备讲方案时，明明已经准备好了，还是会紧张。"
    },
    {
      id: "RFT-A1",
      role: "assistant",
      content: "你已经准备充分，紧张感还是会在重要表达前出现。"
    },
    { id: "RFT-U2", role: "user", content: "对，我想慢慢弄清这个感觉。" },
    { id: "RFT-A2", role: "assistant", content: "好，我们就沿着这个感觉聊。" },
    { id: "RFT-U3", role: "user", content: "后来我先去倒了杯水。" },
    { id: "RFT-A3", role: "assistant", content: "这个小停顿让你缓了一下。" },
    { id: "RFT-U4", role: "user", content: "回来后我把第一页又看了一遍。" },
    { id: "RFT-A4", role: "assistant", content: "你又确认了一次开头。" },
    { id: "RFT-U5", role: "user", content: "同事那时问我需不需要帮忙。" },
    { id: "RFT-A5", role: "assistant", content: "你也收到了一个可以求助的信号。" },
    { id: "RFT-U6", role: "user", content: "我说先让我自己试试。" },
    {
      id: "RFT-U7",
      role: "user",
      content: "我想继续说刚才那个感觉，先别换到别的话题。"
    }
  ];
  const turnInput: Board7bWorkingTaskV1TurnInput = {
    mode: "accompany_chat",
    conversation,
    latestUserMessageId: "RFT-U7",
    semanticState: syntheticLongContextState()
  };
  const sourceFingerprint = shaGi088ResponseFirstVisibleQuality(
    canonicalGi088ResponseFirstVisibleQualityJson(turnInput)
  );
  return {
    caseId: "RFT-CX-01",
    title: "长上下文中继续当前焦点",
    category: "long_context",
    hardGate: true,
    privacyLevel: "public_synthetic",
    sourceFingerprint,
    expectedBehavior:
      "根据当前任务和已有认识接回准备充分却仍会紧张的体验，不要求用户重新解释，也不切换话题。",
    prohibitedRisks: [
      "声称缺少上下文并要求用户重述",
      "把最近的倒水或同事帮忙改成新主话题",
      "编造紧张的具体原因"
    ],
    turnInput
  };
}

const CASE_META = {
  "RPR-REAL-06": { category: "focus", hardGate: false },
  "RPR-REAL-19": { category: "correction", hardGate: true },
  "RPR-REAL-22": { category: "control", hardGate: true },
  "RPR-REAL-13": { category: "relationship", hardGate: true },
  "RPR-REAL-18": { category: "naturalness", hardGate: false }
} as const;

export function toGi088ResponseFirstVisibleQualityCase(
  item: Gi088RealProblemRegressionCase
): Gi088ResponseFirstVisibleQualityCase {
  const caseId = item.caseId as keyof typeof CASE_META;
  const meta = CASE_META[caseId];
  assert(meta, `GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_UNEXPECTED:${item.caseId}`);
  return {
    caseId,
    title: item.title,
    category: meta.category,
    hardGate: meta.hardGate,
    privacyLevel: "private_sensitive",
    sourceFingerprint: item.caseFingerprint,
    expectedBehavior: item.evaluation.expectedBehaviorRange,
    prohibitedRisks: item.evaluation.prohibitedRisks,
    turnInput: {
      mode: "accompany_chat",
      conversation: item.candidateInput.messages,
      latestUserMessageId: item.candidateInput.messages.at(-1)!.id,
      semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
    }
  };
}

async function readBoundCases(cwd: string) {
  const allCases = JSON.parse(
    await readFile(path.join(cwd, PRIVATE_CASES), "utf8")
  ) as Gi088RealProblemRegressionCase[];
  const realIds = GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS.filter(
    (caseId) => caseId !== "RFT-CX-01"
  );
  const cases = realIds.map((caseId) => {
    const item = allCases.find((candidate) => candidate.caseId === caseId);
    assert(item, `GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_MISSING:${caseId}`);
    const expected = EXPECTED.realCases[caseId];
    assert(
      item.caseFingerprint === expected.caseFingerprint &&
        item.candidateInputFingerprint === expected.candidateInputFingerprint &&
        item.evaluation.primaryPrincipleId === expected.principleId,
      `GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_DRIFT:${caseId}`
    );
    return toGi088ResponseFirstVisibleQualityCase(item);
  });
  return [...cases, syntheticLongContextCase()];
}

export function createGi088ResponseFirstVisibleQualityRequest(
  item: Gi088ResponseFirstVisibleQualityCase
): AICompletionParams {
  const assets = getGi088ResponseFirstTwoStageAssets();
  return {
    messages: [
      { role: "system", content: assets.visible.systemPrompt },
      {
        role: "user",
        content: createGi088ResponseFirstVisibleUserPrompt(item.turnInput)
      }
    ],
    useProviderDefaultMaxTokens: true,
    headersTimeoutMs:
      GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.headersTimeoutMs,
    bodyIdleTimeoutMs:
      GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.bodyIdleTimeoutMs,
    hardTimeoutMs: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.hardTimeoutMs,
    timeoutMs: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.hardTimeoutMs,
    responseFormat: "json_object",
    thinking: "enabled",
    reasoningEffort: "low"
  };
}

export async function createGi088ResponseFirstVisibleQualityPlan(
  cwd = process.cwd()
) {
  const inputHashes = {
    standardSha256: await fileSha(cwd, FILES.standard),
    datasetReceiptSha256: await fileSha(cwd, FILES.datasetReceipt),
    privateCasesSha256: await fileSha(cwd, FILES.privateCases),
    candidateFileSha256: await fileSha(cwd, FILES.candidate),
    board7InputFileSha256: await fileSha(cwd, FILES.board7Input),
    providerFileSha256: await fileSha(cwd, FILES.provider),
    runnerFileSha256: await fileSha(cwd, FILES.runner)
  };
  for (const [key, expected] of Object.entries({
    standardSha256: EXPECTED.standardSha256,
    datasetReceiptSha256: EXPECTED.datasetReceiptSha256,
    privateCasesSha256: EXPECTED.privateCasesSha256,
    candidateFileSha256: EXPECTED.candidateFileSha256,
    board7InputFileSha256: EXPECTED.board7InputFileSha256,
    providerFileSha256: EXPECTED.providerFileSha256
  })) {
    assert(
      inputHashes[key as keyof typeof inputHashes] === expected,
      `GI088_RESPONSE_FIRST_VISIBLE_QUALITY_INPUT_DRIFT:${key}`
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
    "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_DATASET_DRIFT"
  );
  const identity = createGi088ResponseFirstTwoStageCandidateIdentity();
  assert(
    identity.candidateFingerprint === EXPECTED.candidateFingerprint,
    "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CANDIDATE_DRIFT"
  );
  const cases = await readBoundCases(cwd);
  const caseBindings = cases.map((item, index) => {
    const request = createGi088ResponseFirstVisibleQualityRequest(item);
    return {
      order: index + 1,
      caseId: item.caseId,
      category: item.category,
      hardGate: item.hardGate,
      privacyLevel: item.privacyLevel,
      sourceFingerprint: item.sourceFingerprint,
      inputFingerprint: shaGi088ResponseFirstVisibleQuality(
        canonicalGi088ResponseFirstVisibleQualityJson(item.turnInput)
      ),
      requestFingerprint: shaGi088ResponseFirstVisibleQuality(
        canonicalGi088ResponseFirstVisibleQualityJson(request)
      ),
      messageCount: item.turnInput.conversation.length,
      recentWindowCount: Math.min(8, item.turnInput.conversation.length),
      omittedEarlierMessageCount: Math.max(
        0,
        item.turnInput.conversation.length - 8
      )
    };
  });
  const core = {
    schemaVersion: "1.0" as const,
    identity: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_IDENTITY,
    status: "ready_authorized_waiting_execution" as const,
    productDecision:
      "decide_whether_response_first_visible_stage_is_semantically_safe_for_structured_stage_validation" as const,
    candidate: {
      version: identity.version,
      fingerprint: identity.candidateFingerprint
    },
    dataset: {
      sourceVersion: datasetReceipt.receiptVersion,
      sourceFingerprint: datasetReceipt.datasetFingerprint,
      reviewPacketFingerprint: datasetReceipt.reviewPacketFingerprint,
      targetedSetVersion:
        "2026-08-16.gi088-response-first-visible-quality-six-v1",
      realCases: 5,
      publicSyntheticCases: 1
    },
    cases: caseBindings,
    runtime: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME,
    qualityGate: {
      technicalValidRequired: 6,
      firstUsefulGateRequired: 6,
      fullVisibleGateRequired: 6,
      hardCaseIds: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_HARD_CASE_IDS,
      hardCasesMustPass: 4,
      softCasesMaximumMinor: 1,
      productOwnerFinalReviewRequired: true
    },
    inputHashes,
    authorization: {
      source: "current_session_explicit_implement_plan_authorization",
      providerCallsAuthorized: 6,
      retriesAuthorized: 0,
      recoveryAuthorized: 0,
      fallbackAuthorized: 0,
      judgeCallsAuthorized: 0,
      hiddenSetReadsAuthorized: 0,
      previewChangesAuthorized: 0,
      productionChangesAuthorized: 0,
      commitsAuthorized: 0,
      pushesAuthorized: 0,
      deploymentsAuthorized: 0
    },
    stopPoint:
      "six_valid_results_then_wait_product_owner_review_or_first_technical_contract_failure" as const
  };
  return {
    ...core,
    planFingerprint: shaGi088ResponseFirstVisibleQuality(
      canonicalGi088ResponseFirstVisibleQualityJson(core)
    )
  };
}

type Plan = Awaited<ReturnType<typeof createGi088ResponseFirstVisibleQualityPlan>>;

type Authorization = {
  schemaVersion: "1.0";
  identity: typeof GI088_RESPONSE_FIRST_VISIBLE_QUALITY_IDENTITY;
  status: "authorized";
  authorizedBy: "product_owner";
  authorizationSource: "current_session_explicit_implement_plan_authorization";
  planFingerprint: string;
  startCardSha256: string;
  providerCallsAuthorized: 6;
  retriesAuthorized: 0;
  recoveryAuthorized: 0;
  fallbackAuthorized: 0;
};

async function prepare() {
  const cwd = process.cwd();
  const plan = await createGi088ResponseFirstVisibleQualityPlan(cwd);
  const startCardRaw = `${JSON.stringify(plan, null, 2)}\n`;
  await writeFile(path.join(cwd, PUBLIC_START_CARD), startCardRaw);
  const authorization: Authorization = {
    schemaVersion: "1.0",
    identity: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_IDENTITY,
    status: "authorized",
    authorizedBy: "product_owner",
    authorizationSource: "current_session_explicit_implement_plan_authorization",
    planFingerprint: plan.planFingerprint,
    startCardSha256: shaGi088ResponseFirstVisibleQuality(startCardRaw),
    providerCallsAuthorized: 6,
    retriesAuthorized: 0,
    recoveryAuthorized: 0,
    fallbackAuthorized: 0
  };
  await writeFile(
    path.join(cwd, PUBLIC_AUTHORIZATION),
    `${JSON.stringify(authorization, null, 2)}\n`
  );
  process.stdout.write(
    `${JSON.stringify({
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      startCardSha256: authorization.startCardSha256,
      status: plan.status,
      providerCallsAuthorized: 6,
      modelCalls: 0
    }, null, 2)}\n`
  );
}

async function loadExecution(cwd: string) {
  const plan = await createGi088ResponseFirstVisibleQualityPlan(cwd);
  const startCardRaw = await readFile(path.join(cwd, PUBLIC_START_CARD), "utf8");
  const startCard = JSON.parse(startCardRaw) as Plan;
  assert(
    canonicalGi088ResponseFirstVisibleQualityJson(startCard) ===
      canonicalGi088ResponseFirstVisibleQualityJson(plan),
    "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_START_CARD_DRIFT"
  );
  const authorizationRaw = await readFile(
    path.join(cwd, PUBLIC_AUTHORIZATION),
    "utf8"
  );
  const authorization = JSON.parse(authorizationRaw) as Authorization;
  const startCardSha256 = shaGi088ResponseFirstVisibleQuality(startCardRaw);
  assert(
    authorization.identity === plan.identity &&
      authorization.status === "authorized" &&
      authorization.authorizedBy === "product_owner" &&
      authorization.authorizationSource ===
        "current_session_explicit_implement_plan_authorization" &&
      authorization.planFingerprint === plan.planFingerprint &&
      authorization.startCardSha256 === startCardSha256 &&
      authorization.providerCallsAuthorized === 6 &&
      authorization.retriesAuthorized === 0 &&
      authorization.recoveryAuthorized === 0 &&
      authorization.fallbackAuthorized === 0,
    "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_AUTHORIZATION_MISMATCH"
  );
  return {
    plan,
    authorization,
    startCardSha256,
    authorizationSha256: shaGi088ResponseFirstVisibleQuality(authorizationRaw),
    cases: await readBoundCases(cwd)
  };
}

async function inspect() {
  const execution = await loadExecution(process.cwd());
  process.stdout.write(
    `${JSON.stringify({
      identity: execution.plan.identity,
      planFingerprint: execution.plan.planFingerprint,
      startCardSha256: execution.startCardSha256,
      cases: execution.plan.cases,
      runtime: execution.plan.runtime,
      modelCalls: 0
    }, null, 2)}\n`
  );
}

async function assertTargetModelAvailable(apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: controller.signal
    });
    assert(
      response.status !== 401 && response.status !== 403,
      "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_AUTHENTICATION_FAILED"
    );
    assert(
      response.ok,
      `GI088_RESPONSE_FIRST_VISIBLE_QUALITY_MODELS_HTTP_${response.status}`
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
      models.includes(GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.model),
      "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_TARGET_MODEL_MISSING"
    );
    return {
      httpStatus: response.status,
      targetModelAvailable: true,
      modelListHash: shaGi088ResponseFirstVisibleQuality(
        canonicalGi088ResponseFirstVisibleQualityJson(models)
      )
    };
  } finally {
    clearTimeout(timeout);
  }
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

export async function runGi088ResponseFirstVisibleQualityCalls(input: {
  plan: Plan;
  cases: Gi088ResponseFirstVisibleQualityCase[];
  provider: AIProvider;
  onResult?: (
    result: Gi088ResponseFirstVisibleQualityCallResult
  ) => Promise<void> | void;
}) {
  const results: Gi088ResponseFirstVisibleQualityCallResult[] = [];
  for (const item of input.cases) {
    const binding = input.plan.cases.find((entry) => entry.caseId === item.caseId);
    assert(binding, `GI088_RESPONSE_FIRST_VISIBLE_QUALITY_BINDING_MISSING:${item.caseId}`);
    const request = createGi088ResponseFirstVisibleQualityRequest(item);
    const requestFingerprint = shaGi088ResponseFirstVisibleQuality(
      canonicalGi088ResponseFirstVisibleQualityJson(request)
    );
    assert(
      requestFingerprint === binding.requestFingerprint,
      `GI088_RESPONSE_FIRST_VISIBLE_QUALITY_REQUEST_DRIFT:${item.caseId}`
    );
    const startedAt = new Date().toISOString();
    let result: Gi088ResponseFirstVisibleQualityCallResult;
    try {
      const completion = await input.provider.complete(request);
      const diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
      const timing = timingFields(diagnostics, completion.latencyMs);
      try {
        const output = parseGi088ResponseFirstVisibleOutput(completion.content);
        const validationIssues = validateGi088ResponseFirstVisibleOutput({
          output
        });
        const visibleText = [output.visible.understanding, output.visible.response]
          .filter(Boolean)
          .join("\n")
          .trim();
        if (!visibleText) validationIssues.push("VISIBLE_TEXT_EMPTY");
        const responseModel =
          diagnostics?.responseModel ??
          GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.model;
        if (responseModel !== GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.model) {
          validationIssues.push(`RESPONSE_MODEL_MISMATCH:${responseModel}`);
        }
        const status = validationIssues.length
          ? ("contract_failure" as const)
          : ("valid" as const);
        const totalLatencyMs = timing.totalLatencyMs;
        result = {
          order: binding.order,
          caseId: item.caseId,
          status,
          startedAt,
          completedAt: new Date().toISOString(),
          requestFingerprint,
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel,
          ...timing,
          firstUsefulGatePassed:
            status === "valid" &&
            totalLatencyMs !== null &&
            totalLatencyMs <=
              GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.firstUsefulGateMs,
          fullVisibleGatePassed:
            status === "valid" &&
            totalLatencyMs !== null &&
            totalLatencyMs <=
              GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.fullVisibleGateMs,
          responseHash: shaGi088ResponseFirstVisibleQuality(completion.content),
          responseLength: completion.content.length,
          rawOutput: completion.content,
          output,
          validationIssues: [...new Set(validationIssues)],
          errorCode: validationIssues.length
            ? "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CONTRACT_INVALID"
            : null,
          diagnostics
        };
      } catch (error) {
        result = {
          order: binding.order,
          caseId: item.caseId,
          status: "contract_failure",
          startedAt,
          completedAt: new Date().toISOString(),
          requestFingerprint,
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel:
            diagnostics?.responseModel ??
            GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.model,
          ...timing,
          firstUsefulGatePassed: false,
          fullVisibleGatePassed: false,
          responseHash: shaGi088ResponseFirstVisibleQuality(completion.content),
          responseLength: completion.content.length,
          rawOutput: completion.content,
          output: null,
          validationIssues: [
            error instanceof Error
              ? error.message
              : "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_OUTPUT_PARSE_FAILED"
          ],
          errorCode: "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_OUTPUT_PARSE_FAILED",
          diagnostics
        };
      }
    } catch (error) {
      const diagnostics = sanitizeAIProviderDiagnostics(
        getAIProviderDiagnostics(error)
      );
      result = {
        order: binding.order,
        caseId: item.caseId,
        status: "technical_failure",
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint,
        httpStatus: diagnostics?.httpStatus ?? null,
        responseModel: diagnostics?.responseModel ?? null,
        ...timingFields(diagnostics, null),
        firstUsefulGatePassed: false,
        fullVisibleGatePassed: false,
        responseHash: null,
        responseLength: 0,
        rawOutput: null,
        output: null,
        validationIssues: [],
        errorCode: getAIProviderFailureCode(error),
        diagnostics
      };
    }
    results.push(result);
    await input.onResult?.(result);
    if (result.status !== "valid") break;
  }
  const completedIds = new Set(results.map((result) => result.caseId));
  const notRun = input.cases
    .filter((item) => !completedIds.has(item.caseId))
    .map((item) => ({
      caseId: item.caseId,
      status: "not_run" as const,
      reason: "stopped_after_technical_or_contract_failure" as const
    }));
  assert(
    results.length + notRun.length === 6,
    "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_BUDGET_ACCOUNTING_MISMATCH"
  );
  return { results, notRun };
}

function publicRun(result: Gi088ResponseFirstVisibleQualityCallResult) {
  return {
    order: result.order,
    caseId: result.caseId,
    status: result.status,
    requestFingerprint: result.requestFingerprint,
    httpStatus: result.httpStatus,
    responseModel: result.responseModel,
    headersLatencyMs: result.headersLatencyMs,
    bodyLatencyMs: result.bodyLatencyMs,
    totalLatencyMs: result.totalLatencyMs,
    firstUsefulGatePassed: result.firstUsefulGatePassed,
    fullVisibleGatePassed: result.fullVisibleGatePassed,
    responseHash: result.responseHash,
    responseLength: result.responseLength,
    validationIssueCount: result.validationIssues.length,
    errorCode: result.errorCode,
    finishReason: result.diagnostics?.finishReason ?? null,
    reasoningPresent: result.diagnostics?.reasoningPresent ?? null,
    reasoningTokens: result.diagnostics?.reasoningTokens ?? null,
    tokenUsage: result.diagnostics?.tokenUsage ?? null
  };
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

function reviewPacket(input: {
  plan: Plan;
  cases: Gi088ResponseFirstVisibleQualityCase[];
  results: Gi088ResponseFirstVisibleQualityCallResult[];
}) {
  return {
    schemaVersion: "1.0",
    identity: input.plan.identity,
    planFingerprint: input.plan.planFingerprint,
    reviewerRole: "product_owner",
    reviewStatus: "pending",
    choices: ["pass", "minor", "fail"],
    cases: input.cases.map((item) => {
      const result = input.results.find((entry) => entry.caseId === item.caseId)!;
      return {
        caseId: item.caseId,
        title: item.title,
        category: item.category,
        hardGate: item.hardGate,
        expectedBehavior: item.expectedBehavior,
        prohibitedRisks: item.prohibitedRisks,
        conversation: item.turnInput.conversation,
        activeContext: item.turnInput.semanticState,
        visible: result.output?.visible ?? null,
        timing: {
          totalLatencyMs: result.totalLatencyMs,
          firstUsefulGatePassed: result.firstUsefulGatePassed,
          fullVisibleGatePassed: result.fullVisibleGatePassed
        }
      };
    })
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reviewHtml(packet: ReturnType<typeof reviewPacket>) {
  const cards = packet.cases
    .map((item, index) => {
      const transcript = item.conversation
        .map(
          (message) =>
            `<p><strong>${message.role === "user" ? "用户" : "AI"}</strong> ${escapeHtml(message.content)}</p>`
        )
        .join("");
      const understanding = item.visible?.understanding
        ? `<p>${escapeHtml(item.visible.understanding)}</p>`
        : "";
      const response = item.visible?.response
        ? `<p>${escapeHtml(item.visible.response)}</p>`
        : "<p>无有效回应</p>";
      return `<article class="card" data-case-id="${item.caseId}">
  <div class="eyebrow">${index + 1}/6 · ${item.hardGate ? "硬门" : "普通门"} · ${escapeHtml(item.caseId)}</div>
  <h2>${escapeHtml(item.title)}</h2>
  <details><summary>查看对话上下文</summary><div class="transcript">${transcript}</div></details>
  <section><h3>本次首段回应</h3>${understanding}${response}</section>
  <section class="ruler"><h3>判断依据</h3><p>${escapeHtml(item.expectedBehavior)}</p><ul>${item.prohibitedRisks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul></section>
  <p class="timing">总耗时 ${String(item.timing.totalLatencyMs)}ms · 45 秒门 ${item.timing.firstUsefulGatePassed ? "通过" : "失败"}</p>
  <div class="choices" role="group" aria-label="${escapeHtml(item.caseId)} 裁决">
    <button type="button" data-verdict="pass">通过</button>
    <button type="button" data-verdict="minor">轻微问题</button>
    <button type="button" data-verdict="fail">失败</button>
  </div>
  <label>备注<textarea rows="3" placeholder="写清楚接住了什么，或哪里需要修改"></textarea></label>
</article>`;
    })
    .join("\n");
  const seed = JSON.stringify({
    identity: packet.identity,
    planFingerprint: packet.planFingerprint
  }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GI-088 首段六卡裁决</title>
<style>
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,sans-serif;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:860px;margin:auto;padding:40px 20px 100px}header{margin-bottom:28px}.card{background:#fffdf8;border:1px solid #d8d1c4;border-radius:22px;padding:24px;margin:18px 0;box-shadow:0 12px 35px #4d402010}.eyebrow,.timing{color:#71695d;font-size:13px}.transcript{border-left:3px solid #d8d1c4;padding-left:14px}.ruler{background:#f5f0e5;border-radius:14px;padding:14px;margin:16px 0}.choices{display:flex;gap:8px;flex-wrap:wrap}.choices button,.copy{border:1px solid #867d70;border-radius:999px;background:transparent;color:inherit;padding:10px 16px;cursor:pointer}.choices button.selected{background:#27231e;color:#fff}textarea{box-sizing:border-box;width:100%;margin-top:8px;border:1px solid #bdb4a6;border-radius:12px;padding:10px;background:transparent;color:inherit}.sticky{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#27231e;color:white;padding:12px 18px;border-radius:999px;box-shadow:0 10px 30px #0004}details{margin:12px 0}@media(prefers-reduced-motion:no-preference){button{transition:transform .15s ease}button:active{transform:scale(.97)}}@media(prefers-color-scheme:dark){:root{background:#171612;color:#f5f0e5}.card{background:#24211b;border-color:#4b453a}.ruler{background:#302c24}.choices button.selected,.sticky{background:#f5f0e5;color:#211f1b}}
</style></head><body><main class="wrap"><header><p class="eyebrow">产品负责人最终裁决</p><h1>首段六卡质量门</h1><p>四张硬门必须通过；另外两张最多一张轻微问题。完成后复制裁决 JSON 发回当前任务。</p></header>${cards}</main><button class="sticky copy" type="button">复制裁决 JSON</button>
<script>const seed=${seed};const key=seed.identity+":"+seed.planFingerprint;const state=JSON.parse(localStorage.getItem(key)||"{}");document.querySelectorAll(".card").forEach(card=>{const id=card.dataset.caseId;const textarea=card.querySelector("textarea");if(state[id]){textarea.value=state[id].note||"";card.querySelector('[data-verdict="'+state[id].verdict+'"]')?.classList.add("selected")}card.querySelectorAll("[data-verdict]").forEach(button=>button.addEventListener("click",()=>{card.querySelectorAll("[data-verdict]").forEach(item=>item.classList.remove("selected"));button.classList.add("selected");state[id]={caseId:id,verdict:button.dataset.verdict,note:textarea.value};localStorage.setItem(key,JSON.stringify(state))}));textarea.addEventListener("input",()=>{if(state[id])state[id].note=textarea.value;localStorage.setItem(key,JSON.stringify(state))})});document.querySelector(".copy").addEventListener("click",async()=>{const decisions=Array.from(document.querySelectorAll(".card")).map(card=>state[card.dataset.caseId]).filter(Boolean);const payload=JSON.stringify({...seed,reviewerRole:"product_owner",decisions},null,2);await navigator.clipboard.writeText(payload);document.querySelector(".copy").textContent=decisions.length===6?"已复制 6 张裁决":"已复制 "+decisions.length+"/6"});</script></body></html>`;
}

export function evaluateGi088ResponseFirstVisibleQualityReview(input: {
  results: Gi088ResponseFirstVisibleQualityCallResult[];
  decisions: Gi088ResponseFirstVisibleQualityDecision[];
}) {
  const decisionById = new Map(
    input.decisions.map((decision) => [decision.caseId, decision])
  );
  const technicalPassed =
    input.results.length === 6 &&
    input.results.every(
      (result) =>
        result.status === "valid" &&
        result.firstUsefulGatePassed &&
        result.fullVisibleGatePassed
    );
  const hardPassed = GI088_RESPONSE_FIRST_VISIBLE_QUALITY_HARD_CASE_IDS.every(
    (caseId) => decisionById.get(caseId)?.verdict === "pass"
  );
  const soft = ["RPR-REAL-06", "RPR-REAL-18"] as const;
  const softMinor = soft.filter(
    (caseId) => decisionById.get(caseId)?.verdict === "minor"
  ).length;
  const softFailed = soft.some(
    (caseId) => decisionById.get(caseId)?.verdict === "fail"
  );
  const complete =
    input.decisions.length === 6 &&
    GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS.every((caseId) =>
      decisionById.has(caseId)
    );
  const passed =
    complete &&
    technicalPassed &&
    hardPassed &&
    !softFailed &&
    softMinor <= 1;
  return {
    complete,
    technicalPassed,
    hardPassed,
    softMinor,
    softFailed,
    passed,
    decision: !complete
      ? ("pending_product_owner_review" as const)
      : passed
        ? ("visible_quality_gate_passed" as const)
        : ("visible_quality_gate_failed" as const)
  };
}

async function sealTechnical(input: {
  cwd: string;
  execution: Awaited<ReturnType<typeof loadExecution>>;
  modelCheck: unknown;
  results: Gi088ResponseFirstVisibleQualityCallResult[];
  notRun: Array<{ caseId: CaseId; status: "not_run"; reason: string }>;
  preflightErrorCode?: string;
}) {
  const allValid =
    input.results.length === 6 &&
    input.results.every(
      (result) =>
        result.status === "valid" &&
        result.firstUsefulGatePassed &&
        result.fullVisibleGatePassed
    );
  const status = allValid
    ? "waiting_product_owner_review"
    : "technical_or_contract_blocked";
  let packetPath: string | null = null;
  let reviewPagePath: string | null = null;
  if (allValid) {
    const packet = reviewPacket({
      plan: input.execution.plan,
      cases: input.execution.cases,
      results: input.results
    });
    packetPath = path.join(input.cwd, PRIVATE_ROOT, "review-packet.json");
    reviewPagePath = path.join(input.cwd, PRIVATE_ROOT, "index.html");
    await writePrivateJson(packetPath, packet);
    await writeFile(reviewPagePath, reviewHtml(packet), { mode: 0o600 });
    await chmod(reviewPagePath, 0o600);
  }
  const privateReport = {
    schemaVersion: "1.0",
    identity: input.execution.plan.identity,
    status,
    completedAt: new Date().toISOString(),
    execution: input.execution,
    modelCheck: input.modelCheck,
    preflightErrorCode: input.preflightErrorCode ?? null,
    results: input.results,
    notRun: input.notRun,
    productReview: "pending"
  };
  await writePrivateJson(
    path.join(input.cwd, PRIVATE_ROOT, "technical-report.json"),
    privateReport
  );
  const publicReceipt = {
    schemaVersion: "1.0",
    identity: input.execution.plan.identity,
    status,
    completedAt: privateReport.completedAt,
    planFingerprint: input.execution.plan.planFingerprint,
    standardSha256: input.execution.plan.inputHashes.standardSha256,
    candidate: input.execution.plan.candidate,
    dataset: input.execution.plan.dataset,
    cases: input.execution.plan.cases,
    runtime: input.execution.plan.runtime,
    evidenceHashes: {
      startCardSha256: input.execution.startCardSha256,
      authorizationSha256: input.execution.authorizationSha256,
      runnerFileSha256: input.execution.plan.inputHashes.runnerFileSha256
    },
    modelCheck: input.modelCheck,
    preflightErrorCode: input.preflightErrorCode ?? null,
    budget: {
      requested: 6,
      authorized: 6,
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
      firstUsefulGatePassed: input.results.filter(
        (result) => result.firstUsefulGatePassed
      ).length,
      fullVisibleGatePassed: input.results.filter(
        (result) => result.fullVisibleGatePassed
      ).length
    },
    runs: input.results.map(publicRun),
    notRun: input.notRun,
    productReview: "pending",
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
    stopPoint: allValid
      ? "wait_product_owner_six_card_review_before_structured_ab"
      : "technical_or_contract_failure_stop_remaining_books"
  };
  await writeFile(
    path.join(input.cwd, PUBLIC_TECHNICAL_RECEIPT),
    `${JSON.stringify(publicReceipt, null, 2)}\n`
  );
  await writeFile(
    path.join(input.cwd, PUBLIC_HANDOFF),
    [
      "# GI-088｜首段六题质量门",
      "",
      `- 运行身份：\`${input.execution.plan.identity}\``,
      `- 技术状态：\`${status}\``,
      `- 已运行：\`${input.results.length}/6\`；未运行：\`${input.notRun.length}\``,
      `- 技术有效：\`${publicReceipt.technicalSummary.valid}/6\``,
      `- 45 秒门：\`${publicReceipt.technicalSummary.firstUsefulGatePassed}/6\`；60 秒门：\`${publicReceipt.technicalSummary.fullVisibleGatePassed}/6\``,
      "- 产品裁决：`pending`",
      "",
      allValid
        ? "六张真实回应已保存在私有评审页，等待产品负责人裁决。裁决完成前，后台职责 A/B、后续质量调用与页面接入保持关闭。"
        : "第一门出现技术或合同失败，后续两本调用账与页面接入停止。",
      "",
      "公开回执只保存身份、指纹、耗时、状态和数量；用户输入与模型正文继续位于私有边界。",
      ""
    ].join("\n")
  );
  return { status, packetPath, reviewPagePath };
}

async function execute() {
  const cwd = process.cwd();
  const execution = await loadExecution(cwd);
  const privateRoot = path.join(cwd, PRIVATE_ROOT);
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  const reservationPath = path.join(privateRoot, "run-reservation.json");
  const reservation = await open(reservationPath, "wx", 0o600).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST") {
        throw new Error("GI088_RESPONSE_FIRST_VISIBLE_QUALITY_ALREADY_RESERVED");
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
      callBudget: 6,
      retries: 0,
      recovery: 0,
      fallback: 0
    })}\n`
  );
  await reservation.close();
  await chmod(reservationPath, 0o600);

  loadEnvConfig(cwd);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_API_KEY_MISSING");
  let modelCheck: unknown;
  try {
    modelCheck = await assertTargetModelAvailable(apiKey);
  } catch (error) {
    const notRun = execution.cases.map((item) => ({
      caseId: item.caseId,
      status: "not_run" as const,
      reason: "preflight_technical_failure"
    }));
    const preflightErrorCode =
      error instanceof Error ? error.message : "PREFLIGHT_TECHNICAL_FAILURE";
    await sealTechnical({
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
        status: "technical_or_contract_blocked",
        calls: 0,
        notRun: 6,
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
    results: [] as Gi088ResponseFirstVisibleQualityCallResult[],
    notRun: [] as Array<{
      caseId: CaseId;
      status: "not_run";
      reason: string;
    }>
  };
  await writePrivateJson(ledgerPath, ledger);
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_RUNTIME.hardTimeoutMs
  });
  const outcome = await runGi088ResponseFirstVisibleQualityCalls({
    plan: execution.plan,
    cases: execution.cases,
    provider,
    onResult: async (result) => {
      ledger.results.push(result);
      await writePrivateJson(ledgerPath, ledger);
      process.stdout.write(
        `${JSON.stringify({
          order: result.order,
          caseId: result.caseId,
          status: result.status,
          httpStatus: result.httpStatus,
          totalLatencyMs: result.totalLatencyMs,
          firstUsefulGatePassed: result.firstUsefulGatePassed,
          callsCompleted: ledger.results.length,
          callBudget: 6
        })}\n`
      );
    }
  });
  ledger.notRun = outcome.notRun;
  ledger.status = "sealed_waiting_product_review";
  await writePrivateJson(ledgerPath, ledger);
  const sealed = await sealTechnical({
    cwd,
    execution,
    modelCheck,
    results: outcome.results,
    notRun: outcome.notRun
  });
  process.stdout.write(
    `${JSON.stringify({
      identity: execution.plan.identity,
      status: sealed.status,
      calls: outcome.results.length,
      notRun: outcome.notRun.length,
      reviewPage: sealed.reviewPagePath,
      publicReceipt: path.join(cwd, PUBLIC_TECHNICAL_RECEIPT),
      publicHandoff: path.join(cwd, PUBLIC_HANDOFF)
    }, null, 2)}\n`
  );
}

async function finalize() {
  const cwd = process.cwd();
  const execution = await loadExecution(cwd);
  const report = JSON.parse(
    await readFile(path.join(cwd, PRIVATE_ROOT, "technical-report.json"), "utf8")
  ) as {
    results: Gi088ResponseFirstVisibleQualityCallResult[];
  };
  const decisions = JSON.parse(
    await readFile(path.join(cwd, PRIVATE_ROOT, "review-decisions.json"), "utf8")
  ) as {
    identity: string;
    planFingerprint: string;
    reviewerRole: string;
    decisions: Gi088ResponseFirstVisibleQualityDecision[];
  };
  assert(
    decisions.identity === execution.plan.identity &&
      decisions.planFingerprint === execution.plan.planFingerprint &&
      decisions.reviewerRole === "product_owner",
    "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_REVIEW_IDENTITY_MISMATCH"
  );
  const evaluation = evaluateGi088ResponseFirstVisibleQualityReview({
    results: report.results,
    decisions: decisions.decisions
  });
  assert(
    evaluation.complete,
    "GI088_RESPONSE_FIRST_VISIBLE_QUALITY_REVIEW_INCOMPLETE"
  );
  const finalReport = {
    schemaVersion: "1.0",
    identity: execution.plan.identity,
    completedAt: new Date().toISOString(),
    execution,
    results: report.results,
    decisions: decisions.decisions,
    evaluation
  };
  await writePrivateJson(
    path.join(cwd, PRIVATE_ROOT, "final-report.json"),
    finalReport
  );
  const publicReceipt = {
    schemaVersion: "1.0",
    identity: execution.plan.identity,
    status: evaluation.decision,
    completedAt: finalReport.completedAt,
    planFingerprint: execution.plan.planFingerprint,
    candidate: execution.plan.candidate,
    dataset: execution.plan.dataset,
    runtime: execution.plan.runtime,
    budget: {
      requested: 6,
      authorized: 6,
      consumed: report.results.length,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    technicalSummary: {
      valid: report.results.filter((result) => result.status === "valid").length,
      firstUsefulGatePassed: report.results.filter(
        (result) => result.firstUsefulGatePassed
      ).length,
      fullVisibleGatePassed: report.results.filter(
        (result) => result.fullVisibleGatePassed
      ).length
    },
    productReview: {
      reviewed: decisions.decisions.length,
      pass: decisions.decisions.filter((item) => item.verdict === "pass").length,
      minor: decisions.decisions.filter((item) => item.verdict === "minor").length,
      fail: decisions.decisions.filter((item) => item.verdict === "fail").length,
      hardPassed: evaluation.hardPassed,
      decision: evaluation.decision
    },
    publicContentBoundary: {
      userText: 0,
      modelText: 0,
      reviewNotes: 0,
      exposed: "identity_fingerprints_timing_status_and_counts_only"
    },
    nextStep: evaluation.passed
      ? "run_structured_responsibility_ab"
      : "stop_and_revise_visible_contract_with_new_identity",
    stopPoint: evaluation.passed
      ? "visible_gate_passed_structured_ab_may_start"
      : "visible_gate_failed_remaining_books_not_run"
  };
  await writeFile(
    path.join(cwd, PUBLIC_FINAL_RECEIPT),
    `${JSON.stringify(publicReceipt, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(publicReceipt, null, 2)}\n`);
}

async function main() {
  const command = process.env.GI088_RESPONSE_FIRST_VISIBLE_QUALITY_COMMAND;
  if (command === "prepare") return prepare();
  if (command === "execute" || process.argv.includes("--execute")) {
    return execute();
  }
  if (command === "finalize" || process.argv.includes("--finalize")) {
    return finalize();
  }
  return inspect();
}

if (
  process.env.VITEST !== "true" &&
  (process.env.GI088_RESPONSE_FIRST_VISIBLE_QUALITY_COMMAND ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RUNNER_FILE)))
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
