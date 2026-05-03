import { NextResponse } from "next/server";

import { dailyHappinessScoreSaveRequestSchema } from "@/features/happiness-score/schema";
import {
  HappinessScoreSaveError,
  saveDailyHappinessScore
} from "@/server/services/happiness-score/happiness-score.service";

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = dailyHappinessScoreSaveRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_HAPPINESS_SCORE_REQUEST" }, { status: 400 });
  }

  try {
    const result = await saveDailyHappinessScore(parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof HappinessScoreSaveError) {
      const status = error.code === "HAPPINESS_SCORE_EDIT_WINDOW_EXCEEDED" ? 403 : 500;
      return NextResponse.json({ error: error.code }, { status });
    }

    return NextResponse.json({ error: "HAPPINESS_SCORE_SAVE_FAILED" }, { status: 500 });
  }
}
