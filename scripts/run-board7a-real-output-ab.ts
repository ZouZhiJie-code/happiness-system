import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  BOARD7A_BUDGET_VERSION,
  BOARD7A_CANDIDATE_A_SYSTEM_PROMPT,
  BOARD7A_CANDIDATE_B_SEMANTIC_SYSTEM_PROMPT,
  BOARD7A_CANDIDATE_B_VISIBLE_SYSTEM_PROMPT,
  BOARD7A_CASES,
  BOARD7A_DATASET,
  BOARD7A_EVALUATION_ID,
  BOARD7A_OUTPUT_DIRECTORY,
  BOARD7A_PROMPT_VERSIONS,
  BOARD7A_REQUEST_BUDGET,
  BOARD7A_RUNTIME_CONFIG,
  createBoard7aPackageFingerprint,
  createCandidateAUserPrompt,
  createCandidateBSemanticUserPrompt,
  createCandidateBVisibleUserPrompt,
  formatBoard7aBlindReview,
  parseCandidateAOutput,
  parseCandidateBSemanticOutput,
  parseCandidateBVisibleOutput,
  validateBoard7aApproval,
  validateCandidateOutput,
  type Board7aApproval,
  type Board7aArchitecture,
  type Board7aCandidateResult,
  type Board7aCase
} from "../evals/event-centered-generative/board7a-real-output/board7a-real-output-ab";
import type {
  AICompletionResult,
  AIProvider
} from "../src/server/services/ai/ai-provider";
import { getAIProviderFailureCode } from "../src/server/services/ai/ai-provider";
import {
  getEventCenteredAIProvider,
  resolveEventCenteredCandidateProviderConfig
} from "../src/server/services/ai/event-centered-provider";

const outputDirectory = resolve(process.cwd(), BOARD7A_OUTPUT_DIRECTORY);
const budgetPath = resolve(outputDirectory, "board7a-six-case-ab-v1-budget.json");
const manifestPath = resolve(outputDirectory, "board7a-six-case-ab-v1-manifest.json");
const revealPath = resolve(outputDirectory, "board7a-six-case-ab-v1-reveal.json");
const checkpointPath = resolve(outputDirectory, "board7a-six-case-ab-v1-run.checkpoint.json");
const resultPath = resolve(outputDirectory, "board7a-six-case-ab-v1-run.json");
const blindReviewPath = resolve(outputDirectory, "board7a-six-case-ab-v1-blind-review-run.md");
const lockPath = `${budgetPath}.lock`;

type BudgetLedger = {
  budgetVersion: typeof BOARD7A_BUDGET_VERSION;
  status: "pending_approval" | "in_progress" | "completed" | "aborted";
  packageFingerprint: string;
  datasetVersion: string;
  model: string;
  nominalGenerationRequests: number;
  technicalRetriesMax: number;
  generationRequestsMax: number;
  generationRequestsUsed: number;
  technicalRetriesUsed: number;
  qualityRetriesUsed: number;
  approval: Board7aApproval | null;
  reservation: null | {
    reservationId: string;
    startedAt: string;
    completedAt: string | null;
    executionOutcome: "technical_complete" | "technical_failed" | null;
    error: string | null;
  };
};

type CallRecord = {
  callId: string;
  caseId: string;
  architecture: Board7aArchitecture;
  stage: "one_call" | "semantic" | "visible";
  attempt: 1 | 2;
  isTechnicalRetry: boolean;
  startedAt: string;
  completedAt: string;
  status: "valid_json" | "technical_failure";
  provider: string | null;
  model: typeof BOARD7A_RUNTIME_CONFIG.model;
  promptVersion: string;
  requestHash: string;
  responseHash: string | null;
  rawOutput: string | null;
  latencyMs: number | null;
  tokenUsage: AICompletionResult["tokenUsage"] | null;
  errorCode: string | null;
};

