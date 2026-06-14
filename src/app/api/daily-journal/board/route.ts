import { NextResponse } from "next/server";

import { getTodayJournalBoardResponseSchema } from "@/features/daily-journal/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { getTodayJournalBoard, DailyJournalError } from "@/server/services/daily-journal/daily-journal.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim();

  if (!date) {
    return NextResponse.json({ error: "INVALID_DAILY_JOURNAL_DATE" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await getTodayJournalBoard(user.id, date);

    return NextResponse.json(getTodayJournalBoardResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof DailyJournalError) {
      return NextResponse.json({ error: error.code, retryable: error.retryable }, { status: 500 });
    }

    return NextResponse.json({ error: "DAILY_JOURNAL_BOARD_QUERY_FAILED", retryable: true }, { status: 500 });
  }
}
