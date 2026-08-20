const {
  mockCountActiveUsersInRange,
  mockCountAnalyticsEvents,
  mockGetCurrentProductFunnelStats,
  mockGetCurrentProductOverviewStats,
  mockGetCurrentProductQualityStats,
  mockGetAdminAnalyticsUserDetailRecord,
  mockGetAnalyticsEventCounts,
  mockGetDailyJournalSaveStats,
  mockGetDimensionSaveStats,
  mockGetHappinessScoreStats,
  mockGetInterviewDraftSourceStats,
  mockGetJournalDailyStaleStats,
  mockGetLatestAIRequestStats,
  mockListAdminAnalyticsUsersRecord,
  mockGetRetentionStats,
  mockGetSavedJoyEntryStats
} = vi.hoisted(() => ({
  mockCountActiveUsersInRange: vi.fn(),
  mockCountAnalyticsEvents: vi.fn(),
  mockGetCurrentProductFunnelStats: vi.fn(),
  mockGetCurrentProductOverviewStats: vi.fn(),
  mockGetCurrentProductQualityStats: vi.fn(),
  mockGetAdminAnalyticsUserDetailRecord: vi.fn(),
  mockGetAnalyticsEventCounts: vi.fn(),
  mockGetDailyJournalSaveStats: vi.fn(),
  mockGetDimensionSaveStats: vi.fn(),
  mockGetHappinessScoreStats: vi.fn(),
  mockGetInterviewDraftSourceStats: vi.fn(),
  mockGetJournalDailyStaleStats: vi.fn(),
  mockGetLatestAIRequestStats: vi.fn(),
  mockListAdminAnalyticsUsersRecord: vi.fn(),
  mockGetRetentionStats: vi.fn(),
  mockGetSavedJoyEntryStats: vi.fn()
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  countActiveUsersInRange: mockCountActiveUsersInRange,
  countAnalyticsEvents: mockCountAnalyticsEvents,
  getCurrentProductFunnelStats: mockGetCurrentProductFunnelStats,
  getCurrentProductOverviewStats: mockGetCurrentProductOverviewStats,
  getCurrentProductQualityStats: mockGetCurrentProductQualityStats,
  getAdminAnalyticsUserDetail: mockGetAdminAnalyticsUserDetailRecord,
  getAnalyticsEventCounts: mockGetAnalyticsEventCounts,
  getDailyJournalSaveStats: mockGetDailyJournalSaveStats,
  getDimensionSaveStats: mockGetDimensionSaveStats,
  getHappinessScoreStats: mockGetHappinessScoreStats,
  getInterviewDraftSourceStats: mockGetInterviewDraftSourceStats,
  getJournalDailyStaleStats: mockGetJournalDailyStaleStats,
  getLatestAIRequestStats: mockGetLatestAIRequestStats,
  listAdminAnalyticsUsers: mockListAdminAnalyticsUsersRecord,
  getRetentionStats: mockGetRetentionStats,
  getSavedJoyEntryStats: mockGetSavedJoyEntryStats,
  recordAdminAuditLog: vi.fn(),
  recordAnalyticsEvent: vi.fn()
}));

import {
  AdminAnalyticsQueryError,
  getAdminAnalyticsFunnel,
  getAdminAnalyticsOverview,
  getAdminAnalyticsQuality,
  getAdminAnalyticsRetention,
  listAdminAnalyticsUsers
} from "@/server/services/admin-analytics/admin-analytics.service";

