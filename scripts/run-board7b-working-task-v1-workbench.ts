import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  open as openFile,
  readFile,
  readdir,
  rename,
  writeFile
} from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import {
  BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
  BOARD7B_WORKING_TASK_V1_EVALUATION_ID,
  BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY,
  BOARD7B_WORKING_TASK_V1_PROMPT_VERSIONS,
  BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
  applyBoard7bWorkingTaskV1Result,
  createBoard7bWorkingTaskV1CandidateFingerprint,
  createBoard7bWorkingTaskV1InitialSemanticState,
  createBoard7bWorkingTaskV1UserPrompt,
  loadBoard7bWorkingTaskV1Assets,
  parseBoard7bWorkingTaskV1Output,
  renderBoard7bWorkingTaskV1Visible,
  validateBoard7bWorkingTaskV1Output,
  type Board7bWorkingTaskV1Assets,
  type Board7bWorkingTaskV1Output,
  type Board7bWorkingTaskV1SemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import type {
  AICompletionResult,
  AIProvider
} from "../src/server/services/ai/ai-provider";
import { getAIProviderFailureCode } from "../src/server/services/ai/ai-provider";
import { getEventCenteredAIProvider } from "../src/server/services/ai/event-centered-provider";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 4331;
const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/iu;
const MAX_BODY_BYTES = 24_000;
const KEYCHAIN_ACCOUNT = "board7a";
const KEYCHAIN_SERVICE = "com.dailylight.local-eval.deepseek";
const execFileAsync = promisify(execFile);

export const BOARD7B_WORKING_TASK_V1_WORKBENCH_FIXED_OPENING =
  "此刻你想聊点什么？" as const;
export const BOARD7B_WORKING_TASK_V1_WORKBENCH_APPROVAL_VERSION =
  "2026-08-07.board7b-working-task-v1-workbench-approval-v1" as const;
export const BOARD7B_WORKING_TASK_V1_WORKBENCH_APPROVAL_SCOPE =
  "one_local_real_trajectory" as const;
export const BOARD7B_WORKING_TASK_V1_WORKBENCH_LOCAL_DIRECTORY =
  "artifacts/local-runtime/generative-interview-board7/2026-08-07-board7b-working-task-v1/workbench" as const;
export const BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_VERSION =
  "2026-08-07.board7b-working-task-real-trajectory-authorization-v1" as const;
export const BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_SCOPE =
  "one_real_trajectory_after_six_case_product_review" as const;
export const BOARD7B_WORKING_TASK_V1_WORKBENCH_RUNNER_VERSION =
  "2026-08-07.board7b-working-task-workbench-runner-v1" as const;

const APPROVED_TRAJECTORY_AUTHORIZATION_FILE =
  "board7b-working-task-v1-real-trajectory-authorization.json";
const REGRESSION_RESULT_FILE =
  "board7b-working-task-v1-regression-result.json";
const PRODUCT_DECISION_RECORD_FILE =
  "board7b-working-task-v1-product-review.md";
const REGRESSION_LOCAL_DIRECTORY =
  "artifacts/local-runtime/generative-interview-board7/2026-08-07-board7b-working-task-v1";
const WORKBENCH_EXECUTION_SOURCE_PATHS = [
  "scripts/run-board7b-working-task-v1-workbench.ts",
  "evals/event-centered-generative/board7b-working-task-v1/workbench.html",
  "evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1.ts",
  "package.json",
  "package-lock.json",
  "tsconfig.json"
] as const;
const WORKBENCH_EXECUTION_SOURCE_DIRECTORIES = [
  "src/server/services/ai"
] as const;

type Message = Board7bWorkingTaskV1TurnInput["conversation"][number];

export const board7bWorkingTaskV1WorkbenchEndSchema = z
  .object({
    feeling: z.enum(["better", "same", "worse"]),
    reason: z.string().trim().max(2_000).nullable().default(null)
  })
  .strict();

export type Board7bWorkingTaskV1WorkbenchEndDecision = z.infer<
  typeof board7bWorkingTaskV1WorkbenchEndSchema
>;

const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const approvedTrajectoryAuthorizationSchema = z
  .object({
    template: z.literal(false),
    authorizationVersion: z.literal(
      BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_VERSION
    ),
    decision: z.literal("approved"),
    candidateVersion: z.literal(BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION),
    candidateFingerprint: fingerprintSchema,
    workbenchExecutionFingerprint: fingerprintSchema,
    regressionRunFingerprint: fingerprintSchema,
    regressionRawResultFingerprint: fingerprintSchema,
    regressionResultFingerprint: fingerprintSchema,
    productDecisionRecordFingerprint: fingerprintSchema,
    sixCaseDecision: z
      .object({
        completedCases: z.literal(6),
        unresolvedTechnicalFailures: z.literal(0),
        invalidStructureOrSourceFailures: z.literal(0),
        singleCaseBlocks: z.literal(0),
        realTrajectory: z.literal("approved")
      })
      .strict(),
    authorizationId: z.string().uuid(),
    authorizationScope: z.literal(
      BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_SCOPE
    ),
    authorizedTrajectoryBudget: z.literal(1),
    authorizedEnvironment: z.literal("isolated_local_evaluation"),
    approvedBy: z.literal("product_owner_conversation"),
    approvedAt: z.string().datetime(),
    productionChangeAuthorized: z.literal(false),
    confirmationText: z.string().trim().min(1),
    authorizationDigest: fingerprintSchema
  })
  .strict();

export type Board7bWorkingTaskV1WorkbenchTrajectoryAuthorization = z.infer<
  typeof approvedTrajectoryAuthorizationSchema
>;

export type Board7bWorkingTaskV1WorkbenchApproval = {
  approvalType: `${typeof BOARD7B_WORKING_TASK_V1_EVALUATION_ID}_workbench`;
  approvalVersion: typeof BOARD7B_WORKING_TASK_V1_WORKBENCH_APPROVAL_VERSION;
  decision: "approved";
  approvedBy: "product_owner_ui";
  approvedAt: string;
  candidateFingerprint: string;
  screeningAuthorizationId: string;
  workbenchExecutionFingerprint: string;
  trajectoryId: string;
  approvalScope: typeof BOARD7B_WORKING_TASK_V1_WORKBENCH_APPROVAL_SCOPE;
};

export type Board7bWorkingTaskV1WorkbenchStatus =
  | "running"
  | "technical_failure"
  | "protected_failure"
  | "completed";

export type Board7bWorkingTaskV1WorkbenchCallRecord = {
  callId: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  status: "valid" | "technical_failure" | "protected_failure";
  provider: string | null;
  model: typeof BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.model;
  requestHash: string;
  responseHash: string | null;
  rawOutput: string | null;
  latencyMs: number | null;
  tokenUsage: AICompletionResult["tokenUsage"] | null;
  errorCode: string | null;
};

export type Board7bWorkingTaskV1WorkbenchTurnRecord = {
  turnId: string;
  userMessageId: string;
  status: "pending" | "valid" | "technical_failure" | "protected_failure";
  semantic: Board7bWorkingTaskV1Output["semantic"] | null;
  visible: Board7bWorkingTaskV1Output["visible"] | null;
  visibleText: string | null;
  validationIssues: string[];
  evidenceExcerpts: Array<{ id: string; content: string }>;
  semanticStateBefore: Board7bWorkingTaskV1SemanticState;
  semanticStateAfter: Board7bWorkingTaskV1SemanticState | null;
  providerInitializationFailures: Array<{
    occurredAt: string;
    errorCode: string;
  }>;
  calls: Board7bWorkingTaskV1WorkbenchCallRecord[];
};

export type Board7bWorkingTaskV1WorkbenchCheckpoint = {
  evaluationId: typeof BOARD7B_WORKING_TASK_V1_EVALUATION_ID;
  candidateVersion: typeof BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION;
  candidateFingerprint: string;
  runFingerprint: string;
  runId: string;
  status: Board7bWorkingTaskV1WorkbenchStatus;
  createdAt: string;
  updatedAt: string;
  approval: Board7bWorkingTaskV1WorkbenchApproval;
  messages: Message[];
  semanticState: Board7bWorkingTaskV1SemanticState;
  turns: Board7bWorkingTaskV1WorkbenchTurnRecord[];
  pendingUserTurn: null | {
    turnId: string;
    userMessageId: string;
    content: string;
    submittedAt: string;
  };
  technicalError: string | null;
  result:
    | null
    | (Board7bWorkingTaskV1WorkbenchEndDecision & {
        unresolvedFailure: boolean;
        completedAt: string;
      });
};

const startInputSchema = z.object({ confirmation: z.literal(true) }).strict();
const turnInputSchema = z
  .object({ content: z.string().trim().min(1).max(8_000) })
  .strict();

function argumentValue(name: string) {
  const direct = process.argv.find((item) => item.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function collectTypeScriptSources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await collectTypeScriptSources(path)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      paths.push(path);
    }
  }
  return paths;
}

