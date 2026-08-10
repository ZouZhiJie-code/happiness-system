import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  open as openFile,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import {
  BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
  BOARD7B_WORKING_TASK_V1_EVALUATION_ID,
  BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY,
  BOARD7B_WORKING_TASK_V1_RUNNER_VERSION,
  BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
  applyBoard7bWorkingTaskV1Result,
  createBoard7bWorkingTaskV1CandidateFingerprint,
  createBoard7bWorkingTaskV1ModelInput,
  createBoard7bWorkingTaskV1UserPrompt,
  loadBoard7bWorkingTaskV1Assets,
  loadBoard7bWorkingTaskV1RegressionDataset,
  parseBoard7bWorkingTaskV1Output,
  validateBoard7bWorkingTaskV1Output,
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

const AUTHORIZATION_TEMPLATE_FILE =
  "board7b-working-task-v1-authorization-template.json";
const APPROVED_AUTHORIZATION_FILE =
  "board7b-working-task-v1-regression-authorization.json";
const REGRESSION_PLAN_FILE = "board7b-working-task-v1-regression-plan.json";
const MANIFEST_FILE = "board7b-working-task-v1-manifest.json";
const RUBRIC_FILE = "board7b-working-task-v1-rubric.md";
const SOURCE_LINEAGE_FILE = "board7b-working-task-v1-source-lineage.json";
const LOCAL_RUNTIME_DIRECTORY =
  "artifacts/local-runtime/generative-interview-board7/2026-08-07-board7b-working-task-v1";
const AUTHORIZATION_CONSUMPTION_DIRECTORY = `${LOCAL_RUNTIME_DIRECTORY}/authorization-consumption`;

const EXECUTION_SOURCE_PATHS = [
  "evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1.ts",
  "scripts/execute-board7b-working-task-v1-regression.ts",
  "scripts/inspect-board7b-working-task-v1.ts",
  "scripts/run-board7b-working-task-v1-regression.ts",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "vitest.config.ts",
  "tsconfig.json",
  "node_modules/.modules.yaml",
  "node_modules/vite-node/package.json",
  "node_modules/vite/package.json",
  "node_modules/zod/package.json"
] as const;
const EXECUTION_SOURCE_DIRECTORIES = ["src/server/services/ai"] as const;
const KEYCHAIN_ACCOUNT = "board7a";
const KEYCHAIN_SERVICE = "com.dailylight.local-eval.deepseek";
const execFileAsync = promisify(execFile);

const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const strictString = z.string().trim().min(1);

const authorizationTemplateSchema = z
  .object({
    template: z.literal(true),
    authorizationVersion: z.literal(
      "2026-08-07.board7b-working-task-authorization-v1"
    ),
    decision: z.literal("pending"),
    candidateVersion: z.literal(BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION),
    candidateFingerprint: fingerprintSchema,
    datasetFingerprint: fingerprintSchema,
    sourceLineageFingerprint: fingerprintSchema,
    requestSetFingerprint: fingerprintSchema,
    evaluationPolicyFingerprint: fingerprintSchema,
    executionFingerprint: fingerprintSchema,
    runnerVersion: z.literal(BOARD7B_WORKING_TASK_V1_RUNNER_VERSION),
    authorizationId: z.null(),
    authorizationScope: z.literal("six_case_working_task_regression"),
    plannedModelCallBudget: z.literal(6),
    authorizedModelCallBudget: z.literal(0),
    manualTechnicalRetryBudget: z.literal(2),
    authorizedEnvironment: z.literal("isolated_local_evaluation"),
    approvedBy: z.null(),
    approvedAt: z.null(),
    productionChangeAuthorized: z.literal(false),
    confirmationText: strictString
  })
  .strict();

const approvedAuthorizationSchema = z
  .object({
    template: z.literal(false),
    authorizationVersion: z.literal(
      "2026-08-07.board7b-working-task-authorization-v1"
    ),
    decision: z.literal("approved"),
    candidateVersion: z.literal(BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION),
    candidateFingerprint: fingerprintSchema,
    datasetFingerprint: fingerprintSchema,
    sourceLineageFingerprint: fingerprintSchema,
    requestSetFingerprint: fingerprintSchema,
    evaluationPolicyFingerprint: fingerprintSchema,
    executionFingerprint: fingerprintSchema,
    runnerVersion: z.literal(BOARD7B_WORKING_TASK_V1_RUNNER_VERSION),
    authorizationId: z.string().uuid(),
    authorizationScope: z.literal("six_case_working_task_regression"),
    plannedModelCallBudget: z.literal(6),
    authorizedModelCallBudget: z.literal(6),
    manualTechnicalRetryBudget: z.literal(2),
    authorizedEnvironment: z.literal("isolated_local_evaluation"),
    approvedBy: z.literal("product_owner_conversation"),
    approvedAt: z.string().datetime(),
    productionChangeAuthorized: z.literal(false),
    confirmationText: strictString,
    authorizationDigest: fingerprintSchema
  })
  .strict();

const regressionPlanSchema = z
  .object({
    planVersion: z.literal("2026-08-07.board7b-working-task-regression-v1"),
    candidateVersion: z.literal(BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION),
    candidateFingerprint: fingerprintSchema,
    runnerVersion: z.literal(BOARD7B_WORKING_TASK_V1_RUNNER_VERSION),
    datasetVersion: z.literal(
      "2026-08-07.board7b-working-task-regression-inputs-v1"
    ),
    datasetFingerprint: fingerprintSchema,
    sourceLineageFingerprint: fingerprintSchema,
    requestSetFingerprint: fingerprintSchema,
    evaluationPolicyFingerprint: fingerprintSchema,
    executionFingerprint: fingerprintSchema,
    plannedCalls: z.literal(6),
    authorizedCalls: z.literal(0),
    distribution: z
      .object({
        realHistoryCheckpoints: z.literal(4),
        syntheticGuardrails: z.literal(2)
      })
      .strict(),
    stopCriteria: z
      .object({
        unresolvedTechnicalFailure: z.literal("stop"),
        invalidStructureOrSource: z.literal("stop"),
        singleCaseBlock: z.literal("stop"),
        ordinaryQualityIssues: z.literal("product_owner_overall_decision")
      })
      .strict(),
    qualityRetries: z.literal(0),
    automaticTechnicalRetries: z.literal(0),
    manualTechnicalRetryBudget: z.literal(2),
    realTrajectoryAfterScreening: z.literal(
      "requires_separate_product_owner_authorization"
    )
  })
  .strict();

const manifestFingerprintSchema = z
  .object({
    candidateFingerprint: fingerprintSchema,
    regression: z
      .object({
        datasetFingerprint: fingerprintSchema,
        sourceLineageFingerprint: fingerprintSchema,
        requestSetFingerprint: fingerprintSchema,
        evaluationPolicyFingerprint: fingerprintSchema,
        executionFingerprint: fingerprintSchema,
        plannedCalls: z.literal(6),
        authorizedCalls: z.literal(0),
        modelCalls: z.literal(0),
        manualTechnicalRetryBudget: z.literal(2)
      })
      .passthrough()
  })
  .passthrough();

const sourceLineageSchema = z
  .object({
    ledgerVersion: z.literal(
      "2026-08-07.board7b-working-task-source-lineage-v1"
    ),
    datasetVersion: z.literal(
      "2026-08-07.board7b-working-task-regression-inputs-v1"
    ),
    productionDataUsed: z.literal(false),
    entries: z
      .array(
        z
          .object({
            caseId: strictString,
            sourceType: z.enum([
              "real_history_checkpoint",
              "synthetic_guardrail"
            ]),
            readOnlySourcePath: strictString,
            durableCrossCheckPath: strictString,
            originReadbackPath: strictString.optional(),
            sourceLocator: z.record(z.string(), z.unknown()),
            extractionBoundary: strictString
          })
          .strict()
      )
      .length(6)
  })
  .strict();

type Board7bWorkingTaskV1SourceLineage = z.infer<typeof sourceLineageSchema>;

export type Board7bWorkingTaskV1RegressionCase = {
  callNumber: number;
  caseId: string;
  sourceType: "real_history_checkpoint" | "synthetic_guardrail";
  turnInput: Board7bWorkingTaskV1TurnInput;
  modelInput: ReturnType<typeof createBoard7bWorkingTaskV1ModelInput>;
  userPrompt: string;
  requestHash: string;
};

export type Board7bWorkingTaskV1RegressionCallRecord = {
  callNumber: number;
  caseId: string;
  sourceType: Board7bWorkingTaskV1RegressionCase["sourceType"];
  startedAt: string;
  completedAt: string;
  status:
    | "valid"
    | "protected_failure"
    | "model_contract_failure"
    | "technical_failure";
  requestHash: string;
  responseHash: string | null;
  provider: string | null;
  latencyMs: number | null;
  tokenUsage: AICompletionResult["tokenUsage"] | null;
  modelInput: ReturnType<typeof createBoard7bWorkingTaskV1ModelInput>;
  rawOutput: string | null;
  output: Board7bWorkingTaskV1Output | null;
  validationIssues: string[];
  semanticStateAfter: Board7bWorkingTaskV1SemanticState | null;
  errorCode: string | null;
};

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createBoard7bWorkingTaskV1AuthorizationDigest(
  authorization: Omit<
    z.infer<typeof approvedAuthorizationSchema>,
    "authorizationDigest"
  >
) {
  return sha256(JSON.stringify(authorization));
}

export async function writeJsonAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export async function writeJsonExclusive(path: string, value: unknown) {
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
        new Error("BOARD7B_WORKING_TASK_V1_RUN_OUTPUT_ALREADY_EXISTS"),
        { code: "BOARD7B_WORKING_TASK_V1_RUN_OUTPUT_ALREADY_EXISTS" }
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

export async function resolveBoard7bWorkingTaskV1Credential() {
  const processKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (processKey) return { apiKey: processKey, source: "process_environment" };
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
    if (apiKey) return { apiKey, source: "macos_keychain" };
  } catch {
    // 错误记录保持无凭据内容。
  }
  throw Object.assign(new Error("EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"), {
    code: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"
  });
}

export async function validateBoard7bWorkingTaskV1Credential(apiKey: string) {
  const response = await fetch("https://api.deepseek.com/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000)
  });
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

export async function createBoard7bWorkingTaskV1Provider(apiKey: string) {
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
  if (!provider) throw new Error("BOARD7B_WORKING_TASK_V1_PROVIDER_UNAVAILABLE");
  return provider;
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await collectSourceFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      paths.push(path);
    }
  }
  return paths;
}

