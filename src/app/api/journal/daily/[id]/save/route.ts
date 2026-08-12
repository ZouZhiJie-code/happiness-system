import { NextResponse } from "next/server";

import { saveJournalDailyEntry } from "@/server/repositories/journal-daily-entry.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import { journalDailySaveRequestSchema } from "@/server/services/journal-daily-entry";
import {
  journalPreviewStatusFor,
  readJournalPreviewRequest
} from "@/server/services/journal-preview/request";
import { journalPreviewService } from "@/server/services/journal-preview/service";

function statusFor(code: string) {
  if (code === "JOURNAL_DAILY_ENTRY_NOT_FOUND") return 404;
  if (
    code === "JOURNAL_DAILY_ENTRY_VERSION_CHANGED" ||
    code === "JOURNAL_DAILY_SOURCE_CHANGED"
  ) return 409;
  return 500;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const parsed = journalDailySaveRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_JOURNAL_DAILY_SAVE_REQUEST" },
      { status: 400 }
    );
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const { id } = await context.params;
    const preview = readJournalPreviewRequest(request);
    if (preview) {
      const entry = await journalPreviewService.saveDailyEntry({
        userId: user.id,
        sessionId: preview.sessionId,
        caseId: preview.caseId,
        entryId: id,
        ...parsed.data
      });
      return NextResponse.json(entry, {
        headers: { "Cache-Control": "private, no-store" }
      });
    }
    const entry = await saveJournalDailyEntry({
      userId: user.id,
      entryId: id,
      expectedContentRevision: parsed.data.expectedContentRevision
    });
    return NextResponse.json(entry, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "JOURNAL_DAILY_SAVE_FAILED";
    if (code.startsWith("JOURNAL_PREVIEW_")) {
      return NextResponse.json({ error: code }, { status: journalPreviewStatusFor(code) });
    }
    const status = statusFor(code);
    if (status >= 500) console.error("JOURNAL_DAILY_SAVE_FAILED", error);
    return NextResponse.json({ error: code, retryable: status >= 500 }, { status });
  }
}
