import {
  GI088_CONFIGS,
  GI088_ACTIVE_BRANCHES,
  GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY,
  GI088_ARK_FLASH_RUNTIME_POLICY,
  GI088_EMPTY_CONTENT_RECOVERY_POLICY,
  GI088_EVALUATION_VERSION,
  GI088_GI087_CANDIDATE_FINGERPRINT,
  GI088_MAXIMUM_PROVIDER_CALLS_PER_TRAJECTORY,
  GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION,
  GI088_SERVICE_VERSION,
  GI088_TASKS,
  GI088_TIMEOUT_POLICY,
  GI088_TIMEOUT_RECOVERY_POLICY,
  createGi088EffectiveCandidateFingerprint,
  createGi088DatasetFingerprint,
  createGi088ExecutionFingerprint,
  verifyGi088CandidateSnapshot
} from "../src/server/services/evaluation/gi088/candidate";
import { GI088_SINGLE_FOCUS_POLICY_VERSION } from "../src/server/services/evaluation/gi088/single-focus";
import { GI088_SEMANTIC_DELTA_CONTRACT_VERSION } from "../src/server/services/evaluation/gi088/semantic-delta";

const snapshot = verifyGi088CandidateSnapshot();

console.log(
  JSON.stringify(
    {
      evaluationVersion: GI088_EVALUATION_VERSION,
      serviceVersion: GI088_SERVICE_VERSION,
      effectiveCandidateFingerprint: createGi088EffectiveCandidateFingerprint(),
      baseGi087CandidateFingerprint: GI088_GI087_CANDIDATE_FINGERPRINT,
      verifiedEffectiveCandidateFingerprint:
        snapshot.effectiveCandidateFingerprint,
      datasetFingerprint: createGi088DatasetFingerprint(),
      executionFingerprint: createGi088ExecutionFingerprint(),
      taskCount: GI088_TASKS.length,
      branchOrder: GI088_ACTIVE_BRANCHES,
      configs: { high: GI088_CONFIGS.high },
      timeoutPolicy: GI088_TIMEOUT_POLICY,
      runtimePolicy: GI088_ARK_FLASH_RUNTIME_POLICY,
      recoveryPolicies: {
        emptyContent: GI088_EMPTY_CONTENT_RECOVERY_POLICY,
        timeout: GI088_TIMEOUT_RECOVERY_POLICY,
        stageTransition: GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY
      },
      singleFocusPolicyVersion: GI088_SINGLE_FOCUS_POLICY_VERSION,
      semanticDeltaContractVersion: GI088_SEMANTIC_DELTA_CONTRACT_VERSION,
      maximumProviderCallsPerTrajectory:
        GI088_MAXIMUM_PROVIDER_CALLS_PER_TRAJECTORY,
      maximumProviderCallsPerUserSubmission:
        GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION,
      exactWorstCaseBatchCalls: "unbounded_by_trajectory",
      modelGenerationCalls: 0
    },
    null,
    2
  )
);
