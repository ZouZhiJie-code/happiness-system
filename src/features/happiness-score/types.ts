export const dailyHappinessScoreKeys = [
  "meaningScore",
  "healthScore",
  "virtueScore",
  "autonomyScore",
  "interestScore",
  "skillScore",
  "relationshipScore",
  "livingConditionScore"
] as const;

export type DailyHappinessScoreKey = (typeof dailyHappinessScoreKeys)[number];

export const happinessScoreRequestKeys = [
  "meaning",
  "health",
  "virtue",
  "autonomy",
  "interest",
  "skill",
  "relationship",
  "livingCondition"
] as const;

export type HappinessScoreRequestKey = (typeof happinessScoreRequestKeys)[number];

export const happinessScoreKeyPairs = [
  { requestKey: "meaning", recordKey: "meaningScore" },
  { requestKey: "health", recordKey: "healthScore" },
  { requestKey: "virtue", recordKey: "virtueScore" },
  { requestKey: "autonomy", recordKey: "autonomyScore" },
  { requestKey: "interest", recordKey: "interestScore" },
  { requestKey: "skill", recordKey: "skillScore" },
  { requestKey: "relationship", recordKey: "relationshipScore" },
  { requestKey: "livingCondition", recordKey: "livingConditionScore" }
] as const satisfies readonly {
  requestKey: HappinessScoreRequestKey;
  recordKey: DailyHappinessScoreKey;
}[];

export interface DailyHappinessScoreInput {
  date: string;
  meaningScore: number;
  healthScore: number;
  virtueScore: number;
  autonomyScore: number;
  interestScore: number;
  skillScore: number;
  relationshipScore: number;
  livingConditionScore: number;
}

export interface DailyHappinessScoreRecord extends DailyHappinessScoreInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
