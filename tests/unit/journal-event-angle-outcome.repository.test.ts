/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPrisma,
  mockGetRoute,
  mockGetFactProjection,
  mockGetFactProjectionForPath,
  state
} = vi.hoisted(() => {
  const delegate = () => ({
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn()
  });
  const mockPrisma: Record<string, any> = {
    interviewMessage: delegate(),
    interviewUserTurn: delegate(),
    aIGenerationTrace: delegate(),
    journalEventAngleOutcome: delegate(),
    journalEventAngleOutcomeFact: delegate(),
    journalEventAngleOutcomeRepair: delegate(),
    journalEventAngleOutcomeRepairResolution: delegate(),
    journalEventFactRevision: delegate()
  };
  return {
    mockPrisma,
    mockGetRoute: vi.fn(),
    mockGetFactProjection: vi.fn(),
    mockGetFactProjectionForPath: vi.fn(),
    state: {
      paths: {} as Record<string, string[]>,
      factProjections: {} as Record<string, any>,
      outcomes: [] as any[],
      repairs: [] as any[],
      resolutions: [] as any[],
      revisions: [] as any[],
      commitBindings: {} as Record<
        string,
        {
          branchSessionId: string;
          sourceTurnId: string;
          generationTraceId: string;
          userId: string;
          eventId: string;
          sourceMessageId: string | null;
          action: string;
          targetMessageId: string | null;
          regeneratedFromMessageId: string | null;
        }
      >,
      clock: 0
    }
  };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/server/repositories/journal-event-fact-revision.repository", () => ({
  getEventCenteredRouteWithClient: mockGetRoute,
  getEffectiveJournalEventFactProjectionWithClient: mockGetFactProjection,
  getEffectiveJournalEventFactProjectionForPathWithClient:
    mockGetFactProjectionForPath
}));

import {
  commitJournalEventAngleResultsWithClient,
  getEffectiveJournalEventAngleProjectionWithClient,
  getEffectiveJournalEventWorkspaceProjectionsForPath
} from "@/server/repositories/journal-event-angle-outcome.repository";

const now = new Date("2026-07-22T10:00:00.000Z");

function fact(
  id: string,
  options: { scope?: "current_event" | "background"; statement?: string } = {}
) {
  return {
    id,
    eventId: "event-1",
    createdBranchSessionId: "branch-1",
    pathAnchorMessageId: "user-1",
    createdByRevisionId: null,
    statement: options.statement ?? `事实 ${id}`,
    scope: options.scope ?? "current_event",
    stance: "affirmed",
    kind: "event_detail",
    origin: "user_expression",
    createdAt: now.toISOString(),
    evidence: []
  };
}

function factProjectionForPath(
  facts: ReturnType<typeof fact>[],
  options: {
    invalidatedFactIds?: string[];
    deprioritizedFactIds?: string[];
  } = {}
) {
  const invalidatedFactIds = options.invalidatedFactIds ?? [];
  const deprioritizedFactIds = options.deprioritizedFactIds ?? [];
  const invalidated = new Set(invalidatedFactIds);
  const deprioritized = new Set(deprioritizedFactIds);
  const effectiveFacts = facts.filter((item) => !invalidated.has(item.id));
  return {
    facts: effectiveFacts,
    effectiveFactIds: effectiveFacts.map((item) => item.id),
    invalidatedFactIds,
    deprioritizedFactIds,
    explorationFactIds: effectiveFacts
      .filter((item) => !deprioritized.has(item.id))
      .map((item) => item.id),
    pendingClarification: null
  };
}

function setFactProjection(
  branchSessionId: string,
  facts: ReturnType<typeof fact>[],
  options: {
    invalidatedFactIds?: string[];
    deprioritizedFactIds?: string[];
  } = {}
) {
  state.factProjections[branchSessionId] = factProjectionForPath(facts, options);
}

function storedOutcome(input: {
  id: string;
  angle: "feeling" | "thought" | "relationship" | "action";
  assistantMessageId: string;
  supportFactId: string;
  kind?: "insight" | "honest_limit";
  contextFactIds?: string[];
  branchSessionId?: string;
}) {
  const createdAt = new Date(now.getTime() + ++state.clock * 1000);
  return {
    id: input.id,
    eventId: "event-1",
    branchSessionId: input.branchSessionId ?? "branch-1",
    sourceTurnId: `turn-${input.id}`,
    assistantMessageId: input.assistantMessageId,
    generationTraceId: `trace-${input.id}`,
    angle: input.angle,
    kind: input.kind ?? "insight",
    statement: `成果 ${input.id}`,
    requestFingerprint: "a".repeat(64),
    createdAt,
    facts: [
      {
        id: `dependency-${input.id}-support`,
        factId: input.supportFactId,
        role: "support",
        createdAt
      },
      ...(input.contextFactIds ?? []).map((factId, index) => ({
        id: `dependency-${input.id}-context-${index}`,
        factId,
        role: "context",
        createdAt
      }))
    ]
  };
}

