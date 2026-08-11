import {
  GI088_CONFIGS,
  GI088_ACTIVE_BRANCHES,
  GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY,
  GI088_ARK_FLASH_RUNTIME_POLICY,
  GI088_EMPTY_CONTENT_RECOVERY_POLICY,
  GI088_EVALUATION_VERSION,
  GI088_EVALUATION_VERSION_V7R3,
  GI088_GI087_CANDIDATE_FINGERPRINT,
  GI088_MAXIMUM_PROVIDER_CALLS_PER_TRAJECTORY,
  GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION,
  GI088_MODEL_CALL_IDENTITY,
  GI088_SERVICE_VERSION,
  GI088_SHARED_RECOVERY_DEADLINE_POLICY,
  GI088_TASKS,
  GI088_TIMEOUT_POLICY,
  GI088_TIMEOUT_RECOVERY_POLICY,
  createGi088EffectiveCandidateFingerprint,
  createGi088DatasetFingerprint,
  createGi088ExecutionFingerprint,
  createGi088FingerprintBundle,
  createGi088V7r3ExecutionFingerprint,
  verifyGi088CandidateSnapshot
} from "../src/server/services/evaluation/gi088/candidate";
import { GI088_SINGLE_FOCUS_POLICY_VERSION } from "../src/server/services/evaluation/gi088/single-focus";
import { GI088_SEMANTIC_DELTA_CONTRACT_VERSION } from "../src/server/services/evaluation/gi088/semantic-delta";
import { GI088_DETERMINISTIC_STATE_POLICY_VERSION } from "../src/server/services/evaluation/gi088/deterministic-state";
import {
  GI088_V8R3_INTERVIEW_SKILL_SHA256,
  GI088_V8R3_INTERVIEW_SKILL_VERSION
} from "../src/server/services/evaluation/gi088/v8r3-interview-skill";

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
      fingerprintBundle: createGi088FingerprintBundle(),
      datasetFingerprint: createGi088DatasetFingerprint(),
      executionFingerprint: createGi088ExecutionFingerprint(),
      taskCount: GI088_TASKS.length,
      branchOrder: GI088_ACTIVE_BRANCHES,
      configs: { high: GI088_CONFIGS.high },
      timeoutPolicy: GI088_TIMEOUT_POLICY,
      runtimePolicy: GI088_ARK_FLASH_RUNTIME_POLICY,
      modelCallIdentity: GI088_MODEL_CALL_IDENTITY,
      recoveryPolicies: {
        emptyContent: GI088_EMPTY_CONTENT_RECOVERY_POLICY,
        timeout: GI088_TIMEOUT_RECOVERY_POLICY,
        stageTransition: GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY,
        sharedDeadline: GI088_SHARED_RECOVERY_DEADLINE_POLICY
      },
      singleFocusPolicyVersion: GI088_SINGLE_FOCUS_POLICY_VERSION,
      semanticDeltaContractVersion: GI088_SEMANTIC_DELTA_CONTRACT_VERSION,
      deterministicStatePolicyVersion:
        GI088_DETERMINISTIC_STATE_POLICY_VERSION,
      interviewSkill: {
        version: GI088_V8R3_INTERVIEW_SKILL_VERSION,
        sha256: GI088_V8R3_INTERVIEW_SKILL_SHA256
      },
      v7r3ExecutionFingerprint: createGi088V7r3ExecutionFingerprint(),
      v7r3DatasetFingerprint: createGi088DatasetFingerprint(
        GI088_EVALUATION_VERSION_V7R3
      ),
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
