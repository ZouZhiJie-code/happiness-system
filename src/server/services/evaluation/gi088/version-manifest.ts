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
export const GI088_BEHAVIOR_MANIFEST_VERSION =
  GI088_V8R2_VERSION_MANIFEST.behaviorManifest;
