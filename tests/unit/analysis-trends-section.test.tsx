import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { AnalysisTrendsSection } from "@/components/analysis/analysis-trends-section";
import type { AnalysisTrendsRangeRecord } from "@/features/analysis/types";

function buildRecord(): AnalysisTrendsRangeRecord {
  return {
    preset: "month",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    logOverview: {
      recordedDayCount: 2,
      savedEntryCount: 3,
      dailyJournalSavedDayCount: 0
    },
    dailyCoverage: [
      {
        date: "2026-05-01",
        savedEntryCount: 0,
        savedDimensionCount: 0,
        savedDimensions: [],
        hasDailyJournalSaved: false,
        hasStaleDailyJournal: false,
        hasScore: false,
        averageScore: null,
        journalTitle: null,
        contentPreview: null
      },
      {
        date: "2026-05-02",
        savedEntryCount: 2,
        savedDimensionCount: 2,
        savedDimensions: ["joy", "reflection"],
        hasDailyJournalSaved: false,
        hasStaleDailyJournal: false,
        hasScore: true,
        averageScore: 7.2,
        journalTitle: null,
        contentPreview: null
      },
      {
        date: "2026-05-03",
        savedEntryCount: 1,
        savedDimensionCount: 1,
        savedDimensions: ["joy"],
        hasDailyJournalSaved: false,
        hasStaleDailyJournal: false,
        hasScore: true,
        averageScore: 7.1,
        journalTitle: null,
        contentPreview: null
      }
    ],
    scoreOverview: {
      scoredDayCount: 2,
      monthAverageScore: 7.2,
      latestScoredDate: "2026-05-03"
    },
    scoreTrend: {
      days: [],
      factorAverages: {
        meaning: 7,
        health: 6,
        virtue: 7,
        autonomy: 8,
        interest: 6,
        skill: 7,
        relationship: 8,
        livingCondition: 7
      }
    }
  };
}

describe("AnalysisTrendsSection eight-factor toggle", () => {
  it("switches between radar and lollipop views with a horizontal pager", () => {
    render(<AnalysisTrendsSection record={buildRecord()} preset="month" />);

    const toggleGroup = screen.getByRole("group", { name: "幸福8要素图表样式" });
    const pager = screen.getByLabelText("幸福8要素图表视图");

    expect(within(toggleGroup).getByRole("button", { name: "雷达图" })).toHaveAttribute("aria-pressed", "true");
    expect(pager.querySelector(".ui-horizontal-pager__track")).toHaveAttribute("data-active", "radar");
    expect(pager.querySelector("svg")).toBeInTheDocument();

    fireEvent.click(within(toggleGroup).getByRole("button", { name: "棒棒糖" }));

    expect(within(toggleGroup).getByRole("button", { name: "棒棒糖" })).toHaveAttribute("aria-pressed", "true");
    expect(pager.querySelector(".ui-horizontal-pager__track")).toHaveAttribute("data-active", "lollipop");
    expect(within(pager).getAllByText("7.0").length).toBeGreaterThan(0);
  });
});
