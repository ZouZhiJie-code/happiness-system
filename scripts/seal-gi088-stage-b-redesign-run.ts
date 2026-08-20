import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/gi088-evaluation-client";

import {
  GI088_EVALUATION_VERSION,
  GI088_TASKS,
  createGi088EffectiveCandidateFingerprint,
  createGi088ExecutionFingerprint
} from "../src/server/services/evaluation/gi088/candidate";
import {
  GI088_EVALUATION_SCHEMA,
  validateGi088EvaluationDatabaseUrl
} from "../src/server/services/evaluation/gi088/access";
import { Gi088PrismaFoundationStore } from "../src/server/services/evaluation/gi088/foundation-prisma-store";
import { Gi088EvaluationFoundationService } from "../src/server/services/evaluation/gi088/foundation-service";

const TARGET_RUN_ID = "b816d468-e3c3-4459-a822-04f95b1e78cd";
const STOP_REASON = "evaluation_system_redesign_before_first_call" as const;
const CONFIRMATION = "I_UNDERSTAND_ZERO_CALL_ADMINISTRATIVE_STOP";
const DIRECT_RUN_MARKER = "--gi088-stage-b-redesign-stop";

type TargetCounts = {
  calls: number;
  operations: number;
  programInterventions: number;
  reviewRevisions: number;
  operationEvents: number;
  exportSnapshots: number;
};

export function isGi088StageBRedesignStopDirectRun(
  argv: readonly string[] = process.argv,
  moduleUrl: string = import.meta.url
) {
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

export function resolveGi088StageBDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    throw new Error("GI088_STAGE_B_PRODUCTION_FORBIDDEN");
  }
  if (env.VERCEL_ENV !== "preview") {
    throw new Error("GI088_STAGE_B_PREVIEW_ONLY");
  }
  const normalized = (value: string | undefined) => {
    const trimmed = value?.trim() ?? "";
    return trimmed === '\"\"' || trimmed === "''" ? "" : trimmed;
  };
  const raw =
    normalized(env.EVALUATION_DATABASE_URL) ||
    normalized(env.EVALUATION_DATABASE_URL_UNPOOLED) ||
    normalized(env.EVALUATION_POSTGRES_PRISMA_URL) ||
    normalized(env.EVALUATION_POSTGRES_URL_NON_POOLING) ||
    normalized(env.EVALUATION_POSTGRES_URL);
  const schema = env.GI088_EVALUATION_DATABASE_SCHEMA?.trim();
  if (!raw || !schema) {
    throw new Error("GI088_STAGE_B_DATABASE_CONFIG_MISSING");
  }
  if (schema !== GI088_EVALUATION_SCHEMA) {
    throw new Error("GI088_STAGE_B_DATABASE_SCHEMA_MISMATCH");
  }
  const url = new URL(raw);
  const configuredSchema = url.searchParams.get("schema");
  if (configuredSchema && configuredSchema !== schema) {
    throw new Error("GI088_STAGE_B_DATABASE_SCHEMA_MISMATCH");
  }
  url.searchParams.set("schema", schema);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "1");
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "30");
  }
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "30");
  }
  const evaluationDatabaseUrl = url.toString();
  validateGi088EvaluationDatabaseUrl({
    ...env,
    EVALUATION_DATABASE_URL: evaluationDatabaseUrl
  });
  return evaluationDatabaseUrl;
}

async function targetCounts(client: PrismaClient): Promise<TargetCounts> {
  const calls = await client.gi088EvaluationCallLedger.count({
    where: { runId: TARGET_RUN_ID }
  });
  const operations = await client.gi088EvaluationOperation.count({
    where: { runId: TARGET_RUN_ID }
  });
  const programInterventions = await client.gi088ProgramIntervention.count({
    where: { runId: TARGET_RUN_ID }
  });
  const reviewRevisions = await client.gi088EvaluationReviewRevision.count({
    where: { runId: TARGET_RUN_ID }
  });
  const operationEvents = await client.gi088EvaluationOperationEvent.count({
    where: { runId: TARGET_RUN_ID }
  });
  const exportSnapshots = await client.gi088EvaluationExportSnapshot.count({
    where: { runId: TARGET_RUN_ID }
  });
  return {
    calls,
    operations,
    programInterventions,
    reviewRevisions,
    operationEvents,
    exportSnapshots
  };
}

