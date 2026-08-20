import { createHash } from "node:crypto";

import {
  createBoard7bWorkingTaskV1UserPrompt,
  parseBoard7bWorkingTaskV1Output,
  validateBoard7bWorkingTaskV1Output,
  type Board7bWorkingTaskV1TurnInput
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

import {
  createGi088V1EffectiveCandidateFingerprint,
  getGi088V1CandidateAssets
} from "./candidate";
import type {
  Gi088BatchState,
  Gi088Call,
  Gi088TaskState,
  Gi088Turn
} from "./types";
import type {
  AICompletionParams,
  AIProvider,
  AIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAICompletionTokenUsage,
  sanitizeAIProviderDiagnostics
} from "@/server/services/ai/ai-provider";
import { createGi088OutputSchemaIssues } from "@/server/services/evaluation/gi088/schema-diagnostics";

export const GI088_EMPTY_CONTENT_PROBE_VERSION =
  "2026-08-09.gi088-empty-content-response-format-probe-v1" as const;
export const GI088_EMPTY_CONTENT_SOURCE_SNAPSHOT_SHA256 =
  "130efc938dc2a7fa3d68a7703390cf226b8d9c3d87451417dad677b2f235f0d5" as const;
export const GI088_EMPTY_CONTENT_SOURCE_EVALUATION_VERSION =
  "2026-08-09.gi088-human-eval-v1" as const;
export const GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT =
  "58074d31e96d18c2fd196a344c6f471a98024897f6578b97ed8288913308b884" as const;
export const GI088_EMPTY_CONTENT_SOURCE_EXECUTION_FINGERPRINT =
  "4b65801390264df957189efbc968c9b2584e212154e98671370b8167e7ff70b2" as const;
export const GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET = 6 as const;
export const GI088_EMPTY_CONTENT_PROBE_RUNTIME = {
  provider: "openai",
  model: "deepseek-v4-flash",
  baseUrlHost: "api.deepseek.com"
} as const;
export const GI088_EMPTY_CONTENT_SOURCE_HIGH_CONFIG = {
  key: "high",
  label: "Thinking 开启 · high",
  provider: "openai",
  baseUrlHost: "api.deepseek.com",
  model: "deepseek-v4-flash",
  thinking: "enabled",
  temperature: null,
  effectiveTemperature: null,
  reasoningEffort: "high",
  maxTokens: null,
  maxTokensPolicy: "provider_default",
  responseFormat: "json_object",
  qualityRetries: 0,
  automaticTechnicalRetries: 0
} as const;

export type Gi088EmptyContentProbeVariant = "json_object" | "text_json";

export const GI088_EMPTY_CONTENT_PROBE_CASES = [
  {
    caseId: "E1",
    contextClass: "cold_start",
    taskId: "A3",
    branch: "high",
    turnId: "5b85a506-dc99-4f43-82b6-073f2c677851",
    sourceCallId: "44e549d5-352f-4ecb-bc36-8eb904bfc90f",
    sourceRequestHash:
      "2f4e1e38bbd64e93f6e740ab07da9e61f2b04f98da499d556e44cb983d689912"
  },
  {
    caseId: "E2",
    contextClass: "mid_trajectory",
    taskId: "A8",
    branch: "high",
    turnId: "e15ab3df-5e77-4e13-8558-4da9cbca5757",
    sourceCallId: "06b9e404-394c-4949-a669-92700d4d3247",
    sourceRequestHash:
      "25b6943cd42be4694486bc5d7d42925d7b73579cc5d6bd14c29801b1f0642e0d"
  },
  {
    caseId: "E3",
    contextClass: "long_context_repeated_failure",
    taskId: "A1",
    branch: "high",
    turnId: "b6163c4b-973e-4dc0-a7e4-be526e4e20f8",
    sourceCallId: "052f6a93-3583-4890-a377-12dec613a254",
    sourceRequestHash:
      "d9ca7d0cc781e6d6fa974923060c326456a0ae435e85b31b96225456e3258b89"
  }
] as const;

type SourceSnapshot = {
  record: {
    evaluationVersion: string;
    candidateFingerprint: string;
    executionFingerprint: string;
    state: Gi088BatchState;
  };
};

export type Gi088EmptyContentProbeCase = {
  caseId: string;
  contextClass: string;
  taskId: string;
  branch: "high";
  turnId: string;
  sourceCallId: string;
  sourceRequestHash: string;
  turnInput: Board7bWorkingTaskV1TurnInput;
};

export function createGi088EmptyContentProbePublicCase(
  probeCase: Gi088EmptyContentProbeCase
) {
  return {
    caseId: probeCase.caseId,
    contextClass: probeCase.contextClass,
    taskId: probeCase.taskId,
    branch: probeCase.branch,
    turnId: probeCase.turnId,
    sourceCallId: probeCase.sourceCallId,
    sourceRequestHash: probeCase.sourceRequestHash
  };
}

export type Gi088EmptyContentProbePlan = {
  probeVersion: typeof GI088_EMPTY_CONTENT_PROBE_VERSION;
  probeFingerprint: string;
  sourceSnapshotSha256: string;
  sourceEvaluationVersion: string;
  sourceCandidateFingerprint: string;
  sourceExecutionFingerprint: string;
  effectiveCandidateFingerprint: string;
  runtime: typeof GI088_EMPTY_CONTENT_PROBE_RUNTIME;
  authorizedCallBudget: typeof GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET;
  automaticRetries: 0;
  variants: Gi088EmptyContentProbeVariant[];
  cases: Gi088EmptyContentProbeCase[];
};

export type Gi088EmptyContentProbeResult = {
  caseId: string;
  variant: Gi088EmptyContentProbeVariant;
  sourceCallId: string;
  sourceRequestHash: string;
  probeRequestHash: string;
  requestHashVerified: true;
  status: "valid" | "technical_failure" | "protected_failure";
  errorCode: string | null;
  responseHash: string | null;
  rawFinalOutput: string | null;
  validationIssues: string[];
  latencyMs: number | null;
  tokenUsage: ReturnType<typeof sanitizeAICompletionTokenUsage>;
  providerDiagnostics: AIProviderDiagnostics | null;
};

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSourceSnapshot(value: unknown): asserts value is SourceSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GI088_EMPTY_PROBE_SOURCE_INVALID");
  }
  const record = (value as { record?: unknown }).record;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("GI088_EMPTY_PROBE_SOURCE_RECORD_INVALID");
  }
  const source = record as Record<string, unknown>;
  if (
    source.evaluationVersion !== GI088_EMPTY_CONTENT_SOURCE_EVALUATION_VERSION ||
    source.candidateFingerprint !== GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT ||
    source.executionFingerprint !== GI088_EMPTY_CONTENT_SOURCE_EXECUTION_FINGERPRINT ||
    !source.state ||
    typeof source.state !== "object" ||
    Array.isArray(source.state)
  ) {
    throw new Error("GI088_EMPTY_PROBE_SOURCE_LINEAGE_MISMATCH");
  }
}

