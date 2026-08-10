import { describe, expect, it } from "vitest";

import {
  createGenerativeDevelopmentEvaluationCase,
  GENERATIVE_MEANING_CARD_CANDIDATE_CASES,
  GENERATIVE_MEANING_CARD_CANDIDATE_EXPECTED_RESULTS,
  GENERATIVE_MEANING_CARD_CANDIDATE_REPETITIONS,
  GENERATIVE_MEANING_CARD_REGRESSION_CASE_ID,
  runGenerativeCatalogPreflight
} from "@/features/interview/event-centered/generative-evaluation-runner";
import {
  GENERATIVE_ARCHITECTURE_PROBE_CASES,
  GENERATIVE_MVP_SMOKE_CASES,
  GENERATIVE_QUALITY_CALIBRATION_CARDS
} from "@/features/interview/event-centered/generative-quality-calibration";
import {
  generativeSingleTurnEvaluationCases,
  generativeTrajectoryEvaluationCases
} from "@/features/interview/event-centered/generative-evaluation-catalog";

describe("board 7 minimal two-stage v3 candidate dataset", () => {
  it("固定六个互相隔离的新故事和六项能力", () => {
    const forbiddenFamilies = new Set([
      ...GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => item.scenarioFamily),
      ...GENERATIVE_MVP_SMOKE_CASES.map((item) => item.scenarioFamily),
      ...GENERATIVE_QUALITY_CALIBRATION_CARDS.map((item) => item.scenarioFamily),
      ...generativeSingleTurnEvaluationCases.map((item) => item.scenarioFamily),
      ...generativeTrajectoryEvaluationCases.map((item) => item.scenarioFamily)
    ]);
    expect(GENERATIVE_MEANING_CARD_CANDIDATE_CASES).toHaveLength(6);
    expect(new Set(GENERATIVE_MEANING_CARD_CANDIDATE_CASES.map((item) => item.capability)).size)
      .toBe(6);
    expect(GENERATIVE_MEANING_CARD_CANDIDATE_CASES.every((item) =>
      !forbiddenFamilies.has(item.scenarioFamily)
    )).toBe(true);
    expect(GENERATIVE_MEANING_CARD_REGRESSION_CASE_ID).toBe("SMK-R-PARTIAL-ASK");
  });

  it("每批只生成六个结果且隐藏判尺不进入运行时输入", () => {
    expect(GENERATIVE_MEANING_CARD_CANDIDATE_REPETITIONS).toBe(1);
    expect(GENERATIVE_MEANING_CARD_CANDIDATE_EXPECTED_RESULTS).toBe(6);
    for (const candidate of GENERATIVE_MEANING_CARD_CANDIDATE_CASES) {
      const runtimePayload = JSON.stringify(
        createGenerativeDevelopmentEvaluationCase(candidate)
      );
      expect(runtimePayload).not.toContain("expectedMeaningCard");
      expect(runtimePayload).not.toContain("understandingMustCover");
      expect(runtimePayload).not.toContain("qualitySourceLabel");
    }
    expect(runGenerativeCatalogPreflight().issues.some((issue) =>
      issue.startsWith("meaning_card_candidate_family_leak:")
    )).toBe(false);
  });
});
