import { NextResponse } from "next/server";

import {
  updateDailyJournalRequestSchema,
  updateDailyJournalResponseSchema
} from "@/features/daily-journal/schema";
import { DailyJournalError, updateDailyJournal } from "@/server/services/daily-journal/daily-journal.service";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateDailyJournalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_DAILY_JOURNAL_UPDATE_REQUEST" }, { status: 400 });
  }

  try {
    const result = await updateDailyJournal(id, parsed.data);

    return NextResponse.json(updateDailyJournalResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof DailyJournalError && error.code === "DAILY_JOURNAL_NOT_FOUND") {
      return NextResponse.json({ error: error.code, retryable: false }, { status: 404 });
    }

    return NextResponse.json({ error: "DAILY_JOURNAL_UPDATE_FAILED", retryable: true }, { status: 500 });
  }
}
