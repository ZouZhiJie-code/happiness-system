"use client";

import { useEffect, useRef } from "react";

import { analysisSectionChangeEventName, replaceAnalysisSectionInUrl } from "@/features/analysis/section-nav";
import {
  ANALYSIS_SECTION_KEYS,
  getAnalysisSectionElementId,
  type AnalysisSectionKey
} from "@/features/analysis/view-state";

const SCROLL_LOCK_MS = 900;

function readHeaderOffsetPx() {
  if (typeof window === "undefined") {
    return 64;
  }

  const raw = getComputedStyle(document.documentElement).getPropertyValue("--site-header-viewport-offset").trim();
  const parsed = Number.parseFloat(raw);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 64;
}

function scrollSectionIntoView(element: HTMLElement, behavior: ScrollBehavior) {
  element.scrollIntoView?.({ behavior, block: "start" });
}

export function useAnalysisSectionSpy(input: { month: string; section: AnalysisSectionKey }) {
  const scrollLockRef = useRef(false);
  const scrollLockTimerRef = useRef<number | null>(null);
  const lastSectionRef = useRef(input.section);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    const element = document.getElementById(getAnalysisSectionElementId(input.section));

    if (!element) {
      return;
    }

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      lastSectionRef.current = input.section;

      if (input.section !== "trends") {
        requestAnimationFrame(() => {
          scrollSectionIntoView(element, "auto");
        });
      }

      return;
    }

    if (lastSectionRef.current === input.section) {
      return;
    }

    lastSectionRef.current = input.section;
    scrollLockRef.current = true;

    if (scrollLockTimerRef.current) {
      window.clearTimeout(scrollLockTimerRef.current);
    }

    scrollSectionIntoView(element, "smooth");

    scrollLockTimerRef.current = window.setTimeout(() => {
      scrollLockRef.current = false;
    }, SCROLL_LOCK_MS);
  }, [input.section]);

  useEffect(() => {
    const headerOffset = readHeaderOffsetPx();
    const sections = ANALYSIS_SECTION_KEYS.flatMap((key) => {
      const element = document.getElementById(getAnalysisSectionElementId(key));

      return element ? [{ key, element }] : [];
    });

    if (sections.length === 0) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLockRef.current) {
          return;
        }

        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

        const topEntry = visibleEntries[0];

        if (!topEntry) {
          return;
        }

        const nextSection = topEntry.target.getAttribute("data-analysis-section") as AnalysisSectionKey | null;

        if (!nextSection || nextSection === lastSectionRef.current) {
          return;
        }

        lastSectionRef.current = nextSection;
        replaceAnalysisSectionInUrl(input.month, nextSection);
      },
      {
        root: null,
        rootMargin: `-${headerOffset + 12}px 0px -58% 0px`,
        threshold: [0, 0.12, 0.3, 0.5]
      }
    );

    sections.forEach(({ element }) => observer.observe(element));

    return () => observer.disconnect();
  }, [input.month]);

  useEffect(() => {
    const handleExternalSectionChange = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as { section?: AnalysisSectionKey } | null) : null;

      if (detail?.section) {
        lastSectionRef.current = detail.section;
      }
    };

    window.addEventListener(analysisSectionChangeEventName, handleExternalSectionChange);

    return () => {
      window.removeEventListener(analysisSectionChangeEventName, handleExternalSectionChange);

      if (scrollLockTimerRef.current) {
        window.clearTimeout(scrollLockTimerRef.current);
      }
    };
  }, []);
}
