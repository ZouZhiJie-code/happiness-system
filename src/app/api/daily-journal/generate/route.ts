import { NextResponse } from "next/server";

import {
  generateDailyJournalRequestSchema,
  generateDailyJournalResponseSchema
} from "@/features/daily-journal/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { generateDailyJournal, DailyJournalError } from "@/server/services/daily-journal/daily-journal.service";

export async function POST(request: Request) {
  const user = await requireCurrentUserFromRequest(request);
  const body = await request.json();
  const parsed = generateDailyJournalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_DAILY_JOURNAL_GENERATE_REQUEST" }, { status: 400 });
  }

  try {
    const result = await generateDailyJournal(user.id, parsed.data.date);

    return NextResponse.json(generateDailyJournalResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof DailyJournalError) {
      const status = error.code === "DAILY_JOURNAL_SOURCE_EMPTY" ? 409 : 500;

      return NextResponse.json(
        {
          error: error.code,
          retryable: error.retryable,
          message:
            error.code === "DAILY_JOURNAL_SOURCE_EMPTY"
              ? "当天还没有已保存的维度日志，先保存至少一篇维度日志后再生成。"
              : "当天日志生成失败，请稍后重试。"
        },
        { status }
      );
    }

    return NextResponse.json(
      { error: "DAILY_JOURNAL_GENERATE_FAILED", retryable: true, message: "当天日志生成失败，请稍后重试。" },
      { status: 500 }
    );
  }
}
