import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "error" | "stale";

export type StatusBadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: StatusTone;
};

/** 安静、可扫读的状态标签。 */
export function StatusBadge({ tone = "neutral", className, ...rest }: StatusBadgeProps) {
  return <span className={cn("ui-status-badge", className)} data-tone={tone} {...rest} />;
}

export type StatusActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  statusLabel: ReactNode;
  actionLabel: ReactNode;
  busyLabel?: ReactNode;
  busy?: boolean;
  tone?: StatusTone;
};

/**
 * 将紧凑状态和原位动作放在同一热区。鼠标悬停或键盘聚焦后展示动作文案。
 */
export function StatusAction({
  statusLabel,
  actionLabel,
  busyLabel = "正在处理",
  busy = false,
  tone = "stale",
  className,
  disabled,
  type = "button",
  ...rest
}: StatusActionProps) {
  const accessibleLabel = busy
    ? typeof busyLabel === "string"
      ? busyLabel
      : "正在处理"
    : typeof actionLabel === "string"
      ? actionLabel
      : typeof statusLabel === "string"
        ? statusLabel
        : "执行操作";

  return (
    <button
      type={type}
      className={cn("ui-status-action", className)}
      data-busy={busy || undefined}
      data-tone={tone}
      disabled={disabled || busy}
      aria-label={rest["aria-label"] ?? accessibleLabel}
      {...rest}
    >
      <span aria-hidden="true" className="ui-status-action__status">{statusLabel}</span>
      <span aria-hidden="true" className="ui-status-action__action">{actionLabel}</span>
      <span aria-hidden="true" className="ui-status-action__busy">{busyLabel}</span>
    </button>
  );
}
