import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_V8R3_EVALUATION_DATASET_VERSION,
  GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_CALLS_MAXIMUM,
  GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT,
  GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM,
  GI088_V8R3_FORMAL_EVALUATION_VERSION,
  GI088_V8R3_HARD_GATES,
  GI088_V8R3_LEGACY_RUNNER_VERSION,
  GI088_V8R3_RUNNER_VERSION,
  gi088V8r3BadCaseCategorySchema,
  gi088V8r3EvaluationCaseSchema,
  gi088V8r3HumanAdjudicationFileSchema,
  gi088V8r3TrialResultSchema,
  type Gi088V8r3EvaluationCase,
  type Gi088V8r3HumanAdjudicationFile,
  type Gi088V8r3JudgeCalibrationRound,
  type Gi088V8r3TrialResult
} from "./contracts";
import {
  createGi088V8r3BlindPair,
  createGi088V8r3CaseFingerprint,
  createGi088V8r3CaseSetCommitment,
  createGi088V8r3DatasetFingerprint,
  evaluateGi088V8r3HiddenQualityGate,
  evaluateGi088V8r3JudgeCalibration,
  evaluateGi088V8r3LatencyGate,
  evaluateGi088V8r3ReliabilityGate,
  getGi088V8r3ConversationAtCheckpoint,
  summarizeGi088V8r3PassSquared,
  validateGi088V8r3DatasetPartitions
} from "./runner";
import type {
  AICompletionParams,
  AICompletionResult,
  AIProvider,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAICompletionTokenUsage,
  sanitizeAIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  GI088_ARK_FLASH_RUNTIME_POLICY,
  GI088_DEEPSEEK_PRO_RUNTIME_POLICY,
  GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION,
  GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION_VERSION,
  GI088_MODEL_CALL_IDENTITY,
  GI088_TECHNICAL_CORRECTION_RECOVERY_POLICY,
  GI088_TIMEOUT_POLICY,
  createGi088EffectiveCandidateFingerprint,
  createGi088FingerprintBundle,
  getGi088CandidateAssets
} from "@/server/services/evaluation/gi088/candidate";
import { createGi088OutputSchemaIssues } from "@/server/services/evaluation/gi088/schema-diagnostics";
import { applyGi088SingleFocusValidationPolicy } from "@/server/services/evaluation/gi088/single-focus";
import {
  applyGi088SemanticDeltaValidatedResult,
  assertGi088SemanticDeltaOutput,
  parseGi088SemanticDeltaCandidateOutput,
  toBoard7bWorkingTaskV1CompatibilityOutput,
  validateGi088SemanticDeltaOutput,
  type Gi088SemanticDeltaOutput
} from "@/server/services/evaluation/gi088/semantic-delta";
import { normalizeGi088DeterministicStateOutput } from "@/server/services/evaluation/gi088/deterministic-state";
import {
  createGi088StageTransitionUserPrompt,
  validateGi088StageTransitionOutput
} from "@/server/services/evaluation/gi088/stage-transition";
import {
  GI088_V8R3_INTERVIEW_SKILL_SHA256,
  GI088_V8R3_INTERVIEW_SKILL_VERSION
} from "@/server/services/evaluation/gi088/v8r3-interview-skill";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const GI088_V8R3_OFFLINE_EXECUTOR_VERSION =
  "2026-08-11.gi088-v8r3-offline-executor-v7" as const;
export const GI088_V8R3_LEGACY_OFFLINE_EXECUTOR_VERSION =
  "2026-08-11.gi088-v8r3-offline-executor-v6" as const;

export const GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE =
  "empty_content_diagnostic" as const;

export const GI088_V8R3_FORMAL_CALL_BUDGET = {
  deterministicRegressionCalls: 0,
  candidateDevelopmentInitialCalls: 64,
  candidateHiddenInitialCalls: 32,
  candidateInitialCalls: 96,
  candidateAutomaticRecoveryCallsMaximum: 2,
  candidateCallsMaximum: 98,
  judgeCalibrationCalls: 40,
  judgeDevelopmentPrescreenCallsMaximum: 56,
  judgeHiddenCallsMaximum: 0,
  judgeCallsMaximum: 96,
  completeFormalFlowCallsMaximum: 194
} as const;

export const GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_BUDGET = {
  initialCalls: 96,
  recoveryCallsMaximum:
    GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM,
  callsMaximum: GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_CALLS_MAXIMUM,
  maxRetriesPerCheckpoint:
    GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT
} as const;

export const GI088_V8R3_OFFLINE_PRIVACY_CONTRACT = {
  apiKey: "excluded",
  requestBody: "excluded",
  systemPrompt: "hash_only",
  sourceConversation: "fingerprint_only",
  rawModelOutput: "excluded",
  visibleModelOutput: "included",
  hiddenReasoningBody: "excluded",
  providerRequestId: "hash_only"
} as const;

export type Gi088V8r3ProviderIdentity = {
  adapter: "openai";
  providerName: "openai";
  provider: "volcengine_ark" | "deepseek_official";
  transport: "openai_compatible_rest";
  baseUrlHost: string;
  endpoint: string;
  model: string;
  payloadContractVersion: string;
};

export type Gi088V8r3CandidateExecutionMode =
  | "formal"
  | typeof GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE;

export type Gi088V8r3EmptyContentCheckpointDiagnostic = {
  caseId: string;
  trialAttempt: 1 | 2;
  checkpointIndex: number;
  initialEmptyContent: boolean;
  emptyContentRecoveryAttemptCount: number;
  recoverySuccessAttempt: number | null;
  emptyContentExhausted: boolean;
  recoveryBudgetExhausted: boolean;
  finalEmptyContent: boolean;
  cumulativeLatencyMs: number | null;
};

export type Gi088V8r3EmptyContentDiagnosticReport = {
  mode: typeof GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE;
  maxRetriesPerCheckpoint: typeof GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT;
  globalRecoveryCallsMaximum: typeof GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM;
  checkpoints: Gi088V8r3EmptyContentCheckpointDiagnostic[];
  summary: {
    emptyContentInitialCount: number;
    emptyContentTriggerCount: number;
    emptyContentRecoveryAttemptCount: number;
    emptyContentRecoverySuccessCount: number;
    emptyContentRecoveredCheckpointCount: number;
    successAtAttempt1: number;
    successAtAttempt2: number;
    successAtAttempt3: number;
    finalEmptyContentCount: number;
    recoveryBudgetExhaustedCount: number;
    finalVisibleCompletionRate: number | null;
    visibleLatencySamplesMs: number[];
    visibleLatencyP50Ms: number | null;
    visibleLatencyP90Ms: number | null;
    visibleLatencyMaxMs: number | null;
    totalRecoveryCalls: number;
  };
};

export type Gi088V8r3CandidateRecoveryTrigger =
  | "EMPTY_CONTENT"
  | "TIMEOUT"
  | "OUTPUT_SCHEMA_INVALID"
  | "SEMANTIC_VALIDATION_FAILED"
  | "STATE_TRANSITION_INVALID";

function candidateRecoveryCorrection(
  trigger: Gi088V8r3CandidateRecoveryTrigger
) {
  if (trigger === "EMPTY_CONTENT") {
    return {
      version: GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION_VERSION,
      instruction: GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION
    } as const;
  }
  return GI088_TECHNICAL_CORRECTION_RECOVERY_POLICY.corrections[trigger];
}

export function createGi088V8r3ArkProviderIdentity(): Gi088V8r3ProviderIdentity {
  return {
    adapter: "openai",
    providerName: "openai",
    provider: GI088_ARK_FLASH_RUNTIME_POLICY.provider,
    transport: GI088_ARK_FLASH_RUNTIME_POLICY.transport,
    baseUrlHost: GI088_ARK_FLASH_RUNTIME_POLICY.baseUrlHost,
    endpoint: GI088_ARK_FLASH_RUNTIME_POLICY.endpoint,
    model: GI088_ARK_FLASH_RUNTIME_POLICY.model,
    payloadContractVersion:
      GI088_ARK_FLASH_RUNTIME_POLICY.payloadContractVersion
  };
}

export function createGi088V8r3ProProviderIdentity(): Gi088V8r3ProviderIdentity {
  return {
    adapter: "openai",
    providerName: "openai",
    provider: "deepseek_official",
    transport: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.transport,
    baseUrlHost: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.baseUrlHost,
    endpoint: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.endpoint,
    model: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.model,
    payloadContractVersion: "deepseek-chat-completions-thinking-high-v1"
  };
}

function assertProviderIdentity(input: {
  provider: AIProvider;
  identity: Gi088V8r3ProviderIdentity;
  expected: Gi088V8r3ProviderIdentity;
}) {
  if (
    input.provider.name !== input.identity.providerName ||
    JSON.stringify(input.identity) !== JSON.stringify(input.expected)
  ) {
    throw new Error("GI088_V8R3_PROVIDER_IDENTITY_MISMATCH");
  }
}

export type Gi088V8r3SafeProviderTrace = {
  latencyMs: number | null;
  finishReason: AIProviderDiagnostics["finishReason"];
  reasoningPresent: boolean | null;
  reasoningLength: number | null;
  reasoningTokens: number | null;
  tokenUsage: ReturnType<typeof sanitizeAICompletionTokenUsage>;
  httpStatus: number | null;
  responseModel: string | null;
  choiceCount: number | null;
  contentLength: number | null;
  headersLatencyMs: number | null;
  bodyLatencyMs: number | null;
  totalLatencyMs: number | null;
  timeoutStage: AIProviderDiagnostics["timeoutStage"];
  abortSource: AIProviderDiagnostics["abortSource"];
  upstreamRequestIdHash: string | null;
};

export type Gi088V8r3CandidateCallRecord = {
  callId: string;
  kind: "initial" | "automatic_recovery";
  appliedRecoveryTrigger: Gi088V8r3CandidateRecoveryTrigger | null;
  recoveryAttempt?: number;
  checkpointIndex: number;
  requestHash: string;
  status: "valid" | "protected_failure" | "technical_failure";
  errorCode: string | null;
  validationIssues: string[];
  responseHash: string | null;
  safeTrace: Gi088V8r3SafeProviderTrace;
  startedAt: string;
  completedAt: string;
};

export type Gi088V8r3CandidateCheckpointRecord = {
  checkpointIndex: number;
  afterUserMessageId: string;
  inputFingerprint: string;
  status: Gi088V8r3CandidateCallRecord["status"];
  action: "acknowledge" | "ask" | "synthesize" | "pause" | null;
  visibleUnderstanding: string | null;
  visibleResponse: string | null;
  calls: Gi088V8r3CandidateCallRecord[];
  automaticRecoveryCount: number;
  recoveryBudgetExhausted?: boolean;
  submitToVisibleLatencyMs: number | null;
};

export type Gi088V8r3CandidateTrialRecord = {
  caseId: string;
  partition: Gi088V8r3EvaluationCase["partition"];
  kind: Gi088V8r3EvaluationCase["kind"];
  attempt: 1 | 2;
  inputFingerprint: string;
  status: Gi088V8r3CandidateCallRecord["status"];
  action: "acknowledge" | "ask" | "synthesize" | "pause" | null;
  visibleUnderstanding: string | null;
  visibleResponse: string | null;
  calls: Gi088V8r3CandidateCallRecord[];
  checkpoints: Gi088V8r3CandidateCheckpointRecord[];
  automaticRecoveryCount: number;
  submitToVisibleLatencyMs: number | null;
  reviewStatus: "pending_human_review";
};

export type Gi088V8r3CandidateExecutionReport = {
  reportVersion:
    | typeof GI088_V8R3_OFFLINE_EXECUTOR_VERSION
    | typeof GI088_V8R3_LEGACY_OFFLINE_EXECUTOR_VERSION;
  formalEvaluationVersion: typeof GI088_V8R3_FORMAL_EVALUATION_VERSION;
  runId: string;
  createdAt: string;
  datasetVersion: typeof GI088_V8R3_EVALUATION_DATASET_VERSION;
  runnerVersion:
    | typeof GI088_V8R3_RUNNER_VERSION
    | typeof GI088_V8R3_LEGACY_RUNNER_VERSION;
  behaviorFingerprintBundle: ReturnType<typeof createGi088FingerprintBundle>;
  candidateFingerprint: string;
  datasetFingerprint: string;
  offlineRunFingerprint: string;
  evidenceFingerprint: string;
  privateInputs: {
    hiddenFileSha256: string;
    hiddenAggregateCommitment: string;
  };
  executionConfig: {
    concurrency: number;
    automaticRecoveryMaximum: number;
    recoveryMode?: Gi088V8r3CandidateExecutionMode;
    emptyContentRecoveryMaximumPerCheckpoint?: number;
  };
  runtime: Gi088V8r3ProviderIdentity & {
    thinking: "enabled";
    reasoningEffort: "high";
    responseFormat: "json_object";
    headersTimeoutMs: 60_000;
    bodyIdleTimeoutMs: 60_000;
    hardTimeoutMs: 60_000;
    skillVersion: typeof GI088_V8R3_INTERVIEW_SKILL_VERSION;
    skillSha256: typeof GI088_V8R3_INTERVIEW_SKILL_SHA256;
  };
  privacy: typeof GI088_V8R3_OFFLINE_PRIVACY_CONTRACT;
  budget: {
    authorizedMaximum: number;
    initialCalls: number;
    automaticRecoveryCalls: number;
    totalCalls: number;
  };
  deterministicRegression: {
    caseCount: number;
    modelGenerationCalls: 0;
    validatorAssertionCount: number;
    passed: boolean;
    caseIds: string[];
  };
  operationalLedger: {
    eligibleSubmissionCount: number;
    firstValidCount: number;
    firstValidRate: number | null;
    automaticRecoveryAttemptCount: number;
    automaticRecoverySuccessCount: number;
    finalFailureCount: number;
    manualRecoveryCount: 0;
    finalProtectionCount: number;
    duplicateMessageCount: number;
    pendingTurnCount: number;
    submitToVisibleLatencySamplesMs: number[];
    completedCallLatencySamplesMs: number[];
  };
  emptyContentDiagnostics?: Gi088V8r3EmptyContentDiagnosticReport;
  records: Gi088V8r3CandidateTrialRecord[];
};

export function createGi088V8r3OfflineExecutionPlan() {
  return {
    version: GI088_V8R3_OFFLINE_EXECUTOR_VERSION,
    formalEvaluationVersion: GI088_V8R3_FORMAL_EVALUATION_VERSION,
    executionAuthorized: false,
    externalModelCalls: 0,
    candidate: {
      runtime: {
        ...createGi088V8r3ArkProviderIdentity(),
        thinking: "enabled",
        reasoningEffort: "high",
        responseFormat: "json_object",
        headersTimeoutMs: 60_000,
        bodyIdleTimeoutMs: 60_000,
        hardTimeoutMs: 60_000
      },
      developmentResults: 56,
      developmentCheckpointCalls: 64,
      hiddenResults: 24,
      hiddenCheckpointCalls: 32
    },
    judge: {
      ...createGi088V8r3ProProviderIdentity(),
      calibrationGoldenRounds: 2,
      calibrationSamplesPerRound: 20,
      requiresPromotionBeforeDevelopmentPrescreen: true,
      hiddenAutomaticJudgement: "forbidden"
    },
    callBudget: GI088_V8R3_FORMAL_CALL_BUDGET,
    emptyContentDiagnostic: GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_BUDGET,
    privacy: GI088_V8R3_OFFLINE_PRIVACY_CONTRACT
  } as const;
}

function safeCode(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.split(":", 1)[0]?.trim().toUpperCase();
  return normalized && /^[A-Z][A-Z0-9_]{0,127}$/u.test(normalized)
    ? normalized
    : fallback;
}

function safeValidationIssue(value: string) {
  if (
    /^OUTPUT_SCHEMA_INVALID(?::(?:\$|[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*){0,11}):[a-z_]+)?$/u.test(
      value
    )
  ) {
    return value;
  }
  return safeCode(value, "VALIDATION_ISSUE");
}

