import {
  BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
  BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import { inspectBoard7bWorkingTaskV1Regression } from "./run-board7b-working-task-v1-regression";

async function main() {
  const verifyRecordedFingerprints = !process.argv.includes("--unrecorded");
  const inspected = await inspectBoard7bWorkingTaskV1Regression(process.cwd(), {
    verifyRecordedFingerprints
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        candidateVersion: BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
        candidateFingerprint: inspected.candidateFingerprint,
        datasetVersion: inspected.dataset.datasetVersion,
        datasetFingerprint: inspected.dataset.datasetFingerprint,
        sourceLineageFingerprint: inspected.sourceLineageFingerprint,
        requestSetFingerprint: inspected.requestSetFingerprint,
        evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
        executionFingerprint: inspected.executionFingerprint,
        runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
        regressionCases: inspected.cases.map((item) => ({
          callNumber: item.callNumber,
          caseId: item.caseId,
          sourceType: item.sourceType,
          requestHash: item.requestHash
        })),
        sourceDistribution:
          "sourceDistribution" in inspected
            ? inspected.sourceDistribution
            : {
                realHistoryCheckpoints: inspected.cases.filter(
                  (item) => item.sourceType === "real_history_checkpoint"
                ).length,
                syntheticGuardrails: inspected.cases.filter(
                  (item) => item.sourceType === "synthetic_guardrail"
                ).length
              },
        recordedFingerprintsVerified: verifyRecordedFingerprints,
        optionalOriginReadback:
          "optionalOriginReadback" in inspected
            ? inspected.optionalOriginReadback
            : "not_checked_in_unrecorded_mode",
        authorization: "pending",
        authorizedCalls: 0,
        modelCalls: 0,
        manualTechnicalRetryBudget: 2,
        qualityRetries: 0,
        automaticTechnicalRetries: 0,
        production: "legacy + baseline"
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
