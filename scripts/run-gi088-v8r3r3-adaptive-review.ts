import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

import {
  loadGi088AdaptiveRecoveryReview
} from "../src/app/admin/journal-evaluation/adaptive-recovery-review-loader";
import {
  validateLocalReviewLaunchEnvironment
} from "./run-gi088-v8r3-review";

const HOST = "127.0.0.1" as const;
const DEFAULT_PORT = 3108;

export function createAdaptiveRecoveryReviewUrl(port: number, token: string) {
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error("GI088_LOCAL_REVIEW_PORT_INVALID");
  }
  if (token.length < 32) throw new Error("GI088_LOCAL_REVIEW_TOKEN_INVALID");
  return `http://${HOST}:${port}/admin/journal-evaluation/adaptive-recovery?token=${encodeURIComponent(token)}`;
}

async function main() {
  validateLocalReviewLaunchEnvironment();
  const review = await loadGi088AdaptiveRecoveryReview();
  if (review.stage !== "adaptive-recovery" || review.cards.length > 96) {
    throw new Error("GI088_ADAPTIVE_RECOVERY_REVIEW_INPUTS_INVALID");
  }
  const port = Number.parseInt(
    process.env.GI088_REVIEW_PORT ?? `${DEFAULT_PORT}`,
    10
  );
  const token = randomBytes(32).toString("base64url");
  const nextBin = `${process.cwd()}/node_modules/next/dist/bin/next`;
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
  const url = createAdaptiveRecoveryReviewUrl(port, token);
  process.stdout.write(`GI-088 v8r3r3 恢复赢家盲评台：${url}\n`);
  process.stdout.write("仅接受本机访问；关闭此进程即可使令牌失效。\n");
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
