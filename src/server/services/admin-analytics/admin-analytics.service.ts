import type {
  AdminAnalyticsFunnelRecord,
  AdminAnalyticsOverviewRecord,
  AdminAnalyticsQualityRecord,
  AdminAnalyticsRange,
  AdminAnalyticsRetentionRecord
} from "@/features/admin-analytics/types";
import { parseEntryDateInput } from "@/features/interview/entry-date";
import {
  countActiveUsersInRange,
  countAnalyticsEvents,
  getAdminAnalyticsDailyJournalDetail as getAdminAnalyticsDailyJournalDetailRecord,
  getAdminAnalyticsEntryDetail as getAdminAnalyticsEntryDetailRecord,
  getAdminAnalyticsSessionDetail as getAdminAnalyticsSessionDetailRecord,
  getAdminAnalyticsUserDetail as getAdminAnalyticsUserDetailRecord,
  getAnalyticsEventCounts,
  getDailyJournalSaveStats,
  getDimensionSaveStats,
  getHappinessScoreStats,
  getInterviewDraftSourceStats,
  getLatestAIRequestStats,
  getRetentionStats,
  getSavedJoyEntryStats,
  listAdminAnalyticsUsers as listAdminAnalyticsUsersRecord,
  recordAdminAuditLog
} from "@/server/repositories/admin-analytics.repository";

export class AdminAnalyticsQueryError extends Error {
  constructor(
    readonly code: "INVALID_ADMIN_ANALYTICS_RANGE" | "ADMIN_ANALYTICS_QUERY_FAILED",
    message?: string,
    readonly cause?: unknown
  ) {
    super(message ?? code);
    this.name = "AdminAnalyticsQueryError";
  }
}

function assertRange(range: AdminAnalyticsRange) {
  const start = parseEntryDateInput(range.startDate).getTime();
  const end = parseEntryDateInput(range.endDate).getTime();

  if (start > end) {
    throw new AdminAnalyticsQueryError("INVALID_ADMIN_ANALYTICS_RANGE");
  }
}

export async function getAdminAnalyticsOverview(range: AdminAnalyticsRange): Promise<AdminAnalyticsOverviewRecord> {
  assertRange(range);

  try {
    const [mru7, joyEntryStats, dailyJournalStats, happinessScoreStats, aiStats] = await Promise.all([
      countActiveUsersInRange(range),
      getSavedJoyEntryStats(range),
      getDailyJournalSaveStats(range),
      getHappinessScoreStats(range),
      getLatestAIRequestStats(range)
    ]);

    return {
      range,
      northStar: {
        name: "MRU-7",
        value: mru7
      },
      overview: {
        savedJournalUsers: joyEntryStats.userCount,
        savedJournalCount: joyEntryStats.saveCount,
        savedDailyJournalUsers: dailyJournalStats.userCount,
        savedDailyJournalCount: dailyJournalStats.saveCount,
        happinessScoreUsers: happinessScoreStats.userCount,
        happinessScoreCount: happinessScoreStats.saveCount
      },
      ai: {
        successRate: aiStats.successRate,
        p50LatencyMs: aiStats.p50LatencyMs,
        p95LatencyMs: aiStats.p95LatencyMs
      }
    };
  } catch (error) {
    if (error instanceof AdminAnalyticsQueryError) {
      throw error;
    }

    throw new AdminAnalyticsQueryError("ADMIN_ANALYTICS_QUERY_FAILED", undefined, error);
  }
}

export async function getAdminAnalyticsFunnel(range: AdminAnalyticsRange): Promise<AdminAnalyticsFunnelRecord> {
  assertRange(range);

  try {
    const counts = await getAnalyticsEventCounts({
      ...range,
      eventNames: [
        "auth_register_succeeded",
        "auth_login_succeeded",
        "private_page_viewed",
        "interview_session_started",
        "interview_first_user_reply",
        "interview_draft_generated",
        "interview_draft_saved",
        "daily_journal_generated",
        "daily_journal_saved",
        "interview_session_paused",
        "interview_session_reopened",
        "interview_boundary_insufficient_shown",
        "interview_dimension_redirect_shown"
      ]
    });

    return {
      mainFunnel: [
        { key: "register", count: counts.auth_register_succeeded ?? 0 },
        { key: "login", count: counts.auth_login_succeeded ?? 0 },
        { key: "privatePageView", count: counts.private_page_viewed ?? 0 },
        { key: "sessionStart", count: counts.interview_session_started ?? 0 },
        { key: "firstReply", count: counts.interview_first_user_reply ?? 0 },
        { key: "draftGenerated", count: counts.interview_draft_generated ?? 0 },
        { key: "journalSaved", count: counts.interview_draft_saved ?? 0 }
      ],
      secondaryFunnel: [
        { key: "dailyJournalGenerated", count: counts.daily_journal_generated ?? 0 },
        { key: "dailyJournalSaved", count: counts.daily_journal_saved ?? 0 }
      ],
      qualitySignals: {
        pausedCount: counts.interview_session_paused ?? 0,
        reopenedCount: counts.interview_session_reopened ?? 0,
        boundaryInsufficientCount: counts.interview_boundary_insufficient_shown ?? 0,
        dimensionRedirectCount: counts.interview_dimension_redirect_shown ?? 0
      }
    };
  } catch (error) {
    if (error instanceof AdminAnalyticsQueryError) {
      throw error;
    }

    throw new AdminAnalyticsQueryError("ADMIN_ANALYTICS_QUERY_FAILED", undefined, error);
  }
}

