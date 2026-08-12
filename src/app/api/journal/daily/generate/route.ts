import { NextResponse } from "next/server";

import {
  JournalDailyGenerationError,
  journalDailyEntryGenerationService,
  journalDailyGenerationRequestSchema
} from "@/server/services/journal-daily-entry";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

function statusFor(code: string) {
  if (code === "JOURNAL_DAILY_NOT_FOUND") return 404;
  if (code === "JOURNAL_DAILY_INVALID_DATE") return 400;
  if (
    code === "JOURNAL_DAILY_SOURCE_EMPTY" ||
    code === "JOURNAL_DAILY_SOURCE_INSUFFICIENT" ||
    code === "JOURNAL_DAILY_SOURCE_INVALID" ||
    code === "JOURNAL_DAILY_WRITER_INVALID_OUTPUT" ||
    code === "JOURNAL_DAILY_QUALITY_GATE_FAILED"
  ) return 422;
  if (
    code === "JOURNAL_DAILY_ALREADY_EXISTS" ||
    code === "JOURNAL_DAILY_SAVED_BASE_REQUIRED" ||
    code === "JOURNAL_DAILY_SOURCE_CHANGED" ||
    code === "JOURNAL_DAILY_ENTRY_VERSION_CHANGED" ||
    code === "JOURNAL_DAILY_GENERATION_INPUT_CHANGED" ||
    code === "JOURNAL_DAILY_GENERATION_IN_PROGRESS" ||
    code === "JOURNAL_DAILY_GENERATION_ALREADY_SETTLED"
  ) return 409;
  return 500;
}

export async function POST(request: Request) {
  const parsed = journalDailyGenerationRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_JOURNAL_DAILY_GENERATE_REQUEST" },
      { status: 400 }
    );
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await journalDailyEntryGenerationService.execute(
      {
        userId: user.id,
        entryDate: parsed.data.entryDate,
        clientOperationId: parsed.data.clientOperationId ?? null,
        expectedSourceSignature: parsed.data.expectedSourceSignature ?? null,
        expectedContentRevision: parsed.data.expectedContentRevision,
        requestId: request.headers.get("x-request-id")
      },
      parsed.data.task ?? null
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof JournalDailyGenerationError
      ? error.code
      : error instanceof Error
        ? error.message
        : "JOURNAL_DAILY_GENERATION_FAILED";
    const status = statusFor(code);
    if (status >= 500) console.error("JOURNAL_DAILY_GENERATION_FAILED", error);
    return NextResponse.json(
      {
        error: code,
        retryable:
          error instanceof JournalDailyGenerationError
            ? error.retryable
            : status >= 500,
        issues:
          error instanceof JournalDailyGenerationError && error.issues.length > 0
            ? error.issues
            : undefined
      },
      { status }
    );
  }
}
