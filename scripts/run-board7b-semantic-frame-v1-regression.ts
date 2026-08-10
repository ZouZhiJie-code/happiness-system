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
  BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION,
  BOARD7B_SEMANTIC_FRAME_V1_EVALUATION_ID,
  BOARD7B_SEMANTIC_FRAME_V1_PACKAGE_DIRECTORY,
  BOARD7B_SEMANTIC_FRAME_V1_RUNNER_VERSION,
  BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG,
  applyBoard7bSemanticFrameV1Result,
  createBoard7bSemanticFrameV1CandidateFingerprint,
  createBoard7bSemanticFrameV1ModelInput,
  createBoard7bSemanticFrameV1UserPrompt,
  loadBoard7bSemanticFrameV1Assets,
  loadBoard7bSemanticFrameV1RegressionDataset,
  parseBoard7bSemanticFrameV1Output,
  validateBoard7bSemanticFrameV1Output,
  type Board7bSemanticFrameV1Output,
  type Board7bSemanticFrameV1SemanticState,
  type Board7bSemanticFrameV1TurnInput
} from "../evals/event-centered-generative/board7b-semantic-frame-v1/board7b-semantic-frame-v1";
import type {
  AICompletionResult,
  AIProvider
} from "../src/server/services/ai/ai-provider";
import { getAIProviderFailureCode } from "../src/server/services/ai/ai-provider";
import { getEventCenteredAIProvider } from "../src/server/services/ai/event-centered-provider";

const AUTHORIZATION_TEMPLATE_FILE =
  "board7b-semantic-frame-v1-authorization-template.json";
const APPROVED_AUTHORIZATION_FILE =
  "board7b-semantic-frame-v1-regression-authorization.json";
const REGRESSION_PLAN_FILE = "board7b-semantic-frame-v1-regression-plan.json";
const MANIFEST_FILE = "board7b-semantic-frame-v1-manifest.json";
const RUBRIC_FILE = "board7b-semantic-frame-v1-regression-rubric.md";
const SEALED_RESULT_FILE = "board7b-semantic-frame-v1-regression-result.json";
const LOCAL_RUNTIME_DIRECTORY =
  "artifacts/local-runtime/generative-interview-board7/2026-08-07-board7b-semantic-frame-v1";
const AUTHORIZATION_CONSUMPTION_DIRECTORY = `${LOCAL_RUNTIME_DIRECTORY}/authorization-consumption`;

