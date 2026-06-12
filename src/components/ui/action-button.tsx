import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cn } from "@/lib/utils";

const ACTION_BUTTON_VARIANT_CLASS = {
  primary: "ui-btn--primary",
  secondary: "ui-btn--secondary",
  ghost: "ui-btn--ghost"
} as const;

export type ActionButtonVariant = keyof typeof ACTION_BUTTON_VARIANT_CLASS;

/** 供 next/link 等无法直接用组件包裹的场景复用同一套按钮样式。 */
export function actionButtonClass(variant: ActionButtonVariant, className?: string) {
  return cn("ui-btn", ACTION_BUTTON_VARIANT_CLASS[variant], className);
}

type ActionButtonProps<T extends ElementType> = {
  as?: T;
  variant?: ActionButtonVariant;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/**
 * 三态动作按钮：primary（暖棕渐变）/ secondary（描边纸面）/ ghost（下划线文字）。
 */
export function ActionButton<T extends ElementType = "button">({
  as,
  variant = "secondary",
  className,
  ...rest
}: ActionButtonProps<T>) {
  const Tag = (as ?? "button") as ElementType;
  return <Tag className={actionButtonClass(variant, className)} {...rest} />;
}
