"use client";

import { useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface HorizontalPagerPage {
  key: string;
  children: ReactNode;
  className?: string;
}

export type HorizontalPagerMotion = "slide" | "instant";

interface HorizontalPagerProps {
  activeKey: string;
  pages: HorizontalPagerPage[];
  ariaLabel?: string;
  className?: string;
  trackClassName?: string;
  motion?: HorizontalPagerMotion;
}

export function HorizontalPager({
  activeKey,
  pages,
  ariaLabel,
  className,
  trackClassName,
  motion = "slide"
}: HorizontalPagerProps) {
  const activeIndex = useMemo(() => {
    const index = pages.findIndex((page) => page.key === activeKey);

    return index >= 0 ? index : 0;
  }, [activeKey, pages]);

  const pageCount = Math.max(pages.length, 1);
  const offsetPercent = (activeIndex * 100) / pageCount;

  return (
    <div
      className={cn("ui-horizontal-pager", className)}
      style={{ overflow: "hidden", width: "100%" }}
      aria-label={ariaLabel}
    >
      <div
        className={cn("ui-horizontal-pager__track", trackClassName)}
        data-active={activeKey}
        data-motion={motion}
        style={{
          display: "flex",
          height: "100%",
          width: `${pageCount * 100}%`,
          transform: `translateX(-${offsetPercent}%)`
        }}
      >
        {pages.map((page) => {
          const isActive = page.key === activeKey;

          return (
            <div
              key={page.key}
              className={cn("ui-horizontal-pager__page", page.className)}
              style={{
                width: `${100 / pageCount}%`,
                flexShrink: 0,
                minWidth: 0,
                height: "100%"
              }}
              aria-hidden={!isActive}
            >
              {page.children}
            </div>
          );
        })}
      </div>
    </div>
  );
}