function safeTrace(
  completion: AICompletionResult | null,
  diagnosticsInput?: AIProviderDiagnostics | null
): Gi088V8r3SafeProviderTrace {
  const diagnostics = sanitizeAIProviderDiagnostics(
    completion?.diagnostics ?? diagnosticsInput ?? null
  );
  const upstreamRequestId = diagnostics?.upstreamRequestId ?? null;
  return {
    latencyMs: completion?.latencyMs ?? diagnostics?.latencyMs ?? null,
    finishReason: diagnostics?.finishReason ?? null,
    reasoningPresent: diagnostics?.reasoningPresent ?? null,
    reasoningLength: diagnostics?.reasoningLength ?? null,
    reasoningTokens: diagnostics?.reasoningTokens ?? null,
    tokenUsage: sanitizeAICompletionTokenUsage(
      completion?.tokenUsage ?? diagnostics?.tokenUsage
    ),
    httpStatus: diagnostics?.httpStatus ?? null,
    responseModel: diagnostics?.responseModel ?? null,
    choiceCount: diagnostics?.choiceCount ?? null,
    contentLength:
      diagnostics?.contentLength ??
      (completion ? completion.content.length : null),
    headersLatencyMs: diagnostics?.headersLatencyMs ?? null,
    bodyLatencyMs: diagnostics?.bodyLatencyMs ?? null,
    totalLatencyMs:
      diagnostics?.totalLatencyMs ?? completion?.latencyMs ?? null,
    timeoutStage: diagnostics?.timeoutStage ?? null,
    abortSource: diagnostics?.abortSource ?? null,
    upstreamRequestIdHash: upstreamRequestId ? sha256(upstreamRequestId) : null
  };
}

export function createGi088V8r3OfflineTurnInput(
  evaluationCase: Gi088V8r3EvaluationCase,
  checkpointIndex = evaluationCase.checkpoints.length - 1
): Board7bWorkingTaskV1TurnInput {
  const parsed = gi088V8r3EvaluationCaseSchema.parse(evaluationCase);
  const conversation = getGi088V8r3ConversationAtCheckpoint(
    parsed,
    checkpointIndex
  );
  const latestUserMessage = [...conversation]
    .reverse()
    .find((message) => message.role === "user");
  if (!latestUserMessage) throw new Error("GI088_V8R3_LATEST_USER_MISSING");
  const priorUserMessageIds = conversation
    .filter(
      (message) =>
        message.role === "user" && message.id !== latestUserMessage.id
    )
    .map((message) => message.id);
  const initial = createBoard7bWorkingTaskV1InitialSemanticState();
  const taskRef = `task-${sha256(parsed.id).slice(0, 16)}`;
  return {
    mode: "accompany_chat",
    conversation,
    latestUserMessageId: latestUserMessage.id,
    semanticState: {
      ...initial,
      stage: "explore_clarify",
      workingTask: {
        taskRef,
        summary: parsed.workingTask,
        evidenceRefs:
          priorUserMessageIds.length > 0
            ? priorUserMessageIds
            : [latestUserMessage.id]
      },
      answerOpportunities: {
        currentTaskRef: taskRef,
        ledgers: [
          {
            taskRef,
            stage1Used: 1,
            stage2Used: 0,
            awaiting: null
          }
        ]
      }
    }
  };
}

function controlActionForCheckpoint(
  evaluationCase: Gi088V8r3EvaluationCase,
  checkpointIndex: number
) {
  const checkpoint = evaluationCase.checkpoints[checkpointIndex]!;
  return checkpoint.allowedActions.length === 1 &&
    checkpoint.allowedActions[0] === "pause"
    ? "stop_follow_up" as const
    : "none" as const;
}

export function createGi088V8r3CandidateCompletionParams(input: {
  evaluationCase: Gi088V8r3EvaluationCase;
  checkpointIndex?: number;
  recovery: boolean;
  recoveryTrigger?: Gi088V8r3CandidateRecoveryTrigger | null;
}): AICompletionParams {
  const checkpointIndex =
    input.checkpointIndex ?? input.evaluationCase.checkpoints.length - 1;
  const turnInput = createGi088V8r3OfflineTurnInput(
    input.evaluationCase,
    checkpointIndex
  );
  const controlAction = controlActionForCheckpoint(
    input.evaluationCase,
    checkpointIndex
  );
  return {
    messages: [
      { role: "system", content: getGi088CandidateAssets().systemPrompt },
      {
        role: "system",
        content: `本轮程序控制决定：${JSON.stringify({
          finalAction: controlAction,
          decisionVersion: "2026-08-11.gi088-v8r3-offline-control-v2"
        })}`
      },
      ...(input.recovery
        ? [
            {
              role: "system" as const,
              content: input.recoveryTrigger
                ? candidateRecoveryCorrection(input.recoveryTrigger).instruction
                : "上次调用发生技术失败。使用同一段可见对话重新生成一次最终 JSON；保持当前共同任务、问题价值条件和单一回答目标。"
            }
          ]
        : []),
      {
        role: "user",
        content: createGi088StageTransitionUserPrompt(turnInput)
      }
    ],
    useProviderDefaultMaxTokens: true,
    timeoutMs: 60_000,
    headersTimeoutMs: 60_000,
    bodyIdleTimeoutMs: 60_000,
    hardTimeoutMs: 60_000,
    responseFormat: "json_object",
    thinking: "enabled",
    reasoningEffort: "high"
  };
}

class CandidateCallBudget {
  readonly maximum: number;
  readonly recoveryMaximum: number;
  total = 0;
  initial = 0;
  recovery = 0;

  constructor(initialMaximum: number, recoveryMaximum: number) {
    this.maximum = initialMaximum + recoveryMaximum;
    this.recoveryMaximum = recoveryMaximum;
  }

  reserve(kind: "initial" | "automatic_recovery") {
    if (kind === "automatic_recovery" && this.recovery >= this.recoveryMaximum) {
      return false;
    }
    if (this.total >= this.maximum) {
      throw new Error("GI088_V8R3_CANDIDATE_CALL_BUDGET_EXHAUSTED");
    }
    this.total += 1;
    if (kind === "initial") this.initial += 1;
    else this.recovery += 1;
    return true;
  }
}

export function createGi088V8r3CandidateRequestHashPayload(input: {
  evaluationCase: Gi088V8r3EvaluationCase;
  checkpointIndex: number;
  attempt: 1 | 2;
  kind: "initial" | "automatic_recovery";
  recoveryTrigger?: Gi088V8r3CandidateRecoveryTrigger | null;
  recoveryAttempt?: number;
}) {
  const runtimeIdentity = createGi088V8r3ArkProviderIdentity();
  const recoveryCorrection = input.recoveryTrigger
    ? candidateRecoveryCorrection(input.recoveryTrigger)
    : null;
  const recoveryAttempt =
    input.recoveryAttempt ?? (input.kind === "automatic_recovery" ? 1 : 0);
  return {
    identity: GI088_MODEL_CALL_IDENTITY,
    transport: runtimeIdentity.transport,
    candidateFingerprint: createGi088EffectiveCandidateFingerprint(),
    inputFingerprint: createGi088V8r3CaseFingerprint(input.evaluationCase),
    caseId: input.evaluationCase.id,
    checkpointIndex: input.checkpointIndex,
    attempt: input.attempt,
    kind: input.kind,
    recoveryAttempt,
    recoveryTrigger: input.recoveryTrigger ?? null,
    recoveryInstructionVersion: recoveryCorrection?.version ?? null,
    timeoutPolicy: GI088_TIMEOUT_POLICY
  };
}

export function createGi088V8r3CandidateRequestHash(
  input: Parameters<typeof createGi088V8r3CandidateRequestHashPayload>[0]
) {
  return sha256(
    JSON.stringify(createGi088V8r3CandidateRequestHashPayload(input))
  );
}

export function validateGi088V8r3CandidateOutput(input: {
  content: string;
  turnInput: Board7bWorkingTaskV1TurnInput;
  controlDecisionFinalAction: "none" | "stop_follow_up";
}): {
  output: Gi088SemanticDeltaOutput | null;
  validationIssues: string[];
  recoveryTrigger: Exclude<
    Gi088V8r3CandidateRecoveryTrigger,
    "TIMEOUT"
  > | null;
} {
  let output: Gi088SemanticDeltaOutput;
  try {
    const parsed = parseGi088SemanticDeltaCandidateOutput(input.content);
    const normalized = normalizeGi088DeterministicStateOutput({
      turnInput: input.turnInput,
      output: parsed
    });
    output = assertGi088SemanticDeltaOutput(normalized.output);
  } catch (error) {
    return {
      output: null,
      validationIssues: createGi088OutputSchemaIssues(error),
      recoveryTrigger: "OUTPUT_SCHEMA_INVALID"
    };
  }

  const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
    input.turnInput,
    output
  );
  const semanticIssues = validateGi088SemanticDeltaOutput({
    input: input.turnInput,
    output,
    deterministicStateMaintenance: true,
    controlDecisionFinalAction: input.controlDecisionFinalAction
  });
  const validationIssues = [
    ...applyGi088SingleFocusValidationPolicy({
      output: compatibility,
      issues: semanticIssues
    }),
    ...validateGi088StageTransitionOutput({
      input: input.turnInput,
      output: compatibility
    })
  ];
  const distinctIssues = [...new Set(validationIssues)];
  if (distinctIssues.length > 0) {
    return {
      output: null,
      validationIssues: distinctIssues,
      recoveryTrigger: "SEMANTIC_VALIDATION_FAILED"
    };
  }

  try {
    applyGi088SemanticDeltaValidatedResult({
      input: input.turnInput,
      output
    });
  } catch {
    return {
      output: null,
      validationIssues: ["STATE_TRANSITION_INVALID"],
      recoveryTrigger: "STATE_TRANSITION_INVALID"
    };
  }

  return { output, validationIssues: [], recoveryTrigger: null };
}

async function executeCandidateCall(input: {
  provider: AIProvider;
  evaluationCase: Gi088V8r3EvaluationCase;
  checkpointIndex: number;
  attempt: 1 | 2;
  kind: "initial" | "automatic_recovery";
  recoveryAttempt: number;
  recoveryTrigger?: Gi088V8r3CandidateRecoveryTrigger | null;
  now: () => Date;
}) {
  const requestHash = createGi088V8r3CandidateRequestHash(input);
  const callId = `call-${requestHash.slice(0, 20)}`;
  const startedAt = input.now().toISOString();
  let completion: AICompletionResult;
  try {
    completion = await input.provider.complete(
      createGi088V8r3CandidateCompletionParams({
        evaluationCase: input.evaluationCase,
        checkpointIndex: input.checkpointIndex,
        recovery: input.kind === "automatic_recovery",
        recoveryTrigger: input.recoveryTrigger
      })
    );
  } catch (error) {
    const failureCode = safeCode(
      getAIProviderFailureCode(error),
      "PROVIDER_FAILURE"
    );
    const emptyContentFailure = failureCode === "EMPTY_CONTENT";
    return {
      call: {
        callId,
        kind: input.kind,
        appliedRecoveryTrigger: input.recoveryTrigger ?? null,
        recoveryAttempt: input.recoveryAttempt,
        checkpointIndex: input.checkpointIndex,
        requestHash,
        status: emptyContentFailure
          ? ("protected_failure" as const)
          : ("technical_failure" as const),
        errorCode: failureCode,
        validationIssues: [],
        responseHash: null,
        safeTrace: safeTrace(null, getAIProviderDiagnostics(error)),
        startedAt,
        completedAt: input.now().toISOString()
      },
      visible: null,
      action: null,
      recoveryTrigger:
        emptyContentFailure
          ? ("EMPTY_CONTENT" as const)
          : failureCode === "TIMEOUT"
            ? ("TIMEOUT" as const)
            : null
    };
  }
  if (completion.content.trim().length === 0) {
    return {
      call: {
        callId,
        kind: input.kind,
        appliedRecoveryTrigger: input.recoveryTrigger ?? null,
        recoveryAttempt: input.recoveryAttempt,
        checkpointIndex: input.checkpointIndex,
        requestHash,
        status: "protected_failure" as const,
        errorCode: "EMPTY_CONTENT",
        validationIssues: [],
        responseHash: null,
        safeTrace: safeTrace(completion),
        startedAt,
        completedAt: input.now().toISOString()
      },
      visible: null,
      action: null,
      recoveryTrigger: "EMPTY_CONTENT" as const
    };
  }
  const validated = validateGi088V8r3CandidateOutput({
    content: completion.content,
    turnInput: createGi088V8r3OfflineTurnInput(
      input.evaluationCase,
      input.checkpointIndex
    ),
    controlDecisionFinalAction: controlActionForCheckpoint(
      input.evaluationCase,
      input.checkpointIndex
    )
  });
  const issues = validated.validationIssues.map(safeValidationIssue);
  return {
    call: {
      callId,
      kind: input.kind,
      appliedRecoveryTrigger: input.recoveryTrigger ?? null,
      recoveryAttempt: input.recoveryAttempt,
      checkpointIndex: input.checkpointIndex,
      requestHash,
      status: issues.length ? "protected_failure" as const : "valid" as const,
      errorCode: issues.length ? "MODEL_OUTPUT_PROTECTED" : null,
      validationIssues: [...new Set(issues)],
      responseHash: completion.content ? sha256(completion.content) : null,
      safeTrace: safeTrace(completion),
      startedAt,
      completedAt: input.now().toISOString()
    },
    visible: validated.output?.visible ?? null,
    action: validated.output?.semantic.action ?? null,
    recoveryTrigger: validated.recoveryTrigger
  };
}

async function executeCandidateCheckpoint(input: {
  provider: AIProvider;
  evaluationCase: Gi088V8r3EvaluationCase;
  checkpointIndex: number;
  attempt: 1 | 2;
  budget: CandidateCallBudget;
  emptyContentRecoveryMaximumPerCheckpoint: number;
  now: () => Date;
}): Promise<Gi088V8r3CandidateCheckpointRecord> {
  input.budget.reserve("initial");
  const initial = await executeCandidateCall({
    ...input,
    kind: "initial",
    recoveryAttempt: 0
  });
  const calls = [initial.call];
  let final = initial;
  let recoveryAttempt = 0;
  let recoveryBudgetExhausted = false;
  while (final.recoveryTrigger) {
    const trigger = final.recoveryTrigger;
    const canRetryTrigger =
      trigger === "EMPTY_CONTENT"
        ? recoveryAttempt < input.emptyContentRecoveryMaximumPerCheckpoint
        : recoveryAttempt < 1;
    if (!canRetryTrigger) break;
    if (!input.budget.reserve("automatic_recovery")) {
      recoveryBudgetExhausted = true;
      break;
    }
    recoveryAttempt += 1;
    final = await executeCandidateCall({
      ...input,
      kind: "automatic_recovery",
      recoveryAttempt,
      recoveryTrigger: trigger
    });
    calls.push(final.call);
    if (trigger !== "EMPTY_CONTENT") break;
  }
  const checkpoint = input.evaluationCase.checkpoints[input.checkpointIndex]!;
  return {
    checkpointIndex: input.checkpointIndex,
    afterUserMessageId: checkpoint.afterUserMessageId,
    inputFingerprint: sha256(
      `${createGi088V8r3CaseFingerprint(input.evaluationCase)}:${input.checkpointIndex}`
    ),
    status: final.call.status,
    action: final.action,
    visibleUnderstanding: final.visible?.understanding ?? null,
    visibleResponse: final.visible?.response ?? null,
    calls,
    automaticRecoveryCount: calls.filter(
      (call) => call.kind === "automatic_recovery"
    ).length,
    recoveryBudgetExhausted,
    submitToVisibleLatencyMs:
      final.call.status === "valid" &&
      calls.every((call) => call.safeTrace.latencyMs !== null)
        ? calls.reduce((total, call) => total + (call.safeTrace.latencyMs ?? 0), 0)
        : null
  };
}

