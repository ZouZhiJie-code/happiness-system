import {
  Gi088ExportDownloadError,
  downloadVerifiedGi088EvaluationExport
} from "@/features/interview/event-centered/gi088-evaluation-export";

export const GI088_EVALUATION_VERSION =
  "2026-08-11.gi088-human-eval-v8r3-skill-ark-flash" as const;

export type Gi088GenerationProgress = {
  type:
    | "turn_reserved"
    | "provider_started"
    | "heartbeat"
    | "recovery_started";
  trigger?:
    | "EMPTY_CONTENT"
    | "TIMEOUT"
    | "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
    | "ASK_QUESTION_COUNT_INVALID:2"
    | "UNAUTHORIZED_PAUSE";
  turnId: string;
  callId?: string;
};

export type Gi088BranchKey = "off" | "high";
export type Gi088Feeling = "better" | "same" | "worse";
export type Gi088Quality =
  | "direct_use"
  | "minor_issue"
  | "quality_failure"
  | "single_case_blocker";
export type Gi088Preference = "off_better" | "high_better" | "equivalent";
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
export type Gi088QuestionPresence = "present" | "absent" | "uncertain";

export type Gi088TaskStatus =
  | "ready"
  | "locked"
  | "active"
  | "completed"
  | "aborted"
  | "not_run";

export type Gi088TrajectoryStatus =
  | "not_started"
  | "running"
  | "technical_failure"
  | "protected_failure"
  | "aborted"
  | "completed";

export type Gi088GateStatus =
  | "pending"
  | "no_go"
  | "ready_for_final_review"
  | "legacy_unknown";

export type Gi088IssueAction =
  | "read_latest_state"
  | "return_to_current_task"
  | "reconfirm_submission"
  | "generate_again"
  | "seal_and_export"
  | "none";

export type Gi088EvaluationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type Gi088EvidenceExcerpt = {
  id: string;
  content: string;
};

export type Gi088WorkingTask = {
  continuity?: "new" | "continue" | "return";
  targetRef?: string | null;
  taskRef?: string;
  summary: string;
  evidenceRefs: string[];
};

export type Gi088NextInquiry = {
  answerTarget: string;
  taskEffect: string;
  evidenceRefs: string[];
};

export type Gi088Semantic = {
  stage?: "engage_focus" | "explore_clarify" | "deepen_integrate";
  action?: "acknowledge" | "ask" | "synthesize" | "pause";
  workingTask?: Gi088WorkingTask | null;
  nextInquiry?: Gi088NextInquiry | null;
  understandingDelta?: { summary: string; evidenceRefs: string[] } | null;
  understandingChange?:
    | { kind: "none" }
    | { kind: "add"; summary: string; evidenceRefs: string[] }
    | {
        kind: "revise";
        targetRef: string;
        summary: string;
        evidenceRefs: string[];
      };
  pauseReason?: string | null;
  burdenSignal?: { summary: string; evidenceRefs: string[] } | null;
  burdenSignalChange?:
    | { kind: "unchanged" }
    | { kind: "set"; summary: string; evidenceRefs: string[] }
    | { kind: "clear" };
  [key: string]: unknown;
};

