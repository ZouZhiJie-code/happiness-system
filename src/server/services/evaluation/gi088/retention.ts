import { GI088_GOVERNED_EVALUATION_VERSIONS } from "@/server/services/evaluation/gi088/candidate";

export const GI088_RAW_DATA_RETENTION_DAYS = 30 as const;

export function createGi088RetentionSelection() {
  return {
    batchWhere: {
      evaluationVersion: { in: [...GI088_GOVERNED_EVALUATION_VERSIONS] }
    },
    // gi088TechnicalSmoke is a plan-specific table. Selecting the whole table
    // keeps historical runner fingerprints in the same Board 6 retention scope.
    smokeWhere: {}
  };
}

export function summarizeGi088RetentionBatch(batch: {
  id: string;
  evaluationVersion: string;
  candidateFingerprint: string;
  executionFingerprint: string;
  status: string;
  sealedAt: Date | null;
  state: unknown;
}) {
  const state = batch.state as {
    evaluationMode?: unknown;
    tasks?: Array<{
      comparison?: unknown;
      branches?: { high?: { review?: unknown } };
    }>;
    earlyStop?: {
      reasonCode?: unknown;
      reason?: unknown;
      completedTaskIds?: unknown;
      remainingTaskIds?: unknown;
    } | null;
  } | null;
  const tasks = Array.isArray(state?.tasks) ? state.tasks : [];
  const earlyStop = state?.earlyStop;
  const highOnly = state?.evaluationMode === "high_only";
  const isCompletedTask = (task: (typeof tasks)[number]) =>
    highOnly ? Boolean(task?.branches?.high?.review) : Boolean(task?.comparison);
  return {
    batchId: batch.id,
    evaluationVersion: batch.evaluationVersion,
    candidateFingerprint: batch.candidateFingerprint,
    executionFingerprint: batch.executionFingerprint,
    status: batch.status,
    sealedAt: batch.sealedAt?.toISOString() ?? null,
    taskCount: tasks.length,
    completedTaskCount: tasks.filter(isCompletedTask).length,
    notRunTaskCount:
      batch.status === "early_stopped"
        ? tasks.filter((task) => !isCompletedTask(task)).length
        : 0,
    earlyStop: earlyStop
      ? {
          reasonCode:
            typeof earlyStop.reasonCode === "string"
              ? earlyStop.reasonCode
              : "legacy_unknown",
          reason: typeof earlyStop.reason === "string" ? earlyStop.reason : null,
          completedTaskIds: Array.isArray(earlyStop.completedTaskIds)
            ? earlyStop.completedTaskIds
            : [],
          remainingTaskIds: Array.isArray(earlyStop.remainingTaskIds)
            ? earlyStop.remainingTaskIds
            : []
        }
      : null
  };
}

export function summarizeGi088RetentionSmoke(smoke: {
  id: string;
  executionFingerprint: string;
  arm: string;
  authorizationId: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    smokeId: smoke.id,
    executionFingerprint: smoke.executionFingerprint,
    arm: smoke.arm,
    authorizationId: smoke.authorizationId,
    status: smoke.status,
    createdAt: smoke.createdAt.toISOString(),
    completedAt: smoke.completedAt?.toISOString() ?? null
  };
}
