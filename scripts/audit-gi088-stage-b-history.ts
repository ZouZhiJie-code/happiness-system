import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/gi088-evaluation-client";

import { GI088_EVALUATION_VERSION } from "../src/server/services/evaluation/gi088/candidate";
import { Gi088PrismaFoundationStore } from "../src/server/services/evaluation/gi088/foundation-prisma-store";
import { Gi088EvaluationFoundationService } from "../src/server/services/evaluation/gi088/foundation-service";
import { resolveGi088StageBDatabaseUrl } from "./seal-gi088-stage-b-redesign-run";

type PersistedBatchState = {
  earlyStop?: {
    reasonCode?: string;
    reason?: string;
  } | null;
};

function isDirectRun(
  argv: readonly string[] = process.argv,
  moduleUrl: string = import.meta.url
) {
  return argv.slice(1).some((argument) => {
    if (!argument || argument.startsWith("-")) return false;
    try {
      return pathToFileURL(resolve(argument)).href === moduleUrl;
    } catch {
      return false;
    }
  });
}

async function main() {
  const client = new PrismaClient({
    datasources: { db: { url: resolveGi088StageBDatabaseUrl() } }
  });
  try {
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
    const batches = await client.gi088EvaluationBatch.findMany({
      where: { evaluationVersion: GI088_EVALUATION_VERSION },
      orderBy: { runOrdinal: "asc" }
    });
    const runs = [];
    for (const batch of batches) {
      const calls = await client.gi088EvaluationCallLedger.count({
        where: { runId: batch.id }
      });
      const reviews = await client.gi088EvaluationReviewRevision.count({
        where: { runId: batch.id }
      });
      const interventions = await client.gi088ProgramIntervention.count({
        where: { runId: batch.id }
      });
      const operations = await client.gi088EvaluationOperation.count({
        where: { runId: batch.id }
      });
      const state = batch.state as PersistedBatchState;
      const session = await service.getSession({
        ownerUserId: batch.ownerUserId,
        runId: batch.id
      });
      runs.push({
        runId: batch.id,
        runOrdinal: batch.runOrdinal,
        revision: batch.revision,
        status: batch.status,
        gateStatus: batch.gateStatus,
        sealedAt: batch.sealedAt?.toISOString() ?? null,
        candidateFingerprint: batch.candidateFingerprint,
        executionFingerprint: batch.executionFingerprint,
        completedTaskCount: session.batch.completedTaskCount,
        totalTaskCount: session.batch.totalTasks,
        providerCallCount: calls,
        humanReviewRevisionCount: reviews,
        programInterventionCount: interventions,
        operationCount: operations,
        reasonCode: state.earlyStop?.reasonCode ?? null,
        reason: state.earlyStop?.reason ?? null
      });
    }
    console.log(
      JSON.stringify(
        {
          result: "GI088_STAGE_B_HISTORY_AUDIT_PASS",
          capturedAt: new Date().toISOString(),
          evaluationVersion: GI088_EVALUATION_VERSION,
          runCount: runs.length,
          databaseWritesByThisExecution: 0,
          runs
        },
        null,
        2
      )
    );
  } finally {
    await client.$disconnect();
  }
}

if (isDirectRun()) {
  void main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "GI088_STAGE_B_HISTORY_AUDIT_FAILED"
    );
    process.exitCode = 1;
  });
}
