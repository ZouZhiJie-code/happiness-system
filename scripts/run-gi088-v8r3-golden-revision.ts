import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";

import { GI088_V8R3_DEVELOPMENT_CASES } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import { parseGi088V8r3PrivateHiddenFile } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/hidden-fixtures";
import { createGi088V8r3GoldenReplacementItems } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/review-golden-replacements";
import { getGi088V8r3ConversationAtCheckpoint } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/runner";
import type { Gi088V8r3EvaluationCase } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/contracts";
import {
  createGi088V8r3InitialGoldenRevisionDraft,
  GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION,
  type Gi088GoldenRevisionBundleV1,
  type Gi088GoldenRevisionDraftV1
} from "../src/features/interview/event-centered/gi088-golden-revision-workbench";
import { canOpenGi088V8r3ReviewWorkbench } from "../src/features/interview/event-centered/gi088-review-workbench";
import {
  createGi088V8r3GoldenRevisionBundle,
  createGi088V8r3GoldenRevisionRepository,
  readGi088V8r3GoldenRevisionParent
} from "../src/server/services/evaluation/gi088/golden-revision-service";
import { readGi088CandidateReviewPacket } from "../src/server/services/evaluation/gi088/review-workbench-service";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 4394;
const MAX_BODY_BYTES = 300_000;
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
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'",
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
    if (size > MAX_BODY_BYTES) {
      throw new Error("GI088_GOLDEN_REVISION_BODY_TOO_LARGE");
    }
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
    throw new Error("GI088_GOLDEN_REVISION_LOCAL_ENVIRONMENT_REQUIRED");
  }
}

