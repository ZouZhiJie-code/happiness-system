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
