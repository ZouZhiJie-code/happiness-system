const {
  mockFindUnique,
  mockUpdate,
  mockCreate,
  mockUserUpsert,
  mockUserSettingsUpsert
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockUserUpsert: vi.fn(),
  mockUserSettingsUpsert: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    interviewSession: {
      findUnique: mockFindUnique,
      update: mockUpdate
    },
    interviewEvent: {
      create: mockCreate
    },
    user: {
      upsert: mockUserUpsert
    },
    userSettings: {
      upsert: mockUserSettingsUpsert
    }
  }
}));

import { findJoyInterviewSessionById } from "@/server/repositories/joy-interview.repository";

describe("findJoyInterviewSessionById", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockCreate.mockReset();
    mockUserUpsert.mockReset();
    mockUserSettingsUpsert.mockReset();
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
    expect(session?.snapshot.directionSignal).toBeNull();
    expect(session?.snapshot.psychProfile?.track).toBe("delight_track");
    expect(session?.events[0]?.snapshotData).toMatchObject({
      kind: "joy",
      directionSignal: null
    });
  });
});
