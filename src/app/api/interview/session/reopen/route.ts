import { NextResponse } from "next/server";

import {
  reopenInterviewRequestSchema,
  reopenInterviewResponseSchema
} from "@/features/joy-interview/schema/joy-interview.schema";
import { reopenJoyInterviewSession } from "@/server/services/interview/joy-interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = reopenInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REOPEN_REQUEST" }, { status: 400 });
  }

  try {
    const result = await reopenJoyInterviewSession(parsed.data.sessionId);
    const payload = reopenInterviewResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (error instanceof Error && error.message === "SESSION_NOT_REOPENABLE") {
      return NextResponse.json({ error: "SESSION_NOT_REOPENABLE" }, { status: 409 });
    }

    return NextResponse.json({ error: "SESSION_REOPEN_FAILED" }, { status: 500 });
  }
}
