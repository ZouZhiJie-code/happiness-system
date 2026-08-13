import { createHash } from "node:crypto";
import { chmod, link, mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAICompletionTokenUsage,
  sanitizeAIProviderDiagnostics,
  type AICompletionResult,
  type AIProvider,
  type AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import type {
  Gi088CanonicalInterviewStateV2,
  Gi088ProjectionReceiptV1,
  Gi088SemanticProposalV2
} from "@/server/services/evaluation/gi088/canonical-interview-state-v2";
import {
  computeGi088ProContractReviewSourceFingerprint,
  GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH,
  GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_SOURCE_PATH,
  GI088_PRO_CONTRACT_HIDDEN_PRIVATE_REPORT_PATH,
  GI088_PRO_CONTRACT_HIDDEN_REVIEW_SOURCE_PATH,
  gi088ProContractSha256,
  gi088ProContractStableJson,
  type Gi088ProContractBlindCandidate,
  type Gi088ProContractDevelopmentReviewSourceV1,
  type Gi088ProContractHiddenReviewSourceV1,
  type Gi088ProContractTechnicalSummary
} from "@/server/services/evaluation/gi088/pro-contract-review-contract";
import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import type { Gi088V8r3EvaluationCase } from "../gi088-v8r3-skill-evaluation/contracts";
import {
  createGi088V8r3CaseFingerprint,
  createGi088V8r3CaseSetCommitment,
  getGi088V8r3ConversationAtCheckpoint
} from "../gi088-v8r3-skill-evaluation/runner";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM,
  GI088_PRO_CONTRACT_DEVELOPMENT_RESULT_COUNT_PER_GROUP,
  GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_CASE_IDS,
  GI088_PRO_CONTRACT_HIDDEN_CALLS_MAXIMUM,
  GI088_PRO_CONTRACT_HIDDEN_RESULT_COUNT,
  GI088_PRO_CONTRACT_HIDDEN_TECHNICAL_VALID_MINIMUM,
  GI088_PRO_CONTRACT_IDENTITY,
  GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
  GI088_PRO_CONTRACT_PAIRED_REPORT_VERSION,
  GI088_PRO_CONTRACT_TECHNICAL_VALID_MINIMUM,
  GI088_PRO_CONTRACT_TOTAL_CALLS_MAXIMUM,
  createGi088ProContractCompletionParams,
  createGi088ProContractDevelopmentSchedule,
  createGi088ProContractDiagnosticFingerprint,
  createGi088ProContractGroupDefinition,
  decideGi088ProContractControl,
  type Gi088ProContractGroup,
  type Gi088ProContractToolSourceFingerprint
} from "./contracts";

type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type SafeTrace = {
  latencyMs: number | null;
  finishReason: AIProviderDiagnostics["finishReason"];
  reasoningPresent: boolean | null;
  reasoningLength: number | null;
  reasoningTokens: number | null;
  tokenUsage: ReturnType<typeof sanitizeAICompletionTokenUsage>;
  httpStatus: number | null;
  responseModel: string | null;
  choiceCount: number | null;
  contentType: string | null;
  contentLength: number | null;
  headersLatencyMs: number | null;
  bodyLatencyMs: number | null;
  totalLatencyMs: number | null;
  timeoutStage: string | null;
  abortSource: string | null;
  upstreamRequestIdHash: string | null;
};

export type Gi088ProContractFailureCategory =
  | "provider"
  | "contract"
  | "semantic"
  | "projection"
  | "state_commit";

export type Gi088ProContractProjectionResult = {
  proposal: Gi088SemanticProposalV2 | unknown;
  receipt: Gi088ProjectionReceiptV1;
  state: Gi088CanonicalInterviewStateV2;
  visible: { understanding: string | null; response: string };
  action: "acknowledge" | "ask" | "synthesize" | "pause";
  evidenceRefs: string[];
  answerTarget: string | null;
  commitDiagnostics: {
    projectionAmbiguous: boolean;
    stateInvariantFailure: boolean;
    duplicateCommit: boolean;
    statePollution: boolean;
  };
};

export type Gi088ProContractStateAdapter = {
  createInitial(input: {
    caseId: string;
    workingTask: string;
    evidenceRefs: string[];
  }): Gi088CanonicalInterviewStateV2;
  toFullTurnInput(input: {
    state: Gi088CanonicalInterviewStateV2;
    conversation: ConversationMessage[];
    latestUserMessageId: string;
  }): Board7bWorkingTaskV1TurnInput;
  parseAndProject(input: {
    group: Gi088ProContractGroup;
    state: Gi088CanonicalInterviewStateV2;
    content: string;
    conversation: ConversationMessage[];
    latestUserMessageId: string;
  }): Gi088ProContractProjectionResult;
  projectExplicitStop(input: {
    state: Gi088CanonicalInterviewStateV2;
    conversation: ConversationMessage[];
    latestUserMessageId: string;
  }): Gi088ProContractProjectionResult;
  projectMixedStop(input: {
    inputState: Gi088CanonicalInterviewStateV2;
    semanticResult: Gi088ProContractProjectionResult;
    latestUserMessageId: string;
  }): Gi088ProContractProjectionResult;
  assertState(state: Gi088CanonicalInterviewStateV2): Gi088CanonicalInterviewStateV2;
  stateHash(state: Gi088CanonicalInterviewStateV2): string;
};

export class Gi088ProContractProjectionError extends Error {
  readonly category: Exclude<Gi088ProContractFailureCategory, "provider">;
  readonly issues: string[];
  readonly proposal: unknown | null;
  readonly receipt: Gi088ProjectionReceiptV1 | null;

  constructor(input: {
    category: Exclude<Gi088ProContractFailureCategory, "provider">;
    code: string;
    issues?: string[];
    proposal?: unknown | null;
    receipt?: Gi088ProjectionReceiptV1 | null;
  }) {
    super(input.code);
    this.name = "Gi088ProContractProjectionError";
    this.category = input.category;
    this.issues = input.issues ?? [input.code];
    this.proposal = input.proposal ?? null;
    this.receipt = input.receipt ?? null;
  }
}

export type Gi088ProContractRecord = {
  resultIndex: number;
  trialIndex: number;
  partition: "development" | "hidden_admission";
  caseId: string;
  workingTask: string;
  caseFingerprint: string;
  checkpointIndex: number;
  attempt: 1 | 2;
  group: Gi088ProContractGroup;
  providerCalled: boolean;
  programOwnedStop: boolean;
  blockedByPriorFailure: boolean;
  effectiveValid: boolean;
  failureCategory: Gi088ProContractFailureCategory | null;
  failureIssues: string[];
  semanticInputHash: string;
  requestHash: string;
  responseHash: string | null;
  conversationFingerprint: string;
  visibleConversation: ConversationMessage[];
  startedAt: string;
  completedAt: string;
  modelProposal: unknown | null;
  projectionReceipt: Gi088ProjectionReceiptV1 | null;
  canonicalState: Gi088CanonicalInterviewStateV2 | null;
  canonicalStateHash: string | null;
  visible: { understanding: string | null; response: string } | null;
  action: "acknowledge" | "ask" | "synthesize" | "pause" | null;
  evidenceRefs: string[];
  answerTarget: string | null;
  questionObservation: {
    questionMarkCount: number;
    reviewCandidate: "none" | "multiple_question_marks" | "non_ask_question_marks";
  };
  commitDiagnostics: Gi088ProContractProjectionResult["commitDiagnostics"];
  safeTrace: SafeTrace;
};

