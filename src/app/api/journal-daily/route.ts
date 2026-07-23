import { NextResponse } from "next/server";

import {
  buildInvalidJournalDailyIssue
} from "@/features/journal-daily/issue";
import {
  createJournalDailyRequestId,
  journalDailyErrorResponse
} from "@/features/journal-daily/api";
import { isEntryDateString } from "@/features/interview/entry-date";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { getJournalDailyView } from "@/server/services/journal-daily/journal-daily.service";

export async function GET(request: Request) {
  const requestId = createJournalDailyRequestId();
  const entryDate = new URL(request.url).searchParams.get("date")?.trim() ?? "";

  if (!isEntryDateString(entryDate)) {
    const issue = buildInvalidJournalDailyIssue(requestId);
    return NextResponse.json(
      {
        error: issue.code,
        message: issue.message,
        issue
      },
      { status: 400 }
    );
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    return NextResponse.json(await getJournalDailyView(user.id, entryDate));
  } catch (error) {
    return journalDailyErrorResponse(error, requestId);
  }
}
