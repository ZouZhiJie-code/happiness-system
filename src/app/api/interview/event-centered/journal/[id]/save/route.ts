import { NextResponse } from "next/server";

import { saveJournalEventEntryRequestSchema } from "@/features/interview/schema/journal-event-entry.schema";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import { confirmJournalEventEntry } from "@/server/services/interview/journal-event-entry.service";

function statusFor(code: string) {
  if (code === "EVENT_JOURNAL_ENTRY_NOT_FOUND") return 404;
  if (code === "EVENT_JOURNAL_ENTRY_VERSION_CONFLICT" || code === "EVENT_CENTERED_ENTRY_DISABLED") return 409;
  return 500;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = saveJournalEventEntryRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_EVENT_JOURNAL_SAVE_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const { id } = await context.params;
    const entry = await confirmJournalEventEntry({
      userId: user.id,
      entryId: id,
      expectedContentRevision: parsed.data.expectedContentRevision
    });
    return NextResponse.json(entry);
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "EVENT_JOURNAL_ENTRY_SAVE_FAILED";
    const status = statusFor(code);
    if (status >= 500) console.error("EVENT_JOURNAL_ENTRY_SAVE_FAILED", error);
    return NextResponse.json({ error: code, retryable: status >= 500 }, { status });
  }
}