export async function createBoard7bWorkingTaskV1WorkbenchExecutionFingerprint(
  input: { workspaceRoot?: string; candidateFingerprint: string }
) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const directorySources = (
    await Promise.all(
      WORKBENCH_EXECUTION_SOURCE_DIRECTORIES.map((path) =>
        collectTypeScriptSources(resolve(workspaceRoot, path))
      )
    )
  ).flat();
  const sourcePaths = [
    ...WORKBENCH_EXECUTION_SOURCE_PATHS.map((path) =>
      resolve(workspaceRoot, path)
    ),
    ...directorySources
  ].sort();
  const sources = await Promise.all(
    sourcePaths.map(async (path) => ({
      path: relative(workspaceRoot, path),
      sha256: sha256(await readFile(path, "utf8"))
    }))
  );
  return sha256(
    JSON.stringify({
      candidateFingerprint: input.candidateFingerprint,
      workbenchRunnerVersion:
        BOARD7B_WORKING_TASK_V1_WORKBENCH_RUNNER_VERSION,
      runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
      providerIdentity: {
        adapter: "openai-compatible",
        baseUrl: "https://api.deepseek.com",
        model: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.model
      },
      sources
    })
  );
}

async function writeJsonAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function writeJsonExclusive(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  let file: Awaited<ReturnType<typeof openFile>>;
  try {
    file = await openFile(path, "wx");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw Object.assign(
        new Error(
          "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_ALREADY_CONSUMED"
        ),
        {
          code: "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_ALREADY_CONSUMED"
        }
      );
    }
    throw error;
  }
  try {
    await file.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
}

export function createBoard7bWorkingTaskV1WorkbenchAuthorizationDigest(
  authorization: Omit<
    Board7bWorkingTaskV1WorkbenchTrajectoryAuthorization,
    "authorizationDigest"
  >
) {
  return sha256(JSON.stringify(authorization));
}

