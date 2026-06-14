import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { InterviewShell } from "@/components/interview/interview-shell";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewMessage, InterviewSessionRecord, JoySnapshot, JournalEntryRecord } from "@/types/interview";

const { mockSearchParams } = vi.hoisted(() => ({
  mockSearchParams: {
    value: {
      dimension: "joy" as string | null,
      sessionId: null as string | null,
      entryDate: null as string | null,
      panel: null as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as keyof typeof mockSearchParams.value] ?? null
  })
}));

const openingMessage: InterviewMessage = {
  id: "assistant-opening",
  role: "assistant",
  content: "今天有没有一个让你真心开心的瞬间？先讲那个具体时刻。",
  sequence: 0,
  createdAt: "2026-04-21T00:00:00.000Z"
};

const baseSnapshot: JoySnapshot = {
  event: null,
  feeling: null,
  whyItMattered: null,
  happinessType: null,
  selfPattern: null,
  confidence: 0.2,
  missingSlots: ["event"]
};

const journalEntry: JournalEntryRecord = {
  id: "entry-calendar",
  title: "和家人一起吃饭",
  content: "今天和家人一起吃饭，整个人松下来很多。",
  event: null,
  feeling: null,
  whyItMattered: null,
  happinessType: null,
  selfPattern: null,
  tags: [],
  eventBlocks: [],
  source: "ai_draft_direct",
  status: "saved",
  linkedSessionIds: ["session-from-calendar"],
  updatedAt: "2026-05-01T04:00:00.000Z",
  savedAt: "2026-05-01T04:00:00.000Z"
};

function buildSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
  return {
    userId: "user-1",
    id: "session-from-calendar",
    dimension: "joy",
    status: "completed",
    stage: "wrap_up",
    activeEventId: "event-1",
    draftGenerationUnlocked: true,
    turnCount: 1,
    lastAssistantQuestion: openingMessage.content,
    draftSummary: "和家人一起吃饭，整个人松下来很多。",
    messages: [openingMessage],
    snapshot: baseSnapshot,
    events: [
      {
        id: "event-1",
        sequence: 1,
        status: "completed",
        stage: "wrap_up",
        explorationRound: 1,
        coveredLenses: [],
        roundCoveredLenses: [],
        roundMeaningfulReplyCount: 1,
        totalMeaningfulReplyCount: 1,
        startMessageSequence: 0,
        snapshot: baseSnapshot,
        draftSummary: "和家人一起吃饭，整个人松下来很多。",
        startedAt: "2026-05-01T00:00:00.000Z",
        completedAt: "2026-05-01T00:10:00.000Z"
      }
    ],
    pendingDecision: null,
    entryDate: "2026-05-01",
    startedAt: "2026-05-01T00:00:00.000Z",
    pausedAt: null,
    completedAt: "2026-05-01T00:12:00.000Z",
    journalEntry,
    ...overrides
  };
}

describe("interview deep link behavior", () => {
  beforeEach(() => {
    useInterviewStore.getState().reset("joy");
    window.localStorage.clear();
    mockSearchParams.value = {
      dimension: "joy",
      sessionId: null,
      entryDate: null,
      panel: null
    };
  });

  it("prioritizes explicit sessionId and opens the journal panel from query", async () => {
    mockSearchParams.value = {
      dimension: "joy",
      sessionId: "session-from-calendar",
      entryDate: "2026-05-01",
      panel: "journal"
    };
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/interview/session/session-from-calendar") {
        return new Response(JSON.stringify(buildSession()), { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    render(<InterviewShell />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/interview/session/session-from-calendar", expect.objectContaining({ cache: "no-store" }));
    });
    await screen.findByRole("button", { name: "关闭日志面板" });
    expect(vi.mocked(global.fetch).mock.calls.some(([url]) => String(url) === "/api/interview/session/start")).toBe(false);
  });

  it("passes explicit entryDate when starting a new interview from a deep link", async () => {
    mockSearchParams.value = {
      dimension: "joy",
      sessionId: null,
      entryDate: "2026-05-01",
      panel: null
    };
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/interview/session/start") {
        return new Response(JSON.stringify({ session: buildSession({ status: "active" }) }), { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    render(<InterviewShell />);

    await waitFor(() => {
      const startCall = vi
        .mocked(global.fetch)
        .mock.calls.find(([url]) => String(url) === "/api/interview/session/start");
      expect(startCall).toBeTruthy();
      expect(startCall?.[1]?.body).toBe(JSON.stringify({ dimension: "joy", entryDate: "2026-05-01" }));
    });
  });
});