export async function createBoard7bWorkingTaskV1SourceLineageFingerprint(input: {
  workspaceRoot?: string;
  ledgerSource: string;
  lineage: Board7bWorkingTaskV1SourceLineage;
}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const paths = [
    ...new Set(
      input.lineage.entries.flatMap((entry) => [
        entry.readOnlySourcePath,
        entry.durableCrossCheckPath
      ])
    )
  ].sort();
  const sources = await Promise.all(
    paths.map(async (path) => ({
      path,
      sha256: sha256(await readFile(resolve(workspaceRoot, path), "utf8"))
    }))
  );
  return sha256(
    JSON.stringify({
      ledgerSha256: sha256(input.ledgerSource.trim()),
      mandatorySources: sources
    })
  );
}

export async function createBoard7bWorkingTaskV1ExecutionFingerprint(input: {
  workspaceRoot?: string;
  candidateFingerprint: string;
  datasetFingerprint: string;
  sourceLineageFingerprint: string;
  requestSetFingerprint: string;
  evaluationPolicyFingerprint: string;
}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const fixedPaths = EXECUTION_SOURCE_PATHS.map((path) =>
    resolve(workspaceRoot, path)
  );
  const directoryPaths = (
    await Promise.all(
      EXECUTION_SOURCE_DIRECTORIES.map((path) =>
        collectSourceFiles(resolve(workspaceRoot, path))
      )
    )
  ).flat();
  const sourcePaths = [...new Set([...fixedPaths, ...directoryPaths])].sort();
  const sources = await Promise.all(
    sourcePaths.map(async (path) => ({
      path: relative(workspaceRoot, path),
      sha256: sha256(await readFile(path, "utf8"))
    }))
  );
  return sha256(
    JSON.stringify({
      candidateFingerprint: input.candidateFingerprint,
      datasetFingerprint: input.datasetFingerprint,
      sourceLineageFingerprint: input.sourceLineageFingerprint,
      requestSetFingerprint: input.requestSetFingerprint,
      evaluationPolicyFingerprint: input.evaluationPolicyFingerprint,
      runnerVersion: BOARD7B_WORKING_TASK_V1_RUNNER_VERSION,
      runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
      runtimeEnvironment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        entryCommand:
          "npx vite-node -c vitest.config.ts scripts/execute-board7b-working-task-v1-regression.ts"
      },
      sources
    })
  );
}

