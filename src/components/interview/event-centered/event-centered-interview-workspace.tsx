"use client";

import { useCallback, useEffect, useState } from "react";

import { ActionButton, Surface } from "@/components/ui";
import {
  EventCenteredDialogueWorkspaceView,
  type EventCenteredDialogueTab,
  type EventCenteredDialogueWorkspaceAction
} from "@/components/interview/event-centered/event-centered-dialogue-workspace-view";
import {
  createEventCenteredClientTurnId,
  EventCenteredWorkspaceRequestError,
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
import type { EventCalendarEventRecord } from "@/types/event-calendar";
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

function statusForTab(event: EventCalendarEventRecord): EventCenteredDialogueTab["status"] {
  if (event.eventStatus === "completed") return "completed";
  if (event.eventStatus === "generating") return "generating";
  return "active";
}

async function getEventTabs(entryDate: string): Promise<EventCenteredDialogueTab[]> {
  const response = await fetch(`/api/event-calendar/day?date=${encodeURIComponent(entryDate)}`, {
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as { events?: EventCalendarEventRecord[] } | null;
  if (!response.ok || !payload?.events) return [];
  return payload.events.map((event) => ({
    rootSessionId: event.rootSessionId,
    label: event.title?.trim() || `事件 ${event.daySequence}`,
    status: statusForTab(event)
  }));
}

function updateWorkspaceAddress(input: {
  entryDate: string;
  sessionId: string;
  journalOpen: boolean;
  eventEntryId: string | null;
}) {
  if (typeof window === "undefined") return;
  const href = buildEventCenteredWorkspaceHref({
    entryDate: input.entryDate,
    sessionId: input.sessionId,
    panel: input.journalOpen ? "journal" : undefined,
    eventEntryId: input.eventEntryId
  });
  window.history.replaceState(window.history.state, "", href);
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
  initialJournalPanelOpen = false,
  initialEventEntryId = null,
  writeEnabled = true
}: {
  entryDate: string;
  initialSessionId?: string | null;
  initialJournalPanelOpen?: boolean;
  initialEventEntryId?: string | null;
  writeEnabled?: boolean;
}) {
  const [requestedSessionId, setRequestedSessionId] = useState(initialSessionId);
  const [workspace, setWorkspace] = useState<EventCenteredWorkspaceSession | null>(null);
  const [tabs, setTabs] = useState<EventCenteredDialogueTab[]>([]);
  const [draft, setDraft] = useState("");
  const [journalOpen, setJournalOpen] = useState(initialJournalPanelOpen);
  const [journalEventEntryId, setJournalEventEntryId] = useState<string | null>(initialEventEntryId);
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingSession, setSwitchingSession] = useState(false);
  const [streamPreview, setStreamPreview] = useState<StreamPreview | null>(null);
  const [outbox, setOutbox] = useState<EventCenteredWorkspaceOutboxRecord | null>(null);

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
      const nextWorkspace = sessionId
        ? await getEventCenteredWorkspace(sessionId)
        : await startEventCenteredWorkspace(entryDate);
      setWorkspace(nextWorkspace);
      await refreshTabs();
    } catch (error) {
      setWorkspace(null);
      setNotice(toWorkspaceNotice(error));
    } finally {
      setLoading(false);
      setSwitchingSession(false);
    }
  }, [entryDate, refreshTabs, writeEnabled]);

  useEffect(() => {
    setRequestedSessionId(initialSessionId);
    setJournalOpen(initialJournalPanelOpen);
    setJournalEventEntryId(initialEventEntryId);
    setDraft("");
  }, [entryDate, initialEventEntryId, initialJournalPanelOpen, initialSessionId]);

  useEffect(() => {
    if (!workspace) return;
    const scope = scopeForWorkspace(workspace);
    const savedOutbox = readEventCenteredWorkspaceOutbox(scope);
    const pending = workspace.recovery.pendingTurn;
    const savedDraft = readEventCenteredComposerDraft(scope);

    if (savedOutbox?.status === "accepted" && !pending) {
      const alreadyVisible = Boolean(
        savedOutbox.request.rawText &&
        workspace.messages.some((message) => message.role === "user" && message.rawText === savedOutbox.request.rawText)
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
  }, [workspace?.activeBranchSessionId, workspace?.rootSessionId]);

  useEffect(() => {
    void loadWorkspace(requestedSessionId);
  }, [loadWorkspace, requestedSessionId]);

  useEffect(() => {
    if (!workspace) return;
    updateWorkspaceAddress({
      entryDate,
      sessionId: workspace.rootSessionId,
      journalOpen,
      eventEntryId: journalEventEntryId
    });
  }, [entryDate, journalEventEntryId, journalOpen, workspace]);

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
      status: reusable?.status === "failed" ? "failed" : "submitting",
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
      setStreamPreview(null);
      clearEventCenteredWorkspaceOutbox(scope);
      setOutbox(null);
      await refreshTabs();
    } catch (error) {
      setNotice(toWorkspaceNotice(error));
      setStreamPreview(null);
      if (accepted) {
        try {
          const recoveredWorkspace = await getEventCenteredWorkspace(workspace.rootSessionId);
          setWorkspace(recoveredWorkspace);
          await refreshTabs();
          return;
        } catch {
          // 继续抛出原错误，让输入区保留仍未能确认的文字。
        }
      }
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

  async function createNextEvent() {
    if (!canCreateEvent || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const nextWorkspace = await startEventCenteredWorkspace(entryDate);
      setWorkspace(nextWorkspace);
      setRequestedSessionId(nextWorkspace.rootSessionId);
      setDraft("");
      setOutbox(null);
      setJournalOpen(false);
      setJournalEventEntryId(null);
      await refreshTabs();
    } catch (error) {
      setNotice(toWorkspaceNotice(error));
    } finally {
      setBusy(false);
    }
  }

  const handleViewAction = useCallback(async (action: EventCenteredDialogueWorkspaceAction) => {
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

  const handleComposerDraftChange = useCallback((nextDraft: string) => {
    setDraft(nextDraft);
    if (workspace) writeEventCenteredComposerDraft(scopeForWorkspace(workspace), nextDraft);
  }, [workspace]);

  if (loading && !workspace) {
    return (
      <Surface className="flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-y-0">
        <p role="status" className="text-sm text-[var(--text-dim)]">正在恢复这件事…</p>
      </Surface>
    );
  }

  if (!workspace) {
    return (
      <Surface className="flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-y-0 p-6">
        <div role="alert" className="max-w-lg border-l-2 border-[var(--paper-deep)] py-1 pl-4">
          <p className="font-medium text-ink">{notice?.title ?? "暂时无法打开事件记录"}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{notice?.message ?? "请稍后重试。"}</p>
          {writeEnabled ? <ActionButton className="mt-4" onClick={() => void loadWorkspace(requestedSessionId)}>再试一次</ActionButton> : null}
        </div>
      </Surface>
    );
  }

  return (
    <EventCenteredDialogueWorkspaceView
      session={workspace}
      entryDate={entryDate}
      tabs={tabs}
      activeTabId={workspace.rootSessionId}
      busy={busy || switchingSession}
      readOnly={!writeEnabled}
      canCreateEvent={canCreateEvent}
      composerDraft={draft}
      streamPreview={streamPreview}
      journalOpen={journalOpen}
      error={notice}
      onComposerDraftChange={handleComposerDraftChange}
      onJournalOpenChange={setJournalOpen}
      onAction={handleViewAction}
      onCreateEvent={() => void createNextEvent()}
      onSelectTab={(rootSessionId) => {
        if (rootSessionId === workspace.rootSessionId) return;
        setRequestedSessionId(rootSessionId);
        setJournalOpen(false);
        setJournalEventEntryId(null);
        setNotice(null);
        setDraft("");
      }}
    />
  );
}
