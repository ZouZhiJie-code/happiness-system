import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";

import { createGi088V8r3GoldenAItems } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/review-golden-a";
import { createGi088V8r3GoldenBItems } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/review-golden-b";
import { GI088_V8R3_DEVELOPMENT_CASES } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import { parseGi088V8r3PrivateHiddenFile } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/hidden-fixtures";
import { getGi088V8r3ConversationAtCheckpoint } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/runner";
import type { Gi088V8r3EvaluationCase } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/contracts";
import {
  canOpenGi088V8r3ReviewWorkbench,
  createGi088V8r3InitialReviewDraft,
  GI088_V8R3_REVIEW_TOOL_VERSION,
  type Gi088ReviewBundleV1,
  type Gi088ReviewDraftV1
} from "../src/features/interview/event-centered/gi088-review-workbench";
import {
  createGi088V8r3ReviewBundle,
  createGi088V8r3ReviewRepository,
  readGi088CandidateReviewPacket
} from "../src/server/services/evaluation/gi088/review-workbench-service";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 4393;
const MAX_BODY_BYTES = 1_200_000;
const REVIEW_MODE = "I_UNDERSTAND_LOCAL_PRIVATE_REVIEW";

function argumentValue(name: string) {
  const direct = process.argv.find((value) => value.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  response.end(JSON.stringify(value));
}

function html(response: ServerResponse, value: string) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY"
  });
  response.end(value);
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("GI088_REVIEW_BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function authorize(request: IncomingMessage, token: string) {
  const requestUrl = new URL(request.url ?? "/", `http://${HOST}`);
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/iu, "");
  return canOpenGi088V8r3ReviewWorkbench({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    host: request.headers.host ?? null,
    forwardedHost:
      typeof request.headers["x-forwarded-host"] === "string"
        ? request.headers["x-forwarded-host"]
        : null,
    mode: REVIEW_MODE,
    configuredToken: token,
    providedToken: bearer ?? requestUrl.searchParams.get("token") ?? undefined
  });
}

function assertEnvironment() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV) {
    throw new Error("GI088_REVIEW_LOCAL_ENVIRONMENT_REQUIRED");
  }
  for (const key of Object.keys(process.env)) {
    if (/DATABASE_URL|API_KEY|MODEL_CALL/i.test(key) && key.startsWith("GI088_V8R3_REVIEW_")) {
      throw new Error("GI088_REVIEW_EXTERNAL_CAPABILITY_FORBIDDEN");
    }
  }
}

function assertReviewSources(
  bundle: Gi088ReviewBundleV1,
  protectedCases: readonly Gi088V8r3EvaluationCase[]
) {
  const candidateFingerprints = new Set(
    bundle.candidateItems.flatMap((item) => [
      item.reviewItemFingerprint,
      sha256(JSON.stringify({ checkpoints: item.checkpoints }))
    ])
  );
  const golden = bundle.goldenRounds.flatMap((round) => round.items);
  const protectedConversationFingerprints = new Set([
    ...bundle.candidateItems.flatMap((item) =>
      item.checkpoints.map((checkpoint) =>
        sha256(JSON.stringify(checkpoint.visibleConversation))
      )
    ),
    ...protectedCases.flatMap((evaluationCase) =>
      evaluationCase.checkpoints.map((_, checkpointIndex) =>
        sha256(
          JSON.stringify(
            getGi088V8r3ConversationAtCheckpoint(
              evaluationCase,
              checkpointIndex
            ).map(({ role, content }) => ({ role, content }))
          )
        )
      )
    )
  ]);
  const seen = new Set<string>();
  for (const item of golden) {
    if (seen.has(item.contentFingerprint)) {
      throw new Error("GI088_REVIEW_GOLDEN_CONTENT_REUSED");
    }
    if (candidateFingerprints.has(item.contentFingerprint)) {
      throw new Error("GI088_REVIEW_GOLDEN_CANDIDATE_OVERLAP");
    }
    for (const checkpoint of item.checkpoints) {
      if (
        protectedConversationFingerprints.has(
          sha256(JSON.stringify(checkpoint.visibleConversation))
        )
      ) {
        throw new Error("GI088_REVIEW_GOLDEN_PROTECTED_SOURCE_OVERLAP");
      }
    }
    seen.add(item.contentFingerprint);
  }
}

