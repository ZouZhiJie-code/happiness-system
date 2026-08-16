const { listInsightsRangeRows, readInsightsSelfRows } = vi.hoisted(() => ({
  listInsightsRangeRows: vi.fn(),
  readInsightsSelfRows: vi.fn()
}));

vi.mock("@/server/repositories/insights.repository", () => ({
  listInsightsRangeRows,
  readInsightsSelfRows
}));

import { getInsightsSelf, getInsightsTrends } from "@/server/services/insights";

describe("insights service", () => {
  beforeEach(() => {
    listInsightsRangeRows.mockReset();
    readInsightsSelfRows.mockReset();
  });

  it("projects only event-centered records and new journals into trends", async () => {
    listInsightsRangeRows.mockResolvedValue({
      records: [
        { id: "record-1", entryDate: "2026-08-12", title: "第一件事" },
        { id: "record-2", entryDate: "2026-08-12", title: "第二件事" },
        { id: "record-3", entryDate: "2026-08-13", title: "第三件事" }
      ],
      dailyJournals: [
        { id: "daily-1", entryDate: "2026-08-12", title: "八月十二日", status: "saved" }
      ],
      periodReports: [
        {
          id: "week-1",
          kind: "week",
          startDate: "2026-08-10",
          endDate: "2026-08-16",
          title: "这一周",
          status: "draft"
        }
      ]
    });

    const result = await getInsightsTrends("user-1", { preset: "week" }, new Date("2026-08-12T17:00:00.000Z"));

    expect(listInsightsRangeRows).toHaveBeenCalledWith({
      userId: "user-1",
      startDate: "2026-08-10",
      endDate: "2026-08-16"
    });
    expect(result.summary).toEqual({
      recordedDayCount: 2,
      completedRecordCount: 3,
      dailyJournalCount: 1,
      weeklyJournalCount: 1,
      monthlyJournalCount: 0
    });
    expect(result.dailyActivity).toHaveLength(7);
    expect(result.dailyActivity.find((day) => day.date === "2026-08-12")).toEqual({
      date: "2026-08-12",
      recordCount: 2,
      journal: {
        id: "daily-1",
        title: "八月十二日",
        status: "saved",
        href: "/calendar?view=day&date=2026-08-12"
      }
    });
    expect(result.legacyDimensionRecordsIncluded).toBe(false);
    expect(result.happinessScoresIncluded).toBe(false);
  });

  it("builds a factual portrait with links back to journals", async () => {
    readInsightsSelfRows.mockResolvedValue({
      firstRecord: { id: "record-1", entryDate: "2026-03-18", title: "第一条" },
      recentRecords: [
        { id: "record-3", entryDate: "2026-08-13", title: "最近一条" },
        { id: "record-2", entryDate: "2026-08-12", title: "前一条" }
      ],
      completedRecordCount: 3,
      recordedDates: ["2026-03-18", "2026-08-12", "2026-08-13"],
      recentMonthRecords: [
        { id: "record-2", entryDate: "2026-08-12", title: "前一条" },
        { id: "record-3", entryDate: "2026-08-13", title: "最近一条" }
      ],
      recentMonthDailyJournals: [
        { id: "daily-1", entryDate: "2026-08-12", title: "八月十二日", status: "saved" }
      ]
    });

    const result = await getInsightsSelf("user-1", new Date("2026-08-12T17:00:00.000Z"));

    expect(result).toMatchObject({
      title: "记录中的我",
      firstRecordedDate: "2026-03-18",
      latestRecordedDate: "2026-08-13",
      recordedDayCount: 3,
      completedRecordCount: 3,
      recordingSpanDays: 149,
      memoryAvailability: "coming_soon",
      legacyDimensionRecordsIncluded: false
    });
    expect(result.recentRecords[0]).toEqual({
      id: "record-3",
      entryDate: "2026-08-13",
      title: "最近一条",
      href: "/calendar?view=day&date=2026-08-13"
    });
    expect(result.monthlyChanges.at(-1)).toMatchObject({
      month: "2026-08",
      recordCount: 2,
      recordedDayCount: 2,
      dailyJournalCount: 1,
      href: "/calendar?view=month&date=2026-08-01"
    });
  });
});
