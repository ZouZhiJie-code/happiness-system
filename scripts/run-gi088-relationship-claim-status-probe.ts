import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  getGi088RelationshipClaimStatusCandidateAssets,
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
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput
} from "../src/server/services/evaluation/gi088/semantic-delta";
import {
  createGi088StageTransitionUserPrompt,
  validateGi088StageTransitionOutput
} from "../src/server/services/evaluation/gi088/stage-transition";
import {
  GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET,
  GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY,
  createGi088RelationshipClaimStatusProbePlan,
  type Gi088RelationshipClaimStatusProbePlan
} from "./prepare-gi088-relationship-claim-status-probe";
import type { Gi088RealProblemRegressionCase } from "./prepare-gi088-real-problem-regression";

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const PRIVATE_ROOT = `${ROOT}/.private/relationship-claim-status-probe-v1`;
const PRIVATE_CASES = `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`;
const PUBLIC_START_CARD = `${ROOT}/relationship-claim-status-probe-v1-start-card.json`;
const PUBLIC_AUTHORIZATION = `${ROOT}/relationship-claim-status-probe-v1-authorization.json`;
const PUBLIC_TECHNICAL_RECEIPT = `${ROOT}/relationship-claim-status-probe-v1-technical-receipt.json`;

export const GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED = {
  startCardSha256:
    "56f90abe4d45da3aa005ed41c634f8825ba04ef8b7257c2b75ec45a9d66e10de",
  authorizationSha256:
    "65513b12f57a432eab1fdf670e5805adaacf28ef87e57ef33052539d39ce41a6",
  model: "deepseek-v4-pro",
  headersTimeoutMs: 15_000,
  bodyIdleTimeoutMs: 45_000,
  hardTimeoutMs: 120_000
} as const;

export type Gi088RelationshipClaimStatusProbeAuthorization = {
  schemaVersion: "1.0";
  identity: typeof GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_IDENTITY;
  planFingerprint: string;
  probeSetFingerprint: string;
  scope: "two_target_case_semantic_probe";
  status: "authorized";
  authorizedAt: string;
  authorizedBy: "product_owner";
  authorizationSource: "current_session_explicit_authorization";
  runtime: {
    model: "deepseek-v4-pro";
    thinking: "enabled";
    reasoningEffort: "high";
    responseFormat: "json_object";
    hardTimeoutMs: 120_000;
    concurrency: 1;
    retries: 0;
    callBudget: 2;
  };
  cases: ["RPR-REAL-13", "RPR-CF-02"];
  executionBoundary: Record<string, number>;
  stopPoint: "two_results_and_codex_content_decision";
};

export type Gi088RelationshipClaimStatusProbeExecutionPlan = {
  publicPlan: Gi088RelationshipClaimStatusProbePlan;
  authorization: Gi088RelationshipClaimStatusProbeAuthorization;
  evidenceHashes: {
    startCardSha256: string;
    authorizationSha256: string;
  };
  runtime: Gi088RelationshipClaimStatusProbePlan["runtime"] & {
    headersTimeoutMs: 15_000;
    bodyIdleTimeoutMs: 45_000;
  };
  cases: Gi088RealProblemRegressionCase[];
};

export type Gi088RelationshipClaimStatusProbeTechnicalStatus =
  | "valid"
  | "technical_failure"
  | "contract_failure";

