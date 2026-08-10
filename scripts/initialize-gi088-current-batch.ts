import { PrismaClient } from "@prisma/gi088-evaluation-client";

import {
  GI088_EVALUATION_MODE,
  GI088_EVALUATION_VERSION_V7,
  createGi088ExecutionFingerprint
} from "../src/server/services/evaluation/gi088/candidate";
import { Gi088PrismaStore } from "../src/server/services/evaluation/gi088/prisma-store";
import { Gi088EvaluationService } from "../src/server/services/evaluation/gi088/service";

const SOURCE_EVALUATION_VERSION = GI088_EVALUATION_VERSION_V7;
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

    const service = new Gi088EvaluationService({
      store: new Gi088PrismaStore(client),
      evaluationMode: GI088_EVALUATION_MODE,
      getProvider: async () => {
        throw new Error("GI088_INITIALIZE_MODEL_CALL_FORBIDDEN");
      },
      authorizeModelCall: () => {
        throw new Error("GI088_INITIALIZE_MODEL_CALL_FORBIDDEN");
      }
    });
    const session = await service.getSession(ownerUserIds[0]);
    console.log(
      JSON.stringify(
        {
          evaluationVersion: session.evaluation.version,
          evaluationMode: session.evaluation.mode,
          activeBranches: session.evaluation.activeBranches,
          executionFingerprint: session.evaluation.executionFingerprint,
          batchId: session.batch.id,
          batchStatus: session.batch.status,
          completedTaskCount: session.batch.completedTaskCount,
          totalTasks: session.batch.totalTasks,
          modelGenerationCalls: 0
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
