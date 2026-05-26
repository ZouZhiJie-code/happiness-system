import { NextResponse } from "next/server";

import {
  saveDraftRequestSchema,
  saveDraftResponseSchema
} from "@/features/interview/schema/interview.schema";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { saveGeneratedJournalEntry } from "@/server/services/interview/interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = saveDraftRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_SAVE_DRAFT_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await saveGeneratedJournalEntry(user.id, parsed.data.sessionId);
    const payload = saveDraftResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "DRAFT_NOT_FOUND") {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: "DRAFT_SAVE_FAILED" }, { status: 500 });
  }
}