async function executeCandidateTrial(input: {
  provider: AIProvider;
  evaluationCase: Gi088V8r3EvaluationCase;
  attempt: 1 | 2;
  budget: CandidateCallBudget;
  emptyContentRecoveryMaximumPerCheckpoint: number;
  now: () => Date;
}): Promise<Gi088V8r3CandidateTrialRecord> {
  const checkpoints: Gi088V8r3CandidateCheckpointRecord[] = [];
  for (
    let checkpointIndex = 0;
    checkpointIndex < input.evaluationCase.checkpoints.length;
    checkpointIndex += 1
  ) {
    checkpoints.push(
      await executeCandidateCheckpoint({ ...input, checkpointIndex })
    );
  }
  const calls = checkpoints.flatMap((checkpoint) => checkpoint.calls);
  const final = checkpoints.at(-1)!;
  const status = checkpoints.some(
    (checkpoint) => checkpoint.status === "technical_failure"
  )
    ? "technical_failure"
    : checkpoints.some((checkpoint) => checkpoint.status === "protected_failure")
      ? "protected_failure"
      : "valid";
  const latencySamples = checkpoints.flatMap((checkpoint) =>
    checkpoint.submitToVisibleLatencyMs === null
      ? []
      : [checkpoint.submitToVisibleLatencyMs]
  );
  return {
    caseId: input.evaluationCase.id,
    partition: input.evaluationCase.partition,
    kind: input.evaluationCase.kind,
    attempt: input.attempt,
    inputFingerprint: createGi088V8r3CaseFingerprint(input.evaluationCase),
    status,
    action: final.action,
    visibleUnderstanding: final.visibleUnderstanding,
    visibleResponse: final.visibleResponse,
    calls,
    checkpoints,
    automaticRecoveryCount: checkpoints.reduce(
      (total, checkpoint) => total + checkpoint.automaticRecoveryCount,
      0
    ),
    submitToVisibleLatencyMs:
      latencySamples.length === checkpoints.length
        ? latencySamples.reduce((total, latency) => total + latency, 0)
        : null,
    reviewStatus: "pending_human_review"
  };
}

async function mapWithConcurrency<T, R>(input: {
  items: readonly T[];
  concurrency: number;
  run: (item: T) => Promise<R>;
}) {
  const results = new Array<R>(input.items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < input.items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await input.run(input.items[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(input.concurrency, input.items.length) }, worker)
  );
  return results;
}

function deterministicOutput(
  evaluationCase: Gi088V8r3EvaluationCase,
  checkpointIndex: number,
  turnInput: Board7bWorkingTaskV1TurnInput
): Gi088SemanticDeltaOutput {
  const checkpoint = evaluationCase.checkpoints[checkpointIndex]!;
  const action = checkpoint.allowedActions[0]!;
  const asks = action === "ask";
  const pauses = action === "pause";
  return {
    semantic: {
      stage: "explore_clarify",
      action,
      workingTask: {
        continuity: "continue",
        targetRef: turnInput.semanticState.workingTask!.taskRef,
        summary: evaluationCase.workingTask,
        evidenceRefs: [turnInput.latestUserMessageId]
      },
      understandingChange:
        action === "synthesize"
          ? {
              kind: "add",
              summary: "本轮已经形成一条可被后续纠正的具体认识",
              evidenceRefs: [turnInput.latestUserMessageId]
            }
          : { kind: "none" },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: asks
        ? {
            answerTarget: "补充一个能够推进当前共同任务的具体线索",
            taskEffect: "用新线索更新当前共同任务",
            evidenceRefs: [turnInput.latestUserMessageId]
          }
        : null,
      answerOpportunity: asks ? "new" : null,
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: pauses ? "用户明确要求停止当前访谈" : null
    },
    visible: {
      understanding: "我会继续围绕你刚才确认的重点。",
      response: asks
        ? "你愿意先补充一个最能帮助我们弄清当前问题的具体线索吗？"
        : pauses
          ? "好，我们先停在这里。"
          : "已经确认的重点会保留下来。"
    }
  };
}

export function runGi088V8r3DeterministicRegression(
  cases: readonly Gi088V8r3EvaluationCase[]
) {
  const parsed = cases.map((evaluationCase) =>
    gi088V8r3EvaluationCaseSchema.parse(evaluationCase)
  );
  let validatorAssertionCount = 0;
  const caseResults = parsed.map((evaluationCase) => {
    if (
      evaluationCase.partition !== "deterministic_regression" ||
      evaluationCase.kind !== "single_turn" ||
      evaluationCase.checkpoints.length !== 1
    ) {
      return { caseId: evaluationCase.id, issues: ["REGRESSION_SHAPE_INVALID"] };
    }
    const turnInput = createGi088V8r3OfflineTurnInput(evaluationCase, 0);
    const output = deterministicOutput(evaluationCase, 0, turnInput);
    const compatibility = toBoard7bWorkingTaskV1CompatibilityOutput(
      turnInput,
      output
    );
    const semanticIssues = validateGi088SemanticDeltaOutput({
      input: turnInput,
      output,
      deterministicStateMaintenance: true,
      controlDecisionFinalAction: controlActionForCheckpoint(evaluationCase, 0)
    });
    validatorAssertionCount += 1;
    const singleFocusIssues = applyGi088SingleFocusValidationPolicy({
      output: compatibility,
      issues: semanticIssues
    });
    validatorAssertionCount += 1;
    const stageIssues = validateGi088StageTransitionOutput({
      input: turnInput,
      output: compatibility
    });
    validatorAssertionCount += 1;
    return {
      caseId: evaluationCase.id,
      issues: [...new Set([...singleFocusIssues, ...stageIssues])]
    };
  });
  return {
    caseCount: parsed.length,
    modelGenerationCalls: 0 as const,
    validatorAssertionCount,
    passed: parsed.length === 24 && caseResults.every((item) => item.issues.length === 0),
    caseIds: parsed.map((evaluationCase) => evaluationCase.id),
    failures: caseResults.filter((item) => item.issues.length > 0)
  };
}

function countInitialCalls(cases: readonly Gi088V8r3EvaluationCase[]) {
  return cases.reduce(
    (total, evaluationCase) => total + evaluationCase.checkpoints.length * 2,
    0
  );
}

function buildOperationalLedger(records: readonly Gi088V8r3CandidateTrialRecord[]) {
  const checkpoints = records.flatMap((record) => record.checkpoints);
  const logicalKeys = records.flatMap((record) =>
    record.checkpoints.map(
      (checkpoint) =>
        `${record.caseId}:${record.attempt}:${checkpoint.checkpointIndex}`
    )
  );
  const distinctLogicalKeys = new Set(logicalKeys);
  const firstValidCount = checkpoints.filter(
    (checkpoint) => checkpoint.calls[0]?.status === "valid"
  ).length;
  return {
    eligibleSubmissionCount: checkpoints.length,
    firstValidCount,
    firstValidRate:
      checkpoints.length > 0 ? firstValidCount / checkpoints.length : null,
    automaticRecoveryAttemptCount: checkpoints.reduce(
      (total, checkpoint) => total + checkpoint.automaticRecoveryCount,
      0
    ),
    automaticRecoverySuccessCount: checkpoints.filter(
      (checkpoint) =>
        checkpoint.automaticRecoveryCount > 0 && checkpoint.status === "valid"
    ).length,
    finalFailureCount: checkpoints.filter(
      (checkpoint) => checkpoint.status !== "valid"
    ).length,
    manualRecoveryCount: 0 as const,
    finalProtectionCount: checkpoints.filter(
      (checkpoint) => checkpoint.status === "protected_failure"
    ).length,
    duplicateMessageCount: logicalKeys.length - distinctLogicalKeys.size,
    pendingTurnCount: checkpoints.filter((checkpoint) => checkpoint.calls.length === 0).length,
    submitToVisibleLatencySamplesMs: checkpoints.flatMap((checkpoint) =>
      checkpoint.submitToVisibleLatencyMs === null
        ? []
        : [checkpoint.submitToVisibleLatencyMs]
    ),
    completedCallLatencySamplesMs: checkpoints.flatMap((checkpoint) =>
      checkpoint.calls.flatMap((call) =>
        call.safeTrace.latencyMs === null ? [] : [call.safeTrace.latencyMs]
      )
    )
  };
}

function percentile(values: readonly number[], fraction: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index] ?? null;
}

function buildEmptyContentDiagnosticReport(input: {
  records: readonly Gi088V8r3CandidateTrialRecord[];
  maxRetriesPerCheckpoint: typeof GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT;
  globalRecoveryCallsMaximum: typeof GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM;
}): Gi088V8r3EmptyContentDiagnosticReport {
  const checkpoints = input.records.flatMap((record) =>
    record.checkpoints.map((checkpoint) => {
      const initialCall = checkpoint.calls[0];
      const emptyRecoveryCalls = checkpoint.calls.filter(
        (call) =>
          call.kind === "automatic_recovery" &&
          call.appliedRecoveryTrigger === "EMPTY_CONTENT"
      );
      const successfulRecoveryCall = emptyRecoveryCalls.find(
        (call) => call.status === "valid"
      );
      const cumulativeLatencyMs = checkpoint.calls.every(
        (call) => call.safeTrace.latencyMs !== null
      )
        ? checkpoint.calls.reduce(
            (total, call) => total + (call.safeTrace.latencyMs ?? 0),
            0
          )
        : null;
      return {
        caseId: record.caseId,
        trialAttempt: record.attempt,
        checkpointIndex: checkpoint.checkpointIndex,
        initialEmptyContent: initialCall?.errorCode === "EMPTY_CONTENT",
        emptyContentRecoveryAttemptCount: emptyRecoveryCalls.length,
        recoverySuccessAttempt: successfulRecoveryCall
          ? successfulRecoveryCall.recoveryAttempt ??
            emptyRecoveryCalls.indexOf(successfulRecoveryCall) + 1
          : null,
        emptyContentExhausted:
          initialCall?.errorCode === "EMPTY_CONTENT" &&
          checkpoint.calls.at(-1)?.errorCode === "EMPTY_CONTENT" &&
          emptyRecoveryCalls.length >= input.maxRetriesPerCheckpoint,
        recoveryBudgetExhausted: checkpoint.recoveryBudgetExhausted === true,
        finalEmptyContent:
          checkpoint.calls.at(-1)?.errorCode === "EMPTY_CONTENT",
        cumulativeLatencyMs
      } satisfies Gi088V8r3EmptyContentCheckpointDiagnostic;
    })
  );
  const initialEmptyContentCount = checkpoints.filter(
    (checkpoint) => checkpoint.initialEmptyContent
  ).length;
  const emptyContentRecoveryAttemptCount = checkpoints.reduce(
    (total, checkpoint) =>
      total + checkpoint.emptyContentRecoveryAttemptCount,
    0
  );
  const emptyContentRecoverySuccessCount = checkpoints.filter(
    (checkpoint) => checkpoint.recoverySuccessAttempt !== null
  ).length;
  const recoveredCheckpoints = checkpoints.filter(
    (checkpoint) => checkpoint.recoverySuccessAttempt !== null
  );
  const visibleLatencySamplesMs = input.records.flatMap((record) =>
    record.checkpoints.flatMap((checkpoint) =>
      checkpoint.status === "valid" &&
      checkpoint.submitToVisibleLatencyMs !== null
        ? [checkpoint.submitToVisibleLatencyMs]
        : []
    )
  );
  const finalVisibleCount = input.records.reduce(
    (total, record) =>
      total + record.checkpoints.filter((checkpoint) => checkpoint.status === "valid").length,
    0
  );
  const eligibleCount = input.records.reduce(
    (total, record) => total + record.checkpoints.length,
    0
  );
  return {
    mode: GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE,
    maxRetriesPerCheckpoint: input.maxRetriesPerCheckpoint,
    globalRecoveryCallsMaximum: input.globalRecoveryCallsMaximum,
    checkpoints,
    summary: {
      emptyContentInitialCount: initialEmptyContentCount,
      emptyContentTriggerCount: initialEmptyContentCount,
      emptyContentRecoveryAttemptCount,
      emptyContentRecoverySuccessCount,
      emptyContentRecoveredCheckpointCount: recoveredCheckpoints.length,
      successAtAttempt1: recoveredCheckpoints.filter(
        (checkpoint) => checkpoint.recoverySuccessAttempt === 1
      ).length,
      successAtAttempt2: recoveredCheckpoints.filter(
        (checkpoint) => checkpoint.recoverySuccessAttempt === 2
      ).length,
      successAtAttempt3: recoveredCheckpoints.filter(
        (checkpoint) => checkpoint.recoverySuccessAttempt === 3
      ).length,
      finalEmptyContentCount: checkpoints.filter(
        (checkpoint) => checkpoint.finalEmptyContent
      ).length,
      recoveryBudgetExhaustedCount: checkpoints.filter(
        (checkpoint) => checkpoint.recoveryBudgetExhausted
      ).length,
      finalVisibleCompletionRate:
        eligibleCount > 0 ? finalVisibleCount / eligibleCount : null,
      visibleLatencySamplesMs,
      visibleLatencyP50Ms: percentile(visibleLatencySamplesMs, 0.5),
      visibleLatencyP90Ms: percentile(visibleLatencySamplesMs, 0.9),
      visibleLatencyMaxMs:
        visibleLatencySamplesMs.length > 0
          ? Math.max(...visibleLatencySamplesMs)
          : null,
      totalRecoveryCalls: input.records.reduce(
        (total, record) =>
          total +
          record.checkpoints.reduce(
            (checkpointTotal, checkpoint) =>
              checkpointTotal + checkpoint.automaticRecoveryCount,
            0
          ),
        0
      )
    }
  };
}

