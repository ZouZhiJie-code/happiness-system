import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { calendarDayStatusLabelMap } from "@/features/calendar/presentation";
import type { CalendarAction, CalendarDayRecord, CalendarDimensionStatus } from "@/features/calendar/types";

export interface CalendarDetailActionLink {
  id: string;
  dimension: CalendarDimensionStatus["dimension"];
  dimensionLabel: string;
  statusLabel: string;
  action: CalendarAction;
  label: string;
  href: string | null;
  disabledReason: string | null;
}

export interface CalendarDimensionDetailItem {
  dimension: CalendarDimensionStatus["dimension"];
  dimensionLabel: string;
  status: CalendarDimensionStatus["status"];
  title: string | null;
  summary: string | null;
  latestUpdatedAt: string | null;
  actions: CalendarDetailActionLink[];
}

export interface CalendarDayViewCardItem extends CalendarDimensionDetailItem {
  primaryAction: CalendarDetailActionLink;
  secondaryActions: CalendarDetailActionLink[];
}

const actionLabelMap: Record<CalendarAction, string> = {
  start_interview: "开始记录",
  continue_interview: "继续访谈",
  continue_editing: "继续编辑",
  view_journal: "查看日志",
  edit_saved_journal: "编辑日志"
};

function buildInterviewHref(input: {
  dimension: CalendarDimensionStatus["dimension"];
  entryDate?: string | null;
  sessionId?: string | null;
  panel?: "journal" | null;
}) {
  const params = new URLSearchParams({
    dimension: input.dimension
  });

  if (input.sessionId) {
    params.set("sessionId", input.sessionId);
  }

  if (input.entryDate) {
    params.set("entryDate", input.entryDate);
  }

  if (input.panel) {
    params.set("panel", input.panel);
  }

  return `/interview?${params.toString()}`;
}

function buildActionLink(input: {
  day: CalendarDayRecord;
  dimension: CalendarDimensionStatus;
  action: CalendarAction;
  today: string;
}): CalendarDetailActionLink {
  const { day, dimension, action, today } = input;
  const dimensionLabel = getInterviewDimensionMeta(dimension.dimension).label;
  const statusLabel = calendarDayStatusLabelMap[dimension.status];

  if (action === "start_interview") {
    if (day.date > today) {
      return {
        id: `${day.date}-${dimension.dimension}-${action}`,
        dimension: dimension.dimension,
        dimensionLabel,
        statusLabel,
        action,
        label: actionLabelMap[action],
        href: null,
        disabledReason: "未来日期暂不支持开始记录"
      };
    }

      return {
        id: `${day.date}-${dimension.dimension}-${action}`,
        dimension: dimension.dimension,
        dimensionLabel,
        statusLabel,
        action,
        label: actionLabelMap[action],
        href: buildInterviewHref({
        dimension: dimension.dimension,
        entryDate: day.date
      }),
      disabledReason: null
    };
  }

  if (action === "continue_interview") {
    return {
      id: `${day.date}-${dimension.dimension}-${action}`,
      dimension: dimension.dimension,
      dimensionLabel,
      statusLabel,
      action,
      label: actionLabelMap[action],
      href: dimension.sessionId
        ? buildInterviewHref({
            dimension: dimension.dimension,
            sessionId: dimension.sessionId,
            entryDate: day.date
          })
        : null,
      disabledReason: dimension.sessionId ? null : "当前没有可继续的访谈会话"
    };
  }

  if (action === "continue_editing") {
    return {
      id: `${day.date}-${dimension.dimension}-${action}`,
      dimension: dimension.dimension,
      dimensionLabel,
      statusLabel,
      action,
      label: actionLabelMap[action],
      href: dimension.sessionId
        ? buildInterviewHref({
            dimension: dimension.dimension,
            sessionId: dimension.sessionId,
            panel: "journal"
          })
        : null,
      disabledReason: dimension.sessionId ? null : "当前没有可继续编辑的日志会话"
    };
  }

  return {
    id: `${day.date}-${dimension.dimension}-${action}`,
    dimension: dimension.dimension,
    dimensionLabel,
    statusLabel,
    action,
    label: actionLabelMap[action],
    href: dimension.sessionId
      ? buildInterviewHref({
          dimension: dimension.dimension,
          sessionId: dimension.sessionId,
          panel: "journal"
        })
      : null,
    disabledReason: dimension.sessionId ? null : "当前没有可打开的日志会话"
  };
}

function resolvePrimaryDimensionForDay(day: CalendarDayRecord) {
  const { primaryAction } = day;

  if (!primaryAction) {
    return null;
  }

  return day.dimensions.find((dimension) => dimension.actions.includes(primaryAction)) ?? null;
}

function buildCalendarResolvedActionOrder(dimension: CalendarDimensionStatus): CalendarAction[] {
  const actions: CalendarAction[] = [];

  if (dimension.hasActiveSession) {
    actions.push("continue_interview");
  }

  if (dimension.hasDraftEntry) {
    actions.push("continue_editing");
  }

  if (dimension.hasSavedEntry) {
    actions.push("view_journal", "edit_saved_journal");
  }

  if (actions.length === 0) {
    actions.push("start_interview");
  }

  return actions;
}

export function buildCalendarDimensionDetailItems(day: CalendarDayRecord, today = getTodayEntryDate()) {
  return day.dimensions.map<CalendarDimensionDetailItem>((dimension) => {
    const dimensionLabel = getInterviewDimensionMeta(dimension.dimension).label;
    const actions =
      dimension.status === "empty"
        ? [
            buildActionLink({
              day,
              dimension,
              action: "start_interview",
              today
            })
          ]
        : dimension.actions.map((action) =>
            buildActionLink({
              day,
              dimension,
              action,
              today
            })
          );

    return {
      dimension: dimension.dimension,
      dimensionLabel,
      status: dimension.status,
      title: dimension.title,
      summary: dimension.summary,
      latestUpdatedAt: dimension.latestUpdatedAt,
      actions
    };
  });
}

export function resolveCalendarPrimaryAction(dimension: CalendarDimensionStatus): CalendarAction {
  return buildCalendarResolvedActionOrder(dimension)[0] ?? "start_interview";
}

export function buildCalendarDayViewCardItems(day: CalendarDayRecord, today = getTodayEntryDate()) {
  return day.dimensions.map<CalendarDayViewCardItem>((dimension) => {
    const actions = buildCalendarResolvedActionOrder(dimension).map((action) =>
      buildActionLink({
        day,
        dimension,
        action,
        today
      })
    );
    const [primaryAction, ...secondaryActions] = actions;

    return {
      dimension: dimension.dimension,
      dimensionLabel: getInterviewDimensionMeta(dimension.dimension).label,
      status: dimension.status,
      title: dimension.title,
      summary: dimension.summary,
      latestUpdatedAt: dimension.latestUpdatedAt,
      actions,
      primaryAction,
      secondaryActions
    };
  });
}

export function buildCalendarPrimaryActionLink(day: CalendarDayRecord, today = getTodayEntryDate()) {
  const primaryDimension = resolvePrimaryDimensionForDay(day);
  const primaryAction = day.primaryAction;

  if (!primaryDimension || !primaryAction) {
    return null;
  }

  const actionLink = buildActionLink({
    day,
    dimension: primaryDimension,
    action: primaryAction,
    today
  });

  return actionLink.href ? actionLink : null;
}
