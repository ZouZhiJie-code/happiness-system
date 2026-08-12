import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { evaluateDataset } from "../../scripts/journal-generation-eval/static-evaluator";
import type { JournalEvaluationDataset } from "../../scripts/journal-generation-eval/types";

describe("journal generation static evaluator", () => {
  it("评测 10 个独立两层种子案例，并为每案保留一个硬门通过候选", async () => {
    const dataset = JSON.parse(await readFile(
      resolve(process.cwd(), "artifacts/journal-generation-evaluation/seed-cases.json"),
      "utf8"
    )) as JournalEvaluationDataset;

    expect(dataset.cases).toHaveLength(10);
    expect(new Set(dataset.cases.map((item) => item.source_group_id)).size).toBe(10);
    expect(dataset.cases.every((item) => item.record_cards.length > 0)).toBe(true);
    expect(dataset.cases.every((item) => Array.isArray(item.daily_input.new_records))).toBe(true);

    const report = evaluateDataset(dataset);
    expect(report.case_count).toBe(10);
    expect(report.candidate_count).toBe(20);
    expect(report.admitted_candidate_count).toBe(10);
    expect(report.human_review_eligible_case_count).toBe(0);
    expect(report.cases.every((item) => item.eligible_for_human_review === false)).toBe(true);
    expect(report.cases.every((item) => item.candidates.filter((candidate) => candidate.admitted).length === 1)).toBe(true);
  });

  it("同时阻断记录卡规则错误与更新失败覆盖旧稿", async () => {
    const dataset = JSON.parse(await readFile(
      resolve(process.cwd(), "artifacts/journal-generation-evaluation/seed-cases.json"),
      "utf8"
    )) as JournalEvaluationDataset;
    const report = evaluateDataset(dataset);
    const correction = report.cases.find((item) => item.case_id === "seed-08-correction");
    const updateFailure = report.cases.find((item) => item.case_id === "seed-10-update-failure");

    expect(correction?.candidates[1].failures.map((failure) => failure.code)).toContain("CORRECTION_NOT_APPLIED");
    expect(updateFailure?.candidates[1].failures.map((failure) => failure.code)).toContain("COMMITTED_DRAFT_NOT_PRESERVED");
  });
});
