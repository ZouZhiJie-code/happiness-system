import {
  buildCandidateVersionMarker,
  buildFewShotFingerprint,
  calculateImpactWindow,
  concludeAIQualityImpact,
  normalizeAIQualityIssueFamily,
  type AIQualityImpactMetrics
} from "@/features/ai-quality/impact-policy";

function metrics(overrides: Partial<AIQualityImpactMetrics> = {}): AIQualityImpactMetrics {
  return {
    generationCount: 10,
    upvoteCount: 6,
    downvoteCount: 1,
    downvoteRate: 0.1,
    sameIssueCount: 1,
    sameIssueRate: 0.1,
    severeIssueCount: 0,
    failureCount: 0,
    failureRate: 0,
    averageLatencyMs: 900,
    ...overrides
  };
}

describe("AI quality impact policy", () => {
  it("uses stable runtime-compatible version markers for both optimization paths", () => {
    const fingerprint = buildFewShotFingerprint(["example-1", "example-2"]);
    expect(buildCandidateVersionMarker({
      candidateId: "candidate-1",
      path: "system_prompt",
      fewShotExampleIds: []
    })).toBe("+opt:candidate-1");
    expect(buildCandidateVersionMarker({
      candidateId: "candidate-2",
      path: "few_shot",
      fewShotExampleIds: ["example-1", "example-2"]
    })).toBe(`+fs:${fingerprint}`);
  });

  it("normalizes evaluator codes and user tags into product-facing issue families", () => {
    expect(normalizeAIQualityIssueFamily("user_downvote:ignored_boundary")).toBe("boundary");
    expect(normalizeAIQualityIssueFamily("missing_supporting_scene_anchor")).toBe("grounding");
    expect(normalizeAIQualityIssueFamily("too_abstract")).toBe("clarity");
    expect(normalizeAIQualityIssueFamily("pressure_tone")).toBe("tone_safety");
    expect(normalizeAIQualityIssueFamily("schema_parse_failed")).toBe("engineering");
  });

  it("ends the observation at rollback or the next same-path release", () => {
    const publishedAt = new Date("2026-07-01T00:00:00.000Z");
    const result = calculateImpactWindow({
      publishedAt,
      now: new Date("2026-07-10T00:00:00.000Z"),
      rolledBackAt: new Date("2026-07-04T00:00:00.000Z"),
      nextReleaseAt: new Date("2026-07-03T00:00:00.000Z")
    });
    expect(result.observationEnd.toISOString()).toBe("2026-07-03T00:00:00.000Z");
    expect(result.completed).toBe(true);
  });

  it("recommends rollback for severe problems and clear metric degradation", () => {
    expect(concludeAIQualityImpact({
      baseline: metrics(),
      after: metrics({ severeIssueCount: 1 }),
      completed: false
    }).status).toBe("rollback_recommended");

    expect(concludeAIQualityImpact({
      baseline: metrics({ downvoteRate: 0.05 }),
      after: metrics({ downvoteRate: 0.2 }),
      completed: false
    }).status).toBe("rollback_recommended");
  });

  it("handles low samples and recommends retaining a completed stable release", () => {
    expect(concludeAIQualityImpact({
      baseline: metrics(),
      after: metrics({ generationCount: 4 }),
      completed: false
    }).status).toBe("observing");
    expect(concludeAIQualityImpact({
      baseline: metrics(),
      after: metrics({ generationCount: 4 }),
      completed: true
    }).status).toBe("low_sample");
    expect(concludeAIQualityImpact({
      baseline: metrics({ sameIssueRate: 0.2, downvoteRate: 0.1 }),
      after: metrics({ sameIssueRate: 0, sameIssueCount: 0, downvoteRate: 0.1 }),
      completed: true
    }).status).toBe("retain_recommended");
  });
});
