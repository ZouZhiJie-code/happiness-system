import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

import {
  JournalDayWorkspace,
  JournalDayWorkspaceView
} from "@/components/journal/journal-day-workspace";
import {
  deriveJournalDayView,
  mergeJournalDayRefresh
} from "@/components/journal/journal-day-view-merge";
import { useJournalDailyEditor } from "@/components/journal/use-journal-daily-editor";
import { useJournalRecordEditor } from "@/components/journal/use-journal-record-editor";
import { buildJournalDailySourceSignature } from "@/features/journal-daily/source-signature";
import type {
  JournalDailyDisplayStatus,
  JournalDailyEntryGenerationRecord,
  JournalDailyEntryRecord,
  JournalDailyJournalView,
  JournalDailySourceEntry
} from "@/types/journal-daily-entry";

const source: JournalDailySourceEntry = {
  eventId: "event-1",
  entryId: "record-1",
  entryDate: "2026-05-02",
  daySequence: 1,
  title: "把演示稳稳讲完",
  content: "下午的演示比预想顺利，我也记住了自己真正有把握的部分。",
  contentRevision: 1,
  savedRevision: 1,
  savedAt: "2026-05-02T03:00:00.000Z",
  updatedAt: "2026-05-02T03:00:00.000Z",
  recordedAt: "2026-05-02T02:15:00.000Z",
  occurredAt: "2026-05-02T01:30:00.000Z",
  sourceMode: "chat",
  recordCount: 3,
  sourceMessageIds: ["message-1", "message-2"]
};
const sourceSignature1 = buildJournalDailySourceSignature([source]);
const sourceSignature2 = buildJournalDailySourceSignature([{ ...source, contentRevision: 2 }]);

function buildEntry(status: "draft" | "modified" | "saved" = "draft", revision = 1): JournalDailyEntryRecord {
  return {
    id: "daily-1",
    entryDate: "2026-05-02",
    title: "今天稳稳地向前走",
    content: "下午的演示顺利落地。\n\n回头看，我对自己的准备更有把握了。",
    paragraphs: {
      schemaVersion: 1,
      paragraphs: [
        { text: "下午的演示顺利落地。", sourceRecordIds: ["record-1"] },
        { text: "回头看，我对自己的准备更有把握了。", sourceRecordIds: ["record-1"] }
      ]
    },
    status,
    sourceEntryIds: ["record-1"],
    sourceEventIds: ["event-1"],
    sourceSignature: sourceSignature1,
    sourceSnapshot: { schemaVersion: 2, entryDate: "2026-05-02", sources: [source] },
    sourceUpdatedAt: "2026-05-02T03:00:00.000Z",
    contentRevision: revision,
    savedRevision: status === "saved" ? revision : null,
    currentGenerationTraceId: null,
    lastGenerationErrorCode: null,
    editedAt: status === "modified" ? "2026-05-02T04:00:00.000Z" : null,
    savedAt: status === "saved" ? "2026-05-02T04:00:00.000Z" : null,
    createdAt: "2026-05-02T03:00:00.000Z",
    updatedAt: "2026-05-02T04:00:00.000Z"
  };
}

