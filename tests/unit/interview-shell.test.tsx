import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { InterviewShell } from "@/components/interview/interview-shell";
import { SiteHeader } from "@/components/shared/site-header";
import { interviewLeaveConfirmMessage, interviewSessionStorageKey } from "@/features/interview/dimensions";
import { useInterviewStore } from "@/stores/interview-store";
import type { AssistantTurnPayload, InterviewMessage, InterviewSessionRecord, JournalEntryRecord, JoySnapshot } from "@/types/interview";

const { mockRouterPush, mockRouterReplace, mockSearchDimension } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockSearchDimension: {
    value: "joy"
  }
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/interview",
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "dimension" ? mockSearchDimension.value : null)
  })
}));

const baseSnapshot: JoySnapshot = {
  event: "今天和家人一起吃饭聊天",
  feeling: "轻松踏实",
  whyItMattered: "因为我最近很久没有这种轻松感了",
  happinessType: "关系型开心",
  selfPattern: null,
  confidence: 0.9,
  missingSlots: []
};

function buildAssistantPayload(overrides: Partial<AssistantTurnPayload> = {}): AssistantTurnPayload {
  return {
    insight: "",
    analysis: "",
    question: "今天有没有一个让你真心开心的瞬间？先讲那个具体时刻。",
    stateUpdate: {
      turnPhase: "digging",
      shouldEndDimension: false,
      offerChoice: false,
      choiceReason: ""
    },
    meta: {
      depthReached: []
    },
    ...overrides
  };
}

const openingMessage: InterviewMessage = {
  id: "assistant-opening",
  role: "assistant",
  content: "今天有没有一个让你真心开心的瞬间？先讲那个具体时刻。",
  sequence: 0,
  createdAt: "2026-04-21T00:00:00.000Z"
};

const promptMessages: InterviewMessage[] = [
  openingMessage,
  {
    id: "user-1",
    role: "user",
    content: "今天和家人一起吃饭聊天，因为我最近很少这么放松。",
    sequence: 1,
    createdAt: "2026-04-21T00:01:00.000Z"
  },
  {
    id: "assistant-2",
    role: "assistant",
    content: "我已经抓到这段开心的重点了。现在要不要帮你整理成日志？",
    sequence: 2,
    createdAt: "2026-04-21T00:02:00.000Z"
  }
];

const baseJournalEntry: JournalEntryRecord = {
  id: "entry-1",
  title: "今天的开心：和家人一起吃饭聊天",
  content: "今天让我开心的事情是：今天和家人一起吃饭聊天。\n这件事之所以重要，是因为：因为我最近很久没有这种轻松感了。",
  event: baseSnapshot.event,
  feeling: baseSnapshot.feeling,
  whyItMattered: baseSnapshot.whyItMattered,
  happinessType: baseSnapshot.happinessType,
  selfPattern: baseSnapshot.selfPattern,
  tags: ["关系型开心", "轻松踏实"],
  eventBlocks: [],
  source: "ai_draft_direct",
  status: "draft",
  linkedSessionIds: ["session-ready"],
  updatedAt: "2026-04-21T00:03:00.000Z",
  savedAt: null
};

const savedJournalEntry: JournalEntryRecord = {
  ...baseJournalEntry,
  id: "entry-saved",
  status: "saved",
  linkedSessionIds: ["session-with-journal"],
  updatedAt: "2026-04-21T00:08:00.000Z",
  savedAt: "2026-04-21T00:08:00.000Z"
};

function buildSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
  const nextSession: InterviewSessionRecord = {
    id: "session-joy",
    dimension: "joy",
    status: "active",
    stage: "collect_event",
    activeEventId: "event-1",
    draftGenerationUnlocked: false,
    turnCount: 0,
    lastAssistantQuestion: openingMessage.content,
    draftSummary: null,
    messages: [openingMessage],
    snapshot: {
      event: null,
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      confidence: 0.2,
      missingSlots: ["event", "whyItMattered", "happinessTypeOrSelfPattern"]
    },
    events: [
      {
        id: "event-1",
        sequence: 1,
        status: "active",
        stage: "collect_event",
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 0,
        totalMeaningfulReplyCount: 0,
        startMessageSequence: 0,
        snapshot: {
          event: null,
          feeling: null,
          whyItMattered: null,
          happinessType: null,
          selfPattern: null,
          confidence: 0.2,
          missingSlots: ["event", "whyItMattered", "happinessTypeOrSelfPattern"]
        },
        draftSummary: null,
        startedAt: "2026-04-21T00:00:00.000Z",
        completedAt: null
      }
    ],
    pendingDecision: null,
    startedAt: "2026-04-21T00:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    journalEntry: null,
    ...overrides
  };

  return {
    ...nextSession,
    draftGenerationUnlocked:
      overrides.draftGenerationUnlocked ??
      Boolean(
        nextSession.journalEntry ||
          nextSession.stage === "wrap_up" ||
          nextSession.stage === "finalize" ||
          nextSession.messages.some((message) => message.assistantPayload?.stateUpdate.offerChoice)
      )
  };
}