type CaseRun = {
  caseId: string;
  sourceKind: Board7aCase["sourceKind"];
  mode: Board7aCase["mode"];
  candidateA: Board7aCandidateResult;
  candidateB: Board7aCandidateResult;
};

type RunCheckpoint = {
  evaluationId: typeof BOARD7A_EVALUATION_ID;
  datasetVersion: typeof BOARD7A_DATASET.datasetVersion;
  packageFingerprint: string;
  runtimeConfig: typeof BOARD7A_RUNTIME_CONFIG;
  requestBudget: typeof BOARD7A_REQUEST_BUDGET;
  promptVersions: typeof BOARD7A_PROMPT_VERSIONS;
  approval: Board7aApproval;
  reservationId: string;
  createdAt: string;
  calls: CallRecord[];
  runs: CaseRun[];
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson<T>(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function writeText(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, value, "utf8");
  await rename(temporaryPath, path);
}

function validatePendingBudget(value: BudgetLedger) {
  if (
    value.budgetVersion !== BOARD7A_BUDGET_VERSION ||
    value.status !== "pending_approval" ||
    value.packageFingerprint !== createBoard7aPackageFingerprint() ||
    value.datasetVersion !== BOARD7A_DATASET.datasetVersion ||
    value.model !== BOARD7A_RUNTIME_CONFIG.model ||
    value.nominalGenerationRequests !== BOARD7A_REQUEST_BUDGET.nominalGenerationRequests ||
    value.technicalRetriesMax !== BOARD7A_REQUEST_BUDGET.technicalRetriesMax ||
    value.generationRequestsMax !== BOARD7A_REQUEST_BUDGET.generationRequestsMax ||
    value.generationRequestsUsed !== 0 ||
    value.technicalRetriesUsed !== 0 ||
    value.qualityRetriesUsed !== 0 ||
    value.approval !== null ||
    value.reservation !== null
  ) {
    throw new Error("BOARD7A_PENDING_BUDGET_INVALID");
  }
}

async function acquireRunLock() {
  await mkdir(dirname(lockPath), { recursive: true });
  try {
    const handle = await open(lockPath, "wx");
    await handle.writeFile(JSON.stringify({
      pid: process.pid,
      acquiredAt: new Date().toISOString()
    }));
    return handle;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("BOARD7A_RUN_LOCKED");
    }
    throw error;
  }
}

function technicalErrorCode(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") return "INVALID_JSON_SCHEMA";
  if (error instanceof SyntaxError) return "INVALID_JSON";
  return getAIProviderFailureCode(error);
}

function emptyCandidateResult(
  architecture: Board7aArchitecture
): Board7aCandidateResult {
  return {
    architecture,
    technicalComplete: false,
    semantic: null,
    visible: null,
    validationIssues: [],
    callIds: [],
    technicalError: null
  };
}

