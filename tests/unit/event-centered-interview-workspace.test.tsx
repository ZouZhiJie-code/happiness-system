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
    journal: { status: "not_generated", entryId: null, eventStatus: "active" },
    ...overrides
  };
}

function eventSessionTabs(status: "active" | "completed" | "abandoned" = "active") {
  return [{
    rootSessionId: "root-1",
    label: "会议之后",
    status
  }];
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

  it("首次打开保留完整对话画布，深链分别说明准备与恢复", () => {
    global.fetch = vi.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;

    const opened = render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);
    expect(screen.getByTestId("event-centered-start-workspace")).toBeVisible();
    expect(screen.getByText("7 月 22 日想怎么记？")).toBeVisible();
    expect(screen.getByPlaceholderText("先选择一种记录方式")).toBeDisabled();
    opened.unmount();

    const prepared = render(
      <EventCenteredInterviewWorkspace entryDate="2026-07-22" initialRecordMode="chat" />
    );
    expect(screen.getByRole("status")).toHaveTextContent("正在准备新的记录…");
    prepared.unmount();

    render(
      <EventCenteredInterviewWorkspace entryDate="2026-07-22" initialSessionId="root-1" />
    );
    expect(screen.getByRole("status")).toHaveTextContent("正在恢复这件事…");
  });

  it("没有会话时停留在当天工作台，选择方式后才创建记录", async () => {
    const startRequests: string[] = [];
    let resolveStart!: (response: Response) => void;
    const pendingStart = new Promise<Response>((resolve) => {
      resolveStart = resolve;
    });
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-07-22") {
        return jsonResponse([]);
      }
      if (url === "/api/interview/event-centered/session/start") {
        startRequests.push(url);
        return pendingStart;
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);

    expect(await screen.findByTestId("event-centered-start-workspace")).toBeVisible();
    expect(startRequests).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /帮我记/u }));
    await waitFor(() => expect(startRequests).toHaveLength(1));
    expect(screen.getByRole("button", { name: /帮我记.*正在准备…/u })).toHaveAttribute("aria-busy", "true");
    resolveStart(jsonResponse(buildWorkspace({ recordMode: "capture" })));
    await waitFor(() => expect(screen.queryByTestId("event-centered-start-workspace")).not.toBeInTheDocument());
    expect(screen.queryByTestId("event-centered-start-workspace")).not.toBeInTheDocument();
  });

  it("把 A 方案的对话内纸笺接入统一流式写入，并在可靠完成后清空草稿", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    let resolveRespond!: (response: Response) => void;
    const pendingRespond = new Promise<Response>((resolve) => {
      resolveRespond = resolve;
    });
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
          clientTurnId: "turn-client-1",
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
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-07-22") return jsonResponse(eventSessionTabs());
      if (url === "/api/interview/event-centered/session/respond/stream") {
        return pendingRespond;
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialRecordMode="chat" />);

    expect(await screen.findByRole("tab", { name: /会议之后/u })).toBeVisible();
    expect(screen.getByTestId("event-centered-workspace-layout")).toHaveClass(
      "h-[calc(100dvh-var(--site-header-viewport-offset))]"
    );
    const input = screen.getByLabelText("输入当前事件");
    fireEvent.change(input, {
      target: { value: "会议结束后终于松了一口气。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByTestId("event-centered-optimistic-user-message")).toHaveTextContent(
      "会议结束后终于松了一口气。"
    );
    expect(input).toHaveValue("");

    resolveRespond(sseResponse([
          { event: "phase", data: { state: "understanding" } },
          { event: "delta", data: { target: "summary", value: "我先把这个时刻放好。" } },
          { event: "session", data: { session: afterReply } }
        ]));

    expect(await screen.findByTestId("event-centered-first-checkpoint")).toHaveTextContent(
      "我先把这件事和你在意的部分记住了。选一个角度开始。"
    );
    expect(screen.queryByLabelText("输入当前事件")).not.toBeInTheDocument();
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
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-07-22") return jsonResponse(eventSessionTabs());
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

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialRecordMode="chat" />);
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
          clientTurnId: "turn-recover-1",
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
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-07-22") return jsonResponse(eventSessionTabs());
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(recovered);
      if (url === "/api/interview/event-centered/session/respond/stream") {
        respondCount += 1;
        return respondCount === 1
          ? sseResponse([
              { event: "turn", data: acceptedTurn },
              { event: "error", data: { code: "AI_RETRYABLE", issue: { code: "AI_RETRYABLE", title: "保存本轮回复失败", message: "原话已保留。" } } }
            ])
          : sseResponse([{ event: "session", data: { session: afterResume } }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialRecordMode="chat" />);
    const input = await screen.findByLabelText("输入当前事件");
    fireEvent.change(input, { target: { value: acceptedTurn.turn.rawText } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("这段话已保存，回复还没完成")).toBeVisible();
    expect(screen.queryByText("保存本轮回复失败")).not.toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(input).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "继续生成" }));
    await waitFor(() => expect(respondCount).toBe(2));
    const resumeRequest = requests.filter((request) => request.url === "/api/interview/event-centered/session/respond/stream").at(-1);
    expect(JSON.parse(String(resumeRequest?.init?.body))).toMatchObject({
      action: "resume_turn",
      clientTurnId: "turn-recover-1"
    });
  });

  it("自然语言提出整理需求时先按当前片段回应，日报承接后续生成", async () => {
    const initial = buildWorkspace({
      dialogue: {
        ...buildWorkspace().dialogue,
        phase: "guided_reflection",
        activeAngle: "thought",
        allowedActions: ["reply", "exit_event"]
      }
    });
    const afterReply = buildWorkspace({ latestMessageSequence: 3 });
    const requests: string[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url === "/api/interview/event-centered/session/start") return jsonResponse(initial);
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-07-22") return jsonResponse(eventSessionTabs());
      if (url === "/api/interview/event-centered/session/respond/stream") {
        return sseResponse([{ event: "session", data: { session: afterReply } }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialRecordMode="chat" />);
    const input = await screen.findByLabelText("输入当前事件");
    fireEvent.change(input, { target: { value: "整理成日志" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(requests).toContain("/api/interview/event-centered/session/respond/stream"));
    expect(requests).not.toContain("/api/interview/event-centered/journal/generate");
  });

  it("旧日志恢复链接回到当天片段，并保留日报出口", async () => {
    const initial = buildWorkspace();
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(initial);
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-07-22") return jsonResponse(eventSessionTabs());
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

    expect(await screen.findByRole("complementary", { name: "当天片段" })).toBeVisible();
    expect(screen.getByLabelText("输入当前事件")).toBeDisabled();
    expect(screen.getByRole("button", { name: "再记一件" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "暂存当前片段" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看 7 月 22 日 日记" })).toHaveAttribute("href", "/calendar?view=day&date=2026-07-22");
  });

  it("刷新历史整理状态时保留当天片段，不重启旧事件日志生成", async () => {
    const generating = buildWorkspace({
      eventStatus: "generating",
      journal: { status: "generating", entryId: null, eventStatus: "generating" },
      dialogue: {
        ...buildWorkspace().dialogue,
        phase: "checkpoint_one",
        checkpoint: { kind: "first", outcome: "这件事已经记下。" },
        allowedActions: []
      }
    });
    const requests: string[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(generating);
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-07-22") return jsonResponse(eventSessionTabs());
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(
      <EventCenteredInterviewWorkspace
        entryDate="2026-07-22"
        initialSessionId="root-1"
      />
    );

    expect(await screen.findByRole("link", { name: "查看 7 月 22 日 日记" })).toBeVisible();
    expect(requests).not.toContain("/api/interview/event-centered/journal/generate");
  });

  it("再记一件时先重新选择方式，创建后立即把地址切到新事件", async () => {
    const completed = buildWorkspace({
      rootSessionId: "root-1",
      sessionStatus: "completed",
      eventStatus: "completed",
      dialogue: {
        ...buildWorkspace().dialogue,
        allowedActions: []
      },
      journal: { status: "saved", entryId: "entry-1", eventStatus: "completed" }
    });
    const next = buildWorkspace({
      rootSessionId: "root-2",
      activeBranchSessionId: "branch-2",
      eventId: "event-2",
      eventStatus: "active",
      sessionStatus: "active",
      journal: { status: "not_generated", entryId: null, eventStatus: "active" }
    });
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(completed);
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-07-22") return jsonResponse(eventSessionTabs("completed"));
      if (url === "/api/interview/event-centered/session/start") return jsonResponse(next);
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(
      <EventCenteredInterviewWorkspace
        entryDate="2026-07-22"
        initialSessionId="root-1"
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "再记一件" }));
    expect(await screen.findByTestId("event-centered-start-workspace")).toBeVisible();
    expect(window.location.search).not.toContain("sessionId=root-1");
    fireEvent.click(screen.getByRole("button", { name: /陪我聊.*从一件事聊开/u }));
    await waitFor(() => {
      expect(window.location.search).toContain("sessionId=root-2");
      expect(window.location.search).not.toContain("eventEntryId=entry-1");
    });
  });

  it("退出记录继续出现在当天标签中，新事件使用独立会话", async () => {
    const abandoned = buildWorkspace({
      sessionStatus: "abandoned",
      eventStatus: "abandoned",
      journalEvent: {
        ...buildWorkspace().journalEvent!,
        status: "abandoned",
        abandonedAt: "2026-07-22T09:00:00.000Z"
      },
      dialogue: {
        ...buildWorkspace().dialogue,
        allowedActions: []
      },
      journal: { status: "not_generated", entryId: null, eventStatus: "abandoned" }
    });
    const next = buildWorkspace({
      rootSessionId: "root-2",
      activeBranchSessionId: "branch-2",
      eventId: "event-2",
      branchStateId: "state-2"
    });
    let nextCreated = false;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(abandoned);
      if (url === "/api/interview/event-centered/session/root-2") return jsonResponse(next);
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-07-22") {
        return jsonResponse(nextCreated
          ? [
              { rootSessionId: "root-1", label: "已退出的旧事件", status: "abandoned" },
              { rootSessionId: "root-2", label: "事件 2", status: "active" }
            ]
          : [{ rootSessionId: "root-1", label: "已退出的旧事件", status: "abandoned" }]);
      }
      if (url === "/api/interview/event-centered/session/start") {
        nextCreated = true;
        return jsonResponse(next);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(
      <EventCenteredInterviewWorkspace
        entryDate="2026-07-22"
        initialSessionId="root-1"
      />
    );

    expect(await screen.findByRole("tab", { name: /已退出的旧事件.*已退出/u })).toBeVisible();
    expect(screen.getByLabelText("输入当前事件")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "再记一件" }));
    expect(await screen.findByTestId("event-centered-start-workspace")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /帮我记.*说下来，我帮你整理/u }));

    await waitFor(() => expect(window.location.search).toContain("sessionId=root-2"));
    expect(await screen.findByRole("tab", { name: /已退出的旧事件.*已退出/u })).toBeVisible();
    expect(screen.getByRole("tab", { name: /事件 2.*进行中/u })).toBeVisible();
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
