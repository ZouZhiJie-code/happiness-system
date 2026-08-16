import { createHash } from "node:crypto";
import {
  access,
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
  parseGi088RelationshipClaimStatusOutput,
  toGi088SemanticDeltaOutput,
  validateGi088RelationshipClaimStatusOutput
} from "../evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAIProviderDiagnostics,
  type AIProvider
} from "../src/server/services/ai/ai-provider";
import {
  parseGi088SemanticDeltaOutput,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput,
  type Gi088SemanticDeltaOutput
} from "../src/server/services/evaluation/gi088/semantic-delta";
import { validateGi088StageTransitionOutput } from "../src/server/services/evaluation/gi088/stage-transition";
import {
  GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET,
  GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID,
  GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED,
  GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY,
  canonicalGi088ResponseLatencyContractAbJson,
  createGi088ResponseLatencyContractAbPlan,
  createGi088ResponseLatencyContractAbRequest,
  shaGi088ResponseLatencyContractAb,
  toGi088ResponseLatencyContractAbTurnInput,
  type Gi088ResponseLatencyContractAbArm,
  type Gi088ResponseLatencyContractAbPlan
} from "./prepare-gi088-response-latency-contract-ab";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_ROOT = `${ROOT}/.private/response-latency-contract-ab-v1`;
const PRIVATE_CASES =
  `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`;
const PUBLIC_START_CARD =
  `${ROOT}/response-latency-contract-ab-v1-start-card.json`;
const PUBLIC_AUTHORIZATION =
  `${ROOT}/response-latency-contract-ab-v1-authorization.json`;
const PUBLIC_TECHNICAL_RECEIPT =
  `${ROOT}/response-latency-contract-ab-v1-technical-receipt.json`;

export const GI088_RESPONSE_LATENCY_CONTRACT_AB_EXECUTION_EXPECTED = {
  model: "deepseek-v4-pro",
  headersTimeoutMs: 15_000,
  bodyIdleTimeoutMs: 60_000,
  hardTimeoutMs: 60_000,
  firstUsefulGateMs: 45_000,
  fullVisibleGateMs: 60_000
} as const;

export type Gi088ResponseLatencyContractAbAuthorization = {
  schemaVersion: "1.0";
  identity: typeof GI088_RESPONSE_LATENCY_CONTRACT_AB_IDENTITY;
  planFingerprint: string;
  startCardSha256: string;
  scope: "single_case_contract_latency_directional_probe";
  status: "authorized";
  authorizedAt: string;
  authorizedBy: "product_owner";
  authorizationSource: "followup_explicit_provider_call_authorization";
  caseId: typeof GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID;
  sequence: ["A", "B", "B", "A"];
  runtime: Gi088ResponseLatencyContractAbPlan["runtime"];
  executionBoundary: Record<string, number>;
  stopPoint: "four_results_or_first_non_latency_technical_failure";
};

export type Gi088ResponseLatencyContractAbExecutionPlan = {
  publicPlan: Gi088ResponseLatencyContractAbPlan;
  authorization: Gi088ResponseLatencyContractAbAuthorization;
  evidenceHashes: {
    startCardSha256: string;
    authorizationSha256: string;
  };
  item: Gi088RealProblemRegressionCase;
};

export type Gi088ResponseLatencyContractAbTechnicalStatus =
  | "valid"
  | "technical_failure"
  | "contract_failure";