function findTask(state: Gi088BatchState, taskId: string): Gi088TaskState {
  const task = state.tasks.find((item) => item.taskId === taskId);
  if (!task) throw new Error(`GI088_EMPTY_PROBE_TASK_NOT_FOUND:${taskId}`);
  return task;
}

function findTurn(task: Gi088TaskState, turnId: string): Gi088Turn {
  const turn = task.branches.high.turns.find((item) => item.id === turnId);
  if (!turn) throw new Error(`GI088_EMPTY_PROBE_TURN_NOT_FOUND:${turnId}`);
  return turn;
}

function findCall(turn: Gi088Turn, callId: string): Gi088Call {
  const call = turn.calls.find((item) => item.id === callId);
  if (!call) throw new Error(`GI088_EMPTY_PROBE_CALL_NOT_FOUND:${callId}`);
  return call;
}

function createTurnInput(task: Gi088TaskState, turn: Gi088Turn) {
  const messageIndex = task.branches.high.messages.findIndex(
    (message) => message.id === turn.userMessageId
  );
  if (messageIndex < 0) {
    throw new Error(`GI088_EMPTY_PROBE_USER_MESSAGE_NOT_FOUND:${turn.userMessageId}`);
  }
  return {
    mode: "accompany_chat" as const,
    conversation: structuredClone(
      task.branches.high.messages.slice(0, messageIndex + 1)
    ),
    latestUserMessageId: turn.userMessageId,
    semanticState: structuredClone(turn.semanticStateBefore)
  } satisfies Board7bWorkingTaskV1TurnInput;
}

