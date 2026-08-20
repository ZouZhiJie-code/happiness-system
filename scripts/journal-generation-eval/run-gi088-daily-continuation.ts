import { open, access, chmod, mkdir, readFile, readdir, rename } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";

import {
  GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT,
  sha256Canonical,
  sha256Text,
  type Gi088CalibrationCandidate,
  type Gi088CalibrationIdentityMap,
  type Gi088CalibrationPrivatePackage,
  type Gi088CalibrationProvider,
  type Gi088CalibrationProviderPreflight,
  type Gi088CalibrationProviderRequest,
  type Gi088CalibrationProviderResult
} from "./gi088-calibration-contract";
import {
  createGi088MockCalibrationProvider,
  createGi088OpenAICompatibleCalibrationProvider,
  Gi088CalibrationProviderError
} from "./gi088-calibration-provider";
import {
  loadGi088CalibrationCodeSnapshot,
  runGi088DailyContinuation,
  type Gi088CalibrationCodeSnapshot,
  type Gi088DailyContinuationResult
} from "./gi088-calibration-runner";
import {
  resolveGi088CalibrationCredential,
  safeGi088CalibrationErrorCode,
  validateGi088CalibrationModels,
  type Gi088CalibrationCredential
} from "./run-gi088-calibration";
import { sha256File } from "./private-export-importer";

const PRIVATE_FORMAL_RELATIVE_ROOT =
  "artifacts/journal-generation-evaluation/.private/formal" as const;
const CONTINUATIONS_DIRECTORY = "continuations" as const;
const PARENT_PACKAGE_NAME = "candidate-packets.json" as const;
const PARENT_IDENTITY_NAME = "candidate-identity-map.json" as const;
const PARENT_LOCK_NAME = "gi088-calibration-real-run.lock.json" as const;
const REVIEW_FILE_NAMES = ["reviews.ndjson", "review-drafts.ndjson"] as const;
const MAX_ADDITIONAL_CALLS = 6 as const;
const MAX_CUMULATIVE_CALLS = 15 as const;
const CONTINUATION_SCOPE_VERSION =
  "2026-08-11.gi088-daily-completion-scope-v1" as const;

/**
 * These files define the already-frozen provider, source protocol and daily
 * writer. The continuation runner itself is deliberately excluded because it
 * adds the bounded continuation path.
 */
export const GI088_DAILY_CONTINUATION_FROZEN_DEPENDENCIES = [
  "scripts/journal-generation-eval/gi088-calibration-contract.ts",
  "scripts/journal-generation-eval/gi088-calibration-provider.ts",
  "scripts/journal-generation-eval/run-gi088-calibration.ts",
  "scripts/journal-generation-eval/vite.config.ts",
  "src/features/ai-quality/prompt-manifest.ts",
  "src/server/services/ai/ai-provider.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/interview/journal-event-entry.service.ts",
  "src/server/services/journal-daily-entry/contract.ts",
  "src/server/services/journal-daily-entry/prompt.ts",
  "src/server/services/journal-daily-entry/journal-daily-entry-generation.service.ts"
] as const;
const GI088_DAILY_CONTINUATION_ORCHESTRATION_FILES = [
  "scripts/journal-generation-eval/gi088-calibration-runner.ts",
  "scripts/journal-generation-eval/run-gi088-daily-continuation.ts",
  "scripts/journal-generation-eval/run-gi088-daily-continuation-cli.ts"
] as const;

export interface Gi088DailyContinuationCliOptions {
  mode: "dry-run" | "mock" | "real";
  confirmPrivateReplay: boolean;
  confirmScopeFingerprint: string | null;
  confirmParentExecutionFingerprint: string | null;
  maxAdditionalCalls: number;
  maxAdditionalCallsExplicit: boolean;
  continuationId: string | null;
}

export interface Gi088DailyContinuationParentArtifacts {
  package_sha256: string;
  identity_sha256: string;
  lock_sha256: string;
}

interface ParentRunLock {
  status: "completed";
  execution_fingerprint: string;
  actual_model_calls: number;
}

interface ParentBundle {
  package: Gi088CalibrationPrivatePackage;
  identityMap: Gi088CalibrationIdentityMap;
  lock: ParentRunLock;
  artifacts: Gi088DailyContinuationParentArtifacts;
}

export interface Gi088DailyContinuationTarget {
  case_id: string;
  candidate_id: string;
  candidate_execution_fingerprint: string;
  record_raw_sha256: string;
}

interface FrozenDependency {
  path: string;
  sha256: string;
}

export interface Gi088DailyContinuationScope {
  version: typeof CONTINUATION_SCOPE_VERSION;
  parent: {
    execution_fingerprint: string;
    candidate_set_id: string;
    scope_fingerprint: string;
    actual_model_calls: 9;
    artifacts: Gi088DailyContinuationParentArtifacts;
  };
  continuation: {
    stage: "daily_journal";
    target_count: 3;
    targets_sha256: string;
    nominal_additional_calls: 3;
    max_additional_calls: 6;
    maximum_cumulative_calls: 15;
  };
  frozen_dependencies: FrozenDependency[];
  continuation_implementation: FrozenDependency[];
}

