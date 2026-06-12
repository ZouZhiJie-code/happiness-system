import clsx from "clsx";

export type DimensionStatusLabel = "未开始" | "进行中" | "已整理" | "已完成";

export type DimensionStatusValue = "empty" | "in_progress" | "draft" | "completed";

export function getDimensionStatusValue(statusLabel: DimensionStatusLabel): DimensionStatusValue {
  switch (statusLabel) {
    case "已完成":
      return "completed";
    case "进行中":
      return "in_progress";
    case "已整理":
      return "draft";
    case "未开始":
      return "empty";
  }
}

export function DimensionStatusDot({
  statusLabel,
  testId,
  className
}: {
  statusLabel: DimensionStatusLabel;
  testId?: string;
  className?: string;
}) {
  const statusValue = getDimensionStatusValue(statusLabel);

  return (
    <span
      aria-hidden="true"
      title={statusLabel}
      data-testid={testId}
      data-status={statusValue}
      className={clsx("header-status-dot", `header-status-dot--${statusValue}`, className)}
    />
  );
}