const EXECUTION_SOURCE_PATHS = [
  "evals/event-centered-generative/board7b-semantic-frame-v1/board7b-semantic-frame-v1.ts",
  "scripts/execute-board7b-semantic-frame-v1-regression.ts",
  "scripts/run-board7b-semantic-frame-v1-regression.ts",
  "src/features/interview/event-centered-release.ts",
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
      "2026-08-07.board7b-semantic-frame-authorization-v1"
    ),
    decision: z.literal("pending"),
    candidateVersion: z.literal(BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION),
    candidateFingerprint: fingerprintSchema,
    datasetFingerprint: fingerprintSchema,
    requestSetFingerprint: fingerprintSchema,
    evaluationPolicyFingerprint: fingerprintSchema,
    executionFingerprint: fingerprintSchema,
    runnerVersion: z.literal(BOARD7B_SEMANTIC_FRAME_V1_RUNNER_VERSION),
    authorizationId: z.null(),
    authorizationScope: z.literal("eight_case_semantic_frame_regression"),
    plannedModelCallBudget: z.literal(8),
    authorizedModelCallBudget: z.literal(0),
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
      "2026-08-07.board7b-semantic-frame-authorization-v1"
    ),
    decision: z.literal("approved"),
    candidateVersion: z.literal(BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION),
    candidateFingerprint: fingerprintSchema,
    datasetFingerprint: fingerprintSchema,
    requestSetFingerprint: fingerprintSchema,
    evaluationPolicyFingerprint: fingerprintSchema,
    executionFingerprint: fingerprintSchema,
    runnerVersion: z.literal(BOARD7B_SEMANTIC_FRAME_V1_RUNNER_VERSION),
    authorizationId: z.string().uuid(),
    authorizationScope: z.literal("eight_case_semantic_frame_regression"),
    plannedModelCallBudget: z.literal(8),
    authorizedModelCallBudget: z.literal(8),
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
    planVersion: z.literal(
      "2026-08-07.board7b-semantic-frame-regression-v1"
    ),
    candidateVersion: z.literal(BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION),
    candidateFingerprint: fingerprintSchema,
    datasetVersion: z.literal(
      "2026-08-07.board7b-semantic-frame-regression-inputs-v1"
    ),
    datasetFingerprint: fingerprintSchema,
    requestSetFingerprint: fingerprintSchema,
    evaluationPolicyFingerprint: fingerprintSchema,
    executionFingerprint: fingerprintSchema,
    runnerVersion: z.literal(BOARD7B_SEMANTIC_FRAME_V1_RUNNER_VERSION),
    plannedCalls: z.literal(8),
    authorizedCalls: z.literal(0),
    distribution: z
      .object({
        knownDevelopmentRegression: z.literal(2),
        freshRelationshipTransfer: z.literal(4),
        counterfactual: z.literal(2)
      })
      .strict(),
    passCriteria: z
      .object({
        knownDevelopmentRegression: z.literal("2/2"),
        freshRelationshipTransfer: z.literal("4/4"),
        counterfactual: z.literal("2/2"),
        validStructureAndSource: z.literal("8/8"),
        ordinaryQualityFailures: z.literal(0),
        singleCaseBlocks: z.literal(0)
      })
      .strict(),
    qualityRetries: z.literal(0),
    automaticTechnicalRetries: z.literal(0),
    realTrajectoryAfterPass: z.literal("requires_separate_authorization")
  })
  .strict();

const manifestFingerprintSchema = z
  .object({
    candidateFingerprint: fingerprintSchema,
    regression: z
      .object({
        datasetFingerprint: fingerprintSchema,
        requestSetFingerprint: fingerprintSchema,
        evaluationPolicyFingerprint: fingerprintSchema,
        executionFingerprint: fingerprintSchema,
        plannedCalls: z.literal(8),
        authorizedCalls: z.literal(0),
        modelCalls: z.literal(0)
      })
      .passthrough()
  })
  .passthrough();

const sealedResultFingerprintSchema = z
  .object({
    resultVersion: z.literal(
      "2026-08-07.board7b-semantic-frame-regression-result-v1"
    ),
    candidateVersion: z.literal(BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION),
    candidateFingerprint: fingerprintSchema,
    datasetFingerprint: fingerprintSchema,
    requestSetFingerprint: fingerprintSchema,
    evaluationPolicyFingerprint: fingerprintSchema,
    executionFingerprint: fingerprintSchema,
    execution: z
      .object({
        attemptedCalls: z.literal(8),
        modelCalls: z.literal(8)
      })
      .passthrough()
  })
  .passthrough();

export type Board7bSemanticFrameV1RegressionCase = {
  callNumber: number;
  caseId: string;
  turnInput: Board7bSemanticFrameV1TurnInput;
  modelInput: ReturnType<typeof createBoard7bSemanticFrameV1ModelInput>;
  userPrompt: string;
  requestHash: string;
};

export type Board7bSemanticFrameV1RegressionCallRecord = {
  callNumber: number;
  caseId: string;
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
  modelInput: ReturnType<typeof createBoard7bSemanticFrameV1ModelInput>;
  rawOutput: string | null;
  output: Board7bSemanticFrameV1Output | null;
  validationIssues: string[];
  semanticStateAfter: Board7bSemanticFrameV1SemanticState | null;
  errorCode: string | null;
};

