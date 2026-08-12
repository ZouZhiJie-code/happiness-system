import { loadEnvConfig } from "@next/env";

import { OpenAIProvider } from "@/server/services/ai/openai.provider";
import {
  createGi088FingerprintBundle
} from "@/server/services/evaluation/gi088/candidate";
import {
  createGi088ArkProvider,
  resolveGi088ArkRuntimeConfig
} from "@/server/services/evaluation/gi088/ark-runtime";
import { GI088_V8R3_DEVELOPMENT_CASES } from "../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS,
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM,
  GI088_RUNTIME_CONTRACT_DIAGNOSTIC_VERSION,
  createGi088RuntimeContractDiagnosticFingerprint,
  createGi088RuntimeContractSchedule
} from "../evals/event-centered-generative/gi088-runtime-contract-root-cause/contracts";
import {
  executeGi088RuntimeContractDiagnostic,
  writeGi088RuntimeContractDiagnosticArtifacts,
  type Gi088RuntimeContractProviderSet
} from "../evals/event-centered-generative/gi088-runtime-contract-root-cause/runner";

const AUTHORIZATION_ENV = "GI088_ROOT_CAUSE_DIAGNOSTIC_MODEL_CALLS";
const AUTHORIZATION_VALUE = "I_UNDERSTAND_MODEL_CALLS";
const BUDGET_ENV = "GI088_ROOT_CAUSE_DIAGNOSTIC_CALL_BUDGET";

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/^['"]|['"]$/gu, "") : null;
}

export function validateGi088RuntimeContractDiagnosticEnvironment(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("GI088_RUNTIME_CONTRACT_DIAGNOSTIC_PRODUCTION_FORBIDDEN");
  }
  const ark = resolveGi088ArkRuntimeConfig(env);
  if (
    ark.summary.provider !== "volcengine_ark" ||
    ark.summary.transport !== "openai_compatible_rest" ||
    ark.summary.baseUrlHost !== "ark.cn-beijing.volces.com" ||
    ark.summary.endpoint !== "/chat/completions" ||
    ark.summary.model !== "deepseek-v4-flash-ga-260731"
  ) {
    throw new Error("GI088_RUNTIME_CONTRACT_ARK_IDENTITY_MISMATCH");
  }
  const officialApiKey = trimEnv(env.DEEPSEEK_API_KEY);
  if (!officialApiKey) {
    throw new Error("GI088_RUNTIME_CONTRACT_DEEPSEEK_API_KEY_MISSING");
  }
  const configuredBaseUrl = trimEnv(env.DEEPSEEK_BASE_URL) ??
    "https://api.deepseek.com";
  let normalizedBaseUrl: string;
  try {
    normalizedBaseUrl = new URL(configuredBaseUrl)
      .toString()
      .replace(/\/$/u, "");
  } catch {
    throw new Error("GI088_RUNTIME_CONTRACT_DEEPSEEK_IDENTITY_MISMATCH");
  }
  if (normalizedBaseUrl !== "https://api.deepseek.com") {
    throw new Error("GI088_RUNTIME_CONTRACT_DEEPSEEK_IDENTITY_MISMATCH");
  }
  return {
    ark,
    official: {
      apiKey: officialApiKey,
      baseUrl: normalizedBaseUrl,
      transport: "openai_compatible_rest" as const,
      baseUrlHost: "api.deepseek.com" as const,
      endpoint: "/chat/completions" as const
    }
  };
}

export function assertGi088RuntimeContractDiagnosticAuthorization(
  env: NodeJS.ProcessEnv = process.env
) {
  if (
    env[AUTHORIZATION_ENV]?.trim() !== AUTHORIZATION_VALUE ||
    env[BUDGET_ENV]?.trim() !==
      String(GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM)
  ) {
    throw new Error("GI088_RUNTIME_CONTRACT_DIAGNOSTIC_AUTHORIZATION_REQUIRED");
  }
}

