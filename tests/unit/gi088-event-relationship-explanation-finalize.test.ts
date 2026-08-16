import { describe, expect, it } from "vitest";

import {
  decideGi088EventRelationshipRetest,
  type Gi088EventRelationshipContentReview
} from "../../scripts/finalize-gi088-event-relationship-explanation-retest";
import type { Gi088EventRelationshipRetestCallResult } from "../../scripts/run-gi088-event-relationship-explanation-retest";

const caseIds = [
  "RPR-REAL-05",
  "RPR-REAL-06",
  "RPR-REAL-08",
  "RPR-REAL-10",
  "RPR-REAL-13",
  "RPR-REAL-18",
  "RPR-REAL-19",
  "RPR-REAL-22",
  "RPR-CF-07",
  "RPR-CF-02"
];

function results(): Gi088EventRelationshipRetestCallResult[] {
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

function reviews(): Gi088EventRelationshipContentReview[] {
  return caseIds.map((caseId) => ({
    caseId,
    principleId: "QR-08",
    contentStatus: "pass",
    findingCategory: "none",
    findingCode: "PASS",
    rationale: "pass"
  }));
}

describe("GI-088 event relationship explanation final decision", () => {
  it("passes when all ten technical and content results pass", () => {
    expect(decideGi088EventRelationshipRetest({
      results: results(),
      reviews: reviews()
    })).toBe("factor_candidate_passed_development_retest");
  });

  it("blocks when either target case is technically unavailable", () => {
    const actualResults = results();
    actualResults.find((item) => item.caseId === "RPR-REAL-13")!.status = "technical_failure";
    expect(decideGi088EventRelationshipRetest({
      results: actualResults,
      reviews: reviews()
    })).toBe("technical_blocked");
  });

  it("returns factor no-go when either target content result fails", () => {
    const actualReviews = reviews();
    actualReviews.find((item) => item.caseId === "RPR-CF-02")!.contentStatus = "fail";
    expect(decideGi088EventRelationshipRetest({
      results: results(),
      reviews: actualReviews
    })).toBe("factor_no_go");
  });

  it("returns regression no-go when a previously passing case regresses", () => {
    const actualReviews = reviews();
    actualReviews.find((item) => item.caseId === "RPR-REAL-06")!.contentStatus = "fail";
    expect(decideGi088EventRelationshipRetest({
      results: results(),
      reviews: actualReviews
    })).toBe("regression_no_go");
  });

  it("keeps a semantic pass with incomplete non-target technical evidence", () => {
    const actualResults = results();
    actualResults.find((item) => item.caseId === "RPR-REAL-05")!.status = "technical_failure";
    const actualReviews = reviews();
    actualReviews.find((item) => item.caseId === "RPR-REAL-05")!.contentStatus = "not_evaluable";
    expect(decideGi088EventRelationshipRetest({
      results: actualResults,
      reviews: actualReviews
    })).toBe("semantic_fix_passed_complete_evidence_pending");
  });
});