export async function executeGi088V8r3CandidateEvaluation(input: {
  provider: AIProvider;
  providerIdentity: Gi088V8r3ProviderIdentity;
  deterministicRegression: readonly Gi088V8r3EvaluationCase[];
  developmentCases: readonly Gi088V8r3EvaluationCase[];
  hiddenAdmissionCases: readonly Gi088V8r3EvaluationCase[];
  privateHiddenFileSha256: string;
  automaticRecoveryMaximum?: number;
  executionMode?: Gi088V8r3CandidateExecutionMode;
  emptyContentRecoveryMaximumPerCheckpoint?: number;
  concurrency?: number;
  now?: () => Date;
  runId?: string;
}): Promise<Gi088V8r3CandidateExecutionReport> {
  if (!/^[a-f0-9]{64}$/u.test(input.privateHiddenFileSha256)) {
    throw new Error("GI088_V8R3_PRIVATE_HIDDEN_FILE_SHA256_INVALID");
  }
  assertProviderIdentity({
    provider: input.provider,
    identity: input.providerIdentity,
    expected: createGi088V8r3ArkProviderIdentity()
  });
  validateGi088V8r3DatasetPartitions({
    deterministicRegression: input.deterministicRegression,
    development: input.developmentCases,
    hiddenAdmission: input.hiddenAdmissionCases
  });
  const regression = runGi088V8r3DeterministicRegression(
    input.deterministicRegression
  );
  if (!regression.passed) {
    throw new Error("GI088_V8R3_DETERMINISTIC_REGRESSION_INVALID");
  }
  const generativeCases = [
    ...input.developmentCases,
    ...input.hiddenAdmissionCases
  ];
  const trials = generativeCases.flatMap((evaluationCase) => [
    { evaluationCase, attempt: 1 as const },
    { evaluationCase, attempt: 2 as const }
  ]);
  const initialCallCount = countInitialCalls(generativeCases);
  const executionMode = input.executionMode ?? "formal";
  const recoveryMaximum =
    input.automaticRecoveryMaximum ??
    (executionMode === GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE
      ? GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM
      : GI088_V8R3_FORMAL_CALL_BUDGET.candidateAutomaticRecoveryCallsMaximum);
  const emptyContentRecoveryMaximumPerCheckpoint =
    input.emptyContentRecoveryMaximumPerCheckpoint ??
    (executionMode === GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE
      ? GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT
      : 1);
  const maximumRecoveryCalls =
    executionMode === GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE
      ? GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM
      : GI088_V8R3_HARD_GATES.automaticRecoveryMaximum;
  const maximumRetriesPerCheckpoint =
    executionMode === GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE
      ? GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT
      : 1;
  if (
    !Number.isInteger(recoveryMaximum) ||
    recoveryMaximum < 0 ||
    recoveryMaximum > maximumRecoveryCalls ||
    !Number.isInteger(emptyContentRecoveryMaximumPerCheckpoint) ||
    emptyContentRecoveryMaximumPerCheckpoint < 0 ||
    emptyContentRecoveryMaximumPerCheckpoint > maximumRetriesPerCheckpoint
  ) {
    throw new Error("GI088_V8R3_AUTOMATIC_RECOVERY_MAXIMUM_INVALID");
  }
  const concurrency = input.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("GI088_V8R3_CONCURRENCY_INVALID");
  }
  const budget = new CandidateCallBudget(initialCallCount, recoveryMaximum);
  const now = input.now ?? (() => new Date());
  const records = await mapWithConcurrency({
    items: trials,
    concurrency,
    run: ({ evaluationCase, attempt }) =>
      executeCandidateTrial({
        provider: input.provider,
        evaluationCase,
        attempt,
        budget,
        emptyContentRecoveryMaximumPerCheckpoint,
        now
      })
  });
  if (budget.initial !== initialCallCount) {
    throw new Error("GI088_V8R3_CHECKPOINT_EXECUTION_INCOMPLETE");
  }
  const datasetFingerprint = createGi088V8r3DatasetFingerprint({
    deterministicRegression: input.deterministicRegression,
    development: input.developmentCases,
    hiddenAdmission: input.hiddenAdmissionCases
  });
  const behaviorFingerprintBundle = createGi088FingerprintBundle();
  const candidateFingerprint = behaviorFingerprintBundle.candidateFingerprint;
  const budgetEvidence = {
    authorizedMaximum: budget.maximum,
    initialCalls: budget.initial,
    automaticRecoveryCalls: budget.recovery,
    totalCalls: budget.total
  };
  const privateInputs = {
    hiddenFileSha256: input.privateHiddenFileSha256,
    hiddenAggregateCommitment: createGi088V8r3CaseSetCommitment(
      input.hiddenAdmissionCases
    )
  };
  const executionConfig = {
    concurrency,
    automaticRecoveryMaximum: recoveryMaximum,
    recoveryMode: executionMode,
    emptyContentRecoveryMaximumPerCheckpoint
  };
  const runtime = {
    ...input.providerIdentity,
    thinking: "enabled" as const,
    reasoningEffort: "high" as const,
    responseFormat: "json_object" as const,
    headersTimeoutMs: GI088_TIMEOUT_POLICY.headersTimeoutMs,
    bodyIdleTimeoutMs: GI088_TIMEOUT_POLICY.bodyIdleTimeoutMs,
    hardTimeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs,
    skillVersion: GI088_V8R3_INTERVIEW_SKILL_VERSION,
    skillSha256: GI088_V8R3_INTERVIEW_SKILL_SHA256
  };
  const offlineRunFingerprint = sha256(
    JSON.stringify({
      fingerprintKind: "gi088-v8r3-offline-run",
      reportVersion: GI088_V8R3_OFFLINE_EXECUTOR_VERSION,
      formalEvaluationVersion: GI088_V8R3_FORMAL_EVALUATION_VERSION,
      runnerVersion: GI088_V8R3_RUNNER_VERSION,
      behaviorFingerprintBundle,
      datasetFingerprint,
      privateInputs,
      runtime,
      executionConfig,
      budget: budgetEvidence
    })
  );
  const operationalLedger = buildOperationalLedger(records);
  const emptyContentDiagnostics =
    executionMode === GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE
      ? buildEmptyContentDiagnosticReport({
          records,
          maxRetriesPerCheckpoint:
            GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT,
          globalRecoveryCallsMaximum:
            GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM
        })
      : undefined;
  const evidenceFingerprint = sha256(
    JSON.stringify({
      offlineRunFingerprint,
      deterministicRegression: regression,
      budget: budgetEvidence,
      operationalLedger,
      emptyContentDiagnostics,
      records
    })
  );
  return {
    reportVersion: GI088_V8R3_OFFLINE_EXECUTOR_VERSION,
    formalEvaluationVersion: GI088_V8R3_FORMAL_EVALUATION_VERSION,
    runId: input.runId ?? randomUUID(),
    createdAt: now().toISOString(),
    datasetVersion: GI088_V8R3_EVALUATION_DATASET_VERSION,
    runnerVersion: GI088_V8R3_RUNNER_VERSION,
    behaviorFingerprintBundle,
    candidateFingerprint,
    datasetFingerprint,
    offlineRunFingerprint,
    evidenceFingerprint,
    privateInputs,
    executionConfig,
    runtime,
    privacy: GI088_V8R3_OFFLINE_PRIVACY_CONTRACT,
    budget: budgetEvidence,
    deterministicRegression: regression,
    operationalLedger,
    ...(emptyContentDiagnostics ? { emptyContentDiagnostics } : {}),
    records
  };
}

function stableJsonEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertCandidateReport(
  input: unknown
): asserts input is Gi088V8r3CandidateExecutionReport {
  const reportVersion =
    input && typeof input === "object"
      ? (input as { reportVersion?: unknown }).reportVersion
      : null;
  const legacyReport =
    reportVersion === GI088_V8R3_LEGACY_OFFLINE_EXECUTOR_VERSION;
  if (
    !input ||
    typeof input !== "object" ||
    (reportVersion !== GI088_V8R3_OFFLINE_EXECUTOR_VERSION &&
      !legacyReport) ||
    !Array.isArray((input as { records?: unknown }).records)
  ) {
    throw new Error("GI088_V8R3_CANDIDATE_REPORT_INVALID");
  }
  const report = input as Gi088V8r3CandidateExecutionReport;
  if (
    report.formalEvaluationVersion !== GI088_V8R3_FORMAL_EVALUATION_VERSION ||
    report.datasetVersion !== GI088_V8R3_EVALUATION_DATASET_VERSION ||
    (report.runnerVersion !== GI088_V8R3_RUNNER_VERSION &&
      (!legacyReport || report.runnerVersion !== GI088_V8R3_LEGACY_RUNNER_VERSION))
  ) {
    throw new Error("GI088_V8R3_CANDIDATE_REPORT_VERSION_INVALID");
  }
  const developmentRecordCount = report.records.filter(
    (record) => record.partition === "development"
  ).length;
  const hiddenRecordCount = report.records.filter(
    (record) => record.partition === "hidden_admission"
  ).length;
  if (
    report.records.length !== 80 ||
    developmentRecordCount !== 56 ||
    hiddenRecordCount !== 24 ||
    report.records.some(
      (record) =>
        (record.partition === "development" &&
          !/^GI088-V8R3-D\d{2}$/u.test(record.caseId)) ||
        (record.partition === "hidden_admission" &&
          !/^GI088-V8R3-H\d{2}$/u.test(record.caseId))
    )
  ) {
    throw new Error("GI088_V8R3_CANDIDATE_REPORT_CARDINALITY_INVALID");
  }
  for (const fingerprint of [
    report.candidateFingerprint,
    report.datasetFingerprint,
    report.offlineRunFingerprint,
    report.evidenceFingerprint,
    report.privateInputs?.hiddenFileSha256,
    report.privateInputs?.hiddenAggregateCommitment,
    report.behaviorFingerprintBundle?.behaviorManifestSha256,
    report.behaviorFingerprintBundle?.candidateFingerprint,
    report.behaviorFingerprintBundle?.datasetFingerprint,
    report.behaviorFingerprintBundle?.runnerFingerprint,
    report.behaviorFingerprintBundle?.experienceFingerprint,
    report.behaviorFingerprintBundle?.executionFingerprint
  ]) {
    if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(fingerprint)) {
      throw new Error("GI088_V8R3_CANDIDATE_REPORT_FINGERPRINT_INVALID");
    }
  }
  const expectedBehaviorFingerprintBundle = createGi088FingerprintBundle();
  if (
    !legacyReport &&
    (!stableJsonEqual(
      report.behaviorFingerprintBundle,
      expectedBehaviorFingerprintBundle
    ) ||
      report.candidateFingerprint !==
        expectedBehaviorFingerprintBundle.candidateFingerprint)
  ) {
    throw new Error("GI088_V8R3_BEHAVIOR_FINGERPRINT_BUNDLE_MISMATCH");
  }
  const expectedRuntime = {
    ...createGi088V8r3ArkProviderIdentity(),
    thinking: "enabled",
    reasoningEffort: "high",
    responseFormat: "json_object",
    headersTimeoutMs: GI088_TIMEOUT_POLICY.headersTimeoutMs,
    bodyIdleTimeoutMs: GI088_TIMEOUT_POLICY.bodyIdleTimeoutMs,
    hardTimeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs,
    skillVersion: GI088_V8R3_INTERVIEW_SKILL_VERSION,
    skillSha256: GI088_V8R3_INTERVIEW_SKILL_SHA256
  };
  if (!stableJsonEqual(report.runtime, expectedRuntime)) {
    throw new Error("GI088_V8R3_CANDIDATE_RUNTIME_IDENTITY_INVALID");
  }
  const recoveryMode = report.executionConfig?.recoveryMode ?? "formal";
  const emptyContentRecoveryMaximumPerCheckpoint =
    report.executionConfig?.emptyContentRecoveryMaximumPerCheckpoint ?? 1;
  const allowedRecoveryMaximum =
    recoveryMode === GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE
      ? GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM
      : GI088_V8R3_HARD_GATES.automaticRecoveryMaximum;
  if (
    !Number.isInteger(report.executionConfig?.concurrency) ||
    report.executionConfig.concurrency <= 0 ||
    !Number.isInteger(report.executionConfig.automaticRecoveryMaximum) ||
    report.executionConfig.automaticRecoveryMaximum < 0 ||
    report.executionConfig.automaticRecoveryMaximum >
      allowedRecoveryMaximum ||
    !Number.isInteger(emptyContentRecoveryMaximumPerCheckpoint) ||
    emptyContentRecoveryMaximumPerCheckpoint < 0 ||
    emptyContentRecoveryMaximumPerCheckpoint >
      (recoveryMode === GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE
        ? GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT
        : 1) ||
    report.executionConfig.automaticRecoveryMaximum !==
      report.budget.authorizedMaximum - report.budget.initialCalls
  ) {
    throw new Error("GI088_V8R3_EXECUTION_CONFIG_INVALID");
  }
  const calls = report.records.flatMap((record) => record.calls);
  const initialCalls = calls.filter((call) => call.kind === "initial").length;
  const recoveryCalls = calls.filter(
    (call) => call.kind === "automatic_recovery"
  ).length;
  if (
    initialCalls !== report.budget.initialCalls ||
    recoveryCalls !== report.budget.automaticRecoveryCalls ||
    calls.length !== report.budget.totalCalls ||
    recoveryCalls > allowedRecoveryMaximum ||
    report.budget.totalCalls > report.budget.authorizedMaximum
  ) {
    throw new Error("GI088_V8R3_CANDIDATE_REPORT_BUDGET_INVALID");
  }
  const recordKeys = new Set<string>();
  for (const record of report.records) {
    const key = `${record.caseId}:${record.attempt}`;
    if (recordKeys.has(key)) {
      throw new Error("GI088_V8R3_CANDIDATE_REPORT_DUPLICATE_TRIAL");
    }
    recordKeys.add(key);
  }
  for (const record of report.records) {
    if (
      record.checkpoints.length === 0 ||
      record.checkpoints.some(
        (checkpoint, index) =>
          checkpoint.checkpointIndex !== index || checkpoint.calls.length === 0
      )
    ) {
      throw new Error("GI088_V8R3_CANDIDATE_CHECKPOINT_RECORD_INVALID");
    }
    for (const checkpoint of record.checkpoints) {
      for (const call of checkpoint.calls) {
        const requestHashPayload = {
          identity: GI088_MODEL_CALL_IDENTITY,
          transport: createGi088V8r3ArkProviderIdentity().transport,
          candidateFingerprint: createGi088EffectiveCandidateFingerprint(),
          inputFingerprint: record.inputFingerprint,
          caseId: record.caseId,
          checkpointIndex: checkpoint.checkpointIndex,
          attempt: record.attempt,
          kind: call.kind,
          ...(legacyReport
            ? {}
            : { recoveryAttempt: call.recoveryAttempt ?? (call.kind === "automatic_recovery" ? 1 : 0) }),
          recoveryTrigger: call.appliedRecoveryTrigger,
          recoveryInstructionVersion: call.appliedRecoveryTrigger
            ? candidateRecoveryCorrection(call.appliedRecoveryTrigger).version
            : null,
          timeoutPolicy: GI088_TIMEOUT_POLICY
        };
        const expectedRequestHash = sha256(JSON.stringify(requestHashPayload));
        if (call.requestHash !== expectedRequestHash) {
          throw new Error("GI088_V8R3_CANDIDATE_REQUEST_HASH_MISMATCH");
        }
      }
    }
  }
  const derivedLedger = buildOperationalLedger(report.records);
  const developmentCheckpointCount = report.records
    .filter((record) => record.partition === "development")
    .reduce((total, record) => total + record.checkpoints.length, 0);
  const hiddenCheckpointCount = report.records
    .filter((record) => record.partition === "hidden_admission")
    .reduce((total, record) => total + record.checkpoints.length, 0);
  if (
    developmentCheckpointCount !==
      GI088_V8R3_FORMAL_CALL_BUDGET.candidateDevelopmentInitialCalls ||
    hiddenCheckpointCount !==
      GI088_V8R3_FORMAL_CALL_BUDGET.candidateHiddenInitialCalls ||
    initialCalls !== GI088_V8R3_FORMAL_CALL_BUDGET.candidateInitialCalls
  ) {
    throw new Error("GI088_V8R3_CANDIDATE_CHECKPOINT_CARDINALITY_INVALID");
  }
  if (!stableJsonEqual(derivedLedger, report.operationalLedger)) {
    throw new Error("GI088_V8R3_OPERATIONAL_LEDGER_MISMATCH");
  }
  if (recoveryMode === GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE) {
    if (
      !report.emptyContentDiagnostics ||
      !stableJsonEqual(
        report.emptyContentDiagnostics,
        buildEmptyContentDiagnosticReport({
          records: report.records,
          maxRetriesPerCheckpoint:
            GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MAX_RETRIES_PER_CHECKPOINT,
          globalRecoveryCallsMaximum:
            GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_RECOVERY_CALLS_MAXIMUM
        })
      )
    ) {
      throw new Error("GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MISMATCH");
    }
  } else if (report.emptyContentDiagnostics) {
    throw new Error("GI088_V8R3_UNEXPECTED_EMPTY_CONTENT_DIAGNOSTIC");
  }
  const expectedOfflineRunFingerprint = sha256(
    JSON.stringify({
      fingerprintKind: "gi088-v8r3-offline-run",
      reportVersion: report.reportVersion,
      formalEvaluationVersion: GI088_V8R3_FORMAL_EVALUATION_VERSION,
      runnerVersion: report.runnerVersion,
      behaviorFingerprintBundle: report.behaviorFingerprintBundle,
      datasetFingerprint: report.datasetFingerprint,
      privateInputs: report.privateInputs,
      runtime: report.runtime,
      executionConfig: report.executionConfig,
      budget: report.budget
    })
  );
  if (report.offlineRunFingerprint !== expectedOfflineRunFingerprint) {
    throw new Error("GI088_V8R3_OFFLINE_RUN_FINGERPRINT_MISMATCH");
  }
  const expectedEvidenceFingerprint = sha256(
    JSON.stringify({
      offlineRunFingerprint: report.offlineRunFingerprint,
      deterministicRegression: report.deterministicRegression,
      budget: report.budget,
      operationalLedger: report.operationalLedger,
      emptyContentDiagnostics: report.emptyContentDiagnostics,
      records: report.records
    })
  );
  if (report.evidenceFingerprint !== expectedEvidenceFingerprint) {
    throw new Error("GI088_V8R3_EVIDENCE_FINGERPRINT_MISMATCH");
  }
}

export function parseGi088V8r3CandidateExecutionReport(input: unknown) {
  assertCandidateReport(input);
  return input;
}

