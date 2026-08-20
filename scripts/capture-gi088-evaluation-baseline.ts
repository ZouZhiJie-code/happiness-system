import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/gi088-evaluation-client";

const HIDDEN_REASONING_KEYS = new Set([
  "chainOfThought",
  "reasoningBody",
  "reasoningContent",
  "reasoning_content",
  "thinkingContent",
  "thinking_content"
]);

function omitHiddenReasoning(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitHiddenReasoning);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) =>
      HIDDEN_REASONING_KEYS.has(key)
        ? []
        : [[key, omitHiddenReasoning(nested)]]
    )
  );
}

function sha256(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function summarizeState(state: unknown) {
  const safeState = state as {
    activeTaskId?: string | null;
    status?: string;
    tasks?: Array<{
      taskId?: string;
      branches?: Record<
        string,
        {
          status?: string;
          turns?: Array<{
            calls?: Array<{ status?: string }>;
          }>;
        }
      >;
    }>;
  };
  const trajectories = (safeState.tasks ?? []).flatMap((task) =>
    Object.entries(task.branches ?? {}).map(([branch, trajectory]) => ({
      taskId: task.taskId ?? null,
      branch,
      status: trajectory.status ?? null,
      calls: (trajectory.turns ?? []).flatMap((turn) => turn.calls ?? [])
    }))
  );
  const calls = trajectories.flatMap((trajectory) => trajectory.calls);
  return {
    status: safeState.status ?? null,
    activeTaskId: safeState.activeTaskId ?? null,
    taskCount: safeState.tasks?.length ?? 0,
    completedTrajectoryCount: trajectories.filter(
      (trajectory) => trajectory.status === "completed"
    ).length,
    providerCallCount: calls.length,
    providerCallStatusCounts: Object.fromEntries(
      [...new Set(calls.map((call) => call.status ?? "unknown"))].map(
        (status) => [
          status,
          calls.filter((call) => (call.status ?? "unknown") === status).length
        ]
      )
    )
  };
}

async function main() {
  const batchId = process.argv[2]?.trim();
  const outputPath = process.argv[3]?.trim();
  const rawDatabaseUrl =
    process.env.EVALUATION_DATABASE_URL?.trim() ||
    process.env.EVALUATION_DATABASE_URL_UNPOOLED?.trim();
  const evaluationSchema =
    process.env.GI088_EVALUATION_DATABASE_SCHEMA?.trim();
  if (!batchId || !outputPath || !rawDatabaseUrl || !evaluationSchema) {
    throw new Error(
      "Usage: capture-gi088-evaluation-baseline <batchId> <outputPath> with EVALUATION_DATABASE_URL"
    );
  }

  const databaseIdentity = new URL(rawDatabaseUrl);
  databaseIdentity.searchParams.set("schema", evaluationSchema);
  const databaseUrl = databaseIdentity.toString();
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const batch = await client.gi088EvaluationBatch.findUnique({
      where: { id: batchId }
    });
    if (!batch) throw new Error("GI088_BASELINE_BATCH_NOT_FOUND");

    const safeBatch = omitHiddenReasoning(batch);
    const snapshot = {
      schemaVersion: "1.0",
      capturedAt: new Date().toISOString(),
      source: "preview_evaluation_database_readonly",
      hiddenReasoningPersistence: "forbidden",
      databaseIdentity: {
        host: databaseIdentity.hostname,
        database: decodeURIComponent(databaseIdentity.pathname.replace(/^\//u, "")),
        schema: databaseIdentity.searchParams.get("schema")
      },
      summary: summarizeState(batch.state),
      batchStateSha256: sha256(safeBatch),
      batch: safeBatch
    };

    const absoluteOutputPath = path.resolve(outputPath);
    const temporaryPath = `${absoluteOutputPath}.tmp`;
    await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
      mode: 0o600
    });
    await rename(temporaryPath, absoluteOutputPath);
    console.log(
      JSON.stringify({
        outputPath: absoluteOutputPath,
        batchId,
        summary: snapshot.summary,
        batchStateSha256: snapshot.batchStateSha256
      })
    );
  } finally {
    await client.$disconnect();
  }
}

void main();
