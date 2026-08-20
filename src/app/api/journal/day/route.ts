import { NextResponse } from "next/server";

import { parseEntryDateInput } from "@/features/interview/entry-date";
import { getJournalDailyJournalView } from "@/server/repositories/journal-daily-entry.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import {
  journalPreviewStatusFor,
  readJournalPreviewRequest
} from "@/server/services/journal-preview/request";
import { journalPreviewService } from "@/server/services/journal-preview/service";

export const dynamic = "force-dynamic";

function readEntryDate(request: Request) {
  const url = new URL(request.url);
  const entryDate = url.searchParams.get("entryDate") ?? url.searchParams.get("date") ?? "";
  parseEntryDateInput(entryDate);
  return entryDate;
}

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const entryDate = readEntryDate(request);
    const preview = readJournalPreviewRequest(request);
    if (preview) {
      const previewDay = await journalPreviewService.readDay(
        user.id,
        preview.sessionId,
        preview.caseId,
        entryDate
      );
      return NextResponse.json(
        previewDay.view,
        {
          headers: {
            "Cache-Control": "private, no-store",
            "X-Daily-Light-Preview": preview.mode,
            "X-Daily-Light-Preview-Case": preview.caseId,
            "X-Daily-Light-Preview-Model-Calls": "0"
          }
        }
      );
    }
    const view = await getJournalDailyJournalView(user.id, entryDate);
    return NextResponse.json(view, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "JOURNAL_DAY_READ_FAILED";
    if (code === "INVALID_ENTRY_DATE") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    if (code.startsWith("JOURNAL_PREVIEW_")) {
      return NextResponse.json({ error: code }, { status: journalPreviewStatusFor(code) });
    }
    console.error("JOURNAL_DAY_READ_FAILED", error);
    return NextResponse.json({ error: "JOURNAL_DAY_READ_FAILED" }, { status: 500 });
  }
}