function isMissingFileError(error: unknown) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export async function validateBoard7bWorkingTaskV1WorkbenchAuthorization(input: {
  workspaceRoot?: string;
  candidateFingerprint: string;
  authorizationPath?: string;
}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const packageDirectory = resolve(
    workspaceRoot,
    BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY
  );
  const authorizationPath = input.authorizationPath
    ? resolve(workspaceRoot, input.authorizationPath)
    : resolve(packageDirectory, APPROVED_TRAJECTORY_AUTHORIZATION_FILE);
  let authorizationSource: string;
  try {
    authorizationSource = await readFile(authorizationPath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(
        "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_FILE_MISSING"
      );
    }
    throw error;
  }
  const authorizationValue = JSON.parse(authorizationSource) as unknown;
  const parsedAuthorization =
    approvedTrajectoryAuthorizationSchema.safeParse(authorizationValue);
  if (!parsedAuthorization.success) {
    const pending =
      authorizationValue &&
      typeof authorizationValue === "object" &&
      "decision" in authorizationValue &&
      authorizationValue.decision === "pending";
    throw new Error(
      pending
        ? "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_NOT_APPROVED"
        : "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_INVALID"
    );
  }
  const authorization = parsedAuthorization.data;
  const { authorizationDigest, ...unsignedAuthorization } = authorization;
  if (
    authorizationDigest !==
    createBoard7bWorkingTaskV1WorkbenchAuthorizationDigest(
      unsignedAuthorization
    )
  ) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_DIGEST_MISMATCH"
    );
  }
  if (authorization.candidateFingerprint !== input.candidateFingerprint) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_CANDIDATE_FINGERPRINT_MISMATCH"
    );
  }
  const workbenchExecutionFingerprint =
    await createBoard7bWorkingTaskV1WorkbenchExecutionFingerprint({
      workspaceRoot,
      candidateFingerprint: input.candidateFingerprint
    });
  if (
    authorization.workbenchExecutionFingerprint !==
    workbenchExecutionFingerprint
  ) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_EXECUTION_FINGERPRINT_MISMATCH"
    );
  }

  const rawResultPath = resolve(
    workspaceRoot,
    REGRESSION_LOCAL_DIRECTORY,
    `regression-${authorization.regressionRunFingerprint}`,
    "raw-results.json"
  );
  const formalResultPath = resolve(packageDirectory, REGRESSION_RESULT_FILE);
  const productDecisionRecordPath = resolve(
    packageDirectory,
    PRODUCT_DECISION_RECORD_FILE
  );
  let rawResultSource: string;
  let formalResultSource: string;
  let productDecisionRecordSource: string;
  try {
    [rawResultSource, formalResultSource, productDecisionRecordSource] =
      await Promise.all([
        readFile(rawResultPath, "utf8"),
        readFile(formalResultPath, "utf8"),
        readFile(productDecisionRecordPath, "utf8")
      ]);
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(
        "BOARD7B_WORKING_TASK_V1_WORKBENCH_SCREENING_EVIDENCE_MISSING"
      );
    }
    throw error;
  }
  if (
    sha256(rawResultSource) !== authorization.regressionRawResultFingerprint ||
    sha256(formalResultSource) !== authorization.regressionResultFingerprint ||
    sha256(productDecisionRecordSource) !==
      authorization.productDecisionRecordFingerprint
  ) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_SCREENING_EVIDENCE_FINGERPRINT_MISMATCH"
    );
  }
  const rawResultSchema = z
    .object({
      candidateVersion: z.literal(BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION),
      candidateFingerprint: fingerprintSchema,
      runFingerprint: fingerprintSchema,
      completedAt: z.string().datetime(),
      calls: z
        .array(
          z
            .object({
              caseId: z.string().trim().min(1),
              status: z.enum([
                "valid",
                "protected_failure",
                "model_contract_failure",
                "technical_failure"
              ])
            })
            .passthrough()
        )
        .length(6),
      manualTechnicalRetries: z
        .array(
          z
            .object({
              caseId: z.string().trim().min(1),
              status: z.enum([
                "valid",
                "protected_failure",
                "model_contract_failure",
                "technical_failure"
              ])
            })
            .passthrough()
        )
        .max(2)
        .default([])
    })
    .passthrough();
  const rawResult = rawResultSchema.parse(
    JSON.parse(rawResultSource) as unknown
  );
  if (
    rawResult.candidateFingerprint !== input.candidateFingerprint ||
    rawResult.runFingerprint !== authorization.regressionRunFingerprint
  ) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_REGRESSION_RESULT_BINDING_MISMATCH"
    );
  }
  const finalStatusByCase = new Map(
    rawResult.calls.map((call) => [call.caseId, call.status] as const)
  );
  if (finalStatusByCase.size !== 6) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_REGRESSION_CASE_SET_INVALID"
    );
  }
  for (const retry of rawResult.manualTechnicalRetries) {
    if (finalStatusByCase.get(retry.caseId) !== "technical_failure") {
      throw new Error(
        "BOARD7B_WORKING_TASK_V1_WORKBENCH_MANUAL_RETRY_SOURCE_INVALID"
      );
    }
    finalStatusByCase.set(retry.caseId, retry.status);
  }
  if ([...finalStatusByCase.values()].some((status) => status !== "valid")) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_SIX_CASE_GATE_NOT_CLEARED"
    );
  }
  return {
    authorization,
    authorizationPath,
    authorizationDigest,
    workbenchExecutionFingerprint,
    rawResultPath,
    formalResultPath,
    productDecisionRecordPath
  };
}

function nextMessageId(messages: Message[], role: "user" | "assistant") {
  const prefix = role === "user" ? "U" : "A";
  const count = messages.filter((message) => message.role === role).length;
  return `${prefix}${role === "user" ? count + 1 : count}`;
}

export function createBoard7bWorkingTaskV1WorkbenchRunFingerprint(
  approval: Board7bWorkingTaskV1WorkbenchApproval
) {
  return sha256(
    JSON.stringify({
      evaluationId: BOARD7B_WORKING_TASK_V1_EVALUATION_ID,
      candidateVersion: BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
      approvalVersion: approval.approvalVersion,
      candidateFingerprint: approval.candidateFingerprint,
      screeningAuthorizationId: approval.screeningAuthorizationId,
      workbenchExecutionFingerprint: approval.workbenchExecutionFingerprint,
      trajectoryId: approval.trajectoryId,
      approvedAt: approval.approvedAt,
      approvalScope: approval.approvalScope,
      runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG
    })
  );
}

export function createBoard7bWorkingTaskV1WorkbenchCheckpoint(input: {
  candidateFingerprint: string;
  screeningAuthorizationId: string;
  workbenchExecutionFingerprint: string;
  trajectoryId?: string;
  approvedAt?: string;
}) {
  if (!/^[a-f0-9]{64}$/u.test(input.candidateFingerprint)) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_CANDIDATE_FINGERPRINT_INVALID"
    );
  }
  if (!z.string().uuid().safeParse(input.screeningAuthorizationId).success) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_SCREENING_AUTHORIZATION_ID_INVALID"
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.workbenchExecutionFingerprint)) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_EXECUTION_FINGERPRINT_INVALID"
    );
  }
  const approval: Board7bWorkingTaskV1WorkbenchApproval = {
    approvalType: `${BOARD7B_WORKING_TASK_V1_EVALUATION_ID}_workbench`,
    approvalVersion: BOARD7B_WORKING_TASK_V1_WORKBENCH_APPROVAL_VERSION,
    decision: "approved",
    approvedBy: "product_owner_ui",
    approvedAt: input.approvedAt ?? new Date().toISOString(),
    candidateFingerprint: input.candidateFingerprint,
    screeningAuthorizationId: input.screeningAuthorizationId,
    workbenchExecutionFingerprint: input.workbenchExecutionFingerprint,
    trajectoryId: input.trajectoryId ?? randomUUID(),
    approvalScope: BOARD7B_WORKING_TASK_V1_WORKBENCH_APPROVAL_SCOPE
  };
  const runFingerprint =
    createBoard7bWorkingTaskV1WorkbenchRunFingerprint(approval);
  const checkpoint: Board7bWorkingTaskV1WorkbenchCheckpoint = {
    evaluationId: BOARD7B_WORKING_TASK_V1_EVALUATION_ID,
    candidateVersion: BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
    candidateFingerprint: input.candidateFingerprint,
    runFingerprint,
    runId: `run-${runFingerprint}`,
    status: "running",
    createdAt: approval.approvedAt,
    updatedAt: approval.approvedAt,
    approval,
    messages: [
      {
        id: "A0",
        role: "assistant",
        content: BOARD7B_WORKING_TASK_V1_WORKBENCH_FIXED_OPENING
      }
    ],
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState(),
    turns: [],
    pendingUserTurn: null,
    technicalError: null,
    result: null
  };
  return checkpoint;
}