export type Gi088ProContractTechnicalGate = {
  group: Gi088ProContractGroup;
  passed: boolean;
  checks: {
    firstValid: boolean;
    projectionAmbiguity: boolean;
    stateInvariant: boolean;
    duplicateCommit: boolean;
    statePollution: boolean;
    latencyP50: boolean;
    latencyP90: boolean;
    latencyMaximum: boolean;
    latencySamplesComplete: boolean;
    tokenUsageSamplesComplete: boolean;
    failuresCategorized: boolean;
  };
};

export type Gi088ProContractDevelopmentReport = {
  reportVersion: typeof GI088_PRO_CONTRACT_PAIRED_REPORT_VERSION;
  experimentVersion: typeof GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION;
  diagnosticFingerprint: string;
  toolSourceFingerprint: Gi088ProContractToolSourceFingerprint;
  reportFingerprint: string;
  createdAt: string;
  partition: "development";
  globalFingerprintBundleBefore: Record<string, string>;
  globalFingerprintBundleAfter: Record<string, string>;
  globalRuntimeFingerprintsUnchanged: boolean;
  privacy: {
    requestBody: "excluded";
    fullModelOutput: "excluded";
    hiddenReasoningBody: "excluded";
    apiKey: "excluded";
    upstreamRequestIdRaw: "excluded";
  };
  dataset: {
    caseCount: 28;
    checkpointCount: 32;
    caseSetCommitment: string;
    hiddenDatasetRead: false;
  };
  schedule: ReturnType<typeof createGi088ProContractDevelopmentSchedule>;
  budget: {
    developmentMaximum: 128;
    providerCalls: number;
    recoveries: 0;
    retries: 0;
    judgeCalls: 0;
  };
  records: Gi088ProContractRecord[];
  technicalSummaries: [Gi088ProContractTechnicalSummary, Gi088ProContractTechnicalSummary];
  technicalGates: [Gi088ProContractTechnicalGate, Gi088ProContractTechnicalGate];
  decision: {
    status: "awaiting_human_development_review" | "no_go_technical";
    technicallyEligibleGroups: Gi088ProContractGroup[];
    humanReviewCardCount: 16;
    winner: null;
  };
};

export type Gi088ProContractDevelopmentHumanSummary = {
  groups: Record<Gi088ProContractGroup, {
    directUseCount: number;
    minorIssueCount: number;
    qualityFailureCount: number;
    blockerCount: number;
  }>;
  compactPairWinCount: number;
  fullPairWinCount: number;
  tieCount: number;
};

export type Gi088ProContractDevelopmentDecision = {
  status: "winner_selected" | "no_go";
  winner: Gi088ProContractGroup | null;
  reason:
    | "only_full_passed"
    | "only_compact_passed"
    | "compact_practical_equivalence"
    | "compact_exceeded_equivalence_range"
    | "both_failed";
  groupPassed: Record<Gi088ProContractGroup, boolean>;
  equivalence: {
    compactDirectUseNotLower: boolean;
    compactPairWinsNotLower: boolean;
    effectiveRateWithinTenPercent: boolean;
    p90WithinTenPercent: boolean;
    tokensWithinTenPercent: boolean;
    compactProjectionAndStateClean: boolean;
  };
};

export type Gi088ProContractHiddenReport = {
  reportVersion: typeof GI088_PRO_CONTRACT_PAIRED_REPORT_VERSION;
  experimentVersion: typeof GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION;
  toolSourceFingerprint: Gi088ProContractToolSourceFingerprint;
  reportFingerprint: string;
  createdAt: string;
  partition: "hidden_admission";
  winner: Gi088ProContractGroup;
  developmentReportFingerprint: string;
  developmentReceiptSha256: string;
  hiddenFileSha256: string;
  hiddenCaseSetCommitment: string;
  dataset: { caseCount: 12; checkpointCount: 16; attempts: 2 };
  budget: {
    developmentProviderCalls: number;
    hiddenMaximum: 32;
    hiddenProviderCalls: number;
    totalMaximum: 160;
    totalProviderCalls: number;
    recoveries: 0;
    retries: 0;
    judgeCalls: 0;
  };
  records: Gi088ProContractRecord[];
  technicalSummary: Omit<Gi088ProContractTechnicalSummary, "resultCount"> & { resultCount: 32 };
  technicalGate: Gi088ProContractTechnicalGate;
  decision: { status: "awaiting_human_hidden_review" | "no_go_technical" };
  privacy: Gi088ProContractDevelopmentReport["privacy"];
};

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown) {
  return gi088ProContractStableJson(value);
}

function safeCode(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.split(":", 1)[0]?.trim().toUpperCase();
  return normalized && /^[A-Z][A-Z0-9_]{0,127}$/u.test(normalized)
    ? normalized
    : fallback;
}

function safeTrace(
  completion: AICompletionResult | null,
  diagnosticsInput?: AIProviderDiagnostics | null
): SafeTrace {
  const diagnostics = sanitizeAIProviderDiagnostics(
    diagnosticsInput ?? completion?.diagnostics
  );
  const upstreamRequestId = diagnostics?.upstreamRequestId?.trim() ?? null;
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
    contentType: diagnostics?.contentType ?? null,
    contentLength: diagnostics?.contentLength ?? completion?.content.length ?? null,
    headersLatencyMs: diagnostics?.headersLatencyMs ?? null,
    bodyLatencyMs: diagnostics?.bodyLatencyMs ?? null,
    totalLatencyMs: diagnostics?.totalLatencyMs ?? completion?.latencyMs ?? null,
    timeoutStage: diagnostics?.timeoutStage ?? null,
    abortSource: diagnostics?.abortSource ?? null,
    upstreamRequestIdHash: upstreamRequestId ? sha256(upstreamRequestId) : null
  };
}

function emptyCommitDiagnostics() {
  return {
    projectionAmbiguous: false,
    stateInvariantFailure: false,
    duplicateCommit: false,
    statePollution: false
  };
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? sorted.at(-1)!;
}

function combineVisible(visible: { understanding: string | null; response: string }) {
  return [visible.understanding, visible.response].filter(Boolean).join("\n\n");
}

function currentCheckpointConversation(input: {
  evaluationCase: Gi088V8r3EvaluationCase;
  checkpointIndex: number;
  priorVisible: { understanding: string | null; response: string } | null;
  group: Gi088ProContractGroup;
  attempt: 1 | 2;
}) {
  if (input.checkpointIndex === 0) {
    return getGi088V8r3ConversationAtCheckpoint(input.evaluationCase, 0)
      .map((message) => ({ ...message })) as ConversationMessage[];
  }
  if (!input.priorVisible) {
    throw new Error("GI088_PRO_CONTRACT_PRIOR_VISIBLE_REQUIRED");
  }
  const previousCheckpoint = input.evaluationCase.checkpoints[input.checkpointIndex - 1]!;
  const currentCheckpoint = input.evaluationCase.checkpoints[input.checkpointIndex]!;
  const previousIndex = input.evaluationCase.messages.findIndex(
    (message) => message.id === previousCheckpoint.afterUserMessageId
  );
  const currentIndex = input.evaluationCase.messages.findIndex(
    (message) => message.id === currentCheckpoint.afterUserMessageId
  );
  if (previousIndex < 0 || currentIndex <= previousIndex) {
    throw new Error("GI088_PRO_CONTRACT_TRAJECTORY_ORDER_INVALID");
  }
  const prefix = input.evaluationCase.messages.slice(0, previousIndex + 1);
  const suffix = input.evaluationCase.messages
    .slice(previousIndex + 1, currentIndex + 1)
    .filter((message) => message.role === "user");
  return [
    ...prefix,
    {
      id: `paired-${input.evaluationCase.id}-${input.attempt}-${input.group}-${input.checkpointIndex}`,
      role: "assistant" as const,
      content: combineVisible(input.priorVisible)
    },
    ...suffix
  ].map((message) => ({ ...message })) as ConversationMessage[];
}

