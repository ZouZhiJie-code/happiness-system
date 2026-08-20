import { describe, expect, it } from "vitest";

import { loadGi088ResponseFirstV22Cases } from "../../scripts/gi088-response-first-v2-2-fixtures";
import {
  GI088_RESPONSE_FIRST_V22_RUBRIC_V13_DATASET_VERSION,
  loadGi088ResponseFirstV22RubricV13Cases
} from "../../scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures";

describe("GI-088 response-first v2.2 product-owner rubric v1.3", () => {
  it("changes only evaluation metadata while preserving every model input", async () => {
    const parent = await loadGi088ResponseFirstV22Cases();
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    expect(dataset.datasetVersion)
      .toBe(GI088_RESPONSE_FIRST_V22_RUBRIC_V13_DATASET_VERSION);
    expect(dataset.parentDatasetVersion).toBe(parent.datasetVersion);
    expect(dataset.parentDatasetFingerprint).toBe(parent.datasetFingerprint);
    expect(dataset.datasetFingerprint).not.toBe(parent.datasetFingerprint);
    expect(dataset.cases.map((item) => item.turnInput))
      .toEqual(parent.cases.map((item) => item.turnInput));
    expect(dataset.cases.map((item) => item.sourceFingerprint))
      .toEqual(parent.cases.map((item) => item.sourceFingerprint));
  });

  it("records the two latest product-owner quality boundaries", async () => {
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    const relationship = dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-13"
    );
    const correctionContinued = dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-19-CONTINUE"
    );
    expect(relationship?.expectedBehavior).toContain("自然");
    expect(relationship?.expectedBehavior).toContain("同义表达");
    expect(correctionContinued?.expectedBehavior).toContain("简短重提");
    expect(correctionContinued?.prohibitedRisks)
      .toContain("恢复已经被用户否定的接纳理解");
  });
});
