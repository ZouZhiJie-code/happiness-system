"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AnalysisMonthRecord } from "@/features/analysis/types";
import { fetchAnalysisMonthRecord } from "@/features/analysis/month-client";
import { analysisToolbarRefreshEventName } from "@/features/analysis/toolbar-refresh";
import type { AnalysisSectionKey } from "@/features/analysis/view-state";
import {
  buildAnalysisHref,
  formatAnalysisMonthLabel,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams,
  replaceAnalysisHistoryState,
  shiftAnalysisMonth
} from "@/features/analysis/view-state";
import { getInterviewDimensionMeta } from "@/features/interview/dimensions";

const sectionTabs: ReadonlyArray<{ key: AnalysisSectionKey; label: string }> = [
  { key: "overview", label: "总览" },
  { key: "score", label: "评分" },
  { key: "rhythm", label: "节奏" },
  { key: "insights", label: "五维" }
];

function ToolbarDivider() {
  return (
    <span aria-hidden="true" className="shrink-0 select-none font-mono text-[1rem] font-semibold text-[rgba(101,67,34,0.58)]">
      ｜
    </span>
  );
}

function getChip(
  key: AnalysisSectionKey,
  record: AnalysisMonthRecord | null
): { text: string; dotClass: string | null } | null {
  if (!record) return null;

  if (key === "score") {
    const scoredDayCount = record.scoreOverview.scoredDayCount;
    if (scoredDayCount === 0) return { text: "暂无评分", dotClass: "bg-[#9a8a78]" };
    if (scoredDayCount === 1) return { text: "1天评分", dotClass: "bg-[#8e6a41]" };
    return { text: `${scoredDayCount}天评分`, dotClass: "bg-[#5a7a56]" };
  }

  if (key === "rhythm") {
    if (record.rhythmOverview.pendingDailyJournalCount > 0) {
      return { text: `待整合 ${record.rhythmOverview.pendingDailyJournalCount} 天`, dotClass: "bg-[#8e5638]" };
    }

    if (record.rhythmOverview.scoreOnlyDayCount > 0) {
      return { text: `待成文 ${record.rhythmOverview.scoreOnlyDayCount} 天`, dotClass: "bg-[#74927a]" };
    }

    return record.rhythmOverview.activeObservedDayCount > 0
      ? { text: `${record.rhythmOverview.activeObservedDayCount}天有材料`, dotClass: null }
      : null;
  }

  if (key === "insights") {
    const featuredDimension =
      record.insightsOverview.featuredDimension ??
      record.dimensionBreakdown
        .filter((d) => d.savedEntryCount > 0)
        .sort((a, b) => b.savedEntryCount - a.savedEntryCount || b.recordedDayCount - a.recordedDayCount)[0]?.dimension;
    return featuredDimension
      ? { text: getInterviewDimensionMeta(featuredDimension as Parameters<typeof getInterviewDimensionMeta>[0]).label, dotClass: null }
      : null;
  }

  return null;
}

export function AnalysisToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayMonth = getTodayAnalysisMonth();
  const normalizedSearch = normalizeAnalysisSearchParams({
    month: searchParams.get("month"),
    section: searchParams.get("section"),
    today: todayMonth
  });

  const [record, setRecord] = useState<AnalysisMonthRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (normalizedSearch.shouldReplace) {
      replaceAnalysisHistoryState(normalizedSearch.href);
    }
  }, [normalizedSearch.href, normalizedSearch.shouldReplace]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setRecord(null);

    fetchAnalysisMonthRecord(normalizedSearch.month)
      .then((nextRecord) => {
        if (!cancelled) {
          setRecord(nextRecord);
        }
      })
      .catch(() => {
        // Chips won't render — acceptable degradation
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSearch.month, refreshNonce]);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as { month?: string } | null) : null;

      if (detail?.month !== normalizedSearch.month) {
        return;
      }

      setRefreshNonce((current) => current + 1);
    };

    window.addEventListener(analysisToolbarRefreshEventName, handleRefresh);

    return () => {
      window.removeEventListener(analysisToolbarRefreshEventName, handleRefresh);
    };
  }, [normalizedSearch.month]);

  const chips = useMemo(() => {
    if (!record) return {};
    return Object.fromEntries(
      sectionTabs.map((tab) => [tab.key, getChip(tab.key, record)])
    ) as Partial<Record<AnalysisSectionKey, ReturnType<typeof getChip>>>;
  }, [record]);

  function navigateMonth(month: string) {
    router.replace(buildAnalysisHref({ month, section: normalizedSearch.section }), { scroll: false });
  }

  function navigateSection(section: AnalysisSectionKey) {
    router.replace(buildAnalysisHref({ month: normalizedSearch.month, section }), { scroll: false });
  }

  return (
    <div
      data-testid="analysis-toolbar"
      aria-busy={isLoading ? "true" : "false"}
      className="flex min-h-[var(--site-header-lane-min-height)] w-full items-center gap-1.5 overflow-hidden"
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => navigateMonth(shiftAnalysisMonth(normalizedSearch.month, -1))}
          className="calendar-chip rounded-full px-2.5 py-1 text-[0.76rem] text-[#7a5e44] transition duration-200 hover:text-[#5c4229]"
          aria-label="查看上月分析"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          onClick={() => navigateMonth(shiftAnalysisMonth(normalizedSearch.month, 1))}
          className="calendar-chip rounded-full px-2.5 py-1 text-[0.76rem] text-[#7a5e44] transition duration-200 hover:text-[#5c4229]"
          aria-label="查看下月分析"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <ToolbarDivider />

      <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
        <div className="flex min-w-max items-center gap-2">
          <p className="shrink-0 text-[0.95rem] font-medium text-[#34271c] md:text-[1rem]">
            {formatAnalysisMonthLabel(normalizedSearch.month)}
          </p>

          {sectionTabs.map((tab) => {
            const active = tab.key === normalizedSearch.section;
            const chip = chips[tab.key] ?? null;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigateSection(tab.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[0.76rem] transition duration-200 ${
                  active
                    ? "bg-[#6f4a26] text-[#fffaf1] shadow-sm"
                    : "calendar-chip text-[#6b533d] hover:bg-[rgba(255,251,244,0.96)]"
                }`}
                aria-pressed={active}
              >
                {tab.label}
                {chip ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.62rem] ${
                    active ? "bg-[rgba(255,250,241,0.2)] text-[rgba(255,250,241,0.88)]" : "bg-[rgba(111,74,38,0.08)] text-[#8b6c4d]"
                  }`}>
                    {chip.dotClass ? <span className={`size-1.5 rounded-full ${chip.dotClass}`} /> : null}
                    {chip.text}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <ToolbarDivider />

      <button
        type="button"
        onClick={() => navigateMonth(todayMonth)}
        className="calendar-chip shrink-0 rounded-full px-3 py-1 text-[0.74rem] font-medium text-[#5d4329] transition duration-200 hover:text-[#34271c]"
        aria-label="回到本月分析"
      >
        本月
      </button>
    </div>
  );
}