function latestUserMessageId(conversation: ConversationMessage[]) {
  const latest = [...conversation].reverse().find((message) => message.role === "user");
  if (!latest) throw new Error("GI088_PRO_CONTRACT_LATEST_USER_MISSING");
  return latest.id;
}

function validateSharedProductRules(input: {
  evaluationCase: Gi088V8r3EvaluationCase;
  checkpointIndex: number;
  conversation: ConversationMessage[];
  result: Gi088ProContractProjectionResult;
  programOwnedStop: boolean;
}) {
  const checkpoint = input.evaluationCase.checkpoints[input.checkpointIndex]!;
  const userIds = new Set(
    input.conversation.filter((message) => message.role === "user").map((message) => message.id)
  );
  const issues: string[] = [];
  if (
    !input.programOwnedStop &&
    !checkpoint.allowedActions.includes(input.result.action)
  ) issues.push("ACTION_NOT_ALLOWED");
  if (
    input.result.evidenceRefs.length === 0 ||
    input.result.evidenceRefs.some((reference) => !userIds.has(reference))
  ) issues.push("EVIDENCE_SOURCE_INVALID");
  if (checkpoint.requiredEvidenceMessageIds.some(
    (reference) => !input.result.evidenceRefs.includes(reference)
  )) issues.push("REQUIRED_EVIDENCE_MISSING");
  if (input.result.action === "ask" && !input.result.answerTarget?.trim()) {
    issues.push("ASK_ANSWER_TARGET_MISSING");
  }
  if (input.result.action !== "ask" && input.result.answerTarget !== null) {
    issues.push("NON_ASK_ANSWER_TARGET_PRESENT");
  }
  if (!input.result.visible.response.trim()) issues.push("VISIBLE_RESPONSE_EMPTY");
  return [...new Set(issues)];
}

function semanticInputHash(input: {
  state: Gi088CanonicalInterviewStateV2;
  conversation: ConversationMessage[];
  latestUserMessageId: string;
}) {
  return sha256(stableJson(input));
}

export function createGi088ProContractRequestHash(input: {
  group: Gi088ProContractGroup;
  semanticInputHash: string;
  caseFingerprint: string;
  checkpointIndex: number;
  attempt: 1 | 2;
  completionParams: ReturnType<typeof createGi088ProContractCompletionParams>;
}) {
  return sha256(stableJson({
    experimentVersion: GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
    group: input.group,
    definition: createGi088ProContractGroupDefinition(input.group),
    semanticInputHash: input.semanticInputHash,
    caseFingerprint: input.caseFingerprint,
    checkpointIndex: input.checkpointIndex,
    attempt: input.attempt,
    identity: GI088_PRO_CONTRACT_IDENTITY
    ,actualCompletionParamsSha256: sha256(stableJson({
      messages: input.completionParams.messages,
      useProviderDefaultMaxTokens: input.completionParams.useProviderDefaultMaxTokens,
      responseFormat: input.completionParams.responseFormat,
      thinking: input.completionParams.thinking,
      reasoningEffort: input.completionParams.reasoningEffort ?? null,
      headersTimeoutMs: input.completionParams.headersTimeoutMs,
      bodyIdleTimeoutMs: input.completionParams.bodyIdleTimeoutMs,
      hardTimeoutMs: input.completionParams.hardTimeoutMs
    }))
  }));
}

function failureRecord(input: {
  base: Omit<Gi088ProContractRecord,
    "effectiveValid" | "failureCategory" | "failureIssues" | "responseHash" |
    "modelProposal" | "projectionReceipt" | "canonicalState" |
    "canonicalStateHash" | "visible" | "action" | "evidenceRefs" |
    "answerTarget" | "questionObservation" | "commitDiagnostics" | "safeTrace">;
  category: Gi088ProContractFailureCategory;
  issues: string[];
  trace?: SafeTrace;
  proposal?: unknown | null;
  receipt?: Gi088ProjectionReceiptV1 | null;
  commitDiagnostics?: Gi088ProContractProjectionResult["commitDiagnostics"];
}) {
  return {
    ...input.base,
    effectiveValid: false,
    failureCategory: input.category,
    failureIssues: input.issues,
    responseHash: null,
    modelProposal: input.proposal ?? null,
    projectionReceipt: input.receipt ?? null,
    canonicalState: null,
    canonicalStateHash: null,
    visible: null,
    action: null,
    evidenceRefs: [],
    answerTarget: null,
    questionObservation: {
      questionMarkCount: 0,
      reviewCandidate: "none"
    },
    commitDiagnostics: input.commitDiagnostics ?? emptyCommitDiagnostics(),
    safeTrace: input.trace ?? safeTrace(null)
  } satisfies Gi088ProContractRecord;
}