export type Gi088ResponseLatencyContractAbCallResult = {
  order: number;
  runLabel: "A1" | "B1" | "B2" | "A2";
  arm: Gi088ResponseLatencyContractAbArm;
  caseId: typeof GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID;
  principleId: string;
  caseFingerprint: string;
  candidateInputFingerprint: string;
  candidateFingerprint: string;
  requestHash: string;
  startedAt: string;
  completedAt: string;
  status: Gi088ResponseLatencyContractAbTechnicalStatus;
  httpStatus: number | null;
  responseModel: string | null;
  latencyMs: number | null;
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

export type Gi088ResponseLatencyContractAbNotRun = {
  order: number;
  runLabel: "A1" | "B1" | "B2" | "A2";
  arm: Gi088ResponseLatencyContractAbArm;
  caseId: typeof GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID;
  status: "not_run";
  reason: "stopped_after_non_latency_technical_failure";
};

export type Gi088ResponseLatencyContractAbRunOutcome = {
  results: Gi088ResponseLatencyContractAbCallResult[];
  notRun: Gi088ResponseLatencyContractAbNotRun[];
  stoppedEarly: boolean;
};

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha(cwd: string, relativePath: string) {
  return sha(await readFile(path.join(cwd, relativePath)));
}

export function assertGi088ResponseLatencyContractAbAuthorization(input: {
  authorization: Gi088ResponseLatencyContractAbAuthorization;
  plan: Gi088ResponseLatencyContractAbPlan;
  startCardSha256: string;
}) {
  const { authorization, plan, startCardSha256 } = input;
  assert(
    authorization.schemaVersion === "1.0",
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_AUTHORIZATION_SCHEMA_MISMATCH"
  );
  assert(
    authorization.identity === plan.identity &&
      authorization.planFingerprint === plan.planFingerprint &&
      authorization.startCardSha256 === startCardSha256,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_AUTHORIZATION_IDENTITY_MISMATCH"
  );
  assert(
    authorization.scope === plan.scope && authorization.status === "authorized",
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_AUTHORIZATION_SCOPE_MISMATCH"
  );
  assert(
    authorization.authorizedBy === "product_owner" &&
      authorization.authorizationSource ===
        "followup_explicit_provider_call_authorization",
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_AUTHORIZATION_SOURCE_MISMATCH"
  );
  assert(
    authorization.caseId === plan.case.caseId &&
      canonicalGi088ResponseLatencyContractAbJson(authorization.sequence) ===
        canonicalGi088ResponseLatencyContractAbJson(
          plan.sequence.map((entry) => entry.arm)
        ),
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_AUTHORIZATION_SEQUENCE_MISMATCH"
  );
  assert(
    canonicalGi088ResponseLatencyContractAbJson(authorization.runtime) ===
      canonicalGi088ResponseLatencyContractAbJson(plan.runtime) &&
      authorization.runtime.callBudget ===
        GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET &&
      authorization.runtime.retries === 0 &&
      authorization.runtime.recovery === 0 &&
      authorization.runtime.fallback === 0 &&
      authorization.runtime.concurrency === 1,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_AUTHORIZATION_RUNTIME_MISMATCH"
  );
}

export async function createGi088ResponseLatencyContractAbExecutionPlan(
  cwd = process.cwd()
): Promise<Gi088ResponseLatencyContractAbExecutionPlan> {
  const publicPlan = await createGi088ResponseLatencyContractAbPlan(cwd);
  const startCardSha256 = await fileSha(cwd, PUBLIC_START_CARD);
  const startCard = JSON.parse(
    await readFile(path.join(cwd, PUBLIC_START_CARD), "utf8")
  ) as Gi088ResponseLatencyContractAbPlan;
  assert(
    startCard.planFingerprint === publicPlan.planFingerprint &&
      canonicalGi088ResponseLatencyContractAbJson(startCard) ===
        canonicalGi088ResponseLatencyContractAbJson(publicPlan),
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_START_CARD_PLAN_MISMATCH"
  );

  let authorizationRaw: string;
  try {
    authorizationRaw = await readFile(
      path.join(cwd, PUBLIC_AUTHORIZATION),
      "utf8"
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        "GI088_RESPONSE_LATENCY_CONTRACT_AB_PROVIDER_CALL_AUTHORIZATION_MISSING"
      );
    }
    throw error;
  }
  const authorization = JSON.parse(
    authorizationRaw
  ) as Gi088ResponseLatencyContractAbAuthorization;
  assertGi088ResponseLatencyContractAbAuthorization({
    authorization,
    plan: publicPlan,
    startCardSha256
  });

  const allCases = JSON.parse(
    await readFile(path.join(cwd, PRIVATE_CASES), "utf8")
  ) as Gi088RealProblemRegressionCase[];
  const item = allCases.find(
    (candidate) => candidate.caseId === publicPlan.case.caseId
  );
  assert(item, "GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_MISSING");
  assert(
    item.caseFingerprint === publicPlan.case.caseFingerprint &&
      item.candidateInputFingerprint ===
        publicPlan.case.candidateInputFingerprint &&
      item.evaluation.primaryPrincipleId === publicPlan.case.principleId,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_DRIFT"
  );
  return {
    publicPlan,
    authorization,
    evidenceHashes: {
      startCardSha256,
      authorizationSha256: sha(authorizationRaw)
    },
    item
  };
}

