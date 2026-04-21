"use client";

import React, { useEffect, useRef, useState } from "react";
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

const interviewBootstrapTasks = new Map<InterviewDimension, Promise<InterviewSessionRecord | null>>();

function MessageBubble({
  message,
  content
}: {
  message?: InterviewMessage;
  content?: string;
}) {
  const isAssistant = message ? message.role === "assistant" : true;
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

  if (session.status === "active") {
    return true;
  }

  return session.status === "completed" && !session.finalEntry;
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
  const { dimension, sessionId, status, messages, snapshot, turnCount, draft, setDimension, hydrate, reset } =
    useInterviewStore();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [bootState, setBootState] = useState<BootState>("idle");
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | null>(null);
  const [streamedAssistantText, setStreamedAssistantText] = useState("");
  const currentDimension = normalizeInterviewDimension(searchParams.get("dimension") ?? dimension);
  const dimensionMeta = getInterviewDimensionMeta(currentDimension);
  const showFinalizeButton = status === "completed" && !draft;
  const showRestartButton = Boolean(sessionId || messages.length > 0);
  const bootSequenceRef = useRef(0);
  const activeStreamIdRef = useRef(0);
  const streamQueueRef = useRef("");
  const streamTimerRef = useRef<number | null>(null);
  const pendingSessionRef = useRef<InterviewSessionRecord | null>(null);
  const streamCompletedRef = useRef(false);
  const streamResolverRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const [shellHeight, setShellHeight] = useState<number | null>(null);

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

    if (status === "completed" && draft) {
      clearStoredInterviewSessionId(currentDimension);
      return;
    }

    setStoredInterviewSessionId(currentDimension, sessionId);
  }, [currentDimension, draft, sessionId, status]);

  function stopStreamPump() {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }

  function clearStreamState() {
    stopStreamPump();
    streamQueueRef.current = "";
    pendingSessionRef.current = null;
    streamCompletedRef.current = false;
    setOptimisticUserMessage(null);
    setStreamedAssistantText("");
    setAssistantState("idle");
  }

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

  async function ensureSession(nextDimension: InterviewDimension, forceNew = false) {
    if (!forceNew && sessionId && dimension === nextDimension) {
      return sessionId;
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
  }

  useEffect(() => {
    setInput("");
    setError(null);
    clearStreamState();
    reset(currentDimension);
    void ensureSession(currentDimension);
  }, [currentDimension]);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ block: "end" });
    }
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

  async function handleRestart() {
    setError(null);
    setIsBusy(true);
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

  async function handleFinalize() {
    if (!sessionId || isBusy) return;

    setError(null);
    setIsBusy(true);

    try {
      const response = await fetch("/api/interview/session/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        setError("日志整理失败，请稍后重试。");
        return;
      }

      const data = await response.json();
      hydrate(data.session);
    } finally {
      setIsBusy(false);
    }
  }

  const statusText =
    bootState === "restoring"
      ? "恢复会话中"
      : bootState === "booting"
        ? "准备开场中"
        : sessionId
          ? "会话进行中"
          : "等待连接";

  const showBootBubble = messages.length === 0 && bootState !== "idle";
  const showStreamingBubble = assistantState !== "idle";

  return (
    <section
      ref={shellRef}
      className="grid min-h-0 gap-5 overflow-hidden lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)]"
      style={shellHeight ? { height: `${shellHeight}px` } : undefined}
    >
      <div className="page-shell flex min-h-0 flex-col rounded-[36px] p-4 md:p-5">
        <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-display text-[2rem] leading-tight text-ink md:text-[2.35rem]">
              {dimensionMeta.title}
            </h2>
          </div>
          {showRestartButton ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRestart}
                disabled={isBusy}
                className="rounded-full border border-[rgba(115,74,37,0.24)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-5 py-1.5 text-sm text-[#2f2823] transition duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:opacity-50"
              >
                重新开始
              </button>
            </div>
          ) : null}
        </div>

        <div className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col rounded-[30px] border border-[rgba(119,79,40,0.16)] bg-[linear-gradient(180deg,rgba(251,244,232,0.78),rgba(232,212,178,0.96)),repeating-linear-gradient(90deg,rgba(118,78,37,0.08)_0_2px,rgba(255,249,239,0.05)_2px_12px,rgba(134,92,49,0.07)_12px_20px,transparent_20px_38px)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
          <div className="flex items-center justify-between border-b border-[rgba(156,114,70,0.12)] pb-2.5">
            <p className="font-mono text-[0.68rem] tracking-[0.24em] text-ink/58">{statusText}</p>
          </div>
          <div
            data-testid="interview-message-scroll"
            className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
          >
            <div className="flex min-h-full flex-col gap-3 pb-1">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {optimisticUserMessage ? <MessageBubble content={optimisticUserMessage} /> : null}
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
              <div ref={bottomRef} />
            </div>
          </div>
        </div>

        <div className="wood-dialog relative z-10 mt-4 shrink-0 rounded-[30px] p-3.5 shadow-[0_24px_60px_rgba(130,92,45,0.15)]">
          <div className="flex items-center justify-end gap-4">
            <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6b6259]">
              第 {turnCount || 0} 轮
            </p>
          </div>
          <textarea
            id="interview-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={dimensionMeta.inputPlaceholder}
            className="mt-2.5 min-h-24 w-full resize-none rounded-[24px] border border-[rgba(133,91,47,0.22)] bg-[linear-gradient(180deg,rgba(251,245,235,0.94),rgba(241,227,202,0.95)),repeating-linear-gradient(90deg,rgba(144,98,52,0.05)_0_1px,transparent_1px_12px,rgba(255,250,241,0.06)_12px_18px,transparent_18px_28px)] px-4 py-2.5 text-sm leading-6 text-[#241d16] shadow-[inset_0_1px_0_rgba(255,255,255,0.58),0_10px_24px_rgba(125,91,47,0.08)] outline-none transition placeholder:text-[#8d6b4a] focus:border-[#9f6838] focus:bg-[linear-gradient(180deg,rgba(252,247,239,0.98),rgba(244,231,207,0.98))] focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.68),0_0_0_4px_rgba(169,111,61,0.12)]"
          />
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
            {draft ? <p className="text-sm text-[#5a4a3c]">日志草稿已整理，可在右侧查看。</p> : <div />}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isBusy}
                className="rounded-full border border-[rgba(168,124,69,0.42)] bg-[linear-gradient(180deg,#d5ae79,#bc8f58)] px-4 py-1.5 text-sm text-[#2f2823] shadow-[0_10px_24px_rgba(125,91,47,0.18)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb883,#c5965d)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {assistantState === "idle" ? "发送回答" : "生成中"}
              </button>
              {showFinalizeButton ? (
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={!snapshot || isBusy}
                  className="rounded-full border border-[rgba(168,124,69,0.24)] bg-[rgba(250,241,225,0.56)] px-4 py-1.5 text-sm text-[#5c452e] transition hover:bg-[rgba(250,241,225,0.86)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  整理成日志
                </button>
              ) : null}
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-[#9f3a2f]">{error}</p> : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-6">
        <div className="wood-board shrink-0 rounded-[32px] p-6">
          <div className="relative z-10">
            <h3 className="font-display text-[1.7rem] text-[#2f2217] md:text-[1.95rem]">抽取快照</h3>
            <p className="mt-2 text-sm leading-7 text-[#5a4632]">
              这里显示当前已经抓住的关键信息，方便你判断哪些地方还需要补充。
            </p>
          </div>
          <dl className="relative z-10 mt-6 space-y-4 text-sm text-[#2f2217]">
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[#6a5e53]">事件</dt>
              <dd className="mt-1">{snapshot?.event ?? "待识别"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[#6a5e53]">感受</dt>
              <dd className="mt-1">{snapshot?.feeling ?? "待识别"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[#6a5e53]">{dimensionMeta.reasonLabel}</dt>
              <dd className="mt-1">{snapshot?.whyItMattered ?? "待识别"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[#6a5e53]">{dimensionMeta.summaryLabel}</dt>
              <dd className="mt-1">{snapshot?.happinessType ?? snapshot?.selfPattern ?? "待识别"}</dd>
            </div>
          </dl>
        </div>

        <div className="wood-dialog flex min-h-0 flex-1 flex-col rounded-[32px] p-6">
          <div className="relative z-10">
            <h3 className="font-display text-[1.7rem] text-[#221d17] md:text-[1.95rem]">日志草稿</h3>
            {!draft ? <p className="mt-2 text-sm leading-7 text-[#5d5042]">{dimensionMeta.draftDescription}</p> : null}
          </div>
          {draft ? (
            <div className="panel-scroll mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm leading-8 text-[#3f352c]">
              <p className="font-display text-xl text-[#221d17]">{draft.title}</p>
              <p className="whitespace-pre-line">{draft.content}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
