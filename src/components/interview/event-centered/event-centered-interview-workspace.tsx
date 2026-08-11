"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActionButton, Surface } from "@/components/ui";
import {
  EventCenteredDialogueWorkspaceView,
  type EventCenteredDialogueTab,
  type EventCenteredDialogueWorkspaceAction
} from "@/components/interview/event-centered/event-centered-dialogue-workspace-view";
import {
  createEventCenteredClientTurnId,
  createEventJournalOperationId,
  EventCenteredWorkspaceRequestError,
  generateEventJournal,
  ensureBoard8Gi066ReviewSession,
  getEventJournalEntry,
  getEventCenteredSessionTabs,
  getEventCenteredWorkspace,
  respondInEventCenteredWorkspace,
  saveEventJournalEntry,
  startEventCenteredWorkspace,
  updateEventJournalEntry,
  type EventCenteredWorkspaceIssue
} from "@/features/interview/event-centered/workspace-client";
import {
  clearEventCenteredJournalOperation,
  clearEventCenteredWorkspaceOutbox,
  readEventCenteredComposerDraft,
  readEventCenteredJournalOperation,
  readEventCenteredWorkspaceOutbox,
  writeEventCenteredComposerDraft,
  writeEventCenteredJournalOperation,
  writeEventCenteredWorkspaceOutbox,
  type EventCenteredJournalOperationRecord,
  type EventCenteredWorkspaceOutboxRecord
} from "@/features/interview/event-centered/workspace-storage";
import { writeGi088HelpRecordReceipt } from "@/features/interview/event-centered/gi088-compatibility-receipt";
import { isEventCenteredJournalRequestText } from "@/features/interview/event-centered/thought-question-policy";
import type {
  EventCenteredRespondRequest,
  EventCenteredWorkspaceSession
} from "@/types/event-centered-dialogue";
import type { EventCenteredRecordMode } from "@/types/event-centered-interview";
import type { JournalEventEntryRecord } from "@/types/journal-event-entry";

const EVENT_CENTERED_MODE = "event-centered";

export type EventCenteredWorkspaceHrefOptions = {
  entryDate: string;
  sessionId: string;
  recordMode?: EventCenteredRecordMode;
  gi088CompatibilityContext?: {
    runId: string;
    taskId: "A5" | "A6";
  };
  panel?: "journal";
  eventEntryId?: string | null;
};

