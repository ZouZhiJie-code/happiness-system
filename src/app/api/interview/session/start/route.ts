import { NextResponse } from "next/server";

import {
  startInterviewRequestSchema,
  startInterviewResponseSchema
} from "@/features/joy-interview/schema/joy-interview.schema";
import { startJoyInterview } from "@/server/services/interview/joy-interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = startInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_START_REQUEST" }, { status: 400 });
  }

  const result = await startJoyInterview(parsed.data.dimension);
  const payload = startInterviewResponseSchema.parse(result);

  return NextResponse.json(payload);
}
