import {
  buildAdminAnalyticsDrilldownHref,
  buildAdminAnalyticsRangePresetHrefs,
  buildAdminAnalyticsViewHref,
  normalizeAdminAnalyticsSearchParams
} from "@/features/admin-analytics/view-state";

describe("admin analytics view state", () => {
  it("defaults to review with dynamic last-30-day range", () => {
    const result = normalizeAdminAnalyticsSearchParams({}, "2026-05-21");

    expect(result.view).toBe("review");
    expect(result.range).toEqual({
      startDate: "2026-04-22",
      endDate: "2026-05-21"
    });
    expect(result.username).toBeNull();
    expect(result.hasSavedJournal).toBe(false);
    expect(result.hasBoundaryInsufficient).toBe(false);
    expect(result.hasReopenedSession).toBe(false);
  });

  it("activates candidate search state from query params", () => {
    const result = normalizeAdminAnalyticsSearchParams({
      view: "monitor",
      startDate: "2026-05-01",
      endDate: "2026-05-21",
      username: " daily ",
      hasSavedJournal: "1",
      hasBoundaryInsufficient: "1",
      hasReopenedSession: "1",
      userId: "user-1",
      sessionId: "session-1",
      entryId: "entry-1",
      dailyJournalId: "daily-1"
    });

    expect(result.view).toBe("monitor");
    expect(result.username).toBe("daily");
    expect(result.hasSavedJournal).toBe(true);
    expect(result.hasBoundaryInsufficient).toBe(true);
    expect(result.hasReopenedSession).toBe(true);
    expect(result.userId).toBe("user-1");
    expect(result.sessionId).toBe("session-1");
    expect(result.entryId).toBe("entry-1");
    expect(result.dailyJournalId).toBe("daily-1");
  });

  it("keeps search state but clears deep detail when switching view", () => {
    const href = buildAdminAnalyticsViewHref({
      view: "monitor",
      range: {
        startDate: "2026-04-22",
        endDate: "2026-05-21"
      },
      username: "daily",
      hasSavedJournal: true,
      hasBoundaryInsufficient: false,
      hasReopenedSession: true,
      userId: "user-1",
      sessionId: "session-1",
      entryId: "entry-1",
      dailyJournalId: "daily-1"
    });

    expect(href).toBe(
      "/admin/analytics?view=monitor&startDate=2026-04-22&endDate=2026-05-21&userId=user-1&username=daily&hasSavedJournal=1&hasReopenedSession=1"
    );
  });

  it("keeps search state but clears deep detail in range preset links", () => {
    const presets = buildAdminAnalyticsRangePresetHrefs({
      view: "review",
      range: {
        startDate: "2026-04-22",
        endDate: "2026-05-21"
      },
      username: "daily",
      hasSavedJournal: false,
      hasBoundaryInsufficient: true,
      hasReopenedSession: true,
      userId: "user-1",
      sessionId: "session-1",
      entryId: "entry-1",
      dailyJournalId: "daily-1"
    });

    expect(presets[0]?.href).toBe(
      "/admin/analytics?view=review&startDate=2026-05-15&endDate=2026-05-21&userId=user-1&username=daily&hasBoundaryInsufficient=1&hasReopenedSession=1"
    );
    expect(presets[1]?.href).toBe(
      "/admin/analytics?view=review&startDate=2026-04-22&endDate=2026-05-21&userId=user-1&username=daily&hasBoundaryInsufficient=1&hasReopenedSession=1"
    );
  });

  it("includes deep detail only for explicit drilldown links", () => {
    const href = buildAdminAnalyticsDrilldownHref({
      view: "review",
      range: {
        startDate: "2026-04-22",
        endDate: "2026-05-21"
      },
      username: "daily",
      hasSavedJournal: false,
      hasBoundaryInsufficient: false,
      hasReopenedSession: false,
      userId: "user-1",
      sessionId: "session-1",
      entryId: "entry-1",
      dailyJournalId: "daily-1"
    });

    expect(href).toBe(
      "/admin/analytics?view=review&startDate=2026-04-22&endDate=2026-05-21&userId=user-1&username=daily&sessionId=session-1&entryId=entry-1&dailyJournalId=daily-1"
    );
  });
});