export interface Gi088DailyContinuationDryRunSummary {
  mode: "dry-run";
  scope_fingerprint: string;
  parent_execution_fingerprint: string;
  parent_artifacts: Gi088DailyContinuationParentArtifacts;
  missing_daily_candidates: 3;
  model_calls_executed: 0;
  nominal_additional_calls: 3;
  max_additional_calls: 6;
  cumulative_calls_if_no_retry: 12;
  cumulative_calls_at_maximum: 15;
  required_real_run_confirmation: {
    private_replay: true;
    scope_fingerprint: string;
    parent_execution_fingerprint: string;
    max_additional_calls: 6;
  };
}

export interface Gi088DailyContinuationCliDependencies {
  resolveCredential: (
    env: NodeJS.ProcessEnv
  ) => Promise<Gi088CalibrationCredential>;
  validateModels: (input: {
    apiKey: string;
    credentialSource: Gi088CalibrationCredential["source"];
  }) => Promise<Gi088CalibrationProviderPreflight>;
  createRealProvider: (input: { apiKey: string }) => Gi088CalibrationProvider;
  createMockProvider: () => Gi088CalibrationProvider;
  runContinuation: typeof runGi088DailyContinuation;
  loadCodeSnapshot: (projectRoot?: string) => Promise<Gi088CalibrationCodeSnapshot>;
  now: () => Date;
}

export class Gi088DailyContinuationCliError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Gi088DailyContinuationCliError";
  }
}

function fail(code: string): never {
  throw new Gi088DailyContinuationCliError(code);
}

function argumentValue(argv: string[], index: number, flag: string) {
  const direct = argv[index];
  const prefix = `${flag}=`;
  if (direct.startsWith(prefix)) return { value: direct.slice(prefix.length), consumed: 0 };
  const next = argv[index + 1];
  if (direct === flag && next && !next.startsWith("--")) {
    return { value: next, consumed: 1 };
  }
  return null;
}

export function parseGi088DailyContinuationArgs(
  argv: string[]
): Gi088DailyContinuationCliOptions {
  const options: Gi088DailyContinuationCliOptions = {
    mode: "dry-run",
    confirmPrivateReplay: false,
    confirmScopeFingerprint: null,
    confirmParentExecutionFingerprint: null,
    maxAdditionalCalls: MAX_ADDITIONAL_CALLS,
    maxAdditionalCallsExplicit: false,
    continuationId: null
  };
  let modeExplicit = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute-real" || argument === "--execute-mock") {
      if (modeExplicit) fail("GI088_DAILY_CONTINUATION_MODE_DUPLICATE");
      options.mode = argument === "--execute-real" ? "real" : "mock";
      modeExplicit = true;
      continue;
    }
    if (argument === "--confirm-private-replay") {
      options.confirmPrivateReplay = true;
      continue;
    }
    const scope = argumentValue(argv, index, "--confirm-scope");
    if (scope) {
      options.confirmScopeFingerprint = scope.value;
      index += scope.consumed;
      continue;
    }
    const parent = argumentValue(argv, index, "--confirm-parent-execution");
    if (parent) {
      options.confirmParentExecutionFingerprint = parent.value;
      index += parent.consumed;
      continue;
    }
    const maxCalls = argumentValue(argv, index, "--max-additional-calls");
    if (maxCalls) {
      options.maxAdditionalCalls = Number(maxCalls.value);
      options.maxAdditionalCallsExplicit = true;
      index += maxCalls.consumed;
      continue;
    }
    const continuationId = argumentValue(argv, index, "--continuation-id");
    if (continuationId) {
      options.continuationId = continuationId.value;
      index += continuationId.consumed;
      continue;
    }
    fail(`GI088_DAILY_CONTINUATION_ARGUMENT_INVALID:${argument}`);
  }
  if (!Number.isInteger(options.maxAdditionalCalls)
    || options.maxAdditionalCalls !== MAX_ADDITIONAL_CALLS) {
    fail("GI088_DAILY_CONTINUATION_MAX_ADDITIONAL_CALLS_MUST_EQUAL_6");
  }
  if (options.continuationId
    && !/^[a-z0-9][a-z0-9-]{2,79}$/u.test(options.continuationId)) {
    fail("GI088_DAILY_CONTINUATION_ID_INVALID");
  }
  if (options.mode === "real") {
    if (!options.confirmPrivateReplay) {
      fail("GI088_DAILY_CONTINUATION_PRIVATE_REPLAY_CONFIRMATION_REQUIRED");
    }
    if (!options.maxAdditionalCallsExplicit) {
      fail("GI088_DAILY_CONTINUATION_MAX_CALLS_CONFIRMATION_REQUIRED");
    }
    if (!options.confirmScopeFingerprint) {
      fail("GI088_DAILY_CONTINUATION_SCOPE_CONFIRMATION_REQUIRED");
    }
    if (!options.confirmParentExecutionFingerprint) {
      fail("GI088_DAILY_CONTINUATION_PARENT_CONFIRMATION_REQUIRED");
    }
  }
  return options;
}

function formalPaths(projectRoot: string) {
  const formalRoot = resolve(projectRoot, PRIVATE_FORMAL_RELATIVE_ROOT);
  return {
    formalRoot,
    continuationRoot: resolve(formalRoot, CONTINUATIONS_DIRECTORY),
    packagePath: resolve(formalRoot, PARENT_PACKAGE_NAME),
    identityPath: resolve(formalRoot, PARENT_IDENTITY_NAME),
    lockPath: resolve(formalRoot, PARENT_LOCK_NAME),
    reviewPaths: REVIEW_FILE_NAMES.map((name) => resolve(formalRoot, name))
  };
}

function isPathInside(path: string, parent: string) {
  const normalizedPath = resolve(path);
  const normalizedParent = resolve(parent);
  return normalizedPath.startsWith(`${normalizedParent}${sep}`);
}

