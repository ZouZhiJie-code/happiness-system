import { NextResponse } from "next/server";

import {
  saveAllDailyJournalRequestSchema,
  saveAllDailyJournalResponseSchema
} from "@/features/daily-journal/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { saveAllAndGenerateDailyJournal, DailyJournalError } from "@/server/services/daily-journal/daily-journal.service";

export async function POST(request: Request) {
  const user = await requireCurrentUserFromRequest(request);
  const body = await request.json();
  const parsed = saveAllDailyJournalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_DAILY_JOURNAL_SAVE_ALL_REQUEST" }, { status: 400 });
  }

  try {
    const result = await saveAllAndGenerateDailyJournal(user.id, parsed.data.date);

    return NextResponse.json(saveAllDailyJournalResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof DailyJournalError) {
      const status = error.code === "DAILY_JOURNAL_SOURCE_EMPTY" ? 409 : 500;

      return NextResponse.json(
        {
          error: error.code,
          retryable: error.retryable,
          message:
            error.code === "DAILY_JOURNAL_SOURCE_EMPTY"
              ? "当天还没有已保存的维度日志，请先保存至少一篇维度日志。"
              : "收成完整日志失败，请稍后重试。"
        },
        { status }
      );
    }

    return NextResponse.json(
      { error: "DAILY_JOURNAL_SAVE_ALL_FAILED", retryable: true, message: "收成完整日志失败，请稍后重试。" },
      { status: 500 }
    );
  }
}
