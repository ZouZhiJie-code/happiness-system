import { NextResponse } from "next/server";

import {
  eventCenteredWorkspaceSessionSchema,
  startEventCenteredSessionRequestSchema
} from "@/features/interview/schema/event-centered-interview.schema";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import {
  getEventCenteredInterviewWorkspace,
  startEventCenteredInterview
} from "@/server/services/interview/event-centered-interview.service";

export async function POST(request: Request) {
  const parsed = startEventCenteredSessionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_START_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const session = await startEventCenteredInterview(
      user.id,
      parsed.data.entryDate,
      parsed.data.recordMode
    );
    const workspace = await getEventCenteredInterviewWorkspace(user.id, session.rootSessionId);
    if (!workspace) throw new Error("SESSION_CREATE_FAILED");
    return NextResponse.json(eventCenteredWorkspaceSessionSchema.parse(workspace));
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    const code = error instanceof Error ? error.message : "EVENT_CENTERED_SESSION_START_FAILED";
    if (
      code === "JOURNAL_DAY_MODE_CONFLICT" ||
      code === "JOURNAL_DAY_MODE_MIXED" ||
      code === "EVENT_CENTERED_ENTRY_DISABLED" ||
      code === "EVENT_CENTERED_FUTURE_DATE"
    ) {
      return NextResponse.json({ error: code }, { status: 409 });
    }
    console.error("EVENT_CENTERED_SESSION_START_FAILED", error);
    return NextResponse.json({ error: "EVENT_CENTERED_SESSION_START_FAILED" }, { status: 500 });
  }
}
