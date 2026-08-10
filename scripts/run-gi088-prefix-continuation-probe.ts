import { createHash } from "node:crypto";
import { chmod, mkdir, open, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import { sanitizeAIProviderDiagnostics } from "../src/server/services/ai/ai-provider";
import {
  GI088_PREFIX_PROBE_CALL_BUDGET,
  GI088_PREFIX_PROBE_SYNTHETIC_REASONING,
  GI088_PREFIX_PROBE_USER_MESSAGE,
  createGi088PrefixProbePlan
} from "../src/server/services/evaluation/gi088/prefix-continuation-probe";

const execute = process.argv.includes("--execute");
const outputRoot = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/prefix-compatibility-probe"
);

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assertAuthorization(fingerprint: string) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("GI088_PREFIX_PROBE_PRODUCTION_FORBIDDEN");
  }
  if (process.env.GI088_MODEL_CALL_SCOPE !== "prefix_continuation_probe") {
    throw new Error("GI088_PREFIX_PROBE_SCOPE_NOT_AUTHORIZED");
  }
  if (process.env.GI088_AUTHORIZED_PREFIX_PROBE_FINGERPRINT !== fingerprint) {
    throw new Error("GI088_PREFIX_PROBE_FINGERPRINT_NOT_AUTHORIZED");
  }
  if (process.env.GI088_PREFIX_PROBE_CONFIRMATION !== "I_UNDERSTAND_1_CALL") {
    throw new Error("GI088_PREFIX_PROBE_CONFIRMATION_REQUIRED");
  }
  if (process.env.GI088_PREFIX_PROBE_AUTHORIZED_BUDGET !== String(GI088_PREFIX_PROBE_CALL_BUDGET)) {
    throw new Error("GI088_PREFIX_PROBE_BUDGET_NOT_AUTHORIZED");
  }
}

async function writePrivateJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

async function main() {
  loadEnvConfig(process.cwd());
  const plan = createGi088PrefixProbePlan();
  if (!execute) {
    process.stdout.write(`${JSON.stringify({
      ...plan,
      modelGenerationCalls: 0,
      executionAuthorized: false
    }, null, 2)}\n`);
    return;
  }
  assertAuthorization(plan.probeFingerprint);
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("GI088_PREFIX_PROBE_API_KEY_MISSING");
  const resultPath = path.join(outputRoot, `${plan.probeFingerprint}.json`);
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const reservationPath = path.join(outputRoot, `${plan.probeFingerprint}.reserved`);
  const reservation = await open(reservationPath, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new Error("GI088_PREFIX_PROBE_ALREADY_RESERVED");
    throw error;
  });
  await reservation.writeFile(`${JSON.stringify({
    probeFingerprint: plan.probeFingerprint,
    status: "reserved",
    reservedAt: new Date().toISOString(),
    authorizedCallBudget: 1
  })}\n`, "utf8");
  await reservation.close();
  const provider = new OpenAIProvider({
    apiKey,
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com"
  });
  try {
    const completion = await provider.runSyntheticDeepSeekPrefixProbe({
      messages: [{ role: "user", content: GI088_PREFIX_PROBE_USER_MESSAGE }],
      reasoningContent: GI088_PREFIX_PROBE_SYNTHETIC_REASONING,
      visiblePrefix: "{",
      sharedHardTimeoutMs: 60_000
    });
    let jsonShapeValid = false;
    try {
      const parsed = JSON.parse(completion.content) as unknown;
      jsonShapeValid = Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
    } catch {
      jsonShapeValid = false;
    }
    await writePrivateJson(resultPath, {
      probeVersion: plan.probeVersion,
      probeFingerprint: plan.probeFingerprint,
      status: jsonShapeValid ? "passed" : "failed",
      completedAt: new Date().toISOString(),
      modelGenerationCalls: 1,
      automaticRetries: 0,
      fallbackCalls: 0,
      jsonShapeValid,
      responseHash: sha256(completion.content),
      responseLength: completion.content.length,
      diagnostics: sanitizeAIProviderDiagnostics(completion.diagnostics)
    });
    process.stdout.write(`${JSON.stringify({
      probeFingerprint: plan.probeFingerprint,
      status: jsonShapeValid ? "passed" : "failed",
      modelGenerationCalls: 1,
      resultPath,
      jsonShapeValid
    }, null, 2)}\n`);
    if (!jsonShapeValid) process.exitCode = 1;
  } catch (error) {
    await writePrivateJson(resultPath, {
      probeVersion: plan.probeVersion,
      probeFingerprint: plan.probeFingerprint,
      status: "failed",
      completedAt: new Date().toISOString(),
      modelGenerationCalls: 1,
      automaticRetries: 0,
      fallbackCalls: 0,
      errorCode: error instanceof Error && "code" in error
        ? String((error as { code?: unknown }).code ?? error.name)
        : error instanceof Error ? error.name : "UNKNOWN_ERROR"
    });
    throw error;
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "GI088_PREFIX_PROBE_FAILED"}\n`);
  process.exitCode = 1;
});
