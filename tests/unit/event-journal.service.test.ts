import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  JournalEventEntryGenerationRecord,
  JournalEventEntryRecord,
  JournalEventEntrySourceSnapshot
} from "@/types/journal-event-entry";

const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  cancel: vi.fn(),
  getEntry: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  recordInvocation: vi.fn(),
  appendDecision: vi.fn(),
  assertDay: vi.fn()
}));

vi.mock("@/server/repositories/journal-event-entry.repository", () => ({
  reserveJournalEventEntryGeneration: mocks.reserve,
  completeJournalEventEntryGeneration: mocks.complete,
  failJournalEventEntryGeneration: mocks.fail,
  cancelJournalEventEntryGeneration: mocks.cancel,
  getJournalEventEntryForUser: mocks.getEntry,
  updateJournalEventEntry: mocks.update,
  saveJournalEventEntry: mocks.save
}));

vi.mock("@/server/repositories/ai-quality.repository", () => ({
  recordAIInvocation: mocks.recordInvocation,
  appendGenerationTraceDecision: mocks.appendDecision
}));

vi.mock("@/server/repositories/journal-day-mode.repository", () => ({
  assertJournalDayMode: mocks.assertDay
}));

vi.mock("@/server/services/ai-quality/prompt-optimization.service", () => ({
  resolveOptimizedPromptEnvelope: vi.fn(async (envelope) => envelope)
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider: vi.fn(async () => null)
}));

import {
  generateEventJournal,
  getEventJournalEntryView,
  saveEventJournalEntry,
  updateEventJournalEntry
} from "@/server/services/journal-event/event-journal.service";

function sourceSnapshot(): JournalEventEntrySourceSnapshot {
  return {
    schemaVersion: 1,
    eventId: "event-1",
    branchSessionId: "branch-1",
    baseMessageSequence: 2,
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
      }
    ],
    effectiveFactIds: ["fact-1"],
    deprioritizedFactIds: [],
    explorationFactIds: ["fact-1"],
    angleOutcomes: [],
    logEligibleOutcomeIds: [],
    pendingClaimConfirmation: {
      kind: "no_eligible_claim",
      claimId: null,
      factId: null
    }
  };
}

function generation(): JournalEventEntryGenerationRecord {
  return {
    id: "generation-1",
    eventId: "event-1",
    branchSessionId: "branch-1",
    userTurnId: "turn-1",
    traceId: "trace-1",
    clientOperationId: "operation-1",
    intendedEntryId: "entry-1",
    status: "processing",
    attemptCount: 1,
    baseMessageSequence: 2,
    sourceMessageIds: ["message-1"],
    sourceFactIds: ["fact-1"],
    sourceAngleOutcomeIds: [],
    sourceFingerprint: "a".repeat(64),
    sourceSnapshot: sourceSnapshot(),
    errorCode: null,
    startedAt: "2026-07-23T08:00:00.000Z",
    completedAt: null,
    failedAt: null,
    canceledAt: null,
    createdAt: "2026-07-23T08:00:00.000Z",
    updatedAt: "2026-07-23T08:00:00.000Z"
  };
}

function entry(overrides: Partial<JournalEventEntryRecord> = {}): JournalEventEntryRecord {
  return {
    id: "entry-1",
    eventId: "event-1",
    entryDate: "2026-07-23T00:00:00.000Z",
    daySequence: 1,
    sourceBranchSessionId: "branch-1",
    generatedByTurnId: "turn-1",
    currentGenerationTraceId: "trace-1",
    generationId: "generation-1",
    title: "那次误会",
    content: "我和同事之间的误会后来被说清楚了。",
    status: "draft",
    generationOrigin: "llm",
    generationVersion: 1,
    sourceMessageSequence: 2,
    sourceMessageIds: ["message-1"],
    sourceFactIds: ["fact-1"],
    sourceAngleOutcomeIds: [],
    sourceFingerprint: "a".repeat(64),
    sourceSnapshot: sourceSnapshot(),
    contentRevision: 1,
    savedRevision: null,
    editedAt: "2026-07-23T08:00:00.000Z",
    savedAt: null,
    createdAt: "2026-07-23T08:00:00.000Z",
    updatedAt: "2026-07-23T08:00:00.000Z",
    ...overrides
  };
}

const input = {
  userId: "user-1",
  eventId: "event-1",
  activeBranchSessionId: "branch-1",
  clientOperationId: "operation-1",
  baseMessageSequence: 2,
  requestId: "request-1"
};

