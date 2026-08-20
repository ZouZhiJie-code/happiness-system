import { NextResponse } from "next/server";

import {
  eventCenteredTurnConfirmationSchema,
  reserveEventCenteredTurnRequestSchema
} from "@/features/interview/schema/event-centered-interview.schema";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { acceptEventCenteredUserTurn } from "@/server/services/interview/event-centered-interview.service";
import {
  createInterviewRequestId,
  normalizeInterviewRespondError
} from "@/server/services/interview/respond-error";

function issueStatus(code: string) {
  if (code === "AUTHENTICATION_REQUIRED") return 401;
  if (code === "SESSION_NOT_FOUND") return 404;
  if (
    code === "INTERVIEW_TURN_OUT_OF_DATE" ||
    code === "JOURNAL_DAY_MODE_CONFLICT" ||
    code === "JOURNAL_DAY_MODE_MIXED" ||
    code === "EVENT_CENTERED_ENTRY_DISABLED"
  ) return 409;
  return 500;
}

function issueResponse(error: unknown, requestId: string, status?: number) {
  const errorCode = error instanceof Error ? error.message : null;
  const normalized = normalizeInterviewRespondError({
    error,
    requestId,
    fallbackCode: "INTERVIEW_RESPOND_FAILED"
  });
  const issue = errorCode === "INVALID_EVENT_TURN_REQUEST"
    ? {
        ...normalized,
        code: errorCode,
        title: "这条回复暂时无法提交",
        message: "本次回复缺少必要信息或格式不完整。",
        resolution: "请刷新页面后重新发送。",
        retryable: true,
        action: "refresh" as const
      }
    : errorCode === "EVENT_CENTERED_ENTRY_DISABLED"
      ? {
          ...normalized,
          code: errorCode,
          title: "新记录暂未开放",
          message: "当前环境还没有开启新的访谈入口。",
          resolution: "请稍后刷新页面再试。",
          retryable: true,
          action: "refresh" as const
        }
      : normalized;
  return NextResponse.json(
    { error: issue.code, message: issue.message, issue },
    { status: status ?? issueStatus(issue.code) }
  );
}

export async function POST(request: Request) {
  const requestId = createInterviewRequestId();
  const parsed = reserveEventCenteredTurnRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return issueResponse(new Error("INVALID_EVENT_TURN_REQUEST"), requestId, 400);
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await acceptEventCenteredUserTurn({ userId: user.id, ...parsed.data });
    return NextResponse.json(eventCenteredTurnConfirmationSchema.parse(result));
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return issueResponse(new Error("AUTHENTICATION_REQUIRED"), requestId, 401);
    }
    const code = error instanceof Error ? error.message : "EVENT_TURN_FAILED";
    const known = new Set([
      "SESSION_NOT_FOUND",
      "EVENT_STATE_CHANGED",
      "JOURNAL_DAY_MODE_CONFLICT",
      "JOURNAL_DAY_MODE_MIXED",
      "EVENT_CENTERED_ENTRY_DISABLED"
    ]);
    if (!known.has(code)) console.error("EVENT_CENTERED_TURN_FAILED", error);
    return issueResponse(error, requestId);
  }
}
