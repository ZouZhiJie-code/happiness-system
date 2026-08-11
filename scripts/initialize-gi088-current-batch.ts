import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/gi088-evaluation-client";

import {
  GI088_ARK_FLASH_RUNTIME_POLICY,
  GI088_CONFIGS,
  GI088_EVALUATION_VERSION,
  GI088_EVALUATION_VERSION_V8R2,
  GI088_MODEL_CALL_IDENTITY,
  GI088_TASKS,
  createGi088FingerprintBundle
} from "../src/server/services/evaluation/gi088/candidate";
import { Gi088PrismaFoundationStore } from "../src/server/services/evaluation/gi088/foundation-prisma-store";
import { Gi088EvaluationFoundationService } from "../src/server/services/evaluation/gi088/foundation-service";
import {
  GI088_EVALUATION_SCHEMA,
  resolveGi088V8r3OfflineEvaluationEvidence,
  validateGi088EvaluationDatabaseUrl
} from "../src/server/services/evaluation/gi088/access";
import type {
  Gi088PublicSession,
  Gi088V8r3OfflineEvaluationEvidence
} from "../src/server/services/evaluation/gi088/types";
import {
  GI088_V8R3_INTERVIEW_SKILL_SHA256,
  GI088_V8R3_INTERVIEW_SKILL_VERSION
} from "../src/server/services/evaluation/gi088/v8r3-interview-skill";

const SOURCE_EVALUATION_VERSION = GI088_EVALUATION_VERSION_V8R2;
const CONFIRMATION = "I_UNDERSTAND_ZERO_MODEL_CALLS";
const DIRECT_RUN_MARKER = "--gi088-initialize-direct-run";
const INITIALIZE_OPERATION_PREFIX =
  "gi088-v8r3-zero-model-initialize" as const;

export function createGi088InitializeClientOperationId(
  executionFingerprint: string
) {
  if (!/^[a-f0-9]{64}$/u.test(executionFingerprint)) {
    throw new Error("GI088_INITIALIZE_EXECUTION_FINGERPRINT_INVALID");
  }
  const clientOperationId =
    `${INITIALIZE_OPERATION_PREFIX}-${executionFingerprint}`;
  if (clientOperationId.length > 160) {
    throw new Error("GI088_INITIALIZE_OPERATION_ID_TOO_LONG");
  }
  return clientOperationId;
}

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
  if (
    env.VERCEL_ENV === "production" ||
    (!env.VERCEL_ENV && env.NODE_ENV === "production")
  ) {
    throw new Error("GI088_INITIALIZE_PRODUCTION_FORBIDDEN");
  }
  if (env.VERCEL_ENV !== "preview") {
    throw new Error("GI088_INITIALIZE_PREVIEW_ONLY");
  }
  const raw = env.EVALUATION_DATABASE_URL_UNPOOLED?.trim();
  const schema = env.GI088_EVALUATION_DATABASE_SCHEMA?.trim();
  if (!raw || !schema) throw new Error("GI088_INITIALIZE_DATABASE_CONFIG_MISSING");
  if (!env.DATABASE_URL?.trim() || !env.DIRECT_URL?.trim()) {
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
  validateGi088EvaluationDatabaseUrl(env);
  return evaluationDatabaseUrl;
}

