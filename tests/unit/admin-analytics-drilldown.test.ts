const {
  mockGetAdminAnalyticsDailyJournalDetail,
  mockGetAdminAnalyticsEntryDetail,
  mockGetAdminAnalyticsSessionDetail,
  mockGetAdminAnalyticsUserDetail,
  mockListAdminAnalyticsUsers,
  mockRecordAdminAuditLog
} = vi.hoisted(() => ({
  mockGetAdminAnalyticsDailyJournalDetail: vi.fn(),
  mockGetAdminAnalyticsEntryDetail: vi.fn(),
  mockGetAdminAnalyticsSessionDetail: vi.fn(),
  mockGetAdminAnalyticsUserDetail: vi.fn(),
  mockListAdminAnalyticsUsers: vi.fn(),
  mockRecordAdminAuditLog: vi.fn()
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  countActiveUsersInRange: vi.fn(),
  countAnalyticsEvents: vi.fn(),
  getAdminAnalyticsDailyJournalDetail: mockGetAdminAnalyticsDailyJournalDetail,
  getAdminAnalyticsEntryDetail: mockGetAdminAnalyticsEntryDetail,
  getAdminAnalyticsSessionDetail: mockGetAdminAnalyticsSessionDetail,
  getAdminAnalyticsUserDetail: mockGetAdminAnalyticsUserDetail,
  getAnalyticsEventCounts: vi.fn(),
  getDailyJournalSaveStats: vi.fn(),
  getDimensionSaveStats: vi.fn(),
  getHappinessScoreStats: vi.fn(),
  getInterviewDraftSourceStats: vi.fn(),
  getLatestAIRequestStats: vi.fn(),
  getRetentionStats: vi.fn(),
  getSavedJoyEntryStats: vi.fn(),
  listAdminAnalyticsUsers: mockListAdminAnalyticsUsers,
  recordAdminAuditLog: mockRecordAdminAuditLog,
  recordAnalyticsEvent: vi.fn()
}));

import {
  getAdminAnalyticsDailyJournalDetail,
  getAdminAnalyticsEntryDetail,
  getAdminAnalyticsSessionDetail,
  getAdminAnalyticsUserDetail,
  listAdminAnalyticsUsers
} from "@/server/services/admin-analytics/admin-analytics.service";

describe("admin analytics drilldown service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists users with basic filters", async () => {
    mockListAdminAnalyticsUsers.mockResolvedValue([
      {
        id: "user-1",
        username: "daily_light_01",
        createdAt: new Date("2026-05-01T00:00:00.000Z")
      }
    ]);

    const result = await listAdminAnalyticsUsers({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      username: "daily",
      hasSavedJournal: true,
      hasBoundaryInsufficient: true,
      hasReopenedSession: true
    });

    expect(mockListAdminAnalyticsUsers).toHaveBeenCalledWith({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      username: "daily",
      hasSavedJournal: true,
      hasBoundaryInsufficient: true,
      hasReopenedSession: true
    });
    expect(result).toEqual([
      {
        id: "user-1",
        username: "daily_light_01",
        createdAt: "2026-05-01T00:00:00.000Z",
        latestActiveAt: null,
        funnelStep: undefined,
        savedEntryCount: undefined,
        savedDailyJournalCount: undefined,
        riskTags: undefined
      }
    ]);
  });

  it("returns user detail payload", async () => {
    mockGetAdminAnalyticsUserDetail.mockResolvedValue({
      user: {
        id: "user-1",
        username: "daily_light_01",
        createdAt: new Date("2026-05-01T00:00:00.000Z")
      },
      recentActiveAt: new Date("2026-05-07T10:00:00.000Z"),
      funnelStep: "journal_saved",
      scoreOverview: {
        scoreCount: 2,
        latestScoreDate: "2026-05-07"
      },
      sessions: [],
      joyEntries: [],
      dailyJournals: [],
      scores: []
    });

    const result = await getAdminAnalyticsUserDetail("user-1");

    expect(result.user).toEqual({
      id: "user-1",
      username: "daily_light_01",
      createdAt: "2026-05-01T00:00:00.000Z"
    });
    expect(result.recentActiveAt).toBe("2026-05-07T10:00:00.000Z");
    expect(result.funnelStep).toBe("journal_saved");
    expect(result.scoreOverview).toEqual({
      scoreCount: 2,
      latestScoreDate: "2026-05-07"
    });
  });

  it("writes audit logs when reading session transcript detail", async () => {
    mockGetAdminAnalyticsSessionDetail.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      dimension: "joy",
      status: "completed",
      stage: "finalize",
      activeEventId: null,
      turnCount: 4,
      lastAssistantQuestion: "你最想留下哪个点？",
      draftSummary: "被接住了",
      messages: [],
      snapshot: {
        event: "今天和家人一起吃饭聊天",
        feeling: "轻松踏实",
        whyItMattered: "被接住了",
        happinessType: "关系型开心",
        selfPattern: null,
        confidence: 0.9,
        missingSlots: []
      },
      events: [],
      pendingDecision: null,
      entryDate: "2026-05-02",
      startedAt: "2026-05-02T00:00:00.000Z",
      pausedAt: null,
      completedAt: "2026-05-02T00:10:00.000Z",
      journalEntry: null,
      draftGenerationUnlocked: true
    });

    const result = await getAdminAnalyticsSessionDetail("admin_user", "session-1");

    expect(result?.id).toBe("session-1");
    expect(mockRecordAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUsername: "admin_user",
        targetUserId: "user-1",
        resourceType: "interview_session",
        resourceId: "session-1",
        action: "view_content"
      })
    );
  });

  it("writes audit logs when reading entry and daily journal content", async () => {
    mockGetAdminAnalyticsEntryDetail.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      title: "被稳稳接住",
      content: "今天和家人一起吃饭聊天。",
      session: {
        dimension: "joy"
      }
    });
    mockGetAdminAnalyticsDailyJournalDetail.mockResolvedValue({
      id: "daily-1",
      userId: "user-1",
      title: "今天的记录",
      content: "## 开心\n今天和家人一起吃饭聊天。"
    });

    const entryResult = await getAdminAnalyticsEntryDetail("admin_user", "entry-1");
    const journalResult = await getAdminAnalyticsDailyJournalDetail("admin_user", "daily-1");

    expect(entryResult?.id).toBe("entry-1");
    expect(journalResult?.id).toBe("daily-1");
    expect(mockRecordAdminAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        adminUsername: "admin_user",
        targetUserId: "user-1",
        resourceType: "joy_entry",
        resourceId: "entry-1",
        action: "view_content"
      })
    );
    expect(mockRecordAdminAuditLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        adminUsername: "admin_user",
        targetUserId: "user-1",
        resourceType: "daily_journal",
        resourceId: "daily-1",
        action: "view_content"
      })
    );
  });
});
