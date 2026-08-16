import { describe, expect, it } from "vitest";

import {
  decideGi088RelationshipClaimStatusProbe,
  type Gi088RelationshipClaimStatusProbeContentReview
} from "../../scripts/finalize-gi088-relationship-claim-status-probe";
import type { Gi088RelationshipClaimStatusProbeCallResult } from "../../scripts/run-gi088-relationship-claim-status-probe";

const caseIds = ["RPR-REAL-13", "RPR-CF-02"];

function results(): Gi088RelationshipClaimStatusProbeCallResult[] {
  return caseIds.map((caseId, index) => ({
    order: index + 1,
    caseId,
    principleId: "QR-08",
    caseFingerprint: `case-${index}`,
    candidateInputFingerprint: `input-${index}`,
    requestHash: `request-${index}`,
    startedAt: "2026-08-16T00:00:00.000Z",
    completedAt: "2026-08-16T00:00:01.000Z",
    status: "valid",
    httpStatus: 200,
    responseModel: "deepseek-v4-pro",
    latencyMs: 1,
    responseHash: `response-${index}`,
    responseLength: 10,
    visibleText: "visible",
    rawOutput: "{}",
    parsedOutput: {},
    validationIssues: [],
    errorCode: null,
    diagnostics: null
  }));
}

function reviews(): Gi088RelationshipClaimStatusProbeContentReview[] {
  return caseIds.map((caseId) => ({
    caseId,
    principleId: "QR-08",
    contentStatus: "pass",
    findingCategory: "none",
    findingCode: "PASS",
    checks: {
      broadUserStatedRelationshipInherited: true,
      unconfirmedSpecificExplanationAsserted: false,
      hypothesisKeptInCorrectableQuestion: true,
      explicitRelationshipKeptWithinUserBoundary: true
    },
    rationale: "pass"
  }));
}

describe("GI-088 relationship claim status probe final decision", () => {
  it("opens the full ten-case regression only when both targets pass", () => {
    expect(
      decideGi088RelationshipClaimStatusProbe({
        results: results(),
        reviews: reviews()
      })
    ).toBe("target_probe_passed_ready_for_full_10_case_regression");
  });

  it("blocks on a provider or transport failure", () => {
    const actual = results();
    actual[0].status = "technical_failure";
    expect(
      decideGi088RelationshipClaimStatusProbe({
        results: actual,
        reviews: reviews()
      })
    ).toBe("technical_blocked");
  });

  it("returns contract no-go when the relationship status contract fails", () => {
    const actual = results();
    actual[0].status = "contract_failure";
    expect(
      decideGi088RelationshipClaimStatusProbe({
        results: actual,
        reviews: reviews()
      })
    ).toBe("contract_no_go");
  });

  it("returns factor no-go when either target fails content review", () => {
    const actual = reviews();
    actual[1].contentStatus = "fail";
    expect(
      decideGi088RelationshipClaimStatusProbe({
        results: results(),
        reviews: actual
      })
    ).toBe("factor_no_go");
  });
});
