import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/gi088-evaluation-client";

import {
  GI088_CONFIGS,
  GI088_EVALUATION_VERSION,
  GI088_EVALUATION_VERSION_V8R1,
  GI088_TASKS,
  createGi088EffectiveCandidateFingerprint,
  createGi088ExecutionFingerprint
} from "../src/server/services/evaluation/gi088/candidate";
import { Gi088PrismaFoundationStore } from "../src/server/services/evaluation/gi088/foundation-prisma-store";
import { Gi088EvaluationFoundationService } from "../src/server/services/evaluation/gi088/foundation-service";
import {
  GI088_EVALUATION_SCHEMA,
  validateGi088EvaluationDatabaseUrl
} from "../src/server/services/evaluation/gi088/access";
import type { Gi088PublicSession } from "../src/server/services/evaluation/gi088/types";

const SOURCE_EVALUATION_VERSION = GI088_EVALUATION_VERSION_V8R1;
const CONFIRMATION = "I_UNDERSTAND_ZERO_MODEL_CALLS";
const DIRECT_RUN_MARKER = "--gi088-initialize-direct-run";
export function isGi088InitializeDirectRun(
  argv: readonly string[] = process.argv,
  moduleUrl: string = import.meta.url
) {
  // vite-node 2.1.5 的普通 runner 会移除入口文件参数，只保留 `--` 后的参数。
  if (argv.includes(DIRECT_RUN_MARKER)) return true;
  return argv.slice(1).some((argument) => {
    if (!argument || argument.startsWith("-")) return false;
    try {
      return pathToFileURL(resolve(argument)).href === moduleUrl;
    } catch {
      return false;
    }
  });
}

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

export function assertGi088ZeroModelInitializeReadback(input: {
  session: Gi088PublicSession;
  callCount: number;
  expectedRunId: string;
  expectedExecutionFingerprint: string;
  expectedCandidateFingerprint: string;
}) {
  const { session } = input;
  const config = session.evaluation.config;
  if (
    session.evaluation.version !== GI088_EVALUATION_VERSION ||
    session.evaluation.executionFingerprint !==
      input.expectedExecutionFingerprint ||
    session.evaluation.candidateFingerprint !==
      input.expectedCandidateFingerprint ||
    session.evaluation.mode !== "high_only" ||
    session.evaluation.activeBranches.length !== 1 ||
    session.evaluation.activeBranches[0] !== "high" ||
    session.evaluation.model !== GI088_CONFIGS.high.model ||
    config?.thinking !== "enabled" ||
    config.reasoningEffort !== "high" ||
    config.responseFormat !== "json_object" ||
    config.maxTokensPolicy !== "provider_default" ||
    session.batch.runId !== input.expectedRunId ||
    session.batch.completedTaskCount !== 0 ||
    session.batch.totalTasks !== GI088_TASKS.length ||
    session.batch.status !== "running" ||
    session.batch.gate?.status !== "pending" ||
    session.batch.readOnly !== false ||
    session.tasks.length !== GI088_TASKS.length ||
    session.activeTask !== null ||
    input.callCount !== 0
  ) {
    throw new Error("GI088_INITIALIZE_ZERO_MODEL_READBACK_MISMATCH");
  }
}

async function main() {
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("GI088_INITIALIZE_PRODUCTION_FORBIDDEN");
  }
  if (process.env.GI088_INITIALIZE_CONFIRMATION !== CONFIRMATION) {
    throw new Error("GI088_INITIALIZE_CONFIRMATION_REQUIRED");
  }
  const executionFingerprint = createGi088ExecutionFingerprint();
  const candidateFingerprint = createGi088EffectiveCandidateFingerprint();
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
    assertGi088ZeroModelInitializeReadback({
      session,
      callCount,
      expectedRunId: created.runId,
      expectedExecutionFingerprint: executionFingerprint,
      expectedCandidateFingerprint: candidateFingerprint
    });
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

if (isGi088InitializeDirectRun()) {
  void main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "GI088_INITIALIZE_FAILED"
    );
    process.exitCode = 1;
  });
}
