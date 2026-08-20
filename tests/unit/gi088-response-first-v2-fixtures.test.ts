import { describe, expect, it } from "vitest";

import {
  GI088_RESPONSE_FIRST_V2_CASE_IDS,
  loadGi088ResponseFirstV2Cases
} from "../../scripts/gi088-response-first-v2-fixtures";

describe("GI-088 response-first v2 real fixtures", () => {
  it("binds six real checkpoints and replaces the rejected synthetic case", async () => {
    const dataset = await loadGi088ResponseFirstV2Cases();
    expect(dataset.cases.map((item) => item.caseId))
      .toEqual([...GI088_RESPONSE_FIRST_V2_CASE_IDS]);
    expect(dataset.cases.every((item) => item.privacyLevel === "private_sensitive"))
      .toBe(true);
    expect(dataset.cases.some((item) => item.caseId === "RFT-CX-01" as never))
      .toBe(false);
  });

  it("uses the two distinct RPR-REAL-19 correction checkpoints", async () => {
    const dataset = await loadGi088ResponseFirstV2Cases();
    const justAppeared = dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-19-CORRECTION"
    )!;
    const continued = dataset.cases.find(
      (item) => item.caseId === "RPR-REAL-19-CONTINUE"
    )!;
    expect(justAppeared.turnInput.conversation).toHaveLength(6);
    expect(justAppeared.turnInput.conversation.at(-1)?.id).toBe("U3");
    expect(continued.turnInput.conversation).toHaveLength(8);
    expect(continued.turnInput.conversation.at(-1)?.id).toBe("U4");
  });

  it("keeps sixteen real messages and sources window-external state", async () => {
    const dataset = await loadGi088ResponseFirstV2Cases();
    const long = dataset.cases.find((item) => item.caseId === "RPR-LC-21")!;
    expect(long.turnInput.conversation).toHaveLength(16);
    expect(long.turnInput.semanticState.workingTask?.evidenceRefs)
      .toContain("U1");
    expect(long.turnInput.conversation.slice(-8).some((item) => item.id === "U1"))
      .toBe(false);
  });
});
