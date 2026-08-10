import { createHash, randomUUID } from "node:crypto";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAICompletionTokenUsage,
  sanitizeAIProviderDiagnostics,
  takeAIReasoningOnlyContinuation,
  type AICompletionParams,
  type AIProvider
} from "@/server/services/ai/ai-provider";
import {
  assessExplicitStopFromControlDecision,
  decideInterviewControlV2,
  type InterviewControlDecisionV2
} from "@/features/interview/intent/control-decision-v2";
import {
  GI088_ACTIVE_BRANCHES,
  GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY,
  GI088_CONFIGS,
  GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION,
  GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION_VERSION,
  GI088_EMPTY_CONTENT_RECOVERY_POLICY,
  GI088_EVALUATION_ID,
  GI088_EVALUATION_ID_V1,
  GI088_EVALUATION_ID_V2,
  GI088_EVALUATION_ID_V3,
  GI088_EVALUATION_ID_V4,
  GI088_EVALUATION_ID_V5,
  GI088_EVALUATION_ID_V6,
  GI088_EVALUATION_ID_V7,
  GI088_EVALUATION_ID_V7R1,
  GI088_EVALUATION_ID_V7R2,
  GI088_EVALUATION_ID_V7R3,
  GI088_EVALUATION_ID_V7R4,
  GI088_EVALUATION_ID_V8,
  GI088_EVALUATION_ID_V8R1,
  GI088_EVALUATION_MODE,
  GI088_EVALUATION_VERSION,
  GI088_EVALUATION_VERSION_V1,
  GI088_EVALUATION_VERSION_V2,
  GI088_EVALUATION_VERSION_V3,
  GI088_EVALUATION_VERSION_V4,
  GI088_EVALUATION_VERSION_V5,
  GI088_EVALUATION_VERSION_V6,
  GI088_EVALUATION_VERSION_V7,
  GI088_EVALUATION_VERSION_V7R1,
  GI088_EVALUATION_VERSION_V7R2,
  GI088_EVALUATION_VERSION_V7R3,
  GI088_EVALUATION_VERSION_V7R4,
  GI088_EVALUATION_VERSION_V8,
  GI088_EVALUATION_VERSION_V8R1,
  GI088_FIXED_OPENING,
  GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION,
  GI088_SERVICE_VERSION_V1,
  GI088_SERVICE_VERSION_V2,
  GI088_SERVICE_VERSION_V3,
  GI088_SERVICE_VERSION_V4,
  GI088_SERVICE_VERSION_V5,
  GI088_SERVICE_VERSION_V6,
  GI088_SERVICE_VERSION_V7,
  GI088_SERVICE_VERSION_V7R1,
  GI088_SERVICE_VERSION_V7R2,
  GI088_SERVICE_VERSION_V7R3,
  GI088_SERVICE_VERSION_V7R4,
  GI088_SERVICE_VERSION_V8,
  GI088_SERVICE_VERSION_V8R1,
  GI088_SHARED_RECOVERY_DEADLINE_POLICY,
  GI088_TASKS,
  GI088_TIMEOUT_POLICY,
  GI088_TIMEOUT_RECOVERY_POLICY,
  GI088_V5_TASKS,
  GI088_V6_TASKS,
  GI088_V8R1_TASKS,
  createGi088DatasetFingerprint,
  createGi088EffectiveCandidateFingerprint,
  createGi088ExecutionFingerprint,
  createGi088FingerprintBundle,
  getGi088CandidateAssets,
  type Gi088EvaluationTaskDefinition
} from "@/server/services/evaluation/gi088/candidate";
import {
  GI088_DETERMINISTIC_STATE_POLICY_VERSION,
  createGi088DeterministicPauseOutput,
  normalizeGi088DeterministicStateOutput
} from "@/server/services/evaluation/gi088/deterministic-state";
import {
  Gi088EvaluationError
} from "@/server/services/evaluation/gi088/errors";
import {
  createGi088ExportEnvelope,
  sanitizeGi088ExportPayload,
  type Gi088ExportEnvelope,
  type Gi088ExportJsonValue
} from "@/server/services/evaluation/gi088/export-v06";
import {
  createGi088FoundationPayloadHash,
  type Gi088EvaluationFoundationStore,
  type Gi088FoundationCallRecord,
  type Gi088FoundationJson,
  type Gi088FoundationOperationIdentity,
  type Gi088FoundationProgramInterventionRecord,
  type Gi088FoundationRunRecord
} from "@/server/services/evaluation/gi088/foundation-store";
import {
  calculateGi088EvaluationMetrics
} from "@/server/services/evaluation/gi088/metrics";
import { createGi088ProProvider } from "@/server/services/evaluation/gi088/pro-runtime";
import { createGi088OutputSchemaIssues } from "@/server/services/evaluation/gi088/schema-diagnostics";
import {
  applyGi088SemanticDeltaValidatedResult,
  assertGi088SemanticDeltaOutput,
  parseGi088SemanticDeltaCandidateOutput,
  renderGi088SemanticDeltaVisible,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput,
  type Gi088SemanticDeltaOutput
} from "@/server/services/evaluation/gi088/semantic-delta";
import { createGi088QuestionObservation } from "@/server/services/evaluation/gi088/single-focus";
import {
  GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION,
  GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION_VERSION,
  createGi088StageTransitionUserPrompt,
  validateGi088StageTransitionOutput
} from "@/server/services/evaluation/gi088/stage-transition";
import type {
  Gi088BatchState,
  Gi088BranchKey,
  Gi088Call,
  Gi088CallEffectiveConfig,
  Gi088EarlyStopReasonCode,
  Gi088GateReason,
  Gi088GateStatus,
  Gi088Message,
  Gi088ProgramIntervention,
  Gi088PublicSession,
  Gi088QuestionReviewClassification,
  Gi088RecoveryTrigger,
  Gi088ReviewRevision,
  Gi088TargetTrigger,
  Gi088TaskState,
  Gi088Trajectory,
  Gi088TrajectoryReview,
  Gi088Turn
} from "@/server/services/evaluation/gi088/types";
import { requireGi088ModelCallAuthorization } from "@/server/services/evaluation/gi088/access";

export const GI088_FOUNDATION_SERVICE_VERSION =
  "2026-08-10.gi088-evaluation-foundation-service-v8r2" as const;

const RESULT_PERSISTENCE_BACKOFF_MS = [250, 500, 1_000] as const;
const MAX_FINALIZER_CAS_ATTEMPTS = 5;
const CALL_SETTLEMENT_GRACE_MS = 5_000;

export type Gi088FoundationExecutionEvent =
  | {
      type: "turn_reserved";
      turnId: string;
      callId: string | null;
    }
  | {
      type: "provider_started";
      turnId: string;
      callId: string;
    }
  | {
      type: "heartbeat";
      turnId: string;
      callId: string;
      elapsedMs: number;
    }
  | {
      type: "recovery_started";
      trigger: Gi088RecoveryTrigger;
      turnId: string;
      callId: string;
    };

type FoundationServiceDependencies = {
  store: Gi088EvaluationFoundationStore;
  getProvider?: () => AIProvider | Promise<AIProvider>;
  authorizeModelCall?: (branch: Gi088BranchKey) => void;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
};

