import type { InsightsWorkspaceData } from "@/types/insights";

export const INSIGHTS_DEMO_DATA: InsightsWorkspaceData = {
  trends: {
    range: {
      preset: "month",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      timeZone: "Asia/Shanghai",
      weekStartsOn: "monday"
    },
    summary: {
      recordedDayCount: 5,
      completedRecordCount: 8,
      dailyJournalCount: 4,
      weeklyJournalCount: 1,
      monthlyJournalCount: 1
    },
    dailyActivity: Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      const date = `2026-08-${String(day).padStart(2, "0")}`;
      const recordCount = day === 3 ? 1 : day === 7 ? 2 : day === 12 ? 1 : day === 13 ? 3 : day === 18 ? 1 : 0;
      return {
        date,
        recordCount,
        journal: [3, 7, 12, 13].includes(day)
          ? {
              id: `demo-daily-${day}`,
              title: day === 13 ? "完整链路终于跑通" : `${day}日的日记`,
              status: day === 13 ? "stale" as const : "saved" as const,
              href: `/calendar?view=day&date=${date}`
            }
          : null
      };
    }),
    periodReports: [
      {
        id: "demo-weekly",
        kind: "week",
        startDate: "2026-08-10",
        endDate: "2026-08-16",
        title: "把散乱的环节连起来",
        status: "saved",
        href: "/calendar?view=week&date=2026-08-10"
      },
      {
        id: "demo-monthly",
        kind: "month",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        title: "八月回顾",
        status: "draft",
        href: "/calendar?view=month&date=2026-08-01"
      }
    ],
    legacyDimensionRecordsIncluded: false,
    happinessScoresIncluded: false
  },
  self: {
    title: "记录中的我",
    firstRecordedDate: "2026-03-18",
    latestRecordedDate: "2026-08-13",
    recordedDayCount: 28,
    completedRecordCount: 43,
    recordingSpanDays: 149,
    recentRecords: [
      { id: "demo-1", entryDate: "2026-08-13", title: "完整链路终于跑通", href: "/calendar?view=day&date=2026-08-13" },
      { id: "demo-2", entryDate: "2026-08-12", title: "找到保存失败的原因", href: "/calendar?view=day&date=2026-08-12" },
      { id: "demo-3", entryDate: "2026-08-07", title: "把页面结构重新理顺", href: "/calendar?view=day&date=2026-08-07" }
    ],
    monthlyChanges: [
      { month: "2026-03", recordCount: 3, recordedDayCount: 2, dailyJournalCount: 1, href: "/calendar?view=month&date=2026-03-01" },
      { month: "2026-04", recordCount: 6, recordedDayCount: 4, dailyJournalCount: 3, href: "/calendar?view=month&date=2026-04-01" },
      { month: "2026-05", recordCount: 5, recordedDayCount: 4, dailyJournalCount: 3, href: "/calendar?view=month&date=2026-05-01" },
      { month: "2026-06", recordCount: 8, recordedDayCount: 6, dailyJournalCount: 5, href: "/calendar?view=month&date=2026-06-01" },
      { month: "2026-07", recordCount: 13, recordedDayCount: 8, dailyJournalCount: 7, href: "/calendar?view=month&date=2026-07-01" },
      { month: "2026-08", recordCount: 8, recordedDayCount: 5, dailyJournalCount: 4, href: "/calendar?view=month&date=2026-08-01" }
    ],
    memoryAvailability: "coming_soon",
    legacyDimensionRecordsIncluded: false
  }
};
