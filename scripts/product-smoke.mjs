#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  BASE_URL,
  createAcceptanceClient
} from "./launch-acceptance-runner.mjs";

const INVALID_ENTRY_DATE = "2026-02-30";
const DEFAULT_PRODUCT_SMOKE_USERNAME = "preview_acceptance";
const DEFAULT_PRODUCT_SMOKE_PASSWORD = "DailyLight2026";

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

function isMissingAcceptanceAccount(error) {
  const message = inferErrorCode(error);
  return message.includes("401") || message.includes("INVALID_CREDENTIALS");
}

export async function runProductSmoke(
  {
    baseUrl = BASE_URL,
    dimension = "joy",
    entryDate,
    username = process.env.PRODUCT_SMOKE_USERNAME ?? DEFAULT_PRODUCT_SMOKE_USERNAME,
    password = process.env.PRODUCT_SMOKE_PASSWORD ?? DEFAULT_PRODUCT_SMOKE_PASSWORD
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

  summary.account = { username };

  let login;
  let accountMode = "reused";
  try {
    login = await activeLoginAccount({ username, password });
  } catch (error) {
    if (!isMissingAcceptanceAccount(error)) {
      summary.steps.push(
        buildStep("account", {
          ok: false,
          mode: "unavailable",
          status: inferStatus(error),
          error: inferErrorCode(error)
        })
      );
      return summary;
    }

    try {
      await activeRegisterAccount(username, password);
      accountMode = "created";
      login = await activeLoginAccount({ username, password });
    } catch (registrationError) {
      summary.steps.push(
        buildStep("account", {
          ok: false,
          mode: "create_failed",
          status: inferStatus(registrationError),
          error: inferErrorCode(registrationError)
        })
      );
      return summary;
    }
  }

  const loginCookie = login.cookie;
  summary.steps.push(
    buildStep("account", {
      ok: true,
      mode: accountMode,
      username
    })
  );
  summary.steps.push(
    buildStep("login", {
      ok: login.login.status === 200 && Boolean(login.cookie),
      status: login.login.status,
      authenticated: Boolean(login.login.json?.authenticated),
      cookieEstablished: Boolean(login.cookie)
    })
  );

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
  const [dimension = "joy", entryDate = new Date().toISOString().slice(0, 10)] = argv;
  const summary = await runProductSmoke({ baseUrl: BASE_URL, dimension, entryDate });

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
