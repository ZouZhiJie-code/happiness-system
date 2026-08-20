import { NextResponse } from "next/server";

import { resolveJournalPeriodRange } from "@/server/repositories/journal-period-report.repository";
import {
  JournalPeriodGenerationError,
  journalPeriodGenerateRequestSchema,
  journalPeriodReportGenerationService
} from "@/server/services/journal-period-report";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

function statusFor(code: string) {
  if (code === "JOURNAL_PERIOD_REPORT_NOT_FOUND") return 404;
  if (
    code === "JOURNAL_PERIOD_REPORT_SOURCE_EMPTY" ||
    code === "JOURNAL_PERIOD_REPORT_SOURCE_INSUFFICIENT" ||
    code === "JOURNAL_PERIOD_REPORT_SOURCE_INVALID" ||
    code === "JOURNAL_PERIOD_REPORT_WRITER_INVALID_OUTPUT"
  ) return 422;
  if (
    code === "JOURNAL_PERIOD_REPORT_ALREADY_EXISTS" ||
    code === "JOURNAL_PERIOD_REPORT_SAVED_BASE_REQUIRED" ||
    code === "JOURNAL_PERIOD_REPORT_SOURCE_CHANGED" ||
    code === "JOURNAL_PERIOD_REPORT_VERSION_CHANGED" ||
    code === "JOURNAL_PERIOD_REPORT_GENERATION_INPUT_CHANGED" ||
    code === "JOURNAL_PERIOD_REPORT_GENERATION_ALREADY_SETTLED"
  ) return 409;
  if (code === "JOURNAL_PERIOD_REPORT_INVALID_RANGE" || code === "INVALID_ENTRY_DATE") return 400;
  return 500;
}

export async function POST(request: Request) {
  const parsed = journalPeriodGenerateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_JOURNAL_PERIOD_GENERATE_REQUEST" }, { status: 400 });
  }
  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await journalPeriodReportGenerationService.execute(
      {
        userId: user.id,
        period: resolveJournalPeriodRange(parsed.data.kind, parsed.data.date),
        clientOperationId: parsed.data.clientOperationId ?? null,
        expectedSourceSignature: parsed.data.expectedSourceSignature ?? null,
        expectedContentRevision: parsed.data.expectedContentRevision
      },
      parsed.data.task ?? null
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof JournalPeriodGenerationError
      ? error.code
      : error instanceof Error
        ? error.message
        : "JOURNAL_PERIOD_REPORT_GENERATION_FAILED";
    const status = statusFor(code);
    if (status >= 500) console.error("JOURNAL_PERIOD_REPORT_GENERATION_FAILED", error);
    return NextResponse.json(
      {
        error: code,
        retryable: error instanceof JournalPeriodGenerationError ? error.retryable : status >= 500,
        issues: error instanceof JournalPeriodGenerationError && error.issues.length > 0 ? error.issues : undefined
      },
      { status }
    );
  }
}
