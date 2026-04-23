import { NextResponse } from "next/server";

import { respondInterviewRequestSchema } from "@/features/joy-interview/schema/joy-interview.schema";
import { interviewSessionSchema } from "@/features/joy-interview/schema/joy-interview.schema";
import { streamJoyInterviewResponse } from "@/server/services/interview/joy-interview.service";

export const dynamic = "force-dynamic";

function formatSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = respondInterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_RESPOND_REQUEST" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(formatSseEvent(event, data)));
      };

      try {
        const result = await streamJoyInterviewResponse(
          parsed.data,
          {
            onPhase: (phase) => send("phase", { state: phase }),
            onDelta: (delta) => send("delta", delta)
          }
        );

        send("session", {
          session: interviewSessionSchema.parse(result.session)
        });
      } catch (error) {
        if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
          send("error", {
            code: "SESSION_NOT_FOUND",
            message: "未找到当前访谈会话。"
          });
        } else if (
          error instanceof Error &&
          (error.message === "SESSION_CONTINUE_UNAVAILABLE" || error.message === "SESSION_NEXT_EVENT_UNAVAILABLE")
        ) {
          send("error", {
            code: "SESSION_CONTINUE_UNAVAILABLE",
            message: "当前会话没有可执行的分叉选择。"
          });
        } else {
          send("error", {
            code: "INTERVIEW_RESPOND_FAILED",
            message: "这一轮提交失败了，请再试一次。"
          });
        }
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
}
