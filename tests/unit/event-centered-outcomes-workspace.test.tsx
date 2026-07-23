import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildEventDailyJournalResultHref
} from "@/components/event-calendar/event-calendar-workspace";
import { EventCenteredDailyJournalWorkspace } from "@/components/interview/event-centered/event-centered-daily-journal-workspace";
import { EventJournalSheet } from "@/components/interview/event-centered/event-journal-sheet";
import { EventCenteredInterviewWorkspace } from "@/components/interview/event-centered/event-centered-interview-workspace";
import { TodayJournalSheet } from "@/components/interview/event-centered/today-journal-sheet";
import type { EventCalendarDayRecord } from "@/types/event-calendar";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function sseResponse(events: Array<{ event: string; data: unknown }>) {
  return new Response(
    events.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(""),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    }
  );
}

function buildSession(
  journal: Partial<EventCenteredWorkspaceSession["journal"]> = {}
): EventCenteredWorkspaceSession {
  return {
    mode: "event_centered",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    eventId: "event-1",
    branchStateId: "state-1",
    entryDate: "2026-07-22",
    conversationSchemaVersion: 3,
    sessionStatus: "completed",
    eventStatus: "completed",
    latestMessageSequence: 4,
    journalEvent: {
      id: "event-1",
      entryDate: "2026-07-22",
      daySequence: 2,
      status: "completed",
      startedAt: "2026-07-22T08:00:00.000Z",
      generationStartedAt: "2026-07-22T08:10:00.000Z",
      completedAt: "2026-07-22T08:11:00.000Z",
      abandonedAt: null
    },
    messages: [],
    dialogue: {
      phase: "checkpoint_two",
      activeAngle: "thought",
      questionOpportunityCount: 2,
      focusOptions: [],
      completedAngles: ["thought"],
      availableAngles: ["feeling", "relationship", "action"],
      reopenedAngles: [],
      outcomes: [],
      checkpoint: { kind: "second", outcome: "我在意自己能否把问题说清楚。" },
      allowedActions: ["generate_event_journal"],
      progress: [
        { id: "record", label: "轻量记录", status: "complete", percent: 100, detail: "已记录" },
        { id: "reflect", label: "引导复盘", status: "complete", percent: 100, detail: "已形成线索" },
        { id: "deepen", label: "深入探索", status: "current", percent: 30, detail: "可以继续" }
      ]
    },
    recovery: { pendingTurn: null },
    journal: {
      status: "draft",
      entryId: "entry-1",
      generationId: null,
      errorCode: null,
      retryable: false,
      eventStatus: "completed",
      ...journal
    }
  };
}

function buildDay(): EventCalendarDayRecord {
  return {
    date: "2026-07-22",
    overallStatus: "mixed",
    events: [
      {
        eventId: "event-1",
        rootSessionId: "root-1",
        activeBranchSessionId: "branch-1",
        entryDate: "2026-07-22",
        daySequence: 1,
        eventStatus: "active",
        entryId: null,
        entryStatus: null,
        state: "active",
        title: null,
        displaySummary: "开会前，我突然有点想躲开。",
        summary: "开会前，我突然有点想躲开。",
        latestUpdatedAt: "2026-07-22T08:00:00.000Z",
        actions: ["continue_event"]
      },
      {
        eventId: "event-2",
        rootSessionId: "root-2",
        activeBranchSessionId: "branch-2",
        entryDate: "2026-07-22",
        daySequence: 2,
        eventStatus: "completed",
        entryId: "entry-2",
        entryStatus: "saved",
        state: "saved",
        title: "把节奏放稳",
        displaySummary: "我发现先听完，再说自己的判断，沟通会清楚很多。",
        summary: "我发现先听完，再说自己的判断，沟通会清楚很多。",
        latestUpdatedAt: "2026-07-22T10:00:00.000Z",
        actions: ["view_event_entry"]
      }
    ],
    dailyJournal: {
      collection: "single_entry",
      freshness: "none",
      entryId: null,
      title: null,
      sourceEntryCount: 1,
      pendingSaveEntryIds: [],
      pendingSave: false,
      updateBlockedByPendingSave: false,
      directEntryId: "entry-2",
      actions: ["view_event_entry"]
    },
    activeEventCount: 1,
    generatingEventCount: 0,
    pendingSaveEntryCount: 0,
    savedEntryCount: 1,
    primaryAction: "continue_event",
    latestUpdatedAt: "2026-07-22T10:00:00.000Z"
  };
}

