const {
  mockAdminAuditLogCreate,
  mockAnalyticsEventCreate,
  mockAnalyticsEventCreateMany,
  mockAnalyticsEventFindMany,
  mockAnalyticsEventGroupBy,
  mockDailyHappinessScoreFindMany,
  mockDailyJournalEntryFindMany,
  mockInterviewSessionFindMany,
  mockJournalDailyEntryFindMany,
  mockJournalDailyEntryGenerationFindMany,
  mockJournalEventEntryFindMany,
  mockJoyEntryFindMany,
  mockUserFindMany
} = vi.hoisted(() => ({
  mockAdminAuditLogCreate: vi.fn(),
  mockAnalyticsEventCreate: vi.fn(),
  mockAnalyticsEventCreateMany: vi.fn(),
  mockAnalyticsEventFindMany: vi.fn(),
  mockAnalyticsEventGroupBy: vi.fn(),
  mockDailyHappinessScoreFindMany: vi.fn(),
  mockDailyJournalEntryFindMany: vi.fn(),
  mockInterviewSessionFindMany: vi.fn(),
  mockJournalDailyEntryFindMany: vi.fn(),
  mockJournalDailyEntryGenerationFindMany: vi.fn(),
  mockJournalEventEntryFindMany: vi.fn(),
  mockJoyEntryFindMany: vi.fn(),
  mockUserFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    adminAuditLog: {
      create: mockAdminAuditLogCreate
    },
    analyticsEvent: {
      create: mockAnalyticsEventCreate,
      createMany: mockAnalyticsEventCreateMany,
      findMany: mockAnalyticsEventFindMany,
      groupBy: mockAnalyticsEventGroupBy
    },
    dailyHappinessScore: {
      findMany: mockDailyHappinessScoreFindMany
    },
    dailyJournalEntry: {
      findMany: mockDailyJournalEntryFindMany
    },
    interviewSession: {
      findMany: mockInterviewSessionFindMany
    },
    journalDailyEntry: {
      findMany: mockJournalDailyEntryFindMany
    },
    journalDailyEntryGeneration: {
      findMany: mockJournalDailyEntryGenerationFindMany
    },
    journalEventEntry: {
      findMany: mockJournalEventEntryFindMany
    },
    joyEntry: {
      findMany: mockJoyEntryFindMany
    },
    user: {
      findMany: mockUserFindMany
    }
  }
}));

import {
  getCurrentProductFunnelStats,
  getJournalDailyStaleStats,
  getRetentionStats,
  recordAdminAuditLog,
  recordAnalyticsEvent
} from "@/server/repositories/admin-analytics.repository";

