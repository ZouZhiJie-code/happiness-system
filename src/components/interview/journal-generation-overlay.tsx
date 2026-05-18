"use client";

import React, { useEffect, useMemo, useState } from "react";
import Lottie from "lottie-react";

import {
  resolveGenerationAnimation,
  type GenerationAnimationId,
  type GenerationAnimationMode
} from "@/components/interview/generation-animation-catalog";
import { JournalGrowthTree } from "@/components/interview/journal-growth-tree";
import { cn } from "@/lib/utils";

type OverlayState = "active" | "hold" | "reveal" | "fade";

export interface JournalGenerationOverlayProps {
  active: boolean;
  complete?: boolean;
  label: string;
  description?: string;
  progress: number;
  mode: GenerationAnimationMode;
  animationId?: GenerationAnimationId;
  minVisibleMs?: number;
  onExited?: () => void;
}

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, progress));
}

function formatProgress(progress: number) {
  return `${Math.round(clampProgress(progress))}%`;
}

export function JournalGenerationOverlay({
  active,
  complete = false,
  label,
  description,
  progress,
  mode,
  animationId,
  minVisibleMs = 0,
  onExited
}: JournalGenerationOverlayProps) {
  const [mounted, setMounted] = useState(active);
  const [overlayState, setOverlayState] = useState<OverlayState>(active ? "active" : "fade");
  const [lottieReady, setLottieReady] = useState(false);
  const [lottieFailed, setLottieFailed] = useState(false);
  const exitRequestedRef = React.useRef(false);
  const activatedAtRef = React.useRef<number | null>(active ? Date.now() : null);
  const normalizedProgress = clampProgress(progress);
  const progressLabel = formatProgress(normalizedProgress);
  const showMark = overlayState === "active" || overlayState === "hold";
  const showLiveContent = overlayState === "active" && active;
  const showFallbackTree = showMark && (!lottieReady || lottieFailed);
  const exitDurationMs = complete ? 680 : 260;
  const selectedAnimation = resolveGenerationAnimation({ mode, id: animationId });
  const lottieStyle = useMemo(
    () => ({
      height: "100%",
      width: "100%"
    }),
    []
  );

  useEffect(() => {
    if (active) {
      exitRequestedRef.current = false;
      activatedAtRef.current = Date.now();
      setLottieReady(false);
      setLottieFailed(false);
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

  useEffect(() => {
    if (!showMark || lottieReady || lottieFailed) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLottieFailed(true);
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [lottieReady, lottieFailed, showMark, selectedAnimation.id]);

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
      data-animation-id={selectedAnimation.id}
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
          {!showMark ? null : (
            <React.Fragment>
              {showFallbackTree ? (
                <JournalGrowthTree progress={normalizedProgress} className="h-full w-full" />
              ) : null}
              {!lottieFailed ? (
                <div className="pointer-events-none absolute inset-0 opacity-90">
                  <Lottie
                    key={selectedAnimation.id}
                    animationData={selectedAnimation.animationData}
                    autoplay
                    loop
                    style={lottieStyle}
                    rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
                    data-testid="journal-generation-lottie"
                    onDataReady={() => setLottieReady(true)}
                    onDOMLoaded={() => setLottieReady(true)}
                    onDataFailed={() => setLottieFailed(true)}
                  />
                </div>
              ) : null}
            </React.Fragment>
          )}
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
