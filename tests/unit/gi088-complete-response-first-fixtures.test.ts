import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createBoard7bWorkingTaskV1InitialSemanticState } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_COMPLETE_RESPONSE_FIRST_CASE_IDS,
  GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT,
  GI088_COMPLETE_RESPONSE_FIRST_DATASET_VERSION,
  GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS,
  GI088_COMPLETE_RESPONSE_FIRST_PRIVATE_CASES,
  GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS,
  loadGi088CompleteResponseFirstCases
} from "../../scripts/gi088-complete-response-first-fixtures";

const MESSAGE_COUNTS = {
  "RPR-REAL-01": 4,
  "RPR-REAL-05": 4,
  "RPR-REAL-11": 4,
  "RPR-REAL-13": 2,
  "RPR-REAL-22": 2,
  "RPR-CF-03": 2,
  "RPR-REAL-21": 16,
  "RPR-REAL-19": 8
} as const;

async function isolatedFixtureWorkspace() {
  const cwd = await mkdtemp(path.join(tmpdir(), "gi088-complete-response-first-"));
  for (const relativePath of [
    GI088_COMPLETE_RESPONSE_FIRST_PRIVATE_CASES,
    GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT
  ]) {
    const target = path.join(cwd, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(process.cwd(), relativePath), target);
  }
  return cwd;
}

describe("GI-088 complete-response-first fixtures", () => {
  it("binds the ordered three-case development and five-case regression sets", async () => {
    const dataset = await loadGi088CompleteResponseFirstCases();

    expect(dataset.datasetVersion)
      .toBe(GI088_COMPLETE_RESPONSE_FIRST_DATASET_VERSION);
    expect(dataset.developmentCases.map((item) => item.caseId))
      .toEqual([...GI088_COMPLETE_RESPONSE_FIRST_DEVELOPMENT_CASE_IDS]);
    expect(dataset.regressionCases.map((item) => item.caseId))
      .toEqual([...GI088_COMPLETE_RESPONSE_FIRST_REGRESSION_CASE_IDS]);
    expect(dataset.cases.map((item) => item.caseId))
      .toEqual([...GI088_COMPLETE_RESPONSE_FIRST_CASE_IDS]);
    expect(dataset.cases.at(-1)?.caseId).toBe("RPR-REAL-19");
    expect(dataset.cases.every(
      (item) => item.privacyLevel === "private_sensitive"
    )).toBe(true);
    expect(dataset.datasetFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("keeps every complete candidate input and starts from an empty semantic state", async () => {
    const dataset = await loadGi088CompleteResponseFirstCases();
    const initialState = createBoard7bWorkingTaskV1InitialSemanticState();

    for (const item of dataset.cases) {
      expect(item.turnInput.conversation)
        .toHaveLength(MESSAGE_COUNTS[item.caseId]);
      expect(item.turnInput.conversation.at(-1)).toMatchObject({
        id: item.turnInput.latestUserMessageId,
        role: "user"
      });
      expect(item.turnInput.semanticState).toEqual(initialState);
    }
    expect(dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-21"
    )?.turnInput.conversation).toHaveLength(16);
    expect(dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-19"
    )?.turnInput.conversation).toHaveLength(8);
    expect(dataset.cases.some((item) => item.caseId.includes("CONTINUE")))
      .toBe(false);
  });

  it("uses complete-response rubrics and reserves zero questions for explicit stop", async () => {
    const dataset = await loadGi088CompleteResponseFirstCases();
    const byId = new Map(dataset.cases.map((item) => [item.caseId, item]));

    expect(dataset.cases.every(
      (item) => item.expectedBehavior.includes("完整可见回应")
    )).toBe(true);
    expect(byId.get("RPR-CF-03")).toMatchObject({
      split: "regression",
      category: "explicit_stop",
      hardGate: true
    });
    expect(byId.get("RPR-CF-03")?.expectedBehavior).toContain("零问题");
    expect(byId.get("RPR-REAL-19")?.expectedBehavior).toContain("提出一个");
    expect(byId.get("RPR-REAL-13")?.expectedBehavior)
      .toContain("自然、符合中文习惯的语义转化");
    expect(byId.get("RPR-REAL-21")?.hardGate).toBe(true);
    expect(byId.get("RPR-REAL-22")?.hardGate).toBe(true);
    expect(dataset.cases.every((item) => item.prohibitedRisks.length >= 3))
      .toBe(true);
  });

  it("rejects any drift in the frozen private source", async () => {
    const cwd = await isolatedFixtureWorkspace();
    try {
      const file = path.join(cwd, GI088_COMPLETE_RESPONSE_FIRST_PRIVATE_CASES);
      const source = await readFile(file, "utf8");
      await writeFile(file, `${source}\n`);

      await expect(loadGi088CompleteResponseFirstCases(cwd))
        .rejects.toThrow("GI088_COMPLETE_RESPONSE_FIRST_PRIVATE_DATASET_DRIFT");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects any drift in the frozen public receipt", async () => {
    const cwd = await isolatedFixtureWorkspace();
    try {
      const file = path.join(
        cwd,
        GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT
      );
      const source = await readFile(file, "utf8");
      await writeFile(file, `${source}\n`);

      await expect(loadGi088CompleteResponseFirstCases(cwd))
        .rejects.toThrow("GI088_COMPLETE_RESPONSE_FIRST_DATASET_RECEIPT_DRIFT");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
