import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EventCenteredDialogueWorkspaceView,
  type EventCenteredDialogueWorkspaceAction
} from "@/components/interview/event-centered/event-centered-dialogue-workspace-view";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";

function buildSession(overrides: Partial<EventCenteredWorkspaceSession> = {}): EventCenteredWorkspaceSession {
  return {
    mode: "event_centered",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    eventId: "event-1",
    branchStateId: "state-1",
    entryDate: "2026-07-22",
    conversationSchemaVersion: 3,
    sessionStatus: "active",
    eventStatus: "active",
    latestMessageSequence: 3,
    journalEvent: {
      id: "event-1",
      entryDate: "2026-07-22",
      daySequence: 1,
      status: "active",
      startedAt: "2026-07-22T08:00:00.000Z",
      generationStartedAt: null,
      completedAt: null,
      abandonedAt: null
    },
    messages: [
      {
        id: "opening-1",
        role: "assistant",
        content: "先从这件事开始吧。",
        rawText: "",
        sequence: 1,
        userTurnId: null,
        assistantPayload: {
          naturalUnderstanding: "我会先贴着这件事来听。",
          naturalResponse: "刚刚发生了什么？",
          responseKind: "question",
          questionSpec: {
            phase: "event_recording",
            angle: null,
            target: "事件锚点",
            opportunityNumber: 1,
            surfaceLevel: "open_anchor",
            anchorText: null,
            repairCount: 0
          },
          checkpoint: null,
          angleOutcome: null
        },
        responseVersion: {
          groupId: "group-1",
          version: 1,
          versionCount: 2,
          canRegenerate: true,
          canSwitch: true,
          versions: [
            { messageId: "opening-1", branchSessionId: "branch-1", version: 1, active: true },
            { messageId: "opening-2", branchSessionId: "branch-2", version: 2, active: false }
          ]
        },
        createdAt: "2026-07-22T08:00:00.000Z"
      }
    ],
    dialogue: {
      phase: "event_recording",
      activeAngle: null,
      questionOpportunityCount: 1,
      focusOptions: [],
      completedAngles: [],
      availableAngles: ["feeling", "thought", "relationship", "action"],
      reopenedAngles: [],
      outcomes: [],
      checkpoint: null,
      allowedActions: ["reply", "correct_understanding", "regenerate_response", "switch_response_version"],
      progress: [
        { id: "record", label: "轻量记录", status: "current", percent: 50, detail: "正在记录" },
        { id: "reflect", label: "引导复盘", status: "upcoming", percent: 0, detail: "等待开启" },
        { id: "deepen", label: "深入探索", status: "upcoming", percent: 0, detail: "按需要继续" }
      ]
    },
    recovery: { pendingTurn: null },
    journal: {
      status: "not_generated",
      entryId: null,
      generationId: null,
      errorCode: null,
      retryable: false,
      eventStatus: "active"
    },
    ...overrides
  };
}

function renderView(session = buildSession(), options?: { journalOpen?: boolean; onJournalOpenChange?: (open: boolean) => void }) {
  const onAction = vi.fn<(action: EventCenteredDialogueWorkspaceAction) => void>();
  const onCreateEvent = vi.fn();
  const rendered = render(
    <EventCenteredDialogueWorkspaceView
      session={session}
      entryDate="2026-07-22"
      onAction={onAction}
      onCreateEvent={onCreateEvent}
      canCreateEvent
      journalOpen={options?.journalOpen}
      onJournalOpenChange={options?.onJournalOpenChange}
    />
  );
  return { onAction, onCreateEvent, ...rendered };
}