function buildView(displayStatus: JournalDailyDisplayStatus, options?: { empty?: boolean }): JournalDailyJournalView {
  const sources = options?.empty ? [] : [source];
  const entry = displayStatus === "ungenerated" || options?.empty ? null : buildEntry(displayStatus === "saved" ? "saved" : "draft");
  return {
    entryDate: "2026-05-02",
    savedSources: sources,
    legacyHistory: [],
    pendingSaveEntryIds: [],
    sourceSignature: sourceSignature1,
    collection: sources.length === 0 ? { kind: "empty" } : { kind: "single_entry", entryId: "record-1" },
    entry,
    freshness: entry ? (displayStatus === "stale" ? "stale" : entry.status) : "none",
    displayStatus,
    latestGeneration: null,
    updateBlockedByPendingSource: false
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function createDeferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function useInterleavedEditorHarness(initialView: JournalDailyJournalView) {
  const [view, setView] = React.useState(initialView);
  const viewRef = React.useRef<JournalDailyJournalView | null>(initialView);
  const sourceRefreshAppliedRef = React.useRef(false);
  const commitView = React.useCallback((nextView: JournalDailyJournalView) => {
    viewRef.current = nextView;
    setView(nextView);
  }, []);
  const refresh = React.useCallback(() => {
    if (sourceRefreshAppliedRef.current) return;
    const latestView = viewRef.current;
    if (!latestView) return;
    sourceRefreshAppliedRef.current = true;
    commitView({
      ...latestView,
      sourceSignature: sourceSignature2,
      freshness: "stale",
      displayStatus: "stale"
    });
  }, [commitView]);
  const record = useJournalRecordEditor({
    entryDate: initialView.entryDate,
    view,
    viewRef,
    commitView,
    refresh
  });
  const daily = useJournalDailyEditor({
    entryDate: initialView.entryDate,
    view,
    viewRef,
    commitView,
    refresh
  });
  return { view, record, daily };
}

describe("journal day workspace", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the record timeline, source mode and original words without persistent interview entries", async () => {
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/journal/day")) return jsonResponse(buildView("ungenerated"));
      if (url === "/api/interview/event-centered/journal/record-1" && !init?.method) {
        return jsonResponse({
          sourceSnapshot: {
            messages: [
              { role: "user", content: "演示结束时我终于松了一口气。" },
              { role: "assistant", content: "你最有把握的部分是什么？" },
              { role: "user", content: "我对准备过程更有信心了。" }
            ]
          }
        });
      }
      return jsonResponse({}, 404);
    }) as typeof fetch;

    render(<JournalDayWorkspace entryDate="2026-05-02" />);

    expect(await screen.findByText("当天片段")).toBeInTheDocument();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByText("把演示稳稳讲完")).toBeInTheDocument();
    expect(screen.queryByText("累计 3 次")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "帮我记" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "陪我聊" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成日记" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看原话" }));
    expect(await screen.findByText(/演示结束时我终于松了一口气/)).toBeInTheDocument();
    expect(screen.queryByText(/你最有把握/)).not.toBeInTheDocument();
  });

  it("exports a request-free view for visual fixtures", () => {
    global.fetch = vi.fn() as typeof fetch;

    render(
      <JournalDayWorkspaceView
        entryDate="2026-05-02"
        view={buildView("saved")}
      />
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByText("下午的演示顺利落地。", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑日记" })).toBeInTheDocument();
  });

  it("keeps saved legacy journals and dimensions in a collapsed read-only history", () => {
    const view = buildView("saved");
    view.legacyHistory = [
      {
        id: "legacy-daily-1",
        kind: "daily_journal",
        entryDate: "2026-05-02",
        title: "旧版完整日记",
        content: "这是当天原有的完整日志内容。",
        dimension: null,
        savedAt: "2026-05-02T05:00:00.000Z",
        updatedAt: "2026-05-02T05:00:00.000Z"
      },
      {
        id: "legacy-joy-1",
        kind: "dimension_entry",
        entryDate: "2026-05-02",
        title: "一件开心的小事",
        content: "这是原开心维度的记录。",
        dimension: "joy",
        savedAt: "2026-05-02T06:00:00.000Z",
        updatedAt: "2026-05-02T06:00:00.000Z"
      }
    ];

    render(<JournalDayWorkspaceView entryDate="2026-05-02" view={view} />);

    const history = screen.getByText("历史记录 · 2").closest("details");
    expect(history).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("历史记录 · 2"));
    expect(screen.getByText("这是当天原有的完整日志内容。")).toBeVisible();
    expect(screen.getByText("开心记录")).toBeVisible();
  });

  it("keeps the same day canvas while a journal is generating", () => {
    render(<JournalDayWorkspaceView entryDate="2026-05-02" view={buildView("generating")} />);

    expect(screen.getByTestId("journal-day-workspace")).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByText("生成中")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "正在生成" })).toBeDisabled();
    expect(screen.getByText("当天片段")).toBeInTheDocument();
  });

  it("shows recent journals only when the visual contract contains at least two archives", () => {
    const archives = [
      { id: "day-2", entryDate: "2026-05-02", title: "今天稳稳地向前走", displayStatus: "saved" as const, selected: true },
      { id: "day-1", entryDate: "2026-05-01", title: "把复杂的事情重新拆开", displayStatus: "saved" as const }
    ];
    const { rerender } = render(
      <JournalDayWorkspaceView entryDate="2026-05-02" view={buildView("saved")} archives={archives} />
    );

    expect(screen.getByRole("heading", { name: "最近日记" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /把复杂的事情重新拆开/ })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-05-01"
    );

    rerender(<JournalDayWorkspaceView entryDate="2026-05-02" view={buildView("saved")} archives={archives.slice(0, 1)} />);
    expect(screen.queryByRole("heading", { name: "最近日记" })).not.toBeInTheDocument();
  });

  it("auto-saves record edits after 700ms and finishes without a separate save action", async () => {
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/journal/day")) return jsonResponse(buildView("ungenerated"));
      if (url === "/api/interview/event-centered/journal/record-1" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        return jsonResponse({
          title: body.title,
          content: body.content,
          contentRevision: 2,
          updatedAt: "2026-05-02T05:00:00.000Z"
        });
      }
      if (url === "/api/interview/event-centered/journal/record-1/save" && init?.method === "POST") {
        return jsonResponse({
          ...source,
          title: "把演示稳稳讲完",
          content: "这是自动保存后的记录正文。",
          contentRevision: 2,
          savedRevision: 2,
          savedAt: "2026-05-02T05:01:00.000Z",
          updatedAt: "2026-05-02T05:01:00.000Z"
        });
      }
      return jsonResponse({}, 404);
    }) as typeof fetch;

    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    await screen.findByText("把演示稳稳讲完");
    fireEvent.click(screen.getByRole("button", { name: "编辑内容" }));
    const body = screen.getByRole("textbox", { name: "正文" });
    fireEvent.change(body, { target: { value: "这是自动保存后的记录正文。" } });

    expect(screen.queryByRole("button", { name: "保存内容" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "完成编辑" })).toBeInTheDocument();
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/interview/event-centered/journal/record-1",
          expect.objectContaining({ method: "PATCH" })
        );
      },
      { timeout: 1500 }
    );
    expect(await screen.findByText("内容已自动保存")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/event-centered/journal/record-1/save",
      expect.objectContaining({ method: "POST" })
    ));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "正文" })).not.toBeInTheDocument());
  });

  it("keeps fixed read-only cases readable without edit actions", () => {
    render(<JournalDayWorkspaceView entryDate="2026-05-02" view={buildView("saved")} readOnly />);

    expect(screen.getByText("下午的演示顺利落地。", { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑日记" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑内容" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看原话" })).toBeInTheDocument();
  });

  it("auto-saves a daily draft and uses the explicit save endpoint for 保存日记", async () => {
    const initialView = buildView("draft");
    const autosaved = { ...buildEntry("modified", 2), content: "自动暂存后的今日日记。" };
    const saved = { ...autosaved, status: "saved" as const, savedRevision: 2, savedAt: "2026-05-02T06:00:00.000Z" };
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/journal/day")) return jsonResponse(initialView);
      if (url === "/api/journal/daily/daily-1" && init?.method === "PATCH") return jsonResponse(autosaved);
      if (url === "/api/journal/daily/daily-1/save" && init?.method === "POST") return jsonResponse(saved);
      return jsonResponse({}, 404);
    }) as typeof fetch;

    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    fireEvent.click(await screen.findByRole("button", { name: "继续编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "日记正文" }), {
      target: { value: "自动暂存后的今日日记。" }
    });

    await waitFor(
      () => expect(global.fetch).toHaveBeenCalledWith(
        "/api/journal/daily/daily-1",
        expect.objectContaining({ method: "PATCH" })
      ),
      { timeout: 1500 }
    );
    expect(await screen.findByText("修改已自动暂存")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存日记" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/journal/daily/daily-1/save",
      expect.objectContaining({ method: "POST" })
    ));
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑日记" }));
    expect(screen.getByRole("textbox", { name: "日记正文" })).toHaveValue("自动暂存后的今日日记。");
  });

  it("locks the daily submission snapshot while its save request is pending", async () => {
    const saveDeferred = createDeferredResponse();
    const firstDraft = "点击保存时提交的今日日记。";
    const laterDraft = "等待保存期间继续输入但不应混入本次提交。";
    const updated = { ...buildEntry("modified", 2), content: firstDraft };
    const saved = {
      ...updated,
      status: "saved" as const,
      savedRevision: 2,
      savedAt: "2026-05-02T06:00:00.000Z"
    };
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/journal/day")) return jsonResponse(buildView("saved"));
      if (url === "/api/journal/daily/daily-1" && init?.method === "PATCH") return jsonResponse(updated);
      if (url === "/api/journal/daily/daily-1/save" && init?.method === "POST") return saveDeferred.promise;
      return jsonResponse({}, 404);
    }) as typeof fetch;

    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    fireEvent.click(await screen.findByRole("button", { name: "编辑日记" }));
    fireEvent.change(screen.getByRole("textbox", { name: "日记正文" }), {
      target: { value: firstDraft }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存日记" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/journal/daily/daily-1/save",
      expect.objectContaining({ method: "POST" })
    ));

    const editor = screen.getByRole("textbox", { name: "日记正文" });
    expect(editor).toBeDisabled();
    expect(editor).toHaveValue(firstDraft);

    await act(async () => {
      saveDeferred.resolve(jsonResponse(saved));
    });
    expect(await screen.findByText(firstDraft)).toBeInTheDocument();
    expect(screen.queryByText(laterDraft)).not.toBeInTheDocument();
  });

  it("locks the record submission snapshot while its completion request is pending", async () => {
    const saveDeferred = createDeferredResponse();
    const firstDraft = "点击完成时提交的事件卡正文。";
    const laterDraft = "等待完成期间继续输入但不应混入本次提交。";
    const updated = {
      ...source,
      content: firstDraft,
      contentRevision: 2,
      updatedAt: "2026-05-02T05:00:00.000Z"
    };
    const saved = {
      ...updated,
      savedRevision: 2,
      savedAt: "2026-05-02T05:01:00.000Z"
    };
    let dayReadCount = 0;
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/journal/day")) {
        dayReadCount += 1;
        return jsonResponse(dayReadCount === 1 ? buildView("saved") : {
          ...buildView("stale"),
          savedSources: [saved],
          sourceSignature: sourceSignature2
        });
      }
      if (url === "/api/interview/event-centered/journal/record-1" && init?.method === "PATCH") {
        return jsonResponse(updated);
      }
      if (url === "/api/interview/event-centered/journal/record-1/save" && init?.method === "POST") {
        return saveDeferred.promise;
      }
      return jsonResponse({}, 404);
    }) as typeof fetch;

    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    fireEvent.click(await screen.findByRole("button", { name: "编辑内容" }));
    fireEvent.change(screen.getByRole("textbox", { name: "正文" }), {
      target: { value: firstDraft }
    });
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/event-centered/journal/record-1/save",
      expect.objectContaining({ method: "POST" })
    ));

    const editor = screen.getByRole("textbox", { name: "正文" });
    expect(editor).toBeDisabled();
    expect(editor).toHaveValue(firstDraft);

    await act(async () => {
      saveDeferred.resolve(jsonResponse(saved));
    });
    expect(await screen.findByText(firstDraft)).toBeInTheDocument();
    expect(screen.queryByText(laterDraft)).not.toBeInTheDocument();
  });

  it("flushes the latest daily draft before exiting edit mode", async () => {
    const initialView = buildView("draft");
    const autosaved = { ...buildEntry("modified", 2), content: "退出前也要暂存的内容。" };
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/journal/day")) return jsonResponse(initialView);
      if (url === "/api/journal/daily/daily-1" && init?.method === "PATCH") return jsonResponse(autosaved);
      return jsonResponse({}, 404);
    }) as typeof fetch;

    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    fireEvent.click(await screen.findByRole("button", { name: "继续编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "日记正文" }), {
      target: { value: "退出前也要暂存的内容。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "退出编辑" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/journal/daily/daily-1",
      expect.objectContaining({ method: "PATCH" })
    ));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "日记正文" })).not.toBeInTheDocument());
  });

  it("keeps an empty day inside the same journal canvas", async () => {
    global.fetch = vi.fn(async () => jsonResponse(buildView("ungenerated", { empty: true }))) as typeof fetch;
    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    expect(await screen.findByText("这一天还没有片段")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "开始记录" })).toHaveAttribute(
      "href",
      "/interview?mode=event-centered&entryDate=2026-05-02"
    );
    expect(screen.queryByRole("link", { name: "帮我记" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "陪我聊" })).not.toBeInTheDocument();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it.each([
    ["stale", "需更新", "更新日记"],
    ["update_failed", "更新失败", "重试更新"]
  ] as const)("renders %s with its status and update action", async (status, badge, action) => {
    global.fetch = vi.fn(async () => jsonResponse(buildView(status))) as typeof fetch;
    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    expect(await screen.findByText(badge)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: action })).toHaveClass("ui-status-action");
    expect(screen.getByRole("button", { name: "编辑日记" })).toBeInTheDocument();
  });

  it.each([
    ["ungenerated", "生成日记", "generate", null],
    ["stale", "更新日记", "update", 1]
  ] as const)(
    "keeps the %s generation request bound to the current source signature and content revision",
    async (status, action, task, expectedContentRevision) => {
      global.fetch = vi.fn(async (input, init) => {
        const url = String(input);
        if (url.startsWith("/api/journal/day")) return jsonResponse(buildView(status));
        if (url === "/api/journal/daily/generate" && init?.method === "POST") {
          return jsonResponse({ accepted: true }, 202);
        }
        return jsonResponse({}, 404);
      }) as typeof fetch;

      render(<JournalDayWorkspace entryDate="2026-05-02" />);
      fireEvent.click(await screen.findByRole("button", { name: action }));

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
        "/api/journal/daily/generate",
        expect.objectContaining({ method: "POST" })
      ));
      const generationCall = vi.mocked(global.fetch).mock.calls.find(
        ([input]) => String(input) === "/api/journal/daily/generate"
      );
      const payload = JSON.parse(String(generationCall?.[1]?.body));
      expect(payload).toMatchObject({
        entryDate: "2026-05-02",
        task,
        expectedSourceSignature: sourceSignature1,
        expectedContentRevision
      });
      expect(payload.clientOperationId).toMatch(/^journal-daily-2026-05-02-\d+$/u);
    }
  );

  it("keeps the update progress visible while the action is busy", () => {
    render(
      <JournalDayWorkspaceView
        entryDate="2026-05-02"
        view={buildView("stale")}
        dailyBusy
      />
    );

    const action = screen.getByRole("button", { name: "正在更新" });
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute("data-busy", "true");
    expect(action).toHaveTextContent("正在更新");
  });

  it("uses one open reading surface and suppresses the deterministic date title", () => {
    const view = buildView("saved");
    view.entry = { ...view.entry!, title: "2026年5月2日 周六" };
    const { container } = render(<JournalDayWorkspaceView entryDate="2026-05-02" view={view} />);

    expect(screen.getByRole("heading", { name: "5月2日周六" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "2026年5月2日 周六" })).not.toBeInTheDocument();
    expect(container.querySelector("[aria-label='日记正文']")).toBeInstanceOf(HTMLElement);
    expect(container.querySelector("[aria-label='日记正文']")).not.toHaveClass("ui-card");
    expect(screen.getByText("当天片段")).toBeInTheDocument();
  });

  it("keeps a manually edited daily stale until its changed record source is updated", async () => {
    const staleView = buildView("stale");
    const modified = {
      ...staleView.entry!,
      content: `${staleView.entry!.content}\n\n我的人工补充。`,
      status: "modified" as const,
      contentRevision: 2,
      sourceSignature: "source-signature-before-record-change"
    };
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/journal/day")) return jsonResponse(staleView);
      if (url === "/api/journal/daily/daily-1" && init?.method === "PATCH") return jsonResponse(modified);
      return jsonResponse({}, 404);
    }) as typeof fetch;

    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    fireEvent.click(await screen.findByRole("button", { name: "编辑日记" }));
    fireEvent.change(screen.getByRole("textbox", { name: "日记正文" }), {
      target: { value: modified.content }
    });
    fireEvent.click(screen.getByRole("button", { name: "退出编辑" }));

    await waitFor(() => expect(screen.queryByRole("textbox", { name: "日记正文" })).not.toBeInTheDocument());
    expect(screen.getByText("需更新")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新日记" })).toBeInTheDocument();
  });

  it.each([
    { responseOrder: "refresh-first", caseName: "刷新先返回、记录保存后返回" },
    { responseOrder: "save-first", caseName: "记录保存先返回、刷新后返回" }
  ] as const)("keeps a saved daily stale across real workspace refresh/save races: $caseName", async ({ responseOrder }) => {
    const initialView = buildView("saved");
    const recordPatchDeferred = createDeferredResponse();
    const dayRefreshDeferred = createDeferredResponse();
    const recordSaveDeferred = createDeferredResponse();
    const recordContent = "真实页面交错请求更新后的记录正文。";
    const updatedRecord = {
      ...source,
      content: recordContent,
      contentRevision: 2,
      updatedAt: "2026-05-02T05:00:00.000Z"
    };
    const savedRecord = {
      ...updatedRecord,
      savedRevision: 2,
      savedAt: "2026-05-02T05:01:00.000Z"
    };
    const refreshedStaleView: JournalDailyJournalView = {
      ...initialView,
      savedSources: [savedRecord],
      sourceSignature: sourceSignature2,
      freshness: "stale",
      displayStatus: "stale"
    };
    let initialDayServed = false;
    let markRecordSaveStarted!: () => void;
    const recordSaveStarted = new Promise<void>((resolve) => {
      markRecordSaveStarted = resolve;
    });

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/journal/day")) {
        if (!initialDayServed) {
          initialDayServed = true;
          return Promise.resolve(jsonResponse(initialView));
        }
        return dayRefreshDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1" && init?.method === "PATCH") {
        return recordPatchDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1/save" && init?.method === "POST") {
        markRecordSaveStarted();
        return recordSaveDeferred.promise;
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    global.fetch = fetchMock as typeof fetch;

    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    fireEvent.click(await screen.findByRole("button", { name: "编辑内容" }));
    fireEvent.change(screen.getByRole("textbox", { name: "正文" }), {
      target: { value: recordContent }
    });
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/interview/event-centered/journal/record-1",
      expect.objectContaining({ method: "PATCH" })
    ));
    await act(async () => {
      recordPatchDeferred.resolve(jsonResponse(updatedRecord));
      await recordSaveStarted;
    });

    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/api/journal/day")
    )).toHaveLength(2));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/journal/day?entryDate=2026-05-02",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/interview/event-centered/journal/record-1/save",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expectedContentRevision: 2 })
      })
    );

    if (responseOrder === "refresh-first") {
      await act(async () => {
        dayRefreshDeferred.resolve(jsonResponse(refreshedStaleView));
      });
      await waitFor(() => expect(screen.getByText("需更新")).toBeInTheDocument());
      await act(async () => {
        recordSaveDeferred.resolve(jsonResponse(savedRecord));
      });
    } else {
      await act(async () => {
        recordSaveDeferred.resolve(jsonResponse(savedRecord));
      });
      await waitFor(() => expect(screen.queryByRole("textbox", { name: "正文" })).not.toBeInTheDocument());
      await act(async () => {
        dayRefreshDeferred.resolve(jsonResponse(refreshedStaleView));
      });
    }

    await waitFor(() => expect(screen.getByText("需更新")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "更新日记" })).toBeInTheDocument();
    expect(screen.getByText(recordContent)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "正文" })).not.toBeInTheDocument();
  });

  it.each([
    { responseOrder: "refresh-first", caseName: "刷新先返回、日记保存后返回" },
    { responseOrder: "daily-first", caseName: "日记保存先返回、刷新后返回" }
  ] as const)("keeps a manual daily edit across real workspace refresh races: $caseName", async ({ responseOrder }) => {
    const initialView = buildView("saved");
    const recordPatchDeferred = createDeferredResponse();
    const dayRefreshDeferred = createDeferredResponse();
    const recordSaveDeferred = createDeferredResponse();
    const dailyPatchDeferred = createDeferredResponse();
    const dailySaveDeferred = createDeferredResponse();
    const recordContent = "刷新请求等待期间更新后的记录正文。";
    const dailyContent = "刷新请求等待期间人工保存的今日日记。";
    const updatedRecord = {
      ...source,
      content: recordContent,
      contentRevision: 2,
      updatedAt: "2026-05-02T05:00:00.000Z"
    };
    const savedRecord = {
      ...updatedRecord,
      savedRevision: 2,
      savedAt: "2026-05-02T05:01:00.000Z"
    };
    const refreshedStaleView: JournalDailyJournalView = {
      ...initialView,
      savedSources: [savedRecord],
      sourceSignature: sourceSignature2,
      freshness: "stale",
      displayStatus: "stale"
    };
    const updatedDaily = {
      ...buildEntry("modified", 2),
      content: dailyContent,
      sourceSignature: sourceSignature1
    };
    const savedDaily = {
      ...updatedDaily,
      status: "saved" as const,
      savedRevision: 2,
      savedAt: "2026-05-02T05:02:00.000Z"
    };
    let initialDayServed = false;
    let markRecordSaveStarted!: () => void;
    const recordSaveStarted = new Promise<void>((resolve) => {
      markRecordSaveStarted = resolve;
    });
    let markDailySaveStarted!: () => void;
    const dailySaveStarted = new Promise<void>((resolve) => {
      markDailySaveStarted = resolve;
    });

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/journal/day")) {
        if (!initialDayServed) {
          initialDayServed = true;
          return Promise.resolve(jsonResponse(initialView));
        }
        return dayRefreshDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1" && init?.method === "PATCH") {
        return recordPatchDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1/save" && init?.method === "POST") {
        markRecordSaveStarted();
        return recordSaveDeferred.promise;
      }
      if (url === "/api/journal/daily/daily-1" && init?.method === "PATCH") {
        return dailyPatchDeferred.promise;
      }
      if (url === "/api/journal/daily/daily-1/save" && init?.method === "POST") {
        markDailySaveStarted();
        return dailySaveDeferred.promise;
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    global.fetch = fetchMock as typeof fetch;

    render(<JournalDayWorkspace entryDate="2026-05-02" />);
    fireEvent.click(await screen.findByRole("button", { name: "编辑内容" }));
    fireEvent.change(screen.getByRole("textbox", { name: "正文" }), {
      target: { value: recordContent }
    });
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/interview/event-centered/journal/record-1",
      expect.objectContaining({ method: "PATCH" })
    ));

    fireEvent.click(screen.getByRole("button", { name: "编辑日记" }));
    fireEvent.change(screen.getByRole("textbox", { name: "日记正文" }), {
      target: { value: dailyContent }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存日记" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/journal/daily/daily-1",
      expect.objectContaining({ method: "PATCH" })
    ));

    await act(async () => {
      recordPatchDeferred.resolve(jsonResponse(updatedRecord));
      await recordSaveStarted;
    });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/api/journal/day")
    )).toHaveLength(2));
    await act(async () => {
      recordSaveDeferred.resolve(jsonResponse(savedRecord));
    });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "正文" })).not.toBeInTheDocument());

    if (responseOrder === "refresh-first") {
      await act(async () => {
        dayRefreshDeferred.resolve(jsonResponse(refreshedStaleView));
      });
      await waitFor(() => expect(screen.getByText("需更新")).toBeInTheDocument());
      await act(async () => {
        dailyPatchDeferred.resolve(jsonResponse(updatedDaily));
        await dailySaveStarted;
      });
      await act(async () => {
        dailySaveDeferred.resolve(jsonResponse(savedDaily));
      });
    } else {
      await act(async () => {
        dailyPatchDeferred.resolve(jsonResponse(updatedDaily));
        await dailySaveStarted;
      });
      await act(async () => {
        dailySaveDeferred.resolve(jsonResponse(savedDaily));
      });
      await waitFor(() => expect(screen.getByText(dailyContent)).toBeInTheDocument());
      await act(async () => {
        dayRefreshDeferred.resolve(jsonResponse(refreshedStaleView));
      });
    }

    await waitFor(() => expect(screen.getByText("需更新")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "更新日记" })).toBeInTheDocument();
    expect(screen.getByText(recordContent)).toBeInTheDocument();
    expect(screen.getByText(dailyContent)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "日记正文" })).not.toBeInTheDocument();
  });

  it.each([
    { responseOrder: "daily-first", caseName: "日记响应先返回、记录响应后返回" },
    { responseOrder: "record-first", caseName: "记录响应先返回、日记响应后返回" }
  ] as const)("merges interleaved record and daily edits: $caseName", async ({ responseOrder }) => {
    const recordDeferred = createDeferredResponse();
    const dailyDeferred = createDeferredResponse();
    const recordContent = "交错请求中更新后的记录正文。";
    const dailyContent = "交错请求中更新后的今日日记。";
    const updatedRecord = {
      ...source,
      content: recordContent,
      contentRevision: 2,
      updatedAt: "2026-05-02T05:00:00.000Z"
    };
    const updatedDaily = {
      ...buildEntry("modified", 2),
      content: dailyContent,
      sourceSignature: sourceSignature1
    };

    global.fetch = vi.fn((input, init) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/journal/record-1" && init?.method === "PATCH") {
        return recordDeferred.promise;
      }
      if (url === "/api/journal/daily/daily-1" && init?.method === "PATCH") {
        return dailyDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1/save" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({
          ...updatedRecord,
          savedRevision: 2,
          savedAt: "2026-05-02T05:01:00.000Z"
        }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    }) as typeof fetch;

    const { result } = renderHook(() => useInterleavedEditorHarness(buildView("draft")));
    act(() => {
      result.current.record.beginEdit(source);
      result.current.daily.beginEdit();
    });
    act(() => {
      result.current.record.setEdit({
        entryId: source.entryId,
        title: source.title,
        content: recordContent
      });
      result.current.daily.setEdit({
        title: buildEntry().title,
        content: dailyContent
      });
    });

    let finishRecord!: Promise<void>;
    let exitDaily!: Promise<void>;
    act(() => {
      finishRecord = result.current.record.finishEdit();
      exitDaily = result.current.daily.exitEdit();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/interview/event-centered/journal/record-1",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/journal/daily/daily-1",
      expect.objectContaining({ method: "PATCH" })
    );

    if (responseOrder === "daily-first") {
      await act(async () => {
        dailyDeferred.resolve(jsonResponse(updatedDaily));
        await exitDaily;
      });
      await act(async () => {
        recordDeferred.resolve(jsonResponse(updatedRecord));
        await finishRecord;
      });
    } else {
      await act(async () => {
        recordDeferred.resolve(jsonResponse(updatedRecord));
        await finishRecord;
      });
      await act(async () => {
        dailyDeferred.resolve(jsonResponse(updatedDaily));
        await exitDaily;
      });
    }

    expect(result.current.view.savedSources[0]?.content).toBe(recordContent);
    expect(result.current.view.entry?.content).toBe(dailyContent);
    expect(result.current.view.sourceSignature).toBe(sourceSignature2);
    expect(result.current.view.freshness).toBe("stale");
    expect(result.current.view.displayStatus).toBe("stale");
  });

  it("merges a record save response into a newer daily edit", async () => {
    const recordPatchDeferred = createDeferredResponse();
    const recordSaveDeferred = createDeferredResponse();
    const dailyPatchDeferred = createDeferredResponse();
    let markRecordSaveStarted!: () => void;
    const recordSaveStarted = new Promise<void>((resolve) => {
      markRecordSaveStarted = resolve;
    });
    const recordContent = "正式保存前更新后的记录正文。";
    const dailyContent = "记录正式保存期间更新的今日日记。";
    const updatedRecord = {
      ...source,
      content: recordContent,
      contentRevision: 2,
      updatedAt: "2026-05-02T05:00:00.000Z"
    };
    const updatedDaily = {
      ...buildEntry("modified", 2),
      content: dailyContent,
      sourceSignature: sourceSignature1
    };

    global.fetch = vi.fn((input, init) => {
      const url = String(input);
      if (url === "/api/interview/event-centered/journal/record-1" && init?.method === "PATCH") {
        return recordPatchDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1/save" && init?.method === "POST") {
        markRecordSaveStarted();
        return recordSaveDeferred.promise;
      }
      if (url === "/api/journal/daily/daily-1" && init?.method === "PATCH") {
        return dailyPatchDeferred.promise;
      }
      return Promise.resolve(jsonResponse({}, 404));
    }) as typeof fetch;

    const { result } = renderHook(() => useInterleavedEditorHarness(buildView("draft")));
    act(() => {
      result.current.record.beginEdit(source);
      result.current.daily.beginEdit();
    });
    act(() => {
      result.current.record.setEdit({ entryId: source.entryId, title: source.title, content: recordContent });
      result.current.daily.setEdit({ title: buildEntry().title, content: dailyContent });
    });

    let finishRecord!: Promise<void>;
    let exitDaily!: Promise<void>;
    act(() => {
      finishRecord = result.current.record.finishEdit();
      exitDaily = result.current.daily.exitEdit();
    });
    await act(async () => {
      recordPatchDeferred.resolve(jsonResponse(updatedRecord));
      await recordSaveStarted;
    });
    await act(async () => {
      dailyPatchDeferred.resolve(jsonResponse(updatedDaily));
      await exitDaily;
    });
    await act(async () => {
      recordSaveDeferred.resolve(jsonResponse({
        ...updatedRecord,
        savedRevision: 2,
        savedAt: "2026-05-02T05:01:00.000Z"
      }));
      await finishRecord;
    });

    expect(result.current.view.savedSources[0]?.content).toBe(recordContent);
    expect(result.current.view.entry?.content).toBe(dailyContent);
    expect(result.current.view.sourceSignature).toBe(sourceSignature2);
    expect(result.current.view.freshness).toBe("stale");
    expect(result.current.view.displayStatus).toBe("stale");
  });

  it("keeps the latest source staleness when a daily save response arrives after a record edit", async () => {
    const dailyPatchDeferred = createDeferredResponse();
    const dailySaveDeferred = createDeferredResponse();
    const recordPatchDeferred = createDeferredResponse();
    let markDailySaveStarted!: () => void;
    const dailySaveStarted = new Promise<void>((resolve) => {
      markDailySaveStarted = resolve;
    });
    const recordContent = "日记正式保存期间更新的记录正文。";
    const dailyContent = "正式保存后的今日日记。";
    const updatedRecord = {
      ...source,
      content: recordContent,
      contentRevision: 2,
      updatedAt: "2026-05-02T05:00:00.000Z"
    };
    const updatedDaily = {
      ...buildEntry("modified", 2),
      content: dailyContent,
      sourceSignature: sourceSignature1
    };

    global.fetch = vi.fn((input, init) => {
      const url = String(input);
      if (url === "/api/journal/daily/daily-1" && init?.method === "PATCH") {
        return dailyPatchDeferred.promise;
      }
      if (url === "/api/journal/daily/daily-1/save" && init?.method === "POST") {
        markDailySaveStarted();
        return dailySaveDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1" && init?.method === "PATCH") {
        return recordPatchDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1/save" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({
          ...updatedRecord,
          savedRevision: 2,
          savedAt: "2026-05-02T05:01:00.000Z"
        }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    }) as typeof fetch;

    const { result } = renderHook(() => useInterleavedEditorHarness(buildView("draft")));
    act(() => {
      result.current.record.beginEdit(source);
      result.current.daily.beginEdit();
    });
    act(() => {
      result.current.record.setEdit({ entryId: source.entryId, title: source.title, content: recordContent });
      result.current.daily.setEdit({ title: buildEntry().title, content: dailyContent });
    });

    let finishRecord!: Promise<void>;
    let saveDaily!: Promise<void>;
    act(() => {
      finishRecord = result.current.record.finishEdit();
      saveDaily = result.current.daily.saveEdit();
    });
    await act(async () => {
      dailyPatchDeferred.resolve(jsonResponse(updatedDaily));
      await dailySaveStarted;
    });
    await act(async () => {
      recordPatchDeferred.resolve(jsonResponse(updatedRecord));
      await finishRecord;
    });
    await act(async () => {
      dailySaveDeferred.resolve(jsonResponse({
        ...updatedDaily,
        status: "saved",
        savedRevision: 2,
        savedAt: "2026-05-02T05:02:00.000Z"
      }));
      await saveDaily;
    });

    expect(result.current.view.savedSources[0]?.content).toBe(recordContent);
    expect(result.current.view.entry?.content).toBe(dailyContent);
    expect(result.current.view.sourceSignature).toBe(sourceSignature2);
    expect(result.current.view.freshness).toBe("stale");
    expect(result.current.view.displayStatus).toBe("stale");
  });

  it("merges delayed generation polling with newer fields and absorbs its completion", () => {
    const secondSource: JournalDailySourceEntry = {
      ...source,
      eventId: "event-2",
      entryId: "record-2",
      daySequence: 2,
      title: "晚上的新片段",
      content: "这是轮询响应带回的新事件卡。",
      recordedAt: "2026-05-02T07:00:00.000Z",
      updatedAt: "2026-05-02T07:00:00.000Z"
    };
    const currentEntry = {
      ...buildEntry("modified", 2),
      content: "轮询等待期间保留的人工日记。"
    };
    const current = deriveJournalDayView({
      ...buildView("stale"),
      savedSources: [{ ...source, contentRevision: 2, updatedAt: "2026-05-02T06:00:00.000Z" }],
      pendingSaveEntryIds: ["record-1"],
      entry: currentEntry,
      updateBlockedByPendingSource: true
    });
    const processing: JournalDailyEntryGenerationRecord = {
      id: "generation-1",
      entryDate: "2026-05-02",
      entryId: "daily-1",
      traceId: "trace-1",
      clientOperationId: "operation-1",
      kind: "update",
      status: "processing",
      expectedSourceSignature: sourceSignature2,
      expectedContentRevision: 2,
      resultRevisionId: null,
      attemptCount: 1,
      errorCode: null,
      startedAt: "2026-05-02T07:01:00.000Z",
      completedAt: null,
      failedAt: null,
      canceledAt: null,
      createdAt: "2026-05-02T07:01:00.000Z",
      updatedAt: "2026-05-02T07:01:00.000Z"
    };
    const polling = mergeJournalDayRefresh(current, {
      ...buildView("generating"),
      savedSources: [source, secondSource],
      latestGeneration: processing
    });
    const mergedSignature = buildJournalDailySourceSignature(polling.savedSources);

    expect(polling.savedSources).toHaveLength(2);
    expect(polling.savedSources.find((item) => item.entryId === "record-1")?.contentRevision).toBe(2);
    expect(polling.collection).toEqual({ kind: "multiple_entries" });
    expect(polling.pendingSaveEntryIds).toEqual([]);
    expect(polling.updateBlockedByPendingSource).toBe(false);
    expect(polling.sourceSignature).toBe(mergedSignature);
    expect(polling.entry?.content).toBe(currentEntry.content);
    expect(polling.freshness).toBe("stale");
    expect(polling.displayStatus).toBe("generating");

    const completedEntry = {
      ...currentEntry,
      content: "生成完成后吸收的新日记。",
      contentRevision: 3,
      sourceSignature: mergedSignature,
      status: "draft" as const,
      updatedAt: "2026-05-02T07:02:00.000Z"
    };
    const completed = mergeJournalDayRefresh(polling, {
      ...polling,
      entry: completedEntry,
      latestGeneration: {
        ...processing,
        status: "completed",
        resultRevisionId: "revision-3",
        completedAt: "2026-05-02T07:02:00.000Z",
        updatedAt: "2026-05-02T07:02:00.000Z"
      },
      displayStatus: "draft"
    });

    expect(completed.entry?.content).toBe(completedEntry.content);
    expect(completed.sourceSignature).toBe(mergedSignature);
    expect(completed.freshness).toBe("draft");
    expect(completed.displayStatus).toBe("draft");
  });

  it("marks the latest view generating after an accepted request", async () => {
    const generationDeferred = createDeferredResponse();
    const recordPatchDeferred = createDeferredResponse();
    const recordContent = "生成请求等待期间更新的记录正文。";
    const updatedRecord = {
      ...source,
      content: recordContent,
      contentRevision: 2,
      updatedAt: "2026-05-02T05:00:00.000Z"
    };

    global.fetch = vi.fn((input, init) => {
      const url = String(input);
      if (url === "/api/journal/daily/generate" && init?.method === "POST") {
        return generationDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1" && init?.method === "PATCH") {
        return recordPatchDeferred.promise;
      }
      if (url === "/api/interview/event-centered/journal/record-1/save" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({
          ...updatedRecord,
          savedRevision: 2,
          savedAt: "2026-05-02T05:01:00.000Z"
        }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    }) as typeof fetch;

    const { result } = renderHook(() => useInterleavedEditorHarness(buildView("draft")));
    let generateDaily!: Promise<void>;
    act(() => {
      generateDaily = result.current.daily.generate();
      result.current.record.beginEdit(source);
    });
    act(() => {
      result.current.record.setEdit({ entryId: source.entryId, title: source.title, content: recordContent });
    });
    let finishRecord!: Promise<void>;
    act(() => {
      finishRecord = result.current.record.finishEdit();
    });
    await act(async () => {
      recordPatchDeferred.resolve(jsonResponse(updatedRecord));
      await finishRecord;
    });
    await act(async () => {
      generationDeferred.resolve(jsonResponse({ accepted: true }, 202));
      await generateDaily;
    });

    expect(result.current.view.savedSources[0]?.content).toBe(recordContent);
    expect(result.current.view.sourceSignature).toBe(sourceSignature2);
    expect(result.current.view.freshness).toBe("stale");
    expect(result.current.view.displayStatus).toBe("generating");
  });
});