function assertContinuationOutputDirectory(path: string, continuationRoot: string) {
  if (!isPathInside(path, continuationRoot)
    || dirname(resolve(path)) !== resolve(continuationRoot)) {
    fail("GI088_DAILY_CONTINUATION_OUTPUT_ROOT_FORBIDDEN");
  }
}

async function readJson<T>(path: string, code: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    fail(code);
  }
}

function allCandidates(candidatePackage: Gi088CalibrationPrivatePackage) {
  return candidatePackage.packets.flatMap((packet) => packet.candidates.map((candidate) => ({
    packet,
    candidate
  })));
}

function validResponseAttempts(candidate: Gi088CalibrationCandidate) {
  return candidate.trace.attempts.filter((attempt) => attempt.outcome === "valid_response");
}

function validateParentBundle(input: ParentBundle) {
  const candidatePackage = input.package;
  if (candidatePackage.schema_version !== "2.0"
    || candidatePackage.privacy_classification !== "private_local_only"
    || candidatePackage.scope_fingerprint !== GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT
    || candidatePackage.run.mode !== "real"
    || candidatePackage.run.actual_model_calls !== 9
    || candidatePackage.run.technical_retries !== 0
    || candidatePackage.run.completed_candidates !== 6
    || candidatePackage.packets.length !== 3
    || candidatePackage.raw_responses.length !== 9) {
    fail("GI088_DAILY_CONTINUATION_PARENT_PACKAGE_INVALID");
  }
  if (input.lock.status !== "completed"
    || input.lock.execution_fingerprint !== candidatePackage.execution_fingerprint
    || input.lock.actual_model_calls !== candidatePackage.run.actual_model_calls) {
    fail("GI088_DAILY_CONTINUATION_PARENT_LOCK_INVALID");
  }
  const candidates = allCandidates(candidatePackage);
  const attempts = candidates.flatMap(({ candidate }) => candidate.trace.attempts);
  if (attempts.length !== candidatePackage.run.actual_model_calls
    || attempts.some((attempt) => attempt.outcome !== "valid_response")
    || validResponseAttemptsCount(candidates.map(({ candidate }) => candidate))
      !== candidatePackage.raw_responses.length) {
    fail("GI088_DAILY_CONTINUATION_PARENT_CALL_LEDGER_INVALID");
  }
  const rawByCall = new Map(candidatePackage.raw_responses.map((response) => [
    response.call_fingerprint,
    response
  ]));
  if (rawByCall.size !== candidatePackage.raw_responses.length
    || attempts.some((attempt) => {
      const raw = rawByCall.get(attempt.call_fingerprint);
      return !raw
        || attempt.raw_response_sha256 !== raw.sha256
        || sha256Text(raw.content) !== raw.sha256
        || raw.stage !== attempt.stage
        || raw.attempt !== attempt.attempt;
    })) {
    fail("GI088_DAILY_CONTINUATION_PARENT_RAW_RESPONSE_INVALID");
  }
  if (input.identityMap.schema_version !== "1.0"
    || input.identityMap.privacy_classification !== "private_local_only"
    || input.identityMap.execution_fingerprint !== candidatePackage.execution_fingerprint
    || input.identityMap.candidate_set_id !== candidatePackage.candidate_set_id
    || input.identityMap.identities.length !== candidates.length) {
    fail("GI088_DAILY_CONTINUATION_PARENT_IDENTITY_INVALID");
  }
  const identityKeys = input.identityMap.identities.map((identity) =>
    `${identity.case_id}\u0000${identity.candidate_id}`
  );
  const candidateKeys = candidates.map(({ packet, candidate }) =>
    `${packet.case_id}\u0000${candidate.candidate_id}`
  );
  if (new Set(identityKeys).size !== identityKeys.length
    || sha256Canonical([...identityKeys].sort()) !== sha256Canonical([...candidateKeys].sort())) {
    fail("GI088_DAILY_CONTINUATION_PARENT_IDENTITY_COVERAGE_INVALID");
  }
}

function validResponseAttemptsCount(candidates: Gi088CalibrationCandidate[]) {
  return candidates.reduce((sum, candidate) => sum + validResponseAttempts(candidate).length, 0);
}

function collectContinuationTargets(bundle: ParentBundle): Gi088DailyContinuationTarget[] {
  const targets = allCandidates(bundle.package).flatMap(({ packet, candidate }) => {
    if (candidate.paragraphs.length > 0) return [];
    const recordRaw = bundle.package.raw_responses.find((response) =>
      response.case_id === packet.case_id
      && response.candidate_id === candidate.candidate_id
      && response.stage === "record_card"
    );
    const dailyRaw = bundle.package.raw_responses.some((response) =>
      response.case_id === packet.case_id
      && response.candidate_id === candidate.candidate_id
      && response.stage === "daily_journal"
    );
    const skipped = candidate.program_check.checks.some((check) =>
      check.check === "daily_journal_schema_source_and_coverage_gate"
      && check.issues.includes("DAILY_JOURNAL_SKIPPED_RECORD_CARD_UNAVAILABLE")
    );
    if (!recordRaw || dailyRaw || !skipped || candidate.record_cards.length > 0) {
      fail("GI088_DAILY_CONTINUATION_TARGET_STATE_INVALID");
    }
    return [{
      case_id: packet.case_id,
      candidate_id: candidate.candidate_id,
      candidate_execution_fingerprint: candidate.execution_fingerprint,
      record_raw_sha256: recordRaw.sha256
    }];
  });
  if (targets.length !== 3) fail("GI088_DAILY_CONTINUATION_TARGET_COUNT_INVALID");
  return targets.sort((left, right) =>
    `${left.case_id}:${left.candidate_id}`.localeCompare(`${right.case_id}:${right.candidate_id}`)
  );
}

