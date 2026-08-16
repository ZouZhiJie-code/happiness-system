import { NextResponse } from "next/server";

import {
  createEventCenteredRouteRequestId,
  eventCenteredIssueResponse
} from "@/app/api/interview/event-centered/issue-response";
import { eventCenteredWorkspaceSessionSchema } from "@/features/interview/schema/event-centered-interview.schema";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { getEventCenteredInterviewWorkspace } from "@/server/services/interview/event-centered-interview.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = createEventCenteredRouteRequestId();
  try {
    const user = await requireCurrentUserFromRequest(request);
    const { id } = await context.params;
    const session = await getEventCenteredInterviewWorkspace(user.id, id);
    if (!session) {
      return eventCenteredIssueResponse({
        requestId,
        status: 404,
        issue: {
          code: "SESSION_NOT_FOUND",
          title: "这条记录已经结束",
          message: "当前链接对应的记录无法继续打开。",
          resolution: "请从左侧记录列表选择仍然存在的记录。",
          retryable: false,
          action: "refresh"
        }
      });
    }
    return NextResponse.json(eventCenteredWorkspaceSessionSchema.parse(session));
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return eventCenteredIssueResponse({
        requestId,
        status: 401,
        issue: {
          code: "AUTHENTICATION_REQUIRED",
          title: "请先登录",
          message: "当前登录状态已经失效。",
          resolution: "重新登录后可以继续查看记录。",
          retryable: false,
          action: "login"
        }
      });
    }
    console.error("EVENT_CENTERED_SESSION_READ_FAILED", error);
    return eventCenteredIssueResponse({
      requestId,
      status: 500,
      issue: {
        code: "EVENT_CENTERED_SESSION_READ_FAILED",
        title: "暂时无法打开记录",
        message: "这条记录的最新内容还没有读取完成。",
        resolution: "请刷新到最新记录后继续。",
        retryable: true,
        action: "refresh"
      }
    });
  }
}
