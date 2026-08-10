import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/gi088-evaluation-client";

import {
  GI088_EVALUATION_VERSION_V8R1,
  createGi088ExecutionFingerprint
} from "../src/server/services/evaluation/gi088/candidate";
import { Gi088PrismaFoundationStore } from "../src/server/services/evaluation/gi088/foundation-prisma-store";
import { Gi088EvaluationFoundationService } from "../src/server/services/evaluation/gi088/foundation-service";
import {
  GI088_EVALUATION_SCHEMA,
  validateGi088EvaluationDatabaseUrl
} from "../src/server/services/evaluation/gi088/access";

const SOURCE_EVALUATION_VERSION = GI088_EVALUATION_VERSION_V8R1;
const CONFIRMATION = "I_UNDERSTAND_ZERO_MODEL_CALLS";

export function resolveGi088InitializeDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    throw new Error("GI088_INITIALIZE_PRODUCTION_FORBIDDEN");
  }
  if (env.VERCEL_ENV !== "preview") {
    throw new Error("GI088_INITIALIZE_PREVIEW_ONLY");
  }
  const raw =
    env.EVALUATION_DATABASE_URL?.trim() ||
    env.EVALUATION_DATABASE_URL_UNPOOLED?.trim();
  const schema = env.GI088_EVALUATION_DATABASE_SCHEMA?.trim();
  if (!raw || !schema) throw new Error("GI088_INITIALIZE_DATABASE_CONFIG_MISSING");
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("GI088_INITIALIZE_APP_DATABASE_CONFIG_MISSING");
  }
  if (schema !== GI088_EVALUATION_SCHEMA) {
    throw new Error("GI088_INITIALIZE_DATABASE_SCHEMA_MISMATCH");
  }
  const url = new URL(raw);
  const configuredSchema = url.searchParams.get("schema");
  if (configuredSchema && configuredSchema !== schema) {
    throw new Error("GI088_INITIALIZE_DATABASE_SCHEMA_MISMATCH");
  }
  url.searchParams.set("schema", schema);
  const evaluationDatabaseUrl = url.toString();
  validateGi088EvaluationDatabaseUrl({
    ...env,
    EVALUATION_DATABASE_URL: evaluationDatabaseUrl
  });
  return evaluationDatabaseUrl;
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

  const evaluationDatabaseUrl = resolveGi088InitializeDatabaseUrl();
  const client = new PrismaClient({
    datasources: { db: { url: evaluationDatabaseUrl } }
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

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1]!)).href;

if (isDirectRun) {
  void main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "GI088_INITIALIZE_FAILED"
    );
    process.exitCode = 1;
  });
}
