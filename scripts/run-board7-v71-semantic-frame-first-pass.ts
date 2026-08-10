import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  abortGenerativeSemanticFrameV4FirstPassRun,
  completeGenerativeSemanticFrameV4FirstPassRun,
  GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ARTIFACT_PATH,
  GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG,
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES,
  parseGenerativeSemanticFrameV4FirstPassBudget,
  reserveGenerativeSemanticFrameV4FirstPassAttempt,
  reserveGenerativeSemanticFrameV4FirstPassPreflight,
  reserveGenerativeSemanticFrameV4FirstPassRun,
  runGenerativeDeepSeekProviderPreflight,
  settleGenerativeSemanticFrameV4FirstPassAttempt,
  validateGenerativeSemanticFrameV4FirstPassApproval,
  type GenerativeSemanticFrameV4FirstPassBudget
} from "../src/features/interview/event-centered/generative-evaluation-runner";
import {
  generateEventCenteredGenerativeSemanticPlanAI,
  generateEventCenteredGenerativeVisibleTurnAI,
  type EventCenteredGenerativeGenerationInput,
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
  "board7-provider-v71-semantic-frame-first-pass-approval.json"
);
const checkpointPath = resolve(
  outputDirectory,
  "board7-provider-v71-semantic-frame-first-pass-run.checkpoint.json"
);
const outputPath = resolve(
  outputDirectory,
  "board7-provider-v71-semantic-frame-first-pass-run.json"
);
const reportPath = resolve(
  outputDirectory,
  "board7-provider-v71-semantic-frame-first-pass-report.md"
);
const budgetPath = resolve(
  process.cwd(),
  GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ARTIFACT_PATH
);
const budgetLockPath = `${budgetPath}.lock`;