async function loadParentBundle(projectRoot: string): Promise<ParentBundle> {
  const paths = formalPaths(projectRoot);
  const [candidatePackage, identityMap, lock, packageSha, identitySha, lockSha] =
    await Promise.all([
      readJson<Gi088CalibrationPrivatePackage>(
        paths.packagePath,
        "GI088_DAILY_CONTINUATION_PARENT_PACKAGE_UNREADABLE"
      ),
      readJson<Gi088CalibrationIdentityMap>(
        paths.identityPath,
        "GI088_DAILY_CONTINUATION_PARENT_IDENTITY_UNREADABLE"
      ),
      readJson<ParentRunLock>(
        paths.lockPath,
        "GI088_DAILY_CONTINUATION_PARENT_LOCK_UNREADABLE"
      ),
      sha256File(paths.packagePath),
      sha256File(paths.identityPath),
      sha256File(paths.lockPath)
    ]);
  const bundle = {
    package: candidatePackage,
    identityMap,
    lock,
    artifacts: {
      package_sha256: packageSha,
      identity_sha256: identitySha,
      lock_sha256: lockSha
    }
  };
  validateParentBundle(bundle);
  return bundle;
}

async function assertFormalReviewsEmpty(projectRoot: string) {
  const { reviewPaths } = formalPaths(projectRoot);
  for (const reviewPath of reviewPaths) {
    try {
      if ((await readFile(reviewPath, "utf8")).trim()) {
        fail(`GI088_DAILY_CONTINUATION_REVIEW_STATE_NOT_EMPTY:${basename(reviewPath)}`);
      }
    } catch (error) {
      if (error instanceof Gi088DailyContinuationCliError) throw error;
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        fail("GI088_DAILY_CONTINUATION_REVIEW_STATE_UNREADABLE");
      }
    }
  }
}

async function loadFrozenDependencies(
  projectRoot: string,
  parentSnapshot: Gi088CalibrationCodeSnapshot
): Promise<FrozenDependency[]> {
  const parentHashes = new Map(parentSnapshot.files.map((item) => [item.path, item.sha256]));
  const current = await Promise.all(
    GI088_DAILY_CONTINUATION_FROZEN_DEPENDENCIES.map(async (path) => ({
      path,
      sha256: await sha256File(resolve(projectRoot, path))
    }))
  );
  for (const dependency of current) {
    if (parentHashes.get(dependency.path) !== dependency.sha256) {
      fail(`GI088_DAILY_CONTINUATION_FROZEN_DEPENDENCY_CHANGED:${dependency.path}`);
    }
  }
  return current;
}

function createContinuationScope(input: {
  bundle: ParentBundle;
  targets: Gi088DailyContinuationTarget[];
  frozenDependencies: FrozenDependency[];
  continuationImplementation: FrozenDependency[];
}): Gi088DailyContinuationScope {
  return {
    version: CONTINUATION_SCOPE_VERSION,
    parent: {
      execution_fingerprint: input.bundle.package.execution_fingerprint,
      candidate_set_id: input.bundle.package.candidate_set_id,
      scope_fingerprint: input.bundle.package.scope_fingerprint,
      actual_model_calls: 9,
      artifacts: input.bundle.artifacts
    },
    continuation: {
      stage: "daily_journal",
      target_count: 3,
      targets_sha256: sha256Canonical(input.targets),
      nominal_additional_calls: 3,
      max_additional_calls: 6,
      maximum_cumulative_calls: 15
    },
    frozen_dependencies: input.frozenDependencies,
    continuation_implementation: input.continuationImplementation
  };
}

async function loadContinuationImplementation(projectRoot: string) {
  return Promise.all(
    GI088_DAILY_CONTINUATION_ORCHESTRATION_FILES.map(async (path) => ({
      path,
      sha256: await sha256File(resolve(projectRoot, path))
    }))
  );
}

async function assertParentArtifactsUnchanged(
  projectRoot: string,
  expected: Gi088DailyContinuationParentArtifacts
) {
  const paths = formalPaths(projectRoot);
  const actual = {
    package_sha256: await sha256File(paths.packagePath),
    identity_sha256: await sha256File(paths.identityPath),
    lock_sha256: await sha256File(paths.lockPath)
  };
  if (sha256Canonical(actual) !== sha256Canonical(expected)) {
    fail("GI088_DAILY_CONTINUATION_PARENT_ARTIFACT_CHANGED");
  }
}

async function writePrivateFile(
  path: string,
  content: string,
  flag: "w" | "wx" = "wx"
) {
  const handle = await open(path, flag, 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, 0o600);
}

async function appendPrivateLedger(path: string, value: unknown) {
  const handle = await open(path, "a", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, 0o600);
}

async function writePrivateJsonAtomic(path: string, value: unknown) {
  const temporaryPath = resolve(
    dirname(path),
    `.${basename(path)}.${process.pid}.${Date.now()}.tmp`
  );
  await writePrivateFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "wx");
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

function safeProviderErrorCode(error: unknown) {
  return safeGi088CalibrationErrorCode(error);
}