function createSourceRequestHash(turnInput: Board7bWorkingTaskV1TurnInput) {
  return sha256(
    JSON.stringify({
      systemPrompt: getGi088V1CandidateAssets().systemPrompt,
      userPrompt: createBoard7bWorkingTaskV1UserPrompt(turnInput),
      config: GI088_EMPTY_CONTENT_SOURCE_HIGH_CONFIG
    })
  );
}

export function createGi088EmptyContentProbePlan(input: {
  snapshot: unknown;
  snapshotBytes: Uint8Array;
}): Gi088EmptyContentProbePlan {
  const snapshotSha256 = sha256(input.snapshotBytes);
  if (snapshotSha256 !== GI088_EMPTY_CONTENT_SOURCE_SNAPSHOT_SHA256) {
    throw new Error("GI088_EMPTY_PROBE_SNAPSHOT_HASH_MISMATCH");
  }
  assertSourceSnapshot(input.snapshot);
  const snapshot = input.snapshot;

  const cases = GI088_EMPTY_CONTENT_PROBE_CASES.map((definition) => {
    const task = findTask(snapshot.record.state, definition.taskId);
    const turn = findTurn(task, definition.turnId);
    const call = findCall(turn, definition.sourceCallId);
    if (
      call.errorCode !== "EMPTY_CONTENT" ||
      call.requestHash !== definition.sourceRequestHash
    ) {
      throw new Error(`GI088_EMPTY_PROBE_SOURCE_CALL_MISMATCH:${definition.caseId}`);
    }
    const turnInput = createTurnInput(task, turn);
    if (createSourceRequestHash(turnInput) !== definition.sourceRequestHash) {
      throw new Error(`GI088_EMPTY_PROBE_REQUEST_HASH_MISMATCH:${definition.caseId}`);
    }
    return { ...definition, turnInput };
  });

  const effectiveCandidateFingerprint =
    createGi088V1EffectiveCandidateFingerprint();
  if (
    effectiveCandidateFingerprint !==
    GI088_EMPTY_CONTENT_SOURCE_CANDIDATE_FINGERPRINT
  ) {
    throw new Error("GI088_EMPTY_PROBE_EFFECTIVE_CANDIDATE_MISMATCH");
  }
  const variants: Gi088EmptyContentProbeVariant[] = ["json_object", "text_json"];
  const probeFingerprint = sha256(
    JSON.stringify({
      probeVersion: GI088_EMPTY_CONTENT_PROBE_VERSION,
      sourceSnapshotSha256: snapshotSha256,
      sourceEvaluationVersion: snapshot.record.evaluationVersion,
      sourceCandidateFingerprint: snapshot.record.candidateFingerprint,
      sourceExecutionFingerprint: snapshot.record.executionFingerprint,
      effectiveCandidateFingerprint,
      runtime: GI088_EMPTY_CONTENT_PROBE_RUNTIME,
      authorizedCallBudget: GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET,
      automaticRetries: 0,
      variants,
      cases: cases.map(createGi088EmptyContentProbePublicCase),
      highConfig: GI088_EMPTY_CONTENT_SOURCE_HIGH_CONFIG
    })
  );

  return {
    probeVersion: GI088_EMPTY_CONTENT_PROBE_VERSION,
    probeFingerprint,
    sourceSnapshotSha256: snapshotSha256,
    sourceEvaluationVersion: snapshot.record.evaluationVersion,
    sourceCandidateFingerprint: snapshot.record.candidateFingerprint,
    sourceExecutionFingerprint: snapshot.record.executionFingerprint,
    effectiveCandidateFingerprint,
    runtime: GI088_EMPTY_CONTENT_PROBE_RUNTIME,
    authorizedCallBudget: GI088_EMPTY_CONTENT_PROBE_CALL_BUDGET,
    automaticRetries: 0,
    variants,
    cases
  };
}

export function createGi088EmptyContentProbeCompletionParams(
  probeCase: Gi088EmptyContentProbeCase,
  variant: Gi088EmptyContentProbeVariant
): AICompletionParams {
  return {
    messages: [
      { role: "system", content: getGi088V1CandidateAssets().systemPrompt },
      {
        role: "user",
        content: createBoard7bWorkingTaskV1UserPrompt(probeCase.turnInput)
      }
    ],
    useProviderDefaultMaxTokens: true,
    timeoutMs: 30_000,
    ...(variant === "json_object" ? { responseFormat: "json_object" as const } : {}),
    thinking: "enabled",
    reasoningEffort: "high"
  };
}