async function executeRun(input: {
  provider: AIProvider;
  checkpoint: RunCheckpoint;
  budget: BudgetLedger;
}) {
  async function persist() {
    await writeJson(checkpointPath, input.checkpoint);
    await writeJson(budgetPath, input.budget);
  }

  async function callStage<T>(options: {
    caseItem: Board7aCase;
    architecture: Board7aArchitecture;
    stage: CallRecord["stage"];
    promptVersion: string;
    systemPrompt: string;
    userPrompt: string;
    parse: (content: string) => T;
  }): Promise<{ value: T | null; callIds: string[]; errorCode: string | null }> {
    const callIds: string[] = [];
    for (const attempt of [1, 2] as const) {
      const isTechnicalRetry = attempt === 2;
      if (isTechnicalRetry) {
        if (
          input.budget.technicalRetriesUsed >=
          BOARD7A_REQUEST_BUDGET.technicalRetriesMax
        ) {
          return {
            value: null,
            callIds,
            errorCode: "TECHNICAL_RETRY_BUDGET_EXHAUSTED"
          };
        }
        input.budget.technicalRetriesUsed += 1;
      }
      if (
        input.budget.generationRequestsUsed >=
        BOARD7A_REQUEST_BUDGET.generationRequestsMax
      ) {
        throw new Error("BOARD7A_GENERATION_REQUEST_BUDGET_EXHAUSTED");
      }
      input.budget.generationRequestsUsed += 1;
      const callId = randomUUID();
      callIds.push(callId);
      const startedAt = new Date().toISOString();
      const requestHash = sha256(JSON.stringify({
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        runtimeConfig: BOARD7A_RUNTIME_CONFIG
      }));
      await persist();
      let completion: AICompletionResult | null = null;
      try {
        const result = await input.provider.complete({
          messages: [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: options.userPrompt }
          ],
          temperature: BOARD7A_RUNTIME_CONFIG.temperature,
          maxTokens: BOARD7A_RUNTIME_CONFIG.maxTokens,
          timeoutMs: BOARD7A_RUNTIME_CONFIG.timeoutMs,
          responseFormat: BOARD7A_RUNTIME_CONFIG.responseFormat,
          thinking: BOARD7A_RUNTIME_CONFIG.thinking
        });
        completion = result;
        const value = options.parse(result.content);
        input.checkpoint.calls.push({
          callId,
          caseId: options.caseItem.id,
          architecture: options.architecture,
          stage: options.stage,
          attempt,
          isTechnicalRetry,
          startedAt,
          completedAt: new Date().toISOString(),
          status: "valid_json",
          provider: result.provider,
          model: BOARD7A_RUNTIME_CONFIG.model,
          promptVersion: options.promptVersion,
          requestHash,
          responseHash: sha256(result.content),
          rawOutput: result.content,
          latencyMs: result.latencyMs,
          tokenUsage: result.tokenUsage ?? null,
          errorCode: null
        });
        await persist();
        return { value, callIds, errorCode: null };
      } catch (error) {
        const errorCode = technicalErrorCode(error);
        input.checkpoint.calls.push({
          callId,
          caseId: options.caseItem.id,
          architecture: options.architecture,
          stage: options.stage,
          attempt,
          isTechnicalRetry,
          startedAt,
          completedAt: new Date().toISOString(),
          status: "technical_failure",
          provider: completion?.provider ?? input.provider.name,
          model: BOARD7A_RUNTIME_CONFIG.model,
          promptVersion: options.promptVersion,
          requestHash,
          responseHash: completion ? sha256(completion.content) : null,
          rawOutput: completion?.content ?? null,
          latencyMs: completion?.latencyMs ?? null,
          tokenUsage: completion?.tokenUsage ?? null,
          errorCode
        });
        await persist();
        if (attempt === 2) return { value: null, callIds, errorCode };
      }
    }
    return { value: null, callIds, errorCode: "UNKNOWN_TECHNICAL_FAILURE" };
  }

  for (const caseItem of BOARD7A_CASES) {
    const candidateA = emptyCandidateResult("candidate_a");
    const candidateB = emptyCandidateResult("candidate_b");

    const oneCall = await callStage({
      caseItem,
      architecture: "candidate_a",
      stage: "one_call",
      promptVersion: BOARD7A_PROMPT_VERSIONS.candidateA,
      systemPrompt: BOARD7A_CANDIDATE_A_SYSTEM_PROMPT,
      userPrompt: createCandidateAUserPrompt(caseItem),
      parse: parseCandidateAOutput
    });
    candidateA.callIds = oneCall.callIds;
    if (oneCall.value) {
      candidateA.technicalComplete = true;
      candidateA.semantic = oneCall.value.semantic;
      candidateA.visible = oneCall.value.visible;
      candidateA.validationIssues = validateCandidateOutput({
        caseItem,
        semantic: oneCall.value.semantic,
        visible: oneCall.value.visible
      });
    } else {
      candidateA.technicalError = oneCall.errorCode;
    }

    const semanticStage = await callStage({
      caseItem,
      architecture: "candidate_b",
      stage: "semantic",
      promptVersion: BOARD7A_PROMPT_VERSIONS.candidateBSemantic,
      systemPrompt: BOARD7A_CANDIDATE_B_SEMANTIC_SYSTEM_PROMPT,
      userPrompt: createCandidateBSemanticUserPrompt(caseItem),
      parse: parseCandidateBSemanticOutput
    });
    candidateB.callIds.push(...semanticStage.callIds);
    if (semanticStage.value) {
      const visibleStage = await callStage({
        caseItem,
        architecture: "candidate_b",
        stage: "visible",
        promptVersion: BOARD7A_PROMPT_VERSIONS.candidateBVisible,
        systemPrompt: BOARD7A_CANDIDATE_B_VISIBLE_SYSTEM_PROMPT,
        userPrompt: createCandidateBVisibleUserPrompt({
          caseItem,
          semantic: semanticStage.value
        }),
        parse: parseCandidateBVisibleOutput
      });
      candidateB.callIds.push(...visibleStage.callIds);
      candidateB.semantic = semanticStage.value;
      if (visibleStage.value) {
        candidateB.visible = visibleStage.value;
        candidateB.technicalComplete = true;
        candidateB.validationIssues = validateCandidateOutput({
          caseItem,
          semantic: semanticStage.value,
          visible: visibleStage.value
        });
      } else {
        candidateB.technicalError = visibleStage.errorCode;
      }
    } else {
      candidateB.technicalError = semanticStage.errorCode;
    }

    input.checkpoint.runs.push({
      caseId: caseItem.id,
      sourceKind: caseItem.sourceKind,
      mode: caseItem.mode,
      candidateA,
      candidateB
    });
    await persist();
  }
}

