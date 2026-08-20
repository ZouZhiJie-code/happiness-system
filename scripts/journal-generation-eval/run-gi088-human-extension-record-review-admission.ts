import {
  access,
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  stat
} from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";

import { sha256Canonical, sha256Text } from "./gi088-calibration-contract";
import {
  assessGi088ExtensionRecordReviewAdmission,
  GI088_EXTENSION_RECORD_REVIEW_ADMISSION_VERSION
} from "./gi088-human-extension-record-admission";
import {
  GI088_HUMAN_EXTENSION_RECORD_ROUND_ID,
  GI088_HUMAN_EXTENSION_VERSION
} from "./gi088-human-extension-contract";
import { sha256File } from "./private-export-importer";
import {
  loadCommittedGi088ExtensionRecordRound,
  type Gi088ExtensionRecordCase,
  type LoadedGi088ExtensionRecordRound
} from "./run-gi088-human-extension-records";

const PRIVATE_ROOT_RELATIVE = "artifacts/journal-generation-evaluation/.private" as const;
const FORMAL_ADMISSION_ROOT_RELATIVE =
  `${PRIVATE_ROOT_RELATIVE}/formal/extension/record-review-admissions` as const;
const DEFAULT_PARENT_DIRECTORY_RELATIVE =
  `${PRIVATE_ROOT_RELATIVE}/formal/extension/record-cards/gi088-human-extension-record-cards-a5d06697` as const;
const ADMISSION_ROUND_ID = "gi088-human-extension-record-review-admission" as const;
const ADMISSION_SCOPE_VERSION =
  "2026-08-11.gi088-human-extension-record-review-admission-v1" as const;

const ADMISSION_IMPLEMENTATION_FILES = [
  "scripts/journal-generation-eval/gi088-calibration-contract.ts",
  "scripts/journal-generation-eval/gi088-calibration-runner.ts",
  "scripts/journal-generation-eval/gi088-human-extension-contract.ts",
  "scripts/journal-generation-eval/gi088-human-extension-source.ts",
  "scripts/journal-generation-eval/gi088-human-extension-record-admission.ts",
  "scripts/journal-generation-eval/private-export-importer.ts",
  "scripts/journal-generation-eval/run-gi088-human-extension-records.ts",
  "scripts/journal-generation-eval/run-gi088-human-extension-record-review-admission.ts",
  "scripts/journal-generation-eval/run-gi088-human-extension-record-review-admission-cli.ts",
  "src/app/admin/journal-evaluation/extension-loader.ts"
] as const;

export interface Gi088ExtensionRecordReviewAdmissionOptions {
  mode: "dry-run" | "execute";
  confirmPrivateReplay: boolean;
  confirmScopeFingerprint: string | null;
  confirmParentExecutionFingerprint: string | null;
  parentDirectory: string | null;
  outputId: string | null;
  /** Test-only support for a mock parent package. */
  allowMockParent: boolean;
}

export interface Gi088ExtensionRecordReviewAdmissionCase {
  case_id: string;
  candidate_id: string;
  source_group_id: string;
  source_file_sha256: string;
  source_projection_sha256: string;
  raw_response_sha256: string;
  record_card_sha256: string;
  review_ready: true;
  normalized: boolean;
  normalization_fingerprint: string | null;
}

interface Gi088ExtensionRecordReviewAdmissionParent {
  round_id: typeof GI088_HUMAN_EXTENSION_RECORD_ROUND_ID;
  mode: "real" | "mock";
  directory: string;
  execution_fingerprint: string;
  scope_fingerprint: string;
  artifacts: {
    package_sha256: string;
    manifest_sha256: string;
    attempt_ledger_sha256: string;
    run_lock_sha256: string;
  };
}

interface Gi088ExtensionRecordReviewAdmissionImplementationFile {
  path: string;
  sha256: string;
}

