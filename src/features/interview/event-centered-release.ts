/**
 * 事件中心的入口策略与数据生命周期分离：回退时停止新写入，已保存的
 * 事件、原话与成果仍可通过深链和日历继续阅读。
 */
export type EventCenteredReleaseMode =
  | "legacy"
  | "optional"
  | "event_centered"
  | "event_recovery";

type EventCenteredReleaseEnvironment = {
  INTERVIEW_EVENT_CENTERED_MODE?: string;
  INTERVIEW_EVENT_CENTERED_SCOPE?: string;
};

export type EventCenteredProductScope = "all_angles" | "thought_only";

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

  if (mode === "optional" || mode === "event_centered" || mode === "event_recovery") {
    return mode;
  }

  return "legacy";
}

/**
 * 新会话的产品范围。默认继续兼容历史四角度数据；GI-065 候选显式使用
 * thought_only，只开放“理清想法”单角度主线。
 */
export function getEventCenteredProductScope(
  env?: EventCenteredReleaseEnvironment
): EventCenteredProductScope {
  const configured = env
    ? env.INTERVIEW_EVENT_CENTERED_SCOPE
    : process.env["INTERVIEW_EVENT_CENTERED_SCOPE"];
  return configured?.trim().toLowerCase() === "thought_only"
    ? "thought_only"
    : "all_angles";
}

export function isEventCenteredThoughtOnlyScope(
  scope = getEventCenteredProductScope()
) {
  return scope === "thought_only";
}

/** 未指定入口时，是否把访谈首页直接切换为事件中心。 */
export function isEventCenteredDefaultEntryEnabled(mode = getEventCenteredReleaseMode()) {
  return mode === "event_centered";
}

/** 五维默认入口旁是否展示用户主动选择的事件中心入口。 */
export function isEventCenteredOptionalEntryVisible(mode = getEventCenteredReleaseMode()) {
  return mode === "optional";
}

/** 事件中心是否允许创建事件、继续访谈和生成成果。 */
export function isEventCenteredWriteEnabled(mode = getEventCenteredReleaseMode()) {
  return mode === "optional" || mode === "event_centered";
}

/** @deprecated 新代码请按用途选择默认入口或写入判断。 */
export function isEventCenteredEntryEnabled(mode = getEventCenteredReleaseMode()) {
  return isEventCenteredWriteEnabled(mode);
}

/** 恢复档保留历史事件读取，并暂停新的事件写入。 */
export function isEventCenteredRecoveryMode(mode = getEventCenteredReleaseMode()) {
  return mode === "event_recovery";
}

/**
 * 所有事件中心写入都经过同一门禁。`legacy` 与 `event_recovery` 仍可阅读
 * 已有事件，`optional` 与 `event_centered` 允许创建和继续写入。
 */
export function assertEventCenteredWriteAllowed(input?: {
  entryDate?: string;
  today?: string;
  mode?: EventCenteredReleaseMode;
}) {
  const mode = input?.mode ?? getEventCenteredReleaseMode();
  if (!isEventCenteredWriteEnabled(mode)) {
    throw new EventCenteredWriteBlockedError("EVENT_CENTERED_ENTRY_DISABLED");
  }

  if (input?.entryDate && input.today && input.entryDate > input.today) {
    throw new EventCenteredWriteBlockedError("EVENT_CENTERED_FUTURE_DATE");
  }
}