const authorizationConsumptionSchema = z
  .object({
    authorizationId: z.string().uuid(),
    authorizationDigest: fingerprintSchema,
    candidateFingerprint: fingerprintSchema,
    workbenchExecutionFingerprint: fingerprintSchema,
    regressionRunFingerprint: fingerprintSchema,
    regressionRawResultFingerprint: fingerprintSchema,
    regressionResultFingerprint: fingerprintSchema,
    productDecisionRecordFingerprint: fingerprintSchema,
    trajectoryRunFingerprint: fingerprintSchema,
    checkpointPath: z.string().trim().min(1),
    consumedAt: z.string().datetime(),
    scope: z.literal(BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_SCOPE)
  })
  .strict();

function authorizationConsumptionPath(
  workspaceRoot: string,
  authorizationId: string
) {
  return resolve(
    workspaceRoot,
    BOARD7B_WORKING_TASK_V1_WORKBENCH_LOCAL_DIRECTORY,
    "authorization-consumption",
    `${authorizationId}.json`
  );
}

export async function claimBoard7bWorkingTaskV1WorkbenchAuthorization(input: {
  workspaceRoot?: string;
  authorization: Board7bWorkingTaskV1WorkbenchTrajectoryAuthorization;
  checkpoint: Board7bWorkingTaskV1WorkbenchCheckpoint;
  consumedAt?: string;
}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const authorization = input.authorization;
  if (
    input.checkpoint.candidateFingerprint !==
      authorization.candidateFingerprint ||
    input.checkpoint.approval.screeningAuthorizationId !==
      authorization.authorizationId ||
    input.checkpoint.approval.workbenchExecutionFingerprint !==
      authorization.workbenchExecutionFingerprint
  ) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_CHECKPOINT_AUTHORIZATION_MISMATCH"
    );
  }
  const checkpointPath = resolve(
    workspaceRoot,
    BOARD7B_WORKING_TASK_V1_WORKBENCH_LOCAL_DIRECTORY,
    input.checkpoint.runId,
    "checkpoint.json"
  );
  const relativeCheckpointPath = relative(workspaceRoot, checkpointPath);
  const consumption = {
    authorizationId: authorization.authorizationId,
    authorizationDigest: authorization.authorizationDigest,
    candidateFingerprint: authorization.candidateFingerprint,
    workbenchExecutionFingerprint:
      authorization.workbenchExecutionFingerprint,
    regressionRunFingerprint: authorization.regressionRunFingerprint,
    regressionRawResultFingerprint:
      authorization.regressionRawResultFingerprint,
    regressionResultFingerprint: authorization.regressionResultFingerprint,
    productDecisionRecordFingerprint:
      authorization.productDecisionRecordFingerprint,
    trajectoryRunFingerprint: input.checkpoint.runFingerprint,
    checkpointPath: relativeCheckpointPath,
    consumedAt: input.consumedAt ?? new Date().toISOString(),
    scope: BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_SCOPE
  } as const;
  const consumptionPath = authorizationConsumptionPath(
    workspaceRoot,
    authorization.authorizationId
  );
  await writeJsonExclusive(consumptionPath, consumption);
  await writeJsonAtomic(checkpointPath, input.checkpoint);
  return { consumptionPath, checkpointPath, consumption };
}

export async function recoverBoard7bWorkingTaskV1WorkbenchCheckpoint(input: {
  workspaceRoot?: string;
  authorization: Board7bWorkingTaskV1WorkbenchTrajectoryAuthorization;
}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const consumptionPath = authorizationConsumptionPath(
    workspaceRoot,
    input.authorization.authorizationId
  );
  let consumptionSource: string;
  try {
    consumptionSource = await readFile(consumptionPath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
  const consumption = authorizationConsumptionSchema.parse(
    JSON.parse(consumptionSource) as unknown
  );
  const authorization = input.authorization;
  if (
    consumption.authorizationDigest !== authorization.authorizationDigest ||
    consumption.candidateFingerprint !== authorization.candidateFingerprint ||
    consumption.workbenchExecutionFingerprint !==
      authorization.workbenchExecutionFingerprint ||
    consumption.regressionRunFingerprint !==
      authorization.regressionRunFingerprint ||
    consumption.regressionRawResultFingerprint !==
      authorization.regressionRawResultFingerprint ||
    consumption.regressionResultFingerprint !==
      authorization.regressionResultFingerprint ||
    consumption.productDecisionRecordFingerprint !==
      authorization.productDecisionRecordFingerprint
  ) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_CONSUMPTION_MISMATCH"
    );
  }
  const checkpointPath = resolve(workspaceRoot, consumption.checkpointPath);
  let checkpointSource: string;
  try {
    checkpointSource = await readFile(checkpointPath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(
        "BOARD7B_WORKING_TASK_V1_WORKBENCH_CONSUMED_CHECKPOINT_MISSING"
      );
    }
    throw error;
  }
  const checkpointEnvelope = z
    .object({
      evaluationId: z.literal(BOARD7B_WORKING_TASK_V1_EVALUATION_ID),
      candidateVersion: z.literal(BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION),
      candidateFingerprint: fingerprintSchema,
      runFingerprint: fingerprintSchema,
      runId: z.string().trim().min(1),
      approval: z
        .object({
          candidateFingerprint: fingerprintSchema,
          screeningAuthorizationId: z.string().uuid(),
          workbenchExecutionFingerprint: fingerprintSchema
        })
        .passthrough()
    })
    .passthrough()
    .parse(JSON.parse(checkpointSource) as unknown);
  if (
    checkpointEnvelope.candidateFingerprint !==
      authorization.candidateFingerprint ||
    checkpointEnvelope.approval.candidateFingerprint !==
      authorization.candidateFingerprint ||
    checkpointEnvelope.approval.screeningAuthorizationId !==
      authorization.authorizationId ||
    checkpointEnvelope.approval.workbenchExecutionFingerprint !==
      authorization.workbenchExecutionFingerprint ||
    checkpointEnvelope.runFingerprint !== consumption.trajectoryRunFingerprint
  ) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_RECOVERED_CHECKPOINT_MISMATCH"
    );
  }
  const checkpoint = checkpointEnvelope as Board7bWorkingTaskV1WorkbenchCheckpoint;
  if (
    createBoard7bWorkingTaskV1WorkbenchRunFingerprint(checkpoint.approval) !==
    checkpoint.runFingerprint
  ) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_RECOVERED_RUN_FINGERPRINT_MISMATCH"
    );
  }
  return { checkpoint, checkpointPath, consumptionPath, consumption };
}

