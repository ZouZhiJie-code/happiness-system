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
  | "single_case_blocker"
  | "quality_failure"
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
  | "recovered"
  | "manual_available"
  | "manual_retrying"
  | "exhausted";

export type Gi088RecoveryTrigger =
  | "EMPTY_CONTENT"
  | "TIMEOUT"
  | "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
  | "ASK_QUESTION_COUNT_INVALID:2"
  | "UNAUTHORIZED_PAUSE";

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
};

export type Gi088QuestionReviewClassification =
  | "same_focus_low_burden"
  | "same_focus_heavy"
  | "multiple_independent_tasks"
  | "uncertain";

export type Gi088QuestionReview = {
  questionPresence?: "present" | "absent" | "uncertain";
  classification?: Gi088QuestionReviewClassification;
  note: string;
  reviewedAt: string;
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
};

export type Gi088Call = {
  id: string;
  attempt: number;
  kind: "initial" | "turn" | "manual_retry" | "automatic_retry";
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

export type Gi088TaskState = {
  taskId: string;
  initialUserMessage: string | null;
  activeBranch: Gi088BranchKey;
  branches: Record<Gi088BranchKey, Gi088Trajectory>;
  comparison: Gi088Comparison | null;
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
      routeMaxDurationSeconds: number;
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
    gate?: {
      status: Gi088GateStatus;
      reasons: Gi088GateReason[];
      frozen: boolean;
    };
    readOnly?: boolean;
    readOnlyReason?: string | null;
  };
  tasks: Array<{
    id: string;
    capabilityId: string;
    title: string;
    instruction: string;
    targetTriggerPrompt: string;
    criterion: string;
    repeatOf: string | null;
    status: Gi088TaskStatus;
    targetTriggers: Record<Gi088BranchKey, Gi088TargetTrigger | null>;
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
};