export async function claimBoard7bWorkingTaskV1Authorization(input: {
  workspaceRoot?: string;
  authorizationId: string;
  candidateFingerprint: string;
  datasetFingerprint: string;
  sourceLineageFingerprint: string;
  requestSetFingerprint: string;
  executionFingerprint: string;
  authorizationDigest: string;
  runFingerprint: string;
  callBudget: number;
  claimedAt?: string;
}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const path = resolve(
    workspaceRoot,
    AUTHORIZATION_CONSUMPTION_DIRECTORY,
    `${input.authorizationId}.json`
  );
  const record = {
    authorizationId: input.authorizationId,
    candidateFingerprint: input.candidateFingerprint,
    datasetFingerprint: input.datasetFingerprint,
    sourceLineageFingerprint: input.sourceLineageFingerprint,
    requestSetFingerprint: input.requestSetFingerprint,
    executionFingerprint: input.executionFingerprint,
    authorizationDigest: input.authorizationDigest,
    runFingerprint: input.runFingerprint,
    callBudget: input.callBudget,
    claimedAt: input.claimedAt ?? new Date().toISOString(),
    scope: "six_case_working_task_regression"
  } as const;
  await writeJsonExclusive(path, record);
  return { path, record };
}

export function createBoard7bWorkingTaskV1RunFingerprint(input: {
  candidateFingerprint: string;
  datasetFingerprint: string;
  sourceLineageFingerprint: string;
  requestSetFingerprint: string;
  evaluationPolicyFingerprint: string;
  executionFingerprint: string;
  authorizationId: string;
  authorizationDigest: string;
  approvedAt: string;
  baseCallBudget: number;
  manualTechnicalRetryBudget: number;
}) {
  return sha256(
    JSON.stringify({
      ...input,
      runnerVersion: BOARD7B_WORKING_TASK_V1_RUNNER_VERSION
    })
  );
}

function regressionErrorCode(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") {
    return "INVALID_JSON_SCHEMA";
  }
  if (error instanceof SyntaxError) return "INVALID_JSON";
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

function collectJsonMessages(
  value: unknown,
  output: Array<{ id: string; role: string; content: string }> = []
) {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonMessages(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.id === "string" &&
      typeof candidate.role === "string" &&
      typeof candidate.content === "string"
    ) {
      output.push({
        id: candidate.id,
        role: candidate.role,
        content: candidate.content
      });
    }
    for (const item of Object.values(value)) collectJsonMessages(item, output);
  }
  return output;
}

function hasExactMessages(
  source: string,
  messages: Board7bWorkingTaskV1TurnInput["conversation"]
) {
  const sourceMessages = collectJsonMessages(JSON.parse(source) as unknown);
  return messages.every((message) =>
    sourceMessages.some(
      (candidate) =>
        candidate.id === message.id &&
        candidate.role === message.role &&
        candidate.content === message.content
    )
  );
}

export async function verifyBoard7bWorkingTaskV1SourceLineage(input: {
  workspaceRoot?: string;
  cases: Array<
    Pick<
      Board7bWorkingTaskV1RegressionCase,
      "caseId" | "sourceType" | "turnInput"
    >
  >;
  sourceLineage: { entries: Board7bWorkingTaskV1SourceLineage["entries"] };
}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const lineageByCaseId = new Map(
    input.sourceLineage.entries.map((entry) => [entry.caseId, entry])
  );
  if (lineageByCaseId.size !== input.cases.length) {
    throw new Error("BOARD7B_WORKING_TASK_V1_SOURCE_LINEAGE_CASE_COUNT_MISMATCH");
  }
  const optionalOriginReadback = {
    verified: [] as string[],
    unavailable: [] as string[]
  };
  for (const item of input.cases) {
    const lineage = lineageByCaseId.get(item.caseId);
    if (!lineage || lineage.sourceType !== item.sourceType) {
      throw new Error(
        `BOARD7B_WORKING_TASK_V1_SOURCE_LINEAGE_CASE_MISMATCH:${item.caseId}`
      );
    }
    const includedMessageIds = lineage.sourceLocator.includedMessageIds;
    if (
      !Array.isArray(includedMessageIds) ||
      includedMessageIds.length !== item.turnInput.conversation.length ||
      !includedMessageIds.every(
        (id, index) => id === item.turnInput.conversation[index]?.id
      )
    ) {
      throw new Error(
        `BOARD7B_WORKING_TASK_V1_SOURCE_LINEAGE_MESSAGE_IDS_MISMATCH:${item.caseId}`
      );
    }
    const [source] = await Promise.all([
      readFile(resolve(workspaceRoot, lineage.readOnlySourcePath), "utf8"),
      readFile(resolve(workspaceRoot, lineage.durableCrossCheckPath), "utf8")
    ]);
    if (
      item.sourceType === "real_history_checkpoint" &&
      !hasExactMessages(source, item.turnInput.conversation)
    ) {
      throw new Error(
        `BOARD7B_WORKING_TASK_V1_SOURCE_VERBATIM_MISMATCH:${item.caseId}`
      );
    }
    if (lineage.originReadbackPath) {
      try {
        const origin = await readFile(
          resolve(workspaceRoot, lineage.originReadbackPath),
          "utf8"
        );
        if (!hasExactMessages(origin, item.turnInput.conversation)) {
          throw new Error(
            `BOARD7B_WORKING_TASK_V1_OPTIONAL_ORIGIN_VERBATIM_MISMATCH:${item.caseId}`
          );
        }
        optionalOriginReadback.verified.push(item.caseId);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          optionalOriginReadback.unavailable.push(item.caseId);
        } else {
          throw error;
        }
      }
    }
  }
  return optionalOriginReadback;
}

