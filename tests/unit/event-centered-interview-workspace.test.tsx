import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  buildEventCenteredWorkspaceHref,
  EventCenteredInterviewWorkspace
} from "@/components/interview/event-centered/event-centered-interview-workspace";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";

function buildWorkspace(overrides: Partial<EventCenteredWorkspaceSession> = {}): EventCenteredWorkspaceSession {
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
      startedAt: "2026-07-22T08:00:00.000Z",
      generationStartedAt: null,
      completedAt: null,
      abandonedAt: null
    },
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        content: "刚刚发生了什么？",
        rawText: "",
        sequence: 2,
        userTurnId: null,
        assistantPayload: {
          naturalUnderstanding: "我会先贴着这件事来听。",
          naturalResponse: "刚刚发生了什么？",
          responseKind: "question",
          questionSpec: {
            phase: "event_recording",
            angle: null,
            target: "事件锚点",
            opportunityNumber: 1,
            surfaceLevel: "open_anchor",
            anchorText: null,
            repairCount: 0
          },
          checkpoint: null,
          angleOutcome: null
        },
        responseVersion: null,
        createdAt: "2026-07-22T08:00:00.000Z"
      }
    ],
    dialogue: {
      phase: "event_recording",
      activeAngle: null,
      questionOpportunityCount: 1,
      focusOptions: [],
      completedAngles: [],
      availableAngles: ["feeling", "thought", "relationship", "action"],
      reopenedAngles: [],
      outcomes: [],
      checkpoint: null,
      allowedActions: ["reply", "correct_understanding", "exit_event"],
      progress: [
        { id: "record", label: "轻量记录", status: "current", percent: 50, detail: "正在记录" },
        { id: "reflect", label: "引导复盘", status: "upcoming", percent: 0, detail: "等待开启" },
        { id: "deepen", label: "深入探索", status: "upcoming", percent: 0, detail: "按需要继续" }
      ]
    },
    recovery: { pendingTurn: null },
    journal: {
      status: "not_generated",
      entryId: null,
      generationId: null,
      errorCode: null,
      retryable: false,
      eventStatus: "active"
    },
    ...overrides
  };
}

