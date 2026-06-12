"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AnalysisRangePreset } from "@/features/analysis/date-range";
import { getAnalysisPeriodLoadingLabel } from "@/features/analysis/accessibility";
import {
  buildAnalysisPeriodState,
  buildAnalysisPeriodStateFromShift,
  periodStatesEqual,
  resolvePeriodDisplayLabel,
  resolvePeriodNavLabel,
  type AnalysisPeriodState
} from "@/features/analysis/period-state";
import { subscribeAnalysisPeriodLoading } from "@/features/analysis/period-nav";
import { analysisSectionChangeEventName } from "@/features/analysis/section-nav";
import type { AnalysisSectionKey } from "@/features/analysis/view-state";
import {
  buildAnalysisHref,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams,
  shiftAnalysisTrendsRange
} from "@/features/analysis/view-state";
import { prefetchAnalysisPeriodByOffset } from "@/components/analysis/use-analysis-period-prefetch";
import { HeaderToolbarPeriodStepper } from "@/components/shared/header-toolbar-nav";
import { cn } from "@/lib/utils";

const sectionTabs: ReadonlyArray<{ key: AnalysisSectionKey; label: string }> = [
  { key: "trends", label: "量化趋势" },
  { key: "dimensions", label: "五维记录" },
  { key: "correlation", label: "关联" },
  { key: "review", label: "复盘" }
];

const presetTabs: ReadonlyArray<{ key: AnalysisRangePreset; label: string }> = [
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "custom", label: "自定义" }
];

function ToolbarDivider() {
  return (
    <span aria-hidden="true" className="shrink-0 select-none font-mono text-[1rem] font-semibold text-[rgba(101,67,34,0.58)]">
      ｜
    </span>
  );
}

