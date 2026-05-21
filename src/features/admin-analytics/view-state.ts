import { formatEntryDate, getTodayEntryDate, parseEntryDateInput } from "@/features/interview/entry-date";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import type { InterviewDimension, InterviewSessionStatus, JoyEntryStatus, DailyJournalStatus } from "@/types/interview";

export type AdminAnalyticsView = "review" | "monitor";

export interface AdminAnalyticsNormalizedSearchParams {
  view: AdminAnalyticsView;
  range: {
    startDate: string;
    endDate: string;
  };
  username: string | null;
  hasSavedJournal: boolean;
  hasBoundaryInsufficient: boolean;
  hasReopenedSession: boolean;
  userId: string | null;
  sessionId: string | null;
  entryId: string | null;
  dailyJournalId: string | null;
}

interface AdminAnalyticsBaseHrefInput {
  view: AdminAnalyticsView;
  range: {
    startDate: string;
    endDate: string;
  };
  username?: string | null;
  hasSavedJournal?: boolean;
  hasBoundaryInsufficient?: boolean;
  hasReopenedSession?: boolean;
  userId?: string | null;
  sessionId?: string | null;
  entryId?: string | null;
  dailyJournalId?: string | null;
}

interface AdminAnalyticsDrilldownHrefInput extends AdminAnalyticsBaseHrefInput {
  sessionId?: string | null;
  entryId?: string | null;
  dailyJournalId?: string | null;
}

function shiftEntryDate(date: string, days: number) {
  const shifted = new Date(parseEntryDateInput(date).getTime() + days * 24 * 60 * 60 * 1000);
  return formatEntryDate(shifted);
}

