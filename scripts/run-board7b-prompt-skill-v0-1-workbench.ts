import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import {
  BOARD7B_PROMPT_SKILL_V0_1_APPROVAL_SCOPE,
  BOARD7B_PROMPT_SKILL_V0_1_APPROVAL_VERSION,
  BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_1_EVALUATION_ID,
  BOARD7B_PROMPT_SKILL_V0_1_FIXED_OPENING,
  BOARD7B_PROMPT_SKILL_V0_1_LOCAL_RUNTIME_DIRECTORY,
  BOARD7B_PROMPT_SKILL_V0_1_PROMPT_VERSIONS,
  BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG,
  applyBoard7bPromptSkillV01SemanticResult,
  board7bPromptSkillV01EndSchema,
  createBoard7bPromptSkillV01CandidateFingerprint,
  createBoard7bPromptSkillV01InitialSemanticState,
  createBoard7bPromptSkillV01RunFingerprint,
  createBoard7bPromptSkillV01UserPrompt,
  loadBoard7bPromptSkillV01Assets,
  parseBoard7bPromptSkillV01Output,
  renderBoard7bPromptSkillV01Visible,
  validateBoard7bPromptSkillV01Output,
  type Board7bPromptSkillV01Assets,
  type Board7bPromptSkillV01EndDecision,
  type Board7bPromptSkillV01Output,
  type Board7bPromptSkillV01SemanticState,
  type Board7bPromptSkillV01StartApproval,
  type Board7bPromptSkillV01TurnInput
} from "../evals/event-centered-generative/board7b-prompt-skill-v0-1/board7b-prompt-skill-v0-1";
import type {
  AICompletionResult,
  AIProvider
} from "../src/server/services/ai/ai-provider";
import { getAIProviderFailureCode } from "../src/server/services/ai/ai-provider";
import { getEventCenteredAIProvider } from "../src/server/services/ai/event-centered-provider";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 4328;
const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/iu;
const MAX_BODY_BYTES = 24_000;
const KEYCHAIN_ACCOUNT = "board7a";
const KEYCHAIN_SERVICE = "com.dailylight.local-eval.deepseek";
const execFileAsync = promisify(execFile);

type Message = Board7bPromptSkillV01TurnInput["conversation"][number];

export type Board7bPromptSkillV01SessionStatus =
  | "running"
  | "technical_failure"
  | "protected_failure"
  | "completed";

export type Board7bPromptSkillV01CallRecord = {
  callId: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  status: "valid" | "technical_failure" | "protected_failure";
  provider: string | null;
  model: typeof BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model;
  requestHash: string;
  responseHash: string | null;
  rawOutput: string | null;
  latencyMs: number | null;
  tokenUsage: AICompletionResult["tokenUsage"] | null;
  errorCode: string | null;
};

export type Board7bPromptSkillV01TurnRecord = {
  turnId: string;
  userMessageId: string;
  status: "pending" | "valid" | "technical_failure" | "protected_failure";
  semantic: Board7bPromptSkillV01Output["semantic"] | null;
  visible: Board7bPromptSkillV01Output["visible"] | null;
  visibleText: string | null;
  validationIssues: string[];
  evidenceExcerpts: Array<{ id: string; content: string }>;
  semanticStateBefore: Board7bPromptSkillV01SemanticState;
  semanticStateAfter: Board7bPromptSkillV01SemanticState | null;
  providerInitializationFailures: Array<{
    occurredAt: string;
    errorCode: string;
  }>;
  calls: Board7bPromptSkillV01CallRecord[];
};