async function checkPackage() {
  const [budget, manifest, reveal] = await Promise.all([
    readJson<BudgetLedger>(budgetPath),
    readJson<Record<string, unknown>>(manifestPath),
    readJson<Record<string, unknown>>(revealPath)
  ]);
  validatePendingBudget(budget);
  const expectedFingerprint = createBoard7aPackageFingerprint();
  if (manifest.packageFingerprint !== expectedFingerprint) {
    throw new Error("BOARD7A_MANIFEST_FINGERPRINT_MISMATCH");
  }
  if (reveal.packageFingerprint !== expectedFingerprint) {
    throw new Error("BOARD7A_REVEAL_FINGERPRINT_MISMATCH");
  }
  process.stdout.write(`${JSON.stringify({
    status: "candidate_package_ready",
    modelCalls: 0,
    datasetVersion: BOARD7A_DATASET.datasetVersion,
    caseIds: BOARD7A_CASES.map((item) => item.id),
    modeDistribution: BOARD7A_DATASET.modeDistribution,
    packageFingerprint: expectedFingerprint,
    nominalGenerationRequests: BOARD7A_REQUEST_BUDGET.nominalGenerationRequests,
    technicalRetriesMax: BOARD7A_REQUEST_BUDGET.technicalRetriesMax
  }, null, 2)}\n`);
}

