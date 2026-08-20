import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { importPrivateExports } from "../../scripts/journal-generation-eval/private-export-importer";

describe("journal generation private importer", () => {
  it("正式索引以 5 个主导出承载 9 条轨迹，并单列副本与派生基线", async () => {
    const sourceIndex = JSON.parse(await readFile(
      resolve(process.cwd(), "artifacts/journal-generation-evaluation/private-source-index.json"),
      "utf8"
    )) as { sources: Array<{ evaluation_inclusion: string; completed_trajectory_count: number }> };
    const primary = sourceIndex.sources.filter((source) => source.evaluation_inclusion === "primary_trajectory_source");
    expect(primary).toHaveLength(5);
    expect(primary.reduce((sum, source) => sum + source.completed_trajectory_count, 0)).toBe(9);
    expect(sourceIndex.sources.filter((source) => source.evaluation_inclusion === "deduplicated_copy")).toHaveLength(2);
    expect(sourceIndex.sources.filter((source) => source.evaluation_inclusion === "excluded_derived_baseline")).toHaveLength(2);
  });

  it("校验哈希、排除副本与派生快照，并按 task/branch 展开轨迹", async () => {
    const root = await mkdtemp(join(tmpdir(), "journal-eval-import-"));
    const secret = "SECRET_PRIVATE_DIALOGUE";
    const trajectoryPayload = JSON.stringify({
      batch: {
        tasks: [
          { taskId: "T1", branches: { high: { status: "completed", messages: [{ id: "u1", role: "user", content: secret }] } } },
          { taskId: "T2", branches: { high: { status: "completed", messages: [{ id: "u2", role: "user", content: secret }] } } }
        ]
      }
    });
    const derivedPayload = JSON.stringify({ schemaVersion: "1.0", summary: { secret } });
    const trajectorySha = createHash("sha256").update(trajectoryPayload).digest("hex");
    const derivedSha = createHash("sha256").update(derivedPayload).digest("hex");
    await Promise.all([
      writeFile(join(root, "primary.json"), trajectoryPayload),
      writeFile(join(root, "copy.json"), trajectoryPayload),
      writeFile(join(root, "baseline.json"), derivedPayload)
    ]);
    const sourceIndexPath = join(root, "source-index.json");
    await writeFile(sourceIndexPath, JSON.stringify({
      schema_version: "1.0",
      sources: [
        { source_id: "primary", source_group_id: "sg-test", expected_filename: "primary.json", sha256: trajectorySha, file_size_bytes: trajectoryPayload.length, record_type: "trajectory", derivation_type: null, synthetic: false, evaluation_inclusion: "primary_trajectory_source", completed_trajectory_count: 2, locator_hint: "test", duplicate_of_source_id: null },
        { source_id: "copy", source_group_id: "sg-test", expected_filename: "copy.json", sha256: trajectorySha, file_size_bytes: trajectoryPayload.length, record_type: "trajectory", derivation_type: "sealed_copy", synthetic: false, evaluation_inclusion: "deduplicated_copy", completed_trajectory_count: 0, locator_hint: "test", duplicate_of_source_id: "primary" },
        { source_id: "baseline", source_group_id: "sg-baseline", expected_filename: "baseline.json", sha256: derivedSha, file_size_bytes: derivedPayload.length, record_type: "derived", derivation_type: "baseline_before", synthetic: false, evaluation_inclusion: "excluded_derived_baseline", completed_trajectory_count: 0, locator_hint: "test", duplicate_of_source_id: null }
      ]
    }));
    const outputPath = join(root, "private", "manifest.json");

    const manifest = await importPrivateExports({
      sourceIndexPath,
      sourceDirs: [root],
      outputPath,
      strict: true,
      generatedAt: "2026-08-10T00:00:00.000Z"
    });

    expect(manifest.summary.primary_trajectory_export_count).toBe(1);
    expect(manifest.summary.deduplicated_copy_count).toBe(1);
    expect(manifest.summary.excluded_derived_baseline_count).toBe(1);
    expect(manifest.trajectory_cases.map((item) => item.source_task_id)).toEqual(["T1", "T2"]);
    expect(await readFile(outputPath, "utf8")).not.toContain(secret);
  });
});
