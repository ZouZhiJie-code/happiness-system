import { describe, expect, it } from "vitest";

import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_CASE_IDS,
  GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_DATASET_VERSION,
  loadGi088CompleteResponseFirstV16FreshStabilityCases
} from "../../scripts/gi088-complete-response-first-v1-6-fresh-stability-fixtures";
import { GI088_COMPLETE_RESPONSE_FIRST_CASE_IDS } from "../../scripts/gi088-complete-response-first-fixtures";

describe("GI-088 v1.6 新案例稳定性夹具", () => {
  it("使用八个未参与 v1.6 调优的封存检查点", async () => {
    const dataset = await loadGi088CompleteResponseFirstV16FreshStabilityCases();

    expect(dataset.datasetVersion).toBe(
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_DATASET_VERSION
    );
    expect(dataset.cases.map((item) => item.caseId)).toEqual(
      GI088_COMPLETE_RESPONSE_FIRST_V1_6_FRESH_STABILITY_CASE_IDS
    );
    expect(dataset.cases).toHaveLength(8);
    expect(dataset.cases.every((item) =>
      !GI088_COMPLETE_RESPONSE_FIRST_CASE_IDS.includes(item.caseId as never)
    )).toBe(true);
  });

  it("每例保留完整对话并从初始语义状态开始", async () => {
    const dataset = await loadGi088CompleteResponseFirstV16FreshStabilityCases();

    for (const item of dataset.cases) {
      expect(item.privacyLevel).toBe("private_sensitive");
      expect(item.turnInput.conversation.length).toBeGreaterThan(0);
      expect(item.turnInput.conversation.at(-1)).toMatchObject({ role: "user" });
      expect(item.turnInput.semanticState.workingTask).toBeNull();
      expect(item.turnInput.semanticState.understandings).toEqual([]);
      expect(item.expectedBehavior.length).toBeGreaterThan(10);
      expect(item.prohibitedRisks.length).toBeGreaterThan(0);
    }
  });

  it("把停止、纠正、事件切换和继续请求设为硬场景", async () => {
    const dataset = await loadGi088CompleteResponseFirstV16FreshStabilityCases();
    const hardIds = dataset.cases.filter((item) => item.hardGate)
      .map((item) => item.caseId);

    expect(hardIds).toEqual([
      "RPR-REAL-03",
      "RPR-REAL-09",
      "RPR-REAL-17",
      "RPR-REAL-20",
      "RPR-CF-02",
      "RPR-CF-05"
    ]);
  });
});
