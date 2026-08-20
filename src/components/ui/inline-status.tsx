import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type InlineStatusTone = "neutral" | "info" | "success" | "warning" | "error";

type InlineStatusProps = Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  tone?: InlineStatusTone;
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  busy?: boolean;
};

/** 与当前操作贴近的轻量状态，统一承接加载、成功、提醒和失败。 */
export function InlineStatus({
  tone = "neutral",
  title,
  icon,
  action,
  busy = false,
  children,
  className,
  role,
  ...rest
}: InlineStatusProps) {
  const resolvedRole = role ?? (tone === "error" ? "alert" : "status");

  return (
    <div
      className={cn("ui-inline-status", className)}
      data-tone={tone}
      role={resolvedRole}
      aria-busy={busy || undefined}
      {...rest}
    >
      {icon ? <span className="ui-inline-status__icon">{icon}</span> : null}
      <div className="ui-inline-status__content">
        {title ? <p className="ui-inline-status__title">{title}</p> : null}
        {children ? <div className="ui-inline-status__message">{children}</div> : null}
      </div>
      {action ? <div className="ui-inline-status__action">{action}</div> : null}
    </div>
  );
}

export type { InlineStatusProps };
