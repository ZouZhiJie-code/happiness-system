import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventCenteredInterviewWorkspace } from "@/components/interview/event-centered/event-centered-interview-workspace";
import { EventCenteredInterviewChromeProvider } from "@/components/interview/event-centered/event-centered-interview-chrome-context";
import { EventCenteredInterviewHeader } from "@/components/shared/site-header/event-centered-interview-header";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";
import type { EventCenteredSessionListView } from "@/types/event-centered-interview";

type RecordMode = "capture" | "chat";

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function sseResponse(events: Array<{ event: string; data: unknown }>) {
  return new Response(
    events.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(""),
    { status: 200, headers: { "Content-Type": "text/event-stream" } }
  );
}

function workspace(input: {
  recordMode: RecordMode;
  stage: "opening" | "replied" | "completed";
}): EventCenteredWorkspaceSession {
  const completed = input.stage === "completed";
  const hasReply = input.stage !== "opening";
  const userMessage = {
    id: "user-1",
    role: "user" as const,
    content: "会议结束后，我一下放松了。",
    rawText: "会议结束后，我一下放松了。",
    sequence: 2,
    userTurnId: "turn-reply-1",
    clientTurnId: "client-reply-1",
    generationTraceId: null,
    assistantPayload: null,
    responseVersion: null,
    createdAt: "2026-08-02T10:04:00.000Z"
  };
  const assistantMessage = {
    id: "assistant-2",
    role: "assistant" as const,
    content: input.recordMode === "capture" ? "好，这段已经记下了。" : "当时最让你放松的是什么？",
    rawText: "",
    sequence: 3,
    userTurnId: null,
    generationTraceId: input.recordMode === "chat" ? "trace-interview-1" : null,
    assistantPayload: {
      naturalUnderstanding: input.recordMode === "capture" ? "" : "我听见这口气终于松下来了。",
      naturalResponse: input.recordMode === "capture" ? "好，这段已经记下了。" : "当时最让你放松的是什么？",
      responseKind: "acknowledgement" as const,
      questionSpec: null,
      checkpoint: null,
      angleOutcome: null
    },
    responseVersion: null,
    createdAt: "2026-08-02T10:05:00.000Z"
  };

  return {
    mode: "event_centered",
    recordMode: input.recordMode,
    rootSessionId: `root-${input.recordMode}`,
    activeBranchSessionId: `branch-${input.recordMode}`,
    eventId: `event-${input.recordMode}`,
    branchStateId: `state-${input.recordMode}`,
    entryDate: "2026-08-02",
    conversationSchemaVersion: 4,
    sessionStatus: completed ? "completed" : "active",
    eventStatus: completed ? "completed" : "active",
    latestMessageSequence: hasReply ? 3 : 1,
    journalEvent: {
      id: `event-${input.recordMode}`,
      entryDate: "2026-08-02",
      daySequence: 1,
      status: completed ? "completed" : "active",
      startedAt: "2026-08-02T10:00:00.000Z",
      generationStartedAt: null,
      completedAt: completed ? "2026-08-02T10:06:00.000Z" : null,
      abandonedAt: null
    },
    messages: hasReply
      ? [userMessage, assistantMessage]
      : [{
          id: "opening-1",
          role: "assistant",
          content: "先说说你想记下的这件事。",
          rawText: "",
          sequence: 1,
          userTurnId: null,
          generationTraceId: null,
          assistantPayload: {
            naturalUnderstanding: "",
            naturalResponse: "先说说你想记下的这件事。",
            responseKind: "opening",
            questionSpec: null,
            checkpoint: null,
            angleOutcome: null
          },
          responseVersion: null,
          createdAt: "2026-08-02T10:00:00.000Z"
        }],
    dialogue: {
      phase: "event_recording",
      activeAngle: null,
      questionOpportunityCount: input.recordMode === "chat" && hasReply ? 1 : 0,
      focusOptions: [],
      completedAngles: [],
      availableAngles: ["feeling", "thought", "relationship", "action"],
      reopenedAngles: [],
      outcomes: [],
      checkpoint: null,
      allowedActions: completed ? [] : hasReply ? ["reply", "exit_event"] : ["reply"],
      progress: [
        { id: "record", label: "轻量记录", status: completed ? "complete" : "current", percent: completed ? 100 : 50, detail: "事件已经记下" },
        { id: "reflect", label: "引导复盘", status: "upcoming", percent: 0, detail: "等待开启" },
        { id: "deepen", label: "深入探索", status: "upcoming", percent: 0, detail: "按需要继续" }
      ]
    },
    recovery: { pendingTurn: null },
    journal: { status: "not_generated", entryId: null, eventStatus: completed ? "completed" : "active" }
  };
}

