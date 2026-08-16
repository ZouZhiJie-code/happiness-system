import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  JournalDayWorkspace,
  JournalDayWorkspaceView
} from "@/components/journal/journal-day-workspace";
import type {
  JournalDailyDisplayStatus,
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
    sourceSignature: "source-signature-1",
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
    sourceSignature: "source-signature-1",
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
});
