import { NextResponse } from "next/server";

import { saveJournalEventEntryRequestSchema } from "@/features/interview/schema/journal-event-entry.schema";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import { confirmJournalEventEntry } from "@/server/services/interview/journal-event-entry.service";
import {
  journalPreviewStatusFor,
  readJournalPreviewRequest
} from "@/server/services/journal-preview/request";
import { journalPreviewService } from "@/server/services/journal-preview/service";

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
    const preview = readJournalPreviewRequest(request);
    if (preview) {
      return NextResponse.json(await journalPreviewService.saveRecord({
        userId: user.id,
        sessionId: preview.sessionId,
        caseId: preview.caseId,
        entryId: id,
        ...parsed.data
      }));
    }
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
    if (code.startsWith("JOURNAL_PREVIEW_")) {
      return NextResponse.json({ error: code }, { status: journalPreviewStatusFor(code) });
    }
    const status = statusFor(code);
    if (status >= 500) console.error("EVENT_JOURNAL_ENTRY_SAVE_FAILED", error);
    return NextResponse.json({ error: code, retryable: status >= 500 }, { status });
  }
}
