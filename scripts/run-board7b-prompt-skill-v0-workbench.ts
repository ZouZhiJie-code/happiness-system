import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BOARD7B_PROMPT_SKILL_V0_CANDIDATE_VERSION,
  BOARD7B_PROMPT_SKILL_V0_EVALUATION_ID,
  BOARD7B_PROMPT_SKILL_V0_PACKAGE_DIRECTORY,
  BOARD7B_PROMPT_SKILL_V0_PROMPT_VERSIONS,
  BOARD7B_PROMPT_SKILL_V0_RUNTIME_POLICY,
  BOARD7B_PROMPT_SKILL_V0_VALIDATION_RULES,
  createBoard7bPromptSkillV0CandidateFingerprint,
  createBoard7bPromptSkillV0SystemPrompt,
  loadBoard7bPromptSkillV0Assets
} from "../evals/event-centered-generative/board7b-prompt-skill-v0/board7b-prompt-skill-v0";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 4327;
const MAX_PORT = 65_535;
const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/iu;
const WORKBENCH_KIND = "read_only_asset_workbench" as const;

function argumentValue(name: string) {
  const direct = process.argv.find((item) => item.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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

function sendJson(response: ServerResponse, value: unknown) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

async function loadWorkbenchState() {
  const assets = await loadBoard7bPromptSkillV0Assets();
  const packageDirectory = resolve(
    process.cwd(),
    BOARD7B_PROMPT_SKILL_V0_PACKAGE_DIRECTORY
  );
  const [manifestSource, factCardSource, authorizationSource] =
    await Promise.all([
      readFile(
        resolve(packageDirectory, "board7b-prompt-skill-v0-manifest.json"),
        "utf8"
      ),
      readFile(
        resolve(
          packageDirectory,
          "board7b-prompt-skill-v0-fact-card-template.json"
        ),
        "utf8"
      ),
      readFile(
        resolve(
          packageDirectory,
          "board7b-prompt-skill-v0-authorization-template.json"
        ),
        "utf8"
      )
    ]);
  const candidateFingerprint =
    createBoard7bPromptSkillV0CandidateFingerprint(assets);
  const manifest = JSON.parse(manifestSource) as {
    candidateFingerprint?: string;
    modelCalls?: number;
  };
  const factCard = JSON.parse(factCardSource) as unknown;
  const authorization = JSON.parse(authorizationSource) as unknown;

  const staticIssues: string[] = [];
  if (manifest.candidateFingerprint !== candidateFingerprint) {
    staticIssues.push("MANIFEST_CANDIDATE_FINGERPRINT_MISMATCH");
  }
  if (manifest.modelCalls !== 0) {
    staticIssues.push("MANIFEST_MODEL_CALL_COUNT_NOT_ZERO");
  }

  return {
    workbenchKind: WORKBENCH_KIND,
    evaluationId: BOARD7B_PROMPT_SKILL_V0_EVALUATION_ID,
    candidateVersion: BOARD7B_PROMPT_SKILL_V0_CANDIDATE_VERSION,
    candidateFingerprint,
    promptVersions: BOARD7B_PROMPT_SKILL_V0_PROMPT_VERSIONS,
    runtimePolicy: BOARD7B_PROMPT_SKILL_V0_RUNTIME_POLICY,
    validationRules: BOARD7B_PROMPT_SKILL_V0_VALIDATION_RULES,
    gates: {
      factCard: "pending",
      authorization: "pending",
      modelCalls: 0
    },
    staticValidation: {
      status: staticIssues.length === 0 ? "passed" : "failed",
      issues: staticIssues
    },
    assets: {
      basePrompt: assets.basePrompt,
      interviewSkill: assets.interviewSkill,
      outputContract: assets.outputContract,
      assembledSystemPrompt: createBoard7bPromptSkillV0SystemPrompt(assets),
      contrastiveCases: assets.contrastiveCases,
      manifest,
      factCard,
      authorization
    }
  };
}

async function main() {
  if (process.argv.includes("--fingerprint")) {
    const assets = await loadBoard7bPromptSkillV0Assets();
    process.stdout.write(
      `${createBoard7bPromptSkillV0CandidateFingerprint(assets)}\n`
    );
    return;
  }

  if (process.argv.includes("--inspect") || process.argv.includes("--check")) {
    const state = await loadWorkbenchState();
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    if (
      process.argv.includes("--check") &&
      state.staticValidation.status !== "passed"
    ) {
      process.exitCode = 1;
    }
    return;
  }

  if (!process.argv.includes("--serve")) {
    throw new Error(
      "BOARD7B_PROMPT_SKILL_V0_COMMAND_REQUIRED: use --fingerprint, --inspect, --check, or --serve"
    );
  }

  const port = Number(argumentValue("--port") ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1_024 || port > MAX_PORT) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_PORT_INVALID");
  }

  const html = await readFile(
    resolve(
      process.cwd(),
      "evals/event-centered-generative/board7b-prompt-skill-v0/workbench.html"
    ),
    "utf8"
  );
  const serverToken = randomBytes(24).toString("hex");
  const state = await loadWorkbenchState();

  const server = createServer((request, response) => {
    if (!requestIsLocal(request, port)) {
      response.writeHead(404).end();
      return;
    }
    const url = new URL(request.url ?? "/", `http://${HOST}:${port}`);
    const headerValue = request.headers["x-workbench-token"];
    const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
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
          "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer"
      });
      response.end(html);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/candidate") {
      sendJson(response, state);
      return;
    }
    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, HOST, () => resolvePromise());
  });

  process.stdout.write(
    [
      "Board 7B Prompt／Skill v0 只读工作台已启动。",
      `候选指纹：${state.candidateFingerprint}`,
      `打开：http://${HOST}:${port}/?token=${serverToken}`,
      "当前停止点：事实卡待确认、运行授权待确认、模型调用 0。"
    ].join("\n") + "\n"
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
