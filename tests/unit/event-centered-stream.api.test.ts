import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  respond: vi.fn()
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mocks.requireUser
}));

vi.mock("@/server/services/interview/event-centered-interview.service", () => ({
  respondEventCenteredInterview: mocks.respond
}));

import { POST } from "@/app/api/interview/event-centered/session/respond/stream/route";

const now = "2026-07-22T12:00:00.000Z";

function acceptedTurn() {
  return {
    kind: "reserved" as const,
    eventId: "event-1",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    branchStateId: "state-1",
    userMessageId: "message-user-1",
    turn: {
      id: "turn-1",
      clientTurnId: "client-1",
      sessionId: "branch-1",
      rawText: "今天开会时我主动说明了延期风险。",
      inputMode: "text" as const,
      baseMessageSequence: 1,
      status: "processing" as const,
      createdAt: now
    }
  };
}

function workspace() {
  return {
    mode: "event_centered" as const,
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    eventId: "event-1",
    branchStateId: "state-1",
    entryDate: "2026-07-22",
    conversationSchemaVersion: 3,
    sessionStatus: "active" as const,
    eventStatus: "active" as const,
    latestMessageSequence: 2,
    journalEvent: {
      id: "event-1",
      entryDate: "2026-07-22",
      daySequence: 1,
      status: "active" as const,
      startedAt: now,
      generationStartedAt: null,
      completedAt: null,
      abandonedAt: null
    },
    messages: [],
    dialogue: {
      phase: "checkpoint_one" as const,
      activeAngle: null,
      questionOpportunityCount: 0,
      completedAngles: [],
      availableAngles: ["feeling", "thought", "relationship", "action"] as const,
      reopenedAngles: [],
      outcomes: [],
      checkpoint: { kind: "first" as const, outcome: null },
      allowedActions: [
        "reply",
        "select_exploration_angle",
        "correct_understanding",
        "regenerate_response",
        "switch_response_version",
        "exit_event"
      ] as const,
      progress: [
        { id: "record" as const, label: "轻量记录" as const, status: "complete" as const, percent: 100, detail: "辨认这件事" },
        { id: "reflect" as const, label: "引导复盘" as const, status: "current" as const, percent: 0, detail: "选择角度理解" },
        { id: "deepen" as const, label: "深入探索" as const, status: "upcoming" as const, percent: 0, detail: "继续陪伴或收束" }
      ]
    },
    recovery: { pendingTurn: null },
    journal: { status: "not_generated" as const, entryId: null, eventStatus: "active" as const }
  };
}

function request() {
  return new Request("http://localhost/api/interview/event-centered/session/respond/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "reply",
      rootSessionId: "root-1",
      clientTurnId: "client-1",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 1,
      rawText: "今天开会时我主动说明了延期风险。",
      inputMode: "text"
    })
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "user-1" });
});

describe("event-centered stream api", () => {
  it("按可靠顺序输出 turn、delta 和最新 session", async () => {
    mocks.respond.mockImplementation(async (
      _userId: string,
      _input: unknown,
      observer: {
        onTurn?: (turn: ReturnType<typeof acceptedTurn>) => void;
        onPhase?: (phase: string) => void;
        onDelta?: (target: "summary" | "response", value: string) => void;
      }
    ) => {
      observer.onTurn?.(acceptedTurn());
      observer.onPhase?.("understanding");
      observer.onDelta?.("summary", "你在会上主动说明了延期风险。");
      observer.onDelta?.("response", "核心经过已经记下来了。");
      observer.onPhase?.("complete");
      return { workspace: workspace(), assistantPayload: null };
    });

    const response = await POST(request());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: turn");
    expect(body).toContain('"target":"summary"');
    expect(body).toContain('"target":"response"');
    expect(body).toContain("event: session");
    expect(body.indexOf("event: turn")).toBeLessThan(body.indexOf("event: delta"));
    expect(body.indexOf("event: delta")).toBeLessThan(body.indexOf("event: session"));
    expect(body).not.toContain("generate_event_journal");
  });

  it("turn 已可靠接收后的错误输出结构化 issue 与 failed 状态", async () => {
    mocks.respond.mockImplementation(async (
      _userId: string,
      _input: unknown,
      observer: { onTurn?: (turn: ReturnType<typeof acceptedTurn>) => void }
    ) => {
      observer.onTurn?.(acceptedTurn());
      throw new Error("EVENT_STATE_CHANGED");
    });

    const response = await POST(request());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("event: turn");
    expect(body).toContain("event: error");
    expect(body).toContain('"code":"INTERVIEW_TURN_OUT_OF_DATE"');
    expect(body).toContain('"issue":{"code":"INTERVIEW_TURN_OUT_OF_DATE"');
    expect(body).toContain('"clientTurnId":"client-1"');
    expect(body).toContain('"turnId":"turn-1"');
    expect(body).toContain('"status":"failed"');
  });
});
