export const GI088_EVALUATION_VERSION =
  "2026-08-10.gi088-human-eval-v7r2-ark-flash" as const;

export type Gi088GenerationProgress = {
  type: "recovery_started";
  trigger: "EMPTY_CONTENT";
  turnId: string;
  callId: string;
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

export type Gi088TaskStatus =
  | "ready"
  | "locked"
  | "active"
  | "completed"
  | "not_run";

export type Gi088TrajectoryStatus =
  | "not_started"
  | "running"
  | "technical_failure"
  | "protected_failure"
  | "completed";

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
    | null;
  retryOrdinal?: number | null;
  effectiveConfig?: {
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
    recoveryPolicyVersion?: string | null;
  };
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
      | "ASK_QUESTION_COUNT_INVALID:2";
    automaticRetryCount: number;
    initialCallId: string;
    recoveryCallId: string | null;
    manualRetryCount?: number;
    manualRetryCallId?: string | null;
    eligibleAt: string;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  questionObservation?: {
    questionMarkCount: number;
    reviewCandidate:
      | "none"
      | "zero_question_mark"
      | "multiple_question_marks";
    review: {
      classification: Gi088QuestionReviewClassification;
      note: string;
      reviewedAt: string;
    } | null;
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
};

export type Gi088TaskSummary = {
  id: string;
  capabilityId: string;
  title: string;
  instruction: string;
  targetTriggerPrompt: string;
  criterion: string;
  repeatOf: string | null;
  status: Gi088TaskStatus;
  targetTriggers: Record<Gi088BranchKey, Gi088TargetTrigger | null>;
};

export type Gi088Comparison = {
  preference: Gi088Preference;
  reason: string;
} | null;

export type Gi088EvaluationSession = {
  evaluation: {
    id: string;
    version: string;
    mode?: "paired" | "high_only";
    activeBranches?: Gi088BranchKey[];
    candidateFingerprint: string;
    executionFingerprint: string;
    model: string;
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
  } | null;
};

export type Gi088EvaluationIssue = {
  code: string;
  message: string;
  retryable: boolean;
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

export const GI088_OUTBOX_STORAGE_KEY =
  "daily-light:gi088:evaluation-outbox:v7-continuity" as const;

export type Gi088OutboxEntry = {
  version: typeof GI088_EVALUATION_VERSION;
  kind: "start_off" | "start_high" | "turn";
  batchId: string;
  taskId: string;
  branch: Gi088BranchKey;
  content: string;
  clientTurnId: string;
  createdAt: string;
};

function outboxStorage(storage?: Storage | null) {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function validOutboxEntry(value: unknown): value is Gi088OutboxEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<Gi088OutboxEntry>;
  return entry.version === GI088_EVALUATION_VERSION &&
    (entry.kind === "start_off" || entry.kind === "start_high" || entry.kind === "turn") &&
    typeof entry.batchId === "string" && entry.batchId.length > 0 &&
    typeof entry.taskId === "string" && entry.taskId.length > 0 &&
    (entry.branch === "off" || entry.branch === "high") &&
    typeof entry.content === "string" && entry.content.length > 0 &&
    typeof entry.clientTurnId === "string" && entry.clientTurnId.length > 0 &&
    typeof entry.createdAt === "string";
}

export function readGi088Outbox(storage?: Storage | null) {
  const target = outboxStorage(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(GI088_OUTBOX_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (validOutboxEntry(parsed)) return parsed;
    try {
      target.removeItem(GI088_OUTBOX_STORAGE_KEY);
    } catch {
      return null;
    }
  } catch {
    try {
      target.removeItem(GI088_OUTBOX_STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export function prepareGi088Outbox(
  input: Omit<Gi088OutboxEntry, "version" | "clientTurnId" | "createdAt">,
  storage?: Storage | null
) {
  const target = outboxStorage(storage);
  if (!target) {
    throw new Gi088EvaluationRequestError({
      code: "GI088_OUTBOX_UNAVAILABLE",
      message: "浏览器暂时无法保存待发送内容。为避免重复调用，本次请求已停止；请允许会话存储后重试。",
      retryable: false
    });
  }
  const normalizedContent = input.content.trim();
  const existing = readGi088Outbox(target);
  if (
    existing &&
    existing.kind === input.kind &&
    existing.batchId === input.batchId &&
    existing.taskId === input.taskId &&
    existing.branch === input.branch &&
    existing.content === normalizedContent
  ) {
    return existing;
  }

  const entry: Gi088OutboxEntry = {
    version: GI088_EVALUATION_VERSION,
    ...input,
    content: normalizedContent,
    clientTurnId: createGi088ClientTurnId(),
    createdAt: new Date().toISOString()
  };
  try {
    target.setItem(GI088_OUTBOX_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    throw new Gi088EvaluationRequestError({
      code: "GI088_OUTBOX_WRITE_FAILED",
      message: "待发送内容暂时无法安全保存。为避免重复调用，本次请求已停止；请释放浏览器存储空间后重试。",
      retryable: false
    });
  }
  return entry;
}

export function invalidateGi088OutboxOnContentChange(input: {
  batchId: string;
  taskId: string;
  branch: Gi088BranchKey;
  content: string;
}, storage?: Storage | null) {
  const target = outboxStorage(storage);
  const existing = readGi088Outbox(target);
  if (!existing) return;
  if (
    existing.batchId === input.batchId &&
    existing.taskId === input.taskId &&
    existing.branch === input.branch &&
    existing.content !== input.content.trim()
  ) {
    try {
      target?.removeItem(GI088_OUTBOX_STORAGE_KEY);
    } catch {
      return;
    }
  }
}

export function gi088SessionConfirmsOutbox(session: Gi088EvaluationSession, entry: Gi088OutboxEntry) {
  const task = session.activeTask;
  if (!task || task.taskId !== entry.taskId) return false;
  return task.branches[entry.branch].turns.some((turn) => turn.clientTurnId === entry.clientTurnId);
}

export function clearGi088OutboxIfConfirmed(
  session: Gi088EvaluationSession,
  entry: Gi088OutboxEntry,
  storage?: Storage | null
) {
  const target = outboxStorage(storage);
  if (!target || !gi088SessionConfirmsOutbox(session, entry)) return false;
  const current = readGi088Outbox(target);
  if (current?.clientTurnId === entry.clientTurnId) {
    try {
      target.removeItem(GI088_OUTBOX_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function readPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function issueFromPayload(payload: unknown, response: Response): Gi088EvaluationIssue {
  if (payload && typeof payload === "object") {
    const outer = payload as { error?: unknown; issue?: unknown };
    const candidate = outer.error ?? outer.issue;
    if (candidate && typeof candidate === "object") {
      const issue = candidate as { code?: unknown; message?: unknown; retryable?: unknown };
      if (typeof issue.code === "string" && typeof issue.message === "string") {
        return {
          code: issue.code,
          message: issue.message,
          retryable: typeof issue.retryable === "boolean" ? issue.retryable : response.status >= 500
        };
      }
    }
  }

  return {
    code: `GI088_HTTP_${response.status || "NETWORK"}`,
    message: "评测工作台暂时无法完成这一步。当前内容仍然保留，可以刷新后继续。",
    retryable: response.status >= 500 || response.status === 0
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
      retryable: true
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) throw new Gi088EvaluationRequestError(issueFromPayload(payload, response));
  return sessionFromPayload(payload);
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
      retryable: true
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
      retryable: true
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
    if (event.type === "recovery_started") {
      if (
        event.trigger === "EMPTY_CONTENT" &&
        typeof event.turnId === "string" &&
        typeof event.callId === "string"
      ) {
        onProgress?.({
          type: "recovery_started",
          trigger: "EMPTY_CONTENT",
          turnId: event.turnId,
          callId: event.callId
        });
      }
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
      retryable: true
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

export function getGi088EvaluationSession(taskId?: string) {
  const query = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";
  return requestSession(`/api/preview/gi088/session${query}`);
}

export function startGi088OffTrajectory(taskId: string, initialUserMessage: string, clientTurnId: string) {
  return requestSession(
    "/api/preview/gi088/start-task",
    jsonRequest({
      taskId,
      action: "start_off",
      initialUserMessage,
      clientTurnId
    })
  );
}

export function startGi088HighTrajectory(
  taskId: string,
  initialUserMessage?: string,
  clientTurnId?: string,
  onProgress?: (progress: Gi088GenerationProgress) => void
) {
  return requestStreamingSession(
    "/api/preview/gi088/start-task",
    jsonRequest({
      taskId,
      action: "start_high",
      ...(initialUserMessage === undefined
        ? {}
        : { initialUserMessage, clientTurnId })
    }),
    onProgress
  );
}

export function submitGi088Turn(input: {
  taskId: string;
  branch: Gi088BranchKey;
  content: string;
  clientTurnId?: string;
}, onProgress?: (progress: Gi088GenerationProgress) => void) {
  return requestStreamingSession(
    "/api/preview/gi088/turn",
    jsonRequest({ ...input, clientTurnId: input.clientTurnId ?? createGi088ClientTurnId() }),
    onProgress
  );
}

export function retryGi088Turn(input: {
  taskId: string;
  branch: Gi088BranchKey;
  turnId: string;
  trigger:
    | "manual"
    | "automatic_empty_content"
    | "automatic_timeout"
    | "automatic_stage_transition"
    | "manual_after_auto_recovery";
}) {
  return requestSession("/api/preview/gi088/retry", jsonRequest(input));
}

export function reviewGi088Question(input: {
  taskId: string;
  branch: Gi088BranchKey;
  turnId: string;
  classification: Gi088QuestionReviewClassification;
  note?: string;
}) {
  return requestSession(
    "/api/preview/gi088/question-review",
    jsonRequest({ ...input, note: input.note ?? "" })
  );
}

export function endGi088Trajectory(input: {
  taskId: string;
  branch: Gi088BranchKey;
  feeling: Gi088Feeling;
  quality: Gi088Quality;
  targetTrigger: Exclude<Gi088TargetTrigger, "legacy_unknown">;
  reason: string;
}) {
  return requestSession("/api/preview/gi088/end-trajectory", jsonRequest(input));
}

export function compareGi088Trajectories(input: {
  taskId: string;
  preference: Gi088Preference;
  reason: string;
}) {
  return requestSession("/api/preview/gi088/compare", jsonRequest(input));
}

export function sealGi088EvaluationBatch() {
  return requestSession("/api/preview/gi088/seal", jsonRequest({ confirmation: true }));
}

export function earlyStopGi088EvaluationBatch(input: {
  reasonCode: Gi088EarlyStopReasonCode;
  reason: string;
}) {
  return requestSession(
    "/api/preview/gi088/early-stop",
    jsonRequest({ ...input, confirmation: true })
  );
}

export const GI088_EVALUATION_EXPORT_PATH = "/api/preview/gi088/export";

export async function downloadGi088EvaluationExport(input: {
  evaluationVersion: string;
  batchId: string;
  completedTaskCount: number;
  totalTasks: number;
}) {
  let response: Response;
  try {
    response = await fetch(GI088_EVALUATION_EXPORT_PATH, {
      cache: "no-store"
    });
  } catch {
    throw new Gi088EvaluationRequestError({
      code: "GI088_EXPORT_NETWORK_UNAVAILABLE",
      message: "完整结果暂时无法下载。批次已经安全收口，可以稍后再次下载。",
      retryable: true
    });
  }
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new Gi088EvaluationRequestError(issueFromPayload(payload, response));
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${input.evaluationVersion}-${input.batchId}-${input.completedTaskCount}-of-${input.totalTasks}.json`;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
