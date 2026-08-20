import dataset from "../../evals/monthly-insight-v1/synthetic-cases.json";
import { monthlyInsightCandidateInputSchema } from "../../evals/monthly-insight-v1/contract";

describe("monthly insight synthetic dataset", () => {
  it("contains the six frozen boundary cases with internally consistent gates", () => {
    expect(dataset.cases).toHaveLength(6);
    expect(new Set(dataset.cases.map((item) => item.id)).size).toBe(6);

    for (const item of dataset.cases) {
      const input = monthlyInsightCandidateInputSchema.parse(item.input);
      expect(input.sources).toHaveLength(input.eligibility.savedOutcomeCount);
      expect(input.eligibility.eligible).toBe(
        input.eligibility.recordedDayCount >= 3
        && input.eligibility.savedOutcomeCount >= 3
      );
      expect(item.expectedExecution).toBe(
        input.eligibility.eligible ? "candidate_call" : "deterministic_zero_call"
      );
    }
  });

  it("reserves exactly two zero-call cases and four candidate-call cases", () => {
    expect(dataset.cases.filter((item) => item.expectedExecution === "deterministic_zero_call")).toHaveLength(2);
    expect(dataset.cases.filter((item) => item.expectedExecution === "candidate_call")).toHaveLength(4);
  });
});
