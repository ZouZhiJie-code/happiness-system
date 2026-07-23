import { NextResponse } from "next/server";

import {
  createJournalDailyRequestId,
  journalDailyErrorResponse,
  parseJournalDailyRequest
} from "@/features/journal-daily/api";
import { cancelJournalDailyEntryGenerationRequestSchema } from "@/features/journal-daily/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { cancelJournalDailyGenerationForUser } from "@/server/services/journal-daily/journal-daily.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ generationId: string }> }
) {
  const requestId = createJournalDailyRequestId();
  const parsed = await parseJournalDailyRequest(
    request,
    cancelJournalDailyEntryGenerationRequestSchema,
    requestId
  );
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const [{ generationId }, user] = await Promise.all([
      context.params,
      requireCurrentUserFromRequest(request)
    ]);
    const generation = await cancelJournalDailyGenerationForUser({
      userId: user.id,
      generationId
    });
    return NextResponse.json({ generation });
  } catch (error) {
    return journalDailyErrorResponse(error, requestId);
  }
}
