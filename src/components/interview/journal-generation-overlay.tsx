"use client";

import React, { useEffect, useState } from "react";

import { JournalSkeletonLines } from "@/components/interview/journal-skeleton-lines";
import { formatJournalGenerationProgress } from "@/features/interview/journal-generation-progress";
import { cn } from "@/lib/utils";

type OverlayState = "active" | "hold" | "reveal" | "fade";
export type JournalGenerationOverlayMode = "dimension" | "daily";

export interface JournalGenerationOverlayProps {
  active: boolean;
  complete?: boolean;
  label: string;
  description?: string;
  progress: number;
  mode: JournalGenerationOverlayMode;
  minVisibleMs?: number;
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
  minVisibleMs = 0,
  onExited
}: JournalGenerationOverlayProps) {
  const [mounted, setMounted] = useState(active);
  const [overlayState, setOverlayState] = useState<OverlayState>(active ? "active" : "fade");
  const exitRequestedRef = React.useRef(false);
  const activatedAtRef = React.useRef<number | null>(active ? Date.now() : null);
  const normalizedProgress = clampProgress(progress);
  const progressLabel = formatJournalGenerationProgress(normalizedProgress);
  const showMark = overlayState === "active" || overlayState === "hold";
  const showLiveContent = overlayState === "active" && active;
  const exitDurationMs = complete ? 680 : 260;

  useEffect(() => {
    if (active) {
      exitRequestedRef.current = false;
      activatedAtRef.current = Date.now();
      setMounted(true);
      setOverlayState("active");
      return;
    }

    if (!mounted) {
      return;
    }

    const elapsedMs = activatedAtRef.current ? Date.now() - activatedAtRef.current : minVisibleMs;
    const waitMs = complete ? Math.max(0, minVisibleMs - elapsedMs) : 0;
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

    if (waitMs === 0) {
      startExit();
      return () => {
        if (exitTimer) {
          window.clearTimeout(exitTimer);
        }
      };
    }

    setOverlayState("hold");
    const waitTimer = window.setTimeout(startExit, waitMs);

    return () => {
      window.clearTimeout(waitTimer);
      if (exitTimer) {
        window.clearTimeout(exitTimer);
      }
    };
  }, [active, complete, exitDurationMs, minVisibleMs, mounted, onExited]);

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
        if (overlayState === "active" || overlayState === "hold") {
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

            <div className="journal-generation-overlay__meter" aria-label={`生成进度 ${progressLabel}`}>
              <div className="journal-generation-overlay__track">
                <div className="journal-generation-overlay__bar" style={{ width: progressLabel }} />
              </div>
              <span className="journal-generation-overlay__percent">{progressLabel}</span>
            </div>
          </React.Fragment>
        )}
        {overlayState === "active" || overlayState === "hold" ? null : (
          <div className="sr-only" aria-hidden="true">
            reveal
          </div>
        )}
      </div>
    </div>
  );
}
