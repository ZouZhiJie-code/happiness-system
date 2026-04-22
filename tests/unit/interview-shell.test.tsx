import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { InterviewShell } from "@/components/interview/interview-shell";
import { SiteHeader } from "@/components/shared/site-header";
import { interviewSessionStorageKey } from "@/features/interview/dimensions";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewMessage, InterviewSessionRecord, JournalEntryRecord, JoySnapshot } from "@/types/interview";

vi.mock("next/navigation", () => ({
  usePathname: () => "/interview",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "dimension" ? "joy" : null)
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
  return {
    id: "session-joy",
    dimension: "joy",
    status: "active",
    stage: "collect_event",
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
    startedAt: "2026-04-21T00:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    journalEntry: null,
    ...overrides
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

describe("InterviewShell", () => {
  beforeEach(() => {
    useInterviewStore.getState().reset("joy");
    window.localStorage.clear();

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
    const generateButton = screen.getByRole("button", { name: "生成日志" });
    expect(generateButton).toBeInTheDocument();
    expect(generateButton.closest(".max-w-2xl")).toBeNull();
    expect(screen.getByTestId("interview-floating-composer")).toContainElement(screen.getByRole("textbox"));
    expect(screen.getByTestId("interview-top-bar")).toContainElement(screen.getByRole("button", { name: "暂停访谈" }));
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

  it("opens the writing workspace and shows the generated journal after clicking generate", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));

    renderInterviewPage();

    const generateButton = await screen.findByRole("button", { name: "生成日志" });
    fireEvent.click(generateButton);

    expect(await screen.findByText("日志整理工作区")).toBeInTheDocument();
    expect(screen.queryByText("日志生成写作面板")).not.toBeInTheDocument();
    expect(screen.queryByText("访谈继续留在左侧，这里负责承接日志生成、编辑、重写和确认。")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(baseJournalEntry.title)).toBeInTheDocument();
    expect(screen.getByText(/今天让我开心的事情是：今天和家人一起吃饭聊天/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存正式日志" })).toBeInTheDocument();
    expect(screen.getByText("当前可以生成日志，也可以继续访谈")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续访谈" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭日志" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "暂停访谈" })).toHaveLength(1);
    expect(screen.queryByText("本轮访谈已暂停")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭日志面板" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "关闭" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "继续整理日志" })).not.toBeInTheDocument();
  });

  it("shows a locked end-state for an existing saved journal and lets the user reopen the workspace", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-journal" }));

    renderInterviewPage();

    await waitFor(() => {
      expect(screen.getByText("第 4 轮")).toBeInTheDocument();
    });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("本轮访谈已暂停")).toBeInTheDocument();
    expect(screen.queryByText("日志整理工作区")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开日志" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续补充访谈" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "结束访谈" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新开始" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "打开日志" }));

    expect(await screen.findByText("日志整理工作区")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭日志" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "生成最新日志" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭日志" }));

    await waitFor(() => {
      expect(screen.queryByText("日志整理工作区")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "打开日志" })).toBeInTheDocument();
  });

  it("requires an explicit reopen before the user can continue the interview", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-journal" }));

    renderInterviewPage();

    await waitFor(() => {
      expect(screen.getByText("第 4 轮")).toBeInTheDocument();
    });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "继续补充访谈" }));

    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/reopen",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("marks the journal as stale after reopened interview messages arrive", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-journal" }));

    const reopenedSession = buildSession({
      id: "session-with-journal",
      status: "active",
      stage: "wrap_up",
      turnCount: 4,
      messages: promptMessages,
      snapshot: baseSnapshot,
      journalEntry: savedJournalEntry
    });
    const updatedSession = buildSession({
      id: "session-with-journal",
      status: "active",
      stage: "wrap_up",
      turnCount: 5,
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
          content: "这份被接住的感觉也很关键。你想把它放进日志里吗？",
          sequence: 4,
          createdAt: "2026-04-21T00:10:00.000Z"
        }
      ],
      snapshot: baseSnapshot,
      journalEntry: savedJournalEntry
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

      if (url.endsWith("/api/interview/session/reopen")) {
        return new Response(JSON.stringify({ session: reopenedSession }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/respond/stream")) {
        return buildSseResponse([
          'event: phase\ndata: {"state":"thinking"}\n\n',
          'event: phase\ndata: {"state":"streaming"}\n\n',
          'event: delta\ndata: {"text":"这份被接住的感觉也很关键。你想把它放进日志里吗？"}\n\n',
          `event: session\ndata: ${JSON.stringify({ session: updatedSession })}\n\n`
        ]);
      }

      if (url.includes("/api/interview/session/")) {
        return new Response(JSON.stringify(buildSession({
          id: "session-with-journal",
          status: "paused",
          stage: "finalize",
          turnCount: 4,
          messages: promptMessages,
          snapshot: baseSnapshot,
          pausedAt: "2026-04-21T00:08:00.000Z",
          journalEntry: savedJournalEntry
        })), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "打开日志" }));
    await screen.findByText("日志整理工作区");

    fireEvent.click(screen.getByRole("button", { name: "继续补充访谈" }));

    const textarea = await screen.findByPlaceholderText(
      "例如：今天和同事一起把一个棘手问题解决了，我真的松了一口气。"
    );
    fireEvent.change(textarea, { target: { value: "我还想补充，那一刻我也觉得被接住了。" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    expect(
      await screen.findByText("当前日志草稿基于更早的访谈内容，如需同步最新补充，请生成最新日志。")
    ).toBeInTheDocument();
    expect(screen.queryByText("你正在补充访谈，当前日志可能已过期。")).not.toBeInTheDocument();
    expect(screen.queryByText("你正在补充访谈，右侧日志会继续保留。")).not.toBeInTheDocument();
    expect(screen.queryByText("关联访谈 1 条")).not.toBeInTheDocument();
  });

  it("regenerates the journal from the latest context after continuing the interview", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-journal" }));

    const reopenedSession = buildSession({
      id: "session-with-journal",
      status: "active",
      stage: "wrap_up",
      turnCount: 4,
      messages: promptMessages,
      snapshot: baseSnapshot,
      journalEntry: savedJournalEntry
    });
    const updatedSession = buildSession({
      id: "session-with-journal",
      status: "active",
      stage: "wrap_up",
      turnCount: 5,
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
          content: "这份被接住的感觉也很关键。你想把它放进日志里吗？",
          sequence: 4,
          createdAt: "2026-04-21T00:10:00.000Z"
        }
      ],
      snapshot: baseSnapshot,
      journalEntry: savedJournalEntry
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

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/reopen")) {
        return new Response(JSON.stringify({ session: reopenedSession }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/respond/stream")) {
        return buildSseResponse([
          'event: phase\ndata: {"state":"thinking"}\n\n',
          'event: phase\ndata: {"state":"streaming"}\n\n',
          'event: delta\ndata: {"text":"这份被接住的感觉也很关键。你想把它放进日志里吗？"}\n\n',
          `event: session\ndata: ${JSON.stringify({ session: updatedSession })}\n\n`
        ]);
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        return new Response(
          JSON.stringify({
            draftEntry: regeneratedEntry,
            session: buildSession({
              id: "session-with-journal",
              status: "active",
              stage: "wrap_up",
              turnCount: 5,
              messages: updatedSession.messages,
              snapshot: baseSnapshot,
              journalEntry: regeneratedEntry
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "打开日志" }));
    await screen.findByText("日志整理工作区");

    fireEvent.click(screen.getByRole("button", { name: "继续补充访谈" }));

    const textarea = await screen.findByPlaceholderText(
      "例如：今天和同事一起把一个棘手问题解决了，我真的松了一口气。"
    );
    fireEvent.change(textarea, { target: { value: "我还想补充，那一刻我也觉得被接住了。" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    await screen.findByText("当前日志草稿基于更早的访谈内容，如需同步最新补充，请生成最新日志。");

    fireEvent.click(screen.getByRole("button", { name: "生成最新日志" }));

    expect(await screen.findByDisplayValue(regeneratedEntry.title)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/我还想记下那种被接住的感觉/)).toBeInTheDocument();
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

  it("shows a toast after saving edits and disables save again until the next change", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-journal" }));

    const editedSavedEntry: JournalEntryRecord = {
      ...savedJournalEntry,
      title: "今天的开心：和家人一起吃饭聊天（补充）",
      content: `${savedJournalEntry.content}\n我也记得那种被接住的感觉。`,
      status: "draft",
      source: "ai_draft_edited",
      updatedAt: "2026-04-21T00:09:00.000Z",
      savedAt: null
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

      if (url.includes("/api/interview/session/") && !url.endsWith("/draft/save")) {
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

      if (url.includes("/api/joy-entry/") && init?.method === "PUT") {
        return new Response(JSON.stringify(editedSavedEntry), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/draft/save")) {
        return new Response(
          JSON.stringify({
            draftEntry: {
              ...editedSavedEntry,
              status: "saved",
              savedAt: "2026-04-21T00:10:00.000Z",
              updatedAt: "2026-04-21T00:10:00.000Z"
            },
            session: buildSession({
              id: "session-with-journal",
              status: "paused",
              stage: "finalize",
              turnCount: 4,
              messages: promptMessages,
              snapshot: baseSnapshot,
              pausedAt: "2026-04-21T00:10:00.000Z",
              journalEntry: {
                ...editedSavedEntry,
                status: "saved",
                savedAt: "2026-04-21T00:10:00.000Z",
                updatedAt: "2026-04-21T00:10:00.000Z"
              }
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "打开日志" }));

    const saveButton = await screen.findByRole("button", { name: "保存修改" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue(savedJournalEntry.title), {
      target: { value: editedSavedEntry.title }
    });

    expect(screen.getByRole("button", { name: "保存修改" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    expect(await screen.findByText("当前日志已保存")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
    });

    await waitFor(() => {
      expect(screen.queryByText("当前日志已保存")).not.toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.queryByText("已保存")).not.toBeInTheDocument();
  });

  it("allows the user to pause the interview explicitly before saving a journal", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-ready" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "暂停访谈" }));

    expect(await screen.findByText("本轮访谈已暂停")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/pause",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(screen.getByRole("button", { name: "继续补充访谈" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "结束访谈" })).toBeInTheDocument();
  });

  it("allows the user to end a paused interview permanently", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-journal" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/complete")) {
        return new Response(
          JSON.stringify({
            session: buildSession({
              id: "session-with-journal",
              status: "completed",
              stage: "finalize",
              turnCount: 4,
              messages: promptMessages,
              snapshot: baseSnapshot,
              completedAt: "2026-04-21T00:11:00.000Z",
              journalEntry: savedJournalEntry
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "结束访谈" }));

    expect(await screen.findByRole("heading", { name: "访谈已结束" })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/complete",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(screen.queryByRole("button", { name: "继续补充访谈" })).not.toBeInTheDocument();
  });

  it("cancels the pending autosave timer before explicit save to avoid duplicate draft writes", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-journal" }));

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/interview/session/") && !url.endsWith("/draft/save")) {
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

      if (url.includes("/api/joy-entry/") && init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            ...savedJournalEntry,
            title: "和同事骑自行车（新标题）",
            status: "draft",
            source: "ai_draft_edited",
            savedAt: null,
            updatedAt: "2026-04-21T00:09:00.000Z"
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
            draftEntry: {
              ...savedJournalEntry,
              title: "和同事骑自行车（新标题）",
              status: "saved",
              source: "ai_draft_edited",
              savedAt: "2026-04-21T00:10:00.000Z",
              updatedAt: "2026-04-21T00:10:00.000Z"
            },
            session: buildSession({
              id: "session-with-journal",
              status: "paused",
              stage: "finalize",
              turnCount: 4,
              messages: promptMessages,
              snapshot: baseSnapshot,
              pausedAt: "2026-04-21T00:10:00.000Z",
              journalEntry: {
                ...savedJournalEntry,
                title: "和同事骑自行车（新标题）",
                status: "saved",
                source: "ai_draft_edited",
                savedAt: "2026-04-21T00:10:00.000Z",
                updatedAt: "2026-04-21T00:10:00.000Z"
              }
            })
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "打开日志" }));
    fireEvent.change(screen.getByDisplayValue(savedJournalEntry.title), {
      target: { value: "和同事骑自行车（新标题）" }
    });

    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      const putCalls = vi.mocked(global.fetch).mock.calls.filter(
        ([input, init]) => String(input).includes("/api/joy-entry/") && init?.method === "PUT"
      );

      expect(putCalls).toHaveLength(1);
    }, { timeout: 2000 });

    await waitFor(() => {
      expect(screen.queryByText("当前日志已保存")).not.toBeInTheDocument();
    }, { timeout: 2000 });

    const putCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([input, init]) => String(input).includes("/api/joy-entry/") && init?.method === "PUT"
    );

    expect(putCalls).toHaveLength(1);
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
  });

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
