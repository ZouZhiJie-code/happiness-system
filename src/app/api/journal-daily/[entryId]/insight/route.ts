import { NextResponse } from "next/server";

import {
  createJournalDailyRequestId,
  journalDailyErrorResponse,
  parseJournalDailyRequest
} from "@/features/journal-daily/api";
import { normalizeJournalDailyIssue } from "@/features/journal-daily/issue";
import { generateJournalDailySelfInsightRequestSchema } from "@/features/journal-daily/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { generateJournalDailySelfInsight } from "@/server/services/journal-daily/journal-daily.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const requestId = createJournalDailyRequestId();
  const parsed = await parseJournalDailyRequest(
    request,
    generateJournalDailySelfInsightRequestSchema,
    requestId
  );
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const [{ entryId }, user] = await Promise.all([
      context.params,
      requireCurrentUserFromRequest(request)
    ]);
    const result = await generateJournalDailySelfInsight({
      userId: user.id,
      entryId,
      ...parsed.data,
      requestId
    });
    const notice =
      result.outcome === "insufficient_evidence"
        ? normalizeJournalDailyIssue(
            new Error("JOURNAL_DAILY_INSIGHT_INSUFFICIENT"),
            requestId
          ).issue
        : null;
    return NextResponse.json(
      { ...result, notice },
      { status: result.outcome === "processing" ? 202 : 200 }
    );
  } catch (error) {
    return journalDailyErrorResponse(error, requestId);
  }
}
