import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  EventCenteredDialogueWorkspaceView,
  EventCenteredStartWorkspaceView,
  type EventCenteredDialogueWorkspaceAction
} from "@/components/interview/event-centered/event-centered-dialogue-workspace-view";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import type { EventCenteredWorkspaceSession } from "@/types/event-centered-dialogue";

vi.mock("@/components/ai-feedback/ai-response-feedback", () => ({
  AIResponseFeedback: ({ traceId, leadingAction, mode }: { traceId: string; leadingAction?: ReactNode; mode?: string }) => (
    <div data-testid={`ai-feedback-${traceId}`} data-feedback-mode={mode}>
      {leadingAction}
      <button type="button">赞</button>
      <button type="button">踩</button>
    </div>
  )
}));

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
    messages: [{
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
    }],
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
      allowedActions: ["reply", "correct_understanding", "regenerate_response", "switch_response_version", "exit_event"],
      progress: [
        { id: "record", label: "轻量记录", status: "current", percent: 50, detail: "正在记录" },
        { id: "reflect", label: "引导复盘", status: "upcoming", percent: 0, detail: "等待开启" },
        { id: "deepen", label: "深入探索", status: "upcoming", percent: 0, detail: "按需要继续" }
      ]
    },
    recovery: { pendingTurn: null },
    journal: { status: "not_generated", entryId: null, eventStatus: "active" },
    ...overrides
  };
}

