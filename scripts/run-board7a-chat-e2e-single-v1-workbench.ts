import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { execFile } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import {
  BOARD7A_CHAT_E2E_V1_APPROVAL_SCOPE,
  BOARD7A_CHAT_E2E_V1_APPROVAL_VERSION,
  BOARD7A_CHAT_E2E_V1_CANDIDATE_VERSION,
  BOARD7A_CHAT_E2E_V1_EVALUATION_ID,
  BOARD7A_CHAT_E2E_V1_FIXED_OPENING,
  BOARD7A_CHAT_E2E_V1_LOCAL_RUNTIME_DIRECTORY,
  BOARD7A_CHAT_E2E_V1_PROMPT_VERSIONS,
  BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG,
  BOARD7A_CHAT_E2E_V1_SYSTEM_PROMPT,
  board7aChatE2eV1EndSchema,
  createBoard7aChatE2eV1CandidateFingerprint,
  createBoard7aChatE2eV1RunFingerprint,
  createBoard7aChatE2eV1UserPrompt,
  parseBoard7aChatE2eV1Output,
  renderBoard7aChatE2eV1Visible,
  validateBoard7aChatE2eV1Output,
  type Board7aChatE2eV1EndDecision,
  type Board7aChatE2eV1Message,
  type Board7aChatE2eV1Semantic,
  type Board7aChatE2eV1StartApproval,
  type Board7aChatE2eV1Visible
} from "../evals/event-centered-generative/board7a-chat-e2e-single-v1/board7a-chat-e2e-single-v1";
import type { AICompletionResult, AIProvider } from "../src/server/services/ai/ai-provider";
import { getAIProviderFailureCode } from "../src/server/services/ai/ai-provider";
import { getEventCenteredAIProvider } from "../src/server/services/ai/event-centered-provider";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 4318;
const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/iu;
const MAX_BODY_BYTES = 24_000;
const KEYCHAIN_ACCOUNT = "board7a";
const KEYCHAIN_SERVICE = "com.dailylight.local-eval.deepseek";
const execFileAsync = promisify(execFile);

export type Board7aChatE2eV1SessionStatus =
  | "running"
  | "technical_failure"
  | "protected_failure"
  | "completed";

export type Board7aChatE2eV1CallRecord = {
  callId: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  status: "valid" | "technical_failure" | "protected_failure";
  provider: string | null;
  model: typeof BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.model;
  requestHash: string;
  responseHash: string | null;
  rawOutput: string | null;
  latencyMs: number | null;
  tokenUsage: AICompletionResult["tokenUsage"] | null;
  errorCode: string | null;
};

export type Board7aChatE2eV1TurnRecord = {
  turnId: string;
  userMessageId: string;
  status: "pending" | "valid" | "technical_failure" | "protected_failure";
  semantic: Board7aChatE2eV1Semantic | null;
  visible: Board7aChatE2eV1Visible | null;
  visibleText: string | null;
  validationIssues: string[];
  evidenceExcerpts: Array<{ id: string; content: string }>;
  providerInitializationFailures: Array<{
    occurredAt: string;
    errorCode: string;
  }>;
  calls: Board7aChatE2eV1CallRecord[];
};