export type Gi088RelationshipClaimStatusProbeCallResult = {
  order: number;
  caseId: string;
  principleId: string;
  caseFingerprint: string;
  candidateInputFingerprint: string;
  requestHash: string;
  startedAt: string;
  completedAt: string;
  status: Gi088RelationshipClaimStatusProbeTechnicalStatus;
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

function assertAuthorization(input: {
  authorization: Gi088RelationshipClaimStatusProbeAuthorization;
  plan: Gi088RelationshipClaimStatusProbePlan;
}) {
  const { authorization, plan } = input;
  assert(
    authorization.schemaVersion === "1.0",
    "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_SCHEMA_MISMATCH"
  );
  assert(
    authorization.identity === plan.identity,
    "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_IDENTITY_MISMATCH"
  );
  assert(
    authorization.planFingerprint === plan.planFingerprint,
    "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_PLAN_MISMATCH"
  );
  assert(
    authorization.probeSetFingerprint === plan.probeSetFingerprint,
    "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_PROBE_SET_MISMATCH"
  );
  assert(
    authorization.scope === plan.scope && authorization.status === "authorized",
    "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_SCOPE_MISMATCH"
  );
  assert(
    authorization.authorizedBy === "product_owner" &&
      authorization.authorizationSource ===
        "current_session_explicit_authorization",
    "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_SOURCE_MISMATCH"
  );
  assert(
    canonicalJson(authorization.cases) ===
      canonicalJson(plan.cases.map((item) => item.caseId)),
    "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_CASE_MISMATCH"
  );
  assert(
    authorization.runtime.model === plan.runtime.model &&
      authorization.runtime.thinking === plan.runtime.thinking &&
      authorization.runtime.reasoningEffort === plan.runtime.reasoningEffort &&
      authorization.runtime.responseFormat === plan.runtime.responseFormat &&
      authorization.runtime.hardTimeoutMs === plan.runtime.hardTimeoutMs &&
      authorization.runtime.concurrency === 1 &&
      authorization.runtime.retries === 0 &&
      authorization.runtime.callBudget ===
        GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET,
    "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_RUNTIME_MISMATCH"
  );
}

export async function createGi088RelationshipClaimStatusProbeExecutionPlan(
  cwd = process.cwd()
): Promise<Gi088RelationshipClaimStatusProbeExecutionPlan> {
  const publicPlan = await createGi088RelationshipClaimStatusProbePlan(cwd);
  const startCardSha256 = await fileSha(cwd, PUBLIC_START_CARD);
  assert(
    startCardSha256 ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED.startCardSha256,
    "GI088_RELATIONSHIP_CLAIM_STATUS_START_CARD_DRIFT"
  );
  const startCard = JSON.parse(
    await readFile(path.join(cwd, PUBLIC_START_CARD), "utf8")
  ) as Gi088RelationshipClaimStatusProbePlan;
  assert(
    startCard.planFingerprint === publicPlan.planFingerprint &&
      canonicalJson(startCard) === canonicalJson(publicPlan),
    "GI088_RELATIONSHIP_CLAIM_STATUS_START_CARD_PLAN_MISMATCH"
  );

  const authorizationSha256 = await fileSha(cwd, PUBLIC_AUTHORIZATION);
  assert(
    authorizationSha256 ===
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED
        .authorizationSha256,
    "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_DRIFT"
  );
  const authorization = JSON.parse(
    await readFile(path.join(cwd, PUBLIC_AUTHORIZATION), "utf8")
  ) as Gi088RelationshipClaimStatusProbeAuthorization;
  assertAuthorization({ authorization, plan: publicPlan });

  const allCases = JSON.parse(
    await readFile(path.join(cwd, PRIVATE_CASES), "utf8")
  ) as Gi088RealProblemRegressionCase[];
  const caseById = new Map(allCases.map((item) => [item.caseId, item]));
  const cases = publicPlan.cases.map((boundCase) => {
    const item = caseById.get(boundCase.caseId);
    assert(
      item,
      `GI088_RELATIONSHIP_CLAIM_STATUS_CASE_MISSING:${boundCase.caseId}`
    );
    assert(
      item.caseFingerprint === boundCase.caseFingerprint &&
        item.candidateInputFingerprint ===
          boundCase.candidateInputFingerprint &&
        item.evaluation.primaryPrincipleId === boundCase.principleId,
      `GI088_RELATIONSHIP_CLAIM_STATUS_CASE_DRIFT:${boundCase.caseId}`
    );
    return item;
  });
  return {
    publicPlan,
    authorization,
    evidenceHashes: { startCardSha256, authorizationSha256 },
    runtime: {
      ...publicPlan.runtime,
      headersTimeoutMs:
        GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED
          .headersTimeoutMs,
      bodyIdleTimeoutMs:
        GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED
          .bodyIdleTimeoutMs
    },
    cases
  };
}

export async function assertGi088RelationshipClaimStatusModelAvailable(input: {
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
        "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHENTICATION_FAILED"
      );
    }
    if (!response.ok) {
      throw new Error(
        `GI088_RELATIONSHIP_CLAIM_STATUS_MODELS_HTTP_${response.status}`
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
      models.includes(
        GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED.model
      ),
      "GI088_RELATIONSHIP_CLAIM_STATUS_TARGET_MODEL_MISSING"
    );
    return {
      httpStatus: response.status,
      targetModelAvailable: true,
      modelListHash: sha(canonicalJson(models.sort()))
    };
  } finally {
    clearTimeout(timeout);
  }
}

function toTurnInput(
  item: Gi088RealProblemRegressionCase
): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: item.candidateInput.messages,
    latestUserMessageId: item.candidateInput.messages.at(-1)!.id,
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