function storedRepair(input: {
  id: string;
  priorOutcomeId: string;
  angle: "feeling" | "thought" | "relationship" | "action";
  pathAnchorMessageId?: string;
  factRevisionId?: string;
}) {
  return {
    id: input.id,
    eventId: "event-1",
    branchSessionId: "branch-1",
    factRevisionId: input.factRevisionId ?? "revision-1",
    pathAnchorMessageId: input.pathAnchorMessageId ?? "user-correction",
    priorOutcomeId: input.priorOutcomeId,
    angle: input.angle,
    createdAt: new Date(now.getTime() + ++state.clock * 1000),
    resolutions: []
  };
}

function commitInput(overrides: Record<string, unknown> = {}) {
  const sourceMessageId =
    Object.prototype.hasOwnProperty.call(overrides, "sourceMessageId")
      ? (overrides.sourceMessageId as string | null)
      : overrides.sourceTurnId === "turn-correction"
        ? "user-correction"
        : "user-1";
  const action =
    typeof overrides.action === "string" ? overrides.action : "respond";
  const targetMessageId =
    typeof overrides.targetMessageId === "string" ? overrides.targetMessageId : null;
  const regeneratedFromMessageId =
    typeof overrides.regeneratedFromMessageId === "string"
      ? overrides.regeneratedFromMessageId
      : null;
  const input = {
    userId: "user-1",
    eventId: "event-1",
    activeBranchSessionId: "branch-1",
    sourceTurnId: "turn-new",
    assistantMessageId: "assistant-new",
    generationTraceId: "trace-new",
    createdFactIdsByWriteIndex: [],
    ...overrides
  } as any;
  delete input.sourceMessageId;
  delete input.action;
  delete input.targetMessageId;
  delete input.regeneratedFromMessageId;
  state.commitBindings[input.assistantMessageId] = {
    branchSessionId: input.activeBranchSessionId,
    sourceTurnId: input.sourceTurnId,
    generationTraceId: input.generationTraceId,
    userId: input.userId,
    eventId: input.eventId,
    sourceMessageId,
    action,
    targetMessageId,
    regeneratedFromMessageId
  };
  return input;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.paths = {
    "branch-1": ["user-1", "assistant-new"],
    "branch-2": ["user-1", "assistant-branch-2"]
  };
  state.factProjections = {};
  state.outcomes = [];
  state.repairs = [];
  state.resolutions = [];
  state.revisions = [];
  state.commitBindings = {};
  state.clock = 0;

  mockGetRoute.mockImplementation(async (_database: unknown, input: any) => ({
    event: {
      id: input.eventId,
      userId: "user-1",
      rootSessionId: "root-1",
      status: "active"
    },
    branch: {
      id: input.activeBranchSessionId,
      activeEventId: `state-${input.activeBranchSessionId}`
    },
    path: {
      rootSessionId: "root-1",
      messages: (state.paths[input.activeBranchSessionId] ?? []).map((id, sequence) => ({
        id,
        sequence
      }))
    }
  }));
  mockGetFactProjection.mockImplementation(
    async (_database: unknown, _eventId: string, branchSessionId: string) =>
      state.factProjections[branchSessionId]
  );
  mockGetFactProjectionForPath.mockResolvedValue(factProjectionForPath([]));

  mockPrisma.interviewMessage.findUnique.mockImplementation(async ({ where }: any) => {
    const binding = state.commitBindings[where.id];
    return binding
      ? {
          id: where.id,
          sessionId: binding.branchSessionId,
          userTurnId: binding.sourceTurnId,
          generationTraceId: binding.generationTraceId,
          regeneratedFromMessageId: binding.regeneratedFromMessageId,
          role: "assistant"
        }
      : null;
  });
  mockPrisma.interviewUserTurn.findUnique.mockImplementation(async ({ where }: any) => {
    const binding = Object.values(state.commitBindings).find(
      (item) => item.sourceTurnId === where.id
    );
    return binding
      ? {
          id: where.id,
          sessionId: binding.branchSessionId,
          journalEventId: binding.eventId,
          status: "processing",
          action: binding.action,
          targetMessageId: binding.targetMessageId,
          messages: binding.sourceMessageId ? [{ id: binding.sourceMessageId }] : []
        }
      : null;
  });
  mockPrisma.aIGenerationTrace.findUnique.mockImplementation(async ({ where }: any) => {
    const binding = Object.values(state.commitBindings).find(
      (item) => item.generationTraceId === where.id
    );
    return binding
      ? {
          id: where.id,
          userId: binding.userId,
          sessionId: binding.branchSessionId,
          journalEventId: binding.eventId,
          status: "completed"
        }
      : null;
  });

  mockPrisma.journalEventAngleOutcome.findMany.mockImplementation(async ({ where }: any) => {
    const messageIds = new Set(where.assistantMessageId?.in ?? []);
    return state.outcomes
      .filter(
        (item) => item.eventId === where.eventId && messageIds.has(item.assistantMessageId)
      )
      .sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.id.localeCompare(right.id)
      );
  });
  const findResolutions = (where: any = {}) => {
    const repairIds = where.repairId?.in
      ? new Set(where.repairId.in)
      : where.repairId
        ? new Set([where.repairId])
        : null;
    const messageIds = where.resolvedMessageId?.in
      ? new Set(where.resolvedMessageId.in)
      : where.resolvedMessageId
        ? new Set([where.resolvedMessageId])
        : null;
    return state.resolutions.filter(
      (resolution) =>
        (!repairIds || repairIds.has(resolution.repairId)) &&
        (!messageIds || messageIds.has(resolution.resolvedMessageId))
    );
  };
  mockPrisma.journalEventAngleOutcomeRepair.findMany.mockImplementation(
    async ({ where, include }: any) => {
      const messageIds = new Set(where.pathAnchorMessageId?.in ?? []);
      return state.repairs
        .filter(
          (item) => item.eventId === where.eventId && messageIds.has(item.pathAnchorMessageId)
        )
        .filter((repair) => {
          const unresolvedOnPath = where.resolutions?.none;
          if (!unresolvedOnPath) return true;
          return (
            findResolutions({
              ...unresolvedOnPath,
              repairId: repair.id
            }).length === 0
          );
        })
        .map((repair) => ({
          ...repair,
          resolutions: findResolutions({
            ...(include?.resolutions?.where ?? {}),
            repairId: repair.id
          }),
          ...(include?.priorOutcome
            ? {
                priorOutcome: (() => {
                  const outcome = state.outcomes.find(
                    (item) => item.id === repair.priorOutcomeId
                  );
                  return { id: outcome?.id, angle: outcome?.angle };
                })()
              }
            : {})
        }))
        .sort(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime() ||
            left.id.localeCompare(right.id)
        );
    }
  );
  mockPrisma.journalEventAngleOutcomeRepairResolution.findMany.mockImplementation(
    async ({ where }: any) => findResolutions(where)
  );
  mockPrisma.journalEventAngleOutcomeRepairResolution.create.mockImplementation(
    async ({ data }: any) => {
      const created = {
        ...data,
        resolvedAt: new Date(now.getTime() + ++state.clock * 1000),
        createdAt: new Date(now.getTime() + ++state.clock * 1000)
      };
      state.resolutions.push(created);
      return created;
    }
  );
  mockPrisma.journalEventAngleOutcomeRepairResolution.createMany.mockImplementation(
    async ({ data }: any) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows) {
        state.resolutions.push({
          ...row,
          resolvedAt: new Date(now.getTime() + ++state.clock * 1000),
          createdAt: new Date(now.getTime() + ++state.clock * 1000)
        });
      }
      return { count: rows.length };
    }
  );
  mockPrisma.journalEventAngleOutcome.create.mockImplementation(async ({ data }: any) => {
    const created = {
      ...data,
      createdAt: new Date(now.getTime() + ++state.clock * 1000),
      facts: []
    };
    state.outcomes.push(created);
    return created;
  });
  mockPrisma.journalEventAngleOutcomeFact.createMany.mockImplementation(
    async ({ data }: any) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows) {
        const outcome = state.outcomes.find((item) => item.id === row.outcomeId);
        outcome?.facts.push({
          ...row,
          createdAt: new Date(now.getTime() + ++state.clock * 1000)
        });
      }
      return { count: rows.length };
    }
  );
  mockPrisma.journalEventFactRevision.findUnique.mockImplementation(
    async ({ where, include }: any) => {
      const revision = state.revisions.find(
        (item) => item.sourceTurnId === where.sourceTurnId
      );
      if (!revision) return null;
      return {
        ...revision,
        angleOutcomeRepairs: state.repairs
          .filter((repair) => repair.factRevisionId === revision.id)
          .map((repair) => {
            const priorOutcome = state.outcomes.find(
              (outcome) => outcome.id === repair.priorOutcomeId
            );
            return {
              ...repair,
              resolutions: findResolutions({
                ...(include?.angleOutcomeRepairs?.include?.resolutions?.where ?? {}),
                repairId: repair.id
              }),
              priorOutcome: {
                id: priorOutcome?.id,
                angle: priorOutcome?.angle
              }
            };
          })
      };
    }
  );
});