export type Board7aChatE2eV1SessionCheckpoint = {
  evaluationId: typeof BOARD7A_CHAT_E2E_V1_EVALUATION_ID;
  candidateVersion: typeof BOARD7A_CHAT_E2E_V1_CANDIDATE_VERSION;
  candidateFingerprint: string;
  runFingerprint: string;
  runId: string;
  status: Board7aChatE2eV1SessionStatus;
  createdAt: string;
  updatedAt: string;
  approval: Board7aChatE2eV1StartApproval;
  messages: Board7aChatE2eV1Message[];
  turns: Board7aChatE2eV1TurnRecord[];
  pendingUserTurn: null | {
    turnId: string;
    userMessageId: string;
    content: string;
    submittedAt: string;
  };
  technicalError: string | null;
  result: null | (Board7aChatE2eV1EndDecision & { completedAt: string });
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

function nextMessageId(
  messages: Board7aChatE2eV1Message[],
  role: "user" | "assistant"
) {
  if (role === "assistant" && messages.length === 0) return "A0";
  const prefix = role === "user" ? "U" : "A";
  const count = messages.filter((message) => message.role === role).length;
  return `${prefix}${role === "user" ? count + 1 : count}`;
}

export function createBoard7aChatE2eV1Checkpoint(input: {
  trajectoryId?: string;
  approvedAt?: string;
}) {
  const candidateFingerprint = createBoard7aChatE2eV1CandidateFingerprint();
  const approval: Board7aChatE2eV1StartApproval = {
    approvalType: BOARD7A_CHAT_E2E_V1_EVALUATION_ID,
    approvalVersion: BOARD7A_CHAT_E2E_V1_APPROVAL_VERSION,
    decision: "approved",
    approvedBy: "product_owner_ui",
    approvedAt: input.approvedAt ?? new Date().toISOString(),
    candidateFingerprint,
    trajectoryId: input.trajectoryId ?? randomUUID(),
    approvalScope: BOARD7A_CHAT_E2E_V1_APPROVAL_SCOPE
  };
  const runFingerprint = createBoard7aChatE2eV1RunFingerprint(approval);
  const now = approval.approvedAt;
  const checkpoint: Board7aChatE2eV1SessionCheckpoint = {
    evaluationId: BOARD7A_CHAT_E2E_V1_EVALUATION_ID,
    candidateVersion: BOARD7A_CHAT_E2E_V1_CANDIDATE_VERSION,
    candidateFingerprint,
    runFingerprint,
    runId: `run-${runFingerprint}`,
    status: "running",
    createdAt: now,
    updatedAt: now,
    approval,
    messages: [
      {
        id: "A0",
        role: "assistant",
        content: BOARD7A_CHAT_E2E_V1_FIXED_OPENING
      }
    ],
    turns: [],
    pendingUserTurn: null,
    technicalError: null,
    result: null
  };
  return checkpoint;
}

export function submitBoard7aChatE2eV1UserTurn(
  checkpoint: Board7aChatE2eV1SessionCheckpoint,
  content: string
) {
  if (checkpoint.status !== "running" || checkpoint.pendingUserTurn) {
    throw new Error("BOARD7A_CHAT_E2E_V1_SESSION_NOT_READY_FOR_TURN");
  }
  const parsed = turnInputSchema.parse({ content });
  const userMessage: Board7aChatE2eV1Message = {
    id: nextMessageId(checkpoint.messages, "user"),
    role: "user",
    content: parsed.content
  };
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

export function completeBoard7aChatE2eV1Session(
  checkpoint: Board7aChatE2eV1SessionCheckpoint,
  value: unknown
) {
  if (checkpoint.status === "completed") {
    throw new Error("BOARD7A_CHAT_E2E_V1_SESSION_ALREADY_COMPLETED");
  }
  const decision = board7aChatE2eV1EndSchema.parse(value);
  checkpoint.result = {
    ...decision,
    completedAt: new Date().toISOString()
  };
  checkpoint.status = "completed";
  checkpoint.updatedAt = new Date().toISOString();
  return checkpoint.result;
}

function createAwaitingStartPublicState() {
  return {
    evaluationId: BOARD7A_CHAT_E2E_V1_EVALUATION_ID,
    candidateVersion: BOARD7A_CHAT_E2E_V1_CANDIDATE_VERSION,
    candidateFingerprint: createBoard7aChatE2eV1CandidateFingerprint(),
    runFingerprint: null,
    runId: null,
    status: "awaiting_start" as const,
    inFlight: false,
    fixedOpening: BOARD7A_CHAT_E2E_V1_FIXED_OPENING,
    runtime: {
      service: "DeepSeek 官方 API",
      adapter: "OpenAI-compatible",
      baseUrlHost: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.baseUrlHost,
      model: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.model,
      promptVersions: BOARD7A_CHAT_E2E_V1_PROMPT_VERSIONS,
      credentialReadiness: "authenticated_before_server_start"
    },
    messages: [] as Board7aChatE2eV1Message[],
    turns: [] as Board7aChatE2eV1TurnRecord[],
    technicalError: null,
    result: null,
    modelCallCount: 0
  };
}

export function createBoard7aChatE2eV1PublicState(
  checkpoint: Board7aChatE2eV1SessionCheckpoint | null,
  inFlight: boolean
) {
  if (!checkpoint) return createAwaitingStartPublicState();
  return {
    evaluationId: checkpoint.evaluationId,
    candidateVersion: checkpoint.candidateVersion,
    candidateFingerprint: checkpoint.candidateFingerprint,
    runFingerprint: checkpoint.runFingerprint,
    runId: checkpoint.runId,
    status: checkpoint.status,
    inFlight,
    fixedOpening: BOARD7A_CHAT_E2E_V1_FIXED_OPENING,
    runtime: {
      service: "DeepSeek 官方 API",
      adapter: "OpenAI-compatible",
      baseUrlHost: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.baseUrlHost,
      model: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.model,
      promptVersions: BOARD7A_CHAT_E2E_V1_PROMPT_VERSIONS,
      credentialReadiness: "authenticated_before_server_start"
    },
    messages: checkpoint.messages,
    turns: checkpoint.turns.map((turn) => ({
      turnId: turn.turnId,
      status: turn.status,
      semantic: turn.semantic,
      visibleText: turn.visibleText,
      validationIssues: turn.validationIssues,
      evidenceExcerpts: turn.evidenceExcerpts,
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

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

function sendError(response: ServerResponse, status: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  sendJson(response, status, { error: message });
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
  if (!origin) return true;
  return (
    origin === `http://${HOST}:${port}` ||
    origin === `http://localhost:${port}`
  );
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
    const keychainKey = stdout.trim();
    if (keychainKey) {
      return { apiKey: keychainKey, source: "macos_keychain" as const };
    }
  } catch {
    // 统一交给当前 Provider 配置错误口径；错误信息不携带凭据内容。
  }
  throw Object.assign(
    new Error("EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"),
    { code: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING" }
  );
}

async function validateCandidateCredential(apiKey: string) {
  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw Object.assign(
      new Error("DEEPSEEK_CREDENTIAL_PREFLIGHT_UNREACHABLE"),
      { code: "DEEPSEEK_CREDENTIAL_PREFLIGHT_UNREACHABLE" }
    );
  }
  if (!response.ok) {
    throw Object.assign(
      new Error(`DEEPSEEK_CREDENTIAL_PREFLIGHT_HTTP_${response.status}`),
      { code: `DEEPSEEK_CREDENTIAL_PREFLIGHT_HTTP_${response.status}` }
    );
  }
  const body = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };
  if (
    !body.data?.some(
      (model) => model.id === BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.model
    )
  ) {
    throw Object.assign(
      new Error("DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE"),
      { code: "DEEPSEEK_CANDIDATE_MODEL_UNAVAILABLE" }
    );
  }
}

async function createCandidateProvider(apiKey: string) {
  const env = {
    NODE_ENV: "development" as const,
    AI_PROVIDER: "openai",
    DEEPSEEK_API_KEY: apiKey,
    DEEPSEEK_MODEL: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.model,
    DEEPSEEK_BASE_URL: "https://api.deepseek.com",
    EVENT_CENTERED_GENERATIVE_MODEL:
      BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.model
  };
  const provider = await getEventCenteredAIProvider({ env });
  if (!provider) throw new Error("BOARD7A_CHAT_E2E_V1_PROVIDER_UNAVAILABLE");
  return provider;
}

export async function executeBoard7aChatE2eV1PendingTurn(input: {
  checkpoint: Board7aChatE2eV1SessionCheckpoint;
  provider: AIProvider;
  persist?: () => Promise<void>;
}) {
  const persist = input.persist ?? (async () => {});
  const { checkpoint } = input;
  if (!checkpoint.pendingUserTurn) {
    throw new Error("BOARD7A_CHAT_E2E_V1_PENDING_TURN_MISSING");
  }
  const turn = checkpoint.turns.find(
    (item) => item.turnId === checkpoint.pendingUserTurn?.turnId
  );
  if (!turn) throw new Error("BOARD7A_CHAT_E2E_V1_TURN_RECORD_MISSING");

  checkpoint.status = "running";
  checkpoint.technicalError = null;
  turn.status = "pending";
  await persist();

  const callId = randomUUID();
  const attempt = turn.calls.length + 1;
  const startedAt = new Date().toISOString();
  const userPrompt = createBoard7aChatE2eV1UserPrompt({
    messages: checkpoint.messages,
    latestUserMessageId: checkpoint.pendingUserTurn.userMessageId
  });
  const requestHash = sha256(
    JSON.stringify({
      systemPrompt: BOARD7A_CHAT_E2E_V1_SYSTEM_PROMPT,
      userPrompt,
      runtimeConfig: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG
    })
  );
  let completion: AICompletionResult | null = null;

  try {
    completion = await input.provider.complete({
      messages: [
        { role: "system", content: BOARD7A_CHAT_E2E_V1_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.temperature,
      maxTokens: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.maxTokens,
      timeoutMs: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.timeoutMs,
      responseFormat: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.responseFormat,
      thinking: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.thinking
    });
    const output = parseBoard7aChatE2eV1Output(completion.content);
    const validationIssues = validateBoard7aChatE2eV1Output({
      messages: checkpoint.messages,
      output
    });
    const byId = new Map(
      checkpoint.messages
        .filter((message) => message.role === "user")
        .map((message) => [message.id, message.content])
    );
    const visibleText = renderBoard7aChatE2eV1Visible(output.visible);
    turn.semantic = output.semantic;
    turn.visible = output.visible;
    turn.visibleText = visibleText;
    turn.validationIssues = validationIssues;
    turn.evidenceExcerpts = output.semantic.evidenceRefs.flatMap((ref) => {
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
      model: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.model,
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
      checkpoint.messages.push({
        id: nextMessageId(checkpoint.messages, "assistant"),
        role: "assistant",
        content: visibleText
      });
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
      model: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG.model,
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

export async function recordBoard7aChatE2eV1ProviderFailure(input: {
  checkpoint: Board7aChatE2eV1SessionCheckpoint;
  error: unknown;
  persist?: () => Promise<void>;
}) {
  const persist = input.persist ?? (async () => {});
  const { checkpoint } = input;
  const pending = checkpoint.pendingUserTurn;
  if (!pending) {
    throw new Error("BOARD7A_CHAT_E2E_V1_PENDING_TURN_MISSING");
  }
  const turn = checkpoint.turns.find((item) => item.turnId === pending.turnId);
  if (!turn) throw new Error("BOARD7A_CHAT_E2E_V1_TURN_RECORD_MISSING");

  const errorCode = technicalErrorCode(input.error);
  turn.status = "technical_failure";
  turn.providerInitializationFailures.push({
    occurredAt: new Date().toISOString(),
    errorCode
  });
  checkpoint.status = "technical_failure";
  checkpoint.technicalError = errorCode;
  checkpoint.updatedAt = new Date().toISOString();
  await persist();
}

async function main() {
  if (process.argv.includes("--inspect")) {
    process.stdout.write(
      `${JSON.stringify(
        {
          evaluationId: BOARD7A_CHAT_E2E_V1_EVALUATION_ID,
          candidateVersion: BOARD7A_CHAT_E2E_V1_CANDIDATE_VERSION,
          candidateFingerprint: createBoard7aChatE2eV1CandidateFingerprint(),
          runtimeConfig: BOARD7A_CHAT_E2E_V1_RUNTIME_CONFIG,
          promptVersions: BOARD7A_CHAT_E2E_V1_PROMPT_VERSIONS,
          fixedOpening: BOARD7A_CHAT_E2E_V1_FIXED_OPENING,
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
    throw new Error("BOARD7A_CHAT_E2E_V1_PORT_INVALID");
  }

  const htmlPath = resolve(
    process.cwd(),
    "evals/event-centered-generative/board7a-chat-e2e-single-v1/workbench.html"
  );
  const html = await readFile(htmlPath, "utf8");
  const credential = await resolveCandidateCredential();
  await validateCandidateCredential(credential.apiKey);
  const serverToken = randomBytes(24).toString("hex");
  let checkpoint: Board7aChatE2eV1SessionCheckpoint | null = null;
  let checkpointPath: string | null = null;
  let provider: AIProvider | null = null;
  let inFlight = false;

  async function persist() {
    if (!checkpoint || !checkpointPath) {
      throw new Error("BOARD7A_CHAT_E2E_V1_CHECKPOINT_NOT_STARTED");
    }
    checkpoint.updatedAt = new Date().toISOString();
    await writeJsonAtomic(checkpointPath, checkpoint);
  }

  async function ensureProvider() {
    provider ??= await createCandidateProvider(credential.apiKey);
    return provider;
  }

  async function generatePendingTurn() {
    if (!checkpoint) throw new Error("BOARD7A_CHAT_E2E_V1_SESSION_NOT_STARTED");
    if (inFlight) throw new Error("BOARD7A_CHAT_E2E_V1_TURN_ALREADY_IN_FLIGHT");
    inFlight = true;
    try {
      let activeProvider: AIProvider;
      try {
        activeProvider = await ensureProvider();
      } catch (error) {
        await recordBoard7aChatE2eV1ProviderFailure({
          checkpoint,
          error,
          persist
        });
        return;
      }
      await executeBoard7aChatE2eV1PendingTurn({
        checkpoint,
        provider: activeProvider,
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
      const presentedToken = request.headers["x-eval-token"];
      const headerToken = Array.isArray(presentedToken)
        ? presentedToken[0]
        : presentedToken;
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
          createBoard7aChatE2eV1PublicState(checkpoint, inFlight)
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/start") {
        startInputSchema.parse(await readBody(request));
        if (checkpoint) {
          throw new Error("BOARD7A_CHAT_E2E_V1_TRAJECTORY_ALREADY_STARTED");
        }
        checkpoint = createBoard7aChatE2eV1Checkpoint({});
        checkpointPath = resolve(
          process.cwd(),
          BOARD7A_CHAT_E2E_V1_LOCAL_RUNTIME_DIRECTORY,
          checkpoint.runId,
          "checkpoint.json"
        );
        await persist();
        sendJson(
          response,
          200,
          createBoard7aChatE2eV1PublicState(checkpoint, inFlight)
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/turn") {
        if (!checkpoint) {
          throw new Error("BOARD7A_CHAT_E2E_V1_SESSION_NOT_STARTED");
        }
        if (checkpoint.status !== "running" || checkpoint.pendingUserTurn) {
          throw new Error("BOARD7A_CHAT_E2E_V1_SESSION_NOT_READY_FOR_TURN");
        }
        if (inFlight) {
          throw new Error("BOARD7A_CHAT_E2E_V1_TURN_ALREADY_IN_FLIGHT");
        }
        const input = turnInputSchema.parse(await readBody(request));
        submitBoard7aChatE2eV1UserTurn(checkpoint, input.content);
        await persist();
        await generatePendingTurn();
        sendJson(
          response,
          200,
          createBoard7aChatE2eV1PublicState(checkpoint, inFlight)
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
          throw new Error("BOARD7A_CHAT_E2E_V1_TECHNICAL_RETRY_NOT_AVAILABLE");
        }
        await generatePendingTurn();
        sendJson(
          response,
          200,
          createBoard7aChatE2eV1PublicState(checkpoint, inFlight)
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/end") {
        if (!checkpoint || inFlight) {
          throw new Error("BOARD7A_CHAT_E2E_V1_SESSION_NOT_READY_TO_END");
        }
        completeBoard7aChatE2eV1Session(checkpoint, await readBody(request));
        await persist();
        sendJson(
          response,
          200,
          createBoard7aChatE2eV1PublicState(checkpoint, inFlight)
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
      "GI-083 v1 真实用户直连工作台已启动。",
      `候选指纹：${createBoard7aChatE2eV1CandidateFingerprint()}`,
      `凭据状态：已在启动前通过 DeepSeek 官方认证与模型可用性检查（${credential.source}）。`,
      `打开：http://${HOST}:${portValue}/?token=${serverToken}`,
      "当前模型调用：0。点击页面内【开始真实体验】只创建本机轨迹；发送第一段回答时才会调用 DeepSeek。"
    ].join("\n") + "\n"
  );
}

const shouldRun = process.argv.includes("--inspect") || process.argv.includes("--serve");

if (shouldRun) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