export function buildEventCenteredWorkspaceHref({
  entryDate,
  sessionId,
  recordMode,
  gi088CompatibilityContext,
  panel,
  eventEntryId
}: EventCenteredWorkspaceHrefOptions) {
  const params = new URLSearchParams({
    mode: EVENT_CENTERED_MODE,
    sessionId,
    entryDate
  });
  if (recordMode) params.set("recordMode", recordMode);
  if (gi088CompatibilityContext) {
    params.set("gi088RunId", gi088CompatibilityContext.runId);
    params.set("gi088TaskId", gi088CompatibilityContext.taskId);
  }
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
  recordMode: EventCenteredRecordMode;
  gi088CompatibilityContext?: {
    runId: string;
    taskId: "A5" | "A6";
  };
  journalOpen: boolean;
  eventEntryId: string | null;
}) {
  if (typeof window === "undefined") return;
  const href = buildEventCenteredWorkspaceHref({
    entryDate: input.entryDate,
    sessionId: input.sessionId,
    recordMode: input.recordMode,
    gi088CompatibilityContext: input.gi088CompatibilityContext,
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
  gi088CompatibilityContext = null,
  initialJournalPanelOpen = false,
  initialEventEntryId = null,
  writeEnabled = true,
  syncAddress = true,
  layout = "viewport",
  previewAuth = false,
  onWorkspaceChange
}: {
  entryDate: string;
  initialSessionId?: string | null;
  initialRecordMode?: EventCenteredRecordMode | null;
  gi088CompatibilityContext?: {
    runId: string;
    taskId: "A5" | "A6";
  } | null;
  initialJournalPanelOpen?: boolean;
  initialEventEntryId?: string | null;
  writeEnabled?: boolean;
  syncAddress?: boolean;
  /** 标准访谈固定在可用视口内；嵌入评审页时交由外层确定高度。 */
  layout?: "viewport" | "embedded";
  /** GI-066 本机人工评审页使用隔离 Preview 身份建立工作台会话。 */
  previewAuth?: boolean;
  onWorkspaceChange?: (workspace: EventCenteredWorkspaceSession) => void;
}) {
  const [requestedSessionId, setRequestedSessionId] = useState(initialSessionId);
  const [requestedRecordMode, setRequestedRecordMode] = useState<EventCenteredRecordMode | null>(
    initialRecordMode
  );
  const [choosingRecordMode, setChoosingRecordMode] = useState(
    !initialSessionId && !initialRecordMode
  );
  const [workspace, setWorkspace] = useState<EventCenteredWorkspaceSession | null>(null);
  const [tabs, setTabs] = useState<EventCenteredDialogueTab[]>([]);
  const [draft, setDraft] = useState("");
  const [journalOpen, setJournalOpen] = useState(initialJournalPanelOpen);
  const [journalEventEntryId, setJournalEventEntryId] = useState<string | null>(initialEventEntryId);
  const [journalEntry, setJournalEntry] = useState<JournalEventEntryRecord | null>(null);
  const [journalGenerating, setJournalGenerating] = useState(false);
  const [journalNotice, setJournalNotice] = useState<WorkspaceNotice | null>(null);
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switchingSession, setSwitchingSession] = useState(false);
  const [streamPreview, setStreamPreview] = useState<StreamPreview | null>(null);
  const [outbox, setOutbox] = useState<EventCenteredWorkspaceOutboxRecord | null>(null);
  const [previewAuthReady, setPreviewAuthReady] = useState(!previewAuth);
  const resumedJournalOperationRef = useRef<string | null>(null);
  const workspaceLayoutClass = layout === "viewport"
    ? "flex h-[calc(100dvh-var(--site-header-viewport-offset))] min-h-0 flex-col"
    : "flex min-h-0 flex-1 flex-col";

  const refreshTabs = useCallback(async () => {
    const nextTabs = await getEventTabs(entryDate);
    setTabs(nextTabs);
  }, [entryDate]);

  const loadWorkspace = useCallback(async (
    sessionId?: string | null,
    recordMode: EventCenteredRecordMode | null = requestedRecordMode
  ) => {
    if (!sessionId && !writeEnabled) {
      setWorkspace(null);
      setNotice({
        title: "事件记录当前处于只读状态",
        message: "已有事件可以通过日历或原链接继续阅读。"
      });
      setLoading(false);
      return;
    }
    if (!sessionId && !recordMode) {
      setWorkspace(null);
      setChoosingRecordMode(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (sessionId) setSwitchingSession(true);
    setNotice(null);
    try {
      const nextWorkspace = sessionId
        ? await getEventCenteredWorkspace(sessionId)
        : await startEventCenteredWorkspace(entryDate, recordMode!);
      setWorkspace(nextWorkspace);
      setRequestedRecordMode(nextWorkspace.recordMode);
      setChoosingRecordMode(false);
      await refreshTabs();
    } catch (error) {
      setWorkspace(null);
      setNotice(toWorkspaceNotice(error));
    } finally {
      setLoading(false);
      setSwitchingSession(false);
    }
  }, [entryDate, refreshTabs, requestedRecordMode, writeEnabled]);

  useEffect(() => {
    setRequestedSessionId(initialSessionId);
    setRequestedRecordMode(initialRecordMode);
    setChoosingRecordMode(!initialSessionId && !initialRecordMode);
    setJournalOpen(initialJournalPanelOpen);
    setJournalEventEntryId(initialEventEntryId);
    setJournalEntry(null);
    setJournalGenerating(false);
    setJournalNotice(null);
    setDraft("");
  }, [
    entryDate,
    initialEventEntryId,
    initialJournalPanelOpen,
    initialRecordMode,
    initialSessionId
  ]);

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
    const entryId = workspace?.journal.entryId ?? journalEventEntryId;
    if (!entryId) {
      if (workspace?.journal.status !== "generating") setJournalEntry(null);
      return;
    }
    let active = true;
    setJournalEventEntryId(entryId);
    void getEventJournalEntry(entryId)
      .then((entry) => {
        if (!active) return;
        setJournalEntry(entry);
        setJournalNotice(null);
      })
      .catch((error) => {
        if (!active) return;
        setJournalNotice(toWorkspaceNotice(error));
      });
    return () => {
      active = false;
    };
  }, [journalEventEntryId, workspace?.journal.entryId, workspace?.journal.status]);

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
    void loadWorkspace(requestedSessionId);
  }, [loadWorkspace, previewAuth, previewAuthReady, requestedSessionId]);

  useEffect(() => {
    if (!workspace) return;
    onWorkspaceChange?.(workspace);
  }, [onWorkspaceChange, workspace]);

  useEffect(() => {
    if (!workspace || !syncAddress) return;
    updateWorkspaceAddress({
      entryDate,
      sessionId: workspace.rootSessionId,
      recordMode: workspace.recordMode,
      gi088CompatibilityContext: gi088CompatibilityContext ?? undefined,
      journalOpen,
      eventEntryId: journalEventEntryId
    });
  }, [
    entryDate,
    gi088CompatibilityContext,
    journalEventEntryId,
    journalOpen,
    syncAddress,
    workspace
  ]);

  const canCreateEvent = Boolean(
    writeEnabled &&
      (workspace?.sessionStatus === "completed" || workspace?.sessionStatus === "abandoned") &&
      (workspace.eventStatus === "completed" || workspace.eventStatus === "abandoned")
  );

  const rememberGi088CompatibilityReceipt = useCallback((value: EventCenteredWorkspaceSession) => {
    if (!gi088CompatibilityContext || value.recordMode !== "capture") return;
    writeGi088HelpRecordReceipt({
      ...gi088CompatibilityContext,
      productSessionId: value.rootSessionId,
      recordedAt: new Date().toISOString()
    });
  }, [gi088CompatibilityContext]);

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
      rememberGi088CompatibilityReceipt(nextWorkspace);
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
          rememberGi088CompatibilityReceipt(recoveredWorkspace);
          await refreshTabs();
          return;
        } catch {
          const acceptedOutbox = { ...nextOutbox, status: "accepted" as const };
          writeEventCenteredWorkspaceOutbox(scope, acceptedOutbox);
          setOutbox(acceptedOutbox);
          return;
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
  }, [
    busy,
    outbox,
    refreshTabs,
    rememberGi088CompatibilityReceipt,
    switchingSession,
    workspace,
    writeEnabled
  ]);

  const generateCurrentJournal = useCallback(async (
    recoveryOperation?: EventCenteredJournalOperationRecord | null
  ) => {
    if (!workspace || journalGenerating || switchingSession || !writeEnabled) return;
    const scope = scopeForWorkspace(workspace);
    const stored = recoveryOperation ?? readEventCenteredJournalOperation(scope);
    const canResumeStored = Boolean(
      stored &&
        stored.rootSessionId === workspace.rootSessionId &&
        stored.baseBranchSessionId === workspace.activeBranchSessionId &&
        stored.baseMessageSequence === workspace.latestMessageSequence
    );
    const operation: EventCenteredJournalOperationRecord = canResumeStored && stored
      ? { ...stored, status: "submitting" }
      : {
          rootSessionId: workspace.rootSessionId,
          baseBranchSessionId: workspace.activeBranchSessionId,
          baseMessageSequence: workspace.latestMessageSequence,
          clientOperationId: createEventJournalOperationId(),
          status: "submitting",
          createdAt: new Date().toISOString()
        };

    writeEventCenteredJournalOperation(operation);
    setJournalOpen(true);
    setJournalGenerating(true);
    setJournalNotice(null);
    try {
      const result = await generateEventJournal({
        rootSessionId: operation.rootSessionId,
        baseBranchSessionId: operation.baseBranchSessionId,
        baseMessageSequence: operation.baseMessageSequence,
        clientOperationId: operation.clientOperationId
      });
      setJournalEntry(result.entry);
      setJournalEventEntryId(result.entry.id);
      setWorkspace(result.workspace);
      updateWorkspaceAddress({
        entryDate,
        sessionId: operation.rootSessionId,
        recordMode: result.workspace.recordMode,
        gi088CompatibilityContext: gi088CompatibilityContext ?? undefined,
        journalOpen: true,
        eventEntryId: result.entry.id
      });
      clearEventCenteredJournalOperation(scope);
      resumedJournalOperationRef.current = null;
      await refreshTabs();
    } catch (error) {
      const issue = error instanceof EventCenteredWorkspaceRequestError ? error.issue : null;
      const failedOperation = { ...operation, status: "failed" as const };
      if (issue?.retryable === false) clearEventCenteredJournalOperation(scope);
      else writeEventCenteredJournalOperation(failedOperation);
      setJournalNotice(toWorkspaceNotice(error));
      try {
        const recoveredWorkspace = await getEventCenteredWorkspace(workspace.rootSessionId);
        setWorkspace(recoveredWorkspace);
      } catch {
        // 当前对话仍保留在页面；下一次刷新会继续走服务端恢复。
      }
    } finally {
      setJournalGenerating(false);
    }
  }, [
    entryDate,
    gi088CompatibilityContext,
    journalGenerating,
    refreshTabs,
    switchingSession,
    workspace,
    writeEnabled
  ]);

  useEffect(() => {
    if (!workspace || workspace.journal.status !== "generating" || journalGenerating) return;
    const stored = readEventCenteredJournalOperation(scopeForWorkspace(workspace));
    if (!stored) {
      setJournalOpen(true);
      setJournalNotice({
        title: "这次整理需要继续",
        message: "事件原话和当前阶段都已保留。请点击“生成事件日志”继续整理。"
      });
      return;
    }
    if (resumedJournalOperationRef.current === stored.clientOperationId) return;
    resumedJournalOperationRef.current = stored.clientOperationId;
    void generateCurrentJournal(stored);
  }, [generateCurrentJournal, journalGenerating, workspace]);

  const updateCurrentJournal = useCallback(async (input: {
    entryId: string;
    title: string;
    content: string;
    expectedContentRevision: number;
  }) => {
    try {
      const entry = await updateEventJournalEntry(input);
      setJournalEntry(entry);
      setJournalNotice(null);
      return entry;
    } catch (error) {
      setJournalNotice(toWorkspaceNotice(error));
      throw error;
    }
  }, []);

  const saveCurrentJournal = useCallback(async (input: {
    entryId: string;
    expectedContentRevision: number;
  }) => {
    const activeWorkspace = workspace;
    if (!activeWorkspace) {
      const error = new Error("EVENT_WORKSPACE_REQUIRED");
      setJournalNotice(toWorkspaceNotice(error));
      throw error;
    }
    try {
      const entry = await saveEventJournalEntry(input);
      setJournalEntry(entry);
      setJournalEventEntryId(entry.id);
      setJournalNotice(null);
      updateWorkspaceAddress({
        entryDate,
        sessionId: activeWorkspace.rootSessionId,
        recordMode: activeWorkspace.recordMode,
        gi088CompatibilityContext: gi088CompatibilityContext ?? undefined,
        journalOpen: true,
        eventEntryId: entry.id
      });
      await refreshTabs();
      return entry;
    } catch (error) {
      setJournalNotice(toWorkspaceNotice(error));
      throw error;
    }
  }, [entryDate, gi088CompatibilityContext, refreshTabs, workspace]);

  function createNextEvent() {
    if (!canCreateEvent || busy) return;
    setNotice(null);
    setWorkspace(null);
    setRequestedSessionId(null);
    setRequestedRecordMode(null);
    setChoosingRecordMode(true);
    setLoading(false);
    setDraft("");
    setOutbox(null);
    setJournalOpen(false);
    setJournalEventEntryId(null);
    setJournalEntry(null);
    setJournalNotice(null);
    resumedJournalOperationRef.current = null;
    if (syncAddress && typeof window !== "undefined") {
      const params = new URLSearchParams({
        mode: EVENT_CENTERED_MODE,
        entryDate
      });
      window.history.replaceState(window.history.state, "", `/interview?${params.toString()}`);
    }
  }

  const handleViewAction = useCallback(async (action: EventCenteredDialogueWorkspaceAction) => {
    if (action.action === "generate_event_journal") {
      await generateCurrentJournal();
      return;
    }
    if (
      workspace?.recordMode === "chat" &&
      action.action === "reply" &&
      isEventCenteredJournalRequestText(action.rawText)
    ) {
      await generateCurrentJournal();
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
  }, [generateCurrentJournal, performAction, workspace?.recordMode]);

  const handleComposerDraftChange = useCallback((nextDraft: string) => {
    setDraft(nextDraft);
    if (workspace) writeEventCenteredComposerDraft(scopeForWorkspace(workspace), nextDraft);
  }, [workspace]);

  if (loading && !workspace) {
    return (
      <div data-testid="event-centered-workspace-layout" className={workspaceLayoutClass}>
        <Surface className="flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-y-0">
          <p role="status" className="text-sm text-[var(--text-dim)]">正在恢复这件事…</p>
        </Surface>
      </div>
    );
  }

  if (!workspace && choosingRecordMode && writeEnabled) {
    const chooseRecordMode = (recordMode: EventCenteredRecordMode) => {
      setRequestedRecordMode(recordMode);
      setChoosingRecordMode(false);
      setLoading(true);
      setNotice(null);
    };
    return (
      <div data-testid="event-centered-workspace-layout" className={workspaceLayoutClass}>
        <Surface className="flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-y-0 p-6">
          <div data-testid="event-centered-record-mode-picker" className="w-full max-w-2xl">
            <p className="text-xs font-medium tracking-[0.12em] text-[var(--text-faint)]">新记录</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">这次想怎么记录</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
              每条新记录单独选择方式，进入后会一直保持当前方式。
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => chooseRecordMode("capture")}
                className="min-h-28 rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--paper-soft)] p-5 text-left transition hover:border-[var(--line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]"
              >
                <span className="block text-lg font-semibold text-ink">帮我记</span>
                <span className="mt-2 block text-sm leading-6 text-[var(--text-dim)]">
                  原话可靠保存，AI 只轻轻承接，不追问。
                </span>
              </button>
              <button
                type="button"
                onClick={() => chooseRecordMode("chat")}
                className="min-h-28 rounded-[var(--radius-card)] border border-[var(--line-soft)] p-5 text-left transition hover:bg-[var(--paper-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]"
              >
                <span className="block text-lg font-semibold text-ink">陪我聊</span>
                <span className="mt-2 block text-sm leading-6 text-[var(--text-dim)]">
                  围绕当前这件事回应、追问和整理。
                </span>
              </button>
            </div>
          </div>
        </Surface>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div data-testid="event-centered-workspace-layout" className={workspaceLayoutClass}>
        <Surface className="flex min-h-0 flex-1 items-center justify-center rounded-none border-x-0 border-y-0 p-6">
          <div role="alert" className="max-w-lg border-l-2 border-[var(--paper-deep)] py-1 pl-4">
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
        tabs={tabs}
        activeTabId={workspace.rootSessionId}
        busy={busy || switchingSession || journalGenerating}
        readOnly={!writeEnabled || workspace.sessionStatus === "abandoned" || workspace.eventStatus === "abandoned"}
        canCreateEvent={canCreateEvent}
        composerDraft={draft}
        optimisticUserMessage={optimisticUserMessage}
        streamPreview={streamPreview}
        journalOpen={journalOpen}
        journalEntry={journalEntry}
        journalGenerating={journalGenerating}
        journalNotice={journalNotice}
        error={notice}
        onComposerDraftChange={handleComposerDraftChange}
        onJournalOpenChange={setJournalOpen}
        onUpdateJournal={updateCurrentJournal}
        onSaveJournal={saveCurrentJournal}
        onAction={handleViewAction}
        onCreateEvent={createNextEvent}
        onSelectTab={(rootSessionId) => {
          if (rootSessionId === workspace.rootSessionId) return;
          const selectedTab = tabs.find((tab) => tab.rootSessionId === rootSessionId);
          setRequestedSessionId(rootSessionId);
          setRequestedRecordMode(selectedTab?.recordMode ?? null);
          setJournalOpen(selectedTab?.status === "completed");
          setJournalEventEntryId(null);
          setJournalEntry(null);
          setJournalNotice(null);
          resumedJournalOperationRef.current = null;
          setNotice(null);
          setDraft("");
        }}
      />
    </div>
  );
}