describe("admin analytics repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJournalEventEntryFindMany.mockResolvedValue([]);
  });

  it("writes analytics events with optional linkage fields and dedupe key", async () => {
    mockAnalyticsEventCreateMany.mockResolvedValue({ count: 1 });

    await recordAnalyticsEvent({
      eventName: "interview_draft_saved",
      userId: "user-1",
      sessionId: "session-1",
      entryId: "entry-1",
      requestId: "request-1",
      dedupeKey: "interview_draft_saved:session-1:entry-1",
      properties: {
        dimension: "joy"
      }
    });

    expect(mockAnalyticsEventCreateMany).toHaveBeenCalledWith({
      data: [{
        eventName: "interview_draft_saved",
        userId: "user-1",
        sessionId: "session-1",
        entryId: "entry-1",
        requestId: "request-1",
        dedupeKey: "interview_draft_saved:session-1:entry-1",
        properties: {
          dimension: "joy"
        }
      }],
      skipDuplicates: true
    });
  });

  it("writes admin audit logs for content reads", async () => {
    mockAdminAuditLogCreate.mockResolvedValue({ id: "audit-1" });

    await recordAdminAuditLog({
      adminUsername: "admin_user",
      targetUserId: "user-1",
      resourceType: "joy_entry",
      resourceId: "entry-1",
      action: "view_content"
    });

    expect(mockAdminAuditLogCreate).toHaveBeenCalledWith({
      data: {
        adminUsername: "admin_user",
        targetUserId: "user-1",
        resourceType: "joy_entry",
        resourceId: "entry-1",
        action: "view_content"
      }
    });
  });

  it("computes retention from the first saved event-card date in Shanghai", async () => {
    mockAnalyticsEventFindMany.mockResolvedValue([
      {
        userId: "user-1",
        eventName: "event_journal_saved",
        occurredAt: new Date("2026-05-01T15:59:00.000Z"),
        properties: { entryDate: "2026-05-01" }
      },
      {
        userId: "user-1",
        eventName: "event_centered_first_content_submitted",
        occurredAt: new Date("2026-05-02T16:00:00.000Z"),
        properties: { entryDate: "2026-05-02" }
      },
      {
        userId: "user-1",
        eventName: "event_journal_saved",
        occurredAt: new Date("2026-05-02T16:10:00.000Z"),
        properties: { entryDate: "2026-05-02" }
      },
      {
        userId: "user-2",
        eventName: "event_journal_saved",
        occurredAt: new Date("2026-05-10T00:00:00.000Z"),
        properties: { entryDate: "2026-05-10" }
      }
    ]);

    const result = await getRetentionStats({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });

    expect(result.cohortUserCount).toBe(2);
    expect(result.rates.d1ReturnToRecordRate).toBe(0.5);
    expect(result.rates.d7ReturnToRecordRate).toBe(0.5);
    expect(result.rates.d30ReturnToRecordRate).toBe(0.5);
    expect(result.rates.d7RepeatSaveRate).toBe(0.5);
    expect(result.rates.d30RepeatSaveRate).toBe(0.5);
  });

  it("keeps historical save events readable when entryDate metadata is absent", async () => {
    mockAnalyticsEventFindMany.mockResolvedValue([
      {
        userId: "legacy-user",
        eventName: "event_journal_saved",
        occurredAt: new Date("2026-05-01T16:00:00.000Z"),
        properties: {}
      }
    ]);

    const result = await getRetentionStats({
      startDate: "2026-05-02",
      endDate: "2026-05-02"
    });

    expect(result.cohortUserCount).toBe(1);
    expect(result.rates).toEqual({
      d1ReturnToRecordRate: 0,
      d7ReturnToRecordRate: 0,
      d30ReturnToRecordRate: 0,
      d7RepeatSaveRate: 0,
      d30RepeatSaveRate: 0
    });
  });

  it("uses automatically saved event cards as retention saves without requiring a save event", async () => {
    mockAnalyticsEventFindMany.mockResolvedValue([]);
    mockJournalEventEntryFindMany.mockResolvedValue([
      {
        event: {
          userId: "automatic-user",
          entryDate: new Date("2026-04-30T16:00:00.000Z")
        }
      }
    ]);

    const result = await getRetentionStats({
      startDate: "2026-05-01",
      endDate: "2026-05-01"
    });

    expect(result.cohortUserCount).toBe(1);
  });

  it("builds the current-product funnel from events and persisted current artifacts", async () => {
    mockAnalyticsEventFindMany.mockResolvedValue([
      {
        userId: "user-1",
        eventName: "event_centered_entry_opened",
        occurredAt: new Date("2026-05-01T00:00:00.000Z")
      },
      {
        userId: "user-1",
        eventName: "event_centered_first_content_submitted",
        occurredAt: new Date("2026-05-01T00:02:00.000Z")
      },
      {
        userId: "user-1",
        eventName: "event_centered_response_completed",
        occurredAt: new Date("2026-05-01T00:03:00.000Z")
      }
    ]);
    mockJournalEventEntryFindMany.mockResolvedValue([
      {
        savedAt: new Date("2026-05-01T00:04:00.000Z"),
        event: { userId: "user-1" }
      }
    ]);
    mockJournalDailyEntryGenerationFindMany.mockResolvedValue([
      { userId: "user-1", completedAt: new Date("2026-05-01T00:05:00.000Z") }
    ]);
    mockJournalDailyEntryFindMany.mockResolvedValue([
      {
        userId: "user-1",
        createdAt: new Date("2026-05-01T00:05:00.000Z"),
        savedAt: new Date("2026-05-01T00:06:00.000Z")
      }
    ]);

    await expect(getCurrentProductFunnelStats({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    })).resolves.toEqual([
      { key: "openedDay", count: 1 },
      { key: "firstContentSubmitted", count: 1 },
      { key: "completeResponseReceived", count: 1 },
      { key: "eventCardSaved", count: 1 },
      { key: "dailyJournalGenerated", count: 1 },
      { key: "dailyJournalSaved", count: 1 }
    ]);
  });

  it("computes stale from the current event-card source signature", async () => {
    mockJournalDailyEntryFindMany.mockResolvedValue([
      {
        userId: "user-1",
        entryDate: new Date("2026-04-30T16:00:00.000Z"),
        sourceSignature: "v2|record:entry-1|revision:1|seq:1"
      },
      {
        userId: "user-2",
        entryDate: new Date("2026-04-30T16:00:00.000Z"),
        sourceSignature: "v2|record:entry-2|revision:1|seq:1"
      }
    ]);
    mockJournalEventEntryFindMany.mockResolvedValue([
      {
        id: "entry-1",
        contentRevision: 2,
        event: {
          userId: "user-1",
          entryDate: new Date("2026-04-30T16:00:00.000Z"),
          daySequence: 1
        }
      },
      {
        id: "entry-2",
        contentRevision: 1,
        event: {
          userId: "user-2",
          entryDate: new Date("2026-04-30T16:00:00.000Z"),
          daySequence: 1
        }
      }
    ]);

    await expect(getJournalDailyStaleStats({
      startDate: "2026-05-01",
      endDate: "2026-05-01"
    })).resolves.toEqual({ staleCount: 1, totalCount: 2, staleRate: 0.5 });
  });

  it("filters users by boundary-insufficient and reopened-session flags", async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockAnalyticsEventGroupBy.mockResolvedValue([{ userId: "user-1" }]);

    const { listAdminAnalyticsUsers } = await import("@/server/repositories/admin-analytics.repository");

    await listAdminAnalyticsUsers({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      username: "daily",
      hasSavedJournal: true,
      hasBoundaryInsufficient: true,
      hasReopenedSession: true
    });

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          username: {
            contains: "daily"
          }
        })
      })
    );
    expect(mockAnalyticsEventGroupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          eventName: "interview_boundary_insufficient_shown"
        })
      })
    );
    expect(mockAnalyticsEventGroupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          eventName: "interview_session_reopened"
        })
      })
    );
  });

  it("returns candidate user summary fields for table display", async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: "user-1",
        username: "daily_light_01",
        createdAt: new Date("2026-05-01T00:00:00.000Z")
      }
    ]);
    mockJoyEntryFindMany.mockResolvedValue([
      {
        userId: "user-1",
        status: "saved",
        updatedAt: new Date("2026-05-20T00:10:00.000Z")
      }
    ]);
    mockInterviewSessionFindMany.mockResolvedValue([
      {
        userId: "user-1",
        status: "completed",
        dimension: "joy",
        startedAt: new Date("2026-05-20T00:00:00.000Z")
      }
    ]);
    mockDailyJournalEntryFindMany.mockResolvedValue([]);
    mockAnalyticsEventFindMany.mockResolvedValue([
      {
        userId: "user-1",
        eventName: "interview_boundary_insufficient_shown",
        occurredAt: new Date("2026-05-20T00:20:00.000Z")
      }
    ]);

    const { listAdminAnalyticsUsers } = await import("@/server/repositories/admin-analytics.repository");

    const result = await listAdminAnalyticsUsers({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      hasSavedJournal: true
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: "user-1",
        username: "daily_light_01",
        latestActiveAt: new Date("2026-05-20T00:20:00.000Z"),
        funnelStep: "journal_saved",
        savedEntryCount: 1,
        savedDailyJournalCount: 0,
        riskTags: ["boundary_insufficient"]
      })
    ]);
  });

  it("derives candidate latest activity and funnel step from the most recent real record across events and content", async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: "user-2",
        username: "draft_only_user",
        createdAt: new Date("2026-05-01T00:00:00.000Z")
      }
    ]);
    mockJoyEntryFindMany.mockResolvedValue([
      {
        userId: "user-2",
        status: "draft",
        updatedAt: new Date("2026-05-20T02:00:00.000Z")
      }
    ]);
    mockInterviewSessionFindMany.mockResolvedValue([
      {
        userId: "user-2",
        status: "active",
        dimension: "joy",
        startedAt: new Date("2026-05-20T00:00:00.000Z")
      }
    ]);
    mockDailyJournalEntryFindMany.mockResolvedValue([]);
    mockAnalyticsEventFindMany.mockResolvedValue([
      {
        userId: "user-2",
        eventName: "interview_draft_generated",
        occurredAt: new Date("2026-05-20T01:00:00.000Z")
      },
      {
        userId: "user-2",
        eventName: "auth_login_succeeded",
        occurredAt: new Date("2026-05-19T23:00:00.000Z")
      }
    ]);

    const { listAdminAnalyticsUsers } = await import("@/server/repositories/admin-analytics.repository");

    const result = await listAdminAnalyticsUsers({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      username: "draft_only"
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: "user-2",
        latestActiveAt: new Date("2026-05-20T02:00:00.000Z"),
        funnelStep: "draft_generated"
      })
    ]);
  });
});
