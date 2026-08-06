/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { enqueueJournalEventAngleRepairsWithClient } from "@/server/repositories/journal-event-angle-repair.repository";

const now = new Date("2026-07-22T12:00:00.000Z");

function outcome(input: {
  id: string;
  assistantMessageId: string;
  factId: string;
  createdOffset: number;
  contextFactId?: string;
}) {
  return {
    id: input.id,
    assistantMessageId: input.assistantMessageId,
    angle: "feeling" as const,
    createdAt: new Date(now.getTime() + input.createdOffset),
    facts: [
      { factId: input.factId, role: "support" as const },
      ...(input.contextFactId
        ? [{ factId: input.contextFactId, role: "context" as const }]
        : [])
    ]
  };
}

describe("journal event angle repair enqueue", () => {
  const database = {
    journalEventAngleOutcome: { findMany: vi.fn() },
    journalEventAngleOutcomeRepair: { createMany: vi.fn() }
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    database.journalEventAngleOutcomeRepair.createMany.mockResolvedValue({ count: 1 });
  });

  it("只为每个角度的当前最新成果建立修复", async () => {
    database.journalEventAngleOutcome.findMany.mockResolvedValue([
      outcome({
        id: "outcome-history",
        assistantMessageId: "assistant-history",
        factId: "fact-invalidated",
        createdOffset: 1
      }),
      outcome({
        id: "outcome-current",
        assistantMessageId: "assistant-current",
        factId: "fact-current",
        createdOffset: 2
      })
    ]);

    const result = await enqueueJournalEventAngleRepairsWithClient(database, {
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      factRevisionId: "revision-1",
      pathAnchorMessageId: "user-correction",
      effectiveMessageIds: [
        "assistant-history",
        "assistant-current",
        "user-correction"
      ],
      effectiveFactIdsBefore: ["fact-invalidated", "fact-current"],
      invalidatedFactIds: ["fact-invalidated"]
    });

    expect(result).toEqual({
      repairIds: [],
      affectedOutcomeIds: [],
      repairPendingAngles: []
    });
    expect(database.journalEventAngleOutcomeRepair.createMany).not.toHaveBeenCalled();
  });

  it("当前最新成果依赖失效事实时建立待修复记录", async () => {
    database.journalEventAngleOutcome.findMany.mockResolvedValue([
      outcome({
        id: "outcome-current",
        assistantMessageId: "assistant-current",
        factId: "fact-invalidated",
        createdOffset: 2
      })
    ]);

    const result = await enqueueJournalEventAngleRepairsWithClient(database, {
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      factRevisionId: "revision-1",
      pathAnchorMessageId: "user-correction",
      effectiveMessageIds: ["assistant-current", "user-correction"],
      effectiveFactIdsBefore: ["fact-invalidated"],
      invalidatedFactIds: ["fact-invalidated"]
    });

    expect(result.affectedOutcomeIds).toEqual(["outcome-current"]);
    expect(result.repairPendingAngles).toEqual(["feeling"]);
    expect(database.journalEventAngleOutcomeRepair.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventId: "event-1",
          branchSessionId: "branch-1",
          factRevisionId: "revision-1",
          priorOutcomeId: "outcome-current",
          angle: "feeling"
        })
      ],
      skipDuplicates: true
    });
  });

  it("当前成果引用的背景 context 被纠正时同样建立修复", async () => {
    database.journalEventAngleOutcome.findMany.mockResolvedValue([
      outcome({
        id: "outcome-with-background",
        assistantMessageId: "assistant-current",
        factId: "fact-current",
        contextFactId: "fact-background",
        createdOffset: 2
      })
    ]);

    const result = await enqueueJournalEventAngleRepairsWithClient(database, {
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      factRevisionId: "revision-background",
      pathAnchorMessageId: "user-correction",
      effectiveMessageIds: ["assistant-current", "user-correction"],
      effectiveFactIdsBefore: ["fact-current", "fact-background"],
      invalidatedFactIds: ["fact-background"]
    });

    expect(result.affectedOutcomeIds).toEqual(["outcome-with-background"]);
    expect(result.repairPendingAngles).toEqual(["feeling"]);
  });

  it("直接纠正指定成果时保留事实并只为该成果建立修复", async () => {
    database.journalEventAngleOutcome.findMany.mockResolvedValue([
      outcome({
        id: "outcome-target",
        assistantMessageId: "assistant-target",
        factId: "fact-kept",
        createdOffset: 2
      })
    ]);

    const result = await enqueueJournalEventAngleRepairsWithClient(database, {
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      factRevisionId: "revision-outcome",
      pathAnchorMessageId: "user-correction",
      effectiveMessageIds: ["assistant-target", "user-correction"],
      effectiveFactIdsBefore: ["fact-kept"],
      invalidatedFactIds: [],
      targetOutcomeMessageId: "assistant-target"
    });

    expect(result.affectedOutcomeIds).toEqual(["outcome-target"]);
    expect(result.repairPendingAngles).toEqual(["feeling"]);
    expect(database.journalEventAngleOutcomeRepair.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        priorOutcomeId: "outcome-target",
        factRevisionId: "revision-outcome"
      })],
      skipDuplicates: true
    });
  });

  it("修订前已经失效的最新成果不会重复建立修复", async () => {
    database.journalEventAngleOutcome.findMany.mockResolvedValue([
      outcome({
        id: "outcome-already-invalid",
        assistantMessageId: "assistant-current",
        factId: "fact-previously-invalid",
        createdOffset: 2
      })
    ]);

    const result = await enqueueJournalEventAngleRepairsWithClient(database, {
      eventId: "event-1",
      activeBranchSessionId: "branch-1",
      factRevisionId: "revision-2",
      pathAnchorMessageId: "user-correction",
      effectiveMessageIds: ["assistant-current", "user-correction"],
      effectiveFactIdsBefore: [],
      invalidatedFactIds: ["fact-previously-invalid"]
    });

    expect(result.affectedOutcomeIds).toEqual([]);
    expect(database.journalEventAngleOutcomeRepair.createMany).not.toHaveBeenCalled();
  });
});
