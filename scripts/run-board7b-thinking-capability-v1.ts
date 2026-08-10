import { createHash } from "node:crypto";
import {
  mkdir,
  open as openFile,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { z } from "zod";

import {
  BOARD7B_THINKING_CAPABILITY_V1_CANDIDATE_VERSION,
  BOARD7B_THINKING_CAPABILITY_V1_DATASET_VERSION,
  BOARD7B_THINKING_CAPABILITY_V1_DECISION_ID,
  BOARD7B_THINKING_CAPABILITY_V1_EVALUATION_ID,
  BOARD7B_THINKING_CAPABILITY_V1_PACKAGE_DIRECTORY,
  BOARD7B_THINKING_CAPABILITY_V1_RUNNER_VERSION,
  loadBoard7bThinkingCapabilityV1Prepared,
  type Board7bThinkingCapabilityV1PreparedCall
} from "../evals/event-centered-generative/board7b-thinking-capability-v1/board7b-thinking-capability-v1";
import {
  applyBoard7bSemanticFrameV1Result,
  parseBoard7bSemanticFrameV1Output,
  validateBoard7bSemanticFrameV1Output,
  type Board7bSemanticFrameV1Output,
  type Board7bSemanticFrameV1SemanticState
} from "../evals/event-centered-generative/board7b-semantic-frame-v1/board7b-semantic-frame-v1";
import type {
  AICompletionResult,
  AIProvider
} from "../src/server/services/ai/ai-provider";
import { getAIProviderFailureCode } from "../src/server/services/ai/ai-provider";
import {
  createBoard7bSemanticFrameV1Provider,
  resolveBoard7bSemanticFrameV1Credential,
  validateBoard7bSemanticFrameV1Credential
} from "./run-board7b-semantic-frame-v1-regression";

const MANIFEST_FILE = "board7b-thinking-capability-v1-manifest.json";
const RUN_PLAN_FILE = "board7b-thinking-capability-v1-run-plan.json";
const RUBRIC_FILE = "board7b-thinking-capability-v1-rubric.md";
const AUTHORIZATION_TEMPLATE_FILE =
  "board7b-thinking-capability-v1-authorization-template.json";
const APPROVED_AUTHORIZATION_FILE =
  "board7b-thinking-capability-v1-authorization.json";
const RESULT_FILE = "board7b-thinking-capability-v1-result.json";
const TRANSPARENT_REVIEW_FILE =
  "board7b-thinking-capability-v1-transparent-review.md";
const LOCAL_RUNTIME_DIRECTORY =
  "artifacts/local-runtime/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1";
const AUTHORIZATION_CONSUMPTION_DIRECTORY = `${LOCAL_RUNTIME_DIRECTORY}/authorization-consumption`;
const CONFIRMATION_TEXT =
  "我已核对 GI-086 候选、数据、八次请求、评测口径与执行指纹；授权该指纹执行 8 次 DeepSeek 隔离调用。";

const EXECUTION_SOURCE_PATHS = [
  "evals/event-centered-generative/board7b-thinking-capability-v1/board7b-thinking-capability-v1.ts",
  "evals/event-centered-generative/board7b-semantic-frame-v1/board7b-semantic-frame-v1.ts",
  "scripts/execute-board7b-thinking-capability-v1.ts",
  "scripts/inspect-board7b-thinking-capability-v1.ts",
  "scripts/run-board7b-thinking-capability-v1.ts",
  "scripts/run-board7b-semantic-frame-v1-regression.ts",
  "src/server/services/ai/ai-provider.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/ai/event-centered-provider.ts",
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

const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const fingerprintFields = {
  candidateFingerprint: fingerprintSchema,
  sourceCandidateFingerprint: fingerprintSchema,
  datasetFingerprint: fingerprintSchema,
  requestSetFingerprint: fingerprintSchema,
  evaluationPolicyFingerprint: fingerprintSchema,
  executionFingerprint: fingerprintSchema
} as const;

const runPlanSchema = z
  .object({
    planVersion: z.literal("2026-08-07.board7b-thinking-capability-run-v1"),
    decisionId: z.literal(BOARD7B_THINKING_CAPABILITY_V1_DECISION_ID),
    candidateVersion: z.literal(
      BOARD7B_THINKING_CAPABILITY_V1_CANDIDATE_VERSION
    ),
    runnerVersion: z.literal(BOARD7B_THINKING_CAPABILITY_V1_RUNNER_VERSION),
    sourceCandidateVersion: z.literal(
      "2026-08-07.board7b-semantic-frame-v1"
    ),
    ...fingerprintFields,
    datasetVersion: z.literal(BOARD7B_THINKING_CAPABILITY_V1_DATASET_VERSION),
    plannedCalls: z.literal(8),
    authorizedCalls: z.literal(0),
    pairs: z.literal(4),
    problemProbes: z.literal(2),
    guardControls: z.literal(2),
    qualityRetries: z.literal(0),
    automaticTechnicalRetries: z.literal(0),
    reviewMode: z.literal("fully_transparent"),
    nextStepAfterPass: z.literal("stability_validation_requires_new_plan"),
    realTrajectory: z.literal("remains_closed")
  })
  .strict();

const authorizationTemplateSchema = z
  .object({
    template: z.literal(true),
    authorizationVersion: z.literal(
      "2026-08-07.board7b-thinking-capability-authorization-v1"
    ),
    decision: z.literal("pending"),
    candidateVersion: z.literal(
      BOARD7B_THINKING_CAPABILITY_V1_CANDIDATE_VERSION
    ),
    runnerVersion: z.literal(BOARD7B_THINKING_CAPABILITY_V1_RUNNER_VERSION),
    ...fingerprintFields,
    authorizationId: z.null(),
    authorizationScope: z.literal("eight_call_thinking_capability_probe"),
    plannedModelCallBudget: z.literal(8),
    authorizedModelCallBudget: z.literal(0),
    authorizedEnvironment: z.literal("isolated_local_evaluation"),
    approvedBy: z.null(),
    approvedAt: z.null(),
    productionChangeAuthorized: z.literal(false),
    confirmationText: z.literal(CONFIRMATION_TEXT)
  })
  .strict();

const approvedAuthorizationSchema = z
  .object({
    template: z.literal(false),
    authorizationVersion: z.literal(
      "2026-08-07.board7b-thinking-capability-authorization-v1"
    ),
    decision: z.literal("approved"),
    candidateVersion: z.literal(
      BOARD7B_THINKING_CAPABILITY_V1_CANDIDATE_VERSION
    ),
    runnerVersion: z.literal(BOARD7B_THINKING_CAPABILITY_V1_RUNNER_VERSION),
    ...fingerprintFields,
    authorizationId: z.string().uuid(),
    authorizationScope: z.literal("eight_call_thinking_capability_probe"),
    plannedModelCallBudget: z.literal(8),
    authorizedModelCallBudget: z.literal(8),
    authorizedEnvironment: z.literal("isolated_local_evaluation"),
    approvedBy: z.literal("product_owner_conversation"),
    approvedAt: z.string().datetime(),
    productionChangeAuthorized: z.literal(false),
    confirmationText: z.literal(CONFIRMATION_TEXT),
    authorizationDigest: fingerprintSchema
  })
  .strict();

const manifestSchema = z
  .object({
    decisionId: z.literal(BOARD7B_THINKING_CAPABILITY_V1_DECISION_ID),
    candidateVersion: z.literal(
      BOARD7B_THINKING_CAPABILITY_V1_CANDIDATE_VERSION
    ),
    status: z.literal("package_ready_waiting_authorization"),
    ...fingerprintFields,
    probe: z
      .object({
        plannedCalls: z.literal(8),
        authorizedCalls: z.literal(0),
        modelCalls: z.literal(0)
      })
      .passthrough(),
    production: z.literal("legacy + baseline")
  })
  .passthrough();

export type Board7bThinkingCapabilityV1CallRecord = {
  callNumber: number;
  pairId: string;
  sourceCaseId: string;
  role: "problem_probe" | "guard_control";
  arm: "thinking_disabled" | "thinking_high";
  runtimeConfig: Board7bThinkingCapabilityV1PreparedCall["runtimeConfig"];
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
  modelInput: Board7bThinkingCapabilityV1PreparedCall["modelInput"];
  rawOutput: string | null;
  output: Board7bSemanticFrameV1Output | null;
  validationIssues: string[];
  semanticStateAfter: Board7bSemanticFrameV1SemanticState | null;
  errorCode: string | null;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeJsonAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function writeExclusive(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  const file = await openFile(path, "wx");
  try {
    await file.writeFile(value, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
}

async function createExecutionFingerprint(input: {
  workspaceRoot: string;
  candidateFingerprint: string;
  datasetFingerprint: string;
  requestSetFingerprint: string;
  evaluationPolicyFingerprint: string;
}) {
  const sources = await Promise.all(
    EXECUTION_SOURCE_PATHS.map(async (path) => ({
      path,
      sha256: sha256(await readFile(resolve(input.workspaceRoot, path), "utf8"))
    }))
  );
  return sha256(
    JSON.stringify({
      candidateFingerprint: input.candidateFingerprint,
      datasetFingerprint: input.datasetFingerprint,
      requestSetFingerprint: input.requestSetFingerprint,
      evaluationPolicyFingerprint: input.evaluationPolicyFingerprint,
      runnerVersion: BOARD7B_THINKING_CAPABILITY_V1_RUNNER_VERSION,
      runtimeEnvironment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        entryCommand: "npm run eval:board7b-thinking-capability:run"
      },
      sources
    })
  );
}

export function createBoard7bThinkingCapabilityV1AuthorizationDigest(
  authorization: Omit<
    z.infer<typeof approvedAuthorizationSchema>,
    "authorizationDigest"
  >
) {
  return sha256(JSON.stringify(authorization));
}

export async function computeBoard7bThinkingCapabilityV1Fingerprints(
  workspaceRoot = process.cwd()
) {
  const packagePath = resolve(
    workspaceRoot,
    BOARD7B_THINKING_CAPABILITY_V1_PACKAGE_DIRECTORY
  );
  const prepared = await loadBoard7bThinkingCapabilityV1Prepared(workspaceRoot);
  const rubricSource = await readFile(resolve(packagePath, RUBRIC_FILE), "utf8");
  const evaluationPolicyFingerprint = sha256(rubricSource.trim());
  const executionFingerprint = await createExecutionFingerprint({
    workspaceRoot,
    candidateFingerprint: prepared.candidateFingerprint,
    datasetFingerprint: prepared.datasetFingerprint,
    requestSetFingerprint: prepared.requestSetFingerprint,
    evaluationPolicyFingerprint
  });
  return {
    packagePath,
    ...prepared,
    evaluationPolicyFingerprint,
    executionFingerprint
  };
}

function assertFingerprintFields(
  source: Record<string, unknown>,
  expected: Record<keyof typeof fingerprintFields, string>
) {
  for (const key of Object.keys(fingerprintFields) as Array<
    keyof typeof fingerprintFields
  >) {
    if (source[key] !== expected[key]) {
      throw new Error(
        `BOARD7B_THINKING_CAPABILITY_V1_${key
          .replace(/([A-Z])/gu, "_$1")
          .toUpperCase()}_MISMATCH`
      );
    }
  }
}

export async function inspectBoard7bThinkingCapabilityV1(
  workspaceRoot = process.cwd()
) {
  const packagePath = resolve(
    workspaceRoot,
    BOARD7B_THINKING_CAPABILITY_V1_PACKAGE_DIRECTORY
  );
  const prepared =
    await computeBoard7bThinkingCapabilityV1Fingerprints(workspaceRoot);
  const [planSource, templateSource, manifestSource] = await Promise.all([
    readFile(resolve(packagePath, RUN_PLAN_FILE), "utf8"),
    readFile(resolve(packagePath, AUTHORIZATION_TEMPLATE_FILE), "utf8"),
    readFile(resolve(packagePath, MANIFEST_FILE), "utf8")
  ]);
  const { evaluationPolicyFingerprint, executionFingerprint } = prepared;
  const fingerprints = {
    candidateFingerprint: prepared.candidateFingerprint,
    sourceCandidateFingerprint: prepared.sourceCandidateFingerprint,
    datasetFingerprint: prepared.datasetFingerprint,
    requestSetFingerprint: prepared.requestSetFingerprint,
    evaluationPolicyFingerprint,
    executionFingerprint
  };
  const plan = runPlanSchema.parse(JSON.parse(planSource) as unknown);
  const template = authorizationTemplateSchema.parse(
    JSON.parse(templateSource) as unknown
  );
  const manifest = manifestSchema.parse(JSON.parse(manifestSource) as unknown);
  assertFingerprintFields(plan, fingerprints);
  assertFingerprintFields(template, fingerprints);
  assertFingerprintFields(manifest, fingerprints);
  return {
    ...prepared,
    ...fingerprints,
    evaluationPolicyFingerprint,
    executionFingerprint,
    plan,
    template,
    manifest
  };
}

function executionErrorCode(error: unknown) {
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

export async function executeBoard7bThinkingCapabilityV1Call(input: {
  preparedCall: Board7bThinkingCapabilityV1PreparedCall;
  provider: AIProvider;
  systemPrompt: string;
}): Promise<Board7bThinkingCapabilityV1CallRecord> {
  const { preparedCall } = input;
  const startedAt = new Date().toISOString();
  const recomputedRequestHash = sha256(
    JSON.stringify({
      systemPrompt: input.systemPrompt,
      userPrompt: preparedCall.userPrompt,
      runtimeConfig: preparedCall.runtimeConfig
    })
  );
  if (recomputedRequestHash !== preparedCall.requestHash) {
    throw new Error("BOARD7B_THINKING_CAPABILITY_V1_REQUEST_MISMATCH");
  }
  let completion: AICompletionResult | null = null;
  try {
    completion = await input.provider.complete({
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: preparedCall.userPrompt }
      ],
      temperature: preparedCall.runtimeConfig.temperature,
      maxTokens: preparedCall.runtimeConfig.maxTokens,
      timeoutMs: preparedCall.runtimeConfig.timeoutMs,
      responseFormat: preparedCall.runtimeConfig.responseFormat,
      thinking: preparedCall.runtimeConfig.thinking,
      reasoningEffort:
        preparedCall.runtimeConfig.reasoningEffort ?? undefined
    });
    const output = parseBoard7bSemanticFrameV1Output(completion.content);
    const validationIssues = validateBoard7bSemanticFrameV1Output({
      input: preparedCall.turnInput,
      output
    });
    const semanticStateAfter = validationIssues.length
      ? null
      : applyBoard7bSemanticFrameV1Result({
          input: preparedCall.turnInput,
          output
        });
    return {
      callNumber: preparedCall.callNumber,
      pairId: preparedCall.pairId,
      sourceCaseId: preparedCall.sourceCaseId,
      role: preparedCall.role,
      arm: preparedCall.arm,
      runtimeConfig: preparedCall.runtimeConfig,
      startedAt,
      completedAt: new Date().toISOString(),
      status: validationIssues.length ? "protected_failure" : "valid",
      requestHash: preparedCall.requestHash,
      responseHash: sha256(completion.content),
      provider: completion.provider,
      latencyMs: completion.latencyMs,
      tokenUsage: completion.tokenUsage ?? null,
      modelInput: preparedCall.modelInput,
      rawOutput: completion.content,
      output,
      validationIssues,
      semanticStateAfter,
      errorCode: validationIssues.length
        ? "PROGRAM_PROTECTION_REJECTED"
        : null
    };
  } catch (error) {
    const errorCode = executionErrorCode(error);
    const modelContractFailure =
      completion !== null &&
      (errorCode === "INVALID_JSON" || errorCode === "INVALID_JSON_SCHEMA");
    return {
      callNumber: preparedCall.callNumber,
      pairId: preparedCall.pairId,
      sourceCaseId: preparedCall.sourceCaseId,
      role: preparedCall.role,
      arm: preparedCall.arm,
      runtimeConfig: preparedCall.runtimeConfig,
      startedAt,
      completedAt: new Date().toISOString(),
      status: modelContractFailure
        ? "model_contract_failure"
        : "technical_failure",
      requestHash: preparedCall.requestHash,
      responseHash: completion?.content ? sha256(completion.content) : null,
      provider: completion?.provider ?? input.provider.name,
      latencyMs: completion?.latencyMs ?? null,
      tokenUsage: completion?.tokenUsage ?? null,
      modelInput: preparedCall.modelInput,
      rawOutput: completion?.content ?? null,
      output: null,
      validationIssues: [],
      semanticStateAfter: null,
      errorCode
    };
  }
}

function renderCallOutput(call: Board7bThinkingCapabilityV1CallRecord) {
  if (call.output) return JSON.stringify(call.output, null, 2);
  return call.rawOutput ?? `运行结果：${call.status} / ${call.errorCode ?? "unknown"}`;
}

export function renderBoard7bThinkingCapabilityV1TransparentReview(input: {
  runFingerprint: string;
  calls: Board7bThinkingCapabilityV1CallRecord[];
  preparedCalls: Board7bThinkingCapabilityV1PreparedCall[];
}) {
  const sections = ["P1", "P2", "P3", "P4"].map((pairId) => {
    const calls = input.calls.filter((call) => call.pairId === pairId);
    const prepared = input.preparedCalls.find((call) => call.pairId === pairId)!;
    const conversation = prepared.turnInput.conversation
      .map((message) => `${message.id}｜${message.role}: ${message.content}`)
      .join("\n\n");
    const arms = calls
      .map(
        (call) => `### ${call.arm === "thinking_high" ? "Thinking high" : "Thinking 关闭"}\n\n` +
          `- 运行状态：\`${call.status}\`\n` +
          `- 延迟：\`${call.latencyMs ?? "N/A"} ms\`\n` +
          `- Token：\`${JSON.stringify(call.tokenUsage ?? {})}\`\n` +
          `- 校验问题：\`${call.validationIssues.join(", ") || "无"}\`\n\n` +
          "```json\n" +
          `${renderCallOutput(call)}\n` +
          "```"
      )
      .join("\n\n");
    return `## ${pairId}｜${prepared.evaluationFocus}\n\n### 完整语境\n\n${conversation}\n\n${arms}\n\n### 产品负责人裁决\n\n- Thinking 关闭：可直接使用 / 轻微问题 / 质量失败 / 单例阻断\n- Thinking high：可直接使用 / 轻微问题 / 质量失败 / 单例阻断\n- 配对判断：Thinking high 更好 / Thinking 关闭更好 / 相当\n- 理由：\n`;
  });
  return `# GI-086｜Thinking 能力校准透明评审\n\n` +
    `Run 指纹：\`${input.runFingerprint}\`\n\n` +
    "配置身份全程公开。请逐项依据用户体验、语义结构、来源、问题数量、延迟和 Token 裁决。\n\n" +
    `${sections.join("\n")}\n`;
}

async function readApprovedAuthorization(packagePath: string) {
  let source: string;
  try {
    source = await readFile(resolve(packagePath, APPROVED_AUTHORIZATION_FILE), "utf8");
  } catch {
    throw new Error("BOARD7B_THINKING_CAPABILITY_V1_AUTHORIZATION_MISSING");
  }
  const authorization = approvedAuthorizationSchema.parse(
    JSON.parse(source) as unknown
  );
  const { authorizationDigest, ...unsignedAuthorization } = authorization;
  if (
    authorizationDigest !==
    createBoard7bThinkingCapabilityV1AuthorizationDigest(unsignedAuthorization)
  ) {
    throw new Error(
      "BOARD7B_THINKING_CAPABILITY_V1_AUTHORIZATION_DIGEST_MISMATCH"
    );
  }
  return authorization;
}

function assertIsolatedEnvironment() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("BOARD7B_THINKING_CAPABILITY_V1_PRODUCTION_REJECTED");
  }
}

async function preflightLocalWrite(workspaceRoot: string) {
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

async function claimAuthorization(input: {
  workspaceRoot: string;
  authorizationId: string;
  authorizationDigest: string;
  runFingerprint: string;
  fingerprints: Record<keyof typeof fingerprintFields, string>;
}) {
  const path = resolve(
    input.workspaceRoot,
    AUTHORIZATION_CONSUMPTION_DIRECTORY,
    `${input.authorizationId}.json`
  );
  await writeExclusive(
    path,
    `${JSON.stringify(
      {
        authorizationId: input.authorizationId,
        authorizationDigest: input.authorizationDigest,
        runFingerprint: input.runFingerprint,
        ...input.fingerprints,
        callBudget: 8,
        scope: "eight_call_thinking_capability_probe",
        claimedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );
  return path;
}

export async function runBoard7bThinkingCapabilityV1() {
  const workspaceRoot = process.cwd();
  const inspected = await inspectBoard7bThinkingCapabilityV1(workspaceRoot);
  const authorization = await readApprovedAuthorization(inspected.packagePath);
  assertIsolatedEnvironment();
  const fingerprints = {
    candidateFingerprint: inspected.candidateFingerprint,
    sourceCandidateFingerprint: inspected.sourceCandidateFingerprint,
    datasetFingerprint: inspected.datasetFingerprint,
    requestSetFingerprint: inspected.requestSetFingerprint,
    evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
    executionFingerprint: inspected.executionFingerprint
  };
  assertFingerprintFields(authorization, fingerprints);
  const runFingerprint = sha256(
    JSON.stringify({
      ...fingerprints,
      runnerVersion: BOARD7B_THINKING_CAPABILITY_V1_RUNNER_VERSION,
      authorizationId: authorization.authorizationId,
      authorizationDigest: authorization.authorizationDigest,
      approvedAt: authorization.approvedAt,
      callBudget: authorization.authorizedModelCallBudget
    })
  );
  const outputPath = resolve(
    workspaceRoot,
    LOCAL_RUNTIME_DIRECTORY,
    `probe-${runFingerprint}`,
    "raw-results.json"
  );
  const credential = await resolveBoard7bSemanticFrameV1Credential();
  await validateBoard7bSemanticFrameV1Credential(credential.apiKey);
  const provider = await createBoard7bSemanticFrameV1Provider(credential.apiKey);
  await preflightLocalWrite(workspaceRoot);
  const consumptionRecordPath = await claimAuthorization({
    workspaceRoot,
    authorizationId: authorization.authorizationId,
    authorizationDigest: authorization.authorizationDigest,
    runFingerprint,
    fingerprints
  });
  const run = {
    evaluationId: BOARD7B_THINKING_CAPABILITY_V1_EVALUATION_ID,
    candidateVersion: BOARD7B_THINKING_CAPABILITY_V1_CANDIDATE_VERSION,
    ...fingerprints,
    runFingerprint,
    authorization: {
      authorizationId: authorization.authorizationId,
      authorizationDigest: authorization.authorizationDigest,
      approvedAt: authorization.approvedAt,
      callBudget: authorization.authorizedModelCallBudget,
      consumptionRecordPath: relative(workspaceRoot, consumptionRecordPath)
    },
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    calls: [] as Board7bThinkingCapabilityV1CallRecord[],
    production: "legacy + baseline"
  };
  await writeExclusive(outputPath, `${JSON.stringify(run, null, 2)}\n`);
  for (const preparedCall of inspected.preparedCalls) {
    const record = await executeBoard7bThinkingCapabilityV1Call({
      preparedCall,
      provider,
      systemPrompt: inspected.sourceAssets.systemPrompt
    });
    run.calls.push(record);
    await writeJsonAtomic(outputPath, run);
    process.stdout.write(
      `调用 ${record.callNumber}/8｜${record.pairId}｜${record.arm}｜${record.status}\n`
    );
  }
  run.completedAt = new Date().toISOString();
  await writeJsonAtomic(outputPath, run);
  const formalResult = {
    resultVersion: "2026-08-07.board7b-thinking-capability-result-v1",
    evidenceIdentity: "capability_route_probe",
    reviewStatus: "awaiting_product_owner_transparent_review",
    ...fingerprints,
    runFingerprint,
    authorization: {
      authorizationId: authorization.authorizationId,
      status: "consumed_once",
      modelCalls: run.calls.length
    },
    execution: {
      startedAt: run.startedAt,
      completedAt: run.completedAt,
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
      qualityRetries: 0,
      automaticTechnicalRetries: 0
    },
    calls: run.calls,
    hiddenReasoningSaved: false,
    production: "legacy + baseline"
  };
  await writeExclusive(
    resolve(inspected.packagePath, RESULT_FILE),
    `${JSON.stringify(formalResult, null, 2)}\n`
  );
  await writeExclusive(
    resolve(inspected.packagePath, TRANSPARENT_REVIEW_FILE),
    renderBoard7bThinkingCapabilityV1TransparentReview({
      runFingerprint,
      calls: run.calls,
      preparedCalls: inspected.preparedCalls
    })
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        runFingerprint,
        outputPath,
        modelCalls: run.calls.length,
        review: resolve(inspected.packagePath, TRANSPARENT_REVIEW_FILE)
      },
      null,
      2
    )}\n`
  );
}
