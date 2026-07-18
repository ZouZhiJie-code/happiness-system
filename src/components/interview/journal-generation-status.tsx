"use client";

import React from "react";

import { JournalSkeletonLines } from "@/components/interview/journal-skeleton-lines";
import {
  getJournalGenerationPhaseIndex,
  getJournalGenerationPhaseLabel
} from "@/features/interview/journal-generation-copy";
import { cn } from "@/lib/utils";

interface JournalGenerationStatusProps {
  label: string;
  description?: string;
  progress: number;
  variant?: "full" | "compact";
  className?: string;
  "data-testid"?: string;
}

export function JournalGenerationStatus({
  label,
  description,
  progress,
  variant = "full",
  className,
  "data-testid": dataTestId
}: JournalGenerationStatusProps) {
  const phaseLabel = getJournalGenerationPhaseLabel(progress);
  const activePhaseIndex = getJournalGenerationPhaseIndex(progress);
  const compact = variant === "compact";

  return (
    <section
      className={cn(
        "relative overflow-hidden border border-[rgba(166,118,69,0.16)] text-[#2f2216]",
        compact
          ? "rounded-[26px] bg-[linear-gradient(180deg,rgba(252,247,239,0.95),rgba(242,230,210,0.92))] px-4 py-4 shadow-[0_14px_32px_rgba(120,83,43,0.09)]"
          : "rounded-[30px] bg-[linear-gradient(180deg,rgba(252,248,241,0.97),rgba(239,225,197,0.95))] px-5 py-5 shadow-[0_22px_48px_rgba(120,83,43,0.12)] md:px-6 md:py-6",
        className
      )}
      data-testid={dataTestId}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-6 top-0 h-24 rounded-full bg-[radial-gradient(circle,rgba(255,250,242,0.78),transparent_72%)] opacity-80 blur-2xl" />
        <div className="journal-skeleton-sheen absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,248,238,0.75),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent,rgba(168,122,70,0.08))]" />
      </div>

      <div className={cn("relative z-10", compact ? "space-y-3" : "space-y-4")}>
        <div className={cn("flex items-start justify-between gap-3", compact ? "min-h-[2.2rem]" : "min-h-[2.5rem]")}>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#be8550] shadow-[0_0_0_5px_rgba(190,133,80,0.12)]" />
              <p className={cn("text-[#8c623b]", compact ? "text-[0.73rem] tracking-[0.14em]" : "text-[0.75rem] tracking-[0.18em]")}>
                日志正在整理
              </p>
            </div>
            <p
              className={cn(
                "mt-2 font-display leading-[1.08] text-[#2f2216]",
                compact ? "text-[1.05rem]" : "max-w-[24rem] text-[1.35rem] md:text-[1.5rem]"
              )}
            >
              {label}
            </p>
          </div>
          <div className="rounded-full border border-[rgba(171,123,72,0.18)] bg-[rgba(255,250,242,0.74)] px-3 py-1 text-[0.75rem] tracking-[0.08em] text-[#946b45]">
            {phaseLabel}
          </div>
        </div>

        <div
          className={cn(
            "relative overflow-hidden rounded-[24px] border border-[rgba(176,130,78,0.14)] bg-[linear-gradient(180deg,rgba(255,251,246,0.76),rgba(244,232,212,0.46))]",
            compact ? "px-3 py-2.5" : "px-4 py-3 md:px-5"
          )}
        >
          <div className="pointer-events-none absolute inset-x-5 top-3 h-14 rounded-full bg-[radial-gradient(circle,rgba(241,218,178,0.36),transparent_74%)] blur-xl" />
          <JournalSkeletonLines compact={compact} />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2" aria-label={`当前阶段：${phaseLabel}`}>
            {(["搭建骨架", "补充细节", "完成润色"] as const).map((item, index) => (
              <span
                key={item}
                data-state={index < activePhaseIndex ? "complete" : index === activePhaseIndex ? "active" : "upcoming"}
                className="journal-generation-step"
              >
                {item}
              </span>
            ))}
          </div>
          {description ? (
            <p className={cn("max-w-[32rem] text-[#5b4a38]", compact ? "text-[0.83rem] leading-6" : "text-sm leading-7")}>{description}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
