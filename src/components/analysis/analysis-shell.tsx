"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AnalysisMonthRecord, AnalysisTrendsRangeRecord } from "@/features/analysis/types";
import { fetchAnalysisMonthRecord } from "@/features/analysis/month-client";
import { buildAnalysisPeriodState } from "@/features/analysis/period-state";
import { notifyAnalysisPeriodLoading } from "@/features/analysis/period-nav";
import { projectAnalysisTrendsRangeFromMonth } from "@/features/analysis/project-trends-range";
import { fetchAnalysisTrendsRange } from "@/features/analysis/range-client";
import {
  getAnalysisSectionElementId,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams
} from "@/features/analysis/view-state";
import { Divider, Surface } from "@/components/ui";
import { useAnalysisPeriodPrefetch } from "@/components/analysis/use-analysis-period-prefetch";
import { AnalysisCorrelationSection } from "./analysis-correlation-section";
import { AnalysisReviewSection } from "./analysis-review-section";
import { AnalysisEmptyBanner, AnalysisSection, SectionSkeleton } from "./analysis-shared";
import { AnalysisTrendsSection } from "./analysis-trends-section";
import { DimensionInsights } from "./analysis-insights-section";
import { useAnalysisSectionSpy } from "./use-analysis-section-spy";

const SECTION_SCROLL_CLASS = "scroll-mt-[var(--site-header-viewport-offset)]";

function renderSectionBody(input: {
  hasFetchError: boolean;
  isLoading: boolean;
  record: AnalysisMonthRecord | null;
  children: (record: AnalysisMonthRecord) => ReactNode;
}) {
  if (input.hasFetchError) {
    return <AnalysisEmptyBanner title="这部分暂时没打开" body="稍后再试，或者刷新页面重新拉取这个月的数据。" />;
  }

  if (input.isLoading || !input.record) {
    return <SectionSkeleton />;
  }

  return input.children(input.record);
}

export function AnalysisShell() {
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
  const activePeriod = useMemo(
    () =>
      buildAnalysisPeriodState({
        preset: normalizedSearch.preset,
        month: normalizedSearch.month,
        startDate: normalizedSearch.startDate,
        endDate: normalizedSearch.endDate
      }),
    [normalizedSearch.endDate, normalizedSearch.month, normalizedSearch.preset, normalizedSearch.startDate]
  );
  const [record, setRecord] = useState<AnalysisMonthRecord | null>(null);
  const [trendsRecord, setTrendsRecord] = useState<AnalysisTrendsRangeRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrendsLoading, setIsTrendsLoading] = useState(true);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [hasTrendsFetchError, setHasTrendsFetchError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useAnalysisSectionSpy({
    month: normalizedSearch.month,
    section: normalizedSearch.section
  });

  useAnalysisPeriodPrefetch(activePeriod, !isLoading && !isTrendsLoading && !hasFetchError && !hasTrendsFetchError);

  useEffect(() => {
    if (normalizedSearch.shouldReplace) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, normalizedSearch.shouldReplace, router]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setIsTrendsLoading(true);
    setHasFetchError(false);
    setHasTrendsFetchError(false);
    setRecord(null);
    setTrendsRecord(null);
    notifyAnalysisPeriodLoading({ loading: true, period: activePeriod });

    const rangeInput = {
      preset: normalizedSearch.preset,
      startDate: normalizedSearch.startDate,
      endDate: normalizedSearch.endDate
    };
    const force = refreshNonce > 0;

    const monthPromise = fetchAnalysisMonthRecord(normalizedSearch.month, { force });
    const rangePromise = fetchAnalysisTrendsRange({
      preset: normalizedSearch.preset,
      month: normalizedSearch.month,
      startDate: normalizedSearch.preset !== "month" ? normalizedSearch.startDate : undefined,
      endDate: normalizedSearch.preset !== "month" ? normalizedSearch.endDate : undefined,
      force
    });

    void Promise.allSettled([monthPromise, rangePromise])
      .then(([monthResult, rangeResult]) => {
        if (cancelled) {
          return;
        }

        if (monthResult.status === "fulfilled") {
          setRecord(monthResult.value);
        } else {
          setHasFetchError(true);
        }

        if (rangeResult.status === "fulfilled") {
          setTrendsRecord(rangeResult.value);
        } else if (monthResult.status === "fulfilled") {
          setTrendsRecord(projectAnalysisTrendsRangeFromMonth(monthResult.value, rangeInput));
        } else {
          setHasTrendsFetchError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setIsTrendsLoading(false);
          notifyAnalysisPeriodLoading({ loading: false, period: activePeriod });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activePeriod,
    normalizedSearch.endDate,
    normalizedSearch.month,
    normalizedSearch.preset,
    normalizedSearch.startDate,
    refreshNonce
  ]);

  return (
    <Surface
      className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10"
      data-testid="analysis-workspace"
    >
      <div className="relative z-10 mx-auto w-full max-w-[78rem] space-y-10">
        <section
          id={getAnalysisSectionElementId("trends")}
          data-analysis-section="trends"
          className={SECTION_SCROLL_CLASS}
        >
          <AnalysisSection title="评分与记录趋势" testId="analysis-trends-section">
            {hasTrendsFetchError ? (
              <AnalysisEmptyBanner title="这部分暂时没打开" body="稍后再试，或者刷新页面重新拉取这个周期的数据。" />
            ) : isTrendsLoading || !trendsRecord ? (
              <SectionSkeleton />
            ) : (
              <AnalysisTrendsSection record={trendsRecord} preset={normalizedSearch.preset} />
            )}
          </AnalysisSection>
        </section>

        <Divider />

        <section
          id={getAnalysisSectionElementId("dimensions")}
          data-analysis-section="dimensions"
          className={SECTION_SCROLL_CLASS}
        >
          <AnalysisSection title="五维记录线索" testId="analysis-dimensions-placeholder">
            {renderSectionBody({
              hasFetchError,
              isLoading,
              record,
              children: (loadedRecord) => <DimensionInsights record={loadedRecord} />
            })}
          </AnalysisSection>
        </section>

        <Divider />

        <section
          id={getAnalysisSectionElementId("correlation")}
          data-analysis-section="correlation"
          className={SECTION_SCROLL_CLASS}
        >
          <AnalysisSection title="评分与五维关联" testId="analysis-correlation-placeholder">
            <AnalysisCorrelationSection />
          </AnalysisSection>
        </section>

        <Divider />

        <section
          id={getAnalysisSectionElementId("review")}
          data-analysis-section="review"
          className={SECTION_SCROLL_CLASS}
        >
          <AnalysisSection title="周期复盘" testId="analysis-review-placeholder">
            <AnalysisReviewSection />
          </AnalysisSection>
        </section>
      </div>
    </Surface>
  );
}
