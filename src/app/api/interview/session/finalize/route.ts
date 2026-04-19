import { NextResponse } from "next/server";

import {
  finalizeInterviewRequestSchema,
  finalizeInterviewResponseSchema
} from "@/features/joy-interview/schema/joy-interview.schema";
import { finalizeJoyInterview } from "@/server/services/interview/joy-interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = finalizeInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_FINALIZE_REQUEST" }, { status: 400 });
  }

  try {
    const result = await finalizeJoyInterview(parsed.data.sessionId);
    const payload = finalizeInterviewResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: "INTERVIEW_FINALIZE_FAILED" }, { status: 500 });
  }
}
