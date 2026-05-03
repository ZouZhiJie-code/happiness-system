import {
  dailyHappinessScoreInputSchema,
  dailyHappinessScoreSaveRequestSchema
} from "@/features/happiness-score/schema";

describe("daily happiness score schema", () => {
  it("accepts a full 1-10 score payload", () => {
    expect(() =>
      dailyHappinessScoreInputSchema.parse({
        date: "2026-05-03",
        meaningScore: 8,
        healthScore: 7,
        virtueScore: 9,
        autonomyScore: 6,
        interestScore: 8,
        skillScore: 7,
        relationshipScore: 9,
        livingConditionScore: 6
      })
    ).not.toThrow();
  });

  it("rejects scores outside the 1-10 range", () => {
    expect(() =>
      dailyHappinessScoreInputSchema.parse({
        date: "2026-05-03",
        meaningScore: 0,
        healthScore: 7,
        virtueScore: 9,
        autonomyScore: 6,
        interestScore: 8,
        skillScore: 7,
        relationshipScore: 9,
        livingConditionScore: 11
      })
    ).toThrow();
  });

  it("accepts the public save request payload shape", () => {
    expect(() =>
      dailyHappinessScoreSaveRequestSchema.parse({
        date: "2026-05-03",
        scores: {
          meaning: 8,
          health: 7,
          virtue: 9,
          autonomy: 6,
          interest: 8,
          skill: 7,
          relationship: 9,
          livingCondition: 6
        }
      })
    ).not.toThrow();
  });

  it("rejects save requests with missing score items", () => {
    expect(() =>
      dailyHappinessScoreSaveRequestSchema.parse({
        date: "2026-05-03",
        scores: {
          meaning: 8,
          health: 7,
          virtue: 9,
          autonomy: 6,
          interest: 8,
          skill: 7,
          relationship: 9
        }
      })
    ).toThrow();
  });

  it("rejects save requests with non-integer or out-of-range values", () => {
    expect(() =>
      dailyHappinessScoreSaveRequestSchema.parse({
        date: "2026-05-03",
        scores: {
          meaning: 8.5,
          health: 7,
          virtue: 9,
          autonomy: 6,
          interest: 8,
          skill: 7,
          relationship: 9,
          livingCondition: 6
        }
      })
    ).toThrow();

    expect(() =>
      dailyHappinessScoreSaveRequestSchema.parse({
        date: "2026-05-03",
        scores: {
          meaning: 8,
          health: 0,
          virtue: 9,
          autonomy: 6,
          interest: 8,
          skill: 7,
          relationship: 9,
          livingCondition: 11
        }
      })
    ).toThrow();
  });
});
