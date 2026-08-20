import { recordAnalyticsEvent } from "@/server/repositories/admin-analytics.repository";

export const EVENT_CENTERED_ANALYTICS_EVENTS = [
  "event_centered_entry_exposed",
  "event_centered_entry_opened",
  "event_centered_first_content_submitted",
  "event_centered_response_completed",
  "event_centered_checkpoint_reached",
  "event_journal_generation_started",
  "event_journal_generated",
  "event_journal_saved",
  "event_centered_turn_fallback",
  "event_centered_session_abandoned",
  "event_centered_resume_started",
  "event_centered_resume_completed",
  "event_centered_resume_failed"
] as const;

export type EventCenteredAnalyticsEventName =
  (typeof EVENT_CENTERED_ANALYTICS_EVENTS)[number];

/**
 * 事件中心只记录漏斗、策略和可靠性元数据。这个输入有意不接受用户原话、
 * AI 文案或日志正文，避免业务调用方把内容写进 AnalyticsEvent。
 */
export type EventCenteredAnalyticsInput = {
  eventName: EventCenteredAnalyticsEventName;
  userId: string;
  dedupeKey: string;
  rootSessionId?: string | null;
  journalEventId?: string | null;
  journalEntryId?: string | null;
  requestId?: string | null;
  entryDate?: string | null;
  source?: "optional_entry" | "default_entry" | "deep_link" | "resume" | null;
  stage?: string | null;
  angle?: string | null;
  checkpoint?: "first" | "second" | "deep_pause" | null;
  requestedStrategy?: string | null;
  effectiveStrategy?: string | null;
  strategyVersion?: string | null;
  generativeAttempted?: boolean | null;
  deterministicControlAction?: string | null;
  eventRecordingRecognition?: boolean | null;
  correctionRepairApplied?: boolean | null;
  generativeRepairApplied?: boolean | null;
  localDeterministicRepairApplied?: boolean | null;
  failedStage?: string | null;
  errorCode?: string | null;
  attemptCount?: number | null;
  latencyMs?: number | null;
  visibleResponseReadyMs?: number | null;
  interactiveReadyMs?: number | null;
  initialWorkspaceReadMs?: number | null;
  turnReservationPersistenceMs?: number | null;
  factsAndOutcomesReadMs?: number | null;
  semanticModelMs?: number | null;
  visibleResponseModelMs?: number | null;
  modelMs?: number | null;
  nonModelMs?: number | null;
  writeCommitMs?: number | null;
  finalWorkspaceRecoveryMs?: number | null;
};

/** 埋点失败只影响观测，不中断访谈、日志或页面渲染。 */
export async function recordEventCenteredAnalyticsEvent(
  input: EventCenteredAnalyticsInput
): Promise<void> {
  try {
    await recordAnalyticsEvent({
      eventName: input.eventName,
      userId: input.userId,
      sessionId: input.rootSessionId ?? null,
      entryId: input.journalEntryId ?? null,
      requestId: input.requestId ?? null,
      dedupeKey: input.dedupeKey,
      properties: {
        journalEventId: input.journalEventId ?? null,
        entryDate: input.entryDate ?? null,
        source: input.source ?? null,
        stage: input.stage ?? null,
        angle: input.angle ?? null,
        checkpoint: input.checkpoint ?? null,
        requestedStrategy: input.requestedStrategy ?? null,
        effectiveStrategy: input.effectiveStrategy ?? null,
        strategyVersion: input.strategyVersion ?? null,
        generativeAttempted: input.generativeAttempted ?? null,
        deterministicControlAction: input.deterministicControlAction ?? null,
        ...(input.eventRecordingRecognition === undefined
          ? {}
          : { eventRecordingRecognition: input.eventRecordingRecognition }),
        ...(input.correctionRepairApplied === undefined
          ? {}
          : { correctionRepairApplied: input.correctionRepairApplied }),
        ...(input.generativeRepairApplied === undefined
          ? {}
          : { generativeRepairApplied: input.generativeRepairApplied }),
        ...(input.localDeterministicRepairApplied === undefined
          ? {}
          : { localDeterministicRepairApplied: input.localDeterministicRepairApplied }),
        failedStage: input.failedStage ?? null,
        errorCode: input.errorCode ?? null,
        attemptCount: input.attemptCount ?? null,
        latencyMs: input.latencyMs ?? null,
        visibleResponseReadyMs: input.visibleResponseReadyMs ?? null,
        interactiveReadyMs: input.interactiveReadyMs ?? null,
        initialWorkspaceReadMs: input.initialWorkspaceReadMs ?? null,
        turnReservationPersistenceMs: input.turnReservationPersistenceMs ?? null,
        factsAndOutcomesReadMs: input.factsAndOutcomesReadMs ?? null,
        semanticModelMs: input.semanticModelMs ?? null,
        visibleResponseModelMs: input.visibleResponseModelMs ?? null,
        modelMs: input.modelMs ?? null,
        nonModelMs: input.nonModelMs ?? null,
        writeCommitMs: input.writeCommitMs ?? null,
        finalWorkspaceRecoveryMs: input.finalWorkspaceRecoveryMs ?? null
      }
    });
  } catch {
    // Analytics is observational and must never interrupt the user flow.
  }
}