export function submitBoard7bWorkingTaskV1WorkbenchUserTurn(
  checkpoint: Board7bWorkingTaskV1WorkbenchCheckpoint,
  content: string
) {
  if (checkpoint.status !== "running" || checkpoint.pendingUserTurn) {
    throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_SESSION_NOT_READY_FOR_TURN");
  }
  const parsed = turnInputSchema.parse({ content });
  const userMessage: Message = {
    id: nextMessageId(checkpoint.messages, "user"),
    role: "user",
    content: parsed.content
  };
  const turnId = randomUUID();
  checkpoint.messages.push(userMessage);
  checkpoint.turns.push({
    turnId,
    userMessageId: userMessage.id,
    status: "pending",
    semantic: null,
    visible: null,
    visibleText: null,
    validationIssues: [],
    evidenceExcerpts: [],
    semanticStateBefore: structuredClone(checkpoint.semanticState),
    semanticStateAfter: null,
    providerInitializationFailures: [],
    calls: []
  });
  checkpoint.pendingUserTurn = {
    turnId,
    userMessageId: userMessage.id,
    content: userMessage.content,
    submittedAt: new Date().toISOString()
  };
  checkpoint.updatedAt = new Date().toISOString();
  return { turnId, userMessageId: userMessage.id };
}

export function completeBoard7bWorkingTaskV1WorkbenchSession(
  checkpoint: Board7bWorkingTaskV1WorkbenchCheckpoint,
  value: unknown
) {
  if (checkpoint.status === "completed") {
    throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_SESSION_ALREADY_COMPLETED");
  }
  const decision = board7bWorkingTaskV1WorkbenchEndSchema.parse(value);
  const validTurnCount = checkpoint.turns.filter(
    (turn) => turn.status === "valid"
  ).length;
  const unresolvedFailure =
    checkpoint.status === "technical_failure" ||
    checkpoint.status === "protected_failure";
  if (!unresolvedFailure && validTurnCount < 1) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_VALID_TURN_REQUIRED_TO_END"
    );
  }
  checkpoint.result = {
    ...decision,
    unresolvedFailure,
    completedAt: new Date().toISOString()
  };
  checkpoint.status = "completed";
  checkpoint.pendingUserTurn = null;
  checkpoint.technicalError = null;
  checkpoint.updatedAt = new Date().toISOString();
  return checkpoint.result;
}

function createEndAvailability(
  checkpoint: Board7bWorkingTaskV1WorkbenchCheckpoint | null
) {
  if (!checkpoint || checkpoint.status === "completed") {
    return {
      allowedFeelings: [] as Array<"better" | "same" | "worse">,
      visible: false,
      reason: checkpoint ? "轨迹已经封存" : "先开始真实体验"
    };
  }
  if (
    checkpoint.status === "technical_failure" ||
    checkpoint.status === "protected_failure"
  ) {
    return {
      allowedFeelings: ["better", "same", "worse"] as Array<
        "better" | "same" | "worse"
      >,
      visible: true,
      reason: "当前失败仍未解决，可以如实选择感受并封存原失败"
    };
  }
  if (!checkpoint.turns.some((turn) => turn.status === "valid")) {
    return {
      allowedFeelings: [] as Array<"better" | "same" | "worse">,
      visible: false,
      reason: "至少完成一个有效模型回合后再判断聊后感受"
    };
  }
  return {
    allowedFeelings: ["better", "same", "worse"] as Array<
      "better" | "same" | "worse"
    >,
    visible: true,
    reason: "可以按真实聊后感受结束并封存"
  };
}

function createRuntimeIdentity() {
  return {
    service: "DeepSeek 官方 API",
    adapter: "OpenAI-compatible",
    baseUrlHost: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.baseUrlHost,
    model: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.model,
    promptVersions: BOARD7B_WORKING_TASK_V1_PROMPT_VERSIONS,
    credentialReadiness: "authenticated_before_server_start"
  };
}

function createAwaitingStartPublicState(candidateFingerprint: string) {
  return {
    evaluationId: BOARD7B_WORKING_TASK_V1_EVALUATION_ID,
    candidateVersion: BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
    candidateFingerprint,
    runFingerprint: null,
    runId: null,
    status: "awaiting_start" as const,
    inFlight: false,
    fixedOpening: BOARD7B_WORKING_TASK_V1_WORKBENCH_FIXED_OPENING,
    runtime: createRuntimeIdentity(),
    messages: [] as Message[],
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState(),
    turns: [] as Board7bWorkingTaskV1WorkbenchTurnRecord[],
    technicalError: null,
    result: null,
    endAvailability: createEndAvailability(null),
    modelCallCount: 0
  };
}

