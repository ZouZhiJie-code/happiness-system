import { NextResponse } from "next/server";

import { INTERVIEW_REPLY_MAX_LENGTH } from "@/features/interview/interview-issue";
import {
  respondInterviewRequestSchema,
  respondInterviewResponseSchema
} from "@/features/interview/schema/interview.schema";
import {
  createInterviewRequestId,
  logInterviewRespondError,
  normalizeInterviewRespondError
} from "@/server/services/interview/respond-error";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { respondToInterview } from "@/server/services/interview/interview.service";

export async function POST(request: Request) {
  const requestId = createInterviewRequestId();
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    const issue = normalizeInterviewRespondError({
      error: new Error("INVALID_JSON"),
      requestId
    });

    logInterviewRespondError({
      error,
      issue,
      route: "respond"
    });

    return NextResponse.json({ error: issue.code, message: issue.message, issue }, { status: 400 });
  }

  const parsed = respondInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    const isMessageTooLong =
      body &&
      typeof body === "object" &&
      "userMessage" in body &&
      typeof body.userMessage === "string" &&
      body.userMessage.length > INTERVIEW_REPLY_MAX_LENGTH;
    const issue = normalizeInterviewRespondError({
      error: new Error(isMessageTooLong ? "MESSAGE_TOO_LONG" : "INVALID_RESPOND_REQUEST"),
      requestId
    });

    logInterviewRespondError({
      error: parsed.error,
      issue,
      route: "respond",
      sessionId:
        body && typeof body === "object" && "sessionId" in body && typeof body.sessionId === "string"
          ? body.sessionId
          : null
    });

    return NextResponse.json({ error: issue.code, message: issue.message, issue }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await respondToInterview({
      ...parsed.data,
      userId: user.id,
      requestId
    });
    const payload = respondInterviewResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    const issue = normalizeInterviewRespondError({
      error,
      requestId
    });
    const status =
      issue.code === "AUTHENTICATION_REQUIRED"
        ? 401
        : issue.code === "SESSION_NOT_FOUND"
        ? 404
        : issue.code === "SESSION_CHOICE_UNAVAILABLE"
          ? 409
          : 500;

    logInterviewRespondError({
      error,
      issue,
      route: "respond",
      sessionId: parsed.data.sessionId
    });

    return NextResponse.json({ error: issue.code, message: issue.message, issue }, { status });
  }
}
