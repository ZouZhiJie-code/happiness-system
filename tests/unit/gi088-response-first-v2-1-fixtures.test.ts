import { describe, expect, it } from "vitest";

import {
  GI088_RESPONSE_FIRST_V21_CASE_IDS,
  loadGi088ResponseFirstV21Cases
} from "../../scripts/gi088-response-first-v2-1-fixtures";

describe("GI-088 response-first v2.1 fixtures", () => {
  it("preserves the six real checkpoints under a new dataset identity", async () => {
    const dataset = await loadGi088ResponseFirstV21Cases();
    expect(dataset.datasetVersion)
      .toBe("2026-08-17.gi088-response-first-v2-1-six-real-checkpoints-v1");
    expect(dataset.cases.map((item) => item.caseId))
      .toEqual([...GI088_RESPONSE_FIRST_V21_CASE_IDS]);
    expect(dataset.datasetFingerprint).not.toBe(dataset.parentDatasetFingerprint);
  });

  it("models the already-handled correction with a persisted invalidation", async () => {
    const dataset = await loadGi088ResponseFirstV21Cases();
    const continued = dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-19-CONTINUE"
    )!;
    expect(continued.turnInput.semanticState.invalidatedItems).toHaveLength(1);
    expect(continued.turnInput.semanticState.invalidatedItems[0])
      .toMatchObject({ invalidatedByMessageId: "U3" });
    expect(continued.turnInput.semanticState.understandings[0]?.evidenceRefs)
      .toContain("U4");
  });

  it("keeps the new-correction checkpoint free of future state", async () => {
    const dataset = await loadGi088ResponseFirstV21Cases();
    const correction = dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-19-CORRECTION"
    )!;
    expect(correction.turnInput.conversation.at(-1)?.id).toBe("U3");
    expect(correction.turnInput.semanticState.invalidatedItems).toEqual([]);
  });
});