function normalizeContinuationProviderError(error: unknown) {
  if (error instanceof Gi088CalibrationProviderError
    && error.retryable
    && error.cause
    && typeof error.cause === "object"
    && "status" in error.cause
    && error.cause.status === 409) {
    return new Gi088CalibrationProviderError(
      error.code,
      false,
      error.latencyMs,
      error.tokenUsage,
      error.finishReason,
      error.upstreamRequestId,
      error.cause
    );
  }
  return error;
}

export function createGi088AuditedContinuationProvider(input: {
  provider: Gi088CalibrationProvider;
  ledgerPath: string;
  parentCalls: number;
  targets: Gi088DailyContinuationTarget[];
  now: () => Date;
  preCallGuard: () => Promise<void>;
}) {
  let observedCalls = 0;
  const targetKeys = new Set(input.targets.map((target) =>
    `${target.case_id}\u0000${target.candidate_id}`
  ));
  const provider: Gi088CalibrationProvider = {
    kind: input.provider.kind,
    name: input.provider.name,
    async complete(request: Gi088CalibrationProviderRequest): Promise<Gi088CalibrationProviderResult> {
      const targetKey = `${request.caseId}\u0000${request.candidateId}`;
      if (request.stage !== "daily_journal" || !targetKeys.has(targetKey)) {
        fail("GI088_DAILY_CONTINUATION_PROVIDER_SCOPE_VIOLATION");
      }
      if (observedCalls >= MAX_ADDITIONAL_CALLS
        || input.parentCalls + observedCalls + 1 > MAX_CUMULATIVE_CALLS) {
        fail("GI088_DAILY_CONTINUATION_CALL_BUDGET_EXCEEDED");
      }
      await input.preCallGuard();
      observedCalls += 1;
      const reservation = {
        event: "call_reserved",
        sequence: observedCalls,
        reserved_at: input.now().toISOString(),
        call_fingerprint: request.callFingerprint,
        case_id: request.caseId,
        candidate_id: request.candidateId,
        stage: request.stage,
        attempt: request.attempt,
        model: request.model.model,
        cumulative_call_number: input.parentCalls + observedCalls
      };
      await appendPrivateLedger(input.ledgerPath, reservation);
      try {
        const result = await input.provider.complete(request);
        await appendPrivateLedger(input.ledgerPath, {
          event: "call_completed",
          sequence: observedCalls,
          completed_at: input.now().toISOString(),
          call_fingerprint: request.callFingerprint,
          content_sha256: sha256Text(result.content),
          content: result.content,
          latency_ms: result.latencyMs,
          finish_reason: result.finishReason ?? null,
          token_usage: result.tokenUsage ?? null,
          upstream_request_id: result.upstreamRequestId ?? null,
          provider: result.provider,
          response_model: result.responseModel ?? null,
          reasoning_present: result.reasoningPresent ?? null,
          reasoning_tokens: result.reasoningTokens ?? null
        });
        return result;
      } catch (error) {
        const normalizedError = normalizeContinuationProviderError(error);
        await appendPrivateLedger(input.ledgerPath, {
          event: "call_failed",
          sequence: observedCalls,
          failed_at: input.now().toISOString(),
          call_fingerprint: request.callFingerprint,
          error_code: safeProviderErrorCode(normalizedError)
        });
        throw normalizedError;
      }
    }
  };
  return { provider, observedCalls: () => observedCalls };
}