export async function inspectBoard7bWorkingTaskV1Regression(
  workspaceRoot = process.cwd(),
  options: { verifyRecordedFingerprints?: boolean } = {}
) {
  const packagePath = resolve(
    workspaceRoot,
    BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY
  );
  const [
    assets,
    dataset,
    planSource,
    templateSource,
    manifestSource,
    rubric,
    sourceLineageSource
  ] = await Promise.all([
      loadBoard7bWorkingTaskV1Assets(workspaceRoot),
      loadBoard7bWorkingTaskV1RegressionDataset(workspaceRoot),
      readFile(resolve(packagePath, REGRESSION_PLAN_FILE), "utf8"),
      readFile(resolve(packagePath, AUTHORIZATION_TEMPLATE_FILE), "utf8"),
      readFile(resolve(packagePath, MANIFEST_FILE), "utf8"),
      readFile(resolve(packagePath, RUBRIC_FILE), "utf8"),
      readFile(resolve(packagePath, SOURCE_LINEAGE_FILE), "utf8")
    ]);
  const sourceLineage = sourceLineageSchema.parse(
    JSON.parse(sourceLineageSource) as unknown
  );
  const sourceLineageFingerprint =
    await createBoard7bWorkingTaskV1SourceLineageFingerprint({
      workspaceRoot,
      ledgerSource: sourceLineageSource,
      lineage: sourceLineage
    });
  const candidateFingerprint =
    createBoard7bWorkingTaskV1CandidateFingerprint(assets);
  const cases = dataset.cases.map((item, index) => {
    const modelInput = createBoard7bWorkingTaskV1ModelInput(item.turnInput);
    const userPrompt = createBoard7bWorkingTaskV1UserPrompt(item.turnInput);
    const requestHash = sha256(
      JSON.stringify({
        systemPrompt: assets.systemPrompt,
        userPrompt,
        runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG
      })
    );
    return {
      callNumber: index + 1,
      caseId: item.caseId,
      sourceType: item.sourceType,
      turnInput: item.turnInput,
      modelInput,
      userPrompt,
      requestHash
    } satisfies Board7bWorkingTaskV1RegressionCase;
  });
  const requestSetFingerprint = sha256(
    JSON.stringify(
      cases.map((item) => ({
        callNumber: item.callNumber,
        caseId: item.caseId,
        sourceType: item.sourceType,
        requestHash: item.requestHash
      }))
    )
  );
  const evaluationPolicyFingerprint = sha256(rubric.trim());
  const executionFingerprint =
    await createBoard7bWorkingTaskV1ExecutionFingerprint({
      workspaceRoot,
      candidateFingerprint,
      datasetFingerprint: dataset.datasetFingerprint,
      sourceLineageFingerprint,
      requestSetFingerprint,
      evaluationPolicyFingerprint
    });
  if (!options.verifyRecordedFingerprints) {
    return {
      assets,
      dataset,
      sourceLineage,
      candidateFingerprint,
      sourceLineageFingerprint,
      requestSetFingerprint,
      evaluationPolicyFingerprint,
      executionFingerprint,
      cases
    };
  }
  const plan = regressionPlanSchema.parse(JSON.parse(planSource) as unknown);
  const template = authorizationTemplateSchema.parse(
    JSON.parse(templateSource) as unknown
  );
  const manifest = manifestFingerprintSchema.parse(
    JSON.parse(manifestSource) as unknown
  );
  const fingerprintSources = [
    plan,
    template,
    {
      candidateFingerprint: manifest.candidateFingerprint,
      datasetFingerprint: manifest.regression.datasetFingerprint,
      sourceLineageFingerprint:
        manifest.regression.sourceLineageFingerprint,
      requestSetFingerprint: manifest.regression.requestSetFingerprint,
      evaluationPolicyFingerprint:
        manifest.regression.evaluationPolicyFingerprint,
      executionFingerprint: manifest.regression.executionFingerprint
    }
  ];
  for (const source of fingerprintSources) {
    if (source.candidateFingerprint !== candidateFingerprint) {
      throw new Error("BOARD7B_WORKING_TASK_V1_CANDIDATE_FINGERPRINT_MISMATCH");
    }
    if (source.datasetFingerprint !== dataset.datasetFingerprint) {
      throw new Error("BOARD7B_WORKING_TASK_V1_DATASET_FINGERPRINT_MISMATCH");
    }
    if (source.sourceLineageFingerprint !== sourceLineageFingerprint) {
      throw new Error(
        "BOARD7B_WORKING_TASK_V1_SOURCE_LINEAGE_FINGERPRINT_MISMATCH"
      );
    }
    if (source.requestSetFingerprint !== requestSetFingerprint) {
      throw new Error("BOARD7B_WORKING_TASK_V1_REQUEST_SET_FINGERPRINT_MISMATCH");
    }
    if (source.evaluationPolicyFingerprint !== evaluationPolicyFingerprint) {
      throw new Error(
        "BOARD7B_WORKING_TASK_V1_EVALUATION_POLICY_FINGERPRINT_MISMATCH"
      );
    }
    if (source.executionFingerprint !== executionFingerprint) {
      throw new Error("BOARD7B_WORKING_TASK_V1_EXECUTION_FINGERPRINT_MISMATCH");
    }
  }
  if (
    dataset.cases.length !== plan.plannedCalls ||
    dataset.cases.length !== template.plannedModelCallBudget
  ) {
    throw new Error("BOARD7B_WORKING_TASK_V1_CALL_BUDGET_MISMATCH");
  }
  const sourceDistribution = {
    realHistoryCheckpoints: cases.filter(
      (item) => item.sourceType === "real_history_checkpoint"
    ).length,
    syntheticGuardrails: cases.filter(
      (item) => item.sourceType === "synthetic_guardrail"
    ).length
  };
  if (
    sourceDistribution.realHistoryCheckpoints !== 4 ||
    sourceDistribution.syntheticGuardrails !== 2
  ) {
    throw new Error("BOARD7B_WORKING_TASK_V1_SOURCE_DISTRIBUTION_MISMATCH");
  }
  const optionalOriginReadback =
    await verifyBoard7bWorkingTaskV1SourceLineage({
      workspaceRoot,
      cases,
      sourceLineage
    });
  return {
    assets,
    dataset,
    sourceLineage,
    plan,
    template,
    manifest,
    candidateFingerprint,
    sourceLineageFingerprint,
    requestSetFingerprint,
    evaluationPolicyFingerprint,
    executionFingerprint,
    sourceDistribution,
    optionalOriginReadback,
    cases
  };
}

