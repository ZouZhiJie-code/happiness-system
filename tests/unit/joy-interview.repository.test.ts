const {
  mockFindUnique,
  mockUpdate,
  mockCreate,
  mockSessionCreate,
  mockUpsert,
  mockTransaction,
  mockTraceCreate,
  mockTraceFindUnique,
  mockTraceUpdate,
  mockMessageCreate
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockSessionCreate: vi.fn(),
  mockUpsert: vi.fn(),
  mockTransaction: vi.fn(),
  mockTraceCreate: vi.fn(),
  mockTraceFindUnique: vi.fn(),
  mockTraceUpdate: vi.fn(),
  mockMessageCreate: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
    interviewSession: {
      create: mockSessionCreate,
      findUnique: mockFindUnique,
      update: mockUpdate
    },
    interviewEvent: {
      create: mockCreate
    },
    interviewMessage: {
      create: mockMessageCreate
    },
    joyEntry: {
      upsert: mockUpsert
    },
    aIGenerationTrace: {
      create: mockTraceCreate,
      findUnique: mockTraceFindUnique,
      update: mockTraceUpdate
    }
  }
}));

import { createJoyInterviewSession, findJoyInterviewSessionById, saveJoyInterviewDraft } from "@/server/repositories/joy-interview.repository";

