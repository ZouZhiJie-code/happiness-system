import { execFile } from "node:child_process";
import { access, chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  GI088_JOURNAL_CALIBRATION_BUDGET,
  GI088_JOURNAL_CALIBRATION_MODELS,
  GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT,
  sha256Canonical,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderPreflight
} from "./gi088-calibration-contract";
import {
  createGi088MockCalibrationProvider,
  createGi088OpenAICompatibleCalibrationProvider
} from "./gi088-calibration-provider";
import {
  createGi088CalibrationDryRunPlan,
  runGi088JournalCalibration
} from "./gi088-calibration-runner";

export interface Gi088CalibrationCliOptions {
  mode: "dry-run" | "mock" | "real";
  confirmPrivateReplay: boolean;
  maxCalls: number;
  maxCallsExplicit: boolean;
  confirmScopeFingerprint: string | null;
  outputPath: string;
  identityOutputPath: string;
}

const DEFAULT_PRIVATE_DIR =
  "artifacts/journal-generation-evaluation/.private" as const;
const KEYCHAIN_ACCOUNT = "board7a" as const;
const KEYCHAIN_SERVICE = "com.dailylight.local-eval.deepseek" as const;
const DEEPSEEK_MODELS_ENDPOINT = "https://api.deepseek.com/models" as const;
const execFileAsync = promisify(execFile);

export interface Gi088CalibrationCredential {
  apiKey: string;
  source: "process_environment" | "macos_keychain";
}

export async function resolveGi088CalibrationCredential(
  env: NodeJS.ProcessEnv = process.env,
  readKeychain: () => Promise<string> = async () => {
    const { stdout } = await execFileAsync(
      "/usr/bin/security",
      [
        "find-generic-password",
        "-a",
        KEYCHAIN_ACCOUNT,
        "-s",
        KEYCHAIN_SERVICE,
        "-w"
      ],
      { encoding: "utf8" }
    );
    return stdout;
  }
): Promise<Gi088CalibrationCredential> {
  const environmentKey = env.DEEPSEEK_API_KEY?.trim();
  if (environmentKey) {
    return { apiKey: environmentKey, source: "process_environment" };
  }
  try {
    const keychainKey = (await readKeychain()).trim();
    if (keychainKey) {
      return { apiKey: keychainKey, source: "macos_keychain" };
    }
  } catch {
    // 凭据读取错误统一收敛为安全错误码，不回显命令输出。
  }
  throw new Error("GI088_JOURNAL_CALIBRATION_DEEPSEEK_API_KEY_REQUIRED");
}

