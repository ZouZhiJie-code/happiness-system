import { NextResponse } from "next/server";

import { saveJournalPeriodReport } from "@/server/repositories/journal-period-report.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import { journalPeriodSaveRequestSchema } from "@/server/services/journal-period-report";

function statusFor(code: string) {
  if (code === "JOURNAL_PERIOD_REPORT_NOT_FOUND") return 404;
  if (code === "JOURNAL_PERIOD_REPORT_VERSION_CHANGED" || code === "JOURNAL_PERIOD_REPORT_SOURCE_CHANGED") {
    return 409;
  }
  return 500;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = journalPeriodSaveRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_JOURNAL_PERIOD_SAVE_REQUEST" }, { status: 400 });
  }
  try {
    const user = await requireCurrentUserFromRequest(request);
    const { id } = await context.params;
    const report = await saveJournalPeriodReport({
      userId: user.id,
      reportId: id,
      expectedContentRevision: parsed.data.expectedContentRevision
    });
    return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "JOURNAL_PERIOD_REPORT_SAVE_FAILED";
    const status = statusFor(code);
    if (status >= 500) console.error("JOURNAL_PERIOD_REPORT_SAVE_FAILED", error);
    return NextResponse.json({ error: code, retryable: status >= 500 }, { status });
  }
}
