"use client";

import React, { useEffect, useState } from "react";

import { JournalSkeletonLines } from "@/components/interview/journal-skeleton-lines";
import {
  getJournalGenerationPhaseIndex,
  getJournalGenerationPhaseLabel
} from "@/features/interview/journal-generation-copy";
import { cn } from "@/lib/utils";

type OverlayState = "active" | "reveal" | "fade";
export type JournalGenerationOverlayMode = "dimension" | "daily";

export interface JournalGenerationOverlayProps {
  active: boolean;
  complete?: boolean;
  label: string;
  description?: string;
  progress: number;
  mode: JournalGenerationOverlayMode;
  onExited?: () => void;
}

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, progress));
}

export function JournalGenerationOverlay({
  active,
  complete = false,
  label,
  description,
  progress,
  mode,
  onExited
}: JournalGenerationOverlayProps) {
  const [mounted, setMounted] = useState(active);
  const [overlayState, setOverlayState] = useState<OverlayState>(active ? "active" : "fade");
  const exitRequestedRef = React.useRef(false);
  const normalizedProgress = clampProgress(progress);
  const phaseLabel = getJournalGenerationPhaseLabel(normalizedProgress);
  const activePhaseIndex = getJournalGenerationPhaseIndex(normalizedProgress);
  const showMark = overlayState === "active";
  const showLiveContent = overlayState === "active" && active;
  const exitDurationMs = complete ? 360 : 220;

  useEffect(() => {
    if (active) {
      exitRequestedRef.current = false;
      setMounted(true);
      setOverlayState("active");
      return;
    }

    if (!mounted) {
      return;
    }

    let exitTimer: number | null = null;

    const startExit = () => {
      setOverlayState(complete ? "reveal" : "fade");
      exitTimer = window.setTimeout(() => {
        if (exitRequestedRef.current) {
          return;
        }

        exitRequestedRef.current = true;
        setMounted(false);
        onExited?.();
      }, exitDurationMs);
    };

    startExit();

    return () => {
      if (exitTimer) {
        window.clearTimeout(exitTimer);
      }
    };
  }, [active, complete, exitDurationMs, mounted, onExited]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={cn(
        "journal-generation-overlay absolute inset-0 z-30 flex items-center justify-center overflow-hidden px-4 py-6 text-[#2f2216]",
        mode === "daily" ? "journal-generation-overlay--daily" : "journal-generation-overlay--dimension"
      )}
      data-testid="journal-generation-overlay"
      data-mode={mode}
      data-state={overlayState}
      role="status"
      aria-live="polite"
      onAnimationEnd={() => {
        if (overlayState === "active") {
          return;
        }

        if (exitRequestedRef.current) {
          return;
        }

        exitRequestedRef.current = true;
        setMounted(false);
        onExited?.();
      }}
    >
      <div className="journal-generation-overlay__grain" aria-hidden="true" />
      <div className="journal-generation-overlay__content">
        <div className="journal-generation-overlay__mark" aria-hidden="true">
          {!showMark ? null : <JournalSkeletonLines className="w-full" />}
        </div>

        {!showLiveContent ? null : (
          <React.Fragment>
            <div className="journal-generation-overlay__copy">
              <p className="journal-generation-overlay__eyebrow">日志正在整理</p>
              <h3 className="journal-generation-overlay__title">{label}</h3>
              {description ? <p className="journal-generation-overlay__description">{description}</p> : null}
            </div>

            <div className="journal-generation-overlay__meter" aria-label={`当前阶段：${phaseLabel}`}>
              {(["搭建骨架", "补充细节", "完成润色"] as const).map((item, index) => (
                <span
                  key={item}
                  className="journal-generation-overlay__phase"
                  data-state={index < activePhaseIndex ? "complete" : index === activePhaseIndex ? "active" : "upcoming"}
                >
                  <span aria-hidden="true" className="journal-generation-overlay__phase-dot" />
                  {item}
                </span>
              ))}
            </div>
          </React.Fragment>
        )}
        {overlayState === "active" ? null : (
          <div className="sr-only" aria-hidden="true">
            reveal
          </div>
        )}
      </div>
    </div>
  );
}