async function executeSide(input: {
  resultIndex: number;
  trialIndex: number;
  partition: "development" | "hidden_admission";
  provider: AIProvider;
  adapter: Gi088ProContractStateAdapter;
  evaluationCase: Gi088V8r3EvaluationCase;
  checkpointIndex: number;
  attempt: 1 | 2;
  group: Gi088ProContractGroup;
  state: Gi088CanonicalInterviewStateV2;
  conversation: ConversationMessage[];
  blockedByPriorFailure: boolean;
  now: () => Date;
}): Promise<Gi088ProContractRecord> {
  const caseFingerprint = createGi088V8r3CaseFingerprint(input.evaluationCase);
  const latest = latestUserMessageId(input.conversation);
  const inputHash = semanticInputHash({
    state: input.state,
    conversation: input.conversation,
    latestUserMessageId: latest
  });
  const startedAt = input.now().toISOString();
  const control = decideGi088ProContractControl({
    canonicalState: input.state,
    conversation: input.conversation
  });
  let fullTurnInput: Board7bWorkingTaskV1TurnInput;
  let modelInputProjectionFailed = false;
  try {
    fullTurnInput = input.adapter.toFullTurnInput({
      state: input.state,
      conversation: input.conversation,
      latestUserMessageId: latest
    });
  } catch {
    modelInputProjectionFailed = true;
    fullTurnInput = {
      mode: "accompany_chat",
      conversation: input.conversation,
      latestUserMessageId: latest,
      semanticState: {
        stage: "engage_focus",
        workingTask: null,
        understandings: [],
        nextInquiry: null,
        invalidatedItems: [],
        returnableTasks: [],
        burdenSignal: null,
        answerOpportunities: { currentTaskRef: null, ledgers: [] }
      }
    };
  }
  const completionParams = createGi088ProContractCompletionParams({
    group: input.group,
    canonicalState: input.state,
    conversation: input.conversation,
    latestUserMessageId: latest,
    fullTurnInput,
    controlDecision: control.decision
  });
  const hash = createGi088ProContractRequestHash({
    group: input.group,
    semanticInputHash: inputHash,
    caseFingerprint,
    checkpointIndex: input.checkpointIndex,
    attempt: input.attempt,
    completionParams
  });
  const common = {
    resultIndex: input.resultIndex,
    trialIndex: input.trialIndex,
    partition: input.partition,
    caseId: input.evaluationCase.id,
    workingTask: input.evaluationCase.workingTask,
    caseFingerprint,
    checkpointIndex: input.checkpointIndex,
    attempt: input.attempt,
    group: input.group,
    providerCalled: false,
    programOwnedStop: false,
    blockedByPriorFailure: input.blockedByPriorFailure,
    semanticInputHash: inputHash,
    requestHash: hash,
    conversationFingerprint: sha256(stableJson(input.conversation)),
    visibleConversation: input.conversation,
    startedAt,
    completedAt: input.now().toISOString()
  } satisfies Omit<Gi088ProContractRecord,
    "effectiveValid" | "failureCategory" | "failureIssues" | "responseHash" |
    "modelProposal" | "projectionReceipt" | "canonicalState" |
    "canonicalStateHash" | "visible" | "action" | "evidenceRefs" |
    "answerTarget" | "questionObservation" | "commitDiagnostics" | "safeTrace">;

  if (input.blockedByPriorFailure) {
    return failureRecord({
      base: common,
      category: "state_commit",
      issues: ["BLOCKED_BY_PRIOR_FAILURE"]
    });
  }
  if (modelInputProjectionFailed) {
    return failureRecord({
      base: common,
      category: "projection",
      issues: ["MODEL_INPUT_PROJECTION_FAILED"]
    });
  }

  let result: Gi088ProContractProjectionResult;
  let completion: AICompletionResult | null = null;
  const pureStop = control.explicitStop === "pure";
  if (pureStop) {
    try {
      result = input.adapter.projectExplicitStop({
        state: input.state,
        conversation: input.conversation,
        latestUserMessageId: latest
      });
    } catch (error) {
      const projectionError = error instanceof Gi088ProContractProjectionError
        ? error
        : new Gi088ProContractProjectionError({
            category: "projection",
            code: "EXPLICIT_STOP_PROJECTION_FAILED"
          });
      return failureRecord({
        base: { ...common, programOwnedStop: true },
        category: projectionError.category,
        issues: projectionError.issues,
        proposal: projectionError.proposal,
        receipt: projectionError.receipt
      });
    }
  } else {
    try {
      completion = await input.provider.complete(completionParams);
    } catch (error) {
      return failureRecord({
        base: {
          ...common,
          providerCalled: true,
          completedAt: input.now().toISOString()
        },
        category: "provider",
        issues: [safeCode(getAIProviderFailureCode(error), "PROVIDER_FAILURE")],
        trace: safeTrace(null, getAIProviderDiagnostics(error))
      });
    }
    const content = completion.content.trim();
    if (!content) {
      return failureRecord({
        base: {
          ...common,
          providerCalled: true,
          completedAt: input.now().toISOString()
        },
        category: "provider",
        issues: ["EMPTY_CONTENT"],
        trace: safeTrace(completion)
      });
    }
    try {
      JSON.parse(content);
    } catch {
      return failureRecord({
        base: {
          ...common,
          providerCalled: true,
          completedAt: input.now().toISOString()
        },
        category: "contract",
        issues: ["JSON_INVALID"],
        trace: safeTrace(completion)
      });
    }
    try {
      result = input.adapter.parseAndProject({
        group: input.group,
        state: input.state,
        content,
        conversation: input.conversation,
        latestUserMessageId: latest
      });
      if (control.explicitStop === "mixed") {
        result = input.adapter.projectMixedStop({
          inputState: input.state,
          semanticResult: result,
          latestUserMessageId: latest
        });
      }
    } catch (error) {
      const projectionError = error instanceof Gi088ProContractProjectionError
        ? error
        : new Gi088ProContractProjectionError({
            category: "contract",
            code: "OUTPUT_CONTRACT_INVALID"
          });
      return failureRecord({
        base: {
          ...common,
          providerCalled: true,
          completedAt: input.now().toISOString()
        },
        category: projectionError.category,
        issues: projectionError.issues.map((issue) => safeCode(issue, "VALIDATION_FAILED")),
        proposal: projectionError.proposal,
        receipt: projectionError.receipt,
        trace: safeTrace(completion)
      });
    }
  }

  const semanticIssues = validateSharedProductRules({
    evaluationCase: input.evaluationCase,
    checkpointIndex: input.checkpointIndex,
    conversation: input.conversation,
    result,
    programOwnedStop: control.explicitStop !== "none"
  });
  if (semanticIssues.length > 0) {
    return failureRecord({
      base: {
        ...common,
        providerCalled: !pureStop,
        programOwnedStop: pureStop || control.explicitStop === "mixed",
        completedAt: input.now().toISOString()
      },
      category: "semantic",
      issues: semanticIssues,
      proposal: result.proposal,
      receipt: result.receipt,
      commitDiagnostics: result.commitDiagnostics,
      trace: safeTrace(completion)
    });
  }
  try {
    input.adapter.assertState(result.state);
  } catch {
    return failureRecord({
      base: {
        ...common,
        providerCalled: !pureStop,
        programOwnedStop: pureStop || control.explicitStop === "mixed",
        completedAt: input.now().toISOString()
      },
      category: "state_commit",
      issues: ["STATE_INVARIANT_FAILED"],
      proposal: result.proposal,
      receipt: result.receipt,
      commitDiagnostics: {
        ...result.commitDiagnostics,
        stateInvariantFailure: true
      },
      trace: safeTrace(completion)
    });
  }
  const diagnostics = result.commitDiagnostics;
  if (
    diagnostics.projectionAmbiguous ||
    diagnostics.stateInvariantFailure ||
    diagnostics.duplicateCommit ||
    diagnostics.statePollution
  ) {
    const issues = [
      diagnostics.projectionAmbiguous ? "PROJECTION_AMBIGUITY" : null,
      diagnostics.stateInvariantFailure ? "STATE_INVARIANT_FAILED" : null,
      diagnostics.duplicateCommit ? "DUPLICATE_COMMIT" : null,
      diagnostics.statePollution ? "STATE_POLLUTION" : null
    ].filter((value): value is string => Boolean(value));
    return failureRecord({
      base: {
        ...common,
        providerCalled: !pureStop,
        programOwnedStop: pureStop || control.explicitStop === "mixed",
        completedAt: input.now().toISOString()
      },
      category: diagnostics.projectionAmbiguous ? "projection" : "state_commit",
      issues,
      proposal: result.proposal,
      receipt: result.receipt,
      commitDiagnostics: diagnostics,
      trace: safeTrace(completion)
    });
  }
  return {
    ...common,
    providerCalled: !pureStop,
    programOwnedStop: pureStop || control.explicitStop === "mixed",
    completedAt: input.now().toISOString(),
    effectiveValid: true,
    failureCategory: null,
    failureIssues: [],
    responseHash: completion ? sha256(completion.content) : sha256(stableJson(result.proposal)),
    modelProposal: result.proposal,
    projectionReceipt: result.receipt,
    canonicalState: result.state,
    canonicalStateHash: input.adapter.stateHash(result.state),
    visible: result.visible,
    action: result.action,
    evidenceRefs: result.evidenceRefs,
    answerTarget: result.answerTarget,
    questionObservation: (() => {
      const count = [result.visible.understanding, result.visible.response]
        .filter(Boolean)
        .join("\n")
        .split("")
        .filter((character) => character === "?" || character === "？")
        .length;
      return {
        questionMarkCount: count,
        reviewCandidate: count === 0
          ? "none" as const
          : result.action === "ask" && count > 1
            ? "multiple_question_marks" as const
            : result.action !== "ask"
              ? "non_ask_question_marks" as const
              : "none" as const
      };
    })(),
    commitDiagnostics: diagnostics,
    safeTrace: safeTrace(completion)
  };
}

function initialEvidenceRefs(evaluationCase: Gi088V8r3EvaluationCase) {
  const conversation = getGi088V8r3ConversationAtCheckpoint(evaluationCase, 0);
  const latest = latestUserMessageId(conversation as ConversationMessage[]);
  const refs = conversation
    .filter((message) => message.role === "user" && message.id !== latest)
    .map((message) => message.id);
  return refs.length > 0 ? refs : [latest];
}

