"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  clearStoredInterviewSessionId,
  getInterviewDimensionMeta,
  getStoredInterviewSessionId,
  interviewDimensionStorageKey,
  normalizeInterviewDimension,
  setStoredInterviewSessionId
} from "@/features/interview/dimensions";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewDimension, InterviewMessage, InterviewSessionRecord } from "@/types/interview";

type BootState = "idle" | "booting" | "restoring";
type AssistantState = "idle" | "thinking" | "streaming";
type DraftSyncState = "idle" | "saving" | "saved" | "error";
type DraftGenerateState = "idle" | "loading" | "error";
type ToastState = {
  message: string;
  visible: boolean;
} | null;

const INTERVIEW_INPUT_MIN_HEIGHT = 36;
const INTERVIEW_INPUT_MAX_HEIGHT = 176;

interface DraftGenerateIssue {
  code: string;
  message: string;
  retryable: boolean;
}

const interviewBootstrapTasks = new Map<InterviewDimension, Promise<InterviewSessionRecord | null>>();

function MessageBubble({
  message,
  content,
  role
}: {
  message?: InterviewMessage;
  content?: string;
  role?: InterviewMessage["role"];
}) {
  const bubbleRole = message?.role ?? role ?? "assistant";
  const isAssistant = bubbleRole === "assistant";
  const bubbleContent = content ?? message?.content ?? "";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-2xl rounded-[28px] border px-4 py-3 text-sm leading-7 shadow-soft ${
          isAssistant
            ? "border-[rgba(156,114,70,0.14)] bg-[rgba(255,248,238,0.44)] text-ink"
            : "border-[rgba(133,91,47,0.2)] bg-[linear-gradient(180deg,rgba(221,185,133,0.96),rgba(195,152,97,0.96))] text-[#2f2823]"
        }`}
      >
        <p className="whitespace-pre-wrap">{bubbleContent}</p>
      </div>
    </div>
  );
}

function DraftTransitionCard({
  onGenerate,
  disabled,
  isGenerating
}: {
  onGenerate: () => void;
  disabled: boolean;
  isGenerating: boolean;
}) {
  return (
    <div className="ml-4 w-full max-w-[31rem] rounded-[28px] border border-[rgba(153,103,54,0.16)] bg-[linear-gradient(180deg,rgba(250,243,230,0.98),rgba(235,217,187,0.92))] p-4 shadow-[0_18px_42px_rgba(124,83,43,0.12)]">
      <p className="font-mono text-[0.65rem] tracking-[0.22em] text-[#9a734d]">日志整理阶段</p>
      <h4 className="mt-2 font-display text-[1.35rem] text-[#2e2319]">把这段访谈整理成一篇日志</h4>
      <p className="mt-2 text-sm leading-7 text-[#594537]">
        现在内容已经足够，接下来可以直接生成一份草稿，并在右侧工作区继续编辑、确认和保存。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled}
          className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? "正在整理..." : "生成日志"}
        </button>
      </div>
    </div>
  );
}

function ActiveDraftCard({
  onToggleWorkspace,
  workspaceToggleLabel,
  onContinueInterview,
  onPauseInterview,
  pauseDisabled,
  isDraftStale
}: {
  onToggleWorkspace: () => void;
  workspaceToggleLabel: string;
  onContinueInterview: () => void;
  onPauseInterview: () => void;
  pauseDisabled: boolean;
  isDraftStale: boolean;
}) {
  return (
    <div className="ml-4 w-full max-w-[31rem] rounded-[28px] border border-[rgba(153,103,54,0.16)] bg-[linear-gradient(180deg,rgba(250,243,230,0.98),rgba(235,217,187,0.92))] p-4 shadow-[0_18px_42px_rgba(124,83,43,0.12)]">
      <h4 className="font-display text-[1.35rem] text-[#2e2319]">当前可以生成日志，也可以继续访谈</h4>
      <p className="mt-2 text-sm leading-7 text-[#594537]">
        {isDraftStale
          ? "你刚补充了新的访谈内容。需要同步右侧草稿时，直接点击“生成最新日志”。"
          : "你可以回到右侧继续编辑，也可以直接在这里补充更多内容，稍后再同步到日志。"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleWorkspace}
          className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)]"
        >
          {workspaceToggleLabel}
        </button>
        <button
          type="button"
          onClick={onContinueInterview}
          className="rounded-full border border-[rgba(168,124,69,0.2)] bg-[rgba(255,250,242,0.72)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)]"
        >
          继续访谈
        </button>
        <button
          type="button"
          onClick={onPauseInterview}
          disabled={pauseDisabled}
          className="rounded-full border border-[rgba(150,109,66,0.18)] bg-[rgba(244,233,214,0.7)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(244,233,214,0.92)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          暂停访谈
        </button>
      </div>
    </div>
  );
}

function SaveToast({ message }: { message: string }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[rgba(119,79,40,0.18)] bg-[rgba(46,35,25,0.92)] px-4 py-2 text-sm text-[rgba(255,245,230,0.96)] shadow-[0_18px_42px_rgba(46,35,25,0.28)]"
    >
      {message}
    </div>
  );
}

function InterviewMetaActions({
  onPauseInterview,
  pauseDisabled
}: {
  onPauseInterview: () => void;
  pauseDisabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPauseInterview}
      disabled={pauseDisabled}
      className="rounded-full border border-[rgba(255,249,241,0.6)] bg-[rgba(255,247,237,0.56)] px-4 py-1.5 text-sm text-[#6a5642] shadow-[0_8px_24px_rgba(123,96,67,0.08),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md transition hover:bg-[rgba(255,247,237,0.78)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      暂停访谈
    </button>
  );
}

function InterviewEndedCard({
  title,
  onToggleWorkspace,
  workspaceToggleLabel,
  onReopen,
  onCompleteInterview,
  reopenDisabled,
  completeDisabled
}: {
  title: string;
  onToggleWorkspace?: () => void;
  workspaceToggleLabel?: string;
  onReopen?: () => void;
  onCompleteInterview?: () => void;
  reopenDisabled?: boolean;
  completeDisabled?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-[rgba(137,95,53,0.18)] bg-[linear-gradient(180deg,rgba(251,244,232,0.98),rgba(233,216,190,0.96))] p-4 shadow-[0_22px_54px_rgba(124,83,43,0.14)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)]" />
      <h4 className="font-display text-[1.35rem] text-[#2e2319]">{title}</h4>
      <div className="mt-4 flex flex-wrap gap-2">
        {onToggleWorkspace && workspaceToggleLabel ? (
          <button
            type="button"
            onClick={onToggleWorkspace}
            className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)]"
          >
            {workspaceToggleLabel}
          </button>
        ) : null}
        {onReopen ? (
          <button
            type="button"
            onClick={onReopen}
            disabled={reopenDisabled}
            className="rounded-full border border-[rgba(168,124,69,0.2)] bg-[rgba(255,250,242,0.82)] px-4 py-1.5 text-sm text-[#5c452e] transition hover:bg-[rgba(255,250,242,0.98)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            继续补充访谈
          </button>
        ) : null}
        {onCompleteInterview ? (
          <button
            type="button"
            onClick={onCompleteInterview}
            disabled={completeDisabled}
            className="rounded-full border border-[rgba(150,109,66,0.18)] bg-[rgba(244,233,214,0.7)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(244,233,214,0.92)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            结束访谈
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DraftPanelStateCard({
  title,
  description,
  accent = "neutral",
  actions,
  loading = false
}: {
  title: string;
  description: string;
  accent?: "neutral" | "error";
  actions?: React.ReactNode;
  loading?: boolean;
}) {
  const isError = accent === "error";

  return (
    <div
      className={`mt-5 flex min-h-0 flex-1 flex-col items-center justify-center rounded-[30px] border p-7 text-center ${
        isError
          ? "border-[rgba(181,92,78,0.18)] bg-[linear-gradient(180deg,rgba(253,245,242,0.98),rgba(247,226,219,0.92))]"
          : "border-[rgba(172,128,83,0.16)] bg-[linear-gradient(180deg,rgba(251,245,235,0.96),rgba(240,226,202,0.94))]"
      }`}
    >
      {loading ? <div className="h-12 w-12 animate-pulse rounded-full bg-[rgba(188,148,103,0.22)]" /> : null}
      <h4
        className={`font-display text-[1.7rem] ${loading ? "mt-5" : ""} ${
          isError ? "text-[#7c3a31]" : "text-[#2c2218]"
        }`}
      >
        {title}
      </h4>
      <p className={`mt-3 max-w-[28rem] text-sm leading-7 ${isError ? "text-[#8b5148]" : "text-[#5d5042]"}`}>{description}</p>
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}

async function requestInterviewSession(dimension: InterviewDimension) {
  const response = await fetch("/api/interview/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dimension })
  });

  if (!response.ok) {
    throw new Error("INTERVIEW_START_FAILED");
  }

  const data = (await response.json()) as { session: InterviewSessionRecord };
  return data.session;
}

async function fetchInterviewSession(sessionId: string) {
  const response = await fetch(`/api/interview/session/${sessionId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return (await response.json()) as InterviewSessionRecord;
}

function isRestorableSession(session: InterviewSessionRecord, dimension: InterviewDimension) {
  if (session.dimension !== dimension) {
    return false;
  }

  return session.status !== "abandoned";
}

async function bootstrapInterviewSession(dimension: InterviewDimension, forceNew = false) {
  if (!forceNew) {
    const existingTask = interviewBootstrapTasks.get(dimension);

    if (existingTask) {
      return existingTask;
    }
  }

  const task = (async () => {
    if (!forceNew) {
      const storedSessionId = getStoredInterviewSessionId(dimension);

      if (storedSessionId) {
        try {
          const restoredSession = await fetchInterviewSession(storedSessionId);

          if (isRestorableSession(restoredSession, dimension)) {
            return restoredSession;
          }
        } catch {
          // Ignore restore failures and fall back to creating a new session.
        }

        clearStoredInterviewSessionId(dimension);
      }
    }

    return requestInterviewSession(dimension);
  })().finally(() => {
    interviewBootstrapTasks.delete(dimension);
  });

  interviewBootstrapTasks.set(dimension, task);
  return task;
}

function parseSseChunk(chunk: string) {
  const lines = chunk.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  return {
    event,
    data: JSON.parse(dataLines.join("\n")) as Record<string, unknown>
  };
}

export function InterviewShell() {
  const searchParams = useSearchParams();
  const {
    dimension,
    sessionId,
    status,
    stage,
    messages,
    turnCount,
    journalEntry,
    setDimension,
    hydrate,
    reset,
    setJournalEntry
  } = useInterviewStore();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [bootState, setBootState] = useState<BootState>("idle");
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | null>(null);
  const [streamedAssistantText, setStreamedAssistantText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [draftGenerateState, setDraftGenerateState] = useState<DraftGenerateState>("idle");
  const [draftGenerateIssue, setDraftGenerateIssue] = useState<DraftGenerateIssue | null>(null);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [isReopeningInterview, setIsReopeningInterview] = useState(false);
  const [isPausingInterview, setIsPausingInterview] = useState(false);
  const [isCompletingInterview, setIsCompletingInterview] = useState(false);
  const [draftSyncState, setDraftSyncState] = useState<DraftSyncState>("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [hasSavedJournal, setHasSavedJournal] = useState(false);
  const [toastState, setToastState] = useState<ToastState>(null);
  const currentDimension = normalizeInterviewDimension(searchParams.get("dimension") ?? dimension);
  const dimensionMeta = getInterviewDimensionMeta(currentDimension);
  const bootSequenceRef = useRef(0);
  const activeStreamIdRef = useRef(0);
  const streamQueueRef = useRef("");
  const streamTimerRef = useRef<number | null>(null);
  const pendingSessionRef = useRef<InterviewSessionRecord | null>(null);
  const streamCompletedRef = useRef(false);
  const streamResolverRef = useRef<(() => void) | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isInputComposingRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const draftPersistRequestIdRef = useRef(0);
  const sessionStateRef = useRef({
    sessionId,
    dimension
  });
  const draftStateRef = useRef({
    draftTitle,
    draftContent,
    journalEntry
  });
  const [shellHeight, setShellHeight] = useState<number | null>(null);

  const showDraftPrompt = Boolean(sessionId && !journalEntry && status === "active" && stage === "wrap_up");
  const showActiveDraftCard = Boolean(sessionId && journalEntry && status === "active");
  const showStreamingBubble = assistantState !== "idle";
  const showBootBubble = messages.length === 0 && bootState !== "idle";
  const isGeneratingDraft = draftGenerateState === "loading";
  const isInterviewPaused = status === "paused";
  const isInterviewCompleted = status === "completed";
  const isInterviewLocked = isInterviewPaused || isInterviewCompleted;
  const hasUnsavedDraftChanges = Boolean(
    journalEntry && (draftTitle !== journalEntry.title || draftContent !== journalEntry.content)
  );
  const draftTooLong = draftTitle.length > 80 || draftContent.length > 3000;
  const canSaveJournal = Boolean(
    journalEntry &&
      draftTitle.trim() &&
      draftContent.trim() &&
      !draftTooLong &&
      (journalEntry.status !== "saved" || hasUnsavedDraftChanges)
  );
  const canPauseInterview = Boolean(
    sessionId &&
      status === "active" &&
      !isBusy &&
      !isGeneratingDraft &&
      !isSavingJournal &&
      !isReopeningInterview &&
      !isPausingInterview &&
      !isCompletingInterview
  );
  const canCompleteInterview = Boolean(
    sessionId &&
      status === "paused" &&
      !isBusy &&
      !isGeneratingDraft &&
      !isSavingJournal &&
      !isReopeningInterview &&
      !isPausingInterview &&
      !isCompletingInterview
  );
  const canSendInput = Boolean(
    input.trim() &&
      !isBusy &&
      !isGeneratingDraft &&
      !isSavingJournal &&
      !isReopeningInterview &&
      !isPausingInterview &&
      !isCompletingInterview &&
      !isInterviewLocked
  );
  const isDraftStale = useMemo(() => {
    if (!journalEntry || messages.length === 0) {
      return false;
    }

    const latestMessage = messages[messages.length - 1];

    return new Date(latestMessage.createdAt).getTime() > new Date(journalEntry.updatedAt).getTime();
  }, [journalEntry, messages]);

  const panelStatusText = useMemo(() => {
    if (draftGenerateState === "loading") {
      return "生成中";
    }

    if (draftGenerateState === "error" && !journalEntry) {
      return null;
    }

    if (isSavingJournal) {
      return "保存中";
    }

    if (draftSyncState === "saving") {
      return "暂存中";
    }

    if (draftSyncState === "error") {
      return "暂存失败";
    }

    return null;
  }, [draftGenerateState, draftSyncState, isSavingJournal, journalEntry]);

  useEffect(() => {
    setDimension(currentDimension);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(interviewDimensionStorageKey, currentDimension);
    }
  }, [currentDimension, setDimension]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    setStoredInterviewSessionId(currentDimension, sessionId);
  }, [currentDimension, sessionId]);

  useEffect(() => {
    if (!journalEntry) {
      setDraftTitle("");
      setDraftContent("");
      setDraftSyncState("idle");
      setHasSavedJournal(false);
      return;
    }

    setDraftTitle(journalEntry.title);
    setDraftContent(journalEntry.content);
    setDraftSyncState("saved");
    setHasSavedJournal((current) => current || journalEntry.status === "saved" || Boolean(journalEntry.savedAt));
  }, [journalEntry]);

  useEffect(() => {
    const inputElement = inputRef.current;

    if (!inputElement) {
      return;
    }

    inputElement.style.height = "0px";
    inputElement.style.height = `${Math.min(
      Math.max(inputElement.scrollHeight, INTERVIEW_INPUT_MIN_HEIGHT),
      INTERVIEW_INPUT_MAX_HEIGHT
    )}px`;
  }, [input]);

  useEffect(() => {
    sessionStateRef.current = {
      sessionId,
      dimension
    };
  }, [dimension, sessionId]);

  useEffect(() => {
    draftStateRef.current = {
      draftTitle,
      draftContent,
      journalEntry
    };
  }, [draftContent, draftTitle, journalEntry]);

  const stopStreamPump = useCallback(() => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  const stopDraftAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const stopToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const clearStreamState = useCallback(() => {
    stopStreamPump();
    streamQueueRef.current = "";
    pendingSessionRef.current = null;
    streamCompletedRef.current = false;
    setOptimisticUserMessage(null);
    setStreamedAssistantText("");
    setAssistantState("idle");
  }, [stopStreamPump]);

  const showToast = useCallback(
    (message: string) => {
      stopToastTimer();
      setToastState({
        message,
        visible: true
      });
      toastTimerRef.current = window.setTimeout(() => {
        setToastState(null);
        toastTimerRef.current = null;
      }, 1000);
    },
    [stopToastTimer]
  );

  function maybeFinalizeStream(activeStreamId: number) {
    if (activeStreamId !== activeStreamIdRef.current) {
      return;
    }

    if (!streamCompletedRef.current || streamQueueRef.current || !pendingSessionRef.current) {
      return;
    }

    stopStreamPump();
    hydrate(pendingSessionRef.current);
    pendingSessionRef.current = null;
    streamCompletedRef.current = false;
    setOptimisticUserMessage(null);
    setStreamedAssistantText("");
    setAssistantState("idle");
    streamResolverRef.current?.();
    streamResolverRef.current = null;
  }

  function enqueueAssistantDelta(text: string, activeStreamId: number) {
    streamQueueRef.current += text;

    if (streamTimerRef.current) {
      return;
    }

    streamTimerRef.current = window.setInterval(() => {
      if (activeStreamId !== activeStreamIdRef.current) {
        stopStreamPump();
        return;
      }

      if (!streamQueueRef.current) {
        maybeFinalizeStream(activeStreamId);
        return;
      }

      const nextChar = streamQueueRef.current.slice(0, 1);
      streamQueueRef.current = streamQueueRef.current.slice(1);
      setStreamedAssistantText((current) => current + nextChar);

      if (!streamQueueRef.current) {
        maybeFinalizeStream(activeStreamId);
      }
    }, 18);
  }

  const ensureSession = useCallback(async (nextDimension: InterviewDimension, forceNew = false) => {
    const activeSession = sessionStateRef.current;

    if (!forceNew && activeSession.sessionId && activeSession.dimension === nextDimension) {
      return activeSession.sessionId;
    }

    const currentBootSequence = ++bootSequenceRef.current;
    const hasStoredSession = !forceNew && Boolean(getStoredInterviewSessionId(nextDimension));
    setBootState(hasStoredSession ? "restoring" : "booting");

    try {
      const session = await bootstrapInterviewSession(nextDimension, forceNew);

      if (!session || currentBootSequence !== bootSequenceRef.current) {
        return null;
      }

      hydrate(session);
      setBootState("idle");
      return session.id;
    } catch {
      if (currentBootSequence === bootSequenceRef.current) {
        setBootState("idle");
        setError("访谈启动失败，请稍后再试。");
      }

      return null;
    }
  }, [hydrate]);

  const persistDraftEdits = useCallback(async (titleOverride?: string, contentOverride?: string) => {
    const activeDraft = draftStateRef.current;
    const nextTitle = titleOverride ?? activeDraft.draftTitle;
    const nextContent = contentOverride ?? activeDraft.draftContent;
    const activeJournalEntry = activeDraft.journalEntry;

    if (!activeJournalEntry) {
      return true;
    }

    if (nextTitle.length > 80 || nextContent.length > 3000) {
      setDraftError("标题请控制在 80 字内，正文请控制在 3000 字内。");
      setDraftSyncState("error");
      return false;
    }

    setDraftError(null);
    setDraftSyncState("saving");
    const requestId = draftPersistRequestIdRef.current + 1;
    draftPersistRequestIdRef.current = requestId;

    try {
      const response = await fetch(`/api/joy-entry/${activeJournalEntry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...activeJournalEntry,
          title: nextTitle,
          content: nextContent
        })
      });

      if (!response.ok) {
        throw new Error("JOY_ENTRY_UPDATE_FAILED");
      }

      const nextEntry = await response.json();
      const stillCurrent =
        draftStateRef.current.draftTitle === nextTitle && draftStateRef.current.draftContent === nextContent;
      const isLatestRequest = draftPersistRequestIdRef.current === requestId;

      if (stillCurrent && isLatestRequest) {
        setJournalEntry(nextEntry);
        setDraftSyncState("saved");
      } else if (isLatestRequest) {
        setDraftSyncState("idle");
      }

      return true;
    } catch {
      if (draftPersistRequestIdRef.current === requestId) {
        setDraftSyncState("error");
        setDraftError("草稿暂存失败，请稍后再试。");
      }

      return false;
    }
  }, [setJournalEntry]);

  useEffect(() => {
    setInput("");
    setError(null);
    setDraftError(null);
    setDraftGenerateIssue(null);
    setDraftGenerateState("idle");
    setIsPausingInterview(false);
    setIsCompletingInterview(false);
    setToastState(null);
    setPanelOpen(false);
    stopDraftAutosave();
    stopToastTimer();
    clearStreamState();
    reset(currentDimension);
    void ensureSession(currentDimension);
  }, [clearStreamState, currentDimension, ensureSession, reset, stopDraftAutosave, stopToastTimer]);

  useEffect(() => {
    const messageScrollElement = messageScrollRef.current;

    if (!messageScrollElement) {
      return;
    }

    // Keep the chat pinned to the latest message without scrolling the whole document.
    messageScrollElement.scrollTop = messageScrollElement.scrollHeight;
  }, [assistantState, messages.length, optimisticUserMessage, streamedAssistantText]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateShellHeight = () => {
      const shellElement = shellRef.current;

      if (!shellElement) {
        return;
      }

      const top = shellElement.getBoundingClientRect().top;
      const viewportGap = window.innerWidth >= 768 ? 20 : 16;
      const nextHeight = Math.max(520, Math.floor(window.innerHeight - top - viewportGap));
      setShellHeight(nextHeight);
    };

    updateShellHeight();
    window.addEventListener("resize", updateShellHeight);

    return () => {
      window.removeEventListener("resize", updateShellHeight);
    };
  }, []);

  useEffect(() => {
    if (!panelOpen || !journalEntry || !hasUnsavedDraftChanges) {
      return;
    }

    stopDraftAutosave();

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraftEdits();
    }, 800);

    return () => {
      stopDraftAutosave();
    };
  }, [draftContent, draftTitle, hasUnsavedDraftChanges, journalEntry, panelOpen, persistDraftEdits, stopDraftAutosave]);

  useEffect(() => {
    return () => {
      stopDraftAutosave();
      stopToastTimer();
      stopStreamPump();
    };
  }, [stopDraftAutosave, stopStreamPump, stopToastTimer]);

  async function handleRestart() {
    setError(null);
    setDraftError(null);
    setDraftGenerateIssue(null);
    setDraftGenerateState("idle");
    setIsBusy(true);
    setPanelOpen(false);
    stopDraftAutosave();
    clearStoredInterviewSessionId(currentDimension);
    clearStreamState();
    reset(currentDimension);

    try {
      await ensureSession(currentDimension, true);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSend() {
    const nextInput = input.trim();

    if (!nextInput || isBusy) {
      return;
    }

    if (isInterviewLocked || isReopeningInterview) {
      setError(
        isInterviewPaused
          ? "本轮访谈已暂停，如需补充内容，请先点击“继续补充访谈”。"
          : "本轮访谈已结束，不能继续补充。"
      );
      return;
    }

    setError(null);
    setInput("");
    setIsBusy(true);
    setOptimisticUserMessage(nextInput);
    setStreamedAssistantText("");
    setAssistantState("thinking");
    streamQueueRef.current = "";
    pendingSessionRef.current = null;
    streamCompletedRef.current = false;
    const activeStreamId = activeStreamIdRef.current + 1;
    activeStreamIdRef.current = activeStreamId;

    try {
      const resolvedSessionId = await ensureSession(currentDimension);

      if (!resolvedSessionId) {
        throw new Error("INTERVIEW_START_FAILED");
      }

      const response = await fetch("/api/interview/session/respond/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: resolvedSessionId,
          userMessage: nextInput,
          inputMode: "text"
        })
      });

      if (!response.ok || !response.body) {
        throw new Error("INTERVIEW_RESPOND_FAILED");
      }

      await new Promise<void>(async (resolve, reject) => {
        streamResolverRef.current = resolve;
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleChunk = (rawChunk: string) => {
          const parsed = parseSseChunk(rawChunk);

          if (!parsed) {
            return;
          }

          if (parsed.event === "phase") {
            const nextState = parsed.data.state;

            if (nextState === "thinking" || nextState === "streaming") {
              setAssistantState(nextState);
            }

            return;
          }

          if (parsed.event === "delta") {
            const text = typeof parsed.data.text === "string" ? parsed.data.text : "";

            if (text) {
              enqueueAssistantDelta(text, activeStreamId);
            }

            return;
          }

          if (parsed.event === "session") {
            const nextSession = parsed.data.session as InterviewSessionRecord | undefined;

            if (nextSession) {
              pendingSessionRef.current = nextSession;
              streamCompletedRef.current = true;
              maybeFinalizeStream(activeStreamId);
            }

            return;
          }

          if (parsed.event === "error") {
            reject(new Error(typeof parsed.data.code === "string" ? parsed.data.code : "INTERVIEW_RESPOND_FAILED"));
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              buffer += decoder.decode();
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            while (buffer.includes("\n\n")) {
              const boundaryIndex = buffer.indexOf("\n\n");
              const rawChunk = buffer.slice(0, boundaryIndex);
              buffer = buffer.slice(boundaryIndex + 2);
              handleChunk(rawChunk);
            }
          }

          if (buffer.trim()) {
            handleChunk(buffer.trim());
          }

          if (!pendingSessionRef.current) {
            resolve();
          } else {
            maybeFinalizeStream(activeStreamId);
          }
        } catch (streamError) {
          reject(streamError);
        }
      });
    } catch {
      clearStreamState();
      setInput(nextInput);
      setError("这一轮提交失败了，请再试一次。");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReopenInterview() {
    if (
      !sessionId ||
      isBusy ||
      isGeneratingDraft ||
      isSavingJournal ||
      isReopeningInterview ||
      isPausingInterview ||
      isCompletingInterview
    ) {
      return;
    }

    setError(null);
    setIsReopeningInterview(true);

    try {
      const response = await fetch("/api/interview/session/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error("SESSION_REOPEN_FAILED");
      }

      const data = (await response.json()) as { session: InterviewSessionRecord };
      hydrate(data.session);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } catch {
      setError("暂时无法恢复访谈，请稍后重试。");
    } finally {
      setIsReopeningInterview(false);
    }
  }

  async function handlePauseInterview() {
    if (!sessionId || !canPauseInterview) {
      return;
    }

    stopDraftAutosave();

    const confirmed = window.confirm("暂停后你仍然可以继续补充访谈。现在暂停本轮访谈吗？");

    if (!confirmed) {
      return;
    }

    if (hasUnsavedDraftChanges) {
      const synced = await persistDraftEdits();

      if (!synced) {
        return;
      }
    }

    setError(null);
    setDraftError(null);
    setIsPausingInterview(true);

    try {
      const response = await fetch("/api/interview/session/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error("SESSION_PAUSE_FAILED");
      }

      const data = (await response.json()) as { session: InterviewSessionRecord };
      hydrate(data.session);
    } catch {
      setError("暂时无法暂停访谈，请稍后重试。");
    } finally {
      setIsPausingInterview(false);
    }
  }

  function handleContinueInterview() {
    setPanelOpen(false);
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isComposing = event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || isInputComposingRef.current;

    if (event.key !== "Enter" || event.shiftKey || isComposing) {
      return;
    }

    event.preventDefault();

    if (!canSendInput) {
      return;
    }

    void handleSend();
  }

  async function handleGenerateDraft() {
    if (!sessionId || isGeneratingDraft || isBusy) {
      return;
    }

    setError(null);
    setDraftError(null);
    setDraftGenerateIssue(null);
    setPanelOpen(true);
    setDraftGenerateState("loading");

    try {
      const response = await fetch("/api/interview/session/draft/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: [sessionId] })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; message?: string; retryable?: boolean }
          | null;

        throw {
          code: payload?.error ?? "DRAFT_GENERATE_UNKNOWN_ERROR",
          message: payload?.message ?? "日志生成失败，请稍后重试。",
          retryable: payload?.retryable ?? true
        } satisfies DraftGenerateIssue;
      }

      const data = await response.json();
      hydrate(data.session);
      setDraftSyncState("saved");
      setDraftGenerateState("idle");
    } catch (error) {
      const issue =
        error && typeof error === "object" && "code" in error && "message" in error
          ? (error as DraftGenerateIssue)
          : {
              code: "DRAFT_GENERATE_UNKNOWN_ERROR",
              message: "日志生成失败，请稍后重试。",
              retryable: true
            };

      setDraftGenerateIssue(issue);
      setDraftGenerateState("error");
    } finally {
      setDraftGenerateState((current) => (current === "loading" ? "idle" : current));
    }
  }

  async function handleRegenerateDraft() {
    if (!sessionId || isGeneratingDraft) {
      return;
    }

    if (hasUnsavedDraftChanges) {
      const confirmed = window.confirm("生成最新日志会覆盖当前未保存的手动修改，是否继续？");

      if (!confirmed) {
        return;
      }
    }

    stopDraftAutosave();
    await handleGenerateDraft();
  }

  async function handleSaveJournal() {
    if (!sessionId || !journalEntry || isSavingJournal) {
      return;
    }

    stopDraftAutosave();

    if (!draftTitle.trim() || !draftContent.trim()) {
      setDraftError("标题和正文不能为空。");
      return;
    }

    if (hasUnsavedDraftChanges) {
      const synced = await persistDraftEdits();

      if (!synced) {
        return;
      }
    }

    setDraftError(null);
    setIsSavingJournal(true);

    try {
      const response = await fetch("/api/interview/session/draft/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error("DRAFT_SAVE_FAILED");
      }

      const data = await response.json();
      hydrate(data.session);
      setDraftSyncState("saved");
      setHasSavedJournal(true);
      showToast("当前日志已保存");
    } catch {
      setDraftError("保存日志失败，请稍后重试。");
    } finally {
      setIsSavingJournal(false);
    }
  }

  async function handleCompleteInterview() {
    if (!sessionId || !canCompleteInterview) {
      return;
    }

    stopDraftAutosave();

    const confirmed = window.confirm("结束后将不能继续补充这轮访谈。现在结束访谈吗？");

    if (!confirmed) {
      return;
    }

    if (hasUnsavedDraftChanges) {
      const synced = await persistDraftEdits();

      if (!synced) {
        return;
      }
    }

    setError(null);
    setDraftError(null);
    setIsCompletingInterview(true);

    try {
      const response = await fetch("/api/interview/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        throw new Error("SESSION_COMPLETE_FAILED");
      }

      const data = (await response.json()) as { session: InterviewSessionRecord };
      hydrate(data.session);
    } catch {
      setError("暂时无法结束访谈，请稍后重试。");
    } finally {
      setIsCompletingInterview(false);
    }
  }

  async function handleClosePanel() {
    if (hasUnsavedDraftChanges) {
      const synced = await persistDraftEdits();

      if (!synced) {
        return;
      }
    }

    setPanelOpen(false);
  }

  async function handleTogglePanel() {
    if (!canOpenWorkspace) {
      return;
    }

    if (panelOpen) {
      await handleClosePanel();
      return;
    }

    setPanelOpen(true);
  }

  const canOpenWorkspace = Boolean(journalEntry);
  const workspaceToggleLabel = panelOpen ? "关闭日志" : hasSavedJournal ? "打开日志" : "继续整理日志";

  return (
    <section
      ref={shellRef}
      className={`grid min-h-0 gap-5 overflow-hidden ${panelOpen ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]" : ""}`}
      style={shellHeight ? { height: `${shellHeight}px` } : undefined}
    >
      <div className="page-shell flex min-h-0 flex-col rounded-[36px] p-4 md:p-5">
        {!isInterviewLocked && !showActiveDraftCard ? (
          <div
            data-testid="interview-top-bar"
            className="relative z-10 flex items-start justify-end px-2 pb-3"
          >
            <InterviewMetaActions
              onPauseInterview={handlePauseInterview}
              pauseDisabled={!canPauseInterview}
            />
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1">
          <div
            ref={messageScrollRef}
            data-testid="interview-message-scroll"
            className="panel-scroll h-full min-h-0 overflow-y-auto overscroll-contain px-2"
          >
            <div className={`flex min-h-full flex-col gap-3 pt-1 ${isInterviewLocked ? "pb-4" : "pb-24 md:pb-28"}`}>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {optimisticUserMessage ? <MessageBubble content={optimisticUserMessage} role="user" /> : null}
              {showStreamingBubble ? (
                <MessageBubble content={assistantState === "thinking" ? "正在思考中..." : streamedAssistantText || "…"} />
              ) : null}
              {messages.length === 0 && !showBootBubble && !showStreamingBubble ? (
                <div className="flex flex-1 items-center justify-center rounded-[26px] border border-dashed border-[rgba(206,179,142,0.34)] bg-[linear-gradient(180deg,rgba(243,231,211,0.94),rgba(231,215,188,0.9))] p-5 text-center text-sm leading-6 text-[#5c4e41] shadow-[0_18px_40px_rgba(5,8,17,0.16)]">
                  {dimensionMeta.emptyState}
                </div>
              ) : null}
              {showBootBubble ? (
                <MessageBubble
                  content={
                    bootState === "restoring"
                      ? "我正在把你上一次停下来的访谈接回来。"
                      : "我正在准备这一轮访谈的第一句提问。"
                  }
                />
              ) : null}
              {showDraftPrompt ? (
                <DraftTransitionCard
                  onGenerate={handleGenerateDraft}
                  disabled={isBusy || isGeneratingDraft}
                  isGenerating={isGeneratingDraft}
                />
              ) : null}
              {showActiveDraftCard ? (
                <ActiveDraftCard
                  onToggleWorkspace={() => void handleTogglePanel()}
                  workspaceToggleLabel={workspaceToggleLabel}
                  onContinueInterview={handleContinueInterview}
                  onPauseInterview={handlePauseInterview}
                  pauseDisabled={!canPauseInterview}
                  isDraftStale={isDraftStale}
                />
              ) : null}
            </div>
          </div>

          {!isInterviewLocked ? (
            <div
              data-testid="interview-floating-composer"
              className="absolute inset-x-2 bottom-3 z-20 md:bottom-4"
            >
              {error ? <p className="mb-2 px-2 text-sm text-[#9f3a2f]">{error}</p> : null}
              <div className="liquid-composer rounded-[26px] px-2 py-1.5 md:px-2.5">
                <textarea
                  ref={inputRef}
                  id="interview-input"
                  rows={1}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onCompositionStart={() => {
                    isInputComposingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    isInputComposingRef.current = false;
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder={dimensionMeta.inputPlaceholder}
                  className="max-h-44 min-h-[2.25rem] w-full resize-none bg-transparent px-4 py-1.5 pr-20 text-sm leading-6 text-[#2d241c] outline-none transition placeholder:text-[#ab9886]"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSendInput}
                  aria-label={assistantState === "idle" ? "发送回答" : "生成中"}
                  className="absolute right-3 top-1/2 inline-flex h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,255,255,0.46)] bg-[linear-gradient(180deg,rgba(244,225,199,0.96),rgba(229,201,169,0.94))] px-3 text-sm text-[#3c2d20] shadow-[0_12px_24px_rgba(120,92,63,0.18),inset_0_1px_0_rgba(255,255,255,0.5)] transition hover:-translate-y-[calc(50%+2px)] hover:bg-[linear-gradient(180deg,rgba(248,230,205,0.98),rgba(233,205,173,0.96))] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assistantState === "idle" ? (
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 15.5v-9" />
                      <path d="M4.5 9.5 10 4l5.5 5.5" />
                    </svg>
                  ) : (
                    <span className="px-1 text-xs font-medium">生成中</span>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {isInterviewLocked ? (
          <div className="wood-dialog relative z-10 mt-3 shrink-0 rounded-[30px] px-3 py-3 shadow-[0_24px_60px_rgba(130,92,45,0.15)] md:px-4">
            <InterviewEndedCard
              title={isInterviewPaused ? "本轮访谈已暂停" : "访谈已结束"}
              onToggleWorkspace={journalEntry ? () => void handleTogglePanel() : undefined}
              workspaceToggleLabel={journalEntry ? workspaceToggleLabel : undefined}
              onReopen={isInterviewPaused ? handleReopenInterview : undefined}
              onCompleteInterview={isInterviewPaused ? handleCompleteInterview : undefined}
              reopenDisabled={
                isReopeningInterview || isBusy || isGeneratingDraft || isSavingJournal || isPausingInterview || isCompletingInterview
              }
              completeDisabled={
                isBusy || isGeneratingDraft || isSavingJournal || isReopeningInterview || isPausingInterview || isCompletingInterview
              }
            />
            {error ? <p className="mt-3 text-sm text-[#9f3a2f]">{error}</p> : null}
          </div>
        ) : null}
      </div>

      {panelOpen ? (
        <aside className="paper-sheet flex min-h-0 flex-col rounded-[34px] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(142,99,55,0.16)] pb-4">
            <h3 className="font-display text-[1.9rem] leading-tight text-[#221d17]">日志整理工作区</h3>
            <button
              type="button"
              aria-label="关闭日志面板"
              onClick={handleClosePanel}
              disabled={draftSyncState === "saving" || isSavingJournal}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(150,109,66,0.2)] bg-[rgba(255,249,239,0.72)] text-[#5a4632] transition hover:bg-[rgba(255,249,239,0.94)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l8 8" />
                <path d="M10 2L2 10" />
              </svg>
            </button>
          </div>

          {panelStatusText ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[rgba(161,117,72,0.18)] bg-[rgba(251,242,228,0.84)] px-3 py-1 text-[12px] text-[#7e5d3f]">
                {panelStatusText}
              </span>
            </div>
          ) : null}

          {isGeneratingDraft && !journalEntry ? (
            <DraftPanelStateCard
              loading
              title="AI 正在整理日志草稿"
              description="我会根据刚刚的访谈内容生成一份初稿，完成后你可以直接在这里修改、确认和保存。"
            />
          ) : draftGenerateIssue && !journalEntry ? (
            <DraftPanelStateCard
              accent="error"
              title="这次没能成功生成日志"
              description={draftGenerateIssue.message}
              actions={
                <>
                  {draftGenerateIssue.retryable ? (
                    <button
                      type="button"
                      onClick={handleGenerateDraft}
                      className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)]"
                    >
                      重试生成
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className="rounded-full border border-[rgba(168,124,69,0.2)] bg-[rgba(255,250,242,0.72)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)]"
                  >
                    关闭面板
                  </button>
                </>
              }
            />
          ) : journalEntry ? (
            <div className="mt-5 flex min-h-0 flex-1 flex-col">
              {isDraftStale ? (
                <div className="rounded-[24px] border border-[rgba(181,92,78,0.16)] bg-[linear-gradient(180deg,rgba(253,245,242,0.96),rgba(248,231,224,0.94))] px-4 py-3 text-sm leading-7 text-[#8b5148]">
                  当前日志草稿基于更早的访谈内容，如需同步最新补充，请生成最新日志。
                </div>
              ) : null}
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="给这篇日志起个标题"
                className={`rounded-[22px] border border-[rgba(160,115,67,0.18)] bg-[rgba(255,249,240,0.86)] px-4 py-3 text-lg text-[#241d16] outline-none transition placeholder:text-[#9c7a56] focus:border-[#9f6838] focus:shadow-[0_0_0_4px_rgba(169,111,61,0.1)] ${isDraftStale ? "mt-4" : ""}`}
              />
              <textarea
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                placeholder="日志正文会出现在这里，你可以像编辑文章一样继续修改。"
                className="mt-4 min-h-0 flex-1 resize-none rounded-[28px] border border-[rgba(160,115,67,0.16)] bg-[linear-gradient(180deg,rgba(255,250,243,0.98),rgba(244,232,211,0.96))] px-5 py-4 text-sm leading-8 text-[#302114] shadow-[inset_0_1px_0_rgba(255,255,255,0.64)] outline-none transition placeholder:text-[#9c7a56] focus:border-[#9f6838] focus:shadow-[0_0_0_4px_rgba(169,111,61,0.1)]"
              />
              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleRegenerateDraft}
                  disabled={isGeneratingDraft || isSavingJournal || isPausingInterview || isCompletingInterview}
                  className="rounded-full border border-[rgba(168,124,69,0.24)] bg-[rgba(250,241,225,0.56)] px-4 py-1.5 text-sm text-[#5c452e] transition hover:bg-[rgba(250,241,225,0.86)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  生成最新日志
                </button>
                <button
                  type="button"
                  onClick={handleSaveJournal}
                  disabled={!canSaveJournal || isGeneratingDraft || isSavingJournal || isPausingInterview || isCompletingInterview}
                  className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {hasSavedJournal ? "保存修改" : "保存正式日志"}
                </button>
              </div>
            </div>
          ) : (
            <DraftPanelStateCard
              title="等待生成日志草稿"
              description="AI 会先根据左侧访谈内容整理出一份正文初稿，拿到内容后这里才会进入正式编辑状态。"
            />
          )}

          {draftError ? <p className="mt-4 text-sm text-[#9f3a2f]">{draftError}</p> : null}
          {journalEntry && draftGenerateIssue ? <p className="mt-4 text-sm text-[#9f3a2f]">{draftGenerateIssue.message}</p> : null}
        </aside>
      ) : null}
      {toastState?.visible ? <SaveToast message={toastState.message} /> : null}
    </section>
  );
}