export type Board7bPromptSkillV01SessionCheckpoint = {
  evaluationId: typeof BOARD7B_PROMPT_SKILL_V0_1_EVALUATION_ID;
  candidateVersion: typeof BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION;
  candidateFingerprint: string;
  runFingerprint: string;
  runId: string;
  status: Board7bPromptSkillV01SessionStatus;
  createdAt: string;
  updatedAt: string;
  approval: Board7bPromptSkillV01StartApproval;
  messages: Message[];
  semanticState: Board7bPromptSkillV01SemanticState;
  turns: Board7bPromptSkillV01TurnRecord[];
  pendingUserTurn: null | {
    turnId: string;
    userMessageId: string;
    content: string;
    submittedAt: string;
  };
  technicalError: string | null;
  result: null | (Board7bPromptSkillV01EndDecision & { completedAt: string });
};

const startInputSchema = z.object({ confirmation: z.literal(true) });
const turnInputSchema = z.object({
  content: z.string().trim().min(1).max(8_000)
});

function argumentValue(name: string) {
  const direct = process.argv.find((item) => item.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeJsonAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

function nextMessageId(messages: Message[], role: "user" | "assistant") {
  const prefix = role === "user" ? "U" : "A";
  const count = messages.filter((message) => message.role === role).length;
  return `${prefix}${role === "user" ? count + 1 : count}`;
}

export function createBoard7bPromptSkillV01Checkpoint(input: {
  candidateFingerprint: string;
  trajectoryId?: string;
  approvedAt?: string;
}) {
  const approval: Board7bPromptSkillV01StartApproval = {
    approvalType: BOARD7B_PROMPT_SKILL_V0_1_EVALUATION_ID,
    approvalVersion: BOARD7B_PROMPT_SKILL_V0_1_APPROVAL_VERSION,
    decision: "approved",
    approvedBy: "product_owner_ui",
    approvedAt: input.approvedAt ?? new Date().toISOString(),
    candidateFingerprint: input.candidateFingerprint,
    trajectoryId: input.trajectoryId ?? randomUUID(),
    approvalScope: BOARD7B_PROMPT_SKILL_V0_1_APPROVAL_SCOPE
  };
  const runFingerprint = createBoard7bPromptSkillV01RunFingerprint(approval);
  const checkpoint: Board7bPromptSkillV01SessionCheckpoint = {
    evaluationId: BOARD7B_PROMPT_SKILL_V0_1_EVALUATION_ID,
    candidateVersion: BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION,
    candidateFingerprint: input.candidateFingerprint,
    runFingerprint,
    runId: `run-${runFingerprint}`,
    status: "running",
    createdAt: approval.approvedAt,
    updatedAt: approval.approvedAt,
    approval,
    messages: [
      {
        id: "A0",
        role: "assistant",
        content: BOARD7B_PROMPT_SKILL_V0_1_FIXED_OPENING
      }
    ],
    semanticState: createBoard7bPromptSkillV01InitialSemanticState(),
    turns: [],
    pendingUserTurn: null,
    technicalError: null,
    result: null
  };
  return checkpoint;
}

function consumeAwaitingAnswerOpportunity(
  semanticState: Board7bPromptSkillV01SemanticState
) {
  const focusId = semanticState.answerOpportunities.currentFocusStateId;
  const ledger = semanticState.answerOpportunities.ledgers.find(
    (item) => item.focusStateId === focusId
  );
  if (ledger?.awaiting) ledger.awaiting = null;
}

export function submitBoard7bPromptSkillV01UserTurn(
  checkpoint: Board7bPromptSkillV01SessionCheckpoint,
  content: string
) {
  if (checkpoint.status !== "running" || checkpoint.pendingUserTurn) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_1_SESSION_NOT_READY_FOR_TURN");
  }
  const parsed = turnInputSchema.parse({ content });
  const userMessage: Message = {
    id: nextMessageId(checkpoint.messages, "user"),
    role: "user",
    content: parsed.content
  };
  consumeAwaitingAnswerOpportunity(checkpoint.semanticState);
  const turnId = randomUUID();
  checkpoint.messages.push(userMessage);
  checkpoint.turns.push({
    turnId,
    userMessageId: userMessage.id,
    status: "pending",
    semantic: null,
    visible: null,
    visibleText: null,
    validationIssues: [],
    evidenceExcerpts: [],
    semanticStateBefore: structuredClone(checkpoint.semanticState),
    semanticStateAfter: null,
    providerInitializationFailures: [],
    calls: []
  });
  checkpoint.pendingUserTurn = {
    turnId,
    userMessageId: userMessage.id,
    content: userMessage.content,
    submittedAt: new Date().toISOString()
  };
  checkpoint.updatedAt = new Date().toISOString();
  return { turnId, userMessageId: userMessage.id };
}

export function completeBoard7bPromptSkillV01Session(
  checkpoint: Board7bPromptSkillV01SessionCheckpoint,
  value: unknown
) {
  if (checkpoint.status === "completed") {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_1_SESSION_ALREADY_COMPLETED");
  }
  const decision = board7bPromptSkillV01EndSchema.parse(value);
  checkpoint.result = { ...decision, completedAt: new Date().toISOString() };
  checkpoint.status = "completed";
  checkpoint.updatedAt = new Date().toISOString();
  return checkpoint.result;
}

function createAwaitingStartPublicState(candidateFingerprint: string) {
  return {
    evaluationId: BOARD7B_PROMPT_SKILL_V0_1_EVALUATION_ID,
    candidateVersion: BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION,
    candidateFingerprint,
    runFingerprint: null,
    runId: null,
    status: "awaiting_start" as const,
    inFlight: false,
    fixedOpening: BOARD7B_PROMPT_SKILL_V0_1_FIXED_OPENING,
    runtime: createRuntimeIdentity(),
    messages: [] as Message[],
    semanticState: createBoard7bPromptSkillV01InitialSemanticState(),
    turns: [] as Board7bPromptSkillV01TurnRecord[],
    technicalError: null,
    result: null,
    modelCallCount: 0
  };
}

function createRuntimeIdentity() {
  return {
    service: "DeepSeek 官方 API",
    adapter: "OpenAI-compatible",
    baseUrlHost: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.baseUrlHost,
    model: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model,
    promptVersions: BOARD7B_PROMPT_SKILL_V0_1_PROMPT_VERSIONS,
    credentialReadiness: "authenticated_before_server_start"
  };
}

export function createBoard7bPromptSkillV01PublicState(
  checkpoint: Board7bPromptSkillV01SessionCheckpoint | null,
  inFlight: boolean,
  candidateFingerprint = checkpoint?.candidateFingerprint ?? ""
) {
  if (!checkpoint) return createAwaitingStartPublicState(candidateFingerprint);
  return {
    evaluationId: checkpoint.evaluationId,
    candidateVersion: checkpoint.candidateVersion,
    candidateFingerprint: checkpoint.candidateFingerprint,
    runFingerprint: checkpoint.runFingerprint,
    runId: checkpoint.runId,
    status: checkpoint.status,
    inFlight,
    fixedOpening: BOARD7B_PROMPT_SKILL_V0_1_FIXED_OPENING,
    runtime: createRuntimeIdentity(),
    messages: checkpoint.messages,
    semanticState: checkpoint.semanticState,
    turns: checkpoint.turns.map((turn) => ({
      turnId: turn.turnId,
      userMessageId: turn.userMessageId,
      status: turn.status,
      semantic: turn.semantic,
      visibleText: turn.visibleText,
      validationIssues: turn.validationIssues,
      evidenceExcerpts: turn.evidenceExcerpts,
      semanticStateAfter: turn.semanticStateAfter,
      providerInitializationFailures: turn.providerInitializationFailures,
      callCount: turn.calls.length,
      lastCall: turn.calls.length
        ? (() => {
            const call = turn.calls.at(-1)!;
            return {
              status: call.status,
              providerAdapter: call.provider,
              model: call.model,
              requestHash: call.requestHash,
              latencyMs: call.latencyMs,
              tokenUsage: call.tokenUsage,
              errorCode: call.errorCode
            };
          })()
        : null
    })),
    technicalError: checkpoint.technicalError,
    result: checkpoint.result,
    modelCallCount: checkpoint.turns.reduce(
      (sum, turn) => sum + turn.calls.length,
      0
    )
  };
}

function technicalErrorCode(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") {
    return "INVALID_JSON_SCHEMA";
  }
  if (error instanceof SyntaxError) return "INVALID_JSON";
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return getAIProviderFailureCode(error);
}

