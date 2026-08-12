import { NextResponse } from "next/server";

import { getJournalPeriodReportView } from "@/server/repositories/journal-period-report.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

function readRequest(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const date = url.searchParams.get("date") ?? url.searchParams.get("entryDate") ?? "";
  if (kind !== "week" && kind !== "month") throw new Error("JOURNAL_PERIOD_REPORT_INVALID_KIND");
  return { kind: kind as "week" | "month", date };
}

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const { kind, date } = readRequest(request);
    const view = await getJournalPeriodReportView(user.id, kind, date);
    return NextResponse.json(view, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "JOURNAL_PERIOD_REPORT_READ_FAILED";
    if (code === "INVALID_ENTRY_DATE" || code === "JOURNAL_PERIOD_REPORT_INVALID_KIND") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    console.error("JOURNAL_PERIOD_REPORT_READ_FAILED", error);
    return NextResponse.json({ error: "JOURNAL_PERIOD_REPORT_READ_FAILED" }, { status: 500 });
  }
}