describe("event journal service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reserve.mockResolvedValue({
      kind: "generation",
      generation: generation(),
      reservedNow: true
    });
    mocks.complete.mockResolvedValue(entry());
    mocks.fail.mockResolvedValue({ ...generation(), status: "failed" });
    mocks.cancel.mockResolvedValue({ ...generation(), status: "canceled" });
    mocks.getEntry.mockResolvedValue(entry());
    mocks.update.mockResolvedValue(entry({ contentRevision: 2 }));
    mocks.save.mockResolvedValue(entry({ status: "saved", savedRevision: 1 }));
    mocks.recordInvocation.mockResolvedValue(undefined);
    mocks.appendDecision.mockResolvedValue(undefined);
    mocks.assertDay.mockResolvedValue(undefined);
  });

  it("uses a grounded structured AI draft and completes the reserved operation", async () => {
    const phases: string[] = [];
    const onReserved = vi.fn();
    const provider = {
      name: "mock",
      complete: vi.fn(async () => ({
        content: JSON.stringify({
          title: "那次误会",
          eventNarrative: "我和同事之间的误会后来被说清楚了。",
          insights: []
        }),
        latencyMs: 12,
        provider: "mock"
      }))
    };
    const result = await generateEventJournal(input, {
      provider,
      releaseMode: "event_centered",
      onPhase: (phase) => {
        phases.push(phase);
      },
      onReserved
    });

    expect(result).toMatchObject({
      kind: "entry",
      entry: { id: "entry-1" },
      generationId: "generation-1",
      outputOrigin: "llm",
      usedFallback: false
    });
    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-1",
        title: "那次误会",
        outputOrigin: "llm",
        qualityChecks: {
          sourceGrounded: true,
          basicQualityPassed: true
        }
      })
    );
    expect(phases).toEqual([
      "journal_source",
      "journal_drafting",
      "journal_checking",
      "complete"
    ]);
    expect(onReserved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "generation-1",
        userTurnId: "turn-1",
        clientOperationId: "operation-1"
      }),
      true
    );
  });

  it("uses the truthful basic version when the provider is unavailable", async () => {
    const result = await generateEventJournal(input, {
      provider: null,
      releaseMode: "event_centered"
    });

    expect(result.outputOrigin).toBe("fallback");
    expect(result.usedFallback).toBe(true);
    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "那次误会",
        content: "我和同事发生了一次误会，后来把事情说清楚了。",
        outputOrigin: "fallback"
      })
    );
  });

  it("returns an existing entry without invoking the provider", async () => {
    const existing = entry({ generationOrigin: "fallback" });
    mocks.reserve.mockResolvedValue({ kind: "entry", entry: existing });
    const provider = { name: "mock", complete: vi.fn() };

    await expect(
      generateEventJournal(input, { provider, releaseMode: "event_centered" })
    ).resolves.toMatchObject({
      kind: "entry",
      entry: existing,
      outputOrigin: "fallback",
      usedFallback: true
    });
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("returns the existing processing operation without starting a duplicate model call", async () => {
    mocks.reserve.mockResolvedValue({
      kind: "generation",
      generation: generation(),
      reservedNow: false
    });
    const provider = { name: "mock", complete: vi.fn() };
    const onReserved = vi.fn();

    await expect(
      generateEventJournal(input, {
        provider,
        releaseMode: "event_centered",
        onReserved
      })
    ).resolves.toEqual({
      kind: "processing",
      entry: null,
      generationId: "generation-1",
      outputOrigin: null,
      usedFallback: false
    });
    expect(onReserved).toHaveBeenCalledWith(
      expect.objectContaining({ id: "generation-1" }),
      false
    );
    expect(provider.complete).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("fails safely when neither the AI draft nor the basic version passes", async () => {
    const invalidGeneration = generation();
    invalidGeneration.sourceSnapshot.facts[0]!.statement = "JournalEvent 内部状态";
    mocks.reserve.mockResolvedValue({
      kind: "generation",
      generation: invalidGeneration,
      reservedNow: true
    });

    await expect(
      generateEventJournal(input, { provider: null, releaseMode: "event_centered" })
    ).rejects.toThrow("EVENT_JOURNAL_QUALITY_CHECK_FAILED");
    expect(mocks.fail).toHaveBeenCalledWith({
      userId: "user-1",
      generationId: "generation-1",
      errorCode: "EVENT_JOURNAL_QUALITY_CHECK_FAILED"
    });
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("exposes only editable entry fields and checks day ownership before writes", async () => {
    await expect(
      getEventJournalEntryView({ userId: "user-1", entryId: "entry-1" })
    ).resolves.toEqual({
      entry: {
        id: "entry-1",
        eventId: "event-1",
        title: "那次误会",
        content: "我和同事之间的误会后来被说清楚了。",
        status: "draft",
        contentRevision: 1,
        savedRevision: null,
        updatedAt: "2026-07-23T08:00:00.000Z",
        savedAt: null
      }
    });

    await updateEventJournalEntry({
      userId: "user-1",
      entryId: "entry-1",
      expectedContentRevision: 1,
      title: "更新标题",
      content: "更新正文",
      releaseMode: "event_centered"
    });
    await saveEventJournalEntry({
      userId: "user-1",
      entryId: "entry-1",
      expectedContentRevision: 1,
      releaseMode: "event_centered"
    });
    expect(mocks.assertDay).toHaveBeenCalledTimes(2);
    expect(mocks.assertDay).toHaveBeenCalledWith({
      userId: "user-1",
      entryDate: "2026-07-23",
      mode: "event_centered"
    });
  });
});
