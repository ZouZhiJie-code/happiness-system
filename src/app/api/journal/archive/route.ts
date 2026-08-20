import { NextResponse } from "next/server";

import { parseEntryDateInput } from "@/features/interview/entry-date";
import { getJournalArchiveIndex } from "@/server/repositories/journal-archive.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind");
    const date = params.get("date") ?? "";
    const limit = Number(params.get("limit") ?? "12");
    if ((kind !== "day" && kind !== "week" && kind !== "month") || !Number.isInteger(limit) || limit < 1 || limit > 30) {
      return NextResponse.json({ error: "INVALID_JOURNAL_ARCHIVE_REQUEST" }, { status: 400 });
    }
    try {
      parseEntryDateInput(date);
    } catch {
      return NextResponse.json({ error: "INVALID_ENTRY_DATE" }, { status: 400 });
    }
    const view = await getJournalArchiveIndex({ userId: user.id, kind, date, limit });
    return NextResponse.json(view, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    console.error("JOURNAL_ARCHIVE_READ_FAILED", error);
    return NextResponse.json({ error: "JOURNAL_ARCHIVE_READ_FAILED" }, { status: 500 });
  }
}
