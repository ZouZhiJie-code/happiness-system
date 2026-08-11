import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventCenteredInterviewWorkspace } from "@/components/interview/event-centered/event-centered-interview-workspace";
import { InterviewDimensionPicker } from "@/components/interview/interview-dimension-picker";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function workspace(input: {
  rootSessionId?: string;
  branchSessionId?: string;
  eventId?: string;
  daySequence?: number;
  completed?: boolean;
  entryId?: string | null;
} = {}): EventCenteredWorkspaceSession {
  const completed = input.completed ?? false;
  const rootSessionId = input.rootSessionId ?? "root-1";
  const branchSessionId = input.branchSessionId ?? "branch-1";
  const eventId = input.eventId ?? "event-1";
  return {
    mode: "event_centered",
    recordMode: "chat",
    rootSessionId,
    activeBranchSessionId: branchSessionId,
    eventId,
    branchStateId: `state-${eventId}`,
    entryDate: "2026-08-02",
    conversationSchemaVersion: 3,
    sessionStatus: completed ? "completed" : "active",
    eventStatus: completed ? "completed" : "active",
    latestMessageSequence: 6,
    journalEvent: {
      id: eventId,
      entryDate: "2026-08-02",
      daySequence: input.daySequence ?? 1,
      status: completed ? "completed" : "active",
      startedAt: "2026-08-02T10:00:00.000Z",
      generationStartedAt: null,
      completedAt: completed ? "2026-08-02T10:06:00.000Z" : null,
      abandonedAt: null
    },
    messages: [{
      id: `assistant-${eventId}`,
      role: "assistant",
      content: "这一段已经先收住了。",
      rawText: "",
      sequence: 6,
      userTurnId: null,
      generationTraceId: "trace-interview-1",
      assistantPayload: {
        naturalUnderstanding: "汇报完成和走出会议室共同构成了这个变化时刻。",
        naturalResponse: "这一段已经先收住了。",
        responseKind: "checkpoint",
        questionSpec: null,
        checkpoint: { kind: "second", outcome: "任务结束后，一直绷着的部分终于放了下来。" },
        angleOutcome: null
      },
      responseVersion: null,
      createdAt: "2026-08-02T10:05:00.000Z"
    }],
    dialogue: {
      phase: "checkpoint_two",
      activeAngle: null,
      questionOpportunityCount: 0,
      focusOptions: [],
      completedAngles: [],
      availableAngles: ["feeling", "thought", "relationship", "action"],
      reopenedAngles: [],
      outcomes: [],
      checkpoint: { kind: "second", outcome: "任务结束后，一直绷着的部分终于放了下来。" },
      allowedActions: completed
        ? []
        : ["reply", "select_exploration_angle", "continue_exploration", "generate_event_journal", "exit_event"],
      progress: [
        { id: "record", label: "轻量记录", status: "complete", percent: 100, detail: "事件已经记下" },
        { id: "reflect", label: "引导复盘", status: "complete", percent: 100, detail: "已完成一个角度" },
        { id: "deepen", label: "深入探索", status: "current", percent: 0, detail: "按需要继续" }
      ]
    },
    recovery: { pendingTurn: null },
    journal: {
      status: input.entryId ? "saved" : "not_generated",
      entryId: input.entryId ?? null,
      eventStatus: completed ? "completed" : "active"
    }
  };
}

