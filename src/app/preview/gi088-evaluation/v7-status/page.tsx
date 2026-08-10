import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAdminPage } from "@/server/services/auth/admin-access";
import {
  canOpenGi088Evaluation,
  isGi088EvaluatorUsername,
  validateGi088EvaluationDatabaseUrl
} from "@/server/services/evaluation/gi088/access";
import {
  GI088_EVALUATION_VERSION,
  createGi088DatasetFingerprint,
  createGi088ExecutionFingerprint
} from "@/server/services/evaluation/gi088/candidate";
import { createGi088PrismaStore } from "@/server/services/evaluation/gi088/prisma-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "GI-088 v7 Preview 状态 | Daily Light",
  robots: { index: false, follow: false }
};

export default async function Gi088V7StatusPage() {
  if (!canOpenGi088Evaluation()) notFound();
  try {
    validateGi088EvaluationDatabaseUrl();
  } catch {
    notFound();
  }
  const user = await requireAdminPage(
    "/preview/gi088-evaluation/v7-status"
  );
  if (!isGi088EvaluatorUsername(user.username)) notFound();
  const batch = await createGi088PrismaStore().findByOwnerAndVersion(
    user.id,
    GI088_EVALUATION_VERSION
  );
  if (!batch) notFound();

  const completedTaskCount = batch.state.tasks.filter(
    (task) => task.branches.high.review !== null
  ).length;
  const modelCallCount = batch.state.tasks.reduce(
    (taskTotal, task) =>
      taskTotal +
      (["off", "high"] as const).reduce(
        (branchTotal, branch) =>
          branchTotal +
          task.branches[branch].turns.reduce(
            (turnTotal, turn) => turnTotal + turn.calls.length,
            0
          ),
        0
      ),
    0
  );
  const payload = {
    batchId: batch.id,
    status: batch.status,
    revision: batch.revision,
    evaluationVersion: batch.evaluationVersion,
    candidateFingerprint: batch.candidateFingerprint,
    datasetFingerprint: createGi088DatasetFingerprint(),
    executionFingerprint: batch.executionFingerprint,
    expectedExecutionFingerprint: createGi088ExecutionFingerprint(),
    executionFingerprintVerified:
      batch.executionFingerprint === createGi088ExecutionFingerprint(),
    completedTaskCount,
    totalTaskCount: batch.state.tasks.length,
    activeTaskId: batch.state.activeTaskId,
    taskIds: batch.state.tasks.map((task) => task.taskId),
    modelCallCount,
    maximumProviderCallsPerTrajectory: null,
    maximumProviderCallsPerUserSubmission: 3
  };

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] p-6 text-[var(--text-primary)]">
      <h1 className="text-xl font-semibold">GI-088 v7 Preview 状态</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        只读展示空白批次、版本和执行血缘，不包含对话正文。
      </p>
      <pre
        data-testid="gi088-v7-status"
        className="mt-6 max-h-[75vh] overflow-auto whitespace-pre-wrap rounded-[var(--radius-card)] bg-[var(--surface-muted)] p-4 text-xs"
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
    </main>
  );
}
