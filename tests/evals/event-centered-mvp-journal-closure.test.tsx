import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventCenteredInterviewWorkspace } from "@/components/interview/event-centered/event-centered-interview-workspace";
import { EventCenteredInterviewChromeProvider } from "@/components/interview/event-centered/event-centered-interview-chrome-context";
import { EventCenteredInterviewHeader } from "@/components/shared/site-header/event-centered-interview-header";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function sseResponse(session: EventCenteredWorkspaceSession) {
  return new Response(`event: session\ndata: ${JSON.stringify({ session })}\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
}

function workspace(completed = false): EventCenteredWorkspaceSession {
  return {
    mode: "event_centered",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    eventId: "event-1",
    branchStateId: "state-event-1",
    entryDate: "2026-08-02",
    conversationSchemaVersion: 3,
    sessionStatus: completed ? "completed" : "active",
    eventStatus: completed ? "completed" : "active",
    latestMessageSequence: 6,
    journalEvent: {
      id: "event-1",
      entryDate: "2026-08-02",
      daySequence: 1,
      status: completed ? "completed" : "active",
      startedAt: "2026-08-02T10:00:00.000Z",
      generationStartedAt: null,
      completedAt: completed ? "2026-08-02T10:06:00.000Z" : null,
      abandonedAt: null
    },
    messages: [{
      id: "user-1",
      role: "user",
      content: "会议结束后，我一下放松了。",
      rawText: "会议结束后，我一下放松了。",
      sequence: 5,
      userTurnId: "turn-1",
      generationTraceId: null,
      assistantPayload: null,
      responseVersion: null,
      createdAt: "2026-08-02T10:04:00.000Z"
    }, {
      id: "assistant-1",
      role: "assistant",
      content: "这一段已经先收住了。",
      rawText: "",
      sequence: 6,
      userTurnId: null,
      generationTraceId: "trace-interview-1",
      assistantPayload: {
        naturalUnderstanding: "汇报完成和走出会议室共同构成了这个变化时刻。",
        naturalResponse: "这一段已经先收住了。",
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "second", outcome: "任务结束后，一直绷着的部分终于放了下来。" },
        angleOutcome: null
      },
      responseVersion: null,
      createdAt: "2026-08-02T10:05:00.000Z"
    }],
    dialogue: {
      phase: "checkpoint_two",
      activeAngle: null,
      questionOpportunityCount: 0,
      focusOptions: [],
      completedAngles: [],
      availableAngles: ["feeling", "thought", "relationship", "action"],
      reopenedAngles: [],
      outcomes: [],
      checkpoint: { kind: "second", outcome: "任务结束后，一直绷着的部分终于放了下来。" },
      allowedActions: completed ? [] : ["reply", "exit_event"],
      progress: [
        { id: "record", label: "轻量记录", status: "complete", percent: 100, detail: "事件已经记下" },
        { id: "reflect", label: "引导复盘", status: "complete", percent: 100, detail: "已完成一个角度" },
        { id: "deepen", label: "深入探索", status: "current", percent: 0, detail: "按需要继续" }
      ]
    },
    recovery: { pendingTurn: null },
    journal: { status: "not_generated", entryId: null, eventStatus: completed ? "completed" : "active" }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("Daily Light 事件卡片闭环", () => {
  it("完成记录后回到当天日记，事件日志生成留在日记链路", async () => {
    const active = workspace();
    const completed = workspace(true);
    const requests: Array<{ url: string; body: unknown }> = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url === "/api/interview/event-centered/session/start") return jsonResponse(active);
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-08-02") {
        return jsonResponse([{ rootSessionId: "root-1", label: "会议后的松快", status: "active" }]);
      }
      if (url === "/api/interview/event-centered/session/respond/stream") return sseResponse(completed);
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(
      <EventCenteredInterviewChromeProvider>
        <EventCenteredInterviewHeader />
        <EventCenteredInterviewWorkspace entryDate="2026-08-02" initialRecordMode="chat" />
      </EventCenteredInterviewChromeProvider>
    );
    expect(await screen.findByTestId("event-centered-second-checkpoint")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "完成记录" }));

    await waitFor(() => {
      const request = requests.find((item) => item.url === "/api/interview/event-centered/session/respond/stream");
      expect(request?.body).toMatchObject({ action: "exit_event", rootSessionId: "root-1" });
    });
    expect(screen.getByRole("link", { name: /查看.*日记/u })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-08-02"
    );
    expect(requests.map((item) => item.url)).not.toContain("/api/interview/event-centered/journal/generate");
  });
});
