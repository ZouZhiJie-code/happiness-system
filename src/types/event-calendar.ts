/**
 * 事件中心日历的独立读模型。
 *
 * 它只描述 JournalEvent / JournalEventEntry / JournalDailyEntry，
 * 不复用旧五维 Calendar 的维度、状态和来源口径。
 */

export type EventCalendarEventStatus = "active" | "generating" | "completed";
export type EventCalendarEntryStatus = "draft" | "modified" | "saved";
export type EventCalendarDailyEntryStatus = "draft" | "modified" | "saved";

export type EventCalendarEventState =
  | "active"
  | "generating"
  | "draft"
  | "modified"
  | "saved"
  | "completed";

export type EventCalendarDayStatus =
  | "empty"
  | "in_progress"
  | "generating"
  | "draft"
  | "completed"
  | "mixed";

export type EventCalendarDailyCollection = "empty" | "single_entry" | "multiple_entries";
export type EventCalendarDailyFreshness =
  | "none"
  | EventCalendarDailyEntryStatus
  | "stale";

export type EventCalendarAction =
  | "continue_event"
  | "view_generation_state"
  | "continue_event_entry_editing"
  | "view_event_entry"
  | "continue_daily_journal_editing"
  | "view_daily_journal"
  | "update_daily_journal"
  | "generate_daily_journal"
  | "start_event";

/** 由 JournalEvent 与根会话投影；只包含实际表达后已创建的事件。 */
export interface EventCalendarEventSource {
  kind: "event";
  eventId: string;
  rootSessionId: string;
  activeBranchSessionId: string | null;
  entryDate: string;
  daySequence: number;
  status: EventCalendarEventStatus;
  startedAt: string;
  generationStartedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

/** 由 JournalEventEntry 与所属事件投影；eventId 在同一事件下唯一。 */
export interface EventCalendarEventEntrySource {
  kind: "event_entry";
  entryId: string;
  eventId: string;
  entryDate: string;
  daySequence: number;
  status: EventCalendarEntryStatus;
  title: string;
  content: string;
  contentRevision: number;
  savedRevision: number | null;
  savedAt: string | null;
  updatedAt: string;
}

/** 由 JournalDailyEntry 投影；它与旧 DailyJournalEntry 保持隔离。 */
export interface EventCalendarDailyJournalSource {
  kind: "daily_journal";
  entryId: string;
  entryDate: string;
  status: EventCalendarDailyEntryStatus;
  title: string;
  content: string;
  sourceEntryIds: string[];
  sourceEventIds: string[];
  sourceSignature: string;
  contentRevision: number;
  savedRevision: number | null;
  savedAt: string | null;
  updatedAt: string;
}

/** 仓储按日期批量读取后交给纯函数聚合。 */
export interface EventCalendarSourceCollection {
  events: EventCalendarEventSource[];
  entries: EventCalendarEventEntrySource[];
  dailyJournals?: EventCalendarDailyJournalSource[];
}

export interface EventCalendarEventRecord {
  eventId: string;
  rootSessionId: string;
  activeBranchSessionId: string | null;
  entryDate: string;
  daySequence: number;
  eventStatus: EventCalendarEventStatus;
  entryId: string | null;
  entryStatus: EventCalendarEntryStatus | null;
  state: EventCalendarEventState;
  title: string | null;
  /** 今日日志 C 密度使用的安全正文片段；summary 保留为旧客户端兼容字段。 */
  displaySummary?: string | null;
  summary: string | null;
  latestUpdatedAt: string;
  actions: EventCalendarAction[];
}

export interface EventCalendarDailyJournalStatus {
  collection: EventCalendarDailyCollection;
  freshness: EventCalendarDailyFreshness;
  entryId: string | null;
  title: string | null;
  sourceEntryCount: number;
  pendingSaveEntryIds: string[];
  pendingSave: boolean;
  updateBlockedByPendingSave: boolean;
  directEntryId: string | null;
  actions: EventCalendarAction[];
}

export interface EventCalendarDayRecord {
  date: string;
  overallStatus: EventCalendarDayStatus;
  events: EventCalendarEventRecord[];
  dailyJournal: EventCalendarDailyJournalStatus;
  activeEventCount: number;
  generatingEventCount: number;
  pendingSaveEntryCount: number;
  savedEntryCount: number;
  primaryAction: EventCalendarAction | null;
  latestUpdatedAt: string | null;
}

export interface EventCalendarWeekRecord {
  anchorDate: string;
  weekStartDate: string;
  weekEndDate: string;
  days: EventCalendarDayRecord[];
}

export interface EventCalendarMonthRecord {
  month: string;
  days: EventCalendarDayRecord[];
}

export interface AggregateEventCalendarDayInput extends EventCalendarSourceCollection {
  date: string;
}

export interface AggregateEventCalendarWeekInput extends EventCalendarSourceCollection {
  anchorDate: string;
  dates?: string[];
}

export interface AggregateEventCalendarMonthInput extends EventCalendarSourceCollection {
  month: string;
}
