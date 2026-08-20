const {
  journalEventEntryFindMany,
  journalEventEntryFindFirst,
  journalEventEntryCount,
  journalEventFindMany,
  journalDailyEntryFindMany,
  journalDailyEntryGenerationFindMany,
  journalPeriodReportFindMany,
  getJournalPeriodReportViewForRange
} = vi.hoisted(() => ({
  journalEventEntryFindMany: vi.fn(),
  journalEventEntryFindFirst: vi.fn(),
  journalEventEntryCount: vi.fn(),
  journalEventFindMany: vi.fn(),
  journalDailyEntryFindMany: vi.fn(),
  journalDailyEntryGenerationFindMany: vi.fn(),
  journalPeriodReportFindMany: vi.fn(),
  getJournalPeriodReportViewForRange: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    journalEventEntry: {
      findMany: journalEventEntryFindMany,
      findFirst: journalEventEntryFindFirst,
      count: journalEventEntryCount
    },
    journalEvent: { findMany: journalEventFindMany },
    journalDailyEntry: { findMany: journalDailyEntryFindMany },
    journalDailyEntryGeneration: { findMany: journalDailyEntryGenerationFindMany },
    journalPeriodReport: { findMany: journalPeriodReportFindMany }
  }
}));

vi.mock("@/server/repositories/journal-period-report.repository", () => ({
  getJournalPeriodReportViewForRange
}));

import {
  listInsightsRangeRows,
  readInsightsSelfRows
} from "@/server/repositories/insights.repository";

describe("insights repository", () => {
  beforeEach(() => {
    [
      journalEventEntryFindMany,
      journalEventEntryFindFirst,
      journalEventEntryCount,
      journalEventFindMany,
      journalDailyEntryFindMany,
      journalDailyEntryGenerationFindMany,
      journalPeriodReportFindMany,
      getJournalPeriodReportViewForRange
    ].forEach((mock) => mock.mockReset());
  });

  it("reads only the new event and report tables for trends", async () => {
    journalEventEntryFindMany.mockResolvedValue([
      {
        id: "record-1",
        title: "一件事",
        contentRevision: 1,
        event: { entryDate: new Date("2026-08-11T16:00:00.000Z"), daySequence: 1 }
      }
    ]);
    journalDailyEntryFindMany.mockResolvedValue([
      {
        id: "daily-1",
        entryDate: new Date("2026-08-11T16:00:00.000Z"),
        title: "当天日记",
        status: "saved",
        sourceSignature: "v2|record:record-1|revision:1|seq:1"
      }
    ]);
    journalDailyEntryGenerationFindMany.mockResolvedValue([]);
    journalPeriodReportFindMany.mockResolvedValue([
      {
        id: "week-1",
        periodKind: "week",
        periodStart: new Date("2026-08-09T16:00:00.000Z"),
        periodEnd: new Date("2026-08-16T15:59:59.999Z"),
        title: "一周",
        status: "draft"
      }
    ]);
    getJournalPeriodReportViewForRange.mockResolvedValue({ displayStatus: "draft" });

    const result = await listInsightsRangeRows({
      userId: "user-1",
      startDate: "2026-08-10",
      endDate: "2026-08-16"
    });

    expect(journalEventEntryFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        event: {
          userId: "user-1",
          status: { not: "abandoned" },
          entryDate: {
            gte: new Date("2026-08-09T16:00:00.000Z"),
            lt: new Date("2026-08-16T16:00:00.000Z")
          }
        }
      }
    }));
    expect(result).toEqual({
      records: [{ id: "record-1", entryDate: "2026-08-12", title: "一件事" }],
      dailyJournals: [{ id: "daily-1", entryDate: "2026-08-12", title: "当天日记", status: "saved" }],
      periodReports: [{
        id: "week-1",
        kind: "week",
        startDate: "2026-08-10",
        endDate: "2026-08-16",
        title: "一周",
        status: "draft"
      }]
    });
  });

  it("uses the period source projection so changed weekly and monthly reports are marked stale", async () => {
    journalEventEntryFindMany.mockResolvedValue([]);
    journalDailyEntryFindMany.mockResolvedValue([]);
    journalDailyEntryGenerationFindMany.mockResolvedValue([]);
    journalPeriodReportFindMany.mockResolvedValue([
      {
        id: "week-stale",
        periodKind: "week",
        periodStart: new Date("2026-08-09T16:00:00.000Z"),
        periodEnd: new Date("2026-08-16T15:59:59.999Z"),
        title: "一周",
        status: "saved"
      }
    ]);
    getJournalPeriodReportViewForRange.mockResolvedValue({ displayStatus: "stale" });

    const result = await listInsightsRangeRows({
      userId: "user-1",
      startDate: "2026-08-12",
      endDate: "2026-08-12"
    });

    expect(getJournalPeriodReportViewForRange).toHaveBeenCalledWith("user-1", {
      kind: "week",
      startDate: "2026-08-10",
      endDate: "2026-08-16"
    });
    expect(result.periodReports[0]?.status).toBe("stale");
  });

  it("reads factual lifetime and recent-month rows for the self view", async () => {
    journalEventEntryFindFirst.mockResolvedValue({
      id: "record-first",
      title: "第一条",
      event: { entryDate: new Date("2026-03-17T16:00:00.000Z") }
    });
    journalEventEntryFindMany
      .mockResolvedValueOnce([
        {
          id: "record-latest",
          title: "最近一条",
          event: { entryDate: new Date("2026-08-12T16:00:00.000Z") }
        }
      ])
      .mockResolvedValueOnce([]);
    journalEventEntryCount.mockResolvedValue(2);
    journalEventFindMany.mockResolvedValue([
      { entryDate: new Date("2026-03-17T16:00:00.000Z") },
      { entryDate: new Date("2026-08-12T16:00:00.000Z") }
    ]);
    journalDailyEntryFindMany.mockResolvedValue([]);

    const result = await readInsightsSelfRows({
      userId: "user-1",
      recentMonthsStartDate: "2026-03-01",
      recentMonthsEndDate: "2026-08-31"
    });

    expect(result.firstRecord?.entryDate).toBe("2026-03-18");
    expect(result.recentRecords[0]?.entryDate).toBe("2026-08-13");
    expect(result.completedRecordCount).toBe(2);
    expect(result.recordedDates).toEqual(["2026-03-18", "2026-08-13"]);
  });
});