function assertFormalCandidateReport(
  input: unknown
): asserts input is Gi088V8r3CandidateExecutionReport {
  assertCandidateReport(input);
  if ((input as Gi088V8r3CandidateExecutionReport).executionConfig?.recoveryMode ===
    GI088_V8R3_EMPTY_CONTENT_DIAGNOSTIC_MODE) {
    throw new Error("GI088_V8R3_DIAGNOSTIC_REPORT_NOT_FORMAL_CANDIDATE");
  }
}

export function evaluateGi088V8r3CandidateOperationalGates(
  report: Gi088V8r3CandidateExecutionReport
) {
  assertCandidateReport(report);
  const reliability = evaluateGi088V8r3ReliabilityGate({
    firstValidRate: report.operationalLedger.firstValidRate ?? 0,
    automaticRecoveryCount:
      report.operationalLedger.automaticRecoveryAttemptCount,
    manualRecoveryCount: report.operationalLedger.manualRecoveryCount,
    finalFailureCount: report.operationalLedger.finalFailureCount,
    finalProtectionCount: report.operationalLedger.finalProtectionCount,
    duplicateMessageCount: report.operationalLedger.duplicateMessageCount,
    pendingTurnCount: report.operationalLedger.pendingTurnCount
  });
  const latency = evaluateGi088V8r3LatencyGate({
    latenciesMs: report.operationalLedger.submitToVisibleLatencySamplesMs,
    expectedSampleCount: report.operationalLedger.eligibleSubmissionCount
  });
  return {
    passed: reliability.passed && latency.passed,
    reliability,
    latency
  };
}

const judgeFailureCategorySchema = z.enum([
  "none",
  "reask_answered_content",
  "working_task_drift",
  "unsupported_third_party_inference",
  "low_information_gain",
  "answer_burden",
  "contract_or_data"
]);

const judgeVisibleMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(8_000)
  })
  .strict();

const judgeVisibleOutputSchema = z
  .object({
    action: z.enum(["acknowledge", "ask", "synthesize", "pause"]),
    understanding: z.string().max(2_000).nullable(),
    response: z.string().trim().min(1).max(4_000)
  })
  .strict();

const judgeSafeTraceSchema = z
  .object({
    latencyMs: z.number().int().nonnegative().nullable(),
    automaticRecoveryCount: z.number().int().min(0).max(2),
    contractValid: z.boolean(),
    technicalFailure: z.boolean()
  })
  .strict();

const judgeCheckpointSchema = z
  .object({
    visibleConversation: z.array(judgeVisibleMessageSchema).min(2).max(40),
    candidateVisibleOutput: judgeVisibleOutputSchema,
    safeTrace: judgeSafeTraceSchema
  })
  .strict();

const judgeGoldenItemSchema = z
  .object({
    sampleId: z.string().trim().min(1).max(160),
    sourcePartition: z.literal("golden_calibration"),
    contentFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    checkpoints: z.array(judgeCheckpointSchema).min(1).max(8),
    humanReview: z
      .object({
        pass: z.boolean(),
        blocker: z.boolean(),
        primaryFailureCategory: judgeFailureCategorySchema,
        reviewerId: z.string().trim().min(1).max(160),
        source: z.enum(["product_owner", "trained_human_reviewer"]),
        reviewedAt: z.string().datetime({ offset: true })
      })
      .strict()
  })
  .strict();

export const gi088V8r3JudgeGoldenFileSchema = z
  .object({
    version: z.literal("2026-08-11.gi088-v8r3-judge-golden-v2"),
    rounds: z
      .array(
        z
          .object({
            roundId: z.string().trim().min(1).max(120),
            items: z
              .array(judgeGoldenItemSchema)
              .length(GI088_V8R3_HARD_GATES.judgeGoldenSamplesPerRound)
          })
          .strict()
      )
      .length(GI088_V8R3_HARD_GATES.judgeRequiredConsecutiveRounds)
  })
  .strict();

export type Gi088V8r3JudgeGoldenFile = z.infer<
  typeof gi088V8r3JudgeGoldenFileSchema
>;

export function createGi088V8r3JudgeContentFingerprint(input: {
  checkpoints: z.infer<typeof judgeCheckpointSchema>[];
}) {
  return sha256(JSON.stringify({ checkpoints: input.checkpoints }));
}

export function parseGi088V8r3JudgeGoldenFile(
  input: unknown,
  hiddenCases: readonly Gi088V8r3EvaluationCase[]
): Gi088V8r3JudgeGoldenFile {
  const parsed = gi088V8r3JudgeGoldenFileSchema.parse(input);
  const sampleIds = new Set<string>();
  const contentFingerprints = new Set<string>();
  const hiddenConversationFingerprints = new Set(
    hiddenCases.flatMap((evaluationCase) =>
      evaluationCase.checkpoints.map((_, checkpointIndex) =>
        sha256(
          JSON.stringify(
            getGi088V8r3ConversationAtCheckpoint(
              evaluationCase,
              checkpointIndex
            ).map(({ role, content }) => ({ role, content }))
          )
        )
      )
    )
  );
  for (const round of parsed.rounds) {
    for (const item of round.items) {
      const actualFingerprint = createGi088V8r3JudgeContentFingerprint(item);
      if (actualFingerprint !== item.contentFingerprint) {
        throw new Error(`GI088_V8R3_GOLDEN_FINGERPRINT_MISMATCH:${item.sampleId}`);
      }
      if (sampleIds.has(item.sampleId)) {
        throw new Error(`GI088_V8R3_GOLDEN_SAMPLE_REUSED:${item.sampleId}`);
      }
      if (contentFingerprints.has(item.contentFingerprint)) {
        throw new Error(
          `GI088_V8R3_GOLDEN_CONTENT_REUSED:${item.contentFingerprint}`
        );
      }
      for (const checkpoint of item.checkpoints) {
        const conversationFingerprint = sha256(
          JSON.stringify(checkpoint.visibleConversation)
        );
        if (hiddenConversationFingerprints.has(conversationFingerprint)) {
          throw new Error("GI088_V8R3_HIDDEN_SOURCE_FORBIDDEN_FOR_JUDGE");
        }
      }
      sampleIds.add(item.sampleId);
      contentFingerprints.add(item.contentFingerprint);
    }
  }
  const firstRoundLatest = Math.max(
    ...parsed.rounds[0]!.items.map((item) =>
      Date.parse(item.humanReview.reviewedAt)
    )
  );
  const secondRoundEarliest = Math.min(
    ...parsed.rounds[1]!.items.map((item) =>
      Date.parse(item.humanReview.reviewedAt)
    )
  );
  if (firstRoundLatest >= secondRoundEarliest) {
    throw new Error("GI088_V8R3_GOLDEN_ROUNDS_NOT_CONSECUTIVE");
  }
  return parsed;
}

const judgeOutputSchema = z
  .object({
    pass: z.boolean(),
    blocker: z.boolean(),
    primaryFailureCategory: judgeFailureCategorySchema,
    rationale: z.string().trim().min(1).max(800)
  })
  .strict();

export type Gi088V8r3JudgeCallRecord = {
  subjectId: string;
  sourcePartition: "golden_calibration" | "development";
  status: "valid" | "protected_failure" | "technical_failure";
  requestHash: string;
  responseHash: string | null;
  pass: boolean | null;
  blocker: boolean | null;
  primaryFailureCategory: z.infer<typeof judgeFailureCategorySchema> | null;
  rationaleHash: string | null;
  errorCode: string | null;
  safeTrace: Gi088V8r3SafeProviderTrace;
};

const GI088_V8R3_JUDGE_SYSTEM_PROMPT = `你是 GI-088 离线质量 Judge。只根据用户可见对话、候选可见回应和安全 Trace 分类。逐个检查点检查回应是否推进用户当前共同任务，是否重复已回答内容、漂移、无证据猜测第三方动机、缺少认识增量、增加回答负担或违反可见合同。不要推断隐藏思考，不要改写候选回应。只输出 JSON：{"pass":boolean,"blocker":boolean,"primaryFailureCategory":"none|reask_answered_content|working_task_drift|unsupported_third_party_inference|low_information_gain|answer_burden|contract_or_data","rationale":"一条可核查理由"}。`;

export function createGi088V8r3JudgeCompletionParams(input: {
  sourcePartition: "golden_calibration" | "development" | "hidden_admission";
  checkpoints: z.infer<typeof judgeCheckpointSchema>[];
}): AICompletionParams {
  if (input.sourcePartition === "hidden_admission") {
    throw new Error("GI088_V8R3_HIDDEN_SOURCE_FORBIDDEN_FOR_JUDGE");
  }
  const visibleOnlyInput = {
    sourcePartition: input.sourcePartition,
    checkpoints: input.checkpoints
  };
  return {
    messages: [
      { role: "system", content: GI088_V8R3_JUDGE_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(visibleOnlyInput) }
    ],
    useProviderDefaultMaxTokens: true,
    timeoutMs: 60_000,
    headersTimeoutMs: 60_000,
    bodyIdleTimeoutMs: 60_000,
    hardTimeoutMs: 60_000,
    responseFormat: "json_object",
    thinking: "enabled",
    reasoningEffort: "high"
  };
}

async function executeJudgeCall(input: {
  provider: AIProvider;
  subjectId: string;
  sourcePartition: "golden_calibration" | "development" | "hidden_admission";
  checkpoints: z.infer<typeof judgeCheckpointSchema>[];
}) {
  if (input.sourcePartition === "hidden_admission") {
    throw new Error("GI088_V8R3_HIDDEN_SOURCE_FORBIDDEN_FOR_JUDGE");
  }
  const params = createGi088V8r3JudgeCompletionParams(input);
  const requestHash = sha256(
    JSON.stringify({
      subjectId: input.subjectId,
      sourcePartition: input.sourcePartition,
      inputFingerprint: createGi088V8r3JudgeContentFingerprint(input),
      runtime: createGi088V8r3ProProviderIdentity(),
      promptSha256: sha256(GI088_V8R3_JUDGE_SYSTEM_PROMPT)
    })
  );
  let completion: AICompletionResult;
  try {
    completion = await input.provider.complete(params);
  } catch (error) {
    return {
      subjectId: input.subjectId,
      sourcePartition: input.sourcePartition,
      status: "technical_failure" as const,
      requestHash,
      responseHash: null,
      pass: null,
      blocker: null,
      primaryFailureCategory: null,
      rationaleHash: null,
      errorCode: safeCode(getAIProviderFailureCode(error), "JUDGE_PROVIDER_FAILURE"),
      safeTrace: safeTrace(null, getAIProviderDiagnostics(error))
    };
  }
  try {
    const output = judgeOutputSchema.parse(
      JSON.parse(completion.content.trim()) as unknown
    );
    return {
      subjectId: input.subjectId,
      sourcePartition: input.sourcePartition,
      status: "valid" as const,
      requestHash,
      responseHash: sha256(completion.content),
      pass: output.pass,
      blocker: output.blocker,
      primaryFailureCategory: output.primaryFailureCategory,
      rationaleHash: sha256(output.rationale),
      errorCode: null,
      safeTrace: safeTrace(completion)
    };
  } catch {
    return {
      subjectId: input.subjectId,
      sourcePartition: input.sourcePartition,
      status: "protected_failure" as const,
      requestHash,
      responseHash: completion.content ? sha256(completion.content) : null,
      pass: null,
      blocker: null,
      primaryFailureCategory: null,
      rationaleHash: null,
      errorCode: "JUDGE_OUTPUT_SCHEMA_INVALID",
      safeTrace: safeTrace(completion)
    };
  }
}

export type Gi088V8r3JudgeCalibrationReport = {
  reportVersion: "2026-08-11.gi088-v8r3-judge-calibration-report-v3";
  createdAt: string;
  runtime: Gi088V8r3ProviderIdentity & {
    thinking: "enabled";
    reasoningEffort: "high";
    responseFormat: "json_object";
    hardTimeoutMs: 60_000;
  };
  privacy: typeof GI088_V8R3_OFFLINE_PRIVACY_CONTRACT;
  datasetFingerprint: string;
  goldenEvidenceFingerprint: string;
  calibrationFingerprint: string;
  humanEvidence: {
    reviewCount: 40;
    reviewerCount: number;
    sources: Array<"product_owner" | "trained_human_reviewer">;
    earliestReviewedAt: string;
    latestReviewedAt: string;
  };
  budget: { authorizedMaximum: 40; totalCalls: number };
  complete: boolean;
  promotedToDevelopmentPrescreen: boolean;
  gate: ReturnType<typeof evaluateGi088V8r3JudgeCalibration> | null;
  rounds: Array<{
    roundId: string;
    items: Array<
      Gi088V8r3JudgeCallRecord & {
        humanPass: boolean;
        humanBlocker: boolean;
        humanFailureCategory: string;
        contentFingerprint: string;
      }
    >;
  }>;
};

export async function executeGi088V8r3JudgeCalibration(input: {
  provider: AIProvider;
  providerIdentity: Gi088V8r3ProviderIdentity;
  goldenFile: Gi088V8r3JudgeGoldenFile;
  hiddenCases: readonly Gi088V8r3EvaluationCase[];
  datasetFingerprint: string;
  concurrency?: number;
  now?: () => Date;
}): Promise<Gi088V8r3JudgeCalibrationReport> {
  assertProviderIdentity({
    provider: input.provider,
    identity: input.providerIdentity,
    expected: createGi088V8r3ProProviderIdentity()
  });
  const golden = parseGi088V8r3JudgeGoldenFile(
    input.goldenFile,
    input.hiddenCases
  );
  if (!/^[a-f0-9]{64}$/u.test(input.datasetFingerprint)) {
    throw new Error("GI088_V8R3_JUDGE_DATASET_FINGERPRINT_INVALID");
  }
  const rounds: Gi088V8r3JudgeCalibrationReport["rounds"] = [];
  for (const round of golden.rounds) {
    const records = await mapWithConcurrency({
      items: round.items,
      concurrency: input.concurrency ?? 2,
      run: async (item) => {
        const call = await executeJudgeCall({
          provider: input.provider,
          subjectId: item.sampleId,
          sourcePartition: "golden_calibration",
          checkpoints: item.checkpoints
        });
        return {
          ...call,
          humanPass: item.humanReview.pass,
          humanBlocker: item.humanReview.blocker,
          humanFailureCategory: item.humanReview.primaryFailureCategory,
          contentFingerprint: item.contentFingerprint
        };
      }
    });
    rounds.push({ roundId: round.roundId, items: records });
  }
  const complete = rounds.every((round) =>
    round.items.every((item) => item.status === "valid")
  );
  let gate: ReturnType<typeof evaluateGi088V8r3JudgeCalibration> | null = null;
  if (complete) {
    const gateRounds: Gi088V8r3JudgeCalibrationRound[] = rounds.map((round) => ({
      roundId: round.roundId,
      items: round.items.map((item) => ({
        sampleId: item.contentFingerprint,
        humanPass: item.humanPass,
        judgePass: item.pass!,
        humanBlocker: item.humanBlocker,
        judgeBlocker: item.blocker!,
        humanFailureCategory: item.humanFailureCategory,
        judgeFailureCategory: item.primaryFailureCategory!
      }))
    }));
    gate = evaluateGi088V8r3JudgeCalibration(gateRounds);
  }
  const now = input.now ?? (() => new Date());
  const humanReviews = golden.rounds.flatMap((round) =>
    round.items.map((item) => item.humanReview)
  );
  const reviewedAt = humanReviews.map((review) => review.reviewedAt).sort();
  const reportWithoutFingerprint = {
    reportVersion: "2026-08-11.gi088-v8r3-judge-calibration-report-v3" as const,
    createdAt: now().toISOString(),
    runtime: {
      ...input.providerIdentity,
      thinking: "enabled" as const,
      reasoningEffort: "high" as const,
      responseFormat: "json_object" as const,
      hardTimeoutMs: 60_000 as const
    },
    privacy: GI088_V8R3_OFFLINE_PRIVACY_CONTRACT,
    datasetFingerprint: input.datasetFingerprint,
    goldenEvidenceFingerprint: sha256(JSON.stringify(golden)),
    humanEvidence: {
      reviewCount: 40 as const,
      reviewerCount: new Set(humanReviews.map((review) => review.reviewerId))
        .size,
      sources: [
        ...new Set(humanReviews.map((review) => review.source))
      ].sort(),
      earliestReviewedAt: reviewedAt[0]!,
      latestReviewedAt: reviewedAt.at(-1)!
    },
    budget: { authorizedMaximum: 40 as const, totalCalls: 40 },
    complete,
    promotedToDevelopmentPrescreen:
      complete && gate?.promotedToDevelopmentPrescreen === true,
    gate,
    rounds
  };
  return {
    ...reportWithoutFingerprint,
    calibrationFingerprint: sha256(JSON.stringify(reportWithoutFingerprint))
  };
}

