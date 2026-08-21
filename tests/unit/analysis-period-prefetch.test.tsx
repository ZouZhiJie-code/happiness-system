import React from "react";
import { render, waitFor } from "@testing-library/react";

import { useAnalysisPeriodPrefetch } from "@/components/analysis/use-analysis-period-prefetch";
import type { AnalysisPeriodState } from "@/features/analysis/period-state";

const { mockFetchAnalysisMonthRecord, mockFetchAnalysisTrendsRange } = vi.hoisted(() => ({
  mockFetchAnalysisMonthRecord: vi.fn(),
  mockFetchAnalysisTrendsRange: vi.fn()
}));

vi.mock("@/features/analysis/month-client", () => ({
  fetchAnalysisMonthRecord: mockFetchAnalysisMonthRecord
}));

vi.mock("@/features/analysis/range-client", () => ({
  fetchAnalysisTrendsRange: mockFetchAnalysisTrendsRange
}));

function PrefetchHarness({ period, enabled = true }: { period: AnalysisPeriodState; enabled?: boolean }) {
  useAnalysisPeriodPrefetch(period, enabled);
  return null;
}

describe("analysis period prefetch", () => {
  beforeEach(() => {
    mockFetchAnalysisMonthRecord.mockReset();
    mockFetchAnalysisTrendsRange.mockReset();
  });

  it("does not repeat adjacent requests when only the period object identity changes", async () => {
    const period: AnalysisPeriodState = {
      preset: "month",
      month: "2026-05",
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    };
    const view = render(<PrefetchHarness period={period} />);

    await waitFor(() => {
      expect(mockFetchAnalysisMonthRecord).toHaveBeenCalledTimes(2);
      expect(mockFetchAnalysisTrendsRange).toHaveBeenCalledTimes(2);
    });

    view.rerender(<PrefetchHarness period={{ ...period }} />);

    expect(mockFetchAnalysisMonthRecord).toHaveBeenCalledTimes(2);
    expect(mockFetchAnalysisTrendsRange).toHaveBeenCalledTimes(2);

    view.rerender(
      <PrefetchHarness
        period={{
          preset: "month",
          month: "2026-06",
          startDate: "2026-06-01",
          endDate: "2026-06-30"
        }}
      />
    );

    await waitFor(() => {
      expect(mockFetchAnalysisMonthRecord).toHaveBeenCalledTimes(4);
      expect(mockFetchAnalysisTrendsRange).toHaveBeenCalledTimes(4);
    });
  });
});
