import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type IconButtonTone = "default" | "quiet" | "danger";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  "aria-label": string;
  children: ReactNode;
  tone?: IconButtonTone;
};

/**
 * 全站图标按钮。可见热区固定为 44px，并强制提供读屏名称。
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, tone = "default", type = "button", children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("ui-icon-button", className)}
      data-tone={tone}
      {...rest}
    >
      {children}
    </button>
  );
});
