"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActionButton, Surface } from "@/components/ui";
import {
  EventCenteredDialogueWorkspaceView,
  EventCenteredStartWorkspaceView,
  type EventCenteredDialogueTab,
  type EventCenteredDialogueWorkspaceAction
} from "@/components/interview/event-centered/event-centered-dialogue-workspace-view";
import { useEventCenteredInterviewChromeOptional } from "@/components/interview/event-centered/event-centered-interview-chrome-context";
import {
  createEventCenteredClientTurnId,
  EventCenteredWorkspaceRequestError,
  ensureBoard8Gi066ReviewSession,
  getEventCenteredSessionTabs,
  getEventCenteredWorkspace,
  respondInEventCenteredWorkspace,
  startEventCenteredWorkspace,
  type EventCenteredWorkspaceIssue
} from "@/features/interview/event-centered/workspace-client";
import {
  clearEventCenteredWorkspaceOutbox,
  readEventCenteredComposerDraft,
  readEventCenteredWorkspaceOutbox,
  writeEventCenteredComposerDraft,
  writeEventCenteredWorkspaceOutbox,
  type EventCenteredWorkspaceOutboxRecord
} from "@/features/interview/event-centered/workspace-storage";
import type {
  EventCenteredRespondRequest,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";

const EVENT_CENTERED_MODE = "event-centered";

export type EventCenteredWorkspaceHrefOptions = {
  entryDate: string;
  sessionId: string;
  panel?: "journal";
  eventEntryId?: string | null;
};

export function buildEventCenteredWorkspaceHref({
  entryDate,
  sessionId,
  panel,
  eventEntryId
}: EventCenteredWorkspaceHrefOptions) {
  const params = new URLSearchParams({
    mode: EVENT_CENTERED_MODE,
    sessionId,
    entryDate
  });
  if (panel === "journal") params.set("panel", "journal");
  if (panel === "journal" && eventEntryId) params.set("eventEntryId", eventEntryId);
  return `/interview?${params.toString()}`;
}

type WorkspaceNotice = Pick<EventCenteredWorkspaceIssue, "title" | "message">;

type StreamPreview = {
  phase: string | null;
  summary: string;
  response: string;
};

function toWorkspaceNotice(error: unknown): WorkspaceNotice {
  if (error instanceof EventCenteredWorkspaceRequestError) {
    return { title: error.issue.title, message: error.issue.message };
  }
  return {
    title: "这一步暂时没有完成",
    message: "你的输入会继续留在这里。请稍后继续，或刷新到最新对话。"
  };
}

async function getEventTabs(entryDate: string): Promise<EventCenteredDialogueTab[]> {
  try {
    return await getEventCenteredSessionTabs(entryDate);
  } catch {
    return [];
  }
}

function updateWorkspaceAddress(input: {
  entryDate: string;
  sessionId: string;
}) {
  if (typeof window === "undefined") return;
  const href = buildEventCenteredWorkspaceHref({
    entryDate: input.entryDate,
    sessionId: input.sessionId
  });
  window.history.replaceState(window.history.state, "", href);
}

function updateWorkspaceStartAddress(entryDate: string) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams({ mode: EVENT_CENTERED_MODE, entryDate });
  window.history.replaceState(window.history.state, "", `/interview?${params.toString()}`);
}

function requestForAction(input: {
  workspace: EventCenteredWorkspaceSession;
  action: EventCenteredDialogueWorkspaceAction;
  clientTurnId?: string;
}): EventCenteredRespondRequest {
  const { workspace, action, clientTurnId } = input;
  const pending = workspace.recovery.pendingTurn;
  const base = {
    rootSessionId: workspace.rootSessionId,
    clientTurnId: action.action === "resume_turn" && pending
      ? pending.clientTurnId
      : clientTurnId ?? createEventCenteredClientTurnId(),
    baseBranchSessionId: workspace.activeBranchSessionId,
    baseMessageSequence: workspace.latestMessageSequence
  };

  if (action.action === "reply") {
    return { ...base, action: "reply", rawText: action.rawText, inputMode: "text" };
  }
  if (action.action === "select_exploration_angle") return { ...base, ...action };
  if (action.action === "select_current_event") {
    return { ...base, ...action, rawText: action.rawText ?? action.optionId };
  }
  if (action.action === "continue_exploration") return { ...base, ...action };
  if (action.action === "correct_understanding") return { ...base, ...action, inputMode: "text" };
  if (action.action === "regenerate_response") return { ...base, ...action };
  if (action.action === "switch_response_version") return { ...base, ...action };
  if (action.action === "resume_turn") return { ...base, action: "resume_turn" };
  if (action.action === "generate_event_journal") {
    throw new Error("EVENT_JOURNAL_REQUIRES_DEDICATED_ENDPOINT");
  }
  return { ...base, action: "exit_event" };
}