function validateCompletedContinuation(input: {
  result: Exclude<Gi088DailyContinuationResult, { mode: "dry-run" }>;
  parent: ParentBundle;
  targets: Gi088DailyContinuationTarget[];
  observedCalls: number;
}) {
  const completed = input.result.package;
  const targetKeys = new Set(input.targets.map((target) =>
    `${target.case_id}\u0000${target.candidate_id}`
  ));
  const parentCandidateByKey = new Map(allCandidates(input.parent.package).map(({ packet, candidate }) => [
    `${packet.case_id}\u0000${candidate.candidate_id}`,
    candidate
  ]));
  if (completed.candidate_set_id !== input.parent.package.candidate_set_id
    || completed.continuation.parent_execution_fingerprint
      !== input.parent.package.execution_fingerprint
    || completed.run.actual_model_calls !== 9 + input.observedCalls
    || completed.run.actual_model_calls > MAX_CUMULATIVE_CALLS
    || completed.raw_responses.length !== input.parent.package.raw_responses.length
      + completed.continuation.additional_model_calls
      - completed.continuation.additional_technical_retries
    || completed.continuation.additional_model_calls !== input.observedCalls) {
    fail("GI088_DAILY_CONTINUATION_RESULT_LEDGER_INVALID");
  }
  const newAttempts: Gi088CalibrationCandidate["trace"]["attempts"] = [];
  for (const { packet, candidate } of allCandidates(completed)) {
    const key = `${packet.case_id}\u0000${candidate.candidate_id}`;
    const parentCandidate = parentCandidateByKey.get(key);
    if (!parentCandidate) fail("GI088_DAILY_CONTINUATION_RESULT_CANDIDATE_UNKNOWN");
    if (!targetKeys.has(key)) {
      if (sha256Canonical(candidate) !== sha256Canonical(parentCandidate)) {
        fail("GI088_DAILY_CONTINUATION_UNTARGETED_CANDIDATE_CHANGED");
      }
      continue;
    }
    const parentAttemptCount = parentCandidate.trace.attempts.length;
    if (sha256Canonical(candidate.trace.attempts.slice(0, parentAttemptCount))
      !== sha256Canonical(parentCandidate.trace.attempts)) {
      fail("GI088_DAILY_CONTINUATION_PARENT_ATTEMPT_CHANGED");
    }
    newAttempts.push(...candidate.trace.attempts.slice(parentAttemptCount));
    const dailyAttempts = candidate.trace.attempts.filter((attempt) =>
      attempt.stage === "daily_journal"
    );
    if (candidate.record_cards.length !== 1
      || candidate.record_cards[0].text.trim().length === 0
      || candidate.paragraphs.length === 0
      || candidate.paragraphs.some((paragraph) => paragraph.text.trim().length === 0)
      || dailyAttempts.length === 0
      || candidate.trace.raw_response_hashes.record_card
        !== parentCandidate.trace.raw_response_hashes.record_card) {
      fail("GI088_DAILY_CONTINUATION_REVIEW_CONTENT_INCOMPLETE");
    }
  }
  const newRaw = completed.raw_responses.slice(input.parent.package.raw_responses.length);
  const newRawByCall = new Map(newRaw.map((response) => [response.call_fingerprint, response]));
  if (newAttempts.length !== input.observedCalls
    || newAttempts.some((attempt) => attempt.stage !== "daily_journal")
    || newAttempts.filter((attempt) => attempt.outcome === "valid_response").length
      !== newRaw.length
    || newRawByCall.size !== newRaw.length
    || newRaw.some((response) =>
    response.stage !== "daily_journal"
    || !targetKeys.has(`${response.case_id}\u0000${response.candidate_id}`)
    || sha256Text(response.content) !== response.sha256
    )
    || newAttempts.some((attempt) => {
      const raw = newRawByCall.get(attempt.call_fingerprint);
      return attempt.outcome === "valid_response"
        ? !raw || raw.sha256 !== attempt.raw_response_sha256
        : raw !== undefined || attempt.raw_response_sha256 !== null;
    })) {
    fail("GI088_DAILY_CONTINUATION_RESULT_SCOPE_VIOLATION");
  }
  if (input.result.identityMap.execution_fingerprint !== completed.execution_fingerprint
    || input.result.identityMap.candidate_set_id !== completed.candidate_set_id
    || input.result.identityMap.identities.length !== 6) {
    fail("GI088_DAILY_CONTINUATION_RESULT_IDENTITY_INVALID");
  }
}

function continuationDirectoryName(options: Gi088DailyContinuationCliOptions, parent: ParentBundle) {
  return options.continuationId
    ?? `${options.mode === "mock" ? "mock-" : ""}daily-completion-${parent.package.execution_fingerprint.slice(0, 16)}`;
}

async function ensureFreshContinuationDirectory(path: string, continuationRoot: string) {
  assertContinuationOutputDirectory(path, continuationRoot);
  await mkdir(continuationRoot, { recursive: true, mode: 0o700 });
  await chmod(continuationRoot, 0o700);
  try {
    await access(path);
    fail("GI088_DAILY_CONTINUATION_OUTPUT_ALREADY_EXISTS");
  } catch (error) {
    if (error instanceof Gi088DailyContinuationCliError) throw error;
  }
  await mkdir(path, { recursive: false, mode: 0o700 });
  await chmod(path, 0o700);
}

export async function assertNoPriorRealContinuation(
  continuationRoot: string,
  parentExecutionFingerprint: string
) {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(continuationRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    fail("GI088_DAILY_CONTINUATION_HISTORY_UNREADABLE");
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const lockPath = resolve(
      continuationRoot,
      entry.name,
      "continuation-run.lock.json"
    );
    try {
      const lock = await readJson<Record<string, unknown>>(
        lockPath,
        "GI088_DAILY_CONTINUATION_HISTORY_LOCK_INVALID"
      );
      if (lock.mode === "real"
        && lock.parent_execution_fingerprint === parentExecutionFingerprint) {
        fail("GI088_DAILY_CONTINUATION_PRIOR_REAL_RUN_EXISTS");
      }
    } catch (error) {
      if (error instanceof Gi088DailyContinuationCliError) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        fail("GI088_DAILY_CONTINUATION_HISTORY_LOCK_INVALID");
      }
    }
  }
}

type ContinuationRunnerInput = Parameters<typeof runGi088DailyContinuation>[0] & {
  parentArtifacts: Gi088DailyContinuationParentArtifacts;
  continuationScopeFingerprint: string;
  confirmContinuationScopeFingerprint: string;
};