describe("事件中心对话工作台呈现层", () => {
  it("让顶部事件标签支持左右、首尾键切换，并关联当前对话面板", () => {
    const onSelectTab = vi.fn();
    const tabs = [
      { rootSessionId: "root-1", label: "事件 1", status: "active" as const },
      { rootSessionId: "root-2", label: "事件 2", status: "completed" as const },
      { rootSessionId: "root-3", label: "事件 3", status: "abandoned" as const }
    ];
    const result = render(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        tabs={tabs}
        activeTabId="root-1"
        onAction={vi.fn()}
        onSelectTab={onSelectTab}
      />
    );

    const first = screen.getByRole("tab", { name: /事件 1/u });
    const second = screen.getByRole("tab", { name: /事件 2/u });
    const third = screen.getByRole("tab", { name: /事件 3/u });
    first.focus();

    expect(first).toHaveAttribute("aria-controls", "event-centered-dialogue-panel-root-1");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "event-centered-tab-root-1");

    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveFocus();
    expect(onSelectTab).toHaveBeenLastCalledWith("root-2");

    result.rerender(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        tabs={tabs}
        activeTabId="root-2"
        onAction={vi.fn()}
        onSelectTab={onSelectTab}
      />
    );

    fireEvent.keyDown(second, { key: "End" });
    expect(third).toHaveFocus();
    expect(onSelectTab).toHaveBeenLastCalledWith("root-3");

    result.rerender(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        tabs={tabs}
        activeTabId="root-3"
        onAction={vi.fn()}
        onSelectTab={onSelectTab}
      />
    );

    fireEvent.keyDown(third, { key: "Home" });
    expect(first).toHaveFocus();
    expect(onSelectTab).toHaveBeenLastCalledWith("root-1");

    result.rerender(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        tabs={tabs}
        activeTabId="root-1"
        onAction={vi.fn()}
        onSelectTab={onSelectTab}
      />
    );

    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(third).toHaveFocus();
    expect(onSelectTab).toHaveBeenLastCalledWith("root-3");
  });

  it("打开日志后移入日志区域，收起时回到日志入口", async () => {
    const onJournalOpenChange = vi.fn();
    const result = renderView(buildSession(), { onJournalOpenChange });
    const trigger = screen.getByRole("button", { name: "当前事件日志" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(onJournalOpenChange).toHaveBeenCalledWith(true);

    result.rerender(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        onAction={vi.fn()}
        journalOpen
        onJournalOpenChange={onJournalOpenChange}
      />
    );

    const journal = screen.getByRole("complementary", { name: "当前事件日志" });
    await waitFor(() => expect(journal).toHaveFocus());
    expect(screen.getByRole("button", { name: "当前事件日志" })).toHaveAttribute("aria-controls", "event-centered-journal-panel");

    fireEvent.click(screen.getByRole("button", { name: "收起" }));
    expect(onJournalOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "当前事件日志" })).toHaveFocus();
  });

  it("采用对话内纸笺方案呈现三段进度、事件标签，点击后才展开 Batch C 日志占位", () => {
    const onJournalOpenChange = vi.fn();
    const result = renderView(buildSession(), { onJournalOpenChange });

    expect(screen.getByRole("tab", { name: /事件 1/u })).toBeInTheDocument();
    expect(screen.getByTestId("event-centered-dialogue-progress")).toHaveTextContent("1 · 轻量记录");
    expect(screen.getByTestId("event-centered-dialogue-progress")).toHaveTextContent("2 · 引导复盘");
    expect(screen.getByTestId("event-centered-dialogue-progress")).toHaveTextContent("3 · 深入探索");
    expect(screen.queryByRole("complementary", { name: "当前事件日志" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "当前事件日志" }));
    expect(onJournalOpenChange).toHaveBeenCalledWith(true);

    result.rerender(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        onAction={vi.fn()}
        journalOpen
        onJournalOpenChange={onJournalOpenChange}
      />
    );
    expect(screen.getByRole("complementary", { name: "当前事件日志" })).toHaveTextContent("日志整理将在批次 C 接入");
  });

  it("把输入、问题修复、纠正和回复版本交给外部回调", async () => {
    const { onAction } = renderView();

    fireEvent.change(screen.getByLabelText("输入当前事件"), { target: { value: "我想补充一个细节" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(onAction).toHaveBeenCalledWith({ action: "reply", rawText: "我想补充一个细节" });
    await waitFor(() => expect(screen.getByLabelText("输入当前事件")).toHaveValue(""));

    fireEvent.click(screen.getByRole("button", { name: "换个问法" }));
    fireEvent.click(screen.getByRole("button", { name: /更简单一点/u }));
    expect(onAction).toHaveBeenCalledWith({
      action: "regenerate_response",
      targetMessageId: "opening-1",
      regenerationIntent: "simplify"
    });

    fireEvent.click(screen.getByRole("button", { name: "纠正理解" }));
    fireEvent.change(screen.getByLabelText("纠正 AI 对这段话的理解"), { target: { value: "我在意的是等待的感觉" } });
    fireEvent.click(screen.getByRole("button", { name: "提交纠正" }));
    expect(onAction).toHaveBeenCalledWith({
      action: "correct_understanding",
      rawText: "我在意的是等待的感觉",
      targetMessageId: "opening-1"
    });
    await waitFor(() => expect(screen.queryByLabelText("纠正 AI 对这段话的理解")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(onAction).toHaveBeenCalledWith({
      action: "switch_response_version",
      targetMessageId: "opening-2",
      targetBranchSessionId: "branch-2"
    });
  });

  it("在可靠确认前保留输入，失败后继续保留，并避开中文输入法组合提交", async () => {
    const onAction = vi.fn<(action: EventCenteredDialogueWorkspaceAction) => Promise<void>>();
    onAction.mockRejectedValueOnce(new Error("暂时失败"));
    render(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        onAction={onAction}
      />
    );
    const input = screen.getByLabelText("输入当前事件");
    fireEvent.change(input, { target: { value: "输入法还在组合" } });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229, isComposing: true });
    expect(onAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith({ action: "reply", rawText: "输入法还在组合" }));
    await waitFor(() => expect(input).toHaveValue("输入法还在组合"));

    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("纠正理解提交失败时保留原文，并以服务端允许动作关闭未开放的版本和角度操作", async () => {
    const onAction = vi.fn<(action: EventCenteredDialogueWorkspaceAction) => Promise<void>>();
    onAction.mockRejectedValueOnce(new Error("暂时失败"));
    const session = buildSession({
      dialogue: {
        ...buildSession().dialogue,
        phase: "checkpoint_one",
        checkpoint: { kind: "first", outcome: "先处理眼前的澄清。" },
        allowedActions: ["reply", "correct_understanding", "exit_event"]
      }
    });
    render(
      <EventCenteredDialogueWorkspaceView
        session={session}
        entryDate="2026-07-22"
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "纠正理解" }));
    const correction = screen.getByLabelText("纠正 AI 对这段话的理解");
    fireEvent.change(correction, { target: { value: "我实际在意的是被催促" } });
    fireEvent.click(screen.getByRole("button", { name: "提交纠正" }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith({
      action: "correct_understanding",
      rawText: "我实际在意的是被催促",
      targetMessageId: "opening-1"
    }));
    expect(correction).toHaveValue("我实际在意的是被催促");
    expect(screen.getByRole("button", { name: "2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /理解感受/u })).toBeDisabled();
  });

  it("在两个检查点用纸笺展示角度选择、深入和失败恢复", () => {
    const checkpoint = buildSession({
      dialogue: {
        ...buildSession().dialogue,
        phase: "checkpoint_one",
        checkpoint: { kind: "first", outcome: "这件事的轮廓已经清楚。" },
        allowedActions: ["select_exploration_angle", "reply"]
      }
    });
    const { onAction } = renderView(checkpoint);

    expect(screen.getByTestId("event-centered-first-checkpoint")).toHaveTextContent("先把这件事放好");
    fireEvent.click(screen.getByRole("button", { name: /理解感受/u }));
    expect(onAction).toHaveBeenCalledWith({ action: "select_exploration_angle", angle: "feeling" });

    const second = buildSession({
      dialogue: {
        ...buildSession().dialogue,
        phase: "checkpoint_two",
        checkpoint: { kind: "second", outcome: "已经看见一个可靠线索。" },
        allowedActions: ["continue_exploration", "reply", "resume_turn"]
      },
      recovery: {
        pendingTurn: {
          id: "turn-1",
          clientTurnId: "client-1",
          sessionId: "branch-1",
          rawText: "这段话还想补充",
          inputMode: "text",
          baseMessageSequence: 3,
          status: "failed",
          createdAt: "2026-07-22T08:10:00.000Z",
          errorCode: "AI_RETRYABLE",
          attemptCount: 1
        }
      }
    });
    const recoveryAction = vi.fn<(action: EventCenteredDialogueWorkspaceAction) => void>();
    render(
      <EventCenteredDialogueWorkspaceView
        session={second}
        entryDate="2026-07-22"
        onAction={recoveryAction}
      />
    );
    expect(screen.getByTestId("event-centered-second-checkpoint")).toHaveTextContent("已经看见一个可靠线索。");
    expect(screen.getByTestId("event-centered-second-checkpoint")).toHaveTextContent("继续深入");
    expect(screen.getByText("这段话已经收到")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续生成" }));
    expect(recoveryAction).toHaveBeenCalledWith({ action: "resume_turn" });
  });

  it("两件并列事件提供两个低压力选择，选择时只提交对应原话摘录", () => {
    const focus = buildSession({
      dialogue: {
        ...buildSession().dialogue,
        phase: "event_focus_clarification",
        focusOptions: [
          { id: "focus-1", label: "下午会议被临时取消", sourceText: "下午会议被临时取消" },
          { id: "focus-2", label: "晚上和朋友的误会", sourceText: "晚上和朋友的误会" }
        ],
        allowedActions: ["reply", "select_current_event", "exit_event"]
      }
    });
    const { onAction } = renderView(focus);

    expect(screen.getByText("先选一件")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "晚上和朋友的误会" }));
    expect(onAction).toHaveBeenCalledWith({
      action: "select_current_event",
      optionId: "focus-2",
      rawText: "晚上和朋友的误会"
    });
    expect(screen.getByText(/都不贴切时/u)).toBeVisible();
  });
});