function assertZeroEvidenceBaseline(input: {
  session: Awaited<ReturnType<Gi088EvaluationFoundationService["getSession"]>>;
  counts: TargetCounts;
}) {
  if (
    input.session.batch.status !== "running" ||
    input.session.batch.completedTaskCount !== 0 ||
    input.session.batch.totalTasks !== GI088_TASKS.length ||
    input.session.batch.gate?.status !== "pending" ||
    input.session.activeTask !== null ||
    input.session.tasks.some((task) => task.status === "completed") ||
    input.counts.calls !== 0 ||
    input.counts.programInterventions !== 0 ||
    input.counts.reviewRevisions !== 0
  ) {
    throw new Error("GI088_STAGE_B_ZERO_EVIDENCE_BASELINE_MISMATCH");
  }
}

function assertHistoricalTerminalZeroEvidence(input: {
  session: Awaited<ReturnType<Gi088EvaluationFoundationService["getSession"]>>;
  counts: TargetCounts;
}) {
  if (
    input.session.batch.status !== "early_stopped" ||
    input.session.batch.completedTaskCount !== 0 ||
    input.session.batch.totalTasks !== GI088_TASKS.length ||
    input.session.batch.gate?.status !== "pending" ||
    input.session.activeTask !== null ||
    input.session.tasks.some((task) => task.status !== "not_run") ||
    input.counts.calls !== 0 ||
    input.counts.programInterventions !== 0 ||
    input.counts.reviewRevisions !== 0
  ) {
    throw new Error("GI088_STAGE_B_HISTORICAL_TERMINAL_MISMATCH");
  }
}

function assertNoTargetRecordDeletion(
  before: TargetCounts,
  after: TargetCounts
) {
  for (const key of Object.keys(before) as Array<keyof TargetCounts>) {
    if (after[key] < before[key]) {
      throw new Error(`GI088_STAGE_B_TARGET_RECORD_DELETION_DETECTED:${key}`);
    }
  }
}