export function createGi088EmptyContentProbeRequestHash(
  probeCase: Gi088EmptyContentProbeCase,
  variant: Gi088EmptyContentProbeVariant
) {
  return sha256(
    JSON.stringify(createGi088EmptyContentProbeCompletionParams(probeCase, variant))
  );
}

export async function runGi088EmptyContentProbeCall(input: {
  provider: AIProvider;
  probeCase: Gi088EmptyContentProbeCase;
  variant: Gi088EmptyContentProbeVariant;
}): Promise<Gi088EmptyContentProbeResult> {
  const params = createGi088EmptyContentProbeCompletionParams(
    input.probeCase,
    input.variant
  );
  const probeRequestHash = sha256(JSON.stringify(params));
  let completion: Awaited<ReturnType<AIProvider["complete"]>>;
  try {
    completion = await input.provider.complete(params);
  } catch (error) {
    const diagnostics = getAIProviderDiagnostics(error);
    return {
      caseId: input.probeCase.caseId,
      variant: input.variant,
      sourceCallId: input.probeCase.sourceCallId,
      sourceRequestHash: input.probeCase.sourceRequestHash,
      probeRequestHash,
      requestHashVerified: true,
      status: "technical_failure",
      errorCode: getAIProviderFailureCode(error),
      responseHash: null,
      rawFinalOutput: null,
      validationIssues: [],
      latencyMs: diagnostics?.latencyMs ?? null,
      tokenUsage: diagnostics?.tokenUsage ?? null,
      providerDiagnostics: diagnostics
    };
  }

  try {
    const output = parseBoard7bWorkingTaskV1Output(completion.content);
    const validationIssues = validateBoard7bWorkingTaskV1Output({
      input: input.probeCase.turnInput,
      output
    });
    return {
      caseId: input.probeCase.caseId,
      variant: input.variant,
      sourceCallId: input.probeCase.sourceCallId,
      sourceRequestHash: input.probeCase.sourceRequestHash,
      probeRequestHash,
      requestHashVerified: true,
      status: validationIssues.length ? "protected_failure" : "valid",
      errorCode: validationIssues.length ? "MODEL_OUTPUT_PROTECTED" : null,
      responseHash: sha256(completion.content),
      rawFinalOutput: completion.content,
      validationIssues,
      latencyMs: completion.latencyMs,
      tokenUsage: sanitizeAICompletionTokenUsage(completion.tokenUsage),
      providerDiagnostics: sanitizeAIProviderDiagnostics(completion.diagnostics)
    };
  } catch (error) {
    return {
      caseId: input.probeCase.caseId,
      variant: input.variant,
      sourceCallId: input.probeCase.sourceCallId,
      sourceRequestHash: input.probeCase.sourceRequestHash,
      probeRequestHash,
      requestHashVerified: true,
      status: "protected_failure",
      errorCode: "MODEL_OUTPUT_PROTECTED",
      responseHash: sha256(completion.content),
      rawFinalOutput: completion.content,
      validationIssues: createGi088OutputSchemaIssues(error),
      latencyMs: completion.latencyMs,
      tokenUsage: sanitizeAICompletionTokenUsage(completion.tokenUsage),
      providerDiagnostics: sanitizeAIProviderDiagnostics(completion.diagnostics)
    };
  }
}

export function createGi088EmptyContentProbePublicSummary(
  result: Gi088EmptyContentProbeResult
) {
  const errorCode =
    result.errorCode === null ||
    /^[A-Z][A-Z0-9_]{0,127}$/u.test(result.errorCode)
      ? result.errorCode
      : "PROVIDER_ERROR";
  const validationIssues = [
    ...new Set(
      result.validationIssues.map((issue) => {
        const code = issue.split(":", 1)[0] ?? "";
        return /^[A-Z][A-Z0-9_]{0,127}$/u.test(code)
          ? code
          : "VALIDATION_ISSUE";
      })
    )
  ];
  return {
    caseId: result.caseId,
    variant: result.variant,
    sourceCallId: result.sourceCallId,
    sourceRequestHash: result.sourceRequestHash,
    probeRequestHash: result.probeRequestHash,
    requestHashVerified: result.requestHashVerified,
    status: result.status,
    errorCode,
    responseHash: result.responseHash,
    validationIssues,
    latencyMs: result.latencyMs,
    tokenUsage: sanitizeAICompletionTokenUsage(result.tokenUsage),
    providerDiagnostics: sanitizeAIProviderDiagnostics(result.providerDiagnostics)
  };
}
