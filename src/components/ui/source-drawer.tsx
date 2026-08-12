import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type SourceDrawerProps = Omit<ComponentPropsWithoutRef<"details">, "title"> & {
  label?: ReactNode;
  meta?: ReactNode;
};

/** 将来源与生成细节降为按需阅读的信息，避免挤占报告正文首屏。 */
export function SourceDrawer({
  label = "查看来源",
  meta,
  children,
  className,
  ...rest
}: SourceDrawerProps) {
  return (
    <details className={cn("ui-source-drawer", className)} {...rest}>
      <summary className="ui-source-drawer__summary">
        <span>{label}</span>
        {meta ? <span className="ui-source-drawer__meta">{meta}</span> : null}
      </summary>
      <div className="ui-source-drawer__content">{children}</div>
    </details>
  );
}

export type { SourceDrawerProps };
