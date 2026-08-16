import { describe, expect, it } from "vitest";

import {
  evaluateGi088ResponseLatencyContractAb,
  nextStepForGi088ResponseLatencyContractAb
} from "../../scripts/finalize-gi088-response-latency-contract-ab";
import type {
  Gi088ResponseLatencyContractAbCallResult,
  Gi088ResponseLatencyContractAbNotRun
} from "../../scripts/run-gi088-response-latency-contract-ab";

const definitions = [
  { order: 1, runLabel: "A1", arm: "A" },
  { order: 2, runLabel: "B1", arm: "B" },
  { order: 3, runLabel: "B2", arm: "B" },
  { order: 4, runLabel: "A2", arm: "A" }
] as const;

function results(
  latencies: [number, number, number, number]
): Gi088ResponseLatencyContractAbCallResult[] {
  return definitions.map((definition, index) => {
    const totalLatencyMs = latencies[index]!;
    const firstUsefulGatePassed = totalLatencyMs <= 45_000;
    return {
      ...definition,
      caseId: "RPR-CF-02",
      principleId: "QR-08",
      caseFingerprint: "case",
      candidateInputFingerprint: "input",
      candidateFingerprint: `candidate-${definition.arm}`,
      requestHash: `request-${definition.runLabel}`,
      startedAt: "2026-08-16T00:00:00.000Z",
      completedAt: "2026-08-16T00:00:01.000Z",
      status: "valid",
      httpStatus: 200,
      responseModel: "deepseek-v4-pro",
      latencyMs: totalLatencyMs,
      headersLatencyMs: 2_000,
      bodyLatencyMs: totalLatencyMs - 2_000,
      totalLatencyMs,
      firstUsefulAtMs: totalLatencyMs,
      fullVisibleAtMs: totalLatencyMs,
      firstUsefulGatePassed,
      fullVisibleGatePassed: totalLatencyMs <= 60_000,
      responseHash: `response-${definition.runLabel}`,
      responseLength: 100,
      visibleText: "private visible text",
      rawOutput: "{}",
      parsedOutput: {},
      validationIssues: [],
      errorCode: null,
      deadlineTimeout: false,
      diagnostics: null
    };
  });
}

describe("GI-088 response latency contract A/B deterministic decision", () => {
  it("forms strong directional support when both A pass and both B exceed 45s", () => {
    const evaluation = evaluateGi088ResponseLatencyContractAb({
      results: results([20_000, 50_000, 52_000, 22_000])
    });
    expect(evaluation.decision).toBe(
      "contract_load_strong_directional_support"
    );
    expect(evaluation.pairDeltasMs).toEqual({
      B1MinusA1: 30_000,
      B2MinusA2: 30_000
    });
  });

  it("forms directional support when both paired B runs are at least 10s slower", () => {
    const evaluation = evaluateGi088ResponseLatencyContractAb({
      results: results([50_000, 62_000, 63_000, 51_000])
    });
    expect(evaluation.decision).toBe("contract_load_directional_support");
    expect(evaluation.contractDirection).toBe(true);
  });

  it("keeps contract attribution open when the entire shared stack is slow", () => {
    const evaluation = evaluateGi088ResponseLatencyContractAb({
      results: results([50_000, 55_000, 54_000, 51_000])
    });
    expect(evaluation.decision).toBe(
      "shared_stack_slow_contract_attribution_open"
    );
    expect(nextStepForGi088ResponseLatencyContractAb(evaluation.decision)).toBe(
      "discuss_pro_high_or_whole_json_return_path_as_next_single_factor"
    );
  });

  it("raises provider-period variance when all four runs pass without a stable gap", () => {
    const evaluation = evaluateGi088ResponseLatencyContractAb({
      results: results([20_000, 25_000, 24_000, 21_000])
    });
    expect(evaluation.decision).toBe(
      "incident_not_reproduced_provider_variance_rises"
    );
  });

  it("marks conflicting directions as inconclusive", () => {
    const evaluation = evaluateGi088ResponseLatencyContractAb({
      results: results([20_000, 50_000, 24_000, 21_000])
    });
    expect(evaluation.decision).toBe("inconclusive_mixed_direction");
  });

  it("marks a non-latency failure and remaining not-run calls as technical blocked", () => {
    const actual = results([20_000, 5_000, 20_000, 20_000]).slice(0, 2);
    actual[1]!.status = "technical_failure";
    actual[1]!.errorCode = "REQUEST_FAILED";
    actual[1]!.deadlineTimeout = false;
    const notRun: Gi088ResponseLatencyContractAbNotRun[] = definitions
      .slice(2)
      .map((definition) => ({
        ...definition,
        caseId: "RPR-CF-02",
        status: "not_run",
        reason: "stopped_after_non_latency_technical_failure"
      }));

    const evaluation = evaluateGi088ResponseLatencyContractAb({
      results: actual,
      notRun
    });
    expect(evaluation.decision).toBe("technical_blocked");
    expect(evaluation.nonLatencyTechnicalFailure).toBe(true);
  });
});
