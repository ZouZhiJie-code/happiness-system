import { NextResponse } from "next/server";

import { saveDailyJournalResponseSchema } from "@/features/daily-journal/schema";
import { DailyJournalError, saveDailyJournal } from "@/server/services/daily-journal/daily-journal.service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const result = await saveDailyJournal(id);

    return NextResponse.json(saveDailyJournalResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof DailyJournalError && error.code === "DAILY_JOURNAL_NOT_FOUND") {
      return NextResponse.json({ error: error.code, retryable: false }, { status: 404 });
    }

    return NextResponse.json({ error: "DAILY_JOURNAL_SAVE_FAILED", retryable: true }, { status: 500 });
  }
}