export interface Gi088ExtensionRecordReviewAdmissionPackage {
  schema_version: "1.0";
  privacy_classification: "private_local_only";
  extension_version: typeof GI088_HUMAN_EXTENSION_VERSION;
  round_id: typeof ADMISSION_ROUND_ID;
  generated_at: string;
  mode: "zero_model_call";
  scope_fingerprint: string;
  execution_fingerprint: string;
  model_calls: {
    actual: 0;
    maximum: 0;
  };
  parent: Gi088ExtensionRecordReviewAdmissionParent;
  admission_policy: {
    version: typeof GI088_EXTENSION_RECORD_REVIEW_ADMISSION_VERSION;
    only_permitted_normalization:
      "adjacent_event_and_insight_blocks_compiled_without_semantic_change";
  };
  implementation_snapshot: Gi088ExtensionRecordReviewAdmissionImplementationFile[];
  cases: Gi088ExtensionRecordReviewAdmissionCase[];
}

export interface Gi088ExtensionRecordReviewAdmissionCommitManifest {
  schema_version: "1.0";
  status: "committed";
  committed_at: string;
  round_id: typeof ADMISSION_ROUND_ID;
  scope_fingerprint: string;
  execution_fingerprint: string;
  parent: Gi088ExtensionRecordReviewAdmissionParent;
  child_artifacts: {
    package_sha256: string;
    admission_ledger_sha256: string;
    run_lock_sha256: string;
  };
  files: {
    package: "review-admission-package.json";
    admission_ledger: "review-admission-ledger.ndjson";
    run_lock: "review-admission-run.lock.json";
  };
  model_calls: {
    actual: 0;
    maximum: 0;
  };
}

export interface LoadedGi088ExtensionRecordReviewAdmission {
  directory: string;
  package: Gi088ExtensionRecordReviewAdmissionPackage;
  manifest: Gi088ExtensionRecordReviewAdmissionCommitManifest;
  runLock: {
    status: "completed";
    mode: "zero_model_call";
    round_id: typeof ADMISSION_ROUND_ID;
    scope_fingerprint: string;
    execution_fingerprint: string;
    parent_execution_fingerprint: string;
    package_sha256: string;
    model_calls: 0;
  };
  artifactSha256: {
    package: string;
    manifest: string;
    admission_ledger: string;
    run_lock: string;
  };
}

export class Gi088ExtensionRecordReviewAdmissionError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Gi088ExtensionRecordReviewAdmissionError";
  }
}

function fail(code: string): never {
  throw new Gi088ExtensionRecordReviewAdmissionError(code);
}

function isPathInside(path: string, root: string) {
  const fromRoot = relative(resolve(root), resolve(path));
  return Boolean(fromRoot)
    && fromRoot !== ".."
    && !fromRoot.startsWith(`..${sep}`);
}

function privateRoot(projectRoot: string) {
  return resolve(projectRoot, PRIVATE_ROOT_RELATIVE);
}

function assertPrivateDirectory(path: string, projectRoot: string) {
  if (!isPathInside(path, privateRoot(projectRoot))) {
    fail("GI088_EXTENSION_RECORD_ADMISSION_PRIVATE_DIRECTORY_REQUIRED");
  }
}

function assertOutputDirectory(path: string, projectRoot: string) {
  const outputRoot = resolve(projectRoot, FORMAL_ADMISSION_ROOT_RELATIVE);
  if (!isPathInside(path, outputRoot) || dirname(resolve(path)) !== outputRoot) {
    fail("GI088_EXTENSION_RECORD_ADMISSION_OUTPUT_ROOT_INVALID");
  }
}

async function readJson<T>(path: string, code: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    fail(code);
  }
}

async function readLedger(path: string) {
  try {
    return (await readFile(path, "utf8")).split(/\r?\n/u).flatMap((line) => {
      if (!line.trim()) return [];
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        fail("GI088_EXTENSION_RECORD_ADMISSION_LEDGER_INVALID");
      }
    });
  } catch (error) {
    if (error instanceof Gi088ExtensionRecordReviewAdmissionError) throw error;
    fail("GI088_EXTENSION_RECORD_ADMISSION_LEDGER_INVALID");
  }
}

