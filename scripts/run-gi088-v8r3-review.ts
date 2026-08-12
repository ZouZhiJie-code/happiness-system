import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 3108;

export function validateLocalReviewLaunchEnvironment(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV) {
    throw new Error("GI088_LOCAL_REVIEW_PRODUCTION_FORBIDDEN");
  }
  if (env.JOURNAL_EVALUATION_LOCAL_ENABLED !== "I_UNDERSTAND") {
    throw new Error("GI088_LOCAL_REVIEW_CONFIRMATION_REQUIRED");
  }
  for (const name of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const raw = env[name];
    if (!raw) throw new Error("GI088_LOCAL_REVIEW_DATABASE_REQUIRED");
    const url = new URL(raw);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.pathname.replace(/^\//u, "") !== "happiness_system_codex" ||
      url.searchParams.get("schema") !== "journal_daily_eval"
    ) {
      throw new Error("GI088_LOCAL_REVIEW_DATABASE_NOT_LOCAL");
    }
  }
  const privateRoot = resolve(
    env.PWD ?? process.cwd(),
    "artifacts/journal-generation-evaluation/.private/formal/golden-eight"
  );
  return { privateRoot };
}

export function createLocalReviewUrl(port: number, token: string) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("GI088_LOCAL_REVIEW_PORT_INVALID");
  }
  if (!token || token.length < 32) throw new Error("GI088_LOCAL_REVIEW_TOKEN_INVALID");
  return `http://${HOST}:${port}/admin/journal-evaluation/golden-eight?token=${encodeURIComponent(token)}`;
}

async function main() {
  const { privateRoot } = validateLocalReviewLaunchEnvironment();
  await access(privateRoot);
  const port = Number.parseInt(process.env.GI088_REVIEW_PORT ?? `${DEFAULT_PORT}`, 10);
  const token = randomBytes(32).toString("base64url");
  const nextBin = resolve(process.cwd(), "node_modules/next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev", "--hostname", HOST, "--port", `${port}`], {
    env: {
      ...process.env,
      JOURNAL_EVALUATION_LOCAL_ENABLED: "I_UNDERSTAND",
      GI088_V8R3_REVIEW_TOKEN: token
    },
    stdio: "inherit"
  });
  const url = createLocalReviewUrl(port, token);
  process.stdout.write(`GI-088 v8r3 本机裁决台：${url}\n`);
  process.stdout.write("仅接受本机访问；关闭此进程即可使令牌失效。\n");
  if (process.platform === "darwin" && process.env.GI088_REVIEW_NO_BROWSER !== "1") {
    const browser = spawn("open", [url], { stdio: "ignore", detached: true });
    browser.unref();
  }
  const stop = (signal: NodeJS.Signals) => {
    child.kill(signal);
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

if (process.argv.some((arg) => arg === "--run")) {
  await main();
}
