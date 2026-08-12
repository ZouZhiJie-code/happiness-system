export const GI088_EVALUATION_ID_V8R1 =
  "gi088_human_eval_v8r1_final12" as const;
export const GI088_EVALUATION_VERSION_V8R1 =
  "2026-08-10.gi088-human-eval-v8r1-final12" as const;
export const GI088_SERVICE_VERSION_V8R1 =
  "2026-08-10.gi088-question-decision-service-v8r1" as const;

export const GI088_V8R2_VERSION_MANIFEST = {
  evaluationId: "gi088_human_eval_v8r2_foundation_hardening",
  evaluation:
    "2026-08-10.gi088-human-eval-v8r2-foundation-hardening",
  service:
    "2026-08-10.gi088-evaluation-foundation-service-v8r2",
  controlDecision: "2026-08-10.interview-control-decision-v2",
  intentClassifier: "2026-08-10.interview-intent-v2",
  deterministicState:
    "2026-08-10.gi088-deterministic-state-maintenance-v2.2",
  semanticDelta: "2026-08-10.gi088-semantic-delta-contract-v2.4",
  questionDecision:
    "2026-08-10.gi088-question-decision-skill-v1.1",
  sharedRecoveryDeadline:
    "2026-08-10.gi088-shared-recovery-deadline-v3",
  evaluationStore: "2026-08-10.gi088-evaluation-store-v2",
  metrics: "2026-08-10.gi088-evaluation-metrics-v1",
  programInterventionReview:
    "2026-08-10.gi088-program-intervention-review-v1",
  readonlyExport: "2026-08-10.gi088-readonly-export-v0.6",
  behaviorManifest: "2026-08-10.gi088-behavior-manifest-v1"
} as const;

export const GI088_V8R3_VERSION_MANIFEST = {
  evaluationId: "gi088_human_eval_v8r3_skill_ark_flash",
  evaluation: "2026-08-11.gi088-human-eval-v8r3-skill-ark-flash",
  service: "2026-08-11.gi088-skill-ark-flash-foundation-service-v8r3",
  controlDecision: "2026-08-10.interview-control-decision-v2",
  intentClassifier: "2026-08-10.interview-intent-v2",
  deterministicState:
    "2026-08-10.gi088-deterministic-state-maintenance-v2.2",
  semanticDelta: "2026-08-10.gi088-semantic-delta-contract-v2.4",
  interviewSkill: "2026-08-11.gi088-interview-skill-v8r3",
  questionValueReview: "2026-08-11.gi088-question-value-review-v1",
  singleFocus: "2026-08-11.gi088-single-answer-focus-v2",
  runtime: "2026-08-11.gi088-ark-flash-runtime-v2",
  payloadContract: "2026-08-11.gi088-ark-openai-json-v1",
  sharedRecoveryDeadline:
    "2026-08-10.gi088-shared-recovery-deadline-v3",
  evaluationStore: "2026-08-10.gi088-evaluation-store-v2",
  metrics: "2026-08-10.gi088-evaluation-metrics-v1",
  programInterventionReview:
    "2026-08-10.gi088-program-intervention-review-v1",
  readonlyExport: "2026-08-11.gi088-readonly-export-v0.7",
  behaviorManifest: "2026-08-11.gi088-behavior-manifest-v2"
} as const;

/** Current release: only EMPTY_CONTENT automatic recovery changes from v8r3. */
export const GI088_V8R3R2_VERSION_MANIFEST = {
  ...GI088_V8R3_VERSION_MANIFEST,
  evaluationId: "gi088_human_eval_v8r3r2_empty_content_recovery_2",
  evaluation:
    "2026-08-12.gi088-human-eval-v8r3r2-empty-content-recovery-2",
  service:
    "2026-08-12.gi088-empty-content-recovery-service-v8r3r2",
  metrics: "2026-08-12.gi088-evaluation-metrics-v2",
  behaviorManifest: "2026-08-12.gi088-behavior-manifest-v3"
} as const;

/**
 * Current release: Interview Skill, Ark model and evaluation assets stay
 * frozen. Only the technical recovery scheduler and its observable evidence
 * contract change from v8r3r2.
 */
