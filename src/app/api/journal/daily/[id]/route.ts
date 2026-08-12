import { NextResponse } from "next/server";

import { updateJournalDailyEntry } from "@/server/repositories/journal-daily-entry.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import { journalDailyAutosaveRequestSchema } from "@/server/services/journal-daily-entry";

export const dynamic = "force-dynamic";

function statusFor(code: string) {
  if (code === "JOURNAL_DAILY_ENTRY_NOT_FOUND") return 404;
  if (
    code === "JOURNAL_DAILY_ENTRY_VERSION_CHANGED" ||
    code === "JOURNAL_DAILY_SOURCE_CHANGED" ||
    code === "JOURNAL_DAILY_ENTRY_READ_ONLY"
  ) return 409;
  if (
    code === "JOURNAL_DAILY_ENTRY_INVALID" ||
    code === "JOURNAL_DAILY_PARAGRAPHS_INVALID" ||
    code === "JOURNAL_DAILY_PARAGRAPHS_CONTENT_MISMATCH"
  ) return 422;
  return 500;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const parsed = journalDailyAutosaveRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_JOURNAL_DAILY_AUTOSAVE_REQUEST" },
      { status: 400 }
    );
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const { id } = await context.params;
    const entry = await updateJournalDailyEntry({
      userId: user.id,
      entryId: id,
      expectedContentRevision: parsed.data.expectedContentRevision,
      title: parsed.data.title,
      content: parsed.data.content,
      paragraphs: parsed.data.paragraphs
    });
    return NextResponse.json(entry, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "JOURNAL_DAILY_AUTOSAVE_FAILED";
    const status = statusFor(code);
    if (status >= 500) console.error("JOURNAL_DAILY_AUTOSAVE_FAILED", error);
    return NextResponse.json({ error: code, retryable: status >= 500 }, { status });
  }
}