function outputEvidenceRefs(output: Board7bPromptSkillV01Output) {
  return [
    ...output.semantic.focus.evidenceRefs,
    ...output.semantic.understandingDelta.evidenceRefs,
    ...(output.semantic.openPart?.evidenceRefs ?? []),
    ...(output.semantic.burdenSignal?.evidenceRefs ?? [])
  ].filter((value, index, values) => values.indexOf(value) === index);
}

export async function executeBoard7bPromptSkillV01PendingTurn(input: {
  checkpoint: Board7bPromptSkillV01SessionCheckpoint;
  provider: AIProvider;
  assets: Board7bPromptSkillV01Assets;
  persist?: () => Promise<void>;
}) {
  const persist = input.persist ?? (async () => {});
  const { checkpoint } = input;
  const pending = checkpoint.pendingUserTurn;
  if (!pending) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_1_PENDING_TURN_MISSING");
  }
  const turn = checkpoint.turns.find((item) => item.turnId === pending.turnId);
  if (!turn) throw new Error("BOARD7B_PROMPT_SKILL_V0_1_TURN_RECORD_MISSING");

  checkpoint.status = "running";
  checkpoint.technicalError = null;
  turn.status = "pending";
  await persist();

  const turnInput: Board7bPromptSkillV01TurnInput = {
    mode: "accompany_chat",
    conversation: checkpoint.messages,
    latestUserMessageId: pending.userMessageId,
    semanticState: turn.semanticStateBefore
  };
  const userPrompt = createBoard7bPromptSkillV01UserPrompt(turnInput);
  const requestHash = sha256(
    JSON.stringify({
      systemPrompt: input.assets.systemPrompt,
      userPrompt,
      runtimeConfig: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG
    })
  );
  const callId = randomUUID();
  const attempt = turn.calls.length + 1;
  const startedAt = new Date().toISOString();
  let completion: AICompletionResult | null = null;

  try {
    completion = await input.provider.complete({
      messages: [
        { role: "system", content: input.assets.systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.temperature,
      maxTokens: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.maxTokens,
      timeoutMs: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.timeoutMs,
      responseFormat: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.responseFormat,
      thinking: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.thinking
    });
    const output = parseBoard7bPromptSkillV01Output(completion.content);
    const validationIssues = validateBoard7bPromptSkillV01Output({
      input: turnInput,
      output
    });
    const visibleText = renderBoard7bPromptSkillV01Visible(output);
    const byId = new Map(
      checkpoint.messages
        .filter((message) => message.role === "user")
        .map((message) => [message.id, message.content])
    );

    turn.semantic = output.semantic;
    turn.visible = output.visible;
    turn.visibleText = visibleText;
    turn.validationIssues = validationIssues;
    turn.evidenceExcerpts = outputEvidenceRefs(output).flatMap((ref) => {
      const content = byId.get(ref);
      return content ? [{ id: ref, content }] : [];
    });
    turn.calls.push({
      callId,
      attempt,
      startedAt,
      completedAt: new Date().toISOString(),
      status: validationIssues.length ? "protected_failure" : "valid",
      provider: completion.provider,
      model: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model,
      requestHash,
      responseHash: sha256(completion.content),
      rawOutput: completion.content,
      latencyMs: completion.latencyMs,
      tokenUsage: completion.tokenUsage ?? null,
      errorCode: validationIssues.length
        ? "PROGRAM_PROTECTION_REJECTED"
        : null
    });

    if (validationIssues.length) {
      turn.status = "protected_failure";
      checkpoint.status = "protected_failure";
      checkpoint.pendingUserTurn = null;
    } else {
      const nextState = applyBoard7bPromptSkillV01SemanticResult({
        input: turnInput,
        output
      });
      checkpoint.messages.push({
        id: nextMessageId(checkpoint.messages, "assistant"),
        role: "assistant",
        content: visibleText
      });
      checkpoint.semanticState = nextState;
      turn.semanticStateAfter = nextState;
      turn.status = "valid";
      checkpoint.status = "running";
      checkpoint.pendingUserTurn = null;
    }
  } catch (error) {
    const errorCode = technicalErrorCode(error);
    turn.calls.push({
      callId,
      attempt,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "technical_failure",
      provider: completion?.provider ?? input.provider.name,
      model: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model,
      requestHash,
      responseHash: completion?.content ? sha256(completion.content) : null,
      rawOutput: completion?.content ?? null,
      latencyMs: completion?.latencyMs ?? null,
      tokenUsage: completion?.tokenUsage ?? null,
      errorCode
    });
    turn.status = "technical_failure";
    checkpoint.status = "technical_failure";
    checkpoint.technicalError = errorCode;
  } finally {
    checkpoint.updatedAt = new Date().toISOString();
    await persist();
  }
}

export async function recordBoard7bPromptSkillV01ProviderFailure(input: {
  checkpoint: Board7bPromptSkillV01SessionCheckpoint;
  error: unknown;
  persist?: () => Promise<void>;
}) {
  const pending = input.checkpoint.pendingUserTurn;
  if (!pending) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_1_PENDING_TURN_MISSING");
  }
  const turn = input.checkpoint.turns.find(
    (item) => item.turnId === pending.turnId
  );
  if (!turn) throw new Error("BOARD7B_PROMPT_SKILL_V0_1_TURN_RECORD_MISSING");
  const errorCode = technicalErrorCode(input.error);
  turn.status = "technical_failure";
  turn.providerInitializationFailures.push({
    occurredAt: new Date().toISOString(),
    errorCode
  });
  input.checkpoint.status = "technical_failure";
  input.checkpoint.technicalError = errorCode;
  input.checkpoint.updatedAt = new Date().toISOString();
  await (input.persist ?? (async () => {}))();
}

