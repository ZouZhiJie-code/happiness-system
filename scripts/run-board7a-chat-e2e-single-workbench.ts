import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";
import { z } from "zod";

import {
  BOARD7A_CHAT_E2E_CANDIDATE_VERSION,
  BOARD7A_CHAT_E2E_EVALUATION_ID,
  BOARD7A_CHAT_E2E_LOCAL_RUNTIME_DIRECTORY,
  BOARD7A_CHAT_E2E_PROMPT_VERSIONS,
  BOARD7A_CHAT_E2E_RUNTIME_CONFIG,
  BOARD7A_CHAT_E2E_SYSTEM_PROMPT,
  board7aChatE2eEndSchema,
  createBoard7aChatE2eCandidateFingerprint,
  createBoard7aChatE2eRunFingerprint,
  createBoard7aChatE2eUserPrompt,
  parseBoard7aChatE2eOutput,
  renderBoard7aChatE2eVisible,
  validateBoard7aChatE2eApproval,
  validateBoard7aChatE2eFactCard,
  validateBoard7aChatE2eOutput,
  type Board7aChatE2eApproval,
  type Board7aChatE2eEndDecision,
  type Board7aChatE2eFactCard,
  type Board7aChatE2eMessage,
  type Board7aChatE2eSemantic,
  type Board7aChatE2eVisible
} from "../evals/event-centered-generative/board7a-chat-e2e-single/board7a-chat-e2e-single-v0";
import type { AICompletionResult, AIProvider } from "../src/server/services/ai/ai-provider";
import { getAIProviderFailureCode } from "../src/server/services/ai/ai-provider";
import { getEventCenteredAIProvider } from "../src/server/services/ai/event-centered-provider";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 4317;
const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/iu;
const MAX_BODY_BYTES = 24_000;

export type Board7aChatE2eSessionStatus =
  | "running"
  | "technical_failure"
  | "protected_failure"
  | "completed";

export type Board7aChatE2eCallRecord = {
  callId: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  status: "valid" | "technical_failure" | "protected_failure";
  provider: string | null;
  model: typeof BOARD7A_CHAT_E2E_RUNTIME_CONFIG.model;
  requestHash: string;
  responseHash: string | null;
  rawOutput: string | null;
  latencyMs: number | null;
  tokenUsage: AICompletionResult["tokenUsage"] | null;
  errorCode: string | null;
};

export type Board7aChatE2eTurnRecord = {
  turnId: string;
  userMessageId: string;
  status: "pending" | "valid" | "technical_failure" | "protected_failure";
  semantic: Board7aChatE2eSemantic | null;
  visible: Board7aChatE2eVisible | null;
  visibleText: string | null;
  validationIssues: string[];
  evidenceExcerpts: Array<{ id: string; content: string }>;
  calls: Board7aChatE2eCallRecord[];
};

export type Board7aChatE2eSessionCheckpoint = {
  evaluationId: typeof BOARD7A_CHAT_E2E_EVALUATION_ID;
  candidateVersion: typeof BOARD7A_CHAT_E2E_CANDIDATE_VERSION;
  candidateFingerprint: string;
  runFingerprint: string;
  runId: string;
  status: Board7aChatE2eSessionStatus;
  createdAt: string;
  updatedAt: string;
  factCard: Board7aChatE2eFactCard;
  approval: Board7aChatE2eApproval;
  messages: Board7aChatE2eMessage[];
  turns: Board7aChatE2eTurnRecord[];
  pendingUserTurn: null | {
    turnId: string;
    userMessageId: string;
    content: string;
    submittedAt: string;
  };
  technicalError: string | null;
  result: null | (Board7aChatE2eEndDecision & { completedAt: string });
};

export function createBoard7aChatE2eRunId(runFingerprint: string) {
  if (!/^[a-f0-9]{64}$/u.test(runFingerprint)) {
    throw new Error("BOARD7A_CHAT_E2E_RUN_FINGERPRINT_INVALID");
  }
  return `run-${runFingerprint}`;
}

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

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function writeJsonAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function fileExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function nextMessageId(messages: Board7aChatE2eMessage[], role: "user" | "assistant") {
  const prefix = role === "user" ? "U" : "A";
  const count = messages.filter((message) => message.role === role).length + 1;
  return `${prefix}${count}`;
}