export type Gi088CallMetadata = {
  id: string;
  attempt: number;
  kind: "initial" | "turn" | "manual_retry" | "automatic_retry";
  status: "processing" | "valid" | "technical_failure" | "protected_failure";
  startedAt: string;
  completedAt?: string | null;
  requestHash?: string;
  responseHash?: string | null;
  latencyMs?: number | null;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    [key: string]: unknown;
  } | null;
  providerDiagnostics?: Gi088ProviderDiagnostics | null;
  errorCode?: string | null;
  parentCallId?: string | null;
  retryTrigger?:
    | "EMPTY_CONTENT"
    | "TIMEOUT"
    | "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
    | "ASK_QUESTION_COUNT_INVALID:2"
    | "UNAUTHORIZED_PAUSE"
    | null;
  retryOrdinal?: number | null;
  effectiveConfig?: {
    branch: Gi088BranchKey;
    provider?: string;
    baseUrlHost?: string;
    endpoint?: string;
    model?: string;
    payloadContractVersion?: string;
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

export type Gi088ProviderDiagnostics = {
  finishReason:
    | "stop"
    | "length"
    | "content_filter"
    | "tool_calls"
    | "unknown"
    | null;
  reasoningPresent: boolean | null;
  reasoningLength: number | null;
  reasoningTokens: number | null;
  latencyMs: number | null;
  tokenUsage: Gi088CallMetadata["tokenUsage"];
  upstreamRequestId?: string | null;
  httpStatus?: number | null;
  responseModel?: string | null;
  choiceCount?: number | null;
  contentType?:
    | "missing"
    | "null"
    | "string"
    | "array"
    | "object"
    | "number"
    | "boolean"
    | "unknown"
    | null;
  contentLength?: number | null;
  reasoningType?:
    | "missing"
    | "null"
    | "string"
    | "array"
    | "object"
    | "number"
    | "boolean"
    | "unknown"
    | null;
  headersLatencyMs?: number | null;
  bodyLatencyMs?: number | null;
  totalLatencyMs?: number | null;
  timeoutStage?: "headers" | "body" | "hard_total" | null;
  abortSource?: "deadline" | "caller" | null;
};

export type Gi088TrajectoryTurn = {
  id: string;
  userMessageId: string;
  clientTurnId?: string;
  status:
    | "processing"
    | "valid"
    | "complete_after_auto_recovery"
    | "complete_after_manual_recovery"
    | "technical_failure"
    | "protected_failure";
  semantic: Gi088Semantic | null;
  visible?: { understanding?: string | null; response?: string } | null;
  visibleText: string | null;
  evidenceExcerpts: Gi088EvidenceExcerpt[];
  validationIssues?: string[];
  calls: Gi088CallMetadata[];
  recovery?: {
    status:
      | "eligible"
      | "retrying"
      | "recovered"
      | "manual_available"
      | "manual_retrying"
      | "exhausted";
    trigger:
      | "EMPTY_CONTENT"
      | "TIMEOUT"
      | "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
      | "ASK_QUESTION_COUNT_INVALID:2"
      | "UNAUTHORIZED_PAUSE";
    automaticRetryCount: number;
    initialCallId: string;
    recoveryCallId: string | null;
    manualRetryCount?: number;
    manualRetryCallId?: string | null;
    eligibleAt: string;
    automaticDeadlineAt?: string | null;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  questionObservation?: {
    questionPresence?: Gi088QuestionPresence;
    questionMarkCount: number;
    reviewCandidate:
      | "none"
      | "zero_question_mark"
      | "multiple_question_marks";
    review: {
      questionPresence?: Gi088QuestionPresence;
      classification?: Gi088QuestionReviewClassification;
      valueClassification?: Gi088QuestionValueClassification;
      note: string;
      reviewedAt: string;
    } | null;
    observationFingerprint?: string;
  } | null;
  stateMaintenance?: {
    policyVersion: string;
    workingTaskLineage:
      | "not_applicable"
      | "unchanged"
      | "merged";
    inheritedEvidenceCount: number;
    submittedEvidenceCount: number;
    effectiveEvidenceCount: number;
    explicitStop: "none" | "pure" | "mixed";
    providerCallBypassed: boolean;
    providerFailureAbsorbed: boolean;
    sourceCompletion?: {
      appliedFields: Array<
        | "semantic.workingTask.evidenceRefs"
        | "semantic.nextInquiry.evidenceRefs"
      >;
      insertedEvidenceRefs: string[];
      reviewCandidate: "program_source_completion" | null;
    };
  } | null;
  activeCallId?: string | null;
  baseAssistantMessageId?: string | null;
  failedOutputDiagnostic?: {
    errorCode: string;
    responseHash: string | null;
    validationIssues: string[];
  } | null;
};

export type Gi088TrajectoryReview = {
  feeling: Gi088Feeling;
  quality: Gi088Quality;
  targetTrigger: Gi088TargetTrigger;
  reason: string;
  reviewedAt?: string;
};

export type Gi088Trajectory = {
  id: string;
  branch?: Gi088BranchKey;
  config: {
    key: Gi088BranchKey;
    label: string;
    thinking: "disabled" | "enabled";
    temperature: number | null;
    effectiveTemperature?: number | null;
    reasoningEffort: "high" | null;
    automaticEmptyContentRetries: number;
    automaticStageTransitionRetries: number;
    automaticSingleQuestionRetries?: number;
    automaticTechnicalRetries?: number;
    providerCallsUsed?: number;
    providerCallsRemaining?: number | null;
    maximumProviderCallsPerTrajectory?: number | null;
  };
  status: Gi088TrajectoryStatus;
  messages: Gi088EvaluationMessage[];
  semanticState: Gi088Semantic | null;
  turns: Gi088TrajectoryTurn[];
  pendingTurnId: string | null;
  technicalError: string | null;
  review: Gi088TrajectoryReview | null;
  startedAt?: string | null;
  completedAt?: string | null;
  abortedAt?: string | null;
  abortReason?: string | null;
  dialogueAnchor?: {
    lastAssistantMessageId: string | null;
    lastCommittedTurnId: string | null;
  };
  reviewSnapshotFingerprint?: string;
};

export type Gi088TaskSummary = {
  id: string;
  evaluationRole?: "scored_trajectory" | "compatibility_smoke";
  capabilityId: string;
  title: string;
  instruction: string;
  targetTriggerPrompt: string;
  criterion: string;
  repeatOf: string | null;
  status: Gi088TaskStatus;
  targetTriggers: Record<Gi088BranchKey, Gi088TargetTrigger | null>;
  compatibilitySmoke?: {
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
  } | null;
};

export type Gi088Comparison = {
  preference: Gi088Preference;
  reason: string;
} | null;

export type Gi088GateReason = {
  code: string;
  sourceType: "technical_fact" | "current_human_conclusion";
  sourceId: string;
  detail: string;
  createdAt: string;
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
  actorUserId?: string;
  clientOperationId: string;
  createdAt: string;
};

export type Gi088EvaluationMetrics = {
  version?: string;
  eligibleModelSubmissionCount: number;
  firstVisibleSuccessCount: number;
  firstVisibleSuccessRate: number | null;
  zeroCallControlCount: number;
  rawTechnicalEventCount: number;
  rawProtectedEventCount?: number;
  autoRecoverySuccessCount: number;
  finalFailureCount: number;
  manualThirdGenerationCount: number;
  consecutiveRecoveryCount: number;
  duplicateMessageCount: number;
  programInterventionCount: number;
  programInterventionFalsePositiveCount?: number;
  falsePositiveCount?: number;
  programInterventionReviewCoverage: number | null;
  visibleQuestionCount?: number;
  visibleQuestionReviewedCount?: number;
  visibleQuestionReviewCoverage: number | null;
  multipleIndependentTasksCount: number;
  gateFacts?: Record<string, number | boolean>;
};

export type Gi088RunSummary = {
  runId: string;
  runOrdinal: number;
  evaluationVersion: string;
  status: "running" | "sealed" | "early_stopped";
  gateStatus: Gi088GateStatus;
  completedTaskCount: number;
  totalTasks: number;
  readOnly: boolean;
  createdAt: string;
  updatedAt: string;
  sealedAt: string | null;
};

export type Gi088RunsResponse = {
  runs: Gi088RunSummary[];
  session?: Gi088EvaluationSession;
};

export type Gi088EvaluationSession = {
  evaluation: {
    id: string;
    version: string;
    mode?: "paired" | "high_only";
    activeBranches?: Gi088BranchKey[];
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
  };
  batch: {
    id: string;
    status: "running" | "sealed" | "early_stopped";
    completedTaskCount: number;
    totalTasks: number;
    sealedAt: string | null;
    earlyStop: {
      reasonCode: Gi088EarlyStopReasonCode;
      reason: string;
      stoppedAt: string;
      completedTaskIds: string[];
      remainingTaskIds: string[];
    } | null;
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
    readOnly?: boolean;
    readOnlyReason?: string | null;
  };
  tasks: Gi088TaskSummary[];
  activeTask: {
    taskId: string;
    frozenStart: {
      opening: string;
      userMessage: string | null;
    };
    activeBranch: Gi088BranchKey;
    branches: Record<Gi088BranchKey, Gi088Trajectory>;
    comparison: Gi088Comparison;
    readOnly?: boolean;
    reviewSnapshot?: {
      fingerprint: string;
      trajectoryReview: Gi088TrajectoryReview | null;
      questionReviews: Array<{
        turnId: string;
        observationFingerprint: string;
        review: NonNullable<Gi088TrajectoryTurn["questionObservation"]>["review"];
      }>;
      programInterventions: Gi088ProgramIntervention[];
    };
  } | null;
  metrics?: Gi088EvaluationMetrics;
  programInterventions?: Gi088ProgramIntervention[];
  reviewRevisions?: Gi088ReviewRevision[];
};

export type Gi088EvaluationIssue = {
  code: string;
  message: string;
  retryable: boolean;
  dataSaved?: "yes" | "partial" | "no" | "unknown";
  impact?: "request" | "turn" | "task" | "run" | "environment";
  action?: Gi088IssueAction;
  requestId?: string;
};

export type Gi088TechnicalSmoke = {
  id: string;
  executionFingerprint: string;
  arm: Gi088BranchKey;
  status: "processing" | "valid" | "technical_failure" | "protected_failure";
  rawFinalOutput: string | null;
  semantic: Gi088Semantic | null;
  visible: { understanding?: string | null; response?: string } | null;
  validationIssues: string[];
  latencyMs: number | null;
  tokenUsage: Gi088CallMetadata["tokenUsage"];
  providerDiagnostics: Gi088ProviderDiagnostics | null;
  errorCode: string | null;
  completedAt: string | null;
};

export class Gi088EvaluationRequestError extends Error {
  constructor(readonly issue: Gi088EvaluationIssue) {
    super(issue.message);
    this.name = "Gi088EvaluationRequestError";
  }
}

function createOperationId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function createGi088ClientTurnId() {
  return createOperationId("gi088-turn");
}

export function createGi088ClientOperationId(kind = "operation") {
  return createOperationId(`gi088-${kind}`);
}

async function readPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function issueFromPayload(payload: unknown, response: Response): Gi088EvaluationIssue {
  if (payload && typeof payload === "object") {
    const outer = payload as { error?: unknown; issue?: unknown };
    const candidate = outer.error ?? outer.issue;
    if (candidate && typeof candidate === "object") {
      const issue = candidate as {
        code?: unknown;
        message?: unknown;
        retryable?: unknown;
        dataSaved?: unknown;
        impact?: unknown;
        action?: unknown;
        requestId?: unknown;
      };
      if (typeof issue.code === "string" && typeof issue.message === "string") {
        return {
          code: issue.code,
          message: issue.message,
          retryable: typeof issue.retryable === "boolean"
            ? issue.retryable
            : response.status >= 500,
          ...(issue.dataSaved === "yes" ||
          issue.dataSaved === "partial" ||
          issue.dataSaved === "no" ||
          issue.dataSaved === "unknown"
            ? { dataSaved: issue.dataSaved }
            : {}),
          ...(issue.impact === "request" ||
          issue.impact === "turn" ||
          issue.impact === "task" ||
          issue.impact === "run" ||
          issue.impact === "environment"
            ? { impact: issue.impact }
            : {}),
          ...(issue.action === "read_latest_state" ||
          issue.action === "return_to_current_task" ||
          issue.action === "reconfirm_submission" ||
          issue.action === "generate_again" ||
          issue.action === "seal_and_export" ||
          issue.action === "none"
            ? { action: issue.action }
            : {}),
          ...(typeof issue.requestId === "string"
            ? { requestId: issue.requestId }
            : {})
        };
      }
    }
  }

  return {
    code: `GI088_HTTP_${response.status || "NETWORK"}`,
    message: "评测工作台暂时无法完成这一步。当前内容仍然保留，可以刷新后继续。",
    retryable: response.status >= 500 || response.status === 0,
    dataSaved: "unknown",
    impact: "request",
    action: "read_latest_state"
  };
}

function sessionFromPayload(payload: unknown): Gi088EvaluationSession {
  if (payload && typeof payload === "object" && "session" in payload) {
    return (payload as { session: Gi088EvaluationSession }).session;
  }
  return payload as Gi088EvaluationSession;
}

async function requestSession(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch {
    throw new Gi088EvaluationRequestError({
      code: "GI088_NETWORK_UNAVAILABLE",
      message: "评测工作台暂时无法连接。当前内容仍在，请恢复网络后重试。",
      retryable: true,
      dataSaved: "unknown",
      impact: "environment",
      action: "read_latest_state"
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) throw new Gi088EvaluationRequestError(issueFromPayload(payload, response));
  return sessionFromPayload(payload);
}

async function requestPayload(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch {
    throw new Gi088EvaluationRequestError({
      code: "GI088_NETWORK_UNAVAILABLE",
      message: "评测工作台暂时无法连接。当前内容仍在，请恢复网络后读取最新状态。",
      retryable: true,
      dataSaved: "unknown",
      impact: "environment",
      action: "read_latest_state"
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new Gi088EvaluationRequestError(issueFromPayload(payload, response));
  }
  return payload;
}

async function requestStreamingSession(
  path: string,
  init: RequestInit,
  onProgress?: (progress: Gi088GenerationProgress) => void
) {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch {
    throw new Gi088EvaluationRequestError({
      code: "GI088_NETWORK_UNAVAILABLE",
      message: "评测工作台暂时无法连接。当前内容仍在，请恢复网络后读取最新状态。",
      retryable: true,
      dataSaved: "unknown",
      impact: "environment",
      action: "read_latest_state"
    });
  }
  if (!response.ok) {
    const payload = await readPayload(response);
    throw new Gi088EvaluationRequestError(issueFromPayload(payload, response));
  }
  if (!response.headers?.get?.("content-type")?.includes("application/x-ndjson")) {
    return sessionFromPayload(await readPayload(response));
  }
  if (!response.body) {
    throw new Gi088EvaluationRequestError({
      code: "GI088_STREAM_RESPONSE_MISSING",
      message: "生成状态返回不完整。你的原话已经保留，请读取最新状态。",
      retryable: true,
      dataSaved: "unknown",
      impact: "turn",
      action: "read_latest_state"
    });
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let session: Gi088EvaluationSession | null = null;
  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as {
      type?: unknown;
      session?: Gi088EvaluationSession;
      trigger?: unknown;
      turnId?: unknown;
      callId?: unknown;
      error?: unknown;
      issue?: unknown;
    };
    if (event.type === "session" && event.session) {
      session = event.session;
      return;
    }
    if (
      (event.type === "turn_reserved" ||
        event.type === "provider_started" ||
        event.type === "heartbeat" ||
        event.type === "recovery_started") &&
      typeof event.turnId === "string"
    ) {
      const trigger =
        event.trigger === "EMPTY_CONTENT" ||
        event.trigger === "TIMEOUT" ||
        event.trigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE" ||
        event.trigger === "ASK_QUESTION_COUNT_INVALID:2" ||
        event.trigger === "UNAUTHORIZED_PAUSE"
          ? event.trigger
          : undefined;
      onProgress?.({
        type: event.type,
        turnId: event.turnId,
        ...(typeof event.callId === "string" ? { callId: event.callId } : {}),
        ...(trigger ? { trigger } : {})
      });
      return;
    }
    if (event.type === "error") {
      throw new Gi088EvaluationRequestError(issueFromPayload(event, response));
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
    if (done) break;
  }
  if (buffer.trim()) consumeLine(buffer);
  if (!session) {
    throw new Gi088EvaluationRequestError({
      code: "GI088_STREAM_SESSION_MISSING",
      message: "生成结果返回不完整。你的原话已经保留，请读取最新状态。",
      retryable: true,
      dataSaved: "unknown",
      impact: "turn",
      action: "read_latest_state"
    });
  }
  return session;
}

export async function runGi088TechnicalSmoke(arm: Gi088BranchKey) {
  let response: Response;
  try {
    response = await fetch("/api/preview/gi088/smoke", {
      cache: "no-store",
      ...jsonRequest({ arm, confirmation: true })
    });
  } catch {
    throw new Gi088EvaluationRequestError({
      code: "GI088_NETWORK_UNAVAILABLE",
      message: "技术冒烟暂时无法连接。当前正式评测批次未受影响。",
      retryable: true
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new Gi088EvaluationRequestError(issueFromPayload(payload, response));
  }
  if (!payload || typeof payload !== "object" || !("smoke" in payload)) {
    throw new Gi088EvaluationRequestError({
      code: "GI088_SMOKE_RESPONSE_INVALID",
      message: "技术冒烟返回格式异常。正式评测批次未受影响。",
      retryable: false
    });
  }
  return (payload as { smoke: Gi088TechnicalSmoke }).smoke;
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

function rejectHighOnlyMutation(message: string) {
  return Promise.reject(new Gi088EvaluationRequestError({
    code: "GI088_HIGH_ONLY_EVALUATION",
    message,
    retryable: false,
    dataSaved: "yes",
    impact: "run",
    action: "return_to_current_task"
  }));
}

function rejectInvalidTurnAnchor() {
  return Promise.reject(new Gi088EvaluationRequestError({
    code: "GI088_TURN_INPUT_INVALID",
    message: "当前所见回复缺少可校验的消息锚点，请先读取最新状态。",
    retryable: false,
    dataSaved: "yes",
    impact: "turn",
    action: "read_latest_state"
  }));
}

function runIdFromSession(session: Gi088EvaluationSession) {
  return session.batch.runId ?? session.batch.id;
}

function legacyRunSummary(session: Gi088EvaluationSession): Gi088RunSummary {
  return {
    runId: runIdFromSession(session),
    runOrdinal: session.batch.runOrdinal ?? 1,
    evaluationVersion: session.evaluation.version,
    status: session.batch.status,
    gateStatus: session.batch.gate?.status ?? "legacy_unknown",
    completedTaskCount: session.batch.completedTaskCount,
    totalTasks: session.batch.totalTasks,
    readOnly: Boolean(session.batch.readOnly),
    createdAt: "",
    updatedAt: "",
    sealedAt: session.batch.sealedAt
  };
}

function normalizeRunSummary(value: unknown): Gi088RunSummary | null {
  if (!value || typeof value !== "object") return null;
  const run = value as Record<string, unknown>;
  const runId = typeof run.runId === "string"
    ? run.runId
    : typeof run.id === "string"
      ? run.id
      : null;
  const status = run.status ?? run.collectionStatus;
  if (
    !runId ||
    (status !== "running" && status !== "sealed" && status !== "early_stopped")
  ) {
    return null;
  }
  const gateStatus = run.gateStatus;
  return {
    runId,
    runOrdinal: typeof run.runOrdinal === "number" ? run.runOrdinal : 1,
    evaluationVersion: typeof run.evaluationVersion === "string"
      ? run.evaluationVersion
      : GI088_EVALUATION_VERSION,
    status,
    gateStatus:
      gateStatus === "pending" ||
      gateStatus === "no_go" ||
      gateStatus === "ready_for_final_review" ||
      gateStatus === "legacy_unknown"
        ? gateStatus
        : "legacy_unknown",
    completedTaskCount: typeof run.completedTaskCount === "number"
      ? run.completedTaskCount
      : 0,
    totalTasks: typeof run.totalTasks === "number" ? run.totalTasks : 12,
    readOnly: run.readOnly === true,
    createdAt: typeof run.createdAt === "string" ? run.createdAt : "",
    updatedAt: typeof run.updatedAt === "string" ? run.updatedAt : "",
    sealedAt: typeof run.sealedAt === "string" ? run.sealedAt : null
  };
}

function runsFromPayload(payload: unknown): Gi088RunsResponse {
  if (payload && typeof payload === "object" && "evaluation" in payload) {
    const session = payload as Gi088EvaluationSession;
    return { runs: [legacyRunSummary(session)], session };
  }
  if (payload && typeof payload === "object") {
    const value = payload as { runs?: unknown; session?: unknown };
    if (Array.isArray(value.runs)) {
      const session = value.session
        ? sessionFromPayload(value.session)
        : undefined;
      const runs = value.runs
        .map(normalizeRunSummary)
        .filter((run): run is Gi088RunSummary => Boolean(run));
      return {
        runs: session && runs.length === 0
          ? [legacyRunSummary(session)]
          : runs,
        ...(session ? { session } : {})
      };
    }
    if (value.session) {
      const session = sessionFromPayload(value.session);
      return { runs: [legacyRunSummary(session)], session };
    }
  }
  throw new Gi088EvaluationRequestError({
    code: "GI088_RUN_RESPONSE_INVALID",
    message: "评测运行列表返回格式异常，请重新读取。",
    retryable: true,
    dataSaved: "unknown",
    impact: "run",
    action: "read_latest_state"
  });
}

export async function getGi088EvaluationRuns() {
  return runsFromPayload(await requestPayload("/api/preview/gi088/runs"));
}

export async function createGi088EvaluationRun(
  clientOperationId = createGi088ClientOperationId("create-run")
) {
  return runsFromPayload(await requestPayload(
    "/api/preview/gi088/runs",
    jsonRequest({ clientOperationId })
  ));
}

export function getGi088EvaluationSession(input: {
  runId: string;
  taskId?: string;
}) {
  const query = new URLSearchParams({ runId: input.runId });
  if (input.taskId) query.set("taskId", input.taskId);
  return requestSession(`/api/preview/gi088/session?${query.toString()}`);
}

export function startGi088OffTrajectory(input: {
  runId: string;
  taskId: string;
  initialUserMessage: string;
  clientTurnId: string;
  baseAssistantMessageId?: string | null;
}) {
  void input;
  return rejectHighOnlyMutation(
    "当前 v8r3 运行只开放 Thinking high；历史双分支运行保持只读。"
  );
}

export function startGi088HighTrajectory(
  input: {
    runId: string;
    taskId: string;
    initialUserMessage?: string;
    clientTurnId?: string;
    clientOperationId?: string;
    baseAssistantMessageId?: string | null;
  },
  onProgress?: (progress: Gi088GenerationProgress) => void
) {
  if (!input.initialUserMessage?.trim()) {
    return Promise.reject(new Gi088EvaluationRequestError({
      code: "GI088_START_INPUT_INVALID",
      message: "开始任务需要提交第一段表达，请保留草稿后重试。",
      retryable: false,
      dataSaved: "yes",
      impact: "task",
      action: "reconfirm_submission"
    }));
  }
  const clientOperationId = input.clientTurnId ??
    input.clientOperationId ??
    createGi088ClientOperationId("start-high");
  return requestStreamingSession(
    "/api/preview/gi088/start-task",
    jsonRequest({
      runId: input.runId,
      taskId: input.taskId,
      ...(input.initialUserMessage
        ? { initialUserMessage: input.initialUserMessage }
        : {}),
      action: "start_high",
      clientOperationId
    }),
    onProgress
  );
}

export function submitGi088Turn(input: {
  runId: string;
  taskId: string;
  branch: Gi088BranchKey;
  content: string;
  clientTurnId: string;
  baseAssistantMessageId: string;
}, onProgress?: (progress: Gi088GenerationProgress) => void) {
  if (input.branch !== "high") {
    return rejectHighOnlyMutation(
      "当前 v8r3 运行只接受 Thinking high 分支提交。"
    );
  }
  if (!input.baseAssistantMessageId.trim()) return rejectInvalidTurnAnchor();
  return requestStreamingSession(
    "/api/preview/gi088/turn",
    jsonRequest({ ...input, clientOperationId: input.clientTurnId }),
    onProgress
  );
}

export function retryGi088Turn(input: {
  runId: string;
  taskId: string;
  branch: Gi088BranchKey;
  turnId: string;
  trigger: "manual_after_auto_recovery";
  clientOperationId?: string;
}, onProgress?: (progress: Gi088GenerationProgress) => void) {
  if (input.branch !== "high") {
    return rejectHighOnlyMutation(
      "当前 v8r3 运行只接受 Thinking high 分支再次生成。"
    );
  }
  return requestStreamingSession(
    "/api/preview/gi088/retry",
    jsonRequest({
      ...input,
      clientOperationId: input.clientOperationId ??
        createGi088ClientOperationId("manual-retry")
    }),
    onProgress
  );
}

export function reviewGi088Question(input: {
  runId: string;
  taskId: string;
  branch: Gi088BranchKey;
  turnId: string;
  questionPresence: Gi088QuestionPresence;
  classification?: Gi088QuestionReviewClassification;
  valueClassification?: Gi088QuestionValueClassification;
  note?: string;
  observationFingerprint: string;
  revisionReason?: string;
  clientOperationId?: string;
}) {
  if (input.branch !== "high") {
    return rejectHighOnlyMutation(
      "当前 v8r3 运行只接受 Thinking high 分支问题复核。"
    );
  }
  return requestSession(
    "/api/preview/gi088/question-review",
    jsonRequest({
      ...input,
      note: input.note ?? "",
      clientOperationId: input.clientOperationId ??
        createGi088ClientOperationId("question-review")
    })
  );
}

export function endGi088Trajectory(input: {
  runId: string;
  taskId: string;
  branch: Gi088BranchKey;
  feeling: Gi088Feeling;
  quality: Gi088Quality;
  targetTrigger: Exclude<Gi088TargetTrigger, "legacy_unknown">;
  reason: string;
  reviewSnapshotFingerprint: string;
  revisionReason?: string;
  clientOperationId?: string;
}) {
  if (input.branch !== "high") {
    return rejectHighOnlyMutation(
      "当前 v8r3 运行只接受 Thinking high 分支轨迹评价。"
    );
  }
  return requestSession("/api/preview/gi088/end-trajectory", jsonRequest({
    ...input,
    clientOperationId: input.clientOperationId ??
      createGi088ClientOperationId("trajectory-review")
  }));
}

export function compareGi088Trajectories(input: {
  runId: string;
  taskId: string;
  preference: Gi088Preference;
  reason: string;
  clientOperationId?: string;
}) {
  return requestSession("/api/preview/gi088/compare", jsonRequest({
    ...input,
    clientOperationId: input.clientOperationId ??
      createGi088ClientOperationId("compare")
  }));
}

export function recordGi088CompatibilitySmoke(input: {
  runId: string;
  taskId: string;
  outcome: "passed" | "failed";
  reason: string;
  productSessionId?: string;
  clientOperationId?: string;
}) {
  return requestSession(
    "/api/preview/gi088/compatibility-smoke",
    jsonRequest({
      ...input,
      clientOperationId: input.clientOperationId ??
        createGi088ClientOperationId("compatibility-smoke")
    })
  );
}

export function sealGi088EvaluationBatch(input: {
  runId: string;
  clientOperationId?: string;
}) {
  return requestSession("/api/preview/gi088/seal", jsonRequest({
    ...input,
    confirmation: true,
    clientOperationId: input.clientOperationId ??
      createGi088ClientOperationId("seal")
  }));
}

export function earlyStopGi088EvaluationBatch(input: {
  runId: string;
  reasonCode: Gi088EarlyStopReasonCode;
  reason: string;
  clientOperationId?: string;
}) {
  return requestSession(
    "/api/preview/gi088/early-stop",
    jsonRequest({
      ...input,
      confirmation: true,
      clientOperationId: input.clientOperationId ??
        createGi088ClientOperationId("early-stop")
    })
  );
}

export function abortGi088CurrentTask(input: {
  runId: string;
  taskId: string;
  reason: string;
  abandonRecovery?: boolean;
  clientOperationId?: string;
}) {
  return requestSession(
    "/api/preview/gi088/abort-current-task",
    jsonRequest({
      ...input,
      confirmation: true,
      clientOperationId: input.clientOperationId ??
        createGi088ClientOperationId("abort-task")
    })
  );
}

export function reviewGi088ProgramIntervention(input: {
  runId: string;
  interventionId: string;
  observationFingerprint: string;
  outcome: Gi088ProgramInterventionReviewOutcome;
  reason: string;
  clientOperationId?: string;
}) {
  return requestSession(
    "/api/preview/gi088/program-intervention-review",
    jsonRequest({
      ...input,
      clientOperationId: input.clientOperationId ??
        createGi088ClientOperationId("intervention-review")
    })
  );
}

export async function reportGi088OperationEvent(input: {
  runId: string;
  taskId?: string;
  turnId?: string;
  route: string;
  code: string;
  safeSummary?: Record<string, string | number | boolean | null>;
  clientOperationId?: string;
}) {
  return requestPayload(
    "/api/preview/gi088/operation-events",
    jsonRequest({
      ...input,
      clientOperationId: input.clientOperationId ??
        createGi088ClientOperationId("operation-event")
    })
  );
}

export const GI088_EVALUATION_EXPORT_PATH = "/api/preview/gi088/export";
export const GI088_EVALUATION_EXPORT_DEADLINE_MS = 4_500;

export async function downloadGi088EvaluationExport(input: {
  evaluationVersion: string;
  runId: string;
  completedTaskCount: number;
  totalTasks: number;
  signal?: AbortSignal;
}) {
  const path = `${GI088_EVALUATION_EXPORT_PATH}?runId=${encodeURIComponent(input.runId)}`;
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(input.signal?.reason);
  if (input.signal?.aborted) abortFromCaller();
  else input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  let deadline: number | null = null;
  const deadlineFailure = new Promise<never>((_resolve, reject) => {
    deadline = window.setTimeout(() => {
      reject(new Gi088EvaluationRequestError({
        code: "GI088_EXPORT_DOWNLOAD_UNAVAILABLE",
        message: "导出在 5 秒内未完成，请重新读取运行状态后再试。",
        retryable: true,
        dataSaved: "yes",
        impact: "run",
        action: "seal_and_export"
      }));
      controller.abort();
    }, GI088_EVALUATION_EXPORT_DEADLINE_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        const envelope = await requestPayload(path, {
          signal: controller.signal
        });
        return downloadVerifiedGi088EvaluationExport({
          envelope,
          evaluationVersion: input.evaluationVersion,
          runId: input.runId,
          completedTaskCount: input.completedTaskCount,
          totalTasks: input.totalTasks,
          signal: controller.signal
        });
      })(),
      deadlineFailure
    ]);
  } catch (error) {
    if (error instanceof Gi088ExportDownloadError) {
      throw new Gi088EvaluationRequestError({
        code: error.code,
        message: error.code === "GI088_EXPORT_VERIFICATION_FAILED"
          ? "导出收据校验失败，已停止下载。请重新读取运行状态后再试。"
          : "当前浏览器无法准备下载，请稍后重试。",
        retryable: true,
        dataSaved: "yes",
        impact: "run",
        action: "seal_and_export"
      });
    }
    throw error;
  } finally {
    if (deadline !== null) window.clearTimeout(deadline);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}
