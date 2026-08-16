import { describe, expect, it } from "vitest";

import {
  GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS,
  createGi088ResponseFirstVisibleQualityPlan,
  evaluateGi088ResponseFirstVisibleQualityReview,
  type Gi088ResponseFirstVisibleQualityCallResult,
  type Gi088ResponseFirstVisibleQualityDecision
} from "../../scripts/run-gi088-response-first-visible-quality";

function result(
  caseId: (typeof GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS)[number],
  latencyMs = 5_000
): Gi088ResponseFirstVisibleQualityCallResult {
  return {
    order: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS.indexOf(caseId) + 1,
    caseId,
    status: "valid",
    startedAt: "2026-08-16T00:00:00.000Z",
    completedAt: "2026-08-16T00:00:05.000Z",
    requestFingerprint: `${caseId}-request`,
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    headersLatencyMs: 300,
    bodyLatencyMs: latencyMs - 300,
    totalLatencyMs: latencyMs,
    firstUsefulGatePassed: latencyMs <= 45_000,
    fullVisibleGatePassed: latencyMs <= 60_000,
    responseHash: `${caseId}-response`,
    responseLength: 100,
    rawOutput: "{}",
    output: {
      visible: { understanding: "自然承接", response: "自然回应？" }
    },
    validationIssues: [],
    errorCode: null,
    diagnostics: null
  };
}

function decisions(
  overrides: Partial<Record<string, "pass" | "minor" | "fail">> = {}
): Gi088ResponseFirstVisibleQualityDecision[] {
  return GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS.map((caseId) => ({
    caseId,
    verdict: overrides[caseId] ?? "pass",
    note: "产品负责人裁决"
  }));
}

describe("GI-088 response-first visible quality gate", () => {
  it("binds five sealed real cases and one 12-message public synthetic case", async () => {
    const plan = await createGi088ResponseFirstVisibleQualityPlan();
    expect(plan.identity).toBe(
      "2026-08-16.gi088-response-first-visible-quality-v1"
    );
    expect(plan.runtime.callBudget).toBe(6);
    expect(plan.runtime.reasoningEffort).toBe("low");
    expect(plan.runtime.retries).toBe(0);
    expect(plan.cases.map((item) => item.caseId)).toEqual(
      GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS
    );
    const longContext = plan.cases.at(-1)!;
    expect(longContext.caseId).toBe("RFT-CX-01");
    expect(longContext.messageCount).toBe(12);
    expect(longContext.recentWindowCount).toBe(8);
    expect(longContext.omittedEarlierMessageCount).toBe(4);
    expect(plan.planFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("passes only when all technical gates and four hard product gates pass", () => {
    const results = GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS.map((caseId) =>
      result(caseId)
    );
    const passed = evaluateGi088ResponseFirstVisibleQualityReview({
      results,
      decisions: decisions({ "RPR-REAL-18": "minor" })
    });
    expect(passed.decision).toBe("visible_quality_gate_passed");
    expect(passed.hardPassed).toBe(true);
    expect(passed.softMinor).toBe(1);

    const failed = evaluateGi088ResponseFirstVisibleQualityReview({
      results,
      decisions: decisions({ "RPR-REAL-19": "minor" })
    });
    expect(failed.decision).toBe("visible_quality_gate_failed");
    expect(failed.hardPassed).toBe(false);
  });

  it("fails on a late or invalid technical result and rejects two soft minors", () => {
    const lateResults = GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS.map(
      (caseId) => result(caseId, caseId === "RPR-REAL-06" ? 46_000 : 5_000)
    );
    expect(
      evaluateGi088ResponseFirstVisibleQualityReview({
        results: lateResults,
        decisions: decisions()
      }).decision
    ).toBe("visible_quality_gate_failed");

    const twoMinor = evaluateGi088ResponseFirstVisibleQualityReview({
      results: GI088_RESPONSE_FIRST_VISIBLE_QUALITY_CASE_IDS.map((caseId) =>
        result(caseId)
      ),
      decisions: decisions({
        "RPR-REAL-06": "minor",
        "RPR-REAL-18": "minor"
      })
    });
    expect(twoMinor.decision).toBe("visible_quality_gate_failed");
  });
});
