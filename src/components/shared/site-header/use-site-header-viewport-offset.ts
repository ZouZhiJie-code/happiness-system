"use client";

import { useEffect, type RefObject } from "react";

const headerViewportOffsetVarName = "--site-header-viewport-offset";
const headerViewportOffsetFallback = "4rem";

export function syncSiteHeaderViewportOffset(headerElement: HTMLElement | null) {
  if (typeof document === "undefined") {
    return;
  }

  if (!headerElement) {
    document.documentElement.style.setProperty(headerViewportOffsetVarName, headerViewportOffsetFallback);
    return;
  }

  const measuredHeight = Math.max(headerElement.offsetHeight, headerElement.getBoundingClientRect().height);

  if (measuredHeight <= 0) {
    document.documentElement.style.setProperty(headerViewportOffsetVarName, headerViewportOffsetFallback);
    return;
  }

  document.documentElement.style.setProperty(headerViewportOffsetVarName, `${Math.ceil(measuredHeight)}px`);
}

export function useSiteHeaderViewportOffset(headerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const headerElement = headerRef.current;

    syncSiteHeaderViewportOffset(headerElement);

    if (typeof window === "undefined" || typeof ResizeObserver === "undefined" || !headerElement) {
      return () => {
        syncSiteHeaderViewportOffset(null);
      };
    }

    const observer = new ResizeObserver(() => {
      syncSiteHeaderViewportOffset(headerElement);
    });

    observer.observe(headerElement);

    return () => {
      observer.disconnect();
      syncSiteHeaderViewportOffset(null);
    };
  }, [headerRef]);
}