async function executeTrial(input: {
  trialIndex: number;
  partition: "development" | "hidden_admission";
  provider: AIProvider;
  adapter: Gi088ProContractStateAdapter;
  evaluationCase: Gi088V8r3EvaluationCase;
  attempt: 1 | 2;
  groups: readonly Gi088ProContractGroup[];
  resultIndexStart: number;
  now: () => Date;
}) {
  const states = Object.fromEntries(input.groups.map((group) => [
    group,
    input.adapter.createInitial({
      caseId: input.evaluationCase.id,
      workingTask: input.evaluationCase.workingTask,
      evidenceRefs: initialEvidenceRefs(input.evaluationCase)
    })
  ])) as Record<Gi088ProContractGroup, Gi088CanonicalInterviewStateV2>;
  const priorVisible: Partial<Record<Gi088ProContractGroup, {
    understanding: string | null;
    response: string;
  }>> = {};
  const priorFailed: Partial<Record<Gi088ProContractGroup, boolean>> = {};
  const records: Gi088ProContractRecord[] = [];
  let resultIndex = input.resultIndexStart;
  for (let checkpointIndex = 0;
    checkpointIndex < input.evaluationCase.checkpoints.length;
    checkpointIndex += 1) {
    const pending = input.groups.map((group) => {
      const blockedByPriorFailure = priorFailed[group] === true;
      const conversation = blockedByPriorFailure
        ? getGi088V8r3ConversationAtCheckpoint(
            input.evaluationCase,
            checkpointIndex
          ).map((message) => ({ ...message })) as ConversationMessage[]
        : currentCheckpointConversation({
            evaluationCase: input.evaluationCase,
            checkpointIndex,
            priorVisible: priorVisible[group] ?? null,
            group,
            attempt: input.attempt
          });
      const side = executeSide({
        resultIndex,
        trialIndex: input.trialIndex,
        partition: input.partition,
        provider: input.provider,
        adapter: input.adapter,
        evaluationCase: input.evaluationCase,
        checkpointIndex,
        attempt: input.attempt,
        group,
        state: states[group],
        conversation,
        blockedByPriorFailure,
        now: input.now
      });
      resultIndex += 1;
      return side;
    });
    const completed = await Promise.all(pending);
    for (const record of completed) {
      records.push(record);
      if (record.effectiveValid && record.canonicalState && record.visible) {
        states[record.group] = record.canonicalState;
        priorVisible[record.group] = record.visible;
      } else {
        priorFailed[record.group] = true;
      }
    }
  }
  return records;
}

function summarizeRecords(
  group: Gi088ProContractGroup,
  records: Gi088ProContractRecord[],
  expectedResultCount: 64 | 32
) {
  const selected = records.filter((record) => record.group === group);
  if (selected.length !== expectedResultCount) {
    throw new Error("GI088_PRO_CONTRACT_RESULT_CARDINALITY_INVALID");
  }
  const latency = selected
    .filter((record) => record.providerCalled)
    .map((record) => record.safeTrace.totalLatencyMs ?? record.safeTrace.latencyMs)
    .filter((value): value is number => typeof value === "number");
  const providerRecords = selected.filter((record) => record.providerCalled);
  const tokenUsageSampleCount = providerRecords.filter(
    (record) => record.safeTrace.tokenUsage?.totalTokens !== undefined
  ).length;
  const summary = {
    group,
    resultCount: expectedResultCount,
    providerCallCount: selected.filter((record) => record.providerCalled).length,
    programOwnedStopCount: selected.filter((record) => record.programOwnedStop).length,
    firstValidCount: selected.filter((record) => record.effectiveValid).length,
    blockedByPriorFailureCount: selected.filter((record) => record.blockedByPriorFailure).length,
    categorizedFailureCount: selected.filter(
      (record) => !record.effectiveValid && record.failureCategory !== null
    ).length,
    projectionAmbiguityCount: selected.filter(
      (record) => record.commitDiagnostics.projectionAmbiguous
    ).length,
    stateInvariantFailureCount: selected.filter(
      (record) => record.commitDiagnostics.stateInvariantFailure ||
        record.failureIssues.includes("STATE_INVARIANT_FAILED")
    ).length,
    duplicateCommitCount: selected.filter(
      (record) => record.commitDiagnostics.duplicateCommit
    ).length,
    statePollutionCount: selected.filter(
      (record) => record.commitDiagnostics.statePollution
    ).length,
    latency: {
      p50Ms: percentile(latency, 0.5),
      p90Ms: percentile(latency, 0.9),
      maxMs: latency.length > 0 ? Math.max(...latency) : null
    },
    latencySampleCount: latency.length,
    tokenUsageSampleCount,
    totalTokens: selected.reduce(
      (sum, record) => sum + (record.safeTrace.tokenUsage?.totalTokens ?? 0),
      0
    )
  };
  return summary;
}

function technicalGate(
  summary: Gi088ProContractTechnicalSummary | Gi088ProContractHiddenReport["technicalSummary"],
  validMinimum: number
): Gi088ProContractTechnicalGate {
  const checks = {
    firstValid: summary.firstValidCount >= validMinimum,
    projectionAmbiguity: summary.projectionAmbiguityCount === 0,
    stateInvariant: summary.stateInvariantFailureCount === 0,
    duplicateCommit: summary.duplicateCommitCount === 0,
    statePollution: summary.statePollutionCount === 0,
    latencyP50: summary.latency.p50Ms !== null && summary.latency.p50Ms <= 20_000,
    latencyP90: summary.latency.p90Ms !== null && summary.latency.p90Ms <= 40_000,
    latencyMaximum: summary.latency.maxMs !== null && summary.latency.maxMs <= 60_000,
    latencySamplesComplete: summary.latencySampleCount === summary.providerCallCount,
    tokenUsageSamplesComplete: summary.tokenUsageSampleCount === summary.providerCallCount,
    failuresCategorized:
      summary.categorizedFailureCount === summary.resultCount - summary.firstValidCount
  };
  return {
    group: summary.group,
    passed: Object.values(checks).every(Boolean),
    checks
  };
}

