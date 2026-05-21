import React from "react";

import { AdminAnalyticsShell } from "@/components/admin/admin-analytics-shell";
import { normalizeAdminAnalyticsSearchParams } from "@/features/admin-analytics/view-state";
import { requireAdminPage } from "@/server/services/auth/auth-page-guard";
import {
  getAdminAnalyticsDailyJournalDetail,
  getAdminAnalyticsEntryDetail,
  getAdminAnalyticsFunnel,
  getAdminAnalyticsOverview,
  getAdminAnalyticsQuality,
  getAdminAnalyticsRetention,
  getAdminAnalyticsSessionDetail,
  getAdminAnalyticsUserDetail,
  listAdminAnalyticsUsers
} from "@/server/services/admin-analytics/admin-analytics.service";

type AdminAnalyticsPageProps = {
  searchParams: Promise<{
    view?: string;
    startDate?: string;
    endDate?: string;
    username?: string;
    hasSavedJournal?: string;
    hasBoundaryInsufficient?: string;
    hasReopenedSession?: string;
    hasFailure?: string;
    hasReturnVisit?: string;
    userId?: string;
    sessionId?: string;
    entryId?: string;
    dailyJournalId?: string;
  }>;
};

export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
  const admin = await requireAdminPage("/admin/analytics");
  const resolvedSearchParams = await searchParams;
  const normalized = normalizeAdminAnalyticsSearchParams(resolvedSearchParams ?? {});
  const range = normalized.range;
  const [overview, funnel, retention, quality, users] = await Promise.all([
    getAdminAnalyticsOverview(range),
    getAdminAnalyticsFunnel(range),
    getAdminAnalyticsRetention(range),
    getAdminAnalyticsQuality(range),
    listAdminAnalyticsUsers({
      ...range,
      username: normalized.username ?? undefined,
      hasSavedJournal: normalized.hasSavedJournal,
      hasBoundaryInsufficient: normalized.hasBoundaryInsufficient,
      hasReopenedSession: normalized.hasReopenedSession
    })
  ]);
  const [userDetail, sessionDetail, entryDetail, dailyJournalDetail] = await Promise.all([
    normalized.userId ? getAdminAnalyticsUserDetail(normalized.userId) : Promise.resolve(null),
    normalized.sessionId
      ? getAdminAnalyticsSessionDetail(admin.username, normalized.sessionId)
      : Promise.resolve(null),
    normalized.entryId
      ? getAdminAnalyticsEntryDetail(admin.username, normalized.entryId)
      : Promise.resolve(null),
    normalized.dailyJournalId
      ? getAdminAnalyticsDailyJournalDetail(admin.username, normalized.dailyJournalId)
      : Promise.resolve(null)
  ]);

  return (
    <div className="min-h-0 flex-1">
      <AdminAnalyticsShell
        overview={overview}
        funnel={funnel}
        retention={retention}
        quality={quality}
        users={users}
        range={range}
        view={normalized.view}
        username={normalized.username}
        hasSavedJournal={normalized.hasSavedJournal}
        hasBoundaryInsufficient={normalized.hasBoundaryInsufficient}
        hasReopenedSession={normalized.hasReopenedSession}
        selectedUserId={normalized.userId}
        userDetail={userDetail}
        sessionDetail={sessionDetail}
        entryDetail={entryDetail}
        dailyJournalDetail={dailyJournalDetail}
      />
    </div>
  );
}
