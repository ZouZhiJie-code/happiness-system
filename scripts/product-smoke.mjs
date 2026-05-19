#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  BASE_URL,
  createAcceptanceClient
} from "./launch-acceptance-runner.mjs";

const INVALID_ENTRY_DATE = "2026-02-30";

function buildStep(name, details) {
  return { name, ...details };
}

function inferStatus(error) {
  const match = /(\d{3})/.exec(String(error?.message ?? ""));
  return match ? Number(match[1]) : null;
}

function inferErrorCode(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function runProductSmoke(
  {
    baseUrl = BASE_URL,
    dimension = "joy",
    entryDate,
    prefix = "product"
  } = {},
  {
    registerAccount,
    loginAccount,
    getSession,
    startSession
  } = {}
) {
  const defaultClient = createAcceptanceClient({ baseUrl });
  const activeRegisterAccount = registerAccount ?? defaultClient.registerAccount;
  const activeLoginAccount = loginAccount ?? defaultClient.loginAccount;
  const activeGetSession = getSession ?? defaultClient.getSession;
  const activeStartSession = startSession ?? defaultClient.startSession;

  const summary = {
    ok: false,
    baseUrl,
    dimension,
    entryDate,
    account: null,
    steps: []
  };

  let registration;
  try {
    registration = await activeRegisterAccount(prefix);
    summary.account = { username: registration.username };
    summary.steps.push(
      buildStep("register", {
        ok: registration.register.status === 200 && Boolean(registration.cookie),
        status: registration.register.status,
        authenticated: Boolean(registration.register.json?.authenticated),
        cookieEstablished: Boolean(registration.cookie)
      })
    );
  } catch (error) {
    summary.steps.push(
      buildStep("register", {
        ok: false,
        status: inferStatus(error),
        error: inferErrorCode(error)
      })
    );
    return summary;
  }

  let loginCookie;
  try {
    const login = await activeLoginAccount({
      username: registration.username,
      password: registration.password
    });
    loginCookie = login.cookie;
    summary.steps.push(
      buildStep("login", {
        ok: login.login.status === 200 && Boolean(login.cookie),
        status: login.login.status,
        authenticated: Boolean(login.login.json?.authenticated),
        cookieEstablished: Boolean(login.cookie)
      })
    );
  } catch (error) {
    summary.steps.push(
      buildStep("login", {
        ok: false,
        status: inferStatus(error),
        error: inferErrorCode(error)
      })
    );
    return summary;
  }

  try {
    const session = await activeGetSession({ cookie: loginCookie });

    if (!session.json?.authenticated || !session.json?.user) {
      summary.steps.push(
        buildStep("session", {
          ok: false,
          status: session.status,
          authenticated: false,
          error: "SESSION_NOT_AUTHENTICATED"
        })
      );
      return summary;
    }

    summary.steps.push(
      buildStep("session", {
        ok: true,
        status: session.status,
        authenticated: true,
        user: {
          id: session.json.user.id,
          username: session.json.user.username
        }
      })
    );
  } catch (error) {
    summary.steps.push(
      buildStep("session", {
        ok: false,
        status: inferStatus(error),
        error: inferErrorCode(error)
      })
    );
    return summary;
  }

  try {
    const start = await activeStartSession({ cookie: loginCookie, dimension, entryDate });

    if (start.status !== 200 || !start.json?.sessionId) {
      summary.steps.push(
        buildStep("start", {
          ok: false,
          status: start.status,
          error: start.json?.error ?? "SESSION_START_FAILED"
        })
      );
      return summary;
    }

    summary.steps.push(
      buildStep("start", {
        ok: true,
        status: start.status,
        sessionId: start.json.sessionId,
        stage: start.json.session?.stage ?? null,
        draftGenerationUnlocked: Boolean(start.json.session?.draftGenerationUnlocked)
      })
    );
  } catch (error) {
    summary.steps.push(
      buildStep("start", {
        ok: false,
        status: inferStatus(error),
        error: inferErrorCode(error)
      })
    );
    return summary;
  }

  try {
    const invalidStart = await activeStartSession({
      cookie: loginCookie,
      dimension,
      entryDate: INVALID_ENTRY_DATE
    });

    summary.steps.push(
      buildStep("invalid_entry_date", {
        ok: invalidStart.status === 400 && invalidStart.json?.error === "INVALID_START_REQUEST",
        status: invalidStart.status,
        error: invalidStart.json?.error ?? null
      })
    );
  } catch (error) {
    summary.steps.push(
      buildStep("invalid_entry_date", {
        ok: false,
        status: inferStatus(error),
        error: inferErrorCode(error)
      })
    );
    return summary;
  }

  summary.ok = summary.steps.every((step) => step.ok);

  return summary;
}

export async function main(argv = process.argv.slice(2)) {
  const [dimension = "joy", entryDate = new Date().toISOString().slice(0, 10), prefix = "product"] = argv;
  const summary = await runProductSmoke({ baseUrl: BASE_URL, dimension, entryDate, prefix });

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (!summary.ok) {
    process.exitCode = 1;
  }

  return summary;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    const summary = {
      ok: false,
      baseUrl: BASE_URL,
      dimension: process.argv[2] ?? "joy",
      entryDate: process.argv[3] ?? null,
      account: null,
      steps: [],
      error: inferErrorCode(error)
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exit(1);
  });
}