export const GI088_V8R3R3_VERSION_MANIFEST = {
  ...GI088_V8R3R2_VERSION_MANIFEST,
  evaluationId: "gi088_human_eval_v8r3r3_adaptive_recovery_30_60",
  evaluation:
    "2026-08-12.gi088-human-eval-v8r3r3-adaptive-recovery-30-60",
  service:
    "2026-08-12.gi088-adaptive-recovery-foundation-service-v8r3r3",
  sharedRecoveryDeadline:
    "2026-08-12.gi088-adaptive-recovery-deadline-v4",
  evaluationStore: "2026-08-12.gi088-evaluation-store-v3-race-winner",
  metrics: "2026-08-12.gi088-evaluation-metrics-v3",
  readonlyExport: "2026-08-12.gi088-readonly-export-v0.8",
  behaviorManifest: "2026-08-12.gi088-behavior-manifest-v4"
} as const;

export const GI088_EVALUATION_ID_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.evaluationId;
export const GI088_EVALUATION_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.evaluation;
export const GI088_SERVICE_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.service;
export const GI088_CONTROL_DECISION_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.controlDecision;
export const GI088_INTENT_CLASSIFIER_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.intentClassifier;
export const GI088_DETERMINISTIC_STATE_POLICY_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.deterministicState;
export const GI088_SEMANTIC_DELTA_CONTRACT_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.semanticDelta;
export const GI088_QUESTION_DECISION_SKILL_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.questionDecision;
export const GI088_SHARED_RECOVERY_DEADLINE_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.sharedRecoveryDeadline;
export const GI088_EVALUATION_STORE_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.evaluationStore;
export const GI088_EVALUATION_METRICS_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.metrics;
export const GI088_PROGRAM_INTERVENTION_REVIEW_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.programInterventionReview;
export const GI088_READONLY_EXPORT_VERSION_V8R2 =
  GI088_V8R2_VERSION_MANIFEST.readonlyExport;
export const GI088_BEHAVIOR_MANIFEST_VERSION_V8R3 =
  GI088_V8R3_VERSION_MANIFEST.behaviorManifest;

export const GI088_EVALUATION_ID_V8R3 =
  GI088_V8R3_VERSION_MANIFEST.evaluationId;
export const GI088_EVALUATION_VERSION_V8R3 =
  GI088_V8R3_VERSION_MANIFEST.evaluation;
export const GI088_SERVICE_VERSION_V8R3 =
  GI088_V8R3_VERSION_MANIFEST.service;
export const GI088_INTERVIEW_SKILL_VERSION_V8R3 =
  GI088_V8R3_VERSION_MANIFEST.interviewSkill;
export const GI088_SINGLE_FOCUS_POLICY_VERSION_V8R3 =
  GI088_V8R3_VERSION_MANIFEST.singleFocus;
export const GI088_RUNTIME_POLICY_VERSION_V8R3 =
  GI088_V8R3_VERSION_MANIFEST.runtime;
export const GI088_PAYLOAD_CONTRACT_VERSION_V8R3 =
  GI088_V8R3_VERSION_MANIFEST.payloadContract;
export const GI088_READONLY_EXPORT_VERSION_V8R3 =
  GI088_V8R3_VERSION_MANIFEST.readonlyExport;

export const GI088_EVALUATION_ID_V8R3R2 =
  GI088_V8R3R2_VERSION_MANIFEST.evaluationId;
export const GI088_EVALUATION_VERSION_V8R3R2 =
  GI088_V8R3R2_VERSION_MANIFEST.evaluation;
export const GI088_SERVICE_VERSION_V8R3R2 =
  GI088_V8R3R2_VERSION_MANIFEST.service;
export const GI088_EVALUATION_METRICS_VERSION_V8R3R2 =
  GI088_V8R3R2_VERSION_MANIFEST.metrics;

export const GI088_EVALUATION_ID_V8R3R3 =
  GI088_V8R3R3_VERSION_MANIFEST.evaluationId;
export const GI088_EVALUATION_VERSION_V8R3R3 =
  GI088_V8R3R3_VERSION_MANIFEST.evaluation;
export const GI088_SERVICE_VERSION_V8R3R3 =
  GI088_V8R3R3_VERSION_MANIFEST.service;
export const GI088_EVALUATION_METRICS_VERSION_V8R3R3 =
  GI088_V8R3R3_VERSION_MANIFEST.metrics;
export const GI088_BEHAVIOR_MANIFEST_VERSION =
  GI088_V8R3R3_VERSION_MANIFEST.behaviorManifest;
