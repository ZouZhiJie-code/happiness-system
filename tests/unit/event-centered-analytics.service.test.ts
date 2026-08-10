const { recordAnalyticsEvent } = vi.hoisted(() => ({
  recordAnalyticsEvent: vi.fn()
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAnalyticsEvent
}));

import {
  recordEventCenteredAnalyticsEvent,
  type EventCenteredAnalyticsInput
} from "@/server/services/interview/event-centered-analytics.service";

describe("event-centered analytics service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordAnalyticsEvent.mockResolvedValue({ count: 1 });
  });

  it("records only the event funnel and reliability metadata", async () => {
    const input = {
      eventName: "event_centered_turn_fallback",
      userId: "user-1",
      rootSessionId: "root-1",
      journalEventId: "event-1",
      requestId: "request-1",
      requestedStrategy: "generative",
      effectiveStrategy: "baseline",
      failedStage: "visible",
      errorCode: "VISIBLE_RESPONSE_INVALID",
      attemptCount: 2,
      latencyMs: 860,
      visibleResponseReadyMs: 720,
      interactiveReadyMs: 860,
      initialWorkspaceReadMs: 40,
      turnReservationPersistenceMs: 90,
      factsAndOutcomesReadMs: 60,
      semanticModelMs: 280,
      visibleResponseModelMs: 190,
      modelMs: 470,
      nonModelMs: 390,
      writeCommitMs: 120,
      finalWorkspaceRecoveryMs: 80,
      dedupeKey: "event_centered_turn_fallback:turn-1",
      rawText: "这段用户原话不能进入埋点"
    } as EventCenteredAnalyticsInput & { rawText: string };

    await recordEventCenteredAnalyticsEvent(input);

    expect(recordAnalyticsEvent).toHaveBeenCalledWith({
      eventName: "event_centered_turn_fallback",
      userId: "user-1",
      sessionId: "root-1",
      entryId: null,
      requestId: "request-1",
      dedupeKey: "event_centered_turn_fallback:turn-1",
      properties: {
        journalEventId: "event-1",
        entryDate: null,
        source: null,
        stage: null,
        angle: null,
        checkpoint: null,
        requestedStrategy: "generative",
        effectiveStrategy: "baseline",
        strategyVersion: null,
        generativeAttempted: null,
        deterministicControlAction: null,
        failedStage: "visible",
        errorCode: "VISIBLE_RESPONSE_INVALID",
        attemptCount: 2,
        latencyMs: 860,
        visibleResponseReadyMs: 720,
        interactiveReadyMs: 860,
        initialWorkspaceReadMs: 40,
        turnReservationPersistenceMs: 90,
        factsAndOutcomesReadMs: 60,
        semanticModelMs: 280,
        visibleResponseModelMs: 190,
        modelMs: 470,
        nonModelMs: 390,
        writeCommitMs: 120,
        finalWorkspaceRecoveryMs: 80
      }
    });
    expect(recordAnalyticsEvent.mock.calls[0]?.[0]).not.toHaveProperty("rawText");
    expect(recordAnalyticsEvent.mock.calls[0]?.[0].properties).not.toHaveProperty("rawText");
  });

  it("does not interrupt the product flow when analytics storage fails", async () => {
    recordAnalyticsEvent.mockRejectedValue(new Error("analytics unavailable"));

    await expect(recordEventCenteredAnalyticsEvent({
      eventName: "event_journal_saved",
      userId: "user-1",
      rootSessionId: "root-1",
      journalEventId: "event-1",
      journalEntryId: "entry-1",
      dedupeKey: "event_journal_saved:entry-1:1"
    })).resolves.toBeUndefined();
  });
});
