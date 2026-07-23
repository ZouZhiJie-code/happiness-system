import type { JournalEventAngleOutcomeRecord } from "@/types/journal-event-angle-outcome";
import type { JournalEventEntrySourceSnapshot } from "@/types/journal-event-entry";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";
import type { JournalDailySourceEntry } from "@/types/journal-daily-entry";

const NOW = "2026-07-23T08:00:00.000Z";

export function createEventSnapshot(input: {
  eventId: string;
  facts: Array<{
    id: string;
    statement: string;
    effective?: boolean;
    deprioritized?: boolean;
    stance?: JournalEventFactRecord["stance"];
  }>;
  outcomes?: Array<{
    id: string;
    statement: string;
    eligible?: boolean;
  }>;
}): JournalEventEntrySourceSnapshot {
  const branchSessionId = `${input.eventId}-branch`;
  const facts: JournalEventFactRecord[] = input.facts.map((fact, index) => ({
    id: fact.id,
    eventId: input.eventId,
    createdBranchSessionId: branchSessionId,
    pathAnchorMessageId: `${input.eventId}-message-${index + 1}`,
    createdByRevisionId: null,
    statement: fact.statement,
    scope: "current_event",
    stance: fact.stance ?? "affirmed",
    kind: "event_detail",
    origin: "user_expression",
    createdAt: NOW,
    evidence: []
  }));
  const angleOutcomes: JournalEventAngleOutcomeRecord[] = (input.outcomes ?? []).map(
    (outcome, index) => ({
      id: outcome.id,
      eventId: input.eventId,
      branchSessionId,
      sourceTurnId: `${input.eventId}-turn-${index + 1}`,
      assistantMessageId: `${input.eventId}-assistant-${index + 1}`,
      generationTraceId: null,
      angle: (["feeling", "thought", "relationship", "action"] as const)[index % 4]!,
      kind: "insight",
      statement: outcome.statement,
      createdAt: NOW,
      facts: []
    })
  );

  return {
    schemaVersion: 1,
    eventId: input.eventId,
    branchSessionId,
    baseMessageSequence: Math.max(1, facts.length),
    messages: [],
    facts,
    effectiveFactIds: input.facts
      .filter((fact) => fact.effective !== false)
      .map((fact) => fact.id),
    deprioritizedFactIds: input.facts
      .filter((fact) => fact.deprioritized)
      .map((fact) => fact.id),
    explorationFactIds: input.facts
      .filter((fact) => fact.effective !== false && !fact.deprioritized)
      .map((fact) => fact.id),
    angleOutcomes,
    logEligibleOutcomeIds: (input.outcomes ?? [])
      .filter((outcome) => outcome.eligible !== false)
      .map((outcome) => outcome.id),
    pendingClaimConfirmation: {
      kind: "no_eligible_claim",
      claimId: null,
      factId: null
    }
  };
}

export function createDailySource(input: {
  eventId: string;
  sequence: number;
  title: string;
  content: string;
}): JournalDailySourceEntry {
  return {
    eventId: input.eventId,
    entryId: `${input.eventId}-entry`,
    entryDate: "2026-07-23",
    daySequence: input.sequence,
    title: input.title,
    content: input.content,
    savedRevision: 1,
    savedAt: NOW
  };
}