function assertCalibrationReport(
  input: unknown
): asserts input is Gi088V8r3JudgeCalibrationReport {
  if (
    !input ||
    typeof input !== "object" ||
    (input as { reportVersion?: unknown }).reportVersion !==
      "2026-08-11.gi088-v8r3-judge-calibration-report-v3" ||
    (input as { promotedToDevelopmentPrescreen?: unknown })
      .promotedToDevelopmentPrescreen !== true
  ) {
    throw new Error("GI088_V8R3_JUDGE_NOT_PROMOTED");
  }
  const report = input as Gi088V8r3JudgeCalibrationReport;
  const identity = {
    adapter: report.runtime.adapter,
    providerName: report.runtime.providerName,
    provider: report.runtime.provider,
    transport: report.runtime.transport,
    baseUrlHost: report.runtime.baseUrlHost,
    endpoint: report.runtime.endpoint,
    model: report.runtime.model,
    payloadContractVersion: report.runtime.payloadContractVersion
  };
  if (!stableJsonEqual(identity, createGi088V8r3ProProviderIdentity())) {
    throw new Error("GI088_V8R3_JUDGE_RUNTIME_IDENTITY_INVALID");
  }
  if (
    !/^[a-f0-9]{64}$/u.test(report.datasetFingerprint) ||
    !/^[a-f0-9]{64}$/u.test(report.goldenEvidenceFingerprint) ||
    !/^[a-f0-9]{64}$/u.test(report.calibrationFingerprint) ||
    report.humanEvidence.reviewCount !== 40 ||
    report.budget.authorizedMaximum !== 40 ||
    report.budget.totalCalls !== 40 ||
    report.rounds.length !== 2 ||
    report.rounds.some(
      (round) =>
        round.items.length !== GI088_V8R3_HARD_GATES.judgeGoldenSamplesPerRound
    )
  ) {
    throw new Error("GI088_V8R3_JUDGE_CALIBRATION_EVIDENCE_INVALID");
  }
  const { calibrationFingerprint, ...fingerprintPayload } = report;
  if (
    calibrationFingerprint !== sha256(JSON.stringify(fingerprintPayload))
  ) {
    throw new Error("GI088_V8R3_JUDGE_CALIBRATION_FINGERPRINT_MISMATCH");
  }
  const gateRounds: Gi088V8r3JudgeCalibrationRound[] = report.rounds.map(
    (round) => ({
      roundId: round.roundId,
      items: round.items.map((item) => ({
        sampleId: item.contentFingerprint,
        humanPass: item.humanPass,
        judgePass: item.pass!,
        humanBlocker: item.humanBlocker,
        judgeBlocker: item.blocker!,
        humanFailureCategory: item.humanFailureCategory,
        judgeFailureCategory: item.primaryFailureCategory!
      }))
    })
  );
  if (
    report.complete !== true ||
    report.rounds.some((round) =>
      round.items.some(
        (item) =>
          item.status !== "valid" || item.sourcePartition !== "golden_calibration"
      )
    ) ||
    !stableJsonEqual(report.gate, evaluateGi088V8r3JudgeCalibration(gateRounds))
  ) {
    throw new Error("GI088_V8R3_JUDGE_CALIBRATION_GATE_INVALID");
  }
}

export function parseGi088V8r3JudgeCalibrationReport(input: unknown) {
  assertCalibrationReport(input);
  return input;
}

export type Gi088V8r3JudgePrescreenReport = {
  reportVersion: "2026-08-11.gi088-v8r3-judge-development-prescreen-v3";
  createdAt: string;
  runtime: Gi088V8r3ProviderIdentity & {
    thinking: "enabled";
    reasoningEffort: "high";
  };
  privacy: typeof GI088_V8R3_OFFLINE_PRIVACY_CONTRACT;
  candidateOfflineRunFingerprint: string;
  candidateEvidenceFingerprint: string;
  datasetFingerprint: string;
  calibrationFingerprint: string;
  prescreenFingerprint: string;
  calibrationPromoted: true;
  complete: boolean;
  hiddenAutomaticJudgement: "forbidden";
  excludedHiddenRecordCount: number;
  budget: { authorizedMaximum: 56; totalCalls: number };
  records: Array<
    Gi088V8r3JudgeCallRecord & {
      caseId: string;
      attempt: 1 | 2;
      candidateStatus: Gi088V8r3CandidateTrialRecord["status"];
    }
  >;
};

function emptySafeTrace(): Gi088V8r3SafeProviderTrace {
  return {
    latencyMs: null,
    finishReason: null,
    reasoningPresent: null,
    reasoningLength: null,
    reasoningTokens: null,
    tokenUsage: null,
    httpStatus: null,
    responseModel: null,
    choiceCount: null,
    contentLength: null,
    headersLatencyMs: null,
    bodyLatencyMs: null,
    totalLatencyMs: null,
    timeoutStage: null,
    abortSource: null,
    upstreamRequestIdHash: null
  };
}

export async function executeGi088V8r3JudgeDevelopmentPrescreen(input: {
  provider: AIProvider;
  providerIdentity: Gi088V8r3ProviderIdentity;
  candidateReport: Gi088V8r3CandidateExecutionReport;
  calibrationReport: Gi088V8r3JudgeCalibrationReport;
  developmentCases: readonly Gi088V8r3EvaluationCase[];
  concurrency?: number;
  now?: () => Date;
}): Promise<Gi088V8r3JudgePrescreenReport> {
  assertProviderIdentity({
    provider: input.provider,
    identity: input.providerIdentity,
    expected: createGi088V8r3ProProviderIdentity()
  });
  assertFormalCandidateReport(input.candidateReport);
  assertCalibrationReport(input.calibrationReport);
  if (
    input.calibrationReport.datasetFingerprint !==
    input.candidateReport.datasetFingerprint
  ) {
    throw new Error("GI088_V8R3_JUDGE_CALIBRATION_DATASET_MISMATCH");
  }
  const caseLookup = new Map(
    input.developmentCases.map((evaluationCase) => {
      const parsed = gi088V8r3EvaluationCaseSchema.parse(evaluationCase);
      if (parsed.partition !== "development") {
        throw new Error("GI088_V8R3_JUDGE_DEVELOPMENT_ONLY");
      }
      return [parsed.id, parsed] as const;
    })
  );
  const hiddenRecords = input.candidateReport.records.filter(
    (record) => record.partition === "hidden_admission"
  );
  const developmentRecords = input.candidateReport.records.filter(
    (record) => record.partition === "development"
  );
  const records = await mapWithConcurrency({
    items: developmentRecords,
    concurrency: input.concurrency ?? 2,
    run: async (record) => {
      const evaluationCase = caseLookup.get(record.caseId);
      if (!evaluationCase) {
        throw new Error(`GI088_V8R3_JUDGE_CASE_MISSING:${record.caseId}`);
      }
      const judgeCheckpoints = record.checkpoints.flatMap(
        (checkpoint, checkpointIndex) => {
          if (
            checkpoint.status !== "valid" ||
            !checkpoint.action ||
            !checkpoint.visibleResponse
          ) {
            return [];
          }
          const lastCall = checkpoint.calls.at(-1)!;
          return [
            {
              visibleConversation: getGi088V8r3ConversationAtCheckpoint(
                evaluationCase,
                checkpointIndex
              ).map(({ role, content }) => ({ role, content })),
              candidateVisibleOutput: {
                action: checkpoint.action,
                understanding: checkpoint.visibleUnderstanding,
                response: checkpoint.visibleResponse
              },
              safeTrace: {
                latencyMs: lastCall.safeTrace.latencyMs,
                automaticRecoveryCount: checkpoint.automaticRecoveryCount,
                contractValid: true,
                technicalFailure: false
              }
            }
          ];
        }
      );
      if (judgeCheckpoints.length !== record.checkpoints.length) {
        return {
          subjectId: `${record.caseId}:${record.attempt}`,
          sourcePartition: "development" as const,
          caseId: record.caseId,
          attempt: record.attempt,
          candidateStatus: record.status,
          status: "protected_failure" as const,
          requestHash: sha256(`${record.caseId}:${record.attempt}:judge-skipped`),
          responseHash: null,
          pass: null,
          blocker: null,
          primaryFailureCategory: null,
          rationaleHash: null,
          errorCode: "CANDIDATE_RESULT_NOT_JUDGEABLE",
          safeTrace: emptySafeTrace()
        };
      }
      const call = await executeJudgeCall({
        provider: input.provider,
        subjectId: `${record.caseId}:${record.attempt}`,
        sourcePartition: "development",
        checkpoints: judgeCheckpoints
      });
      return {
        ...call,
        caseId: record.caseId,
        attempt: record.attempt,
        candidateStatus: record.status
      };
    }
  });
  const now = input.now ?? (() => new Date());
  const reportWithoutFingerprint = {
    reportVersion:
      "2026-08-11.gi088-v8r3-judge-development-prescreen-v3" as const,
    createdAt: now().toISOString(),
    runtime: {
      ...input.providerIdentity,
      thinking: "enabled" as const,
      reasoningEffort: "high" as const
    },
    privacy: GI088_V8R3_OFFLINE_PRIVACY_CONTRACT,
    candidateOfflineRunFingerprint:
      input.candidateReport.offlineRunFingerprint,
    candidateEvidenceFingerprint: input.candidateReport.evidenceFingerprint,
    datasetFingerprint: input.candidateReport.datasetFingerprint,
    calibrationFingerprint: input.calibrationReport.calibrationFingerprint,
    calibrationPromoted: true as const,
    complete: records.every((record) => record.status === "valid"),
    hiddenAutomaticJudgement: "forbidden" as const,
    excludedHiddenRecordCount: hiddenRecords.length,
    budget: {
      authorizedMaximum: 56 as const,
      totalCalls: records.filter(
        (record) => record.errorCode !== "CANDIDATE_RESULT_NOT_JUDGEABLE"
      ).length
    },
    records
  };
  return {
    ...reportWithoutFingerprint,
    prescreenFingerprint: sha256(JSON.stringify(reportWithoutFingerprint))
  };
}

function assertPrescreenReport(
  input: unknown,
  bindings: {
    candidateReport: Gi088V8r3CandidateExecutionReport;
    calibrationReport: Gi088V8r3JudgeCalibrationReport;
  }
): asserts input is Gi088V8r3JudgePrescreenReport {
  if (
    !input ||
    typeof input !== "object" ||
    (input as { reportVersion?: unknown }).reportVersion !==
      "2026-08-11.gi088-v8r3-judge-development-prescreen-v3"
  ) {
    throw new Error("GI088_V8R3_JUDGE_PRESCREEN_REPORT_INVALID");
  }
  assertFormalCandidateReport(bindings.candidateReport);
  assertCalibrationReport(bindings.calibrationReport);
  const report = input as Gi088V8r3JudgePrescreenReport;
  const identity = {
    adapter: report.runtime.adapter,
    providerName: report.runtime.providerName,
    provider: report.runtime.provider,
    transport: report.runtime.transport,
    baseUrlHost: report.runtime.baseUrlHost,
    endpoint: report.runtime.endpoint,
    model: report.runtime.model,
    payloadContractVersion: report.runtime.payloadContractVersion
  };
  if (!stableJsonEqual(identity, createGi088V8r3ProProviderIdentity())) {
    throw new Error("GI088_V8R3_JUDGE_PRESCREEN_RUNTIME_IDENTITY_INVALID");
  }
  if (
    report.candidateOfflineRunFingerprint !==
      bindings.candidateReport.offlineRunFingerprint ||
    report.candidateEvidenceFingerprint !==
      bindings.candidateReport.evidenceFingerprint ||
    report.datasetFingerprint !== bindings.candidateReport.datasetFingerprint ||
    report.datasetFingerprint !== bindings.calibrationReport.datasetFingerprint ||
    report.calibrationFingerprint !==
      bindings.calibrationReport.calibrationFingerprint
  ) {
    throw new Error("GI088_V8R3_JUDGE_PRESCREEN_BINDING_MISMATCH");
  }
  if (
    report.calibrationPromoted !== true ||
    report.hiddenAutomaticJudgement !== "forbidden" ||
    report.complete !==
      report.records.every((record) => record.status === "valid") ||
    report.excludedHiddenRecordCount !== 24 ||
    report.budget.authorizedMaximum !== 56 ||
    report.records.length !== 56 ||
    report.records.some(
      (record) =>
        record.sourcePartition !== "development" ||
        !/^GI088-V8R3-D\d{2}$/u.test(record.caseId)
    ) ||
    new Set(report.records.map((record) => `${record.caseId}:${record.attempt}`))
      .size !== 56 ||
    report.budget.totalCalls !==
      report.records.filter(
        (record) => record.errorCode !== "CANDIDATE_RESULT_NOT_JUDGEABLE"
      ).length
  ) {
    throw new Error("GI088_V8R3_JUDGE_PRESCREEN_EVIDENCE_INVALID");
  }
  const { prescreenFingerprint, ...fingerprintPayload } = report;
  if (
    !/^[a-f0-9]{64}$/u.test(prescreenFingerprint) ||
    prescreenFingerprint !== sha256(JSON.stringify(fingerprintPayload))
  ) {
    throw new Error("GI088_V8R3_JUDGE_PRESCREEN_FINGERPRINT_MISMATCH");
  }
}

export function parseGi088V8r3JudgePrescreenReport(
  input: unknown,
  bindings: {
    candidateReport: Gi088V8r3CandidateExecutionReport;
    calibrationReport: Gi088V8r3JudgeCalibrationReport;
  }
) {
  assertPrescreenReport(input, bindings);
  return input;
}

function reviewContent(input: {
  evaluationCase: Gi088V8r3EvaluationCase;
  record: Gi088V8r3CandidateTrialRecord;
}) {
  return {
    workingTask: input.evaluationCase.workingTask,
    checkpoints: input.record.checkpoints.map((checkpoint, checkpointIndex) => ({
      checkpointIndex,
      visibleConversation: getGi088V8r3ConversationAtCheckpoint(
        input.evaluationCase,
        checkpointIndex
      ).map(({ role, content }) => ({ role, content })),
      candidateVisibleOutput:
        checkpoint.action && checkpoint.visibleResponse
          ? {
              action: checkpoint.action,
              understanding: checkpoint.visibleUnderstanding,
              response: checkpoint.visibleResponse
            }
          : null,
      safeTrace: {
        status: checkpoint.status,
        latencyMs: checkpoint.submitToVisibleLatencyMs,
        automaticRecoveryCount: checkpoint.automaticRecoveryCount,
        contractValid: checkpoint.status === "valid",
        technicalFailure: checkpoint.status === "technical_failure"
      }
    }))
  };
}

