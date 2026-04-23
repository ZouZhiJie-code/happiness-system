"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getAssistantDisplayParts } from "@/features/joy-interview/assistant-turn";
import {
  clearStoredInterviewSessionId,
  getInterviewDimensionMeta,
  getStoredInterviewSessionEntry,
  interviewLeaveConfirmMessage,
  interviewDimensionStorageKey,
  normalizeInterviewDimension,
  touchStoredInterviewSessionId
} from "@/features/interview/dimensions";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewDimension, InterviewMessage, InterviewSessionRecord } from "@/types/interview";

type BootState = "idle" | "booting" | "restoring";
type AssistantState = "idle" | "thinking" | "insight" | "question";
type StreamingTarget = "insight" | "question";
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
  role,
  variant = "default"
}: {
  message?: InterviewMessage;
  content?: string;
  role?: InterviewMessage["role"];
  variant?: "default" | "question";
}) {
  const bubbleRole = message?.role ?? role ?? "assistant";
  const isAssistant = bubbleRole === "assistant";
  const bubbleContent = content ?? message?.content ?? "";
  const isQuestion = variant === "question";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-2xl rounded-[28px] border px-4 py-3 text-sm leading-7 shadow-soft ${
          isAssistant
            ? isQuestion
              ? "border-[rgba(166,111,59,0.24)] bg-[linear-gradient(180deg,rgba(255,246,234,0.98),rgba(243,226,199,0.96))] text-[#2b2118]"
              : "border-[rgba(156,114,70,0.14)] bg-[rgba(255,248,238,0.44)] text-ink"
            : "border-[rgba(133,91,47,0.2)] bg-[linear-gradient(180deg,rgba(221,185,133,0.96),rgba(195,152,97,0.96))] text-[#2f2823]"
        }`}
      >
        <p className={`whitespace-pre-wrap ${isQuestion ? "font-medium" : ""}`}>{bubbleContent}</p>
      </div>
    </div>
  );
}

function ConversationMessage({ message }: { message: InterviewMessage }) {
  if (message.role !== "assistant") {
    return <MessageBubble message={message} />;
  }

  const assistantPayload = message.assistantPayload;

  if (!assistantPayload) {
    return <MessageBubble message={message} />;
  }

  const parts = getAssistantDisplayParts(assistantPayload);

  return (
    <React.Fragment>
      {parts.insight ? <MessageBubble content={parts.insight} role="assistant" /> : null}
      {parts.question ? <MessageBubble content={parts.question} role="assistant" variant="question" /> : null}
    </React.Fragment>
  );
}

function ChoiceActionCard({
  onContinue,
  onGenerate,
  continueDisabled,
  generateDisabled
}: {
  onContinue: () => void;
  onGenerate: () => void;
  continueDisabled: boolean;
  generateDisabled: boolean;
}) {
  return (
    <div className="ml-4 w-full max-w-[31rem] rounded-[28px] border border-[rgba(153,103,54,0.16)] bg-[linear-gradient(180deg,rgba(250,243,230,0.98),rgba(235,217,187,0.92))] p-4 shadow-[0_18px_42px_rgba(124,83,43,0.12)]">
      <p className="font-mono text-[0.65rem] tracking-[0.22em] text-[#9a734d]">访谈分岔点</p>
      <h4 className="mt-2 font-display text-[1.35rem] text-[#2e2319]">可以换个角度继续，也可以现在整理</h4>
      <p className="mt-2 text-sm leading-7 text-[#594537]">
        如果你愿意，我会换一个切口继续帮你往里挖；如果现在的信息已经够了，也可以直接整理成日志。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled}
          className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          换个角度继续聊
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generateDisabled}
          className="rounded-full border border-[rgba(168,124,69,0.2)] bg-[rgba(255,250,242,0.72)] px-4 py-1.5 text-sm text-[#6a5642] transition hover:bg-[rgba(255,250,242,0.96)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          现在整理日志
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

function InterviewEndedCard({
  title,
  onToggleWorkspace,
  workspaceToggleLabel
}: {
  title: string;
  onToggleWorkspace?: () => void;
  workspaceToggleLabel?: string;
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

async function reopenInterviewSession(sessionId: string) {
  const response = await fetch("/api/interview/session/reopen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  });

  if (!response.ok) {
    throw new Error("SESSION_REOPEN_FAILED");
  }

  const data = (await response.json()) as { session: InterviewSessionRecord };
  return data.session;
}

function isRestorableSession(session: InterviewSessionRecord, dimension: InterviewDimension) {
  if (session.dimension !== dimension) {
    return false;
  }

  return session.status === "active" || session.status === "paused";
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
      const storedSessionEntry = getStoredInterviewSessionEntry(dimension);
      const storedSessionId = storedSessionEntry?.sessionId ?? null;

      if (storedSessionId) {
        try {
          const restoredSession = await fetchInterviewSession(storedSessionId);

          if (isRestorableSession(restoredSession, dimension)) {
            if (restoredSession.status === "paused") {
              return reopenInterviewSession(restoredSession.id);
            }

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
    draftGenerationRequestId,
    draftGenerationUnlocked: sessionDraftGenerationUnlocked,
    dimension,
    setDimension,
    setDraftGenerationControls,
    hydrate,
    journalEntry,
    messages,
    reset,
    sessionId,
    setJournalEntry,
    stage,
    status
  } = useInterviewStore();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [bootState, setBootState] = useState<BootState>("idle");
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | null>(null);
  const [streamedAssistantInsight, setStreamedAssistantInsight] = useState("");
  const [streamedAssistantQuestion, setStreamedAssistantQuestion] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [draftGenerateState, setDraftGenerateState] = useState<DraftGenerateState>("idle");
  const [draftGenerateIssue, setDraftGenerateIssue] = useState<DraftGenerateIssue | null>(null);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [draftSyncState, setDraftSyncState] = useState<DraftSyncState>("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [hasSavedJournal, setHasSavedJournal] = useState(false);
  const [toastState, setToastState] = useState<ToastState>(null);
  const currentDimension = normalizeInterviewDimension(searchParams.get("dimension") ?? dimension);
  const dimensionMeta = getInterviewDimensionMeta(currentDimension);
  const latestAssistantMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "assistant") {
        return messages[index];
      }
    }

    return null;
  }, [messages]);
  const latestAssistantPayload = latestAssistantMessage?.assistantPayload ?? null;
  const bootSequenceRef = useRef(0);
  const activeStreamIdRef = useRef(0);
  const streamQueueRef = useRef<Array<{ target: StreamingTarget; text: string }>>([]);
  const streamTimerRef = useRef<number | null>(null);
  const pendingSessionRef = useRef<InterviewSessionRecord | null>(null);
  const streamCompletedRef = useRef(false);
  const streamResolverRef = useRef<(() => void) | null>(null);
  const lastDraftGenerationRequestRef = useRef(0);
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
  const hasUserMessages = useMemo(() => messages.some((message) => message.role === "user"), [messages]);

  const showChoiceCard = Boolean(
    sessionId &&
      status === "active" &&
      latestAssistantPayload?.stateUpdate.offerChoice &&
      !optimisticUserMessage &&
      assistantState === "idle"
  );
  const showStreamingBubble = assistantState !== "idle" || Boolean(streamedAssistantInsight || streamedAssistantQuestion);
  const showBootBubble = messages.length === 0 && bootState !== "idle";
  const isGeneratingDraft = draftGenerateState === "loading";
  const isInterviewCompleted = status === "completed";
  const isInterviewLocked = status === "paused" || isInterviewCompleted;
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
  const draftGenerationUnlocked = Boolean(sessionId && status === "active" && sessionDraftGenerationUnlocked);
  const canRequestDraftGeneration = Boolean(
    sessionId &&
      status === "active" &&
      !isBusy &&
      !isGeneratingDraft &&
      !isSavingJournal
  );
  const canSendInput = Boolean(
    input.trim() &&
      !isBusy &&
      !isGeneratingDraft &&
      !isSavingJournal &&
      !isInterviewLocked &&
      !showChoiceCard
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
      setDraftGenerationControls({
        unlocked: false,
        busy: false,
        disabled: true
      });
      return;
    }

    if (status === "active") {
      touchStoredInterviewSessionId(currentDimension, sessionId);
      return;
    }

    clearStoredInterviewSessionId(currentDimension);
  }, [currentDimension, sessionId, setDraftGenerationControls, status]);

  useEffect(() => {
    setDraftGenerationControls({
      unlocked: draftGenerationUnlocked,
      busy: isGeneratingDraft,
      disabled: !canRequestDraftGeneration
    });
  }, [canRequestDraftGeneration, draftGenerationUnlocked, isGeneratingDraft, setDraftGenerationControls]);

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

  useEffect(() => {
    if (!sessionId || status !== "active") {
      return;
    }

    touchStoredInterviewSessionId(currentDimension, sessionId);
  }, [currentDimension, draftGenerateState, journalEntry?.updatedAt, messages.length, sessionId, status]);

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
    streamQueueRef.current = [];
    pendingSessionRef.current = null;
    streamCompletedRef.current = false;
    setOptimisticUserMessage(null);
    setStreamedAssistantInsight("");
    setStreamedAssistantQuestion("");
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

    if (!streamCompletedRef.current || streamQueueRef.current.length > 0 || !pendingSessionRef.current) {
      return;
    }

    stopStreamPump();
    hydrate(pendingSessionRef.current);
    pendingSessionRef.current = null;
    streamCompletedRef.current = false;
    setOptimisticUserMessage(null);
    setStreamedAssistantInsight("");
    setStreamedAssistantQuestion("");
    setAssistantState("idle");
    streamResolverRef.current?.();
    streamResolverRef.current = null;
  }

  function enqueueAssistantDelta(target: StreamingTarget, text: string, activeStreamId: number) {
    streamQueueRef.current.push({ target, text });

    if (streamTimerRef.current) {
      return;
    }

    streamTimerRef.current = window.setInterval(() => {
      if (activeStreamId !== activeStreamIdRef.current) {
        stopStreamPump();
        return;
      }

      if (streamQueueRef.current.length === 0) {
        maybeFinalizeStream(activeStreamId);
        return;
      }

      const nextChunk = streamQueueRef.current[0];
      const nextChar = nextChunk.text.slice(0, 1);
      nextChunk.text = nextChunk.text.slice(1);

      if (nextChunk.target === "insight") {
        setStreamedAssistantInsight((current) => current + nextChar);
      } else {
        setStreamedAssistantQuestion((current) => current + nextChar);
      }

      if (!nextChunk.text) {
        streamQueueRef.current.shift();
      }

      if (streamQueueRef.current.length === 0) {
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
    const hasStoredSession = !forceNew && Boolean(getStoredInterviewSessionEntry(nextDimension));
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
  }, [assistantState, messages.length, optimisticUserMessage, streamedAssistantInsight, streamedAssistantQuestion]);

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

  useEffect(() => {
    if (typeof window === "undefined" || !sessionId || status !== "active" || !hasUserMessages) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      touchStoredInterviewSessionId(currentDimension, sessionId);
      event.preventDefault();
      event.returnValue = interviewLeaveConfirmMessage;
      return interviewLeaveConfirmMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [currentDimension, hasUserMessages, sessionId, status]);

  async function runInterviewAction(
    payload:
      | {
          action: "reply";
          userMessage: string;
          inputMode: "text";
        }
      | {
          action: "continue";
        }
  ) {
    if (isBusy) {
      return;
    }

    if (isInterviewLocked) {
      setError(status === "paused" ? "这轮旧访谈正在恢复中，请刷新后重试。" : "本轮访谈已结束，不能继续补充。");
      return;
    }

    const optimisticMessage = payload.action === "reply" ? payload.userMessage.trim() : null;

    if (payload.action === "reply" && !optimisticMessage) {
      return;
    }

    setError(null);
    if (payload.action === "reply") {
      setInput("");
      setOptimisticUserMessage(optimisticMessage);
    } else {
      setOptimisticUserMessage(null);
    }
    setIsBusy(true);
    setStreamedAssistantInsight("");
    setStreamedAssistantQuestion("");
    setAssistantState("thinking");
    streamQueueRef.current = [];
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
        body: JSON.stringify(
          payload.action === "reply"
            ? {
                action: "reply",
                sessionId: resolvedSessionId,
                userMessage: optimisticMessage,
                inputMode: payload.inputMode
              }
            : {
                action: "continue",
                sessionId: resolvedSessionId
              }
        )
      });

      if (!response.ok || !response.body) {
        throw new Error("INTERVIEW_RESPOND_FAILED");
      }

      const responseBody = response.body;

      await new Promise<void>(async (resolve, reject) => {
        streamResolverRef.current = resolve;
        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleChunk = (rawChunk: string) => {
          const parsed = parseSseChunk(rawChunk);

          if (!parsed) {
            return;
          }

          if (parsed.event === "phase") {
            const nextState = parsed.data.state;

            if (nextState === "thinking" || nextState === "insight" || nextState === "question") {
              setAssistantState(nextState);
            }

            return;
          }

          if (parsed.event === "delta") {
            const text = typeof parsed.data.text === "string" ? parsed.data.text : "";
            const target =
              parsed.data.target === "insight" || parsed.data.target === "question"
                ? (parsed.data.target as StreamingTarget)
                : "question";

            if (text) {
              enqueueAssistantDelta(target, text, activeStreamId);
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
      if (payload.action === "reply" && optimisticMessage) {
        setInput(optimisticMessage);
      }
      setError(payload.action === "continue" ? "暂时无法继续追问，请稍后再试。" : "这一轮提交失败了，请再试一次。");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSend() {
    await runInterviewAction({
      action: "reply",
      userMessage: input,
      inputMode: "text"
    });
  }

  async function handleContinueChoice() {
    setPanelOpen(false);
    await runInterviewAction({
      action: "continue"
    });
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
    if (!sessionId || !draftGenerationUnlocked || isGeneratingDraft || isBusy || isSavingJournal) {
      return;
    }

    if (hasUnsavedDraftChanges) {
      const confirmed = window.confirm("生成日志会覆盖当前未保存的手动修改，是否继续？");

      if (!confirmed) {
        return;
      }
    }

    stopDraftAutosave();

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

  useEffect(() => {
    if (draftGenerationRequestId === 0 || draftGenerationRequestId === lastDraftGenerationRequestRef.current) {
      return;
    }

    lastDraftGenerationRequestRef.current = draftGenerationRequestId;
    void handleGenerateDraft();
  }, [draftGenerationRequestId]);

  return (
    <section
      ref={shellRef}
      className={`grid min-h-0 gap-5 overflow-hidden ${panelOpen ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]" : ""}`}
      style={shellHeight ? { height: `${shellHeight}px` } : undefined}
    >
      <div className="page-shell flex min-h-0 flex-col rounded-[36px] p-4 md:p-5">
        <div className="relative min-h-0 flex-1">
          <div
            ref={messageScrollRef}
            data-testid="interview-message-scroll"
            className="panel-scroll h-full min-h-0 overflow-y-auto overscroll-contain px-2"
          >
            <div className={`flex min-h-full flex-col gap-3 pt-1 ${isInterviewLocked ? "pb-4" : "pb-24 md:pb-28"}`}>
              {messages.map((message) => (
                <ConversationMessage key={message.id} message={message} />
              ))}
              {optimisticUserMessage ? <MessageBubble content={optimisticUserMessage} role="user" /> : null}
              {showStreamingBubble ? (
                <>
                  {assistantState === "thinking" && !streamedAssistantInsight && !streamedAssistantQuestion ? (
                    <MessageBubble content="正在思考中..." />
                  ) : null}
                  {streamedAssistantInsight ? <MessageBubble content={streamedAssistantInsight} role="assistant" /> : null}
                  {streamedAssistantQuestion ? (
                    <MessageBubble content={streamedAssistantQuestion} role="assistant" variant="question" />
                  ) : null}
                </>
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
              {showChoiceCard ? (
                <>
                  <ChoiceActionCard
                    onContinue={() => void handleContinueChoice()}
                    onGenerate={() => void handleGenerateDraft()}
                    continueDisabled={isBusy || isGeneratingDraft || isSavingJournal}
                    generateDisabled={!canRequestDraftGeneration}
                  />
                  {error ? <p className="ml-4 text-sm text-[#9f3a2f]">{error}</p> : null}
                </>
              ) : null}
            </div>
          </div>

          {!isInterviewLocked && !showChoiceCard ? (
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
              title={journalEntry?.status === "saved" ? "日志已保存，访谈已结束" : "访谈已结束"}
              onToggleWorkspace={journalEntry ? () => void handleTogglePanel() : undefined}
              workspaceToggleLabel={journalEntry ? workspaceToggleLabel : undefined}
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
                  当前日志草稿基于更早的访谈内容，如需同步最新补充，请点击顶部“生成日志”。
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
                  onClick={handleSaveJournal}
                  disabled={!canSaveJournal || isGeneratingDraft || isSavingJournal}
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
