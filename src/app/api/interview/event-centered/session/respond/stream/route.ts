import { NextResponse } from "next/server";

import {
  eventCenteredRespondRequestSchema,
  eventCenteredTurnConfirmationSchema,
  eventCenteredWorkspaceSessionSchema
} from "@/features/interview/schema/event-centered-interview.schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import {
  createInterviewRequestId,
  logInterviewRespondError,
  normalizeInterviewRespondError
} from "@/server/services/interview/respond-error";
import { respondEventCenteredInterview } from "@/server/services/interview/event-centered-interview.service";

export const dynamic = "force-dynamic";

function formatSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const requestId = createInterviewRequestId();
  const parsed = eventCenteredRespondRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    const issue = normalizeInterviewRespondError({
      error: new Error("INVALID_RESPOND_REQUEST"),
      requestId
    });
    return NextResponse.json(
      { error: issue.code, message: issue.message, issue },
      { status: 400 }
    );
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const encoder = new TextEncoder();
    const streamAbortController = new AbortController();
    const abortFromRequest = () => streamAbortController.abort(request.signal.reason);
    if (request.signal.aborted) abortFromRequest();
    else request.signal.addEventListener("abort", abortFromRequest, { once: true });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        let acceptedTurnId: string | null = null;
        const send = (event: string, data: unknown) => {
          if (closed || streamAbortController.signal.aborted) return;
          controller.enqueue(encoder.encode(formatSseEvent(event, data)));
        };
        try {
          const result = await respondEventCenteredInterview(user.id, parsed.data, {
            requestId,
            signal: streamAbortController.signal,
            onPhase: (phase) => send("phase", { state: phase }),
            onDelta: (target, value) => send("delta", { target, value }),
            onTurn: (turn) => {
              acceptedTurnId = turn.turn.id;
              send("turn", eventCenteredTurnConfirmationSchema.parse(turn));
            }
          });
          send("session", {
            session: eventCenteredWorkspaceSessionSchema.parse(result.workspace)
          });
        } catch (error) {
          if (!streamAbortController.signal.aborted) {
            const issue = normalizeInterviewRespondError({ error, requestId });
            logInterviewRespondError({
              error,
              issue,
              route: "respond/stream",
              sessionId: parsed.data.rootSessionId
            });
            send("error", {
              code: issue.code,
              message: issue.message,
              issue,
              clientTurnId: parsed.data.clientTurnId,
              turnId: acceptedTurnId,
              status: acceptedTurnId ? "failed" : null
            });
          }
        } finally {
          request.signal.removeEventListener("abort", abortFromRequest);
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      },
      cancel() {
        streamAbortController.abort();
        request.signal.removeEventListener("abort", abortFromRequest);
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
    const issue = normalizeInterviewRespondError({ error, requestId });
    logInterviewRespondError({
      error,
      issue,
      route: "respond/stream",
      sessionId: parsed.data.rootSessionId
    });
    return NextResponse.json(
      { error: issue.code, message: issue.message, issue },
      { status: issue.code === "AUTHENTICATION_REQUIRED" ? 401 : 500 }
    );
  }
}