describe("Batch C 事件成果页面", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/interview");
    window.sessionStorage.clear();
  });

  it("以同页连续方式读取和编辑事件日志", async () => {
    const requests: Array<{ url: string; method: string }> = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method });
      if (url === "/api/event-journal/entry-1" && method === "GET") {
        return jsonResponse({
          entry: {
            id: "entry-1",
            eventId: "event-1",
            title: "站出来，也一起想明白",
            content: "事件叙事\n会议开始前，我很想躲开。\n\n我看见的\n我在意的是能否把问题一起理清。",
            status: "draft",
            contentRevision: 1,
            savedRevision: null,
            updatedAt: "2026-07-22T08:11:00.000Z",
            savedAt: null
          }
        });
      }
      if (url === "/api/event-journal/entry-1" && method === "PUT") {
        const body = JSON.parse(String(init?.body));
        return jsonResponse({
          entry: {
            id: "entry-1",
            eventId: "event-1",
            title: body.title,
            content: body.content,
            status: "modified",
            contentRevision: 2,
            savedRevision: null,
            updatedAt: "2026-07-22T08:12:00.000Z",
            savedAt: null
          }
        });
      }
      if (url === "/api/event-journal/entry-1/save" && method === "POST") {
        return jsonResponse({
          entry: {
            id: "entry-1",
            eventId: "event-1",
            title: "站出来，也一起想明白",
            content: "事件叙事\n会议开始前，我很想躲开。\n\n我看见的\n我在意的是能否把问题一起理清。",
            status: "saved",
            contentRevision: 2,
            savedRevision: 2,
            updatedAt: "2026-07-22T08:13:00.000Z",
            savedAt: "2026-07-22T08:13:00.000Z"
          }
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    render(
      <EventJournalSheet
        session={buildSession()}
        entryId="entry-1"
        writeEnabled
        onClose={vi.fn()}
        onGenerate={vi.fn()}
      />
    );

    expect(await screen.findByDisplayValue("站出来，也一起想明白")).toBeVisible();
    expect(String((screen.getByLabelText("事件叙事与我看见的") as HTMLTextAreaElement).value))
      .toContain("我看见的");
    fireEvent.click(screen.getByRole("button", { name: "保存事件日志" }));
    await waitFor(() => expect(requests.some((request) => request.url.endsWith("/save"))).toBe(true));
  });

  it("今日日志按 C 密度展示正文片段，并让单篇入口命中 directEntryId", async () => {
    const day = buildDay();
    global.fetch = vi.fn(async () => jsonResponse(day)) as typeof fetch;
    const onOpenEventJournal = vi.fn();

    render(
      <TodayJournalSheet
        entryDate="2026-07-22"
        onClose={vi.fn()}
        onSelectEvent={vi.fn()}
        onOpenEventJournal={onOpenEventJournal}
        onOpenDailyJournal={vi.fn()}
        onStartEvent={vi.fn()}
      />
    );

    expect(await screen.findByText("我发现先听完，再说自己的判断，沟通会清楚很多。")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "查看事件日志" }));
    expect(onOpenEventJournal).toHaveBeenCalledWith({
      rootSessionId: "root-2",
      entryId: "entry-2"
    });
    expect(buildEventDailyJournalResultHref(day)).toBe(
      "/interview?mode=event-centered&sessionId=root-2&entryDate=2026-07-22&panel=journal&eventEntryId=entry-2"
    );
  });

  it("当天完整日志先保留事件合集，再单独生成今天看见的自己", async () => {
    const baseView = {
      entryDate: "2026-07-22",
      savedSources: [
        {
          eventId: "event-1",
          entryId: "entry-1",
          entryDate: "2026-07-22",
          daySequence: 1,
          title: "慢下来的路",
          content: "下班路上慢慢走了一段。",
          savedRevision: 1,
          savedAt: "2026-07-22T18:00:00.000Z"
        },
        {
          eventId: "event-2",
          entryId: "entry-2",
          entryDate: "2026-07-22",
          daySequence: 2,
          title: "把节奏放稳",
          content: "开会时先听完了大家的想法。",
          savedRevision: 1,
          savedAt: "2026-07-22T20:00:00.000Z"
        }
      ],
      pendingSaveEntryIds: [],
      sourceSignature: "source-signature",
      collection: { kind: "multiple_entries" as const },
      entry: {
        id: "daily-1",
        entryDate: "2026-07-22",
        title: "今天的两件事",
        content: "慢下来的路\n下班路上慢慢走了一段。\n\n把节奏放稳\n开会时先听完了大家的想法。",
        status: "draft" as const,
        sourceEntryIds: ["entry-1", "entry-2"],
        sourceEventIds: ["event-1", "event-2"],
        sourceSignature: "source-signature",
        sourceSnapshot: {
          schemaVersion: 1 as const,
          entryDate: "2026-07-22",
          sources: []
        },
        sourceUpdatedAt: "2026-07-22T20:00:00.000Z",
        contentRevision: 1,
        savedRevision: null,
        editedAt: null,
        savedAt: null,
        createdAt: "2026-07-22T20:01:00.000Z",
        updatedAt: "2026-07-22T20:01:00.000Z"
      },
      freshness: "draft" as const,
      updateBlockedByPendingSource: false,
      generation: null
    };
    const requests: string[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push(`${init?.method ?? "GET"} ${url}`);
      if (url === "/api/journal-daily?date=2026-07-22") return jsonResponse(baseView);
      if (url === "/api/journal-daily/daily-1/insight") return jsonResponse(baseView);
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(
      <EventCenteredDailyJournalWorkspace
        entryDate="2026-07-22"
        writeEnabled
        onBack={vi.fn()}
        onOpenEventEntry={vi.fn()}
      />
    );

    expect(await screen.findByDisplayValue("今天的两件事")).toBeVisible();
    expect(screen.getByText("来源与顺序")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "生成今天看见的自己" }));
    await waitFor(() => expect(requests).toContain("POST /api/journal-daily/daily-1/insight"));
    expect(await screen.findByText(/目前还没有形成足够清楚的共同线索/u)).toBeVisible();
  });

  it("完整日志深链不创建空会话，并能按 entryId 定位来源事件", async () => {
    const requests: string[] = [];
    const sourceSession = buildSession({
      status: "saved",
      entryId: "entry-2",
      eventStatus: "completed"
    });
    sourceSession.rootSessionId = "root-2";
    sourceSession.activeBranchSessionId = "branch-2";
    sourceSession.eventId = "event-2";
    sourceSession.journalEvent = sourceSession.journalEvent
      ? { ...sourceSession.journalEvent, id: "event-2" }
      : null;
    const dailyView = {
      entryDate: "2026-07-22",
      savedSources: [{
        eventId: "event-2",
        entryId: "entry-2",
        entryDate: "2026-07-22",
        daySequence: 2,
        title: "把节奏放稳",
        content: "我先听完，再说自己的判断。",
        savedRevision: 1,
        savedAt: "2026-07-22T20:00:00.000Z"
      }],
      pendingSaveEntryIds: [],
      sourceSignature: "single-source",
      collection: { kind: "single_entry", entryId: "entry-2" },
      entry: null,
      freshness: "none",
      updateBlockedByPendingSource: false,
      generation: null
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url === "/api/journal-daily?date=2026-07-22") return jsonResponse(dailyView);
      if (url === "/api/event-calendar/day?date=2026-07-22") return jsonResponse(buildDay());
      if (url === "/api/interview/event-centered/session/root-2") return jsonResponse(sourceSession);
      if (url === "/api/event-journal/entry-2") {
        return jsonResponse({
          entry: {
            id: "entry-2",
            eventId: "event-2",
            title: "把节奏放稳",
            content: "我先听完，再说自己的判断。",
            status: "saved",
            contentRevision: 1,
            savedRevision: 1,
            updatedAt: "2026-07-22T20:00:00.000Z",
            savedAt: "2026-07-22T20:00:00.000Z"
          }
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(
      <EventCenteredInterviewWorkspace
        entryDate="2026-07-22"
        initialPanel="daily-journal"
      />
    );

    expect(await screen.findByText("今天已有一篇事件日志")).toBeVisible();
    expect(requests).not.toContain("/api/interview/event-centered/session/start");

    fireEvent.click(screen.getByRole("button", { name: "查看事件日志" }));

    expect(await screen.findByDisplayValue("我先听完，再说自己的判断。")).toBeVisible();
    expect(requests).toContain("/api/interview/event-centered/session/root-2");
    expect(requests).not.toContain("/api/interview/event-centered/session/start");
    await waitFor(() => {
      expect(window.location.search).toContain("sessionId=root-2");
      expect(window.location.search).toContain("eventEntryId=entry-2");
    });
  });

  it("事件日志重试复用同一操作，取消后恢复可生成状态，新操作使用新编号", async () => {
    const initial = buildSession({
      status: "not_generated",
      entryId: null,
      eventStatus: "active"
    });
    initial.sessionStatus = "active";
    initial.eventStatus = "active";
    initial.journalEvent = initial.journalEvent
      ? { ...initial.journalEvent, status: "active", completedAt: null }
      : null;
    initial.dialogue = {
      ...initial.dialogue,
      allowedActions: ["generate_event_journal", "exit_event"]
    };
    const generating = buildSession({
      status: "generating",
      entryId: null,
      generationId: "generation-1",
      eventStatus: "generating"
    });
    generating.sessionStatus = "active";
    generating.eventStatus = "generating";
    const afterCancel = buildSession({
      status: "not_generated",
      entryId: null,
      generationId: null,
      eventStatus: "completed"
    });
    const requestBodies: Array<Record<string, unknown>> = [];
    let respondCount = 0;
    let cancelCount = 0;

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/session/start") return jsonResponse(initial);
      if (url === "/api/event-calendar/day?date=2026-07-22") return jsonResponse(buildDay());
      if (url === "/api/event-journal/generation/generation-1/cancel") {
        cancelCount += 1;
        return jsonResponse({ status: "cancelled" });
      }
      if (url === "/api/interview/event-centered/session/root-1") {
        return jsonResponse(afterCancel);
      }
      if (url === "/api/interview/event-centered/session/respond/stream") {
        requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        respondCount += 1;
        return respondCount === 1
          ? sseResponse([{
              event: "error",
              data: {
                code: "AI_RETRYABLE",
                issue: {
                  code: "AI_RETRYABLE",
                  title: "整理暂时中断",
                  message: "可以继续整理。",
                  retryable: true
                }
              }
            }])
          : sseResponse([{ event: "session", data: { session: generating } }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<EventCenteredInterviewWorkspace entryDate="2026-07-22" />);

    fireEvent.click(await screen.findByRole("button", { name: "当前事件日志" }));
    fireEvent.click(await screen.findByRole("button", { name: "生成事件日志" }));
    fireEvent.click(await screen.findByRole("button", { name: "重新整理" }));

    await waitFor(() => expect(respondCount).toBe(2));
    expect(requestBodies[0]?.clientTurnId).toBe(requestBodies[1]?.clientTurnId);
    await waitFor(() => expect(window.sessionStorage.length).toBe(0));

    fireEvent.click(await screen.findByRole("button", { name: "停止整理" }));
    expect(await screen.findByRole("button", { name: "生成事件日志" })).toBeVisible();
    expect(cancelCount).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "生成事件日志" }));
    await waitFor(() => expect(respondCount).toBe(3));
    expect(requestBodies[2]?.clientTurnId).not.toBe(requestBodies[1]?.clientTurnId);
  });
});