export async function executeGi088ProContractDevelopment(input: {
  cases: readonly Gi088V8r3EvaluationCase[];
  provider: AIProvider;
  adapter: Gi088ProContractStateAdapter;
  globalFingerprintBundleBefore: Record<string, string>;
  readGlobalFingerprintBundleAfter: () => Record<string, string>;
  toolSourceFingerprint: Gi088ProContractToolSourceFingerprint;
  now?: () => Date;
}): Promise<Gi088ProContractDevelopmentReport> {
  const now = input.now ?? (() => new Date());
  const schedule = createGi088ProContractDevelopmentSchedule(input.cases);
  const casesById = new Map(input.cases.map((item) => [item.id, item]));
  const records: Gi088ProContractRecord[] = [];
  for (const trial of schedule.schedule) {
    const evaluationCase = casesById.get(trial.caseId);
    if (!evaluationCase) throw new Error("GI088_PRO_CONTRACT_SCHEDULE_CASE_MISSING");
    records.push(...await executeTrial({
      trialIndex: trial.trialIndex,
      partition: "development",
      provider: input.provider,
      adapter: input.adapter,
      evaluationCase,
      attempt: trial.attempt,
      groups: ["full", "compact"],
      resultIndexStart: records.length,
      now
    }));
  }
  const providerCalls = records.filter((record) => record.providerCalled).length;
  if (
    records.length !== GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM ||
    providerCalls > GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM
  ) throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_BUDGET_INVALID");
  const fullSummary = summarizeRecords(
    "full",
    records,
    GI088_PRO_CONTRACT_DEVELOPMENT_RESULT_COUNT_PER_GROUP
  ) as Gi088ProContractTechnicalSummary;
  const compactSummary = summarizeRecords(
    "compact",
    records,
    GI088_PRO_CONTRACT_DEVELOPMENT_RESULT_COUNT_PER_GROUP
  ) as Gi088ProContractTechnicalSummary;
  const fullGate = technicalGate(fullSummary, GI088_PRO_CONTRACT_TECHNICAL_VALID_MINIMUM);
  const compactGate = technicalGate(compactSummary, GI088_PRO_CONTRACT_TECHNICAL_VALID_MINIMUM);
  const fingerprintAfter = input.readGlobalFingerprintBundleAfter();
  const unchanged = stableJson(input.globalFingerprintBundleBefore) === stableJson(fingerprintAfter);
  if (!unchanged) throw new Error("GI088_PRO_CONTRACT_GLOBAL_FINGERPRINT_CHANGED");
  const payload = {
    reportVersion: GI088_PRO_CONTRACT_PAIRED_REPORT_VERSION,
    experimentVersion: GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
    diagnosticFingerprint: createGi088ProContractDiagnosticFingerprint({
      cases: input.cases,
      globalFingerprintBundle: input.globalFingerprintBundleBefore,
      toolSourceFingerprint: input.toolSourceFingerprint
    }),
    toolSourceFingerprint: input.toolSourceFingerprint,
    createdAt: now().toISOString(),
    partition: "development" as const,
    globalFingerprintBundleBefore: input.globalFingerprintBundleBefore,
    globalFingerprintBundleAfter: fingerprintAfter,
    globalRuntimeFingerprintsUnchanged: true,
    privacy: {
      requestBody: "excluded" as const,
      fullModelOutput: "excluded" as const,
      hiddenReasoningBody: "excluded" as const,
      apiKey: "excluded" as const,
      upstreamRequestIdRaw: "excluded" as const
    },
    dataset: {
      caseCount: 28 as const,
      checkpointCount: 32 as const,
      caseSetCommitment: createGi088V8r3CaseSetCommitment(input.cases),
      hiddenDatasetRead: false as const
    },
    schedule,
    budget: {
      developmentMaximum: 128 as const,
      providerCalls,
      recoveries: 0 as const,
      retries: 0 as const,
      judgeCalls: 0 as const
    },
    records,
    technicalSummaries: [fullSummary, compactSummary] as [
      Gi088ProContractTechnicalSummary,
      Gi088ProContractTechnicalSummary
    ],
    technicalGates: [fullGate, compactGate] as [
      Gi088ProContractTechnicalGate,
      Gi088ProContractTechnicalGate
    ],
    decision: {
      status: (fullGate.passed || compactGate.passed)
        ? "awaiting_human_development_review" as const
        : "no_go_technical" as const,
      technicallyEligibleGroups: [fullGate, compactGate]
        .filter((gate) => gate.passed)
        .map((gate) => gate.group),
      humanReviewCardCount: 16 as const,
      winner: null
    }
  };
  return {
    ...payload,
    reportFingerprint: sha256(stableJson(payload))
  };
}

function blindSide(input: {
  record: Gi088ProContractRecord;
  blindId: string;
}): Gi088ProContractBlindCandidate {
  return {
    blindId: input.blindId,
    available: input.record.effectiveValid && input.record.visible !== null,
    messages: input.record.visibleConversation.map(({ role, content }) => ({ role, content })),
    visible: input.record.visible ?? {
      understanding: null,
      response: "本次未形成可见合法回应。"
    },
    requestHash: input.record.requestHash,
    contentHash: input.record.responseHash ?? sha256("unavailable")
  };
}

export function createGi088ProContractDevelopmentReviewSource(
  report: Gi088ProContractDevelopmentReport
): Gi088ProContractDevelopmentReviewSourceV1 {
  if (report.decision.status !== "awaiting_human_development_review") {
    throw new Error("GI088_PRO_CONTRACT_TECHNICAL_NO_GO_HAS_NO_REVIEW_SOURCE");
  }
  const cards = GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_CASE_IDS.flatMap((caseId) =>
    ([1, 2] as const).map((attempt) => {
      const caseRecords = report.records.filter(
        (record) => record.caseId === caseId && record.attempt === attempt
      );
      const checkpointIndex = Math.max(...caseRecords.map((record) => record.checkpointIndex));
      const full = caseRecords.find(
        (record) => record.group === "full" && record.checkpointIndex === checkpointIndex
      );
      const compact = caseRecords.find(
        (record) => record.group === "compact" && record.checkpointIndex === checkpointIndex
      );
      if (!full || !compact) throw new Error("GI088_PRO_CONTRACT_REVIEW_RECORD_MISSING");
      const compactFirst = Number.parseInt(
        sha256(`${report.reportFingerprint}:${caseId}:${attempt}`).slice(0, 2),
        16
      ) % 2 === 0;
      const cardId = sha256(`${caseId}:${attempt}:${checkpointIndex}`).slice(0, 20);
      const leftRecord = compactFirst ? compact : full;
      const rightRecord = compactFirst ? full : compact;
      const sourceFingerprint = sha256(stableJson({
        cardId,
        caseId,
        attempt,
        checkpointIndex,
        left: leftRecord.requestHash,
        right: rightRecord.requestHash
      }));
      return {
        cardId,
        caseId,
        checkpointIndex,
        attempt,
        workingTask: full.workingTask,
        messages: leftRecord.visibleConversation.map(({ role, content }) => ({ role, content })),
        sourceFingerprint,
        left: blindSide({ record: leftRecord, blindId: "候选甲" }),
        right: blindSide({ record: rightRecord, blindId: "候选乙" })
      };
    })
  );
  const draft: Gi088ProContractDevelopmentReviewSourceV1 = {
    schemaVersion: "1.0",
    experimentVersion: GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
    stage: "pro-contract-development-paired",
    runnerReportFingerprint: report.reportFingerprint,
    runnerReportSha256: sha256(`${JSON.stringify(report, null, 2)}\n`),
    sourceFingerprint: "",
    cards,
    technicalSummaries: report.technicalSummaries,
    sealedReveal: {
      candidates: cards.flatMap((card) => {
        const full = report.records.find((record) =>
          record.caseId === card.caseId &&
          record.attempt === card.attempt &&
          record.checkpointIndex === card.checkpointIndex &&
          record.group === "full"
        )!;
        return [
          {
            cardId: card.cardId,
            blindId: card.left.requestHash === full.requestHash ? card.left.blindId : card.right.blindId,
            group: "full" as const
          },
          {
            cardId: card.cardId,
            blindId: card.left.requestHash === full.requestHash ? card.right.blindId : card.left.blindId,
            group: "compact" as const
          }
        ];
      }),
      identities: (["full", "compact"] as const).map((group) => {
        const definition = createGi088ProContractGroupDefinition(group);
        return {
          group,
          provider: definition.identity.provider,
          baseUrlHost: definition.identity.baseUrlHost,
          endpoint: definition.identity.endpoint,
          model: definition.identity.model,
          thinking: "high" as const,
          responseFormat: "json_object" as const,
          contractVersion: definition.contractVersion,
          projectionPolicyVersion: definition.projectionPolicyVersion
        };
      }) as Gi088ProContractDevelopmentReviewSourceV1["sealedReveal"]["identities"]
    }
  };
  return {
    ...draft,
    sourceFingerprint: computeGi088ProContractReviewSourceFingerprint(draft)
  };
}

function rateWithinTenPercent(compact: number, full: number, lowerIsBetter = false) {
  if (full === 0) return compact === 0;
  return lowerIsBetter ? compact <= full * 1.1 : compact >= full * 0.9;
}

