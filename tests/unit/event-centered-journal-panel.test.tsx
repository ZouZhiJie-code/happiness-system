import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventCenteredJournalPanel } from "@/components/interview/event-centered/event-centered-journal-panel";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";
import type { JournalEventEntryRecord } from "@/types/journal-event-entry";

function session(): EventCenteredWorkspaceSession {
  return {
    mode: "event_centered",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    eventId: "event-1",
    branchStateId: "state-1",
    entryDate: "2026-08-02",
    conversationSchemaVersion: 3,
    sessionStatus: "completed",
    eventStatus: "completed",
    latestMessageSequence: 8,
    journalEvent: null,
    messages: [],
    dialogue: {
      phase: "checkpoint_one",
      activeAngle: null,
      questionOpportunityCount: 0,
      focusOptions: [],
      completedAngles: [],
      availableAngles: [],
      reopenedAngles: [],
      outcomes: [],
      checkpoint: { kind: "first", outcome: "已经记下" },
      allowedActions: [],
      progress: []
    },
    recovery: { pendingTurn: null },
    journal: { status: "draft", entryId: "entry-1", eventStatus: "completed" }
  };
}

function entry(overrides: Partial<JournalEventEntryRecord> = {}): JournalEventEntryRecord {
  return {
    id: "entry-1",
    eventId: "event-1",
    entryDate: "2026-08-02T00:00:00.000Z",
    daySequence: 1,
    sourceBranchSessionId: "branch-1",
    generatedByTurnId: "turn-1",
    currentGenerationTraceId: "trace-1",
    generationId: "generation-1",
    title: "会议之后",
    content: "会议结束后，我终于松了一口气。",
    status: "draft",
    generationOrigin: "fallback",
    generationVersion: 1,
    sourceMessageSequence: 8,
    sourceMessageIds: ["message-user-1"],
    sourceFactIds: [],
    sourceAngleOutcomeIds: [],
    sourceFingerprint: "source-v1",
    sourceSnapshot: {} as JournalEventEntryRecord["sourceSnapshot"],
    contentRevision: 1,
    savedRevision: null,
    editedAt: null,
    savedAt: null,
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z",
    ...overrides
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("EventCenteredJournalPanel", () => {
  it("编辑后 700ms 自动暂存，并以服务端新版本正式保存", async () => {
    vi.useFakeTimers();
    const first = entry();
    const updated = entry({ content: "会议结束后，我终于真正松了口气。", contentRevision: 2 });
    const saved = entry({ ...updated, status: "saved", savedRevision: 2 });
    const onUpdate = vi.fn().mockResolvedValue(updated);
    const onSave = vi.fn().mockResolvedValue(saved);
    const result = render(
      <EventCenteredJournalPanel
        session={session()}
        entry={first}
        generating={false}
        readOnly={false}
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        onUpdate={onUpdate}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText("事件日志正文"), {
      target: { value: updated.content }
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });
    expect(onUpdate).toHaveBeenCalledWith({
      entryId: "entry-1",
      title: "会议之后",
      content: updated.content,
      expectedContentRevision: 1
    });

    result.rerender(
      <EventCenteredJournalPanel
        session={session()}
        entry={updated}
        generating={false}
        readOnly={false}
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        onUpdate={onUpdate}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "保存日志" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledWith({ entryId: "entry-1", expectedContentRevision: 2 });
  });

  it("并发版本冲突时保留当前编辑内容并显示可恢复提示", async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn().mockRejectedValue(new Error("EVENT_JOURNAL_ENTRY_VERSION_CONFLICT"));
    render(
      <EventCenteredJournalPanel
        session={session()}
        entry={entry()}
        generating={false}
        readOnly={false}
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        onUpdate={onUpdate}
        onSave={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText("事件日志正文");
    fireEvent.change(textarea, { target: { value: "这段改动需要继续保留。" } });
    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(textarea).toHaveValue("这段改动需要继续保留。");
    expect(screen.getByRole("alert")).toHaveTextContent("这次修改还没有暂存");
  });

  it("暂存进行中继续输入时保留新文字，并在收起前连续保存到最新版本", async () => {
    vi.useFakeTimers();
    let resolveFirst: ((value: JournalEventEntryRecord) => void) | null = null;
    const firstRequest = new Promise<JournalEventEntryRecord>((resolve) => {
      resolveFirst = resolve;
    });
    const first = entry();
    const firstSaved = entry({ content: "第一版修改。", contentRevision: 2 });
    const latestSaved = entry({ content: "第一版修改后，又补了一句。", contentRevision: 3 });
    const onClose = vi.fn();
    const onSave = vi.fn();
    const onUpdate = vi.fn();
    const renderedRef: { current: ReturnType<typeof render> | null } = { current: null };
    const panel = (currentEntry: JournalEventEntryRecord) => (
      <EventCenteredJournalPanel
        session={session()}
        entry={currentEntry}
        generating={false}
        readOnly={false}
        onClose={onClose}
        onGenerate={vi.fn()}
        onUpdate={onUpdate}
        onSave={onSave}
      />
    );
    onUpdate
      .mockImplementationOnce(() => firstRequest.then((updated) => {
        renderedRef.current?.rerender(panel(updated));
        return updated;
      }))
      .mockImplementationOnce(async () => {
        renderedRef.current?.rerender(panel(latestSaved));
        return latestSaved;
      });
    const rendered = render(panel(first));
    renderedRef.current = rendered;

    const textarea = screen.getByLabelText("事件日志正文");
    fireEvent.change(textarea, { target: { value: "第一版修改。" } });
    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    fireEvent.change(textarea, { target: { value: "第一版修改后，又补了一句。" } });
    fireEvent.click(screen.getByRole("button", { name: "收起" }));
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      resolveFirst?.(firstSaved);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(textarea).toHaveValue("第一版修改后，又补了一句。");
    expect(onUpdate).toHaveBeenNthCalledWith(2, {
      entryId: "entry-1",
      title: "会议之后",
      content: "第一版修改后，又补了一句。",
      expectedContentRevision: 2
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("移动端 sheet 支持明确关闭名称、Escape 关闭与焦点圈定", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(max-width: 1023px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    });
    const onClose = vi.fn();
    render(
      <EventCenteredJournalPanel
        session={session()}
        entry={entry({ status: "saved", savedRevision: 1 })}
        generating={false}
        readOnly={false}
        onClose={onClose}
        onGenerate={vi.fn()}
        onUpdate={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const panel = screen.getByRole("complementary", { name: "当前事件日志" });
    expect(screen.getByRole("button", { name: "向下拖动关闭事件日志" })).toBeInTheDocument();
    fireEvent.keyDown(panel, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    const first = screen.getByRole("button", { name: "向下拖动关闭事件日志" });
    const last = screen.getByRole("link", { name: "返回今天" });
    last.focus();
    fireEvent.keyDown(panel, { key: "Tab" });
    expect(first).toHaveFocus();
  });
});