async function writePrivateFile(path: string, content: string, exclusive = true) {
  const handle = await open(path, exclusive ? "wx" : "w", 0o600);
  try {
    await handle.writeFile(content, "utf8");
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
  await writePrivateFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, path);
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

async function loadImplementationSnapshot(projectRoot: string) {
  return await Promise.all(ADMISSION_IMPLEMENTATION_FILES.map(async (path) => ({
    path,
    sha256: await sha256File(resolve(projectRoot, path))
  })));
}

function parentFromLoaded(
  loaded: LoadedGi088ExtensionRecordRound,
  projectRoot: string
): Gi088ExtensionRecordReviewAdmissionParent {
  return {
    round_id: loaded.package.round_id,
    mode: loaded.package.mode,
    directory: relative(projectRoot, loaded.directory),
    execution_fingerprint: loaded.package.execution_fingerprint,
    scope_fingerprint: loaded.package.scope_fingerprint,
    artifacts: {
      package_sha256: loaded.artifactSha256.package,
      manifest_sha256: loaded.artifactSha256.manifest,
      attempt_ledger_sha256: loaded.artifactSha256.attempt_ledger,
      run_lock_sha256: loaded.artifactSha256.run_lock
    }
  };
}

function caseAdmission(recordCase: Gi088ExtensionRecordCase): Gi088ExtensionRecordReviewAdmissionCase {
  const reviewAdmission = assessGi088ExtensionRecordReviewAdmission(recordCase);
  const card = recordCase.candidate.record_card;
  const rawResponseSha = recordCase.candidate.trace.raw_response_sha256;
  if (!reviewAdmission.reviewReady || !card || !rawResponseSha) {
    fail(`GI088_EXTENSION_RECORD_ADMISSION_REVIEW_BLOCKED:${recordCase.case_id}`);
  }
  return {
    case_id: recordCase.case_id,
    candidate_id: recordCase.candidate.candidate_id,
    source_group_id: recordCase.source_group_id,
    source_file_sha256: recordCase.source_file_sha256,
    source_projection_sha256: recordCase.source_projection_sha256,
    raw_response_sha256: rawResponseSha,
    record_card_sha256: sha256Canonical(card),
    review_ready: true,
    normalized: reviewAdmission.normalized,
    normalization_fingerprint: reviewAdmission.normalizationFingerprint
  };
}

function collectCaseAdmissions(loaded: LoadedGi088ExtensionRecordRound) {
  const cases = loaded.package.cases.map(caseAdmission);
  if (cases.length !== 6
    || new Set(cases.map((item) => item.case_id)).size !== 6
    || cases.some((item) => !item.review_ready)) {
    fail("GI088_EXTENSION_RECORD_ADMISSION_CASE_SET_INVALID");
  }
  return cases;
}

function createScope(input: {
  parent: Gi088ExtensionRecordReviewAdmissionParent;
  implementationSnapshot: Gi088ExtensionRecordReviewAdmissionImplementationFile[];
  cases: Gi088ExtensionRecordReviewAdmissionCase[];
}) {
  return {
    version: ADMISSION_SCOPE_VERSION,
    parent: input.parent,
    admissionPolicy: {
      version: GI088_EXTENSION_RECORD_REVIEW_ADMISSION_VERSION,
      onlyPermittedNormalization:
        "adjacent_event_and_insight_blocks_compiled_without_semantic_change"
    },
    implementationSnapshot: input.implementationSnapshot,
    cases: input.cases,
    modelCalls: { actual: 0, maximum: 0 }
  };
}

export function createGi088ExtensionRecordReviewAdmissionExecutionFingerprint(input: {
  scopeFingerprint: string;
  parent: Gi088ExtensionRecordReviewAdmissionParent;
  implementationSnapshot: Gi088ExtensionRecordReviewAdmissionImplementationFile[];
  cases: Gi088ExtensionRecordReviewAdmissionCase[];
}) {
  return sha256Canonical({
    scopeFingerprint: input.scopeFingerprint,
    parent: input.parent,
    implementationSnapshot: input.implementationSnapshot,
    cases: input.cases,
    modelCalls: { actual: 0, maximum: 0 }
  });
}

function defaultParentDirectory(projectRoot: string) {
  return resolve(projectRoot, DEFAULT_PARENT_DIRECTORY_RELATIVE);
}

function defaultOutputDirectory(projectRoot: string, scopeFingerprint: string) {
  return resolve(
    projectRoot,
    FORMAL_ADMISSION_ROOT_RELATIVE,
    `${ADMISSION_ROUND_ID}-${scopeFingerprint.slice(0, 8)}`
  );
}

async function ensureFreshOutputDirectory(path: string, projectRoot: string) {
  assertOutputDirectory(path, projectRoot);
  const root = resolve(projectRoot, FORMAL_ADMISSION_ROOT_RELATIVE);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(privateRoot(projectRoot), 0o700);
  await chmod(root, 0o700);
  try {
    await access(path);
    fail("GI088_EXTENSION_RECORD_ADMISSION_OUTPUT_ALREADY_EXISTS");
  } catch (error) {
    if (error instanceof Gi088ExtensionRecordReviewAdmissionError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      fail("GI088_EXTENSION_RECORD_ADMISSION_OUTPUT_ACCESS_FAILED");
    }
  }
  await mkdir(path, { recursive: false, mode: 0o700 });
  await chmod(path, 0o700);
}

async function loadValidatedParent(input: {
  parentDirectory: string;
  allowMockParent: boolean;
  projectRoot: string;
}) {
  assertPrivateDirectory(input.parentDirectory, input.projectRoot);
  return await loadCommittedGi088ExtensionRecordRound(input.parentDirectory, {
    allowMock: input.allowMockParent,
    projectRoot: input.projectRoot,
    // The parent is an immutable model-run package. This continuation freezes
    // its own current admission implementation after revalidating all raw
    // parent evidence and parser projections.
    allowCodeSnapshotDrift: true
  });
}

export async function runGi088HumanExtensionRecordReviewAdmission(
  options: Gi088ExtensionRecordReviewAdmissionOptions,
  dependencies: { now?: () => Date } = {},
  projectRoot = process.cwd()
) {
  const now = dependencies.now ?? (() => new Date());
  const parentDirectory = options.parentDirectory
    ? resolve(projectRoot, options.parentDirectory)
    : defaultParentDirectory(projectRoot);
  const initialParent = await loadValidatedParent({
    parentDirectory,
    allowMockParent: options.allowMockParent,
    projectRoot
  });
  if (!options.allowMockParent && initialParent.package.mode !== "real") {
    fail("GI088_EXTENSION_RECORD_ADMISSION_REAL_PARENT_REQUIRED");
  }
  const parent = parentFromLoaded(initialParent, projectRoot);
  const cases = collectCaseAdmissions(initialParent);
  const implementationSnapshot = await loadImplementationSnapshot(projectRoot);
  const scopeFingerprint = sha256Canonical(createScope({
    parent,
    implementationSnapshot,
    cases
  }));
  const executionFingerprint = createGi088ExtensionRecordReviewAdmissionExecutionFingerprint({
    scopeFingerprint,
    parent,
    implementationSnapshot,
    cases
  });
  const plan = {
    mode: "dry-run" as const,
    round_id: ADMISSION_ROUND_ID,
    scope_fingerprint: scopeFingerprint,
    execution_fingerprint: executionFingerprint,
    parent_execution_fingerprint: parent.execution_fingerprint,
    selected_cases: cases.map((item) => ({
      case_id: item.case_id,
      candidate_id: item.candidate_id,
      normalized: item.normalized,
      normalization_fingerprint: item.normalization_fingerprint
    })),
    model_calls_executed: 0 as const,
    model_calls_maximum: 0 as const,
    required_execute_confirmation: {
      private_replay: true,
      scope_fingerprint: scopeFingerprint,
      parent_execution_fingerprint: parent.execution_fingerprint
    }
  };
  if (options.mode === "dry-run") return { plan, outputWritten: false as const };
  if (!options.confirmPrivateReplay
    || options.confirmScopeFingerprint !== scopeFingerprint
    || options.confirmParentExecutionFingerprint !== parent.execution_fingerprint) {
    fail("GI088_EXTENSION_RECORD_ADMISSION_CONFIRMATION_INCOMPLETE");
  }

  const outputDirectory = options.outputId
    ? resolve(projectRoot, FORMAL_ADMISSION_ROOT_RELATIVE, options.outputId)
    : defaultOutputDirectory(projectRoot, scopeFingerprint);
  await ensureFreshOutputDirectory(outputDirectory, projectRoot);
  const packagePath = resolve(outputDirectory, "review-admission-package.json");
  const ledgerPath = resolve(outputDirectory, "review-admission-ledger.ndjson");
  const lockPath = resolve(outputDirectory, "review-admission-run.lock.json");
  const manifestPath = resolve(outputDirectory, "commit-manifest.json");

  await writePrivateJsonAtomic(lockPath, {
    status: "reserved",
    mode: "zero_model_call",
    reserved_at: now().toISOString(),
    round_id: ADMISSION_ROUND_ID,
    scope_fingerprint: scopeFingerprint,
    parent_execution_fingerprint: parent.execution_fingerprint,
    model_calls: 0
  });
  try {
    await appendPrivateLedger(ledgerPath, {
      event: "parent_revalidation_started",
      at: now().toISOString(),
      parent_execution_fingerprint: parent.execution_fingerprint,
      model_calls: 0
    });
    const finalParent = await loadValidatedParent({
      parentDirectory,
      allowMockParent: options.allowMockParent,
      projectRoot
    });
    const finalParentMetadata = parentFromLoaded(finalParent, projectRoot);
    const finalCases = collectCaseAdmissions(finalParent);
    if (sha256Canonical(finalParentMetadata) !== sha256Canonical(parent)
      || sha256Canonical(finalCases) !== sha256Canonical(cases)) {
      fail("GI088_EXTENSION_RECORD_ADMISSION_PARENT_CHANGED");
    }
    for (const admission of cases) {
      await appendPrivateLedger(ledgerPath, {
        event: "record_review_admitted",
        at: now().toISOString(),
        case_id: admission.case_id,
        candidate_id: admission.candidate_id,
        raw_response_sha256: admission.raw_response_sha256,
        record_card_sha256: admission.record_card_sha256,
        normalized: admission.normalized,
        normalization_fingerprint: admission.normalization_fingerprint,
        model_calls: 0
      });
    }
    const resultPackage: Gi088ExtensionRecordReviewAdmissionPackage = {
      schema_version: "1.0",
      privacy_classification: "private_local_only",
      extension_version: GI088_HUMAN_EXTENSION_VERSION,
      round_id: ADMISSION_ROUND_ID,
      generated_at: now().toISOString(),
      mode: "zero_model_call",
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      model_calls: { actual: 0, maximum: 0 },
      parent,
      admission_policy: {
        version: GI088_EXTENSION_RECORD_REVIEW_ADMISSION_VERSION,
        only_permitted_normalization:
          "adjacent_event_and_insight_blocks_compiled_without_semantic_change"
      },
      implementation_snapshot: implementationSnapshot,
      cases
    };
    const packageContent = `${JSON.stringify(resultPackage, null, 2)}\n`;
    const temporaryPackage = resolve(outputDirectory, `.review-admission-package.${process.pid}.tmp`);
    await writePrivateFile(temporaryPackage, packageContent);
    await rename(temporaryPackage, packagePath);
    await chmod(packagePath, 0o600);
    const packageSha256 = sha256Text(packageContent);
    await writePrivateJsonAtomic(lockPath, {
      status: "completed",
      mode: "zero_model_call",
      completed_at: now().toISOString(),
      round_id: ADMISSION_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      parent_execution_fingerprint: parent.execution_fingerprint,
      package_sha256: packageSha256,
      model_calls: 0
    });
    const [admissionLedgerSha256, runLockSha256] = await Promise.all([
      sha256File(ledgerPath),
      sha256File(lockPath)
    ]);
    const manifest: Gi088ExtensionRecordReviewAdmissionCommitManifest = {
      schema_version: "1.0",
      status: "committed",
      committed_at: now().toISOString(),
      round_id: ADMISSION_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      execution_fingerprint: executionFingerprint,
      parent,
      child_artifacts: {
        package_sha256: packageSha256,
        admission_ledger_sha256: admissionLedgerSha256,
        run_lock_sha256: runLockSha256
      },
      files: {
        package: "review-admission-package.json",
        admission_ledger: "review-admission-ledger.ndjson",
        run_lock: "review-admission-run.lock.json"
      },
      model_calls: { actual: 0, maximum: 0 }
    };
    // The manifest is the final write and proves all private child files exist.
    await writePrivateJsonAtomic(manifestPath, manifest);
    return {
      package: resultPackage,
      manifest,
      outputWritten: true as const,
      outputDirectory,
      manifestPath,
      scopeFingerprint,
      executionFingerprint
    };
  } catch (error) {
    await writePrivateJsonAtomic(lockPath, {
      status: "failed",
      mode: "zero_model_call",
      failed_at: now().toISOString(),
      round_id: ADMISSION_ROUND_ID,
      scope_fingerprint: scopeFingerprint,
      parent_execution_fingerprint: parent.execution_fingerprint,
      model_calls: 0,
      error_code: safeGi088ExtensionRecordReviewAdmissionErrorCode(error)
    }).catch(() => undefined);
    throw error;
  }
}

export async function loadCommittedGi088ExtensionRecordReviewAdmission(
  directory: string,
  projectRoot = process.cwd(),
  options: { allowMockParent?: boolean } = {}
): Promise<LoadedGi088ExtensionRecordReviewAdmission> {
  assertPrivateDirectory(directory, projectRoot);
  const paths = {
    package: resolve(directory, "review-admission-package.json"),
    ledger: resolve(directory, "review-admission-ledger.ndjson"),
    runLock: resolve(directory, "review-admission-run.lock.json"),
    manifest: resolve(directory, "commit-manifest.json")
  };
  const [resultPackage, manifest, runLock, ledger, packageSha, ledgerSha, lockSha, manifestSha] =
    await Promise.all([
      readJson<Gi088ExtensionRecordReviewAdmissionPackage>(
        paths.package,
        "GI088_EXTENSION_RECORD_ADMISSION_PACKAGE_INVALID"
      ),
      readJson<Gi088ExtensionRecordReviewAdmissionCommitManifest>(
        paths.manifest,
        "GI088_EXTENSION_RECORD_ADMISSION_MANIFEST_INVALID"
      ),
      readJson<LoadedGi088ExtensionRecordReviewAdmission["runLock"]>(
        paths.runLock,
        "GI088_EXTENSION_RECORD_ADMISSION_LOCK_INVALID"
      ),
      readLedger(paths.ledger),
      sha256File(paths.package),
      sha256File(paths.ledger),
      sha256File(paths.runLock),
      sha256File(paths.manifest)
    ]);
  if (resultPackage.schema_version !== "1.0"
    || resultPackage.privacy_classification !== "private_local_only"
    || resultPackage.extension_version !== GI088_HUMAN_EXTENSION_VERSION
    || resultPackage.round_id !== ADMISSION_ROUND_ID
    || resultPackage.mode !== "zero_model_call"
    || resultPackage.model_calls.actual !== 0
    || resultPackage.model_calls.maximum !== 0
    || resultPackage.parent.round_id !== GI088_HUMAN_EXTENSION_RECORD_ROUND_ID
    || (resultPackage.parent.mode !== "real" && resultPackage.parent.mode !== "mock")
    || (!options.allowMockParent && resultPackage.parent.mode !== "real")
    || resultPackage.admission_policy.version !== GI088_EXTENSION_RECORD_REVIEW_ADMISSION_VERSION
    || resultPackage.admission_policy.only_permitted_normalization
      !== "adjacent_event_and_insight_blocks_compiled_without_semantic_change"
    || resultPackage.implementation_snapshot.length !== ADMISSION_IMPLEMENTATION_FILES.length
    || resultPackage.implementation_snapshot.map((item) => item.path).join("\n")
      !== ADMISSION_IMPLEMENTATION_FILES.join("\n")
    || resultPackage.implementation_snapshot.some((item) => !/^[a-f0-9]{64}$/u.test(item.sha256))
    || resultPackage.cases.length !== 6
    || resultPackage.cases.some((item) => !item.review_ready)
    || manifest.schema_version !== "1.0"
    || manifest.status !== "committed"
    || manifest.round_id !== ADMISSION_ROUND_ID
    || manifest.scope_fingerprint !== resultPackage.scope_fingerprint
    || manifest.execution_fingerprint !== resultPackage.execution_fingerprint
    || sha256Canonical(manifest.parent) !== sha256Canonical(resultPackage.parent)
    || manifest.child_artifacts.package_sha256 !== packageSha
    || manifest.child_artifacts.admission_ledger_sha256 !== ledgerSha
    || manifest.child_artifacts.run_lock_sha256 !== lockSha
    || manifest.files.package !== "review-admission-package.json"
    || manifest.files.admission_ledger !== "review-admission-ledger.ndjson"
    || manifest.files.run_lock !== "review-admission-run.lock.json"
    || manifest.model_calls.actual !== 0
    || manifest.model_calls.maximum !== 0
    || runLock.status !== "completed"
    || runLock.mode !== "zero_model_call"
    || runLock.round_id !== ADMISSION_ROUND_ID
    || runLock.scope_fingerprint !== resultPackage.scope_fingerprint
    || runLock.execution_fingerprint !== resultPackage.execution_fingerprint
    || runLock.parent_execution_fingerprint !== resultPackage.parent.execution_fingerprint
    || runLock.package_sha256 !== packageSha
    || runLock.model_calls !== 0) {
    fail("GI088_EXTENSION_RECORD_ADMISSION_COMMIT_INVALID");
  }
  const parentDirectory = resolve(projectRoot, resultPackage.parent.directory);
  const parent = await loadValidatedParent({
    parentDirectory,
    allowMockParent: options.allowMockParent ?? false,
    projectRoot
  });
  const expectedParent = parentFromLoaded(parent, projectRoot);
  const expectedCases = collectCaseAdmissions(parent);
  const currentImplementationSnapshot = await loadImplementationSnapshot(projectRoot);
  const expectedScope = sha256Canonical(createScope({
    parent: expectedParent,
    implementationSnapshot: currentImplementationSnapshot,
    cases: expectedCases
  }));
  const expectedExecution = createGi088ExtensionRecordReviewAdmissionExecutionFingerprint({
    scopeFingerprint: expectedScope,
    parent: expectedParent,
    implementationSnapshot: currentImplementationSnapshot,
    cases: expectedCases
  });
  const expectedLedgerAdmissions = expectedCases.map((item) => ({
    case_id: item.case_id,
    candidate_id: item.candidate_id,
    raw_response_sha256: item.raw_response_sha256,
    record_card_sha256: item.record_card_sha256,
    normalized: item.normalized,
    normalization_fingerprint: item.normalization_fingerprint,
    model_calls: 0
  }));
  const actualLedgerAdmissions = ledger
    .filter((event) => event.event === "record_review_admitted")
    .map((event) => ({
      case_id: event.case_id,
      candidate_id: event.candidate_id,
      raw_response_sha256: event.raw_response_sha256,
      record_card_sha256: event.record_card_sha256,
      normalized: event.normalized,
      normalization_fingerprint: event.normalization_fingerprint,
      model_calls: event.model_calls
    }));
  if (ledger.length !== 7
    || ledger[0]?.event !== "parent_revalidation_started"
    || ledger.some((event) => event.model_calls !== 0 || event.event === "call_reserved")
    || sha256Canonical(actualLedgerAdmissions) !== sha256Canonical(expectedLedgerAdmissions)
    || sha256Canonical(currentImplementationSnapshot)
      !== sha256Canonical(resultPackage.implementation_snapshot)
    || sha256Canonical(expectedParent) !== sha256Canonical(resultPackage.parent)
    || sha256Canonical(expectedCases) !== sha256Canonical(resultPackage.cases)
    || expectedScope !== resultPackage.scope_fingerprint
    || expectedExecution !== resultPackage.execution_fingerprint) {
    fail("GI088_EXTENSION_RECORD_ADMISSION_PARENT_BINDING_INVALID");
  }
  return {
    directory,
    package: resultPackage,
    manifest,
    runLock,
    artifactSha256: {
      package: packageSha,
      manifest: manifestSha,
      admission_ledger: ledgerSha,
      run_lock: lockSha
    }
  };
}

function argumentValue(argv: string[], index: number, flag: string) {
  const argument = argv[index];
  if (argument.startsWith(`${flag}=`)) {
    return { value: argument.slice(flag.length + 1), consumed: 0 };
  }
  const next = argv[index + 1];
  if (argument === flag && next && !next.startsWith("--")) {
    return { value: next, consumed: 1 };
  }
  fail("GI088_EXTENSION_RECORD_ADMISSION_ARGUMENT_VALUE_REQUIRED");
}

export function parseGi088ExtensionRecordReviewAdmissionArgs(
  argv: string[]
): Gi088ExtensionRecordReviewAdmissionOptions {
  const options: Gi088ExtensionRecordReviewAdmissionOptions = {
    mode: "dry-run",
    confirmPrivateReplay: false,
    confirmScopeFingerprint: null,
    confirmParentExecutionFingerprint: null,
    parentDirectory: null,
    outputId: null,
    allowMockParent: false
  };
  let modeExplicit = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") {
      if (modeExplicit) fail("GI088_EXTENSION_RECORD_ADMISSION_MODE_DUPLICATE");
      options.mode = "execute";
      modeExplicit = true;
    } else if (argument === "--confirm-private-replay") {
      options.confirmPrivateReplay = true;
    } else if (argument === "--confirm-scope" || argument.startsWith("--confirm-scope=")) {
      const parsed = argumentValue(argv, index, "--confirm-scope");
      options.confirmScopeFingerprint = parsed.value;
      index += parsed.consumed;
    } else if (argument === "--confirm-parent-execution"
      || argument.startsWith("--confirm-parent-execution=")) {
      const parsed = argumentValue(argv, index, "--confirm-parent-execution");
      options.confirmParentExecutionFingerprint = parsed.value;
      index += parsed.consumed;
    } else if (argument === "--parent-directory" || argument.startsWith("--parent-directory=")) {
      const parsed = argumentValue(argv, index, "--parent-directory");
      options.parentDirectory = parsed.value;
      index += parsed.consumed;
    } else if (argument === "--output-id" || argument.startsWith("--output-id=")) {
      const parsed = argumentValue(argv, index, "--output-id");
      options.outputId = parsed.value;
      index += parsed.consumed;
    } else {
      fail(`GI088_EXTENSION_RECORD_ADMISSION_ARGUMENT_INVALID:${argument}`);
    }
  }
  if (options.outputId && !/^[a-z0-9][a-z0-9-]{2,90}$/u.test(options.outputId)) {
    fail("GI088_EXTENSION_RECORD_ADMISSION_OUTPUT_ID_INVALID");
  }
  if (options.mode === "execute" && (!options.confirmPrivateReplay
    || !options.confirmScopeFingerprint
    || !options.confirmParentExecutionFingerprint)) {
    fail("GI088_EXTENSION_RECORD_ADMISSION_EXACT_CONFIRMATION_REQUIRED");
  }
  return options;
}