export function createBoard7bWorkingTaskV1WorkbenchPublicState(
  checkpoint: Board7bWorkingTaskV1WorkbenchCheckpoint | null,
  inFlight: boolean,
  candidateFingerprint = checkpoint?.candidateFingerprint ?? ""
) {
  if (!checkpoint) return createAwaitingStartPublicState(candidateFingerprint);
  return {
    evaluationId: checkpoint.evaluationId,
    candidateVersion: checkpoint.candidateVersion,
    candidateFingerprint: checkpoint.candidateFingerprint,
    runFingerprint: checkpoint.runFingerprint,
    runId: checkpoint.runId,
    status: checkpoint.status,
    inFlight,
    fixedOpening: BOARD7B_WORKING_TASK_V1_WORKBENCH_FIXED_OPENING,
    runtime: createRuntimeIdentity(),
    messages: checkpoint.messages,
    semanticState: checkpoint.semanticState,
    turns: checkpoint.turns.map((turn) => ({
      turnId: turn.turnId,
      userMessageId: turn.userMessageId,
      status: turn.status,
      semantic: turn.semantic,
      visibleText: turn.visibleText,
      validationIssues: turn.validationIssues,
      evidenceExcerpts: turn.evidenceExcerpts,
      semanticStateAfter: turn.semanticStateAfter,
      providerInitializationFailures: turn.providerInitializationFailures,
      callCount: turn.calls.length,
      lastCall: turn.calls.length
        ? (() => {
            const call = turn.calls.at(-1)!;
            return {
              status: call.status,
              providerAdapter: call.provider,
              model: call.model,
              requestHash: call.requestHash,
              latencyMs: call.latencyMs,
              tokenUsage: call.tokenUsage,
              errorCode: call.errorCode
            };
          })()
        : null
    })),
    technicalError: checkpoint.technicalError,
    result: checkpoint.result,
    endAvailability: createEndAvailability(checkpoint),
    modelCallCount: checkpoint.turns.reduce(
      (sum, turn) => sum + turn.calls.length,
      0
    )
  };
}

function technicalErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return getAIProviderFailureCode(error);
}

function protectedErrorCode(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") {
    return "INVALID_JSON_SCHEMA";
  }
  if (error instanceof SyntaxError) return "INVALID_JSON";
  return error instanceof Error ? error.message.split(":", 1)[0] : "INVALID_MODEL_OUTPUT";
}

function collectEvidenceRefs(value: unknown, refs = new Set<string>()) {
  if (!value || typeof value !== "object") return refs;
  for (const [key, nested] of Object.entries(value)) {
    if (key === "evidenceRefs" && Array.isArray(nested)) {
      for (const ref of nested) if (typeof ref === "string") refs.add(ref);
      continue;
    }
    collectEvidenceRefs(nested, refs);
  }
  return refs;
}

export async function executeBoard7bWorkingTaskV1WorkbenchPendingTurn(input: {
  checkpoint: Board7bWorkingTaskV1WorkbenchCheckpoint;
  provider: AIProvider;
  assets: Board7bWorkingTaskV1Assets;
  persist?: () => Promise<void>;
}) {
  const persist = input.persist ?? (async () => {});
  const { checkpoint } = input;
  const pending = checkpoint.pendingUserTurn;
  if (!pending) {
    throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_PENDING_TURN_MISSING");
  }
  const turn = checkpoint.turns.find((item) => item.turnId === pending.turnId);
  if (!turn) {
    throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_TURN_RECORD_MISSING");
  }

  checkpoint.status = "running";
  checkpoint.technicalError = null;
  turn.status = "pending";
  await persist();

  const turnInput: Board7bWorkingTaskV1TurnInput = {
    mode: "accompany_chat",
    conversation: checkpoint.messages,
    latestUserMessageId: pending.userMessageId,
    semanticState: turn.semanticStateBefore
  };
  const userPrompt = createBoard7bWorkingTaskV1UserPrompt(turnInput);
  const requestHash = sha256(
    JSON.stringify({
      systemPrompt: input.assets.systemPrompt,
      userPrompt,
      runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG
    })
  );
  const callId = randomUUID();
  const attempt = turn.calls.length + 1;
  const startedAt = new Date().toISOString();
  let completion: AICompletionResult | null = null;

  try {
    completion = await input.provider.complete({
      messages: [
        { role: "system", content: input.assets.systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.temperature,
      maxTokens: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.maxTokens,
      timeoutMs: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.timeoutMs,
      responseFormat: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.responseFormat,
      thinking: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.thinking
    });
    const output = parseBoard7bWorkingTaskV1Output(completion.content);
    const validationIssues = validateBoard7bWorkingTaskV1Output({
      input: turnInput,
      output
    });
    const visibleText = renderBoard7bWorkingTaskV1Visible(output);
    const byId = new Map(
      checkpoint.messages
        .filter((message) => message.role === "user")
        .map((message) => [message.id, message.content])
    );
    turn.semantic = output.semantic;
    turn.visible = output.visible;
    turn.visibleText = visibleText;
    turn.validationIssues = validationIssues;
    turn.evidenceExcerpts = [...collectEvidenceRefs(output.semantic)].flatMap(
      (ref) => {
        const content = byId.get(ref);
        return content ? [{ id: ref, content }] : [];
      }
    );

    if (validationIssues.length) {
      turn.calls.push({
        callId,
        attempt,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "protected_failure",
        provider: completion.provider,
        model: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.model,
        requestHash,
        responseHash: sha256(completion.content),
        rawOutput: completion.content,
        latencyMs: completion.latencyMs,
        tokenUsage: completion.tokenUsage ?? null,
        errorCode: "PROGRAM_PROTECTION_REJECTED"
      });
      turn.status = "protected_failure";
      checkpoint.status = "protected_failure";
      checkpoint.pendingUserTurn = null;
    } else {
      const nextState = applyBoard7bWorkingTaskV1Result({
        input: turnInput,
        output
      });
      turn.calls.push({
        callId,
        attempt,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "valid",
        provider: completion.provider,
        model: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.model,
        requestHash,
        responseHash: sha256(completion.content),
        rawOutput: completion.content,
        latencyMs: completion.latencyMs,
        tokenUsage: completion.tokenUsage ?? null,
        errorCode: null
      });
      checkpoint.messages.push({
        id: nextMessageId(checkpoint.messages, "assistant"),
        role: "assistant",
        content: visibleText
      });
      checkpoint.semanticState = nextState;
      turn.semanticStateAfter = nextState;
      turn.status = "valid";
      checkpoint.status = "running";
      checkpoint.pendingUserTurn = null;
    }
  } catch (error) {
    const modelReturnedContent = completion !== null;
    const errorCode = modelReturnedContent
      ? protectedErrorCode(error)
      : technicalErrorCode(error);
    turn.calls.push({
      callId,
      attempt,
      startedAt,
      completedAt: new Date().toISOString(),
      status: modelReturnedContent ? "protected_failure" : "technical_failure",
      provider: completion?.provider ?? input.provider.name,
      model: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.model,
      requestHash,
      responseHash: completion?.content ? sha256(completion.content) : null,
      rawOutput: completion?.content ?? null,
      latencyMs: completion?.latencyMs ?? null,
      tokenUsage: completion?.tokenUsage ?? null,
      errorCode
    });
    turn.status = modelReturnedContent ? "protected_failure" : "technical_failure";
    checkpoint.status = turn.status;
    checkpoint.technicalError = modelReturnedContent ? null : errorCode;
    if (modelReturnedContent) checkpoint.pendingUserTurn = null;
  } finally {
    checkpoint.updatedAt = new Date().toISOString();
    await persist();
  }
}

export async function recordBoard7bWorkingTaskV1WorkbenchProviderFailure(input: {
  checkpoint: Board7bWorkingTaskV1WorkbenchCheckpoint;
  error: unknown;
  persist?: () => Promise<void>;
}) {
  const pending = input.checkpoint.pendingUserTurn;
  if (!pending) {
    throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_PENDING_TURN_MISSING");
  }
  const turn = input.checkpoint.turns.find(
    (item) => item.turnId === pending.turnId
  );
  if (!turn) {
    throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_TURN_RECORD_MISSING");
  }
  const errorCode = technicalErrorCode(input.error);
  turn.status = "technical_failure";
  turn.providerInitializationFailures.push({
    occurredAt: new Date().toISOString(),
    errorCode
  });
  input.checkpoint.status = "technical_failure";
  input.checkpoint.technicalError = errorCode;
  input.checkpoint.updatedAt = new Date().toISOString();
  await (input.persist ?? (async () => {}))();
}

async function resolveCandidateCredential() {
  const processKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (processKey) {
    return { apiKey: processKey, source: "isolated_process_environment" as const };
  }
  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/security",
      [
        "find-generic-password",
        "-a",
        KEYCHAIN_ACCOUNT,
        "-s",
        KEYCHAIN_SERVICE,
        "-w"
      ],
      { encoding: "utf8" }
    );
    const apiKey = stdout.trim();
    if (apiKey) return { apiKey, source: "macos_keychain" as const };
  } catch {
    // 统一使用候选 Provider 错误口径，且不输出凭据内容。
  }
  throw Object.assign(new Error("EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"), {
    code: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"
  });
}

