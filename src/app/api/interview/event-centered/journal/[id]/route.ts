import { NextResponse } from "next/server";

import { updateJournalEventEntryRequestSchema } from "@/features/interview/schema/journal-event-entry.schema";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import {
  editJournalEventEntry,
  readJournalEventEntry
} from "@/server/services/interview/journal-event-entry.service";
import {
  journalPreviewStatusFor,
  readJournalPreviewRequest
} from "@/server/services/journal-preview/request";
import { journalPreviewService } from "@/server/services/journal-preview/service";

export const dynamic = "force-dynamic";

function statusFor(code: string) {
  if (code === "EVENT_JOURNAL_ENTRY_NOT_FOUND") return 404;
  if (code === "EVENT_JOURNAL_ENTRY_VERSION_CONFLICT" || code === "EVENT_CENTERED_ENTRY_DISABLED") return 409;
  return 500;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const { id } = await context.params;
    const preview = readJournalPreviewRequest(request);
    if (preview) {
      return NextResponse.json(await journalPreviewService.readRecord(
        user.id,
        preview.sessionId,
        preview.caseId,
        id
      ));
    }
    const entry = await readJournalEventEntry(user.id, id);
    if (!entry) return NextResponse.json({ error: "EVENT_JOURNAL_ENTRY_NOT_FOUND" }, { status: 404 });
    return NextResponse.json(entry);
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    console.error("EVENT_JOURNAL_ENTRY_READ_FAILED", error);
    return NextResponse.json({ error: "EVENT_JOURNAL_ENTRY_READ_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = updateJournalEventEntryRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_EVENT_JOURNAL_UPDATE_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const { id } = await context.params;
    const preview = readJournalPreviewRequest(request);
    if (preview) {
      return NextResponse.json(await journalPreviewService.updateRecord({
        userId: user.id,
        sessionId: preview.sessionId,
        caseId: preview.caseId,
        entryId: id,
        ...parsed.data
      }));
    }
    const entry = await editJournalEventEntry({
      userId: user.id,
      entryId: id,
      ...parsed.data
    });
    return NextResponse.json(entry);
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "EVENT_JOURNAL_ENTRY_UPDATE_FAILED";
    if (code.startsWith("JOURNAL_PREVIEW_")) {
      return NextResponse.json({ error: code }, { status: journalPreviewStatusFor(code) });
    }
    const status = statusFor(code);
    if (status >= 500) console.error("EVENT_JOURNAL_ENTRY_UPDATE_FAILED", error);
    return NextResponse.json({ error: code, retryable: status >= 500 }, { status });
  }
}
