import seedDatasetJson from "../../evals/interview-intent/v1/seed-cases.json";

import { interviewIntentEvalDatasetSchema } from "@/features/interview/intent/evaluation-schema";
import {
  evaluateInterviewIntentCase,
  evaluateInterviewIntentDataset
} from "@/features/interview/intent/evaluation-runner";

const dataset = interviewIntentEvalDatasetSchema.parse(seedDatasetJson);

describe("interview intent seed evaluation dataset", () => {
  it("keeps the agreed 40-case product distribution", () => {
    const categoryCounts = Object.fromEntries(
      [
        "explicit_control",
        "mixed_content_control",
        "contextual_short_answer",
        "quote_report_correction",
        "pressure_feedback",
        "recovery"
      ].map((category) => [
        category,
        dataset.cases.filter((item) => item.category === category).length
      ])
    );

    expect(dataset.cases).toHaveLength(40);
    expect(categoryCounts).toEqual({
      explicit_control: 8,
      mixed_content_control: 8,
      contextual_short_answer: 8,
      quote_report_correction: 6,
      pressure_feedback: 5,
      recovery: 5
    });
  });

  it("covers all five interview dimensions", () => {
    for (const dimension of [
      "joy",
      "fulfillment",
      "reflection",
      "improvement",
      "gratitude"
    ] as const) {
      expect(dataset.cases.some((item) => item.dimension === dimension)).toBe(true);
    }
  });

  it.each(dataset.cases)("$id meets its product expectation", (evalCase) => {
    const result = evaluateInterviewIntentCase(evalCase);

    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("meets the seed release gate", () => {
    const summary = evaluateInterviewIntentDataset(dataset);

    expect(summary).toMatchObject({
      total: 40,
      passed: 40,
      failed: 0,
      p0Failed: 0,
      passRate: 1
    });
  });
});
