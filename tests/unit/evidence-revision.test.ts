import { describe, expect, it } from "vitest";

import { assessDimensionEvidence } from "@/features/interview/dimension-evidence";
import {
  applyExplicitEvidenceRevisions,
  buildEvidenceRevisionThinkingSummary
} from "@/features/joy-interview/server/evidence-revision";
import { buildJoySnapshot } from "@/features/joy-interview/server/joy-interview-engine";

describe("explicit evidence revision", () => {
  it("retracts stale fulfillment progress when the user corrects the premise", () => {
    const previousSnapshot = buildJoySnapshot({
      event: "今天围绕目标岗位改了简历",
      whyItMattered: "完成了简历的修改",
      happinessType: "推进完成型"
    });

    const result = applyExplicitEvidenceRevisions({
      dimension: "fulfillment",
      previousSnapshot,
      candidateSnapshot: previousSnapshot,
      message: "我只是打开看了一眼，没有修改，也没有推进"
    });
    const evidence = assessDimensionEvidence("fulfillment", result.snapshot);

    expect(result.snapshot.event).toBe("打开看了一眼");
    expect(result.snapshot.whyItMattered).toBeNull();
    expect(result.snapshot.joySource).toBeNull();
    expect(result.snapshot.happinessType).toBeNull();
    expect(evidence.readiness).toBe("insufficient");
    expect(evidence.missingSlots).toContain("progressEvidence");
    expect(result.revisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "whyItMattered", action: "clear" }),
        expect.objectContaining({ field: "event", action: "replace", value: "打开看了一眼" })
      ])
    );
  });

  it("creates a visible correction summary from the revised user evidence", () => {
    expect(
      buildEvidenceRevisionThinkingSummary({
        dimension: "fulfillment",
        message: "我只是打开看了一眼，没有修改，也没有推进"
      })
    ).toBe("你刚刚澄清了：实际只是打开看了一眼，之前关于完成或推进的理解需要收回。");
  });

  it("keeps ordinary fulfillment content additive when no correction is present", () => {
    const snapshot = buildJoySnapshot({ event: "改简历", whyItMattered: "完成了经历重写" });
    const result = applyExplicitEvidenceRevisions({
      dimension: "fulfillment",
      previousSnapshot: snapshot,
      candidateSnapshot: snapshot,
      message: "我把两段经历重新写清楚了"
    });

    expect(result.revisions).toEqual([]);
    expect(result.snapshot).toBe(snapshot);
  });
});
