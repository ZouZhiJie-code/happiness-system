import { PrismaClient } from "@prisma/gi088-evaluation-client";

import {
  GI088_EVALUATION_VERSION_V8R1,
  createGi088ExecutionFingerprint
} from "../src/server/services/evaluation/gi088/candidate";
import { Gi088PrismaFoundationStore } from "../src/server/services/evaluation/gi088/foundation-prisma-store";
import { Gi088EvaluationFoundationService } from "../src/server/services/evaluation/gi088/foundation-service";

const SOURCE_EVALUATION_VERSION = GI088_EVALUATION_VERSION_V8R1;
const CONFIRMATION = "I_UNDERSTAND_ZERO_MODEL_CALLS";

function prepareEvaluationDatabaseUrl() {
  const raw =
    process.env.EVALUATION_DATABASE_URL?.trim() ||
    process.env.EVALUATION_DATABASE_URL_UNPOOLED?.trim();
  const schema = process.env.GI088_EVALUATION_DATABASE_SCHEMA?.trim();
  if (!raw || !schema) throw new Error("GI088_INITIALIZE_DATABASE_CONFIG_MISSING");
  const url = new URL(raw);
  url.searchParams.set("schema", schema);
  process.env.EVALUATION_DATABASE_URL = url.toString();
}

async function main() {
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("GI088_INITIALIZE_PRODUCTION_FORBIDDEN");
  }
  if (process.env.GI088_INITIALIZE_CONFIRMATION !== CONFIRMATION) {
    throw new Error("GI088_INITIALIZE_CONFIRMATION_REQUIRED");
  }
  const executionFingerprint = createGi088ExecutionFingerprint();
  if (
    process.env.GI088_AUTHORIZED_EXECUTION_FINGERPRINT?.trim() !==
    executionFingerprint
  ) {
    throw new Error("GI088_INITIALIZE_EXECUTION_FINGERPRINT_MISMATCH");
  }

  prepareEvaluationDatabaseUrl();
  const client = new PrismaClient({
    datasources: { db: { url: process.env.EVALUATION_DATABASE_URL } }
  });
  try {
    const sources = await client.gi088EvaluationBatch.findMany({
      where: { evaluationVersion: SOURCE_EVALUATION_VERSION },
      orderBy: { updatedAt: "desc" },
      select: { ownerUserId: true }
    });
    const ownerUserIds = [...new Set(sources.map((item) => item.ownerUserId))];
    if (ownerUserIds.length !== 1) {
      throw new Error("GI088_INITIALIZE_OWNER_SCOPE_AMBIGUOUS");
    }

    const service = new Gi088EvaluationFoundationService({
      store: new Gi088PrismaFoundationStore(client),
      getProvider: async () => {
        throw new Error("GI088_INITIALIZE_MODEL_CALL_FORBIDDEN");
      },
      authorizeModelCall: () => {
        throw new Error("GI088_INITIALIZE_MODEL_CALL_FORBIDDEN");
      }
    });
    const created = await service.createRun({
      ownerUserId: ownerUserIds[0],
      clientOperationId: "gi088-v8r2-zero-model-initialize-20260810"
    });
    const session = await service.getSession({
      ownerUserId: ownerUserIds[0],
      runId: created.runId
    });
    const callCount = await client.gi088EvaluationCallLedger.count({
      where: { runId: created.runId }
    });
    if (
      session.batch.completedTaskCount !== 0 ||
      session.batch.status !== "running" ||
      session.batch.gate?.status !== "pending" ||
      callCount !== 0
    ) {
      throw new Error("GI088_INITIALIZE_ZERO_MODEL_READBACK_MISMATCH");
    }
    console.log(
      JSON.stringify(
        {
          evaluationVersion: session.evaluation.version,
          evaluationMode: session.evaluation.mode,
          activeBranches: session.evaluation.activeBranches,
          executionFingerprint: session.evaluation.executionFingerprint,
          runId: session.batch.runId,
          runOrdinal: session.batch.runOrdinal,
          batchStatus: session.batch.status,
          gateStatus: session.batch.gate?.status,
          completedTaskCount: session.batch.completedTaskCount,
          totalTasks: session.batch.totalTasks,
          modelGenerationCalls: callCount
        },
        null,
        2
      )
    );
  } finally {
    await client.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "GI088_INITIALIZE_FAILED");
  process.exitCode = 1;
});