describe("事件中心对话工作台呈现层", () => {
  it("将当天片段放进侧栏，支持键盘切换并返回对应日期的日报", () => {
    const onSelectTab = vi.fn();
    render(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        tabs={[
          { rootSessionId: "root-1", label: "会议后的松一口气", status: "active" },
          { rootSessionId: "root-2", label: "下班路上的小事", status: "completed" }
        ]}
        activeTabId="root-1"
        onAction={vi.fn()}
        onSelectTab={onSelectTab}
      />
    );

    const first = screen.getByRole("tab", { name: /会议后的松一口气/u });
    const second = screen.getByRole("tab", { name: /下班路上的小事/u });
    expect(screen.getByRole("complementary", { name: "当天片段" })).toBeInTheDocument();
    expect(first).toHaveAttribute("aria-controls", "event-centered-dialogue-panel-root-1");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveFocus();
    expect(onSelectTab).toHaveBeenCalledWith("root-2");
    expect(screen.getByRole("link", { name: "查看 7 月 22 日 日记" })).toHaveAttribute("href", "/calendar?view=day&date=2026-07-22");
  });

  it("由输入框承接自然修正，并移除回复版本与事件日志快捷入口", async () => {
    const onAction = vi.fn<(action: EventCenteredDialogueWorkspaceAction) => void>();
    render(<EventCenteredDialogueWorkspaceView session={buildSession()} entryDate="2026-07-22" onAction={onAction} />);

    fireEvent.change(screen.getByLabelText("输入当前事件"), { target: { value: "我想换个角度说这件事" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(onAction).toHaveBeenCalledWith({ action: "reply", rawText: "我想换个角度说这件事" });
    await waitFor(() => expect(screen.getByLabelText("输入当前事件")).toHaveValue(""));

    expect(screen.queryByRole("button", { name: "换个问法" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "纠正理解" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "问得轻一点" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成事件日志" })).not.toBeInTheDocument();
  });

  it("标题区只保留记录信息，把暂停动作交给顶部导航", () => {
    render(<EventCenteredDialogueWorkspaceView session={buildSession()} entryDate="2026-07-22" onAction={vi.fn()} />);

    const title = screen.getByRole("heading", { name: "事件 1" });
    expect(title).toHaveClass("font-ui");
    expect(title.parentElement).toHaveTextContent("7 月 22 日 · 事件记录");
    expect(screen.queryByTestId("event-centered-next-event-blocker")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "暂存当前片段" })).not.toBeInTheDocument();
  });

  it("在有生成 Trace 时保留反馈入口", () => {
    const withTrace = buildSession({ messages: [{ ...buildSession().messages[0], generationTraceId: "trace-1" }] });
    render(<EventCenteredDialogueWorkspaceView session={withTrace} entryDate="2026-07-22" onAction={vi.fn()} />);
    expect(screen.getByTestId("ai-feedback-trace-1")).toBeInTheDocument();
  });

  it("开场引导不显示赞踩、重新生成或版本切换", () => {
    const opening = buildSession({
      messages: [{
        ...buildSession().messages[0],
        generationTraceId: "trace-opening-1",
        assistantPayload: {
          ...buildSession().messages[0].assistantPayload!,
          naturalUnderstanding: "",
          naturalResponse: "从你最想说的那一部分开始吧。",
          responseKind: "opening",
          questionSpec: null
        }
      }]
    });
    opening.messages[0]!.assistantPayload!.naturalUnderstanding = "我在听。";
    const { container } = render(<EventCenteredDialogueWorkspaceView session={opening} entryDate="2026-07-22" onAction={vi.fn()} />);

    expect(screen.getByText("从你最想说的那一部分开始吧。")).toBeVisible();
    expect(container.querySelectorAll('[data-message-role="assistant"]')).toHaveLength(1);
    expect(screen.queryByText("我在听。")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-feedback-trace-opening-1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新生成" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "回复操作" })).not.toBeInTheDocument();
  });

  it("跟随帮我记入口显示对应的记录模式", () => {
    render(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        recordMode="capture"
        onAction={vi.fn()}
      />
    );

    expect(screen.getByText("帮我记")).toBeInTheDocument();
    expect(screen.queryByText("陪我聊")).not.toBeInTheDocument();
  });

  it("帮我记的确定性保存回执不显示生成反馈或重新生成", () => {
    const captureSession = buildSession({
      messages: [{
        ...buildSession().messages[0],
        generationTraceId: "trace-capture-1"
      }]
    });

    render(
      <EventCenteredDialogueWorkspaceView
        session={captureSession}
        entryDate="2026-07-22"
        recordMode="capture"
        onAction={vi.fn()}
      />
    );

    expect(screen.queryByRole("group", { name: "回复操作" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-feedback-trace-capture-1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新生成" })).not.toBeInTheDocument();
  });

  it("将理解和提问依次放进两个同款 AI 气泡，并只保留一组回复操作", () => {
    const assistant = {
      ...buildSession().messages[0],
      id: "assistant-latest",
      sequence: 3,
      generationTraceId: "trace-combined-1"
    };
    const withTrace = buildSession({
      messages: [
        {
          id: "user-short",
          role: "user",
          content: "123",
          rawText: "123",
          sequence: 2,
          userTurnId: "turn-short",
          assistantPayload: null,
          responseVersion: null,
          createdAt: "2026-07-22T08:01:00.000Z"
        },
        assistant
      ]
    });
    const { container } = render(
      <EventCenteredDialogueWorkspaceView
        session={withTrace}
        entryDate="2026-07-22"
        feedbackMode="local"
        onAction={vi.fn()}
      />
    );

    const assistantBubbles = container.querySelectorAll('[data-message-role="assistant"]');
    expect(assistantBubbles).toHaveLength(2);
    expect(assistantBubbles[0]).toHaveTextContent("我会先贴着这件事来听。");
    expect(assistantBubbles[0]).not.toHaveTextContent("刚刚发生了什么？");
    expect(assistantBubbles[1]).toHaveTextContent("刚刚发生了什么？");
    expect(assistantBubbles[0].className).toBe(assistantBubbles[1].className);
    expect(assistantBubbles[0]).toHaveClass("text-[15px]", "leading-[26px]", "font-normal");
    expect(assistantBubbles[1]).toHaveClass("text-[15px]", "leading-[26px]", "font-normal");
    expect(assistantBubbles[0].parentElement).toHaveClass("justify-start");
    const userBubble = container.querySelector('[data-message-role="user"]');
    expect(userBubble).toHaveTextContent("123");
    expect(userBubble).toHaveClass("max-w-[min(68%,44rem)]", "text-[15px]", "leading-[26px]");
    expect(userBubble?.parentElement).toHaveClass("justify-end");
    expect(screen.getAllByTestId("ai-feedback-trace-combined-1")).toHaveLength(1);
    expect(screen.getByTestId("ai-feedback-trace-combined-1")).toHaveAttribute("data-feedback-mode", "local");
    const actions = screen.getByRole("group", { name: "回复操作" });
    expect(within(actions).getAllByRole("button").slice(0, 3).map((button) => button.getAttribute("aria-label") || button.textContent)).toEqual([
      "赞",
      "踩",
      "重新生成"
    ]);
  });

  it("重生成入口不依赖 Trace，并从循环图标打开三个轻量方向", async () => {
    const onAction = vi.fn<(action: EventCenteredDialogueWorkspaceAction) => void>();
    render(<EventCenteredDialogueWorkspaceView session={buildSession()} entryDate="2026-07-22" onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    expect(screen.getByRole("menu", { name: "选择重新生成方向" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /更简单一点/u })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /更具体一点/u })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /换一个角度/u })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /更具体一点/u }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith({
      action: "regenerate_response",
      targetMessageId: "opening-1",
      regenerationIntent: "concretize"
    }));
    await waitFor(() => expect(screen.getByRole("button", { name: "重新生成" })).toHaveFocus());
  });

  it("以陪我聊为主入口开始当天记录，并让历史日期保持准确", () => {
    const onStart = vi.fn();
    const { rerender } = render(
      <EventCenteredStartWorkspaceView entryDate={getTodayEntryDate()} onStart={onStart} />
    );

    const chat = screen.getByRole("button", { name: /陪我聊.*我来问，你来说/u });
    const capture = screen.getByRole("button", { name: /帮我记.*你来说，我在听/u });
    expect(screen.getByRole("heading", { name: "新记录" })).toHaveClass("font-ui");
    expect(screen.getByText("今天想怎么记？").closest('[data-message-role="assistant"]')).toBeVisible();
    expect(screen.getByPlaceholderText("先选择一种记录方式")).toBeDisabled();
    expect(chat).toHaveClass("bg-[var(--paper-deep)]", "text-[var(--paper-main)]");
    expect(capture).toHaveClass("bg-[var(--paper-soft)]");
    const startComposer = screen.getByTestId("event-centered-start-composer");
    expect(startComposer).toHaveClass("pointer-events-auto");
    expect(startComposer).not.toHaveClass("mx-auto");
    expect(startComposer.parentElement).toHaveClass("absolute", "pointer-events-none");

    rerender(
      <EventCenteredStartWorkspaceView
        entryDate={getTodayEntryDate()}
        busy
        pendingRecordMode="capture"
        onStart={onStart}
      />
    );
    expect(screen.getByRole("button", { name: /帮我记.*正在准备…/u })).toHaveAttribute("aria-busy", "true");

    rerender(<EventCenteredStartWorkspaceView entryDate="2026-07-22" onStart={onStart} />);
    expect(screen.getByText("7 月 22 日想怎么记？").closest('[data-message-role="assistant"]')).toBeVisible();
    expect(screen.queryByText("今天")).not.toBeInTheDocument();
  });

  it("让生成中的理解与提问沿用同一气泡，并把失败恢复留在第二个气泡内", () => {
    const { container, rerender } = render(
      <EventCenteredDialogueWorkspaceView
        session={buildSession({ messages: [] })}
        entryDate="2026-07-22"
        streamPreview={{ phase: "understanding", summary: "我听见你刚才松了一口气。", response: "" }}
        onAction={vi.fn()}
      />
    );

    let bubbles = container.querySelectorAll('[data-message-role="assistant"]');
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]).toHaveTextContent("我听见你刚才松了一口气。");
    expect(screen.queryByText("正在整理下一步")).not.toBeInTheDocument();

    rerender(
      <EventCenteredDialogueWorkspaceView
        session={buildSession({ messages: [] })}
        entryDate="2026-07-22"
        streamPreview={{ phase: "responding", summary: "我听见你刚才松了一口气。", response: "" }}
        onAction={vi.fn()}
      />
    );
    bubbles = container.querySelectorAll('[data-message-role="assistant"]');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[1]).toHaveTextContent("正在回复…");
    expect(bubbles[0].className).toBe(bubbles[1].className);

    rerender(
      <EventCenteredDialogueWorkspaceView
        session={buildSession({ messages: [], dialogue: { ...buildSession().dialogue, allowedActions: ["resume_turn"] } })}
        entryDate="2026-07-22"
        streamPreview={{ phase: "recovery_failed", summary: "我听见你刚才松了一口气。", response: "" }}
        onAction={vi.fn()}
      />
    );
    bubbles = container.querySelectorAll('[data-message-role="assistant"]');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]).toHaveTextContent("我听见你刚才松了一口气。");
    expect(bubbles[1]).toHaveTextContent("这段话已保存，回复还没完成");
    expect(within(bubbles[1] as HTMLElement).getByRole("button", { name: "继续生成" })).toBeInTheDocument();
  });

  it("完成后保留原对话并进入只读状态，承接对应日期日记和新记录", () => {
    const onCreateEvent = vi.fn();
    render(
      <EventCenteredDialogueWorkspaceView
        session={buildSession({ sessionStatus: "completed", eventStatus: "completed" })}
        entryDate="2026-07-22"
        canCreateEvent
        showCompletionHandoff
        onAction={vi.fn()}
        onCreateEvent={onCreateEvent}
      />
    );

    expect(screen.getByText("我会先贴着这件事来听。")).toBeVisible();
    expect(screen.getByTestId("event-centered-completion-inline")).toHaveTextContent("已记下");
    expect(screen.getByTestId("event-centered-completion-inline")).toHaveTextContent("这件事已经放进 7月22日的记录");
    expect(screen.queryByText(/今天/u)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看 7月22日日记" })).toHaveAttribute(
      "href",
      "/calendar?view=day&date=2026-07-22"
    );
    fireEvent.click(screen.getByRole("button", { name: "新建记录" }));
    expect(onCreateEvent).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("输入当前事件")).toBeDisabled();
    expect(screen.getByLabelText("输入当前事件")).toHaveAttribute(
      "placeholder",
      "这条记录已经完成，如需继续，请新建一条记录。"
    );
    expect(screen.queryByRole("group", { name: "回复操作" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新生成" })).not.toBeInTheDocument();
  });

  it("空记录结束后说明未形成记录卡，并且不会显示完成成功反馈", () => {
    const onCreateEvent = vi.fn();
    render(
      <EventCenteredDialogueWorkspaceView
        session={buildSession({
          sessionStatus: "abandoned",
          eventStatus: "abandoned",
          journalEvent: {
            ...buildSession().journalEvent!,
            status: "abandoned",
            abandonedAt: "2026-07-22T09:00:00.000Z"
          },
          dialogue: { ...buildSession().dialogue, allowedActions: [] }
        })}
        entryDate="2026-07-22"
        showRecordRail={false}
        canCreateEvent
        onAction={vi.fn()}
        onCreateEvent={onCreateEvent}
      />
    );

    expect(screen.getByTestId("event-centered-abandoned-inline")).toHaveTextContent("这条空记录已结束");
    expect(screen.getByTestId("event-centered-abandoned-inline")).toHaveTextContent("还没有形成记录卡");
    expect(screen.queryByTestId("event-centered-completion-inline")).not.toBeInTheDocument();
    expect(screen.queryByText("已记下")).not.toBeInTheDocument();
    expect(screen.queryByText(/已经放进/u)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /查看.*日记/u })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "新建记录" }));
    expect(onCreateEvent).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("输入当前事件")).toHaveAttribute(
      "placeholder",
      "这条空记录已经结束，如需记录，请新建一条记录。"
    );
  });

  it("在错误气泡中保留恢复说明、请求标识和唯一刷新动作", () => {
    const onResolveIssue = vi.fn();
    render(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        error={{
          code: "INTERVIEW_TURN_OUT_OF_DATE",
          title: "当前对话已经更新",
          message: "这条回复对应的是较早的对话位置。",
          resolution: "请刷新页面查看最新问题，再重新发送。",
          requestId: "ir_request_1",
          retryable: true,
          action: "refresh"
        }}
        onAction={vi.fn()}
        onResolveIssue={onResolveIssue}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("这条回复对应的是较早的对话位置。");
    expect(alert).toHaveTextContent("请刷新页面查看最新问题，再重新发送。");
    expect(alert).toHaveTextContent("请求标识 ir_request_1");
    fireEvent.click(within(alert).getByRole("button", { name: "刷新到最新记录" }));
    expect(onResolveIssue).toHaveBeenCalledOnce();
    expect(within(alert).getAllByRole("button")).toHaveLength(1);
  });

  it("输入区复用生产悬浮透明材质，并让会话主区占满剩余宽度", () => {
    render(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        showRecordRail={false}
        onAction={vi.fn()}
      />
    );

    const composer = screen.getByTestId("event-centered-composer");
    expect(composer).toHaveClass("liquid-composer", "max-w-[70rem]", "pointer-events-auto");
    expect(composer).not.toHaveClass("mx-auto");
    expect(composer).not.toHaveClass("bg-[var(--header-surface-strong)]", "border-[var(--line-soft)]");
    expect(screen.getByTestId("event-centered-composer-dock")).toHaveClass(
      "absolute",
      "pointer-events-none"
    );
    expect(screen.getByTestId("event-centered-composer-dock")).not.toHaveClass("shrink-0");
    expect(screen.getByTestId("event-centered-message-track")).toHaveStyle({ paddingBottom: "128px" });
    expect(screen.getByTestId("event-centered-message-viewport")).toHaveStyle({ scrollPaddingBottom: "128px" });
    expect(screen.getByTestId("event-centered-message-track")).not.toHaveClass("mx-auto", "pb-32", "pb-64");
    expect(screen.getByRole("tabpanel")).toHaveClass("min-w-0", "flex-1");
    expect(screen.getByRole("button", { name: "发送" })).toHaveClass("size-11");
  });

  it("新回复自动保持可见，用户主动回看历史后停止抢动滚动位置", () => {
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { rerender } = render(
      <EventCenteredDialogueWorkspaceView session={buildSession()} entryDate="2026-07-22" onAction={vi.fn()} />
    );
    const viewport = screen.getByTestId("event-centered-message-viewport");
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 900 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 300 });

    rerender(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        streamPreview={{ phase: "understanding", summary: "我听见了。", response: "" }}
        onAction={vi.fn()}
      />
    );
    expect(viewport.scrollTop).toBe(900);

    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);
    rerender(
      <EventCenteredDialogueWorkspaceView
        session={buildSession()}
        entryDate="2026-07-22"
        streamPreview={{ phase: "responding", summary: "我听见了。", response: "接下来想问你一件事。" }}
        onAction={vi.fn()}
      />
    );
    expect(viewport.scrollTop).toBe(0);
    requestFrame.mockRestore();
    cancelFrame.mockRestore();
  });
});
