import seedDatasetJson from "../evals/interview-intent/v1/seed-cases.json";
import formalVariantsJson from "../evals/interview-intent/v1/formal-variants.json";
import blindDatasetJson from "../evals/interview-intent/v1/blind-cases.json";

import {
  interviewIntentBlindDatasetSchema,
  interviewIntentEvalDatasetSchema,
  interviewIntentEvalVariantSetSchema
} from "../src/features/interview/intent/evaluation-schema";
import {
  buildFormalInterviewIntentDataset,
  evaluateInterviewIntentDataset
} from "../src/features/interview/intent/evaluation-runner";

const seedDataset = interviewIntentEvalDatasetSchema.parse(seedDatasetJson);
const variantSet = interviewIntentEvalVariantSetSchema.parse(formalVariantsJson);
const blindDataset = interviewIntentBlindDatasetSchema.parse(blindDatasetJson);
const dataset = process.argv.includes("--seed")
  ? seedDataset
  : interviewIntentEvalDatasetSchema.parse(
      buildFormalInterviewIntentDataset({ seedDataset, variantSet, blindDataset })
    );
const summary = evaluateInterviewIntentDataset(dataset);

function summarizeSlice<T extends string>(
  values: readonly T[],
  getValue: (result: (typeof summary.results)[number]) => T
) {
  return Object.fromEntries(
    values.map((value) => {
      const results = summary.results.filter((result) => getValue(result) === value);
      const passed = results.filter((result) => result.passed).length;

      return [
        value,
        {
          total: results.length,
          passed,
          failed: results.length - passed,
          passRate: results.length === 0 ? "0.0%" : `${((passed / results.length) * 100).toFixed(1)}%`
        }
      ];
    })
  );
}

console.log(
  JSON.stringify(
    {
      datasetId: summary.datasetId,
      version: summary.version,
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      passRate: `${(summary.passRate * 100).toFixed(1)}%`,
      p0Failed: summary.p0Failed,
      byCaseSet: summarizeSlice(
        ["development", "validation", "blind"] as const,
        (result) => result.caseSet
      ),
      byDimension: summarizeSlice(
        ["common", "joy", "fulfillment", "reflection", "improvement", "gratitude"] as const,
        (result) => result.dimension
      ),
      byCategory: summarizeSlice(
        [
          "explicit_control",
          "mixed_content_control",
          "contextual_short_answer",
          "quote_report_correction",
          "pressure_feedback",
          "recovery"
        ] as const,
        (result) => result.category
      )
    },
    null,
    2
  )
);

for (const result of summary.results.filter((item) => !item.passed)) {
  console.log(`\n${result.id} · ${result.severity} · ${result.category} · ${result.dimension}`);
  for (const issue of result.issues) {
    console.log(`- ${issue}`);
  }
}

if (summary.failed > 0) {
  process.exitCode = 1;
}
