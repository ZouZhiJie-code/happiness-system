import { NextResponse } from "next/server";

import {
  createEventCenteredRouteRequestId,
  eventCenteredIssueResponse
} from "@/app/api/interview/event-centered/issue-response";
import { parseEntryDateInput } from "@/features/interview/entry-date";
import {
  listEventCenteredSessions,
  listEventCenteredSessionTabsByDate
} from "@/server/repositories/event-centered-interview.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = createEventCenteredRouteRequestId();
  try {
    const user = await requireCurrentUserFromRequest(request);
    const searchParams = new URL(request.url).searchParams;
    const entryDate = searchParams.get("entryDate")?.trim();
    if (entryDate) {
      try {
        parseEntryDateInput(entryDate);
      } catch {
        return eventCenteredIssueResponse({
          requestId,
          status: 400,
          issue: {
            code: "INVALID_ENTRY_DATE",
            title: "日期格式不正确",
            message: "记录日期无法识别。",
            resolution: "请回到日记页重新选择日期。",
            retryable: false,
            action: "open_journal"
          }
        });
      }
      return NextResponse.json(await listEventCenteredSessionTabsByDate(user.id, entryDate));
    }
    const limitValue = Number(searchParams.get("limit") ?? "30");
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 50) {
      return eventCenteredIssueResponse({
        requestId,
        status: 400,
        issue: {
          code: "INVALID_SESSION_LIMIT",
          title: "记录列表请求不完整",
          message: "这次读取的数量范围无法识别。",
          resolution: "请刷新页面后再试。",
          retryable: true,
          action: "refresh"
        }
      });
    }
    try {
      return NextResponse.json(await listEventCenteredSessions({
        userId: user.id,
        limit: limitValue,
        cursor: searchParams.get("cursor")
      }));
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_SESSION_CURSOR") {
        return eventCenteredIssueResponse({
          requestId,
          status: 400,
          issue: {
            code: "INVALID_SESSION_CURSOR",
            title: "记录列表已经更新",
            message: "当前翻页位置已经失效。",
            resolution: "请刷新后从最新记录开始查看。",
            retryable: true,
            action: "refresh"
          }
        });
      }
      throw error;
    }
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
    console.error("EVENT_CENTERED_SESSION_TABS_READ_FAILED", error);
    return eventCenteredIssueResponse({
      requestId,
      status: 500,
      issue: {
        code: "EVENT_CENTERED_SESSION_TABS_READ_FAILED",
        title: "记录列表暂时无法读取",
        message: "你的记录仍然保留。",
        resolution: "请刷新页面后再试。",
        retryable: true,
        action: "refresh"
      }
    });
  }
}
