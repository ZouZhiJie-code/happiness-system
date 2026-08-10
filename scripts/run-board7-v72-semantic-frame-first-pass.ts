import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  abortGenerativeSemanticFrameV5FirstPassRun,
  completeGenerativeSemanticFrameV5FirstPassRun,
  consumeGenerativeSemanticFrameV5UnknownAttempts,
  GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_ARTIFACT_PATH,
  GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG,
  markGenerativeSemanticFrameV5FirstPassCaseTerminal,
  parseGenerativeSemanticFrameV5FirstPassBudget,
  reserveGenerativeSemanticFrameV5FirstPassAttempt,
  reserveGenerativeSemanticFrameV5FirstPassPreflight,
  reserveGenerativeSemanticFrameV5FirstPassRun,
  settleGenerativeSemanticFrameV5FirstPassAttempt,
  validateGenerativeSemanticFrameV5FirstPassApproval,
  type GenerativeSemanticFrameV5FirstPassBudget
} from "../src/features/interview/event-centered/generative-v72-first-pass";
import {
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES,
  runGenerativeDeepSeekProviderPreflight,
  type GenerativeSemanticFrameV5OfflineCase
} from "../src/features/interview/event-centered/generative-evaluation-runner";
import {
  generateEventCenteredGenerativeSemanticPlanAI,
  generateEventCenteredGenerativeVisibleTurnAI,
  type EventCenteredGenerativeGenerationInput,
  type EventCenteredGenerativeSemanticPlanArtifact,
  type EventCenteredGenerativeVisibleStageResult
} from "../src/server/services/interview/event-centered-ai.service";
import type { AIProvider } from "../src/server/services/ai/ai-provider";
import { readVolcengineArkConfig } from "../src/server/services/ai/provider-config";
import { createRuntimeAIProvider } from "../src/server/services/ai/runtime-provider-factory";

const outputDirectory = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-02"
);
const approvalPath = resolve(
  outputDirectory,
  "board7-provider-v72-semantic-frame-first-pass-v2-approval.json"
);
const checkpointPath = resolve(
  outputDirectory,
  "board7-provider-v72-semantic-frame-first-pass-v2-run.checkpoint.json"
);
const outputPath = resolve(
  outputDirectory,
  "board7-provider-v72-semantic-frame-first-pass-v2-run.json"
);
const reportPath = resolve(
  outputDirectory,
  "board7-provider-v72-semantic-frame-first-pass-v2-report.md"
);
const budgetPath = resolve(
  process.cwd(),
  GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_ARTIFACT_PATH
);
const budgetLockPath = `${budgetPath}.lock`;

type CaseRun = {
  caseId: string;
  angle: string;
  mode: string;
  expected: {
    state: string;
    action: string;
    origin: string | null;
    semanticFrame: unknown;
    questionIntent: unknown;
    limitReason: unknown;
    visibleQuality: unknown;
  };
  input: {
    currentQuestion: string;
    currentUserText: string;
    conversationContext: unknown;
    evidenceCatalog: unknown;
  };
  semantic: {
    artifact: EventCenteredGenerativeSemanticPlanArtifact | null;
    technicalComplete: boolean;
    validationIssues: string[];
    qualityDiagnostics: string[];
    attempts: unknown[];
  };
  visible: {
    turn: unknown;
    technicalComplete: boolean;
    response: string | null;
    thinkingSummary: string | null;
    validationIssues: string[];
    qualityDiagnostics: string[];
    attempts: unknown[];
  };
  terminalStatus: "complete" | "semantic_failed" | "visible_failed";
  latencyMs: number;
};

type InProgressCase = {
  caseId: string;
  startedAt: string;
  semanticArtifact: EventCenteredGenerativeSemanticPlanArtifact | null;
};

