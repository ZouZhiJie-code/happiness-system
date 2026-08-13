import { NextResponse } from "next/server";

import {
  eventCenteredTurnConfirmationSchema,
  reserveEventCenteredTurnRequestSchema
} from "@/features/interview/schema/event-centered-interview.schema";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { acceptEventCenteredUserTurn } from "@/server/services/interview/event-centered-interview.service";

export async function POST(request: Request) {
  const parsed = reserveEventCenteredTurnRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_EVENT_TURN_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await acceptEventCenteredUserTurn({ userId: user.id, ...parsed.data });
    return NextResponse.json(eventCenteredTurnConfirmationSchema.parse(result));
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "EVENT_TURN_FAILED";
    if (code === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: code }, { status: 404 });
    }
    if (code === "EVENT_STATE_CHANGED") {
      return NextResponse.json({ error: code }, { status: 409 });
    }
    console.error("EVENT_CENTERED_TURN_FAILED", error);
    return NextResponse.json({ error: "EVENT_TURN_FAILED" }, { status: 500 });
  }
}
