import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

import {
  loadGi088ProContractDevelopmentReview,
  loadGi088ProContractHiddenReview
} from "../src/app/admin/journal-evaluation/pro-contract-review-loader";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
  GI088_PRO_CONTRACT_HIDDEN_STAGE,
  type Gi088ProContractReviewStage
} from "../src/server/services/evaluation/gi088/pro-contract-review-contract";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 3108;

export function validateGi088ProContractReviewLaunchEnvironment(
  env: NodeJS.ProcessEnv = process.env
) {
  if (
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV ||
    env.JOURNAL_EVALUATION_LOCAL_ENABLED !== "I_UNDERSTAND"
  ) throw new Error("GI088_PRO_CONTRACT_LOCAL_REVIEW_PRODUCTION_FORBIDDEN");
  for (const name of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const raw = env[name];
    if (!raw) throw new Error("GI088_PRO_CONTRACT_LOCAL_REVIEW_DATABASE_REQUIRED");
    const url = new URL(raw);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.pathname.replace(/^\//u, "") !== "happiness_system_codex" ||
      url.searchParams.get("schema") !== "journal_daily_eval"
    ) throw new Error("GI088_PRO_CONTRACT_LOCAL_REVIEW_DATABASE_NOT_LOCAL");
  }
}

export function parseGi088ProContractReviewStage(value?: string): Gi088ProContractReviewStage {
  if (!value || value === GI088_PRO_CONTRACT_DEVELOPMENT_STAGE) {
    return GI088_PRO_CONTRACT_DEVELOPMENT_STAGE;
  }
  if (value === GI088_PRO_CONTRACT_HIDDEN_STAGE) return value;
  throw new Error("GI088_PRO_CONTRACT_LOCAL_REVIEW_STAGE_INVALID");
}

export function createGi088ProContractReviewUrl(
  port: number,
  token: string,
  stage: Gi088ProContractReviewStage
) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("GI088_PRO_CONTRACT_LOCAL_REVIEW_PORT_INVALID");
  }
  if (!token || token.length < 32) {
    throw new Error("GI088_PRO_CONTRACT_LOCAL_REVIEW_TOKEN_INVALID");
  }
  return `http://${HOST}:${port}/admin/journal-evaluation/adaptive-recovery/pro-contract-review?stage=${stage}&token=${encodeURIComponent(token)}`;
}

async function main() {
  validateGi088ProContractReviewLaunchEnvironment();
  const stage = parseGi088ProContractReviewStage(
    process.env.GI088_PRO_CONTRACT_REVIEW_STAGE ?? process.argv.find((arg) => arg.startsWith("--stage="))?.slice(8)
  );
  const review = stage === GI088_PRO_CONTRACT_DEVELOPMENT_STAGE
    ? await loadGi088ProContractDevelopmentReview()
    : await loadGi088ProContractHiddenReview();
  const expectedCount = stage === GI088_PRO_CONTRACT_DEVELOPMENT_STAGE ? 16 : 32;
  if (review.stage !== stage || review.cards.length !== expectedCount) {
    throw new Error("GI088_PRO_CONTRACT_LOCAL_REVIEW_INPUTS_INVALID");
  }
  const port = Number.parseInt(
    process.env.GI088_PRO_CONTRACT_REVIEW_PORT ?? `${DEFAULT_PORT}`,
    10
  );
  const token = randomBytes(32).toString("base64url");
  const nextBin = resolve(process.cwd(), "node_modules/next/dist/bin/next");
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", HOST, "--port", `${port}`],
    {
      env: {
        ...process.env,
        JOURNAL_EVALUATION_LOCAL_ENABLED: "I_UNDERSTAND",
        GI088_V8R3_REVIEW_TOKEN: token
      },
      stdio: "inherit"
    }
  );
  const url = createGi088ProContractReviewUrl(port, token, stage);
  process.stdout.write(`GI-088 Pro 合同验证裁决台：${url}\n`);
  process.stdout.write("仅接受本机访问；关闭此进程即可使一次性令牌失效。\n");
  if (process.platform === "darwin" && process.env.GI088_REVIEW_NO_BROWSER !== "1") {
    const browser = spawn("open", [url], { stdio: "ignore", detached: true });
    browser.unref();
  }
  const stop = (signal: NodeJS.Signals) => child.kill(signal);
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

if (process.argv.includes("--run")) await main();
