#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { BASE_URL, createAcceptanceClient } from "./launch-acceptance-runner.mjs";

function inferErrorCode(error) {
  return error instanceof Error ? error.message : String(error);
}

export function inferAdminAIRuntimeCases(env = process.env) {
  const cases = [];
  const allowThirdPartyRelay = env.ADMIN_AI_RUNTIME_ALLOW_THIRD_PARTY_RELAY === "1";
  const capabilityFilter = new Set(
    String(env.ADMIN_AI_RUNTIME_CASE_CAPABILITIES ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
  const allowsCapability = (capability) => capabilityFilter.size === 0 || capabilityFilter.has(capability);

  if (
    allowsCapability("chat") &&
    allowThirdPartyRelay &&
    env.ADMIN_AI_RUNTIME_OPENAI_API_KEY &&
    env.ADMIN_AI_RUNTIME_OPENAI_CHAT_MODEL
  ) {
    cases.push({
      capability: "chat",
      provider: "openai",
      body: {
        provider: "openai",
        enabled: true,
        displayName: "OpenAI Chat Smoke",
        apiKey: env.ADMIN_AI_RUNTIME_OPENAI_API_KEY,
        config: {
          model: env.ADMIN_AI_RUNTIME_OPENAI_CHAT_MODEL,
          baseUrl: env.ADMIN_AI_RUNTIME_OPENAI_BASE_URL ?? "https://api.openai.com/v1"
        }
      }
    });
  }

  if (
    allowsCapability("chat") &&
    allowThirdPartyRelay &&
    env.ADMIN_AI_RUNTIME_ANTHROPIC_API_KEY &&
    env.ADMIN_AI_RUNTIME_ANTHROPIC_CHAT_MODEL
  ) {
    cases.push({
      capability: "chat",
      provider: "anthropic",
      body: {
        provider: "anthropic",
        enabled: true,
        displayName: "Anthropic Chat Smoke",
        apiKey: env.ADMIN_AI_RUNTIME_ANTHROPIC_API_KEY,
        config: {
          model: env.ADMIN_AI_RUNTIME_ANTHROPIC_CHAT_MODEL,
          baseUrl: env.ADMIN_AI_RUNTIME_ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
          anthropicVersion: env.ADMIN_AI_RUNTIME_ANTHROPIC_VERSION ?? "2023-06-01"
        }
      }
    });
  }

  if (
    allowsCapability("chat") &&
    env.ADMIN_AI_RUNTIME_ARK_API_KEY &&
    (env.ADMIN_AI_RUNTIME_ARK_CHAT_MODEL_ID || env.ADMIN_AI_RUNTIME_ARK_CHAT_ENDPOINT_ID)
  ) {
    cases.push({
      capability: "chat",
      provider: "volcengine_ark",
      body: {
        provider: "volcengine_ark",
        enabled: true,
        displayName: "Ark Chat Smoke",
        apiKey: env.ADMIN_AI_RUNTIME_ARK_API_KEY,
        config: {
          ...(env.ADMIN_AI_RUNTIME_ARK_CHAT_MODEL_ID
            ? { modelId: env.ADMIN_AI_RUNTIME_ARK_CHAT_MODEL_ID }
            : {}),
          ...(env.ADMIN_AI_RUNTIME_ARK_CHAT_ENDPOINT_ID
            ? { endpointId: env.ADMIN_AI_RUNTIME_ARK_CHAT_ENDPOINT_ID }
            : {}),
          baseUrl: env.ADMIN_AI_RUNTIME_ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3"
        }
      }
    });
  }

  if (
    allowsCapability("embedding") &&
    allowThirdPartyRelay &&
    env.ADMIN_AI_RUNTIME_OPENAI_API_KEY &&
    env.ADMIN_AI_RUNTIME_OPENAI_EMBEDDING_MODEL
  ) {
    cases.push({
      capability: "embedding",
      provider: "openai",
      body: {
        provider: "openai",
        enabled: true,
        displayName: "OpenAI Embedding Smoke",
        apiKey: env.ADMIN_AI_RUNTIME_OPENAI_API_KEY,
        config: {
          model: env.ADMIN_AI_RUNTIME_OPENAI_EMBEDDING_MODEL,
          baseUrl: env.ADMIN_AI_RUNTIME_OPENAI_BASE_URL ?? "https://api.openai.com/v1"
        }
      }
    });
  }

  if (
    allowsCapability("embedding") &&
    env.ADMIN_AI_RUNTIME_ARK_API_KEY &&
    env.ADMIN_AI_RUNTIME_ARK_EMBEDDING_ENDPOINT_ID
  ) {
    cases.push({
      capability: "embedding",
      provider: "volcengine_ark",
      body: {
        provider: "volcengine_ark",
        enabled: true,
        displayName: "Ark Embedding Smoke",
        apiKey: env.ADMIN_AI_RUNTIME_ARK_API_KEY,
        config: {
          embeddingEndpointId: env.ADMIN_AI_RUNTIME_ARK_EMBEDDING_ENDPOINT_ID,
          baseUrl: env.ADMIN_AI_RUNTIME_ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3"
        }
      }
    });
  }

  return cases;
}

async function requestJson(http, path, options) {
  const response = await http(path, options);

  return {
    status: response.status,
    json: response.json,
    text: response.text
  };
}

async function assertOk(http, path, options) {
  const response = await requestJson(http, path, options);

  if (response.status !== 200) {
    throw new Error(`${path} failed: ${response.status} ${response.json?.error ?? response.text ?? "UNKNOWN"}`);
  }

  return response.json;
}

function withVariantDisplayName(body, suffix) {
  return {
    ...body,
    displayName: `${body.displayName} ${suffix}`.trim()
  };
}

export async function runAdminAIRuntimeSmoke(
  {
    baseUrl = BASE_URL,
    username = process.env.ADMIN_AI_RUNTIME_USERNAME ?? "",
    password = process.env.ADMIN_AI_RUNTIME_PASSWORD ?? "",
    runtimeReadbackToken = process.env.RUNTIME_ENV_READBACK_TOKEN ?? "",
    cases = inferAdminAIRuntimeCases()
  } = {},
  {
    loginAccount,
    registerAccount,
    getSession,
    http
  } = {}
) {
  if (!username || !password) {
    throw new Error("ADMIN_AI_RUNTIME_CREDENTIALS_MISSING");
  }

  if (!cases.length) {
    throw new Error("ADMIN_AI_RUNTIME_CASES_MISSING");
  }

  const client = createAcceptanceClient({ baseUrl });
  const activeLoginAccount = loginAccount ?? client.loginAccount;
  const activeRegisterAccount = registerAccount ?? client.registerAccount;
  const activeGetSession = getSession ?? client.getSession;
  const activeHttp = http ?? client.http;

  const summary = {
    ok: false,
    baseUrl,
    account: { username },
    cases: [],
    rollback: null,
    runtimeReadback: null,
    fallbackPublish: null,
    fallbackRuntimeReadback: null
  };

  let login;

  try {
    login = await activeLoginAccount({ username, password });
  } catch (error) {
    const message = inferErrorCode(error);

    if (!message.includes("401") && !message.includes("INVALID_CREDENTIALS")) {
      throw error;
    }

    await activeRegisterAccount(username, password);
    login = await activeLoginAccount({ username, password });
  }
  const session = await activeGetSession({ cookie: login.cookie });

  if (!session.json?.authenticated || !session.json?.user) {
    throw new Error("SESSION_NOT_AUTHENTICATED");
  }

  for (const testCase of cases) {
    const capabilityPath = `/api/admin/ai-runtime/${testCase.capability}`;
    const draft = await assertOk(activeHttp, `${capabilityPath}/draft`, {
      method: "PUT",
      cookie: login.cookie,
      body: testCase.body
    });
    const probe = await assertOk(activeHttp, `${capabilityPath}/probe`, {
      method: "POST",
      cookie: login.cookie
    });
    const published = await assertOk(activeHttp, `${capabilityPath}/publish`, {
      method: "POST",
      cookie: login.cookie
    });

    summary.cases.push({
      capability: testCase.capability,
      provider: testCase.provider,
      draftId: draft.draft?.id ?? null,
      probeId: probe.probe?.id ?? null,
      publishId: published.publishedConfig?.id ?? null
    });
  }

  const rollbackSeed = cases.find((item) => item.capability === "chat") ?? cases[0];
  const rollbackPath = `/api/admin/ai-runtime/${rollbackSeed.capability}`;
  const secondDraft = await assertOk(activeHttp, `${rollbackPath}/draft`, {
    method: "PUT",
    cookie: login.cookie,
    body: withVariantDisplayName(rollbackSeed.body, "Rollback Variant")
  });
  await assertOk(activeHttp, `${rollbackPath}/probe`, {
    method: "POST",
    cookie: login.cookie
  });
  const secondPublish = await assertOk(activeHttp, `${rollbackPath}/publish`, {
    method: "POST",
    cookie: login.cookie
  });
  const history = await assertOk(activeHttp, `${rollbackPath}/history`, {
    method: "GET",
    cookie: login.cookie
  });
  const rollbackTarget = history.history?.find((item) => item.id !== secondPublish.publishedConfig?.id);

  if (!rollbackTarget?.id) {
    throw new Error("ROLLBACK_TARGET_NOT_FOUND");
  }

  const rollback = await assertOk(activeHttp, `${rollbackPath}/rollback`, {
    method: "POST",
    cookie: login.cookie,
    body: {
      rollbackFromId: rollbackTarget.id
    }
  });

  summary.rollback = {
    capability: rollbackSeed.capability,
    publishId: secondPublish.publishedConfig?.id ?? null,
    rollbackFromId: rollbackTarget.id,
    rolledBackConfigId: rollback.rolledBackConfig?.id ?? null,
    secondDraftId: secondDraft.draft?.id ?? null
  };

  if (runtimeReadbackToken) {
    summary.runtimeReadback = await assertOk(activeHttp, "/api/debug/runtime-env?probe=1", {
      method: "GET",
      cookie: login.cookie,
      headers: {
        "x-runtime-readback-token": runtimeReadbackToken
      }
    });
  }

  if (runtimeReadbackToken && rollbackSeed.capability === "chat") {
    const fallbackDraft = await assertOk(activeHttp, `${rollbackPath}/draft`, {
      method: "PUT",
      cookie: login.cookie,
      body: {
        ...rollbackSeed.body,
        displayName: `${rollbackSeed.body.displayName} Env Fallback`,
        enabled: false
      }
    });
    await assertOk(activeHttp, `${rollbackPath}/probe`, {
      method: "POST",
      cookie: login.cookie
    });
    const fallbackPublish = await assertOk(activeHttp, `${rollbackPath}/publish`, {
      method: "POST",
      cookie: login.cookie
    });

    summary.fallbackPublish = {
      capability: rollbackSeed.capability,
      draftId: fallbackDraft.draft?.id ?? null,
      publishedConfigId: fallbackPublish.publishedConfig?.id ?? null
    };
    summary.fallbackRuntimeReadback = await assertOk(activeHttp, "/api/debug/runtime-env?probe=1", {
      method: "GET",
      cookie: login.cookie,
      headers: {
        "x-runtime-readback-token": runtimeReadbackToken
      }
    });
  }

  summary.ok = true;
  return summary;
}

export async function main(argv = process.argv.slice(2)) {
  const [baseUrl = BASE_URL] = argv;

  try {
    const summary = await runAdminAIRuntimeSmoke({ baseUrl });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } catch (error) {
    const summary = {
      ok: false,
      baseUrl,
      account: {
        username: process.env.ADMIN_AI_RUNTIME_USERNAME ?? null
      },
      cases: [],
      rollback: null,
      runtimeReadback: null,
      fallbackPublish: null,
      fallbackRuntimeReadback: null,
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
          account: {
            username: process.env.ADMIN_AI_RUNTIME_USERNAME ?? null
          },
          cases: [],
          rollback: null,
          runtimeReadback: null,
          fallbackPublish: null,
          fallbackRuntimeReadback: null,
          error: inferErrorCode(error)
        },
        null,
        2
      )}\n`
    );
    process.exit(1);
  });
}