export async function executeBoard7bWorkingTaskV1RegressionCase(input: {
  regressionCase: Board7bWorkingTaskV1RegressionCase;
  provider: AIProvider;
  systemPrompt: string;
}): Promise<Board7bWorkingTaskV1RegressionCallRecord> {
  const startedAt = new Date().toISOString();
  const { modelInput, userPrompt, requestHash } = input.regressionCase;
  const recomputedRequestHash = sha256(
    JSON.stringify({
      systemPrompt: input.systemPrompt,
      userPrompt,
      runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG
    })
  );
  if (recomputedRequestHash !== requestHash) {
    throw new Error("BOARD7B_WORKING_TASK_V1_PREPARED_REQUEST_MISMATCH");
  }
  let completion: AICompletionResult | null = null;
  try {
    completion = await input.provider.complete({
      messages: [
        { role: "system", content: input.systemPrompt },
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
      input: input.regressionCase.turnInput,
      output
    });
    const semanticStateAfter = validationIssues.length
      ? null
      : applyBoard7bWorkingTaskV1Result({
          input: input.regressionCase.turnInput,
          output
        });
    return {
      callNumber: input.regressionCase.callNumber,
      caseId: input.regressionCase.caseId,
      sourceType: input.regressionCase.sourceType,
      startedAt,
      completedAt: new Date().toISOString(),
      status: validationIssues.length ? "protected_failure" : "valid",
      requestHash,
      responseHash: sha256(completion.content),
      provider: completion.provider,
      latencyMs: completion.latencyMs,
      tokenUsage: completion.tokenUsage ?? null,
      modelInput,
      rawOutput: completion.content,
      output,
      validationIssues,
      semanticStateAfter,
      errorCode: validationIssues.length
        ? "PROGRAM_PROTECTION_REJECTED"
        : null
    };
  } catch (error) {
    const errorCode = regressionErrorCode(error);
    const modelContractFailure =
      completion !== null &&
      (errorCode === "INVALID_JSON" || errorCode === "INVALID_JSON_SCHEMA");
    return {
      callNumber: input.regressionCase.callNumber,
      caseId: input.regressionCase.caseId,
      sourceType: input.regressionCase.sourceType,
      startedAt,
      completedAt: new Date().toISOString(),
      status: modelContractFailure
        ? "model_contract_failure"
        : "technical_failure",
      requestHash,
      responseHash: completion?.content ? sha256(completion.content) : null,
      provider: completion?.provider ?? input.provider.name,
      latencyMs: completion?.latencyMs ?? null,
      tokenUsage: completion?.tokenUsage ?? null,
      modelInput,
      rawOutput: completion?.content ?? null,
      output: null,
      validationIssues: modelContractFailure ? [errorCode] : [],
      semanticStateAfter: null,
      errorCode
    };
  }
}

async function readApprovedAuthorization(packagePath: string) {
  let source: string;
  try {
    source = await readFile(
      resolve(packagePath, APPROVED_AUTHORIZATION_FILE),
      "utf8"
    );
  } catch {
    throw Object.assign(
      new Error("BOARD7B_WORKING_TASK_V1_AUTHORIZATION_FILE_MISSING"),
      { code: "BOARD7B_WORKING_TASK_V1_AUTHORIZATION_FILE_MISSING" }
    );
  }
  const authorization = approvedAuthorizationSchema.parse(
    JSON.parse(source) as unknown
  );
  const { authorizationDigest, ...unsignedAuthorization } = authorization;
  if (
    authorizationDigest !==
    createBoard7bWorkingTaskV1AuthorizationDigest(unsignedAuthorization)
  ) {
    throw new Error("BOARD7B_WORKING_TASK_V1_AUTHORIZATION_DIGEST_MISMATCH");
  }
  return authorization;
}

function assertBoard7bWorkingTaskV1IsolatedEnvironment() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("BOARD7B_WORKING_TASK_V1_PRODUCTION_ENVIRONMENT_REJECTED");
  }
}

