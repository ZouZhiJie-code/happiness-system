/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, mockPrisma } = vi.hoisted(() => {
  type Session = {
    id: string;
    userId: string;
    mode: "event_centered";
    dimension: null;
    conversationSchemaVersion: number;
    rootSessionId: string;
    parentSessionId: string | null;
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
    userTurnId?: string;
    role: "user" | "assistant";
    content: string;
    sequence: number;
  };
  type Turn = {
    id: string;
    clientTurnId: string;
    sessionId: string;
    journalEventId: string;
    activeEventId: string | null;
    action: "reply";
    rawText: string;
    inputMode: "text" | "voice";
    baseMessageSequence: number;
    status: "processing" | "completed" | "failed" | "canceled";
    createdAt: Date;
    messages: Array<{ id: string }>;
  };

  const state = {
    sessions: [] as Session[],
    events: [] as Array<{ id: string; sessionId: string }>,
    journalEvents: [] as JournalEvent[],
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
    create: vi.fn(({ data }: any) => {
      const session: Session = {
        ...data,
        parentSessionId: data.parentSessionId ?? null,
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
      state.events.push({ id: data.id, sessionId: data.sessionId });
      return Promise.resolve(data);
    })
  };
  mockPrisma.interviewMessage = {
    create: vi.fn(({ data }: any) => {
      state.messages.push(data);
      const turn = state.turns.find((candidate) => candidate.id === data.userTurnId);
      if (turn) turn.messages.push({ id: data.id });
      return Promise.resolve(data);
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
      const key = where.sessionId_clientTurnId;
      return state.turns.find(
        (turn) => turn.sessionId === key.sessionId && turn.clientTurnId === key.clientTurnId
      ) ?? null;
    }),
    create: vi.fn(({ data }: any) => {
      const turn: Turn = {
        ...data,
        createdAt: new Date("2026-07-22T01:01:00.000Z"),
        messages: []
      };
      state.turns.push(turn);
      return Promise.resolve(turn);
    })
  };
  mockPrisma.journalEvent = {
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
        (candidate) => candidate.id === where.id && where.status.in.includes(candidate.status)
      );
      if (!event) return { count: 0 };
      Object.assign(event, data, { updatedAt: new Date("2026-07-22T01:02:00.000Z") });
      return { count: 1 };
    })
  };
  mockPrisma.$transaction = vi.fn(async (operation: any) => {
    return Array.isArray(operation) ? Promise.all(operation) : operation(mockPrisma);
  });

  return { state, mockPrisma };
});

vi.mock("@/server/db/prisma", () => ({ prisma: mockPrisma }));

import {
  abandonJournalEvent,
  completeJournalEvent,
  getEventCenteredSessionIdentity,
  markJournalEventGenerating,
  reserveEventCenteredUserTurn,
  restoreJournalEventActive,
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
    state.messages.splice(0);
    state.turns.splice(0);
    vi.clearAllMocks();
  });

  it("reuses one blank root and keeps eventId null before the first expression", async () => {
    const first = await startEventCenteredInterviewSession(startInput);
    const second = await startEventCenteredInterviewSession(startInput);

    expect(second.rootSessionId).toBe(first.rootSessionId);
    expect(first).toMatchObject({
      mode: "event_centered",
      eventId: null,
      conversationSchemaVersion: 3,
      latestMessageSequence: 0
    });
    expect(state.sessions).toHaveLength(1);
    expect(state.journalEvents).toHaveLength(0);
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
  });

  it("allocates a stable day sequence after a completed event starts the next root", async () => {
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
    await markJournalEventGenerating("user-1", firstTurn.eventId);
    await completeJournalEvent("user-1", firstTurn.eventId);

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

  it("rejects stale input and applies generating recovery and terminal tree states", async () => {
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
    expect((await markJournalEventGenerating("user-1", accepted.eventId)).status).toBe("generating");
    expect((await restoreJournalEventActive("user-1", accepted.eventId)).status).toBe("active");
    expect((await abandonJournalEvent("user-1", accepted.eventId)).status).toBe("abandoned");
    expect(state.sessions[0]?.status).toBe("abandoned");
  });
});