function renderPage(token: string) {
  return String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>GI-088 人工裁决台</title>
  <style>
    :root{color-scheme:light;--paper:#fffaf0;--paper-2:#f8edd8;--ink:#2b2118;--muted:#796b5b;--line:#ddcdb5;--line-strong:#b99667;--amber:#a96626;--amber-soft:#f2dfbf;--red:#a33b32;--green:#426a4a;--shadow:0 18px 56px rgba(73,48,20,.12)}
    *{box-sizing:border-box}html,body{height:100%;margin:0}body{font:15px/1.55 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:var(--ink);background:linear-gradient(145deg,#f9efd9,#f0d6a9);overflow:hidden}
    button,textarea,select{font:inherit}button{min-height:44px;cursor:pointer}button:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid rgba(169,102,38,.35);outline-offset:2px}
    .app{height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr)}
    header{padding:12px 18px;border-bottom:1px solid var(--line);background:rgba(255,250,240,.94);backdrop-filter:blur(12px);display:flex;align-items:center;gap:16px;min-height:78px}
    .brand{min-width:210px}.brand h1{font-family:Georgia,"Songti SC",serif;font-size:20px;margin:0}.brand p{margin:2px 0 0;color:var(--muted);font-size:12px}
    .stages{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr));gap:8px;flex:1}.stage{border:1px solid var(--line);border-radius:14px;padding:8px 11px;background:#fffaf0;text-align:left}.stage.active{border-color:var(--line-strong);background:var(--amber-soft)}.stage strong{display:block;font-size:13px}.stage span{font-size:12px;color:var(--muted)}
    .save-state{width:180px;text-align:right;font-size:12px;color:var(--muted)}.save-state strong{display:block;color:var(--ink)}
    main{min-height:0;display:grid;grid-template-columns:230px minmax(420px,1fr) 370px;gap:12px;padding:12px;max-width:1720px;width:100%;margin:0 auto}
    .panel{min-height:0;border:1px solid var(--line);border-radius:20px;background:rgba(255,250,240,.96);box-shadow:var(--shadow)}
    .queue{display:grid;grid-template-rows:auto auto minmax(0,1fr);padding:14px}.queue-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.queue h2,.review h2{font-size:15px;margin:0}.filter{border:0;background:transparent;color:var(--amber);padding:4px 6px;min-height:44px}.queue-note{font-size:12px;color:var(--muted);margin:6px 0 10px}.queue-list{min-height:0;overflow:auto;display:grid;align-content:start;grid-template-columns:repeat(4,1fr);gap:7px;padding-right:3px}.queue-item{border:1px solid var(--line);border-radius:10px;background:#fff;padding:0;aspect-ratio:1;color:var(--muted)}.queue-item.done{background:#e7efe3;color:var(--green);border-color:#aac5a9}.queue-item.current{background:var(--ink);color:#fff;border-color:var(--ink)}
    .conversation{display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}.context-head{padding:16px 20px 12px;border-bottom:1px solid var(--line)}.eyebrow{font-size:11px;letter-spacing:.12em;color:var(--amber);font-weight:700}.context-head h2{font-family:Georgia,"Songti SC",serif;font-size:20px;line-height:1.3;margin:4px 0 0;max-width:72ch}.dialogue{min-height:0;overflow:auto;padding:20px clamp(16px,4vw,48px);scrollbar-gutter:stable}.checkpoint{max-width:72ch;margin:0 auto 26px}.checkpoint-label{font-size:11px;color:var(--muted);margin-bottom:10px}.bubble{max-width:82%;padding:12px 14px;border-radius:16px;margin:9px 0;white-space:pre-wrap}.bubble.user{margin-left:auto;background:var(--ink);color:#fff;border-bottom-right-radius:5px}.bubble.assistant{background:#fff;border:1px solid var(--line);border-bottom-left-radius:5px}.candidate{max-width:72ch;margin:18px auto 0;padding-top:18px;border-top:1px solid var(--line-strong)}.candidate .label{font-size:11px;font-weight:700;color:var(--amber);letter-spacing:.08em}.understanding{color:var(--muted);margin:7px 0}.response{font-size:16px;margin:7px 0;white-space:pre-wrap}.trace{max-width:72ch;margin:0 auto;padding:10px 20px 14px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}.trace pre{white-space:pre-wrap;overflow:auto;background:#f7eddd;padding:10px;border-radius:10px}
    .review{padding:16px;overflow:auto}.review-close,.mobile-review-toggle{display:none}.review-intro{font-size:13px;color:var(--muted);margin:6px 0 14px}.verdicts{display:grid;gap:8px}.verdict{border:1px solid var(--line);border-radius:14px;background:#fff;text-align:left;padding:10px 12px}.verdict strong{display:block}.verdict span{display:block;font-size:12px;color:var(--muted)}.verdict.selected{border-color:var(--line-strong);background:var(--amber-soft)}
    .details{margin-top:15px;padding-top:15px;border-top:1px solid var(--line)}label{display:block;font-weight:650;font-size:13px;margin:0 0 6px}select,textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px;color:var(--ink)}textarea{min-height:96px;resize:vertical}.count{text-align:right;font-size:11px;color:var(--muted)}.blocker{display:flex;align-items:center;gap:8px;margin:10px 0}.blocker input{width:20px;height:20px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.actions button{border:1px solid var(--line);border-radius:12px;background:#fff}.actions .primary{background:var(--ink);color:#fff;border-color:var(--ink)}.actions button:disabled{opacity:.45;cursor:not-allowed}.error{margin-top:10px;color:var(--red);font-size:12px}.keyboard{margin-top:16px;font-size:11px;color:var(--muted)}
    .mobile-queue{display:none}
    @media(max-width:1100px){body{overflow:auto}.app{height:auto;min-height:100dvh}header{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:1fr auto;padding:10px 12px}.brand{min-width:0}.brand p{display:none}.stages{grid-column:1/-1;grid-template-columns:repeat(3,1fr);order:3}.stage{min-width:0;padding:7px;min-height:44px}.stage strong{font-size:12px}.save-state{width:auto}.stage span{font-size:11px}main{display:flex;flex-direction:column;min-height:calc(100dvh - 120px);padding:8px}.queue{display:none}.mobile-queue{display:flex;align-items:center;justify-content:space-between;padding:10px 14px}.conversation{min-height:58dvh}.dialogue{max-height:none}.review{position:fixed;z-index:20;left:8px;right:8px;bottom:8px;max-height:min(78dvh,720px);transform:translateY(calc(100% + 20px));transition:transform 180ms ease}.review.open{transform:translateY(0)}.review-close{display:block;float:right;border:0;background:transparent;color:var(--muted)}.mobile-review-toggle{display:block;position:fixed;z-index:15;right:14px;bottom:14px;border:1px solid var(--line-strong);border-radius:999px;background:var(--ink);color:#fff;padding:10px 18px;box-shadow:var(--shadow)}.actions{position:sticky;bottom:0;background:linear-gradient(transparent,var(--paper) 24%);padding-top:20px}.panel{border-radius:16px}}
    @media(max-width:520px){header{grid-template-columns:1fr}.save-state{text-align:left}.stages{overflow-x:auto;grid-template-columns:repeat(3,minmax(118px,1fr))}main{padding:6px}.context-head{padding:13px 14px}.context-head h2{font-size:18px}.dialogue{padding:14px 11px}.bubble{max-width:92%;padding:10px 12px}.review{padding:14px}.actions{grid-template-columns:1fr}.queue-item{min-height:44px;aspect-ratio:auto}.mobile-queue{min-height:52px}}
    @media(prefers-reduced-motion:no-preference){button{transition:transform 120ms ease,background 120ms ease,border-color 120ms ease}button:active{transform:scale(.98)}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div class="brand"><h1>GI-088 人工裁决台</h1><p>本机私有 · 自动保存 · 零网络上传</p></div>
      <div id="stages" class="stages" aria-label="裁决阶段"></div>
      <div id="saveState" class="save-state" aria-live="polite"><strong>正在读取进度</strong><span>请稍候</span></div>
    </header>
    <main>
      <aside class="panel queue" aria-label="裁决队列">
        <div class="queue-head"><h2 id="queueTitle">候选质量</h2><button id="filterButton" class="filter">只看待评</button></div>
        <p class="queue-note">盲序仅显示序号与完成状态</p>
        <div id="queue" class="queue-list"></div>
      </aside>
      <section class="panel mobile-queue"><button id="previousMobile">上一条</button><strong id="mobilePosition">1 / 80</strong><button id="nextMobile">下一条</button></section>
      <section class="panel conversation" aria-label="对话材料">
        <div class="context-head"><div class="eyebrow" id="itemEyebrow">候选质量 · 第 1 条</div><h2 id="workingTask">读取中</h2></div>
        <div id="dialogue" class="dialogue" tabindex="0"></div>
        <details class="trace"><summary>查看技术 Trace</summary><pre id="trace"></pre></details>
      </section>
      <button id="mobileReviewToggle" class="mobile-review-toggle" aria-haspopup="dialog">裁决此条</button>
      <aside class="panel review" aria-labelledby="reviewTitle">
        <button id="closeReview" class="review-close" aria-label="关闭裁决面板">关闭</button>
        <h2 id="reviewTitle">你的质量结论</h2>
        <p class="review-intro">依据共同任务、完整对话和候选回应判断。模型与案例身份会一直隐藏到封存完成。</p>
        <div id="verdicts" class="verdicts"></div>
        <div id="details" class="details" hidden>
          <label for="category">主要原因</label>
          <select id="category"></select>
          <label for="reason" style="margin-top:12px">判断理由</label>
          <textarea id="reason" maxlength="300" placeholder="请用 8–300 字说明这条回应具体哪里影响了用户体验"></textarea>
          <div id="reasonCount" class="count">0 / 300</div>
          <label id="blockerLabel" class="blocker"><input id="blocker" type="checkbox" /> 这是单例阻断</label>
        </div>
        <div class="actions"><button id="previous">上一条</button><button id="saveNext" class="primary">保存并下一条</button></div>
        <button id="finalize" class="primary" style="width:100%;margin-top:9px" hidden>保存并交给 Codex</button>
        <p id="error" class="error" role="alert"></p>
        <p class="keyboard">快捷键：←/→ 切换，1–4 选择结论，⌘/Ctrl + Enter 保存。</p>
      </aside>
    </main>
  </div>
  <script src="/gi088-review-workbench-client.js?token=${token}"></script>
</body></html>`;
}

async function main() {
  assertEnvironment();
  const repositoryRoot = process.cwd();
  const historicalPrivateRoot =
    process.env.GI088_V8R3_HISTORICAL_ROOT ??
    (repositoryRoot.endsWith("-v8r3")
      ? repositoryRoot.slice(0, -"-v8r3".length)
      : repositoryRoot);
  const privateRoot = resolve(
    repositoryRoot,
    "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-review-workbench"
  );
  const candidatePath = resolve(
    repositoryRoot,
    "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-offline/human-adjudication-r3.json"
  );
  const hiddenPath = resolve(
    repositoryRoot,
    "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-offline/private-hidden-admission.json"
  );
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  const [candidatePacket, goldenA, hiddenCases] = await Promise.all([
    readGi088CandidateReviewPacket(candidatePath),
    createGi088V8r3GoldenAItems({ repositoryRoot, historicalPrivateRoot }),
    readFile(hiddenPath, "utf8").then((value) =>
      parseGi088V8r3PrivateHiddenFile(JSON.parse(value))
    )
  ]);
  const goldenB = createGi088V8r3GoldenBItems();
  const toolSourcePaths = [
    "package.json",
    "scripts/run-gi088-v8r3-review-workbench.ts",
    "public/gi088-review-workbench-client.js",
    "src/features/interview/event-centered/gi088-review-workbench.ts",
    "src/server/services/evaluation/gi088/review-workbench-service.ts",
    "evals/event-centered-generative/gi088-v8r3-skill-evaluation/review-golden-a.ts",
    "evals/event-centered-generative/gi088-v8r3-skill-evaluation/review-golden-b.ts"
  ];
  const toolSourceSha256 = sha256(
    (
      await Promise.all(
        toolSourcePaths.map(async (path) =>
          `${path}\0${await readFile(resolve(repositoryRoot, path), "utf8")}`
        )
      )
    ).join("\0")
  );
  const seed = sha256(
    `${candidatePacket.candidateEvidenceFingerprint}:${GI088_V8R3_REVIEW_TOOL_VERSION}`
  );
  const reviewBundle = createGi088V8r3ReviewBundle({
    candidatePacket,
    goldenA,
    goldenB,
    seed,
    toolSourceSha256
  });
  assertReviewSources(reviewBundle, [
    ...GI088_V8R3_DEVELOPMENT_CASES,
    ...hiddenCases
  ]);
  const repository = createGi088V8r3ReviewRepository({
    root: privateRoot,
    bundle: reviewBundle
  });
  const existingDraft = await repository.readDraft();
  if (!existingDraft) {
    await repository.saveDraft(createGi088V8r3InitialReviewDraft(reviewBundle));
  }
  const clientSource = await readFile(
    resolve(repositoryRoot, "public/gi088-review-workbench-client.js"),
    "utf8"
  );
  const token = randomBytes(32).toString("hex");
  const requestedPort = Number(argumentValue("--port") ?? DEFAULT_PORT);
  if (!Number.isInteger(requestedPort) || requestedPort < 1024 || requestedPort > 65_535) {
    throw new Error("GI088_REVIEW_PORT_INVALID");
  }
  const server = createServer(async (request, response) => {
    try {
      if (!authorize(request, token)) {
        json(response, 404, { error: "GI088_REVIEW_NOT_FOUND" });
        return;
      }
      const requestUrl = new URL(request.url ?? "/", `http://${HOST}`);
      if (request.method === "GET" && requestUrl.pathname === "/") {
        html(response, renderPage(token));
        return;
      }
      if (
        request.method === "GET" &&
        requestUrl.pathname === "/gi088-review-workbench-client.js"
      ) {
        response.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer"
        });
        response.end(clientSource);
        return;
      }
      if (
        request.method === "GET" &&
        requestUrl.pathname === "/api/local/gi088-v8r3/review-session"
      ) {
        json(response, 200, {
          bundle: reviewBundle,
          draft:
            (await repository.readDraft()) ??
            createGi088V8r3InitialReviewDraft(reviewBundle),
          network: { databaseCalls: 0, externalModelCalls: 0, uploads: 0 }
        });
        return;
      }
      if (
        request.method === "POST" &&
        requestUrl.pathname === "/api/local/gi088-v8r3/review-draft"
      ) {
        const draft = (await body(request)) as Gi088ReviewDraftV1;
        await repository.saveDraft(draft);
        json(response, 200, { ok: true, savedAt: draft.savedAt });
        return;
      }
      if (
        request.method === "POST" &&
        requestUrl.pathname === "/api/local/gi088-v8r3/review-finalize"
      ) {
        const draft = (await body(request)) as Gi088ReviewDraftV1;
        await repository.saveDraft(draft);
        const receipt = await repository.finalize(draft);
        json(response, 200, { ok: true, receipt });
        return;
      }
      json(response, 404, { error: "GI088_REVIEW_NOT_FOUND" });
    } catch (error) {
      json(response, 400, {
        error: error instanceof Error ? error.message : "GI088_REVIEW_FAILED"
      });
    }
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, HOST, () => resolveListen());
  });
  const url = `http://${HOST}:${requestedPort}/?token=${token}`;
  process.stdout.write(
    `${JSON.stringify({
      ready: true,
      url,
      toolVersion: GI088_V8R3_REVIEW_TOOL_VERSION,
      toolSourceSha256,
      bundleFingerprint: reviewBundle.bundleFingerprint,
      candidate: 80,
      goldenA: 20,
      goldenB: 20,
      databaseCalls: 0,
      externalModelCalls: 0,
      uploads: 0
    })}\n`
  );
  if (!process.argv.includes("--no-open")) {
    const opener = spawn("open", [url], { stdio: "ignore", detached: true });
    opener.unref();
  }
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "GI088_REVIEW_START_FAILED"}\n`
  );
  process.exitCode = 1;
});
