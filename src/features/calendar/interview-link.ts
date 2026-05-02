import { getInterviewDimensionMeta } from "@/features/interview/dimensions";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import type { CalendarAction, CalendarDayRecord, CalendarDimensionStatus } from "@/features/calendar/types";

export interface CalendarDetailActionLink {
  id: string;
  dimension: CalendarDimensionStatus["dimension"];
  dimensionLabel: string;
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

export interface CalendarDimensionActionGroups {
  primaryActions: CalendarDetailActionLink[];
  secondaryActions: CalendarDetailActionLink[];
  disabledActions: CalendarDetailActionLink[];
}

export interface CalendarDayViewCardItem extends CalendarDimensionDetailItem {
  actionGroups: CalendarDimensionActionGroups;
}

const actionLabelMap: Record<CalendarAction, string> = {
  start_interview: "开始访谈",
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

  if (action === "start_interview") {
    if (day.date > today) {
      return {
        id: `${day.date}-${dimension.dimension}-${action}`,
        dimension: dimension.dimension,
        dimensionLabel,
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

function buildCalendarDimensionActionGroups(item: CalendarDimensionDetailItem): CalendarDimensionActionGroups {
  const enabledActions = item.actions.filter((action) => Boolean(action.href));
  const disabledActions = item.actions.filter((action) => !action.href);

  if (item.status === "completed") {
    const primaryActions = enabledActions.filter(
      (action) => action.action === "view_journal" || action.action === "edit_saved_journal"
    );

    return {
      primaryActions,
      secondaryActions: enabledActions.filter((action) => !primaryActions.includes(action)),
      disabledActions
    };
  }

  if (item.status === "mixed") {
    return {
      primaryActions: enabledActions[0] ? [enabledActions[0]] : [],
      secondaryActions: enabledActions.slice(1),
      disabledActions
    };
  }

  return {
    primaryActions: enabledActions[0] ? [enabledActions[0]] : [],
    secondaryActions: [],
    disabledActions
  };
}

export function buildCalendarDayViewCardItems(day: CalendarDayRecord, today = getTodayEntryDate()) {
  return buildCalendarDimensionDetailItems(day, today).map<CalendarDayViewCardItem>((item) => ({
    ...item,
    actionGroups: buildCalendarDimensionActionGroups(item)
  }));
}
