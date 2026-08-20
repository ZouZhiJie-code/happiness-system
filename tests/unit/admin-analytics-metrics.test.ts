import {
  buildSequentialUniqueUserFunnel,
  calculateCurrentProductRetention,
  summarizeCurrentProductQuality
} from "@/features/admin-analytics/metrics";

describe("admin analytics v2 metrics", () => {
  it("counts each user once and requires every current-product funnel step in order", () => {
    const at = (value: string) => new Date(value);
    const result = buildSequentialUniqueUserFunnel([
      { userId: "user-1", step: "openedDay", occurredAt: at("2026-08-01T00:00:00.000Z") },
      { userId: "user-1", step: "openedDay", occurredAt: at("2026-08-01T00:00:01.000Z") },
      { userId: "user-1", step: "firstContentSubmitted", occurredAt: at("2026-08-01T00:02:00.000Z") },
      { userId: "user-1", step: "completeResponseReceived", occurredAt: at("2026-08-01T00:03:00.000Z") },
      { userId: "user-1", step: "eventCardSaved", occurredAt: at("2026-08-01T00:04:00.000Z") },
      { userId: "user-1", step: "dailyJournalGenerated", occurredAt: at("2026-08-01T00:05:00.000Z") },
      { userId: "user-1", step: "dailyJournalSaved", occurredAt: at("2026-08-01T00:06:00.000Z") },
      { userId: "user-2", step: "openedDay", occurredAt: at("2026-08-02T00:00:00.000Z") },
      { userId: "user-2", step: "completeResponseReceived", occurredAt: at("2026-08-02T00:02:00.000Z") },
      { userId: "user-3", step: "firstContentSubmitted", occurredAt: at("2026-08-03T00:00:00.000Z") }
    ]);

    expect(result).toEqual([
      { key: "openedDay", count: 2 },
      { key: "firstContentSubmitted", count: 1 },
      { key: "completeResponseReceived", count: 1 },
      { key: "eventCardSaved", count: 1 },
      { key: "dailyJournalGenerated", count: 1 },
      { key: "dailyJournalSaved", count: 1 }
    ]);
  });

  it("uses Shanghai natural dates, mature cohorts, return attempts, and distinct-day saves", () => {
    const result = calculateCurrentProductRetention({
      cohortRange: { startDate: "2026-07-01", endDate: "2026-07-31" },
      asOfDate: "2026-08-10",
      events: [
        { userId: "user-1", kind: "save", entryDate: "2026-07-01" },
        { userId: "user-1", kind: "content", entryDate: "2026-07-02" },
        { userId: "user-1", kind: "save", entryDate: "2026-07-02" },
        { userId: "user-2", kind: "save", entryDate: "2026-07-10" },
        { userId: "user-2", kind: "content", entryDate: "2026-07-17" },
        { userId: "user-2", kind: "save", entryDate: "2026-07-17" },
        { userId: "user-3", kind: "save", entryDate: "2026-07-31" },
        { userId: "user-3", kind: "content", entryDate: "2026-08-01" },
        { userId: "user-3", kind: "save", entryDate: "2026-07-31" },
        { userId: "outside", kind: "save", entryDate: "2026-06-30" },
        { userId: "outside", kind: "content", entryDate: "2026-07-01" }
      ]
    });

    expect(result.cohortUserCount).toBe(3);
    expect(result.eligibility).toEqual({
      d1EligibleUsers: 3,
      d7EligibleUsers: 3,
      d30EligibleUsers: 2
    });
    expect(result.rates).toEqual({
      d1ReturnToRecordRate: 2 / 3,
      d7ReturnToRecordRate: 1,
      d30ReturnToRecordRate: 1,
      d7RepeatSaveRate: 2 / 3,
      d30RepeatSaveRate: 1
    });
  });

  it("summarizes current response reliability and ignores invalid latency values", () => {
    const result = summarizeCurrentProductQuality({
      events: [
        {
          id: "response-1",
          eventName: "event_centered_response_completed",
          dedupeKey: "event_centered_response_completed:turn-1",
          properties: { visibleResponseReadyMs: 100, interactiveReadyMs: 300 }
        },
        {
          id: "response-2",
          eventName: "event_centered_response_completed",
          dedupeKey: "event_centered_response_completed:turn-2",
          properties: { visibleResponseReadyMs: 300, interactiveReadyMs: 900 }
        },
        {
          id: "response-invalid",
          eventName: "event_centered_response_completed",
          dedupeKey: "event_centered_response_completed:turn-3",
          properties: { visibleResponseReadyMs: "slow", interactiveReadyMs: -1 }
        },
        {
          id: "fallback-1",
          eventName: "event_centered_turn_fallback",
          dedupeKey: "event_centered_turn_fallback:turn-2",
          properties: {}
        },
        {
          id: "fallback-without-completion",
          eventName: "event_centered_turn_fallback",
          dedupeKey: "event_centered_turn_fallback:orphan-turn",
          properties: {}
        },
        {
          id: "resume-start-1",
          eventName: "event_centered_resume_started",
          dedupeKey: "event_centered_resume_started:turn-4:2",
          properties: {}
        },
        {
          id: "resume-complete-1",
          eventName: "event_centered_resume_completed",
          dedupeKey: "event_centered_resume_completed:turn-4:2",
          properties: {}
        },
        {
          id: "resume-failed-duplicate-terminal",
          eventName: "event_centered_resume_failed",
          dedupeKey: "event_centered_resume_failed:turn-4:2",
          properties: {}
        },
        {
          id: "resume-start-2",
          eventName: "event_centered_resume_started",
          dedupeKey: "event_centered_resume_started:turn-5:3",
          properties: {}
        },
        {
          id: "resume-failed-2",
          eventName: "event_centered_resume_failed",
          dedupeKey: "event_centered_resume_failed:turn-5:3",
          properties: {}
        },
        {
          id: "resume-failed-without-start",
          eventName: "event_centered_resume_failed",
          dedupeKey: "event_centered_resume_failed:orphan-turn:4",
          properties: {}
        }
      ],
      sessions: [
        { id: "session-1", status: "completed" },
        { id: "session-2", status: "abandoned" }
      ]
    });

    expect(result.fallbackRate).toBe(1 / 3);
    expect(result.abnormalExitRate).toBe(0.5);
    expect(result.resumeSuccessRate).toBe(0.5);
    expect(result.firstVisibleLatency).toEqual({ sampleCount: 2, p50Ms: 100, p95Ms: 300 });
    expect(result.fullInteractionLatency).toEqual({ sampleCount: 2, p50Ms: 300, p95Ms: 900 });
    expect(result.counts).toEqual({
      completedResponses: 3,
      fallbackTurns: 2,
      startedSessions: 2,
      abandonedSessions: 1,
      resumeStarted: 2,
      resumeCompleted: 1,
      resumeFailed: 1
    });
  });

  it("returns explicit zero values for empty cohorts and quality samples", () => {
    expect(calculateCurrentProductRetention({
      cohortRange: { startDate: "2026-08-01", endDate: "2026-08-31" },
      asOfDate: "2026-08-31",
      events: []
    })).toEqual({
      cohortUserCount: 0,
      eligibility: {
        d1EligibleUsers: 0,
        d7EligibleUsers: 0,
        d30EligibleUsers: 0
      },
      rates: {
        d1ReturnToRecordRate: 0,
        d7ReturnToRecordRate: 0,
        d30ReturnToRecordRate: 0,
        d7RepeatSaveRate: 0,
        d30RepeatSaveRate: 0
      }
    });
    expect(summarizeCurrentProductQuality({ events: [], sessions: [] })).toEqual({
      fallbackRate: 0,
      abnormalExitRate: 0,
      resumeSuccessRate: 0,
      firstVisibleLatency: { sampleCount: 0, p50Ms: null, p95Ms: null },
      fullInteractionLatency: { sampleCount: 0, p50Ms: null, p95Ms: null },
      counts: {
        completedResponses: 0,
        fallbackTurns: 0,
        startedSessions: 0,
        abandonedSessions: 0,
        resumeStarted: 0,
        resumeCompleted: 0,
        resumeFailed: 0
      }
    });
  });
});
