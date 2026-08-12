import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import {
  GI088_CONFIGS,
  GI088_ACTIVE_BRANCHES,
  GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY,
  GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION,
  GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION_VERSION,
  GI088_EMPTY_CONTENT_RECOVERY_POLICY,
  resolveGi088EmptyContentRecoveryPolicy,
  GI088_EVALUATION_ID,
  GI088_EVALUATION_VERSION,
  GI088_FIXED_OPENING,
  GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION,
  GI088_MANUAL_RECOVERY_POLICY,
  GI088_MODEL_CALL_IDENTITY,
  GI088_SHARED_RECOVERY_DEADLINE_POLICY,
  GI088_TASKS,
  GI088_TIMEOUT_POLICY,
  GI088_TIMEOUT_RECOVERY_POLICY,
  createGi088EffectiveCandidateFingerprint,
  createGi088ExecutionFingerprint,
  getGi088CandidateAssets
} from "@/server/services/evaluation/gi088/candidate";
import type { Gi088EvaluationStore } from "@/server/services/evaluation/gi088/store";
import type {
  Gi088BatchState,
  Gi088BranchKey,
  Gi088Call,
  Gi088CallEffectiveConfig,
  Gi088EarlyStopReasonCode,
  Gi088EvaluationMode,
  Gi088Message,
  Gi088PublicSession,
  Gi088QuestionReviewClassification,
  Gi088RecoveryTrigger,
  Gi088StoredBatch,
  Gi088TaskState,
  Gi088TargetTrigger,
  Gi088Trajectory,
  Gi088Turn
} from "@/server/services/evaluation/gi088/types";
import type { AICompletionParams, AIProvider } from "@/server/services/ai/ai-provider";
import {
  AIProviderError,
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAICompletionTokenUsage,
  sanitizeAIProviderDiagnostics,
  takeAIReasoningOnlyContinuation
} from "@/server/services/ai/ai-provider";
import { createGi088ArkProvider } from "@/server/services/evaluation/gi088/ark-runtime";
import { createGi088ModelRequestHash } from "@/server/services/evaluation/gi088/request-identity";
import { requireGi088ModelCallAuthorization } from "@/server/services/evaluation/gi088/access";
import { createGi088OutputSchemaIssues } from "@/server/services/evaluation/gi088/schema-diagnostics";
import {
  GI088_STAGE_TRANSITION_RECOVERY_POLICY,
  createGi088StageTransitionUserPrompt,
  validateGi088StageTransitionOutput
} from "@/server/services/evaluation/gi088/stage-transition";
import {
  applyGi088SingleFocusValidationPolicy,
  createGi088QuestionObservation
} from "@/server/services/evaluation/gi088/single-focus";
import {
  GI088_DETERMINISTIC_STATE_POLICY_VERSION,
  assessGi088ExplicitStop,
  createGi088DeterministicPauseOutput,
  normalizeGi088DeterministicStateOutput
} from "@/server/services/evaluation/gi088/deterministic-state";
import {
  applyGi088SemanticDeltaValidatedResult,
  assertGi088SemanticDeltaOutput,
  parseGi088SemanticDeltaCandidateOutput,
  renderGi088SemanticDeltaVisible,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput,
  type Gi088SemanticDeltaOutput
} from "@/server/services/evaluation/gi088/semantic-delta";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/errors";

export { Gi088EvaluationError } from "@/server/services/evaluation/gi088/errors";

export const GI088_STALE_PROCESSING_AFTER_MS = 120_000;

type Gi088RetryRequestTrigger =
  | "manual"
  | "automatic_empty_content"
  | "automatic_timeout"
  | "automatic_stage_transition"
  | "manual_after_auto_recovery";

const GI088_MAXIMUM_PROVIDER_CALLS_PER_TURN = 2;

export type Gi088ExecutionProgress = {
  type: "recovery_started";
  trigger: "EMPTY_CONTENT";
  turnId: string;
  callId: string;
};

function requestedRecoveryTrigger(
  trigger: Gi088RetryRequestTrigger
): Gi088RecoveryTrigger | null {
  if (trigger === "automatic_empty_content") return "EMPTY_CONTENT";
  if (trigger === "automatic_timeout") return "TIMEOUT";
  if (trigger === "automatic_stage_transition") {
    return "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE";
  }
  return null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function nowIso(now: () => Date) {
  return now().toISOString();
}

function createAutomaticDeadlineAt(startedAt: string) {
  return new Date(
    new Date(startedAt).getTime() +
      GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs
  ).toISOString();
}

function remainingAutomaticDeadlineMs(deadlineAt: string, now: Date) {
  return Math.max(0, new Date(deadlineAt).getTime() - now.getTime());
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
    completedAt: null
  };
}

