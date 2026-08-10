import { inspectBoard7bThinkingCapabilityV1 } from "./run-board7b-thinking-capability-v1";

const inspected = await inspectBoard7bThinkingCapabilityV1();
process.stdout.write(
  `${JSON.stringify(
    {
      candidateVersion: inspected.manifest.candidateVersion,
      candidateFingerprint: inspected.candidateFingerprint,
      sourceCandidateFingerprint: inspected.sourceCandidateFingerprint,
      datasetFingerprint: inspected.datasetFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
      executionFingerprint: inspected.executionFingerprint,
      plannedCalls: inspected.preparedCalls.length,
      authorizedCalls: inspected.template.authorizedModelCallBudget,
      modelCalls: inspected.manifest.probe.modelCalls,
      reviewMode: inspected.plan.reviewMode,
      production: inspected.manifest.production
    },
    null,
    2
  )}\n`
);