async function resolveCandidateCredential() {
  const processKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (processKey) {
    return { apiKey: processKey, source: "isolated_process_environment" as const };
  }
  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/security",
      [
        "find-generic-password",
        "-a",
        KEYCHAIN_ACCOUNT,
        "-s",
        KEYCHAIN_SERVICE,
        "-w"
      ],
      { encoding: "utf8" }
    );
    const apiKey = stdout.trim();
    if (apiKey) return { apiKey, source: "macos_keychain" as const };
  } catch {
    // 统一使用候选 Provider 错误口径，且不输出凭据内容。
  }
  throw Object.assign(new Error("EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"), {
    code: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"
  });
}

async function validateCandidateCredential(apiKey: string) {
  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw Object.assign(new Error("DEEPSEEK_CREDENTIAL_PREFLIGHT_UNREACHABLE"), {
      code: "DEEPSEEK_CREDENTIAL_PREFLIGHT_UNREACHABLE"
    });
  }
  if (!response.ok) {
    throw Object.assign(
      new Error(`DEEPSEEK_CREDENTIAL_PREFLIGHT_HTTP_${response.status}`),
      { code: `DEEPSEEK_CREDENTIAL_PREFLIGHT_HTTP_${response.status}` }
    );
  }
  const body = (await response.json()) as { data?: Array<{ id?: string }> };
  if (
    !body.data?.some(
      (model) => model.id === BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model
    )
  ) {
    throw Object.assign(new Error("DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE"), {
      code: "DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE"
    });
  }
}

