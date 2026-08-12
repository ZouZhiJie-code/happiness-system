import type {
  Board7bWorkingTaskV1Output,
  Board7bWorkingTaskV1SemanticState
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import type {
  AICompletionTokenUsage,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import type { Gi088SemanticDeltaOutput } from "@/server/services/evaluation/gi088/semantic-delta";
import type { Gi088StateMaintenance } from "@/server/services/evaluation/gi088/deterministic-state";
import type { Gi088EvaluationMetrics as Gi088CalculatedEvaluationMetrics } from "@/server/services/evaluation/gi088/metrics";

export type Gi088BranchKey = "off" | "high";
export type Gi088EvaluationMode = "paired" | "high_only";
export type Gi088BatchStatus = "running" | "sealed" | "early_stopped";
export type Gi088TrajectoryStatus =
  | "not_started"
  | "running"
  | "technical_failure"
  | "protected_failure"
  | "aborted"
  | "completed";
export type Gi088TaskStatus =
  | "ready"
  | "locked"
  | "active"
  | "completed"
  | "aborted"
  | "not_run";

export type Gi088GateStatus =
  | "pending"
  | "no_go"
  | "ready_for_final_review"
  | "legacy_unknown";

export type Gi088GateReasonCode =
  | "offline_evidence_missing"
  | "automatic_recovery_budget_exceeded"
  | "final_visible_rate_below_gate"
  | "visible_latency_p50_exceeded"
  | "visible_latency_p90_exceeded"
  | "visible_latency_max_exceeded"
  | "pending_or_processing"
  | "manual_recovery_used"
  | "single_case_blocker"
  | "quality_failure"
  | "compatibility_smoke_failed"
  | "protected_failure"
  | "final_technical_failure"
  | "multiple_independent_tasks"
  | "target_not_triggered"
  | "duplicate_message"
  | "manual_third_generation"
  | "aborted_with_partial_evidence"
  | "program_intervention_false_positive"
  | "program_intervention_uncertain"
  | "question_review_uncertain"
  | "question_review_incomplete";

export type Gi088GateReason = {
  code: Gi088GateReasonCode;
  sourceType: "technical_fact" | "current_human_conclusion";
  sourceId: string;
  detail: string;
  createdAt: string;
};

export type Gi088TargetTrigger =
  | "triggered"
  | "not_triggered"
  | "blocked_by_technical_failure"
  | "legacy_unknown";

export type Gi088EarlyStopReasonCode =
  | "sufficient_evidence"
  | "technical_friction"
  | "mixed"
  | "other";

export type Gi088EarlyStop = {
  reasonCode: Gi088EarlyStopReasonCode;
  reason: string;
  stoppedAt: string;
  completedTaskIds: string[];
  remainingTaskIds: string[];
};

export type Gi088Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type Gi088RecoveryStatus =
  | "eligible"
  | "retrying"
  | "accelerating"
  | "recovered"
  | "manual_available"
  | "manual_retrying"
  | "exhausted";

export type Gi088RecoveryTrigger =
  | "EMPTY_CONTENT"
  | "TIMEOUT"
  | "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
  | "ASK_QUESTION_COUNT_INVALID:2"
  | "OUTPUT_SCHEMA_INVALID"
  | "SEMANTIC_VALIDATION_FAILED"
  | "STATE_TRANSITION_INVALID"
  | "UNAUTHORIZED_PAUSE";

// The legacy service can still parse the historical question-count trigger.
// Foundation v8r3 intentionally cannot create that trigger.
export type Gi088FoundationRecoveryTrigger = Exclude<
  Gi088RecoveryTrigger,
  "ASK_QUESTION_COUNT_INVALID:2"
>;

export type Gi088V8r3OfflineEvaluationEvidence = {
  candidateOfflineRunFingerprint: string;
  candidateEvidenceFingerprint: string;
  admissionFingerprint: string | null;
  automaticRecoveryCount: number;
};

export type Gi088TurnRecovery = {
  status: Gi088RecoveryStatus;
  trigger: Gi088RecoveryTrigger;
  automaticRetryCount: number;
  initialCallId: string;
  recoveryCallId: string | null;
  manualRetryCount: number;
  manualRetryCallId: string | null;
  eligibleAt: string;
  automaticDeadlineAt?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  policyVersion?: string;
  maximumAutomaticRetriesPerTurn?: 1 | 2;
  maximumProviderCallsPerTurn?: 2 | 3;
  policyOverride?: boolean;
  strategy?: "adaptive_30_60";
  raceGroupId?: string;
  cycle?: number;
  activeCallIds?: string[];
  winnerCallId?: string | null;
  accelerationStartedAt?: string | null;
  accelerationAfterMs?: number;
  hardDeadlineAt?: string | null;
  hardDeadlineMs?: number;
  automaticProviderCallMaximum?: number;
  finalStatus?: "visible" | "manual_available" | "exhausted" | null;
};

export type Gi088AdaptiveRecoveryRace = {
  policyVersion: string;
  raceContractVersion: string;
  raceGroupId: string;
  cycle: number;
  status:
    | "generating"
    | "recovering"
    | "accelerating"
    | "visible"
    | "manual_available"
    | "exhausted";
  startedAt: string;
  accelerationAt: string;
  hardDeadlineAt: string;
  activeCallIds: string[];
  winnerCallId: string | null;
  accelerationCallId: string | null;
  completedAt: string | null;
  cumulativeWaitMs: number | null;
};

export type Gi088QuestionReviewClassification =
  | "same_focus_low_burden"
  | "same_focus_heavy"
  | "multiple_independent_tasks"
  | "uncertain";

export type Gi088QuestionValueClassification =
  | "advances_working_task"
  | "reasks_answered_content"
  | "working_task_drift"
  | "unsupported_third_party_inference"
  | "low_information_gain"
  | "uncertain";

export type Gi088QuestionReview = {
  questionPresence?: "present" | "absent" | "uncertain";
  classification?: Gi088QuestionReviewClassification;
  valueClassification?: Gi088QuestionValueClassification;
  note: string;
  reviewedAt: string;
};

export type Gi088QuestionValueStatistics = {
  reviewedCount: number;
  counts: Record<Gi088QuestionValueClassification, number>;
};

export type Gi088QuestionObservation = {
  questionPresence?: "present" | "absent" | "uncertain";
  questionMarkCount: number;
  reviewCandidate:
    | "none"
    | "zero_question_mark"
    | "multiple_question_marks";
  review: Gi088QuestionReview | null;
  observationFingerprint?: string;
};

export type Gi088CallEffectiveConfig = {
  branch: Gi088BranchKey;
  provider?: string;
  baseUrlHost?: string;
  endpoint?: string;
  model?: string;
  payloadContractVersion?: string;
  hiddenReasoningPersistence?: "forbidden";
  thinking: "disabled" | "enabled";
  reasoningEffort: "high" | null;
  temperature: number | null;
  responseFormat: "json_object";
  maxTokensPolicy: "provider_default";
  timeoutMs: number;
  headersTimeoutMs?: number;
  bodyIdleTimeoutMs?: number;
  hardTimeoutMs?: number;
  timeoutPolicyVersion?: string;
  recoveryInstructionVersion: string | null;
  continuationMode?: "deepseek_chat_prefix_beta" | null;
  reasoningReplay?: "transient_opaque" | null;
  visiblePrefix?: "{" | null;
  requestHashScope?: "full" | "redacted_hidden_reasoning";
  sharedDeadlineMs?: number | null;
  remainingSharedDeadlineMs?: number | null;
  recoveryPolicyVersion?: string | null;
  emptyContentAutomaticRetries?: 1 | 2;
  emptyContentMaximumProviderCalls?: 2 | 3;
  emptyContentRecoveryPolicyVersion?: string;
  emptyContentPolicyOverride?: boolean;
  adaptiveRecoveryPolicyVersion?: string;
  raceContractVersion?: string;
  raceGroupId?: string;
  recoveryRole?:
    | "primary_high"
    | "high_correction"
    | "fast_formatter"
    | "manual_high";
  raceTrigger?: Gi088FoundationRecoveryTrigger | "LATENCY_HEDGE" | null;
  accelerationAfterMs?: number;
  turnHardDeadlineMs?: number;
  remainingTurnDeadlineMs?: number;
  maximumAutomaticProviderCallsPerCycle?: number;
};

export type Gi088Call = {
  id: string;
  attempt: number;
  kind:
    | "initial"
    | "turn"
    | "manual_retry"
    | "automatic_retry"
    | "fast_hedge";
  status: "processing" | "valid" | "technical_failure" | "protected_failure";
  startedAt: string;
  completedAt: string | null;
  requestHash: string;
  responseHash: string | null;
  rawFinalOutput: string | null;
  latencyMs: number | null;
  tokenUsage: AICompletionTokenUsage | null;
  providerDiagnostics?: AIProviderDiagnostics | null;
  errorCode: string | null;
  parentCallId: string | null;
  retryTrigger: Gi088RecoveryTrigger | null;
  retryOrdinal: number | null;
  effectiveConfig: Gi088CallEffectiveConfig;
  ledgerStatus?:
    | "reserved"
    | "dispatched"
    | "provider_succeeded"
    | "provider_failed"
    | "finalized"
    | "interrupted_unknown_dispatch"
    | "finalization_failed"
    | "superseded";
  executionDeadlineAt?: string | null;
  automaticDeadlineAt?: string | null;
  finalizationError?: string | null;
};

export type Gi088Turn = {
  id: string;
  clientTurnId: string;
  userMessageId: string;
  status:
    | "processing"
    | "valid"
    | "complete_after_auto_recovery"
    | "complete_after_manual_recovery"
    | "technical_failure"
    | "protected_failure";
  semantic:
    | Board7bWorkingTaskV1Output["semantic"]
    | Gi088SemanticDeltaOutput["semantic"]
    | null;
  visible: Board7bWorkingTaskV1Output["visible"] | null;
  visibleText: string | null;
  evidenceExcerpts: Array<{ id: string; content: string }>;
  validationIssues: string[];
  semanticStateBefore: Board7bWorkingTaskV1SemanticState;
  semanticStateAfter: Board7bWorkingTaskV1SemanticState | null;
  calls: Gi088Call[];
  recovery: Gi088TurnRecovery | null;
  adaptiveRace?: Gi088AdaptiveRecoveryRace | null;
  questionObservation?: Gi088QuestionObservation | null;
  stateMaintenance?: Gi088StateMaintenance | null;
  activeCallId?: string | null;
  baseAssistantMessageId?: string | null;
  failedOutputDiagnostic?: {
    errorCode: string;
    responseHash: string | null;
    validationIssues: string[];
  } | null;
  controlDecision?: unknown;
};

export type Gi088TrajectoryReview = {
  feeling: "better" | "same" | "worse";
  quality:
    | "direct_use"
    | "minor_issue"
    | "quality_failure"
    | "single_case_blocker";
  reason: string;
  reviewedAt: string;
  targetTrigger: Gi088TargetTrigger;
};

export type Gi088Trajectory = {
  id: string;
  branch: Gi088BranchKey;
  status: Gi088TrajectoryStatus;
  messages: Gi088Message[];
  semanticState: Board7bWorkingTaskV1SemanticState;
  turns: Gi088Turn[];
  pendingTurnId: string | null;
  technicalError: string | null;
  review: Gi088TrajectoryReview | null;
  startedAt: string | null;
  completedAt: string | null;
  abortedAt?: string | null;
  abortReason?: string | null;
};

export type Gi088Comparison = {
  preference: "off_better" | "high_better" | "equivalent";
  reason: string;
  comparedAt: string;
};

export type Gi088EvaluationTaskRole =
  | "scored_trajectory"
  | "compatibility_smoke";

export type Gi088CompatibilitySmokeResult = {
  outcome: "passed" | "failed";
  reason: string;
  observedAt: string;
  evidence?: {
    productSessionFingerprint: string;
    recordMode: "capture";
    completedUserTurnCount: number;
    questionFormTurnCount: number;
    visibleQuestionCount: number;
    providerCallCount: number;
  };
};

export type Gi088TaskState = {
  taskId: string;
  initialUserMessage: string | null;
  activeBranch: Gi088BranchKey;
  branches: Record<Gi088BranchKey, Gi088Trajectory>;
  comparison: Gi088Comparison | null;
  compatibilitySmoke?: Gi088CompatibilitySmokeResult | null;
  aborted?: {
    reason: string;
    abortedAt: string;
    turnId: string | null;
  } | null;
};

export type Gi088BatchState = {
  batchId: string;
  evaluationMode?: Gi088EvaluationMode;
  status: Gi088BatchStatus;
  activeTaskId: string | null;
  tasks: Gi088TaskState[];
  createdAt: string;
  updatedAt: string;
  sealedAt: string | null;
  earlyStop?: Gi088EarlyStop | null;
  offlineEvaluationEvidence?: Gi088V8r3OfflineEvaluationEvidence;
};

export type Gi088StoredBatch = {
  id: string;
  ownerUserId: string;
  evaluationVersion: string;
  candidateFingerprint: string;
  executionFingerprint: string;
  status: Gi088BatchStatus;
  state: Gi088BatchState;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  sealedAt: Date | null;
  runOrdinal?: number;
  gateStatus?: Gi088GateStatus;
  gateReasons?: Gi088GateReason[];
};

export type Gi088ProgramInterventionReviewOutcome =
  | "correct"
  | "false_positive"
  | "uncertain";

export type Gi088ProgramIntervention = {
  id: string;
  taskId: string;
  branch: Gi088BranchKey;
  turnId: string | null;
  callId: string | null;
  interventionType: string;
  originalAction: string | null;
  effectiveAction: string;
  evidenceSpan: string | null;
  observationFingerprint: string;
  reviewOutcome: Gi088ProgramInterventionReviewOutcome | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type Gi088ReviewRevision = {
  id: string;
  subjectType: string;
  subjectId: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  actorUserId?: never;
  clientOperationId: string;
  createdAt: string;
};

export type Gi088EvaluationMetrics = Gi088CalculatedEvaluationMetrics;

export type Gi088PublicSession = {
  evaluation: {
    id: string;
    version: string;
    mode: Gi088EvaluationMode;
    activeBranches: Gi088BranchKey[];
    candidateFingerprint: string;
    executionFingerprint: string;
    model: string;
    skillVersion?: string;
    skillSha256?: string;
    modelIdentity?: {
      provider: string;
      transport: string;
      baseUrlHost: string;
      endpoint: string;
      model: string;
      payloadContractVersion: string;
    };
    serviceVersion?: string;
    behaviorManifestVersion?: string;
    behaviorManifestSha256?: string;
    datasetFingerprint?: string;
    runnerFingerprint?: string;
    experienceFingerprint?: string;
    config?: {
      thinking: "enabled";
      reasoningEffort: "high";
      responseFormat: "json_object";
      maxTokensPolicy: "provider_default";
      timeoutMs: number;
      headersTimeoutMs?: number;
      bodyIdleTimeoutMs?: number;
      hardTimeoutMs?: number;
      automaticChainDeadlineMs?: number;
      automaticEmptyContentRetries?: 1 | 2;
      maximumProviderCallsPerTurn?: 2 | 3;
      emptyContentRecoveryPolicyVersion?: string;
      emptyContentPolicyOverride?: boolean;
      routeMaxDurationSeconds: number;
      hiddenReasoningPersistence?: "forbidden";
      adaptiveRecoveryPolicyVersion?: string;
      accelerationAfterMs?: number;
      turnHardDeadlineMs?: number;
      maximumAutomaticProviderCallsPerCycle?: number;
    };
  };
  batch: {
    id: string;
    status: Gi088BatchStatus;
    completedTaskCount: number;
    totalTasks: number;
    sealedAt: string | null;
    earlyStop: Gi088EarlyStop | null;
    targetCoverage: {
      triggeredTrajectoryCount: number;
      reviewedTrajectoryCount: number;
      totalTrajectoryCount: number;
    };
    runId?: string;
    runOrdinal?: number;
    revision?: number;
    gate?: {
      status: Gi088GateStatus;
      reasons: Gi088GateReason[];
      frozen: boolean;
    };
    offlineEvaluationEvidence?: Gi088V8r3OfflineEvaluationEvidence;
    recoveryBudget?: {
      offlineAutomaticRecoveryCount: number;
      previewAutomaticRecoveryCount: number;
      combinedAutomaticRecoveryCount: number;
      maximumAutomaticRecoveryCount: number;
    };
    adaptiveRecoveryDiagnostics?: {
      finalVisibleCompletionRate: number | null;
      firstVisibleSuccessRate: number | null;
      automaticRecoveryTurnCount: number;
      fastHedgeCallCount: number;
      visibleLatencyP50Ms: number | null;
      visibleLatencyP90Ms: number | null;
      visibleLatencyMaxMs: number | null;
      maximumAutomaticProviderCallsPerCycle: number;
      accelerationAfterMs: number;
      hardDeadlineMs: number;
    };
    readOnly?: boolean;
    readOnlyReason?: string | null;
  };
  tasks: Array<{
    id: string;
    evaluationRole?: Gi088EvaluationTaskRole;
    capabilityId: string;
    title: string;
    instruction: string;
    targetTriggerPrompt: string;
    criterion: string;
    repeatOf: string | null;
    status: Gi088TaskStatus;
    targetTriggers: Record<Gi088BranchKey, Gi088TargetTrigger | null>;
    compatibilitySmoke?: Gi088CompatibilitySmokeResult | null;
  }>;
  activeTask: null | {
    taskId: string;
    frozenStart: {
      opening: string;
      userMessage: string | null;
    };
    activeBranch: Gi088BranchKey;
    branches: Record<
      Gi088BranchKey,
      Gi088Trajectory & {
        config: {
          key: Gi088BranchKey;
          label: string;
          thinking: "disabled" | "enabled";
          temperature: number | null;
          effectiveTemperature: number | null;
          reasoningEffort: "high" | null;
          automaticEmptyContentRetries: number;
          maximumProviderCallsPerTurn?: 2 | 3;
          emptyContentRecoveryPolicyVersion?: string;
          emptyContentPolicyOverride?: boolean;
          adaptiveRecoveryPolicyVersion?: string;
          accelerationAfterMs?: number;
          turnHardDeadlineMs?: number;
          maximumAutomaticProviderCallsPerCycle?: number;
          automaticStageTransitionRetries: number;
          automaticSingleQuestionRetries: number;
          automaticTechnicalRetries: number;
          providerCallsUsed: number;
          providerCallsRemaining: number | null;
          maximumProviderCallsPerTrajectory: number | null;
        };
        dialogueAnchor?: {
          lastAssistantMessageId: string | null;
          lastCommittedTurnId: string | null;
        };
        reviewSnapshotFingerprint?: string;
      }
    >;
    comparison: Gi088Comparison | null;
    readOnly: boolean;
    reviewSnapshot?: {
      fingerprint: string;
      trajectoryReview: Gi088TrajectoryReview | null;
      questionReviews: Array<{
        turnId: string;
        observationFingerprint: string;
        review: Gi088QuestionReview | null;
      }>;
      programInterventions: Gi088ProgramIntervention[];
    };
  };
  metrics?: Gi088EvaluationMetrics;
  programInterventions?: Gi088ProgramIntervention[];
  reviewRevisions?: Gi088ReviewRevision[];
  questionValueStatistics?: Gi088QuestionValueStatistics;
};