async function validateCandidateCredential(apiKey: string) {
  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw Object.assign(new Error("DEEPSEEK_CREDENTIAL_PREFLIGHT_UNREACHABLE"), {
      code: "DEEPSEEK_CREDENTIAL_PREFLIGHT_UNREACHABLE"
    });
  }
  if (!response.ok) {
    throw Object.assign(
      new Error(`DEEPSEEK_CREDENTIAL_PREFLIGHT_HTTP_${response.status}`),
      { code: `DEEPSEEK_CREDENTIAL_PREFLIGHT_HTTP_${response.status}` }
    );
  }
  const body = (await response.json()) as { data?: Array<{ id?: string }> };
  if (
    !body.data?.some(
      (model) => model.id === BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.model
    )
  ) {
    throw Object.assign(new Error("DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE"), {
      code: "DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE"
    });
  }
}

async function createCandidateProvider(apiKey: string) {
  const provider = await getEventCenteredAIProvider({
    env: {
      NODE_ENV: "development",
      AI_PROVIDER: "openai",
      DEEPSEEK_API_KEY: apiKey,
      DEEPSEEK_MODEL: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.model,
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      EVENT_CENTERED_GENERATIVE_MODEL:
        BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG.model
    }
  });
  if (!provider) {
    throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_PROVIDER_UNAVAILABLE");
  }
  return provider;
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

function sendError(response: ServerResponse, status: number, error: unknown) {
  sendJson(response, status, {
    error: error instanceof Error ? error.message : String(error)
  });
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error("REQUEST_BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? (JSON.parse(body) as unknown) : {};
}

function tokenMatches(actual: string | undefined, expected: string) {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function requestIsLocal(request: IncomingMessage, port: number) {
  if (!LOCAL_HOST_PATTERN.test(request.headers.host ?? "")) return false;
  const origin = request.headers.origin;
  return (
    !origin ||
    origin === `http://${HOST}:${port}` ||
    origin === `http://localhost:${port}`
  );
}

async function main() {
  const assets = await loadBoard7bWorkingTaskV1Assets();
  const candidateFingerprint =
    createBoard7bWorkingTaskV1CandidateFingerprint(assets);
  const workbenchExecutionFingerprint =
    await createBoard7bWorkingTaskV1WorkbenchExecutionFingerprint({
      candidateFingerprint
    });
  if (process.argv.includes("--fingerprint")) {
    process.stdout.write(`${candidateFingerprint}\n`);
    return;
  }
  if (process.argv.includes("--inspect") || process.argv.includes("--check")) {
    process.stdout.write(
      `${JSON.stringify(
        {
          evaluationId: BOARD7B_WORKING_TASK_V1_EVALUATION_ID,
          candidateVersion: BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
          candidateFingerprint,
          workbenchExecutionFingerprint,
          runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
          promptVersions: BOARD7B_WORKING_TASK_V1_PROMPT_VERSIONS,
          fixedOpening: BOARD7B_WORKING_TASK_V1_WORKBENCH_FIXED_OPENING,
          binding: HOST,
          startupStatus: "awaiting_start",
          modelCalls: 0
        },
        null,
        2
      )}\n`
    );
    return;
  }
  if (!process.argv.includes("--serve")) {
    throw new Error(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_COMMAND_REQUIRED: use --fingerprint, --inspect, --check, or --serve"
    );
  }

  const port = Number(argumentValue("--port") ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1_024 || port > 65_535) {
    throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_PORT_INVALID");
  }
  const html = await readFile(
    resolve(
      process.cwd(),
      "evals/event-centered-generative/board7b-working-task-v1/workbench.html"
    ),
    "utf8"
  );
  const trajectoryAuthorization =
    await validateBoard7bWorkingTaskV1WorkbenchAuthorization({
      candidateFingerprint,
      authorizationPath: argumentValue("--trajectory-authorization")
    });
  const recovered =
    await recoverBoard7bWorkingTaskV1WorkbenchCheckpoint({
      authorization: trajectoryAuthorization.authorization
    });
  const credential = await resolveCandidateCredential();
  await validateCandidateCredential(credential.apiKey);
  const serverToken = randomBytes(24).toString("hex");
  let checkpoint: Board7bWorkingTaskV1WorkbenchCheckpoint | null =
    recovered?.checkpoint ?? null;
  let checkpointPath: string | null = recovered?.checkpointPath ?? null;
  let provider: AIProvider | null = null;
  let inFlight = false;

  async function persist() {
    if (!checkpoint || !checkpointPath) {
      throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_CHECKPOINT_NOT_STARTED");
    }
    checkpoint.updatedAt = new Date().toISOString();
    await writeJsonAtomic(checkpointPath, checkpoint);
  }

  async function ensureProvider() {
    provider ??= await createCandidateProvider(credential.apiKey);
    return provider;
  }

  async function generatePendingTurn() {
    if (!checkpoint) {
      throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_SESSION_NOT_STARTED");
    }
    if (inFlight) {
      throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_TURN_ALREADY_IN_FLIGHT");
    }
    inFlight = true;
    try {
      let activeProvider: AIProvider;
      try {
        activeProvider = await ensureProvider();
      } catch (error) {
        await recordBoard7bWorkingTaskV1WorkbenchProviderFailure({
          checkpoint,
          error,
          persist
        });
        return;
      }
      await executeBoard7bWorkingTaskV1WorkbenchPendingTurn({
        checkpoint,
        provider: activeProvider,
        assets,
        persist
      });
    } finally {
      inFlight = false;
    }
  }

  const server = createServer(async (request, response) => {
    try {
      if (!requestIsLocal(request, port)) {
        response.writeHead(404).end();
        return;
      }
      const url = new URL(request.url ?? "/", `http://${HOST}:${port}`);
      const rawHeaderToken = request.headers["x-eval-token"];
      const headerToken = Array.isArray(rawHeaderToken)
        ? rawHeaderToken[0]
        : rawHeaderToken;
      const queryToken = url.searchParams.get("token") ?? undefined;
      if (!tokenMatches(headerToken ?? queryToken, serverToken)) {
        response.writeHead(404).end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "no-referrer"
        });
        response.end(html);
        return;
      }
      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204).end();
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/session") {
        sendJson(
          response,
          200,
          createBoard7bWorkingTaskV1WorkbenchPublicState(
            checkpoint,
            inFlight,
            candidateFingerprint
          )
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/start") {
        startInputSchema.parse(await readBody(request));
        if (checkpoint) {
          throw new Error(
            "BOARD7B_WORKING_TASK_V1_WORKBENCH_TRAJECTORY_ALREADY_STARTED"
          );
        }
        const newCheckpoint = createBoard7bWorkingTaskV1WorkbenchCheckpoint({
          candidateFingerprint,
          screeningAuthorizationId:
            trajectoryAuthorization.authorization.authorizationId,
          workbenchExecutionFingerprint:
            trajectoryAuthorization.workbenchExecutionFingerprint
        });
        const claim =
          await claimBoard7bWorkingTaskV1WorkbenchAuthorization({
            authorization: trajectoryAuthorization.authorization,
            checkpoint: newCheckpoint
          });
        checkpoint = newCheckpoint;
        checkpointPath = claim.checkpointPath;
        sendJson(
          response,
          200,
          createBoard7bWorkingTaskV1WorkbenchPublicState(checkpoint, inFlight)
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/turn") {
        if (!checkpoint) {
          throw new Error("BOARD7B_WORKING_TASK_V1_WORKBENCH_SESSION_NOT_STARTED");
        }
        if (
          checkpoint.status !== "running" ||
          checkpoint.pendingUserTurn ||
          inFlight
        ) {
          throw new Error(
            "BOARD7B_WORKING_TASK_V1_WORKBENCH_SESSION_NOT_READY_FOR_TURN"
          );
        }
        const input = turnInputSchema.parse(await readBody(request));
        submitBoard7bWorkingTaskV1WorkbenchUserTurn(checkpoint, input.content);
        await persist();
        await generatePendingTurn();
        sendJson(
          response,
          200,
          createBoard7bWorkingTaskV1WorkbenchPublicState(checkpoint, inFlight)
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/retry") {
        await readBody(request);
        if (
          !checkpoint ||
          checkpoint.status !== "technical_failure" ||
          !checkpoint.pendingUserTurn
        ) {
          throw new Error(
            "BOARD7B_WORKING_TASK_V1_WORKBENCH_TECHNICAL_RETRY_NOT_AVAILABLE"
          );
        }
        await generatePendingTurn();
        sendJson(
          response,
          200,
          createBoard7bWorkingTaskV1WorkbenchPublicState(checkpoint, inFlight)
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/end") {
        if (!checkpoint || inFlight) {
          throw new Error(
            "BOARD7B_WORKING_TASK_V1_WORKBENCH_SESSION_NOT_READY_TO_END"
          );
        }
        completeBoard7bWorkingTaskV1WorkbenchSession(
          checkpoint,
          await readBody(request)
        );
        await persist();
        sendJson(
          response,
          200,
          createBoard7bWorkingTaskV1WorkbenchPublicState(checkpoint, inFlight)
        );
        return;
      }
      response.writeHead(404).end();
    } catch (error) {
      sendError(response, 400, error);
    }
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, HOST, () => resolvePromise());
  });
  process.stdout.write(
    [
      "GI-087 共同任务真实深聊工作台已启动。",
      `候选指纹：${candidateFingerprint}`,
      `凭据状态：已通过 DeepSeek 官方认证与模型可用性检查（${credential.source}）。`,
      `打开：http://${HOST}:${port}/?token=${serverToken}`,
      "当前模型调用：0。开始只创建本机轨迹，发送第一段回答时才会调用 DeepSeek。"
    ].join("\n") + "\n"
  );
}

const shouldRun = ["--fingerprint", "--inspect", "--check", "--serve"].some(
  (flag) => process.argv.includes(flag)
);

if (shouldRun) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