function scopeForWorkspace(workspace: EventCenteredWorkspaceSession) {
  return {
    rootSessionId: workspace.rootSessionId,
    branchSessionId: workspace.activeBranchSessionId
  };
}

function canReuseOutbox(input: {
  outbox: EventCenteredWorkspaceOutboxRecord | null;
  workspace: EventCenteredWorkspaceSession;
  action: EventCenteredDialogueWorkspaceAction;
}) {
  const { outbox, workspace, action } = input;
  if (!outbox || outbox.status === "accepted") return false;
  const request = outbox.request;
  if (
    request.rootSessionId !== workspace.rootSessionId ||
    request.baseBranchSessionId !== workspace.activeBranchSessionId ||
    request.baseMessageSequence !== workspace.latestMessageSequence
  ) return false;
  if (action.action === "reply") {
    return request.action === "reply" && request.rawText === action.rawText;
  }
  if (action.action === "correct_understanding") {
    return request.action === "correct_understanding" &&
      request.rawText === action.rawText &&
      request.targetMessageId === action.targetMessageId;
  }
  return false;
}

export function EventCenteredInterviewWorkspace({
  entryDate,
  initialSessionId = null,
  initialRecordMode = null,
  writeEnabled = true,
  syncAddress = true,
  layout = "viewport",
  previewAuth = false,
  onWorkspaceChange
}: {
  entryDate: string;
  initialSessionId?: string | null;
  initialJournalPanelOpen?: boolean;
  initialEventEntryId?: string | null;
  initialRecordMode?: "capture" | "chat" | null;
  writeEnabled?: boolean;
  syncAddress?: boolean;
  /** 标准访谈固定在可用视口内；嵌入评审页时交由外层确定高度。 */
  layout?: "viewport" | "embedded";
  /** GI-066 本机人工评审页使用隔离 Preview 身份建立工作台会话。 */
  previewAuth?: boolean;
  onWorkspaceChange?: (workspace: EventCenteredWorkspaceSession) => void;
}) {
  const [requestedSessionId, setRequestedSessionId] = useState(initialSessionId);
  const [workspace, setWorkspace] = useState<EventCenteredWorkspaceSession | null>(null);
  const [tabs, setTabs] = useState<EventCenteredDialogueTab[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRecordMode, setPendingRecordMode] = useState<"capture" | "chat" | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingSession, setSwitchingSession] = useState(false);
  const [streamPreview, setStreamPreview] = useState<StreamPreview | null>(null);
  const [outbox, setOutbox] = useState<EventCenteredWorkspaceOutboxRecord | null>(null);
  const [completionHandoffSessionId, setCompletionHandoffSessionId] = useState<string | null>(null);
  const [previewAuthReady, setPreviewAuthReady] = useState(!previewAuth);
  const consumedRecordModeKeyRef = useRef<string | null>(null);
  // 访谈工作区也会被独立评审壳层复用；没有全站导航时继续保持可渲染。
  const interviewChrome = useEventCenteredInterviewChromeOptional();
  const setInterviewChromeState = interviewChrome?.setState;
  const workspaceLayoutClass = layout === "viewport"
    ? "flex h-[calc(100dvh-var(--site-header-viewport-offset))] min-h-0 flex-col"
    : "flex min-h-0 flex-1 flex-col";

  const refreshTabs = useCallback(async () => {
    const nextTabs = await getEventTabs(entryDate);
    setTabs(nextTabs);
  }, [entryDate]);

  const loadWorkspace = useCallback(async (sessionId?: string | null) => {
    if (!sessionId && !writeEnabled) {
      setWorkspace(null);
      setNotice({
        title: "事件记录当前处于只读状态",
        message: "已有事件可以通过日历或原链接继续阅读。"
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    if (sessionId) setSwitchingSession(true);
    setNotice(null);
    try {
      if (!sessionId) {
        setWorkspace(null);
        await refreshTabs();
        return;
      }
      const nextWorkspace = await getEventCenteredWorkspace(sessionId);
      setWorkspace(nextWorkspace);
      await refreshTabs();
    } catch (error) {
      setWorkspace(null);
      setNotice(toWorkspaceNotice(error));
    } finally {
      setLoading(false);
      setSwitchingSession(false);
    }
  }, [refreshTabs, writeEnabled]);

  const startEvent = useCallback(async (recordMode: "capture" | "chat") => {
    if (busy || !writeEnabled) return;
    setBusy(true);
    setPendingRecordMode(recordMode);
    setCompletionHandoffSessionId(null);
    setNotice(null);
    try {
      const nextWorkspace = await startEventCenteredWorkspace(entryDate, recordMode);
      setWorkspace(nextWorkspace);
      setRequestedSessionId(nextWorkspace.rootSessionId);
      setDraft("");
      setOutbox(null);
      if (syncAddress) {
        updateWorkspaceAddress({
          entryDate,
          sessionId: nextWorkspace.rootSessionId
        });
      }
      await refreshTabs();
    } catch (error) {
      setNotice(toWorkspaceNotice(error));
    } finally {
      setBusy(false);
      setPendingRecordMode(null);
    }
  }, [busy, entryDate, refreshTabs, syncAddress, writeEnabled]);

  useEffect(() => {
    setRequestedSessionId(initialSessionId);
    setDraft("");
    setCompletionHandoffSessionId(null);
  }, [entryDate, initialSessionId]);

  useEffect(() => {
    if (!workspace) return;
    const scope = scopeForWorkspace(workspace);
    const savedOutbox = readEventCenteredWorkspaceOutbox(scope);
    const pending = workspace.recovery.pendingTurn;
    const savedDraft = readEventCenteredComposerDraft(scope);

    if (savedOutbox?.status === "accepted" && !pending) {
      const alreadyVisible = Boolean(
        workspace.messages.some((message) =>
          message.role === "user" &&
          message.clientTurnId === savedOutbox.request.clientTurnId
        )
      );
      if (alreadyVisible) {
        clearEventCenteredWorkspaceOutbox(scope);
        setOutbox(null);
        setDraft("");
        writeEventCenteredComposerDraft(scope, "");
        return;
      }
    }
    setOutbox(savedOutbox);
    setDraft(pending ? "" : savedDraft);
    // 本地草稿只在切换事件或活动分支时恢复，普通消息刷新不能覆盖正在输入的文字。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.activeBranchSessionId, workspace?.rootSessionId]);

  useEffect(() => {
    if (!previewAuth) {
      setPreviewAuthReady(true);
      return;
    }
    let active = true;
    setPreviewAuthReady(false);
    void ensureBoard8Gi066ReviewSession()
      .then(() => {
        if (active) setPreviewAuthReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setNotice(toWorkspaceNotice(error));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [previewAuth]);

  useEffect(() => {
    if (previewAuth && !previewAuthReady) return;
    if (requestedSessionId) {
      // 创建记录后 workspace 已经是最新结果，等待后续刷新时不要再发起一次读取。
      if (workspace?.rootSessionId === requestedSessionId) return;
      void loadWorkspace(requestedSessionId);
      return;
    }
    if (initialRecordMode) {
      const recordModeKey = `${entryDate}:${initialRecordMode}`;
      if (consumedRecordModeKeyRef.current === recordModeKey) {
        void loadWorkspace(null);
        return;
      }
      consumedRecordModeKeyRef.current = recordModeKey;
      void startEvent(initialRecordMode);
      return;
    }
    void loadWorkspace(null);
  }, [entryDate, initialRecordMode, loadWorkspace, previewAuth, previewAuthReady, requestedSessionId, startEvent, workspace?.rootSessionId]);

  useEffect(() => {
    if (!workspace) return;
    onWorkspaceChange?.(workspace);
  }, [onWorkspaceChange, workspace]);

  useEffect(() => {
    if (!workspace || !syncAddress) return;
    updateWorkspaceAddress({
      entryDate,
      sessionId: workspace.rootSessionId
    });
  }, [entryDate, syncAddress, workspace]);

  const canCreateEvent = Boolean(
    writeEnabled &&
      (workspace?.sessionStatus === "completed" || workspace?.sessionStatus === "abandoned") &&
      (workspace.eventStatus === "completed" || workspace.eventStatus === "abandoned")
  );

  const performAction = useCallback(async (action: EventCenteredDialogueWorkspaceAction) => {
    if (!workspace || busy || switchingSession || !writeEnabled) return;
    const scope = scopeForWorkspace(workspace);
    const reusable = canReuseOutbox({ outbox, workspace, action }) ? outbox : null;
    const request = requestForAction({
      workspace,
      action,
      clientTurnId: reusable?.request.clientTurnId
    });
    const nextOutbox: EventCenteredWorkspaceOutboxRecord = {
      request,
      status: "submitting",
      createdAt: reusable?.createdAt ?? new Date().toISOString()
    };
    if (action.action !== "resume_turn") {
      writeEventCenteredWorkspaceOutbox(scope, nextOutbox);
      setOutbox(nextOutbox);
    }
    let accepted = false;
    setBusy(true);
    setNotice(null);
    setStreamPreview({ phase: "sending", summary: "", response: "" });
    try {
      const nextWorkspace = await respondInEventCenteredWorkspace({
        request,
        onTurn: () => {
          accepted = true;
          const acceptedOutbox = { ...nextOutbox, status: "accepted" as const };
          writeEventCenteredWorkspaceOutbox(scope, acceptedOutbox);
          setOutbox(acceptedOutbox);
        },
        onPhase: (phase) => setStreamPreview((current) => ({
          phase,
          summary: current?.summary ?? "",
          response: current?.response ?? ""
        })),
        onDelta: ({ target, value }) => setStreamPreview((current) => ({
          phase: current?.phase ?? "responding",
          summary: target === "summary" ? value : current?.summary ?? "",
          response: target === "response" ? value : current?.response ?? ""
        })),
        onSession: setWorkspace
      });
      setWorkspace(nextWorkspace);
      if (
        action.action === "exit_event" &&
        (nextWorkspace.sessionStatus === "completed" || nextWorkspace.sessionStatus === "abandoned") &&
        (nextWorkspace.eventStatus === "completed" || nextWorkspace.eventStatus === "abandoned")
      ) {
        setCompletionHandoffSessionId(nextWorkspace.rootSessionId);
      }
      setStreamPreview(null);
      setNotice(null);
      clearEventCenteredWorkspaceOutbox(scope);
      setOutbox(null);
      await refreshTabs();
    } catch (error) {
      setNotice(toWorkspaceNotice(error));
      if (accepted) {
        try {
          const recoveredWorkspace = await getEventCenteredWorkspace(workspace.rootSessionId);
          setWorkspace(recoveredWorkspace);
          setNotice(null);
          setStreamPreview((current) => recoveredWorkspace.recovery.pendingTurn
            ? {
                phase: "recovery_failed",
                summary: current?.summary ?? "",
                response: ""
              }
            : null);
          await refreshTabs();
          return;
        } catch {
          setStreamPreview((current) => ({
            phase: "recovery_failed",
            summary: current?.summary ?? "",
            response: ""
          }));
          const acceptedOutbox = { ...nextOutbox, status: "accepted" as const };
          writeEventCenteredWorkspaceOutbox(scope, acceptedOutbox);
          setOutbox(acceptedOutbox);
          return;
        }
      }
      setStreamPreview(null);
      if (action.action !== "resume_turn") {
        const failedOutbox = { ...nextOutbox, status: "failed" as const };
        writeEventCenteredWorkspaceOutbox(scope, failedOutbox);
        setOutbox(failedOutbox);
      }
      throw error;
    } finally {
      setBusy(false);
    }
  }, [busy, outbox, refreshTabs, switchingSession, workspace, writeEnabled]);

  const handleViewAction = useCallback(async (action: EventCenteredDialogueWorkspaceAction) => {
    if (action.action === "generate_event_journal") {
      setNotice({
        title: "这件事会留在当天",
        message: "回到日记后，可以和当天的其他记录一起整理。"
      });
      return;
    }
    try {
      await performAction(action);
    } catch (error) {
      // 输入框会依据抛出的错误保留草稿；其余按钮的失败信息已在工作台内展示。
      if (
        action.action === "reply" ||
        action.action === "select_current_event" ||
        action.action === "correct_understanding"
      ) throw error;
    }
  }, [performAction]);

  useEffect(() => {
    if (!setInterviewChromeState) return;
    if (!workspace) {
      setInterviewChromeState(null);
      return () => setInterviewChromeState(null);
    }

    const hasUserMessage = workspace.messages.some((message) => message.role === "user") || Boolean(outbox?.request.rawText);
    const completed = workspace.sessionStatus === "completed" || workspace.sessionStatus === "abandoned";
    const canComplete = Boolean(
      writeEnabled &&
      !completed &&
      hasUserMessage &&
      workspace.dialogue.allowedActions.includes("exit_event")
    );
    setInterviewChromeState({
      recordMode: workspace.recordMode ?? initialRecordMode ?? "chat",
      entryDate: workspace.entryDate,
      progress: workspace.dialogue.progress,
      hasUserMessage,
      canComplete,
      busy: busy || switchingSession,
      onComplete: canComplete ? () => { void handleViewAction({ action: "exit_event" }); } : null
    });

    return () => setInterviewChromeState(null);
  }, [busy, handleViewAction, initialRecordMode, outbox?.request.rawText, setInterviewChromeState, switchingSession, workspace, writeEnabled]);

  const handleComposerDraftChange = useCallback((nextDraft: string) => {
    setDraft(nextDraft);
    if (workspace) writeEventCenteredComposerDraft(scopeForWorkspace(workspace), nextDraft);
  }, [workspace]);

  const returnToRecordModeSelection = useCallback(() => {
    setWorkspace(null);
    setRequestedSessionId(null);
    setCompletionHandoffSessionId(null);
    setDraft("");
    setOutbox(null);
    setStreamPreview(null);
    setNotice(null);
    if (syncAddress) updateWorkspaceStartAddress(entryDate);
    void refreshTabs();
  }, [entryDate, refreshTabs, syncAddress]);

  const loadingMessage = requestedSessionId
    ? "正在恢复这件事…"
    : initialRecordMode
      ? "正在准备新的记录…"
      : "正在打开访谈…";

  if (loading && !workspace) {
    if (!requestedSessionId && !initialRecordMode) {
      return (
        <div data-testid="event-centered-workspace-layout" className={workspaceLayoutClass}>
          <EventCenteredStartWorkspaceView
            entryDate={entryDate}
            tabs={tabs}
            busy
            onStart={(recordMode) => void startEvent(recordMode)}
          />
        </div>
      );
    }
    return (
      <div data-testid="event-centered-workspace-layout" className={workspaceLayoutClass}>
        <Surface className="flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-y-0">
          <p role="status" className="font-ui text-sm text-[var(--text-dim)]">{loadingMessage}</p>
        </Surface>
      </div>
    );
  }

  if (!workspace && writeEnabled && !requestedSessionId) {
    return (
      <div data-testid="event-centered-workspace-layout" className={workspaceLayoutClass}>
        <EventCenteredStartWorkspaceView
          entryDate={entryDate}
          tabs={tabs}
          busy={busy || switchingSession}
          pendingRecordMode={pendingRecordMode}
          error={notice}
          onStart={(recordMode) => void startEvent(recordMode)}
          onSelectTab={(rootSessionId) => {
            if (busy || switchingSession) return;
            setCompletionHandoffSessionId(null);
            setRequestedSessionId(rootSessionId);
            setNotice(null);
          }}
        />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div data-testid="event-centered-workspace-layout" className={workspaceLayoutClass}>
        <Surface className="flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-y-0 p-6">
          <div role="alert" className="max-w-lg text-center font-ui">
            <p className="font-medium text-ink">{notice?.title ?? "暂时无法打开事件记录"}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{notice?.message ?? "请稍后重试。"}</p>
            {writeEnabled ? <ActionButton className="mt-4" onClick={() => void loadWorkspace(requestedSessionId)}>再试一次</ActionButton> : null}
          </div>
        </Surface>
      </div>
    );
  }

  const optimisticUserMessage = outbox &&
    outbox.status !== "failed" &&
    (outbox.request.action === "reply" || outbox.request.action === "correct_understanding") &&
    outbox.request.rawText &&
    !workspace.messages.some((message) => message.clientTurnId === outbox.request.clientTurnId)
    ? {
        clientTurnId: outbox.request.clientTurnId,
        rawText: outbox.request.rawText,
        status: outbox.status
      }
    : null;

  return (
    <div data-testid="event-centered-workspace-layout" className={workspaceLayoutClass}>
      <EventCenteredDialogueWorkspaceView
        session={workspace}
        entryDate={entryDate}
        recordMode={workspace.recordMode ?? initialRecordMode ?? "chat"}
        tabs={tabs}
        activeTabId={workspace.rootSessionId}
        busy={busy || switchingSession}
        readOnly={!writeEnabled || workspace.sessionStatus === "abandoned" || workspace.eventStatus === "abandoned"}
        canCreateEvent={canCreateEvent}
        showCompletionHandoff={completionHandoffSessionId === workspace.rootSessionId}
        composerDraft={draft}
        optimisticUserMessage={optimisticUserMessage}
        streamPreview={streamPreview}
        error={notice}
        onComposerDraftChange={handleComposerDraftChange}
        onAction={handleViewAction}
        onCreateEvent={returnToRecordModeSelection}
        onSelectTab={(rootSessionId) => {
          if (rootSessionId === workspace.rootSessionId) return;
          setCompletionHandoffSessionId(null);
          setRequestedSessionId(rootSessionId);
          setNotice(null);
          setDraft("");
        }}
      />
    </div>
  );
}
