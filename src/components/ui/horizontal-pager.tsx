"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, type PanInfo } from "motion/react";

import { cn } from "@/lib/utils";

export interface HorizontalPagerPage {
  key: string;
  children: ReactNode;
  className?: string;
}

export type HorizontalPagerMotion = "slide" | "instant";

export function resolveHorizontalPagerDirection({
  offsetX,
  velocityX,
  viewportWidth
}: {
  offsetX: number;
  velocityX: number;
  viewportWidth: number;
}) {
  if (Math.abs(offsetX) < 10) {
    return 0;
  }

  const projectedOffset = offsetX + velocityX * 0.18;
  const threshold = Math.max(10, viewportWidth * 0.12);
  return projectedOffset < -threshold ? 1 : projectedOffset > threshold ? -1 : 0;
}

interface HorizontalPagerProps {
  activeKey: string;
  pages: HorizontalPagerPage[];
  ariaLabel?: string;
  className?: string;
  trackClassName?: string;
  motion?: HorizontalPagerMotion;
  swipeable?: boolean;
  onRequestChange?: (key: string) => void;
}

export function HorizontalPager({
  activeKey,
  pages,
  ariaLabel,
  className,
  trackClassName,
  motion: motionMode = "slide",
  swipeable = false,
  onRequestChange
}: HorizontalPagerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [viewportWidth, setViewportWidth] = useState(0);
  const activeIndex = useMemo(() => {
    const index = pages.findIndex((page) => page.key === activeKey);

    return index >= 0 ? index : 0;
  }, [activeKey, pages]);

  const pageCount = Math.max(pages.length, 1);
  const offsetPercent = (activeIndex * 100) / pageCount;
  const targetX = viewportWidth > 0 ? -activeIndex * viewportWidth : `${-offsetPercent}%`;

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateWidth = () => setViewportWidth(container.getBoundingClientRect().width);
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (!swipeable || !onRequestChange || viewportWidth <= 0) {
      return;
    }

    const direction = resolveHorizontalPagerDirection({
      offsetX: info.offset.x,
      velocityX: info.velocity.x,
      viewportWidth
    });
    const nextIndex = Math.min(pageCount - 1, Math.max(0, activeIndex + direction));

    if (nextIndex !== activeIndex) {
      onRequestChange(pages[nextIndex].key);
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn("ui-horizontal-pager", swipeable && "touch-pan-y", className)}
      style={{ overflow: "hidden", width: "100%", touchAction: swipeable ? "pan-y" : undefined }}
      aria-label={ariaLabel}
    >
      <motion.div
        className={cn("ui-horizontal-pager__track", trackClassName)}
        data-active={activeKey}
        data-motion={motionMode}
        initial={false}
        animate={{ x: motionMode === "instant" ? targetX : targetX, opacity: 1 }}
        transition={
          motionMode === "instant"
            ? { duration: 0 }
            : reduceMotion
              ? { duration: 0.16, ease: "easeOut" }
              : { type: "spring", bounce: 0, duration: 0.38 }
        }
        drag={swipeable && !reduceMotion ? "x" : false}
        dragConstraints={
          viewportWidth > 0
            ? { left: -(pageCount - 1) * viewportWidth, right: 0 }
            : undefined
        }
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{
          display: "flex",
          height: "100%",
          width: `${pageCount * 100}%`
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
      </motion.div>
    </div>
  );
}
