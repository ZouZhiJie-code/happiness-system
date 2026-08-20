import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1SemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  createGi088ResponseFirstInformationGainIdentity,
  getGi088ResponseFirstInformationGainAssets,
  validateGi088ResponseFirstInformationGainVisibleOutput
} from "../evals/event-centered-generative/gi088-response-first-information-gain-v1/candidate";
import {
  createGi088ResponseFirstTwoStageCandidateIdentity,
  createGi088ResponseFirstVisibleUserPrompt,
  getGi088ResponseFirstTwoStageAssets,
  parseGi088ResponseFirstVisibleOutput,
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

export const GI088_VISIBLE_INFORMATION_GAIN_AB_IDENTITY =
  "2026-08-16.gi088-visible-information-gain-ab-v1" as const;
export const GI088_VISIBLE_INFORMATION_GAIN_AB_SEQUENCE = [
  "A",
  "B",
  "B",
  "A"
] as const;
export const GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME = {
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
  callBudget: 4
} as const;

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_CASES =
  `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`;
const PRIVATE_ROOT = `${ROOT}/.private/visible-information-gain-ab-v1`;
const PUBLIC_START = `${ROOT}/visible-information-gain-ab-v1-start-card.json`;
const PUBLIC_AUTH = `${ROOT}/visible-information-gain-ab-v1-authorization.json`;
const PUBLIC_RECEIPT = `${ROOT}/visible-information-gain-ab-v1-technical-receipt.json`;
const PUBLIC_HANDOFF = `${ROOT}/visible-information-gain-ab-v1-handoff.md`;
const PUBLIC_RUNNER_FIX = `${ROOT}/visible-information-gain-ab-v1-runner-fix.json`;

const EXPECTED = {
  standardSha256:
    "08dc7aa28813a079c375b7e1341a9a7c8cf74b0957eddd750916dafa3e5c6c60",
  datasetReceiptSha256:
    "b650328e02886730c93f0093fcd357e3b964f1007698ff62022439a8e51f8a6f",
  privateCasesSha256:
    "391e735110d274ded276827895a4027927dcbd16aef327042753b075a0fa8190",
  parentCandidateFingerprint:
    "e806843dbcf0514d133f77818255f46f8e1a7f5a2bb6b0e8a962809f755bac96",
  repeatCase: {
    caseId: "RPR-REAL-19",
    caseFingerprint:
      "6385f5687671aabb0decfe3bcd3e9b81b2d58b8f5713e505f068b46d93137048",
    candidateInputFingerprint:
      "25b75bd9adaedc02104345f52b4f9b59b8c624b6c298c7001b9f4d4feb01bdb4",
    principleId: "QR-06"
  },
  longCase: {
    caseId: "RPR-REAL-21",
    caseFingerprint:
      "caeb002aa3cb9e266059a98989ca6da3d1ab8e7d1ee20169c49c60a7d0a16e7c",
    candidateInputFingerprint:
      "525940a9b108bccfde4dc03532b4a03083a557b22c944bde7fee5671c2fb8883",
    conversationFingerprint:
      "f3918c7b0ea5b8366eb70be177ce8b545441b43736650c128633874ad044c81c"
  }
} as const;

type Arm = (typeof GI088_VISIBLE_INFORMATION_GAIN_AB_SEQUENCE)[number];
type RunLabel = "A1" | "B1" | "B2" | "A2";

type CallResult = {
  order: number;
  runLabel: RunLabel;
  arm: Arm;
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
  output: Gi088ResponseFirstVisibleOutput | null;
  rawOutput: string | null;
  validationIssues: string[];
  qualityDiagnostics: string[];
  errorCode: string | null;
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>;
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

export function canonicalGi088VisibleInformationGainAb(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function shaGi088VisibleInformationGainAb(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return shaGi088VisibleInformationGainAb(
    await readFile(path.join(cwd, relativePath))
  );
}

async function writePrivate(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600
  });
  await chmod(filePath, 0o600);
}

async function readCases(cwd: string) {
  return JSON.parse(
    await readFile(path.join(cwd, PRIVATE_CASES), "utf8")
  ) as Gi088RealProblemRegressionCase[];
}

function bindCase(
  cases: Gi088RealProblemRegressionCase[],
  expected: {
    caseId: string;
    caseFingerprint: string;
    candidateInputFingerprint: string;
  }
) {
  const item = cases.find((candidate) => candidate.caseId === expected.caseId);
  assert(item, `GI088_VISIBLE_INFORMATION_GAIN_CASE_MISSING:${expected.caseId}`);
  assert(
    item.caseFingerprint === expected.caseFingerprint &&
      item.candidateInputFingerprint === expected.candidateInputFingerprint,
    `GI088_VISIBLE_INFORMATION_GAIN_CASE_DRIFT:${expected.caseId}`
  );
  return item;
}

function toTurnInput(item: Gi088RealProblemRegressionCase) {
  return {
    mode: "accompany_chat" as const,
    conversation: item.candidateInput.messages,
    latestUserMessageId: item.candidateInput.messages.at(-1)!.id,
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  } satisfies Board7bWorkingTaskV1TurnInput;
}

function realLongContextState(): Board7bWorkingTaskV1SemanticState {
  return {
    stage: "explore_clarify",
    workingTask: {
      taskRef: "task-rpr-lc-21",
      summary: "理解朋友很少主动联系、却频繁联系别人时产生的落差和自我怀疑",
      evidenceRefs: ["U1", "U7", "U8"]
    },
    understandings: [
      {
        stateId: "state-rpr-lc-21",
        summary: "用户能看到双方都可能不主动，仍会因对方和别人互动频繁而怀疑自己的价值",
        evidenceRefs: ["U1", "U6", "U7", "U8"]
      }
    ],
    nextInquiry: null,
    invalidatedItems: [],
    returnableTasks: [],
    burdenSignal: null,
    answerOpportunities: {
      currentTaskRef: "task-rpr-lc-21",
      ledgers: [
        {
          taskRef: "task-rpr-lc-21",
          stage1Used: 1,
          stage2Used: 0,
          awaiting: null
        }
      ]
    }
  };
}

export function createGi088RealLongContextAsset(
  item: Gi088RealProblemRegressionCase
) {
  assert(item.candidateInput.messages.length === 16, "GI088_REAL_LONG_CONTEXT_COUNT");
  assert(
    item.source.conversationFingerprint ===
      EXPECTED.longCase.conversationFingerprint,
    "GI088_REAL_LONG_CONTEXT_SOURCE_DRIFT"
  );
  const turnInput: Board7bWorkingTaskV1TurnInput = {
    mode: "accompany_chat",
    conversation: item.candidateInput.messages,
    latestUserMessageId: item.candidateInput.messages.at(-1)!.id,
    semanticState: realLongContextState()
  };
  const recentConversation = turnInput.conversation.slice(-8);
  return {
    assetVersion: "2026-08-16.gi088-real-long-context-rpr-real-21-v1",
    derivedCaseId: "RPR-LC-21",
    sourceCaseId: item.caseId,
    privacyLevel: "private_sensitive",
    sourceConversationFingerprint: item.source.conversationFingerprint,
    fullMessageCount: turnInput.conversation.length,
    recentWindowCount: recentConversation.length,
    omittedEarlierMessageCount:
      turnInput.conversation.length - recentConversation.length,
    omittedMessageIds: turnInput.conversation.slice(0, -8).map((entry) => entry.id),
    recentMessageIds: recentConversation.map((entry) => entry.id),
    semanticState: turnInput.semanticState,
    semanticStateFingerprint: shaGi088VisibleInformationGainAb(
      canonicalGi088VisibleInformationGainAb(turnInput.semanticState)
    ),
    expectedBehavior:
      "自然承接落差感和自我怀疑，选择一个最值得继续的具体入口，并继承朋友很少主动联系这一窗口外任务。",
    prohibitedRisks: [
      "要求用户重新说明窗口外已经表达的关系背景",
      "一次要求解释所有自我怀疑",
      "把模型推断写成用户事实"
    ],
    turnInput
  } as const;
}

export function createGi088VisibleInformationGainRequest(input: {
  arm: Arm;
  turnInput: Board7bWorkingTaskV1TurnInput;
}): AICompletionParams {
  const parent = getGi088ResponseFirstTwoStageAssets();
  const repaired = getGi088ResponseFirstInformationGainAssets();
  return {
    messages: [
      {
        role: "system",
        content:
          input.arm === "A"
            ? parent.visible.systemPrompt
            : repaired.visible.systemPrompt
      },
      {
        role: "user",
        content: createGi088ResponseFirstVisibleUserPrompt(input.turnInput)
      }
    ],
    useProviderDefaultMaxTokens: true,
    headersTimeoutMs: GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.headersTimeoutMs,
    bodyIdleTimeoutMs: GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.bodyIdleTimeoutMs,
    hardTimeoutMs: GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.hardTimeoutMs,
    timeoutMs: GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.hardTimeoutMs,
    responseFormat: "json_object",
    thinking: "enabled",
    reasoningEffort: "low"
  };
}

export async function createGi088VisibleInformationGainPlan(cwd = process.cwd()) {
  const inputHashes = {
    standardSha256: await fileSha(cwd, "docs/ai-evaluation-standard.md"),
    datasetReceiptSha256: await fileSha(
      cwd,
      `${ROOT}/real-problem-regression-v1.2-receipt.json`
    ),
    privateCasesSha256: await fileSha(cwd, PRIVATE_CASES),
    parentCandidateFileSha256: await fileSha(
      cwd,
      "evals/event-centered-generative/gi088-response-first-two-stage-v1/candidate.ts"
    ),
    repairedCandidateFileSha256: await fileSha(
      cwd,
      "evals/event-centered-generative/gi088-response-first-information-gain-v1/candidate.ts"
    ),
    providerFileSha256: await fileSha(
      cwd,
      "src/server/services/ai/openai.provider.ts"
    ),
    runnerFileSha256:
      "334d7343838fcfacbe380173d7d83f4cffc129575921b67eb9a95cb4d2768437"
  };
  assert(
    inputHashes.standardSha256 === EXPECTED.standardSha256 &&
      inputHashes.datasetReceiptSha256 === EXPECTED.datasetReceiptSha256 &&
      inputHashes.privateCasesSha256 === EXPECTED.privateCasesSha256,
    "GI088_VISIBLE_INFORMATION_GAIN_SOURCE_DRIFT"
  );
  const cases = await readCases(cwd);
  const repeatCase = bindCase(cases, EXPECTED.repeatCase);
  assert(
    repeatCase.evaluation.primaryPrincipleId === EXPECTED.repeatCase.principleId,
    "GI088_VISIBLE_INFORMATION_GAIN_PRINCIPLE_DRIFT"
  );
  const longCase = bindCase(cases, EXPECTED.longCase);
  const longContextAsset = createGi088RealLongContextAsset(longCase);
  const parentIdentity = createGi088ResponseFirstTwoStageCandidateIdentity();
  const repairedIdentity = createGi088ResponseFirstInformationGainIdentity();
  assert(
    parentIdentity.candidateFingerprint === EXPECTED.parentCandidateFingerprint &&
      repairedIdentity.parentCandidateFingerprint ===
        parentIdentity.candidateFingerprint,
    "GI088_VISIBLE_INFORMATION_GAIN_CANDIDATE_LINEAGE_DRIFT"
  );
  const turnInput = toTurnInput(repeatCase);
  const parentAssets = getGi088ResponseFirstTwoStageAssets();
  const repairedAssets = getGi088ResponseFirstInformationGainAssets();
  const arms = {
    A: {
      label: "current_visible_contract",
      candidateVersion: parentIdentity.version,
      candidateFingerprint: parentIdentity.candidateFingerprint,
      systemPromptSha256: shaGi088VisibleInformationGainAb(
        parentAssets.visible.systemPrompt
      ),
      systemPromptLength: parentAssets.visible.systemPrompt.length
    },
    B: {
      label: "information_gain_visible_contract",
      candidateVersion: repairedIdentity.version,
      candidateFingerprint: repairedIdentity.candidateFingerprint,
      systemPromptSha256: shaGi088VisibleInformationGainAb(
        repairedAssets.visible.systemPrompt
      ),
      systemPromptLength: repairedAssets.visible.systemPrompt.length
    }
  } as const;
  const labels = ["A1", "B1", "B2", "A2"] as const;
  const sequence = GI088_VISIBLE_INFORMATION_GAIN_AB_SEQUENCE.map(
    (arm, index) => {
      const request = createGi088VisibleInformationGainRequest({ arm, turnInput });
      return {
        order: index + 1,
        runLabel: labels[index],
        arm,
        requestFingerprint: shaGi088VisibleInformationGainAb(
          canonicalGi088VisibleInformationGainAb(request)
        )
      };
    }
  );
  const core = {
    schemaVersion: "1.0",
    identity: GI088_VISIBLE_INFORMATION_GAIN_AB_IDENTITY,
    status: "ready_authorized_waiting_execution",
    productDecision: "whether_information_gain_skill_repairs_repeat_question",
    changedFactor: "visible_interview_skill_information_gain_only",
    fixedFactors: {
      sameCaseAndUserPayload: true,
      sameBasePrompt: true,
      sameOutputContract: true,
      sameRecentWindow: 8,
      sharedExactRepeatProgramCheck: true,
      runtime: GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME
    },
    case: {
      caseId: repeatCase.caseId,
      caseFingerprint: repeatCase.caseFingerprint,
      candidateInputFingerprint: repeatCase.candidateInputFingerprint,
      messageCount: repeatCase.candidateInput.messages.length
    },
    longContextAsset: {
      assetVersion: longContextAsset.assetVersion,
      derivedCaseId: longContextAsset.derivedCaseId,
      sourceCaseId: longContextAsset.sourceCaseId,
      sourceConversationFingerprint:
        longContextAsset.sourceConversationFingerprint,
      fullMessageCount: longContextAsset.fullMessageCount,
      recentWindowCount: longContextAsset.recentWindowCount,
      omittedEarlierMessageCount: longContextAsset.omittedEarlierMessageCount,
      semanticStateFingerprint: longContextAsset.semanticStateFingerprint
    },
    arms,
    sequence,
    inputHashes,
    budget: {
      authorized: 4,
      consumedBeforeRun: 0,
      retries: 0,
      recovery: 0,
      fallback: 0,
      authorizationSource: "confirmed_plan_standing_authorization"
    },
    reviewGate: {
      responseReview: "product_owner_blind_four_cards",
      longContextAssetReview: "product_owner_accept_revise_or_reject",
      proceed:
        "both_B_pass_speed_gates_and_long_context_asset_is_accepted"
    },
    stopPoint:
      "after_four_calls_wait_product_owner_blind_and_asset_review"
  } as const;
  return {
    ...core,
    planFingerprint: shaGi088VisibleInformationGainAb(
      canonicalGi088VisibleInformationGainAb(core)
    )
  };
}

type Plan = Awaited<ReturnType<typeof createGi088VisibleInformationGainPlan>>;

async function assertTargetModel(apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: controller.signal
    });
    assert(response.ok, `GI088_VISIBLE_INFORMATION_GAIN_MODELS_HTTP_${response.status}`);
    const payload = (await response.json()) as { data?: Array<{ id?: unknown }> };
    const models = (payload.data ?? [])
      .map((entry) => (typeof entry.id === "string" ? entry.id : ""))
      .filter(Boolean)
      .sort();
    assert(
      models.includes(GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.model),
      "GI088_VISIBLE_INFORMATION_GAIN_TARGET_MODEL_MISSING"
    );
    return {
      httpStatus: response.status,
      targetModelAvailable: true,
      modelListHash: shaGi088VisibleInformationGainAb(
        canonicalGi088VisibleInformationGainAb(models)
      )
    };
  } finally {
    clearTimeout(timer);
  }
}