export function evaluateGi088ProContractDevelopmentDecision(input: {
  report: Gi088ProContractDevelopmentReport;
  human: Gi088ProContractDevelopmentHumanSummary;
}): Gi088ProContractDevelopmentDecision {
  const technical = Object.fromEntries(
    input.report.technicalGates.map((gate) => [gate.group, gate.passed])
  ) as Record<Gi088ProContractGroup, boolean>;
  const quality = Object.fromEntries((["full", "compact"] as const).map((group) => {
    const summary = input.human.groups[group];
    return [group,
      summary.directUseCount >= 12 &&
      summary.minorIssueCount <= 4 &&
      summary.qualityFailureCount === 0 &&
      summary.blockerCount === 0
    ];
  })) as Record<Gi088ProContractGroup, boolean>;
  const groupPassed = {
    full: technical.full && quality.full,
    compact: technical.compact && quality.compact
  };
  const full = input.report.technicalSummaries.find((item) => item.group === "full")!;
  const compact = input.report.technicalSummaries.find((item) => item.group === "compact")!;
  const equivalence = {
    compactDirectUseNotLower:
      input.human.groups.compact.directUseCount >= input.human.groups.full.directUseCount,
    compactPairWinsNotLower:
      input.human.compactPairWinCount >= input.human.fullPairWinCount,
    effectiveRateWithinTenPercent: rateWithinTenPercent(
      compact.firstValidCount / compact.resultCount,
      full.firstValidCount / full.resultCount
    ),
    p90WithinTenPercent: compact.latency.p90Ms !== null && full.latency.p90Ms !== null &&
      rateWithinTenPercent(compact.latency.p90Ms, full.latency.p90Ms, true),
    tokensWithinTenPercent:
      compact.tokenUsageSampleCount === compact.providerCallCount &&
      full.tokenUsageSampleCount === full.providerCallCount &&
      rateWithinTenPercent(compact.totalTokens, full.totalTokens, true),
    compactProjectionAndStateClean:
      compact.projectionAmbiguityCount === 0 &&
      compact.stateInvariantFailureCount === 0 &&
      compact.duplicateCommitCount === 0 &&
      compact.statePollutionCount === 0
  };
  if (!groupPassed.full && !groupPassed.compact) {
    return { status: "no_go", winner: null, reason: "both_failed", groupPassed, equivalence };
  }
  if (groupPassed.full && !groupPassed.compact) {
    return { status: "winner_selected", winner: "full", reason: "only_full_passed", groupPassed, equivalence };
  }
  if (!groupPassed.full && groupPassed.compact) {
    return { status: "winner_selected", winner: "compact", reason: "only_compact_passed", groupPassed, equivalence };
  }
  const compactEquivalent = Object.values(equivalence).every(Boolean);
  return compactEquivalent
    ? { status: "winner_selected", winner: "compact", reason: "compact_practical_equivalence", groupPassed, equivalence }
    : { status: "winner_selected", winner: "full", reason: "compact_exceeded_equivalence_range", groupPassed, equivalence };
}

export async function executeGi088ProContractHidden(input: {
  cases: readonly Gi088V8r3EvaluationCase[];
  hiddenFileSha256: string;
  winner: Gi088ProContractGroup;
  developmentReportFingerprint: string;
  developmentReceiptSha256: string;
  developmentProviderCalls: number;
  toolSourceFingerprint: Gi088ProContractToolSourceFingerprint;
  provider: AIProvider;
  adapter: Gi088ProContractStateAdapter;
  now?: () => Date;
}): Promise<Gi088ProContractHiddenReport> {
  if (
    input.cases.length !== 12 ||
    input.cases.some((item) => item.partition !== "hidden_admission") ||
    input.cases.reduce((sum, item) => sum + item.checkpoints.length, 0) !== 16 ||
    !/^[a-f0-9]{64}$/u.test(input.hiddenFileSha256) ||
    !/^[a-f0-9]{64}$/u.test(input.developmentReceiptSha256)
  ) throw new Error("GI088_PRO_CONTRACT_HIDDEN_INPUT_INVALID");
  const now = input.now ?? (() => new Date());
  const trials = input.cases.flatMap((evaluationCase) => ([1, 2] as const).map(
    (attempt) => ({ evaluationCase, attempt })
  )).sort((left, right) => sha256(
    `${GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION}:hidden:${left.evaluationCase.id}:${left.attempt}`
  ).localeCompare(sha256(
    `${GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION}:hidden:${right.evaluationCase.id}:${right.attempt}`
  )));
  const records: Gi088ProContractRecord[] = [];
  for (let trialIndex = 0; trialIndex < trials.length; trialIndex += 1) {
    const trial = trials[trialIndex]!;
    records.push(...await executeTrial({
      trialIndex,
      partition: "hidden_admission",
      provider: input.provider,
      adapter: input.adapter,
      evaluationCase: trial.evaluationCase,
      attempt: trial.attempt,
      groups: [input.winner],
      resultIndexStart: records.length,
      now
    }));
  }
  const hiddenProviderCalls = records.filter((record) => record.providerCalled).length;
  if (
    records.length !== GI088_PRO_CONTRACT_HIDDEN_RESULT_COUNT ||
    hiddenProviderCalls > GI088_PRO_CONTRACT_HIDDEN_CALLS_MAXIMUM ||
    input.developmentProviderCalls + hiddenProviderCalls > GI088_PRO_CONTRACT_TOTAL_CALLS_MAXIMUM
  ) throw new Error("GI088_PRO_CONTRACT_HIDDEN_BUDGET_INVALID");
  const summary = summarizeRecords(input.winner, records, 32);
  const gate = technicalGate(summary, GI088_PRO_CONTRACT_HIDDEN_TECHNICAL_VALID_MINIMUM);
  const payload = {
    reportVersion: GI088_PRO_CONTRACT_PAIRED_REPORT_VERSION,
    experimentVersion: GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
    createdAt: now().toISOString(),
    toolSourceFingerprint: input.toolSourceFingerprint,
    partition: "hidden_admission" as const,
    winner: input.winner,
    developmentReportFingerprint: input.developmentReportFingerprint,
    developmentReceiptSha256: input.developmentReceiptSha256,
    hiddenFileSha256: input.hiddenFileSha256,
    hiddenCaseSetCommitment: createGi088V8r3CaseSetCommitment(input.cases),
    dataset: { caseCount: 12 as const, checkpointCount: 16 as const, attempts: 2 as const },
    budget: {
      developmentProviderCalls: input.developmentProviderCalls,
      hiddenMaximum: 32 as const,
      hiddenProviderCalls,
      totalMaximum: 160 as const,
      totalProviderCalls: input.developmentProviderCalls + hiddenProviderCalls,
      recoveries: 0 as const,
      retries: 0 as const,
      judgeCalls: 0 as const
    },
    records,
    technicalSummary: summary as Gi088ProContractHiddenReport["technicalSummary"],
    technicalGate: gate,
    decision: {
      status: gate.passed
        ? "awaiting_human_hidden_review" as const
        : "no_go_technical" as const
    },
    privacy: {
      requestBody: "excluded" as const,
      fullModelOutput: "excluded" as const,
      hiddenReasoningBody: "excluded" as const,
      apiKey: "excluded" as const,
      upstreamRequestIdRaw: "excluded" as const
    }
  };
  return { ...payload, reportFingerprint: sha256(stableJson(payload)) };
}

