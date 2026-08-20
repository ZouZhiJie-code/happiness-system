import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cn } from "@/lib/utils";

type ReadingSurfaceProps<T extends ElementType> = {
  as?: T;
  className?: string;
  density?: "comfortable" | "compact";
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/** 日记与周期报告的单一阅读面：20px 圆角、正文衬线、无重阴影。 */
export function ReadingSurface<T extends ElementType = "article">({
  as,
  density = "comfortable",
  className,
  ...rest
}: ReadingSurfaceProps<T>) {
  const Tag = (as ?? "article") as ElementType;
  return <Tag className={cn("ui-reading-surface", className)} data-density={density} {...rest} />;
}

export type { ReadingSurfaceProps };
