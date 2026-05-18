#!/usr/bin/env node

const BASE_URL = process.env.ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:3001";

function randomSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function normalizeUsername(prefix) {
  const compact = String(prefix).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 10);
  const suffix = randomSuffix().slice(-10);
  return `${compact}_${suffix}`.slice(0, 24);
}

async function http(path, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;

  const response = await fetch(`${BASE_URL}${path}`, {
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
}

function extractCookie(setCookie) {
  if (!setCookie) return null;
  return setCookie.split(";")[0];
}

async function registerAndLogin(prefix = "acc") {
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

function summarizeSessionPayload(payload) {
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
