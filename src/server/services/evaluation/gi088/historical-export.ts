import {
  GI088_CONFIGS,
  GI088_EVALUATION_ID_V6,
  GI088_EVALUATION_VERSION_V6,
  GI088_V6_TASKS
} from "@/server/services/evaluation/gi088/candidate";
import { sanitizeGi088BatchStateForOutput } from "@/server/services/evaluation/gi088/service";
import type {
  Gi088BatchState,
  Gi088StoredBatch,
  Gi088TaskState,
  Gi088Trajectory
} from "@/server/services/evaluation/gi088/types";

function isCompletedTrajectory(trajectory: Gi088Trajectory) {
  return trajectory.status === "completed" &&
    trajectory.review !== null &&
    trajectory.pendingTurnId === null &&
    trajectory.startedAt !== null &&
    trajectory.completedAt !== null &&
    trajectory.turns.length > 0;
}

function isCompletedTask(state: Gi088BatchState, task: Gi088TaskState) {
  return (state.evaluationMode ?? "paired") === "high_only"
    ? isCompletedTrajectory(task.branches.high)
    : Boolean(
        task.comparison &&
          isCompletedTrajectory(task.branches.off) &&
          isCompletedTrajectory(task.branches.high)
      );
}

export function createGi088V6HistoricalExport(batch: Gi088StoredBatch) {
  if (
    batch.evaluationVersion !== GI088_EVALUATION_VERSION_V6 ||
    (batch.status !== "sealed" && batch.status !== "early_stopped") ||
    batch.state.status !== batch.status ||
    !batch.sealedAt ||
    batch.state.sealedAt !== batch.sealedAt.toISOString()
  ) {
    throw new Error("GI088_V6_HISTORICAL_EXPORT_STATE_INVALID");
  }
  const sanitized = sanitizeGi088BatchStateForOutput(batch.state);
  const completedTaskIds = sanitized.tasks
    .filter((task) => isCompletedTask(sanitized, task))
    .map((task) => task.taskId);
  const notRunTaskIds = sanitized.tasks
    .filter((task) => !isCompletedTask(sanitized, task))
    .map((task) => task.taskId);
  if (
    batch.status === "early_stopped" &&
    (JSON.stringify(batch.state.earlyStop?.completedTaskIds) !==
      JSON.stringify(completedTaskIds) ||
      JSON.stringify(batch.state.earlyStop?.remainingTaskIds) !==
        JSON.stringify(notRunTaskIds))
  ) {
    throw new Error("GI088_V6_HISTORICAL_EXPORT_SCOPE_INVALID");
  }
  return {
    exportVersion: "2026-08-09.gi088-readonly-export-v0.4",
    exportedAt: new Date().toISOString(),
    evaluation: {
      id: GI088_EVALUATION_ID_V6,
      version: GI088_EVALUATION_VERSION_V6,
      candidateFingerprint: batch.candidateFingerprint,
      executionFingerprint: batch.executionFingerprint,
      mode: batch.state.evaluationMode ?? "paired",
      activeBranches:
        (batch.state.evaluationMode ?? "paired") === "high_only"
          ? ["high"]
          : ["off", "high"],
      maximumProviderCallsPerTrajectory: 12,
      configs: { high: GI088_CONFIGS.high }
    },
    completion: {
      status: batch.status,
      terminalAt: batch.sealedAt.toISOString(),
      completedTaskIds,
      notRunTaskIds
    },
    taskDefinitions: GI088_V6_TASKS,
    batch: {
      ...sanitized,
      tasks: sanitized.tasks.map((task) => ({
        ...task,
        status: isCompletedTask(sanitized, task) ? "completed" : "not_run"
      }))
    }
  };
}