type CaseRun = {
  caseId: string;
  angle: string;
  mode: string;
  expected: {
    state: string;
    action: string;
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
    artifact: unknown;
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
  latencyMs: number;
};

type RunEnvelope = {
  evaluation: "board7_provider_v71_semantic_frame_first_pass";
  datasetVersion: string;
  caseFingerprint: string;
  scopeFingerprint: string;
  candidateVersions: unknown;
  runtimeConfig: unknown;
  reservationId: string;
  approvalPath: string;
  createdAt: string;
  completedAt: string | null;
  runs: CaseRun[];
  requestUsage: unknown;
  gate: "pending_codex_review" | "technical_stop";
  stopReason: string | null;
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

async function withBudgetLock<T>(work: () => Promise<T>) {
  await mkdir(dirname(budgetLockPath), { recursive: true });
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(budgetLockPath, "wx");
    await lock.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_LOCKED");
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
  mutate: (budget: GenerativeSemanticFrameV4FirstPassBudget) => GenerativeSemanticFrameV4FirstPassBudget
) {
  return withBudgetLock(async () => {
    const budget = parseGenerativeSemanticFrameV4FirstPassBudget(
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
    throw new Error(`EVENT_CENTERED_GENERATIVE_EVAL_PROVIDER_INVALID:${config.issues.join(",")}`);
  }
  if (config.model !== GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG.model) {
    throw new Error(
      `EVENT_CENTERED_GENERATIVE_EVAL_MODEL_MISMATCH:要求 ${GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG.model}，当前为 ${config.model}`
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
    timeoutMs: GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG.timeoutMs
  });
  return {
    config: config as typeof config & { apiKey: string; model: string },
    provider
  };
}

function createInput(caseItem: (typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES)[number]): EventCenteredGenerativeGenerationInput {
  return {
    rawText: caseItem.currentUserText,
    phase: caseItem.mode === "guided_reflection" ? "guided_reflection" : "deep_companionship",
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
      eventId: `semantic-frame-v4-${caseItem.id}`,
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
    maxTokens: GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG.maxTokens,
    timeoutMs: GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG.timeoutMs
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
  attempts: Array<{ attemptIndex: number }>;
};

function trackedProvider(input: {
  provider: AIProvider;
  caseId: string;
  stage: "semantic" | "visible";
  reservationId: string;
  initialAttemptIndex?: number;
}): StageTracker {
  const attempts: Array<{ attemptIndex: number }> = [];
  return {
    provider: {
      name: input.provider.name,
      complete: async (params) => {
        const attemptIndex = (input.initialAttemptIndex ?? 0) + attempts.length + 1;
        await mutateBudget((budget) => reserveGenerativeSemanticFrameV4FirstPassAttempt({
          budget,
          reservationId: input.reservationId,
          caseId: input.caseId,
          stage: input.stage,
          attemptIndex,
          reservedAt: new Date().toISOString()
        }));
        attempts.push({ attemptIndex });
        return input.provider.complete(params);
      },
      ...(input.provider.stream ? { stream: input.provider.stream.bind(input.provider) } : {}),
      ...(input.provider.embed ? { embed: input.provider.embed.bind(input.provider) } : {})
    },
    attempts
  };
}

async function settleStage(input: {
  tracker: StageTracker;
  caseId: string;
  stage: "semantic" | "visible";
  reservationId: string;
  passed: boolean;
  validationIssues: string[];
}) {
  for (const [index, tracked] of input.tracker.attempts.entries()) {
    const finalAttempt = index === input.tracker.attempts.length - 1;
    await mutateBudget((budget) => settleGenerativeSemanticFrameV4FirstPassAttempt({
      budget,
      reservationId: input.reservationId,
      caseId: input.caseId,
      stage: input.stage,
      attemptIndex: tracked.attemptIndex,
      outcome: input.passed && finalAttempt ? "valid" : "technical_failure",
      settledAt: new Date().toISOString(),
      errorCode: input.passed && finalAttempt
        ? null
        : input.validationIssues[0] ?? "TECHNICAL_STAGE_FAILURE"
    }));
  }
}

async function runCase(input: {
  caseItem: (typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES)[number];
  provider: AIProvider;
  reservationId: string;
}) {
  const startedAt = Date.now();
  const generationInput = createInput(input.caseItem);
  const semanticTracker = trackedProvider({
    provider: input.provider,
    caseId: input.caseItem.id,
    stage: "semantic",
    reservationId: input.reservationId
  });
  const semantic = await generateEventCenteredGenerativeSemanticPlanAI({
    ...generationInput,
    provider: semanticTracker.provider,
    onSemanticAttemptResult: async (result) => {
      const tracked = semanticTracker.attempts.find(
        (attempt) => attempt.attemptIndex === result.attemptIndex
      );
      if (!tracked) return;
      await mutateBudget((budget) => settleGenerativeSemanticFrameV4FirstPassAttempt({
        budget,
        reservationId: input.reservationId,
        caseId: input.caseItem.id,
        stage: "semantic",
        attemptIndex: tracked.attemptIndex,
        outcome: result.success ? "valid" : "technical_failure",
        settledAt: new Date().toISOString(),
        errorCode: result.success
          ? null
          : result.validationIssues[0] ?? "TECHNICAL_STAGE_FAILURE"
      }));
    }
  });

  let visible: EventCenteredGenerativeVisibleStageResult | null = null;
  const visibleAttemptDetails: unknown[] = [];
  const visibleValidationIssues: string[] = [];
  const visibleQualityDiagnostics: string[] = [];
  if (semantic.artifact) {
    for (let index = 0; index < 2; index += 1) {
      const visibleTracker = trackedProvider({
        provider: input.provider,
        caseId: input.caseItem.id,
        stage: "visible",
        reservationId: input.reservationId,
        initialAttemptIndex: index
      });
      const current = await generateEventCenteredGenerativeVisibleTurnAI({
        ...generationInput,
        provider: visibleTracker.provider,
        artifact: semantic.artifact
      });
      await settleStage({
        tracker: visibleTracker,
        caseId: input.caseItem.id,
        stage: "visible",
        reservationId: input.reservationId,
        passed: Boolean(current.turn),
        validationIssues: current.validationIssues
      });
      visibleAttemptDetails.push(...current.attempts);
      visibleValidationIssues.push(...current.validationIssues);
      visibleQualityDiagnostics.push(...current.qualityDiagnostics);
      visible = current;
      if (current.turn || visibleTracker.attempts.length === 0) break;
    }
  }
  return {
    caseId: input.caseItem.id,
    angle: input.caseItem.angle,
    mode: input.caseItem.mode,
    expected: {
      state: input.caseItem.expectedDecision.state,
      action: input.caseItem.expectedDecision.action,
      semanticFrame: input.caseItem.expectedSemanticFrame,
      questionIntent: input.caseItem.expectedQuestionIntent,
      limitReason: input.caseItem.expectedLimitReason,
      visibleQuality: input.caseItem.expectedVisibleQuality
    },
    input: {
      currentQuestion: input.caseItem.currentQuestion,
      currentUserText: input.caseItem.currentUserText,
      conversationContext: input.caseItem.conversationContext,
      evidenceCatalog: input.caseItem.evidenceCatalog
    },
    semantic: {
      artifact: semantic.artifact,
      technicalComplete: Boolean(semantic.artifact),
      validationIssues: semantic.validationIssues,
      qualityDiagnostics: semantic.qualityDiagnostics,
      attempts: semantic.attempts
    },
    visible: {
      turn: visible?.turn ?? null,
      technicalComplete: Boolean(visible?.turn),
      response: visible ? visibleResponse(visible) : null,
      thinkingSummary: visible?.turn?.visibleTurn.thinkingSummary ?? null,
      validationIssues: [...new Set(visibleValidationIssues)],
      qualityDiagnostics: [...new Set(visibleQualityDiagnostics)],
      attempts: visibleAttemptDetails
    },
    latencyMs: Date.now() - startedAt
  } satisfies CaseRun;
}

function requestUsage(budget: GenerativeSemanticFrameV4FirstPassBudget) {
  return budget.reservation
    ? {
        readOnlyModelsPreflightRequests: budget.reservation.preflightRequests,
        attempts: budget.reservation.attempts
      }
    : { readOnlyModelsPreflightRequests: 0, attempts: [] };
}

function formatReport(envelope: RunEnvelope) {
  const technicalComplete = envelope.runs.filter((run) =>
    run.semantic.technicalComplete && run.visible.technicalComplete
  ).length;
  const lines = [
    "# 板块 7｜Provider v71 语义骨架首轮六例运行报告",
    "",
    `- 运行时间：${envelope.createdAt}`,
    `- 数据集 / 案例指纹：${envelope.datasetVersion} / ${envelope.caseFingerprint}`,
    `- scopeFingerprint：${envelope.scopeFingerprint}`,
    `- 技术完整：${technicalComplete}/${envelope.runs.length}`,
    `- 请求：预检 ${String((envelope.requestUsage as { readOnlyModelsPreflightRequests: number }).readOnlyModelsPreflightRequests)} 次；生成 ${String((envelope.requestUsage as { attempts: unknown[] }).attempts.length)} 次`,
    `- 当前 gate：${envelope.gate}`,
    `- 停止原因：${envelope.stopReason ?? "六例已完成，等待双层 Codex 裁决"}`,
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
      `第一段：${JSON.stringify(run.semantic.artifact ?? { issues: run.semantic.validationIssues })}`,
      "",
      `用户可见思路：${run.visible.thinkingSummary ?? "（停止轮不展示）"}`,
      "",
      `用户可见回应：${run.visible.response ?? "（未生成）"}`,
      "",
      `技术状态：语义 ${run.semantic.technicalComplete ? "通过" : "失败"}；表达 ${run.visible.technicalComplete ? "通过" : "失败"}`,
      ""
    );
  }
  return lines.join("\n");
}

async function main() {
  const approval = validateGenerativeSemanticFrameV4FirstPassApproval(
    await readJson<unknown>(approvalPath)
  );
  const reservationId = randomUUID();
  let envelope: RunEnvelope | null = null;
  try {
    let budget = await mutateBudget((current) =>
      reserveGenerativeSemanticFrameV4FirstPassRun({
        budget: current,
        approval,
        reservationId,
        reservedAt: new Date().toISOString()
      })
    );
    const { config, provider } = frozenProvider();
    budget = await mutateBudget((current) =>
      reserveGenerativeSemanticFrameV4FirstPassPreflight({
        budget: current,
        reservationId
      })
    );
    await runGenerativeDeepSeekProviderPreflight({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model
    });
    const runs: CaseRun[] = [];
    for (const caseItem of GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES) {
      const run = await runCase({ caseItem, provider, reservationId });
      runs.push(run);
      const currentBudget = parseGenerativeSemanticFrameV4FirstPassBudget(
        await readJson<unknown>(budgetPath)
      );
      const partial: RunEnvelope = {
        evaluation: "board7_provider_v71_semantic_frame_first_pass",
        datasetVersion: currentBudget.datasetVersion,
        caseFingerprint: currentBudget.caseFingerprint,
        scopeFingerprint: currentBudget.scopeFingerprint,
        candidateVersions: currentBudget.candidateVersions,
        runtimeConfig: currentBudget.runtimeConfig,
        reservationId,
        approvalPath,
        createdAt: (approval as { approvedAt: string }).approvedAt,
        completedAt: null,
        runs: [...runs],
        requestUsage: requestUsage(currentBudget),
        gate: "pending_codex_review",
        stopReason: null
      };
      await writeJson(checkpointPath, partial);
      if (!run.semantic.technicalComplete || !run.visible.technicalComplete) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_TECHNICAL_STOP:${caseItem.id}`);
      }
    }
    const currentBudget = parseGenerativeSemanticFrameV4FirstPassBudget(
      await readJson<unknown>(budgetPath)
    );
    envelope = {
      evaluation: "board7_provider_v71_semantic_frame_first_pass",
      datasetVersion: currentBudget.datasetVersion,
      caseFingerprint: currentBudget.caseFingerprint,
      scopeFingerprint: currentBudget.scopeFingerprint,
      candidateVersions: currentBudget.candidateVersions,
      runtimeConfig: currentBudget.runtimeConfig,
      reservationId,
      approvalPath,
      createdAt: (approval as { approvedAt: string }).approvedAt,
      completedAt: new Date().toISOString(),
      runs,
      requestUsage: requestUsage(currentBudget),
      gate: "pending_codex_review",
      stopReason: "六例已完成，等待双层 Codex 裁决"
    };
    const fingerprint = createHash("sha256").update(JSON.stringify(envelope)).digest("hex");
    budget = await mutateBudget((current) => completeGenerativeSemanticFrameV4FirstPassRun({
      budget: current,
      reservationId,
      completedAt: envelope!.completedAt!,
      runEnvelopeFingerprint: fingerprint
    }));
    envelope.requestUsage = requestUsage(budget);
    await writeJson(outputPath, envelope);
    await writeFile(reportPath, `${formatReport(envelope)}\n`, "utf8");
    console.log(JSON.stringify({ outputPath, reportPath, reservationId, fingerprint }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_V71_FIRST_PASS_ERROR";
    await mutateBudget((current) => abortGenerativeSemanticFrameV4FirstPassRun({
      budget: current,
      reservationId,
      completedAt: new Date().toISOString(),
      error: message
    })).catch(() => undefined);
    if (envelope) {
      envelope.gate = "technical_stop";
      envelope.stopReason = message;
      envelope.completedAt = new Date().toISOString();
      await writeJson(checkpointPath, envelope);
    }
    throw error;
  }
}

void main();