export async function assertGi088ResponseLatencyContractAbModelAvailable(
  input: { apiKey: string; fetchImpl?: typeof fetch }
) {
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
        "GI088_RESPONSE_LATENCY_CONTRACT_AB_AUTHENTICATION_FAILED"
      );
    }
    if (!response.ok) {
      throw new Error(
        `GI088_RESPONSE_LATENCY_CONTRACT_AB_MODELS_HTTP_${response.status}`
      );
    }
    const payload = (await response.json()) as {
      data?: Array<{ id?: unknown }>;
    };
    const models = Array.isArray(payload.data)
      ? payload.data
          .map((item) => (typeof item.id === "string" ? item.id : ""))
          .filter(Boolean)
      : [];
    assert(
      models.includes(GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.model),
      "GI088_RESPONSE_LATENCY_CONTRACT_AB_TARGET_MODEL_MISSING"
    );
    return {
      httpStatus: response.status,
      targetModelAvailable: true,
      modelListHash: sha(
        canonicalGi088ResponseLatencyContractAbJson(models.sort())
      )
    };
  } finally {
    clearTimeout(timeout);
  }
}

function collectEvidenceRefs(output: Gi088SemanticDeltaOutput) {
  const semantic = output.semantic;
  return [
    ...(semantic.workingTask?.evidenceRefs ?? []),
    ...(semantic.understandingChange.kind === "none"
      ? []
      : semantic.understandingChange.evidenceRefs),
    ...semantic.returnableTaskDelta.add.flatMap((item) => item.evidenceRefs),
    ...(semantic.nextInquiry?.evidenceRefs ?? []),
    ...(semantic.burdenSignalChange.kind === "set"
      ? semantic.burdenSignalChange.evidenceRefs
      : [])
  ];
}

