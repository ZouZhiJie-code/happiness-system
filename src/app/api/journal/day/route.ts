import { NextResponse } from "next/server";

import { parseEntryDateInput } from "@/features/interview/entry-date";
import { getJournalDailyJournalView } from "@/server/repositories/journal-daily-entry.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

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
    console.error("JOURNAL_DAY_READ_FAILED", error);
    return NextResponse.json({ error: "JOURNAL_DAY_READ_FAILED" }, { status: 500 });
  }
}
