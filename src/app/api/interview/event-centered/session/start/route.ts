import { NextResponse } from "next/server";

import {
  eventCenteredSessionIdentitySchema,
  startEventCenteredSessionRequestSchema
} from "@/features/interview/schema/event-centered-interview.schema";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { startEventCenteredInterview } from "@/server/services/interview/event-centered-interview.service";

export async function POST(request: Request) {
  const parsed = startEventCenteredSessionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_START_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const session = await startEventCenteredInterview(user.id, parsed.data.entryDate);
    return NextResponse.json(eventCenteredSessionIdentitySchema.parse(session));
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    console.error("EVENT_CENTERED_SESSION_START_FAILED", error);
    return NextResponse.json({ error: "EVENT_CENTERED_SESSION_START_FAILED" }, { status: 500 });
  }
}
