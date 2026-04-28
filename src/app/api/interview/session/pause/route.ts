import { NextResponse } from "next/server";

import {
  pauseInterviewRequestSchema,
  pauseInterviewResponseSchema
} from "@/features/interview/schema/interview.schema";
import { pauseInterviewSession } from "@/server/services/interview/interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = pauseInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PAUSE_REQUEST" }, { status: 400 });
  }

  try {
    const result = await pauseInterviewSession(parsed.data.sessionId);
    const payload = pauseInterviewResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (error instanceof Error && error.message === "SESSION_ALREADY_COMPLETED") {
      return NextResponse.json({ error: "SESSION_ALREADY_COMPLETED" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "SESSION_NOT_PAUSABLE") {
      return NextResponse.json({ error: "SESSION_NOT_PAUSABLE" }, { status: 409 });
    }

    return NextResponse.json({ error: "SESSION_PAUSE_FAILED" }, { status: 500 });
  }
}