describe("findJoyInterviewSessionById", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockCreate.mockReset();
    mockSessionCreate.mockReset();
    mockUpsert.mockReset();
    mockTransaction.mockReset();
    mockTraceCreate.mockReset();
    mockTraceFindUnique.mockReset();
    mockTraceUpdate.mockReset();
    mockMessageCreate.mockReset();
  });

  it("does not reinterpret legacy joyType labels as a direction signal", async () => {
    mockFindUnique.mockResolvedValue({
      id: "session-legacy",
      userId: "user-1",
      dimension: "joy",
      status: "active",
      stage: "probe_pattern",
      activeEventId: "event-legacy",
      turnCount: 2,
      lastAssistantQuestion: "这类开心通常是被什么触发出来的？",
      draftSummary: null,
      finalEntryId: null,
      entryDate: new Date("2026-04-20T16:00:00.000Z"),
      startedAt: new Date("2026-04-21T00:00:00.000Z"),
      pausedAt: null,
      completedAt: null,
      activeEvent: {
        id: "event-legacy",
        progressData: null
      },
      events: [
        {
          id: "event-legacy",
          sequence: 1,
          status: "active",
          stage: "probe_pattern",
          explorationRound: 1,
          coveredLenses: ["event_detail", "felt_experience", "importance_reason"],
          roundCoveredLenses: ["event_detail", "felt_experience", "importance_reason"],
          roundMeaningfulReplyCount: 2,
          totalMeaningfulReplyCount: 2,
          startMessageSequence: 0,
          event: "今天刷到一个很好笑的片段",
          feeling: "一下子松下来",
          whyItMattered: "那个反转太突然了",
          happinessType: null,
          selfPattern: null,
          snapshotData: {
            kind: "joy",
            joyMoment: "今天刷到一个很好笑的片段",
            joySource: "那个反转太突然了",
            stateShift: "一下子松下来",
            joyType: "感官型开心",
            tags: ["好笑"]
          },
          draftSummary: null,
          confidence: 0.72,
          missingSlots: [],
          startedAt: new Date("2026-04-21T00:00:00.000Z"),
          completedAt: null
        }
      ],
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          inputMode: null,
          content: "这类开心通常是被什么触发出来的？",
          sequence: 0,
          createdAt: new Date("2026-04-21T00:00:00.000Z")
        }
      ],
      snapshots: [
        {
          version: 1,
          event: "今天刷到一个很好笑的片段",
          feeling: "一下子松下来",
          whyItMattered: "那个反转太突然了",
          happinessType: null,
          selfPattern: null,
          confidence: 0.72,
          missingSlots: []
        }
      ],
      joyEntry: null
    });

    const session = await findJoyInterviewSessionById("session-legacy");

    expect(session).not.toBeNull();
    expect(session?.entryDate).toBe("2026-04-21");
    expect(session?.snapshot.directionSignal).toBeNull();
    expect(session?.snapshot.psychProfile?.track).toBe("delight_track");
    expect(session?.events[0]?.snapshotData).toMatchObject({
      kind: "joy",
      directionSignal: null
    });
  });

  it("returns null when the session belongs to a different user", async () => {
    mockFindUnique.mockResolvedValue({
      id: "session-foreign",
      userId: "other-user",
      dimension: "joy",
      status: "active",
      stage: "collect_event",
      activeEventId: "event-1",
      turnCount: 0,
      lastAssistantQuestion: "今天有没有一个让你真心开心的瞬间？",
      draftSummary: null,
      finalEntryId: null,
      entryDate: new Date("2026-05-15T16:00:00.000Z"),
      startedAt: new Date("2026-05-16T00:00:00.000Z"),
      pausedAt: null,
      completedAt: null,
      activeEvent: {
        id: "event-1",
        progressData: null
      },
      events: [],
      messages: [],
      snapshots: [],
      joyEntry: null
    });

    const session = await findJoyInterviewSessionById("session-foreign", "user-1");

    expect(session).toBeNull();
  });

  it("writes draft dates from entryDate instead of startedAt", async () => {
    mockTransaction.mockResolvedValue([]);

    mockFindUnique.mockResolvedValue({
      id: "session-entry-date",
      userId: "user-1",
      dimension: "joy",
      status: "active",
      stage: "wrap_up",
      activeEventId: "event-1",
      turnCount: 3,
      lastAssistantQuestion: "我已经抓到这段开心的重点了。",
      draftSummary: null,
      finalEntryId: null,
      entryDate: new Date("2026-04-19T16:00:00.000Z"),
      startedAt: new Date("2026-04-21T00:00:00.000Z"),
      pausedAt: null,
      completedAt: null,
      activeEvent: null,
      events: [],
      messages: [],
      snapshots: [],
      joyEntry: null
    });

    mockUpsert.mockResolvedValue({
      id: "entry-1"
    });

    mockUpdate.mockResolvedValue({
      id: "session-entry-date",
      userId: "user-1",
      dimension: "joy",
      status: "active",
      stage: "wrap_up",
      activeEventId: "event-1",
      turnCount: 3,
      lastAssistantQuestion: "我已经抓到这段开心的重点了。",
      draftSummary: "被家人的陪伴接住了",
      finalEntryId: "entry-1",
      entryDate: new Date("2026-04-19T16:00:00.000Z"),
      startedAt: new Date("2026-04-21T00:00:00.000Z"),
      pausedAt: null,
      completedAt: null,
      activeEvent: null,
      events: [],
      messages: [],
      snapshots: [],
      joyEntry: {
        id: "entry-1",
        userId: "user-1",
        sessionId: "session-entry-date",
        date: new Date("2026-04-19T16:00:00.000Z"),
        title: "被稳稳接住",
        content: "今天和家人一起吃饭聊天。",
        event: "今天和家人一起吃饭聊天",
        feeling: "轻松踏实",
        whyItMattered: "被家人的陪伴接住了",
        happinessType: null,
        selfPattern: "只要慢下来相处，我就更容易恢复状态",
        tags: ["关系型开心"],
        payload: {
          kind: "joy",
          joyMoment: "今天和家人一起吃饭聊天",
          joySource: "被家人的陪伴接住了",
          stateShift: "从紧绷变得轻松踏实",
          meaningNeed: null,
          manualClue: "只要慢下来相处，我就更容易恢复状态",
          directionSignal: null,
          valueImpact: null,
          durability: null,
          tags: ["关系型开心"]
        },
        eventBlocks: [],
        source: "ai_draft_direct",
        status: "draft",
        linkedSessionIds: ["session-entry-date"],
        createdAt: new Date("2026-04-21T00:02:00.000Z"),
        updatedAt: new Date("2026-04-21T00:03:00.000Z"),
        savedAt: null,
        session: {
          dimension: "joy"
        }
      }
    });

    await saveJoyInterviewDraft("session-entry-date", {
      title: "被稳稳接住",
      content: "今天和家人一起吃饭聊天。",
      event: "今天和家人一起吃饭聊天",
      feeling: "轻松踏实",
      whyItMattered: "被家人的陪伴接住了",
      happinessType: null,
      selfPattern: "只要慢下来相处，我就更容易恢复状态",
      joyMoment: "今天和家人一起吃饭聊天",
      joySource: "被家人的陪伴接住了",
      stateShift: "从紧绷变得轻松踏实",
      meaningNeed: null,
      manualClue: "只要慢下来相处，我就更容易恢复状态",
      tags: ["关系型开心"],
      eventBlocks: [],
      source: "ai_draft_direct"
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          date: new Date("2026-04-19T16:00:00.000Z")
        })
      })
    );
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("keeps a saved journal confirmed while regenerating it", async () => {
    mockTransaction.mockResolvedValue([]);

    mockFindUnique.mockResolvedValue({
      id: "session-saved-entry",
      userId: "user-1",
      dimension: "joy",
      status: "completed",
      stage: "finalize",
      activeEventId: null,
      turnCount: 4,
      lastAssistantQuestion: "我已经抓到这段开心的重点了。",
      draftSummary: "被家人的陪伴接住了",
      finalEntryId: "entry-saved",
      entryDate: new Date("2026-04-19T16:00:00.000Z"),
      startedAt: new Date("2026-04-21T00:00:00.000Z"),
      pausedAt: null,
      completedAt: new Date("2026-04-21T00:10:00.000Z"),
      activeEvent: null,
      events: [],
      messages: [],
      snapshots: [],
      joyEntry: {
        id: "entry-saved",
        userId: "user-1",
        sessionId: "session-saved-entry",
        date: new Date("2026-04-19T16:00:00.000Z"),
        title: "被稳稳接住",
        content: "今天和家人一起吃饭聊天。",
        event: "今天和家人一起吃饭聊天",
        feeling: "轻松踏实",
        whyItMattered: "被家人的陪伴接住了",
        happinessType: null,
        selfPattern: "只要慢下来相处，我就更容易恢复状态",
        tags: ["关系型开心"],
        payload: {
          kind: "joy",
          joyMoment: "今天和家人一起吃饭聊天",
          joySource: "被家人的陪伴接住了",
          stateShift: "从紧绷变得轻松踏实",
          meaningNeed: null,
          manualClue: "只要慢下来相处，我就更容易恢复状态",
          directionSignal: null,
          valueImpact: null,
          durability: null,
          tags: ["关系型开心"]
        },
        eventBlocks: [],
        source: "ai_draft_direct",
        status: "saved",
        linkedSessionIds: ["session-saved-entry"],
        createdAt: new Date("2026-04-21T00:02:00.000Z"),
        updatedAt: new Date("2026-04-21T00:10:00.000Z"),
        savedAt: new Date("2026-04-21T00:10:00.000Z"),
        session: {
          dimension: "joy"
        }
      }
    });

    mockUpsert.mockResolvedValue({
      id: "entry-saved"
    });

    mockUpdate.mockResolvedValue({
      id: "session-saved-entry",
      userId: "user-1",
      dimension: "joy",
      status: "completed",
      stage: "finalize",
      activeEventId: null,
      turnCount: 4,
      lastAssistantQuestion: "我已经抓到这段开心的重点了。",
      draftSummary: "被家人的陪伴接住了",
      finalEntryId: "entry-saved",
      entryDate: new Date("2026-04-19T16:00:00.000Z"),
      startedAt: new Date("2026-04-21T00:00:00.000Z"),
      pausedAt: null,
      completedAt: new Date("2026-04-21T00:10:00.000Z"),
      activeEvent: null,
      events: [],
      messages: [],
      snapshots: [],
      joyEntry: {
        id: "entry-saved",
        userId: "user-1",
        sessionId: "session-saved-entry",
        date: new Date("2026-04-19T16:00:00.000Z"),
        title: "被稳稳接住",
        content: "今天和家人一起吃饭聊天。",
        event: "今天和家人一起吃饭聊天",
        feeling: "轻松踏实",
        whyItMattered: "被家人的陪伴接住了",
        happinessType: null,
        selfPattern: "只要慢下来相处，我就更容易恢复状态",
        tags: ["关系型开心"],
        payload: {
          kind: "joy",
          joyMoment: "今天和家人一起吃饭聊天",
          joySource: "被家人的陪伴接住了",
          stateShift: "从紧绷变得轻松踏实",
          meaningNeed: null,
          manualClue: "只要慢下来相处，我就更容易恢复状态",
          directionSignal: null,
          valueImpact: null,
          durability: null,
          tags: ["关系型开心"]
        },
        eventBlocks: [],
        source: "ai_draft_direct",
        status: "saved",
        linkedSessionIds: ["session-saved-entry"],
        createdAt: new Date("2026-04-21T00:02:00.000Z"),
        updatedAt: new Date("2026-04-21T00:12:00.000Z"),
        savedAt: new Date("2026-04-21T00:10:00.000Z"),
        session: {
          dimension: "joy"
        }
      }
    });

    await saveJoyInterviewDraft("session-saved-entry", {
      title: "被稳稳接住",
      content: "今天和家人一起吃饭聊天。",
      event: "今天和家人一起吃饭聊天",
      feeling: "轻松踏实",
      whyItMattered: "被家人的陪伴接住了",
      happinessType: null,
      selfPattern: "只要慢下来相处，我就更容易恢复状态",
      joyMoment: "今天和家人一起吃饭聊天",
      joySource: "被家人的陪伴接住了",
      stateShift: "从紧绷变得轻松踏实",
      meaningNeed: null,
      manualClue: "只要慢下来相处，我就更容易恢复状态",
      tags: ["关系型开心"],
      eventBlocks: [],
      source: "ai_draft_direct"
    });

    const upsertInput = mockUpsert.mock.calls[0]?.[0];

    expect(upsertInput?.update).toMatchObject({
      status: "saved",
      savedAt: new Date("2026-04-21T00:10:00.000Z")
    });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("creates a new interview session for the explicit user id without demo-user setup", async () => {
    mockTransaction.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue({
      id: "session-new",
      userId: "user-1",
      dimension: "fulfillment",
      status: "active",
      stage: "collect_event",
      activeEventId: "event-1",
      turnCount: 0,
      lastAssistantQuestion: "今天有没有一个让你真心开心的瞬间？",
      draftSummary: null,
      finalEntryId: null,
      entryDate: new Date("2026-05-15T16:00:00.000Z"),
      startedAt: new Date("2026-05-16T00:00:00.000Z"),
      pausedAt: null,
      completedAt: null,
      activeEvent: {
        id: "event-1",
        progressData: null
      },
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "active",
          stage: "collect_event",
          explorationRound: 1,
          coveredLenses: [],
          roundCoveredLenses: [],
          roundMeaningfulReplyCount: 0,
          totalMeaningfulReplyCount: 0,
          startMessageSequence: 0,
          event: null,
          feeling: null,
          whyItMattered: null,
          happinessType: null,
          selfPattern: null,
          snapshotData: {
            kind: "fulfillment"
          },
          draftSummary: null,
          confidence: null,
          missingSlots: [],
          startedAt: new Date("2026-05-16T00:00:00.000Z"),
          completedAt: null
        }
      ],
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          inputMode: null,
          content: "今天有没有一个让你真心开心的瞬间？",
          sequence: 0,
          createdAt: new Date("2026-05-16T00:00:00.000Z")
        }
      ],
      snapshots: [
        {
          version: 0,
          event: null,
          feeling: null,
          whyItMattered: null,
          happinessType: null,
          selfPattern: null,
          confidence: null,
          missingSlots: []
        }
      ],
      joyEntry: null
    });

    const session = await createJoyInterviewSession(
      "user-1",
      "fulfillment",
      "今天哪件事让你觉得这一天没有白过？",
      "2026-05-16"
    );

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const txCalls = mockTransaction.mock.calls[0]?.[0];
    expect(Array.isArray(txCalls)).toBe(true);
    expect(txCalls).toHaveLength(5);
    expect(mockTraceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          dimension: "fulfillment",
          artifactType: "interview_turn",
          status: "completed",
          outputOrigin: "deterministic"
        })
      })
    );
    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          generationTraceId: expect.any(String)
        })
      })
    );
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: expect.any(String)
        })
      })
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotData: expect.objectContaining({ kind: "fulfillment" }),
          confidence: 0,
          missingSlots: ["experience", "progressEvidence", "valueSignal"]
        })
      })
    );
    expect(session.userId).toBe("user-1");
  });
});
