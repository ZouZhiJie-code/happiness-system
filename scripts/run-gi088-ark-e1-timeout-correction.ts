import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  parseBoard7bWorkingTaskV1Output,
  validateBoard7bWorkingTaskV1Output
} from "../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  getAIProviderDiagnostics,
  getAIProviderFailureCode,
  sanitizeAICompletionTokenUsage,
  sanitizeAIProviderDiagnostics
} from "../src/server/services/ai/ai-provider";
import { OpenAIProvider } from "../src/server/services/ai/openai.provider";
import {
  GI088_ARK_PLATFORM_PROBE_RUNTIME,
  createGi088ArkPlatformCompletionParams,
  createGi088ArkPlatformProbePlan
} from "../src/server/services/evaluation/gi088/ark-platform-probe";
import { createGi088OutputSchemaIssues } from "../src/server/services/evaluation/gi088/schema-diagnostics";

const PROBE_VERSION =
  "2026-08-10.gi088-ark-e1-60s-header-correction-v1" as const;
const SOURCE_PATH = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-09-gi088-human-eval-v1/gi088-human-eval-v1-readonly-db-snapshot.json"
);
const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  "artifacts/local-runtime/generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/ark-e1-timeout-correction"
);
const PUBLIC_RESULT_PATH = path.resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-ark-e1-timeout-correction-v1-result.json"
);
const REQUIRED_SCOPE = "ark_e1_timeout_correction";
const REQUIRED_CONFIRMATION = "I_UNDERSTAND_1_CALL";

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeIssues(issues: string[]) {
  return [
    ...new Set(
      issues.map((issue) => {
        const code = issue.split(":", 1)[0] ?? "";
        return /^[A-Z][A-Z0-9_]{0,127}$/u.test(code)
          ? code
          : "VALIDATION_ISSUE";
      })
    )
  ];
}

async function writeJson(filePath: string, value: unknown, mode: number) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode
  });
  await rename(temporaryPath, filePath);
  await chmod(filePath, mode);
}

