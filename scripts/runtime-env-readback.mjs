#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { BASE_URL, createAcceptanceClient } from "./launch-acceptance-runner.mjs";

function inferErrorCode(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function runRuntimeEnvReadback(
  {
    baseUrl = BASE_URL,
    prefix = "runtime",
    token = process.env.RUNTIME_ENV_READBACK_TOKEN ?? ""
  } = {},
  {
    registerAccount,
    loginAccount,
    getSession,
    http
  } = {}
) {
  const client = createAcceptanceClient({ baseUrl });
  const activeRegisterAccount = registerAccount ?? client.registerAccount;
  const activeLoginAccount = loginAccount ?? client.loginAccount;
  const activeGetSession = getSession ?? client.getSession;
  const activeHttp = http ?? client.http;

  const summary = {
    ok: false,
    baseUrl,
    account: null,
    env: null,
    resolved: null
  };

  const registration = await activeRegisterAccount(prefix);
  summary.account = { username: registration.username };

  const login = await activeLoginAccount({
    username: registration.username,
    password: registration.password
  });

  const session = await activeGetSession({ cookie: login.cookie });

  if (!session.json?.authenticated || !session.json?.user) {
    throw new Error("SESSION_NOT_AUTHENTICATED");
  }

  const response = await activeHttp("/api/debug/runtime-env", {
    cookie: login.cookie,
    headers: {
      "x-runtime-readback-token": token
    }
  });

  if (response.status !== 200 || !response.json) {
    throw new Error(
      `runtime env readback failed: ${response.status} ${response.json?.error ?? response.text ?? "UNKNOWN"}`
    );
  }

  summary.ok = true;
  summary.env = response.json.env ?? null;
  summary.resolved = response.json.resolved ?? null;

  return summary;
}

export async function main(argv = process.argv.slice(2)) {
  const [baseUrl = BASE_URL, prefix = "runtime"] = argv;

  try {
    const summary = await runRuntimeEnvReadback({ baseUrl, prefix });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } catch (error) {
    const summary = {
      ok: false,
      baseUrl,
      account: null,
      env: null,
      resolved: null,
      error: inferErrorCode(error)
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exitCode = 1;
    return summary;
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          baseUrl: process.argv[2] ?? BASE_URL,
          account: null,
          env: null,
          resolved: null,
          error: inferErrorCode(error)
        },
        null,
        2
      )}\n`
    );
    process.exit(1);
  });
}