export function createBoard7bSemanticFrameV1AuthorizationDigest(
  authorization: Omit<
    z.infer<typeof approvedAuthorizationSchema>,
    "authorizationDigest"
  >
) {
  return sha256(
    JSON.stringify({
      template: authorization.template,
      authorizationVersion: authorization.authorizationVersion,
      decision: authorization.decision,
      candidateVersion: authorization.candidateVersion,
      candidateFingerprint: authorization.candidateFingerprint,
      datasetFingerprint: authorization.datasetFingerprint,
      requestSetFingerprint: authorization.requestSetFingerprint,
      evaluationPolicyFingerprint:
        authorization.evaluationPolicyFingerprint,
      executionFingerprint: authorization.executionFingerprint,
      runnerVersion: authorization.runnerVersion,
      authorizationId: authorization.authorizationId,
      authorizationScope: authorization.authorizationScope,
      plannedModelCallBudget: authorization.plannedModelCallBudget,
      authorizedModelCallBudget: authorization.authorizedModelCallBudget,
      authorizedEnvironment: authorization.authorizedEnvironment,
      approvedBy: authorization.approvedBy,
      approvedAt: authorization.approvedAt,
      productionChangeAuthorized: authorization.productionChangeAuthorized,
      confirmationText: authorization.confirmationText
    })
  );
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
        new Error("BOARD7B_SEMANTIC_FRAME_V1_RUN_OUTPUT_ALREADY_EXISTS"),
        { code: "BOARD7B_SEMANTIC_FRAME_V1_RUN_OUTPUT_ALREADY_EXISTS" }
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

export async function resolveBoard7bSemanticFrameV1Credential() {
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

export async function validateBoard7bSemanticFrameV1Credential(apiKey: string) {
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
      (model) => model.id === BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG.model
    )
  ) {
    throw Object.assign(new Error("DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE"), {
      code: "DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE"
    });
  }
}

export async function createBoard7bSemanticFrameV1Provider(apiKey: string) {
  const provider = await getEventCenteredAIProvider({
    env: {
      NODE_ENV: "development",
      AI_PROVIDER: "openai",
      DEEPSEEK_API_KEY: apiKey,
      DEEPSEEK_MODEL: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG.model,
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      EVENT_CENTERED_GENERATIVE_MODEL:
        BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG.model
    }
  });
  if (!provider) {
    throw new Error("BOARD7B_SEMANTIC_FRAME_V1_PROVIDER_UNAVAILABLE");
  }
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

export async function createBoard7bSemanticFrameV1ExecutionFingerprint(input: {
  workspaceRoot?: string;
  candidateFingerprint: string;
  datasetFingerprint: string;
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
      requestSetFingerprint: input.requestSetFingerprint,
      evaluationPolicyFingerprint: input.evaluationPolicyFingerprint,
      runnerVersion: BOARD7B_SEMANTIC_FRAME_V1_RUNNER_VERSION,
      runtimeConfig: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG,
      runtimeEnvironment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        entryCommand: "npm run eval:board7b-semantic-frame:run"
      },
      sources
    })
  );
}

