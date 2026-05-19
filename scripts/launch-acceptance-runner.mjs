#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

const BASE_URL = process.env.ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:3001";
const DEFAULT_TRANSPORT = "fetch";
const VERCEL_CURL_MAX_BUFFER = 10 * 1024 * 1024;

function randomSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function normalizeUsername(prefix) {
  const compact = String(prefix).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 10);
  const suffix = randomSuffix().slice(-10);
  return `${compact}_${suffix}`.slice(0, 24);
}

export function createHttp({ baseUrl = BASE_URL } = {}) {
  return async function http(path, { method = "GET", body, cookie, headers: extraHeaders = {} } = {}) {
    const headers = { ...extraHeaders };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual"
    });

    const setCookie = response.headers.get("set-cookie");
    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      setCookie,
      text,
      json
    };
  };
}

function normalizeTransportName(transport) {
  return transport === "vercel-curl" ? "vercel-curl" : DEFAULT_TRANSPORT;
}

function resolveTransportConfig() {
  return {
    transport: normalizeTransportName(process.env.ACCEPTANCE_TRANSPORT),
    vercelScope: process.env.ACCEPTANCE_VERCEL_SCOPE ?? null,
    vercelCwd: resolveVercelCommandCwd()
  };
}

function hasVercelProjectLink(targetCwd, fileExists = existsSync) {
  return fileExists(resolvePath(targetCwd, ".vercel/project.json"));
}

function resolveVercelCommandCwd({
  currentCwd = process.cwd(),
  env = process.env,
  fileExists = existsSync
} = {}) {
  if (env.ACCEPTANCE_VERCEL_CWD) {
    return env.ACCEPTANCE_VERCEL_CWD;
  }

  const worktreeMarker = `${resolvePath("/")}.worktrees${resolvePath("/")}`;
  const markerIndex = currentCwd.indexOf(worktreeMarker);

  if (markerIndex >= 0) {
    const parentRepoRoot = currentCwd.slice(0, markerIndex);
    if (parentRepoRoot && hasVercelProjectLink(parentRepoRoot, fileExists)) {
      return parentRepoRoot;
    }
  }

  return currentCwd;
}

function buildVercelCurlArgs(
  baseUrl,
  path,
  { method = "GET", body, cookie, headers: extraHeaders = {}, vercelScope }
) {
  const requestUrl = new URL(path, baseUrl);
  const requestPath = `${requestUrl.pathname}${requestUrl.search}`;
  const args = ["curl", requestPath, "--deployment", baseUrl, "--yes"];

  if (vercelScope) {
    args.push("--scope", vercelScope);
  }

  args.push("--", "-i");

  if (method !== "GET") {
    args.push("--request", method);
  }

  if (cookie) {
    args.push("--header", `cookie: ${cookie}`);
  }

  for (const [headerName, headerValue] of Object.entries(extraHeaders)) {
    args.push("--header", `${headerName}: ${headerValue}`);
  }

  if (body !== undefined) {
    args.push("--header", "content-type: application/json");
    args.push("--data", JSON.stringify(body));
  }

  return args;
}

function parseVercelCurlResponse(output) {
  const normalizedOutput = String(output).replace(/\r\n/g, "\n");
  const statusLinePattern = /^HTTP\/\d(?:\.\d)?\s+\d{3}.*$/gm;
  let statusMatchEntry = null;

  for (const match of normalizedOutput.matchAll(statusLinePattern)) {
    statusMatchEntry = match;
  }

  const blockStart = statusMatchEntry?.index ?? 0;
  const separator = "\n\n";
  const headerEnd = normalizedOutput.indexOf(separator, blockStart);
  const headerText =
    headerEnd >= 0
      ? normalizedOutput.slice(blockStart, headerEnd)
      : normalizedOutput.slice(blockStart);
  const text =
    headerEnd >= 0 ? normalizedOutput.slice(headerEnd + separator.length) : "";
  const headerLines = headerText ? headerText.split("\n") : [];
  const statusLine = headerLines.shift() ?? "";
  const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(statusLine);
  const headers = {};

  for (const line of headerLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) continue;
    const headerName = line.slice(0, separatorIndex).trim().toLowerCase();
    const headerValue = line.slice(separatorIndex + 1).trim();
    headers[headerName] = headerValue;
  }

  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: statusMatch ? Number(statusMatch[1]) : 200,
    headers,
    setCookie: headers["set-cookie"] ?? null,
    text,
    json
  };
}

function createVercelCurlHttp({
  baseUrl = BASE_URL,
  vercelScope = null,
  vercelCwd = process.cwd(),
  execFile = execFileSync
} = {}) {
  return async function http(path, { method = "GET", body, cookie, headers } = {}) {
    const output = execFile(
      "vercel",
      buildVercelCurlArgs(baseUrl, path, {
        method,
        body,
        cookie,
        headers,
        vercelScope
      }),
      {
        cwd: vercelCwd,
        encoding: "utf8",
        input: undefined,
        maxBuffer: VERCEL_CURL_MAX_BUFFER
      }
    );

    return parseVercelCurlResponse(output);
  };
}

export function extractCookie(setCookie) {
  if (!setCookie) return null;
  return setCookie.split(";")[0];
}

