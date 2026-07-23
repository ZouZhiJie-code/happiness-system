import { describe, expect, it } from "vitest";

import { batchBSafetyCases } from "@/features/interview/event-centered/evaluation-catalog";
import {
  detectEventCenteredSafetyBlockers
} from "@/features/interview/event-centered/safety-policy";

describe("event-centered safety policy", () => {
  it("uses one safety policy for every confirmed Batch B safety case", () => {
    expect(batchBSafetyCases).toHaveLength(60);

    for (const evaluationCase of batchBSafetyCases) {
      expect(
        detectEventCenteredSafetyBlockers(evaluationCase.candidateResponse ?? "")
      ).toContain(evaluationCase.expected.safetyBlocker);
    }
  });

  it("blocks pathological language before it reaches a user-facing response", () => {
    expect(
      detectEventCenteredSafetyBlockers("你已经出现病理性自恋。")
    ).toEqual(["psychological_diagnosis"]);
  });
});
