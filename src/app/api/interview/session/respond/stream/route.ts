import { NextResponse } from "next/server";

import { INTERVIEW_REPLY_MAX_LENGTH } from "@/features/interview/interview-issue";
import { interviewSessionSchema, respondInterviewRequestSchema } from "@/features/interview/schema/interview.schema";
import {
  createInterviewRequestId,
  logInterviewRespondError,
  normalizeInterviewRespondError
} from "@/server/services/interview/respond-error";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { streamInterviewResponse } from "@/server/services/interview/interview.service";

export const dynamic = "force-dynamic";

function formatSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

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
      route: "respond/stream"
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
      route: "respond/stream",
      sessionId:
        body && typeof body === "object" && "sessionId" in body && typeof body.sessionId === "string"
          ? body.sessionId
          : null
    });

    return NextResponse.json({ error: issue.code, message: issue.message, issue }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(formatSseEvent(event, data)));
        };

        try {
          const result = await streamInterviewResponse(
            {
              ...parsed.data,
              userId: user.id
            },
            {
              onPhase: (phase) => send("phase", { state: phase }),
              onDelta: (delta) => send("delta", delta)
            }
          );

          send("session", {
            session: interviewSessionSchema.parse(result.session)
          });
        } catch (error) {
          const issue = normalizeInterviewRespondError({
            error,
            requestId
          });

          logInterviewRespondError({
            error,
            issue,
            route: "respond/stream",
            sessionId: parsed.data.sessionId
          });

          send("error", {
            code: issue.code,
            message: issue.message,
            issue
          });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    const issue = normalizeInterviewRespondError({
      error,
      requestId
    });

    logInterviewRespondError({
      error,
      issue,
      route: "respond/stream",
      sessionId: parsed.data.sessionId
    });

    return NextResponse.json(
      { error: issue.code, message: issue.message, issue },
      { status: issue.code === "AUTHENTICATION_REQUIRED" ? 401 : 500 }
    );
  }
}
