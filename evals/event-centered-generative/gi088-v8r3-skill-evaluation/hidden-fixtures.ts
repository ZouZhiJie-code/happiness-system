import { z } from "zod";

import {
  GI088_V8R3_EXPECTED_CASE_COUNTS,
  gi088V8r3EvaluationCaseSchema,
  type Gi088V8r3EvaluationCase
} from "./contracts";
import { createGi088V8r3CaseSetCommitment } from "./runner";

export const GI088_V8R3_PRIVATE_HIDDEN_FILE_VERSION =
  "2026-08-11.gi088-v8r3-private-hidden-admission-v1" as const;

export const GI088_V8R3_PRIVATE_HIDDEN_AGGREGATE_COMMITMENT =
  "4d4f8e67816608a5d37ac3b60163d772554138199aaa60c8f620b7a18c2d11b9" as const;

const hiddenCaseSchema = gi088V8r3EvaluationCaseSchema.superRefine(
  (value, context) => {
    if (value.partition !== "hidden_admission") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "private hidden cases must use hidden_admission"
      });
    }
    if (value.source !== "fresh_hidden") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "private hidden cases must use fresh_hidden"
      });
    }
  }
);

export const gi088V8r3PrivateHiddenFileSchema = z
  .object({
    version: z.literal(GI088_V8R3_PRIVATE_HIDDEN_FILE_VERSION),
    cases: z.array(hiddenCaseSchema).length(
      GI088_V8R3_EXPECTED_CASE_COUNTS.hiddenSingleTurn +
        GI088_V8R3_EXPECTED_CASE_COUNTS.hiddenTrajectory
    )
  })
  .strict()
  .superRefine((value, context) => {
    const singleTurnCount = value.cases.filter(
      (item) => item.kind === "single_turn"
    ).length;
    const trajectoryCount = value.cases.filter(
      (item) => item.kind === "trajectory"
    ).length;
    if (
      singleTurnCount !== GI088_V8R3_EXPECTED_CASE_COUNTS.hiddenSingleTurn ||
      trajectoryCount !== GI088_V8R3_EXPECTED_CASE_COUNTS.hiddenTrajectory
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "private hidden case kinds do not match the frozen cardinality"
      });
    }
  });

export function parseGi088V8r3PrivateHiddenFile(
  input: unknown
): readonly Gi088V8r3EvaluationCase[] {
  const cases = gi088V8r3PrivateHiddenFileSchema.parse(input).cases;
  if (
    createGi088V8r3CaseSetCommitment(cases) !==
    GI088_V8R3_PRIVATE_HIDDEN_AGGREGATE_COMMITMENT
  ) {
    throw new Error("GI088_V8R3_PRIVATE_HIDDEN_AGGREGATE_MISMATCH");
  }
  return cases;
}
