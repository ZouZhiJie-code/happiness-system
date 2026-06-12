import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cn } from "@/lib/utils";

type CardProps<T extends ElementType> = {
  as?: T;
  /** 可点击卡片：自带 hover/focus-visible 反馈 */
  interactive?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/**
 * 唯一的卡片原语。底板内最多一层；卡片内部禁止再嵌套 border+bg 容器，
 * 分区改用 SectionHeading / Divider / 留白（见 docs/design/ui-conventions.md）。
 */
export function Card<T extends ElementType = "div">({
  as,
  interactive = false,
  className,
  ...rest
}: CardProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag className={cn("ui-card", interactive && "ui-card--interactive", className)} {...rest} />
  );
}
