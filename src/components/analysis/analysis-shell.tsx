"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import type { AnalysisMonthRecord } from "@/features/analysis/types";
import { fetchAnalysisMonthRecord } from "@/features/analysis/month-client";
import { notifyAnalysisToolbarRefresh } from "@/features/analysis/toolbar-refresh";
import {
  getAnalysisSectionElementId,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams,
  replaceAnalysisHistoryState
} from "@/features/analysis/view-state";
import { Divider, Surface } from "@/components/ui";
import { AnalysisCorrelationSection } from "./analysis-correlation-section";
import { AnalysisReviewSection } from "./analysis-review-section";
import { AnalysisEmptyBanner, AnalysisSection, SectionSkeleton } from "./analysis-shared";
import { HappinessScorePanel } from "./analysis-score-section";
import { CoverageHeatmap } from "./analysis-rhythm-section";
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
  const searchParams = useSearchParams();
  const todayMonth = getTodayAnalysisMonth();
  const normalizedSearch = normalizeAnalysisSearchParams({
    month: searchParams.get("month"),
    section: searchParams.get("section"),
    today: todayMonth
  });
  const [record, setRecord] = useState<AnalysisMonthRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useAnalysisSectionSpy({
    month: normalizedSearch.month,
    section: normalizedSearch.section
  });

  useEffect(() => {
    if (normalizedSearch.shouldReplace) {
      replaceAnalysisHistoryState(normalizedSearch.href);
    }
  }, [normalizedSearch.href, normalizedSearch.shouldReplace]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setHasFetchError(false);
    setRecord(null);

    void fetchAnalysisMonthRecord(normalizedSearch.month, { force: refreshNonce > 0 })
      .then((nextRecord) => {
        if (!cancelled) {
          setRecord(nextRecord);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasFetchError(true);
        }
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

  const handleScoreSaved = () => {
    setRefreshNonce((value) => value + 1);
    notifyAnalysisToolbarRefresh(normalizedSearch.month);
  };

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
          <AnalysisSection
            index="01"
            eyebrow="量化趋势"
            title="评分与记录趋势"
            description="先看评分走势、8 要素变化，以及本周期内的记录密度。"
            testId="analysis-trends-placeholder"
          >
            {renderSectionBody({
              hasFetchError,
              isLoading,
              record,
              children: (loadedRecord) => (
                <div className="space-y-8">
                  <HappinessScorePanel record={loadedRecord} onSaved={handleScoreSaved} />
                  <Divider />
                  <CoverageHeatmap record={loadedRecord} />
                </div>
              )
            })}
          </AnalysisSection>
        </section>

        <Divider />

        <section
          id={getAnalysisSectionElementId("dimensions")}
          data-analysis-section="dimensions"
          className={SECTION_SCROLL_CLASS}
        >
          <AnalysisSection
            index="02"
            eyebrow="五维全景"
            title="五维记录线索"
            description="按维度查看本周期内的记录频次、主题句与代表片段。"
            testId="analysis-dimensions-placeholder"
          >
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
          <AnalysisSection
            index="03"
            eyebrow="关联"
            title="评分与五维关联"
            description="解释评分变化与五维记录之间的对应关系，需手动触发生成。"
            testId="analysis-correlation-placeholder"
          >
            <AnalysisCorrelationSection />
          </AnalysisSection>
        </section>

        <Divider />

        <section
          id={getAnalysisSectionElementId("review")}
          data-analysis-section="review"
          className={SECTION_SCROLL_CLASS}
        >
          <AnalysisSection
            index="04"
            eyebrow="复盘"
            title="周期复盘"
            description="基于本周期材料，手动生成本周或本月的复盘总结。"
            testId="analysis-review-placeholder"
          >
            <AnalysisReviewSection />
          </AnalysisSection>
        </section>
      </div>
    </Surface>
  );
}
