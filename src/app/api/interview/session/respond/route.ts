import { NextResponse } from "next/server";

import {
  respondInterviewRequestSchema,
  respondInterviewResponseSchema
} from "@/features/interview/schema/interview.schema";
import { respondToInterview } from "@/server/services/interview/interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = respondInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_RESPOND_REQUEST" }, { status: 400 });
  }

  try {
    const result = await respondToInterview(parsed.data);
    const payload = respondInterviewResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (
      error instanceof Error &&
      (error.message === "SESSION_CONTINUE_UNAVAILABLE" || error.message === "SESSION_NEXT_EVENT_UNAVAILABLE")
    ) {
      return NextResponse.json({ error: "SESSION_CONTINUE_UNAVAILABLE" }, { status: 409 });
    }

    return NextResponse.json({ error: "INTERVIEW_RESPOND_FAILED" }, { status: 500 });
  }
}