export async function runGi088DailyContinuationCli(
  options: Gi088DailyContinuationCliOptions,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: Partial<Gi088DailyContinuationCliDependencies> = {},
  projectRoot = process.cwd()
) {
  const deps: Gi088DailyContinuationCliDependencies = {
    resolveCredential: dependencies.resolveCredential ?? resolveGi088CalibrationCredential,
    validateModels: dependencies.validateModels ?? validateGi088CalibrationModels,
    createRealProvider:
      dependencies.createRealProvider ?? createGi088OpenAICompatibleCalibrationProvider,
    createMockProvider: dependencies.createMockProvider ?? createGi088MockCalibrationProvider,
    runContinuation: dependencies.runContinuation ?? runGi088DailyContinuation,
    loadCodeSnapshot: dependencies.loadCodeSnapshot ?? loadGi088CalibrationCodeSnapshot,
    now: dependencies.now ?? (() => new Date())
  };
  const bundle = await loadParentBundle(projectRoot);
  const targets = collectContinuationTargets(bundle);
  const frozenDependencies = await loadFrozenDependencies(
    projectRoot,
    bundle.package.code_snapshot
  );
  const continuationImplementation = await loadContinuationImplementation(projectRoot);
  const continuationScope = createContinuationScope({
    bundle,
    targets,
    frozenDependencies,
    continuationImplementation
  });
  const continuationScopeFingerprint = sha256Canonical(continuationScope);

  await assertFormalReviewsEmpty(projectRoot);
  await assertParentArtifactsUnchanged(projectRoot, bundle.artifacts);

  if (options.mode === "dry-run") {
    const runnerPlan = await deps.runContinuation({
      mode: "dry-run",
      originalPackage: bundle.package,
      identityMap: bundle.identityMap,
      maxAdditionalCalls: MAX_ADDITIONAL_CALLS,
      projectRoot
    });
    if (runnerPlan.mode !== "dry-run"
      || runnerPlan.missing_daily_candidates !== 3
      || runnerPlan.model_calls_executed !== 0) {
      fail("GI088_DAILY_CONTINUATION_DRY_RUN_INVALID");
    }
    const summary: Gi088DailyContinuationDryRunSummary = {
      mode: "dry-run",
      scope_fingerprint: continuationScopeFingerprint,
      parent_execution_fingerprint: bundle.package.execution_fingerprint,
      parent_artifacts: bundle.artifacts,
      missing_daily_candidates: 3,
      model_calls_executed: 0,
      nominal_additional_calls: 3,
      max_additional_calls: 6,
      cumulative_calls_if_no_retry: 12,
      cumulative_calls_at_maximum: 15,
      required_real_run_confirmation: {
        private_replay: true,
        scope_fingerprint: continuationScopeFingerprint,
        parent_execution_fingerprint: bundle.package.execution_fingerprint,
        max_additional_calls: 6
      }
    };
    return { plan: summary, outputWritten: false as const };
  }

  if (options.mode === "real") {
    if (options.confirmScopeFingerprint !== continuationScopeFingerprint) {
      fail("GI088_DAILY_CONTINUATION_SCOPE_CONFIRMATION_MISMATCH");
    }
    if (options.confirmParentExecutionFingerprint !== bundle.package.execution_fingerprint) {
      fail("GI088_DAILY_CONTINUATION_PARENT_CONFIRMATION_MISMATCH");
    }
  }

  const paths = formalPaths(projectRoot);
  if (options.mode === "real") {
    await assertNoPriorRealContinuation(
      paths.continuationRoot,
      bundle.package.execution_fingerprint
    );
  }
  const outputDirectory = resolve(
    paths.continuationRoot,
    continuationDirectoryName(options, bundle)
  );
  await ensureFreshContinuationDirectory(outputDirectory, paths.continuationRoot);
  const attemptLedgerPath = resolve(outputDirectory, "attempt-ledger.ndjson");
  const runLockPath = resolve(outputDirectory, "continuation-run.lock.json");
  const outputPackagePath = resolve(outputDirectory, "candidate-packets.json");
  const outputIdentityPath = resolve(outputDirectory, "candidate-identity-map.json");
  const commitManifestPath = resolve(outputDirectory, "commit-manifest.json");

  await writePrivateJsonAtomic(runLockPath, {
    status: "reserved",
    reserved_at: deps.now().toISOString(),
    mode: options.mode,
    continuation_scope_fingerprint: continuationScopeFingerprint,
    parent_execution_fingerprint: bundle.package.execution_fingerprint,
    parent_artifacts: bundle.artifacts,
    confirmation: {
      private_replay: options.mode === "real",
      max_additional_calls: options.maxAdditionalCalls,
      scope_fingerprint: options.confirmScopeFingerprint,
      parent_execution_fingerprint: options.confirmParentExecutionFingerprint
    }
  });
  let observedCalls = () => 0;
  try {
    let provider: Gi088CalibrationProvider;
    let providerPreflight: Gi088CalibrationProviderPreflight | undefined;
    if (options.mode === "real") {
      const credential = await deps.resolveCredential(env);
      providerPreflight = await deps.validateModels({
        apiKey: credential.apiKey,
        credentialSource: credential.source
      });
      provider = deps.createRealProvider({ apiKey: credential.apiKey });
    } else {
      provider = deps.createMockProvider();
    }
    const audited = createGi088AuditedContinuationProvider({
      provider,
      ledgerPath: attemptLedgerPath,
      parentCalls: bundle.package.run.actual_model_calls,
      targets,
      now: deps.now,
      preCallGuard: async () => {
        await assertFormalReviewsEmpty(projectRoot);
        await assertParentArtifactsUnchanged(projectRoot, bundle.artifacts);
      }
    });
    observedCalls = audited.observedCalls;
    await assertFormalReviewsEmpty(projectRoot);
    await assertParentArtifactsUnchanged(projectRoot, bundle.artifacts);
    const codeSnapshot = await deps.loadCodeSnapshot(projectRoot);
    await assertFormalReviewsEmpty(projectRoot);
    await assertParentArtifactsUnchanged(projectRoot, bundle.artifacts);
    const runnerInput: ContinuationRunnerInput = {
      mode: options.mode,
      originalPackage: bundle.package,
      identityMap: bundle.identityMap,
      provider: audited.provider,
      confirmPrivateReplay: options.mode === "real",
      confirmParentExecutionFingerprint: bundle.package.execution_fingerprint,
      maxAdditionalCalls: options.maxAdditionalCalls,
      projectRoot,
      codeSnapshot,
      providerPreflight,
      parentArtifacts: bundle.artifacts,
      continuationScopeFingerprint,
      confirmContinuationScopeFingerprint: continuationScopeFingerprint
    };
    const result = await deps.runContinuation(runnerInput);
    if (result.mode === "dry-run") fail("GI088_DAILY_CONTINUATION_EXECUTION_MODE_LOST");
    validateCompletedContinuation({
      result,
      parent: bundle,
      targets,
      observedCalls: audited.observedCalls()
    });
    await assertFormalReviewsEmpty(projectRoot);
    await assertParentArtifactsUnchanged(projectRoot, bundle.artifacts);

    const packageContent = `${JSON.stringify(result.package, null, 2)}\n`;
    const identityContent = `${JSON.stringify(result.identityMap, null, 2)}\n`;
    const childArtifacts = {
      package_sha256: sha256Text(packageContent),
      identity_sha256: sha256Text(identityContent)
    };
    await writePrivateFile(
      resolve(outputDirectory, `.candidate-packets.${process.pid}.tmp`),
      packageContent
    );
    await writePrivateFile(
      resolve(outputDirectory, `.candidate-identity-map.${process.pid}.tmp`),
      identityContent
    );
    await rename(
      resolve(outputDirectory, `.candidate-packets.${process.pid}.tmp`),
      outputPackagePath
    );
    await rename(
      resolve(outputDirectory, `.candidate-identity-map.${process.pid}.tmp`),
      outputIdentityPath
    );
    await chmod(outputPackagePath, 0o600);
    await chmod(outputIdentityPath, 0o600);
    await assertParentArtifactsUnchanged(projectRoot, bundle.artifacts);

    const completedLock = {
      status: "completed",
      completed_at: deps.now().toISOString(),
      mode: options.mode,
      continuation_scope_fingerprint: continuationScopeFingerprint,
      parent_execution_fingerprint: bundle.package.execution_fingerprint,
      execution_fingerprint: result.package.execution_fingerprint,
      parent_artifacts: bundle.artifacts,
      child_artifacts: childArtifacts,
      additional_model_calls: result.package.continuation.additional_model_calls,
      cumulative_model_calls: result.package.run.actual_model_calls
    };
    await writePrivateJsonAtomic(runLockPath, completedLock);
    const [ledgerSha, completedLockSha] = await Promise.all([
      sha256File(attemptLedgerPath),
      sha256File(runLockPath)
    ]);
    const commitManifest = {
      schema_version: "1.0",
      status: "committed",
      committed_at: deps.now().toISOString(),
      continuation_scope_fingerprint: continuationScopeFingerprint,
      execution_fingerprint: result.package.execution_fingerprint,
      candidate_set_id: result.package.candidate_set_id,
      parent_artifacts: bundle.artifacts,
      child_artifacts: childArtifacts,
      attempt_ledger_sha256: ledgerSha,
      run_lock_sha256: completedLockSha,
      files: {
        package: basename(outputPackagePath),
        identity: basename(outputIdentityPath),
        attempt_ledger: basename(attemptLedgerPath),
        run_lock: basename(runLockPath)
      },
      calls: {
        parent: 9,
        additional: result.package.continuation.additional_model_calls,
        cumulative: result.package.run.actual_model_calls,
        maximum: 15
      }
    };
    // The manifest is the final write and the sole marker that both outputs are usable.
    await writePrivateJsonAtomic(commitManifestPath, commitManifest);
    return {
      package: result.package,
      identityMap: result.identityMap,
      outputWritten: true as const,
      outputDirectory,
      outputPackagePath,
      outputIdentityPath,
      commitManifestPath,
      continuationScopeFingerprint,
      parentArtifacts: bundle.artifacts
    };
  } catch (error) {
    const failureLock = {
      status: "failed",
      failed_at: deps.now().toISOString(),
      mode: options.mode,
      continuation_scope_fingerprint: continuationScopeFingerprint,
      parent_execution_fingerprint: bundle.package.execution_fingerprint,
      parent_artifacts: bundle.artifacts,
      observed_additional_model_calls: observedCalls(),
      cumulative_model_calls_observed:
        bundle.package.run.actual_model_calls + observedCalls(),
      error_code: safeGi088DailyContinuationErrorCode(error)
    };
    await writePrivateJsonAtomic(runLockPath, failureLock).catch(() => undefined);
    throw error;
  }
}

export function safeGi088DailyContinuationErrorCode(error: unknown) {
  if (error instanceof Gi088DailyContinuationCliError) return error.code;
  return safeGi088CalibrationErrorCode(error);
}

export async function mainGi088DailyContinuationCli() {
  const options = parseGi088DailyContinuationArgs(process.argv.slice(2));
  const result = await runGi088DailyContinuationCli(options);
  if ("plan" in result) {
    process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    mode: result.package.run.mode,
    status: "committed",
    continuation_scope_fingerprint: result.continuationScopeFingerprint,
    parent_execution_fingerprint:
      result.package.continuation.parent_execution_fingerprint,
    execution_fingerprint: result.package.execution_fingerprint,
    candidate_set_id: result.package.candidate_set_id,
    additional_model_calls: result.package.continuation.additional_model_calls,
    cumulative_model_calls: result.package.run.actual_model_calls,
    output_directory: relative(process.cwd(), result.outputDirectory),
    commit_manifest: relative(process.cwd(), result.commitManifestPath)
  }, null, 2)}\n`);
}
