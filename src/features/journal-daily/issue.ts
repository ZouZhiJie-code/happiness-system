export type JournalDailyIssueAction =
  | "retry"
  | "refresh"
  | "complete_entry"
  | "confirm_replace"
  | "leave";

export interface JournalDailyIssue {
  code: string;
  title: string;
  message: string;
  resolution: string;
  retryable: boolean;
  action: JournalDailyIssueAction;
  requestId: string;
}

type JournalDailyIssueDefinition = Omit<JournalDailyIssue, "requestId"> & {
  status: number;
};

const definitions: Record<string, JournalDailyIssueDefinition> = {
  AUTHENTICATION_REQUIRED: {
    code: "AUTHENTICATION_REQUIRED",
    title: "登录状态已失效",
    message: "这次操作还没有提交。",
    resolution: "重新登录后再试一次。",
    retryable: false,
    action: "leave",
    status: 401
  },
  JOURNAL_DAILY_SOURCE_INSUFFICIENT: {
    code: "JOURNAL_DAILY_SOURCE_INSUFFICIENT",
    title: "还需要两篇已保存的事件日志",
    message: "当前来源还不足以形成当天完整日志。",
    resolution: "先保存至少两篇事件日志。",
    retryable: false,
    action: "complete_entry",
    status: 409
  },
  JOURNAL_DAILY_PENDING_EVENT_ENTRY: {
    code: "JOURNAL_DAILY_PENDING_EVENT_ENTRY",
    title: "还有事件日志等待保存",
    message: "当天完整日志会使用正式保存后的事件内容。",
    resolution: "先完成待保存的事件日志。",
    retryable: false,
    action: "complete_entry",
    status: 409
  },
  JOURNAL_DAILY_SOURCE_CHANGED: {
    code: "JOURNAL_DAILY_SOURCE_CHANGED",
    title: "当天来源已经更新",
    message: "生成期间有事件日志发生了变化，最新内容已保留。",
    resolution: "刷新到最新来源后重新整理。",
    retryable: true,
    action: "refresh",
    status: 409
  },
  JOURNAL_DAILY_ENTRY_VERSION_CHANGED: {
    code: "JOURNAL_DAILY_ENTRY_VERSION_CHANGED",
    title: "当天日志已经更新",
    message: "另一个页面或操作先保存了新版本。",
    resolution: "刷新后基于最新版本继续。",
    retryable: true,
    action: "refresh",
    status: 409
  },
  JOURNAL_DAILY_MANUAL_EDITS_CONFIRMATION_REQUIRED: {
    code: "JOURNAL_DAILY_MANUAL_EDITS_CONFIRMATION_REQUIRED",
    title: "这篇日志包含手动修改",
    message: "重新整理会替换当前完整日志正文。",
    resolution: "确认替换后再次提交。",
    retryable: true,
    action: "confirm_replace",
    status: 409
  },
  JOURNAL_DAILY_OPERATION_IN_PROGRESS: {
    code: "JOURNAL_DAILY_OPERATION_IN_PROGRESS",
    title: "当天日志正在整理",
    message: "另一个页面已经开始了同一天的整理。",
    resolution: "稍后刷新查看最新结果。",
    retryable: true,
    action: "refresh",
    status: 409
  },
  JOURNAL_DAILY_OPERATION_CONFLICT: {
    code: "JOURNAL_DAILY_OPERATION_CONFLICT",
    title: "这次操作与原请求不一致",
    message: "相同操作编号已经用于另一项当天成果操作。",
    resolution: "刷新后重新发起。",
    retryable: true,
    action: "refresh",
    status: 409
  },
  JOURNAL_DAILY_GENERATION_STATE_CHANGED: {
    code: "JOURNAL_DAILY_GENERATION_STATE_CHANGED",
    title: "整理状态已经更新",
    message: "另一个页面先完成或结束了这次整理。",
    resolution: "刷新查看最新结果。",
    retryable: true,
    action: "refresh",
    status: 409
  },
  JOURNAL_DAILY_INSIGHT_INSUFFICIENT: {
    code: "JOURNAL_DAILY_INSIGHT_INSUFFICIENT",
    title: "今天先保留这些事件",
    message: "当前事件之间还缺少足够清楚的共同证据。",
    resolution: "完整日志已经保留，之后仍可再次尝试。",
    retryable: false,
    action: "leave",
    status: 200
  },
  JOURNAL_DAILY_INSIGHT_ALREADY_PRESENT: {
    code: "JOURNAL_DAILY_INSIGHT_ALREADY_PRESENT",
    title: "当天线索已经在正文中",
    message: "当前完整日志已经包含“今天看见的自己”。",
    resolution: "可以直接编辑现有内容。",
    retryable: false,
    action: "leave",
    status: 409
  },
  JOURNAL_DAILY_INSIGHT_QUALITY_CHECK_FAILED: {
    code: "JOURNAL_DAILY_INSIGHT_QUALITY_CHECK_FAILED",
    title: "这次线索暂时不够可靠",
    message: "事件合集已经完整保留，这次生成结果没有写入正文。",
    resolution: "稍后可以重新生成。",
    retryable: true,
    action: "retry",
    status: 422
  },
  JOURNAL_DAILY_ENTRY_READ_ONLY: {
    code: "JOURNAL_DAILY_ENTRY_READ_ONLY",
    title: "当天完整日志当前只读",
    message: "当前已保存来源不足两篇。",
    resolution: "返回今日日志查看对应事件。",
    retryable: false,
    action: "leave",
    status: 409
  },
  JOURNAL_DAILY_ENTRY_NOT_FOUND: {
    code: "JOURNAL_DAILY_ENTRY_NOT_FOUND",
    title: "当天日志未找到",
    message: "这篇日志可能已经发生变化。",
    resolution: "返回今日日志并重新打开。",
    retryable: false,
    action: "refresh",
    status: 404
  },
  JOURNAL_DAILY_GENERATION_NOT_FOUND: {
    code: "JOURNAL_DAILY_GENERATION_NOT_FOUND",
    title: "整理任务未找到",
    message: "这次整理可能已经结束。",
    resolution: "刷新查看当天日志状态。",
    retryable: false,
    action: "refresh",
    status: 404
  },
  EVENT_CENTERED_ENTRY_DISABLED: {
    code: "EVENT_CENTERED_ENTRY_DISABLED",
    title: "事件记录当前只读",
    message: "当前发布档位保留已有成果阅读。",
    resolution: "返回阅读已有日志。",
    retryable: false,
    action: "leave",
    status: 403
  },
  EVENT_CENTERED_FUTURE_DATE: {
    code: "EVENT_CENTERED_FUTURE_DATE",
    title: "未来日期暂不写入",
    message: "当天成果会在对应日期开放。",
    resolution: "返回今天继续记录。",
    retryable: false,
    action: "leave",
    status: 403
  },
  JOURNAL_DAY_MODE_CONFLICT: {
    code: "JOURNAL_DAY_MODE_CONFLICT",
    title: "这一天使用另一种记录方式",
    message: "当天成果会继续沿用原有读取路径。",
    resolution: "返回日历选择对应记录。",
    retryable: false,
    action: "leave",
    status: 409
  },
  JOURNAL_DAY_MODE_MIXED: {
    code: "JOURNAL_DAY_MODE_MIXED",
    title: "这一天包含两类历史记录",
    message: "当天成果当前保持只读分流。",
    resolution: "返回日历分别查看两类记录。",
    retryable: false,
    action: "leave",
    status: 409
  },
  JOURNAL_DAILY_INSIGHT_GENERATE_FAILED: {
    code: "JOURNAL_DAILY_INSIGHT_GENERATE_FAILED",
    title: "当天线索暂时没有生成",
    message: "事件原文合集已经完整保留。",
    resolution: "稍后可以再次生成当天线索。",
    retryable: true,
    action: "retry",
    status: 500
  }
};

const fallback: JournalDailyIssueDefinition = {
  code: "JOURNAL_DAILY_OPERATION_FAILED",
  title: "这一步暂时没有完成",
  message: "当前日志和用户编辑已经保留。",
  resolution: "稍后重试，或刷新查看最新状态。",
  retryable: true,
  action: "retry",
  status: 500
};

export function normalizeJournalDailyIssue(error: unknown, requestId: string) {
  const code = error instanceof Error ? error.message : "";
  const definition = definitions[code] ?? fallback;

  return {
    status: definition.status,
    issue: {
      code: definition.code,
      title: definition.title,
      message: definition.message,
      resolution: definition.resolution,
      retryable: definition.retryable,
      action: definition.action,
      requestId
    } satisfies JournalDailyIssue
  };
}

export function buildInvalidJournalDailyIssue(requestId: string) {
  return {
    code: "INVALID_JOURNAL_DAILY_REQUEST",
    title: "提交内容需要调整",
    message: "这次请求缺少必要信息，或内容长度超出范围。",
    resolution: "刷新页面后再试一次。",
    retryable: false,
    action: "refresh" as const,
    requestId
  };
}