function defaultProvider() {
  return createGi088ProProvider(process.env);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function json<T>(value: T): Gi088FoundationJson {
  return JSON.parse(JSON.stringify(value)) as Gi088FoundationJson;
}

function dateIso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function createEmptyTrajectory(branch: Gi088BranchKey): Gi088Trajectory {
  return {
    id: randomUUID(),
    branch,
    status: "not_started",
    messages: [],
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState(),
    turns: [],
    pendingTurnId: null,
    technicalError: null,
    review: null,
    startedAt: null,
    completedAt: null,
    abortedAt: null,
    abortReason: null
  };
}

function createInitialState(now: Date, runId: string): Gi088BatchState {
  const timestamp = now.toISOString();
  return {
    batchId: runId,
    evaluationMode: GI088_EVALUATION_MODE,
    status: "running",
    activeTaskId: null,
    tasks: GI088_TASKS.map((task) => ({
      taskId: task.id,
      initialUserMessage: null,
      activeBranch: "high",
      branches: {
        off: createEmptyTrajectory("off"),
        high: createEmptyTrajectory("high")
      },
      comparison: null,
      aborted: null
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
    sealedAt: null,
    earlyStop: null
  };
}

function parseState(run: Gi088FoundationRunRecord): Gi088BatchState {
  return run.state as unknown as Gi088BatchState;
}

function taskState(state: Gi088BatchState, taskId: string) {
  const task = state.tasks.find((item) => item.taskId === taskId);
  if (!task) throw new Gi088EvaluationError("GI088_TASK_STATE_NOT_FOUND");
  return task;
}

type Gi088EvaluationVersionMetadata = {
  id: string;
  serviceVersion: string;
  model: string;
};

const GI088_HISTORICAL_EVALUATION_METADATA = {
  [GI088_EVALUATION_VERSION_V1]: {
    id: GI088_EVALUATION_ID_V1,
    serviceVersion: GI088_SERVICE_VERSION_V1,
    model: "deepseek-v4-flash"
  },
  [GI088_EVALUATION_VERSION_V2]: {
    id: GI088_EVALUATION_ID_V2,
    serviceVersion: GI088_SERVICE_VERSION_V2,
    model: "deepseek-v4-flash"
  },
  [GI088_EVALUATION_VERSION_V3]: {
    id: GI088_EVALUATION_ID_V3,
    serviceVersion: GI088_SERVICE_VERSION_V3,
    model: "deepseek-v4-flash"
  },
  [GI088_EVALUATION_VERSION_V4]: {
    id: GI088_EVALUATION_ID_V4,
    serviceVersion: GI088_SERVICE_VERSION_V4,
    model: "deepseek-v4-flash"
  },
  [GI088_EVALUATION_VERSION_V5]: {
    id: GI088_EVALUATION_ID_V5,
    serviceVersion: GI088_SERVICE_VERSION_V5,
    model: "deepseek-v4-flash"
  },
  [GI088_EVALUATION_VERSION_V6]: {
    id: GI088_EVALUATION_ID_V6,
    serviceVersion: GI088_SERVICE_VERSION_V6,
    model: "deepseek-v4-flash"
  },
  [GI088_EVALUATION_VERSION_V7]: {
    id: GI088_EVALUATION_ID_V7,
    serviceVersion: GI088_SERVICE_VERSION_V7,
    model: "deepseek-v4-flash"
  },
  [GI088_EVALUATION_VERSION_V7R1]: {
    id: GI088_EVALUATION_ID_V7R1,
    serviceVersion: GI088_SERVICE_VERSION_V7R1,
    model: "deepseek-v4-flash"
  },
  [GI088_EVALUATION_VERSION_V7R2]: {
    id: GI088_EVALUATION_ID_V7R2,
    serviceVersion: GI088_SERVICE_VERSION_V7R2,
    model: "deepseek-v4-flash-ga-260731"
  },
  [GI088_EVALUATION_VERSION_V7R3]: {
    id: GI088_EVALUATION_ID_V7R3,
    serviceVersion: GI088_SERVICE_VERSION_V7R3,
    model: "deepseek-v4-flash-ga-260731"
  },
  [GI088_EVALUATION_VERSION_V7R4]: {
    id: GI088_EVALUATION_ID_V7R4,
    serviceVersion: GI088_SERVICE_VERSION_V7R4,
    model: "deepseek-v4-pro"
  },
  [GI088_EVALUATION_VERSION_V8]: {
    id: GI088_EVALUATION_ID_V8,
    serviceVersion: GI088_SERVICE_VERSION_V8,
    model: "deepseek-v4-pro"
  },
  [GI088_EVALUATION_VERSION_V8R1]: {
    id: GI088_EVALUATION_ID_V8R1,
    serviceVersion: GI088_SERVICE_VERSION_V8R1,
    model: "deepseek-v4-pro"
  }
} as const satisfies Readonly<Record<string, Gi088EvaluationVersionMetadata>>;

function evaluationMetadataFor(
  evaluationVersion: string
): Gi088EvaluationVersionMetadata {
  if (evaluationVersion === GI088_EVALUATION_VERSION) {
    return {
      id: GI088_EVALUATION_ID,
      serviceVersion: GI088_FOUNDATION_SERVICE_VERSION,
      model: GI088_CONFIGS.high.model
    };
  }
  const historical = GI088_HISTORICAL_EVALUATION_METADATA[
    evaluationVersion as keyof typeof GI088_HISTORICAL_EVALUATION_METADATA
  ];
  if (historical) return historical;
  return {
    id: `gi088_historical:${evaluationVersion}`,
    serviceVersion: `gi088_historical:${evaluationVersion}`,
    model: "historical_unknown"
  };
}

function immutableTaskPackageFor(evaluationVersion: string) {
  if (evaluationVersion === GI088_EVALUATION_VERSION) return GI088_TASKS;
  if (evaluationVersion === GI088_EVALUATION_VERSION_V8R1) {
    return GI088_V8R1_TASKS;
  }
  if (evaluationVersion === GI088_EVALUATION_VERSION_V8) {
    return GI088_V8R1_TASKS.slice(0, 4);
  }
  if (evaluationVersion === GI088_EVALUATION_VERSION_V6) {
    return GI088_V6_TASKS;
  }
  if (
    evaluationVersion === GI088_EVALUATION_VERSION_V4 ||
    evaluationVersion === GI088_EVALUATION_VERSION_V5
  ) {
    return GI088_V5_TASKS;
  }
  return [];
}

function storedHistoricalTaskDefinition(
  evaluationVersion: string,
  taskId: string
): Gi088EvaluationTaskDefinition {
  const repeated = taskId.match(/^(.+)-R$/u)?.[1] ?? null;
  return {
    id: taskId,
    capabilityId: `historical:${evaluationVersion}:${taskId}`,
    title: `历史任务 ${taskId}`,
    instruction: "按该历史运行已经保存的任务顺序只读查看证据。",
    targetTriggerPrompt: "历史任务说明以该版本的原始资产和已保存证据为准。",
    criterion: "保留并查看历史对话、调用、状态和人工评价的原始记录。",
    repeatOf: repeated
  };
}

function taskDefinitionsFor(
  evaluationVersion: string,
  state?: Gi088BatchState,
  includeCurrentVersionPackage = true
): readonly Gi088EvaluationTaskDefinition[] {
  const immutablePackage =
    evaluationVersion === GI088_EVALUATION_VERSION &&
    !includeCurrentVersionPackage
      ? []
      : immutableTaskPackageFor(evaluationVersion);
  if (!state) return immutablePackage;
  const immutableById = new Map<string, Gi088EvaluationTaskDefinition>(
    immutablePackage.map((definition) => [definition.id, definition] as const)
  );
  return state.tasks.map(
    (task) => immutableById.get(task.taskId) ??
      storedHistoricalTaskDefinition(evaluationVersion, task.taskId)
  );
}

function taskDefinition(evaluationVersion: string, taskId: string) {
  const definition = taskDefinitionsFor(evaluationVersion).find(
    (item) => item.id === taskId
  );
  if (!definition) throw new Gi088EvaluationError("GI088_TASK_NOT_FOUND");
  return definition;
}

function historicalMaximumProviderCallsPerTrajectory(
  evaluationVersion: string
) {
  return [
    GI088_EVALUATION_VERSION_V1,
    GI088_EVALUATION_VERSION_V2,
    GI088_EVALUATION_VERSION_V3,
    GI088_EVALUATION_VERSION_V4,
    GI088_EVALUATION_VERSION_V5,
    GI088_EVALUATION_VERSION_V6
  ].includes(evaluationVersion as typeof GI088_EVALUATION_VERSION_V1)
    ? 12
    : null;
}

function historicalRecoveryLimits(evaluationVersion: string) {
  const emptyContent = [
    GI088_EVALUATION_VERSION_V3,
    GI088_EVALUATION_VERSION_V4,
    GI088_EVALUATION_VERSION_V5,
    GI088_EVALUATION_VERSION_V6,
    GI088_EVALUATION_VERSION_V7,
    GI088_EVALUATION_VERSION_V7R1,
    GI088_EVALUATION_VERSION_V7R2,
    GI088_EVALUATION_VERSION_V7R3,
    GI088_EVALUATION_VERSION_V7R4,
    GI088_EVALUATION_VERSION_V8,
    GI088_EVALUATION_VERSION_V8R1
  ].includes(evaluationVersion as typeof GI088_EVALUATION_VERSION_V3)
    ? 1
    : 0;
  const stageTransition = [
    GI088_EVALUATION_VERSION_V4,
    GI088_EVALUATION_VERSION_V5,
    GI088_EVALUATION_VERSION_V6,
    GI088_EVALUATION_VERSION_V7,
    GI088_EVALUATION_VERSION_V7R1,
    GI088_EVALUATION_VERSION_V7R2,
    GI088_EVALUATION_VERSION_V7R3,
    GI088_EVALUATION_VERSION_V7R4,
    GI088_EVALUATION_VERSION_V8,
    GI088_EVALUATION_VERSION_V8R1
  ].includes(evaluationVersion as typeof GI088_EVALUATION_VERSION_V4)
    ? 1
    : 0;
  const automaticTechnicalRecovery = [
    GI088_EVALUATION_VERSION_V5,
    GI088_EVALUATION_VERSION_V6,
    GI088_EVALUATION_VERSION_V7,
    GI088_EVALUATION_VERSION_V7R1,
    GI088_EVALUATION_VERSION_V7R2,
    GI088_EVALUATION_VERSION_V7R3,
    GI088_EVALUATION_VERSION_V7R4,
    GI088_EVALUATION_VERSION_V8,
    GI088_EVALUATION_VERSION_V8R1
  ].includes(evaluationVersion as typeof GI088_EVALUATION_VERSION_V5);
  return {
    automaticEmptyContentRetries: emptyContent,
    automaticStageTransitionRetries: stageTransition,
    automaticSingleQuestionRetries:
      evaluationVersion === GI088_EVALUATION_VERSION_V5 ? 1 : 0,
    automaticTechnicalRetries: automaticTechnicalRecovery ? 1 : 0
  };
}

function historicalCallToPublic(call: Gi088Call): Gi088Call {
  const safeDiagnostics = sanitizeAIProviderDiagnostics(
    call.providerDiagnostics
  );
  const publicDiagnostics = safeDiagnostics
    ? Object.fromEntries(
        Object.entries(safeDiagnostics).filter(
          ([key]) => key !== "upstreamRequestId"
        )
      ) as Gi088Call["providerDiagnostics"]
    : null;
  return sanitizeGi088ExportPayload({
    id: call.id,
    attempt: call.attempt,
    kind: call.kind,
    status: call.status,
    startedAt: call.startedAt,
    completedAt: call.completedAt,
    requestHash: call.requestHash,
    responseHash: call.responseHash,
    rawFinalOutput: null,
    latencyMs: call.latencyMs,
    tokenUsage: sanitizeAICompletionTokenUsage(call.tokenUsage),
    providerDiagnostics: publicDiagnostics,
    errorCode: call.errorCode,
    parentCallId: call.parentCallId,
    retryTrigger: call.retryTrigger,
    retryOrdinal: call.retryOrdinal,
    effectiveConfig: call.effectiveConfig,
    ...(call.ledgerStatus ? { ledgerStatus: call.ledgerStatus } : {}),
    ...(call.executionDeadlineAt !== undefined
      ? { executionDeadlineAt: call.executionDeadlineAt }
      : {}),
    ...(call.automaticDeadlineAt !== undefined
      ? { automaticDeadlineAt: call.automaticDeadlineAt }
      : {}),
    ...(call.finalizationError !== undefined
      ? { finalizationError: call.finalizationError }
      : {})
  }) as unknown as Gi088Call;
}

function historicalTrajectoryConfig(
  evaluationVersion: string,
  trajectory: Gi088Trajectory,
  ledgerCalls: Gi088FoundationCallRecord[] = []
) {
  const historicalCalls = trajectory.turns.flatMap((turn) => turn.calls);
  const embeddedEffectiveConfig = [...historicalCalls]
    .reverse()
    .find((call) => call.effectiveConfig)?.effectiveConfig;
  const ledgerEffectiveConfig = [...ledgerCalls]
    .reverse()
    .find((call) => call.effectiveConfig)?.effectiveConfig as unknown as
      | Gi088CallEffectiveConfig
      | undefined;
  const effectiveConfig = ledgerEffectiveConfig ?? embeddedEffectiveConfig;
  const maximumProviderCallsPerTrajectory =
    historicalMaximumProviderCallsPerTrajectory(evaluationVersion);
  const providerCallsUsed = ledgerCalls.length > 0
    ? ledgerCalls.filter((call) => call.dispatchedAt).length
    : historicalCalls.length;
  const retryLimits = historicalRecoveryLimits(evaluationVersion);
  const thinking = effectiveConfig?.thinking ??
    (trajectory.branch === "high" ? "enabled" : "disabled");
  const reasoningEffort = effectiveConfig?.reasoningEffort ??
    (thinking === "enabled" ? "high" : null);
  const temperature = effectiveConfig?.temperature ??
    (thinking === "disabled" ? 0.2 : null);
  return {
    key: trajectory.branch,
    label: thinking === "enabled" ? "Thinking 开启 · high" : "Thinking 关闭",
    thinking,
    temperature,
    effectiveTemperature: temperature,
    reasoningEffort,
    ...retryLimits,
    providerCallsUsed,
    providerCallsRemaining: maximumProviderCallsPerTrajectory === null
      ? null
      : Math.max(0, maximumProviderCallsPerTrajectory - providerCallsUsed),
    maximumProviderCallsPerTrajectory
  };
}

function historicalExportConfig(
  state: Gi088BatchState,
  metadata: Gi088EvaluationVersionMetadata,
  ledgerCalls: Gi088FoundationCallRecord[] = []
) {
  const latestLedgerConfig = [...ledgerCalls]
    .reverse()
    .find((call) => call.effectiveConfig)?.effectiveConfig as
      | Gi088CallEffectiveConfig
      | undefined;
  const latestCall = state.tasks
    .flatMap((task) => [task.branches.off, task.branches.high])
    .flatMap((trajectory) => trajectory.turns)
    .flatMap((turn) => turn.calls)
    .reverse()
    .find((call) => call.effectiveConfig);
  return {
    model: metadata.model,
    ...(latestLedgerConfig ?? latestCall?.effectiveConfig ?? {})
  };
}

function trajectoryComplete(trajectory: Gi088Trajectory) {
  return trajectory.status === "completed" && Boolean(trajectory.review);
}

function taskCompleted(task: Gi088TaskState) {
  return trajectoryComplete(task.branches.high);
}

function taskCompletedFor(state: Gi088BatchState, task: Gi088TaskState) {
  if ((state.evaluationMode ?? "paired") === "paired") {
    return trajectoryComplete(task.branches.off) &&
      trajectoryComplete(task.branches.high) &&
      task.comparison !== null;
  }
  return taskCompleted(task);
}

function taskAborted(task: Gi088TaskState) {
  return Boolean(task.aborted) || task.branches.high.status === "aborted";
}

function firstOpenTaskId(state: Gi088BatchState) {
  return state.tasks.find((task) => !taskCompletedFor(state, task) && !taskAborted(task))
    ?.taskId ?? null;
}

function publicTaskStatus(
  state: Gi088BatchState,
  task: Gi088TaskState
): "ready" | "locked" | "active" | "completed" | "aborted" | "not_run" {
  if (taskCompletedFor(state, task)) return "completed";
  if (taskAborted(task)) return "aborted";
  if (state.status === "early_stopped") return "not_run";
  if (state.activeTaskId === task.taskId) return "active";
  return firstOpenTaskId(state) === task.taskId ? "ready" : "locked";
}

function lastAssistantMessage(trajectory: Gi088Trajectory) {
  return [...trajectory.messages]
    .reverse()
    .find((message) => message.role === "assistant") ?? null;
}

function lastCommittedTurnId(trajectory: Gi088Trajectory) {
  return [...trajectory.turns]
    .reverse()
    .find((turn) => turn.semanticStateAfter !== null)?.id ?? null;
}

function createDialogueAnchor(trajectory: Gi088Trajectory) {
  return {
    lastAssistantMessageId: lastAssistantMessage(trajectory)?.id ?? null,
    lastCommittedTurnId: lastCommittedTurnId(trajectory)
  };
}

function observationFingerprint(input: {
  turnId: string;
  assistantMessageId: string;
  visibleText: string;
  questionMarkCount: number;
}) {
  return createGi088FoundationPayloadHash(json(input));
}

function reviewSnapshotFingerprint(input: {
  runId: string;
  taskId: string;
  branch: Gi088BranchKey;
  trajectory: Gi088Trajectory;
  interventions: Gi088FoundationProgramInterventionRecord[];
}) {
  return createGi088FoundationPayloadHash(json({
    runId: input.runId,
    taskId: input.taskId,
    branch: input.branch,
    messages: input.trajectory.messages,
    turns: input.trajectory.turns.map((turn) => ({
      id: turn.id,
      status: turn.status,
      visibleText: turn.visibleText,
      questionObservation: turn.questionObservation
    })),
    interventions: input.interventions
      .filter(
        (item) =>
          item.taskId === input.taskId && item.branch === input.branch
      )
      .map((item) => ({
        id: item.id,
        observationFingerprint: item.observationFingerprint,
        reviewOutcome: item.reviewOutcome,
        reviewReason: item.reviewReason
      }))
  }));
}

function operationIdentity(input: {
  ownerUserId: string;
  evaluationVersion: string;
  runId: string | null;
  clientOperationId: string;
  action: string;
  payload: unknown;
}): Gi088FoundationOperationIdentity {
  return {
    ownerUserId: input.ownerUserId,
    evaluationVersion: input.evaluationVersion,
    runId: input.runId,
    clientOperationId: input.clientOperationId,
    action: input.action,
    payloadHash: createGi088FoundationPayloadHash(json(input.payload))
  };
}

function callToPublic(call: Gi088FoundationCallRecord): Gi088Call {
  const effectiveConfig = call.effectiveConfig as unknown as Gi088CallEffectiveConfig;
  const safeDiagnostics = sanitizeAIProviderDiagnostics(
    call.providerDiagnostics
  );
  const publicDiagnostics = safeDiagnostics
    ? Object.fromEntries(
        Object.entries(safeDiagnostics).filter(
          ([key]) => key !== "upstreamRequestId"
        )
      ) as Gi088Call["providerDiagnostics"]
    : null;
  const latencyMs = safeDiagnostics?.latencyMs ?? null;
  const legacyStatus = call.status === "finalized"
    ? call.providerResultStatus === "provider_succeeded"
      ? "valid"
      : "technical_failure"
    : call.status === "provider_failed" ||
        call.status === "interrupted_unknown_dispatch"
      ? "technical_failure"
      : call.status === "finalization_failed" || call.status === "superseded"
        ? "protected_failure"
        : "processing";
  return {
    id: call.callId,
    attempt: call.attempt,
    kind: call.kind as Gi088Call["kind"],
    status: legacyStatus,
    startedAt: (call.dispatchedAt ?? call.reservedAt).toISOString(),
    completedAt: dateIso(call.finalizedAt ?? call.providerCompletedAt),
    requestHash: call.requestHash,
    responseHash: call.responseHash,
    rawFinalOutput: null,
    latencyMs,
    tokenUsage: call.tokenUsage as Gi088Call["tokenUsage"],
    providerDiagnostics: publicDiagnostics,
    errorCode: call.errorCode,
    parentCallId: call.parentCallId,
    retryTrigger: call.retryTrigger as Gi088RecoveryTrigger | null,
    retryOrdinal: call.attempt > 1 ? call.attempt - 1 : null,
    effectiveConfig,
    ledgerStatus: call.status,
    executionDeadlineAt: dateIso(call.executionDeadlineAt),
    automaticDeadlineAt: dateIso(call.automaticDeadlineAt),
    finalizationError: call.finalizationError
  };
}

function interventionToPublic(
  value: Gi088FoundationProgramInterventionRecord
): Gi088ProgramIntervention {
  return {
    id: value.id,
    taskId: value.taskId,
    branch: value.branch as Gi088BranchKey,
    turnId: value.turnId,
    callId: value.callId,
    interventionType: value.interventionType,
    originalAction: value.originalAction,
    effectiveAction: value.effectiveAction,
    evidenceSpan: value.evidenceSpan,
    observationFingerprint: value.observationFingerprint,
    reviewOutcome: value.reviewOutcome,
    reviewReason: value.reviewReason,
    reviewedAt: dateIso(value.reviewedAt),
    createdAt: value.createdAt.toISOString()
  };
}

function stateForMetrics(state: Gi088BatchState) {
  return state.tasks.map((task) => ({
    ...task,
    status: publicTaskStatus(state, task)
  }));
}

function metricsFor(input: {
  state: Gi088BatchState;
  calls: Gi088FoundationCallRecord[];
  interventions: Gi088FoundationProgramInterventionRecord[];
}) {
  return calculateGi088EvaluationMetrics({
    tasks: stateForMetrics(input.state),
    callLedger: input.calls.map((call) => ({
      id: call.callId,
      callId: call.callId,
      turnId: call.turnId,
      attempt: call.attempt,
      kind: call.kind,
      status: call.status,
      providerResultStatus: call.providerResultStatus,
      parentCallId: call.parentCallId,
      reservedAt: call.reservedAt,
      dispatchedAt: dateIso(call.dispatchedAt),
      providerCompletedAt: call.providerCompletedAt,
      finalizedAt: call.finalizedAt,
      executionDeadlineAt: call.executionDeadlineAt,
      automaticDeadlineAt: call.automaticDeadlineAt,
      responseHash: call.responseHash,
      errorCode: call.errorCode,
      failedOutputDiagnostic:
        call.errorCode === "MODEL_OUTPUT_PROTECTED" ||
        call.errorCode === "UNAUTHORIZED_PAUSE"
          ? { errorCode: call.errorCode }
          : null
    })),
    programInterventions: input.interventions.map((item) => ({
      id: item.id,
      reviewOutcome: item.reviewOutcome
    }))
  });
}

function existingGateReasons(run: Gi088FoundationRunRecord) {
  return Array.isArray(run.gateReasons)
    ? (run.gateReasons as unknown as Gi088GateReason[])
    : [];
}

function gateFor(input: {
  run: Gi088FoundationRunRecord;
  state: Gi088BatchState;
  calls: Gi088FoundationCallRecord[];
  interventions: Gi088FoundationProgramInterventionRecord[];
  now: Date;
}) {
  if (
    input.run.status !== "running" ||
    input.run.evaluationVersion !== GI088_EVALUATION_VERSION
  ) {
    return {
      status: input.run.gateStatus as Gi088GateStatus,
      reasons: existingGateReasons(input.run)
    };
  }
  const metrics = metricsFor(input);
  const previous = new Map(
    existingGateReasons(input.run).map((reason) => [
      `${reason.code}:${reason.sourceId}`,
      reason
    ])
  );
  const reasons: Gi088GateReason[] = [];
  const add = (
    code: Gi088GateReason["code"],
    sourceType: Gi088GateReason["sourceType"],
    sourceId: string,
    detail: string
  ) => {
    const key = `${code}:${sourceId}`;
    reasons.push(previous.get(key) ?? {
      code,
      sourceType,
      sourceId,
      detail,
      createdAt: input.now.toISOString()
    });
  };

  for (const task of input.state.tasks) {
    const trajectory = task.branches.high;
    if (taskAborted(task)) {
      add(
        "aborted_with_partial_evidence",
        "technical_fact",
        task.taskId,
        "当前项保留部分证据后安全终止"
      );
    }
    if (trajectory.review?.quality === "quality_failure") {
      add("quality_failure", "current_human_conclusion", trajectory.id, "轨迹评价为质量失败");
    }
    if (trajectory.review?.quality === "single_case_blocker") {
      add("single_case_blocker", "current_human_conclusion", trajectory.id, "轨迹评价为单例阻断");
    }
    if (trajectory.review?.targetTrigger === "not_triggered") {
      add("target_not_triggered", "current_human_conclusion", trajectory.id, "目标未触发");
    }
    for (const turn of trajectory.turns) {
      if (turn.status === "protected_failure" || turn.failedOutputDiagnostic) {
        add("protected_failure", "technical_fact", turn.id, "模型结果触发程序保护");
      }
      const review = turn.questionObservation?.review;
      if (review?.classification === "multiple_independent_tasks") {
        add("multiple_independent_tasks", "current_human_conclusion", turn.id, "可见提问包含多个独立任务");
      }
    }
  }
  if (metrics.finalFailureCount > 0) {
    for (const task of input.state.tasks) {
      for (const turn of task.branches.high.turns.filter(
        (item) =>
          !item.semanticStateAfter &&
          (item.status === "technical_failure" ||
            item.status === "protected_failure")
      )) {
        add("final_technical_failure", "technical_fact", turn.id, "当前提交最终未形成可见回答");
      }
    }
  }
  if (metrics.duplicateMessageCount > 0) {
    add("duplicate_message", "technical_fact", input.run.id, "检测到同一原话重复提交为多条消息");
  }
  if (metrics.manualThirdGenerationCount > 0) {
    add("manual_third_generation", "technical_fact", input.run.id, "使用了人工第三次生成");
  }
  for (const item of input.interventions) {
    if (item.reviewOutcome === "false_positive") {
      add("program_intervention_false_positive", "current_human_conclusion", item.id, "程序介入复核为误接管");
    }
  }

  if (reasons.length > 0) return { status: "no_go" as const, reasons };

  const facts = metrics.gateFacts;
  const allTasksComplete = facts.completedTaskCount === GI088_TASKS.length;
  const qualityReady =
    facts.targetTriggeredTrajectoryCount === GI088_TASKS.length &&
    facts.directUseCount >= 9 &&
    facts.minorIssueCount <= 3 &&
    facts.qualityFailureCount === 0 &&
    facts.singleCaseBlockerCount === 0;
  const reliabilityReady =
    metrics.firstVisibleSuccessRate !== null &&
    metrics.firstVisibleSuccessRate >= 0.9 &&
    facts.automaticRecoveryAttemptCount <= 1 &&
    metrics.consecutiveRecoveryCount === 0 &&
    facts.emptyContentEventCount === 0;
  const reviewReady =
    facts.allVisibleQuestionsReviewed &&
    facts.allProgramInterventionsReviewed &&
    facts.visibleQuestionUncertainCount === 0 &&
    facts.programInterventionUncertainCount === 0;
  return {
    status:
      allTasksComplete && qualityReady && reliabilityReady && reviewReady
        ? ("ready_for_final_review" as const)
        : ("pending" as const),
    reasons: []
  };
}

export class Gi088EvaluationFoundationService {
  private readonly store: Gi088EvaluationFoundationStore;
  private readonly getProvider: () => AIProvider | Promise<AIProvider>;
  private readonly authorizeModelCall: (branch: Gi088BranchKey) => void;
  private readonly now: () => Date;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly candidateFingerprint = createGi088EffectiveCandidateFingerprint();
  private readonly executionFingerprint = createGi088ExecutionFingerprint();

  constructor(dependencies: FoundationServiceDependencies) {
    this.store = dependencies.store;
    this.getProvider = dependencies.getProvider ?? defaultProvider;
    this.now = dependencies.now ?? (() => new Date());
    this.sleep = dependencies.sleep ?? ((milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.authorizeModelCall = dependencies.authorizeModelCall ??
      (dependencies.getProvider
        ? () => undefined
        : () => requireGi088ModelCallAuthorization(this.executionFingerprint));
  }

  async listRuns(ownerUserId: string) {
    const runs = await this.store.listRuns({ ownerUserId });
    return {
      evaluationVersion: GI088_EVALUATION_VERSION,
      currentExecutionFingerprint: this.executionFingerprint,
      runs: runs.map((run) => {
        const state = parseState(run);
        return {
          runId: run.id,
          runOrdinal: run.runOrdinal,
          evaluationVersion: run.evaluationVersion,
          collectionStatus: run.status,
          gateStatus: run.gateStatus,
          completedTaskCount: state.tasks.filter((task) =>
            taskCompletedFor(state, task)
          ).length,
          totalTasks: taskDefinitionsFor(run.evaluationVersion, state).length,
          createdAt: run.createdAt.toISOString(),
          updatedAt: run.updatedAt.toISOString(),
          sealedAt: dateIso(run.sealedAt),
          readOnly:
            run.status !== "running" ||
            run.evaluationVersion !== GI088_EVALUATION_VERSION ||
            run.executionFingerprint !== this.executionFingerprint ||
            run.candidateFingerprint !== this.candidateFingerprint
        };
      })
    };
  }

  async createRun(input: {
    ownerUserId: string;
    clientOperationId: string;
  }) {
    if (!input.clientOperationId.trim() || input.clientOperationId.length > 160) {
      throw new Gi088EvaluationError("GI088_RUN_INPUT_INVALID");
    }
    const runId = randomUUID();
    const payload = {
      evaluationVersion: GI088_EVALUATION_VERSION,
      mode: GI088_EVALUATION_MODE
    };
    const result = await this.store.createRunIdempotently({
      runId,
      ownerUserId: input.ownerUserId,
      evaluationVersion: GI088_EVALUATION_VERSION,
      candidateFingerprint: this.candidateFingerprint,
      executionFingerprint: this.executionFingerprint,
      state: json(createInitialState(this.now(), runId)),
      gateStatus: "pending",
      gateReasons: [],
      clientOperationId: input.clientOperationId,
      payloadHash: createGi088FoundationPayloadHash(json(payload))
    });
    return {
      created: result.created,
      runId: result.run.id,
      runOrdinal: result.run.runOrdinal,
      session: await this.createPublicSession(result.run)
    };
  }

  private async requireRun(ownerUserId: string, runId: string) {
    if (!runId.trim()) throw new Gi088EvaluationError("GI088_RUN_ID_REQUIRED");
    const run = await this.store.findRun({ ownerUserId, runId });
    if (!run) throw new Gi088EvaluationError("GI088_RUN_NOT_FOUND");
    return run;
  }

  private assertMutable(run: Gi088FoundationRunRecord) {
    if (
      run.status !== "running" ||
      run.evaluationVersion !== GI088_EVALUATION_VERSION ||
      run.executionFingerprint !== this.executionFingerprint ||
      run.candidateFingerprint !== this.candidateFingerprint
    ) {
      throw new Gi088EvaluationError("GI088_RUN_READ_ONLY");
    }
  }

  async getSession(input: {
    ownerUserId: string;
    runId: string;
    taskId?: string | null;
  }) {
    const run = await this.requireRun(input.ownerUserId, input.runId);
    if (
      input.taskId &&
      !parseState(run).tasks.some((task) => task.taskId === input.taskId)
    ) {
      throw new Gi088EvaluationError("GI088_TASK_NOT_FOUND");
    }
    const reconciled = await this.reconcileRun(run);
    return this.createPublicSession(reconciled, input.taskId);
  }

  private async createPublicSession(
    run: Gi088FoundationRunRecord,
    selectedTaskId?: string | null
  ): Promise<Gi088PublicSession> {
    const state = parseState(run);
    const [calls, interventionRows, revisionRows] = await Promise.all([
      this.store.listCalls(run.id),
      this.store.listProgramInterventions(run.id),
      this.store.listReviewRevisions(run.id)
    ]);
    const interventions = interventionRows.map(interventionToPublic);
    const metrics = metricsFor({
      state,
      calls,
      interventions: interventionRows
    });
    const requested = selectedTaskId
      ? state.tasks.find((task) => task.taskId === selectedTaskId) ?? null
      : null;
    const selectedTask = requested ??
      (state.activeTaskId ? taskState(state, state.activeTaskId) : null);
    const readOnly =
      run.status !== "running" ||
      run.evaluationVersion !== GI088_EVALUATION_VERSION ||
      run.executionFingerprint !== this.executionFingerprint ||
      run.candidateFingerprint !== this.candidateFingerprint;
    const usesFoundationLedger =
      run.evaluationVersion === GI088_EVALUATION_VERSION;
    const matchesCurrentBehavior =
      usesFoundationLedger &&
      run.executionFingerprint === this.executionFingerprint &&
      run.candidateFingerprint === this.candidateFingerprint;
    const definitions = taskDefinitionsFor(
      run.evaluationVersion,
      state,
      !usesFoundationLedger || matchesCurrentBehavior
    );
    const evaluationMetadata = evaluationMetadataFor(run.evaluationVersion);
    const fingerprints = matchesCurrentBehavior
      ? createGi088FingerprintBundle()
      : null;

    const publicTrajectory = (trajectory: Gi088Trajectory) => {
      const branchCalls = calls.filter((call) =>
        call.taskId === selectedTask?.taskId &&
        call.branch === trajectory.branch
      );
      const turns = trajectory.turns.map((turn) => {
        const ledgerCalls = branchCalls
          .filter((call) => call.turnId === turn.id)
          .sort((left, right) => left.attempt - right.attempt)
          .map(callToPublic);
        return {
          ...turn,
          calls: usesFoundationLedger
            ? ledgerCalls
            : turn.calls.map(historicalCallToPublic)
        };
      });
      const currentConfig = GI088_CONFIGS[trajectory.branch];
      const config = matchesCurrentBehavior
        ? {
            key: currentConfig.key,
            label: currentConfig.label,
            thinking: currentConfig.thinking,
            temperature: currentConfig.temperature,
            effectiveTemperature: currentConfig.effectiveTemperature,
            reasoningEffort: currentConfig.reasoningEffort,
            automaticEmptyContentRetries:
              currentConfig.automaticEmptyContentRetries,
            automaticStageTransitionRetries:
              currentConfig.automaticStageTransitionRetries,
            automaticSingleQuestionRetries:
              currentConfig.automaticSingleQuestionRetries,
            automaticTechnicalRetries: currentConfig.automaticTechnicalRetries,
            providerCallsUsed:
              branchCalls.filter((call) => call.dispatchedAt).length,
            providerCallsRemaining: null,
            maximumProviderCallsPerTrajectory: null
          }
        : historicalTrajectoryConfig(
            run.evaluationVersion,
            trajectory,
            branchCalls
          );
      return {
        ...trajectory,
        turns,
        config,
        dialogueAnchor: createDialogueAnchor(trajectory),
        reviewSnapshotFingerprint: selectedTask
          ? reviewSnapshotFingerprint({
              runId: run.id,
              taskId: selectedTask.taskId,
              branch: trajectory.branch,
              trajectory,
              interventions: interventionRows
            })
          : undefined
      };
    };
    const selectedInterventions = selectedTask
      ? interventions.filter((item) => item.taskId === selectedTask.taskId)
      : [];
    const selectedHigh = selectedTask?.branches.high ?? null;
    const snapshot = selectedTask && selectedHigh
      ? {
          fingerprint: reviewSnapshotFingerprint({
            runId: run.id,
            taskId: selectedTask.taskId,
            branch: "high",
            trajectory: selectedHigh,
            interventions: interventionRows
          }),
          trajectoryReview: selectedHigh.review,
          questionReviews: selectedHigh.turns
            .filter((turn) => turn.questionObservation)
            .map((turn) => ({
              turnId: turn.id,
              observationFingerprint:
                turn.questionObservation?.observationFingerprint ?? "",
              review: turn.questionObservation?.review ?? null
            })),
          programInterventions: selectedInterventions
        }
      : undefined;
    const gate = gateFor({
      run,
      state,
      calls,
      interventions: interventionRows,
      now: this.now()
    });

    return {
      evaluation: {
        id: evaluationMetadata.id,
        version: run.evaluationVersion,
        mode: state.evaluationMode ?? "high_only",
        activeBranches:
          state.evaluationMode === "paired" ? ["off", "high"] : ["high"],
        candidateFingerprint: run.candidateFingerprint,
        executionFingerprint: run.executionFingerprint,
        model: evaluationMetadata.model,
        serviceVersion: evaluationMetadata.serviceVersion,
        ...(matchesCurrentBehavior || !usesFoundationLedger
          ? {
              datasetFingerprint: createGi088DatasetFingerprint(
                run.evaluationVersion
              )
            }
          : {}),
        ...(fingerprints
          ? {
              behaviorManifestVersion: fingerprints.behaviorManifestVersion,
              behaviorManifestSha256: fingerprints.behaviorManifestSha256,
              runnerFingerprint: fingerprints.runnerFingerprint,
              experienceFingerprint: fingerprints.experienceFingerprint,
              config: {
                thinking: "enabled" as const,
                reasoningEffort: "high" as const,
                responseFormat: "json_object" as const,
                maxTokensPolicy: "provider_default" as const,
                timeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs,
                routeMaxDurationSeconds:
                  GI088_TIMEOUT_POLICY.routeMaxDurationSeconds
              }
            }
          : {})
      },
      batch: {
        id: run.id,
        runId: run.id,
        runOrdinal: run.runOrdinal,
        status: run.status,
        completedTaskCount: state.tasks.filter((task) =>
          taskCompletedFor(state, task)).length,
        totalTasks: definitions.length,
        sealedAt: state.sealedAt ?? dateIso(run.sealedAt),
        earlyStop: state.earlyStop ?? null,
        targetCoverage: {
          triggeredTrajectoryCount:
            metrics.gateFacts.targetTriggeredTrajectoryCount,
          reviewedTrajectoryCount:
            definitions.length - metrics.gateFacts.unreviewedTrajectoryCount,
          totalTrajectoryCount: definitions.length
        },
        gate: {
          status: gate.status,
          reasons: gate.reasons,
          frozen: run.status !== "running"
        },
        readOnly,
        readOnlyReason: readOnly
          ? run.status !== "running"
            ? "run_terminal"
            : "execution_fingerprint_mismatch"
          : null
      },
      tasks: definitions.map((definition) => {
        const task = taskState(state, definition.id);
        return {
          id: definition.id,
          capabilityId: definition.capabilityId,
          title: definition.title,
          instruction: definition.instruction,
          targetTriggerPrompt: definition.targetTriggerPrompt,
          criterion: definition.criterion,
          repeatOf: definition.repeatOf,
          status: publicTaskStatus(state, task),
          targetTriggers: {
            off: task.branches.off.review?.targetTrigger ?? null,
            high: task.branches.high.review?.targetTrigger ?? null
          }
        };
      }),
      activeTask: selectedTask
        ? {
            taskId: selectedTask.taskId,
            frozenStart: {
              opening: matchesCurrentBehavior
                ? GI088_FIXED_OPENING
                : selectedTask.branches.high.messages.find(
                    (message) => message.role === "assistant"
                  )?.content ?? GI088_FIXED_OPENING,
              userMessage: selectedTask.initialUserMessage
            },
            activeBranch: selectedTask.activeBranch,
            branches: {
              off: publicTrajectory(selectedTask.branches.off),
              high: publicTrajectory(selectedTask.branches.high)
            },
            comparison: selectedTask.comparison,
            readOnly:
              readOnly ||
              selectedTask.taskId !== state.activeTaskId ||
              taskCompletedFor(state, selectedTask) ||
              taskAborted(selectedTask),
            ...(snapshot ? { reviewSnapshot: snapshot } : {})
          }
        : null,
      metrics,
      programInterventions: interventions,
      reviewRevisions: revisionRows.map((revision): Gi088ReviewRevision => ({
        id: revision.id,
        subjectType: revision.subjectType,
        subjectId: revision.subjectId,
        oldValue: revision.oldValue,
        newValue: revision.newValue,
        reason: revision.reason,
        clientOperationId: revision.clientOperationId,
        createdAt: revision.createdAt.toISOString()
      }))
    };
  }

  private createCompletionParams(input: {
    turnInput: Board7bWorkingTaskV1TurnInput;
    controlDecision: InterviewControlDecisionV2;
    recoveryTrigger?: Gi088RecoveryTrigger | null;
    hardTimeoutMs?: number;
  }): AICompletionParams {
    const hardTimeoutMs = input.hardTimeoutMs ?? GI088_TIMEOUT_POLICY.hardTimeoutMs;
    const recoveryInstruction =
      input.recoveryTrigger === "EMPTY_CONTENT"
        ? GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION
        : input.recoveryTrigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
          ? GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION
          : input.recoveryTrigger === "UNAUTHORIZED_PAUSE"
            ? "上次输出未经用户明确停止便选择暂停。请吸收同一段原话，继续当前共同任务，只提出一个有价值、具体、低负担的问题。"
            : null;
    return {
      messages: [
        { role: "system", content: getGi088CandidateAssets().systemPrompt },
        {
          role: "system",
          content: `本轮程序控制决定：${JSON.stringify({
            finalAction: input.controlDecision.finalAction,
            contentEvidenceText: input.controlDecision.contentEvidenceText,
            decisionVersion: input.controlDecision.decisionVersion
          })}`
        },
        ...(recoveryInstruction
          ? [{ role: "system" as const, content: recoveryInstruction }]
          : []),
        {
          role: "user",
          content: createGi088StageTransitionUserPrompt(input.turnInput)
        }
      ],
      useProviderDefaultMaxTokens: true,
      timeoutMs: hardTimeoutMs,
      headersTimeoutMs: Math.min(
        GI088_TIMEOUT_POLICY.headersTimeoutMs,
        hardTimeoutMs
      ),
      bodyIdleTimeoutMs: Math.min(
        GI088_TIMEOUT_POLICY.bodyIdleTimeoutMs,
        hardTimeoutMs
      ),
      hardTimeoutMs,
      responseFormat: "json_object",
      thinking: "enabled",
      reasoningEffort: "high"
    };
  }

  private createEffectiveConfig(input: {
    recoveryTrigger?: Gi088RecoveryTrigger | null;
    hardTimeoutMs?: number;
    remainingSharedDeadlineMs?: number | null;
  }): Gi088CallEffectiveConfig {
    const hardTimeoutMs = input.hardTimeoutMs ?? GI088_TIMEOUT_POLICY.hardTimeoutMs;
    return {
      branch: "high",
      thinking: "enabled",
      reasoningEffort: "high",
      temperature: null,
      responseFormat: "json_object",
      maxTokensPolicy: "provider_default",
      timeoutMs: hardTimeoutMs,
      headersTimeoutMs: Math.min(
        GI088_TIMEOUT_POLICY.headersTimeoutMs,
        hardTimeoutMs
      ),
      bodyIdleTimeoutMs: Math.min(
        GI088_TIMEOUT_POLICY.bodyIdleTimeoutMs,
        hardTimeoutMs
      ),
      hardTimeoutMs,
      timeoutPolicyVersion: GI088_TIMEOUT_POLICY.version,
      recoveryInstructionVersion:
        input.recoveryTrigger === "EMPTY_CONTENT"
          ? GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION_VERSION
          : input.recoveryTrigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
            ? GI088_STAGE_TRANSITION_RECOVERY_INSTRUCTION_VERSION
            : input.recoveryTrigger === "UNAUTHORIZED_PAUSE"
              ? GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY.recoveryInstructionVersion
              : null,
      continuationMode: null,
      reasoningReplay: null,
      visiblePrefix: null,
      requestHashScope: "full",
      sharedDeadlineMs:
        input.recoveryTrigger
          ? GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs
          : GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs,
      remainingSharedDeadlineMs:
        input.remainingSharedDeadlineMs ??
        GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs,
      recoveryPolicyVersion: input.recoveryTrigger
        ? GI088_SHARED_RECOVERY_DEADLINE_POLICY.version
        : null
    };
  }

  private evidenceExcerpts(
    messages: Gi088Message[],
    output: Gi088SemanticDeltaOutput
  ) {
    const refs = new Set<string>();
    for (const ref of output.semantic.workingTask?.evidenceRefs ?? []) refs.add(ref);
    if (output.semantic.understandingChange.kind !== "none") {
      output.semantic.understandingChange.evidenceRefs.forEach((ref) => refs.add(ref));
    }
    output.semantic.returnableTaskDelta.add.forEach((task) =>
      task.evidenceRefs.forEach((ref) => refs.add(ref)));
    output.semantic.nextInquiry?.evidenceRefs.forEach((ref) => refs.add(ref));
    if (output.semantic.burdenSignalChange.kind === "set") {
      output.semantic.burdenSignalChange.evidenceRefs.forEach((ref) => refs.add(ref));
    }
    return messages
      .filter((message) => message.role === "user" && refs.has(message.id))
      .map(({ id, content }) => ({ id, content }));
  }

  private async reconcileRun(initialRun: Gi088FoundationRunRecord) {
    let run = initialRun;
    if (
      run.status !== "running" ||
      run.evaluationVersion !== GI088_EVALUATION_VERSION ||
      run.executionFingerprint !== this.executionFingerprint ||
      run.candidateFingerprint !== this.candidateFingerprint
    ) {
      return run;
    }
    const calls = await this.store.listCalls(run.id);
    for (const call of calls) {
      if (call.status === "finalized") {
        await this.ensureFinalizedInterventions(call);
        await this.completeCallOperationIfProcessing(run, call);
        run = await this.reconcileAutomaticRecoveryDeadline(run, call);
        continue;
      }
      if (
        call.status === "provider_succeeded" ||
        call.status === "provider_failed"
      ) {
        run = await this.finalizeCall(call.callId, run.ownerUserId);
        continue;
      }
      if (
        call.status === "reserved" &&
        this.now().getTime() >=
          (call.automaticDeadlineAt?.getTime() ??
            call.reservedAt.getTime() +
              GI088_SHARED_RECOVERY_DEADLINE_POLICY.manualRetryHardTimeoutMs)
      ) {
        run = await this.markReservedCallExpired(run, call);
        const terminalCall = await this.store.findCall(call.callId);
        if (terminalCall) {
          await this.completeCallOperationIfProcessing(run, terminalCall);
        }
        continue;
      }
      if (
        call.status === "dispatched" &&
        call.executionDeadlineAt &&
        this.now().getTime() >
          call.executionDeadlineAt.getTime() + CALL_SETTLEMENT_GRACE_MS
      ) {
        run = await this.markInterruptedCall(run, call);
        const terminalCall = await this.store.findCall(call.callId);
        if (terminalCall) {
          await this.completeCallOperationIfProcessing(run, terminalCall);
        }
        continue;
      }
      if (
        call.status === "interrupted_unknown_dispatch" ||
        call.status === "superseded"
      ) {
        await this.completeCallOperationIfProcessing(run, call);
      }
    }
    return run;
  }

  private async completeCallOperationIfProcessing(
    run: Gi088FoundationRunRecord,
    call: Gi088FoundationCallRecord
  ) {
    const operation = await this.store.findOperation({
      ownerUserId: run.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: call.clientOperationId
    });
    if (!operation || operation.status !== "processing") return;
    await this.store.completeOperation({
      ownerUserId: run.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: call.clientOperationId,
      status: "completed",
      resultRevision: run.revision,
      resultSnapshot: json({
        runId: run.id,
        turnId: call.turnId,
        callId: call.callId,
        status: call.status
      }),
      completedAt: this.now()
    });
  }

  private async reconcileAutomaticRecoveryDeadline(
    initialRun: Gi088FoundationRunRecord,
    call: Gi088FoundationCallRecord
  ) {
    const run = await this.requireRun(initialRun.ownerUserId, initialRun.id);
    const state = structuredClone(parseState(run));
    const trajectory = taskState(state, call.taskId).branches[
      call.branch as Gi088BranchKey
    ];
    const turn = trajectory.turns.find((item) => item.id === call.turnId);
    if (
      !turn ||
      turn.recovery?.status !== "eligible" ||
      !turn.recovery.automaticDeadlineAt ||
      this.now().getTime() <
        new Date(turn.recovery.automaticDeadlineAt).getTime()
    ) {
      return run;
    }
    const completedAt = this.now().toISOString();
    turn.recovery.status = "manual_available";
    turn.recovery.completedAt = completedAt;
    turn.status = "technical_failure";
    trajectory.status = "technical_failure";
    state.updatedAt = completedAt;
    const operation = operationIdentity({
      ownerUserId: run.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: `auto-deadline:${turn.id}`,
      action: "automatic_recovery_deadline",
      payload: {
        turnId: turn.id,
        automaticDeadlineAt: turn.recovery.automaticDeadlineAt
      }
    });
    return (await this.commitSimpleMutation({
      run,
      state,
      operation,
      resultSnapshot: {
        turnId: turn.id,
        status: "manual_available"
      }
    })).run;
  }

  private async markReservedCallExpired(
    initialRun: Gi088FoundationRunRecord,
    call: Gi088FoundationCallRecord
  ) {
    const run = await this.requireRun(initialRun.ownerUserId, initialRun.id);
    const state = structuredClone(parseState(run));
    const trajectory = taskState(state, call.taskId).branches[
      call.branch as Gi088BranchKey
    ];
    const turn = trajectory.turns.find((item) => item.id === call.turnId);
    if (!turn || turn.activeCallId !== call.callId || turn.status !== "processing") {
      return run;
    }
    const completedAt = this.now().toISOString();
    turn.status = "technical_failure";
    turn.validationIssues = [
      ...new Set([...turn.validationIssues, "RESERVED_DISPATCH_EXPIRED"])
    ];
    if (turn.recovery) {
      turn.recovery.status =
        call.kind === "manual_retry" ? "exhausted" : "manual_available";
      turn.recovery.completedAt = completedAt;
    } else {
      turn.recovery = {
        status: "manual_available",
        trigger: "TIMEOUT",
        automaticRetryCount: 0,
        initialCallId: call.callId,
        recoveryCallId: null,
        manualRetryCount: 0,
        manualRetryCallId: null,
        eligibleAt: completedAt,
        automaticDeadlineAt: dateIso(call.automaticDeadlineAt),
        startedAt: null,
        completedAt
      };
    }
    trajectory.status = "technical_failure";
    trajectory.technicalError = "RESERVED_DISPATCH_EXPIRED";
    state.updatedAt = completedAt;
    const operation = operationIdentity({
      ownerUserId: run.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: `reconcile-reserved:${call.callId}`,
      action: "reconcile_reserved_call",
      payload: { callId: call.callId }
    });
    const [calls, interventions] = await Promise.all([
      this.store.listCalls(run.id),
      this.store.listProgramInterventions(run.id)
    ]);
    const gate = gateFor({
      run,
      state,
      calls: calls.map((item) =>
        item.callId === call.callId
          ? {
              ...item,
              status: "superseded" as const,
              errorCode: "RESERVED_DISPATCH_EXPIRED"
            }
          : item
      ),
      interventions,
      now: this.now()
    });
    return (await this.store.supersedeCallAndCommitRun({
      mutation: {
        runId: run.id,
        ownerUserId: run.ownerUserId,
        expectedRevision: run.revision,
        expectedExecutionFingerprint: this.executionFingerprint,
        nextState: json(state),
        nextGateStatus: gate.status,
        nextGateReasons: json(gate.reasons)
      },
      operation,
      resultSnapshot: json({
        callId: call.callId,
        status: "reserved_dispatch_expired"
      }),
      callId: call.callId,
      expectedStatuses: ["reserved"],
      errorCode: "RESERVED_DISPATCH_EXPIRED"
    })).run;
  }

  private async markInterruptedCall(
    initialRun: Gi088FoundationRunRecord,
    call: Gi088FoundationCallRecord
  ) {
    const run = await this.requireRun(initialRun.ownerUserId, initialRun.id);
    const state = structuredClone(parseState(run));
    const trajectory = taskState(state, call.taskId).branches[
      call.branch as Gi088BranchKey
    ];
    const turn = trajectory.turns.find((item) => item.id === call.turnId);
    if (!turn || turn.activeCallId !== call.callId || turn.status !== "processing") {
      return run;
    }
    turn.status = "technical_failure";
    turn.validationIssues = [
      ...new Set([...turn.validationIssues, "REQUEST_INTERRUPTED"])
    ];
    const completedAt = this.now().toISOString();
    if (turn.recovery) {
      turn.recovery.status =
        call.kind === "manual_retry" ? "exhausted" : "manual_available";
      turn.recovery.completedAt = completedAt;
    } else {
      turn.recovery = {
        status: "manual_available",
        trigger: "TIMEOUT",
        automaticRetryCount: 0,
        initialCallId: call.callId,
        recoveryCallId: null,
        manualRetryCount: 0,
        manualRetryCallId: null,
        eligibleAt: completedAt,
        automaticDeadlineAt: dateIso(call.automaticDeadlineAt),
        startedAt: null,
        completedAt
      };
    }
    trajectory.status = "technical_failure";
    trajectory.technicalError = "REQUEST_INTERRUPTED";
    state.updatedAt = completedAt;
    const operation = operationIdentity({
      ownerUserId: run.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: `reconcile-interrupted:${call.callId}`,
      action: "reconcile_interrupted_call",
      payload: { callId: call.callId }
    });
    const [calls, interventions] = await Promise.all([
      this.store.listCalls(run.id),
      this.store.listProgramInterventions(run.id)
    ]);
    const gate = gateFor({
      run,
      state,
      calls: calls.map((item) =>
        item.callId === call.callId
          ? {
              ...item,
              status: "interrupted_unknown_dispatch" as const,
              errorCode: "REQUEST_INTERRUPTED"
            }
          : item
      ),
      interventions,
      now: this.now()
    });
    const result = await this.store.interruptCallAndCommitRun({
      mutation: {
        runId: run.id,
        ownerUserId: run.ownerUserId,
        expectedRevision: run.revision,
        expectedExecutionFingerprint: this.executionFingerprint,
        nextState: json(state),
        nextGateStatus: gate.status,
        nextGateReasons: json(gate.reasons)
      },
      operation,
      resultSnapshot: json({
        callId: call.callId,
        status: "interrupted_unknown_dispatch"
      }),
      callId: call.callId,
      errorCode: "REQUEST_INTERRUPTED"
    });
    return result.run;
  }

  async startTask(input: {
    ownerUserId: string;
    runId: string;
    taskId: string;
    initialUserMessage: string;
    clientOperationId: string;
    onProgress?: (event: Gi088FoundationExecutionEvent) => void;
  }) {
    return this.submitUserContent({
      ...input,
      content: input.initialUserMessage,
      clientTurnId: input.clientOperationId,
      baseAssistantMessageId: "A0",
      kind: "initial"
    });
  }

  async submitTurn(input: {
    ownerUserId: string;
    runId: string;
    taskId: string;
    branch: "high";
    content: string;
    clientTurnId: string;
    clientOperationId: string;
    baseAssistantMessageId: string;
    onProgress?: (event: Gi088FoundationExecutionEvent) => void;
  }) {
    return this.submitUserContent({
      ownerUserId: input.ownerUserId,
      runId: input.runId,
      taskId: input.taskId,
      content: input.content,
      clientTurnId: input.clientTurnId,
      clientOperationId: input.clientOperationId,
      baseAssistantMessageId: input.baseAssistantMessageId,
      kind: "turn",
      onProgress: input.onProgress
    });
  }

  private async replayOperationIfPresent(input: {
    ownerUserId: string;
    evaluationVersion: string;
    clientOperationId: string;
    action: string;
    payloadHash: string;
    runId: string;
  }) {
    const operation = await this.store.findOperation({
      ownerUserId: input.ownerUserId,
      evaluationVersion: input.evaluationVersion,
      clientOperationId: input.clientOperationId
    });
    if (!operation) return null;
    if (
      operation.action !== input.action ||
      operation.payloadHash !== input.payloadHash
    ) {
      throw new Gi088EvaluationError("GI088_OPERATION_PAYLOAD_CONFLICT");
    }
    if (operation.runId !== input.runId) {
      throw new Gi088EvaluationError("GI088_OPERATION_PAYLOAD_CONFLICT");
    }
    const run = await this.requireRun(input.ownerUserId, input.runId);
    return this.createPublicSession(await this.reconcileRun(run));
  }

  private async submitUserContent(input: {
    ownerUserId: string;
    runId: string;
    taskId: string;
    content: string;
    clientTurnId: string;
    clientOperationId: string;
    baseAssistantMessageId: string;
    kind: "initial" | "turn";
    onProgress?: (event: Gi088FoundationExecutionEvent) => void;
  }) {
    const content = input.content.trim();
    if (!content || content.length > 8_000) {
      throw new Gi088EvaluationError(
        input.kind === "initial"
          ? "GI088_INITIAL_USER_MESSAGE_INVALID"
          : "GI088_USER_MESSAGE_INVALID"
      );
    }
    if (
      !input.clientOperationId.trim() ||
      input.clientOperationId.length > 160 ||
      input.clientTurnId !== input.clientOperationId
    ) {
      throw new Gi088EvaluationError("GI088_CLIENT_TURN_ID_INVALID");
    }
    let run = await this.requireRun(input.ownerUserId, input.runId);
    this.assertMutable(run);
    taskDefinition(run.evaluationVersion, input.taskId);
    const payload = {
      runId: input.runId,
      taskId: input.taskId,
      branch: "high",
      content,
      clientTurnId: input.clientTurnId,
      baseAssistantMessageId: input.baseAssistantMessageId,
      kind: input.kind
    };
    const operation = operationIdentity({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: input.clientOperationId,
      action: input.kind === "initial" ? "start_task" : "submit_turn",
      payload
    });
    const replay = await this.replayOperationIfPresent({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: input.clientOperationId,
      action: operation.action,
      payloadHash: operation.payloadHash,
      runId: run.id
    });
    if (replay) return replay;

    const state = structuredClone(parseState(run));
    const task = taskState(state, input.taskId);
    if (input.kind === "initial") {
      if (firstOpenTaskId(state) !== input.taskId) {
        throw new Gi088EvaluationError("GI088_TASK_ORDER_INVALID");
      }
      if (state.activeTaskId && state.activeTaskId !== input.taskId) {
        throw new Gi088EvaluationError("GI088_ACTIVE_TASK_INCOMPLETE");
      }
      if (task.branches.high.status !== "not_started") {
        throw new Gi088EvaluationError("GI088_HIGH_BRANCH_ALREADY_STARTED");
      }
      state.activeTaskId = input.taskId;
      task.initialUserMessage = content;
      task.activeBranch = "high";
      task.branches.high = createEmptyTrajectory("high");
      task.branches.high.status = "running";
      task.branches.high.startedAt = this.now().toISOString();
      task.branches.high.messages = [
        { id: "A0", role: "assistant", content: GI088_FIXED_OPENING }
      ];
    } else if (
      state.activeTaskId !== input.taskId ||
      task.activeBranch !== "high"
    ) {
      throw new Gi088EvaluationError("GI088_BRANCH_NOT_ACTIVE");
    }
    const trajectory = task.branches.high;
    if (
      trajectory.status !== "running" ||
      trajectory.pendingTurnId
    ) {
      throw new Gi088EvaluationError("GI088_TRAJECTORY_NOT_READY");
    }
    const anchor = createDialogueAnchor(trajectory);
    if (anchor.lastAssistantMessageId !== input.baseAssistantMessageId) {
      throw new Gi088EvaluationError("GI088_TURN_OUT_OF_DATE");
    }
    const controlDecision = decideInterviewControlV2({
      rawText: content,
      lastAssistantMessage: lastAssistantMessage(trajectory)?.content ?? null,
      currentQuestionTarget:
        trajectory.semanticState.nextInquiry?.answerTarget ?? null,
      workingTaskRef: trajectory.semanticState.workingTask?.taskRef ?? null,
      semanticState: trajectory.semanticState
    });
    const explicitStop = assessExplicitStopFromControlDecision(controlDecision);
    const userMessageId = `U${
      trajectory.messages.filter((message) => message.role === "user").length + 1
    }`;
    const turnId = randomUUID();
    trajectory.messages.push({ id: userMessageId, role: "user", content });
    const turnInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: trajectory.messages,
      latestUserMessageId: userMessageId,
      semanticState: structuredClone(trajectory.semanticState)
    };
    const turn: Gi088Turn = {
      id: turnId,
      clientTurnId: input.clientTurnId,
      userMessageId,
      status: "processing",
      semantic: null,
      visible: null,
      visibleText: null,
      evidenceExcerpts: [],
      validationIssues: [],
      semanticStateBefore: structuredClone(trajectory.semanticState),
      semanticStateAfter: null,
      calls: [],
      recovery: null,
      questionObservation: null,
      stateMaintenance: {
        policyVersion: GI088_DETERMINISTIC_STATE_POLICY_VERSION,
        workingTaskLineage: "not_applicable",
        inheritedEvidenceCount: 0,
        submittedEvidenceCount: 0,
        effectiveEvidenceCount: 0,
        explicitStop,
        providerCallBypassed: explicitStop === "pure",
        providerFailureAbsorbed: false,
        sourceCompletion: {
          appliedFields: [],
          insertedEvidenceRefs: [],
          reviewCandidate: null
        }
      },
      activeCallId: null,
      baseAssistantMessageId: input.baseAssistantMessageId,
      failedOutputDiagnostic: null,
      controlDecision
    };
    trajectory.turns.push(turn);
    trajectory.pendingTurnId = turnId;
    trajectory.technicalError = null;
    state.updatedAt = this.now().toISOString();

    if (explicitStop === "pure") {
      return this.commitPureStop({
        run,
        state,
        taskId: input.taskId,
        turnId,
        operation,
        controlDecision,
        onProgress: input.onProgress
      });
    }

    this.authorizeModelCall("high");
    const provider = await this.getProvider();
    const completionParams = this.createCompletionParams({
      turnInput,
      controlDecision
    });
    const callId = randomUUID();
    turn.activeCallId = callId;
    const now = this.now();
    const automaticDeadlineAt = new Date(
      now.getTime() +
        GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs
    );
    const effectiveConfig = this.createEffectiveConfig({});
    const gate = gateFor({
      run,
      state,
      calls: await this.store.listCalls(run.id),
      interventions: await this.store.listProgramInterventions(run.id),
      now
    });
    const reserved = await this.store.reserveTurnWithCall({
      mutation: {
        runId: run.id,
        ownerUserId: run.ownerUserId,
        expectedRevision: run.revision,
        expectedExecutionFingerprint: this.executionFingerprint,
        nextState: json(state),
        nextGateStatus: gate.status,
        nextGateReasons: json(gate.reasons)
      },
      operation,
      call: {
        callId,
        runId: run.id,
        taskId: input.taskId,
        branch: "high",
        turnId,
        clientTurnId: input.clientTurnId,
        clientOperationId: operation.clientOperationId,
        attempt: 1,
        kind: input.kind,
        requestHash: sha256(JSON.stringify(completionParams)),
        effectiveConfig: json(effectiveConfig),
        baseAssistantMessageId: input.baseAssistantMessageId,
        semanticStateBeforeHash: createGi088FoundationPayloadHash(
          json(turn.semanticStateBefore)
        ),
        automaticDeadlineAt,
        reservedAt: now
      }
    });
    input.onProgress?.({
      type: "turn_reserved",
      turnId: reserved.call.turnId,
      callId: reserved.call.callId
    });
    if (!reserved.claimed) {
      return this.createPublicSession(await this.reconcileRun(reserved.run));
    }
    run = reserved.run;
    await this.executeDispatchedCall({
      run,
      call: reserved.call,
      provider,
      turnInput,
      controlDecision,
      completionParams,
      onProgress: input.onProgress
    });
    return this.createPublicSession(
      await this.reconcileRun(
        await this.requireRun(input.ownerUserId, input.runId)
      )
    );
  }

  private async commitPureStop(input: {
    run: Gi088FoundationRunRecord;
    state: Gi088BatchState;
    taskId: string;
    turnId: string;
    operation: Gi088FoundationOperationIdentity;
    controlDecision: InterviewControlDecisionV2;
    onProgress?: (event: Gi088FoundationExecutionEvent) => void;
  }) {
    const trajectory = taskState(input.state, input.taskId).branches.high;
    const turn = trajectory.turns.find((item) => item.id === input.turnId)!;
    const turnInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: trajectory.messages,
      latestUserMessageId: turn.userMessageId,
      semanticState: turn.semanticStateBefore
    };
    const deterministic = createGi088DeterministicPauseOutput({
      turnInput,
      explicitStop: "pure"
    });
    const nextSemanticState = applyGi088SemanticDeltaValidatedResult({
      input: turnInput,
      output: deterministic.output
    });
    const assistantMessageId = `A${
      trajectory.messages.filter((message) => message.role === "assistant").length
    }`;
    turn.status = "valid";
    turn.semantic = deterministic.output.semantic;
    turn.visible = deterministic.output.visible;
    turn.visibleText = renderGi088SemanticDeltaVisible(deterministic.output);
    turn.evidenceExcerpts = this.evidenceExcerpts(
      trajectory.messages,
      deterministic.output
    );
    turn.semanticStateAfter = nextSemanticState;
    turn.stateMaintenance = deterministic.maintenance;
    turn.activeCallId = null;
    turn.recovery = null;
    const observation = createGi088QuestionObservation(deterministic.output) ?? {
      questionMarkCount: 0,
      reviewCandidate: "none" as const,
      review: null
    };
    turn.questionObservation = {
      ...observation,
      observationFingerprint: observationFingerprint({
        turnId: turn.id,
        assistantMessageId,
        visibleText: turn.visibleText,
        questionMarkCount: observation.questionMarkCount
      })
    };
    trajectory.messages.push({
      id: assistantMessageId,
      role: "assistant",
      content: turn.visibleText
    });
    trajectory.semanticState = nextSemanticState;
    trajectory.pendingTurnId = null;
    trajectory.status = "running";
    trajectory.technicalError = null;
    input.state.updatedAt = this.now().toISOString();
    input.onProgress?.({
      type: "turn_reserved",
      turnId: turn.id,
      callId: null
    });
    const interventionPayload = {
      id: randomUUID(),
      runId: input.run.id,
      taskId: input.taskId,
      branch: "high",
      turnId: turn.id,
      callId: null,
      clientOperationId: input.operation.clientOperationId,
      interventionType: "pure_stop",
      originalAction: "stop_follow_up",
      effectiveAction: "deterministic_pause",
      evidenceSpan:
        input.controlDecision.candidates
          .filter((candidate) => candidate.effective)
          .at(-1)?.evidenceSpan ?? null,
      controlDecision: json(input.controlDecision),
      traceSummary: json({ providerCallBypassed: true }),
      observationFingerprint: createGi088FoundationPayloadHash(json({
        turnId: turn.id,
        type: "pure_stop",
        controlDecision: input.controlDecision
      }))
    };
    const [calls, existingInterventions] = await Promise.all([
      this.store.listCalls(input.run.id),
      this.store.listProgramInterventions(input.run.id)
    ]);
    const recordedAt = this.now();
    const gate = gateFor({
      run: input.run,
      state: input.state,
      calls,
      interventions: [
        ...existingInterventions,
        {
          ...interventionPayload,
          reviewOutcome: null,
          reviewReason: null,
          reviewedAt: null,
          createdAt: recordedAt,
          updatedAt: recordedAt
        }
      ],
      now: recordedAt
    });
    const result = await this.store.commitRunWithIntervention({
      mutation: {
        runId: input.run.id,
        ownerUserId: input.run.ownerUserId,
        expectedRevision: input.run.revision,
        expectedExecutionFingerprint: this.executionFingerprint,
        nextState: json(input.state),
        nextGateStatus: gate.status,
        nextGateReasons: json(gate.reasons)
      },
      operation: input.operation,
      resultSnapshot: json({ turnId: turn.id, zeroCallControl: true }),
      intervention: interventionPayload
    });
    return this.createPublicSession(result.run);
  }

  private async persistProviderResultWithRetry(input: {
    callId: string;
    status: "provider_succeeded" | "provider_failed";
    providerCompletedAt: Date;
    rawFinalOutput: string | null;
    responseHash: string | null;
    tokenUsage: Gi088FoundationJson | null;
    providerDiagnostics: Gi088FoundationJson | null;
    errorCode: string | null;
  }) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RESULT_PERSISTENCE_BACKOFF_MS.length; attempt += 1) {
      if (attempt > 0) {
        await this.sleep(RESULT_PERSISTENCE_BACKOFF_MS[attempt - 1]!);
      }
      try {
        return await this.store.persistProviderResult(input);
      } catch (error) {
        lastError = error;
      }
    }
    void lastError;
    throw new Gi088EvaluationError("GI088_RESULT_PERSISTENCE_UNKNOWN", 503, true);
  }

  private async executeDispatchedCall(input: {
    run: Gi088FoundationRunRecord;
    call: Gi088FoundationCallRecord;
    provider: AIProvider;
    turnInput: Board7bWorkingTaskV1TurnInput;
    controlDecision: InterviewControlDecisionV2;
    completionParams: AICompletionParams;
    onProgress?: (event: Gi088FoundationExecutionEvent) => void;
  }) {
    const dispatchedAt = this.now();
    const configuredHardTimeout =
      input.completionParams.hardTimeoutMs ?? GI088_TIMEOUT_POLICY.hardTimeoutMs;
    const executionDeadlineAt = new Date(
      dispatchedAt.getTime() + configuredHardTimeout
    );
    const claimed = await this.store.claimDispatch({
      callId: input.call.callId,
      dispatchedAt,
      executionDeadlineAt
    });
    if (!claimed.claimed) return claimed.call;
    input.onProgress?.({
      type: "provider_started",
      turnId: input.call.turnId,
      callId: input.call.callId
    });
    const heartbeatStartedAt = Date.now();
    const heartbeat = setInterval(() => {
      input.onProgress?.({
        type: "heartbeat",
        turnId: input.call.turnId,
        callId: input.call.callId,
        elapsedMs: Date.now() - heartbeatStartedAt
      });
    }, 10_000);
    let providerFailed = false;
    let rawFinalOutput: string | null = null;
    let responseHash: string | null = null;
    let tokenUsage: Gi088FoundationJson | null = null;
    let providerDiagnostics: Gi088FoundationJson | null = null;
    let errorCode: string | null = null;
    try {
      const completion = await input.provider.complete(input.completionParams);
      rawFinalOutput = completion.content;
      responseHash = sha256(completion.content);
      tokenUsage = json(sanitizeAICompletionTokenUsage(completion.tokenUsage));
      providerDiagnostics = json(
        sanitizeAIProviderDiagnostics(completion.diagnostics)
      );
    } catch (error) {
      providerFailed = true;
      takeAIReasoningOnlyContinuation(error)?.dispose();
      errorCode = getAIProviderFailureCode(error);
      providerDiagnostics = json(getAIProviderDiagnostics(error));
    } finally {
      clearInterval(heartbeat);
    }
    await this.persistProviderResultWithRetry({
      callId: input.call.callId,
      status: providerFailed ? "provider_failed" : "provider_succeeded",
      providerCompletedAt: this.now(),
      rawFinalOutput,
      responseHash,
      tokenUsage,
      providerDiagnostics,
      errorCode
    });
    const finalizedRun = await this.finalizeCall(
      input.call.callId,
      input.run.ownerUserId
    );
    await this.maybeExecuteAutomaticRecovery({
      run: finalizedRun,
      turnId: input.call.turnId,
      provider: input.provider,
      onProgress: input.onProgress
    });
    return input.call;
  }

  private recoveryTriggerFor(input: {
    call: Gi088FoundationCallRecord;
    issues?: string[];
  }): Gi088RecoveryTrigger | null {
    if (input.call.attempt !== 1) return null;
    if (input.issues?.includes("UNAUTHORIZED_PAUSE")) return "UNAUTHORIZED_PAUSE";
    if (
      input.issues?.includes("NEW_ANSWER_OPPORTUNITY_UNAVAILABLE")
    ) {
      return "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE";
    }
    if (input.issues?.some((issue) => /^ASK_QUESTION_COUNT_INVALID:2$/u.test(issue))) {
      return "ASK_QUESTION_COUNT_INVALID:2";
    }
    if (input.call.errorCode === GI088_EMPTY_CONTENT_RECOVERY_POLICY.trigger) {
      return "EMPTY_CONTENT";
    }
    if (input.call.errorCode === GI088_TIMEOUT_RECOVERY_POLICY.trigger) {
      return "TIMEOUT";
    }
    return null;
  }

  private setFailedTurn(input: {
    state: Gi088BatchState;
    call: Gi088FoundationCallRecord;
    issues: string[];
    protectedFailure: boolean;
    recoveryTrigger: Gi088RecoveryTrigger | null;
  }) {
    const trajectory = taskState(input.state, input.call.taskId).branches.high;
    const turn = trajectory.turns.find((item) => item.id === input.call.turnId)!;
    turn.status = input.protectedFailure
      ? "protected_failure"
      : "technical_failure";
    turn.validationIssues = [...new Set([
      ...turn.validationIssues,
      ...input.issues
    ])];
    turn.failedOutputDiagnostic = input.protectedFailure
      ? {
          errorCode: input.issues.includes("UNAUTHORIZED_PAUSE")
            ? "UNAUTHORIZED_PAUSE"
            : "MODEL_OUTPUT_PROTECTED",
          responseHash: input.call.responseHash,
          validationIssues: input.issues
        }
      : null;
    const now = this.now().toISOString();
    if (input.recoveryTrigger) {
      turn.recovery = {
        status: "eligible",
        trigger: input.recoveryTrigger,
        automaticRetryCount: 0,
        initialCallId: input.call.callId,
        recoveryCallId: null,
        manualRetryCount: 0,
        manualRetryCallId: null,
        eligibleAt: now,
        automaticDeadlineAt: dateIso(input.call.automaticDeadlineAt),
        startedAt: null,
        completedAt: null
      };
      trajectory.pendingTurnId = turn.id;
    } else if (input.call.kind === "automatic_retry" && turn.recovery) {
      turn.recovery.status = "manual_available";
      turn.recovery.completedAt = now;
      trajectory.pendingTurnId = turn.id;
    } else if (input.call.kind === "manual_retry" && turn.recovery) {
      turn.recovery.status = "exhausted";
      turn.recovery.completedAt = now;
      trajectory.pendingTurnId = turn.id;
    } else {
      trajectory.pendingTurnId = null;
    }
    trajectory.status = input.protectedFailure
      ? "protected_failure"
      : "technical_failure";
    trajectory.technicalError = input.protectedFailure
      ? null
      : input.call.errorCode ?? input.issues[0] ?? "PROVIDER_FAILED";
    input.state.updatedAt = now;
  }

  private applyVisibleOutput(input: {
    state: Gi088BatchState;
    call: Gi088FoundationCallRecord;
    output: Gi088SemanticDeltaOutput;
    maintenance: NonNullable<Gi088Turn["stateMaintenance"]>;
    automaticRecovery: boolean;
    manualRecovery: boolean;
  }) {
    const trajectory = taskState(input.state, input.call.taskId).branches.high;
    const turn = trajectory.turns.find((item) => item.id === input.call.turnId)!;
    const turnInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: trajectory.messages,
      latestUserMessageId: turn.userMessageId,
      semanticState: turn.semanticStateBefore
    };
    const nextSemanticState = applyGi088SemanticDeltaValidatedResult({
      input: turnInput,
      output: input.output
    });
    const assistantMessageId = `A${
      trajectory.messages.filter((message) => message.role === "assistant").length
    }`;
    turn.status = input.automaticRecovery
      ? "complete_after_auto_recovery"
      : input.manualRecovery
        ? "complete_after_manual_recovery"
        : "valid";
    turn.semantic = input.output.semantic;
    turn.visible = input.output.visible;
    turn.visibleText = renderGi088SemanticDeltaVisible(input.output);
    turn.evidenceExcerpts = this.evidenceExcerpts(
      trajectory.messages,
      input.output
    );
    turn.semanticStateAfter = nextSemanticState;
    turn.stateMaintenance = input.maintenance;
    turn.failedOutputDiagnostic = null;
    const observation = createGi088QuestionObservation(input.output) ?? {
      questionMarkCount: 0,
      reviewCandidate: "none" as const,
      review: null
    };
    turn.questionObservation = {
      ...observation,
      observationFingerprint: observationFingerprint({
        turnId: turn.id,
        assistantMessageId,
        visibleText: turn.visibleText,
        questionMarkCount: observation.questionMarkCount
      })
    };
    if (turn.recovery && (input.automaticRecovery || input.manualRecovery)) {
      turn.recovery.status = "recovered";
      turn.recovery.completedAt = this.now().toISOString();
    }
    trajectory.messages.push({
      id: assistantMessageId,
      role: "assistant",
      content: turn.visibleText
    });
    trajectory.semanticState = nextSemanticState;
    trajectory.pendingTurnId = null;
    trajectory.status = "running";
    trajectory.technicalError = null;
    input.state.updatedAt = this.now().toISOString();
  }

  private interventionSpecs(input: {
    run: Gi088FoundationRunRecord;
    call: Gi088FoundationCallRecord;
    controlDecision: InterviewControlDecisionV2;
    maintenance: NonNullable<Gi088Turn["stateMaintenance"]> | null;
    issues: string[];
    absorbedFailure: boolean;
  }) {
    const specs: Array<{
      id: string;
      runId: string;
      taskId: string;
      branch: string;
      turnId: string;
      callId: string;
      clientOperationId: string;
      interventionType: string;
      originalAction: string | null;
      effectiveAction: string;
      evidenceSpan: string | null;
      controlDecision: Gi088FoundationJson;
      traceSummary: Gi088FoundationJson;
      observationFingerprint: string;
    }> = [];
    const add = (
      interventionType: string,
      originalAction: string | null,
      effectiveAction: string,
      traceSummary: unknown
    ) => {
      const core = {
        callId: input.call.callId,
        interventionType,
        effectiveAction,
        traceSummary
      };
      specs.push({
        id: `intervention:${input.call.callId}:${interventionType}`,
        runId: input.run.id,
        taskId: input.call.taskId,
        branch: input.call.branch,
        turnId: input.call.turnId,
        callId: input.call.callId,
        clientOperationId: input.call.clientOperationId,
        interventionType,
        originalAction,
        effectiveAction,
        evidenceSpan:
          input.controlDecision.candidates
            .filter((candidate) => candidate.effective)
            .at(-1)?.evidenceSpan ?? null,
        controlDecision: json(input.controlDecision),
        traceSummary: json(traceSummary),
        observationFingerprint: createGi088FoundationPayloadHash(json(core))
      });
    };
    if (input.controlDecision.finalAction === "stop_follow_up") {
      add(
        "mixed_stop",
        "stop_follow_up",
        "absorb_content_then_deterministic_pause",
        { absorbedFailure: input.absorbedFailure }
      );
    }
    if (input.maintenance?.sourceCompletion?.reviewCandidate) {
      add("source_completion", "missing_source_refs", "complete_source_refs", {
        sourceCompletion: input.maintenance.sourceCompletion
      });
    }
    if (input.absorbedFailure) {
      add("technical_failure_absorption", "provider_failure", "deterministic_pause", {
        issues: input.issues
      });
    }
    if (input.issues.includes("UNAUTHORIZED_PAUSE")) {
      add("unauthorized_pause_recovery", "pause", "automatic_recovery", {
        issues: input.issues
      });
    } else if (input.issues.includes("NEW_ANSWER_OPPORTUNITY_UNAVAILABLE")) {
      add("stage_transition_recovery", "invalid_stage_transition", "automatic_recovery", {
        issues: input.issues
      });
    }
    return specs;
  }

  private async ensureFinalizedInterventions(call: Gi088FoundationCallRecord) {
    const result = call.finalizedResult as unknown;
    if (!result || typeof result !== "object" || Array.isArray(result)) return;
    const interventions = (result as Record<string, unknown>).interventions;
    if (!Array.isArray(interventions)) return;
    for (const value of interventions) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      await this.store.appendProgramIntervention(
        value as Parameters<Gi088EvaluationFoundationStore["appendProgramIntervention"]>[0]
      );
    }
  }

  async finalizeCall(callId: string, ownerUserId: string) {
    for (let attempt = 0; attempt < MAX_FINALIZER_CAS_ATTEMPTS; attempt += 1) {
      let call = await this.store.findCall(callId);
      if (!call) throw new Gi088EvaluationError("GI088_RESERVED_CALL_NOT_FOUND");
      let run = await this.requireRun(ownerUserId, call.runId);
      if (call.status === "finalized") {
        await this.ensureFinalizedInterventions(call);
        return run;
      }
      if (
        call.status !== "provider_succeeded" &&
        call.status !== "provider_failed"
      ) {
        throw new Gi088EvaluationError("GI088_CALL_FINALIZATION_FAILED");
      }
      const state = structuredClone(parseState(run));
      const trajectory = taskState(state, call!.taskId).branches.high;
      const turn = trajectory.turns.find((item) => item.id === call!.turnId);
      if (
        !turn ||
        trajectory.pendingTurnId !== turn.id ||
        turn.activeCallId !== call.callId
      ) {
        await this.store.compareAndSetCallStatus({
          callId,
          expectedStatuses: [call.status],
          nextStatus: "superseded",
          errorCode: "LATE_RESULT_SUPERSEDED"
        });
        return run;
      }
      if (
        createGi088FoundationPayloadHash(json(turn.semanticStateBefore)) !==
        call.semanticStateBeforeHash
      ) {
        await this.store.compareAndSetCallStatus({
          callId,
          expectedStatuses: [call.status],
          nextStatus: "finalization_failed",
          errorCode: "SEMANTIC_STATE_BEFORE_HASH_MISMATCH",
          finalizationError: "SEMANTIC_STATE_BEFORE_HASH_MISMATCH"
        });
        throw new Gi088EvaluationError("GI088_CALL_FINALIZATION_FAILED");
      }
      const controlDecision = turn.controlDecision as InterviewControlDecisionV2;
      const explicitStop = assessExplicitStopFromControlDecision(controlDecision);
      const turnInput: Board7bWorkingTaskV1TurnInput = {
        mode: "accompany_chat",
        conversation: trajectory.messages,
        latestUserMessageId: turn.userMessageId,
        semanticState: turn.semanticStateBefore
      };
      let issues: string[] = [];
      let maintenance: NonNullable<Gi088Turn["stateMaintenance"]> | null = null;
      let effectiveOutput: Gi088SemanticDeltaOutput | null = null;
      let protectedFailure = false;
      let absorbedFailure = false;
      let finalErrorCode: string | null = call.errorCode;

      if (call.status === "provider_failed") {
        if (explicitStop === "mixed") {
          const deterministic = createGi088DeterministicPauseOutput({
            turnInput,
            explicitStop: "mixed"
          });
          effectiveOutput = deterministic.output;
          maintenance = deterministic.maintenance;
          maintenance.providerFailureAbsorbed = true;
          absorbedFailure = true;
          issues = [`DETERMINISTIC_STOP_ABSORBED:${call.errorCode ?? "PROVIDER_FAILED"}`];
        } else {
          issues = [call.errorCode ?? "PROVIDER_FAILED"];
        }
      } else {
        try {
          const parsed = parseGi088SemanticDeltaCandidateOutput(
            call.rawFinalOutput ?? ""
          );
          const normalized = normalizeGi088DeterministicStateOutput({
            turnInput,
            output: parsed,
            explicitStop
          });
          effectiveOutput = assertGi088SemanticDeltaOutput(normalized.output);
          maintenance = normalized.maintenance;
          const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
            turnInput,
            effectiveOutput
          );
          issues = [
            ...validateGi088SemanticDeltaOutput({
              input: turnInput,
              output: effectiveOutput,
              deterministicStateMaintenance: true,
              controlDecisionFinalAction: controlDecision.finalAction
            }),
            ...validateGi088StageTransitionOutput({
              input: turnInput,
              output: compatibility
            })
          ];
        } catch (error) {
          issues = createGi088OutputSchemaIssues(error);
        }
        if (issues.length > 0) {
          if (explicitStop === "mixed") {
            const deterministic = createGi088DeterministicPauseOutput({
              turnInput,
              explicitStop: "mixed"
            });
            effectiveOutput = deterministic.output;
            maintenance = deterministic.maintenance;
            maintenance.providerFailureAbsorbed = true;
            absorbedFailure = true;
          } else {
            protectedFailure = true;
            finalErrorCode = issues.includes("UNAUTHORIZED_PAUSE")
              ? "UNAUTHORIZED_PAUSE"
              : "MODEL_OUTPUT_PROTECTED";
            effectiveOutput = null;
            maintenance = null;
          }
        }
      }

      const recoveryTrigger = this.recoveryTriggerFor({ call, issues });
      if (effectiveOutput && maintenance) {
        this.applyVisibleOutput({
          state,
          call,
          output: effectiveOutput,
          maintenance,
          automaticRecovery: call.kind === "automatic_retry",
          manualRecovery: call.kind === "manual_retry"
        });
      } else {
        this.setFailedTurn({
          state,
          call,
          issues,
          protectedFailure,
          recoveryTrigger
        });
      }
      const interventionSpecs = this.interventionSpecs({
        run,
        call,
        controlDecision,
        maintenance,
        issues,
        absorbedFailure
      });
      const allCalls = await this.store.listCalls(run.id);
      const interventions = await this.store.listProgramInterventions(run.id);
      const finalizedAt = this.now();
      const gate = gateFor({
        run,
        state,
        calls: allCalls.map((item) =>
          item.callId === callId
            ? {
                ...item,
                status: "finalized" as const,
                finalizedAt,
                errorCode: finalErrorCode
              }
            : item
        ),
        interventions: [
          ...interventions,
          ...interventionSpecs.map((item) => ({
            ...item,
            reviewOutcome: null,
            reviewReason: null,
            reviewedAt: null,
            createdAt: finalizedAt,
            updatedAt: finalizedAt
          }))
        ],
        now: finalizedAt
      });
      try {
        const finalized = await this.store.finalizeCall({
          mutation: {
            runId: run.id,
            ownerUserId: run.ownerUserId,
            expectedRevision: run.revision,
            expectedExecutionFingerprint: this.executionFingerprint,
            nextState: json(state),
            nextGateStatus: gate.status,
            nextGateReasons: json(gate.reasons)
          },
          callId,
          finalizedAt,
          finalizedResult: json({
            turnId: call.turnId,
            assistantCommitted: Boolean(effectiveOutput),
            validationIssues: issues,
            interventions: interventionSpecs
          }),
          errorCode: finalErrorCode,
          operation: {
            clientOperationId: call.clientOperationId,
            resultSnapshot: json({
              runId: run.id,
              turnId: call.turnId,
              callId: call.callId,
              status: "finalized",
              recoveryTrigger
            })
          }
        });
        call = finalized.call;
        run = finalized.run;
        await this.ensureFinalizedInterventions(call);
        return run;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "GI088_CONCURRENT_UPDATE" &&
          attempt + 1 < MAX_FINALIZER_CAS_ATTEMPTS
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new Gi088EvaluationError("GI088_CALL_FINALIZATION_FAILED", 503, true);
  }

  private async maybeExecuteAutomaticRecovery(input: {
    run: Gi088FoundationRunRecord;
    turnId: string;
    provider: AIProvider;
    onProgress?: (event: Gi088FoundationExecutionEvent) => void;
  }) {
    const run = await this.requireRun(input.run.ownerUserId, input.run.id);
    const state = structuredClone(parseState(run));
    let task: Gi088TaskState | null = null;
    let trajectory: Gi088Trajectory | null = null;
    let turn: Gi088Turn | null = null;
    for (const candidateTask of state.tasks) {
      const candidateTrajectory = candidateTask.branches.high;
      const candidateTurn = candidateTrajectory.turns.find(
        (item) => item.id === input.turnId
      );
      if (candidateTurn) {
        task = candidateTask;
        trajectory = candidateTrajectory;
        turn = candidateTurn;
        break;
      }
    }
    if (!task || !trajectory || !turn || turn.recovery?.status !== "eligible") {
      return run;
    }
    const initialCall = await this.store.findCall(turn.recovery.initialCallId);
    if (!initialCall) return run;
    const automaticDeadlineAt = initialCall.automaticDeadlineAt ??
      new Date(
        (initialCall.dispatchedAt ?? initialCall.reservedAt).getTime() +
          GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs
      );
    const remaining = automaticDeadlineAt.getTime() - this.now().getTime();
    if (remaining <= 0) {
      turn.recovery.status = "manual_available";
      turn.recovery.completedAt = this.now().toISOString();
      const operation = operationIdentity({
        ownerUserId: run.ownerUserId,
        evaluationVersion: run.evaluationVersion,
        runId: run.id,
        clientOperationId: `auto-deadline:${turn.id}`,
        action: "automatic_recovery_deadline",
        payload: { turnId: turn.id, automaticDeadlineAt }
      });
      const result = await this.store.commitRunMutation({
        mutation: {
          runId: run.id,
          ownerUserId: run.ownerUserId,
          expectedRevision: run.revision,
          expectedExecutionFingerprint: this.executionFingerprint,
          nextState: json(state)
        },
        operation,
        resultSnapshot: json({ turnId: turn.id, status: "manual_available" })
      });
      return result.run;
    }
    const trigger = turn.recovery.trigger;
    const hardTimeoutMs = Math.max(
      1,
      Math.min(
        GI088_SHARED_RECOVERY_DEADLINE_POLICY.maximumSingleCallMs,
        remaining
      )
    );
    const turnInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: trajectory.messages,
      latestUserMessageId: turn.userMessageId,
      semanticState: turn.semanticStateBefore
    };
    const controlDecision = turn.controlDecision as InterviewControlDecisionV2;
    const completionParams = this.createCompletionParams({
      turnInput,
      controlDecision,
      recoveryTrigger: trigger,
      hardTimeoutMs
    });
    const callId = randomUUID();
    const operationClientId = `auto-recovery:${turn.id}`;
    const operation = operationIdentity({
      ownerUserId: run.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: operationClientId,
      action: "automatic_recovery",
      payload: {
        turnId: turn.id,
        parentCallId: initialCall.callId,
        trigger
      }
    });
    turn.status = "processing";
    turn.activeCallId = callId;
    turn.recovery.status = "retrying";
    turn.recovery.automaticRetryCount = 1;
    turn.recovery.recoveryCallId = callId;
    turn.recovery.startedAt = this.now().toISOString();
    trajectory.status = "running";
    trajectory.technicalError = null;
    state.updatedAt = this.now().toISOString();
    const reservedAt = this.now();
    const reserved = await this.store.reserveRecoveryCall({
      mutation: {
        runId: run.id,
        ownerUserId: run.ownerUserId,
        expectedRevision: run.revision,
        expectedExecutionFingerprint: this.executionFingerprint,
        nextState: json(state)
      },
      operation,
      call: {
        callId,
        runId: run.id,
        taskId: task.taskId,
        branch: "high",
        turnId: turn.id,
        clientTurnId: turn.clientTurnId,
        clientOperationId: operation.clientOperationId,
        attempt: 2,
        kind: "automatic_retry",
        parentCallId: initialCall.callId,
        retryTrigger: trigger,
        requestHash: sha256(JSON.stringify(completionParams)),
        effectiveConfig: json(this.createEffectiveConfig({
          recoveryTrigger: trigger,
          hardTimeoutMs,
          remainingSharedDeadlineMs: remaining
        })),
        baseAssistantMessageId: turn.baseAssistantMessageId,
        semanticStateBeforeHash: createGi088FoundationPayloadHash(
          json(turn.semanticStateBefore)
        ),
        automaticDeadlineAt,
        reservedAt
      }
    });
    if (!reserved.claimed) return reserved.run;
    input.onProgress?.({
      type: "recovery_started",
      trigger,
      turnId: turn.id,
      callId: reserved.call.callId
    });
    await this.executeDispatchedCall({
      run: reserved.run,
      call: reserved.call,
      provider: input.provider,
      turnInput,
      controlDecision,
      completionParams,
      onProgress: input.onProgress
    });
    return this.requireRun(run.ownerUserId, run.id);
  }

  async retry(input: {
    ownerUserId: string;
    runId: string;
    taskId: string;
    branch: "high";
    turnId: string;
    trigger: "manual_after_auto_recovery";
    clientOperationId: string;
    onProgress?: (event: Gi088FoundationExecutionEvent) => void;
  }) {
    let run = await this.requireRun(input.ownerUserId, input.runId);
    this.assertMutable(run);
    const payload = {
      runId: input.runId,
      taskId: input.taskId,
      branch: input.branch,
      turnId: input.turnId,
      trigger: input.trigger
    };
    const operation = operationIdentity({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: input.clientOperationId,
      action: "manual_after_auto_recovery",
      payload
    });
    const replay = await this.replayOperationIfPresent({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: input.clientOperationId,
      action: operation.action,
      payloadHash: operation.payloadHash,
      runId: run.id
    });
    if (replay) return replay;
    this.authorizeModelCall("high");
    const provider = await this.getProvider();
    const state = structuredClone(parseState(run));
    const trajectory = taskState(state, input.taskId).branches.high;
    const turn = trajectory.turns.find((item) => item.id === input.turnId);
    if (
      !turn ||
      trajectory.pendingTurnId !== turn.id ||
      turn.recovery?.status !== "manual_available" ||
      (turn.recovery.automaticRetryCount !== 0 &&
        turn.recovery.automaticRetryCount !== 1) ||
      turn.recovery.manualRetryCount !== 0
    ) {
      throw new Gi088EvaluationError(
        "GI088_MANUAL_AFTER_AUTO_RECOVERY_UNAVAILABLE"
      );
    }
    const calls = (await this.store.listCalls(run.id))
      .filter((call) => call.turnId === turn.id)
      .sort((left, right) => left.attempt - right.attempt);
    const parentCall = calls.at(-1);
    if (
      !parentCall ||
      parentCall.attempt < 1 ||
      parentCall.attempt >= 3 ||
      calls.length !== parentCall.attempt ||
      (turn.recovery.automaticRetryCount === 1 &&
        (parentCall.attempt !== 2 || parentCall.kind !== "automatic_retry")) ||
      (turn.recovery.automaticRetryCount === 0 && parentCall.attempt !== 1)
    ) {
      throw new Gi088EvaluationError("GI088_TECHNICAL_RETRY_LIMIT_REACHED");
    }
    const nextAttempt = parentCall.attempt + 1;
    const turnInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: trajectory.messages,
      latestUserMessageId: turn.userMessageId,
      semanticState: turn.semanticStateBefore
    };
    const controlDecision = turn.controlDecision as InterviewControlDecisionV2;
    const completionParams = this.createCompletionParams({
      turnInput,
      controlDecision,
      hardTimeoutMs: GI088_SHARED_RECOVERY_DEADLINE_POLICY.manualRetryHardTimeoutMs
    });
    const callId = randomUUID();
    turn.status = "processing";
    turn.activeCallId = callId;
    turn.recovery.status = "manual_retrying";
    turn.recovery.manualRetryCount = 1;
    turn.recovery.manualRetryCallId = callId;
    turn.recovery.startedAt = this.now().toISOString();
    trajectory.status = "running";
    trajectory.technicalError = null;
    state.updatedAt = this.now().toISOString();
    const reserved = await this.store.reserveRecoveryCall({
      mutation: {
        runId: run.id,
        ownerUserId: run.ownerUserId,
        expectedRevision: run.revision,
        expectedExecutionFingerprint: this.executionFingerprint,
        nextState: json(state)
      },
      operation,
      call: {
        callId,
        runId: run.id,
        taskId: input.taskId,
        branch: "high",
        turnId: turn.id,
        clientTurnId: turn.clientTurnId,
        clientOperationId: operation.clientOperationId,
        attempt: nextAttempt,
        kind: "manual_retry",
        parentCallId: parentCall.callId,
        retryTrigger: turn.recovery.trigger,
        requestHash: sha256(JSON.stringify(completionParams)),
        effectiveConfig: json(this.createEffectiveConfig({
          hardTimeoutMs:
            GI088_SHARED_RECOVERY_DEADLINE_POLICY.manualRetryHardTimeoutMs,
          remainingSharedDeadlineMs: null
        })),
        baseAssistantMessageId: turn.baseAssistantMessageId,
        semanticStateBeforeHash: createGi088FoundationPayloadHash(
          json(turn.semanticStateBefore)
        ),
        automaticDeadlineAt: null,
        reservedAt: this.now()
      }
    });
    if (!reserved.claimed) {
      return this.createPublicSession(await this.reconcileRun(reserved.run));
    }
    await this.executeDispatchedCall({
      run: reserved.run,
      call: reserved.call,
      provider,
      turnInput,
      controlDecision,
      completionParams,
      onProgress: input.onProgress
    });
    run = await this.requireRun(input.ownerUserId, input.runId);
    return this.createPublicSession(await this.reconcileRun(run));
  }

  private async commitSimpleMutation(input: {
    run: Gi088FoundationRunRecord;
    state: Gi088BatchState;
    operation: Gi088FoundationOperationIdentity;
    resultSnapshot: unknown;
    nextStatus?: "running" | "sealed" | "early_stopped";
    sealedAt?: Date | null;
  }) {
    const [calls, interventions] = await Promise.all([
      this.store.listCalls(input.run.id),
      this.store.listProgramInterventions(input.run.id)
    ]);
    const gate = gateFor({
      run: input.run,
      state: input.state,
      calls,
      interventions,
      now: this.now()
    });
    return this.store.commitRunMutation({
      mutation: {
        runId: input.run.id,
        ownerUserId: input.run.ownerUserId,
        expectedRevision: input.run.revision,
        expectedExecutionFingerprint: this.executionFingerprint,
        nextState: json(input.state),
        nextStatus: input.nextStatus,
        nextGateStatus: gate.status,
        nextGateReasons: json(gate.reasons),
        sealedAt: input.sealedAt
      },
      operation: input.operation,
      resultSnapshot: json(input.resultSnapshot)
    });
  }

  async reviewQuestion(input: {
    ownerUserId: string;
    runId: string;
    taskId: string;
    branch: "high";
    turnId: string;
    questionPresence: "present" | "absent" | "uncertain";
    classification?: Gi088QuestionReviewClassification;
    note: string;
    observationFingerprint: string;
    clientOperationId: string;
    revisionReason?: string;
  }) {
    let run = await this.requireRun(input.ownerUserId, input.runId);
    this.assertMutable(run);
    const note = input.note.trim();
    if (note.length > 1_000) {
      throw new Gi088EvaluationError("GI088_QUESTION_REVIEW_NOTE_INVALID");
    }
    if (input.questionPresence === "present" && !input.classification) {
      throw new Gi088EvaluationError(
        "GI088_QUESTION_REVIEW_CLASSIFICATION_INVALID"
      );
    }
    const payload = {
      runId: input.runId,
      taskId: input.taskId,
      branch: input.branch,
      turnId: input.turnId,
      questionPresence: input.questionPresence,
      classification: input.classification ?? null,
      note,
      observationFingerprint: input.observationFingerprint,
      revisionReason: input.revisionReason?.trim() ?? null
    };
    const operation = operationIdentity({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: input.clientOperationId,
      action: "question_review",
      payload
    });
    const replay = await this.replayOperationIfPresent({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: input.clientOperationId,
      action: operation.action,
      payloadHash: operation.payloadHash,
      runId: run.id
    });
    if (replay) return replay;
    const state = structuredClone(parseState(run));
    const trajectory = taskState(state, input.taskId).branches.high;
    if (trajectory.pendingTurnId) {
      throw new Gi088EvaluationError("GI088_REVIEW_DURING_PROCESSING");
    }
    const turn = trajectory.turns.find((item) => item.id === input.turnId);
    if (
      !turn?.questionObservation ||
      turn.questionObservation.observationFingerprint !==
        input.observationFingerprint
    ) {
      throw new Gi088EvaluationError("GI088_REVIEW_SNAPSHOT_OUT_OF_DATE");
    }
    const oldValue = turn.questionObservation.review;
    const newValue = {
      questionPresence: input.questionPresence,
      ...(input.classification
        ? { classification: input.classification }
        : {}),
      note,
      reviewedAt: this.now().toISOString()
    };
    turn.questionObservation.questionPresence = input.questionPresence;
    turn.questionObservation.review = newValue;
    state.updatedAt = this.now().toISOString();
    const [calls, interventions] = await Promise.all([
      this.store.listCalls(run.id),
      this.store.listProgramInterventions(run.id)
    ]);
    const gate = gateFor({ run, state, calls, interventions, now: this.now() });
    if (oldValue) {
      const reason = input.revisionReason?.trim() ?? "";
      if (!reason || reason.length > 1_000) {
        throw new Gi088EvaluationError("GI088_REVIEW_REASON_INVALID");
      }
      const result = await this.store.commitReviewMutation({
        mutation: {
          runId: run.id,
          ownerUserId: run.ownerUserId,
          expectedRevision: run.revision,
          expectedExecutionFingerprint: this.executionFingerprint,
          nextState: json(state),
          nextGateStatus: gate.status,
          nextGateReasons: json(gate.reasons)
        },
        operation,
        revision: {
          id: randomUUID(),
          runId: run.id,
          subjectType: "question_review",
          subjectId: turn.id,
          oldValue: json(oldValue),
          newValue: json(newValue),
          reason,
          actorUserId: input.ownerUserId,
          clientOperationId: input.clientOperationId
        },
        resultSnapshot: json({ turnId: turn.id, review: newValue })
      });
      run = result.run;
    } else {
      run = (await this.commitSimpleMutation({
        run,
        state,
        operation,
        resultSnapshot: { turnId: turn.id, review: newValue }
      })).run;
    }
    return this.createPublicSession(run, input.taskId);
  }

  async endTrajectory(input: {
    ownerUserId: string;
    runId: string;
    taskId: string;
    branch: "high";
    feeling: "better" | "same" | "worse";
    quality: "direct_use" | "minor_issue" | "quality_failure" | "single_case_blocker";
    targetTrigger: Exclude<Gi088TargetTrigger, "legacy_unknown">;
    reason: string;
    reviewSnapshotFingerprint: string;
    clientOperationId: string;
    revisionReason?: string;
  }) {
    let run = await this.requireRun(input.ownerUserId, input.runId);
    this.assertMutable(run);
    const reason = input.reason.trim();
    if (!reason || reason.length > 2_000) {
      throw new Gi088EvaluationError("GI088_REVIEW_REASON_INVALID");
    }
    const payload = { ...input, reason };
    const operation = operationIdentity({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: input.clientOperationId,
      action: "end_trajectory",
      payload
    });
    const replay = await this.replayOperationIfPresent({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: input.clientOperationId,
      action: operation.action,
      payloadHash: operation.payloadHash,
      runId: run.id
    });
    if (replay) return replay;
    const state = structuredClone(parseState(run));
    const trajectory = taskState(state, input.taskId).branches.high;
    const interventions = await this.store.listProgramInterventions(run.id);
    const currentFingerprint = reviewSnapshotFingerprint({
      runId: run.id,
      taskId: input.taskId,
      branch: "high",
      trajectory,
      interventions
    });
    if (currentFingerprint !== input.reviewSnapshotFingerprint) {
      throw new Gi088EvaluationError("GI088_REVIEW_SNAPSHOT_OUT_OF_DATE");
    }
    if (
      trajectory.pendingTurnId ||
      trajectory.turns.some(
        (turn) => turn.questionObservation && !turn.questionObservation.review
      ) ||
      interventions.some(
        (item) =>
          item.taskId === input.taskId &&
          item.branch === "high" &&
          item.reviewOutcome === null
      )
    ) {
      throw new Gi088EvaluationError("GI088_QUESTION_REVIEWS_REQUIRED");
    }
    if (
      trajectory.status !== "running" &&
      trajectory.status !== "technical_failure" &&
      trajectory.status !== "protected_failure" &&
      trajectory.status !== "completed"
    ) {
      throw new Gi088EvaluationError("GI088_TRAJECTORY_CANNOT_END");
    }
    const oldValue = trajectory.review;
    const newValue: Gi088TrajectoryReview = {
      feeling: input.feeling,
      quality: input.quality,
      targetTrigger: input.targetTrigger,
      reason,
      reviewedAt: this.now().toISOString()
    };
    trajectory.review = newValue;
    if (!oldValue) {
      if (state.activeTaskId !== input.taskId) {
        throw new Gi088EvaluationError("GI088_TASK_NOT_ACTIVE");
      }
      trajectory.status = "completed";
      trajectory.pendingTurnId = null;
      trajectory.completedAt = this.now().toISOString();
      state.activeTaskId = null;
    }
    state.updatedAt = this.now().toISOString();
    const calls = await this.store.listCalls(run.id);
    const gate = gateFor({ run, state, calls, interventions, now: this.now() });
    if (oldValue) {
      const revisionReason = input.revisionReason?.trim() ?? "";
      if (!revisionReason || revisionReason.length > 1_000) {
        throw new Gi088EvaluationError("GI088_REVIEW_REASON_INVALID");
      }
      const result = await this.store.commitReviewMutation({
        mutation: {
          runId: run.id,
          ownerUserId: run.ownerUserId,
          expectedRevision: run.revision,
          expectedExecutionFingerprint: this.executionFingerprint,
          nextState: json(state),
          nextGateStatus: gate.status,
          nextGateReasons: json(gate.reasons)
        },
        operation,
        revision: {
          id: randomUUID(),
          runId: run.id,
          subjectType: "trajectory_review",
          subjectId: trajectory.id,
          oldValue: json(oldValue),
          newValue: json(newValue),
          reason: revisionReason,
          actorUserId: input.ownerUserId,
          clientOperationId: input.clientOperationId
        },
        resultSnapshot: json({ trajectoryId: trajectory.id, review: newValue })
      });
      run = result.run;
    } else {
      run = (await this.commitSimpleMutation({
        run,
        state,
        operation,
        resultSnapshot: { trajectoryId: trajectory.id, review: newValue }
      })).run;
    }
    return this.createPublicSession(run, input.taskId);
  }

  async reviewProgramIntervention(input: {
    ownerUserId: string;
    runId: string;
    interventionId: string;
    observationFingerprint: string;
    outcome: "correct" | "false_positive" | "uncertain";
    reason: string;
    clientOperationId: string;
  }) {
    let run = await this.requireRun(input.ownerUserId, input.runId);
    this.assertMutable(run);
    const reason = input.reason.trim();
    if (!reason || reason.length > 1_000) {
      throw new Gi088EvaluationError("GI088_INTERVENTION_REVIEW_INPUT_INVALID");
    }
    const payload = { ...input, reason };
    const operation = operationIdentity({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: input.clientOperationId,
      action: "program_intervention_review",
      payload
    });
    const replay = await this.replayOperationIfPresent({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: input.clientOperationId,
      action: operation.action,
      payloadHash: operation.payloadHash,
      runId: run.id
    });
    if (replay) return replay;
    const interventions = await this.store.listProgramInterventions(run.id);
    const intervention = interventions.find((item) => item.id === input.interventionId);
    if (!intervention) {
      throw new Gi088EvaluationError("GI088_INTERVENTION_NOT_FOUND");
    }
    if (intervention.observationFingerprint !== input.observationFingerprint) {
      throw new Gi088EvaluationError("GI088_REVIEW_SNAPSHOT_OUT_OF_DATE");
    }
    const state = structuredClone(parseState(run));
    const virtualInterventions = interventions.map((item) =>
      item.id === intervention.id
        ? {
            ...item,
            reviewOutcome: input.outcome,
            reviewReason: reason,
            reviewedAt: this.now()
          }
        : item
    );
    const calls = await this.store.listCalls(run.id);
    const gate = gateFor({
      run,
      state,
      calls,
      interventions: virtualInterventions,
      now: this.now()
    });
    const oldValue = intervention.reviewOutcome
      ? {
          outcome: intervention.reviewOutcome,
          reason: intervention.reviewReason,
          reviewedAt: dateIso(intervention.reviewedAt)
        }
      : null;
    const newValue = {
      outcome: input.outcome,
      reason,
      reviewedAt: this.now().toISOString()
    };
    const result = await this.store.reviewProgramIntervention({
      mutation: {
        runId: run.id,
        ownerUserId: run.ownerUserId,
        expectedRevision: run.revision,
        expectedExecutionFingerprint: this.executionFingerprint,
        nextState: json(state),
        nextGateStatus: gate.status,
        nextGateReasons: json(gate.reasons)
      },
      operation,
      interventionId: intervention.id,
      observationFingerprint: input.observationFingerprint,
      reviewOutcome: input.outcome,
      reviewReason: reason,
      reviewedAt: this.now(),
      revision: {
        id: randomUUID(),
        runId: run.id,
        subjectType: "program_intervention_review",
        subjectId: intervention.id,
        oldValue: json(oldValue),
        newValue: json(newValue),
        reason,
        actorUserId: input.ownerUserId,
        clientOperationId: input.clientOperationId
      },
      resultSnapshot: json({ interventionId: intervention.id, review: newValue })
    });
    run = result.run;
    return this.createPublicSession(run, intervention.taskId);
  }

  async abortCurrentTask(input: {
    ownerUserId: string;
    runId: string;
    taskId: string;
    reason: string;
    confirmation: true;
    clientOperationId: string;
    abandonRecovery?: boolean;
  }) {
    let run = await this.requireRun(input.ownerUserId, input.runId);
    this.assertMutable(run);
    const reason = input.reason.trim();
    if (!reason || reason.length > 2_000 || input.confirmation !== true) {
      throw new Gi088EvaluationError("GI088_ABORT_INPUT_INVALID");
    }
    const payload = {
      runId: input.runId,
      taskId: input.taskId,
      reason,
      confirmation: true,
      abandonRecovery: input.abandonRecovery === true
    };
    const operation = operationIdentity({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: input.clientOperationId,
      action: "abort_current_task",
      payload
    });
    const replay = await this.replayOperationIfPresent({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: input.clientOperationId,
      action: operation.action,
      payloadHash: operation.payloadHash,
      runId: run.id
    });
    if (replay) return replay;
    const state = structuredClone(parseState(run));
    const task = taskState(state, input.taskId);
    if (state.activeTaskId !== input.taskId || taskCompleted(task) || taskAborted(task)) {
      throw new Gi088EvaluationError("GI088_ABORT_UNAVAILABLE");
    }
    const trajectory = task.branches.high;
    const activeCall = trajectory.pendingTurnId
      ? (await this.store.listCalls(run.id))
          .filter((call) => call.turnId === trajectory.pendingTurnId)
          .sort((left, right) => right.attempt - left.attempt)
          .at(0) ?? null
      : null;
    const supersedableStatuses = [
      "reserved",
      "dispatched",
      "provider_succeeded",
      "provider_failed",
      "finalization_failed",
      "interrupted_unknown_dispatch"
    ] as const;
    const canSupersedeActiveCall = Boolean(
      activeCall && supersedableStatuses.includes(
        activeCall.status as (typeof supersedableStatuses)[number]
      )
    );
    if (
      activeCall && canSupersedeActiveCall
    ) {
      if (!input.abandonRecovery) {
        throw new Gi088EvaluationError("GI088_ABORT_UNAVAILABLE");
      }
    }
    const abortedAt = this.now().toISOString();
    task.aborted = {
      reason,
      abortedAt,
      turnId: trajectory.pendingTurnId
    };
    trajectory.status = "aborted";
    trajectory.abortedAt = abortedAt;
    trajectory.abortReason = reason;
    trajectory.pendingTurnId = null;
    trajectory.technicalError = null;
    state.activeTaskId = null;
    state.updatedAt = abortedAt;
    const resultSnapshot = {
      taskId: input.taskId,
      status: "aborted",
      abandonedCallId: activeCall?.callId ?? null
    };
    if (activeCall && canSupersedeActiveCall) {
      const [calls, interventions] = await Promise.all([
        this.store.listCalls(run.id),
        this.store.listProgramInterventions(run.id)
      ]);
      const gate = gateFor({
        run,
        state,
        calls: calls.map((item) =>
          item.callId === activeCall.callId
            ? {
                ...item,
                status: "superseded" as const,
                errorCode: "ABORTED_WITH_PARTIAL_EVIDENCE"
              }
            : item
        ),
        interventions,
        now: this.now()
      });
      run = (await this.store.supersedeCallAndCommitRun({
        mutation: {
          runId: run.id,
          ownerUserId: run.ownerUserId,
          expectedRevision: run.revision,
          expectedExecutionFingerprint: this.executionFingerprint,
          nextState: json(state),
          nextGateStatus: gate.status,
          nextGateReasons: json(gate.reasons)
        },
        operation,
        resultSnapshot: json(resultSnapshot),
        callId: activeCall.callId,
        expectedStatuses: [activeCall.status],
        errorCode: "ABORTED_WITH_PARTIAL_EVIDENCE"
      })).run;
    } else {
      run = (await this.commitSimpleMutation({
        run,
        state,
        operation,
        resultSnapshot
      })).run;
    }
    return this.createPublicSession(run, input.taskId);
  }

  async compare() {
    throw new Gi088EvaluationError("GI088_COMPARISON_NOT_REQUIRED");
  }

  async seal(input: {
    ownerUserId: string;
    runId: string;
    clientOperationId: string;
    confirmation: true;
  }) {
    let run = await this.requireRun(input.ownerUserId, input.runId);
    this.assertMutable(run);
    if (input.confirmation !== true) {
      throw new Gi088EvaluationError("GI088_SEAL_INPUT_INVALID");
    }
    const payload = { runId: input.runId, confirmation: true };
    const operation = operationIdentity({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: input.clientOperationId,
      action: "seal_run",
      payload
    });
    const replay = await this.replayOperationIfPresent({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: input.clientOperationId,
      action: operation.action,
      payloadHash: operation.payloadHash,
      runId: run.id
    });
    if (replay) return replay;
    const state = structuredClone(parseState(run));
    if (
      state.activeTaskId !== null ||
      state.tasks.some((task) => !taskCompletedFor(state, task) && !taskAborted(task))
    ) {
      throw new Gi088EvaluationError("GI088_BATCH_INCOMPLETE");
    }
    const terminalAt = this.now();
    state.status = "sealed";
    state.sealedAt = terminalAt.toISOString();
    state.updatedAt = terminalAt.toISOString();
    run = (await this.commitSimpleMutation({
      run,
      state,
      operation,
      resultSnapshot: { runId: run.id, status: "sealed" },
      nextStatus: "sealed",
      sealedAt: terminalAt
    })).run;
    return this.createPublicSession(run);
  }

  async earlyStop(input: {
    ownerUserId: string;
    runId: string;
    reasonCode: Gi088EarlyStopReasonCode;
    reason: string;
    confirmation: true;
    clientOperationId: string;
  }) {
    let run = await this.requireRun(input.ownerUserId, input.runId);
    this.assertMutable(run);
    const reason = input.reason.trim();
    if (!reason || reason.length > 2_000 || input.confirmation !== true) {
      throw new Gi088EvaluationError("GI088_EARLY_STOP_INPUT_INVALID");
    }
    const payload = {
      runId: input.runId,
      reasonCode: input.reasonCode,
      reason,
      confirmation: true
    };
    const operation = operationIdentity({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      runId: run.id,
      clientOperationId: input.clientOperationId,
      action: "early_stop",
      payload
    });
    const replay = await this.replayOperationIfPresent({
      ownerUserId: input.ownerUserId,
      evaluationVersion: run.evaluationVersion,
      clientOperationId: input.clientOperationId,
      action: operation.action,
      payloadHash: operation.payloadHash,
      runId: run.id
    });
    if (replay) return replay;
    const state = structuredClone(parseState(run));
    if (state.activeTaskId !== null) {
      throw new Gi088EvaluationError("GI088_EARLY_STOP_TASK_BOUNDARY_REQUIRED");
    }
    const completedTaskIds = state.tasks
      .filter((task) => taskCompletedFor(state, task) || taskAborted(task))
      .map((task) => task.taskId);
    const remainingTaskIds = state.tasks
      .filter((task) => !taskCompletedFor(state, task) && !taskAborted(task))
      .map((task) => task.taskId);
    if (completedTaskIds.length === 0 || remainingTaskIds.length === 0) {
      throw new Gi088EvaluationError("GI088_EARLY_STOP_TASK_BOUNDARY_REQUIRED");
    }
    const terminalAt = this.now();
    state.status = "early_stopped";
    state.sealedAt = terminalAt.toISOString();
    state.updatedAt = terminalAt.toISOString();
    state.earlyStop = {
      reasonCode: input.reasonCode,
      reason,
      stoppedAt: terminalAt.toISOString(),
      completedTaskIds,
      remainingTaskIds
    };
    run = (await this.commitSimpleMutation({
      run,
      state,
      operation,
      resultSnapshot: { runId: run.id, status: "early_stopped" },
      nextStatus: "early_stopped",
      sealedAt: terminalAt
    })).run;
    return this.createPublicSession(run);
  }

  async appendOperationEvent(input: {
    ownerUserId: string;
    runId: string;
    taskId?: string | null;
    turnId?: string | null;
    route: string;
    code: string;
    safeSummary?: Record<string, string | number | boolean | null> | null;
    clientOperationId: string;
  }) {
    const run = await this.requireRun(input.ownerUserId, input.runId);
    const safeSummary = input.safeSummary
      ? Object.fromEntries(
          Object.entries(input.safeSummary)
            .slice(0, 20)
            .map(([key, value]) => [key.slice(0, 80), value])
        )
      : null;
    const result = await this.store.appendOperationEvent({
      id: randomUUID(),
      runId: run.id,
      taskId: input.taskId ?? null,
      turnId: input.turnId ?? null,
      route: input.route.slice(0, 160),
      code: input.code.slice(0, 160),
      safeSummary: json(safeSummary),
      clientOperationId: input.clientOperationId
    });
    return { accepted: true, eventId: result.event.id };
  }

  async exportRun(input: {
    ownerUserId: string;
    runId: string;
  }): Promise<Gi088ExportEnvelope> {
    const run = await this.requireRun(input.ownerUserId, input.runId);
    const historicalReadOnly =
      run.evaluationVersion !== GI088_EVALUATION_VERSION ||
      run.executionFingerprint !== this.executionFingerprint ||
      run.candidateFingerprint !== this.candidateFingerprint;
    if (run.status === "running" && !historicalReadOnly) {
      throw new Gi088EvaluationError("GI088_BATCH_MUST_BE_TERMINAL");
    }
    const [calls, interventions, revisions, operationEvents] = await Promise.all([
      this.store.listCalls(run.id),
      this.store.listProgramInterventions(run.id),
      this.store.listReviewRevisions(run.id),
      this.store.listOperationEvents(run.id)
    ]);
    const state = parseState(run);
    const usesFoundationLedger =
      run.evaluationVersion === GI088_EVALUATION_VERSION;
    const matchesCurrentBehavior =
      usesFoundationLedger &&
      run.executionFingerprint === this.executionFingerprint &&
      run.candidateFingerprint === this.candidateFingerprint;
    const evaluationMetadata = evaluationMetadataFor(run.evaluationVersion);
    const metrics = metricsFor({ state, calls, interventions });
    const gate = gateFor({ run, state, calls, interventions, now: this.now() });
    const payload = {
      exportVersion: "2026-08-10.gi088-readonly-export-v0.6",
      evaluation: {
        id: evaluationMetadata.id,
        version: run.evaluationVersion,
        serviceVersion: evaluationMetadata.serviceVersion,
        candidateFingerprint: run.candidateFingerprint,
        executionFingerprint: run.executionFingerprint,
        mode: state.evaluationMode ?? "high_only",
        activeBranches:
          state.evaluationMode === "paired" ? ["off", "high"] : GI088_ACTIVE_BRANCHES,
        model: evaluationMetadata.model,
        config: matchesCurrentBehavior
          ? GI088_CONFIGS.high
          : historicalExportConfig(state, evaluationMetadata, calls),
        ...(matchesCurrentBehavior
          ? {
              maximumProviderCallsPerUserSubmission:
                GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION
            }
          : {})
      },
      run: {
        runId: run.id,
        runOrdinal: run.runOrdinal,
        collectionStatus: run.status,
        gate,
        revision: run.revision,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        sealedAt: run.sealedAt
      },
      batch: state,
      callLedger: calls.map((call) => ({
        ...call,
        rawFinalOutput:
          call.status === "finalized" &&
          call.providerResultStatus === "provider_succeeded" &&
          !call.errorCode
            ? call.rawFinalOutput
            : null
      })),
      programInterventions: interventions,
      reviewRevisions: revisions,
      operationEvents,
      metrics
    };
    const envelope = createGi088ExportEnvelope({ payload });
    const stored = await this.store.getOrCreateExportSnapshot({
      ownerUserId: input.ownerUserId,
      runId: run.id,
      exportVersion: envelope.receipt.exportVersion,
      payload: envelope.payload as Gi088FoundationJson,
      recordCounts: json(envelope.receipt.recordCounts)
    });
    return createGi088ExportEnvelope({
      payload: stored.snapshot.payload as Gi088ExportJsonValue,
      issuedAt: stored.snapshot.createdAt
    });
  }
}
