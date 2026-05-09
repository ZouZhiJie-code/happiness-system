import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { InterviewShell } from "@/components/interview/interview-shell";
import { SiteHeader } from "@/components/shared/site-header";
import type { CalendarDayRecord } from "@/features/calendar/types";
import { getAssistantChoiceKind } from "@/features/joy-interview/assistant-turn";
import { interviewLeaveConfirmMessage, interviewSessionStorageKey } from "@/features/interview/dimensions";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { useInterviewStore } from "@/stores/interview-store";
import type {
  AssistantTurnPayload,
  DailyJournalEntryRecord,
  InterviewDimension,
  InterviewMessage,
  InterviewSessionRecord,
  JournalEntryRecord,
  JoySnapshot
} from "@/types/interview";

const { mockPathname, mockRouterPush, mockRouterReplace, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: {
    value: "/interview"
  },
  mockRouterPush: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockSearchParams: {
    value: {
      dimension: "joy" as string | null,
      entryDate: null as string | null,
      mode: null as string | null,
      panel: null as string | null,
      sessionId: null as string | null
    }
  }
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.value[key as keyof typeof mockSearchParams.value] ?? null
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
    thinkingSummary: "",
    analysis: "",
    question: "今天有没有一个让你真心开心的瞬间？先讲那个具体时刻。",
    stateUpdate: {
      turnPhase: "digging",
      shouldEndDimension: false,
      offerChoice: false,
      choiceKind: null,
      choiceReason: ""
    },
    meta: {
      depthReached: []
    },
    ...overrides
  };
}

const defaultEntryDate = () => getTodayEntryDate();

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

const joyInputPlaceholder = "例如：今天和同事一起把一个棘手问题解决了，我真的松了一口气。";
const journalBodyPlaceholder = "日志正文会出现在这里，你可以像编辑文章一样继续修改。";

const baseJournalPayload = {
  kind: "joy" as const,
  joyMoment: "今天和家人一起吃饭聊天",
  joySource: "被家人的陪伴接住了，也重新回到轻松状态",
  stateShift: "从紧绷变回轻松踏实",
  meaningNeed: "我需要稳定的陪伴感和能放松下来的关系连接",
  manualClue: "当我能在熟悉关系里放松下来时，我会明显恢复能量",
  directionSignal: "关系滋养型开心",
  valueImpact: null,
  durability: "这种开心在饭后还延续了很久",
  tags: ["关系型开心", "轻松踏实"]
};