export function createAcceptanceClient({ baseUrl = BASE_URL } = {}) {
  const { transport, vercelScope, vercelCwd } = resolveTransportConfig();
  const http =
    transport === "vercel-curl"
      ? createVercelCurlHttp({ baseUrl, vercelScope, vercelCwd })
      : createHttp({ baseUrl });

  async function registerAccount(prefix = "acc") {
    const username = normalizeUsername(prefix);
    const password = "accept123";
    const register = await http("/api/auth/register", {
      method: "POST",
      body: {
        username,
        password,
        acceptedTerms: true,
        acceptedPrivacy: true
      }
    });

    if (register.status !== 200) {
      throw new Error(`register failed: ${register.status} ${register.text}`);
    }

    const cookie = extractCookie(register.setCookie);

    if (!cookie) {
      throw new Error("register succeeded without dl_session cookie");
    }

    return { username, password, cookie, register };
  }

  async function loginAccount({ username, password }) {
    const login = await http("/api/auth/login", {
      method: "POST",
      body: {
        username,
        password
      }
    });

    if (login.status !== 200) {
      throw new Error(`login failed: ${login.status} ${login.text}`);
    }

    const cookie = extractCookie(login.setCookie);

    if (!cookie) {
      throw new Error("login succeeded without dl_session cookie");
    }

    return { username, cookie, login };
  }

  async function getSession({ cookie }) {
    return http("/api/auth/session", { cookie });
  }

  async function registerAndLogin(prefix = "acc") {
    return registerAccount(prefix);
  }

  async function startSession({ cookie, dimension, entryDate }) {
    return http("/api/interview/session/start", {
      method: "POST",
      cookie,
      body: { dimension, entryDate }
    });
  }

  async function reply({ cookie, sessionId, userMessage }) {
    return http("/api/interview/session/respond", {
      method: "POST",
      cookie,
      body: {
        action: "reply",
        sessionId,
        userMessage,
        inputMode: "text"
      }
    });
  }

  async function doAction({ cookie, sessionId, action }) {
    return http("/api/interview/session/respond", {
      method: "POST",
      cookie,
      body: {
        action,
        sessionId
      }
    });
  }

  async function generateDraft({ cookie, sessionId }) {
    return http("/api/interview/session/draft/generate", {
      method: "POST",
      cookie,
      body: { sessionIds: [sessionId] }
    });
  }

  async function saveDraft({ cookie, sessionId }) {
    return http("/api/interview/session/draft/save", {
      method: "POST",
      cookie,
      body: { sessionId }
    });
  }

  return {
    http,
    registerAccount,
    loginAccount,
    getSession,
    registerAndLogin,
    startSession,
    reply,
    doAction,
    generateDraft,
    saveDraft
  };
}

const defaultClient = createAcceptanceClient();

export const {
  http,
  registerAccount,
  loginAccount,
  getSession,
  registerAndLogin,
  startSession,
  reply,
  doAction,
  generateDraft,
  saveDraft
} = defaultClient;

export function summarizeSessionPayload(payload) {
  if (!payload?.session) return null;
  const session = payload.session;
  return {
    dimension: session.dimension,
    stage: session.stage,
    draftGenerationUnlocked: session.draftGenerationUnlocked,
    pendingDecision: session.pendingDecision
      ? {
          kind: session.pendingDecision.kind,
          completionMode: session.pendingDecision.completionMode ?? null,
          actions: session.pendingDecision.actions ?? null,
          reason: session.pendingDecision.reason ?? null
        }
      : null,
    snapshotData: session.snapshotData,
    journalEntry: session.journalEntry
      ? {
          id: session.journalEntry.id,
          title: session.journalEntry.title,
          status: session.journalEntry.status
        }
      : null
  };
}

async function main() {
  const command = process.argv[2];

  if (command === "register") {
    const result = await registerAndLogin(process.argv[3] ?? "acc");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "scenario") {
    const scenario = process.argv[3];
    const dimension = process.argv[4];
    const entryDate = process.argv[5];
    const steps = process.argv.slice(6);
    const account = await registerAndLogin(`${scenario}_${dimension}`);
    const start = await startSession({ cookie: account.cookie, dimension, entryDate });

    if (start.status !== 200) {
      throw new Error(`start failed: ${start.status} ${start.text}`);
    }

    const sessionId = start.json.sessionId;
    const outputs = [{ step: "start", status: start.status, session: summarizeSessionPayload(start.json) }];

    for (const step of steps) {
      if (step === "::generate") {
        const result = await generateDraft({ cookie: account.cookie, sessionId });
        outputs.push({
          step,
          status: result.status,
          body: result.json,
          session: summarizeSessionPayload(result.json)
        });
        continue;
      }

      if (step === "::save") {
        const result = await saveDraft({ cookie: account.cookie, sessionId });
        outputs.push({
          step,
          status: result.status,
          body: result.json,
          session: summarizeSessionPayload(result.json)
        });
        continue;
      }

      if (step === "::continue_current_event" || step === "::next_event" || step === "::continue") {
        const action = step.slice(2);
        const result = await doAction({ cookie: account.cookie, sessionId, action });
        outputs.push({
          step,
          status: result.status,
          body: result.json,
          session: summarizeSessionPayload(result.json)
        });
        continue;
      }

      const result = await reply({ cookie: account.cookie, sessionId, userMessage: step });
      outputs.push({
        step,
        status: result.status,
        body: result.json,
        session: summarizeSessionPayload(result.json)
      });
    }

    console.log(
      JSON.stringify(
        {
          baseUrl: BASE_URL,
          account: {
            username: account.username
          },
          sessionId,
          outputs
        },
        null,
        2
      )
    );
    return;
  }

  console.error("Usage:");
  console.error("  node scripts/launch-acceptance-runner.mjs register [prefix]");
  console.error("  node scripts/launch-acceptance-runner.mjs scenario <scenario> <dimension> <entryDate> <step...>");
  process.exit(1);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { BASE_URL };
