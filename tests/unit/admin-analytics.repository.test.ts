const {
  mockAdminAuditLogCreate,
  mockAnalyticsEventCreate,
  mockAnalyticsEventFindMany,
  mockAnalyticsEventGroupBy,
  mockAnalyticsEventUpsert,
  mockDailyHappinessScoreFindMany,
  mockDailyJournalEntryFindMany,
  mockInterviewSessionFindMany,
  mockJoyEntryFindMany,
  mockUserFindMany
} = vi.hoisted(() => ({
  mockAdminAuditLogCreate: vi.fn(),
  mockAnalyticsEventCreate: vi.fn(),
  mockAnalyticsEventFindMany: vi.fn(),
  mockAnalyticsEventGroupBy: vi.fn(),
  mockAnalyticsEventUpsert: vi.fn(),
  mockDailyHappinessScoreFindMany: vi.fn(),
  mockDailyJournalEntryFindMany: vi.fn(),
  mockInterviewSessionFindMany: vi.fn(),
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
      findMany: mockAnalyticsEventFindMany,
      groupBy: mockAnalyticsEventGroupBy,
      upsert: mockAnalyticsEventUpsert
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
    joyEntry: {
      findMany: mockJoyEntryFindMany
    },
    user: {
      findMany: mockUserFindMany
    }
  }
}));

import {
  getRetentionStats,
  recordAdminAuditLog,
  recordAnalyticsEvent
} from "@/server/repositories/admin-analytics.repository";

describe("admin analytics repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes analytics events with optional linkage fields and dedupe key", async () => {
    mockAnalyticsEventUpsert.mockResolvedValue({ id: "event-1" });

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

    expect(mockAnalyticsEventUpsert).toHaveBeenCalledWith({
      where: {
        dedupeKey: "interview_draft_saved:session-1:entry-1"
      },
      create: {
        eventName: "interview_draft_saved",
        userId: "user-1",
        sessionId: "session-1",
        entryId: "entry-1",
        requestId: "request-1",
        dedupeKey: "interview_draft_saved:session-1:entry-1",
        properties: {
          dimension: "joy"
        }
      },
      update: {}
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

  it("computes retention metrics from user event timelines", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "user-1", createdAt: new Date("2026-05-01T00:00:00.000Z") },
      { id: "user-2", createdAt: new Date("2026-05-02T00:00:00.000Z") }
    ]);
    mockAnalyticsEventFindMany.mockResolvedValue([
      { userId: "user-1", eventName: "interview_session_started", occurredAt: new Date("2026-05-02T00:00:00.000Z") },
      { userId: "user-1", eventName: "interview_draft_saved", occurredAt: new Date("2026-05-08T00:00:00.000Z") },
      { userId: "user-2", eventName: "interview_session_started", occurredAt: new Date("2026-05-10T00:00:00.000Z") }
    ]);

    const result = await getRetentionStats({
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });

    expect(result.d1ReturnToRecordRate).toBe(0.5);
    expect(result.d7ReturnToRecordRate).toBe(0.5);
    expect(result.d30ReturnToRecordRate).toBe(1);
    expect(result.d7RepeatSaveRate).toBe(0.5);
    expect(result.d30RepeatSaveRate).toBe(0.5);
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
