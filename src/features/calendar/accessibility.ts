export type CalendarLoadingScope = "month" | "week" | "day" | "toolbar";

export function buildCalendarDateButtonAccessibleName(input: {
  dateLabel: string;
  statusLabel?: string | null;
  preview?: string | null;
  isToday: boolean;
  isSelected: boolean;
  isFuture?: boolean;
  dimensionLabels?: string[];
  extraDimensionCount?: number;
  dailyJournalLabel?: string | null;
}) {
  const parts = [input.dateLabel];

  if (input.isToday) {
    parts.push("今天");
  }

  if (input.isSelected) {
    parts.push("已选中");
  }

  if (input.isFuture) {
    parts.push("未来日期");
  }

  if (input.statusLabel) {
    parts.push(input.statusLabel);
  }

  if (input.preview) {
    parts.push(input.preview);
  }

  if ((input.dimensionLabels?.length ?? 0) > 0) {
    const labels = input.dimensionLabels ?? [];
    const totalCount = labels.length + (input.extraDimensionCount ?? 0);
    parts.push(
      input.extraDimensionCount && input.extraDimensionCount > 0
        ? `涉及 ${labels.join("、")} 等 ${totalCount} 维`
        : `涉及 ${labels.join("、")}`
    );
  }

  if (input.dailyJournalLabel) {
    parts.push(input.dailyJournalLabel);
  }

  return parts.join("，");
}

export function buildCalendarActionAccessibleName(input: {
  actionLabel: string;
  dateLabel?: string | null;
  dimensionLabel?: string | null;
  statusLabel?: string | null;
  title?: string | null;
}) {
  const parts = [
    input.dateLabel,
    input.dimensionLabel,
    input.statusLabel,
    input.title,
    input.actionLabel
  ].filter(Boolean);

  return parts.join("，");
}

export function getCalendarLoadingLabel(scope: CalendarLoadingScope) {
  switch (scope) {
    case "month":
      return "正在读取本月记录。";
    case "week":
      return "正在读取本周记录。";
    case "day":
      return "正在读取当天记录。";
    default:
      return "正在读取摘要。";
  }
}

export function getCalendarErrorLabel(scope: CalendarLoadingScope) {
  switch (scope) {
    case "month":
      return "本月记录暂时没打开。";
    case "week":
      return "本周记录暂时没打开。";
    case "day":
      return "当天记录暂时没打开。";
    default:
      return "摘要暂时不可用。";
  }
}