async function preflightBoard7bWorkingTaskV1LocalWrite(workspaceRoot: string) {
  const directory = resolve(workspaceRoot, LOCAL_RUNTIME_DIRECTORY);
  await mkdir(directory, { recursive: true });
  const probePath = resolve(
    directory,
    `.write-preflight-${process.pid}-${Date.now()}.tmp`
  );
  const probe = await openFile(probePath, "wx");
  try {
    await probe.writeFile("local-evaluation-write-preflight\n", "utf8");
    await probe.sync();
  } finally {
    await probe.close();
    await unlink(probePath);
  }
}

export async function runBoard7bWorkingTaskV1Regression() {
  const workspaceRoot = process.cwd();
  const inspected = await inspectBoard7bWorkingTaskV1Regression(workspaceRoot, {
    verifyRecordedFingerprints: true
  });
  const packagePath = resolve(
    workspaceRoot,
    BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY
  );
  const authorization = await readApprovedAuthorization(packagePath);
  assertBoard7bWorkingTaskV1IsolatedEnvironment();
  if (
    authorization.candidateFingerprint !== inspected.candidateFingerprint ||
    authorization.datasetFingerprint !== inspected.dataset.datasetFingerprint ||
    authorization.sourceLineageFingerprint !==
      inspected.sourceLineageFingerprint ||
    authorization.requestSetFingerprint !== inspected.requestSetFingerprint ||
    authorization.evaluationPolicyFingerprint !==
      inspected.evaluationPolicyFingerprint ||
    authorization.executionFingerprint !== inspected.executionFingerprint
  ) {
    throw new Error("BOARD7B_WORKING_TASK_V1_AUTHORIZATION_FINGERPRINT_MISMATCH");
  }
  if (authorization.authorizedModelCallBudget !== inspected.cases.length) {
    throw new Error("BOARD7B_WORKING_TASK_V1_AUTHORIZED_BUDGET_MISMATCH");
  }
  const runFingerprint = createBoard7bWorkingTaskV1RunFingerprint({
    candidateFingerprint: inspected.candidateFingerprint,
    datasetFingerprint: inspected.dataset.datasetFingerprint,
    sourceLineageFingerprint: inspected.sourceLineageFingerprint,
    requestSetFingerprint: inspected.requestSetFingerprint,
    evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
    executionFingerprint: inspected.executionFingerprint,
    authorizationId: authorization.authorizationId,
    authorizationDigest: authorization.authorizationDigest,
    approvedAt: authorization.approvedAt,
    baseCallBudget: authorization.authorizedModelCallBudget,
    manualTechnicalRetryBudget: authorization.manualTechnicalRetryBudget
  });
  const outputPath = resolve(
    workspaceRoot,
    LOCAL_RUNTIME_DIRECTORY,
    `regression-${runFingerprint}`,
    "raw-results.json"
  );
  const run = {
    evaluationId: `${BOARD7B_WORKING_TASK_V1_EVALUATION_ID}_regression`,
    candidateVersion: BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
    candidateFingerprint: inspected.candidateFingerprint,
    datasetVersion: inspected.dataset.datasetVersion,
    datasetFingerprint: inspected.dataset.datasetFingerprint,
    sourceLineageFingerprint: inspected.sourceLineageFingerprint,
    requestSetFingerprint: inspected.requestSetFingerprint,
    evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
    executionFingerprint: inspected.executionFingerprint,
    runnerVersion: BOARD7B_WORKING_TASK_V1_RUNNER_VERSION,
    runFingerprint,
    authorization: {
      authorizationId: authorization.authorizationId,
      authorizationDigest: authorization.authorizationDigest,
      scope: authorization.authorizationScope,
      approvedBy: authorization.approvedBy,
      approvedAt: authorization.approvedAt,
      baseCallBudget: authorization.authorizedModelCallBudget,
      manualTechnicalRetryBudget: authorization.manualTechnicalRetryBudget,
      consumptionRecordPath: null as string | null
    },
    runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    environment: {
      node: process.version,
      platform: process.platform,
      production: false
    },
    attempts: [] as Array<{
      callNumber: number;
      caseId: string;
      requestHash: string;
      startedAt: string;
      completedAt: string | null;
      status: "in_flight" | Board7bWorkingTaskV1RegressionCallRecord["status"];
    }>,
    calls: [] as Board7bWorkingTaskV1RegressionCallRecord[],
    manualTechnicalRetries: [] as Array<{
      retryNumber: number;
      caseId: string;
      requestHash: string;
      claimedAt: string;
      completedAt: string | null;
      status: "in_flight" | Board7bWorkingTaskV1RegressionCallRecord["status"];
      consumptionRecordPath: string;
      record: Board7bWorkingTaskV1RegressionCallRecord | null;
    }>
  };

  const credential = await resolveBoard7bWorkingTaskV1Credential();
  await validateBoard7bWorkingTaskV1Credential(credential.apiKey);
  const provider = await createBoard7bWorkingTaskV1Provider(credential.apiKey);
  await preflightBoard7bWorkingTaskV1LocalWrite(workspaceRoot);
  const authorizationClaim = await claimBoard7bWorkingTaskV1Authorization({
    workspaceRoot,
    authorizationId: authorization.authorizationId,
    candidateFingerprint: inspected.candidateFingerprint,
    datasetFingerprint: inspected.dataset.datasetFingerprint,
    sourceLineageFingerprint: inspected.sourceLineageFingerprint,
    requestSetFingerprint: inspected.requestSetFingerprint,
    executionFingerprint: inspected.executionFingerprint,
    authorizationDigest: authorization.authorizationDigest,
    runFingerprint,
    callBudget: authorization.authorizedModelCallBudget
  });
  run.authorization.consumptionRecordPath = authorizationClaim.path;
  await writeJsonExclusive(outputPath, run);
  for (const regressionCase of inspected.cases) {
    const attempt: (typeof run.attempts)[number] = {
      callNumber: regressionCase.callNumber,
      caseId: regressionCase.caseId,
      requestHash: regressionCase.requestHash,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_flight"
    };
    run.attempts.push(attempt);
    await writeJsonAtomic(outputPath, run);
    await writeJsonExclusive(
      resolve(
        dirname(outputPath),
        "attempts",
        `${String(regressionCase.callNumber).padStart(2, "0")}-${regressionCase.caseId}.json`
      ),
      attempt
    );
    const record = await executeBoard7bWorkingTaskV1RegressionCase({
      regressionCase,
      provider,
      systemPrompt: inspected.assets.systemPrompt
    });
    await writeJsonExclusive(
      resolve(
        dirname(outputPath),
        "results",
        `${String(regressionCase.callNumber).padStart(2, "0")}-${regressionCase.caseId}.json`
      ),
      record
    );
    attempt.completedAt = record.completedAt;
    attempt.status = record.status;
    run.calls.push(record);
    await writeJsonAtomic(outputPath, run);
    process.stdout.write(
      `调用 ${record.callNumber}/6｜${record.caseId}｜${record.status}\n`
    );
  }
  run.completedAt = new Date().toISOString();
  await writeJsonAtomic(outputPath, run);
  process.stdout.write(
    `${JSON.stringify(
      {
        runFingerprint,
        outputPath,
        attemptedCalls: run.calls.length,
        valid: run.calls.filter((call) => call.status === "valid").length,
        protectedFailures: run.calls.filter(
          (call) => call.status === "protected_failure"
        ).length,
        modelContractFailures: run.calls.filter(
          (call) => call.status === "model_contract_failure"
        ).length,
        technicalFailures: run.calls.filter(
          (call) => call.status === "technical_failure"
        ).length,
        automaticTechnicalRetries: 0,
        qualityRetries: 0,
        manualTechnicalRetriesUsed: 0
      },
      null,
      2
    )}\n`
  );
}