export function createGi088RuntimeContractProviders(
  env: NodeJS.ProcessEnv = process.env
): Gi088RuntimeContractProviderSet {
  const resolved = validateGi088RuntimeContractDiagnosticEnvironment(env);
  const ark = createGi088ArkProvider(env);
  const officialFlash = new OpenAIProvider({
    apiKey: resolved.official.apiKey,
    baseUrl: resolved.official.baseUrl,
    model: "deepseek-v4-flash",
    timeoutMs: 60_000
  });
  return {
    A: ark,
    B: ark,
    C: ark,
    D: officialFlash,
    createE: () => new OpenAIProvider({
      apiKey: resolved.official.apiKey,
      baseUrl: resolved.official.baseUrl,
      model: "deepseek-v4-pro",
      timeoutMs: 60_000
    })
  };
}

function readPublicDevelopmentCases() {
  const cases = GI088_V8R3_DEVELOPMENT_CASES.filter((evaluationCase) =>
    /^GI088-V8R3-D(?:0[1-9]|1\d|2[0-4])$/u.test(evaluationCase.id)
  );
  if (cases.length !== 24 || cases.some((item) => item.kind !== "single_turn")) {
    throw new Error("GI088_RUNTIME_CONTRACT_PUBLIC_CASES_INVALID");
  }
  return cases;
}

function readFingerprintBundle() {
  const bundle = createGi088FingerprintBundle();
  return {
    candidateFingerprint: bundle.candidateFingerprint,
    datasetFingerprint: bundle.datasetFingerprint,
    runnerFingerprint: bundle.runnerFingerprint,
    experienceFingerprint: bundle.experienceFingerprint,
    executionFingerprint: bundle.executionFingerprint
  };
}

async function main() {
  loadEnvConfig(process.cwd());
  const cases = readPublicDevelopmentCases();
  const fingerprints = readFingerprintBundle();
  const schedule = createGi088RuntimeContractSchedule(cases);
  const diagnosticFingerprint = createGi088RuntimeContractDiagnosticFingerprint({
    cases,
    globalFingerprintBundle: fingerprints
  });
  if (!process.argv.includes("--execute")) {
    process.stdout.write(`${JSON.stringify({
      diagnosticVersion: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_VERSION,
      diagnosticFingerprint,
      publicDevelopmentCases: cases.length,
      hiddenDatasetRead: false,
      primaryCalls: GI088_RUNTIME_CONTRACT_DIAGNOSTIC_INITIAL_CALLS,
      conditionalMaximumCalls:
        GI088_RUNTIME_CONTRACT_DIAGNOSTIC_TOTAL_CALLS_MAXIMUM,
      retries: 0,
      recoveries: 0,
      judgeCalls: 0,
      concurrency: 2,
      scheduleFingerprint: schedule.scheduleFingerprint,
      globalRuntimeFingerprints: fingerprints,
      externalModelCalls: 0
    }, null, 2)}\n`);
    return;
  }
  assertGi088RuntimeContractDiagnosticAuthorization();
  const providers = createGi088RuntimeContractProviders();
  const report = await executeGi088RuntimeContractDiagnostic({
    cases,
    providers,
    globalFingerprintBundleBefore: fingerprints,
    readGlobalFingerprintBundleAfter: readFingerprintBundle
  });
  const paths = await writeGi088RuntimeContractDiagnosticArtifacts({ report });
  process.stdout.write(`${JSON.stringify({
    diagnosticVersion: report.diagnosticVersion,
    diagnosticFingerprint: report.diagnosticFingerprint,
    reportFingerprint: report.reportFingerprint,
    totalCalls: report.budget.totalCalls,
    conditionalProTriggered: report.decision.conditionalProTriggered,
    groups: report.groups.map((group) => ({
      group: group.group,
      effectiveValid: group.effectiveValidCount,
      emptyContent: group.emptyContentCount,
      p90Ms: group.latency.p90Ms,
      admitted: group.admitted
    })),
    shortlistedGroups: report.decision.shortlistedGroups,
    decision: report.decision.status,
    globalRuntimeFingerprintsUnchanged:
      report.globalRuntimeFingerprintsUnchanged,
    privateReportPath: paths.privateReportPath,
    publicSummaryPath: paths.publicSummaryPath
  }, null, 2)}\n`);
}

if (process.argv.includes("--run")) await main();
