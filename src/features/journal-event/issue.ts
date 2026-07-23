import type { EventOutcomeIssue, EventOutcomeIssueAction } from "@/types/journal-event-entry";

type IssuePreset = Omit<EventOutcomeIssue, "code" | "requestId">;

const presets: Record<string, IssuePreset> = {
  AUTHENTICATION_REQUIRED: {
    title: "登录状态已失效",
    message: "当前登录状态已经失效，日志操作暂时无法完成。",
    resolution: "请重新登录后回到当前事件继续。",
    retryable: false,
    action: "leave"
  },
  INVALID_EVENT_JOURNAL_REQUEST: {
    title: "日志请求格式异常",
    message: "这次日志操作缺少必要信息或内容超出范围。",
    resolution: "请刷新页面后重新操作。",
    retryable: true,
    action: "refresh"
  },
  EVENT_JOURNAL_ENTRY_NOT_FOUND: {
    title: "这篇事件日志无法找到",
    message: "当前链接对应的事件日志已经失效或不属于当前账号。",
    resolution: "请返回今日日志或日历重新打开。",
    retryable: false,
    action: "leave"
  },
  EVENT_GENERATION_NOT_FOUND: {
    title: "本次整理已经失效",
    message: "当前生成任务已经结束或无法恢复。",
    resolution: "请刷新事件页面，按最新状态重新整理。",
    retryable: true,
    action: "refresh"
  },
  EVENT_JOURNAL_ENTRY_VERSION_CONFLICT: {
    title: "日志内容已经更新",
    message: "另一个页面保存了更新版本，当前文字需要先与最新版本对齐。",
    resolution: "页面会保留本地文字；请刷新最新版本后再决定如何处理。",
    retryable: true,
    action: "refresh"
  },
  EVENT_JOURNAL_SOURCE_INSUFFICIENT: {
    title: "当前内容还不足以整理",
    message: "这件事还缺少一条可以写入日志的可信内容。",
    resolution: "请回到事件补充一句，再重新整理。",
    retryable: false,
    action: "complete_entry"
  },
  EVENT_JOURNAL_QUALITY_CHECK_FAILED: {
    title: "这次整理未通过内容检查",
    message: "AI 草稿和基础版本都未达到事实与表达要求。",
    resolution: "原事件已经恢复，可以补充内容后再次整理。",
    retryable: true,
    action: "retry"
  },
  EVENT_GENERATION_SOURCE_CHANGED: {
    title: "事件内容已经更新",
    message: "整理期间事件来源发生了变化，旧结果不会覆盖最新内容。",
    resolution: "请刷新后基于最新事件重新整理。",
    retryable: true,
    action: "refresh"
  },
  EVENT_STATE_CHANGED: {
    title: "事件状态已经更新",
    message: "当前操作对应的是较早的事件状态。",
    resolution: "请刷新页面后按最新状态继续。",
    retryable: true,
    action: "refresh"
  },
  EVENT_CENTERED_ENTRY_DISABLED: {
    title: "事件写入当前已关闭",
    message: "当前环境只保留已有事件的阅读能力。",
    resolution: "请返回已有日志继续阅读。",
    retryable: false,
    action: "leave"
  },
  JOURNAL_DAY_MODE_CONFLICT: {
    title: "当天记录入口已固定",
    message: "这一天已经使用另一种记录方式，当前日志无法继续写入。",
    resolution: "请返回当天已有记录继续查看。",
    retryable: false,
    action: "leave"
  },
  JOURNAL_DAY_MODE_MIXED: {
    title: "当天记录进入只读状态",
    message: "这一天同时存在两种记录来源，系统会保留两边内容供阅读。",
    resolution: "请先查看已有成果，等待数据归属处理完成。",
    retryable: false,
    action: "leave"
  },
  EVENT_JOURNAL_OPERATION_FAILED: {
    title: "事件日志操作未完成",
    message: "服务暂时无法完成这次日志操作。",
    resolution: "页面会保留当前文字，请稍后重试。",
    retryable: true,
    action: "retry"
  }
};

function errorCode(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "EVENT_JOURNAL_OPERATION_FAILED";
}

export function normalizeEventJournalIssue(
  error: unknown,
  requestId: string
): EventOutcomeIssue {
  const rawCode = errorCode(error);
  const code = rawCode in presets ? rawCode : "EVENT_JOURNAL_OPERATION_FAILED";
  return {
    code,
    ...presets[code],
    requestId
  };
}

export function eventJournalIssueHttpStatus(issue: EventOutcomeIssue) {
  if (issue.code === "AUTHENTICATION_REQUIRED") return 401;
  if (issue.code === "INVALID_EVENT_JOURNAL_REQUEST") return 400;
  if (
    issue.code === "EVENT_JOURNAL_ENTRY_NOT_FOUND" ||
    issue.code === "EVENT_GENERATION_NOT_FOUND"
  ) {
    return 404;
  }
  if (
    issue.code === "EVENT_JOURNAL_ENTRY_VERSION_CONFLICT" ||
    issue.code === "EVENT_GENERATION_SOURCE_CHANGED" ||
    issue.code === "EVENT_STATE_CHANGED" ||
    issue.code === "EVENT_CENTERED_ENTRY_DISABLED" ||
    issue.code === "JOURNAL_DAY_MODE_CONFLICT" ||
    issue.code === "JOURNAL_DAY_MODE_MIXED" ||
    issue.code === "EVENT_JOURNAL_SOURCE_INSUFFICIENT"
  ) {
    return 409;
  }
  if (issue.code === "EVENT_JOURNAL_QUALITY_CHECK_FAILED") return 422;
  return 500;
}

export function buildEventJournalIssueForCode(input: {
  code: string;
  requestId: string;
  action?: EventOutcomeIssueAction;
}) {
  const issue = normalizeEventJournalIssue(new Error(input.code), input.requestId);
  return input.action ? { ...issue, action: input.action } : issue;
}