type ManualRetryRunState = {
  candidateFingerprint: string;
  datasetFingerprint: string;
  sourceLineageFingerprint: string;
  requestSetFingerprint: string;
  evaluationPolicyFingerprint: string;
  executionFingerprint: string;
  runFingerprint: string;
  completedAt: string | null;
  authorization: {
    authorizationId: string;
    authorizationDigest: string;
    consumptionRecordPath: string | null;
    manualTechnicalRetryBudget: number;
  };
  calls: Board7bWorkingTaskV1RegressionCallRecord[];
  manualTechnicalRetries?: Array<{
    retryNumber: number;
    caseId: string;
    requestHash: string;
    claimedAt: string;
    completedAt: string | null;
    status: "in_flight" | Board7bWorkingTaskV1RegressionCallRecord["status"];
    consumptionRecordPath: string;
    record: Board7bWorkingTaskV1RegressionCallRecord | null;
  }>;
};

async function acquireManualRetryLock(runDirectory: string) {
  const path = resolve(runDirectory, "manual-retry.lock");
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
        new Error("BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_LOCKED"),
        { code: "BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_LOCKED" }
      );
    }
    throw error;
  }
  await file.writeFile(
    `${JSON.stringify({ pid: process.pid, lockedAt: new Date().toISOString() })}\n`,
    "utf8"
  );
  await file.sync();
  await file.close();
  return path;
}

