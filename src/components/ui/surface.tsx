import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cn } from "@/lib/utils";

const SURFACE_TONE_CLASS = {
  page: "page-shell",
  calendar: "calendar-shell"
} as const;

type SurfaceTone = keyof typeof SURFACE_TONE_CLASS;

type SurfaceProps<T extends ElementType> = {
  as?: T;
  tone?: SurfaceTone;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/**
 * 页面底板：每页唯一的重容器层（边框 + 背景 + 外阴影）。
 * 全宽工作区页面通常配 `rounded-none border-x-0 border-t-0`。
 */
export function Surface<T extends ElementType = "section">({
  as,
  tone = "page",
  className,
  ...rest
}: SurfaceProps<T>) {
  const Tag = (as ?? "section") as ElementType;
  return <Tag className={cn(SURFACE_TONE_CLASS[tone], className)} {...rest} />;
}