async function main() {
  if (process.env.GI088_STAGE_B_RUN_DISPOSITION_CONFIRMATION !== CONFIRMATION) {
    throw new Error("GI088_STAGE_B_CONFIRMATION_REQUIRED");
  }
  if (
    process.env.GI088_STAGE_B_TARGET_RUN_ID?.trim() !== TARGET_RUN_ID
  ) {
    throw new Error("GI088_STAGE_B_TARGET_RUN_MISMATCH");
  }
  const expectedExecutionFingerprint = createGi088ExecutionFingerprint();
  const expectedCandidateFingerprint =
    createGi088EffectiveCandidateFingerprint();
  if (
    process.env.GI088_AUTHORIZED_EXECUTION_FINGERPRINT?.trim() !==
    expectedExecutionFingerprint
  ) {
    throw new Error("GI088_STAGE_B_EXECUTION_FINGERPRINT_MISMATCH");
  }

  const client = new PrismaClient({
    datasources: {
      db: { url: resolveGi088StageBDatabaseUrl() }
    }
  });
  try {
    const before = await client.gi088EvaluationBatch.findUnique({
      where: { id: TARGET_RUN_ID }
    });
    if (!before) throw new Error("GI088_STAGE_B_TARGET_RUN_NOT_FOUND");
    if (
      before.evaluationVersion !== GI088_EVALUATION_VERSION ||
      before.executionFingerprint !== expectedExecutionFingerprint ||
      before.candidateFingerprint !== expectedCandidateFingerprint
    ) {
      throw new Error("GI088_STAGE_B_RUN_IDENTITY_MISMATCH");
    }

    const store = new Gi088PrismaFoundationStore(client);
    const service = new Gi088EvaluationFoundationService({
      store,
      getProvider: async () => {
        throw new Error("GI088_STAGE_B_MODEL_CALL_FORBIDDEN");
      },
      authorizeModelCall: () => {
        throw new Error("GI088_STAGE_B_MODEL_CALL_FORBIDDEN");
      }
    });
    const countsBefore = await targetCounts(client);
    const sessionBefore = await service.getSession({
      ownerUserId: before.ownerUserId,
      runId: TARGET_RUN_ID
    });

    let disposition:
      | "applied"
      | "already_applied"
      | "historical_terminal_preserved";
    if (before.status === "running") {
      assertZeroEvidenceBaseline({ session: sessionBefore, counts: countsBefore });
      await service.earlyStop({
        ownerUserId: before.ownerUserId,
        runId: TARGET_RUN_ID,
        reasonCode: STOP_REASON,
        reason: STOP_REASON,
        confirmation: true,
        clientOperationId:
          "gi088-stage-b-evaluation-system-redesign-before-first-call-v1"
      });
      disposition = "applied";
    } else {
      assertHistoricalTerminalZeroEvidence({
        session: sessionBefore,
        counts: countsBefore
      });
      if (
        sessionBefore.batch.earlyStop?.reasonCode === STOP_REASON &&
        sessionBefore.batch.earlyStop.reason === STOP_REASON
      ) {
        disposition = "already_applied";
      } else {
        disposition = "historical_terminal_preserved";
      }
    }

    const after = await client.gi088EvaluationBatch.findUnique({
      where: { id: TARGET_RUN_ID }
    });
    if (!after) throw new Error("GI088_STAGE_B_TARGET_RUN_LOST");
    const countsAfter = await targetCounts(client);
    const sessionAfter = await service.getSession({
      ownerUserId: after.ownerUserId,
      runId: TARGET_RUN_ID
    });

    assertNoTargetRecordDeletion(countsBefore, countsAfter);
    const earlyStopAfter = sessionAfter.batch.earlyStop;
    const exactRedesignReasonApplied =
      earlyStopAfter?.reasonCode === STOP_REASON &&
      earlyStopAfter.reason === STOP_REASON;
    if (
      after.status !== "early_stopped" ||
      !after.sealedAt ||
      !earlyStopAfter ||
      after.candidateFingerprint !== before.candidateFingerprint ||
      after.executionFingerprint !== before.executionFingerprint ||
      sessionAfter.batch.completedTaskCount !== 0 ||
      sessionAfter.batch.totalTasks !== GI088_TASKS.length ||
      earlyStopAfter.completedTaskIds.length !== 0 ||
      sessionAfter.tasks.some((task) => task.status !== "not_run") ||
      countsAfter.calls !== 0 ||
      countsAfter.programInterventions !== 0 ||
      countsAfter.reviewRevisions !== 0
    ) {
      throw new Error("GI088_STAGE_B_STOP_READBACK_MISMATCH");
    }
    if (
      disposition !== "historical_terminal_preserved" &&
      !exactRedesignReasonApplied
    ) {
      throw new Error("GI088_STAGE_B_REDESIGN_REASON_READBACK_MISMATCH");
    }
    if (
      disposition === "historical_terminal_preserved" &&
      (after.revision !== before.revision ||
        after.sealedAt?.getTime() !== before.sealedAt?.getTime() ||
        earlyStopAfter.reasonCode !==
          sessionBefore.batch.earlyStop?.reasonCode ||
        earlyStopAfter.reason !==
          sessionBefore.batch.earlyStop?.reason ||
        Object.keys(countsBefore).some(
          (key) =>
            countsAfter[key as keyof TargetCounts] !==
            countsBefore[key as keyof TargetCounts]
        ))
    ) {
      throw new Error("GI088_STAGE_B_HISTORICAL_TERMINAL_WAS_MUTATED");
    }
    if (
      disposition === "applied" &&
      countsAfter.operations !== countsBefore.operations + 1
    ) {
      throw new Error("GI088_STAGE_B_AUDIT_OPERATION_MISMATCH");
    }

    console.log(JSON.stringify({
      result: "GI088_STAGE_B_RUN_DISPOSITION_PASS",
      disposition,
      runId: TARGET_RUN_ID,
      evaluationVersion: after.evaluationVersion,
      runOrdinal: after.runOrdinal,
      revisionBefore: before.revision,
      revisionAfter: after.revision,
      statusBefore: before.status,
      statusAfter: after.status,
      gateStatusBefore: before.gateStatus,
      gateStatusAfter: after.gateStatus,
      completedTasksBefore: sessionBefore.batch.completedTaskCount,
      completedTasksAfter: sessionAfter.batch.completedTaskCount,
      totalTasks: sessionAfter.batch.totalTasks,
      plannedReasonCode: STOP_REASON,
      plannedReasonApplied: exactRedesignReasonApplied,
      actualReasonCode: earlyStopAfter.reasonCode,
      actualReason: earlyStopAfter.reason,
      candidateFingerprintPreserved:
        after.candidateFingerprint === before.candidateFingerprint,
      executionFingerprintPreserved:
        after.executionFingerprint === before.executionFingerprint,
      modelGenerationCallsBefore: countsBefore.calls,
      modelGenerationCallsAfter: countsAfter.calls,
      humanReviewRevisionsBefore: countsBefore.reviewRevisions,
      humanReviewRevisionsAfter: countsAfter.reviewRevisions,
      programInterventionsBefore: countsBefore.programInterventions,
      programInterventionsAfter: countsAfter.programInterventions,
      databaseWritesByThisExecution: disposition === "applied" ? 1 : 0,
      targetRecordDeletionDetected: false,
      modelProviderLoaded: false,
      productionChanged: false
    }, null, 2));
  } finally {
    await client.$disconnect();
  }
}

if (isGi088StageBRedesignStopDirectRun()) {
  void main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "GI088_STAGE_B_RUN_DISPOSITION_FAILED"
    );
    process.exitCode = 1;
  });
}
