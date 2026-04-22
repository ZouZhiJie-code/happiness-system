import { NextResponse } from "next/server";

import {
  completeInterviewRequestSchema,
  completeInterviewResponseSchema
} from "@/features/joy-interview/schema/joy-interview.schema";
import { completeJoyInterviewSession } from "@/server/services/interview/joy-interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = completeInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_COMPLETE_REQUEST" }, { status: 400 });
  }

  try {
    const result = await completeJoyInterviewSession(parsed.data.sessionId);
    const payload = completeInterviewResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (error instanceof Error && error.message === "SESSION_NOT_COMPLETABLE") {
      return NextResponse.json({ error: "SESSION_NOT_COMPLETABLE" }, { status: 409 });
    }

    return NextResponse.json({ error: "SESSION_COMPLETE_FAILED" }, { status: 500 });
  }
}
