import { describe, expect, it } from "vitest";

import {
  GI088_VISIBLE_INFORMATION_GAIN_AB_SEQUENCE,
  createGi088RealLongContextAsset,
  createGi088VisibleInformationGainPlan
} from "../../scripts/run-gi088-visible-information-gain-ab";
import type { Gi088RealProblemRegressionCase } from "../../scripts/prepare-gi088-real-problem-regression";
import cases from "../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/real-problem-regression-v1.2/regression-cases.json";

describe("GI-088 visible information-gain A/B", () => {
  it("固定 A-B-B-A、同一输入与四次独立预算", async () => {
    const plan = await createGi088VisibleInformationGainPlan();
    expect(plan.sequence.map((entry) => entry.arm)).toEqual([
      ...GI088_VISIBLE_INFORMATION_GAIN_AB_SEQUENCE
    ]);
    expect(plan.budget.authorized).toBe(4);
    expect(plan.fixedFactors.sameCaseAndUserPayload).toBe(true);
    expect(plan.arms.A.systemPromptSha256).not.toBe(
      plan.arms.B.systemPromptSha256
    );
    expect(plan.arms.B.systemPromptLength).toBeGreaterThan(
      plan.arms.A.systemPromptLength
    );
  });

  it("真实长上下文严格使用 16 条来源、8 条窗口和 8 条窗口外消息", () => {
    const source = (cases as unknown as Gi088RealProblemRegressionCase[]).find(
      (entry) => entry.caseId === "RPR-REAL-21"
    )!;
    const asset = createGi088RealLongContextAsset(source);
    expect(asset.fullMessageCount).toBe(16);
    expect(asset.recentWindowCount).toBe(8);
    expect(asset.omittedEarlierMessageCount).toBe(8);
    expect(asset.semanticState.workingTask?.evidenceRefs).toContain("U1");
    expect(asset.omittedMessageIds).toContain("U1");
  });
});