export function createGi088ProContractHiddenReviewSource(input: {
  report: Gi088ProContractHiddenReport;
  cases: readonly Gi088V8r3EvaluationCase[];
}): Gi088ProContractHiddenReviewSourceV1 {
  if (input.report.decision.status !== "awaiting_human_hidden_review") {
    throw new Error("GI088_PRO_CONTRACT_HIDDEN_NO_GO_HAS_NO_REVIEW_SOURCE");
  }
  const casesById = new Map(input.cases.map((item) => [item.id, item]));
  const cards = input.report.records.map((record) => {
    const evaluationCase = casesById.get(record.caseId);
    if (!evaluationCase) throw new Error("GI088_PRO_CONTRACT_HIDDEN_REVIEW_CASE_MISSING");
    const cardId = sha256(
      `${input.report.reportFingerprint}:${record.caseId}:${record.attempt}:${record.checkpointIndex}`
    ).slice(0, 20);
    return {
      cardId,
      caseId: record.caseId,
      checkpointIndex: record.checkpointIndex,
      attempt: record.attempt,
      workingTask: evaluationCase.workingTask,
      messages: record.visibleConversation.map(({ role, content }) => ({ role, content })),
      sourceFingerprint: sha256(stableJson({
        cardId,
        requestHash: record.requestHash,
        responseHash: record.responseHash
      })),
      candidate: blindSide({ record, blindId: "候选回应" })
    };
  });
  const definition = createGi088ProContractGroupDefinition(input.report.winner);
  const draft: Gi088ProContractHiddenReviewSourceV1 = {
    schemaVersion: "1.0",
    experimentVersion: GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
    stage: "pro-contract-hidden-admission",
    runnerReportFingerprint: input.report.reportFingerprint,
    runnerReportSha256: sha256(`${JSON.stringify(input.report, null, 2)}\n`),
    developmentReceiptSha256: input.report.developmentReceiptSha256,
    sourceFingerprint: "",
    cards,
    technicalSummary: input.report.technicalSummary,
    sealedReveal: {
      winner: {
        group: input.report.winner,
        provider: definition.identity.provider,
        baseUrlHost: definition.identity.baseUrlHost,
        endpoint: definition.identity.endpoint,
        model: definition.identity.model,
        thinking: "high",
        responseFormat: "json_object",
        contractVersion: definition.contractVersion,
        projectionPolicyVersion: definition.projectionPolicyVersion
      }
    }
  };
  return {
    ...draft,
    sourceFingerprint: computeGi088ProContractReviewSourceFingerprint(draft)
  };
}

async function prepareExclusiveTemporary(path: string, value: unknown) {
  await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
  await chmod(temporaryPath, 0o600);
  return temporaryPath;
}

async function writeExclusiveAtomic(path: string, value: unknown) {
  const temporaryPath = await prepareExclusiveTemporary(path, value);
  try {
    await link(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
  await chmod(path, 0o600);
}

async function writeExclusiveAtomicPair(input: {
  first: { path: string; value: unknown };
  second: { path: string; value: unknown };
}) {
  await assertGi088ProContractArtifactTargetsAvailable([
    input.first.path,
    input.second.path
  ]);
  const [firstTemporary, secondTemporary] = await Promise.all([
    prepareExclusiveTemporary(input.first.path, input.first.value),
    prepareExclusiveTemporary(input.second.path, input.second.value)
  ]);
  let firstLinked = false;
  try {
    await link(firstTemporary, input.first.path);
    firstLinked = true;
    await link(secondTemporary, input.second.path);
    await Promise.all([
      chmod(input.first.path, 0o600),
      chmod(input.second.path, 0o600)
    ]);
  } catch (error) {
    if (firstLinked) await unlink(input.first.path).catch(() => undefined);
    await unlink(input.second.path).catch(() => undefined);
    throw error;
  } finally {
    await Promise.all([
      unlink(firstTemporary).catch(() => undefined),
      unlink(secondTemporary).catch(() => undefined)
    ]);
  }
}

export async function assertGi088ProContractArtifactTargetsAvailable(
  paths: readonly string[]
) {
  for (const path of paths) {
    try {
      await stat(path);
      throw new Error("GI088_PRO_CONTRACT_ARTIFACT_ALREADY_EXISTS");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function acquireGi088ProContractExecutionReservation(input: {
  lockPath: string;
  stage: "development" | "hidden";
  targetPaths: readonly string[];
  createdAt?: string;
}) {
  await mkdir(resolve(input.lockPath, ".."), { recursive: true, mode: 0o700 });
  const reservation = {
    schemaVersion: "1.0",
    experimentVersion: GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
    stage: input.stage,
    status: "reserved",
    processId: process.pid,
    createdAt: input.createdAt ?? new Date().toISOString(),
    targetsSha256: sha256(stableJson([...input.targetPaths].sort()))
  } as const;
  const handle = await open(input.lockPath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(reservation, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(input.lockPath, 0o600);
  return reservation;
}

export async function writeGi088ProContractDevelopmentArtifacts(input: {
  report: Gi088ProContractDevelopmentReport;
  reportPath?: string;
  reviewSourcePath?: string;
}) {
  const reportPath = input.reportPath ?? GI088_PRO_CONTRACT_DEVELOPMENT_PRIVATE_REPORT_PATH;
  const reviewSourcePath = input.reviewSourcePath ?? GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_SOURCE_PATH;
  if (input.report.decision.status === "no_go_technical") {
    await assertGi088ProContractArtifactTargetsAvailable([reportPath, reviewSourcePath]);
    await writeExclusiveAtomic(reportPath, input.report);
    return { reportPath, reviewSourcePath: null, reviewSource: null };
  }
  const reviewSource = createGi088ProContractDevelopmentReviewSource(input.report);
  await writeExclusiveAtomicPair({
    first: { path: reportPath, value: input.report },
    second: { path: reviewSourcePath, value: reviewSource }
  });
  return { reportPath, reviewSourcePath, reviewSource };
}

export async function writeGi088ProContractHiddenArtifacts(input: {
  report: Gi088ProContractHiddenReport;
  cases: readonly Gi088V8r3EvaluationCase[];
  reportPath?: string;
  reviewSourcePath?: string;
}) {
  const reportPath = input.reportPath ?? GI088_PRO_CONTRACT_HIDDEN_PRIVATE_REPORT_PATH;
  const reviewSourcePath = input.reviewSourcePath ?? GI088_PRO_CONTRACT_HIDDEN_REVIEW_SOURCE_PATH;
  if (input.report.decision.status === "no_go_technical") {
    await assertGi088ProContractArtifactTargetsAvailable([reportPath, reviewSourcePath]);
    await writeExclusiveAtomic(reportPath, input.report);
    return { reportPath, reviewSourcePath: null, reviewSource: null };
  }
  const reviewSource = createGi088ProContractHiddenReviewSource({
    report: input.report,
    cases: input.cases
  });
  await writeExclusiveAtomicPair({
    first: { path: reportPath, value: input.report },
    second: { path: reviewSourcePath, value: reviewSource }
  });
  return { reportPath, reviewSourcePath, reviewSource };
}

export async function readGi088ProContractPrivateReport(
  path: string
): Promise<Gi088ProContractDevelopmentReport | Gi088ProContractHiddenReport> {
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
    throw new Error("GI088_PRO_CONTRACT_PRIVATE_REPORT_PERMISSIONS_INVALID");
  }
  const report = JSON.parse(await readFile(path, "utf8")) as
    | Gi088ProContractDevelopmentReport
    | Gi088ProContractHiddenReport;
  const { reportFingerprint, ...payload } = report;
  if (
    report.reportVersion !== GI088_PRO_CONTRACT_PAIRED_REPORT_VERSION ||
    report.experimentVersion !== GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION ||
    reportFingerprint !== sha256(stableJson(payload))
  ) throw new Error("GI088_PRO_CONTRACT_PRIVATE_REPORT_INTEGRITY_INVALID");
  return report;
}

export function sha256Gi088ProContractArtifact(value: unknown) {
  return gi088ProContractSha256(`${JSON.stringify(value, null, 2)}\n`);
}