const baseJournalEntry: JournalEntryRecord = {
  id: "entry-1",
  title: "和家人一起吃饭",
  content: "今天让我开心的事情是：今天和家人一起吃饭聊天。\n这件事之所以重要，是因为：因为我最近很久没有这种轻松感了。",
  event: baseSnapshot.event,
  feeling: baseSnapshot.feeling,
  whyItMattered: baseSnapshot.whyItMattered,
  happinessType: baseSnapshot.happinessType,
  selfPattern: baseSnapshot.selfPattern,
  tags: ["关系型开心", "轻松踏实"],
  eventBlocks: [],
  payload: baseJournalPayload,
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

const baseDailyJournalEntry: DailyJournalEntryRecord = {
  id: "daily-1",
  date: "2026-04-21",
  title: "今天的记录",
  content: "## 开心\n今天和家人一起吃饭聊天，整个人慢慢放松下来。",
  status: "draft",
  sourceEntryIds: ["entry-saved"],
  sourceSessionIds: ["session-with-journal"],
  sourceSignature: "entry-saved:2026-04-21T00:08:00.000Z",
  sourceUpdatedAt: "2026-04-21T00:08:00.000Z",
  updatedAt: "2026-04-21T00:09:00.000Z",
  savedAt: null
};

const baseDailyJournalSources = [
  {
    id: "entry-saved",
    sessionId: "session-with-journal",
    dimension: "joy",
    title: "和家人一起吃饭",
    updatedAt: "2026-04-21T00:08:00.000Z",
    savedAt: "2026-04-21T00:08:00.000Z"
  }
] as const;

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
    entryDate: defaultEntryDate(),
    startedAt: "2026-04-21T00:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    journalEntry: null,
    ...overrides
  };

  const events = overrides.events ?? nextSession.events.map((event) => ({
    ...event,
    status:
      nextSession.stage === "wrap_up"
        ? ("ready_for_choice" as const)
        : nextSession.stage === "finalize"
          ? ("completed" as const)
          : event.status,
    stage: nextSession.stage,
    roundMeaningfulReplyCount: nextSession.turnCount,
    totalMeaningfulReplyCount: nextSession.turnCount,
    snapshot: nextSession.snapshot,
    completedAt: nextSession.stage === "finalize" ? nextSession.completedAt ?? event.completedAt : event.completedAt
  }));

  return {
    ...nextSession,
    events,
    draftGenerationUnlocked:
      overrides.draftGenerationUnlocked ??
      Boolean(
        nextSession.journalEntry ||
          nextSession.stage === "wrap_up" ||
          nextSession.stage === "finalize" ||
          nextSession.messages.some((message) => getAssistantChoiceKind(message.assistantPayload) === "event_complete")
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

function createDeferredResponse() {
  let resolve: (value: Response) => void;

  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve: resolve!
  };
}

function renderInterviewPage() {
  return render(
    <>
      <SiteHeader />
      <InterviewShell />
    </>
  );
}

function buildStoredSessionCacheEntry(sessionId: string, entryDate = defaultEntryDate()) {
  return {
    sessionId,
    entryDate,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}

function cacheInterviewSessions(entries: Partial<Record<InterviewDimension, string | ReturnType<typeof buildStoredSessionCacheEntry>>>) {
  const normalized = Object.fromEntries(
    Object.entries(entries).map(([dimension, value]) => [
      dimension,
      typeof value === "string" ? buildStoredSessionCacheEntry(value) : value
    ])
  );

  window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify(normalized));
}

function getDimensionBar() {
  return screen.getByTestId("interview-dimension-bar");
}

function getTopGenerateButton() {
  return within(getDimensionBar()).getByRole("button", { name: "生成日志" });
}

function getDimensionButton(label: string) {
  return within(getDimensionBar()).getByRole("button", { name: label });
}

function getExpectedHeaderStatusValue(status: string) {
  switch (status) {
    case "已完成":
      return "completed";
    case "进行中":
      return "in_progress";
    case "已整理":
      return "draft";
    case "未开始":
      return "empty";
    default:
      return null;
  }
}

function expectDimensionStatus(label: string, status: string) {
  const button = getDimensionButton(label);
  const expectedStatusValue = getExpectedHeaderStatusValue(status);

  if (!expectedStatusValue) {
    expect(within(button).getByText(status)).toBeInTheDocument();
    return;
  }

  const statusDot = within(button).getByTitle(status);

  expect(statusDot).toHaveAttribute("data-status", expectedStatusValue);
}

function buildHeaderDayRecord(overrides: Partial<CalendarDayRecord> = {}): CalendarDayRecord {
  return {
    date: "2026-05-01",
    overallStatus: "mixed",
    dailyJournal: {
      state: "none",
      id: null,
      title: null,
      updatedAt: null,
      savedAt: null,
      sourceEntryCount: 4
    },
    dimensions: [
      {
        dimension: "joy",
        status: "completed",
        title: "开心",
        summary: null,
        latestUpdatedAt: "2026-05-01T10:00:00.000Z",
        sessionId: "session-joy-0501",
        journalEntryId: "entry-joy-0501",
        actions: ["view_journal", "edit_saved_journal"],
        hasActiveSession: false,
        hasDraftEntry: false,
        hasSavedEntry: true
      },
      {
        dimension: "fulfillment",
        status: "completed",
        title: "充实",
        summary: null,
        latestUpdatedAt: "2026-05-01T10:00:00.000Z",
        sessionId: "session-fulfillment-0501",
        journalEntryId: "entry-fulfillment-0501",
        actions: ["view_journal", "edit_saved_journal"],
        hasActiveSession: false,
        hasDraftEntry: false,
        hasSavedEntry: true
      },
      {
        dimension: "reflection",
        status: "completed",
        title: "思考",
        summary: null,
        latestUpdatedAt: "2026-05-01T10:00:00.000Z",
        sessionId: "session-reflection-0501",
        journalEntryId: "entry-reflection-0501",
        actions: ["view_journal", "edit_saved_journal"],
        hasActiveSession: false,
        hasDraftEntry: false,
        hasSavedEntry: true
      },
      {
        dimension: "improvement",
        status: "mixed",
        title: "改进",
        summary: null,
        latestUpdatedAt: "2026-05-01T10:00:00.000Z",
        sessionId: "session-improvement-0501",
        journalEntryId: "entry-improvement-0501",
        actions: ["continue_interview", "view_journal", "edit_saved_journal"],
        hasActiveSession: true,
        hasDraftEntry: false,
        hasSavedEntry: true
      },
      {
        dimension: "gratitude",
        status: "empty",
        title: null,
        summary: null,
        latestUpdatedAt: null,
        sessionId: null,
        journalEntryId: null,
        actions: ["start_interview"],
        hasActiveSession: false,
        hasDraftEntry: false,
        hasSavedEntry: false
      }
    ],
    activeCount: 0,
    draftCount: 0,
    savedCount: 4,
    primaryTitle: "今天收住了四个维度",
    primarySummary: null,
    latestUpdatedAt: "2026-05-01T10:00:00.000Z",
    primaryAction: "view_journal",
    ...overrides
  };
}

const dimensionRingTestIds = {
  开心: "dimension-progress-ring-joy",
  充实: "dimension-progress-ring-fulfillment",
  思考: "dimension-progress-ring-reflection",
  改进: "dimension-progress-ring-improvement",
  感谢: "dimension-progress-ring-gratitude"
} as const;

function expectDimensionRing(label: string) {
  expect(within(getDimensionBar()).getByTestId(dimensionRingTestIds[label as keyof typeof dimensionRingTestIds])).toBeInTheDocument();
}

function expectSelectedProgressValue(value: string) {
  expect(within(getDimensionBar()).getByTestId("selected-dimension-progress-value")).toHaveTextContent(value);
}

function expectSelectedProgressHidden() {
  expect(within(getDimensionBar()).queryByTestId("selected-dimension-progress")).not.toBeInTheDocument();
}

describe("InterviewShell", () => {
  beforeEach(() => {
    useInterviewStore.getState().reset("joy");
    window.localStorage.clear();
    mockPathname.value = "/interview";
    mockRouterPush.mockReset();
    mockRouterReplace.mockReset();
    mockSearchParams.value = {
      dimension: "joy",
      entryDate: null,
      mode: null,
      panel: null,
      sessionId: null
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/calendar/day?")) {
        return new Response(JSON.stringify(buildHeaderDayRecord()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        const body = init?.body ? (JSON.parse(String(init.body)) as { dimension?: InterviewSessionRecord["dimension"] }) : {};
        const requestedDimension = body.dimension ?? "joy";
        const session = buildSession({
          id: requestedDimension === "joy" ? "session-joy" : `session-${requestedDimension}`,
          dimension: requestedDimension
        });

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

      if (url.startsWith("/api/daily-journal?")) {
        return new Response(
          JSON.stringify({
            dailyJournal: baseDailyJournalEntry,
            availableSourceCount: 1,
            sources: baseDailyJournalSources,
            state: "draft"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/daily-journal/") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as Pick<DailyJournalEntryRecord, "title" | "content">;

        return new Response(
          JSON.stringify({
            dailyJournal: {
              ...baseDailyJournalEntry,
              ...body,
              updatedAt: "2026-04-21T00:10:00.000Z"
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if ((url.includes("/api/journal-entry/") || url.includes("/api/joy-entry/")) && init?.method === "PUT") {
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
                entryDate: "2026-04-21",
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
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    await waitFor(() => {
      expect(screen.getByText("有效 2 轮")).toBeInTheDocument();
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
    expect(within(getDimensionButton("开心")).queryByText("有效 2 轮")).not.toBeInTheDocument();
    expectDimensionRing("开心");
    expectSelectedProgressValue("有效 2 轮");
    expectDimensionStatus("充实", "未开始");
    expectDimensionStatus("思考", "未开始");
    expectDimensionStatus("改进", "未开始");
    expectDimensionStatus("感谢", "未开始");
    expect(screen.getByTestId("interview-floating-composer")).toContainElement(screen.getByRole("textbox"));
    expect(screen.queryByTestId("interview-top-bar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "暂停访谈" })).not.toBeInTheDocument();
  });

  it("labels the selected count as effective rounds instead of transcript message count", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    expect(await screen.findByText("有效 2 轮")).toBeInTheDocument();
    expect(screen.queryByText("有效 3 轮")).not.toBeInTheDocument();
    expect(screen.queryByText("第 2 轮")).not.toBeInTheDocument();
  });

  it("clears the current dimension conversation and starts a fresh session", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    const freshSession = buildSession({
      id: "session-fresh",
      status: "active",
      stage: "collect_event",
      turnCount: 0,
      lastAssistantQuestion: "今天有没有一个哪怕很小、但确实让你状态变好一点的开心片段？先讲那个瞬间。",
      messages: [
        {
          id: "assistant-fresh",
          role: "assistant",
          content: "今天有没有一个哪怕很小、但确实让你状态变好一点的开心片段？先讲那个瞬间。",
          assistantPayload: buildAssistantPayload({
            question: "今天有没有一个哪怕很小、但确实让你状态变好一点的开心片段？先讲那个瞬间。"
          }),
          sequence: 0,
          createdAt: "2026-04-21T00:10:00.000Z"
        }
      ],
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
          id: "event-fresh",
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
          startedAt: "2026-04-21T00:10:00.000Z",
          completedAt: null
        }
      ],
      pendingDecision: null,
      journalEntry: null,
      draftGenerationUnlocked: false
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-ready")) {
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

      if (url.endsWith("/api/interview/session/start")) {
        return new Response(JSON.stringify({ session: freshSession, sessionId: freshSession.id, openingQuestion: freshSession.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderInterviewPage();

    await screen.findByText("有效 2 轮");
    expect(screen.getByText("我已经抓到这段开心的重点了。现在要不要帮你整理成日志？")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除对话记录" }));

    expect(await screen.findByText("今天有没有一个哪怕很小、但确实让你状态变好一点的开心片段？先讲那个瞬间。")).toBeInTheDocument();
    expect(screen.queryByText("有效 2 轮")).not.toBeInTheDocument();
    expect(screen.queryByText("我已经抓到这段开心的重点了。现在要不要帮你整理成日志？")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成日志" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(interviewSessionStorageKey) ?? "{}")).toMatchObject({
      joy: expect.objectContaining({
        sessionId: "session-fresh"
      })
    });
  });

  it("renders structured assistant messages as separate summary and question bubbles", async () => {
    cacheInterviewSessions({ joy: "session-structured" });

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
            insight: "",
            thinkingSummary: "今天这段轻松感已经有轮廓了。",
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
    expect(screen.getByText("今天这段轻松感已经有轮廓了。").closest("[data-message-variant]")).toHaveAttribute(
      "data-message-variant",
      "thinking"
    );
    expect(screen.getByText("那一刻为什么会让你这么放松？").closest("[data-message-variant]")).toHaveAttribute(
      "data-message-variant",
      "question"
    );
  });

  it("shows choice actions and sends the continue action without creating an optimistic user bubble", async () => {
    cacheInterviewSessions({ joy: "session-choice" });

    const choicePayload = buildAssistantPayload({
      insight: "我们已经抓到和家人一起吃饭这个片段，但还差一点更深的展开。",
      question: "",
      stateUpdate: {
        turnPhase: "choice",
        shouldEndDimension: false,
        offerChoice: true,
        choiceKind: "event_complete",
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
      insight: "",
      thinkingSummary: "你已经抓到那种松下来的感觉了，所以想顺着它继续确认，到底是什么在当时特别打动你。",
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
          'event: phase\ndata: {"state":"summary"}\n\n',
          `event: delta\ndata: ${JSON.stringify({ target: "summary", text: continuedPayload.thinkingSummary })}\n\n`,
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

    expect(await screen.findByRole("button", { name: "继续深聊" })).toBeInTheDocument();
    expect(screen.queryByText(choicePayload.insight)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续深聊" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "聊下一件开心的事" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "现在整理日志" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成日志" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "继续深聊" }));

    await waitFor(() => {
      expect(screen.queryByText(choicePayload.insight)).not.toBeInTheDocument();
    });
    expect(await screen.findByText(continuedPayload.thinkingSummary)).toBeInTheDocument();
    expect(await screen.findByText(continuedPayload.question)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByText("正在思考中...")).not.toBeInTheDocument();
    expect(screen.queryByText("继续深聊")).not.toBeInTheDocument();
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

  it("preserves historical choice turns in restored transcripts when no live choice card is showing", async () => {
    cacheInterviewSessions({ joy: "session-choice-history" });

    const historicalChoicePayload = buildAssistantPayload({
      insight: "这段收尾我当时已经帮你停在当前理解，没有再继续追问。",
      question: "",
      stateUpdate: {
        turnPhase: "choice",
        shouldEndDimension: false,
        offerChoice: true,
        choiceKind: "event_complete",
        choiceReason: "当时已经进入收束选择。"
      },
      meta: {
        depthReached: ["event", "reason"]
      }
    });
    const completedSession = buildSession({
      id: "session-choice-history",
      status: "completed",
      stage: "finalize",
      messages: [
        {
          id: "assistant-choice-history",
          role: "assistant",
          content: JSON.stringify(historicalChoicePayload),
          assistantPayload: historicalChoicePayload,
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ],
      lastAssistantQuestion: "",
      pendingDecision: null
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/calendar/day?")) {
        return new Response(JSON.stringify(buildHeaderDayRecord()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/session-choice-history")) {
        return new Response(JSON.stringify(completedSession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        return new Response(JSON.stringify({ session: buildSession() }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    expect(await screen.findByText("这段收尾我当时已经帮你停在当前理解，没有再继续追问。")).toBeInTheDocument();
  });

  it("keeps earlier handled choice turns hidden when a later live choice card is active", async () => {
    cacheInterviewSessions({ joy: "session-choice-multi" });

    const olderChoicePayload = buildAssistantPayload({
      insight: "第一段开心已经先停在当前理解了。",
      question: "",
      stateUpdate: {
        turnPhase: "choice",
        shouldEndDimension: false,
        offerChoice: true,
        choiceKind: "event_complete",
        choiceReason: "第一段已经收束。"
      },
      meta: {
        depthReached: ["event"]
      }
    });
    const currentChoicePayload = buildAssistantPayload({
      insight: "第二段也已经聊到一个可以先收住的位置。",
      question: "",
      stateUpdate: {
        turnPhase: "choice",
        shouldEndDimension: false,
        offerChoice: true,
        choiceKind: "event_complete",
        choiceReason: "第二段也进入收束选择。"
      },
      meta: {
        depthReached: ["event", "reason"]
      }
    });
    const multiChoiceSession = buildSession({
      id: "session-choice-multi",
      status: "active",
      stage: "wrap_up",
      turnCount: 2,
      messages: [
        {
          id: "assistant-choice-old",
          role: "assistant",
          content: JSON.stringify(olderChoicePayload),
          assistantPayload: olderChoicePayload,
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        },
        {
          id: "assistant-follow-up",
          role: "assistant",
          content: "后来你又补充了第二个片段。",
          sequence: 1,
          createdAt: "2026-04-21T00:01:00.000Z"
        },
        {
          id: "user-next-event",
          role: "user",
          content: "后来还有第二件开心的事。",
          sequence: 2,
          createdAt: "2026-04-21T00:02:00.000Z"
        },
        {
          id: "assistant-choice-current",
          role: "assistant",
          content: JSON.stringify(currentChoicePayload),
          assistantPayload: currentChoicePayload,
          sequence: 3,
          createdAt: "2026-04-21T00:03:00.000Z"
        }
      ],
      lastAssistantQuestion: "",
      pendingDecision: {
        kind: "event_complete",
        eventId: "event-2",
        eventSequence: 2,
        actions: ["continue_current_event", "next_event", "generate_draft"]
      }
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/calendar/day?")) {
        return new Response(JSON.stringify(buildHeaderDayRecord()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/session-choice-multi")) {
        return new Response(JSON.stringify(multiChoiceSession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        return new Response(JSON.stringify({ session: buildSession() }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    expect(await screen.findByText("后来你又补充了第二个片段。")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("第一段开心已经先停在当前理解了。")).not.toBeInTheDocument();
    expect(screen.queryByText("第二段也已经聊到一个可以先收住的位置。")).not.toBeInTheDocument();
  });

  it("keeps entryDate when a dimension redirect sends the user into another interview dimension", async () => {
    mockSearchParams.value.entryDate = "2026-04-21";
    cacheInterviewSessions({ joy: "session-choice-redirect" });

    const redirectPayload = buildAssistantPayload({
      insight: "这一轮还没有形成可信的开心片段，继续停在这里容易变成硬找开心。",
      question: "",
      stateUpdate: {
        turnPhase: "choice",
        shouldEndDimension: false,
        offerChoice: true,
        choiceKind: "dimension_redirect",
        choiceReason: "当前材料更接近改进维度。"
      },
      meta: {
        depthReached: ["event"]
      }
    });
    const redirectSession = buildSession({
      id: "session-choice-redirect",
      entryDate: "2026-04-21",
      status: "active",
      stage: "wrap_up",
      messages: [
        {
          id: "assistant-redirect",
          role: "assistant",
          content: JSON.stringify(redirectPayload),
          assistantPayload: redirectPayload,
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ],
      lastAssistantQuestion: "",
      pendingDecision: {
        kind: "dimension_redirect",
        eventId: "event-1",
        eventSequence: 1,
        targetDimension: "improvement",
        reason: "这一轮还没有形成可信的开心片段，继续停在这里容易变成硬找开心。",
        actions: ["continue_current_event", "switch_dimension"]
      }
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/calendar/day?")) {
        return new Response(JSON.stringify(buildHeaderDayRecord()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/session-choice-redirect")) {
        return new Response(JSON.stringify(redirectSession), {
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "转去聊改进" }));

    expect(mockRouterPush).toHaveBeenCalledWith("/interview?dimension=improvement&entryDate=2026-04-21", { scroll: false });
  });

  it("keeps auto-scroll inside the interview message panel instead of using scrollIntoView", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

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
      expect(screen.getByText("有效 2 轮")).toBeInTheDocument();
    });
    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it("shows a partial-draft choice card when joy is ready to stop without a stable personal rule", async () => {
    cacheInterviewSessions({ joy: "session-choice-partial" });

    const partialChoicePayload = buildAssistantPayload({
      insight: "这段开心的核心已经清楚了，如果你现在不想继续往下提炼，也可以先按当前理解整理。",
      question: "",
      stateUpdate: {
        turnPhase: "choice",
        shouldEndDimension: false,
        offerChoice: true,
        choiceKind: "event_complete",
        choiceReason: "当前事件已经补到新的角度；如果用户不想继续提炼规律，也可以先整理成当前版本日志。"
      },
      meta: {
        depthReached: ["event", "reason", "clue"]
      }
    });
    const partialChoiceSession = buildSession({
      id: "session-choice-partial",
      status: "active",
      stage: "wrap_up",
      turnCount: 3,
      lastAssistantQuestion: "",
      pendingDecision: {
        kind: "event_complete",
        eventId: "event-1",
        eventSequence: 1,
        completionMode: "user_override_partial",
        actions: ["continue_current_event", "next_event", "generate_draft"]
      },
      messages: [
        {
          id: "assistant-choice-partial",
          role: "assistant",
          content: JSON.stringify(partialChoicePayload),
          assistantPayload: partialChoicePayload,
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ],
      snapshot: {
        ...baseSnapshot,
        selfPattern: null,
        joyMoment: "今天和家人一起吃饭聊天",
        joySource: "重新回到被陪伴接住的轻松里",
        stateShift: "更轻松",
        meaningNeed: "我在乎稳定的关系连接",
        manualClue: null,
        missingSlots: ["manualClue"]
      },
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "ready_for_choice",
          stage: "wrap_up",
          explorationRound: 1,
          coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
          roundMeaningfulReplyCount: 3,
          totalMeaningfulReplyCount: 3,
          startMessageSequence: 0,
          snapshot: {
            ...baseSnapshot,
            selfPattern: null,
            joyMoment: "今天和家人一起吃饭聊天",
            joySource: "重新回到被陪伴接住的轻松里",
            stateShift: "更轻松",
            meaningNeed: "我在乎稳定的关系连接",
            manualClue: null,
            missingSlots: ["manualClue"]
          },
          draftSummary: null,
          startedAt: "2026-04-21T00:00:00.000Z",
          completedAt: null
        }
      ]
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-choice-partial")) {
        return new Response(JSON.stringify(partialChoiceSession), {
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

    expect(await screen.findByRole("button", { name: "继续深聊" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "先整理当前日志" })).toBeInTheDocument();
    expect(
      screen.getByText("我觉得这段开心已经够按当前理解整理成一篇日志了。你可以继续深聊当前这件事，也可以切到今天的下一件开心事件。")
    ).toBeInTheDocument();
  });

  it("shows boundary insufficient actions and pauses through the existing pause endpoint", async () => {
    cacheInterviewSessions({ joy: "session-boundary" });
    const boundarySession = buildSession({
      id: "session-boundary",
      status: "active",
      stage: "wrap_up",
      turnCount: 1,
      lastAssistantQuestion: "",
      pendingDecision: {
        kind: "boundary_insufficient",
        eventId: "event-1",
        eventSequence: 1,
        reason: "我不再继续追问细节了。",
        actions: ["continue_current_event", "next_event", "pause_session"]
      },
      messages: [
        {
          id: "assistant-boundary",
          role: "assistant",
          content: "我不再继续追问细节了。",
          assistantPayload: buildAssistantPayload({
            insight: "我不再继续追问细节了。",
            question: "如果还愿意补一句，只说这个片段最关键的一点就够了。",
            stateUpdate: {
              turnPhase: "choice",
              shouldEndDimension: false,
              offerChoice: true,
              choiceKind: "boundary_insufficient",
              choiceReason: "用户表达了停止边界，但当前材料不足以直接整理成日志。"
            }
          }),
          sequence: 0,
          createdAt: "2026-04-21T00:00:00.000Z"
        }
      ]
    });
    const pausedSession = {
      ...boundarySession,
      status: "paused" as const,
      pausedAt: "2026-04-21T00:04:00.000Z"
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-boundary")) {
        return new Response(JSON.stringify(boundarySession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/pause")) {
        return new Response(JSON.stringify({ session: pausedSession }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    expect(await screen.findByRole("button", { name: "只补一句" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "换一个片段" })).toBeInTheDocument();
    const pauseButton = screen.getByRole("button", { name: "先退出" });
    expect(pauseButton).toBeInTheDocument();

    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/interview/session/pause",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ sessionId: "session-boundary" })
        })
      );
    });
    await waitFor(() => {
      expect(useInterviewStore.getState().status).toBe("paused");
    });
  });

  it("keeps structured clues hidden during the interview before a journal is generated", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    await screen.findByText("有效 2 轮");

    expect(screen.queryByText("结构化线索")).not.toBeInTheDocument();
    expect(screen.queryByText("开心片段")).not.toBeInTheDocument();
    expect(screen.queryByText("使用说明书线索")).not.toBeInTheDocument();
  });

  it("opens the writing workspace and shows the generated journal after clicking the top generate button", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    expect(screen.queryByText("结构化线索")).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));

    expect(await screen.findByTestId("journal-editor-card")).toBeInTheDocument();
    expect(screen.queryByText("结构化线索")).not.toBeInTheDocument();
    expect(screen.queryByText("开心片段")).not.toBeInTheDocument();
    expect(screen.queryByText("使用说明书线索")).not.toBeInTheDocument();
    const editorCard = screen.getByTestId("journal-editor-card");
    expect(within(editorCard).getByDisplayValue(baseJournalEntry.title)).toBeInTheDocument();
    expect((within(editorCard).getByPlaceholderText(journalBodyPlaceholder) as HTMLTextAreaElement).value).toBe(baseJournalEntry.content);
    expect(within(editorCard).getByRole("button", { name: "保存正式日志" })).toBeInTheDocument();
    expect(screen.queryByText("当前可以生成日志，也可以继续访谈")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成最新日志" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "暂停访谈" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭日志面板" })).toBeInTheDocument();
  });

  it("switches the main workspace to the daily journal from the top log button", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    await screen.findByText("有效 2 轮");
    fireEvent.click(within(getDimensionBar()).getByRole("button", { name: "查看汇总当天日志" }));

    expect(await screen.findByTestId("daily-journal-workspace")).toBeInTheDocument();
    expect(await screen.findByTestId("daily-journal-editor")).toBeInTheDocument();
    expect(screen.getByDisplayValue(baseDailyJournalEntry.title)).toBeInTheDocument();
    expect((screen.getByPlaceholderText("当天日志正文会出现在这里。") as HTMLTextAreaElement).value).toBe(baseDailyJournalEntry.content);
    expect(global.fetch).toHaveBeenCalledWith(`/api/daily-journal?date=${defaultEntryDate()}`, expect.objectContaining({ cache: "no-store" }));
  });

  it("shows the tree growth loader while opening the complete journal workspace", async () => {
    cacheInterviewSessions({ joy: "session-ready" });
    const dailyJournalResponse = createDeferredResponse();
    const defaultFetch = vi.mocked(global.fetch).getMockImplementation();

    vi.mocked(global.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("/api/daily-journal?")) {
        return dailyJournalResponse.promise;
      }

      return defaultFetch!(input, init);
    });

    renderInterviewPage();

    await screen.findByText("有效 2 轮");
    fireEvent.click(within(getDimensionBar()).getByRole("button", { name: "查看汇总当天日志" }));

    expect(await screen.findByText("正在打开汇总当天日志")).toBeInTheDocument();
    expect(screen.getByTestId("journal-growth-tree")).toBeInTheDocument();

    dailyJournalResponse.resolve(
      new Response(
        JSON.stringify({
          dailyJournal: baseDailyJournalEntry,
          availableSourceCount: 1,
          sources: baseDailyJournalSources,
          state: "draft"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    expect(await screen.findByTestId("daily-journal-editor")).toBeInTheDocument();
  });

  it("opens daily-journal deep links without booting a new interview session", async () => {
    mockSearchParams.value = {
      dimension: "joy",
      entryDate: "2026-05-01",
      mode: "daily-journal",
      panel: null,
      sessionId: null
    };

    renderInterviewPage();

    expect(await screen.findByTestId("daily-journal-workspace")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/daily-journal?date=2026-05-01", expect.objectContaining({ cache: "no-store" }));
    expect(vi.mocked(global.fetch).mock.calls.some(([input]) => String(input).endsWith("/api/interview/session/start"))).toBe(false);
  });

  it("removes daily-journal mode when returning from a daily journal deep link", async () => {
    mockSearchParams.value = {
      dimension: "joy",
      entryDate: "2026-05-01",
      mode: "daily-journal",
      panel: null,
      sessionId: null
    };

    renderInterviewPage();

    expect(await screen.findByTestId("daily-journal-workspace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "回到访谈" }));

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/interview?dimension=joy&entryDate=2026-05-01", {
        scroll: false
      });
    });
  });

  it("persists unsaved daily journal edits before returning to the interview workspace", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    await screen.findByText("有效 2 轮");
    fireEvent.click(within(getDimensionBar()).getByRole("button", { name: "查看汇总当天日志" }));

    const editor = await screen.findByTestId("daily-journal-editor");
    const bodyTextarea = within(editor).getByPlaceholderText("当天日志正文会出现在这里。") as HTMLTextAreaElement;
    const editedContent = `${baseDailyJournalEntry.content}\n\n补上一句还没等自动保存的内容。`;

    fireEvent.change(bodyTextarea, {
      target: { value: editedContent }
    });
    fireEvent.click(screen.getByRole("button", { name: "回到访谈" }));

    await waitFor(() => {
      expect(screen.queryByTestId("daily-journal-workspace")).not.toBeInTheDocument();
    });

    const dailyJournalPutCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([input, nextInit]) => String(input).includes("/api/daily-journal/daily-1") && nextInit?.method === "PUT"
    );

    expect(dailyJournalPutCalls).toHaveLength(1);
    expect(JSON.parse(String(dailyJournalPutCalls[0][1]?.body))).toMatchObject({
      content: editedContent
    });
  });

  it("returns to the interview workspace when the dimension changes from the daily journal workspace", async () => {
    cacheInterviewSessions({ joy: "session-ready" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const dailyJournalPutResponse = createDeferredResponse();
    const defaultFetch = vi.mocked(global.fetch).getMockImplementation();

    vi.mocked(global.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/daily-journal/daily-1") && init?.method === "PUT") {
        return dailyJournalPutResponse.promise;
      }

      return defaultFetch!(input, init);
    });

    const view = renderInterviewPage();

    await screen.findByText("有效 2 轮");
    fireEvent.click(within(getDimensionBar()).getByRole("button", { name: "查看汇总当天日志" }));
    expect(await screen.findByTestId("daily-journal-workspace")).toBeInTheDocument();

    const editor = await screen.findByTestId("daily-journal-editor");
    const bodyTextarea = within(editor).getByPlaceholderText("当天日志正文会出现在这里。") as HTMLTextAreaElement;
    const editedContent = `${baseDailyJournalEntry.content}\n\n准备切去充实维度前补一行。`;

    fireEvent.change(bodyTextarea, {
      target: { value: editedContent }
    });
    fireEvent.click(getDimensionButton("充实"));

    expect(await screen.findByTestId("workspace-transition-card")).toBeInTheDocument();
    expect(screen.getByText("正在切换到充实")).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();

    dailyJournalPutResponse.resolve(
      new Response(
        JSON.stringify({
          dailyJournal: {
            ...baseDailyJournalEntry,
            content: editedContent,
            updatedAt: "2026-04-21T00:10:00.000Z"
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/interview?dimension=fulfillment&entryDate=${defaultEntryDate()}`, { scroll: false });
    });

    mockSearchParams.value = {
      ...mockSearchParams.value,
      dimension: "fulfillment",
      mode: null
    };
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    await waitFor(() => {
      expect(screen.queryByTestId("daily-journal-workspace")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("interview-message-scroll")).toBeInTheDocument();
  });

  it("allows returning from the daily journal workspace by clicking the current dimension pill", async () => {
    cacheInterviewSessions({ joy: "session-ready" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const view = renderInterviewPage();

    await screen.findByText("有效 2 轮");
    fireEvent.click(within(getDimensionBar()).getByRole("button", { name: "查看汇总当天日志" }));
    expect(await screen.findByTestId("daily-journal-workspace")).toBeInTheDocument();

    fireEvent.click(getDimensionButton("开心"));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/interview?dimension=joy&entryDate=${defaultEntryDate()}`, { scroll: false });
    });

    mockSearchParams.value = {
      ...mockSearchParams.value,
      dimension: "joy",
      mode: null
    };
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    await waitFor(() => {
      expect(screen.queryByTestId("daily-journal-workspace")).not.toBeInTheDocument();
    });
  });

  it("does not get stuck on the same target dimension after a failed daily-journal flush", async () => {
    cacheInterviewSessions({ joy: "session-ready" });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderInterviewPage();

    await screen.findByText("有效 2 轮");
    fireEvent.click(within(getDimensionBar()).getByRole("button", { name: "查看汇总当天日志" }));

    const editor = await screen.findByTestId("daily-journal-editor");
    const bodyTextarea = within(editor).getByPlaceholderText("当天日志正文会出现在这里。") as HTMLTextAreaElement;

    fireEvent.change(bodyTextarea, {
      target: { value: "" }
    });
    fireEvent.click(getDimensionButton("感谢"));

    await waitFor(() => {
      expect(screen.getByText("当天日志标题和正文不能为空。")).toBeInTheDocument();
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(screen.getByTestId("daily-journal-workspace")).toBeInTheDocument();

    fireEvent.change(bodyTextarea, {
      target: { value: `${baseDailyJournalEntry.content}\n\n修好后切去感谢维度。` }
    });
    fireEvent.click(getDimensionButton("感谢"));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/interview?dimension=gratitude&entryDate=${defaultEntryDate()}`, { scroll: false });
    });
  });

  it("persists unsaved dimension journal edits before switching to the daily journal workspace", async () => {
    cacheInterviewSessions({ joy: "session-ready" });
    const draftPutResponse = createDeferredResponse();
    const defaultFetch = vi.mocked(global.fetch).getMockImplementation();

    vi.mocked(global.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if ((url.includes("/api/journal-entry/") || url.includes("/api/joy-entry/")) && init?.method === "PUT") {
        return draftPutResponse.promise;
      }

      return defaultFetch!(input, init);
    });

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));
    const editorCard = await screen.findByTestId("journal-editor-card");
    const titleInput = within(editorCard).getByDisplayValue(baseJournalEntry.title);
    fireEvent.change(titleInput, {
      target: { value: "编辑后的标题" }
    });

    fireEvent.click(within(getDimensionBar()).getByRole("button", { name: "查看汇总当天日志" }));

    expect(await screen.findByTestId("workspace-transition-card")).toBeInTheDocument();
    expect(screen.getByText("正在打开汇总当天日志")).toBeInTheDocument();
    expect(screen.queryByTestId("daily-journal-workspace")).not.toBeInTheDocument();

    draftPutResponse.resolve(
      new Response(
        JSON.stringify({
          ...baseJournalEntry,
          title: "编辑后的标题",
          status: "draft",
          source: "ai_draft_edited",
          updatedAt: "2026-04-21T00:09:00.000Z",
          savedAt: null
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    expect(await screen.findByTestId("daily-journal-workspace")).toBeInTheDocument();

    const putCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([input, nextInit]) =>
        (String(input).includes("/api/journal-entry/") || String(input).includes("/api/joy-entry/")) &&
        nextInit?.method === "PUT"
    );

    expect(putCalls).toHaveLength(1);
    expect(JSON.parse(String(putCalls[0][1]?.body))).toMatchObject({
      title: "编辑后的标题"
    });
  });

  it("auto sizes the journal body and keeps the editor inside a single card", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));

    const editorCard = await screen.findByTestId("journal-editor-card");
    const titleInput = within(editorCard).getByDisplayValue(baseJournalEntry.title) as HTMLInputElement;
    const bodyTextarea = within(editorCard).getByPlaceholderText(journalBodyPlaceholder) as HTMLTextAreaElement;
    const saveButton = within(editorCard).getByRole("button", { name: "保存正式日志" });

    expect(titleInput).toBeInTheDocument();
    expect(bodyTextarea.value).toBe(baseJournalEntry.content);
    expect(saveButton).toBeInTheDocument();
    await waitFor(() => {
      expect(bodyTextarea.style.height).toBe("240px");
    });

    Object.defineProperty(bodyTextarea, "scrollHeight", {
      configurable: true,
      value: 420
    });
    fireEvent.change(bodyTextarea, {
      target: {
        value: `${baseJournalEntry.content}\n\n新的补充段落：这次我想把那种被接住的感觉再写完整一点。`
      }
    });

    await waitFor(() => {
      expect(bodyTextarea.style.height).toBe("420px");
    });
  });

  it("keeps the journal title single-line and capped at 16 characters", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));

    const editorCard = await screen.findByTestId("journal-editor-card");
    const titleInput = within(editorCard).getByDisplayValue(baseJournalEntry.title) as HTMLInputElement;

    expect(titleInput.maxLength).toBe(16);
    expect(titleInput.className).toContain("whitespace-nowrap");
    expect(titleInput.className).toContain("overflow-hidden");
  });

  it("re-enables choice actions when the user closes the draft panel while generation is still running", async () => {
    cacheInterviewSessions({ joy: "session-choice-generate" });

    const choicePayload = buildAssistantPayload({
      insight: "这一段已经聊得比较完整了。",
      question: "",
      stateUpdate: {
        turnPhase: "choice",
        shouldEndDimension: false,
        offerChoice: true,
        choiceKind: "event_complete",
        choiceReason: "当前信息已经足够，直接让用户决定继续聊还是现在整理。"
      },
      meta: {
        depthReached: ["event", "reason", "clue", "pattern"]
      }
    });
    const choiceSession = buildSession({
      id: "session-choice-generate",
      status: "active",
      stage: "wrap_up",
      turnCount: 2,
      lastAssistantQuestion: "",
      pendingDecision: {
        kind: "event_complete",
        eventId: "event-1",
        eventSequence: 1,
        actions: ["continue_current_event", "next_event", "generate_draft"]
      },
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
      events: [
        {
          id: "event-1",
          sequence: 1,
          status: "ready_for_choice",
          stage: "wrap_up",
          explorationRound: 1,
          coveredLenses: ["event_detail", "importance_reason", "meaning_pattern", "self_pattern"],
          roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern", "self_pattern"],
          roundMeaningfulReplyCount: 4,
          totalMeaningfulReplyCount: 4,
          startMessageSequence: 0,
          snapshot: {
            ...baseSnapshot,
            joyMoment: "今天和家人一起吃饭聊天",
            joySource: "被家人的陪伴接住了",
            stateShift: "更轻松",
            meaningNeed: "我需要稳定的陪伴感和关系连接",
            manualClue: "当我和熟悉的人慢下来相处时，我会恢复能量",
            missingSlots: []
          },
          draftSummary: null,
          startedAt: "2026-04-21T00:00:00.000Z",
          completedAt: null
        }
      ],
      snapshot: {
        ...baseSnapshot,
        joyMoment: "今天和家人一起吃饭聊天",
        joySource: "被家人的陪伴接住了",
        stateShift: "更轻松",
        meaningNeed: "我需要稳定的陪伴感和关系连接",
        manualClue: "当我和熟悉的人慢下来相处时，我会恢复能量",
        missingSlots: []
      }
    });

    let draftGenerateAborted = false;

    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-choice-generate")) {
        return Promise.resolve(
          new Response(JSON.stringify(choiceSession), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        const signal = init?.signal as AbortSignal | undefined;

        return new Promise<Response>((resolve, reject) => {
          const onAbort = () => {
            draftGenerateAborted = true;
            reject(new DOMException("The user aborted a request.", "AbortError"));
          };

          signal?.addEventListener("abort", onAbort, { once: true });
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession();

        return Promise.resolve(
          new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    expect(await screen.findByRole("button", { name: "现在整理日志" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "现在整理日志" }));

    expect(await screen.findByText("正在生成日志骨架")).toBeInTheDocument();
    expect(screen.getByTestId("journal-growth-tree")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭日志面板" }));

    await waitFor(() => {
      expect(screen.queryByText("正在生成日志骨架")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "继续深聊" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "聊下一件开心的事" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "现在整理日志" })).toBeEnabled();
    });

    expect(draftGenerateAborted).toBe(true);
  });

  it("automatically reopens legacy paused sessions during restore", async () => {
    mockSearchParams.value = {
      dimension: "joy",
      entryDate: "2026-04-21",
      mode: null,
      panel: null,
      sessionId: null
    };
    window.localStorage.setItem(interviewSessionStorageKey, JSON.stringify({ joy: "session-with-journal" }));

    renderInterviewPage();

    expect(await screen.findByRole("textbox")).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/reopen",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(screen.queryByText("本轮访谈已暂停")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成日志" })).toBeInTheDocument();
  });

  it("starts a fresh session instead of restoring a cached session from another entryDate on plain interview", async () => {
    cacheInterviewSessions({
      joy: buildStoredSessionCacheEntry("session-ready", "1999-01-01")
    });

    renderInterviewPage();

    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    expect(screen.getByTestId("interview-entry-date-label")).toHaveTextContent(/^当前记录日期：/);
    expect(vi.mocked(global.fetch).mock.calls.some(([input]) => String(input).endsWith("/api/interview/session/session-ready"))).toBe(false);
    expect(vi.mocked(global.fetch).mock.calls.some(([input]) => String(input).endsWith("/api/interview/session/start"))).toBe(true);
  });

  it("starts a fresh session instead of reusing an already hydrated session from another day on plain interview", async () => {
    useInterviewStore.getState().hydrate(
      buildSession({
        id: "session-reflection-yesterday",
        dimension: "reflection",
        entryDate: "1999-01-01",
        messages: promptMessages
      })
    );
    mockSearchParams.value.dimension = "reflection";

    renderInterviewPage();

    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    expect(vi.mocked(global.fetch).mock.calls.some(([input]) => String(input).endsWith("/api/interview/session/start"))).toBe(true);
    expect(useInterviewStore.getState().sessionId).toBe("session-reflection");
    expect(useInterviewStore.getState().sessionEntryDate).toBe(defaultEntryDate());
  });

  it("uses the current entryDate day record for dimension labels instead of cross-day cached sessions", async () => {
    mockSearchParams.value.entryDate = "2026-05-01";
    window.localStorage.setItem(
      interviewSessionStorageKey,
      JSON.stringify({
        joy: "session-joy-other-day",
        fulfillment: "session-fulfillment-other-day",
        reflection: "session-reflection-other-day",
        improvement: "session-improvement-other-day",
        gratitude: "session-gratitude-other-day"
      })
    );

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/calendar/day?date=2026-05-01") {
        return new Response(JSON.stringify(buildHeaderDayRecord()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession({
          entryDate: "2026-05-01",
          status: "active",
          stage: "wrap_up",
          turnCount: 2,
          messages: promptMessages,
          snapshot: baseSnapshot
        });

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    await waitFor(() => {
      expect(within(getDimensionButton("开心")).queryByText("有效 2 轮")).not.toBeInTheDocument();
      expectDimensionStatus("充实", "已完成");
      expectDimensionStatus("思考", "已完成");
      expectDimensionStatus("改进", "已完成");
      expectDimensionStatus("感谢", "未开始");
    });

    expectDimensionRing("开心");
    expectSelectedProgressValue("有效 2 轮");
    expect(vi.mocked(global.fetch).mock.calls.some(([input]) => String(input) === "/api/calendar/day?date=2026-05-01")).toBe(true);
    expect(vi.mocked(global.fetch).mock.calls.some(([input]) => String(input).includes("/api/interview/session/session-gratitude-other-day"))).toBe(
      false
    );
  });

  it("keeps the selected dimension's live progress even when the interview URL includes entryDate", async () => {
    mockSearchParams.value.entryDate = "2026-05-01";

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/calendar/day?date=2026-05-01") {
        return new Response(JSON.stringify(buildHeaderDayRecord()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        const session = buildSession({
          entryDate: "2026-05-01",
          status: "active",
          stage: "wrap_up",
          turnCount: 2,
          messages: promptMessages,
          snapshot: baseSnapshot
        });

        return new Response(JSON.stringify({ session, sessionId: session.id, openingQuestion: session.lastAssistantQuestion }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    await waitFor(() => {
      expect(screen.getByText("有效 2 轮")).toBeInTheDocument();
    });

    expect(within(getDimensionButton("开心")).queryByText("有效 2 轮")).not.toBeInTheDocument();
    expectDimensionRing("开心");
    expectSelectedProgressValue("有效 2 轮");
    expectDimensionStatus("改进", "已完成");
    expectDimensionStatus("感谢", "未开始");
  });

  it("uses the session entryDate day record after switching into the daily journal workspace", async () => {
    mockSearchParams.value.entryDate = null;
    window.localStorage.setItem(
      interviewSessionStorageKey,
      JSON.stringify({
        joy: "session-joy-other-day",
        fulfillment: "session-fulfillment-other-day",
        reflection: "session-reflection-other-day",
        improvement: "session-improvement-other-day",
        gratitude: "session-gratitude-other-day"
      })
    );

    useInterviewStore.setState({
      dimension: "joy",
      sessionDimension: "joy",
      sessionEntryDate: "2026-05-01",
      sessionId: "session-joy-0501",
      status: "completed",
      workspaceMode: "daily_journal"
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/calendar/day?date=2026-05-01") {
        return new Response(JSON.stringify(buildHeaderDayRecord()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    cleanup();
    render(<SiteHeader />);

    await waitFor(() => {
      expectDimensionStatus("开心", "已完成");
      expectDimensionStatus("充实", "已完成");
      expectDimensionStatus("思考", "已完成");
      expectDimensionStatus("改进", "已完成");
      expectDimensionStatus("感谢", "未开始");
    });

    expect(within(getDimensionBar()).getByRole("button", { name: "查看汇总当天日志" })).toHaveAttribute("aria-pressed", "true");
    expect(getDimensionButton("开心")).toHaveAttribute("aria-pressed", "false");

    expect(vi.mocked(global.fetch).mock.calls.some(([input]) => String(input) === "/api/calendar/day?date=2026-05-01")).toBe(true);
  });

  it("reopens a saved journal workspace without exposing structured clues", async () => {
    cacheInterviewSessions({ joy: "session-with-journal" });

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-with-journal")) {
        return new Response(
          JSON.stringify(
            buildSession({
              id: "session-with-journal",
              status: "completed",
              stage: "finalize",
              turnCount: 4,
              messages: promptMessages,
              snapshot: baseSnapshot,
              completedAt: "2026-04-21T00:08:00.000Z",
              journalEntry: savedJournalEntry
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/interview/session/start")) {
        throw new Error("should not create a new session while a saved joy session is being restored");
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    }) as typeof fetch;

    renderInterviewPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "日志已保存，访谈已结束" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "打开日志" })).toBeInTheDocument();
    });
    expect(screen.queryByText("结构化线索")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "打开日志" }));

    expect(await screen.findByTestId("journal-editor-card")).toBeInTheDocument();
    expect(screen.queryByText("结构化线索")).not.toBeInTheDocument();
    expect(screen.queryByText("开心片段")).not.toBeInTheDocument();
    expect(screen.queryByText("使用说明书线索")).not.toBeInTheDocument();
  });

  it("keeps the top generate action available after new interview messages arrive without showing a stale warning", async () => {
    cacheInterviewSessions({ joy: "session-ready" });
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
        const session =
          draftGenerateCallCount >= 2
            ? updatedSession
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
            draftEntry: baseJournalEntry,
            session
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
          'event: phase\ndata: {"state":"summary"}\n\n',
          'event: delta\ndata: {"target":"summary","text":"这份被接住的感觉也很关键。"}\n\n',
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
    await screen.findByTestId("journal-editor-card");

    const textarea = screen.getByPlaceholderText(joyInputPlaceholder);
    fireEvent.change(textarea, { target: { value: "我还想补充，那一刻我也觉得被接住了。" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    await screen.findByText("这份被接住的感觉也很关键。");
    expect(draftGenerateCallCount).toBe(1);
    expect(screen.getByRole("button", { name: "生成日志" })).toBeInTheDocument();
    expect(screen.queryByText("正在生成日志骨架")).not.toBeInTheDocument();
  });

  it("regenerates the journal from the latest context only after the user clicks generate again", async () => {
    cacheInterviewSessions({ joy: "session-ready" });
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
      title: "和家人一起吃饭更新",
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

        if (draftGenerateCallCount === 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 80));
        }

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
          'event: phase\ndata: {"state":"summary"}\n\n',
          'event: delta\ndata: {"target":"summary","text":"这份被接住的感觉也很关键。"}\n\n',
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
    await screen.findByTestId("journal-editor-card");

    const textarea = screen.getByPlaceholderText(joyInputPlaceholder);
    fireEvent.change(textarea, { target: { value: "我还想补充，那一刻我也觉得被接住了。" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    expect(draftGenerateCallCount).toBe(1);
    await waitFor(() => {
      expect(getTopGenerateButton()).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成日志" }));

    await waitFor(() => {
      expect(draftGenerateCallCount).toBe(2);
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue(regeneratedEntry.title)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue(/我还想记下那种被接住的感觉/)).toBeInTheDocument();
    expect(getTopGenerateButton()).toBeEnabled();
  });

  it("does not repeat a separate generating badge inside the workspace while the top button is already busy", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

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

    expect(await screen.findByText("正在生成日志骨架")).toBeInTheDocument();
    expect(screen.queryByText(/^生成中$/)).not.toBeInTheDocument();
  });

  it("reuses the current draft immediately when it already covers the latest interview state", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));
    await screen.findByTestId("journal-editor-card");

    const generateCallsAfterFirstOpen = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
      String(url).endsWith("/api/interview/session/draft/generate")
    ).length;
    expect(generateCallsAfterFirstOpen).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "关闭日志面板" }));
    fireEvent.click(screen.getByRole("button", { name: "生成日志" }));

    await screen.findByTestId("journal-editor-card");
    expect(await screen.findByText("当前已经是最新版本")).toBeInTheDocument();

    const generateCallsAfterSecondOpen = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
      String(url).endsWith("/api/interview/session/draft/generate")
    ).length;
    expect(generateCallsAfterSecondOpen).toBe(1);
  });

  it("regenerates after restore when the saved draft is older than the restored interview turns", async () => {
    cacheInterviewSessions({ joy: "session-restored-stale" });

    const restoredSession = buildSession({
      id: "session-restored-stale",
      status: "active",
      stage: "wrap_up",
      turnCount: 3,
      messages: [
        ...promptMessages,
        {
          id: "user-3",
          role: "user",
          content: "我后来又想到，那种被家人接住的感觉特别重要。",
          sequence: 3,
          createdAt: "2026-04-21T00:09:00.000Z"
        },
        {
          id: "assistant-4",
          role: "assistant",
          content: "这个被接住的感觉值得写进去。",
          sequence: 4,
          createdAt: "2026-04-21T00:10:00.000Z"
        }
      ],
      snapshot: baseSnapshot,
      journalEntry: baseJournalEntry
    });
    const regeneratedEntry: JournalEntryRecord = {
      ...baseJournalEntry,
      title: "和家人一起吃饭聊天后补了一句",
      content: `${baseJournalEntry.content}\n我后来又想到，那种被家人接住的感觉特别重要。`,
      updatedAt: "2026-04-21T00:11:00.000Z"
    };
    let generateCalls = 0;

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/start")) {
        throw new Error("should restore the cached session instead of starting a new one");
      }

      if (url.endsWith("/api/interview/session/draft/generate")) {
        generateCalls += 1;

        return new Response(
          JSON.stringify({
            draftEntry: regeneratedEntry,
            session: {
              ...restoredSession,
              journalEntry: regeneratedEntry
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/interview/session/session-restored-stale")) {
        return new Response(JSON.stringify(restoredSession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));

    await waitFor(() => {
      expect(generateCalls).toBe(1);
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue(regeneratedEntry.title)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect((screen.getByPlaceholderText(journalBodyPlaceholder) as HTMLTextAreaElement).value).toContain(
        "那种被家人接住的感觉特别重要"
      );
    });
    expect(screen.queryByText("当前已经是最新版本")).not.toBeInTheDocument();
  });

  it("shows a retryable error state when draft generation fails", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

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

    expect(await screen.findByText("AI 暂时没能完成整理，请稍后重试。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试生成" })).toBeInTheDocument();
  });

  it("opens a confirmation dialog before the first formal save and lets the user continue the interview", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    renderInterviewPage();

    fireEvent.click(await screen.findByRole("button", { name: "生成日志" }));
    await screen.findByTestId("journal-editor-card");

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
    cacheInterviewSessions({ joy: "session-ready" });

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
    await screen.findByTestId("journal-editor-card");

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
    cacheInterviewSessions({ joy: "session-ready" });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);

    renderInterviewPage();

    await screen.findByText("有效 2 轮");

    fireEvent.click(screen.getByRole("button", { name: "思考" }));

    expect(confirmSpy).toHaveBeenCalledWith(interviewLeaveConfirmMessage);
    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "思考" }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/interview?dimension=reflection&entryDate=${defaultEntryDate()}`, { scroll: false });
    });

    const storedSessions = JSON.parse(window.localStorage.getItem(interviewSessionStorageKey) ?? "{}") as {
      joy?: { sessionId?: string; expiresAt?: string };
    };
    expect(storedSessions.joy?.sessionId).toBe("session-ready");
    expect(storedSessions.joy?.expiresAt).toEqual(expect.any(String));
  });

  it("only normalizes a missing interview dimension once instead of repeatedly replacing the route", async () => {
    mockSearchParams.value.dimension = null;
    window.localStorage.setItem("hs-last-interview-dimension", "fulfillment");

    cleanup();
    const view = render(<SiteHeader />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/interview?dimension=fulfillment", { scroll: false });
    });

    mockRouterReplace.mockClear();
    view.rerender(<SiteHeader />);

    await waitFor(() => {
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });

  it("does not force the route back to interview while the app is leaving the interview page", async () => {
    mockSearchParams.value.dimension = null;
    window.localStorage.setItem("hs-last-interview-dimension", "joy");

    cleanup();
    const view = render(<SiteHeader />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/interview?dimension=joy", { scroll: false });
    });

    mockRouterReplace.mockClear();
    mockPathname.value = "/";
    view.rerender(<SiteHeader />);

    await waitFor(() => {
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
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

    await screen.findByText("有效 2 轮");
    expect(getTopGenerateButton()).toBeInTheDocument();
    await waitFor(() => {
      expectDimensionRing("开心");
      expectSelectedProgressValue("有效 2 轮");
      expectDimensionStatus("充实", "进行中");
    });

    mockSearchParams.value.dimension = "fulfillment";
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    await screen.findByText("今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。");
    expect(screen.queryByRole("button", { name: "生成日志" })).not.toBeInTheDocument();

    mockSearchParams.value.dimension = "joy";
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    await screen.findByText("有效 2 轮");
    expect(getTopGenerateButton()).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith("/api/interview/session/session-ready", expect.objectContaining({ cache: "no-store" }));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/session-fulfillment",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("keeps the header stable while a cached session is restoring, then shows rounds after hydrate", async () => {
    window.localStorage.setItem(
      interviewSessionStorageKey,
      JSON.stringify({
        joy: { sessionId: "session-restoring", expiresAt: "2099-04-21T00:00:00.000Z" }
      })
    );

    const restoringSession = buildSession({
      id: "session-restoring",
      status: "active",
      stage: "wrap_up",
      turnCount: 10,
      messages: promptMessages,
      snapshot: baseSnapshot
    });

    let resolveSessionFetch: ((value: Response) => void) | null = null;

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-restoring")) {
        return new Promise<Response>((resolve) => {
          resolveSessionFetch = resolve;
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        throw new Error("should not create a new session while a cached session is restoring");
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    await waitFor(() => {
      expectDimensionStatus("开心", "未开始");
      expectSelectedProgressHidden();
    });
    expect(screen.getByText("我正在把你上一次停下来的访谈接回来。")).toBeInTheDocument();

    await act(async () => {
      resolveSessionFetch?.(
        new Response(JSON.stringify(restoringSession), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    });

    expect(await screen.findByText("有效 10 轮")).toBeInTheDocument();
    expectDimensionRing("开心");
    expectDimensionStatus("开心", "进行中");
    expectSelectedProgressValue("有效 10 轮");
  });

  it("keeps a completed target dimension stable while its session is restoring", async () => {
    window.localStorage.setItem(
      interviewSessionStorageKey,
      JSON.stringify({
        joy: { sessionId: "session-joy-completed", expiresAt: "2099-04-21T00:00:00.000Z" },
        fulfillment: { sessionId: "session-fulfillment-completed", expiresAt: "2099-04-21T00:00:00.000Z" }
      })
    );

    const joyCompletedSession = buildSession({
      id: "session-joy-completed",
      status: "completed",
      stage: "finalize",
      turnCount: 2,
      messages: promptMessages,
      snapshot: baseSnapshot,
      completedAt: "2026-04-21T00:08:00.000Z",
      journalEntry: {
        ...savedJournalEntry,
        linkedSessionIds: ["session-joy-completed"]
      }
    });
    const fulfillmentCompletedSession = buildSession({
      id: "session-fulfillment-completed",
      dimension: "fulfillment",
      status: "completed",
      stage: "finalize",
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
      snapshot: baseSnapshot,
      completedAt: "2026-04-21T00:09:00.000Z",
      journalEntry: {
        ...savedJournalEntry,
        id: "entry-fulfillment-saved",
        linkedSessionIds: ["session-fulfillment-completed"]
      }
    });

    const delayedFulfillmentResponses: Array<(value: Response) => void> = [];

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-joy-completed")) {
        return Promise.resolve(
          new Response(JSON.stringify(joyCompletedSession), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      if (url.endsWith("/api/interview/session/session-fulfillment-completed")) {
        if (mockSearchParams.value.dimension === "fulfillment") {
          return new Promise<Response>((resolve) => {
            delayedFulfillmentResponses.push(resolve);
          });
        }

        return Promise.resolve(
          new Response(JSON.stringify(fulfillmentCompletedSession), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      if (url.endsWith("/api/interview/session/start")) {
        throw new Error("should not create a new session while cached sessions are valid");
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    const view = renderInterviewPage();

    await waitFor(() => {
      expectDimensionStatus("开心", "已完成");
      expectDimensionStatus("充实", "已完成");
    });
    expectSelectedProgressHidden();

    mockSearchParams.value.dimension = "fulfillment";
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    await waitFor(() => {
      expect(delayedFulfillmentResponses.length).toBeGreaterThan(0);
      expectDimensionStatus("充实", "已完成");
    });
    expectSelectedProgressHidden();
    expect(within(getDimensionButton("充实")).queryByText("继续中")).not.toBeInTheDocument();
    expect(within(getDimensionButton("充实")).queryByText("有效 1 轮")).not.toBeInTheDocument();

    await act(async () => {
      delayedFulfillmentResponses.splice(0).forEach((resolve) => {
        resolve(
          new Response(JSON.stringify(fulfillmentCompletedSession), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      });
    });

    await waitFor(() => {
      expectDimensionStatus("充实", "已完成");
    });
    expectSelectedProgressHidden();
  });

  it("falls back to 未开始 when a cached non-active dimension session is missing", async () => {
    window.localStorage.setItem(
      interviewSessionStorageKey,
      JSON.stringify({
        joy: { sessionId: "session-ready", expiresAt: "2099-04-21T00:00:00.000Z" },
        fulfillment: { sessionId: "session-missing", expiresAt: "2099-04-21T00:00:00.000Z" }
      })
    );

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-ready")) {
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

      if (url.endsWith("/api/interview/session/session-missing")) {
        return new Response(JSON.stringify({ error: "SESSION_NOT_FOUND" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/interview/session/start")) {
        throw new Error("should not create a new session while a cached joy session is valid");
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    await screen.findByText("有效 2 轮");
    expectDimensionRing("开心");
    expectSelectedProgressValue("有效 2 轮");
    expectDimensionStatus("充实", "未开始");

    await waitFor(() => {
      const storedSessions = JSON.parse(window.localStorage.getItem(interviewSessionStorageKey) ?? "{}") as {
        fulfillment?: unknown;
      };

      expect(storedSessions.fulfillment).toBeUndefined();
    });
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

    let hasSavedInterview = false;

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-ready")) {
        return new Response(JSON.stringify(hasSavedInterview ? completedJoySession : activeJoySession), {
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
        hasSavedInterview = true;
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

      if ((url.includes("/api/journal-entry/") || url.includes("/api/joy-entry/")) && init?.method === "PUT") {
        return new Response(JSON.stringify(baseJournalEntry), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    const view = renderInterviewPage();

    await screen.findByText("有效 2 轮");

    fireEvent.click(getTopGenerateButton());
    await screen.findByTestId("journal-editor-card");

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

    mockSearchParams.value.dimension = "fulfillment";
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    await screen.findByText("今天有没有一个让你觉得充实的片段？先讲讲那时你在做什么。");

    mockSearchParams.value.dimension = "joy";
    view.rerender(
      <>
        <SiteHeader />
        <InterviewShell />
      </>
    );

    expect(await screen.findByRole("heading", { name: "日志已保存，访谈已结束" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成日志" })).not.toBeInTheDocument();
    expectDimensionStatus("开心", "已完成");
    expect(global.fetch).toHaveBeenCalledWith("/api/interview/session/session-ready", expect.objectContaining({ cache: "no-store" }));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/session/session-fulfillment",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("cancels the pending autosave timer before explicit save to avoid duplicate draft writes", async () => {
    cacheInterviewSessions({ joy: "session-ready" });

    const editedDraftEntry: JournalEntryRecord = {
      ...baseJournalEntry,
      title: "和家人一起吃饭补充",
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

      if ((url.includes("/api/journal-entry/") || url.includes("/api/joy-entry/")) && init?.method === "PUT") {
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
    await screen.findByTestId("journal-editor-card");

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
      ([input, nextInit]) =>
        (String(input).includes("/api/journal-entry/") || String(input).includes("/api/joy-entry/")) &&
        nextInit?.method === "PUT"
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
          'event: phase\ndata: {"state":"question"}\n\n',
          'event: delta\ndata: {"target":"question","text":"收到，我继续问下一个细节。"}\n\n',
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

  it("hides the composer placeholder after the first focus and keeps it hidden while mounted", async () => {
    renderInterviewPage();

    const textarea = await screen.findByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder", joyInputPlaceholder);

    fireEvent.focus(textarea);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(joyInputPlaceholder)).not.toBeInTheDocument();
    });

    fireEvent.blur(textarea);
    expect(textarea).not.toHaveAttribute("placeholder");
  });

  it("restores the composer placeholder after the page remounts", async () => {
    const view = renderInterviewPage();

    const textarea = await screen.findByRole("textbox");
    fireEvent.focus(textarea);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(joyInputPlaceholder)).not.toBeInTheDocument();
    });

    view.unmount();
    renderInterviewPage();

    const remountedTextarea = await screen.findByRole("textbox");
    expect(remountedTextarea).toHaveAttribute("placeholder", joyInputPlaceholder);
  });

  it("preserves the active interview state when the page remounts on the same dimension", async () => {
    window.localStorage.setItem(
      interviewSessionStorageKey,
      JSON.stringify({
        joy: { sessionId: "session-ready", expiresAt: "2099-04-21T00:00:00.000Z" }
      })
    );

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/interview/session/session-ready")) {
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

      if (url.endsWith("/api/interview/session/start")) {
        throw new Error("should not create a new session while a cached joy session is valid");
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    const view = renderInterviewPage();

    expect(await screen.findByText("有效 2 轮")).toBeInTheDocument();
    expectDimensionRing("开心");
    expectSelectedProgressValue("有效 2 轮");
    const callCountBeforeRemount = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    view.unmount();
    renderInterviewPage();

    expect(screen.getByText("有效 2 轮")).toBeInTheDocument();
    expectDimensionRing("开心");
    expectSelectedProgressValue("有效 2 轮");

    await waitFor(() => {
      expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(callCountBeforeRemount);
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
          'event: phase\ndata: {"state":"question"}\n\n',
          'event: delta\ndata: {"target":"question","text":"收到，我继续问下一个细节。"}\n\n',
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

  it("shows structured SSE errors with a resolution and keeps the reply in the composer", async () => {
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
          `event: error\ndata: ${JSON.stringify({
            code: "SESSION_NOT_FOUND",
            message: "本地页面指向的访谈会话已经不存在或无法恢复。",
            issue: {
              code: "SESSION_NOT_FOUND",
              title: "当前访谈已失效",
              message: "本地页面指向的访谈会话已经不存在或无法恢复。",
              resolution: "请刷新页面后再试，必要时点击清除对话记录重新开始。",
              retryable: false,
              action: "restart_session",
              requestId: "ir-test"
            }
          })}\n\n`
        ]);
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    const textarea = await screen.findByRole("textbox");
    fireEvent.change(textarea, { target: { value: "这次回复需要保留" } });
    fireEvent.click(screen.getByRole("button", { name: "发送回答" }));

    expect(await screen.findByText("当前访谈已失效")).toBeInTheDocument();
    expect(screen.getByText("请刷新页面后再试，必要时点击清除对话记录重新开始。")).toBeInTheDocument();
    expect(screen.getByText(/错误码：SESSION_NOT_FOUND/)).toBeInTheDocument();
    expect(textarea).toHaveValue("这次回复需要保留");
  });

  it("shows message-too-long guidance from HTTP validation errors", async () => {
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
          JSON.stringify({
            error: "MESSAGE_TOO_LONG",
            message: "单次回复最多支持 1200 字。",
            issue: {
              code: "MESSAGE_TOO_LONG",
              title: "这段回复太长",
              message: "单次回复最多支持 1200 字。",
              resolution: "请把内容拆成两段发送，或删短后重试。",
              retryable: true,
              action: "shorten_input",
              requestId: "ir-long"
            }
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    const textarea = await screen.findByRole("textbox");
    fireEvent.change(textarea, { target: { value: "很长的一段回复" } });
    fireEvent.click(screen.getByRole("button", { name: "发送回答" }));

    expect(await screen.findByText("这段回复太长")).toBeInTheDocument();
    expect(screen.getByText("请把内容拆成两段发送，或删短后重试。")).toBeInTheDocument();
    expect(screen.getByText(/错误码：MESSAGE_TOO_LONG/)).toBeInTheDocument();
    expect(textarea).toHaveValue("很长的一段回复");
  });

  it("shows stream protocol guidance when SSE data cannot be parsed", async () => {
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
        return buildSseResponse(['event: delta\ndata: {"target":"question","text":\n\n']);
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    renderInterviewPage();

    const textarea = await screen.findByRole("textbox");
    fireEvent.change(textarea, { target: { value: "测试坏掉的流式数据" } });
    fireEvent.click(screen.getByRole("button", { name: "发送回答" }));

    expect(await screen.findByText("回复数据异常")).toBeInTheDocument();
    expect(screen.getByText("服务端返回的流式数据格式异常。")).toBeInTheDocument();
    expect(screen.getByText(/错误码：STREAM_PROTOCOL_ERROR/)).toBeInTheDocument();
    expect(textarea).toHaveValue("测试坏掉的流式数据");
  });
});