describe("journal event angle outcome repository", () => {
  it("工作台恢复复用已有消息路径，同时并发投影事实与角度成果", async () => {
    const facts = [fact("fact-feeling")];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-feeling",
        angle: "feeling",
        assistantMessageId: "assistant-feeling",
        supportFactId: "fact-feeling"
      })
    );
    mockGetFactProjectionForPath.mockResolvedValue(factProjectionForPath(facts));

    const projections = await getEffectiveJournalEventWorkspaceProjectionsForPath({
      eventId: "event-1",
      messageIds: ["user-1", "assistant-feeling"],
      snapshotData: { phase: "checkpoint_two" }
    });

    expect(projections.factProjection.effectiveFactIds).toEqual(["fact-feeling"]);
    expect(projections.angleProjection.completedAngles).toEqual(["feeling"]);
    expect(mockGetFactProjectionForPath).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        eventId: "event-1",
        messageIds: ["user-1", "assistant-feeling"]
      })
    );
    expect(mockGetRoute).not.toHaveBeenCalled();
    expect(mockGetFactProjection).not.toHaveBeenCalled();
  });

  it("按固定顺序投影四个角度，honest_limit 视为完成但不进入日志候选", async () => {
    const facts = [fact("fact-feeling"), fact("fact-thought"), fact("fact-relation"), fact("fact-action")];
    setFactProjection("branch-1", facts);
    state.paths["branch-1"] = [
      "user-1",
      "assistant-feeling",
      "assistant-thought",
      "assistant-relation",
      "assistant-action"
    ];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-feeling",
        angle: "feeling",
        assistantMessageId: "assistant-feeling",
        supportFactId: "fact-feeling"
      }),
      storedOutcome({
        id: "outcome-thought",
        angle: "thought",
        assistantMessageId: "assistant-thought",
        supportFactId: "fact-thought",
        kind: "honest_limit"
      }),
      storedOutcome({
        id: "outcome-relation",
        angle: "relationship",
        assistantMessageId: "assistant-relation",
        supportFactId: "fact-relation"
      }),
      storedOutcome({
        id: "outcome-action",
        angle: "action",
        assistantMessageId: "assistant-action",
        supportFactId: "fact-action"
      })
    );

    const projection = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );

    expect(projection.completedAngles).toEqual([
      "feeling",
      "thought",
      "relationship",
      "action"
    ]);
    expect(projection.availableAngles).toEqual([]);
    expect(Object.keys(projection.outcomesByAngle)).toEqual([
      "feeling",
      "thought",
      "relationship",
      "action"
    ]);
    expect(projection.outcomesByAngle.thought?.kind).toBe("honest_limit");
    expect(projection.logEligibleOutcomeIds).toEqual([
      "outcome-feeling",
      "outcome-relation",
      "outcome-action"
    ]);
  });

  it("要求 support 来自 current_event 且仍具备探索资格", async () => {
    setFactProjection("branch-1", [
      fact("fact-current"),
      fact("fact-background", { scope: "background" })
    ]);

    await expect(
      commitJournalEventAngleResultsWithClient(
        mockPrisma as any,
        commitInput({
          angleOutcome: {
            angle: "feeling",
            kind: "insight",
            statement: "这件事让我感到被看见",
            dependencies: [{ factId: "fact-background", role: "support" }]
          }
        })
      )
    ).rejects.toThrow("EVENT_ANGLE_OUTCOME_DEPENDENCY_INVALID");

    expect(state.outcomes).toHaveLength(0);
  });

  it("允许 background 事实作为 context，同时要求 current_event 事实承担 support", async () => {
    setFactProjection("branch-1", [
      fact("fact-current"),
      fact("fact-background", { scope: "background" })
    ]);

    await commitJournalEventAngleResultsWithClient(
      mockPrisma as any,
      commitInput({
        angleOutcome: {
          angle: "relationship",
          kind: "insight",
          statement: "过去的经历解释了我为何格外在意这次回应",
          dependencies: [
            { factId: "fact-current", role: "support" },
            { factId: "fact-background", role: "context" }
          ]
        }
      })
    );

    expect(state.outcomes).toHaveLength(1);
    expect(state.outcomes[0].facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factId: "fact-current", role: "support" }),
        expect.objectContaining({ factId: "fact-background", role: "context" })
      ])
    );
  });

  it("同一角度深聊允许写入新版本，并由最新成果成为当前有效成果", async () => {
    const supportingFact = fact("fact-current");
    setFactProjection("branch-1", [supportingFact]);
    state.paths["branch-1"] = ["user-1", "assistant-old", "assistant-new"];
    state.outcomes.push(storedOutcome({
      id: "outcome-old",
      angle: "feeling",
      assistantMessageId: "assistant-old",
      supportFactId: "fact-current"
    }));

    await commitJournalEventAngleResultsWithClient(
      mockPrisma as any,
      commitInput({
        angleOutcome: {
          angle: "feeling",
          kind: "insight",
          statement: "这件事先让我委屈，后来我才看见自己在意被认真对待",
          dependencies: [{ factId: "fact-current", role: "support" }]
        }
      })
    );

    const projection = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );
    expect(state.outcomes).toHaveLength(2);
    expect(projection.outcomesByAngle.feeling?.id).not.toBe("outcome-old");
    expect(projection.completedAngles).toContain("feeling");
  });

  it("拒绝把已降为非重点的事实作为新成果 support", async () => {
    setFactProjection("branch-1", [fact("fact-deprioritized")], {
      deprioritizedFactIds: ["fact-deprioritized"]
    });

    await expect(
      commitJournalEventAngleResultsWithClient(
        mockPrisma as any,
        commitInput({
          angleOutcome: {
            angle: "action",
            kind: "insight",
            statement: "我看见了下一步",
            dependencies: [{ factId: "fact-deprioritized", role: "support" }]
          }
        })
      )
    ).rejects.toThrow("EVENT_ANGLE_OUTCOME_DEPENDENCY_INVALID");
  });

  it("普通内容 turn 仍要求来源用户消息位于当前活动路径", async () => {
    setFactProjection("branch-1", [fact("fact-current")]);

    await expect(
      commitJournalEventAngleResultsWithClient(
        mockPrisma as any,
        commitInput({
          sourceTurnId: "turn-off-path",
          sourceMessageId: "user-off-path",
          action: "respond",
          angleOutcome: {
            angle: "thought",
            kind: "insight",
            statement: "这条成果不能脱离当前用户表达",
            dependencies: [{ factId: "fact-current", role: "support" }]
          }
        })
      )
    ).rejects.toThrow("EVENT_STATE_CHANGED");
    expect(state.outcomes).toEqual([]);
  });

  it("降为非重点只移出日志主线，恢复重点后同一成果重新具备日志资格", async () => {
    const supportingFact = fact("fact-focus");
    state.paths["branch-1"] = ["user-1", "assistant-feeling"];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-feeling",
        angle: "feeling",
        assistantMessageId: "assistant-feeling",
        supportFactId: "fact-focus"
      })
    );
    setFactProjection("branch-1", [supportingFact], {
      deprioritizedFactIds: ["fact-focus"]
    });

    const deprioritized = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );
    expect(deprioritized.completedAngles).toContain("feeling");
    expect(deprioritized.deprioritizedOutcomeIds).toEqual(["outcome-feeling"]);
    expect(deprioritized.logEligibleOutcomeIds).toEqual([]);

    setFactProjection("branch-1", [supportingFact]);
    const restored = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );
    expect(restored.completedAngles).toContain("feeling");
    expect(restored.deprioritizedOutcomeIds).toEqual([]);
    expect(restored.logEligibleOutcomeIds).toEqual(["outcome-feeling"]);
  });

  it("只读取当前分支有效消息路径上的角度成果", async () => {
    setFactProjection("branch-1", [fact("fact-shared"), fact("fact-branch-1")]);
    setFactProjection("branch-2", [fact("fact-shared"), fact("fact-branch-2")]);
    state.paths["branch-1"] = ["user-1", "assistant-branch-1"];
    state.paths["branch-2"] = ["user-1", "assistant-branch-2"];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-branch-1",
        angle: "feeling",
        assistantMessageId: "assistant-branch-1",
        supportFactId: "fact-branch-1",
        branchSessionId: "branch-1"
      }),
      storedOutcome({
        id: "outcome-branch-2",
        angle: "thought",
        assistantMessageId: "assistant-branch-2",
        supportFactId: "fact-branch-2",
        branchSessionId: "branch-2"
      })
    );

    const branch1 = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );
    const branch2 = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-2"
    );

    expect(branch1.completedAngles).toEqual(["feeling"]);
    expect(branch1.outcomesByAngle.thought).toBeUndefined();
    expect(branch2.completedAngles).toEqual(["thought"]);
    expect(branch2.outcomesByAngle.feeling).toBeUndefined();
  });

  it("support 事实失效后旧成果立即退出有效投影", async () => {
    const oldFact = fact("fact-old");
    setFactProjection("branch-1", [oldFact], { invalidatedFactIds: ["fact-old"] });
    state.paths["branch-1"] = ["user-1", "assistant-old"];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-old",
        angle: "feeling",
        assistantMessageId: "assistant-old",
        supportFactId: "fact-old"
      })
    );

    const projection = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );

    expect(projection.outcomesByAngle.feeling).toBeUndefined();
    expect(projection.completedAngles).toEqual([]);
    expect(projection.invalidatedOutcomeIds).toEqual(["outcome-old"]);
    expect(projection.availableAngles).toContain("feeling");
  });

  it("context 事实失效后依赖它的角度成果也立即退出", async () => {
    const currentFact = fact("fact-current");
    const backgroundFact = fact("fact-background", { scope: "background" });
    setFactProjection("branch-1", [currentFact, backgroundFact], {
      invalidatedFactIds: ["fact-background"]
    });
    state.paths["branch-1"] = ["user-1", "assistant-outcome"];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-with-context",
        angle: "relationship",
        assistantMessageId: "assistant-outcome",
        supportFactId: "fact-current",
        contextFactIds: ["fact-background"]
      })
    );

    const projection = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );

    expect(projection.invalidatedOutcomeIds).toEqual(["outcome-with-context"]);
    expect(projection.outcomesByAngle.relationship).toBeUndefined();
    expect(projection.completedAngles).not.toContain("relationship");
    expect(projection.logEligibleOutcomeIds).not.toContain("outcome-with-context");
  });

  it("最新成果失效后不会回退显示同角度的历史成果", async () => {
    const oldFact = fact("fact-old-valid");
    const latestFact = fact("fact-latest-invalid");
    setFactProjection("branch-1", [oldFact, latestFact], {
      invalidatedFactIds: ["fact-latest-invalid"]
    });
    state.paths["branch-1"] = [
      "user-1",
      "assistant-old",
      "assistant-latest"
    ];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-old-valid",
        angle: "feeling",
        assistantMessageId: "assistant-old",
        supportFactId: "fact-old-valid"
      }),
      storedOutcome({
        id: "outcome-latest-invalid",
        angle: "feeling",
        assistantMessageId: "assistant-latest",
        supportFactId: "fact-latest-invalid"
      })
    );

    const projection = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );

    expect(projection.outcomesByAngle.feeling).toBeUndefined();
    expect(projection.completedAngles).not.toContain("feeling");
    expect(projection.invalidatedOutcomeIds).toContain("outcome-latest-invalid");
  });

  it("pending repair 隐藏失效成果并暂时关闭对应角度入口", async () => {
    const oldFact = fact("fact-old");
    setFactProjection("branch-1", [oldFact], { invalidatedFactIds: ["fact-old"] });
    state.paths["branch-1"] = ["user-1", "assistant-old", "user-correction"];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-old",
        angle: "feeling",
        assistantMessageId: "assistant-old",
        supportFactId: "fact-old"
      })
    );
    state.repairs.push(
      storedRepair({ id: "repair-feeling", priorOutcomeId: "outcome-old", angle: "feeling" })
    );

    const projection = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );

    expect(projection.repairPendingAngles).toEqual(["feeling"]);
    expect(projection.availableAngles).not.toContain("feeling");
    expect(projection.completedAngles).not.toContain("feeling");
  });

  it("真实换问法子分支使用 regeneration turn 独立解决共享 repair", async () => {
    const oldFact = fact("fact-old");
    const newFact = fact("fact-new");
    setFactProjection("branch-a1", [oldFact, newFact], {
      invalidatedFactIds: ["fact-old"]
    });
    setFactProjection("branch-a2", [oldFact, newFact], {
      invalidatedFactIds: ["fact-old"]
    });
    state.paths["branch-a1"] = [
      "user-1",
      "assistant-old",
      "user-correction",
      "assistant-a1"
    ];
    state.paths["branch-a2"] = [
      "user-1",
      "assistant-old",
      "user-correction",
      "assistant-a2"
    ];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-old",
        angle: "feeling",
        assistantMessageId: "assistant-old",
        supportFactId: "fact-old",
        branchSessionId: "branch-a1"
      })
    );
    state.repairs.push(
      storedRepair({ id: "repair-feeling", priorOutcomeId: "outcome-old", angle: "feeling" })
    );
    state.revisions.push({
      id: "revision-1",
      sourceTurnId: "turn-correction",
      eventId: "event-1",
      branchSessionId: "branch-a1",
      pathAnchorMessageId: "user-correction"
    });

    await commitJournalEventAngleResultsWithClient(
      mockPrisma as any,
      commitInput({
        activeBranchSessionId: "branch-a1",
        sourceTurnId: "turn-correction",
        sourceMessageId: "user-correction",
        assistantMessageId: "assistant-a1",
        generationTraceId: "trace-a1",
        angleRepairResolutions: [
          { repairId: "repair-feeling", decision: "reopen" }
        ]
      })
    );

    const pathA1 = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-a1"
    );
    expect(pathA1.repairPendingAngles).toEqual([]);
    expect(pathA1.reopenedAngles).toEqual(["feeling"]);
    expect(pathA1.repairs[0]).toEqual(
      expect.objectContaining({
        status: "reopened",
        resolvedMessageId: "assistant-a1"
      })
    );

    const pathA2BeforeResolution =
      await getEffectiveJournalEventAngleProjectionWithClient(
        mockPrisma as any,
        "event-1",
        "branch-a2"
      );
    expect(pathA2BeforeResolution.repairPendingAngles).toEqual(["feeling"]);
    expect(pathA2BeforeResolution.reopenedAngles).toEqual([]);
    expect(pathA2BeforeResolution.repairs[0]).toEqual(
      expect.objectContaining({ status: "pending", resolvedMessageId: null })
    );

    const pathA2Resolution = await commitJournalEventAngleResultsWithClient(
      mockPrisma as any,
      commitInput({
        activeBranchSessionId: "branch-a2",
        sourceTurnId: "turn-regenerate-a2",
        sourceMessageId: null,
        action: "regenerate_question",
        targetMessageId: "assistant-a1",
        regeneratedFromMessageId: "assistant-a1",
        assistantMessageId: "assistant-a2",
        generationTraceId: "trace-a2",
        angleRepairResolutions: [
          {
            repairId: "repair-feeling",
            decision: "replace",
            outcome: {
              kind: "insight",
              statement: "另一个回复版本保留了修正后的感受线索",
              dependencies: [{ factId: "fact-new", role: "support" }]
            }
          }
        ]
      })
    );
    const replacementId = pathA2Resolution.angleOutcomeIds[0];

    const pathA2AfterResolution =
      await getEffectiveJournalEventAngleProjectionWithClient(
        mockPrisma as any,
        "event-1",
        "branch-a2"
      );
    expect(pathA2AfterResolution.repairPendingAngles).toEqual([]);
    expect(pathA2AfterResolution.reopenedAngles).toEqual([]);
    expect(pathA2AfterResolution.outcomesByAngle.feeling?.id).toBe(replacementId);
    expect(pathA2AfterResolution.repairs[0]).toEqual(
      expect.objectContaining({
        status: "replaced",
        resolvedMessageId: "assistant-a2",
        replacementOutcomeId: replacementId
      })
    );

    const restoredPathA1 = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-a1"
    );
    expect(restoredPathA1.reopenedAngles).toEqual(["feeling"]);
    expect(restoredPathA1.outcomesByAngle.feeling).toBeUndefined();
    expect(restoredPathA1.repairs[0]).toEqual(
      expect.objectContaining({
        status: "reopened",
        resolvedMessageId: "assistant-a1",
        replacementOutcomeId: null
      })
    );
    expect(state.repairs[0]).not.toHaveProperty("status");
    expect(
      state.resolutions.map((resolution) => ({
        branchSessionId: resolution.branchSessionId,
        resolvedMessageId: resolution.resolvedMessageId
      }))
    ).toEqual([
      { branchSessionId: "branch-a1", resolvedMessageId: "assistant-a1" },
      { branchSessionId: "branch-a2", resolvedMessageId: "assistant-a2" }
    ]);
  });

  it("replace 用新事实生成替代成果并恢复角度完成状态", async () => {
    const oldFact = fact("fact-old");
    const newFact = fact("fact-new");
    setFactProjection("branch-1", [oldFact, newFact], {
      invalidatedFactIds: ["fact-old"]
    });
    state.paths["branch-1"] = [
      "user-1",
      "assistant-old",
      "user-correction",
      "assistant-new"
    ];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-old",
        angle: "feeling",
        assistantMessageId: "assistant-old",
        supportFactId: "fact-old"
      })
    );
    state.repairs.push(
      storedRepair({ id: "repair-feeling", priorOutcomeId: "outcome-old", angle: "feeling" })
    );
    state.revisions.push({
      id: "revision-1",
      sourceTurnId: "turn-correction",
      eventId: "event-1",
      branchSessionId: "branch-1",
      pathAnchorMessageId: "user-correction"
    });

    const result = await commitJournalEventAngleResultsWithClient(
      mockPrisma as any,
      commitInput({
        sourceTurnId: "turn-correction",
        angleRepairResolutions: [
          {
            repairId: "repair-feeling",
            decision: "replace",
            outcome: {
              kind: "insight",
              statement: "纠正后，我更接近松了一口气",
              dependencies: [{ factId: "fact-new", role: "support" }]
            }
          }
        ]
      })
    );

    const replacementId = result.angleOutcomeIds[0];
    expect(state.resolutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repairId: "repair-feeling",
          decision: "replaced",
          replacementOutcomeId: replacementId,
          resolvedMessageId: "assistant-new"
        })
      ])
    );

    const projection = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );
    expect(projection.completedAngles).toContain("feeling");
    expect(projection.outcomesByAngle.feeling?.id).toBe(replacementId);
    expect(projection.repairPendingAngles).toEqual([]);
    expect(projection.logEligibleOutcomeIds).toContain(replacementId);
  });

  it("reopen 后允许后续新成果再次完成该角度", async () => {
    const oldFact = fact("fact-old");
    const newFact = fact("fact-new");
    setFactProjection("branch-1", [oldFact, newFact], {
      invalidatedFactIds: ["fact-old"]
    });
    state.paths["branch-1"] = [
      "user-1",
      "assistant-old",
      "user-correction",
      "assistant-new"
    ];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-old",
        angle: "thought",
        assistantMessageId: "assistant-old",
        supportFactId: "fact-old"
      })
    );
    state.repairs.push(
      storedRepair({ id: "repair-thought", priorOutcomeId: "outcome-old", angle: "thought" })
    );
    state.revisions.push({
      id: "revision-1",
      sourceTurnId: "turn-correction",
      eventId: "event-1",
      branchSessionId: "branch-1",
      pathAnchorMessageId: "user-correction"
    });

    const reopened = await commitJournalEventAngleResultsWithClient(
      mockPrisma as any,
      commitInput({
        sourceTurnId: "turn-correction",
        angleRepairResolutions: [
          { repairId: "repair-thought", decision: "reopen" }
        ]
      })
    );
    expect(reopened.reopenedAngles).toEqual(["thought"]);

    const afterReopen = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );
    expect(afterReopen.reopenedAngles).toEqual(["thought"]);
    expect(afterReopen.availableAngles).toContain("thought");

    state.paths["branch-1"].push("user-after-reopen", "assistant-after-reopen");
    await commitJournalEventAngleResultsWithClient(
      mockPrisma as any,
      commitInput({
        sourceTurnId: "turn-after-reopen",
        sourceMessageId: "user-after-reopen",
        assistantMessageId: "assistant-after-reopen",
        generationTraceId: "trace-after-reopen",
        angleOutcome: {
          angle: "thought",
          kind: "insight",
          statement: "继续探索后，我看见自己在意的是公平",
          dependencies: [{ factId: "fact-new", role: "support" }]
        }
      })
    );

    const completed = await getEffectiveJournalEventAngleProjectionWithClient(
      mockPrisma as any,
      "event-1",
      "branch-1"
    );
    expect(completed.completedAngles).toContain("thought");
    expect(completed.reopenedAngles).toEqual([]);
    expect(completed.availableAngles).not.toContain("thought");
  });

  it("同一事实修订产生多个 repair 时要求一次整组解决", async () => {
    const oldFeeling = fact("fact-old-feeling");
    const oldThought = fact("fact-old-thought");
    setFactProjection("branch-1", [oldFeeling, oldThought], {
      invalidatedFactIds: ["fact-old-feeling", "fact-old-thought"]
    });
    state.paths["branch-1"] = [
      "user-1",
      "assistant-feeling",
      "assistant-thought",
      "user-correction",
      "assistant-new"
    ];
    state.outcomes.push(
      storedOutcome({
        id: "outcome-feeling",
        angle: "feeling",
        assistantMessageId: "assistant-feeling",
        supportFactId: "fact-old-feeling"
      }),
      storedOutcome({
        id: "outcome-thought",
        angle: "thought",
        assistantMessageId: "assistant-thought",
        supportFactId: "fact-old-thought"
      })
    );
    state.repairs.push(
      storedRepair({ id: "repair-feeling", priorOutcomeId: "outcome-feeling", angle: "feeling" }),
      storedRepair({ id: "repair-thought", priorOutcomeId: "outcome-thought", angle: "thought" })
    );
    state.revisions.push({
      id: "revision-1",
      sourceTurnId: "turn-correction",
      eventId: "event-1",
      branchSessionId: "branch-1",
      pathAnchorMessageId: "user-correction"
    });

    await expect(
      commitJournalEventAngleResultsWithClient(
        mockPrisma as any,
        commitInput({
          sourceTurnId: "turn-correction",
          angleRepairResolutions: [
            { repairId: "repair-feeling", decision: "reopen" }
          ]
        })
      )
    ).rejects.toThrow("EVENT_ANGLE_OUTCOME_REPAIR_SET_INVALID");
    expect(state.resolutions).toEqual([]);
    expect(
      mockPrisma.journalEventAngleOutcomeRepairResolution.create
    ).not.toHaveBeenCalled();

    const resolved = await commitJournalEventAngleResultsWithClient(
      mockPrisma as any,
      commitInput({
        sourceTurnId: "turn-correction",
        angleRepairResolutions: [
          { repairId: "repair-feeling", decision: "reopen" },
          { repairId: "repair-thought", decision: "reopen" }
        ]
      })
    );

    expect(resolved.reopenedAngles).toEqual(["feeling", "thought"]);
    expect(state.resolutions.map((resolution) => resolution.decision)).toEqual([
      "reopened",
      "reopened"
    ]);
  });
});
