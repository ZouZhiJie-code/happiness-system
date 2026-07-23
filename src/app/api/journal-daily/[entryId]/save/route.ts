import { NextResponse } from "next/server";

import {
  createJournalDailyRequestId,
  journalDailyErrorResponse,
  parseJournalDailyRequest
} from "@/features/journal-daily/api";
import { saveJournalDailyEntryRequestSchema } from "@/features/journal-daily/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { saveJournalDailyEntryForUser } from "@/server/services/journal-daily/journal-daily.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const requestId = createJournalDailyRequestId();
  const parsed = await parseJournalDailyRequest(
    request,
    saveJournalDailyEntryRequestSchema,
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
    const entry = await saveJournalDailyEntryForUser({
      userId: user.id,
      entryId,
      ...parsed.data
    });
    return NextResponse.json({ entry });
  } catch (error) {
    return journalDailyErrorResponse(error, requestId);
  }
}