export async function validateGi088CalibrationModels(input: {
  apiKey: string;
  credentialSource: Gi088CalibrationCredential["source"];
  fetcher?: typeof fetch;
  performedAt?: string;
}): Promise<Gi088CalibrationProviderPreflight> {
  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)(DEEPSEEK_MODELS_ENDPOINT, {
      method: "GET",
      headers: { Authorization: `Bearer ${input.apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new Error("GI088_JOURNAL_CALIBRATION_MODELS_PREFLIGHT_UNREACHABLE");
  }
  if (!response.ok) {
    throw new Error(
      `GI088_JOURNAL_CALIBRATION_MODELS_PREFLIGHT_HTTP_${response.status}`
    );
  }
  let body: unknown;
  try {
    body = await response.json() as unknown;
  } catch {
    throw new Error("GI088_JOURNAL_CALIBRATION_MODELS_PREFLIGHT_JSON_INVALID");
  }
  const modelIds = body && typeof body === "object" && "data" in body &&
    Array.isArray(body.data)
    ? body.data.flatMap((item) =>
        item && typeof item === "object" && "id" in item &&
        typeof item.id === "string"
          ? [item.id]
          : []
      )
    : [];
  const requiredModels = GI088_JOURNAL_CALIBRATION_MODELS.map(
    (model) => model.model
  );
  const missingModels = requiredModels.filter((model) => !modelIds.includes(model));
  if (missingModels.length > 0) {
    throw new Error(
      `GI088_JOURNAL_CALIBRATION_REQUIRED_MODELS_UNAVAILABLE:${missingModels.join(",")}`
    );
  }
  return {
    endpoint: DEEPSEEK_MODELS_ENDPOINT,
    performed_at: input.performedAt ?? new Date().toISOString(),
    required_models: [...requiredModels],
    required_models_available: true,
    available_model_ids_sha256: sha256Canonical([...new Set(modelIds)].sort()),
    credential_source: input.credentialSource
  };
}

type CalibrationRunner = typeof runGi088JournalCalibration;

export interface Gi088CalibrationCliDependencies {
  resolveCredential: (
    env: NodeJS.ProcessEnv
  ) => Promise<Gi088CalibrationCredential>;
  validateModels: (input: {
    apiKey: string;
    credentialSource: Gi088CalibrationCredential["source"];
  }) => Promise<Gi088CalibrationProviderPreflight>;
  createRealProvider: (input: { apiKey: string }) => Gi088CalibrationProvider;
  runCalibration: CalibrationRunner;
}

export function parseGi088CalibrationArgs(
  argv: string[],
  projectRoot = process.cwd()
): Gi088CalibrationCliOptions {
  const options: Gi088CalibrationCliOptions = {
    mode: "dry-run",
    confirmPrivateReplay: false,
    maxCalls: GI088_JOURNAL_CALIBRATION_BUDGET.maxModelCalls,
    maxCallsExplicit: false,
    confirmScopeFingerprint: null,
    outputPath: resolve(projectRoot, DEFAULT_PRIVATE_DIR, "candidate-packets.json"),
    identityOutputPath: resolve(
      projectRoot,
      DEFAULT_PRIVATE_DIR,
      "candidate-identity-map.json"
    )
  };
  let modeExplicit = false;
  let outputExplicit = false;
  let identityOutputExplicit = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute-mock" || argument === "--execute-real") {
      if (modeExplicit) throw new Error("GI088_JOURNAL_CALIBRATION_MODE_DUPLICATE");
      options.mode = argument === "--execute-real" ? "real" : "mock";
      modeExplicit = true;
    } else if (argument === "--confirm-private-replay") {
      options.confirmPrivateReplay = true;
    } else if (argument === "--max-calls" && argv[index + 1]) {
      options.maxCalls = Number(argv[index + 1]);
      options.maxCallsExplicit = true;
      index += 1;
    } else if (argument === "--confirm-scope" && argv[index + 1]) {
      options.confirmScopeFingerprint = argv[index + 1];
      index += 1;
    } else if (argument === "--output" && argv[index + 1]) {
      options.outputPath = resolve(projectRoot, argv[index + 1]);
      outputExplicit = true;
      index += 1;
    } else if (argument === "--identity-output" && argv[index + 1]) {
      options.identityOutputPath = resolve(projectRoot, argv[index + 1]);
      identityOutputExplicit = true;
      index += 1;
    } else {
      throw new Error(`GI088_JOURNAL_CALIBRATION_ARGUMENT_INVALID:${argument}`);
    }
  }
  if (options.mode === "mock") {
    if (!outputExplicit) {
      options.outputPath = resolve(
        projectRoot,
        DEFAULT_PRIVATE_DIR,
        "mock-candidate-packets.json"
      );
    }
    if (!identityOutputExplicit) {
      options.identityOutputPath = resolve(
        projectRoot,
        DEFAULT_PRIVATE_DIR,
        "mock-candidate-identity-map.json"
      );
    }
    if (
      !basename(options.outputPath).toLowerCase().includes("mock") ||
      !basename(options.identityOutputPath).toLowerCase().includes("mock")
    ) {
      throw new Error("GI088_JOURNAL_CALIBRATION_MOCK_OUTPUT_NAME_REQUIRED");
    }
  }
  if (options.mode === "real") {
    if (!options.confirmPrivateReplay) {
      throw new Error("GI088_JOURNAL_CALIBRATION_PRIVATE_REPLAY_CONFIRMATION_REQUIRED");
    }
    if (!options.maxCallsExplicit || options.maxCalls !== 24) {
      throw new Error("GI088_JOURNAL_CALIBRATION_REAL_MAX_CALLS_24_CONFIRMATION_REQUIRED");
    }
    if (options.confirmScopeFingerprint !== GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT) {
      throw new Error("GI088_JOURNAL_CALIBRATION_SCOPE_CONFIRMATION_REQUIRED");
    }
  }
  if (!Number.isInteger(options.maxCalls) || options.maxCalls !== 24) {
    throw new Error("GI088_JOURNAL_CALIBRATION_MAX_CALLS_MUST_EQUAL_24");
  }
  return options;
}

function assertPrivateOutputPath(path: string) {
  if (!resolve(path).split(sep).includes(".private")) {
    throw new Error("GI088_JOURNAL_CALIBRATION_PRIVATE_OUTPUT_REQUIRED");
  }
}

async function writePrivateJson(path: string, value: unknown, flag: "w" | "wx" = "w") {
  assertPrivateOutputPath(path);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag
  });
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function runGi088CalibrationCli(
  options: Gi088CalibrationCliOptions,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: Partial<Gi088CalibrationCliDependencies> = {}
) {
  if (options.mode === "dry-run") {
    return { plan: createGi088CalibrationDryRunPlan(), outputWritten: false };
  }
  assertPrivateOutputPath(options.outputPath);
  assertPrivateOutputPath(options.identityOutputPath);

  let provider: Gi088CalibrationProvider;
  let lockPath: string | null = null;
  let providerPreflight: Gi088CalibrationProviderPreflight | undefined;
  if (options.mode === "real") {
    if (
      await pathExists(options.outputPath) ||
      await pathExists(options.identityOutputPath)
    ) {
      throw new Error("GI088_JOURNAL_CALIBRATION_SUCCESS_PACKAGE_ALREADY_EXISTS");
    }
    const credential = await (
      dependencies.resolveCredential ?? resolveGi088CalibrationCredential
    )(env);
    providerPreflight = await (
      dependencies.validateModels ?? validateGi088CalibrationModels
    )({
      apiKey: credential.apiKey,
      credentialSource: credential.source
    });
    provider = (
      dependencies.createRealProvider ??
      createGi088OpenAICompatibleCalibrationProvider
    )({ apiKey: credential.apiKey });
    lockPath = resolve(dirname(options.outputPath), "gi088-calibration-real-run.lock.json");
    await writePrivateJson(lockPath, {
      status: "reserved",
      confirmation: {
        private_replay: true,
        max_calls: options.maxCalls,
        scope_fingerprint: options.confirmScopeFingerprint
      }
    }, "wx");
  } else {
    provider = createGi088MockCalibrationProvider();
  }
  let observedProviderCalls = 0;
  let identityWritten = false;
  let outputWritten = false;
  const countedProvider = {
    kind: provider.kind,
    name: provider.name,
    async complete(request: Parameters<typeof provider.complete>[0]) {
      observedProviderCalls += 1;
      return provider.complete(request);
    }
  };

  try {
    const result = await (
      dependencies.runCalibration ?? runGi088JournalCalibration
    )({
      mode: options.mode,
      provider: countedProvider,
      confirmPrivateReplay: options.confirmPrivateReplay,
      maxCalls: options.maxCalls,
      providerPreflight
    });
    if (result.mode === "dry-run") {
      throw new Error("GI088_JOURNAL_CALIBRATION_EXECUTION_MODE_LOST");
    }
    await writePrivateJson(
      options.identityOutputPath,
      result.identityMap,
      options.mode === "real" ? "wx" : "w"
    );
    identityWritten = true;
    await writePrivateJson(
      options.outputPath,
      result.package,
      options.mode === "real" ? "wx" : "w"
    );
    outputWritten = true;
    if (lockPath) {
      await writePrivateJson(lockPath, {
        status: "completed",
        execution_fingerprint: result.package.execution_fingerprint,
        actual_model_calls: result.package.run.actual_model_calls
      });
    }
    return {
      package: result.package,
      identityMap: result.identityMap,
      outputWritten: true,
      outputPath: options.outputPath,
      identityOutputPath: options.identityOutputPath
    };
  } catch (error) {
    if (lockPath) {
      if (identityWritten && !outputWritten) {
        await unlink(options.identityOutputPath).catch(() => undefined);
      }
      if (observedProviderCalls === 0) {
        await unlink(lockPath).catch(() => undefined);
      } else {
        await writePrivateJson(lockPath, {
          status: "failed_after_model_call",
          actual_model_calls_observed: observedProviderCalls,
          error_code: safeGi088CalibrationErrorCode(error)
        });
      }
    }
    throw error;
  }
}

export function safeGi088CalibrationErrorCode(error: unknown) {
  if (
    error && typeof error === "object" && "code" in error &&
    typeof error.code === "string" && /^[A-Z0-9_:.,-]+$/u.test(error.code)
  ) {
    return error.code;
  }
  if (
    error instanceof Error && /^[A-Z0-9_:.,-]+$/u.test(error.message)
  ) {
    return error.message;
  }
  return "GI088_JOURNAL_CALIBRATION_UNEXPECTED_ERROR";
}

export async function mainGi088CalibrationCli() {
  const options = parseGi088CalibrationArgs(process.argv.slice(2));
  const result = await runGi088CalibrationCli(options);
  if ("plan" in result) {
    process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\n`);
    return;
  }
  process.stdout.write(JSON.stringify({
    mode: result.package.run.mode,
    scope_fingerprint: result.package.scope_fingerprint,
    execution_fingerprint: result.package.execution_fingerprint,
    candidate_set_id: result.package.candidate_set_id,
    actual_model_calls: result.package.run.actual_model_calls,
    technical_retries: result.package.run.technical_retries,
    admitted_candidates: result.package.run.admitted_candidates,
    candidate_count: result.package.run.completed_candidates,
    output: result.outputPath,
    identity_output: result.identityOutputPath
  }, null, 2) + "\n");
}
