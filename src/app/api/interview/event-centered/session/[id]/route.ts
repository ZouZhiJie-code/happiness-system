import { NextResponse } from "next/server";

import { eventCenteredWorkspaceSessionSchema } from "@/features/interview/schema/event-centered-interview.schema";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { getEventCenteredInterviewWorkspace } from "@/server/services/interview/event-centered-interview.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const { id } = await context.params;
    const session = await getEventCenteredInterviewWorkspace(user.id, id);
    if (!session) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(eventCenteredWorkspaceSessionSchema.parse(session));
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    console.error("EVENT_CENTERED_SESSION_READ_FAILED", error);
    return NextResponse.json({ error: "EVENT_CENTERED_SESSION_READ_FAILED" }, { status: 500 });
  }
}