type RunCheckpoint = {
  evaluation: "board7_provider_v72_semantic_frame_first_pass";
  datasetVersion: string;
  caseFingerprint: string;
  scopeFingerprint: string;
  candidateVersions: unknown;
  runtimeConfig: unknown;
  reservationId: string;
  approvalPath: string;
  createdAt: string;
  runs: CaseRun[];
  inProgress: InProgressCase | null;
};

type RunEnvelope = RunCheckpoint & {
  completedAt: string;
  requestUsage: unknown;
  executionOutcome: "technical_complete" | "technical_failed";
  gate: "pending_codex_review" | "technical_failed";
  stopReason: string;
};

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readCheckpoint(): Promise<RunCheckpoint | null> {
  try {
    return await readJson<RunCheckpoint>(checkpointPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function withBudgetLock<T>(work: () => Promise<T>) {
  await mkdir(dirname(budgetLockPath), { recursive: true });
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(budgetLockPath, "wx");
    await lock.writeFile(JSON.stringify({
      pid: process.pid,
      acquiredAt: new Date().toISOString()
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_LOCKED");
    }
    throw error;
  }
  try {
    return await work();
  } finally {
    await lock.close();
    await unlink(budgetLockPath).catch(() => undefined);
  }
}

async function mutateBudget(
  mutate: (
    budget: GenerativeSemanticFrameV5FirstPassBudget
  ) => GenerativeSemanticFrameV5FirstPassBudget
) {
  return withBudgetLock(async () => {
    const budget = parseGenerativeSemanticFrameV5FirstPassBudget(
      await readJson<unknown>(budgetPath)
    );
    const next = mutate(budget);
    await writeJson(budgetPath, next);
    return next;
  });
}

function frozenProvider() {
  const config = readVolcengineArkConfig();
  if (config.issues.length > 0 || !config.apiKey || !config.model) {
    throw new Error(
      `EVENT_CENTERED_GENERATIVE_EVAL_PROVIDER_INVALID:${config.issues.join(",")}`
    );
  }
  if (config.model !== GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG.model) {
    throw new Error(
      `EVENT_CENTERED_GENERATIVE_EVAL_MODEL_MISMATCH:要求 ${GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG.model}，当前为 ${config.model}`
    );
  }
  const provider = createRuntimeAIProvider({
    capability: "chat",
    apiKey: config.apiKey,
    config: {
      provider: "volcengine_ark",
      config:
        config.modelSource === "VOLCENGINE_ARK_ENDPOINT_ID" ||
        config.modelSource === "ARK_ENDPOINT_ID"
          ? { endpointId: config.model, baseUrl: config.baseUrl }
          : { modelId: config.model, baseUrl: config.baseUrl }
    },
    timeoutMs: GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG.timeoutMs
  });
  return {
    config: config as typeof config & { apiKey: string; model: string },
    provider
  };
}

function createInput(
  caseItem: GenerativeSemanticFrameV5OfflineCase
): EventCenteredGenerativeGenerationInput {
  return {
    rawText: caseItem.currentUserText,
    phase: caseItem.mode === "guided_reflection"
      ? "guided_reflection"
      : "deep_companionship",
    activeAngle: caseItem.angle,
    currentQuestion: caseItem.currentQuestion,
    currentQuestionTarget: caseItem.currentQuestionTarget,
    currentQuestionIntent: {
      targetId: caseItem.currentQuestionIntent.targetId,
      semanticGoal: caseItem.currentQuestionIntent.semanticGoal,
      minimumAnswerScope: caseItem.currentQuestionIntent.minimumAnswerScope
    },
    currentQuestionSurfaceLevel: "open_anchor",
    currentQuestionCognitiveAction: caseItem.currentQuestionCognitiveAction,
    facts: caseItem.trustedFacts.map((fact, index) => ({
      id: fact.id,
      eventId: `semantic-frame-v5-${caseItem.id}`,
      createdBranchSessionId: "evaluation-branch",
      pathAnchorMessageId: `evaluation-message-${index + 1}`,
      createdByRevisionId: null,
      statement: fact.statement,
      scope: "current_event" as const,
      stance: "affirmed" as const,
      kind: "event_detail" as const,
      origin: "user_expression" as const,
      createdAt: "2026-08-02T00:00:00.000Z",
      evidence: [{
        id: `${fact.id}-evidence`,
        factId: fact.id,
        sourceTurnId: "evaluation-prior-turn",
        contextMessageId: null,
        pathAnchorMessageId: `evaluation-message-${index + 1}`,
        role: "direct_expression" as const,
        quote: fact.sourceQuote,
        createdAt: "2026-08-02T00:00:00.000Z"
      }]
    })),
    recentTurns: caseItem.conversationContext,
    askedTargets: [],
    answeredTargets: [],
    deniedTargets: [],
    guidedQuestionOpportunityCount: 1,
    microgoal: caseItem.mode === "deep_conversation"
      ? {
          statement: caseItem.currentQuestionIntent.semanticGoal,
          questionCount: 0,
          status: "active" as const,
          evidenceRefs: []
        }
      : null,
    maxTokens: GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG.maxTokens,
    timeoutMs: GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_RUNTIME_CONFIG.timeoutMs
  };
}

function visibleResponse(result: EventCenteredGenerativeVisibleStageResult) {
  return result.turn?.visibleTurn.question ??
    result.turn?.visibleTurn.insight ??
    result.turn?.visibleTurn.honestLimit ??
    null;
}

type StageTracker = {
  provider: AIProvider;
  attempts: Array<{ attemptIndex: 1 | 2 }>;
};

function trackedProvider(input: {
  provider: AIProvider;
  caseId: string;
  stage: "semantic" | "visible";
  reservationId: string;
  initialAttemptCount: number;
}): StageTracker {
  const attempts: Array<{ attemptIndex: 1 | 2 }> = [];
  return {
    provider: {
      name: input.provider.name,
      complete: async (params) => {
        const attemptIndex = input.initialAttemptCount + attempts.length + 1;
        if (attemptIndex !== 1 && attemptIndex !== 2) {
          throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_ATTEMPT_BUDGET_EXHAUSTED");
        }
        await mutateBudget((budget) =>
          reserveGenerativeSemanticFrameV5FirstPassAttempt({
            budget,
            reservationId: input.reservationId,
            caseId: input.caseId,
            stage: input.stage,
            attemptIndex,
            reservedAt: new Date().toISOString()
          })
        );
        attempts.push({ attemptIndex });
        return input.provider.complete(params);
      },
      ...(input.provider.stream
        ? { stream: input.provider.stream.bind(input.provider) }
        : {}),
      ...(input.provider.embed
        ? { embed: input.provider.embed.bind(input.provider) }
        : {})
    },
    attempts
  };
}

function emptyVisible(): CaseRun["visible"] {
  return {
    turn: null,
    technicalComplete: false,
    response: null,
    thinkingSummary: null,
    validationIssues: [],
    qualityDiagnostics: [],
    attempts: []
  };
}

function caseShell(caseItem: GenerativeSemanticFrameV5OfflineCase): CaseRun {
  return {
    caseId: caseItem.id,
    angle: caseItem.angle,
    mode: caseItem.mode,
    expected: {
      state: caseItem.expectedDecision.state,
      action: caseItem.expectedDecision.action,
      origin: caseItem.expectedDecision.origin,
      semanticFrame: caseItem.expectedSemanticFrame,
      questionIntent: caseItem.expectedQuestionIntent,
      limitReason: caseItem.expectedLimitReason,
      visibleQuality: caseItem.expectedVisibleQuality
    },
    input: {
      currentQuestion: caseItem.currentQuestion,
      currentUserText: caseItem.currentUserText,
      conversationContext: caseItem.conversationContext,
      evidenceCatalog: caseItem.evidenceCatalog
    },
    semantic: {
      artifact: null,
      technicalComplete: false,
      validationIssues: [],
      qualityDiagnostics: [],
      attempts: []
    },
    visible: emptyVisible(),
    terminalStatus: "semantic_failed",
    latencyMs: 0
  };
}

function requestUsage(budget: GenerativeSemanticFrameV5FirstPassBudget) {
  return budget.reservation
    ? {
        readOnlyModelsPreflightRequests: budget.reservation.preflightRequests,
        attempts: budget.reservation.attempts
      }
    : { readOnlyModelsPreflightRequests: 0, attempts: [] };
}

function assertCheckpointIdentity(input: {
  checkpoint: RunCheckpoint;
  budget: GenerativeSemanticFrameV5FirstPassBudget;
}) {
  if (
    input.checkpoint.datasetVersion !== input.budget.datasetVersion ||
    input.checkpoint.caseFingerprint !== input.budget.caseFingerprint ||
    input.checkpoint.scopeFingerprint !== input.budget.scopeFingerprint ||
    input.checkpoint.reservationId !== input.budget.reservation?.reservationId ||
    JSON.stringify(input.checkpoint.candidateVersions) !==
      JSON.stringify(input.budget.candidateVersions) ||
    JSON.stringify(input.checkpoint.runtimeConfig) !==
      JSON.stringify(input.budget.runtimeConfig)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CHECKPOINT_MISMATCH");
  }
}

async function saveCheckpoint(input: {
  checkpoint: RunCheckpoint;
  runs: CaseRun[];
  inProgress: InProgressCase | null;
}) {
  const next = {
    ...input.checkpoint,
    runs: structuredClone(input.runs),
    inProgress: structuredClone(input.inProgress)
  };
  await writeJson(checkpointPath, next);
  return next;
}

async function runCase(input: {
  caseItem: GenerativeSemanticFrameV5OfflineCase;
  provider: AIProvider;
  reservationId: string;
  checkpoint: RunCheckpoint;
  completedRuns: CaseRun[];
}) {
  const startedAt = Date.now();
  const generationInput = createInput(input.caseItem);
  let checkpoint = input.checkpoint;
  let budget = parseGenerativeSemanticFrameV5FirstPassBudget(
    await readJson<unknown>(budgetPath)
  );
  const existingInProgress = checkpoint.inProgress?.caseId === input.caseItem.id
    ? checkpoint.inProgress
    : null;
  let semanticArtifact = existingInProgress?.semanticArtifact ?? null;
  let semanticValidationIssues: string[] = [];
  let semanticQualityDiagnostics: string[] = [];
  let semanticAttemptDetails: unknown[] = [];

  if (!semanticArtifact) {
    const existingSemanticAttempts = budget.reservation?.attempts.filter((attempt) =>
      attempt.caseId === input.caseItem.id && attempt.stage === "semantic"
    ).length ?? 0;
    const remainingSemanticAttempts = Math.max(0, 2 - existingSemanticAttempts);
    if (remainingSemanticAttempts > 0) {
      const tracker = trackedProvider({
        provider: input.provider,
        caseId: input.caseItem.id,
        stage: "semantic",
        reservationId: input.reservationId,
        initialAttemptCount: existingSemanticAttempts
      });
      const semantic = await generateEventCenteredGenerativeSemanticPlanAI({
        ...generationInput,
        maxAttempts: remainingSemanticAttempts,
        provider: tracker.provider,
        onSemanticAttemptResult: async (result) => {
          const tracked = tracker.attempts[result.attemptIndex - 1];
          if (!tracked) return;
          if (result.artifact) {
            checkpoint = await saveCheckpoint({
              checkpoint,
              runs: input.completedRuns,
              inProgress: {
                caseId: input.caseItem.id,
                startedAt: new Date(startedAt).toISOString(),
                semanticArtifact: result.artifact
              }
            });
          }
          await mutateBudget((current) =>
            settleGenerativeSemanticFrameV5FirstPassAttempt({
              budget: current,
              reservationId: input.reservationId,
              caseId: input.caseItem.id,
              stage: "semantic",
              attemptIndex: tracked.attemptIndex,
              outcome: result.success ? "valid" : "technical_failure",
              settledAt: new Date().toISOString(),
              errorCode: result.success
                ? null
                : result.validationIssues[0] ?? "TECHNICAL_STAGE_FAILURE"
            })
          );
        }
      });
      semanticArtifact = semantic.artifact;
      semanticValidationIssues = semantic.validationIssues;
      semanticQualityDiagnostics = semantic.qualityDiagnostics;
      semanticAttemptDetails = semantic.attempts;
    }
  }

  const run = caseShell(input.caseItem);
  run.semantic = {
    artifact: semanticArtifact,
    technicalComplete: Boolean(semanticArtifact),
    validationIssues: semanticValidationIssues,
    qualityDiagnostics: semanticQualityDiagnostics,
    attempts: semanticAttemptDetails
  };
  if (!semanticArtifact) {
    const errorCode = semanticValidationIssues[0] ?? "SEMANTIC_STAGE_FAILED";
    await mutateBudget((current) =>
      markGenerativeSemanticFrameV5FirstPassCaseTerminal({
        budget: current,
        reservationId: input.reservationId,
        caseId: input.caseItem.id,
        status: "semantic_failed",
        completedAt: new Date().toISOString(),
        errorCode
      })
    );
    run.terminalStatus = "semantic_failed";
    run.visible.validationIssues = ["VISIBLE_SKIPPED_AFTER_SEMANTIC_FAILURE"];
    run.latencyMs = Date.now() - startedAt;
    return run;
  }

  budget = parseGenerativeSemanticFrameV5FirstPassBudget(
    await readJson<unknown>(budgetPath)
  );
  const existingVisibleAttempts = budget.reservation?.attempts.filter((attempt) =>
    attempt.caseId === input.caseItem.id && attempt.stage === "visible"
  ).length ?? 0;
  let visible: EventCenteredGenerativeVisibleStageResult | null = null;
  const visibleAttemptDetails: unknown[] = [];
  const visibleValidationIssues: string[] = [];
  const visibleQualityDiagnostics: string[] = [];
  for (let index = existingVisibleAttempts; index < 2; index += 1) {
    const tracker = trackedProvider({
      provider: input.provider,
      caseId: input.caseItem.id,
      stage: "visible",
      reservationId: input.reservationId,
      initialAttemptCount: index
    });
    const current = await generateEventCenteredGenerativeVisibleTurnAI({
      ...generationInput,
      provider: tracker.provider,
      artifact: semanticArtifact
    });
    const tracked = tracker.attempts[0];
    if (tracked) {
      await mutateBudget((currentBudget) =>
        settleGenerativeSemanticFrameV5FirstPassAttempt({
          budget: currentBudget,
          reservationId: input.reservationId,
          caseId: input.caseItem.id,
          stage: "visible",
          attemptIndex: tracked.attemptIndex,
          outcome: current.turn ? "valid" : "technical_failure",
          settledAt: new Date().toISOString(),
          errorCode: current.turn
            ? null
            : current.validationIssues[0] ?? "TECHNICAL_STAGE_FAILURE"
        })
      );
    }
    visibleAttemptDetails.push(...current.attempts);
    visibleValidationIssues.push(...current.validationIssues);
    visibleQualityDiagnostics.push(...current.qualityDiagnostics);
    visible = current;
    if (current.turn || tracker.attempts.length === 0) break;
  }
  run.visible = {
    turn: visible?.turn ?? null,
    technicalComplete: Boolean(visible?.turn),
    response: visible ? visibleResponse(visible) : null,
    thinkingSummary: visible?.turn?.visibleTurn.thinkingSummary ?? null,
    validationIssues: [...new Set(visibleValidationIssues)],
    qualityDiagnostics: [...new Set(visibleQualityDiagnostics)],
    attempts: visibleAttemptDetails
  };
  run.terminalStatus = visible?.turn ? "complete" : "visible_failed";
  run.latencyMs = Date.now() - startedAt;
  await mutateBudget((current) =>
    markGenerativeSemanticFrameV5FirstPassCaseTerminal({
      budget: current,
      reservationId: input.reservationId,
      caseId: input.caseItem.id,
      status: run.terminalStatus,
      completedAt: new Date().toISOString(),
      errorCode: visible?.turn
        ? null
        : visibleValidationIssues[0] ?? "VISIBLE_STAGE_FAILED"
    })
  );
  return run;
}

function formatReport(envelope: RunEnvelope) {
  const technicalComplete = envelope.runs.filter((run) =>
    run.semantic.technicalComplete && run.visible.technicalComplete
  ).length;
  const usage = envelope.requestUsage as {
    readOnlyModelsPreflightRequests: number;
    attempts: unknown[];
  };
  const lines = [
    "# 板块 7｜Provider v72 六例首轮真实运行报告",
    "",
    `- 运行时间：${envelope.createdAt}`,
    `- 数据集 / 案例指纹：${envelope.datasetVersion} / ${envelope.caseFingerprint}`,
    `- scopeFingerprint：${envelope.scopeFingerprint}`,
    `- 技术完整：${technicalComplete}/${envelope.runs.length}`,
    `- 请求：预检 ${usage.readOnlyModelsPreflightRequests} 次；生成 ${usage.attempts.length} 次`,
    `- 执行结果：${envelope.executionOutcome}`,
    `- 当前 gate：${envelope.gate}`,
    `- 下一步：${envelope.stopReason}`,
    "",
    "## 六例真实回放",
    ""
  ];
  for (const run of envelope.runs) {
    lines.push(
      `### ${run.caseId}｜${run.angle} / ${run.mode}`,
      "",
      `用户：${run.input.currentUserText}`,
      "",
      `预期状态 / 动作 / 归属：${run.expected.state} / ${run.expected.action} / ${run.expected.origin ?? "null"}`,
      "",
      `第一段：${JSON.stringify(run.semantic.artifact ?? { issues: run.semantic.validationIssues })}`,
      "",
      `用户可见思路：${run.visible.thinkingSummary ?? "（停止轮不展示）"}`,
      "",
      `用户可见回应：${run.visible.response ?? "（未生成）"}`,
      "",
      `技术状态：语义 ${run.semantic.technicalComplete ? "通过" : "失败"}；表达 ${run.visible.technicalComplete ? "通过" : "失败"}；终态 ${run.terminalStatus}`,
      `耗时：${run.latencyMs}ms`,
      ""
    );
  }
  return lines.join("\n");
}

async function main() {
  loadEnvConfig(process.cwd());
  const approval = validateGenerativeSemanticFrameV5FirstPassApproval(
    await readJson<unknown>(approvalPath)
  );
  let budget = parseGenerativeSemanticFrameV5FirstPassBudget(
    await readJson<unknown>(budgetPath)
  );
  let checkpoint = await readCheckpoint();
  let reservationId: string;
  let canAbort = false;
  try {
    if (budget.status === "pending" || budget.status === "approved") {
      reservationId = randomUUID();
      budget = await mutateBudget((current) =>
        reserveGenerativeSemanticFrameV5FirstPassRun({
          budget: current,
          approval,
          reservationId,
          reservedAt: new Date().toISOString()
        })
      );
      checkpoint = {
        evaluation: "board7_provider_v72_semantic_frame_first_pass",
        datasetVersion: budget.datasetVersion,
        caseFingerprint: budget.caseFingerprint,
        scopeFingerprint: budget.scopeFingerprint,
        candidateVersions: budget.candidateVersions,
        runtimeConfig: budget.runtimeConfig,
        reservationId,
        approvalPath,
        createdAt: approval.approvedAt,
        runs: [],
        inProgress: null
      };
      await writeJson(checkpointPath, checkpoint);
    } else if (budget.status === "reserved" && budget.reservation) {
      reservationId = budget.reservation.reservationId;
      if (!checkpoint) {
        throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_CHECKPOINT_REQUIRED");
      }
      assertCheckpointIdentity({ checkpoint, budget });
      budget = await mutateBudget((current) =>
        consumeGenerativeSemanticFrameV5UnknownAttempts({
          budget: current,
          reservationId,
          settledAt: new Date().toISOString()
        })
      );
    } else {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_FIRST_PASS_BUDGET_ALREADY_CONSUMED");
    }
    canAbort = true;
    const { config, provider } = frozenProvider();
    if ((budget.reservation?.preflightRequests ?? 0) === 0) {
      budget = await mutateBudget((current) =>
        reserveGenerativeSemanticFrameV5FirstPassPreflight({
          budget: current,
          reservationId
        })
      );
      await runGenerativeDeepSeekProviderPreflight({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model
      });
    }

    const runs = [...(checkpoint?.runs ?? [])];
    for (const caseItem of GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES) {
      budget = parseGenerativeSemanticFrameV5FirstPassBudget(
        await readJson<unknown>(budgetPath)
      );
      if (budget.reservation?.caseTerminals.some((item) => item.caseId === caseItem.id)) {
        continue;
      }
      const run = await runCase({
        caseItem,
        provider,
        reservationId,
        checkpoint: checkpoint!,
        completedRuns: runs
      });
      runs.push(run);
      checkpoint = await saveCheckpoint({
        checkpoint: checkpoint!,
        runs,
        inProgress: null
      });
    }

    budget = parseGenerativeSemanticFrameV5FirstPassBudget(
      await readJson<unknown>(budgetPath)
    );
    const completedAt = new Date().toISOString();
    const executionOutcome = budget.reservation?.caseTerminals.every((item) =>
      item.status === "complete"
    ) ? "technical_complete" as const : "technical_failed" as const;
    const envelope: RunEnvelope = {
      ...checkpoint!,
      completedAt,
      inProgress: null,
      requestUsage: requestUsage(budget),
      executionOutcome,
      gate: executionOutcome === "technical_complete"
        ? "pending_codex_review"
        : "technical_failed",
      stopReason: executionOutcome === "technical_complete"
        ? "六例已完成，等待 Codex 双层裁决"
        : "六例均已到达终态，技术门未通过，停止后续模型运行"
    };
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(envelope))
      .digest("hex");
    budget = await mutateBudget((current) =>
      completeGenerativeSemanticFrameV5FirstPassRun({
        budget: current,
        reservationId,
        completedAt,
        runEnvelopeFingerprint: fingerprint
      })
    );
    envelope.requestUsage = requestUsage(budget);
    await writeJson(outputPath, envelope);
    await writeFile(reportPath, `${formatReport(envelope)}\n`, "utf8");
    console.log(JSON.stringify({
      outputPath,
      reportPath,
      reservationId,
      fingerprint,
      executionOutcome
    }, null, 2));
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "UNKNOWN_V72_FIRST_PASS_ERROR";
    if (canAbort) {
      const latest = parseGenerativeSemanticFrameV5FirstPassBudget(
        await readJson<unknown>(budgetPath)
      );
      if (latest.status === "reserved" && latest.reservation) {
        await mutateBudget((current) =>
          abortGenerativeSemanticFrameV5FirstPassRun({
            budget: current,
            reservationId: latest.reservation!.reservationId,
            completedAt: new Date().toISOString(),
            error: message
          })
        );
      }
    }
    throw error;
  }
}

void main();