export async function executeBoard7bWorkingTaskV1ManualTechnicalRetry(input: {
  workspaceRoot?: string;
  outputPath: string;
  regressionCase: Board7bWorkingTaskV1RegressionCase;
  provider: AIProvider;
  systemPrompt: string;
  expected: {
    candidateFingerprint: string;
    datasetFingerprint: string;
    sourceLineageFingerprint: string;
    requestSetFingerprint: string;
    evaluationPolicyFingerprint: string;
    executionFingerprint: string;
    runFingerprint: string;
    authorizationId: string;
    authorizationDigest: string;
  };
}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const outputPath = resolve(workspaceRoot, input.outputPath);
  const runDirectory = dirname(outputPath);
  const lockPath = await acquireManualRetryLock(runDirectory);
  try {
    const run = JSON.parse(await readFile(outputPath, "utf8")) as ManualRetryRunState;
    for (const [label, actual, expected] of [
      ["candidateFingerprint", run.candidateFingerprint, input.expected.candidateFingerprint],
      ["datasetFingerprint", run.datasetFingerprint, input.expected.datasetFingerprint],
      [
        "sourceLineageFingerprint",
        run.sourceLineageFingerprint,
        input.expected.sourceLineageFingerprint
      ],
      ["requestSetFingerprint", run.requestSetFingerprint, input.expected.requestSetFingerprint],
      [
        "evaluationPolicyFingerprint",
        run.evaluationPolicyFingerprint,
        input.expected.evaluationPolicyFingerprint
      ],
      ["executionFingerprint", run.executionFingerprint, input.expected.executionFingerprint],
      ["runFingerprint", run.runFingerprint, input.expected.runFingerprint],
      [
        "authorizationId",
        run.authorization.authorizationId,
        input.expected.authorizationId
      ],
      [
        "authorizationDigest",
        run.authorization.authorizationDigest,
        input.expected.authorizationDigest
      ]
    ] as const) {
      if (actual !== expected) {
        throw new Error(`BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_MISMATCH:${label}`);
      }
    }
    if (!run.completedAt) {
      throw new Error("BOARD7B_WORKING_TASK_V1_BASE_RUN_NOT_COMPLETED");
    }
    if (!run.authorization.consumptionRecordPath) {
      throw new Error("BOARD7B_WORKING_TASK_V1_AUTHORIZATION_NOT_CONSUMED");
    }
    const consumption = JSON.parse(
      await readFile(run.authorization.consumptionRecordPath, "utf8")
    ) as { authorizationId?: string; runFingerprint?: string };
    if (
      consumption.authorizationId !== input.expected.authorizationId ||
      consumption.runFingerprint !== input.expected.runFingerprint
    ) {
      throw new Error(
        "BOARD7B_WORKING_TASK_V1_AUTHORIZATION_CONSUMPTION_MISMATCH"
      );
    }
    const retries = run.manualTechnicalRetries ?? [];
    if (retries.some((retry) => retry.status === "in_flight")) {
      throw new Error("BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_IN_FLIGHT");
    }
    if (retries.length >= run.authorization.manualTechnicalRetryBudget) {
      throw new Error("BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_BUDGET_EXHAUSTED");
    }
    const baseRecord = run.calls.find(
      (call) => call.caseId === input.regressionCase.caseId
    );
    if (!baseRecord) {
      throw new Error("BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_CASE_NOT_FOUND");
    }
    const caseRetries = retries.filter(
      (retry) => retry.caseId === input.regressionCase.caseId
    );
    const latestRecord = caseRetries.at(-1)?.record ?? baseRecord;
    if (latestRecord.status !== "technical_failure") {
      throw new Error(
        "BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_REQUIRES_TECHNICAL_FAILURE"
      );
    }
    if (
      baseRecord.requestHash !== input.regressionCase.requestHash ||
      latestRecord.requestHash !== input.regressionCase.requestHash
    ) {
      throw new Error("BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_REQUEST_MISMATCH");
    }
    const retryNumber = retries.length + 1;
    const claimedAt = new Date().toISOString();
    const consumptionRecordPath = resolve(
      runDirectory,
      "manual-retry-consumption",
      `${String(retryNumber).padStart(2, "0")}.json`
    );
    await writeJsonExclusive(consumptionRecordPath, {
      retryNumber,
      caseId: input.regressionCase.caseId,
      requestHash: input.regressionCase.requestHash,
      runFingerprint: input.expected.runFingerprint,
      authorizationId: input.expected.authorizationId,
      authorizationDigest: input.expected.authorizationDigest,
      claimedAt
    });
    const attempt: NonNullable<
      ManualRetryRunState["manualTechnicalRetries"]
    >[number] = {
      retryNumber,
      caseId: input.regressionCase.caseId,
      requestHash: input.regressionCase.requestHash,
      claimedAt,
      completedAt: null,
      status: "in_flight",
      consumptionRecordPath,
      record: null
    };
    retries.push(attempt);
    run.manualTechnicalRetries = retries;
    await writeJsonAtomic(outputPath, run);

    const record = await executeBoard7bWorkingTaskV1RegressionCase({
      regressionCase: input.regressionCase,
      provider: input.provider,
      systemPrompt: input.systemPrompt
    });
    await writeJsonExclusive(
      resolve(
        runDirectory,
        "manual-retries",
        `${String(retryNumber).padStart(2, "0")}-${input.regressionCase.caseId}.json`
      ),
      record
    );
    attempt.completedAt = record.completedAt;
    attempt.status = record.status;
    attempt.record = record;
    await writeJsonAtomic(outputPath, run);
    return { retryNumber, record, consumptionRecordPath };
  } finally {
    await unlink(lockPath).catch(() => undefined);
  }
}

export async function retryBoard7bWorkingTaskV1TechnicalFailure(caseId: string) {
  const workspaceRoot = process.cwd();
  const inspected = await inspectBoard7bWorkingTaskV1Regression(workspaceRoot, {
    verifyRecordedFingerprints: true
  });
  const packagePath = resolve(
    workspaceRoot,
    BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY
  );
  const authorization = await readApprovedAuthorization(packagePath);
  assertBoard7bWorkingTaskV1IsolatedEnvironment();
  if (
    authorization.candidateFingerprint !== inspected.candidateFingerprint ||
    authorization.datasetFingerprint !== inspected.dataset.datasetFingerprint ||
    authorization.sourceLineageFingerprint !==
      inspected.sourceLineageFingerprint ||
    authorization.requestSetFingerprint !== inspected.requestSetFingerprint ||
    authorization.evaluationPolicyFingerprint !==
      inspected.evaluationPolicyFingerprint ||
    authorization.executionFingerprint !== inspected.executionFingerprint
  ) {
    throw new Error("BOARD7B_WORKING_TASK_V1_AUTHORIZATION_FINGERPRINT_MISMATCH");
  }
  const regressionCase = inspected.cases.find((item) => item.caseId === caseId);
  if (!regressionCase) {
    throw new Error("BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_CASE_NOT_FOUND");
  }
  const runFingerprint = createBoard7bWorkingTaskV1RunFingerprint({
    candidateFingerprint: inspected.candidateFingerprint,
    datasetFingerprint: inspected.dataset.datasetFingerprint,
    sourceLineageFingerprint: inspected.sourceLineageFingerprint,
    requestSetFingerprint: inspected.requestSetFingerprint,
    evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
    executionFingerprint: inspected.executionFingerprint,
    authorizationId: authorization.authorizationId,
    authorizationDigest: authorization.authorizationDigest,
    approvedAt: authorization.approvedAt,
    baseCallBudget: authorization.authorizedModelCallBudget,
    manualTechnicalRetryBudget: authorization.manualTechnicalRetryBudget
  });
  const outputPath = resolve(
    workspaceRoot,
    LOCAL_RUNTIME_DIRECTORY,
    `regression-${runFingerprint}`,
    "raw-results.json"
  );
  const credential = await resolveBoard7bWorkingTaskV1Credential();
  await validateBoard7bWorkingTaskV1Credential(credential.apiKey);
  const provider = await createBoard7bWorkingTaskV1Provider(credential.apiKey);
  return executeBoard7bWorkingTaskV1ManualTechnicalRetry({
    workspaceRoot,
    outputPath,
    regressionCase,
    provider,
    systemPrompt: inspected.assets.systemPrompt,
    expected: {
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
      sourceLineageFingerprint: inspected.sourceLineageFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
      executionFingerprint: inspected.executionFingerprint,
      runFingerprint,
      authorizationId: authorization.authorizationId,
      authorizationDigest: authorization.authorizationDigest
    }
  });
}
