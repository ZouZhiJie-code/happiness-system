import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export interface PrivateSourceIndexEntry {
  source_id: string;
  source_group_id: string;
  expected_filename: string;
  sha256: string;
  file_size_bytes: number;
  record_type: "trajectory" | "derived";
  derivation_type: string | null;
  synthetic: false;
  evaluation_inclusion:
    | "primary_trajectory_source"
    | "deduplicated_copy"
    | "excluded_derived_baseline";
  completed_trajectory_count: number;
  locator_hint: string;
  duplicate_of_source_id: string | null;
}

interface PrivateSourceIndex {
  schema_version: string;
  sources: PrivateSourceIndexEntry[];
}

export interface ImportedSourceFile extends PrivateSourceIndexEntry {
  import_status: "matched" | "missing";
  resolved_path: string | null;
  actual_sha256: string | null;
  actual_file_size_bytes: number | null;
}

export interface ImportedTrajectoryCase {
  case_id: string;
  source_group_id: string;
  source_id: string;
  source_file_sha256: string;
  record_type: "trajectory";
  synthetic: false;
  source_task_id: string;
  branch: string;
  trajectory_status: string;
}

export interface PrivateImportManifest {
  schema_version: "1.0";
  generated_at: string;
  privacy_classification: "private_local_only";
  source_files: ImportedSourceFile[];
  trajectory_cases: ImportedTrajectoryCase[];
  summary: {
    expected_source_count: number;
    matched_source_count: number;
    unique_content_count: number;
    primary_trajectory_export_count: number;
    deduplicated_copy_count: number;
    excluded_derived_baseline_count: number;
    trajectory_case_count: number;
  };
}

export interface ImportPrivateExportsOptions {
  sourceIndexPath: string;
  sourceDirs: string[];
  outputPath: string;
  dryRun?: boolean;
  strict?: boolean;
  generatedAt?: string;
}

export async function sha256File(filePath: string) {
  return await new Promise<string>((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

async function findKnownFiles(root: string, expectedBasenames: Set<string>, results: Map<string, string[]>) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") {
        continue;
      }
      await findKnownFiles(fullPath, expectedBasenames, results);
    } else if (entry.isFile() && expectedBasenames.has(entry.name)) {
      const paths = results.get(entry.name) ?? [];
      paths.push(resolve(fullPath));
      results.set(entry.name, paths);
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCompletedTrajectoryCases(
  raw: unknown,
  source: PrivateSourceIndexEntry
): ImportedTrajectoryCase[] {
  if (!isObject(raw) || !isObject(raw.batch) || !Array.isArray(raw.batch.tasks)) {
    throw new Error(`轨迹文件结构无效：${source.source_id}`);
  }

  const cases: ImportedTrajectoryCase[] = [];
  for (const task of raw.batch.tasks) {
    if (!isObject(task) || typeof task.taskId !== "string" || !isObject(task.branches)) {
      continue;
    }
    for (const [branch, trajectory] of Object.entries(task.branches)) {
      if (!isObject(trajectory) || trajectory.status !== "completed") {
        continue;
      }
      cases.push({
        case_id: `private:${source.source_group_id}:${task.taskId}:${branch}`,
        source_group_id: source.source_group_id,
        source_id: source.source_id,
        source_file_sha256: source.sha256,
        record_type: "trajectory",
        synthetic: false,
        source_task_id: task.taskId,
        branch,
        trajectory_status: "completed"
      });
    }
  }
  return cases;
}

export async function importPrivateExports(
  options: ImportPrivateExportsOptions
): Promise<PrivateImportManifest> {
  const sourceIndex = JSON.parse(await readFile(options.sourceIndexPath, "utf8")) as PrivateSourceIndex;
  if (!Array.isArray(sourceIndex.sources)) {
    throw new Error("私有来源索引缺少 sources。");
  }

  const expectedBasenames = new Set(sourceIndex.sources.map((source) => source.expected_filename));
  const discovered = new Map<string, string[]>();
  for (const sourceDir of options.sourceDirs) {
    await findKnownFiles(resolve(sourceDir), expectedBasenames, discovered);
  }

  const sourceFiles: ImportedSourceFile[] = [];
  const matchedPathBySourceId = new Map<string, string>();
  for (const source of sourceIndex.sources) {
    const candidates = discovered.get(source.expected_filename) ?? [];
    let match: { path: string; sha256: string; size: number } | null = null;
    const mismatches: string[] = [];
    for (const candidatePath of candidates) {
      const [actualSha256, fileStat] = await Promise.all([sha256File(candidatePath), stat(candidatePath)]);
      if (actualSha256 === source.sha256) {
        match = { path: candidatePath, sha256: actualSha256, size: fileStat.size };
        break;
      }
      mismatches.push(`${basename(candidatePath)}:${actualSha256}`);
    }

    if (!match && mismatches.length > 0) {
      throw new Error(`私有文件 SHA-256 不一致：${source.source_id} (${mismatches.join(", ")})`);
    }
    if (match) {
      matchedPathBySourceId.set(source.source_id, match.path);
    }
    sourceFiles.push({
      ...source,
      import_status: match ? "matched" : "missing",
      resolved_path: match?.path ?? null,
      actual_sha256: match?.sha256 ?? null,
      actual_file_size_bytes: match?.size ?? null
    });
  }

  const missing = sourceFiles.filter((source) => source.import_status === "missing");
  if ((options.strict ?? true) && missing.length > 0) {
    throw new Error(`缺少 ${missing.length} 份已知私有文件：${missing.map((source) => source.source_id).join(", ")}`);
  }

  const trajectoryCases: ImportedTrajectoryCase[] = [];
  for (const source of sourceIndex.sources) {
    const matchedPath = matchedPathBySourceId.get(source.source_id);
    if (!matchedPath || source.evaluation_inclusion !== "primary_trajectory_source") {
      continue;
    }
    const raw = JSON.parse(await readFile(matchedPath, "utf8")) as unknown;
    const sourceCases = readCompletedTrajectoryCases(raw, source);
    if (sourceCases.length !== source.completed_trajectory_count) {
      throw new Error(
        `轨迹展开数量不一致：${source.source_id}，期望 ${source.completed_trajectory_count}，实际 ${sourceCases.length}`
      );
    }
    trajectoryCases.push(...sourceCases);
  }

  const manifest: PrivateImportManifest = {
    schema_version: "1.0",
    generated_at: options.generatedAt ?? new Date().toISOString(),
    privacy_classification: "private_local_only",
    source_files: sourceFiles,
    trajectory_cases: trajectoryCases,
    summary: {
      expected_source_count: sourceFiles.length,
      matched_source_count: sourceFiles.filter((source) => source.import_status === "matched").length,
      unique_content_count: new Set(sourceFiles.flatMap((source) => source.actual_sha256 ? [source.actual_sha256] : [])).size,
      primary_trajectory_export_count: sourceFiles.filter((source) =>
        source.evaluation_inclusion === "primary_trajectory_source" && source.import_status === "matched"
      ).length,
      deduplicated_copy_count: sourceFiles.filter((source) =>
        source.evaluation_inclusion === "deduplicated_copy" && source.import_status === "matched"
      ).length,
      excluded_derived_baseline_count: sourceFiles.filter((source) =>
        source.evaluation_inclusion === "excluded_derived_baseline" && source.import_status === "matched"
      ).length,
      trajectory_case_count: trajectoryCases.length
    }
  };

  if (!options.dryRun) {
    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  return manifest;
}