function assertReplacementSources(
  bundle: Gi088GoldenRevisionBundleV1,
  candidateItems: Array<{
    reviewItemFingerprint: string;
    checkpoints: Array<{ visibleConversation: unknown }>;
  }>,
  protectedCases: readonly Gi088V8r3EvaluationCase[]
) {
  const protectedConversationFingerprints = new Set([
    ...candidateItems.flatMap((item) =>
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
  const items = bundle.replacementRounds.flatMap((round) =>
    round.items.map((replacement) => replacement.item)
  );
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.contentFingerprint)) {
      throw new Error("GI088_GOLDEN_REVISION_CONTENT_REUSED");
    }
    for (const checkpoint of item.checkpoints) {
      if (
        protectedConversationFingerprints.has(
          sha256(JSON.stringify(checkpoint.visibleConversation))
        )
      ) {
        throw new Error("GI088_GOLDEN_REVISION_PROTECTED_SOURCE_OVERLAP");
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
  <title>GI-088 Golden 8 条替换裁决</title>
  <style>
    :root{color-scheme:light;--paper:#fffaf0;--paper-2:#f8edd8;--ink:#2b2118;--muted:#796b5b;--line:#ddcdb5;--line-strong:#b99667;--amber:#a96626;--amber-soft:#f2dfbf;--red:#a33b32;--green:#426a4a;--shadow:0 18px 56px rgba(73,48,20,.12)}
    *{box-sizing:border-box}html,body{height:100%;margin:0}body{font:15px/1.55 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:var(--ink);background:linear-gradient(145deg,#f9efd9,#f0d6a9);overflow:hidden}
    button,textarea,select{font:inherit}button{min-height:44px;cursor:pointer}button:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid rgba(169,102,38,.35);outline-offset:2px}
    .app{height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr)}
    header{padding:11px 18px;border-bottom:1px solid var(--line);background:rgba(255,250,240,.94);backdrop-filter:blur(12px);display:grid;grid-template-columns:minmax(210px,1fr) minmax(300px,520px) minmax(150px,1fr);align-items:center;gap:16px;min-height:76px}
    .brand h1{font-family:Georgia,"Songti SC",serif;font-size:20px;margin:0}.brand p{margin:2px 0 0;color:var(--muted);font-size:12px}.progress-line{display:flex;align-items:baseline;gap:9px}.progress-line strong{font-size:22px}.progress-line span{font-size:12px;color:var(--muted)}
    .stages{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:8px}.stage{border:1px solid var(--line);border-radius:14px;padding:8px 11px;background:#fffaf0;text-align:left}.stage.active{border-color:var(--line-strong);background:var(--amber-soft)}.stage strong{display:block;font-size:13px}.stage span{font-size:12px;color:var(--muted)}
    .save-state{text-align:right;font-size:12px;color:var(--muted);border:0;background:transparent;padding:6px}.save-state strong{display:block;color:var(--ink)}
    main{min-height:0;display:grid;grid-template-columns:180px minmax(420px,1fr) 370px;gap:12px;padding:12px;max-width:1660px;width:100%;margin:0 auto}
    .panel{min-height:0;border:1px solid var(--line);border-radius:20px;background:rgba(255,250,240,.96);box-shadow:var(--shadow)}
    .queue{display:grid;grid-template-rows:auto auto minmax(0,1fr);padding:14px}.queue-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.queue h2,.review h2{font-size:15px;margin:0}.filter{border:0;background:transparent;color:var(--amber);padding:4px 6px}.queue-note{font-size:12px;color:var(--muted);margin:6px 0 10px}.queue-list{min-height:0;overflow:auto;display:grid;align-content:start;grid-template-columns:repeat(3,1fr);gap:8px}.queue-item{border:1px solid var(--line);border-radius:10px;background:#fff;padding:0;aspect-ratio:1;color:var(--muted)}.queue-item.done{background:#e7efe3;color:var(--green);border-color:#aac5a9}.queue-item.current{background:var(--ink);color:#fff;border-color:var(--ink)}
    .conversation{display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}.context-head{padding:14px 20px 11px;border-bottom:1px solid var(--line)}.eyebrow{font-size:11px;letter-spacing:.12em;color:var(--amber);font-weight:700}.context-head h2{font-family:Georgia,"Songti SC",serif;font-size:20px;line-height:1.3;margin:4px 0 0;max-width:72ch}.dialogue{min-height:0;overflow:auto;padding:18px clamp(16px,4vw,46px);scrollbar-gutter:stable}.checkpoint{max-width:72ch;margin:0 auto 24px}.checkpoint-label{font-size:11px;color:var(--muted);margin-bottom:10px}.bubble{max-width:82%;padding:12px 14px;border-radius:16px;margin:9px 0;white-space:pre-wrap}.bubble.user{margin-left:auto;background:var(--ink);color:#fff;border-bottom-right-radius:5px}.bubble.assistant{background:#fff;border:1px solid var(--line);border-bottom-left-radius:5px}.candidate{max-width:72ch;margin:18px auto 0;padding-top:18px;border-top:1px solid var(--line-strong)}.candidate .label{font-size:11px;font-weight:700;color:var(--amber);letter-spacing:.08em}.understanding{color:var(--muted);margin:7px 0}.response{font-size:16px;margin:7px 0;white-space:pre-wrap}.trace{max-width:72ch;margin:0 auto;padding:9px 20px 12px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}.trace pre{white-space:pre-wrap;overflow:auto;background:#f7eddd;padding:10px;border-radius:10px}
    .review{padding:16px;overflow:auto}.review-close,.mobile-review-toggle{display:none}.review-intro{font-size:13px;color:var(--muted);margin:6px 0 14px}.verdicts{display:grid;gap:8px}.verdict{border:1px solid var(--line);border-radius:14px;background:#fff;text-align:left;padding:10px 12px}.verdict strong{display:block}.verdict span{display:block;font-size:12px;color:var(--muted)}.verdict.selected{border-color:var(--line-strong);background:var(--amber-soft)}
    .details{margin-top:15px;padding-top:15px;border-top:1px solid var(--line)}label{display:block;font-weight:650;font-size:13px;margin:0 0 6px}select,textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px;color:var(--ink)}textarea{min-height:96px;resize:vertical}.count{text-align:right;font-size:11px;color:var(--muted)}.blocker{display:flex;align-items:center;gap:8px;margin:10px 0}.blocker input{width:20px;height:20px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.actions button,.primary{border:1px solid var(--line);border-radius:12px;background:#fff}.actions .primary,.primary{background:var(--ink);color:#fff;border-color:var(--ink)}button:disabled{opacity:.45;cursor:not-allowed}.error{margin-top:10px;color:var(--red);font-size:12px}.keyboard{margin-top:16px;font-size:11px;color:var(--muted)}.completed{margin-top:10px;padding:10px;border-radius:12px;background:#e7efe3;color:var(--green);font-weight:650}
    .mobile-queue{display:none}
    @media(max-width:1100px){body{overflow:auto}.app{height:auto;min-height:100dvh}header{position:sticky;top:0;z-index:5;grid-template-columns:1fr auto;padding:9px 12px}.brand p{display:none}.progress-line{justify-content:flex-end}.stages{grid-column:1/-1;order:3}.save-state{display:none}main{display:flex;flex-direction:column;min-height:calc(100dvh - 118px);padding:8px}.queue{display:none}.mobile-queue{display:flex;align-items:center;justify-content:space-between;padding:10px 14px}.conversation{min-height:62dvh}.review{position:fixed;z-index:20;left:8px;right:8px;bottom:8px;max-height:min(78dvh,720px);transform:translateY(calc(100% + 20px));transition:transform 180ms ease}.review.open{transform:translateY(0)}.review-close{display:block;float:right;border:0;background:transparent;color:var(--muted)}.mobile-review-toggle{display:block;position:fixed;z-index:15;right:14px;bottom:14px;border:1px solid var(--line-strong);border-radius:999px;background:var(--ink);color:#fff;padding:10px 18px;box-shadow:var(--shadow)}.actions{position:sticky;bottom:0;background:linear-gradient(transparent,var(--paper) 24%);padding-top:20px}.panel{border-radius:16px}}
    @media(max-width:520px){header{grid-template-columns:1fr auto}.brand h1{font-size:17px}.progress-line strong{font-size:18px}.stages{grid-column:1/-1;overflow:visible}.stage{min-width:0;padding:7px}.context-head{padding:13px 14px}.context-head h2{font-size:18px}.dialogue{padding:14px 11px}.bubble{max-width:92%;padding:10px 12px}.review{padding:14px}.actions{grid-template-columns:1fr}.mobile-queue{min-height:52px}}
    @media(prefers-reduced-motion:no-preference){button{transition:transform 120ms ease,background 120ms ease,border-color 120ms ease}button:active{transform:scale(.98)}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div class="brand"><h1>Golden 8 条替换裁决</h1><p>只看新素材 · 原 32 条原样沿用 · 本机自动保存</p></div>
      <div><div class="progress-line" aria-live="polite"><strong id="totalProgress">0/8</strong><span id="retainedProgress">沿用 32/32</span></div><div id="stages" class="stages" aria-label="替换裁决阶段"></div></div>
      <button id="saveState" class="save-state" aria-live="polite"><strong>正在读取进度</strong><span>请稍候</span></button>
    </header>
    <main>
      <aside class="panel queue" aria-label="替换裁决队列">
        <div class="queue-head"><h2 id="queueTitle">Golden A 替换</h2><button id="filterButton" class="filter">只看待评</button></div>
        <p class="queue-note">仅显示本轮 8 条新素材</p>
        <div id="queue" class="queue-list"></div>
      </aside>
      <section class="panel mobile-queue"><button id="previousMobile">上一条</button><strong id="mobilePosition">1 / 3</strong><button id="nextMobile">下一条</button></section>
      <section class="panel conversation" aria-label="对话材料">
        <div class="context-head"><div class="eyebrow" id="itemEyebrow">Golden A 替换 · 第 1 条</div><h2 id="workingTask">读取中</h2></div>
        <div id="dialogue" class="dialogue" tabindex="0"></div>
        <details class="trace"><summary>查看技术 Trace</summary><pre id="trace"></pre></details>
      </section>
      <button id="mobileReviewToggle" class="mobile-review-toggle" aria-haspopup="dialog" aria-expanded="false">裁决此条</button>
      <aside class="panel review" aria-labelledby="reviewTitle">
        <button id="closeReview" class="review-close" aria-label="关闭裁决面板">关闭</button>
        <h2 id="reviewTitle">你的质量结论</h2>
        <p class="review-intro">只判断当前对话与回应。来源、版本和预期标签保持隐藏。</p>
        <div id="verdicts" class="verdicts"></div>
        <div id="details" class="details" hidden>
          <label for="category">主要原因</label><select id="category"></select>
          <label for="reason" style="margin-top:12px">判断理由</label>
          <textarea id="reason" maxlength="300" placeholder="请用 8–300 字说明这条回应具体哪里影响了用户体验"></textarea>
          <div id="reasonCount" class="count">0 / 300</div>
          <label id="blockerLabel" class="blocker"><input id="blocker" type="checkbox" /> 这是单例阻断</label>
        </div>
        <div class="actions"><button id="previous">上一条</button><button id="saveNext" class="primary">保存并下一条</button></div>
        <button id="finalize" class="primary" style="width:100%;margin-top:9px" hidden>保存并交给 Codex</button>
        <p id="completed" class="completed" role="status" hidden></p>
        <p id="error" class="error" role="alert"></p>
        <p class="keyboard">快捷键：←/→ 切换，1–4 选择结论，⌘/Ctrl + Enter 保存。</p>
      </aside>
    </main>
  </div>
  <script src="/gi088-golden-revision-client.js?token=${token}"></script>
</body></html>`;
}

export async function prepareGi088V8r3GoldenRevision() {
  assertEnvironment();
  const repositoryRoot = process.cwd();
  const historicalPrivateRoot =
    process.env.GI088_V8R3_HISTORICAL_ROOT ??
    (repositoryRoot.endsWith("-v8r3")
      ? repositoryRoot.slice(0, -"-v8r3".length)
      : repositoryRoot);
  const parentRoot = resolve(
    repositoryRoot,
    "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-review-workbench"
  );
  const privateRoot = resolve(parentRoot, "revision-1");
  const parent = await readGi088V8r3GoldenRevisionParent({
    receiptPath: resolve(parentRoot, "review-receipt-v1.json"),
    goldenPath: resolve(parentRoot, "judge-golden-v2.json")
  });
  const candidatePath = resolve(
    repositoryRoot,
    "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-offline/human-adjudication-r3.json"
  );
  const hiddenPath = resolve(
    repositoryRoot,
    "artifacts/local-runtime/generative-interview-board7/2026-08-11-gi088-v8r3-offline/private-hidden-admission.json"
  );
  const [replacementRounds, candidatePacket, hiddenCases] = await Promise.all([
    createGi088V8r3GoldenReplacementItems({ historicalPrivateRoot }),
    readGi088CandidateReviewPacket(candidatePath),
    readFile(hiddenPath, "utf8").then((value) =>
      parseGi088V8r3PrivateHiddenFile(JSON.parse(value))
    )
  ]);
  const toolSourcePaths = [
    "scripts/run-gi088-v8r3-golden-revision.ts",
    "public/gi088-golden-revision-client.js",
    "src/features/interview/event-centered/gi088-golden-revision-workbench.ts",
    "src/server/services/evaluation/gi088/golden-revision-service.ts",
    "evals/event-centered-generative/gi088-v8r3-skill-evaluation/review-golden-replacements.ts",
    "src/features/interview/event-centered/gi088-review-workbench.ts"
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
    `${parent.goldenSha256}:${GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION}`
  );
  const bundle = createGi088V8r3GoldenRevisionBundle({
    parent,
    goldenA: replacementRounds[0],
    goldenB: replacementRounds[1],
    seed,
    toolSourceSha256
  });
  assertReplacementSources(bundle, candidatePacket.items, [
    ...GI088_V8R3_DEVELOPMENT_CASES,
    ...hiddenCases
  ]);
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await chmod(privateRoot, 0o700);
  const repository = createGi088V8r3GoldenRevisionRepository({
    root: privateRoot,
    bundle,
    parentGolden: parent.golden
  });
  const existingDraft = await repository.readDraft();
  if (!existingDraft) {
    await repository.saveDraft(createGi088V8r3InitialGoldenRevisionDraft(bundle));
  }
  return { repositoryRoot, privateRoot, bundle, repository };
}

async function main() {
  const prepared = await prepareGi088V8r3GoldenRevision();
  const clientSource = await readFile(
    resolve(prepared.repositoryRoot, "public/gi088-golden-revision-client.js"),
    "utf8"
  );
  const token = randomBytes(32).toString("hex");
  const requestedPort = Number(argumentValue("--port") ?? DEFAULT_PORT);
  if (
    !Number.isInteger(requestedPort) ||
    requestedPort < 1024 ||
    requestedPort > 65_535
  ) {
    throw new Error("GI088_GOLDEN_REVISION_PORT_INVALID");
  }
  const server = createServer(async (request, response) => {
    try {
      if (!authorize(request, token)) {
        json(response, 404, { error: "GI088_GOLDEN_REVISION_NOT_FOUND" });
        return;
      }
      const requestUrl = new URL(request.url ?? "/", `http://${HOST}`);
      if (request.method === "GET" && requestUrl.pathname === "/") {
        html(response, renderPage(token));
        return;
      }
      if (
        request.method === "GET" &&
        requestUrl.pathname === "/gi088-golden-revision-client.js"
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
        requestUrl.pathname ===
          "/api/local/gi088-v8r3/golden-revision-session"
      ) {
        json(response, 200, {
          bundle: prepared.bundle,
          draft:
            (await prepared.repository.readDraft()) ??
            createGi088V8r3InitialGoldenRevisionDraft(prepared.bundle),
          finalized: Boolean(await prepared.repository.readReceipt()),
          lineage: { retained: 32, replaced: 8 },
          network: { databaseCalls: 0, externalModelCalls: 0, uploads: 0 }
        });
        return;
      }
      if (
        request.method === "POST" &&
        requestUrl.pathname ===
          "/api/local/gi088-v8r3/golden-revision-draft"
      ) {
        const draft = (await body(request)) as Gi088GoldenRevisionDraftV1;
        await prepared.repository.saveDraft(draft);
        json(response, 200, { ok: true, savedAt: draft.savedAt });
        return;
      }
      if (
        request.method === "POST" &&
        requestUrl.pathname ===
          "/api/local/gi088-v8r3/golden-revision-finalize"
      ) {
        const draft = (await body(request)) as Gi088GoldenRevisionDraftV1;
        await prepared.repository.saveDraft(draft);
        const receipt = await prepared.repository.finalize(draft);
        json(response, 200, { ok: true, receipt });
        return;
      }
      json(response, 404, { error: "GI088_GOLDEN_REVISION_NOT_FOUND" });
    } catch (error) {
      json(response, 400, {
        error:
          error instanceof Error
            ? error.message
            : "GI088_GOLDEN_REVISION_FAILED"
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
      toolVersion: GI088_V8R3_GOLDEN_REVISION_TOOL_VERSION,
      toolSourceSha256: prepared.bundle.toolSourceSha256,
      bundleFingerprint: prepared.bundle.bundleFingerprint,
      retained: 32,
      replacements: 8,
      goldenA: 3,
      goldenB: 5,
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
    `${error instanceof Error ? error.message : "GI088_GOLDEN_REVISION_START_FAILED"}\n`
  );
  process.exitCode = 1;
});
