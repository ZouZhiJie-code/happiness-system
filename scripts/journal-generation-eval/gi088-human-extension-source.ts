import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import {
  GI088_HUMAN_EXTENSION_CASES,
  GI088_HUMAN_EXTENSION_COMPLETED_CALIBRATION_MANIFEST_SHA256,
  GI088_HUMAN_EXTENSION_EXCLUDED_CASE_IDS
} from "./gi088-human-extension-contract";
import {
  projectGi088CalibrationSource,
  type LoadedGi088CalibrationCase
} from "./gi088-calibration-runner";
import { sha256File } from "./private-export-importer";

interface ImportedManifest {
  schema_version: "1.0";
  privacy_classification: "private_local_only";
  source_files: Array<{
    source_id: string;
    source_group_id: string;
    sha256: string;
    actual_sha256: string | null;
    resolved_path: string | null;
    import_status: "matched" | "missing";
    synthetic: boolean;
    evaluation_inclusion: string;
  }>;
  trajectory_cases: Array<{
    case_id: string;
    source_group_id: string;
    source_id: string;
    source_file_sha256: string;
    record_type: "trajectory";
    synthetic: false;
    source_task_id: string;
    branch: string;
    trajectory_status: string;
  }>;
}

export interface Gi088CompletedCalibrationSeal {
  manifest_path: string;
  manifest_sha256: string;
  execution_fingerprint: string;
  completed_case_ids: string[];
  artifacts: Record<string, string>;
}

export interface Gi088HumanExtensionSourceBundle {
  sources: LoadedGi088CalibrationCase[];
  importedManifestPath: string;
  importedManifestSha256: string;
  completedCalibration: Gi088CompletedCalibrationSeal;
}

const IMPORTED_MANIFEST_RELATIVE =
  "artifacts/journal-generation-evaluation/.private/imported-manifest.json";
const COMPLETED_CALIBRATION_ROOT_RELATIVE =
  "artifacts/journal-generation-evaluation/.private/formal/rounds/flash-daily-context-v3-72112e36";
const COMPLETION_MANIFEST_FILE = "review-completion-manifest.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function loadCompletedCalibrationSeal(
  projectRoot: string
): Promise<Gi088CompletedCalibrationSeal> {
  const root = resolve(projectRoot, COMPLETED_CALIBRATION_ROOT_RELATIVE);
  const manifestPath = resolve(root, COMPLETION_MANIFEST_FILE);
  const [manifestSha256, manifestText] = await Promise.all([
    sha256File(manifestPath),
    readFile(manifestPath, "utf8")
  ]);
  if (manifestSha256 !== GI088_HUMAN_EXTENSION_COMPLETED_CALIBRATION_MANIFEST_SHA256) {
    throw new Error("GI088_EXTENSION_COMPLETED_CALIBRATION_SEAL_CHANGED");
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestText) as unknown;
  } catch {
    throw new Error("GI088_EXTENSION_COMPLETED_CALIBRATION_MANIFEST_INVALID");
  }
  if (!isRecord(manifest)
    || manifest.schema_version !== "1.0"
    || manifest.status !== "completed"
    || typeof manifest.execution_fingerprint !== "string"
    || !isRecord(manifest.gate_summary)
    || manifest.gate_summary.passed !== true
    || manifest.gate_summary.ready_to_use_count !== 3
    || manifest.gate_summary.score_five_count !== 12
    || manifest.gate_summary.material_improvement_count !== 3
    || manifest.gate_summary.issue_tag_count !== 0
    || !isRecord(manifest.artifacts)) {
    throw new Error("GI088_EXTENSION_COMPLETED_CALIBRATION_MANIFEST_INVALID");
  }
  const artifacts = Object.fromEntries(Object.entries(manifest.artifacts).map(([name, hash]) => {
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/u.test(hash)) {
      throw new Error("GI088_EXTENSION_COMPLETED_CALIBRATION_ARTIFACT_INVALID");
    }
    return [name, hash];
  }));
  await Promise.all(Object.entries(artifacts).map(async ([name, expected]) => {
    if (await sha256File(resolve(root, name)) !== expected) {
      throw new Error(`GI088_EXTENSION_COMPLETED_CALIBRATION_ARTIFACT_CHANGED:${name}`);
    }
  }));
  return {
    manifest_path: manifestPath,
    manifest_sha256: manifestSha256,
    execution_fingerprint: manifest.execution_fingerprint,
    completed_case_ids: [...GI088_HUMAN_EXTENSION_EXCLUDED_CASE_IDS],
    artifacts
  };
}

