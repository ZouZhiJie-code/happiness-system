import { NextResponse } from "next/server";

import {
  createJournalDailyRequestId,
  journalDailyErrorResponse,
  parseJournalDailyRequest
} from "@/features/journal-daily/api";
import { generateJournalDailyEntryRequestSchema } from "@/features/journal-daily/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { generateJournalDailyEntry } from "@/server/services/journal-daily/journal-daily.service";

export async function POST(request: Request) {
  const requestId = createJournalDailyRequestId();
  const parsed = await parseJournalDailyRequest(
    request,
    generateJournalDailyEntryRequestSchema,
    requestId
  );
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await generateJournalDailyEntry({
      userId: user.id,
      ...parsed.data,
      requestId
    });
    return NextResponse.json(result, {
      status: result.status === "processing" ? 202 : 200
    });
  } catch (error) {
    return journalDailyErrorResponse(error, requestId);
  }
}