export function buildGi088V8r3HumanAdjudicationPacket(input: {
  candidateReport: Gi088V8r3CandidateExecutionReport;
  cases: readonly Gi088V8r3EvaluationCase[];
  seed: string;
}) {
  assertFormalCandidateReport(input.candidateReport);
  const caseLookup = new Map(
    input.cases.map((evaluationCase) => [evaluationCase.id, evaluationCase])
  );
  const ordered = [...input.candidateReport.records].sort((left, right) =>
    sha256(`${input.seed}:${left.caseId}:${left.attempt}`).localeCompare(
      sha256(`${input.seed}:${right.caseId}:${right.attempt}`)
    )
  );
  const items = ordered.map((record, index) => {
    const evaluationCase = caseLookup.get(record.caseId);
    if (!evaluationCase) {
      throw new Error(`GI088_V8R3_REVIEW_CASE_MISSING:${record.caseId}`);
    }
    const reviewId = sha256(
      `${input.seed}:${record.caseId}:${record.attempt}`
    ).slice(0, 20);
    const content = reviewContent({ evaluationCase, record });
    const reviewItemFingerprint = sha256(JSON.stringify(content));
    return {
      reviewIndex: index + 1,
      reviewId,
      reviewItemFingerprint,
      ...content
    };
  });
  if (items.length !== 80) {
    throw new Error("GI088_V8R3_HUMAN_ADJUDICATION_REQUIRES_80_RESULTS");
  }
  return {
    publicPacket: {
      packetVersion: "2026-08-11.gi088-v8r3-human-adjudication-packet-v2" as const,
      candidateOfflineRunFingerprint:
        input.candidateReport.offlineRunFingerprint,
      candidateEvidenceFingerprint: input.candidateReport.evidenceFingerprint,
      datasetFingerprint: input.candidateReport.datasetFingerprint,
      privacy: {
        privateOfflineArtifact: true,
        apiKey: "excluded",
        requestBody: "excluded",
        rawModelOutput: "excluded",
        hiddenReasoningBody: "excluded"
      },
      modelIdentityVisibleToReviewer: false,
      items
    },
    sealedKey: {
      keyVersion: "2026-08-11.gi088-v8r3-human-adjudication-key-v2" as const,
      candidateOfflineRunFingerprint:
        input.candidateReport.offlineRunFingerprint,
      candidateEvidenceFingerprint: input.candidateReport.evidenceFingerprint,
      datasetFingerprint: input.candidateReport.datasetFingerprint,
      items: ordered.map((record, index) => ({
        reviewId: items[index]!.reviewId,
        reviewItemFingerprint: items[index]!.reviewItemFingerprint,
        caseId: record.caseId,
        attempt: record.attempt,
        partition: record.partition
      }))
    },
    adjudicationTemplate: {
      version: "2026-08-11.gi088-v8r3-human-adjudication-v2" as const,
      candidateOfflineRunFingerprint:
        input.candidateReport.offlineRunFingerprint,
      candidateEvidenceFingerprint: input.candidateReport.evidenceFingerprint,
      datasetFingerprint: input.candidateReport.datasetFingerprint,
      items: items.map((item) => ({
        reviewId: item.reviewId,
        reviewItemFingerprint: item.reviewItemFingerprint,
        reviewer: null,
        result: null
      }))
    }
  };
}

export function buildGi088V8r3PendingReviewPacket(input: {
  candidateReport: Gi088V8r3CandidateExecutionReport;
  cases: readonly Gi088V8r3EvaluationCase[];
  seed: string;
}) {
  return buildGi088V8r3HumanAdjudicationPacket(input).publicPacket;
}

const badCaseArchiveFileSchema = z
  .object({
    version: z.literal("2026-08-11.gi088-v8r3-bad-case-archive-v1"),
    candidateOfflineRunFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    candidateEvidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    adjudicationEvidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    datasetFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    badCasePacketFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    items: z.array(
      z
        .object({
          badCaseId: z.string().regex(/^[a-f0-9]{20}$/u),
          badCaseEvidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
          category: gi088V8r3BadCaseCategorySchema,
          archivedBy: z
            .object({
              reviewerId: z.string().trim().min(1).max(160),
              source: z.enum(["product_owner", "trained_human_reviewer"]),
              reviewedAt: z.string().datetime({ offset: true })
            })
            .strict(),
          rationale: z.string().trim().min(1).max(1_000)
        })
        .strict()
    )
  })
  .strict();

export type Gi088V8r3BadCaseArchiveFile = z.infer<
  typeof badCaseArchiveFileSchema
>;

export function buildGi088V8r3BadCasePacket(input: {
  candidateReport: Gi088V8r3CandidateExecutionReport;
  adjudicationFile: Gi088V8r3HumanAdjudicationFile;
  cases: readonly Gi088V8r3EvaluationCase[];
}) {
  assertFormalCandidateReport(input.candidateReport);
  const adjudication = gi088V8r3HumanAdjudicationFileSchema.parse(
    input.adjudicationFile
  );
  if (
    adjudication.candidateOfflineRunFingerprint !==
      input.candidateReport.offlineRunFingerprint ||
    adjudication.candidateEvidenceFingerprint !==
      input.candidateReport.evidenceFingerprint ||
    adjudication.datasetFingerprint !== input.candidateReport.datasetFingerprint
  ) {
    throw new Error("GI088_V8R3_BAD_CASE_ADJUDICATION_BINDING_MISMATCH");
  }
  const humanPacket = buildGi088V8r3HumanAdjudicationPacket({
    candidateReport: input.candidateReport,
    cases: input.cases,
    seed: input.candidateReport.offlineRunFingerprint
  });
  const keyByReviewId = new Map(
    humanPacket.sealedKey.items.map((item) => [item.reviewId, item])
  );
  const recordByKey = new Map(
    input.candidateReport.records.map((record) => [
      `${record.caseId}:${record.attempt}`,
      record
    ])
  );
  const caseById = new Map(
    input.cases.map((evaluationCase) => [evaluationCase.id, evaluationCase])
  );
  const items = adjudication.items.flatMap((item) => {
    const key = keyByReviewId.get(item.reviewId);
    if (!key || key.reviewItemFingerprint !== item.reviewItemFingerprint) {
      throw new Error(`GI088_V8R3_BAD_CASE_ITEM_MISMATCH:${item.reviewId}`);
    }
    keyByReviewId.delete(item.reviewId);
    const result = gi088V8r3TrialResultSchema.parse({
      caseId: key.caseId,
      attempt: key.attempt,
      ...item.result
    });
    const record = recordByKey.get(`${key.caseId}:${key.attempt}`);
    const evaluationCase = caseById.get(key.caseId);
    if (!record || !evaluationCase) {
      throw new Error(`GI088_V8R3_BAD_CASE_SOURCE_MISSING:${item.reviewId}`);
    }
    const isBadCase =
      record.status !== "valid" ||
      result.outcome !== "pass" ||
      result.quality !== "direct_use" ||
      result.singleCaseBlocker ||
      result.primaryFailureCategory !== "none";
    if (!isBadCase) return [];
    const visibleEvidence = reviewContent({ evaluationCase, record }).checkpoints;
    const humanLabel = {
      outcome: result.outcome,
      quality: result.quality,
      singleCaseBlocker: result.singleCaseBlocker,
      primaryFailureCategory: result.primaryFailureCategory,
      source: item.reviewer.source,
      reviewedAt: item.reviewer.reviewedAt
    };
    const evidencePayload = {
      reviewId: item.reviewId,
      caseId: key.caseId,
      attempt: key.attempt,
      visibleEvidence,
      humanLabel
    };
    const badCaseEvidenceFingerprint = sha256(JSON.stringify(evidencePayload));
    return [
      {
        badCaseId: badCaseEvidenceFingerprint.slice(0, 20),
        badCaseEvidenceFingerprint,
        ...evidencePayload
      }
    ];
  });
  if (keyByReviewId.size > 0) {
    throw new Error("GI088_V8R3_BAD_CASE_ADJUDICATION_INCOMPLETE");
  }
  const adjudicationEvidenceFingerprint = sha256(
    JSON.stringify(adjudication)
  );
  const packetWithoutFingerprint = {
    packetVersion: "2026-08-11.gi088-v8r3-bad-case-packet-v1" as const,
    candidateOfflineRunFingerprint:
      input.candidateReport.offlineRunFingerprint,
    candidateEvidenceFingerprint: input.candidateReport.evidenceFingerprint,
    adjudicationEvidenceFingerprint,
    datasetFingerprint: input.candidateReport.datasetFingerprint,
    privacy: {
      visibleConversationOnly: true,
      safeTraceOnly: true,
      humanLabelsIncluded: true,
      requestBody: "excluded" as const,
      rawModelOutput: "excluded" as const,
      hiddenReasoningBody: "excluded" as const,
      providerRequestId: "excluded" as const
    },
    items
  };
  const badCasePacketFingerprint = sha256(
    JSON.stringify(packetWithoutFingerprint)
  );
  return {
    publicPacket: {
      ...packetWithoutFingerprint,
      badCasePacketFingerprint
    },
    archiveTemplate: {
      version: "2026-08-11.gi088-v8r3-bad-case-archive-v1" as const,
      candidateOfflineRunFingerprint:
        input.candidateReport.offlineRunFingerprint,
      candidateEvidenceFingerprint: input.candidateReport.evidenceFingerprint,
      adjudicationEvidenceFingerprint,
      datasetFingerprint: input.candidateReport.datasetFingerprint,
      badCasePacketFingerprint,
      items: items.map((item) => ({
        badCaseId: item.badCaseId,
        badCaseEvidenceFingerprint: item.badCaseEvidenceFingerprint,
        category: null,
        archivedBy: null,
        rationale: null
      }))
    }
  };
}

export function executeGi088V8r3BadCaseArchive(input: {
  badCasePacket: ReturnType<typeof buildGi088V8r3BadCasePacket>["publicPacket"];
  archiveFile: Gi088V8r3BadCaseArchiveFile;
  now?: () => Date;
}) {
  const archive = badCaseArchiveFileSchema.parse(input.archiveFile);
  const packet = input.badCasePacket;
  const { badCasePacketFingerprint, ...packetFingerprintPayload } = packet;
  if (
    badCasePacketFingerprint !== sha256(JSON.stringify(packetFingerprintPayload)) ||
    archive.candidateOfflineRunFingerprint !==
      packet.candidateOfflineRunFingerprint ||
    archive.candidateEvidenceFingerprint !== packet.candidateEvidenceFingerprint ||
    archive.adjudicationEvidenceFingerprint !==
      packet.adjudicationEvidenceFingerprint ||
    archive.datasetFingerprint !== packet.datasetFingerprint ||
    archive.badCasePacketFingerprint !== badCasePacketFingerprint
  ) {
    throw new Error("GI088_V8R3_BAD_CASE_ARCHIVE_BINDING_MISMATCH");
  }
  const archiveById = new Map(
    archive.items.map((item) => [item.badCaseId, item])
  );
  const archivedAt = (input.now ?? (() => new Date()))();
  const archivedItems = packet.items.map((item) => {
    const classification = archiveById.get(item.badCaseId);
    if (
      !classification ||
      classification.badCaseEvidenceFingerprint !==
        item.badCaseEvidenceFingerprint
    ) {
      throw new Error(`GI088_V8R3_BAD_CASE_ARCHIVE_ITEM_MISMATCH:${item.badCaseId}`);
    }
    const classificationAt = Date.parse(classification.archivedBy.reviewedAt);
    if (
      classificationAt < Date.parse(item.humanLabel.reviewedAt) ||
      classificationAt > archivedAt.getTime()
    ) {
      throw new Error(
        `GI088_V8R3_BAD_CASE_ARCHIVE_TIME_INVALID:${item.badCaseId}`
      );
    }
    archiveById.delete(item.badCaseId);
    return { ...item, classification };
  });
  if (archiveById.size > 0) {
    throw new Error("GI088_V8R3_BAD_CASE_ARCHIVE_HAS_UNKNOWN_ITEMS");
  }
  const archiveWithoutFingerprint = {
    reportVersion: "2026-08-11.gi088-v8r3-bad-case-archive-report-v1" as const,
    createdAt: archivedAt.toISOString(),
    badCasePacketFingerprint,
    candidateOfflineRunFingerprint: packet.candidateOfflineRunFingerprint,
    candidateEvidenceFingerprint: packet.candidateEvidenceFingerprint,
    adjudicationEvidenceFingerprint: packet.adjudicationEvidenceFingerprint,
    datasetFingerprint: packet.datasetFingerprint,
    privacy: packet.privacy,
    archivedItems
  };
  return {
    ...archiveWithoutFingerprint,
    archiveFingerprint: sha256(JSON.stringify(archiveWithoutFingerprint))
  };
}

export type Gi088V8r3AdmissionReport = {
  reportVersion: "2026-08-11.gi088-v8r3-admission-report-v3";
  createdAt: string;
  admissionFingerprint: string;
  candidateOfflineRunFingerprint: string;
  candidateEvidenceFingerprint: string;
  datasetFingerprint: string;
  evidenceBindings: {
    candidateOfflineRunFingerprint: string;
    candidateEvidenceFingerprint: string;
    adjudicationEvidenceFingerprint: string;
    judgeCalibrationFingerprint: string;
    judgePrescreenFingerprint: string;
    datasetFingerprint: string;
  };
  modelIdentityBindings: {
    candidate: Gi088V8r3ProviderIdentity;
    judgeCalibration: Gi088V8r3ProviderIdentity;
    judgePrescreen: Gi088V8r3ProviderIdentity;
  };
  deterministic: { passed: boolean; caseCount: number; validatorAssertionCount: number };
  passSquared: {
    development: { passed: boolean; passCount: number; caseCount: number };
    hidden: { passed: boolean; passCount: number; caseCount: number };
  };
  gates: {
    quality: ReturnType<typeof evaluateGi088V8r3HiddenQualityGate>;
    reliability: ReturnType<typeof evaluateGi088V8r3ReliabilityGate>;
    latency: ReturnType<
      typeof evaluateGi088V8r3CandidateOperationalGates
    >["latency"];
  };
  humanEvidence: {
    reviewCount: number;
    reviewerCount: number;
    sources: Array<"product_owner" | "trained_human_reviewer">;
    earliestReviewedAt: string;
    latestReviewedAt: string;
  };
  passed: boolean;
};

