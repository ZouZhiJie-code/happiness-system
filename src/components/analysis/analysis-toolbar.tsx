"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  buildAnalysisHref,
  formatAnalysisMonthLabel,
  getTodayAnalysisMonth,
  normalizeAnalysisSearchParams,
  shiftAnalysisMonth
} from "@/features/analysis/view-state";

function ToolbarDivider() {
  return (
    <span aria-hidden="true" className="shrink-0 select-none font-mono text-[1rem] font-semibold text-[rgba(101,67,34,0.58)]">
      ｜
    </span>
  );
}

export function AnalysisToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayMonth = getTodayAnalysisMonth();
  const normalizedSearch = normalizeAnalysisSearchParams({
    month: searchParams.get("month"),
    today: todayMonth
  });

  useEffect(() => {
    const currentHref = `/analysis?month=${searchParams.get("month") ?? ""}`;

    if (currentHref !== normalizedSearch.href) {
      router.replace(normalizedSearch.href, { scroll: false });
    }
  }, [normalizedSearch.href, router, searchParams]);

  function navigate(month: string) {
    router.replace(buildAnalysisHref({ month }), { scroll: false });
  }

  return (
    <div
      data-testid="analysis-toolbar"
      className="flex min-h-[var(--site-header-lane-min-height)] w-full items-center gap-1.5 overflow-hidden"
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => navigate(shiftAnalysisMonth(normalizedSearch.month, -1))}
          className="calendar-chip rounded-full px-2.5 py-1 text-[0.76rem] text-[#7a5e44] transition duration-200 hover:text-[#5c4229]"
          aria-label="查看上月分析"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(shiftAnalysisMonth(normalizedSearch.month, 1))}
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
          <span className="calendar-summary-chip shrink-0 rounded-full px-2.5 py-1">
            <span className="text-[0.65rem] text-[#8b6c4d]">记录分析</span>
          </span>
        </div>
      </div>

      <ToolbarDivider />

      <button
        type="button"
        onClick={() => navigate(todayMonth)}
        className="calendar-chip shrink-0 rounded-full px-3 py-1 text-[0.74rem] font-medium text-[#5d4329] transition duration-200 hover:text-[#34271c]"
        aria-label="回到本月分析"
      >
        本月
      </button>
    </div>
  );
}