export function submitBoard7aChatE2eUserTurn(
  checkpoint: Board7aChatE2eSessionCheckpoint,
  content: string
) {
  if (checkpoint.status !== "running" || checkpoint.pendingUserTurn) {
    throw new Error("BOARD7A_CHAT_E2E_SESSION_NOT_READY_FOR_TURN");
  }
  const parsed = turnInputSchema.parse({ content });
  const userMessage: Board7aChatE2eMessage = {
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

function checkpointIdentity(input: {
  factCard: Board7aChatE2eFactCard;
  approval: Board7aChatE2eApproval;
  runId: string;
}) {
  return {
    evaluationId: BOARD7A_CHAT_E2E_EVALUATION_ID,
    candidateVersion: BOARD7A_CHAT_E2E_CANDIDATE_VERSION,
    candidateFingerprint: createBoard7aChatE2eCandidateFingerprint(),
    runFingerprint: createBoard7aChatE2eRunFingerprint(input.factCard),
    runId: input.runId,
    factCard: input.factCard,
    approval: input.approval
  } as const;
}

function assertCheckpointIdentity(input: {
  checkpoint: Board7aChatE2eSessionCheckpoint;
  factCard: Board7aChatE2eFactCard;
  approval: Board7aChatE2eApproval;
  runId: string;
}) {
  const expected = checkpointIdentity(input);
  const actual = {
    evaluationId: input.checkpoint.evaluationId,
    candidateVersion: input.checkpoint.candidateVersion,
    candidateFingerprint: input.checkpoint.candidateFingerprint,
    runFingerprint: input.checkpoint.runFingerprint,
    runId: input.checkpoint.runId,
    factCard: input.checkpoint.factCard,
    approval: input.checkpoint.approval
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("BOARD7A_CHAT_E2E_CHECKPOINT_IDENTITY_MISMATCH");
  }
}

export function createBoard7aChatE2ePublicState(
  checkpoint: Board7aChatE2eSessionCheckpoint,
  inFlight: boolean
) {
  return {
    evaluationId: checkpoint.evaluationId,
    candidateVersion: checkpoint.candidateVersion,
    candidateFingerprint: checkpoint.candidateFingerprint,
    runFingerprint: checkpoint.runFingerprint,
    runId: checkpoint.runId,
    status: checkpoint.status,
    inFlight,
    factCard: checkpoint.factCard,
    messages: checkpoint.messages,
    turns: checkpoint.turns.map((turn) => ({
      turnId: turn.turnId,
      status: turn.status,
      semantic: turn.semantic,
      visibleText: turn.visibleText,
      validationIssues: turn.validationIssues,
      evidenceExcerpts: turn.evidenceExcerpts,
      callCount: turn.calls.length
    })),
    technicalError: checkpoint.technicalError,
    lastValidationIssues:
      [...checkpoint.turns].reverse().find((turn) => turn.validationIssues.length)
        ?.validationIssues ?? [],
    result: checkpoint.result
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
  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}

function requestIsLocal(request: IncomingMessage, port: number) {
  if (!LOCAL_HOST_PATTERN.test(request.headers.host ?? "")) return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  return origin === `http://${HOST}:${port}` || origin === `http://localhost:${port}`;
}

function technicalErrorCode(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") {
    return "INVALID_JSON_SCHEMA";
  }
  if (error instanceof SyntaxError) return "INVALID_JSON";
  return getAIProviderFailureCode(error);
}

async function createCandidateProvider() {
  loadEnvConfig(process.cwd());
  const env = {
    ...process.env,
    AI_PROVIDER: "openai",
    DEEPSEEK_MODEL: BOARD7A_CHAT_E2E_RUNTIME_CONFIG.model,
    DEEPSEEK_BASE_URL: "https://api.deepseek.com",
    EVENT_CENTERED_GENERATIVE_MODEL: BOARD7A_CHAT_E2E_RUNTIME_CONFIG.model
  };
  const provider = await getEventCenteredAIProvider({ env });
  if (!provider) throw new Error("BOARD7A_CHAT_E2E_PROVIDER_UNAVAILABLE");
  return provider;
}

export async function executeBoard7aChatE2ePendingTurn(input: {
  checkpoint: Board7aChatE2eSessionCheckpoint;
  provider: AIProvider;
  persist?: () => Promise<void>;
}) {
  const persist = input.persist ?? (async () => {});
  const { checkpoint } = input;
  if (!checkpoint.pendingUserTurn) {
    throw new Error("BOARD7A_CHAT_E2E_PENDING_TURN_MISSING");
  }
  const turn = checkpoint.turns.find(
    (item) => item.turnId === checkpoint.pendingUserTurn?.turnId
  );
  if (!turn) throw new Error("BOARD7A_CHAT_E2E_TURN_RECORD_MISSING");

  checkpoint.status = "running";
  checkpoint.technicalError = null;
  turn.status = "pending";
  await persist();

  const callId = randomUUID();
  const attempt = turn.calls.length + 1;
  const startedAt = new Date().toISOString();
  const userPrompt = createBoard7aChatE2eUserPrompt({
    messages: checkpoint.messages,
    latestUserMessageId: checkpoint.pendingUserTurn.userMessageId
  });
  const requestHash = sha256(JSON.stringify({
    systemPrompt: BOARD7A_CHAT_E2E_SYSTEM_PROMPT,
    userPrompt,
    runtimeConfig: BOARD7A_CHAT_E2E_RUNTIME_CONFIG
  }));
  let completion: AICompletionResult | null = null;

  try {
    completion = await input.provider.complete({
      messages: [
        { role: "system", content: BOARD7A_CHAT_E2E_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: BOARD7A_CHAT_E2E_RUNTIME_CONFIG.temperature,
      maxTokens: BOARD7A_CHAT_E2E_RUNTIME_CONFIG.maxTokens,
      timeoutMs: BOARD7A_CHAT_E2E_RUNTIME_CONFIG.timeoutMs,
      responseFormat: BOARD7A_CHAT_E2E_RUNTIME_CONFIG.responseFormat,
      thinking: BOARD7A_CHAT_E2E_RUNTIME_CONFIG.thinking
    });
    const output = parseBoard7aChatE2eOutput(completion.content);
    const validationIssues = validateBoard7aChatE2eOutput({
      messages: checkpoint.messages,
      output
    });
    const byId = new Map(
      checkpoint.messages
        .filter((message) => message.role === "user")
        .map((message) => [message.id, message.content])
    );
    turn.semantic = output.semantic;
    turn.visible = output.visible;
    turn.visibleText = renderBoard7aChatE2eVisible(output.visible);
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
      model: BOARD7A_CHAT_E2E_RUNTIME_CONFIG.model,
      requestHash,
      responseHash: sha256(completion.content),
      rawOutput: completion.content,
      latencyMs: completion.latencyMs,
      tokenUsage: completion.tokenUsage ?? null,
      errorCode: validationIssues.length ? "PROGRAM_PROTECTION_REJECTED" : null
    });

    if (validationIssues.length) {
      turn.status = "protected_failure";
      checkpoint.status = "protected_failure";
      checkpoint.pendingUserTurn = null;
    } else {
      const assistantMessage: Board7aChatE2eMessage = {
        id: nextMessageId(checkpoint.messages, "assistant"),
        role: "assistant",
        content: turn.visibleText
      };
      checkpoint.messages.push(assistantMessage);
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
      model: BOARD7A_CHAT_E2E_RUNTIME_CONFIG.model,
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

async function main() {
  if (process.argv.includes("--inspect")) {
    process.stdout.write(`${JSON.stringify({
      evaluationId: BOARD7A_CHAT_E2E_EVALUATION_ID,
      candidateVersion: BOARD7A_CHAT_E2E_CANDIDATE_VERSION,
      candidateFingerprint: createBoard7aChatE2eCandidateFingerprint(),
      runtimeConfig: BOARD7A_CHAT_E2E_RUNTIME_CONFIG,
      promptVersions: BOARD7A_CHAT_E2E_PROMPT_VERSIONS,
      binding: HOST,
      modelCalls: 0
    }, null, 2)}\n`);
    return;
  }

  const factCardArgument = argumentValue("--fact-card");
  const approvalArgument = argumentValue("--approval");
  if (!factCardArgument || !approvalArgument) {
    throw new Error("--fact-card 与 --approval 均为必填；准备阶段可使用 --inspect");
  }

  const factCardPath = resolve(process.cwd(), factCardArgument);
  const approvalPath = resolve(process.cwd(), approvalArgument);
  const factCard = validateBoard7aChatE2eFactCard(await readJson(factCardPath));
  const approval = validateBoard7aChatE2eApproval({
    value: await readJson(approvalPath),
    factCard
  });

  const portValue = Number(argumentValue("--port") ?? DEFAULT_PORT);
  if (!Number.isInteger(portValue) || portValue < 1024 || portValue > 65_535) {
    throw new Error("BOARD7A_CHAT_E2E_PORT_INVALID");
  }
  const runFingerprint = createBoard7aChatE2eRunFingerprint(factCard);
  const runId = createBoard7aChatE2eRunId(runFingerprint);

  const runDirectory = resolve(
    process.cwd(),
    BOARD7A_CHAT_E2E_LOCAL_RUNTIME_DIRECTORY,
    runId
  );
  const checkpointPath = resolve(runDirectory, "checkpoint.json");
  const identity = checkpointIdentity({ factCard, approval, runId });
  let checkpoint: Board7aChatE2eSessionCheckpoint;
  if (await fileExists(checkpointPath)) {
    checkpoint = await readJson(checkpointPath) as Board7aChatE2eSessionCheckpoint;
    assertCheckpointIdentity({ checkpoint, factCard, approval, runId });
  } else {
    const now = new Date().toISOString();
    checkpoint = {
      ...identity,
      status: "running",
      createdAt: now,
      updatedAt: now,
      messages: [],
      turns: [],
      pendingUserTurn: null,
      technicalError: null,
      result: null
    };
    await writeJsonAtomic(checkpointPath, checkpoint);
  }

  const htmlPath = resolve(
    process.cwd(),
    "evals/event-centered-generative/board7a-chat-e2e-single/workbench.html"
  );
  const html = await readFile(htmlPath, "utf8");
  const serverToken = randomBytes(24).toString("hex");
  let provider: AIProvider | null = null;
  let inFlight = false;

  async function persist() {
    checkpoint.updatedAt = new Date().toISOString();
    await writeJsonAtomic(checkpointPath, checkpoint);
  }

  async function ensureProvider() {
    provider ??= await createCandidateProvider();
    return provider;
  }

  async function generatePendingTurn() {
    if (inFlight) throw new Error("BOARD7A_CHAT_E2E_TURN_ALREADY_IN_FLIGHT");
    inFlight = true;
    try {
      await executeBoard7aChatE2ePendingTurn({
        checkpoint,
        provider: await ensureProvider(),
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
      const headerToken = Array.isArray(presentedToken) ? presentedToken[0] : presentedToken;
      const queryToken = url.searchParams.get("token") ?? undefined;
      if (!tokenMatches(headerToken ?? queryToken, serverToken)) {
        response.writeHead(404).end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
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
        sendJson(response, 200, createBoard7aChatE2ePublicState(checkpoint, inFlight));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/turn") {
        if (checkpoint.status !== "running" || checkpoint.pendingUserTurn) {
          throw new Error("BOARD7A_CHAT_E2E_SESSION_NOT_READY_FOR_TURN");
        }
        if (inFlight) throw new Error("BOARD7A_CHAT_E2E_TURN_ALREADY_IN_FLIGHT");
        const input = turnInputSchema.parse(await readBody(request));
        submitBoard7aChatE2eUserTurn(checkpoint, input.content);
        await persist();
        await generatePendingTurn();
        sendJson(response, 200, createBoard7aChatE2ePublicState(checkpoint, inFlight));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/retry") {
        await readBody(request);
        if (checkpoint.status !== "technical_failure" || !checkpoint.pendingUserTurn) {
          throw new Error("BOARD7A_CHAT_E2E_TECHNICAL_RETRY_NOT_AVAILABLE");
        }
        await generatePendingTurn();
        sendJson(response, 200, createBoard7aChatE2ePublicState(checkpoint, inFlight));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/end") {
        if (checkpoint.status === "completed" || inFlight) {
          throw new Error("BOARD7A_CHAT_E2E_SESSION_NOT_READY_TO_END");
        }
        const decision = board7aChatE2eEndSchema.parse(await readBody(request));
        checkpoint.result = {
          ...decision,
          completedAt: new Date().toISOString()
        };
        checkpoint.status = "completed";
        await persist();
        sendJson(response, 200, createBoard7aChatE2ePublicState(checkpoint, inFlight));
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

  process.stdout.write([
    "板块 7A 单轨迹透明诊断工作台已启动。",
    `候选指纹：${checkpoint.candidateFingerprint}`,
    `运行指纹：${checkpoint.runFingerprint}`,
    `原始轨迹：${checkpointPath}`,
    `打开：http://${HOST}:${portValue}/?token=${serverToken}`,
    "每次页面发送只触发一次生成；退出请在页面封存轨迹后按 Ctrl+C。"
  ].join("\n") + "\n");
}

const shouldRun = process.argv.includes("--inspect") || process.argv.includes("--serve");

if (shouldRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
