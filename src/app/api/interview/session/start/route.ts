import { NextResponse } from "next/server";

import {
  startInterviewRequestSchema,
  startInterviewResponseSchema
} from "@/features/interview/schema/interview.schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { startInterview } from "@/server/services/interview/interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = startInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_START_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await startInterview(user.id, parsed.data.dimension, parsed.data.entryDate);
    const payload = startInterviewResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("INTERVIEW_START_FAILED", error);

    return NextResponse.json(
      {
        error: "INTERVIEW_START_FAILED"
      },
      { status: 500 }
    );
  }
}