function createBatchState(
  now: () => Date,
  evaluationMode: Gi088EvaluationMode
): Gi088BatchState {
  const timestamp = nowIso(now);
  return {
    batchId: randomUUID(),
    evaluationMode,
    status: "running",
    activeTaskId: null,
    tasks: GI088_TASKS.map((task) => ({
      taskId: task.id,
      initialUserMessage: null,
      activeBranch: evaluationMode === "high_only" ? "high" : "off",
      branches: {
        off: createEmptyTrajectory("off"),
        high: createEmptyTrajectory("high")
      },
      comparison: null,
      ...(task.evaluationRole === "compatibility_smoke"
        ? { compatibilitySmoke: null }
        : {})
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
    sealedAt: null,
    earlyStop: null
  };
}

function taskDefinition(taskId: string) {
  const definition = GI088_TASKS.find((item) => item.id === taskId);
  if (!definition) throw new Gi088EvaluationError("GI088_TASK_NOT_FOUND", 404);
  return definition;
}

function taskState(state: Gi088BatchState, taskId: string) {
  const task = state.tasks.find((item) => item.taskId === taskId);
  if (!task) throw new Gi088EvaluationError("GI088_TASK_STATE_NOT_FOUND", 404);
  return task;
}

function evaluationMode(state: Gi088BatchState): Gi088EvaluationMode {
  return state.evaluationMode ?? "paired";
}

function isTaskCompleted(state: Gi088BatchState, task: Gi088TaskState) {
  if (Object.prototype.hasOwnProperty.call(task, "compatibilitySmoke")) {
    return task.compatibilitySmoke !== null &&
      task.compatibilitySmoke !== undefined;
  }
  return evaluationMode(state) === "high_only"
    ? isCompletedTrajectory(task.branches.high)
    : task.comparison !== null &&
        isCompletedTrajectory(task.branches.off) &&
        isCompletedTrajectory(task.branches.high);
}

function firstIncompleteTaskId(state: Gi088BatchState) {
  return state.tasks.find((task) => !isTaskCompleted(state, task))?.taskId ?? null;
}

function isPristineTrajectory(
  trajectory: Gi088Trajectory,
  branch: Gi088BranchKey
) {
  return trajectory.branch === branch &&
    trajectory.status === "not_started" &&
    trajectory.messages.length === 0 &&
    trajectory.turns.length === 0 &&
    trajectory.pendingTurnId === null &&
    trajectory.technicalError === null &&
    trajectory.review === null &&
    trajectory.startedAt === null &&
    trajectory.completedAt === null &&
    isDeepStrictEqual(
      trajectory.semanticState,
      createBoard7bWorkingTaskV1InitialSemanticState()
    );
}

function isPristineTask(state: Gi088BatchState, task: Gi088TaskState) {
  return task.initialUserMessage === null &&
    task.activeBranch === (evaluationMode(state) === "high_only" ? "high" : "off") &&
    task.comparison === null &&
    isPristineTrajectory(task.branches.off, "off") &&
    isPristineTrajectory(task.branches.high, "high");
}

function isCompletedTrajectory(trajectory: Gi088Trajectory) {
  return trajectory.status === "completed" &&
    trajectory.review !== null &&
    trajectory.pendingTurnId === null &&
    trajectory.startedAt !== null &&
    trajectory.completedAt !== null &&
    trajectory.turns.length > 0 &&
    trajectory.turns.every(
      (turn) =>
        turn.status !== "processing" &&
        turn.calls.every((call) => call.status !== "processing")
    );
}

function isCompletedTaskBoundary(state: Gi088BatchState, task: Gi088TaskState) {
  if (Object.prototype.hasOwnProperty.call(task, "compatibilitySmoke")) {
    return task.compatibilitySmoke !== null &&
      task.compatibilitySmoke !== undefined &&
      task.initialUserMessage === null &&
      task.comparison === null &&
      isPristineTrajectory(task.branches.off, "off") &&
      isPristineTrajectory(task.branches.high, "high");
  }
  return task.initialUserMessage !== null && isTaskCompleted(state, task);
}

function taskHasTechnicalFailure(trajectory: Gi088Trajectory) {
  return trajectory.turns.some(
    (turn) =>
      turn.status === "technical_failure" ||
      turn.calls.some((call) => call.status === "technical_failure")
  );
}

function trajectoryProviderCallCount(trajectory: Gi088Trajectory) {
  return trajectory.turns.reduce(
    (total, turn) => total + turn.calls.length,
    0
  );
}

function unreviewedQuestionTurns(trajectory: Gi088Trajectory) {
  return trajectory.turns.filter(
    (turn) => turn.questionObservation && !turn.questionObservation.review
  );
}

function publicTaskStatus(
  state: Gi088BatchState,
  task: Gi088TaskState
): "ready" | "locked" | "active" | "completed" | "not_run" {
  if (isTaskCompleted(state, task)) return "completed";
  if (state.status === "early_stopped") return "not_run";
  if (state.activeTaskId === task.taskId) return "active";
  return firstIncompleteTaskId(state) === task.taskId ? "ready" : "locked";
}

function normalizeTargetTrigger(value: unknown): Gi088TargetTrigger {
  return value === "triggered" ||
    value === "not_triggered" ||
    value === "blocked_by_technical_failure"
    ? value
    : "legacy_unknown";
}

function sanitizeTrajectoryForOutput(trajectory: Gi088Trajectory): Gi088Trajectory {
  return {
    ...trajectory,
    review: trajectory.review
      ? {
          ...trajectory.review,
          targetTrigger: normalizeTargetTrigger(
            trajectory.review.targetTrigger
          )
        }
      : null,
    turns: trajectory.turns.map((turn) => ({
      ...turn,
      calls: turn.calls.map((call) => ({
        id: call.id,
        attempt: call.attempt,
        kind: call.kind,
        status: call.status,
        startedAt: call.startedAt,
        completedAt: call.completedAt,
        requestHash: call.requestHash,
        responseHash: call.responseHash,
        rawFinalOutput: call.rawFinalOutput,
        latencyMs: call.latencyMs,
        tokenUsage: sanitizeAICompletionTokenUsage(call.tokenUsage),
        providerDiagnostics: sanitizeAIProviderDiagnostics(
          call.providerDiagnostics
        ),
        errorCode: call.errorCode,
        parentCallId: call.parentCallId ?? null,
        retryTrigger: call.retryTrigger ?? null,
        retryOrdinal: call.retryOrdinal ?? null,
        effectiveConfig: call.effectiveConfig
      }))
    }))
  };
}

export function sanitizeGi088BatchStateForOutput(
  state: Gi088BatchState
): Gi088BatchState {
  return {
    ...state,
    tasks: state.tasks.map((task) => ({
      ...task,
      branches: {
        off: sanitizeTrajectoryForOutput(task.branches.off),
        high: sanitizeTrajectoryForOutput(task.branches.high)
      }
    }))
  };
}

function publicTrajectory(trajectory: Gi088Trajectory) {
  const config = GI088_CONFIGS[trajectory.branch];
  const providerCallsUsed = trajectoryProviderCallCount(trajectory);
  return {
    ...sanitizeTrajectoryForOutput(trajectory),
    config: {
      key: config.key,
      label: config.label,
      thinking: config.thinking,
      temperature: config.temperature,
      effectiveTemperature: config.effectiveTemperature,
      reasoningEffort: config.reasoningEffort,
      automaticEmptyContentRetries: config.automaticEmptyContentRetries,
      automaticStageTransitionRetries:
        config.automaticStageTransitionRetries,
      automaticSingleQuestionRetries:
        config.automaticSingleQuestionRetries,
      automaticTechnicalRetries: config.automaticTechnicalRetries,
      providerCallsUsed,
      providerCallsRemaining: null,
      maximumProviderCallsPerTrajectory: null
    }
  };
}

export function createGi088PublicSession(
  batch: Gi088StoredBatch,
  selectedTaskId?: string | null
): Gi088PublicSession {
  const state = batch.state;
  const mode = evaluationMode(state);
  const activeBranches = mode === "high_only"
    ? (["high"] as const)
    : (["off", "high"] as const);
  const reviews = state.tasks.flatMap((task) =>
    activeBranches
      .map((branch) => task.branches[branch].review)
      .filter((review) => review !== null)
  );
  const requestedTask = selectedTaskId
    ? state.tasks.find((item) => item.taskId === selectedTaskId) ?? null
    : null;
  const selectedTask = requestedTask &&
      (requestedTask.taskId === state.activeTaskId ||
        isTaskCompleted(state, requestedTask))
    ? requestedTask
    : state.activeTaskId
      ? taskState(state, state.activeTaskId)
      : null;
  return {
    evaluation: {
      id: GI088_EVALUATION_ID,
      version: GI088_EVALUATION_VERSION,
      mode,
      activeBranches: [...activeBranches],
      candidateFingerprint: batch.candidateFingerprint,
      executionFingerprint: batch.executionFingerprint,
      model: GI088_CONFIGS.high.model
    },
    batch: {
      id: batch.id,
      status: batch.status,
      completedTaskCount: state.tasks.filter((task) => isTaskCompleted(state, task)).length,
      totalTasks: GI088_TASKS.length,
      sealedAt: state.sealedAt ?? batch.sealedAt?.toISOString() ?? null,
      earlyStop: state.earlyStop ?? null,
      targetCoverage: {
        triggeredTrajectoryCount: reviews.filter(
          (review) => normalizeTargetTrigger(review.targetTrigger) === "triggered"
        ).length,
        reviewedTrajectoryCount: reviews.length,
        totalTrajectoryCount: GI088_TASKS.filter(
          (task) => task.evaluationRole === "scored_trajectory"
        ).length * activeBranches.length
      }
    },
    tasks: GI088_TASKS.map((definition) => {
      const task = taskState(state, definition.id);
      return {
        id: definition.id,
        evaluationRole: definition.evaluationRole ?? "scored_trajectory",
        capabilityId: definition.capabilityId,
        title: definition.title,
        instruction: definition.instruction,
        targetTriggerPrompt: definition.targetTriggerPrompt,
        criterion: definition.criterion,
        repeatOf: definition.repeatOf,
        status: publicTaskStatus(state, task),
        targetTriggers: {
          off: task.branches.off.review
            ? normalizeTargetTrigger(task.branches.off.review.targetTrigger)
            : null,
          high: task.branches.high.review
            ? normalizeTargetTrigger(task.branches.high.review.targetTrigger)
            : null
        },
        compatibilitySmoke: task.compatibilitySmoke ?? null
      };
    }),
    activeTask: selectedTask
      ? {
          taskId: selectedTask.taskId,
          frozenStart: {
            opening: GI088_FIXED_OPENING,
            userMessage: selectedTask.initialUserMessage
          },
          activeBranch: selectedTask.activeBranch,
          branches: {
            off: publicTrajectory(selectedTask.branches.off),
            high: publicTrajectory(selectedTask.branches.high)
          },
          comparison: selectedTask.comparison,
          readOnly:
            selectedTask.taskId !== state.activeTaskId ||
            isTaskCompleted(state, selectedTask)
        }
      : null
  };
}

function createDefaultProvider() {
  return createGi088ArkProvider(process.env);
}

type ServiceDependencies = {
  store: Gi088EvaluationStore;
  getProvider?: () => AIProvider | Promise<AIProvider>;
  now?: () => Date;
  authorizeModelCall?: (branch: Gi088BranchKey) => void;
  evaluationMode?: Gi088EvaluationMode;
  emptyContentRecoveryPolicy?: ReturnType<
    typeof resolveGi088EmptyContentRecoveryPolicy
  >;
};

export class Gi088EvaluationService {
  private readonly store: Gi088EvaluationStore;
  private readonly getProvider: () => AIProvider | Promise<AIProvider>;
  private readonly now: () => Date;
  private readonly authorizeModelCall: (branch: Gi088BranchKey) => void;
  private readonly evaluationMode: Gi088EvaluationMode;
  private readonly emptyContentRecoveryPolicy =
    resolveGi088EmptyContentRecoveryPolicy();
  private readonly candidateFingerprint =
    createGi088EffectiveCandidateFingerprint();
  private readonly executionFingerprint = createGi088ExecutionFingerprint();

  constructor(dependencies: ServiceDependencies) {
    this.store = dependencies.store;
    this.getProvider = dependencies.getProvider ?? createDefaultProvider;
    this.now = dependencies.now ?? (() => new Date());
    this.evaluationMode = dependencies.evaluationMode ?? "paired";
    if (dependencies.emptyContentRecoveryPolicy) {
      this.emptyContentRecoveryPolicy = dependencies.emptyContentRecoveryPolicy;
    }
    this.authorizeModelCall =
      dependencies.authorizeModelCall ??
      (dependencies.getProvider
        ? () => undefined
        : () =>
            requireGi088ModelCallAuthorization(
              this.executionFingerprint,
              "batch"
            ));
  }

  private async getOrCreateBatch(ownerUserId: string) {
    const existing = await this.store.findByOwnerAndVersion(
      ownerUserId,
      GI088_EVALUATION_VERSION
    );
    if (existing) {
      if (
        existing.candidateFingerprint !== this.candidateFingerprint ||
        existing.executionFingerprint !== this.executionFingerprint
      ) {
        throw new Gi088EvaluationError("GI088_STORED_FINGERPRINT_MISMATCH", 409);
      }
      return existing;
    }
    return this.store.create({
      ownerUserId,
      evaluationVersion: GI088_EVALUATION_VERSION,
      candidateFingerprint: this.candidateFingerprint,
      executionFingerprint: this.executionFingerprint,
      state: createBatchState(this.now, this.evaluationMode)
    });
  }

  async getSession(ownerUserId: string, selectedTaskId?: string | null) {
    if (selectedTaskId) taskDefinition(selectedTaskId);
    const batch = await this.getOrCreateBatch(ownerUserId);
    return createGi088PublicSession(
      await this.recoverStaleProcessing(batch),
      selectedTaskId
    );
  }

  private async recoverStaleProcessing(batch: Gi088StoredBatch) {
    if (batch.status !== "running") return batch;
    for (const task of batch.state.tasks) {
      for (const branch of ["off", "high"] as const) {
        const trajectory = task.branches[branch];
        const pendingTurn = trajectory.pendingTurnId
          ? trajectory.turns.find(
              (turn) => turn.id === trajectory.pendingTurnId
            )
          : null;
        if (
          pendingTurn?.status === "processing" &&
          pendingTurn.calls.length === 0 &&
          pendingTurn.stateMaintenance?.explicitStop === "pure"
        ) {
          return this.executeReservedTurn(batch, task.taskId, branch);
        }
      }
    }
    const state = structuredClone(batch.state);
    let changed = false;
    const now = this.now();
    for (const task of state.tasks) {
      for (const branch of ["off", "high"] as const) {
        const trajectory = task.branches[branch];
        if (!trajectory.pendingTurnId) continue;
        const turn = trajectory.turns.find(
          (item) => item.id === trajectory.pendingTurnId
        );
        const call = turn?.calls.at(-1);
        if (!turn || !call || turn.status !== "processing" || call.status !== "processing") {
          continue;
        }
        if (now.getTime() - new Date(call.startedAt).getTime() < GI088_STALE_PROCESSING_AFTER_MS) {
          continue;
        }
        call.status = "technical_failure";
        call.completedAt = now.toISOString();
        call.errorCode = "REQUEST_INTERRUPTED";
        turn.status = "technical_failure";
        if (turn.recovery?.status === "retrying") {
          turn.recovery.status = "manual_available";
          turn.recovery.completedAt = now.toISOString();
        } else if (turn.recovery?.status === "manual_retrying") {
          turn.recovery.status = "exhausted";
          turn.recovery.completedAt = now.toISOString();
        }
        trajectory.status = "technical_failure";
        trajectory.technicalError = "REQUEST_INTERRUPTED";
        changed = true;
      }
    }
    if (!changed) return batch;
    try {
      return await this.save(batch, state);
    } catch (error) {
      if (
        error instanceof Gi088EvaluationError &&
        error.code === "GI088_CONCURRENT_UPDATE"
      ) {
        return (
          (await this.store.findByOwnerAndVersion(
            batch.ownerUserId,
            GI088_EVALUATION_VERSION
          )) ?? batch
        );
      }
      throw error;
    }
  }

  private assertMutable(batch: Gi088StoredBatch) {
    if (batch.status === "sealed") {
      throw new Gi088EvaluationError("GI088_BATCH_ALREADY_SEALED", 409);
    }
    if (batch.status === "early_stopped") {
      throw new Gi088EvaluationError("GI088_BATCH_ALREADY_EARLY_STOPPED", 409);
    }
    if (
      batch.state.status !== "running" ||
      batch.sealedAt !== null ||
      batch.state.sealedAt !== null ||
      batch.state.earlyStop
    ) {
      throw new Gi088EvaluationError("GI088_BATCH_TERMINAL_STATE_MISMATCH", 409);
    }
  }

  private async save(
    batch: Gi088StoredBatch,
    state: Gi088BatchState,
    sealedAt: Date | null = null
  ) {
    state.updatedAt = nowIso(this.now);
    const saved = await this.store.compareAndSet({
      id: batch.id,
      expectedRevision: batch.revision,
      status: state.status,
      state,
      sealedAt
    });
    if (!saved) throw new Gi088EvaluationError("GI088_CONCURRENT_UPDATE", 409, true);
    const current = await this.store.findByOwnerAndVersion(
      batch.ownerUserId,
      GI088_EVALUATION_VERSION
    );
    if (!current) throw new Gi088EvaluationError("GI088_BATCH_LOST", 500);
    return current;
  }

  private assertTaskCanStart(batch: Gi088StoredBatch, taskId: string) {
    const state = batch.state;
    this.assertMutable(batch);
    const definition = taskDefinition(taskId);
    if (definition.evaluationRole === "compatibility_smoke") {
      throw new Gi088EvaluationError(
        "GI088_COMPATIBILITY_SMOKE_REQUIRES_EXTERNAL_RESULT",
        409
      );
    }
    if (firstIncompleteTaskId(state) !== taskId) {
      throw new Gi088EvaluationError("GI088_TASK_ORDER_INVALID", 409);
    }
    if (state.activeTaskId && state.activeTaskId !== taskId) {
      const current = taskState(state, state.activeTaskId);
      if (!isTaskCompleted(state, current)) {
        throw new Gi088EvaluationError("GI088_ACTIVE_TASK_INCOMPLETE", 409);
      }
    }
  }

  async startOff(input: {
    ownerUserId: string;
    taskId: string;
    initialUserMessage: string;
    clientTurnId: string;
  }) {
    if (this.evaluationMode === "high_only") {
      throw new Gi088EvaluationError("GI088_HIGH_ONLY_EVALUATION", 409);
    }
    const content = input.initialUserMessage.trim();
    if (!content || content.length > 8_000) {
      throw new Gi088EvaluationError("GI088_INITIAL_USER_MESSAGE_INVALID", 400);
    }
    if (!input.clientTurnId.trim() || input.clientTurnId.length > 160) {
      throw new Gi088EvaluationError("GI088_CLIENT_TURN_ID_INVALID", 400);
    }
    if (
      assessGi088ExplicitStop({
        content,
        lastAssistantMessage: GI088_FIXED_OPENING
      }) !== "pure"
    ) {
      this.authorizeModelCall("off");
    }
    let batch = await this.getOrCreateBatch(input.ownerUserId);
    this.assertTaskCanStart(batch, input.taskId);
    const existing = taskState(batch.state, input.taskId);
    const duplicate = existing.branches.off.turns.find(
      (turn) => turn.clientTurnId === input.clientTurnId
    );
    if (duplicate) {
      const duplicateMessage = existing.branches.off.messages.find(
        (message) => message.id === duplicate.userMessageId
      );
      if (duplicateMessage?.content !== content) {
        throw new Gi088EvaluationError("GI088_IDEMPOTENCY_PAYLOAD_MISMATCH", 409);
      }
      return createGi088PublicSession(batch);
    }
    if (existing.branches.off.status !== "not_started") {
      throw new Gi088EvaluationError("GI088_OFF_BRANCH_ALREADY_STARTED", 409);
    }
    const state = structuredClone(batch.state);
    state.activeTaskId = input.taskId;
    const task = taskState(state, input.taskId);
    task.initialUserMessage = content;
    task.activeBranch = "off";
    task.branches.off = createEmptyTrajectory("off");
    task.branches.off.startedAt = nowIso(this.now);
    task.branches.off.status = "running";
    task.branches.off.messages = [
      { id: "A0", role: "assistant", content: GI088_FIXED_OPENING }
    ];
    batch = await this.reserveTurn({
      batch,
      state,
      taskId: input.taskId,
      branch: "off",
      content,
      clientTurnId: input.clientTurnId,
      kind: "initial"
    });
    return createGi088PublicSession(
      await this.executeReservedTurn(batch, input.taskId, "off")
    );
  }

  async startHigh(input: {
    ownerUserId: string;
    taskId: string;
    initialUserMessage?: string;
    clientTurnId?: string;
    onProgress?: (progress: Gi088ExecutionProgress) => void;
  }) {
    let batch = await this.getOrCreateBatch(input.ownerUserId);
    if (evaluationMode(batch.state) === "high_only") {
      const content = input.initialUserMessage?.trim() ?? "";
      const clientTurnId = input.clientTurnId?.trim() ?? "";
      if (!content || content.length > 8_000) {
        throw new Gi088EvaluationError("GI088_INITIAL_USER_MESSAGE_INVALID", 400);
      }
      if (!clientTurnId || clientTurnId.length > 160) {
        throw new Gi088EvaluationError("GI088_CLIENT_TURN_ID_INVALID", 400);
      }
      if (
        assessGi088ExplicitStop({
          content,
          lastAssistantMessage: GI088_FIXED_OPENING
        }) !== "pure"
      ) {
        this.authorizeModelCall("high");
      }
      this.assertTaskCanStart(batch, input.taskId);
      const existing = taskState(batch.state, input.taskId);
      const duplicate = existing.branches.high.turns.find(
        (turn) => turn.clientTurnId === clientTurnId
      );
      if (duplicate) {
        const duplicateMessage = existing.branches.high.messages.find(
          (message) => message.id === duplicate.userMessageId
        );
        if (duplicateMessage?.content !== content) {
          throw new Gi088EvaluationError("GI088_IDEMPOTENCY_PAYLOAD_MISMATCH", 409);
        }
        return createGi088PublicSession(batch);
      }
      if (existing.branches.high.status !== "not_started") {
        throw new Gi088EvaluationError("GI088_HIGH_BRANCH_ALREADY_STARTED", 409);
      }
      const state = structuredClone(batch.state);
      state.activeTaskId = input.taskId;
      const task = taskState(state, input.taskId);
      task.initialUserMessage = content;
      task.activeBranch = "high";
      task.branches.high = createEmptyTrajectory("high");
      task.branches.high.startedAt = nowIso(this.now);
      task.branches.high.status = "running";
      task.branches.high.messages = [
        { id: "A0", role: "assistant", content: GI088_FIXED_OPENING }
      ];
      batch = await this.reserveTurn({
        batch,
        state,
        taskId: input.taskId,
        branch: "high",
        content,
        clientTurnId,
        kind: "initial"
      });
      return createGi088PublicSession(
        await this.executeReservedTurn(
          batch,
          input.taskId,
          "high"
        )
      );
    }
    this.authorizeModelCall("high");
    this.assertMutable(batch);
    const task = taskState(batch.state, input.taskId);
    if (batch.state.activeTaskId !== input.taskId) {
      throw new Gi088EvaluationError("GI088_TASK_NOT_ACTIVE", 409);
    }
    if (task.branches.off.status !== "completed" || !task.branches.off.review) {
      throw new Gi088EvaluationError("GI088_OFF_BRANCH_REVIEW_REQUIRED", 409);
    }
    if (!task.initialUserMessage) {
      throw new Gi088EvaluationError("GI088_FROZEN_START_MISSING", 409);
    }
    if (task.branches.high.status !== "not_started") {
      return createGi088PublicSession(batch);
    }
    const state = structuredClone(batch.state);
    const mutableTask = taskState(state, input.taskId);
    mutableTask.activeBranch = "high";
    mutableTask.branches.high = createEmptyTrajectory("high");
    mutableTask.branches.high.startedAt = nowIso(this.now);
    mutableTask.branches.high.status = "running";
    mutableTask.branches.high.messages = [
      { id: "A0", role: "assistant", content: GI088_FIXED_OPENING }
    ];
    batch = await this.reserveTurn({
      batch,
      state,
      taskId: input.taskId,
      branch: "high",
      content: mutableTask.initialUserMessage!,
      clientTurnId: `start-high:${input.taskId}`,
      kind: "initial"
    });
    return createGi088PublicSession(
      await this.executeReservedTurn(
        batch,
        input.taskId,
        "high"
      )
    );
  }

  async submitTurn(input: {
    ownerUserId: string;
    taskId: string;
    branch: Gi088BranchKey;
    content: string;
    clientTurnId: string;
    onProgress?: (progress: Gi088ExecutionProgress) => void;
  }) {
    const content = input.content.trim();
    if (!content || content.length > 8_000) {
      throw new Gi088EvaluationError("GI088_USER_MESSAGE_INVALID", 400);
    }
    if (!input.clientTurnId.trim() || input.clientTurnId.length > 160) {
      throw new Gi088EvaluationError("GI088_CLIENT_TURN_ID_INVALID", 400);
    }
    let batch = await this.getOrCreateBatch(input.ownerUserId);
    this.assertMutable(batch);
    if (taskDefinition(input.taskId).evaluationRole === "compatibility_smoke") {
      throw new Gi088EvaluationError(
        "GI088_COMPATIBILITY_SMOKE_REQUIRES_EXTERNAL_RESULT",
        409
      );
    }
    if (evaluationMode(batch.state) === "high_only" && input.branch !== "high") {
      throw new Gi088EvaluationError("GI088_HIGH_ONLY_EVALUATION", 409);
    }
    const task = taskState(batch.state, input.taskId);
    if (batch.state.activeTaskId !== input.taskId || task.activeBranch !== input.branch) {
      throw new Gi088EvaluationError("GI088_BRANCH_NOT_ACTIVE", 409);
    }
    const trajectory = task.branches[input.branch];
    const duplicate = trajectory.turns.find(
      (turn) => turn.clientTurnId === input.clientTurnId
    );
    if (duplicate) {
      const duplicateMessage = trajectory.messages.find(
        (message) => message.id === duplicate.userMessageId
      );
      if (duplicateMessage?.content !== content) {
        throw new Gi088EvaluationError("GI088_IDEMPOTENCY_PAYLOAD_MISMATCH", 409);
      }
      return createGi088PublicSession(batch);
    }
    if (trajectory.status !== "running" || trajectory.pendingTurnId) {
      throw new Gi088EvaluationError("GI088_TRAJECTORY_NOT_READY", 409);
    }
    const lastAssistantMessage = [...trajectory.messages]
      .reverse()
      .find((message) => message.role === "assistant")?.content;
    if (
      assessGi088ExplicitStop({ content, lastAssistantMessage }) !== "pure"
    ) {
      this.authorizeModelCall(input.branch);
    }
    const state = structuredClone(batch.state);
    batch = await this.reserveTurn({
      batch,
      state,
      taskId: input.taskId,
      branch: input.branch,
      content,
      clientTurnId: input.clientTurnId,
      kind: "turn"
    });
    return createGi088PublicSession(
      await this.executeReservedTurn(
        batch,
        input.taskId,
        input.branch
      )
    );
  }

  private async reserveTurn(input: {
    batch: Gi088StoredBatch;
    state: Gi088BatchState;
    taskId: string;
    branch: Gi088BranchKey;
    content: string;
    clientTurnId: string;
    kind: Gi088Call["kind"];
  }) {
    const trajectory = taskState(input.state, input.taskId).branches[input.branch];
    const userMessageId = `U${trajectory.messages.filter((m) => m.role === "user").length + 1}`;
    const turnId = randomUUID();
    const message: Gi088Message = {
      id: userMessageId,
      role: "user",
      content: input.content
    };
    trajectory.messages.push(message);
    const turnInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: trajectory.messages,
      latestUserMessageId: userMessageId,
      semanticState: structuredClone(trajectory.semanticState)
    };
    const completionParams = this.createCompletionParams(input.branch, turnInput);
    const lastAssistantMessage = [...trajectory.messages]
      .reverse()
      .find((item) => item.role === "assistant")?.content;
    const explicitStop = assessGi088ExplicitStop({
      content: input.content,
      lastAssistantMessage
    });
    const call: Gi088Call | null = explicitStop === "pure" ? null : {
      id: randomUUID(),
      attempt: 1,
      kind: input.kind,
      status: "processing",
      startedAt: nowIso(this.now),
      completedAt: null,
      requestHash: this.createRequestHash(completionParams),
      responseHash: null,
      rawFinalOutput: null,
      latencyMs: null,
      tokenUsage: null,
      providerDiagnostics: null,
      errorCode: null,
      parentCallId: null,
      retryTrigger: null,
      retryOrdinal: null,
      effectiveConfig: this.createEffectiveConfig(input.branch, null, {
        hardTimeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs,
        sharedDeadlineMs:
          GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs,
        remainingSharedDeadlineMs:
          GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs,
        recoveryPolicyVersion:
          GI088_SHARED_RECOVERY_DEADLINE_POLICY.version
      })
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
      calls: call ? [call] : [],
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
      }
    };
    trajectory.turns.push(turn);
    trajectory.pendingTurnId = turnId;
    trajectory.technicalError = null;
    return this.save(input.batch, input.state);
  }

  private createCompletionParams(
    branch: Gi088BranchKey,
    turnInput: Board7bWorkingTaskV1TurnInput,
    recoveryTrigger: Gi088RecoveryTrigger | null = null,
    hardTimeoutMs: number = GI088_TIMEOUT_POLICY.hardTimeoutMs
  ): AICompletionParams {
    const config = GI088_CONFIGS[branch];
    const recoveryInstruction =
      recoveryTrigger === "EMPTY_CONTENT"
        ? GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION
        : recoveryTrigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
          ? GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY.recoveryInstruction
          : null;
    const shared = {
      messages: [
        { role: "system" as const, content: getGi088CandidateAssets().systemPrompt },
        ...(recoveryInstruction
          ? [
              {
                role: "system" as const,
                content: recoveryInstruction
              }
            ]
          : []),
        {
          role: "user" as const,
          content: createGi088StageTransitionUserPrompt(turnInput)
        }
      ],
      useProviderDefaultMaxTokens:
        config.maxTokensPolicy === "provider_default",
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
      responseFormat: config.responseFormat,
      thinking: config.thinking
    };
    return branch === "off"
      ? { ...shared, temperature: GI088_CONFIGS.off.temperature }
      : { ...shared, reasoningEffort: GI088_CONFIGS.high.reasoningEffort };
  }

  private emptyContentPolicyForTurn(turn: Gi088Turn) {
    const config = turn.calls[0]?.effectiveConfig;
    const maximumAutomaticRetriesPerTurn =
      config?.emptyContentAutomaticRetries ??
      this.emptyContentRecoveryPolicy.maximumAutomaticRetriesPerTurn;
    return {
      ...this.emptyContentRecoveryPolicy,
      version:
        config?.emptyContentRecoveryPolicyVersion ??
        this.emptyContentRecoveryPolicy.version,
      maximumAutomaticRetriesPerTurn,
      maximumProviderCallsPerTurn:
        config?.emptyContentMaximumProviderCalls ??
        ((maximumAutomaticRetriesPerTurn + 1) as 2 | 3),
      policyOverride:
        config?.emptyContentPolicyOverride ??
        this.emptyContentRecoveryPolicy.policyOverride
    } as const;
  }

  private createRequestHash(
    params: AICompletionParams,
    policy = this.emptyContentRecoveryPolicy
  ) {
    return createGi088ModelRequestHash(params, {
      emptyContentRecoveryPolicyVersion: policy.version,
      emptyContentAutomaticRetries: policy.maximumAutomaticRetriesPerTurn,
      emptyContentPolicyOverride: policy.policyOverride
    });
  }

  private createEffectiveConfig(
    branch: Gi088BranchKey,
    recoveryTrigger: Gi088RecoveryTrigger | null,
    options: {
      hardTimeoutMs?: number;
      sharedDeadlineMs?: number | null;
      remainingSharedDeadlineMs?: number | null;
      recoveryPolicyVersion?: string | null;
      emptyContentAutomaticRetries?: 1 | 2;
      emptyContentMaximumProviderCalls?: 2 | 3;
      emptyContentRecoveryPolicyVersion?: string;
      emptyContentPolicyOverride?: boolean;
    } = {}
  ): Gi088CallEffectiveConfig {
    const config = GI088_CONFIGS[branch];
    const hardTimeoutMs = options.hardTimeoutMs ??
      GI088_TIMEOUT_POLICY.hardTimeoutMs;
    return {
      branch,
      ...GI088_MODEL_CALL_IDENTITY,
      hiddenReasoningPersistence: "forbidden",
      thinking: config.thinking,
      reasoningEffort: config.reasoningEffort,
      temperature: config.temperature,
      responseFormat: config.responseFormat,
      maxTokensPolicy: config.maxTokensPolicy,
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
        recoveryTrigger === "EMPTY_CONTENT"
          ? GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION_VERSION
          : recoveryTrigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
            ? GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY
              .recoveryInstructionVersion
            : null,
      continuationMode: null,
      reasoningReplay: null,
      visiblePrefix: null,
      requestHashScope: "full",
      sharedDeadlineMs: options.sharedDeadlineMs ?? null,
      remainingSharedDeadlineMs:
        options.remainingSharedDeadlineMs ?? null,
      recoveryPolicyVersion: options.recoveryPolicyVersion ?? null,
      emptyContentAutomaticRetries:
        options.emptyContentAutomaticRetries ??
        this.emptyContentRecoveryPolicy.maximumAutomaticRetriesPerTurn,
      emptyContentMaximumProviderCalls:
        options.emptyContentMaximumProviderCalls ??
        this.emptyContentRecoveryPolicy.maximumProviderCallsPerTurn,
      emptyContentRecoveryPolicyVersion:
        options.emptyContentRecoveryPolicyVersion ??
        this.emptyContentRecoveryPolicy.version,
      emptyContentPolicyOverride:
        options.emptyContentPolicyOverride ??
        this.emptyContentRecoveryPolicy.policyOverride
    };
  }

  private evidenceExcerpts(
    messages: Gi088Message[],
    output: Gi088SemanticDeltaOutput
  ) {
    const refs = new Set<string>();
    const semantic = output.semantic;
    for (const ref of semantic.workingTask?.evidenceRefs ?? []) refs.add(ref);
    if (semantic.understandingChange.kind !== "none") {
      for (const ref of semantic.understandingChange.evidenceRefs) refs.add(ref);
    }
    for (const item of semantic.returnableTaskDelta.add) {
      for (const ref of item.evidenceRefs) refs.add(ref);
    }
    for (const ref of semantic.nextInquiry?.evidenceRefs ?? []) refs.add(ref);
    if (semantic.burdenSignalChange.kind === "set") {
      for (const ref of semantic.burdenSignalChange.evidenceRefs) refs.add(ref);
    }
    return messages
      .filter((message) => message.role === "user" && refs.has(message.id))
      .map(({ id, content }) => ({ id, content }));
  }

  private async executeReservedTurn(
    batch: Gi088StoredBatch,
    taskId: string,
    branch: Gi088BranchKey
  ) {
    const task = taskState(batch.state, taskId);
    const trajectory = task.branches[branch];
    const turn = trajectory.turns.find((item) => item.id === trajectory.pendingTurnId);
    if (!turn || turn.status !== "processing") {
      throw new Gi088EvaluationError("GI088_RESERVED_TURN_NOT_FOUND", 409);
    }
    const turnInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: trajectory.messages,
      latestUserMessageId: turn.userMessageId,
      semanticState: turn.semanticStateBefore
    };
    const activeCall = turn.calls.at(-1);
    const explicitStop = turn.stateMaintenance?.explicitStop ?? "none";
    if (!activeCall && explicitStop === "pure") {
      return this.finishDeterministicStop({
        batch,
        taskId,
        branch,
        turnId: turn.id,
        explicitStop: "pure"
      });
    }
    if (!activeCall || activeCall.status !== "processing") {
      throw new Gi088EvaluationError("GI088_RESERVED_CALL_NOT_FOUND", 409);
    }
    const isAutomaticRecovery = activeCall.kind === "automatic_retry";
    const isManualRecovery = activeCall.kind === "manual_retry";
    const recoveryTrigger = isAutomaticRecovery || isManualRecovery
      ? activeCall.retryTrigger
      : null;
    const completionRecoveryTrigger = isManualRecovery
      ? null
      : recoveryTrigger;
    let completion: Awaited<ReturnType<AIProvider["complete"]>>;
    const provider = await this.getProvider();
    try {
      completion = await provider.complete(
        this.createCompletionParams(
          branch,
          turnInput,
          completionRecoveryTrigger,
          activeCall.effectiveConfig.hardTimeoutMs ??
            GI088_TIMEOUT_POLICY.hardTimeoutMs
        )
      );
    } catch (error) {
      takeAIReasoningOnlyContinuation(error)?.dispose();
      if (explicitStop === "mixed") {
        return this.finishDeterministicStop({
          batch,
          taskId,
          branch,
          turnId: turn.id,
          explicitStop: "mixed",
          technicalError: error
        });
      }
      return this.finishTechnicalFailure(batch, taskId, branch, turn.id, error);
    }
    if (completion.content.trim().length === 0) {
      return this.finishTechnicalFailure(
        batch,
        taskId,
        branch,
        turn.id,
        new AIProviderError(
          "Provider returned empty visible content",
          "EMPTY_CONTENT",
          502,
          completion.diagnostics ?? null
        )
      );
    }
    let output: Gi088SemanticDeltaOutput;
    try {
      output = parseGi088SemanticDeltaCandidateOutput(completion.content);
    } catch (error) {
      if (explicitStop === "mixed") {
        return this.finishDeterministicStop({
          batch,
          taskId,
          branch,
          turnId: turn.id,
          explicitStop: "mixed",
          completion,
          protectedIssues: createGi088OutputSchemaIssues(error)
        });
      }
      return this.finishProtectedFailure({
        batch,
        taskId,
        branch,
        turnId: turn.id,
        completion,
        issues: createGi088OutputSchemaIssues(error),
        output: null
      });
    }
    const normalized = normalizeGi088DeterministicStateOutput({
      turnInput,
      output,
      explicitStop
    });
    let effectiveOutput: Gi088SemanticDeltaOutput;
    try {
      effectiveOutput = assertGi088SemanticDeltaOutput(normalized.output);
    } catch (error) {
      if (explicitStop === "mixed") {
        return this.finishDeterministicStop({
          batch,
          taskId,
          branch,
          turnId: turn.id,
          explicitStop: "mixed",
          completion,
          protectedIssues: createGi088OutputSchemaIssues(error)
        });
      }
      return this.finishProtectedFailure({
        batch,
        taskId,
        branch,
        turnId: turn.id,
        completion,
        issues: createGi088OutputSchemaIssues(error),
        output
      });
    }
    const validationOutput = effectiveOutput;
    const compatibilityOutput = toBoard7bWorkingTaskV1CompatibilityOutput(
      turnInput,
      validationOutput
    );
    const semanticIssues = validateGi088SemanticDeltaOutput({
      input: turnInput,
      output: validationOutput,
      deterministicStateMaintenance: true
    });
    const issues = [
      ...applyGi088SingleFocusValidationPolicy({
        output: compatibilityOutput,
        issues: semanticIssues
      }),
      ...validateGi088StageTransitionOutput({
        input: turnInput,
        output: compatibilityOutput
      })
    ];
    if (issues.length) {
      if (explicitStop === "mixed") {
        return this.finishDeterministicStop({
          batch,
          taskId,
          branch,
          turnId: turn.id,
          explicitStop: "mixed",
          completion,
          protectedIssues: issues
        });
      }
      return this.finishProtectedFailure({
        batch,
        taskId,
        branch,
        turnId: turn.id,
        completion,
        issues,
        output
      });
    }
    const nextSemanticState = applyGi088SemanticDeltaValidatedResult({
      input: turnInput,
      output: effectiveOutput
    });
    const state = structuredClone(batch.state);
    const mutableTrajectory = taskState(state, taskId).branches[branch];
    const mutableTurn = mutableTrajectory.turns.find((item) => item.id === turn.id)!;
    const call = mutableTurn.calls.at(-1)!;
    call.status = "valid";
    call.completedAt = nowIso(this.now);
    call.responseHash = sha256(completion.content);
    call.rawFinalOutput = completion.content;
    call.latencyMs = completion.latencyMs;
    call.tokenUsage = sanitizeAICompletionTokenUsage(completion.tokenUsage);
    call.providerDiagnostics = sanitizeAIProviderDiagnostics(
      completion.diagnostics
    );
    mutableTurn.status = isAutomaticRecovery
      ? "complete_after_auto_recovery"
      : isManualRecovery
        ? "complete_after_manual_recovery"
        : "valid";
    if ((isAutomaticRecovery || isManualRecovery) && mutableTurn.recovery) {
      mutableTurn.recovery.status = "recovered";
      mutableTurn.recovery.completedAt = nowIso(this.now);
    }
    mutableTurn.semantic = effectiveOutput.semantic;
    mutableTurn.visible = effectiveOutput.visible;
    mutableTurn.visibleText = renderGi088SemanticDeltaVisible(effectiveOutput);
    mutableTurn.evidenceExcerpts = this.evidenceExcerpts(
      mutableTrajectory.messages,
      effectiveOutput
    );
    mutableTurn.questionObservation = createGi088QuestionObservation(
      effectiveOutput
    );
    mutableTurn.stateMaintenance = normalized.maintenance;
    mutableTurn.semanticStateAfter = nextSemanticState;
    mutableTrajectory.semanticState = nextSemanticState;
    mutableTrajectory.pendingTurnId = null;
    mutableTrajectory.technicalError = null;
    mutableTrajectory.messages.push({
      id: `A${mutableTrajectory.messages.filter((m) => m.role === "assistant").length}`,
      role: "assistant",
      content: mutableTurn.visibleText
    });
    return this.save(batch, state);
  }

  private async finishDeterministicStop(input: {
    batch: Gi088StoredBatch;
    taskId: string;
    branch: Gi088BranchKey;
    turnId: string;
    explicitStop: "pure" | "mixed";
    completion?: Awaited<ReturnType<AIProvider["complete"]>>;
    technicalError?: unknown;
    protectedIssues?: string[];
  }) {
    const state = structuredClone(input.batch.state);
    const trajectory = taskState(state, input.taskId).branches[input.branch];
    const turn = trajectory.turns.find((item) => item.id === input.turnId);
    if (!turn || turn.status !== "processing") {
      throw new Gi088EvaluationError("GI088_RESERVED_TURN_NOT_FOUND", 409);
    }
    const turnInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: trajectory.messages,
      latestUserMessageId: turn.userMessageId,
      semanticState: turn.semanticStateBefore
    };
    const deterministic = createGi088DeterministicPauseOutput({
      turnInput,
      explicitStop: input.explicitStop
    });
    const nextSemanticState = applyGi088SemanticDeltaValidatedResult({
      input: turnInput,
      output: deterministic.output
    });
    const call = turn.calls.at(-1);
    if (call) {
      call.completedAt = nowIso(this.now);
      if (input.technicalError !== undefined) {
        const errorCode = getAIProviderFailureCode(input.technicalError);
        const diagnostics = getAIProviderDiagnostics(input.technicalError);
        call.status = "technical_failure";
        call.errorCode = errorCode;
        call.latencyMs = diagnostics?.latencyMs ?? null;
        call.tokenUsage = diagnostics?.tokenUsage ?? null;
        call.providerDiagnostics = diagnostics;
        turn.validationIssues = [
          ...new Set([
            ...turn.validationIssues,
            `DETERMINISTIC_STOP_ABSORBED:${errorCode}`
          ])
        ];
      } else if (input.completion && input.protectedIssues?.length) {
        call.status = "protected_failure";
        call.errorCode = "MODEL_OUTPUT_PROTECTED";
        call.responseHash = sha256(input.completion.content);
        call.rawFinalOutput = input.completion.content;
        call.latencyMs = input.completion.latencyMs;
        call.tokenUsage = sanitizeAICompletionTokenUsage(
          input.completion.tokenUsage
        );
        call.providerDiagnostics = sanitizeAIProviderDiagnostics(
          input.completion.diagnostics
        );
        turn.validationIssues = [
          ...new Set([...turn.validationIssues, ...input.protectedIssues])
        ];
      }
    }
    turn.status = "valid";
    turn.semantic = deterministic.output.semantic;
    turn.visible = deterministic.output.visible;
    turn.visibleText = renderGi088SemanticDeltaVisible(deterministic.output);
    turn.evidenceExcerpts = this.evidenceExcerpts(
      trajectory.messages,
      deterministic.output
    );
    turn.questionObservation = null;
    turn.stateMaintenance = deterministic.maintenance;
    turn.semanticStateAfter = nextSemanticState;
    turn.recovery = null;
    trajectory.semanticState = nextSemanticState;
    trajectory.pendingTurnId = null;
    trajectory.status = "running";
    trajectory.technicalError = null;
    trajectory.messages.push({
      id: `A${trajectory.messages.filter((message) => message.role === "assistant").length}`,
      role: "assistant",
      content: turn.visibleText
    });
    return this.save(input.batch, state);
  }

  private async finishTechnicalFailure(
    batch: Gi088StoredBatch,
    taskId: string,
    branch: Gi088BranchKey,
    turnId: string,
    error: unknown
  ) {
    const state = structuredClone(batch.state);
    const trajectory = taskState(state, taskId).branches[branch];
    const turn = trajectory.turns.find((item) => item.id === turnId)!;
    const call = turn.calls.at(-1)!;
    const errorCode = getAIProviderFailureCode(error);
    call.status = "technical_failure";
    call.completedAt = nowIso(this.now);
    call.errorCode = errorCode;
    const diagnostics = getAIProviderDiagnostics(error);
    call.latencyMs = diagnostics?.latencyMs ?? null;
    call.tokenUsage = diagnostics?.tokenUsage ?? null;
    call.providerDiagnostics = diagnostics;
    turn.status = "technical_failure";
    const emptyPolicy = this.emptyContentPolicyForTurn(turn);
    const commonRecoveryEligible =
      call.kind !== "automatic_retry" &&
      call.kind !== "manual_retry" &&
      call.attempt === 1 &&
      turn.calls.length < GI088_MAXIMUM_PROVIDER_CALLS_PER_TURN;
    const timeoutRecoveryEligible =
      commonRecoveryEligible &&
      GI088_TIMEOUT_RECOVERY_POLICY.eligibleBranches.some(
        (eligibleBranch) => eligibleBranch === branch
      ) &&
      errorCode === GI088_TIMEOUT_RECOVERY_POLICY.trigger &&
      diagnostics?.abortSource === GI088_TIMEOUT_RECOVERY_POLICY.eligibleAbortSource &&
      GI088_TIMEOUT_RECOVERY_POLICY.eligibleTimeoutStages.some(
        (stage) => stage === diagnostics?.timeoutStage
      );
    const emptyContentRecoveryEligible =
      commonRecoveryEligible &&
      branch === GI088_EMPTY_CONTENT_RECOVERY_POLICY.eligibleBranch &&
      errorCode === GI088_EMPTY_CONTENT_RECOVERY_POLICY.trigger;
    if (emptyContentRecoveryEligible || timeoutRecoveryEligible) {
      const eligibleAt = nowIso(this.now);
      turn.recovery = {
        status: "eligible",
        trigger: emptyContentRecoveryEligible ? "EMPTY_CONTENT" : "TIMEOUT",
        automaticRetryCount: 0,
        initialCallId: call.id,
        recoveryCallId: null,
        manualRetryCount: 0,
        manualRetryCallId: null,
        eligibleAt,
        automaticDeadlineAt: createAutomaticDeadlineAt(
          turn.calls[0]?.startedAt ?? call.startedAt
        ),
        startedAt: null,
        completedAt: null,
        policyVersion: emptyPolicy.version,
        maximumAutomaticRetriesPerTurn:
          emptyPolicy.maximumAutomaticRetriesPerTurn,
        maximumProviderCallsPerTurn:
          emptyPolicy.maximumProviderCallsPerTurn,
        policyOverride: emptyPolicy.policyOverride
      };
    } else if (call.kind === "automatic_retry" && turn.recovery) {
      const exhaustedEmptyContent =
        turn.recovery.trigger === "EMPTY_CONTENT" &&
        turn.recovery.automaticRetryCount >=
          (turn.recovery.maximumAutomaticRetriesPerTurn ??
            emptyPolicy.maximumAutomaticRetriesPerTurn);
      const maximumAutomaticRetries =
        turn.recovery.maximumAutomaticRetriesPerTurn ??
        emptyPolicy.maximumAutomaticRetriesPerTurn;
      turn.recovery.status = exhaustedEmptyContent
        ? maximumAutomaticRetries >= 2
          ? "exhausted"
          : "manual_available"
        : turn.recovery.trigger === "EMPTY_CONTENT"
          ? "eligible"
          : "manual_available";
      turn.recovery.completedAt = turn.recovery.status === "eligible"
        ? null
        : nowIso(this.now);
    } else if (call.kind === "manual_retry" && turn.recovery) {
      turn.recovery.status = "exhausted";
      turn.recovery.completedAt = nowIso(this.now);
    }
    trajectory.status = "technical_failure";
    trajectory.technicalError = errorCode;
    return this.save(batch, state);
  }

  private async finishProtectedFailure(input: {
    batch: Gi088StoredBatch;
    taskId: string;
    branch: Gi088BranchKey;
    turnId: string;
    completion: Awaited<ReturnType<AIProvider["complete"]>>;
    issues: string[];
    output: Gi088SemanticDeltaOutput | null;
  }) {
    const state = structuredClone(input.batch.state);
    const trajectory = taskState(state, input.taskId).branches[input.branch];
    const turn = trajectory.turns.find((item) => item.id === input.turnId)!;
    const call = turn.calls.at(-1)!;
    call.status = "protected_failure";
    call.completedAt = nowIso(this.now);
    call.responseHash = sha256(input.completion.content);
    call.rawFinalOutput = input.completion.content;
    call.latencyMs = input.completion.latencyMs;
    call.tokenUsage = sanitizeAICompletionTokenUsage(input.completion.tokenUsage);
    call.providerDiagnostics = sanitizeAIProviderDiagnostics(
      input.completion.diagnostics
    );
    call.errorCode = "MODEL_OUTPUT_PROTECTED";
    turn.status = "protected_failure";
    const commonProtectedRecoveryEligible =
      call.kind !== "automatic_retry" &&
      call.kind !== "manual_retry" &&
      call.attempt === 1 &&
      turn.calls.length < GI088_MAXIMUM_PROVIDER_CALLS_PER_TURN &&
      input.issues.length === 1;
    const stageTransitionRecoveryEligible =
      commonProtectedRecoveryEligible &&
      GI088_STAGE_TRANSITION_RECOVERY_POLICY.eligibleBranches.some(
        (branch) => branch === input.branch
      ) &&
      input.issues[0] === GI088_STAGE_TRANSITION_RECOVERY_POLICY.trigger;
    if (stageTransitionRecoveryEligible) {
      turn.recovery = {
        status: "eligible",
        trigger: "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE",
        automaticRetryCount: 0,
        initialCallId: call.id,
        recoveryCallId: null,
        manualRetryCount: 0,
        manualRetryCallId: null,
        eligibleAt: nowIso(this.now),
        automaticDeadlineAt: createAutomaticDeadlineAt(
          turn.calls[0]?.startedAt ?? call.startedAt
        ),
        startedAt: null,
        completedAt: null
      };
    } else if (call.kind === "automatic_retry" && turn.recovery) {
      turn.recovery.status = "manual_available";
      turn.recovery.completedAt = nowIso(this.now);
    } else if (call.kind === "manual_retry" && turn.recovery) {
      turn.recovery.status = "exhausted";
      turn.recovery.completedAt = nowIso(this.now);
    }
    turn.validationIssues = [
      ...new Set([...turn.validationIssues, ...input.issues])
    ];
    turn.semantic = input.output?.semantic ?? null;
    turn.visible = input.output?.visible ?? null;
    turn.visibleText = input.output
      ? renderGi088SemanticDeltaVisible(input.output)
      : null;
    turn.evidenceExcerpts = input.output
      ? this.evidenceExcerpts(trajectory.messages, input.output)
      : [];
    turn.questionObservation = input.output
      ? createGi088QuestionObservation(input.output)
      : null;
    const keepsPendingForRecovery =
      stageTransitionRecoveryEligible ||
      (Boolean(turn.recovery) &&
        (call.kind === "automatic_retry" || call.kind === "manual_retry"));
    if (!keepsPendingForRecovery) {
      trajectory.pendingTurnId = null;
    }
    trajectory.status = "protected_failure";
    trajectory.technicalError = null;
    return this.save(input.batch, state);
  }

  async retry(input: {
    ownerUserId: string;
    taskId: string;
    branch: Gi088BranchKey;
    turnId: string;
    trigger: Gi088RetryRequestTrigger;
  }) {
    let batch = await this.getOrCreateBatch(input.ownerUserId);
    this.assertMutable(batch);
    if (taskDefinition(input.taskId).evaluationRole === "compatibility_smoke") {
      throw new Gi088EvaluationError(
        "GI088_COMPATIBILITY_SMOKE_REQUIRES_EXTERNAL_RESULT",
        409
      );
    }
    const task = taskState(batch.state, input.taskId);
    const trajectory = task.branches[input.branch];
    const turn = trajectory.turns.find((item) => item.id === input.turnId);
    const recoveryTrigger = requestedRecoveryTrigger(input.trigger);
    const isAutomaticRecovery = recoveryTrigger !== null;
    const isManualAfterAutoRecovery =
      input.trigger === "manual_after_auto_recovery";
    const emptyPolicy = turn ? this.emptyContentPolicyForTurn(turn) : null;
    if (
      isAutomaticRecovery &&
      turn?.recovery &&
      turn.recovery.trigger === recoveryTrigger &&
      turn.recovery.status !== "eligible"
    ) {
      return createGi088PublicSession(batch);
    }
    if (
      isManualAfterAutoRecovery &&
      turn?.recovery &&
      turn.recovery.status !== "manual_available"
    ) {
      if (
        turn.recovery.manualRetryCount > 0 ||
        turn.recovery.status === "manual_retrying" ||
        turn.recovery.status === "recovered" ||
        turn.recovery.status === "exhausted"
      ) {
        return createGi088PublicSession(batch);
      }
    }
    if (
      !turn ||
      trajectory.pendingTurnId !== turn.id
    ) {
      throw new Gi088EvaluationError("GI088_TECHNICAL_RETRY_UNAVAILABLE", 409);
    }
    if (
      batch.state.activeTaskId !== input.taskId ||
      task.activeBranch !== input.branch ||
      (isManualAfterAutoRecovery
        ? turn.calls.length >= GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION
        : turn.calls.length >= (
            recoveryTrigger === "EMPTY_CONTENT"
              ? (emptyPolicy?.maximumProviderCallsPerTurn ?? 3)
              : GI088_MAXIMUM_PROVIDER_CALLS_PER_TURN
          ))
    ) {
      throw new Gi088EvaluationError("GI088_TECHNICAL_RETRY_LIMIT_REACHED", 409);
    }
    const previousCall = turn.calls.at(-1)!;
    if (recoveryTrigger === "EMPTY_CONTENT") {
      if (
        trajectory.status !== "technical_failure" ||
        turn.status !== "technical_failure" ||
        input.branch !== GI088_EMPTY_CONTENT_RECOVERY_POLICY.eligibleBranch ||
        previousCall.errorCode !== GI088_EMPTY_CONTENT_RECOVERY_POLICY.trigger ||
        turn.recovery?.trigger !== recoveryTrigger ||
        turn.recovery?.status !== "eligible" ||
        turn.recovery.automaticRetryCount >=
          (emptyPolicy?.maximumAutomaticRetriesPerTurn ??
            GI088_EMPTY_CONTENT_RECOVERY_POLICY.maximumAutomaticRetriesPerTurn)
      ) {
        throw new Gi088EvaluationError(
          "GI088_EMPTY_CONTENT_AUTO_RECOVERY_UNAVAILABLE",
          409
        );
      }
    } else if (recoveryTrigger === "TIMEOUT") {
      if (
        trajectory.status !== "technical_failure" ||
        turn.status !== "technical_failure" ||
        !GI088_TIMEOUT_RECOVERY_POLICY.eligibleBranches.some(
          (branch) => branch === input.branch
        ) ||
        previousCall.errorCode !== GI088_TIMEOUT_RECOVERY_POLICY.trigger ||
        previousCall.providerDiagnostics?.abortSource !==
          GI088_TIMEOUT_RECOVERY_POLICY.eligibleAbortSource ||
        !GI088_TIMEOUT_RECOVERY_POLICY.eligibleTimeoutStages.some(
          (stage) => stage === previousCall.providerDiagnostics?.timeoutStage
        ) ||
        turn.recovery?.trigger !== recoveryTrigger ||
        turn.recovery?.status !== "eligible" ||
        turn.recovery.automaticRetryCount >=
          GI088_TIMEOUT_RECOVERY_POLICY.maximumAutomaticRetriesPerTurn
      ) {
        throw new Gi088EvaluationError(
          "GI088_TIMEOUT_AUTO_RECOVERY_UNAVAILABLE",
          409
        );
      }
    } else if (recoveryTrigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE") {
      if (
        trajectory.status !== "protected_failure" ||
        turn.status !== "protected_failure" ||
        !GI088_STAGE_TRANSITION_RECOVERY_POLICY.eligibleBranches.some(
          (branch) => branch === input.branch
        ) ||
        turn.recovery?.trigger !== recoveryTrigger ||
        turn.recovery?.status !== "eligible" ||
        turn.recovery.automaticRetryCount >=
          GI088_STAGE_TRANSITION_RECOVERY_POLICY.maximumAutomaticRetriesPerTurn ||
        turn.validationIssues.length !== 1 ||
        turn.validationIssues[0] !== recoveryTrigger
      ) {
        throw new Gi088EvaluationError(
          "GI088_STAGE_TRANSITION_AUTO_RECOVERY_UNAVAILABLE",
          409
        );
      }
    } else if (isManualAfterAutoRecovery) {
      if (
        !turn.recovery ||
        turn.recovery.status !== "manual_available" ||
        turn.recovery.automaticRetryCount !== 1 ||
        turn.recovery.manualRetryCount !== 0 ||
        turn.calls.length !== 2 ||
        (trajectory.status !== "technical_failure" &&
          trajectory.status !== "protected_failure") ||
        (turn.status !== "technical_failure" &&
          turn.status !== "protected_failure")
      ) {
        throw new Gi088EvaluationError(
          "GI088_MANUAL_AFTER_AUTO_RECOVERY_UNAVAILABLE",
          409
        );
      }
    } else if (turn.recovery) {
      const code = turn.recovery.trigger === "EMPTY_CONTENT"
        ? "GI088_EMPTY_CONTENT_REQUIRES_AUTO_RECOVERY"
        : turn.recovery.trigger === "TIMEOUT"
          ? "GI088_TIMEOUT_REQUIRES_AUTO_RECOVERY"
          : turn.recovery.trigger === "ASK_QUESTION_COUNT_INVALID:2"
            ? "GI088_SINGLE_QUESTION_REQUIRES_AUTO_RECOVERY"
            : "GI088_STAGE_TRANSITION_REQUIRES_AUTO_RECOVERY";
      throw new Gi088EvaluationError(code, 409);
    } else if (
      trajectory.status !== "technical_failure" ||
      turn.status !== "technical_failure"
    ) {
      throw new Gi088EvaluationError("GI088_TECHNICAL_RETRY_UNAVAILABLE", 409);
    }
    const automaticDeadlineAt = isAutomaticRecovery
      ? turn.recovery?.automaticDeadlineAt ??
        createAutomaticDeadlineAt(turn.calls[0]?.startedAt ?? previousCall.startedAt)
      : null;
    const remainingSharedDeadlineMs = automaticDeadlineAt
      ? remainingAutomaticDeadlineMs(automaticDeadlineAt, this.now())
      : null;
    if (isAutomaticRecovery && remainingSharedDeadlineMs === 0) {
      const expiredState = structuredClone(batch.state);
      const expiredTurn = taskState(expiredState, input.taskId)
        .branches[input.branch].turns.find((item) => item.id === input.turnId)!;
      if (expiredTurn.recovery) {
        expiredTurn.recovery.status = "manual_available";
        expiredTurn.recovery.automaticDeadlineAt = automaticDeadlineAt;
        expiredTurn.recovery.completedAt = nowIso(this.now);
      }
      try {
        batch = await this.save(batch, expiredState);
      } catch (error) {
        if (
          error instanceof Gi088EvaluationError &&
          error.code === "GI088_CONCURRENT_UPDATE"
        ) {
          const current = await this.store.findByOwnerAndVersion(
            input.ownerUserId,
            GI088_EVALUATION_VERSION
          );
          if (current) return createGi088PublicSession(current);
        }
        throw error;
      }
      return createGi088PublicSession(batch);
    }
    const effectiveHardTimeoutMs = isAutomaticRecovery
      ? Math.max(
          1,
          Math.min(
            GI088_SHARED_RECOVERY_DEADLINE_POLICY.maximumSingleCallMs,
            remainingSharedDeadlineMs ??
              GI088_SHARED_RECOVERY_DEADLINE_POLICY.maximumSingleCallMs
          )
        )
      : isManualAfterAutoRecovery
        ? GI088_SHARED_RECOVERY_DEADLINE_POLICY.manualRetryHardTimeoutMs
        : GI088_TIMEOUT_POLICY.hardTimeoutMs;
    this.authorizeModelCall(input.branch);
    const state = structuredClone(batch.state);
    const mutableTrajectory = taskState(state, input.taskId).branches[input.branch];
    const mutableTurn = mutableTrajectory.turns.find((item) => item.id === input.turnId)!;
    mutableTurn.status = "processing";
    const turnInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: mutableTrajectory.messages,
      latestUserMessageId: mutableTurn.userMessageId,
      semanticState: mutableTurn.semanticStateBefore
    };
    const effectiveRecoveryTrigger = isManualAfterAutoRecovery
      ? mutableTurn.recovery!.trigger
      : recoveryTrigger;
    const completionRecoveryTrigger = isManualAfterAutoRecovery
      ? null
      : effectiveRecoveryTrigger;
    const completionParams = this.createCompletionParams(
      input.branch,
      turnInput,
      completionRecoveryTrigger,
      effectiveHardTimeoutMs
    );
    const recoveryCallId = randomUUID();
    mutableTurn.calls.push({
      id: recoveryCallId,
      attempt: mutableTurn.calls.length + 1,
      kind: isAutomaticRecovery ? "automatic_retry" : "manual_retry",
      status: "processing",
      startedAt: nowIso(this.now),
      completedAt: null,
      requestHash: this.createRequestHash(completionParams),
      responseHash: null,
      rawFinalOutput: null,
      latencyMs: null,
      tokenUsage: null,
      providerDiagnostics: null,
      errorCode: null,
      parentCallId:
        isAutomaticRecovery || isManualAfterAutoRecovery
          ? previousCall.id
          : null,
      retryTrigger: effectiveRecoveryTrigger,
      retryOrdinal: isAutomaticRecovery
        ? (mutableTurn.recovery?.automaticRetryCount ?? 0) + 1
        : isManualAfterAutoRecovery
          ? 2
          : null,
      effectiveConfig: this.createEffectiveConfig(
        input.branch,
        completionRecoveryTrigger,
        {
          hardTimeoutMs: effectiveHardTimeoutMs,
          sharedDeadlineMs: isAutomaticRecovery
            ? GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs
            : null,
          remainingSharedDeadlineMs: isAutomaticRecovery
            ? remainingSharedDeadlineMs
            : null,
          recoveryPolicyVersion: isAutomaticRecovery
            ? GI088_SHARED_RECOVERY_DEADLINE_POLICY.version
            : isManualAfterAutoRecovery
              ? GI088_MANUAL_RECOVERY_POLICY.version
              : null,
          emptyContentAutomaticRetries:
            emptyPolicy?.maximumAutomaticRetriesPerTurn,
          emptyContentMaximumProviderCalls:
            emptyPolicy?.maximumProviderCallsPerTurn,
          emptyContentPolicyOverride: emptyPolicy?.policyOverride
        }
      )
    });
    if (isAutomaticRecovery && mutableTurn.recovery) {
      mutableTurn.recovery.status = "retrying";
      mutableTurn.recovery.automaticDeadlineAt = automaticDeadlineAt;
      mutableTurn.recovery.automaticRetryCount += 1;
      mutableTurn.recovery.recoveryCallId = recoveryCallId;
      mutableTurn.recovery.startedAt = nowIso(this.now);
    } else if (isManualAfterAutoRecovery && mutableTurn.recovery) {
      mutableTurn.recovery.status = "manual_retrying";
      mutableTurn.recovery.manualRetryCount += 1;
      mutableTurn.recovery.manualRetryCallId = recoveryCallId;
      mutableTurn.recovery.startedAt = nowIso(this.now);
    }
    mutableTrajectory.status = "running";
    mutableTrajectory.technicalError = null;
    try {
      batch = await this.save(batch, state);
    } catch (error) {
      if (
        (isAutomaticRecovery || isManualAfterAutoRecovery) &&
        error instanceof Gi088EvaluationError &&
        error.code === "GI088_CONCURRENT_UPDATE"
      ) {
        const current = await this.store.findByOwnerAndVersion(
          input.ownerUserId,
          GI088_EVALUATION_VERSION
        );
        if (current) return createGi088PublicSession(current);
      }
      throw error;
    }
    return createGi088PublicSession(
      await this.executeReservedTurn(batch, input.taskId, input.branch)
    );
  }

  async reviewQuestion(input: {
    ownerUserId: string;
    taskId: string;
    branch: Gi088BranchKey;
    turnId: string;
    classification: Gi088QuestionReviewClassification;
    note: string;
  }) {
    const classifications: Gi088QuestionReviewClassification[] = [
      "same_focus_low_burden",
      "same_focus_heavy",
      "multiple_independent_tasks",
      "uncertain"
    ];
    if (!classifications.includes(input.classification)) {
      throw new Gi088EvaluationError(
        "GI088_QUESTION_REVIEW_CLASSIFICATION_INVALID",
        400
      );
    }
    const note = input.note.trim();
    if (note.length > 1_000) {
      throw new Gi088EvaluationError("GI088_QUESTION_REVIEW_NOTE_INVALID", 400);
    }
    const batch = await this.getOrCreateBatch(input.ownerUserId);
    this.assertMutable(batch);
    const task = taskState(batch.state, input.taskId);
    const trajectory = task.branches[input.branch];
    const turn = trajectory.turns.find((item) => item.id === input.turnId);
    if (
      batch.state.activeTaskId !== input.taskId ||
      task.activeBranch !== input.branch ||
      trajectory.status === "completed" ||
      trajectory.review ||
      !turn?.questionObservation
    ) {
      throw new Gi088EvaluationError(
        "GI088_QUESTION_REVIEW_UNAVAILABLE",
        409
      );
    }
    const existing = turn.questionObservation.review;
    if (
      existing?.classification === input.classification &&
      existing.note === note
    ) {
      return createGi088PublicSession(batch);
    }
    const state = structuredClone(batch.state);
    const mutableTurn = taskState(state, input.taskId)
      .branches[input.branch].turns.find((item) => item.id === input.turnId)!;
    mutableTurn.questionObservation!.review = {
      classification: input.classification,
      note,
      reviewedAt: nowIso(this.now)
    };
    try {
      return createGi088PublicSession(await this.save(batch, state));
    } catch (error) {
      if (
        error instanceof Gi088EvaluationError &&
        error.code === "GI088_CONCURRENT_UPDATE"
      ) {
        const current = await this.store.findByOwnerAndVersion(
          input.ownerUserId,
          GI088_EVALUATION_VERSION
        );
        const currentReview = current
          ? taskState(current.state, input.taskId)
              .branches[input.branch].turns.find(
                (item) => item.id === input.turnId
              )?.questionObservation?.review
          : null;
        if (
          current &&
          currentReview?.classification === input.classification &&
          currentReview.note === note
        ) {
          return createGi088PublicSession(current);
        }
      }
      throw error;
    }
  }

  async endTrajectory(input: {
    ownerUserId: string;
    taskId: string;
    branch: Gi088BranchKey;
    feeling: "better" | "same" | "worse";
    quality: "direct_use" | "minor_issue" | "quality_failure" | "single_case_blocker";
    targetTrigger: Exclude<Gi088TargetTrigger, "legacy_unknown">;
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason || reason.length > 2_000) {
      throw new Gi088EvaluationError("GI088_REVIEW_REASON_INVALID", 400);
    }
    if (
      input.targetTrigger !== "triggered" &&
      input.targetTrigger !== "not_triggered" &&
      input.targetTrigger !== "blocked_by_technical_failure"
    ) {
      throw new Gi088EvaluationError("GI088_TARGET_TRIGGER_INVALID", 400);
    }
    const batch = await this.getOrCreateBatch(input.ownerUserId);
    this.assertMutable(batch);
    const state = structuredClone(batch.state);
    const task = taskState(state, input.taskId);
    const trajectory = task.branches[input.branch];
    if (
      evaluationMode(state) === "high_only" &&
      unreviewedQuestionTurns(trajectory).length > 0
    ) {
      throw new Gi088EvaluationError("GI088_QUESTION_REVIEWS_REQUIRED", 409);
    }
    const pendingTurn = trajectory.pendingTurnId
      ? trajectory.turns.find((turn) => turn.id === trajectory.pendingTurnId)
      : null;
    const canEndTechnicalFailure =
      trajectory.status === "technical_failure" &&
      pendingTurn?.status === "technical_failure" &&
      (!pendingTurn.recovery ||
        pendingTurn.recovery.status === "manual_available" ||
        pendingTurn.recovery.status === "exhausted");
    const canEndProtectedRecoveryFailure =
      trajectory.status === "protected_failure" &&
      pendingTurn?.status === "protected_failure" &&
      (pendingTurn.recovery?.status === "manual_available" ||
        pendingTurn.recovery?.status === "exhausted");
    const canEndContentTrajectory =
      ["running", "protected_failure"].includes(trajectory.status) &&
      !trajectory.pendingTurnId;
    if (
      task.activeBranch !== input.branch ||
      (!canEndContentTrajectory &&
        !canEndTechnicalFailure &&
        !canEndProtectedRecoveryFailure)
    ) {
      throw new Gi088EvaluationError("GI088_TRAJECTORY_CANNOT_END", 409);
    }
    if (
      input.targetTrigger === "blocked_by_technical_failure" &&
      !taskHasTechnicalFailure(trajectory)
    ) {
      throw new Gi088EvaluationError(
        "GI088_TARGET_TRIGGER_TECHNICAL_EVIDENCE_REQUIRED",
        409
      );
    }
    trajectory.review = {
      feeling: input.feeling,
      quality: input.quality,
      targetTrigger: input.targetTrigger,
      reason,
      reviewedAt: nowIso(this.now)
    };
    if (canEndTechnicalFailure || canEndProtectedRecoveryFailure) {
      trajectory.pendingTurnId = null;
    }
    trajectory.status = "completed";
    trajectory.completedAt = nowIso(this.now);
    if (evaluationMode(state) === "high_only") {
      state.activeTaskId = null;
    }
    const saved = await this.save(batch, state);
    return createGi088PublicSession(saved);
  }

  async compare(input: {
    ownerUserId: string;
    taskId: string;
    preference: "off_better" | "high_better" | "equivalent";
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason || reason.length > 2_000) {
      throw new Gi088EvaluationError("GI088_COMPARISON_REASON_INVALID", 400);
    }
    const batch = await this.getOrCreateBatch(input.ownerUserId);
    this.assertMutable(batch);
    if (evaluationMode(batch.state) === "high_only") {
      throw new Gi088EvaluationError("GI088_COMPARISON_NOT_REQUIRED", 409);
    }
    const state = structuredClone(batch.state);
    const task = taskState(state, input.taskId);
    if (task.comparison) {
      if (
        task.comparison.preference === input.preference &&
        task.comparison.reason === reason
      ) {
        return createGi088PublicSession(batch);
      }
      throw new Gi088EvaluationError("GI088_COMPARISON_ALREADY_RECORDED", 409);
    }
    if (
      task.branches.off.status !== "completed" ||
      task.branches.high.status !== "completed" ||
      !task.branches.off.review ||
      !task.branches.high.review
    ) {
      throw new Gi088EvaluationError("GI088_BOTH_TRAJECTORY_REVIEWS_REQUIRED", 409);
    }
    task.comparison = {
      preference: input.preference,
      reason,
      comparedAt: nowIso(this.now)
    };
    state.activeTaskId = null;
    const saved = await this.save(batch, state);
    return createGi088PublicSession(saved);
  }

  async recordCompatibilitySmoke(input: {
    ownerUserId: string;
    taskId: string;
    outcome: "passed" | "failed";
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason || reason.length > 2_000) {
      throw new Gi088EvaluationError(
        "GI088_COMPATIBILITY_SMOKE_INPUT_INVALID",
        400
      );
    }
    let batch = await this.getOrCreateBatch(input.ownerUserId);
    this.assertMutable(batch);
    const definition = taskDefinition(input.taskId);
    if (definition.evaluationRole !== "compatibility_smoke") {
      throw new Gi088EvaluationError(
        "GI088_COMPATIBILITY_SMOKE_UNAVAILABLE",
        409
      );
    }
    const existing = taskState(batch.state, input.taskId).compatibilitySmoke;
    if (existing) {
      if (existing.outcome === input.outcome && existing.reason === reason) {
        return createGi088PublicSession(batch);
      }
      throw new Gi088EvaluationError(
        "GI088_COMPATIBILITY_SMOKE_UNAVAILABLE",
        409
      );
    }
    if (
      batch.state.activeTaskId !== null ||
      firstIncompleteTaskId(batch.state) !== input.taskId
    ) {
      throw new Gi088EvaluationError(
        "GI088_COMPATIBILITY_SMOKE_UNAVAILABLE",
        409
      );
    }
    const state = structuredClone(batch.state);
    taskState(state, input.taskId).compatibilitySmoke = {
      outcome: input.outcome,
      reason,
      observedAt: nowIso(this.now)
    };
    batch = await this.save(batch, state);
    return createGi088PublicSession(batch);
  }

  async seal(ownerUserId: string) {
    const batch = await this.getOrCreateBatch(ownerUserId);
    this.assertMutable(batch);
    if (
      batch.state.activeTaskId !== null ||
      batch.state.tasks.some(
        (task) => !isCompletedTaskBoundary(batch.state, task)
      )
    ) {
      throw new Gi088EvaluationError("GI088_BATCH_INCOMPLETE", 409);
    }
    const state = structuredClone(batch.state);
    const sealedAt = this.now();
    state.status = "sealed";
    state.sealedAt = sealedAt.toISOString();
    const saved = await this.save(batch, state, sealedAt);
    return createGi088PublicSession(saved);
  }

  async earlyStop(input: {
    ownerUserId: string;
    reasonCode: Gi088EarlyStopReasonCode;
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason || reason.length > 2_000) {
      throw new Gi088EvaluationError("GI088_EARLY_STOP_REASON_INVALID", 400);
    }
    if (
      input.reasonCode !== "sufficient_evidence" &&
      input.reasonCode !== "technical_friction" &&
      input.reasonCode !== "mixed" &&
      input.reasonCode !== "other"
    ) {
      throw new Gi088EvaluationError("GI088_EARLY_STOP_REASON_CODE_INVALID", 400);
    }
    const batch = await this.getOrCreateBatch(input.ownerUserId);
    this.assertMutable(batch);
    const state = structuredClone(batch.state);
    const firstRemainingIndex = state.tasks.findIndex(
      (task) => !isTaskCompleted(state, task)
    );
    const completed =
      firstRemainingIndex < 0 ? state.tasks : state.tasks.slice(0, firstRemainingIndex);
    const remaining =
      firstRemainingIndex < 0 ? [] : state.tasks.slice(firstRemainingIndex);
    if (
      state.activeTaskId !== null ||
      completed.length === 0 ||
      remaining.length === 0 ||
      completed.some((task) => !isCompletedTaskBoundary(state, task)) ||
      remaining.some((task) => !isPristineTask(state, task))
    ) {
      throw new Gi088EvaluationError("GI088_EARLY_STOP_TASK_BOUNDARY_REQUIRED", 409);
    }
    const stoppedAt = this.now();
    state.status = "early_stopped";
    state.sealedAt = stoppedAt.toISOString();
    state.earlyStop = {
      reasonCode: input.reasonCode,
      reason,
      stoppedAt: stoppedAt.toISOString(),
      completedTaskIds: completed.map((task) => task.taskId),
      remainingTaskIds: remaining.map((task) => task.taskId)
    };
    const saved = await this.save(batch, state, stoppedAt);
    return createGi088PublicSession(saved);
  }

  async export(ownerUserId: string) {
    const batch = await this.getOrCreateBatch(ownerUserId);
    if (batch.status !== "sealed" && batch.status !== "early_stopped") {
      throw new Gi088EvaluationError("GI088_BATCH_MUST_BE_TERMINAL", 409);
    }
    const persistedTerminalAt = batch.sealedAt?.toISOString() ?? null;
    const firstRemainingIndex = batch.state.tasks.findIndex(
      (task) => !isTaskCompleted(batch.state, task)
    );
    const completedBoundaryTasks = firstRemainingIndex < 0
      ? batch.state.tasks
      : batch.state.tasks.slice(0, firstRemainingIndex);
    const remainingBoundaryTasks = firstRemainingIndex < 0
      ? []
      : batch.state.tasks.slice(firstRemainingIndex);
    const terminalScopeValid = batch.status === "sealed"
      ? batch.state.activeTaskId === null &&
        batch.state.tasks.every((task) =>
          isCompletedTaskBoundary(batch.state, task)
        )
      : batch.state.activeTaskId === null &&
        completedBoundaryTasks.length > 0 &&
        remainingBoundaryTasks.length > 0 &&
        completedBoundaryTasks.every((task) =>
          isCompletedTaskBoundary(batch.state, task)
        ) &&
        remainingBoundaryTasks.every((task) =>
          isPristineTask(batch.state, task)
        );
    if (
      batch.state.status !== batch.status ||
      !persistedTerminalAt ||
      batch.state.sealedAt !== persistedTerminalAt ||
      !terminalScopeValid ||
      (batch.status === "early_stopped" &&
        (!batch.state.earlyStop ||
          batch.state.earlyStop.stoppedAt !== persistedTerminalAt))
    ) {
      throw new Gi088EvaluationError("GI088_BATCH_TERMINAL_STATE_MISMATCH", 409);
    }
    const sanitized = sanitizeGi088BatchStateForOutput(batch.state);
    const completedTaskIds = sanitized.tasks
      .filter((task) => isTaskCompleted(sanitized, task))
      .map((task) => task.taskId);
    const notRunTaskIds = sanitized.tasks
      .filter((task) => publicTaskStatus(sanitized, task) === "not_run")
      .map((task) => task.taskId);
    if (
      batch.status === "early_stopped" &&
      (JSON.stringify(batch.state.earlyStop?.completedTaskIds) !==
        JSON.stringify(completedTaskIds) ||
        JSON.stringify(batch.state.earlyStop?.remainingTaskIds) !==
          JSON.stringify(notRunTaskIds))
    ) {
      throw new Gi088EvaluationError("GI088_BATCH_EARLY_STOP_SCOPE_MISMATCH", 409);
    }
    return {
      exportVersion: "2026-08-09.gi088-readonly-export-v0.5",
      exportedAt: nowIso(this.now),
      evaluation: {
        id: GI088_EVALUATION_ID,
        version: GI088_EVALUATION_VERSION,
        candidateFingerprint: batch.candidateFingerprint,
        executionFingerprint: batch.executionFingerprint,
        mode: evaluationMode(batch.state),
        activeBranches: evaluationMode(batch.state) === "high_only"
          ? [...GI088_ACTIVE_BRANCHES]
          : ["off", "high"],
        maximumProviderCallsPerTrajectory:
          null,
        maximumProviderCallsPerUserSubmission:
          GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION,
        configs: evaluationMode(batch.state) === "high_only"
          ? { high: GI088_CONFIGS.high }
          : GI088_CONFIGS
      },
      completion: {
        status: batch.status,
        terminalAt: persistedTerminalAt,
        completedTaskIds,
        notRunTaskIds
      },
      batch: {
        ...sanitized,
        tasks: sanitized.tasks.map((task) => ({
          ...task,
          status: publicTaskStatus(sanitized, task)
        }))
      }
    };
  }
}
