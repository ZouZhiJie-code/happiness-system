/**
 * 事件中心的入口策略与数据生命周期分离：回退时停止新写入，已保存的
 * 事件、原话与成果仍可通过深链和日历继续阅读。
 */
export type EventCenteredReleaseMode = "legacy" | "event_centered" | "event_recovery";

type EventCenteredReleaseEnvironment = {
  INTERVIEW_EVENT_CENTERED_MODE?: string;
};

export type EventCenteredWriteBlockCode =
  | "EVENT_CENTERED_ENTRY_DISABLED"
  | "EVENT_CENTERED_FUTURE_DATE";

export class EventCenteredWriteBlockedError extends Error {
  constructor(readonly code: EventCenteredWriteBlockCode) {
    super(code);
    this.name = "EventCenteredWriteBlockedError";
  }
}

export function getEventCenteredReleaseMode(
  env?: EventCenteredReleaseEnvironment
): EventCenteredReleaseMode {
  const configured = env
    ? env.INTERVIEW_EVENT_CENTERED_MODE
    : process.env["INTERVIEW_EVENT_CENTERED_MODE"];
  const mode = configured?.trim().toLowerCase();

  if (mode === "event_centered" || mode === "event_recovery") {
    return mode;
  }

  return "legacy";
}

/** 未归属日期是否默认进入事件中心，并允许创建新的事件。 */
export function isEventCenteredEntryEnabled(mode = getEventCenteredReleaseMode()) {
  return mode === "event_centered";
}

/** 恢复档保留历史事件读取，并暂停新的事件写入。 */
export function isEventCenteredRecoveryMode(mode = getEventCenteredReleaseMode()) {
  return mode === "event_recovery";
}

/**
 * 所有事件中心写入都经过同一门禁。`legacy` 与 `event_recovery` 仍可阅读
 * 已有事件，唯有正式事件档允许创建和继续写入。
 */
export function assertEventCenteredWriteAllowed(input?: {
  entryDate?: string;
  today?: string;
  mode?: EventCenteredReleaseMode;
}) {
  const mode = input?.mode ?? getEventCenteredReleaseMode();
  if (!isEventCenteredEntryEnabled(mode)) {
    throw new EventCenteredWriteBlockedError("EVENT_CENTERED_ENTRY_DISABLED");
  }

  if (input?.entryDate && input.today && input.entryDate > input.today) {
    throw new EventCenteredWriteBlockedError("EVENT_CENTERED_FUTURE_DATE");
  }
}