function buildSseResponse(chunks: string[]) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      }
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" }
    }
  );
}

function renderInterviewPage() {
  return render(
    <>
      <SiteHeader />
      <InterviewShell />
    </>
  );
}

function getDimensionBar() {
  return screen.getByTestId("interview-dimension-bar");
}

function getTopGenerateButton() {
  return within(getDimensionBar()).getByRole("button", { name: "生成日志" });
}

describe("InterviewShell", () => {
  beforeEach(() => {
    useInterviewStore.getState().reset("joy");
    window.localStorage.clear();
    mockRouterPush.mockReset();
    mockRouterReplace.mockReset();
    mockSearchDimension.value = "joy";

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        const session = buildSession({
          id: "session-ready",
          status: "active",
          stage: "wrap_up",
          turnCount: 2,
          messages: promptMessages,
          snapshot: baseSnapshot,
          journalEntry: baseJournalEntry
        });

        return new Response(JSON.stringify({ draftEntry: baseJournalEntry, session }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/reopen")) {
        return new Response(
          JSON.stringify({
            session: buildSession({
              id: "session-with-journal",
              status: "active",
              stage: "wrap_up",
              turnCount: 4,
              messages: promptMessages,
              snapshot: baseSnapshot,
              journalEntry: savedJournalEntry
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/interview/session/complete")) {
        return new Response(
          JSON.stringify({
            session: buildSession({
              id: "session-ready",
              status: "completed",
              stage: "finalize",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot,
              completedAt: "2026-04-21T00:04:00.000Z",
              journalEntry: baseJournalEntry
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/interview/session/pause")) {
        return new Response(
          JSON.stringify({
            session: buildSession({
              id: "session-ready",
              status: "paused",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot,
              pausedAt: "2026-04-21T00:04:00.000Z",
              journalEntry: baseJournalEntry
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/joy-entry/") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as JournalEntryRecord;

        return new Response(
          JSON.stringify({
            ...body,
            status: "draft",
            source: "ai_draft_edited",
            updatedAt: "2026-04-21T00:09:00.000Z",
            savedAt: null
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/interview/session/")) {
        const sessionId = url.split("/").pop();

        if (sessionId === "session-ready") {
          return new Response(
            JSON.stringify(
              buildSession({
                id: "session-ready",
                status: "active",
                stage: "wrap_up",
                turnCount: 2,
                messages: promptMessages,
                snapshot: baseSnapshot
              })
            ),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        if (sessionId === "session-with-journal") {
          return new Response(
            JSON.stringify(
              buildSession({
                id: "session-with-journal",
                status: "paused",
                stage: "finalize",
                turnCount: 4,
                messages: promptMessages,
                snapshot: baseSnapshot,
                pausedAt: "2026-04-21T00:08:00.000Z",
                journalEntry: savedJournalEntry
              })
            ),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("removes the old right-side modules and shows a generate CTA when the interview is ready", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    renderInterviewPage();

    await waitFor(() => {
      expect(screen.getByText("第 2 轮")).toBeInTheDocument();
    });

    expect(screen.queryByText("抽取快照")).not.toBeInTheDocument();
    expect(screen.queryByText("日志草稿")).not.toBeInTheDocument();
    expect(screen.queryByText("今晚的记录从一段具体经历开始。")).not.toBeInTheDocument();
    expect(screen.queryByText("会话进行中")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "整理成日志" })).not.toBeInTheDocument();
    const generateButton = getTopGenerateButton();
    expect(generateButton).toBeInTheDocument();
    expect(getDimensionBar()).toContainElement(generateButton);
    expect(generateButton.closest(".max-w-2xl")).toBeNull();
    expect(screen.getByTestId("interview-floating-composer")).toContainElement(screen.getByRole("textbox"));
    expect(screen.queryByTestId("interview-top-bar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "暂停访谈" })).not.toBeInTheDocument();
  });

  it("renders structured assistant messages as separate insight and question bubbles", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-structured" }));

    const structuredSession = buildSession({
      id: "session-structured",
      status: "active",
      stage: "probe_reason",
      turnCount: 1,
      messages: [
        {
          id: "assistant-structured",
          role: "assistant",
          content: "{\"insight\":\"今天这段轻松感已经有轮廓了。\",\"analysis\":\"用户已说：和家人一起吃饭；下一步问：原因层\",\"question\":\"那一刻为什么会让你这么放松？\",\"stateUpdate\":{\"turnPhase\":\"digging\",\"shouldEndDimension\":false,\"offerChoice\":false,\"choiceReason\":\"\"},\"meta\":{\"depthReached\":[\"event\"]}}",
          assistantPayload: buildAssistantPayload({
            insight: "今天这段轻松感已经有轮廓了。",
            analysis: "用户已说：和家人一起吃饭；下一步问：原因层",
            question: "那一刻为什么会让你这么放松？",
            meta: {
              depthReached: ["event"]
            }
          }),
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ],
      lastAssistantQuestion: "那一刻为什么会让你这么放松？",
      snapshot: {
        ...baseSnapshot,
        whyItMattered: null,
        happinessType: null,
        missingSlots: ["whyItMattered", "happinessTypeOrSelfPattern"]
      }
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-structured")) {
        return new Response(JSON.stringify(structuredSession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    expect(await screen.findByText("今天这段轻松感已经有轮廓了。")).toBeInTheDocument();
    expect(screen.getByText("那一刻为什么会让你这么放松？")).toBeInTheDocument();
  });

  it("shows choice actions and sends the continue action without creating an optimistic user bubble", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-choice" }));

    const choicePayload = buildAssistantPayload({
      insight: "我们已经抓到和家人一起吃饭这个片段，但还差一点更深的展开。",
      question: "",
      stateUpdate: {
        turnPhase: "choice",
        shouldEndDimension: false,
        offerChoice: true,
        choiceReason: "连续追问没有新增信息，先让用户决定是否继续。"
      },
      meta: {
        depthReached: ["event"]
      }
    });
    const choiceSession = buildSession({
      id: "session-choice",
      status: "active",
      stage: "wrap_up",
      turnCount: 1,
      messages: [
        {
          id: "assistant-choice",
          role: "assistant",
          content: JSON.stringify(choicePayload),
          assistantPayload: choicePayload,
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ],
      lastAssistantQuestion: "",
      pendingDecision: {
        kind: "event_complete",
        eventId: "event-1",
        eventSequence: 1,
        actions: ["continue_current_event", "next_event", "generate_draft"]
      },
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "ready_for_choice",
          stage: "wrap_up",
          explorationRound: 1,
          coveredLenses: ["event_detail"],
          roundCoveredLenses: ["event_detail"],
          roundMeaningfulReplyCount: 1,
          totalMeaningfulReplyCount: 1,
          startMessageSequence: 0,
          snapshot: {
            ...baseSnapshot,
            whyItMattered: null,
            happinessType: null,
            missingSlots: ["whyItMattered", "happinessTypeOrSelfPattern"]
          },
          draftSummary: null,
          startedAt: "2026-04-21T00:00:00.000Z",
          completedAt: null
        }
      ],
      snapshot: {
        ...baseSnapshot,
        whyItMattered: null,
        happinessType: null,
        missingSlots: ["whyItMattered", "happinessTypeOrSelfPattern"]
      }
    });
    const continuedPayload = buildAssistantPayload({
      insight: "我们换个角度，把当时让你松下来的东西再看细一点。",
      question: "当时周围的环境或者节奏，有什么特别打动你？",
      meta: {
        depthReached: ["event"]
      }
    });
    const continuedSession = buildSession({
      id: "session-choice",
      status: "active",
      stage: "probe_reason",
      turnCount: 1,
      pendingDecision: null,
      messages: [
        ...choiceSession.messages,
        {
          id: "assistant-continued",
          role: "assistant",
          content: JSON.stringify(continuedPayload),
          assistantPayload: continuedPayload,
          sequence: 1,
          createdAt: "2026-04-21T00:01:00.000Z"
        }
      ],
      lastAssistantQuestion: continuedPayload.question,
      snapshot: choiceSession.snapshot
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-choice")) {
        return new Response(JSON.stringify(choiceSession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/respond/stream")) {
        return buildSseResponse([
          'event: phase\ndata: {"state":"thinking"}\n\n',
          'event: phase\ndata: {"state":"insight"}\n\n',
          `event: delta\ndata: ${JSON.stringify({ target: "insight", text: continuedPayload.insight })}\n\n`,
          'event: phase\ndata: {"state":"question"}\n\n',
          `event: delta\ndata: ${JSON.stringify({ target: "question", text: continuedPayload.question })}\n\n`,
          `event: session\ndata: ${JSON.stringify({ session: continuedSession })}\n\n`
        ]);
      }

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    expect(await screen.findByRole("button", { name: "换个角度继续聊" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "聊下一件开心的事" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "现在整理日志" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成日志" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "换个角度继续聊" }));

    expect(await screen.findByText(continuedPayload.insight)).toBeInTheDocument();
    expect(await screen.findByText(continuedPayload.question)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByText("正在思考中...")).not.toBeInTheDocument();
    expect(screen.queryByText("换个角度继续聊")).not.toBeInTheDocument();
    expect(getTopGenerateButton()).toBeInTheDocument();

    const continueCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]) => String(url).endsWith("/api/interview/session/respond/stream")
    );
    expect(continueCall).toBeTruthy();
    expect(JSON.parse(String(continueCall?.[1]?.body))).toEqual({
      action: "continue_current_event",
      sessionId: "session-choice"
    });
  });

  it("keeps auto-scroll inside the interview message panel instead of using scrollIntoView", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
    const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});

    renderInterviewPage();

    const scrollPanel = await screen.findByTestId("interview-message-scroll");

    expect(scrollPanel).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("第 2 轮")).toBeInTheDocument();
    });
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it("opens the writing workspace and shows the generated journal after clicking the top generate button", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));

    expect(await screen.findByText("日志整理工作区")).toBeInTheDocument();
    expect(screen.getByDisplayValue(baseJournalEntry.title)).toBeInTheDocument();
    expect(screen.getByText(/今天让我开心的事情是：今天和家人一起吃饭聊天/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存正式日志" })).toBeInTheDocument();
    expect(screen.queryByText("当前可以生成日志，也可以继续访谈")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成最新日志" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "暂停访谈" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭日志面板" })).toBeInTheDocument();
  });

  it("automatically reopens legacy paused sessions during restore", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-journal" }));

    renderInterviewPage();

    await waitFor(() => {
      expect(screen.getByText("第 4 轮")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/reopen",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByText("本轮访谈已暂停")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成日志" })).toBeInTheDocument();
  });

  it("keeps the top generate action available after new interview messages arrive without showing a stale warning", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    const updatedSession = buildSession({
      id: "session-ready",
      status: "active",
      stage: "wrap_up",
      turnCount: 3,
      messages: [
        ...promptMessages,
        {
          id: "user-3",
          role: "user",
          content: "我还想补充，那一刻我也觉得被接住了。",
          sequence: 3,
          createdAt: "2026-04-21T00:09:00.000Z"
        },
        {
          id: "assistant-4",
          role: "assistant",
          content: "这份被接住的感觉也很关键。",
          sequence: 4,
          createdAt: "2026-04-21T00:10:00.000Z"
        }
      ],
      snapshot: baseSnapshot,
      journalEntry: baseJournalEntry
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        return new Response(
          JSON.stringify({
            draftEntry: baseJournalEntry,
            session: buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot,
              journalEntry: baseJournalEntry
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/interview/session/respond/stream")) {
        return buildSseResponse([
          'event: phase\ndata: {"state":"thinking"}\n\n',
          'event: phase\ndata: {"state":"insight"}\n\n',
          'event: delta\ndata: {"target":"insight","text":"这份被接住的感觉也很关键。"}\n\n',
          `event: session\ndata: ${JSON.stringify({ session: updatedSession })}\n\n`
        ]);
      }

      if (url.includes("/api/interview/session/")) {
        return new Response(
          JSON.stringify(
            buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));
    await screen.findByText("日志整理工作区");

    const textarea = screen.getByPlaceholderText(
      "例如：今天和同事一起把一个棘手问题解决了，我真的松了一口气。"
    );
    fireEvent.change(textarea, { target: { value: "我还想补充，那一刻我也觉得被接住了。" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    await screen.findByText("这份被接住的感觉也很关键。");
    expect(
      screen.queryByText("当前日志草稿基于更早的访谈内容，如需同步最新补充，请点击顶部“生成日志”。")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成日志" })).toBeInTheDocument();
  });

  it("regenerates the journal from the latest context when the top generate button is clicked again", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));
    let draftGenerateCallCount = 0;

    const updatedSession = buildSession({
      id: "session-ready",
      status: "active",
      stage: "wrap_up",
      turnCount: 3,
      messages: [
        ...promptMessages,
        {
          id: "user-3",
          role: "user",
          content: "我还想补充，那一刻我也觉得被接住了。",
          sequence: 3,
          createdAt: "2026-04-21T00:09:00.000Z"
        },
        {
          id: "assistant-4",
          role: "assistant",
          content: "这份被接住的感觉也很关键。",
          sequence: 4,
          createdAt: "2026-04-21T00:10:00.000Z"
        }
      ],
      snapshot: baseSnapshot,
      journalEntry: baseJournalEntry
    });
    const regeneratedEntry: JournalEntryRecord = {
      ...savedJournalEntry,
      title: "今天的开心：和家人一起吃饭聊天（更新）",
      content: `${savedJournalEntry.content}\n我还想记下那种被接住的感觉。`,
      status: "draft",
      source: "ai_draft_direct",
      updatedAt: "2026-04-21T00:11:00.000Z",
      savedAt: null
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        draftGenerateCallCount += 1;
        const latestSession =
          draftGenerateCallCount >= 2
            ? buildSession({
                id: "session-ready",
                status: "active",
                stage: "wrap_up",
                turnCount: 3,
                messages: updatedSession.messages,
                snapshot: baseSnapshot,
                journalEntry: regeneratedEntry
              })
            : buildSession({
                id: "session-ready",
                status: "active",
                stage: "wrap_up",
                turnCount: 2,
                messages: promptMessages,
                snapshot: baseSnapshot,
                journalEntry: baseJournalEntry
              });

        return new Response(
          JSON.stringify({
            draftEntry: latestSession.journalEntry,
            session: latestSession
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/interview/session/respond/stream")) {
        return buildSseResponse([
          'event: phase\ndata: {"state":"thinking"}\n\n',
          'event: phase\ndata: {"state":"insight"}\n\n',
          'event: delta\ndata: {"target":"insight","text":"这份被接住的感觉也很关键。"}\n\n',
          `event: session\ndata: ${JSON.stringify({ session: updatedSession })}\n\n`
        ]);
      }

      if (url.includes("/api/interview/session/")) {
        return new Response(
          JSON.stringify(
            buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));
    await screen.findByText("日志整理工作区");

    const textarea = screen.getByPlaceholderText(
      "例如：今天和同事一起把一个棘手问题解决了，我真的松了一口气。"
    );
    fireEvent.change(textarea, { target: { value: "我还想补充，那一刻我也觉得被接住了。" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(getTopGenerateButton()).toBeEnabled();
    });
    fireEvent.click(getTopGenerateButton());

    await waitFor(() => {
      expect(draftGenerateCallCount).toBe(2);
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue(regeneratedEntry.title)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue(/我还想记下那种被接住的感觉/)).toBeInTheDocument();
  });

  it("does not repeat a separate generating badge inside the workspace while the top button is already busy", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));

        return new Response(
          JSON.stringify({
            draftEntry: baseJournalEntry,
            session: buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot,
              journalEntry: baseJournalEntry
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/interview/session/")) {
        return new Response(
          JSON.stringify(
            buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));

    expect(await screen.findByText("AI 正在整理日志草稿")).toBeInTheDocument();
    expect(screen.queryByText(/^生成中$/)).not.toBeInTheDocument();
  });

  it("shows a retryable error state when draft generation fails", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        return new Response(
          JSON.stringify({
            error: "DRAFT_GENERATE_UPSTREAM_ERROR",
            retryable: true,
            message: "AI 暂时没能完成整理，请稍后重试。"
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/interview/session/")) {
        return new Response(
          JSON.stringify(
            buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));

    expect(await screen.findByText("这次没能成功生成日志")).toBeInTheDocument();
    expect(screen.getByText("AI 暂时没能完成整理，请稍后重试。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试生成" })).toBeInTheDocument();
  });

  it("opens a confirmation dialog before the first formal save and lets the user continue the interview", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));
    await screen.findByText("日志整理工作区");

    fireEvent.click(screen.getByRole("button", { name: "保存正式日志" }));

    expect(screen.getByRole("dialog", { name: "确定保存这篇日志吗？" })).toBeInTheDocument();
    expect(screen.getByText("确定保存后，会结束当前访谈。结束后你仍然可以打开日志继续修改内容。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "继续访谈" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "确定保存这篇日志吗？" })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("interview-floating-composer")).toBeInTheDocument();

    const saveCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([input, init]) => String(input).endsWith("/api/interview/session/draft/save") && init?.method === "POST"
    );
    expect(saveCalls).toHaveLength(0);
  });

  it("saves the generated journal after confirmation, shows a toast, and ends the interview", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    const savedEntry: JournalEntryRecord = {
      ...baseJournalEntry,
      status: "saved",
      source: "ai_draft_direct",
      savedAt: "2026-04-21T00:10:00.000Z",
      updatedAt: "2026-04-21T00:10:00.000Z"
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        return new Response(
          JSON.stringify({
            draftEntry: baseJournalEntry,
            session: buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot,
              journalEntry: baseJournalEntry
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/interview/session/draft/save")) {
        return new Response(
          JSON.stringify({
            draftEntry: savedEntry,
            session: buildSession({
              id: "session-ready",
              status: "completed",
              stage: "finalize",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot,
              completedAt: "2026-04-21T00:10:00.000Z",
              journalEntry: savedEntry
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/interview/session/")) {
        return new Response(
          JSON.stringify(
            buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));
    await screen.findByText("日志整理工作区");

    fireEvent.click(screen.getByRole("button", { name: "保存正式日志" }));
    fireEvent.click(screen.getByRole("button", { name: "确定保存" }));

    expect(await screen.findByText("当前日志已保存")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "日志已保存，访谈已结束" })).toBeInTheDocument();
    expect(screen.queryByTestId("interview-floating-composer")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/draft/save",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("prompts before switching dimensions and keeps the cached session on confirm", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);

    renderInterviewPage();

    await screen.findByText("第 2 轮");

    fireEvent.click(screen.getByRole("button", { name: "思考" }));

    expect(confirmSpy).toHaveBeenCalledWith(interviewLeaveConfirmMessage);
    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "思考" }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/interview?dimension=reflection", { scroll: false });
    });

    const storedSessions = JSON.parse(window.localStorage.getItem(interviewSessionStorageKey) ?? "{}") as {
      joy?: { sessionId?: string; expiresAt?: string };
    };
    expect(storedSessions.joy?.sessionId).toBe("session-ready");
    expect(storedSessions.joy?.expiresAt).toEqual(expect.any(String));
  });

  it("restores the cached session when switching back to a previous dimension within 24 hours", async () => {
    window.localStorage.setItem(
      interviewSessionStorageKey,
      JSON.stringify({
        joy: { sessionId: "session-ready", expiresAt: "2099-04-21T00:00:00.000Z" },
        fulfillment: { sessionId: "session-fulfillment", expiresAt: "2099-04-21T00:00:00.000Z" }
      })
    );

    const joySession = buildSession({
      id: "session-ready",
      status: "active",
      stage: "wrap_up",
      turnCount: 2,
      messages: promptMessages,
      snapshot: baseSnapshot
    });
    const fulfillmentSession = buildSession({
      id: "session-fulfillment",
      dimension: "fulfillment",
      status: "active",
      stage: "probe_reason",
      turnCount: 1,
      lastAssistantQuestion: "今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。",
      messages: [
        {
          id: "assistant-fulfillment",
          role: "assistant",
          content: "今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。",
          assistantPayload: buildAssistantPayload({
            question: "今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。"
          }),
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ],
      snapshot: {
        event: "今天专心把一个任务推进完了",
        feeling: "投入专注",
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.6,
        missingSlots: ["whyItMattered", "happinessTypeOrSelfPattern"]
      }
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-ready")) {
        return new Response(JSON.stringify(joySession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/session-fulfillment")) {
        return new Response(JSON.stringify(fulfillmentSession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        throw new Error("should not create a new session while cached sessions are valid");
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    const view = renderInterviewPage();

    await screen.findByText("第 2 轮");
    expect(getTopGenerateButton()).toBeInTheDocument();

    mockSearchDimension.value = "fulfillment";
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    await screen.findByText("今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。");
    expect(screen.queryByRole("button", { name: "生成日志" })).not.toBeInTheDocument();

    mockSearchDimension.value = "joy";
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    await screen.findByText("第 2 轮");
    expect(getTopGenerateButton()).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith("/api/interview/session/session-ready", expect.objectContaining({ cache: "no-store" }));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/session-fulfillment",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("keeps a saved session restorable for 24 hours after ending the interview", async () => {
    window.localStorage.setItem(
      interviewSessionStorageKey,
      JSON.stringify({
        joy: { sessionId: "session-ready", expiresAt: "2099-04-21T00:00:00.000Z" },
        fulfillment: { sessionId: "session-fulfillment", expiresAt: "2099-04-21T00:00:00.000Z" }
      })
    );

    const activeJoySession = buildSession({
      id: "session-ready",
      status: "active",
      stage: "wrap_up",
      turnCount: 2,
      messages: promptMessages,
      snapshot: baseSnapshot
    });
    const activeJoySessionWithDraft = buildSession({
      ...activeJoySession,
      journalEntry: baseJournalEntry
    });
    const completedJoySession = buildSession({
      id: "session-ready",
      status: "completed",
      stage: "finalize",
      turnCount: 2,
      messages: promptMessages,
      snapshot: baseSnapshot,
      completedAt: "2026-04-21T00:10:00.000Z",
      journalEntry: savedJournalEntry
    });
    const fulfillmentSession = buildSession({
      id: "session-fulfillment",
      dimension: "fulfillment",
      status: "active",
      stage: "probe_reason",
      turnCount: 1,
      lastAssistantQuestion: "今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。",
      messages: [
        {
          id: "assistant-fulfillment",
          role: "assistant",
          content: "今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。",
          assistantPayload: buildAssistantPayload({
            question: "今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。"
          }),
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ],
      snapshot: {
        event: "今天专心把一个任务推进完了",
        feeling: "投入专注",
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.6,
        missingSlots: ["whyItMattered", "happinessTypeOrSelfPattern"]
      }
    });

    let joyFetchCount = 0;

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-ready")) {
        joyFetchCount += 1;

        return new Response(JSON.stringify(joyFetchCount === 1 ? activeJoySession : completedJoySession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/session-fulfillment")) {
        return new Response(JSON.stringify(fulfillmentSession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        return new Response(
          JSON.stringify({
            draftEntry: baseJournalEntry,
            session: activeJoySessionWithDraft
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/interview/session/draft/save")) {
        return new Response(
          JSON.stringify({
            draftEntry: savedJournalEntry,
            session: completedJoySession
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/interview/session/start")) {
        throw new Error("should not create a new session while cached sessions are valid");
      }

      if (url.includes("/api/joy-entry/") && init?.method === "PUT") {
        return new Response(JSON.stringify(baseJournalEntry), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    const view = renderInterviewPage();

    await screen.findByText("第 2 轮");

    fireEvent.click(getTopGenerateButton());
    await screen.findByText("日志整理工作区");

    fireEvent.click(screen.getByRole("button", { name: "保存正式日志" }));
    fireEvent.click(screen.getByRole("button", { name: "确定保存" }));

    expect(await screen.findByRole("heading", { name: "日志已保存，访谈已结束" })).toBeInTheDocument();

    await waitFor(() => {
      const storedSessions = JSON.parse(window.localStorage.getItem(interviewSessionStorageKey) ?? "{}") as {
        joy?: { sessionId?: string; expiresAt?: string };
      };

      expect(storedSessions.joy?.sessionId).toBe("session-ready");
      expect(storedSessions.joy?.expiresAt).toEqual(expect.any(String));
    });

    mockSearchDimension.value = "fulfillment";
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    await screen.findByText("今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。");

    mockSearchDimension.value = "joy";
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    expect(await screen.findByRole("heading", { name: "日志已保存，访谈已结束" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成日志" })).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/interview/session/session-ready", expect.objectContaining({ cache: "no-store" }));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/session-fulfillment",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("cancels the pending autosave timer before explicit save to avoid duplicate draft writes", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    const editedDraftEntry: JournalEntryRecord = {
      ...baseJournalEntry,
      title: "今天的开心：和家人一起吃饭聊天（补充）",
      status: "draft",
      source: "ai_draft_edited",
      updatedAt: "2026-04-21T00:09:00.000Z",
      savedAt: null
    };
    const savedEntry: JournalEntryRecord = {
      ...editedDraftEntry,
      status: "saved",
      savedAt: "2026-04-21T00:10:00.000Z",
      updatedAt: "2026-04-21T00:10:00.000Z"
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        return new Response(
          JSON.stringify({
            draftEntry: baseJournalEntry,
            session: buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot,
              journalEntry: baseJournalEntry
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/joy-entry/") && init?.method === "PUT") {
        return new Response(JSON.stringify(editedDraftEntry), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/save")) {
        return new Response(
          JSON.stringify({
            draftEntry: savedEntry,
            session: buildSession({
              id: "session-ready",
              status: "completed",
              stage: "finalize",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot,
              completedAt: "2026-04-21T00:10:00.000Z",
              journalEntry: savedEntry
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/interview/session/")) {
        return new Response(
          JSON.stringify(
            buildSession({
              id: "session-ready",
              status: "active",
              stage: "wrap_up",
              turnCount: 2,
              messages: promptMessages,
              snapshot: baseSnapshot
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));
    await screen.findByText("日志整理工作区");

    fireEvent.change(screen.getByDisplayValue(baseJournalEntry.title), {
      target: { value: editedDraftEntry.title }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存正式日志" }));
    fireEvent.click(screen.getByRole("button", { name: "确定保存" }));

    await screen.findByText("当前日志已保存");

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    });

    const putCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([input, nextInit]) => String(input).includes("/api/joy-entry/") && nextInit?.method === "PUT"
    );
    const saveCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([input, nextInit]) => String(input).endsWith("/api/interview/session/draft/save") && nextInit?.method === "POST"
    );

    expect(putCalls).toHaveLength(1);
    expect(saveCalls).toHaveLength(1);
  }, 10000);

  it("sends on Enter and preserves newline on Shift+Enter", async () => {
    const streamedSession = buildSession({
      turnCount: 2,
      messages: [
        openingMessage,
        {
          id: "user-enter",
          role: "user",
          content: "第一行",
          sequence: 1,
          createdAt: "2026-04-21T00:01:00.000Z"
        },
        {
          id: "assistant-enter",
          role: "assistant",
          content: "收到，我继续问下一个细节。",
          sequence: 2,
          createdAt: "2026-04-21T00:02:00.000Z"
        }
      ]
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/respond/stream")) {
        return buildSseResponse([
          'event: phase\ndata: {"state":"thinking"}\n\n',
          'event: phase\ndata: {"state":"streaming"}\n\n',
          'event: delta\ndata: {"text":"收到，我继续问下一个细节。"}\n\n',
          `event: session\ndata: ${JSON.stringify({ session: streamedSession })}\n\n`
        ]);
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    const textarea = await screen.findByRole("textbox");
    const sendButton = screen.getByRole("button", { name: "发送回答" });

    expect(sendButton).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "第一行" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/interview/session/respond/stream",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    const sendCallsAfterEnter = vi
      .mocked(global.fetch)
      .mock.calls.filter(([input]) => String(input).endsWith("/api/interview/session/respond/stream")).length;

    fireEvent.change(textarea, { target: { value: "第二行\n第三行" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: true });

    const sendCallsAfterShiftEnter = vi
      .mocked(global.fetch)
      .mock.calls.filter(([input]) => String(input).endsWith("/api/interview/session/respond/stream")).length;

    expect(sendCallsAfterShiftEnter).toBe(sendCallsAfterEnter);
    expect(textarea).toHaveValue("第二行\n第三行");
  });

  it("keeps the composer collapsed to a single-line minimum height", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    const textarea = await screen.findByRole("textbox");

    await waitFor(() => {
      expect(textarea).toHaveStyle({ height: "36px" });
    });
  });

  it("does not send on Enter while IME composition is in progress", async () => {
    const streamedSession = buildSession({
      turnCount: 2,
      messages: [
        openingMessage,
        {
          id: "user-ime",
          role: "user",
          content: "正在输入",
          sequence: 1,
          createdAt: "2026-04-21T00:01:00.000Z"
        },
        {
          id: "assistant-ime",
          role: "assistant",
          content: "收到，我继续问下一个细节。",
          sequence: 2,
          createdAt: "2026-04-21T00:02:00.000Z"
        }
      ]
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/respond/stream")) {
        return buildSseResponse([
          'event: phase\ndata: {"state":"thinking"}\n\n',
          'event: phase\ndata: {"state":"streaming"}\n\n',
          'event: delta\ndata: {"text":"收到，我继续问下一个细节。"}\n\n',
          `event: session\ndata: ${JSON.stringify({ session: streamedSession })}\n\n`
        ]);
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    const textarea = await screen.findByRole("textbox");
    fireEvent.change(textarea, { target: { value: "正在输入" } });

    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", isComposing: true, keyCode: 229 });

    const sendCallsDuringComposition = vi
      .mocked(global.fetch)
      .mock.calls.filter(([input]) => String(input).endsWith("/api/interview/session/respond/stream")).length;

    expect(sendCallsDuringComposition).toBe(0);
    expect(textarea).toHaveValue("正在输入");

    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/interview/session/respond/stream",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
  });

  it("renders optimistic user messages with user-side alignment before the streamed session hydrates", async () => {
    const streamedSession = buildSession({
      turnCount: 2,
      messages: [
        openingMessage,
        {
          id: "user-optimistic",
          role: "user",
          content: "先记录这一句",
          sequence: 1,
          createdAt: "2026-04-21T00:01:00.000Z"
        }
      ]
    });
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/respond/stream")) {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(nextController) {
              controller = nextController;
              controller.enqueue(encoder.encode('event: phase\ndata: {"state":"thinking"}\n\n'));
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream; charset=utf-8" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    const textarea = await screen.findByRole("textbox");
    fireEvent.change(textarea, { target: { value: "先记录这一句" } });
    fireEvent.click(screen.getByRole("button", { name: "发送回答" }));

    await waitFor(() => {
      expect(screen.getByText("正在思考中...")).toBeInTheDocument();
    });

    const optimisticBubble = screen.getByText("先记录这一句");
    expect(optimisticBubble.closest("div.flex")).toHaveClass("justify-end");

    await act(async () => {
      controller?.enqueue(encoder.encode(`event: session\ndata: ${JSON.stringify({ session: streamedSession })}\n\n`));
      controller?.close();
    });

    await waitFor(() => {
      expect(screen.queryByText("正在思考中...")).not.toBeInTheDocument();
    });
  });
});