export function safeGi088ExtensionRecordReviewAdmissionErrorCode(error: unknown) {
  if (error instanceof Gi088ExtensionRecordReviewAdmissionError) return error.code;
  return "GI088_EXTENSION_RECORD_ADMISSION_UNEXPECTED_ERROR";
}

export async function mainGi088ExtensionRecordReviewAdmissionCli() {
  const options = parseGi088ExtensionRecordReviewAdmissionArgs(process.argv.slice(2));
  const result = await runGi088HumanExtensionRecordReviewAdmission(options);
  if ("plan" in result) {
    process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\n`);
    return;
  }
  const manifestSha = await sha256File(result.manifestPath);
  process.stdout.write(`${JSON.stringify({
    status: "committed",
    model_calls: 0,
    scope_fingerprint: result.scopeFingerprint,
    execution_fingerprint: result.executionFingerprint,
    commit_manifest_sha256: manifestSha,
    output_directory: relative(process.cwd(), result.outputDirectory)
  }, null, 2)}\n`);
}

export async function inspectGi088ExtensionRecordReviewAdmissionFileModes(directory: string) {
  const names = [
    "review-admission-package.json",
    "review-admission-ledger.ndjson",
    "review-admission-run.lock.json",
    "commit-manifest.json"
  ];
  const [directoryStat, ...fileStats] = await Promise.all([
    stat(directory),
    ...names.map((name) => stat(resolve(directory, name)))
  ]);
  return {
    directory: directoryStat.mode & 0o777,
    files: fileStats.map((item) => item.mode & 0o777)
  };
}
