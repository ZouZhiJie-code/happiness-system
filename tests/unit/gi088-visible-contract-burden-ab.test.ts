import { describe, expect, it } from "vitest";

import {
  createGi088VisibleContractBurdenAbPlan,
  evaluateGi088VisibleContractBurdenAb,
  shouldContinueGi088VisibleContractBurdenAbAfter,
  type Gi088VisibleContractBurdenAbCallResult
} from "../../scripts/run-gi088-visible-contract-burden-ab";

function result(input: {
  runLabel: "A1" | "B1" | "B2" | "A2";
  latencyMs: number | null;
  status?: "valid" | "contract_failure" | "technical_failure";
  deadlineTimeout?: boolean;
}): Gi088VisibleContractBurdenAbCallResult {
  const arm = input.runLabel.startsWith("A") ? "A" : "B";
  const status = input.status ?? "valid";
  const validAt = status === "valid" ? input.latencyMs : null;
  return {
    order: { A1: 1, B1: 2, B2: 3, A2: 4 }[input.runLabel],
    runLabel: input.runLabel,
    arm,
    status,
    startedAt: "2026-08-16T00:00:00.000Z",
    completedAt: "2026-08-16T00:00:01.000Z",
    requestFingerprint: `${arm}-request`,
    candidateFingerprint: `${arm}-candidate`,
    httpStatus: status === "technical_failure" ? null : 200,
    responseModel: "deepseek-v4-pro",
    headersLatencyMs: input.latencyMs === null ? null : 300,
    bodyLatencyMs:
      input.latencyMs === null ? null : Math.max(0, input.latencyMs - 300),
    totalLatencyMs: input.latencyMs,
    firstUsefulAtMs: validAt,
    fullVisibleAtMs: validAt,
    firstUsefulGatePassed: validAt !== null && validAt <= 45_000,
    fullVisibleGatePassed: validAt !== null && validAt <= 60_000,
    responseHash: status === "technical_failure" ? null : "response-hash",
    responseLength: status === "technical_failure" ? 0 : 10,
    visibleText: status === "valid" ? "可见回应" : null,
    rawOutput: status === "technical_failure" ? null : "{}",
    parsedOutput: status === "valid" ? {} : null,
    validationIssues: [],
    errorCode: status === "technical_failure" ? "REQUEST_FAILED" : null,
    deadlineTimeout: input.deadlineTimeout ?? false,
    diagnostics: null
  };
}

function complete(latencies: [number, number, number, number]) {
  return [
    result({ runLabel: "A1", latencyMs: latencies[0] }),
    result({ runLabel: "B1", latencyMs: latencies[1] }),
    result({ runLabel: "B2", latencyMs: latencies[2] }),
    result({ runLabel: "A2", latencyMs: latencies[3] })
  ];
}

describe("GI-088 visible contract burden A/B", () => {
  it("binds a fresh four-call Pro Low A-B-B-A plan with one fixed user payload", async () => {
    const plan = await createGi088VisibleContractBurdenAbPlan();
    expect(plan.identity).toBe(
      "2026-08-16.gi088-visible-contract-burden-ab-v1"
    );
    expect(plan.sequence.map((entry) => entry.arm)).toEqual([
      "A",
      "B",
      "B",
      "A"
    ]);
    expect(plan.runtime.callBudget).toBe(4);
    expect(plan.runtime.reasoningEffort).toBe("low");
    expect(plan.runtime.retries).toBe(0);
    expect(plan.fixedFactors.sameFullUserPayload).toBe(true);
    expect(plan.arms.A.systemPromptLength).toBeGreaterThan(
      plan.arms.B.systemPromptLength * 10
    );
    expect(plan.case.userPayloadSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.planFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("recognizes strong and paired visible-contract speed directions", () => {
    const strong = evaluateGi088VisibleContractBurdenAb({
      results: complete([50_000, 20_000, 25_000, 52_000])
    });
    expect(strong.decision).toBe(
      "visible_contract_strong_directional_support"
    );

    const paired = evaluateGi088VisibleContractBurdenAb({
      results: complete([40_000, 20_000, 30_000, 50_000])
    });
    expect(paired.decision).toBe("visible_contract_directional_support");
    expect(paired.pairDeltasMs).toEqual({
      A1MinusB1: 20_000,
      A2MinusB2: 20_000
    });
  });

  it("separates shared slowness, a non-reproduced burden, and technical stop", () => {
    expect(
      evaluateGi088VisibleContractBurdenAb({
        results: complete([50_000, 51_000, 52_000, 53_000])
      }).decision
    ).toBe("shared_low_or_provider_slow");
    expect(
      evaluateGi088VisibleContractBurdenAb({
        results: complete([30_000, 25_000, 27_000, 32_000])
      }).decision
    ).toBe("burden_not_materially_reproduced");

    const failure = result({
      runLabel: "A1",
      latencyMs: 1_000,
      status: "technical_failure"
    });
    expect(
      evaluateGi088VisibleContractBurdenAb({ results: [failure] }).decision
    ).toBe("technical_blocked");
    expect(shouldContinueGi088VisibleContractBurdenAbAfter(failure)).toBe(
      false
    );
  });

  it("continues only comparable body or hard deadline observations", () => {
    const timeout = result({
      runLabel: "A1",
      latencyMs: 60_000,
      status: "technical_failure",
      deadlineTimeout: true
    });
    expect(shouldContinueGi088VisibleContractBurdenAbAfter(timeout)).toBe(true);
  });
});
