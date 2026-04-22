import { NextResponse } from "next/server";

import {
  saveDraftRequestSchema,
  saveDraftResponseSchema
} from "@/features/joy-interview/schema/joy-interview.schema";
import { saveGeneratedJoyEntry } from "@/server/services/interview/joy-interview.service";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = saveDraftRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_SAVE_DRAFT_REQUEST" }, { status: 400 });
  }

  try {
    const result = await saveGeneratedJoyEntry(parsed.data.sessionId);
    const payload = saveDraftResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "DRAFT_NOT_FOUND") {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: "DRAFT_SAVE_FAILED" }, { status: 500 });
  }
}
