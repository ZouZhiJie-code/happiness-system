import { NextResponse } from "next/server";

import { interviewSessionSchema } from "@/features/interview/schema/interview.schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { getInterviewSession } from "@/server/services/interview/interview.service";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await requireCurrentUserFromRequest(_);
  const session = await getInterviewSession(user.id, id);

  if (!session) {
    return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(interviewSessionSchema.parse(session));
}
