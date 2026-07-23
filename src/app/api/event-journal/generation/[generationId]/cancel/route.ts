import { NextResponse } from "next/server";

import { cancelEventJournalGenerationRequestSchema } from "@/features/journal-event/schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { createInterviewRequestId } from "@/server/services/interview/respond-error";
import { cancelEventJournalGeneration } from "@/server/services/journal-event/event-journal.service";

import { eventJournalErrorResponse } from "../../../_response";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ generationId: string }> }
) {
  const requestId = createInterviewRequestId();
  try {
    const user = await requireCurrentUserFromRequest(request);
    const parsed = cancelEventJournalGenerationRequestSchema.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) throw new Error("INVALID_EVENT_JOURNAL_REQUEST");
    const { generationId } = await context.params;
    const result = await cancelEventJournalGeneration({
      userId: user.id,
      generationId
    });
    return NextResponse.json(result);
  } catch (error) {
    return eventJournalErrorResponse(error, requestId);
  }
}
