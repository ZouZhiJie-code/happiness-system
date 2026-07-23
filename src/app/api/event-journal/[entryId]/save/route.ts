import { NextResponse } from "next/server";

import {
  eventJournalEntryViewSchema,
  saveEventJournalEntryRequestSchema
} from "@/features/journal-event/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { createInterviewRequestId } from "@/server/services/interview/respond-error";
import { saveEventJournalEntry } from "@/server/services/journal-event/event-journal.service";

import { eventJournalErrorResponse } from "../../_response";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const requestId = createInterviewRequestId();
  try {
    const user = await requireCurrentUserFromRequest(request);
    const parsed = saveEventJournalEntryRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) throw new Error("INVALID_EVENT_JOURNAL_REQUEST");
    const { entryId } = await context.params;
    const view = await saveEventJournalEntry({
      userId: user.id,
      entryId,
      ...parsed.data
    });
    return NextResponse.json(eventJournalEntryViewSchema.parse(view));
  } catch (error) {
    return eventJournalErrorResponse(error, requestId);
  }
}

