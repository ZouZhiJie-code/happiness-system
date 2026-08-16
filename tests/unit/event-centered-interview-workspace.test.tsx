import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  buildEventCenteredWorkspaceHref,
  EventCenteredInterviewWorkspace
} from "@/components/interview/event-centered/event-centered-interview-workspace";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";
import type {
  EventCenteredSessionListItem,
  EventCenteredSessionListView
} from "@/types/event-centered-interview";

function buildWorkspace(overrides: Partial<EventCenteredWorkspaceSession> = {}): EventCenteredWorkspaceSession {
  return {
    mode: "event_centered",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    eventId: "event-1",
    branchStateId: "state-1",
    entryDate: "2026-07-22",
    recordMode: "chat",
    conversationSchemaVersion: 4,
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
    messages: [{
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
    }],
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

function buildListItem(overrides: Partial<EventCenteredSessionListItem> = {}): EventCenteredSessionListItem {
  return {
    rootSessionId: "root-1",
    entryDate: "2026-07-22",
    recordMode: "chat",
    title: "会议之后",
    startedAt: "2026-07-22T08:00:00.000Z",
    lastActivityAt: "2026-07-22T08:10:00.000Z",
    lifecycle: "unfinished",
    hasUserMessage: true,
    readOnly: false,
    ...overrides
  };
}

function buildSessionList(
  items: EventCenteredSessionListItem[] = [],
  unfinishedCount = items.filter((item) => item.lifecycle === "unfinished" || item.lifecycle === "blank").length
): EventCenteredSessionListView {
  return { items, unfinishedCount, unfinishedLimit: 2, nextCursor: null };
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
    window.localStorage.clear();
  });

  it("renders record mode selection inside the shared conversation frame", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/interview/event-centered/sessions?limit=30") {
        return jsonResponse(buildSessionList());
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);

    expect(await screen.findByRole("complementary", { name: "记录列表" })).toBeVisible();
    expect(screen.getByTestId("event-centered-start-workspace")).toBeVisible();
    expect(screen.getByText("7 月 22 日想怎么记？")).toBeVisible();
    expect(screen.getByPlaceholderText("先选择一种记录方式")).toBeDisabled();
  });

  it("creates a selected record once and enters the conversation directly", async () => {
    const workspace = buildWorkspace({ recordMode: "capture" });
    const requests: Array<{ url: string; body: unknown }> = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/sessions?limit=30") {
        return jsonResponse(buildSessionList([buildListItem({ recordMode: "capture" })]));
      }
      if (url === "/api/interview/event-centered/session/start") {
        requests.push({ url, body: JSON.parse(String(init?.body)) });
        return jsonResponse(workspace);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);
    fireEvent.click(await screen.findByRole("button", { name: /帮我记.*你来说，我在听/u }));

    await waitFor(() => expect(screen.queryByTestId("event-centered-start-workspace")).not.toBeInTheDocument());
    expect(screen.getByLabelText("输入当前事件")).toBeEnabled();
    expect(screen.getByText("帮我记")).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toMatchObject({
      entryDate: "2026-07-22",
      recordMode: "capture",
      clientOperationId: expect.any(String)
    });
    expect(window.location.search).toContain("sessionId=root-1");
  });

  it("keeps the page position when the floating composer receives focus", async () => {
    const workspace = buildWorkspace({ recordMode: "capture" });
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(workspace);
      if (url === "/api/interview/event-centered/sessions?limit=30") {
        return jsonResponse(buildSessionList([buildListItem({ recordMode: "capture" })]));
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 53 });

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialSessionId="root-1" />);
    fireEvent.focus(await screen.findByLabelText("输入当前事件"));

    expect(scrollTo).not.toHaveBeenCalled();
    expect(window.scrollY).toBe(53);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    scrollTo.mockRestore();
  });

  it("lists cross-date sessions and opens the selected conversation", async () => {
    const first = buildWorkspace();
    const second = buildWorkspace({
      rootSessionId: "root-2",
      activeBranchSessionId: "branch-2",
      eventId: "event-2",
      branchStateId: "state-2",
      entryDate: "2026-07-21",
      journalEvent: {
        ...buildWorkspace().journalEvent!,
        id: "event-2",
        entryDate: "2026-07-21",
        daySequence: 1
      }
    });
    const list = buildSessionList([
      buildListItem(),
      buildListItem({
        rootSessionId: "root-2",
        entryDate: "2026-07-21",
        title: "下班路上",
        lastActivityAt: "2026-07-21T10:00:00.000Z"
      })
    ], 2);
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(first);
      if (url === "/api/interview/event-centered/session/root-2") return jsonResponse(second);
      if (url === "/api/interview/event-centered/sessions?limit=30") return jsonResponse(list);
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialSessionId="root-1" />);
    const secondOption = await screen.findByRole("option", { name: /下班路上/u });
    fireEvent.click(secondOption);

    expect(await screen.findByRole("heading", { name: "下班路上" })).toBeVisible();
    expect(window.location.search).toContain("sessionId=root-2");
    expect(window.location.search).toContain("entryDate=2026-07-21");
  });

  it("keeps an optimistic user bubble until the reliable response completes", async () => {
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
      ]
    });
    let resolveRespond!: (response: Response) => void;
    const pendingRespond = new Promise<Response>((resolve) => { resolveRespond = resolve; });
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(initial);
      if (url === "/api/interview/event-centered/sessions?limit=30") {
        return jsonResponse(buildSessionList([buildListItem()]));
      }
      if (url === "/api/interview/event-centered/session/respond/stream") return pendingRespond;
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialSessionId="root-1" />);
    const input = await screen.findByLabelText("输入当前事件");
    fireEvent.change(input, { target: { value: "会议结束后终于松了一口气。" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(await screen.findByTestId("event-centered-optimistic-user-message")).toHaveTextContent(
      "会议结束后终于松了一口气。"
    );

    resolveRespond(sseResponse([{ event: "session", data: { session: afterReply } }]));
    await waitFor(() => expect(screen.queryByTestId("event-centered-optimistic-user-message")).not.toBeInTheDocument());
  });

  it("resumes a saved turn after refresh with the same client turn id and no duplicate user bubble", async () => {
    const userMessage = {
      id: "user-pending",
      role: "user" as const,
      content: "会议结束后终于松了一口气。",
      rawText: "会议结束后终于松了一口气。",
      sequence: 3,
      userTurnId: "turn-pending",
      clientTurnId: "client-turn-pending",
      assistantPayload: null,
      responseVersion: null,
      createdAt: "2026-07-22T08:01:00.000Z"
    };
    const pendingWorkspace = buildWorkspace({
      latestMessageSequence: 3,
      messages: [...buildWorkspace().messages, userMessage],
      dialogue: { ...buildWorkspace().dialogue, allowedActions: ["resume_turn"] },
      recovery: {
        pendingTurn: {
          id: "turn-pending",
          clientTurnId: "client-turn-pending",
          sessionId: "root-1",
          rawText: userMessage.rawText,
          inputMode: "text",
          baseMessageSequence: 2,
          status: "failed",
          createdAt: "2026-07-22T08:01:00.000Z",
          errorCode: "EVENT_CENTERED_TRANSIENT_PROVIDER_FAILURE",
          attemptCount: 1
        }
      }
    });
    const recoveredWorkspace = buildWorkspace({
      latestMessageSequence: 4,
      messages: [
        ...pendingWorkspace.messages,
        {
          ...buildWorkspace().messages[0],
          id: "assistant-recovered",
          sequence: 4,
          content: "我听见这口气终于松下来了。",
          assistantPayload: {
            ...buildWorkspace().messages[0].assistantPayload!,
            naturalUnderstanding: "我听见这口气终于松下来了。",
            naturalResponse: "当时最让你放松的是什么？"
          }
        }
      ],
      recovery: { pendingTurn: null }
    });
    const respondBodies: unknown[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(pendingWorkspace);
      if (url === "/api/interview/event-centered/sessions?limit=30") {
        return jsonResponse(buildSessionList([buildListItem()]));
      }
      if (url === "/api/interview/event-centered/session/respond/stream") {
        respondBodies.push(JSON.parse(String(init?.body)));
        return sseResponse([{ event: "session", data: { session: recoveredWorkspace } }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialSessionId="root-1" />);
    expect(await screen.findAllByText(userMessage.rawText)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "继续生成" }));

    await waitFor(() => expect(respondBodies).toHaveLength(1));
    expect(respondBodies[0]).toMatchObject({
      action: "resume_turn",
      rootSessionId: "root-1",
      clientTurnId: "client-turn-pending"
    });
    await waitFor(() => expect(screen.queryByRole("button", { name: "继续生成" })).not.toBeInTheDocument());
    expect(screen.getAllByText(userMessage.rawText)).toHaveLength(1);
  });

  it("keeps new record focusable and shows a top toast when two unfinished records already exist", async () => {
    const list = buildSessionList([
      buildListItem(),
      buildListItem({ rootSessionId: "root-2", title: "第二条记录", lifecycle: "blank", hasUserMessage: false })
    ], 2);
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/interview/event-centered/sessions?limit=30") return jsonResponse(list);
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);

    expect(await screen.findByText("先完成一条记录")).toBeVisible();
    expect(screen.getByRole("button", { name: /帮我记/u })).toBeDisabled();
    expect(screen.getByRole("button", { name: /陪我聊/u })).toBeDisabled();
    const newRecord = screen.getByRole("button", { name: "新建记录" });
    expect(newRecord).not.toBeDisabled();
    expect(newRecord).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(newRecord);
    expect(screen.getByTestId("event-centered-unfinished-limit-toast")).toHaveTextContent(
      "你还有 2 条记录没有完成，先完成其中一条，再新建记录。"
    );
    expect(screen.getByTestId("event-centered-start-workspace")).toBeVisible();
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([input]) =>
      String(input) === "/api/interview/event-centered/session/start"
    )).toBe(false);
  });

  it("uses the same toast and refreshes the sidebar when a concurrent start reaches the server limit", async () => {
    const before = buildSessionList([buildListItem()], 1);
    const after = buildSessionList([
      buildListItem(),
      buildListItem({ rootSessionId: "root-2", title: "另一页新建的记录", lifecycle: "blank", hasUserMessage: false })
    ], 2);
    let listReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/sessions?limit=30") {
        listReads += 1;
        return jsonResponse(listReads === 1 ? before : after);
      }
      if (url === "/api/interview/event-centered/session/start") {
        return jsonResponse({
          error: "EVENT_CENTERED_UNFINISHED_LIMIT_REACHED",
          issue: {
            code: "EVENT_CENTERED_UNFINISHED_LIMIT_REACHED",
            title: "先完成一条记录",
            message: "最多可以同时保留两条未完成记录，请先完成其中一条。",
            resolution: "请从左侧打开一条未完成记录并完成它。",
            retryable: false,
            action: "complete_existing"
          }
        }, 409);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);
    fireEvent.click(await screen.findByRole("button", { name: /陪我聊.*我来问，你来说/u }));

    expect(await screen.findByTestId("event-centered-unfinished-limit-toast")).toHaveTextContent(
      "你还有 2 条记录没有完成，先完成其中一条，再新建记录。"
    );
    await waitFor(() => expect(screen.getByText("未完成 2 / 2")).toBeVisible());
    expect(listReads).toBe(2);
  });

  it("keeps a completed conversation visible and read-only while releasing a slot", async () => {
    const completed = buildWorkspace({
      sessionStatus: "completed",
      eventStatus: "completed",
      journalEvent: {
        ...buildWorkspace().journalEvent!,
        status: "completed",
        completedAt: "2026-07-22T09:00:00.000Z"
      },
      dialogue: { ...buildWorkspace().dialogue, allowedActions: [] }
    });
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(completed);
      if (url === "/api/interview/event-centered/sessions?limit=30") {
        return jsonResponse(buildSessionList([buildListItem({ lifecycle: "completed", readOnly: true })], 0));
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialSessionId="root-1" />);

    expect(await screen.findByText("我会先贴着这件事来听。")).toBeVisible();
    expect(screen.getByTestId("event-centered-completion-inline")).toHaveTextContent("已记下");
    expect(screen.getByLabelText("输入当前事件")).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "新建记录" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "新建记录" }).every((button) => !button.hasAttribute("disabled"))).toBe(true);
  });

  it("shows an ended empty record without claiming that a card was saved", async () => {
    const abandoned = buildWorkspace({
      sessionStatus: "abandoned",
      eventStatus: "abandoned",
      journalEvent: {
        ...buildWorkspace().journalEvent!,
        status: "abandoned",
        completedAt: null,
        abandonedAt: "2026-07-22T09:00:00.000Z"
      },
      dialogue: { ...buildWorkspace().dialogue, allowedActions: [] }
    });
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(abandoned);
      if (url === "/api/interview/event-centered/sessions?limit=30") {
        return jsonResponse(buildSessionList([buildListItem({ lifecycle: "abandoned", readOnly: true })], 0));
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialSessionId="root-1" />);

    expect(await screen.findByTestId("event-centered-abandoned-inline")).toHaveTextContent("还没有形成记录卡");
    expect(screen.queryByTestId("event-centered-completion-inline")).not.toBeInTheDocument();
    expect(screen.queryByText("已记下")).not.toBeInTheDocument();
    expect(screen.getByLabelText("输入当前事件")).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "新建记录" }).every((button) => !button.hasAttribute("disabled"))).toBe(true);
  });

  it("blocks an action that is no longer allowed before sending it to the server", async () => {
    const staleWorkspace = buildWorkspace({
      messages: [{
        ...buildWorkspace().messages[0],
        responseVersion: {
          groupId: "group-1",
          version: 1,
          versionCount: 1,
          canRegenerate: true,
          canSwitch: false,
          versions: [{ messageId: "assistant-1", branchSessionId: "branch-1", version: 1, active: true }]
        }
      }],
      dialogue: { ...buildWorkspace().dialogue, allowedActions: ["reply"] }
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(staleWorkspace);
      if (url === "/api/interview/event-centered/sessions?limit=30") {
        return jsonResponse(buildSessionList([buildListItem()]));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" initialSessionId="root-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "重新生成" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /更简单一点/u }));

    expect(await screen.findByRole("alert")).toHaveTextContent("这个操作已经不适用于当前记录。");
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/interview/event-centered/session/respond/stream")).toBe(false);
  });

  it("constructs stable interview recovery links", () => {
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
