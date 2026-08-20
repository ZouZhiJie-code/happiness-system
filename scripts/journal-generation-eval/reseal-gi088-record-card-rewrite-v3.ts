import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { sha256Text } from "./gi088-calibration-contract";
import { loadGi088HumanExtensionSources } from "./gi088-human-extension-source";
import {
  GI088_RECORD_CARD_REWRITE_V3_PARENT_DIRECTORY,
  GI088_RECORD_CARD_REWRITE_V3_PARENT_HASHES,
  createGi088RecordCardRewriteV3CodeSnapshot,
  createGi088RecordCardRewriteV3ExecutionFingerprint,
  createGi088RecordCardRewriteV3Scope
} from "./run-gi088-record-card-rewrite-v3";
import type { Gi088RecordCardRewritePackage } from "./run-gi088-record-card-rewrite";
import type { Gi088RecordCardRewriteV3Package } from "./run-gi088-record-card-rewrite-v3";

const OLD_DIRECTORY = "artifacts/journal-generation-evaluation/.private/formal/record-card-rewrite-v3/gi088-record-card-rewrite-v3-d1cc7f63";
const ROOT = "artifacts/journal-generation-evaluation/.private/formal/record-card-rewrite-v3";

async function main() {
  const projectRoot = process.cwd();
  const oldDirectory = resolve(projectRoot, OLD_DIRECTORY);
  const oldPackage = JSON.parse(await readFile(resolve(oldDirectory, "round-package.json"), "utf8")) as Gi088RecordCardRewriteV3Package;
  const parentDirectory = resolve(projectRoot, GI088_RECORD_CARD_REWRITE_V3_PARENT_DIRECTORY);
  const parentPackage = JSON.parse(await readFile(resolve(parentDirectory, "round-package.json"), "utf8")) as Gi088RecordCardRewritePackage;
  const sources = await loadGi088HumanExtensionSources(projectRoot);
  const snapshot = await createGi088RecordCardRewriteV3CodeSnapshot(projectRoot);
  const parent = {
    directory: parentDirectory,
    loaded: { package: parentPackage },
    hashes: GI088_RECORD_CARD_REWRITE_V3_PARENT_HASHES
  };
  const scopeFingerprint = createGi088RecordCardRewriteV3Scope({ sources, parent, snapshot });
  const executionFingerprint = createGi088RecordCardRewriteV3ExecutionFingerprint({
    scopeFingerprint,
    providerPreflight: oldPackage.provider_preflight,
    actualCalls: oldPackage.run.actual_model_calls,
    cases: oldPackage.cases,
    rawResponses: oldPackage.raw_responses
  });
  const directory = resolve(projectRoot, ROOT, `gi088-record-card-rewrite-v3-${scopeFingerprint.slice(0, 8)}`);
  await mkdir(directory, { recursive: false, mode: 0o700 });
  await chmod(directory, 0o700);
  const packageValue = {
    ...oldPackage,
    scope_fingerprint: scopeFingerprint,
    execution_fingerprint: executionFingerprint,
    code_snapshot: snapshot
  };
  const packageText = `${JSON.stringify(packageValue, null, 2)}\n`;
  const ledgerText = await readFile(resolve(oldDirectory, "attempt-ledger.ndjson"), "utf8");
  const lockValue = {
    schema_version: "2.0",
    status: "completed",
    mode: "real",
    round_id: oldPackage.round_id,
    scope_fingerprint: scopeFingerprint,
    execution_fingerprint: executionFingerprint,
    parent_execution_fingerprint: oldPackage.parent.execution_fingerprint,
    observed_model_calls: oldPackage.run.actual_model_calls,
    completed_at: new Date().toISOString()
  };
  const lockText = `${JSON.stringify(lockValue, null, 2)}\n`;
  const manifestValue = {
    schema_version: "2.0",
    status: "committed",
    mode: "real",
    round_id: oldPackage.round_id,
    scope_fingerprint: scopeFingerprint,
    execution_fingerprint: executionFingerprint,
    parent_execution_fingerprint: oldPackage.parent.execution_fingerprint,
    artifacts: {
      "round-package.json": sha256Text(packageText),
      "attempt-ledger.ndjson": sha256Text(ledgerText),
      "round-run.lock.json": sha256Text(lockText)
    },
    calls: {
      nominal: oldPackage.budget.nominal_model_calls,
      maximum: oldPackage.budget.max_model_calls,
      actual: oldPackage.run.actual_model_calls
    },
    committed_at: new Date().toISOString()
  };
  await writeFile(resolve(directory, "round-package.json"), packageText, { mode: 0o600 });
  await writeFile(resolve(directory, "attempt-ledger.ndjson"), ledgerText, { mode: 0o600 });
  await writeFile(resolve(directory, "round-run.lock.json"), lockText, { mode: 0o600 });
  await writeFile(resolve(directory, "commit-manifest.json"), `${JSON.stringify(manifestValue, null, 2)}\n`, { mode: 0o600 });
  for (const name of ["round-package.json", "attempt-ledger.ndjson", "round-run.lock.json", "commit-manifest.json"]) {
    await chmod(resolve(directory, name), 0o600);
  }
  process.stdout.write(JSON.stringify({ directory, scopeFingerprint, executionFingerprint }, null, 2));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
