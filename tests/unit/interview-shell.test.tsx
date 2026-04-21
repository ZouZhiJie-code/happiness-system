import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { InterviewShell } from "@/components/interview/interview-shell";
import { interviewSessionStorageKey } from "@/features/interview/dimensions";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewMessage, InterviewSessionRecord, JoyEntryDraft, JoySnapshot } from "@/types/interview";

vi.mock("next/navigation", () => ({
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

const completedMessages: InterviewMessage[] = [
  openingMessage,
  {
    id: "user-1",
    role: "user",
    content: "今天和家人一起吃饭聊天，因为我最近很少这么放松。",
    sequence: 1,
    createdAt: "2026-04-21T00:01:00.000Z"
  }
];

const baseDraft: JoyEntryDraft = {
  title: "今天的开心：和家人一起吃饭聊天",
  content: "今天让我开心的事情是：今天和家人一起吃饭聊天。",
  event: baseSnapshot.event,
  feeling: baseSnapshot.feeling,
  whyItMattered: baseSnapshot.whyItMattered,
  happinessType: baseSnapshot.happinessType,
  selfPattern: baseSnapshot.selfPattern,
  tags: ["关系型开心", "轻松踏实"],
  source: "ai_draft_direct"
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
    completedAt: null,
    finalEntry: null,
    ...overrides
  };
}

describe("InterviewShell", () => {
  beforeEach(() => {
    useInterviewStore.getState().reset("joy");
    window.localStorage.clear();

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/interview/session/")) {
        const sessionId = url.split("/").pop();

        if (sessionId === "session-completed") {
          return new Response(
            JSON.stringify(
              buildSession({
                id: "session-completed",
                status: "completed",
                stage: "finalize",
                turnCount: 4,
                messages: completedMessages,
                snapshot: baseSnapshot,
                completedAt: "2026-04-21T00:08:00.000Z"
              })
            ),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        if (sessionId === "session-with-draft") {
          return new Response(
            JSON.stringify(
              buildSession({
                id: "session-with-draft",
                status: "completed",
                stage: "finalize",
                turnCount: 4,
                messages: completedMessages,
                snapshot: baseSnapshot,
                completedAt: "2026-04-21T00:08:00.000Z",
                finalEntry: baseDraft
              })
            ),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("auto-starts the interview and does not render the old start button", async () => {
    render(<InterviewShell />);

    expect(screen.queryByRole("button", { name: "开始访谈" })).not.toBeInTheDocument();
    expect(screen.queryByText("恢复会话")).not.toBeInTheDocument();

    expect(await screen.findByText(openingMessage.content)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新开始" })).toBeInTheDocument();
    expect(screen.getAllByText("第 0 轮")).toHaveLength(1);
  });

  it("shows the finalize action after restoring a completed interview without a draft", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-completed" }));

    render(<InterviewShell />);

    await waitFor(() => {
      expect(screen.getByText("第 4 轮")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "整理成日志" })).toBeInTheDocument();
    expect(screen.queryByText("访谈收束后可整理成日志草稿。")).not.toBeInTheDocument();
  });

  it("starts a fresh session instead of auto-restoring a completed draft session", async () => {
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-draft" }));

    render(<InterviewShell />);

    expect(await screen.findByText(openingMessage.content)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "整理成日志" })).not.toBeInTheDocument();
    expect(screen.queryByText(baseDraft.title)).not.toBeInTheDocument();
    expect(screen.queryByText(baseDraft.content)).not.toBeInTheDocument();
  });
});