export async function loadGi088HumanExtensionSources(
  projectRoot = process.cwd()
): Promise<Gi088HumanExtensionSourceBundle> {
  const importedManifestPath = resolve(projectRoot, IMPORTED_MANIFEST_RELATIVE);
  const [manifestText, importedManifestSha256, completedCalibration] = await Promise.all([
    readFile(importedManifestPath, "utf8"),
    sha256File(importedManifestPath),
    loadCompletedCalibrationSeal(projectRoot)
  ]);
  let manifest: ImportedManifest;
  try {
    manifest = JSON.parse(manifestText) as ImportedManifest;
  } catch {
    throw new Error("GI088_EXTENSION_IMPORTED_MANIFEST_INVALID");
  }
  if (manifest.schema_version !== "1.0"
    || manifest.privacy_classification !== "private_local_only") {
    throw new Error("GI088_EXTENSION_IMPORTED_MANIFEST_INVALID");
  }
  const selectedIds = GI088_HUMAN_EXTENSION_CASES.map((item) => item.caseId);
  if (selectedIds.some((caseId) =>
    GI088_HUMAN_EXTENSION_EXCLUDED_CASE_IDS.includes(
      caseId as (typeof GI088_HUMAN_EXTENSION_EXCLUDED_CASE_IDS)[number]
    ))) {
    throw new Error("GI088_EXTENSION_COMPLETED_CASE_RESELECTED");
  }
  const rawByPath = new Map<string, unknown>();
  const sources: LoadedGi088CalibrationCase[] = [];
  for (const selection of GI088_HUMAN_EXTENSION_CASES) {
    const trajectoryMatches = manifest.trajectory_cases.filter((item) =>
      item.case_id === selection.caseId
      && item.source_group_id === selection.sourceGroupId
      && item.source_id === selection.sourceId
      && item.source_file_sha256 === selection.sourceFileSha256
      && item.source_task_id === selection.taskId
      && item.branch === selection.branch
      && item.record_type === "trajectory"
      && item.synthetic === false
      && item.trajectory_status === "completed"
    );
    const sourceMatches = manifest.source_files.filter((item) =>
      item.source_id === selection.sourceId
      && item.source_group_id === selection.sourceGroupId
      && item.sha256 === selection.sourceFileSha256
      && item.actual_sha256 === selection.sourceFileSha256
      && item.import_status === "matched"
      && item.synthetic === false
      && item.evaluation_inclusion === "primary_trajectory_source"
      && typeof item.resolved_path === "string"
      && item.resolved_path.length > 0
    );
    if (trajectoryMatches.length !== 1 || sourceMatches.length !== 1) {
      throw new Error(`GI088_EXTENSION_SOURCE_SELECTION_INVALID:${selection.caseId}`);
    }
    const resolvedPath = await realpath(sourceMatches[0].resolved_path!);
    if (await sha256File(resolvedPath) !== selection.sourceFileSha256) {
      throw new Error(`GI088_EXTENSION_SOURCE_SHA256_MISMATCH:${selection.caseId}`);
    }
    let rawExport = rawByPath.get(resolvedPath);
    if (!rawExport) {
      rawExport = JSON.parse(await readFile(resolvedPath, "utf8")) as unknown;
      rawByPath.set(resolvedPath, rawExport);
    }
    sources.push(projectGi088CalibrationSource({
      selection,
      rawExport,
      actualSourceFileSha256: selection.sourceFileSha256
    }));
  }
  if (sources.length !== 6
    || new Set(sources.map((item) => item.selection.caseId)).size !== 6) {
    throw new Error("GI088_EXTENSION_SOURCE_SET_INVALID");
  }
  return {
    sources,
    importedManifestPath,
    importedManifestSha256,
    completedCalibration
  };
}

export async function assertGi088HumanExtensionSourcesUnchanged(
  expected: Gi088HumanExtensionSourceBundle,
  projectRoot = process.cwd()
) {
  const current = await loadGi088HumanExtensionSources(projectRoot);
  const expectedDigest = JSON.stringify({
    importedManifestSha256: expected.importedManifestSha256,
    completedCalibration: expected.completedCalibration,
    sources: expected.sources.map((source) => ({
      caseId: source.selection.caseId,
      sourceFileSha256: source.sourceFileSha256,
      sourceProjectionSha256: source.sourceProjectionSha256
    }))
  });
  const currentDigest = JSON.stringify({
    importedManifestSha256: current.importedManifestSha256,
    completedCalibration: current.completedCalibration,
    sources: current.sources.map((source) => ({
      caseId: source.selection.caseId,
      sourceFileSha256: source.sourceFileSha256,
      sourceProjectionSha256: source.sourceProjectionSha256
    }))
  });
  if (currentDigest !== expectedDigest) {
    throw new Error("GI088_EXTENSION_SOURCE_EVIDENCE_CHANGED");
  }
}
