import { NextResponse } from "next/server";

import { generateJournalEventEntryRequestSchema } from "@/features/interview/schema/journal-event-entry.schema";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import { readJournalPreviewRequest } from "@/server/services/journal-preview/request";
import { generateJournalEventEntry } from "@/server/services/interview/journal-event-entry.service";

function statusFor(code: string) {
  if (code === "EVENT_NOT_FOUND" || code === "SESSION_NOT_FOUND") return 404;
  if (
    code === "EVENT_STATE_CHANGED" ||
    code === "EVENT_OPERATION_CONFLICT" ||
    code === "EVENT_JOURNAL_GENERATION_NOT_ALLOWED" ||
    code === "EVENT_CENTERED_ENTRY_DISABLED" ||
    code === "JOURNAL_DAY_MODE_CONFLICT" ||
    code === "JOURNAL_DAY_MODE_MIXED"
  ) return 409;
  if (code === "EVENT_JOURNAL_SOURCE_INSUFFICIENT") return 422;
  return 500;
}

export async function POST(request: Request) {
  const parsed = generateJournalEventEntryRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_EVENT_JOURNAL_GENERATE_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    if (readJournalPreviewRequest(request)) {
      return NextResponse.json({ error: "JOURNAL_PREVIEW_MODEL_CALL_DISABLED" }, { status: 409 });
    }
    const result = await generateJournalEventEntry({
      userId: user.id,
      ...parsed.data,
      requestId: request.headers.get("x-request-id")
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "EVENT_JOURNAL_GENERATION_FAILED";
    const status = statusFor(code);
    if (status >= 500) console.error("EVENT_JOURNAL_GENERATION_FAILED", error);
    return NextResponse.json({
      error: code,
      retryable: status >= 500,
      ...(status === 422
        ? { message: "当前材料还不足以形成可信日志。请回到当前阶段补充一句，再重新整理。" }
        : {})
    }, { status });
  }
}
