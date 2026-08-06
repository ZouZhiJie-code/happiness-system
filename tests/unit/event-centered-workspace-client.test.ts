import { describe, expect, it, vi } from "vitest";

import { respondInEventCenteredWorkspace } from "@/features/interview/event-centered/workspace-client";

const now = "2026-07-22T12:00:00.000Z";

function workspace() {
  return {
    mode: "event_centered",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    eventId: "event-1",
    branchStateId: "state-1",
    entryDate: "2026-07-22",
    conversationSchemaVersion: 3,
    sessionStatus: "active",
    eventStatus: "active",
    latestMessageSequence: 2,
    journalEvent: {
      id: "event-1",
      entryDate: "2026-07-22",
      daySequence: 1,
      status: "active",
      startedAt: now,
      generationStartedAt: null,
      completedAt: null,
      abandonedAt: null
    },
    messages: [],
    dialogue: {
      phase: "checkpoint_one",
      activeAngle: null,
      questionOpportunityCount: 0,
      completedAngles: [],
      availableAngles: ["feeling", "thought", "relationship", "action"],
      reopenedAngles: [],
      outcomes: [],
      checkpoint: { kind: "first", outcome: null },
      allowedActions: ["reply", "select_exploration_angle", "exit_event"],
      progress: []
    },
    recovery: { pendingTurn: null },
    journal: { status: "not_generated", entryId: null, eventStatus: "active" }
  } as const;
}

function responseFromSse(frames: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    }
  }), { headers: { "Content-Type": "text/event-stream" } });
}

describe("event-centered workspace stream client", () => {
  it("applies turn, delta and complete workspace in the server event order", async () => {
    const events: string[] = [];
    global.fetch = vi.fn(async () => responseFromSse([
      "event: turn\ndata: {\"kind\":\"reserved\",\"eventId\":\"event-1\",\"rootSessionId\":\"root-1\",\"activeBranchSessionId\":\"branch-1\",\"branchStateId\":\"state-1\",\"userMessageId\":\"message-1\",\"turn\":{\"id\":\"turn-1\",\"clientTurnId\":\"client-1\",\"sessionId\":\"branch-1\",\"rawText\":\"会议结束后终于松了一口气。\",\"inputMode\":\"text\",\"baseMessageSequence\":1,\"status\":\"processing\",\"createdAt\":\"2026-07-22T12:00:00.000Z\"}}\n\n",
      "event: phase\ndata: {\"state\":\"understanding\"}\n\n",
      "event: delta\ndata: {\"target\":\"summary\",\"value\":\"这件事的核心经过已经清楚。\"}\n\n",
      `event: session\ndata: ${JSON.stringify({ session: workspace() })}\n\n`
    ])) as typeof fetch;

    const result = await respondInEventCenteredWorkspace({
      request: {
        action: "reply",
        rootSessionId: "root-1",
        clientTurnId: "client-1",
        baseBranchSessionId: "branch-1",
        baseMessageSequence: 1,
        rawText: "会议结束后终于松了一口气。"
      },
      onTurn: () => events.push("turn"),
      onPhase: (phase) => events.push(phase),
      onDelta: ({ target }) => events.push(target),
      onSession: () => events.push("session")
    });

    expect(events).toEqual(["turn", "understanding", "summary", "session"]);
    expect(result.dialogue.checkpoint).toEqual({ kind: "first", outcome: null });
  });

  it("turns a stream issue into the shared user-facing error", async () => {
    global.fetch = vi.fn(async () => responseFromSse([
      "event: error\ndata: {\"code\":\"INTERVIEW_TURN_OUT_OF_DATE\",\"message\":\"当前对话已经更新\",\"issue\":{\"code\":\"INTERVIEW_TURN_OUT_OF_DATE\",\"title\":\"当前对话已经更新\",\"message\":\"这条回复对应的是较早的对话位置。\",\"resolution\":\"请刷新后继续。\",\"retryable\":true,\"action\":\"refresh\"}}\n\n"
    ])) as typeof fetch;

    await expect(respondInEventCenteredWorkspace({
      request: {
        action: "reply",
        rootSessionId: "root-1",
        clientTurnId: "client-1",
        baseBranchSessionId: "branch-1",
        baseMessageSequence: 1,
        rawText: "继续说说。"
      }
    })).rejects.toMatchObject({
      issue: { code: "INTERVIEW_TURN_OUT_OF_DATE", retryable: true }
    });
  });
});