async function execute(approvalPath: string) {
  loadEnvConfig(process.cwd(), true);
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("BOARD7A_PRODUCTION_EXECUTION_FORBIDDEN");
  }
  const approval = validateBoard7aApproval(await readJson<unknown>(approvalPath));
  const lock = await acquireRunLock();
  let budget: BudgetLedger | null = null;
  try {
    budget = await readJson<BudgetLedger>(budgetPath);
    validatePendingBudget(budget);
    const reservationId = randomUUID();
    budget.status = "in_progress";
    budget.approval = approval;
    budget.reservation = {
      reservationId,
      startedAt: new Date().toISOString(),
      completedAt: null,
      executionOutcome: null,
      error: null
    };
    await writeJson(budgetPath, budget);

    const env = {
      ...process.env,
      AI_PROVIDER: "openai",
      EVENT_CENTERED_GENERATIVE_MODEL: BOARD7A_RUNTIME_CONFIG.model
    };
    resolveEventCenteredCandidateProviderConfig(env);
    const provider = await getEventCenteredAIProvider({ env });
    if (!provider) throw new Error("BOARD7A_PROVIDER_UNAVAILABLE");

    const checkpoint: RunCheckpoint = {
      evaluationId: BOARD7A_EVALUATION_ID,
      datasetVersion: BOARD7A_DATASET.datasetVersion,
      packageFingerprint: createBoard7aPackageFingerprint(),
      runtimeConfig: BOARD7A_RUNTIME_CONFIG,
      requestBudget: BOARD7A_REQUEST_BUDGET,
      promptVersions: BOARD7A_PROMPT_VERSIONS,
      approval,
      reservationId,
      createdAt: new Date().toISOString(),
      calls: [],
      runs: []
    };
    await writeJson(checkpointPath, checkpoint);
    await executeRun({ provider, checkpoint, budget });
    const technicalComplete = checkpoint.runs.every(
      (run) => run.candidateA.technicalComplete && run.candidateB.technicalComplete
    );
    budget.status = "completed";
    budget.reservation.completedAt = new Date().toISOString();
    budget.reservation.executionOutcome = technicalComplete
      ? "technical_complete"
      : "technical_failed";
    await writeJson(budgetPath, budget);
    const result = {
      ...checkpoint,
      completedAt: budget.reservation.completedAt,
      executionOutcome: budget.reservation.executionOutcome,
      requestUsage: {
        generationRequestsUsed: budget.generationRequestsUsed,
        technicalRetriesUsed: budget.technicalRetriesUsed,
        qualityRetriesUsed: budget.qualityRetriesUsed
      },
      gate: "pending_blind_product_review"
    };
    await writeJson(resultPath, result);
    const results = Object.fromEntries(checkpoint.runs.map((run) => [
      run.caseId,
      {
        candidate_a: run.candidateA,
        candidate_b: run.candidateB
      }
    ]));
    await writeText(blindReviewPath, formatBoard7aBlindReview({ results }));
    process.stdout.write(`${JSON.stringify({
      status: "run_complete",
      outputPath: resultPath,
      blindReviewPath,
      requestUsage: result.requestUsage,
      executionOutcome: result.executionOutcome
    }, null, 2)}\n`);
  } catch (error) {
    if (budget?.reservation && budget.status === "in_progress") {
      budget.status = "aborted";
      budget.reservation.completedAt = new Date().toISOString();
      budget.reservation.error = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      await writeJson(budgetPath, budget);
    }
    throw error;
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

function readArgs(argv: string[]) {
  if (argv.includes("--print-package")) {
    return { mode: "print_package" as const, approvalPath: null };
  }
  const executeIndex = argv.indexOf("--execute");
  if (executeIndex === -1) return { mode: "check" as const, approvalPath: null };
  const approvalFlag = argv.indexOf("--approval");
  const approvalPath = approvalFlag >= 0 ? argv[approvalFlag + 1] : null;
  if (!approvalPath) throw new Error("BOARD7A_APPROVAL_PATH_REQUIRED");
  return { mode: "execute" as const, approvalPath: resolve(process.cwd(), approvalPath) };
}

const args = readArgs(process.argv.slice(2));
if (args.mode === "print_package") {
  process.stdout.write(`${JSON.stringify({
    packageFingerprint: createBoard7aPackageFingerprint(),
    pairing: (await import(
      "../evals/event-centered-generative/board7a-real-output/board7a-real-output-ab"
    )).createBoard7aPairing()
  }, null, 2)}\n`);
} else if (args.mode === "check") {
  await checkPackage();
} else {
  await execute(args.approvalPath);
}

export {};
