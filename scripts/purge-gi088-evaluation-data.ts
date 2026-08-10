import { PrismaClient } from "@prisma/gi088-evaluation-client";

import { validateGi088EvaluationDatabaseUrl } from "../src/server/services/evaluation/gi088/access";
import {
  createGi088RetentionSelection,
  GI088_RAW_DATA_RETENTION_DAYS,
  summarizeGi088RetentionBatch,
  summarizeGi088RetentionSmoke
} from "../src/server/services/evaluation/gi088/retention";

const CONFIRMATION = "DELETE_GI088_RAW_DATA_AFTER_RETENTION";

function argument(name: string) {
  const direct = process.argv.find((item) => item.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredDate(value: string | undefined) {
  const parsed = value ? new Date(value) : new Date(Number.NaN);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("GI088_BOARD6_CLOSED_AT_REQUIRED");
  }
  return parsed;
}

async function main() {
  validateGi088EvaluationDatabaseUrl();
  const board6ClosedAt = requiredDate(argument("--board6-closed-at"));
  const eligibleAfter = new Date(
    board6ClosedAt.getTime() + GI088_RAW_DATA_RETENTION_DAYS * 24 * 60 * 60 * 1_000
  );
  if (Date.now() < eligibleAfter.getTime()) {
    throw new Error("GI088_RETENTION_WINDOW_NOT_ELAPSED");
  }
  const execute = process.argv.includes("--execute");
  if (execute && argument("--confirm") !== CONFIRMATION) {
    throw new Error("GI088_PURGE_CONFIRMATION_REQUIRED");
  }
  const client = new PrismaClient({
    datasources: { db: { url: process.env.EVALUATION_DATABASE_URL } }
  });
  try {
    const retentionSelection = createGi088RetentionSelection();
    const [batches, smokes] = await Promise.all([
      client.gi088EvaluationBatch.findMany({
        where: retentionSelection.batchWhere,
        select: {
          id: true,
          evaluationVersion: true,
          candidateFingerprint: true,
          executionFingerprint: true,
          status: true,
          sealedAt: true,
          state: true
        }
      }),
      client.gi088TechnicalSmoke.findMany({
        where: retentionSelection.smokeWhere,
        select: {
          id: true,
          executionFingerprint: true,
          arm: true,
          authorizationId: true,
          status: true,
          createdAt: true,
          completedAt: true
        }
      })
    ]);
    const batchSummary = batches.map(summarizeGi088RetentionBatch);
    const smokeSummary = smokes.map(summarizeGi088RetentionSmoke);
    if (!execute) {
      console.log(
        JSON.stringify(
          {
            mode: "dry_run",
            board6ClosedAt: board6ClosedAt.toISOString(),
            eligibleAfter: eligibleAfter.toISOString(),
            eligibleBatchCount: batchSummary.length,
            eligibleSmokeCount: smokeSummary.length,
            batches: batchSummary,
            smokes: smokeSummary
          },
          null,
          2
        )
      );
      return;
    }
    await client.$transaction(async (transaction) => {
      for (const batch of batches) {
        const recordSummary = summarizeGi088RetentionBatch(batch);
        await transaction.gi088RetentionAudit.create({
          data: {
            batchId: batch.id,
            action: "raw_evaluation_batch_deleted",
            board6ClosedAt,
            eligibleAfter,
            executionFingerprint: batch.executionFingerprint,
            recordSummary
          }
        });
        await transaction.gi088EvaluationBatch.delete({
          where: { id: batch.id }
        });
      }
      for (const smoke of smokes) {
        const recordSummary = summarizeGi088RetentionSmoke(smoke);
        await transaction.gi088RetentionAudit.create({
          data: {
            batchId: `smoke:${smoke.id}`,
            action: "technical_smoke_raw_output_deleted",
            board6ClosedAt,
            eligibleAfter,
            executionFingerprint: smoke.executionFingerprint,
            recordSummary
          }
        });
        await transaction.gi088TechnicalSmoke.delete({ where: { id: smoke.id } });
      }
    });
    console.log(
      JSON.stringify(
        {
          mode: "executed",
          deletedBatchCount: batches.length,
          deletedSmokeCount: smokes.length
        },
        null,
        2
      )
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "GI088_PURGE_FAILED");
  process.exitCode = 1;
});