function HeaderTextButton({
  active,
  children,
  onClick,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 border-none bg-transparent px-1.5 py-1 text-[0.78rem] text-[rgba(74,64,56,0.82)] transition hover:text-[#2f2823]",
        active && "font-semibold text-[#2f2823] underline decoration-[#8a5527] decoration-2 underline-offset-4",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function AnalysisToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayMonth = getTodayAnalysisMonth();
  const normalizedSearch = normalizeAnalysisSearchParams({
    month: searchParams.get("month"),
    section: searchParams.get("section"),
    preset: searchParams.get("preset"),
    startDate: searchParams.get("start"),
    endDate: searchParams.get("end"),
    today: todayMonth
  });
  const [activeSection, setActiveSection] = useState<AnalysisSectionKey>(normalizedSearch.section);
  const [optimisticPeriod, setOptimisticPeriod] = useState<AnalysisPeriodState | null>(null);
  const [isPeriodLoading, setIsPeriodLoading] = useState(false);
  const [pressedDirection, setPressedDirection] = useState<"previous" | "next" | null>(null);

  const resolvedPeriod = useMemo(
    () =>
      buildAnalysisPeriodState({
        preset: normalizedSearch.preset,
        month: normalizedSearch.month,
        startDate: normalizedSearch.startDate,
        endDate: normalizedSearch.endDate
      }),
    [normalizedSearch.endDate, normalizedSearch.month, normalizedSearch.preset, normalizedSearch.startDate]
  );

  const activePeriod = optimisticPeriod ?? resolvedPeriod;

  useEffect(() => {
    if (normalizedSearch.shouldReplace) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, normalizedSearch.shouldReplace, router]);

  useEffect(() => {
    setActiveSection(normalizedSearch.section);
  }, [normalizedSearch.section]);

  useEffect(() => {
    if (optimisticPeriod && periodStatesEqual(optimisticPeriod, resolvedPeriod)) {
      setOptimisticPeriod(null);
    }
  }, [optimisticPeriod, resolvedPeriod]);

  useEffect(() => {
    return subscribeAnalysisPeriodLoading((detail) => {
      if (!detail.loading) {
        setIsPeriodLoading(false);
        setPressedDirection(null);
      }
    });
  }, []);

  useEffect(() => {
    const handleSectionChange = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as { section?: AnalysisSectionKey } | null) : null;

      if (detail?.section) {
        setActiveSection(detail.section);
      }
    };

    window.addEventListener(analysisSectionChangeEventName, handleSectionChange);

    return () => {
      window.removeEventListener(analysisSectionChangeEventName, handleSectionChange);
    };
  }, []);

  function applyOptimisticPeriodNavigation(
    nextPeriod: AnalysisPeriodState,
    direction?: "previous" | "next"
  ) {
    setOptimisticPeriod(nextPeriod);
    setIsPeriodLoading(true);
    setPressedDirection(direction ?? null);

    router.replace(
      buildAnalysisHref({
        month: nextPeriod.month,
        section: activeSection,
        preset: nextPeriod.preset,
        startDate: nextPeriod.preset !== "month" ? nextPeriod.startDate : undefined,
        endDate: nextPeriod.preset !== "month" ? nextPeriod.endDate : undefined
      }),
      { scroll: false }
    );
  }

  function navigateHref(input: {
    month?: string;
    section?: AnalysisSectionKey;
    preset?: AnalysisRangePreset;
    startDate?: string;
    endDate?: string;
    optimistic?: boolean;
  }) {
    const preset = input.preset ?? activePeriod.preset;
    const month = input.month ?? activePeriod.month;
    const startDate = input.startDate ?? activePeriod.startDate;
    const endDate = input.endDate ?? activePeriod.endDate;

    if (input.optimistic) {
      applyOptimisticPeriodNavigation(
        buildAnalysisPeriodState({
          preset,
          month,
          startDate,
          endDate
        })
      );
      return;
    }

    router.replace(
      buildAnalysisHref({
        month,
        section: input.section ?? activeSection,
        preset,
        startDate: preset !== "month" ? startDate : undefined,
        endDate: preset !== "month" ? endDate : undefined
      }),
      { scroll: false }
    );
  }

  function navigateSection(section: AnalysisSectionKey) {
    setActiveSection(section);
    navigateHref({ section });
  }

  function navigatePreset(preset: AnalysisRangePreset) {
    const nextPeriod = buildAnalysisPeriodState({
      preset,
      month: activePeriod.month,
      ...(preset === "custom"
        ? {
            startDate: activePeriod.startDate,
            endDate: activePeriod.endDate
          }
        : {})
    });

    applyOptimisticPeriodNavigation(nextPeriod);
  }

  function navigatePeriod(offset: -1 | 1) {
    const shifted = shiftAnalysisTrendsRange({
      preset: activePeriod.preset,
      month: activePeriod.month,
      startDate: activePeriod.startDate,
      endDate: activePeriod.endDate,
      offset
    });

    applyOptimisticPeriodNavigation(buildAnalysisPeriodStateFromShift(shifted), offset === -1 ? "previous" : "next");
  }

  function prefetchAdjacent(direction: -1 | 1) {
    prefetchAnalysisPeriodByOffset(activePeriod, direction);
  }

  const periodNavLabel = resolvePeriodNavLabel(activePeriod);
  const periodDisplayLabel = resolvePeriodDisplayLabel(activePeriod);
  const periodLoadingLabel = isPeriodLoading ? getAnalysisPeriodLoadingLabel(activePeriod.preset) : null;

  return (
    <div data-testid="analysis-toolbar" className="flex min-h-[var(--site-header-lane-min-height)] w-full items-center gap-1.5 overflow-hidden">
      <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
        <div className="flex min-w-max items-center gap-1.5">
          {presetTabs.map((tab) => (
            <HeaderTextButton key={tab.key} active={activePeriod.preset === tab.key} onClick={() => navigatePreset(tab.key)}>
              {tab.label}
            </HeaderTextButton>
          ))}

          <ToolbarDivider />

          <HeaderToolbarPeriodStepper
            testId="analysis-period-stepper"
            busy={isPeriodLoading}
            pressedDirection={pressedDirection}
            statusLabel={periodLoadingLabel}
            previousLabel={`查看上一${periodNavLabel}`}
            nextLabel={`查看下一${periodNavLabel}`}
            onPrevious={() => navigatePeriod(-1)}
            onNext={() => navigatePeriod(1)}
            onPrefetchPrevious={() => prefetchAdjacent(-1)}
            onPrefetchNext={() => prefetchAdjacent(1)}
          >
            {activePeriod.preset === "custom" ? (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={activePeriod.startDate}
                  onChange={(event) =>
                    navigateHref({
                      preset: "custom",
                      startDate: event.target.value,
                      endDate: activePeriod.endDate,
                      optimistic: true
                    })
                  }
                  className="shrink-0 rounded-[10px] border border-[var(--line-soft)] bg-transparent px-1.5 py-0.5 text-[0.72rem] text-[#5d4329]"
                  aria-label="自定义开始日期"
                />
                <span className="text-[0.72rem] text-[rgba(48,33,20,0.45)]">—</span>
                <input
                  type="date"
                  value={activePeriod.endDate}
                  onChange={(event) =>
                    navigateHref({
                      preset: "custom",
                      startDate: activePeriod.startDate,
                      endDate: event.target.value,
                      optimistic: true
                    })
                  }
                  className="shrink-0 rounded-[10px] border border-[var(--line-soft)] bg-transparent px-1.5 py-0.5 text-[0.72rem] text-[#5d4329]"
                  aria-label="自定义结束日期"
                />
              </div>
            ) : (
              <span
                data-testid="analysis-period-display"
                className="shrink-0 whitespace-nowrap text-[0.76rem] font-medium tabular-nums text-[rgba(48,33,20,0.72)]"
              >
                {periodDisplayLabel}
              </span>
            )}
          </HeaderToolbarPeriodStepper>

          <ToolbarDivider />

          {sectionTabs.map((tab) => {
            const active = tab.key === activeSection;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigateSection(tab.key)}
                className={cn(
                  "shrink-0 px-1.5 py-1 text-[0.78rem] transition duration-200",
                  active
                    ? "font-semibold text-[#2f2823] underline decoration-[#8a5527] decoration-2 underline-offset-4"
                    : "text-[rgba(74,64,56,0.82)] hover:text-[#2f2823]"
                )}
                aria-pressed={active}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