export async function getAdminAnalyticsRetention(range: AdminAnalyticsRange): Promise<AdminAnalyticsRetentionRecord> {
  assertRange(range);

  try {
    return await getRetentionStats(range);
  } catch (error) {
    if (error instanceof AdminAnalyticsQueryError) {
      throw error;
    }

    throw new AdminAnalyticsQueryError("ADMIN_ANALYTICS_QUERY_FAILED", undefined, error);
  }
}

export async function getAdminAnalyticsQuality(range: AdminAnalyticsRange): Promise<AdminAnalyticsQualityRecord> {
  assertRange(range);

  try {
    const [dimensionSaveBreakdown, firstReplyCount, boundaryInsufficientCount, draftSourceStats, aiStats] =
      await Promise.all([
        getDimensionSaveStats(range),
        countAnalyticsEvents({ ...range, eventName: "interview_first_user_reply" }),
        countAnalyticsEvents({ ...range, eventName: "interview_boundary_insufficient_shown" }),
        getInterviewDraftSourceStats(range),
        getLatestAIRequestStats(range)
      ]);

    return {
      dimensionSaveBreakdown,
      draftEditRate:
        draftSourceStats.totalDraftCount > 0 ? draftSourceStats.editedDraftCount / draftSourceStats.totalDraftCount : 0,
      boundaryInsufficientRate: firstReplyCount > 0 ? boundaryInsufficientCount / firstReplyCount : 0,
      staleRate: draftSourceStats.totalDraftCount > 0 ? draftSourceStats.editedDraftCount / draftSourceStats.totalDraftCount : 0,
      ai: {
        successRate: aiStats.successRate,
        p50LatencyMs: aiStats.p50LatencyMs,
        p95LatencyMs: aiStats.p95LatencyMs,
        errorCodeBreakdown: aiStats.errorCodeBreakdown ?? []
      }
    };
  } catch (error) {
    if (error instanceof AdminAnalyticsQueryError) {
      throw error;
    }

    throw new AdminAnalyticsQueryError("ADMIN_ANALYTICS_QUERY_FAILED", undefined, error);
  }
}

export async function listAdminAnalyticsUsers(input: {
  startDate: string;
  endDate: string;
  username?: string;
  hasSavedJournal?: boolean;
  hasBoundaryInsufficient?: boolean;
  hasReopenedSession?: boolean;
}) {
  assertRange(input);

  const users = await listAdminAnalyticsUsersRecord(input);

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    latestActiveAt: user.latestActiveAt?.toISOString() ?? null,
    funnelStep: user.funnelStep,
    savedEntryCount: user.savedEntryCount,
    savedDailyJournalCount: user.savedDailyJournalCount,
    riskTags: user.riskTags
  }));
}

export async function getAdminAnalyticsUserDetail(userId: string) {
  const result = await getAdminAnalyticsUserDetailRecord(userId);

  return {
    user: result.user
      ? {
          ...result.user,
          createdAt: result.user.createdAt.toISOString()
        }
      : null,
    recentActiveAt: result.recentActiveAt?.toISOString() ?? null,
    funnelStep: result.funnelStep ?? null,
    scoreOverview: result.scoreOverview,
    sessions: result.sessions.map((session) => ({
      ...session,
      entryDate: session.entryDate.toISOString(),
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      pausedAt: session.pausedAt?.toISOString() ?? null
    })),
    joyEntries: result.joyEntries.map((entry) => ({
      ...entry,
      updatedAt: entry.updatedAt.toISOString(),
      savedAt: entry.savedAt?.toISOString() ?? null
    })),
    dailyJournals: result.dailyJournals.map((entry) => ({
      ...entry,
      date: entry.date.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      savedAt: entry.savedAt?.toISOString() ?? null
    })),
    scores: result.scores.map((score) => ({
      ...score,
      date: score.date.toISOString(),
      updatedAt: score.updatedAt.toISOString()
    }))
  };
}

export async function getAdminAnalyticsSessionDetail(adminUsername: string, sessionId: string) {
  const session = await getAdminAnalyticsSessionDetailRecord(sessionId);

  if (session) {
    await recordAdminAuditLog({
      adminUsername,
      targetUserId: session.userId,
      resourceType: "interview_session",
      resourceId: session.id,
      action: "view_content"
    });
  }

  return session;
}

export async function getAdminAnalyticsEntryDetail(adminUsername: string, entryId: string) {
  const entry = await getAdminAnalyticsEntryDetailRecord(entryId);

  if (entry) {
    await recordAdminAuditLog({
      adminUsername,
      targetUserId: entry.userId,
      resourceType: "joy_entry",
      resourceId: entry.id,
      action: "view_content"
    });
  }

  return entry;
}

export async function getAdminAnalyticsDailyJournalDetail(adminUsername: string, id: string) {
  const entry = await getAdminAnalyticsDailyJournalDetailRecord(id);

  if (entry) {
    await recordAdminAuditLog({
      adminUsername,
      targetUserId: entry.userId,
      resourceType: "daily_journal",
      resourceId: entry.id,
      action: "view_content"
    });
  }

  return entry;
}
