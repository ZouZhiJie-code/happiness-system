import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FloatingComposerProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  children: ReactNode;
  actions?: ReactNode;
  disabled?: boolean;
};

/**
 * 对话输入区唯一的悬浮材质。组件只提供外壳，输入、发送与可靠提交仍由业务组件负责。
 */
export function FloatingComposer({
  children,
  actions,
  disabled = false,
  className,
  "aria-label": ariaLabel = "输入消息",
  ...rest
}: FloatingComposerProps) {
  return (
    <section
      className={cn("ui-floating-composer", className)}
      data-disabled={disabled || undefined}
      aria-label={ariaLabel}
      {...rest}
    >
      <div className="ui-floating-composer__content">{children}</div>
      {actions ? <div className="ui-floating-composer__actions">{actions}</div> : null}
    </section>
  );
}