function timings(
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>,
  fallback: number | null
) {
  return {
    headersLatencyMs: diagnostics?.headersLatencyMs ?? null,
    bodyLatencyMs: diagnostics?.bodyLatencyMs ?? null,
    totalLatencyMs:
      diagnostics?.totalLatencyMs ?? diagnostics?.latencyMs ?? fallback
  };
}

export async function runGi088VisibleInformationGainCalls(input: {
  plan: Plan;
  turnInput: Board7bWorkingTaskV1TurnInput;
  provider: AIProvider;
  existingResults?: CallResult[];
  onResult?: (result: CallResult) => void | Promise<void>;
}) {
  const results: CallResult[] = [...(input.existingResults ?? [])];
  for (const entry of input.plan.sequence) {
    if (results.some((result) => result.order === entry.order)) continue;
    const request = createGi088VisibleInformationGainRequest({
      arm: entry.arm,
      turnInput: input.turnInput
    });
    assert(
      shaGi088VisibleInformationGainAb(
        canonicalGi088VisibleInformationGainAb(request)
      ) === entry.requestFingerprint,
      `GI088_VISIBLE_INFORMATION_GAIN_REQUEST_DRIFT:${entry.runLabel}`
    );
    const startedAt = new Date().toISOString();
    let result: CallResult;
    try {
      const completion = await input.provider.complete(request);
      const diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
      const timing = timings(diagnostics, completion.latencyMs);
      try {
        const output = parseGi088ResponseFirstVisibleOutput(completion.content);
        const validationIssues =
          validateGi088ResponseFirstInformationGainVisibleOutput({
            turnInput: input.turnInput,
            output
          });
        const qualityDiagnostics: string[] = validationIssues.filter(
          (issue) => issue === "VISIBLE_RESPONSE_REPEATS_PRIOR_QUESTION_EXACTLY"
        );
        const contractIssues = validationIssues.filter(
          (issue) => !qualityDiagnostics.includes(issue)
        );
        const responseModel =
          diagnostics?.responseModel ?? GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.model;
        if (responseModel !== GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.model) {
          contractIssues.push(`RESPONSE_MODEL_MISMATCH:${responseModel}`);
        }
        const status = responseModel !== GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.model
          ? "technical_failure"
          : contractIssues.length > 0
            ? "contract_failure"
            : "valid";
        result = {
          order: entry.order,
          runLabel: entry.runLabel,
          arm: entry.arm,
          status,
          startedAt,
          completedAt: new Date().toISOString(),
          requestFingerprint: entry.requestFingerprint,
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel,
          ...timing,
          firstUsefulGatePassed:
            status === "valid" &&
            timing.totalLatencyMs !== null &&
            timing.totalLatencyMs <=
              GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.firstUsefulGateMs,
          fullVisibleGatePassed:
            status === "valid" &&
            timing.totalLatencyMs !== null &&
            timing.totalLatencyMs <=
              GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.fullVisibleGateMs,
          responseHash: shaGi088VisibleInformationGainAb(completion.content),
          responseLength: completion.content.length,
          output,
          rawOutput: completion.content,
          validationIssues: [...new Set(contractIssues)],
          qualityDiagnostics: [...new Set(qualityDiagnostics)],
          errorCode:
            status === "valid"
              ? null
              : status === "technical_failure"
                ? "GI088_VISIBLE_INFORMATION_GAIN_MODEL_MISMATCH"
                : "GI088_VISIBLE_INFORMATION_GAIN_CONTRACT_INVALID",
          diagnostics
        };
      } catch (error) {
        result = {
          order: entry.order,
          runLabel: entry.runLabel,
          arm: entry.arm,
          status: "contract_failure",
          startedAt,
          completedAt: new Date().toISOString(),
          requestFingerprint: entry.requestFingerprint,
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel: diagnostics?.responseModel ?? null,
          ...timing,
          firstUsefulGatePassed: false,
          fullVisibleGatePassed: false,
          responseHash: shaGi088VisibleInformationGainAb(completion.content),
          responseLength: completion.content.length,
          output: null,
          rawOutput: completion.content,
          validationIssues: [
            error instanceof Error ? error.message : "OUTPUT_PARSE_FAILED"
          ],
          qualityDiagnostics: [],
          errorCode: "GI088_VISIBLE_INFORMATION_GAIN_OUTPUT_PARSE_FAILED",
          diagnostics
        };
      }
    } catch (error) {
      const diagnostics = sanitizeAIProviderDiagnostics(
        getAIProviderDiagnostics(error)
      );
      result = {
        order: entry.order,
        runLabel: entry.runLabel,
        arm: entry.arm,
        status: "technical_failure",
        startedAt,
        completedAt: new Date().toISOString(),
        requestFingerprint: entry.requestFingerprint,
        httpStatus: diagnostics?.httpStatus ?? null,
        responseModel: diagnostics?.responseModel ?? null,
        ...timings(diagnostics, null),
        firstUsefulGatePassed: false,
        fullVisibleGatePassed: false,
        responseHash: null,
        responseLength: 0,
        output: null,
        rawOutput: null,
        validationIssues: [],
        qualityDiagnostics: [],
        errorCode: getAIProviderFailureCode(error),
        diagnostics
      };
    }
    results.push(result);
    await input.onResult?.(result);
    if (result.status !== "valid") break;
  }
  const completedOrders = new Set(results.map((entry) => entry.order));
  const notRun = input.plan.sequence
    .filter((entry) => !completedOrders.has(entry.order))
    .map((entry) => ({ ...entry, status: "not_run" as const }));
  assert(results.length + notRun.length === 4, "GI088_VISIBLE_INFORMATION_GAIN_BUDGET_ACCOUNTING");
  return { results, notRun };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reviewHtml(input: {
  plan: Plan;
  repeatCase: Gi088RealProblemRegressionCase;
  results: CallResult[];
  longAsset: ReturnType<typeof createGi088RealLongContextAsset>;
}) {
  const blindOrder: RunLabel[] = ["B2", "A1", "A2", "B1"];
  const byLabel = new Map(input.results.map((entry) => [entry.runLabel, entry]));
  const cards = blindOrder.map((label, index) => {
    const result = byLabel.get(label)!;
    const visible = result.output?.visible;
    return `<article class="card" data-card-id="CARD-${index + 1}"><p class="eyebrow">回应 ${index + 1}/4 · ${result.totalLatencyMs ?? "-"}ms</p><h2>模型回应</h2><p>${escapeHtml(visible?.understanding ?? "")}</p><p>${escapeHtml(visible?.response ?? "")}</p><div class="choices"><button data-verdict="pass">通过</button><button data-verdict="minor">轻微问题</button><button data-verdict="fail">失败</button></div><textarea placeholder="评价原因"></textarea></article>`;
  }).join("\n");
  const transcript = input.repeatCase.candidateInput.messages
    .map((message) => `<p><strong>${message.role === "user" ? "用户" : "AI"}</strong>：${escapeHtml(message.content)}</p>`)
    .join("\n");
  const longTranscript = input.longAsset.turnInput.conversation
    .map((message, index) => `<p class="${index < 8 ? "omitted" : "recent"}"><strong>${message.id} · ${message.role === "user" ? "用户" : "AI"}</strong>：${escapeHtml(message.content)}</p>`)
    .join("\n");
  const assetSummary = escapeHtml(
    JSON.stringify(input.longAsset.semanticState, null, 2)
  );
  const privateSeed = {
    identity: input.plan.identity,
    planFingerprint: input.plan.planFingerprint,
    blindMap: Object.fromEntries(
      blindOrder.map((label, index) => [`CARD-${index + 1}`, label])
    )
  };
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GI-088 信息增益 A/B 盲评</title><style>:root{font-family:ui-sans-serif,system-ui;background:#f4f1ea;color:#211f1b}body{margin:0}.wrap{max-width:920px;margin:auto;padding:36px 20px 110px}.card,.context{background:#fffdf8;border:1px solid #d8d1c4;border-radius:20px;padding:22px;margin:18px 0}.eyebrow{color:#71695d;font-size:13px}.choices{display:flex;gap:8px}.choices button,.copy{border:1px solid #867d70;border-radius:999px;background:transparent;padding:9px 15px}.choices button.selected{background:#27231e;color:#fff}textarea{box-sizing:border-box;width:100%;margin-top:10px;padding:10px}.omitted{border-left:3px solid #b58b54;padding-left:10px}.recent{border-left:3px solid #708b6d;padding-left:10px}pre{white-space:pre-wrap;background:#f3eee4;padding:12px;border-radius:12px}.sticky{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#27231e;color:#fff}.asset-choices{display:flex;gap:8px}@media(prefers-color-scheme:dark){:root{background:#171612;color:#f5f0e5}.card,.context{background:#24211b;border-color:#4b453a}pre{background:#302c24}}</style></head><body><main class="wrap"><h1>重复追问 A/B 与真实长上下文联合评审</h1><section class="context"><h2>失败场景完整上下文</h2>${transcript}</section>${cards}<section class="card asset" data-card-id="ASSET-RPR-LC-21"><p class="eyebrow">真实长上下文资产 · 16 条消息</p><h2>请确认对话质量、8 条窗口切分与状态摘要</h2><p>棕色为窗口外 8 条，绿色为最近 8 条。</p>${longTranscript}<h3>结构化状态</h3><pre>${assetSummary}</pre><div class="asset-choices"><button data-verdict="accept">接受</button><button data-verdict="revise">需修订</button><button data-verdict="reject">拒绝</button></div><textarea placeholder="资产评价"></textarea></section></main><button class="copy sticky">复制联合裁决 JSON</button><script>const seed=${JSON.stringify(privateSeed)};const state={responses:{},asset:null};document.querySelectorAll('.card:not(.asset)').forEach(card=>{card.querySelectorAll('[data-verdict]').forEach(button=>button.addEventListener('click',()=>{card.querySelectorAll('[data-verdict]').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');state.responses[card.dataset.cardId]={cardId:card.dataset.cardId,verdict:button.dataset.verdict,note:card.querySelector('textarea').value}}));card.querySelector('textarea').addEventListener('input',()=>{if(state.responses[card.dataset.cardId])state.responses[card.dataset.cardId].note=card.querySelector('textarea').value})});const asset=document.querySelector('.asset');asset.querySelectorAll('[data-verdict]').forEach(button=>button.addEventListener('click',()=>{asset.querySelectorAll('[data-verdict]').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');state.asset={assetId:'RPR-LC-21',verdict:button.dataset.verdict,note:asset.querySelector('textarea').value}}));asset.querySelector('textarea').addEventListener('input',()=>{if(state.asset)state.asset.note=asset.querySelector('textarea').value});document.querySelector('.copy').addEventListener('click',async()=>{const payload={identity:seed.identity,planFingerprint:seed.planFingerprint,reviewerRole:'product_owner',responses:Object.values(state.responses),asset:state.asset};await navigator.clipboard.writeText(JSON.stringify(payload,null,2));document.querySelector('.copy').textContent='已复制 '+payload.responses.length+'/4 + 资产'});</script></body></html>`;
}

async function prepare(cwd: string) {
  const plan = await createGi088VisibleInformationGainPlan(cwd);
  await writeFile(path.join(cwd, PUBLIC_START), `${JSON.stringify(plan, null, 2)}\n`);
  const startRaw = await readFile(path.join(cwd, PUBLIC_START), "utf8");
  const authorization = {
    schemaVersion: "1.0",
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    startCardSha256: shaGi088VisibleInformationGainAb(startRaw),
    status: "authorized",
    authorizedBy: "product_owner",
    authorizationSource: "confirmed_plan_standing_authorization",
    providerCallsAuthorized: 4,
    retriesAuthorized: 0,
    stopPoint: plan.stopPoint
  };
  await writeFile(path.join(cwd, PUBLIC_AUTH), `${JSON.stringify(authorization, null, 2)}\n`);
  return { plan, authorization };
}

function normalizeExistingResults(results: CallResult[]) {
  return results.map((result) => {
    const repeatIssue = result.validationIssues.includes(
      "VISIBLE_RESPONSE_REPEATS_PRIOR_QUESTION_EXACTLY"
    );
    if (!repeatIssue || result.status !== "contract_failure") return result;
    const validationIssues = result.validationIssues.filter(
      (issue) => issue !== "VISIBLE_RESPONSE_REPEATS_PRIOR_QUESTION_EXACTLY"
    );
    return {
      ...result,
      status: validationIssues.length === 0 ? ("valid" as const) : result.status,
      firstUsefulGatePassed:
        validationIssues.length === 0 &&
        result.totalLatencyMs !== null &&
        result.totalLatencyMs <=
          GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.firstUsefulGateMs,
      fullVisibleGatePassed:
        validationIssues.length === 0 &&
        result.totalLatencyMs !== null &&
        result.totalLatencyMs <=
          GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.fullVisibleGateMs,
      validationIssues,
      qualityDiagnostics: [
        ...new Set([
          ...(result.qualityDiagnostics ?? []),
          "VISIBLE_RESPONSE_REPEATS_PRIOR_QUESTION_EXACTLY"
        ])
      ],
      errorCode: validationIssues.length === 0 ? null : result.errorCode
    };
  });
}

async function execute(cwd: string, resume = false) {
  const plan = await createGi088VisibleInformationGainPlan(cwd);
  const startRaw = await readFile(path.join(cwd, PUBLIC_START), "utf8");
  const start = JSON.parse(startRaw) as Plan;
  assert(
    canonicalGi088VisibleInformationGainAb(start) ===
      canonicalGi088VisibleInformationGainAb(plan),
    "GI088_VISIBLE_INFORMATION_GAIN_START_DRIFT"
  );
  const auth = JSON.parse(
    await readFile(path.join(cwd, PUBLIC_AUTH), "utf8")
  ) as Record<string, unknown>;
  assert(
    auth.identity === plan.identity &&
      auth.planFingerprint === plan.planFingerprint &&
      auth.startCardSha256 === shaGi088VisibleInformationGainAb(startRaw) &&
      auth.providerCallsAuthorized === 4,
    "GI088_VISIBLE_INFORMATION_GAIN_AUTH_DRIFT"
  );
  await mkdir(path.join(cwd, PRIVATE_ROOT), { recursive: true, mode: 0o700 });
  await chmod(path.join(cwd, PRIVATE_ROOT), 0o700);
  const reservationPath = path.join(cwd, PRIVATE_ROOT, "run-reservation.json");
  let existingResults: CallResult[] = [];
  if (resume) {
    const runnerFix = JSON.parse(
      await readFile(path.join(cwd, PUBLIC_RUNNER_FIX), "utf8")
    ) as {
      identity: string;
      planFingerprint: string;
      previousRunnerSha256: string;
      fixedRunnerSha256: string;
      status: string;
    };
    assert(
      runnerFix.identity === plan.identity &&
        runnerFix.planFingerprint === plan.planFingerprint &&
        runnerFix.previousRunnerSha256 === plan.inputHashes.runnerFileSha256 &&
        runnerFix.fixedRunnerSha256 ===
          (await fileSha(cwd, "scripts/run-gi088-visible-information-gain-ab.ts")) &&
        runnerFix.status === "approved_in_scope_classification_fix",
      "GI088_VISIBLE_INFORMATION_GAIN_RUNNER_FIX_DRIFT"
    );
    const previous = JSON.parse(
      await readFile(path.join(cwd, PRIVATE_ROOT, "technical-report.json"), "utf8")
    ) as { identity: string; planFingerprint: string; results: CallResult[] };
    assert(
      previous.identity === plan.identity &&
        previous.planFingerprint === plan.planFingerprint &&
        previous.results.length > 0 &&
        previous.results.length < 4,
      "GI088_VISIBLE_INFORMATION_GAIN_RESUME_STATE_INVALID"
    );
    existingResults = normalizeExistingResults(previous.results);
  } else {
    try {
      await readFile(reservationPath, "utf8");
      throw new Error("GI088_VISIBLE_INFORMATION_GAIN_IDENTITY_ALREADY_RESERVED");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "GI088_VISIBLE_INFORMATION_GAIN_IDENTITY_ALREADY_RESERVED"
      ) throw error;
    }
    await writePrivate(reservationPath, {
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      reservedAt: new Date().toISOString(),
      status: "reserved"
    });
  }
  loadEnvConfig(cwd);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_VISIBLE_INFORMATION_GAIN_API_KEY_MISSING");
  const modelCheck = await assertTargetModel(apiKey);
  const cases = await readCases(cwd);
  const repeatCase = bindCase(cases, EXPECTED.repeatCase);
  const longCase = bindCase(cases, EXPECTED.longCase);
  const longAsset = createGi088RealLongContextAsset(longCase);
  const provider = new OpenAIProvider({
    apiKey,
    baseUrl: "https://api.deepseek.com",
    model: GI088_VISIBLE_INFORMATION_GAIN_AB_RUNTIME.model
  });
  const { results, notRun } = await runGi088VisibleInformationGainCalls({
    plan,
    turnInput: toTurnInput(repeatCase),
    provider,
    existingResults,
    onResult: (result) => {
      process.stdout.write(`${JSON.stringify({ order: result.order, runLabel: result.runLabel, status: result.status, totalLatencyMs: result.totalLatencyMs, callsCompleted: result.order })}\n`);
    }
  });
  const privateReport = {
    schemaVersion: "1.0",
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status:
      results.length === 4 && results.every((entry) => entry.status === "valid")
        ? "waiting_product_owner_blind_and_asset_review"
        : "technical_or_contract_blocked",
    modelCheck,
    results,
    notRun,
    longAsset
  };
  await writePrivate(path.join(cwd, PRIVATE_ROOT, "technical-report.json"), privateReport);
  const technicalPassed = results.length === 4 &&
    results.every(
      (entry) =>
        entry.status === "valid" &&
        entry.firstUsefulGatePassed &&
        entry.fullVisibleGatePassed
    );
  if (technicalPassed) {
    await writePrivate(
      path.join(cwd, PRIVATE_ROOT, "review-packet.json"),
      { identity: plan.identity, planFingerprint: plan.planFingerprint, results, longAsset }
    );
    const htmlPath = path.join(cwd, PRIVATE_ROOT, "index.html");
    await writeFile(
      htmlPath,
      reviewHtml({ plan, repeatCase, results, longAsset }),
      { mode: 0o600 }
    );
    await chmod(htmlPath, 0o600);
  }
  const publicReceipt = {
    schemaVersion: "1.0",
    identity: plan.identity,
    planFingerprint: plan.planFingerprint,
    status: technicalPassed
      ? "waiting_product_owner_blind_and_asset_review"
      : "technical_or_contract_blocked",
    modelCheck,
    budget: {
      authorized: 4,
      consumed: results.length,
      notRun: notRun.length,
      retries: 0,
      recovery: 0,
      fallback: 0
    },
    technicalSummary: {
      valid: results.filter((entry) => entry.status === "valid").length,
      firstUsefulGatePassed: results.filter((entry) => entry.firstUsefulGatePassed).length,
      fullVisibleGatePassed: results.filter((entry) => entry.fullVisibleGatePassed).length,
      timingsMs: results.map((entry) => ({
        order: entry.order,
        totalLatencyMs: entry.totalLatencyMs
      }))
    },
    longContextAsset: plan.longContextAsset,
    publicContentBoundary: {
      userText: 0,
      modelText: 0,
      reviewNotes: 0
    },
    stopPoint: plan.stopPoint
  };
  await writeFile(path.join(cwd, PUBLIC_RECEIPT), `${JSON.stringify(publicReceipt, null, 2)}\n`);
  await writeFile(
    path.join(cwd, PUBLIC_HANDOFF),
    `# GI-088｜信息增益首段 A/B\n\n- 身份：\`${plan.identity}\`\n- 状态：\`${publicReceipt.status}\`\n- 调用：\`${results.length}/4\`；未运行：\`${notRun.length}\`\n- 技术有效：\`${publicReceipt.technicalSummary.valid}/4\`\n- 45 秒门：\`${publicReceipt.technicalSummary.firstUsefulGatePassed}/4\`；60 秒门：\`${publicReceipt.technicalSummary.fullVisibleGatePassed}/4\`\n- 产品裁决：\`pending\`\n\n公开材料只保存身份、指纹、耗时、状态和数量。四份回应、盲化映射、真实长上下文和评价继续位于私有边界。\n`
  );
  return {
    identity: plan.identity,
    status: publicReceipt.status,
    calls: results.length,
    notRun: notRun.length,
    reviewPage: technicalPassed ? path.join(cwd, PRIVATE_ROOT, "index.html") : null,
    publicReceipt: path.join(cwd, PUBLIC_RECEIPT)
  };
}

async function main() {
  const cwd = process.cwd();
  const command = process.env.GI088_VISIBLE_INFORMATION_GAIN_AB_COMMAND ?? "inspect";
  if (command === "prepare") {
    const result = await prepare(cwd);
    process.stdout.write(`${JSON.stringify({ identity: result.plan.identity, planFingerprint: result.plan.planFingerprint, status: result.plan.status, providerCallsAuthorized: 4 }, null, 2)}\n`);
    return;
  }
  if (command === "execute") {
    process.stdout.write(`${JSON.stringify(await execute(cwd), null, 2)}\n`);
    return;
  }
  if (command === "resume") {
    process.stdout.write(`${JSON.stringify(await execute(cwd, true), null, 2)}\n`);
    return;
  }
  const plan = await createGi088VisibleInformationGainPlan(cwd);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (process.env.GI088_VISIBLE_INFORMATION_GAIN_AB_COMMAND) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