describe("admin analytics service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns overview metrics from historical facts and ai stats", async () => {
    mockGetCurrentProductOverviewStats.mockResolvedValue({
      mru7: 10,
      savedEventCardUsers: 7,
      savedEventCardCount: 13,
      savedDailyJournalUsers: 4,
      savedDailyJournalCount: 6
    });
    mockCountActiveUsersInRange.mockResolvedValue(12);
    mockGetSavedJoyEntryStats.mockResolvedValue({ userCount: 8, saveCount: 15 });
    mockGetDailyJournalSaveStats.mockResolvedValue({ userCount: 5, saveCount: 7 });
    mockGetHappinessScoreStats.mockResolvedValue({ userCount: 9, saveCount: 18 });
    mockGetLatestAIRequestStats.mockResolvedValue({
      successRate: 0.92,
      p50LatencyMs: 820,
      p95LatencyMs: 1840
    });

    const result = await getAdminAnalyticsOverview({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });

    expect(result).toEqual({
      contractVersion: 2,
      range: {
        startDate: "2026-05-01",
        endDate: "2026-05-31"
      },
      northStar: {
        name: "MRU-7",
        value: 10
      },
      currentOverview: {
        savedEventCardUsers: 7,
        savedEventCardCount: 13,
        savedDailyJournalUsers: 4,
        savedDailyJournalCount: 6
      },
      overview: {
        savedJournalUsers: 8,
        savedJournalCount: 15,
        savedDailyJournalUsers: 5,
        savedDailyJournalCount: 7,
        happinessScoreUsers: 9,
        happinessScoreCount: 18
      },
      legacyOverview: {
        savedJournalUsers: 8,
        savedJournalCount: 15,
        savedDailyJournalUsers: 5,
        savedDailyJournalCount: 7,
        happinessScoreUsers: 9,
        happinessScoreCount: 18
      },
      ai: {
        successRate: 0.92,
        p50LatencyMs: 820,
        p95LatencyMs: 1840
      }
    });
    expect(mockGetCurrentProductOverviewStats).toHaveBeenCalledWith({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });
  });

  it("returns funnel metrics from analytics events", async () => {
    mockGetCurrentProductFunnelStats.mockResolvedValue([
      { key: "openedDay", count: 12 },
      { key: "firstContentSubmitted", count: 9 },
      { key: "completeResponseReceived", count: 8 },
      { key: "eventCardSaved", count: 7 },
      { key: "dailyJournalGenerated", count: 5 },
      { key: "dailyJournalSaved", count: 4 }
    ]);
    mockGetAnalyticsEventCounts.mockResolvedValue({
      auth_register_succeeded: 20,
      auth_login_succeeded: 18,
      private_page_viewed: 16,
      interview_session_started: 14,
      interview_first_user_reply: 11,
      interview_draft_generated: 8,
      interview_draft_saved: 6,
      daily_journal_generated: 4,
      daily_journal_saved: 3,
      interview_session_paused: 2,
      interview_session_reopened: 1,
      interview_boundary_insufficient_shown: 5,
      interview_dimension_redirect_shown: 2
    });

    const result = await getAdminAnalyticsFunnel({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });

    expect(result.contractVersion).toBe(2);
    expect(result.currentProductFunnel).toEqual([
      { key: "openedDay", count: 12 },
      { key: "firstContentSubmitted", count: 9 },
      { key: "completeResponseReceived", count: 8 },
      { key: "eventCardSaved", count: 7 },
      { key: "dailyJournalGenerated", count: 5 },
      { key: "dailyJournalSaved", count: 4 }
    ]);
    const expectedLegacyMain = [
      { key: "register", count: 20 },
      { key: "login", count: 18 },
      { key: "privatePageView", count: 16 },
      { key: "sessionStart", count: 14 },
      { key: "firstReply", count: 11 },
      { key: "draftGenerated", count: 8 },
      { key: "journalSaved", count: 6 }
    ];
    const expectedLegacySecondary = [
      { key: "dailyJournalGenerated", count: 4 },
      { key: "dailyJournalSaved", count: 3 }
    ];
    const expectedLegacySignals = {
      pausedCount: 2,
      reopenedCount: 1,
      boundaryInsufficientCount: 5,
      dimensionRedirectCount: 2
    };
    expect(result.mainFunnel).toEqual(expectedLegacyMain);
    expect(result.secondaryFunnel).toEqual(expectedLegacySecondary);
    expect(result.qualitySignals).toEqual(expectedLegacySignals);
    expect(result.legacyFunnel).toEqual({
      mainFunnel: expectedLegacyMain,
      secondaryFunnel: expectedLegacySecondary,
      qualitySignals: expectedLegacySignals
    });
  });

  it("returns retention metrics from repository aggregates", async () => {
    mockGetRetentionStats.mockResolvedValue({
      cohortUserCount: 20,
      eligibility: {
        d1EligibleUsers: 20,
        d7EligibleUsers: 18,
        d30EligibleUsers: 10
      },
      rates: {
        d1ReturnToRecordRate: 0.42,
        d7ReturnToRecordRate: 0.35,
        d30ReturnToRecordRate: 0.12,
        d7RepeatSaveRate: 0.3,
        d30RepeatSaveRate: 0.11
      }
    });

    const result = await getAdminAnalyticsRetention({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });

    expect(result).toEqual({
      contractVersion: 2,
      timezone: "Asia/Shanghai",
      cohort: {
        anchor: "first_event_journal_saved",
        userCount: 20
      },
      retention: {
        d1ReturnToRecordRate: 0.42,
        d7ReturnToRecordRate: 0.35,
        d30ReturnToRecordRate: 0.12,
        d7RepeatSaveRate: 0.3,
        d30RepeatSaveRate: 0.11
      },
      eligibility: {
        d1EligibleUsers: 20,
        d7EligibleUsers: 18,
        d30EligibleUsers: 10
      },
      d1ReturnToRecordRate: 0.42,
      d7ReturnToRecordRate: 0.35,
      d30ReturnToRecordRate: 0.12,
      d7RepeatSaveRate: 0.3,
      d30RepeatSaveRate: 0.11
    });
  });

  it("returns quality metrics from facts and event stats", async () => {
    mockGetCurrentProductQualityStats.mockResolvedValue({
      fallbackRate: 0.1,
      abnormalExitRate: 0.05,
      resumeSuccessRate: 0.75,
      firstVisibleLatency: { sampleCount: 8, p50Ms: 500, p95Ms: 1200 },
      fullInteractionLatency: { sampleCount: 8, p50Ms: 900, p95Ms: 1800 },
      counts: {
        completedResponses: 10,
        fallbackTurns: 1,
        startedSessions: 20,
        abandonedSessions: 1,
        resumeStarted: 4,
        resumeCompleted: 3,
        resumeFailed: 1
      }
    });
    mockGetJournalDailyStaleStats.mockResolvedValue({
      staleCount: 2,
      totalCount: 8,
      staleRate: 0.25
    });
    mockGetDimensionSaveStats.mockResolvedValue([
      { dimension: "joy", savedEntryCount: 10 },
      { dimension: "gratitude", savedEntryCount: 4 }
    ]);
    mockCountAnalyticsEvents
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3);
    mockGetInterviewDraftSourceStats.mockResolvedValue({
      editedDraftCount: 3,
      totalDraftCount: 10
    });
    mockGetLatestAIRequestStats.mockResolvedValue({
      successRate: 0.88,
      p50LatencyMs: 900,
      p95LatencyMs: 2100,
      errorCodeBreakdown: [
        { errorCode: "UPSTREAM_TIMEOUT", count: 2 },
        { errorCode: "PROVIDER_ERROR", count: 1 }
      ]
    });

    const result = await getAdminAnalyticsQuality({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });

    expect(result.contractVersion).toBe(2);
    expect(result.qualitySignals).toEqual({
      fallbackRate: 0.1,
      abnormalExitRate: 0.05,
      resumeSuccessRate: 0.75,
      staleRate: 0.25,
      firstVisibleLatency: { sampleCount: 8, p50Ms: 500, p95Ms: 1200 },
      fullInteractionLatency: { sampleCount: 8, p50Ms: 900, p95Ms: 1800 },
      counts: {
        completedResponses: 10,
        fallbackTurns: 1,
        startedSessions: 20,
        abandonedSessions: 1,
        resumeStarted: 4,
        resumeCompleted: 3,
        resumeFailed: 1
      }
    });
    expect(result.dimensionSaveBreakdown).toEqual([
      { dimension: "joy", savedEntryCount: 10 },
      { dimension: "gratitude", savedEntryCount: 4 }
    ]);
    expect(result.draftEditRate).toBe(0.3);
    expect(result.boundaryInsufficientRate).toBe(0.4);
    expect(result.staleRate).toBe(0.25);
    expect(result.ai).toEqual({
      successRate: 0.88,
      p50LatencyMs: 900,
      p95LatencyMs: 2100,
      errorCodeBreakdown: [
        { errorCode: "UPSTREAM_TIMEOUT", count: 2 },
        { errorCode: "PROVIDER_ERROR", count: 1 }
      ]
    });
    expect(result.legacyQuality).toEqual({
      dimensionSaveBreakdown: [
        { dimension: "joy", savedEntryCount: 10 },
        { dimension: "gratitude", savedEntryCount: 4 }
      ],
      draftEditRate: 0.3,
      boundaryInsufficientRate: 0.4,
      ai: {
        successRate: 0.88,
        p50LatencyMs: 900,
        p95LatencyMs: 2100,
        errorCodeBreakdown: [
          { errorCode: "UPSTREAM_TIMEOUT", count: 2 },
          { errorCode: "PROVIDER_ERROR", count: 1 }
        ]
      }
    });
  });

  it("rejects invalid date ranges", async () => {
    await expect(
      getAdminAnalyticsOverview({
        startDate: "2026-05-31",
        endDate: "2026-05-01"
      })
    ).rejects.toMatchObject({
      code: "INVALID_ADMIN_ANALYTICS_RANGE"
    } satisfies Partial<AdminAnalyticsQueryError>);
  });

  it("returns candidate users with summary fields for the investigation table", async () => {
    mockListAdminAnalyticsUsersRecord.mockResolvedValue([
      {
        id: "user-1",
        username: "daily_light_01",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        latestActiveAt: new Date("2026-05-20T00:20:00.000Z"),
        funnelStep: "journal_saved",
        savedEntryCount: 1,
        savedDailyJournalCount: 0,
        riskTags: ["boundary_insufficient"]
      }
    ]);

    const result = await listAdminAnalyticsUsers({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      hasSavedJournal: true
    });

    expect(result).toEqual([
      {
        id: "user-1",
        username: "daily_light_01",
        createdAt: "2026-05-01T00:00:00.000Z",
        latestActiveAt: "2026-05-20T00:20:00.000Z",
        funnelStep: "journal_saved",
        savedEntryCount: 1,
        savedDailyJournalCount: 0,
        riskTags: ["boundary_insufficient"]
      }
    ]);
  });
});