export async function claimBoard7bSemanticFrameV1Authorization(input: {
  workspaceRoot?: string;
  authorizationId: string;
  candidateFingerprint: string;
  datasetFingerprint: string;
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
        new Error("BOARD7B_SEMANTIC_FRAME_V1_AUTHORIZATION_ALREADY_CONSUMED"),
        { code: "BOARD7B_SEMANTIC_FRAME_V1_AUTHORIZATION_ALREADY_CONSUMED" }
      );
    }
    throw error;
  }
  const record = {
    authorizationId: input.authorizationId,
    candidateFingerprint: input.candidateFingerprint,
    datasetFingerprint: input.datasetFingerprint,
    requestSetFingerprint: input.requestSetFingerprint,
    executionFingerprint: input.executionFingerprint,
    authorizationDigest: input.authorizationDigest,
    runFingerprint: input.runFingerprint,
    callBudget: input.callBudget,
    claimedAt: input.claimedAt ?? new Date().toISOString(),
    scope: "eight_case_semantic_frame_regression"
  } as const;
  try {
    await file.writeFile(`${JSON.stringify(record, null, 2)}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  return { path, record };
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

export async function inspectBoard7bSemanticFrameV1Regression(
  workspaceRoot = process.cwd()
) {
  const packagePath = resolve(
    workspaceRoot,
    BOARD7B_SEMANTIC_FRAME_V1_PACKAGE_DIRECTORY
  );
  const [
    assets,
    dataset,
    planSource,
    templateSource,
    manifestSource,
    rubricSource
  ] = await Promise.all([
    loadBoard7bSemanticFrameV1Assets(workspaceRoot),
    loadBoard7bSemanticFrameV1RegressionDataset(workspaceRoot),
    readFile(resolve(packagePath, REGRESSION_PLAN_FILE), "utf8"),
    readFile(resolve(packagePath, AUTHORIZATION_TEMPLATE_FILE), "utf8"),
    readFile(resolve(packagePath, MANIFEST_FILE), "utf8"),
    readFile(resolve(packagePath, RUBRIC_FILE), "utf8")
  ]);
  const candidateFingerprint =
    createBoard7bSemanticFrameV1CandidateFingerprint(assets);
  const cases = dataset.cases.map((item, index) => {
    const modelInput = createBoard7bSemanticFrameV1ModelInput(item.turnInput);
    const userPrompt = createBoard7bSemanticFrameV1UserPrompt(item.turnInput);
    const requestHash = sha256(
      JSON.stringify({
        systemPrompt: assets.systemPrompt,
        userPrompt,
        runtimeConfig: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG
      })
    );
    return {
      callNumber: index + 1,
      caseId: item.caseId,
      turnInput: item.turnInput,
      modelInput,
      userPrompt,
      requestHash
    } satisfies Board7bSemanticFrameV1RegressionCase;
  });
  const requestSetFingerprint = sha256(
    JSON.stringify(
      cases.map((item) => ({
        callNumber: item.callNumber,
        caseId: item.caseId,
        requestHash: item.requestHash
      }))
    )
  );
  const evaluationPolicyFingerprint = sha256(rubricSource.trim());
  const executionFingerprintInput = {
      workspaceRoot,
      candidateFingerprint,
      datasetFingerprint: dataset.datasetFingerprint,
      requestSetFingerprint,
      evaluationPolicyFingerprint
    };
  let sealedResult: z.infer<typeof sealedResultFingerprintSchema> | null = null;
  try {
    sealedResult = sealedResultFingerprintSchema.parse(
      JSON.parse(
        await readFile(resolve(packagePath, SEALED_RESULT_FILE), "utf8")
      ) as unknown
    );
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
  if (
    sealedResult &&
    (sealedResult.candidateFingerprint !== candidateFingerprint ||
      sealedResult.datasetFingerprint !== dataset.datasetFingerprint ||
      sealedResult.requestSetFingerprint !== requestSetFingerprint ||
      sealedResult.evaluationPolicyFingerprint !== evaluationPolicyFingerprint)
  ) {
    throw new Error(
      "BOARD7B_SEMANTIC_FRAME_V1_SEALED_RESULT_FINGERPRINT_MISMATCH"
    );
  }
  const executionFingerprint = sealedResult
    ? sealedResult.executionFingerprint
    : await createBoard7bSemanticFrameV1ExecutionFingerprint(
        executionFingerprintInput
      );
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
      requestSetFingerprint: manifest.regression.requestSetFingerprint,
      evaluationPolicyFingerprint:
        manifest.regression.evaluationPolicyFingerprint,
      executionFingerprint: manifest.regression.executionFingerprint
    }
  ];
  for (const source of fingerprintSources) {
    if (source.candidateFingerprint !== candidateFingerprint) {
      throw new Error("BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_FINGERPRINT_MISMATCH");
    }
    if (source.datasetFingerprint !== dataset.datasetFingerprint) {
      throw new Error("BOARD7B_SEMANTIC_FRAME_V1_DATASET_FINGERPRINT_MISMATCH");
    }
    if (source.requestSetFingerprint !== requestSetFingerprint) {
      throw new Error("BOARD7B_SEMANTIC_FRAME_V1_REQUEST_SET_FINGERPRINT_MISMATCH");
    }
    if (source.evaluationPolicyFingerprint !== evaluationPolicyFingerprint) {
      throw new Error(
        "BOARD7B_SEMANTIC_FRAME_V1_EVALUATION_POLICY_FINGERPRINT_MISMATCH"
      );
    }
    if (source.executionFingerprint !== executionFingerprint) {
      throw new Error("BOARD7B_SEMANTIC_FRAME_V1_EXECUTION_FINGERPRINT_MISMATCH");
    }
  }
  if (
    dataset.cases.length !== plan.plannedCalls ||
    dataset.cases.length !== template.plannedModelCallBudget
  ) {
    throw new Error("BOARD7B_SEMANTIC_FRAME_V1_CALL_BUDGET_MISMATCH");
  }
  return {
    assets,
    dataset,
    plan,
    template,
    manifest,
    candidateFingerprint,
    requestSetFingerprint,
    evaluationPolicyFingerprint,
    executionFingerprint,
    cases
  };
}

export async function executeBoard7bSemanticFrameV1RegressionCase(input: {
  regressionCase: Board7bSemanticFrameV1RegressionCase;
  provider: AIProvider;
  systemPrompt: string;
}): Promise<Board7bSemanticFrameV1RegressionCallRecord> {
  const startedAt = new Date().toISOString();
  const { modelInput, userPrompt, requestHash } = input.regressionCase;
  const recomputedRequestHash = sha256(
    JSON.stringify({
      systemPrompt: input.systemPrompt,
      userPrompt,
      runtimeConfig: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG
    })
  );
  if (recomputedRequestHash !== requestHash) {
    throw new Error("BOARD7B_SEMANTIC_FRAME_V1_PREPARED_REQUEST_MISMATCH");
  }
  let completion: AICompletionResult | null = null;
  try {
    completion = await input.provider.complete({
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG.temperature,
      maxTokens: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG.maxTokens,
      timeoutMs: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG.timeoutMs,
      responseFormat: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG.responseFormat,
      thinking: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG.thinking
    });
    const output = parseBoard7bSemanticFrameV1Output(completion.content);
    const validationIssues = validateBoard7bSemanticFrameV1Output({
      input: input.regressionCase.turnInput,
      output
    });
    const semanticStateAfter = validationIssues.length
      ? null
      : applyBoard7bSemanticFrameV1Result({
          input: input.regressionCase.turnInput,
          output
        });
    return {
      callNumber: input.regressionCase.callNumber,
      caseId: input.regressionCase.caseId,
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
      errorCode: validationIssues.length ? "PROGRAM_PROTECTION_REJECTED" : null
    };
  } catch (error) {
    const errorCode = regressionErrorCode(error);
    const modelContractFailure =
      completion !== null &&
      (errorCode === "INVALID_JSON" || errorCode === "INVALID_JSON_SCHEMA");
    return {
      callNumber: input.regressionCase.callNumber,
      caseId: input.regressionCase.caseId,
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
    source = await readFile(resolve(packagePath, APPROVED_AUTHORIZATION_FILE), "utf8");
  } catch {
    throw Object.assign(
      new Error("BOARD7B_SEMANTIC_FRAME_V1_AUTHORIZATION_FILE_MISSING"),
      { code: "BOARD7B_SEMANTIC_FRAME_V1_AUTHORIZATION_FILE_MISSING" }
    );
  }
  const authorization = approvedAuthorizationSchema.parse(
    JSON.parse(source) as unknown
  );
  const { authorizationDigest, ...unsignedAuthorization } = authorization;
  if (
    authorizationDigest !==
    createBoard7bSemanticFrameV1AuthorizationDigest(unsignedAuthorization)
  ) {
    throw new Error("BOARD7B_SEMANTIC_FRAME_V1_AUTHORIZATION_DIGEST_MISMATCH");
  }
  return authorization;
}

function assertBoard7bSemanticFrameV1IsolatedEnvironment() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("BOARD7B_SEMANTIC_FRAME_V1_PRODUCTION_ENVIRONMENT_REJECTED");
  }
}

async function preflightBoard7bSemanticFrameV1LocalWrite(
  workspaceRoot: string
) {
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

export async function runBoard7bSemanticFrameV1Regression() {
  const workspaceRoot = process.cwd();
  const inspected = await inspectBoard7bSemanticFrameV1Regression(workspaceRoot);
  const packagePath = resolve(
    workspaceRoot,
    BOARD7B_SEMANTIC_FRAME_V1_PACKAGE_DIRECTORY
  );
  const authorization = await readApprovedAuthorization(packagePath);
  assertBoard7bSemanticFrameV1IsolatedEnvironment();
  if (
    authorization.candidateFingerprint !== inspected.candidateFingerprint ||
    authorization.datasetFingerprint !== inspected.dataset.datasetFingerprint ||
    authorization.requestSetFingerprint !== inspected.requestSetFingerprint ||
    authorization.evaluationPolicyFingerprint !==
      inspected.evaluationPolicyFingerprint ||
    authorization.executionFingerprint !== inspected.executionFingerprint
  ) {
    throw new Error("BOARD7B_SEMANTIC_FRAME_V1_AUTHORIZATION_FINGERPRINT_MISMATCH");
  }
  if (authorization.authorizedModelCallBudget !== inspected.cases.length) {
    throw new Error("BOARD7B_SEMANTIC_FRAME_V1_AUTHORIZED_BUDGET_MISMATCH");
  }
  const runFingerprint = sha256(
    JSON.stringify({
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
      executionFingerprint: inspected.executionFingerprint,
      runnerVersion: BOARD7B_SEMANTIC_FRAME_V1_RUNNER_VERSION,
      authorizationId: authorization.authorizationId,
      authorizationVersion: authorization.authorizationVersion,
      authorizationDigest: authorization.authorizationDigest,
      approvedAt: authorization.approvedAt,
      callBudget: authorization.authorizedModelCallBudget
    })
  );
  const outputPath = resolve(
    workspaceRoot,
    LOCAL_RUNTIME_DIRECTORY,
    `regression-${runFingerprint}`,
    "raw-results.json"
  );
  const run = {
    evaluationId: `${BOARD7B_SEMANTIC_FRAME_V1_EVALUATION_ID}_regression`,
    candidateVersion: BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION,
    candidateFingerprint: inspected.candidateFingerprint,
    datasetVersion: inspected.dataset.datasetVersion,
    datasetFingerprint: inspected.dataset.datasetFingerprint,
    requestSetFingerprint: inspected.requestSetFingerprint,
    evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
    executionFingerprint: inspected.executionFingerprint,
    runnerVersion: BOARD7B_SEMANTIC_FRAME_V1_RUNNER_VERSION,
    runFingerprint,
    authorization: {
      version: authorization.authorizationVersion,
      authorizationId: authorization.authorizationId,
      authorizationDigest: authorization.authorizationDigest,
      scope: authorization.authorizationScope,
      approvedBy: authorization.approvedBy,
      approvedAt: authorization.approvedAt,
      callBudget: authorization.authorizedModelCallBudget,
      consumptionRecordPath: null as string | null
    },
    runtimeConfig: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG,
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
      status: "in_flight" | Board7bSemanticFrameV1RegressionCallRecord["status"];
    }>,
    calls: [] as Board7bSemanticFrameV1RegressionCallRecord[]
  };

  const credential = await resolveBoard7bSemanticFrameV1Credential();
  await validateBoard7bSemanticFrameV1Credential(credential.apiKey);
  const provider = await createBoard7bSemanticFrameV1Provider(credential.apiKey);
  await preflightBoard7bSemanticFrameV1LocalWrite(workspaceRoot);
  const authorizationClaim =
    await claimBoard7bSemanticFrameV1Authorization({
      workspaceRoot,
      authorizationId: authorization.authorizationId,
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
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
    const record = await executeBoard7bSemanticFrameV1RegressionCase({
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
      `调用 ${record.callNumber}/8｜${record.caseId}｜${record.status}\n`
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
        ).length
      },
      null,
      2
    )}\n`
  );
}