export function assertGi088ZeroModelInitializeReadback(input: {
  session: Gi088PublicSession;
  callCount: number;
  expectedRunId: string;
  expectedExecutionFingerprint: string;
  expectedCandidateFingerprint: string;
  expectedOfflineEvaluationEvidence: Gi088V8r3OfflineEvaluationEvidence;
}) {
  const { session } = input;
  const config = session.evaluation.config;
  const frozenBundle = createGi088FingerprintBundle();
  const scoredTasks = session.tasks.filter(
    (task) => task.evaluationRole === "scored_trajectory"
  );
  const compatibilitySmokes = session.tasks.filter(
    (task) => task.evaluationRole === "compatibility_smoke"
  );
  if (
    session.evaluation.version !== GI088_EVALUATION_VERSION ||
    session.evaluation.executionFingerprint !==
      input.expectedExecutionFingerprint ||
    input.expectedExecutionFingerprint !== frozenBundle.executionFingerprint ||
    session.evaluation.candidateFingerprint !==
      input.expectedCandidateFingerprint ||
    input.expectedCandidateFingerprint !== frozenBundle.candidateFingerprint ||
    session.evaluation.skillVersion !==
      GI088_V8R3_INTERVIEW_SKILL_VERSION ||
    session.evaluation.skillSha256 !== GI088_V8R3_INTERVIEW_SKILL_SHA256 ||
    session.evaluation.behaviorManifestVersion !==
      frozenBundle.behaviorManifestVersion ||
    session.evaluation.behaviorManifestSha256 !==
      frozenBundle.behaviorManifestSha256 ||
    session.evaluation.datasetFingerprint !==
      frozenBundle.datasetFingerprint ||
    session.evaluation.runnerFingerprint !== frozenBundle.runnerFingerprint ||
    session.evaluation.experienceFingerprint !==
      frozenBundle.experienceFingerprint ||
    session.evaluation.mode !== "high_only" ||
    session.evaluation.activeBranches.length !== 1 ||
    session.evaluation.activeBranches[0] !== "high" ||
    session.evaluation.model !== GI088_CONFIGS.high.model ||
    session.evaluation.modelIdentity?.provider !==
      GI088_MODEL_CALL_IDENTITY.provider ||
    session.evaluation.modelIdentity.transport !==
      GI088_ARK_FLASH_RUNTIME_POLICY.transport ||
    session.evaluation.modelIdentity.baseUrlHost !==
      GI088_MODEL_CALL_IDENTITY.baseUrlHost ||
    session.evaluation.modelIdentity.endpoint !==
      GI088_MODEL_CALL_IDENTITY.endpoint ||
    session.evaluation.modelIdentity.model !==
      GI088_MODEL_CALL_IDENTITY.model ||
    session.evaluation.modelIdentity.payloadContractVersion !==
      GI088_MODEL_CALL_IDENTITY.payloadContractVersion ||
    config?.thinking !== "enabled" ||
    config.reasoningEffort !== "high" ||
    config.responseFormat !== "json_object" ||
    config.maxTokensPolicy !== "provider_default" ||
    config.headersTimeoutMs !== 60_000 ||
    config.bodyIdleTimeoutMs !== 60_000 ||
    config.hardTimeoutMs !== 60_000 ||
    config.automaticChainDeadlineMs !== 90_000 ||
    config.hiddenReasoningPersistence !== "forbidden" ||
    session.batch.runId !== input.expectedRunId ||
    session.batch.completedTaskCount !== 0 ||
    session.batch.totalTasks !== 6 ||
    session.batch.status !== "running" ||
    session.batch.gate?.status !== "pending" ||
    JSON.stringify(session.batch.offlineEvaluationEvidence) !==
      JSON.stringify(input.expectedOfflineEvaluationEvidence) ||
    session.batch.recoveryBudget?.offlineAutomaticRecoveryCount !==
      input.expectedOfflineEvaluationEvidence.automaticRecoveryCount ||
    session.batch.recoveryBudget?.previewAutomaticRecoveryCount !== 0 ||
    session.batch.recoveryBudget?.combinedAutomaticRecoveryCount !==
      input.expectedOfflineEvaluationEvidence.automaticRecoveryCount ||
    session.batch.recoveryBudget?.maximumAutomaticRecoveryCount !== 2 ||
    session.batch.readOnly !== false ||
    GI088_TASKS.length !== 6 ||
    session.tasks.length !== 6 ||
    scoredTasks.length !== 4 ||
    compatibilitySmokes.length !== 2 ||
    session.batch.targetCoverage.totalTrajectoryCount !== 4 ||
    session.tasks[0]?.status !== "ready" ||
    session.tasks.slice(1).some((task) => task.status !== "locked") ||
    session.tasks.some((task) => task.compatibilitySmoke !== null) ||
    session.activeTask !== null ||
    input.callCount !== 0
  ) {
    throw new Error("GI088_INITIALIZE_ZERO_MODEL_READBACK_MISMATCH");
  }
}

async function main() {
  if (
    process.env.VERCEL_ENV === "production" ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production")
  ) {
    throw new Error("GI088_INITIALIZE_PRODUCTION_FORBIDDEN");
  }
  if (process.env.GI088_INITIALIZE_CONFIRMATION !== CONFIRMATION) {
    throw new Error("GI088_INITIALIZE_CONFIRMATION_REQUIRED");
  }
  const frozenBundle = createGi088FingerprintBundle();
  const offlineEvaluationEvidence =
    resolveGi088V8r3OfflineEvaluationEvidence(process.env);
  const executionFingerprint = frozenBundle.executionFingerprint;
  const candidateFingerprint = frozenBundle.candidateFingerprint;
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
      },
      offlineEvaluationEvidence
    });
    const created = await service.createRun({
      ownerUserId: ownerUserIds[0],
      clientOperationId:
        createGi088InitializeClientOperationId(executionFingerprint)
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
      expectedCandidateFingerprint: candidateFingerprint,
      expectedOfflineEvaluationEvidence: offlineEvaluationEvidence
    });
    console.log(
      JSON.stringify(
        {
          evaluationVersion: session.evaluation.version,
          evaluationMode: session.evaluation.mode,
          activeBranches: session.evaluation.activeBranches,
          skillVersion: session.evaluation.skillVersion,
          skillSha256: session.evaluation.skillSha256,
          behaviorManifestVersion:
            session.evaluation.behaviorManifestVersion,
          behaviorManifestSha256:
            session.evaluation.behaviorManifestSha256,
          candidateFingerprint: session.evaluation.candidateFingerprint,
          datasetFingerprint: session.evaluation.datasetFingerprint,
          runnerFingerprint: session.evaluation.runnerFingerprint,
          experienceFingerprint: session.evaluation.experienceFingerprint,
          executionFingerprint: session.evaluation.executionFingerprint,
          offlineEvaluationEvidence: session.batch.offlineEvaluationEvidence,
          recoveryBudget: session.batch.recoveryBudget,
          modelIdentity: session.evaluation.modelIdentity,
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
