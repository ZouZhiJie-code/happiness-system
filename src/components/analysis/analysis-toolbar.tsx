"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AnalysisRangePreset } from "@/features/analysis/date-range";
import { analysisSectionChangeEventName } from "@/features/analysis/section-nav";
import type { AnalysisSectionKey } from "@/features/analysis/view-state";
import {
  buildAnalysisHref,
  formatAnalysisMonthLabel,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams,
  resolveAnalysisTrendsRange,
  shiftAnalysisTrendsRange
} from "@/features/analysis/view-state";
import { cn } from "@/lib/utils";

const sectionTabs: ReadonlyArray<{ key: AnalysisSectionKey; label: string }> = [
  { key: "trends", label: "量化趋势" },
  { key: "dimensions", label: "五维全景" },
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

  useEffect(() => {
    if (normalizedSearch.shouldReplace) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, normalizedSearch.shouldReplace, router]);

  useEffect(() => {
    setActiveSection(normalizedSearch.section);
  }, [normalizedSearch.section]);

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

  function navigateHref(input: {
    month?: string;
    section?: AnalysisSectionKey;
    preset?: AnalysisRangePreset;
    startDate?: string;
    endDate?: string;
  }) {
    const preset = input.preset ?? normalizedSearch.preset;

    router.replace(
      buildAnalysisHref({
        month: input.month ?? normalizedSearch.month,
        section: input.section ?? activeSection,
        preset,
        startDate: preset !== "month" ? input.startDate ?? normalizedSearch.startDate : undefined,
        endDate: preset !== "month" ? input.endDate ?? normalizedSearch.endDate : undefined
      }),
      { scroll: false }
    );
  }

  function navigateSection(section: AnalysisSectionKey) {
    setActiveSection(section);
    navigateHref({ section });
  }

  function navigatePreset(preset: AnalysisRangePreset) {
    const resolvedRange = resolveAnalysisTrendsRange({
      preset,
      month: normalizedSearch.month,
      startDate: normalizedSearch.startDate,
      endDate: normalizedSearch.endDate
    });

    navigateHref({
      preset,
      startDate: preset !== "month" ? resolvedRange.startDate : undefined,
      endDate: preset !== "month" ? resolvedRange.endDate : undefined
    });
  }

  function navigatePeriod(offset: -1 | 1) {
    const shifted = shiftAnalysisTrendsRange({
      preset: normalizedSearch.preset,
      month: normalizedSearch.month,
      startDate: normalizedSearch.startDate,
      endDate: normalizedSearch.endDate,
      offset
    });

    navigateHref({
      month: shifted.month,
      preset: shifted.preset,
      startDate: "startDate" in shifted ? shifted.startDate : undefined,
      endDate: "endDate" in shifted ? shifted.endDate : undefined
    });
  }

  const periodNavLabel =
    normalizedSearch.preset === "month"
      ? formatAnalysisMonthLabel(normalizedSearch.month)
      : normalizedSearch.preset === "week"
        ? "本周"
        : "区间";

  return (
    <div data-testid="analysis-toolbar" className="flex min-h-[var(--site-header-lane-min-height)] w-full items-center gap-1.5 overflow-hidden">
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => navigatePeriod(-1)}
          className="calendar-chip rounded-full px-2.5 py-1 text-[0.76rem] text-[#7a5e44] transition duration-200 hover:text-[#5c4229]"
          aria-label={`查看上一${periodNavLabel}`}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          onClick={() => navigatePeriod(1)}
          className="calendar-chip rounded-full px-2.5 py-1 text-[0.76rem] text-[#7a5e44] transition duration-200 hover:text-[#5c4229]"
          aria-label={`查看下一${periodNavLabel}`}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <ToolbarDivider />

      <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
        <div className="flex min-w-max items-center gap-1.5">
          {presetTabs.map((tab) => (
            <HeaderTextButton key={tab.key} active={normalizedSearch.preset === tab.key} onClick={() => navigatePreset(tab.key)}>
              {tab.label}
            </HeaderTextButton>
          ))}

          <ToolbarDivider />

          <span className="shrink-0 text-[0.76rem] text-[rgba(48,33,20,0.62)]">{normalizedSearch.rangeLabel}</span>

          {normalizedSearch.preset === "custom" ? (
            <>
              <input
                type="date"
                value={normalizedSearch.startDate}
                onChange={(event) => navigateHref({ preset: "custom", startDate: event.target.value, endDate: normalizedSearch.endDate })}
                className="shrink-0 rounded-[10px] border border-[var(--line-soft)] bg-transparent px-1.5 py-0.5 text-[0.72rem] text-[#5d4329]"
                aria-label="自定义开始日期"
              />
              <span className="text-[0.72rem] text-[rgba(48,33,20,0.45)]">—</span>
              <input
                type="date"
                value={normalizedSearch.endDate}
                onChange={(event) => navigateHref({ preset: "custom", startDate: normalizedSearch.startDate, endDate: event.target.value })}
                className="shrink-0 rounded-[10px] border border-[var(--line-soft)] bg-transparent px-1.5 py-0.5 text-[0.72rem] text-[#5d4329]"
                aria-label="自定义结束日期"
              />
            </>
          ) : null}

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
