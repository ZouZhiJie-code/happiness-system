import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

import {
  buildInvalidJournalDailyIssue,
  normalizeJournalDailyIssue
} from "@/features/journal-daily/issue";
import { createInterviewRequestId } from "@/server/services/interview/respond-error";

export function createJournalDailyRequestId() {
  return createInterviewRequestId().replace(/^ir_/u, "jd_");
}

export async function parseJournalDailyRequest<T>(
  request: Request,
  schema: ZodSchema<T>,
  requestId: string
) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});

  if (!parsed.success) {
    return {
      success: false as const,
      response: NextResponse.json(
        {
          error: "INVALID_JOURNAL_DAILY_REQUEST",
          message: "这次请求缺少必要信息，或内容长度超出范围。",
          issue: buildInvalidJournalDailyIssue(requestId)
        },
        { status: 400 }
      )
    };
  }

  return { success: true as const, data: parsed.data };
}

export function journalDailyErrorResponse(error: unknown, requestId: string) {
  const normalized = normalizeJournalDailyIssue(error, requestId);
  return NextResponse.json(
    {
      error: normalized.issue.code,
      message: normalized.issue.message,
      issue: normalized.issue
    },
    { status: normalized.status }
  );
}
