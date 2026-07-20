export const INTERVIEW_REPLY_MAX_LENGTH = 1200;

export type InterviewIssueAction =
  | "retry"
  | "refresh"
  | "shorten_input"
  | "restart_session"
  | "login"
  | "none";

export type InterviewIssueCode =
  | "AUTHENTICATION_REQUIRED"
  | "NETWORK_UNAVAILABLE"
  | "INVALID_RESPOND_REQUEST"
  | "MESSAGE_TOO_LONG"
  | "SESSION_NOT_FOUND"
  | "SESSION_CHOICE_UNAVAILABLE"
  | "SESSION_EVENT_NOT_FOUND"
  | "INTERVIEW_TURN_IN_PROGRESS"
  | "INTERVIEW_TURN_OUT_OF_DATE"
  | "INTERVIEW_TURN_NOT_FOUND"
  | "INTERVIEW_TURN_RETRY_REQUIRED"
  | "INTERVIEW_ACTION_UNSUPPORTED"
  | "ASSISTANT_ACTION_MISSING"
  | "INTERVIEW_DB_WRITE_FAILED"
  | "INTERVIEW_RESPONSE_SCHEMA_ERROR"
  | "STREAM_PROTOCOL_ERROR"
  | "INTERVIEW_RESPOND_FAILED";

export interface InterviewIssue {
  code: InterviewIssueCode | string;
  title: string;
  message: string;
  resolution: string;
  retryable: boolean;
  action: InterviewIssueAction;
  requestId?: string;
}

type InterviewIssuePreset = Omit<InterviewIssue, "code" | "requestId">;

const issuePresets: Record<InterviewIssueCode, InterviewIssuePreset> = {
  AUTHENTICATION_REQUIRED: {
    title: "登录状态已失效",
    message: "当前设备上的登录状态已经失效，访谈暂时不能继续。",
    resolution: "请重新登录后回到当前页面继续。",
    retryable: false,
    action: "login"
  },
  NETWORK_UNAVAILABLE: {
    title: "网络连接异常",
    message: "这一轮回复没有连上服务端。",
    resolution: "页面会保留这段输入；请确认网络正常后重试。",
    retryable: true,
    action: "refresh"
  },
  INVALID_RESPOND_REQUEST: {
    title: "请求格式异常",
    message: "这次提交的访谈请求缺少必要信息或格式不正确。",
    resolution: "请刷新页面后再试。",
    retryable: true,
    action: "refresh"
  },
  MESSAGE_TOO_LONG: {
    title: "这段回复太长",
    message: `单次回复最多支持 ${INTERVIEW_REPLY_MAX_LENGTH} 字。`,
    resolution: "请把内容拆成两段发送，或删短后重试。",
    retryable: true,
    action: "shorten_input"
  },
  SESSION_NOT_FOUND: {
    title: "当前访谈已失效",
    message: "本地页面指向的访谈会话已经不存在或无法恢复。",
    resolution: "请刷新页面后再试，必要时点击清除对话记录重新开始。",
    retryable: false,
    action: "restart_session"
  },
  SESSION_CHOICE_UNAVAILABLE: {
    title: "当前选择已过期",
    message: "这个分叉选择已经不适用于当前访谈状态。",
    resolution: "请刷新页面后按最新状态继续操作。",
    retryable: true,
    action: "refresh"
  },
  SESSION_EVENT_NOT_FOUND: {
    title: "访谈状态异常",
    message: "当前会话缺少正在访谈的事件记录。",
    resolution: "请刷新后重试；如果仍失败，请清除对话记录重新开始。",
    retryable: true,
    action: "restart_session"
  },
  INTERVIEW_TURN_IN_PROGRESS: {
    title: "这条回复仍在处理中",
    message: "系统已经接收这条回复，当前仍在整理下一步回应。",
    resolution: "请稍等片刻；刷新页面后也可以继续查看处理结果。",
    retryable: true,
    action: "refresh"
  },
  INTERVIEW_TURN_OUT_OF_DATE: {
    title: "当前对话已经更新",
    message: "这条回复对应的是较早的对话位置。",
    resolution: "请刷新页面查看最新问题，再重新发送。",
    retryable: true,
    action: "refresh"
  },
  INTERVIEW_TURN_NOT_FOUND: {
    title: "待恢复的回复已失效",
    message: "系统找不到这条待继续生成的回复。",
    resolution: "请刷新页面后按最新对话继续。",
    retryable: true,
    action: "refresh"
  },
  INTERVIEW_TURN_RETRY_REQUIRED: {
    title: "这条回复等待继续生成",
    message: "系统已经保留你的原话，上一次生成已经停止。",
    resolution: "请使用“继续生成”恢复这一轮。",
    retryable: true,
    action: "retry"
  },
  INTERVIEW_ACTION_UNSUPPORTED: {
    title: "访谈流程异常",
    message: "当前页面发起了服务端不支持的访谈动作。",
    resolution: "请刷新页面后重试。",
    retryable: true,
    action: "refresh"
  },
  ASSISTANT_ACTION_MISSING: {
    title: "访谈流程异常",
    message: "服务端没有拿到下一步访谈动作。",
    resolution: "请刷新页面后重试。",
    retryable: true,
    action: "refresh"
  },
  INTERVIEW_DB_WRITE_FAILED: {
    title: "保存本轮回复失败",
    message: "这次回复生成完成前，服务端写入访谈记录失败。",
    resolution: "你的原话已经保留，请稍后使用“继续生成”恢复这一轮。",
    retryable: true,
    action: "retry"
  },
  INTERVIEW_RESPONSE_SCHEMA_ERROR: {
    title: "回复数据异常",
    message: "服务端生成的访谈数据没有通过格式校验。",
    resolution: "请刷新页面后重试。",
    retryable: true,
    action: "refresh"
  },
  STREAM_PROTOCOL_ERROR: {
    title: "回复数据异常",
    message: "服务端返回的流式数据格式异常。",
    resolution: "请刷新页面后重试。",
    retryable: true,
    action: "refresh"
  },
  INTERVIEW_RESPOND_FAILED: {
    title: "这一轮暂时没提交成功",
    message: "这次访谈提交遇到了未分类错误。",
    resolution: "请重试；如果反复出现，请带上错误码反馈。",
    retryable: true,
    action: "retry"
  }
};

export function buildInterviewIssue(
  code: InterviewIssueCode | string,
  overrides: Partial<Omit<InterviewIssue, "code">> = {}
): InterviewIssue {
  const preset = issuePresets[code as InterviewIssueCode] ?? issuePresets.INTERVIEW_RESPOND_FAILED;

  return {
    code,
    ...preset,
    ...overrides
  };
}

export function parseInterviewIssue(value: unknown): InterviewIssue | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const issue = value as Partial<InterviewIssue>;

  if (
    typeof issue.code !== "string" ||
    typeof issue.title !== "string" ||
    typeof issue.message !== "string" ||
    typeof issue.resolution !== "string" ||
    typeof issue.retryable !== "boolean" ||
    typeof issue.action !== "string"
  ) {
    return null;
  }

  return {
    code: issue.code,
    title: issue.title,
    message: issue.message,
    resolution: issue.resolution,
    retryable: issue.retryable,
    action: issue.action as InterviewIssueAction,
    requestId: typeof issue.requestId === "string" ? issue.requestId : undefined
  };
}
