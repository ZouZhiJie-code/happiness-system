import { NextResponse } from "next/server";

import { updateJournalPeriodReport } from "@/server/repositories/journal-period-report.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";
import { journalPeriodAutosaveRequestSchema } from "@/server/services/journal-period-report";

export const dynamic = "force-dynamic";

function statusFor(code: string) {
  if (code === "JOURNAL_PERIOD_REPORT_NOT_FOUND") return 404;
  if (code === "JOURNAL_PERIOD_REPORT_VERSION_CHANGED" || code === "JOURNAL_PERIOD_REPORT_SOURCE_CHANGED") {
    return 409;
  }
  if (
    code === "JOURNAL_PERIOD_REPORT_INVALID" ||
    code === "JOURNAL_PERIOD_REPORT_PARAGRAPHS_INVALID" ||
    code === "JOURNAL_PERIOD_REPORT_PARAGRAPHS_CONTENT_MISMATCH"
  ) return 422;
  return 500;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = journalPeriodAutosaveRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_JOURNAL_PERIOD_AUTOSAVE_REQUEST" }, { status: 400 });
  }
  try {
    const user = await requireCurrentUserFromRequest(request);
    const { id } = await context.params;
    const report = await updateJournalPeriodReport({
      userId: user.id,
      reportId: id,
      expectedContentRevision: parsed.data.expectedContentRevision,
      title: parsed.data.title,
      content: parsed.data.content,
      paragraphs: parsed.data.paragraphs
    });
    return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "JOURNAL_PERIOD_REPORT_AUTOSAVE_FAILED";
    const status = statusFor(code);
    if (status >= 500) console.error("JOURNAL_PERIOD_REPORT_AUTOSAVE_FAILED", error);
    return NextResponse.json({ error: code, retryable: status >= 500 }, { status });
  }
}
