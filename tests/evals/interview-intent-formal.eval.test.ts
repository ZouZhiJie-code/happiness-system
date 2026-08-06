import seedDatasetJson from "../../evals/interview-intent/v1/seed-cases.json";
import formalVariantsJson from "../../evals/interview-intent/v1/formal-variants.json";
import blindDatasetJson from "../../evals/interview-intent/v1/blind-cases.json";
import externalReviewDatasetJson from "../../evals/interview-intent/v1/external-review-cases.json";

import {
  interviewIntentBlindDatasetSchema,
  interviewIntentEvalDatasetSchema,
  interviewIntentEvalVariantSetSchema
} from "@/features/interview/intent/evaluation-schema";
import {
  buildFormalInterviewIntentDataset,
  evaluateInterviewIntentCase,
  evaluateInterviewIntentDataset
} from "@/features/interview/intent/evaluation-runner";

const seedDataset = interviewIntentEvalDatasetSchema.parse(seedDatasetJson);
const variantSet = interviewIntentEvalVariantSetSchema.parse(formalVariantsJson);
const blindDataset = interviewIntentBlindDatasetSchema.parse(blindDatasetJson);
const externalReviewDataset = interviewIntentBlindDatasetSchema.parse(
  externalReviewDatasetJson
);
const dataset = interviewIntentEvalDatasetSchema.parse(
  buildFormalInterviewIntentDataset({ seedDataset, variantSet, blindDataset })
);

describe("interview intent formal evaluation dataset", () => {
  it("keeps the agreed 72/24/24 split", () => {
    expect(dataset.cases).toHaveLength(120);
    expect(dataset.cases.filter((item) => item.caseSet === "development")).toHaveLength(72);
    expect(dataset.cases.filter((item) => item.caseSet === "validation")).toHaveLength(24);
    expect(dataset.cases.filter((item) => item.caseSet === "blind")).toHaveLength(24);
  });

  it("keeps a separate 24-case sealed set for external review", () => {
    expect(externalReviewDataset.version).toBe("intent-eval-v1.8-external-sealed");
    expect(externalReviewDataset.cases).toHaveLength(24);
    expect(
      externalReviewDataset.cases.every((item) => item.tags.includes("外部盲测"))
    ).toBe(true);
    expect(
      new Set(externalReviewDataset.cases.map((item) => item.id)).size
    ).toBe(24);
  });

  it("keeps every semantic family inside one dataset split", () => {
    const setsByFamily = new Map<string, Set<string>>();

    for (const item of dataset.cases) {
      const caseSets = setsByFamily.get(item.semanticFamily) ?? new Set<string>();
      caseSets.add(item.caseSet);
      setsByFamily.set(item.semanticFamily, caseSets);
    }

    expect(setsByFamily.size).toBe(56);
    for (const caseSets of setsByFamily.values()) {
      expect(caseSets.size).toBe(1);
    }
  });

  it("covers all five dimensions in every dataset split", () => {
    for (const caseSet of ["development", "validation", "blind"] as const) {
      const dimensions = new Set(
        dataset.cases
          .filter((item) => item.caseSet === caseSet)
          .map((item) => item.dimension)
      );

      for (const dimension of [
        "joy",
        "fulfillment",
        "reflection",
        "improvement",
        "gratitude"
      ] as const) {
        expect(dimensions.has(dimension)).toBe(true);
      }
    }
  });

  it.each(dataset.cases)("$id meets its product expectation", (evalCase) => {
    const result = evaluateInterviewIntentCase(evalCase);

    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("meets the formal offline release gate", () => {
    const summary = evaluateInterviewIntentDataset(dataset);

    expect(summary).toMatchObject({
      total: 120,
      passed: 120,
      failed: 0,
      p0Failed: 0,
      passRate: 1
    });
  });
});