async function main() {
  const snapshotBytes = await readFile(SOURCE_PATH);
  const snapshot = JSON.parse(snapshotBytes.toString("utf8")) as unknown;
  const sourcePlan = createGi088ArkPlatformProbePlan({
    snapshot,
    snapshotBytes
  });
  const probeCase = sourcePlan.cases.find((item) => item.caseId === "E1");
  if (!probeCase) throw new Error("GI088_ARK_E1_CASE_NOT_FOUND");
  const params = {
    ...createGi088ArkPlatformCompletionParams(probeCase),
    headersTimeoutMs: 60_000,
    bodyIdleTimeoutMs: 60_000,
    hardTimeoutMs: 60_000
  };
  const requestHash = sha256(
    JSON.stringify({
      baseUrl: GI088_ARK_PLATFORM_PROBE_RUNTIME.baseUrl,
      model: GI088_ARK_PLATFORM_PROBE_RUNTIME.model,
      params
    })
  );
  const probeFingerprint = sha256(
    JSON.stringify({
      probeVersion: PROBE_VERSION,
      sourceProbeFingerprint: sourcePlan.probeFingerprint,
      sourceCaseId: probeCase.caseId,
      sourceCallId: probeCase.sourceCallId,
      sourceRequestHash: probeCase.sourceRequestHash,
      requestHash,
      timeoutPolicy: {
        headersTimeoutMs: 60_000,
        bodyIdleTimeoutMs: 60_000,
        hardTimeoutMs: 60_000
      },
      automaticRetries: 0,
      fallbackCalls: 0,
      publicPrivacy: {
        userContent: "excluded",
        prompt: "hash_only",
        rawOutput: "excluded",
        reasoningBody: "excluded"
      }
    })
  );
  const publicPlan = {
    probeVersion: PROBE_VERSION,
    probeFingerprint,
    sourceProbeFingerprint: sourcePlan.probeFingerprint,
    sourceCaseId: probeCase.caseId,
    sourceCallId: probeCase.sourceCallId,
    sourceRequestHash: probeCase.sourceRequestHash,
    requestHash,
    runtime: {
      ...GI088_ARK_PLATFORM_PROBE_RUNTIME,
      headersTimeoutMs: 60_000,
      bodyIdleTimeoutMs: 60_000,
      hardTimeoutMs: 60_000
    },
    authorizedCallBudget: 1,
    modelGenerationCalls: 0,
    executionAuthorized: false
  };
  if (!process.argv.includes("--execute")) {
    process.stdout.write(`${JSON.stringify(publicPlan, null, 2)}\n`);
    return;
  }
  if (
    process.env.GI088_MODEL_CALL_SCOPE !== REQUIRED_SCOPE ||
    process.env.GI088_AUTHORIZED_ARK_E1_CORRECTION_FINGERPRINT !==
      probeFingerprint ||
    process.env.GI088_ARK_E1_CORRECTION_CONFIRMATION !==
      REQUIRED_CONFIRMATION ||
    process.env.GI088_ARK_E1_CORRECTION_AUTHORIZED_BUDGET !== "1" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("GI088_ARK_E1_CORRECTION_NOT_AUTHORIZED");
  }
  const runDirectory = path.join(OUTPUT_ROOT, probeFingerprint);
  await mkdir(runDirectory, { recursive: true, mode: 0o700 });
  await chmod(runDirectory, 0o700);
  const lockPath = path.join(runDirectory, "run.lock");
  const lock = await open(lockPath, "wx", 0o600).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("GI088_ARK_E1_CORRECTION_RUN_LOCKED");
    }
    throw error;
  });
  let completed = false;
  const ledgerPath = path.join(runDirectory, "private-ledger.json");
  try {
    await writeJson(
      ledgerPath,
      {
        ...publicPlan,
        executionAuthorized: true,
        status: "reserved",
        reservedAt: new Date().toISOString()
      },
      0o600
    );
    loadEnvConfig(process.cwd());
    const apiKey =
      process.env.VOLCENGINE_ARK_API_KEY?.trim() ||
      process.env.ARK_API_KEY?.trim();
    if (!apiKey) throw new Error("GI088_ARK_PLATFORM_API_KEY_MISSING");
    const provider = new OpenAIProvider({
      apiKey,
      model: GI088_ARK_PLATFORM_PROBE_RUNTIME.model,
      baseUrl: GI088_ARK_PLATFORM_PROBE_RUNTIME.baseUrl
    });
    let result: Record<string, unknown>;
    try {
      const completion = await provider.complete(params);
      let validationIssues: string[] = [];
      try {
        const output = parseBoard7bWorkingTaskV1Output(completion.content);
        validationIssues = validateBoard7bWorkingTaskV1Output({
          input: probeCase.turnInput,
          output
        });
      } catch (error) {
        validationIssues = createGi088OutputSchemaIssues(error);
      }
      result = {
        status: validationIssues.length ? "protected_failure" : "valid",
        errorCode: validationIssues.length ? "MODEL_OUTPUT_PROTECTED" : null,
        responseHash: sha256(completion.content),
        validationIssues: sanitizeIssues(validationIssues),
        latencyMs: completion.latencyMs,
        tokenUsage: sanitizeAICompletionTokenUsage(completion.tokenUsage),
        providerDiagnostics: (() => {
          const diagnostics = sanitizeAIProviderDiagnostics(
            completion.diagnostics
          );
          return diagnostics
            ? {
                ...diagnostics,
                upstreamRequestId: diagnostics.upstreamRequestId
                  ? sha256(diagnostics.upstreamRequestId)
                  : null
              }
            : null;
        })()
      };
    } catch (error) {
      result = {
        status: "technical_failure",
        errorCode: getAIProviderFailureCode(error),
        responseHash: null,
        validationIssues: [],
        latencyMs: getAIProviderDiagnostics(error)?.latencyMs ?? null,
        tokenUsage: sanitizeAICompletionTokenUsage(
          getAIProviderDiagnostics(error)?.tokenUsage
        ),
        providerDiagnostics: (() => {
          const diagnostics = sanitizeAIProviderDiagnostics(
            getAIProviderDiagnostics(error)
          );
          return diagnostics
            ? {
                ...diagnostics,
                upstreamRequestId: diagnostics.upstreamRequestId
                  ? sha256(diagnostics.upstreamRequestId)
                  : null
              }
            : null;
        })()
      };
    }
    const publicResult = {
      ...publicPlan,
      executionAuthorized: true,
      modelGenerationCalls: 1,
      completedAt: new Date().toISOString(),
      result
    };
    await writeJson(
      ledgerPath,
      { ...publicResult, status: "completed" },
      0o600
    );
    await writeJson(PUBLIC_RESULT_PATH, publicResult, 0o644);
    completed = true;
    process.stdout.write(
      `${JSON.stringify({
        probeVersion: PROBE_VERSION,
        probeFingerprint,
        modelGenerationCalls: 1,
        result,
        publicResultPath: PUBLIC_RESULT_PATH
      })}\n`
    );
  } finally {
    await lock.close();
    if (completed) await unlink(lockPath).catch(() => undefined);
  }
}

if (process.env.VITEST !== "true") {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "GI088_ARK_E1_CORRECTION_FAILED"}\n`
    );
    process.exitCode = 1;
  });
}