function classifyIssues(issues: string[]) {
  const semanticOnlyIssues = issues.filter((issue) =>
    issue.startsWith("ASK_QUESTION_COUNT_INVALID:")
  );
  const blockingIssues = issues.filter(
    (issue) => !issue.startsWith("ASK_QUESTION_COUNT_INVALID:")
  );
  return {
    blockingIssues,
    semanticOnlyIssues,
    status: blockingIssues.length
      ? ("contract_failure" as const)
      : ("valid" as const)
  };
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

export function shouldContinueGi088ResponseLatencyContractAbAfter(
  result: Gi088ResponseLatencyContractAbCallResult
) {
  return (
    result.status !== "technical_failure" ||
    isComparableDeadlineTimeout(result)
  );
}

function timingFields(
  diagnostics: ReturnType<typeof sanitizeAIProviderDiagnostics>,
  fallbackLatencyMs: number | null
) {
  return {
    latencyMs: diagnostics?.latencyMs ?? fallbackLatencyMs,
    headersLatencyMs: diagnostics?.headersLatencyMs ?? null,
    bodyLatencyMs: diagnostics?.bodyLatencyMs ?? null,
    totalLatencyMs:
      diagnostics?.totalLatencyMs ?? diagnostics?.latencyMs ?? fallbackLatencyMs
  };
}

export async function runGi088ResponseLatencyContractAbCalls(input: {
  plan: Gi088ResponseLatencyContractAbExecutionPlan;
  provider: AIProvider;
  onResult?: (
    result: Gi088ResponseLatencyContractAbCallResult
  ) => Promise<void> | void;
}) : Promise<Gi088ResponseLatencyContractAbRunOutcome> {
  const results: Gi088ResponseLatencyContractAbCallResult[] = [];
  for (const sequenceEntry of input.plan.publicPlan.sequence) {
    assert(
      results.length < input.plan.publicPlan.runtime.callBudget,
      "GI088_RESPONSE_LATENCY_CONTRACT_AB_CALL_BUDGET_EXCEEDED"
    );
    const params = createGi088ResponseLatencyContractAbRequest({
      arm: sequenceEntry.arm,
      item: input.plan.item
    });
    const requestHash = shaGi088ResponseLatencyContractAb(
      canonicalGi088ResponseLatencyContractAbJson(params)
    );
    assert(
      requestHash === sequenceEntry.requestFingerprint,
      `GI088_RESPONSE_LATENCY_CONTRACT_AB_REQUEST_DRIFT:${sequenceEntry.runLabel}`
    );
    const turnInput = toGi088ResponseLatencyContractAbTurnInput(
      input.plan.item
    );
    const startedAt = new Date().toISOString();
    const candidateFingerprint =
      input.plan.publicPlan.arms[sequenceEntry.arm].candidateFingerprint;
    let result: Gi088ResponseLatencyContractAbCallResult;
    try {
      const completion = await input.provider.complete(params);
      const diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
      const timing = timingFields(diagnostics, completion.latencyMs);
      try {
        let output: Gi088SemanticDeltaOutput;
        let parsedOutput: unknown;
        let armSpecificIssues: string[] = [];
        if (sequenceEntry.arm === "A") {
          output = parseGi088SemanticDeltaOutput(completion.content);
          parsedOutput = output;
        } else {
          const relationshipOutput = parseGi088RelationshipClaimStatusOutput(
            completion.content
          );
          output = toGi088SemanticDeltaOutput(relationshipOutput);
          parsedOutput = relationshipOutput;
          const userMessageIds = new Set(
            turnInput.conversation
              .filter((message) => message.role === "user")
              .map((message) => message.id)
          );
          armSpecificIssues =
            validateGi088RelationshipClaimStatusOutput({
              output: relationshipOutput,
              userMessageIds
            });
        }
        const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
          turnInput,
          output
        );
        const messageIds = new Set(
          turnInput.conversation.map((message) => message.id)
        );
        const unknownSourceRefs = collectEvidenceRefs(output).filter(
          (ref) => !messageIds.has(ref)
        );
        const observedIssues = [
          ...new Set([
            ...armSpecificIssues,
            ...validateGi088SemanticDeltaOutput({
              input: turnInput,
              output
            }),
            ...validateGi088StageTransitionOutput({
              input: turnInput,
              output: compatibility
            }),
            ...unknownSourceRefs.map((ref) => `UNKNOWN_SOURCE_REF:${ref}`)
          ])
        ];
        const responseModel =
          diagnostics?.responseModel ??
          GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.model;
        const responseModelMismatch =
          responseModel !== GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.model;
        if (responseModelMismatch) {
          observedIssues.push(`RESPONSE_MODEL_MISMATCH:${responseModel}`);
        }
        const visibleText = [
          output.visible.understanding,
          output.visible.response
        ]
          .filter(Boolean)
          .join("\n")
          .trim();
        if (!visibleText) observedIssues.push("VISIBLE_TEXT_EMPTY");
        const classification = classifyIssues(observedIssues);
        const status = responseModelMismatch
          ? ("technical_failure" as const)
          : classification.status;
        const validVisibleAtMs =
          status === "valid" && visibleText
            ? timing.totalLatencyMs
            : null;
        result = {
          order: sequenceEntry.order,
          runLabel: sequenceEntry.runLabel,
          arm: sequenceEntry.arm,
          caseId: GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID,
          principleId: input.plan.item.evaluation.primaryPrincipleId,
          caseFingerprint: input.plan.item.caseFingerprint,
          candidateInputFingerprint:
            input.plan.item.candidateInputFingerprint,
          candidateFingerprint,
          requestHash,
          startedAt,
          completedAt: new Date().toISOString(),
          status,
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel,
          ...timing,
          firstUsefulAtMs: validVisibleAtMs,
          fullVisibleAtMs: validVisibleAtMs,
          firstUsefulGatePassed:
            validVisibleAtMs !== null &&
            validVisibleAtMs <=
              GI088_RESPONSE_LATENCY_CONTRACT_AB_EXECUTION_EXPECTED
                .firstUsefulGateMs,
          fullVisibleGatePassed:
            validVisibleAtMs !== null &&
            validVisibleAtMs <=
              GI088_RESPONSE_LATENCY_CONTRACT_AB_EXECUTION_EXPECTED
                .fullVisibleGateMs,
          responseHash: sha(completion.content),
          responseLength: completion.content.length,
          visibleText,
          rawOutput: completion.content,
          parsedOutput,
          validationIssues: [
            ...classification.blockingIssues,
            ...classification.semanticOnlyIssues
          ],
          errorCode: responseModelMismatch
            ? "GI088_RESPONSE_LATENCY_CONTRACT_AB_RESPONSE_MODEL_MISMATCH"
            : classification.blockingIssues.length
              ? `GI088_RESPONSE_LATENCY_CONTRACT_AB_ARM_${sequenceEntry.arm}_CONTRACT_INVALID`
              : null,
          deadlineTimeout: false,
          diagnostics
        };
      } catch (error) {
        result = {
          order: sequenceEntry.order,
          runLabel: sequenceEntry.runLabel,
          arm: sequenceEntry.arm,
          caseId: GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID,
          principleId: input.plan.item.evaluation.primaryPrincipleId,
          caseFingerprint: input.plan.item.caseFingerprint,
          candidateInputFingerprint:
            input.plan.item.candidateInputFingerprint,
          candidateFingerprint,
          requestHash,
          startedAt,
          completedAt: new Date().toISOString(),
          status: "contract_failure",
          httpStatus: diagnostics?.httpStatus ?? 200,
          responseModel:
            diagnostics?.responseModel ??
            GI088_RESPONSE_LATENCY_CONTRACT_AB_EXPECTED.model,
          ...timing,
          firstUsefulAtMs: null,
          fullVisibleAtMs: null,
          firstUsefulGatePassed: false,
          fullVisibleGatePassed: false,
          responseHash: sha(completion.content),
          responseLength: completion.content.length,
          visibleText: null,
          rawOutput: completion.content,
          parsedOutput: null,
          validationIssues: [
            error instanceof Error
              ? error.message
              : "GI088_RESPONSE_LATENCY_CONTRACT_AB_OUTPUT_PARSE_FAILED"
          ],
          errorCode:
            `GI088_RESPONSE_LATENCY_CONTRACT_AB_ARM_${sequenceEntry.arm}_OUTPUT_PARSE_FAILED`,
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
        caseId: GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID,
        principleId: input.plan.item.evaluation.primaryPrincipleId,
        caseFingerprint: input.plan.item.caseFingerprint,
        candidateInputFingerprint:
          input.plan.item.candidateInputFingerprint,
        candidateFingerprint,
        requestHash,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "technical_failure",
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
    if (!shouldContinueGi088ResponseLatencyContractAbAfter(result)) break;
  }

  const completedOrders = new Set(results.map((result) => result.order));
  const stoppedEarly = results.length < input.plan.publicPlan.sequence.length;
  const notRun = stoppedEarly
    ? input.plan.publicPlan.sequence
        .filter((entry) => !completedOrders.has(entry.order))
        .map((entry) => ({
          order: entry.order,
          runLabel: entry.runLabel,
          arm: entry.arm,
          caseId: GI088_RESPONSE_LATENCY_CONTRACT_AB_CASE_ID,
          status: "not_run" as const,
          reason: "stopped_after_non_latency_technical_failure" as const
        }))
    : [];
  assert(
    results.length + notRun.length ===
      GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET,
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_RESULT_ACCOUNTING_MISMATCH"
  );
  return { results, notRun, stoppedEarly };
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

export function createGi088ResponseLatencyContractAbPublicTechnicalReceipt(
  plan: Gi088ResponseLatencyContractAbExecutionPlan,
  modelCheck: unknown,
  outcome: Gi088ResponseLatencyContractAbRunOutcome
) {
  const { results, notRun } = outcome;
  return {
    schemaVersion: "1.0",
    identity: plan.publicPlan.identity,
    status: outcome.stoppedEarly
      ? "technical_blocked_waiting_finalization"
      : "technical_complete_waiting_finalization",
    completedAt: new Date().toISOString(),
    planFingerprint: plan.publicPlan.planFingerprint,
    standardSha256: plan.publicPlan.standardSha256,
    datasetVersion: plan.publicPlan.datasetVersion,
    datasetFingerprint: plan.publicPlan.datasetFingerprint,
    case: plan.publicPlan.case,
    arms: plan.publicPlan.arms,
    sequence: plan.publicPlan.sequence,
    inputHashes: plan.publicPlan.inputHashes,
    evidenceHashes: plan.evidenceHashes,
    runtime: plan.publicPlan.runtime,
    productDecision: plan.publicPlan.productDecision,
    modelCheck,
    budget: {
      authorized: GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET,
      consumed: results.length,
      retries: 0,
      recovery: 0,
      fallback: 0,
      notRun: notRun.length
    },
    technicalSummary: {
      valid: results.filter((item) => item.status === "valid").length,
      contractFailures: results.filter(
        (item) => item.status === "contract_failure"
      ).length,
      technicalFailures: results.filter(
        (item) => item.status === "technical_failure"
      ).length,
      deadlineTimeouts: results.filter((item) => item.deadlineTimeout).length,
      http200: results.filter((item) => item.httpStatus === 200).length,
      firstUsefulGatePassed: results.filter(
        (item) => item.firstUsefulGatePassed
      ).length,
      fullVisibleGatePassed: results.filter(
        (item) => item.fullVisibleGatePassed
      ).length
    },
    runs: results.map((item) => ({
      order: item.order,
      runLabel: item.runLabel,
      arm: item.arm,
      status: item.status,
      httpStatus: item.httpStatus,
      responseModel: item.responseModel,
      latencyMs: item.latencyMs,
      headersLatencyMs: item.headersLatencyMs,
      bodyLatencyMs: item.bodyLatencyMs,
      totalLatencyMs: item.totalLatencyMs,
      firstUsefulAtMs: item.firstUsefulAtMs,
      fullVisibleAtMs: item.fullVisibleAtMs,
      firstUsefulGatePassed: item.firstUsefulGatePassed,
      fullVisibleGatePassed: item.fullVisibleGatePassed,
      responseHash: item.responseHash,
      responseLength: item.responseLength,
      validationIssueCount: item.validationIssues.length,
      errorCode: item.errorCode,
      deadlineTimeout: item.deadlineTimeout
    })),
    notRun,
    conclusion: "pending_deterministic_directional_finalization",
    semanticQuality: "not_evaluated",
    publicContentBoundary: {
      userText: 0,
      modelText: 0,
      hiddenReasoning: 0,
      upstreamRequestIds: 0
    },
    excluded: {
      judgeCalls: 0,
      hiddenSetReads: 0,
      databaseChanges: 0,
      humanPreviewSubmissions: 0,
      previewChanges: 0,
      productionChanges: 0,
      commits: 0,
      pushes: 0,
      deployments: 0
    }
  };
}

async function execute() {
  const cwd = process.cwd();
  const plan = await createGi088ResponseLatencyContractAbExecutionPlan(cwd);
  loadEnvConfig(cwd);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RESPONSE_LATENCY_CONTRACT_AB_API_KEY_MISSING");
  const modelCheck =
    await assertGi088ResponseLatencyContractAbModelAvailable({ apiKey });

  const privateRoot = path.join(cwd, PRIVATE_ROOT);
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  const reservationPath = path.join(privateRoot, "run-reservation.json");
  const reservation = await open(reservationPath, "wx", 0o600).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST") {
        throw new Error(
          "GI088_RESPONSE_LATENCY_CONTRACT_AB_RUN_ALREADY_RESERVED"
        );
      }
      throw error;
    }
  );
  await reservation.writeFile(
    `${JSON.stringify({
      identity: plan.publicPlan.identity,
      planFingerprint: plan.publicPlan.planFingerprint,
      authorizationSha256: plan.evidenceHashes.authorizationSha256,
      reservedAt: new Date().toISOString(),
      callBudget: GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET,
      retries: 0,
      recovery: 0,
      fallback: 0
    })}\n`
  );
  await reservation.close();
  await chmod(reservationPath, 0o600);

  const ledgerPath = path.join(privateRoot, "run-ledger.json");
  const ledger = {
    schemaVersion: "1.0",
    plan,
    modelCheck,
    status: "running",
    results: [] as Gi088ResponseLatencyContractAbCallResult[],
    notRun: [] as Gi088ResponseLatencyContractAbNotRun[]
  };
  await writePrivateJson(ledgerPath, ledger);
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_RESPONSE_LATENCY_CONTRACT_AB_EXECUTION_EXPECTED.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs:
      GI088_RESPONSE_LATENCY_CONTRACT_AB_EXECUTION_EXPECTED.hardTimeoutMs
  });
  const outcome = await runGi088ResponseLatencyContractAbCalls({
    plan,
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
          callBudget: GI088_RESPONSE_LATENCY_CONTRACT_AB_BUDGET
        })}\n`
      );
    }
  });
  ledger.notRun = outcome.notRun;
  ledger.status = outcome.stoppedEarly
    ? "technical_blocked_waiting_finalization"
    : "technical_complete_waiting_finalization";
  await writePrivateJson(ledgerPath, ledger);
  await writeFile(
    path.join(cwd, PUBLIC_TECHNICAL_RECEIPT),
    `${JSON.stringify(
      createGi088ResponseLatencyContractAbPublicTechnicalReceipt(
        plan,
        modelCheck,
        outcome
      ),
      null,
      2
    )}\n`
  );
  process.stdout.write(
    `${JSON.stringify({
      identity: plan.publicPlan.identity,
      status: ledger.status,
      calls: outcome.results.length,
      notRun: outcome.notRun.length,
      privateLedger: ledgerPath,
      publicTechnicalReceipt: path.join(cwd, PUBLIC_TECHNICAL_RECEIPT)
    }, null, 2)}\n`
  );
}

async function main() {
  if (
    process.env.GI088_RESPONSE_LATENCY_CONTRACT_AB_COMMAND === "execute" ||
    process.argv.includes("--execute")
  ) {
    return execute();
  }
  const cwd = process.cwd();
  const plan = await createGi088ResponseLatencyContractAbPlan(cwd);
  const startCard = JSON.parse(
    await readFile(path.join(cwd, PUBLIC_START_CARD), "utf8")
  ) as Gi088ResponseLatencyContractAbPlan;
  assert(
    canonicalGi088ResponseLatencyContractAbJson(startCard) ===
      canonicalGi088ResponseLatencyContractAbJson(plan),
    "GI088_RESPONSE_LATENCY_CONTRACT_AB_START_CARD_PLAN_MISMATCH"
  );
  let authorizationPresent = true;
  try {
    await access(path.join(cwd, PUBLIC_AUTHORIZATION));
  } catch {
    authorizationPresent = false;
  }
  process.stdout.write(
    `${JSON.stringify({
      identity: plan.identity,
      planFingerprint: plan.planFingerprint,
      caseId: plan.case.caseId,
      sequence: plan.sequence.map((item) => item.arm),
      authorizationPresent,
      authorizedCalls: authorizationPresent ? "requires_readback" : 0,
      requestedCalls: plan.runtime.callBudget,
      executionReady: false,
      modelCalls: 0,
      stopPoint: authorizationPresent
        ? "run_full_authorization_readback_before_execution"
        : "waiting_explicit_provider_call_authorization"
    }, null, 2)}\n`
  );
}

if (
  process.env.VITEST !== "true" &&
  ((process.env.GI088_RESPONSE_LATENCY_CONTRACT_AB_COMMAND === "inspect" ||
    process.env.GI088_RESPONSE_LATENCY_CONTRACT_AB_COMMAND === "execute") ||
    (process.argv[1] &&
      path.resolve(process.argv[1]) ===
        path.resolve("scripts/run-gi088-response-latency-contract-ab.ts")))
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
