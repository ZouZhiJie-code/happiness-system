import { NextResponse } from "next/server";

import {
  createJournalDailyRequestId,
  journalDailyErrorResponse,
  parseJournalDailyRequest
} from "@/features/journal-daily/api";
import { updateJournalDailyEntryRequestSchema } from "@/features/journal-daily/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { updateJournalDailyEntryForUser } from "@/server/services/journal-daily/journal-daily.service";

export async function PUT(
  request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const requestId = createJournalDailyRequestId();
  const parsed = await parseJournalDailyRequest(
    request,
    updateJournalDailyEntryRequestSchema,
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
    const entry = await updateJournalDailyEntryForUser({
      userId: user.id,
      entryId,
      ...parsed.data
    });
    return NextResponse.json({ entry });
  } catch (error) {
    return journalDailyErrorResponse(error, requestId);
  }
}