async function createCandidateProvider(apiKey: string) {
  const provider = await getEventCenteredAIProvider({
    env: {
      NODE_ENV: "development",
      AI_PROVIDER: "openai",
      DEEPSEEK_API_KEY: apiKey,
      DEEPSEEK_MODEL: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model,
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      EVENT_CENTERED_GENERATIVE_MODEL:
        BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG.model
    }
  });
  if (!provider) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_1_PROVIDER_UNAVAILABLE");
  }
  return provider;
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

function sendError(response: ServerResponse, status: number, error: unknown) {
  sendJson(response, status, {
    error: error instanceof Error ? error.message : String(error)
  });
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error("REQUEST_BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? (JSON.parse(body) as unknown) : {};
}

function tokenMatches(actual: string | undefined, expected: string) {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function requestIsLocal(request: IncomingMessage, port: number) {
  if (!LOCAL_HOST_PATTERN.test(request.headers.host ?? "")) return false;
  const origin = request.headers.origin;
  return (
    !origin ||
    origin === `http://${HOST}:${port}` ||
    origin === `http://localhost:${port}`
  );
}

async function main() {
  const assets = await loadBoard7bPromptSkillV01Assets();
  const candidateFingerprint =
    createBoard7bPromptSkillV01CandidateFingerprint(assets);
  if (process.argv.includes("--inspect") || process.argv.includes("--check")) {
    process.stdout.write(
      `${JSON.stringify(
        {
          evaluationId: BOARD7B_PROMPT_SKILL_V0_1_EVALUATION_ID,
          candidateVersion: BOARD7B_PROMPT_SKILL_V0_1_CANDIDATE_VERSION,
          candidateFingerprint,
          runtimeConfig: BOARD7B_PROMPT_SKILL_V0_1_RUNTIME_CONFIG,
          promptVersions: BOARD7B_PROMPT_SKILL_V0_1_PROMPT_VERSIONS,
          fixedOpening: BOARD7B_PROMPT_SKILL_V0_1_FIXED_OPENING,
          binding: HOST,
          startupStatus: "awaiting_start",
          modelCalls: 0
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const portValue = Number(argumentValue("--port") ?? DEFAULT_PORT);
  if (!Number.isInteger(portValue) || portValue < 1_024 || portValue > 65_535) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_1_PORT_INVALID");
  }
  const html = await readFile(
    resolve(
      process.cwd(),
      "evals/event-centered-generative/board7b-prompt-skill-v0-1/workbench.html"
    ),
    "utf8"
  );
  const credential = await resolveCandidateCredential();
  await validateCandidateCredential(credential.apiKey);
  const serverToken = randomBytes(24).toString("hex");
  let checkpoint: Board7bPromptSkillV01SessionCheckpoint | null = null;
  let checkpointPath: string | null = null;
  let provider: AIProvider | null = null;
  let inFlight = false;

  async function persist() {
    if (!checkpoint || !checkpointPath) {
      throw new Error("BOARD7B_PROMPT_SKILL_V0_1_CHECKPOINT_NOT_STARTED");
    }
    checkpoint.updatedAt = new Date().toISOString();
    await writeJsonAtomic(checkpointPath, checkpoint);
  }

  async function ensureProvider() {
    provider ??= await createCandidateProvider(credential.apiKey);
    return provider;
  }

  async function generatePendingTurn() {
    if (!checkpoint) {
      throw new Error("BOARD7B_PROMPT_SKILL_V0_1_SESSION_NOT_STARTED");
    }
    if (inFlight) {
      throw new Error("BOARD7B_PROMPT_SKILL_V0_1_TURN_ALREADY_IN_FLIGHT");
    }
    inFlight = true;
    try {
      let activeProvider: AIProvider;
      try {
        activeProvider = await ensureProvider();
      } catch (error) {
        await recordBoard7bPromptSkillV01ProviderFailure({
          checkpoint,
          error,
          persist
        });
        return;
      }
      await executeBoard7bPromptSkillV01PendingTurn({
        checkpoint,
        provider: activeProvider,
        assets,
        persist
      });
    } finally {
      inFlight = false;
    }
  }

  const server = createServer(async (request, response) => {
    try {
      if (!requestIsLocal(request, portValue)) {
        response.writeHead(404).end();
        return;
      }
      const url = new URL(request.url ?? "/", `http://${HOST}:${portValue}`);
      const rawHeaderToken = request.headers["x-eval-token"];
      const headerToken = Array.isArray(rawHeaderToken)
        ? rawHeaderToken[0]
        : rawHeaderToken;
      const queryToken = url.searchParams.get("token") ?? undefined;
      if (!tokenMatches(headerToken ?? queryToken, serverToken)) {
        response.writeHead(404).end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "no-referrer"
        });
        response.end(html);
        return;
      }
      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204).end();
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/session") {
        sendJson(
          response,
          200,
          createBoard7bPromptSkillV01PublicState(
            checkpoint,
            inFlight,
            candidateFingerprint
          )
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/start") {
        startInputSchema.parse(await readBody(request));
        if (checkpoint) {
          throw new Error("BOARD7B_PROMPT_SKILL_V0_1_TRAJECTORY_ALREADY_STARTED");
        }
        checkpoint = createBoard7bPromptSkillV01Checkpoint({
          candidateFingerprint
        });
        checkpointPath = resolve(
          process.cwd(),
          BOARD7B_PROMPT_SKILL_V0_1_LOCAL_RUNTIME_DIRECTORY,
          checkpoint.runId,
          "checkpoint.json"
        );
        await persist();
        sendJson(
          response,
          200,
          createBoard7bPromptSkillV01PublicState(checkpoint, inFlight)
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/turn") {
        if (!checkpoint) {
          throw new Error("BOARD7B_PROMPT_SKILL_V0_1_SESSION_NOT_STARTED");
        }
        if (checkpoint.status !== "running" || checkpoint.pendingUserTurn) {
          throw new Error("BOARD7B_PROMPT_SKILL_V0_1_SESSION_NOT_READY_FOR_TURN");
        }
        const input = turnInputSchema.parse(await readBody(request));
        submitBoard7bPromptSkillV01UserTurn(checkpoint, input.content);
        await persist();
        await generatePendingTurn();
        sendJson(
          response,
          200,
          createBoard7bPromptSkillV01PublicState(checkpoint, inFlight)
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/retry") {
        await readBody(request);
        if (
          !checkpoint ||
          checkpoint.status !== "technical_failure" ||
          !checkpoint.pendingUserTurn
        ) {
          throw new Error(
            "BOARD7B_PROMPT_SKILL_V0_1_TECHNICAL_RETRY_NOT_AVAILABLE"
          );
        }
        await generatePendingTurn();
        sendJson(
          response,
          200,
          createBoard7bPromptSkillV01PublicState(checkpoint, inFlight)
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/end") {
        if (!checkpoint || inFlight) {
          throw new Error("BOARD7B_PROMPT_SKILL_V0_1_SESSION_NOT_READY_TO_END");
        }
        completeBoard7bPromptSkillV01Session(
          checkpoint,
          await readBody(request)
        );
        await persist();
        sendJson(
          response,
          200,
          createBoard7bPromptSkillV01PublicState(checkpoint, inFlight)
        );
        return;
      }
      response.writeHead(404).end();
    } catch (error) {
      sendError(response, 400, error);
    }
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(portValue, HOST, () => resolvePromise());
  });
  process.stdout.write(
    [
      "GI-084 v0.1 真实用户直连工作台已启动。",
      `候选指纹：${candidateFingerprint}`,
      `凭据状态：已通过 DeepSeek 官方认证与模型可用性检查（${credential.source}）。`,
      `打开：http://${HOST}:${portValue}/?token=${serverToken}`,
      "当前模型调用：0。开始只创建本机轨迹，发送第一段回答时才会调用 DeepSeek。"
    ].join("\n") + "\n"
  );
}

const shouldRun = ["--inspect", "--check", "--serve"].some((flag) =>
  process.argv.includes(flag)
);

if (shouldRun) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