function eventTabs() {
  return [
    { rootSessionId: "root-1", label: "会议后的松快", status: "completed" },
    { rootSessionId: "root-2", label: "散步时想到的事", status: "active" }
  ];
}

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("Board 7 event-centered journal MVP closure", () => {
  it("从 optional 入口在引导复盘后完成生成、暂存、保存，并在刷新后通过事件标签重开", async () => {
    let entry: {
      id: string;
      title: string;
      content: string;
      status: string;
      contentRevision: number;
      savedRevision: number | null;
    } = {
      id: "entry-1",
      title: "会议后的松快",
      content: "今天做完汇报，走出会议室的那一刻，我突然觉得整个人松开了。",
      status: "draft",
      contentRevision: 1,
      savedRevision: null
    };
    const active = workspace();
    const completed = workspace({ completed: true, entryId: "entry-1" });
    const secondEvent = workspace({
      rootSessionId: "root-2",
      branchSessionId: "branch-2",
      eventId: "event-2",
      daySequence: 2
    });
    const requests: Array<{ url: string; method: string }> = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method });
      if (url === "/api/calendar/day?date=2026-08-02") {
        return jsonResponse({ date: "2026-08-02", dimensions: [] });
      }
      if (url === "/api/interview/event-centered/session/start") return jsonResponse(active);
      if (url === "/api/interview/event-centered/sessions?entryDate=2026-08-02") return jsonResponse(eventTabs());
      if (url === "/api/interview/event-centered/journal/generate") {
        return jsonResponse({
          entry,
          workspace: completed,
          generation: { origin: "llm", attemptCount: 1, latencyMs: 360 }
        });
      }
      if (url === "/api/interview/event-centered/journal/entry-1" && method === "PATCH") {
        const body = JSON.parse(String(init?.body)) as { title: string; content: string };
        entry = {
          ...entry,
          ...body,
          contentRevision: 2
        };
        return jsonResponse(entry);
      }
      if (url === "/api/interview/event-centered/journal/entry-1/save") {
        entry = { ...entry, status: "saved", savedRevision: 2 };
        return jsonResponse(entry);
      }
      if (url === "/api/interview/event-centered/session/root-2") return jsonResponse(secondEvent);
      if (url === "/api/interview/event-centered/session/root-1") return jsonResponse(completed);
      if (url === "/api/interview/event-centered/journal/entry-1") return jsonResponse(entry);
      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    const picker = render(
      <InterviewDimensionPicker entryDate="2026-08-02" showEventCenteredEntry />
    );
    expect(await screen.findByRole("link", { name: "直接开始" })).toHaveAttribute(
      "href",
      "/interview?mode=event-centered&entryDate=2026-08-02"
    );
    expect(screen.getAllByRole("link")).toHaveLength(6);
    picker.unmount();

    const firstVisit = render(
      <EventCenteredInterviewWorkspace
        entryDate="2026-08-02"
        initialRecordMode="chat"
      />
    );
    expect(await screen.findByTestId("event-centered-second-checkpoint")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "生成事件日志" }));
    const content = await screen.findByLabelText("事件日志正文");
    await waitFor(() => expect(content).toHaveValue(entry.content));

    fireEvent.change(content, {
      target: { value: `${entry.content}\n\n这一刻，我想先把松快好好记住。` }
    });
    await waitFor(() => {
      expect(requests).toContainEqual({
        url: "/api/interview/event-centered/journal/entry-1",
        method: "PATCH"
      });
    }, { timeout: 1_200 });
    fireEvent.click(screen.getByRole("button", { name: "保存日志" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "已保存" })).toBeInTheDocument());
    expect(entry.savedRevision).toBe(2);
    firstVisit.unmount();

    render(
      <EventCenteredInterviewWorkspace
        entryDate="2026-08-02"
        initialSessionId="root-2"
      />
    );
    const savedEventTab = await screen.findByRole("tab", { name: /会议后的松快.*已完成/u });
    fireEvent.click(savedEventTab);

    await waitFor(() => {
      expect((screen.getByLabelText("事件日志正文") as HTMLTextAreaElement).value).toContain(
        "这一刻，我想先把松快好好记住。"
      );
    });
    expect(screen.getByRole("complementary", { name: "当前事件日志" })).toBeInTheDocument();
    expect(requests.filter((request) => request.url === "/api/interview/event-centered/journal/generate")).toHaveLength(1);
  });
});
