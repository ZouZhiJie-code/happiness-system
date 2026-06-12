"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAnalysisChrome } from "@/components/analysis/analysis-chrome-context";
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
import type { AnalysisSectionKey } from "@/features/analysis/view-state";
import {
  buildAnalysisHref,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams,
  shiftAnalysisTrendsRange
} from "@/features/analysis/view-state";
import { prefetchAnalysisPeriodByOffset } from "@/components/analysis/use-analysis-period-prefetch";
import { HeaderToolbarPeriodStepper } from "@/components/shared/header-toolbar-nav";
import {
  HeaderPeriodDisplay,
  HeaderPeriodInputFrame,
  HeaderToolbarDivider
} from "@/components/shared/header-toolbar-primitives";
import { SlidingSegmentedControl } from "@/components/ui";
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

export function AnalysisToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSection, setActiveSection, isPeriodLoading, setPeriodLoading } = useAnalysisChrome();
  const todayMonth = getTodayAnalysisMonth();
  const normalizedSearch = normalizeAnalysisSearchParams({
    month: searchParams.get("month"),
    section: searchParams.get("section"),
    preset: searchParams.get("preset"),
    startDate: searchParams.get("start"),
    endDate: searchParams.get("end"),
    today: todayMonth
  });
  const [optimisticPeriod, setOptimisticPeriod] = useState<AnalysisPeriodState | null>(null);
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
    if (optimisticPeriod && periodStatesEqual(optimisticPeriod, resolvedPeriod)) {
      setOptimisticPeriod(null);
    }
  }, [optimisticPeriod, resolvedPeriod]);

  useEffect(() => {
    if (!isPeriodLoading) {
      setPressedDirection(null);
    }
  }, [isPeriodLoading]);

  function applyOptimisticPeriodNavigation(
    nextPeriod: AnalysisPeriodState,
    direction?: "previous" | "next"
  ) {
    setOptimisticPeriod(nextPeriod);
    setPeriodLoading(true);
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
      <div className="header-ws-template flex w-full min-w-0 items-center gap-1.5">
        <div className="header-ws-slot header-ws-slot--time flex shrink-0 items-center gap-1.5">
          <SlidingSegmentedControl
            variant="calendar"
            ariaLabel="分析周期"
            value={activePeriod.preset}
            onChange={navigatePreset}
            items={presetTabs.map((tab) => ({
              value: tab.key,
              label: tab.label,
              ariaLabel: tab.label,
              buttonProps: {
                "aria-current": activePeriod.preset === tab.key ? ("page" as const) : undefined
              }
            }))}
          />

          <HeaderToolbarDivider />

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
              <HeaderPeriodInputFrame>
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
                  className="header-text-period-input shrink-0"
                  aria-label="自定义开始日期"
                />
                <span className="header-text-period-separator">—</span>
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
                  className="header-text-period-input shrink-0"
                  aria-label="自定义结束日期"
                />
              </HeaderPeriodInputFrame>
            ) : (
              <HeaderPeriodDisplay testId="analysis-period-display">{periodDisplayLabel}</HeaderPeriodDisplay>
            )}
          </HeaderToolbarPeriodStepper>

        </div>
        <HeaderToolbarDivider />
        <div className="header-ws-slot header-ws-slot--context min-w-0 flex-1 overflow-x-auto pb-0.5">
          <div className="flex min-w-max items-center gap-1.5">
            {sectionTabs.map((tab) => {
              const active = tab.key === activeSection;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => navigateSection(tab.key)}
                  className={cn(
                    "header-text-tab shrink-0 px-1.5 py-1 transition duration-200 hover:text-[#2f2823]",
                    active && "header-text-tab--active"
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
    </div>
  );
}
