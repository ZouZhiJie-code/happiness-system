import { NextResponse } from "next/server";

import {
  reopenInterviewRequestSchema,
  reopenInterviewResponseSchema
} from "@/features/interview/schema/interview.schema";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { reopenInterviewSession } from "@/server/services/interview/interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = reopenInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REOPEN_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await reopenInterviewSession(user.id, parsed.data.sessionId);
    const payload = reopenInterviewResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (error instanceof Error && error.message === "SESSION_NOT_REOPENABLE") {
      return NextResponse.json({ error: "SESSION_NOT_REOPENABLE" }, { status: 409 });
    }

    return NextResponse.json({ error: "SESSION_REOPEN_FAILED" }, { status: 500 });
  }
}
