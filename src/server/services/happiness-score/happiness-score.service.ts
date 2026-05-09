import { formatEntryDate, getTodayEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import type { DailyHappinessScoreSaveRequestPayload } from "@/features/happiness-score/schema";
import type { DailyHappinessScoreInput } from "@/features/happiness-score/types";
import { upsertDailyHappinessScore } from "@/server/repositories/daily-happiness-score.repository";

export type HappinessScoreSaveErrorCode =
  | "HAPPINESS_SCORE_EDIT_WINDOW_EXCEEDED"
  | "HAPPINESS_SCORE_SAVE_FAILED";

export class HappinessScoreSaveError extends Error {
  constructor(
    public readonly code: HappinessScoreSaveErrorCode,
    message: string = code,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "HappinessScoreSaveError";
  }
}

export function getPreviousEntryDate(date: string) {
  const parsed = parseEntryDateInput(date);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return formatEntryDate(parsed);
}

export function isHappinessScoreEditableDate(date: string, today = getTodayEntryDate()) {
  const targetDate = parseEntryDateInput(date).getTime();
  const todayDate = parseEntryDateInput(today).getTime();
  return targetDate <= todayDate;
}

export function mapHappinessScoreSaveRequestToInput(
  payload: DailyHappinessScoreSaveRequestPayload
): DailyHappinessScoreInput {
  return {
    date: payload.date,
    meaningScore: payload.scores.meaning,
    healthScore: payload.scores.health,
    virtueScore: payload.scores.virtue,
    autonomyScore: payload.scores.autonomy,
    interestScore: payload.scores.interest,
    skillScore: payload.scores.skill,
    relationshipScore: payload.scores.relationship,
    livingConditionScore: payload.scores.livingCondition
  };
}

export async function saveDailyHappinessScore(payload: DailyHappinessScoreSaveRequestPayload) {
  if (!isHappinessScoreEditableDate(payload.date)) {
    throw new HappinessScoreSaveError("HAPPINESS_SCORE_EDIT_WINDOW_EXCEEDED");
  }

  try {
    return await upsertDailyHappinessScore(mapHappinessScoreSaveRequestToInput(payload));
  } catch (error) {
    throw new HappinessScoreSaveError("HAPPINESS_SCORE_SAVE_FAILED", "Happiness score save failed.", error);
  }
}