export function executeGi088V8r3Admission(input: {
  candidateReport: Gi088V8r3CandidateExecutionReport;
  adjudicationFile: Gi088V8r3HumanAdjudicationFile;
  calibrationReport: Gi088V8r3JudgeCalibrationReport;
  prescreenReport: Gi088V8r3JudgePrescreenReport;
  deterministicRegression: readonly Gi088V8r3EvaluationCase[];
  developmentCases: readonly Gi088V8r3EvaluationCase[];
  hiddenAdmissionCases: readonly Gi088V8r3EvaluationCase[];
  now?: () => Date;
}): Gi088V8r3AdmissionReport {
  assertFormalCandidateReport(input.candidateReport);
  assertCalibrationReport(input.calibrationReport);
  assertPrescreenReport(input.prescreenReport, {
    candidateReport: input.candidateReport,
    calibrationReport: input.calibrationReport
  });
  if (input.prescreenReport.complete !== true) {
    throw new Error("GI088_V8R3_JUDGE_PRESCREEN_INCOMPLETE");
  }
  validateGi088V8r3DatasetPartitions({
    deterministicRegression: input.deterministicRegression,
    development: input.developmentCases,
    hiddenAdmission: input.hiddenAdmissionCases
  });
  const adjudication = gi088V8r3HumanAdjudicationFileSchema.parse(
    input.adjudicationFile
  );
  if (
    adjudication.candidateOfflineRunFingerprint !==
      input.candidateReport.offlineRunFingerprint ||
    adjudication.candidateEvidenceFingerprint !==
      input.candidateReport.evidenceFingerprint ||
    adjudication.datasetFingerprint !== input.candidateReport.datasetFingerprint
  ) {
    throw new Error("GI088_V8R3_ADJUDICATION_FINGERPRINT_MISMATCH");
  }
  const packet = buildGi088V8r3HumanAdjudicationPacket({
    candidateReport: input.candidateReport,
    cases: [...input.developmentCases, ...input.hiddenAdmissionCases],
    seed: input.candidateReport.offlineRunFingerprint
  });
  const keyByReviewId = new Map(
    packet.sealedKey.items.map((item) => [item.reviewId, item])
  );
  const results: Gi088V8r3TrialResult[] = adjudication.items.map((item) => {
    const key = keyByReviewId.get(item.reviewId);
    if (
      !key ||
      key.reviewItemFingerprint !== item.reviewItemFingerprint
    ) {
      throw new Error(`GI088_V8R3_ADJUDICATION_ITEM_MISMATCH:${item.reviewId}`);
    }
    keyByReviewId.delete(item.reviewId);
    return gi088V8r3TrialResultSchema.parse({
      caseId: key.caseId,
      attempt: key.attempt,
      ...item.result
    });
  });
  if (keyByReviewId.size > 0) {
    throw new Error("GI088_V8R3_ADJUDICATION_INCOMPLETE");
  }
  const developmentIds = new Set(input.developmentCases.map((item) => item.id));
  const hiddenIds = new Set(input.hiddenAdmissionCases.map((item) => item.id));
  const developmentResults = results.filter((result) =>
    developmentIds.has(result.caseId)
  );
  const hiddenResults = results.filter((result) => hiddenIds.has(result.caseId));
  const developmentPassSquared = summarizeGi088V8r3PassSquared({
    cases: input.developmentCases,
    results: developmentResults
  });
  const hiddenPassSquared = summarizeGi088V8r3PassSquared({
    cases: input.hiddenAdmissionCases,
    results: hiddenResults
  });
  const quality = evaluateGi088V8r3HiddenQualityGate({
    cases: input.hiddenAdmissionCases,
    results: hiddenResults
  });
  const operational = evaluateGi088V8r3CandidateOperationalGates(
    input.candidateReport
  );
  const deterministic = runGi088V8r3DeterministicRegression(
    input.deterministicRegression
  );
  const reviewedAt = adjudication.items
    .map((item) => item.reviewer.reviewedAt)
    .sort();
  const admissionNow = (input.now ?? (() => new Date()))();
  const candidateCreatedAt = Date.parse(input.candidateReport.createdAt);
  if (
    reviewedAt.some((value) => {
      const timestamp = Date.parse(value);
      return timestamp < candidateCreatedAt || timestamp > admissionNow.getTime();
    })
  ) {
    throw new Error("GI088_V8R3_ADJUDICATION_REVIEW_TIME_INVALID");
  }
  const humanSources = [
    ...new Set(adjudication.items.map((item) => item.reviewer.source))
  ].sort();
  const developmentPassed =
    developmentPassSquared.passCount === input.developmentCases.length;
  const hiddenPassed = hiddenPassSquared.passCount === input.hiddenAdmissionCases.length;
  const candidateIdentity: Gi088V8r3ProviderIdentity = {
    adapter: input.candidateReport.runtime.adapter,
    providerName: input.candidateReport.runtime.providerName,
    provider: input.candidateReport.runtime.provider,
    transport: input.candidateReport.runtime.transport,
    baseUrlHost: input.candidateReport.runtime.baseUrlHost,
    endpoint: input.candidateReport.runtime.endpoint,
    model: input.candidateReport.runtime.model,
    payloadContractVersion:
      input.candidateReport.runtime.payloadContractVersion
  };
  const judgeIdentity = (runtime: Gi088V8r3ProviderIdentity): Gi088V8r3ProviderIdentity => ({
    adapter: runtime.adapter,
    providerName: runtime.providerName,
    provider: runtime.provider,
    transport: runtime.transport,
    baseUrlHost: runtime.baseUrlHost,
    endpoint: runtime.endpoint,
    model: runtime.model,
    payloadContractVersion: runtime.payloadContractVersion
  });
  const evidenceBindings = {
    candidateOfflineRunFingerprint:
      input.candidateReport.offlineRunFingerprint,
    candidateEvidenceFingerprint: input.candidateReport.evidenceFingerprint,
    adjudicationEvidenceFingerprint: sha256(JSON.stringify(adjudication)),
    judgeCalibrationFingerprint:
      input.calibrationReport.calibrationFingerprint,
    judgePrescreenFingerprint: input.prescreenReport.prescreenFingerprint,
    datasetFingerprint: input.candidateReport.datasetFingerprint
  };
  const reportWithoutFingerprint = {
    reportVersion: "2026-08-11.gi088-v8r3-admission-report-v3" as const,
    createdAt: admissionNow.toISOString(),
    candidateOfflineRunFingerprint:
      input.candidateReport.offlineRunFingerprint,
    candidateEvidenceFingerprint: input.candidateReport.evidenceFingerprint,
    datasetFingerprint: input.candidateReport.datasetFingerprint,
    evidenceBindings,
    modelIdentityBindings: {
      candidate: candidateIdentity,
      judgeCalibration: judgeIdentity(input.calibrationReport.runtime),
      judgePrescreen: judgeIdentity(input.prescreenReport.runtime)
    },
    deterministic: {
      passed: deterministic.passed,
      caseCount: deterministic.caseCount,
      validatorAssertionCount: deterministic.validatorAssertionCount
    },
    passSquared: {
      development: {
        passed: developmentPassed,
        passCount: developmentPassSquared.passCount,
        caseCount: input.developmentCases.length
      },
      hidden: {
        passed: hiddenPassed,
        passCount: hiddenPassSquared.passCount,
        caseCount: input.hiddenAdmissionCases.length
      }
    },
    gates: {
      quality,
      reliability: operational.reliability,
      latency: operational.latency
    },
    humanEvidence: {
      reviewCount: adjudication.items.length,
      reviewerCount: new Set(
        adjudication.items.map((item) => item.reviewer.reviewerId)
      ).size,
      sources: humanSources,
      earliestReviewedAt: reviewedAt[0]!,
      latestReviewedAt: reviewedAt.at(-1)!
    },
    passed:
      deterministic.passed &&
      developmentPassed &&
      hiddenPassed &&
      quality.passed &&
      operational.reliability.passed &&
      operational.latency.passed
  };
  return {
    ...reportWithoutFingerprint,
    admissionFingerprint: sha256(JSON.stringify(reportWithoutFingerprint))
  };
}

export function parseGi088V8r3AdmissionReport(
  input: unknown
): Gi088V8r3AdmissionReport {
  if (
    !input ||
    typeof input !== "object" ||
    (input as { reportVersion?: unknown }).reportVersion !==
      "2026-08-11.gi088-v8r3-admission-report-v3"
  ) {
    throw new Error("GI088_V8R3_ADMISSION_REPORT_INVALID");
  }
  const report = input as Gi088V8r3AdmissionReport;
  const { admissionFingerprint, ...fingerprintPayload } = report;
  if (
    !/^[a-f0-9]{64}$/u.test(admissionFingerprint) ||
    admissionFingerprint !== sha256(JSON.stringify(fingerprintPayload))
  ) {
    throw new Error("GI088_V8R3_ADMISSION_FINGERPRINT_MISMATCH");
  }
  if (
    report.candidateOfflineRunFingerprint !==
      report.evidenceBindings.candidateOfflineRunFingerprint ||
    report.candidateEvidenceFingerprint !==
      report.evidenceBindings.candidateEvidenceFingerprint ||
    report.datasetFingerprint !== report.evidenceBindings.datasetFingerprint ||
    !stableJsonEqual(
      report.modelIdentityBindings.candidate,
      createGi088V8r3ArkProviderIdentity()
    ) ||
    !stableJsonEqual(
      report.modelIdentityBindings.judgeCalibration,
      createGi088V8r3ProProviderIdentity()
    ) ||
    !stableJsonEqual(
      report.modelIdentityBindings.judgePrescreen,
      createGi088V8r3ProProviderIdentity()
    )
  ) {
    throw new Error("GI088_V8R3_ADMISSION_EVIDENCE_BINDING_INVALID");
  }
  for (const fingerprint of Object.values(report.evidenceBindings)) {
    if (!/^[a-f0-9]{64}$/u.test(fingerprint)) {
      throw new Error("GI088_V8R3_ADMISSION_EVIDENCE_BINDING_INVALID");
    }
  }
  return report;
}

export const GI088_V8R3_HISTORICAL_BASELINE_VERSION =
  "2026-08-11.gi088-v8r3-historical-visible-baseline-v1" as const;
export const GI088_V8R3_ALLOWED_HISTORICAL_CANDIDATE_VERSION =
  "2026-08-10.gi088-human-eval-v8r2-foundation-hardening" as const;

const historicalBaselineRecordSchema = z
  .object({
    caseId: z.string().regex(/^GI088-V8R3-(D|H)\d{2}$/u),
    partition: z.enum(["development", "hidden_admission"]),
    attempt: z.union([z.literal(1), z.literal(2)]),
    visibleOutput: z
      .object({
        understanding: z.string().max(2_000).nullable(),
        response: z.string().trim().min(1).max(4_000)
      })
      .strict(),
    sourceEvidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/u)
  })
  .strict();

const historicalBaselineModelIdentitySchema = z
  .object({
    adapter: z.literal("openai"),
    providerName: z.literal("openai"),
    provider: z.literal("deepseek_official"),
    transport: z.literal("openai_compatible_rest"),
    baseUrlHost: z.string().trim().min(1).max(255),
    endpoint: z.string().trim().min(1).max(255),
    model: z.string().trim().min(1).max(255),
    runtimePolicyVersion: z.string().trim().min(1).max(255),
    thinking: z.literal("enabled"),
    reasoningEffort: z.literal("high"),
    responseFormat: z.literal("json_object")
  })
  .strict();

export const gi088V8r3HistoricalBaselineReportSchema = z
  .object({
    version: z.literal(GI088_V8R3_HISTORICAL_BASELINE_VERSION),
    historicalCandidateVersion: z.literal(
      GI088_V8R3_ALLOWED_HISTORICAL_CANDIDATE_VERSION
    ),
    modelIdentity: historicalBaselineModelIdentitySchema,
    alignedDatasetFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    evidenceSource: z.literal("independent_visible_output_capture"),
    records: z.array(historicalBaselineRecordSchema).length(80),
    baselineEvidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/u)
  })
  .strict();

export type Gi088V8r3HistoricalBaselineReport = z.infer<
  typeof gi088V8r3HistoricalBaselineReportSchema
>;

export function createGi088V8r3HistoricalBaselineModelIdentity() {
  return {
    adapter: "openai" as const,
    providerName: "openai" as const,
    provider: "deepseek_official" as const,
    transport: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.transport,
    baseUrlHost: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.baseUrlHost,
    endpoint: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.endpoint,
    model: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.model,
    runtimePolicyVersion: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.version,
    thinking: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.thinking,
    reasoningEffort: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.reasoningEffort,
    responseFormat: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.responseFormat
  };
}

export function createGi088V8r3HistoricalBaselineRecordFingerprint(
  record: Omit<
    z.infer<typeof historicalBaselineRecordSchema>,
    "sourceEvidenceFingerprint"
  >
) {
  return sha256(
    JSON.stringify({
      evidenceKind: "gi088-v8r3-independent-visible-output",
      ...record
    })
  );
}

export function createGi088V8r3HistoricalBaselineEvidenceFingerprint(
  input: Omit<Gi088V8r3HistoricalBaselineReport, "baselineEvidenceFingerprint">
) {
  return sha256(JSON.stringify(input));
}

export function parseGi088V8r3HistoricalBaselineReport(
  input: unknown
): Gi088V8r3HistoricalBaselineReport {
  const report = gi088V8r3HistoricalBaselineReportSchema.parse(input);
  if (
    !stableJsonEqual(
      report.modelIdentity,
      createGi088V8r3HistoricalBaselineModelIdentity()
    )
  ) {
    throw new Error("GI088_V8R3_HISTORICAL_BASELINE_MODEL_IDENTITY_INVALID");
  }
  const keys = new Set<string>();
  for (const record of report.records) {
    const expectedPartition = record.caseId.includes("-D")
      ? "development"
      : "hidden_admission";
    const { sourceEvidenceFingerprint, ...fingerprintPayload } = record;
    if (
      record.partition !== expectedPartition ||
      sourceEvidenceFingerprint !==
        createGi088V8r3HistoricalBaselineRecordFingerprint(fingerprintPayload)
    ) {
      throw new Error("GI088_V8R3_HISTORICAL_BASELINE_RECORD_INVALID");
    }
    const key = `${record.caseId}:${record.attempt}`;
    if (keys.has(key)) {
      throw new Error("GI088_V8R3_HISTORICAL_BASELINE_DUPLICATE_RECORD");
    }
    keys.add(key);
  }
  const developmentCount = report.records.filter(
    (record) => record.partition === "development"
  ).length;
  const hiddenCount = report.records.filter(
    (record) => record.partition === "hidden_admission"
  ).length;
  const { baselineEvidenceFingerprint, ...fingerprintPayload } = report;
  if (
    developmentCount !== 56 ||
    hiddenCount !== 24 ||
    baselineEvidenceFingerprint !==
      createGi088V8r3HistoricalBaselineEvidenceFingerprint(fingerprintPayload)
  ) {
    throw new Error("GI088_V8R3_HISTORICAL_BASELINE_EVIDENCE_INVALID");
  }
  return report;
}

export function buildGi088V8r3BlindComparisonPacket(input: {
  candidateReport: Gi088V8r3CandidateExecutionReport;
  baselineReport: Gi088V8r3HistoricalBaselineReport;
  seed: string;
}) {
  assertFormalCandidateReport(input.candidateReport);
  const baselineReport = parseGi088V8r3HistoricalBaselineReport(
    input.baselineReport
  );
  if (
    baselineReport.alignedDatasetFingerprint !==
    input.candidateReport.datasetFingerprint
  ) {
    throw new Error("GI088_V8R3_HISTORICAL_BASELINE_DATASET_MISMATCH");
  }
  const baselineByKey = new Map(
    baselineReport.records.map((record) => [
      `${record.caseId}:${record.attempt}`,
      record
    ])
  );
  const publicPairs: Array<{
    pairId: string;
    caseId: string;
    attempt: 1 | 2;
    a: { understanding: string | null; response: string | null };
    b: { understanding: string | null; response: string | null };
  }> = [];
  const sealedKey: Array<{ pairId: string; a: string; b: string }> = [];
  for (const candidate of input.candidateReport.records) {
    const baseline = baselineByKey.get(`${candidate.caseId}:${candidate.attempt}`);
    if (!baseline) continue;
    const order = createGi088V8r3BlindPair({
      caseId: `${candidate.caseId}:${candidate.attempt}`,
      seed: input.seed,
      candidateVersion: input.candidateReport.offlineRunFingerprint,
      baselineVersion: baselineReport.baselineEvidenceFingerprint
    });
    const candidateFirst =
      order.a === input.candidateReport.offlineRunFingerprint;
    const pairId = sha256(
      `${input.seed}:${candidate.caseId}:${candidate.attempt}`
    ).slice(0, 20);
    const candidateVisible = (record: Gi088V8r3CandidateTrialRecord) => ({
      understanding: record.visibleUnderstanding,
      response: record.visibleResponse
    });
    const baselineVisible = () => baseline.visibleOutput;
    publicPairs.push({
      pairId,
      caseId: candidate.caseId,
      attempt: candidate.attempt,
      a: candidateFirst ? candidateVisible(candidate) : baselineVisible(),
      b: candidateFirst ? baselineVisible() : candidateVisible(candidate)
    });
    sealedKey.push({ pairId, a: order.a, b: order.b });
  }
  if (publicPairs.length !== 80 || sealedKey.length !== 80) {
    throw new Error("GI088_V8R3_HISTORICAL_BASELINE_PAIRING_INCOMPLETE");
  }
  return {
    publicPacket: {
      packetVersion: "2026-08-11.gi088-v8r3-blind-pairs-v1" as const,
      modelIdentityVisibleToReviewer: false,
      reviewChannel: "human_blind_comparison" as const,
      automaticJudgeEligible: false,
      hiddenAutomaticJudgement: "forbidden" as const,
      pairs: publicPairs
    },
    sealedKey: {
      keyVersion: "2026-08-11.gi088-v8r3-blind-key-v1" as const,
      historicalCandidateVersion: baselineReport.historicalCandidateVersion,
      baselineEvidenceFingerprint:
        baselineReport.baselineEvidenceFingerprint,
      baselineModelIdentity: baselineReport.modelIdentity,
      pairs: sealedKey
    }
  };
}
