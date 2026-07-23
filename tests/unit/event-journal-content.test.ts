import { describe, expect, it } from "vitest";

import {
  buildEventJournalFallbackDraft,
  composeEventJournalContent,
  evaluateEventJournalDraft,
  normalizeEventJournalDraft
} from "@/features/journal-event/content";
import type { JournalEventEntrySourceSnapshot } from "@/types/journal-event-entry";

function snapshot(overrides: Partial<JournalEventEntrySourceSnapshot> = {}): JournalEventEntrySourceSnapshot {
  return {
    schemaVersion: 1,
    eventId: "event-1",
    branchSessionId: "branch-1",
    baseMessageSequence: 4,
    messages: [
      { id: "message-1", role: "user", sequence: 1, content: "我和同事有一次误会。" }
    ],
    facts: [
      {
        id: "fact-1",
        eventId: "event-1",
        createdBranchSessionId: "branch-1",
        pathAnchorMessageId: "message-1",
        createdByRevisionId: null,
        statement: "我和同事发生了一次误会，后来把事情说清楚了",
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        origin: "user_expression",
        createdAt: "2026-07-23T08:00:00.000Z",
        evidence: []
      },
      {
        id: "fact-2",
        eventId: "event-1",
        createdBranchSessionId: "branch-1",
        pathAnchorMessageId: "message-1",
        createdByRevisionId: null,
        statement: "比起争个对错，我更在意彼此能把话说清楚",
        scope: "current_event",
        stance: "affirmed",
        kind: "stated_preference",
        origin: "user_expression",
        createdAt: "2026-07-23T08:01:00.000Z",
        evidence: []
      }
    ],
    effectiveFactIds: ["fact-1", "fact-2"],
    deprioritizedFactIds: [],
    explorationFactIds: ["fact-1", "fact-2"],
    angleOutcomes: [
      {
        id: "outcome-1",
        eventId: "event-1",
        branchSessionId: "branch-1",
        sourceTurnId: "turn-1",
        assistantMessageId: "message-2",
        generationTraceId: null,
        angle: "relationship",
        kind: "insight",
        statement: "比起争个对错，我更在意彼此把话说清楚",
        createdAt: "2026-07-23T08:02:00.000Z",
        facts: []
      }
    ],
    logEligibleOutcomeIds: ["outcome-1"],
    pendingClaimConfirmation: {
      kind: "no_eligible_claim",
      claimId: null,
      factId: null
    },
    ...overrides
  };
}

describe("event journal content policy", () => {
  it("keeps the narrative and eligible outcome in one continuous journal", () => {
    const source = snapshot();
    const draft = normalizeEventJournalDraft(source, {
      title: "那次误会",
      eventNarrative: "我和同事之间的误会后来被说清楚了。",
      insights: [
        {
          sourceOutcomeId: "outcome-1",
          text: "比起争个对错，我更在意彼此把话说清楚。"
        }
      ]
    });
    const quality = evaluateEventJournalDraft({ snapshot: source, draft });

    expect(quality).toEqual({
      accepted: true,
      issues: [],
      sourceGrounded: true,
      basicQualityPassed: true
    });
    expect(composeEventJournalContent(draft)).toBe(
      "我和同事之间的误会后来被说清楚了。\n\n我看见的\n比起争个对错，我更在意彼此把话说清楚。"
    );
  });

  it("creates a truthful basic version and omits the insight section for light records", () => {
    const source = snapshot({
      angleOutcomes: [],
      logEligibleOutcomeIds: []
    });
    const fallback = buildEventJournalFallbackDraft(source);

    expect(fallback).not.toBeNull();
    expect(fallback?.title).toBe("那次误会");
    expect(fallback?.insights).toEqual([]);
    expect(
      evaluateEventJournalDraft({ snapshot: source, draft: fallback! }).accepted
    ).toBe(true);
    expect(composeEventJournalContent(fallback!)).not.toContain("我看见的");
  });

  it("rejects missing or unknown outcome sources", () => {
    const source = snapshot();
    const quality = evaluateEventJournalDraft({
      snapshot: source,
      draft: {
        title: "那次误会",
        eventNarrative: "我和同事之间的误会后来被说清楚了。",
        insights: [
          {
            sourceOutcomeId: "outcome-other",
            text: "我其实一直需要别人认可。"
          }
        ]
      }
    });

    expect(quality.accepted).toBe(false);
    expect(quality.issues).toEqual(
      expect.arrayContaining(["unknown_outcome", "missing_eligible_outcome"])
    );
    expect(quality.sourceGrounded).toBe(false);
  });

  it("blocks unsupported diagnosis, advice and numbers", () => {
    const source = snapshot({ angleOutcomes: [], logEligibleOutcomeIds: [] });
    const quality = evaluateEventJournalDraft({
      snapshot: source,
      draft: {
        title: "那次误会",
        eventNarrative:
          "我和同事之间的误会后来被说清楚了。这说明我有焦虑症，我应该连续休息30天。",
        insights: []
      }
    });

    expect(quality.accepted).toBe(false);
    expect(quality.issues).toEqual(
      expect.arrayContaining([
        "unsupported_number",
        "unsupported_diagnosis",
        "unsupported_advice"
      ])
    );
  });

  it("blocks a fabricated consequence appended to a grounded event", () => {
    const source = snapshot({ angleOutcomes: [], logEligibleOutcomeIds: [] });
    const quality = evaluateEventJournalDraft({
      snapshot: source,
      draft: {
        title: "那次误会",
        eventNarrative:
          "我和同事之间的误会后来被说清楚了，所以我决定辞职离开城市。",
        insights: []
      }
    });

    expect(quality.accepted).toBe(false);
    expect(quality.issues).toContain("narrative_not_grounded");
    expect(quality.sourceGrounded).toBe(false);
  });

  it("accepts a natural rewrite when every proposition stays within the sources", () => {
    const source = snapshot();
    const quality = evaluateEventJournalDraft({
      snapshot: source,
      draft: {
        title: "那次误会",
        eventNarrative:
          "我和同事之间发生了误会，后来我们把事情说清楚了。",
        insights: [
          {
            sourceOutcomeId: "outcome-1",
            text: "比起争个对错，我更在意彼此把话说清楚。"
          }
        ]
      }
    });

    expect(quality).toEqual({
      accepted: true,
      issues: [],
      sourceGrounded: true,
      basicQualityPassed: true
    });
  });
});
