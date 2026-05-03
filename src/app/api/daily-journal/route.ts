import { NextResponse } from "next/server";

import { getDailyJournalResponseSchema } from "@/features/daily-journal/schema";
import { getDailyJournal, DailyJournalError } from "@/server/services/daily-journal/daily-journal.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim();

  if (!date) {
    return NextResponse.json({ error: "INVALID_DAILY_JOURNAL_DATE" }, { status: 400 });
  }

  try {
    const result = await getDailyJournal(date);

    return NextResponse.json(getDailyJournalResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof DailyJournalError) {
      return NextResponse.json({ error: error.code, retryable: error.retryable }, { status: 500 });
    }

    return NextResponse.json({ error: "DAILY_JOURNAL_QUERY_FAILED", retryable: true }, { status: 500 });
  }
}