function collectEvidenceRefs(
  output: ReturnType<typeof toGi088SemanticDeltaOutput>
) {
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

export function classifyGi088RelationshipClaimStatusValidationIssues(
  issues: string[]
) {
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

export async function runGi088RelationshipClaimStatusProbeCalls(input: {
  plan: Gi088RelationshipClaimStatusProbeExecutionPlan;
  provider: AIProvider;
  onResult?: (
    result: Gi088RelationshipClaimStatusProbeCallResult
  ) => Promise<void> | void;
}) {
  const results: Gi088RelationshipClaimStatusProbeCallResult[] = [];
  const systemPrompt =
    getGi088RelationshipClaimStatusCandidateAssets().systemPrompt;
  for (const [index, item] of input.plan.cases.entries()) {
    assert(
      results.length < input.plan.runtime.callBudget,
      "GI088_RELATIONSHIP_CLAIM_STATUS_CALL_BUDGET_EXCEEDED"
    );
    const turnInput = toTurnInput(item);
    const params = {
      messages: [
        { role: "system" as const, content: systemPrompt },
        {
          role: "user" as const,
          content: createGi088StageTransitionUserPrompt(turnInput)
        }
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
    let result: Gi088RelationshipClaimStatusProbeCallResult;
    try {
      const completion = await input.provider.complete(params);
      const diagnostics = sanitizeAIProviderDiagnostics(completion.diagnostics);
      try {
        const output = parseGi088RelationshipClaimStatusOutput(
          completion.content
        );
        const baseOutput = toGi088SemanticDeltaOutput(output);
        const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
          turnInput,
          baseOutput
        );
        const messageIds = new Set(
          turnInput.conversation.map((message) => message.id)
        );
        const userMessageIds = new Set(
          turnInput.conversation
            .filter((message) => message.role === "user")
            .map((message) => message.id)
        );
        const unknownSourceRefs = collectEvidenceRefs(baseOutput).filter(
          (ref) => !messageIds.has(ref)
        );
        const observedIssues = [
          ...new Set([
            ...validateGi088RelationshipClaimStatusOutput({
              output,
              userMessageIds
            }),
            ...validateGi088SemanticDeltaOutput({
              input: turnInput,
              output: baseOutput
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
          GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED.model;
        if (
          responseModel !==
          GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED.model
        ) {
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
        const classification =
          classifyGi088RelationshipClaimStatusValidationIssues(
            observedIssues
          );
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
          responseModel,
          latencyMs: diagnostics?.latencyMs ?? completion.latencyMs,
          responseHash: sha(completion.content),
          responseLength: completion.content.length,
          visibleText,
          rawOutput: completion.content,
          parsedOutput: output,
          validationIssues: [
            ...classification.blockingIssues,
            ...classification.semanticOnlyIssues
          ],
          errorCode: classification.blockingIssues.length
            ? "GI088_RELATIONSHIP_CLAIM_STATUS_CONTRACT_INVALID"
            : null,
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
          responseModel:
            diagnostics?.responseModel ??
            GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED.model,
          latencyMs: diagnostics?.latencyMs ?? completion.latencyMs,
          responseHash: sha(completion.content),
          responseLength: completion.content.length,
          visibleText: null,
          rawOutput: completion.content,
          parsedOutput: null,
          validationIssues: [
            error instanceof Error
              ? error.message
              : "GI088_RELATIONSHIP_CLAIM_STATUS_OUTPUT_PARSE_FAILED"
          ],
          errorCode:
            "GI088_RELATIONSHIP_CLAIM_STATUS_OUTPUT_PARSE_FAILED",
          diagnostics
        };
      }
    } catch (error) {
      const diagnostics = sanitizeAIProviderDiagnostics(
        getAIProviderDiagnostics(error)
      );
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
  assert(
    results.length === GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET,
    "GI088_RELATIONSHIP_CLAIM_STATUS_RESULT_COUNT_MISMATCH"
  );
  return results;
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

function publicTechnicalReceipt(
  plan: Gi088RelationshipClaimStatusProbeExecutionPlan,
  modelCheck: unknown,
  results: Gi088RelationshipClaimStatusProbeCallResult[]
) {
  const valid = results.filter((item) => item.status === "valid").length;
  const contractFailures = results.filter(
    (item) => item.status === "contract_failure"
  ).length;
  const technicalFailures = results.filter(
    (item) => item.status === "technical_failure"
  ).length;
  return {
    schemaVersion: "1.0",
    identity: plan.publicPlan.identity,
    status: "technical_complete_waiting_codex_content_review",
    completedAt: new Date().toISOString(),
    planFingerprint: plan.publicPlan.planFingerprint,
    probeSetFingerprint: plan.publicPlan.probeSetFingerprint,
    standardSha256: plan.publicPlan.standardSha256,
    datasetVersion: plan.publicPlan.datasetVersion,
    datasetFingerprint: plan.publicPlan.datasetFingerprint,
    parentCandidateFingerprint: plan.publicPlan.parentCandidateFingerprint,
    candidateFingerprint: plan.publicPlan.candidateFingerprint,
    policyFingerprint: plan.publicPlan.policyFingerprint,
    inputHashes: plan.publicPlan.inputHashes,
    evidenceHashes: plan.evidenceHashes,
    runtime: plan.runtime,
    modelCheck,
    budget: {
      authorized: GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET,
      consumed: results.length,
      retries: 0
    },
    technicalSummary: {
      valid,
      contractFailures,
      technicalFailures,
      http200: results.filter((item) => item.httpStatus === 200).length,
      technicalSuccessRate:
        valid / GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET
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
    publicContentBoundary: {
      userText: 0,
      modelText: 0,
      reviewRationale: 0,
      hiddenReasoning: 0,
      upstreamRequestIds: 0
    },
    excluded: {
      judgeCalls: 0,
      hiddenSetReads: 0,
      databaseChanges: 0,
      humanPreviewSubmissions: 0,
      previewChanges: 0,
      productionChanges: 0
    }
  };
}

async function execute() {
  const cwd = process.cwd();
  const plan = await createGi088RelationshipClaimStatusProbeExecutionPlan(cwd);
  loadEnvConfig(cwd);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  assert(apiKey, "GI088_RELATIONSHIP_CLAIM_STATUS_API_KEY_MISSING");
  const modelCheck =
    await assertGi088RelationshipClaimStatusModelAvailable({ apiKey });
  const privateRoot = path.join(cwd, PRIVATE_ROOT);
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  const reservationPath = path.join(privateRoot, "run-reservation.json");
  const reservation = await open(reservationPath, "wx", 0o600).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST") {
        throw new Error(
          "GI088_RELATIONSHIP_CLAIM_STATUS_RUN_ALREADY_RESERVED"
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
      callBudget: GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET,
      retries: 0
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
    results: [] as Gi088RelationshipClaimStatusProbeCallResult[]
  };
  await writePrivateJson(ledgerPath, ledger);
  const provider = new OpenAIProvider({
    apiKey,
    model: GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED.model,
    baseUrl: "https://api.deepseek.com",
    timeoutMs:
      GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED.hardTimeoutMs
  });
  const results = await runGi088RelationshipClaimStatusProbeCalls({
    plan,
    provider,
    onResult: async (result) => {
      ledger.results.push(result);
      await writePrivateJson(ledgerPath, ledger);
      process.stdout.write(
        `${JSON.stringify({
          order: result.order,
          caseId: result.caseId,
          principleId: result.principleId,
          status: result.status,
          httpStatus: result.httpStatus,
          latencyMs: result.latencyMs,
          callsCompleted: ledger.results.length,
          callBudget: GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_BUDGET
        })}\n`
      );
    }
  });
  ledger.status = "technical_complete_waiting_codex_content_review";
  await writePrivateJson(ledgerPath, ledger);
  await writeFile(
    path.join(cwd, PUBLIC_TECHNICAL_RECEIPT),
    `${JSON.stringify(publicTechnicalReceipt(plan, modelCheck, results), null, 2)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        identity: plan.publicPlan.identity,
        status: ledger.status,
        calls: results.length,
        privateLedger: ledgerPath,
        publicTechnicalReceipt: path.join(cwd, PUBLIC_TECHNICAL_RECEIPT)
      },
      null,
      2
    )}\n`
  );
}

async function main() {
  if (process.argv.includes("--execute")) return execute();
  const plan = await createGi088RelationshipClaimStatusProbeExecutionPlan();
  process.stdout.write(
    `${JSON.stringify(
      {
        identity: plan.publicPlan.identity,
        planFingerprint: plan.publicPlan.planFingerprint,
        probeSetFingerprint: plan.publicPlan.probeSetFingerprint,
        authorizationStatus: plan.authorization.status,
        authorizedCalls: plan.authorization.runtime.callBudget,
        retries: plan.authorization.runtime.retries,
        cases: plan.cases.map((item) => item.caseId),
        executionReady: true,
        modelCalls: 0
      },
      null,
      2
    )}\n`
  );
}

if (
  process.env.VITEST !== "true" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve("scripts/run-gi088-relationship-claim-status-probe.ts")
) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