function normalizeTextQuery(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBooleanFlag(value?: string) {
  return value === "1";
}

function buildAnalyticsParams(input: AdminAnalyticsBaseHrefInput) {
  const params = new URLSearchParams({
    view: input.view,
    startDate: input.range.startDate,
    endDate: input.range.endDate
  });

  if (input.userId) {
    params.set("userId", input.userId);
  }

  if (input.username) {
    params.set("username", input.username);
  }

  if (input.hasSavedJournal) {
    params.set("hasSavedJournal", "1");
  }

  if (input.hasBoundaryInsufficient) {
    params.set("hasBoundaryInsufficient", "1");
  }

  if (input.hasReopenedSession) {
    params.set("hasReopenedSession", "1");
  }

  return params;
}

export function getAdminAnalyticsDefaultRange(today = getTodayEntryDate()) {
  return {
    startDate: shiftEntryDate(today, -29),
    endDate: today
  };
}

export function normalizeAdminAnalyticsSearchParams(input: {
  view?: string;
  startDate?: string;
  endDate?: string;
  username?: string;
  hasSavedJournal?: string;
  hasBoundaryInsufficient?: string;
  hasReopenedSession?: string;
  hasFailure?: string;
  hasReturnVisit?: string;
  userId?: string;
  sessionId?: string;
  entryId?: string;
  dailyJournalId?: string;
}, today = getTodayEntryDate()) {
  const fallbackRange = getAdminAnalyticsDefaultRange(today);
  const hasExplicitRange = Boolean(input.startDate && input.endDate);

  return {
    view: input.view === "monitor" ? "monitor" : "review",
    range: hasExplicitRange ?
      {
        startDate: input.startDate!,
        endDate: input.endDate!
      }
    : fallbackRange,
    username: normalizeTextQuery(input.username),
    hasSavedJournal: normalizeBooleanFlag(input.hasSavedJournal),
    hasBoundaryInsufficient: normalizeBooleanFlag(input.hasBoundaryInsufficient ?? input.hasFailure),
    hasReopenedSession: normalizeBooleanFlag(input.hasReopenedSession ?? input.hasReturnVisit),
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    entryId: input.entryId ?? null,
    dailyJournalId: input.dailyJournalId ?? null
  } satisfies AdminAnalyticsNormalizedSearchParams;
}

export function hasActiveAdminAnalyticsUserSearch(input: Pick<
  AdminAnalyticsNormalizedSearchParams,
  "username" | "hasSavedJournal" | "hasBoundaryInsufficient" | "hasReopenedSession"
>) {
  return Boolean(input.username || input.hasSavedJournal || input.hasBoundaryInsufficient || input.hasReopenedSession);
}

export function buildAdminAnalyticsViewHref(input: AdminAnalyticsBaseHrefInput) {
  const params = buildAnalyticsParams(input);
  return `/admin/analytics?${params.toString()}`;
}

export function buildAdminAnalyticsDrilldownHref(input: AdminAnalyticsDrilldownHrefInput) {
  const params = buildAnalyticsParams(input);

  if (input.sessionId) {
    params.set("sessionId", input.sessionId);
  }

  if (input.entryId) {
    params.set("entryId", input.entryId);
  }

  if (input.dailyJournalId) {
    params.set("dailyJournalId", input.dailyJournalId);
  }

  return `/admin/analytics?${params.toString()}`;
}

export function buildAdminAnalyticsRangePresetHrefs(input: AdminAnalyticsBaseHrefInput) {
  const last7Range = {
    startDate: shiftEntryDate(input.range.endDate, -6),
    endDate: input.range.endDate
  };
  const last30Range = {
    startDate: shiftEntryDate(input.range.endDate, -29),
    endDate: input.range.endDate
  };
  const thisMonthRange = {
    startDate: `${input.range.endDate.slice(0, 8)}01`,
    endDate: input.range.endDate
  };

  return [
    {
      key: "last7",
      label: "最近 7 天",
      href: buildAdminAnalyticsViewHref({ ...input, range: last7Range })
    },
    {
      key: "last30",
      label: "最近 30 天",
      href: buildAdminAnalyticsViewHref({ ...input, range: last30Range })
    },
    {
      key: "thisMonth",
      label: "本月",
      href: buildAdminAnalyticsViewHref({ ...input, range: thisMonthRange })
    }
  ] as const;
}

export function getAdminAnalyticsDimensionLabel(dimension: InterviewDimension) {
  return getInterviewDimensionMeta(dimension).label;
}

export function getAdminAnalyticsFunnelLabel(
  key:
    | "register"
    | "login"
    | "privatePageView"
    | "sessionStart"
    | "firstReply"
    | "draftGenerated"
    | "journalSaved"
    | "dailyJournalGenerated"
    | "dailyJournalSaved"
) {
  switch (key) {
    case "register":
      return "注册";
    case "login":
      return "登录";
    case "privatePageView":
      return "进入私有页面";
    case "sessionStart":
      return "开始访谈";
    case "firstReply":
      return "首次回复";
    case "draftGenerated":
      return "生成维度草稿";
    case "journalSaved":
      return "保存维度日志";
    case "dailyJournalGenerated":
      return "生成完整日志";
    case "dailyJournalSaved":
      return "保存完整日志";
  }
}

export function getAdminAnalyticsSessionStatusLabel(status: InterviewSessionStatus) {
  switch (status) {
    case "active":
      return "进行中";
    case "paused":
      return "已暂停";
    case "completed":
      return "已完成";
    case "abandoned":
      return "已放弃";
  }
}

export function getAdminAnalyticsEntryStatusLabel(status: JoyEntryStatus | DailyJournalStatus) {
  switch (status) {
    case "draft":
      return "草稿";
    case "saved":
      return "已保存";
  }
}

export function getAdminAnalyticsUserFunnelStepLabel(step: string | null) {
  switch (step) {
    case "register":
      return "已注册";
    case "login":
      return "已登录";
    case "private_page_viewed":
      return "已进入私有页";
    case "session_started":
      return "已开始访谈";
    case "first_reply":
      return "已完成首次回复";
    case "draft_generated":
      return "已生成维度草稿";
    case "journal_saved":
      return "已保存维度日志";
    case "daily_journal_generated":
      return "已生成完整日志";
    case "daily_journal_saved":
      return "已保存完整日志";
    default:
      return "暂无明确阶段";
  }
}
