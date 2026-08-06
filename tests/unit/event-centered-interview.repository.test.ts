/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";

const { state, mockPrisma } = vi.hoisted(() => {
  type Session = {
    id: string;
    userId: string;
    mode: "event_centered";
    dimension: null;
    conversationSchemaVersion: number;
    rootSessionId: string;
    parentSessionId: string | null;
    forkMessageSequence: number | null;
    activeBranchSessionId: string;
    activeEventId: string | null;
    entryDate: Date;
    status: "active" | "completed" | "abandoned";
    startedAt: Date;
    completedAt: Date | null;
    journalEvent: JournalEvent | null;
  };
  type JournalEvent = {
    id: string;
    userId: string;
    rootSessionId: string;
    entryDate: Date;
    daySequence: number;
    status: "active" | "generating" | "completed" | "abandoned";
    startedAt: Date;
    generationStartedAt: Date | null;
    completedAt: Date | null;
    abandonedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  type Message = {
    id: string;
    sessionId: string;
    branchSessionId: string | null;
    userTurnId: string | null;
    role: "user" | "assistant" | "system";
    inputMode: "text" | "voice" | null;
    content: string;
    sequence: number;
    responseGroupId: string | null;
    responseVersion: number | null;
    regenerationIntent: "simplify" | "concretize" | "change_angle" | "deepen" | "lighten" | null;
    regeneratedFromMessageId: string | null;
    createdAt: Date;
  };
  type Turn = {
    id: string;
    clientTurnId: string;
    sessionId: string;
    journalEventId: string;
    activeEventId: string | null;
    action: "reply" | "select_current_event" | "select_exploration_angle" | "continue_exploration" | "exit_event";
    targetMessageId: string | null;
    baseBranchSessionId: string | null;
    rawText: string | null;
    inputMode: "text" | "voice" | null;
    baseMessageSequence: number;
    status: "processing" | "completed" | "failed" | "canceled";
    attemptCount: number;
    errorCode: string | null;
    eventOperationData: Record<string, unknown> | null;
    createdAt: Date;
    messages: Array<{ id: string }>;
  };

  const state = {
    sessions: [] as Session[],
    events: [] as Array<{ id: string; sessionId: string; snapshotData: unknown }>,
    journalEvents: [] as JournalEvent[],
    journalEventEntries: [] as Array<{
      id: string;
      eventId: string;
      title?: string;
      status: "draft" | "saved" | "modified";
      generationVersion: number;
      contentRevision: number;
      savedRevision: number | null;
      updatedAt: Date;
    }>,
    messages: [] as Message[],
    turns: [] as Turn[]
  };

  const withRouteProjection = (session: Session) => ({
    ...session,
    journalEvent: state.journalEvents.find((event) => event.rootSessionId === session.id) ?? session.journalEvent,
    messages: state.messages
      .filter((message) => message.sessionId === session.id)
      .sort((left, right) => right.sequence - left.sequence)
      .slice(0, 1)
      .map(({ sequence }) => ({ sequence }))
  });

  const mockPrisma: Record<string, any> = {};
  mockPrisma.interviewSession = {
    findFirst: vi.fn(async ({ where }: any) => {
      const session = state.sessions.find((candidate) => {
        if (where.id && candidate.id !== where.id) return false;
        if (where.userId && candidate.userId !== where.userId) return false;
        if (where.mode && candidate.mode !== where.mode) return false;
        if (where.status && candidate.status !== where.status) return false;
        if (where.parentSessionId === null && candidate.parentSessionId !== null) return false;
        if (where.entryDate && candidate.entryDate.getTime() !== where.entryDate.getTime()) return false;
        return true;
      });
      return session ? withRouteProjection(session) : null;
    }),
    findMany: vi.fn(async ({ where }: any) =>
      state.sessions
        .filter((session) => {
          if (!where?.OR) return true;
          return where.OR.some((condition: any) =>
            condition.id ? session.id === condition.id : session.rootSessionId === condition.rootSessionId
          );
        })
        .map((session) => ({
          id: session.id,
          parentSessionId: session.parentSessionId,
          forkMessageSequence: session.forkMessageSequence
        }))
    ),
    create: vi.fn(({ data }: any) => {
      const session: Session = {
        ...data,
        parentSessionId: data.parentSessionId ?? null,
        forkMessageSequence: data.forkMessageSequence ?? null,
        startedAt: new Date("2026-07-22T01:00:00.000Z"),
        completedAt: null,
        journalEvent: null
      };
      state.sessions.push(session);
      return Promise.resolve(session);
    }),
    update: vi.fn(({ where, data }: any) => {
      const session = state.sessions.find((candidate) => candidate.id === where.id)!;
      Object.assign(session, data);
      return Promise.resolve(session);
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const rootId = where.OR[0].id;
      let count = 0;
      for (const session of state.sessions) {
        if (session.id === rootId || session.rootSessionId === rootId) {
          session.status = data.status;
          session.completedAt = data.completedAt;
          count += 1;
        }
      }
      return { count };
    })
  };
  mockPrisma.interviewEvent = {
    create: vi.fn(({ data }: any) => {
      state.events.push({ id: data.id, sessionId: data.sessionId, snapshotData: data.snapshotData ?? null });
      return Promise.resolve(data);
    }),
    findUnique: vi.fn(async ({ where }: any) =>
      state.events.find((event) => event.id === where.id) ?? null
    )
  };
  mockPrisma.interviewMessage = {
    create: vi.fn(({ data }: any) => {
      const message: Message = {
        ...data,
        branchSessionId: data.branchSessionId ?? data.sessionId,
        userTurnId: data.userTurnId ?? null,
        inputMode: data.inputMode ?? null,
        responseGroupId: data.responseGroupId ?? null,
        responseVersion: data.responseVersion ?? null,
        regenerationIntent: data.regenerationIntent ?? null,
        regeneratedFromMessageId: data.regeneratedFromMessageId ?? null,
        createdAt: data.createdAt ?? new Date(`2026-07-22T01:0${data.sequence}:00.000Z`)
      };
      state.messages.push(message);
      const turn = state.turns.find((candidate) => candidate.id === data.userTurnId);
      if (turn) turn.messages.push({ id: data.id });
      return Promise.resolve(message);
    }),
    findMany: vi.fn(async ({ where }: any) => {
      const messages = state.messages.filter((message) => {
        if (where.sessionId?.in && !where.sessionId.in.includes(message.sessionId)) return false;
        if (where.responseGroupId?.in && !where.responseGroupId.in.includes(message.responseGroupId)) return false;
        return true;
      });
      return messages
        .sort((left, right) => left.sequence - right.sequence || left.createdAt.getTime() - right.createdAt.getTime())
        .map((message) => ({
          ...message,
          userTurn: message.userTurnId
            ? {
                rawText: state.turns.find((turn) => turn.id === message.userTurnId)?.rawText ?? null,
                clientTurnId: state.turns.find((turn) => turn.id === message.userTurnId)?.clientTurnId ?? null
              }
            : null
        }));
    })
  };
  mockPrisma.interviewBranchCheckpoint = {
    create: vi.fn(({ data }: any) => Promise.resolve(data))
  };
  mockPrisma.interviewUserTurn = {
    findFirst: vi.fn(async ({ where }: any) => {
      if (where.clientTurnId) {
        return state.turns.find((turn) => turn.clientTurnId === where.clientTurnId) ?? null;
      }
      if (where.sessionId && where.status?.in) {
        return state.turns.find(
          (turn) => turn.sessionId === where.sessionId && where.status.in.includes(turn.status)
        ) ?? null;
      }
      return null;
    }),
    findUnique: vi.fn(async ({ where }: any) => {
      if (where.id) {
        return state.turns.find((turn) => turn.id === where.id) ?? null;
      }
      const key = where.sessionId_clientTurnId;
      return state.turns.find(
        (turn) => turn.sessionId === key.sessionId && turn.clientTurnId === key.clientTurnId
      ) ?? null;
    }),
    create: vi.fn(({ data }: any) => {
      const turn: Turn = {
        ...data,
        targetMessageId: data.targetMessageId ?? null,
        baseBranchSessionId: data.baseBranchSessionId ?? null,
        rawText: data.rawText ?? null,
        inputMode: data.inputMode ?? null,
        attemptCount: data.attemptCount ?? 1,
        errorCode: data.errorCode ?? null,
        eventOperationData: data.eventOperationData ?? null,
        createdAt: new Date("2026-07-22T01:01:00.000Z"),
        messages: []
      };
      state.turns.push(turn);
      return Promise.resolve(turn);
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const turn = state.turns.find((candidate) => {
        if (where.id && candidate.id !== where.id) return false;
        if (where.sessionId && candidate.sessionId !== where.sessionId) return false;
        if (where.journalEventId && candidate.journalEventId !== where.journalEventId) return false;
        if (where.activeEventId && candidate.activeEventId !== where.activeEventId) return false;
        if (where.status && candidate.status !== where.status) return false;
        return true;
      });
      if (!turn) return { count: 0 };
      Object.assign(turn, data);
      return { count: 1 };
    })
  };
  mockPrisma.journalEvent = {
    findMany: vi.fn(async ({ where }: any) =>
      state.journalEvents
        .filter((event) => {
          if (where.userId && event.userId !== where.userId) return false;
          if (where.entryDate && event.entryDate.getTime() !== where.entryDate.getTime()) return false;
          return true;
        })
        .sort((left, right) => left.daySequence - right.daySequence || left.startedAt.getTime() - right.startedAt.getTime())
        .map((event) => ({
          rootSessionId: event.rootSessionId,
          daySequence: event.daySequence,
          status: event.status,
          entry: (() => {
            const entry = state.journalEventEntries.find((candidate) => candidate.eventId === event.id);
            return entry ? { title: entry.title ?? "" } : null;
          })()
        }))
    ),
    findFirst: vi.fn(async ({ where, orderBy }: any) => {
      const matches = state.journalEvents.filter((event) => {
        if (where.id && event.id !== where.id) return false;
        if (where.userId && event.userId !== where.userId) return false;
        if (where.entryDate && event.entryDate.getTime() !== where.entryDate.getTime()) return false;
        return true;
      });
      return orderBy?.daySequence === "desc"
        ? matches.sort((left, right) => right.daySequence - left.daySequence)[0] ?? null
        : matches[0] ?? null;
    }),
    findUnique: vi.fn(async ({ where }: any) => {
      if (where.rootSessionId) {
        return state.journalEvents.find((event) => event.rootSessionId === where.rootSessionId) ?? null;
      }
      return state.journalEvents.find((event) => event.id === where.id) ?? null;
    }),
    create: vi.fn(({ data }: any) => {
      const event: JournalEvent = {
        ...data,
        generationStartedAt: null,
        completedAt: null,
        abandonedAt: null,
        createdAt: data.startedAt,
        updatedAt: data.startedAt
      };
      state.journalEvents.push(event);
      const root = state.sessions.find((session) => session.id === event.rootSessionId);
      if (root) root.journalEvent = event;
      return Promise.resolve(event);
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const event = state.journalEvents.find(
        (candidate) =>
          candidate.id === where.id &&
          (typeof where.status === "string"
            ? where.status === candidate.status
            : where.status.in.includes(candidate.status))
      );
      if (!event) return { count: 0 };
      Object.assign(event, data, { updatedAt: new Date("2026-07-22T01:02:00.000Z") });
      return { count: 1 };
    })
  };
  mockPrisma.journalEventEntry = {
    findFirst: vi.fn(async ({ where }: any) =>
      state.journalEventEntries.find((entry) => entry.eventId === where.eventId) ?? null
    )
  };
  mockPrisma.$transaction = vi.fn(async (operation: any) => {
    return Array.isArray(operation) ? Promise.all(operation) : operation(mockPrisma);
  });

  return { state, mockPrisma };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

const { claimJournalDayModeInTransaction, resolveJournalDayMode } = vi.hoisted(() => ({
  claimJournalDayModeInTransaction: vi.fn(async (): Promise<any> => ({
    kind: "claimed",
    ownership: { id: "day-mode-1" }
  })),
  resolveJournalDayMode: vi.fn(async (): Promise<any> => ({
    kind: "unclaimed",
    entryDate: "2026-07-22"
  }))
}));

vi.mock("@/server/repositories/journal-day-mode.repository", () => ({
  claimJournalDayModeInTransaction,
  resolveJournalDayMode
}));

import {
  abandonJournalEvent,
  consumeEventCenteredGenerativePlanCheckpoint,
  discardEventCenteredGenerativePlanCheckpoint,
  getEventCenteredGenerativePlanCheckpoint,
  getEventCenteredInterviewWorkspaceData,
  getEventCenteredSessionIdentity,
  listEventCenteredSessionTabsByDate,
  persistEventCenteredGenerativePlanCheckpoint,
  reserveEventCenteredUserAction,
  reserveEventCenteredUserTurn,
  startEventCenteredInterviewSession
} from "@/server/repositories/event-centered-interview.repository";

const startInput = {
  userId: "user-1",
  entryDate: "2026-07-22",
  openingQuestion: "先从这件事开始吧。刚刚发生了什么？"
};

describe("event-centered interview aggregate", () => {
  beforeEach(() => {
    state.sessions.splice(0);
    state.events.splice(0);
    state.journalEvents.splice(0);
    state.journalEventEntries.splice(0);
    state.messages.splice(0);
    state.turns.splice(0);
    vi.clearAllMocks();
    claimJournalDayModeInTransaction.mockResolvedValue({
      kind: "claimed",
      ownership: { id: "day-mode-1" }
    });
    resolveJournalDayMode.mockResolvedValue({ kind: "unclaimed", entryDate: "2026-07-22" });
  });

  it("reuses one blank root and keeps eventId null before the first expression", async () => {
    const first = await startEventCenteredInterviewSession(startInput);
    const second = await startEventCenteredInterviewSession(startInput);

    expect(second.rootSessionId).toBe(first.rootSessionId);
    expect(first).toMatchObject({
      mode: "event_centered",
      eventId: null,
      conversationSchemaVersion: 4,
      latestMessageSequence: 0
    });
    expect(state.sessions).toHaveLength(1);
    expect(state.journalEvents).toHaveLength(0);
  });

  it("当天事件标签保留已退出记录，并只返回安全标题元数据", async () => {
    const active = await startEventCenteredInterviewSession(startInput);
    const reserved = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: active.rootSessionId,
      clientTurnId: "turn-abandoned-tab",
      rawText: "这段原话只能留在对话里。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: active.activeBranchSessionId
    });
    await abandonJournalEvent("user-1", reserved.eventId);

    const tabs = await listEventCenteredSessionTabsByDate("user-1", "2026-07-22");

    expect(tabs).toEqual([{
      rootSessionId: active.rootSessionId,
      label: "事件 1",
      status: "abandoned"
    }]);
    expect(JSON.stringify(tabs)).not.toContain("这段原话只能留在对话里");
  });

  it("creates the stable event with the exact first raw text and replays idempotently", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const input = {
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "turn-client-1",
      rawText: "  原样保留这一段。\n",
      inputMode: "text" as const,
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    };

    const first = await reserveEventCenteredUserTurn(input);
    const replay = await reserveEventCenteredUserTurn(input);
    const hydrated = await getEventCenteredSessionIdentity("user-1", session.rootSessionId);

    expect(first.kind).toBe("reserved");
    expect(first.turn.rawText).toBe("  原样保留这一段。\n");
    expect(replay).toMatchObject({ kind: "existing", eventId: first.eventId });
    expect(hydrated).toMatchObject({ eventId: first.eventId, eventStatus: "active" });
    expect(state.journalEvents).toHaveLength(1);
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]?.journalEventId).toBe(first.eventId);
    expect(state.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(claimJournalDayModeInTransaction).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        userId: "user-1",
        entryDate: "2026-07-22",
        mode: "event_centered",
        claimedBySessionId: session.rootSessionId
      })
    );
  });

  it("事务内拒绝重新进入已经关闭的角度", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const first = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "turn-close-angle-seed",
      rawText: "今天开会时我有点委屈。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    const branchState = state.events.find((event) => event.id === first.branchStateId);
    expect(branchState).toBeTruthy();
    const dialogueState = createInitialEventCenteredDialogueState();
    dialogueState.phase = "checkpoint_two";
    dialogueState.angleRuns.feeling = {
      ...dialogueState.angleRuns.feeling!,
      status: "closed"
    };
    branchState!.snapshotData = dialogueState;

    await expect(reserveEventCenteredUserAction({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "turn-closed-angle",
      rawText: "理解感受",
      inputMode: "text",
      baseMessageSequence: 1,
      baseBranchSessionId: session.activeBranchSessionId,
      action: "select_exploration_angle",
      eventOperationData: {
        kind: "select_exploration_angle",
        angle: "feeling",
        displayText: "理解感受"
      }
    })).rejects.toThrow("EVENT_ANGLE_CLOSED");
  });

  it("allocates a stable day sequence after an abandoned event starts the next root", async () => {
    const firstSession = await startEventCenteredInterviewSession(startInput);
    const firstTurn = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: firstSession.rootSessionId,
      clientTurnId: "turn-1",
      rawText: "第一件事",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: firstSession.activeBranchSessionId
    });
    await abandonJournalEvent("user-1", firstTurn.eventId);

    const secondSession = await startEventCenteredInterviewSession(startInput);
    const secondTurn = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: secondSession.rootSessionId,
      clientTurnId: "turn-2",
      rawText: "第二件事",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: secondSession.activeBranchSessionId
    });

    expect(secondSession.rootSessionId).not.toBe(firstSession.rootSessionId);
    expect(state.journalEvents.find((event) => event.id === firstTurn.eventId)?.daySequence).toBe(1);
    expect(state.journalEvents.find((event) => event.id === secondTurn.eventId)?.daySequence).toBe(2);
  });

  it("rejects stale input and applies the explicit exit terminal state", async () => {
    const session = await startEventCenteredInterviewSession(startInput);

    await expect(reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "stale-turn",
      rawText: "旧位置的内容",
      inputMode: "text",
      baseMessageSequence: -1,
      baseBranchSessionId: session.activeBranchSessionId
    })).rejects.toThrow("EVENT_STATE_CHANGED");

    const accepted = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "turn-ok",
      rawText: "当前内容",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    expect((await abandonJournalEvent("user-1", accepted.eventId)).status).toBe("abandoned");
    expect(state.sessions[0]?.status).toBe("abandoned");
  });

  it("does not create a new event when the date belongs to the legacy route", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    claimJournalDayModeInTransaction.mockResolvedValueOnce({
      kind: "conflict",
      code: "JOURNAL_DAY_MODE_CONFLICT",
      ownership: { id: "day-mode-legacy" }
    });

    await expect(reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "conflicting-turn",
      rawText: "这一段应保留在输入框，等待回到已有记录。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    })).rejects.toThrow("JOURNAL_DAY_MODE_CONFLICT");

    expect(state.journalEvents).toHaveLength(0);
    expect(state.turns).toHaveLength(0);
  });

  it("does not create a blank event session when the day belongs to the legacy route", async () => {
    resolveJournalDayMode.mockResolvedValueOnce({
      kind: "clean",
      ownership: { primaryMode: "dimension_legacy" }
    });

    await expect(startEventCenteredInterviewSession(startInput)).rejects.toThrow("JOURNAL_DAY_MODE_CONFLICT");
    expect(state.sessions).toHaveLength(0);
  });

  it("stores reliable event actions with their parameters and leaves exit transition to the service", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const first = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "content-turn",
      rawText: "今天开会时，我把卡了很久的问题说清楚了。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    state.turns[0]!.status = "completed";

    const actions = [
      {
        clientTurnId: "focus-action",
        action: "select_current_event" as const,
        eventOperationData: {
          kind: "select_current_event" as const,
          optionId: "meeting",
          displayText: "开会时说清问题"
        }
      },
      {
        clientTurnId: "angle-action",
        action: "select_exploration_angle" as const,
        eventOperationData: {
          kind: "select_exploration_angle" as const,
          angle: "thought" as const
        }
      },
      {
        clientTurnId: "continue-action",
        action: "continue_exploration" as const,
        eventOperationData: {
          kind: "continue_exploration" as const,
          angle: "thought" as const
        }
      },
      {
        clientTurnId: "exit-action",
        action: "exit_event" as const,
        eventOperationData: {
          kind: "exit_event" as const,
          reason: "user_clicked_exit"
        }
      }
    ];

    for (const action of actions) {
      const baseMessageSequence = state.messages.at(-1)!.sequence;
      const reserved = await reserveEventCenteredUserAction({
        userId: "user-1",
        rootSessionId: session.rootSessionId,
        baseBranchSessionId: session.activeBranchSessionId,
        baseMessageSequence,
        ...action
      });
      expect(reserved).toMatchObject({ kind: "reserved", eventId: first.eventId });
      state.turns.at(-1)!.status = "completed";
    }

    expect(state.turns.slice(1).map((turn) => [turn.action, turn.eventOperationData])).toEqual([
      ["select_current_event", actions[0]!.eventOperationData],
      ["select_exploration_angle", actions[1]!.eventOperationData],
      ["continue_exploration", actions[2]!.eventOperationData],
      ["exit_event", actions[3]!.eventOperationData]
    ]);
    expect(state.messages.slice(2).map((message) => message.content)).toEqual([
      "开会时说清问题",
      "理清想法",
      "继续深入",
      "退出这件事"
    ]);
    expect(state.journalEvents[0]?.status).toBe("active");
    expect(state.sessions[0]?.status).toBe("active");

    const replay = await reserveEventCenteredUserAction({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      baseBranchSessionId: session.activeBranchSessionId,
      baseMessageSequence: 4,
      ...actions[3]!
    });
    expect(replay.kind).toBe("existing");
    expect(state.turns).toHaveLength(5);
  });

  it("persists the assistant message targeted by a correction", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const first = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "content-before-correction",
      rawText: "今天开会时，我把卡了很久的问题说清楚了。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    state.turns[0]!.status = "completed";

    const correction = await reserveEventCenteredUserAction({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "outcome-correction",
      baseBranchSessionId: session.activeBranchSessionId,
      baseMessageSequence: 1,
      action: "correct_understanding",
      rawText: "这个理解不准确。",
      inputMode: "text",
      targetMessageId: "assistant-outcome-1"
    });

    expect(correction).toMatchObject({ kind: "reserved", eventId: first.eventId });
    expect(state.turns.at(-1)).toMatchObject({
      action: "correct_understanding",
      targetMessageId: "assistant-outcome-1",
      rawText: "这个理解不准确。"
    });
  });

  it("persists a frozen generative plan internally and hides it from workspace clients", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const reserved = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "checkpoint-client-turn",
      rawText: "主管认可了数据和结论，但说开头太绕。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });

    const checkpoint = await persistEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      userTurnId: reserved.turn.id,
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      eventId: reserved.eventId,
      branchStateId: reserved.branchStateId,
      inputFingerprint: "input-fingerprint-v1",
      artifactVersion: "artifact-v1",
      strategyVersion: "5.43.0",
      angleCardVersion: "2.10.0",
      fewShotVersion: "v22",
      promptVersion: "v59",
      artifact: {
        artifactVersion: "artifact-v1",
        semanticPlan: { action: "ask", selectedTargetId: "professional_standard" }
      }
    });
    state.turns[0]!.status = "failed";
    state.turns[0]!.errorCode = "VISIBLE_STAGE_FAILED";

    const recovered = await getEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      clientTurnId: reserved.turn.clientTurnId
    });
    const workspace = await getEventCenteredInterviewWorkspaceData(
      "user-1",
      reserved.rootSessionId
    );

    expect(checkpoint).toMatchObject({
      kind: "generative_semantic_plan_checkpoint",
      status: "ready",
      inputFingerprint: "input-fingerprint-v1"
    });
    expect(recovered).toEqual(checkpoint);
    expect(workspace?.pendingTurn).toMatchObject({
      clientTurnId: "checkpoint-client-turn",
      eventOperationData: null
    });

    state.sessions[0]!.activeEventId = "different-branch-state";
    await expect(getEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      clientTurnId: reserved.turn.clientTurnId
    })).rejects.toThrow("EVENT_GENERATIVE_PLAN_CHECKPOINT_STALE");

    state.sessions[0]!.activeEventId = reserved.branchStateId;
    state.turns[0]!.eventOperationData = {
      ...(state.turns[0]!.eventOperationData ?? {}),
      checkpointVersion: "obsolete-checkpoint-version"
    };
    await expect(getEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      clientTurnId: reserved.turn.clientTurnId
    })).rejects.toThrow("EVENT_GENERATIVE_PLAN_CHECKPOINT_VERSION_UNSUPPORTED");
  });

  it.each([
    "event-centered-semantic-plan.v1",
    "event-centered-semantic-plan.v2",
    "event-centered-semantic-plan.v3",
    "event-centered-semantic-plan.v4",
    "event-centered-semantic-plan.v5",
    "event-centered-semantic-plan.v6",
    "event-centered-semantic-plan.v7",
    "event-centered-semantic-plan.v8",
    "event-centered-semantic-plan.v9",
    "event-centered-semantic-plan.v10",
    "event-centered-semantic-plan.v11",
    "event-centered-semantic-plan.v12",
    "event-centered-semantic-plan.v13",
    "event-centered-semantic-plan.v14",
    "event-centered-semantic-plan.v15",
    "event-centered-semantic-plan.v16"
  ] as const)("replaces matching legacy artifact %s with v17 and preserves v17 idempotence", async (
    legacyArtifactVersion
  ) => {
    const session = await startEventCenteredInterviewSession(startInput);
    const reserved = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: `semantic-skeleton-upgrade-${legacyArtifactVersion}`,
      rawText: "帮我拿快递本身可以，但替我答应别人会让我不舒服。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    const route = {
      userId: "user-1",
      userTurnId: reserved.turn.id,
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      eventId: reserved.eventId,
      branchStateId: reserved.branchStateId,
      inputFingerprint: "same-meaning-input"
    };
    await persistEventCenteredGenerativePlanCheckpoint({
      ...route,
      artifactVersion: legacyArtifactVersion,
      strategyVersion: "5.46.0",
      angleCardVersion: "2.12.0",
      fewShotVersion: "v25",
      promptVersion: "v66",
      artifact: { artifactVersion: legacyArtifactVersion, marker: "legacy" }
    });

    const v17Artifact = {
      artifactVersion: "event-centered-semantic-plan.v17",
      decisionOrigin: "user_articulated",
      semanticFrame: {
        units: [{ id: "u1", role: "event", evidenceRefs: ["new:1"] }],
        relation: null
      },
      providerQuestionIntent: null,
      providerLimitReason: null
    };
    const v17Input = {
      ...route,
      artifactVersion: "event-centered-semantic-plan.v17",
      strategyVersion: "5.65.0",
      angleCardVersion: "2.18.0",
      fewShotVersion: "quality-patterns.2026-08-04.v35",
      promptVersion: "2026-08-04.event-centered-thought-pilot-v85-gi066-fix",
      artifact: v17Artifact
    };
    const replacement = await persistEventCenteredGenerativePlanCheckpoint(v17Input);
    const repeated = await persistEventCenteredGenerativePlanCheckpoint({
      ...v17Input,
      artifact: {
        providerLimitReason: null,
        semanticFrame: v17Artifact.semanticFrame,
        artifactVersion: v17Artifact.artifactVersion,
        providerQuestionIntent: null,
        decisionOrigin: "user_articulated"
      }
    });
    await expect(persistEventCenteredGenerativePlanCheckpoint({
      ...v17Input,
      artifact: { ...v17Artifact, providerLimitReason: { kind: "user_boundary" } }
    })).rejects.toThrow("EVENT_GENERATIVE_PLAN_CHECKPOINT_CONFLICT");
    state.turns[0]!.status = "failed";

    const recovered = await getEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      clientTurnId: reserved.turn.clientTurnId
    });
    expect(replacement).toMatchObject({
      artifactVersion: "event-centered-semantic-plan.v17",
      promptVersion: "2026-08-04.event-centered-thought-pilot-v85-gi066-fix",
      artifact: {
        artifactVersion: "event-centered-semantic-plan.v17",
        decisionOrigin: "user_articulated",
        semanticFrame: v17Artifact.semanticFrame
      }
    });
    expect(repeated).toEqual(replacement);
    expect(recovered).toEqual(replacement);
  });

  it("rejects replacing a legacy semantic artifact when the input fingerprint changed", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const reserved = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "legacy-meaning-card-mismatch",
      rawText: "这轮原话已保存。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    const route = {
      userId: "user-1",
      userTurnId: reserved.turn.id,
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      eventId: reserved.eventId,
      branchStateId: reserved.branchStateId
    };
    await persistEventCenteredGenerativePlanCheckpoint({
      ...route,
      inputFingerprint: "legacy-input",
      artifactVersion: "event-centered-semantic-plan.v1",
      strategyVersion: "5.46.0",
      angleCardVersion: "2.12.0",
      fewShotVersion: "v25",
      promptVersion: "v66",
      artifact: { artifactVersion: "event-centered-semantic-plan.v1" }
    });

    await expect(persistEventCenteredGenerativePlanCheckpoint({
      ...route,
      inputFingerprint: "different-input",
      artifactVersion: "event-centered-semantic-plan.v5",
      strategyVersion: "5.50.0",
      angleCardVersion: "2.12.0",
      fewShotVersion: "quality-patterns.2026-08-02.v29",
      promptVersion: "2026-08-02.event-centered-generative-v72-semantic-origin",
      artifact: { artifactVersion: "event-centered-semantic-plan.v5" }
    })).rejects.toThrow("EVENT_GENERATIVE_PLAN_CHECKPOINT_CONFLICT");
  });

  it("preserves control-operation data inside a plan checkpoint and marks it consumed after commit", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const first = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "initial-content",
      rawText: "今天开会时，我把延期风险说清楚了。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    state.turns[0]!.status = "completed";
    const reserved = await reserveEventCenteredUserAction({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "angle-with-checkpoint",
      baseMessageSequence: 1,
      baseBranchSessionId: session.activeBranchSessionId,
      action: "select_exploration_angle",
      eventOperationData: {
        kind: "select_exploration_angle",
        angle: "thought"
      }
    });
    const checkpoint = await persistEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      userTurnId: reserved.turn.id,
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      eventId: first.eventId,
      branchStateId: reserved.branchStateId,
      inputFingerprint: "control-fingerprint",
      artifactVersion: "artifact-v1",
      strategyVersion: "5.43.0",
      angleCardVersion: "2.10.0",
      fewShotVersion: "v22",
      promptVersion: "v59",
      artifact: { artifactVersion: "artifact-v1", semanticPlan: { action: "ask" } }
    });
    expect(checkpoint.operationData).toEqual({
      kind: "select_exploration_angle",
      angle: "thought"
    });

    state.turns.at(-1)!.status = "completed";
    const consumed = await consumeEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      userTurnId: reserved.turn.id,
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      eventId: reserved.eventId,
      branchStateId: reserved.branchStateId
    });

    expect(consumed).toMatchObject({
      status: "consumed",
      operationData: { kind: "select_exploration_angle", angle: "thought" }
    });
    expect(consumed.consumedAt).toEqual(expect.any(String));
  });

  it("discards an uncommitted semantic checkpoint and restores the original operation data", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const initial = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "content-before-discard",
      rawText: "今天开会时，我把延期风险说清楚了。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    state.turns[0]!.status = "completed";
    const reserved = await reserveEventCenteredUserAction({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "angle-before-discard",
      baseBranchSessionId: session.activeBranchSessionId,
      baseMessageSequence: 1,
      action: "select_exploration_angle",
      eventOperationData: {
        kind: "select_exploration_angle",
        angle: "relationship"
      }
    });
    await persistEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      userTurnId: reserved.turn.id,
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      eventId: initial.eventId,
      branchStateId: reserved.branchStateId,
      inputFingerprint: "discard-input",
      artifactVersion: "event-centered-semantic-plan.v5",
      strategyVersion: "5.50.0",
      angleCardVersion: "2.12.0",
      fewShotVersion: "quality-patterns.2026-08-02.v29",
      promptVersion: "2026-08-02.event-centered-generative-v72-semantic-origin",
      artifact: { artifactVersion: "event-centered-semantic-plan.v5" }
    });

    const restored = await discardEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      userTurnId: reserved.turn.id,
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      eventId: reserved.eventId,
      branchStateId: reserved.branchStateId
    });

    expect(restored).toEqual({
      kind: "select_exploration_angle",
      angle: "relationship"
    });
    expect(state.turns.at(-1)?.eventOperationData).toEqual(restored);
  });

  it("keeps the first frozen plan when concurrent persistence loses the conditional write", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const reserved = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "concurrent-checkpoint",
      rawText: "我把延期风险说清楚了。",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    const winner = {
      kind: "generative_semantic_plan_checkpoint",
      checkpointVersion: "2026-07-30.v1",
      status: "ready",
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      eventId: reserved.eventId,
      branchStateId: reserved.branchStateId,
      inputFingerprint: "same-input",
      artifactVersion: "artifact-v1",
      strategyVersion: "5.43.0",
      angleCardVersion: "2.10.0",
      fewShotVersion: "v22",
      promptVersion: "v59",
      artifact: { marker: "first-writer" },
      operationData: null,
      createdAt: "2026-07-30T12:00:00.000Z",
      consumedAt: null
    };
    mockPrisma.interviewUserTurn.updateMany.mockImplementationOnce(async () => {
      state.turns[0]!.eventOperationData = winner;
      return { count: 0 };
    });

    const persisted = await persistEventCenteredGenerativePlanCheckpoint({
      userId: "user-1",
      userTurnId: reserved.turn.id,
      rootSessionId: reserved.rootSessionId,
      activeBranchSessionId: reserved.activeBranchSessionId,
      eventId: reserved.eventId,
      branchStateId: reserved.branchStateId,
      inputFingerprint: "same-input",
      artifactVersion: "artifact-v1",
      strategyVersion: "5.43.0",
      angleCardVersion: "2.10.0",
      fewShotVersion: "v22",
      promptVersion: "v59",
      artifact: { marker: "second-writer" }
    });

    expect(persisted.artifact).toEqual({ marker: "first-writer" });
    expect(state.turns[0]!.eventOperationData).toEqual(winner);
  });

  it("hydrates the active branch path, reply versions, recovery turn, snapshot, and entry status", async () => {
    const session = await startEventCenteredInterviewSession(startInput);
    const first = await reserveEventCenteredUserTurn({
      userId: "user-1",
      rootSessionId: session.rootSessionId,
      clientTurnId: "root-user-turn",
      rawText: "  这段原话要完整恢复。\n",
      inputMode: "text",
      baseMessageSequence: 0,
      baseBranchSessionId: session.activeBranchSessionId
    });
    state.turns[0]!.status = "completed";
    state.messages.push({
      id: "root-reply",
      sessionId: session.rootSessionId,
      branchSessionId: session.rootSessionId,
      userTurnId: null,
      role: "assistant",
      inputMode: null,
      content: "原来的问法",
      sequence: 2,
      responseGroupId: "reply-group",
      responseVersion: 1,
      regenerationIntent: null,
      regeneratedFromMessageId: null,
      createdAt: new Date("2026-07-22T01:03:00.000Z")
    });

    const root = state.sessions[0]!;
    const childId = "branch-session-2";
    state.sessions.push({
      ...root,
      id: childId,
      rootSessionId: root.id,
      parentSessionId: root.id,
      forkMessageSequence: 2,
      activeBranchSessionId: childId,
      activeEventId: "branch-state-2",
      journalEvent: null
    });
    root.activeBranchSessionId = childId;
    state.events.push({
      id: "branch-state-2",
      sessionId: childId,
      snapshotData: { kind: "event_centered", phase: "guided_reflection" }
    });
    state.messages.push({
      id: "active-reply",
      sessionId: childId,
      branchSessionId: childId,
      userTurnId: null,
      role: "assistant",
      inputMode: null,
      content: "换一种问法",
      sequence: 2,
      responseGroupId: "reply-group",
      responseVersion: 2,
      regenerationIntent: "simplify",
      regeneratedFromMessageId: "root-reply",
      createdAt: new Date("2026-07-22T01:04:00.000Z")
    });
    state.turns.push({
      id: "failed-turn",
      clientTurnId: "failed-client-turn",
      sessionId: childId,
      journalEventId: first.eventId,
      activeEventId: "branch-state-2",
      action: "continue_exploration",
      targetMessageId: null,
      baseBranchSessionId: childId,
      rawText: null,
      inputMode: null,
      baseMessageSequence: 2,
      status: "failed",
      attemptCount: 2,
      errorCode: "AI_PROVIDER_FAILED",
      eventOperationData: { kind: "continue_exploration", angle: "thought" },
      createdAt: new Date("2026-07-22T01:05:00.000Z"),
      messages: []
    });
    state.journalEventEntries.push({
      id: "event-entry-1",
      eventId: first.eventId,
      status: "draft",
      generationVersion: 1,
      contentRevision: 1,
      savedRevision: null,
      updatedAt: new Date("2026-07-22T01:06:00.000Z")
    });

    const workspace = await getEventCenteredInterviewWorkspaceData("user-1", childId);

    expect(workspace?.identity).toMatchObject({
      rootSessionId: root.id,
      activeBranchSessionId: childId,
      latestMessageSequence: 2
    });
    expect(workspace?.messages.map((message) => message.id)).toEqual([
      expect.any(String),
      first.userMessageId,
      "active-reply"
    ]);
    expect(workspace?.messages[1]?.rawText).toBe("  这段原话要完整恢复。\n");
    expect(workspace?.responseVersions.map((message) => message.id)).toEqual(
      expect.arrayContaining(["root-reply", "active-reply"])
    );
    expect(workspace?.snapshotData).toEqual({ kind: "event_centered", phase: "guided_reflection" });
    expect(workspace?.pendingTurn).toMatchObject({
      clientTurnId: "failed-client-turn",
      action: "continue_exploration",
      attemptCount: 2,
      eventOperationData: { kind: "continue_exploration", angle: "thought" }
    });
    expect(workspace?.journalEntry).toMatchObject({
      id: "event-entry-1",
      status: "draft",
      contentRevision: 1
    });
  });
});
