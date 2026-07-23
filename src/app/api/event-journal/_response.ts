import { NextResponse } from "next/server";

import {
  eventJournalIssueHttpStatus,
  normalizeEventJournalIssue
} from "@/features/journal-event/issue";

export function eventJournalErrorResponse(error: unknown, requestId: string) {
  const issue = normalizeEventJournalIssue(error, requestId);
  return NextResponse.json(
    {
      error: issue.code,
      message: issue.message,
      issue
    },
    { status: eventJournalIssueHttpStatus(issue) }
  );
}

