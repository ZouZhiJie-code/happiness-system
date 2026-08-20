import { NextResponse } from "next/server";

import {
  createEventCenteredRouteRequestId,
  eventCenteredIssueResponse,
  type EventCenteredRouteIssue
} from "@/app/api/interview/event-centered/issue-response";
import {
  eventCenteredWorkspaceSessionSchema,
  startEventCenteredSessionRequestSchema
} from "@/features/interview/schema/event-centered-interview.schema";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import {
  getEventCenteredInterviewWorkspace,
  startEventCenteredInterview
} from "@/server/services/interview/event-centered-interview.service";
import { EventCenteredUnfinishedLimitReachedError } from "@/server/repositories/event-centered-interview.repository";

export async function POST(request: Request) {
  const requestId = createEventCenteredRouteRequestId();
  const parsed = startEventCenteredSessionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return eventCenteredIssueResponse({
      requestId,
      status: 400,
      issue: {
        code: "INVALID_START_REQUEST",
        title: "无法开始记录",
        message: "记录日期或方式不完整。",
        resolution: "请重新选择记录方式后再试。",
        retryable: false,
        action: "review_input"
      }
    });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const session = await startEventCenteredInterview(
      user.id,
      parsed.data.entryDate,
      parsed.data.recordMode,
      parsed.data.clientOperationId
    );
    const workspace = await getEventCenteredInterviewWorkspace(user.id, session.rootSessionId);
    if (!workspace) throw new Error("SESSION_CREATE_FAILED");
    return NextResponse.json(eventCenteredWorkspaceSessionSchema.parse(workspace));
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return eventCenteredIssueResponse({
        requestId,
        status: 401,
        issue: {
          code: "AUTHENTICATION_REQUIRED",
          title: "请先登录",
          message: "当前登录状态已经失效。",
          resolution: "重新登录后可以继续创建记录。",
          retryable: false,
          action: "login"
        }
      });
    }
    if (error instanceof EventCenteredUnfinishedLimitReachedError) {
      const message = "最多可以同时保留两条未完成记录，请先完成其中一条。";
      return eventCenteredIssueResponse({
        requestId,
        status: 409,
        details: {
          unfinishedCount: error.unfinishedCount,
          unfinishedLimit: error.unfinishedLimit
        },
        issue: {
          code: error.code,
          title: "先完成一条记录",
          message,
          resolution: "请从左侧打开一条未完成记录并完成它。",
          retryable: false,
          action: "complete_existing"
        }
      });
    }
    const code = error instanceof Error ? error.message : "EVENT_CENTERED_SESSION_START_FAILED";
    const conflictIssues: Partial<Record<string, EventCenteredRouteIssue>> = {
      JOURNAL_DAY_MODE_CONFLICT: {
        code,
        title: "这一天沿用原记录方式",
        message: "这一天已经有旧版记录。",
        resolution: "请从当天日记查看已有内容。",
        retryable: false,
        action: "open_journal"
      },
      JOURNAL_DAY_MODE_MIXED: {
        code,
        title: "这一天保留了两类历史记录",
        message: "系统会分别展示已有内容，避免记录混在一起。",
        resolution: "请从当天日记查看已有内容。",
        retryable: false,
        action: "open_journal"
      },
      EVENT_CENTERED_ENTRY_DISABLED: {
        code,
        title: "新记录暂未开放",
        message: "当前环境还没有开启新的访谈入口。",
        resolution: "请稍后再试。",
        retryable: true,
        action: "refresh"
      },
      EVENT_CENTERED_FUTURE_DATE: {
        code,
        title: "还不能记录未来日期",
        message: "请选择今天或过去的日期。",
        resolution: "回到今天后可以开始记录。",
        retryable: false,
        action: "open_today"
      }
    };
    const conflictIssue = conflictIssues[code];
    if (conflictIssue) {
      return eventCenteredIssueResponse({ issue: conflictIssue, requestId, status: 409 });
    }
    console.error("EVENT_CENTERED_SESSION_START_FAILED", error);
    return eventCenteredIssueResponse({
      requestId,
      status: 500,
      issue: {
        code: "EVENT_CENTERED_SESSION_START_FAILED",
        title: "暂时无法开始记录",
        message: "这次创建没有完成。",
        resolution: "请稍后再试；已有记录不会受到影响。",
        retryable: true,
        action: "refresh"
      }
    });
  }
}