function sessionList(recordMode: RecordMode, completed = false): EventCenteredSessionListView {
  return {
    items: [{
      rootSessionId: `root-${recordMode}`,
      entryDate: "2026-08-02",
      recordMode,
      title: "会议后的松快",
      startedAt: "2026-08-02T10:00:00.000Z",
      lastActivityAt: "2026-08-02T10:06:00.000Z",
      lifecycle: completed ? "completed" : "unfinished",
      hasUserMessage: true,
      readOnly: completed
    }],
    unfinishedCount: completed ? 0 : 1,
    unfinishedLimit: 2,
    nextCursor: null
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/interview");
});

describe("Daily Light 两种记录模式自动化闭环", () => {
  it.each([
    ["capture", "帮我记"],
    ["chat", "陪我聊"]
  ] as const)("%s 从选择模式、可靠保存到完成记录并返回当天", async (recordMode, buttonName) => {
    const opening = workspace({ recordMode, stage: "opening" });
    const replied = workspace({ recordMode, stage: "replied" });
    const completed = workspace({ recordMode, stage: "completed" });
    const requests: Array<{ url: string; body: Record<string, unknown> | null }> = [];
    let currentList = sessionList(recordMode);

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
      requests.push({ url, body });
      if (url === "/api/interview/event-centered/sessions?limit=30") return jsonResponse(currentList);
      if (url === "/api/interview/event-centered/session/start") return jsonResponse(opening);
      if (url === "/api/interview/event-centered/session/respond/stream") {
        if (body?.action === "reply") {
          return sseResponse([
            {
              event: "turn",
              data: {
                id: "turn-reply-1",
                clientTurnId: body.clientTurnId,
                sessionId: `root-${recordMode}`,
                rawText: body.rawText,
                inputMode: "text",
                baseMessageSequence: 1,
                status: "processing",
                createdAt: "2026-08-02T10:04:00.000Z"
              }
            },
            { event: "session", data: { session: replied } }
          ]);
        }
        currentList = sessionList(recordMode, true);
        return sseResponse([
          {
            event: "turn",
            data: {
              id: "turn-exit-1",
              clientTurnId: body?.clientTurnId,
              sessionId: `root-${recordMode}`,
              rawText: "",
              inputMode: "text",
              baseMessageSequence: 3,
              status: "processing",
              createdAt: "2026-08-02T10:06:00.000Z"
            }
          },
          { event: "session", data: { session: completed } }
        ]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(
      <EventCenteredInterviewChromeProvider>
        <EventCenteredInterviewHeader />
        <EventCenteredInterviewWorkspace entryDate="2026-08-02" />
      </EventCenteredInterviewChromeProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(buttonName, "u") }));
    await waitFor(() => expect(screen.queryByTestId("event-centered-start-workspace")).not.toBeInTheDocument());
    const composer = screen.getByLabelText("输入当前事件");
    await waitFor(() => expect(
      requests.filter((request) => request.url === "/api/interview/event-centered/sessions?limit=30").length
    ).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(composer).toBeEnabled());
    fireEvent.change(composer, { target: { value: "会议结束后，我一下放松了。" } });
    await waitFor(() => expect(composer).toHaveValue("会议结束后，我一下放松了。"));
    const send = screen.getByRole("button", { name: "发送" });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    await waitFor(() => expect(requests.some((request) => request.body?.action === "reply")).toBe(true));
    expect(screen.getAllByText("会议结束后，我一下放松了。")).toHaveLength(1);
    if (recordMode === "capture") {
      expect(screen.getByTestId("event-centered-record-save-context")).toHaveTextContent("原话已保存");
      expect(screen.getByText("好，这段已经记下了。")).toBeVisible();
      expect(screen.queryByText("当时最让你放松的是什么？")).not.toBeInTheDocument();
    } else {
      expect(screen.getByText("我听见这口气终于松下来了。")).toBeVisible();
      expect(screen.getByText("当时最让你放松的是什么？")).toBeVisible();
    }

    fireEvent.click(await screen.findByRole("button", { name: "完成记录" }));
    await waitFor(() => expect(requests.some((request) => request.body?.action === "exit_event")).toBe(true));
    expect(await screen.findByTestId("event-centered-completion-inline")).toHaveTextContent("已记下");
    expect(screen.getByRole("link", { name: /查看.*日记/u })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-08-02"
    );
    expect(requests.find((request) => request.url === "/api/interview/event-centered/session/start")?.body).toMatchObject({
      entryDate: "2026-08-02",
      recordMode,
      clientOperationId: expect.any(String)
    });
  });
});
