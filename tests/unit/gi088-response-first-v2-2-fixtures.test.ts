import { describe, expect, it } from "vitest";

import { loadGi088ResponseFirstV21Cases } from "../../scripts/gi088-response-first-v2-1-fixtures";
import {
  GI088_RESPONSE_FIRST_V22_CASE_IDS,
  loadGi088ResponseFirstV22Cases
} from "../../scripts/gi088-response-first-v2-2-fixtures";

describe("GI-088 response-first v2.2 fixtures", () => {
  it("reuses the exact v2.1 dataset so Low permission is the only factor", async () => {
    const parent = await loadGi088ResponseFirstV21Cases();
    const dataset = await loadGi088ResponseFirstV22Cases();
    expect(dataset.datasetVersion).toBe(parent.datasetVersion);
    expect(dataset.datasetFingerprint).toBe(parent.datasetFingerprint);
    expect(dataset.cases.map((item) => item.caseId))
      .toEqual([...GI088_RESPONSE_FIRST_V22_CASE_IDS]);
    expect(dataset.cases).toEqual(parent.cases);
  });
});
