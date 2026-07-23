import { NextResponse } from "next/server";

import {
  eventJournalEntryViewSchema,
  updateEventJournalEntryRequestSchema
} from "@/features/journal-event/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { createInterviewRequestId } from "@/server/services/interview/respond-error";
import {
  getEventJournalEntryView,
  updateEventJournalEntry
} from "@/server/services/journal-event/event-journal.service";

import { eventJournalErrorResponse } from "../_response";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const requestId = createInterviewRequestId();
  try {
    const user = await requireCurrentUserFromRequest(request);
    const { entryId } = await context.params;
    const view = await getEventJournalEntryView({ userId: user.id, entryId });
    return NextResponse.json(eventJournalEntryViewSchema.parse(view));
  } catch (error) {
    return eventJournalErrorResponse(error, requestId);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const requestId = createInterviewRequestId();
  try {
    const user = await requireCurrentUserFromRequest(request);
    const parsed = updateEventJournalEntryRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) throw new Error("INVALID_EVENT_JOURNAL_REQUEST");
    const { entryId } = await context.params;
    const view = await updateEventJournalEntry({
      userId: user.id,
      entryId,
      ...parsed.data
    });
    return NextResponse.json(eventJournalEntryViewSchema.parse(view));
  } catch (error) {
    return eventJournalErrorResponse(error, requestId);
  }
}