function eventCalendarDay() {
  return {
    date: "2026-07-22",
    overallStatus: "mixed",
    events: [{
      eventId: "event-1",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-1",
      entryDate: "2026-07-22",
      daySequence: 1,
      eventStatus: "active",
      entryId: null,
      entryStatus: null,
      state: "active",
      title: "会议之后",
      summary: null,
      latestUpdatedAt: "2026-07-22T08:01:00.000Z",
      actions: ["continue_event"]
    }]
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function sseResponse(events: Array<{ event: string; data: unknown }>) {
  const body = events.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
}

describe("EventCenteredInterviewWorkspace", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/interview");
    window.sessionStorage.clear();
  });

  it("把 A 方案的对话内纸笺接入统一流式写入，并在可靠完成后清空草稿", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const initial = buildWorkspace();
    const afterReply = buildWorkspace({
      latestMessageSequence: 4,
      messages: [
        ...initial.messages,
        {
          id: "user-1",
          role: "user",
          content: "会议结束后终于松了一口气。",
          rawText: "会议结束后终于松了一口气。",
          sequence: 3,
          userTurnId: "turn-1",
          assistantPayload: null,
          responseVersion: null,
          createdAt: "2026-07-22T08:01:00.000Z"
        }
      ],
      dialogue: {
        ...initial.dialogue,
        phase: "checkpoint_one",
        checkpoint: { kind: "first", outcome: "这件事的轮廓已经清楚。" },
        allowedActions: ["select_exploration_angle", "exit_event"],
        progress: [
          { id: "record", label: "轻量记录", status: "complete", percent: 100, detail: "已放好这件事" },
          { id: "reflect", label: "引导复盘", status: "current", percent: 0, detail: "选择一个方向" },
          { id: "deepen", label: "深入探索", status: "upcoming", percent: 0, detail: "按需要继续" }
        ]
      }
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url === "/api/interview/event-centered/session/start") return jsonResponse(initial);
      if (url === "/api/event-calendar/day?date=2026-07-22") return jsonResponse(eventCalendarDay());
      if (url === "/api/interview/event-centered/session/respond/stream") {
        return sseResponse([
          { event: "phase", data: { state: "understanding" } },
          { event: "delta", data: { target: "summary", value: "我先把这个时刻放好。" } },
          { event: "session", data: { session: afterReply } }
        ]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);

    expect(await screen.findByRole("tab", { name: /会议之后/u })).toBeVisible();
    fireEvent.change(screen.getByLabelText("输入当前事件"), {
      target: { value: "会议结束后终于松了一口气。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByTestId("event-centered-first-checkpoint")).toHaveTextContent("先把这件事放好");
    await waitFor(() => expect(screen.getByLabelText("输入当前事件")).toHaveValue(""));
    const writeRequest = requests.find((request) => request.url === "/api/interview/event-centered/session/respond/stream");
    expect(JSON.parse(String(writeRequest?.init?.body))).toMatchObject({
      action: "reply",
      rootSessionId: "root-1",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 2,
      rawText: "会议结束后终于松了一口气。"
    });
  });

  it("流式失败时显示可理解的原因，并保留用户还未完成发送的文字", async () => {
    const initial = buildWorkspace();
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/start") return jsonResponse(initial);
      if (url === "/api/event-calendar/day?date=2026-07-22") return jsonResponse(eventCalendarDay());
      if (url === "/api/interview/event-centered/session/respond/stream") {
        return sseResponse([{
          event: "error",
          data: {
            code: "AI_RETRYABLE",
            issue: { code: "AI_RETRYABLE", title: "整理暂时中断", message: "原话已保留，可以继续生成。" }
          }
        }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);
    const input = await screen.findByLabelText("输入当前事件");
    fireEvent.change(input, { target: { value: "我想先把这件事记下来" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("整理暂时中断");
    expect(input).toHaveValue("我想先把这件事记下来");
  });

  it("服务端已接收后发生流式中断时，恢复同一轮并提供继续生成", async () => {
    const initial = buildWorkspace();
    const acceptedTurn = {
      kind: "reserved",
      eventId: "event-1",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-1",
      branchStateId: "state-1",
      userMessageId: "user-1",
      turn: {
        id: "turn-1",
        clientTurnId: "turn-recover-1",
        sessionId: "branch-1",
        rawText: "会议结束后终于松了一口气。",
        inputMode: "text" as const,
        baseMessageSequence: 2,
        status: "processing",
        createdAt: "2026-07-22T08:01:00.000Z"
      }
    };
    const recovered = buildWorkspace({
      latestMessageSequence: 3,
      messages: [
        ...initial.messages,
        {
          id: "user-1",
          role: "user",
          content: acceptedTurn.turn.rawText,
          rawText: acceptedTurn.turn.rawText,
          sequence: 3,
          userTurnId: "turn-1",
          assistantPayload: null,
          responseVersion: null,
          createdAt: acceptedTurn.turn.createdAt
        }
      ],
      recovery: {
        pendingTurn: {
          ...acceptedTurn.turn,
          status: "failed",
          errorCode: "AI_RETRYABLE",
          attemptCount: 1
        }
      },
      dialogue: {
        ...initial.dialogue,
        allowedActions: ["resume_turn", "exit_event"]
      }
    });
    const afterResume = buildWorkspace({ latestMessageSequence: 4 });
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    let respondCount = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url === "/api/interview/event-centered/session/start") return jsonResponse(initial);
      if (url === "/api/event-calendar/day?date=2026-07-22") return jsonResponse(eventCalendarDay());
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(recovered);
      if (url === "/api/interview/event-centered/session/respond/stream") {
        respondCount += 1;
        return respondCount === 1
          ? sseResponse([
              { event: "turn", data: acceptedTurn },
              { event: "error", data: { code: "AI_RETRYABLE", issue: { code: "AI_RETRYABLE", title: "整理暂时中断", message: "原话已保留。" } } }
            ])
          : sseResponse([{ event: "session", data: { session: afterResume } }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);
    const input = await screen.findByLabelText("输入当前事件");
    fireEvent.change(input, { target: { value: acceptedTurn.turn.rawText } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("这段话已经收到")).toBeVisible();
    expect(input).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "继续生成" }));
    await waitFor(() => expect(respondCount).toBe(2));
    const resumeRequest = requests.filter((request) => request.url === "/api/interview/event-centered/session/respond/stream").at(-1);
    expect(JSON.parse(String(resumeRequest?.init?.body))).toMatchObject({
      action: "resume_turn",
      clientTurnId: "turn-recover-1"
    });
  });

  it("恢复链接可直接打开事件日志，历史查看会关闭一切写入动作", async () => {
    const initial = buildWorkspace();
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(initial);
      if (url === "/api/event-calendar/day?date=2026-07-22") return jsonResponse(eventCalendarDay());
      if (url === "/api/event-journal/entry-1") {
        return jsonResponse({
          entry: {
            id: "entry-1",
            eventId: "event-1",
            title: "会议之后",
            content: "会议结束后，我终于松了一口气。",
            status: "saved",
            contentRevision: 1,
            savedRevision: 1,
            updatedAt: "2026-07-22T09:00:00.000Z",
            savedAt: "2026-07-22T09:00:00.000Z"
          }
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(
      <EventCenteredInterviewWorkspace
        entryDate="2026-07-22"
        initialSessionId="root-1"
        initialJournalPanelOpen
        initialEventEntryId="entry-1"
        writeEnabled={false}
      />
    );

    expect(await screen.findByDisplayValue("会议结束后，我终于松了一口气。")).toBeVisible();
    expect(screen.getByRole("complementary", { name: "当前事件日志" })).toHaveTextContent("已保存");
    expect(screen.getByLabelText("输入当前事件")).toBeDisabled();
    expect(screen.getByRole("button", { name: "记下一件事" })).toBeDisabled();
    expect(screen.getByText("只读查看")).toBeVisible();
    await waitFor(() => {
      expect(window.location.search).toContain("panel=journal");
      expect(window.location.search).toContain("eventEntryId=entry-1");
    });
  });

  it("构造稳定的访谈与日志恢复链接", () => {
    expect(buildEventCenteredWorkspaceHref({
      entryDate: "2026-07-22",
      sessionId: "root-1"
    })).toBe("/interview?mode=event-centered&sessionId=root-1&entryDate=2026-07-22");
    expect(buildEventCenteredWorkspaceHref({
      entryDate: "2026-07-22",
      sessionId: "root-1",
      panel: "journal",
      eventEntryId: "entry-1"
    })).toBe("/interview?mode=event-centered&sessionId=root-1&entryDate=2026-07-22&panel=journal&eventEntryId=entry-1");
  });
});
